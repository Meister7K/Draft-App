"use client";

import { useState, useEffect } from "react";
import { UserForm } from "./components/UserForm";
import { LeagueSelector } from "./components/LeagueSelector";
import { DraftData } from "./components/DraftData";
import { YourDraftPicks } from "./components/YourDraftPicks";
import { DatabaseSummary } from "./components/DatabaseSummary";
import { useDataContext } from "./DataContext";

export default function Home() {
  const {
    userFormData,
    leagueData,
    draftData,
    setLeagueData,
    setDraftData,
    submitUserForm,
    setLeagueUsers, // NEW
    leagueUsers, // NEW
    clearAllData, // NEW
  } = useDataContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [updateFrequency, setUpdateFrequency] = useState(null);
  const [playerDatabase, setPlayerDatabase] = useState(null);

  // Load player database on mount
  useEffect(() => {
    const loadPlayerDatabase = async () => {
      try {
        const response = await fetch("/db/fantasy_football_db.json");
        if (response.ok) {
          const jsonData = await response.json();
          setPlayerDatabase(jsonData);
        }
      } catch (err) {
        console.error("Failed to load player database:", err);
      }
    };

    loadPlayerDatabase();
  }, []);

  // Function to update draft data in real-time
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

  // Set up polling for active drafts
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

  const handleUserSubmit = async (username, year) => {
    setLoading(true);
    setError(null);

    // Clear any existing polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    // Clear all existing cached data to force fresh fetch
    setLeagueData(null);
    setDraftData(null);
    setLeagueUsers(null);

    try {
      // Get user data (always fetch fresh)
      const userResponse = await fetch(
        `https://api.sleeper.app/v1/user/${username}?t=${Date.now()}`
      );
      if (!userResponse.ok) {
        throw new Error("User not found");
      }
      const userData = await userResponse.json();
      submitUserForm({ ...userData, year });

      // Get user's leagues for selected season (always fetch fresh)
      const leaguesResponse = await fetch(
        `https://api.sleeper.app/v1/user/${
          userData.user_id
        }/leagues/nfl/${year}?t=${Date.now()}`
      );
      if (!leaguesResponse.ok) {
        throw new Error(`Failed to fetch leagues for ${year}`);
      }
      const leaguesData = await leaguesResponse.json();
      if (leaguesData.length === 0) {
        throw new Error(`No leagues found for ${year}`);
      }
      setLeagueData({ leagues: leaguesData, selectedLeague: null });
      setDraftData(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeagueSelect = async (league) => {
    setLoading(true);
    setError(null);

    // Clear any existing polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    // Clear existing draft data to force fresh fetch
    setDraftData(null);
    setLeagueUsers(null);

    setLeagueData({ ...leagueData, selectedLeague: league });
    try {
      // Get drafts for the league (always fetch fresh)
      const draftsResponse = await fetch(
        `https://api.sleeper.app/v1/league/${
          league.league_id
        }/drafts?t=${Date.now()}`
      );
      if (!draftsResponse.ok) {
        throw new Error("Failed to fetch drafts");
      }
      const draftsData = await draftsResponse.json();
      if (draftsData.length === 0) {
        throw new Error("No drafts found for this league");
      }
      // Get the first draft (most recent)
      const draft = draftsData[0];
      // Get draft picks (always fetch fresh)
      const picksResponse = await fetch(
        `https://api.sleeper.app/v1/draft/${
          draft.draft_id
        }/picks?t=${Date.now()}`
      );
      if (!picksResponse.ok) {
        throw new Error("Failed to fetch draft picks");
      }
      const picksData = await picksResponse.json();
      setDraftData({ ...draft, picks: picksData });

      // Fetch league users (always fetch fresh)
      const usersResponse = await fetch(
        `https://api.sleeper.app/v1/league/${
          league.league_id
        }/users?t=${Date.now()}`
      );
      if (!usersResponse.ok) {
        throw new Error("Failed to fetch league users");
      }
      const usersData = await usersResponse.json();
      setLeagueUsers(usersData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    // Clear polling interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
      setUpdateFrequency(null);
    }
    // Clear all cached data
    clearAllData();
    setError(null);
  };

  const leagues = leagueData?.leagues || [];
  const selectedLeague = leagueData?.selectedLeague || null;
  const user = userFormData;

  // Function to refresh current league data
  const handleRefreshLeague = async () => {
    if (selectedLeague) {
      await handleLeagueSelect(selectedLeague);
    }
  };

  return (
    <div className="min-h-screen py-8 bg-[var(--background)]">
      <div className=" mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-[var(--foreground)]">
            Sleeper Draft Analyzer
          </h1>
          <p className="text-[var(--foreground)] opacity-80 mb-4">
            View your fantasy football draft picks and analysis
          </p>
          
          {/* Analysis Tools Links */}
          <div className="flex justify-center gap-4 mb-4">
            <a 
              href="/perfect-draft"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <svg 
                className="w-5 h-5 mr-2" 
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
              Perfect Draft Analyzer
            </a>
            <a 
              href="/actual"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <svg 
                className="w-5 h-5 mr-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
                />
              </svg>
              Actual Draft Analysis
            </a>
          </div>
          
          <p className="text-sm text-[var(--foreground)] opacity-60">
            Advanced draft projections and real draft pick analysis
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 border border-red-400 text-red-300 rounded-lg bg-red-900/60 card">
            <div>{error}</div>
            {error.startsWith("No leagues found for") && (
              <button className="mt-4 px-4 py-2 btn" onClick={handleReset}>
                Back
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
          </div>
        )}

        {!user && !loading && (
          <>
            <div className="card">
              <UserForm onSubmit={handleUserSubmit} />
            </div>
            
            {/* Analysis Tools Info Card */}
            <div className="card bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-indigo-200 dark:border-indigo-700">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                  🎯 Draft Analysis Tools
                </h3>
                <p className="text-[var(--foreground)] opacity-70 text-sm mb-4">
                  Get advanced draft projections with Perfect Draft Analyzer, or analyze real draft picks 
                  with Actual Draft Analysis. Enter your Sleeper username above to get started.
                </p>
                <div className="flex justify-center gap-3">
                  <a 
                    href="/perfect-draft"
                    className="inline-flex items-center px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors duration-200 font-medium text-sm"
                  >
                    Perfect Draft
                  </a>
                  <a 
                    href="/actual"
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium text-sm"
                  >
                    Actual Analysis
                  </a>
                </div>
              </div>
            </div>
          </>
        )}

        {user && leagues.length > 0 && !selectedLeague && !loading && (
          <div className="card">
            <LeagueSelector
              leagues={leagues}
              onSelect={handleLeagueSelect}
              onBack={handleReset}
              onRefresh={() =>
                handleUserSubmit(user.username || user.display_name, user.year)
              }
            />
          </div>
        )}

        {selectedLeague && draftData && !loading && (
          <>
            {/* Perfect Draft CTA for Selected League */}
            <div className="mb-6">
              <div className="card bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                      🚀 Ready for Advanced Analysis?
                    </h3>
                    <p className="text-[var(--foreground)] opacity-70 text-sm">
                      Use our Perfect Draft Analyzer for {selectedLeague.name} to get ideal draft projections, 
                      real-time pick analysis, and competitive insights.
                    </p>
                  </div>
                  <a 
                    href="/perfect-draft"
                    className="ml-4 inline-flex items-center px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors duration-200 font-medium whitespace-nowrap"
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
                    Analyze Draft
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Your Draft Picks Component */}
              <div className="card w-full">
                {playerDatabase ? (
                  <YourDraftPicks
                    user={user}
                    leagueUsers={leagueUsers}
                    data={playerDatabase}
                    draft={draftData}
                  />
                ) : (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                  </div>
                )}
              </div>

              {/* Draft Data Component */}
              <div className="card w-full">
                <a href="/draft">Draft</a>
                <DraftData
                  league={selectedLeague}
                  draft={draftData}
                  user={user}
                  leagueUsers={leagueUsers}
                  isLiveUpdating={pollingInterval !== null}
                  updateFrequency={updateFrequency}
                  onBack={() => {
                    // Clear polling interval
                    if (pollingInterval) {
                      clearInterval(pollingInterval);
                      setPollingInterval(null);
                      setUpdateFrequency(null);
                    }
                    setLeagueData({ ...leagueData, selectedLeague: null });
                    setDraftData(null);
                    setLeagueUsers(null);
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
      <DatabaseSummary />
    </div>
  );
}
