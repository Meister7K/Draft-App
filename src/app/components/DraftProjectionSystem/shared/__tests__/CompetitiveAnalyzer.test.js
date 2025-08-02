/**
 * Tests for CompetitiveAnalyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CompetitiveAnalyzer } from '../CompetitiveAnalyzer.js';

describe('CompetitiveAnalyzer', () => {
  let analyzer;
  let mockManagers;
  let mockCurrentPicks;
  let mockDraftSettings;

  beforeEach(() => {
    analyzer = new CompetitiveAnalyzer();

    mockManagers = [
      { user_id: 'manager1', display_name: 'Manager One' },
      { user_id: 'manager2', display_name: 'Manager Two' },
      { user_id: 'manager3', display_name: 'Manager Three' }
    ];

    mockCurrentPicks = [
      {
        pick_no: 1,
        round: 1,
        picked_by: 'manager1',
        player_id: 'player1',
        metadata: { position: 'RB', first_name: 'Christian', last_name: 'McCaffrey' }
      },
      {
        pick_no: 2,
        round: 1,
        picked_by: 'manager2',
        player_id: 'player2',
        metadata: { position: 'WR', first_name: 'Cooper', last_name: 'Kupp' }
      },
      {
        pick_no: 3,
        round: 1,
        picked_by: 'manager3',
        player_id: 'player3',
        metadata: { position: 'RB', first_name: 'Saquon', last_name: 'Barkley' }
      }
    ];

    mockDraftSettings = {
      draft_order: ['manager1', 'manager2', 'manager3'],
      pick_no: 4,
      total_slots: 3,
      rounds: 13
    };
  });

  describe('constructor', () => {
    it('should initialize with default roster format', () => {
      expect(analyzer.rosterFormat).toBeDefined();
      expect(analyzer.rosterFormat.QB).toBe(1);
      expect(analyzer.rosterFormat.RB).toBe(2);
      expect(analyzer.rosterFormat.WR).toBe(2);
      expect(analyzer.rosterFormat.TE).toBe(1);
      expect(analyzer.rosterFormat.FLEX).toBe(1);
      expect(analyzer.rosterFormat.BENCH).toBe(6);
    });

    it('should initialize with custom roster format', () => {
      const customFormat = { QB: 2, RB: 3, WR: 3, TE: 2, FLEX: 2, BENCH: 8 };
      const customAnalyzer = new CompetitiveAnalyzer(customFormat);
      
      expect(customAnalyzer.rosterFormat).toEqual(customFormat);
    });

    it('should initialize position priorities', () => {
      expect(analyzer.positionPriorities).toBeDefined();
      expect(analyzer.positionPriorities['zero-rb']).toContain('WR');
      expect(analyzer.positionPriorities['rb-heavy']).toContain('RB');
    });
  });

  describe('analyzeManagerNeeds', () => {
    it('should analyze all managers successfully', () => {
      const analysis = analyzer.analyzeManagerNeeds(mockManagers, mockCurrentPicks, mockDraftSettings);
      
      expect(analysis).toHaveLength(3);
      expect(analysis[0]).toHaveProperty('managerId');
      expect(analysis[0]).toHaveProperty('managerName');
      expect(analysis[0]).toHaveProperty('currentRoster');
      expect(analysis[0]).toHaveProperty('needs');
      expect(analysis[0]).toHaveProperty('urgency');
      expect(analysis[0]).toHaveProperty('likelyTargets');
    });

    it('should throw error for invalid managers input', () => {
      expect(() => {
        analyzer.analyzeManagerNeeds(null);
      }).toThrow('Managers array is required');

      expect(() => {
        analyzer.analyzeManagerNeeds('not an array');
      }).toThrow('Managers array is required');
    });

    it('should handle managers without display names', () => {
      const managersWithoutNames = [
        { user_id: 'manager1' },
        { user_id: 'manager2', username: 'user2' }
      ];
      
      const analysis = analyzer.analyzeManagerNeeds(managersWithoutNames, [], mockDraftSettings);
      
      expect(analysis[0].managerName).toBe('Manager manager1');
      expect(analysis[1].managerName).toBe('user2');
    });
  });

  describe('buildCurrentRoster', () => {
    it('should build roster correctly from picks', () => {
      const roster = analyzer.buildCurrentRoster('manager1', mockCurrentPicks);
      
      expect(roster.RB).toHaveLength(1);
      expect(roster.RB[0].name).toBe('Christian McCaffrey');
      expect(roster.RB[0].position).toBe('RB');
      expect(roster.RB[0].pickNumber).toBe(1);
      expect(roster.RB[0].round).toBe(1);
    });

    it('should return empty roster for manager with no picks', () => {
      const roster = analyzer.buildCurrentRoster('manager4', mockCurrentPicks);
      
      Object.values(roster).forEach(positionPlayers => {
        expect(positionPlayers).toHaveLength(0);
      });
    });

    it('should handle picks without metadata', () => {
      const picksWithoutMetadata = [
        {
          pick_no: 1,
          round: 1,
          picked_by: 'manager1',
          player_id: 'player1',
          position: 'QB'
        }
      ];
      
      const roster = analyzer.buildCurrentRoster('manager1', picksWithoutMetadata);
      expect(roster.QB).toHaveLength(1);
      expect(roster.QB[0].name).toBe('player1');
    });
  });

  describe('calculateRosterNeeds', () => {
    it('should calculate needs for empty roster', () => {
      const emptyRoster = {
        QB: [], RB: [], WR: [], TE: [], FLEX: [], BENCH: []
      };
      
      const needs = analyzer.calculateRosterNeeds(emptyRoster);
      
      expect(needs.QB).toBe(1);
      expect(needs.RB).toBe(2);
      expect(needs.WR).toBe(2);
      expect(needs.TE).toBe(1);
      expect(needs.FLEX).toBe(1);
      expect(needs.BENCH).toBe(6);
    });

    it('should calculate needs for partially filled roster', () => {
      const partialRoster = {
        QB: [{ name: 'Josh Allen', position: 'QB' }],
        RB: [{ name: 'CMC', position: 'RB' }],
        WR: [],
        TE: [],
        FLEX: [],
        BENCH: []
      };
      
      const needs = analyzer.calculateRosterNeeds(partialRoster);
      
      expect(needs.QB).toBe(0); // Filled
      expect(needs.RB).toBe(1); // Need 1 more
      expect(needs.WR).toBe(2); // Need 2
      expect(needs.TE).toBe(1); // Need 1
      expect(needs.FLEX).toBe(1); // Need 1
      expect(needs.BENCH).toBe(6); // Need 6
    });

    it('should handle FLEX eligibility correctly', () => {
      const rosterWithOverfill = {
        QB: [],
        RB: [
          { name: 'RB1', position: 'RB' },
          { name: 'RB2', position: 'RB' },
          { name: 'RB3', position: 'RB' } // Overfilled by 1
        ],
        WR: [
          { name: 'WR1', position: 'WR' },
          { name: 'WR2', position: 'WR' },
          { name: 'WR3', position: 'WR' } // Overfilled by 1
        ],
        TE: [],
        FLEX: [],
        BENCH: []
      };
      
      const needs = analyzer.calculateRosterNeeds(rosterWithOverfill);
      
      // FLEX need should be reduced by overfill (2 overfilled positions)
      expect(needs.FLEX).toBe(0); // 1 - 2 overfill = 0 (max with 0)
    });
  });

  describe('calculatePositionUrgency', () => {
    it('should calculate urgency levels correctly', () => {
      const needs = { QB: 1, RB: 2, WR: 1, TE: 0, FLEX: 1, BENCH: 6 };
      const manager = { user_id: 'manager1' };
      const draftSettings = { ...mockDraftSettings, rounds: 13, total_slots: 12 };
      
      const urgency = analyzer.calculatePositionUrgency(needs, manager, draftSettings);
      
      expect(urgency.TE).toBe('none'); // No need
      expect(urgency.QB).toBeDefined();
      expect(urgency.RB).toBeDefined();
      expect(['critical', 'high', 'medium', 'low', 'none']).toContain(urgency.QB);
    });

    it('should mark positions as critical when needs exceed remaining rounds', () => {
      const needs = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, BENCH: 10 }; // 17 total needs
      const manager = { user_id: 'manager1' };
      const draftSettings = { ...mockDraftSettings, rounds: 5, total_slots: 12 }; // Only 5 rounds
      
      const urgency = analyzer.calculatePositionUrgency(needs, manager, draftSettings);
      
      // With only ~4 remaining rounds and 17 needs, many should be critical
      expect(urgency.BENCH).toBe('critical');
    });
  });

  describe('inferDraftStrategy', () => {
    it('should infer rb-heavy strategy', () => {
      const rbHeavyPicks = [
        { picked_by: 'manager1', metadata: { position: 'RB' }, pick_no: 1 },
        { picked_by: 'manager1', metadata: { position: 'RB' }, pick_no: 2 },
        { picked_by: 'manager1', metadata: { position: 'RB' }, pick_no: 3 }
      ];
      
      const strategy = analyzer.inferDraftStrategy(rbHeavyPicks, 'manager1');
      expect(strategy).toBe('rb-heavy');
    });

    it('should infer wr-heavy strategy', () => {
      const wrHeavyPicks = [
        { picked_by: 'manager1', metadata: { position: 'WR' }, pick_no: 1 },
        { picked_by: 'manager1', metadata: { position: 'WR' }, pick_no: 2 },
        { picked_by: 'manager1', metadata: { position: 'WR' }, pick_no: 3 }
      ];
      
      const strategy = analyzer.inferDraftStrategy(wrHeavyPicks, 'manager1');
      expect(strategy).toBe('wr-heavy');
    });

    it('should infer zero-rb strategy', () => {
      const zeroRbPicks = [
        { picked_by: 'manager1', metadata: { position: 'WR' }, pick_no: 1 },
        { picked_by: 'manager1', metadata: { position: 'WR' }, pick_no: 2 },
        { picked_by: 'manager1', metadata: { position: 'QB' }, pick_no: 3 }
      ];
      
      const strategy = analyzer.inferDraftStrategy(zeroRbPicks, 'manager1');
      expect(strategy).toBe('zero-rb');
    });

    it('should infer balanced strategy', () => {
      const balancedPicks = [
        { picked_by: 'manager1', metadata: { position: 'RB' }, pick_no: 1 },
        { picked_by: 'manager1', metadata: { position: 'WR' }, pick_no: 2 }
      ];
      
      const strategy = analyzer.inferDraftStrategy(balancedPicks, 'manager1');
      expect(strategy).toBe('balanced');
    });

    it('should return unknown for insufficient picks', () => {
      const fewPicks = [
        { picked_by: 'manager1', metadata: { position: 'RB' }, pick_no: 1 }
      ];
      
      const strategy = analyzer.inferDraftStrategy(fewPicks, 'manager1');
      expect(strategy).toBe('unknown');
    });
  });

  describe('predictLikelyTargets', () => {
    it('should predict targets based on needs and urgency', () => {
      const needs = { QB: 1, RB: 1, WR: 2, TE: 1, FLEX: 0, BENCH: 3 };
      const urgency = { QB: 'high', RB: 'medium', WR: 'critical', TE: 'low', FLEX: 'none', BENCH: 'low' };
      const strategy = 'balanced';
      
      const targets = analyzer.predictLikelyTargets(needs, urgency, strategy);
      
      expect(targets).toHaveLength(3);
      expect(targets[0]).toHaveProperty('position');
      expect(targets[0]).toHaveProperty('need');
      expect(targets[0]).toHaveProperty('urgency');
      expect(targets[0]).toHaveProperty('priority');
      
      // Should prioritize critical urgency
      expect(targets.some(t => t.urgency === 'critical')).toBe(true);
    });

    it('should apply strategy-based prioritization', () => {
      const needs = { QB: 1, RB: 1, WR: 1, TE: 1, FLEX: 0, BENCH: 0 };
      const urgency = { QB: 'medium', RB: 'medium', WR: 'medium', TE: 'medium', FLEX: 'none', BENCH: 'none' };
      
      const rbHeavyTargets = analyzer.predictLikelyTargets(needs, urgency, 'rb-heavy');
      const wrHeavyTargets = analyzer.predictLikelyTargets(needs, urgency, 'wr-heavy');
      
      // RB-heavy should prioritize RB
      expect(rbHeavyTargets[0].position).toBe('RB');
      // WR-heavy should prioritize WR
      expect(wrHeavyTargets[0].position).toBe('WR');
    });
  });

  describe('predictPlayerAvailability', () => {
    it('should predict availability correctly', () => {
      const player = { position: 'RB', position_rank: 3 };
      const managerAnalysis = [
        {
          managerId: 'manager1',
          managerName: 'Manager 1',
          nextPick: 5,
          needs: { RB: 2 },
          urgency: { RB: 'high' },
          likelyTargets: [{ position: 'RB', priority: 'high' }]
        },
        {
          managerId: 'manager2',
          managerName: 'Manager 2',
          nextPick: 7,
          needs: { RB: 1 },
          urgency: { RB: 'medium' },
          likelyTargets: [{ position: 'WR', priority: 'high' }]
        }
      ];
      
      const availability = analyzer.predictPlayerAvailability(player, managerAnalysis, 10);
      
      expect(availability).toHaveProperty('probability');
      expect(availability).toHaveProperty('competingManagers');
      expect(availability).toHaveProperty('riskLevel');
      expect(availability).toHaveProperty('competitorDetails');
      
      expect(availability.probability).toBeGreaterThanOrEqual(0.1);
      expect(availability.probability).toBeLessThanOrEqual(0.9);
      expect(['low', 'medium', 'high']).toContain(availability.riskLevel);
    });

    it('should handle missing parameters gracefully', () => {
      const availability = analyzer.predictPlayerAvailability(null, null, null);
      
      expect(availability.probability).toBe(0.5);
      expect(availability.competingManagers).toBe(0);
      expect(availability.riskLevel).toBe('medium');
    });

    it('should adjust probability for player rank', () => {
      const topPlayer = { position: 'RB', position_rank: 1 };
      const midPlayer = { position: 'RB', position_rank: 15 };
      const managerAnalysis = [];
      
      const topAvailability = analyzer.predictPlayerAvailability(topPlayer, managerAnalysis, 10);
      const midAvailability = analyzer.predictPlayerAvailability(midPlayer, managerAnalysis, 10);
      
      // Top players should have lower availability
      expect(topAvailability.probability).toBeLessThan(midAvailability.probability);
    });
  });

  describe('calculatePositionCompetition', () => {
    it('should calculate competition correctly', () => {
      const managerAnalysis = [
        {
          managerName: 'Manager 1',
          needs: { RB: 2 },
          urgency: { RB: 'high' }
        },
        {
          managerName: 'Manager 2',
          needs: { RB: 1 },
          urgency: { RB: 'medium' }
        },
        {
          managerName: 'Manager 3',
          needs: { RB: 0 },
          urgency: { RB: 'none' }
        }
      ];
      
      const competition = analyzer.calculatePositionCompetition('RB', managerAnalysis);
      
      expect(competition.totalNeed).toBe(3); // 2 + 1 + 0
      expect(competition.managersNeedingPosition).toBe(2); // Only first two need RB
      expect(competition.averageUrgency).toBeDefined();
      expect(competition.competitionLevel).toBeDefined();
      expect(competition.managersWithNeed).toHaveLength(2);
    });

    it('should handle empty manager analysis', () => {
      const competition = analyzer.calculatePositionCompetition('RB', []);
      
      expect(competition.totalNeed).toBe(0);
      expect(competition.managersNeedingPosition).toBe(0);
      expect(competition.averageUrgency).toBe('low');
      expect(competition.competitionLevel).toBe('low');
    });

    it('should handle null manager analysis', () => {
      const competition = analyzer.calculatePositionCompetition('RB', null);
      
      expect(competition.totalNeed).toBe(0);
      expect(competition.managersNeedingPosition).toBe(0);
      expect(competition.averageUrgency).toBe('low');
      expect(competition.competitionLevel).toBe('low');
    });
  });

  describe('draft position and pick calculations', () => {
    it('should get draft position correctly', () => {
      const position1 = analyzer.getDraftPosition('manager1', mockDraftSettings);
      const position2 = analyzer.getDraftPosition('manager2', mockDraftSettings);
      const position3 = analyzer.getDraftPosition('manager3', mockDraftSettings);
      
      expect(position1).toBe(1);
      expect(position2).toBe(2);
      expect(position3).toBe(3);
    });

    it('should handle missing draft order', () => {
      const settingsWithoutOrder = { ...mockDraftSettings, draft_order: null };
      const position = analyzer.getDraftPosition('manager1', settingsWithoutOrder);
      
      expect(position).toBe(1); // Default
    });

    it('should calculate next pick correctly for snake draft', () => {
      // Manager 1 (position 1) in round 1 should pick at position 1
      const draftSettings = {
        draft_order: ['manager1', 'manager2', 'manager3'],
        pick_no: 1,
        total_slots: 3
      };
      
      const nextPick = analyzer.calculateNextPick('manager1', draftSettings);
      expect(nextPick).toBe(1);
    });

    it('should calculate next pick for even rounds (reverse order)', () => {
      // Manager 1 (position 1) in round 2 should pick at position 3 (reverse)
      const draftSettings = {
        draft_order: ['manager1', 'manager2', 'manager3'],
        pick_no: 4, // Start of round 2
        total_slots: 3
      };
      
      const nextPick = analyzer.calculateNextPick('manager1', draftSettings);
      expect(nextPick).toBe(6); // Round 2, position 3 (reverse of position 1)
    });
  });

  describe('configuration methods', () => {
    it('should update roster format', () => {
      const newFormat = { QB: 2, RB: 3 };
      analyzer.updateRosterFormat(newFormat);
      
      expect(analyzer.rosterFormat.QB).toBe(2);
      expect(analyzer.rosterFormat.RB).toBe(3);
      expect(analyzer.rosterFormat.WR).toBe(2); // Should preserve other values
    });

    it('should get roster format', () => {
      const format = analyzer.getRosterFormat();
      
      expect(format).toEqual(analyzer.rosterFormat);
      expect(format).not.toBe(analyzer.rosterFormat); // Should be a copy
    });
  });
});