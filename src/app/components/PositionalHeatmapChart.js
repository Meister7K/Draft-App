// PositionalHeatmapChart.js
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react'; // Example icons

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB', 'IDP', 'FLEX', 'BN', 'IR', 'Taxi', 'Other']; // Expanded list of possible positions

const PositionalHeatmapChart = ({ userStats, allSeasons, maxRoundsInDraft }) => {
  const [selectedPosition, setSelectedPosition] = useState('RB'); // Default to RB
  const [selectedSeason, setSelectedSeason] = useState('all'); // Default to 'all' years
  const [expanded, setExpanded] = useState(false);

  // Determine the actual maximum round to display, up to a reasonable limit for heatmap readability
  const displayMaxRound = Math.min(maxRoundsInDraft || 15, 20); // Cap at 20 rounds for display
  const rounds = Array.from({ length: displayMaxRound }, (_, i) => i + 1);

  // Prepare data for the heatmap
  const heatmapData = useMemo(() => {
    const data = {};
    let maxCount = 0; // To normalize color intensity

    userStats.forEach(user => {
      data[user.username] = {};
      rounds.forEach(round => {
        data[user.username][round] = 0; // Initialize count for each round
      });

      if (user.draftedPositionsByRoundAndSeason) {
        if (selectedSeason === 'all') {
          // Aggregate data for all seasons
          Object.values(user.draftedPositionsByRoundAndSeason).forEach(seasonData => {
            Object.entries(seasonData).forEach(([round, positionsInRound]) => {
              const roundNum = parseInt(round, 10);
              if (roundNum <= displayMaxRound && positionsInRound[selectedPosition]) {
                data[user.username][roundNum] += positionsInRound[selectedPosition];
              }
            });
          });
        } else {
          // Data for a specific season
          const seasonData = user.draftedPositionsByRoundAndSeason[selectedSeason];
          if (seasonData) {
            Object.entries(seasonData).forEach(([round, positionsInRound]) => {
              const roundNum = parseInt(round, 10);
              if (roundNum <= displayMaxRound && positionsInRound[selectedPosition]) {
                data[user.username][roundNum] = positionsInRound[selectedPosition];
              }
            });
          }
        }
      }

      // Update maxCount after aggregating for the user
      rounds.forEach(round => {
        if (data[user.username][round] > maxCount) {
          maxCount = data[user.username][round];
        }
      });
    });

    return { data, maxCount };
  }, [userStats, selectedPosition, selectedSeason, rounds, displayMaxRound]);

  // Function to get color based on count
  const getColor = (count, max) => {
    if (max === 0 || count === 0) return 'rgba(40, 44, 52, 0.5)'; // Transparent/dark background for no data
    const intensity = count / max;
    // Example: From light blue to dark blue for higher intensity
    return `rgba(60, 150, 250, ${0.3 + intensity * 0.7})`; // Adjust alpha for better visual range
  };

  const getTextColor = (count, max) => {
    if (count === 0) return '#6b7280'; // Gray for zero
    return (count / max > 0.6) ? '#f3f4f6' : '#d1d5db'; // Light text for dark cells, darker for light cells
  };

  if (!userStats || userStats.length === 0) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg my-2 text-center text-gray-400">
        <p>No manager data available for heatmap visualization.</p>
      </div>
    );
  }

  const sortedUsers = [...userStats].sort((a, b) => a.username.localeCompare(b.username));

  return (
    <div className="p-4 bg-gray-800 rounded-lg my-2">
      <div
        className="flex justify-between items-center bg-gray-700 p-3 rounded-md cursor-pointer hover:bg-gray-600 transition-colors mb-4"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="font-semibold text-white text-lg">Positional Drafting Heatmap</h3>
        {expanded ? <ChevronUp className="text-blue-400" /> : <ChevronDown className="text-blue-400" />}
      </div>

      {expanded && (
        <>
          <p className="text-sm text-gray-400 mb-4">
            Visualize how many players of a specific position each manager drafted in each round.
          </p>
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label htmlFor="position-select" className="block text-sm font-medium text-gray-400 mb-1">Select Position:</label>
              <select
                id="position-select"
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              >
                {POSITIONS.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="season-select" className="block text-sm font-medium text-gray-400 mb-1">Select Season:</label>
              <select
                id="season-select"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Years</option>
                {allSeasons.sort((a,b) => b-a).map(season => (
                  <option key={season} value={season}>Season {season}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid gap-px border border-gray-700">
              {/* Header Row (Rounds) */}
              <div className="grid" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${rounds.length}, minmax(40px, 1fr))` }}>
                <div className="p-2 bg-gray-700 text-gray-300 font-semibold text-sm sticky left-0 z-10">Manager / Round</div>
                {rounds.map(round => (
                  <div key={`header-${round}`} className="p-2 bg-gray-700 text-gray-300 font-semibold text-center text-sm">
                    R{round}
                  </div>
                ))}
              </div>

              {/* Data Rows */}
              {sortedUsers.map(user => (
                <div key={user.username} className="grid" style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${rounds.length}, minmax(40px, 1fr))` }}>
                  <div className="p-2 bg-gray-700 text-white font-medium text-sm border-r border-gray-700 sticky left-0 z-10">{user.username}</div>
                  {rounds.map(round => {
                    const count = heatmapData.data[user.username]?.[round] || 0;
                    const bgColor = getColor(count, heatmapData.maxCount);
                    const textColor = getTextColor(count, heatmapData.maxCount);
                    return (
                      <div
                        key={`${user.username}-R${round}`}
                        className="p-2 text-center text-sm border-r border-gray-700 last:border-r-0"
                        style={{ backgroundColor: bgColor, color: textColor }}
                        title={`${user.username}, Round ${round}: ${count} ${selectedPosition}s`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {heatmapData.maxCount === 0 && (
              <div className="p-4 bg-gray-700 rounded-lg text-center text-gray-400 mt-4">
                No data found for {selectedPosition} in {selectedSeason === 'all' ? 'all years' : `season ${selectedSeason}`}.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PositionalHeatmapChart;