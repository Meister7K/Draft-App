/**
 * Historical Data Parser Utilities
 * Fetches and processes draft history by manager from the Sleeper API
 */

// Cache configuration
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const CACHE_PREFIX = 'sleeper_draft_analytics_';

/**
 * Cache utility functions
 */
const CacheManager = {
  set(key, data) {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
        expires: Date.now() + CACHE_DURATION
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheItem));
    } catch (err) {
      console.warn('Failed to cache data:', err);
    }
  },

  get(key) {
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;

      const cacheItem = JSON.parse(cached);
      if (Date.now() > cacheItem.expires) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }

      return cacheItem.data;
    } catch (err) {
      console.warn('Failed to retrieve cached data:', err);
      return null;
    }
  },

  clear(key) {
    try {
      localStorage.removeItem(CACHE_PREFIX + key);
    } catch (err) {
      console.warn('Failed to clear cache:', err);
    }
  },

  clearAll() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
      console.warn('Failed to clear all cache:', err);
    }
  }
};

/**
 * Data validation utilities
 */
const DataValidator = {
  validateLeagueData(leagueData) {
    if (!leagueData || typeof leagueData !== 'object') {
      throw new Error('Invalid league data structure');
    }
    
    if (!leagueData.league_id || !leagueData.season) {
      throw new Error('Missing required league fields');
    }
    
    return true;
  },

  validateDraftData(draftData) {
    if (!draftData || typeof draftData !== 'object') {
      throw new Error('Invalid draft data structure');
    }
    
    if (!Array.isArray(draftData.picks)) {
      throw new Error('Draft picks must be an array');
    }
    
    return true;
  },

  validateUserData(users) {
    if (!Array.isArray(users)) {
      throw new Error('Users must be an array');
    }
    
    users.forEach((user, index) => {
      if (!user.user_id || !user.display_name) {
        throw new Error(`Invalid user data at index ${index}`);
      }
    });
    
    return true;
  },

  validateManagerHistory(managerHistory) {
    if (!managerHistory || typeof managerHistory !== 'object') {
      throw new Error('Invalid manager history structure');
    }
    
    Object.entries(managerHistory).forEach(([managerId, history]) => {
      if (!history.user_id || !Array.isArray(history.picks) || !Array.isArray(history.seasons)) {
        throw new Error(`Invalid manager history for ${managerId}`);
      }
    });
    
    return true;
  }
};

/**
 * Error handling utilities
 */
class HistoricalDataError extends Error {
  constructor(message, code, originalError = null) {
    super(message);
    this.name = 'HistoricalDataError';
    this.code = code;
    this.originalError = originalError;
  }
}

const ErrorHandler = {
  handleApiError(error, context) {
    console.error(`API Error in ${context}:`, error);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new HistoricalDataError(
        'Network error - please check your internet connection',
        'NETWORK_ERROR',
        error
      );
    }
    
    if (error.message.includes('404')) {
      throw new HistoricalDataError(
        'League or draft not found',
        'NOT_FOUND',
        error
      );
    }
    
    if (error.message.includes('429')) {
      throw new HistoricalDataError(
        'Rate limit exceeded - please try again later',
        'RATE_LIMIT',
        error
      );
    }
    
    throw new HistoricalDataError(
      `Failed to fetch data: ${error.message}`,
      'API_ERROR',
      error
    );
  },

  handleValidationError(error, context) {
    console.error(`Validation Error in ${context}:`, error);
    throw new HistoricalDataError(
      `Data validation failed: ${error.message}`,
      'VALIDATION_ERROR',
      error
    );
  }
};

/**
 * Fetches league history by traversing previous_league_id chain
 * @param {string} leagueId - Starting league ID
 * @returns {Array} Array of league history objects
 */
export async function getLeagueHistory(leagueId) {
  const cacheKey = `league_history_${leagueId}`;
  
  // Try to get from cache first
  const cached = CacheManager.get(cacheKey);
  if (cached) {
    return cached;
  }

  const history = [];
  let currentId = leagueId;
  
  while (currentId) {
    try {
      const response = await fetch(`https://api.sleeper.app/v1/league/${currentId}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`League ${currentId} not found, stopping traversal`);
          break;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const leagueData = await response.json();
      
      // Validate league data
      try {
        DataValidator.validateLeagueData(leagueData);
      } catch (validationError) {
        ErrorHandler.handleValidationError(validationError, `getLeagueHistory for ${currentId}`);
      }
      
      history.push({
        league_id: currentId,
        season: leagueData.season,
        name: leagueData.name,
        draft_id: leagueData.draft_id,
      });
      
      currentId = leagueData.previous_league_id;
    } catch (err) {
      ErrorHandler.handleApiError(err, `getLeagueHistory for ${currentId}`);
    }
  }
  
  const sortedHistory = history.sort((a, b) => a.season.localeCompare(b.season));
  
  // Cache the result
  CacheManager.set(cacheKey, sortedHistory);
  
  return sortedHistory;
}

/**
 * Fetches all draft data for a league history
 * @param {Array} leagueHistory - Array of league history objects
 * @returns {Array} Array of draft data with picks
 */
export async function fetchAllDraftData(leagueHistory) {
  const allDrafts = [];
  
  for (const league of leagueHistory) {
    if (league.draft_id) {
      const cacheKey = `draft_data_${league.draft_id}`;
      
      // Try to get from cache first
      const cached = CacheManager.get(cacheKey);
      if (cached) {
        allDrafts.push(cached);
        continue;
      }

      try {
        const [draftResponse, picksResponse] = await Promise.all([
          fetch(`https://api.sleeper.app/v1/draft/${league.draft_id}`),
          fetch(`https://api.sleeper.app/v1/draft/${league.draft_id}/picks`)
        ]);
        
        if (draftResponse.ok && picksResponse.ok) {
          const draftInfo = await draftResponse.json();
          const picks = await picksResponse.json();
          
          // Validate draft data
          const draftData = {
            season: league.season,
            league_name: league.name,
            league_id: league.league_id,
            draft_info: draftInfo,
            picks: picks || [],
            draft_settings: draftInfo.settings
          };

          try {
            DataValidator.validateDraftData(draftData);
          } catch (validationError) {
            ErrorHandler.handleValidationError(validationError, `fetchAllDraftData for ${league.draft_id}`);
          }
          
          allDrafts.push(draftData);
          
          // Cache the result
          CacheManager.set(cacheKey, draftData);
        }
      } catch (err) {
        ErrorHandler.handleApiError(err, `fetchAllDraftData for ${league.season}`);
      }
    }
  }
  
  return allDrafts;
}

/**
 * Extracts draft history for all managers from Sleeper API data
 * @param {Array} drafts - Array of draft data from fetchAllDraftData
 * @param {Array} users - Array of league users
 * @returns {Object} Processed draft history organized by manager ID
 */
export function extractDraftHistoryByManager(drafts, users) {
  if (!drafts || !Array.isArray(drafts)) {
    return {};
  }

  // Validate users data
  try {
    DataValidator.validateUserData(users);
  } catch (validationError) {
    ErrorHandler.handleValidationError(validationError, 'extractDraftHistoryByManager');
  }

  const managerHistory = {};

  // Initialize manager history for all users
  users.forEach(user => {
    managerHistory[user.user_id] = {
      user_id: user.user_id,
      username: user.display_name,
      totalDrafts: 0,
      seasons: new Set(),
      picks: [],
      leagues: new Set()
    };
  });

  // Process each draft
  drafts.forEach(draft => {
    if (!draft.picks || !Array.isArray(draft.picks)) return;

    // Process each pick in the draft
    draft.picks.forEach(pick => {
      const managerId = pick.picked_by;
      if (!managerId || !managerHistory[managerId]) return;

      // Add pick to manager's history
      managerHistory[managerId].picks.push({
        ...pick,
        leagueId: draft.league_id,
        draftId: draft.draft_info?.draft_id,
        season: draft.season,
        leagueName: draft.league_name,
        playerName: pick.metadata?.first_name && pick.metadata?.last_name 
          ? `${pick.metadata.first_name} ${pick.metadata.last_name}`
          : 'Unknown Player',
        position: pick.metadata?.position || 'Unknown',
        team: pick.metadata?.team || 'Unknown'
      });

      // Track seasons and leagues
      managerHistory[managerId].seasons.add(draft.season);
      managerHistory[managerId].leagues.add(draft.league_id);
    });
  });

  // Convert Sets to Arrays and calculate totals
  Object.keys(managerHistory).forEach(managerId => {
    const history = managerHistory[managerId];
    history.seasons = Array.from(history.seasons).sort((a, b) => b - a);
    history.leagues = Array.from(history.leagues);
    history.totalDrafts = history.leagues.length;
    
    // Sort picks by draft order
    history.picks.sort((a, b) => {
      if (a.season !== b.season) {
        return b.season - a.season; // Most recent first
      }
      return a.pick_no - b.pick_no;
    });
  });

  // Validate the final result
  try {
    DataValidator.validateManagerHistory(managerHistory);
  } catch (validationError) {
    ErrorHandler.handleValidationError(validationError, 'extractDraftHistoryByManager result');
  }

  return managerHistory;
}

/**
 * Gets draft history for a specific manager
 * @param {Array} drafts - Array of draft data from fetchAllDraftData
 * @param {Array} users - Array of league users
 * @param {string} managerId - The manager ID to get history for
 * @returns {Object} Manager's draft history
 */
export function getManagerDraftHistory(drafts, users, managerId) {
  const allHistory = extractDraftHistoryByManager(drafts, users);
  return allHistory[managerId] || {
    user_id: managerId,
    username: 'Unknown',
    totalDrafts: 0,
    seasons: [],
    picks: [],
    leagues: []
  };
}

/**
 * Fetches additional user data from Sleeper API
 * @param {string} userId - User ID to fetch data for
 * @returns {Object} User data including leagues across multiple years
 */
export async function fetchUserData(userId) {
  try {
    // Get user info
    const userResponse = await fetch(`https://api.sleeper.app/v1/user/${userId}`);
    if (!userResponse.ok) throw new Error('User not found');
    
    const userData = await userResponse.json();
    
    // Get leagues for multiple years (current and previous years)
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];
    
    const allLeagues = [];
    
    for (const year of years) {
      try {
        const leaguesResponse = await fetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${year}`);
        if (leaguesResponse.ok) {
          const leagues = await leaguesResponse.json();
          allLeagues.push(...(leagues || []));
        }
      } catch (err) {
        console.error(`Error fetching leagues for ${year}:`, err);
      }
    }
    
    return {
      user: userData,
      leagues: allLeagues
    };
  } catch (err) {
    console.error('Error fetching user data:', err);
    return { user: null, leagues: [] };
  }
}

/**
 * Processes draft picks to include enhanced player information
 * @param {Array} picks - Array of draft picks
 * @returns {Array} Picks with enhanced player information
 */
export function enhancePicksWithPlayerData(picks) {
  if (!picks || !Array.isArray(picks)) {
    return [];
  }

  return picks.map(pick => ({
    ...pick,
    playerName: pick.metadata?.first_name && pick.metadata?.last_name 
      ? `${pick.metadata.first_name} ${pick.metadata.last_name}`
      : pick.playerName || 'Unknown Player',
    position: pick.metadata?.position || pick.position || 'Unknown',
    team: pick.metadata?.team || pick.team || 'Unknown'
  }));
}

/**
 * Filters draft history by date range
 * @param {Object} managerHistory - Manager's complete draft history
 * @param {number} startSeason - Starting season (inclusive)
 * @param {number} endSeason - Ending season (inclusive)
 * @returns {Object} Filtered draft history
 */
export function filterHistoryByDateRange(managerHistory, startSeason, endSeason) {
  if (!managerHistory || !managerHistory.picks) {
    return { ...managerHistory, picks: [] };
  }

  const filteredPicks = managerHistory.picks.filter(pick => {
    const season = parseInt(pick.season);
    return season >= startSeason && season <= endSeason;
  });

  const filteredSeasons = managerHistory.seasons.filter(season => 
    parseInt(season) >= startSeason && parseInt(season) <= endSeason
  );

  return {
    ...managerHistory,
    picks: filteredPicks,
    seasons: filteredSeasons,
    totalDrafts: new Set(filteredPicks.map(pick => pick.leagueId)).size
  };
}

/**
 * Gets available seasons from draft data
 * @param {Array} drafts - Array of draft data
 * @returns {Array} Array of available seasons sorted in descending order
 */
export function getAvailableSeasons(drafts) {
  if (!drafts || !Array.isArray(drafts)) {
    return [];
  }

  const seasons = new Set();
  
  drafts.forEach(draft => {
    if (draft.season) {
      seasons.add(parseInt(draft.season));
    }
  });

  return Array.from(seasons).sort((a, b) => b - a);
}

/**
 * Fetches comprehensive league and draft data for analysis
 * @param {string} leagueId - Starting league ID
 * @returns {Object} Complete league analysis data
 */
export async function fetchLeagueAnalysisData(leagueId) {
  try {
    // Get league history
    const leagueHistory = await getLeagueHistory(leagueId);
    
    // Get current league users
    const usersResponse = await fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`);
    const users = await usersResponse.json();
    
    // Get all draft data
    const drafts = await fetchAllDraftData(leagueHistory);
    
    // Extract manager history
    const managerHistory = extractDraftHistoryByManager(drafts, users);
    
    return {
      leagueHistory,
      users,
      drafts,
      managerHistory,
      availableSeasons: getAvailableSeasons(drafts)
    };
  } catch (err) {
    console.error('Error fetching league analysis data:', err);
    throw err;
  }
}

// Export utility classes and functions for external use
export { CacheManager, DataValidator, HistoricalDataError, ErrorHandler };