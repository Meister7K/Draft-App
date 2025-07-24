"use client";

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

export function WeeklyProjectionsChart({ roster, rosterFormat, data }) {
  // Get all starting lineup players
  const getStartingLineupPlayers = () => {
    const players = [];
    rosterFormat.forEach(({ position }) => {
      roster.starters[position].forEach((pick) => {
        if (pick && pick.player) {
          players.push(pick.player);
        }
      });
    });
    return players;
  };

  // Calculate weekly totals for the starting lineup
  const getWeeklyProjections = () => {
    const startingPlayers = getStartingLineupPlayers();
    if (startingPlayers.length === 0) return null;

    // Find all weeks that have projection data across all players
    const allWeeks = new Set();
    startingPlayers.forEach(player => {
      if (player.seasons && player.seasons["2025"] && player.seasons["2025"].weeks) {
        Object.keys(player.seasons["2025"].weeks).forEach(week => {
          allWeeks.add(parseInt(week));
        });
      }
    });

    if (allWeeks.size === 0) return null;

    // Sort weeks
    const sortedWeeks = Array.from(allWeeks).sort((a, b) => a - b);
    
    // Calculate total projected points for each week
    const weeklyTotals = sortedWeeks.map(week => {
      let weekTotal = 0;
      let playersWithData = 0;

      startingPlayers.forEach(player => {
        const weekData = player.seasons?.["2025"]?.weeks?.[week];
        const projectedPoints = weekData?.projections?.stats?.pts_ppr;
        
        if (projectedPoints !== null && projectedPoints !== undefined) {
          weekTotal += projectedPoints;
          playersWithData++;
        }
      });

      return {
        week,
        total: weekTotal,
        playersWithData,
        totalPlayers: startingPlayers.length
      };
    });

    return {
      weeks: sortedWeeks,
      totals: weeklyTotals,
      players: startingPlayers
    };
  };

  const projectionData = getWeeklyProjections();

  if (!projectionData) {
    return (
      <div className="bg-[var(--secondary)] rounded-lg shadow p-6">
        <div className="text-center opacity-80 py-8">
          No weekly projection data available for 2025 season
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = {
    labels: projectionData.weeks.map(week => `Week ${week}`),
    datasets: [
      {
        label: 'Starting Lineup Projected Points',
        data: projectionData.totals.map(weekData => weekData.total),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: 'rgb(59, 130, 246)',
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 3,
      },
      // Add average line
      {
        label: `Season Average (${(projectionData.totals.reduce((sum, week) => sum + week.total, 0) / projectionData.totals.length).toFixed(1)} pts)`,
        data: projectionData.totals.map(() => 
          projectionData.totals.reduce((sum, week) => sum + week.total, 0) / projectionData.totals.length
        ),
        borderColor: 'rgba(255, 255, 255, 0.8)',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2,
        borderDash: [8, 4],
      }
    ]
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
        text: `Weekly Projected Points - Starting Lineup (${projectionData.players.length} players)`,
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
            const weekIndex = context.dataIndex;
            const weekData = projectionData.totals[weekIndex];
            
            if (context.datasetIndex === 0) { // Only show for main data line
              return [
                `Players with data: ${weekData.playersWithData}/${weekData.totalPlayers}`,
                `Average per player: ${(weekData.total / weekData.playersWithData).toFixed(1)} pts`
              ];
            }
            return '';
          },
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(1) + " pts";
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
          text: "Total PPR Fantasy Points",
          color: "rgb(156, 163, 175)",
        },
      },
    },
  };

  return (
    <div className="bg-[var(--secondary)] rounded-lg shadow p-6 mb-6">
      <div className="h-80">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}