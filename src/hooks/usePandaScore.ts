import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchAllTeams,
  fetchTeamById,
  fetchUpcomingMatches,
  fetchLiveMatches,
  fetchPastMatches,
  fetchMatchesByTeam,
  fetchUpcomingTournaments,
  fetchLiveTournaments,
  fetchPastTournaments,
  fetchTournamentsByTeam,
  initializeKoiTeams,
} from '../services/dataService';
import { scheduleMatchReminders } from '../services/notificationService';
import { Team, Match, Game, Tournament, CalendarItem, isTournament, getItemDate } from '../types';

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

/**
 * Shared initialization state.
 * All hook instances read/write the same module-level vars so every
 * `useInitialize()` call (from different hooks) stays in sync.
 */
let _initReady = false;
let _initError: string | null = null;
/** Listeners that get notified when init finishes. */
const _initListeners = new Set<() => void>();

function _notifyListeners() {
  _initListeners.forEach((fn) => fn());
}

/** Module-level init trigger — runs only once, all callers share the result. */
let _initStarted = false;
function _ensureInit() {
  if (_initStarted) return;
  _initStarted = true;
  console.log('[useInitialize] starting initializeKoiTeams...');
  initializeKoiTeams()
    .then(() => {
      console.log('[useInitialize] initializeKoiTeams succeeded');
    })
    .catch((err) => {
      console.warn('[useInitialize] Init error:', err);
      _initError = err.message;
    })
    .finally(() => {
      _initReady = true;
      _notifyListeners();
    });
}

export function useInitialize(): { ready: boolean; error: string | null } {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    // If already done before this mount, no need to subscribe
    if (_initReady) return;

    const listener = () => forceUpdate((n) => n + 1);
    _initListeners.add(listener);

    // Kick off init (no-op if already started)
    _ensureInit();

    return () => {
      _initListeners.delete(listener);
    };
  }, []);

  return { ready: _initReady, error: _initError };
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

export function useTeamTournaments(teamId: string) {
  const state = useAsync<Tournament[]>(() => fetchTournamentsByTeam(teamId), [teamId]);

  const upcoming = (state.data || []).filter((t) => t.status === 'upcoming');
  const live = (state.data || []).filter((t) => t.status === 'live');
  const past = (state.data || []).filter((t) => t.status === 'finished');

  return { ...state, upcoming, live, past, allTournaments: state.data || [] };
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

// ─── Tournament hooks ──────────────────────────────────────────────

export function useUpcomingTournaments(gameFilter?: Game | 'all') {
  const { ready } = useInitialize();
  const state = useAsync<Tournament[]>(() => fetchUpcomingTournaments(), [ready], undefined, ready);

  const filtered =
    gameFilter && gameFilter !== 'all'
      ? (state.data || []).filter((t) => t.game === gameFilter)
      : state.data || [];

  return { ...state, tournaments: filtered };
}

export function useLiveTournaments(gameFilter?: Game | 'all') {
  const { ready } = useInitialize();
  const state = useAsync<Tournament[]>(() => fetchLiveTournaments(), [ready], 60_000, ready);

  const filtered =
    gameFilter && gameFilter !== 'all'
      ? (state.data || []).filter((t) => t.game === gameFilter)
      : state.data || [];

  return { ...state, tournaments: filtered };
}

export function usePastTournaments(gameFilter?: Game | 'all') {
  const { ready } = useInitialize();
  const state = useAsync<Tournament[]>(() => fetchPastTournaments(), [ready], undefined, ready);

  const filtered =
    gameFilter && gameFilter !== 'all'
      ? (state.data || []).filter((t) => t.game === gameFilter)
      : state.data || [];

  return { ...state, tournaments: filtered };
}

// ─── Combined calendar data (matches + tournaments) ────────────────

interface CalendarData {
  liveMatches: Match[];
  upcomingMatches: Match[];
  liveTournaments: Tournament[];
  upcomingTournaments: Tournament[];
  /** All items (matches + tournaments) merged and sorted by date */
  allItems: CalendarItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCalendarData(gameFilter?: Game | 'all'): CalendarData {
  const live = useLiveMatches(gameFilter);
  const upcoming = useUpcomingMatches(gameFilter);
  const liveTourneys = useLiveTournaments(gameFilter);
  const upcomingTourneys = useUpcomingTournaments(gameFilter);

  const loading = live.loading || upcoming.loading || liveTourneys.loading || upcomingTourneys.loading;
  const error = live.error || upcoming.error || liveTourneys.error || upcomingTourneys.error;

  const refresh = useCallback(async () => {
    await Promise.all([
      live.refresh(),
      upcoming.refresh(),
      liveTourneys.refresh(),
      upcomingTourneys.refresh(),
    ]);
  }, [live.refresh, upcoming.refresh, liveTourneys.refresh, upcomingTourneys.refresh]);

  // Schedule match reminders
  useEffect(() => {
    if (!loading && upcoming.matches.length > 0) {
      scheduleMatchReminders(upcoming.matches).catch((err) =>
        console.warn('Failed to schedule reminders:', err)
      );
    }
  }, [upcoming.matches, loading]);

  // Merge everything into a sorted list
  const allItems: CalendarItem[] = [
    ...live.matches,
    ...upcoming.matches,
    ...liveTourneys.tournaments,
    ...upcomingTourneys.tournaments,
  ].sort((a, b) => {
    // Live items first
    const aLive = a.status === 'live' ? 0 : 1;
    const bLive = b.status === 'live' ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    // Then by date
    return new Date(getItemDate(a)).getTime() - new Date(getItemDate(b)).getTime();
  });

  return {
    liveMatches: live.matches,
    upcomingMatches: upcoming.matches,
    liveTournaments: liveTourneys.tournaments,
    upcomingTournaments: upcomingTourneys.tournaments,
    allItems,
    loading,
    error,
    refresh,
  };
}

// ─── Combined results data (matches + tournaments) ─────────────────

interface ResultsData {
  liveMatches: Match[];
  pastMatches: Match[];
  liveTournaments: Tournament[];
  pastTournaments: Tournament[];
  /** All items (matches + tournaments) merged and sorted */
  allItems: CalendarItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useResultsData(gameFilter?: Game | 'all'): ResultsData {
  const live = useLiveMatches(gameFilter);
  const past = usePastMatches(gameFilter);
  const liveTourneys = useLiveTournaments(gameFilter);
  const pastTourneys = usePastTournaments(gameFilter);

  const loading = live.loading || past.loading || liveTourneys.loading || pastTourneys.loading;
  const error = live.error || past.error || liveTourneys.error || pastTourneys.error;

  const refresh = useCallback(async () => {
    await Promise.all([
      live.refresh(),
      past.refresh(),
      liveTourneys.refresh(),
      pastTourneys.refresh(),
    ]);
  }, [live.refresh, past.refresh, liveTourneys.refresh, pastTourneys.refresh]);

  // Merge everything
  const allItems: CalendarItem[] = [
    ...live.matches,
    ...liveTourneys.tournaments,
    ...past.matches,
    ...pastTourneys.tournaments,
  ].sort((a, b) => {
    // Live items first
    const aLive = a.status === 'live' ? 0 : 1;
    const bLive = b.status === 'live' ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    // Then by date (newest first for results)
    return new Date(getItemDate(b)).getTime() - new Date(getItemDate(a)).getTime();
  });

  return {
    liveMatches: live.matches,
    pastMatches: past.matches,
    liveTournaments: liveTourneys.tournaments,
    pastTournaments: pastTourneys.tournaments,
    allItems,
    loading,
    error,
    refresh,
  };
}
