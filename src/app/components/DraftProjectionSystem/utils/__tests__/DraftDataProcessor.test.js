import { describe, it, expect, beforeEach } from 'vitest';
import {
  processDraftData,
  processPicksData,
  processManagersData,
  buildCurrentRoster,
  calculateRosterNeeds,
  calculateNextPick,
  mapDraftStatus,
  calculateCurrentRound,
  processDraftSettings,
  createUserMap,
  createPlayerMap,
  detectDraftChanges,
  validateDraftData,
  createDraftSnapshot
} from '../DraftDataProcessor.js';

describe('DraftDataProcessor', () => {
  let mockSleeperData;
  let mockLeagueUsers;
  let mockPlayerDatabase;

  beforeEach(() => {
    mockSleeperData = {
      draftId: 'draft123',
      status: 'drafting',
      currentPick: 3,
      totalPicks: 180,
      picks: [
        {
          pick_no: 1,
          round: 1,
          draft_slot: 1,
          picked_by: 'user1',
          player_id: 'player1',
          picked_at: '2024-08-01T10:00:00Z'
        },
        {
          pick_no: 2,
          round: 1,
          draft_slot: 2,
          picked_by: 'user2',
          player_id: 'player2',
          picked_at: '2024-08-01T10:01:00Z'
        }
      ],
      draftOrder: ['user1', 'user2', 'user3'],
      settings: {
        rounds: 15,
        teams: 3,
        pick_timer: 90,
        type: 'snake'
      },
      lastUpdated: new Date('2024-08-01T10:02:00Z')
    };

    mockLeagueUsers = [
      {
        userId: 'user1',
        username: 'testuser1',
        displayName: 'Test User 1',
        avatar: 'avatar1'
      },
      {
        userId: 'user2',
        username: 'testuser2',
        displayName: 'Test User 2',
        avatar: 'avatar2'
      },
      {
        userId: 'user3',
        username: 'testuser3',
        displayName: 'Test User 3',
        avatar: 'avatar3'
      }
    ];

    mockPlayerDatabase = [
      {
        sleeper_id: 'player1',
        name: 'Player One',
        position: 'QB',
        team: 'KC',
        projected_2025_points: 300
      },
      {
        sleeper_id: 'player2',
        name: 'Player Two',
        position: 'RB',
        team: 'SF',
        projected_2025_points: 250
      }
    ];
  });

  describe('processDraftData', () => {
    it('should process complete draft data correctly', () => {
      const result = processDraftData(mockSleeperData, mockLeagueUsers, mockPlayerDatabase);

      expect(result).toEqual({
        draftId: 'draft123',
        status: 'IN_PROGRESS',
        currentPick: 3,
        totalPicks: 180,
        currentRound: 1,
        picks: expect.any(Array),
        managers: expect.any(Array),
        draftOrder: ['user1', 'user2', 'user3'],
        settings: expect.any(Object),
        lastUpdated: expect.any(Date),
        metadata: {
          totalRounds: 15,
          totalTeams: 3,
          pickTimeLimit: 90
        }
      });
    });

    it('should return null for null input', () => {
      const result = processDraftData(null);
      expect(result).toBeNull();
    });

    it('should handle missing optional parameters', () => {
      const result = processDraftData(mockSleeperData);
      expect(result).toBeDefined();
      expect(result.picks).toHaveLength(2);
    });
  });

  describe('processPicksData', () => {
    it('should process picks with user and player mapping', () => {
      const userMap = createUserMap(mockLeagueUsers);
      const playerMap = createPlayerMap(mockPlayerDatabase);
      
      const result = processPicksData(mockSleeperData.picks, userMap, playerMap);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        pickNumber: 1,
        round: 1,
        pickInRound: 1,
        managerId: 'user1',
        managerName: 'Test User 1',
        playerId: 'player1',
        playerInfo: {
          name: 'Player One',
          position: 'QB',
          team: 'KC',
          projectedPoints: 300
        },
        timestamp: expect.any(Date),
        metadata: {}
      });
    });

    it('should handle missing player information', () => {
      const userMap = createUserMap(mockLeagueUsers);
      const playerMap = {};
      
      const result = processPicksData(mockSleeperData.picks, userMap, playerMap);

      expect(result[0].playerInfo).toEqual({
        name: 'Unknown Player',
        position: 'UNKNOWN',
        team: 'UNKNOWN'
      });
    });

    it('should handle empty picks array', () => {
      const result = processPicksData([]);
      expect(result).toEqual([]);
    });
  });

  describe('processManagersData', () => {
    it('should process managers with roster state', () => {
      const userMap = createUserMap(mockLeagueUsers);
      const processedPicks = processPicksData(mockSleeperData.picks, userMap, createPlayerMap(mockPlayerDatabase));
      
      const result = processManagersData(mockSleeperData.draftOrder, userMap, processedPicks);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        managerId: 'user1',
        managerName: 'Test User 1',
        username: 'testuser1',
        avatar: 'avatar1',
        draftPosition: 1,
        totalPicks: 1,
        currentRoster: expect.any(Object),
        rosterNeeds: expect.any(Object),
        nextPickNumber: expect.any(Number),
        pickHistory: expect.any(Array)
      });
    });

    it('should handle managers with no picks', () => {
      const userMap = createUserMap(mockLeagueUsers);
      
      const result = processManagersData(['user3'], userMap, []);

      expect(result[0].totalPicks).toBe(0);
      expect(result[0].pickHistory).toEqual([]);
    });
  });

  describe('buildCurrentRoster', () => {
    it('should organize picks by position', () => {
      const picks = [
        {
          playerId: 'player1',
          playerInfo: { name: 'QB Player', position: 'QB', team: 'KC' },
          pickNumber: 1,
          round: 1
        },
        {
          playerId: 'player2',
          playerInfo: { name: 'RB Player', position: 'RB', team: 'SF' },
          pickNumber: 2,
          round: 1
        }
      ];

      const result = buildCurrentRoster(picks);

      expect(result.QB).toHaveLength(1);
      expect(result.RB).toHaveLength(1);
      expect(result.QB[0]).toEqual({
        playerId: 'player1',
        playerName: 'QB Player',
        position: 'QB',
        team: 'KC',
        pickNumber: 1,
        round: 1
      });
    });

    it('should handle unknown positions by putting on bench', () => {
      const picks = [
        {
          playerId: 'player1',
          playerInfo: { name: 'Unknown Player', position: 'UNKNOWN', team: 'UNK' },
          pickNumber: 1,
          round: 1
        }
      ];

      const result = buildCurrentRoster(picks);

      expect(result.BENCH).toHaveLength(1);
      expect(result.BENCH[0].position).toBe('UNKNOWN');
    });

    it('should handle empty picks array', () => {
      const result = buildCurrentRoster([]);
      
      Object.values(result).forEach(positionArray => {
        expect(positionArray).toHaveLength(0);
      });
    });
  });

  describe('calculateRosterNeeds', () => {
    it('should calculate needs based on default format', () => {
      const roster = {
        QB: [{ playerId: 'qb1' }],
        RB: [{ playerId: 'rb1' }],
        WR: [],
        TE: [],
        K: [],
        DEF: [],
        FLEX: [],
        BENCH: []
      };

      const result = calculateRosterNeeds(roster);

      expect(result).toEqual({
        QB: 0, // Has 1, needs 1
        RB: 1, // Has 1, needs 2
        WR: 2, // Has 0, needs 2
        TE: 1, // Has 0, needs 1
        FLEX: 1,
        K: 1,
        DEF: 1,
        BENCH: 6
      });
    });

    it('should use custom roster format when provided', () => {
      const roster = { QB: [], RB: [], WR: [] };
      const customFormat = { QB: 2, RB: 3, WR: 4 };

      const result = calculateRosterNeeds(roster, customFormat);

      expect(result).toEqual({
        QB: 2,
        RB: 3,
        WR: 4
      });
    });

    it('should not return negative needs', () => {
      const roster = {
        QB: [{ playerId: 'qb1' }, { playerId: 'qb2' }], // More than needed
        RB: [],
        WR: [],
        TE: [],
        K: [],
        DEF: [],
        FLEX: [],
        BENCH: []
      };

      const result = calculateRosterNeeds(roster);

      expect(result.QB).toBe(0); // Should not be negative
    });
  });

  describe('calculateNextPick', () => {
    it('should calculate next pick for snake draft', () => {
      const draftOrder = ['user1', 'user2', 'user3'];
      
      // Round 1, pick 1 made (user1 picked)
      const nextPick = calculateNextPick('user2', draftOrder, 1);
      expect(nextPick).toBe(2);
    });

    it('should handle reverse order in even rounds', () => {
      const draftOrder = ['user1', 'user2', 'user3'];
      
      // Round 2 (even), user1 should pick 6th overall (3rd in round 2)
      const nextPick = calculateNextPick('user1', draftOrder, 3);
      expect(nextPick).toBe(6);
    });

    it('should return null for invalid manager', () => {
      const draftOrder = ['user1', 'user2', 'user3'];
      
      const nextPick = calculateNextPick('invalid_user', draftOrder, 1);
      expect(nextPick).toBeNull();
    });
  });

  describe('mapDraftStatus', () => {
    it('should map Sleeper statuses to internal statuses', () => {
      expect(mapDraftStatus('pre_draft')).toBe('PRE_DRAFT');
      expect(mapDraftStatus('drafting')).toBe('IN_PROGRESS');
      expect(mapDraftStatus('complete')).toBe('COMPLETED');
      expect(mapDraftStatus('paused')).toBe('PAUSED');
      expect(mapDraftStatus('unknown')).toBe('UNKNOWN');
    });
  });

  describe('calculateCurrentRound', () => {
    it('should calculate round correctly', () => {
      expect(calculateCurrentRound(1, { teams: 12 })).toBe(1);
      expect(calculateCurrentRound(12, { teams: 12 })).toBe(1);
      expect(calculateCurrentRound(13, { teams: 12 })).toBe(2);
      expect(calculateCurrentRound(24, { teams: 12 })).toBe(2);
      expect(calculateCurrentRound(25, { teams: 12 })).toBe(3);
    });

    it('should handle missing settings', () => {
      expect(calculateCurrentRound(13, {})).toBe(2); // Uses default 12 teams
    });
  });

  describe('processDraftSettings', () => {
    it('should process settings with defaults', () => {
      const settings = {
        rounds: 16,
        teams: 10,
        pick_timer: 120,
        type: 'linear'
      };

      const result = processDraftSettings(settings);

      expect(result).toEqual({
        rounds: 16,
        teams: 10,
        pickTimer: 120,
        type: 'linear',
        reversal: null,
        alpha_sort: false
      });
    });

    it('should use defaults for missing settings', () => {
      const result = processDraftSettings({});

      expect(result).toEqual({
        rounds: 15,
        teams: 12,
        pickTimer: 90,
        type: 'snake',
        reversal: null,
        alpha_sort: false
      });
    });
  });

  describe('createUserMap', () => {
    it('should create user ID to info mapping', () => {
      const result = createUserMap(mockLeagueUsers);

      expect(result).toEqual({
        user1: {
          displayName: 'Test User 1',
          username: 'testuser1',
          avatar: 'avatar1'
        },
        user2: {
          displayName: 'Test User 2',
          username: 'testuser2',
          avatar: 'avatar2'
        },
        user3: {
          displayName: 'Test User 3',
          username: 'testuser3',
          avatar: 'avatar3'
        }
      });
    });

    it('should handle empty users array', () => {
      const result = createUserMap([]);
      expect(result).toEqual({});
    });
  });

  describe('createPlayerMap', () => {
    it('should create player ID to info mapping', () => {
      const result = createPlayerMap(mockPlayerDatabase);

      expect(result).toEqual({
        player1: {
          name: 'Player One',
          position: 'QB',
          team: 'KC',
          projectedPoints: 300
        },
        player2: {
          name: 'Player Two',
          position: 'RB',
          team: 'SF',
          projectedPoints: 250
        }
      });
    });

    it('should handle different ID field names', () => {
      const players = [
        { player_id: 'p1', name: 'Player 1', position: 'QB', team: 'KC' },
        { id: 'p2', name: 'Player 2', position: 'RB', team: 'SF' }
      ];

      const result = createPlayerMap(players);

      expect(result.p1).toBeDefined();
      expect(result.p2).toBeDefined();
    });

    it('should skip players without valid IDs', () => {
      const players = [
        { name: 'Player Without ID', position: 'QB', team: 'KC' }
      ];

      const result = createPlayerMap(players);
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('detectDraftChanges', () => {
    it('should detect new picks', () => {
      const oldState = {
        status: 'IN_PROGRESS',
        picks: [{ pickNumber: 1 }]
      };
      const newState = {
        status: 'IN_PROGRESS',
        picks: [{ pickNumber: 1 }, { pickNumber: 2 }]
      };

      const result = detectDraftChanges(oldState, newState);

      expect(result).toEqual({
        hasChanges: true,
        newPicks: [{ pickNumber: 2 }],
        statusChanged: false,
        pickCountChanged: true,
        oldPickCount: 1,
        newPickCount: 2
      });
    });

    it('should detect status changes', () => {
      const oldState = {
        status: 'IN_PROGRESS',
        picks: [{ pickNumber: 1 }]
      };
      const newState = {
        status: 'COMPLETED',
        picks: [{ pickNumber: 1 }]
      };

      const result = detectDraftChanges(oldState, newState);

      expect(result.hasChanges).toBe(true);
      expect(result.statusChanged).toBe(true);
      expect(result.pickCountChanged).toBe(false);
    });

    it('should handle null old state', () => {
      const newState = {
        status: 'IN_PROGRESS',
        picks: [{ pickNumber: 1 }]
      };

      const result = detectDraftChanges(null, newState);

      expect(result.hasChanges).toBe(true);
      expect(result.newPicks).toEqual([{ pickNumber: 1 }]);
    });
  });

  describe('validateDraftData', () => {
    it('should validate complete draft data', () => {
      const validData = {
        draftId: 'draft123',
        status: 'IN_PROGRESS',
        picks: [],
        managers: [{ managerId: 'user1', managerName: 'User 1' }]
      };

      const result = validateDraftData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidData = {
        // Missing draftId, status, picks, managers
      };

      const result = validateDraftData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing draft ID');
      expect(result.errors).toContain('Missing draft status');
      expect(result.errors).toContain('Picks must be an array');
      expect(result.errors).toContain('Managers must be an array');
    });

    it('should detect inconsistent pick count', () => {
      const inconsistentData = {
        draftId: 'draft123',
        status: 'IN_PROGRESS',
        currentPick: 5,
        picks: [{ pickNumber: 1 }, { pickNumber: 2 }], // Length 2, but currentPick is 5
        managers: []
      };

      const result = validateDraftData(inconsistentData);

      expect(result.warnings).toContain('Current pick number may be inconsistent with picks array length');
    });

    it('should handle null input', () => {
      const result = validateDraftData(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Draft data is null or undefined');
    });
  });

  describe('createDraftSnapshot', () => {
    it('should create snapshot with key information', () => {
      const draftData = {
        draftId: 'draft123',
        status: 'IN_PROGRESS',
        currentPick: 3,
        totalPicks: 180,
        picks: [
          { timestamp: new Date('2024-08-01T10:00:00Z') },
          { timestamp: new Date('2024-08-01T10:01:00Z') }
        ]
      };

      const result = createDraftSnapshot(draftData);

      expect(result).toEqual({
        draftId: 'draft123',
        status: 'IN_PROGRESS',
        currentPick: 3,
        totalPicks: 180,
        pickCount: 2,
        lastPickTimestamp: new Date('2024-08-01T10:01:00Z'),
        snapshotTime: expect.any(Date)
      });
    });

    it('should handle empty picks array', () => {
      const draftData = {
        draftId: 'draft123',
        status: 'PRE_DRAFT',
        currentPick: 1,
        totalPicks: 180,
        picks: []
      };

      const result = createDraftSnapshot(draftData);

      expect(result.pickCount).toBe(0);
      expect(result.lastPickTimestamp).toBeNull();
    });

    it('should return null for null input', () => {
      const result = createDraftSnapshot(null);
      expect(result).toBeNull();
    });
  });
});