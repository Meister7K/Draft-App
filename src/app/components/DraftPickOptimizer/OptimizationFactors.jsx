/**
 * OptimizationFactors Component
 * Displays detailed breakdown of optimization factors with visual indicators
 */

"use client";

import { useState } from "react";

export function OptimizationFactors({ 
  factors, 
  previousFactors = null,
  showComparison = false 
}) {
  const [expandedFactor, setExpandedFactor] = useState(null);

  if (!factors) {
    return null;
  }

  // Format factor score for display
  const formatFactorScore = (score) => {
    return Math.round(score * 10) / 10;
  };

  // Get factor color based on score
  const getFactorColor = (score) => {
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    if (score >= 25) return "text-orange-400";
    return "text-red-400";
  };

  // Get factor background color for progress bar
  const getFactorBgColor = (score) => {
    if (score >= 75) return "bg-green-500";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  // Calculate change from previous factors
  const getFactorChange = (factorKey, currentScore) => {
    if (!previousFactors || !showComparison) return null;
    
    const previousScore = previousFactors[factorKey]?.score || 0;
    const change = currentScore - previousScore;
    
    if (Math.abs(change) < 0.1) return null;
    
    return {
      value: change,
      isIncrease: change > 0,
      isDecrease: change < 0
    };
  };

  // Get factor display name
  const getFactorDisplayName = (factorKey) => {
    const names = {
      rosterNeed: "Roster Need",
      playerValue: "Player Value", 
      competition: "Competition Level",
      availability: "Availability",
      startingLineupImpact: "Starting Lineup Impact"
    };
    return names[factorKey] || factorKey;
  };

  // Get factor description
  const getFactorDescription = (factorKey) => {
    const descriptions = {
      rosterNeed: "How much your roster needs this position",
      playerValue: "Overall player quality and projected value",
      competition: "How many other managers likely want this player",
      availability: "Likelihood of player being available in future rounds",
      startingLineupImpact: "Expected fantasy point improvement to starting lineup"
    };
    return descriptions[factorKey] || "";
  };

  // Toggle expanded factor
  const toggleFactorExpansion = (factorKey) => {
    setExpandedFactor(expandedFactor === factorKey ? null : factorKey);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-[var(--foreground)]">
          Optimization Factors
        </h4>
        {showComparison && previousFactors && (
          <div className="text-xs opacity-60">
            Changes from previous calculation
          </div>
        )}
      </div>

      {Object.entries(factors).map(([factorKey, factorData]) => {
        const displayName = getFactorDisplayName(factorKey);
        const description = getFactorDescription(factorKey);
        const score = factorData.score;
        const change = getFactorChange(factorKey, score);
        const isExpanded = expandedFactor === factorKey;

        return (
          <div 
            key={factorKey}
            className="bg-[var(--secondary)]/30 rounded-lg border border-[var(--border)] overflow-hidden"
          >
            {/* Factor Header */}
            <div 
              className="p-4 cursor-pointer hover:bg-[var(--secondary)]/50 transition-colors"
              onClick={() => toggleFactorExpansion(factorKey)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-[var(--foreground)]">
                    {displayName}
                  </span>
                  {change && (
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      change.isIncrease 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {change.isIncrease ? '+' : ''}{formatFactorScore(change.value)}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`font-bold text-lg ${getFactorColor(score)}`}>
                    {formatFactorScore(score)}
                  </span>
                  <span className="text-xs opacity-60">/100</span>
                  <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[var(--border)] rounded-full h-3 mb-2">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${getFactorBgColor(score)}`}
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>

              {/* Basic Description */}
              <div className="text-sm opacity-80">
                {description}
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-[var(--border)] bg-[var(--secondary)]/20">
                <div className="pt-3 space-y-3">
                  {/* Detailed Explanation */}
                  <div>
                    <div className="text-sm font-medium mb-1 text-[var(--foreground)]">
                      Analysis:
                    </div>
                    <div className="text-sm opacity-90">
                      {factorData.explanation}
                    </div>
                  </div>

                  {/* Factor-specific additional data */}
                  {factorData.weeklyImprovement && (
                    <div>
                      <div className="text-sm font-medium mb-1 text-[var(--foreground)]">
                        Impact:
                      </div>
                      <div className="text-sm opacity-90">
                        Weekly improvement: +{factorData.weeklyImprovement.toFixed(1)} fantasy points
                      </div>
                      {factorData.seasonImprovement && (
                        <div className="text-sm opacity-90">
                          Season improvement: +{factorData.seasonImprovement.toFixed(1)} fantasy points
                        </div>
                      )}
                      {factorData.impactType && (
                        <div className="text-sm opacity-90">
                          Impact type: {factorData.impactType.replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>
                  )}

                  {factorData.riskLevel && (
                    <div>
                      <div className="text-sm font-medium mb-1 text-[var(--foreground)]">
                        Risk Assessment:
                      </div>
                      <div className={`text-sm font-medium ${
                        factorData.riskLevel === 'low' ? 'text-green-400' :
                        factorData.riskLevel === 'medium' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {factorData.riskLevel.toUpperCase()} RISK
                      </div>
                    </div>
                  )}

                  {factorData.estimatedPickRange && (
                    <div>
                      <div className="text-sm font-medium mb-1 text-[var(--foreground)]">
                        Draft Projection:
                      </div>
                      <div className="text-sm opacity-90">
                        Expected range: Picks {factorData.estimatedPickRange.earliest}-{factorData.estimatedPickRange.latest}
                      </div>
                      {factorData.estimatedPickRange.mostLikely && (
                        <div className="text-sm opacity-90">
                          Most likely: Pick {factorData.estimatedPickRange.mostLikely}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Score Interpretation */}
                  <div>
                    <div className="text-sm font-medium mb-1 text-[var(--foreground)]">
                      Score Interpretation:
                    </div>
                    <div className="text-sm opacity-90">
                      {score >= 80 && "Excellent - This factor strongly supports drafting this player"}
                      {score >= 60 && score < 80 && "Good - This factor moderately supports drafting this player"}
                      {score >= 40 && score < 60 && "Average - This factor is neutral regarding this player"}
                      {score >= 20 && score < 40 && "Below Average - This factor suggests caution with this player"}
                      {score < 20 && "Poor - This factor argues against drafting this player"}
                    </div>
                  </div>

                  {/* Visual Score Breakdown */}
                  <div className="grid grid-cols-5 gap-1 mt-2">
                    {[20, 40, 60, 80, 100].map((threshold, index) => (
                      <div
                        key={threshold}
                        className={`h-2 rounded ${
                          score >= (index * 20) 
                            ? getFactorBgColor(score)
                            : 'bg-[var(--border)]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs opacity-60 mt-1">
                    <span>Poor</span>
                    <span>Below Avg</span>
                    <span>Average</span>
                    <span>Good</span>
                    <span>Excellent</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Overall Factor Summary */}
      <div className="mt-6 p-4 bg-[var(--primary)]/10 rounded-lg border border-[var(--primary)]/30">
        <div className="text-sm font-medium mb-2 text-[var(--foreground)]">
          Factor Summary:
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="opacity-80">Strongest Factor:</span>
            <span className="ml-2 font-semibold text-green-400">
              {getFactorDisplayName(
                Object.entries(factors).reduce((max, [key, data]) => 
                  data.score > factors[max].score ? key : max
                , Object.keys(factors)[0])
              )}
            </span>
          </div>
          <div>
            <span className="opacity-80">Weakest Factor:</span>
            <span className="ml-2 font-semibold text-red-400">
              {getFactorDisplayName(
                Object.entries(factors).reduce((min, [key, data]) => 
                  data.score < factors[min].score ? key : min
                , Object.keys(factors)[0])
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OptimizationFactors;