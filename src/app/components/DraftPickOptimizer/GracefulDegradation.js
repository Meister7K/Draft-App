/**
 * GracefulDegradation - Handles missing or invalid player data gracefully
 * Provides data validation, sanitization, and fallback values
 * Ensures the optimizer can function even with incomplete data
 */

/**
 * Default values for missing player data
 */
const DEFAULT_PLAYER_VALUES = {
  player_id: null,
  name: 'Unknown Player',
  position: 'UNKNOWN',
  team: 'FA',
  projected_2025_points: 0,
  overall_rank: 999,
  position_rank: 99,
  adp: 999,
  bye_week: 0,
  injury_status: 'healthy'
};

/**
 * Required fields for basic optimization functionality
 */
const REQUIRED_FIELDS = {
  player_info: ['player_id', 'name', 'position'],
  optimization: ['projected_2025_points']
};

/**
 * Validate and sanitize player data
 */
export function validateAndSanitizePlayer(player, options = {}) {
  const { strict = false, fillDefaults = true } = options;
  
  if (!player || typeof player !== 'object') {
    if (strict) return null;
    return fillDefaults ? createDefaultPlayer() : null;
  }

  // Ensure player_info exists
  if (!player.player_info || typeof player.player_info !== 'object') {
    if (strict) return null;
    player.player_info = {};
  }

  const playerInfo = player.player_info;
  const sanitized = { ...player };

  // Validate and sanitize required fields
  for (const field of REQUIRED_FIELDS.player_info) {
    if (!playerInfo[field] || typeof playerInfo[field] !== 'string' || playerInfo[field].trim() === '') {
      if (strict) return null;
      if (fillDefaults) {
        playerInfo[field] = DEFAULT_PLAYER_VALUES[field] || `unknown_${field}`;
      }
    }
  }

  // Sanitize numeric fields
  const numericFields = ['projected_2025_points', 'overall_rank', 'position_rank', 'adp', 'bye_week'];
  numericFields.forEach(field => {
    const value = playerInfo[field];
    if (value === null || value === undefined || isNaN(Number(value))) {
      if (fillDefaults) {
        playerInfo[field] = DEFAULT_PLAYER_VALUES[field] || 0;
      }
    } else {
      playerInfo[field] = Number(value);
    }
  });

  // Validate position
  const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'FLEX'];
  if (!validPositions.includes(playerInfo.position)) {
    if (strict) return null;
    if (fillDefaults) {
      playerInfo.position = 'UNKNOWN';
    }
  }

  // Ensure player_id is unique and valid
  if (!playerInfo.player_id) {
    if (strict) return null;
    if (fillDefaults) {
      playerInfo.player_id = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  sanitized.player_info = playerInfo;
  return sanitized;
}

/**
 * Create a default player object
 */
function createDefaultPlayer() {
  return {
    player_info: { ...DEFAULT_PLAYER_VALUES }
  };
}

/**
 * Validate and sanitize an array of players
 */
export function validatePlayerArray(players, options = {}) {
  const { maxPlayers = 1000, minPlayers = 0 } = options;
  
  if (!Array.isArray(players)) {
    console.warn('Player data is not an array, returning empty array');
    return [];
  }

  const validPlayers = [];
  const invalidPlayers = [];

  for (let i = 0; i < Math.min(players.length, maxPlayers); i++) {
    const player = players[i];
    
    // Skip null/undefined players
    if (!player) {
      invalidPlayers.push({ index: i, player, reason: 'Null or undefined player' });
      continue;
    }
    
    const sanitized = validateAndSanitizePlayer(player, options);
    
    if (sanitized) {
      validPlayers.push(sanitized);
    } else {
      invalidPlayers.push({ index: i, player, reason: 'Failed validation' });
    }
  }

  // Log validation results in development
  if (process.env.NODE_ENV === 'development' && invalidPlayers.length > 0) {
    console.warn(`Player validation: ${validPlayers.length} valid, ${invalidPlayers.length} invalid players`);
  }

  // Ensure minimum number of players
  if (validPlayers.length < minPlayers) {
    console.warn(`Only ${validPlayers.length} valid players found, minimum required: ${minPlayers}`);
  }

  return validPlayers;
}

/**
 * Validate draft context data
 */
export function validateDraftContext(context) {
  const sanitized = { ...context };
  const issues = [];

  // Validate current roster
  if (!context.currentRoster || typeof context.currentRoster !== 'object') {
    sanitized.currentRoster = { starters: {}, bench: [], positionCounts: {} };
    issues.push('Missing or invalid currentRoster');
  }

  // Validate roster format
  if (!Array.isArray(context.rosterFormat)) {
    sanitized.rosterFormat = [
      { position: 'QB', slots: 1 },
      { position: 'RB', slots: 2 },
      { position: 'WR', slots: 2 },
      { position: 'TE', slots: 1 },
      { position: 'FLEX', slots: 1 },
      { position: 'K', slots: 1 },
      { position: 'DST', slots: 1 }
    ];
    issues.push('Missing or invalid rosterFormat, using default');
  }

  // Validate league users
  if (!Array.isArray(context.leagueUsers)) {
    sanitized.leagueUsers = [];
    issues.push('Missing or invalid leagueUsers');
  }

  // Validate draft picks
  if (!Array.isArray(context.memberPicks)) {
    sanitized.memberPicks = [];
    issues.push('Missing or invalid memberPicks');
  }

  // Validate drafted player IDs
  if (!context.draftedPlayerIds || typeof context.draftedPlayerIds.has !== 'function') {
    sanitized.draftedPlayerIds = new Set();
    issues.push('Missing or invalid draftedPlayerIds');
  }

  // Validate numeric fields
  const numericFields = ['currentPickNumber', 'picksUntilNext'];
  numericFields.forEach(field => {
    if (typeof context[field] !== 'number' || isNaN(context[field])) {
      sanitized[field] = 0;
      issues.push(`Invalid ${field}, defaulting to 0`);
    }
  });

  // Log issues in development
  if (process.env.NODE_ENV === 'development' && issues.length > 0) {
    console.warn('Draft context validation issues:', issues);
  }

  return {
    context: sanitized,
    issues,
    isValid: issues.length === 0
  };
}

/**
 * Create fallback optimization factors when calculations fail
 */
export function createFallbackOptimizationFactors(player, context = {}) {
  const position = player?.player_info?.position || 'UNKNOWN';
  const projectedPoints = player?.player_info?.projected_2025_points || 0;
  const overallRank = player?.player_info?.overall_rank || 999;

  return {
    rosterNeed: {
      score: 50, // Neutral score
      explanation: `Position need analysis unavailable for ${position}`
    },
    playerValue: {
      score: Math.max(0, Math.min(100, 100 - (overallRank / 10))),
      explanation: `Ranked #${overallRank} overall with ${projectedPoints} projected points`
    },
    competition: {
      score: 50, // Neutral score
      explanation: "Competition analysis unavailable - using fallback scoring"
    },
    availability: {
      score: 50, // Neutral score
      explanation: "Availability projection unavailable - consider current value"
    },
    startingLineupImpact: {
      score: Math.min(100, (projectedPoints / 300) * 100),
      explanation: `Projected ${projectedPoints} fantasy points for starting lineup`
    }
  };
}

/**
 * Handle missing calculation functions gracefully
 */
export function createSafeCalculationWrapper(calculationFunction, fallbackFunction, functionName) {
  return function safeCalculation(...args) {
    try {
      // Validate arguments
      if (args.some(arg => arg === null || arg === undefined)) {
        console.warn(`${functionName}: Some arguments are null/undefined, using fallback`);
        return fallbackFunction ? fallbackFunction(...args) : null;
      }

      const result = calculationFunction(...args);
      
      // Validate result
      if (result === null || result === undefined) {
        console.warn(`${functionName}: Calculation returned null/undefined, using fallback`);
        return fallbackFunction ? fallbackFunction(...args) : null;
      }

      return result;
    } catch (error) {
      console.error(`${functionName}: Calculation failed:`, error);
      
      if (fallbackFunction) {
        try {
          return fallbackFunction(...args);
        } catch (fallbackError) {
          console.error(`${functionName}: Fallback also failed:`, fallbackError);
          return null;
        }
      }
      
      return null;
    }
  };
}

/**
 * Validate and sanitize optimization results
 */
export function validateOptimizationResults(results) {
  if (!results || typeof results !== 'object') {
    return {
      recommendations: [],
      competitionData: null,
      availabilityProjections: null,
      rosterNeedsAnalysis: null,
      lastUpdated: new Date(),
      errors: ['Invalid optimization results']
    };
  }

  const sanitized = { ...results };
  const errors = [];

  // Validate recommendations array
  if (!Array.isArray(results.recommendations)) {
    sanitized.recommendations = [];
    errors.push('Invalid recommendations array');
  } else {
    // Validate each recommendation
    sanitized.recommendations = results.recommendations
      .filter(rec => rec && typeof rec === 'object' && rec.playerId)
      .map(rec => ({
        playerId: rec.playerId,
        player: rec.player || { name: 'Unknown', position: 'UNKNOWN' },
        optimization: rec.optimization || { score: 0, rank: 1, factors: {} },
        recommendation: rec.recommendation || { action: 'EVALUATE', reasoning: 'No reasoning available' }
      }));
  }

  // Ensure we have a timestamp
  if (!results.lastUpdated || !(results.lastUpdated instanceof Date)) {
    sanitized.lastUpdated = new Date();
  }

  // Add error information
  sanitized.errors = errors;
  sanitized.hasErrors = errors.length > 0;

  return sanitized;
}

/**
 * Create a degraded optimization context when full context is unavailable
 */
export function createDegradedContext(partialContext = {}) {
  return {
    currentRoster: partialContext.currentRoster || { starters: {}, bench: [], positionCounts: {} },
    rosterFormat: partialContext.rosterFormat || [
      { position: 'QB', slots: 1 },
      { position: 'RB', slots: 2 },
      { position: 'WR', slots: 2 },
      { position: 'TE', slots: 1 }
    ],
    leagueUsers: partialContext.leagueUsers || [],
    memberPicks: partialContext.memberPicks || [],
    draftedPlayerIds: partialContext.draftedPlayerIds || new Set(),
    currentPickNumber: partialContext.currentPickNumber || 1,
    picksUntilNext: partialContext.picksUntilNext || 0,
    calculateCompositeValue: partialContext.calculateCompositeValue || (() => 0),
    degraded: true,
    degradationReasons: [
      'Using simplified optimization context',
      'Some features may be limited'
    ]
  };
}

/**
 * Check if the system can provide meaningful recommendations
 */
export function canProvideRecommendations(players, context) {
  // Use less strict validation during active drafts to include more players
  const validPlayers = validatePlayerArray(players, { strict: false, fillDefaults: true });
  const { isValid } = validateDraftContext(context);
  
  const hasMinimumData = validPlayers.length > 0;
  const hasBasicContext = isValid || context.degraded;
  
  return {
    canRecommend: hasMinimumData && hasBasicContext,
    playerCount: validPlayers.length,
    contextValid: isValid,
    reasons: [
      ...(validPlayers.length === 0 ? ['No valid players available'] : []),
      ...(!hasBasicContext ? ['Invalid optimization context'] : [])
    ]
  };
}