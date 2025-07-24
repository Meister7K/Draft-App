/**
 * Unit tests for Historical Data Parser utilities
 */

import {
  extractDraftHistoryByManager,
  getManagerDraftHistory,
  enhancePicksWithPlayerData,
  filterHistoryByDateRange,
  getAvailableSeasons
} from '../historicalDataParser.js';

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
            },
            {
              pick_id: 'pick3',
              pick_no: 13,
              round: 2,
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
    },
    {
      player_info: {
        player_id: 'player3',
        name: 'Tyreek Hill',
        position: 'WR',
        team: 'MIA',
        projected_2025_points: 245.67
      }
    }
  ]
};

describe('extractDraftHistoryByManager', () => {
  test('should extract draft history for all managers', () => {
    const result = extractDraftHistoryByManager(mockData);
    
    expect(result).toHaveProperty('manager1');
    expect(result).toHaveProperty('manager2');
    
    expect(result.manager1.totalDrafts).toBe(2);
    expect(result.manager1.seasons).toEqual([2024, 2023]);
    expect(result.manager1.picks).toHaveLength(3);
    
    expect(result.manager2.totalDrafts).toBe(1);
    expect(result.manager2.seasons).toEqual([2024]);
    expect(result.manager2.picks).toHaveLength(1);
  });

  test('should handle empty data gracefully', () => {
    const result = extractDraftHistoryByManager({});
    expect(result).toEqual({});
  });

  test('should handle null data gracefully', () => {
    const result = extractDraftHistoryByManager(null);
    expect(result).toEqual({});
  });

  test('should handle leagues without drafts', () => {
    const dataWithoutDrafts = {
      leagues: {
        'league1': {
          league_id: 'league1',
          name: 'Test League'
        }
      }
    };
    
    const result = extractDraftHistoryByManager(dataWithoutDrafts);
    expect(result).toEqual({});
  });
});

describe('getManagerDraftHistory', () => {
  test('should get history for specific manager', () => {
    const result = getManagerDraftHistory(mockData, 'manager1');
    
    expect(result.totalDrafts).toBe(2);
    expect(result.seasons).toEqual([2024, 2023]);
    expect(result.picks).toHaveLength(3);
  });

  test('should return empty history for non-existent manager', () => {
    const result = getManagerDraftHistory(mockData, 'nonexistent');
    
    expect(result.totalDrafts).toBe(0);
    expect(result.seasons).toEqual([]);
    expect(result.picks).toEqual([]);
    expect(result.leagues).toEqual([]);
  });
});

describe('enhancePicksWithPlayerData', () => {
  test('should enhance picks with player data', () => {
    const picks = [
      {
        pick_id: 'pick1',
        metadata: {
          player_id: 'player1',
          first_name: 'Josh',
          last_name: 'Allen',
          position: 'QB'
        }
      }
    ];
    
    const result = enhancePicksWithPlayerData(picks, mockData);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('player');
    expect(result[0].player.player_info.name).toBe('Josh Allen');
    expect(result[0].playerName).toBe('Josh Allen');
    expect(result[0].position).toBe('QB');
  });

  test('should handle picks without player data', () => {
    const picks = [
      {
        pick_id: 'pick1',
        metadata: {
          player_id: 'nonexistent'
        }
      }
    ];
    
    const result = enhancePicksWithPlayerData(picks, mockData);
    
    expect(result).toHaveLength(1);
    expect(result[0].player).toBeNull();
    expect(result[0].playerName).toBe('Unknown Player');
  });

  test('should handle empty picks array', () => {
    const result = enhancePicksWithPlayerData([], mockData);
    expect(result).toEqual([]);
  });

  test('should handle null picks', () => {
    const result = enhancePicksWithPlayerData(null, mockData);
    expect(result).toEqual([]);
  });
});

describe('filterHistoryByDateRange', () => {
  const managerHistory = {
    totalDrafts: 2,
    seasons: [2024, 2023, 2022],
    picks: [
      { pick_id: 'pick1', season: 2024 },
      { pick_id: 'pick2', season: 2023 },
      { pick_id: 'pick3', season: 2022 }
    ],
    leagues: ['league1', 'league2']
  };

  test('should filter history by date range', () => {
    const result = filterHistoryByDateRange(managerHistory, 2023, 2024);
    
    expect(result.picks).toHaveLength(2);
    expect(result.seasons).toEqual([2024, 2023]);
    expect(result.totalDrafts).toBe(2);
  });

  test('should handle single season filter', () => {
    const result = filterHistoryByDateRange(managerHistory, 2024, 2024);
    
    expect(result.picks).toHaveLength(1);
    expect(result.seasons).toEqual([2024]);
    expect(result.totalDrafts).toBe(1);
  });

  test('should handle empty history', () => {
    const emptyHistory = { picks: [], seasons: [] };
    const result = filterHistoryByDateRange(emptyHistory, 2023, 2024);
    
    expect(result.picks).toEqual([]);
  });
});

describe('getAvailableSeasons', () => {
  test('should extract available seasons', () => {
    const result = getAvailableSeasons(mockData);
    
    expect(result).toEqual([2024, 2023]);
  });

  test('should handle empty data', () => {
    const result = getAvailableSeasons({});
    expect(result).toEqual([]);
  });

  test('should handle null data', () => {
    const result = getAvailableSeasons(null);
    expect(result).toEqual([]);
  });

  test('should sort seasons in descending order', () => {
    const dataWithMultipleSeasons = {
      leagues: {
        'league1': { season: 2022 },
        'league2': { season: 2024 },
        'league3': { season: 2023 }
      }
    };
    
    const result = getAvailableSeasons(dataWithMultipleSeasons);
    expect(result).toEqual([2024, 2023, 2022]);
  });
});