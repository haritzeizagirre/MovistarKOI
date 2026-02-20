import { Match, Team } from '../types';

export type StreakType = 'fire' | 'ice' | null;

export interface StreakInfo {
    count: number;
    type: StreakType;
}

export type MatchBadge = 'fire' | 'ice' | 'trophy';

/**
 * Calculates a team's current streak based on their match history.
 * @param matches Sorted list of matches (most recent first)
 * @param teamId The team's ID to check streaks for
 * @returns StreakInfo object with count and type
 */
export const calculateCurrentStreak = (matches: Match[], teamId: string): StreakInfo => {
    let streak = 0;
    let type: StreakType = null;

    // Clean up teamId comparison - handle panda- prefix if needed
    // For simplicity we'll check name/tag inclusion if IDs don't match directly,
    // but strictly we should rely on IDs. The app uses 'panda-' prefix often.

    // Filter for finished matches only and sort by date descending (newest first)
    const finishedMatches = matches
        .filter(m => m.status === 'finished')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (finishedMatches.length === 0) {
        return { count: 0, type: null };
    }

    // Determine the result of the most recent match to set the streak type
    const firstMatch = finishedMatches[0];
    const isHome = firstMatch.homeTeam.tag.toUpperCase().includes('KOI') ||
        firstMatch.homeTeam.name.toLowerCase().includes('koi') ||
        firstMatch.teamId === teamId; // Basic check

    // In our app, KOI is usually normalized to homeTeam, but let's be robust
    // Actually, in `usePandaScore.ts`, we map matches such that KOI is always `homeTeam` if identified.
    // However, let's just use the score comparison logic we use in other places.

    const koiIsHome = firstMatch.homeTeam.tag.toUpperCase().includes('KOI') ||
        firstMatch.homeTeam.name.toLowerCase().includes('koi');

    const koiScore = koiIsHome ? firstMatch.homeTeam.score : firstMatch.awayTeam.score;
    const oppScore = koiIsHome ? firstMatch.awayTeam.score : firstMatch.homeTeam.score;

    if (koiScore === undefined || oppScore === undefined) return { count: 0, type: null };

    if (koiScore > oppScore) {
        type = 'fire';
    } else if (koiScore < oppScore) {
        type = 'ice';
    } else {
        return { count: 0, type: null };
    }

    // Count the streak
    for (const match of finishedMatches) {
        const isKoiHome = match.homeTeam.tag.toUpperCase().includes('KOI') ||
            match.homeTeam.name.toLowerCase().includes('koi');
        const kScore = isKoiHome ? match.homeTeam.score : match.awayTeam.score;
        const oScore = isKoiHome ? match.awayTeam.score : match.homeTeam.score;

        if (kScore === undefined || oScore === undefined) break;

        if (type === 'fire') {
            if (kScore > oScore) streak++;
            else break;
        } else {
            if (kScore < oScore) streak++;
            else break;
        }
    }

    return { count: streak, type };
};

/**
 * Identifies matches that triggered a milestone (5th win/loss or trophy).
 * @param matches All matches to analyze
 * @returns Map of match ID to array of badges
 */
export const calculateMatchMilestones = (matches: Match[]): Record<string, MatchBadge[]> => {
    const milestones: Record<string, MatchBadge[]> = {};

    // We need to process matches in chronological order (oldest to newest) to track streaks
    // The input matches are usually sorted recent-first or mixed. Let's sort them.
    const sortedMatches = [...matches]
        .filter(m => m.status === 'finished')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Track streaks per game
    const streaks: Record<string, { win: number; loss: number }> = {};

    for (const match of sortedMatches) {
        const gameKey = match.game || 'unknown';
        if (!streaks[gameKey]) {
            streaks[gameKey] = { win: 0, loss: 0 };
        }

        const isKoiHome = match.homeTeam.tag.toUpperCase().includes('KOI') ||
            match.homeTeam.name.toLowerCase().includes('koi');
        const kScore = isKoiHome ? match.homeTeam.score : match.awayTeam.score;
        const oScore = isKoiHome ? match.awayTeam.score : match.homeTeam.score;

        const badges: MatchBadge[] = [];

        // Check for Trophy (Grand Final Win)
        if (kScore !== undefined && oScore !== undefined && kScore > oScore) {
            if (match.matchType && /grand final/i.test(match.matchType)) {
                badges.push('trophy');
            }
        }

        // Check for streaks
        if (kScore !== undefined && oScore !== undefined) {
            if (kScore > oScore) {
                streaks[gameKey].win++;
                streaks[gameKey].loss = 0;

                // Check if this match reached a multiple of 5
                if (streaks[gameKey].win >= 5) {
                    badges.push('fire');
                }
            } else if (kScore < oScore) {
                streaks[gameKey].loss++;
                streaks[gameKey].win = 0;

                if (streaks[gameKey].loss >= 5) {
                    badges.push('ice');
                }
            } else {
                // Draw: usually resets in esports, or we can ignore. Let's reset for safety.
                streaks[gameKey].win = 0;
                streaks[gameKey].loss = 0;
            }
        }

        if (badges.length > 0) {
            milestones[match.id] = badges;
        }
    }

    return milestones;
};
