
'use client'
import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title } from 'chart.js';

// Register Chart.js components
Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, Title);

const RoundTendenciesChart = ({ userData }) => {
  if (!userData || !userData.positionDetailsByRoundSection || Object.keys(userData.positionDetailsByRoundSection).length === 0) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg my-2 text-center text-gray-400">
        <p>No detailed round-by-round position data available to generate a chart.</p>
        <p className="text-sm mt-2">(This can happen with older cached data or incomplete draft history.)</p>
      </div>
    );
  }

  const sections = ['early', 'mid', 'late']; // Define your sections
  const sectionLabels = {
    early: 'Early Rounds (1-4)',
    mid: 'Mid Rounds (5-9)',
    late: 'Late Rounds (10+)'
  };

  // Collect all unique positions across all sections for consistent labeling
  const allPositions = new Set();
  sections.forEach(section => {
    Object.keys(userData.positionDetailsByRoundSection[section] || {}).forEach(pos => {
      allPositions.add(pos);
    });
  });
  const sortedPositions = Array.from(allPositions).sort();

  const datasets = sections.map((section, index) => {
    const data = sortedPositions.map(pos => {
      return (userData.positionDetailsByRoundSection[section]?.[pos]?.count || 0);
    });

    const backgroundColors = [
      'rgba(255, 99, 132, 0.7)', // Red
      'rgba(54, 162, 235, 0.7)', // Blue
      'rgba(255, 206, 86, 0.7)', // Yellow
      'rgba(75, 192, 192, 0.7)', // Green
      'rgba(153, 102, 255, 0.7)',// Purple
      'rgba(255, 159, 64, 0.7)', // Orange
      'rgba(199, 199, 199, 0.7)',// Grey
    ];

    return {
      label: sectionLabels[section],
      data: data,
      backgroundColor: backgroundColors[index % backgroundColors.length], // Cycle through colors
      borderColor: '#1f2937', // Matches dark card background
      borderWidth: 1,
    };
  });

  const chartData = {
    labels: sortedPositions,
    datasets: datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Position',
          color: '#e5e7eb',
        },
        grid: {
          color: '#374151', // Darker grid lines
        },
        ticks: {
          color: '#e5e7eb', // Light text for labels
        },
      },
      y: {
        title: {
          display: true,
          text: 'Number of Picks',
          color: '#e5e7eb',
        },
        beginAtZero: true,
        grid: {
          color: '#374151', // Darker grid lines
        },
        ticks: {
          color: '#e5e7eb', // Light text for labels
        },
      },
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e5e7eb', // Light text for legend
        },
      },
      title: {
        display: true,
        text: `${userData.username}'s Positional Tendencies by Draft Section`,
        color: '#e5e7eb',
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y + ' picks';
            }
            return label;
          }
        }
      }
    },
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg my-2">
      <div style={{ position: 'relative', height: '400px', width: '100%' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default RoundTendenciesChart;