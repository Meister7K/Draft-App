/**
 * DataProcessor Component
 * Processes fantasy football database into cleaner, more structured format
 */

import { useState, useEffect } from 'react';

const DataProcessor = ({ onDataProcessed }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Processes raw fantasy football data into cleaner format
   * @param {Object} rawData - Raw fantasy football database
   * @returns {Object} Processed data with cleaner structure
   */
  const processFantasyData = (rawData) => {
    if (!rawData || !rawData.players) {
      throw new Error('Invalid data format: missing players array');
    }

    const processedPlayers = rawData.players.map(player => {
      // Extract player info
      const playerInfo = {
        player_id: player.player_id,
        name: player.name,
        position: player.position,
        team: player.team,
        age: player.age,
        height: player.height,
        weight: player.weight,
        years_exp: player.years_exp,
        rookie_year: player.rookie_year,
        birth_date: player.birth_date,
        college: player.college,
        status: player.status,
        injury_status: player.injury_status,
        projection_season_adp: player.projection_season_adp || {
          adp: null,
          adp_formatted: null,
          source: "Not Available",
          last_updated: new Date().toISOString(),
          sample_size: null
        },
        created_at: player.created_at || new Date().toISOString(),
        updated_at: player.updated_at || new Date().toISOString(),
        position_rank: player.position_rank,
        overall_rank: player.overall_rank,
        projected_2025_points: player.projected_2025_points
      };

      // Process seasons data
      const seasons = {};
      if (player.seasons) {
        Object.keys(player.seasons).forEach(seasonYear => {
          const seasonData = player.seasons[seasonYear];
          seasons[seasonYear] = {
            season: parseInt(seasonYear),
            stats: seasonData.stats || {},
            projections: seasonData.projections || {},
            season_totals: seasonData.season_totals || {},
            season_projected_totals: seasonData.season_projected_totals || {},
            fantasy_points: seasonData.fantasy_points || 0,
            projected_fantasy_points: seasonData.projected_fantasy_points || 0
          };
        });
      }

      // Add career totals and fantasy points
      const careerTotals = player.career_totals || {};
      const careerFantasyPoints = player.career_fantasy_points || 0;

      return {
        player_info: playerInfo,
        seasons: seasons,
        career_totals: careerTotals,
        career_fantasy_points: careerFantasyPoints
      };
    });

    return {
      players: processedPlayers,
      metadata: {
        total_players: processedPlayers.length,
        processed_at: new Date().toISOString(),
        data_version: rawData.version || '1.0'
      }
    };
  };

  /**
   * Loads and processes fantasy football data from JSON file
   */
  const loadAndProcessData = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Try to load from the public directory first
      let response = await fetch('/db/fantasy_football_db.json');
      
      // If not found, try the src/app/db directory
      if (!response.ok) {
        response = await fetch('/api/fantasy-data');
      }

      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status}`);
      }

      const rawData = await response.json();
      const processed = processFantasyData(rawData);
      
      setProcessedData(processed);
      
      if (onDataProcessed) {
        onDataProcessed(processed);
      }

    } catch (err) {
      console.error('Error processing fantasy data:', err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Exports processed data as JSON file
   */
  const exportProcessedData = () => {
    if (!processedData) return;

    const dataStr = JSON.stringify(processedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `processed_fantasy_data_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  return (
    <div className="data-processor p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Fantasy Football Data Processor</h2>
      
      <div className="mb-4">
        <button
          onClick={loadAndProcessData}
          disabled={isProcessing}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2 disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : 'Process Data'}
        </button>
        
        {processedData && (
          <button
            onClick={exportProcessedData}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Export Processed Data
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {processedData && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <strong>Success:</strong> Processed {processedData.players.length} players
          <div className="mt-2 text-sm">
            <p>Data processed at: {processedData.metadata.processed_at}</p>
            <p>Total players: {processedData.metadata.total_players}</p>
          </div>
        </div>
      )}

      {processedData && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Sample Processed Data Structure:</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
            {JSON.stringify(processedData.players[0], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DataProcessor;