/**
 * Unit tests for Statistical Analysis Engine
 */

import {
  calculatePositionFrequency,
  analyzeMostFrequentPlayers,
  analyzeTrends,
  calculateDraftingTendencies,
  calculateManagerStatistics
} from '../StatisticalAnalysis.js';

// Mock data for testing
const mockManagerPicks = [
  {
    pick_id: '1',
    picked_by: 'manager1',
    pick_no: 1,
    round: 1,
    draft_slot: 1,
    metadata: {
      player_id: 'player1',
      first_name: 'Josh',
      last_name: 'Allen',
      position: 'QB',
      team: 'BUF'
    },
    season: 2024
  },
  {
    pick_id: '2',
    picked_by: 'manager1',
    pick_no: 25,
    round: 3,
    draft_slot: 1,
    metadata: {
      player_id: 'player2',
      first_name: 'Saquon',
      last_name: 'Barkley',
      position: 'RB',
      team: 'PHI'
    },
    season: 2024
  },
  {
    pick_id: '3',
    picked_by: 'manager1',
    pick_no: 49,
    round: 5,
    draft_slot: 1,
    metadata: {
      player_id: 'player3',
      first_name: 'CeeDee',
      last_name: 'Lamb',
      position: 'WR',
      team: 'DAL'
    },
    season: 2024
  },
  {
    pick_id: '4',
    picked_by: 'manager1',
    pick_no: 73,
    round: 7,
    draft_slot: 1,
    metadata: {
      player_id: 'player1',
      first_name: 'Josh',
      last_name: 'Allen',
      position: 'QB',
      team: 'BUF'
    },
    season: 2023
  },
  {
    pick_id: '5',
    picked_by: 'manager1',
    pick_no: 97,
    round: 9,
    draft_slot: 1,
    metadata: {
      player_id: 'player4',
      first_name: 'Travis',
      last_name: 'Kelce',
      position: 'TE',
      team: 'KC'
    },
    season: 2024
  }
];

const mockAllPicks = [
  ...mockManagerPicks,
  {
    pick_id: '6',
    picked_by: 'manager2',
    pick_no: 2,
    round: 1,
    draft_slot: 2,
    metadata: {
      player_id: 'player5',
      first_name: 'Lamar',
      last_name: 'Jackson',
      position: 'QB',
      team: 'BAL'
    },
    season: 2024
  }
];

describe('calculatePositionFrequency', () => {
  test('should calculate position frequency correctly', () => {
    const result = calculatePositionFrequency(mockManagerPicks);
    
    expect(result).toHaveProperty('QB');
    expect(result).toHaveProperty('RB');
    expect(result).toHaveProperty('WR');
    expect(result).toHaveProperty('TE');
    
    // QB appears twice out of 5 picks = 40%
    expect(result.QB.count).toBe(2);
    expect(result.QB.percentage).toBe(40);
    expect(result.QB.avgRound).toBe(4); // (1 + 7) / 2 = 4
    expect(result.QB.earliestRound).toBe(1);
    expect(result.QB.latestRound).toBe(7);
    
    // RB appears once out of 5 picks = 20%
    expect(result.RB.count).toBe(1);
    expect(result.RB.percentage).toBe(20);
    expect(result.RB.avgRound).toBe(3);
  });

  test('should handle empty picks array', () => {
    const result = calculatePositionFrequency([]);
    expect(result).toEqual({});
  });

  test('should handle null/undefined input', () => {
    expect(calculatePositionFrequency(null)).toEqual({});
    expect(calculatePositionFrequency(undefined)).toEqual({});
  });

  test('should handle picks without metadata', () => {
    const picksWithoutMetadata = [
      { pick_id: '1', picked_by: 'manager1', pick_no: 1, round: 1 }
    ];
    const result = calculatePositionFrequency(picksWithoutMetadata);
    expect(result).toEqual({});
  });
});

describe('analyzeMostFrequentPlayers', () => {
  test('should identify frequently drafted players', () => {
    const result = analyzeMostFrequentPlayers(mockManagerPicks);
    
    expect(result).toHaveLength(1); // Only Josh Allen appears twice
    expect(result[0].playerName).toBe('Josh Allen');
    expect(result[0].draftCount).toBe(2);
    expect(result[0].percentage).toBe(40); // 2 out of 5 picks
    expect(result[0].position).toBe('QB');
    expect(result[0].avgDraftPosition).toBe(37); // (1 + 73) / 2 = 37
    expect(result[0].positionRange.earliest).toBe(1);
    expect(result[0].positionRange.latest).toBe(73);
  });

  test('should return empty array for no frequent players', () => {
    const singlePicks = mockManagerPicks.slice(0, 3); // No duplicates
    const result = analyzeMostFrequentPlayers(singlePicks);
    expect(result).toEqual([]);
  });

  test('should handle empty picks array', () => {
    const result = analyzeMostFrequentPlayers([]);
    expect(result).toEqual([]);
  });

  test('should sort by draft count then by average draft position', () => {
    const multipleFrequentPicks = [
      ...mockManagerPicks,
      {
        pick_id: '7',
        picked_by: 'manager1',
        pick_no: 10,
        round: 1,
        metadata: {
          player_id: 'player2',
          first_name: 'Saquon',
          last_name: 'Barkley',
          position: 'RB',
          team: 'PHI'
        },
        season: 2023
      }
    ];
    
    const result = analyzeMostFrequentPlayers(multipleFrequentPicks);
    expect(result).toHaveLength(2);
    
    // Both players drafted twice, but Saquon has better average position
    expect(result[0].playerName).toBe('Saquon Barkley');
    expect(result[0].avgDraftPosition).toBe(17.5); // (25 + 10) / 2
    expect(result[1].playerName).toBe('Josh Allen');
    expect(result[1].avgDraftPosition).toBe(37); // (1 + 73) / 2
  });
});

describe('analyzeTrends', () => {
  test('should analyze trends across multiple seasons', () => {
    const result = analyzeTrends(mockAllPicks, 'manager1');
    
    expect(result.seasons).toEqual([2023, 2024]);
    expect(result.totalSeasons).toBe(2);
    expect(result.totalPicks).toBe(5);
    expect(result.positionTrends).toHaveProperty('QB');
    expect(result.positionTrends).toHaveProperty('RB');
    expect(result.positionTrends).toHaveProperty('WR');
    expect(result.positionTrends).toHaveProperty('TE');
    expect(result.evolutionPattern).toBeDefined();
    expect(result.adaptability).toBeGreaterThanOrEqual(0);
    expect(result.adaptability).toBeLessThanOrEqual(100);
  });

  test('should handle insufficient data', () => {
    const result = analyzeTrends([], 'manager1');
    
    expect(result.seasons).toEqual([]);
    expect(result.positionTrends).toEqual({});
    expect(result.evolutionPattern).toBe('insufficient-data');
    expect(result.adaptability).toBe(0);
  });

  test('should handle single season data', () => {
    const singleSeasonPicks = mockManagerPicks.filter(pick => pick.season === 2024);
    const result = analyzeTrends(singleSeasonPicks, 'manager1');
    
    expect(result.seasons).toEqual(['2024']);
    expect(result.evolutionPattern).toBe('insufficient-seasons');
  });

  test('should handle non-existent manager', () => {
    const result = analyzeTrends(mockAllPicks, 'nonexistent');
    
    expect(result.evolutionPattern).toBe('insufficient-data');
    expect(result.seasons).toEqual([]);
  });
});

describe('calculateDraftingTendencies', () => {
  test('should calculate early vs late round tendencies', () => {
    const result = calculateDraftingTendencies(mockManagerPicks, 6);
    
    expect(result.totalPicks).toBe(5);
    expect(result.earlyRounds.count).toBe(3); // Rounds 1, 3, 5
    expect(result.lateRounds.count).toBe(2); // Rounds 7, 9
    expect(result.earlyRounds.percentage).toBe(60);
    expect(result.lateRounds.percentage).toBe(40);
    expect(result.tendency).toBe('balanced'); // 60% is exactly at threshold
    expect(result.averageRound).toBe(5); // (1+3+5+7+9)/5 = 5
  });

  test('should handle custom early round threshold', () => {
    const result = calculateDraftingTendencies(mockManagerPicks, 3);
    
    expect(result.earlyRounds.count).toBe(2); // Rounds 1, 3
    expect(result.lateRounds.count).toBe(3); // Rounds 5, 7, 9
    expect(result.earlyRounds.percentage).toBe(40);
    expect(result.tendency).toBe('balanced'); // 40% is between 40-60%
  });

  test('should calculate position breakdown for early/late rounds', () => {
    const result = calculateDraftingTendencies(mockManagerPicks, 6);
    
    // Early rounds: QB (round 1), RB (round 3), WR (round 5)
    expect(result.earlyRounds.positions).toHaveProperty('QB');
    expect(result.earlyRounds.positions).toHaveProperty('RB');
    expect(result.earlyRounds.positions).toHaveProperty('WR');
    expect(result.earlyRounds.positions.QB).toBe(33.3); // 1 out of 3 early picks
    
    // Late rounds: QB (round 7), TE (round 9)
    expect(result.lateRounds.positions).toHaveProperty('QB');
    expect(result.lateRounds.positions).toHaveProperty('TE');
    expect(result.lateRounds.positions.QB).toBe(50); // 1 out of 2 late picks
  });

  test('should handle empty picks array', () => {
    const result = calculateDraftingTendencies([]);
    
    expect(result.earlyRounds.count).toBe(0);
    expect(result.lateRounds.count).toBe(0);
    expect(result.tendency).toBe('balanced');
    expect(result.averageRound).toBe(0);
  });
});

describe('calculateManagerStatistics', () => {
  test('should return comprehensive statistics', () => {
    const result = calculateManagerStatistics(
      mockManagerPicks,
      mockAllPicks,
      'manager1'
    );
    
    expect(result).toHaveProperty('positionFrequency');
    expect(result).toHaveProperty('frequentPlayers');
    expect(result).toHaveProperty('trends');
    expect(result).toHaveProperty('draftingTendencies');
    expect(result.totalDrafts).toBe(5);
    expect(result.seasonsAnalyzed).toBe(2);
    
    // Verify all sub-analyses are included
    expect(result.positionFrequency).toHaveProperty('QB');
    expect(result.frequentPlayers).toHaveLength(1);
    expect(result.trends.seasons).toEqual([2023, 2024]);
    expect(result.draftingTendencies.tendency).toBe('balanced');
  });

  test('should handle empty data gracefully', () => {
    const result = calculateManagerStatistics([], [], 'manager1');
    
    expect(result.totalDrafts).toBe(0);
    expect(result.seasonsAnalyzed).toBe(0);
    expect(result.positionFrequency).toEqual({});
    expect(result.frequentPlayers).toEqual([]);
    expect(result.trends.evolutionPattern).toBe('insufficient-data');
  });
});

// Edge cases and error handling
describe('Edge cases and error handling', () => {
  test('should handle picks with missing round information', () => {
    const picksWithMissingRounds = [
      {
        pick_id: '1',
        picked_by: 'manager1',
        pick_no: 1,
        metadata: {
          player_id: 'player1',
          first_name: 'Josh',
          last_name: 'Allen',
          position: 'QB',
          team: 'BUF'
        }
      }
    ];
    
    const positionFreq = calculatePositionFrequency(picksWithMissingRounds);
    expect(positionFreq.QB.avgRound).toBe(0);
    
    const tendencies = calculateDraftingTendencies(picksWithMissingRounds);
    expect(tendencies.averageRound).toBe(0);
  });

  test('should handle picks with missing player names', () => {
    const picksWithMissingNames = [
      {
        pick_id: '1',
        picked_by: 'manager1',
        pick_no: 1,
        round: 1,
        metadata: {
          player_id: 'player1',
          position: 'QB',
          team: 'BUF'
        }
      }
    ];
    
    const frequentPlayers = analyzeMostFrequentPlayers(picksWithMissingNames);
    expect(frequentPlayers).toEqual([]);
  });

  test('should handle very large datasets efficiently', () => {
    // Create a large dataset
    const largePicks = [];
    for (let i = 0; i < 1000; i++) {
      largePicks.push({
        pick_id: `pick_${i}`,
        picked_by: 'manager1',
        pick_no: i + 1,
        round: Math.floor(i / 12) + 1,
        metadata: {
          player_id: `player_${i % 100}`, // Some duplicates
          first_name: `Player`,
          last_name: `${i % 100}`,
          position: ['QB', 'RB', 'WR', 'TE'][i % 4],
          team: 'TEST'
        },
        season: 2020 + (i % 5)
      });
    }
    
    const start = performance.now();
    const result = calculateManagerStatistics(largePicks, largePicks, 'manager1');
    const end = performance.now();
    
    expect(result.totalDrafts).toBe(1000);
    expect(end - start).toBeLessThan(1000); // Should complete in under 1 second
  });
});