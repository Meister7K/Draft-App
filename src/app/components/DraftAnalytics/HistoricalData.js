/**
 * HistoricalData Utility Component
 * Handles historical DRAFT data loading from Sleeper API, caching, validation, and error recovery
 * 
 * IMPORTANT: This component uses Sleeper API for historical draft data.
 * The local JSON file (/db/fantasy_football_db.json) is for player stats only.
 */

import { managerHistoryService } from "./utils/sleeperApi.js";

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * In-memory cache for historical data
 */
class HistoricalDataCache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
  }

  set(key, data) {
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now());
  }

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() - timestamp > CACHE_DURATION) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  has(key) {
    const timestamp = this.timestamps.get(key);
    return timestamp && Date.now() - timestamp <= CACHE_DURATION;
  }
}

// Global cache instance
const dataCache = new HistoricalDataCache();

/**
 * Data validation utilities for Sleeper API data
 */
export const DataValidator = {
  /**
   * Validates Sleeper API manager data structure
   */
  validateSleeperManagerData(data) {
    const errors = [];
    const warnings = [];

    if (!data || typeof data !== "object") {
      errors.push("Manager data is null or not an object");
      return { isValid: false, errors, warnings };
    }

    // Check for required fields from Sleeper API
    if (!data.managerId && !data.userId) {
      errors.push("Manager data missing managerId/userId");
    }

    if (!Array.isArray(data.picks)) {
      errors.push("Manager data missing or invalid picks array");
    } else if (data.picks.length === 0) {
      warnings.push("Manager has no draft picks");
    }

    if (!Array.isArray(data.seasons)) {
      warnings.push("Manager data missing seasons array");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Validates Sleeper league data structure
   */
  validateSleeperLeague(league) {
    const errors = [];
    const warnings = [];

    if (!league || typeof league !== "object") {
      errors.push("League data is null or not an object");
      return { isValid: false, errors, warnings };
    }

    if (!league.league_id) {
      errors.push("League missing league_id");
    }

    if (!league.name) {
      warnings.push("League missing name");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Validates Sleeper draft pick structure
   */
  validateSleeperPick(pick) {
    const errors = [];
    const warnings = [];

    if (!pick || typeof pick !== "object") {
      errors.push("Pick is null or not an object");
      return { isValid: false, errors, warnings };
    }

    if (!pick.picked_by) {
      errors.push("Pick missing picked_by field");
    }

    if (typeof pick.pick_no !== "number") {
      warnings.push("Pick missing or invalid pick_no");
    }

    if (typeof pick.round !== "number") {
      warnings.push("Pick missing or invalid round");
    }

    if (!pick.player_id) {
      warnings.push("Pick missing player_id");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Validates manager data integrity (using Sleeper API format)
   */
  validateManagerData(managerData) {
    return this.validateSleeperManagerData(managerData);
  },
};

/**
 * Error recovery utilities
 */
export const ErrorRecovery = {
  /**
   * Attempts to recover from network errors with retry logic
   */
  async retryWithBackoff(fn, maxAttempts = MAX_RETRY_ATTEMPTS) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        console.log(`[ErrorRecovery] Attempt ${attempt}/${maxAttempts} failed:`, error.message);

        if (attempt === maxAttempts) {
          console.error(`[ErrorRecovery] All ${maxAttempts} attempts failed:`, error);
          throw error;
        }

        // Exponential backoff with jitter
        const baseDelay = RETRY_DELAY * Math.pow(2, attempt - 1);
        const jitter = baseDelay * 0.1 * Math.random();
        const delay = Math.min(baseDelay + jitter, 30000); // Max 30 seconds
        
        console.log(`[ErrorRecovery] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  },

  /**
   * Provides fallback data when primary data is unavailable
   */
  getFallbackManagerData(managerId) {
    return {
      managerId,
      totalDrafts: 0,
      seasons: [],
      leagues: [],
      picks: [],
      statistics: {
        totalPicks: 0,
        positionFrequencies: {},
        averageDraftPositions: {},
        mostFrequentPlayers: [],
        roundTendencies: {
          earlyRounds: { count: 0, percentage: 0 },
          lateRounds: { count: 0, percentage: 0 },
        },
        yearOverYearTrends: {},
      },
      dateRange: { startSeason: null, endSeason: null },
      dataQuality: "fallback",
    };
  },

  /**
   * Sanitizes Sleeper API data
   */
  sanitizeSleeperData(data) {
    if (!data || typeof data !== "object") {
      return null;
    }

    // Create a deep copy to avoid mutating original data
    const sanitized = JSON.parse(JSON.stringify(data));

    // Sanitize picks array
    if (Array.isArray(sanitized.picks)) {
      sanitized.picks = sanitized.picks.filter(
        (pick) => pick && typeof pick === "object" && pick.picked_by && pick.player_id
      );
    }

    // Sanitize leagues array
    if (Array.isArray(sanitized.leagues)) {
      sanitized.leagues = sanitized.leagues.filter(
        (league) => league && typeof league === "object" && league.league_id
      );
    }

    // Sanitize seasons array
    if (Array.isArray(sanitized.seasons)) {
      sanitized.seasons = sanitized.seasons.filter(
        (season) => season && (typeof season === "string" || typeof season === "number")
      );
    }

    return sanitized;
  },


};

/**
 * HistoricalData Manager Class
 * Manages historical draft data loading using Sleeper API, caching, validation, and error recovery
 * 
 * IMPORTANT: This class is for HISTORICAL DRAFT DATA from Sleeper API, not player stats.
 * The local JSON file (/db/fantasy_football_db.json) contains player stats only.
 */
export class HistoricalDataManager {
  constructor() {
    this.data = null;
    this.playerStatsData = null;
    this.loading = false;
    this.error = null;
    this.validationResults = null;
    this.abortController = null;
  }

  /**
   * Gets NFL player data from Sleeper API (NOT from local JSON file)
   * This provides current player information to enhance draft picks
   */
  async loadNflPlayersData() {
    const cacheKey = "sleeper_nfl_players";

    // Check cache first
    const cachedData = dataCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    this.loading = true;
    this.error = null;

    try {
      console.log('Loading NFL players data from Sleeper API');
      
      // Use Sleeper API to get current NFL players
      const nflPlayers = await managerHistoryService.apiClient.getNflPlayers();

      // Cache the data
      dataCache.set(cacheKey, nflPlayers);
      console.log('Successfully cached NFL players data from Sleeper API');
      
      return nflPlayers;
    } catch (err) {
      console.error("NFL players data loading error:", err);
      this.error = err.message;
      throw err;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Loads manager-specific historical draft data using Sleeper API
   * This is the primary method for getting draft history - NOT the local JSON file
   */
  async loadManagerData(managerId, options = {}) {
    if (!managerId) {
      throw new Error("Manager ID is required");
    }

    const seasons = options.seasons || ["2024", "2023", "2022", "2021", "2020", "2019", "2018"];
    const cacheKey = `manager_${managerId}_${seasons.join("_")}`;

    // Check cache first
    const cachedData = dataCache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    this.loading = true;
    this.error = null;

    try {
      console.log(`Loading historical draft data for manager ${managerId} from Sleeper API`);
      
      // Use Sleeper API to get manager's draft history
      const managerData = await managerHistoryService.getEnhancedManagerData(
        managerId,
        seasons
      );

      console.log(`Retrieved ${managerData.picks.length} picks across ${managerData.seasons.length} seasons`);

      // Transform the data to match expected format
      const transformedData = {
        managerId,
        totalDrafts: managerData.leagues.length,
        seasons: managerData.seasons,
        leagues: managerData.leagues,
        picks: managerData.picks,
        playerDatabase: managerData.playerDatabase,
        statistics: this.calculateBasicStatistics(managerData.picks),
        dateRange: managerData.dateRange,
        dataQuality: this.assessDataQuality(managerData.picks),
      };

      // Validate manager data using Sleeper API format
      const validation = DataValidator.validateSleeperManagerData(transformedData);
      if (!validation.isValid) {
        console.warn(
          `Manager data validation warnings: ${validation.warnings.join(", ")}`
        );

        // Use fallback data for critical errors
        if (validation.errors.length > 0) {
          console.error(
            `Manager data validation errors: ${validation.errors.join(", ")}`
          );
          const fallbackData = ErrorRecovery.getFallbackManagerData(managerId);
          dataCache.set(cacheKey, fallbackData);
          return fallbackData;
        }
      }

      // Sanitize the data
      const sanitizedData = ErrorRecovery.sanitizeSleeperData(transformedData);
      if (!sanitizedData) {
        console.warn('Data sanitization returned null, using original data');
      }

      // Cache the sanitized data
      const finalData = sanitizedData || transformedData;
      dataCache.set(cacheKey, finalData);
      console.log(`Successfully cached manager data for ${managerId}`);
      
      return finalData;
    } catch (err) {
      console.error(`Error loading manager data for ${managerId}:`, err);
      this.error = err.message;

      // Return fallback data
      const fallbackData = ErrorRecovery.getFallbackManagerData(managerId);
      dataCache.set(cacheKey, fallbackData);
      return fallbackData;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Gets current NFL player data from Sleeper API
   * Use this when you need current player information to enhance draft picks
   */
  async getNflPlayersData() {
    if (this.playerStatsData) {
      return this.playerStatsData;
    }

    try {
      const nflPlayersData = await this.loadNflPlayersData();
      this.playerStatsData = nflPlayersData;
      return nflPlayersData;
    } catch (err) {
      console.warn('Failed to load NFL players data from Sleeper API:', err.message);
      return null;
    }
  }

  /**
   * Preloads data for multiple managers
   */
  async preloadManagersData(managerIds, options = {}) {
    if (!Array.isArray(managerIds) || managerIds.length === 0) {
      return {};
    }

    const results = {};
    const loadPromises = managerIds.map(async (managerId) => {
      try {
        const managerData = await this.loadManagerData(managerId, options);
        results[managerId] = managerData;
      } catch (err) {
        console.error(`Failed to preload data for manager ${managerId}:`, err);
        results[managerId] = ErrorRecovery.getFallbackManagerData(managerId);
      }
    });

    await Promise.allSettled(loadPromises);
    return results;
  }

  /**
   * Clears all cached data
   */
  clearCache() {
    dataCache.clear();
    this.data = null;
    this.playerStatsData = null;
    this.error = null;
    this.validationResults = null;
  }

  /**
   * Gets cache statistics
   */
  getCacheStats() {
    return {
      size: dataCache.cache.size,
      keys: Array.from(dataCache.cache.keys()),
      timestamps: Object.fromEntries(dataCache.timestamps),
    };
  }

  /**
   * Calculate basic statistics from picks data
   */
  calculateBasicStatistics(picks) {
    if (!picks || picks.length === 0) {
      return {
        totalPicks: 0,
        positionFrequencies: {},
        averageDraftPositions: {},
        mostFrequentPlayers: [],
        roundTendencies: {
          earlyRounds: { count: 0, percentage: 0 },
          lateRounds: { count: 0, percentage: 0 },
        },
        yearOverYearTrends: {},
      };
    }

    const totalPicks = picks.length;
    const positionCounts = {};
    const positionRounds = {};
    const playerCounts = {};

    // Process each pick
    picks.forEach((pick) => {
      const position = pick.player_data?.position || "UNKNOWN";
      const playerName = pick.player_data?.name || "Unknown Player";
      const round = pick.round || 1;

      // Count positions
      positionCounts[position] = (positionCounts[position] || 0) + 1;

      // Track rounds for positions
      if (!positionRounds[position]) {
        positionRounds[position] = [];
      }
      positionRounds[position].push(round);

      // Count players
      playerCounts[playerName] = (playerCounts[playerName] || 0) + 1;
    });

    // Calculate position frequencies
    const positionFrequencies = {};
    Object.entries(positionCounts).forEach(([position, count]) => {
      const rounds = positionRounds[position] || [];
      const avgRound =
        rounds.length > 0
          ? rounds.reduce((a, b) => a + b, 0) / rounds.length
          : 0;

      positionFrequencies[position] = {
        count,
        percentage: Math.round((count / totalPicks) * 100),
        averageRound: avgRound,
      };
    });

    // Get most frequent players
    const mostFrequentPlayers = Object.entries(playerCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Calculate round tendencies
    const earlyRoundPicks = picks.filter(
      (pick) => (pick.round || 1) <= 6
    ).length;
    const lateRoundPicks = picks.filter((pick) => (pick.round || 1) > 6).length;

    return {
      totalPicks,
      positionFrequencies,
      averageDraftPositions: positionFrequencies,
      mostFrequentPlayers,
      roundTendencies: {
        earlyRounds: {
          count: earlyRoundPicks,
          percentage: Math.round((earlyRoundPicks / totalPicks) * 100),
        },
        lateRounds: {
          count: lateRoundPicks,
          percentage: Math.round((lateRoundPicks / totalPicks) * 100),
        },
      },
      yearOverYearTrends: {}, // TODO: Implement year-over-year analysis
    };
  }

  /**
   * Assess data quality for manager picks
   */
  assessDataQuality(picks) {
    if (!picks || picks.length === 0) {
      return "none";
    }

    if (picks.length < 5) {
      return "insufficient";
    } else if (picks.length < 20) {
      return "limited";
    } else {
      return "good";
    }
  }

  /**
   * Cleanup method
   */
  cleanup() {
    if (this.abortController) {
      this.abortController.abort();
    }
    // Clear both local cache and Sleeper API cache
    this.clearCache();
    managerHistoryService.clearCache();
  }
}

/**
 * Factory function for creating HistoricalDataManager instances
 */
export function createHistoricalDataManager() {
  return new HistoricalDataManager();
}

/**
 * Utility functions for Sleeper API historical data
 */
export const HistoricalDataUtils = {
  /**
   * Validates if sufficient Sleeper API data exists for analytics
   */
  hasSufficientData(managerData, minPicks = 5) {
    return (
      managerData &&
      managerData.picks &&
      managerData.picks.length >= minPicks &&
      managerData.seasons &&
      managerData.seasons.length > 0
    );
  },

  /**
   * Gets data quality assessment for Sleeper API data
   */
  assessDataQuality(managerData) {
    if (!managerData || !managerData.picks) {
      return { quality: "none", score: 0, issues: ["No historical draft data available from Sleeper API"] };
    }

    const issues = [];
    let score = 100;

    // Check pick count
    if (managerData.picks.length < 5) {
      issues.push("Very few draft picks available from Sleeper API");
      score -= 30;
    } else if (managerData.picks.length < 20) {
      issues.push("Limited draft history from Sleeper API");
      score -= 15;
    }

    // Check season coverage
    if (managerData.seasons.length < 2) {
      issues.push("Single season data only");
      score -= 20;
    }

    // Check data completeness for Sleeper API format
    const picksWithoutPlayerData = managerData.picks.filter(
      (pick) => !pick.player_id || !pick.player_data
    ).length;

    if (picksWithoutPlayerData > 0) {
      issues.push(`${picksWithoutPlayerData} picks missing player data from Sleeper API`);
      score -= Math.min(25, picksWithoutPlayerData * 2);
    }

    // Determine quality level
    let quality;
    if (score >= 80) quality = "excellent";
    else if (score >= 60) quality = "good";
    else if (score >= 40) quality = "fair";
    else if (score >= 20) quality = "poor";
    else quality = "insufficient";

    return { quality, score: Math.max(0, score), issues };
  },

  /**
   * Formats error messages for user display (Sleeper API specific)
   */
  formatErrorMessage(error) {
    if (!error) return null;

    if (typeof error === "string") {
      return error;
    }

    if (error.message) {
      // Sleeper API specific errors
      if (error.message.includes("User") && error.message.includes("not found")) {
        return "User not found on Sleeper. Please check the username and try again.";
      }

      if (error.message.includes("League") && error.message.includes("not found")) {
        return "League not found on Sleeper. The league may be private or deleted.";
      }

      // Network errors
      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")
      ) {
        return "Unable to connect to Sleeper API. Please check your internet connection and try again.";
      }

      // Timeout errors
      if (error.message.includes("timeout")) {
        return "Request to Sleeper API timed out. Please try again.";
      }

      // Data validation errors
      if (error.message.includes("validation failed")) {
        return "The data from Sleeper API is invalid. Please contact support if this persists.";
      }

      return error.message;
    }

    return "An unexpected error occurred while fetching data from Sleeper API. Please try again.";
  },
};

export default HistoricalDataManager;
