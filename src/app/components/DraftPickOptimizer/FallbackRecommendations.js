/**
 * FallbackRecommendations - Provides basic recommendations when optimization calculations fail
 * Uses simple heuristics and existing player data to generate fallback suggestions
 * Ensures users always get some form of draft guidance even when complex algorithms fail
 */

/**
 * Generate fallback recommendations using simple heuristics
 * @param {Array} availablePlayers - Available players to recommend
 * @param {Object} context - Basic context for recommendations
 * @returns {Array} Fallback recommendations
 */
export function generateFallbackRecommendations(availablePlayers, context = {}) {
  try {
    if (!availablePlayers || availablePlayers.length === 0) {
      return [];
    }

    const {
      currentRoster = {},
      rosterFormat = [],
      calculateCompositeValue,
      memberPicks = []
    } = context;

    // Simple position need analysis
    const positionNeeds = calculateSimplePositionNeeds(currentRoster, rosterFormat, memberPicks);
    
    // Filter and score players using basic heuristics
    const scoredPlayers = availablePlayers
      .filter(player => player?.player_info?.player_id)
      .map(player => {
        const position = player.player_info?.position;
        const projectedPoints = player.player_info?.projected_2025_points || 0;
        const overallRank = player.player_info?.overall_rank || 999;
        
        // Basic scoring factors
        let score = 0;
        
        // Value score (40% weight) - based on projected points and rank
        const valueScore = Math.max(0, 100 - (overallRank / 10));
        score += valueScore * 0.4;
        
        // Position need score (35% weight)
        const needScore = positionNeeds[position]?.score || 0;
        score += needScore * 0.35;
        
        // Projected points bonus (25% weight)
        const pointsScore = Math.min(100, (projectedPoints / 300) * 100);
        score += pointsScore * 0.25;

        return {
          player,
          score,
          factors: {
            valueScore: Math.round(valueScore),
            needScore: Math.round(needScore),
            pointsScore: Math.round(pointsScore),
            projectedPoints
          }
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 recommendations

    // Convert to recommendation format
    return scoredPlayers.map((item, index) => ({
      playerId: item.player.player_info.player_id,
      player: {
        name: item.player.player_info.name || 'Unknown Player',
        position: item.player.player_info.position || 'UNKNOWN',
        team: item.player.player_info.team || 'FA',
        projectedPoints: item.factors.projectedPoints,
        overallRank: item.player.player_info.overall_rank || 999,
        positionRank: item.player.player_info.position_rank || 99
      },
      optimization: {
        score: Math.round(item.score),
        rank: index + 1,
        factors: {
          rosterNeed: {
            score: item.factors.needScore,
            explanation: generateNeedExplanation(item.player.player_info.position, positionNeeds)
          },
          playerValue: {
            score: item.factors.valueScore,
            explanation: `Ranked #${item.player.player_info.overall_rank || 999} overall with ${item.factors.projectedPoints.toFixed(1)} projected points`
          },
          competition: {
            score: 50, // Default neutral score
            explanation: "Competition analysis unavailable - using fallback recommendations"
          },
          availability: {
            score: 50, // Default neutral score
            explanation: "Availability projection unavailable - consider current player value"
          },
          startingLineupImpact: {
            score: item.factors.pointsScore,
            explanation: `Projected to score ${item.factors.projectedPoints.toFixed(1)} fantasy points`
          }
        }
      },
      recommendation: {
        action: index < 2 ? "CONSIDER" : "EVALUATE",
        reasoning: generateFallbackReasoning(item.player, item.factors, positionNeeds),
        riskAssessment: "Risk assessment unavailable - using simplified recommendations",
        alternatives: []
      }
    }));

  } catch (error) {
    console.error('Error generating fallback recommendations:', error);
    return [];
  }
}

/**
 * Calculate simple position needs based on roster format and current picks
 */
function calculateSimplePositionNeeds(currentRoster, rosterFormat, memberPicks) {
  const positionNeeds = {};
  
  try {
    // Initialize position requirements
    rosterFormat.forEach(({ position, slots }) => {
      positionNeeds[position] = {
        required: slots,
        filled: 0,
        score: 0
      };
    });

    // Count filled positions
    memberPicks.forEach(pick => {
      const position = pick.metadata?.position;
      if (position && positionNeeds[position]) {
        positionNeeds[position].filled++;
      }
    });

    // Calculate need scores (0-100)
    Object.keys(positionNeeds).forEach(position => {
      const need = positionNeeds[position];
      const remaining = Math.max(0, need.required - need.filled);
      const needPercentage = remaining / need.required;
      
      // Higher score for positions with more remaining needs
      need.score = Math.round(needPercentage * 100);
      
      // Boost score for completely empty positions
      if (need.filled === 0 && need.required > 0) {
        need.score = Math.min(100, need.score + 25);
      }
    });

  } catch (error) {
    console.error('Error calculating position needs:', error);
  }

  return positionNeeds;
}

/**
 * Generate explanation for position need
 */
function generateNeedExplanation(position, positionNeeds) {
  const need = positionNeeds[position];
  if (!need) {
    return `${position} need assessment unavailable`;
  }

  const remaining = Math.max(0, need.required - need.filled);
  
  if (remaining === 0) {
    return `${position} roster slots filled (${need.filled}/${need.required})`;
  } else if (remaining === need.required) {
    return `High need: No ${position} players drafted yet (0/${need.required})`;
  } else {
    return `Moderate need: ${remaining} more ${position} needed (${need.filled}/${need.required})`;
  }
}

/**
 * Generate fallback reasoning for recommendations
 */
function generateFallbackReasoning(player, factors, positionNeeds) {
  const position = player.player_info?.position;
  const need = positionNeeds[position];
  const projectedPoints = factors.projectedPoints;
  
  let reasoning = `${player.player_info?.name} is a solid option`;
  
  if (need && need.score > 70) {
    reasoning += ` who fills a high-priority ${position} need`;
  } else if (need && need.score > 40) {
    reasoning += ` who addresses your ${position} depth`;
  }
  
  if (projectedPoints > 200) {
    reasoning += ` with strong projected production (${projectedPoints.toFixed(1)} points)`;
  } else if (projectedPoints > 100) {
    reasoning += ` with decent projected production (${projectedPoints.toFixed(1)} points)`;
  }
  
  reasoning += ". Note: This is a simplified recommendation due to optimizer limitations.";
  
  return reasoning;
}

/**
 * Create a minimal recommendation when no players are available
 */
export function createEmptyRecommendation() {
  return {
    playerId: 'fallback-empty',
    player: {
      name: 'No Players Available',
      position: 'N/A',
      team: 'N/A',
      projectedPoints: 0,
      overallRank: 999,
      positionRank: 99
    },
    optimization: {
      score: 0,
      rank: 1,
      factors: {
        rosterNeed: { score: 0, explanation: "No players available for analysis" },
        playerValue: { score: 0, explanation: "No players available for analysis" },
        competition: { score: 0, explanation: "No players available for analysis" },
        availability: { score: 0, explanation: "No players available for analysis" },
        startingLineupImpact: { score: 0, explanation: "No players available for analysis" }
      }
    },
    recommendation: {
      action: "WAIT",
      reasoning: "No players available for recommendation. Check if all players have been drafted or if there's a data loading issue.",
      riskAssessment: "No risk assessment available",
      alternatives: []
    }
  };
}

/**
 * Validate player data and filter out invalid entries
 */
export function validatePlayerData(players) {
  if (!Array.isArray(players)) {
    return [];
  }

  return players.filter(player => {
    // Basic validation
    if (!player || typeof player !== 'object') {
      return false;
    }

    // Check for required player_info
    if (!player.player_info || typeof player.player_info !== 'object') {
      return false;
    }

    // Check for minimum required fields
    const requiredFields = ['player_id', 'name', 'position'];
    const hasRequiredFields = requiredFields.every(field => 
      player.player_info[field] && 
      typeof player.player_info[field] === 'string' &&
      player.player_info[field].trim().length > 0
    );

    return hasRequiredFields;
  });
}

/**
 * Sanitize and provide defaults for player data
 */
export function sanitizePlayerData(player) {
  if (!player || !player.player_info) {
    return null;
  }

  const playerInfo = player.player_info;
  
  return {
    ...player,
    player_info: {
      player_id: playerInfo.player_id || `unknown-${Date.now()}`,
      name: playerInfo.name || 'Unknown Player',
      position: playerInfo.position || 'UNKNOWN',
      team: playerInfo.team || 'FA',
      projected_2025_points: Number(playerInfo.projected_2025_points) || 0,
      overall_rank: Number(playerInfo.overall_rank) || 999,
      position_rank: Number(playerInfo.position_rank) || 99,
      // Preserve other fields
      ...playerInfo
    }
  };
}