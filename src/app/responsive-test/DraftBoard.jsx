import React from 'react';

export default function DraftBoard({ analyzedPicks, managers, totalRounds }) {
  // Guard clause to prevent rendering with incomplete data
  if (!managers.length || !analyzedPicks.length) {
    return <div>Loading Draft Board...</div>;
  }

  // Create a map for quick manager lookup by user_id to get their display name
  const managerMap = new Map(managers.map(m => [m.user_id, m]));
  
  // Group picks by manager
  const picksByManager = {};
  managers.forEach(manager => {
    picksByManager[manager.user_id] = analyzedPicks
      .filter(pick => pick.picked_by === manager.user_id)
      .sort((a, b) => a.pick_no - b.pick_no); // Sort by pick number
  });

  // Sort managers by their draft position (based on their first pick)
  const sortedManagers = [...managers].sort((a, b) => {
    const aFirstPick = picksByManager[a.user_id]?.[0]?.pick_no || Infinity;
    const bFirstPick = picksByManager[b.user_id]?.[0]?.pick_no || Infinity;
    return aFirstPick - bFirstPick;
  });

  // Create an array representing the rounds
  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="p-4 bg-gray-900 text-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Draft Board</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th className="p-2 border border-gray-700">Round</th>
              {/* Columns now represent managers in draft order */}
              {sortedManagers.map(manager => (
                <th key={manager.user_id} className="p-2 border border-gray-700 min-w-32">
                  <div className="text-sm font-bold truncate" title={manager.display_name}>
                    {manager.display_name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map(roundNum => (
              <tr key={roundNum} className="text-center">
                <td className="font-bold p-2 border border-gray-700 bg-gray-800">{roundNum}</td>
                {/* Loop through each manager in draft order */}
                {sortedManagers.map(manager => {
                  // Get the pick for this manager in this round (0-indexed)
                  const managerPicks = picksByManager[manager.user_id] || [];
                  const pick = managerPicks[roundNum - 1]; // Round is 1-indexed, array is 0-indexed

                  // If no pick is found for this slot, render an empty cell
                  if (!pick || !pick.player) {
                    return <td key={manager.user_id} className="p-2 border border-gray-700 h-20"></td>;
                  }

                  return (
                    <td key={manager.user_id} className="p-2 border border-gray-700 text-left align-top w-32">
                      <div className="flex flex-col h-full justify-between">
                        {/* Player Info */}
                        <div>
                          <div className="font-bold text-sm">{pick.player.name}</div>
                          <div className="text-xs text-gray-400">{pick.player.pos} - {pick.player.team}</div>
                          <div className="text-xs text-gray-500">
                            Pick #{pick.pick_no}
                          </div>
                        </div>
                        {/* VORP Values */}
                        <div className="text-right mt-1">
                          <div className="font-semibold text-cyan-400 text-sm">
                            VORP: {pick.historicalVorp.toFixed(2)}
                          </div>
                          <div className="font-semibold text-yellow-400 text-xs">
                            VORP (All): {(pick.historicalVorpAll || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
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
