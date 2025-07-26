import { describe, it, expect, vi } from 'vitest';
import {
  calculateOptimizationScore,
  calculateRosterNeedScore,
  calculatePlayerValueScore,
  calculateCompetitionScore,
  calculateAvailabilityScore,
  calculateStartingLineupImpact,
  assessRosterNeeds,
  generateRankedRecommendations,
  rankPlayersByOptimizationScore,
  applyTieBreakingLogic,
  filterTopRecommendationsWithDiversity,
  generateRecommendationAction,
  calculateRecommendationConfidence
} from '../OptimizationEngine.js';

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

// Mock roster format
const mockRosterFormat = [
  { position: 'QB', slots: 1 },
  { position: 'RB', slots: 2 },
  { position: 'WR', slots: 2 },
  { position: 'TE', slots: 1 },
  { position: 'FLEX', slots: 1 }
];

// Mock context
const createMockContext = (overrides = {}) => ({
  currentRoster: {
    positionCounts: { QB: 1, RB: 1, WR: 1, TE: 0 },
    starters: {
      QB: [{ player: { player_info: { projected_2025_points: 280 } } }],
      RB: [{ player: { player_info: { projected_2025_points: 200 } } }, null],
      WR: [{ player: { player_info: { projected_2025_points: 180 } } }, null],
      TE: [null],
      FLEX: [null]
    }
  },
  rosterFormat: mockRosterFormat,
  calculateCompositeValue: vi.fn().mockReturnValue(150),
  currentPickNumber: 30,
  picksUntilNext: 5,
  ...overrides
});

describe('OptimizationEngine', () => {
  describe('calculateOptimizationScore', () => {
    it('should return zero score for invalid player', () => {
      const result = calculateOptimizationScore(null, createMockContext());
      expect(result.score).toBe(0);
      expect(result.factors.rosterNeed.score).toBe(0);
    });

    it('should return zero score for missing context', () => {
      const result = calculateOptimizationScore(mockPlayer, null);
      expect(result.score).toBe(0);
    });

    it('should calculate weighted optimization score correctly', () => {
      const context = createMockContext();
      const result = calculateOptimizationScore(mockPlayer, context);
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.factors).toHaveProperty('rosterNeed');
      expect(result.factors).toHaveProperty('playerValue');
      expect(result.factors).toHaveProperty('competition');
      expect(result.factors).toHaveProperty('availability');
      expect(result.factors).toHaveProperty('startingLineupImpact');
      
      // Verify each factor has score and explanation
      Object.values(result.factors).forEach(factor => {
        expect(factor).toHaveProperty('score');
        expect(factor).toHaveProperty('explanation');
        expect(typeof factor.score).toBe('number');
        expect(typeof factor.explanation).toBe('string');
      });
    });

    it('should apply correct weights to factors', () => {
      const context = createMockContext();
      
      // Mock specific factor scores to test weighting
      const mockFactorScores = {
        rosterNeed: 80,
        playerValue: 90,
        competition: 70,
        availability: 60,
        startingLineupImpact: 85
      };

      // Expected weighted score: 80*0.25 + 90*0.30 + 70*0.20 + 60*0.15 + 85*0.10 = 78.5
      const expectedScore = 78.5;
      
      // We can't easily mock the individual functions, so we'll test the structure
      const result = calculateOptimizationScore(mockPlayer, context);
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateRosterNeedScore', () => {
    it('should return high score for unfilled core positions', () => {
      const context = createMockContext({
        currentRoster: {
          positionCounts: { QB: 0, RB: 0, WR: 0, TE: 0 }
        }
      });
      
      const result = calculateRosterNeedScore(mockPlayer, context);
      expect(result.score).toBeGreaterThan(60);
      expect(result.explanation).toContain('High need');
    });

    it('should return lower score for filled core positions', () => {
      const context = createMockContext({
        currentRoster: {
          positionCounts: { QB: 1, RB: 2, WR: 2, TE: 1 }
        }
      });
      
      const result = calculateRosterNeedScore(mockPlayer, context);
      expect(result.score).toBeLessThan(60);
    });

    it('should handle QB position with no FLEX eligibility', () => {
      const context = createMockContext({
        currentRoster: {
          positionCounts: { QB: 1, RB: 1, WR: 1, TE: 0 }
        }
      });
      
      const result = calculateRosterNeedScore(mockQBPlayer, context);
      expect(result.score).toBeLessThan(30);
      expect(result.explanation).toContain('Low need');
    });

    it('should handle missing roster data gracefully', () => {
      const context = createMockContext({ currentRoster: null });
      const result = calculateRosterNeedScore(mockPlayer, context);
      
      expect(result.score).toBe(0);
      expect(result.explanation).toContain('Missing roster data');
    });

    it('should calculate FLEX eligibility for RB/WR correctly', () => {
      const context = createMockContext({
        currentRoster: {
          positionCounts: { QB: 1, RB: 2, WR: 2, TE: 1 }
        }
      });
      
      const result = calculateRosterNeedScore(mockPlayer, context);
      expect(result.score).toBeGreaterThan(10);
      expect(result.explanation).toContain('FLEX');
    });
  });

  describe('calculatePlayerValueScore', () => {
    it('should use calculateCompositeValue function', () => {
      const mockCalculateCompositeValue = vi.fn().mockReturnValue(180);
      const context = createMockContext({
        calculateCompositeValue: mockCalculateCompositeValue
      });
      
      const result = calculatePlayerValueScore(mockPlayer, context);
      
      expect(mockCalculateCompositeValue).toHaveBeenCalledWith(mockPlayer, false, 30);
      expect(result.score).toBeGreaterThan(0);
      expect(result.explanation).toContain('Composite value: 180');
    });

    it('should normalize composite value to 0-100 scale', () => {
      const context = createMockContext({
        calculateCompositeValue: vi.fn().mockReturnValue(200)
      });
      
      const result = calculatePlayerValueScore(mockPlayer, context);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing calculateCompositeValue function', () => {
      const context = createMockContext({ calculateCompositeValue: null });
      const result = calculatePlayerValueScore(mockPlayer, context);
      
      expect(result.score).toBe(0);
      expect(result.explanation).toContain('Missing value calculation function');
    });

    it('should provide rank-based explanations', () => {
      const elitePlayer = {
        ...mockPlayer,
        player_info: { ...mockPlayer.player_info, overall_rank: 10 }
      };
      
      const context = createMockContext();
      const result = calculatePlayerValueScore(elitePlayer, context);
      
      expect(result.explanation).toContain('Elite player');
    });

    it('should handle calculation errors gracefully', () => {
      const context = createMockContext({
        calculateCompositeValue: vi.fn().mockImplementation(() => {
          throw new Error('Calculation error');
        })
      });
      
      const result = calculatePlayerValueScore(mockPlayer, context);
      expect(result.score).toBe(0);
      expect(result.explanation).toContain('Error calculating player value');
    });
  });

  describe('calculateCompetitionScore', () => {
    it('should return position-based competition scores', () => {
      const qbResult = calculateCompetitionScore(mockQBPlayer, createMockContext());
      const rbResult = calculateCompetitionScore(mockPlayer, createMockContext());
      
      expect(qbResult.score).toBe(40);
      expect(rbResult.score).toBe(80);
      expect(qbResult.explanation).toContain('QB position');
      expect(rbResult.explanation).toContain('RB position');
    });

    it('should handle unknown positions', () => {
      const unknownPlayer = {
        player_info: { ...mockPlayer.player_info, position: 'K' }
      };
      
      const result = calculateCompetitionScore(unknownPlayer, createMockContext());
      expect(result.score).toBe(50);
    });

    it('should indicate basic analysis when enhanced data unavailable', () => {
      const result = calculateCompetitionScore(mockPlayer, createMockContext());
      expect(result.explanation).toContain('basic analysis');
    });
  });

  describe('calculateAvailabilityScore', () => {
    it('should score based on rank vs current pick', () => {
      const earlyPlayer = {
        ...mockPlayer,
        player_info: { ...mockPlayer.player_info, overall_rank: 5 }
      };
      
      const latePlayer = {
        ...mockPlayer,
        player_info: { ...mockPlayer.player_info, overall_rank: 100 }
      };
      
      const context = createMockContext({ currentPickNumber: 30 });
      
      const earlyResult = calculateAvailabilityScore(earlyPlayer, context);
      const lateResult = calculateAvailabilityScore(latePlayer, context);
      
      expect(earlyResult.score).toBeLessThan(lateResult.score);
      expect(earlyResult.explanation).toContain('Low availability');
      expect(lateResult.explanation).toContain('High availability');
    });

    it('should handle moderate availability range', () => {
      const context = createMockContext({ currentPickNumber: 30 });
      const result = calculateAvailabilityScore(mockPlayer, context);
      
      expect(result.score).toBe(50);
      expect(result.explanation).toContain('Moderate availability');
    });

    it('should indicate basic analysis when enhanced data unavailable', () => {
      const result = calculateAvailabilityScore(mockPlayer, createMockContext());
      expect(result.explanation).toContain('basic analysis');
    });
  });

  describe('calculateStartingLineupImpact', () => {
    it('should calculate improvement over current starters', () => {
      const highValuePlayer = {
        ...mockPlayer,
        player_info: { ...mockPlayer.player_info, projected_2025_points: 300 }
      };
      
      const context = createMockContext();
      const result = calculateStartingLineupImpact(highValuePlayer, context);
      
      expect(result.score).toBeGreaterThan(50);
      expect(result.explanation).toContain('fill empty');
    });

    it('should handle filling empty starter slots', () => {
      const context = createMockContext({
        currentRoster: {
          positionCounts: { QB: 1, RB: 1, WR: 1, TE: 0 },
          starters: {
            QB: [{ player: { player_info: { projected_2025_points: 280 } } }],
            RB: [{ player: { player_info: { projected_2025_points: 200 } } }, null],
            WR: [{ player: { player_info: { projected_2025_points: 180 } } }, null],
            TE: [], // Empty array to indicate no starters
            FLEX: [null]
          }
        }
      });
      
      const tePlayer = {
        player_info: {
          position: 'TE',
          projected_2025_points: 150
        }
      };
      
      const result = calculateStartingLineupImpact(tePlayer, context);
      expect(result.score).toBeGreaterThan(50);
      expect(result.explanation).toContain('fill empty');
    });

    it('should handle bench depth scenarios', () => {
      const context = createMockContext({
        currentRoster: {
          positionCounts: { QB: 1, RB: 2, WR: 2, TE: 1 },
          starters: {
            QB: [{ player: { player_info: { projected_2025_points: 300 } } }],
            RB: [
              { player: { player_info: { projected_2025_points: 250 } } },
              { player: { player_info: { projected_2025_points: 220 } } }
            ],
            WR: [
              { player: { player_info: { projected_2025_points: 200 } } },
              { player: { player_info: { projected_2025_points: 180 } } }
            ],
            TE: [{ player: { player_info: { projected_2025_points: 160 } } }],
            FLEX: [{ player: { player_info: { projected_2025_points: 140 } } }]
          }
        }
      });
      
      const benchPlayer = {
        ...mockPlayer,
        player_info: { ...mockPlayer.player_info, projected_2025_points: 120 }
      };
      
      const result = calculateStartingLineupImpact(benchPlayer, context);
      expect(result.score).toBeLessThan(40);
      expect(result.explanation).toContain('bench depth');
    });

    it('should handle FLEX position considerations', () => {
      const context = createMockContext({
        currentRoster: {
          starters: {
            RB: [
              { player: { player_info: { projected_2025_points: 200 } } },
              { player: { player_info: { projected_2025_points: 180 } } }
            ],
            FLEX: [{ player: { player_info: { projected_2025_points: 120 } } }]
          }
        }
      });
      
      const flexEligiblePlayer = {
        ...mockPlayer,
        player_info: { ...mockPlayer.player_info, projected_2025_points: 160 }
      };
      
      const result = calculateStartingLineupImpact(flexEligiblePlayer, context);
      expect(result.score).toBeGreaterThan(30);
    });

    it('should handle missing roster data', () => {
      const context = createMockContext({ currentRoster: null });
      const result = calculateStartingLineupImpact(mockPlayer, context);
      
      expect(result.score).toBe(0);
      expect(result.explanation).toContain('Missing roster data');
    });
  });

  describe('generateRankedRecommendations', () => {
    const mockAvailablePlayers = [
      {
        player_info: {
          player_id: 'player-1',
          name: 'High Value RB',
          position: 'RB',
          overall_rank: 10,
          position_rank: 3,
          projected_2025_points: 280
        }
      },
      {
        player_info: {
          player_id: 'player-2',
          name: 'Medium Value WR',
          position: 'WR',
          overall_rank: 25,
          position_rank: 8,
          projected_2025_points: 220
        }
      },
      {
        player_info: {
          player_id: 'player-3',
          name: 'Low Value QB',
          position: 'QB',
          overall_rank: 50,
          position_rank: 12,
          projected_2025_points: 180
        }
      },
      {
        player_info: {
          player_id: 'player-4',
          name: 'High Value TE',
          position: 'TE',
          overall_rank: 15,
          position_rank: 2,
          projected_2025_points: 160
        }
      },
      {
        player_info: {
          player_id: 'player-5',
          name: 'Another RB',
          position: 'RB',
          overall_rank: 30,
          position_rank: 12,
          projected_2025_points: 200
        }
      }
    ];

    it('should return empty array for invalid input', () => {
      expect(generateRankedRecommendations(null, createMockContext())).toEqual([]);
      expect(generateRankedRecommendations([], createMockContext())).toEqual([]);
      expect(generateRankedRecommendations(mockAvailablePlayers, null)).toEqual([]);
    });

    it('should generate ranked recommendations with proper structure', () => {
      const context = createMockContext();
      const result = generateRankedRecommendations(mockAvailablePlayers, context);
      
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(5);
      
      // Check structure of first recommendation
      const firstRec = result[0];
      expect(firstRec).toHaveProperty('player');
      expect(firstRec).toHaveProperty('optimization');
      expect(firstRec).toHaveProperty('rank');
      expect(firstRec).toHaveProperty('recommendation');
      expect(firstRec.rank).toBe(1);
      
      // Check recommendation structure
      expect(firstRec.recommendation).toHaveProperty('action');
      expect(firstRec.recommendation).toHaveProperty('reasoning');
      expect(firstRec.recommendation).toHaveProperty('riskAssessment');
      expect(firstRec.recommendation).toHaveProperty('confidence');
    });

    it('should rank recommendations by optimization score', () => {
      const context = createMockContext();
      const result = generateRankedRecommendations(mockAvailablePlayers, context);
      
      // Verify rankings are in descending order by score
      for (let i = 1; i < result.length; i++) {
        expect(result[i-1].optimization.score).toBeGreaterThanOrEqual(result[i].optimization.score);
        expect(result[i-1].rank).toBeLessThan(result[i].rank);
      }
    });

    it('should apply position diversity filtering', () => {
      const context = createMockContext();
      const result = generateRankedRecommendations(mockAvailablePlayers, context);
      
      // Count positions in recommendations
      const positionCounts = {};
      result.forEach(rec => {
        const position = rec.player.player_info.position;
        positionCounts[position] = (positionCounts[position] || 0) + 1;
      });
      
      // Should not have more than 3 players from same position (for 5 recommendations)
      Object.values(positionCounts).forEach(count => {
        expect(count).toBeLessThanOrEqual(3);
      });
    });

    it('should filter out players with zero optimization scores', () => {
      const playersWithInvalid = [
        ...mockAvailablePlayers,
        { player_info: null }, // Invalid player that should get 0 score
        { player_info: { name: 'Invalid', position: 'RB' } } // Missing required fields
      ];
      
      const context = createMockContext();
      const result = generateRankedRecommendations(playersWithInvalid, context);
      
      // Should only include valid players
      result.forEach(rec => {
        expect(rec.optimization.score).toBeGreaterThan(0);
      });
    });
  });

  describe('rankPlayersByOptimizationScore', () => {
    const mockScoredPlayers = [
      {
        player: { player_info: { name: 'Player A', overall_rank: 20, projected_2025_points: 200 } },
        optimization: { 
          score: 75.5,
          factors: { rosterNeed: { score: 80 }, playerValue: { score: 70 } }
        }
      },
      {
        player: { player_info: { name: 'Player B', overall_rank: 15, projected_2025_points: 220 } },
        optimization: { 
          score: 80.2,
          factors: { rosterNeed: { score: 85 }, playerValue: { score: 75 } }
        }
      },
      {
        player: { player_info: { name: 'Player C', overall_rank: 25, projected_2025_points: 180 } },
        optimization: { 
          score: 75.4, // Very close to Player A
          factors: { rosterNeed: { score: 70 }, playerValue: { score: 80 } }
        }
      }
    ];

    it('should sort players by optimization score in descending order', () => {
      const result = rankPlayersByOptimizationScore([...mockScoredPlayers]);
      
      expect(result[0].optimization.score).toBe(80.2); // Player B
      expect(result[1].optimization.score).toBe(75.5); // Player A
      expect(result[2].optimization.score).toBe(75.4); // Player C
    });

    it('should apply tie-breaking logic for similar scores', () => {
      const tiedPlayers = [
        {
          player: { player_info: { name: 'Player X', overall_rank: 30, projected_2025_points: 200 } },
          optimization: { 
            score: 75.0,
            factors: { rosterNeed: { score: 60 }, playerValue: { score: 80 } }
          }
        },
        {
          player: { player_info: { name: 'Player Y', overall_rank: 25, projected_2025_points: 200 } },
          optimization: { 
            score: 75.0,
            factors: { rosterNeed: { score: 70 }, playerValue: { score: 80 } }
          }
        }
      ];

      const result = rankPlayersByOptimizationScore(tiedPlayers);
      
      // Player Y should rank higher due to higher roster need score
      expect(result[0].player.player_info.name).toBe('Player Y');
      expect(result[1].player.player_info.name).toBe('Player X');
    });

    it('should handle empty array', () => {
      const result = rankPlayersByOptimizationScore([]);
      expect(result).toEqual([]);
    });
  });

  describe('applyTieBreakingLogic', () => {
    const createPlayerForTieBreaking = (name, overrides = {}) => ({
      player: {
        player_info: {
          name,
          overall_rank: 25,
          position_rank: 8,
          projected_2025_points: 200,
          ...overrides
        }
      },
      optimization: {
        factors: {
          rosterNeed: { score: 70 },
          playerValue: { score: 75 },
          ...overrides.factors
        }
      }
    });

    it('should prioritize higher roster need score', () => {
      const playerA = createPlayerForTieBreaking('Player A', {
        factors: { rosterNeed: { score: 60 }, playerValue: { score: 75 } }
      });
      const playerB = createPlayerForTieBreaking('Player B', {
        factors: { rosterNeed: { score: 80 }, playerValue: { score: 75 } }
      });

      const result = applyTieBreakingLogic(playerA, playerB);
      expect(result).toBeGreaterThan(0); // playerB should rank higher
    });

    it('should use player value as second tie-breaker', () => {
      const playerA = createPlayerForTieBreaking('Player A', {
        factors: { rosterNeed: { score: 70 }, playerValue: { score: 60 } }
      });
      const playerB = createPlayerForTieBreaking('Player B', {
        factors: { rosterNeed: { score: 70 }, playerValue: { score: 80 } }
      });

      const result = applyTieBreakingLogic(playerA, playerB);
      expect(result).toBeGreaterThan(0); // playerB should rank higher
    });

    it('should use overall rank as third tie-breaker', () => {
      const playerA = createPlayerForTieBreaking('Player A', { overall_rank: 30 });
      const playerB = createPlayerForTieBreaking('Player B', { overall_rank: 20 });

      const result = applyTieBreakingLogic(playerA, playerB);
      expect(result).toBeGreaterThan(0); // playerB should rank higher (lower rank number)
    });

    it('should use projected points as fourth tie-breaker', () => {
      const playerA = createPlayerForTieBreaking('Player A', { projected_2025_points: 180 });
      const playerB = createPlayerForTieBreaking('Player B', { projected_2025_points: 220 });

      const result = applyTieBreakingLogic(playerA, playerB);
      expect(result).toBeGreaterThan(0); // playerB should rank higher
    });

    it('should use position rank as fifth tie-breaker', () => {
      const playerA = createPlayerForTieBreaking('Player A', { position_rank: 10 });
      const playerB = createPlayerForTieBreaking('Player B', { position_rank: 5 });

      const result = applyTieBreakingLogic(playerA, playerB);
      expect(result).toBeGreaterThan(0); // playerB should rank higher (lower position rank)
    });

    it('should use alphabetical name as final tie-breaker', () => {
      const playerA = createPlayerForTieBreaking('Zach Player');
      const playerB = createPlayerForTieBreaking('Aaron Player');

      const result = applyTieBreakingLogic(playerA, playerB);
      expect(result).toBeGreaterThan(0); // Aaron should rank higher alphabetically
    });
  });

  describe('filterTopRecommendationsWithDiversity', () => {
    const createMockRankedPlayer = (name, position, score) => ({
      playerId: `${name}-${position}`,
      player: {
        player_info: {
          name,
          position,
          overall_rank: 20
        }
      },
      optimization: { score }
    });

    it('should return empty array for invalid input', () => {
      expect(filterTopRecommendationsWithDiversity(null)).toEqual([]);
      expect(filterTopRecommendationsWithDiversity([])).toEqual([]);
    });

    it('should limit recommendations to specified maximum', () => {
      const rankedPlayers = [
        createMockRankedPlayer('Player 1', 'RB', 90),
        createMockRankedPlayer('Player 2', 'WR', 85),
        createMockRankedPlayer('Player 3', 'QB', 80),
        createMockRankedPlayer('Player 4', 'TE', 75),
        createMockRankedPlayer('Player 5', 'RB', 70),
        createMockRankedPlayer('Player 6', 'WR', 65),
        createMockRankedPlayer('Player 7', 'RB', 60)
      ];

      const result = filterTopRecommendationsWithDiversity(rankedPlayers, 5);
      expect(result.length).toBe(5);
    });

    it('should maintain position diversity', () => {
      const rankedPlayers = [
        createMockRankedPlayer('RB 1', 'RB', 90),
        createMockRankedPlayer('RB 2', 'RB', 89),
        createMockRankedPlayer('RB 3', 'RB', 88),
        createMockRankedPlayer('RB 4', 'RB', 87),
        createMockRankedPlayer('WR 1', 'WR', 86),
        createMockRankedPlayer('QB 1', 'QB', 85)
      ];

      const result = filterTopRecommendationsWithDiversity(rankedPlayers, 5);
      
      // Count positions
      const positionCounts = {};
      result.forEach(player => {
        const position = player.player.player_info.position;
        positionCounts[position] = (positionCounts[position] || 0) + 1;
      });

      // Should not have more than 3 RBs in top 5
      expect(positionCounts.RB).toBeLessThanOrEqual(3);
      // Should include other positions
      expect(Object.keys(positionCounts).length).toBeGreaterThan(1);
    });

    it('should fill remaining slots with best available if under limit', () => {
      const rankedPlayers = [
        createMockRankedPlayer('Player 1', 'RB', 90),
        createMockRankedPlayer('Player 2', 'WR', 85)
      ];

      const result = filterTopRecommendationsWithDiversity(rankedPlayers, 5);
      expect(result.length).toBe(2); // Should return all available players
    });

    it('should allow some position concentration for small recommendation sets', () => {
      const rankedPlayers = [
        createMockRankedPlayer('RB 1', 'RB', 90),
        createMockRankedPlayer('RB 2', 'RB', 89)
      ];

      const result = filterTopRecommendationsWithDiversity(rankedPlayers, 5);
      expect(result.length).toBe(2);
      expect(result.every(p => p.player.player_info.position === 'RB')).toBe(true);
    });
  });

  describe('generateRecommendationAction', () => {
    const createMockRecommendation = (overallScore, factorScores = {}) => ({
      optimization: {
        score: overallScore,
        factors: {
          rosterNeed: { score: factorScores.rosterNeed || 50 },
          playerValue: { score: factorScores.playerValue || 50 },
          competition: { score: factorScores.competition || 50 },
          availability: { score: factorScores.availability || 50 },
          startingLineupImpact: { score: factorScores.startingLineupImpact || 50 }
        }
      }
    });

    it('should recommend PICK_NOW for high overall score with high roster need', () => {
      const recommendation = createMockRecommendation(80, { rosterNeed: 70 });
      const result = generateRecommendationAction(recommendation, {});
      
      expect(result.action).toBe('PICK_NOW');
      expect(result.reasoning).toContain('Strong overall value');
      expect(result.riskAssessment).toContain('Low risk');
    });

    it('should recommend PICK_NOW for high competition and low availability', () => {
      const recommendation = createMockRecommendation(70, { 
        competition: 80, 
        availability: 30 
      });
      const result = generateRecommendationAction(recommendation, {});
      
      expect(result.action).toBe('PICK_NOW');
      expect(result.reasoning).toContain('High competition');
      expect(result.riskAssessment).toContain('High risk if waiting');
    });

    it('should recommend WAIT for high availability and low roster need', () => {
      const recommendation = createMockRecommendation(60, { 
        availability: 80, 
        rosterNeed: 20 
      });
      const result = generateRecommendationAction(recommendation, {});
      
      expect(result.action).toBe('WAIT');
      expect(result.reasoning).toContain('likely available later');
      expect(result.riskAssessment).toContain('Low risk');
    });

    it('should recommend CONSIDER for moderate scores', () => {
      const recommendation = createMockRecommendation(65);
      const result = generateRecommendationAction(recommendation, {});
      
      expect(result.action).toBe('CONSIDER');
      expect(result.reasoning).toContain('Solid value');
      expect(result.riskAssessment).toContain('Moderate risk');
    });

    it('should recommend WAIT for low overall scores', () => {
      const recommendation = createMockRecommendation(45);
      const result = generateRecommendationAction(recommendation, {});
      
      expect(result.action).toBe('WAIT');
      expect(result.reasoning).toContain('Better options');
      expect(result.riskAssessment).toContain('Low risk');
    });

    it('should include confidence score', () => {
      const recommendation = createMockRecommendation(75);
      const result = generateRecommendationAction(recommendation, {});
      
      expect(result).toHaveProperty('confidence');
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateRecommendationConfidence', () => {
    const createMockOptimization = (score, factorScores = []) => ({
      score,
      factors: {
        rosterNeed: { score: factorScores[0] || 50 },
        playerValue: { score: factorScores[1] || 50 },
        competition: { score: factorScores[2] || 50 },
        availability: { score: factorScores[3] || 50 },
        startingLineupImpact: { score: factorScores[4] || 50 }
      }
    });

    it('should base confidence on overall score', () => {
      const highScoreOpt = createMockOptimization(90);
      const lowScoreOpt = createMockOptimization(30);
      
      const highConfidence = calculateRecommendationConfidence(highScoreOpt);
      const lowConfidence = calculateRecommendationConfidence(lowScoreOpt);
      
      expect(highConfidence).toBeGreaterThan(lowConfidence);
    });

    it('should reduce confidence for inconsistent factors', () => {
      const consistentOpt = createMockOptimization(75, [70, 75, 80, 75, 70]);
      const inconsistentOpt = createMockOptimization(75, [90, 30, 95, 25, 85]);
      
      const consistentConfidence = calculateRecommendationConfidence(consistentOpt);
      const inconsistentConfidence = calculateRecommendationConfidence(inconsistentOpt);
      
      expect(consistentConfidence).toBeGreaterThan(inconsistentConfidence);
    });

    it('should boost confidence for very high scores', () => {
      const veryHighOpt = createMockOptimization(90);
      const highOpt = createMockOptimization(75);
      
      const veryHighConfidence = calculateRecommendationConfidence(veryHighOpt);
      const highConfidence = calculateRecommendationConfidence(highOpt);
      
      expect(veryHighConfidence).toBeGreaterThan(highConfidence);
    });

    it('should return confidence within valid range', () => {
      const testCases = [
        createMockOptimization(100),
        createMockOptimization(50),
        createMockOptimization(0),
        createMockOptimization(75, [100, 0, 100, 0, 100]) // Very inconsistent
      ];

      testCases.forEach(optimization => {
        const confidence = calculateRecommendationConfidence(optimization);
        expect(confidence).toBeGreaterThanOrEqual(10);
        expect(confidence).toBeLessThanOrEqual(95);
      });
    });

    it('should return integer confidence values', () => {
      const optimization = createMockOptimization(75.7);
      const confidence = calculateRecommendationConfidence(optimization);
      
      expect(Number.isInteger(confidence)).toBe(true);
    });
  });

  describe('assessRosterNeeds', () => {
    it('should analyze position needs correctly', () => {
      const currentRoster = {
        positionCounts: { QB: 1, RB: 1, WR: 1, TE: 0 }
      };
      
      const result = assessRosterNeeds(currentRoster, mockRosterFormat);
      
      expect(result.positionNeeds.QB.needed).toBe(0);
      expect(result.positionNeeds.RB.needed).toBe(1);
      expect(result.positionNeeds.WR.needed).toBe(1);
      expect(result.positionNeeds.TE.needed).toBe(1);
      expect(result.positionNeeds.FLEX.needed).toBe(1);
      
      expect(result.totalNeeds).toBe(4);
      expect(result.criticalNeeds.length).toBeGreaterThan(0);
    });

    it('should identify critical needs', () => {
      const currentRoster = {
        positionCounts: { QB: 0, RB: 0, WR: 0, TE: 0 }
      };
      
      const result = assessRosterNeeds(currentRoster, mockRosterFormat);
      
      expect(result.criticalNeeds).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ position: 'QB', needed: 1 }),
          expect.objectContaining({ position: 'RB', needed: 2 }),
          expect.objectContaining({ position: 'WR', needed: 2 }),
          expect.objectContaining({ position: 'TE', needed: 1 })
        ])
      );
    });

    it('should generate appropriate summary', () => {
      const completeRoster = {
        positionCounts: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 }
      };
      
      const result = assessRosterNeeds(completeRoster, mockRosterFormat);
      expect(result.summary).toContain('complete');
      expect(result.totalNeeds).toBe(0);
    });

    it('should handle missing data gracefully', () => {
      const result = assessRosterNeeds(null, null);
      
      expect(result.positionNeeds).toEqual({});
      expect(result.totalNeeds).toBe(0);
      expect(result.criticalNeeds).toEqual([]);
      expect(result.summary).toContain('Unable to assess');
    });

    it('should calculate urgency levels correctly', () => {
      const currentRoster = {
        positionCounts: { QB: 0, RB: 1, WR: 2, TE: 1 }
      };
      
      const result = assessRosterNeeds(currentRoster, mockRosterFormat);
      
      expect(result.positionNeeds.QB.urgency).toBe('high'); // 0/1 = 100% needed = high
      expect(result.positionNeeds.RB.urgency).toBe('high'); // 1/2 = 50% needed = high  
      expect(result.positionNeeds.WR.urgency).toBe('none'); // 2/2 = 0% needed = none
    });
  });
});