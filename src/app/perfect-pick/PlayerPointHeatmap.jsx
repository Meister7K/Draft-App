"use client";

import { useState, useMemo } from "react";

const PlayerPointHeatmap = ({ playerData, currentPicks, updateDraftData }) => {
  const [selectedPosition, setSelectedPosition] = useState("ALL");
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortByADP, setSortByADP] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Get drafted player IDs
  const draftedPlayerIds = useMemo(() => {
    return new Set(currentPicks.map((pick) => pick.player_id));
  }, [currentPicks]);

  // Filter players by position and calculate tiers based on points ranking
  const playersWithTiers = useMemo(() => {
    if (!playerData || !Array.isArray(playerData)) return [];

    let players;
    if (selectedPosition === "ALL") {
      players = playerData; // Show all players when "ALL" is selected
    } else if (selectedPosition === "FLEX") {
      players = playerData.filter((player) => 
        ["RB", "WR", "TE"].includes(player.pos)
      ); // Show RB, WR, TE for FLEX
    } else {
      players = playerData.filter((player) => player.pos === selectedPosition);
    }

    // Always sort by fantasy points first to calculate tiers
    const pointsSortedPlayers = players.sort((a, b) => b.fpts - a.fpts);

    // Calculate tiers based on points ranking
    let currentTier = 1;
    let tierStartPoints = pointsSortedPlayers.length > 0 ? pointsSortedPlayers[0].fpts : 0;

    return pointsSortedPlayers.map((player, index) => {
      let tier = currentTier;
      let isNewTier = false;
      let tierReason = '';

      if (index === 0) {
        // First player is always tier 1
        tier = 1;
        tierStartPoints = player.fpts;
      } else {
        const prevPlayer = pointsSortedPlayers[index - 1];
        const dropFromTierStart = tierStartPoints - player.fpts;
        const dropFromPrevious = prevPlayer.fpts - player.fpts;

        // New tier if >34 points from tier start OR >17 points from previous player
        if (dropFromTierStart >= 34) {
          currentTier++;
          tier = currentTier;
          tierStartPoints = player.fpts;
          isNewTier = true;
          tierReason = `34+ pts from tier start (${dropFromTierStart.toFixed(1)} pts)`;
        } else if (dropFromPrevious > 17) {
          currentTier++;
          tier = currentTier;
          tierStartPoints = player.fpts;
          isNewTier = true;
          tierReason = `17+ pts from previous (${dropFromPrevious.toFixed(1)} pts)`;
        }
      }

      return {
        ...player,
        tier,
        isNewTier,
        tierReason,
        pointsRank: index + 1, // Rank based on points
      };
    });
  }, [playerData, selectedPosition]);

  // Apply display sorting while preserving tier information
  const filteredPlayers = useMemo(() => {
    if (sortByADP) {
      return [...playersWithTiers].sort((a, b) => {
        // Handle players without ADP (999) by putting them at the end
        if (a.adp === 999 && b.adp === 999) return b.fpts - a.fpts; // Sort by points if both have no ADP
        if (a.adp === 999) return 1; // a goes to end
        if (b.adp === 999) return -1; // b goes to end
        return a.adp - b.adp; // Normal ADP sort (ascending)
      });
    } else {
      return playersWithTiers; // Already sorted by points
    }
  }, [playersWithTiers, sortByADP]);

  // Calculate heatmap data with tier determination
  const heatmapData = useMemo(() => {
    if (!filteredPlayers.length) return [];

    // Determine the scaling reference based on toggle
    const scalingPlayers = showAvailableOnly
      ? filteredPlayers.filter((p) => !draftedPlayerIds.has(p.id)) // Scale based on available players only
      : filteredPlayers; // Scale based on all players (ignore draft status)

    const maxPoints = scalingPlayers.length > 0 ? scalingPlayers[0].fpts : 1; // Top player's points
    const minPoints =
      scalingPlayers.length > 0
        ? scalingPlayers[scalingPlayers.length - 1].fpts
        : 0; // Lowest player's points
    const pointRange = maxPoints - minPoints;

    // Tiers are already calculated in playersWithTiers

    return filteredPlayers.map((player, index) => {
      // Calculate intensity as percentage of the scaling reference
      const intensity =
        pointRange > 0 ? (player.fpts - minPoints) / pointRange : 0;

      // For "Available Players Only" mode, show draft status for visual indicators
      // For "All Players" mode, ignore draft status completely (no drafted overlays)
      const isDrafted = showAvailableOnly
        ? draftedPlayerIds.has(player.id)
        : false;

      // Calculate dropoff from previous player
      const prevPlayer = index > 0 ? filteredPlayers[index - 1] : null;
      const dropoff = prevPlayer ? prevPlayer.fpts - player.fpts : 0;
      const dropoffPercentage = prevPlayer
        ? (dropoff / prevPlayer.fpts) * 100
        : 0;

      // Calculate dropoff from top player (for Available Players Only mode)
      const topPlayerDropoff =
        showAvailableOnly && maxPoints > 0 ? maxPoints - player.fpts : 0;
      const topPlayerDropoffPercentage =
        showAvailableOnly && maxPoints > 0
          ? (topPlayerDropoff / maxPoints) * 100
          : 0;

      // Tier information is already calculated in playersWithTiers
      // No need to recalculate here

      // Calculate drop to next player for display
      const nextPlayer = index < filteredPlayers.length - 1 ? filteredPlayers[index + 1] : null;
      const dropToNext = nextPlayer ? player.fpts - nextPlayer.fpts : 0;
      
      // For ADP sorting, also calculate ADP gap to next player
      const adpGapToNext = nextPlayer && sortByADP && player.adp !== 999 && nextPlayer.adp !== 999
        ? nextPlayer.adp - player.adp
        : 0;

      // Identify significant dropoffs (keep existing logic for visual indicators)
      const isSignificantDropoff = dropoffPercentage > 10 || dropoff > 5;

      return {
        ...player, // This already includes tier, isNewTier, tierReason, pointsRank
        intensity,
        rank: index + 1, // Display rank based on current sort
        isDrafted,
        dropoff,
        dropoffPercentage,
        topPlayerDropoff,
        topPlayerDropoffPercentage,
        isSignificantDropoff,
        maxPoints, // Store for reference in tooltips
        minPoints,
        dropToNext,
        adpGapToNext,
      };
    });
  }, [filteredPlayers, draftedPlayerIds, showAvailableOnly, sortByADP]);

  // Get CSS classes for border effects
  const getHeatmapClasses = (isSignificantDropoff) => {
    const borderClass = isSignificantDropoff ? "ring-2 ring-purple-400" : "";
    return borderClass;
  };

  // Get inline style for exact color based on % of 400 points
  const getHeatmapStyle = (intensity, isDrafted) => {
    if (isDrafted) {
      return { backgroundColor: "rgb(75, 85, 99)", opacity: 0.5 }; // gray-600
    }

    const percentage = Math.min(intensity * 100, 100); // Convert to percentage, cap at 100%

    let r, g, b;

    if (percentage <= 50) {
      // Blue to Yellow gradient (0-50%)
      const ratio = percentage / 50;
      r = Math.round(59 + (234 - 59) * ratio); // 59 (blue) to 234 (yellow)
      g = Math.round(130 + (179 - 130) * ratio); // 130 to 179
      b = Math.round(246 + (68 - 246) * ratio); // 246 to 68
    } else {
      // Yellow to Red gradient (50-100%)
      const ratio = (percentage - 50) / 50;
      r = Math.round(234 + (239 - 234) * ratio); // 234 (yellow) to 239 (red)
      g = Math.round(179 + (68 - 179) * ratio); // 179 to 68
      b = Math.round(68 + (68 - 68) * ratio); // 68 to 68
    }

    return { backgroundColor: `rgb(${r}, ${g}, ${b})` };
  };

  const positions = ["ALL", "QB", "RB", "WR", "TE", "FLEX"];

  // Refresh function to update draft data
  const handleRefresh = async () => {
    if (!updateDraftData) return;

    setIsRefreshing(true);
    try {
      await updateDraftData();
    } catch (error) {
      console.error("Failed to refresh draft data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Player Point Heatmap</h2>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              isMinimized ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
          <span>{isMinimized ? "Expand" : "Minimize"}</span>
        </button>
      </div>

      {!isMinimized && (
        <>
          <div className="mb-6">
            {/* Controls */}
            <div className="flex flex-wrap gap-4 mb-4 items-center">
              {/* Position selector */}
              <div className="flex gap-2">
                {positions.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setSelectedPosition(pos)}
                    className={`px-4 py-2 rounded font-medium transition-colors ${
                      selectedPosition === pos
                        ? "bg-cyan-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              {/* Available only toggle */}
              <label className="flex items-center space-x-2 text-white">
                <input
                  type="checkbox"
                  checked={showAvailableOnly}
                  onChange={(e) => setShowAvailableOnly(e.target.checked)}
                  className="rounded"
                />
                <span>Available Players Only</span>
              </label>

              {/* ADP sort toggle (show for all positions) */}
              <label className="flex items-center space-x-2 text-white">
                <input
                  type="checkbox"
                  checked={sortByADP}
                  onChange={(e) => setSortByADP(e.target.checked)}
                  className="rounded"
                />
                <span>Sort by ADP</span>
              </label>

              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`flex items-center space-x-2 px-4 py-2 rounded font-medium transition-colors ${
                  isRefreshing
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                <svg
                  className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>

            {/* Legend */}
            <div className="mb-4">
              <div className="mb-3">
                <span className="font-medium text-sm text-gray-300 mb-2 block">
                  Color Scale (relative to{" "}
                  {showAvailableOnly
                    ? "top available player"
                    : selectedPosition === "ALL"
                    ? "top player overall"
                    : selectedPosition === "FLEX"
                    ? "top flex player (RB/WR/TE)"
                    : "top player in position"}
                  ):
                </span>
                {/* Gradient bar */}
                <div className="flex items-center gap-3">
                  <div
                    className="h-6 w-64 rounded"
                    style={{
                      background:
                        "linear-gradient(to right, rgb(59, 130, 246), rgb(234, 179, 68), rgb(239, 68, 68))",
                    }}
                  ></div>
                  <div className="flex justify-between text-xs text-gray-400 w-64">
                    <span>Lowest</span>
                    <span>Middle</span>
                    <span>Highest</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 w-64 mt-1">
                  <span>Blue (Low Value)</span>
                  <span>Yellow (Mid Value)</span>
                  <span>Red (High Value)</span>
                </div>
                {heatmapData.length > 0 && (
                  <div className="text-xs text-gray-400 mt-2">
                    Range: {heatmapData[0].minPoints.toFixed(1)} -{" "}
                    {heatmapData[0].maxPoints.toFixed(1)} pts
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
                <span className="font-medium">Special Indicators:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-600 opacity-50 rounded"></div>
                  <span>Drafted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 bg-purple-600 rounded text-white text-xs flex items-center justify-center font-bold">T1</div>
                  <span>Tier (Purple = New Tier)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-4 bg-orange-600 bg-opacity-80 rounded text-white text-xs flex items-center justify-center font-bold">-5</div>
                  <span>Points Drop to Next</span>
                </div>
              </div>
            </div>
          </div>

          {/* Heatmap Grid */}
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-3">
              {heatmapData.map((player) => (
                <div
                  key={player.id}
                  className={`
                rounded-lg cursor-pointer transition-all duration-200 hover:scale-105 hover:z-10 relative group p-3 min-h-[120px] flex flex-col justify-between
                ${getHeatmapClasses(player.isSignificantDropoff)}
              `}
                  style={getHeatmapStyle(player.intensity, player.isDrafted)}
                  title={`${player.name} (${
                    player.team
                  }) - ${player.fpts.toFixed(1)} pts`}
                >
                  {/* Player Info */}
                  <div className="text-white text-xs">
                    {/* Player Name */}
                    <div className="font-bold text-sm mb-1 leading-tight"><a target='_blank' href={`/player/${player.id}`}>
                      {player.name.length > 15
                        ? `${player.name.substring(0, 15)}...`
                        : player.name}</a>
                    </div>

                    {/* Team and Position */}
                    <div className="text-gray-200 opacity-90 mb-2 flex items-center justify-between">
                      <span>{player.team}</span>
                      {(selectedPosition === "ALL" || selectedPosition === "FLEX") && (
                        <span className="bg-gray-600 px-1 py-0.5 rounded text-xs font-medium">
                          {player.pos}
                        </span>
                      )}
                    </div>

                    {/* Fantasy Points */}
                    <div className="font-semibold text-sm">
                      {player.fpts.toFixed(1)} pts
                    </div>

                    {/* ADP */}
                    <div className="text-gray-200 opacity-90">
                      ADP: {player.adp === 999 ? "N/A" : player.adp.toFixed(1)}
                    </div>
                  </div>

                  {/* Rank badge for top players */}
                  {player.rank <= 10 && !player.isDrafted && (
                    <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white text-xs font-bold px-1 py-0.5 rounded">
                      #{player.rank}
                    </div>
                  )}

                  {/* Drafted overlay */}
                  {player.isDrafted && (
                    <div className="absolute inset-0 bg-black bg-opacity-60 rounded-lg flex items-center justify-center">
                      <span className="text-red-400 font-bold text-sm">
                        DRAFTED
                      </span>
                    </div>
                  )}

                  {/* Tier indicator */}
                  {!player.isDrafted && (
                    <div className={`absolute bottom-1 right-1  text-xs font-bold px-1 py-0.5 rounded ${
                      player.isNewTier ? 'bg-blue-200 text-black' : 'bg-gray-600 bg-opacity-70 text-white'
                    }`}>
                      T{player.tier}
                    </div>
                  )}

                  {/* Drop to next player indicator */}
                  {player.dropToNext > 0 && !player.isDrafted && (
                    <div className="absolute bottom-1 left-1 bg-orange-600 bg-opacity-80 text-white text-xs font-bold px-1 py-0.5 rounded">
                      -{player.dropToNext.toFixed(1)}
                    </div>
                  )}

                  {/* Enhanced Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20 border border-gray-700 shadow-lg">
                    <div className="font-semibold">{player.name}</div>
                    <div className="text-gray-300">
                      {player.team} - {player.pos} - {player.fpts.toFixed(1)}{" "}
                      pts
                    </div>
                    <div className="text-cyan-400">
                      {(player.intensity * 100).toFixed(1)}% of top{" "}
                      {showAvailableOnly
                        ? "available"
                        : selectedPosition === "ALL"
                        ? "overall"
                        : "position"}{" "}
                      player
                    </div>
                    <div className="text-gray-400">
                      Rank: #{player.rank} | ADP:{" "}
                      {player.adp === 999 ? "N/A" : player.adp.toFixed(1)}
                    </div>
                    <div className="text-purple-300 font-medium">
                      Tier {player.tier}
                      {player.isNewTier && (
                        <span className="text-purple-400"> (NEW TIER)</span>
                      )}
                    </div>
                    {player.dropoff > 0 && (
                      <div className="text-yellow-400">
                        From prev: -{player.dropoff.toFixed(1)} pts (
                        {player.dropoffPercentage.toFixed(1)}%)
                      </div>
                    )}
                    {player.dropToNext > 0 && (
                      <div className="text-orange-400">
                        To next: -{player.dropToNext.toFixed(1)} pts
                      </div>
                    )}
                    {showAvailableOnly && player.topPlayerDropoff > 0 && (
                      <div className="text-orange-400">
                        From top: -{player.topPlayerDropoff.toFixed(1)} pts (
                        {player.topPlayerDropoffPercentage.toFixed(1)}%)
                      </div>
                    )}
                    {player.isNewTier && player.tierReason && (
                      <div className="text-purple-400 font-medium text-xs">
                        {player.tierReason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Grid info */}
            <div className="mt-4 text-center text-sm text-gray-400">
              <div>
                Each card represents a player, ordered by{" "}
                {sortByADP
                  ? "ADP (consensus draft order)"
                  : "projected points"}{" "}
                (left to right, top to bottom)
              </div>
              <div className="mt-1">
                Colors scaled relative to the{" "}
                {showAvailableOnly ? "top available player" : "top player"}{" "}
                {selectedPosition === "ALL" 
                  ? "overall" 
                  : selectedPosition === "FLEX"
                  ? "in flex positions (RB/WR/TE)"
                  : "in this position"}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-2xl font-bold text-white">
                {filteredPlayers.length}
              </div>
              <div className="text-gray-300 text-sm">Total Players</div>
            </div>
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-2xl font-bold text-white">
                {
                  filteredPlayers.filter((p) => !draftedPlayerIds.has(p.id))
                    .length
                }
              </div>
              <div className="text-gray-300 text-sm">Available</div>
            </div>
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-2xl font-bold text-white">
                {filteredPlayers.length > 0
                  ? filteredPlayers[0].fpts.toFixed(1)
                  : "0"}
              </div>
              <div className="text-gray-300 text-sm">Top Points</div>
            </div>
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-2xl font-bold text-white">
                {heatmapData.length > 0 ? Math.max(...heatmapData.map(p => p.tier)) : 0}
              </div>
              <div className="text-gray-300 text-sm">Total Tiers</div>
            </div>
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-2xl font-bold text-white">
                {heatmapData.filter((p) => p.isNewTier).length}
              </div>
              <div className="text-gray-300 text-sm">Tier Breaks</div>
            </div>
          </div>

          {/* Tier Analysis */}
          {heatmapData.filter((p) => p.isNewTier && !p.isDrafted).length > 0 && (
            <div className="mt-6 bg-gray-700 p-4 rounded-lg">
              <h3 className="text-lg font-bold text-white mb-3">
                Available Tier Breaks
              </h3>
              <div className="space-y-2">
                {heatmapData
                  .filter((p) => p.isNewTier && !p.isDrafted)
                  .slice(0, 8)
                  .map((player) => (
                    <div
                      key={player.id}
                      className="flex justify-between items-center text-sm"
                    >
                      <div className="text-white">
                        <span className="font-medium">
                          Tier {player.tier}: #{player.rank} {player.name}
                        </span>
                        <span className="text-gray-400 ml-2">
                          ({player.team}) - {player.fpts.toFixed(1)} pts
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-purple-400 font-medium">
                          {player.tierReason}
                        </div>
                        {player.dropToNext > 0 && (
                          <div className="text-orange-400 text-xs">
                            -{player.dropToNext.toFixed(1)} pts to next
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PlayerPointHeatmap;
