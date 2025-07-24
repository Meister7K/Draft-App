"use client";

export function ConsistencyScore({ player }) {
  // Calculate consistency score based on standard deviation and projection accuracy
  const calculateConsistencyScore = () => {
    if (!player?.seasons) return null;

    let allWeeklyData = [];

    // Collect all weekly data across all seasons
    Object.values(player.seasons).forEach((season) => {
      if (season.weeks) {
        Object.values(season.weeks).forEach((week) => {
          const actual = week?.stats?.stats?.pts_ppr;
          const projected = week?.projections?.stats?.pts_ppr;

          if (actual != null && projected != null && projected > 0) {
            allWeeklyData.push({
              actual,
              projected,
              difference: actual - projected,
              percentDiff: ((actual - projected) / projected) * 100,
            });
          }
        });
      }
    });

    if (allWeeklyData.length < 3) return null; // Need at least 3 games for meaningful analysis

    // Calculate average performance vs projections
    const avgDifference =
      allWeeklyData.reduce((sum, week) => sum + week.difference, 0) /
      allWeeklyData.length;
    const avgPercentDiff =
      allWeeklyData.reduce((sum, week) => sum + week.percentDiff, 0) /
      allWeeklyData.length;

    // Calculate standard deviation of the differences
    const variance =
      allWeeklyData.reduce((sum, week) => {
        return sum + Math.pow(week.difference - avgDifference, 2);
      }, 0) / allWeeklyData.length;

    const standardDeviation = Math.sqrt(variance);

    // Calculate standard deviation of percent differences (for normalization)
    const percentVariance =
      allWeeklyData.reduce((sum, week) => {
        return sum + Math.pow(week.percentDiff - avgPercentDiff, 2);
      }, 0) / allWeeklyData.length;

    const percentStdDev = Math.sqrt(percentVariance);

    // Create consistency score
    // Positive score = outperforms projections but inconsistent
    // Negative score = underperforms projections but consistent
    // Score magnitude indicates level of consistency/inconsistency

    // Base score on average performance vs projections
    let consistencyScore = avgPercentDiff;

    // Adjust based on volatility (standard deviation) - more forgiving approach
    // Higher std dev = more inconsistent = higher absolute score
    const volatilityMultiplier = 1 + percentStdDev / 75; // More forgiving normalization (was 50)

    // Apply a softer volatility adjustment
    if (consistencyScore > 0) {
      // Outperforming: positive score increases with volatility, but more gently
      consistencyScore = consistencyScore * Math.min(volatilityMultiplier, 1.5); // Cap multiplier at 1.5x
    } else {
      // Underperforming: negative score decreases (becomes more negative) with volatility, but more gently
      consistencyScore = consistencyScore * Math.min(volatilityMultiplier, 1.5); // Cap multiplier at 1.5x
    }

    // Cap the score at reasonable bounds
    consistencyScore = Math.max(-100, Math.min(100, consistencyScore));

    return {
      score: consistencyScore,
      avgDifference,
      avgPercentDiff,
      standardDeviation,
      percentStdDev,
      gamesAnalyzed: allWeeklyData.length,
      outperformWeeks: allWeeklyData.filter((w) => w.difference > 0).length,
      underperformWeeks: allWeeklyData.filter((w) => w.difference < 0).length,
    };
  };

  const consistencyData = calculateConsistencyScore();

  if (!consistencyData) {
    return (
      <div className="bg-[var(--secondary)] rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
          Consistency Score
        </h3>
        <div className="text-center opacity-80 py-4">
          Insufficient data for consistency analysis
        </div>
      </div>
    );
  }

  const {
    score,
    avgDifference,
    avgPercentDiff,
    standardDeviation,
    percentStdDev,
    gamesAnalyzed,
    outperformWeeks,
    underperformWeeks,
  } = consistencyData;

  // Determine score interpretation (more forgiving thresholds)
  const getScoreInterpretation = (score) => {
    if (score > 15)
      return {
        label: "Boom/Bust Upside",
        color: "text-orange-400",
        bg: "bg-orange-500/20",
      }; // Was 20, now 15
    if (score > 3)
      return {
        label: "Slight Upside",
        color: "text-yellow-400",
        bg: "bg-yellow-500/20",
      }; // Was 5, now 3
    if (score > -3)
      return {
        label: "Projection Accurate",
        color: "text-green-400",
        bg: "bg-green-500/20",
      }; // Was -5, now -3
    if (score > -15)
      return {
        label: "Slight Underperform",
        color: "text-blue-400",
        bg: "bg-blue-500/20",
      }; // Was -20, now -15
    return {
      label: "Consistent Underperform",
      color: "text-red-400",
      bg: "bg-red-500/20",
    }; // Below -15 (was -20)
  };

  const interpretation = getScoreInterpretation(score);

  // Determine consistency level based on standard deviation (more forgiving thresholds)

  const getConsistencyLevel = (stdDev) => {
    console.log(stdDev);
    if (stdDev > 75) return "Very Volatile"; // Was 8, now 12
    if (stdDev > 50) return "Somewhat Volatile"; // Was 5, now 8
    if (stdDev > 25) return "Moderately Consistent"; // Was 3, now 5
    return "Very Consistent"; // 5 and below (was 3 and below)
  };

  return (
    <div className="bg-[var(--secondary)] rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
        Consistency Score
      </h3>

      {/* Main Score Display */}
      <div className={`${interpretation.bg} rounded-lg p-4 mb-4`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-3xl font-bold ${interpretation.color}`}>
              {score > 0 ? "+" : ""}
              {score.toFixed(1)}
            </div>
            <div className={`text-sm font-medium ${interpretation.color}`}>
              {interpretation.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-80">Consistency Level</div>
            <div className="font-medium">
              {getConsistencyLevel(percentStdDev)}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-[var(--background)] rounded p-3">
          <div className="text-xs opacity-80">Avg vs Projection</div>
          <div
            className={`font-medium ${
              avgDifference > 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {avgDifference > 0 ? "+" : ""}
            {avgDifference.toFixed(2)} pts
          </div>
        </div>

        <div className="bg-[var(--background)] rounded p-3">
          <div className="text-xs opacity-80">Volatility (Std Dev)</div>
          <div className="font-medium text-[var(--foreground)]">
            ±{standardDeviation.toFixed(2)} pts
          </div>
        </div>

        <div className="bg-[var(--background)] rounded p-3">
          <div className="text-xs opacity-80">Outperform Rate</div>
          <div className="font-medium text-green-400">
            {((outperformWeeks / gamesAnalyzed) * 100).toFixed(0)}%
          </div>
        </div>

        <div className="bg-[var(--background)] rounded p-3">
          <div className="text-xs opacity-80">Games Analyzed</div>
          <div className="font-medium text-[var(--foreground)]">
            {gamesAnalyzed}
          </div>
        </div>
      </div>

      {/* Score Explanation */}
      <div className="text-xs opacity-80 space-y-1">
        <p>
          <strong>Score Interpretation:</strong>
        </p>
        <p>
          • <span className="text-orange-400">Positive scores</span>: Player
          tends to outperform projections but may be inconsistent
        </p>
        <p>
          • <span className="text-red-400">Negative scores</span>: Player tends
          to underperform projections but may be more consistent
        </p>
        <p>
          • <span className="text-green-400">Scores near 0</span>: Player
          performs close to projections with good consistency
        </p>
        <p>• Higher absolute values indicate more volatility in performance</p>
      </div>
    </div>
  );
}
