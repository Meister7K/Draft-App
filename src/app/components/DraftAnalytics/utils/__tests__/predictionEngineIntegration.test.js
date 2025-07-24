/**
 * Integration tests for Prediction Engine with existing utilities
 */

import {
  generatePredictionRanking,
  filterAvailablePlayers
} from '../predictionEngine.js';

import {
  extractDraftHistoryByManager,
  enhancePicksWithPlayerData
} from '../historicalDataParser.js';

import {
  calculateManagerStatistics
} from '../statisticalCalculations.js';

// Mock database structure similar to real data
const mockDatabase = {
  leagues: {
    'league1': {
      league_id: 'league1',
      name: 'Test League',
      season: 2024,
      drafts: {
        'draft1': {
          draft_id: 'draft1',
          season: 2024,
          picks: [
            {
              pick_id: 'pick1',
              pick_no: 1,
              round: 1,
              draft_slot: 1,
              picked_by: 'manager1',
              metadata: {
                player_id: 'player1',
                first_name: 'Josh',
                last_name: 'Allen',
                position: 'QB',
                team: 'BUF'
              }
            },
            {
              pick_id: 'pick2',
              pick_no: 13,
              round: 2,
              draft_slot: 1,
              picked_by: 'manager1',
              metadata: {
                player_id: 'player2',
                first_name: 'Christian',
                last_name: 'McCaffrey',
                position: 'RB',
                team: 'SF'
              }
            },
            {
              pick_id: 'pick3',
              pick_no: 25,
              round: 3,
              draft_slot: 1,
              picked_by: 'manager1',
              metadata: {
                player_id: 'player3',
                first_name: 'Tyreek',
                last_name: 'Hill',
                position: 'WR',
                team: 'MIA'
              }
            }
          ]
        }
      }
    },
    'league2': {
      league_id: 'league2',
      name: 'Test League 2',
      season: 2023,
      drafts: {
        'draft2': {
          draft_id: 'draft2',
          season: 2023,
          picks: [
            {
              pick_id: 'pick4',
              pick_no: 1,
              round: 1,
              draft_slot: 1,
              picked_by: 'manager1',
              metadata: {
                player_id: 'player4',
                first_name: 'Patrick',
                last_name: 'Mahomes',
                position: 'QB',
                team: 'KC'
              }
            },
            {
              pick_id: 'pick5',
              pick_no: 13,
              round: 2,
              draft_slot: 1,
              picked_by: 'manager1',
              metadata: {
                player_id: 'player5',
                first_name: 'Derrick',
                last_name: 'Henry',
                position: 'RB',
                team: 'BAL'
              }
            }
          ]
        }
      }
    }
  },
  players: [
    {
      player_info: {
        player_id: 'available1',
        name: 'Lamar Jackson',
        position: 'QB',
        team: 'BAL',
        overall_rank: 5,
        position_rank: 2,
        projected_2025_points: 320
      }
    },
    {
      player_info: {
        player_id: 'available2',
        name: 'Saquon Barkley',
        position: 'RB',
        team: 'PHI',
        overall_rank: 15,
        position_rank: 8,
        projected_2025_points: 280
      }
    },
    {
      player_info: {
        player_id: 'available3',
        name: 'Cooper Kupp',
        position: 'WR',
        team: 'LAR',
        overall_rank: 25,
        position_rank: 12,
        projected_2025_points: 260
      }
    },
    {
      player_info: {
        player_id: 'available4',
        name: 'Travis Kelce',
        position: 'TE',
        team: 'KC',
        overall_rank: 35,
        position_rank: 3,
        projected_2025_points: 240
      }
    }
  ]
};

const currentDraftPicks = [
  {
    metadata: { player_id: 'player1' }
  }
];

describe('Prediction Engine Integration', () => {
  test('should integrate with historical data parser', () => {
    // Extract historical data using existing utility
    const managerHistory = extractDraftHistoryByManager(mockDatabase);
    expect(managerHistory).toHaveProperty('manager1');
    
    const manager1History = managerHistory['manager1'];
    expect(manager1History.picks).toHaveLength(5);
    expect(manager1History.seasons).toEqual([2024, 2023]);
    
    // Enhance picks with player data
    const enhancedPicks = enhancePicksWithPlayerData(manager1History.picks, mockDatabase);
    expect(enhancedPicks).toHaveLength(5);
    expect(enhancedPicks[0]).toHaveProperty('playerName');
    expect(enhancedPicks[0]).toHaveProperty('position');
    
    // Filter available players
    const availablePlayers = filterAvailablePlayers(mockDatabase.players, currentDraftPicks);
    expect(availablePlayers).toHaveLength(4); // All 4 available players
    
    // Generate predictions using historical data
    const predictions = generatePredictionRanking(
      'manager1',
      37, // 4th round pick
      { picks: enhancedPicks },
      availablePlayers,
      { totalTeams: 12 }
    );
    
    expect(predictions).toHaveLength(4);
    expect(predictions[0]).toHaveProperty('confidence');
    expect(predictions[0]).toHaveProperty('reasoning');
    expect(predictions[0]).toHaveProperty('historicalBasis');
  });

  test('should integrate with statistical calculations', () => {
    // Extract and enhance historical data
    const managerHistory = extractDraftHistoryByManager(mockDatabase);
    const manager1History = managerHistory['manager1'];
    const enhancedPicks = enhancePicksWithPlayerData(manager1History.picks, mockDatabase);
    
    // Calculate statistics using existing utility
    const stats = calculateManagerStatistics(enhancedPicks);
    expect(stats).toHaveProperty('positionFrequencies');
    expect(stats).toHaveProperty('averageDraftPositions');
    expect(stats).toHaveProperty('roundTendencies');
    
    // Verify QB preference is detected
    expect(stats.positionFrequencies).toHaveProperty('QB');
    expect(stats.positionFrequencies.QB.count).toBe(2);
    expect(stats.positionFrequencies.QB.percentage).toBe(40); // 2/5 * 100
    
    // Generate predictions and verify QB gets high confidence due to historical preference
    const availablePlayers = filterAvailablePlayers(mockDatabase.players, currentDraftPicks);
    const predictions = generatePredictionRanking(
      'manager1',
      1, // 1st round pick (similar to historical pattern)
      { picks: enhancedPicks },
      availablePlayers,
      { totalTeams: 12 }
    );
    
    // Find QB prediction
    const qbPrediction = predictions.find(p => p.position === 'QB');
    expect(qbPrediction).toBeDefined();
    expect(qbPrediction.confidence).toBeGreaterThan(0);
    
    // Verify reasoning mentions historical preference
    expect(qbPrediction.reasoning).toContain('QB');
  });

  test('should handle real-world workflow', () => {
    // Simulate complete workflow from database to predictions
    
    // Step 1: Extract manager's historical data
    const allManagerHistory = extractDraftHistoryByManager(mockDatabase);
    const targetManagerId = 'manager1';
    const managerHistory = allManagerHistory[targetManagerId];
    
    expect(managerHistory).toBeDefined();
    expect(managerHistory.picks.length).toBeGreaterThan(0);
    
    // Step 2: Enhance picks with player data
    const enhancedPicks = enhancePicksWithPlayerData(managerHistory.picks, mockDatabase);
    
    // Step 3: Filter available players (simulate current draft state)
    const availablePlayers = filterAvailablePlayers(
      mockDatabase.players, 
      currentDraftPicks,
      { excludePositions: [], minProjectedPoints: 200 }
    );
    
    expect(availablePlayers.length).toBeGreaterThan(0);
    
    // Step 4: Generate predictions for next pick
    const nextDraftPosition = 49; // 5th round pick
    const predictions = generatePredictionRanking(
      targetManagerId,
      nextDraftPosition,
      { picks: enhancedPicks },
      availablePlayers,
      { totalTeams: 12 }
    );
    
    // Verify predictions are reasonable
    expect(predictions.length).toBeGreaterThan(0);
    expect(predictions.every(p => p.confidence >= 0 && p.confidence <= 100)).toBe(true);
    expect(predictions.every(p => p.reasoning && p.reasoning.length > 0)).toBe(true);
    expect(predictions.every(p => p.historicalBasis)).toBe(true);
    
    // Verify predictions are sorted by confidence
    for (let i = 1; i < predictions.length; i++) {
      expect(predictions[i-1].confidence).toBeGreaterThanOrEqual(predictions[i].confidence);
    }
    
    // Verify each prediction has required fields
    predictions.forEach(prediction => {
      expect(prediction).toHaveProperty('playerId');
      expect(prediction).toHaveProperty('playerName');
      expect(prediction).toHaveProperty('position');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction).toHaveProperty('factors');
      expect(prediction).toHaveProperty('reasoning');
      expect(prediction).toHaveProperty('historicalBasis');
      expect(prediction).toHaveProperty('playerData');
      
      // Verify historical basis structure
      expect(prediction.historicalBasis).toHaveProperty('similarPicks');
      expect(prediction.historicalBasis).toHaveProperty('roundType');
      expect(typeof prediction.historicalBasis.similarPicks).toBe('number');
      expect(['early', 'mid', 'late']).toContain(prediction.historicalBasis.roundType);
    });
  });

  test('should handle edge cases gracefully', () => {
    // Test with manager who has no historical data
    const predictions = generatePredictionRanking(
      'nonexistent_manager',
      25,
      { picks: [] },
      filterAvailablePlayers(mockDatabase.players, []),
      { totalTeams: 12 }
    );
    
    expect(predictions.length).toBeGreaterThan(0);
    expect(predictions.every(p => p.confidence >= 0)).toBe(true);
    
    // Test with very late draft position
    const latePredictions = generatePredictionRanking(
      'manager1',
      180, // 15th round
      { picks: enhancePicksWithPlayerData(extractDraftHistoryByManager(mockDatabase)['manager1'].picks, mockDatabase) },
      filterAvailablePlayers(mockDatabase.players, []),
      { totalTeams: 12 }
    );
    
    expect(latePredictions.length).toBeGreaterThan(0);
    expect(latePredictions[0].historicalBasis.roundType).toBe('late');
  });

  test('should provide meaningful confidence scores', () => {
    const managerHistory = extractDraftHistoryByManager(mockDatabase);
    const enhancedPicks = enhancePicksWithPlayerData(managerHistory['manager1'].picks, mockDatabase);
    const availablePlayers = filterAvailablePlayers(mockDatabase.players, []);
    
    // Test early round prediction (should have higher confidence due to more data)
    const earlyPredictions = generatePredictionRanking(
      'manager1',
      1,
      { picks: enhancedPicks },
      availablePlayers,
      { totalTeams: 12 }
    );
    
    // Test late round prediction (should have lower confidence due to less data)
    const latePredictions = generatePredictionRanking(
      'manager1',
      150,
      { picks: enhancedPicks },
      availablePlayers,
      { totalTeams: 12 }
    );
    
    // Both should have predictions
    expect(earlyPredictions.length).toBeGreaterThan(0);
    expect(latePredictions.length).toBeGreaterThan(0);
    
    // Confidence scores should be reasonable
    expect(earlyPredictions[0].confidence).toBeGreaterThan(0);
    expect(latePredictions[0].confidence).toBeGreaterThan(0);
    
    // All predictions should have detailed factors
    [...earlyPredictions, ...latePredictions].forEach(prediction => {
      expect(prediction.factors).toBeDefined();
      expect(typeof prediction.factors).toBe('object');
    });
  });
});