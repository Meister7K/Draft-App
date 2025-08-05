"use client";

import { useState } from "react";

export function ActualDraftBoard({ analytics, draftPicks, selectedDraft, leagueUsers, availablePlayers: allPlayers }) {
  const [selectedPick, setSelectedPick] = useState(null);
  const [filterPosition, setFilterPosition] = useState('ALL');
  const [filterManager, setFilterManager] = useState('ALL');
  const [showFutureProjections, setShowFutureProjections] = useState(true);

  if (!analytics?.pickAnalyses || !draftPicks) {
    return (
      <div className="p-6 bg-gray-900 min-h-screen text-white">
        <div className="text-center py-12">
          <p className="text-gray-400">No draft data available</p>
        </div>
      </div>
    );
  }

  const getPositionColor = (position) => {
    const colors = {
      QB: 'border-l-purple-400',
      RB: 'border-l-green-400',
      WR: 'border-l-blue-400',
      TE: 'border-l-orange-400',
      K: 'border-l-gray-400',
      DEF: 'border-l-red-400'
    };
    return colors[position] || 'border-l-gray-400';
  };

  const getGradeColor = (grade) => {
    if (grade >= 85) return 'bg-green-500';
    if (grade >= 70) return 'bg-blue-500';
    if (grade >= 55) return 'bg-yellow-500';
    if (grade >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getGradeLabel = (grade) => {
    if (grade >= 85) return 'Excellent';
    if (grade >= 70) return 'Good';
    if (grade >= 55) return 'Average';
    if (grade >= 40) return 'Poor';
    return 'Terrible';
  };

  // Calculate draft state and future projections
  const isDraftComplete = selectedDraft?.status === 'complete';
  const totalTeams = selectedDraft?.settings?.teams || leagueUsers?.length || 12;
  const totalRounds = selectedDraft?.settings?.rounds || 15;
  const totalPossiblePicks = totalTeams * totalRounds;
  const currentPickCount = analytics.pickAnalyses.length;
  const nextPickNumber = currentPickCount + 1;
  const remainingPicks = totalPossiblePicks - currentPickCount;

  // Get current available players (not yet drafted)
  const draftedPlayerIds = new Set(analytics.pickAnalyses.map(p => p.pickedPlayer.player_info.player_id));
  const availablePlayers = (allPlayers || []).filter(player => 
    !draftedPlayerIds.has(player.player_info.player_id)
  );

  // Calculate next pick manager and their roster needs
  const getNextPickManager = () => {
    if (isDraftComplete || nextPickNumber > totalPossiblePicks) return null;
    
    const round = Math.ceil(nextPickNumber / totalTeams);
    const pickInRound = ((nextPickNumber - 1) % totalTeams) + 1;
    
    // Snake draft logic
    let managerIndex;
    if (round % 2 === 1) {
      // Odd rounds: normal order (1, 2, 3, ...)
      managerIndex = pickInRound - 1;
    } else {
      // Even rounds: reverse order (..., 3, 2, 1)
      managerIndex = totalTeams - pickInRound;
    }
    
    return leagueUsers?.[managerIndex] || null;
  };

  // Calculate roster needs for a manager based on actual league settings
  const calculateRosterNeeds = (managerId) => {
    const managerPicks = analytics.pickAnalyses.filter(p => p.pick.picked_by === managerId);
    const positionCounts = {};
    
    managerPicks.forEach(pick => {
      const position = pick.pickedPlayer.player_info.position;
      positionCounts[position] = (positionCounts[position] || 0) + 1;
    });
    
    // Get actual roster requirements from league settings
    const settings = selectedDraft?.settings || {};
    const rosterRequirements = {
      QB: settings.slots_qb || 1,
      RB: settings.slots_rb || 2,
      WR: settings.slots_wr || 2,
      TE: settings.slots_te || 1,
      K: settings.slots_k || 0,
      DEF: (settings.slots_def || 0) + (settings.slots_dst || 0),
      FLEX: settings.slots_flex || 0,
      SUPER_FLEX: settings.slots_super_flex || settings.slots_sf || 0,
      BENCH: settings.slots_bn || 6
    };
    
    // Calculate ideal roster composition including flex considerations
    const idealComposition = {
      QB: rosterRequirements.QB + Math.floor(rosterRequirements.SUPER_FLEX * 0.2), // Some superflex for QB
      RB: rosterRequirements.RB + Math.floor(rosterRequirements.FLEX * 0.4) + Math.floor(rosterRequirements.BENCH * 0.3),
      WR: rosterRequirements.WR + Math.floor(rosterRequirements.FLEX * 0.4) + Math.floor(rosterRequirements.BENCH * 0.3),
      TE: rosterRequirements.TE + Math.floor(rosterRequirements.FLEX * 0.2) + Math.floor(rosterRequirements.BENCH * 0.1),
      K: rosterRequirements.K,
      DEF: rosterRequirements.DEF
    };
    
    // Calculate needs based on ideal composition
    const needs = {};
    Object.keys(idealComposition).forEach(position => {
      if (idealComposition[position] > 0) {
        needs[position] = Math.max(0, idealComposition[position] - (positionCounts[position] || 0));
      }
    });
    
    return { 
      positionCounts, 
      needs, 
      rosterRequirements, 
      idealComposition 
    };
  };

  // Calculate player value with roster context
  const calculatePlayerValueWithContext = (player, managerId, pickNumber) => {
    const { needs } = calculateRosterNeeds(managerId);
    const position = player.player_info.position;
    const projectedPoints = player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
    const adp = player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.adp_2qb || 999;
    
    let value = 0;
    
    // Base value from projected points (0-40)
    value += Math.min(40, (projectedPoints / 400) * 40);
    
    // Position need multiplier (1.0 - 2.5)
    const needMultiplier = needs[position] > 0 ? 1 + (needs[position] * 0.3) : 1.0;
    value *= needMultiplier;
    
    // ADP value (±20)
    const adpValue = Math.max(-20, Math.min(20, (adp - pickNumber) * 0.4));
    value += adpValue;
    
    // Position scarcity bonus (0-15)
    const positionPlayers = availablePlayers.filter(p => p.player_info.position === position);
    const scarcityBonus = positionPlayers.length < 5 ? (5 - positionPlayers.length) * 3 : 0;
    value += scarcityBonus;
    
    return {
      totalValue: Math.max(0, value),
      baseValue: Math.min(40, (projectedPoints / 400) * 40),
      needMultiplier,
      adpValue,
      scarcityBonus,
      projectedPoints,
      adp
    };
  };

  // Get top 3 players for next pick
  const getNextPickRecommendations = () => {
    const nextManager = getNextPickManager();
    if (!nextManager || availablePlayers.length === 0) return [];
    
    const scoredPlayers = availablePlayers.map(player => ({
      player,
      analysis: calculatePlayerValueWithContext(player, nextManager.user_id, nextPickNumber)
    }));
    
    return scoredPlayers
      .sort((a, b) => b.analysis.totalValue - a.analysis.totalValue)
      .slice(0, 3);
  };

  // Filter picks based on selected filters
  const filteredPicks = analytics.pickAnalyses.filter(pickAnalysis => {
    if (filterPosition !== 'ALL' && pickAnalysis.pickedPlayer.player_info.position !== filterPosition) {
      return false;
    }
    if (filterManager !== 'ALL' && pickAnalysis.pick.picked_by !== filterManager) {
      return false;
    }
    return true;
  });

  const renderPick = (pickAnalysis) => {
    const isSelected = selectedPick === pickAnalysis.pickNumber;
    const position = pickAnalysis.pickedPlayer.player_info.position;
    const projectedPoints = pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
    const adp = pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.adp_2qb;

    return (
      <div
        key={pickAnalysis.pickNumber}
        className={`bg-gray-800 rounded-lg shadow-md p-4 mb-4 cursor-pointer transition-all duration-300 ease-in-out border-l-4 ${getPositionColor(position)} ${isSelected ? 'ring-2 ring-blue-500 transform scale-105' : 'hover:shadow-lg hover:bg-gray-750'}`}
        onClick={() => setSelectedPick(isSelected ? null : pickAnalysis.pickNumber)}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 font-semibold">#{pickAnalysis.pickNumber}</span>
            <span className="text-white font-medium">{pickAnalysis.managerName}</span>
          </div>
          <div className={`text-white text-sm font-bold px-3 py-1 rounded-full ${getGradeColor(pickAnalysis.grade)}`}>
            {pickAnalysis.grade}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <div className="text-lg font-bold text-white">{pickAnalysis.pickedPlayer.player_info.name}</div>
            {pickAnalysis.optimalPick && pickAnalysis.optimalPick.player.player_info.player_id !== pickAnalysis.pickedPlayer.player_info.player_id && (
              <div className="text-xs text-yellow-400 flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                vs Optimal
              </div>
            )}
          </div>
          <div className="flex items-center text-sm text-gray-300 space-x-4">
            <span className="font-semibold text-gray-200">{position}</span>
            <span>{projectedPoints.toFixed(1)} pts</span>
            {adp && <span>ADP: {adp.toFixed(1)}</span>}
            <span className="text-xs text-gray-400">Round {pickAnalysis.round}</span>
          </div>
          
          {/* Quick optimal comparison with value/points difference */}
          {pickAnalysis.optimalPick && pickAnalysis.optimalPick.player.player_info.player_id !== pickAnalysis.pickedPlayer.player_info.player_id && (
            <div className="mt-2 p-2 bg-gray-700 rounded text-xs border border-gray-600">
              <div className="flex items-center justify-between mb-1">
                <div className="text-gray-400">
                  Optimal: <span className="text-white font-medium">{pickAnalysis.optimalPick.player.player_info.name}</span> ({pickAnalysis.optimalPick.player.player_info.position})
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  {(() => {
                    const actualPoints = pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
                    const optimalPoints = pickAnalysis.optimalPick.player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
                    const pointsDiff = optimalPoints - actualPoints;
                    const valueDiff = (pickAnalysis.optimalPick.score || 0) - pickAnalysis.pickValue;
                    
                    return (
                      <>
                        <span className={`font-medium ${pointsDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {pointsDiff > 0 ? '-' : '+'}{Math.abs(pointsDiff).toFixed(1)} pts
                        </span>
                        <span className={`font-medium ${valueDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {valueDiff > 0 ? '-' : '+'}{Math.abs(valueDiff).toFixed(0)} value
                        </span>
                      </>
                    );
                  })()}
                </div>
                <span className="text-gray-500">vs optimal</span>
              </div>
            </div>
          )}

          {isSelected && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-sm italic text-gray-300 mb-3">{pickAnalysis.reasoning}</div>
              
              {/* Actual vs Optimal Comparison */}
              {pickAnalysis.optimalPick && pickAnalysis.optimalPick.player.player_info.player_id !== pickAnalysis.pickedPlayer.player_info.player_id && (
                <div className="mb-4 p-3 bg-gray-700 rounded-lg border border-gray-600">
                  <h5 className="font-medium text-gray-300 mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-1 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Optimal Pick Comparison
                  </h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-red-900/30 p-3 rounded border border-red-700">
                      <div className="text-red-300 font-medium mb-1">Actual Pick</div>
                      <div className="text-white font-semibold">{pickAnalysis.pickedPlayer.player_info.name}</div>
                      <div className="text-gray-400 text-xs mb-2">{pickAnalysis.pickedPlayer.player_info.position} • {pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr?.toFixed(1) || 'N/A'} pts</div>
                      <div className="text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Pick Value:</span>
                          <span className="text-white font-medium">{Math.round(pickAnalysis.pickValue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Grade:</span>
                          <span className="text-white font-medium">{pickAnalysis.grade}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-900/30 p-3 rounded border border-green-700">
                      <div className="text-green-300 font-medium mb-1">Optimal Pick</div>
                      <div className="text-white font-semibold">{pickAnalysis.optimalPick.player.player_info.name}</div>
                      <div className="text-gray-400 text-xs mb-2">{pickAnalysis.optimalPick.player.player_info.position} • {pickAnalysis.optimalPick.player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr?.toFixed(1) || 'N/A'} pts</div>
                      <div className="text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Pick Value:</span>
                          <span className="text-white font-medium">{Math.round(pickAnalysis.optimalPick.score || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Potential Grade:</span>
                          <span className="text-green-300 font-medium">~{Math.min(100, Math.round((pickAnalysis.optimalPick.score || 0) * 1.2))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Difference Summary */}
                  <div className="mt-3 p-2 bg-gray-800 rounded border border-gray-600">
                    <div className="text-xs font-medium text-gray-300 mb-2">Impact Analysis</div>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      {(() => {
                        const actualPoints = pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
                        const optimalPoints = pickAnalysis.optimalPick.player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
                        const pointsDiff = optimalPoints - actualPoints;
                        const valueDiff = (pickAnalysis.optimalPick.score || 0) - pickAnalysis.pickValue;
                        const gradeDiff = Math.min(100, Math.round((pickAnalysis.optimalPick.score || 0) * 1.2)) - pickAnalysis.grade;
                        
                        return (
                          <>
                            <div className="text-center">
                              <div className={`font-bold ${pointsDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {pointsDiff > 0 ? '-' : '+'}{Math.abs(pointsDiff).toFixed(1)}
                              </div>
                              <div className="text-gray-400">Points</div>
                            </div>
                            <div className="text-center">
                              <div className={`font-bold ${valueDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {valueDiff > 0 ? '-' : '+'}{Math.abs(valueDiff).toFixed(0)}
                              </div>
                              <div className="text-gray-400">Value</div>
                            </div>
                            <div className="text-center">
                              <div className={`font-bold ${gradeDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {gradeDiff > 0 ? '-' : '+'}{Math.abs(gradeDiff)}
                              </div>
                              <div className="text-gray-400">Grade</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-400 italic">
                    {pickAnalysis.optimalPick.reasoning}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <h5 className="font-medium text-gray-300 mb-2">Pick Details</h5>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Pick Value:</span>
                      <span className="text-white font-semibold">{Math.round(pickAnalysis.pickValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Opportunity Cost:</span>
                      <span className={pickAnalysis.opportunityCost > 10 ? "text-red-400" : "text-green-400"}>
                        {pickAnalysis.opportunityCost}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Grade:</span>
                      <span className="text-white font-semibold">{pickAnalysis.grade}/100 ({getGradeLabel(pickAnalysis.grade)})</span>
                    </div>
                  </div>
                </div>

                {pickAnalysis.betterOptions.length > 0 && (
                  <div>
                    <h5 className="font-medium text-gray-300 mb-2">Better Options Available</h5>
                    <div className="space-y-1">
                      {pickAnalysis.betterOptions.slice(0, 3).map((option, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-1">
                            <span className={`px-1 py-0.5 rounded text-xs ${getPositionColor(option.player_info.position).replace('border-l', 'bg').replace('400', '600')} text-white`}>
                              {option.player_info.position}
                            </span>
                            <span className="text-gray-300">{option.player_info.name}</span>
                          </div>
                          <span className="text-gray-400">
                            {option.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr?.toFixed(1) || 'N/A'} pts
                          </span>
                        </div>
                      ))}
                      {pickAnalysis.betterOptions.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{pickAnalysis.betterOptions.length - 3} more options
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRound = (roundNumber) => {
    const roundPicks = filteredPicks.filter(pickAnalysis => pickAnalysis.round === roundNumber);

    if (roundPicks.length === 0) return null;

    // Calculate round stats
    const roundGrades = roundPicks.map(p => p.grade);
    const avgGrade = roundGrades.reduce((sum, grade) => sum + grade, 0) / roundGrades.length;
    const bestPick = roundPicks.reduce((best, pick) => pick.grade > best.grade ? pick : best);
    const worstPick = roundPicks.reduce((worst, pick) => pick.grade < worst.grade ? pick : worst);

    return (
      <div key={roundNumber} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-white">Round {roundNumber}</h3>
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <span>Avg Grade: <span className="text-white font-semibold">{Math.round(avgGrade)}</span></span>
            <span>Best: <span className="text-green-400 font-semibold">{bestPick.grade}</span></span>
            <span>Worst: <span className="text-red-400 font-semibold">{worstPick.grade}</span></span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roundPicks
            .sort((a, b) => a.pickNumber - b.pickNumber)
            .map(pickAnalysis => renderPick(pickAnalysis))}
        </div>
      </div>
    );
  };

  // Render next pick recommendations
  const renderNextPickRecommendations = () => {
    if (isDraftComplete) return null;
    
    const nextManager = getNextPickManager();
    const recommendations = getNextPickRecommendations();
    
    if (!nextManager || recommendations.length === 0) return null;
    
    const { needs } = calculateRosterNeeds(nextManager.user_id);
    
    return (
      <div className="mb-8 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-6 border border-blue-500/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white flex items-center">
              <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Next Pick #{nextPickNumber}
            </h3>
            <p className="text-blue-300">
              {nextManager.display_name} • Round {Math.ceil(nextPickNumber / totalTeams)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Remaining Picks</div>
            <div className="text-xl font-bold text-blue-400">{remainingPicks}</div>
          </div>
        </div>

        {/* League Roster Format */}
        <div className="mb-3 p-3 bg-gray-800/50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-2">League Roster Format</h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {(() => {
              const { rosterRequirements } = calculateRosterNeeds(nextManager.user_id);
              return Object.entries(rosterRequirements)
                .filter(([, count]) => count > 0)
                .map(([position, count]) => (
                  <span key={position} className="px-2 py-1 bg-blue-900/50 text-blue-300 border border-blue-700 rounded">
                    {count} {position}
                  </span>
                ));
            })()}
          </div>
        </div>

        {/* Manager Roster Needs */}
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-2">
            {nextManager.display_name}'s Remaining Needs
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(needs)
              .filter(([position]) => {
                const { rosterRequirements } = calculateRosterNeeds(nextManager.user_id);
                return rosterRequirements[position] > 0; // Only show positions used in this league
              })
              .map(([position, need]) => (
                <span
                  key={position}
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    need > 0 
                      ? 'bg-red-900/50 text-red-300 border border-red-700' 
                      : 'bg-green-900/50 text-green-300 border border-green-700'
                  }`}
                >
                  {position}: {need > 0 ? `Need ${need}` : 'Filled'}
                </span>
              ))}
          </div>
        </div>

        {/* Top 3 Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {recommendations.map((rec, index) => {
            const { player, analysis } = rec;
            const position = player.player_info.position;
            const isHighNeed = needs[position] > 0;
            
            return (
              <div
                key={player.player_info.player_id}
                className={`bg-gray-800 rounded-lg p-4 border-l-4 ${getPositionColor(position)} ${
                  index === 0 ? 'ring-2 ring-blue-500' : ''
                } hover:bg-gray-750 transition-colors`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-yellow-500 text-black' : 
                      index === 1 ? 'bg-gray-400 text-black' : 
                      'bg-amber-600 text-white'
                    }`}>
                      #{index + 1}
                    </span>
                    {isHighNeed && (
                      <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full font-medium">
                        HIGH NEED
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">
                      {Math.round(analysis.totalValue)}
                    </div>
                    <div className="text-xs text-gray-400">Value</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-lg font-bold text-white">{player.player_info.name}</div>
                  <div className="flex items-center space-x-3 text-sm text-gray-300">
                    <span className={`px-2 py-1 rounded ${getPositionColor(position).replace('border-l', 'bg')} text-white`}>
                      {position}
                    </span>
                    <span>{analysis.projectedPoints.toFixed(1)} pts</span>
                    <span>ADP: {analysis.adp.toFixed(1)}</span>
                  </div>
                </div>

                {/* Detailed Analysis */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Base Value:</span>
                    <span className="text-white font-medium">{Math.round(analysis.baseValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Need Multiplier:</span>
                    <span className={`font-medium ${isHighNeed ? 'text-red-400' : 'text-gray-300'}`}>
                      {analysis.needMultiplier.toFixed(1)}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">ADP Value:</span>
                    <span className={`font-medium ${analysis.adpValue > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {analysis.adpValue > 0 ? '+' : ''}{Math.round(analysis.adpValue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Scarcity Bonus:</span>
                    <span className="text-blue-400 font-medium">+{Math.round(analysis.scarcityBonus)}</span>
                  </div>
                </div>

                {/* Roster Impact */}
                <div className="mt-3 p-2 bg-gray-700 rounded text-xs">
                  <div className="text-gray-400 mb-1">Roster Impact:</div>
                  <div className="text-gray-300">
                    {(() => {
                      const { rosterRequirements, idealComposition } = calculateRosterNeeds(nextManager.user_id);
                      const currentCount = calculateRosterNeeds(nextManager.user_id).positionCounts[position] || 0;
                      const required = rosterRequirements[position] || 0;
                      const ideal = idealComposition[position] || 0;
                      
                      if (required === 0) {
                        return `${position} not used in this league format`;
                      } else if (currentCount < required) {
                        return `Fills required ${position} slot (${currentCount + 1}/${required} starters)`;
                      } else if (currentCount < ideal) {
                        return `Adds ${position} depth/flex value (${currentCount + 1}/${ideal} total)`;
                      } else {
                        return `${position} roster full - luxury pick`;
                      }
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render future rounds projection
  const renderFutureRounds = () => {
    if (isDraftComplete || !showFutureProjections) return null;
    
    const currentRound = Math.ceil(nextPickNumber / totalTeams);
    const remainingRounds = totalRounds - currentRound + 1;
    
    if (remainingRounds <= 0) return null;
    
    return (
      <div className="mb-8 bg-gray-800/50 rounded-xl p-6 border border-gray-600">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center">
            <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Future Rounds Projection
          </h3>
          <button
            onClick={() => setShowFutureProjections(!showFutureProjections)}
            className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
          >
            {showFutureProjections ? 'Hide' : 'Show'} Projections
          </button>
        </div>
        
        <div className="text-center py-8 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium">Rounds {currentRound}-{totalRounds} Pending</p>
          <p className="text-sm mt-1">{remainingPicks} picks remaining in draft</p>
          <div className="mt-4 text-xs">
            <p>Future round projections will be available as the draft progresses</p>
            <p className="mt-1 text-gray-500">Optimal picks will be calculated based on remaining available players</p>
          </div>
        </div>
      </div>
    );
  };

  // Get unique positions and managers for filters
  const positions = [...new Set(analytics.pickAnalyses.map(p => p.pickedPlayer.player_info.position))].sort();
  const managers = leagueUsers?.map(user => ({ id: user.user_id, name: user.display_name })) || [];

  // Calculate overall stats
  const totalPicks = analytics.pickAnalyses.length;
  const avgGrade = Math.round(analytics.pickAnalyses.reduce((sum, pick) => sum + pick.grade, 0) / totalPicks);
  const excellentPicks = analytics.pickAnalyses.filter(p => p.grade >= 85).length;
  const poorPicks = analytics.pickAnalyses.filter(p => p.grade < 40).length;

  // Get all rounds
  const maxRound = Math.max(...analytics.pickAnalyses.map(p => p.round));
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  // Position stats
  const positionStats = {};
  analytics.pickAnalyses.forEach(pickAnalysis => {
    const position = pickAnalysis.pickedPlayer.player_info.position;
    if (!positionStats[position]) {
      positionStats[position] = { 
        count: 0, 
        totalGrade: 0, 
        totalPoints: 0,
        totalOpportunityCost: 0
      };
    }
    positionStats[position].count++;
    positionStats[position].totalGrade += pickAnalysis.grade;
    positionStats[position].totalPoints += pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
    positionStats[position].totalOpportunityCost += pickAnalysis.opportunityCost;
  });

  Object.keys(positionStats).forEach(position => {
    const stats = positionStats[position];
    stats.avgGrade = Math.round(stats.totalGrade / stats.count);
    stats.avgPoints = Math.round(stats.totalPoints / stats.count);
    stats.avgOpportunityCost = Math.round(stats.totalOpportunityCost / stats.count);
  });

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800 rounded-xl shadow-lg p-6 mb-8 border border-gray-700">
          <h2 className="text-3xl font-extrabold mb-4 text-center">Actual Draft Board</h2>
          
          {/* Filters */}
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-4 mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label htmlFor="position-filter" className="text-gray-300 font-medium">Position:</label>
                <select
                  id="position-filter"
                  value={filterPosition}
                  onChange={(e) => setFilterPosition(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Positions</option>
                  {positions.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <label htmlFor="manager-filter" className="text-gray-300 font-medium">Manager:</label>
                <select
                  id="manager-filter"
                  value={filterManager}
                  onChange={(e) => setFilterManager(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Managers</option>
                  {managers.map(manager => (
                    <option key={manager.id} value={manager.id}>{manager.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Overall Stats */}
            <div className="flex items-center space-x-6 text-sm text-gray-300">
              <span>Total Picks: <span className="font-bold text-white">{totalPicks}</span></span>
              <span>Avg Grade: <span className="font-bold text-white">{avgGrade}</span></span>
              <span>Excellent: <span className="font-bold text-green-400">{excellentPicks}</span></span>
              <span>Poor: <span className="font-bold text-red-400">{poorPicks}</span></span>
            </div>
          </div>
        </div>

        {/* Position Breakdown */}
        <div className="bg-gray-800 rounded-xl shadow-lg p-6 mb-8 border border-gray-700">
          <h4 className="text-xl font-bold mb-4 text-white">Position Breakdown</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Object.entries(positionStats).map(([position, stats]) => (
              <div key={position} className="bg-gray-700 rounded-lg p-4 shadow-sm border border-gray-600">
                <div className="flex items-center mb-2">
                  <div className={`w-3 h-3 rounded-full mr-2 ${getPositionColor(position).replace('border-l', 'bg')}`}></div>
                  <div className="text-lg font-semibold text-white">{position}</div>
                </div>
                <div className="space-y-1 text-sm text-gray-400">
                  <div className="flex justify-between">
                    <span>Count:</span>
                    <span className="font-semibold text-white">{stats.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Grade:</span>
                    <span className={`font-semibold ${getGradeColor(stats.avgGrade).replace('bg-', 'text-')}`}>
                      {stats.avgGrade}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Points:</span>
                    <span className="font-semibold text-white">{stats.avgPoints}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Opp Cost:</span>
                    <span className={`font-semibold ${stats.avgOpportunityCost > 10 ? 'text-red-400' : 'text-green-400'}`}>
                      {stats.avgOpportunityCost}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next Pick Recommendations */}
        {renderNextPickRecommendations()}

        {/* Draft Board Content */}
        <div className="draft-board-content">
          {rounds.map(roundNumber => renderRound(roundNumber))}
        </div>

        {/* Future Rounds Projection */}
        {renderFutureRounds()}

        {/* Selected Pick Modal */}
        {selectedPick && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-white">Pick Analysis</h3>
                <button 
                  onClick={() => setSelectedPick(null)} 
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {(() => {
                const pickAnalysis = analytics.pickAnalyses.find(p => p.pickNumber === selectedPick);
                if (!pickAnalysis) return null;
                
                return (
                  <div className="text-gray-300">
                    <div className="mb-4">
                      <div className="text-xl font-bold text-white mb-2">
                        {pickAnalysis.pickedPlayer.player_info.name}
                      </div>
                      <div className="flex items-center space-x-4 text-sm mb-3">
                        <span className={`px-2 py-1 rounded ${getPositionColor(pickAnalysis.pickedPlayer.player_info.position).replace('border-l', 'bg')} text-white`}>
                          {pickAnalysis.pickedPlayer.player_info.position}
                        </span>
                        <span>Pick #{pickAnalysis.pickNumber}</span>
                        <span>Round {pickAnalysis.round}</span>
                        <span className={`px-2 py-1 rounded font-bold ${getGradeColor(pickAnalysis.grade)} text-white`}>
                          Grade: {pickAnalysis.grade}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-gray-700 rounded-lg p-4 mb-4">
                      <p className="italic">{pickAnalysis.reasoning}</p>
                    </div>
                    
                    {/* Optimal Pick Comparison in Modal */}
                    {pickAnalysis.optimalPick && pickAnalysis.optimalPick.player.player_info.player_id !== pickAnalysis.pickedPlayer.player_info.player_id && (
                      <div className="mb-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
                        <h4 className="font-semibold text-white mb-3 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Actual vs Optimal Pick
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-red-900/30 p-3 rounded border border-red-700">
                            <div className="text-red-300 font-medium mb-2">What You Picked</div>
                            <div className="text-white font-bold text-lg">{pickAnalysis.pickedPlayer.player_info.name}</div>
                            <div className="text-gray-300 text-sm mb-1">{pickAnalysis.pickedPlayer.player_info.position}</div>
                            <div className="text-gray-400 text-sm">
                              {pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr?.toFixed(1) || 'N/A'} projected pts
                            </div>
                            <div className="mt-2 text-xs">
                              <span className={`px-2 py-1 rounded font-bold ${getGradeColor(pickAnalysis.grade)} text-white`}>
                                Grade: {pickAnalysis.grade}
                              </span>
                            </div>
                          </div>
                          <div className="bg-green-900/30 p-3 rounded border border-green-700">
                            <div className="text-green-300 font-medium mb-2">Optimal Pick</div>
                            <div className="text-white font-bold text-lg">{pickAnalysis.optimalPick.player.player_info.name}</div>
                            <div className="text-gray-300 text-sm mb-1">{pickAnalysis.optimalPick.player.player_info.position}</div>
                            <div className="text-gray-400 text-sm">
                              {pickAnalysis.optimalPick.player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr?.toFixed(1) || 'N/A'} projected pts
                            </div>
                            <div className="mt-2 text-xs text-green-300 italic">
                              {pickAnalysis.optimalPick.reasoning}
                            </div>
                          </div>
                        </div>
                        {/* Enhanced Difference Analysis */}
                        <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-600">
                          <div className="text-sm font-medium text-gray-300 mb-3">Missed Value Analysis</div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            {(() => {
                              const actualPoints = pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
                              const optimalPoints = pickAnalysis.optimalPick.player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
                              const pointsDiff = optimalPoints - actualPoints;
                              const valueDiff = (pickAnalysis.optimalPick.score || 0) - pickAnalysis.pickValue;
                              const gradeDiff = Math.min(100, Math.round((pickAnalysis.optimalPick.score || 0) * 1.2)) - pickAnalysis.grade;
                              
                              return (
                                <>
                                  <div className="text-center p-2 bg-gray-700 rounded">
                                    <div className={`text-lg font-bold ${pointsDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                      {pointsDiff > 0 ? '-' : '+'}{Math.abs(pointsDiff).toFixed(1)}
                                    </div>
                                    <div className="text-xs text-gray-400">Fantasy Points</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {pointsDiff > 0 ? 'Lost' : 'Gained'} vs optimal
                                    </div>
                                  </div>
                                  <div className="text-center p-2 bg-gray-700 rounded">
                                    <div className={`text-lg font-bold ${valueDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                      {valueDiff > 0 ? '-' : '+'}{Math.abs(valueDiff).toFixed(0)}
                                    </div>
                                    <div className="text-xs text-gray-400">Pick Value</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Draft efficiency
                                    </div>
                                  </div>
                                  <div className="text-center p-2 bg-gray-700 rounded">
                                    <div className={`text-lg font-bold ${gradeDiff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                      {gradeDiff > 0 ? '-' : '+'}{Math.abs(gradeDiff)}
                                    </div>
                                    <div className="text-xs text-gray-400">Grade Points</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Performance impact
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          
                          {/* Season Impact Projection */}
                          <div className="mt-3 p-2 bg-gray-900 rounded border border-gray-600">
                            <div className="text-xs text-gray-400 mb-1">Season Impact:</div>
                            {(() => {
                              const actualPoints = pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
                              const optimalPoints = pickAnalysis.optimalPick.player.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr || 0;
                              const pointsDiff = optimalPoints - actualPoints;
                              
                              if (Math.abs(pointsDiff) < 5) {
                                return <div className="text-xs text-gray-300">Minimal impact - similar production expected</div>;
                              } else if (pointsDiff > 20) {
                                return <div className="text-xs text-red-300">Significant missed opportunity - could impact playoff chances</div>;
                              } else if (pointsDiff > 10) {
                                return <div className="text-xs text-orange-300">Moderate missed value - noticeable difference over season</div>;
                              } else if (pointsDiff > 0) {
                                return <div className="text-xs text-yellow-300">Minor missed value - small but measurable difference</div>;
                              } else {
                                return <div className="text-xs text-green-300">Good pick - outperformed optimal projection</div>;
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-white mb-2">Pick Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Manager:</span>
                            <span className="text-white">{pickAnalysis.managerName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Pick Value:</span>
                            <span className="text-white">{Math.round(pickAnalysis.pickValue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Opportunity Cost:</span>
                            <span className={pickAnalysis.opportunityCost > 10 ? "text-red-400" : "text-green-400"}>
                              {pickAnalysis.opportunityCost}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Projected Points:</span>
                            <span className="text-white">
                              {pickAnalysis.pickedPlayer.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr?.toFixed(1) || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {pickAnalysis.betterOptions.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-white mb-2">
                            Better Options ({pickAnalysis.betterOptions.length})
                          </h4>
                          <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
                            {pickAnalysis.betterOptions.map((option, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                                <div className="flex items-center space-x-2">
                                  <span className={`px-1 py-0.5 rounded text-xs ${getPositionColor(option.player_info.position).replace('border-l', 'bg')} text-white`}>
                                    {option.player_info.position}
                                  </span>
                                  <span className="text-white text-xs">{option.player_info.name}</span>
                                </div>
                                <span className="text-gray-400 text-xs">
                                  {option.seasons?.[selectedDraft?.season || "2024"]?.season_projected_totals?.pts_half_ppr?.toFixed(1) || 'N/A'} pts
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}