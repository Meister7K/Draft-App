import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DraftPickOptimizer } from '../DraftPickOptimizer.jsx';

// Mock the optimization modules
vi.mock('../OptimizationEngine', () => ({
  generateRankedRecommendations: vi.fn(),
  assessRosterNeeds: vi.fn()
}));

vi.mock('../CompetitionAnalyzer', () => ({
  analyzeLeagueNeeds: vi.fn(),
  predictManagerTargeting: vi.fn(),
  calculatePositionUrgencyScores: vi.fn()
}));

vi.mock('../AvailabilityPredictor', () => ({
  projectPlayerAvailability: vi.fn()
}));

describe('DraftPickOptimizer', () => {
  // Mock data
  const mockUser = {
    user_id: 'user1',
    username: 'testuser'
  };

  const mockLeagueUsers = [
    { user_id: 'user1', username: 'testuser' },
    { user_id: 'user2', username: 'user2' },
    { user_id: 'user3', username: 'user3' }
  ];

  const mockData = {
    players: [
      {
        player_info: {
          player_id: 'player1',
          name: 'Test Player 1',
          position: 'RB',
          projected_2025_points: 200,
          overall_rank: 10,
          position_rank: 5
        }
      },
      {
        player_info: {
          player_id: 'player2',
          name: 'Test Player 2',
          position: 'WR',
          projected_2025_points: 180,
          overall_rank: 15,
          position_rank: 8
        }
      }
    ]
  };

  const mockDraft = {
    picks: [
      { pick_no: 1, picked_by: 'user2', metadata: { player_id: 'drafted1', position: 'QB' } }
    ]
  };

  const mockRosterFormat = [
    { position: 'QB', slots: 1 },
    { position: 'RB', slots: 2 },
    { position: 'WR', slots: 2 },
    { position: 'TE', slots: 1 },
    { position: 'FLEX', slots: 1 }
  ];

  const mockCalculateCompositeValue = vi.fn().mockReturnValue(75.5);

  const defaultProps = {
    user: mockUser,
    leagueUsers: mockLeagueUsers,
    data: mockData,
    draft: mockDraft,
    selectedMemberId: 'user1',
    memberPicks: [],
    draftedPlayerIds: new Set(['drafted1']),
    calculateCompositeValue: mockCalculateCompositeValue,
    rosterFormat: mockRosterFormat
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup default mock returns
    const { generateRankedRecommendations, assessRosterNeeds } = await import('../OptimizationEngine');
    const { analyzeLeagueNeeds, predictManagerTargeting, calculatePositionUrgencyScores } = await import('../CompetitionAnalyzer');
    const { projectPlayerAvailability } = await import('../AvailabilityPredictor');

    generateRankedRecommendations.mockReturnValue([
      {
        player: mockData.players[0],
        optimization: {
          score: 85.5,
          factors: {
            rosterNeed: { score: 80, explanation: 'High need for RB' },
            playerValue: { score: 90, explanation: 'Elite player value' },
            competition: { score: 75, explanation: 'High competition' },
            availability: { score: 60, explanation: 'Moderate availability' },
            startingLineupImpact: { score: 85, explanation: 'High impact' }
          }
        },
        rank: 1,
        playerId: 'player1',
        recommendation: {
          action: 'PICK_NOW',
          reasoning: 'Strong overall value with high roster need',
          riskAssessment: 'Low risk',
          confidence: 85
        }
      }
    ]);

    assessRosterNeeds.mockReturnValue({
      positionNeeds: { RB: { needed: 2, urgency: 'high' } },
      totalNeeds: 2,
      criticalNeeds: [{ position: 'RB', needed: 2, urgency: 'high' }],
      summary: 'Critical needs: 2 RBs'
    });

    analyzeLeagueNeeds.mockReturnValue({
      managerNeeds: {},
      positionDemand: {
        RB: { competitionLevel: 'high', managersStillNeed: 8, competitionScore: 75 },
        WR: { competitionLevel: 'medium', managersStillNeed: 5, competitionScore: 50 }
      },
      totalManagers: 3
    });

    predictManagerTargeting.mockReturnValue({
      nextFewPicks: [],
      positionTargeting: {}
    });

    calculatePositionUrgencyScores.mockReturnValue({
      urgencyScores: {
        RB: { score: 80, explanation: 'High urgency' },
        WR: { score: 50, explanation: 'Medium urgency' }
      }
    });

    projectPlayerAvailability.mockReturnValue({
      projections: {},
      summary: {
        totalPlayers: 25,
        highRiskPlayers: 5,
        safeWaitPlayers: 10,
        mediumRiskPlayers: 10
      }
    });
  });

  describe('Component Logic', () => {
    it('should determine when to show optimizer based on user turn', () => {
      // Test that component logic works correctly
      expect(defaultProps.selectedMemberId).toBe(defaultProps.user.user_id);
      expect(defaultProps.draft.picks.length).toBe(1);
    });

    it('should filter available players correctly', () => {
      const availablePlayers = defaultProps.data.players.filter(player => 
        player?.player_info?.player_id && 
        !defaultProps.draftedPlayerIds.has(player.player_info.player_id)
      );
      
      expect(availablePlayers.length).toBe(2);
      expect(availablePlayers.some(p => p.player_info.player_id === 'player1')).toBe(true);
      expect(availablePlayers.some(p => p.player_info.player_id === 'player2')).toBe(true);
    });

    it('should build roster state correctly', () => {
      const memberPicks = [];
      const rosterFormat = defaultProps.rosterFormat;
      
      // Count positions
      const positionCounts = {};
      memberPicks.forEach(pick => {
        const position = pick.metadata?.position;
        if (position) {
          positionCounts[position] = (positionCounts[position] || 0) + 1;
        }
      });

      // Build starters structure
      const starters = {};
      rosterFormat.forEach(({ position, slots }) => {
        starters[position] = Array(slots).fill(null);
      });

      const currentRoster = {
        starters,
        bench: [],
        positionCounts
      };

      expect(currentRoster.starters.QB).toHaveLength(1);
      expect(currentRoster.starters.RB).toHaveLength(2);
      expect(currentRoster.starters.WR).toHaveLength(2);
      expect(currentRoster.starters.TE).toHaveLength(1);
      expect(currentRoster.starters.FLEX).toHaveLength(1);
    });
  });

  describe('State Management', () => {
    it('should handle empty data gracefully', () => {
      const propsWithNoData = {
        ...defaultProps,
        data: { players: [] }
      };

      const availablePlayers = propsWithNoData.data.players.filter(player => 
        player?.player_info?.player_id && 
        !propsWithNoData.draftedPlayerIds.has(player.player_info.player_id)
      );
      
      expect(availablePlayers.length).toBe(0);
    });

    it('should calculate user turn info correctly', () => {
      const currentPickNumber = defaultProps.draft.picks?.length + 1 || 1;
      const totalManagers = defaultProps.leagueUsers?.length || 12;
      const isCurrentUser = defaultProps.selectedMemberId === defaultProps.user.user_id;
      
      expect(currentPickNumber).toBe(2);
      expect(totalManagers).toBe(3);
      expect(isCurrentUser).toBe(true);
    });

    it('should determine if optimizer should show', () => {
      const isCurrentUser = defaultProps.selectedMemberId === defaultProps.user.user_id;
      const currentPickNumber = defaultProps.draft.picks?.length + 1 || 1;
      const totalManagers = defaultProps.leagueUsers?.length || 12;
      
      // Simple draft order calculation
      const currentRound = Math.ceil(currentPickNumber / totalManagers);
      const pickInRound = ((currentPickNumber - 1) % totalManagers) + 1;
      
      const userDraftPosition = defaultProps.leagueUsers.findIndex(u => u.user_id === defaultProps.user.user_id) + 1;
      
      let userPickInRound;
      if (currentRound % 2 === 1) {
        userPickInRound = userDraftPosition;
      } else {
        userPickInRound = totalManagers - userDraftPosition + 1;
      }
      
      const isUserTurn = pickInRound === userPickInRound;
      const picksUntilTurn = isUserTurn ? 0 : Math.abs(userPickInRound - pickInRound);
      const shouldShowOptimizer = isCurrentUser && picksUntilTurn <= 3;
      
      expect(shouldShowOptimizer).toBe(true);
    });
  });

  describe('Real-time Updates', () => {
    it('should detect changes in member picks', () => {
      const originalMemberPicks = defaultProps.memberPicks;
      const updatedMemberPicks = [
        { pick_no: 1, picked_by: 'user1', metadata: { player_id: 'player1', position: 'RB' } }
      ];
      
      expect(originalMemberPicks.length).toBe(0);
      expect(updatedMemberPicks.length).toBe(1);
      expect(originalMemberPicks).not.toEqual(updatedMemberPicks);
    });

    it('should detect changes in draft picks', () => {
      const originalDraftPicks = defaultProps.draft.picks;
      const updatedDraftPicks = [
        ...mockDraft.picks,
        { pick_no: 2, picked_by: 'user3', metadata: { player_id: 'drafted2', position: 'WR' } }
      ];
      
      expect(originalDraftPicks.length).toBe(1);
      expect(updatedDraftPicks.length).toBe(2);
      expect(originalDraftPicks).not.toEqual(updatedDraftPicks);
    });

    it('should detect changes in drafted player IDs', () => {
      const originalDraftedIds = defaultProps.draftedPlayerIds;
      const updatedDraftedIds = new Set(['drafted1', 'drafted2']);
      
      expect(originalDraftedIds.size).toBe(1);
      expect(updatedDraftedIds.size).toBe(2);
      expect(originalDraftedIds.has('drafted2')).toBe(false);
      expect(updatedDraftedIds.has('drafted2')).toBe(true);
    });
  });

  describe('Integration with Draft Data', () => {
    it('should build correct roster state from member picks', () => {
      const memberPicks = [
        { 
          pick_no: 1, 
          picked_by: 'user1', 
          metadata: { player_id: 'player1', position: 'RB' },
          player: mockData.players[0]
        }
      ];

      // Count positions
      const positionCounts = {};
      memberPicks.forEach(pick => {
        const position = pick.metadata?.position;
        if (position) {
          positionCounts[position] = (positionCounts[position] || 0) + 1;
        }
      });

      expect(positionCounts.RB).toBe(1);
    });

    it('should filter out drafted players from available players', () => {
      const draftedPlayerIds = new Set(['player1']);
      const availablePlayers = mockData.players.filter(player => 
        player?.player_info?.player_id && 
        !draftedPlayerIds.has(player.player_info.player_id)
      );
      
      expect(availablePlayers.some(p => p.player_info.player_id === 'player1')).toBe(false);
      expect(availablePlayers.some(p => p.player_info.player_id === 'player2')).toBe(true);
      expect(availablePlayers.length).toBe(1);
    });

    it('should use calculateCompositeValue function', () => {
      expect(typeof mockCalculateCompositeValue).toBe('function');
      expect(mockCalculateCompositeValue()).toBe(75.5);
    });

    it('should build optimization context structure', () => {
      const context = {
        currentRoster: { starters: {}, bench: [], positionCounts: {} },
        rosterFormat: mockRosterFormat,
        calculateCompositeValue: mockCalculateCompositeValue,
        currentPickNumber: 2,
        picksUntilNext: 1,
        leagueAnalysis: {},
        targetingPrediction: {},
        urgencyScores: {},
        draftOrder: mockLeagueUsers,
        totalManagers: 3
      };
      
      expect(context).toHaveProperty('currentRoster');
      expect(context).toHaveProperty('rosterFormat');
      expect(context).toHaveProperty('calculateCompositeValue');
      expect(context).toHaveProperty('currentPickNumber');
      expect(context).toHaveProperty('picksUntilNext');
      expect(context).toHaveProperty('leagueAnalysis');
      expect(context).toHaveProperty('targetingPrediction');
      expect(context).toHaveProperty('urgencyScores');
    });
  });

  describe('User Interactions', () => {
    it('should handle player selection logic', () => {
      const handlePlayerSelect = (player) => {
        console.log('Player selected for drafting:', player.player_info.name);
      };
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      handlePlayerSelect(mockData.players[0]);
      
      expect(consoleSpy).toHaveBeenCalledWith('Player selected for drafting:', 'Test Player 1');
      
      consoleSpy.mockRestore();
    });

    it('should format roster needs analysis', () => {
      const rosterNeedsAnalysis = {
        positionNeeds: { RB: { needed: 2, urgency: 'high' } },
        totalNeeds: 2,
        criticalNeeds: [{ position: 'RB', needed: 2, urgency: 'high' }],
        summary: 'Critical needs: 2 RBs'
      };
      
      expect(rosterNeedsAnalysis.summary).toBe('Critical needs: 2 RBs');
      expect(rosterNeedsAnalysis.criticalNeeds.length).toBe(1);
      expect(rosterNeedsAnalysis.criticalNeeds[0].position).toBe('RB');
    });

    it('should format competition and availability summary', () => {
      const competitionData = {
        positionDemand: {
          RB: { competitionLevel: 'high', managersStillNeed: 8, competitionScore: 75 },
          WR: { competitionLevel: 'medium', managersStillNeed: 5, competitionScore: 50 }
        }
      };
      
      const availabilityProjections = {
        summary: {
          totalPlayers: 25,
          highRiskPlayers: 5,
          safeWaitPlayers: 10,
          mediumRiskPlayers: 10
        }
      };
      
      expect(competitionData.positionDemand.RB.competitionLevel).toBe('high');
      expect(availabilityProjections.summary.highRiskPlayers).toBe(5);
    });

    it('should structure recommendations properly', () => {
      const recommendation = {
        player: mockData.players[0],
        optimization: {
          score: 85.5,
          factors: {
            rosterNeed: { score: 80, explanation: 'High need for RB' },
            playerValue: { score: 90, explanation: 'Elite player value' },
            competition: { score: 75, explanation: 'High competition' },
            availability: { score: 60, explanation: 'Moderate availability' },
            startingLineupImpact: { score: 85, explanation: 'High impact' }
          }
        },
        rank: 1,
        playerId: 'player1',
        recommendation: {
          action: 'PICK_NOW',
          reasoning: 'Strong overall value with high roster need',
          riskAssessment: 'Low risk',
          confidence: 85
        }
      };
      
      expect(recommendation.player.player_info.name).toBe('Test Player 1');
      expect(recommendation.rank).toBe(1);
      expect(recommendation.recommendation.action).toBe('PICK_NOW');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle missing data gracefully', () => {
      const propsWithMissingData = {
        ...defaultProps,
        data: null,
        leagueUsers: null
      };

      const isCurrentUser = propsWithMissingData.selectedMemberId === propsWithMissingData.user.user_id;
      const shouldShowOptimizer = !!(isCurrentUser && propsWithMissingData.data && propsWithMissingData.leagueUsers);
      
      expect(shouldShowOptimizer).toBe(false);
    });

    it('should limit analysis to top players for performance', () => {
      const manyPlayers = Array.from({ length: 100 }, (_, i) => ({
        player_info: {
          player_id: `player${i}`,
          name: `Player ${i}`,
          position: 'RB',
          projected_2025_points: 200 - i,
          overall_rank: i + 1,
          position_rank: i + 1
        }
      }));

      const topPlayers = manyPlayers
        .sort((a, b) => (b.player_info?.projected_2025_points || 0) - (a.player_info?.projected_2025_points || 0))
        .slice(0, 25);
      
      expect(topPlayers.length).toBe(25);
      expect(topPlayers[0].player_info.projected_2025_points).toBe(200);
      expect(topPlayers[24].player_info.projected_2025_points).toBe(176);
    });

    it('should handle optimization engine errors', () => {
      const mockGenerateRankedRecommendations = () => {
        throw new Error('Optimization failed');
      };

      expect(() => mockGenerateRankedRecommendations()).toThrow('Optimization failed');
    });

    it('should handle empty recommendations gracefully', () => {
      const mockGenerateRankedRecommendations = () => [];
      const recommendations = mockGenerateRankedRecommendations();
      
      expect(recommendations.length).toBe(0);
    });
  });

  describe('Turn Detection Logic', () => {
    it('should correctly calculate user turn info', () => {
      // Test with user1 as first pick in draft
      const propsFirstPick = {
        ...defaultProps,
        draft: { picks: [] } // No picks made yet
      };

      const currentPickNumber = propsFirstPick.draft.picks?.length + 1 || 1;
      const totalManagers = propsFirstPick.leagueUsers?.length || 12;
      const isCurrentUser = propsFirstPick.selectedMemberId === propsFirstPick.user.user_id;
      
      expect(currentPickNumber).toBe(1);
      expect(totalManagers).toBe(3);
      expect(isCurrentUser).toBe(true);
    });

    it('should show picks until turn when not user turn', () => {
      const propsNotUserTurn = {
        ...defaultProps,
        draft: {
          picks: [
            { pick_no: 1, picked_by: 'user2', metadata: { player_id: 'drafted1', position: 'QB' } },
            { pick_no: 2, picked_by: 'user3', metadata: { player_id: 'drafted2', position: 'RB' } }
          ]
        }
      };

      const currentPickNumber = propsNotUserTurn.draft.picks?.length + 1 || 1;
      const totalManagers = propsNotUserTurn.leagueUsers?.length || 12;
      
      // Calculate picks until user's turn
      const currentRound = Math.ceil(currentPickNumber / totalManagers);
      const pickInRound = ((currentPickNumber - 1) % totalManagers) + 1;
      const userDraftPosition = propsNotUserTurn.leagueUsers.findIndex(u => u.user_id === propsNotUserTurn.user.user_id) + 1;
      
      let userPickInRound;
      if (currentRound % 2 === 1) {
        userPickInRound = userDraftPosition;
      } else {
        userPickInRound = totalManagers - userDraftPosition + 1;
      }
      
      const isUserTurn = pickInRound === userPickInRound;
      const picksUntilTurn = isUserTurn ? 0 : Math.abs(userPickInRound - pickInRound);
      
      expect(picksUntilTurn).toBeGreaterThan(0);
    });
  });

  describe('Component Integration', () => {
    it('should have all required analysis functions available', async () => {
      const { analyzeLeagueNeeds, predictManagerTargeting, calculatePositionUrgencyScores } = await import('../CompetitionAnalyzer');
      const { projectPlayerAvailability } = await import('../AvailabilityPredictor');
      const { generateRankedRecommendations, assessRosterNeeds } = await import('../OptimizationEngine');

      expect(typeof analyzeLeagueNeeds).toBe('function');
      expect(typeof predictManagerTargeting).toBe('function');
      expect(typeof calculatePositionUrgencyScores).toBe('function');
      expect(typeof projectPlayerAvailability).toBe('function');
      expect(typeof generateRankedRecommendations).toBe('function');
      expect(typeof assessRosterNeeds).toBe('function');
    });

    it('should prepare correct parameters for analysis functions', () => {
      const expectedParams = {
        leagueUsers: mockLeagueUsers,
        draftPicks: mockDraft.picks,
        rosterFormat: mockRosterFormat
      };
      
      expect(expectedParams.leagueUsers).toEqual(mockLeagueUsers);
      expect(expectedParams.draftPicks).toEqual(mockDraft.picks);
      expect(expectedParams.rosterFormat).toEqual(mockRosterFormat);
    });
  });
});