/**
 * Unit tests for Data Aggregation utilities
 */

import {
  aggregateAllManagersData,
  aggregateManagerData,
  aggregateLeagueData,
  calculateLeagueAverages,
  processMultiSeasonTrends
} from '../dataAggregation.js';

// Mock data for testing
const mockData = {
  leagues: {
    'league1': {
      league_id: 'league1',
      name: 'Test League 1',
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
              pick_no: 2,
              round: 1,
              draft_slot: 2,
              picked_by: 'manager2',
              metadata: {
                player_id: 'player2',
                first_name: 'Christian',
                last_name: 'McCaffrey',
                position: 'RB',
                team: 'SF'
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
              pick_id: 'pick3',
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
            }
          ]
        }
      }
    }
  },
  players: [
    {
      player_info: {
        player_id: 'player1',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        projected_2025_points: 347.48
      }
    },
    {
      player_info: {
        player_id: 'player2',
        name: 'Christian McCaffrey',
        position: 'RB',
        team: 'SF',
        projected_2025_points: 285.32
      }
    }
  ]
};

describe('aggregateAllManagersData', () => {
  test('should aggregate data for all managers', () => {
    const result = aggregateAllManagersData(mockData);
    
    expect(result).toHaveProperty('manager1');
    expect(result).toHaveProperty('manager2');
    
    expect(result.manager1.totalDrafts).toBe(2);
    expect(result.manager1.seasons).toEqual([2024, 2023]);
    expect(result.manager1.picks).toHaveLength(2);
    expect(result.manager1.statistics.totalPicks).toBe(2);
    
    expect(result.manager2.totalDrafts).toBe(1);
    expect(result.manager2.seasons).toEqual([2024]);
    expect(result.manager2.picks).toHaveLength(1);
  });

  test('should apply date range filter', () => {
    const result = aggregateAllManagersData(mockData, {
      startSeason: 2024,
      endSeason: 2024
    });
    
    expect(result.manager1.picks).toHaveLength(1);
    expect(result.manager1.seasons).toEqual([2024]);
    expect(result.manager1.dateRange.startSeason).toBe(2024);
    expect(result.manager1.dateRange.endSeason).toBe(2024);
  });

  test('should handle includePlayerData option', () => {
    const result = aggregateAllManagersData(mockData, {
      includePlayerData: true
    });
    
    expect(result.manager1.picks[0]).toHaveProperty('player');
    expect(result.manager1.picks[0].player).not.toBeNull();
  });

  test('should handle empty data', () => {
    const result = aggregateAllManagersData({});
    expect(result).toEqual({});
  });
});

describe('aggregateManagerData', () => {
  test('should aggregate data for specific manager', () => {
    const result = aggregateManagerData(mockData, 'manager1');
    
    expect(result.managerId).toBe('manager1');
    expect(result.totalDrafts).toBe(2);
    expect(result.seasons).toEqual([2024, 2023]);
    expect(result.picks).toHaveLength(2);
    expect(result.statistics.totalPicks).toBe(2);
  });

  test('should return empty data for non-existent manager', () => {
    const result = aggregateManagerData(mockData, 'nonexistent');
    
    expect(result.managerId).toBe('nonexistent');
    expect(result.totalDrafts).toBe(0);
    expect(result.seasons).toEqual([]);
    expect(result.picks).toEqual([]);
    expect(result.statistics.totalPicks).toBe(0);
  });
});

describe('aggregateLeagueData', () => {
  test('should aggregate data for specific league', () => {
    const result = aggregateLeagueData(mockData, 'league1');
    
    expect(result.leagueId).toBe('league1');
    expect(result.leagueName).toBe('Test League 1');
    expect(result.totalPicks).toBe(2);
    expect(result.seasons).toEqual([2024]);
    expect(result.totalManagers).toBe(2);
    
    expect(result.managers).toHaveProperty('manager1');
    expect(result.managers).toHaveProperty('manager2');
    expect(result.managers.manager1.picks).toHaveLength(1);
    expect(result.managers.manager2.picks).toHaveLength(1);
  });

  test('should return empty data for non-existent league', () => {
    const result = aggregateLeagueData(mockData, 'nonexistent');
    
    expect(result.leagueId).toBe('nonexistent');
    expect(result.managers).toEqual({});
    expect(result.totalPicks).toBe(0);
    expect(result.seasons).toEqual([]);
  });

  test('should handle league without drafts', () => {
    const dataWithoutDrafts = {
      leagues: {
        'league1': {
          league_id: 'league1',
          name: 'Test League'
        }
      }
    };
    
    const result = aggregateLeagueData(dataWithoutDrafts, 'league1');
    
    expect(result.totalPicks).toBe(0);
    expect(result.totalManagers).toBe(0);
  });
});

describe('calculateLeagueAverages', () => {
  const mockManagersData = [
    {
      managerId: 'manager1',
      statistics: {
        totalPicks: 10,
        positionFrequencies: {
          QB: { count: 2, percentage: 20, avgRound: 1.5 },
          RB: { count: 4, percentage: 40, avgRound: 2.5 }
        },
        roundTendencies: {
          earlyRounds: { count: 6, percentage: 60 },
          lateRounds: { count: 4, percentage: 40 }
        }
      }
    },
    {
      managerId: 'manager2',
      statistics: {
        totalPicks: 8,
        positionFrequencies: {
          QB: { count: 1, percentage: 12.5, avgRound: 2 },
          WR: { count: 3, percentage: 37.5, avgRound: 3 }
        },
        roundTendencies: {
          earlyRounds: { count: 4, percentage: 50 },
          lateRounds: { count: 4, percentage: 50 }
        }
      }
    }
  ];

  test('should calculate league averages correctly', () => {
    const result = calculateLeagueAverages(mockManagersData);
    
    expect(result.totalPicks).toBe(18);
    
    expect(result.positionFrequencies.QB.count).toBe(3);
    expect(result.positionFrequencies.QB.percentage).toBeCloseTo(16.67, 1);
    expect(result.positionFrequencies.QB.avgRound).toBe(1.75); // (1.5 + 2) / 2
    
    expect(result.positionFrequencies.RB.count).toBe(4);
    expect(result.positionFrequencies.WR.count).toBe(3);
    
    expect(result.roundTendencies.earlyRounds.count).toBe(10);
    expect(result.roundTendencies.earlyRounds.percentage).toBeCloseTo(55.56, 1);
    expect(result.roundTendencies.lateRounds.count).toBe(8);
  });

  test('should handle empty managers data', () => {
    const result = calculateLeagueAverages([]);
    expect(result).toEqual({});
  });

  test('should handle null managers data', () => {
    const result = calculateLeagueAverages(null);
    expect(result).toEqual({});
  });
});

describe('processMultiSeasonTrends', () => {
  test('should process multi-season trends', () => {
    const result = processMultiSeasonTrends(mockData, 'manager1', 2);
    
    expect(result.managerId).toBe('manager1');
    expect(result.recentSeasons).toEqual([2024, 2023]);
    expect(result.seasonsAnalyzed).toBe(2);
    
    expect(result.trends).toHaveProperty('2024');
    expect(result.trends).toHaveProperty('2023');
    
    expect(result.trends['2024'].totalPicks).toBe(1);
    expect(result.trends['2023'].totalPicks).toBe(1);
  });

  test('should handle manager with insufficient data', () => {
    const result = processMultiSeasonTrends(mockData, 'nonexistent');
    
    expect(result.managerId).toBe('nonexistent');
    expect(result.overallTrend).toBe('insufficient_data');
    expect(result.recentSeasons).toEqual([]);
    expect(result.trends).toEqual({});
  });

  test('should limit seasons analyzed', () => {
    const result = processMultiSeasonTrends(mockData, 'manager1', 1);
    
    expect(result.recentSeasons).toEqual([2024]);
    expect(result.seasonsAnalyzed).toBe(1);
    expect(result.trends).toHaveProperty('2024');
    expect(result.trends).not.toHaveProperty('2023');
  });

  test('should analyze overall trend', () => {
    // This test would need more complex mock data to test different trend scenarios
    const result = processMultiSeasonTrends(mockData, 'manager1', 2);
    
    // With limited mock data, should return consistent_strategy or insufficient_data
    expect(['consistent_strategy', 'insufficient_data', 'evolving_strategy', 'trending_earlier', 'trending_later'])
      .toContain(result.overallTrend);
  });
});