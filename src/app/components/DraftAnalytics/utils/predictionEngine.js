/**
 * Prediction Engine Core Logic
 * Analyzes historical patterns to predict future draft picks
 */

import {
  calculatePositionFrequencies,
  calculateAverageDraftPositions,
  calculateRoundTendencies
} from './statisticalCalculations.js';

/**
 * Analyzes draft position patterns for a manager based on historical data
 * @param {Array} historicalPicks - Manager's historical draft picks
 * @param {number} targetPosition - The draft position to analyze (1-based)
 * @param {number} totalTeams - Total number of teams in the league
 * @returns {Object} Draft position pattern analysis
 */
export function analyzeDraftPositionPatterns(historicalPicks, targetPosition, totalTeams = 12) {
  if (!historicalPicks || !Array.isArray(historicalPicks) || historicalPicks.length === 0) {
    return {
      positionPreferences: {},
      roundPreferences: {},
      pickPatterns: {},
      confidence: 0
    };
  }

  // Calculate which round this position falls into
  const targetRound = Math.ceil(targetPosition / totalTeams);
  const positionInRound = ((targetPosition - 1) % totalTeams) + 1;

  // Filter picks for similar draft positions (same round or adjacent rounds)
  const similarPositionPicks = historicalPicks.filter(pick => {
    if (!pick.round || !pick.draft_slot) return false;
    
    const roundDiff = Math.abs(pick.round - targetRound);
    const positionDiff = Math.abs(pick.draft_slot - positionInRound);
    
    // Include picks from same round or adjacent rounds with similar position
    return roundDiff <= 1 && positionDiff <= 2;
  });

  // If no similar picks, expand to same round type (early/mid/late)
  let expandedPicks = similarPositionPicks;
  if (similarPositionPicks.length < 3) {
    const roundType = targetRound <= 3 ? 'early' : targetRound <= 8 ? 'mid' : 'late';
    expandedPicks = historicalPicks.filter(pick => {
      if (!pick.round) return false;
      const pickRoundType = pick.round <= 3 ? 'early' : pick.round <= 8 ? 'mid' : 'late';
      return pickRoundType === roundType;
    });
  }

  const analysisData = expandedPicks.length > 0 ? expandedPicks : historicalPicks;

  // Calculate position preferences for this draft position
  const positionFreqs = calculatePositionFrequencies(analysisData);
  const avgPositions = calculateAverageDraftPositions(analysisData);
  const roundTendencies = calculateRoundTendencies(analysisData);

  // Calculate pick patterns
  const pickPatterns = {
    totalSimilarPicks: similarPositionPicks.length,
    totalExpandedPicks: expandedPicks.length,
    targetRound,
    positionInRound,
    roundType: targetRound <= 3 ? 'early' : targetRound <= 8 ? 'mid' : 'late'
  };

  // Calculate confidence based on data availability
  const confidence = Math.min(
    (similarPositionPicks.length * 0.4 + expandedPicks.length * 0.2) * 10,
    100
  );

  return {
    positionPreferences: positionFreqs,
    roundPreferences: roundTendencies,
    pickPatterns,
    confidence: Math.round(confidence)
  };
}

/**
 * Calculates confidence score for a prediction
 * @param {Object} historicalPattern - Historical pattern analysis
 * @param {Object} playerData - Player information
 * @param {Array} availablePlayers - Currently available players
 * @param {Object} leagueContext - League settings and context
 * @returns {number} Confidence score (0-100)
 */
export function calculateConfidenceScore(historicalPattern, playerData, availablePlayers, leagueContext = {}) {
  let confidence = 0;
  const factors = {};

  // Factor 1: Historical data strength (0-30 points)
  const dataStrength = Math.min(historicalPattern.confidence || 0, 30);
  factors.dataStrength = dataStrength;
  confidence += dataStrength;

  // Factor 2: Position preference match (0-25 points)
  const playerPosition = playerData.player_info?.position;
  if (playerPosition && historicalPattern.positionPreferences?.[playerPosition]) {
    const positionPref = historicalPattern.positionPreferences[playerPosition];
    const positionScore = Math.min(positionPref.percentage || 0, 25);
    factors.positionMatch = positionScore;
    confidence += positionScore;
  }

  // Factor 3: Player quality relative to position (0-20 points)
  const positionRank = playerData.player_info?.position_rank;
  const overallRank = playerData.player_info?.overall_rank;
  if (positionRank && overallRank) {
    // Higher quality players get higher scores
    const qualityScore = Math.max(0, 20 - (positionRank - 1) * 2);
    factors.playerQuality = Math.min(qualityScore, 20);
    confidence += factors.playerQuality;
  }

  // Factor 4: Scarcity/availability (0-15 points)
  if (availablePlayers && playerPosition) {
    const positionPlayers = availablePlayers.filter(p => 
      p.player_info?.position === playerPosition
    );
    const totalAvailable = availablePlayers.length;
    const positionAvailable = positionPlayers.length;
    
    if (totalAvailable > 0) {
      const scarcityRatio = 1 - (positionAvailable / totalAvailable);
      const scarcityScore = scarcityRatio * 15;
      factors.scarcity = Math.round(scarcityScore);
      confidence += factors.scarcity;
    }
  }

  // Factor 5: Round appropriateness (0-10 points)
  const targetRound = historicalPattern.pickPatterns?.targetRound;
  if (targetRound && overallRank) {
    // Check if player's rank is appropriate for the round
    const expectedRankRange = [(targetRound - 1) * 12 + 1, targetRound * 12];
    const isAppropriate = overallRank >= expectedRankRange[0] && overallRank <= expectedRankRange[1];
    
    if (isAppropriate) {
      factors.roundFit = 10;
      confidence += 10;
    } else {
      // Partial credit for being close
      const distance = Math.min(
        Math.abs(overallRank - expectedRankRange[0]),
        Math.abs(overallRank - expectedRankRange[1])
      );
      factors.roundFit = Math.max(0, 10 - distance);
      confidence += factors.roundFit;
    }
  }

  return {
    totalConfidence: Math.min(Math.round(confidence), 100),
    factors
  };
}

/**
 * Filters available players based on current draft context
 * @param {Array} allPlayers - All players in the database
 * @param {Array} draftedPlayers - Already drafted players
 * @param {Object} leagueSettings - League configuration
 * @returns {Array} Available players for drafting
 */
export function filterAvailablePlayers(allPlayers, draftedPlayers = [], leagueSettings = {}) {
  if (!allPlayers || !Array.isArray(allPlayers)) {
    return [];
  }

  // Create set of drafted player IDs for efficient lookup
  const draftedPlayerIds = new Set(
    draftedPlayers.map(pick => pick.metadata?.player_id || pick.player_id).filter(Boolean)
  );

  // Filter out drafted players
  let availablePlayers = allPlayers.filter(player => 
    !draftedPlayerIds.has(player.player_info?.player_id)
  );

  // Apply league-specific filters if provided
  if (leagueSettings.excludePositions && Array.isArray(leagueSettings.excludePositions)) {
    availablePlayers = availablePlayers.filter(player => 
      !leagueSettings.excludePositions.includes(player.player_info?.position)
    );
  }

  // Filter by minimum projected points if specified
  if (leagueSettings.minProjectedPoints && typeof leagueSettings.minProjectedPoints === 'number') {
    availablePlayers = availablePlayers.filter(player => 
      (player.player_info?.projected_2025_points || 0) >= leagueSettings.minProjectedPoints
    );
  }

  // Sort by overall rank for consistent ordering
  availablePlayers.sort((a, b) => {
    const rankA = a.player_info?.overall_rank || 999;
    const rankB = b.player_info?.overall_rank || 999;
    return rankA - rankB;
  });

  return availablePlayers;
}

/**
 * Generates ranked predictions for a manager at a specific draft position
 * @param {string} managerId - Manager ID to predict for
 * @param {number} draftPosition - Current draft position (1-based)
 * @param {Object} historicalData - Manager's historical draft data
 * @param {Array} availablePlayers - Currently available players
 * @param {Object} leagueContext - League settings and context
 * @returns {Array} Ranked predictions with confidence scores
 */
export function generatePredictionRanking(managerId, draftPosition, historicalData, availablePlayers, leagueContext = {}) {
  if (!historicalData || !availablePlayers || !Array.isArray(availablePlayers)) {
    return [];
  }

  const totalTeams = leagueContext.totalTeams || 12;
  
  // Analyze historical patterns for this draft position
  const patterns = analyzeDraftPositionPatterns(
    historicalData.picks || [], 
    draftPosition, 
    totalTeams
  );

  // Generate predictions for each available player
  const predictions = availablePlayers.map(player => {
    const confidenceData = calculateConfidenceScore(
      patterns, 
      player, 
      availablePlayers, 
      leagueContext
    );

    // Generate reasoning based on the factors
    const reasoning = generatePredictionReasoning(patterns, player, confidenceData);

    return {
      playerId: player.player_info?.player_id,
      playerName: player.player_info?.name,
      position: player.player_info?.position,
      team: player.player_info?.team,
      confidence: confidenceData.totalConfidence,
      factors: confidenceData.factors,
      reasoning,
      historicalBasis: {
        positionFrequency: patterns.positionPreferences?.[player.player_info?.position],
        similarPicks: patterns.pickPatterns?.totalSimilarPicks || 0,
        roundType: patterns.pickPatterns?.roundType
      },
      playerData: {
        overallRank: player.player_info?.overall_rank,
        positionRank: player.player_info?.position_rank,
        projectedPoints: player.player_info?.projected_2025_points
      }
    };
  });

  // Sort by confidence score (highest first)
  predictions.sort((a, b) => b.confidence - a.confidence);

  // Return top predictions (limit to reasonable number)
  return predictions.slice(0, Math.min(50, predictions.length));
}

/**
 * Generates human-readable reasoning for a prediction
 * @param {Object} patterns - Historical pattern analysis
 * @param {Object} player - Player data
 * @param {Object} confidenceData - Confidence calculation data
 * @returns {string} Human-readable prediction reasoning
 */
function generatePredictionReasoning(patterns, player, confidenceData) {
  const reasons = [];
  const position = player.player_info?.position;
  const factors = confidenceData.factors;

  // Historical preference reasoning
  if (factors.positionMatch > 15) {
    const positionPref = patterns.positionPreferences?.[position];
    if (positionPref) {
      reasons.push(`Frequently drafts ${position} (${positionPref.percentage.toFixed(1)}% of picks)`);
    }
  }

  // Player quality reasoning
  if (factors.playerQuality > 10) {
    const rank = player.player_info?.position_rank;
    if (rank) {
      reasons.push(`High-quality ${position} (ranked #${rank} at position)`);
    }
  }

  // Scarcity reasoning
  if (factors.scarcity > 8) {
    reasons.push(`Limited ${position} options remaining`);
  }

  // Round fit reasoning
  if (factors.roundFit > 7) {
    reasons.push(`Good value for this draft position`);
  }

  // Data strength reasoning
  if (factors.dataStrength > 20) {
    const similarPicks = patterns.pickPatterns?.totalSimilarPicks || 0;
    if (similarPicks > 0) {
      reasons.push(`Based on ${similarPicks} similar historical picks`);
    }
  }

  // Default reasoning if no strong factors
  if (reasons.length === 0) {
    reasons.push(`Prediction based on available historical data`);
  }

  return reasons.join('; ');
}

/**
 * Validates prediction engine inputs
 * @param {Object} inputs - Input parameters to validate
 * @returns {Object} Validation result with errors if any
 */
export function validatePredictionInputs(inputs) {
  const errors = [];
  
  if (!inputs.managerId || typeof inputs.managerId !== 'string') {
    errors.push('Manager ID is required and must be a string');
  }
  
  if (!inputs.draftPosition || typeof inputs.draftPosition !== 'number' || inputs.draftPosition < 1) {
    errors.push('Draft position is required and must be a positive number');
  }
  
  if (!inputs.availablePlayers || !Array.isArray(inputs.availablePlayers)) {
    errors.push('Available players must be an array');
  }
  
  if (!inputs.historicalData || typeof inputs.historicalData !== 'object') {
    errors.push('Historical data is required and must be an object');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}