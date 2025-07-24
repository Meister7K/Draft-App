/**
 * Data Aggregation Utilities
 * Processes and aggregates multiple seasons of draft data
 */

import { 
  extractDraftHistoryByManager, 
  enhancePicksWithPlayerData,
  filterHistoryByDateRange 
} from './historicalDataParser.js';
import { calculateManagerStatistics } from './statisticalCalculations.js';

/**
 * Aggregates draft data for all managers across multiple seasons
 * @param {Object} data - The complete database object
 * @param {Object} options - Aggregation options
 * @returns {Object} Aggregated draft analytics for all managers
 */
export function aggregateAllManagersData(data, options = {}) {
  const {
    startSeason = null,
    endSeason = null,
    includePlayerData = true
  } = options;

  // Extract raw draft history
  const rawHistory = extractDraftHistoryByManager(data);
  const aggregatedData = {};

  // Process each manager's data
  Object.keys(rawHistory).forEach(managerId => {
    let managerHistory = rawHistory[managerId];

    // Apply date range filter if specified
    if (startSeason !== null && endSeason !== null) {
      managerHistory = filterHistoryByDateRange(managerHistory, startSeason, endSeason);
    }

    // Enhance picks with player data if requested
    let picks = managerHistory.picks;
    if (includePlayerData) {
      picks = enhancePicksWithPlayerData(picks, data);
    }

    // Calculate statistics
    const statistics = calculateManagerStatistics(picks);

    aggregatedData[managerId] = {
      managerId,
      totalDrafts: managerHistory.totalDrafts,
      seasons: managerHistory.seasons,
      leagues: managerHistory.leagues,
      picks,
      statistics,
      dateRange: {
        startSeason: startSeason || (managerHistory.seasons.length > 0 ? Math.min(...managerHistory.seasons) : null),
        endSeason: endSeason || (managerHistory.seasons.length > 0 ? Math.max(...managerHistory.seasons) : null)
      }
    };
  });

  return aggregatedData;
}

/**
 * Aggregates draft data for a specific manager
 * @param {Object} data - The complete database object
 * @param {string} managerId - The manager ID to aggregate data for
 * @param {Object} options - Aggregation options
 * @returns {Object} Aggregated draft analytics for the manager
 */
export function aggregateManagerData(data, managerId, options = {}) {
  const allData = aggregateAllManagersData(data, options);
  return allData[managerId] || {
    managerId,
    totalDrafts: 0,
    seasons: [],
    leagues: [],
    picks: [],
    statistics: calculateManagerStatistics([]),
    dateRange: { startSeason: null, endSeason: null }
  };
}

/**
 * Aggregates league-wide statistics for comparison
 * @param {Object} data - The complete database object
 * @param {string} leagueId - The league ID to analyze
 * @param {Object} options - Aggregation options
 * @returns {Object} League-wide aggregated statistics
 */
export function aggregateLeagueData(data, leagueId, options = {}) {
  if (!data || !data.leagues || !data.leagues[leagueId]) {
    return {
      leagueId,
      managers: {},
      leagueAverages: {},
      totalPicks: 0,
      seasons: []
    };
  }

  const league = data.leagues[leagueId];
  const leagueManagers = new Set();
  const allPicks = [];
  const seasons = new Set();

  // Collect all picks from this league
  if (league.drafts) {
    Object.values(league.drafts).forEach(draft => {
      if (draft.picks && Array.isArray(draft.picks)) {
        draft.picks.forEach(pick => {
          leagueManagers.add(pick.picked_by);
          allPicks.push({
            ...pick,
            leagueId: league.league_id,
            season: league.season || draft.season
          });
          
          if (league.season) {
            seasons.add(league.season);
          }
        });
      }
    });
  }

  // Get individual manager data for this league
  const managerData = {};
  Array.from(leagueManagers).forEach(managerId => {
    const managerPicks = allPicks.filter(pick => pick.picked_by === managerId);
    const enhancedPicks = enhancePicksWithPlayerData(managerPicks, data);
    managerData[managerId] = {
      managerId,
      picks: enhancedPicks,
      statistics: calculateManagerStatistics(enhancedPicks)
    };
  });

  // Calculate league averages
  const leagueAverages = calculateLeagueAverages(Object.values(managerData));

  return {
    leagueId,
    leagueName: league.name,
    managers: managerData,
    leagueAverages,
    totalPicks: allPicks.length,
    seasons: Array.from(seasons).sort((a, b) => b - a),
    totalManagers: leagueManagers.size
  };
}

/**
 * Calculates league-wide averages for comparison
 * @param {Array} managersData - Array of manager data objects
 * @returns {Object} League average statistics
 */
export function calculateLeagueAverages(managersData) {
  if (!managersData || managersData.length === 0) {
    return {};
  }

  const totalManagers = managersData.length;
  const aggregatedStats = {
    totalPicks: 0,
    positionFrequencies: {},
    averageDraftPositions: {},
    roundTendencies: {
      earlyRounds: { count: 0, percentage: 0 },
      lateRounds: { count: 0, percentage: 0 }
    }
  };

  // Aggregate all statistics
  managersData.forEach(managerData => {
    const stats = managerData.statistics;
    
    aggregatedStats.totalPicks += stats.totalPicks || 0;

    // Aggregate position frequencies
    Object.keys(stats.positionFrequencies || {}).forEach(position => {
      if (!aggregatedStats.positionFrequencies[position]) {
        aggregatedStats.positionFrequencies[position] = {
          count: 0,
          percentage: 0,
          avgRound: 0
        };
      }
      
      const posStats = stats.positionFrequencies[position];
      aggregatedStats.positionFrequencies[position].count += posStats.count || 0;
      aggregatedStats.positionFrequencies[position].avgRound += posStats.avgRound || 0;
    });

    // Aggregate round tendencies
    if (stats.roundTendencies) {
      aggregatedStats.roundTendencies.earlyRounds.count += stats.roundTendencies.earlyRounds?.count || 0;
      aggregatedStats.roundTendencies.lateRounds.count += stats.roundTendencies.lateRounds?.count || 0;
    }
  });

  // Calculate averages
  Object.keys(aggregatedStats.positionFrequencies).forEach(position => {
    const posStats = aggregatedStats.positionFrequencies[position];
    posStats.percentage = aggregatedStats.totalPicks > 0 
      ? (posStats.count / aggregatedStats.totalPicks) * 100 
      : 0;
    posStats.avgRound = posStats.avgRound / totalManagers;
  });

  const totalRoundPicks = aggregatedStats.roundTendencies.earlyRounds.count + 
                         aggregatedStats.roundTendencies.lateRounds.count;
  
  if (totalRoundPicks > 0) {
    aggregatedStats.roundTendencies.earlyRounds.percentage = 
      (aggregatedStats.roundTendencies.earlyRounds.count / totalRoundPicks) * 100;
    aggregatedStats.roundTendencies.lateRounds.percentage = 
      (aggregatedStats.roundTendencies.lateRounds.count / totalRoundPicks) * 100;
  }

  return aggregatedStats;
}

/**
 * Processes multiple seasons of data with trend analysis
 * @param {Object} data - The complete database object
 * @param {string} managerId - The manager ID to analyze
 * @param {number} seasonsToAnalyze - Number of recent seasons to analyze (default: 3)
 * @returns {Object} Multi-season trend analysis
 */
export function processMultiSeasonTrends(data, managerId, seasonsToAnalyze = 3) {
  const managerData = aggregateManagerData(data, managerId);
  
  if (!managerData.seasons || managerData.seasons.length === 0) {
    return {
      managerId,
      trends: {},
      recentSeasons: [],
      overallTrend: 'insufficient_data'
    };
  }

  // Get recent seasons
  const recentSeasons = managerData.seasons
    .sort((a, b) => b - a)
    .slice(0, seasonsToAnalyze);

  const seasonTrends = {};
  
  // Analyze each recent season
  recentSeasons.forEach(season => {
    const seasonPicks = managerData.picks.filter(pick => pick.season === season);
    const seasonStats = calculateManagerStatistics(seasonPicks);
    
    seasonTrends[season] = {
      season,
      totalPicks: seasonStats.totalPicks,
      positionFrequencies: seasonStats.positionFrequencies,
      mostFrequentPosition: getMostFrequentPosition(seasonStats.positionFrequencies),
      roundTendencies: seasonStats.roundTendencies
    };
  });

  // Determine overall trend
  const overallTrend = analyzeOverallTrend(seasonTrends, recentSeasons);

  return {
    managerId,
    trends: seasonTrends,
    recentSeasons,
    overallTrend,
    seasonsAnalyzed: recentSeasons.length
  };
}

/**
 * Helper function to get the most frequently drafted position
 * @param {Object} positionFrequencies - Position frequency statistics
 * @returns {string} Most frequent position
 */
function getMostFrequentPosition(positionFrequencies) {
  if (!positionFrequencies || Object.keys(positionFrequencies).length === 0) {
    return 'unknown';
  }

  return Object.keys(positionFrequencies).reduce((mostFrequent, position) => {
    return positionFrequencies[position].percentage > 
           (positionFrequencies[mostFrequent]?.percentage || 0) 
      ? position 
      : mostFrequent;
  });
}

/**
 * Analyzes overall trend across seasons
 * @param {Object} seasonTrends - Trends by season
 * @param {Array} seasons - Array of seasons analyzed
 * @returns {string} Overall trend description
 */
function analyzeOverallTrend(seasonTrends, seasons) {
  if (seasons.length < 2) {
    return 'insufficient_data';
  }

  const mostRecentSeason = Math.max(...seasons);
  const oldestSeason = Math.min(...seasons);
  
  const recentData = seasonTrends[mostRecentSeason];
  const oldData = seasonTrends[oldestSeason];

  if (!recentData || !oldData) {
    return 'insufficient_data';
  }

  // Compare most frequent positions
  if (recentData.mostFrequentPosition !== oldData.mostFrequentPosition) {
    return 'evolving_strategy';
  }

  // Compare early vs late round tendencies
  const recentEarlyPct = recentData.roundTendencies?.earlyRounds?.percentage || 0;
  const oldEarlyPct = oldData.roundTendencies?.earlyRounds?.percentage || 0;
  
  const earlyRoundDiff = Math.abs(recentEarlyPct - oldEarlyPct);
  
  if (earlyRoundDiff > 15) {
    return recentEarlyPct > oldEarlyPct ? 'trending_earlier' : 'trending_later';
  }

  return 'consistent_strategy';
}