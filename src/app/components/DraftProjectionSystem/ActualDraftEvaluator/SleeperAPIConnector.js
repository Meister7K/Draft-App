/**
 * SleeperAPIConnector - Handles all Sleeper API interactions for draft data retrieval
 * Implements polling mechanism for real-time updates and comprehensive error handling
 */
export class SleeperAPIConnector {
  constructor(leagueId) {
    this.leagueId = leagueId;
    this.baseURL = 'https://api.sleeper.app/v1';
    this.pollInterval = 5000; // 5 second polling for live updates
    this.pollTimer = null;
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second delay
    this.isPolling = false;
    this.lastKnownState = null;
    this.errorCallbacks = [];
    this.updateCallbacks = [];
  }

  /**
   * Retrieves current draft data for the league
   * @returns {Promise<Object|null>} Draft data object or null if no active draft
   */
  async getDraftData() {
    try {
      const response = await this.makeAPIRequest(`/league/${this.leagueId}/drafts`);
      const drafts = await response.json();
      
      if (!drafts || drafts.length === 0) {
        return null;
      }

      // Find active draft or most recent draft
      const activeDraft = drafts.find(draft => draft.status === 'drafting') || drafts[0];
      
      if (activeDraft) {
        const picks = await this.getDraftPicks(activeDraft.draft_id);
        const draftData = {
          draftId: activeDraft.draft_id,
          status: activeDraft.status,
          picks,
          currentPick: picks.length + 1,
          totalPicks: activeDraft.settings?.rounds * activeDraft.settings?.teams || 180,
          draftOrder: activeDraft.draft_order,
          settings: activeDraft.settings,
          lastUpdated: new Date()
        };

        // Cache the last known state
        this.lastKnownState = draftData;
        return draftData;
      }
      
      return null;
    } catch (error) {
      this.handleError('getDraftData', error);
      // Return cached state if available during error
      return this.lastKnownState;
    }
  }

  /**
   * Retrieves all picks for a specific draft
   * @param {string} draftId - The draft ID
   * @returns {Promise<Array>} Array of draft picks
   */
  async getDraftPicks(draftId) {
    try {
      const response = await this.makeAPIRequest(`/draft/${draftId}/picks`);
      const picks = await response.json();
      
      // Sort picks by pick number to ensure correct order
      return picks.sort((a, b) => a.pick_no - b.pick_no);
    } catch (error) {
      this.handleError('getDraftPicks', error);
      return [];
    }
  }

  /**
   * Retrieves league information including roster settings
   * @returns {Promise<Object|null>} League data object
   */
  async getLeagueInfo() {
    try {
      const response = await this.makeAPIRequest(`/league/${this.leagueId}`);
      const leagueData = await response.json();
      
      return {
        leagueId: leagueData.league_id,
        name: leagueData.name,
        totalTeams: leagueData.total_rosters,
        rosterPositions: leagueData.roster_positions,
        settings: leagueData.settings,
        scoringSettings: leagueData.scoring_settings,
        season: leagueData.season
      };
    } catch (error) {
      this.handleError('getLeagueInfo', error);
      return null;
    }
  }

  /**
   * Retrieves all users/managers in the league
   * @returns {Promise<Array>} Array of league users
   */
  async getLeagueUsers() {
    try {
      const response = await this.makeAPIRequest(`/league/${this.leagueId}/users`);
      const users = await response.json();
      
      return users.map(user => ({
        userId: user.user_id,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar
      }));
    } catch (error) {
      this.handleError('getLeagueUsers', error);
      return [];
    }
  }

  /**
   * Starts polling for real-time draft updates
   * @param {Function} callback - Function to call when updates are received
   */
  startLiveUpdates(callback) {
    if (this.isPolling) {
      this.stopLiveUpdates();
    }

    this.isPolling = true;
    this.addUpdateCallback(callback);

    // Initial data fetch
    this.getDraftData().then(data => {
      if (data) {
        this.notifyUpdateCallbacks(data);
      }
    });

    // Start polling
    this.pollTimer = setInterval(async () => {
      try {
        const draftData = await this.getDraftData();
        if (draftData && this.hasDataChanged(draftData)) {
          this.notifyUpdateCallbacks(draftData);
        }
      } catch (error) {
        this.handleError('polling', error);
      }
    }, this.pollInterval);
  }

  /**
   * Stops polling for live updates
   */
  stopLiveUpdates() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
  }

  /**
   * Adds a callback for update notifications
   * @param {Function} callback - Function to call on updates
   */
  addUpdateCallback(callback) {
    if (typeof callback === 'function' && !this.updateCallbacks.includes(callback)) {
      this.updateCallbacks.push(callback);
    }
  }

  /**
   * Removes an update callback
   * @param {Function} callback - Function to remove
   */
  removeUpdateCallback(callback) {
    this.updateCallbacks = this.updateCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Adds a callback for error notifications
   * @param {Function} callback - Function to call on errors
   */
  addErrorCallback(callback) {
    if (typeof callback === 'function' && !this.errorCallbacks.includes(callback)) {
      this.errorCallbacks.push(callback);
    }
  }

  /**
   * Removes an error callback
   * @param {Function} callback - Function to remove
   */
  removeErrorCallback(callback) {
    this.errorCallbacks = this.errorCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Makes an API request with retry logic and error handling
   * @param {string} endpoint - API endpoint to call
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async makeAPIRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Handles errors and notifies error callbacks
   * @param {string} operation - The operation that failed
   * @param {Error} error - The error that occurred
   */
  handleError(operation, error) {
    const errorInfo = {
      operation,
      error: error.message,
      timestamp: new Date(),
      leagueId: this.leagueId
    };

    console.error(`SleeperAPIConnector Error in ${operation}:`, error);
    
    // Notify error callbacks
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorInfo);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }

  /**
   * Notifies all update callbacks with new data
   * @param {Object} data - The updated data
   */
  notifyUpdateCallbacks(data) {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (callbackError) {
        console.error('Error in update callback:', callbackError);
      }
    });
  }

  /**
   * Checks if draft data has changed since last update
   * @param {Object} newData - New draft data
   * @returns {boolean} True if data has changed
   */
  hasDataChanged(newData) {
    if (!this.lastKnownState) {
      return true;
    }

    // Compare pick counts and status
    return (
      newData.picks.length !== this.lastKnownState.picks.length ||
      newData.status !== this.lastKnownState.status ||
      newData.currentPick !== this.lastKnownState.currentPick
    );
  }

  /**
   * Utility function to sleep for a specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after the delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets the current connection status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isPolling: this.isPolling,
      leagueId: this.leagueId,
      hasLastKnownState: !!this.lastKnownState,
      updateCallbackCount: this.updateCallbacks.length,
      errorCallbackCount: this.errorCallbacks.length
    };
  }

  /**
   * Cleanup method to stop polling and clear callbacks
   */
  cleanup() {
    this.stopLiveUpdates();
    this.updateCallbacks = [];
    this.errorCallbacks = [];
    this.lastKnownState = null;
  }
}