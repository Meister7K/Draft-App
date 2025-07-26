import { describe, it, expect, vi } from 'vitest';
import { calculateOptimizationScore, assessRosterNeeds } from '../OptimizationEngine.js';

// Integration test to verify the optimization engine works with YourDraftPicks-like data structures
describe('OptimizationEngine Integration', () => {
  // Mock data that matches the structure from YourDraftPicks component
  const mockDraftData = {
    picks: [
      {
        pick_id: 'pick-1',
        pick_no: 1,
        picked_by: 'user-1',
        metadata: {
          player_id: 'player-1',
          first_name: 'Josh',
          last_name: 'Allen',
          position: 'QB',
          team: 'BUF'
        }
      },
      {
        pick_id: 'pick-2',
        pick_no: 2,
        picked_by: 'user-1',
        metadata: {
          player_id: 'player-2',
          first_name: 'Christian',
          last_name: 'McCaffrey',
          position: 'RB',
          team: 'SF'
        }
      }
    ]
  };

  const mockPlayers = [
    {
      player_info: {
        player_id: 'player-3',
        name: 'Tyreek Hill',
        position: 'WR',
        team: 'MIA',
        overall_rank: 15,
        position_rank: 3,
        projected_2025_points: 280
      }
    },
    {
      player_info: {
        player_id: 'player-4',
        name: 'Travis Kelce',
        position: 'TE',
        team: 'KC',
        overall_rank: 25,
        position_rank: 1,
        projected_2025_points: 220
      }
    }
  ];

  const mockRosterFormat = [
    { position: 'QB', slots: 1 },
    { position: 'RB', slots: 2 },
    { position: 'WR', slots: 2 },
    { position: 'TE', slots: 1 },
    { position: 'FLEX', slots: 1 }
  ];

  // Mock calculateCompositeValue function similar to YourDraftPicks
  const mockCalculateCompositeValue = vi.fn((player, isDrafted, pickNumber) => {
    const baseValue = player.player_info.projected_2025_points / 2;
    const rankBonus = Math.max(0, (100 - player.player_info.overall_rank) / 2);
    return baseValue + rankBonus;
  });

  it('should integrate with YourDraftPicks data structures', () => {
    // Simulate current roster state after 2 picks
    const currentRoster = {
      positionCounts: { QB: 1, RB: 1, WR: 0, TE: 0 },
      starters: {
        QB: [{ 
          player: { 
            player_info: { projected_2025_points: 320 } 
          } 
        }],
        RB: [
          { 
            player: { 
              player_info: { projected_2025_points: 300 } 
            } 
          }, 
          null
        ],
        WR: [null, null],
        TE: [null],
        FLEX: [null]
      }
    };

    const context = {
      currentRoster,
      rosterFormat: mockRosterFormat,
      calculateCompositeValue: mockCalculateCompositeValue,
      currentPickNumber: 25,
      picksUntilNext: 3
    };

    // Test WR recommendation
    const wrResult = calculateOptimizationScore(mockPlayers[0], context);
    expect(wrResult.score).toBeGreaterThan(0);
    expect(wrResult.factors.rosterNeed.score).toBeGreaterThan(60); // High need for WR
    expect(mockCalculateCompositeValue).toHaveBeenCalledWith(mockPlayers[0], false, 25);

    // Test TE recommendation
    const teResult = calculateOptimizationScore(mockPlayers[1], context);
    expect(teResult.score).toBeGreaterThan(0);
    expect(teResult.factors.rosterNeed.score).toBeGreaterThan(60); // High need for TE

    // WR should have higher roster need than TE (2 slots vs 1 slot needed)
    expect(wrResult.factors.rosterNeed.score).toBeGreaterThanOrEqual(teResult.factors.rosterNeed.score);
  });

  it('should assess roster needs correctly with YourDraftPicks data', () => {
    const currentRoster = {
      positionCounts: { QB: 1, RB: 1, WR: 0, TE: 0 }
    };

    const needs = assessRosterNeeds(currentRoster, mockRosterFormat);

    expect(needs.positionNeeds.QB.needed).toBe(0);
    expect(needs.positionNeeds.RB.needed).toBe(1);
    expect(needs.positionNeeds.WR.needed).toBe(2);
    expect(needs.positionNeeds.TE.needed).toBe(1);
    expect(needs.positionNeeds.FLEX.needed).toBe(1);

    expect(needs.totalNeeds).toBe(5);
    expect(needs.criticalNeeds.length).toBeGreaterThan(0);
    expect(needs.summary).toContain('Critical needs');
  });

  it('should handle empty roster scenario', () => {
    const emptyRoster = {
      positionCounts: {},
      starters: {
        QB: [],
        RB: [],
        WR: [],
        TE: [],
        FLEX: []
      }
    };

    const context = {
      currentRoster: emptyRoster,
      rosterFormat: mockRosterFormat,
      calculateCompositeValue: mockCalculateCompositeValue,
      currentPickNumber: 1,
      picksUntilNext: 11
    };

    const result = calculateOptimizationScore(mockPlayers[0], context);
    
    expect(result.score).toBeGreaterThan(0);
    expect(result.factors.rosterNeed.score).toBeGreaterThan(70); // Very high need
    expect(result.factors.startingLineupImpact.score).toBeGreaterThan(20); // Would fill empty slot
  });

  it('should handle full roster scenario', () => {
    const fullRoster = {
      positionCounts: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 },
      starters: {
        QB: [{ player: { player_info: { projected_2025_points: 300 } } }],
        RB: [
          { player: { player_info: { projected_2025_points: 280 } } },
          { player: { player_info: { projected_2025_points: 250 } } }
        ],
        WR: [
          { player: { player_info: { projected_2025_points: 260 } } },
          { player: { player_info: { projected_2025_points: 240 } } }
        ],
        TE: [{ player: { player_info: { projected_2025_points: 200 } } }],
        FLEX: [{ player: { player_info: { projected_2025_points: 180 } } }]
      }
    };

    const context = {
      currentRoster: fullRoster,
      rosterFormat: mockRosterFormat,
      calculateCompositeValue: mockCalculateCompositeValue,
      currentPickNumber: 50,
      picksUntilNext: 5
    };

    const result = calculateOptimizationScore(mockPlayers[0], context);
    
    expect(result.score).toBeGreaterThan(0);
    expect(result.factors.rosterNeed.score).toBeLessThan(40); // Lower need when roster is full
    
    // Should still consider improvement potential
    if (mockPlayers[0].player_info.projected_2025_points > 180) {
      expect(result.factors.startingLineupImpact.score).toBeGreaterThan(20);
    }
  });

  it('should work with realistic draft progression', () => {
    // Simulate mid-draft scenario
    const midDraftRoster = {
      positionCounts: { QB: 1, RB: 2, WR: 1, TE: 0 },
      starters: {
        QB: [{ player: { player_info: { projected_2025_points: 290 } } }],
        RB: [
          { player: { player_info: { projected_2025_points: 270 } } },
          { player: { player_info: { projected_2025_points: 200 } } }
        ],
        WR: [
          { player: { player_info: { projected_2025_points: 250 } } },
          null
        ],
        TE: [],
        FLEX: [null]
      }
    };

    const context = {
      currentRoster: midDraftRoster,
      rosterFormat: mockRosterFormat,
      calculateCompositeValue: mockCalculateCompositeValue,
      currentPickNumber: 35,
      picksUntilNext: 7
    };

    // Test both available players
    const wrResult = calculateOptimizationScore(mockPlayers[0], context);
    const teResult = calculateOptimizationScore(mockPlayers[1], context);

    // Both should have reasonable scores
    expect(wrResult.score).toBeGreaterThan(30);
    expect(teResult.score).toBeGreaterThan(30);

    // TE should have higher or equal roster need (empty position vs filling second WR)
    expect(teResult.factors.rosterNeed.score).toBeGreaterThanOrEqual(wrResult.factors.rosterNeed.score);

    // Verify all factors are calculated
    [wrResult, teResult].forEach(result => {
      expect(result.factors.rosterNeed.score).toBeGreaterThanOrEqual(0);
      expect(result.factors.playerValue.score).toBeGreaterThanOrEqual(0);
      expect(result.factors.competition.score).toBeGreaterThanOrEqual(0);
      expect(result.factors.availability.score).toBeGreaterThanOrEqual(0);
      expect(result.factors.startingLineupImpact.score).toBeGreaterThanOrEqual(0);
    });
  });
});