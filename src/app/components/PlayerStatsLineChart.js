"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export function PlayerStatsLineChart({ player, allPlayersData }) {
  const [selectedStat, setSelectedStat] = useState("fantasy_points");
  const [comparisonPlayers, setComparisonPlayers] = useState([]);
  const [availableStats, setAvailableStats] = useState([]);
  const [availableComparisonPlayers, setAvailableComparisonPlayers] = useState([]);

  // Define available stats based on position
  const getAvailableStats = (position) => {
    const baseStats = [
      { key: "fantasy_points", label: "Fantasy Points/Season" },
      { key: "avg_fantasy_points", label: "Avg Fantasy Points/Game" },
    ];

    const positionStats = {
      QB: [
        { key: "pass_att", label: "Pass Attempts/Season" },
        { key: "pass_cmp", label: "Pass Completions/Season" },
        { key: "pass_yds", label: "Passing Yards/Season" },
        { key: "pass_td", label: "Passing TDs/Season" },
        { key: "pass_int", label: "Interceptions/Season" },
        { key: "rush_yds", label: "Rushing Yards/Season" },
        { key: "rush_td", label: "Rushing TDs/Season" },
      ],
      RB: [
        { key: "rush_att", label: "Rush Attempts/Season" },
        { key: "rush_yds", label: "Rushing Yards/Season" },
        { key: "rush_td", label: "Rushing TDs/Season" },
        { key: "receptions", label: "Receptions/Season" },
        { key: "rec_yds", label: "Receiving Yards/Season" },
        { key: "rec_td", label: "Receiving TDs/Season" },
      ],
      WR: [
        { key: "receptions", label: "Receptions/Season" },
        { key: "targets", label: "Targets/Season" },
        { key: "rec_yds", label: "Receiving Yards/Season" },
        { key: "rec_td", label: "Receiving TDs/Season" },
        { key: "rush_yds", label: "Rushing Yards/Season" },
        { key: "rush_td", label: "Rushing TDs/Season" },
      ],
      TE: [
        { key: "receptions", label: "Receptions/Season" },
        { key: "targets", label: "Targets/Season" },
        { key: "rec_yds", label: "Receiving Yards/Season" },
        { key: "rec_td", label: "Receiving TDs/Season" },
      ],
    };

    return [...baseStats, ...(positionStats[position] || [])];
  };

  // Get top players at the same position for comparison
  const getTopPlayersAtPosition = (position, excludePlayerId) => {
    if (!allPlayersData?.players) return [];

    return allPlayersData.players
      .filter(p =>
        p.player_info.position === position &&
        p.player_info.player_id !== excludePlayerId
      )
      .map(p => ({
        ...p,
        totalProjectedPoints: p.player_info.projected_2025_points || 0
      }))
      .sort((a, b) => b.totalProjectedPoints - a.totalProjectedPoints);
  };

  // Initialize comparison players and available stats
  useEffect(() => {
    if (player && allPlayersData) {
      const position = player.player_info.position;
      setAvailableStats(getAvailableStats(position));

      const topPlayers = getTopPlayersAtPosition(position, player.player_info.player_id);
      setAvailableComparisonPlayers(topPlayers);
      setComparisonPlayers(topPlayers.slice(0, 2));
    }
  }, [player, allPlayersData]);

  // Handle comparison player selection
  const handleComparisonPlayerChange = (e, index) => {
    const selectedPlayerId = e.target.value;
    const newComparisonPlayers = [...comparisonPlayers];
    const selectedPlayer = availableComparisonPlayers.find(
      (p) => String(p.player_info.player_id) === String(selectedPlayerId)
    );
    newComparisonPlayers[index] = selectedPlayer;
    setComparisonPlayers(newComparisonPlayers);
  };

  // Extract data for a specific stat across all seasons
  const extractStatData = (playerData, statKey) => {
    if (!playerData?.seasons) return {};

    const data = {};
    Object.entries(playerData.seasons).forEach(([year, seasonData]) => {
      let value = 0;

      if (statKey === "fantasy_points") {
        value = seasonData.fantasy_points || 0;
      } else if (statKey === "avg_fantasy_points") {
        const gamesPlayed = seasonData.season_totals?.gp || 1;
        value = gamesPlayed > 0 ? (seasonData.fantasy_points || 0) / gamesPlayed : 0;
      } else if (seasonData.season_totals) {
        value = seasonData.season_totals[statKey] || 0;
      }

      if (value > 0) {
        data[year] = value;
      }
    });

    return data;
  };

  // Define static colors for the players
  const playerColors = {
    main: "#8b5cf6",
    comparison1: "#ef4444",
    comparison2: "#f59e0b",
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!player || !selectedStat) return null;

    const allYears = new Set();

    if (player.seasons) {
      Object.keys(player.seasons).forEach(year => allYears.add(year));
    }

    comparisonPlayers.forEach(compPlayer => {
      if (compPlayer && compPlayer.seasons) {
        Object.keys(compPlayer.seasons).forEach(year => allYears.add(year));
      }
    });

    const sortedYears = Array.from(allYears).sort();

    if (sortedYears.length === 0) return null;

    const datasets = [];

    // Main player data
    const mainPlayerData = extractStatData(player, selectedStat);
    datasets.push({
      label: player.player_info.name,
      data: sortedYears.map(year => mainPlayerData[year] || null),
      borderColor: playerColors.main,
      backgroundColor: playerColors.main,
      borderWidth: 3,
      pointRadius: 6,
      pointHoverRadius: 8,
      tension: 0.1,
    });

    // Comparison players data
    if (comparisonPlayers.length > 0) {
      const compPlayer1 = comparisonPlayers[0];
      if (compPlayer1) {
        const compPlayerData1 = extractStatData(compPlayer1, selectedStat);
        datasets.push({
          label: compPlayer1.player_info.name,
          data: sortedYears.map(year => compPlayerData1[year] || null),
          borderColor: playerColors.comparison1,
          backgroundColor: playerColors.comparison1,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.1,
          borderDash: [5, 5],
        });
      }
    }

    if (comparisonPlayers.length > 1) {
      const compPlayer2 = comparisonPlayers[1];
      if (compPlayer2) {
        const compPlayerData2 = extractStatData(compPlayer2, selectedStat);
        datasets.push({
          label: compPlayer2.player_info.name,
          data: sortedYears.map(year => compPlayerData2[year] || null),
          borderColor: playerColors.comparison2,
          backgroundColor: playerColors.comparison2,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.1,
          borderDash: [5, 5],
        });
      }
    }

    return {
      labels: sortedYears,
      datasets,
    };
  }, [player, comparisonPlayers, selectedStat]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "rgb(var(--foreground))",
          usePointStyle: true,
          padding: 20,
        },
      },
      title: {
        display: true,
        text: availableStats.find(stat => stat.key === selectedStat)?.label || "Player Stats Over Time",
        color: "rgb(var(--foreground))",
        font: {
          size: 16,
          weight: "bold",
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "white",
        bodyColor: "white",
        borderColor: "rgba(255, 255, 255, 0.2)",
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            const value = context.parsed.y;
            if (value === null) return null;

            let formattedValue;
            if (selectedStat === "avg_fantasy_points" || selectedStat === "fantasy_points") {
              formattedValue = value.toFixed(1);
            } else {
              formattedValue = Math.round(value).toLocaleString();
            }

            return `${context.dataset.label}: ${formattedValue}`;
          }
        }
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Season",
          color: "rgb(var(--foreground))",
        },
        ticks: {
          color: "rgb(var(--foreground))",
        },
        grid: {
          color: "rgba(var(--border), 0.3)",
        },
      },
      y: {
        title: {
          display: true,
          text: availableStats.find(stat => stat.key === selectedStat)?.label || "Value",
          color: "rgb(var(--foreground))",
        },
        ticks: {
          color: "rgb(var(--foreground))",
          callback: function(value) {
            if (selectedStat === "avg_fantasy_points" || selectedStat === "fantasy_points") {
              return value.toFixed(1);
            }
            return Math.round(value).toLocaleString();
          }
        },
        grid: {
          color: "rgba(var(--border), 0.3)",
        },
        beginAtZero: true,
      },
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
  };

  if (!player || !allPlayersData) {
    return (
      <div className="card">
        <div className="text-center opacity-80 py-8">
          Loading chart data...
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-2 text-[var(--foreground)]">
          Career Stats Comparison
        </h3>
        <p className="opacity-80 text-sm">
          Compare {player.player_info.name}'s performance over time with other players at the {player.player_info.position} position
        </p>
      </div>

      <div className="flex flex-wrap gap-6 mb-6">
        {/* Stat Selector */}
        <div>
          <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">
            Select Stat:
          </label>
          <select
            value={selectedStat}
            onChange={(e) => setSelectedStat(e.target.value)}
            className="border border-[var(--border)] rounded px-3 py-2 bg-[var(--background)] text-[var(--foreground)] min-w-[250px]"
          >
            {availableStats.map((stat) => (
              <option key={stat.key} value={stat.key}>
                {stat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Comparison Player Selectors */}
        {comparisonPlayers.map((compPlayer, index) => (
          <div key={index}>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground)]">
              Compare with Player {index + 1}:
            </label>
            <select
              value={compPlayer?.player_info?.player_id || ""}
              onChange={(e) => handleComparisonPlayerChange(e, index)}
              className="border border-[var(--border)] rounded px-3 py-2 bg-[var(--background)] text-[var(--foreground)] min-w-[250px]"
            >
              <option value="">Select a player</option>
              {availableComparisonPlayers.map((compPlayerOption) => (
                <option
                  key={compPlayerOption.player_info.player_id}
                  value={compPlayerOption.player_info.player_id}
                >
                  {compPlayerOption.player_info.name} ({compPlayerOption.player_info.team})
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="mb-6" style={{ height: "400px" }}>
        {chartData ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--foreground)] opacity-60">
            No data available for the selected stat
          </div>
        )}
      </div>

      {/* Comparison Players Info */}
      <div className="border-t border-[var(--border)] pt-4">
        <h4 className="text-sm font-medium mb-3 text-[var(--foreground)] opacity-80">
          Line Legend:
        </h4>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: playerColors.main }}></div>
            <span className="text-sm text-[var(--foreground)]">
              {player.player_info.name}
            </span>
          </div>
          {comparisonPlayers.map((compPlayer, index) => (
            compPlayer && (
              <div key={compPlayer.player_info.player_id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: index === 0 ? playerColors.comparison1 : playerColors.comparison2 }}
                ></div>
                <span className="text-sm text-[var(--foreground)]">
                  {compPlayer.player_info.name}
                </span>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}