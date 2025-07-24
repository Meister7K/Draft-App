// PositionalRunsChart.js
'use client';
import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react'; // Icons for expanding/collapsing

const PositionalRunsChart = ({ positionalRuns }) => {
  // Group runs by season for better organization
  const runsBySeason = positionalRuns.reduce((acc, run) => {
    if (!acc[run.season]) {
      acc[run.season] = [];
    }
    acc[run.season].push(run);
    return acc;
  }, {});

  const [expandedSeason, setExpandedSeason] = React.useState(null);

  const toggleSeason = (season) => {
    setExpandedSeason(expandedSeason === season ? null : season);
  };

  if (!positionalRuns || positionalRuns.length === 0) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg my-2 text-center text-gray-400">
        <p>No significant positional runs detected based on current analysis parameters (e.g., 5+ players of the same position within 10 picks).</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 rounded-lg my-2">
      <p className="text-sm text-gray-400 mb-4">
        Identified positional runs (e.g., a flurry of players at the same position drafted close together) across the analyzed seasons.
        Parameters: Minimum {5} picks within {10} draft slots.
      </p>
      {Object.entries(runsBySeason).sort(([s1], [s2]) => s2 - s1).map(([season, runs]) => (
        <div key={season} className="mb-4 last:mb-0">
          <div
            className="flex justify-between items-center bg-gray-700 p-3 rounded-md cursor-pointer hover:bg-gray-600 transition-colors"
            onClick={() => toggleSeason(season)}
          >
            <h3 className="font-semibold text-white text-lg">Season {season} ({runs.length} runs)</h3>
            {expandedSeason === season ? <ChevronUp className="text-blue-400" /> : <ChevronDown className="text-blue-400" />}
          </div>
          {expandedSeason === season && (
            <div className="mt-2 space-y-3">
              {runs.sort((a,b) => a.startPick - b.startPick).map((run, idx) => (
                <div key={idx} className="bg-gray-700 p-4 rounded-lg border border-gray-600 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-bold text-blue-300">{run.position} Run</span>
                    <span className="text-sm text-gray-400">Picks {run.startPick} - {run.endPick} ({run.numPicks} picks)</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">
                    <strong>Initiator:</strong> {run.initiator} (Pick #{run.picksInRun[0].pickNo})<br />
                    <strong>Caught the tail end:</strong> {run.ender} (Pick #{run.picksInRun[run.picksInRun.length - 1].pickNo})
                  </p>
                  <div className="text-xs text-gray-400 max-h-24 overflow-y-auto">
                    <strong>Picks in run:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {run.picksInRun.map((pick, pIdx) => (
                        <li key={pIdx}>{pick.playerName} ({pick.position}) by {pick.pickedBy} at pick #{pick.pickNo}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PositionalRunsChart;