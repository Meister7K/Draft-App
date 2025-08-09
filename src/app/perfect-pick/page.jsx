"use client";

import { useState, useEffect, useMemo } from "react";
import PlayerPointHeatmap from "./PlayerPointHeatmap";
import ADPDotPlot from "./ADPDotPlot";
import PerfectPick from "./perfectPick";
import MonteCarloSimulation from "./MonteCarloSimulation";
import { useDataContext } from "../DataContext";

export default function PerfectPickPage() {
  // Use DataContext for responsive data (same as draft-tool)
  const { leagueData, draftData, leagueUsers, setDraftData } = useDataContext();
  
  // State for raw player data from API
  const [playerData, setPlayerData] = useState(null);
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for the live draft picks - responsive to draftData changes
  const [currentPicks, setCurrentPicks] = useState([]);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Auto-update polling state
  const [pollingInterval, setPollingInterval] = useState(null);

  // Update currentPicks when draftData changes
  useEffect(() => {
    if (draftData?.picks) {
      setCurrentPicks(draftData.picks);
      setLastUpdateTime(Date.now());
    }
  }, [draftData?.picks]);

  // Function to update draft data in real-time (same as draft-tool)
  const updateDraftData = async (league, draft) => {
    try {
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

      // Only update if there's actually new data
      if (
        picksData.length !== draft.picks.length ||
        updatedDraft.status !== draft.status
      ) {
        setDraftData({ ...updatedDraft, picks: picksData });
      }

      // If draft is complete, stop polling
      if (updatedDraft.status === "complete") {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    } catch (err) {
      console.error("Error updating draft data:", err);
    }
  };

  // Set up polling for active drafts (same as draft-tool)
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

      // Set up new polling interval
      const pollInterval = selectedLeague.status === "drafting" ? 500 : 1500;
      const interval = setInterval(() => {
        updateDraftData(selectedLeague, draftData);
      }, pollInterval);

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

  // Load player data from API (same as draft-tool)
  useEffect(() => {
    const loadPlayerData = async () => {
      if (!leagueData || !draftData) {
        setIsLoading(true);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
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
  }, [leagueData, draftData]);

  // Process player data (same as draft-tool)
  const year = draftData?.season;
  
  const processedPlayerData = useMemo(
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

  // Wrapper function for the heatmap component
  const handleUpdateDraftData = async () => {
    if (leagueData?.selectedLeague && draftData) {
      await updateDraftData(leagueData.selectedLeague, draftData);
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
      <div className="container mx-auto p-4 space-y-8">
        {/* Header */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Perfect Pick Analysis</h1>
              <p className="text-gray-300">
                Visualize player point distributions by position to identify value dropoffs and optimal draft targets.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUpdateDraftData}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 font-medium"
              >
                <svg
                  className="w-4 h-4 mr-2"
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
                Refresh Data
              </button>
              <a
                href="/draft-tool"
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Draft Tool
              </a>
              <a
                href="/"
                className="inline-flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200 font-medium"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Home
              </a>
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-300">
            <div className="flex items-center space-x-4">
              <span>Draft Status: {currentPicks.length} picks made</span>
              <span>Last Update: {new Date(lastUpdateTime).toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${pollingInterval ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
              <span className={pollingInterval ? 'text-green-400' : 'text-yellow-400'}>
                {pollingInterval ? 'Live Updates' : 'Manual Updates'}
              </span>
            </div>
          </div>
        </div>

        {/* Monte Carlo Draft Simulation */}
        <MonteCarloSimulation
          playerData={processedPlayerData}
          currentPicks={currentPicks}
          leagueData={leagueData}
          leagueUsers={leagueUsers}
          draftData={draftData}
        />

        {/* Perfect Pick Recommendations */}
        <PerfectPick
          playerData={processedPlayerData}
          currentPicks={currentPicks}
          updateDraftData={handleUpdateDraftData}
          leagueData={leagueData}
          leagueUsers={leagueUsers}
          draftData={draftData}
        />

        {/* ADP vs Fantasy Points Dot Plot */}
        <ADPDotPlot
          playerData={processedPlayerData}
          currentPicks={currentPicks}
        />

        {/* Player Point Heatmap */}
        <PlayerPointHeatmap
          playerData={processedPlayerData}
          currentPicks={currentPicks}
          updateDraftData={handleUpdateDraftData}
        />
      </div>
    </div>
  );
}