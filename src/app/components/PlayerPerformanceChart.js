"use client";

import { useState } from "react";
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

export default function PlayerPerformanceChart({ player }) {
  const [chartViewMode, setChartViewMode] = useState("timeline"); // "timeline" or "overlay"

  // Calculate average actual points against each opponent
  const getOpponentAverages = () => {
    if (!player || !player.seasons) return {};

    const opponentStats = {};

    // Collect all games against each opponent
    Object.values(player.seasons).forEach((seasonData) => {
      if (seasonData.weeks) {
        Object.values(seasonData.weeks).forEach((weekData) => {
          const opponent = weekData?.projections?.opponent;
          const actual = weekData?.stats?.stats?.pts_ppr;

          if (
            opponent &&
            opponent !== "N/A" &&
            actual !== null &&
            actual !== undefined
          ) {
            if (!opponentStats[opponent]) {
              opponentStats[opponent] = [];
            }
            opponentStats[opponent].push(actual);
          }
        });
      }
    });

    // Calculate averages
    const opponentAverages = {};
    Object.entries(opponentStats).forEach(([opponent, scores]) => {
      if (scores.length > 0) {
        const average =
          scores.reduce((sum, score) => sum + score, 0) / scores.length;
        opponentAverages[opponent] = {
          average: average,
          games: scores.length,
        };
      }
    });

    return opponentAverages;
  };

  // Timeline view: shows all seasons chronologically
  const getTimelineChartData = () => {
    if (!player || !player.seasons) return null;

    const labels = [];
    const datasets = [];
    let allActualValues = []; // Collect all actual values for overall average

    // Define colors for different seasons
    const seasonColors = [
      { actual: "rgb(255, 0, 76)", projected: "rgb(255, 0, 76)" }, // 2024: green/purple
      { actual: "rgb(255, 76, 54)", projected: "rgb(255, 76, 54)" }, // 2023: blue/pink
      { actual: "rgb(253, 115, 30)", projected: "rgb(253, 115, 30)" }, // 2022: amber/violet
      { actual: "rgb(243, 148, 0)", projected: "rgb(243, 148, 0)" }, // 2021: red/emerald
      { actual: "rgb(229, 177, 0)", projected: "rgb(229, 177, 0)" },
    ];

    // Get all seasons with weekly data, sorted by year
    const seasonsWithWeeks = Object.entries(player.seasons)
      .filter(
        ([_, seasonData]) =>
          seasonData.weeks && Object.keys(seasonData.weeks).length > 0
      )
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    if (seasonsWithWeeks.length === 0) return null;

    // Create labels spanning all weeks across all seasons
    seasonsWithWeeks.forEach(([season, seasonData]) => {
      Object.keys(seasonData.weeks)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach((week) => {
          labels.push(`${season} W${week}`);
        });
    });

    // Create datasets for each season
    seasonsWithWeeks.forEach(([season, seasonData], seasonIndex) => {
      const colorIndex = seasonIndex % seasonColors.length;
      const colors = seasonColors[colorIndex];

      const actualData = [];
      const projectedData = [];
      const seasonOpponents = [];

      // Fill data arrays with nulls for all labels
      labels.forEach(() => {
        actualData.push(null);
        projectedData.push(null);
        seasonOpponents.push("N/A");
      });

      // Find the starting index for this season's data
      let startIndex = 0;
      for (let i = 0; i < seasonIndex; i++) {
        const prevSeasonData = seasonsWithWeeks[i][1];
        startIndex += Object.keys(prevSeasonData.weeks).length;
      }

      // Fill in actual data for this season
      Object.entries(seasonData.weeks)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .forEach(([, weekData], weekIndex) => {
          const dataIndex = startIndex + weekIndex;
          const actual = weekData?.stats?.stats?.pts_ppr;
          const projected = weekData?.projections?.stats?.pts_ppr;
          const opponent = weekData?.projections?.opponent || "N/A";

          actualData[dataIndex] = actual || null;
          projectedData[dataIndex] = projected || null;
          seasonOpponents[dataIndex] = opponent;

          // Collect actual values for overall average calculation
          if (actual !== null && actual !== undefined) {
            allActualValues.push(actual);
          }
        });

      // Add actual points dataset for this season
      datasets.push({
        label: `${season} Actual`,
        data: actualData,
        borderColor: colors.actual,
        backgroundColor: colors.actual
          .replace("rgb", "rgba")
          .replace(")", ", 0.1)"),
        tension: 0.1,
        pointBackgroundColor: colors.actual,
        pointBorderColor: colors.actual,
        pointRadius: 3,
        pointHoverRadius: 5,
        opponents: seasonOpponents,
        season: season,
      });

      // Add projected points dataset for this season
      datasets.push({
        label: `${season} Projected`,
        data: projectedData,
        borderColor: colors.projected,
        backgroundColor: colors.projected
          .replace("rgb", "rgba")
          .replace(")", ", 0.1)"),
        tension: 0.1,
        pointBackgroundColor: colors.projected,
        pointBorderColor: colors.projected,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderDash: [3, 3],
        opponents: seasonOpponents,
        season: season,
      });
    });

    // Calculate overall average and add average line
    if (allActualValues.length > 0) {
      const overallAverage =
        allActualValues.reduce((sum, val) => sum + val, 0) /
        allActualValues.length;
      const averageData = labels.map(() => overallAverage);

      datasets.push({
        label: `Overall Average (${overallAverage.toFixed(1)} pts)`,
        data: averageData,
        borderColor: "rgb(255, 255, 255)",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2,
        borderDash: [8, 4],
      });
    }

    return {
      labels,
      datasets,
      seasons: seasonsWithWeeks.map(([season]) => season),
    };
  };

  // Overlay view: overlays all seasons on the same week scale
  const getOverlayChartData = () => {
    if (!player || !player.seasons) return null;

    const datasets = [];
    const weeklyActualValues = []; // Array to store arrays of actual values for each week

    // Define colors for different seasons
    const seasonColors = [
      { actual: "rgb(255, 0, 76)", projected: "rgb(255, 0, 76)" }, // 2024: green/purple
      { actual: "rgb(255, 76, 54)", projected: "rgb(255, 76, 54)" }, // 2023: blue/pink
      { actual: "rgb(253, 115, 30)", projected: "rgb(253, 115, 30)" }, // 2022: amber/violet
      { actual: "rgb(243, 148, 0)", projected: "rgb(243, 148, 0)" }, // 2021: red/emerald
      { actual: "rgb(229, 177, 0)", projected: "rgb(229, 177, 0)" }, // 2020: emerald/orange
    ];

    // Get all seasons with weekly data, sorted by year
    const seasonsWithWeeks = Object.entries(player.seasons)
      .filter(
        ([_, seasonData]) =>
          seasonData.weeks && Object.keys(seasonData.weeks).length > 0
      )
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    if (seasonsWithWeeks.length === 0) return null;

    // Find the maximum number of weeks across all seasons
    const maxWeeks = Math.max(
      ...seasonsWithWeeks.map(
        ([, seasonData]) => Object.keys(seasonData.weeks).length
      )
    );

    // Create labels for weeks (Week 1, Week 2, etc.)
    const labels = Array.from({ length: maxWeeks }, (_, i) => `Week ${i + 1}`);

    // Initialize weekly actual values array
    for (let i = 0; i < maxWeeks; i++) {
      weeklyActualValues.push([]);
    }

    // Create datasets for each season
    seasonsWithWeeks.forEach(([season, seasonData], seasonIndex) => {
      const colorIndex = seasonIndex % seasonColors.length;
      const colors = seasonColors[colorIndex];

      const actualData = [];
      const projectedData = [];
      const seasonOpponents = [];

      // Initialize arrays with nulls
      for (let i = 0; i < maxWeeks; i++) {
        actualData.push(null);
        projectedData.push(null);
        seasonOpponents.push("N/A");
      }

      // Fill in data for available weeks
      Object.entries(seasonData.weeks)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .forEach(([, weekData], index) => {
          const actual = weekData?.stats?.stats?.pts_ppr;
          const projected = weekData?.projections?.stats?.pts_ppr;
          const opponent = weekData?.projections?.opponent || "N/A";

          actualData[index] = actual || null;
          projectedData[index] = projected || null;
          seasonOpponents[index] = opponent;

          // Collect actual values for weekly averages
          if (actual !== null && actual !== undefined && index < maxWeeks) {
            weeklyActualValues[index].push(actual);
          }
        });

      // Add actual points dataset for this season
      datasets.push({
        label: `${season} Actual`,
        data: actualData,
        borderColor: colors.actual,
        backgroundColor: colors.actual
          .replace("rgb", "rgba")
          .replace(")", ", 0.1)"),
        tension: 0.1,
        pointBackgroundColor: colors.actual,
        pointBorderColor: colors.actual,
        pointRadius: 3,
        pointHoverRadius: 5,
        opponents: seasonOpponents,
        season: season,
      });

      // Add projected points dataset for this season
      datasets.push({
        label: `${season} Projected`,
        data: projectedData,
        borderColor: colors.projected,
        backgroundColor: colors.projected
          .replace("rgb", "rgba")
          .replace(")", ", 0.1)"),
        tension: 0.1,
        pointBackgroundColor: colors.projected,
        pointBorderColor: colors.projected,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderDash: [3, 3],
        opponents: seasonOpponents,
        season: season,
      });
    });

    // Calculate weekly averages and add average line
    const weeklyAverages = weeklyActualValues.map((weekValues) => {
      if (weekValues.length === 0) return null;
      return weekValues.reduce((sum, val) => sum + val, 0) / weekValues.length;
    });

    // Only add average line if we have some data
    if (weeklyAverages.some((avg) => avg !== null)) {
      datasets.push({
        label: "Weekly Average",
        data: weeklyAverages,
        borderColor: "rgb(255, 255, 255)",
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: "rgb(255, 255, 255)",
        pointBorderColor: "rgb(255, 255, 255)",
        borderWidth: 2,
        borderDash: [8, 4],
      });
    }

    return {
      labels,
      datasets,
      seasons: seasonsWithWeeks.map(([season]) => season),
    };
  };

  // Get chart data based on current view mode
  const getChartData = () => {
    return chartViewMode === "timeline"
      ? getTimelineChartData()
      : getOverlayChartData();
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "rgb(255, 255, 255)",
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: (() => {
          const chartData = getChartData();
          const viewModeText =
            chartViewMode === "timeline" ? "Timeline" : "Overlay";
          return chartData && chartData.seasons
            ? `Weekly Fantasy Points (${viewModeText}) - ${chartData.seasons.join(
                ", "
              )} Seasons`
            : "Weekly Fantasy Points";
        })(),
        color: "rgb(255, 255, 255)",
        font: {
          size: 16,
          weight: "bold",
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "rgb(255, 255, 255)",
        bodyColor: "rgb(255, 255, 255)",
        borderColor: "rgb(75, 85, 99)",
        borderWidth: 1,
        callbacks: {
          afterLabel: function (context) {
            const chartData = getChartData();
            const opponentAverages = getOpponentAverages();

            if (
              chartData &&
              chartData.datasets[context.datasetIndex].opponents
            ) {
              const opponent =
                chartData.datasets[context.datasetIndex].opponents[
                  context.dataIndex
                ];

              if (opponent !== "N/A") {
                const lines = [`vs ${opponent}`];

                // Add opponent average if available and this is actual data
                if (
                  opponentAverages[opponent] &&
                  context.dataset.label.includes("Actual")
                ) {
                  const avgData = opponentAverages[opponent];
                  lines.push(
                    `Avg vs ${opponent}: ${avgData.average.toFixed(1)} pts (${
                      avgData.games
                    } games)`
                  );
                }

                return lines;
              }
            }
            return "";
          },
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(2) + " pts";
            } else {
              label += "N/A";
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(75, 85, 99, 0.3)",
        },
        ticks: {
          color: "rgb(156, 163, 175)",
        },
      },
      y: {
        grid: {
          color: "rgba(75, 85, 99, 0.3)",
        },
        ticks: {
          color: "rgb(156, 163, 175)",
        },
        beginAtZero: true,
        title: {
          display: true,
          text: "PPR Fantasy Points",
          color: "rgb(156, 163, 175)",
        },
      },
    },
  };

  if (!getChartData()) {
    return (
      <div className="bg-[var(--secondary)] rounded-lg shadow p-6">
        <div className="text-center opacity-80 py-8">
          No weekly performance data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--secondary)] rounded-lg shadow p-6">
      {/* Chart View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--foreground)]">
          Fantasy Points Performance
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-[var(--foreground)] opacity-80">
            View:
          </span>
          <div className="flex bg-[var(--background)] rounded-lg p-1">
            <button
              onClick={() => setChartViewMode("timeline")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                chartViewMode === "timeline"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--foreground)] opacity-60 hover:opacity-80"
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setChartViewMode("overlay")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                chartViewMode === "overlay"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--foreground)] opacity-60 hover:opacity-80"
              }`}
            >
              Overlay
            </button>
          </div>
        </div>
      </div>
      <div className="h-80">
        <Line data={getChartData()} options={chartOptions} />
      </div>
    </div>
  );
}
