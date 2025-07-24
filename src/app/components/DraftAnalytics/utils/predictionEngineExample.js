/**
 * Prediction Engine Usage Example
 * Demonstrates how to use the prediction engine in a real application
 */

import {
  extractDraftHistoryByManager,
  enhancePicksWithPlayerData
} from './historicalDataParser.js';

import {
  generatePredictionRanking,
  filterAvailablePlayers,
  validatePredictionInputs
} from './predictionEngine.js';

/**
 * Example: Generate predictions for a manager's next draft pick
 * @param {Object} database - Complete fantasy football database
 * @param {string} managerId - Manager ID to predict for
 * @param {number} draftPosition - Current draft position (1-based)
 * @param {Array} currentDraftPicks - Already drafted players in current draft
 * @param {Object} leagueSettings - League configuration
 * @returns {Array} Ranked predictions with confidence scores
 */
export function generateManagerPredictions(database, managerId, draftPosition, currentDraftPicks = [], leagueSettings = {}) {
  // Step 1: Validate inputs
  const validation = validatePredictionInputs({
    managerId,
    draftPosition,
    availablePlayers: database.players || [],
    historicalData: { picks: [] }
  });

  if (!validation.isValid) {
    throw new Error(`Invalid inputs: ${validation.errors.join(', ')}`);
  }

  // Step 2: Extract manager's historical draft data
  const allManagerHistory = extractDraftHistoryByManager(database);
  const managerHistory = allManagerHistory[managerId];

  if (!managerHistory || managerHistory.picks.length === 0) {
    console.warn(`No historical data found for manager ${managerId}. Predictions will be based on general patterns.`);
  }

  // Step 3: Enhance historical picks with player data
  const enhancedPicks = enhancePicksWithPlayerData(managerHistory?.picks || [], database);

  // Step 4: Filter available players
  const availablePlayers = filterAvailablePlayers(
    database.players || [],
    currentDraftPicks,
    {
      excludePositions: leagueSettings.excludePositions || [],
      minProjectedPoints: leagueSettings.minProjectedPoints || 0
    }
  );

  if (availablePlayers.length === 0) {
    throw new Error('No available players found for prediction');
  }

  // Step 5: Generate predictions
  const predictions = generatePredictionRanking(
    managerId,
    draftPosition,
    { picks: enhancedPicks },
    availablePlayers,
    {
      totalTeams: leagueSettings.totalTeams || 12,
      ...leagueSettings
    }
  );

  return predictions;
}

/**
 * Example: Get top predictions with detailed analysis
 * @param {Object} database - Complete fantasy football database
 * @param {string} managerId - Manager ID to predict for
 * @param {number} draftPosition - Current draft position
 * @param {Array} currentDraftPicks - Already drafted players
 * @param {number} topN - Number of top predictions to return
 * @returns {Object} Detailed prediction analysis
 */
export function getTopPredictionsWithAnalysis(database, managerId, draftPosition, currentDraftPicks = [], topN = 10) {
  const predictions = generateManagerPredictions(database, managerId, draftPosition, currentDraftPicks);
  
  const topPredictions = predictions.slice(0, topN);
  
  // Calculate summary statistics
  const avgConfidence = topPredictions.reduce((sum, p) => sum + p.confidence, 0) / topPredictions.length;
  const positionBreakdown = {};
  
  topPredictions.forEach(prediction => {
    const position = prediction.position;
    if (!positionBreakdown[position]) {
      positionBreakdown[position] = { count: 0, avgConfidence: 0, players: [] };
    }
    positionBreakdown[position].count++;
    positionBreakdown[position].players.push(prediction.playerName);
  });

  // Calculate average confidence by position
  Object.keys(positionBreakdown).forEach(position => {
    const positionPredictions = topPredictions.filter(p => p.position === position);
    positionBreakdown[position].avgConfidence = 
      positionPredictions.reduce((sum, p) => sum + p.confidence, 0) / positionPredictions.length;
  });

  return {
    predictions: topPredictions,
    summary: {
      totalPredictions: predictions.length,
      topPredictionsCount: topPredictions.length,
      averageConfidence: Math.round(avgConfidence * 10) / 10,
      positionBreakdown,
      highestConfidence: topPredictions[0]?.confidence || 0,
      lowestConfidence: topPredictions[topPredictions.length - 1]?.confidence || 0
    },
    insights: generatePredictionInsights(topPredictions, draftPosition)
  };
}

/**
 * Generate human-readable insights from predictions
 * @param {Array} predictions - Top predictions
 * @param {number} draftPosition - Draft position
 * @returns {Array} Array of insight strings
 */
function generatePredictionInsights(predictions, draftPosition) {
  const insights = [];
  
  if (predictions.length === 0) {
    return ['No predictions available'];
  }

  const topPrediction = predictions[0];
  const round = Math.ceil(draftPosition / 12);
  
  // Top prediction insight
  insights.push(`Most likely pick: ${topPrediction.playerName} (${topPrediction.position}) with ${topPrediction.confidence}% confidence`);
  
  // Position preference insight
  const positionCounts = {};
  predictions.slice(0, 5).forEach(p => {
    positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
  });
  
  const topPosition = Object.keys(positionCounts).reduce((a, b) => 
    positionCounts[a] > positionCounts[b] ? a : b
  );
  
  if (positionCounts[topPosition] > 1) {
    insights.push(`Strong preference for ${topPosition} in round ${round} (${positionCounts[topPosition]} of top 5 predictions)`);
  }
  
  // Confidence level insight
  const avgConfidence = predictions.slice(0, 5).reduce((sum, p) => sum + p.confidence, 0) / 5;
  if (avgConfidence > 70) {
    insights.push('High confidence predictions based on strong historical patterns');
  } else if (avgConfidence > 40) {
    insights.push('Moderate confidence predictions - some historical data available');
  } else {
    insights.push('Low confidence predictions - limited historical data');
  }
  
  // Historical basis insight
  const topPredictionBasis = topPrediction.historicalBasis;
  if (topPredictionBasis.similarPicks > 3) {
    insights.push(`Based on ${topPredictionBasis.similarPicks} similar historical picks in ${topPredictionBasis.roundType} rounds`);
  }
  
  return insights;
}

/**
 * Example: Compare predictions for multiple managers
 * @param {Object} database - Complete fantasy football database
 * @param {Array} managerIds - Array of manager IDs to compare
 * @param {number} draftPosition - Draft position to analyze
 * @param {Array} currentDraftPicks - Already drafted players
 * @returns {Object} Comparison of predictions across managers
 */
export function compareManagerPredictions(database, managerIds, draftPosition, currentDraftPicks = []) {
  const comparisons = {};
  
  managerIds.forEach(managerId => {
    try {
      const predictions = generateManagerPredictions(database, managerId, draftPosition, currentDraftPicks);
      comparisons[managerId] = {
        topPrediction: predictions[0],
        topFive: predictions.slice(0, 5),
        avgConfidence: predictions.slice(0, 5).reduce((sum, p) => sum + p.confidence, 0) / 5,
        positionPreferences: getPositionPreferences(predictions.slice(0, 10))
      };
    } catch (error) {
      comparisons[managerId] = {
        error: error.message,
        topPrediction: null,
        topFive: [],
        avgConfidence: 0,
        positionPreferences: {}
      };
    }
  });
  
  return comparisons;
}

/**
 * Helper function to extract position preferences from predictions
 * @param {Array} predictions - Array of predictions
 * @returns {Object} Position preference breakdown
 */
function getPositionPreferences(predictions) {
  const preferences = {};
  
  predictions.forEach((prediction, index) => {
    const position = prediction.position;
    if (!preferences[position]) {
      preferences[position] = { count: 0, avgRank: 0, avgConfidence: 0 };
    }
    
    preferences[position].count++;
    preferences[position].avgRank += (index + 1);
    preferences[position].avgConfidence += prediction.confidence;
  });
  
  // Calculate averages
  Object.keys(preferences).forEach(position => {
    const pref = preferences[position];
    pref.avgRank = pref.avgRank / pref.count;
    pref.avgConfidence = pref.avgConfidence / pref.count;
  });
  
  return preferences;
}

// Example usage (commented out to avoid execution during import):
/*
// Example 1: Basic prediction generation
const predictions = generateManagerPredictions(
  database,
  'manager123',
  25, // 3rd round, 1st pick
  currentDraftPicks,
  { totalTeams: 12, excludePositions: ['K', 'DEF'] }
);

console.log('Top 5 predictions:', predictions.slice(0, 5));

// Example 2: Detailed analysis
const analysis = getTopPredictionsWithAnalysis(
  database,
  'manager123',
  25,
  currentDraftPicks,
  10
);

console.log('Prediction Analysis:', analysis.summary);
console.log('Insights:', analysis.insights);

// Example 3: Manager comparison
const comparison = compareManagerPredictions(
  database,
  ['manager1', 'manager2', 'manager3'],
  37, // 4th round pick
  currentDraftPicks
);

console.log('Manager Comparison:', comparison);
*/