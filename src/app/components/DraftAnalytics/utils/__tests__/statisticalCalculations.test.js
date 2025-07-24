/**
 * Unit tests for Statistical Calculations utilities
 */

import {
  calculatePositionFrequencies,
  calculateAverageDraftPositions,
  calculateMostFrequentPlayers,
  calculateRoundTendencies,
  calculateYearOverYearTrends,
  calculateManagerStatistics
} from '../statisticalCalculations.js';

// Test data generators for more effective testing
function generateRandomPicks(count, options = {}) {
  const positions = options.positions || ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const seasons = options.seasons || [2024, 2023, 2022];
  const picks = [];
  
  for (let i = 0; i < count; i++) {
    const position = positions[Math.floor(Math.random() * positions.length)];
    const season = seasons[Math.floor(Math.random() * seasons.length)];
    const round = Math.floor(Math.random() * 15) + 1;
    const pickNo = (round - 1) * 12 + Math.floor(Math.random() * 12) + 1;
    
    picks.push({
      pick_id: `pick_${i}`,
      pick_no: pickNo,
      round: round,
      position: position,
      playerName: `Player ${i}`,
      metadata: { 
        player_id: `player_${i}`, 
        position: position 
      },
      season: season
    });
  }
  
  return picks;
}

function createTestPicks(config) {
  const picks = [];
  let pickId = 1;
  
  Object.entries(config).forEach(([position, rounds]) => {
    rounds.forEach(round => {
      picks.push({
        pick_id: `pick_${pickId++}`,
        pick_no: (round - 1) * 12 + pickId,
        round: round,
        position: position,
        playerName: `${position} Player ${pickId}`,
        metadata: { 
          player_id: `player_${pickId}`, 
          position: position 
        },
        season: 2024
      });
    });
  });
  
  return picks;
}

describe('calculatePositionFrequencies', () => {
  test('should calculate percentages that sum to 100%', () => {
    const picks = createTestPicks({
      QB: [1, 5],
      RB: [2, 3, 8],
      WR: [4, 6, 7, 9],
      TE: [10]
    });
    
    const result = calculatePositionFrequencies(picks);
    
    // Test that percentages sum to 100% (within floating point tolerance)
    const totalPercentage = Object.values(result).reduce((sum, pos) => sum + pos.percentage, 0);
    expect(totalPercentage).toBeCloseTo(100, 1);
    
    // Test that counts sum to total picks
    const totalCount = Object.values(result).reduce((sum, pos) => sum + pos.count, 0);
    expect(totalCount).toBe(picks.length);
  });

  test('should correctly calculate average rounds across different scenarios', () => {
    const picks = createTestPicks({
      QB: [1, 15], // Should average to 8
      RB: [2, 2, 2] // Should average to 2
    });
    
    const result = calculatePositionFrequencies(picks);
    
    expect(result.QB.avgRound).toBe(8);
    expect(result.RB.avgRound).toBe(2);
    expect(result.QB.earliestRound).toBe(1);
    expect(result.QB.latestRound).toBe(15);
    expect(result.RB.earliestRound).toBe(2);
    expect(result.RB.latestRound).toBe(2);
  });

  test('should handle mixed position data sources (position vs metadata.position)', () => {
    const picks = [
      { pick_id: 'pick1', round: 1, position: 'QB' },
      { pick_id: 'pick2', round: 2, metadata: { position: 'RB' } },
      { pick_id: 'pick3', round: 3, position: 'WR', metadata: { position: 'TE' } } // position should take precedence
    ];
    
    const result = calculatePositionFrequencies(picks);
    
    expect(result.QB.count).toBe(1);
    expect(result.RB.count).toBe(1);
    expect(result.WR.count).toBe(1);
    expect(result.TE).toBeUndefined();
  });

  test('should handle large datasets efficiently', () => {
    const largePicks = generateRandomPicks(1000);
    
    const startTime = performance.now();
    const result = calculatePositionFrequencies(largePicks);
    const endTime = performance.now();
    
    // Should complete within reasonable time (less than 100ms for 1000 picks)
    expect(endTime - startTime).toBeLessThan(100);
    
    // Should have valid results
    expect(Object.keys(result).length).toBeGreaterThan(0);
    const totalCount = Object.values(result).reduce((sum, pos) => sum + pos.count, 0);
    expect(totalCount).toBe(1000);
  });

  test('should handle empty picks array', () => {
    const result = calculatePositionFrequencies([]);
    expect(result).toEqual({});
  });

  test('should handle null picks', () => {
    const result = calculatePositionFrequencies(null);
    expect(result).toEqual({});
  });

  test('should handle picks without position data', () => {
    const picksWithoutPosition = [
      { pick_id: 'pick1', round: 1 }
    ];
    
    const result = calculatePositionFrequencies(picksWithoutPosition);
    expect(result).toEqual({});
  });
});

describe('calculateAverageDraftPositions', () => {
  test('should calculate correct averages across different pick numbers', () => {
    const picks = [
      { position: 'QB', pick_no: 1 },
      { position: 'QB', pick_no: 25 },
      { position: 'QB', pick_no: 49 },
      { position: 'RB', pick_no: 12 },
      { position: 'RB', pick_no: 36 }
    ];

    const result = calculateAverageDraftPositions(picks);

    expect(result.QB.avgPickNumber).toBe(25); // (1+25+49)/3
    expect(result.QB.earliestPick).toBe(1);
    expect(result.QB.latestPick).toBe(49);
    expect(result.QB.totalPicks).toBe(3);
    
    expect(result.RB.avgPickNumber).toBe(24); // (12+36)/2
    expect(result.RB.earliestPick).toBe(12);
    expect(result.RB.latestPick).toBe(36);
    expect(result.RB.totalPicks).toBe(2);
  });

  test('should handle single pick per position', () => {
    const picks = [
      { position: 'QB', pick_no: 15 },
      { position: 'RB', pick_no: 30 }
    ];

    const result = calculateAverageDraftPositions(picks);

    expect(result.QB.avgPickNumber).toBe(15);
    expect(result.QB.earliestPick).toBe(15);
    expect(result.QB.latestPick).toBe(15);
    expect(result.QB.totalPicks).toBe(1);
  });

  test('should handle empty picks array', () => {
    const result = calculateAverageDraftPositions([]);
    expect(result).toEqual({});
  });

  test('should handle picks without pick numbers', () => {
    const picksWithoutPickNo = [
      { position: 'QB' }
    ];
    
    const result = calculateAverageDraftPositions(picksWithoutPickNo);
    expect(result).toEqual({});
  });
});

describe('calculateMostFrequentPlayers', () => {
  test('should only return players drafted multiple times', () => {
    const picks = [
      { playerName: 'Player A', metadata: { player_id: 'p1' }, pick_no: 1, season: 2024 },
      { playerName: 'Player A', metadata: { player_id: 'p1' }, pick_no: 13, season: 2023 },
      { playerName: 'Player A', metadata: { player_id: 'p1' }, pick_no: 25, season: 2022 },
      { playerName: 'Player B', metadata: { player_id: 'p2' }, pick_no: 37, season: 2024 },
      { playerName: 'Player B', metadata: { player_id: 'p2' }, pick_no: 49, season: 2023 },
      { playerName: 'Player C', metadata: { player_id: 'p3' }, pick_no: 61, season: 2024 } // Only drafted once
    ];
    
    const result = calculateMostFrequentPlayers(picks);
    
    // Should only return players drafted more than once
    expect(result).toHaveLength(2);
    expect(result.find(p => p.playerName === 'Player C')).toBeUndefined();
    
    // Should be sorted by frequency (Player A: 3 times, Player B: 2 times)
    expect(result[0].playerName).toBe('Player A');
    expect(result[0].draftCount).toBe(3);
    expect(result[1].playerName).toBe('Player B');
    expect(result[1].draftCount).toBe(2);
  });

  test('should calculate correct statistics for frequently drafted players', () => {
    const picks = [
      { playerName: 'Test Player', metadata: { player_id: 'test' }, pick_no: 1, round: 1, season: 2024 },
      { playerName: 'Test Player', metadata: { player_id: 'test' }, pick_no: 25, round: 3, season: 2023 },
      { playerName: 'Test Player', metadata: { player_id: 'test' }, pick_no: 49, round: 5, season: 2022 }
    ];
    
    const result = calculateMostFrequentPlayers(picks);
    
    expect(result).toHaveLength(1);
    const player = result[0];
    
    // Test calculated averages
    expect(player.avgDraftPosition).toBe(25); // (1 + 25 + 49) / 3
    expect(player.avgRound).toBe(3); // (1 + 3 + 5) / 3
    expect(player.earliestPick).toBe(1);
    expect(player.latestPick).toBe(49);
    expect(player.seasons).toEqual([2024, 2023, 2022]); // Should be sorted descending
    expect(player.pickHistory).toEqual([1, 25, 49]); // Should be sorted ascending
  });

  test('should handle missing or inconsistent data gracefully', () => {
    const picks = [
      { playerName: 'Player A', metadata: { player_id: 'p1' } }, // No pick_no or round
      { playerName: 'Player A', metadata: { player_id: 'p1' }, pick_no: 25 },
      { metadata: { player_id: 'p2' }, pick_no: 37 }, // No playerName
      { playerName: 'Player B', pick_no: 49 } // No player_id
    ];
    
    const result = calculateMostFrequentPlayers(picks);
    
    // Should handle missing data without crashing
    expect(result).toHaveLength(1);
    expect(result[0].playerName).toBe('Player A');
    expect(result[0].avgDraftPosition).toBe(25); // Should ignore picks without pick_no
  });

  test('should handle picks with no repeated players', () => {
    const uniquePicks = [
      { playerName: 'Player 1', metadata: { player_id: 'player1' }, pick_no: 1 },
      { playerName: 'Player 2', metadata: { player_id: 'player2' }, pick_no: 2 }
    ];
    
    const result = calculateMostFrequentPlayers(uniquePicks);
    expect(result).toEqual([]);
  });

  test('should handle empty picks array', () => {
    const result = calculateMostFrequentPlayers([]);
    expect(result).toEqual([]);
  });
});

describe('calculateRoundTendencies', () => {
  test('should correctly categorize picks by threshold', () => {
    const picks = createTestPicks({
      QB: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    });
    
    const result = calculateRoundTendencies(picks, 5);
    
    // With threshold 5: rounds 1-5 are early, 6+ are late
    expect(result.earlyRounds.count).toBe(5);
    expect(result.lateRounds.count).toBe(5);
    expect(result.earlyRounds.percentage).toBe(50);
    expect(result.lateRounds.percentage).toBe(50);
    expect(result.totalAnalyzed).toBe(10);
  });

  test('should handle different threshold values correctly', () => {
    const picks = createTestPicks({
      QB: [1, 5, 10, 15]
    });
    
    // Test with threshold 3
    const result1 = calculateRoundTendencies(picks, 3);
    expect(result1.earlyRounds.count).toBe(1); // only round 1 <= 3
    expect(result1.lateRounds.count).toBe(3);
    
    // Test with threshold 12
    const result2 = calculateRoundTendencies(picks, 12);
    expect(result2.earlyRounds.count).toBe(3); // rounds 1, 5, 10 <= 12
    expect(result2.lateRounds.count).toBe(1); // only round 15 > 12
  });

  test('should use default threshold of 6', () => {
    const picks = createTestPicks({
      QB: [1, 6, 7]
    });
    
    const result = calculateRoundTendencies(picks);
    
    expect(result.earlyRounds.threshold).toBe(6);
    expect(result.earlyRounds.count).toBe(2); // rounds 1, 6 <= 6
    expect(result.lateRounds.count).toBe(1); // round 7 > 6
  });

  test('should correctly aggregate position breakdowns', () => {
    const picks = [
      { round: 1, position: 'QB' },
      { round: 2, position: 'RB' },
      { round: 3, position: 'RB' },
      { round: 8, position: 'QB' },
      { round: 9, position: 'WR' },
      { round: 10, position: 'WR' }
    ];
    
    const result = calculateRoundTendencies(picks, 5);
    
    // Early rounds (1-5): 1 QB, 2 RB
    expect(result.earlyRounds.positions.QB).toBe(1);
    expect(result.earlyRounds.positions.RB).toBe(2);
    expect(result.earlyRounds.positions.WR).toBeUndefined();
    
    // Late rounds (6+): 1 QB, 2 WR
    expect(result.lateRounds.positions.QB).toBe(1);
    expect(result.lateRounds.positions.WR).toBe(2);
    expect(result.lateRounds.positions.RB).toBeUndefined();
  });

  test('should handle picks without round data', () => {
    const picks = [
      { position: 'QB' }, // No round
      { round: 1, position: 'RB' },
      { round: 10, position: 'WR' }
    ];
    
    const result = calculateRoundTendencies(picks, 5);
    
    // Should only analyze picks with round data
    expect(result.totalAnalyzed).toBe(2);
    expect(result.earlyRounds.count).toBe(1);
    expect(result.lateRounds.count).toBe(1);
  });

  test('should handle empty picks array', () => {
    const result = calculateRoundTendencies([]);
    
    expect(result.earlyRounds.count).toBe(0);
    expect(result.earlyRounds.percentage).toBe(0);
    expect(result.lateRounds.count).toBe(0);
    expect(result.lateRounds.percentage).toBe(0);
    expect(result.totalAnalyzed).toBe(0);
  });
});

describe('calculateYearOverYearTrends', () => {
  test('should group picks by season and calculate statistics', () => {
    const picks = [
      { position: 'QB', round: 1, season: 2024 },
      { position: 'RB', round: 2, season: 2024 },
      { position: 'QB', round: 1, season: 2023 },
      { position: 'WR', round: 3, season: 2023 },
      { position: 'TE', round: 4, season: 2022 }
    ];
    
    const result = calculateYearOverYearTrends(picks);
    
    expect(result).toHaveProperty('2024');
    expect(result).toHaveProperty('2023');
    expect(result).toHaveProperty('2022');
    
    // 2024 should have 2 picks
    expect(result['2024'].totalPicks).toBe(2);
    expect(result['2024'].positionFrequencies.QB.count).toBe(1);
    expect(result['2024'].positionFrequencies.RB.count).toBe(1);
    
    // 2023 should have 2 picks
    expect(result['2023'].totalPicks).toBe(2);
    expect(result['2023'].positionFrequencies.QB.count).toBe(1);
    expect(result['2023'].positionFrequencies.WR.count).toBe(1);
    
    // 2022 should have 1 pick
    expect(result['2022'].totalPicks).toBe(1);
    expect(result['2022'].positionFrequencies.TE.count).toBe(1);
  });

  test('should handle picks without season data', () => {
    const picksWithoutSeason = [
      { pick_id: 'pick1', position: 'QB' }
    ];
    
    const result = calculateYearOverYearTrends(picksWithoutSeason);
    expect(result).toEqual({});
  });

  test('should handle empty picks array', () => {
    const result = calculateYearOverYearTrends([]);
    expect(result).toEqual({});
  });
});

describe('calculateManagerStatistics', () => {
  test('should integrate all statistical functions correctly', () => {
    const picks = [
      { position: 'QB', pick_no: 1, round: 1, playerName: 'Player A', metadata: { player_id: 'p1' }, season: 2024 },
      { position: 'QB', pick_no: 13, round: 2, playerName: 'Player A', metadata: { player_id: 'p1' }, season: 2023 },
      { position: 'RB', pick_no: 25, round: 3, playerName: 'Player B', metadata: { player_id: 'p2' }, season: 2024 },
      { position: 'WR', pick_no: 37, round: 4, playerName: 'Player C', metadata: { player_id: 'p3' }, season: 2024 }
    ];
    
    const result = calculateManagerStatistics(picks);
    
    // Should have all required properties
    expect(result).toHaveProperty('totalPicks');
    expect(result).toHaveProperty('positionFrequencies');
    expect(result).toHaveProperty('averageDraftPositions');
    expect(result).toHaveProperty('mostFrequentPlayers');
    expect(result).toHaveProperty('roundTendencies');
    expect(result).toHaveProperty('yearOverYearTrends');
    expect(result).toHaveProperty('favoritePosition');
    expect(result).toHaveProperty('averagePickPosition');
    
    // Test integration of functions
    expect(result.totalPicks).toBe(4);
    expect(result.positionFrequencies.QB.count).toBe(2);
    expect(result.mostFrequentPlayers).toHaveLength(1); // Only Player A drafted multiple times
    expect(result.mostFrequentPlayers[0].playerName).toBe('Player A');
    expect(result.favoritePosition).toBe('QB'); // Most frequently drafted position
    expect(result.averagePickPosition).toBe(19); // (1+13+25+37)/4
  });

  test('should handle empty picks array', () => {
    const result = calculateManagerStatistics([]);
    
    expect(result.totalPicks).toBe(0);
    expect(result.positionFrequencies).toEqual({});
    expect(result.averageDraftPositions).toEqual({});
    expect(result.mostFrequentPlayers).toEqual([]);
    expect(result.roundTendencies.earlyRounds.count).toBe(0);
    expect(result.yearOverYearTrends).toEqual({});
  });

  test('should handle null picks', () => {
    const result = calculateManagerStatistics(null);
    
    expect(result.totalPicks).toBe(0);
    expect(result.positionFrequencies).toEqual({});
  });
});