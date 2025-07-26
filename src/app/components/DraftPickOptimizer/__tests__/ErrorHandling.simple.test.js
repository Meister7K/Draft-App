/**
 * Simple tests for error handling functionality without UI testing
 * Tests core error handling logic, fallback mechanisms, and data validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateFallbackRecommendations, validatePlayerData, createEmptyRecommendation } from '../FallbackRecommendations';
import { validateAndSanitizePlayer, validatePlayerArray, validateDraftContext, createDegradedContext, canProvideRecommendations } from '../GracefulDegradation';
import { retryWithBackoff, createRetryableOptimization, OptimizationCircuitBreaker, CIRCUIT_STATES } from '../RetryMechanism';

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('FallbackRecommendations', () => {
  const mockPlayers = [
    {
      player_info: {
        player_id: 'player1',
        name: 'Test Player 1',
        position: 'RB',
        projected_2025_points: 200,
        overall_rank: 10,
        position_rank: 5,
        team: 'TEST'
      }
    },
    {
      player_info: {
        player_id: 'player2',
        name: 'Test Player 2',
        position: 'WR',
        projected_2025_points: 180,
        overall_rank: 15,
        position_rank: 8,
        team: 'TEST'
      }
    }
  ];

  const mockContext = {
    currentRoster: { starters: {}, bench: [], positionCounts: {} },
    rosterFormat: [
      { position: 'QB', slots: 1 },
      { position: 'RB', slots: 2 },
      { position: 'WR', slots: 2 }
    ],
    memberPicks: []
  };

  it('should generate fallback recommendations', () => {
    const recommendations = generateFallbackRecommendations(mockPlayers, mockContext);
    
    expect(recommendations).toHaveLength(2);
    expect(recommendations[0].player.name).toBe('Test Player 1');
    expect(recommendations[0].optimization.score).toBeGreaterThan(0);
    expect(recommendations[0].recommendation.reasoning).toContain('simplified recommendation');
  });

  it('should handle empty player array', () => {
    const recommendations = generateFallbackRecommendations([], mockContext);
    expect(recommendations).toHaveLength(0);
  });

  it('should validate player data', () => {
    const validPlayers = validatePlayerData(mockPlayers);
    expect(validPlayers).toHaveLength(2);

    const invalidPlayers = validatePlayerData([
      { invalid: 'data' },
      null,
      undefined,
      { player_info: { player_id: 'valid' } } // Missing required fields
    ]);
    expect(invalidPlayers).toHaveLength(0);
  });

  it('should create empty recommendation when no players available', () => {
    const emptyRec = createEmptyRecommendation();
    expect(emptyRec.player.name).toBe('No Players Available');
    expect(emptyRec.optimization.score).toBe(0);
  });
});

describe('GracefulDegradation', () => {
  const validPlayer = {
    player_info: {
      player_id: 'player1',
      name: 'Test Player',
      position: 'RB',
      projected_2025_points: 200,
      overall_rank: 10
    }
  };

  it('should validate and sanitize valid player', () => {
    const sanitized = validateAndSanitizePlayer(validPlayer);
    expect(sanitized).toBeTruthy();
    expect(sanitized.player_info.name).toBe('Test Player');
  });

  it('should handle invalid player data', () => {
    const invalidPlayer = { invalid: 'data' };
    const sanitized = validateAndSanitizePlayer(invalidPlayer, { strict: false });
    expect(sanitized.player_info.name).toBe('Unknown Player');
  });

  it('should return null for invalid player in strict mode', () => {
    const invalidPlayer = { invalid: 'data' };
    const sanitized = validateAndSanitizePlayer(invalidPlayer, { strict: true });
    expect(sanitized).toBeNull();
  });

  it('should validate player array', () => {
    const players = [validPlayer, { invalid: 'data' }, null];
    const validated = validatePlayerArray(players, { strict: false, fillDefaults: true });
    // With fillDefaults=true, invalid data gets sanitized into valid players
    expect(validated).toHaveLength(2); // validPlayer + sanitized invalid player
    
    // With strict mode, invalid players are filtered out
    const validatedStrict = validatePlayerArray(players, { strict: true });
    expect(validatedStrict).toHaveLength(1); // Only validPlayer
  });

  it('should validate draft context', () => {
    const context = {
      currentRoster: { starters: {}, bench: [] },
      rosterFormat: [{ position: 'QB', slots: 1 }],
      leagueUsers: [],
      memberPicks: [],
      draftedPlayerIds: new Set(),
      currentPickNumber: 1,
      picksUntilNext: 0
    };

    const { context: validatedContext, issues, isValid } = validateDraftContext(context);
    expect(isValid).toBe(true);
    expect(issues).toHaveLength(0);
  });

  it('should create degraded context', () => {
    const degradedContext = createDegradedContext({ someData: 'test' });
    expect(degradedContext.degraded).toBe(true);
    expect(degradedContext.degradationReasons).toContain('Using simplified optimization context');
  });

  it('should check if recommendations can be provided', () => {
    const result = canProvideRecommendations([validPlayer], {
      currentRoster: { starters: {} },
      rosterFormat: [{ position: 'QB', slots: 1 }],
      leagueUsers: [],
      memberPicks: [],
      draftedPlayerIds: new Set(),
      currentPickNumber: 1,
      picksUntilNext: 0
    });
    expect(result.canRecommend).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});

describe('RetryMechanism', () => {
  it('should retry failed operations with exponential backoff', async () => {
    let attempts = 0;
    const operation = vi.fn(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Operation failed');
      }
      return 'success';
    });

    const result = await retryWithBackoff(operation, {
      maxRetries: 3,
      baseDelay: 10, // Short delay for testing
      retryCondition: () => true
    });

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should not retry when retry condition fails', async () => {
    const operation = vi.fn(() => {
      throw new Error('Non-retryable error');
    });

    await expect(retryWithBackoff(operation, {
      maxRetries: 3,
      retryCondition: () => false
    })).rejects.toThrow('Non-retryable error');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should create retryable optimization with circuit breaker', () => {
    const optimizationFn = vi.fn(() => 'optimization result');
    const fallbackFn = vi.fn(() => 'fallback result');

    const retryable = createRetryableOptimization(optimizationFn, fallbackFn);
    expect(retryable).toHaveProperty('execute');
    expect(retryable).toHaveProperty('getCircuitBreakerState');
    expect(retryable).toHaveProperty('resetCircuitBreaker');
  });

  describe('OptimizationCircuitBreaker', () => {
    let circuitBreaker;

    beforeEach(() => {
      circuitBreaker = new OptimizationCircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 100
      });
    });

    afterEach(() => {
      circuitBreaker.destroy();
    });

    it('should start in CLOSED state', () => {
      const state = circuitBreaker.getState();
      expect(state.state).toBe(CIRCUIT_STATES.CLOSED);
      expect(state.failureCount).toBe(0);
    });

    it('should open circuit after failure threshold', async () => {
      const failingOperation = () => Promise.reject(new Error('Operation failed'));

      // First failure
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      expect(circuitBreaker.getState().state).toBe(CIRCUIT_STATES.CLOSED);

      // Second failure - should open circuit
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      expect(circuitBreaker.getState().state).toBe(CIRCUIT_STATES.OPEN);
    });

    it('should use fallback when circuit is open', async () => {
      const failingOperation = () => Promise.reject(new Error('Operation failed'));
      const fallback = () => Promise.resolve('fallback result');

      // Trigger failures to open circuit
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();

      // Circuit should be open, fallback should be used
      const result = await circuitBreaker.execute(failingOperation, fallback);
      expect(result).toBe('fallback result');
    });

    it('should reset failure count on success', async () => {
      const operation = vi.fn(() => Promise.resolve('success'));

      await circuitBreaker.execute(operation);
      
      const state = circuitBreaker.getState();
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(1);
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      const failingOperation = () => Promise.reject(new Error('Operation failed'));

      // Open the circuit
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      expect(circuitBreaker.getState().state).toBe(CIRCUIT_STATES.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next execution should transition to HALF_OPEN
      const successOperation = () => Promise.resolve('success');
      const result = await circuitBreaker.execute(successOperation);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getState().state).toBe(CIRCUIT_STATES.CLOSED);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete optimization failure gracefully', async () => {
    const failingOptimization = () => {
      throw new Error('Complete optimization failure');
    };

    const fallbackOptimization = (context) => {
      return {
        recommendations: [
          {
            playerId: 'fallback1',
            player: { name: 'Fallback Player', position: 'RB' },
            optimization: { score: 50, factors: {} },
            recommendation: { action: 'CONSIDER', reasoning: 'Fallback recommendation' }
          }
        ],
        fallbackMode: true
      };
    };

    const retryable = createRetryableOptimization(failingOptimization, fallbackOptimization, {
      retry: { maxRetries: 1, baseDelay: 10 }
    });

    const result = await retryable.execute({});
    expect(result.fallbackMode).toBe(true);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].player.name).toBe('Fallback Player');
  });

  it('should validate complete data pipeline', () => {
    const rawPlayers = [
      {
        player_info: {
          player_id: 'player1',
          name: 'Valid Player',
          position: 'RB',
          projected_2025_points: 200
        }
      },
      { invalid: 'player' },
      null
    ];

    const context = {
      currentRoster: { starters: {}, bench: [] },
      rosterFormat: [{ position: 'RB', slots: 2 }],
      leagueUsers: [{ user_id: 'user1' }],
      memberPicks: [],
      draftedPlayerIds: new Set(),
      currentPickNumber: 1,
      picksUntilNext: 0
    };

    // Validate players (with strict mode to filter out invalid ones)
    const validPlayers = validatePlayerArray(rawPlayers, { strict: true });
    expect(validPlayers).toHaveLength(1);

    // Validate context
    const { context: validContext, isValid } = validateDraftContext(context);
    expect(isValid).toBe(true);

    // Check if recommendations can be provided
    const result = canProvideRecommendations(validPlayers, validContext);
    expect(result.canRecommend).toBe(true);

    // Generate fallback recommendations
    const recommendations = generateFallbackRecommendations(validPlayers, validContext);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].player.name).toBe('Valid Player');
  });
});