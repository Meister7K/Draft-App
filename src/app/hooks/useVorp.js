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
    // Guard clause to prevent running with incomplete data
    if (!players.length || !managers.length || !rosterSetup.length || !draftOrder || !playerMap.size) {
      return { rankedPlayers: [], baselines: {} };
    }

    const pickedPlayerIds = new Set(picks.map((p) => p.player_id));
    const availablePlayers = players.filter(p => p && !pickedPlayerIds.has(p.id));
    const baselines = calculateBaselines(availablePlayers, rosterSetup, managers.length);

    // --- Determine the current picker and their roster ---
    const currentPickNumber = picks.length + 1;
    const currentPickerId = Object.keys(draftOrder).find(key => draftOrder[key] === ((currentPickNumber -1) % managers.length) + 1);
    
    const currentPickerRoster = picks
        .filter(p => p.picked_by === currentPickerId)
        .map(p => playerMap.get(p.player_id))
        .filter(Boolean);

    // --- Calculate starter counts from roster setup ---
    const starterCounts = {};
    rosterSetup.forEach(pos => {
      if (pos !== 'BN') {
        starterCounts[pos] = (starterCounts[pos] || 0) + 1;
      }
    });

    const rankedPlayers = availablePlayers.map(player => {
      if (!player || !player.pos) return null;

      // --- Standard VORP Calculations ---
      let positionalBaseline = baselines[player.pos] || 0;
      if (['RB', 'WR', 'TE'].includes(player.pos)) {
        positionalBaseline = Math.max(positionalBaseline, baselines['FLEX']);
      }
      const vorp = player.fpts - positionalBaseline;
      const vorpAll = player.fpts - (baselines['GLOBAL'] || 0);

      // --- Roster-Specific VORP Calculation ---
      let rosterVorp = 0;
      const playersAtPos = currentPickerRoster.filter(p => p.pos === player.pos);
      const numStartersForPos = starterCounts[player.pos] || 0;

      if (playersAtPos.length < numStartersForPos) {
        // Fills an empty starting spot. Value is vs. a replacement-level player.
        rosterVorp = player.fpts - positionalBaseline;
      } else {
        // Starting spots are full. Value is the upgrade over the worst starter.
        const sortedPlayersAtPos = [...playersAtPos].sort((a, b) => b.fpts - a.fpts);
        const worstStarter = sortedPlayersAtPos[numStartersForPos - 1];
        rosterVorp = worstStarter ? player.fpts - worstStarter.fpts : 0;
      }

      return { ...player, vorp, vorpAll, rosterVorp };
    }).filter(Boolean).sort((a, b) => b.rosterVorp - a.rosterVorp); // Default sort by Roster VORP

    return { rankedPlayers, baselines };

  }, [players, picks, managers, rosterSetup, draftOrder, playerMap]);

  return vorpData;
};
