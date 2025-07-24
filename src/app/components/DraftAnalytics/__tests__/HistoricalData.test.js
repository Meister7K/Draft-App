/**
 * Integration tests for HistoricalData utility component
 */

import { 
  HistoricalDataManager,
  DataValidator, 
  ErrorRecovery, 
  HistoricalDataUtils 
} from '../HistoricalData.js';

// Mock fetch globally
global.fetch = vi.fn();

// Mock data for testing
const mockValidDatabase = {
  leagues: {
    'league1': {
      league_id: 'league1',
      name: 'Test League',
      season: 2024,
      drafts: {
        'draft1': {
          draft_id: 'draft1',
          picks: [
            {
              pick_id: 'pick1',
              picked_by: 'manager1',
              pick_no: 1,
              round: 1,
              metadata: {
                player_id: 'player1',
                first_name: 'John',
                last_name: 'Doe',
                position: 'RB'
              }
            },
            {
              pick_id: 'pick2',
              picked_by: 'manager1',
              pick_no: 13,
              round: 2,
              metadata: {
                player_id: 'player2',
                first_name: 'Jane',
                last_name: 'Smith',
                position: 'WR'
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
        name: 'John Doe',
        position: 'RB'
      }
    },
    {
      player_info: {
        player_id: 'player2',
        name: 'Jane Smith',
        position: 'WR'
      }
    }
  ]
};

const mockInvalidDatabase = {
  leagues: null,
  players: 'invalid'
};

describe('DataValidator', () => {
  describe('validateDatabase', () => {
    test('should validate correct database structure', () => {
      const result = DataValidator.validateDatabase(mockValidDatabase);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject null database', () => {
      const result = DataValidator.validateDatabase(null);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Database is null or not an object');
    });

    test('should reject database without leagues', () => {
      const result = DataValidator.validateDatabase({ players: [] });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Database missing leagues data');
    });

    test('should reject database without players', () => {
      const result = DataValidator.validateDatabase({ leagues: {} });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Database missing or invalid players data');
    });
  });

  describe('validateLeague', () => {
    test('should validate correct league structure', () => {
      const league = mockValidDatabase.leagues.league1;
      const result = DataValidator.validateLeague(league);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject league without league_id', () => {
      const league = { name: 'Test League' };
      const result = DataValidator.validateLeague(league);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('League missing league_id');
    });

    test('should warn about missing draft data', () => {
      const league = { league_id: 'test', name: 'Test' };
      const result = DataValidator.validateLeague(league);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('League missing draft data');
    });
  });

  describe('validatePick', () => {
    test('should validate correct pick structure', () => {
      const pick = mockValidDatabase.leagues.league1.drafts.draft1.picks[0];
      const result = DataValidator.validatePick(pick);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject pick without picked_by', () => {
      const pick = { pick_no: 1, round: 1 };
      const result = DataValidator.validatePick(pick);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Pick missing picked_by field');
    });

    test('should warn about missing metadata', () => {
      const pick = { picked_by: 'manager1', pick_no: 1 };
      const result = DataValidator.validatePick(pick);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Pick missing player metadata');
    });
  });

  describe('validateManagerData', () => {
    test('should validate correct manager data', () => {
      const managerData = {
        managerId: 'manager1',
        picks: [{ picked_by: 'manager1' }],
        seasons: [2024]
      };
      const result = DataValidator.validateManagerData(managerData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject manager data without managerId', () => {
      const managerData = { picks: [], seasons: [] };
      const result = DataValidator.validateManagerData(managerData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Manager data missing managerId');
    });

    test('should warn about empty picks', () => {
      const managerData = {
        managerId: 'manager1',
        picks: [],
        seasons: []
      };
      const result = DataValidator.validateManagerData(managerData);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Manager has no draft picks');
    });
  });
});

describe('ErrorRecovery', () => {
  describe('retryWithBackoff', () => {
    test('should succeed on first attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      const result = await ErrorRecovery.retryWithBackoff(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should retry on failure and eventually succeed', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const result = await ErrorRecovery.retryWithBackoff(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('should fail after max attempts', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('persistent failure'));
      
      await expect(ErrorRecovery.retryWithBackoff(mockFn, 2))
        .rejects.toThrow('persistent failure');
      
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('getFallbackManagerData', () => {
    test('should return valid fallback data structure', () => {
      const fallback = ErrorRecovery.getFallbackManagerData('manager1');
      
      expect(fallback.managerId).toBe('manager1');
      expect(fallback.totalDrafts).toBe(0);
      expect(Array.isArray(fallback.picks)).toBe(true);
      expect(Array.isArray(fallback.seasons)).toBe(true);
      expect(fallback.dataQuality).toBe('fallback');
    });
  });

  describe('sanitizeData', () => {
    test('should return null for invalid input', () => {
      expect(ErrorRecovery.sanitizeData(null)).toBeNull();
      expect(ErrorRecovery.sanitizeData('string')).toBeNull();
    });

    test('should sanitize valid data', () => {
      const result = ErrorRecovery.sanitizeData(mockValidDatabase);
      
      expect(result).toBeDefined();
      expect(result.leagues).toBeDefined();
      expect(result.players).toBeDefined();
    });

    test('should remove invalid leagues', () => {
      const corruptedData = {
        leagues: {
          'valid': mockValidDatabase.leagues.league1,
          'invalid': null,
          'missing_id': { name: 'Test' }
        },
        players: mockValidDatabase.players
      };
      
      const result = ErrorRecovery.sanitizeData(corruptedData);
      
      expect(Object.keys(result.leagues)).toHaveLength(1);
      expect(result.leagues.valid).toBeDefined();
      expect(result.leagues.invalid).toBeUndefined();
    });

    test('should filter invalid players', () => {
      const corruptedData = {
        leagues: mockValidDatabase.leagues,
        players: [
          mockValidDatabase.players[0],
          null,
          { invalid: 'player' },
          mockValidDatabase.players[1]
        ]
      };
      
      const result = ErrorRecovery.sanitizeData(corruptedData);
      
      expect(result.players).toHaveLength(2);
    });
  });
});

describe('HistoricalDataManager', () => {
  let manager;

  beforeEach(() => {
    fetch.mockClear();
    manager = new HistoricalDataManager();
    // Clear cache to ensure clean state
    manager.clearCache();
  });

  afterEach(() => {
    if (manager) {
      manager.cleanup();
    }
  });

  test('should load database successfully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidDatabase
    });

    const result = await manager.loadDatabase();

    expect(result).toEqual(mockValidDatabase);
    expect(manager.data).toEqual(mockValidDatabase);
    expect(manager.error).toBeNull();
    expect(manager.loading).toBe(false);
  });

  test('should handle network errors', async () => {
    // Create a fresh manager to avoid cache issues
    const freshManager = new HistoricalDataManager();
    freshManager.clearCache();
    
    // Mock all retry attempts to fail
    fetch.mockRejectedValue(new Error('Network error'));

    try {
      await freshManager.loadDatabase();
      expect.fail('Expected loadDatabase to throw an error');
    } catch (error) {
      expect(error.message).toContain('Network error');
      expect(freshManager.error).toBeTruthy();
      expect(freshManager.data).toBeNull();
    }
  });

  test('should handle validation errors', async () => {
    // Create a fresh manager to avoid cache issues
    const freshManager = new HistoricalDataManager();
    freshManager.clearCache();
    
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockInvalidDatabase
    });

    try {
      await freshManager.loadDatabase();
      expect.fail('Expected loadDatabase to throw an error');
    } catch (error) {
      expect(error.message).toContain('Data validation failed');
      expect(freshManager.error).toContain('Data validation failed');
    }
  });

  test('should load manager data', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidDatabase
    });

    // First load the database
    await manager.loadDatabase();

    // Then load manager data
    const managerData = await manager.loadManagerData('manager1');

    expect(managerData).toBeDefined();
    expect(managerData.managerId).toBe('manager1');
    expect(managerData.picks).toBeDefined();
  });

  test('should return fallback data for invalid manager', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidDatabase
    });

    await manager.loadDatabase();

    const managerData = await manager.loadManagerData('nonexistent_manager');

    expect(managerData).toBeDefined();
    expect(managerData.managerId).toBe('nonexistent_manager');
    expect(managerData.totalDrafts).toBe(0);
  });

  test('should preload multiple managers data', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidDatabase
    });

    await manager.loadDatabase();

    const managersData = await manager.preloadManagersData(['manager1', 'manager2']);

    expect(managersData).toBeDefined();
    expect(managersData.manager1).toBeDefined();
    expect(managersData.manager2).toBeDefined();
  });

  test('should clear cache', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidDatabase
    });

    await manager.loadDatabase();
    expect(manager.data).toBeDefined();

    manager.clearCache();
    expect(manager.data).toBeNull();
  });

  test('should provide cache statistics', () => {
    const stats = manager.getCacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('keys');
    expect(stats).toHaveProperty('timestamps');
  });
});

describe('HistoricalDataUtils', () => {
  describe('hasSufficientData', () => {
    test('should return true for sufficient data', () => {
      const managerData = {
        picks: new Array(10).fill({ picked_by: 'manager1' }),
        seasons: [2023, 2024]
      };
      
      expect(HistoricalDataUtils.hasSufficientData(managerData)).toBe(true);
    });

    test('should return false for insufficient picks', () => {
      const managerData = {
        picks: [{ picked_by: 'manager1' }],
        seasons: [2024]
      };
      
      expect(HistoricalDataUtils.hasSufficientData(managerData)).toBe(false);
    });

    test('should return false for no seasons', () => {
      const managerData = {
        picks: new Array(10).fill({ picked_by: 'manager1' }),
        seasons: []
      };
      
      expect(HistoricalDataUtils.hasSufficientData(managerData)).toBe(false);
    });
  });

  describe('assessDataQuality', () => {
    test('should assess excellent quality data', () => {
      const managerData = {
        picks: new Array(50).fill({
          picked_by: 'manager1',
          metadata: { player_id: 'player1' }
        }),
        seasons: [2022, 2023, 2024]
      };
      
      const assessment = HistoricalDataUtils.assessDataQuality(managerData);
      
      expect(assessment.quality).toBe('excellent');
      expect(assessment.score).toBeGreaterThanOrEqual(80);
    });

    test('should assess fair quality data with issues', () => {
      const managerData = {
        picks: new Array(15).fill({ picked_by: 'manager1' }), // 15 picks, all missing metadata
        seasons: [2024]
      };
      
      const assessment = HistoricalDataUtils.assessDataQuality(managerData);
      
      expect(assessment.quality).toBe('fair');
      expect(assessment.issues.length).toBeGreaterThan(0);
      expect(assessment.issues).toContain('Limited draft history');
      expect(assessment.issues).toContain('Single season data only');
    });

    test('should handle no data', () => {
      const assessment = HistoricalDataUtils.assessDataQuality(null);
      
      expect(assessment.quality).toBe('none');
      expect(assessment.score).toBe(0);
    });
  });

  describe('formatErrorMessage', () => {
    test('should format network errors', () => {
      const error = new Error('Failed to fetch');
      const message = HistoricalDataUtils.formatErrorMessage(error);
      
      expect(message).toContain('Unable to connect to the server');
    });

    test('should format timeout errors', () => {
      const error = new Error('Request timeout');
      const message = HistoricalDataUtils.formatErrorMessage(error);
      
      expect(message).toContain('Request timed out');
    });

    test('should format validation errors', () => {
      const error = new Error('Data validation failed');
      const message = HistoricalDataUtils.formatErrorMessage(error);
      
      expect(message).toContain('data format is invalid');
    });

    test('should handle string errors', () => {
      const message = HistoricalDataUtils.formatErrorMessage('Simple error');
      
      expect(message).toBe('Simple error');
    });

    test('should handle null errors', () => {
      const message = HistoricalDataUtils.formatErrorMessage(null);
      
      expect(message).toBeNull();
    });
  });
});

describe('Integration Tests', () => {
  test('should validate and sanitize data workflow', () => {
    // Test data validation
    const validation = DataValidator.validateDatabase(mockValidDatabase);
    expect(validation.isValid).toBe(true);
    
    // Test data sanitization
    const corruptedData = {
      leagues: {
        'valid': mockValidDatabase.leagues.league1,
        'invalid': null
      },
      players: [
        mockValidDatabase.players[0],
        null,
        mockValidDatabase.players[1]
      ]
    };
    
    const sanitized = ErrorRecovery.sanitizeData(corruptedData);
    expect(sanitized).toBeDefined();
    expect(sanitized.leagues.invalid).toBeUndefined();
    expect(sanitized.players.length).toBe(2);
  });

  test('should handle error recovery and fallback workflow', async () => {
    // Test retry mechanism
    let attempts = 0;
    const mockFn = () => {
      attempts++;
      if (attempts < 2) {
        throw new Error('Network error');
      }
      return 'success';
    };

    const result = await ErrorRecovery.retryWithBackoff(mockFn);
    expect(result).toBe('success');
    expect(attempts).toBe(2);

    // Test fallback data
    const fallback = ErrorRecovery.getFallbackManagerData('manager1');
    expect(fallback.managerId).toBe('manager1');
    expect(fallback.dataQuality).toBe('fallback');
  });

  test('should assess data quality workflow', () => {
    // Test excellent quality data
    const excellentData = {
      picks: new Array(50).fill({
        picked_by: 'manager1',
        metadata: { player_id: 'player1' }
      }),
      seasons: [2022, 2023, 2024]
    };
    
    const excellentAssessment = HistoricalDataUtils.assessDataQuality(excellentData);
    expect(excellentAssessment.quality).toBe('excellent');
    
    // Test fair quality data with issues
    const fairData = {
      picks: new Array(15).fill({ picked_by: 'manager1' }), // 15 picks, all missing metadata
      seasons: [2024]
    };
    
    const fairAssessment = HistoricalDataUtils.assessDataQuality(fairData);
    expect(fairAssessment.quality).toBe('fair');
    expect(fairAssessment.issues.length).toBeGreaterThan(0);
  });
});