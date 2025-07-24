/**
 * Statistical Insights Tests
 * Tests for consistency scoring, trend detection, league comparisons, and pattern identification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateConsistencyScoring,
  detectTrends,
  buildLeagueComparisons,
  identifyUniquePatterns,
  createVisualIndicators
} from '../statisticalInsights.js';

describe('Statistical Insights', () => {
  let mockPicks, mockYearOverYearTrends, mockManagerStats, mockLeagueAverages;

  beforeEach(() => {
    // Mock draft picks data
    mockPicks = [
      { 
        metadata: { player_id: 'player1' }, 
        playerName: 'Player 1', 
        position: 'RB', 
        round: 1, 
        pick_no: 5, 
        season: 2023 
      },
      { 
        metadata: { player_id: 'player2' }, 
        playerName: 'Player 2', 
        position: 'WR', 
        round: 2, 
        pick_no: 18, 
        season: 2023 
      },
      { 
        metadata: { player_id: 'player1' }, 
        playerName: 'Player 1', 
        position: 'RB', 
        round: 1, 
        pick_no: 8, 
        season: 2022 
      },
      { 
        metadata: { player_id: 'player3' }, 
        playerName: 'Player 3', 
        position: 'QB', 
        round: 3, 
        pick_no: 25, 
        season: 2022 
      }
    ];

    // Mock year-over-year trends
    mockYearOverYearTrends = {
      2023: {
        positionFrequencies: {
          RB: { percentage: 50, avgRound: 1.0 },
          WR: { percentage: 50, avgRound: 2.0 }
        },
        roundTendencies: {
          earlyRounds: { percentage: 100 },
          lateRounds: { percentage: 0 }
        }
      },
      2022: {
        positionFrequencies: {
          RB: { percentage: 50, avgRound: 1.0 },
          QB: { percentage: 50, avgRound: 3.0 }
        },
        roundTendencies: {
          earlyRounds: { percentage: 50 },
          lateRounds: { percentage: 50 }
        }
      }
    };

    // Mock manager statistics
    mockManagerStats = {
      positionFrequencies: {
        RB: { percentage: 50, avgRound: 1.0 },
        WR: { percentage: 25, avgRound: 2.0 },
        QB: { percentage: 25, avgRound: 3.0 }
      },
      roundTendencies: {
        earlyRounds: { percentage: 75 },
        lateRounds: { percentage: 25 }
      }
    };

    // Mock league averages
    mockLeagueAverages = {
      positionFrequencies: {
        RB: { percentage: 30, avgRound: 2.0 },
        WR: { percentage: 40, avgRound: 2.5 },
        QB: { percentage: 15, avgRound: 4.0 }
      },
      roundTendencies: {
        earlyRounds: { percentage: 60 },
        lateRounds: { percentage: 40 }
      }
    };
  });

  describe('calculateConsistencyScoring', () => {
    it('should calculate consistency scores correctly', () => {
      const result = calculateConsistencyScoring(mockPicks, mockYearOverYearTrends);
      
      expect(result).toHaveProperty('positionConsistency');
      expect(result).toHaveProperty('roundConsistency');
      expect(result).toHaveProperty('playerLoyalty');
      expect(result).toHaveProperty('overallConsistency');
      expect(result).toHaveProperty('consistencyLevel');
      
      expect(typeof result.positionConsistency).toBe('number');
      expect(typeof result.roundConsistency).toBe('number');
      expect(typeof result.playerLoyalty).toBe('number');
      expect(typeof result.overallConsistency).toBe('number');
      
      expect(result.positionConsistency).toBeGreaterThanOrEqual(0);
      expect(result.positionConsistency).toBeLessThanOrEqual(100);
      expect(result.playerLoyalty).toBeGreaterThan(0); // Should detect player1 drafted twice
    });

    it('should handle insufficient data gracefully', () => {
      const result = calculateConsistencyScoring([], {});
      
      expect(result.consistencyLevel).toBe('insufficient_data');
      expect(result.overallConsistency).toBe(0);
    });

    it('should handle single season data', () => {
      const singleSeasonTrends = { 2023: mockYearOverYearTrends[2023] };
      const result = calculateConsistencyScoring(mockPicks, singleSeasonTrends);
      
      expect(result.consistencyLevel).toBe('insufficient_data');
    });
  });

  describe('detectTrends', () => {
    it('should detect trends when sufficient data exists', () => {
      const result = detectTrends(mockYearOverYearTrends);
      
      expect(result).toHaveProperty('trendDetected');
      expect(result).toHaveProperty('trendType');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('details');
      
      expect(typeof result.trendDetected).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
    });

    it('should handle insufficient data', () => {
      const result = detectTrends({});
      
      expect(result.trendDetected).toBe(false);
      expect(result.trendType).toBe('insufficient_data');
      expect(result.confidence).toBe(0);
    });

    it('should handle single season data', () => {
      const singleSeason = { 2023: mockYearOverYearTrends[2023] };
      const result = detectTrends(singleSeason);
      
      expect(result.trendDetected).toBe(false);
      expect(result.trendType).toBe('insufficient_data');
    });
  });

  describe('buildLeagueComparisons', () => {
    it('should build comprehensive league comparisons', () => {
      const result = buildLeagueComparisons(mockManagerStats, mockLeagueAverages);
      
      expect(result).toHaveProperty('positionComparisons');
      expect(result).toHaveProperty('roundComparisons');
      expect(result).toHaveProperty('overallComparison');
      expect(result).toHaveProperty('standoutMetrics');
      
      // Should detect RB preference difference (50% vs 30% = +20%)
      expect(result.positionComparisons.RB).toBeDefined();
      expect(result.positionComparisons.RB.percentageDifference).toBeCloseTo(20, 1);
      expect(result.positionComparisons.RB.isStandout).toBe(true);
      
      // Should have standout metrics
      expect(result.standoutMetrics.length).toBeGreaterThan(0);
    });

    it('should handle missing data gracefully', () => {
      const result = buildLeagueComparisons(null, null);
      
      expect(result.overallComparison).toBe('insufficient_data');
      expect(result.standoutMetrics).toEqual([]);
    });

    it('should identify contrarian patterns', () => {
      const extremeStats = {
        positionFrequencies: {
          RB: { percentage: 80, avgRound: 1.0 }, // Very different from league 30%
          WR: { percentage: 10, avgRound: 2.0 }  // Very different from league 40%
        }
      };
      
      const result = buildLeagueComparisons(extremeStats, mockLeagueAverages);
      
      expect(result.standoutMetrics.length).toBeGreaterThanOrEqual(2);
      expect(result.overallComparison).not.toBe('league_average');
    });
  });

  describe('identifyUniquePatterns', () => {
    it('should identify position specialist pattern', () => {
      const specialistStats = {
        positionFrequencies: {
          RB: { percentage: 60, avgRound: 1.5 }, // Dominant position
          WR: { percentage: 40, avgRound: 2.0 }
        }
      };
      
      const mockConsistency = { playerLoyalty: 30, overallConsistency: 70 };
      const mockTrends = { trendDetected: false, confidence: 0 };
      const mockComparisons = { standoutMetrics: [] };
      
      const result = identifyUniquePatterns(specialistStats, mockComparisons, mockConsistency, mockTrends);
      
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns.some(p => p.type === 'position_specialist')).toBe(true);
    });

    it('should identify player loyalist pattern', () => {
      const mockConsistency = { playerLoyalty: 70, overallConsistency: 60 }; // High loyalty
      const mockTrends = { trendDetected: false, confidence: 0 };
      const mockComparisons = { standoutMetrics: [] };
      
      const result = identifyUniquePatterns(mockManagerStats, mockComparisons, mockConsistency, mockTrends);
      
      expect(result.patterns.some(p => p.type === 'player_loyalist')).toBe(true);
    });

    it('should identify consistent drafter pattern', () => {
      const mockConsistency = { playerLoyalty: 50, overallConsistency: 80 }; // High consistency
      const mockTrends = { trendDetected: false, confidence: 0 };
      const mockComparisons = { standoutMetrics: [] };
      
      const result = identifyUniquePatterns(mockManagerStats, mockComparisons, mockConsistency, mockTrends);
      
      expect(result.patterns.some(p => p.type === 'consistent_drafter')).toBe(true);
    });

    it('should calculate uniqueness score', () => {
      const mockConsistency = { playerLoyalty: 50, overallConsistency: 70 };
      const mockTrends = { trendDetected: false, confidence: 0 };
      const mockComparisons = { standoutMetrics: [{ difference: 25 }] }; // One standout metric
      
      const result = identifyUniquePatterns(mockManagerStats, mockComparisons, mockConsistency, mockTrends);
      
      expect(result.uniquenessScore).toBeGreaterThan(0);
      expect(result.uniquenessScore).toBeLessThanOrEqual(100);
    });
  });

  describe('createVisualIndicators', () => {
    it('should create visual indicators for significant trends', () => {
      const mockTrends = { 
        trendDetected: true, 
        confidence: 80, 
        trendType: 'evolving_strategy',
        details: {}
      };
      const mockComparisons = { standoutMetrics: [] };
      const mockPatterns = { 
        primaryPattern: { confidence: 75, type: 'position_specialist', description: 'Test pattern' },
        patterns: []
      };
      
      const result = createVisualIndicators(mockTrends, mockComparisons, mockPatterns);
      
      expect(result).toHaveProperty('indicators');
      expect(result).toHaveProperty('hasSignificantIndicators');
      expect(result).toHaveProperty('totalIndicators');
      expect(result).toHaveProperty('indicatorSummary');
      
      expect(result.indicators.length).toBeGreaterThan(0);
      expect(result.indicators.some(i => i.type === 'trend')).toBe(true);
      expect(result.indicators.some(i => i.type === 'pattern')).toBe(true);
    });

    it('should create comparison indicators for standout metrics', () => {
      const mockTrends = { trendDetected: false, confidence: 0 };
      const mockComparisons = { 
        standoutMetrics: [
          { difference: 25, description: 'High RB preference', type: 'position', metric: 'frequency' }
        ]
      };
      const mockPatterns = { patterns: [] };
      
      const result = createVisualIndicators(mockTrends, mockComparisons, mockPatterns);
      
      expect(result.indicators.some(i => i.type === 'comparison')).toBe(true);
    });

    it('should generate indicator summary', () => {
      const mockTrends = { trendDetected: true, confidence: 70, trendType: 'test' };
      const mockComparisons = { 
        standoutMetrics: [{ difference: 25, description: 'Test', type: 'position', metric: 'test' }]
      };
      const mockPatterns = { 
        primaryPattern: { confidence: 80, type: 'test', description: 'Test' },
        patterns: []
      };
      
      const result = createVisualIndicators(mockTrends, mockComparisons, mockPatterns);
      
      expect(result.indicatorSummary).toHaveProperty('trends');
      expect(result.indicatorSummary).toHaveProperty('comparisons');
      expect(result.indicatorSummary).toHaveProperty('patterns');
      expect(result.indicatorSummary).toHaveProperty('highSeverity');
      
      expect(result.indicatorSummary.trends).toBeGreaterThan(0);
      expect(result.indicatorSummary.comparisons).toBeGreaterThan(0);
      expect(result.indicatorSummary.patterns).toBeGreaterThan(0);
    });

    it('should handle empty data gracefully', () => {
      const result = createVisualIndicators({}, {}, {});
      
      expect(result.indicators).toEqual([]);
      expect(result.hasSignificantIndicators).toBe(false);
      expect(result.totalIndicators).toBe(0);
    });
  });
});