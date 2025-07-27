/**
 * End-to-End Tests for Draft Pick Optimizer
 * Tests complete draft scenarios with optimizer recommendations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

describe('Draft Pick Optimizer - End-to-End Tests', () => {
  let mockUser, mockLeagueUsers, mockData, mockDraft, mockRosterFormat, mockCalculateCompositeValue;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup comprehensive mock data for end-to-end scenarios
    mockUser = { user_id: 'user1', username: 'TestUser' };
    
    mockLeagueUsers = Array.from({ length: 12 }, (_, i) => ({
      user_id: `user${i + 1}`,
      username: `User${i + 1}`,
      team_name: `Team ${i + 1}`
    }));

    mockData = {
      players: Array.from({ length: 200 }, (_, i) => ({
        player_info: {
          player_id: `player_${i + 1}`,
          name: `Player ${i + 1}`,
          position: ['QB', 'RB', 'WR', 'TE'][i % 4],
          team: `TEAM${(i % 32) + 1}`,
          overall_rank: i + 1,
          position_rank: Math.floor(i / 4) + 1,
          projected_2025_points: 300 - i
        }
      }))
    };

    mockRosterFormat = [
      { position: 'QB', slots: 1 },
      { position: 'RB', slots: 2 },
      { position: 'WR', slots: 2 },
      { position: 'TE', slots: 1 },
      { position: 'FLEX', slots: 1 }
    ];

    mockCalculateCompositeValue = vi.fn((player) => {
      return player.player_info.projected_2025_points * 0.5 + 
             (400 - player.player_info.overall_rank) * 0.3;
    });

    // Setup default mock returns
    const { generateRankedRecommendations, assessRosterNeeds } = await import('../OptimizationEngine');
    const { analyzeLeagueNeeds, predictManagerTargeting, calculatePositionUrgencyScores } = await import('../CompetitionAnalyzer');
    const { projectPlayerAvailability } = await import('../AvailabilityPredictor');

    generateRankedRecommendations.mockImplementation((players, context) => {
      return players.slice(0, 5).map((player, index) => ({
        player,
        optimization: {
          score: 90 - index * 5,
          factors: {
            rosterNeed: { score: 80 - index * 2, explanation: `Need for ${player.player_info.position}` },
            playerValue: { score: 85 - index * 3, explanation: 'Strong player value' },
            competition: { score: 70 - index * 2, explanation: 'Competition analysis' },
            availability: { score: 75 - index * 4, explanation: 'Availability projection' },
            startingLineupImpact: { score: 80 - index * 2, explanation: 'Lineup impact' }
          }
        },
        rank: index + 1,
        playerId: player.player_info.player_id,
        recommendation: {
          action: index === 0 ? 'PICK_NOW' : index < 3 ? 'CONSIDER' : 'WAIT',
          reasoning: `Recommendation for ${player.player_info.name}`,
          riskAssessment: index < 2 ? 'Low risk' : 'Medium risk',
          confidence: 90 - index * 10
        }
      }));
    });

    assessRosterNeeds.mockReturnValue({
      positionNeeds: {
        QB: { needed: 1, urgency: 'medium' },
        RB: { needed: 2, urgency: 'high' },
        WR: { needed: 2, urgency: 'high' },
        TE: { needed: 1, urgency: 'medium' }
      },
      totalNeeds: 6,
      criticalNeeds: [
        { position: 'RB', needed: 2, urgency: 'high' },
        { position: 'WR', needed: 2, urgency: 'high' }
      ],
      summary: 'Critical needs: 2 RBs, 2 WRs'
    });

    analyzeLeagueNeeds.mockReturnValue({
      managerNeeds: {},
      positionDemand: {
        QB: { competitionLevel: 'medium', managersStillNeed: 6, competitionScore: 50 },
        RB: { competitionLevel: 'high', managersStillNeed: 10, competitionScore: 80 },
        WR: { competitionLevel: 'high', managersStillNeed: 9, competitionScore: 75 },
        TE: { competitionLevel: 'medium', managersStillNeed: 7, competitionScore: 60 }
      },
      totalManagers: 12
    });

    predictManagerTargeting.mockReturnValue({
      nextFewPicks: [],
      positionTargeting: {}
    });

    calculatePositionUrgencyScores.mockReturnValue({
      urgencyScores: {
        QB: { score: 50, explanation: 'Medium urgency' },
        RB: { score: 80, explanation: 'High urgency' },
        WR: { score: 75, explanation: 'High urgency' },
        TE: { score: 60, explanation: 'Medium urgency' }
      }
    });

    projectPlayerAvailability.mockReturnValue({
      projections: {},
      summary: {
        totalPlayers: 50,
        highRiskPlayers: 10,
        safeWaitPlayers: 20,
        mediumRiskPlayers: 20
      }
    });
  });

  describe('Complete Draft Scenarios', () => {
    it('should handle early draft scenario (picks 1-24)', async () => {
      const earlyDraft = {
        picks: Array.from({ length: 5 }, (_, i) => ({
          pick_no: i + 1,
          picked_by: `user${(i % 12) + 1}`,
          metadata: {
            player_id: `player_${i + 1}`,
            position: ['QB', 'RB', 'WR', 'TE'][i % 4]
          }
        }))
      };

      const props = {
        user: mockUser,
        leagueUsers: mockLeagueUsers,
        data: mockData,
        draft: earlyDraft,
        selectedMemberId: 'user1',
        memberPicks: [],
        draftedPlayerIds: new Set(['player_1', 'player_2', 'player_3', 'player_4', 'player_5']),
        calculateCompositeValue: mockCalculateCompositeValue,
        rosterFormat: mockRosterFormat
      };

      render(<DraftPickOptimizer {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should show recommendations for early draft
      await waitFor(() => {
        expect(screen.getByText('Player 6')).toBeInTheDocument();
      });

      // Should show high-value recommendations
      const recommendations = screen.getAllByTestId('recommendation-card');
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should handle mid-draft scenario (picks 25-120)', async () => {
      const midDraft = {
        picks: Array.from({ length: 60 }, (_, i) => ({
          pick_no: i + 1,
          picked_by: `user${(i % 12) + 1}`,
          metadata: {
            player_id: `player_${i + 1}`,
            position: ['QB', 'RB', 'WR', 'TE'][i % 4]
          }
        }))
      };

      const memberPicks = Array.from({ length: 5 }, (_, i) => ({
        pick_no: i * 12 + 1,
        picked_by: 'user1',
        metadata: {
          player_id: `player_${i * 12 + 1}`,
          position: ['QB', 'RB', 'WR', 'TE'][i % 4]
        }
      }));

      const props = {
        user: mockUser,
        leagueUsers: mockLeagueUsers,
        data: mockData,
        draft: midDraft,
        selectedMemberId: 'user1',
        memberPicks,
        draftedPlayerIds: new Set(midDraft.picks.map(p => p.metadata.player_id)),
        calculateCompositeValue: mockCalculateCompositeValue,
        rosterFormat: mockRosterFormat
      };

      render(<DraftPickOptimizer {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should show recommendations for mid-draft
      await waitFor(() => {
        const availablePlayer = screen.getByText('Player 61');
        expect(availablePlayer).toBeInTheDocument();
      });

      // Should consider roster needs more heavily in mid-draft
      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      expect(generateRankedRecommendations).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          currentRoster: expect.any(Object),
          rosterFormat: mockRosterFormat
        })
      );
    });

    it('should handle late draft scenario (picks 121+)', async () => {
      const lateDraft = {
        picks: Array.from({ length: 150 }, (_, i) => ({
          pick_no: i + 1,
          picked_by: `user${(i % 12) + 1}`,
          metadata: {
            player_id: `player_${i + 1}`,
            position: ['QB', 'RB', 'WR', 'TE'][i % 4]
          }
        }))
      };

      const memberPicks = Array.from({ length: 12 }, (_, i) => ({
        pick_no: i * 12 + 1,
        picked_by: 'user1',
        metadata: {
          player_id: `player_${i * 12 + 1}`,
          position: ['QB', 'RB', 'WR', 'TE'][i % 4]
        }
      }));

      const props = {
        user: mockUser,
        leagueUsers: mockLeagueUsers,
        data: mockData,
        draft: lateDraft,
        selectedMemberId: 'user1',
        memberPicks,
        draftedPlayerIds: new Set(lateDraft.picks.map(p => p.metadata.player_id)),
        calculateCompositeValue: mockCalculateCompositeValue,
        rosterFormat: mockRosterFormat
      };

      render(<DraftPickOptimizer {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should show recommendations for late draft
      await waitFor(() => {
        const availablePlayer = screen.getByText('Player 151');
        expect(availablePlayer).toBeInTheDocument();
      });

      // Should focus on depth and value picks in late draft
      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      expect(generateRankedRecommendations).toHaveBeenCalled();
    });

    it('should handle draft progression with real-time updates', async () => {
      let currentDraft = {
        picks: Array.from({ length: 10 }, (_, i) => ({
          pick_no: i + 1,
          picked_by: `user${(i % 12) + 1}`,
          metadata: {
            player_id: `player_${i + 1}`,
            position: ['QB', 'RB', 'WR', 'TE'][i % 4]
          }
        }))
      };

      const { rerender } = render(
        <DraftPickOptimizer
          user={mockUser}
          leagueUsers={mockLeagueUsers}
          data={mockData}
          draft={currentDraft}
          selectedMemberId="user1"
          memberPicks={[]}
          draftedPlayerIds={new Set(currentDraft.picks.map(p => p.metadata.player_id))}
          calculateCompositeValue={mockCalculateCompositeValue}
          rosterFormat={mockRosterFormat}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Simulate new pick being made
      const updatedDraft = {
        picks: [
          ...currentDraft.picks,
          {
            pick_no: 11,
            picked_by: 'user2',
            metadata: {
              player_id: 'player_11',
              position: 'RB'
            }
          }
        ]
      };

      rerender(
        <DraftPickOptimizer
          user={mockUser}
          leagueUsers={mockLeagueUsers}
          data={mockData}
          draft={updatedDraft}
          selectedMemberId="user1"
          memberPicks={[]}
          draftedPlayerIds={new Set(updatedDraft.picks.map(p => p.metadata.player_id))}
          calculateCompositeValue={mockCalculateCompositeValue}
          rosterFormat={mockRosterFormat}
        />
      );

      // Should update recommendations after new pick
      await waitFor(() => {
        const { generateRankedRecommendations } = import('../OptimizationEngine');
        expect(generateRankedRecommendations).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('User Interaction Scenarios', () => {
    it('should handle recommendation card interactions', async () => {
      const props = {
        user: mockUser,
        leagueUsers: mockLeagueUsers,
        data: mockData,
        draft: { picks: [] },
        selectedMemberId: 'user1',
        memberPicks: [],
        draftedPlayerIds: new Set(),
        calculateCompositeValue: mockCalculateCompositeValue,
        rosterFormat: mockRosterFormat
      };

      render(<DraftPickOptimizer {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should be able to expand recommendation details
      const recommendationCards = screen.getAllByTestId('recommendation-card');
      if (recommendationCards.length > 0) {
        const firstCard = recommendationCards[0];
        
        // Look for expandable elements
        const expandButton = firstCard.querySelector('[data-testid="expand-factors"]');
        if (expandButton) {
          fireEvent.click(expandButton);
          
          await waitFor(() => {
            expect(screen.getByText(/Roster Need/i)).toBeInTheDocument();
          });
        }
      }
    });

    it('should handle different roster states', async () => {
      const scenarios = [
        {
          name: 'Empty roster',
          memberPicks: [],
          expectedNeeds: ['QB', 'RB', 'WR', 'TE']
        },
        {
          name: 'Partial roster',
          memberPicks: [
            { metadata: { position: 'QB' } },
            { metadata: { position: 'RB' } }
          ],
          expectedNeeds: ['RB', 'WR', 'TE']
        },
        {
          name: 'Nearly full roster',
          memberPicks: [
            { metadata: { position: 'QB' } },
            { metadata: { position: 'RB' } },
            { metadata: { position: 'RB' } },
            { metadata: { position: 'WR' } },
            { metadata: { position: 'TE' } }
          ],
          expectedNeeds: ['WR']
        }
      ];

      for (const scenario of scenarios) {
        const props = {
          user: mockUser,
          leagueUsers: mockLeagueUsers,
          data: mockData,
          draft: { picks: [] },
          selectedMemberId: 'user1',
          memberPicks: scenario.memberPicks,
          draftedPlayerIds: new Set(),
          calculateCompositeValue: mockCalculateCompositeValue,
          rosterFormat: mockRosterFormat
        };

        const { unmount } = render(<DraftPickOptimizer {...props} />);

        await waitFor(() => {
          expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
        });

        // Verify recommendations are appropriate for roster state
        const { assessRosterNeeds } = await import('../OptimizationEngine');
        expect(assessRosterNeeds).toHaveBeenCalled();

        unmount();
      }
    });
  });

  describe('Performance and Error Scenarios', () => {
    it('should handle large datasets efficiently', async () => {
      const largeMockData = {
        players: Array.from({ length: 1000 }, (_, i) => ({
          player_info: {
            player_id: `player_${i + 1}`,
            name: `Player ${i + 1}`,
            position: ['QB', 'RB', 'WR', 'TE'][i % 4],
            team: `TEAM${(i % 32) + 1}`,
            overall_rank: i + 1,
            position_rank: Math.floor(i / 4) + 1,
            projected_2025_points: 300 - i
          }
        }))
      };

      const props = {
        user: mockUser,
        leagueUsers: mockLeagueUsers,
        data: largeMockData,
        draft: { picks: [] },
        selectedMemberId: 'user1',
        memberPicks: [],
        draftedPlayerIds: new Set(),
        calculateCompositeValue: mockCalculateCompositeValue,
        rosterFormat: mockRosterFormat
      };

      const startTime = performance.now();
      
      render(<DraftPickOptimizer {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time even with large dataset
      expect(renderTime).toBeLessThan(2000); // 2 seconds max
    });

    it('should handle missing or invalid data gracefully', async () => {
      const invalidDataScenarios = [
        {
          name: 'Null data',
          data: null
        },
        {
          name: 'Empty players array',
          data: { players: [] }
        },
        {
          name: 'Invalid player data',
          data: {
            players: [
              { invalid: 'data' },
              { player_info: null },
              { player_info: { name: 'Valid Player', position: 'RB' } }
            ]
          }
        }
      ];

      for (const scenario of invalidDataScenarios) {
        const props = {
          user: mockUser,
          leagueUsers: mockLeagueUsers,
          data: scenario.data,
          draft: { picks: [] },
          selectedMemberId: 'user1',
          memberPicks: [],
          draftedPlayerIds: new Set(),
          calculateCompositeValue: mockCalculateCompositeValue,
          rosterFormat: mockRosterFormat
        };

        // Should not throw errors
        expect(() => {
          render(<DraftPickOptimizer {...props} />);
        }).not.toThrow();
      }
    });

    it('should handle optimization engine failures', async () => {
      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      generateRankedRecommendations.mockImplementation(() => {
        throw new Error('Optimization failed');
      });

      const props = {
        user: mockUser,
        leagueUsers: mockLeagueUsers,
        data: mockData,
        draft: { picks: [] },
        selectedMemberId: 'user1',
        memberPicks: [],
        draftedPlayerIds: new Set(),
        calculateCompositeValue: mockCalculateCompositeValue,
        rosterFormat: mockRosterFormat
      };

      render(<DraftPickOptimizer {...props} />);

      // Should show error state or fallback
      await waitFor(() => {
        // Component should still render, possibly with error message
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integration with YourDraftPicks', () => {
    it('should integrate seamlessly with parent component state', async () => {
      const props = {
        user: mockUser,
        leagueUsers: mockLeagueUsers,
        data: mockData,
        draft: { picks: [] },
        selectedMemberId: 'user1',
        memberPicks: [],
        draftedPlayerIds: new Set(),
        calculateCompositeValue: mockCalculateCompositeValue,
        rosterFormat: mockRosterFormat
      };

      render(<DraftPickOptimizer {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should use the provided calculateCompositeValue function
      expect(mockCalculateCompositeValue).toHaveBeenCalled();

      // Should respect the selected member ID
      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      expect(generateRankedRecommendations).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          currentRoster: expect.any(Object)
        })
      );
    });

    it('should maintain consistent styling with parent component', async () => {
      const props = {
        user: mockUser,
        leagueUsers: mockLeagueUsers,
        data: mockData,
        draft: { picks: [] },
        selectedMemberId: 'user1',
        memberPicks: [],
        draftedPlayerIds: new Set(),
        calculateCompositeValue: mockCalculateCompositeValue,
        rosterFormat: mockRosterFormat
      };

      render(<DraftPickOptimizer {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should have consistent CSS classes and styling
      const optimizerContainer = screen.getByTestId('draft-pick-optimizer');
      expect(optimizerContainer).toHaveClass('draft-pick-optimizer');
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide proper ARIA labels and roles', async () => {
      const props = {
        user: mockUser,
        leagueUsers: mockLeagueUsers,
        data: mockData,
        draft: { picks: [] },
        selectedMemberId: 'user1',
        memberPicks: [],
        draftedPlayerIds: new Set(),
        calculateCompositeValue: mockCalculateCompositeValue,
        rosterFormat: mockRosterFormat
      };

      render(<DraftPickOptimizer {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should have proper ARIA labels
      const optimizerSection = screen.getByRole('region', { name: /draft pick optimizer/i });
      expect(optimizerSection).toBeInTheDocument();

      // Recommendations should be accessible
      const recommendations = screen.getAllByRole('article');
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation', async () => {
      const props = {
        user: mockUser,
        leagueUsers: mockLeagueUsers,
        data: mockData,
        draft: { picks: [] },
        selectedMemberId: 'user1',
        memberPicks: [],
        draftedPlayerIds: new Set(),
        calculateCompositeValue: mockCalculateCompositeValue,
        rosterFormat: mockRosterFormat
      };

      render(<DraftPickOptimizer {...props} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should be able to tab through recommendations
      const focusableElements = screen.getAllByRole('button');
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
        expect(document.activeElement).toBe(focusableElements[0]);
      }
    });
  });
});