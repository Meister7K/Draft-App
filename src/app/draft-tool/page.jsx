"use client";

import { useState, useEffect, useMemo } from "react";
import VorpTable from "./VorpTable";
import RosterGrid from "./RosterGrid";
import DraftBoard from "./DraftBoard";
import { useVorp } from "../hooks/useVorp";
import { calculateBaselines } from "../utils/vorpCalculator";
import { useDataContext } from "../DataContext";

export default function ResponsiveTestPage() {
  // Use DataContext for responsive data
  const { leagueData, draftData, leagueUsers, setDraftData, refreshFromStorage } = useDataContext();
  
  // State for raw player data from API
  const [playerData, setPlayerData] = useState(null);
  
  // A single, reliable loading state for all initial data
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for the live draft picks - now responsive to draftData changes
  const [currentPicks, setCurrentPicks] = useState([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-update polling state (same as main page)
  const [pollingInterval, setPollingInterval] = useState(null);
  const [updateFrequency, setUpdateFrequency] = useState(null);

  // Update currentPicks when draftData changes
  useEffect(() => {
    if (draftData?.picks) {
      setCurrentPicks(draftData.picks);
      setLastUpdateTime(Date.now());
    }
  }, [draftData?.picks]);

  // Function to update draft data in real-time (same as main page)
  const updateDraftData = async (league, draft) => {
    try {
      // Use Promise.all to fetch both simultaneously for faster updates
      const [picksResponse, draftResponse] = await Promise.all([
        fetch(
          `https://api.sleeper.app/v1/draft/${
            draft.draft_id
          }/picks?t=${Date.now()}`
        ),
        fetch(
          `https://api.sleeper.app/v1/draft/${draft.draft_id}?t=${Date.now()}`
        ),
      ]);

      if (!picksResponse.ok || !draftResponse.ok) {
        console.error("Failed to fetch updated draft data");
        return;
      }

      const [picksData, updatedDraft] = await Promise.all([
        picksResponse.json(),
        draftResponse.json(),
      ]);

      // Only update if there's actually new data (compare pick counts)
      if (
        picksData.length !== draft.picks.length ||
        updatedDraft.status !== draft.status
      ) {
        setDraftData({ ...updatedDraft, picks: picksData });
        // console.log(
        //   `Draft updated: ${picksData.length} picks, status: ${updatedDraft.status}`
        // );
      }

      // If draft is complete, stop polling
      if (updatedDraft.status === "complete") {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        // console.log("Draft completed, stopping auto-updates");
      }
    } catch (err) {
      console.error("Error updating draft data:", err);
    }
  };

  // Set up polling for active drafts (same as main page)
  useEffect(() => {
    const selectedLeague = leagueData?.selectedLeague;
    if (
      selectedLeague &&
      draftData &&
      (selectedLeague.status === "paused" ||
        selectedLeague.status === "drafting")
    ) {
      // Clear any existing interval
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }

      // Set up new polling interval - faster for active drafts
      const pollInterval = selectedLeague.status === "drafting" ? 500 : 1500; // 0.5s for active, 1.5s for paused
      const interval = setInterval(() => {
        updateDraftData(selectedLeague, draftData);
      }, pollInterval);

      const frequencyText =
        pollInterval < 1000 ? `${pollInterval}ms` : `${pollInterval / 1000}s`;
      setUpdateFrequency(frequencyText);
      // console.log(
      //   `Started auto-updates every ${pollInterval}ms for ${selectedLeague.status} draft`
      // );

      setPollingInterval(interval);

      // Cleanup on unmount or when dependencies change
      return () => {
        clearInterval(interval);
      };
    } else {
      // Clear polling if not needed
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
        setUpdateFrequency(null);
      }
    }
  }, [leagueData?.selectedLeague, draftData]);

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  // This single useEffect handles API data fetching
  useEffect(() => {
    const loadPlayerData = async () => {
      if (!leagueData || !draftData) {
        setIsLoading(true);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch asynchronous data from the API
        const response = await fetch("/api/raw-fantasy-data");
        if (!response.ok) {
          throw new Error(
            `API Error: ${response.status} ${response.statusText}`
          );
        }
        const apiData = await response.json();
        setPlayerData(apiData);
      } catch (err) {
        console.error("Failed to load player data:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlayerData();
  }, [leagueData, draftData]); // Depend on context data

  // --- Data Processing (Memoized) ---
  const year = draftData?.season;
  const rosterSetup = leagueData?.selectedLeague.roster_positions || [];
  const managers = leagueUsers || [];
  const initialPicks = currentPicks || [];
  const totalRounds = leagueData?.selectedLeague.settings.rounds || 15;

  const newPlayerData = useMemo(
    () =>
      playerData && year
        ? Object.values(playerData.players).map((player) => {
            const { player_info, seasons } = player;
            return {
              id: player_info.player_id,
              name: player_info.name,
              pos: player_info.position,
              team: player_info.team,
              fpts: seasons[year]?.season_projected_totals?.pts_half_ppr ?? 0,
              adp: seasons[year]?.season_projected_totals?.adp_2qb ?? 999,
            };
          })
        : [],
    [playerData, year]
  );

  const analyzedPicks = useMemo(() => {
    if (
      !newPlayerData.length ||
      !initialPicks.length ||
      !rosterSetup.length ||
      !managers.length
    )
      return [];

    const playerMap = new Map(newPlayerData.map((p) => [p.id, p]));
    let availablePlayerIds = new Set(newPlayerData.map((p) => p.id));

    const managerRosters = new Map(managers.map((m) => [m.user_id, []]));
    const starterCounts = {};
    rosterSetup.forEach((pos) => {
      if (pos !== "BN") {
        starterCounts[pos] = (starterCounts[pos] || 0) + 1;
      }
    });

    const calculatePlayerRosterVorp = (testPlayer, roster, baselines) => {
        let tempFpts = testPlayer.fpts;
        
        // Devalue positions based on roster limits
        if (testPlayer.pos === 'TE') {
            const teCount = roster.filter(p => p.pos === 'TE').length;
            if (teCount >= (starterCounts.TE || 0)) {
                tempFpts *= 0.7; // Devalue subsequent TEs
            }
        } else if (testPlayer.pos === 'QB') {
            const qbCount = roster.filter(p => p.pos === 'QB').length;
            if (qbCount >= 4) { // Max 4 QBs rule
                return -1; // No value, actively bad pick
            }
        }

        const playersAtPos = roster.filter(p => p.pos === testPlayer.pos);
        const numStartersForPos = starterCounts[testPlayer.pos] || 0;

        // Case 1: The player can fill an open dedicated starting spot
        if (playersAtPos.length < numStartersForPos) {
            const positionalBaseline = baselines[testPlayer.pos] || 0;
            return tempFpts - positionalBaseline;
        }

        // Case 2: The player is FLEX-eligible and could upgrade a FLEX spot or bench
        if (['RB', 'WR', 'TE'].includes(testPlayer.pos)) {
            const rosteredFlexEligible = roster.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
            const totalFlexEligibleStarters = (starterCounts.RB || 0) + (starterCounts.WR || 0) + (starterCounts.TE || 0) + (starterCounts.FLEX || 0);

            if (rosteredFlexEligible.length < totalFlexEligibleStarters) {
                return tempFpts - baselines.FLEX;
            }

            const sortedRosteredFlexPlayers = rosteredFlexEligible.sort((a, b) => b.fpts - a.fpts);
            const worstStarter = sortedRosteredFlexPlayers[totalFlexEligibleStarters - 1];
            
            if (worstStarter) {
                return tempFpts - worstStarter.fpts;
            }
        }
        
        // Case 3: Player is not FLEX-eligible (e.g., QB) and dedicated spots are full
        return 0;
    };

    return initialPicks.map((pick) => {
      const availablePlayersNow = [...availablePlayerIds]
        .map((id) => playerMap.get(id))
        .filter(Boolean);
      const baselines = calculateBaselines(
        availablePlayersNow,
        rosterSetup,
        managers.length
      );
      const player = playerMap.get(pick.player_id);

      const managerId = pick.picked_by;
      const currentRoster = managerRosters.get(managerId) || [];
      
      const availableWithRosterVorp = availablePlayersNow.map(
        (availablePlayer) => ({
          ...availablePlayer,
          rosterVorp: calculatePlayerRosterVorp(availablePlayer, currentRoster, baselines),
        })
      );

      const bestAvailablePick = availableWithRosterVorp.reduce(
        (best, current) =>
          (current.rosterVorp > best.rosterVorp) ? current : best,
        { rosterVorp: -Infinity }
      );
      
      let historicalVorp = 0;
      let historicalVorpAll = 0;
      let rosterVorp = 0;

      if (player) {
        let pBaseline = baselines[player.pos] || 0;
        if (["RB", "WR", "TE"].includes(player.pos)) {
          pBaseline = Math.max(pBaseline, baselines["FLEX"]);
        }
        historicalVorp = player.fpts - pBaseline;
        historicalVorpAll = player.fpts - (baselines["GLOBAL"] || 0);
        rosterVorp = calculatePlayerRosterVorp(player, currentRoster, baselines);
      }

      if (player) {
        currentRoster.push(player);
        managerRosters.set(pick.picked_by, currentRoster);
      }
      availablePlayerIds.delete(pick.player_id);

      return {
        ...pick,
        player,
        historicalVorp,
        historicalVorpAll,
        rosterVorp,
        bestAvailablePick,
        isOptimalPick: player && bestAvailablePick && Math.abs(rosterVorp - bestAvailablePick.rosterVorp) < 0.01,
      };
    });
  }, [newPlayerData, initialPicks, rosterSetup, managers]);

  const perfectDraft = useMemo(() => {
    if (!newPlayerData.length || !managers.length || !rosterSetup.length || !analyzedPicks.length) return [];

    const playerMap = new Map(newPlayerData.map(p => [p.id, p]));
    let availablePlayerIds = new Set(newPlayerData.map(p => p.id));
    const managerRosters = new Map(managers.map(m => [m.user_id, []]));
    
    const starterCounts = {};
    rosterSetup.forEach(pos => {
      if (pos !== 'BN') {
        starterCounts[pos] = (starterCounts[pos] || 0) + 1;
      }
    });

    const sortedManagers = [...managers].sort((a, b) => {
      const aFirstPick = initialPicks.find(p => p.picked_by === a.user_id)?.pick_no || Infinity;
      const bFirstPick = initialPicks.find(p => p.picked_by === b.user_id)?.pick_no || Infinity;
      return aFirstPick - bFirstPick;
    });

    const calculatePlayerRosterVorp = (testPlayer, roster, baselines) => {
        let tempFpts = testPlayer.fpts;
        
        if (testPlayer.pos === 'TE') {
            const teCount = roster.filter(p => p.pos === 'TE').length;
            if (teCount >= (starterCounts.TE || 0)) {
                tempFpts *= 0.7;
            }
        } else if (testPlayer.pos === 'QB') {
            const qbCount = roster.filter(p => p.pos === 'QB').length;
            if (qbCount >= 4) {
                return -999; // Heavily penalize picking a 5th QB
            }
        }

        const playersAtPos = roster.filter(p => p.pos === testPlayer.pos);
        const numStartersForPos = starterCounts[testPlayer.pos] || 0;

        if (playersAtPos.length < numStartersForPos) {
            const positionalBaseline = baselines[testPlayer.pos] || 0;
            return tempFpts - positionalBaseline;
        }

        if (['RB', 'WR', 'TE'].includes(testPlayer.pos)) {
            const rosteredFlexEligible = roster.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
            const totalFlexEligibleStarters = (starterCounts.RB || 0) + (starterCounts.WR || 0) + (starterCounts.TE || 0) + (starterCounts.FLEX || 0);

            if (rosteredFlexEligible.length < totalFlexEligibleStarters) {
                return tempFpts - baselines.FLEX;
            }

            const sortedRosteredFlexPlayers = rosteredFlexEligible.sort((a, b) => b.fpts - a.fpts);
            const worstStarter = sortedRosteredFlexPlayers[totalFlexEligibleStarters - 1];
            
            if (worstStarter) {
                return tempFpts - worstStarter.fpts;
            }
        }
        
        return 0; // Default to 0 for bench players beyond starters
    };

    const perfectPicks = [];
    const totalPicksCount = managers.length * totalRounds;

    for (let pickNum = 1; pickNum <= totalPicksCount; pickNum++) {
      const round = Math.ceil(pickNum / managers.length);
      const pickInRound = ((pickNum - 1) % managers.length);
      const isOddRound = round % 2 === 1;
      const managerIndex = isOddRound ? pickInRound : managers.length - 1 - pickInRound;
      const pickingManager = sortedManagers[managerIndex];

      if (!pickingManager) continue;

      const availablePlayersNow = [...availablePlayerIds]
        .map(id => playerMap.get(id))
        .filter(Boolean);

      if (availablePlayersNow.length === 0) break;

      const baselines = calculateBaselines(availablePlayersNow, rosterSetup, managers.length);
      const currentManagerRoster = managerRosters.get(pickingManager.user_id) || [];

      const availableWithRosterVorp = availablePlayersNow.map(player => ({
        ...player,
        rosterVorp: calculatePlayerRosterVorp(player, currentManagerRoster, baselines)
      }));

      const bestPick = availableWithRosterVorp.reduce((best, current) => 
        (current.rosterVorp > best.rosterVorp) ? current : best, { rosterVorp: -Infinity }
      );
      
      if (!bestPick || bestPick.rosterVorp === -Infinity) continue;

      // --- CORRECTED LOGIC ---
      // Calculate the correct historical VORP values for the chosen player
      // based on the baselines at this specific moment in the draft.
      let pBaseline = baselines[bestPick.pos] || 0;
      if (["RB", "WR", "TE"].includes(bestPick.pos)) {
        pBaseline = Math.max(pBaseline, baselines["FLEX"]);
      }
      const historicalVorpForBestPick = bestPick.fpts - pBaseline;
      const historicalVorpAllForBestPick = bestPick.fpts - (baselines["GLOBAL"] || 0);

      const perfectPick = {
        pick_no: pickNum,
        player_id: bestPick.id,
        picked_by: pickingManager.user_id,
        roster_id: pickingManager.roster_id,
        round: round,
        player: bestPick,
        historicalVorp: historicalVorpForBestPick,
        historicalVorpAll: historicalVorpAllForBestPick,
        rosterVorp: bestPick.rosterVorp,
        isPerfectPick: true
      };
      // --- END OF CORRECTION ---

      perfectPicks.push(perfectPick);

      currentManagerRoster.push(bestPick);
      managerRosters.set(pickingManager.user_id, currentManagerRoster);
      availablePlayerIds.delete(bestPick.id);
    }

    return perfectPicks;
  }, [newPlayerData, managers, totalRounds, rosterSetup, initialPicks]);

  // --- Memoized calculation for positional draft strategy analysis ---
  const positionalAnalysis = useMemo(() => {
    if (!newPlayerData.length || !rosterSetup.length || !managers.length) {
      return {};
    }

    const numManagers = managers.length;
    const starterCounts = {};
    rosterSetup.forEach((pos) => {
      if (pos !== "BN" && pos !== "FLEX") {
        starterCounts[pos] = (starterCounts[pos] || 0) + 1;
      }
    });

    const totalStartersByPos = {
      QB: (starterCounts.QB || 0) * numManagers,
      RB: (starterCounts.RB || 0) * numManagers,
      WR: (starterCounts.WR || 0) * numManagers,
      TE: (starterCounts.TE || 0) * numManagers,
    };

    const initialBaselines = calculateBaselines(
      newPlayerData,
      rosterSetup,
      numManagers
    );

    const positionVorpAverages = {};
    ["QB", "RB", "WR", "TE"].forEach((pos) => {
      if (!totalStartersByPos[pos] || totalStartersByPos[pos] === 0) return;

      const posPlayers = newPlayerData
        .filter((p) => p.pos === pos)
        .map((p) => ({
          ...p,
          vorp: p.fpts - (initialBaselines[pos] || 0),
        }))
        .sort((a, b) => b.vorp - a.vorp);

      const starters = posPlayers.slice(0, totalStartersByPos[pos]);
      if (starters.length > 0) {
        const totalVorp = starters.reduce((sum, p) => sum + p.vorp, 0);
        positionVorpAverages[pos] = totalVorp / starters.length;
      } else {
        positionVorpAverages[pos] = 0;
      }
    });

    const maxAvgVorp = Math.max(...Object.values(positionVorpAverages), 0);
    const analysisResults = {};

    for (const pos in positionVorpAverages) {
      const avgVorp = positionVorpAverages[pos];
      let grade = "D";
      let explanation = "";
      const ratio = maxAvgVorp > 0 ? avgVorp / maxAvgVorp : 0;

      if (ratio >= 0.9) {
        grade = "A+";
        explanation = `Elite value. Top players provide a huge advantage (${avgVorp.toFixed(
          1
        )} avg. VORP). Prioritize securing a star.`;
      } else if (ratio >= 0.75) {
        grade = "B";
        explanation = `Strong value. Starters offer a significant edge (${avgVorp.toFixed(
          1
        )} avg. VORP). Target a quality starter early.`;
      } else if (ratio >= 0.5) {
        grade = "C";
        explanation = `Average value. The VORP drop-off is less severe (${avgVorp.toFixed(
          1
        )} avg. VORP), suggesting more depth is available.`;
      } else {
        grade = "D";
        explanation = `Lower priority. Value over replacement is minimal (${avgVorp.toFixed(
          1
        )} avg. VORP). You can wait on this position.`;
      }

      analysisResults[pos] = { grade, explanation, avgVorp };
    }

    return analysisResults;
  }, [newPlayerData, rosterSetup, managers]);


  const playerMap = useMemo(
    () => new Map(newPlayerData.map((p) => [p.id, p])),
    [newPlayerData]
  );
  
  const { rankedPlayers, baselines } = useVorp(
    newPlayerData,
    currentPicks,
    managers,
    rosterSetup,
    draftData?.draft_order,
    playerMap
  );

  const handleDraftPlayer = (playerId) => {
    // Clear any existing polling interval when making manual picks
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    // This function would ideally be more robust, handling snake draft logic, etc.
    // For now, it simulates a pick for the next manager in line.
    const currentPickNumber = currentPicks.length + 1;
    const pickingManager = managers[(currentPickNumber - 1) % managers.length];

    if (!pickingManager) return;

    const player = newPlayerData.find(p => p.id === playerId);
    if (!player) return;

    const newPick = {
      draft_id: draftData?.draft_id || "simulated_draft",
      pick_no: currentPickNumber,
      player_id: playerId,
      picked_by: pickingManager.user_id,
      metadata: {
        player_id: playerId,
        first_name: player.name.split(" ")[0],
        last_name: player.name.split(" ").slice(1).join(" "),
        position: player.pos,
        team: player.team,
      },
    };

    // Update local state immediately for responsive UI
    const updatedPicks = [...currentPicks, newPick];
    setCurrentPicks(updatedPicks);
    
    // Update the DataContext with the new pick
    const updatedDraftData = {
      ...draftData,
      picks: updatedPicks
    };
    
    // Update the context, which will automatically update localStorage
    setDraftData(updatedDraftData);
  };

  const currentPickNumber = currentPicks.length + 1;
  const numManagers = managers.length;
  const draftType = draftData?.type;

  let currentDraftSlot;
  if (draftType === "snake" && numManagers > 0) {
    const round = Math.ceil(currentPickNumber / numManagers);
    const pickInRound = (currentPickNumber - 1) % numManagers;
    if (round % 2 === 0) {
      currentDraftSlot = numManagers - pickInRound;
    } else {
      currentDraftSlot = pickInRound + 1;
    }
  } else if (numManagers > 0) {
    currentDraftSlot = ((currentPickNumber - 1) % numManagers) + 1;
  }

  const currentPickerId = draftData?.draft_order
    ? Object.keys(draftData.draft_order).find(
        (key) => draftData.draft_order[key] === currentDraftSlot
      )
    : null;

  const currentPicker = managers.find((m) => m.user_id === currentPickerId);

  // --- NEW: Derive the current picker's roster ---
  const managerRosters = useMemo(() => {
    const rosters = new Map(managers.map(m => [m.user_id, []]));
    analyzedPicks.forEach(pick => {
      if (pick.player) {
        const roster = rosters.get(pick.picked_by) || [];
        roster.push(pick.player);
        rosters.set(pick.picked_by, roster);
      }
    });
    return rosters;
  }, [analyzedPicks, managers]);

  const currentPickerRoster = currentPicker 
    ? managerRosters.get(currentPicker.user_id) || [] 
    : [];

  // Manual refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);

    // Clear any existing polling interval during manual refresh
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    try {
      // If we have league and draft data, fetch fresh draft data from Sleeper API
      if (leagueData?.selectedLeague && draftData) {
        await updateDraftData(leagueData.selectedLeague, draftData);
      } else {
        // Fallback: reload data from localStorage (in case it was updated externally)
        const localDataString = localStorage.getItem("draftAppData");
        if (localDataString) {
          const parsedData = JSON.parse(localDataString);
          if (parsedData?.draftData?.picks) {
            setCurrentPicks(parsedData.draftData.picks);
            setLastUpdateTime(Date.now());
          }
        }
      }

      // Reload player data from API
      const response = await fetch("/api/raw-fantasy-data");
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      const apiData = await response.json();
      setPlayerData(apiData);
      setLastUpdateTime(Date.now());
    } catch (err) {
      console.error("Failed to refresh data:", err);
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };


  if (!leagueData || !draftData || !leagueUsers) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">
          Please set up your draft data first. Go to the main page to configure your league and draft.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading Player Data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-red-500 p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-lg">An Error Occurred</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen">
      {/* Sticky Refresh Button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg shadow-lg font-medium text-sm transition-all duration-200 ${
            isRefreshing
              ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white hover:shadow-xl'
          }`}
        >
          <svg 
            className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} 
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
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      <div className="container mx-auto p-4 space-y-8">
        {/* Data responsiveness indicator */}
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-300">
            <div className="flex items-center space-x-4">
              <span>Draft Status: {currentPicks.length} picks made</span>
              <span>Last Update: {new Date(lastUpdateTime).toLocaleTimeString()}</span>
              {pollingInterval && updateFrequency && (
                <span className="text-cyan-400">
                  Auto-updating every {updateFrequency}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  isRefreshing
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${pollingInterval ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                <span className={pollingInterval ? 'text-green-400' : 'text-yellow-400'}>
                  {pollingInterval ? 'Live Updates' : 'Manual Updates'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <VorpTable
          rankedPlayers={rankedPlayers}
          baselines={baselines}
          onDraft={handleDraftPlayer}
          currentPicker={currentPicker}
          positionalAnalysis={positionalAnalysis}
          rosterSetup={rosterSetup}
          currentPickerRoster={currentPickerRoster}
        />
        <DraftBoard
          analyzedPicks={analyzedPicks}
          managers={managers}
          totalRounds={totalRounds}
          perfectDraft={perfectDraft}
        />
        <RosterGrid
          analyzedPicks={analyzedPicks}
          managers={managers}
          rosterSetup={rosterSetup}
          perfectDraft={perfectDraft}
        />
      </div>
    </div>
  );
}