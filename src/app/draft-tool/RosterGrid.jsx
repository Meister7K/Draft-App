import React, { useState, useEffect } from "react";

export default function RosterGrid({
  analyzedPicks,
  managers,
  rosterSetup,
  perfectDraft,
}) {
  const [showPerfectRosters, setShowPerfectRosters] = useState(false);
  const [rosterToggles, setRosterToggles] = useState({});

  const [isUpdating, setIsUpdating] = useState(false);

  // Re-render when analyzedPicks changes (new picks made)
  useEffect(() => {
    // Show update animation when data changes
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 500);
    return () => clearTimeout(timer);
  }, [analyzedPicks, perfectDraft]);

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

  // Choose which data to display
  const currentPicks = showPerfectRosters ? perfectDraft : analyzedPicks;
  const currentTitle = showPerfectRosters
    ? "Perfect Draft Rosters"
    : "Actual Draft Rosters";

  return (
    <div
      className={`p-4 transition-all duration-300 ${
        isUpdating ? "ring-2 ring-cyan-500 rounded-lg" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">{currentTitle}</h2>
        <div className="flex items-center space-x-3">
          <span
            className={`text-sm ${
              !showPerfectRosters ? "text-white font-semibold" : "text-gray-400"
            }`}
          >
            Actual
          </span>
          <button
            onClick={() => setShowPerfectRosters(!showPerfectRosters)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
              showPerfectRosters ? "bg-cyan-600" : "bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showPerfectRosters ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span
            className={`text-sm ${
              showPerfectRosters ? "text-white font-semibold" : "text-gray-400"
            }`}
          >
            Perfect
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {managers.map((manager) => {
          // Filter the current picks to get the roster for the current manager
          const roster = currentPicks.filter(
            (p) => p.picked_by === manager.user_id
          );
          const organizedRoster = organizeRoster(roster);

          // Get individual toggle state for this roster
          const showStarterPointsOnly = rosterToggles[manager.user_id] || false;

          // Function to toggle individual roster
          const toggleRosterPoints = () => {
            setRosterToggles((prev) => ({
              ...prev,
              [manager.user_id]: !prev[manager.user_id],
            }));
          };

          const currentNeeds = { ...initialNeeds };
          let totalFpts = 0;
          let totalVorp = 0;
          let totalVorpAll = 0;
          let totalRosterVorp = 0;

          // Calculate totals and remaining needs
          organizedRoster.forEach((pick, index) => {
            const slotPosition = rosterSetup[index];
            const isStarter = slotPosition !== "BN";

            if (pick && pick.player) {
              // Only include in totals if showing all players OR if this is a starter position
              if (!showStarterPointsOnly || isStarter) {
                totalFpts += pick.player.fpts;
                totalVorp += pick.historicalVorp;
                totalVorpAll += pick.historicalVorpAll || 0;
                totalRosterVorp += pick.rosterVorp || 0;
              }
            }
          });

          // Calculate remaining needs (this logic stays the same)
          roster.forEach(({ player }) => {
            if (player) {
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
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-lg truncate">
                  {manager.display_name}
                </h3>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span
                    className={`text-xs ${
                      !showStarterPointsOnly
                        ? "text-white font-semibold"
                        : "text-gray-400"
                    }`}
                  >
                    Total
                  </span>
                  <button
                    onClick={toggleRosterPoints}
                    className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-green-500 focus:ring-offset-1 ${
                      showStarterPointsOnly ? "bg-green-600" : "bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        showStarterPointsOnly
                          ? "translate-x-4"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-xs ${
                      showStarterPointsOnly
                        ? "text-white font-semibold"
                        : "text-gray-400"
                    }`}
                  >
                    Starters
                  </span>
                </div>
              </div>
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
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 mt-1">
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
                              <span>
                                Roster:{" "}
                                <span className="text-green-400">
                                  {(pick.rosterVorp || 0).toFixed(1)}
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
                  <span>
                    {showStarterPointsOnly ? "Starter" : "Total"} Points:
                  </span>
                  <span className="font-semibold">{totalFpts.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {showStarterPointsOnly ? "Starter" : "Total"} VORP
                    (Positional):
                  </span>
                  <span className="font-semibold text-cyan-400">
                    {totalVorp.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {showStarterPointsOnly ? "Starter" : "Total"} VORP
                    (Overall):
                  </span>
                  <span className="font-semibold text-yellow-400">
                    {totalVorpAll.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {showStarterPointsOnly ? "Starter" : "Total"} VORP (Roster):
                  </span>
                  <span className="font-semibold text-green-400">
                    {totalRosterVorp.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-600">
                  <span className="font-bold">
                    {showStarterPointsOnly ? "Starter" : "Total"} Value:
                  </span>
                  <span className="font-bold text-purple-400">
                    {(totalFpts + totalRosterVorp).toFixed(2)}
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
