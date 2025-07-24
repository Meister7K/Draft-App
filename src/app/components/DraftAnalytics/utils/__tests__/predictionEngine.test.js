/**
 * Unit tests for Prediction Engine utilities
 */

import {
  analyzeDraftPositionPatterns,
  calculateConfidenceScore,
  filterAvailablePlayers,
  generatePredictionRanking,
  validatePredictionInputs
} from '../predictionEngine.js';

// Mock data for testing
const mockHistoricalPicks = [
  {
    pick_id: 'pick1',
    pick_no: 1,
    round: 1,
    draft_slot: 1,
    position: 'QB',
    playerName: 'Josh Allen',
    metadata: { player_id: 'player1', position: 'QB' },
    season: 2024
  },
  {
    pick_id: 'pick2',
    pick_no: 13,
    round: 2,
    draft_slot: 1,
    position: 'RB',
    playerName: 'Christian McCaffrey',
    metadata: { player_id: 'player2', position: 'RB' },
    season: 2024
  },
  {
    pick_id: 'pick3',
    pick_no: 25,
    round: 3,
    draft_slot: 1,
    position: 'WR',
    playerName: 'Tyreek Hill',
    metadata: { player_id: 'player3', position: 'WR' },
    season: 2024
  },
  {
    pick_id: 'pick4',
    pick_no: 37,
    round: 4,
    draft_slot: 1,
    position: 'RB',
    playerName: 'Saquon Barkley',
    metadata: { player_id: 'player4', position: 'RB' },
    season: 2023
  },
  {
    pick_id: 'pick5',
    pick_no: 49,
    round: 5,
    draft_slot: 1,
    position: 'WR',
    playerName: 'Davante Adams',
    metadata: { player_id: 'player5', position: 'WR' },
    season: 2023
  }
];

const mockPlayers = [
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
      name: 'Derrick Henry',
      position: 'RB',
      team: 'BAL',
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
      player_id: 'drafted1',
      name: 'Already Drafted',
      position: 'QB',
      team: 'TB',
      overall_rank: 1,
      position_rank: 1,
      projected_2025_points: 350
    }
  }
];

const mockDraftedPlayers = [
  {
    metadata: { player_id: 'drafted1' }
  }
];

const mockLeagueContext = {
  totalTeams: 12,
  excludePositions: [],
  minProjectedPoints: 0
};

describe('analyzeDraftPositionPatterns', () => {
  test('should analyze patterns for early round pick', () => {
    const result = analyzeDraftPositionPatterns(mockHistoricalPicks, 1, 12);
    
    expect(result).toHaveProperty('positionPreferences');
    expect(result).toHaveProperty('roundPreferences');
    expect(result).toHaveProperty('pickPatterns');
    expect(result).toHaveProperty('confidence');
    
    expect(result.pickPatterns.targetRound).toBe(1);
    expect(result.pickPatterns.positionInRound).toBe(1);
    expect(result.pickPatterns.roundType).toBe('early');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  test('should analyze patterns for mid round pick', () => {
    const result = analyzeDraftPositionPatterns(mockHistoricalPicks, 50, 12);
    
    expect(result.pickPatterns.targetRound).toBe(5);
    expect(result.pickPatterns.roundType).toBe('mid');
  });

  test('should analyze patterns for late round pick', () => {
    const result = analyzeDraftPositionPatterns(mockHistoricalPicks, 120, 12);
    
    expect(result.pickPatterns.targetRound).toBe(10);
    expect(result.pickPatterns.roundType).toBe('late');
  });

  test('should handle empty historical picks', () => {
    const result = analyzeDraftPositionPatterns([], 1, 12);
    
    expect(result.positionPreferences).toEqual({});
    expect(result.confidence).toBe(0);
  });

  test('should handle null/undefined input', () => {
    const result = analyzeDraftPositionPatterns(null, 1, 12);
    
    expect(result.positionPreferences).toEqual({});
    expect(result.confidence).toBe(0);
  });

  test('should expand search when few similar picks found', () => {
    const limitedPicks = [mockHistoricalPicks[0]]; // Only one pick
    const result = analyzeDraftPositionPatterns(limitedPicks, 1, 12);
    
    expect(result).toHaveProperty('positionPreferences');
    expect(result.confidence).toBeGreaterThan(0);
  });
});

describe('calculateConfidenceScore', () => {
  const mockPattern = {
    confidence: 50,
    positionPreferences: {
      'QB': { percentage: 30 },
      'RB': { percentage: 40 }
    },
    pickPatterns: { targetRound: 2 }
  };

  test('should calculate confidence for QB player', () => {
    const qbPlayer = mockPlayers[0]; // Lamar Jackson
    const result = calculateConfidenceScore(mockPattern, qbPlayer, mockPlayers, mockLeagueContext);
    
    expect(result).toHaveProperty('totalConfidence');
    expect(result).toHaveProperty('factors');
    expect(typeof result.totalConfidence).toBe('number');
    expect(result.totalConfidence).toBeGreaterThanOrEqual(0);
    expect(result.totalConfidence).toBeLessThanOrEqual(100);
    
    expect(result.factors).toHaveProperty('dataStrength');
    expect(result.factors).toHaveProperty('positionMatch');
    expect(result.factors).toHaveProperty('playerQuality');
  });

  test('should calculate confidence for RB player', () => {
    const rbPlayer = mockPlayers[1]; // Derrick Henry
    const result = calculateConfidenceScore(mockPattern, rbPlayer, mockPlayers, mockLeagueContext);
    
    expect(result.totalConfidence).toBeGreaterThan(0);
    expect(result.factors.positionMatch).toBeGreaterThan(0); // RB has 40% in pattern
  });

  test('should handle player without position preference', () => {
    const wrPlayer = mockPlayers[2]; // Cooper Kupp (WR not in pattern)
    const result = calculateConfidenceScore(mockPattern, wrPlayer, mockPlayers, mockLeagueContext);
    
    expect(result.totalConfidence).toBeGreaterThan(0);
    expect(result.factors.positionMatch).toBeUndefined();
  });

  test('should handle empty pattern', () => {
    const emptyPattern = { confidence: 0 };
    const result = calculateConfidenceScore(emptyPattern, mockPlayers[0], mockPlayers, mockLeagueContext);
    
    expect(result.totalConfidence).toBeGreaterThanOrEqual(0);
  });

  test('should cap confidence at 100', () => {
    const highPattern = {
      confidence: 100,
      positionPreferences: { 'QB': { percentage: 100 } },
      pickPatterns: { targetRound: 1 }
    };
    const topPlayer = {
      player_info: {
        position: 'QB',
        position_rank: 1,
        overall_rank: 1,
        projected_2025_points: 400
      }
    };
    
    const result = calculateConfidenceScore(highPattern, topPlayer, [topPlayer], mockLeagueContext);
    expect(result.totalConfidence).toBeLessThanOrEqual(100);
  });
});

describe('filterAvailablePlayers', () => {
  test('should filter out drafted players', () => {
    const result = filterAvailablePlayers(mockPlayers, mockDraftedPlayers);
    
    expect(result).toHaveLength(3); // 4 total - 1 drafted = 3
    expect(result.find(p => p.player_info.player_id === 'drafted1')).toBeUndefined();
    expect(result.find(p => p.player_info.player_id === 'available1')).toBeDefined();
  });

  test('should handle empty drafted players array', () => {
    const result = filterAvailablePlayers(mockPlayers, []);
    
    expect(result).toHaveLength(4);
  });

  test('should handle null/undefined inputs', () => {
    expect(filterAvailablePlayers(null)).toEqual([]);
    expect(filterAvailablePlayers(undefined)).toEqual([]);
    expect(filterAvailablePlayers([])).toEqual([]);
  });

  test('should apply position exclusions', () => {
    const settingsWithExclusions = {
      excludePositions: ['QB']
    };
    
    const result = filterAvailablePlayers(mockPlayers, mockDraftedPlayers, settingsWithExclusions);
    
    expect(result.find(p => p.player_info.position === 'QB')).toBeUndefined();
    expect(result.find(p => p.player_info.position === 'RB')).toBeDefined();
  });

  test('should apply minimum projected points filter', () => {
    const settingsWithMinPoints = {
      minProjectedPoints: 300
    };
    
    const result = filterAvailablePlayers(mockPlayers, mockDraftedPlayers, settingsWithMinPoints);
    
    expect(result).toHaveLength(1); // Only Lamar Jackson has 320 points
    expect(result[0].player_info.player_id).toBe('available1');
  });

  test('should sort by overall rank', () => {
    const result = filterAvailablePlayers(mockPlayers, mockDraftedPlayers);
    
    // Should be sorted by overall rank (ascending)
    for (let i = 1; i < result.length; i++) {
      const prevRank = result[i-1].player_info.overall_rank || 999;
      const currRank = result[i].player_info.overall_rank || 999;
      expect(prevRank).toBeLessThanOrEqual(currRank);
    }
  });
});

describe('generatePredictionRanking', () => {
  const mockHistoricalData = {
    picks: mockHistoricalPicks
  };

  test('should generate predictions for available players', () => {
    const availablePlayers = filterAvailablePlayers(mockPlayers, mockDraftedPlayers);
    const result = generatePredictionRanking(
      'manager1',
      13, // 2nd round, 1st pick
      mockHistoricalData,
      availablePlayers,
      mockLeagueContext
    );
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(50);
    
    // Check structure of first prediction
    const firstPrediction = result[0];
    expect(firstPrediction).toHaveProperty('playerId');
    expect(firstPrediction).toHaveProperty('playerName');
    expect(firstPrediction).toHaveProperty('position');
    expect(firstPrediction).toHaveProperty('confidence');
    expect(firstPrediction).toHaveProperty('factors');
    expect(firstPrediction).toHaveProperty('reasoning');
    expect(firstPrediction).toHaveProperty('historicalBasis');
    expect(firstPrediction).toHaveProperty('playerData');
  });

  test('should sort predictions by confidence (highest first)', () => {
    const availablePlayers = filterAvailablePlayers(mockPlayers, mockDraftedPlayers);
    const result = generatePredictionRanking(
      'manager1',
      13,
      mockHistoricalData,
      availablePlayers,
      mockLeagueContext
    );
    
    for (let i = 1; i < result.length; i++) {
      expect(result[i-1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
    }
  });

  test('should handle empty historical data', () => {
    const emptyHistoricalData = { picks: [] };
    const availablePlayers = filterAvailablePlayers(mockPlayers, mockDraftedPlayers);
    const result = generatePredictionRanking(
      'manager1',
      13,
      emptyHistoricalData,
      availablePlayers,
      mockLeagueContext
    );
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(availablePlayers.length);
  });

  test('should handle empty available players', () => {
    const result = generatePredictionRanking(
      'manager1',
      13,
      mockHistoricalData,
      [],
      mockLeagueContext
    );
    
    expect(result).toEqual([]);
  });

  test('should include reasoning for predictions', () => {
    const availablePlayers = filterAvailablePlayers(mockPlayers, mockDraftedPlayers);
    const result = generatePredictionRanking(
      'manager1',
      13,
      mockHistoricalData,
      availablePlayers,
      mockLeagueContext
    );
    
    result.forEach(prediction => {
      expect(typeof prediction.reasoning).toBe('string');
      expect(prediction.reasoning.length).toBeGreaterThan(0);
    });
  });

  test('should include historical basis', () => {
    const availablePlayers = filterAvailablePlayers(mockPlayers, mockDraftedPlayers);
    const result = generatePredictionRanking(
      'manager1',
      13,
      mockHistoricalData,
      availablePlayers,
      mockLeagueContext
    );
    
    result.forEach(prediction => {
      expect(prediction.historicalBasis).toHaveProperty('similarPicks');
      expect(prediction.historicalBasis).toHaveProperty('roundType');
      expect(typeof prediction.historicalBasis.similarPicks).toBe('number');
    });
  });
});

describe('validatePredictionInputs', () => {
  const validInputs = {
    managerId: 'manager1',
    draftPosition: 13,
    availablePlayers: mockPlayers,
    historicalData: { picks: mockHistoricalPicks }
  };

  test('should validate correct inputs', () => {
    const result = validatePredictionInputs(validInputs);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('should reject missing manager ID', () => {
    const invalidInputs = { ...validInputs, managerId: null };
    const result = validatePredictionInputs(invalidInputs);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Manager ID is required and must be a string');
  });

  test('should reject invalid draft position', () => {
    const invalidInputs = { ...validInputs, draftPosition: -1 };
    const result = validatePredictionInputs(invalidInputs);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Draft position is required and must be a positive number');
  });

  test('should reject non-array available players', () => {
    const invalidInputs = { ...validInputs, availablePlayers: 'not an array' };
    const result = validatePredictionInputs(invalidInputs);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Available players must be an array');
  });

  test('should reject missing historical data', () => {
    const invalidInputs = { ...validInputs, historicalData: null };
    const result = validatePredictionInputs(invalidInputs);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Historical data is required and must be an object');
  });

  test('should collect multiple errors', () => {
    const invalidInputs = {
      managerId: null,
      draftPosition: 0,
      availablePlayers: null,
      historicalData: null
    };
    const result = validatePredictionInputs(invalidInputs);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(4);
  });
});

// Edge cases and integration tests
describe('Prediction Engine Integration', () => {
  test('should handle real-world scenario with multiple positions', () => {
    const diverseHistoricalPicks = [
      ...mockHistoricalPicks,
      {
        pick_id: 'pick6',
        pick_no: 14,
        round: 2,
        draft_slot: 2,
        position: 'QB',
        playerName: 'Patrick Mahomes',
        metadata: { player_id: 'player6', position: 'QB' },
        season: 2022
      },
      {
        pick_id: 'pick7',
        pick_no: 26,
        round: 3,
        draft_slot: 2,
        position: 'TE',
        playerName: 'Travis Kelce',
        metadata: { player_id: 'player7', position: 'TE' },
        season: 2022
      }
    ];

    const historicalData = { picks: diverseHistoricalPicks };
    const availablePlayers = filterAvailablePlayers(mockPlayers, mockDraftedPlayers);
    
    const result = generatePredictionRanking(
      'manager1',
      26, // 3rd round pick
      historicalData,
      availablePlayers,
      mockLeagueContext
    );
    
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(p => p.confidence >= 0 && p.confidence <= 100)).toBe(true);
  });

  test('should handle large dataset efficiently', () => {
    // Create a large dataset
    const largePicks = [];
    for (let i = 0; i < 1000; i++) {
      largePicks.push({
        pick_id: `pick${i}`,
        pick_no: i + 1,
        round: Math.ceil((i + 1) / 12),
        draft_slot: ((i) % 12) + 1,
        position: ['QB', 'RB', 'WR', 'TE'][i % 4],
        playerName: `Player ${i}`,
        metadata: { player_id: `player${i}`, position: ['QB', 'RB', 'WR', 'TE'][i % 4] },
        season: 2020 + (i % 5)
      });
    }

    const start = Date.now();
    const historicalData = { picks: largePicks };
    const availablePlayers = filterAvailablePlayers(mockPlayers, mockDraftedPlayers);
    
    const result = generatePredictionRanking(
      'manager1',
      50,
      historicalData,
      availablePlayers,
      mockLeagueContext
    );
    const end = Date.now();
    
    expect(result.length).toBeGreaterThan(0);
    expect(end - start).toBeLessThan(1000); // Should complete within 1 second
  });
});