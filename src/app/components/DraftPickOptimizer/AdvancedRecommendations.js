/**
 * Advanced Recommendation Features for Draft Pick Optimizer
 * Provides alternative player suggestions, wait vs pick now advisory, position scarcity warnings,
 * and draft strategy insights
 */

import { calculateOptimizationScore } from './OptimizationEngine';
import { assessWaitingRisk } from './AvailabilityPredictor';

/**
 * Generate alternative player suggestions for each top recommendation
 * @param {Object} recommendation - Primary recommendation with player and optimization data
 * @param {Array} availablePlayers - All available players
 * @param {Object} context - Optimization context
 * @returns {Array} Array of alternative player suggestions
 */
export function generateAlternativePlayerSuggestions(recommendation, availablePlayers, context) {
  if (!recommendation?.player?.player_info || !availablePlayers || !context) {
    return [];
  }

  const primaryPlayer = recommendation.player;
  const primaryPosition = primaryPlayer.player_info.position;
  const primaryScore = recommendation.optimization.score;

  // Find similar players at the same position
  const samePositionPlayers = availablePlayers.filter(player => 
    player?.player_info?.position === primaryPosition &&
    player.player_info.player_id !== primaryPlayer.player_info.player_id
  );

  // Find players at related positions (RB/WR for FLEX eligibility)
  const relatedPositions = getRelatedPositions(primaryPosition);
  const relatedPositionPlayers = availablePlayers.filter(player =>
    player?.player_info?.position &&
    relatedPositions.includes(player.player_info.position) &&
    player.player_info.player_id !== primaryPlayer.player_info.player_id
  );

  // Combine and score all potential alternatives
  const potentialAlternatives = [...samePositionPlayers, ...relatedPositionPlayers];
  const scoredAlternatives = potentialAlternatives
    .map(player => {
      const optimization = calculateOptimizationScore(player, context);
      return {
        player,
        optimization,
        playerId: player.player_info.player_id,
        similarityScore: calculatePlayerSimilarity(primaryPlayer, player, context)
      };
    })
    .filter(alt => alt.optimization.score > 0);

  // Sort by combination of optimization score and similarity
  const rankedAlternatives = scoredAlternatives.sort((a, b) => {
    const scoreA = (a.optimization.score * 0.7) + (a.similarityScore * 0.3);
    const scoreB = (b.optimization.score * 0.7) + (b.similarityScore * 0.3);
    return scoreB - scoreA;
  });

  // Return top 3 alternatives with detailed comparison
  return rankedAlternatives.slice(0, 3).map(alt => ({
    player: alt.player,
    optimization: alt.optimization,
    similarityScore: alt.similarityScore,
    comparison: generatePlayerComparison(primaryPlayer, alt.player, context),
    recommendation: generateAlternativeRecommendation(alt, primaryScore, context)
  }));
}

/**
 * Get related positions for FLEX eligibility
 * @param {string} position - Primary position
 * @returns {Array} Array of related positions
 */
function getRelatedPositions(position) {
  const flexEligible = ['RB', 'WR', 'TE'];
  
  if (flexEligible.includes(position)) {
    return flexEligible.filter(pos => pos !== position);
  }
  
  return [];
}

/**
 * Calculate similarity score between two players
 * @param {Object} primaryPlayer - Primary player
 * @param {Object} alternativePlayer - Alternative player
 * @param {Object} context - Optimization context
 * @returns {number} Similarity score (0-100)
 */
function calculatePlayerSimilarity(primaryPlayer, alternativePlayer, context) {
  const primary = primaryPlayer.player_info;
  const alternative = alternativePlayer.player_info;

  let similarityScore = 0;

  // Position similarity (highest weight)
  if (primary.position === alternative.position) {
    similarityScore += 40;
  } else if (getRelatedPositions(primary.position).includes(alternative.position)) {
    similarityScore += 25;
  }

  // Projected points similarity
  const primaryPoints = primary.projected_2025_points || 0;
  const altPoints = alternative.projected_2025_points || 0;
  const pointsDiff = Math.abs(primaryPoints - altPoints);
  const pointsSimilarity = Math.max(0, 30 - (pointsDiff / 10)); // Up to 30 points
  similarityScore += pointsSimilarity;

  // Rank similarity
  const primaryRank = primary.overall_rank || 999;
  const altRank = alternative.overall_rank || 999;
  const rankDiff = Math.abs(primaryRank - altRank);
  const rankSimilarity = Math.max(0, 20 - (rankDiff / 5)); // Up to 20 points
  similarityScore += rankSimilarity;

  // Position rank similarity
  const primaryPosRank = primary.position_rank || 999;
  const altPosRank = alternative.position_rank || 999;
  const posRankDiff = Math.abs(primaryPosRank - altPosRank);
  const posRankSimilarity = Math.max(0, 10 - (posRankDiff / 2)); // Up to 10 points
  similarityScore += posRankSimilarity;

  return Math.min(100, Math.max(0, similarityScore));
}

/**
 * Generate comparison between primary and alternative player
 * @param {Object} primaryPlayer - Primary player
 * @param {Object} alternativePlayer - Alternative player
 * @param {Object} context - Optimization context
 * @returns {Object} Comparison details
 */
function generatePlayerComparison(primaryPlayer, alternativePlayer, context) {
  const primary = primaryPlayer.player_info;
  const alternative = alternativePlayer.player_info;

  const comparison = {
    projectedPoints: {
      primary: primary.projected_2025_points || 0,
      alternative: alternative.projected_2025_points || 0,
      difference: (alternative.projected_2025_points || 0) - (primary.projected_2025_points || 0)
    },
    overallRank: {
      primary: primary.overall_rank || 999,
      alternative: alternative.overall_rank || 999,
      difference: (primary.overall_rank || 999) - (alternative.overall_rank || 999)
    },
    positionRank: {
      primary: primary.position_rank || 999,
      alternative: alternative.position_rank || 999,
      difference: (primary.position_rank || 999) - (alternative.position_rank || 999)
    }
  };

  // Generate comparison summary
  let summary = "";
  if (Math.abs(comparison.projectedPoints.difference) < 5) {
    summary = "Very similar projected production";
  } else if (comparison.projectedPoints.difference > 0) {
    summary = `${comparison.projectedPoints.difference.toFixed(1)} more projected points`;
  } else {
    summary = `${Math.abs(comparison.projectedPoints.difference).toFixed(1)} fewer projected points`;
  }

  if (comparison.overallRank.difference > 10) {
    summary += ", ranked significantly higher";
  } else if (comparison.overallRank.difference < -10) {
    summary += ", ranked significantly lower";
  }

  return {
    ...comparison,
    summary
  };
}

/**
 * Generate recommendation for alternative player
 * @param {Object} alternative - Alternative player with optimization data
 * @param {number} primaryScore - Primary player's optimization score
 * @param {Object} context - Optimization context
 * @returns {Object} Alternative recommendation
 */
function generateAlternativeRecommendation(alternative, primaryScore, context) {
  const scoreDifference = alternative.optimization.score - primaryScore;
  
  let recommendation = "";
  let confidence = 0;

  if (scoreDifference > 5) {
    recommendation = "Better option than primary recommendation";
    confidence = 85;
  } else if (scoreDifference > -5) {
    recommendation = "Comparable option with similar value";
    confidence = 75;
  } else if (scoreDifference > -15) {
    recommendation = "Solid alternative if primary unavailable";
    confidence = 65;
  } else {
    recommendation = "Lower-tier alternative";
    confidence = 45;
  }

  return {
    recommendation,
    confidence,
    scoreDifference: Math.round(scoreDifference * 10) / 10
  };
}

/**
 * Create "wait vs pick now" advisory system with confidence indicators
 * @param {Object} recommendation - Recommendation with player and optimization data
 * @param {Object} context - Optimization context with draft state
 * @returns {Object} Wait vs pick now advisory
 */
export function createWaitVsPickNowAdvisory(recommendation, context) {
  if (!recommendation?.player || !context) {
    return {
      action: 'UNKNOWN',
      confidence: 0,
      reasoning: 'Insufficient data for advisory',
      riskFactors: [],
      alternatives: []
    };
  }

  const player = recommendation.player;
  const optimization = recommendation.optimization;
  
  // Get waiting risk assessment
  const waitingRisk = assessWaitingRisk(player, context);
  
  // Analyze optimization factors for decision
  const factors = optimization.factors;
  const rosterNeedScore = factors.rosterNeed?.score || 0;
  const availabilityScore = factors.availability?.score || 0;
  const competitionScore = factors.competition?.score || 0;
  const playerValueScore = factors.playerValue?.score || 0;

  // Decision logic based on multiple factors
  let action = 'CONSIDER';
  let confidence = 0;
  let reasoning = '';
  let urgencyLevel = 'medium';

  // High roster need + low availability = PICK NOW
  if (rosterNeedScore >= 70 && availabilityScore <= 40) {
    action = 'PICK_NOW';
    confidence = Math.min(95, 75 + (rosterNeedScore - 70) + (40 - availabilityScore));
    reasoning = 'High roster need with low availability makes waiting risky';
    urgencyLevel = 'high';
  }
  // High competition + good value = PICK NOW
  else if (competitionScore >= 75 && playerValueScore >= 60) {
    action = 'PICK_NOW';
    confidence = Math.min(90, 70 + (competitionScore - 75) + (playerValueScore - 60) * 0.5);
    reasoning = 'High competition for quality player - recommend securing now';
    urgencyLevel = 'high';
  }
  // High availability + low roster need = WAIT
  else if (availabilityScore >= 75 && rosterNeedScore <= 40) {
    action = 'WAIT';
    confidence = Math.min(85, 60 + (availabilityScore - 75) + (40 - rosterNeedScore) * 0.5);
    reasoning = 'High availability with low immediate need - can wait for better value';
    urgencyLevel = 'low';
  }
  // High availability + moderate need = WAIT (additional condition)
  else if (availabilityScore >= 80 && rosterNeedScore <= 50 && competitionScore <= 60) {
    action = 'WAIT';
    confidence = Math.min(80, 55 + (availabilityScore - 80) + (50 - rosterNeedScore) * 0.3);
    reasoning = 'Very high availability with moderate need - safe to wait';
    urgencyLevel = 'low';
  }
  // Moderate factors = CONSIDER
  else if (optimization.score >= 60) {
    action = 'CONSIDER';
    confidence = Math.min(80, 50 + (optimization.score - 60) * 0.8);
    reasoning = 'Balanced factors - weigh against other available options';
    urgencyLevel = 'medium';
  }
  // Low overall score = WAIT
  else {
    action = 'WAIT';
    confidence = Math.min(75, 40 + (60 - optimization.score) * 0.5);
    reasoning = 'Better options likely available - focus on higher-value targets';
    urgencyLevel = 'low';
  }

  // Adjust confidence based on waiting risk assessment
  if (waitingRisk.confidence > 0.8 && action === 'WAIT') {
    confidence = Math.min(confidence, 85);
  } else if (waitingRisk.confidence < 0.4 && action === 'PICK_NOW') {
    confidence = Math.max(confidence * 0.8, 60);
  }

  return {
    action,
    confidence: Math.round(confidence),
    reasoning,
    urgencyLevel,
    waitingRisk: {
      shouldWait: waitingRisk.shouldWait,
      confidence: Math.round(waitingRisk.confidence * 100),
      reasoning: waitingRisk.reasoning,
      riskFactors: waitingRisk.riskFactors || []
    },
    factorBreakdown: {
      rosterNeed: rosterNeedScore,
      availability: availabilityScore,
      competition: competitionScore,
      playerValue: playerValueScore
    },
    nextBestAction: generateNextBestAction(action, factors, context)
  };
}

/**
 * Generate next best action if primary action isn't taken
 * @param {string} primaryAction - Primary recommended action
 * @param {Object} factors - Optimization factors
 * @param {Object} context - Optimization context
 * @returns {Object} Next best action recommendation
 */
function generateNextBestAction(primaryAction, factors, context) {
  const rosterNeedScore = factors.rosterNeed?.score || 0;
  const availabilityScore = factors.availability?.score || 0;

  if (primaryAction === 'PICK_NOW') {
    if (availabilityScore >= 60) {
      return {
        action: 'MONITOR',
        reasoning: 'If you decide to wait, monitor closely for competition changes'
      };
    } else {
      return {
        action: 'FIND_ALTERNATIVE',
        reasoning: 'If unavailable, look for similar players at this position'
      };
    }
  } else if (primaryAction === 'WAIT') {
    if (rosterNeedScore >= 60) {
      return {
        action: 'RECONSIDER',
        reasoning: 'If other needs are filled, reconsider this player for roster depth'
      };
    } else {
      return {
        action: 'TRACK',
        reasoning: 'Keep on watch list for later rounds if still available'
      };
    }
  } else {
    return {
      action: 'COMPARE',
      reasoning: 'Compare with other available options before deciding'
    };
  }
}

/**
 * Generate position scarcity warnings for high-value players at scarce positions
 * @param {Array} recommendations - Array of recommendations
 * @param {Object} context - Optimization context with league analysis
 * @returns {Array} Array of scarcity warnings
 */
export function generatePositionScarcityWarnings(recommendations, context) {
  if (!recommendations || !context?.leagueAnalysis) {
    return [];
  }

  const warnings = [];
  const { positionDemand } = context.leagueAnalysis;

  recommendations.forEach((recommendation, index) => {
    const player = recommendation.player;
    const position = player.player_info.position;
    const positionRank = player.player_info.position_rank || 999;
    const overallRank = player.player_info.overall_rank || 999;

    const demand = positionDemand[position];
    if (!demand) return;

    // Check for scarcity conditions
    const isHighValuePlayer = positionRank <= getPositionTier1Threshold(position) || overallRank <= 50;
    const isScarcePosition = demand.competitionLevel === 'very_high' || demand.competitionLevel === 'high';
    const isLimitedSupply = demand.slotsRemaining <= demand.managersStillNeed * 0.8;

    if (isHighValuePlayer && isScarcePosition) {
      const severity = determineScarcitySeverity(demand, positionRank, position);
      
      warnings.push({
        playerId: player.player_info.player_id,
        playerName: player.player_info.name,
        position,
        positionRank,
        overallRank,
        severity,
        warning: generateScarcityWarningMessage(player, demand, severity),
        recommendation: generateScarcityRecommendation(player, demand, severity, context),
        stats: {
          managersNeed: demand.managersStillNeed,
          slotsRemaining: demand.slotsRemaining,
          competitionLevel: demand.competitionLevel,
          competitionScore: demand.competitionScore
        }
      });
    }
  });

  // Sort warnings by severity (critical first)
  return warnings.sort((a, b) => {
    const severityOrder = { 'critical': 3, 'high': 2, 'medium': 1, 'low': 0 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

/**
 * Get position tier 1 threshold for determining high-value players
 * @param {string} position - Player position
 * @returns {number} Position rank threshold for tier 1 players
 */
function getPositionTier1Threshold(position) {
  const thresholds = {
    QB: 8,   // Top 8 QBs
    RB: 12,  // Top 12 RBs
    WR: 15,  // Top 15 WRs
    TE: 6    // Top 6 TEs
  };
  return thresholds[position] || 10;
}

/**
 * Determine scarcity severity level
 * @param {Object} demand - Position demand data
 * @param {number} positionRank - Player's position rank
 * @param {string} position - Player position
 * @returns {string} Severity level
 */
function determineScarcitySeverity(demand, positionRank, position) {
  const tier1Threshold = getPositionTier1Threshold(position);
  const isElitePlayer = positionRank <= Math.ceil(tier1Threshold * 0.5);
  const isTier1Player = positionRank <= tier1Threshold;

  if (demand.competitionLevel === 'very_high' && isElitePlayer) {
    return 'critical';
  } else if (demand.competitionLevel === 'very_high' && isTier1Player) {
    return 'high';
  } else if (demand.competitionLevel === 'high' && isElitePlayer) {
    return 'high';
  } else if (demand.competitionLevel === 'high' && isTier1Player) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Generate scarcity warning message
 * @param {Object} player - Player object
 * @param {Object} demand - Position demand data
 * @param {string} severity - Warning severity
 * @returns {string} Warning message
 */
function generateScarcityWarningMessage(player, demand, severity) {
  const position = player.player_info.position;
  const positionRank = player.player_info.position_rank || 999;
  const name = player.player_info.name;

  const baseMessage = `${name} (#${positionRank} ${position})`;
  
  switch (severity) {
    case 'critical':
      return `${baseMessage} - CRITICAL: Elite ${position} with extreme scarcity (${demand.managersStillNeed} managers need, ${demand.slotsRemaining} slots left)`;
    case 'high':
      return `${baseMessage} - HIGH: Top-tier ${position} in high-demand position (${demand.managersStillNeed} managers competing)`;
    case 'medium':
      return `${baseMessage} - MEDIUM: Quality ${position} with significant competition (${demand.competitionLevel} demand)`;
    default:
      return `${baseMessage} - Position scarcity detected`;
  }
}

/**
 * Generate scarcity-based recommendation
 * @param {Object} player - Player object
 * @param {Object} demand - Position demand data
 * @param {string} severity - Warning severity
 * @param {Object} context - Optimization context
 * @returns {string} Scarcity recommendation
 */
function generateScarcityRecommendation(player, demand, severity, context) {
  const position = player.player_info.position;
  
  switch (severity) {
    case 'critical':
      return `STRONG RECOMMEND: Pick immediately - elite ${position} with extreme scarcity. Waiting is very high risk.`;
    case 'high':
      return `RECOMMEND: Consider picking now - top-tier ${position} with high competition. Risk increases significantly if you wait.`;
    case 'medium':
      return `CONSIDER: Quality ${position} in competitive market. Evaluate against other needs but don't wait too long.`;
    default:
      return `MONITOR: Keep on radar - position has competitive demand.`;
  }
}

/**
 * Generate draft strategy insights that explain overall draft approach
 * @param {Array} recommendations - Current recommendations
 * @param {Object} context - Optimization context with roster and league data
 * @returns {Object} Draft strategy insights
 */
export function generateDraftStrategyInsights(recommendations, context) {
  if (!recommendations || !context) {
    return {
      overallStrategy: 'Unable to determine strategy',
      insights: [],
      recommendations: [],
      rosterBalance: null
    };
  }

  const { currentRoster, rosterFormat, leagueAnalysis } = context;
  
  // Analyze current roster composition
  const rosterAnalysis = analyzeCurrentRosterComposition(currentRoster, rosterFormat);
  
  // Analyze league competition landscape
  const competitionAnalysis = analyzeLeagueCompetitionLandscape(leagueAnalysis);
  
  // Determine overall draft strategy
  const overallStrategy = determineOverallDraftStrategy(rosterAnalysis, competitionAnalysis, recommendations);
  
  // Generate specific insights
  const insights = generateSpecificStrategyInsights(rosterAnalysis, competitionAnalysis, recommendations, context);
  
  // Generate strategic recommendations
  const strategicRecommendations = generateStrategicRecommendations(rosterAnalysis, competitionAnalysis, context);

  return {
    overallStrategy,
    insights,
    recommendations: strategicRecommendations,
    rosterBalance: rosterAnalysis,
    competitionLandscape: competitionAnalysis,
    nextPhaseStrategy: determineNextPhaseStrategy(rosterAnalysis, competitionAnalysis, context)
  };
}

/**
 * Analyze current roster composition and needs
 * @param {Object} currentRoster - Current roster state
 * @param {Array} rosterFormat - League roster format
 * @returns {Object} Roster composition analysis
 */
function analyzeCurrentRosterComposition(currentRoster, rosterFormat) {
  if (!currentRoster || !rosterFormat) {
    return {
      completionPercentage: 0,
      criticalNeeds: [],
      strengths: [],
      weaknesses: [],
      phase: 'early'
    };
  }

  const positionCounts = currentRoster.positionCounts || {};
  const analysis = {
    positions: {},
    totalSlots: 0,
    filledSlots: 0,
    criticalNeeds: [],
    strengths: [],
    weaknesses: []
  };

  // Analyze each position
  rosterFormat.forEach(({ position, slots }) => {
    const current = positionCounts[position] || 0;
    const completionRate = current / slots;
    
    analysis.positions[position] = {
      required: slots,
      current,
      needed: Math.max(0, slots - current),
      completionRate,
      status: completionRate >= 1 ? 'complete' : completionRate >= 0.5 ? 'partial' : 'empty'
    };

    analysis.totalSlots += slots;
    analysis.filledSlots += current;

    // Categorize needs and strengths
    if (completionRate === 0 && position !== 'FLEX') {
      analysis.criticalNeeds.push(position);
    } else if (completionRate < 0.5 && slots >= 2) {
      analysis.weaknesses.push(position);
    } else if (completionRate >= 1) {
      analysis.strengths.push(position);
    }
  });

  // Determine draft phase
  const completionPercentage = analysis.filledSlots / analysis.totalSlots;
  let phase = 'early';
  if (completionPercentage >= 0.7) {
    phase = 'late';
  } else if (completionPercentage >= 0.4) {
    phase = 'middle';
  }

  return {
    ...analysis,
    completionPercentage,
    phase
  };
}

/**
 * Analyze league competition landscape
 * @param {Object} leagueAnalysis - League analysis data
 * @returns {Object} Competition landscape analysis
 */
function analyzeLeagueCompetitionLandscape(leagueAnalysis) {
  if (!leagueAnalysis?.positionDemand) {
    return {
      highCompetitionPositions: [],
      lowCompetitionPositions: [],
      scarcityAlerts: [],
      opportunityPositions: []
    };
  }

  const { positionDemand } = leagueAnalysis;
  const analysis = {
    highCompetitionPositions: [],
    lowCompetitionPositions: [],
    scarcityAlerts: [],
    opportunityPositions: []
  };

  Object.entries(positionDemand).forEach(([position, demand]) => {
    const competitionData = {
      position,
      competitionLevel: demand.competitionLevel,
      competitionScore: demand.competitionScore,
      managersNeed: demand.managersStillNeed,
      slotsRemaining: demand.slotsRemaining
    };

    if (demand.competitionLevel === 'very_high' || demand.competitionLevel === 'high') {
      analysis.highCompetitionPositions.push(competitionData);
      
      // Check for scarcity alerts
      if (demand.slotsRemaining <= demand.managersStillNeed * 0.7) {
        analysis.scarcityAlerts.push({
          ...competitionData,
          severity: demand.competitionLevel === 'very_high' ? 'critical' : 'high',
          message: `${position}: ${demand.managersStillNeed} managers competing for ${demand.slotsRemaining} remaining slots`
        });
      }
    } else if (demand.competitionLevel === 'low') {
      analysis.lowCompetitionPositions.push(competitionData);
      
      // Check for opportunity positions (low competition but still needed)
      if (demand.managersStillNeed >= 3) {
        analysis.opportunityPositions.push({
          ...competitionData,
          message: `${position}: Low competition with ${demand.managersStillNeed} managers still needing`
        });
      }
    }
  });

  return analysis;
}

/**
 * Determine overall draft strategy based on roster and competition analysis
 * @param {Object} rosterAnalysis - Roster composition analysis
 * @param {Object} competitionAnalysis - Competition landscape analysis
 * @param {Array} recommendations - Current recommendations
 * @returns {string} Overall draft strategy description
 */
function determineOverallDraftStrategy(rosterAnalysis, competitionAnalysis, recommendations) {
  const { phase, criticalNeeds, strengths, completionPercentage } = rosterAnalysis;
  const { highCompetitionPositions, scarcityAlerts } = competitionAnalysis;

  // Early draft phase strategies
  if (phase === 'early') {
    if (criticalNeeds.length >= 3) {
      return 'FOUNDATION_BUILDING: Focus on filling core positions with quality starters';
    } else if (scarcityAlerts.length >= 2) {
      return 'SCARCITY_AWARE: Target high-value players at scarce positions before competition intensifies';
    } else {
      return 'BEST_PLAYER_AVAILABLE: Select highest-value players while building roster foundation';
    }
  }
  
  // Middle draft phase strategies
  else if (phase === 'middle') {
    if (criticalNeeds.length >= 2) {
      return 'NEED_BASED: Prioritize filling remaining critical positions';
    } else if (highCompetitionPositions.length >= 2) {
      return 'COMPETITION_AWARE: Balance needs with competitive position targeting';
    } else {
      return 'VALUE_OPTIMIZATION: Focus on players who provide best value for remaining needs';
    }
  }
  
  // Late draft phase strategies
  else {
    if (criticalNeeds.length >= 1) {
      return 'COMPLETION_FOCUSED: Fill remaining roster requirements';
    } else if (strengths.length >= 2) {
      return 'DEPTH_BUILDING: Add quality depth and handcuff players';
    } else {
      return 'UPSIDE_HUNTING: Target high-upside players and sleepers';
    }
  }
}

/**
 * Generate specific strategy insights
 * @param {Object} rosterAnalysis - Roster analysis
 * @param {Object} competitionAnalysis - Competition analysis
 * @param {Array} recommendations - Current recommendations
 * @param {Object} context - Full optimization context
 * @returns {Array} Array of specific insights
 */
function generateSpecificStrategyInsights(rosterAnalysis, competitionAnalysis, recommendations, context) {
  const insights = [];
  const { phase, criticalNeeds, completionPercentage } = rosterAnalysis;
  const { scarcityAlerts, opportunityPositions } = competitionAnalysis;

  // Roster completion insights
  if (completionPercentage < 0.3) {
    insights.push({
      type: 'roster_foundation',
      priority: 'high',
      message: `Roster is ${(completionPercentage * 100).toFixed(0)}% complete - focus on core positions`,
      actionable: `Prioritize ${criticalNeeds.slice(0, 2).join(' and ')} positions`
    });
  } else if (completionPercentage > 0.8) {
    insights.push({
      type: 'roster_completion',
      priority: 'medium',
      message: `Roster is ${(completionPercentage * 100).toFixed(0)}% complete - focus on depth and upside`,
      actionable: 'Look for high-upside players and handcuffs'
    });
  }

  // Scarcity alerts
  scarcityAlerts.forEach(alert => {
    insights.push({
      type: 'scarcity_alert',
      priority: alert.severity === 'critical' ? 'critical' : 'high',
      message: alert.message,
      actionable: `Consider targeting ${alert.position} players before competition increases`
    });
  });

  // Opportunity insights
  opportunityPositions.forEach(opportunity => {
    insights.push({
      type: 'opportunity',
      priority: 'medium',
      message: opportunity.message,
      actionable: `${opportunity.position} may offer good value in later rounds`
    });
  });

  // Phase-specific insights
  if (phase === 'early' && recommendations.length > 0) {
    const topRecommendation = recommendations[0];
    const position = topRecommendation.player.player_info.position;
    insights.push({
      type: 'phase_strategy',
      priority: 'medium',
      message: `Early draft phase - building foundation`,
      actionable: `Top recommendation (${position}) aligns with foundation-building strategy`
    });
  }

  return insights.slice(0, 5); // Limit to top 5 insights
}

/**
 * Generate strategic recommendations for draft approach
 * @param {Object} rosterAnalysis - Roster analysis
 * @param {Object} competitionAnalysis - Competition analysis
 * @param {Object} context - Optimization context
 * @returns {Array} Array of strategic recommendations
 */
function generateStrategicRecommendations(rosterAnalysis, competitionAnalysis, context) {
  const recommendations = [];
  const { criticalNeeds, phase, strengths } = rosterAnalysis;
  const { highCompetitionPositions, scarcityAlerts } = competitionAnalysis;

  // Critical needs recommendations
  if (criticalNeeds.length > 0) {
    recommendations.push({
      type: 'critical_need',
      priority: 'high',
      title: 'Fill Critical Position Needs',
      description: `You still need: ${criticalNeeds.join(', ')}`,
      action: `Target ${criticalNeeds[0]} in next 1-2 picks`
    });
  }

  // Competition-based recommendations
  if (scarcityAlerts.length > 0) {
    const criticalAlert = scarcityAlerts.find(alert => alert.severity === 'critical');
    if (criticalAlert) {
      recommendations.push({
        type: 'scarcity_response',
        priority: 'critical',
        title: `Address ${criticalAlert.position} Scarcity`,
        description: criticalAlert.message,
        action: `Consider reaching for quality ${criticalAlert.position} before competition eliminates options`
      });
    }
  }

  // Phase-specific recommendations
  if (phase === 'middle' && strengths.length >= 1) {
    recommendations.push({
      type: 'balance_strategy',
      priority: 'medium',
      title: 'Balance Roster Construction',
      description: `Strong at: ${strengths.join(', ')}. Focus on remaining needs.`,
      action: 'Avoid over-drafting strong positions unless exceptional value'
    });
  }

  if (phase === 'late') {
    recommendations.push({
      type: 'endgame_strategy',
      priority: 'medium',
      title: 'Late Draft Strategy',
      description: 'Focus on upside players and handcuffs',
      action: 'Target players with breakout potential or injury insurance value'
    });
  }

  return recommendations.slice(0, 3); // Limit to top 3 strategic recommendations
}

/**
 * Determine next phase strategy
 * @param {Object} rosterAnalysis - Roster analysis
 * @param {Object} competitionAnalysis - Competition analysis
 * @param {Object} context - Optimization context
 * @returns {Object} Next phase strategy
 */
function determineNextPhaseStrategy(rosterAnalysis, competitionAnalysis, context) {
  const { phase, criticalNeeds, completionPercentage } = rosterAnalysis;
  const { picksUntilNext } = context;

  let nextPhase = phase;
  let strategy = '';
  let timeframe = '';

  if (phase === 'early' && completionPercentage >= 0.4) {
    nextPhase = 'middle';
    strategy = 'Transition to need-based drafting with value considerations';
    timeframe = `In next ${Math.ceil(picksUntilNext * 2)} picks`;
  } else if (phase === 'middle' && completionPercentage >= 0.7) {
    nextPhase = 'late';
    strategy = 'Shift focus to depth, upside, and handcuff players';
    timeframe = `In next ${Math.ceil(picksUntilNext * 1.5)} picks`;
  } else if (phase === 'late') {
    nextPhase = 'endgame';
    strategy = 'Target sleepers, handcuffs, and high-upside lottery tickets';
    timeframe = 'Remaining picks';
  }

  return {
    currentPhase: phase,
    nextPhase,
    strategy,
    timeframe,
    keyFocus: criticalNeeds.length > 0 ? `Fill ${criticalNeeds[0]} need` : 'Best available value'
  };
}