"use client";

import { useMemo } from "react";

const PerfectPick = ({
  playerData,
  currentPicks,
  leagueData,
  leagueUsers,
  draftData,
  updateDraftData,
}) => {
  const managers = leagueUsers;
  const league = leagueData.selectedLeague;
  const rosterSetup = league.roster_positions;
  const draftOrder = draftData.draft_order;
  const draftType = draftData.type;
  const numManagers = managers.length;
  const currentPickNumber = currentPicks.length + 1;

  // Calculate current draft slot and who's on the clock
  const { currentDraftSlot, currentPickerId } = useMemo(() => {
    let slot;
    if (draftType === "snake" && numManagers > 0) {
      const round = Math.ceil(currentPickNumber / numManagers);
      const pickInRound = (currentPickNumber - 1) % numManagers;
      if (round % 2 === 0) {
        slot = numManagers - pickInRound;
      } else {
        slot = pickInRound + 1;
      }
    } else if (numManagers > 0) {
      slot = ((currentPickNumber - 1) % numManagers) + 1;
    }

    const pickerId = draftOrder
      ? Object.keys(draftOrder).find((key) => draftOrder[key] === slot)
      : null;

    return { currentDraftSlot: slot, currentPickerId: pickerId };
  }, [currentPickNumber, numManagers, draftType, draftOrder]);

  // Calculate optimal score for a drafted player (what their expected value was when drafted)
  const calculateOptimalScore = useMemo(() => {
    return (pick, pickNumber) => {
      if (!playerData || !pick.player_id) return 0;

      const player = playerData.find((p) => p.id === pick.player_id);
      if (!player) return 0;

      // Simulate what the draft state was at the time of this pick
      const picksAtTime = currentPicks.filter((p) => p.pick_no < pickNumber);
      const draftedAtTime = new Set(picksAtTime.map((p) => p.player_id));

      // Find who was drafting at this pick
      const draftingManagerId = pick.picked_by;
      const draftingManager = managers.find(
        (m) => m.user_id === draftingManagerId
      );
      if (!draftingManager) return 0;

      const draftPosition = draftOrder ? draftOrder[draftingManagerId] : 0;

      // Calculate their next pick after this one (same logic as current)
      let nextPickForManager;
      const startRound = Math.ceil((pickNumber + 1) / numManagers);

      if (draftType === "snake") {
        for (let round = startRound; round <= 20; round++) {
          let pickInRound;
          if (round % 2 === 1) {
            pickInRound = draftPosition;
          } else {
            pickInRound = numManagers - draftPosition + 1;
          }
          const pickNum = (round - 1) * numManagers + pickInRound;
          if (pickNum > pickNumber) {
            nextPickForManager = pickNum;
            break;
          }
        }
      } else {
        const currentRound = Math.ceil(pickNumber / numManagers);
        nextPickForManager = currentRound * numManagers + draftPosition;
        if (nextPickForManager <= pickNumber) {
          nextPickForManager += numManagers;
        }
      }

      const picksUntilNext = nextPickForManager
        ? nextPickForManager - pickNumber
        : 0;

      // Get available players at that position at the time
      const position = player.pos;
      let availablePlayers;
      if (position === "FLEX" || ["RB", "WR", "TE"].includes(position)) {
        availablePlayers = playerData
          .filter(
            (p) =>
              !draftedAtTime.has(p.id) && ["RB", "WR", "TE"].includes(p.pos)
          )
          .sort((a, b) => b.fpts - a.fpts);
      } else {
        availablePlayers = playerData
          .filter((p) => !draftedAtTime.has(p.id) && p.pos === position)
          .sort((a, b) => b.fpts - a.fpts);
      }

      if (availablePlayers.length === 0) return 0;

      // Simple expected value calculation (best available now vs average of next few)
      const bestAvailable = availablePlayers[0];
      const nextFewPlayers = availablePlayers.slice(
        1,
        Math.min(picksUntilNext + 1, availablePlayers.length)
      );
      const avgNextPoints =
        nextFewPlayers.length > 0
          ? nextFewPlayers.reduce((sum, p) => sum + p.fpts, 0) /
            nextFewPlayers.length
          : 0;

      return Math.max(0, bestAvailable.fpts - avgNextPoints);
    };
  }, [playerData, currentPicks, managers, draftOrder, draftType, numManagers]);

  // Organize roster for display (moved outside useMemo to avoid initialization issues)
  const organizeRoster = useMemo(() => {
    return (roster) => {
      const rosterSlots = new Array(rosterSetup.length).fill(null);
      const unassignedPlayers = [...roster];

      // First pass: Fill exact position matches
      rosterSetup.forEach((slotPos, index) => {
        if (slotPos !== "FLEX" && slotPos !== "BN") {
          const playerIndex = unassignedPlayers.findIndex((pick) => {
            if (!pick.player_id || !playerData) return false;
            const player = playerData.find((p) => p.id === pick.player_id);
            return player && player.pos === slotPos;
          });
          if (playerIndex !== -1) {
            rosterSlots[index] = unassignedPlayers.splice(playerIndex, 1)[0];
          }
        }
      });

      // Second pass: Fill FLEX slots
      rosterSetup.forEach((slotPos, index) => {
        if (slotPos === "FLEX" && !rosterSlots[index]) {
          const playerIndex = unassignedPlayers.findIndex((pick) => {
            if (!pick.player_id || !playerData) return false;
            const player = playerData.find((p) => p.id === pick.player_id);
            return player && ["RB", "WR", "TE"].includes(player.pos);
          });
          if (playerIndex !== -1) {
            rosterSlots[index] = unassignedPlayers.splice(playerIndex, 1)[0];
          }
        }
      });

      // Third pass: Fill bench slots
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
  }, [rosterSetup, playerData]);

  // Calculate roster summaries and position counts
  const rosterSummaries = useMemo(() => {
    const summaries = managers.map((manager) => {
      const roster = currentPicks.filter(
        (p) => p.picked_by === manager.user_id
      );
      const draftPosition = draftOrder ? draftOrder[manager.user_id] : 0;

      // Calculate picks until next turn (including for on-the-clock manager)
      let picksUntilNext = 0;
      let nextPickForManager;
      let picksUntilNextTurn = 0;

      // Calculate next pick for this manager
      const startRound = Math.ceil((currentPicks.length + 1) / numManagers);

      if (draftType === "snake") {
        // Snake draft logic - find next pick for this manager
        for (let round = startRound; round <= 20; round++) {
          let pickInRound;
          if (round % 2 === 1) {
            pickInRound = draftPosition;
          } else {
            pickInRound = numManagers - draftPosition + 1;
          }
          const pickNumber = (round - 1) * numManagers + pickInRound;

          // For on-clock manager, find their NEXT pick (not current)
          if (currentPickerId === manager.user_id) {
            if (pickNumber > currentPickNumber) {
              nextPickForManager = pickNumber;
              break;
            }
          } else {
            if (pickNumber > currentPicks.length) {
              nextPickForManager = pickNumber;
              break;
            }
          }
        }
      } else {
        // Linear draft logic
        const currentRound = Math.ceil(currentPickNumber / numManagers);
        nextPickForManager = currentRound * numManagers + draftPosition;
        if (nextPickForManager <= currentPickNumber) {
          nextPickForManager += numManagers;
        }
        // If this manager is on the clock, get their next pick after current
        if (currentPickerId === manager.user_id) {
          nextPickForManager += numManagers;
        }
      }

      picksUntilNext = nextPickForManager
        ? nextPickForManager - currentPickNumber
        : 0;
      picksUntilNextTurn = nextPickForManager
        ? nextPickForManager - currentPickNumber
        : 0;

      // For on-clock manager, adjust the display
      if (currentPickerId === manager.user_id) {
        picksUntilNext = 0; // Show 0 for display
      }

      // Count positions
      const positionCounts = {};
      rosterSetup.forEach((pos) => {
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      });

      roster.forEach((pick) => {
        if (pick.player_id && playerData) {
          const player = playerData.find((p) => p.id === pick.player_id);
          if (player) {
            const pos = player.pos;
            if (positionCounts[pos] > 0) {
              positionCounts[pos]--;
            } else if (
              positionCounts["FLEX"] > 0 &&
              ["RB", "WR", "TE"].includes(pos)
            ) {
              positionCounts["FLEX"]--;
            } else if (positionCounts["BN"] > 0) {
              positionCounts["BN"]--;
            }
          }
        }
      });

      // Calculate optimal scores and position totals for this roster
      // Use organized roster to get the actual slot positions
      const organizedRoster = organizeRoster(roster);
      const positionTotals = {};
      let totalFantasyPoints = 0; // Only active roster (non-BN)
      let totalOptimalScore = 0;

      organizedRoster.forEach((pick, index) => {
        if (pick && pick.player_id && playerData) {
          const player = playerData.find((p) => p.id === pick.player_id);
          if (player) {
            const slotPosition = rosterSetup[index]; // Use the roster slot position (QB, RB, WR, TE, FLEX, BN)
            const fantasyPoints = player.fpts || 0;
            const optimalScore = calculateOptimalScore(pick, pick.pick_no);

            // Initialize position totals if not exists
            if (!positionTotals[slotPosition]) {
              positionTotals[slotPosition] = {
                fantasyPoints: 0,
                optimalScore: 0,
                count: 0,
              };
            }

            // Add to position totals
            positionTotals[slotPosition].fantasyPoints += fantasyPoints;
            positionTotals[slotPosition].optimalScore += optimalScore;
            positionTotals[slotPosition].count += 1;

            // Add to overall totals (only non-bench players)
            if (slotPosition !== "BN") {
              totalFantasyPoints += fantasyPoints;
            }
            totalOptimalScore += optimalScore;
          }
        }
      });

      return {
        manager,
        roster,
        draftPosition,
        picksUntilNext,
        picksUntilNextTurn, // Always shows picks until next turn
        nextPickNumber: nextPickForManager,
        isOnClock: currentPickerId === manager.user_id,
        positionCounts,
        positionTotals,
        totalFantasyPoints,
        totalOptimalScore,
      };
    });

    return summaries.sort((a, b) => a.draftPosition - b.draftPosition);
  }, [
    managers,
    currentPicks,
    draftOrder,
    currentPickerId,
    currentPickNumber,
    numManagers,
    draftType,
    playerData,
    rosterSetup,
    calculateOptimalScore,
    organizeRoster,
  ]);

  // Calculate position-based draft efficiency rankings
  const rosterSummariesWithEfficiency = useMemo(() => {
    // Get all position totals for ranking
    const allPositionTotals = {};

    rosterSummaries.forEach((summary) => {
      Object.entries(summary.positionTotals).forEach(([position, totals]) => {
        if (position !== "BN") {
          // Exclude bench from efficiency calculation
          if (!allPositionTotals[position]) {
            allPositionTotals[position] = [];
          }
          allPositionTotals[position].push({
            managerId: summary.manager.user_id,
            fantasyPoints: totals.fantasyPoints,
          });
        }
      });
    });

    // Sort each position by fantasy points (highest first)
    Object.keys(allPositionTotals).forEach((position) => {
      allPositionTotals[position].sort(
        (a, b) => b.fantasyPoints - a.fantasyPoints
      );
    });

    // Calculate efficiency for each roster
    return rosterSummaries.map((summary) => {
      const positionRankings = {};
      let totalEfficiencyPoints = 0;
      let positionCount = 0;

      Object.entries(summary.positionTotals).forEach(([position, totals]) => {
        if (position !== "BN" && allPositionTotals[position]) {
          const positionRankings = allPositionTotals[position];
          const managerRank = positionRankings.findIndex(
            (item) => item.managerId === summary.manager.user_id
          );

          if (managerRank !== -1) {
            // Calculate efficiency percentage: (total_teams - rank) / (total_teams - 1) * 100
            const totalTeams = positionRankings.length;
            const efficiencyPercent =
              totalTeams > 1
                ? ((totalTeams - managerRank - 1) / (totalTeams - 1)) * 100
                : 100;

            totalEfficiencyPoints += efficiencyPercent;
            positionCount++;
          }
        }
      });

      const draftEfficiency =
        positionCount > 0 ? totalEfficiencyPoints / positionCount : 0;

      return {
        ...summary,
        draftEfficiency,
      };
    });
  }, [rosterSummaries]);

  // Get drafted player IDs for filtering
  const draftedPlayerIds = useMemo(() => {
    return new Set(currentPicks.map((pick) => pick.player_id));
  }, [currentPicks]);

  // Calculate total position needs and drafted counts across all rosters
  const positionSummary = useMemo(() => {
    // Calculate total needs across all rosters
    const totalNeeds = {};
    rosterSetup.forEach((pos) => {
      totalNeeds[pos] = (totalNeeds[pos] || 0) + numManagers;
    });

    // Calculate how many of each position have been drafted
    const draftedCounts = {};
    currentPicks.forEach((pick) => {
      if (pick.player_id && playerData) {
        const player = playerData.find((p) => p.id === pick.player_id);
        if (player) {
          draftedCounts[player.pos] = (draftedCounts[player.pos] || 0) + 1;
        }
      }
    });

    // Combine into summary object
    const summary = {};
    Object.keys(totalNeeds).forEach((pos) => {
      summary[pos] = {
        drafted: draftedCounts[pos] || 0,
        total: totalNeeds[pos],
      };
    });

    // Add any positions that have been drafted but aren't in roster setup (like K, DEF)
    Object.keys(draftedCounts).forEach((pos) => {
      if (!summary[pos]) {
        summary[pos] = {
          drafted: draftedCounts[pos],
          total: 0, // These positions aren't required in roster setup
        };
      }
    });

    return summary;
  }, [rosterSetup, numManagers, currentPicks, playerData]);

  // Get best available players by position
  const bestAvailableByPosition = useMemo(() => {
    if (!playerData || !Array.isArray(playerData)) return {};

    const availableByPosition = {};
    const availablePlayers = playerData.filter(
      (player) => !draftedPlayerIds.has(player.id)
    );

    // Handle regular positions
    availablePlayers
      .sort((a, b) => b.fpts - a.fpts) // Sort by fantasy points descending
      .forEach((player) => {
        if (!availableByPosition[player.pos]) {
          availableByPosition[player.pos] = [];
        }
        if (availableByPosition[player.pos].length < 2) {
          availableByPosition[player.pos].push(player);
        }
      });

    // Handle FLEX position - combine RB, WR, TE and get best 2 overall
    const flexEligiblePlayers = availablePlayers
      .filter((player) => ["RB", "WR", "TE"].includes(player.pos))
      .sort((a, b) => b.fpts - a.fpts)
      .slice(0, 2);

    if (flexEligiblePlayers.length > 0) {
      availableByPosition["FLEX"] = flexEligiblePlayers;
    }

    return availableByPosition;
  }, [playerData, draftedPlayerIds]);

  // Calculate worst case scenario for each position (what would be available at next turn)
  const getWorstCasePlayer = useMemo(() => {
    return (position, picksUntilNextTurn) => {
      if (!playerData || !Array.isArray(playerData) || picksUntilNextTurn <= 0)
        return null;

      let availablePlayers;
      if (position === "FLEX") {
        availablePlayers = playerData
          .filter(
            (player) =>
              !draftedPlayerIds.has(player.id) &&
              ["RB", "WR", "TE"].includes(player.pos)
          )
          .sort((a, b) => b.fpts - a.fpts);
      } else {
        availablePlayers = playerData
          .filter(
            (player) =>
              !draftedPlayerIds.has(player.id) && player.pos === position
          )
          .sort((a, b) => b.fpts - a.fpts);
      }

      // Return the player that would be available after 'picksUntilNextTurn' picks
      // This assumes other teams will draft the best available players
      const worstCaseIndex = Math.min(
        picksUntilNextTurn,
        availablePlayers.length - 1
      );
      return availablePlayers[worstCaseIndex] || null;
    };
  }, [playerData, draftedPlayerIds]);

  // Helper function to calculate roster needs for a team
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

  // Helper function to determine which team is drafting at a specific pick
  const getDraftingTeamAtPick = (pickNumber) => {
    if (!draftOrder || !numManagers) return null;

    const round = Math.ceil(pickNumber / numManagers);
    const pickInRound = (pickNumber - 1) % numManagers;
    let draftSlot;

    if (draftType === "snake" && round % 2 === 0) {
      draftSlot = numManagers - pickInRound;
    } else {
      draftSlot = pickInRound + 1;
    }

    return Object.keys(draftOrder).find((key) => draftOrder[key] === draftSlot);
  };

  // Helper function to calculate position preferences based on team needs
  const calculatePositionPreferences = (needs, availablePlayers) => {
    const preferences = [];

    Object.entries(needs).forEach(([position, count]) => {
      if (count > 0) {
        // Calculate urgency based on how many of this position are still available
        let availableCount;
        if (position === "FLEX") {
          availableCount = availablePlayers.filter((p) =>
            ["RB", "WR", "TE"].includes(p.pos)
          ).length;
        } else if (position === "BN") {
          availableCount = availablePlayers.length; // Any position can fill bench
        } else {
          availableCount = availablePlayers.filter(
            (p) => p.pos === position
          ).length;
        }

        // Higher weight = more urgent need
        // Formula: (slots_needed / available_players) * base_weight
        const scarcityMultiplier =
          availableCount > 0 ? count / availableCount : count;
        const baseWeight = position === "BN" ? 0.1 : 1.0; // Bench has lower priority
        const weight = Math.min(scarcityMultiplier * baseWeight * 100, 100); // Cap at 100

        if (weight > 0) {
          preferences.push({ position, weight, count });
        }
      }
    });

    return preferences.sort((a, b) => b.weight - a.weight);
  };

  // Helper function for weighted random selection
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

  // Advanced simulation: Calculate expected value for each position considering all possible draft outcomes
  const simulateAllDraftOutcomes = useMemo(() => {
    return (position, picksUntilNextTurn, numSimulations = 1000) => {
      if (!playerData || !Array.isArray(playerData)) {
        return null;
      }

      // Handle special case: very few picks until next turn (snake draft turns)
      if (picksUntilNextTurn <= 2) {
        // For snake draft turns, use a simpler calculation
        // Compare best available now vs best available after the few intervening picks
        let availablePlayers;
        if (position === "FLEX") {
          availablePlayers = playerData
            .filter(
              (player) =>
                !draftedPlayerIds.has(player.id) &&
                ["RB", "WR", "TE"].includes(player.pos)
            )
            .sort((a, b) => b.fpts - a.fpts);
        } else {
          availablePlayers = playerData
            .filter(
              (player) =>
                !draftedPlayerIds.has(player.id) && player.pos === position
            )
            .sort((a, b) => b.fpts - a.fpts);
        }

        if (availablePlayers.length === 0) return null;

        const bestCurrentPlayer = availablePlayers[0];

        // For very close picks, assume the next best player(s) at the position will be taken
        const nextBestIndex = Math.min(
          picksUntilNextTurn + 1,
          availablePlayers.length - 1
        );
        const expectedNextBest = availablePlayers[nextBestIndex];

        const expectedPoints = expectedNextBest ? expectedNextBest.fpts : 0;
        const expectedValue = bestCurrentPlayer.fpts - expectedPoints;

        return {
          expectedPoints: expectedPoints || 0,
          bestCurrentPoints: bestCurrentPlayer.fpts || 0,
          expectedValue: Math.max(0, expectedValue),
          simulations: 1, // Simple calculation, not simulation
          debug: {
            picksUntilNextTurn: picksUntilNextTurn || 0,
            totalAvailableForPosition: availablePlayers.length || 0,
            totalAvailableOverall:
              playerData.filter((p) => !draftedPlayerIds.has(p.id)).length || 0,
          },
        };
      }

      // Get all available players for this position
      let availablePlayers;
      if (position === "FLEX") {
        availablePlayers = playerData
          .filter(
            (player) =>
              !draftedPlayerIds.has(player.id) &&
              ["RB", "WR", "TE"].includes(player.pos)
          )
          .sort((a, b) => b.fpts - a.fpts);
      } else {
        availablePlayers = playerData
          .filter(
            (player) =>
              !draftedPlayerIds.has(player.id) && player.pos === position
          )
          .sort((a, b) => b.fpts - a.fpts);
      }

      if (availablePlayers.length === 0) return null;

      // Get all available players (for other teams to draft from)
      const allAvailablePlayers = playerData
        .filter((player) => !draftedPlayerIds.has(player.id))
        .sort((a, b) => b.fpts - a.fpts);

      let totalExpectedPoints = 0;
      const maxSimulations = Math.min(
        numSimulations,
        Math.pow(2, Math.min(picksUntilNextTurn, 10))
      ); // Cap simulations for performance

      // Run simulations
      for (let sim = 0; sim < maxSimulations; sim++) {
        const remainingPlayers = [...allAvailablePlayers];

        // Determine if we should use roster-aware logic
        // Only use it after teams have made multiple picks (round 3+)
        const currentRound = Math.ceil(currentPickNumber / numManagers);
        const useRosterAwareLogic = currentRound >= 3;

        // Track each team's roster state during simulation (only if using roster-aware logic)
        const teamRosters = {};
        if (useRosterAwareLogic) {
          managers.forEach((manager) => {
            const currentRoster = currentPicks.filter(
              (p) => p.picked_by === manager.user_id
            );
            teamRosters[manager.user_id] = {
              picks: [...currentRoster],
              needs: calculateRosterNeeds(currentRoster, rosterSetup),
            };
          });
        }

        // Simulate picks between now and next turn
        for (
          let pick = 0;
          pick < picksUntilNextTurn && remainingPlayers.length > 0;
          pick++
        ) {
          const totalPlayers = remainingPlayers.length;
          let selectedIndex;

          if (useRosterAwareLogic) {
            // ROSTER-AWARE LOGIC (Rounds 3+)
            // Determine which team is picking (simulate draft order)
            const currentSimPickNumber = currentPickNumber + pick;
            const pickingTeamId = getDraftingTeamAtPick(currentSimPickNumber);
            const pickingTeamNeeds = teamRosters[pickingTeamId]?.needs || {};

            // Calculate position preferences based on team needs
            const positionPreferences = calculatePositionPreferences(
              pickingTeamNeeds,
              remainingPlayers
            );

            // 60% chance team drafts based on positional need
            if (Math.random() < 0.6 && positionPreferences.length > 0) {
              // Select from preferred positions with weighted probability
              const selectedPosition =
                weightedRandomSelect(positionPreferences);
              const positionPlayers = remainingPlayers
                .map((player, index) => ({ player, index }))
                .filter(({ player }) => {
                  if (selectedPosition === "FLEX") {
                    return ["RB", "WR", "TE"].includes(player.pos);
                  }
                  return player.pos === selectedPosition;
                });

              if (positionPlayers.length > 0) {
                // Use exponential distribution within the preferred position
                const exponentialFactor = 2; // Slightly less aggressive within position
                const normalizedRand = Math.pow(
                  Math.random(),
                  exponentialFactor
                );
                const positionIndex = Math.floor(
                  normalizedRand * positionPlayers.length
                );
                selectedIndex = positionPlayers[positionIndex].index;
              } else {
                // Fallback to best available
                const exponentialFactor = 3;
                const normalizedRand = Math.pow(
                  Math.random(),
                  exponentialFactor
                );
                selectedIndex = Math.floor(normalizedRand * totalPlayers);
              }
            } else {
              // 40% chance team just drafts best available (BPA strategy)
              const exponentialFactor = 3;
              const normalizedRand = Math.pow(Math.random(), exponentialFactor);
              selectedIndex = Math.floor(normalizedRand * totalPlayers);
            }

            // Update the picking team's roster state
            const selectedPlayer = remainingPlayers[selectedIndex];
            if (teamRosters[pickingTeamId]) {
              teamRosters[pickingTeamId].picks.push({
                player_id: selectedPlayer.id,
                picked_by: pickingTeamId,
              });
              teamRosters[pickingTeamId].needs = calculateRosterNeeds(
                teamRosters[pickingTeamId].picks,
                rosterSetup
              );
            }
          } else {
            // EARLY ROUND LOGIC (Rounds 1-2): Mostly Best Available with some position targeting
            // 30% chance other teams target the same position we're analyzing
            const targetsOurPosition = Math.random() < 0.3;

            if (targetsOurPosition) {
              // Find best available player at our target position
              const samePositionPlayers = remainingPlayers
                .map((player, index) => ({ player, index }))
                .filter(({ player }) => {
                  if (position === "FLEX") {
                    return ["RB", "WR", "TE"].includes(player.pos);
                  }
                  return player.pos === position;
                });

              if (samePositionPlayers.length > 0) {
                // Take the best player at our position (they're already sorted by fpts)
                const targetPlayer = samePositionPlayers[0];
                selectedIndex = targetPlayer.index;
              } else {
                // Fall back to exponential distribution
                const exponentialFactor = 3;
                const normalizedRand = Math.pow(
                  Math.random(),
                  exponentialFactor
                );
                selectedIndex = Math.floor(normalizedRand * totalPlayers);
              }
            } else {
              // Use exponential distribution to heavily favor top players
              const exponentialFactor = 3;
              const normalizedRand = Math.pow(Math.random(), exponentialFactor);
              selectedIndex = Math.floor(normalizedRand * totalPlayers);
            }
          }

          // Ensure we don't go out of bounds
          selectedIndex = Math.min(selectedIndex, totalPlayers - 1);
          remainingPlayers.splice(selectedIndex, 1);
        }

        // Find best available player for our position after simulation
        const bestRemainingForPosition = remainingPlayers.find((player) => {
          if (position === "FLEX") {
            return ["RB", "WR", "TE"].includes(player.pos);
          }
          return player.pos === position;
        });

        if (bestRemainingForPosition && bestRemainingForPosition.fpts) {
          totalExpectedPoints += bestRemainingForPosition.fpts;
        } else {
          // If no player found, use 0 points (worst case)
          totalExpectedPoints += 0;
        }
      }

      const expectedPoints =
        maxSimulations > 0 ? totalExpectedPoints / maxSimulations : 0;
      const bestCurrentPlayer = availablePlayers[0];

      if (!bestCurrentPlayer || !bestCurrentPlayer.fpts) {
        return null;
      }

      return {
        expectedPoints: expectedPoints || 0,
        bestCurrentPoints: bestCurrentPlayer.fpts || 0,
        expectedValue: (bestCurrentPlayer.fpts || 0) - (expectedPoints || 0),
        simulations: maxSimulations,
        debug: {
          picksUntilNextTurn: picksUntilNextTurn || 0,
          totalAvailableForPosition: availablePlayers.length || 0,
          totalAvailableOverall: allAvailablePlayers.length || 0,
        },
      };
    };
  }, [playerData, draftedPlayerIds]);

  // Calculate position upside/priority based on opportunity cost
  const positionPriority = useMemo(() => {
    const onClockManager = rosterSummaries.find((summary) => summary.isOnClock);
    if (!onClockManager) return [];

    const priorities = [];

    Object.keys(positionSummary).forEach((position) => {
      const bestAvailable = bestAvailableByPosition[position]?.[0];
      const worstCase = getWorstCasePlayer(
        position,
        onClockManager.picksUntilNextTurn
      );

      // Run advanced simulation
      const simulation = simulateAllDraftOutcomes(
        position,
        onClockManager.picksUntilNextTurn
      );

      if (bestAvailable && worstCase && simulation) {
        const opportunityCost = bestAvailable.fpts - worstCase.fpts;
        priorities.push({
          position,
          bestPlayer: bestAvailable,
          worstCasePlayer: worstCase,
          opportunityCost,
          bestPoints: bestAvailable.fpts,
          worstCasePoints: worstCase.fpts,
          // Advanced simulation data
          expectedValue: simulation.expectedValue,
          expectedPoints: simulation.expectedPoints,
          simulations: simulation.simulations,
          confidence: simulation.simulations >= 100 ? "High" : "Low",
          debug: simulation.debug,
        });
      }
    });

    // Sort by expected value (highest first = highest priority)
    return priorities.sort((a, b) => b.expectedValue - a.expectedValue);
  }, [
    positionSummary,
    bestAvailableByPosition,
    getWorstCasePlayer,
    rosterSummaries,
    simulateAllDraftOutcomes,
  ]);

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Draft Overview</h2>
        <button
          onClick={updateDraftData}
          className="inline-flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 font-medium text-sm"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700 p-3 rounded text-center">
          <div className="text-2xl font-bold text-white">
            {rosterSummaries.length}
          </div>
          <div className="text-gray-300 text-sm">Total Rosters</div>
        </div>
        <div className="bg-gray-700 p-3 rounded text-center">
          <div className="text-2xl font-bold text-white">
            {currentPicks.length}
          </div>
          <div className="text-gray-300 text-sm">Total Picks</div>
        </div>
        <div className="bg-gray-700 p-3 rounded text-center">
          <div className="text-2xl font-bold text-white">
            {currentPickNumber}
          </div>
          <div className="text-gray-300 text-sm">Current Pick</div>
        </div>
        <div className="bg-gray-700 p-3 rounded text-center">
          <div className="text-2xl font-bold text-white">
            {Math.ceil(currentPickNumber / numManagers)}
          </div>
          <div className="text-gray-300 text-sm">Current Round</div>
        </div>
      </div>

      {/* Position Priority Ranking */}
      {positionPriority.length > 0 && (
        <div className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 p-4 rounded-lg mb-6 border border-cyan-500/30">
          <h3 className="text-lg font-bold text-cyan-300 mb-3 flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            Optimal Draft Strategy (Monte Carlo Simulation)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {positionPriority.slice(0, 6).map((priority, index) => (
              <div
                key={priority.position}
                className={`p-3 rounded-lg border ${
                  index === 0
                    ? "bg-yellow-900/30 border-yellow-500/50"
                    : index === 1
                    ? "bg-orange-900/30 border-orange-500/50"
                    : index === 2
                    ? "bg-red-900/30 border-red-500/50"
                    : "bg-gray-800/50 border-gray-600/50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span
                      className={`text-lg font-bold mr-2 ${
                        index === 0
                          ? "text-yellow-400"
                          : index === 1
                          ? "text-orange-400"
                          : index === 2
                          ? "text-red-400"
                          : "text-gray-300"
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <span
                      className={`font-bold ${
                        priority.position === "QB"
                          ? "text-red-400"
                          : priority.position === "RB"
                          ? "text-green-400"
                          : priority.position === "WR"
                          ? "text-blue-400"
                          : priority.position === "TE"
                          ? "text-orange-400"
                          : priority.position === "FLEX"
                          ? "text-purple-400"
                          : "text-gray-300"
                      }`}
                    >
                      {priority.position}
                    </span>
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      index === 0
                        ? "text-yellow-400"
                        : index === 1
                        ? "text-orange-400"
                        : index === 2
                        ? "text-red-400"
                        : "text-gray-300"
                    }`}
                  >
                    +{(priority.expectedValue || 0).toFixed(1)}
                  </div>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between text-green-300">
                    <span>Best Now:</span>
                    <span>
                      {priority.bestPlayer.name} (
                      {(priority.bestPoints || 0).toFixed(1)})
                    </span>
                  </div>
                  <div className="flex justify-between text-blue-300">
                    <span>Expected Next:</span>
                    <span>{(priority.expectedPoints || 0).toFixed(1)} pts</span>
                  </div>
                  <div className="flex justify-between text-red-300">
                    <span>Worst Case:</span>
                    <span>
                      {priority.worstCasePlayer.name} (
                      {(priority.worstCasePoints || 0).toFixed(1)})
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Simulations:</span>
                    <span>
                      {priority.simulations} ({priority.confidence})
                    </span>
                  </div>
                  {priority.debug && (
                    <div className="flex justify-between text-yellow-400 text-xs">
                      <span>Debug:</span>
                      <span>
                        {priority.debug.picksUntilNextTurn || 0} picks,{" "}
                        {priority.debug.totalAvailableForPosition || 0} avail
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-cyan-200">
            🧠 Monte Carlo simulation considers all possible draft outcomes
            between now and your next pick. Higher expected value = better
            choice to draft now vs. waiting!
          </div>
        </div>
      )}

      {/* Position Summary */}
      <div className="bg-gray-700 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-bold text-white mb-3">
          Position Summary (Drafted / Total Needed)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Object.entries(positionSummary).map(([position, counts]) => {
            // Find the on-the-clock manager for worst case calculation
            const onClockManager = rosterSummaries.find(
              (summary) => summary.isOnClock
            );
            const worstCasePlayer = onClockManager
              ? getWorstCasePlayer(position, onClockManager.picksUntilNextTurn)
              : null;

            return (
              <div key={position} className="bg-gray-600 p-3 rounded-lg">
                {/* Position Header */}
                <div className="text-center mb-3">
                  <div
                    className={`text-lg font-bold ${
                      position === "QB"
                        ? "text-red-400"
                        : position === "RB"
                        ? "text-green-400"
                        : position === "WR"
                        ? "text-blue-400"
                        : position === "TE"
                        ? "text-orange-400"
                        : position === "K"
                        ? "text-yellow-400"
                        : position === "DEF"
                        ? "text-indigo-400"
                        : "text-gray-300"
                    }`}
                  >
                    {counts.drafted} / {counts.total}
                  </div>
                  <div className="text-gray-300 text-sm font-medium">
                    {position}
                  </div>
                  {counts.total > 0 && (
                    <div className="text-xs text-gray-400">
                      {Math.round((counts.drafted / counts.total) * 100)}%
                      filled
                    </div>
                  )}
                </div>

                {/* Best Available Players */}
                <div className="space-y-2 mb-3">
                  <div className="text-xs text-gray-300 font-medium">
                    Best Available:
                  </div>
                  {bestAvailableByPosition[position] ? (
                    bestAvailableByPosition[position].map((player, index) => (
                      <div
                        key={player.id}
                        className="bg-gray-800 p-2 rounded text-xs"
                      >
                        <div className="font-medium text-white truncate">
                          {player.name}
                        </div>
                        <div className="flex justify-between text-gray-400 mt-1">
                          <span>{player.team}</span>
                          <span>{player.fpts.toFixed(1)} pts</span>
                        </div>
                        <div className="text-gray-500 text-xs">
                          ADP:{" "}
                          {player.adp === 999 ? "N/A" : player.adp.toFixed(1)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-xs text-center py-2">
                      No available players
                    </div>
                  )}
                </div>

                {/* Worst Case Scenario */}
                {onClockManager && (
                  <div className="border-t border-gray-500 pt-2">
                    <div className="text-xs text-red-300 font-medium mb-1">
                      Worst Case (Next Turn):
                    </div>
                    {worstCasePlayer ? (
                      <div className="bg-red-900/30 p-2 rounded text-xs border border-red-500/30">
                        <div className="font-medium text-red-200 truncate">
                          {worstCasePlayer.name}
                        </div>
                        <div className="flex justify-between text-red-300 mt-1">
                          <span>{worstCasePlayer.team}</span>
                          <span>{worstCasePlayer.fpts.toFixed(1)} pts</span>
                        </div>
                        <div className="text-red-400 text-xs">
                          -
                          {(
                            bestAvailableByPosition[position]?.[0]?.fpts -
                              worstCasePlayer.fpts || 0
                          ).toFixed(1)}{" "}
                          pts vs best
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-800 p-2 rounded text-xs">
                        <div className="text-gray-400">
                          No players available at next turn
                        </div>
                        <div className="text-xs text-gray-500">
                          Picks until next: {onClockManager.picksUntilNextTurn}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {rosterSummariesWithEfficiency.map((summary) => {
          const organizedRoster = organizeRoster(summary.roster);

          return (
            <div
              key={summary.manager.user_id}
              className={`bg-gray-700 rounded-lg p-4 ${
                summary.isOnClock ? "ring-2 ring-cyan-500" : ""
              }`}
            >
              {/* Manager Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-white text-lg">
                    {summary.manager.display_name}
                  </h3>
                  <div className="text-sm text-gray-300">
                    Pick #{summary.draftPosition}
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className={`text-2xl font-bold ${
                      summary.isOnClock ? "text-cyan-400" : "text-gray-300"
                    }`}
                  >
                    {summary.picksUntilNext}
                  </div>
                  <div className="text-xs text-gray-400">
                    {summary.isOnClock ? "ON CLOCK" : "picks away"}
                  </div>
                </div>
              </div>

              {/* Roster Layout */}
              <div className="space-y-2 mb-3">
                {organizedRoster.map((pick, index) => {
                  const slotPosition = rosterSetup[index];
                  const isEmpty = !pick || !pick.player_id;
                  let player = null;
                  let optimalScore = 0;

                  if (!isEmpty && playerData) {
                    player = playerData.find((p) => p.id === pick.player_id);
                    optimalScore = calculateOptimalScore(pick, pick.pick_no);
                  }

                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        isEmpty
                          ? "bg-gray-600 border-dashed border border-gray-500"
                          : "bg-gray-600"
                      }`}
                    >
                      <div className="flex items-center space-x-2 flex-grow min-w-0">
                        <span
                          className={`font-mono text-xs px-2 py-1 rounded flex-shrink-0 ${
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
                              ? "bg-gray-500 text-gray-300"
                              : "bg-slate-600 text-white"
                          }`}
                        >
                          {slotPosition}
                        </span>
                        {isEmpty ? (
                          <span className="text-gray-400 italic">Empty</span>
                        ) : (
                          <div className="flex-grow min-w-0">
                            <div className="truncate text-white">
                              {player
                                ? `${player.name} (${player.pos})`
                                : "Unknown Player"}
                            </div>
                            {player && (
                              <div className="text-xs text-gray-400 flex justify-between">
                                <span>
                                  {player.team} - {player.fpts.toFixed(1)} pts
                                </span>
                                <span className="text-cyan-400">
                                  +{optimalScore.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {!isEmpty && (
                        <div className="text-xs text-gray-400 flex-shrink-0">
                          #{pick.pick_no}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Position and Total Summaries */}
              <div className="border-t border-gray-600 pt-3 space-y-2">
                {/* Position Totals */}
                <div className="text-xs">
                  <div className="font-medium text-gray-300 mb-1">
                    Position Totals:
                  </div>
                  {Object.entries(summary.positionTotals).map(
                    ([position, totals]) => (
                      <div
                        key={position}
                        className="flex justify-between text-xs"
                      >
                        <span
                          className={`${
                            position === "QB"
                              ? "text-red-400"
                              : position === "RB"
                              ? "text-green-400"
                              : position === "WR"
                              ? "text-blue-400"
                              : position === "TE"
                              ? "text-orange-400"
                              : "text-gray-300"
                          }`}
                        >
                          {position} ({totals.count}):
                        </span>
                        <span className="text-gray-300">
                          {totals.fantasyPoints.toFixed(1)} pts
                          <span className="text-cyan-400 ml-1">
                            +{totals.optimalScore.toFixed(1)}
                          </span>
                        </span>
                      </div>
                    )
                  )}
                </div>

                {/* Overall Totals */}
                <div className="border-t border-gray-600 pt-2 text-sm">
                  <div className="flex justify-between font-medium">
                    <span className="text-white">Total Fantasy Points:</span>
                    <span className="text-white">
                      {summary.totalFantasyPoints.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-cyan-300">Total Optimal Score:</span>
                    <span className="text-cyan-300">
                      +{summary.totalOptimalScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-purple-400 border-t border-gray-600 pt-1 mt-1">
                    <span>Draft Efficiency:</span>
                    <span>{summary.draftEfficiency.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PerfectPick;
