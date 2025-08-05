"use client";

import { useState, useMemo } from "react";

export function ActualDraftAnalyticsPanel({ 
  analytics, 
  draftPicks, 
  selectedDraft, 
  leagueUsers 
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);

  const getGradeColor = (grade) => {
    if (grade >= 85) return "text-green-400 bg-green-900/30 border-green-700";
    if (grade >= 70) return "text-blue-400 bg-blue-900/30 border-blue-700";
    if (grade >= 55) return "text-yellow-400 bg-yellow-900/30 border-yellow-700";
    if (grade >= 40) return "text-orange-400 bg-orange-900/30 border-orange-700";
    return "text-red-400 bg-red-900/30 border-red-700";
  };

  const getGradeLabel = (grade) => {
    if (grade >= 85) return "Excellent";
    if (grade >= 70) return "Good";
    if (grade >= 55) return "Average";
    if (grade >= 40) return "Poor";
    return "Terrible";
  };

  const getPositionColor = (position) => {
    const colors = {
      QB: "bg-purple-600 text-purple-100",
      RB: "bg-green-600 text-green-100", 
      WR: "bg-blue-600 text-blue-100",
      TE: "bg-orange-600 text-orange-100",
      K: "bg-gray-600 text-gray-100",
      DEF: "bg-red-600 text-red-100"
    };
    return colors[position] || "bg-gray-600 text-gray-100";
  };

  // Sort managers by average grade
  const sortedManagers = useMemo(() => {
    return [...analytics.managerGrades].sort((a, b) => b.averageGrade - a.averageGrade);
  }, [analytics.managerGrades]);

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-blue-100">Average Grade</h4>
            <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <div className="text-2xl font-bold">{analytics.overallStats.averageGrade}</div>
          <div className="text-xs text-blue-200 mt-1">Out of 100</div>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-green-100">Excellent Picks</h4>
            <svg className="w-5 h-5 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div className="text-2xl font-bold">{analytics.overallStats.excellentPicks}</div>
          <div className="text-xs text-green-200 mt-1">Grade 85+</div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-red-100">Poor Picks</h4>
            <svg className="w-5 h-5 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="text-2xl font-bold">{analytics.overallStats.poorPicks}</div>
          <div className="text-xs text-red-200 mt-1">Grade &lt;40</div>
        </div>

        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-orange-100">Opportunity Cost</h4>
            <svg className="w-5 h-5 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6 6" />
            </svg>
          </div>
          <div className="text-2xl font-bold">{analytics.overallStats.totalOpportunityCost}</div>
          <div className="text-xs text-orange-200 mt-1">Total missed value</div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-purple-100">Optimal Matches</h4>
            <svg className="w-5 h-5 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-2xl font-bold">
            {analytics.pickAnalyses.filter(p => 
              p.optimalPick && p.optimalPick.player.player_info.player_id === p.pickedPlayer.player_info.player_id
            ).length}
          </div>
          <div className="text-xs text-purple-200 mt-1">Picked optimal player</div>
        </div>
      </div>

      {/* Manager Rankings */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          Manager Draft Grades
        </h4>
        <div className="space-y-3">
          {sortedManagers.map((manager, index) => {
            const rankColors = ["bg-yellow-500", "bg-gray-400", "bg-amber-600"];
            const rankColor = rankColors[index] || "bg-blue-500";
            const gradeColor = getGradeColor(manager.averageGrade);

            return (
              <div
                key={manager.managerId}
                className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors cursor-pointer"
                onClick={() => setSelectedManager(manager.managerId)}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-8 h-8 ${rankColor} rounded-full flex items-center justify-center text-white font-bold text-sm`}>
                    #{index + 1}
                  </div>
                  <div>
                    <div className="text-white font-medium">{manager.managerName}</div>
                    <div className="text-gray-400 text-sm">{manager.picks.length} picks</div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className={`px-3 py-1 rounded-full text-sm font-bold border ${gradeColor}`}>
                    {Math.round(manager.averageGrade)}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {getGradeLabel(manager.averageGrade)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actual vs Optimal Analysis */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Actual vs Optimal Picks
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">
              {analytics.pickAnalyses.filter(p => 
                p.optimalPick && p.optimalPick.player.player_info.player_id === p.pickedPlayer.player_info.player_id
              ).length}
            </div>
            <div className="text-sm text-gray-400">Perfect Matches</div>
            <div className="text-xs text-green-400 mt-1">
              {((analytics.pickAnalyses.filter(p => 
                p.optimalPick && p.optimalPick.player.player_info.player_id === p.pickedPlayer.player_info.player_id
              ).length / analytics.pickAnalyses.length) * 100).toFixed(1)}% of picks
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-2">
              {analytics.pickAnalyses.filter(p => 
                p.optimalPick && p.optimalPick.player.player_info.player_id !== p.pickedPlayer.player_info.player_id &&
                p.grade >= 70
              ).length}
            </div>
            <div className="text-sm text-gray-400">Good Alternatives</div>
            <div className="text-xs text-yellow-400 mt-1">
              Different but still good picks
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400 mb-2">
              {analytics.pickAnalyses.filter(p => 
                p.optimalPick && p.optimalPick.player.player_info.player_id !== p.pickedPlayer.player_info.player_id &&
                p.grade < 70
              ).length}
            </div>
            <div className="text-sm text-gray-400">Missed Opportunities</div>
            <div className="text-xs text-red-400 mt-1">
              Should have picked optimal
            </div>
          </div>
        </div>
        
        {/* Top Missed Opportunities */}
        <div className="mt-6">
          <h5 className="text-md font-semibold text-white mb-3">Biggest Missed Opportunities</h5>
          <div className="space-y-2">
            {analytics.pickAnalyses
              .filter(p => p.optimalPick && p.optimalPick.player.player_info.player_id !== p.pickedPlayer.player_info.player_id)
              .sort((a, b) => {
                const aDiff = (a.optimalPick.player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0) - 
                             (a.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0);
                const bDiff = (b.optimalPick.player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0) - 
                             (b.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0);
                return bDiff - aDiff;
              })
              .slice(0, 3)
              .map((pickAnalysis, index) => {
                const pointDiff = (pickAnalysis.optimalPick.player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0) - 
                                 (pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0);
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-400 font-semibold">#{pickAnalysis.pickNumber}</span>
                      <div>
                        <div className="text-white font-medium">{pickAnalysis.managerName}</div>
                        <div className="text-sm text-gray-400">
                          Picked <span className="text-red-300">{pickAnalysis.pickedPlayer.player_info.name}</span> instead of <span className="text-green-300">{pickAnalysis.optimalPick.player.player_info.name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-red-400 font-bold">-{pointDiff.toFixed(1)} pts</div>
                      <div className="text-xs text-gray-400">missed value</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Grade Distribution */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h4 className="text-lg font-semibold text-white mb-4">Grade Distribution</h4>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(analytics.overallStats.gradeDistribution).map(([grade, count]) => (
            <div key={grade} className="text-center">
              <div className={`text-2xl font-bold ${
                grade === 'excellent' ? 'text-green-400' :
                grade === 'good' ? 'text-blue-400' :
                grade === 'average' ? 'text-yellow-400' :
                grade === 'poor' ? 'text-orange-400' : 'text-red-400'
              }`}>
                {count}
              </div>
              <div className="text-xs text-gray-400 capitalize">{grade}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPickAnalysis = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-xl font-bold text-white">Individual Pick Analysis</h4>
        <div className="flex items-center space-x-4">
          <select
            value={selectedManager || ''}
            onChange={(e) => setSelectedManager(e.target.value || null)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Managers</option>
            {sortedManagers.map(manager => (
              <option key={manager.managerId} value={manager.managerId}>
                {manager.managerName}
              </option>
            ))}
          </select>
          <select
            value={selectedRound || ''}
            onChange={(e) => setSelectedRound(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Rounds</option>
            {Array.from({length: 15}, (_, i) => i + 1).map(round => (
              <option key={round} value={round}>Round {round}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {analytics.pickAnalyses
          .filter(pick => !selectedManager || pick.pick.picked_by === selectedManager)
          .filter(pick => !selectedRound || pick.round === selectedRound)
          .map((pickAnalysis, index) => (
            <div key={index} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm">
                    {pickAnalysis.pickNumber}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-lg">
                      {pickAnalysis.pickedPlayer.player_info.name}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPositionColor(pickAnalysis.pickedPlayer.player_info.position)}`}>
                        {pickAnalysis.pickedPlayer.player_info.position}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {pickAnalysis.managerName} • Round {pickAnalysis.round}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`px-4 py-2 rounded-full text-lg font-bold border ${getGradeColor(pickAnalysis.grade)}`}>
                    {pickAnalysis.grade}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {getGradeLabel(pickAnalysis.grade)}
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <p className="text-gray-300 text-sm italic">{pickAnalysis.reasoning}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-sm font-medium text-gray-300 mb-2">Pick Details</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Projected Points:</span>
                      <span className="text-white">
                        {pickAnalysis.pickedPlayer.seasons?.[analytics.draftInfo.season || "2024"]?.season_projected_totals?.pts_half_ppr?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Pick Value:</span>
                      <span className="text-white">{Math.round(pickAnalysis.pickValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Opportunity Cost:</span>
                      <span className={pickAnalysis.opportunityCost > 10 ? "text-red-400" : "text-green-400"}>
                        {pickAnalysis.opportunityCost}
                      </span>
                    </div>
                  </div>
                </div>

                {pickAnalysis.betterOptions.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-300 mb-2">
                      Better Options Available ({pickAnalysis.betterOptions.length})
                    </h5>
                    <div className="space-y-1">
                      {pickAnalysis.betterOptions.slice(0, 3).map((option, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <span className={`px-1 py-0.5 rounded text-xs ${getPositionColor(option.player_info.position)}`}>
                              {option.player_info.position}
                            </span>
                            <span className="text-white">{option.player_info.name}</span>
                          </div>
                          <span className="text-gray-400">
                            {option.seasons?.[analytics.draftInfo.season || "2024"]?.season_projected_totals?.pts_half_ppr?.toFixed(1) || 'N/A'} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  const renderPositionAnalysis = () => (
    <div className="space-y-6">
      <h4 className="text-xl font-bold text-white">Position Analysis</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(analytics.positionAnalysis).map(([position, data]) => (
          <div key={position} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${getPositionColor(position)}`}>
                {position}
              </div>
              <div className={`text-2xl font-bold ${getGradeColor(data.averageGrade).split(' ')[0]}`}>
                {Math.round(data.averageGrade)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Picks:</span>
                <span className="text-white font-medium">{data.totalPicks}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Average Round:</span>
                <span className="text-white font-medium">{data.averageRound.toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Grade Range:</span>
                <span className="text-white font-medium">
                  {Math.round(data.worstPick?.grade || 0)} - {Math.round(data.bestPick?.grade || 0)}
                </span>
              </div>
            </div>

            {data.bestPick && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Best Pick:</div>
                <div className="text-sm text-white font-medium">
                  {data.bestPick.pickedPlayer.player_info.name}
                </div>
                <div className="text-xs text-gray-400">
                  Pick #{data.bestPick.pickNumber} • Grade {data.bestPick.grade}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderRoundAnalysis = () => (
    <div className="space-y-6">
      <h4 className="text-xl font-bold text-white">Round-by-Round Analysis</h4>
      
      <div className="space-y-4">
        {Object.entries(analytics.roundAnalysis)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([round, data]) => (
            <div key={round} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                    {round}
                  </div>
                  <div>
                    <h5 className="text-lg font-semibold text-white">Round {round}</h5>
                    <p className="text-gray-400 text-sm">{data.totalPicks} picks</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-full text-lg font-bold border ${getGradeColor(data.averageGrade)}`}>
                  {Math.round(data.averageGrade)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h6 className="text-sm font-medium text-gray-300 mb-3">Position Breakdown</h6>
                  <div className="space-y-2">
                    {Object.entries(data.positionBreakdown)
                      .sort(([,a], [,b]) => b - a)
                      .map(([position, count]) => (
                        <div key={position} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPositionColor(position)}`}>
                              {position}
                            </span>
                          </div>
                          <span className="text-white font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h6 className="text-sm font-medium text-gray-300 mb-3">Round Highlights</h6>
                  <div className="space-y-3">
                    {data.bestPick && (
                      <div>
                        <div className="text-xs text-green-400 mb-1">Best Pick:</div>
                        <div className="text-sm text-white font-medium">
                          {data.bestPick.pickedPlayer.player_info.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {data.bestPick.managerName} • Grade {data.bestPick.grade}
                        </div>
                      </div>
                    )}
                    {data.worstPick && (
                      <div>
                        <div className="text-xs text-red-400 mb-1">Worst Pick:</div>
                        <div className="text-sm text-white font-medium">
                          {data.worstPick.pickedPlayer.player_info.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {data.worstPick.managerName} • Grade {data.worstPick.grade}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  const renderTabs = () => (
    <div className="flex space-x-1 bg-gray-700 p-1 rounded-lg">
      {[
        { id: "overview", label: "Overview" },
        { id: "picks", label: "Pick Analysis" },
        { id: "positions", label: "Positions" },
        { id: "rounds", label: "Rounds" }
      ].map(tab => (
        <button
          key={tab.id}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === tab.id
              ? "bg-blue-600 text-white shadow-lg"
              : "text-gray-300 hover:text-white hover:bg-gray-600"
          }`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return renderOverview();
      case "picks":
        return renderPickAnalysis();
      case "positions":
        return renderPositionAnalysis();
      case "rounds":
        return renderRoundAnalysis();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <svg className="w-7 h-7 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Draft Analysis Results
          </h2>
        </div>
        {renderTabs()}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderContent()}
      </div>
    </div>
  );
}