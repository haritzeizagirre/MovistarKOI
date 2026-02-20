import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchAllTeams,
  fetchTeamById,
  fetchUpcomingMatches,
  fetchLiveMatches,
  fetchPastMatches,
  fetchMatchesByTeam,
  initializeKoiTeams,
} from '../services/dataService';
import { scheduleMatchReminders } from '../services/notificationService';
import { Team, Match, Game } from '../types';

// ─── Generic async hook ────────────────────────────────────────────

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: any[] = [],
  autoRefreshMs?: number,
  enabled: boolean = true
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    console.log('[useAsync] load called, enabled:', enabled);
    if (!enabled) return;
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      console.log('[useAsync] fetcher resolved, result length:', Array.isArray(result) ? result.length : 'N/A');
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Error desconocido');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [...deps, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      load();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [load, enabled]);

  // Auto-refresh (e.g. for live data)
  useEffect(() => {
    if (!autoRefreshMs) return;
    const interval = setInterval(() => {
      load();
    }, autoRefreshMs);
    return () => clearInterval(interval);
  }, [autoRefreshMs, load]);

  return { data, loading, error, refresh: load };
}

// ─── Initialization ────────────────────────────────────────────────

let _initReady = false;

export function useInitialize(): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(_initReady);
  const [error, setError] = useState<string | null>(null);
  console.log('[useInitialize] called, _initReady:', _initReady, 'ready state:', ready);

  useEffect(() => {
    if (_initReady) {
      console.log('[useInitialize] already ready, skipping init');
      setReady(true);
      return;
    }
    console.log('[useInitialize] starting initializeKoiTeams...');
    initializeKoiTeams()
      .then(() => {
        console.log('[useInitialize] initializeKoiTeams succeeded');
        _initReady = true;
        setReady(true);
      })
      .catch((err) => {
        console.warn('[useInitialize] Init error:', err);
        setError(err.message);
        _initReady = true;
        setReady(true); // Still allow app to load with fallback data
      });
  }, []);

  return { ready, error };
}

// ─── Teams ─────────────────────────────────────────────────────────

export function useTeams(gameFilter?: Game | 'all') {
  const state = useAsync<Team[]>(() => fetchAllTeams(), []);

  // Derived filtered list
  const filteredTeams =
    gameFilter && gameFilter !== 'all'
      ? (state.data || []).filter((t) => t.game === gameFilter)
      : state.data || [];

  return { ...state, teams: filteredTeams };
}

export function useTeam(teamId: string) {
  return useAsync<Team | undefined>(() => fetchTeamById(teamId), [teamId]);
}

// ─── Matches ───────────────────────────────────────────────────────

export function useUpcomingMatches(gameFilter?: Game | 'all') {
  const { ready } = useInitialize();
  const state = useAsync<Match[]>(() => fetchUpcomingMatches(), [ready], undefined, ready);

  const filteredMatches =
    gameFilter && gameFilter !== 'all'
      ? (state.data || []).filter((m) => m.game === gameFilter)
      : state.data || [];

  return { ...state, matches: filteredMatches };
}

export function useLiveMatches(gameFilter?: Game | 'all') {
  const { ready } = useInitialize();
  // Auto-refresh every 30 seconds
  const state = useAsync<Match[]>(() => fetchLiveMatches(), [ready], 30_000, ready);

  const filteredMatches =
    gameFilter && gameFilter !== 'all'
      ? (state.data || []).filter((m) => m.game === gameFilter)
      : state.data || [];

  return { ...state, matches: filteredMatches };
}

export function usePastMatches(gameFilter?: Game | 'all') {
  const { ready } = useInitialize();
  const state = useAsync<Match[]>(() => {
    console.log('[usePastMatches] calling fetchPastMatches...');
    return fetchPastMatches();
  }, [ready], undefined, ready);

  const filteredMatches =
    gameFilter && gameFilter !== 'all'
      ? (state.data || []).filter((m) => m.game === gameFilter)
      : state.data || [];

  return { ...state, matches: filteredMatches };
}

export function useTeamMatches(teamId: string) {
  const state = useAsync<Match[]>(() => fetchMatchesByTeam(teamId), [teamId]);

  const upcoming = (state.data || []).filter((m) => m.status === 'upcoming');
  const live = (state.data || []).filter((m) => m.status === 'live');
  const past = (state.data || []).filter((m) => m.status === 'finished');

  return { ...state, upcoming, live, past, allMatches: state.data || [] };
}

export function useMatchDetails(matchId: string) {
  const { ready } = useInitialize();
  // We use string matchId here, fetchMatchDetails handles the conversion
  return useAsync<Match | undefined>(
    () => {
      // DataService fetchMatchDetails expects the full panda-match-ID string
      return import('../services/dataService').then((m) => m.fetchMatchDetails(matchId));
    },
    [matchId, ready],
    undefined,
    ready && Boolean(matchId)
  );
}

// ─── Combined calendar data ────────────────────────────────────────

interface CalendarData {
  liveMatches: Match[];
  upcomingMatches: Match[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCalendarData(gameFilter?: Game | 'all'): CalendarData {
  const live = useLiveMatches(gameFilter);
  const upcoming = useUpcomingMatches(gameFilter);

  const loading = live.loading || upcoming.loading;
  const error = live.error || upcoming.error;

  const refresh = useCallback(async () => {
    await Promise.all([live.refresh(), upcoming.refresh()]);
  }, [live.refresh, upcoming.refresh]);

  // Schedule / refresh match reminders whenever upcoming data changes
  useEffect(() => {
    if (!loading && upcoming.matches.length > 0) {
      scheduleMatchReminders(upcoming.matches).catch((err) =>
        console.warn('Failed to schedule reminders:', err)
      );
    }
  }, [upcoming.matches, loading]);

  return {
    liveMatches: live.matches,
    upcomingMatches: upcoming.matches,
    loading,
    error,
    refresh,
  };
}

// ─── Combined results data ─────────────────────────────────────────

interface ResultsData {
  liveMatches: Match[];
  pastMatches: Match[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useResultsData(gameFilter?: Game | 'all'): ResultsData {
  const live = useLiveMatches(gameFilter);
  const past = usePastMatches(gameFilter);

  const loading = live.loading || past.loading;
  const error = live.error || past.error;

  const refresh = useCallback(async () => {
    await Promise.all([live.refresh(), past.refresh()]);
  }, [live.refresh, past.refresh]);

  return {
    liveMatches: live.matches,
    pastMatches: past.matches,
    loading,
    error,
    refresh,
  };
}
