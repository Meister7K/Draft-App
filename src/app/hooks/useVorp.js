import { useMemo } from 'react';
import { calculateBaselines } from '../utils/vorpCalculator';

/**
 * Custom hook to calculate live VORP rankings, now including roster-specific VORP.
 * @param {Array} players - The full list of all players as a flat array of objects.
 * @param {Array} picks - The list of picks that have already been made.
 * @param {Array} managers - The list of managers in the league.
 * @param {Array} rosterSetup - The list of starting position slots.
 * @param {Object} draftOrder - The mapping of pick number to manager ID.
 * @param {Map} playerMap - A map of player IDs to player objects for quick lookups.
 * @returns {Object} An object containing the VORP-ranked players and the live baselines.
 */
export const useVorp = (players, picks, managers, rosterSetup, draftOrder, playerMap) => {
  const vorpData = useMemo(() => {
    if (!players.length || !managers.length || !rosterSetup.length || !draftOrder || !playerMap.size) {
      return { rankedPlayers: [], baselines: {} };
    }

    const pickedPlayerIds = new Set(picks.map((p) => p.player_id));
    const availablePlayers = players.filter(p => p && !pickedPlayerIds.has(p.id));
    const baselines = calculateBaselines(availablePlayers, rosterSetup, managers.length);

    const currentPickNumber = picks.length + 1;
    const currentPickerId = Object.keys(draftOrder).find(key => draftOrder[key] === ((currentPickNumber -1) % managers.length) + 1);
    
    const currentPickerRoster = picks
        .filter(p => p.picked_by === currentPickerId)
        .map(p => playerMap.get(p.player_id))
        .filter(Boolean);

    const starterCounts = {};
    rosterSetup.forEach(pos => {
      if (pos !== 'BN') {
        starterCounts[pos] = (starterCounts[pos] || 0) + 1;
      }
    });

    // --- UPDATED: More robust roster VORP calculation logic ---
    const calculatePlayerRosterVorp = (testPlayer, roster) => {
        const playersAtPos = roster.filter(p => p.pos === testPlayer.pos);
        const numStartersForPos = starterCounts[testPlayer.pos] || 0;

        // Case 1: The player can fill an open dedicated starting spot
        if (playersAtPos.length < numStartersForPos) {
            return testPlayer.fpts - (baselines[testPlayer.pos] || 0);
        }

        // Case 2: The player is FLEX-eligible (RB/WR/TE)
        if (['RB', 'WR', 'TE'].includes(testPlayer.pos)) {
            const flexEligibleRoster = roster.filter(p => ['RB', 'WR', 'TE'].includes(p.pos));
            const numFlexSlots = starterCounts.FLEX || 0;
            const numDedicatedRbSlots = starterCounts.RB || 0;
            const numDedicatedWrSlots = starterCounts.WR || 0;
            const numDedicatedTeSlots = starterCounts.TE || 0;

            // Total number of players who can start in a non-FLEX spot
            const totalDedicatedStarters = numDedicatedRbSlots + numDedicatedWrSlots + numDedicatedTeSlots;

            // If the number of FLEX-eligible players on the roster is less than the total dedicated + FLEX spots,
            // then this new player can fill a starting spot (likely FLEX). Value is vs FLEX baseline.
            if (flexEligibleRoster.length < totalDedicatedStarters + numFlexSlots) {
                return testPlayer.fpts - baselines.FLEX;
            }

            // If all starter spots (dedicated + FLEX) are full, calculate upgrade value.
            // Find the worst starter among all FLEX-eligible players.
            const sortedFlexEligible = flexEligibleRoster.sort((a, b) => b.fpts - a.fpts);
            const worstStarter = sortedFlexEligible[totalDedicatedStarters + numFlexSlots - 1];
            
            if (worstStarter) {
                return testPlayer.fpts - worstStarter.fpts;
            }
        }
        
        // Case 3: Player is not FLEX-eligible (e.g., QB) and dedicated spots are full.
        // Calculate upgrade value over the worst starting QB.
        const sortedPlayersAtPos = [...playersAtPos].sort((a, b) => b.fpts - a.fpts);
        const worstStarter = sortedPlayersAtPos[numStartersForPos - 1];
        return worstStarter ? testPlayer.fpts - worstStarter.fpts : 0;
    };

    const rankedPlayers = availablePlayers.map(player => {
      if (!player || !player.pos) return null;

      const positionalBaseline = baselines[player.pos] || 0;
      const vorp = player.fpts - positionalBaseline;
      const vorpAll = player.fpts - (baselines['GLOBAL'] || 0);

      // Use the new, robust calculation for rosterVorp
      const rosterVorp = calculatePlayerRosterVorp(player, currentPickerRoster);

      return { ...player, vorp, vorpAll, rosterVorp };
    }).filter(Boolean).sort((a, b) => b.rosterVorp - a.rosterVorp);

    return { rankedPlayers, baselines };

  }, [players, picks, managers, rosterSetup, draftOrder, playerMap]);

  return vorpData;
};