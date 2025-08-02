/**
 * DraftStateManager - Manages draft state synchronization and updates
 * Handles state transitions, caching, and change notifications
 */

import { SleeperAPIConnector } from '../ActualDraftEvaluator/SleeperAPIConnector.js';
import { 
  processDraftData, 
  detectDraftChanges, 
  validateDraftData, 
  createDraftSnapshot 
} from './DraftDataProcessor.js';

export class DraftStateManager {
  constructor(leagueId, options = {}) {
    this.leagueId = leagueId;
    this.apiConnector = new SleeperAPIConnector(leagueId);
    
    // Configuration options
    this.options = {
      autoSync: options.autoSync !== false, // Default to true
      syncInterval: options.syncInterval || 5000, // 5 seconds
      maxRetries: options.maxRetries || 3,
      enableCaching: options.enableCaching !== false, // Default to true
      ...options
    };

    // State management
    this.currentState = null;
    this.previousState = null;
    this.stateHistory = [];
    this.maxHistorySize = 50;
    
    // Metadata
    this.leagueUsers = [];
    this.playerDatabase = [];
    this.lastSyncTime = null;
    this.syncInProgress = false;
    
    // Event callbacks
    this.stateChangeCallbacks = [];
    this.errorCallbacks = [];
    this.syncCallbacks = [];
    
    // Bind methods
    this.handleAPIUpdate = this.handleAPIUpdate.bind(this);
    this.handleAPIError = this.handleAPIError.bind(this);
  }

  /**
   * Initializes the draft state manager
   * @param {Array} leagueUsers - Array of league users
   * @param {Array} playerDatabase - Array of player data
   * @returns {Promise<Object>} Initial draft state
   */
  async initialize(leagueUsers = [], playerDatabase = []) {
    try {
      this.leagueUsers = leagueUsers;
      this.playerDatabase = playerDatabase;

      // Set up API callbacks
      this.apiConnector.addUpdateCallback(this.handleAPIUpdate);
      this.apiConnector.addErrorCallback(this.handleAPIError);

      // Get initial state
      const initialState = await this.syncState();
      
      if (this.options.autoSync) {
        this.startAutoSync();
      }

      return initialState;
    } catch (error) {
      this.handleError('initialization', error);
      throw error;
    }
  }

  /**
   * Manually syncs draft state from API
   * @returns {Promise<Object>} Updated draft state
   */
  async syncState() {
    if (this.syncInProgress) {
      return this.currentState;
    }

    try {
      this.syncInProgress = true;
      this.notifySyncCallbacks({ type: 'sync_start' });

      const rawDraftData = await this.apiConnector.getDraftData();
      
      if (!rawDraftData) {
        this.notifySyncCallbacks({ type: 'sync_complete', hasData: false });
        return null;
      }

      const processedData = processDraftData(rawDraftData, this.leagueUsers, this.playerDatabase);
      const validation = validateDraftData(processedData);

      if (!validation.isValid) {
        throw new Error(`Invalid draft data: ${validation.errors.join(', ')}`);
      }

      // Update state
      this.updateState(processedData);
      this.lastSyncTime = new Date();

      this.notifySyncCallbacks({ 
        type: 'sync_complete', 
        hasData: true, 
        validation 
      });

      return this.currentState;
    } catch (error) {
      this.handleError('sync', error);
      this.notifySyncCallbacks({ type: 'sync_error', error });
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Updates the current draft state and manages history
   * @param {Object} newState - New draft state
   */
  updateState(newState) {
    // Store previous state
    this.previousState = this.currentState;
    
    // Detect changes
    const changes = detectDraftChanges(this.previousState, newState);
    
    // Update current state
    this.currentState = newState;
    
    // Add to history if there are changes
    if (changes.hasChanges && this.options.enableCaching) {
      this.addToHistory(createDraftSnapshot(newState));
    }
    
    // Notify callbacks if there are changes
    if (changes.hasChanges) {
      this.notifyStateChangeCallbacks({
        newState: this.currentState,
        previousState: this.previousState,
        changes
      });
    }
  }

  /**
   * Adds a state snapshot to history
   * @param {Object} snapshot - State snapshot
   */
  addToHistory(snapshot) {
    if (!snapshot) return;
    
    this.stateHistory.push(snapshot);
    
    // Maintain history size limit
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  /**
   * Starts automatic state synchronization
   */
  startAutoSync() {
    if (this.options.autoSync) {
      this.apiConnector.startLiveUpdates(this.handleAPIUpdate);
    }
  }

  /**
   * Stops automatic state synchronization
   */
  stopAutoSync() {
    this.apiConnector.stopLiveUpdates();
  }

  /**
   * Handles API update notifications
   * @param {Object} rawDraftData - Raw draft data from API
   */
  async handleAPIUpdate(rawDraftData) {
    try {
      if (!rawDraftData) return;

      const processedData = processDraftData(rawDraftData, this.leagueUsers, this.playerDatabase);
      const validation = validateDraftData(processedData);

      if (validation.isValid) {
        this.updateState(processedData);
        this.lastSyncTime = new Date();
      } else {
        console.warn('Received invalid draft data from API:', validation.errors);
      }
    } catch (error) {
      this.handleError('api_update', error);
    }
  }

  /**
   * Handles API error notifications
   * @param {Object} errorInfo - Error information from API
   */
  handleAPIError(errorInfo) {
    this.handleError('api_error', new Error(errorInfo.error), errorInfo);
  }

  /**
   * Gets the current draft state
   * @returns {Object|null} Current draft state
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Gets the previous draft state
   * @returns {Object|null} Previous draft state
   */
  getPreviousState() {
    return this.previousState;
  }

  /**
   * Gets state history
   * @param {number} limit - Maximum number of history items to return
   * @returns {Array} Array of state snapshots
   */
  getStateHistory(limit = null) {
    if (limit) {
      return this.stateHistory.slice(-limit);
    }
    return [...this.stateHistory];
  }

  /**
   * Gets manager data for a specific manager
   * @param {string} managerId - Manager ID
   * @returns {Object|null} Manager data
   */
  getManagerData(managerId) {
    if (!this.currentState?.managers) return null;
    
    return this.currentState.managers.find(manager => manager.managerId === managerId) || null;
  }

  /**
   * Gets all managers data
   * @returns {Array} Array of manager data
   */
  getAllManagers() {
    return this.currentState?.managers || [];
  }

  /**
   * Gets recent picks
   * @param {number} count - Number of recent picks to return
   * @returns {Array} Array of recent picks
   */
  getRecentPicks(count = 5) {
    if (!this.currentState?.picks) return [];
    
    return this.currentState.picks
      .slice(-count)
      .sort((a, b) => b.pickNumber - a.pickNumber);
  }

  /**
   * Gets picks for a specific manager
   * @param {string} managerId - Manager ID
   * @returns {Array} Array of manager's picks
   */
  getManagerPicks(managerId) {
    if (!this.currentState?.picks) return [];
    
    return this.currentState.picks
      .filter(pick => pick.managerId === managerId)
      .sort((a, b) => a.pickNumber - b.pickNumber);
  }

  /**
   * Checks if draft is currently active
   * @returns {boolean} True if draft is in progress
   */
  isDraftActive() {
    return this.currentState?.status === 'IN_PROGRESS';
  }

  /**
   * Gets draft status information
   * @returns {Object} Draft status information
   */
  getDraftStatus() {
    if (!this.currentState) {
      return {
        status: 'UNKNOWN',
        isActive: false,
        currentPick: null,
        currentRound: null,
        totalPicks: null,
        lastUpdated: null
      };
    }

    return {
      status: this.currentState.status,
      isActive: this.isDraftActive(),
      currentPick: this.currentState.currentPick,
      currentRound: this.currentState.currentRound,
      totalPicks: this.currentState.totalPicks,
      lastUpdated: this.currentState.lastUpdated,
      lastSyncTime: this.lastSyncTime
    };
  }

  /**
   * Adds a state change callback
   * @param {Function} callback - Callback function
   */
  onStateChange(callback) {
    if (typeof callback === 'function' && !this.stateChangeCallbacks.includes(callback)) {
      this.stateChangeCallbacks.push(callback);
    }
  }

  /**
   * Removes a state change callback
   * @param {Function} callback - Callback function to remove
   */
  offStateChange(callback) {
    this.stateChangeCallbacks = this.stateChangeCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Adds an error callback
   * @param {Function} callback - Callback function
   */
  onError(callback) {
    if (typeof callback === 'function' && !this.errorCallbacks.includes(callback)) {
      this.errorCallbacks.push(callback);
    }
  }

  /**
   * Removes an error callback
   * @param {Function} callback - Callback function to remove
   */
  offError(callback) {
    this.errorCallbacks = this.errorCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Adds a sync callback
   * @param {Function} callback - Callback function
   */
  onSync(callback) {
    if (typeof callback === 'function' && !this.syncCallbacks.includes(callback)) {
      this.syncCallbacks.push(callback);
    }
  }

  /**
   * Removes a sync callback
   * @param {Function} callback - Callback function to remove
   */
  offSync(callback) {
    this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Notifies state change callbacks
   * @param {Object} changeInfo - Information about the state change
   */
  notifyStateChangeCallbacks(changeInfo) {
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(changeInfo);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
  }

  /**
   * Notifies sync callbacks
   * @param {Object} syncInfo - Information about the sync operation
   */
  notifySyncCallbacks(syncInfo) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback(syncInfo);
      } catch (error) {
        console.error('Error in sync callback:', error);
      }
    });
  }

  /**
   * Handles errors and notifies error callbacks
   * @param {string} operation - The operation that failed
   * @param {Error} error - The error that occurred
   * @param {Object} context - Additional context information
   */
  handleError(operation, error, context = {}) {
    const errorInfo = {
      operation,
      error: error.message,
      timestamp: new Date(),
      leagueId: this.leagueId,
      context
    };

    console.error(`DraftStateManager Error in ${operation}:`, error);
    
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorInfo);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }

  /**
   * Gets manager status information
   * @returns {Object} Manager status information
   */
  getManagerStatus() {
    return {
      isInitialized: !!this.currentState,
      isAutoSyncing: this.options.autoSync && this.apiConnector.isPolling,
      isSyncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      stateHistorySize: this.stateHistory.length,
      callbackCounts: {
        stateChange: this.stateChangeCallbacks.length,
        error: this.errorCallbacks.length,
        sync: this.syncCallbacks.length
      }
    };
  }

  /**
   * Cleanup method to stop all operations and clear callbacks
   */
  cleanup() {
    this.stopAutoSync();
    this.apiConnector.cleanup();
    
    this.stateChangeCallbacks = [];
    this.errorCallbacks = [];
    this.syncCallbacks = [];
    
    this.currentState = null;
    this.previousState = null;
    this.stateHistory = [];
    
    this.leagueUsers = [];
    this.playerDatabase = [];
  }
}