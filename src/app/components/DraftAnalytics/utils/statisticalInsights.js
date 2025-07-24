/**
 * Statistical Insights and Trend Analysis Utilities
 * Provides advanced analytics including consistency scoring, trend detection,
 * league comparisons, and unique pattern identification
 */

import { calculateManagerStatistics, calculateYearOverYearTrends } from './statisticalCalculations.js';
import { aggregateLeagueData, calculateLeagueAverages } from './dataAggregation.js';

/**
 * Calculates consistency scoring for position and round preferences
 * @param {Array} picks - Array of draft picks with player data
 * @param {Object} yearOverYearTrends - Trends by season
 * @returns {Object} Consistency scores and metrics
 */
export function calculateConsistencyScoring(picks, yearOverYearTrends) {
  if (!picks || !Array.isArray(picks) || picks.length === 0) {
    return {
      positionConsistency: 0,
      roundConsistency: 0,
      playerLoyalty: 0,
      overallConsistency: 0,
      consistencyLevel: 'insufficient_data'
    };
  }

  const seasons = Object.keys(yearOverYearTrends || {});
  if (seasons.length < 2) {
    return {
      positionConsistency: 0,
      roundConsistency: 0,
      playerLoyalty: 0,
      overallConsistency: 0,
      consistencyLevel: 'insufficient_data'
    };
  }

  // Calculate position consistency
  const positionConsistency = calculatePositionConsistency(yearOverYearTrends, seasons);
  
  // Calculate round consistency
  const roundConsistency = calculateRoundConsistency(yearOverYearTrends, seasons);
  
  // Calculate player loyalty (how often they redraft same players)
  const playerLoyalty = calculatePlayerLoyalty(picks);
  
  // Calculate overall consistency score
  const overallConsistency = (positionConsistency + roundConsistency + playerLoyalty) / 3;
  
  // Determine consistency level
  const consistencyLevel = getConsistencyLevel(overallConsistency);

  return {
    positionConsistency: Math.round(positionConsistency * 100) / 100,
    roundConsistency: Math.round(roundConsistency * 100) / 100,
    playerLoyalty: Math.round(playerLoyalty * 100) / 100,
    overallConsistency: Math.round(overallConsistency * 100) / 100,
    consistencyLevel,
    details: {
      seasonsAnalyzed: seasons.length,
      positionVariance: calculatePositionVariance(yearOverYearTrends, seasons),
      roundVariance: calculateRoundVariance(yearOverYearTrends, seasons)
    }
  };
}

/**
 * Calculates position consistency across seasons
 * @param {Object} yearOverYearTrends - Trends by season
 * @param {Array} seasons - Array of seasons
 * @returns {number} Position consistency score (0-100)
 */
function calculatePositionConsistency(yearOverYearTrends, seasons) {
  const positionPreferences = {};
  
  // Collect position preferences for each season
  seasons.forEach(season => {
    const seasonData = yearOverYearTrends[season];
    if (seasonData && seasonData.positionFrequencies) {
      Object.entries(seasonData.positionFrequencies).forEach(([position, data]) => {
        if (!positionPreferences[position]) {
          positionPreferences[position] = [];
        }
        positionPreferences[position].push(data.percentage);
      });
    }
  });

  // Calculate variance for each position
  let totalVariance = 0;
  let positionCount = 0;

  Object.values(positionPreferences).forEach(percentages => {
    if (percentages.length >= 2) {
      const variance = calculateVariance(percentages);
      totalVariance += variance;
      positionCount++;
    }
  });

  if (positionCount === 0) return 0;

  // Convert variance to consistency score (lower variance = higher consistency)
  const avgVariance = totalVariance / positionCount;
  const consistencyScore = Math.max(0, 100 - (avgVariance * 2)); // Scale variance to 0-100

  return Math.min(100, consistencyScore);
}

/**
 * Calculates round consistency across seasons
 * @param {Object} yearOverYearTrends - Trends by season
 * @param {Array} seasons - Array of seasons
 * @returns {number} Round consistency score (0-100)
 */
function calculateRoundConsistency(yearOverYearTrends, seasons) {
  const earlyRoundPercentages = [];
  
  seasons.forEach(season => {
    const seasonData = yearOverYearTrends[season];
    if (seasonData && seasonData.roundTendencies && seasonData.roundTendencies.earlyRounds) {
      earlyRoundPercentages.push(seasonData.roundTendencies.earlyRounds.percentage);
    }
  });

  if (earlyRoundPercentages.length < 2) return 0;

  const variance = calculateVariance(earlyRoundPercentages);
  const consistencyScore = Math.max(0, 100 - (variance * 0.5)); // Scale variance to 0-100

  return Math.min(100, consistencyScore);
}

/**
 * Calculates player loyalty (tendency to redraft same players)
 * @param {Array} picks - Array of draft picks
 * @returns {number} Player loyalty score (0-100)
 */
function calculatePlayerLoyalty(picks) {
  const playerCounts = {};
  const seasons = new Set();

  picks.forEach(pick => {
    const playerId = pick.metadata?.player_id || pick.playerId;
    const season = pick.season;
    
    if (playerId && season) {
      seasons.add(season);
      if (!playerCounts[playerId]) {
        playerCounts[playerId] = new Set();
      }
      playerCounts[playerId].add(season);
    }
  });

  if (seasons.size < 2) return 0;

  // Calculate how many players were drafted in multiple seasons
  const multiSeasonPlayers = Object.values(playerCounts).filter(seasonSet => seasonSet.size > 1);
  const loyaltyScore = (multiSeasonPlayers.length / Object.keys(playerCounts).length) * 100;

  return Math.min(100, loyaltyScore);
}

/**
 * Detects trends for recent seasons vs historical patterns
 * @param {Object} yearOverYearTrends - Trends by season
 * @param {number} recentSeasonsCount - Number of recent seasons to analyze (default: 2)
 * @returns {Object} Trend detection results
 */
export function detectTrends(yearOverYearTrends, recentSeasonsCount = 2) {
  if (!yearOverYearTrends || typeof yearOverYearTrends !== 'object') {
    return {
      trendDetected: false,
      trendType: 'insufficient_data',
      confidence: 0,
      details: {}
    };
  }
  
  const seasons = Object.keys(yearOverYearTrends).map(Number).sort((a, b) => b - a);
  
  if (seasons.length < 3) {
    return {
      trendDetected: false,
      trendType: 'insufficient_data',
      confidence: 0,
      details: {}
    };
  }

  const recentSeasons = seasons.slice(0, recentSeasonsCount);
  const historicalSeasons = seasons.slice(recentSeasonsCount);

  // Calculate recent vs historical averages
  const recentAvg = calculateSeasonAverages(yearOverYearTrends, recentSeasons);
  const historicalAvg = calculateSeasonAverages(yearOverYearTrends, historicalSeasons);

  // Detect position preference trends
  const positionTrends = detectPositionTrends(recentAvg, historicalAvg);
  
  // Detect round strategy trends
  const roundTrends = detectRoundTrends(recentAvg, historicalAvg);
  
  // Determine overall trend
  const overallTrend = determineOverallTrend(positionTrends, roundTrends);

  return {
    trendDetected: overallTrend.detected,
    trendType: overallTrend.type,
    confidence: overallTrend.confidence,
    details: {
      positionTrends,
      roundTrends,
      recentSeasons,
      historicalSeasons,
      seasonsAnalyzed: seasons.length
    }
  };
}

/**
 * Calculates averages for a set of seasons
 * @param {Object} yearOverYearTrends - Trends by season
 * @param {Array} seasons - Array of seasons to average
 * @returns {Object} Average statistics
 */
function calculateSeasonAverages(yearOverYearTrends, seasons) {
  const positionTotals = {};
  const roundTotals = { earlyRounds: 0, lateRounds: 0 };
  let validSeasons = 0;

  seasons.forEach(season => {
    const seasonData = yearOverYearTrends[season];
    if (!seasonData) return;

    validSeasons++;

    // Aggregate position frequencies
    if (seasonData.positionFrequencies) {
      Object.entries(seasonData.positionFrequencies).forEach(([position, data]) => {
        if (!positionTotals[position]) {
          positionTotals[position] = { percentage: 0, avgRound: 0 };
        }
        positionTotals[position].percentage += data.percentage;
        positionTotals[position].avgRound += data.avgRound;
      });
    }

    // Aggregate round tendencies
    if (seasonData.roundTendencies) {
      roundTotals.earlyRounds += seasonData.roundTendencies.earlyRounds?.percentage || 0;
      roundTotals.lateRounds += seasonData.roundTendencies.lateRounds?.percentage || 0;
    }
  });

  if (validSeasons === 0) return {};

  // Calculate averages
  const positionAverages = {};
  Object.entries(positionTotals).forEach(([position, totals]) => {
    positionAverages[position] = {
      percentage: totals.percentage / validSeasons,
      avgRound: totals.avgRound / validSeasons
    };
  });

  const roundAverages = {
    earlyRounds: { percentage: roundTotals.earlyRounds / validSeasons },
    lateRounds: { percentage: roundTotals.lateRounds / validSeasons }
  };

  return {
    positionFrequencies: positionAverages,
    roundTendencies: roundAverages,
    seasonsAveraged: validSeasons
  };
}

/**
 * Builds comparison metrics against league averages
 * @param {Object} managerStats - Manager's statistics
 * @param {Object} leagueAverages - League average statistics
 * @returns {Object} Comparison metrics
 */
export function buildLeagueComparisons(managerStats, leagueAverages) {
  if (!managerStats || !leagueAverages) {
    return {
      positionComparisons: {},
      roundComparisons: {},
      overallComparison: 'insufficient_data',
      standoutMetrics: []
    };
  }

  // Compare position frequencies
  const positionComparisons = {};
  Object.entries(managerStats.positionFrequencies || {}).forEach(([position, managerData]) => {
    const leagueData = leagueAverages.positionFrequencies?.[position];
    if (leagueData) {
      const percentageDiff = managerData.percentage - leagueData.percentage;
      const roundDiff = managerData.avgRound - leagueData.avgRound;
      
      positionComparisons[position] = {
        managerPercentage: managerData.percentage,
        leaguePercentage: leagueData.percentage,
        percentageDifference: percentageDiff,
        managerAvgRound: managerData.avgRound,
        leagueAvgRound: leagueData.avgRound,
        roundDifference: roundDiff,
        comparisonLevel: getComparisonLevel(percentageDiff),
        isStandout: Math.abs(percentageDiff) > 15 // 15% threshold for standout
      };
    }
  });

  // Compare round tendencies
  const roundComparisons = {};
  if (managerStats.roundTendencies && leagueAverages.roundTendencies) {
    const managerEarly = managerStats.roundTendencies.earlyRounds?.percentage || 0;
    const leagueEarly = leagueAverages.roundTendencies.earlyRounds?.percentage || 0;
    const earlyDiff = managerEarly - leagueEarly;

    roundComparisons.earlyRounds = {
      managerPercentage: managerEarly,
      leaguePercentage: leagueEarly,
      difference: earlyDiff,
      comparisonLevel: getComparisonLevel(earlyDiff),
      isStandout: Math.abs(earlyDiff) > 20 // 20% threshold for round tendencies
    };
  }

  // Identify standout metrics
  const standoutMetrics = [];
  Object.entries(positionComparisons).forEach(([position, comparison]) => {
    if (comparison.isStandout) {
      standoutMetrics.push({
        type: 'position',
        position,
        metric: 'frequency',
        difference: comparison.percentageDifference,
        description: `${comparison.percentageDifference > 0 ? 'Drafts' : 'Avoids'} ${position} ${Math.abs(comparison.percentageDifference).toFixed(1)}% ${comparison.percentageDifference > 0 ? 'more' : 'less'} than league average`
      });
    }
  });

  if (roundComparisons.earlyRounds?.isStandout) {
    standoutMetrics.push({
      type: 'round_tendency',
      metric: 'early_rounds',
      difference: roundComparisons.earlyRounds.difference,
      description: `${roundComparisons.earlyRounds.difference > 0 ? 'More aggressive' : 'More conservative'} in early rounds (${Math.abs(roundComparisons.earlyRounds.difference).toFixed(1)}% difference)`
    });
  }

  // Determine overall comparison
  const overallComparison = determineOverallComparison(standoutMetrics);

  return {
    positionComparisons,
    roundComparisons,
    overallComparison,
    standoutMetrics
  };
}

/**
 * Identifies unique patterns for each manager
 * @param {Object} managerStats - Manager's statistics
 * @param {Object} leagueComparisons - League comparison data
 * @param {Object} consistencyScoring - Consistency scores
 * @param {Object} trendDetection - Trend detection results
 * @returns {Object} Unique pattern identification
 */
export function identifyUniquePatterns(managerStats, leagueComparisons, consistencyScoring, trendDetection) {
  const patterns = [];
  const patternTypes = {
    POSITION_SPECIALIST: 'position_specialist',
    ROUND_STRATEGIST: 'round_strategist',
    PLAYER_LOYALIST: 'player_loyalist',
    TREND_FOLLOWER: 'trend_follower',
    CONTRARIAN: 'contrarian',
    CONSISTENT_DRAFTER: 'consistent_drafter',
    EVOLVING_STRATEGY: 'evolving_strategy'
  };

  // Check for position specialist pattern
  const dominantPosition = getDominantPosition(managerStats.positionFrequencies);
  if (dominantPosition && dominantPosition.percentage > 40) {
    patterns.push({
      type: patternTypes.POSITION_SPECIALIST,
      confidence: Math.min(100, dominantPosition.percentage * 2),
      description: `Heavy ${dominantPosition.position} drafter (${dominantPosition.percentage.toFixed(1)}% of picks)`,
      details: { position: dominantPosition.position, percentage: dominantPosition.percentage }
    });
  }

  // Check for round strategist pattern
  if (managerStats.roundTendencies) {
    const earlyPct = managerStats.roundTendencies.earlyRounds?.percentage || 0;
    if (earlyPct > 70) {
      patterns.push({
        type: patternTypes.ROUND_STRATEGIST,
        confidence: Math.min(100, earlyPct * 1.2),
        description: `Early round focused (${earlyPct.toFixed(1)}% of picks in early rounds)`,
        details: { strategy: 'early_focused', percentage: earlyPct }
      });
    } else if (earlyPct < 30) {
      patterns.push({
        type: patternTypes.ROUND_STRATEGIST,
        confidence: Math.min(100, (100 - earlyPct) * 1.2),
        description: `Late round focused (${(100 - earlyPct).toFixed(1)}% of picks in late rounds)`,
        details: { strategy: 'late_focused', percentage: 100 - earlyPct }
      });
    }
  }

  // Check for player loyalist pattern
  if (consistencyScoring.playerLoyalty > 60) {
    patterns.push({
      type: patternTypes.PLAYER_LOYALIST,
      confidence: consistencyScoring.playerLoyalty,
      description: `High player loyalty (${consistencyScoring.playerLoyalty.toFixed(1)}% consistency in player selection)`,
      details: { loyaltyScore: consistencyScoring.playerLoyalty }
    });
  }

  // Check for consistent drafter pattern
  if (consistencyScoring.overallConsistency > 75) {
    patterns.push({
      type: patternTypes.CONSISTENT_DRAFTER,
      confidence: consistencyScoring.overallConsistency,
      description: `Highly consistent draft strategy (${consistencyScoring.overallConsistency.toFixed(1)}% consistency)`,
      details: { consistencyScore: consistencyScoring.overallConsistency }
    });
  }

  // Check for evolving strategy pattern
  if (trendDetection.trendDetected && trendDetection.confidence > 70) {
    patterns.push({
      type: patternTypes.EVOLVING_STRATEGY,
      confidence: trendDetection.confidence,
      description: `Evolving draft strategy (${trendDetection.trendType})`,
      details: { trendType: trendDetection.trendType, confidence: trendDetection.confidence }
    });
  }

  // Check for contrarian pattern
  const contrarian = checkContrarianPattern(leagueComparisons);
  if (contrarian.isContrarian) {
    patterns.push({
      type: patternTypes.CONTRARIAN,
      confidence: contrarian.confidence,
      description: contrarian.description,
      details: contrarian.details
    });
  }

  // Sort patterns by confidence
  patterns.sort((a, b) => b.confidence - a.confidence);

  return {
    patterns,
    primaryPattern: patterns[0] || null,
    patternCount: patterns.length,
    uniquenessScore: calculateUniquenessScore(patterns, leagueComparisons)
  };
}

/**
 * Creates visual indicators for significant trends and changes
 * @param {Object} trendDetection - Trend detection results
 * @param {Object} leagueComparisons - League comparison data
 * @param {Object} uniquePatterns - Unique pattern identification
 * @returns {Object} Visual indicators configuration
 */
export function createVisualIndicators(trendDetection, leagueComparisons, uniquePatterns) {
  const indicators = [];

  // Trend indicators
  if (trendDetection.trendDetected && trendDetection.confidence > 60) {
    indicators.push({
      type: 'trend',
      severity: getTrendSeverity(trendDetection.confidence),
      icon: getTrendIcon(trendDetection.trendType),
      color: getTrendColor(trendDetection.trendType),
      message: `${trendDetection.trendType.replace('_', ' ').toUpperCase()} trend detected`,
      confidence: trendDetection.confidence,
      details: trendDetection.details
    });
  }

  // League comparison indicators
  leagueComparisons.standoutMetrics?.forEach(metric => {
    if (Math.abs(metric.difference) > 20) {
      indicators.push({
        type: 'comparison',
        severity: getComparisonSeverity(Math.abs(metric.difference)),
        icon: getComparisonIcon(metric.type),
        color: getComparisonColor(metric.difference),
        message: metric.description,
        difference: metric.difference,
        metric: metric.metric
      });
    }
  });

  // Pattern indicators
  if (uniquePatterns.primaryPattern && uniquePatterns.primaryPattern.confidence > 70) {
    indicators.push({
      type: 'pattern',
      severity: getPatternSeverity(uniquePatterns.primaryPattern.confidence),
      icon: getPatternIcon(uniquePatterns.primaryPattern.type),
      color: getPatternColor(uniquePatterns.primaryPattern.type),
      message: uniquePatterns.primaryPattern.description,
      confidence: uniquePatterns.primaryPattern.confidence,
      patternType: uniquePatterns.primaryPattern.type
    });
  }

  return {
    indicators,
    hasSignificantIndicators: indicators.some(i => i.severity === 'high'),
    totalIndicators: indicators.length,
    indicatorSummary: generateIndicatorSummary(indicators)
  };
}

// Helper functions

function calculateVariance(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
}

function getConsistencyLevel(score) {
  if (score >= 80) return 'very_consistent';
  if (score >= 60) return 'consistent';
  if (score >= 40) return 'somewhat_consistent';
  if (score >= 20) return 'inconsistent';
  return 'very_inconsistent';
}

function calculatePositionVariance(yearOverYearTrends, seasons) {
  const positionVariances = {};
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  
  positions.forEach(position => {
    const percentages = [];
    seasons.forEach(season => {
      const seasonData = yearOverYearTrends[season];
      if (seasonData && seasonData.positionFrequencies && seasonData.positionFrequencies[position]) {
        percentages.push(seasonData.positionFrequencies[position].percentage);
      }
    });
    
    if (percentages.length >= 2) {
      positionVariances[position] = calculateVariance(percentages);
    }
  });
  
  // Return average variance across all positions
  const variances = Object.values(positionVariances);
  return variances.length > 0 ? variances.reduce((sum, v) => sum + v, 0) / variances.length : 0;
}

function calculateRoundVariance(yearOverYearTrends, seasons) {
  const earlyRoundPercentages = [];
  
  seasons.forEach(season => {
    const seasonData = yearOverYearTrends[season];
    if (seasonData && seasonData.roundTendencies && seasonData.roundTendencies.earlyRounds) {
      earlyRoundPercentages.push(seasonData.roundTendencies.earlyRounds.percentage);
    }
  });
  
  return earlyRoundPercentages.length >= 2 ? calculateVariance(earlyRoundPercentages) : 0;
}

function detectPositionTrends(recentAvg, historicalAvg) {
  const trends = {};
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  
  positions.forEach(position => {
    const recentPct = recentAvg.positionFrequencies?.[position]?.percentage || 0;
    const historicalPct = historicalAvg.positionFrequencies?.[position]?.percentage || 0;
    const difference = recentPct - historicalPct;
    
    if (Math.abs(difference) > 10) { // 10% threshold for significant change
      trends[position] = {
        direction: difference > 0 ? 'increasing' : 'decreasing',
        magnitude: Math.abs(difference),
        confidence: Math.min(100, Math.abs(difference) * 5), // Scale to confidence
        recentPercentage: recentPct,
        historicalPercentage: historicalPct
      };
    }
  });
  
  return trends;
}

function detectRoundTrends(recentAvg, historicalAvg) {
  const trends = {};
  
  const recentEarly = recentAvg.roundTendencies?.earlyRounds?.percentage || 0;
  const historicalEarly = historicalAvg.roundTendencies?.earlyRounds?.percentage || 0;
  const earlyDifference = recentEarly - historicalEarly;
  
  if (Math.abs(earlyDifference) > 15) { // 15% threshold for round trends
    trends.earlyRounds = {
      direction: earlyDifference > 0 ? 'more_aggressive' : 'more_conservative',
      magnitude: Math.abs(earlyDifference),
      confidence: Math.min(100, Math.abs(earlyDifference) * 3),
      recentPercentage: recentEarly,
      historicalPercentage: historicalEarly
    };
  }
  
  return trends;
}

function determineOverallTrend(positionTrends, roundTrends) {
  const positionTrendCount = Object.keys(positionTrends).length;
  const roundTrendCount = Object.keys(roundTrends).length;
  
  if (positionTrendCount === 0 && roundTrendCount === 0) {
    return { detected: false, type: 'stable', confidence: 0 };
  }
  
  // Calculate overall confidence based on number and strength of trends
  let totalConfidence = 0;
  let trendCount = 0;
  
  Object.values(positionTrends).forEach(trend => {
    totalConfidence += trend.confidence;
    trendCount++;
  });
  
  Object.values(roundTrends).forEach(trend => {
    totalConfidence += trend.confidence;
    trendCount++;
  });
  
  const avgConfidence = trendCount > 0 ? totalConfidence / trendCount : 0;
  
  // Determine trend type based on dominant changes
  let trendType = 'evolving_strategy';
  
  if (roundTrends.earlyRounds) {
    trendType = roundTrends.earlyRounds.direction === 'more_aggressive' 
      ? 'trending_earlier' 
      : 'trending_later';
  } else if (positionTrendCount >= 2) {
    trendType = 'position_shift';
  }
  
  return {
    detected: avgConfidence > 50,
    type: trendType,
    confidence: Math.round(avgConfidence)
  };
}

function getComparisonLevel(difference) {
  const absDiff = Math.abs(difference);
  if (absDiff >= 25) return 'very_different';
  if (absDiff >= 15) return 'different';
  if (absDiff >= 10) return 'somewhat_different';
  if (absDiff >= 5) return 'slightly_different';
  return 'similar';
}

function determineOverallComparison(standoutMetrics) {
  if (standoutMetrics.length === 0) return 'league_average';
  if (standoutMetrics.length >= 3) return 'very_unique';
  if (standoutMetrics.length >= 2) return 'unique';
  return 'somewhat_unique';
}

function getDominantPosition(positionFrequencies) {
  if (!positionFrequencies) return null;
  
  let maxPosition = null;
  let maxPercentage = 0;
  
  Object.entries(positionFrequencies).forEach(([position, data]) => {
    if (data.percentage > maxPercentage) {
      maxPercentage = data.percentage;
      maxPosition = position;
    }
  });
  
  return maxPosition ? { position: maxPosition, percentage: maxPercentage } : null;
}

function checkContrarianPattern(leagueComparisons) {
  const contraryMetrics = leagueComparisons.standoutMetrics?.filter(
    metric => Math.abs(metric.difference) > 25
  ) || [];
  
  if (contraryMetrics.length >= 2) {
    return {
      isContrarian: true,
      confidence: Math.min(100, contraryMetrics.length * 30),
      description: `Contrarian drafter with ${contraryMetrics.length} major deviations from league norms`,
      details: { contraryMetrics: contraryMetrics.length }
    };
  }
  
  return { isContrarian: false, confidence: 0 };
}

function calculateUniquenessScore(patterns, leagueComparisons) {
  const patternScore = patterns.reduce((sum, pattern) => sum + pattern.confidence, 0) / patterns.length || 0;
  const comparisonScore = leagueComparisons.standoutMetrics?.length * 20 || 0;
  return Math.min(100, (patternScore + comparisonScore) / 2);
}

// Visual indicator helper functions
function getTrendSeverity(confidence) {
  if (confidence >= 80) return 'high';
  if (confidence >= 60) return 'medium';
  return 'low';
}

function getTrendIcon(trendType) {
  const icons = {
    'evolving_strategy': '🔄',
    'trending_earlier': '⬆️',
    'trending_later': '⬇️',
    'position_shift': '↔️'
  };
  return icons[trendType] || '📈';
}

function getTrendColor(trendType) {
  const colors = {
    'evolving_strategy': '#ff9500',
    'trending_earlier': '#007aff',
    'trending_later': '#5856d6',
    'position_shift': '#ff3b30'
  };
  return colors[trendType] || '#007aff';
}

function getComparisonSeverity(difference) {
  if (difference >= 30) return 'high';
  if (difference >= 20) return 'medium';
  return 'low';
}

function getComparisonIcon(type) {
  const icons = {
    'position': '🎯',
    'round_tendency': '📊'
  };
  return icons[type] || '📈';
}

function getComparisonColor(difference) {
  return difference > 0 ? '#34c759' : '#ff3b30';
}

function getPatternSeverity(confidence) {
  if (confidence >= 85) return 'high';
  if (confidence >= 70) return 'medium';
  return 'low';
}

function getPatternIcon(patternType) {
  const icons = {
    'position_specialist': '🎯',
    'round_strategist': '📊',
    'player_loyalist': '❤️',
    'consistent_drafter': '🎯',
    'evolving_strategy': '🔄',
    'contrarian': '🔄'
  };
  return icons[patternType] || '📈';
}

function getPatternColor(patternType) {
  const colors = {
    'position_specialist': '#007aff',
    'round_strategist': '#5856d6',
    'player_loyalist': '#ff3b30',
    'consistent_drafter': '#34c759',
    'evolving_strategy': '#ff9500',
    'contrarian': '#ff2d92'
  };
  return colors[patternType] || '#007aff';
}

function generateIndicatorSummary(indicators) {
  const summary = {
    trends: indicators.filter(i => i.type === 'trend').length,
    comparisons: indicators.filter(i => i.type === 'comparison').length,
    patterns: indicators.filter(i => i.type === 'pattern').length,
    highSeverity: indicators.filter(i => i.severity === 'high').length
  };
  
  return summary;
}