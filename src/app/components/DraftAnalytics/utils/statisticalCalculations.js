/**
 * Statistical Calculation Utilities
 * Calculates position frequencies, averages, and other statistical metrics
 */

/**
 * Calculates position frequency statistics for a manager
 * @param {Array} picks - Array of draft picks with player data
 * @returns {Object} Position frequency statistics
 */
export function calculatePositionFrequencies(picks) {
  if (!picks || !Array.isArray(picks)) {
    return {};
  }

  const positionCounts = {};
  const positionRounds = {};
  const totalPicks = picks.length;

  // Count picks by position and track rounds
  picks.forEach(pick => {
    const position = pick.position || pick.metadata?.position;
    if (!position) return;

    if (!positionCounts[position]) {
      positionCounts[position] = 0;
      positionRounds[position] = [];
    }

    positionCounts[position]++;
    if (pick.round && typeof pick.round === 'number') {
      positionRounds[position].push(pick.round);
    }
  });

  // Calculate statistics for each position
  const positionStats = {};
  Object.keys(positionCounts).forEach(position => {
    const count = positionCounts[position];
    const rounds = positionRounds[position];
    
    positionStats[position] = {
      count,
      percentage: totalPicks > 0 ? (count / totalPicks) * 100 : 0,
      avgRound: rounds.length > 0 ? rounds.reduce((sum, round) => sum + round, 0) / rounds.length : 0,
      earliestRound: rounds.length > 0 ? Math.min(...rounds) : null,
      latestRound: rounds.length > 0 ? Math.max(...rounds) : null,
      rounds: [...rounds].sort((a, b) => a - b)
    };
  });

  return positionStats;
}

/**
 * Calculates average draft position by position
 * @param {Array} picks - Array of draft picks with player data
 * @returns {Object} Average draft positions by position
 */
export function calculateAverageDraftPositions(picks) {
  if (!picks || !Array.isArray(picks)) {
    return {};
  }

  const positionPicks = {};

  // Group picks by position
  picks.forEach(pick => {
    const position = pick.position || pick.metadata?.position;
    const pickNo = pick.pick_no;
    
    if (!position || typeof pickNo !== 'number') return;

    if (!positionPicks[position]) {
      positionPicks[position] = [];
    }

    positionPicks[position].push(pickNo);
  });

  // Calculate averages
  const averages = {};
  Object.keys(positionPicks).forEach(position => {
    const picks = positionPicks[position];
    averages[position] = {
      avgPickNumber: picks.reduce((sum, pick) => sum + pick, 0) / picks.length,
      earliestPick: Math.min(...picks),
      latestPick: Math.max(...picks),
      totalPicks: picks.length,
      pickNumbers: [...picks].sort((a, b) => a - b)
    };
  });

  return averages;
}

/**
 * Identifies most frequently drafted players by a manager
 * @param {Array} picks - Array of draft picks with player data
 * @returns {Array} Array of frequently drafted players with statistics
 */
export function calculateMostFrequentPlayers(picks) {
  if (!picks || !Array.isArray(picks)) {
    return [];
  }

  const playerCounts = {};
  const playerDetails = {};

  // Count picks by player
  picks.forEach(pick => {
    const playerId = pick.metadata?.player_id;
    const playerName = pick.playerName;
    
    if (!playerId || !playerName) return;

    if (!playerCounts[playerId]) {
      playerCounts[playerId] = 0;
      playerDetails[playerId] = {
        name: playerName,
        position: pick.position || pick.metadata?.position,
        team: pick.team || pick.metadata?.team,
        pickNumbers: [],
        rounds: [],
        seasons: []
      };
    }

    playerCounts[playerId]++;
    
    if (pick.pick_no) {
      playerDetails[playerId].pickNumbers.push(pick.pick_no);
    }
    if (pick.round) {
      playerDetails[playerId].rounds.push(pick.round);
    }
    if (pick.season) {
      playerDetails[playerId].seasons.push(pick.season);
    }
  });

  // Convert to array and calculate statistics
  const frequentPlayers = Object.keys(playerCounts)
    .filter(playerId => playerCounts[playerId] > 1) // Only players drafted multiple times
    .map(playerId => {
      const count = playerCounts[playerId];
      const details = playerDetails[playerId];
      const pickNumbers = details.pickNumbers;
      const rounds = details.rounds;

      return {
        playerId,
        playerName: details.name,
        position: details.position,
        team: details.team,
        draftCount: count,
        percentage: (count / picks.length) * 100,
        avgDraftPosition: pickNumbers.length > 0 
          ? pickNumbers.reduce((sum, pick) => sum + pick, 0) / pickNumbers.length 
          : 0,
        avgRound: rounds.length > 0 
          ? rounds.reduce((sum, round) => sum + round, 0) / rounds.length 
          : 0,
        earliestPick: pickNumbers.length > 0 ? Math.min(...pickNumbers) : null,
        latestPick: pickNumbers.length > 0 ? Math.max(...pickNumbers) : null,
        seasons: [...new Set(details.seasons)].sort((a, b) => b - a),
        pickHistory: pickNumbers.sort((a, b) => a - b)
      };
    })
    .sort((a, b) => b.draftCount - a.draftCount); // Sort by frequency

  return frequentPlayers;
}

/**
 * Calculates early vs late round drafting tendencies
 * @param {Array} picks - Array of draft picks with player data
 * @param {number} earlyRoundThreshold - Round number that defines "early" (default: 6)
 * @returns {Object} Early vs late round statistics
 */
export function calculateRoundTendencies(picks, earlyRoundThreshold = 6) {
  if (!picks || !Array.isArray(picks)) {
    return {
      earlyRounds: { count: 0, percentage: 0, positions: {} },
      lateRounds: { count: 0, percentage: 0, positions: {} }
    };
  }

  const earlyPicks = picks.filter(pick => pick.round && pick.round <= earlyRoundThreshold);
  const latePicks = picks.filter(pick => pick.round && pick.round > earlyRoundThreshold);
  const totalPicks = picks.filter(pick => pick.round).length;

  // Calculate position breakdown for early rounds
  const earlyPositions = {};
  earlyPicks.forEach(pick => {
    const position = pick.position || pick.metadata?.position;
    if (position) {
      earlyPositions[position] = (earlyPositions[position] || 0) + 1;
    }
  });

  // Calculate position breakdown for late rounds
  const latePositions = {};
  latePicks.forEach(pick => {
    const position = pick.position || pick.metadata?.position;
    if (position) {
      latePositions[position] = (latePositions[position] || 0) + 1;
    }
  });

  return {
    earlyRounds: {
      count: earlyPicks.length,
      percentage: totalPicks > 0 ? (earlyPicks.length / totalPicks) * 100 : 0,
      positions: earlyPositions,
      threshold: earlyRoundThreshold
    },
    lateRounds: {
      count: latePicks.length,
      percentage: totalPicks > 0 ? (latePicks.length / totalPicks) * 100 : 0,
      positions: latePositions,
      threshold: earlyRoundThreshold
    },
    totalAnalyzed: totalPicks
  };
}

/**
 * Calculates year-over-year trend analysis
 * @param {Array} picks - Array of draft picks with player data
 * @returns {Object} Trend analysis by season
 */
export function calculateYearOverYearTrends(picks) {
  if (!picks || !Array.isArray(picks)) {
    return {};
  }

  const seasonData = {};

  // Group picks by season
  picks.forEach(pick => {
    const season = pick.season;
    if (!season) return;

    if (!seasonData[season]) {
      seasonData[season] = [];
    }

    seasonData[season].push(pick);
  });

  // Calculate statistics for each season
  const trends = {};
  Object.keys(seasonData).forEach(season => {
    const seasonPicks = seasonData[season];
    trends[season] = {
      totalPicks: seasonPicks.length,
      positionFrequencies: calculatePositionFrequencies(seasonPicks),
      averageDraftPositions: calculateAverageDraftPositions(seasonPicks),
      roundTendencies: calculateRoundTendencies(seasonPicks)
    };
  });

  return trends;
}

/**
 * Calculates overall statistical summary for a manager
 * @param {Array} picks - Array of draft picks with player data
 * @returns {Object} Complete statistical summary
 */
export function calculateManagerStatistics(picks) {
  if (!picks || !Array.isArray(picks)) {
    return {
      totalPicks: 0,
      positionFrequencies: {},
      averageDraftPositions: {},
      mostFrequentPlayers: [],
      roundTendencies: {},
      yearOverYearTrends: {},
      favoritePosition: null,
      averagePickPosition: null
    };
  }

  const positionFrequencies = calculatePositionFrequencies(picks);
  const averageDraftPositions = calculateAverageDraftPositions(picks);
  
  // Calculate favorite position (most frequently drafted)
  let favoritePosition = null;
  let maxCount = 0;
  Object.entries(positionFrequencies).forEach(([position, data]) => {
    if (data.count > maxCount) {
      maxCount = data.count;
      favoritePosition = position;
    }
  });

  // Calculate average pick position
  const totalPickPosition = picks.reduce((sum, pick) => {
    return sum + (pick.pick_no || 0);
  }, 0);
  const averagePickPosition = picks.length > 0 ? totalPickPosition / picks.length : null;

  return {
    totalPicks: picks.length,
    positionFrequencies,
    averageDraftPositions,
    mostFrequentPlayers: calculateMostFrequentPlayers(picks),
    roundTendencies: calculateRoundTendencies(picks),
    yearOverYearTrends: calculateYearOverYearTrends(picks),
    favoritePosition,
    averagePickPosition
  };
}