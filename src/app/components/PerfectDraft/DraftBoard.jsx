'use client'

import { useState } from 'react';

export function DraftBoard({ draftState, analytics, year }) {
  const [selectedPick, setSelectedPick] = useState(null);
  const [filterPosition, setFilterPosition] = useState('ALL');

  console.dir(analytics)

  const getPositionColor = (position) => {
    const colors = {
      QB: 'border-l-red-400',
      RB: 'border-l-teal-400',
      WR: 'border-l-cyan-400',
      TE: 'border-l-green-400',
      FLEX: 'border-l-amber-400',
      BENCH: 'border-l-pink-400'
    };
    return colors[position] || 'border-l-gray-400';
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const filteredPicks = draftState.picks.filter(pick => {
    if (filterPosition === 'ALL') return true;
    return pick.player.player_info.position === filterPosition;
  });

  const renderPick = (pick) => {

    console.dir(pick)
    const isSelected = selectedPick === pick.pickNumber;
    const position = pick.player.player_info.position;
    const projectedPoints = pick.player.seasons[year].season_projected_totals.pts_half_ppr || 0;
    const adp = pick.player.seasons[year].season_projected_totals.adp_2qb || 999;
    

    return (
      <div
        key={pick.pickNumber}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4 cursor-pointer transition-all duration-300 ease-in-out border-l-4 ${getPositionColor(position)} ${isSelected ? 'ring-2 ring-blue-500 transform scale-105' : 'hover:shadow-lg'}`}
        onClick={() => setSelectedPick(isSelected ? null : pick.pickNumber)}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-gray-500 dark:text-gray-400 font-semibold">#{pick.pickNumber}</span>
            <span className="text-gray-800 dark:text-white font-medium">{pick.managerName}</span>
          </div>
          <div className={`text-white text-sm font-bold px-3 py-1 rounded-full ${getScoreColor(pick.score)}`}>
            {Math.round(pick.score)} 
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center space-x-2 mb-1">
            <div className="text-lg font-bold text-gray-900 dark:text-white">{pick.player.player_info.name}</div>
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 space-x-4">
            <span className="font-semibold text-gray-700 dark:text-gray-200">{position}</span>
            <span>{projectedPoints} pts</span>
            <span>ADP: {adp}</span>
          </div>

          {isSelected && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm italic text-gray-700 dark:text-gray-300 mb-3">{pick.reasoning}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Value vs ADP:</span>
                  <span className={pick.pickNumber < adp ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                    {pick.pickNumber < adp ? 'Below ADP' : 'Above ADP'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Projected Points:</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{projectedPoints}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Pick Score:</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{Math.round(pick.score)}/100</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRound = (roundNumber) => {
    const roundPicks = filteredPicks.filter(pick =>
      Math.ceil(pick.pickNumber / draftState.draftOrder.length) === roundNumber
    );

    if (roundPicks.length === 0) return null;

    return (
      <div key={roundNumber} className="mb-8">
        <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Round {roundNumber}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roundPicks.map(pick => renderPick(pick))}
        </div>
      </div>
    );
  };

  const totalRounds = Math.ceil(draftState.totalPicks / draftState.draftOrder.length);
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  const positionStats = {};
  draftState.picks.forEach(pick => {
    const position = pick.player.player_info.position;
    if (!positionStats[position]) {
      positionStats[position] = { count: 0, totalPoints: 0, avgScore: 0 };
    }
    positionStats[position].count++;
    positionStats[position].totalPoints += pick.player.player_info.projected_2025_points || 0;
    positionStats[position].avgScore += pick.score;
  });

  Object.keys(positionStats).forEach(position => {
    positionStats[position].avgScore = Math.round(positionStats[position].avgScore / positionStats[position].count);
    positionStats[position].avgPoints = Math.round(positionStats[position].totalPoints / positionStats[position].count);
  });

  return (
    <div className="p-6 bg-gray-100 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-3xl font-extrabold mb-4 text-center">Perfect Draft Board</h2>
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <label htmlFor="position-filter" className="text-gray-700 dark:text-gray-300 font-medium">Filter by Position:</label>
              <select
                id="position-filter"
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className="block w-full md:w-40 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 dark:text-white"
              >
                <option value="ALL">All Positions</option>
                <option value="QB">QB</option>
                <option value="RB">RB</option>
                <option value="WR">WR</option>
                <option value="TE">TE</option>
              </select>
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Total Picks: <span className="font-bold">{draftState.picks.length}</span></span>
              <span className="font-medium">Avg Score: <span className="font-bold">{Math.round(
                draftState.picks.reduce((sum, pick) => sum + pick.score, 0) / draftState.picks.length
              )}</span></span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <h4 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Position Breakdown</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Object.entries(positionStats).map(([position, stats]) => (
              <div key={position} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 shadow-sm">
                <div className="flex items-center mb-2">
                  <div className={`w-3 h-3 rounded-full mr-2 ${getPositionColor(position).replace('border-l', 'bg')}`}></div>
                  <div className="text-lg font-semibold">{position}</div>
                </div>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Count:</span>
                    <span className="font-semibold text-gray-800 dark:text-white">{stats.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Points:</span>
                    <span className="font-semibold text-gray-800 dark:text-white">{stats.avgPoints}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Score:</span>
                    <span className="font-semibold text-gray-800 dark:text-white">{stats.avgScore}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="draft-board-content">
          {rounds.map(roundNumber => renderRound(roundNumber))}
        </div>

        {selectedPick && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl max-w-lg w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Pick Analysis</h3>
                <button onClick={() => setSelectedPick(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-gray-700 dark:text-gray-300">
                {/* Find the selected pick to display detailed info */}
                {(() => {
                  const pick = draftState.picks.find(p => p.pickNumber === selectedPick);
                  if (!pick) return null;
                  return (
                    <div>
                      <div className="text-lg font-bold mb-2">{pick.player.player_info.name}</div>
                      <p className="mb-4">{pick.reasoning}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Pick Number:</span>
                          <span className="text-base font-semibold">{pick.pickNumber}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Manager:</span>
                          <span className="text-base font-semibold">{pick.managerName}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Position:</span>
                          <span className="text-base font-semibold">{pick.player.player_info.position}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Pick Score:</span>
                          <span className="text-base font-semibold">{Math.round(pick.score)}/100</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}