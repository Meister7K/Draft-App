"use client";

export function CareerOverview({ player }) {
  // Calculate career totals and averages using the actual data structure
  const calculateCareerStats = () => {
    if (!player?.seasons) return null;

    const careerStats = {};
    const seasonCount = Object.keys(player.seasons).length;
    let totalGames = 0;
    let totalSeasons = 0;
    let totalFantasyPoints = 0;

    // Aggregate all season data
    Object.values(player.seasons).forEach(season => {
      totalSeasons++;
      
      // Handle fantasy points
      if (season.fantasy_points) {
        totalFantasyPoints += season.fantasy_points;
      }
      
      // Handle season_totals
      if (season.season_totals) {
        Object.entries(season.season_totals).forEach(([key, value]) => {
          if (typeof value === "number") {
            if (!careerStats[key]) {
              careerStats[key] = { total: 0, seasons: 0 };
            }
            careerStats[key].total += value;
            careerStats[key].seasons++;
            
            // Track games played specifically
            if (key === "gp") {
              totalGames += value;
            }
          }
        });
      }
      
      // Handle direct season properties
      Object.entries(season).forEach(([key, value]) => {
        if (key !== "weeks" && key !== "season_totals" && key !== "season_projected_totals" && typeof value === "number") {
          if (!careerStats[key]) {
            careerStats[key] = { total: 0, seasons: 0 };
          }
          careerStats[key].total += value;
          careerStats[key].seasons++;
        }
      });
    });

    // Calculate averages
    const careerAverages = {};
    Object.entries(careerStats).forEach(([key, data]) => {
      careerAverages[key] = {
        total: data.total,
        average: data.total / data.seasons,
        perGame: totalGames > 0 ? data.total / totalGames : 0
      };
    });

    // Add fantasy points if available
    if (totalFantasyPoints > 0) {
      careerAverages.fantasy_points = {
        total: totalFantasyPoints,
        average: totalFantasyPoints / totalSeasons,
        perGame: totalGames > 0 ? totalFantasyPoints / totalGames : 0
      };
    }

    return {
      stats: careerAverages,
      totalSeasons,
      totalGames,
      seasonsWithData: seasonCount,
      totalFantasyPoints
    };
  };

  const careerData = calculateCareerStats();

  if (!careerData) {
    return (
      <div className="bg-[var(--secondary)] rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
          Career Overview
        </h3>
        <div className="text-center opacity-80 py-4">
          No career data available
        </div>
      </div>
    );
  }

  const { stats, totalSeasons, totalGames, totalFantasyPoints } = careerData;

  // Key stats to highlight using actual data structure
  const keyStats = [
    { key: "fantasy_points", label: "Fantasy Points", format: "number" },
    { key: "gp", label: "Games Played", format: "integer" },
    { key: "pass_yd", label: "Passing Yards", format: "integer" },
    { key: "pass_td", label: "Passing TDs", format: "integer" },
    { key: "pass_cmp", label: "Completions", format: "integer" },
    { key: "pass_att", label: "Pass Attempts", format: "integer" },
    { key: "rush_yd", label: "Rushing Yards", format: "integer" },
    { key: "rush_td", label: "Rushing TDs", format: "integer" },
    { key: "rush_att", label: "Rush Attempts", format: "integer" },
    { key: "rec_yd", label: "Receiving Yards", format: "integer" },
    { key: "rec_td", label: "Receiving TDs", format: "integer" },
    { key: "receptions", label: "Receptions", format: "integer" },
    { key: "targets", label: "Targets", format: "integer" }
  ];

  const formatValue = (value, format) => {
    if (value == null) return "0";
    if (format === "integer") return Math.round(value).toLocaleString();
    return value.toFixed(1);
  };

  const getStatColor = (key) => {
    if (key.includes("fantasy")) return "text-purple-400";
    if (key.includes("pass_") || key.includes("passing")) return "text-blue-400";
    if (key.includes("rush_") || key.includes("rushing")) return "text-green-400";
    if (key.includes("rec_") || key.includes("receiving") || key.includes("receptions") || key.includes("targets")) return "text-yellow-400";
    if (key.includes("pts_")) return "text-purple-400";
    if (key === "gp" || key === "gs") return "text-indigo-400";
    return "text-[var(--foreground)]";
  };

  return (
    <div className="bg-[var(--secondary)] rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-[var(--foreground)]">
        Career Overview
      </h3>
      
      {/* Career Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--background)] rounded p-3 text-center">
          <div className="text-2xl font-bold text-[var(--primary)]">{totalSeasons}</div>
          <div className="text-sm opacity-80">Seasons</div>
        </div>
        <div className="bg-[var(--background)] rounded p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{totalGames}</div>
          <div className="text-sm opacity-80">Games Played</div>
        </div>
        <div className="bg-[var(--background)] rounded p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">
            {totalFantasyPoints ? formatValue(totalFantasyPoints, "number") : "0"}
          </div>
          <div className="text-sm opacity-80">Career Fantasy Pts</div>
        </div>
        <div className="bg-[var(--background)] rounded p-3 text-center">
          <div className="text-2xl font-bold text-orange-400">
            {totalFantasyPoints && totalGames ? formatValue(totalFantasyPoints / totalGames, "number") : "0"}
          </div>
          <div className="text-sm opacity-80">Avg Fantasy Pts/Game</div>
        </div>
      </div>

      {/* Detailed Career Stats */}
      <div className="space-y-4">
        <h4 className="font-medium text-[var(--foreground)] mb-3">Career Totals & Averages</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {keyStats.map(({ key, label, format }) => {
            const stat = stats[key];
            if (!stat || stat.total === 0) return null;
            
            return (
              <div key={key} className="bg-[var(--background)] rounded p-4">
                <div className="text-sm opacity-80 mb-1">{label}</div>
                <div className="space-y-1">
                  <div className={`text-lg font-bold ${getStatColor(key)}`}>
                    {formatValue(stat.total, format)}
                    <span className="text-xs opacity-60 ml-1">total</span>
                  </div>
                  <div className="text-sm opacity-80">
                    {formatValue(stat.average, format)} per season • {formatValue(stat.perGame, format)} per game
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="mt-6 pt-4 border-t border-[var(--border)]">
        <h4 className="font-medium text-[var(--foreground)] mb-3">Other Career Stats</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(stats)
            .filter(([key]) => !keyStats.some(ks => ks.key === key))
            .filter(([key, stat]) => stat.total > 0)
            .map(([key, stat]) => (
              <div key={key} className="bg-[var(--background)] rounded p-3">
                <div className="text-xs opacity-80 capitalize mb-1">
                  {key.replace(/_/g, " ")}
                </div>
                <div className="font-medium text-[var(--foreground)]">
                  {formatValue(stat.total, "number")}
                </div>
                <div className="text-xs opacity-60">
                  {formatValue(stat.perGame, "number")}/game
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}