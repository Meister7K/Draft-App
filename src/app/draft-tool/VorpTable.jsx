import React, { useState, useMemo, useEffect } from "react";

export default function VorpTable({
  rankedPlayers,
  baselines,
  onDraft,
  currentPicker,
  positionalAnalysis,
  rosterSetup,
  currentPickerRoster,
}) {
  const [sortBy, setSortBy] = useState("rosterVorp");
  const [adpFilter, setAdpFilter] = useState("all");
  const [showTop5Only, setShowTop5Only] = useState(true);

  const [isUpdating, setIsUpdating] = useState(false);

  // Reset to top of table when rankedPlayers changes (new picks made)
  useEffect(() => {
    // Show update animation when data changes
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 500);
    return () => clearTimeout(timer);
  }, [rankedPlayers]);

  const sortedPlayers = useMemo(() => {
    let filteredPlayers = [...rankedPlayers];

    if (adpFilter !== "all") {
      filteredPlayers = filteredPlayers.filter((player) => {
        const adp = player.adp || 999;
        switch (adpFilter) {
          case "early":
            return adp <= 50;
          case "mid":
            return adp > 50 && adp <= 100;
          case "late":
            return adp > 100;
          default:
            return true;
        }
      });
    }

    return filteredPlayers.sort((a, b) => {
      switch (sortBy) {
        case "fpts":
          return b.fpts - a.fpts;
        case "vorp":
          return b.vorp - a.vorp;
        case "vorpAll":
          return b.vorpAll - a.vorpAll;
        case "adp":
          return (a.adp || 999) - (b.adp || 999);
        case "rosterVorp":
        default:
          return b.rosterVorp - a.rosterVorp;
      }
    });
  }, [rankedPlayers, sortBy, adpFilter]);

  const { insights, positionGrades } = useMemo(() => {
    if (!currentPickerRoster || !rosterSetup || !rankedPlayers.length) {
      return { insights: [], positionGrades: {} };
    }

    // Always use the full player pool for strategic analysis, not the filtered table view
    const allAvailablePlayers = [...rankedPlayers].sort(
      (a, b) => b.rosterVorp - a.rosterVorp
    );

    // --- 1. Calculate Roster Needs ---
    const starterNeeds = {};
    rosterSetup
      .filter((p) => p !== "BN")
      .forEach((p) => {
        starterNeeds[p] = (starterNeeds[p] || 0) + 1;
      });

    const rosterCounts = {};
    currentPickerRoster.forEach((p) => {
      rosterCounts[p.pos] = (rosterCounts[p.pos] || 0) + 1;
    });

    const neededPositions = [];
    Object.keys(starterNeeds)
      .filter((pos) => pos !== "FLEX")
      .forEach((pos) => {
        if ((rosterCounts[pos] || 0) < starterNeeds[pos]) {
          neededPositions.push(pos);
        }
      });

    const flexEligibleCount = currentPickerRoster.filter((p) =>
      ["RB", "WR", "TE"].includes(p.pos)
    ).length;
    const dedicatedStarterCount = Object.keys(starterNeeds)
      .filter((p) => p !== "FLEX")
      .reduce(
        (sum, pos) => sum + Math.min(rosterCounts[pos] || 0, starterNeeds[pos]),
        0
      );
    if (flexEligibleCount - dedicatedStarterCount < (starterNeeds.FLEX || 0)) {
      neededPositions.push("FLEX");
    }

    // --- 2. Generate Text Insights ---
    const textInsights = [];

    // Evaluate all players to find the best strategic pick
    const evaluateStrategicPick = () => {
      const topByValue = allAvailablePlayers[0]; // Best overall value from full pool

      // Find best player for each needed position from full pool
      const needBasedOptions = neededPositions
        .map((pos) => {
          if (pos === "FLEX") {
            return allAvailablePlayers.find((p) =>
              ["RB", "WR", "TE"].includes(p.pos)
            );
          }
          return allAvailablePlayers.find((p) => p.pos === pos);
        })
        .filter(Boolean);

      // Calculate strategic scores for top candidates
      const candidates = [topByValue, ...needBasedOptions]
        .filter(
          (player, index, arr) =>
            arr.findIndex((p) => p.id === player.id) === index
        ) // Remove duplicates
        .slice(0, 5) // Limit to top 5 candidates
        .map((player) => {
          let strategicScore = player.rosterVorp;

          // Bonus for filling needed positions
          const fillsNeed =
            neededPositions.includes(player.pos) ||
            (neededPositions.includes("FLEX") &&
              ["RB", "WR", "TE"].includes(player.pos));
          if (fillsNeed) strategicScore += 2;

          // Bonus for positional scarcity (fewer quality options remaining)
          const positionDepth = allAvailablePlayers.filter(
            (p) => p.pos === player.pos
          ).length;
          if (positionDepth <= 3) strategicScore += 1;

          // Penalty for luxury picks when needs exist
          if (neededPositions.length > 0 && !fillsNeed) strategicScore -= 1;

          return { player, strategicScore, fillsNeed };
        });

      return candidates.sort((a, b) => b.strategicScore - a.strategicScore)[0];
    };

    const recommendation = evaluateStrategicPick();
    const recommendedPlayer = recommendation.player;

    textInsights.push(
      `Recommended pick: ${recommendedPlayer.name} (${
        recommendedPlayer.pos
      }), adding ${recommendedPlayer.rosterVorp.toFixed(1)} VORP.`
    );

    if (neededPositions.length > 0) {
      if (recommendation.fillsNeed) {
        const needType = neededPositions.includes(recommendedPlayer.pos)
          ? recommendedPlayer.pos
          : "FLEX";
        textInsights.push(
          `This fills a critical need for a starting ${needType} position.`
        );
      } else {
        const bestNeedOption = allAvailablePlayers.find(
          (p) =>
            neededPositions.includes(p.pos) ||
            (neededPositions.includes("FLEX") &&
              ["RB", "WR", "TE"].includes(p.pos))
        );
        if (bestNeedOption) {
          textInsights.push(
            `Alternative: ${bestNeedOption.name} (${
              bestNeedOption.pos
            }) fills ${
              neededPositions[0]
            } need with ${bestNeedOption.rosterVorp.toFixed(1)} VORP.`
          );
        }
      }
    } else {
      textInsights.push("Starters are full. Focus on depth and upside.");
    }

    // --- 3. Generate Positional "Need" Grades ---
    const grades = {};
    ["QB", "RB", "WR", "TE"].forEach((pos) => {
      let grade = "D";
      const isStarterNeeded = neededPositions.includes(pos);
      const isFlexCandidate =
        neededPositions.includes("FLEX") && ["RB", "WR", "TE"].includes(pos);
      const bestPlayerAtPos = allAvailablePlayers.find((p) => p.pos === pos);
      const rank = allAvailablePlayers.indexOf(bestPlayerAtPos);

      if (isStarterNeeded) {
        grade = rank !== -1 && rank < 12 ? "A+" : "B";
      } else if (isFlexCandidate) {
        grade = "C";
      }
      grades[pos] = { grade };
    });

    return { insights: textInsights, positionGrades: grades };
  }, [currentPickerRoster, rosterSetup, rankedPlayers]);

  const getGradeColor = (grade) => {
    switch (grade) {
      case "A+":
        return "text-green-400";
      case "B":
        return "text-cyan-400";
      case "C":
        return "text-yellow-400";
      case "D":
        return "text-orange-400";
      default:
        return "text-gray-400";
    }
  };

  if (!rankedPlayers.length) {
    return <div>Calculating VORP...</div>;
  }

  return (
    <div
      className={`p-4 bg-gray-900 text-white rounded-lg shadow-lg transition-all duration-300 ${
        isUpdating ? "ring-2 ring-cyan-500" : ""
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Positional Insights Box */}
        {positionalAnalysis && Object.keys(positionalAnalysis).length > 0 && (
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <h3 className="text-base font-semibold text-yellow-300 mb-2 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              Strategic Draft Insights
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {Object.entries(positionalAnalysis)
                .sort(([, a], [, b]) => b.avgVorp - a.avgVorp)
                .map(([pos, data]) => (
                  <div key={pos} className="p-2 bg-gray-900/70 rounded-md">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-sm">{pos}</span>
                      <span
                        className={`font-extrabold text-base ${getGradeColor(
                          data.grade
                        )}`}
                      >
                        {data.grade}
                      </span>
                    </div>
                    <p className="text-gray-400">{data.explanation}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* On The Clock Assistant */}
        {currentPicker && insights.length > 0 && (
          <div className="p-4 bg-gray-800 border border-cyan-500/30 rounded-lg flex flex-col">
            <h3 className="text-base font-semibold text-cyan-400 mb-2 flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              On the Clock Assistant
            </h3>
            <div className="flex-grow">
              <ul className="space-y-1 text-sm mb-3">
                {insights.map((tip, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-gray-300"
                  >
                    <span className="text-cyan-400 mt-1">&rarr;</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-1">
                Roster Need Grades:
              </h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                {Object.entries(positionGrades).map(([pos, data]) => (
                  <div key={pos} className="bg-gray-900/70 p-1 rounded-md">
                    <div className="font-bold text-sm">{pos}</div>
                    <div
                      className={`font-extrabold text-lg ${getGradeColor(
                        data.grade
                      )}`}
                    >
                      {data.grade}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <h2 className="text-2xl font-bold mb-4">Best Available Players</h2>
      <div className="text-xs mb-4 text-gray-400">
        Baselines: QB: {baselines.QB?.toFixed(2)} | RB:{" "}
        {baselines.RB?.toFixed(2)} | WR: {baselines.WR?.toFixed(2)} | TE:{" "}
        {baselines.TE?.toFixed(2)} | FLEX: {baselines.FLEX?.toFixed(2)} |
        <span className="font-bold text-yellow-400">
          {" "}
          OVERALL: {baselines.GLOBAL?.toFixed(2)}
        </span>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <div>
            <label className="text-sm text-gray-300 mr-2">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-800 text-white px-3 py-1 rounded border border-gray-600 focus:outline-none"
            >
              <option value="rosterVorp">Roster VORP</option>
              <option value="vorp">Positional VORP</option>
              <option value="vorpAll">Overall VORP</option>
              <option value="fpts">Fantasy Points</option>
              <option value="adp">ADP</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-300 mr-2">ADP Filter:</label>
            <select
              value={adpFilter}
              onChange={(e) => setAdpFilter(e.target.value)}
              className="bg-gray-800 text-white px-3 py-1 rounded border border-gray-600 focus:outline-none"
            >
              <option value="all">All Players</option>
              <option value="early">Early (1-50)</option>
              <option value="mid">Mid (51-100)</option>
              <option value="late">Late (101+)</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`text-sm ${
                !showTop5Only ? "text-white font-semibold" : "text-gray-400"
              }`}
            >
              All
            </span>
            <button
              onClick={() => setShowTop5Only(!showTop5Only)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
                showTop5Only ? "bg-cyan-600" : "bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  showTop5Only ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-sm ${
                showTop5Only ? "text-white font-semibold" : "text-gray-400"
              }`}
            >
              Top 5
            </span>
          </div>
        </div>
        {currentPicker && (
          <div className="text-sm">
            <span className="text-gray-400">On the Clock: </span>
            <span className="font-bold text-cyan-400">
              {currentPicker.display_name}
            </span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                Player
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                Pos
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                ADP
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                FPTS
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                P.VORP
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                O.VORP
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                Roster VORP
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-gray-900 divide-y divide-gray-800">
            {sortedPlayers.slice(0, showTop5Only ? 5 : 50).map((player) => (
              <tr key={player.id} className="hover:bg-gray-700">
                <td className="px-4 py-2 whitespace-nowrap font-medium">
                  {player.name}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{player.pos}</td>
                <td
                  className="px-4 py-2 whitespace-nowrap text-orange-400"
                  title="Average Draft Position"
                >
                  {player.adp && player.adp < 999 ? player.adp.toFixed(1) : "-"}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {player.fpts.toFixed(2)}
                </td>
                <td
                  className="px-4 py-2 whitespace-nowrap font-semibold text-cyan-400"
                  title="Positional VORP"
                >
                  {player.vorp.toFixed(2)}
                </td>
                <td
                  className="px-4 py-2 whitespace-nowrap font-semibold text-yellow-400"
                  title="Overall VORP"
                >
                  {player.vorpAll.toFixed(2)}
                </td>
                <td
                  className="px-4 py-2 whitespace-nowrap font-bold text-green-400"
                  title="Value to your specific roster"
                >
                  {player.rosterVorp.toFixed(2)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <button
                    onClick={() => onDraft(player.id)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded-md text-sm font-semibold"
                  >
                    Draft
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
