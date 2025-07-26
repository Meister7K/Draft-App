/**
 * Starting Lineup Impact Calculator
 * Calculates projected fantasy point improvement from adding a player to the roster
 * Handles positional replacement value analysis and FLEX eligibility
 */

/**
 * Calculate projected fantasy point improvement from adding a player
 * @param {Object} player - Player object with player_info
 * @param {Object} context - Context containing current roster, format, etc.
 * @returns {Object} Impact analysis with projected improvement
 */
export function calculateProjectedFantasyPointImprovement(player, context) {
  if (!player?.player_info || !context?.currentRoster || !context?.rosterFormat) {
    return {
      weeklyImprovement: 0,
      seasonImprovement: 0,
      explanation: "Missing required data for impact calculation",
      impactType: "none"
    };
  }

  const position = player.player_info.position;
  const projectedPoints = player.player_info.projected_2025_points || 0;
  const weeklyPoints = projectedPoints / 17; // Assuming 17-week season

  // Find the best insertion point for this player
  const insertionAnalysis = findBestInsertionPoint(player, context);
  
  if (!insertionAnalysis.canImprove) {
    return {
      weeklyImprovement: 0,
      seasonImprovement: 0,
      explanation: insertionAnalysis.explanation,
      impactType: "bench_depth"
    };
  }

  const weeklyImprovement = insertionAnalysis.pointsImprovement;
  const seasonImprovement = weeklyImprovement * 17;

  return {
    weeklyImprovement: Math.round(weeklyImprovement * 10) / 10,
    seasonImprovement: Math.round(seasonImprovement * 10) / 10,
    explanation: insertionAnalysis.explanation,
    impactType: insertionAnalysis.impactType,
    replacedPlayer: insertionAnalysis.replacedPlayer,
    insertionPosition: insertionAnalysis.insertionPosition
  };
}

/**
 * Find the best position to insert a player in the starting lineup
 * @param {Object} player - Player to insert
 * @param {Object} context - Context with roster and format
 * @returns {Object} Analysis of best insertion point
 */
function findBestInsertionPoint(player, context) {
  const position = player.player_info.position;
  const projectedPoints = player.player_info.projected_2025_points || 0;
  const { currentRoster, rosterFormat } = context;

  let bestImprovement = 0;
  let bestInsertionPoint = null;
  let bestReplacedPlayer = null;

  // Check direct position slots first
  const directPositionSlots = getPositionSlots(position, currentRoster, rosterFormat);
  const directAnalysis = analyzePositionInsertion(player, directPositionSlots, position);
  
  if (directAnalysis.improvement > bestImprovement) {
    bestImprovement = directAnalysis.improvement;
    bestInsertionPoint = { position, slotIndex: directAnalysis.slotIndex };
    bestReplacedPlayer = directAnalysis.replacedPlayer;
  }

  // Check FLEX slots for eligible positions (RB, WR, TE)
  if (["RB", "WR", "TE"].includes(position)) {
    const flexSlots = getPositionSlots("FLEX", currentRoster, rosterFormat);
    const flexAnalysis = analyzePositionInsertion(player, flexSlots, "FLEX");
    
    if (flexAnalysis.improvement > bestImprovement) {
      bestImprovement = flexAnalysis.improvement;
      bestInsertionPoint = { position: "FLEX", slotIndex: flexAnalysis.slotIndex };
      bestReplacedPlayer = flexAnalysis.replacedPlayer;
    }
  }

  // Determine impact type and explanation
  let impactType = "none";
  let explanation = "";

  if (bestImprovement > 0) {
    if (bestReplacedPlayer === null) {
      impactType = "fill_empty_slot";
      explanation = `Would fill empty ${bestInsertionPoint.position} slot with ${projectedPoints.toFixed(1)} projected points`;
    } else {
      impactType = "replace_starter";
      const replacedPoints = bestReplacedPlayer.player?.player_info?.projected_2025_points || 0;
      explanation = `Would replace ${bestReplacedPlayer.player?.player_info?.name || 'current starter'} (${replacedPoints.toFixed(1)} pts) in ${bestInsertionPoint.position} with ${bestImprovement.toFixed(1)} point improvement`;
    }
  } else {
    impactType = "bench_depth";
    explanation = `Would add bench depth with ${projectedPoints.toFixed(1)} projected points`;
  }

  return {
    canImprove: bestImprovement > 0,
    pointsImprovement: bestImprovement,
    explanation,
    impactType,
    replacedPlayer: bestReplacedPlayer,
    insertionPosition: bestInsertionPoint
  };
}

/**
 * Get current players in position slots
 * @param {string} position - Position to analyze
 * @param {Object} currentRoster - Current roster state
 * @param {Array} rosterFormat - Roster format configuration
 * @returns {Array} Array of current players in position slots
 */
function getPositionSlots(position, currentRoster, rosterFormat) {
  const positionConfig = rosterFormat.find(config => config.position === position);
  if (!positionConfig) return [];

  const starters = currentRoster.starters?.[position] || [];
  return starters.slice(0, positionConfig.slots);
}

/**
 * Analyze insertion into specific position slots
 * @param {Object} player - Player to insert
 * @param {Array} positionSlots - Current players in position slots
 * @param {string} position - Position being analyzed
 * @returns {Object} Analysis of insertion impact
 */
function analyzePositionInsertion(player, positionSlots, position) {
  const projectedPoints = player.player_info.projected_2025_points || 0;
  const weeklyPoints = projectedPoints / 17;

  let bestImprovement = 0;
  let bestSlotIndex = -1;
  let replacedPlayer = null;

  // Check each slot in the position
  positionSlots.forEach((currentPlayer, index) => {
    if (currentPlayer === null) {
      // Empty slot - direct improvement
      if (weeklyPoints > bestImprovement) {
        bestImprovement = weeklyPoints;
        bestSlotIndex = index;
        replacedPlayer = null;
      }
    } else {
      // Occupied slot - check if we can improve
      const currentPoints = currentPlayer.player?.player_info?.projected_2025_points || 0;
      const currentWeeklyPoints = currentPoints / 17;
      const improvement = weeklyPoints - currentWeeklyPoints;
      
      if (improvement > bestImprovement) {
        bestImprovement = improvement;
        bestSlotIndex = index;
        replacedPlayer = currentPlayer;
      }
    }
  });

  return {
    improvement: bestImprovement,
    slotIndex: bestSlotIndex,
    replacedPlayer
  };
}

/**
 * Analyze positional replacement value for bench vs starter decisions
 * @param {Object} player - Player to analyze
 * @param {Object} context - Context with roster and available players
 * @returns {Object} Replacement value analysis
 */
export function analyzePositionalReplacementValue(player, context) {
  if (!player?.player_info || !context?.currentRoster) {
    return {
      replacementValue: 0,
      isStarterWorthy: false,
      benchValue: 0,
      explanation: "Missing required data for replacement value analysis"
    };
  }

  const position = player.player_info.position;
  const projectedPoints = player.player_info.projected_2025_points || 0;
  
  // Calculate starter threshold for this position
  const starterThreshold = calculateStarterThreshold(position, context);
  
  // Calculate bench replacement value
  const benchReplacement = calculateBenchReplacementValue(position, context);
  
  const isStarterWorthy = projectedPoints > starterThreshold.points;
  const replacementValue = projectedPoints - benchReplacement.points;
  
  let explanation = "";
  if (isStarterWorthy) {
    explanation = `Above starter threshold (${starterThreshold.points.toFixed(1)} pts) with ${replacementValue.toFixed(1)} points above replacement`;
  } else {
    explanation = `Below starter threshold but ${replacementValue.toFixed(1)} points above bench replacement (${benchReplacement.points.toFixed(1)} pts)`;
  }

  return {
    replacementValue: Math.round(replacementValue * 10) / 10,
    isStarterWorthy,
    benchValue: Math.round((projectedPoints - benchReplacement.points) * 10) / 10,
    starterThreshold: starterThreshold.points,
    benchThreshold: benchReplacement.points,
    explanation
  };
}

/**
 * Calculate starter threshold for a position
 * @param {string} position - Position to analyze
 * @param {Object} context - Context with roster data
 * @returns {Object} Starter threshold analysis
 */
function calculateStarterThreshold(position, context) {
  const { currentRoster, rosterFormat } = context;
  
  // Get all current starters at this position (including FLEX for eligible positions)
  const directStarters = getPositionSlots(position, currentRoster, rosterFormat);
  let allStarters = [...directStarters];
  
  // Add FLEX starters if position is FLEX-eligible
  if (["RB", "WR", "TE"].includes(position)) {
    const flexStarters = getPositionSlots("FLEX", currentRoster, rosterFormat);
    const flexPlayersAtPosition = flexStarters.filter(starter => 
      starter?.player?.player_info?.position === position
    );
    allStarters = [...allStarters, ...flexPlayersAtPosition];
  }

  // Filter out null values and get projected points
  const starterPoints = allStarters
    .filter(starter => starter !== null)
    .map(starter => starter.player?.player_info?.projected_2025_points || 0)
    .sort((a, b) => b - a); // Sort descending

  // Calculate threshold as the lowest starter's points, or position average if no starters
  let thresholdPoints = 0;
  if (starterPoints.length > 0) {
    thresholdPoints = Math.min(...starterPoints);
  } else {
    // Use position-based default thresholds if no current starters
    const defaultThresholds = {
      QB: 250,
      RB: 180,
      WR: 160,
      TE: 120
    };
    thresholdPoints = defaultThresholds[position] || 100;
  }

  return {
    points: thresholdPoints,
    currentStarters: starterPoints.length,
    source: starterPoints.length > 0 ? "current_roster" : "position_default"
  };
}

/**
 * Calculate bench replacement value for a position
 * @param {string} position - Position to analyze
 * @param {Object} context - Context with available players
 * @returns {Object} Bench replacement value
 */
function calculateBenchReplacementValue(position, context) {
  // Use position-based replacement level values
  // These represent typical "replacement level" players available on waivers
  const replacementLevels = {
    QB: 180,  // Streaming QB level
    RB: 120,  // Handcuff/committee back level
    WR: 100,  // WR4/5 level
    TE: 80    // Streaming TE level
  };

  const replacementPoints = replacementLevels[position] || 80;

  return {
    points: replacementPoints,
    source: "position_replacement_level"
  };
}

/**
 * Optimize starting lineup considering FLEX eligibility
 * @param {Object} currentRoster - Current roster state
 * @param {Array} rosterFormat - Roster format configuration
 * @returns {Object} Optimized lineup analysis
 */
export function optimizeStartingLineupWithFlex(currentRoster, rosterFormat) {
  if (!currentRoster?.starters || !rosterFormat) {
    return {
      optimizedLineup: null,
      projectedPoints: 0,
      improvements: [],
      explanation: "Missing required data for lineup optimization"
    };
  }

  // Get all available players from roster
  const allPlayers = getAllRosterPlayers(currentRoster);
  
  // Create optimized lineup
  const optimizedLineup = createOptimizedLineup(allPlayers, rosterFormat);
  
  // Calculate improvements from current lineup
  const improvements = calculateLineupImprovements(currentRoster.starters, optimizedLineup, rosterFormat);
  
  // Calculate total projected points
  const projectedPoints = calculateLineupProjectedPoints(optimizedLineup);

  return {
    optimizedLineup,
    projectedPoints: Math.round(projectedPoints * 10) / 10,
    improvements,
    explanation: `Optimized lineup projects ${projectedPoints.toFixed(1)} weekly points with ${improvements.length} potential improvements`
  };
}

/**
 * Get all players from current roster (starters + bench)
 * @param {Object} currentRoster - Current roster state
 * @returns {Array} All players with their positions
 */
function getAllRosterPlayers(currentRoster) {
  const players = [];
  
  // Add starters
  if (currentRoster.starters) {
    Object.entries(currentRoster.starters).forEach(([position, starters]) => {
      if (Array.isArray(starters)) {
        starters.forEach(starter => {
          if (starter?.player?.player_info) {
            players.push({
              player: starter.player,
              currentPosition: position,
              isStarter: true
            });
          }
        });
      }
    });
  }
  
  // Add bench players
  if (currentRoster.bench && Array.isArray(currentRoster.bench)) {
    currentRoster.bench.forEach(benchPlayer => {
      if (benchPlayer?.player?.player_info) {
        players.push({
          player: benchPlayer.player,
          currentPosition: "BENCH",
          isStarter: false
        });
      }
    });
  }
  
  return players;
}

/**
 * Create optimized starting lineup from available players
 * @param {Array} allPlayers - All available players
 * @param {Array} rosterFormat - Roster format configuration
 * @returns {Object} Optimized starting lineup
 */
function createOptimizedLineup(allPlayers, rosterFormat) {
  const optimizedLineup = {};
  const usedPlayers = new Set();
  
  // Initialize lineup structure
  rosterFormat.forEach(({ position, slots }) => {
    optimizedLineup[position] = Array(slots).fill(null);
  });
  
  // Sort players by projected points (descending)
  const sortedPlayers = allPlayers
    .map(({ player }) => player)
    .sort((a, b) => (b.player_info?.projected_2025_points || 0) - (a.player_info?.projected_2025_points || 0));
  
  // Fill core positions first (QB, RB, WR, TE)
  const corePositions = ["QB", "RB", "WR", "TE"];
  corePositions.forEach(position => {
    if (optimizedLineup[position]) {
      const positionPlayers = sortedPlayers.filter(player => 
        player.player_info?.position === position && !usedPlayers.has(player.player_info.player_id)
      );
      
      for (let i = 0; i < optimizedLineup[position].length && i < positionPlayers.length; i++) {
        if (positionPlayers[i]) {
          optimizedLineup[position][i] = { player: positionPlayers[i] };
          usedPlayers.add(positionPlayers[i].player_info.player_id);
        }
      }
    }
  });
  
  // Fill FLEX positions with best remaining RB/WR/TE
  if (optimizedLineup.FLEX) {
    const flexEligiblePlayers = sortedPlayers.filter(player => 
      ["RB", "WR", "TE"].includes(player.player_info?.position) && 
      !usedPlayers.has(player.player_info.player_id)
    );
    
    for (let i = 0; i < optimizedLineup.FLEX.length && i < flexEligiblePlayers.length; i++) {
      if (flexEligiblePlayers[i]) {
        optimizedLineup.FLEX[i] = { player: flexEligiblePlayers[i] };
        usedPlayers.add(flexEligiblePlayers[i].player_info.player_id);
      }
    }
  }
  
  return optimizedLineup;
}

/**
 * Calculate improvements between current and optimized lineup
 * @param {Object} currentStarters - Current starting lineup
 * @param {Object} optimizedLineup - Optimized starting lineup
 * @param {Array} rosterFormat - Roster format configuration
 * @returns {Array} Array of potential improvements
 */
function calculateLineupImprovements(currentStarters, optimizedLineup, rosterFormat) {
  const improvements = [];
  
  rosterFormat.forEach(({ position, slots }) => {
    for (let i = 0; i < slots; i++) {
      const currentPlayer = currentStarters[position]?.[i];
      const optimizedPlayer = optimizedLineup[position]?.[i];
      
      if (optimizedPlayer && (!currentPlayer || 
          (optimizedPlayer.player.player_info?.projected_2025_points || 0) > 
          (currentPlayer.player?.player_info?.projected_2025_points || 0))) {
        
        const currentPoints = currentPlayer?.player?.player_info?.projected_2025_points || 0;
        const optimizedPoints = optimizedPlayer.player.player_info?.projected_2025_points || 0;
        const improvement = optimizedPoints - currentPoints;
        
        improvements.push({
          position,
          slotIndex: i,
          currentPlayer: currentPlayer?.player || null,
          suggestedPlayer: optimizedPlayer.player,
          weeklyImprovement: Math.round((improvement / 17) * 10) / 10,
          seasonImprovement: Math.round(improvement * 10) / 10
        });
      }
    }
  });
  
  return improvements.sort((a, b) => b.weeklyImprovement - a.weeklyImprovement);
}

/**
 * Calculate total projected points for a lineup
 * @param {Object} lineup - Starting lineup
 * @returns {number} Total weekly projected points
 */
function calculateLineupProjectedPoints(lineup) {
  let totalPoints = 0;
  
  Object.values(lineup).forEach(positionPlayers => {
    positionPlayers.forEach(player => {
      if (player?.player?.player_info?.projected_2025_points) {
        totalPoints += player.player.player_info.projected_2025_points / 17; // Weekly points
      }
    });
  });
  
  return totalPoints;
}

/**
 * Compare current lineup strength vs potential improvements
 * @param {Object} currentRoster - Current roster state
 * @param {Object} potentialPlayer - Player being considered
 * @param {Object} context - Context with roster format and other data
 * @returns {Object} Comparison analysis
 */
export function compareCurrentLineupStrength(currentRoster, potentialPlayer, context) {
  if (!currentRoster || !potentialPlayer?.player_info || !context?.rosterFormat) {
    return {
      currentStrength: 0,
      potentialStrength: 0,
      improvement: 0,
      recommendation: "insufficient_data",
      explanation: "Missing required data for lineup comparison"
    };
  }

  // Calculate current lineup strength
  const currentStrength = calculateLineupStrength(currentRoster, context.rosterFormat);
  
  // Create hypothetical roster with the potential player added
  const hypotheticalRoster = addPlayerToRoster(currentRoster, potentialPlayer, context);
  const potentialStrength = calculateLineupStrength(hypotheticalRoster, context.rosterFormat);
  
  const improvement = potentialStrength - currentStrength;
  
  // Generate recommendation based on improvement
  let recommendation = "hold";
  let explanation = "";
  
  if (improvement > 2.0) {
    recommendation = "strong_add";
    explanation = `Strong addition: Would improve lineup by ${improvement.toFixed(1)} points per week`;
  } else if (improvement > 0.5) {
    recommendation = "add";
    explanation = `Good addition: Would improve lineup by ${improvement.toFixed(1)} points per week`;
  } else if (improvement > 0) {
    recommendation = "marginal_add";
    explanation = `Marginal improvement: Would add ${improvement.toFixed(1)} points per week`;
  } else {
    recommendation = "hold";
    explanation = `No improvement: Current lineup is stronger by ${Math.abs(improvement).toFixed(1)} points per week`;
  }

  return {
    currentStrength: Math.round(currentStrength * 10) / 10,
    potentialStrength: Math.round(potentialStrength * 10) / 10,
    improvement: Math.round(improvement * 10) / 10,
    recommendation,
    explanation
  };
}

/**
 * Calculate overall lineup strength
 * @param {Object} roster - Roster to analyze
 * @param {Array} rosterFormat - Roster format configuration
 * @returns {number} Weekly projected points for starting lineup
 */
function calculateLineupStrength(roster, rosterFormat) {
  if (!roster?.starters) return 0;
  
  let totalPoints = 0;
  
  rosterFormat.forEach(({ position, slots }) => {
    const positionStarters = roster.starters[position] || [];
    for (let i = 0; i < slots; i++) {
      const starter = positionStarters[i];
      if (starter?.player?.player_info?.projected_2025_points) {
        totalPoints += starter.player.player_info.projected_2025_points / 17; // Weekly points
      }
    }
  });
  
  return totalPoints;
}

/**
 * Add a player to roster in optimal position
 * @param {Object} currentRoster - Current roster state
 * @param {Object} player - Player to add
 * @param {Object} context - Context with roster format
 * @returns {Object} New roster with player added
 */
function addPlayerToRoster(currentRoster, player, context) {
  // Create deep copy of current roster
  const newRoster = {
    starters: {},
    bench: [...(currentRoster.bench || [])],
    positionCounts: { ...(currentRoster.positionCounts || {}) }
  };
  
  // Deep copy starters
  Object.entries(currentRoster.starters || {}).forEach(([position, starters]) => {
    newRoster.starters[position] = [...starters];
  });
  
  // Find best insertion point
  const insertionAnalysis = findBestInsertionPoint(player, { ...context, currentRoster: newRoster });
  
  if (insertionAnalysis.canImprove && insertionAnalysis.insertionPosition) {
    const { position, slotIndex } = insertionAnalysis.insertionPosition;
    
    // If replacing a player, move them to bench
    const replacedPlayer = newRoster.starters[position][slotIndex];
    if (replacedPlayer) {
      newRoster.bench.push(replacedPlayer);
    }
    
    // Insert new player
    newRoster.starters[position][slotIndex] = { player };
    
    // Update position counts
    const playerPosition = player.player_info.position;
    newRoster.positionCounts[playerPosition] = (newRoster.positionCounts[playerPosition] || 0) + 1;
  } else {
    // Add to bench if can't improve starters
    newRoster.bench.push({ player });
    const playerPosition = player.player_info.position;
    newRoster.positionCounts[playerPosition] = (newRoster.positionCounts[playerPosition] || 0) + 1;
  }
  
  return newRoster;
}