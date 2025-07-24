"use client";

import { useState, useEffect } from "react";
import { AvailablePlayers } from "./AvailablePlayers";
import { DraftAnalytics } from "./DraftAnalytics/DraftAnalytics";

export function DraftData({
  league,
  draft,
  user,
  onBack,
  leagueUsers,
  isLiveUpdating,
  updateFrequency,
  year
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("available"); // default to 'available'
  // Add state for tooltip
  const [hoveredPlayer, setHoveredPlayer] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  // Add state for selected manager (shared between tabs)
  const [selectedManagerId, setSelectedManagerId] = useState(user.user_id);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(
          "/db/fantasy_football_db.json"
        );
        if (!response.ok) {
          throw new Error("Failed to load database summary");
        }
        const jsonData = await response.json();
        setData(jsonData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-400 text-red-300 rounded-lg bg-red-900/60 card">
        Error: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 border border-yellow-400 text-yellow-300 rounded-lg bg-yellow-900/60 card">
        No data available
      </div>
    );
  }

  // Debug log for league.members
  // console.log('league.members', league)

  const totalPicks = draft.picks.length;

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                {league.name}
              </h2>
              {isLiveUpdating && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-green-400">
                    LIVE
                  </span>
                </div>
              )}
            </div>
            <p className="opacity-80">
              Draft Results
              {isLiveUpdating && (
                <span className="ml-2 text-green-400 text-sm">
                  (Auto-updating every {updateFrequency || "1s"})
                </span>
              )}
            </p>
          </div>
          <button onClick={onBack} className="btn text-sm px-2 py-1">
             Back to leagues
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex space-x-2 border-b border-[var(--border)]">
          <button
            className={`px-4 py-2 text-sm font-medium focus:outline-none border-b-2 transition-colors duration-150 ${
              activeTab === "available"
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--foreground)] opacity-60 hover:text-[var(--primary)]"
            }`}
            onClick={() => setActiveTab("available")}
          >
            Available Players Not Yet Drafted
          </button>

          <button
            className={`px-4 py-2 text-sm font-medium focus:outline-none border-b-2 transition-colors duration-150 ${
              activeTab === "all"
                ? "border-green-400 text-green-300"
                : "border-transparent text-[var(--foreground)] opacity-60 hover:text-green-300"
            }`}
            onClick={() => setActiveTab("all")}
          >
            All Draft Picks
          </button>

          <button
            className={`px-4 py-2 text-sm font-medium focus:outline-none border-b-2 transition-colors duration-150 ${
              activeTab === "analytics"
                ? "border-blue-400 text-blue-300"
                : "border-transparent text-[var(--foreground)] opacity-60 hover:text-blue-300"
            }`}
            onClick={() => setActiveTab("analytics")}
          >
            Draft Analytics
          </button>
        </div>

        {/* Tab Panels */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "available" && (
            <AvailablePlayers
              data={data}
              draft={draft}
              hoveredPlayer={hoveredPlayer}
              setHoveredPlayer={setHoveredPlayer}
              tooltipPosition={tooltipPosition}
              setTooltipPosition={setTooltipPosition}
              selectedManagerId={selectedManagerId}
              setSelectedManagerId={setSelectedManagerId}
              leagueUsers={leagueUsers}
              year={year}
            />
          )}

          {activeTab === "analytics" && (
            <DraftAnalytics
              league={league}
              draft={draft}
              user={user}
              leagueUsers={leagueUsers}
              data={data}
              onBack={() => setActiveTab("available")}
              selectedManagerId={selectedManagerId}
              onManagerChange={setSelectedManagerId}
              isLiveUpdating={isLiveUpdating}
              updateFrequency={updateFrequency}
              // Pass additional props for better integration
              totalPicks={totalPicks}
              hoveredPlayer={hoveredPlayer}
              setHoveredPlayer={setHoveredPlayer}
              tooltipPosition={tooltipPosition}
              setTooltipPosition={setTooltipPosition}
            />
          )}

          {activeTab === "all" && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  All Draft Picks
                </h3>
                
                {/* Manager Selector for Draft Results Highlighting */}
                {leagueUsers && leagueUsers.length > 1 && (
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-[var(--foreground)] opacity-80">
                      Highlight picks for:
                    </span>
                    <select
                      value={selectedManagerId || ""}
                      onChange={(e) => setSelectedManagerId(e.target.value)}
                      className="border border-[var(--border)] rounded px-3 py-1 text-sm bg-[var(--secondary)] text-[var(--foreground)] min-w-[150px]"
                    >
                      <option value="">None</option>
                      {leagueUsers.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.display_name || member.username || member.user_id}
                          {member.user_id === user.user_id ? " (YOU)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-[var(--border)]">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        Pick
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        Round
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        Player
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                        Team
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {draft.picks.map((pick) => {
                      const player = data.players.find(
                        (p) =>
                          p.player_info.player_id === pick.metadata?.player_id
                      );
                      const isUser = pick.picked_by === user.user_id;
                      const isSelectedManager = selectedManagerId && pick.picked_by === selectedManagerId;
                      return (
                        <tr
                          key={pick.pick_id}
                          className={isSelectedManager ? "bg-[var(--primary)]/10" : ""}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--foreground)]">
                            {pick.pick_no}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm opacity-80">
                            {pick.round}.{pick.draft_slot}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)]">
                            <a
                              href={`/player/${pick.metadata?.player_id}`}
                              className="hover:underline cursor-pointer"
                            >
                              {pick.metadata?.first_name}{" "}
                              {pick.metadata?.last_name}
                            </a>
                            {isUser && (
                              <span className="ml-2 text-[var(--primary)] font-bold">
                                (YOU)
                              </span>
                            )}
                            {isSelectedManager && !isUser && (
                              <span className="ml-2 text-green-400 font-bold">
                                (SELECTED)
                              </span>
                            )}
                            {player && (
                              <div className="text-xs text-[var(--foreground)] opacity-90 mt-1">
                                <div>
                                  Projected 2025:{" "}
                                  {player.player_info.projected_2025_points?.toFixed(
                                    1
                                  )}{" "}
                                  pts
                                </div>
                                <div>
                                  Position Rank: #
                                  {player.player_info.position_rank}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm opacity-80">
                            {pick.metadata?.position}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm opacity-80">
                            {pick.metadata?.team}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Tooltip */}
        {hoveredPlayer && (
          <div
            className="absolute z-50 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg p-4 max-w-sm"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: "translateX(-200%)",
            }}
          >
            <div className="text-sm">
              <h4 className="font-semibold text-[var(--foreground)] mb-2">
                {hoveredPlayer.player_info.name}
              </h4>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="opacity-80">2025 Projection:</span>
                  <span className="font-medium">
                    {hoveredPlayer.player_info.projected_2025_points?.toFixed(
                      1
                    ) || "N/A"}{" "}
                    pts
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="opacity-80">Overall Rank:</span>
                  <span className="font-medium">
                    #{hoveredPlayer.player_info.overall_rank || "N/A"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="opacity-80">Position Rank:</span>
                  <span className="font-medium">
                    #{hoveredPlayer.player_info.position_rank || "N/A"}
                  </span>
                </div>

                {hoveredPlayer.seasons && (
                  <>
                    <div className="border-t border-[var(--border)] pt-2 mt-2">
                      <div className="font-medium text-[var(--foreground)] mb-1">
                        Historical Stats
                      </div>

                      {hoveredPlayer.seasons["2024"] && (
                        <div className="mb-1">
                          <div className="font-medium opacity-90">
                            2024 Season:
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-80">Fantasy Points:</span>
                            <span>
                              {hoveredPlayer.seasons[
                                "2024"
                              ].fantasy_points?.toFixed(1) || "N/A"}
                            </span>
                          </div>
                          {hoveredPlayer.seasons["2024"].games_played && (
                            <div className="flex justify-between">
                              <span className="opacity-80">Games:</span>
                              <span>
                                {hoveredPlayer.seasons["2024"].games_played}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {hoveredPlayer.seasons["2023"] && (
                        <div className="mb-1">
                          <div className="font-medium opacity-90">
                            2023 Season:
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-80">Fantasy Points:</span>
                            <span>
                              {hoveredPlayer.seasons[
                                "2023"
                              ].fantasy_points?.toFixed(1) || "N/A"}
                            </span>
                          </div>
                          {hoveredPlayer.seasons["2023"].games_played && (
                            <div className="flex justify-between">
                              <span className="opacity-80">Games:</span>
                              <span>
                                {hoveredPlayer.seasons["2023"].games_played}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {hoveredPlayer.seasons["2022"] && (
                        <div>
                          <div className="font-medium opacity-90">
                            2022 Season:
                          </div>
                          <div className="flex justify-between">
                            <span className="opacity-80">Fantasy Points:</span>
                            <span>
                              {hoveredPlayer.seasons[
                                "2022"
                              ].fantasy_points?.toFixed(1) || "N/A"}
                            </span>
                          </div>
                          {hoveredPlayer.seasons["2022"].games_played && (
                            <div className="flex justify-between">
                              <span className="opacity-80">Games:</span>
                              <span>
                                {hoveredPlayer.seasons["2022"].games_played}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
