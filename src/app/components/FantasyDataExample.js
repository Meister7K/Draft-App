/**
 * Example component demonstrating how to use the processed fantasy data
 */

import { useFantasyData } from "../hooks/useFantasyData";
import { useState } from "react";

const FantasyDataExample = () => {
  const {
    players,
    loading,
    error,
    loadData,
    getPlayersByPosition,
    getPlayerById,
    getPositions,
    getTeams,
    totalPlayers,
    isLoaded,
  } = useFantasyData();

  // console.log(players);

  const [selectedPosition, setSelectedPosition] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const positions = getPositions();
  const teams = getTeams();
  const filteredPlayers = selectedPosition
    ? getPlayersByPosition(selectedPosition)
    : players;

  const handlePlayerSelect = (playerId) => {
    setSelectedPlayerId(playerId);
    const player = getPlayerById(playerId);
    setSelectedPlayer(player);
  };

  return (
    <div className="fantasy-data-example p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Fantasy Football Data Example</h1>

      {/* Load Data Section */}
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <button
          onClick={() => loadData()}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load Fantasy Data"}
        </button>

        {error && <div className="mt-2 text-red-600">Error: {error}</div>}

        {isLoaded && (
          <div className="mt-2 text-green-600">
            Successfully loaded {totalPlayers} players
          </div>
        )}
      </div>

      {isLoaded && (
        <>
          {/* Filters Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">Filters</h2>
            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Position:
                </label>
                <select
                  value={selectedPosition}
                  onChange={(e) => setSelectedPosition(e.target.value)}
                  className="border rounded px-3 py-2"
                >
                  <option value="">All Positions</option>
                  {positions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Players List */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">
              Players ({filteredPlayers.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredPlayers.slice(0, 50).map((player) => (
                <div
                  key={player.player_info.player_id}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    handlePlayerSelect(player.player_info.player_id)
                  }
                >
                  <div className="font-semibold">{player.player_info.name}</div>
                  <div className="text-sm text-gray-600">
                    {player.player_info.position} - {player.player_info.team}
                  </div>
                  <div className="text-sm text-gray-500">
                    Rank: #{player.player_info.overall_rank || "N/A"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Player Details */}
          {selectedPlayer && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h2 className="text-xl font-semibold mb-3">Player Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Basic Info</h3>
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>Name:</strong> {selectedPlayer.player_info.name}
                    </p>
                    <p>
                      <strong>Position:</strong>{" "}
                      {selectedPlayer.player_info.position}
                    </p>
                    <p>
                      <strong>Team:</strong> {selectedPlayer.player_info.team}
                    </p>
                    <p>
                      <strong>Age:</strong> {selectedPlayer.player_info.age}
                    </p>
                    <p>
                      <strong>College:</strong>{" "}
                      {selectedPlayer.player_info.college}
                    </p>
                    <p>
                      <strong>Years Experience:</strong>{" "}
                      {selectedPlayer.player_info.years_exp}
                    </p>
                    <p>
                      <strong>Overall Rank:</strong> #
                      {selectedPlayer.player_info.overall_rank || "N/A"}
                    </p>
                    <p>
                      <strong>Position Rank:</strong> #
                      {selectedPlayer.player_info.position_rank || "N/A"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Fantasy Info</h3>
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>Projected 2025 Points:</strong>{" "}
                      {selectedPlayer.player_info.projected_2025_points ||
                        "N/A"}
                    </p>
                    <p>
                      <strong>Career Fantasy Points:</strong>{" "}
                      {selectedPlayer.career_fantasy_points || 0}
                    </p>
                    <p>
                      <strong>Seasons Played:</strong>{" "}
                      {Object.keys(selectedPlayer.seasons).length}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      {selectedPlayer.player_info.status}
                    </p>
                    <p>
                      <strong>Injury Status:</strong>{" "}
                      {selectedPlayer.player_info.injury_status || "Healthy"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Seasons Summary */}
              {Object.keys(selectedPlayer.seasons).length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Recent Seasons</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {Object.entries(selectedPlayer.seasons)
                      .sort(([a], [b]) => parseInt(b) - parseInt(a))
                      .slice(0, 4)
                      .map(([season, data]) => (
                        <div
                          key={season}
                          className="p-2 bg-white rounded border"
                        >
                          <div className="font-medium">{season}</div>
                          <div>Points: {data.fantasy_points || 0}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data Structure Preview */}
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-3">
              Sample Data Structure
            </h2>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
              {JSON.stringify(filteredPlayers[0], null, 2)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
};

export default FantasyDataExample;
