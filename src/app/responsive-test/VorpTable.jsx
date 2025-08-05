import React, { useState, useMemo } from "react";

export default function VorpTable({ rankedPlayers, baselines, onDraft, currentPicker }) {
  // Default sort to 'rosterVorp' as it's the most contextually important
  const [sortBy, setSortBy] = useState("rosterVorp"); 

  const sortedPlayers = useMemo(() => {
    return [...rankedPlayers].sort((a, b) => {
      switch (sortBy) {
        case "fpts":
          return b.fpts - a.fpts;
        case "vorp":
          return b.vorp - a.vorp;
        case "vorpAll":
           return b.vorpAll - a.vorpAll;
        case "rosterVorp":
        default:
          return b.rosterVorp - a.rosterVorp;
      }
    });
  }, [rankedPlayers, sortBy]);

  if (!rankedPlayers.length) {
    return <div>Calculating VORP...</div>;
  }

  return (
    <div className="p-4 bg-gray-900 text-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Best Available Players</h2>
      <div className='text-xs mb-4 text-gray-400'>
        Baselines: QB: {baselines.QB?.toFixed(2)} | RB: {baselines.RB?.toFixed(2)} | WR: {baselines.WR?.toFixed(2)} | TE: {baselines.TE?.toFixed(2)} | FLEX: {baselines.FLEX?.toFixed(2)} |
        <span className="font-bold text-yellow-400"> OVERALL: {baselines.GLOBAL?.toFixed(2)}</span>
      </div>

      <div className="mb-4 flex justify-between items-center">
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
            </select>
        </div>
        {/* This block displays the name of the manager who is currently picking */}
        {currentPicker && (
            <div className="text-sm">
                <span className="text-gray-400">On the Clock: </span>
                <span className="font-bold text-cyan-400">{currentPicker.display_name}</span>
            </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Player</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Pos</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">FPTS</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">P.VORP</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">O.VORP</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Roster VORP</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-gray-900 divide-y divide-gray-800">
            {sortedPlayers.slice(0, 50).map((player) => (
              <tr key={player.id} className="hover:bg-gray-700">
                <td className="px-4 py-2 whitespace-nowrap font-medium">{player.name}</td>
                <td className="px-4 py-2 whitespace-nowrap">{player.pos}</td>
                <td className="px-4 py-2 whitespace-nowrap">{player.fpts.toFixed(2)}</td>
                <td className="px-4 py-2 whitespace-nowrap font-semibold text-cyan-400" title="Positional VORP">{player.vorp.toFixed(2)}</td>
                <td className="px-4 py-2 whitespace-nowrap font-semibold text-yellow-400" title="Overall VORP">{player.vorpAll.toFixed(2)}</td>
                <td className="px-4 py-2 whitespace-nowrap font-bold text-green-400" title="Value to your specific roster">{player.rosterVorp.toFixed(2)}</td>
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
