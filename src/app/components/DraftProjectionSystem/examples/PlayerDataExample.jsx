/**
 * Example component demonstrating PlayerDataProcessor usage
 * This can be used to test the data loading functionality
 */

'use client';

import { useState, useEffect } from 'react';
import { playerDataProcessor } from '../shared/PlayerDataProcessor.js';

export default function PlayerDataExample() {
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await playerDataProcessor.loadPlayerData();
      setPlayerData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <div className="p-4">Loading player data...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <h3>Error loading data:</h3>
        <p>{error}</p>
        <button 
          onClick={loadData}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!playerData) {
    return <div className="p-4">No data available</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold">Player Data Example</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold">Total Players</h3>
          <p className="text-2xl">{playerData.metadata.totalPlayers}</p>
        </div>
        
        {Object.entries(playerData.metadata.positions).map(([position, count]) => (
          <div key={position} className="bg-gray-100 p-4 rounded">
            <h3 className="font-semibold">{position}</h3>
            <p className="text-2xl">{count}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Top 5 Players by Position</h3>
        
        {['QB', 'RB', 'WR', 'TE'].map(position => (
          <div key={position} className="border rounded p-4">
            <h4 className="font-semibold mb-2">{position}</h4>
            <div className="space-y-2">
              {playerDataProcessor.getTopPlayersByPosition(position, 5).map((player, index) => (
                <div key={player.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                  <div>
                    <span className="font-medium">{index + 1}. {player.name}</span>
                    <span className="text-gray-600 ml-2">({player.team})</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{player.projected_2025_points.toFixed(1)} pts</div>
                    <div className="text-sm text-gray-600">Tier {player.tier}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Position Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['QB', 'RB', 'WR', 'TE'].map(position => {
            const stats = playerDataProcessor.getPositionStats(position);
            return (
              <div key={position} className="border rounded p-4">
                <h4 className="font-semibold mb-2">{position} Stats</h4>
                <div className="space-y-1 text-sm">
                  <div>Count: {stats.count}</div>
                  <div>Avg Points: {stats.avgPoints}</div>
                  <div>Top: {stats.topPoints}</div>
                  <div>Bottom: {stats.bottomPoints}</div>
                  <div>Range: {stats.pointsRange}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}