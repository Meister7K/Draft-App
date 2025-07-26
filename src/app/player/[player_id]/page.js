"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PlayerPerformanceChart from "../../components/PlayerPerformanceChart";
import { ConsistencyScore } from "../../components/ConsistencyScore";
import { CareerOverview } from "../../components/CareerOverview";
import { PlayerStatsLineChart } from "../../components/PlayerStatsLineChart";

export default function PlayerDetailPage() {
  const { player_id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [player, setPlayer] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSeason, setSelectedSeason] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(
          "/db/fantasy_football_db.json"
        );
        if (!response.ok) {
          throw new Error("Failed to load player data");
        }
        const jsonData = await response.json();
        setData(jsonData);
        const found = jsonData.players.find(
          (p) => String(p.player_info.player_id) === String(player_id)
        );
        setPlayer(found);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [player_id]);

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );

  if (error)
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="p-4 border border-red-400 text-red-300 rounded-lg bg-red-900/60 card">
          Error: {error}
        </div>
      </div>
    );

  if (!player)
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="p-4 border border-yellow-400 text-yellow-300 rounded-lg bg-yellow-900/60 card">
          Player not found
        </div>
      </div>
    );

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "seasons", label: "Seasons" },
    { id: "weeks", label: "Weekly Stats" },
    { id: "comparison", label: "Stats Comparison" },
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Player Header */}
      <div className="bg-gradient-to-r from-[var(--primary)]/10 to-purple-900/20 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              {player.player_info.name}
            </h1>
            <p className="text-lg text-[var(--foreground)] opacity-80">
              {player.player_info.position} • {player.player_info.team}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--primary)]">
              {player.player_info.projected_2025_points?.toFixed(1)}
            </div>
            <div className="text-sm opacity-80">Projected 2025 Points</div>
          </div>
        </div>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--secondary)] rounded-lg shadow p-4">
          <div className="text-sm opacity-80">Position Rank</div>
          <div className="text-2xl font-bold text-[var(--primary)]">
            #{player.player_info.position_rank}
          </div>
        </div>
        <div className="bg-[var(--secondary)] rounded-lg shadow p-4">
          <div className="text-sm opacity-80">Overall Rank</div>
          <div className="text-2xl font-bold text-green-300">
            #{player.player_info.overall_rank}
          </div>
        </div>
        <div className="bg-[var(--secondary)] rounded-lg shadow p-4">
          <div className="text-sm opacity-80">Age</div>
          <div className="text-2xl font-bold text-purple-300">
            {player.player_info.age}
          </div>
        </div>
        <div className="bg-[var(--secondary)] rounded-lg shadow p-4">
          <div className="text-sm opacity-80">Experience</div>
          <div className="text-2xl font-bold text-orange-300">
            {player.player_info.years_exp} years
          </div>
        </div>
      </div>

      {/* Fantasy Points Chart */}
      <PlayerPerformanceChart player={player} />

      {/* Consistency Score */}
      <ConsistencyScore player={player} />

      {/* Player Details */}
      <div className="bg-[var(--secondary)] rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
          Player Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p>
              <span className="font-medium">Height:</span>{" "}
              {player.player_info.height}"
            </p>
            <p>
              <span className="font-medium">Weight:</span>{" "}
              {player.player_info.weight} lbs
            </p>
            <p>
              <span className="font-medium">College:</span>{" "}
              {player.player_info.college}
            </p>
          </div>
          <div>
            <p>
              <span className="font-medium">Rookie Year:</span>{" "}
              {player.player_info.rookie_year}
            </p>
            <p>
              <span className="font-medium">Birth Date:</span>{" "}
              {new Date(player.player_info.birth_date).toLocaleDateString()}
            </p>
            <p>
              <span className="font-medium">Status:</span>{" "}
              {player.player_info.status}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSeasons = () => {
    if (!player.seasons || Object.keys(player.seasons).length === 0) {
      return (
        <div className="space-y-6">
          <div className="text-center opacity-80 py-8">
            No season data available
          </div>
        </div>
      );
    }

    const seasons = Object.keys(player.seasons).sort((a, b) => b - a);
    const currentSelectedSeason = selectedSeason || seasons[0];
    const seasonData = player.seasons[currentSelectedSeason];

    const formatStatValue = (key, value) => {
      if (typeof value !== "number") return String(value);

      if (["gp", "gs", "gms_active", "pass_att", "pass_cmp", "pass_td", "pass_int", "rush_att", "rush_td",
           "rec_td", "receptions", "targets", "carries", "anytime_tds", "fum", "fum_lost", "pass_sack"].includes(key) ||
          key.includes("_att") || key.includes("_cmp") || key.includes("_td") || key.includes("_int")) {
        return Math.round(value).toLocaleString();
      }

      if (key.includes("pct") || key.includes("percentage")) {
        return value.toFixed(1) + "%";
      }

      if (key.includes("_yd") || key.includes("yards") || key.includes("_lng")) {
        return Math.round(value).toLocaleString();
      }

      if (key.includes("ypa") || key.includes("ypc") || key.includes("yac")) {
        return value.toFixed(2);
      }

      if (key.includes("pts_") || key.includes("fantasy_points") || key.includes("projected_fantasy")) {
        return value.toFixed(1);
      }

      if (key.includes("rank") || key.includes("adp")) {
        return value.toFixed(1);
      }

      if (key.includes("rtg") || key.includes("rating")) {
        return value.toFixed(1);
      }

      return value.toFixed(1);
    };

    const getStatColor = (key) => {
      if (key.includes("fantasy") || key.includes("pts_")) return "text-purple-400";
      if (key.includes("pass_") || key.includes("passing")) return "text-blue-400";
      if (key.includes("rush_") || key.includes("rushing")) return "text-green-400";
      if (key.includes("rec_") || key.includes("receiving") || key.includes("receptions") || key.includes("targets")) return "text-yellow-400";
      if (key.includes("rank") || key.includes("adp")) return "text-orange-400";
      if (key.includes("proj_")) return "text-cyan-400";
      if (key === "gp" || key === "gs" || key === "gms_active") return "text-indigo-400";
      return "text-[var(--foreground)]";
    };

    const categorizeStats = (seasonData) => {
      const categories = {
        "Fantasy Performance": [],
        "Passing": [],
        "Rushing": [],
        "Receiving": [],
        "Game Stats": [],
        "Rankings": []
      };

      if (seasonData.fantasy_points) {
        categories["Fantasy Performance"].push(["fantasy_points", seasonData.fantasy_points]);
      }
      if (seasonData.projected_fantasy_points) {
        categories["Fantasy Performance"].push(["projected_fantasy_points", seasonData.projected_fantasy_points]);
      }

      if (seasonData.season_totals) {
        Object.entries(seasonData.season_totals).forEach(([key, value]) => {
          if (key.includes("pass_") && !key.includes("rush")) {
            categories.Passing.push([key, value]);
          } else if (key.includes("rush_")) {
            categories.Rushing.push([key, value]);
          } else if (key.includes("rec_") || key.includes("receiving")) {
            categories.Receiving.push([key, value]);
          } else if (key.includes("pts_") || key.includes("rank_") || key.includes("pos_rank")) {
            categories.Rankings.push([key, value]);
          } else if (key === "gp" || key === "gs" || key === "gms_active") {
            categories["Game Stats"].push([key, value]);
          } else {
            categories["Game Stats"].push([key, value]);
          }
        });
      }

      if (seasonData.season_projected_totals) {
        Object.entries(seasonData.season_projected_totals).forEach(([key, value]) => {
          if (key.includes("pass_") && !key.includes("rush")) {
            categories.Passing.push([`proj_${key}`, value]);
          } else if (key.includes("rush_")) {
            categories.Rushing.push([`proj_${key}`, value]);
          } else if (key.includes("rec_") || key.includes("receiving")) {
            categories.Receiving.push([`proj_${key}`, value]);
          } else if (key.includes("pts_") || key.includes("adp_")) {
            categories.Rankings.push([`proj_${key}`, value]);
          } else {
            categories["Game Stats"].push([`proj_${key}`, value]);
          }
        });
      }

      Object.entries(seasonData)
        .filter(([key, value]) =>
          key !== "weeks" &&
          key !== "season_totals" &&
          key !== "season_projected_totals" &&
          key !== "fantasy_points" &&
          key !== "projected_fantasy_points" &&
          typeof value !== "object"
        )
        .forEach(([key, value]) => {
          categories["Game Stats"].push([key, value]);
        });

      return categories;
    };

    const statCategories = categorizeStats(seasonData);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            Season Statistics
          </h3>
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-[var(--foreground)] opacity-80">
              Select Season:
            </span>
            <div className="flex bg-[var(--background)] rounded-lg p-1">
              {seasons.map((season) => (
                <button
                  key={season}
                  onClick={() => setSelectedSeason(season)}
                  className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                    currentSelectedSeason === season
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--foreground)] opacity-60 hover:opacity-80"
                  }`}
                >
                  {season}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[var(--secondary)] rounded-lg shadow p-6">
          <h4 className="font-semibold text-xl mb-4 text-[var(--foreground)]">
            {currentSelectedSeason} Season
          </h4>

          {Object.entries(statCategories).map(([category, stats]) => {
            if (stats.length === 0) return null;

            return (
              <div key={category} className="mb-6">
                <h5 className="font-medium text-[var(--foreground)] mb-3 text-sm uppercase tracking-wide opacity-80">
                  {category} Stats
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {stats.map(([key, value]) => (
                    <div key={key} className="bg-[var(--background)] rounded p-4">
                      <div className="text-sm opacity-80 capitalize mb-1">
                        {key.replace(/_/g, " ")}
                      </div>
                      <div className={`text-lg font-bold ${getStatColor(key)}`}>
                        {formatStatValue(key, value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <CareerOverview player={player} />
      </div>
    );
  };

  const renderWeeks = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
        Weekly Statistics
      </h3>
      {player.seasons && Object.keys(player.seasons).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(player.seasons)
            .sort((a, b) => b[0] - a[0])
            .map(([season, seasonData]) => {
              let totalStats = 0;
              let totalProjections = 0;
              if (
                seasonData.weeks &&
                Object.keys(seasonData.weeks).length > 0
              ) {
                Object.values(seasonData.weeks).forEach((weekData) => {
                  if (weekData?.stats?.stats?.pts_ppr != null) {
                    totalStats += weekData.stats.stats.pts_ppr;
                  }
                  if (weekData?.projections?.stats?.pts_ppr != null) {
                    totalProjections += weekData.projections.stats.pts_ppr;
                  }
                });
              }
              return (
                <div
                  key={season}
                  className="bg-[var(--secondary)] rounded-lg shadow p-4"
                >
                  <h4 className="font-semibold text-lg mb-3 text-[var(--foreground)]">
                    {season} Season - Weekly Stats
                  </h4>
                  {seasonData.weeks &&
                  Object.keys(seasonData.weeks).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-[var(--border)]">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase">
                              Week
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase">
                              Opponent
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase">
                              Actual PPR
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase">
                              Projected PPR
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase">
                              Diff (Actual - Proj)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(seasonData.weeks).map(
                            ([week, weekData]) => {
                              const actual = weekData?.stats?.stats?.pts_ppr;
                              const projected =
                                weekData?.projections?.stats?.pts_ppr;
                              const diff =
                                actual != null && projected != null
                                  ? (actual - projected).toFixed(2)
                                  : "N/A";
                              const opponent =
                                weekData?.projections?.opponent || "N/A";
                              return (
                                <tr
                                  key={week}
                                  className="hover:bg-[var(--background)]"
                                >
                                  <td className="px-4 py-2 font-medium text-[var(--foreground)]">
                                    {week}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-[var(--foreground)] opacity-80">
                                    {opponent}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-sm ${
                                      actual != null && projected != null
                                        ? actual > projected
                                          ? "text-green-300"
                                          : "text-red-300"
                                        : "opacity-60"
                                    }`}
                                  >
                                    {actual != null ? actual.toFixed(2) : "N/A"}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-[var(--primary)]">
                                    {projected != null
                                      ? projected.toFixed(2)
                                      : "N/A"}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-semibold text-[var(--foreground)]">
                                    {diff}
                                  </td>
                                </tr>
                              );
                            }
                          )}
                          <tr className="bg-[var(--background)] font-bold">
                            <td className="px-4 py-2 text-[var(--foreground)]">
                              Total
                            </td>
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2 text-[var(--foreground)]">
                              {totalStats.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-[var(--foreground)]">
                              {totalProjections.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-[var(--foreground)]">
                              {(totalStats - totalProjections).toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center opacity-80 py-4">
                      No weekly data available for this season
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ) : (
        <div className="text-center opacity-80 py-8">
          No weekly data available
        </div>
      )}
    </div>
  );

  const renderStatsComparison = () => (
    <div className="space-y-4">
      {/* PlayerStatsLineChart Component */}
      {player && data && (
        <PlayerStatsLineChart player={player} allPlayersData={data} />
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => window.history.back()}
          className="btn text-sm flex items-center"
        >
          ← Back to Draft
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--border)] mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--foreground)] opacity-60 hover:text-[var(--primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === "overview" && renderOverview()}
        {activeTab === "seasons" && renderSeasons()}
        {activeTab === "weeks" && renderWeeks()}
        {activeTab === "comparison" && renderStatsComparison()}
      </div>
    </div>
  );
}