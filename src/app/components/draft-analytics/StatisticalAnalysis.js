/**
 * Statistical Analysis Engine for Draft Analytics
 * Provides comprehensive statistical calculations for draft patterns and trends
 */

/**
 * Calculate position frequency statistics for a manager
 * @param {Array} managerPicks - Array of draft picks for a specific manager
 * @param {Array} allPlayers - Array of all players for additional context
 * @returns {Object} Position frequency data with percentages and averages
 */
export function calculatePositionFrequency(managerPicks, allPlayers = []) {
  if (!managerPicks || managerPicks.length === 0) {
    return {};
  }

  const positionCounts = {};
  const positionRounds = {};
  const positionDraftPositions = {};

  // Process each pick
  managerPicks.forEach((pick) => {
    const position = pick.metadata?.position;
    if (!position) return;

    // Count positions
    positionCounts[position] = (positionCounts[position] || 0) + 1;

    // Track rounds for average calculation
    if (!positionRounds[position]) {
      positionRounds[position] = [];
    }
    positionRounds[position].push(pick.round || 0);

    // Track draft positions for average calculation
    if (!positionDraftPositions[position]) {
      positionDraftPositions[position] = [];
    }
    positionDraftPositions[position].push(pick.pick_no || 0);
  });

  const totalPicks = managerPicks.length;
  const positionFrequency = {};

  // Calculate statistics for each position
  Object.keys(positionCounts).forEach((position) => {
    const count = positionCounts[position];
    const rounds = positionRounds[position];
    const draftPositions = positionDraftPositions[position];

    positionFrequency[position] = {
      count,
      percentage: Math.round((count / totalPicks) * 100 * 10) / 10,
      avgRound: Math.round((rounds.reduce((sum, r) => sum + r, 0) / rounds.length) * 10) / 10,
      avgDraftPosition: Math.round((draftPositions.reduce((sum, p) => sum + p, 0) / draftPositions.length) * 10) / 10,
      earliestRound: Math.min(...rounds),
      latestRound: Math.max(...rounds),
      earliestPick: Math.min(...draftPositions),
      latestPick: Math.max(...draftPositions)
    };
  });

  return positionFrequency;
}

/**
 * Analyze most frequently drafted players for a manager
 * @param {Array} managerPicks - Array of draft picks for a specific manager
 * @param {Array} allPlayers - Array of all players for additional context
 * @returns {Array} Ranked list of most frequently drafted players
 */
export function analyzeMostFrequentPlayers(managerPicks, allPlayers = []) {
  if (!managerPicks || managerPicks.length === 0) {
    return [];
  }

  const playerCounts = {};
  const playerDetails = {};

  // Count player occurrences and collect details
  managerPicks.forEach((pick) => {
    const playerId = pick.metadata?.player_id;
    const playerName = `${pick.metadata?.first_name || ''} ${pick.metadata?.last_name || ''}`.trim();
    
    if (!playerId || !playerName) return;

    // Count occurrences
    playerCounts[playerId] = (playerCounts[playerId] || 0) + 1;

    // Store player details
    if (!playerDetails[playerId]) {
      playerDetails[playerId] = {
        playerId,
        playerName,
        position: pick.metadata?.position,
        team: pick.metadata?.team,
        draftPositions: [],
        rounds: [],
        seasons: []
      };
    }

    // Add draft details
    playerDetails[playerId].draftPositions.push(pick.pick_no || 0);
    playerDetails[playerId].rounds.push(pick.round || 0);
    
    // Extract season from pick if available (you may need to adjust this based on your data structure)
    const season = pick.season || pick.year || new Date().getFullYear();
    if (!playerDetails[playerId].seasons.includes(season)) {
      playerDetails[playerId].seasons.push(season);
    }
  });

  const totalPicks = managerPicks.length;
  const frequentPlayers = [];

  // Process each player
  Object.keys(playerCounts).forEach((playerId) => {
    const count = playerCounts[playerId];
    const details = playerDetails[playerId];
    
    if (count > 1) { // Only include players drafted multiple times
      frequentPlayers.push({
        ...details,
        draftCount: count,
        percentage: Math.round((count / totalPicks) * 100 * 10) / 10,
        avgDraftPosition: Math.round((details.draftPositions.reduce((sum, p) => sum + p, 0) / details.draftPositions.length) * 10) / 10,
        avgRound: Math.round((details.rounds.reduce((sum, r) => sum + r, 0) / details.rounds.length) * 10) / 10,
        earliestPick: Math.min(...details.draftPositions),
        latestPick: Math.max(...details.draftPositions),
        positionRange: {
          earliest: Math.min(...details.draftPositions),
          latest: Math.max(...details.draftPositions)
        },
        seasonsCount: details.seasons.length
      });
    }
  });

  // Sort by draft count (descending), then by average draft position (ascending)
  return frequentPlayers.sort((a, b) => {
    if (b.draftCount !== a.draftCount) {
      return b.draftCount - a.draftCount;
    }
    return a.avgDraftPosition - b.avgDraftPosition;
  });
}

/**
 * Analyze year-over-year trends for a manager
 * @param {Array} allPicks - All draft picks across multiple seasons
 * @param {String} managerId - Manager ID to analyze
 * @returns {Object} Trend analysis data
 */
export function analyzeTrends(allPicks, managerId) {
  if (!allPicks || allPicks.length === 0 || !managerId) {
    return {
      seasons: [],
      positionTrends: {},
      evolutionPattern: 'insufficient-data',
      recentSeasons: [],
      adaptability: 0
    };
  }

  // Filter picks for this manager
  const managerPicks = allPicks.filter(pick => pick.picked_by === managerId);
  
  if (managerPicks.length === 0) {
    return {
      seasons: [],
      positionTrends: {},
      evolutionPattern: 'insufficient-data',
      recentSeasons: [],
      adaptability: 0
    };
  }

  // Group picks by season
  const picksBySeason = {};
  managerPicks.forEach(pick => {
    const season = pick.season || pick.year || new Date().getFullYear();
    if (!picksBySeason[season]) {
      picksBySeason[season] = [];
    }
    picksBySeason[season].push(pick);
  });

  const seasons = Object.keys(picksBySeason).sort((a, b) => parseInt(a) - parseInt(b));
  
  if (seasons.length < 2) {
    return {
      seasons: seasons,
      positionTrends: {},
      evolutionPattern: 'insufficient-seasons',
      recentSeasons: seasons,
      adaptability: 0
    };
  }

  // Calculate position frequency for each season
  const seasonalPositionFreq = {};
  seasons.forEach(season => {
    seasonalPositionFreq[season] = calculatePositionFrequency(picksBySeason[season]);
  });

  // Analyze position trends
  const positionTrends = {};
  const allPositions = new Set();
  
  // Collect all positions across seasons
  Object.values(seasonalPositionFreq).forEach(seasonData => {
    Object.keys(seasonData).forEach(position => allPositions.add(position));
  });

  // Calculate trends for each position
  allPositions.forEach(position => {
    const positionData = seasons.map(season => ({
      season: parseInt(season),
      percentage: seasonalPositionFreq[season][position]?.percentage || 0,
      avgRound: seasonalPositionFreq[season][position]?.avgRound || 0,
      count: seasonalPositionFreq[season][position]?.count || 0
    }));

    // Calculate trend direction
    const recentSeasons = positionData.slice(-3); // Last 3 seasons
    const earlySeasons = positionData.slice(0, Math.max(1, positionData.length - 3));
    
    const recentAvg = recentSeasons.reduce((sum, s) => sum + s.percentage, 0) / recentSeasons.length;
    const earlyAvg = earlySeasons.reduce((sum, s) => sum + s.percentage, 0) / earlySeasons.length;
    
    let trendDirection = 'stable';
    const percentageChange = recentAvg - earlyAvg;
    
    if (Math.abs(percentageChange) > 5) { // 5% threshold for significant change
      trendDirection = percentageChange > 0 ? 'increasing' : 'decreasing';
    }

    positionTrends[position] = {
      data: positionData,
      trendDirection,
      percentageChange: Math.round(percentageChange * 10) / 10,
      recentAverage: Math.round(recentAvg * 10) / 10,
      historicalAverage: Math.round(earlyAvg * 10) / 10,
      volatility: calculateVolatility(positionData.map(d => d.percentage))
    };
  });

  // Determine evolution pattern
  const evolutionPattern = determineEvolutionPattern(positionTrends, seasons);

  // Calculate adaptability score (0-100)
  const adaptability = calculateAdaptabilityScore(positionTrends, seasons.length);

  // Get recent seasons data (last 3 seasons)
  const recentSeasons = seasons.slice(-3).map(season => ({
    season: parseInt(season),
    totalPicks: picksBySeason[season].length,
    positionBreakdown: seasonalPositionFreq[season]
  }));

  return {
    seasons: seasons.map(s => parseInt(s)),
    positionTrends,
    evolutionPattern,
    recentSeasons,
    adaptability,
    totalSeasons: seasons.length,
    totalPicks: managerPicks.length
  };
}

/**
 * Calculate early vs late round drafting tendencies
 * @param {Array} managerPicks - Array of draft picks for a specific manager
 * @param {Number} earlyRoundThreshold - Round number that defines "early" rounds (default: 6)
 * @returns {Object} Early vs late round analysis
 */
export function calculateDraftingTendencies(managerPicks, earlyRoundThreshold = 6) {
  if (!managerPicks || managerPicks.length === 0) {
    return {
      earlyRounds: { count: 0, percentage: 0, positions: {} },
      lateRounds: { count: 0, percentage: 0, positions: {} },
      tendency: 'balanced',
      averageRound: 0
    };
  }

  const earlyPicks = managerPicks.filter(pick => (pick.round || 0) <= earlyRoundThreshold);
  const latePicks = managerPicks.filter(pick => (pick.round || 0) > earlyRoundThreshold);
  
  const totalPicks = managerPicks.length;
  const earlyCount = earlyPicks.length;
  const lateCount = latePicks.length;

  // Calculate position breakdown for early rounds
  const earlyPositions = {};
  earlyPicks.forEach(pick => {
    const position = pick.metadata?.position;
    if (position) {
      earlyPositions[position] = (earlyPositions[position] || 0) + 1;
    }
  });

  // Calculate position breakdown for late rounds
  const latePositions = {};
  latePicks.forEach(pick => {
    const position = pick.metadata?.position;
    if (position) {
      latePositions[position] = (latePositions[position] || 0) + 1;
    }
  });

  // Convert counts to percentages
  const earlyPositionPercentages = {};
  Object.keys(earlyPositions).forEach(position => {
    earlyPositionPercentages[position] = Math.round((earlyPositions[position] / earlyCount) * 100 * 10) / 10;
  });

  const latePositionPercentages = {};
  Object.keys(latePositions).forEach(position => {
    latePositionPercentages[position] = Math.round((latePositions[position] / lateCount) * 100 * 10) / 10;
  });

  // Determine overall tendency
  const earlyPercentage = (earlyCount / totalPicks) * 100;
  let tendency = 'balanced';
  
  if (earlyPercentage > 60) {
    tendency = 'early-heavy';
  } else if (earlyPercentage < 40) {
    tendency = 'late-heavy';
  }

  // Calculate average round
  const totalRounds = managerPicks.reduce((sum, pick) => sum + (pick.round || 0), 0);
  const averageRound = Math.round((totalRounds / totalPicks) * 10) / 10;

  return {
    earlyRounds: {
      count: earlyCount,
      percentage: Math.round(earlyPercentage * 10) / 10,
      positions: earlyPositionPercentages,
      threshold: earlyRoundThreshold
    },
    lateRounds: {
      count: lateCount,
      percentage: Math.round(((lateCount / totalPicks) * 100) * 10) / 10,
      positions: latePositionPercentages
    },
    tendency,
    averageRound,
    totalPicks
  };
}

// Helper functions

/**
 * Calculate volatility (standard deviation) of a data series
 * @param {Array} values - Array of numeric values
 * @returns {Number} Volatility score
 */
function calculateVolatility(values) {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

/**
 * Determine evolution pattern based on position trends
 * @param {Object} positionTrends - Position trend data
 * @param {Array} seasons - Array of seasons
 * @returns {String} Evolution pattern description
 */
function determineEvolutionPattern(positionTrends, seasons) {
  const positions = Object.keys(positionTrends);
  
  if (positions.length === 0) return 'no-pattern';
  
  const increasingTrends = positions.filter(pos => 
    positionTrends[pos].trendDirection === 'increasing'
  ).length;
  
  const decreasingTrends = positions.filter(pos => 
    positionTrends[pos].trendDirection === 'decreasing'
  ).length;
  
  const stableTrends = positions.filter(pos => 
    positionTrends[pos].trendDirection === 'stable'
  ).length;

  // Determine dominant pattern
  if (stableTrends > increasingTrends && stableTrends > decreasingTrends) {
    return 'consistent';
  } else if (increasingTrends > decreasingTrends) {
    return 'evolving-preferences';
  } else if (decreasingTrends > increasingTrends) {
    return 'shifting-strategy';
  } else {
    return 'adaptive';
  }
}

/**
 * Calculate adaptability score based on position trends
 * @param {Object} positionTrends - Position trend data
 * @param {Number} seasonCount - Number of seasons
 * @returns {Number} Adaptability score (0-100)
 */
function calculateAdaptabilityScore(positionTrends, seasonCount) {
  if (seasonCount < 2) return 0;
  
  const positions = Object.keys(positionTrends);
  if (positions.length === 0) return 0;
  
  // Calculate average volatility across positions
  const totalVolatility = positions.reduce((sum, pos) => 
    sum + (positionTrends[pos].volatility || 0), 0
  );
  const avgVolatility = totalVolatility / positions.length;
  
  // Calculate trend diversity (how many different trend directions)
  const trendDirections = new Set(
    positions.map(pos => positionTrends[pos].trendDirection)
  );
  const diversityScore = (trendDirections.size / 3) * 100; // 3 possible directions
  
  // Combine volatility and diversity for adaptability score
  // Higher volatility and diversity indicate more adaptability
  const volatilityScore = Math.min(avgVolatility * 5, 50); // Cap at 50
  const adaptabilityScore = Math.min(volatilityScore + (diversityScore * 0.5), 100);
  
  return Math.round(adaptabilityScore);
}

/**
 * Calculate comprehensive statistical insights for a manager
 * @param {Array} managerPicks - Array of draft picks for a specific manager
 * @param {Array} allPicks - All draft picks for trend analysis
 * @param {String} managerId - Manager ID
 * @param {Array} allPlayers - Array of all players for additional context
 * @returns {Object} Complete statistical analysis
 */
export function calculateManagerStatistics(managerPicks, allPicks, managerId, allPlayers = []) {
  return {
    positionFrequency: calculatePositionFrequency(managerPicks, allPlayers),
    frequentPlayers: analyzeMostFrequentPlayers(managerPicks, allPlayers),
    trends: analyzeTrends(allPicks, managerId),
    draftingTendencies: calculateDraftingTendencies(managerPicks),
    totalDrafts: managerPicks.length,
    seasonsAnalyzed: [...new Set(managerPicks.map(pick => 
      pick.season || pick.year || new Date().getFullYear()
    ))].length
  };
}