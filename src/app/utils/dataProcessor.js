/**
 * Fantasy Football Data Processing Utilities
 * Transforms raw fantasy football data into cleaner, structured format
 */

/**
 * Processes a single player's data into the desired clean format
 * @param {Object} player - Raw player data
 * @returns {Object} Processed player data
 */
export const processPlayer = (player) => {
  if (!player) return null;

  console.log('Processing player keys:', Object.keys(player));
  
  // Check if player data might be nested or have different structure
  let playerData = player;
  
  // If there's a player_info field, use that
  if (player.player_info) {
    playerData = player.player_info;
    console.log('Found player_info field:', playerData);
  }
  
  // Look for player info in various possible locations
  const findPlayerInfo = (data) => {
    // Try to find player info in the data structure
    if (data.name || data.player_name) return data;
    if (data.player_info) return data.player_info;
    if (data.info) return data.info;
    
    // Check if seasons data contains player info
    if (data.seasons) {
      const seasons = Object.values(data.seasons);
      for (const season of seasons) {
        if (season.player_name || season.name) return season;
        if (season.stats && Object.values(season.stats).length > 0) {
          const firstStat = Object.values(season.stats).find(s => s && s.player_name);
          if (firstStat) return firstStat;
        }
      }
    }
    
    return data;
  };
  
  const playerInfo = findPlayerInfo(player);
  console.log('Found player info:', playerInfo);

  // Extract and structure player info - handle different possible data structures
  const processedPlayerInfo = {
    player_id: playerInfo.player_id || playerInfo.id || null,
    name: playerInfo.name || playerInfo.player_name || '',
    position: playerInfo.position || playerInfo.pos || '',
    team: playerInfo.team || playerInfo.team_abbr || '',
    age: playerInfo.age || null,
    height: playerInfo.height || null,
    weight: playerInfo.weight || null,
    years_exp: playerInfo.years_exp || playerInfo.experience || null,
    rookie_year: playerInfo.rookie_year || null,
    birth_date: playerInfo.birth_date || playerInfo.birthdate || null,
    college: playerInfo.college || '',
    status: playerInfo.status || 'Unknown',
    injury_status: playerInfo.injury_status || null,
    projection_season_adp: playerInfo.projection_season_adp || {
      adp: null,
      adp_formatted: null,
      source: "Not Available",
      last_updated: new Date().toISOString(),
      sample_size: null
    },
    created_at: playerInfo.created_at || new Date().toISOString(),
    updated_at: playerInfo.updated_at || new Date().toISOString(),
    position_rank: playerInfo.position_rank || null,
    overall_rank: playerInfo.overall_rank || null,
    projected_2025_points: playerInfo.projected_2025_points || null
  };

  console.log('Final processed player info:', processedPlayerInfo);

  // Process seasons data
  const seasons = {};
  if (player.seasons && typeof player.seasons === 'object') {
    Object.keys(player.seasons).forEach(seasonYear => {
      const seasonData = player.seasons[seasonYear];
      if (seasonData) {
        seasons[seasonYear] = {
          season: parseInt(seasonYear),
          stats: seasonData.stats || {},
          projections: seasonData.projections || {},
          season_totals: seasonData.season_totals || {},
          season_projected_totals: seasonData.season_projected_totals || {},
          fantasy_points: seasonData.fantasy_points || 0,
          projected_fantasy_points: seasonData.projected_fantasy_points || 0
        };
      }
    });
  }

  return {
    player_info: playerInfo,
    seasons: seasons,
    career_totals: player.career_totals || {},
    career_fantasy_points: player.career_fantasy_points || 0
  };
};

/**
 * Processes the entire fantasy football database
 * @param {Object} rawData - Raw fantasy football database
 * @returns {Object} Processed data with cleaner structure
 */
export const processFantasyDatabase = (rawData) => {
  if (!rawData) {
    throw new Error('No data provided');
  }

  console.log('Processing raw data:', rawData);
  console.log('Raw data keys:', Object.keys(rawData));

  if (!rawData.players || !Array.isArray(rawData.players)) {
    throw new Error('Invalid data format: players must be an array');
  }

  console.log('Raw players sample:', rawData.players.slice(0, 2));

  const processedPlayers = rawData.players
    .map((player, index) => {
      console.log(`Processing player ${index}:`, player);
      return processPlayer(player);
    })
    .filter(player => player !== null); // Remove any null results

  console.log('Processed players sample:', processedPlayers.slice(0, 2));

  return {
    players: processedPlayers,
    metadata: {
      total_players: processedPlayers.length,
      processed_at: new Date().toISOString(),
      data_version: rawData.version || '1.0',
      original_player_count: rawData.players.length
    }
  };
};

/**
 * Loads fantasy football data from a file path
 * @param {string} filePath - Path to the JSON file
 * @returns {Promise<Object>} Processed fantasy football data
 */
export const loadAndProcessFantasyData = async (filePath = '/db/fantasy_football_db.json') => {
  try {
    const response = await fetch(filePath);
    
    if (!response.ok) {
      throw new Error(`Failed to load data from ${filePath}: ${response.status} ${response.statusText}`);
    }

    const rawData = await response.json();
    return processFantasyDatabase(rawData);
  } catch (error) {
    console.error('Error loading and processing fantasy data:', error);
    throw error;
  }
};

/**
 * Filters processed players by position
 * @param {Array} players - Array of processed players
 * @param {string} position - Position to filter by (QB, RB, WR, TE)
 * @returns {Array} Filtered players
 */
export const filterPlayersByPosition = (players, position) => {
  if (!Array.isArray(players)) return [];
  return players.filter(player => 
    player.player_info && player.player_info.position === position
  );
};

/**
 * Filters processed players by team
 * @param {Array} players - Array of processed players
 * @param {string} team - Team abbreviation to filter by
 * @returns {Array} Filtered players
 */
export const filterPlayersByTeam = (players, team) => {
  if (!Array.isArray(players)) return [];
  return players.filter(player => 
    player.player_info && player.player_info.team === team
  );
};

/**
 * Gets player statistics for a specific season
 * @param {Object} player - Processed player object
 * @param {number|string} season - Season year
 * @returns {Object|null} Season stats or null if not found
 */
export const getPlayerSeasonStats = (player, season) => {
  if (!player || !player.seasons) return null;
  return player.seasons[season.toString()] || null;
};

/**
 * Calculates total fantasy points across all seasons for a player
 * @param {Object} player - Processed player object
 * @returns {number} Total fantasy points
 */
export const calculateTotalFantasyPoints = (player) => {
  if (!player || !player.seasons) return 0;
  
  return Object.values(player.seasons).reduce((total, season) => {
    return total + (season.fantasy_points || 0);
  }, 0);
};

/**
 * Gets the most recent season data for a player
 * @param {Object} player - Processed player object
 * @returns {Object|null} Most recent season data
 */
export const getMostRecentSeason = (player) => {
  if (!player || !player.seasons) return null;
  
  const seasons = Object.keys(player.seasons).map(Number).sort((a, b) => b - a);
  if (seasons.length === 0) return null;
  
  return player.seasons[seasons[0].toString()];
};

export default {
  processPlayer,
  processFantasyDatabase,
  loadAndProcessFantasyData,
  filterPlayersByPosition,
  filterPlayersByTeam,
  getPlayerSeasonStats,
  calculateTotalFantasyPoints,
  getMostRecentSeason
};