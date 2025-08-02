/**
 * Roster evaluation utilities for analyzing roster composition and needs
 */

/**
 * Standard roster format for fantasy football leagues
 */
export const STANDARD_ROSTER_FORMAT = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1, // RB/WR/TE eligible
  BENCH: 6,
  TOTAL_STARTERS: 7,
  TOTAL_ROSTER: 13
};

/**
 * Calculate current roster composition for a manager
 * @param {Array} picks - Array of draft picks for the manager
 * @param {Object} rosterFormat - League roster format (optional)
 * @returns {Object} Current roster composition
 */
export function calculateRosterComposition(picks = [], rosterFormat = STANDARD_ROSTER_FORMAT) {
  const roster = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    FLEX: [], // Will be populated with flex-eligible players
    BENCH: [],
    totalPicks: picks.length
  };

  // Group picks by position
  picks.forEach(pick => {
    if (pick.player && pick.player.position) {
      const position = pick.player.position;
      if (roster[position]) {
        roster[position].push(pick.player);
      }
    }
  });

  // Calculate flex-eligible players (RB/WR/TE beyond starter requirements)
  const flexEligible = [
    ...roster.RB.slice(rosterFormat.RB),
    ...roster.WR.slice(rosterFormat.WR),
    ...roster.TE.slice(rosterFormat.TE)
  ];
  
  roster.FLEX = flexEligible.slice(0, rosterFormat.FLEX);
  roster.BENCH = flexEligible.slice(rosterFormat.FLEX);

  return roster;
}

/**
 * Calculate remaining roster needs for a manager
 * @param {Object} currentRoster - Current roster composition
 * @param {Object} rosterFormat - League roster format
 * @returns {Object} Remaining needs by position
 */
export function calculateRosterNeeds(currentRoster, rosterFormat = STANDARD_ROSTER_FORMAT) {
  const needs = {
    QB: Math.max(0, rosterFormat.QB - currentRoster.QB.length),
    RB: Math.max(0, rosterFormat.RB - currentRoster.RB.length),
    WR: Math.max(0, rosterFormat.WR - currentRoster.WR.length),
    TE: Math.max(0, rosterFormat.TE - currentRoster.TE.length),
    FLEX: Math.max(0, rosterFormat.FLEX - currentRoster.FLEX.length),
    BENCH: Math.max(0, rosterFormat.BENCH - currentRoster.BENCH.length),
    totalNeeded: 0
  };

  needs.totalNeeded = Object.values(needs).reduce((sum, need) => sum + need, 0) - needs.totalNeeded;
  
  return needs;
}

/**
 * Calculate position urgency based on remaining needs and draft opportunities
 * @param {Object} rosterNeeds - Remaining roster needs
 * @param {Number} remainingPicks - Number of remaining picks for the manager
 * @param {Number} totalRounds - Total rounds in the draft
 * @returns {Object} Urgency levels by position
 */
export function calculatePositionUrgency(rosterNeeds, remainingPicks, totalRounds = 13) {
  const urgencyLevels = {};
  
  Object.keys(rosterNeeds).forEach(position => {
    if (position === 'totalNeeded') return;
    
    const need = rosterNeeds[position];
    const urgencyRatio = need / Math.max(1, remainingPicks);
    
    if (need === 0) {
      urgencyLevels[position] = 'none';
    } else if (urgencyRatio >= 0.8) {
      urgencyLevels[position] = 'critical';
    } else if (urgencyRatio >= 0.5) {
      urgencyLevels[position] = 'high';
    } else if (urgencyRatio >= 0.25) {
      urgencyLevels[position] = 'medium';
    } else {
      urgencyLevels[position] = 'low';
    }
  });
  
  return urgencyLevels;
}

/**
 * Check if a player fills a roster need
 * @param {Object} player - Player object
 * @param {Object} rosterNeeds - Current roster needs
 * @returns {Boolean} True if player fills a need
 */
export function playerFillsNeed(player, rosterNeeds) {
  if (!player || !player.position) return false;
  
  const position = player.position;
  
  // Check direct position need
  if (rosterNeeds[position] > 0) return true;
  
  // Check flex eligibility for RB/WR/TE
  if (['RB', 'WR', 'TE'].includes(position) && rosterNeeds.FLEX > 0) return true;
  
  // Check bench need
  if (rosterNeeds.BENCH > 0) return true;
  
  return false;
}

/**
 * Calculate roster strength score
 * @param {Object} roster - Current roster composition
 * @param {Array} allPlayers - All available players for comparison
 * @returns {Number} Roster strength score (0-100)
 */
export function calculateRosterStrength(roster, allPlayers = []) {
  let totalScore = 0;
  let playerCount = 0;
  
  ['QB', 'RB', 'WR', 'TE'].forEach(position => {
    const positionPlayers = roster[position] || [];
    const positionPool = allPlayers.filter(p => p.position === position);
    
    positionPlayers.forEach(player => {
      if (positionPool.length > 0) {
        const playerRank = positionPool.findIndex(p => p.id === player.id) + 1;
        const positionScore = Math.max(0, 100 - (playerRank / positionPool.length) * 100);
        totalScore += positionScore;
        playerCount++;
      }
    });
  });
  
  return playerCount > 0 ? Math.round(totalScore / playerCount) : 0;
}

/**
 * Get roster construction progress
 * @param {Object} currentRoster - Current roster composition
 * @param {Object} rosterFormat - League roster format
 * @returns {Object} Progress information
 */
export function getRosterProgress(currentRoster, rosterFormat = STANDARD_ROSTER_FORMAT) {
  const totalSlots = rosterFormat.TOTAL_ROSTER;
  const filledSlots = currentRoster.totalPicks || 0;
  const progressPercentage = Math.round((filledSlots / totalSlots) * 100);
  
  const starterSlots = rosterFormat.TOTAL_STARTERS;
  const filledStarters = Math.min(
    (currentRoster.QB?.length || 0) +
    (currentRoster.RB?.length || 0) +
    (currentRoster.WR?.length || 0) +
    (currentRoster.TE?.length || 0) +
    (currentRoster.FLEX?.length || 0),
    starterSlots
  );
  const starterProgress = Math.round((filledStarters / starterSlots) * 100);
  
  return {
    totalSlots,
    filledSlots,
    remainingSlots: totalSlots - filledSlots,
    progressPercentage,
    starterSlots,
    filledStarters,
    starterProgress,
    isStartersComplete: filledStarters >= starterSlots,
    isRosterComplete: filledSlots >= totalSlots
  };
}

/**
 * Validate roster against league requirements
 * @param {Object} roster - Roster to validate
 * @param {Object} rosterFormat - League roster format
 * @returns {Object} Validation results
 */
export function validateRoster(roster, rosterFormat = STANDARD_ROSTER_FORMAT) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  // Check minimum position requirements
  Object.keys(rosterFormat).forEach(position => {
    if (['TOTAL_STARTERS', 'TOTAL_ROSTER'].includes(position)) return;
    
    const required = rosterFormat[position];
    const current = roster[position]?.length || 0;
    
    if (current < required) {
      validation.errors.push(`Need ${required - current} more ${position}`);
      validation.isValid = false;
    }
  });
  
  // Check for roster balance
  const totalStarters = (roster.QB?.length || 0) + (roster.RB?.length || 0) + 
                       (roster.WR?.length || 0) + (roster.TE?.length || 0) + 
                       (roster.FLEX?.length || 0);
  
  if (totalStarters < rosterFormat.TOTAL_STARTERS) {
    validation.warnings.push(`Only ${totalStarters} starters, need ${rosterFormat.TOTAL_STARTERS}`);
  }
  
  return validation;
}