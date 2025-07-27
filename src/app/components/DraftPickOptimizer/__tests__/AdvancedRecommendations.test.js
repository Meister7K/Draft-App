/**
 * Tests for Advanced Recommendation Features
 * Tests alternative player suggestions, wait vs pick now advisory, position scarcity warnings,
 * and draft strategy insights
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateAlternativePlayerSuggestions,
  createWaitVsPickNowAdvisory,
  generatePositionScarcityWarnings,
  generateDraftStrategyInsights
} from '../AdvancedRecommendations';

// Mock data for testing
const mockPlayer1 = {
  player_info: {
    player_id: 'player1',
    name: 'Test Player 1',
    position: 'RB',
    team: 'TEST',
    overall_rank: 25,
    position_rank: 8,
    projected_2025_points: 180
  }
};

const mockPlayer2 = {
  player_info: {
    player_id: 'player2',
    name: 'Test Player 2',
    position: 'RB',
    team: 'TEST2',
    overall_rank: 35,
    position_rank: 12,
    projected_2025_points: 165
  }
};

const mockPlayer3 = {
  player_info: {
    player_id: 'player3',
    name: 'Test Player 3',
    position: 'WR',
    team: 'TEST3',
    overall_rank: 40,
    position_rank: 15,
    projected_2025_points: 155
  }
};

const mockPlayer4 = {
  player_info: {
    player_id: 'player4',
    name: 'Test Player 4',
    position: 'TE',
    team: 'TEST4',
    overall_rank: 50,
    position_rank: 3,
    projected_2025_points: 140
  }
};

const mockRecommendation = {
  player: mockPlayer1,
  optimization: {
    score: 85.5,
    factors: {
      rosterNeed: { score: 80, explanation: 'High need for RB' },
      playerValue: { score: 90, explanation: 'High-value player' },
      competition: { score: 75, explanation: 'High competition' },
      availability: { score: 60, explanation: 'Moderate availability' },
      startingLineupImpact: { score: 85, explanation: 'High impact' }
    }
  },
  playerId: 'player1'
};

const mockAvailablePlayers = [mockPlayer1, mockPlayer2, mockPlayer3, mockPlayer4];

const mockContext = {
  currentRoster: {
    positionCounts: { QB: 1, RB: 1, WR: 2, TE: 0 }
  },
  rosterFormat: [
    { position: 'QB', slots: 1 },
    { position: 'RB', slots: 2 },
    { position: 'WR', slots: 2 },
    { position: 'TE', slots: 1 },
    { position: 'FLEX', slots: 1 }
  ],
  leagueAnalysis: {
    positionDemand: {
      RB: {
        competitionLevel: 'high',
        competitionScore: 75,
        managersStillNeed: 8,
        slotsRemaining: 12
      },
      WR: {
        competitionLevel: 'medium',
        competitionScore: 55,
        managersStillNeed: 6,
        slotsRemaining: 15
      },
      TE: {
        competitionLevel: 'very_high',
        competitionScore: 90,
        managersStillNeed: 10,
        slotsRemaining: 8
      }
    },
    totalManagers: 12
  },
  currentPickNumber: 36,
  picksUntilNext: 4,
  calculateCompositeValue: (player) => player.player_info.projected_2025_points / 2
};

describe('generateAlternativePlayerSuggestions', () => {
  it('should generate alternative suggestions for same position', () => {
    const alternatives = generateAlternativePlayerSuggestions(
      mockRecommendation,
      mockAvailablePlayers,
      mockContext
    );

    expect(alternatives).toBeDefined();
    expect(Array.isArray(alternatives)).toBe(true);
    expect(alternatives.length).toBeGreaterThan(0);
    
    // Should include other RB players
    const rbAlternatives = alternatives.filter(alt => 
      alt.player.player_info.position === 'RB'
    );
    expect(rbAlternatives.length).toBeGreaterThan(0);
  });

  it('should include FLEX-eligible alternatives', () => {
    const alternatives = generateAlternativePlayerSuggestions(
      mockRecommendation,
      mockAvailablePlayers,
      mockContext
    );

    // Should include WR players as FLEX alternatives
    const flexAlternatives = alternatives.filter(alt => 
      ['WR', 'TE'].includes(alt.player.player_info.position)
    );
    expect(flexAlternatives.length).toBeGreaterThan(0);
  });

  it('should provide comparison data for alternatives', () => {
    const alternatives = generateAlternativePlayerSuggestions(
      mockRecommendation,
      mockAvailablePlayers,
      mockContext
    );

    alternatives.forEach(alternative => {
      expect(alternative).toHaveProperty('player');
      expect(alternative).toHaveProperty('optimization');
      expect(alternative).toHaveProperty('similarityScore');
      expect(alternative).toHaveProperty('comparison');
      expect(alternative).toHaveProperty('recommendation');
      
      expect(alternative.comparison).toHaveProperty('projectedPoints');
      expect(alternative.comparison).toHaveProperty('overallRank');
      expect(alternative.comparison).toHaveProperty('summary');
    });
  });

  it('should limit alternatives to top 3', () => {
    const alternatives = generateAlternativePlayerSuggestions(
      mockRecommendation,
      mockAvailablePlayers,
      mockContext
    );

    expect(alternatives.length).toBeLessThanOrEqual(3);
  });

  it('should handle empty or invalid input gracefully', () => {
    const alternatives = generateAlternativePlayerSuggestions(
      null,
      mockAvailablePlayers,
      mockContext
    );

    expect(alternatives).toEqual([]);
  });
});

describe('createWaitVsPickNowAdvisory', () => {
  it('should recommend PICK_NOW for high need + low availability', () => {
    const highNeedLowAvailability = {
      ...mockRecommendation,
      optimization: {
        ...mockRecommendation.optimization,
        factors: {
          ...mockRecommendation.optimization.factors,
          rosterNeed: { score: 85, explanation: 'Critical need' },
          availability: { score: 30, explanation: 'Low availability' }
        }
      }
    };

    const advisory = createWaitVsPickNowAdvisory(highNeedLowAvailability, mockContext);

    expect(advisory.action).toBe('PICK_NOW');
    expect(advisory.confidence).toBeGreaterThan(70);
    expect(advisory.urgencyLevel).toBe('high');
  });

  it('should recommend WAIT for high availability + low need', () => {
    const highAvailabilityLowNeed = {
      ...mockRecommendation,
      optimization: {
        ...mockRecommendation.optimization,
        factors: {
          ...mockRecommendation.optimization.factors,
          rosterNeed: { score: 30, explanation: 'Low need' },
          availability: { score: 80, explanation: 'High availability' },
          competition: { score: 50, explanation: 'Moderate competition' },
          playerValue: { score: 60, explanation: 'Moderate value' }
        }
      }
    };

    const advisory = createWaitVsPickNowAdvisory(highAvailabilityLowNeed, mockContext);

    expect(advisory.action).toBe('WAIT');
    expect(advisory.confidence).toBeGreaterThan(60);
    expect(advisory.urgencyLevel).toBe('low');
  });

  it('should recommend CONSIDER for balanced factors', () => {
    const balancedFactors = {
      ...mockRecommendation,
      optimization: {
        score: 65,
        factors: {
          rosterNeed: { score: 60, explanation: 'Moderate need' },
          availability: { score: 55, explanation: 'Moderate availability' },
          competition: { score: 65, explanation: 'Moderate competition' },
          playerValue: { score: 70, explanation: 'Good value' }
        }
      }
    };

    const advisory = createWaitVsPickNowAdvisory(balancedFactors, mockContext);

    expect(advisory.action).toBe('CONSIDER');
    expect(advisory.urgencyLevel).toBe('medium');
  });

  it('should include waiting risk assessment', () => {
    const advisory = createWaitVsPickNowAdvisory(mockRecommendation, mockContext);

    expect(advisory).toHaveProperty('waitingRisk');
    expect(advisory.waitingRisk).toHaveProperty('shouldWait');
    expect(advisory.waitingRisk).toHaveProperty('confidence');
    expect(advisory.waitingRisk).toHaveProperty('reasoning');
  });

  it('should provide next best action', () => {
    const advisory = createWaitVsPickNowAdvisory(mockRecommendation, mockContext);

    expect(advisory).toHaveProperty('nextBestAction');
    expect(advisory.nextBestAction).toHaveProperty('action');
    expect(advisory.nextBestAction).toHaveProperty('reasoning');
  });

  it('should handle invalid input gracefully', () => {
    const advisory = createWaitVsPickNowAdvisory(null, mockContext);

    expect(advisory.action).toBe('UNKNOWN');
    expect(advisory.confidence).toBe(0);
  });
});

describe('generatePositionScarcityWarnings', () => {
  const mockRecommendations = [
    {
      player: mockPlayer4, // TE with high scarcity
      optimization: { score: 80 },
      rank: 1
    },
    {
      player: mockPlayer1, // RB with moderate scarcity
      optimization: { score: 75 },
      rank: 2
    }
  ];

  it('should generate warnings for scarce positions', () => {
    const warnings = generatePositionScarcityWarnings(mockRecommendations, mockContext);

    expect(warnings).toBeDefined();
    expect(Array.isArray(warnings)).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('should prioritize TE scarcity warnings', () => {
    const warnings = generatePositionScarcityWarnings(mockRecommendations, mockContext);

    const teWarnings = warnings.filter(w => w.position === 'TE');
    expect(teWarnings.length).toBeGreaterThan(0);
    
    if (teWarnings.length > 0) {
      expect(['critical', 'high']).toContain(teWarnings[0].severity);
    }
  });

  it('should include warning details', () => {
    const warnings = generatePositionScarcityWarnings(mockRecommendations, mockContext);

    warnings.forEach(warning => {
      expect(warning).toHaveProperty('playerId');
      expect(warning).toHaveProperty('playerName');
      expect(warning).toHaveProperty('position');
      expect(warning).toHaveProperty('severity');
      expect(warning).toHaveProperty('warning');
      expect(warning).toHaveProperty('recommendation');
      expect(warning).toHaveProperty('stats');
    });
  });

  it('should sort warnings by severity', () => {
    const warnings = generatePositionScarcityWarnings(mockRecommendations, mockContext);

    if (warnings.length > 1) {
      const severityOrder = { 'critical': 3, 'high': 2, 'medium': 1, 'low': 0 };
      for (let i = 0; i < warnings.length - 1; i++) {
        expect(severityOrder[warnings[i].severity]).toBeGreaterThanOrEqual(
          severityOrder[warnings[i + 1].severity]
        );
      }
    }
  });

  it('should handle empty recommendations gracefully', () => {
    const warnings = generatePositionScarcityWarnings([], mockContext);
    expect(warnings).toEqual([]);
  });
});

describe('generateDraftStrategyInsights', () => {
  const mockRecommendations = [
    { player: mockPlayer1, optimization: { score: 85 }, rank: 1 },
    { player: mockPlayer2, optimization: { score: 80 }, rank: 2 },
    { player: mockPlayer3, optimization: { score: 75 }, rank: 3 }
  ];

  it('should generate overall strategy', () => {
    const insights = generateDraftStrategyInsights(mockRecommendations, mockContext);

    expect(insights).toHaveProperty('overallStrategy');
    expect(typeof insights.overallStrategy).toBe('string');
    expect(insights.overallStrategy.length).toBeGreaterThan(0);
  });

  it('should provide specific insights', () => {
    const insights = generateDraftStrategyInsights(mockRecommendations, mockContext);

    expect(insights).toHaveProperty('insights');
    expect(Array.isArray(insights.insights)).toBe(true);
    
    insights.insights.forEach(insight => {
      expect(insight).toHaveProperty('type');
      expect(insight).toHaveProperty('priority');
      expect(insight).toHaveProperty('message');
      expect(insight).toHaveProperty('actionable');
    });
  });

  it('should analyze roster balance', () => {
    const insights = generateDraftStrategyInsights(mockRecommendations, mockContext);

    expect(insights).toHaveProperty('rosterBalance');
    expect(insights.rosterBalance).toHaveProperty('completionPercentage');
    expect(insights.rosterBalance).toHaveProperty('criticalNeeds');
    expect(insights.rosterBalance).toHaveProperty('phase');
  });

  it('should provide strategic recommendations', () => {
    const insights = generateDraftStrategyInsights(mockRecommendations, mockContext);

    expect(insights).toHaveProperty('recommendations');
    expect(Array.isArray(insights.recommendations)).toBe(true);
    
    insights.recommendations.forEach(rec => {
      expect(rec).toHaveProperty('type');
      expect(rec).toHaveProperty('priority');
      expect(rec).toHaveProperty('title');
      expect(rec).toHaveProperty('description');
      expect(rec).toHaveProperty('action');
    });
  });

  it('should determine next phase strategy', () => {
    const insights = generateDraftStrategyInsights(mockRecommendations, mockContext);

    expect(insights).toHaveProperty('nextPhaseStrategy');
    expect(insights.nextPhaseStrategy).toHaveProperty('currentPhase');
    expect(insights.nextPhaseStrategy).toHaveProperty('strategy');
    expect(insights.nextPhaseStrategy).toHaveProperty('timeframe');
  });

  it('should adapt strategy based on draft phase', () => {
    // Test early phase
    const earlyContext = {
      ...mockContext,
      currentRoster: { positionCounts: { QB: 0, RB: 0, WR: 0, TE: 0 } }
    };
    
    const earlyInsights = generateDraftStrategyInsights(mockRecommendations, earlyContext);
    expect(earlyInsights.rosterBalance.phase).toBe('early');
    expect(earlyInsights.overallStrategy).toContain('FOUNDATION');

    // Test late phase
    const lateContext = {
      ...mockContext,
      currentRoster: { positionCounts: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 } }
    };
    
    const lateInsights = generateDraftStrategyInsights(mockRecommendations, lateContext);
    expect(lateInsights.rosterBalance.phase).toBe('late');
  });

  it('should handle invalid input gracefully', () => {
    const insights = generateDraftStrategyInsights(null, mockContext);

    expect(insights.overallStrategy).toBe('Unable to determine strategy');
    expect(insights.insights).toEqual([]);
  });
});

describe('Integration Tests', () => {
  it('should work together to provide comprehensive advanced features', () => {
    const recommendations = [
      { player: mockPlayer1, optimization: { score: 85, factors: mockRecommendation.optimization.factors }, rank: 1, playerId: 'player1' },
      { player: mockPlayer4, optimization: { score: 80, factors: mockRecommendation.optimization.factors }, rank: 2, playerId: 'player4' }
    ];

    // Test that all features can be generated together
    const alternatives = generateAlternativePlayerSuggestions(recommendations[0], mockAvailablePlayers, mockContext);
    const advisory = createWaitVsPickNowAdvisory(recommendations[0], mockContext);
    const warnings = generatePositionScarcityWarnings(recommendations, mockContext);
    const insights = generateDraftStrategyInsights(recommendations, mockContext);

    expect(alternatives).toBeDefined();
    expect(advisory).toBeDefined();
    expect(warnings).toBeDefined();
    expect(insights).toBeDefined();

    // Verify they provide complementary information
    expect(alternatives.length).toBeGreaterThanOrEqual(0);
    expect(advisory.action).toMatch(/^(PICK_NOW|WAIT|CONSIDER)$/);
    expect(warnings.length).toBeGreaterThanOrEqual(0);
    expect(insights.overallStrategy).toBeTruthy();
  });

  it('should handle performance with large datasets', () => {
    // Create larger dataset
    const largePlayerSet = Array.from({ length: 100 }, (_, i) => ({
      player_info: {
        player_id: `player${i}`,
        name: `Player ${i}`,
        position: ['QB', 'RB', 'WR', 'TE'][i % 4],
        team: 'TEST',
        overall_rank: i + 1,
        position_rank: Math.floor(i / 4) + 1,
        projected_2025_points: 200 - i
      }
    }));

    const largeRecommendations = largePlayerSet.slice(0, 5).map((player, index) => ({
      player,
      optimization: { score: 90 - index * 5, factors: mockRecommendation.optimization.factors },
      rank: index + 1,
      playerId: player.player_info.player_id
    }));

    const start = performance.now();
    
    const alternatives = generateAlternativePlayerSuggestions(largeRecommendations[0], largePlayerSet, mockContext);
    const advisory = createWaitVsPickNowAdvisory(largeRecommendations[0], mockContext);
    const warnings = generatePositionScarcityWarnings(largeRecommendations, mockContext);
    const insights = generateDraftStrategyInsights(largeRecommendations, mockContext);
    
    const end = performance.now();
    const executionTime = end - start;

    // Should complete within reasonable time (500ms as per requirements)
    expect(executionTime).toBeLessThan(500);
    
    // Should still provide valid results
    expect(alternatives).toBeDefined();
    expect(advisory).toBeDefined();
    expect(warnings).toBeDefined();
    expect(insights).toBeDefined();
  });
});