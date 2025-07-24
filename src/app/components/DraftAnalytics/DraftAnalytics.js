/**
 * DraftAnalytics Container Component
 * Main container component that provides tabbed interface for different analytics views
 * with shared state management and integration with existing components
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ManagerAnalytics } from "./ManagerAnalytics.js";
import { PredictionEngine } from "./PredictionEngine.js";


export function DraftAnalytics({
  league,
  draft,
  user,
  leagueUsers,
  data,
  onBack,
  selectedManagerId,
  onManagerChange,
  isLiveUpdating,
  updateFrequency,
  // Additional props for better integration with DraftData
  totalPicks,
  hoveredPlayer,
  setHoveredPlayer,
  tooltipPosition,
  setTooltipPosition
}) {
  // State management
  const [activeTab, setActiveTab] = useState('analytics');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [draftPosition, setDraftPosition] = useState(1);

  // Shared filter state across tabs
  const [sharedFilters, setSharedFilters] = useState({});

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      if (!data) {
        setError("No data available for analytics");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Data is already provided by parent component
        setLoading(false);
      } catch (err) {
        console.error('[DraftAnalytics] Error loading data:', err);
        setError(`Failed to load analytics data: ${err.message}`);
        setLoading(false);
      }
    };

    loadInitialData();
  }, [data]);

  // Calculate available players (not yet drafted)
  const availablePlayers = useMemo(() => {
    console.log('[DraftAnalytics] Calculating available players:', {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : null,
      hasPlayers: !!(data && data.players),
      playersCount: data?.players?.length || 0,
      hasDraft: !!draft,
      draftPicksCount: draft?.picks?.length || 0
    });

    if (!data || !draft) {
      return [];
    }
    
    const draftedPlayerIds = new Set(
      draft.picks
        ?.map(pick => pick.metadata?.player_id)
        .filter(Boolean) || []
    );

    const available = data.players?.filter(player => 
      !draftedPlayerIds.has(player.player_info.player_id)
    ) || [];

    console.log('[DraftAnalytics] Available players calculated:', {
      availableCount: available.length,
      draftedCount: draftedPlayerIds.size
    });

    return available;
  }, [data?.players, draft?.picks]);

  // Get league context for predictions
  const leagueContext = useMemo(() => ({
    totalTeams: league?.total_rosters || 12,
    leagueId: league?.league_id,
    season: league?.season,
    settings: league?.settings
  }), [league]);

  // Handle manager selection change (shared across tabs)
  const handleManagerChange = useCallback((newManagerId) => {
    if (onManagerChange) {
      onManagerChange(newManagerId);
    }
  }, [onManagerChange]);

  // Handle draft position change
  const handleDraftPositionChange = useCallback((newPosition) => {
    setDraftPosition(newPosition);
  }, []);

  // Handle tab change
  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
  }, []);

  // Check if draft is active for live updates
  const isDraftActive = useMemo(() => {
    return draft?.status === "drafting" || draft?.status === "paused";
  }, [draft?.status]);

  // Get current draft pick information for context
  const currentDraftInfo = useMemo(() => {
    if (!draft?.picks || !isDraftActive) return null;
    
    const totalPicks = draft.picks.length;
    const totalTeams = league?.total_rosters || Object.keys(draft?.draft_order || {}).length || 12;
    const totalRounds = draft?.settings?.rounds || 15;
    const currentRound = Math.floor(totalPicks / totalTeams) + 1;
    const pickInRound = (totalPicks % totalTeams) + 1;
    
    return {
      totalPicks,
      currentRound,
      pickInRound,
      totalRounds,
      totalTeams,
      remainingPicks: (totalRounds * totalTeams) - totalPicks
    };
  }, [draft?.picks?.length, draft?.status, league?.total_rosters, draft?.settings?.rounds, draft?.draft_order]);

  // Loading state
  if (loading) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Draft Analytics
            </h3>
            <p className="opacity-80">Loading analytics data...</p>
          </div>
        </div>
        
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
        </div>
      </div>
    );
  }



  // Error state
  if (error) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Draft Analytics
            </h3>
            <p className="opacity-80">Error loading analytics</p>
          </div>
        </div>
        
        <div className="p-4 border border-red-400 text-red-300 rounded-lg bg-red-900/60 card">
          <h3 className="font-medium mb-2">Analytics Error</h3>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">

      {/* Header - consistent with AvailablePlayers styling */}
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                Draft Analytics
              </h3>
              {league && (
                <span className="text-sm opacity-60">
                  {league.name}
                </span>
              )}
              {isLiveUpdating && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-green-400">
                    LIVE
                  </span>
                </div>
              )}
            </div>
            <p className="text-sm opacity-80 mt-1">
              Analyze draft patterns and predict future picks
              {isLiveUpdating && (
                <span className="ml-2 text-green-400">
                  (Auto-updating every {updateFrequency || "1s"})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Draft Status Info - similar to AvailablePlayers manager selector styling */}
        {currentDraftInfo && isDraftActive && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-blue-400 font-medium">
                  📊 Draft Status:
                </span>
                <span className="text-[var(--foreground)]">
                  Round {currentDraftInfo.currentRound} • Pick {currentDraftInfo.pickInRound}/{currentDraftInfo.totalTeams}
                </span>
                <span className="opacity-80">
                  ({currentDraftInfo.totalPicks} picks made, {currentDraftInfo.remainingPicks} remaining)
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-blue-400 opacity-80">
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                <span>Analytics update with each pick</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex space-x-2 border-b border-[var(--border)]">
        <button
          className={`px-4 py-2 text-sm font-medium focus:outline-none border-b-2 transition-colors duration-150 ${
            activeTab === "analytics"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--foreground)] opacity-60 hover:text-[var(--primary)]"
          }`}
          onClick={() => handleTabChange("analytics")}
        >
          Manager Analytics
        </button>

        <button
          className={`px-4 py-2 text-sm font-medium focus:outline-none border-b-2 transition-colors duration-150 ${
            activeTab === "predictions"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--foreground)] opacity-60 hover:text-[var(--primary)]"
          }`}
          onClick={() => handleTabChange("predictions")}
        >
          Draft Predictions
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "analytics" && (
          <ManagerAnalytics
            managerId={selectedManagerId}
            historicalData={data}
            currentDraft={draft}
            availablePlayers={availablePlayers}
            leagueUsers={leagueUsers}
            leagueId={league?.league_id}
            data={data}
            onManagerChange={handleManagerChange}
            sharedFilters={sharedFilters}
            onSharedFiltersChange={setSharedFilters}
            // Pass tooltip props for consistent hover behavior
            hoveredPlayer={hoveredPlayer}
            setHoveredPlayer={setHoveredPlayer}
            tooltipPosition={tooltipPosition}
            setTooltipPosition={setTooltipPosition}
            // Pass draft context
            isDraftActive={isDraftActive}
            currentDraftInfo={currentDraftInfo}
            user={user}
          />
        )}

        {activeTab === "predictions" && (
          <PredictionEngine
            managerId={selectedManagerId}
            draftPosition={draftPosition}
            historicalData={data}
            availablePlayers={availablePlayers}
            leagueUsers={leagueUsers}
            leagueContext={leagueContext}
            onManagerChange={handleManagerChange}
            onDraftPositionChange={handleDraftPositionChange}
            sharedFilters={sharedFilters}
            onSharedFiltersChange={setSharedFilters}
            // Pass tooltip props for consistent hover behavior
            hoveredPlayer={hoveredPlayer}
            setHoveredPlayer={setHoveredPlayer}
            tooltipPosition={tooltipPosition}
            setTooltipPosition={setTooltipPosition}
            // Pass draft context
            isDraftActive={isDraftActive}
            currentDraftInfo={currentDraftInfo}
            user={user}
          />
        )}
      </div>

      {/* Status Bar - enhanced with more context */}
      <div className="mt-4 pt-4 border-t border-[var(--border)] text-xs opacity-60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              {availablePlayers.length} players available
            </span>
            {draft?.picks && (
              <span>
                {draft.picks.length} picks made
              </span>
            )}
            {leagueUsers && (
              <span>
                {leagueUsers.length} managers
              </span>
            )}
            {data?.players && (
              <span>
                {data.players.length} total players in database
              </span>
            )}
            {currentDraftInfo && (
              <span className="text-blue-400">
                Round {currentDraftInfo.currentRound}/{currentDraftInfo.totalRounds}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {selectedManagerId && (
              <div className="flex items-center space-x-2">
                <span>Analyzing:</span>
                <span className="font-medium text-[var(--primary)]">
                  {leagueUsers?.find(u => u.user_id === selectedManagerId)?.display_name || 'Unknown Manager'}
                  {selectedManagerId === user?.user_id ? ' (YOU)' : ''}
                </span>
              </div>
            )}
            <span className="text-[var(--primary)]">
              {activeTab === 'analytics' ? 'Manager Analytics' : 'Draft Predictions'}
            </span>
          </div>
        </div>
      </div>


    </div>
  );
}