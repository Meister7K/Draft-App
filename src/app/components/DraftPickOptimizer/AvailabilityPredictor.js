/**
 * Availability Prediction Engine for Draft Pick Optimizer
 * Predicts player availability based on competition, draft order, and manager needs
 */

/**
 * Calculate player availability probability based on competition and draft order
 * @param {Object} player - Player object with player_info
 * @param {Object} draftContext - Context containing draft state and competition data
 * @returns {Object} Availability probability and analysis
 */
export function calculatePlayerAvailability(player, draftContext) {
  if (!player?.player_info || !draftContext) {
    return {
      availabilityPercentage: 0,
      estimatedPickRange: { earliest: 999, latest: 999, mostLikely: 999 },
      riskLevel: 'unknown',
      explanation: 'Invalid player or draft context data'
    };
  }

  const {
    currentPickNumber,
    picksUntilNext,
    leagueAnalysis,
    targetingPrediction,
    draftOrder,
    totalManagers
  } = draftContext;

  const position = player.player_info.position;
  const overallRank = player.player_info.overall_rank || 999;
  const positionRank = player.player_info.position_rank || 999;

  // Calculate base draft expectation based on player rank
  const baseDraftPick = Math.max(1, Math.min(overallRank * 0.8, overallRank + 20));
  
  // Analyze competition pressure for this position
  const competitionFactor = calculateCompetitionPressure(position, leagueAnalysis, targetingPrediction);
  
  // Calculate pick range estimation
  const pickRange = estimatePickRange(player, draftContext, competitionFactor);
  
  // Calculate availability for user's next pick
  const userNextPick = currentPickNumber + picksUntilNext;
  const availabilityPercentage = calculateAvailabilityForPick(
    player, 
    userNextPick, 
    pickRange, 
    competitionFactor,
    draftContext
  );

  // Determine risk level
  const riskLevel = determineRiskLevel(availabilityPercentage, pickRange, userNextPick);

  // Generate explanation
  const explanation = generateAvailabilityExplanation(
    player,
    availabilityPercentage,
    pickRange,
    riskLevel,
    competitionFactor,
    draftContext
  );

  return {
    availabilityPercentage: Math.round(availabilityPercentage * 10) / 10,
    estimatedPickRange: pickRange,
    riskLevel,
    explanation,
    competitionFactor: Math.round(competitionFactor * 10) / 10
  };
}

/**
 * Estimate pick range where player is likely to be drafted
 * @param {Object} player - Player object
 * @param {Object} draftContext - Draft context data
 * @param {number} competitionFactor - Competition pressure multiplier
 * @returns {Object} Pick range estimation
 */
export function estimatePickRange(player, draftContext, competitionFactor) {
  const overallRank = player.player_info.overall_rank || 999;
  const position = player.player_info.position;
  const { totalManagers, currentPickNumber } = draftContext;

  // Base pick estimation from overall rank
  let basePick = overallRank;
  
  // Adjust for position scarcity
  const positionAdjustment = {
    QB: -2,  // QBs often go later than rank suggests
    RB: 5,   // RBs often go earlier due to scarcity
    WR: 0,   // WRs usually go close to rank
    TE: 5   // TEs often go earlier due to extreme scarcity
  };
  
  basePick += positionAdjustment[position] || 0;
  
  // Apply competition factor (higher competition = earlier pick)
  const competitionAdjustment = (competitionFactor - 1) * 15;
  basePick -= competitionAdjustment;
  
  // Calculate range with variance
  const variance = Math.max(8, Math.min(25, overallRank * 0.15));
  
  const earliest = Math.max(1, Math.floor(basePick - variance));
  const latest = Math.ceil(basePick + variance);
  const mostLikely = Math.round(basePick);

  // Ensure picks don't go before current pick
  const adjustedEarliest = Math.max(currentPickNumber + 1, earliest);
  const adjustedLatest = Math.max(adjustedEarliest + 5, latest);
  const adjustedMostLikely = Math.max(adjustedEarliest, Math.min(adjustedLatest, mostLikely));

  return {
    earliest: adjustedEarliest,
    latest: adjustedLatest,
    mostLikely: adjustedMostLikely
  };
}

/**
 * Calculate competition pressure factor for a position
 * @param {string} position - Player position
 * @param {Object} leagueAnalysis - League-wide needs analysis
 * @param {Object} targetingPrediction - Manager targeting predictions
 * @returns {number} Competition pressure multiplier (1.0 = normal, >1.0 = high pressure)
 */
function calculateCompetitionPressure(position, leagueAnalysis, targetingPrediction) {
  if (!leagueAnalysis?.positionDemand?.[position]) {
    // Default competition levels by position
    const defaultCompetition = { QB: 1.0, RB: 1.4, WR: 1.3, TE: 1.6 };
    return defaultCompetition[position] || 1.2;
  }

  const positionDemand = leagueAnalysis.positionDemand[position];
  const targeting = targetingPrediction?.positionTargeting?.[position];

  // Base competition from league-wide demand
  let competitionFactor = 1.0;
  
  // Adjust based on how many managers need this position
  const demandRatio = positionDemand.managersStillNeed / leagueAnalysis.totalManagers;
  competitionFactor += demandRatio * 0.6; // Up to +0.6 for universal need (reduced from 0.8)

  // Adjust based on slots remaining vs managers needing
  if (positionDemand.slotsRemaining > 0) {
    const scarcityRatio = positionDemand.managersStillNeed / positionDemand.slotsRemaining;
    competitionFactor += Math.min(0.4, scarcityRatio * 0.2); // Up to +0.4 for high scarcity (reduced)
  }

  // Adjust for immediate targeting pressure
  if (targeting?.managersLikelyToTarget > 0) {
    competitionFactor += targeting.managersLikelyToTarget * 0.1; // +0.1 per manager targeting (reduced)
  }

  // Cap the competition factor at reasonable levels
  return Math.min(2.5, Math.max(0.5, competitionFactor));
}

/**
 * Calculate availability percentage for a specific pick number
 * @param {Object} player - Player object
 * @param {number} pickNumber - Pick number to check availability for
 * @param {Object} pickRange - Estimated pick range for player
 * @param {number} competitionFactor - Competition pressure factor
 * @param {Object} draftContext - Draft context data
 * @returns {number} Availability percentage (0-100)
 */
function calculateAvailabilityForPick(player, pickNumber, pickRange, competitionFactor, draftContext) {
  const { earliest, latest, mostLikely } = pickRange;
  
  // If pick is before earliest expected, very high availability
  if (pickNumber < earliest) {
    return Math.min(95, 85 + (earliest - pickNumber) * 2);
  }
  
  // If pick is after latest expected, very low availability
  if (pickNumber > latest) {
    return Math.max(5, 25 - (pickNumber - latest) * 3);
  }
  
  // Calculate probability within the range using normal distribution approximation
  const rangeSize = latest - earliest;
  const pickPosition = (pickNumber - earliest) / rangeSize;
  const mostLikelyPosition = (mostLikely - earliest) / rangeSize;
  
  // Use a skewed normal distribution centered on mostLikely
  let availability;
  if (pickPosition <= mostLikelyPosition) {
    // Before most likely pick - higher availability
    const factor = 1 - (pickPosition / mostLikelyPosition) * 0.7;
    availability = 90 * factor;
  } else {
    // After most likely pick - lower availability
    const factor = (pickPosition - mostLikelyPosition) / (1 - mostLikelyPosition);
    availability = 90 * (1 - factor * 0.8);
  }
  
  // Adjust for competition factor
  availability = availability / competitionFactor;
  
  // Apply additional factors
  availability = applyAdditionalAvailabilityFactors(
    availability, 
    player, 
    pickNumber, 
    draftContext
  );
  
  return Math.max(1, Math.min(99, availability));
}

/**
 * Apply additional factors that affect availability
 * @param {number} baseAvailability - Base availability percentage
 * @param {Object} player - Player object
 * @param {number} pickNumber - Pick number being evaluated
 * @param {Object} draftContext - Draft context data
 * @returns {number} Adjusted availability percentage
 */
function applyAdditionalAvailabilityFactors(baseAvailability, player, pickNumber, draftContext) {
  let adjustedAvailability = baseAvailability;
  const position = player.player_info.position;
  const { targetingPrediction, currentPickNumber } = draftContext;
  
  // Check if managers in the next few picks are likely to target this position
  if (targetingPrediction?.nextFewPicks) {
    const picksUntilTarget = pickNumber - currentPickNumber;
    const relevantPicks = targetingPrediction.nextFewPicks.filter(
      pick => pick.pickNumber <= pickNumber && pick.pickNumber > currentPickNumber
    );
    
    const managersTargetingPosition = relevantPicks.filter(
      pick => pick.likelyTargets.includes(position) || pick.primaryTarget === position
    ).length;
    
    // Reduce availability based on managers likely to target this position
    if (managersTargetingPosition > 0) {
      const reductionFactor = 1 - (managersTargetingPosition * 0.25);
      adjustedAvailability *= Math.max(0.3, reductionFactor);
    }
  }
  
  // Adjust for position-specific factors
  if (position === 'TE' && player.player_info.position_rank <= 8) {
    // Top TEs are often reached for due to scarcity
    adjustedAvailability *= 0.8;
  } else if (position === 'QB' && player.player_info.position_rank <= 12) {
    // Top QBs can be reached for in certain draft strategies
    adjustedAvailability *= 0.9;
  }
  
  return adjustedAvailability;
}

/**
 * Determine risk level for waiting vs picking now
 * @param {number} availabilityPercentage - Availability percentage for next pick
 * @param {Object} pickRange - Estimated pick range
 * @param {number} userNextPick - User's next pick number
 * @returns {string} Risk level: 'low', 'medium', 'high', 'very_high'
 */
function determineRiskLevel(availabilityPercentage, pickRange, userNextPick) {
  // High availability = low risk of missing player
  if (availabilityPercentage >= 80) {
    return 'low';
  } else if (availabilityPercentage >= 60) {
    return 'medium';
  } else if (availabilityPercentage >= 35) {
    return 'high';
  } else {
    return 'very_high';
  }
}

/**
 * Generate human-readable explanation for availability analysis
 * @param {Object} player - Player object
 * @param {number} availabilityPercentage - Availability percentage
 * @param {Object} pickRange - Pick range estimation
 * @param {string} riskLevel - Risk level
 * @param {number} competitionFactor - Competition factor
 * @param {Object} draftContext - Draft context
 * @returns {string} Explanation text
 */
function generateAvailabilityExplanation(player, availabilityPercentage, pickRange, riskLevel, competitionFactor, draftContext) {
  const position = player.player_info.position;
  const overallRank = player.player_info.overall_rank || 999;
  const { picksUntilNext } = draftContext;
  
  let explanation = `${availabilityPercentage.toFixed(0)}% chance available in ${picksUntilNext} picks. `;
  
  // Add pick range context
  if (pickRange.earliest === pickRange.latest) {
    explanation += `Expected around pick ${pickRange.mostLikely}. `;
  } else {
    explanation += `Expected picks ${pickRange.earliest}-${pickRange.latest} (most likely ${pickRange.mostLikely}). `;
  }
  
  // Add competition context
  if (competitionFactor > 1.5) {
    explanation += `High ${position} competition increases urgency. `;
  } else if (competitionFactor > 1.2) {
    explanation += `Moderate ${position} competition. `;
  } else {
    explanation += `Low ${position} competition. `;
  }
  
  // Add risk-based recommendation
  switch (riskLevel) {
    case 'very_high':
      explanation += 'Strong recommend picking now - likely to be taken soon.';
      break;
    case 'high':
      explanation += 'Consider picking now - moderate risk of missing.';
      break;
    case 'medium':
      explanation += 'Could wait but monitor closely - some risk involved.';
      break;
    case 'low':
      explanation += 'Safe to wait - likely available later.';
      break;
    default:
      explanation += 'Availability uncertain.';
  }
  
  return explanation;
}

/**
 * Assess risk of waiting vs picking now for a specific player
 * @param {Object} player - Player object
 * @param {Object} draftContext - Draft context with user's future picks
 * @returns {Object} Risk assessment with recommendations
 */
export function assessWaitingRisk(player, draftContext) {
  if (!player?.player_info || !draftContext) {
    return {
      shouldWait: false,
      confidence: 0,
      reasoning: 'Invalid player or context data',
      riskFactors: [],
      alternatives: []
    };
  }

  const availability = calculatePlayerAvailability(player, draftContext);
  const { availabilityPercentage, riskLevel } = availability;
  const { picksUntilNext, userFuturePicks = [] } = draftContext;

  // Calculate availability for user's future picks
  const futureAvailability = userFuturePicks.slice(0, 3).map(futurePick => ({
    pickNumber: futurePick,
    availability: calculateAvailabilityForPick(
      player,
      futurePick,
      availability.estimatedPickRange,
      availability.competitionFactor,
      draftContext
    )
  }));

  // Determine recommendation
  let shouldWait = false;
  let confidence = 0;
  let reasoning = '';

  if (riskLevel === 'low' && availabilityPercentage >= 75) {
    shouldWait = true;
    confidence = Math.min(0.9, availabilityPercentage / 100);
    reasoning = `Low risk - ${availabilityPercentage.toFixed(0)}% chance available later. Consider filling other needs first.`;
  } else if (riskLevel === 'medium' && availabilityPercentage >= 55) {
    shouldWait = true;
    confidence = Math.min(0.7, (availabilityPercentage - 20) / 100);
    reasoning = `Moderate risk - ${availabilityPercentage.toFixed(0)}% chance available. Could wait if other positions more urgent.`;
  } else {
    shouldWait = false;
    confidence = Math.min(0.9, (100 - availabilityPercentage) / 100);
    reasoning = `High risk - only ${availabilityPercentage.toFixed(0)}% chance available later. Recommend picking now.`;
  }

  // Identify risk factors
  const riskFactors = identifyRiskFactors(player, draftContext, availability);

  return {
    shouldWait,
    confidence: Math.round(confidence * 100) / 100,
    reasoning,
    riskFactors,
    futureAvailability,
    currentAvailability: availabilityPercentage
  };
}

/**
 * Identify specific risk factors for a player
 * @param {Object} player - Player object
 * @param {Object} draftContext - Draft context
 * @param {Object} availability - Availability analysis
 * @returns {Array} Array of risk factor objects
 */
function identifyRiskFactors(player, draftContext, availability) {
  const riskFactors = [];
  const position = player.player_info.position;
  const { leagueAnalysis, targetingPrediction } = draftContext;

  // High demand position
  if (leagueAnalysis?.positionDemand?.[position]?.competitionLevel === 'very_high') {
    riskFactors.push({
      type: 'highDemandPosition',
      severity: 'high',
      description: `${position} is in very high demand across the league`
    });
  } else if (leagueAnalysis?.positionDemand?.[position]?.competitionLevel === 'high') {
    riskFactors.push({
      type: 'highDemandPosition',
      severity: 'medium',
      description: `${position} is in high demand across the league`
    });
  }

  // Multiple managers need position
  const managersNeed = leagueAnalysis?.positionDemand?.[position]?.managersStillNeed || 0;
  if (managersNeed >= 8) {
    riskFactors.push({
      type: 'multipleManagersNeed',
      severity: 'high',
      description: `${managersNeed} managers still need ${position}`
    });
  } else if (managersNeed >= 5) {
    riskFactors.push({
      type: 'multipleManagersNeed',
      severity: 'medium',
      description: `${managersNeed} managers still need ${position}`
    });
  }

  // Immediate targeting pressure
  const managersTargeting = targetingPrediction?.positionTargeting?.[position]?.managersLikelyToTarget || 0;
  if (managersTargeting >= 3) {
    riskFactors.push({
      type: 'immediateTargeting',
      severity: 'high',
      description: `${managersTargeting} managers likely to target ${position} in next few picks`
    });
  } else if (managersTargeting >= 2) {
    riskFactors.push({
      type: 'immediateTargeting',
      severity: 'medium',
      description: `${managersTargeting} managers likely to target ${position} soon`
    });
  }

  // Limited alternatives
  const positionRank = player.player_info.position_rank || 999;
  if (position === 'TE' && positionRank <= 6) {
    riskFactors.push({
      type: 'limitedAlternatives',
      severity: 'high',
      description: 'Elite TE with few quality alternatives available'
    });
  } else if (position === 'QB' && positionRank <= 8) {
    riskFactors.push({
      type: 'limitedAlternatives',
      severity: 'medium',
      description: 'Top-tier QB with limited elite alternatives'
    });
  }

  // Early round value in later rounds
  const overallRank = player.player_info.overall_rank || 999;
  const { currentPickNumber } = draftContext;
  if (overallRank < currentPickNumber - 30) {
    riskFactors.push({
      type: 'earlyRoundValue',
      severity: 'medium',
      description: 'Player has early-round value but available in later round'
    });
  }

  return riskFactors;
}

/**
 * Project availability for remaining picks and manager needs
 * @param {Array} availablePlayers - Array of available players
 * @param {Object} draftContext - Draft context with league analysis
 * @returns {Object} Availability projections for all players
 */
export function projectPlayerAvailability(availablePlayers, draftContext) {
  if (!availablePlayers || !draftContext) {
    return {
      projections: {},
      summary: {
        totalPlayers: 0,
        highRiskPlayers: 0,
        safeWaitPlayers: 0
      },
      error: 'Invalid players or context data'
    };
  }

  const projections = {};
  let highRiskCount = 0;
  let safeWaitCount = 0;

  availablePlayers.forEach(player => {
    if (!player?.player_info?.player_id) return;

    const playerId = player.player_info.player_id;
    const availability = calculatePlayerAvailability(player, draftContext);
    const waitingRisk = assessWaitingRisk(player, draftContext);

    projections[playerId] = {
      ...availability,
      waitingRisk,
      lastUpdated: new Date().toISOString()
    };

    // Update summary counts
    if (availability.riskLevel === 'very_high' || availability.riskLevel === 'high') {
      highRiskCount++;
    } else if (availability.riskLevel === 'low') {
      safeWaitCount++;
    }
  });

  return {
    projections,
    summary: {
      totalPlayers: availablePlayers.length,
      highRiskPlayers: highRiskCount,
      safeWaitPlayers: safeWaitCount,
      mediumRiskPlayers: availablePlayers.length - highRiskCount - safeWaitCount
    },
    lastUpdated: new Date().toISOString()
  };
}