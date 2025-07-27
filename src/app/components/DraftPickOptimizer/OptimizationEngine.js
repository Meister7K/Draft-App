/**
 * Core optimization engine for draft pick recommendations
 * Combines multiple factors to calculate optimization scores for available players
 */

/**
 * Calculate optimization score for a player based on multiple factors
 * @param {Object} player - Player object with player_info
 * @param {Object} context - Optimization context containing roster, draft state, etc.
 * @returns {Object} Optimization result with score and factor breakdown
 */
export function calculateOptimizationScore(player, context) {
  if (!player?.player_info || !context) {
    return {
      score: 0,
      factors: {
        rosterNeed: { score: 0, explanation: "Invalid player or context data" },
        playerValue: {
          score: 0,
          explanation: "Invalid player or context data",
        },
        competition: {
          score: 0,
          explanation: "Invalid player or context data",
        },
        availability: {
          score: 0,
          explanation: "Invalid player or context data",
        },
        startingLineupImpact: {
          score: 0,
          explanation: "Invalid player or context data",
        },
      },
    };
  }

  // Debug logging for key players
  const playerName = player.player_info?.name;
  const isKeyPlayer =
    playerName &&
    (playerName.includes("Hurts") ||
      playerName.includes("Burrow") ||
      playerName.includes("Saquon") ||
      playerName.includes("McCaffrey") ||
      playerName.includes("Tyreek") ||
      playerName.includes("Lamb") ||
      playerName.includes("Bowers") ||
      playerName.includes("Ertz"));

  const factors = {
    rosterNeed: calculateRosterNeedScore(player, context),
    playerValue: calculatePlayerValueScore(player, context),
    competition: calculateCompetitionScore(player, context),
    availability: calculateAvailabilityScore(player, context),
    startingLineupImpact: calculateStartingLineupImpact(player, context),
  };

  // Optimized scoring weights for better recommendations
  const weights = {
    rosterNeed: 0.2, // Reduced slightly to avoid over-prioritizing need
    playerValue: 0.35, // Increased to emphasize player quality
    competition: 0.15, // Reduced as it's less predictable
    availability: 0.2, // Increased to emphasize urgency
    startingLineupImpact: 0.1, // Kept same as it's already calculated in other factors
  };

  // Calculate weighted score
  const weightedScore = Object.keys(factors).reduce((total, factorKey) => {
    return total + factors[factorKey].score * weights[factorKey];
  }, 0);

  const finalScore = Math.round(weightedScore * 10) / 10;

  return {
    score: finalScore,
    factors,
  };
}

/**
 * Calculate roster need score based on current position gaps
 * @param {Object} player - Player object
 * @param {Object} context - Context with current roster and format
 * @returns {Object} Score and explanation for roster need
 */
export function calculateRosterNeedScore(player, context) {
  const position = player.player_info.position;
  const { currentRoster, rosterFormat, memberPicks, draft } = context;

  if (!rosterFormat) {
    return { score: 50, explanation: "Missing roster format data" };
  }

  // Debug logging for key players
  const playerName = player.player_info?.name;
  const isKeyPlayer =
    playerName &&
    (playerName.includes("Hurts") ||
      playerName.includes("Burrow") ||
      playerName.includes("Saquon") ||
      playerName.includes("McCaffrey") ||
      playerName.includes("Bowers") ||
      playerName.includes("Ertz") ||
      playerName.includes("Tyreek") ||
      playerName.includes("Lamb"));

  // Try to get position counts from multiple sources
  let positionCounts = {};

  if (
    currentRoster?.positionCounts &&
    Object.keys(currentRoster.positionCounts).length > 0
  ) {
    positionCounts = currentRoster.positionCounts;
  } else if (memberPicks && memberPicks.length > 0) {
    // Fallback: calculate from memberPicks
    memberPicks.forEach((pick) => {
      const pos = pick.metadata?.position;
      if (pos) {
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      }
    });
  } else if (draft?.picks && draft.picks.length > 0) {
    // Fallback: try to infer from draft picks (this is a guess)
    // This is not ideal but better than nothing
    const userPicks = draft.picks.filter(
      (pick) => pick.user_id === context.selectedMemberId
    );
    userPicks.forEach((pick) => {
      // Try to infer position from pick data if available
      const pos = pick.position || pick.metadata?.position;
      if (pos) {
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      }
    });
  }

  // Get position requirements from roster format
  const positionRequirements = rosterFormat.reduce((acc, format) => {
    acc[format.position] = format.slots;
    return acc;
  }, {});

  // Core requirements (non-FLEX positions)
  const coreRequirements = {
    QB: positionRequirements.QB || 1,
    RB: positionRequirements.RB || 2,
    WR: positionRequirements.WR || 2,
    TE: positionRequirements.TE || 1,
  };

  // Use the position counts we calculated above
  const currentCount = positionCounts[position] || 0;
  const coreNeeded = coreRequirements[position] || 0;
  const flexSlots = positionRequirements.FLEX || 0;

  let score = 0;
  let explanation = "";

  // Calculate need based on position and current count
  if (currentCount < coreNeeded) {
    // High need for core positions not yet filled
    const remaining = coreNeeded - currentCount;
    if (position === "QB" && remaining === 1) {
      score = 85; // QB is critical but only need 1
    } else if (position === "TE" && remaining === 1) {
      score = 80; // TE is important and has limited depth
    } else {
      score = Math.min(95, 65 + remaining * 15); // 65-95 based on remaining need
    }
    explanation = `High need: ${remaining} more ${position}${
      remaining > 1 ? "s" : ""
    } needed for core lineup`;
  } else if (position === "QB" && currentCount >= coreNeeded) {
    // QB has no FLEX eligibility, lower need after core filled
    score = 15;
    explanation = `Low need: Core QB positions filled, limited backup value`;
  } else if (position === "TE" && currentCount >= coreNeeded) {
    // TE has limited depth, moderate need for backup
    if (currentCount === 1) {
      score = 40; // First backup TE has some value
    } else {
      score = 20; // Additional TEs have limited value
    }
    explanation = `Moderate need: Core TE filled, but position has limited depth`;
  } else if (["RB", "WR"].includes(position) && flexSlots > 0) {
    // RB/WR can fill FLEX slots, calculate based on total need
    const totalPossibleSlots = coreNeeded + flexSlots;
    const totalRbWrCount = (positionCounts.RB || 0) + (positionCounts.WR || 0);

    if (totalRbWrCount < totalPossibleSlots) {
      // Scale based on how many slots are still available
      const remainingSlots = totalPossibleSlots - totalRbWrCount;
      score = Math.max(25, 60 - currentCount * 8 + remainingSlots * 5); // 25-75 based on remaining slots
      explanation = `Moderate need: Can fill FLEX slots, ${remainingSlots} total RB/WR/FLEX slots remaining`;
    } else {
      score = Math.max(10, 25 - currentCount * 5);
      explanation = `Low need: Most RB/WR/FLEX slots filled`;
    }
  } else {
    // Default case for other positions or excess players
    score = Math.max(5, 30 - currentCount * 8);
    explanation = `Low need: Position adequately filled`;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    explanation,
  };
}

/**
 * Calculate player value score leveraging existing calculateCompositeValue logic
 * @param {Object} player - Player object
 * @param {Object} context - Context with calculateCompositeValue function
 * @returns {Object} Score and explanation for player value
 */
export function calculatePlayerValueScore(player, context) {
  const { calculateCompositeValue, currentPickNumber } = context;

  if (!calculateCompositeValue) {
    return { score: 0, explanation: "Missing value calculation function" };
  }

  // Debug logging for key players
  const playerName = player.player_info?.name;
  const isKeyPlayer =
    playerName &&
    (playerName.includes("Hurts") ||
      playerName.includes("Burrow") ||
      playerName.includes("Saquon") ||
      playerName.includes("McCaffrey") ||
      playerName.includes("Bowers") ||
      playerName.includes("Ertz") ||
      playerName.includes("Ja'Marr") ||
      playerName.includes("CeeDee") ||
      playerName.includes("Tyreek") ||
      playerName.includes("Baker") ||
      playerName.includes("Jayden"));

  try {
    // Use existing composite value calculation
    const compositeValue = calculateCompositeValue(
      player,
      false,
      currentPickNumber
    );

    // Normalize composite value to 0-100 scale
    // Based on analysis of typical composite values (0-200+ range)
    // Improved normalization to better reflect player values
    const normalizedScore = Math.min(
      100,
      Math.max(0, (compositeValue / 200) * 100)
    );

    // Debug logging for key players
    if (process.env.NODE_ENV === "development" && isKeyPlayer) {
      console.log(`Player value calculation for ${playerName}:`, {
        compositeValue,
        normalizedScore,
        projectedPoints: player.player_info?.projected_2025_points,
        overallRank: player.player_info?.overall_rank,
        positionRank: player.player_info?.position_rank,
      });
    }

    const overallRank = player.player_info.overall_rank || 999;
    const positionRank = player.player_info.position_rank || 999;
    const projectedPoints = player.player_info.projected_2025_points || 0;

    // Position-aware scoring adjustment and composite value validation
    let finalScore = normalizedScore;
    const position = player.player_info.position;

    // Enhanced scoring that prioritizes projected points as the primary factor
    // For QBs, use a scale that makes sense for their typical point ranges (200-400)
    const qbPointsScale = position === "QB" ? 400 : 350;
    const projectedPointsScore = Math.min(
      100,
      (projectedPoints / qbPointsScale) * 100
    );
    const rankScore = Math.max(0, 100 - (overallRank - 1) / 2.5);

    // Projected points should be the dominant factor, especially for QBs
    const pointsWeight = position === "QB" ? 0.85 : 0.7;
    const rankWeight = 1 - pointsWeight;

    const projectedPointsBasedScore =
      projectedPointsScore * pointsWeight + rankScore * rankWeight;

    // Always prioritize projected points over composite value for player evaluation
    // Only use composite value if projected points are missing or very low
    if (projectedPoints >= 340) {
      // Very high projection players (like Jayden Daniels)
      finalScore = Math.max(95, projectedPointsBasedScore);
    } else if (projectedPoints >= 320) {
      // High projection players
      finalScore = Math.max(90, projectedPointsBasedScore);
    } else if (projectedPoints >= 300) {
      // Good projection players (like Baker Mayfield)
      finalScore = Math.max(75, Math.min(85, projectedPointsBasedScore));
    } else if (projectedPoints >= 250) {
      // Decent projection players
      finalScore = Math.max(normalizedScore, projectedPointsBasedScore);
    } else if (projectedPoints >= 200) {
      // Lower projection players
      finalScore = Math.max(normalizedScore * 0.9, projectedPointsBasedScore);
    } else {
      // Very low projections - rely more on composite value
      finalScore = normalizedScore;
    }

    // Cap scores to prevent inflation
    if (position === "QB" && projectedPoints < 320 && finalScore > 85) {
      finalScore = Math.min(85, finalScore);
    } else if (position === "TE" && finalScore > 85) {
      finalScore = Math.max(75, finalScore * 0.95);
    }

    let explanation = `Composite value: ${compositeValue.toFixed(1)}`;

    if (overallRank <= 50) {
      explanation += ` (Elite player, rank #${overallRank})`;
    } else if (overallRank <= 100) {
      explanation += ` (High-value player, rank #${overallRank})`;
    } else if (overallRank <= 200) {
      explanation += ` (Solid player, rank #${overallRank})`;
    } else {
      explanation += ` (Deep league option, rank #${overallRank})`;
    }

    return {
      score: Math.round(finalScore * 10) / 10,
      explanation,
    };
  } catch (error) {
    return {
      score: 0,
      explanation: "Error calculating player value",
    };
  }
}

/**
 * Calculate competition score using enhanced league analysis
 * @param {Object} player - Player object
 * @param {Object} context - Context with league data and analysis
 * @returns {Object} Score and explanation for competition level
 */
export function calculateCompetitionScore(player, context) {
  const position = player.player_info.position;

  // Try to use enhanced competition analysis if available
  if (context.leagueAnalysis && context.urgencyScores) {
    const {
      calculateEnhancedCompetitionScore,
    } = require("./CompetitionAnalyzer.js");
    return calculateEnhancedCompetitionScore(player, context);
  }

  // Fallback to basic competition scoring based on position scarcity
  const positionCompetition = {
    QB: 40, // Lower competition, most teams need 1-2
    RB: 80, // High competition, valuable for FLEX
    WR: 75, // High competition, valuable for FLEX
    TE: 85, // Very high competition, limited quality depth
  };

  const score = positionCompetition[position] || 50;

  return {
    score,
    explanation: `${position} position has ${
      score > 70 ? "high" : score > 50 ? "moderate" : "low"
    } competition (basic analysis)`,
  };
}

/**
 * Calculate availability score using enhanced availability prediction
 * @param {Object} player - Player object
 * @param {Object} context - Context with draft state and league analysis
 * @returns {Object} Score and explanation for availability
 */
export function calculateAvailabilityScore(player, context) {
  const { currentPickNumber, picksUntilNext } = context;

  // Debug logging for key players
  const playerName = player.player_info?.name;
  const isKeyPlayer =
    playerName &&
    (playerName.includes("Hurts") ||
      playerName.includes("Burrow") ||
      playerName.includes("Saquon") ||
      playerName.includes("McCaffrey") ||
      playerName.includes("CeeDee") ||
      playerName.includes("Tyreek") ||
      playerName.includes("Bowers") ||
      playerName.includes("LaPorta"));

  if (process.env.NODE_ENV === "development" && isKeyPlayer) {
    console.log(`Availability calculation for ${playerName}:`, {
      currentPickNumber,
      picksUntilNext,
      hasLeagueAnalysis: !!context.leagueAnalysis,
      hasTargetingPrediction: !!context.targetingPrediction,
      hasDraftOrder: !!context.draftOrder,
    });
  }

  // Try to use enhanced availability prediction if context has required data
  if (
    context.leagueAnalysis &&
    context.targetingPrediction &&
    context.draftOrder
  ) {
    const {
      calculatePlayerAvailability,
    } = require("./AvailabilityPredictor.js");

    try {
      const draftContext = {
        currentPickNumber,
        picksUntilNext,
        leagueAnalysis: context.leagueAnalysis,
        targetingPrediction: context.targetingPrediction,
        draftOrder: context.draftOrder,
        totalManagers: context.leagueAnalysis.totalManagers,
        userFuturePicks: context.userFuturePicks || [],
      };

      const availability = calculatePlayerAvailability(player, draftContext);

      // Validate the result
      if (
        availability &&
        typeof availability.availabilityPercentage === "number" &&
        !isNaN(availability.availabilityPercentage)
      ) {
        const score = availability.availabilityPercentage;

        return {
          score: Math.round(score * 10) / 10,
          explanation: availability.explanation,
          riskLevel: availability.riskLevel,
          estimatedPickRange: availability.estimatedPickRange,
        };
      } else {
        if (process.env.NODE_ENV === "development" && isKeyPlayer) {
          console.warn(
            `Invalid availability result for ${playerName}, using fallback:`,
            availability
          );
        }
      }
    } catch (error) {
      // Fall back to basic calculation if enhanced prediction fails
      if (process.env.NODE_ENV === "development" && isKeyPlayer) {
        console.warn(
          `Enhanced availability prediction failed for ${playerName}, using basic calculation:`,
          error
        );
      }
    }
  }

  // Fallback to basic availability scoring
  // Note: In draft context, lower availability should create URGENCY to draft (higher score)
  // Higher availability means we can wait (lower score)
  const overallRank = player.player_info.overall_rank || 999;
  const projectedPoints = player.player_info.projected_2025_points || 0;
  let score = 50; // Default moderate urgency
  let explanation = "Moderate availability expected";

  // Enhanced availability scoring that considers both rank and projected points
  if (overallRank <= 10 || projectedPoints > 320) {
    // Top 10 players or very high projections - maximum urgency
    score = 90;
    explanation = "Maximum urgency - elite tier player, draft immediately";
  } else if (overallRank <= 30 || projectedPoints > 280) {
    // Elite players (top 30) or high projections - high urgency
    score = 80;
    explanation = "High urgency - elite player, draft now";
  } else if (overallRank <= 60 || projectedPoints > 240) {
    // Good players (31-60) or solid projections - moderate-high urgency
    score = 65;
    explanation = "Moderate-high urgency - quality player";
  } else if (overallRank <= 100 || projectedPoints > 200) {
    // Decent players (61-100) - moderate urgency
    score = 50;
    explanation = "Moderate urgency - solid player";
  } else if (overallRank <= 150) {
    // Depth players (101-150) - some urgency
    score = 35;
    explanation = "Some urgency - decent depth option";
  } else {
    // Deep players (151+) - low urgency
    score = 20;
    explanation = "Low urgency - deep league option";
  }

  // Ensure score is a valid number
  if (isNaN(score) || typeof score !== "number") {
    score = 50; // Safe fallback
    explanation = "Availability analysis unavailable - using default";
  }

  // Debug logging for key players
  if (process.env.NODE_ENV === "development" && isKeyPlayer) {
    console.log(`Fallback availability for ${playerName}:`, {
      overallRank,
      currentPickNumber,
      score,
      explanation,
    });
  }

  return {
    score,
    explanation: `${explanation} (basic analysis)`,
  };
}

/**
 * Calculate starting lineup impact score using enhanced calculator
 * @param {Object} player - Player object
 * @param {Object} context - Context with current roster
 * @returns {Object} Score and explanation for starting lineup impact
 */
export function calculateStartingLineupImpact(player, context) {
  const { currentRoster, rosterFormat } = context;

  if (!currentRoster || !rosterFormat) {
    return { score: 0, explanation: "Missing roster data" };
  }

  try {
    // Use enhanced starting lineup impact calculator
    const {
      calculateProjectedFantasyPointImprovement,
    } = require("./StartingLineupImpactCalculator.js");

    const impactAnalysis = calculateProjectedFantasyPointImprovement(
      player,
      context
    );

    // Convert weekly improvement to 0-100 score
    // Scale based on typical weekly improvements (0-10 points per week)
    let score = 0;
    const weeklyImprovement = impactAnalysis.weeklyImprovement;

    if (impactAnalysis.impactType === "fill_empty_slot") {
      // High priority for filling empty slots
      score = Math.min(90, Math.max(50, (weeklyImprovement / 15) * 40 + 50));
    } else if (impactAnalysis.impactType === "replace_starter") {
      // Scale based on improvement amount
      score = Math.min(100, Math.max(20, (weeklyImprovement / 10) * 80 + 20));
    } else {
      // Bench depth has lower impact
      const projectedPoints = player.player_info?.projected_2025_points || 0;
      score = Math.min(30, Math.max(5, (projectedPoints / 400) * 25 + 5));
    }

    return {
      score: Math.round(score * 10) / 10,
      explanation: impactAnalysis.explanation,
      weeklyImprovement: impactAnalysis.weeklyImprovement,
      seasonImprovement: impactAnalysis.seasonImprovement,
      impactType: impactAnalysis.impactType,
    };
  } catch (error) {
    // Fallback to basic calculation if enhanced calculator fails
    console.warn(
      "Enhanced starting lineup impact calculation failed, using fallback:",
      error
    );
    return calculateBasicStartingLineupImpact(player, context);
  }
}

/**
 * Fallback basic starting lineup impact calculation
 * @param {Object} player - Player object
 * @param {Object} context - Context with current roster
 * @returns {Object} Score and explanation for starting lineup impact
 */
function calculateBasicStartingLineupImpact(player, context) {
  const { currentRoster, rosterFormat } = context;
  const position = player.player_info.position;
  const projectedPoints = player.player_info.projected_2025_points || 0;

  // Get current starters for this position
  const currentStarters = currentRoster.starters || {};
  const positionStarters = currentStarters[position] || [];

  // Find the weakest starter that this player could replace
  let worstStarterPoints = 0;
  let canImproveStarters = false;

  // Check direct position replacement
  const filledStarters = positionStarters.filter((starter) => starter !== null);
  if (filledStarters.length > 0) {
    const worstStarter = filledStarters.reduce((worst, current) => {
      const currentPoints =
        current.player?.player_info?.projected_2025_points || 0;
      const worstPoints = worst.player?.player_info?.projected_2025_points || 0;
      return currentPoints < worstPoints ? current : worst;
    });
    worstStarterPoints =
      worstStarter.player?.player_info?.projected_2025_points || 0;
    canImproveStarters = projectedPoints > worstStarterPoints;
  }

  // Check if there are empty slots at this position
  const positionFormat = rosterFormat.find((f) => f.position === position);
  const hasEmptySlots = positionStarters.length < (positionFormat?.slots || 0);

  // Check FLEX replacement for RB/WR/TE
  let flexImpact = 0;
  if (["RB", "WR", "TE"].includes(position) && currentStarters.FLEX) {
    const flexStarters = currentStarters.FLEX.filter(
      (starter) => starter !== null
    );
    if (flexStarters.length > 0) {
      const worstFlexStarter = flexStarters.reduce((worst, current) => {
        const currentPoints =
          current.player?.player_info?.projected_2025_points || 0;
        const worstPoints =
          worst.player?.player_info?.projected_2025_points || 0;
        return currentPoints < worstPoints ? current : worst;
      });
      const worstFlexPoints =
        worstFlexStarter.player?.player_info?.projected_2025_points || 0;
      if (projectedPoints > worstFlexPoints) {
        flexImpact = projectedPoints - worstFlexPoints;
        if (flexImpact > projectedPoints - worstStarterPoints) {
          worstStarterPoints = worstFlexPoints;
          canImproveStarters = true;
        }
      }
    }
  }

  let score = 0;
  let explanation = "";

  if (hasEmptySlots) {
    // Would fill an empty starter slot - high priority
    score = Math.min(90, Math.max(50, (projectedPoints / 300) * 40 + 50));
    explanation = `Would fill empty starting slot with ${projectedPoints.toFixed(
      1
    )} projected points`;
  } else if (canImproveStarters) {
    const pointsImprovement = projectedPoints - worstStarterPoints;
    // Scale improvement to 0-100 (assuming max meaningful improvement is ~50 points)
    score = Math.min(100, Math.max(20, (pointsImprovement / 50) * 80 + 20));
    explanation = `Would improve starting lineup by ${pointsImprovement.toFixed(
      1
    )} points per week`;
  } else {
    // Would only add bench depth
    score = Math.min(30, Math.max(5, (projectedPoints / 400) * 25 + 5));
    explanation = `Would add bench depth with ${projectedPoints.toFixed(
      1
    )} projected points`;
  }

  return {
    score: Math.round(score * 10) / 10,
    explanation,
  };
}

/**
 * Generate ranked recommendations for available players
 * @param {Array} availablePlayers - Array of available player objects
 * @param {Object} context - Optimization context
 * @returns {Array} Top 5 ranked recommendations with diversity
 */
export function generateRankedRecommendations(availablePlayers, context) {
  if (
    !availablePlayers ||
    !Array.isArray(availablePlayers) ||
    availablePlayers.length === 0
  ) {
    return [];
  }

  if (!context) {
    return [];
  }

  // Calculate optimization scores for all available players
  const scoredPlayers = availablePlayers
    .map((player) => {
      const optimization = calculateOptimizationScore(player, context);
      return {
        player,
        optimization,
        playerId:
          player.player_info?.player_id ||
          `${player.player_info?.name}-${player.player_info?.position}`,
      };
    })
    .filter((item) => item.optimization.score > 0); // Filter out invalid players

  // Debug logging
  if (process.env.NODE_ENV === "development") {
    console.log("OptimizationEngine Debug:", {
      inputPlayersCount: availablePlayers.length,
      scoredPlayersCount: scoredPlayers.length,
      topScoredPlayers: scoredPlayers
        .sort((a, b) => b.optimization.score - a.optimization.score)
        .slice(0, 10)
        .map((p) => ({
          name: p.player?.player_info?.name,
          position: p.player?.player_info?.position,
          score: p.optimization.score,
          factors: {
            rosterNeed: p.optimization.factors.rosterNeed.score,
            playerValue: p.optimization.factors.playerValue.score,
            competition: p.optimization.factors.competition.score,
            availability: p.optimization.factors.availability.score,
          },
        })),
    });
  }

  // Sort by optimization score (descending)
  const rankedPlayers = rankPlayersByOptimizationScore(scoredPlayers);

  // Apply filtering for top 5 with diversity
  const filteredRecommendations = filterTopRecommendationsWithDiversity(
    rankedPlayers,
    5
  );

  // Debug logging
  if (process.env.NODE_ENV === "development") {
    console.log("Filtering Debug:", {
      rankedPlayersCount: rankedPlayers.length,
      filteredRecommendationsCount: filteredRecommendations.length,
      topRankedPlayers: rankedPlayers.slice(0, 10).map((p) => ({
        name: p.player?.player_info?.name,
        position: p.player?.player_info?.position,
        score: p.optimization.score,
      })),
      filteredPlayers: filteredRecommendations.map((p) => ({
        name: p.player?.player_info?.name,
        position: p.player?.player_info?.position,
        score: p.optimization.score,
      })),
    });
  }

  // Add ranking information
  return filteredRecommendations.map((recommendation, index) => ({
    ...recommendation,
    rank: index + 1,
    recommendation: generateRecommendationAction(recommendation, context),
  }));
}

/**
 * Rank players by optimization score with tie-breaking logic
 * @param {Array} scoredPlayers - Array of players with optimization scores
 * @returns {Array} Sorted array of players by optimization score
 */
export function rankPlayersByOptimizationScore(scoredPlayers) {
  return scoredPlayers.sort((a, b) => {
    // Primary sort: optimization score (descending)
    const scoreDiff = b.optimization.score - a.optimization.score;

    if (Math.abs(scoreDiff) < 0.1) {
      // Tie-breaking logic for players with similar scores (within 0.1 points)
      return applyTieBreakingLogic(a, b);
    }

    return scoreDiff;
  });
}

/**
 * Apply tie-breaking logic for players with similar optimization scores
 * @param {Object} playerA - First player with optimization data
 * @param {Object} playerB - Second player with optimization data
 * @returns {number} Comparison result (-1, 0, 1)
 */
export function applyTieBreakingLogic(playerA, playerB) {
  const playerInfoA = playerA.player.player_info;
  const playerInfoB = playerB.player.player_info;

  // Tie-breaker 1: Roster need score (higher is better)
  const rosterNeedDiff =
    playerB.optimization.factors.rosterNeed.score -
    playerA.optimization.factors.rosterNeed.score;
  if (Math.abs(rosterNeedDiff) >= 5) {
    return rosterNeedDiff;
  }

  // Tie-breaker 2: Player value score (higher is better)
  const playerValueDiff =
    playerB.optimization.factors.playerValue.score -
    playerA.optimization.factors.playerValue.score;
  if (Math.abs(playerValueDiff) >= 5) {
    return playerValueDiff;
  }

  // Tie-breaker 3: Overall rank (lower rank number is better)
  const overallRankA = playerInfoA.overall_rank || 999;
  const overallRankB = playerInfoB.overall_rank || 999;
  const rankDiff = overallRankA - overallRankB;
  if (Math.abs(rankDiff) >= 5) {
    return rankDiff;
  }

  // Tie-breaker 4: Projected points (higher is better)
  const projectedPointsA = playerInfoA.projected_2025_points || 0;
  const projectedPointsB = playerInfoB.projected_2025_points || 0;
  const pointsDiff = projectedPointsB - projectedPointsA;
  if (Math.abs(pointsDiff) >= 5) {
    return pointsDiff;
  }

  // Tie-breaker 5: Position rank (lower is better)
  const positionRankA = playerInfoA.position_rank || 999;
  const positionRankB = playerInfoB.position_rank || 999;
  const posRankDiff = positionRankA - positionRankB;
  if (Math.abs(posRankDiff) >= 2) {
    return posRankDiff;
  }

  // Final tie-breaker: Alphabetical by name
  const nameA = playerInfoA.name || "";
  const nameB = playerInfoB.name || "";
  return nameA.localeCompare(nameB);
}

/**
 * Filter top recommendations with position diversity
 * @param {Array} rankedPlayers - Array of ranked players
 * @param {number} maxRecommendations - Maximum number of recommendations to return
 * @returns {Array} Filtered recommendations with diversity
 */
export function filterTopRecommendationsWithDiversity(
  rankedPlayers,
  maxRecommendations = 5
) {
  if (!rankedPlayers || rankedPlayers.length === 0) {
    return [];
  }

  const recommendations = [];
  const positionCounts = {};
  const maxPerPosition = Math.ceil(maxRecommendations / 2); // Allow up to 3 players per position for 5 recommendations

  // First pass: Add top players while maintaining position diversity
  for (const player of rankedPlayers) {
    if (recommendations.length >= maxRecommendations) {
      break;
    }

    const position = player.player.player_info.position;
    const currentPositionCount = positionCounts[position] || 0;

    // Debug logging for diversity filtering
    if (process.env.NODE_ENV === "development") {
      const playerName = player.player?.player_info?.name;
      const willAdd =
        currentPositionCount < maxPerPosition || recommendations.length < 2;
      if (
        playerName &&
        (playerName.includes("Hurts") ||
          playerName.includes("Burrow") ||
          playerName.includes("Saquon") ||
          playerName.includes("McCaffrey"))
      ) {
        console.log(`Diversity filtering ${playerName} (${position}):`, {
          currentPositionCount,
          maxPerPosition,
          recommendationsLength: recommendations.length,
          willAdd,
          score: player.optimization.score,
        });
      }
    }

    // Add player if we haven't exceeded position limit or if we have few recommendations
    if (currentPositionCount < maxPerPosition || recommendations.length < 2) {
      recommendations.push(player);
      positionCounts[position] = currentPositionCount + 1;
    }
  }

  // Second pass: Fill remaining slots with best available players if we have fewer than maxRecommendations
  if (recommendations.length < maxRecommendations) {
    const remainingPlayers = rankedPlayers.filter(
      (player) =>
        !recommendations.some((rec) => rec.playerId === player.playerId)
    );

    for (const player of remainingPlayers) {
      if (recommendations.length >= maxRecommendations) {
        break;
      }
      recommendations.push(player);
    }
  }

  return recommendations.slice(0, maxRecommendations);
}

/**
 * Generate recommendation action based on optimization factors
 * @param {Object} recommendation - Recommendation with player and optimization data
 * @param {Object} context - Optimization context
 * @returns {Object} Recommendation action and reasoning
 */
export function generateRecommendationAction(recommendation, context) {
  const { optimization } = recommendation;
  const { factors } = optimization;

  // Determine action based on factor scores
  const rosterNeedScore = factors.rosterNeed.score;
  const availabilityScore = factors.availability.score;
  const competitionScore = factors.competition.score;
  const overallScore = optimization.score;

  let action = "CONSIDER";
  let reasoning = "";
  let riskAssessment = "";

  // High overall score with high roster need = PICK_NOW
  if (overallScore >= 75 && rosterNeedScore >= 60) {
    action = "PICK_NOW";
    reasoning = "Strong overall value with high roster need";
    riskAssessment = "Low risk - addresses immediate need with quality player";
  }
  // High competition, low availability = PICK_NOW
  else if (competitionScore >= 70 && availabilityScore <= 40) {
    action = "PICK_NOW";
    reasoning = "High competition and low availability make waiting risky";
    riskAssessment = "High risk if waiting - likely to be drafted soon";
  }
  // High availability, low roster need = WAIT
  else if (availabilityScore >= 70 && rosterNeedScore <= 30) {
    action = "WAIT";
    reasoning =
      "Player likely available later, focus on more pressing needs first";
    riskAssessment =
      "Low risk - similar players should be available in later rounds";
  }
  // Good value but moderate factors = CONSIDER
  else if (overallScore >= 60) {
    action = "CONSIDER";
    reasoning = "Solid value with balanced factors";
    riskAssessment = "Moderate risk - weigh against other available options";
  }
  // Lower scores = WAIT
  else {
    action = "WAIT";
    reasoning = "Better options likely available";
    riskAssessment = "Low risk - focus on higher-value targets first";
  }

  return {
    action,
    reasoning,
    riskAssessment,
    confidence: calculateRecommendationConfidence(optimization),
  };
}

/**
 * Calculate confidence level for a recommendation
 * @param {Object} optimization - Optimization data with score and factors
 * @returns {number} Confidence score from 0-100
 */
export function calculateRecommendationConfidence(optimization) {
  const { score, factors } = optimization;

  // Base confidence on overall score
  let confidence = Math.min(90, score * 0.8);

  // Adjust based on factor consistency
  const factorScores = Object.values(factors).map((f) => f.score);
  const avgFactorScore =
    factorScores.reduce((sum, score) => sum + score, 0) / factorScores.length;
  const factorVariance =
    factorScores.reduce(
      (sum, score) => sum + Math.pow(score - avgFactorScore, 2),
      0
    ) / factorScores.length;
  const factorStdDev = Math.sqrt(factorVariance);

  // Lower confidence if factors are highly inconsistent
  if (factorStdDev > 25) {
    confidence *= 0.8;
  } else if (factorStdDev > 15) {
    confidence *= 0.9;
  }

  // Boost confidence for very high scores
  if (score >= 85) {
    confidence = Math.min(95, confidence * 1.1);
  }

  return Math.round(Math.max(10, Math.min(95, confidence)));
}

/**
 * Assess current roster needs and gaps
 * @param {Object} currentRoster - Current roster state
 * @param {Array} rosterFormat - League roster format requirements
 * @returns {Object} Roster needs analysis
 */
export function assessRosterNeeds(currentRoster, rosterFormat) {
  if (!currentRoster || !rosterFormat) {
    return {
      positionNeeds: {},
      totalNeeds: 0,
      criticalNeeds: [],
      summary: "Unable to assess roster needs - missing data",
    };
  }

  const positionCounts = currentRoster.positionCounts || {};
  const positionNeeds = {};
  const criticalNeeds = [];
  let totalNeeds = 0;

  // Analyze each position requirement
  rosterFormat.forEach(({ position, slots }) => {
    const currentCount = positionCounts[position] || 0;
    const needed = Math.max(0, slots - currentCount);

    positionNeeds[position] = {
      required: slots,
      current: currentCount,
      needed: needed,
      urgency:
        needed === 0
          ? "none"
          : needed >= Math.ceil(slots * 0.5)
          ? "high"
          : "medium",
    };

    totalNeeds += needed;

    if (needed > 0 && (position !== "FLEX" || needed >= 2)) {
      criticalNeeds.push({
        position,
        needed,
        urgency: positionNeeds[position].urgency,
      });
    }
  });

  // Generate summary
  let summary = "";
  if (totalNeeds === 0) {
    summary = "Roster is complete for all positions";
  } else if (criticalNeeds.length > 0) {
    const criticalPositions = criticalNeeds
      .map(
        (need) => `${need.needed} ${need.position}${need.needed > 1 ? "s" : ""}`
      )
      .join(", ");
    summary = `Critical needs: ${criticalPositions}`;
  } else {
    summary = `${totalNeeds} total roster spots remaining`;
  }

  return {
    positionNeeds,
    totalNeeds,
    criticalNeeds,
    summary,
  };
}
