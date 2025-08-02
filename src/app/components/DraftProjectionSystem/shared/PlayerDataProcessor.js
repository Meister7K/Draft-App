/**
 * PlayerDataProcessor - Loads and processes fantasy_football_db_summary.json
 * Provides structured access to player data for draft projections
 */

export class PlayerDataProcessor {
  constructor() {
    this.playerData = null;
    this.processedPlayers = null;
    this.playersByPosition = null;
    this.playersByTeam = null;
  }

  /**
   * Load and process the fantasy football database
   * @returns {Promise<Object>} Processed player data
   */
  async loadPlayerData() {
    try {
      const response = await fetch('/db/fantasy_football_db_summary.json');
      if (!response.ok) {
        throw new Error(`Failed to load player data: ${response.status}`);
      }
      
      this.playerData = await response.json();
      this.processedPlayers = this.processPlayerData();
      this.playersByPosition = this.groupPlayersByPosition();
      this.playersByTeam = this.groupPlayersByTeam();
      
      return {
        players: this.processedPlayers,
        byPosition: this.playersByPosition,
        byTeam: this.playersByTeam,
        metadata: {
          totalPlayers: this.playerData.total_players,
          positions: this.playerData.positions,
          teams: this.playerData.teams
        }
      };
    } catch (error) {
      console.error('Error loading player data:', error);
      throw error;
    }
  }

  /**
   * Process raw player data into a unified format
   * @returns {Array} Array of processed player objects
   */
  processPlayerData() {
    if (!this.playerData?.top_players_by_projected_points) {
      throw new Error('Invalid player data format');
    }

    const allPlayers = [];
    const positions = ['QB', 'RB', 'WR', 'TE'];

    positions.forEach(position => {
      const positionPlayers = this.playerData.top_players_by_projected_points[position] || [];
      
      positionPlayers.forEach(player => {
        // Extract ADP data from full player database if available
        const adpData = this.extractADPData(player);
        
        allPlayers.push({
          ...player,
          position,
          id: `${player.name}_${player.team}_${position}`, // Unique identifier
          tier: this.calculatePlayerTier(player, position),
          scarcityScore: 0, // Will be calculated later
          competitionLevel: 'medium', // Default value
          adp: adpData.adp_ppr || adpData.adp_half_ppr || adpData.adp_std || null, // Primary ADP for calculations
          adpData: adpData // Full ADP data for different formats
        });
      });
    });

    // Sort by overall rank
    return allPlayers.sort((a, b) => a.overall_rank - b.overall_rank);
  }

  /**
   * Extract ADP data from player object
   * @param {Object} player - Raw player object
   * @returns {Object} ADP data object
   */
  extractADPData(player) {
    // Try to find ADP data from various sources
    const adpData = {
      adp_ppr: null,
      adp_half_ppr: null,
      adp_std: null,
      adp_2qb: null,
      adp_dynasty: null,
      adp_rookie: null
    };

    // Check if player has season_projected_totals with ADP data
    if (player.season_projected_totals) {
      Object.keys(adpData).forEach(adpKey => {
        if (player.season_projected_totals[adpKey] && 
            player.season_projected_totals[adpKey] !== 999) { // 999 seems to be a placeholder
          adpData[adpKey] = player.season_projected_totals[adpKey];
        }
      });
    }

    // Check if player has projection_season_adp
    if (player.projection_season_adp?.adp) {
      adpData.adp_ppr = player.projection_season_adp.adp;
    }

    // Fallback: generate mock ADP based on overall rank for testing
    if (!adpData.adp_ppr && !adpData.adp_half_ppr && !adpData.adp_std) {
      // Generate reasonable ADP based on overall rank
      const mockADP = this.generateMockADP(player);
      adpData.adp_ppr = mockADP;
      adpData.adp_half_ppr = Math.max(1, mockADP + (Math.random() - 0.5) * 4); // Slight variation, min 1
      adpData.adp_std = Math.max(1, mockADP + (Math.random() - 0.5) * 6); // More variation, min 1
    }

    return adpData;
  }

  /**
   * Generate mock ADP data based on player rank for testing purposes
   * @param {Object} player - Player object
   * @returns {Number} Mock ADP value
   */
  generateMockADP(player) {
    if (!player.overall_rank) return 150;
    
    // Generate ADP with some variance around overall rank
    const baseADP = player.overall_rank;
    const variance = (Math.random() - 0.5) * 20; // ±10 variance, centered around 0
    const mockADP = Math.max(1, Math.min(200, baseADP + variance));
    
    return Math.round(mockADP * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Calculate player tier based on position and projected points
   * @param {Object} player - Player object
   * @param {String} position - Player position
   * @returns {Number} Tier number (1-5)
   */
  calculatePlayerTier(player, position) {
    const positionPlayers = this.playerData.top_players_by_projected_points[position] || [];
    const totalPlayers = positionPlayers.length;
    
    if (totalPlayers === 0) return 5;
    
    const percentile = (player.position_rank - 1) / totalPlayers;
    
    if (percentile <= 0.1) return 1; // Top 10%
    if (percentile <= 0.25) return 2; // Top 25%
    if (percentile <= 0.5) return 3; // Top 50%
    if (percentile <= 0.75) return 4; // Top 75%
    return 5; // Bottom 25%
  }

  /**
   * Group players by position
   * @returns {Object} Players grouped by position
   */
  groupPlayersByPosition() {
    if (!this.processedPlayers) return {};
    
    return this.processedPlayers.reduce((acc, player) => {
      if (!acc[player.position]) {
        acc[player.position] = [];
      }
      acc[player.position].push(player);
      return acc;
    }, {});
  }

  /**
   * Group players by team
   * @returns {Object} Players grouped by team
   */
  groupPlayersByTeam() {
    if (!this.processedPlayers) return {};
    
    return this.processedPlayers.reduce((acc, player) => {
      if (!acc[player.team]) {
        acc[player.team] = [];
      }
      acc[player.team].push(player);
      return acc;
    }, {});
  }

  /**
   * Get players by position with optional filtering
   * @param {String} position - Position to filter by
   * @param {Object} filters - Optional filters (tier, minPoints, etc.)
   * @returns {Array} Filtered players
   */
  getPlayersByPosition(position, filters = {}) {
    let players = this.playersByPosition?.[position] || [];
    
    if (filters.tier) {
      players = players.filter(p => p.tier === filters.tier);
    }
    
    if (filters.minPoints) {
      players = players.filter(p => p.projected_2025_points >= filters.minPoints);
    }
    
    if (filters.maxRank) {
      players = players.filter(p => p.position_rank <= filters.maxRank);
    }
    
    return players;
  }

  /**
   * Get top N players by position
   * @param {String} position - Position to filter by
   * @param {Number} count - Number of top players to return
   * @returns {Array} Top players
   */
  getTopPlayersByPosition(position, count = 10) {
    const players = this.playersByPosition?.[position] || [];
    return players
      .sort((a, b) => a.position_rank - b.position_rank)
      .slice(0, count);
  }

  /**
   * Find player by name and position
   * @param {String} name - Player name
   * @param {String} position - Player position (optional)
   * @returns {Object|null} Player object or null if not found
   */
  findPlayer(name, position = null) {
    if (!this.processedPlayers) return null;
    
    return this.processedPlayers.find(player => {
      const nameMatch = player.name.toLowerCase() === name.toLowerCase();
      const positionMatch = !position || player.position === position;
      return nameMatch && positionMatch;
    }) || null;
  }

  /**
   * Get player statistics for a position
   * @param {String} position - Position to analyze
   * @returns {Object} Position statistics
   */
  getPositionStats(position) {
    const players = this.playersByPosition?.[position] || [];
    
    if (players.length === 0) {
      return {
        count: 0,
        avgPoints: 0,
        topPoints: 0,
        bottomPoints: 0,
        pointsRange: 0
      };
    }
    
    const points = players.map(p => p.projected_2025_points);
    const avgPoints = points.reduce((sum, pts) => sum + pts, 0) / points.length;
    const topPoints = Math.max(...points);
    const bottomPoints = Math.min(...points);
    
    return {
      count: players.length,
      avgPoints: Math.round(avgPoints * 100) / 100,
      topPoints,
      bottomPoints,
      pointsRange: Math.round((topPoints - bottomPoints) * 100) / 100
    };
  }

  /**
   * Check if data is loaded
   * @returns {Boolean} True if data is loaded
   */
  isDataLoaded() {
    return this.processedPlayers !== null;
  }

  /**
   * Get all processed players
   * @returns {Array} All processed players
   */
  getAllPlayers() {
    return this.processedPlayers || [];
  }
}

// Export singleton instance
export const playerDataProcessor = new PlayerDataProcessor();