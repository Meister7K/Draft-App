// components/ManagerADPAnalysis.js
"use client";
import React, { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// NEW Helper function to get ALL available ADPs from a player's projected totals
const getAllADPs = (projectedTotals) => {
  const adps = {};
  if (!projectedTotals) {
    return adps;
  }

  // Define all possible ADP keys to look for
  const adpKeys = [
    "adp_ppr",
    "adp_half_ppr",
    "adp_std",
    "adp_2qb",
    "adp_idp",
    "adp_dynasty",
    "adp_dynasty_2qb",
    "adp_dynasty_half_ppr",
    "adp_dynasty_ppr",
    "adp_dynasty_std",
  ];

  adpKeys.forEach((key) => {
    const value = projectedTotals[key];
    // Check if the value exists and is not null/undefined
    if (value !== undefined && value !== null) {
      const parsedValue = parseFloat(value);
      // Ensure the parsed value is a valid number before adding it
      if (!isNaN(parsedValue)) {
        adps[key] = parsedValue;
      }
    }
  });

  return adps;
};

const ManagerADPAnalysis = ({
  draftData,
  userStats,
  allSeasons,
  playerData,
}) => {
  const [selectedSeason, setSelectedSeason] = useState("all"); // Default to 'all' years
  const [selectedADPType, setSelectedADPType] = useState("adp_ppr"); // State for the selected ADP type
  const [expanded, setExpanded] = useState(false);

  // Options for the new ADP Type dropdown filter
  const adpTypeOptions = [
    { value: "adp_ppr", label: "PPR" },
    { value: "adp_half_ppr", label: "Half PPR" },
    { value: "adp_std", label: "Standard" },
    { value: "adp_2qb", label: "2QB / Superflex" },
    { value: "adp_dynasty", label: "Dynasty" },
    { value: "adp_dynasty_ppr", label: "Dynasty PPR" },
  ];
  //!
  const analyzedData = useMemo(() => {
    if (
      !draftData ||
      draftData.length === 0 ||
      !userStats ||
      userStats.length === 0
    ) {
      return { managerAnalysis: [], maxDeviation: 0 };
    }

    const filteredDraftData =
      selectedSeason === "all"
        ? draftData
        : draftData.filter((d) => d.season === selectedSeason);

    // 1. Build a map of global ADPs, storing ALL available ADPs for each player/season
    const globalPlayerADPs = new Map();
    console.log("ManagerADPAnalysis - playerData structure:", playerData);
    console.log(
      "ManagerADPAnalysis - playerData.players check:",
      playerData?.players?.length
    );

    if (playerData && Array.isArray(playerData.players)) {
      console.log(
        "ManagerADPAnalysis - Processing",
        playerData.players.length,
        "players"
      );
      console.log(
        "ManagerADPAnalysis - Sample player structure:",
        playerData.players[0]
      );
      playerData.players.forEach((player) => {
        const playerId = player.player_info?.player_id;
        if (playerId && player.seasons) {
          Object.keys(player.seasons).forEach((season) => {
            const seasonData = player.seasons[season];
            if (seasonData.season_projected_totals) {
              const allAdps = getAllADPs(seasonData.season_projected_totals);
              if (Object.keys(allAdps).length > 0) {
                if (!globalPlayerADPs.has(playerId)) {
                  globalPlayerADPs.set(playerId, new Map());
                }
                globalPlayerADPs.get(playerId).set(season, {
                  adps: allAdps,
                  position: player.player_info?.position || "Unknown",
                });
              }
            }
          });
        }
      });
    }

    // 2. Calculate local ADPs from the draft data as a fallback
    const localPlayerPicks = new Map();
    filteredDraftData.forEach((draft) => {
      draft.picks.forEach((pick) => {
        const playerId = pick.player_id;
        if (!localPlayerPicks.has(playerId)) {
          localPlayerPicks.set(playerId, {
            totalPickSum: 0,
            count: 0,
            position: pick.metadata?.position || "Unknown",
          });
        }
        const playerStats = localPlayerPicks.get(playerId);
        playerStats.totalPickSum += pick.pick_no;
        playerStats.count++;
      });
    });

    // 3. Determine the final ADP for each player, using the selected ADP type
    const finalPlayerADPs = new Map();
    console.log(
      "ManagerADPAnalysis - globalPlayerADPs size:",
      globalPlayerADPs.size
    );
    console.log(
      "ManagerADPAnalysis - localPlayerPicks size:",
      localPlayerPicks.size
    );

    localPlayerPicks.forEach((stats, playerId) => {
      let adpData = null;

      if (globalPlayerADPs.has(playerId)) {
        const playerSeasons = globalPlayerADPs.get(playerId);
        if (selectedSeason !== "all" && playerSeasons.has(selectedSeason)) {
          adpData = playerSeasons.get(selectedSeason);
        } else if (selectedSeason === "all") {
          const mostRecentSeason = Array.from(playerSeasons.keys()).sort(
            (a, b) => parseInt(b) - parseInt(a)
          )[0];
          if (mostRecentSeason) {
            adpData = playerSeasons.get(mostRecentSeason);
          }
        }
      }

      if (adpData) {
        let resolvedAdp = adpData.adps[selectedADPType];
        if (resolvedAdp === undefined) {
          resolvedAdp =
            adpData.adps.adp_ppr ??
            adpData.adps.adp_half_ppr ??
            adpData.adps.adp_std ??
            Object.values(adpData.adps)[0];
        }

        if (resolvedAdp !== undefined) {
          finalPlayerADPs.set(playerId, {
            adp: resolvedAdp,
            position: adpData.position,
          });
          console.log(
            `ManagerADPAnalysis - Player ${playerId} ADP: ${resolvedAdp}, Position: ${adpData.position}`
          );
        } else {
          finalPlayerADPs.set(playerId, {
            adp: stats.totalPickSum / stats.count,
            position: stats.position,
          });
          console.log(
            `ManagerADPAnalysis - Player ${playerId} using local ADP: ${
              stats.totalPickSum / stats.count
            }`
          );
        }
      } else {
        finalPlayerADPs.set(playerId, {
          adp: stats.totalPickSum / stats.count,
          position: stats.position,
        });
        console.log(
          `ManagerADPAnalysis - Player ${playerId} no global data, using local ADP: ${
            stats.totalPickSum / stats.count
          }`
        );
      }
    });

    console.log(
      "ManagerADPAnalysis - finalPlayerADPs size:",
      finalPlayerADPs.size
    );

    // 4. Perform manager analysis
    const managerAnalysis = [];
    let maxDeviation = 0;

    console.log(
      "ManagerADPAnalysis - Starting manager analysis for",
      userStats.length,
      "managers"
    );
    console.log(
      "ManagerADPAnalysis - filteredDraftData structure:",
      filteredDraftData
    );
    console.log(
      "ManagerADPAnalysis - Sample draft picks:",
      filteredDraftData[0]?.picks?.slice(0, 3)
    );
    console.log(
      "ManagerADPAnalysis - Sample userStats:",
      userStats.slice(0, 2)
    );

    if (selectedSeason === "all") {
      // For "All Years", calculate deviations per season first, then average them
      userStats.forEach((manager) => {
        const seasonalPositionDeviations = {}; // { position: { season: [deviations] } }

        // Process each draft separately to maintain season-specific ADP comparisons
        filteredDraftData.forEach((draft) => {
          const managerPicksInDraft = draft.picks.filter(
            (p) => p.picked_by === manager.user_id
          );

          managerPicksInDraft.forEach((pick) => {
            // Get ADP specifically for this season
            const playerADPInfo =
              globalPlayerADPs.has(pick.player_id) &&
              globalPlayerADPs.get(pick.player_id).has(draft.season)
                ? globalPlayerADPs.get(pick.player_id).get(draft.season)
                : null;

            if (playerADPInfo) {
              let resolvedAdp = playerADPInfo.adps[selectedADPType];
              if (resolvedAdp === undefined) {
                resolvedAdp =
                  playerADPInfo.adps.adp_ppr ??
                  playerADPInfo.adps.adp_half_ppr ??
                  playerADPInfo.adps.adp_std ??
                  Object.values(playerADPInfo.adps)[0];
              }

              if (resolvedAdp !== undefined) {
                const position = playerADPInfo.position;
                const deviation = resolvedAdp - pick.pick_no;

                if (!seasonalPositionDeviations[position]) {
                  seasonalPositionDeviations[position] = {};
                }
                if (!seasonalPositionDeviations[position][draft.season]) {
                  seasonalPositionDeviations[position][draft.season] = [];
                }
                seasonalPositionDeviations[position][draft.season].push(
                  deviation
                );
                maxDeviation = Math.max(maxDeviation, Math.abs(deviation));
              }
            }
          });
        });

        // Average the seasonal deviations for each position
        const averagedPositionDeviations = {};
        Object.keys(seasonalPositionDeviations).forEach((position) => {
          const seasonalAvgs = [];
          Object.keys(seasonalPositionDeviations[position]).forEach(
            (season) => {
              const seasonDeviations =
                seasonalPositionDeviations[position][season];
              const seasonAvg =
                seasonDeviations.reduce((sum, dev) => sum + dev, 0) /
                seasonDeviations.length;
              seasonalAvgs.push(seasonAvg);
            }
          );
          averagedPositionDeviations[position] =
            seasonalAvgs.reduce((sum, avg) => sum + avg, 0) /
            seasonalAvgs.length;
        });

        managerAnalysis.push({
          username: manager.username,
          positionDeviations: averagedPositionDeviations,
        });
      });
    } else {
      // For single season, use the existing logic
      userStats.forEach((manager) => {
        const managerPicks = filteredDraftData.flatMap((draft) =>
          draft.picks.filter((p) => p.picked_by === manager.user_id)
        );
        const positionDeviations = {};

        managerPicks.forEach((pick) => {
          const playerADPInfo = finalPlayerADPs.get(pick.player_id);
          if (playerADPInfo) {
            const position = playerADPInfo.position;
            const deviation = playerADPInfo.adp - pick.pick_no;

            if (!positionDeviations[position]) {
              positionDeviations[position] = { totalDeviation: 0, count: 0 };
            }
            positionDeviations[position].totalDeviation += deviation;
            positionDeviations[position].count++;
            maxDeviation = Math.max(maxDeviation, Math.abs(deviation));
          }
        });

        const averagedPositionDeviations = {};
        for (const pos in positionDeviations) {
          averagedPositionDeviations[pos] =
            positionDeviations[pos].totalDeviation /
            positionDeviations[pos].count;
        }

        managerAnalysis.push({
          username: manager.username,
          positionDeviations: averagedPositionDeviations,
        });
      });
    }

    console.log("ManagerADPAnalysis - Final analysis result:", {
      managerAnalysis,
      maxDeviation,
    });
    console.log("ManagerADPAnalysis - Manager count:", managerAnalysis.length);
    console.log("ManagerADPAnalysis - Max deviation:", maxDeviation);

    return { managerAnalysis, maxDeviation };
  }, [draftData, userStats, selectedSeason, playerData, selectedADPType]);

  // Helper functions for coloring (no changes needed here)
  const getColorForDeviation = (deviation, maxDev) => {
    if (maxDev === 0 || deviation === 0) return "rgba(40, 44, 52, 0.5)";
    const normalized = Math.min(Math.abs(deviation) / maxDev, 1);
    const alpha = 0.3 + normalized * 0.7;
    return deviation > 0
      ? `rgba(255, 99, 132, ${alpha})`
      : `rgba(75, 192, 192, ${alpha})`;
  };

  const getTextColorForDeviation = (deviation, maxDev) => {
    if (deviation === 0 || maxDev === 0) return "#6b7280";
    return Math.abs(deviation) / maxDev > 0.6 ? "#f3f4f6" : "#d1d5db";
  };

  if (
    !analyzedData.managerAnalysis ||
    analyzedData.managerAnalysis.length === 0
  ) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg my-2 text-center text-gray-400">
        <p>No draft data available to analyze manager ADP tendencies.</p>
      </div>
    );
  }

  const allPositions = useMemo(() => {
    const positions = new Set();
    analyzedData.managerAnalysis.forEach((manager) => {
      Object.keys(manager.positionDeviations).forEach((pos) =>
        positions.add(pos)
      );
    });
    return Array.from(positions).sort();
  }, [analyzedData.managerAnalysis]);

  const sortedManagers = [...analyzedData.managerAnalysis].sort((a, b) =>
    a.username.localeCompare(b.username)
  );

  // Calculate manager totals for the total column
  const managerTotals = useMemo(() => {
    const totals = {};
    analyzedData.managerAnalysis.forEach((manager) => {
      const deviations = Object.values(manager.positionDeviations);
      totals[manager.username] =
        deviations.length > 0
          ? deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length
          : 0;
    });
    return totals;
  }, [analyzedData.managerAnalysis]);

  // Calculate overall manager tendencies for awards
  const managerAwards = useMemo(() => {
    if (!managerTotals || Object.keys(managerTotals).length === 0) {
      return { bigSpender: null, scroogeMcDuck: null };
    }

    // Convert managerTotals to array and filter out managers with no data
    const managerAverages = Object.entries(managerTotals)
      .filter(([username, avgDeviation]) => avgDeviation !== 0)
      .map(([username, avgDeviation]) => ({
        username,
        avgDeviation,
      }));

    if (managerAverages.length === 0) {
      return { bigSpender: null, scroogeMcDuck: null };
    }

    // Sort by average deviation
    const sortedByDeviation = [...managerAverages].sort(
      (a, b) => a.avgDeviation - b.avgDeviation
    );

    console.log("Manager averages for awards:", managerAverages);
    console.log("Sorted by deviation:", sortedByDeviation);

    return {
      bigSpender: sortedByDeviation[sortedByDeviation.length - 1], // Most positive deviation (reaches most)
      scroogeMcDuck: sortedByDeviation[0], // Most negative deviation (best value)
    };
  }, [managerTotals]);

  // Calculate overall averages for each position
  const overallPositionAverages = useMemo(() => {
    const positionTotals = {};
    const positionCounts = {};

    // Initialize totals and counts for all positions
    allPositions.forEach((pos) => {
      positionTotals[pos] = 0;
      positionCounts[pos] = 0;
    });

    // Sum up all manager deviations for each position
    analyzedData.managerAnalysis.forEach((manager) => {
      Object.entries(manager.positionDeviations).forEach(
        ([position, deviation]) => {
          if (positionTotals[position] !== undefined) {
            positionTotals[position] += deviation;
            positionCounts[position]++;
          }
        }
      );
    });

    // Calculate averages
    const averages = {};
    allPositions.forEach((pos) => {
      averages[pos] =
        positionCounts[pos] > 0 ? positionTotals[pos] / positionCounts[pos] : 0;
    });

    return averages;
  }, [analyzedData.managerAnalysis, allPositions]);

  return (
    <div className="p-4 bg-gray-800 rounded-lg my-2">
      <div
        className="flex justify-between items-center bg-gray-700 p-3 rounded-md cursor-pointer hover:bg-gray-600 transition-colors mb-4"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="font-semibold text-white text-lg">
          Manager ADP Tendencies (Overreach/Underreach)
        </h3>
        {expanded ? (
          <ChevronUp className="text-blue-400" />
        ) : (
          <ChevronDown className="text-blue-400" />
        )}
      </div>

      {expanded && (
        <>
          <p className="text-sm text-gray-400 mb-4">
            This heatmap shows manager tendencies to draft players earlier
            (green) or later (red) than their selected ADP.
          </p>
          {/* Legend and Explanation */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-white mb-3">
              How to Read This Heatmap
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: "rgba(75, 192, 192, 0.7)" }}
                  ></div>
                  <span className="text-gray-300">
                    Positive values (green) = Drafted LATER than ADP (good
                    value)
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: "rgba(255, 99, 132, 0.7)" }}
                  ></div>
                  <span className="text-gray-300">
                    Negative values (red) = Drafted EARLIER than ADP (reached)
                  </span>
                </div>
              </div>
              <div>
                <p className="text-gray-300 mb-1">
                  <strong>Example:</strong> A value of{" "}
                  <span className="text-green-400">+15.2</span> means this
                  manager typically drafts that position 15 picks later than ADP
                  (good value).
                </p>
                <p className="text-gray-300">
                  A value of <span className="text-red-400">-8.5</span> means
                  they draft players 8 picks earlier than expected (reaching).
                </p>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label
                htmlFor="season-select-adp"
                className="block text-sm font-medium text-gray-400 mb-1"
              >
                Select Season:
              </label>
              <select
                id="season-select-adp"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Years</option>
                {allSeasons
                  .sort((a, b) => b - a)
                  .map((season) => (
                    <option key={season} value={season}>
                      Season {season}
                    </option>
                  ))}
              </select>
            </div>
            {/* New ADP Type Filter */}
            <div>
              <label
                htmlFor="adp-type-select"
                className="block text-sm font-medium text-gray-400 mb-1"
              >
                Select ADP Type:
              </label>
              <select
                id="adp-type-select"
                value={selectedADPType}
                onChange={(e) => setSelectedADPType(e.target.value)}
                className="p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              >
                {adpTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Manager Awards */}
          {(managerAwards.bigSpender || managerAwards.scroogeMcDuck) && (
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-white mb-3">
                🏆 Draft Style Awards
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {managerAwards.bigSpender && (
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">💸</span>
                      <span className="font-semibold text-red-400">
                        Big Spender
                      </span>
                    </div>
                    <p className="text-white font-medium">
                      {managerAwards.bigSpender.username}
                    </p>
                    <p className="text-sm text-gray-300">
                      Avg deviation: +
                      {managerAwards.bigSpender.avgDeviation.toFixed(1)} picks
                    </p>
                    <p className="text-xs text-gray-400">
                      Reaches for players more than anyone else
                    </p>
                  </div>
                )}

                {managerAwards.scroogeMcDuck && (
                  <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">💰</span>
                      <span className="font-semibold text-green-400">
                        Scrooge McDuck
                      </span>
                    </div>
                    <p className="text-white font-medium">
                      {managerAwards.scroogeMcDuck.username}
                    </p>
                    <p className="text-sm text-gray-300">
                      Avg deviation:{" "}
                      {managerAwards.scroogeMcDuck.avgDeviation >= 0 ? "+" : ""}
                      {managerAwards.scroogeMcDuck.avgDeviation.toFixed(1)}{" "}
                      picks
                    </p>
                    <p className="text-xs text-gray-400">
                      Most conservative drafter, best at finding value
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Heatmap Table */}
          <div className="overflow-x-auto">
            {sortedManagers.length > 0 ? (
              <div className="grid gap-px border border-gray-700">
                {/* Header Row */}
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `minmax(120px, 1fr) repeat(${allPositions.length}, minmax(60px, 1fr)) minmax(80px, 1fr)`,
                  }}
                >
                  <div className="p-2 bg-gray-700 text-gray-300 font-semibold text-sm sticky left-0 z-10">
                    Manager
                  </div>
                  {allPositions.map((pos) => (
                    <div
                      key={`header-${pos}`}
                      className="p-2 bg-gray-700 text-gray-300 font-semibold text-center text-sm"
                    >
                      {pos}
                    </div>
                  ))}
                  <div className="p-2 bg-gray-700 text-gray-300 font-semibold text-center text-sm">
                    Total Avg
                  </div>
                </div>

                {/* Overall Row */}
                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: `minmax(120px, 1fr) repeat(${allPositions.length}, minmax(60px, 1fr)) minmax(80px, 1fr)`,
                  }}
                >
                  <div className="p-2 bg-gray-600 text-yellow-400 font-bold text-sm sticky left-0 z-10 border-t border-gray-500">
                    Overall Avg
                  </div>
                  {allPositions.map((pos) => {
                    const avgDeviation = overallPositionAverages[pos] || 0;
                    return (
                      <div
                        key={`overall-${pos}`}
                        className="p-2 text-center text-sm flex items-center justify-center font-semibold border-t border-gray-500"
                        style={{
                          backgroundColor: getColorForDeviation(
                            avgDeviation,
                            analyzedData.maxDeviation
                          ),
                          color: getTextColorForDeviation(
                            avgDeviation,
                            analyzedData.maxDeviation
                          ),
                        }}
                        title={
                          avgDeviation
                            ? `Overall Avg Deviation: ${avgDeviation.toFixed(
                                1
                              )}`
                            : "No Overall Deviation"
                        }
                      >
                        {avgDeviation ? avgDeviation.toFixed(1) : "–"}
                      </div>
                    );
                  })}
                  <div
                    className="p-2 text-center text-sm flex items-center justify-center font-semibold border-t border-gray-500"
                    style={{
                      backgroundColor: "rgba(40, 44, 52, 0.5)",
                      color: "#6b7280",
                    }}
                  >
                    –
                  </div>
                </div>

                {/* Data Rows */}
                {sortedManagers.map((manager) => {
                  const isBigSpender =
                    managerAwards.bigSpender?.username === manager.username;
                  const isScroogeMcDuck =
                    managerAwards.scroogeMcDuck?.username === manager.username;

                  return (
                    <div
                      key={manager.username}
                      className="grid"
                      style={{
                        gridTemplateColumns: `minmax(120px, 1fr) repeat(${allPositions.length}, minmax(60px, 1fr)) minmax(80px, 1fr)`,
                      }}
                    >
                      <div className="p-2 bg-gray-700 text-white font-medium text-sm sticky left-0 z-10 flex items-center gap-1">
                        <span>{manager.username}</span>
                        {isBigSpender && <span title="Big Spender">💸</span>}
                        {isScroogeMcDuck && (
                          <span title="Scrooge McDuck">💰</span>
                        )}
                      </div>
                      {allPositions.map((pos) => {
                        const avgDeviation =
                          manager.positionDeviations[pos] || 0;
                        return (
                          <div
                            key={`${manager.username}-${pos}`}
                            className="p-2 text-center text-sm flex items-center justify-center"
                            style={{
                              backgroundColor: getColorForDeviation(
                                avgDeviation,
                                analyzedData.maxDeviation
                              ),
                              color: getTextColorForDeviation(
                                avgDeviation,
                                analyzedData.maxDeviation
                              ),
                            }}
                            title={
                              avgDeviation
                                ? `Avg. Deviation: ${avgDeviation.toFixed(1)}`
                                : "No Deviation"
                            }
                          >
                            {avgDeviation ? avgDeviation.toFixed(1) : "–"}
                          </div>
                        );
                      })}
                      <div
                        className="p-2 text-center text-sm flex items-center justify-center font-semibold"
                        style={{
                          backgroundColor: getColorForDeviation(
                            managerTotals[manager.username] || 0,
                            analyzedData.maxDeviation
                          ),
                          color: getTextColorForDeviation(
                            managerTotals[manager.username] || 0,
                            analyzedData.maxDeviation
                          ),
                        }}
                        title={`Total Avg Deviation: ${(
                          managerTotals[manager.username] || 0
                        ).toFixed(1)}`}
                      >
                        {managerTotals[manager.username]
                          ? managerTotals[manager.username].toFixed(1)
                          : "–"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-gray-700 rounded-lg text-center text-gray-400 mt-4">
                No manager picks found for the selected season to analyze ADP
                tendencies.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ManagerADPAnalysis;
