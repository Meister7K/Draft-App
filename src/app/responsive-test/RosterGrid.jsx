import React from "react";

export default function RosterGrid({ analyzedPicks, managers, rosterSetup }) {
  if (!managers.length || !rosterSetup.length) {
    return <div>Loading Rosters...</div>;
  }

  // Calculate the required positions for a full roster
  const initialNeeds = {};
  rosterSetup.forEach(
    (pos) => (initialNeeds[pos] = (initialNeeds[pos] || 0) + 1)
  );

  // Function to organize players into roster slots
  const organizeRoster = (roster) => {
    const rosterSlots = new Array(rosterSetup.length).fill(null);
    const unassignedPlayers = [...roster];

    // First pass: Fill exact position matches (including multiple slots of same position)
    rosterSetup.forEach((slotPos, index) => {
      if (slotPos !== "FLEX" && slotPos !== "BN") {
        const playerIndex = unassignedPlayers.findIndex(
          (p) => p.player?.pos === slotPos
        );
        if (playerIndex !== -1) {
          rosterSlots[index] = unassignedPlayers.splice(playerIndex, 1)[0];
        }
        // If no player found, slot remains null (empty)
      }
    });

    // Second pass: Fill FLEX slots with RB/WR/TE
    rosterSetup.forEach((slotPos, index) => {
      if (slotPos === "FLEX" && !rosterSlots[index]) {
        const playerIndex = unassignedPlayers.findIndex(
          (p) => p.player && ["RB", "WR", "TE"].includes(p.player.pos)
        );
        if (playerIndex !== -1) {
          rosterSlots[index] = unassignedPlayers.splice(playerIndex, 1)[0];
        }
      }
    });

    // Third pass: Fill bench slots with remaining players
    rosterSetup.forEach((slotPos, index) => {
      if (
        slotPos === "BN" &&
        !rosterSlots[index] &&
        unassignedPlayers.length > 0
      ) {
        rosterSlots[index] = unassignedPlayers.shift();
      }
    });

    return rosterSlots;
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-white">League Rosters</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {managers.map((manager) => {
          // Filter the analyzed picks to get the roster for the current manager
          const roster = analyzedPicks.filter(
            (p) => p.picked_by === manager.user_id
          );
          const organizedRoster = organizeRoster(roster);

          const currentNeeds = { ...initialNeeds };
          let totalFpts = 0;
          let totalVorp = 0;
          let totalVorpAll = 0;

          // Calculate totals and remaining needs
          roster.forEach(({ player, historicalVorp, historicalVorpAll }) => {
            if (player) {
              totalFpts += player.fpts;
              totalVorp += historicalVorp;
              totalVorpAll += historicalVorpAll || 0;

              // Decrement the position needs
              if (currentNeeds[player.pos] > 0) {
                currentNeeds[player.pos]--;
              } else if (
                currentNeeds["FLEX"] > 0 &&
                ["RB", "WR", "TE"].includes(player.pos)
              ) {
                currentNeeds["FLEX"]--;
              } else if (currentNeeds["BN"] > 0) {
                currentNeeds["BN"]--;
              }
            }
          });

          return (
            <div
              key={manager.user_id}
              className="bg-gray-800 text-white rounded-lg shadow-md p-4 flex flex-col"
            >
              <h3 className="font-bold text-lg mb-1 truncate">
                {manager.display_name}
              </h3>
              <div className="text-xs text-gray-400 mb-3">
                Needs:{" "}
                {Object.entries(currentNeeds)
                  .filter(([, count]) => count > 0)
                  .map(([pos, count]) => `${count} ${pos}`)
                  .join(", ")}
              </div>

              {/* Roster slots organized by position */}
              <div className="text-sm space-y-1 flex-grow">
                {organizedRoster.map((pick, index) => {
                  const slotPosition = rosterSetup[index];
                  const isEmpty = !pick || !pick.player;

                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded ${
                        isEmpty
                          ? "bg-gray-700 border-dashed border border-gray-600"
                          : "bg-gray-750"
                      }`}
                    >
                      <div className="flex items-center space-x-2 flex-grow min-w-0">
                        <span
                          className={`font-mono text-xs px-2 py-1 rounded ${
                            slotPosition === "QB"
                              ? "bg-red-600 text-white"
                              : slotPosition === "RB"
                              ? "bg-green-600 text-white"
                              : slotPosition === "WR"
                              ? "bg-blue-600 text-white"
                              : slotPosition === "TE"
                              ? "bg-orange-600 text-white"
                              : slotPosition === "FLEX"
                              ? "bg-purple-600 text-white"
                              : slotPosition === "K"
                              ? "bg-yellow-600 text-white"
                              : slotPosition === "DEF"
                              ? "bg-indigo-600 text-white"
                              : slotPosition === "BN"
                              ? "bg-gray-600 text-gray-300"
                              : "bg-slate-600 text-white"
                          }`}
                        >
                          {slotPosition}
                        </span>
                        {isEmpty ? (
                          <span className="text-gray-500 italic">Empty</span>
                        ) : (
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center space-x-1">
                              <span className="truncate font-medium">
                                ({pick.pick_no}) {pick.player.name}
                              </span>
                              <span className="font-mono text-xs text-gray-400 flex-shrink-0">
                                {pick.player.pos}
                              </span>
                            </div>
                            <div className="flex space-x-3 text-xs text-gray-400 mt-1">
                              <span>
                                FPTS:{" "}
                                <span className="text-white">
                                  {pick.player.fpts.toFixed(1)}
                                </span>
                              </span>
                              <span>
                                VORP:{" "}
                                <span className="text-cyan-400">
                                  {pick.historicalVorp.toFixed(1)}
                                </span>
                              </span>
                              <span>
                                Overall:{" "}
                                <span className="text-yellow-400">
                                  {(pick.historicalVorpAll || 0).toFixed(1)}
                                </span>
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Team totals */}
              <div className="border-t border-gray-700 mt-3 pt-2 text-xs">
                <div className="flex justify-between">
                  <span>Total Points:</span>
                  <span className="font-semibold">{totalFpts.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total VORP (Positional):</span>
                  <span className="font-semibold text-cyan-400">
                    {totalVorp.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total VORP (Overall):</span>
                  <span className="font-semibold text-yellow-400">
                    {totalVorpAll.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-600">
                  <span className="font-bold">Total Value:</span>
                  <span className="font-bold text-green-400">
                    {(totalFpts + totalVorp).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
