// components/DraftSpotProbabilityHeatmap.js
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Define a consistent color palette for positions (can be imported from page.js if desired)
const POSITION_COLORS = {
  'QB': 'rgba(255, 99, 132, 0.7)', // Red
  'RB': 'rgba(54, 162, 235, 0.7)', // Blue
  'WR': 'rgba(255, 206, 86, 0.7)', // Yellow
  'TE': 'rgba(75, 192, 192, 0.7)', // Teal
  'K': 'rgba(153, 102, 255, 0.7)', // Purple
  'DEF': 'rgba(255, 159, 64, 0.7)', // Orange
  'DST': 'rgba(255, 159, 64, 0.7)', // Orange (same as DEF)
  'DL': 'rgba(199, 199, 199, 0.7)', // Grey
  'LB': 'rgba(80, 200, 120, 0.7)', // Greenish
  'DB': 'rgba(200, 100, 200, 0.7)', // Pinkish
  'IDP': 'rgba(100, 150, 200, 0.7)', // Light Blue
  'FLEX': 'rgba(220, 220, 50, 0.7)', // Olive
  'SUPER_FLEX': 'rgba(180, 100, 50, 0.7)', // Brown
  'Unknown': 'rgba(100, 100, 100, 0.7)', // Dark Grey for unknown
};

const ALL_POSITIONS_OPTION = 'All Positions';
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB', 'IDP', 'FLEX', 'SUPER_FLEX', 'Unknown']; // Positions to display in filter

const DraftSpotProbabilityHeatmap = ({ draftData, allSeasons }) => {
  const [selectedPosition, setSelectedPosition] = useState(ALL_POSITIONS_OPTION); // Default to 'All Positions'
  const [selectedSeason, setSelectedSeason] = useState('all'); // Default to 'all' years
  const [expanded, setExpanded] = useState(false);

  // Memoize the processed data for the heatmap
  const heatmapData = useMemo(() => {
    const data = new Map(); // Map<pickNo, Map<position, count>>
    const totalPicksAtSpot = new Map(); // Map<pickNo, totalCount>
    let maxTotalPicks = 0; // Max count for 'All Positions' scaling (old logic)
    let maxHighestPercentage = 0; // NEW: Max highest percentage for 'All Positions' scaling
    const maxCountForPosition = new Map(); // Map<position, maxCount> for individual position scaling

    // Filter drafts by selected season
    const filteredDrafts = selectedSeason === 'all'
      ? draftData
      : draftData.filter(d => d.season === selectedSeason);

    filteredDrafts.forEach(draft => {
      draft.picks.forEach(pick => {
        const pickNo = pick.pick_no;
        const position = pick.metadata?.position || 'Unknown';

        // Initialize maps for pickNo if not present
        if (!data.has(pickNo)) {
          data.set(pickNo, new Map());
          totalPicksAtSpot.set(pickNo, 0);
        }

        // Update position count for this pickNo
        const positionCounts = data.get(pickNo);
        positionCounts.set(position, (positionCounts.get(position) || 0) + 1);

        // Update total picks at this pickNo
        totalPicksAtSpot.set(pickNo, totalPicksAtSpot.get(pickNo) + 1);

        // Update max counts for scaling (for individual position filter)
        maxCountForPosition.set(position, Math.max(maxCountForPosition.get(position) || 0, positionCounts.get(position)));
      });
    });

    // Calculate maxHighestPercentage for "All Positions" view
    totalPicksAtSpot.forEach((totalCount, pickNo) => {
      if (totalCount > 0) {
        const positionCounts = data.get(pickNo);
        let currentHighestPercentage = 0;
        positionCounts.forEach((count) => {
          currentHighestPercentage = Math.max(currentHighestPercentage, (count / totalCount) * 100);
        });
        maxHighestPercentage = Math.max(maxHighestPercentage, currentHighestPercentage);
      }
    });


    // Get all unique pick numbers and sort them
    const allPickNumbers = Array.from(data.keys()).sort((a, b) => a - b);

    return { data, totalPicksAtSpot, maxTotalPicks, maxCountForPosition, allPickNumbers, maxHighestPercentage };
  }, [draftData, selectedSeason]);

  // Function to get color based on count/probability
  const getColor = (value, max) => {
    if (max === 0 || value === 0) return 'rgba(40, 44, 52, 0.5)'; // Transparent/dark background for no data
    const intensity = value / max;
    // Example: From light blue to dark blue for higher intensity
    return `rgba(60, 150, 250, ${0.3 + intensity * 0.7})`; // Adjust alpha for better visual range
  };

  const getTextColor = (value, max) => {
    if (value === 0) return '#6b7280'; // Gray for zero
    return (value / max > 0.6) ? '#f3f4f6' : '#d1d5db'; // Light text for dark cells, darker for light cells
  };

  // Prepare the rows for the heatmap
  const heatmapRows = useMemo(() => {
    const rows = [];
    const maxPickNo = heatmapData.allPickNumbers.length > 0 ? Math.max(...heatmapData.allPickNumbers) : 0;
    const maxPicksPerRound = 12; // Assuming 12 picks per round for typical fantasy leagues

    // Create an array of rounds to display, capping at a reasonable number for readability
    const displayMaxRound = Math.ceil(maxPickNo / maxPicksPerRound);
    const roundsToDisplay = Array.from({ length: displayMaxRound }, (_, i) => i + 1);

    // Create an array of pick numbers within each round
    const picksByRound = new Map();
    roundsToDisplay.forEach(round => {
      picksByRound.set(round, []);
      for (let i = (round - 1) * maxPicksPerRound + 1; i <= Math.min(round * maxPicksPerRound, maxPickNo); i++) {
        picksByRound.get(round).push(i);
      }
    });

    roundsToDisplay.forEach(round => {
      const picksInThisRound = picksByRound.get(round);
      if (picksInThisRound.length === 0) return; // Skip if no picks in this round

      const rowData = {
        round: round,
        cells: []
      };

      picksInThisRound.forEach(pickNo => {
        const positionCounts = heatmapData.data.get(pickNo) || new Map();
        const totalPicksAtThisSpot = heatmapData.totalPicksAtSpot.get(pickNo) || 0;

        let displayValue = '';
        let cellColor = '';
        let cellTextColor = '';
        let tooltipText = `Pick ${pickNo}:\n`;

        if (totalPicksAtThisSpot === 0) {
          displayValue = '';
          cellColor = getColor(0, 1); // Use base color for empty
          cellTextColor = getTextColor(0, 1);
          tooltipText += 'No picks recorded.';
        } else {
          // Build tooltip text with all position percentages
          const sortedPositions = Array.from(positionCounts.keys()).sort((a, b) => {
            const probA = (positionCounts.get(a) || 0) / totalPicksAtThisSpot;
            const probB = (positionCounts.get(b) || 0) / totalPicksAtThisSpot;
            return probB - probA; // Sort by highest probability first
          });

          sortedPositions.forEach(pos => {
            const count = positionCounts.get(pos) || 0;
            const percentage = ((count / totalPicksAtThisSpot) * 100).toFixed(1);
            tooltipText += `${pos}: ${percentage}% (${count} picks)\n`;
          });

          if (selectedPosition === ALL_POSITIONS_OPTION) {
            // NEW: Display highest percentage for a position at this spot
            let highestPercentage = 0;
            if (totalPicksAtThisSpot > 0) {
              positionCounts.forEach((count) => {
                highestPercentage = Math.max(highestPercentage, (count / totalPicksAtThisSpot) * 100);
              });
            }
            displayValue = highestPercentage > 0 ? `${highestPercentage.toFixed(0)}%` : '';
            cellColor = getColor(highestPercentage, heatmapData.maxHighestPercentage);
            cellTextColor = getTextColor(highestPercentage, heatmapData.maxHighestPercentage);

          } else {
            // Display probability of selected position, color based on its max count
            const countForSelectedPos = positionCounts.get(selectedPosition) || 0;
            const probability = ((countForSelectedPos / totalPicksAtThisSpot) * 100).toFixed(1);
            displayValue = countForSelectedPos > 0 ? `${probability}%` : '';
            cellColor = getColor(countForSelectedPos, heatmapData.maxCountForPosition.get(selectedPosition) || 1);
            cellTextColor = getTextColor(countForSelectedPos, heatmapData.maxCountForPosition.get(selectedPosition) || 1);
          }
        }

        rowData.cells.push({
          pickNo,
          displayValue,
          cellColor,
          cellTextColor,
          tooltipText: tooltipText.trim()
        });
      });
      rows.push(rowData);
    });
    return rows;
  }, [heatmapData, selectedPosition]);


  if (!draftData || draftData.length === 0) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg my-2 text-center text-gray-400">
        <p>No draft data available for probability heatmap visualization.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 rounded-lg my-2">
      <div
        className="flex justify-between items-center bg-gray-700 p-3 rounded-md cursor-pointer hover:bg-gray-600 transition-colors mb-4"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="font-semibold text-white text-lg">Draft Spot Positional Probability Heatmap</h3>
        {expanded ? <ChevronUp className="text-blue-400" /> : <ChevronDown className="text-blue-400" />}
      </div>

      {expanded && (
        <>
          <p className="text-sm text-gray-400 mb-4">
            Visualize the probability of a specific position being drafted at each pick number (draft spot).
            When "All Positions" is selected, cells show the highest percentage for any single position at that spot, with a detailed breakdown on hover.
          </p>
          <div className="flex flex-wrap gap-4 mb-6">
            <div>
              <label htmlFor="position-select-prob" className="block text-sm font-medium text-gray-400 mb-1">Select Position:</label>
              <select
                id="position-select-prob"
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={ALL_POSITIONS_OPTION}>{ALL_POSITIONS_OPTION}</option>
                {POSITIONS.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="season-select-prob" className="block text-sm font-medium text-gray-400 mb-1">Select Season:</label>
              <select
                id="season-select-prob"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Years</option>
                {allSeasons.sort((a, b) => b - a).map(season => (
                  <option key={season} value={season}>Season {season}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid gap-px border border-gray-700">
              {/* Header Row (Pick Numbers) */}
              <div className="grid" style={{ gridTemplateColumns: `minmax(80px, 1fr) repeat(12, minmax(40px, 1fr))` }}>
                <div className="p-2 bg-gray-700 text-gray-300 font-semibold text-sm sticky left-0 z-10">Round / Pick</div>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(pickInRound => (
                  <div key={`header-pick-${pickInRound}`} className="p-2 bg-gray-700 text-gray-300 font-semibold text-center text-sm">
                    P{pickInRound}
                  </div>
                ))}
              </div>

              {/* Data Rows (Rounds) */}
              {heatmapRows.map(rowData => (
                <div key={`round-${rowData.round}`} className="grid" style={{ gridTemplateColumns: `minmax(80px, 1fr) repeat(12, minmax(40px, 1fr))` }}>
                  <div className="p-2 bg-gray-700 text-white font-medium text-sm border-r border-gray-700 sticky left-0 z-10">R{rowData.round}</div>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(pickInRound => {
                    const pickNo = (rowData.round - 1) * 12 + pickInRound;
                    const cell = rowData.cells.find(c => c.pickNo === pickNo);

                    return (
                      <div
                        key={`cell-${pickNo}`}
                        className="p-2 text-center text-sm border-r border-gray-700 last:border-r-0 flex items-center justify-center"
                        style={{ backgroundColor: cell?.cellColor || 'rgba(40, 44, 52, 0.5)', color: cell?.cellTextColor || '#6b7280' }}
                        title={cell?.tooltipText || `Pick ${pickNo}: No data`}
                      >
                        {cell?.displayValue || ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {heatmapData.allPickNumbers.length === 0 && (
              <div className="p-4 bg-gray-700 rounded-lg text-center text-gray-400 mt-4">
                No draft pick data found for this season.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DraftSpotProbabilityHeatmap;
