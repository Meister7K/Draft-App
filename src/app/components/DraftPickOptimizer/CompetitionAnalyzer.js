/**
 * Competition Analysis System for Draft Pick Optimizer
 * Analyzes league-wide roster needs and competition levels for positions
 */

/**
 * Analyze league-wide roster needs to identify all managers' position requirements
 * @param {Array} leagueUsers - All league members
 * @param {Array} draftPicks - All draft picks made so far
 * @param {Array} rosterFormat - League roster format requirements
 * @returns {Object} League-wide needs analysis
 */
export function analyzeLeagueNeeds(leagueUsers, draftPicks, rosterFormat) {
  if (!leagueUsers || !draftPicks || !rosterFormat) {
    return {
      managerNeeds: {},
      positionDemand: {},
      totalManagers: 0,
      error: "Missing required data for league analysis"
    };
  }

  const managerNeeds = {};
  const positionTotals = {};

  // Initialize position requirements from roster format
  const positionRequirements = rosterFormat.reduce((acc, format) => {
    acc[format.position] = format.slots;
    return acc;
  }, {});

  // Core position requirements (non-FLEX)
  const coreRequirements = {
    QB: positionRequirements.QB || 1,
    RB: positionRequirements.RB || 2,
    WR: positionRequirements.WR || 2,
    TE: positionRequirements.TE || 1
  };

  // Analyze each manager's current roster and needs
  leagueUsers.forEach(manager => {
    const managerId = manager.user_id;
    const managerPicks = draftPicks.filter(pick => pick.picked_by === managerId);
    
    // Count current positions for this manager
    const positionCounts = {};
    managerPicks.forEach(pick => {
      const position = pick.metadata?.position;
      if (position) {
        positionCounts[position] = (positionCounts[position] || 0) + 1;
      }
    });

    // Calculate needs for each position
    const needs = {};
    Object.keys(positionRequirements).forEach(position => {
      const required = positionRequirements[position];
      const current = positionCounts[position] || 0;
      const needed = Math.max(0, required - current);
      
      // Calculate urgency based on how much of the requirement is unfilled
      let urgency = 'none';
      if (needed > 0) {
        const percentageNeeded = needed / required;
        if (percentageNeeded >= 0.5) {
          urgency = 'high';
        } else if (percentageNeeded > 0) {
          urgency = 'medium';
        }
      }

      needs[position] = {
        required,
        current,
        needed,
        urgency,
        likelyToTarget: needed > 0 && (position !== 'FLEX' || needed >= 2)
      };

      // Track totals for position demand calculation
      if (!positionTotals[position]) {
        positionTotals[position] = {
          totalSlots: 0,
          slotsFilled: 0,
          managersNeed: 0
        };
      }
      positionTotals[position].totalSlots += required;
      positionTotals[position].slotsFilled += current;
      if (needed > 0) {
        positionTotals[position].managersNeed += 1;
      }
    });

    managerNeeds[managerId] = needs;
  });

  // Calculate position demand and competition levels
  const positionDemand = {};
  Object.keys(positionTotals).forEach(position => {
    const totals = positionTotals[position];
    const slotsRemaining = totals.totalSlots - totals.slotsFilled;
    const competitionRatio = totals.managersNeed / leagueUsers.length;
    
    // Determine competition level based on managers needing position and slots remaining
    let competitionLevel = 'low';
    let competitionScore = 0;

    if (competitionRatio >= 0.7) {
      competitionLevel = 'very_high';
      competitionScore = 85 + (competitionRatio - 0.7) * 50; // 85-100
    } else if (competitionRatio >= 0.5) {
      competitionLevel = 'high';
      competitionScore = 65 + (competitionRatio - 0.5) * 100; // 65-85
    } else if (competitionRatio >= 0.3) {
      competitionLevel = 'medium';
      competitionScore = 40 + (competitionRatio - 0.3) * 125; // 40-65
    } else {
      competitionLevel = 'low';
      competitionScore = competitionRatio * 133; // 0-40
    }

    // Adjust for position scarcity (fewer total slots = higher competition)
    const scarcityMultiplier = position === 'QB' || position === 'TE' ? 1.1 : 1.0;
    competitionScore = Math.min(100, competitionScore * scarcityMultiplier);

    positionDemand[position] = {
      totalSlotsNeeded: totals.totalSlots,
      slotsFilled: totals.slotsFilled,
      slotsRemaining,
      managersStillNeed: totals.managersNeed,
      competitionLevel,
      competitionScore: Math.round(competitionScore * 10) / 10
    };
  });

  return {
    managerNeeds,
    positionDemand,
    totalManagers: leagueUsers.length,
    analysisTimestamp: new Date().toISOString()
  };
}

/**
 * Calculate position demand and competition levels
 * @param {Object} leagueAnalysis - Result from analyzeLeagueNeeds
 * @param {string} position - Position to analyze
 * @returns {Object} Position demand analysis
 */
export function calculatePositionDemand(leagueAnalysis, position) {
  if (!leagueAnalysis?.positionDemand?.[position]) {
    return {
      competitionScore: 50,
      competitionLevel: 'medium',
      managersNeed: 0,
      explanation: 'Unable to analyze position demand - missing data'
    };
  }

  const demand = leagueAnalysis.positionDemand[position];
  
  let explanation = `${demand.managersStillNeed} of ${leagueAnalysis.totalManagers} managers need ${position}`;
  
  if (demand.competitionLevel === 'very_high') {
    explanation += ` - extremely high competition with ${demand.slotsRemaining} slots remaining`;
  } else if (demand.competitionLevel === 'high') {
    explanation += ` - high competition for remaining ${demand.slotsRemaining} slots`;
  } else if (demand.competitionLevel === 'medium') {
    explanation += ` - moderate competition with ${demand.slotsRemaining} slots available`;
  } else {
    explanation += ` - low competition, ${demand.slotsRemaining} slots still needed`;
  }

  return {
    competitionScore: demand.competitionScore,
    competitionLevel: demand.competitionLevel,
    managersNeed: demand.managersStillNeed,
    slotsRemaining: demand.slotsRemaining,
    explanation
  };
}

/**
 * Predict which managers are likely to target specific positions based on roster gaps and draft position
 * @param {Object} leagueAnalysis - Result from analyzeLeagueNeeds
 * @param {Array} draftOrder - Current draft order with pick positions
 * @param {number} currentPickNumber - Current overall pick number
 * @param {number} lookAheadPicks - Number of picks to analyze ahead
 * @returns {Object} Manager targeting predictions
 */
export function predictManagerTargeting(leagueAnalysis, draftOrder, currentPickNumber, lookAheadPicks = 10) {
  if (!leagueAnalysis?.managerNeeds || !draftOrder) {
    return {
      nextFewPicks: [],
      positionTargeting: {},
      error: "Missing data for targeting prediction"
    };
  }

  const nextFewPicks = [];
  const positionTargeting = {};

  // Analyze the next several picks
  for (let i = 1; i <= lookAheadPicks; i++) {
    const pickNumber = currentPickNumber + i;
    const pickIndex = (pickNumber - 1) % draftOrder.length;
    const managerId = draftOrder[pickIndex]?.user_id;
    
    if (!managerId || !leagueAnalysis.managerNeeds[managerId]) {
      continue;
    }

    const managerNeeds = leagueAnalysis.managerNeeds[managerId];
    
    // Find the most urgent needs for this manager
    const urgentNeeds = [];
    const moderateNeeds = [];
    
    Object.keys(managerNeeds).forEach(position => {
      const need = managerNeeds[position];
      if (need.urgency === 'high' && need.needed > 0) {
        urgentNeeds.push({ position, ...need });
      } else if (need.urgency === 'medium' && need.needed > 0) {
        moderateNeeds.push({ position, ...need });
      }
    });

    // Predict most likely targets (prioritize urgent needs)
    const likelyTargets = urgentNeeds.length > 0 ? urgentNeeds : moderateNeeds;
    const primaryTarget = likelyTargets.length > 0 ? likelyTargets[0].position : null;

    nextFewPicks.push({
      pickNumber,
      managerId,
      urgentNeeds: urgentNeeds.map(need => need.position),
      moderateNeeds: moderateNeeds.map(need => need.position),
      primaryTarget,
      likelyTargets: likelyTargets.map(need => need.position)
    });

    // Track position targeting frequency
    likelyTargets.forEach(need => {
      if (!positionTargeting[need.position]) {
        positionTargeting[need.position] = {
          managersLikelyToTarget: 0,
          pickNumbers: [],
          urgencyLevel: 'medium'
        };
      }
      positionTargeting[need.position].managersLikelyToTarget += 1;
      positionTargeting[need.position].pickNumbers.push(pickNumber);
      
      // Update urgency level based on most urgent need
      if (need.urgency === 'high') {
        positionTargeting[need.position].urgencyLevel = 'high';
      }
    });
  }

  return {
    nextFewPicks,
    positionTargeting,
    analysisRange: {
      startPick: currentPickNumber + 1,
      endPick: currentPickNumber + lookAheadPicks
    }
  };
}

/**
 * Calculate urgency scores for different positions across all managers
 * @param {Object} leagueAnalysis - Result from analyzeLeagueNeeds
 * @param {Object} targetingPrediction - Result from predictManagerTargeting
 * @returns {Object} Position urgency scores
 */
export function calculatePositionUrgencyScores(leagueAnalysis, targetingPrediction) {
  if (!leagueAnalysis?.positionDemand || !targetingPrediction?.positionTargeting) {
    return {
      urgencyScores: {},
      error: "Missing data for urgency calculation"
    };
  }

  const urgencyScores = {};

  Object.keys(leagueAnalysis.positionDemand).forEach(position => {
    const demand = leagueAnalysis.positionDemand[position];
    const targeting = targetingPrediction.positionTargeting[position] || {
      managersLikelyToTarget: 0,
      urgencyLevel: 'low'
    };

    // Base urgency from competition level
    let baseUrgency = 0;
    switch (demand.competitionLevel) {
      case 'very_high':
        baseUrgency = 80;
        break;
      case 'high':
        baseUrgency = 65;
        break;
      case 'medium':
        baseUrgency = 40;
        break;
      case 'low':
        baseUrgency = 20;
        break;
      default:
        baseUrgency = 30;
    }

    // Adjust for immediate targeting pressure
    const targetingMultiplier = targeting.managersLikelyToTarget > 0 ? 
      1 + (targeting.managersLikelyToTarget * 0.15) : 1;

    // Adjust for urgency level of managers who need this position
    const urgencyMultiplier = targeting.urgencyLevel === 'high' ? 1.2 : 1.0;

    // Calculate final urgency score
    const urgencyScore = Math.min(100, baseUrgency * targetingMultiplier * urgencyMultiplier);

    // Generate explanation
    let explanation = `${demand.competitionLevel} competition (${demand.managersStillNeed} managers need)`;
    if (targeting.managersLikelyToTarget > 0) {
      explanation += `, ${targeting.managersLikelyToTarget} likely to target in next picks`;
    }
    if (targeting.urgencyLevel === 'high') {
      explanation += `, high urgency needs detected`;
    }

    urgencyScores[position] = {
      score: Math.round(urgencyScore * 10) / 10,
      competitionLevel: demand.competitionLevel,
      managersNeed: demand.managersStillNeed,
      managersTargeting: targeting.managersLikelyToTarget,
      urgencyLevel: targeting.urgencyLevel,
      explanation
    };
  });

  return {
    urgencyScores,
    analysisTimestamp: new Date().toISOString()
  };
}

/**
 * Enhanced competition score calculation that uses actual league analysis
 * This replaces the placeholder function in OptimizationEngine.js
 * @param {Object} player - Player object
 * @param {Object} context - Context with league analysis data
 * @returns {Object} Enhanced competition score and explanation
 */
export function calculateEnhancedCompetitionScore(player, context) {
  const position = player.player_info.position;
  const { leagueAnalysis, targetingPrediction, urgencyScores } = context;

  // Fallback to basic scoring if enhanced data is not available
  if (!leagueAnalysis || !urgencyScores) {
    const basicScores = { QB: 40, RB: 80, WR: 75, TE: 85 };
    const score = basicScores[position] || 50;
    return {
      score,
      explanation: `${position} position has ${score > 70 ? 'high' : score > 50 ? 'moderate' : 'low'} competition (basic analysis)`
    };
  }

  // Use enhanced analysis if available
  const positionDemand = leagueAnalysis.positionDemand[position];
  const urgencyData = urgencyScores.urgencyScores[position];

  if (!positionDemand || !urgencyData) {
    return {
      score: 50,
      explanation: `Unable to analyze competition for ${position} - insufficient data`
    };
  }

  // Competition score is based on the urgency score which factors in:
  // - Competition level (how many managers need this position)
  // - Immediate targeting pressure (managers likely to pick this position soon)
  // - Urgency level (how desperately managers need this position)
  const competitionScore = urgencyData.score;

  return {
    score: competitionScore,
    explanation: urgencyData.explanation
  };
}