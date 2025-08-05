/**
 * Calculates the fantasy point baselines for each position using a robust, starter-first model.
 * @param {Array} availablePlayers - The list of players available to be drafted.
 * @param {Array} rosterSetup - The list of starting position slots (e.g., ['QB', 'RB', ...]).
 * @param {number} numManagers - The number of teams in the league.
 * @returns {Object} An object containing the fpts baseline for each position.
 */
export function calculateBaselines(availablePlayers, rosterSetup, numManagers) {
  if (!availablePlayers.length || !rosterSetup.length || !numManagers) {
    return { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, GLOBAL: 0 };
  }

  // 1. Get starter counts for each position from the roster setup.
  const posCounts = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0 };
  rosterSetup.forEach((pos) => {
    if (pos in posCounts) {
      posCounts[pos]++;
    }
  });

  const totalStartersByPos = {
    QB: posCounts.QB * numManagers,
    RB: posCounts.RB * numManagers,
    WR: posCounts.WR * numManagers,
    TE: posCounts.TE * numManagers,
    FLEX: posCounts.FLEX * numManagers,
  };

  // Sort players by position once to avoid re-sorting.
  const playersByPos = {
    QB: availablePlayers
      .filter((p) => p.pos === "QB")
      .sort((a, b) => b.fpts - a.fpts),
    RB: availablePlayers
      .filter((p) => p.pos === "RB")
      .sort((a, b) => b.fpts - a.fpts),
    WR: availablePlayers
      .filter((p) => p.pos === "WR")
      .sort((a, b) => b.fpts - a.fpts),
    TE: availablePlayers
      .filter((p) => p.pos === "TE")
      .sort((a, b) => b.fpts - a.fpts),
  };

  // 2. Identify the definitive set of all starters in the league.
  const leagueStarters = new Set();
  const flexPool = [];

  // First, fill the dedicated starting spots.
  for (const pos of ["QB", "RB", "WR", "TE"]) {
    const startersForPos = playersByPos[pos].slice(0, totalStartersByPos[pos]);
    const remainingForPos = playersByPos[pos].slice(totalStartersByPos[pos]);

    startersForPos.forEach((player) => leagueStarters.add(player.id));

    // Add remaining RBs, WRs, and TEs to the FLEX pool.
    if (["RB", "WR", "TE"].includes(pos)) {
      flexPool.push(...remainingForPos);
    }
  }

  // 3. Now, fill the FLEX spots from the best remaining players.
  flexPool.sort((a, b) => b.fpts - a.fpts);
  const flexStarters = flexPool.slice(0, totalStartersByPos.FLEX);
  flexStarters.forEach((player) => leagueStarters.add(player.id));

  // 4. With the definitive starter pool, find the non-starters.
  const nonStarters = availablePlayers.filter((p) => !leagueStarters.has(p.id));

  // 5. Calculate baselines based on the best available *non-starters*.
  const baselines = {};

  // Positional baselines are the best non-starters at each position.
  baselines.QB = nonStarters.find((p) => p.pos === "QB")?.fpts || 0;
  baselines.RB = nonStarters.find((p) => p.pos === "RB")?.fpts || 0;
  baselines.WR = nonStarters.find((p) => p.pos === "WR")?.fpts || 0;
  baselines.TE = nonStarters.find((p) => p.pos === "TE")?.fpts || 0;

  // FLEX baseline is the best non-starter who is eligible for the FLEX spot.
  baselines.FLEX =
    nonStarters
      .filter((p) => ["RB", "WR", "TE"].includes(p.pos))
      .sort((a, b) => b.fpts - a.fpts)[0]?.fpts || 0;

  // --- CORRECTED LOGIC ---
  // The GLOBAL baseline should represent the value of a generic, cross-positional
  // replacement player. The FLEX baseline is the perfect candidate for this.
  baselines.GLOBAL = baselines.FLEX;

  return baselines;
}