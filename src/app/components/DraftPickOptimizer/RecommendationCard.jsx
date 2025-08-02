/**
 * RecommendationCard Component
 * Displays individual player recommendations with optimization scores and factor breakdowns
 */

"use client";

import { useState } from "react";

export function RecommendationCard({ 
  player, 
  optimization, 
  rank, 
  recommendation,
  onPlayerSelect,
  alternativeSuggestions = [],
  waitVsPickNowAdvisory = null,
  showAdvancedFeatures = true,
  isMobile = false
}) {
  const [showFactorDetails, setShowFactorDetails] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showWaitAdvisory, setShowWaitAdvisory] = useState(false);

  if (!player?.player_info || !optimization) {
    return null;
  }

  const playerInfo = player.player_info;
  const { score, factors } = optimization;
  const { action, reasoning, riskAssessment, confidence } = recommendation || {};

  // Get action styling
  const getActionStyling = (action) => {
    switch (action) {
      case "PICK_NOW":
        return {
          bgColor: "bg-green-500/20",
          borderColor: "border-green-500/40",
          textColor: "text-green-400",
          actionText: "PICK NOW"
        };
      case "WAIT":
        return {
          bgColor: "bg-yellow-500/20",
          borderColor: "border-yellow-500/40",
          textColor: "text-yellow-400",
          actionText: "WAIT"
        };
      default:
        return {
          bgColor: "bg-blue-500/20",
          borderColor: "border-blue-500/40",
          textColor: "text-blue-400",
          actionText: "CONSIDER"
        };
    }
  };

  const actionStyling = getActionStyling(action);

  // Get confidence indicator styling
  const getConfidenceStyling = (confidence) => {
    if (confidence >= 80) {
      return { color: "text-green-400", label: "High" };
    } else if (confidence >= 60) {
      return { color: "text-yellow-400", label: "Medium" };
    } else {
      return { color: "text-red-400", label: "Low" };
    }
  };

  const confidenceStyling = getConfidenceStyling(confidence);

  // Get urgency level based on optimization score
  const getUrgencyLevel = (score) => {
    if (score >= 80) return { level: "High", color: "text-red-400" };
    if (score >= 60) return { level: "Medium", color: "text-yellow-400" };
    return { level: "Low", color: "text-green-400" };
  };

  const urgency = getUrgencyLevel(score);

  // Format factor score for display
  const formatFactorScore = (factorScore) => {
    return Math.round(factorScore * 10) / 10;
  };

  // Get factor color based on score
  const getFactorColor = (score) => {
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    if (score >= 25) return "text-orange-400";
    return "text-red-400";
  };

  return (
    <div 
      className={`card ${actionStyling.bgColor} ${actionStyling.borderColor} border-2 transition-shadow duration-200 hover:shadow-lg ${isMobile ? 'touch-manipulation' : ''} p-3 sm:p-4`}
      role="article"
      aria-labelledby={`player-${playerInfo.player_id}-name`}
      aria-describedby={`player-${playerInfo.player_id}-recommendation`}
      tabIndex="0"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onPlayerSelect) {
            onPlayerSelect(player);
          }
        }
      }}
    >
      {/* Header with rank and action - Responsive */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div 
            className="bg-[var(--primary)] text-white font-bold text-base sm:text-lg rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center flex-shrink-0"
            aria-label={`Recommendation rank ${rank}`}
          >
            {rank}
          </div>
          <div 
            className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold ${actionStyling.bgColor} ${actionStyling.textColor}`}
            role="status"
            aria-label={`Recommendation action: ${actionStyling.actionText}`}
          >
            {actionStyling.actionText}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div 
            className="text-xl sm:text-2xl font-bold text-[var(--foreground)]"
            aria-label={`Optimization score: ${formatFactorScore(score)} out of 100`}
          >
            {formatFactorScore(score)}
          </div>
          <div className="text-xs opacity-60" aria-hidden="true">Score</div>
        </div>
      </div>

      {/* Player Information - Responsive */}
      <div className="mb-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <a
              id={`player-${playerInfo.player_id}-name`}
              href={`/player/${playerInfo.player_id}`}
              className="text-base sm:text-lg font-semibold text-[var(--foreground)] hover:underline cursor-pointer block truncate"
              onClick={(e) => e.stopPropagation()}
              aria-describedby={`player-${playerInfo.player_id}-details`}
            >
              {playerInfo.name}
            </a>
            <div 
              id={`player-${playerInfo.player_id}-details`}
              className="text-xs sm:text-sm opacity-80"
            >
              {playerInfo.position} - {playerInfo.team}
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <div className="text-xs sm:text-sm font-medium">
              #{playerInfo.overall_rank || 'N/A'} Overall
            </div>
            <div className="text-xs sm:text-sm opacity-80">
              #{playerInfo.position_rank || 'N/A'} {playerInfo.position}
            </div>
          </div>
        </div>

        {/* Projected Points */}
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="opacity-80">Projected 2025 Points:</span>
          <span className="font-semibold">
            {playerInfo.projected_2025_points?.toFixed(1) || 'N/A'}
          </span>
        </div>
      </div>

      {/* Recommendation Reasoning - Responsive */}
      <div 
        id={`player-${playerInfo.player_id}-recommendation`}
        className="mb-3 p-2 bg-[var(--secondary)]/30 rounded-lg"
        role="region"
        aria-labelledby={`player-${playerInfo.player_id}-rec-heading`}
      >
        <div 
          id={`player-${playerInfo.player_id}-rec-heading`}
          className="text-xs sm:text-sm font-medium mb-1"
        >
          Recommendation:
        </div>
        <div className="text-xs sm:text-sm opacity-90 mb-2">{reasoning}</div>
        {riskAssessment && (
          <div className="text-xs opacity-75">
            <span className="font-medium">Risk: </span>
            {riskAssessment}
          </div>
        )}
      </div>

      {/* Confidence and Urgency Indicators - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 space-y-1 sm:space-y-0">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4">
          <div className="text-xs sm:text-sm">
            <span className="opacity-80">Confidence: </span>
            <span className={`font-semibold ${confidenceStyling.color}`}>
              {confidenceStyling.label} ({confidence}%)
            </span>
          </div>
          <div className="text-xs sm:text-sm">
            <span className="opacity-80">Urgency: </span>
            <span className={`font-semibold ${urgency.color}`}>
              {urgency.level}
            </span>
          </div>
        </div>
      </div>

      {/* Factor Breakdown Summary - Responsive */}
      <div 
        className="mb-3"
        role="region"
        aria-labelledby={`player-${playerInfo.player_id}-factors-heading`}
      >
        <div 
          id={`player-${playerInfo.player_id}-factors-heading`}
          className="sr-only"
        >
          Optimization Factors Summary
        </div>
        <div 
          className={`grid ${isMobile ? 'grid-cols-1 gap-1' : 'grid-cols-2 gap-2'} text-xs sm:text-sm`}
          role="list"
          aria-label="Optimization factors"
        >
          <div className="flex justify-between" role="listitem">
            <span className="opacity-80">Roster Need:</span>
            <span 
              className={`font-semibold ${getFactorColor(factors.rosterNeed.score)}`}
              aria-label={`Roster need score: ${formatFactorScore(factors.rosterNeed.score)} out of 100`}
            >
              {formatFactorScore(factors.rosterNeed.score)}
            </span>
          </div>
          <div className="flex justify-between" role="listitem">
            <span className="opacity-80">Player Value:</span>
            <span 
              className={`font-semibold ${getFactorColor(factors.playerValue.score)}`}
              aria-label={`Player value score: ${formatFactorScore(factors.playerValue.score)} out of 100`}
            >
              {formatFactorScore(factors.playerValue.score)}
            </span>
          </div>
          <div className="flex justify-between" role="listitem">
            <span className="opacity-80">Competition:</span>
            <span 
              className={`font-semibold ${getFactorColor(factors.competition.score)}`}
              aria-label={`Competition score: ${formatFactorScore(factors.competition.score)} out of 100`}
            >
              {formatFactorScore(factors.competition.score)}
            </span>
          </div>
          <div className="flex justify-between" role="listitem">
            <span className="opacity-80">Availability:</span>
            <span 
              className={`font-semibold ${getFactorColor(factors.availability.score)}`}
              aria-label={`Availability score: ${formatFactorScore(factors.availability.score)} out of 100`}
            >
              {formatFactorScore(factors.availability.score)}
            </span>
          </div>
        </div>
      </div>

      {/* Advanced Features Buttons - Touch-friendly */}
      <div className="space-y-2" role="group" aria-label="Player details and options">
        <button
          onClick={() => setShowFactorDetails(!showFactorDetails)}
          className="w-full py-3 px-3 text-xs sm:text-sm bg-[var(--secondary)]/50 hover:bg-[var(--secondary)]/70 focus:bg-[var(--secondary)]/70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg transition-colors border border-[var(--border)] touch-target"
          aria-expanded={showFactorDetails}
          aria-controls={`player-${playerInfo.player_id}-factor-details`}
          aria-describedby={`player-${playerInfo.player_id}-factor-desc`}
        >
          {showFactorDetails ? "Hide Details" : "Show Factor Details"}
        </button>
        <div id={`player-${playerInfo.player_id}-factor-desc`} className="sr-only">
          Toggle detailed breakdown of optimization factors and scoring explanations
        </div>

        {showAdvancedFeatures && waitVsPickNowAdvisory && (
          <button
            onClick={() => setShowWaitAdvisory(!showWaitAdvisory)}
            className="w-full py-3 px-3 text-xs sm:text-sm bg-blue-500/20 hover:bg-blue-500/30 focus:bg-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg transition-colors border border-blue-500/40 touch-target"
            aria-expanded={showWaitAdvisory}
            aria-controls={`player-${playerInfo.player_id}-wait-advisory`}
            aria-describedby={`player-${playerInfo.player_id}-wait-desc`}
          >
            {showWaitAdvisory ? "Hide" : "Show"} Wait vs Pick Now Advisory
          </button>
        )}
        <div id={`player-${playerInfo.player_id}-wait-desc`} className="sr-only">
          Toggle advisory on whether to draft this player now or wait for future rounds
        </div>

        {showAdvancedFeatures && alternativeSuggestions.length > 0 && (
          <button
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="w-full py-3 px-3 text-xs sm:text-sm bg-green-500/20 hover:bg-green-500/30 focus:bg-green-500/30 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-lg transition-colors border border-green-500/40 touch-target"
            aria-expanded={showAlternatives}
            aria-controls={`player-${playerInfo.player_id}-alternatives`}
            aria-describedby={`player-${playerInfo.player_id}-alt-desc`}
          >
            {showAlternatives ? "Hide" : "Show"} Alternative Players ({alternativeSuggestions.length})
          </button>
        )}
        <div id={`player-${playerInfo.player_id}-alt-desc`} className="sr-only">
          Toggle list of similar alternative players to consider
        </div>
      </div>

      {/* Wait vs Pick Now Advisory - Mobile optimized */}
      {showWaitAdvisory && waitVsPickNowAdvisory && (
        <div 
          id={`player-${playerInfo.player_id}-wait-advisory`}
          className="mt-4 p-3 sm:p-4 bg-blue-500/10 rounded-lg border border-blue-500/30"
          role="region"
          aria-labelledby={`player-${playerInfo.player_id}-wait-heading`}
        >
          <h5 
            id={`player-${playerInfo.player_id}-wait-heading`}
            className="font-semibold text-blue-400 mb-3 flex items-center text-sm sm:text-base"
          >
            <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 flex-shrink-0" aria-hidden="true"></span>
            <span className={isMobile ? 'text-sm' : ''}>Wait vs Pick Now Advisory</span>
          </h5>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium">Recommendation:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                waitVsPickNowAdvisory.action === 'PICK_NOW' ? 'bg-red-500/20 text-red-400' :
                waitVsPickNowAdvisory.action === 'WAIT' ? 'bg-green-500/20 text-green-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {waitVsPickNowAdvisory.action.replace('_', ' ')}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-medium">Confidence:</span>
              <span className="text-xs sm:text-sm font-semibold">{waitVsPickNowAdvisory.confidence}%</span>
            </div>
            
            <div className="text-xs sm:text-sm opacity-90">
              <span className="font-medium">Reasoning: </span>
              {waitVsPickNowAdvisory.reasoning}
            </div>
            
            {waitVsPickNowAdvisory.waitingRisk && (
              <div className="text-xs opacity-80 bg-[var(--secondary)]/20 p-2 rounded">
                <span className="font-medium">Risk Assessment: </span>
                {waitVsPickNowAdvisory.waitingRisk.reasoning}
              </div>
            )}
            
            {waitVsPickNowAdvisory.nextBestAction && (
              <div className="text-xs opacity-80">
                <span className="font-medium">If not taken: </span>
                {waitVsPickNowAdvisory.nextBestAction.reasoning}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alternative Player Suggestions - Mobile optimized */}
      {showAlternatives && alternativeSuggestions.length > 0 && (
        <div 
          id={`player-${playerInfo.player_id}-alternatives`}
          className="mt-4 p-3 sm:p-4 bg-green-500/10 rounded-lg border border-green-500/30"
          role="region"
          aria-labelledby={`player-${playerInfo.player_id}-alt-heading`}
        >
          <h5 
            id={`player-${playerInfo.player_id}-alt-heading`}
            className="font-semibold text-green-400 mb-3 flex items-center text-sm sm:text-base"
          >
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2 flex-shrink-0" aria-hidden="true"></span>
            <span className={isMobile ? 'text-sm' : ''}>Alternative Players</span>
          </h5>
          
          <div className="space-y-3">
            {alternativeSuggestions.map((alternative, index) => (
              <div key={alternative.player.player_info.player_id} className="bg-[var(--secondary)]/20 p-2 sm:p-3 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs sm:text-sm truncate">
                      {alternative.player.player_info.name}
                    </div>
                    <div className="text-xs opacity-80">
                      {alternative.player.player_info.position} - {alternative.player.player_info.team}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-xs sm:text-sm font-semibold">
                      {alternative.optimization.score.toFixed(1)}
                    </div>
                    <div className="text-xs opacity-60">
                      {alternative.recommendation.scoreDifference > 0 ? '+' : ''}{alternative.recommendation.scoreDifference}
                    </div>
                  </div>
                </div>
                
                <div className="text-xs opacity-90 mb-2">
                  {alternative.comparison.summary}
                </div>
                
                <div className="text-xs opacity-80">
                  <span className="font-medium">Recommendation: </span>
                  {alternative.recommendation.recommendation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Factor Breakdown - Mobile optimized */}
      {showFactorDetails && (
        <div 
          id={`player-${playerInfo.player_id}-factor-details`}
          className="mt-4 space-y-3 border-t border-[var(--border)] pt-4"
          role="region"
          aria-labelledby={`player-${playerInfo.player_id}-factor-breakdown-heading`}
        >
          <h6 
            id={`player-${playerInfo.player_id}-factor-breakdown-heading`}
            className="sr-only"
          >
            Detailed Factor Breakdown
          </h6>
          {Object.entries(factors).map(([factorKey, factorData]) => {
            const factorName = factorKey
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            return (
              <div 
                key={factorKey} 
                className="bg-[var(--secondary)]/20 rounded-lg p-2 sm:p-3"
                role="region"
                aria-labelledby={`player-${playerInfo.player_id}-${factorKey}-heading`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span 
                    id={`player-${playerInfo.player_id}-${factorKey}-heading`}
                    className="font-medium text-xs sm:text-sm"
                  >
                    {factorName}
                  </span>
                  <span 
                    className={`font-bold text-xs sm:text-sm ${getFactorColor(factorData.score)}`}
                    aria-label={`${factorName} score: ${formatFactorScore(factorData.score)} out of 100`}
                  >
                    {formatFactorScore(factorData.score)}/100
                  </span>
                </div>
                
                {/* Progress bar */}
                <div 
                  className="w-full bg-[var(--border)] rounded-full h-2 mb-2"
                  role="progressbar"
                  aria-valuenow={factorData.score}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label={`${factorName} score progress`}
                >
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      factorData.score >= 75 ? 'bg-green-500' :
                      factorData.score >= 50 ? 'bg-yellow-500' :
                      factorData.score >= 25 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, factorData.score))}%` }}
                  />
                </div>
                
                <div className="text-xs opacity-80">
                  {factorData.explanation}
                </div>

                {/* Additional factor-specific data */}
                {factorData.weeklyImprovement && (
                  <div className="text-xs opacity-70 mt-1">
                    Weekly improvement: +{factorData.weeklyImprovement.toFixed(1)} pts
                  </div>
                )}
                {factorData.riskLevel && (
                  <div className="text-xs opacity-70 mt-1">
                    Risk level: {factorData.riskLevel}
                  </div>
                )}
                {factorData.estimatedPickRange && (
                  <div className="text-xs opacity-70 mt-1">
                    Expected draft range: {factorData.estimatedPickRange.earliest}-{factorData.estimatedPickRange.latest}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
}

export default RecommendationCard;