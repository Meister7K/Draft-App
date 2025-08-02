import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SleeperAPIConnector } from '../SleeperAPIConnector.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('SleeperAPIConnector', () => {
  let connector;
  const mockLeagueId = '123456789';

  beforeEach(() => {
    connector = new SleeperAPIConnector(mockLeagueId);
    vi.clearAllMocks();
  });

  afterEach(() => {
    connector.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(connector.leagueId).toBe(mockLeagueId);
      expect(connector.baseURL).toBe('https://api.sleeper.app/v1');
      expect(connector.pollInterval).toBe(5000);
      expect(connector.maxRetries).toBe(3);
      expect(connector.isPolling).toBe(false);
    });
  });

  describe('makeAPIRequest', () => {
    it('should make successful API request', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ data: 'test' }) };
      fetch.mockResolvedValue(mockResponse);

      const response = await connector.makeAPIRequest('/test');
      
      expect(fetch).toHaveBeenCalledWith(
        'https://api.sleeper.app/v1/test',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(response).toBe(mockResponse);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockError = new Error('Network error');
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ data: 'test' }) };
      
      fetch
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValue(mockResponse);

      const response = await connector.makeAPIRequest('/test');
      
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(response).toBe(mockResponse);
    });

    it('should throw error after max retries', async () => {
      const mockError = new Error('Network error');
      fetch.mockRejectedValue(mockError);

      await expect(connector.makeAPIRequest('/test')).rejects.toThrow('Network error');
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = { ok: false, status: 404, statusText: 'Not Found' };
      fetch.mockResolvedValue(mockResponse);

      await expect(connector.makeAPIRequest('/test')).rejects.toThrow('HTTP 404: Not Found');
    });
  });

  describe('getDraftData', () => {
    it('should return draft data for active draft', async () => {
      const mockDrafts = [
        { draft_id: 'draft1', status: 'drafting', draft_order: ['user1', 'user2'], settings: { rounds: 15, teams: 12 } }
      ];
      const mockPicks = [
        { pick_no: 1, user_id: 'user1', player_id: 'player1' },
        { pick_no: 2, user_id: 'user2', player_id: 'player2' }
      ];

      fetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(mockDrafts) })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(mockPicks) });

      const result = await connector.getDraftData();

      expect(result).toEqual({
        draftId: 'draft1',
        status: 'drafting',
        picks: mockPicks,
        currentPick: 3,
        totalPicks: 180,
        draftOrder: ['user1', 'user2'],
        settings: { rounds: 15, teams: 12 },
        lastUpdated: expect.any(Date)
      });
    });

    it('should return null when no drafts exist', async () => {
      fetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([]) });

      const result = await connector.getDraftData();
      expect(result).toBeNull();
    });

    it('should return cached state on error', async () => {
      const cachedState = { draftId: 'cached', status: 'drafting' };
      connector.lastKnownState = cachedState;
      
      fetch.mockRejectedValue(new Error('API Error'));

      const result = await connector.getDraftData();
      expect(result).toBe(cachedState);
    });
  });

  describe('getDraftPicks', () => {
    it('should return sorted draft picks', async () => {
      const mockPicks = [
        { pick_no: 3, user_id: 'user3', player_id: 'player3' },
        { pick_no: 1, user_id: 'user1', player_id: 'player1' },
        { pick_no: 2, user_id: 'user2', player_id: 'player2' }
      ];

      fetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(mockPicks) });

      const result = await connector.getDraftPicks('draft123');

      expect(result).toEqual([
        { pick_no: 1, user_id: 'user1', player_id: 'player1' },
        { pick_no: 2, user_id: 'user2', player_id: 'player2' },
        { pick_no: 3, user_id: 'user3', player_id: 'player3' }
      ]);
    });

    it('should return empty array on error', async () => {
      fetch.mockRejectedValue(new Error('API Error'));

      const result = await connector.getDraftPicks('draft123');
      expect(result).toEqual([]);
    });
  });

  describe('getLeagueInfo', () => {
    it('should return formatted league information', async () => {
      const mockLeague = {
        league_id: '123',
        name: 'Test League',
        total_rosters: 12,
        roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'],
        settings: { playoff_teams: 6 },
        scoring_settings: { pass_td: 4 },
        season: '2024'
      };

      fetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(mockLeague) });

      const result = await connector.getLeagueInfo();

      expect(result).toEqual({
        leagueId: '123',
        name: 'Test League',
        totalTeams: 12,
        rosterPositions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'],
        settings: { playoff_teams: 6 },
        scoringSettings: { pass_td: 4 },
        season: '2024'
      });
    });
  });

  describe('getLeagueUsers', () => {
    it('should return formatted user information', async () => {
      const mockUsers = [
        { user_id: 'user1', username: 'testuser1', display_name: 'Test User 1', avatar: 'avatar1' },
        { user_id: 'user2', username: 'testuser2', display_name: 'Test User 2', avatar: 'avatar2' }
      ];

      fetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(mockUsers) });

      const result = await connector.getLeagueUsers();

      expect(result).toEqual([
        { userId: 'user1', username: 'testuser1', displayName: 'Test User 1', avatar: 'avatar1' },
        { userId: 'user2', username: 'testuser2', displayName: 'Test User 2', avatar: 'avatar2' }
      ]);
    });
  });

  describe('live updates', () => {
    it('should start and stop polling', async () => {
      const callback = vi.fn();

      fetch.mockResolvedValue({ 
        ok: true, 
        json: vi.fn().mockResolvedValue([{ draft_id: 'test', status: 'drafting', draft_order: [] }])
      });

      connector.startLiveUpdates(callback);
      expect(connector.isPolling).toBe(true);

      connector.stopLiveUpdates();
      expect(connector.isPolling).toBe(false);
    });

    it('should detect data changes', () => {
      const oldData = { picks: [1, 2], status: 'drafting', currentPick: 3 };
      const newData = { picks: [1, 2, 3], status: 'drafting', currentPick: 4 };

      connector.lastKnownState = oldData;
      expect(connector.hasDataChanged(newData)).toBe(true);

      connector.lastKnownState = newData;
      expect(connector.hasDataChanged(newData)).toBe(false);
    });
  });

  describe('callback management', () => {
    it('should manage update callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      connector.addUpdateCallback(callback1);
      connector.addUpdateCallback(callback2);
      expect(connector.updateCallbacks).toHaveLength(2);

      connector.removeUpdateCallback(callback1);
      expect(connector.updateCallbacks).toHaveLength(1);
      expect(connector.updateCallbacks[0]).toBe(callback2);
    });

    it('should manage error callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      connector.addErrorCallback(callback1);
      connector.addErrorCallback(callback2);
      expect(connector.errorCallbacks).toHaveLength(2);

      connector.removeErrorCallback(callback1);
      expect(connector.errorCallbacks).toHaveLength(1);
      expect(connector.errorCallbacks[0]).toBe(callback2);
    });

    it('should notify error callbacks on error', () => {
      const errorCallback = vi.fn();
      connector.addErrorCallback(errorCallback);

      const error = new Error('Test error');
      connector.handleError('testOperation', error);

      expect(errorCallback).toHaveBeenCalledWith({
        operation: 'testOperation',
        error: 'Test error',
        timestamp: expect.any(Date),
        leagueId: mockLeagueId
      });
    });
  });

  describe('utility methods', () => {
    it('should return correct status', () => {
      const status = connector.getStatus();
      expect(status).toEqual({
        isPolling: false,
        leagueId: mockLeagueId,
        hasLastKnownState: false,
        updateCallbackCount: 0,
        errorCallbackCount: 0
      });
    });

    it('should cleanup properly', () => {
      const callback = vi.fn();
      connector.addUpdateCallback(callback);
      connector.addErrorCallback(callback);
      connector.lastKnownState = { test: 'data' };

      connector.cleanup();

      expect(connector.updateCallbacks).toHaveLength(0);
      expect(connector.errorCallbacks).toHaveLength(0);
      expect(connector.lastKnownState).toBeNull();
      expect(connector.isPolling).toBe(false);
    });

    it('should sleep for specified duration', async () => {
      vi.useFakeTimers();
      const sleepPromise = connector.sleep(100);
      vi.advanceTimersByTime(100);
      await sleepPromise;
      vi.useRealTimers();
      // If we get here without timeout, the sleep function works
      expect(true).toBe(true);
    });
  });
});