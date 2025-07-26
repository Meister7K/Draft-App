/**
 * Comprehensive tests for error handling and fallback mechanisms
 * Tests error boundaries, retry mechanisms, graceful degradation, and fallback recommendations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ErrorBoundary from '../ErrorBoundary';
import { ErrorMessage, ErrorIndicator, LoadingWithError, ErrorBoundaryFallback } from '../ErrorMessages';
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

describe('ErrorBoundary', () => {
  // Component that throws an error for testing
  const ThrowError = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
    if (shouldThrow) {
      throw new Error(errorMessage);
    }
    return <div>No error</div>;
  };

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should catch and display error when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} errorMessage="Component crashed" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Draft Optimizer Temporarily Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/The draft pick optimizer encountered an error/)).toBeInTheDocument();
  });

  it('should provide retry functionality', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const retryButton = screen.getByText(/Retry/);
    expect(retryButton).toBeInTheDocument();

    // Click retry - should reset error state
    fireEvent.click(retryButton);

    // Re-render with no error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should limit retry attempts', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const retryButton = screen.getByText(/Retry/);
    
    // Click retry multiple times
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);

    expect(screen.getByText('Max Retries Reached')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('should use custom fallback component when provided', () => {
    const CustomFallback = ({ error, onRetry }) => (
      <div>
        <div>Custom Error: {error.message}</div>
        <button onClick={onRetry}>Custom Retry</button>
      </div>
    );

    render(
      <ErrorBoundary fallbackComponent={CustomFallback}>
        <ThrowError shouldThrow={true} errorMessage="Custom error" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Error: Custom error')).toBeInTheDocument();
    expect(screen.getByText('Custom Retry')).toBeInTheDocument();
  });

  it('should show error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary showDetails={true}>
        <ThrowError shouldThrow={true} errorMessage="Development error" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error Details:')).toBeInTheDocument();
    expect(screen.getByText('Development error')).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});

describe('ErrorMessage Component', () => {
  const mockError = new Error('Test error message');

  it('should display error message with recovery options', () => {
    const onRetry = vi.fn();
    const onFallback = vi.fn();

    render(
      <ErrorMessage
        error={mockError}
        onRetry={onRetry}
        onFallback={onFallback}
      />
    );

    expect(screen.getByText('Unexpected Error')).toBeInTheDocument();
    expect(screen.getByText(/Something unexpected happened/)).toBeInTheDocument();
    
    const retryButton = screen.getByText('Try Again');
    const fallbackButton = screen.getByText('Use Basic Mode');
    
    fireEvent.click(retryButton);
    fireEvent.click(fallbackButton);
    
    expect(onRetry).toHaveBeenCalled();
    expect(onFallback).toHaveBeenCalled();
  });

  it('should detect different error types', () => {
    const networkError = new Error('Network request failed');
    networkError.name = 'NetworkError';

    render(<ErrorMessage error={networkError} />);
    expect(screen.getByText('Connection Issue')).toBeInTheDocument();
  });

  it('should show retry count', () => {
    render(
      <ErrorMessage
        error={mockError}
        retryCount={2}
        maxRetries={3}
      />
    );

    expect(screen.getByText('Attempt 2 of 3')).toBeInTheDocument();
  });

  it('should disable retry button when max retries reached', () => {
    render(
      <ErrorMessage
        error={mockError}
        retryCount={3}
        maxRetries={3}
      />
    );

    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeDisabled();
  });
});

describe('ErrorIndicator Component', () => {
  it('should display compact error information', () => {
    const error = new Error('Quick error');
    const onRetry = vi.fn();

    render(<ErrorIndicator error={error} onRetry={onRetry} />);

    expect(screen.getByText('Unexpected Error')).toBeInTheDocument();
    
    const retryLink = screen.getByText('Retry');
    fireEvent.click(retryLink);
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('LoadingWithError Component', () => {
  it('should show loading state', () => {
    render(<LoadingWithError isLoading={true} />);
    expect(screen.getByText('Calculating recommendations...')).toBeInTheDocument();
  });

  it('should show error state when error exists', () => {
    const error = new Error('Loading error');
    render(<LoadingWithError error={error} />);
    expect(screen.getByText('Unexpected Error')).toBeInTheDocument();
  });

  it('should show custom loading message', () => {
    render(
      <LoadingWithError 
        isLoading={true} 
        loadingMessage="Custom loading message" 
      />
    );
    expect(screen.getByText('Custom loading message')).toBeInTheDocument();
  });
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
    const validated = validatePlayerArray(players);
    expect(validated).toHaveLength(1);
  });

  it('should validate draft context', () => {
    const context = {
      currentRoster: { starters: {}, bench: [] },
      rosterFormat: [{ position: 'QB', slots: 1 }],
      leagueUsers: [],
      memberPicks: [],
      draftedPlayerIds: new Set()
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
    const { canRecommend, reasons } = canProvideRecommendations([validPlayer], {
      currentRoster: { starters: {} },
      rosterFormat: []
    });
    expect(canRecommend).toBe(true);
    expect(reasons).toHaveLength(0);
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
      draftedPlayerIds: new Set()
    };

    // Validate players
    const validPlayers = validatePlayerArray(rawPlayers);
    expect(validPlayers).toHaveLength(1);

    // Validate context
    const { context: validContext, isValid } = validateDraftContext(context);
    expect(isValid).toBe(true);

    // Check if recommendations can be provided
    const { canRecommend } = canProvideRecommendations(validPlayers, validContext);
    expect(canRecommend).toBe(true);

    // Generate fallback recommendations
    const recommendations = generateFallbackRecommendations(validPlayers, validContext);
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].player.name).toBe('Valid Player');
  });
});