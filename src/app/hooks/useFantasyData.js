import { useState, useEffect, useCallback } from 'react';
import { 
  loadAndProcessFantasyData, 
  filterPlayersByPosition, 
  filterPlayersByTeam,
  getPlayerSeasonStats,
  calculateTotalFantasyPoints,
  getMostRecentSeason
} from '../utils/dataProcessor';

/**
 * Custom hook for managing fantasy football data
 * @param {Object} options - Configuration options
 * @returns {Object} Hook state and methods
 */
export const useFantasyData = (options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const { autoLoad = false, filePath } = options;

  /**
   * Loads and processes fantasy data
   */
  const loadData = useCallback(async (customFilePath) => {
    setLoading(true);
    setError(null);

    try {
      let processedData;
      
      // Try API route first for better performance with large files
      try {
        const response = await fetch('/api/process-fantasy-data');
        if (response.ok) {
          processedData = await response.json();
        } else {
          throw new Error('API route failed');
        }
      } catch (apiError) {
        // Fallback to client-side processing
        console.warn('API route failed, falling back to client-side processing:', apiError);
        processedData = await loadAndProcessFantasyData(customFilePath || filePath);
      }

      setData(processedData);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('Error loading fantasy data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  /**
   * Refreshes the data
   */
  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  /**
   * Filters players by position
   */
  const getPlayersByPosition = useCallback((position) => {
    if (!data || !data.players) return [];
    return filterPlayersByPosition(data.players, position);
  }, [data]);

  /**
   * Filters players by team
   */
  const getPlayersByTeam = useCallback((team) => {
    if (!data || !data.players) return [];
    return filterPlayersByTeam(data.players, team);
  }, [data]);

  /**
   * Gets a specific player by ID
   */
  const getPlayerById = useCallback((playerId) => {
    if (!data || !data.players) return null;
    return data.players.find(player => 
      player.player_info && player.player_info.player_id === playerId
    );
  }, [data]);

  /**
   * Gets player season stats
   */
  const getSeasonStats = useCallback((playerId, season) => {
    const player = getPlayerById(playerId);
    if (!player) return null;
    return getPlayerSeasonStats(player, season);
  }, [getPlayerById]);

  /**
   * Gets total fantasy points for a player
   */
  const getTotalFantasyPoints = useCallback((playerId) => {
    const player = getPlayerById(playerId);
    if (!player) return 0;
    return calculateTotalFantasyPoints(player);
  }, [getPlayerById]);

  /**
   * Gets most recent season for a player
   */
  const getRecentSeason = useCallback((playerId) => {
    const player = getPlayerById(playerId);
    if (!player) return null;
    return getMostRecentSeason(player);
  }, [getPlayerById]);

  /**
   * Gets all available positions
   */
  const getPositions = useCallback(() => {
    if (!data || !data.players) return [];
    const positions = new Set();
    data.players.forEach(player => {
      if (player.player_info && player.player_info.position) {
        positions.add(player.player_info.position);
      }
    });
    return Array.from(positions).sort();
  }, [data]);

  /**
   * Gets all available teams
   */
  const getTeams = useCallback(() => {
    if (!data || !data.players) return [];
    const teams = new Set();
    data.players.forEach(player => {
      if (player.player_info && player.player_info.team) {
        teams.add(player.player_info.team);
      }
    });
    return Array.from(teams).sort();
  }, [data]);

  /**
   * Gets all available seasons
   */
  const getSeasons = useCallback(() => {
    if (!data || !data.players) return [];
    const seasons = new Set();
    data.players.forEach(player => {
      if (player.seasons) {
        Object.keys(player.seasons).forEach(season => {
          seasons.add(parseInt(season));
        });
      }
    });
    return Array.from(seasons).sort((a, b) => b - a);
  }, [data]);

  // Auto-load data if requested
  useEffect(() => {
    if (autoLoad) {
      loadData();
    }
  }, [autoLoad, loadData]);

  return {
    // Data state
    data,
    players: data?.players || [],
    metadata: data?.metadata || null,
    loading,
    error,
    lastUpdated,

    // Actions
    loadData,
    refresh,

    // Query methods
    getPlayersByPosition,
    getPlayersByTeam,
    getPlayerById,
    getSeasonStats,
    getTotalFantasyPoints,
    getRecentSeason,

    // Utility methods
    getPositions,
    getTeams,
    getSeasons,

    // Computed values
    totalPlayers: data?.players?.length || 0,
    isLoaded: !!data && !loading
  };
};

export default useFantasyData;