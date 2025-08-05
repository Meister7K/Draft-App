/**
 * Sleeper API Integration
 * Handles all Sleeper API calls for draft analytics
 */

const SLEEPER_API_BASE = "https://api.sleeper.app/v1";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Simple in-memory cache
const apiCache = new Map();
const cacheTimestamps = new Map();

/**
 * Cache utilities
 */
const CacheUtils = {
  set(key, data) {
    apiCache.set(key, data);
    cacheTimestamps.set(key, Date.now());
  },

  get(key) {
    const timestamp = cacheTimestamps.get(key);
    if (!timestamp || Date.now() - timestamp > CACHE_DURATION) {
      apiCache.delete(key);
      cacheTimestamps.delete(key);
      return null;
    }
    return apiCache.get(key);
  },

  clear() {
    apiCache.clear();
    cacheTimestamps.clear();
  },
};

/**
 * HTTP utilities with timeout and error handling
 */
const HttpUtils = {
  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error("Request timeout - Sleeper API may be slow");
      }

      throw error;
    }
  },

  async retryRequest(fn, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  },
};

/**
 * Sleeper API client
 */
export class SleeperApiClient {
  /**
   * Get user information by username
   */
  async getUser(username) {
    const cacheKey = `user_${username}`;
    const cached = CacheUtils.get(cacheKey);
    if (cached) return cached;

    const url = `${SLEEPER_API_BASE}/user/${username}`;

    try {
      const response = await HttpUtils.retryRequest(() =>
        HttpUtils.fetchWithTimeout(url)
      );

      const userData = await response.json();

      if (!userData || !userData.user_id) {
        throw new Error(`User '${username}' not found`);
      }

      CacheUtils.set(cacheKey, userData);
      return userData;
    } catch (error) {
      throw new Error(`Failed to fetch user data: ${error.message}`);
    }
  }

  /**
   * Get all leagues for a user by user ID
   */
  async getUserLeagues(userId, season = "2024") {
    const cacheKey = `leagues_${userId}_${season}`;
    const cached = CacheUtils.get(cacheKey);
    if (cached) return cached;

    const url = `${SLEEPER_API_BASE}/user/${userId}/leagues/nfl/${season}`;

    try {
      const response = await HttpUtils.retryRequest(() =>
        HttpUtils.fetchWithTimeout(url)
      );

      const leagues = await response.json();

      if (!Array.isArray(leagues)) {
        return [];
      }

      CacheUtils.set(cacheKey, leagues);
      return leagues;
    } catch (error) {
      console.warn(
        `Failed to fetch leagues for user ${userId}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Get league information
   */
  async getLeague(leagueId) {
    const cacheKey = `league_${leagueId}`;
    const cached = CacheUtils.get(cacheKey);
    if (cached) return cached;

    const url = `${SLEEPER_API_BASE}/league/${leagueId}`;

    try {
      const response = await HttpUtils.retryRequest(() =>
        HttpUtils.fetchWithTimeout(url)
      );

      const league = await response.json();

      if (!league || !league.league_id) {
        throw new Error(`League ${leagueId} not found`);
      }

      CacheUtils.set(cacheKey, league);
      return league;
    } catch (error) {
      throw new Error(`Failed to fetch league data: ${error.message}`);
    }
  }

  /**
   * Get all drafts for a league
   */
  async getLeagueDrafts(leagueId) {
    const cacheKey = `drafts_${leagueId}`;
    const cached = CacheUtils.get(cacheKey);
    if (cached) return cached;

    const url = `${SLEEPER_API_BASE}/league/${leagueId}/drafts`;

    try {
      const response = await HttpUtils.retryRequest(() =>
        HttpUtils.fetchWithTimeout(url)
      );

      const drafts = await response.json();

      if (!Array.isArray(drafts)) {
        return [];
      }

      CacheUtils.set(cacheKey, drafts);
      return drafts;
    } catch (error) {
      console.warn(
        `Failed to fetch drafts for league ${leagueId}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Get draft picks for a specific draft
   */
  async getDraftPicks(draftId) {
    const cacheKey = `picks_${draftId}`;
    const cached = CacheUtils.get(cacheKey);
    if (cached) return cached;

    const url = `${SLEEPER_API_BASE}/draft/${draftId}/picks`;

    try {
      const response = await HttpUtils.retryRequest(() =>
        HttpUtils.fetchWithTimeout(url)
      );

      const picks = await response.json();

      if (!Array.isArray(picks)) {
        return [];
      }

      CacheUtils.set(cacheKey, picks);
      return picks;
    } catch (error) {
      console.warn(
        `Failed to fetch picks for draft ${draftId}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Get league users/rosters
   */
  async getLeagueUsers(leagueId) {
    const cacheKey = `users_${leagueId}`;
    const cached = CacheUtils.get(cacheKey);
    if (cached) return cached;

    const url = `${SLEEPER_API_BASE}/league/${leagueId}/users`;

    try {
      const response = await HttpUtils.retryRequest(() =>
        HttpUtils.fetchWithTimeout(url)
      );

      const users = await response.json();

      if (!Array.isArray(users)) {
        return [];
      }

      CacheUtils.set(cacheKey, users);
      return users;
    } catch (error) {
      console.warn(
        `Failed to fetch users for league ${leagueId}:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Get NFL players data
   */
  async getNflPlayers() {
    const cacheKey = "nfl_players";
    const cached = CacheUtils.get(cacheKey);
    if (cached) return cached;

    const url = `${SLEEPER_API_BASE}/players/nfl`;

    try {
      const response = await HttpUtils.retryRequest(() =>
        HttpUtils.fetchWithTimeout(url)
      );

      const players = await response.json();

      if (!players || typeof players !== "object") {
        throw new Error("Invalid players data format");
      }

      // Cache for longer since player data doesn't change often
      apiCache.set(cacheKey, players);
      cacheTimestamps.set(cacheKey, Date.now());

      return players;
    } catch (error) {
      throw new Error(`Failed to fetch NFL players: ${error.message}`);
    }
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    CacheUtils.clear();
  }
}

/**
 * Manager Historical Data Service
 * Aggregates draft data across multiple seasons for a specific manager
 */
export class ManagerHistoricalDataService {
  constructor() {
    this.apiClient = new SleeperApiClient();
  }

  /**
   * Get comprehensive historical draft data for a manager
   */
  async getManagerDraftHistory(userId, seasons = ["2024", "2023", "2022"]) {
    try {
      const allPicks = [];
      const allLeagues = [];
      const seasonsWithData = [];
      console.log(
        "[sleeperApi] getManagerDraftHistory called for userId:",
        userId,
        "seasons:",
        seasons
      );
      console.log(
        "[sleeperApi] userId type:",
        typeof userId,
        "userId value:",
        userId
      );
      // Get data for each season
      for (const season of seasons) {
        try {
          console.log(
            `[sleeperApi] Fetching leagues for userId ${userId} season ${season}`
          );
          const leagues = await this.apiClient.getUserLeagues(userId, season);
          console.log(
            `[sleeperApi] Season ${season} leagues:`,
            leagues?.length
          );
          if (leagues?.length === 0) {
            console.log(
              `[sleeperApi] No leagues found for userId ${userId} in season ${season}`
            );
          }
          for (const league of leagues) {
            // Get drafts for this league
            const drafts = await this.apiClient.getLeagueDrafts(
              league.league_id
            );
            console.log(
              `[sleeperApi] League ${league.league_id} drafts:`,
              drafts?.length
            );
            for (const draft of drafts) {
              if (draft.status === "complete") {
                const picks = await this.apiClient.getDraftPicks(
                  draft.draft_id
                );
                console.log(
                  `[sleeperApi] Draft ${draft.draft_id} picks:`,
                  picks?.length
                );
                // Filter picks for this specific user
                const userPicks = picks
                  .filter((pick) => pick.picked_by === userId)
                  .map((pick) => ({
                    ...pick,
                    season,
                    league_id: league.league_id,
                    league_name: league.name,
                    draft_id: draft.draft_id,
                    draft_type: draft.type,
                  }));
                if (userPicks.length > 0) {
                  console.log(
                    `[sleeperApi] User picks for draft ${draft.draft_id}:`,
                    userPicks.length
                  );
                }
                allPicks.push(...userPicks);
              }
            }
            allLeagues.push({
              ...league,
              season,
            });
          }
          if (leagues.length > 0) {
            seasonsWithData.push(season);
          }
        } catch (error) {
          console.error(
            `[sleeperApi] Failed to get data for season ${season}:`,
            error.message,
            error
          );
        }
      }
      console.log("[sleeperApi] getManagerDraftHistory result:", {
        totalPicks: allPicks.length,
        totalLeagues: allLeagues.length,
        seasonsWithData,
      });
      return {
        managerId: userId,
        picks: allPicks,
        leagues: allLeagues,
        seasons: seasonsWithData,
        totalPicks: allPicks.length,
        dateRange: {
          startSeason: seasonsWithData[seasonsWithData.length - 1],
          endSeason: seasonsWithData[0],
        },
      };
    } catch (error) {
      console.error("[sleeperApi] Failed to get manager draft history:", error);
      throw new Error(`Failed to get manager draft history: ${error.message}`);
    }
  }

  /**
   * Get enhanced manager data with player information
   */
  async getEnhancedManagerData(
    userId,
    seasons = ["2024", "2023", "2022", "2021", "2020", "2019", "2018"]
  ) {
    try {
      console.log(
        "[sleeperApi] getEnhancedManagerData called for userId:",
        userId,
        "seasons:",
        seasons
      );
      // Get basic draft history
      const draftHistory = await this.getManagerDraftHistory(userId, seasons);
      console.log("[sleeperApi] draftHistory:", draftHistory);
      // Get NFL players data for enhanced information
      const nflPlayers = await this.apiClient.getNflPlayers();
      console.log(
        "[sleeperApi] nflPlayers keys:",
        nflPlayers ? Object.keys(nflPlayers).length : 0
      );
      // Enhance picks with player data
      const enhancedPicks = draftHistory.picks.map((pick) => {
        const playerData = nflPlayers[pick.player_id];
        return {
          ...pick,
          player_data: playerData
            ? {
                name: `${playerData.first_name} ${playerData.last_name}`,
                position: playerData.position,
                team: playerData.team,
                age: playerData.age,
                years_exp: playerData.years_exp,
              }
            : null,
        };
      });
      console.log("[sleeperApi] enhancedPicks:", enhancedPicks.length);
      return {
        ...draftHistory,
        picks: enhancedPicks,
        playerDatabase: nflPlayers,
      };
    } catch (error) {
      console.error("[sleeperApi] Failed to get enhanced manager data:", error);
      throw new Error(`Failed to get enhanced manager data: ${error.message}`);
    }
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.apiClient.clearCache();
  }
}

// Export singleton instances
export const sleeperApi = new SleeperApiClient();
export const managerHistoryService = new ManagerHistoricalDataService();

export default SleeperApiClient;
