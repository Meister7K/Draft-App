"use client";

import { useState, useMemo, useRef } from "react";

const MonteCarloSimulation = ({
  playerData,
  currentPicks,
  leagueData,
  leagueUsers,
  draftData,
}) => {
  const [numSimulations, setNumSimulations] = useState(1000);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hoveredPick, setHoveredPick] = useState(null);
  const [useCurrentDraftData, setUseCurrentDraftData] = useState(true);

  const managers = leagueUsers;
  const league = leagueData.selectedLeague;
  const rosterSetup = league.roster_positions;
  const rosterCarouselRef = useRef(null);

  const managerIdMap = {};
  managers.forEach((manager) => {
    managerIdMap[String(manager.user_id)] = String(manager.user_id);
  });

  const fallbackDraftOrder = {
    "863476197265354752": 6,
    "873581177716563968": 8,
    "990409125953622016": 1,
    "992120789191192576": 3,
    "994684782980169728": 7,
    "996177809884266496": 5,
    "996205199675052032": 4,
    "1000906345878560768": 2,
  };

  console.log(playerData);
  console.log(draftData.draft_order);

  let draftOrder;
  if (draftData.draft_order) {
    draftOrder = {};
    Object.entries(draftData.draft_order).forEach(([key, value]) => {
      const stringKey = String(key);
      const matchingManagerId = managers.find((m) => {
        const managerId = String(m.user_id);
        return (
          managerId === stringKey ||
          Math.abs(Number(managerId) - Number(stringKey)) < 1000
        );
      })?.user_id;

      if (matchingManagerId) {
        draftOrder[String(matchingManagerId)] = value;
      }
    });
  } else {
    draftOrder = fallbackDraftOrder;
  }
  const draftType = draftData.type;
  const numManagers = managers.length;
  const currentPickNumber = currentPicks.length + 1;

  const totalPicks = useMemo(() => {
    return rosterSetup.length * numManagers;
  }, [rosterSetup, numManagers]);

  const draftedPlayerIds = useMemo(() => {
    return new Set(currentPicks.map((pick) => pick.player_id));
  }, [currentPicks]);

  const getDraftingTeamAtPick = (pickNumber) => {
    if (!draftOrder || !numManagers) {
      return null;
    }

    const round = Math.ceil(pickNumber / numManagers);
    const pickInRound = (pickNumber - 1) % numManagers;
    let draftSlot;

    if (draftType === "snake" && round % 2 === 0) {
      draftSlot = numManagers - pickInRound;
    } else {
      draftSlot = pickInRound + 1;
    }

    const teamId = Object.keys(draftOrder).find(
      (key) => draftOrder[key] === draftSlot
    );

    return teamId;
  };

  const calculateRosterNeeds = (roster, rosterSetup) => {
    const needs = {};
    rosterSetup.forEach((pos) => {
      needs[pos] = (needs[pos] || 0) + 1;
    });

    roster.forEach((pick) => {
      if (pick.player_id && playerData) {
        const player = playerData.find((p) => p.id === pick.player_id);
        if (player) {
          const pos = player.pos;
          if (needs[pos] > 0) {
            needs[pos]--;
          } else if (needs["FLEX"] > 0 && ["RB", "WR", "TE"].includes(pos)) {
            needs["FLEX"]--;
          } else if (needs["BN"] > 0) {
            needs["BN"]--;
          }
        }
      }
    });

    return needs;
  };

  const calculatePositionPreferences = (needs, availablePlayers) => {
    const preferences = [];

    Object.entries(needs).forEach(([position, count]) => {
      if (count > 0) {
        let availableCount;
        if (position === "FLEX") {
          availableCount = availablePlayers.filter((p) =>
            ["RB", "WR", "TE"].includes(p.pos)
          ).length;
        } else if (position === "BN") {
          availableCount = availablePlayers.length;
        } else {
          availableCount = availablePlayers.filter(
            (p) => p.pos === position
          ).length;
        }

        const scarcityMultiplier =
          availableCount > 0 ? count / availableCount : count;
        const baseWeight = position === "BN" ? 0.1 : 1.0;
        const weight = Math.min(scarcityMultiplier * baseWeight * 100, 100);

        if (weight > 0) {
          preferences.push({ position, weight, count });
        }
      }
    });

    return preferences.sort((a, b) => b.weight - a.weight);
  };

  const weightedRandomSelect = (preferences) => {
    const totalWeight = preferences.reduce((sum, pref) => sum + pref.weight, 0);
    let random = Math.random() * totalWeight;

    for (const pref of preferences) {
      random -= pref.weight;
      if (random <= 0) {
        return pref.position;
      }
    }

    return preferences[0]?.position || "BN";
  };

  const organizeRoster = (roster) => {
    if (!roster || !Array.isArray(roster)) return [];

    const rosterSlots = new Array(rosterSetup.length).fill(null);
    const unassignedPlayers = [...roster];

    rosterSetup.forEach((slotPos, index) => {
      if (slotPos !== "FLEX" && slotPos !== "BN") {
        const playerIndex = unassignedPlayers.findIndex((pick) => {
          if (!pick || !pick.player_id || !playerData) return false;
          const player = playerData.find((p) => p.id === pick.player_id);
          return player && player.pos === slotPos;
        });
        if (playerIndex !== -1) {
          rosterSlots[index] = unassignedPlayers.splice(playerIndex, 1)[0];
        }
      }
    });

    rosterSetup.forEach((slotPos, index) => {
      if (slotPos === "FLEX" && !rosterSlots[index]) {
        const playerIndex = unassignedPlayers.findIndex((pick) => {
          if (!pick || !pick.player_id || !playerData) return false;
          const player = playerData.find((p) => p.id === pick.player_id);
          return player && ["RB", "WR", "TE"].includes(player.pos);
        });
        if (playerIndex !== -1) {
          rosterSlots[index] = unassignedPlayers.splice(playerIndex, 1)[0];
        }
      }
    });

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

  const calculateRosterScore = (roster) => {
    if (!roster || !Array.isArray(roster)) return 0;

    const organizedRoster = organizeRoster(roster);
    let totalScore = 0;

    organizedRoster.forEach((pick, index) => {
      if (pick && pick.player_id && playerData && Array.isArray(playerData)) {
        const player = playerData.find((p) => p.id === pick.player_id);
        const slotPosition = rosterSetup[index];

        if (player && slotPosition !== "BN") {
          totalScore += player.fpts || 0;
        }
      }
    });

    return totalScore;
  };

  const calculateDetailedRosterScore = (roster) => {
    if (!roster || !Array.isArray(roster))
      return { activePoints: 0, benchPoints: 0, totalPoints: 0 };

    const organizedRoster = organizeRoster(roster);
    let activePoints = 0;
    let benchPoints = 0;

    organizedRoster.forEach((pick, index) => {
      if (pick && pick.player_id && playerData && Array.isArray(playerData)) {
        const player = playerData.find((p) => p.id === pick.player_id);
        const slotPosition = rosterSetup[index];

        if (player) {
          const points = player.fpts || 0;
          if (slotPosition === "BN") {
            benchPoints += points;
          } else {
            activePoints += points;
          }
        }
      }
    });

    return {
      activePoints,
      benchPoints,
      totalPoints: activePoints + benchPoints,
    };
  };

  const calculateReplacementValues = (allPlayers) => {
    const replacementValues = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
    };

    const qbPlayers = allPlayers
      .filter((p) => p.pos === "QB")
      .sort((a, b) => (b.fpts || 0) - (a.fpts || 0));
    const rbPlayers = allPlayers
      .filter((p) => p.pos === "RB")
      .sort((a, b) => (b.fpts || 0) - (a.fpts || 0));
    const wrPlayers = allPlayers
      .filter((p) => p.pos === "WR")
      .sort((a, b) => (b.fpts || 0) - (a.fpts || 0));
    const tePlayers = allPlayers
      .filter((p) => p.pos === "TE")
      .sort((a, b) => (b.fpts || 0) - (a.fpts || 0));

    const qbSlots = rosterSetup.filter((p) => p === "QB").length;
    const rbSlots = rosterSetup.filter((p) => p === "RB").length;
    const wrSlots = rosterSetup.filter((p) => p === "WR").length;
    const teSlots = rosterSetup.filter((p) => p === "TE").length;
    const flexSlots = rosterSetup.filter((p) => p === "FLEX").length;

    const qbReplacementIndex = Math.min(
      qbSlots * numManagers,
      qbPlayers.length - 1
    );
    const rbReplacementIndex = Math.min(
      rbSlots * numManagers + flexSlots * numManagers,
      rbPlayers.length - 1
    );
    const wrReplacementIndex = Math.min(
      wrSlots * numManagers + flexSlots * numManagers,
      wrPlayers.length - 1
    );
    const teReplacementIndex = Math.min(
      teSlots * numManagers + flexSlots * numManagers,
      tePlayers.length - 1
    );

    replacementValues.QB = qbPlayers[qbReplacementIndex]?.fpts || 0;
    replacementValues.RB = rbPlayers[rbReplacementIndex]?.fpts || 0;
    replacementValues.WR = wrPlayers[wrReplacementIndex]?.fpts || 0;
    replacementValues.TE = tePlayers[teReplacementIndex]?.fpts || 0;

    return replacementValues;
  };

  // Main simulation function
  // ... (rest of the component remains the same)

  const runSimulation = async () => {
    if (!playerData || !Array.isArray(playerData) || isRunning) return;

    if (!useCurrentDraftData && currentPickNumber > totalPicks) {
      return;
    }

    setIsRunning(true);
    setSimulationResults(null);

    try {
      const allSimulationResults = [];
      const rosterScores = {};
      const detailedRosterScores = {};
      const managerWins = {};

      managers.forEach((manager) => {
        const managerId = String(manager.user_id);
        rosterScores[managerId] = [];
        detailedRosterScores[managerId] = [];
        managerWins[managerId] = 0;
      });

      const replacementValues = calculateReplacementValues(playerData);

      // Determine starting point based on useCurrentDraftData
      const startingPickNumber = useCurrentDraftData ? currentPickNumber : 1;
      const initialDraftedIds = useCurrentDraftData
        ? draftedPlayerIds
        : new Set();

      for (let sim = 0; sim < numSimulations; sim++) {
        let availablePlayersInSim = playerData
          .filter(
            (player) => player && player.id && !initialDraftedIds.has(player.id)
          )
          .map((player) => {
            const vorp =
              (player.fpts || 0) - (replacementValues[player.pos] || 0);
            const vorpWeight = 0.4; // Lowered VORP weight from 1.0 to 0.3
            const fptsWeight = 0.6; // Increased fantasy points weight
            const weightedScore =
              vorp * vorpWeight + (player.fpts || 0) * fptsWeight;
            return {
              ...player,
              vorp: vorp,
              weightedScore: weightedScore,
            };
          })
          .sort((a, b) => (b.weightedScore || 0) - (a.weightedScore || 0));

        const teamRosters = {};
        managers.forEach((manager) => {
          const currentRoster = useCurrentDraftData
            ? currentPicks.filter(
                (p) => p && p.picked_by === String(manager.user_id)
              )
            : [];
          teamRosters[String(manager.user_id)] = {
            picks: [...currentRoster],
            needs: calculateRosterNeeds(currentRoster, rosterSetup),
          };
        });

        const thisSimulationPicks = {};

        for (
          let pickNum = startingPickNumber;
          pickNum <= totalPicks;
          pickNum++
        ) {
          const currentlyAvailable = availablePlayersInSim;
          if (currentlyAvailable.length === 0) {
            break;
          }

          const pickingTeamId = String(getDraftingTeamAtPick(pickNum));
          if (
            !pickingTeamId ||
            pickingTeamId === "null" ||
            !teamRosters[pickingTeamId]
          ) {
            continue;
          }

          const pickingTeamNeeds = teamRosters[pickingTeamId].needs;
          const currentRound = Math.ceil(pickNum / numManagers);

          const positionPreferences = calculatePositionPreferences(
            pickingTeamNeeds,
            currentlyAvailable
          );

          let selectedIndex = -1;

          if (currentRound >= 3 && positionPreferences.length > 0) {
            if (Math.random() < 0.7) {
              const selectedPosition =
                weightedRandomSelect(positionPreferences);
              const positionPlayers = currentlyAvailable.filter((player) => {
                if (selectedPosition === "FLEX") {
                  return ["RB", "WR", "TE"].includes(player.pos);
                }
                return player.pos === selectedPosition;
              });

              if (positionPlayers.length > 0) {
                const exponentialFactor = 9.5;
                const normalizedRand = Math.pow(
                  Math.random(),
                  exponentialFactor
                );
                const positionIndex = Math.floor(
                  normalizedRand * positionPlayers.length
                );
                const selectedPlayer = positionPlayers[positionIndex];
                selectedIndex = currentlyAvailable.findIndex(
                  (p) => p.id === selectedPlayer.id
                );
              } else {
                const exponentialFactor = 9.5;
                const normalizedRand = Math.pow(
                  Math.random(),
                  exponentialFactor
                );
                selectedIndex = Math.floor(
                  normalizedRand * currentlyAvailable.length
                );
              }
            } else {
              const exponentialFactor = 9.5;
              const normalizedRand = Math.pow(Math.random(), exponentialFactor);
              selectedIndex = Math.floor(
                normalizedRand * currentlyAvailable.length
              );
            }
          } else {
            const exponentialFactor = 9.5;
            const normalizedRand = Math.pow(Math.random(), exponentialFactor);
            selectedIndex = Math.floor(
              normalizedRand * currentlyAvailable.length
            );
          }

          selectedIndex = Math.max(
            0,
            Math.min(selectedIndex, currentlyAvailable.length - 1)
          );

          const selectedPlayer = currentlyAvailable[selectedIndex];
          if (!selectedPlayer) continue;

          const pick = {
            player_id: selectedPlayer.id,
            picked_by: String(pickingTeamId),
            pick_no: pickNum,
          };

          thisSimulationPicks[pickNum] = {
            playerId: selectedPlayer.id,
            playerName: selectedPlayer.name,
            playerPos: selectedPlayer.pos,
            teamId: pickingTeamId,
          };

          teamRosters[pickingTeamId].picks.push(pick);
          teamRosters[pickingTeamId].needs = calculateRosterNeeds(
            teamRosters[pickingTeamId].picks,
            rosterSetup
          );

          if (selectedIndex > -1) {
            availablePlayersInSim.splice(selectedIndex, 1);
          }
        }

        let highestScore = 0;
        let winningManagerId = null;

        managers.forEach((manager) => {
          const managerId = String(manager.user_id);
          const finalRoster = teamRosters[managerId]?.picks || [];
          const score = calculateRosterScore(finalRoster);
          const detailedScore = calculateDetailedRosterScore(finalRoster);
          const validScore = isNaN(score) ? 0 : score;

          rosterScores[managerId].push(validScore);
          detailedRosterScores[managerId].push(detailedScore);

          if (validScore > highestScore) {
            highestScore = validScore;
            winningManagerId = managerId;
          }
        });

        if (winningManagerId) {
          managerWins[winningManagerId]++;
        }

        allSimulationResults.push({
          picks: thisSimulationPicks,
          scores: Object.fromEntries(
            managers.map((m) => [
              String(m.user_id),
              calculateRosterScore(teamRosters[String(m.user_id)]?.picks || []),
            ])
          ),
          winner: winningManagerId,
        });

        if ((sim + 1) % 100 === 0) {
          setProgress(((sim + 1) / numSimulations) * 100);
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }

      const processedResults = {
        pickProbabilities: {},
        rosterAnalysis: {},
        winProbabilities: {},
        sampleRoster: {},
      };

      const pickCounts = {};
      allSimulationResults.forEach((simulation) => {
        Object.entries(simulation.picks).forEach(([pickNum, pickData]) => {
          if (!pickCounts[pickNum]) pickCounts[pickNum] = {};
          pickCounts[pickNum][pickData.playerId] =
            (pickCounts[pickNum][pickData.playerId] || 0) + 1;
        });
      });

      Object.entries(pickCounts).forEach(([pickNum, playerCounts]) => {
        const sortedPlayers = Object.entries(playerCounts)
          .map(([playerId, count]) => {
            const player = playerData.find((p) => p.id === playerId);
            return {
              player,
              count,
              probability: (count / numSimulations) * 100,
            };
          })
          .filter(({ player }) => player)
          .sort((a, b) => b.count - a.count);

        processedResults.pickProbabilities[pickNum] = {
          topPick: sortedPlayers[0] || null,
          runnerUp: sortedPlayers[1] || null,
          allPicks: sortedPlayers,
        };
      });

      // ** Corrected Logic to build the most probable roster **
      const mostProbableRosters = {};
      const draftedPlayerIdsForProbableRoster = new Set(
        currentPicks.map((p) => p.player_id)
      );
      const availablePlayersForProbableRoster = [
        ...playerData.filter((p) => !draftedPlayerIds.has(p.id)),
      ];

      managers.forEach((manager) => {
        mostProbableRosters[String(manager.user_id)] = {
          picks: [
            ...currentPicks.filter(
              (p) => p.picked_by === String(manager.user_id)
            ),
          ],
        };
      });

      for (let pickNum = currentPickNumber; pickNum <= totalPicks; pickNum++) {
        const pickingTeamId = getDraftingTeamAtPick(pickNum);
        if (!pickingTeamId) continue;
        const currentTeamPicks = mostProbableRosters[pickingTeamId].picks;
        const currentTeamNeeds = calculateRosterNeeds(
          currentTeamPicks,
          rosterSetup
        );

        const pickProbabilityData =
          processedResults.pickProbabilities[pickNum]?.allPicks || [];
        let selectedPlayer = null;

        // 1. Try to find a player from the probability data that fits a need and is available
        const preferredPositions = Object.entries(currentTeamNeeds)
          .filter(([, count]) => count > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([pos]) => pos);

        for (const probablePick of pickProbabilityData) {
          const player = probablePick.player;
          if (player && !draftedPlayerIdsForProbableRoster.has(player.id)) {
            // Check if player's position matches a need
            if (preferredPositions.includes(player.pos)) {
              selectedPlayer = player;
              break;
            }
            // Also check for FLEX
            if (
              preferredPositions.includes("FLEX") &&
              ["RB", "WR", "TE"].includes(player.pos)
            ) {
              selectedPlayer = player;
              break;
            }
            // Check for BN
            if (preferredPositions.includes("BN")) {
              selectedPlayer = player;
              break;
            }
          }
        }

        // 2. If no probable pick fits the need, use a smarter fallback
        if (!selectedPlayer) {
          for (const pos of preferredPositions) {
            const positionPlayers = availablePlayersForProbableRoster.filter(
              (p) => p.pos === pos
            );
            if (pos === "FLEX") {
              const flexPlayers = availablePlayersForProbableRoster.filter(
                (p) => ["RB", "WR", "TE"].includes(p.pos)
              );
              selectedPlayer = flexPlayers.sort((a, b) => b.fpts - a.fpts)[0];
            } else if (pos === "BN") {
              selectedPlayer = availablePlayersForProbableRoster.sort(
                (a, b) => b.fpts - a.fpts
              )[0];
            } else {
              selectedPlayer = positionPlayers.sort(
                (a, b) => b.fpts - a.fpts
              )[0];
            }

            if (selectedPlayer) break;
          }
        }

        // 3. Final fallback: If all else fails, pick best available overall
        if (!selectedPlayer) {
          selectedPlayer = availablePlayersForProbableRoster.sort(
            (a, b) => b.fpts - a.fpts
          )[0];
        }

        if (selectedPlayer) {
          mostProbableRosters[pickingTeamId].picks.push({
            player_id: selectedPlayer.id,
            picked_by: pickingTeamId,
            pick_no: pickNum,
          });
          draftedPlayerIdsForProbableRoster.add(selectedPlayer.id);
          const indexToRemove = availablePlayersForProbableRoster.findIndex(
            (p) => p.id === selectedPlayer.id
          );
          if (indexToRemove > -1) {
            availablePlayersForProbableRoster.splice(indexToRemove, 1);
          }
        }
      }

      managers.forEach((manager) => {
        const managerId = String(manager.user_id);
        const simRoster = mostProbableRosters[managerId]?.picks || [];
        const organizedRoster = organizeRoster(simRoster);
        const detailedScore = calculateDetailedRosterScore(simRoster);
        processedResults.sampleRoster[managerId] = {
          roster: organizedRoster,
          pickProbabilities: {},
          detailedScore,
        };
      });
      // ** End of corrected logic **

      managers.forEach((manager) => {
        const managerId = String(manager.user_id);
        const scores = rosterScores[managerId] || [];
        const detailedScores = detailedRosterScores[managerId] || [];
        const validScores = scores.filter((score) => !isNaN(score));
        const avgScore =
          validScores.length > 0
            ? validScores.reduce((sum, score) => sum + score, 0) /
              validScores.length
            : 0;
        const maxScore = validScores.length > 0 ? Math.max(...validScores) : 0;
        const minScore = validScores.length > 0 ? Math.min(...validScores) : 0;
        const winRate = (managerWins[managerId] / numSimulations) * 100;

        // Calculate average detailed scores
        const avgActivePoints =
          detailedScores.length > 0
            ? detailedScores.reduce(
                (sum, score) => sum + score.activePoints,
                0
              ) / detailedScores.length
            : 0;
        const avgBenchPoints =
          detailedScores.length > 0
            ? detailedScores.reduce(
                (sum, score) => sum + score.benchPoints,
                0
              ) / detailedScores.length
            : 0;

        processedResults.rosterAnalysis[managerId] = {
          manager,
          avgScore,
          avgActivePoints,
          avgBenchPoints,
          maxScore,
          minScore,
          winRate,
          scores: validScores,
          detailedScores,
        };
        processedResults.winProbabilities[managerId] = winRate;
      });

      setSimulationResults(processedResults);
      setProgress(100);
    } catch (error) {
      console.error("Simulation error:", error);
      alert("Simulation failed: " + error.message);
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  };

  const handleScroll = (direction) => {
    if (rosterCarouselRef.current) {
      const scrollAmount = 300;
      if (direction === "next") {
        rosterCarouselRef.current.scrollBy({
          left: scrollAmount,
          behavior: "smooth",
        });
      } else {
        rosterCarouselRef.current.scrollBy({
          left: -scrollAmount,
          behavior: "smooth",
        });
      }
    }
  };

  const nextPicks = useMemo(() => {
    const picks = [];
    for (
      let i = currentPickNumber;
      i < Math.min(currentPickNumber + 10, totalPicks + 1);
      i++
    ) {
      const managerId = String(getDraftingTeamAtPick(i));
      const manager = managers.find((m) => String(m.user_id) === managerId);
      picks.push({
        pickNumber: i,
        manager,
        round: Math.ceil(i / numManagers),
      });
    }
    return picks;
  }, [
    currentPickNumber,
    totalPicks,
    managers,
    getDraftingTeamAtPick,
    numManagers,
  ]);

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">
          Monte Carlo Draft Simulation
        </h2>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              isMinimized ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
          <span>{isMinimized ? "Expand" : "Minimize"}</span>
        </button>
      </div>

      {!isMinimized && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-white font-medium">Simulations:</label>
              <select
                value={numSimulations}
                onChange={(e) => setNumSimulations(Number(e.target.value))}
                disabled={isRunning}
                className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
              >
                <option value={100}>100 (Fast)</option>
                <option value={500}>500 (Balanced)</option>
                <option value={1000}>1,000 (Accurate)</option>
                <option value={2500}>2,500 (High Precision)</option>
                <option value={10000}>10,000 (Very High Precision)</option>
                <option value={50000}>50,000 (Maximum Precision)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center space-x-2 text-white">
                <input
                  type="checkbox"
                  checked={useCurrentDraftData}
                  onChange={(e) => setUseCurrentDraftData(e.target.checked)}
                  disabled={isRunning}
                  className="rounded"
                />
                <span>Use Current Draft Data</span>
              </label>
            </div>

            <button
              onClick={runSimulation}
              disabled={
                isRunning || !playerData || currentPickNumber > totalPicks
              }
              className={`px-6 py-2 rounded font-medium transition-colors ${
                isRunning || !playerData || currentPickNumber > totalPicks
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {isRunning
                ? `Running Simulation... ${progress.toFixed(0)}%`
                : currentPickNumber > totalPicks
                ? "Draft Complete"
                : useCurrentDraftData
                ? "Run Monte Carlo with Current Draft"
                : "Run Perfect Draft Simulation"}
            </button>

            {simulationResults && (
              <div className="text-green-400 font-medium">
                ✓ Completed {numSimulations} simulations
                {useCurrentDraftData
                  ? " with current draft data"
                  : " from scratch"}
              </div>
            )}
          </div>

          {/* Info box explaining the modes */}
          <div className="mb-4 bg-gray-700 p-3 rounded-lg border border-gray-600">
            <div className="text-sm text-gray-300">
              <strong className="text-white">
                {useCurrentDraftData
                  ? "Current Draft Mode:"
                  : "Perfect Draft Mode:"}
              </strong>{" "}
              {useCurrentDraftData
                ? "Simulates the rest of the draft from the current state, incorporating all picks made so far. Shows what could happen next."
                : "Simulates a perfect draft from the beginning, ignoring current picks. Shows optimal draft scenarios."}
            </div>
          </div>

          <div className="mb-6 bg-gray-700 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-3">
              Upcoming Picks
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {nextPicks.slice(0, 10).map((pick) => (
                <div
                  key={pick.pickNumber}
                  className="bg-gray-600 p-3 rounded text-center"
                >
                  <div className="text-cyan-400 font-bold">
                    #{pick.pickNumber}
                  </div>
                  <div className="text-white text-sm font-medium">
                    {pick.manager?.display_name || "Unknown"}
                  </div>
                  <div className="text-gray-300 text-xs">
                    Round {pick.round}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {simulationResults && (
            <div className="space-y-6">
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-white mb-4">
                  {useCurrentDraftData
                    ? "Sample Rosters (Current Draft + Projections)"
                    : "Sample Projected Rosters (Most Probable Outcome)"}
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleScroll("prev")}
                    className="p-2 bg-gray-600 hover:bg-gray-500 rounded-full text-white transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <div
                    ref={rosterCarouselRef}
                    className="flex flex-grow overflow-x-auto snap-x snap-mandatory gap-4 pb-4 scrollbar-hide"
                  >
                    {Object.values(simulationResults.rosterAnalysis).map(
                      (analysis) => (
                        <div
                          key={analysis.manager.user_id}
                          className="flex-shrink-0 w-80 bg-gray-600 p-3 rounded snap-center"
                        >
                          <div className="text-white font-bold mb-3 text-center">
                            {analysis.manager.display_name}
                          </div>
                          <div className="space-y-1 text-sm">
                            {rosterSetup.map((position, index) => {
                              const rosterData =
                                simulationResults.sampleRoster?.[
                                  String(analysis.manager.user_id)
                                ];
                              const samplePick = rosterData?.roster?.[index];
                              const player = samplePick
                                ? playerData.find(
                                    (p) => p.id === samplePick.player_id
                                  )
                                : null;

                              // Check if this is an actual pick or projected pick
                              const isActualPick =
                                useCurrentDraftData &&
                                samplePick &&
                                currentPicks.some(
                                  (p) => p.player_id === samplePick.player_id
                                );

                              return (
                                <div
                                  key={index}
                                  className="flex justify-between items-center py-1 border-b border-gray-500"
                                >
                                  <span className="text-gray-300 font-medium">
                                    {position}:
                                  </span>
                                  <span
                                    className={`text-xs flex items-center gap-1 ${
                                      isActualPick
                                        ? "text-green-300"
                                        : "text-white"
                                    }`}
                                  >
                                    {player ? (
                                      <>
                                        <span>
                                          {player.name} ({player.pos}) #$
                                          {samplePick.pick_no || "N/A"}
                                        </span>
                                        {isActualPick && (
                                          <span className="bg-green-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                                            ACTUAL
                                          </span>
                                        )}
                                        {!isActualPick &&
                                          useCurrentDraftData && (
                                            <span className="bg-blue-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                                              PROJ
                                            </span>
                                          )}
                                      </>
                                    ) : (
                                      "TBD"
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 text-center space-y-1">
                            <div className="text-cyan-400 font-bold">
                              {simulationResults.sampleRoster?.[
                                String(analysis.manager.user_id)
                              ]?.detailedScore?.activePoints?.toFixed(1) ||
                                analysis.avgActivePoints.toFixed(1)}{" "}
                              pts
                            </div>
                            <div className="text-gray-300 text-xs">
                              Active Players
                            </div>
                            <div className="text-orange-400 font-bold">
                              {simulationResults.sampleRoster?.[
                                String(analysis.manager.user_id)
                              ]?.detailedScore?.benchPoints?.toFixed(1) ||
                                analysis.avgBenchPoints.toFixed(1)}{" "}
                              pts
                            </div>
                            <div className="text-gray-300 text-xs">
                              Bench Points
                            </div>
                            <div className="text-purple-400 font-bold text-sm border-t border-gray-500 pt-1">
                              {simulationResults.sampleRoster?.[
                                String(analysis.manager.user_id)
                              ]?.detailedScore?.totalPoints?.toFixed(1) ||
                                analysis.avgScore.toFixed(1)}{" "}
                              pts
                            </div>
                            <div className="text-gray-300 text-xs">
                              Total (
                              {useCurrentDraftData
                                ? "Current + Projected"
                                : "Projected"}
                              )
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                  <button
                    onClick={() => handleScroll("next")}
                    className="p-2 bg-gray-600 hover:bg-gray-500 rounded-full text-white transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg relative">
                <h3 className="text-lg font-bold text-white mb-4">
                  Draft Grid -{" "}
                  {useCurrentDraftData ? "Actual + Projected" : "Projected"}{" "}
                  Picks (First 9 Rounds)
                </h3>

                {useCurrentDraftData && (
                  <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-gray-300 font-medium">Legend:</span>
                    <div className="flex items-center gap-2">
                      <div className="bg-green-600 border-green-400 border-2 px-2 py-1 rounded text-white text-xs">
                        Drafted
                      </div>
                      <span className="text-gray-300">Actual picks made</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-yellow-600 border-yellow-400 border-2 px-2 py-1 rounded text-white text-xs animate-pulse">
                        On Clock
                      </div>
                      <span className="text-gray-300">Current pick</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-600 border-gray-500 border-2 px-2 py-1 rounded text-blue-300 text-xs">
                        Projected
                      </div>
                      <span className="text-gray-300">Simulated picks</span>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto overflow-y-visible relative">
                  <div className="grid grid-cols-1 gap-4">
                    {Array.from({ length: 9 }, (_, roundIndex) => {
                      const round = roundIndex + 1;
                      const roundPicks = [];

                      for (let pick = 1; pick <= numManagers; pick++) {
                        let pickNumber;
                        if (draftType === "snake" && round % 2 === 0) {
                          pickNumber =
                            (round - 1) * numManagers +
                            (numManagers - pick + 1);
                        } else {
                          pickNumber = (round - 1) * numManagers + pick;
                        }

                        const manager = managers.find(
                          (m) =>
                            String(m.user_id) ===
                            String(getDraftingTeamAtPick(pickNumber))
                        );

                        const pickData =
                          simulationResults.pickProbabilities[pickNumber];
                        const isDrafted = currentPicks.some(
                          (p) => p.pick_no === pickNumber
                        );
                        const draftedPick = currentPicks.find(
                          (p) => p.pick_no === pickNumber
                        );

                        roundPicks.push({
                          pickNumber,
                          manager,
                          pickData,
                          isDrafted,
                          draftedPick,
                        });
                      }

                      return (
                        <div key={round} className="mb-4">
                          <h4 className="text-white font-bold mb-2">
                            Round {round}
                          </h4>
                          <div
                            className="grid gap-2"
                            style={{
                              gridTemplateColumns: `repeat(${numManagers}, minmax(0, 1fr))`,
                            }}
                          >
                            {roundPicks.map(
                              (
                                {
                                  pickNumber,
                                  manager,
                                  pickData,
                                  isDrafted,
                                  draftedPick,
                                },
                                pickIndex
                              ) => {
                                const topPick = pickData?.topPick;
                                const allPicks = pickData?.allPicks || [];

                                // Calculate tooltip position based on pick position in grid
                                const isLeftSide = pickIndex < numManagers / 2;
                                const isRightSide =
                                  pickIndex >= numManagers / 2;
                                const isFirstPick = pickIndex === 0;
                                const isLastPick =
                                  pickIndex === numManagers - 1;
                                const isEarlyRound = round <= 2; // First two rounds should show tooltip below

                                // Determine tooltip positioning classes
                                let tooltipPositionClasses =
                                  "absolute w-64 bg-gray-900 border border-gray-600 rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] shadow-xl";

                                // Position tooltip to the left or right of the pick
                                if (isLeftSide) {
                                  // Left side picks - show tooltip to the right
                                  tooltipPositionClasses +=
                                    " left-full ml-2 top-0";
                                } else {
                                  // Right side picks - show tooltip to the left
                                  tooltipPositionClasses +=
                                    " right-full mr-2 top-0";
                                }

                                return (
                                  <div
                                    key={pickNumber}
                                    className={`relative p-2 rounded text-center text-xs border-2 transition-all duration-200 hover:scale-105 cursor-pointer ${
                                      isDrafted
                                        ? "bg-green-600 border-green-400"
                                        : pickNumber === currentPickNumber
                                        ? "bg-yellow-600 border-yellow-400 animate-pulse"
                                        : "bg-gray-600 border-gray-500 hover:border-gray-400"
                                    }`}
                                    onMouseEnter={() =>
                                      !isDrafted &&
                                      allPicks.length > 0 &&
                                      setHoveredPick({
                                        pickNumber,
                                        allPicks,
                                        pickIndex,
                                      })
                                    }
                                    onMouseLeave={() => setHoveredPick(null)}
                                  >
                                    <div className="font-bold text-white">
                                      #{pickNumber}
                                    </div>
                                    <div className="text-gray-200 truncate">
                                      {manager?.display_name || "Unknown"}
                                    </div>

                                    {isDrafted && draftedPick ? (
                                      <div className="mt-1">
                                        <div className="text-white font-medium truncate">
                                          {playerData.find(
                                            (p) =>
                                              p.id === draftedPick.player_id
                                          )?.name || "Unknown"}
                                        </div>
                                        <div className="text-green-200 flex items-center gap-1">
                                          <span>
                                            {playerData.find(
                                              (p) =>
                                                p.id === draftedPick.player_id
                                            )?.pos || ""}
                                          </span>
                                          <span className="bg-green-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                                            ACTUAL
                                          </span>
                                        </div>
                                      </div>
                                    ) : topPick?.player ? (
                                      <div className="mt-1">
                                        <div className="text-blue-300 font-medium truncate">
                                          {topPick.player.name}
                                        </div>
                                        <div className="text-blue-200 flex items-center gap-1">
                                          <span>
                                            {topPick.player.pos} -{" "}
                                            {topPick.probability.toFixed(0)}%
                                          </span>
                                          {useCurrentDraftData && (
                                            <span className="bg-blue-600 text-white px-1 py-0.5 rounded text-xs font-bold">
                                              PROJ
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-1 text-gray-400">
                                        No data
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Floating Tooltip - Outside Grid Structure */}
                {hoveredPick && (
                  <div
                    className="fixed w-64 bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-xl z-[9999] pointer-events-none"
                    style={{
                      left:
                        hoveredPick.pickIndex < numManagers / 2 ? "60%" : "20%",
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    <div className="text-white font-bold mb-2">
                      Pick #{hoveredPick.pickNumber} Probabilities
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {hoveredPick.allPicks.slice(0, 8).map((pick, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center text-xs"
                        >
                          <div className="text-gray-200 truncate flex-1 mr-2">
                            {pick.player.name} ({pick.player.pos})
                          </div>
                          <div className="text-green-400 font-medium">
                            {pick.probability.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                      {hoveredPick.allPicks.length > 8 && (
                        <div className="text-gray-400 text-xs text-center">
                          +{hoveredPick.allPicks.length - 8} more players
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-white mb-4">
                  Final Roster Analysis
                </h3>
                <div className="space-y-3">
                  {Object.values(simulationResults.rosterAnalysis)
                    .sort((a, b) => b.avgScore - a.avgScore)
                    .map((analysis) => (
                      <div
                        key={analysis.manager.user_id}
                        className="bg-gray-600 p-4 rounded"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-white font-bold text-lg">
                            {analysis.manager.display_name}
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-cyan-400 font-bold text-lg">
                              {analysis.avgActivePoints.toFixed(1)} pts
                            </div>
                            <div className="text-gray-300 text-sm">
                              Avg Active Points
                            </div>
                            <div className="text-orange-400 font-bold">
                              {analysis.avgBenchPoints.toFixed(1)} pts
                            </div>
                            <div className="text-gray-300 text-sm">
                              Avg Bench Points
                            </div>
                            <div className="text-purple-400 font-bold border-t border-gray-500 pt-1">
                              {analysis.avgScore.toFixed(1)} pts
                            </div>
                            <div className="text-gray-300 text-sm">
                              Total Average
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="text-center">
                            <div className="text-green-400 font-bold">
                              {analysis.winRate.toFixed(1)}%
                            </div>
                            <div className="text-gray-300">Win Rate</div>
                          </div>
                          <div className="text-center">
                            <div className="text-blue-400 font-bold">
                              {analysis.maxScore.toFixed(1)}
                            </div>
                            <div className="text-gray-300">Best Case</div>
                          </div>
                          <div className="text-center">
                            <div className="text-red-400 font-bold">
                              {analysis.minScore.toFixed(1)}
                            </div>
                            <div className="text-gray-300">Worst Case</div>
                          </div>
                          <div className="text-center">
                            <div className="text-purple-400 font-bold">
                              {(analysis.maxScore - analysis.minScore).toFixed(
                                1
                              )}
                            </div>
                            <div className="text-gray-300">Range</div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-white mb-4">
                  Championship Probabilities
                </h3>
                <div className="space-y-2">
                  {Object.entries(simulationResults.winProbabilities)
                    .map(([managerId, winRate]) => {
                      const manager = managers.find(
                        (m) => String(m.user_id) === managerId
                      );
                      return {
                        manager,
                        winRate,
                      };
                    })
                    .sort((a, b) => b.winRate - a.winRate)
                    .map((data, index) => (
                      <div
                        key={data.manager.user_id}
                        className="flex items-center gap-4"
                      >
                        <div className="w-4 text-center text-gray-300 font-bold">
                          #{index + 1}
                        </div>
                        <div className="flex-1 text-white font-medium">
                          {data.manager.display_name}
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-600 rounded-full h-6 relative">
                            <div
                              className="bg-gradient-to-r from-green-500 to-green-400 h-6 rounded-full flex items-center justify-center"
                              style={{ width: `${Math.max(data.winRate, 5)}%` }}
                            >
                              <span className="text-white text-sm font-bold">
                                {data.winRate.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 bg-blue-900 bg-opacity-50 p-4 rounded-lg border border-blue-700">
            <h4 className="text-blue-300 font-bold mb-2">How It Works</h4>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>
                • <strong>Use Current Draft Data:</strong> When enabled,
                simulates from the current draft state with actual picks. When
                disabled, simulates a perfect draft from the beginning.
              </li>
              <li>
                • Simulates thousands of complete draft scenarios using
                intelligent drafting logic
              </li>
              <li>
                • Uses roster needs and player value to determine pick
                probabilities
              </li>
              <li>
                • <strong>Visual Indicators:</strong> Green "ACTUAL" badges show
                real picks, Blue "PROJ" badges show projected picks
              </li>
              <li>
                • Analyzes final roster strength and championship probability
                for each team
              </li>
              <li>
                • Early rounds favor best available, later rounds prioritize
                positional needs
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default MonteCarloSimulation;
