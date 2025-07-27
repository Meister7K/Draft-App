/**
 * Performance Benchmarks and Monitoring for Draft Pick Optimizer
 * Ensures optimization calculations meet performance targets
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  generateRankedRecommendations,
  calculateOptimizationScore,
  assessRosterNeeds
} from '../OptimizationEngine';
import { analyzeLeagueNeeds } from '../CompetitionAnalyzer';
import { projectPlayerAvailability } from '../AvailabilityPredictor';

// Performance monitoring utilities
class PerformanceMonitor {
  constructor() {
    this.measurements = [];
    this.thresholds = {
      optimizationScore: 50, // ms
      rosterNeeds: 10, // ms
      leagueAnalysis: 100, // ms
      fullRecommendations: 500, // ms
      availabilityProjection: 200 // ms
    };
  }

  measure(name, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const duration = end - start;
    
    this.measurements.push({
      name,
      duration,
      timestamp: Date.now(),
      passed: duration < (this.thresholds[name] || 1000)
    });
    
    return { result, duration };
  }

  async measureAsync(name, fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;
    
    this.measurements.push({
      name,
      duration,
      timestamp: Date.now(),
      passed: duration < (this.thresholds[name] || 1000)
    });
    
    return { result, duration };
  }

  getStats() {
    const stats = {};
    
    for (const measurement of this.measurements) {
      if (!stats[measurement.name]) {
        stats[measurement.name] = {
          count: 0,
          total: 0,
          min: Infinity,
          max: 0,
          passed: 0,
          failed: 0
        };
      }
      
      const stat = stats[measurement.name];
      stat.count++;
      stat.total += measurement.duration;
      stat.min = Math.min(stat.min, measurement.duration);
      stat.max = Math.max(stat.max, measurement.duration);
      
      if (measurement.passed) {
        stat.passed++;
      } else {
        stat.failed++;
      }
    }
    
    // Calculate averages
    for (const name in stats) {
      stats[name].average = stats[name].total / stats[name].count;
      stats[name].passRate = stats[name].passed / stats[name].count;
    }
    
    return stats;
  }

  reset() {
    this.measurements = [];
  }
}

// Mock data generators for benchmarking
const createBenchmarkPlayers = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    player_info: {
      player_id: `player_${i}`,
      name: `Player ${i}`,
      position: ['QB', 'RB', 'WR', 'TE'][i % 4],
      team: `TEAM${i % 32}`,
      overall_rank: i + 1,
      position_rank: Math.floor(i / 4) + 1,
      projected_2025_points: 300 - i * 2
    }
  }));
};

const createBenchmarkLeagueUsers = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    user_id: `user_${i}`,
    username: `User${i}`,
    team_name: `Team ${i}`
  }));
};

const createBenchmarkDraftPicks = (pickCount, managerCount) => {
  return Array.from({ length: pickCount }, (_, i) => ({
    pick_no: i + 1,
    picked_by: `user_${i % managerCount}`,
    metadata: {
      player_id: `player_${i}`,
      position: ['QB', 'RB', 'WR', 'TE'][i % 4]
    }
  }));
};

const createBenchmarkRosterFormat = () => [
  { position: 'QB', slots: 1 },
  { position: 'RB', slots: 2 },
  { position: 'WR', slots: 2 },
  { position: 'TE', slots: 1 },
  { position: 'FLEX', slots: 1 }
];

const createBenchmarkContext = (playerCount = 25, managerCount = 12) => {
  const players = createBenchmarkPlayers(playerCount);
  const leagueUsers = createBenchmarkLeagueUsers(managerCount);
  const draftPicks = createBenchmarkDraftPicks(50, managerCount);
  const rosterFormat = createBenchmarkRosterFormat();
  
  return {
    currentRoster: {
      starters: {
        QB: [null],
        RB: [null, null],
        WR: [null, null],
        TE: [null],
        FLEX: [null]
      },
      bench: [],
      positionCounts: {}
    },
    rosterFormat,
    calculateCompositeValue: vi.fn((player) => {
      return player.player_info.projected_2025_points * 0.5 + 
             (400 - player.player_info.overall_rank) * 0.3;
    }),
    currentPickNumber: 25,
    picksUntilNext: 2,
    totalManagers: managerCount,
    leagueUsers,
    draftPicks,
    players
  };
};

describe('Draft Pick Optimizer - Performance Benchmarks', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('Individual Function Benchmarks', () => {
    it('should calculate optimization score within performance target', () => {
      const context = createBenchmarkContext();
      const player = context.players[0];

      const { result, duration } = monitor.measure('optimizationScore', () => {
        return calculateOptimizationScore(player, context);
      });

      expect(duration).toBeLessThan(monitor.thresholds.optimizationScore);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('factors');
      expect(typeof result.score).toBe('number');
    });

    it('should assess roster needs within performance target', () => {
      const context = createBenchmarkContext();

      const { result, duration } = monitor.measure('rosterNeeds', () => {
        return assessRosterNeeds(context.currentRoster, context.rosterFormat);
      });

      expect(duration).toBeLessThan(monitor.thresholds.rosterNeeds);
      expect(result).toHaveProperty('positionNeeds');
      expect(result).toHaveProperty('summary');
    });

    it('should analyze league needs within performance target', () => {
      const context = createBenchmarkContext();

      const { result, duration } = monitor.measure('leagueAnalysis', () => {
        return analyzeLeagueNeeds(context.leagueUsers, context.draftPicks, context.rosterFormat);
      });

      expect(duration).toBeLessThan(monitor.thresholds.leagueAnalysis);
      expect(result).toHaveProperty('managerNeeds');
      expect(result).toHaveProperty('positionDemand');
    });

    it('should project player availability within performance target', () => {
      const context = createBenchmarkContext();

      const { result, duration } = monitor.measure('availabilityProjection', () => {
        return projectPlayerAvailability(
          context.players.slice(0, 25),
          context.leagueUsers,
          context.draftPicks,
          context.currentPickNumber,
          context.totalManagers
        );
      });

      expect(duration).toBeLessThan(monitor.thresholds.availabilityProjection);
      expect(result).toHaveProperty('projections');
      expect(result).toHaveProperty('summary');
    });
  });

  describe('Full Recommendation Generation Benchmarks', () => {
    it('should generate recommendations within 500ms target', () => {
      const context = createBenchmarkContext(25);
      const players = context.players;

      const { result, duration } = monitor.measure('fullRecommendations', () => {
        return generateRankedRecommendations(players, context);
      });

      expect(duration).toBeLessThan(monitor.thresholds.fullRecommendations);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeLessThanOrEqual(5);
      
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('player');
        expect(result[0]).toHaveProperty('optimization');
        expect(result[0]).toHaveProperty('rank');
      }
    });

    it('should handle different dataset sizes efficiently', () => {
      const testSizes = [10, 25, 50, 100];
      const results = [];

      for (const size of testSizes) {
        const context = createBenchmarkContext(size);
        const players = context.players;

        const { result, duration } = monitor.measure('fullRecommendations', () => {
          return generateRankedRecommendations(players, context);
        });

        results.push({ size, duration, resultCount: result.length });
        
        // All sizes should meet the performance target
        expect(duration).toBeLessThan(monitor.thresholds.fullRecommendations);
      }

      // Performance should scale reasonably
      const smallestDuration = results[0].duration;
      const largestDuration = results[results.length - 1].duration;
      
      // 10x data should not take more than 5x time
      expect(largestDuration).toBeLessThan(smallestDuration * 5);
    });

    it('should handle different league sizes efficiently', () => {
      const leagueSizes = [8, 10, 12, 14, 16];
      const results = [];

      for (const size of leagueSizes) {
        const context = createBenchmarkContext(25, size);
        const players = context.players;

        const { result, duration } = monitor.measure('fullRecommendations', () => {
          return generateRankedRecommendations(players, context);
        });

        results.push({ leagueSize: size, duration, resultCount: result.length });
        
        // All league sizes should meet the performance target
        expect(duration).toBeLessThan(monitor.thresholds.fullRecommendations);
      }

      // League size should have minimal impact on performance
      const durations = results.map(r => r.duration);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      
      // Max should not be more than 2x min for league size differences
      expect(maxDuration).toBeLessThan(minDuration * 2);
    });
  });

  describe('Stress Testing', () => {
    it('should handle maximum realistic dataset', () => {
      // Maximum realistic scenario: 16-team league, 500 players, 200 picks made
      const context = createBenchmarkContext(500, 16);
      context.draftPicks = createBenchmarkDraftPicks(200, 16);
      
      const players = context.players.slice(0, 50); // Limit analysis to top 50

      const { result, duration } = monitor.measure('fullRecommendations', () => {
        return generateRankedRecommendations(players, context);
      });

      expect(duration).toBeLessThan(monitor.thresholds.fullRecommendations);
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle repeated calculations efficiently', () => {
      const context = createBenchmarkContext(25);
      const players = context.players;
      const iterations = 10;

      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const { duration } = monitor.measure('fullRecommendations', () => {
          return generateRankedRecommendations(players, {
            ...context,
            currentPickNumber: context.currentPickNumber + i
          });
        });
        
        durations.push(duration);
      }

      // All iterations should meet performance target
      durations.forEach(duration => {
        expect(duration).toBeLessThan(monitor.thresholds.fullRecommendations);
      });

      // Performance should be consistent (no significant degradation)
      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      expect(maxDuration).toBeLessThan(averageDuration * 2);
    });

    it('should handle concurrent-like rapid updates', () => {
      const context = createBenchmarkContext(25);
      const players = context.players;
      const rapidUpdates = 5;

      const startTime = performance.now();

      // Simulate rapid updates like during active draft
      for (let i = 0; i < rapidUpdates; i++) {
        const { duration } = monitor.measure('fullRecommendations', () => {
          return generateRankedRecommendations(players, {
            ...context,
            currentPickNumber: context.currentPickNumber + i,
            draftPicks: [
              ...context.draftPicks,
              {
                pick_no: context.draftPicks.length + i + 1,
                picked_by: `user_${i % context.totalManagers}`,
                metadata: { player_id: `new_player_${i}`, position: 'RB' }
              }
            ]
          });
        });

        expect(duration).toBeLessThan(monitor.thresholds.fullRecommendations);
      }

      const totalTime = performance.now() - startTime;
      
      // Total time for rapid updates should be reasonable
      expect(totalTime).toBeLessThan(monitor.thresholds.fullRecommendations * rapidUpdates * 0.8);
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during repeated calculations', () => {
      const context = createBenchmarkContext(25);
      const players = context.players;
      
      // Get initial memory if available
      const initialMemory = process.memoryUsage?.() || { heapUsed: 0 };
      
      // Perform many calculations
      for (let i = 0; i < 50; i++) {
        generateRankedRecommendations(players, {
          ...context,
          currentPickNumber: context.currentPickNumber + i
        });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage?.() || { heapUsed: 0 };
      
      // Memory growth should be reasonable (less than 20MB for 50 calculations)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024); // 20MB
    });

    it('should handle large datasets without excessive memory usage', () => {
      const initialMemory = process.memoryUsage?.() || { heapUsed: 0 };
      
      // Create large dataset
      const context = createBenchmarkContext(1000, 16);
      const players = context.players.slice(0, 100);
      
      generateRankedRecommendations(players, context);
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage?.() || { heapUsed: 0 };
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Should not use excessive memory (less than 50MB for large dataset)
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance across multiple runs', () => {
      const context = createBenchmarkContext(25);
      const players = context.players;
      const runs = 20;
      const durations = [];

      for (let i = 0; i < runs; i++) {
        const { duration } = monitor.measure('fullRecommendations', () => {
          return generateRankedRecommendations(players, context);
        });
        durations.push(duration);
      }

      const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const standardDeviation = Math.sqrt(
        durations.reduce((sum, d) => sum + Math.pow(d - average, 2), 0) / durations.length
      );

      // Performance should be consistent (low standard deviation)
      expect(standardDeviation).toBeLessThan(average * 0.3); // Within 30% of average
      
      // All runs should meet performance target
      durations.forEach(duration => {
        expect(duration).toBeLessThan(monitor.thresholds.fullRecommendations);
      });
    });

    it('should provide performance statistics', () => {
      const context = createBenchmarkContext(25);
      const players = context.players;

      // Run multiple measurements
      for (let i = 0; i < 10; i++) {
        monitor.measure('fullRecommendations', () => {
          return generateRankedRecommendations(players, context);
        });
      }

      const stats = monitor.getStats();
      
      expect(stats.fullRecommendations).toBeDefined();
      expect(stats.fullRecommendations.count).toBe(10);
      expect(stats.fullRecommendations.average).toBeGreaterThan(0);
      expect(stats.fullRecommendations.min).toBeGreaterThan(0);
      expect(stats.fullRecommendations.max).toBeGreaterThan(0);
      expect(stats.fullRecommendations.passRate).toBe(1); // All should pass
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle empty roster efficiently', () => {
      const context = createBenchmarkContext(25);
      context.currentRoster = {
        starters: {
          QB: [null],
          RB: [null, null],
          WR: [null, null],
          TE: [null],
          FLEX: [null]
        },
        bench: [],
        positionCounts: {}
      };

      const { duration } = monitor.measure('fullRecommendations', () => {
        return generateRankedRecommendations(context.players, context);
      });

      expect(duration).toBeLessThan(monitor.thresholds.fullRecommendations);
    });

    it('should handle full roster efficiently', () => {
      const context = createBenchmarkContext(25);
      context.currentRoster = {
        starters: {
          QB: [{ player_id: 'qb1' }],
          RB: [{ player_id: 'rb1' }, { player_id: 'rb2' }],
          WR: [{ player_id: 'wr1' }, { player_id: 'wr2' }],
          TE: [{ player_id: 'te1' }],
          FLEX: [{ player_id: 'flex1' }]
        },
        bench: Array.from({ length: 10 }, (_, i) => ({ player_id: `bench${i}` })),
        positionCounts: { QB: 1, RB: 2, WR: 2, TE: 1 }
      };

      const { duration } = monitor.measure('fullRecommendations', () => {
        return generateRankedRecommendations(context.players, context);
      });

      expect(duration).toBeLessThan(monitor.thresholds.fullRecommendations);
    });

    it('should handle late draft scenarios efficiently', () => {
      const context = createBenchmarkContext(25);
      context.currentPickNumber = 200;
      context.draftPicks = createBenchmarkDraftPicks(200, context.totalManagers);

      const { duration } = monitor.measure('fullRecommendations', () => {
        return generateRankedRecommendations(context.players, context);
      });

      expect(duration).toBeLessThan(monitor.thresholds.fullRecommendations);
    });
  });

  afterEach(() => {
    // Log performance stats for monitoring
    const stats = monitor.getStats();
    if (Object.keys(stats).length > 0) {
      console.log('Performance Stats:', JSON.stringify(stats, null, 2));
    }
  });
});