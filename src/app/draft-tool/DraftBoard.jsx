import React, { useState, useMemo, useEffect } from "react";

export default function DraftBoard({
  analyzedPicks,
  managers,
  totalRounds,
  perfectDraft,
}) {
  const [showPerfectDraft, setShowPerfectDraft] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);

  // Re-render when analyzedPicks changes (new picks made)
  useEffect(() => {
    // Show update animation when data changes
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 500);
    return () => clearTimeout(timer);
  }, [analyzedPicks, perfectDraft]);

  // Guard clause to prevent rendering with incomplete data
  if (!managers.length || !analyzedPicks.length) {
    return <div>Loading Draft Board...</div>;
  }

  // Create a map for quick manager lookup by user_id to get their display name
  const managerMap = new Map(managers.map((m) => [m.user_id, m]));

  // Group picks by manager
  const picksByManager = {};
  managers.forEach((manager) => {
    picksByManager[manager.user_id] = analyzedPicks
      .filter((pick) => pick.picked_by === manager.user_id)
      .sort((a, b) => a.pick_no - b.pick_no); // Sort by pick number
  });

  // Sort managers by their draft position (based on their first pick)
  const sortedManagers = [...managers].sort((a, b) => {
    const aFirstPick = picksByManager[a.user_id]?.[0]?.pick_no || Infinity;
    const bFirstPick = picksByManager[b.user_id]?.[0]?.pick_no || Infinity;
    return aFirstPick - bFirstPick;
  });

  // Group perfect picks by manager
  const perfectPicksByManager = {};
  managers.forEach((manager) => {
    perfectPicksByManager[manager.user_id] = perfectDraft
      .filter((pick) => pick.picked_by === manager.user_id)
      .sort((a, b) => a.pick_no - b.pick_no);
  });

  // Create an array representing the rounds
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  // Choose which data to display
  const currentPicksByManager = showPerfectDraft
    ? perfectPicksByManager
    : picksByManager;
  const currentTitle = showPerfectDraft
    ? "Perfect Draft Board"
    : "Actual Draft Board";

  return (
    <div className={`p-4 bg-gray-900 text-white rounded-lg shadow-lg transition-all duration-300 ${isUpdating ? 'ring-2 ring-cyan-500' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{currentTitle}</h2>
        <div className="flex items-center space-x-3">
          <span
            className={`text-sm ${
              !showPerfectDraft ? "text-white font-semibold" : "text-gray-400"
            }`}
          >
            Actual
          </span>
          <button
            onClick={() => setShowPerfectDraft(!showPerfectDraft)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
              showPerfectDraft ? "bg-cyan-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showPerfectDraft ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span
            className={`text-sm ${
              showPerfectDraft ? "text-white font-semibold" : "text-gray-400"
            }`}
          >
            Perfect
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th className="p-1 border border-gray-700 w-12">Rd</th>
              {/* Columns now represent managers in draft order */}
              {sortedManagers.map((manager) => (
                <th
                  key={manager.user_id}
                  className="p-2 border border-gray-700 min-w-32"
                >
                  <div
                    className="text-sm font-bold truncate"
                    title={manager.display_name}
                  >
                    {manager.display_name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((roundNum) => (
              <tr key={roundNum} className="text-center">
                <td className="font-bold p-1 border border-gray-700 bg-gray-800 text-xs w-12">
                  {roundNum}
                </td>
                {/* Loop through each manager in draft order */}
                {sortedManagers.map((manager) => {
                  // Get the pick for this manager in this round (0-indexed)
                  const managerPicks =
                    currentPicksByManager[manager.user_id] || [];
                  const pick = managerPicks[roundNum - 1]; // Round is 1-indexed, array is 0-indexed

                  // If no pick is found for this slot, render an empty cell
                  if (!pick || !pick.player) {
                    return (
                      <td
                        key={manager.user_id}
                        className="p-2 border border-gray-700 h-24"
                      ></td>
                    );
                  }

                  // Determine pick quality for highlighting (only for actual draft)
                  const isOptimal = !showPerfectDraft && pick.isOptimalPick;
                  const isSuboptimal =
                    !showPerfectDraft &&
                    pick.bestAvailablePick &&
                    (pick.rosterVorp || 0) <
                      pick.bestAvailablePick.rosterVorp - 0.01;
                  const isPerfect = showPerfectDraft && pick.isPerfectPick;

                  // Create tooltip content for suboptimal picks
                  const tooltipContent = isSuboptimal
                    ? `Better pick available: ${pick.bestAvailablePick.name} (${
                        pick.bestAvailablePick.pos
                      }) - Roster VORP: ${pick.bestAvailablePick.rosterVorp.toFixed(
                        2
                      )}`
                    : "";

                  return (
                    <td
                      key={manager.user_id}
                      className={`p-2 border border-gray-700 text-left align-top w-32 relative group ${
                        isPerfect
                          ? "bg-cyan-900 border-cyan-600"
                          : isOptimal
                          ? "bg-green-900 border-green-600"
                          : isSuboptimal
                          ? "bg-red-900 border-red-600"
                          : ""
                      }`}
                      title={tooltipContent}
                    >
                      <div className="flex flex-col h-full justify-between">
                        {/* Player Info */}
                        <div>
                          <div className="font-bold text-sm">
                            <a href={`player/${pick.player.id}`} >{pick.player.name}</a>
                          </div>
                          <div className="text-xs text-gray-400">
                            {pick.player.pos} - {pick.player.team}
                          </div>
                          <div className="text-xs text-gray-500">
                            Pick #{pick.pick_no}
                          </div>
                          <div className="text-xs text-orange-400">
                            ADP: {pick.player.adp && pick.player.adp < 999 ? pick.player.adp.toFixed(1) : '-'}
                          </div>
                          <div className="text-xs text-blue-400">
                            FPTS: {pick.player.fpts.toFixed(1)}
                          </div>
                        </div>
                        {/* VORP Values */}
                        <div className="text-right mt-1">
                          <div className="font-semibold text-cyan-400 text-sm">
                            VORP: {pick.historicalVorp.toFixed(2)}
                          </div>
                          <div className="font-semibold text-yellow-400 text-xs">
                            VORP (All):{" "}
                            {(pick.historicalVorpAll || 0).toFixed(2)}
                          </div>
                          <div className="font-semibold text-green-400 text-xs">
                            Roster: {(pick.rosterVorp || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Enhanced tooltip for suboptimal picks (only in actual draft mode) */}
                      {!showPerfectDraft && isSuboptimal && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-48">
                          <div className="font-bold text-red-400 mb-1">
                            Better Pick Available:
                          </div>
                          <div className="font-semibold">
                            {pick.bestAvailablePick.name}
                          </div>
                          <div className="text-gray-300">
                            {pick.bestAvailablePick.pos} -{" "}
                            {pick.bestAvailablePick.team}
                          </div>
                          <div className="text-green-400 mt-1">
                            Roster VORP:{" "}
                            {pick.bestAvailablePick.rosterVorp.toFixed(2)}
                          </div>
                          <div className="text-red-400">
                            Missed Value:{" "}
                            {(
                              pick.bestAvailablePick.rosterVorp -
                              (pick.rosterVorp || 0)
                            ).toFixed(2)}
                          </div>
                        </div>
                      )}

                      {/* Perfect draft indicator */}
                      {showPerfectDraft && isPerfect && (
                        <div className="absolute top-1 right-1">
                          <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
