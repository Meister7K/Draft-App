"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ActualDraftEngine } from "./ActualDraftEngine.js";
import { ActualDraftAnalyticsPanel } from "./ActualDraftAnalyticsPanel.jsx";
import { ActualDraftBoard } from "./ActualDraftBoard.jsx";
import { ActualRosterDisplay } from "./ActualRosterDisplay.jsx";
import { sleeperApi } from "../DraftAnalytics/utils/sleeperApi.js";

export function ActualDraftAnalysis({
  league,
  user,
  leagueUsers,
  data,
  onBack,
}) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    draftData: null,
    draftPicks: [],
    analytics: null,
    currentPickIndex: 0,
    isAnalyzing: false,
  });

  const [selectedDraft, setSelectedDraft] = useState(null);
  const [availableDrafts, setAvailableDrafts] = useState([]);
  const [activeView, setActiveView] = useState("board"); // 'board' or 'analytics'

  // Load available drafts for the league
  useEffect(() => {
    const loadDrafts = async () => {
      if (!league?.league_id) return;

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const drafts = await sleeperApi.getLeagueDrafts(league.league_id);

        // Include both completed and ongoing drafts, but prioritize completed ones
        const analyzableDrafts = drafts.filter(
          (draft) =>
            draft.status === "complete" ||
            draft.status === "drafting" ||
            draft.status === "paused"
        );

        // Sort drafts: completed first, then by creation date (most recent first)
        analyzableDrafts.sort((a, b) => {
          if (a.status === "complete" && b.status !== "complete") return -1;
          if (a.status !== "complete" && b.status === "complete") return 1;
          return new Date(b.created) - new Date(a.created);
        });

        setAvailableDrafts(analyzableDrafts);

        // Auto-select the first available draft
        if (analyzableDrafts.length > 0) {
          setSelectedDraft(analyzableDrafts[0]);
        } else {
          setState((prev) => ({
            ...prev,
            loading: false,
            error:
              "No drafts found for this league (looking for completed, ongoing, or paused drafts)",
          }));
        }
      } catch (error) {
        console.error("[ActualDraftAnalysis] Error loading drafts:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: `Failed to load drafts: ${error.message}`,
        }));
      }
    };

    loadDrafts();
  }, [league?.league_id]);

  // Load draft picks when a draft is selected
  useEffect(() => {
    const loadDraftPicks = async () => {
      if (!selectedDraft?.draft_id || !data?.players) return;

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const picks = await sleeperApi.getDraftPicks(selectedDraft.draft_id);

        // Enhance picks with player data
        const enhancedPicks = picks
          .map((pick) => {
            const playerData = data.players.find(
              (p) => p.player_info.player_id === pick.player_id
            );
            return {
              ...pick,
              player_data: playerData,
              manager_name:
                leagueUsers?.find((u) => u.user_id === pick.picked_by)
                  ?.display_name || "Unknown",
            };
          })
          .filter((pick) => pick.player_data); // Only include picks with valid player data

        setState((prev) => ({
          ...prev,
          draftPicks: enhancedPicks,
          loading: false,
        }));
      } catch (error) {
        console.error(
          "[ActualDraftAnalysis] Error loading draft picks:",
          error
        );
        setState((prev) => ({
          ...prev,
          loading: false,
          error: `Failed to load draft picks: ${error.message}`,
        }));
      }
    };

    loadDraftPicks();
  }, [selectedDraft, data?.players, leagueUsers]);

  // Initialize the draft engine and run analysis
  const draftEngine = useMemo(() => {
    if (!data?.players || !state.draftPicks.length || !selectedDraft)
      return null;

    return new ActualDraftEngine(
      data.players,
      selectedDraft,
      leagueUsers || [],
      league?.season || "2024"
    );
  }, [
    data?.players,
    state.draftPicks,
    selectedDraft,
    leagueUsers,
    league?.season,
  ]);

  // Run the analysis
  const runAnalysis = useCallback(async () => {
    if (!draftEngine || !state.draftPicks.length) return;

    setState((prev) => ({ ...prev, isAnalyzing: true }));

    try {
      const analytics = await draftEngine.analyzeEntireDraft(state.draftPicks);

      setState((prev) => ({
        ...prev,
        analytics,
        isAnalyzing: false,
      }));
    } catch (error) {
      console.error("[ActualDraftAnalysis] Error running analysis:", error);
      setState((prev) => ({
        ...prev,
        error: `Analysis failed: ${error.message}`,
        isAnalyzing: false,
      }));
    }
  }, [draftEngine, state.draftPicks]);

  // Run analysis when engine is ready
  useEffect(() => {
    if (
      draftEngine &&
      state.draftPicks.length > 0 &&
      !state.analytics &&
      !state.isAnalyzing
    ) {
      runAnalysis();
    }
  }, [
    draftEngine,
    state.draftPicks.length,
    state.analytics,
    state.isAnalyzing,
    runAnalysis,
  ]);

  // Handle draft selection change
  const handleDraftChange = useCallback(
    (draftId) => {
      const draft = availableDrafts.find((d) => d.draft_id === draftId);
      if (draft) {
        setSelectedDraft(draft);
        setState((prev) => ({
          ...prev,
          analytics: null,
          draftPicks: [],
          currentPickIndex: 0,
        }));
      }
    },
    [availableDrafts]
  );

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-300">Loading draft data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-6">
            <h3 className="text-red-300 font-semibold mb-2">Error</h3>
            <p className="text-red-200 mb-4">{state.error}</p>
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Go Back
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              )}
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Actual Draft Analysis
                </h1>
                <p className="text-gray-400 mt-1">
                  Analyze real draft picks and evaluate decision quality
                </p>
              </div>
            </div>

            {/* Draft Selector */}
            {availableDrafts.length > 0 && (
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-300">
                  Select Draft:
                </label>
                <select
                  value={selectedDraft?.draft_id || ""}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableDrafts.map((draft) => {
                    const statusLabel =
                      draft.status === "complete"
                        ? "Completed"
                        : draft.status === "drafting"
                        ? "In Progress"
                        : draft.status === "paused"
                        ? "Paused"
                        : draft.status;
                    return (
                      <option key={draft.draft_id} value={draft.draft_id}>
                        {draft.type} Draft -{" "}
                        {new Date(draft.created).toLocaleDateString()} (
                        {statusLabel})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Draft Info */}
          {selectedDraft && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6 text-sm">
                  <div>
                    <span className="text-gray-400">Status:</span>
                    <span
                      className={`ml-2 font-medium ${
                        selectedDraft.status === "complete"
                          ? "text-green-400"
                          : selectedDraft.status === "drafting"
                          ? "text-blue-400"
                          : selectedDraft.status === "paused"
                          ? "text-yellow-400"
                          : "text-gray-400"
                      }`}
                    >
                      {selectedDraft.status === "complete"
                        ? "Completed"
                        : selectedDraft.status === "drafting"
                        ? "In Progress"
                        : selectedDraft.status === "paused"
                        ? "Paused"
                        : selectedDraft.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Type:</span>
                    <span className="text-white ml-2 font-medium">
                      {selectedDraft.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Teams:</span>
                    <span className="text-white ml-2 font-medium">
                      {selectedDraft.settings?.teams || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Rounds:</span>
                    <span className="text-white ml-2 font-medium">
                      {selectedDraft.settings?.rounds || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Picks Analyzed:</span>
                    <span className="text-white ml-2 font-medium">
                      {state.draftPicks.length}
                    </span>
                  </div>
                  {selectedDraft.status !== "complete" && (
                    <div>
                      <span className="text-gray-400">Total Picks:</span>
                      <span className="text-white ml-2 font-medium">
                        {(selectedDraft.settings?.teams || 12) *
                          (selectedDraft.settings?.rounds || 15)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-4">
                  {selectedDraft.status !== "complete" && (
                    <div className="flex items-center space-x-2 text-yellow-400">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                      <span className="text-sm">
                        Ongoing Draft - Analysis based on current picks
                      </span>
                    </div>
                  )}
                  {state.isAnalyzing && (
                    <div className="flex items-center space-x-2 text-blue-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      <span className="text-sm">Analyzing picks...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* View Toggle */}
        {state.analytics && (
          <div className="mb-6">
            <div className="flex justify-center">
              <div className="bg-gray-800 rounded-lg p-1 border border-gray-700">
                <button
                  onClick={() => setActiveView("board")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeView === "board"
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-gray-300 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  <svg
                    className="w-4 h-4 mr-2 inline"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                  Draft Board
                </button>
                <button
                  onClick={() => setActiveView("rosters")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeView === "rosters"
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-gray-300 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  <svg
                    className="w-4 h-4 mr-2 inline"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Rosters
                </button>
                <button
                  onClick={() => setActiveView("analytics")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    activeView === "analytics"
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-gray-300 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  <svg
                    className="w-4 h-4 mr-2 inline"
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
                  Analytics
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {state.analytics ? (
          <div>
            {activeView === "board" ? (
              <ActualDraftBoard
                analytics={state.analytics}
                draftPicks={state.draftPicks}
                selectedDraft={selectedDraft}
                leagueUsers={leagueUsers}
                availablePlayers={data?.players || []}
              />
            ) : activeView === "rosters" ? (
              <ActualRosterDisplay
                analytics={state.analytics}
                draftPicks={state.draftPicks}
                selectedDraft={selectedDraft}
                leagueUsers={leagueUsers}
              />
            ) : (
              <ActualDraftAnalyticsPanel
                analytics={state.analytics}
                draftPicks={state.draftPicks}
                selectedDraft={selectedDraft}
                leagueUsers={leagueUsers}
              />
            )}
          </div>
        ) : state.draftPicks.length > 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-300">
              Analyzing {state.draftPicks.length} draft picks...
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400">Select a draft to begin analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}
