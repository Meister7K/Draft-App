/**
 * Position calculation utilities for draft analysis
 */

/**
 * Calculate position scarcity score based on value dropoff
 * @param {Array} positionPlayers - Players at the position, sorted by value
 * @param {Number} draftedCount - Number already drafted at position
 * @returns {Number} Scarcity score (0-100, higher = more scarce)
 */
export function calculatePositionScarcity(positionPlayers, draftedCount = 0) {
  if (!positionPlayers || positionPlayers.length === 0) return 100;
  
  const availablePlayers = positionPlayers.slice(draftedCount);
  if (availablePlayers.length === 0) return 100;
  
  // Calculate value dropoff between tiers
  const tiers = createValueTiers(availablePlayers);
  if (tiers.length <= 1) return 20; // Low scarcity if only one tier
  
  const topTierAvg = calculateTierAverage(tiers[0]);
  const secondTierAvg = tiers.length > 1 ? calculateTierAverage(tiers[1]) : topTierAvg * 0.8;
  
  const dropoffPercentage = ((topTierAvg - secondTierAvg) / topTierAvg) * 100;
  
  // Scale scarcity based on dropoff and remaining players in top tier
  const topTierRemaining = tiers[0].length;
  const scarcityMultiplier = Math.max(0.5, 1 - (topTierRemaining / 12)); // Assume 12-team league
  
  return Math.min(100, Math.max(0, dropoffPercentage * scarcityMultiplier));
}

/**
 * Create value tiers for position players
 * @param {Array} players - Players sorted by projected points
 * @returns {Array} Array of tiers, each containing player arrays
 */
export function createValueTiers(players) {
  if (!players || players.length === 0) return [];
  
  const tiers = [];
  let currentTier = [];
  let lastValue = null;
  const tierSizeLimit = 12; // Maximum players per tier
  
  players.forEach((player, index) => {
    const currentValue = player.projected_2025_points;
    const valueDropoff = lastValue ? ((lastValue - currentValue) / lastValue) * 100 : 0;
    
    // Start new tier if significant dropoff (>15%) or tier size limit reached
    if ((valueDropoff > 15 || currentTier.length >= tierSizeLimit) && currentTier.length > 0) {
      tiers.push([...currentTier]);
      currentTier = [];
    }
    
    currentTier.push(player);
    lastValue = currentValue;
  });
  
  // Add final tier if it has players
  if (currentTier.length > 0) {
    tiers.push(currentTier);
  }
  
  return tiers;
}

/**
 * Calculate average projected points for a tier
 * @param {Array} tierPlayers - Players in the tier
 * @returns {Number} Average projected points
 */
export function calculateTierAverage(tierPlayers) {
  if (!tierPlayers || tierPlayers.length === 0) return 0;
  
  const totalPoints = tierPlayers.reduce((sum, player) => sum + player.projected_2025_points, 0);
  return totalPoints / tierPlayers.length;
}

/**
 * Calculate value dropoff between consecutive players
 * @param {Array} players - Players sorted by value
 * @returns {Array} Array of dropoff values
 */
export function calculateValueDropoff(players) {
  if (!players || players.length < 2) return [];
  
  const dropoffs = [];
  for (let i = 1; i < players.length; i++) {
    const current = players[i].projected_2025_points;
    const previous = players[i - 1].projected_2025_points;
    const dropoff = previous - current;
    const dropoffPercentage = (dropoff / previous) * 100;
    
    dropoffs.push({
      fromPlayer: players[i - 1].name,
      toPlayer: players[i].name,
      pointsDropoff: Math.round(dropoff * 100) / 100,
      percentageDropoff: Math.round(dropoffPercentage * 100) / 100,
      isSignificant: dropoffPercentage > 10
    });
  }
  
  return dropoffs;
}

/**
 * Calculate replacement value for a position
 * @param {Array} positionPlayers - All players at position
 * @param {Number} starterCount - Number of starters at position in league
 * @param {Number} leagueSize - Number of teams in league
 * @returns {Object} Replacement value information
 */
export function calculateReplacementValue(positionPlayers, starterCount, leagueSize = 12) {
  if (!positionPlayers || positionPlayers.length === 0) {
    return { replacementIndex: 0, replacementValue: 0, valueAboveReplacement: [] };
  }
  
  // Replacement level is typically the last starter that would be drafted
  const replacementIndex = starterCount * leagueSize;
  const replacementPlayer = positionPlayers[replacementIndex - 1];
  const replacementValue = replacementPlayer ? replacementPlayer.projected_2025_points : 0;
  
  // Calculate value above replacement for each player
  const valueAboveReplacement = positionPlayers.map((player, index) => ({
    ...player,
    valueAboveReplacement: Math.max(0, player.projected_2025_points - replacementValue),
    isAboveReplacement: index < replacementIndex
  }));
  
  return {
    replacementIndex,
    replacementValue: Math.round(replacementValue * 100) / 100,
    replacementPlayer: replacementPlayer?.name || 'Unknown',
    valueAboveReplacement
  };
}

/**
 * Calculate optimal draft window for a position
 * @param {Array} positionPlayers - Players at position
 * @param {Object} draftContext - Current draft context
 * @returns {Object} Optimal draft timing information
 */
export function calculateOptimalDraftWindow(positionPlayers, draftContext = {}) {
  const tiers = createValueTiers(positionPlayers);
  if (tiers.length === 0) return { earlyWindow: 1, lateWindow: 1, recommendation: 'any' };
  
  const topTier = tiers[0];
  const secondTier = tiers.length > 1 ? tiers[1] : [];
  
  // Estimate when top tier will be exhausted
  const topTierSize = topTier.length;
  const estimatedTopTierEnd = Math.ceil(topTierSize / (draftContext.leagueSize || 12)) + 1;
  
  // Estimate when second tier will be exhausted
  const secondTierSize = secondTier.length;
  const estimatedSecondTierEnd = estimatedTopTierEnd + Math.ceil(secondTierSize / (draftContext.leagueSize || 12));
  
  let recommendation = 'any';
  if (topTierSize <= 6) {
    recommendation = 'early'; // Grab top tier players early
  } else if (secondTierSize > topTierSize) {
    recommendation = 'middle'; // Wait for value in second tier
  } else {
    recommendation = 'late'; // Position has good depth
  }
  
  return {
    earlyWindow: Math.max(1, estimatedTopTierEnd - 1),
    lateWindow: estimatedSecondTierEnd,
    topTierSize,
    secondTierSize,
    recommendation,
    reasoning: generateDraftWindowReasoning(recommendation, topTierSize, secondTierSize)
  };
}

/**
 * Generate reasoning for draft window recommendation
 * @param {String} recommendation - Draft timing recommendation
 * @param {Number} topTierSize - Size of top tier
 * @param {Number} secondTierSize - Size of second tier
 * @returns {String} Human-readable reasoning
 */
function generateDraftWindowReasoning(recommendation, topTierSize, secondTierSize) {
  switch (recommendation) {
    case 'early':
      return `Limited elite options (${topTierSize} top tier players). Target early to secure top talent.`;
    case 'middle':
      return `Good depth in second tier (${secondTierSize} players). Can wait for value after elite tier.`;
    case 'late':
      return `Strong positional depth. Can afford to wait and fill other needs first.`;
    default:
      return 'Flexible timing based on draft flow and other positional needs.';
  }
}

/**
 * Compare positional value between two positions
 * @param {Array} position1Players - Players for first position
 * @param {Array} position2Players - Players for second position
 * @param {Number} draftPosition - Current draft position
 * @returns {Object} Comparison results
 */
export function comparePositionalValue(position1Players, position2Players, draftPosition = 1) {
  const pos1Scarcity = calculatePositionScarcity(position1Players);
  const pos2Scarcity = calculatePositionScarcity(position2Players);
  
  const pos1Available = position1Players.slice(draftPosition - 1);
  const pos2Available = position2Players.slice(draftPosition - 1);
  
  const pos1TopValue = pos1Available[0]?.projected_2025_points || 0;
  const pos2TopValue = pos2Available[0]?.projected_2025_points || 0;
  
  return {
    position1: {
      scarcity: pos1Scarcity,
      topAvailableValue: pos1TopValue,
      availableCount: pos1Available.length
    },
    position2: {
      scarcity: pos2Scarcity,
      topAvailableValue: pos2TopValue,
      availableCount: pos2Available.length
    },
    recommendation: pos1Scarcity > pos2Scarcity ? 'position1' : 'position2',
    scarcityDifference: Math.abs(pos1Scarcity - pos2Scarcity),
    valueDifference: Math.abs(pos1TopValue - pos2TopValue)
  };
}

/**
 * Get position depth analysis
 * @param {Array} positionPlayers - Players at position
 * @param {Number} leagueSize - League size
 * @returns {Object} Depth analysis
 */
export function getPositionDepth(positionPlayers, leagueSize = 12) {
  if (!positionPlayers || positionPlayers.length === 0) {
    return { depth: 'none', startableOptions: 0, flexOptions: 0, benchOptions: 0 };
  }
  
  const startableThreshold = leagueSize * 2; // Assume 2 starters per position average
  const flexThreshold = leagueSize * 4; // Include flex-worthy players
  
  const startableOptions = positionPlayers.slice(0, startableThreshold).length;
  const flexOptions = positionPlayers.slice(startableThreshold, flexThreshold).length;
  const benchOptions = Math.max(0, positionPlayers.length - flexThreshold);
  
  let depth = 'shallow';
  if (startableOptions >= leagueSize * 1.5) {
    depth = 'deep';
  } else if (startableOptions >= leagueSize) {
    depth = 'moderate';
  }
  
  return {
    depth,
    startableOptions,
    flexOptions,
    benchOptions,
    totalOptions: positionPlayers.length,
    depthScore: Math.min(100, (startableOptions / (leagueSize * 2)) * 100)
  };
}