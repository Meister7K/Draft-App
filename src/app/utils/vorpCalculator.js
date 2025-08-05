// src/utils/vorpCalculator.js

/**
 * Calculates the fantasy point baselines for each position.
 * @param {Array} availablePlayers - The list of players available to be drafted.
 * @param {Array} rosterSetup - The list of starting position slots (e.g., ['QB', 'RB', ...]).
 * @param {number} numManagers - The number of teams in the league.
 * @returns {Object} An object containing the fpts baseline for each position.
 */
export function calculateBaselines(availablePlayers, rosterSetup, numManagers) {
    if (!availablePlayers.length || !rosterSetup.length || !numManagers) {
      return { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
    }
  
    // 1. Get starter counts for each position
    const posCounts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, BN: 0 };
    rosterSetup.forEach((pos) => {
      if (pos in posCounts) {
        posCounts[pos]++;
      }
    });
  
    const totalStarters = {
      QB: posCounts.QB * numManagers,
      RB: posCounts.RB * numManagers,
      WR: posCounts.WR * numManagers,
      TE: posCounts.TE * numManagers,
    };
  
    const flexEligible = new Map();
    availablePlayers.forEach(player => {
      if (player.pos === 'RB' || player.pos === 'WR' || player.pos === 'TE') {
        flexEligible.set(player.id, player);
      }
    });
  
    // 2. Determine baselines for dedicated positions
    const baselines = {};
    for (const pos of ['QB', 'RB', 'WR', 'TE']) {
      const posPlayers = availablePlayers
        .filter((p) => p.pos === pos)
        .sort((a, b) => b.fpts - a.fpts);
      
      const lastStarterIndex = totalStarters[pos];
      const replacementPlayer = posPlayers[lastStarterIndex];
      baselines[pos] = replacementPlayer ? replacementPlayer.fpts : 0;
  
      // These dedicated starters are no longer eligible for FLEX baseline calculation
      posPlayers.slice(0, lastStarterIndex).forEach(p => flexEligible.delete(p.id));
    }
  
    // 3. Determine FLEX baseline from the remaining pool
    const totalFlexStarters = posCounts.FLEX * numManagers;
    const sortedFlexPlayers = [...flexEligible.values()].sort((a, b) => b.fpts - a.fpts);
    const replacementFlexPlayer = sortedFlexPlayers[totalFlexStarters];
    baselines['FLEX'] = replacementFlexPlayer ? replacementFlexPlayer.fpts : 0;

    
  // 4. Determine Global Baseline
const totalStartersCount = totalStarters.QB + totalStarters.RB + totalStarters.WR + totalStarters.TE + totalFlexStarters;
const globalReplacementPlayer = availablePlayers
    .sort((a, b) => b.fpts - a.fpts)[totalStartersCount];

baselines['GLOBAL'] = globalReplacementPlayer ? globalReplacementPlayer.fpts : 0;

return baselines;
  }