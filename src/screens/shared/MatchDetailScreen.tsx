import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../theme';
import { useMatchDetails } from '../../hooks/usePandaScore';
import { Match, MatchGame, DraftTeamDetails, DraftPick, DraftBan, ResultsStackParamList, CalendarStackParamList } from '../../types';
import { ErrorView, LoadingIndicator } from '../../components/StatusViews';
import { gameColors } from '../../data/mockData';
import { useTranslation } from 'react-i18next';

// We union the stack params so this screen can be used in multiple stacks
type Props = NativeStackScreenProps<
    ResultsStackParamList & CalendarStackParamList,
    'MatchDetail'
>;

export default function MatchDetailScreen({ route, navigation }: Props) {
    const { matchId } = route.params;
    const { data: match, loading, error, refresh } = useMatchDetails(matchId);
    const { t } = useTranslation();

    const [activeGameIndex, setActiveGameIndex] = useState(0);

    if (loading && !match) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('common.loading')}</Text>
                </View>
                <LoadingIndicator message={t('common.loading')} />
            </SafeAreaView>
        );
    }

    if (error || !match) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Error</Text>
                </View>
                <ErrorView message={error || 'Match not found'} onRetry={refresh} />
            </SafeAreaView>
        );
    }

    const gameColor = gameColors[match.game] || Colors.primary;

    // Decide if we should show KOI as first or second team in drafts
    // Generally, we want KOI to be on the left (home), but in drafts we map them to the corresponding side.
    // We'll rely on the team IDs.
    const koiIsHome = match.homeTeam.id === match.teamId;

    const activeGame = match.games?.[activeGameIndex];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerTitles}>
                    <Text style={styles.headerTournament} numberOfLines={1}>{match.tournament}</Text>
                    {match.matchType && <Text style={styles.headerSubtitle}>{match.matchType}</Text>}
                </View>
                <View style={{ width: 24 }} /> {/* Balance */}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Match Scoreboard */}
                <View style={styles.scoreboard}>
                    <Text style={styles.dateText}>{new Date(match.date).toLocaleDateString()} - {match.time} • Bo{match.bestOf}</Text>
                    <View style={styles.scoreRow}>
                        {/* Home Team */}
                        <View style={styles.teamInfo}>
                            {match.homeTeam.logoUrl ? (
                                <Image source={{ uri: match.homeTeam.logoUrl }} style={styles.teamLogoLg} />
                            ) : (
                                <View style={[styles.teamIconLg, { borderColor: gameColor + '60' }]}>
                                    <Text style={styles.teamTagLg}>{match.homeTeam.tag}</Text>
                                </View>
                            )}
                            <Text style={styles.teamNameText} numberOfLines={1}>{match.homeTeam.name}</Text>
                        </View>

                        {/* Score */}
                        <View style={styles.scoreCenter}>
                            {(match.status === 'live' || match.status === 'finished') ? (
                                <Text style={styles.mainScoreText}>
                                    {match.homeTeam.score ?? 0} - {match.awayTeam.score ?? 0}
                                </Text>
                            ) : (
                                <Text style={styles.vsText}>VS</Text>
                            )}
                            {match.status === 'live' && (
                                <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View>
                            )}
                            {match.status === 'finished' && (
                                <View style={styles.finishedBadge}><Text style={styles.finishedBadgeText}>FINAL</Text></View>
                            )}
                        </View>

                        {/* Away Team */}
                        <View style={styles.teamInfo}>
                            {match.awayTeam.logoUrl ? (
                                <Image source={{ uri: match.awayTeam.logoUrl }} style={styles.teamLogoLg} />
                            ) : (
                                <View style={[styles.teamIconLg, { borderColor: gameColor + '60' }]}>
                                    <Text style={styles.teamTagLg}>{match.awayTeam.tag}</Text>
                                </View>
                            )}
                            <Text style={styles.teamNameText} numberOfLines={1}>{match.awayTeam.name}</Text>
                        </View>
                    </View>
                </View>

                {/* Games Tabs */}
                {match.games && match.games.length > 0 && (
                    <View style={styles.gamesTabs}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {match.games.map((g, index) => {
                                const isActive = index === activeGameIndex;
                                let title = `Game ${g.number}`;
                                if (match.game === 'valorant' && g.map) {
                                    title = g.map.name;
                                }

                                let gameWinnerIcon = null;
                                if (g.status === 'finished' && g.winnerId) {
                                    const didHomeWin = g.winnerId === match.homeTeam.id;
                                    const didAwayWin = g.winnerId === match.awayTeam.id;

                                    // If neither matched exactly by ID, we might need a fallback, but we assume exact match
                                    if (didHomeWin) gameWinnerIcon = <Image source={{ uri: match.homeTeam.logoUrl }} style={styles.tabWinnerIcon} />;
                                    else if (didAwayWin) gameWinnerIcon = <Image source={{ uri: match.awayTeam.logoUrl }} style={styles.tabWinnerIcon} />;
                                }

                                return (
                                    <TouchableOpacity
                                        key={g.id}
                                        style={[styles.gameTab, isActive && [styles.gameTabActive, { borderColor: gameColor }]]}
                                        onPress={() => setActiveGameIndex(index)}
                                    >
                                        <Text style={[styles.gameTabTitle, isActive && { color: gameColor }]}>
                                            {title}
                                        </Text>
                                        {gameWinnerIcon}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* Active Game Details */}
                {activeGame ? (
                    <View style={styles.gameDetailsCard}>
                        {/* Map info for Valorant/CoD */}
                        {activeGame.map && (
                            <View style={styles.mapContainer}>
                                {activeGame.map.imageUrl && (
                                    <Image source={{ uri: activeGame.map.imageUrl }} style={styles.mapImage} />
                                )}
                                <View style={styles.mapOverlay}>
                                    <Text style={styles.mapNameText}>{activeGame.map.name}</Text>
                                    {activeGame.homeTeamScore !== undefined && activeGame.awayTeamScore !== undefined && (
                                        <Text style={styles.mapScoreText}>
                                            {activeGame.homeTeamScore} - {activeGame.awayTeamScore}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Draft Info (LoL/Valorant) */}
                        {activeGame.draft ? (
                            <View style={styles.draftContainer}>
                                <Text style={styles.sectionTitle}>Draft & Matchups</Text>
                                <View style={styles.draftRow}>
                                    {/* Home Draft */}
                                    <View style={styles.draftSide}>
                                        <Text style={[styles.draftTeamName, { color: activeGame.draft.homeTeamDetails?.side === 'blue' ? Colors.blueTeam : Colors.redTeam }]}>
                                            {match.homeTeam.tag} ({activeGame.draft.homeTeamDetails?.side || 'Side 1'})
                                        </Text>
                                        <View style={styles.bansContainer}>
                                            {activeGame.draft.homeTeamDetails?.bans && activeGame.draft.homeTeamDetails.bans.length > 0 ? (
                                                activeGame.draft.homeTeamDetails.bans.map((b, i) => (
                                                    <View key={`ban-${i}`} style={styles.banWrapper}>
                                                        {b.championImageUrl ? (
                                                            <Image source={{ uri: b.championImageUrl }} style={styles.banImage} />
                                                        ) : (
                                                            <View style={styles.banPlaceholder} />
                                                        )}
                                                        <View style={styles.banLine} />
                                                    </View>
                                                ))
                                            ) : (
                                                <Text style={styles.noDataText}>No bans</Text>
                                            )}
                                        </View>
                                        <View style={styles.picksContainer}>
                                            {activeGame.draft.homeTeamDetails?.picks.map((p, i) => (
                                                <View key={`pick-${i}`} style={styles.pickWrapper}>
                                                    {p.championImageUrl ? (
                                                        <Image source={{ uri: p.championImageUrl }} style={styles.pickImage} />
                                                    ) : (
                                                        <View style={styles.pickPlaceholder} />
                                                    )}
                                                    <Text style={styles.pickName} numberOfLines={1}>{p.championName}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    <View style={styles.draftVS}><Text style={styles.draftVSText}>VS</Text></View>

                                    {/* Away Draft */}
                                    <View style={styles.draftSide}>
                                        <Text style={[styles.draftTeamName, { textAlign: 'right', color: activeGame.draft.awayTeamDetails?.side === 'blue' ? Colors.blueTeam : Colors.redTeam }]}>
                                            ({activeGame.draft.awayTeamDetails?.side || 'Side 2'}) {match.awayTeam.tag}
                                        </Text>
                                        <View style={[styles.bansContainer, { justifyContent: 'flex-end' }]}>
                                            {activeGame.draft.awayTeamDetails?.bans && activeGame.draft.awayTeamDetails.bans.length > 0 ? (
                                                activeGame.draft.awayTeamDetails.bans.map((b, i) => (
                                                    <View key={`ban-${i}`} style={styles.banWrapper}>
                                                        {b.championImageUrl ? (
                                                            <Image source={{ uri: b.championImageUrl }} style={styles.banImage} />
                                                        ) : (
                                                            <View style={styles.banPlaceholder} />
                                                        )}
                                                        <View style={styles.banLine} />
                                                    </View>
                                                ))
                                            ) : (
                                                <Text style={styles.noDataText}>No bans</Text>
                                            )}
                                        </View>
                                        <View style={[styles.picksContainer, { alignItems: 'flex-end' }]}>
                                            {activeGame.draft.awayTeamDetails?.picks.map((p, i) => (
                                                <View key={`pick-${i}`} style={[styles.pickWrapper, { flexDirection: 'row-reverse' }]}>
                                                    {p.championImageUrl ? (
                                                        <Image source={{ uri: p.championImageUrl }} style={styles.pickImage} />
                                                    ) : (
                                                        <View style={styles.pickPlaceholder} />
                                                    )}
                                                    <Text style={[styles.pickName, { textAlign: 'right', marginRight: Spacing.sm, marginLeft: 0 }]} numberOfLines={1}>{p.championName}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.emptyDraft}>
                                <Ionicons name="information-circle-outline" size={24} color={Colors.textMuted} />
                                <Text style={styles.emptyDraftText}>Detalles de draft o mapa no disponibles todavía.</Text>
                            </View>
                        )}

                    </View>
                ) : (
                    <View style={styles.emptyGames}>
                        <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
                        <Text style={styles.emptyGamesText}>No hay información detallada de partidas para este encuentro.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.surface,
        justifyContent: 'space-between'
    },
    backButton: {
        padding: Spacing.xs,
    },
    headerTitles: {
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: Spacing.sm,
    },
    headerTitle: {
        fontSize: FontSize.md,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    headerTournament: {
        fontSize: FontSize.md,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    headerSubtitle: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    scrollContent: {
        paddingBottom: Spacing.xxl,
    },
    scoreboard: {
        padding: Spacing.lg,
        alignItems: 'center',
        backgroundColor: Colors.surfaceLight,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    dateText: {
        color: Colors.textMuted,
        fontSize: FontSize.sm,
        fontWeight: '600',
        marginBottom: Spacing.md,
        letterSpacing: 0.5,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    teamInfo: {
        alignItems: 'center',
        flex: 1,
    },
    teamLogoLg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.surface,
        marginBottom: Spacing.sm,
    },
    teamIconLg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.surface,
        marginBottom: Spacing.sm,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    teamTagLg: {
        color: Colors.textPrimary,
        fontWeight: '800',
        fontSize: FontSize.md,
    },
    teamNameText: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
        fontWeight: '600',
        textAlign: 'center',
    },
    scoreCenter: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
    },
    mainScoreText: {
        color: Colors.textPrimary,
        fontSize: FontSize.hero + 8,
        fontWeight: '900',
        letterSpacing: 2,
    },
    vsText: {
        color: Colors.textMuted,
        fontSize: FontSize.xl,
        fontWeight: '800',
    },
    liveBadge: {
        backgroundColor: Colors.live + '20',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: BorderRadius.round,
        marginTop: Spacing.xs,
        borderWidth: 1,
        borderColor: Colors.live,
    },
    liveBadgeText: {
        color: Colors.live,
        fontSize: FontSize.xs - 2,
        fontWeight: '800',
        letterSpacing: 1,
    },
    finishedBadge: {
        backgroundColor: Colors.surface,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: BorderRadius.round,
        marginTop: Spacing.xs,
    },
    finishedBadgeText: {
        color: Colors.textMuted,
        fontSize: FontSize.xs - 2,
        fontWeight: '700',
        letterSpacing: 1,
    },
    gamesTabs: {
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        paddingHorizontal: Spacing.md,
    },
    gameTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.surfaceLight,
        marginRight: Spacing.sm,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    gameTabActive: {
        backgroundColor: Colors.surface,
    },
    gameTabTitle: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
    tabWinnerIcon: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginLeft: 6,
    },
    gameDetailsCard: {
        margin: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    mapContainer: {
        height: 120,
        width: '100%',
        backgroundColor: Colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapImage: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.4,
    },
    mapOverlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    mapNameText: {
        color: '#fff',
        fontSize: FontSize.lg,
        fontWeight: '800',
    },
    mapScoreText: {
        color: '#fff',
        fontSize: FontSize.xl,
        fontWeight: '900',
        marginTop: 4,
    },
    draftContainer: {
        padding: Spacing.md,
    },
    sectionTitle: {
        color: Colors.textPrimary,
        fontSize: FontSize.md,
        fontWeight: '700',
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    draftRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    draftSide: {
        flex: 1,
    },
    draftTeamName: {
        fontSize: FontSize.sm,
        fontWeight: '800',
        marginBottom: Spacing.sm,
    },
    bansContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: Spacing.md,
        minHeight: 24,
    },
    banWrapper: {
        width: 24,
        height: 24,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        opacity: 0.7,
    },
    banImage: {
        width: '100%',
        height: '100%',
    },
    banPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: Colors.surfaceHover,
    },
    banLine: {
        position: 'absolute',
        width: '130%',
        height: 2,
        backgroundColor: Colors.loss,
        top: '50%',
        left: '-15%',
        transform: [{ rotate: '45deg' }],
    },
    picksContainer: {
        gap: Spacing.sm,
    },
    pickWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceLight,
        padding: 6,
        borderRadius: BorderRadius.md,
    },
    pickImage: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    pickPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: Colors.surfaceHover,
    },
    pickName: {
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
        fontWeight: '600',
        flex: 1,
        marginLeft: Spacing.sm,
    },
    draftVS: {
        width: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    draftVSText: {
        color: Colors.textMuted,
        fontSize: FontSize.xs,
        fontWeight: '700',
    },
    noDataText: {
        color: Colors.textMuted,
        fontSize: FontSize.xs,
        fontStyle: 'italic',
    },
    emptyDraft: {
        padding: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    emptyDraftText: {
        color: Colors.textMuted,
        fontSize: FontSize.sm,
        textAlign: 'center',
    },
    emptyGames: {
        paddingTop: Spacing.xxl,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        gap: Spacing.sm,
    },
    emptyGamesText: {
        color: Colors.textMuted,
        fontSize: FontSize.md,
        textAlign: 'center',
        lineHeight: 22,
    },
});
