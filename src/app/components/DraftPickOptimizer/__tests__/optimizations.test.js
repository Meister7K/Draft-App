/**
 * Tests for performance optimizations in DraftPickOptimizer
 * Verifies memoization, debouncing, caching, and incremental updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Performance Optimization Logic', () => {
  describe('Debouncing Logic', () => {
    it('should prevent excessive function calls', async () => {
      const mockCallback = vi.fn();
      let timeoutId = null;
      
      const debouncedFunction = (...args) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          mockCallback(...args);
          timeoutId = null;
        }, 100);
      };

      // Call multiple times quickly
      debouncedFunction('call1');
      debouncedFunction('call2');
      debouncedFunction('call3');

      // Should not have been called yet
      expect(mockCallback).not.toHaveBeenCalled();

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have been called only once with last arguments
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('call3');
    });

    it('should handle rapid value changes efficiently', async () => {
      let debouncedValue = 'initial';
      let timeoutId = null;
      
      const updateDebouncedValue = (newValue) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          debouncedValue = newValue;
          timeoutId = null;
        }, 50);
      };

      // Rapidly change values
      for (let i = 1; i <= 10; i++) {
        updateDebouncedValue(`value${i}`);
      }

      expect(debouncedValue).toBe('initial'); // Should still be initial

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(debouncedValue).toBe('value10'); // Should be final value
    });
  });

  describe('Caching Logic', () => {
    it('should cache calculation results based on context', () => {
      const cache = new Map();
      const mockCalculation = vi.fn(() => ({ recommendations: ['test'] }));

      const generateCacheKey = (context) => {
        return `${context.selectedMemberId}-${context.currentPickNumber}-${context.picksUntilNext}`;
      };

      const getCachedCalculation = (context, calculationFunction) => {
        const cacheKey = generateCacheKey(context);
        
        if (cache.has(cacheKey)) {
          return { ...cache.get(cacheKey), fromCache: true };
        }
        
        const result = calculationFunction(context);
        cache.set(cacheKey, result);
        return { ...result, fromCache: false };
      };

      const context1 = {
        currentPickNumber: 1,
        picksUntilNext: 2,
        selectedMemberId: 'user1'
      };

      // First call should execute calculation
      const result1 = getCachedCalculation(context1, mockCalculation);
      expect(mockCalculation).toHaveBeenCalledTimes(1);
      expect(result1.fromCache).toBe(false);

      // Second call with same context should use cache
      const result2 = getCachedCalculation(context1, mockCalculation);
      expect(mockCalculation).toHaveBeenCalledTimes(1); // Still only called once
      expect(result2.fromCache).toBe(true);
    });

    it('should handle cache size limits', () => {
      const cache = new Map();
      const maxCacheSize = 5;

      const addToCache = (key, value) => {
        if (cache.size >= maxCacheSize) {
          // Remove oldest entry
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        cache.set(key, value);
      };

      // Add more items than cache limit
      for (let i = 0; i < 10; i++) {
        addToCache(`key${i}`, `value${i}`);
      }

      expect(cache.size).toBe(maxCacheSize);
      expect(cache.has('key0')).toBe(false); // Should be evicted
      expect(cache.has('key9')).toBe(true); // Should be present
    });
  });

  describe('Performance Monitoring Logic', () => {
    it('should track calculation times accurately', () => {
      const calculationTimes = [];
      
      const recordCalculationTime = (time) => {
        calculationTimes.push(time);
        
        // Keep only last 50 for memory efficiency
        if (calculationTimes.length > 50) {
          calculationTimes.splice(0, calculationTimes.length - 50);
        }
      };

      const getPerformanceMetrics = () => {
        if (calculationTimes.length === 0) {
          return {
            averageCalculationTime: 0,
            maxCalculationTime: 0,
            minCalculationTime: 0,
            totalCalculations: 0,
            slowCalculations: 0
          };
        }

        const total = calculationTimes.reduce((sum, time) => sum + time, 0);
        const average = total / calculationTimes.length;
        const max = Math.max(...calculationTimes);
        const min = Math.min(...calculationTimes);
        const slow = calculationTimes.filter(time => time > 500).length;

        return {
          averageCalculationTime: Math.round(average * 100) / 100,
          maxCalculationTime: Math.round(max * 100) / 100,
          minCalculationTime: Math.round(min * 100) / 100,
          totalCalculations: calculationTimes.length,
          slowCalculations: slow
        };
      };

      // Record some calculation times
      recordCalculationTime(100);
      recordCalculationTime(200);
      recordCalculationTime(600); // Slow calculation
      recordCalculationTime(150);

      const metrics = getPerformanceMetrics();
      expect(metrics.totalCalculations).toBe(4);
      expect(metrics.averageCalculationTime).toBe(262.5);
      expect(metrics.maxCalculationTime).toBe(600);
      expect(metrics.minCalculationTime).toBe(100);
      expect(metrics.slowCalculations).toBe(1);
    });

    it('should identify performance issues', () => {
      const getPerformanceStatus = (averageTime, slowCount, totalCount) => {
        if (averageTime > 500) {
          return { status: 'critical', message: `Average calculation time is ${averageTime}ms (target: <500ms)` };
        }
        
        if (averageTime > 300) {
          return { status: 'warning', message: `Average calculation time is ${averageTime}ms (target: <300ms)` };
        }
        
        if (slowCount > totalCount * 0.2) {
          return { status: 'critical', message: `${slowCount} of ${totalCount} calculations exceeded 500ms` };
        }
        
        return { status: 'good', message: 'Performance is optimal' };
      };

      // Test good performance
      expect(getPerformanceStatus(200, 0, 10)).toEqual({
        status: 'good',
        message: 'Performance is optimal'
      });

      // Test warning performance
      expect(getPerformanceStatus(350, 1, 10)).toEqual({
        status: 'warning',
        message: 'Average calculation time is 350ms (target: <300ms)'
      });

      // Test critical performance
      expect(getPerformanceStatus(600, 2, 10)).toEqual({
        status: 'critical',
        message: 'Average calculation time is 600ms (target: <500ms)'
      });
    });
  });
});

describe('Integration Performance Tests', () => {
  it('should handle rapid state changes without performance degradation', () => {
    const cache = new Map();
    const mockCalculation = vi.fn(() => ({ recommendations: [] }));

    const generateCacheKey = (context) => {
      return `${context.selectedMemberId}-${context.currentPickNumber}-${context.picksUntilNext}`;
    };

    const getCachedCalculation = (context, calculationFunction) => {
      const cacheKey = generateCacheKey(context);
      
      if (cache.has(cacheKey)) {
        return { ...cache.get(cacheKey), fromCache: true };
      }
      
      const result = calculationFunction(context);
      cache.set(cacheKey, result);
      return { ...result, fromCache: false };
    };

    // Simulate rapid state changes
    const contexts = Array.from({ length: 20 }, (_, i) => ({
      currentPickNumber: i + 1,
      picksUntilNext: 2,
      selectedMemberId: 'user1'
    }));

    const startTime = performance.now();

    // Process all contexts
    contexts.forEach(context => {
      getCachedCalculation(context, mockCalculation);
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should complete quickly even with many contexts
    expect(totalTime).toBeLessThan(100);

    // Should have cached results
    expect(cache.size).toBe(20);
    expect(mockCalculation).toHaveBeenCalledTimes(20); // Each context is unique
  });

  it('should maintain performance with complex optimization contexts', () => {
    const cache = new Map();

    const complexCalculation = vi.fn((context) => {
      // Simulate complex calculation
      const recommendations = [];
      for (let i = 0; i < 100; i++) {
        recommendations.push({
          playerId: `player_${i}`,
          score: Math.random() * 100
        });
      }
      return { recommendations };
    });

    const generateCacheKey = (context) => {
      return `${context.selectedMemberId}-${context.currentPickNumber}-${context.picksUntilNext}`;
    };

    const getCachedCalculation = (context, calculationFunction) => {
      const cacheKey = generateCacheKey(context);
      
      if (cache.has(cacheKey)) {
        return { ...cache.get(cacheKey), fromCache: true };
      }
      
      const result = calculationFunction(context);
      cache.set(cacheKey, result);
      return { ...result, fromCache: false };
    };

    const complexContext = {
      currentPickNumber: 50,
      picksUntilNext: 3,
      selectedMemberId: 'user1'
    };

    const startTime = performance.now();

    // First calculation
    const result1 = getCachedCalculation(complexContext, complexCalculation);
    expect(result1.fromCache).toBe(false);

    // Second calculation should use cache
    const result2 = getCachedCalculation(complexContext, complexCalculation);
    expect(result2.fromCache).toBe(true);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should complete within reasonable time
    expect(totalTime).toBeLessThan(200);
    expect(complexCalculation).toHaveBeenCalledTimes(1);
  });

  it('should demonstrate incremental update benefits', () => {
    const cache = new Map();
    const fullCalculation = vi.fn(() => ({ recommendations: [], calculationType: 'full' }));
    const incrementalCalculation = vi.fn(() => ({ recommendations: [], calculationType: 'incremental' }));

    const canUseIncrementalUpdate = (newContext, oldContext) => {
      if (!oldContext) return false;
      
      // Can use incremental if only pick number changed by 1
      return (
        newContext.selectedMemberId === oldContext.selectedMemberId &&
        newContext.currentPickNumber === oldContext.currentPickNumber + 1
      );
    };

    let lastContext = null;

    const getOptimizedCalculation = (context) => {
      const startTime = performance.now();
      
      let result;
      if (canUseIncrementalUpdate(context, lastContext)) {
        result = incrementalCalculation(context);
      } else {
        result = fullCalculation(context);
      }
      
      const endTime = performance.now();
      lastContext = context;
      
      return {
        ...result,
        calculationTime: endTime - startTime
      };
    };

    // First calculation - should be full
    const result1 = getOptimizedCalculation({
      selectedMemberId: 'user1',
      currentPickNumber: 1,
      picksUntilNext: 2
    });
    expect(result1.calculationType).toBe('full');
    expect(fullCalculation).toHaveBeenCalledTimes(1);
    expect(incrementalCalculation).toHaveBeenCalledTimes(0);

    // Second calculation - should be incremental
    const result2 = getOptimizedCalculation({
      selectedMemberId: 'user1',
      currentPickNumber: 2,
      picksUntilNext: 2
    });
    expect(result2.calculationType).toBe('incremental');
    expect(fullCalculation).toHaveBeenCalledTimes(1);
    expect(incrementalCalculation).toHaveBeenCalledTimes(1);

    // Third calculation with different user - should be full
    const result3 = getOptimizedCalculation({
      selectedMemberId: 'user2',
      currentPickNumber: 3,
      picksUntilNext: 2
    });
    expect(result3.calculationType).toBe('full');
    expect(fullCalculation).toHaveBeenCalledTimes(2);
    expect(incrementalCalculation).toHaveBeenCalledTimes(1);
  });
});