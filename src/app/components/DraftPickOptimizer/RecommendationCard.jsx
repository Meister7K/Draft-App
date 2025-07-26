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
  onPlayerSelect 
}) {
  const [showFactorDetails, setShowFactorDetails] = useState(false);

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
    <div className={`card ${actionStyling.bgColor} ${actionStyling.borderColor} border-2 transition-all duration-200 hover:shadow-lg`}>
      {/* Header with rank and action */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="bg-[var(--primary)] text-white font-bold text-lg rounded-full w-8 h-8 flex items-center justify-center">
            {rank}
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${actionStyling.bgColor} ${actionStyling.textColor}`}>
            {actionStyling.actionText}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[var(--foreground)]">
            {formatFactorScore(score)}
          </div>
          <div className="text-xs opacity-60">Score</div>
        </div>
      </div>

      {/* Player Information */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <a
              href={`/player/${playerInfo.player_id}`}
              className="text-lg font-semibold text-[var(--foreground)] hover:underline cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              {playerInfo.name}
            </a>
            <div className="text-sm opacity-80">
              {playerInfo.position} - {playerInfo.team}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">
              #{playerInfo.overall_rank || 'N/A'} Overall
            </div>
            <div className="text-sm opacity-80">
              #{playerInfo.position_rank || 'N/A'} {playerInfo.position}
            </div>
          </div>
        </div>

        {/* Projected Points */}
        <div className="flex items-center justify-between text-sm">
          <span className="opacity-80">Projected 2025 Points:</span>
          <span className="font-semibold">
            {playerInfo.projected_2025_points?.toFixed(1) || 'N/A'}
          </span>
        </div>
      </div>

      {/* Recommendation Reasoning */}
      <div className="mb-4 p-3 bg-[var(--secondary)]/30 rounded-lg">
        <div className="text-sm font-medium mb-1">Recommendation:</div>
        <div className="text-sm opacity-90 mb-2">{reasoning}</div>
        {riskAssessment && (
          <div className="text-xs opacity-75">
            <span className="font-medium">Risk: </span>
            {riskAssessment}
          </div>
        )}
      </div>

      {/* Confidence and Urgency Indicators */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="text-sm">
            <span className="opacity-80">Confidence: </span>
            <span className={`font-semibold ${confidenceStyling.color}`}>
              {confidenceStyling.label} ({confidence}%)
            </span>
          </div>
          <div className="text-sm">
            <span className="opacity-80">Urgency: </span>
            <span className={`font-semibold ${urgency.color}`}>
              {urgency.level}
            </span>
          </div>
        </div>
      </div>

      {/* Factor Breakdown Summary */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="opacity-80">Roster Need:</span>
            <span className={`font-semibold ${getFactorColor(factors.rosterNeed.score)}`}>
              {formatFactorScore(factors.rosterNeed.score)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-80">Player Value:</span>
            <span className={`font-semibold ${getFactorColor(factors.playerValue.score)}`}>
              {formatFactorScore(factors.playerValue.score)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-80">Competition:</span>
            <span className={`font-semibold ${getFactorColor(factors.competition.score)}`}>
              {formatFactorScore(factors.competition.score)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-80">Availability:</span>
            <span className={`font-semibold ${getFactorColor(factors.availability.score)}`}>
              {formatFactorScore(factors.availability.score)}
            </span>
          </div>
        </div>
      </div>

      {/* Toggle Factor Details Button */}
      <button
        onClick={() => setShowFactorDetails(!showFactorDetails)}
        className="w-full py-2 px-3 text-sm bg-[var(--secondary)]/50 hover:bg-[var(--secondary)]/70 rounded-lg transition-colors border border-[var(--border)]"
      >
        {showFactorDetails ? "Hide Details" : "Show Factor Details"}
      </button>

      {/* Detailed Factor Breakdown */}
      {showFactorDetails && (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          {Object.entries(factors).map(([factorKey, factorData]) => {
            const factorName = factorKey
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            return (
              <div key={factorKey} className="bg-[var(--secondary)]/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{factorName}</span>
                  <span className={`font-bold ${getFactorColor(factorData.score)}`}>
                    {formatFactorScore(factorData.score)}/100
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-[var(--border)] rounded-full h-2 mb-2">
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

      {/* Action Button */}
      {onPlayerSelect && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <button
            onClick={() => onPlayerSelect(player)}
            className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
              action === "PICK_NOW" 
                ? "bg-green-500 hover:bg-green-600 text-white"
                : action === "WAIT"
                ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
          >
            {action === "PICK_NOW" ? "Select This Player" : 
             action === "WAIT" ? "Add to Watch List" : 
             "Consider This Player"}
          </button>
        </div>
      )}
    </div>
  );
}

export default RecommendationCard;