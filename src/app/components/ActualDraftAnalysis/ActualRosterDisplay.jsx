"use client";

import { useState, useMemo } from "react";

export function ActualRosterDisplay({ analytics, draftPicks, selectedDraft, leagueUsers }) {
  const [selectedManager, setSelectedManager] = useState(null);

  // Build rosters from actual draft picks
  const rosters = useMemo(() => {
    if (!analytics?.pickAnalyses || !leagueUsers) return {};

    const rosterData = {};
    
    // Initialize rosters for each manager
    leagueUsers.forEach(user => {
      rosterData[user.user_id] = {
        managerId: user.user_id,
        managerName: user.display_name,
        picks: [],
        totalProjectedPoints: 0,
        averageGrade: 0,
        positionCounts: {},
        bestPick: null,
        worstPick: null
      };
    });

    // Populate rosters with actual picks
    analytics.pickAnalyses.forEach(pickAnalysis => {
      const managerId = pickAnalysis.pick.picked_by;
      if (rosterData[managerId]) {
        const roster = rosterData[managerId];
        const position = pickAnalysis.pickedPlayer.player_info.position;
        const projectedPoints = pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;

        roster.picks.push(pickAnalysis);
        roster.totalProjectedPoints += projectedPoints;
        roster.positionCounts[position] = (roster.positionCounts[position] || 0) + 1;

        // Track best and worst picks
        if (!roster.bestPick || pickAnalysis.grade > roster.bestPick.grade) {
          roster.bestPick = pickAnalysis;
        }
        if (!roster.worstPick || pickAnalysis.grade < roster.worstPick.grade) {
          roster.worstPick = pickAnalysis;
        }
      }
    });

    // Calculate averages
    Object.values(rosterData).forEach(roster => {
      if (roster.picks.length > 0) {
        roster.averageGrade = roster.picks.reduce((sum, pick) => sum + pick.grade, 0) / roster.picks.length;
      }
    });

    return rosterData;
  }, [analytics?.pickAnalyses, leagueUsers, selectedDraft?.season]);

  // Sort rosters by total projected points
  const sortedRosters = useMemo(() => {
    return Object.values(rosters).sort((a, b) => b.totalProjectedPoints - a.totalProjectedPoints);
  }, [rosters]);

  const getPositionColor = (position) => {
    const colors = {
      QB: 'bg-purple-500 border-purple-500 text-purple-700',
      RB: 'bg-green-500 border-green-500 text-green-700',
      WR: 'bg-blue-500 border-blue-500 text-blue-700',
      TE: 'bg-orange-500 border-orange-500 text-orange-700',
      K: 'bg-gray-500 border-gray-500 text-gray-700',
      DEF: 'bg-red-500 border-red-500 text-red-700'
    };
    return colors[position] || 'bg-gray-500 border-gray-500 text-gray-700';
  };

  const getPositionBadgeColor = (position) => {
    const colors = {
      QB: 'bg-purple-100 text-purple-800 border-purple-200',
      RB: 'bg-green-100 text-green-800 border-green-200',
      WR: 'bg-blue-100 text-blue-800 border-blue-200',
      TE: 'bg-orange-100 text-orange-800 border-orange-200',
      K: 'bg-gray-100 text-gray-800 border-gray-200',
      DEF: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[position] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getGradeColor = (grade) => {
    if (grade >= 85) return 'text-green-400';
    if (grade >= 70) return 'text-blue-400';
    if (grade >= 55) return 'text-yellow-400';
    if (grade >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const renderPlayer = (pickAnalysis, index) => {
    const player = pickAnalysis.pickedPlayer;
    const positionColors = getPositionColor(player.player_info.position);
    const projectedPoints = player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
    const gradeColor = getGradeColor(pickAnalysis.grade);

    return (
      <div key={index} className={`bg-gray-800 border-l-4 ${positionColors} rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-700`}>
        <div className="flex justify-between items-start mb-2">
          <div className="font-semibold text-white text-sm leading-tight">
            {player.player_info.name}
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPositionBadgeColor(player.player_info.position)}`}>
              {player.player_info.position}
            </span>
            <span className={`text-xs font-bold ${gradeColor}`}>
              {pickAnalysis.grade}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span className="font-medium">{projectedPoints.toFixed(1)} pts</span>
          <div className="flex items-center space-x-2">
            <span className="text-gray-500">Pick #{pickAnalysis.pickNumber}</span>
            {pickAnalysis.optimalPick && pickAnalysis.optimalPick.player.player_info.player_id !== player.player_info.player_id && (
              <span className="text-yellow-400 text-xs">vs Opt</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRoster = (roster, index) => {
    const isSelected = selectedManager === roster.managerId;
    const pickCount = roster.picks.length;
    
    // Calculate roster strength metrics
    const optimalMatches = roster.picks.filter(pick => 
      pick.optimalPick && pick.optimalPick.player.player_info.player_id === pick.pickedPlayer.player_info.player_id
    ).length;
    const optimalPercentage = pickCount > 0 ? (optimalMatches / pickCount) * 100 : 0;
    
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
                <p className="text-sm text-gray-400">{pickCount} picks made</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">{roster.totalProjectedPoints.toFixed(1)}</div>
              <div className="text-xs text-gray-400">projected pts</div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-gray-700 rounded-lg">
              <div className="text-lg font-semibold text-white">{Math.round(roster.averageGrade)}</div>
              <div className="text-xs text-gray-400">avg grade</div>
            </div>
            <div className="text-center p-3 bg-gray-700 rounded-lg">
              <div className="text-lg font-semibold text-green-400">{optimalMatches}</div>
              <div className="text-xs text-gray-400">optimal</div>
            </div>
            <div className="text-center p-3 bg-gray-700 rounded-lg">
              <div className="text-lg font-semibold text-purple-400">{optimalPercentage.toFixed(0)}%</div>
              <div className="text-xs text-gray-400">optimal %</div>
            </div>
            <div className="text-center p-3 bg-gray-700 rounded-lg">
              <div className={`text-lg font-semibold ${roster.bestPick ? getGradeColor(roster.bestPick.grade) : 'text-gray-400'}`}>
                {roster.bestPick ? roster.bestPick.grade : 'N/A'}
              </div>
              <div className="text-xs text-gray-400">best pick</div>
            </div>
          </div>
        </div>

        {/* Position Breakdown */}
        <div className="p-6">
          <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Position Breakdown
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(roster.positionCounts).map(([position, count]) => (
              <div key={position} className="flex justify-between items-center p-2 bg-gray-700 rounded-lg border border-gray-600">
                <span className={`text-xs font-medium ${getPositionBadgeColor(position).split(' ')[1]}`}>
                  {position}
                </span>
                <span className="text-xs font-bold text-white">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expanded Roster Details */}
        {isSelected && (
          <div className="border-t border-gray-700">
            {/* Best and Worst Picks */}
            <div className="p-6 border-b border-gray-700">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Pick Highlights</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roster.bestPick && (
                  <div className="bg-green-900/30 p-3 rounded-lg border border-green-700">
                    <div className="text-green-300 text-xs font-medium mb-1">Best Pick</div>
                    <div className="text-white font-semibold">{roster.bestPick.pickedPlayer.player_info.name}</div>
                    <div className="text-gray-400 text-xs">
                      Pick #{roster.bestPick.pickNumber} • Grade {roster.bestPick.grade}
                    </div>
                  </div>
                )}
                {roster.worstPick && (
                  <div className="bg-red-900/30 p-3 rounded-lg border border-red-700">
                    <div className="text-red-300 text-xs font-medium mb-1">Worst Pick</div>
                    <div className="text-white font-semibold">{roster.worstPick.pickedPlayer.player_info.name}</div>
                    <div className="text-gray-400 text-xs">
                      Pick #{roster.worstPick.pickNumber} • Grade {roster.worstPick.grade}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Full Roster */}
            <div className="p-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Complete Roster ({roster.picks.length} players)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {roster.picks
                  .sort((a, b) => a.pickNumber - b.pickNumber)
                  .map((pickAnalysis, index) => renderPlayer(pickAnalysis, index))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!analytics?.pickAnalyses || sortedRosters.length === 0) {
    return (
      <div className="p-6 bg-gray-900 min-h-screen text-white">
        <div className="text-center py-12">
          <p className="text-gray-400">No roster data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Draft Rosters Analysis</h2>
          <p className="text-gray-400">
            Complete roster breakdown with grades and optimal pick analysis
          </p>
        </div>

        {/* Roster Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {sortedRosters.map((roster, index) => renderRoster(roster, index))}
        </div>

        {/* Summary Stats */}
        <div className="mt-12 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">League Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {sortedRosters.reduce((sum, roster) => sum + roster.picks.length, 0)}
              </div>
              <div className="text-sm text-gray-400">Total Picks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {Math.round(sortedRosters.reduce((sum, roster) => sum + roster.averageGrade, 0) / sortedRosters.length)}
              </div>
              <div className="text-sm text-gray-400">League Avg Grade</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {sortedRosters.reduce((sum, roster) => 
                  sum + roster.picks.filter(pick => 
                    pick.optimalPick && pick.optimalPick.player.player_info.player_id === pick.pickedPlayer.player_info.player_id
                  ).length, 0
                )}
              </div>
              <div className="text-sm text-gray-400">Optimal Picks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {Math.round(sortedRosters[0]?.totalProjectedPoints || 0)}
              </div>
              <div className="text-sm text-gray-400">Highest Total Pts</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}