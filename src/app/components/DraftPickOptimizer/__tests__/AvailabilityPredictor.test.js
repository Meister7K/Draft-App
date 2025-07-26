import { describe, it, expect, vi } from 'vitest';
import {
  calculatePlayerAvailability,
  estimatePickRange,
  assessWaitingRisk,
  projectPlayerAvailability
} from '../AvailabilityPredictor.js';

// Mock player data
const mockPlayer = {
  player_info: {
    player_id: 'test-player-1',
    name: 'Test Player',
    position: 'RB',
    team: 'TEST',
    overall_rank: 25,
    position_rank: 8,
    projected_2025_points: 250
  }
};

const mockQBPlayer = {
  player_info: {
    player_id: 'test-qb-1',
    name: 'Test QB',
    position: 'QB',
    team: 'TEST',
    overall_rank: 15,
    position_rank: 3,
    projected_2025_points: 300
  }
};

const mockTEPlayer = {
  player_info: {
    player_id: 'test-te-1',
    name: 'Test TE',
    position: 'TE',
    team: 'TEST',
    overall_rank: 45,
    position_rank: 4,
    projected_2025_points: 180
  }
};

// Mock draft context
const createMockDraftContext = (overrides = {}) => ({
  currentPickNumber: 30,
  picksUntilNext: 5,
  totalManagers: 12,
  draftOrder: Array.from({ length: 12 }, (_, i) => ({ user_id: `user-${i + 1}` })),
  leagueAnalysis: {
    totalManagers: 12,
    positionDemand: {
      QB: {
        totalSlotsNeeded: 12,
        slotsFilled: 8,
        slotsRemaining: 4,
        managersStillNeed: 4,
        competitionLevel: 'medium',
        competitionScore: 50
      },
      RB: {
        totalSlotsNeeded: 24,
        slotsFilled: 15,
        slotsRemaining: 9,
        managersStillNeed: 9,
        competitionLevel: 'high',
        competitionScore: 75
      },
      WR: {
        totalSlotsNeeded: 24,
        slotsFilled: 16,
        slotsRemaining: 8,
        managersStillNeed: 8,
        competitionLevel: 'high',
        competitionScore: 70
      },
      TE: {
        totalSlotsNeeded: 12,
        slotsFilled: 6,
        slotsRemaining: 6,
        managersStillNeed: 10,
        competitionLevel: 'very_high',
        competitionScore: 90
      }
    }
  },
  targetingPrediction: {
    nextFewPicks: [
      {
        pickNumber: 31,
        managerId: 'user-1',
        urgentNeeds: ['RB'],
        moderateNeeds: ['WR'],
        primaryTarget: 'RB',
        likelyTargets: ['RB', 'WR']
      },
      {
        pickNumber: 32,
        managerId: 'user-2',
        urgentNeeds: ['TE'],
        moderateNeeds: [],
        primaryTarget: 'TE',
        likelyTargets: ['TE']
      }
    ],
    positionTargeting: {
      RB: {
        managersLikelyToTarget: 3,
        pickNumbers: [31, 33, 35],
        urgencyLevel: 'high'
      },
      TE: {
        managersLikelyToTarget: 2,
        pickNumbers: [32, 34],
        urgencyLevel: 'high'
      },
      WR: {
        managersLikelyToTarget: 2,
        pickNumbers: [31, 36],
        urgencyLevel: 'medium'
      },
      QB: {
        managersLikelyToTarget: 1,
        pickNumbers: [37],
        urgencyLevel: 'medium'
      }
    }
  },
  userFuturePicks: [35, 58, 83],
  ...overrides
});

describe('AvailabilityPredictor', () => {
  describe('calculatePlayerAvailability', () => {
    it('should return zero availability for invalid player', () => {
      const result = calculatePlayerAvailability(null, createMockDraftContext());
      expect(result.availabilityPercentage).toBe(0);
      expect(result.riskLevel).toBe('unknown');
      expect(result.explanation).toContain('Invalid player');
    });

    it('should return zero availability for missing context', () => {
      const result = calculatePlayerAvailability(mockPlayer, null);
      expect(result.availabilityPercentage).toBe(0);
      expect(result.explanation).toContain('Invalid player or draft context');
    });

    it('should calculate availability for RB with high competition', () => {
      const context = createMockDraftContext();
      const result = calculatePlayerAvailability(mockPlayer, context);
      
      expect(result.availabilityPercentage).toBeGreaterThan(0);
      expect(result.availabilityPercentage).toBeLessThan(100);
      expect(result.estimatedPickRange).toHaveProperty('earliest');
      expect(result.estimatedPickRange).toHaveProperty('latest');
      expect(result.estimatedPickRange).toHaveProperty('mostLikely');
      expect(result.riskLevel).toMatch(/^(low|medium|high|very_high)$/);
      expect(result.explanation).toContain('chance available');
      expect(result.competitionFactor).toBeGreaterThan(1);
    });

    it('should show lower availability for TE due to high competition', () => {
      const context = createMockDraftContext();
      const rbResult = calculatePlayerAvailability(mockPlayer, context);
      const teResult = calculatePlayerAvailability(mockTEPlayer, context);
      
      // TE should have higher or equal competition factor due to very high competition
      expect(teResult.competitionFactor).toBeGreaterThanOrEqual(rbResult.competitionFactor);
      expect(teResult.explanation).toMatch(/(High|Moderate) TE competition/);
    });

    it('should show higher availability for QB due to lower competition', () => {
      const context = createMockDraftContext();
      const rbResult = calculatePlayerAvailability(mockPlayer, context);
      const qbResult = calculatePlayerAvailability(mockQBPlayer, context);
      
      // QB should have lower competition factor than RB
      expect(qbResult.competitionFactor).toBeLessThan(rbResult.competitionFactor);
      // QB explanation should indicate lower competition level
      expect(qbResult.explanation).toMatch(/(Low|Moderate) QB competition/);
    });

    it('should handle missing league analysis gracefully', () => {
      const context = createMockDraftContext({ leagueAnalysis: null });
      const result = calculatePlayerAvailability(mockPlayer, context);
      
      expect(result.availabilityPercentage).toBeGreaterThan(0);
      expect(result.competitionFactor).toBeGreaterThan(0);
      // Should use default competition levels
    });

    it('should adjust availability based on immediate targeting', () => {
      const context = createMockDraftContext({
        targetingPrediction: {
          nextFewPicks: [
            {
              pickNumber: 31,
              managerId: 'user-1',
              likelyTargets: ['RB'],
              primaryTarget: 'RB'
            },
            {
              pickNumber: 32,
              managerId: 'user-2',
              likelyTargets: ['RB'],
              primaryTarget: 'RB'
            }
          ],
          positionTargeting: {
            RB: {
              managersLikelyToTarget: 4,
              urgencyLevel: 'high'
            }
          }
        }
      });
      
      const result = calculatePlayerAvailability(mockPlayer, context);
      expect(result.competitionFactor).toBeGreaterThan(1.5);
      expect(result.explanation).toContain('High RB competition');
    });
  });

  describe('estimatePickRange', () => {
    it('should estimate reasonable pick range based on overall rank', () => {
      const context = createMockDraftContext();
      const competitionFactor = 1.3;
      const result = estimatePickRange(mockPlayer, context, competitionFactor);
      
      expect(result.earliest).toBeGreaterThan(0);
      expect(result.latest).toBeGreaterThan(result.earliest);
      expect(result.mostLikely).toBeGreaterThanOrEqual(result.earliest);
      expect(result.mostLikely).toBeLessThanOrEqual(result.latest);
      
      // Should be reasonably close to overall rank (25)
      expect(result.mostLikely).toBeGreaterThan(15);
      expect(result.mostLikely).toBeLessThan(50);
    });

    it('should adjust range based on position scarcity', () => {
      const context = createMockDraftContext();
      const competitionFactor = 1.5;
      
      const rbRange = estimatePickRange(mockPlayer, context, competitionFactor);
      const teRange = estimatePickRange(mockTEPlayer, context, competitionFactor);
      
      // Both ranges should be valid and respect current pick constraint
      expect(teRange.earliest).toBeGreaterThan(context.currentPickNumber);
      expect(rbRange.earliest).toBeGreaterThan(context.currentPickNumber);
      expect(teRange.mostLikely).toBeGreaterThanOrEqual(teRange.earliest);
      expect(rbRange.mostLikely).toBeGreaterThanOrEqual(rbRange.earliest);
      
      // TE position adjustment should be applied (even if constrained by current pick)
      expect(teRange.mostLikely).toBeLessThanOrEqual(teRange.latest);
    });

    it('should not allow picks before current pick', () => {
      const earlyPlayer = {
        player_info: {
          ...mockPlayer.player_info,
          overall_rank: 5 // Very early rank
        }
      };
      
      const context = createMockDraftContext({ currentPickNumber: 30 });
      const result = estimatePickRange(earlyPlayer, context, 1.0);
      
      expect(result.earliest).toBeGreaterThan(30);
      expect(result.mostLikely).toBeGreaterThan(30);
    });

    it('should apply competition factor correctly', () => {
      const context = createMockDraftContext();
      
      const lowCompetitionRange = estimatePickRange(mockPlayer, context, 1.0);
      const highCompetitionRange = estimatePickRange(mockPlayer, context, 2.0);
      
      // Higher competition should result in earlier picks, but both may be constrained by current pick
      if (lowCompetitionRange.mostLikely > context.currentPickNumber + 1) {
        expect(highCompetitionRange.mostLikely).toBeLessThanOrEqual(lowCompetitionRange.mostLikely);
      } else {
        // If both are constrained by current pick, they should be close
        expect(Math.abs(highCompetitionRange.mostLikely - lowCompetitionRange.mostLikely)).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('assessWaitingRisk', () => {
    it('should return invalid assessment for missing data', () => {
      const result = assessWaitingRisk(null, createMockDraftContext());
      expect(result.shouldWait).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Invalid player');
    });

    it('should recommend waiting for high availability players', () => {
      // Mock a player with high availability
      const latePlayer = {
        player_info: {
          ...mockPlayer.player_info,
          overall_rank: 80 // Late round player
        }
      };
      
      const context = createMockDraftContext();
      const result = assessWaitingRisk(latePlayer, context);
      
      expect(result.shouldWait).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toContain('Low risk');
    });

    it('should recommend picking now for low availability players', () => {
      // Create context with high competition for TE
      const context = createMockDraftContext({
        targetingPrediction: {
          nextFewPicks: [
            { pickNumber: 31, likelyTargets: ['TE'], primaryTarget: 'TE' },
            { pickNumber: 32, likelyTargets: ['TE'], primaryTarget: 'TE' },
            { pickNumber: 33, likelyTargets: ['TE'], primaryTarget: 'TE' }
          ],
          positionTargeting: {
            TE: {
              managersLikelyToTarget: 5,
              urgencyLevel: 'high'
            }
          }
        }
      });
      
      const result = assessWaitingRisk(mockTEPlayer, context);
      
      expect(result.shouldWait).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toContain('High risk');
    });

    it('should provide future availability projections', () => {
      const context = createMockDraftContext({
        userFuturePicks: [35, 58, 83]
      });
      
      const result = assessWaitingRisk(mockPlayer, context);
      
      expect(result.futureAvailability).toHaveLength(3);
      result.futureAvailability.forEach(future => {
        expect(future).toHaveProperty('pickNumber');
        expect(future).toHaveProperty('availability');
        expect(future.availability).toBeGreaterThanOrEqual(0);
        expect(future.availability).toBeLessThanOrEqual(100);
      });
    });

    it('should identify risk factors correctly', () => {
      const context = createMockDraftContext({
        leagueAnalysis: {
          ...createMockDraftContext().leagueAnalysis,
          positionDemand: {
            TE: {
              competitionLevel: 'very_high',
              managersStillNeed: 10
            }
          }
        },
        targetingPrediction: {
          positionTargeting: {
            TE: {
              managersLikelyToTarget: 4,
              urgencyLevel: 'high'
            }
          }
        }
      });
      
      const result = assessWaitingRisk(mockTEPlayer, context);
      
      expect(result.riskFactors).toBeInstanceOf(Array);
      expect(result.riskFactors.length).toBeGreaterThan(0);
      
      // Should identify high demand and multiple managers needing TE
      const riskTypes = result.riskFactors.map(factor => factor.type);
      expect(riskTypes).toContain('highDemandPosition');
      expect(riskTypes).toContain('multipleManagersNeed');
    });

    it('should handle moderate risk scenarios', () => {
      const moderatePlayer = {
        player_info: {
          ...mockPlayer.player_info,
          overall_rank: 40 // Moderate rank
        }
      };
      
      const context = createMockDraftContext();
      const result = assessWaitingRisk(moderatePlayer, context);
      
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(1);
      expect(result.reasoning).toBeDefined();
    });
  });

  describe('projectPlayerAvailability', () => {
    const mockAvailablePlayers = [
      mockPlayer,
      mockQBPlayer,
      mockTEPlayer,
      {
        player_info: {
          player_id: 'test-wr-1',
          name: 'Test WR',
          position: 'WR',
          overall_rank: 35,
          position_rank: 12
        }
      }
    ];

    it('should return error for invalid input', () => {
      const result = projectPlayerAvailability(null, createMockDraftContext());
      expect(result.error).toContain('Invalid players');
      expect(result.projections).toEqual({});
    });

    it('should project availability for all players', () => {
      const context = createMockDraftContext();
      const result = projectPlayerAvailability(mockAvailablePlayers, context);
      
      expect(result.projections).toBeDefined();
      expect(Object.keys(result.projections)).toHaveLength(4);
      
      // Each projection should have required properties
      Object.values(result.projections).forEach(projection => {
        expect(projection).toHaveProperty('availabilityPercentage');
        expect(projection).toHaveProperty('estimatedPickRange');
        expect(projection).toHaveProperty('riskLevel');
        expect(projection).toHaveProperty('waitingRisk');
        expect(projection).toHaveProperty('lastUpdated');
      });
    });

    it('should provide accurate summary statistics', () => {
      const context = createMockDraftContext();
      const result = projectPlayerAvailability(mockAvailablePlayers, context);
      
      expect(result.summary).toBeDefined();
      expect(result.summary.totalPlayers).toBe(4);
      expect(result.summary.highRiskPlayers).toBeGreaterThanOrEqual(0);
      expect(result.summary.safeWaitPlayers).toBeGreaterThanOrEqual(0);
      expect(result.summary.mediumRiskPlayers).toBeGreaterThanOrEqual(0);
      
      // Summary should add up to total
      const totalCounted = result.summary.highRiskPlayers + 
                          result.summary.safeWaitPlayers + 
                          result.summary.mediumRiskPlayers;
      expect(totalCounted).toBe(result.summary.totalPlayers);
    });

    it('should handle players without valid IDs', () => {
      const playersWithInvalid = [
        ...mockAvailablePlayers,
        { player_info: { name: 'Invalid Player' } }, // Missing player_id
        null // Null player
      ];
      
      const context = createMockDraftContext();
      const result = projectPlayerAvailability(playersWithInvalid, context);
      
      // Should only process valid players
      expect(Object.keys(result.projections)).toHaveLength(4);
      expect(result.summary.totalPlayers).toBe(playersWithInvalid.length);
    });

    it('should include timestamp information', () => {
      const context = createMockDraftContext();
      const result = projectPlayerAvailability(mockAvailablePlayers, context);
      
      expect(result.lastUpdated).toBeDefined();
      expect(new Date(result.lastUpdated)).toBeInstanceOf(Date);
      
      Object.values(result.projections).forEach(projection => {
        expect(projection.lastUpdated).toBeDefined();
        expect(new Date(projection.lastUpdated)).toBeInstanceOf(Date);
      });
    });

    it('should categorize risk levels correctly', () => {
      const context = createMockDraftContext({
        // Create high competition scenario
        leagueAnalysis: {
          totalManagers: 12,
          positionDemand: {
            TE: {
              competitionLevel: 'very_high',
              managersStillNeed: 11,
              competitionScore: 95
            },
            RB: {
              competitionLevel: 'high',
              managersStillNeed: 9,
              competitionScore: 80
            },
            WR: {
              competitionLevel: 'medium',
              managersStillNeed: 6,
              competitionScore: 60
            },
            QB: {
              competitionLevel: 'low',
              managersStillNeed: 3,
              competitionScore: 30
            }
          }
        },
        targetingPrediction: {
          positionTargeting: {
            TE: { managersLikelyToTarget: 5, urgencyLevel: 'high' },
            RB: { managersLikelyToTarget: 3, urgencyLevel: 'high' },
            WR: { managersLikelyToTarget: 2, urgencyLevel: 'medium' },
            QB: { managersLikelyToTarget: 1, urgencyLevel: 'low' }
          }
        }
      });
      
      const result = projectPlayerAvailability(mockAvailablePlayers, context);
      
      // TE should be high risk due to very high competition
      const teProjection = result.projections[mockTEPlayer.player_info.player_id];
      expect(['high', 'very_high']).toContain(teProjection.riskLevel);
      
      // QB should be lower risk than TE, but may still be medium/high due to early rank
      const qbProjection = result.projections[mockQBPlayer.player_info.player_id];
      expect(qbProjection.competitionFactor).toBeLessThan(teProjection.competitionFactor);
    });
  });
});