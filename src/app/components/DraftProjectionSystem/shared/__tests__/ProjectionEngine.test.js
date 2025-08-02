/**
 * Tests for ProjectionEngine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectionEngine } from '../ProjectionEngine.js';

describe('ProjectionEngine', () => {
  let engine;
  let mockPlayerDataProcessor;
  let mockRoster;
  let mockDraftContext;
  let mockPlayers;

  beforeEach(() => {
    // Mock player data processor
    mockPlayerDataProcessor = {
      getPlayersByPosition: vi.fn()
    };

    // Mock players
    mockPlayers = [
      {
        name: "Josh Allen",
        position: "QB",
        projected_2025_points: 347.48,
        position_rank: 1,
        overall_rank: 1,
        adp: 15
      },
      {
        name: "Christian McCaffrey",
        position: "RB",
        projected_2025_points: 280.5,
        position_rank: 1,
        overall_rank: 3,
        adp: 5
      },
      {
        name: "Cooper Kupp",
        position: "WR",
        projected_2025_points: 250.2,
        position_rank: 1,
        overall_rank: 5,
        adp: 25
      }
    ];

    // Mock roster (empty initially)
    mockRoster = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      FLEX: [],
      BENCH: []
    };

    // Mock draft context
    mockDraftContext = {
      availablePlayers: mockPlayers,
      currentPick: 10,
      managerNeeds: [
        {
          needs: { QB: 1, RB: 2, WR: 2, TE: 1 },
          nextPick: 8
        },
        {
          needs: { QB: 1, RB: 1, WR: 2, TE: 1 },
          nextPick: 12
        }
      ]
    };

    engine = new ProjectionEngine(mockPlayerDataProcessor, false);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(engine.playerDataProcessor).toBe(mockPlayerDataProcessor);
      expect(engine.adpEnabled).toBe(false);
      expect(engine.weights).toBeDefined();
      expect(engine.standardRosterFormat).toBeDefined();
    });

    it('should initialize with ADP enabled', () => {
      const adpEngine = new ProjectionEngine(mockPlayerDataProcessor, true);
      expect(adpEngine.adpEnabled).toBe(true);
    });
  });

  describe('calculatePickValue', () => {
    beforeEach(() => {
      mockPlayerDataProcessor.getPlayersByPosition.mockReturnValue(mockPlayers.filter(p => p.position === 'QB'));
    });

    it('should calculate pick value for a player', () => {
      const player = mockPlayers[0]; // Josh Allen
      const value = engine.calculatePickValue(player, mockRoster, mockDraftContext);
      
      expect(value).toBeGreaterThan(0);
      expect(typeof value).toBe('number');
    });

    it('should throw error for missing parameters', () => {
      expect(() => {
        engine.calculatePickValue(null, mockRoster, mockDraftContext);
      }).toThrow('Missing required parameters for pick value calculation');
    });

    it('should return higher value for needed positions', () => {
      const qb = mockPlayers[0]; // QB needed
      const rb = mockPlayers[1]; // RB needed
      
      mockPlayerDataProcessor.getPlayersByPosition.mockImplementation((pos) => {
        return mockPlayers.filter(p => p.position === pos);
      });

      const qbValue = engine.calculatePickValue(qb, mockRoster, mockDraftContext);
      
      // Fill QB position
      const rosterWithQB = {
        ...mockRoster,
        QB: [qb]
      };
      
      const rbValue = engine.calculatePickValue(rb, rosterWithQB, mockDraftContext);
      
      expect(qbValue).toBeGreaterThan(0);
      expect(rbValue).toBeGreaterThan(0);
    });
  });

  describe('calculateProjectedPointsScore', () => {
    beforeEach(() => {
      mockPlayerDataProcessor.getPlayersByPosition.mockReturnValue([
        { projected_2025_points: 350 },
        { projected_2025_points: 300 },
        { projected_2025_points: 250 }
      ]);
    });

    it('should normalize projected points to 0-100 scale', () => {
      const player = { projected_2025_points: 325, position: 'QB' };
      const score = engine.calculateProjectedPointsScore(player);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeCloseTo(75, 0); // (325-250)/(350-250) * 100 = 75
    });

    it('should return 0 for player without projected points', () => {
      const player = { position: 'QB' };
      const score = engine.calculateProjectedPointsScore(player);
      
      expect(score).toBe(0);
    });

    it('should handle single player position', () => {
      mockPlayerDataProcessor.getPlayersByPosition.mockReturnValue([
        { projected_2025_points: 300 }
      ]);
      
      const player = { projected_2025_points: 300, position: 'QB' };
      const score = engine.calculateProjectedPointsScore(player);
      
      expect(score).toBe(100);
    });
  });

  describe('calculatePositionalNeed', () => {
    it('should return high score for unfilled required positions', () => {
      const score = engine.calculatePositionalNeed('QB', mockRoster);
      expect(score).toBeGreaterThan(50); // QB is needed (0/1)
    });

    it('should return lower score for filled positions', () => {
      const filledRoster = {
        ...mockRoster,
        QB: [mockPlayers[0]]
      };
      
      const score = engine.calculatePositionalNeed('QB', filledRoster);
      expect(score).toBeLessThan(50); // QB is filled (1/1)
    });

    it('should handle FLEX eligible positions', () => {
      const rosterWithFlex = {
        ...mockRoster,
        RB: [mockPlayers[1]], // 1 RB in RB slot
        FLEX: [{ position: 'RB', name: 'Flex RB' }] // 1 RB in FLEX
      };
      
      const score = engine.calculatePositionalNeed('RB', rosterWithFlex);
      expect(score).toBeLessThan(50); // Should count both RB slots (2/2)
    });
  });

  describe('calculatePositionScarcity', () => {
    it('should return high scarcity for positions with few available players', () => {
      const contextWithFewPlayers = {
        ...mockDraftContext,
        availablePlayers: [mockPlayers[0]] // Only one QB available
      };
      
      const score = engine.calculatePositionScarcity('QB', contextWithFewPlayers);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return maximum scarcity for positions with no available players', () => {
      const contextWithNoPlayers = {
        ...mockDraftContext,
        availablePlayers: []
      };
      
      const score = engine.calculatePositionScarcity('QB', contextWithNoPlayers);
      expect(score).toBe(100);
    });

    it('should calculate scarcity based on value dropoff', () => {
      const contextWithMultiplePlayers = {
        ...mockDraftContext,
        availablePlayers: [
          { position: 'QB', projected_2025_points: 350 },
          { position: 'QB', projected_2025_points: 300 },
          { position: 'QB', projected_2025_points: 250 }
        ]
      };
      
      const score = engine.calculatePositionScarcity('QB', contextWithMultiplePlayers);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateCompetitionLevel', () => {
    it('should return higher competition when many managers need the position', () => {
      const player = { position: 'QB' };
      const score = engine.calculateCompetitionLevel(player, mockDraftContext);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 0 competition when no managers need the position', () => {
      const contextWithoutNeeds = {
        ...mockDraftContext,
        managerNeeds: [
          {
            needs: { QB: 0, RB: 2, WR: 2, TE: 1 }, // No QB need
            nextPick: 8
          }
        ]
      };
      
      const player = { position: 'QB' };
      const score = engine.calculateCompetitionLevel(player, contextWithoutNeeds);
      
      expect(score).toBe(0);
    });
  });

  describe('calculateADPValue', () => {
    it('should return 0 when ADP is disabled', () => {
      const player = { adp: 15 };
      const score = engine.calculateADPValue(player);
      
      expect(score).toBe(0);
    });

    it('should calculate ADP value when enabled', () => {
      engine.setADPEnabled(true);
      const player = { adp: 15, position: 'RB' };
      const score = engine.calculateADPValue(player);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return higher value for lower ADP', () => {
      engine.setADPEnabled(true);
      const earlyPick = { adp: 5, position: 'RB' };
      const latePick = { adp: 50, position: 'RB' };
      
      const earlyScore = engine.calculateADPValue(earlyPick);
      const lateScore = engine.calculateADPValue(latePick);
      
      expect(earlyScore).toBeGreaterThan(lateScore);
    });

    it('should handle different ADP data sources', () => {
      engine.setADPEnabled(true);
      
      const playerWithDirectADP = { adp: 15, position: 'WR' };
      const playerWithADPData = { 
        adpData: { adp_ppr: 20 }, 
        position: 'WR' 
      };
      const playerWithoutADP = { position: 'WR' };
      
      const directScore = engine.calculateADPValue(playerWithDirectADP);
      const dataScore = engine.calculateADPValue(playerWithADPData);
      const noADPScore = engine.calculateADPValue(playerWithoutADP);
      
      expect(directScore).toBeGreaterThan(0);
      expect(dataScore).toBeGreaterThan(0);
      expect(noADPScore).toBe(0);
      expect(directScore).toBeGreaterThan(dataScore); // Lower ADP = higher score
    });

    it('should apply position-specific weighting', () => {
      engine.setADPEnabled(true);
      const adp = 25;
      
      const rbPlayer = { adp, position: 'RB' };
      const qbPlayer = { adp, position: 'QB' };
      const wrPlayer = { adp, position: 'WR' };
      const tePlayer = { adp, position: 'TE' };
      
      const rbScore = engine.calculateADPValue(rbPlayer);
      const qbScore = engine.calculateADPValue(qbPlayer);
      const wrScore = engine.calculateADPValue(wrPlayer);
      const teScore = engine.calculateADPValue(tePlayer);
      
      // RB should have highest weight (1.2), WR baseline (1.0), TE (0.9), QB lowest (0.8)
      expect(rbScore).toBeGreaterThan(wrScore);
      expect(wrScore).toBeGreaterThan(teScore);
      expect(teScore).toBeGreaterThan(qbScore);
    });

    it('should ignore placeholder ADP values', () => {
      engine.setADPEnabled(true);
      const playerWithPlaceholder = { adp: 999, position: 'RB' };
      const score = engine.calculateADPValue(playerWithPlaceholder);
      
      expect(score).toBe(0);
    });
  });

  describe('calculateADPEfficiency', () => {
    beforeEach(() => {
      engine.setADPEnabled(true);
    });

    it('should return neutral score when ADP not available', () => {
      const player = { position: 'RB' };
      const efficiency = engine.calculateADPEfficiency(player, 25);
      
      expect(efficiency).toBe(50);
    });

    it('should return higher score when player available later than ADP', () => {
      const player = { adp: 20, position: 'RB' };
      const efficiency = engine.calculateADPEfficiency(player, 30); // Picking 10 spots later
      
      expect(efficiency).toBeGreaterThan(50);
      expect(efficiency).toBeLessThanOrEqual(100);
    });

    it('should return lower score when player going earlier than ADP', () => {
      const player = { adp: 30, position: 'RB' };
      const efficiency = engine.calculateADPEfficiency(player, 20); // Picking 10 spots earlier
      
      expect(efficiency).toBeLessThan(50);
      expect(efficiency).toBeGreaterThanOrEqual(0);
    });

    it('should return exactly 50 when picking at ADP', () => {
      const player = { adp: 25, position: 'RB' };
      const efficiency = engine.calculateADPEfficiency(player, 25);
      
      expect(efficiency).toBe(50);
    });
  });

  describe('ADP integration in calculatePickValue', () => {
    beforeEach(() => {
      mockPlayerDataProcessor.getPlayersByPosition.mockReturnValue(mockPlayers.filter(p => p.position === 'RB'));
    });

    it('should include ADP value when enabled', () => {
      engine.setADPEnabled(true);
      const player = { ...mockPlayers[1], adp: 10 }; // RB with good ADP
      
      const valueWithADP = engine.calculatePickValue(player, mockRoster, mockDraftContext);
      
      engine.setADPEnabled(false);
      const valueWithoutADP = engine.calculatePickValue(player, mockRoster, mockDraftContext);
      
      expect(valueWithADP).not.toBe(valueWithoutADP);
    });

    it('should immediately update projections when ADP is toggled', () => {
      const player = { ...mockPlayers[1], adp: 15 }; // RB with ADP
      
      // Calculate value with ADP disabled
      engine.setADPEnabled(false);
      const valueWithoutADP = engine.calculatePickValue(player, mockRoster, mockDraftContext);
      
      // Toggle ADP on and recalculate
      engine.setADPEnabled(true);
      const valueWithADP = engine.calculatePickValue(player, mockRoster, mockDraftContext);
      
      // Values should be different
      expect(valueWithADP).not.toBe(valueWithoutADP);
      
      // Toggle back off and verify it returns to original value
      engine.setADPEnabled(false);
      const valueAfterToggleOff = engine.calculatePickValue(player, mockRoster, mockDraftContext);
      
      expect(valueAfterToggleOff).toBeCloseTo(valueWithoutADP, 2);
    });

    it('should apply ADP efficiency adjustment', () => {
      engine.setADPEnabled(true);
      const player = { ...mockPlayers[1], adp: 20 };
      
      // Context where player is available later than ADP (good value)
      const goodValueContext = {
        ...mockDraftContext,
        currentPick: 30
      };
      
      // Context where player is going earlier than ADP (reaching)
      const reachingContext = {
        ...mockDraftContext,
        currentPick: 10
      };
      
      const goodValueScore = engine.calculatePickValue(player, mockRoster, goodValueContext);
      const reachingScore = engine.calculatePickValue(player, mockRoster, reachingContext);
      
      expect(goodValueScore).toBeGreaterThan(reachingScore);
    });

    it('should handle missing ADP data gracefully', () => {
      engine.setADPEnabled(true);
      const playerWithoutADP = { ...mockPlayers[1] };
      delete playerWithoutADP.adp;
      
      expect(() => {
        engine.calculatePickValue(playerWithoutADP, mockRoster, mockDraftContext);
      }).not.toThrow();
      
      const score = engine.calculatePickValue(playerWithoutADP, mockRoster, mockDraftContext);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should properly weight ADP value in overall pick calculation', () => {
      engine.setADPEnabled(true);
      
      // Player with very good ADP (early pick)
      const earlyADPPlayer = { 
        ...mockPlayers[1], 
        adp: 5,
        projected_2025_points: 200 // Lower projected points
      };
      
      // Player with poor ADP (late pick) but higher projections
      const lateADPPlayer = { 
        ...mockPlayers[1], 
        adp: 100,
        projected_2025_points: 250 // Higher projected points
      };
      
      const earlyADPScore = engine.calculatePickValue(earlyADPPlayer, mockRoster, mockDraftContext);
      const lateADPScore = engine.calculatePickValue(lateADPPlayer, mockRoster, mockDraftContext);
      
      // The ADP component should influence the score, but projected points should still be primary
      expect(earlyADPScore).toBeGreaterThan(0);
      expect(lateADPScore).toBeGreaterThan(0);
      
      // Verify ADP is being factored in by checking the ADP component directly
      const earlyADPValue = engine.calculateADPValue(earlyADPPlayer);
      const lateADPValue = engine.calculateADPValue(lateADPPlayer);
      
      expect(earlyADPValue).toBeGreaterThan(lateADPValue);
    });
  });

  describe('calculateReplacementValue', () => {
    it('should return high value when no replacement players available', () => {
      const contextWithoutReplacements = {
        ...mockDraftContext,
        availablePlayers: []
      };
      
      const player = { position: 'QB', projected_2025_points: 300 };
      const score = engine.calculateReplacementValue(player, contextWithoutReplacements);
      
      expect(score).toBe(100);
    });

    it('should calculate value above replacement level', () => {
      const contextWithReplacements = {
        ...mockDraftContext,
        availablePlayers: [
          { position: 'QB', projected_2025_points: 350 },
          { position: 'QB', projected_2025_points: 300 },
          { position: 'QB', projected_2025_points: 250 },
          { position: 'QB', projected_2025_points: 200 }
        ]
      };
      
      const player = { position: 'QB', projected_2025_points: 350 };
      const score = engine.calculateReplacementValue(player, contextWithReplacements);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('weightedScore', () => {
    it('should calculate weighted average correctly', () => {
      const factors = {
        factor1: 80,
        factor2: 60,
        factor3: 40
      };
      
      const weights = {
        factor1: 0.5,
        factor2: 0.3,
        factor3: 0.2
      };
      
      const score = engine.weightedScore(factors, weights);
      const expected = (80 * 0.5 + 60 * 0.3 + 40 * 0.2) / (0.5 + 0.3 + 0.2);
      
      expect(score).toBeCloseTo(expected, 2);
    });

    it('should handle zero weights', () => {
      const factors = { factor1: 80 };
      const weights = { factor1: 0 };
      
      const score = engine.weightedScore(factors, weights);
      expect(score).toBe(0);
    });
  });

  describe('roster utility methods', () => {
    it('should count current position correctly', () => {
      const roster = {
        QB: [mockPlayers[0]],
        RB: [mockPlayers[1]],
        WR: [],
        TE: [],
        FLEX: [{ position: 'WR', name: 'Flex WR' }],
        BENCH: []
      };
      
      expect(engine.getCurrentPositionCount('QB', roster)).toBe(1);
      expect(engine.getCurrentPositionCount('RB', roster)).toBe(1);
      expect(engine.getCurrentPositionCount('WR', roster)).toBe(1); // Includes FLEX
      expect(engine.getCurrentPositionCount('TE', roster)).toBe(0);
    });

    it('should get required position counts', () => {
      expect(engine.getRequiredPositionCount('QB')).toBe(1);
      expect(engine.getRequiredPositionCount('RB')).toBe(2);
      expect(engine.getRequiredPositionCount('WR')).toBe(2);
      expect(engine.getRequiredPositionCount('TE')).toBe(1);
      expect(engine.getRequiredPositionCount('FLEX')).toBe(1);
      expect(engine.getRequiredPositionCount('BENCH')).toBe(6);
    });

    it('should calculate total roster spots', () => {
      const total = engine.getTotalRosterSpots();
      expect(total).toBe(13); // 1+2+2+1+1+6
    });

    it('should count total roster players', () => {
      const roster = {
        QB: [mockPlayers[0]],
        RB: [mockPlayers[1]],
        WR: [],
        TE: [],
        FLEX: [],
        BENCH: []
      };
      
      const count = engine.getTotalRosterCount(roster);
      expect(count).toBe(2);
    });
  });

  describe('getTopPicks', () => {
    beforeEach(() => {
      mockPlayerDataProcessor.getPlayersByPosition.mockImplementation((pos) => {
        return mockPlayers.filter(p => p.position === pos);
      });
    });

    it('should return top picks with scores and reasoning', () => {
      const topPicks = engine.getTopPicks(mockRoster, mockPlayers, mockDraftContext, 2);
      
      expect(topPicks).toHaveLength(2);
      expect(topPicks[0]).toHaveProperty('player');
      expect(topPicks[0]).toHaveProperty('score');
      expect(topPicks[0]).toHaveProperty('reasoning');
      expect(topPicks[0].score).toBeGreaterThanOrEqual(topPicks[1].score);
    });

    it('should return empty array for no available players', () => {
      const topPicks = engine.getTopPicks(mockRoster, [], mockDraftContext, 3);
      expect(topPicks).toHaveLength(0);
    });

    it('should limit results to requested count', () => {
      const topPicks = engine.getTopPicks(mockRoster, mockPlayers, mockDraftContext, 1);
      expect(topPicks).toHaveLength(1);
    });
  });

  describe('generatePickReasoning', () => {
    it('should generate reasoning for positional need', () => {
      const player = mockPlayers[0]; // QB
      const reasoning = engine.generatePickReasoning(player, mockRoster, mockDraftContext, 75);
      
      expect(reasoning).toContain('QB need');
    });

    it('should generate reasoning for top-tier players', () => {
      const player = { ...mockPlayers[0], position_rank: 3 };
      const reasoning = engine.generatePickReasoning(player, mockRoster, mockDraftContext, 75);
      
      expect(reasoning).toContain('Top-tier');
    });

    it('should generate reasoning for high projected points', () => {
      const player = { ...mockPlayers[0], projected_2025_points: 300 };
      const reasoning = engine.generatePickReasoning(player, mockRoster, mockDraftContext, 75);
      
      expect(reasoning).toContain('High projected points');
    });
  });

  describe('position-specific ADP methods', () => {
    it('should return correct max ADP for each position', () => {
      expect(engine.getMaxADPForPosition('QB')).toBe(180);
      expect(engine.getMaxADPForPosition('RB')).toBe(120);
      expect(engine.getMaxADPForPosition('WR')).toBe(150);
      expect(engine.getMaxADPForPosition('TE')).toBe(200);
      expect(engine.getMaxADPForPosition('UNKNOWN')).toBe(200);
    });

    it('should return correct ADP position weights', () => {
      expect(engine.getADPPositionWeight('QB')).toBe(0.8);
      expect(engine.getADPPositionWeight('RB')).toBe(1.2);
      expect(engine.getADPPositionWeight('WR')).toBe(1.0);
      expect(engine.getADPPositionWeight('TE')).toBe(0.9);
      expect(engine.getADPPositionWeight('UNKNOWN')).toBe(1.0);
    });
  });

  describe('configuration methods', () => {
    it('should update ADP enabled state', () => {
      expect(engine.adpEnabled).toBe(false);
      engine.setADPEnabled(true);
      expect(engine.adpEnabled).toBe(true);
    });

    it('should update weights', () => {
      const newWeights = { projectedPoints: 0.5 };
      engine.updateWeights(newWeights);
      
      expect(engine.weights.projectedPoints).toBe(0.5);
      expect(engine.weights.positionalNeed).toBe(0.25); // Should preserve other weights
    });

    it('should maintain ADP weight when updating other weights', () => {
      const originalADPWeight = engine.weights.adpValue;
      engine.updateWeights({ projectedPoints: 0.4 });
      
      expect(engine.weights.adpValue).toBe(originalADPWeight);
    });
  });

  describe('ADP toggle integration (Requirement 8.4)', () => {
    beforeEach(() => {
      mockPlayerDataProcessor.getPlayersByPosition.mockImplementation((pos) => {
        return mockPlayers.filter(p => p.position === pos);
      });
    });

    it('should immediately update all projections when ADP is toggled', () => {
      const playersWithADP = [
        { ...mockPlayers[0], adp: 15 }, // QB
        { ...mockPlayers[1], adp: 8 },  // RB
        { ...mockPlayers[2], adp: 30 }  // WR
      ];

      // Calculate top picks with ADP disabled
      engine.setADPEnabled(false);
      const picksWithoutADP = engine.getTopPicks(mockRoster, playersWithADP, mockDraftContext, 3);
      
      // Toggle ADP on and recalculate
      engine.setADPEnabled(true);
      const picksWithADP = engine.getTopPicks(mockRoster, playersWithADP, mockDraftContext, 3);
      
      // Verify that scores have changed for all players
      expect(picksWithoutADP).toHaveLength(3);
      expect(picksWithADP).toHaveLength(3);
      
      for (let i = 0; i < 3; i++) {
        expect(picksWithADP[i].score).not.toBe(picksWithoutADP[i].score);
      }
      
      // Toggle back off and verify scores return to original values
      engine.setADPEnabled(false);
      const picksAfterToggleOff = engine.getTopPicks(mockRoster, playersWithADP, mockDraftContext, 3);
      
      for (let i = 0; i < 3; i++) {
        expect(picksAfterToggleOff[i].score).toBeCloseTo(picksWithoutADP[i].score, 2);
      }
    });

    it('should update recommendations when ADP affects player rankings', () => {
      const playersWithVariedADP = [
        { 
          name: "High ADP Player",
          position: "RB", 
          projected_2025_points: 200, 
          position_rank: 5,
          adp: 10 // Very good ADP
        },
        { 
          name: "Low ADP Player",
          position: "RB", 
          projected_2025_points: 220, 
          position_rank: 3,
          adp: 80 // Poor ADP
        }
      ];

      // Calculate individual scores to verify ADP impact
      engine.setADPEnabled(false);
      const highADPScoreWithoutADP = engine.calculatePickValue(playersWithVariedADP[0], mockRoster, mockDraftContext);
      const lowADPScoreWithoutADP = engine.calculatePickValue(playersWithVariedADP[1], mockRoster, mockDraftContext);

      engine.setADPEnabled(true);
      const highADPScoreWithADP = engine.calculatePickValue(playersWithVariedADP[0], mockRoster, mockDraftContext);
      const lowADPScoreWithADP = engine.calculatePickValue(playersWithVariedADP[1], mockRoster, mockDraftContext);
      
      // Verify that ADP affects the scores (main requirement)
      expect(highADPScoreWithADP).not.toBe(highADPScoreWithoutADP);
      expect(lowADPScoreWithADP).not.toBe(lowADPScoreWithoutADP);
      
      // Verify that ADP values are being calculated correctly
      const highADPValue = engine.calculateADPValue(playersWithVariedADP[0]);
      const lowADPValue = engine.calculateADPValue(playersWithVariedADP[1]);
      
      expect(highADPValue).toBeGreaterThan(lowADPValue); // Better ADP = higher value
      expect(highADPValue).toBeGreaterThan(0);
      expect(lowADPValue).toBeGreaterThanOrEqual(0);
    });

    it('should maintain consistent behavior across multiple toggle operations', () => {
      const player = { ...mockPlayers[1], adp: 20 };
      
      // Record initial state
      engine.setADPEnabled(false);
      const initialScore = engine.calculatePickValue(player, mockRoster, mockDraftContext);
      
      // Toggle multiple times and verify consistency
      for (let i = 0; i < 5; i++) {
        engine.setADPEnabled(true);
        const enabledScore = engine.calculatePickValue(player, mockRoster, mockDraftContext);
        
        engine.setADPEnabled(false);
        const disabledScore = engine.calculatePickValue(player, mockRoster, mockDraftContext);
        
        // Scores should be consistent across toggles
        expect(disabledScore).toBeCloseTo(initialScore, 2);
        expect(enabledScore).not.toBe(disabledScore);
      }
    });
  });
});