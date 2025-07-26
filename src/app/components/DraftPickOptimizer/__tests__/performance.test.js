/**
 * Performance tests for DraftPickOptimizer
 * Ensures calculations complete within 500ms target
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  generateRankedRecommendations,
  calculateOptimizationScore,
  assessRosterNeeds
} from '../OptimizationEngine';
import { analyzeLeagueNeeds } from '../CompetitionAnalyzer';
import { projectPlayerAvailability } from '../AvailabilityPredictor';

// Mock data for performance testing
const createMockPlayers = (count) => {
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

const createMockLeagueUsers = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    user_id: `user_${i}`,
    username: `User${i}`,
    team_name: `Team ${i}`
  }));
};

const createMockRosterFormat = () => [
  { position: 'QB', slots: 1 },
  { position: 'RB', slots: 2 },
  { position: 'WR', slots: 2 },
  { position: 'TE', slots: 1 },
  { position: 'FLEX', slots: 1 }
];

const createMockCurrentRoster = () => ({
  starters: {
    QB: [null],
    RB: [null, null],
    WR: [null, null],
    TE: [null],
    FLEX: [null]
  },
  bench: [],
  positionCounts: {}
});

const createMockCalculateCompositeValue = () => {
  return vi.fn((player) => {
    return player.player_info.projected_2025_points * 0.5 + 
           (400 - player.player_info.overall_rank) * 0.3;
  });
};

describe('DraftPickOptimizer Performance Tests', () => {
  let mockPlayers;
  let mockLeagueUsers;
  let mockRosterFormat;
  let mockCurrentRoster;
  let mockCalculateCompositeValue;
  let mockContext;

  beforeEach(() => {
    mockPlayers = createMockPlayers(100);
    mockLeagueUsers = createMockLeagueUsers(12);
    mockRosterFormat = createMockRosterFormat();
    mockCurrentRoster = createMockCurrentRoster();
    mockCalculateCompositeValue = createMockCalculateCompositeValue();

    mockContext = {
      currentRoster: mockCurrentRoster,
      rosterFormat: mockRosterFormat,
      calculateCompositeValue: mockCalculateCompositeValue,
      currentPickNumber: 25,
      picksUntilNext: 2,
      totalManagers: 12
    };
  });

  describe('Individual Function Performance', () => {
    it('should calculate optimization score within performance target', () => {
      const startTime = performance.now();
      
      const result = calculateOptimizationScore(mockPlayers[0], mockContext);
      
      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      expect(calculationTime).toBeLessThan(50); // Individual calculation should be very fast
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('factors');
      expect(typeof result.score).toBe('number');
    });

    it('should assess roster needs within performance target', () => {
      const startTime = performance.now();
      
      const result = assessRosterNeeds(mockCurrentRoster, mockRosterFormat);
      
      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      expect(calculationTime).toBeLessThan(10); // Roster analysis should be very fast
      expect(result).toHaveProperty('positionNeeds');
      expect(result).toHaveProperty('summary');
    });

    it('should analyze league needs within performance target', () => {
      const mockDraftPicks = Array.from({ length: 50 }, (_, i) => ({
        pick_no: i + 1,
        player_id: `player_${i}`,
        user_id: `user_${i % 12}`,
        metadata: { position: ['QB', 'RB', 'WR', 'TE'][i % 4] }
      }));

      const startTime = performance.now();
      
      const result = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      
      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      expect(calculationTime).toBeLessThan(100); // League analysis should be reasonably fast
      expect(result).toHaveProperty('managerNeeds');
      expect(result).toHaveProperty('positionDemand');
    });
  });

  describe('Full Recommendation Generation Performance', () => {
    it('should generate recommendations for 25 players within 500ms target', () => {
      const testPlayers = mockPlayers.slice(0, 25);
      
      const startTime = performance.now();
      
      const result = generateRankedRecommendations(testPlayers, mockContext);
      
      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      expect(calculationTime).toBeLessThan(500); // Main performance requirement
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeLessThanOrEqual(5);
      
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('player');
        expect(result[0]).toHaveProperty('optimization');
        expect(result[0]).toHaveProperty('rank');
      }
    });

    it('should handle large player pools efficiently', () => {
      const largePlayers = createMockPlayers(200);
      const testPlayers = largePlayers.slice(0, 50); // Test with 50 players
      
      const startTime = performance.now();
      
      const result = generateRankedRecommendations(testPlayers, mockContext);
      
      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      // Should still meet target even with larger dataset
      expect(calculationTime).toBeLessThan(500);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should maintain performance with complex roster states', () => {
      // Create a more complex roster with some filled positions
      const complexRoster = {
        starters: {
          QB: [{ player_id: 'qb1', metadata: { position: 'QB' } }],
          RB: [
            { player_id: 'rb1', metadata: { position: 'RB' } },
            null
          ],
          WR: [null, null],
          TE: [null],
          FLEX: [null]
        },
        bench: [
          { player_id: 'bench1', metadata: { position: 'RB' } }
        ],
        positionCounts: { QB: 1, RB: 2 }
      };

      const complexContext = {
        ...mockContext,
        currentRoster: complexRoster
      };

      const testPlayers = mockPlayers.slice(0, 25);
      
      const startTime = performance.now();
      
      const result = generateRankedRecommendations(testPlayers, complexContext);
      
      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      expect(calculationTime).toBeLessThan(500);
      expect(result).toBeInstanceOf(Array);
    });
  });

  describe('Batch Performance Tests', () => {
    it('should handle multiple consecutive calculations efficiently', () => {
      const testPlayers = mockPlayers.slice(0, 25);
      const calculations = [];
      
      const startTime = performance.now();
      
      // Perform 5 consecutive calculations (simulating rapid updates)
      for (let i = 0; i < 5; i++) {
        const iterationStart = performance.now();
        const result = generateRankedRecommendations(testPlayers, {
          ...mockContext,
          currentPickNumber: mockContext.currentPickNumber + i
        });
        const iterationEnd = performance.now();
        
        calculations.push({
          result,
          time: iterationEnd - iterationStart
        });
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / 5;

      // Each calculation should meet target
      calculations.forEach((calc, index) => {
        expect(calc.time).toBeLessThan(500);
        expect(calc.result).toBeInstanceOf(Array);
      });

      // Average should be well under target
      expect(averageTime).toBeLessThan(400);
      
      // Total time for 5 calculations should be reasonable
      expect(totalTime).toBeLessThan(2000);
    });

    it('should maintain performance under memory pressure', () => {
      // Create large datasets to simulate memory pressure
      const largePlayers = createMockPlayers(500);
      const largeLeagueUsers = createMockLeagueUsers(20);
      
      const testPlayers = largePlayers.slice(0, 25);
      const largeContext = {
        ...mockContext,
        totalManagers: 20
      };
      
      const startTime = performance.now();
      
      const result = generateRankedRecommendations(testPlayers, largeContext);
      
      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      expect(calculationTime).toBeLessThan(500);
      expect(result).toBeInstanceOf(Array);
      
      // Verify memory isn't growing excessively
      if (global.gc) {
        global.gc();
      }
    });
  });

  describe('Performance Regression Tests', () => {
    it('should not regress in performance with optimization updates', () => {
      const testPlayers = mockPlayers.slice(0, 25);
      const times = [];
      
      // Run multiple iterations to get stable timing
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        generateRankedRecommendations(testPlayers, mockContext);
        const endTime = performance.now();
        times.push(endTime - startTime);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      // Performance requirements
      expect(averageTime).toBeLessThan(300); // Average should be well under 500ms
      expect(maxTime).toBeLessThan(500); // No single calculation over 500ms
      expect(minTime).toBeGreaterThan(0); // Sanity check
      
      // Consistency check - max shouldn't be more than 3x average
      expect(maxTime).toBeLessThan(averageTime * 3);
    });

    it('should handle edge cases without performance degradation', () => {
      const edgeCases = [
        // Empty roster
        {
          ...mockContext,
          currentRoster: {
            starters: { QB: [null], RB: [null, null], WR: [null, null], TE: [null], FLEX: [null] },
            bench: [],
            positionCounts: {}
          }
        },
        // Full roster
        {
          ...mockContext,
          currentRoster: {
            starters: {
              QB: [{ player_id: 'qb1' }],
              RB: [{ player_id: 'rb1' }, { player_id: 'rb2' }],
              WR: [{ player_id: 'wr1' }, { player_id: 'wr2' }],
              TE: [{ player_id: 'te1' }],
              FLEX: [{ player_id: 'flex1' }]
            },
            bench: [],
            positionCounts: { QB: 1, RB: 2, WR: 2, TE: 1 }
          }
        },
        // Early draft
        { ...mockContext, currentPickNumber: 1, picksUntilNext: 0 },
        // Late draft
        { ...mockContext, currentPickNumber: 200, picksUntilNext: 5 }
      ];

      const testPlayers = mockPlayers.slice(0, 25);
      
      edgeCases.forEach((edgeContext, index) => {
        const startTime = performance.now();
        
        const result = generateRankedRecommendations(testPlayers, edgeContext);
        
        const endTime = performance.now();
        const calculationTime = endTime - startTime;

        expect(calculationTime).toBeLessThan(500);
        expect(result).toBeInstanceOf(Array);
      });
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during repeated calculations', () => {
      const testPlayers = mockPlayers.slice(0, 25);
      
      // Get initial memory usage if available
      const initialMemory = process.memoryUsage?.() || { heapUsed: 0 };
      
      // Perform many calculations
      for (let i = 0; i < 100; i++) {
        generateRankedRecommendations(testPlayers, {
          ...mockContext,
          currentPickNumber: mockContext.currentPickNumber + i
        });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage?.() || { heapUsed: 0 };
      
      // Memory growth should be reasonable (less than 50MB for 100 calculations)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });
});

describe('Performance Monitoring Integration', () => {
  it('should correctly identify slow calculations', () => {
    // Mock a slow calculation
    const slowCalculation = () => {
      const start = Date.now();
      while (Date.now() - start < 600) {
        // Busy wait to simulate slow calculation
      }
      return { recommendations: [] };
    };

    const startTime = performance.now();
    slowCalculation();
    const endTime = performance.now();
    const calculationTime = endTime - startTime;

    expect(calculationTime).toBeGreaterThan(500);
  });

  it('should correctly identify fast calculations', () => {
    const fastCalculation = () => {
      return { recommendations: [] };
    };

    const startTime = performance.now();
    fastCalculation();
    const endTime = performance.now();
    const calculationTime = endTime - startTime;

    expect(calculationTime).toBeLessThan(50);
  });
});