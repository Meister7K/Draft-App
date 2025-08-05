'use client'

import { useState } from 'react';

export function RosterDisplay({ rosters, analytics }) {
  const [selectedManager, setSelectedManager] = useState(null);

  const sortedRosters = Object.values(rosters).sort((a, b) => 
    (analytics.totalProjectedPoints[b.managerId] || 0) - (analytics.totalProjectedPoints[a.managerId] || 0)
  );

  const getPositionColor = (position) => {
    const colors = {
      QB: 'bg-red-500 border-red-500 text-red-700',
      RB: 'bg-teal-500 border-teal-500 text-teal-700',
      WR: 'bg-blue-500 border-blue-500 text-blue-700',
      TE: 'bg-green-500 border-green-500 text-green-700',
      FLEX: 'bg-yellow-500 border-yellow-500 text-yellow-700',
      BENCH: 'bg-purple-500 border-purple-500 text-purple-700'
    };
    return colors[position] || 'bg-gray-500 border-gray-500 text-gray-700';
  };

  const getPositionBadgeColor = (position) => {
    const colors = {
      QB: 'bg-red-100 text-red-800 border-red-200',
      RB: 'bg-teal-100 text-teal-800 border-teal-200',
      WR: 'bg-blue-100 text-blue-800 border-blue-200',
      TE: 'bg-green-100 text-green-800 border-green-200',
      FLEX: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      BENCH: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[position] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const renderPlayer = (player, index, year = '2025') => {
    if (!player) {
      return (
        <div key={index} className="bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg p-3 text-center">
          <span className="text-gray-500 text-sm italic">Empty Slot</span>
        </div>
      );
    }

    const positionColors = getPositionColor(player.player_info.position);
    const projectedPoints = player.seasons?.[year]?.season_projected_totals?.pts_half_ppr || 0;

    return (
      <div key={index} className={`bg-gray-800 border-l-4 ${positionColors} rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-700`}>
        <div className="flex justify-between items-start mb-2">
          <div className="font-semibold text-white text-sm leading-tight">
            {player.player_info.name}
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPositionBadgeColor(player.player_info.position)}`}>
            {player.player_info.position}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span className="font-medium">{projectedPoints.toFixed(1)} pts</span>
          <span className="text-gray-500">#{index + 1}</span>
        </div>
      </div>
    );
  };

  const renderRoster = (roster, index) => {
    const isSelected = selectedManager === roster.managerId;
    const totalPoints = analytics.totalProjectedPoints[roster.managerId] || 0;
    const pickCount = roster.picks.length;
    const avgPickScore = pickCount > 0 ? (roster.picks.reduce((sum, pick) => sum + (pick.analysis?.totalValue || 0), 0) / pickCount) : 0;
    
    // Calculate completion percentage
    const totalNeeds = Object.values(roster.positionNeeds).reduce((sum, need) => sum + Math.max(0, need), 0);
    const maxNeeds = Object.values(roster.positionNeeds).reduce((sum, need) => sum + need, 0);
    const completionPercentage = maxNeeds > 0 ? ((maxNeeds - totalNeeds) / maxNeeds) * 100 : 100;
    
    return (
      <div 
        key={roster.managerId} 
        className={`bg-gray-800 rounded-xl shadow-lg border-2 transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 ${
          isSelected 
            ? 'border-blue-500 ring-4 ring-blue-900 shadow-blue-900' 
            : 'border-gray-700 hover:border-gray-600'
        }`}
        onClick={() => setSelectedManager(isSelected ? null : roster.managerId)}
      >
        {/* Roster Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-blue-500'
              }`}>
                #{index + 1}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{roster.managerName}</h3>
                <p className="text-sm text-gray-400">Draft Position: {roster.draftPosition}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{totalPoints.toFixed(1)}</div>
              <div className="text-xs text-gray-400">projected pts</div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-700 rounded-lg">
              <div className="text-lg font-semibold text-white">{pickCount}</div>
              <div className="text-xs text-gray-400">picks made</div>
            </div>
            <div className="text-center p-3 bg-gray-700 rounded-lg">
              <div className="text-lg font-semibold text-blue-400">{avgPickScore.toFixed(0)}</div>
              <div className="text-xs text-gray-400">avg score</div>
            </div>
            <div className="text-center p-3 bg-gray-700 rounded-lg">
              <div className="text-lg font-semibold text-purple-400">{completionPercentage.toFixed(0)}%</div>
              <div className="text-xs text-gray-400">complete</div>
            </div>
          </div>
        </div>

        {/* Position Needs */}
        <div className="p-6">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Position Needs
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(roster.positionNeeds).map(([position, count]) => (
              <div key={position} className={`flex justify-between items-center p-2 rounded-lg border ${
                count > 0 ? 'bg-red-900 border-red-700' : 'bg-green-900 border-green-700'
              }`}>
                <span className={`text-xs font-medium ${getPositionBadgeColor(position).split(' ')[1]}`}>
                  {position}
                </span>
                <span className={`text-xs font-bold ${
                  count > 0 ? 'text-red-300' : 'text-green-300'
                }`}>
                  {count > 0 ? count : '✓'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expanded Roster Details */}
        {isSelected && (
          <div className="border-t border-gray-700 bg-gray-900">
            <div className="p-6">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Roster Breakdown
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(roster.roster).map(([position, players]) => (
                  <div key={position} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className={`font-semibold text-sm ${getPositionColor(position).split(' ')[2]}`}>
                        {position}
                      </h5>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPositionBadgeColor(position)}`}>
                        {players.length} player{players.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {players.length > 0 ? (
                        players.map((player, playerIndex) => renderPlayer(player, playerIndex))
                      ) : (
                        <div className="bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
                          <span className="text-gray-500 text-sm italic">No players drafted</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const totalPoints = Object.values(analytics.totalProjectedPoints).reduce((sum, points) => sum + points, 0);
  const avgPoints = totalPoints / Math.max(1, Object.keys(analytics.totalProjectedPoints).length);
  const highestPoints = Math.max(...Object.values(analytics.totalProjectedPoints));
  const lowestPoints = Math.min(...Object.values(analytics.totalProjectedPoints));

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center">
              <svg className="w-7 h-7 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Roster Analysis
            </h2>
            <p className="text-gray-400 text-sm">Click on any roster to view detailed breakdown</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">League Average</div>
            <div className="text-xl font-bold text-blue-400">{avgPoints.toFixed(1)} pts</div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="text-2xl font-bold">{sortedRosters.length}</div>
            <div className="text-blue-100 text-sm">Total Managers</div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
            <div className="text-2xl font-bold">{highestPoints.toFixed(0)}</div>
            <div className="text-green-100 text-sm">Highest Score</div>
          </div>
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-lg p-4 text-white">
            <div className="text-2xl font-bold">{lowestPoints.toFixed(0)}</div>
            <div className="text-red-100 text-sm">Lowest Score</div>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <div className="text-2xl font-bold">{(highestPoints - lowestPoints).toFixed(0)}</div>
            <div className="text-purple-100 text-sm">Point Spread</div>
          </div>
        </div>
      </div>

      {/* Rosters Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {sortedRosters.map((roster, index) => renderRoster(roster, index))}
        </div>
      </div>

      {/* Selected Manager Analysis */}
      {selectedManager && (
        <div className="bg-gray-800 border-t border-gray-700 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Advanced Analysis
            </h3>
            <button 
              onClick={() => setSelectedManager(null)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm italic">
              Detailed roster analysis and recommendations will be displayed here for the selected manager.
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 