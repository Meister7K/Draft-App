import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DraftStateManager } from '../DraftStateManager.js';

// Mock the SleeperAPIConnector
vi.mock('../../ActualDraftEvaluator/SleeperAPIConnector.js', () => ({
  SleeperAPIConnector: vi.fn().mockImplementation(() => ({
    addUpdateCallback: vi.fn(),
    addErrorCallback: vi.fn(),
    removeUpdateCallback: vi.fn(),
    removeErrorCallback: vi.fn(),
    getDraftData: vi.fn(),
    startLiveUpdates: vi.fn(),
    stopLiveUpdates: vi.fn(),
    cleanup: vi.fn(),
    isPolling: false
  }))
}));

// Mock the DraftDataProcessor functions
vi.mock('../DraftDataProcessor.js', () => ({
  processDraftData: vi.fn(),
  detectDraftChanges: vi.fn(),
  validateDraftData: vi.fn(),
  createDraftSnapshot: vi.fn()
}));

import { SleeperAPIConnector } from '../../ActualDraftEvaluator/SleeperAPIConnector.js';
import { 
  processDraftData, 
  detectDraftChanges, 
  validateDraftData, 
  createDraftSnapshot 
} from '../DraftDataProcessor.js';

describe('DraftStateManager', () => {
  let stateManager;
  let mockAPIConnector;
  const mockLeagueId = 'league123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock API connector instance
    mockAPIConnector = {
      addUpdateCallback: vi.fn(),
      addErrorCallback: vi.fn(),
      removeUpdateCallback: vi.fn(),
      removeErrorCallback: vi.fn(),
      getDraftData: vi.fn(),
      startLiveUpdates: vi.fn(),
      stopLiveUpdates: vi.fn(),
      cleanup: vi.fn(),
      isPolling: false
    };
    
    SleeperAPIConnector.mockImplementation(() => mockAPIConnector);
    
    stateManager = new DraftStateManager(mockLeagueId);
  });

  afterEach(() => {
    stateManager.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(stateManager.leagueId).toBe(mockLeagueId);
      expect(stateManager.currentState).toBeNull();
      expect(stateManager.previousState).toBeNull();
      expect(stateManager.stateHistory).toEqual([]);
      expect(stateManager.options.autoSync).toBe(true);
      expect(stateManager.options.syncInterval).toBe(5000);
    });

    it('should accept custom options', () => {
      const customOptions = {
        autoSync: false,
        syncInterval: 10000,
        maxRetries: 5
      };
      
      const customManager = new DraftStateManager(mockLeagueId, customOptions);
      
      expect(customManager.options.autoSync).toBe(false);
      expect(customManager.options.syncInterval).toBe(10000);
      expect(customManager.options.maxRetries).toBe(5);
      
      customManager.cleanup();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid data', async () => {
      const mockLeagueUsers = [{ userId: 'user1', displayName: 'User 1' }];
      const mockPlayerDatabase = [{ id: 'player1', name: 'Player 1' }];
      const mockRawData = { draftId: 'draft1', status: 'drafting' };
      const mockProcessedData = { draftId: 'draft1', status: 'IN_PROGRESS', picks: [] };
      
      mockAPIConnector.getDraftData.mockResolvedValue(mockRawData);
      processDraftData.mockReturnValue(mockProcessedData);
      validateDraftData.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      detectDraftChanges.mockReturnValue({ hasChanges: true, newPicks: [] });
      createDraftSnapshot.mockReturnValue({ draftId: 'draft1', pickCount: 0 });
      
      const result = await stateManager.initialize(mockLeagueUsers, mockPlayerDatabase);
      
      expect(stateManager.leagueUsers).toBe(mockLeagueUsers);
      expect(stateManager.playerDatabase).toBe(mockPlayerDatabase);
      expect(mockAPIConnector.addUpdateCallback).toHaveBeenCalled();
      expect(mockAPIConnector.addErrorCallback).toHaveBeenCalled();
      expect(result).toBe(mockProcessedData);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('API Error');
      mockAPIConnector.getDraftData.mockRejectedValue(error);
      
      await expect(stateManager.initialize()).rejects.toThrow('API Error');
    });
  });

  describe('syncState', () => {
    it('should sync state successfully', async () => {
      const mockRawData = { draftId: 'draft1', status: 'drafting' };
      const mockProcessedData = { draftId: 'draft1', status: 'IN_PROGRESS', picks: [] };
      
      mockAPIConnector.getDraftData.mockResolvedValue(mockRawData);
      processDraftData.mockReturnValue(mockProcessedData);
      validateDraftData.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      detectDraftChanges.mockReturnValue({ hasChanges: true, newPicks: [] });
      
      const result = await stateManager.syncState();
      
      expect(mockAPIConnector.getDraftData).toHaveBeenCalled();
      expect(processDraftData).toHaveBeenCalledWith(mockRawData, [], []);
      expect(stateManager.currentState).toBe(mockProcessedData);
      expect(result).toBe(mockProcessedData);
    });

    it('should return null when no draft data available', async () => {
      mockAPIConnector.getDraftData.mockResolvedValue(null);
      
      const result = await stateManager.syncState();
      
      expect(result).toBeNull();
    });

    it('should handle invalid data', async () => {
      const mockRawData = { draftId: 'draft1' };
      const mockProcessedData = { draftId: 'draft1' };
      
      mockAPIConnector.getDraftData.mockResolvedValue(mockRawData);
      processDraftData.mockReturnValue(mockProcessedData);
      validateDraftData.mockReturnValue({ 
        isValid: false, 
        errors: ['Missing required field'], 
        warnings: [] 
      });
      
      await expect(stateManager.syncState()).rejects.toThrow('Invalid draft data');
    });

    it('should prevent concurrent syncs', async () => {
      const mockRawData = { draftId: 'draft1', status: 'drafting' };
      const mockProcessedData = { draftId: 'draft1', status: 'IN_PROGRESS', picks: [] };
      
      mockAPIConnector.getDraftData.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockRawData), 100))
      );
      processDraftData.mockReturnValue(mockProcessedData);
      validateDraftData.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      detectDraftChanges.mockReturnValue({ hasChanges: true, newPicks: [] });
      createDraftSnapshot.mockReturnValue({ draftId: 'draft1', pickCount: 0 });
      
      // Start first sync
      const firstSync = stateManager.syncState();
      
      // Start second sync immediately - should return current state (null initially)
      const secondSync = stateManager.syncState();
      
      const [firstResult, secondResult] = await Promise.all([firstSync, secondSync]);
      
      // First sync should complete successfully
      expect(firstResult).toBe(mockProcessedData);
      // Second sync should return current state (which was null when it started)
      expect(secondResult).toBeNull(); // Returns null because sync was in progress
      expect(mockAPIConnector.getDraftData).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateState', () => {
    it('should update state and detect changes', () => {
      const oldState = { draftId: 'draft1', picks: [] };
      const newState = { draftId: 'draft1', picks: [{ pickNumber: 1 }] };
      const mockChanges = { hasChanges: true, newPicks: [{ pickNumber: 1 }] };
      const mockSnapshot = { draftId: 'draft1', pickCount: 1 };
      
      stateManager.currentState = oldState;
      detectDraftChanges.mockReturnValue(mockChanges);
      createDraftSnapshot.mockReturnValue(mockSnapshot);
      
      const stateChangeCallback = vi.fn();
      stateManager.onStateChange(stateChangeCallback);
      
      stateManager.updateState(newState);
      
      expect(stateManager.previousState).toBe(oldState);
      expect(stateManager.currentState).toBe(newState);
      expect(stateManager.stateHistory).toContain(mockSnapshot);
      expect(stateChangeCallback).toHaveBeenCalledWith({
        newState,
        previousState: oldState,
        changes: mockChanges
      });
    });

    it('should not notify callbacks when no changes detected', () => {
      const state = { draftId: 'draft1', picks: [] };
      const mockChanges = { hasChanges: false };
      
      detectDraftChanges.mockReturnValue(mockChanges);
      
      const stateChangeCallback = vi.fn();
      stateManager.onStateChange(stateChangeCallback);
      
      stateManager.updateState(state);
      
      expect(stateChangeCallback).not.toHaveBeenCalled();
    });
  });

  describe('auto sync', () => {
    it('should start auto sync when enabled', () => {
      stateManager.startAutoSync();
      
      expect(mockAPIConnector.startLiveUpdates).toHaveBeenCalledWith(stateManager.handleAPIUpdate);
    });

    it('should stop auto sync', () => {
      stateManager.stopAutoSync();
      
      expect(mockAPIConnector.stopLiveUpdates).toHaveBeenCalled();
    });
  });

  describe('handleAPIUpdate', () => {
    it('should process API updates', async () => {
      const mockRawData = { draftId: 'draft1', status: 'drafting' };
      const mockProcessedData = { draftId: 'draft1', status: 'IN_PROGRESS', picks: [] };
      
      stateManager.leagueUsers = [];
      stateManager.playerDatabase = [];
      
      processDraftData.mockReturnValue(mockProcessedData);
      validateDraftData.mockReturnValue({ isValid: true, errors: [], warnings: [] });
      detectDraftChanges.mockReturnValue({ hasChanges: true });
      
      await stateManager.handleAPIUpdate(mockRawData);
      
      expect(processDraftData).toHaveBeenCalledWith(mockRawData, [], []);
      expect(stateManager.currentState).toBe(mockProcessedData);
    });

    it('should handle invalid API updates', async () => {
      const mockRawData = { draftId: 'draft1' };
      const mockProcessedData = { draftId: 'draft1' };
      
      processDraftData.mockReturnValue(mockProcessedData);
      validateDraftData.mockReturnValue({ 
        isValid: false, 
        errors: ['Invalid data'], 
        warnings: [] 
      });
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await stateManager.handleAPIUpdate(mockRawData);
      
      expect(consoleSpy).toHaveBeenCalledWith('Received invalid draft data from API:', ['Invalid data']);
      expect(stateManager.currentState).toBeNull();
      
      consoleSpy.mockRestore();
    });
  });

  describe('data access methods', () => {
    beforeEach(() => {
      stateManager.currentState = {
        draftId: 'draft1',
        status: 'IN_PROGRESS',
        currentPick: 3,
        currentRound: 1,
        totalPicks: 180,
        lastUpdated: new Date(),
        managers: [
          { managerId: 'user1', managerName: 'User 1' },
          { managerId: 'user2', managerName: 'User 2' }
        ],
        picks: [
          { pickNumber: 1, managerId: 'user1', playerInfo: { name: 'Player 1' } },
          { pickNumber: 2, managerId: 'user2', playerInfo: { name: 'Player 2' } }
        ]
      };
    });

    it('should get current state', () => {
      const state = stateManager.getCurrentState();
      expect(state).toBe(stateManager.currentState);
    });

    it('should get manager data', () => {
      const manager = stateManager.getManagerData('user1');
      expect(manager).toEqual({ managerId: 'user1', managerName: 'User 1' });
    });

    it('should return null for invalid manager', () => {
      const manager = stateManager.getManagerData('invalid');
      expect(manager).toBeNull();
    });

    it('should get all managers', () => {
      const managers = stateManager.getAllManagers();
      expect(managers).toHaveLength(2);
    });

    it('should get recent picks', () => {
      const recentPicks = stateManager.getRecentPicks(1);
      expect(recentPicks).toHaveLength(1);
      expect(recentPicks[0].pickNumber).toBe(2);
    });

    it('should get manager picks', () => {
      const picks = stateManager.getManagerPicks('user1');
      expect(picks).toHaveLength(1);
      expect(picks[0].managerId).toBe('user1');
    });

    it('should check if draft is active', () => {
      expect(stateManager.isDraftActive()).toBe(true);
      
      stateManager.currentState.status = 'COMPLETED';
      expect(stateManager.isDraftActive()).toBe(false);
    });

    it('should get draft status', () => {
      const status = stateManager.getDraftStatus();
      expect(status).toMatchObject({
        status: 'IN_PROGRESS',
        isActive: true,
        currentPick: 3,
        currentRound: 1,
        totalPicks: 180
      });
    });
  });

  describe('callback management', () => {
    it('should manage state change callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      stateManager.onStateChange(callback1);
      stateManager.onStateChange(callback2);
      expect(stateManager.stateChangeCallbacks).toHaveLength(2);
      
      stateManager.offStateChange(callback1);
      expect(stateManager.stateChangeCallbacks).toHaveLength(1);
      expect(stateManager.stateChangeCallbacks[0]).toBe(callback2);
    });

    it('should manage error callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      stateManager.onError(callback1);
      stateManager.onError(callback2);
      expect(stateManager.errorCallbacks).toHaveLength(2);
      
      stateManager.offError(callback1);
      expect(stateManager.errorCallbacks).toHaveLength(1);
      expect(stateManager.errorCallbacks[0]).toBe(callback2);
    });

    it('should manage sync callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      stateManager.onSync(callback1);
      stateManager.onSync(callback2);
      expect(stateManager.syncCallbacks).toHaveLength(2);
      
      stateManager.offSync(callback1);
      expect(stateManager.syncCallbacks).toHaveLength(1);
      expect(stateManager.syncCallbacks[0]).toBe(callback2);
    });

    it('should not add duplicate callbacks', () => {
      const callback = vi.fn();
      
      stateManager.onStateChange(callback);
      stateManager.onStateChange(callback);
      
      expect(stateManager.stateChangeCallbacks).toHaveLength(1);
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => { throw new Error('Callback error'); });
      const goodCallback = vi.fn();
      
      stateManager.onStateChange(errorCallback);
      stateManager.onStateChange(goodCallback);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      stateManager.notifyStateChangeCallbacks({ test: 'data' });
      
      expect(goodCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Error in state change callback:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('getManagerStatus', () => {
    it('should return manager status information', () => {
      stateManager.currentState = { draftId: 'draft1' };
      stateManager.lastSyncTime = new Date();
      stateManager.stateHistory = [{ snapshot: 1 }, { snapshot: 2 }];
      stateManager.onStateChange(vi.fn());
      stateManager.onError(vi.fn());
      stateManager.onSync(vi.fn());
      
      const status = stateManager.getManagerStatus();
      
      expect(status).toEqual({
        isInitialized: true,
        isAutoSyncing: false,
        isSyncInProgress: false,
        lastSyncTime: expect.any(Date),
        stateHistorySize: 2,
        callbackCounts: {
          stateChange: 1,
          error: 1,
          sync: 1
        }
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources', () => {
      stateManager.onStateChange(vi.fn());
      stateManager.onError(vi.fn());
      stateManager.onSync(vi.fn());
      stateManager.currentState = { draftId: 'draft1' };
      stateManager.stateHistory = [{ snapshot: 1 }];
      
      stateManager.cleanup();
      
      expect(mockAPIConnector.stopLiveUpdates).toHaveBeenCalled();
      expect(mockAPIConnector.cleanup).toHaveBeenCalled();
      expect(stateManager.stateChangeCallbacks).toHaveLength(0);
      expect(stateManager.errorCallbacks).toHaveLength(0);
      expect(stateManager.syncCallbacks).toHaveLength(0);
      expect(stateManager.currentState).toBeNull();
      expect(stateManager.stateHistory).toHaveLength(0);
    });
  });
});