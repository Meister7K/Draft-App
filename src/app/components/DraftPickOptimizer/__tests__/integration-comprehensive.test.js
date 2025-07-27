/**
 * Comprehensive Integration Tests for Draft Pick Optimizer
 * Tests interaction with existing draft components and data flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DraftPickOptimizer } from '../DraftPickOptimizer.jsx';

// Mock all optimization modules
vi.mock('../OptimizationEngine', () => ({
  generateRankedRecommendations: vi.fn(),
  assessRosterNeeds: vi.fn(),
  calculateOptimizationScore: vi.fn()
}));

vi.mock('../CompetitionAnalyzer', () => ({
  analyzeLeagueNeeds: vi.fn(),
  predictManagerTargeting: vi.fn(),
  calculatePositionUrgencyScores: vi.fn()
}));

vi.mock('../AvailabilityPredictor', () => ({
  projectPlayerAvailability: vi.fn()
}));

describe('Draft Pick Optimizer - Comprehensive Integration Tests', () => {
  let mockProps;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup realistic mock data that matches YourDraftPicks structure
    mockProps = {
      user: { user_id: 'user1', username: 'TestUser' },
      leagueUsers: [
        { user_id: 'user1', username: 'TestUser' },
        { user_id: 'user2', username: 'User2' },
        { user_id: 'user3', username: 'User3' },
        { user_id: 'user4', username: 'User4' }
      ],
      data: {
        players: [
          {
            player_info: {
              player_id: 'player1',
              name: 'Josh Allen',
              position: 'QB',
              team: 'BUF',
              overall_rank: 5,
              position_rank: 1,
              projected_2025_points: 320
            }
          },
          {
            player_info: {
              player_id: 'player2',
              name: 'Christian McCaffrey',
              position: 'RB',
              team: 'SF',
              overall_rank: 2,
              position_rank: 1,
              projected_2025_points: 350
            }
          },
          {
            player_info: {
              player_id: 'player3',
              name: 'Tyreek Hill',
              position: 'WR',
              team: 'MIA',
              overall_rank: 8,
              position_rank: 2,
              projected_2025_points: 290
            }
          },
          {
            player_info: {
              player_id: 'player4',
              name: 'Travis Kelce',
              position: 'TE',
              team: 'KC',
              overall_rank: 15,
              position_rank: 1,
              projected_2025_points: 250
            }
          }
        ]
      },
      draft: {
        picks: [
          {
            pick_id: 'pick1',
            pick_no: 1,
            picked_by: 'user2',
            metadata: {
              player_id: 'player2',
              first_name: 'Christian',
              last_name: 'McCaffrey',
              position: 'RB',
              team: 'SF'
            }
          }
        ]
      },
      selectedMemberId: 'user1',
      memberPicks: [],
      draftedPlayerIds: new Set(['player2']),
      calculateCompositeValue: vi.fn((player, isDrafted, pickNumber) => {
        const baseValue = player.player_info.projected_2025_points / 2;
        const rankBonus = Math.max(0, (100 - player.player_info.overall_rank) / 2);
        return baseValue + rankBonus;
      }),
      rosterFormat: [
        { position: 'QB', slots: 1 },
        { position: 'RB', slots: 2 },
        { position: 'WR', slots: 2 },
        { position: 'TE', slots: 1 },
        { position: 'FLEX', slots: 1 }
      ]
    };

    // Setup mock returns
    const { generateRankedRecommendations, assessRosterNeeds } = await import('../OptimizationEngine');
    const { analyzeLeagueNeeds, predictManagerTargeting, calculatePositionUrgencyScores } = await import('../CompetitionAnalyzer');
    const { projectPlayerAvailability } = await import('../AvailabilityPredictor');

    generateRankedRecommendations.mockReturnValue([
      {
        player: mockProps.data.players[0], // Josh Allen
        optimization: {
          score: 85.5,
          factors: {
            rosterNeed: { score: 90, explanation: 'High need for QB position' },
            playerValue: { score: 95, explanation: 'Elite QB with high projected points' },
            competition: { score: 70, explanation: 'Medium competition for QBs' },
            availability: { score: 80, explanation: 'Good availability at current pick' },
            startingLineupImpact: { score: 90, explanation: 'Would fill starting QB slot' }
          }
        },
        rank: 1,
        playerId: 'player1',
        recommendation: {
          action: 'PICK_NOW',
          reasoning: 'Elite QB available, fills critical roster need',
          riskAssessment: 'Low risk - secure starter',
          confidence: 90
        }
      },
      {
        player: mockProps.data.players[2], // Tyreek Hill
        optimization: {
          score: 82.0,
          factors: {
            rosterNeed: { score: 85, explanation: 'High need for WR position' },
            playerValue: { score: 88, explanation: 'Top-tier WR with consistent production' },
            competition: { score: 75, explanation: 'High competition for top WRs' },
            availability: { score: 70, explanation: 'May not be available later' },
            startingLineupImpact: { score: 85, explanation: 'Would fill starting WR slot' }
          }
        },
        rank: 2,
        playerId: 'player3',
        recommendation: {
          action: 'CONSIDER',
          reasoning: 'Top WR option, consider position scarcity',
          riskAssessment: 'Medium risk - high demand position',
          confidence: 82
        }
      }
    ]);

    assessRosterNeeds.mockReturnValue({
      positionNeeds: {
        QB: { needed: 1, urgency: 'high' },
        RB: { needed: 1, urgency: 'medium' },
        WR: { needed: 2, urgency: 'high' },
        TE: { needed: 1, urgency: 'medium' },
        FLEX: { needed: 1, urgency: 'low' }
      },
      totalNeeds: 6,
      criticalNeeds: [
        { position: 'QB', needed: 1, urgency: 'high' },
        { position: 'WR', needed: 2, urgency: 'high' }
      ],
      summary: 'Critical needs: 1 QB, 2 WRs'
    });

    analyzeLeagueNeeds.mockReturnValue({
      managerNeeds: {
        user1: { QB: { needed: 1, urgency: 'high' }, WR: { needed: 2, urgency: 'high' } },
        user2: { RB: { needed: 1, urgency: 'medium' }, WR: { needed: 2, urgency: 'high' } },
        user3: { QB: { needed: 1, urgency: 'high' }, TE: { needed: 1, urgency: 'medium' } },
        user4: { RB: { needed: 2, urgency: 'high' }, WR: { needed: 1, urgency: 'medium' } }
      },
      positionDemand: {
        QB: { competitionLevel: 'high', managersStillNeed: 3, competitionScore: 75 },
        RB: { competitionLevel: 'high', managersStillNeed: 3, competitionScore: 80 },
        WR: { competitionLevel: 'very_high', managersStillNeed: 4, competitionScore: 90 },
        TE: { competitionLevel: 'medium', managersStillNeed: 2, competitionScore: 50 }
      },
      totalManagers: 4
    });

    predictManagerTargeting.mockReturnValue({
      nextFewPicks: [
        { managerId: 'user3', pickNumber: 3, likelyTargets: ['QB', 'TE'] },
        { managerId: 'user4', pickNumber: 4, likelyTargets: ['RB', 'WR'] }
      ],
      positionTargeting: {
        QB: { nextLikelyPick: 3, confidence: 0.8 },
        RB: { nextLikelyPick: 4, confidence: 0.7 },
        WR: { nextLikelyPick: 4, confidence: 0.6 },
        TE: { nextLikelyPick: 3, confidence: 0.5 }
      }
    });

    calculatePositionUrgencyScores.mockReturnValue({
      urgencyScores: {
        QB: { score: 85, explanation: 'High urgency - multiple managers need QBs' },
        RB: { score: 70, explanation: 'Medium urgency - some competition' },
        WR: { score: 90, explanation: 'Very high urgency - all managers need WRs' },
        TE: { score: 50, explanation: 'Low urgency - limited competition' }
      }
    });

    projectPlayerAvailability.mockReturnValue({
      projections: {
        player1: {
          availabilityByPick: { 2: 0.9, 6: 0.3, 10: 0.1 },
          estimatedDraftRange: { earliest: 2, latest: 8, mostLikely: 5 },
          riskFactors: { highDemandPosition: true, multipleManagersNeed: true },
          waitRecommendation: { shouldWait: false, confidence: 0.8, reasoning: 'High demand, pick now' }
        },
        player3: {
          availabilityByPick: { 2: 0.8, 6: 0.4, 10: 0.2 },
          estimatedDraftRange: { earliest: 3, latest: 10, mostLikely: 6 },
          riskFactors: { highDemandPosition: true, limitedAlternatives: true },
          waitRecommendation: { shouldWait: false, confidence: 0.7, reasoning: 'Limited alternatives at position' }
        }
      },
      summary: {
        totalPlayers: 3,
        highRiskPlayers: 2,
        safeWaitPlayers: 0,
        mediumRiskPlayers: 1
      }
    });
  });

  describe('Data Flow Integration', () => {
    it('should correctly process YourDraftPicks data structure', async () => {
      render(<DraftPickOptimizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Verify that the optimizer correctly processes the draft data
      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      
      expect(generateRankedRecommendations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            player_info: expect.objectContaining({
              player_id: 'player1',
              name: 'Josh Allen'
            })
          })
        ]),
        expect.objectContaining({
          currentRoster: expect.objectContaining({
            positionCounts: expect.any(Object),
            starters: expect.any(Object)
          }),
          rosterFormat: mockProps.rosterFormat,
          calculateCompositeValue: mockProps.calculateCompositeValue
        })
      );
    });

    it('should filter out drafted players correctly', async () => {
      render(<DraftPickOptimizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      const callArgs = generateRankedRecommendations.mock.calls[0];
      const availablePlayers = callArgs[0];

      // Should not include drafted player (Christian McCaffrey)
      expect(availablePlayers.some(p => p.player_info.player_id === 'player2')).toBe(false);
      
      // Should include available players
      expect(availablePlayers.some(p => p.player_info.player_id === 'player1')).toBe(true);
      expect(availablePlayers.some(p => p.player_info.player_id === 'player3')).toBe(true);
    });

    it('should build correct roster state from member picks', async () => {
      const propsWithPicks = {
        ...mockProps,
        memberPicks: [
          {
            pick_no: 2,
            picked_by: 'user1',
            metadata: {
              player_id: 'player1',
              position: 'QB'
            }
          }
        ]
      };

      render(<DraftPickOptimizer {...propsWithPicks} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      const callArgs = generateRankedRecommendations.mock.calls[0];
      const context = callArgs[1];

      // Should reflect QB position filled
      expect(context.currentRoster.positionCounts.QB).toBe(1);
    });

    it('should use calculateCompositeValue function from parent', async () => {
      render(<DraftPickOptimizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should have called the parent's calculateCompositeValue function
      expect(mockProps.calculateCompositeValue).toHaveBeenCalled();

      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      const callArgs = generateRankedRecommendations.mock.calls[0];
      const context = callArgs[1];

      expect(context.calculateCompositeValue).toBe(mockProps.calculateCompositeValue);
    });
  });

  describe('Real-time Update Integration', () => {
    it('should update when draft picks change', async () => {
      const { rerender } = render(<DraftPickOptimizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Simulate new pick being made
      const updatedProps = {
        ...mockProps,
        draft: {
          picks: [
            ...mockProps.draft.picks,
            {
              pick_id: 'pick2',
              pick_no: 2,
              picked_by: 'user1',
              metadata: {
                player_id: 'player1',
                position: 'QB'
              }
            }
          ]
        },
        memberPicks: [
          {
            pick_no: 2,
            picked_by: 'user1',
            metadata: {
              player_id: 'player1',
              position: 'QB'
            }
          }
        ],
        draftedPlayerIds: new Set(['player2', 'player1'])
      };

      rerender(<DraftPickOptimizer {...updatedProps} />);

      await waitFor(() => {
        const { generateRankedRecommendations } = import('../OptimizationEngine');
        // Should have been called again with updated data
        expect(generateRankedRecommendations).toHaveBeenCalledTimes(2);
      });
    });

    it('should update when selected member changes', async () => {
      const { rerender } = render(<DraftPickOptimizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Change selected member
      const updatedProps = {
        ...mockProps,
        selectedMemberId: 'user2',
        memberPicks: [
          {
            pick_no: 1,
            picked_by: 'user2',
            metadata: {
              player_id: 'player2',
              position: 'RB'
            }
          }
        ]
      };

      rerender(<DraftPickOptimizer {...updatedProps} />);

      await waitFor(() => {
        const { generateRankedRecommendations } = import('../OptimizationEngine');
        // Should recalculate for different member
        expect(generateRankedRecommendations).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle rapid updates efficiently', async () => {
      const { rerender } = render(<DraftPickOptimizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Simulate rapid updates
      for (let i = 0; i < 5; i++) {
        const updatedProps = {
          ...mockProps,
          draft: {
            picks: [
              ...mockProps.draft.picks,
              {
                pick_id: `pick${i + 2}`,
                pick_no: i + 2,
                picked_by: `user${(i % 4) + 1}`,
                metadata: {
                  player_id: `player${i + 10}`,
                  position: 'RB'
                }
              }
            ]
          }
        };

        rerender(<DraftPickOptimizer {...updatedProps} />);
      }

      // Should handle rapid updates without errors
      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });
    });
  });

  describe('Component State Integration', () => {
    it('should maintain state consistency with parent component', async () => {
      render(<DraftPickOptimizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should show recommendations based on current user
      expect(screen.getByText(/Josh Allen/)).toBeInTheDocument();
      expect(screen.getByText(/Tyreek Hill/)).toBeInTheDocument();

      // Should not show drafted players
      expect(screen.queryByText(/Christian McCaffrey/)).not.toBeInTheDocument();
    });

    it('should handle turn detection correctly', async () => {
      // Test when it's user's turn (pick 2 in 4-person league)
      const userTurnProps = {
        ...mockProps,
        draft: {
          picks: [
            {
              pick_no: 1,
              picked_by: 'user2',
              metadata: { player_id: 'player2', position: 'RB' }
            }
          ]
        }
      };

      render(<DraftPickOptimizer {...userTurnProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should show optimizer when it's user's turn or close to it
      expect(screen.getByTestId('draft-pick-optimizer')).toBeInTheDocument();
    });

    it('should handle different league sizes', async () => {
      const largeLagueProps = {
        ...mockProps,
        leagueUsers: Array.from({ length: 12 }, (_, i) => ({
          user_id: `user${i + 1}`,
          username: `User${i + 1}`
        }))
      };

      render(<DraftPickOptimizer {...largeLagueProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      const { analyzeLeagueNeeds } = await import('../CompetitionAnalyzer');
      expect(analyzeLeagueNeeds).toHaveBeenCalledWith(
        largeLagueProps.leagueUsers,
        expect.any(Array),
        expect.any(Array)
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle missing player data gracefully', async () => {
      const propsWithMissingData = {
        ...mockProps,
        data: {
          players: [
            { player_info: null },
            { invalid: 'structure' },
            mockProps.data.players[0] // One valid player
          ]
        }
      };

      render(<DraftPickOptimizer {...propsWithMissingData} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should still show valid recommendations
      expect(screen.getByText(/Josh Allen/)).toBeInTheDocument();
    });

    it('should handle optimization engine errors', async () => {
      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      generateRankedRecommendations.mockImplementation(() => {
        throw new Error('Optimization failed');
      });

      render(<DraftPickOptimizer {...mockProps} />);

      // Should not crash the component
      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });
    });

    it('should handle network-like delays', async () => {
      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      generateRankedRecommendations.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve([]);
          }, 100);
        });
      });

      render(<DraftPickOptimizer {...mockProps} />);

      // Should show loading state initially
      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should eventually show content
      await waitFor(() => {
        expect(screen.getByTestId('draft-pick-optimizer')).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataProps = {
        ...mockProps,
        data: {
          players: Array.from({ length: 500 }, (_, i) => ({
            player_info: {
              player_id: `player${i + 1}`,
              name: `Player ${i + 1}`,
              position: ['QB', 'RB', 'WR', 'TE'][i % 4],
              team: `TEAM${(i % 32) + 1}`,
              overall_rank: i + 1,
              position_rank: Math.floor(i / 4) + 1,
              projected_2025_points: 300 - i
            }
          }))
        }
      };

      const startTime = performance.now();
      
      render(<DraftPickOptimizer {...largeDataProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000); // 1 second max
    });

    it('should limit analysis to top players for performance', async () => {
      const manyPlayersProps = {
        ...mockProps,
        data: {
          players: Array.from({ length: 1000 }, (_, i) => ({
            player_info: {
              player_id: `player${i + 1}`,
              name: `Player ${i + 1}`,
              position: ['QB', 'RB', 'WR', 'TE'][i % 4],
              team: `TEAM${(i % 32) + 1}`,
              overall_rank: i + 1,
              position_rank: Math.floor(i / 4) + 1,
              projected_2025_points: 300 - i
            }
          }))
        }
      };

      render(<DraftPickOptimizer {...manyPlayersProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      const { generateRankedRecommendations } = await import('../OptimizationEngine');
      const callArgs = generateRankedRecommendations.mock.calls[0];
      const playersAnalyzed = callArgs[0];

      // Should limit the number of players analyzed for performance
      expect(playersAnalyzed.length).toBeLessThanOrEqual(50);
    });
  });

  describe('User Experience Integration', () => {
    it('should provide smooth transitions during updates', async () => {
      const { rerender } = render(<DraftPickOptimizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Simulate data update
      const updatedProps = {
        ...mockProps,
        draft: {
          picks: [
            ...mockProps.draft.picks,
            {
              pick_no: 2,
              picked_by: 'user3',
              metadata: { player_id: 'player4', position: 'TE' }
            }
          ]
        }
      };

      rerender(<DraftPickOptimizer {...updatedProps} />);

      // Should maintain smooth user experience
      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });
    });

    it('should maintain focus and accessibility during updates', async () => {
      render(<DraftPickOptimizer {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Draft Pick Optimizer/i)).toBeInTheDocument();
      });

      // Should have proper ARIA labels and structure
      const optimizerRegion = screen.getByRole('region');
      expect(optimizerRegion).toHaveAttribute('aria-label');

      // Should maintain keyboard navigation
      const focusableElements = screen.getAllByRole('button');
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
        expect(document.activeElement).toBe(focusableElements[0]);
      }
    });
  });
});