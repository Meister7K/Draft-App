/**
 * DraftDataProcessor - Processes Sleeper API draft data into internal format
 * Handles draft state synchronization and update management
 */

/**
 * Processes raw Sleeper API draft data into standardized internal format
 * @param {Object} sleeperDraftData - Raw draft data from Sleeper API
 * @param {Array} leagueUsers - Array of league users for name mapping
 * @param {Object} playerDatabase - Player database for player information
 * @returns {Object} Processed draft data in internal format
 */
export function processDraftData(sleeperDraftData, leagueUsers = [], playerDatabase = []) {
  if (!sleeperDraftData) {
    return null;
  }

  const userMap = createUserMap(leagueUsers);
  const playerMap = createPlayerMap(playerDatabase);

  return {
    draftId: sleeperDraftData.draftId,
    status: mapDraftStatus(sleeperDraftData.status),
    currentPick: sleeperDraftData.currentPick,
    totalPicks: sleeperDraftData.totalPicks,
    currentRound: calculateCurrentRound(sleeperDraftData.currentPick, sleeperDraftData.settings),
    picks: processPicksData(sleeperDraftData.picks, userMap, playerMap),
    managers: processManagersData(sleeperDraftData.draftOrder, userMap, sleeperDraftData.picks),
    draftOrder: sleeperDraftData.draftOrder,
    settings: processDraftSettings(sleeperDraftData.settings),
    lastUpdated: sleeperDraftData.lastUpdated || new Date(),
    metadata: {
      totalRounds: sleeperDraftData.settings?.rounds || 15,
      totalTeams: sleeperDraftData.settings?.teams || sleeperDraftData.draftOrder?.length || 12,
      pickTimeLimit: sleeperDraftData.settings?.pick_timer || 90
    }
  };
}

/**
 * Processes individual picks from Sleeper format to internal format
 * @param {Array} sleeperPicks - Raw picks from Sleeper API
 * @param {Object} userMap - Map of user IDs to user info
 * @param {Object} playerMap - Map of player IDs to player info
 * @returns {Array} Processed picks array
 */
export function processPicksData(sleeperPicks = [], userMap = {}, playerMap = {}) {
  return sleeperPicks.map(pick => ({
    pickNumber: pick.pick_no,
    round: pick.round,
    pickInRound: pick.draft_slot,
    managerId: pick.picked_by,
    managerName: userMap[pick.picked_by]?.displayName || 'Unknown Manager',
    playerId: pick.player_id,
    playerInfo: playerMap[pick.player_id] || {
      name: 'Unknown Player',
      position: 'UNKNOWN',
      team: 'UNKNOWN'
    },
    timestamp: pick.picked_at ? new Date(pick.picked_at) : new Date(),
    metadata: pick.metadata || {}
  }));
}

/**
 * Processes manager data including current roster state
 * @param {Array} draftOrder - Draft order array from Sleeper
 * @param {Object} userMap - Map of user IDs to user info
 * @param {Array} picks - Processed picks array
 * @returns {Array} Processed managers array with roster state
 */
export function processManagersData(draftOrder = [], userMap = {}, picks = []) {
  return draftOrder.map((userId, index) => {
    const managerPicks = picks.filter(pick => pick.managerId === userId);
    const roster = buildCurrentRoster(managerPicks);
    
    return {
      managerId: userId,
      managerName: userMap[userId]?.displayName || `Manager ${index + 1}`,
      username: userMap[userId]?.username || '',
      avatar: userMap[userId]?.avatar || null,
      draftPosition: index + 1,
      totalPicks: managerPicks.length,
      currentRoster: roster,
      rosterNeeds: calculateRosterNeeds(roster),
      nextPickNumber: calculateNextPick(userId, draftOrder, picks.length),
      pickHistory: managerPicks.sort((a, b) => a.pick_no - b.pick_no)
    };
  });
}

/**
 * Builds current roster from manager's picks
 * @param {Array} managerPicks - Array of picks made by manager
 * @returns {Object} Current roster organized by position
 */
export function buildCurrentRoster(managerPicks = []) {
  const roster = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DEF: [],
    FLEX: [], // Players that can fill flex spots
    BENCH: []
  };

  managerPicks.forEach(pick => {
    const position = pick.playerInfo?.position || 'UNKNOWN';
    const playerInfo = pick.playerInfo || { name: 'Unknown Player', team: 'UNKNOWN' };
    
    if (roster[position]) {
      roster[position].push({
        playerId: pick.playerId,
        playerName: playerInfo.name,
        position: position,
        team: playerInfo.team,
        pickNumber: pick.pickNumber,
        round: pick.round
      });
    } else {
      // Handle unknown positions by putting them on bench
      roster.BENCH.push({
        playerId: pick.playerId,
        playerName: playerInfo.name,
        position: position,
        team: playerInfo.team,
        pickNumber: pick.pickNumber,
        round: pick.round
      });
    }
  });

  return roster;
}

/**
 * Calculates roster needs based on standard fantasy football roster requirements
 * @param {Object} currentRoster - Current roster state
 * @param {Object} rosterFormat - League roster format (optional)
 * @returns {Object} Roster needs by position
 */
export function calculateRosterNeeds(currentRoster, rosterFormat = null) {
  // Default roster format: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 K, 1 DEF, 6 BENCH
  const defaultFormat = {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    K: 1,
    DEF: 1,
    BENCH: 6
  };

  const format = rosterFormat || defaultFormat;
  const needs = {};

  Object.keys(format).forEach(position => {
    const required = format[position];
    const current = currentRoster[position]?.length || 0;
    needs[position] = Math.max(0, required - current);
  });

  return needs;
}

/**
 * Calculates the next pick number for a manager
 * @param {string} managerId - Manager's user ID
 * @param {Array} draftOrder - Draft order array
 * @param {number} totalPicksMade - Total picks made so far
 * @returns {number|null} Next pick number or null if draft complete
 */
export function calculateNextPick(managerId, draftOrder, totalPicksMade) {
  const managerIndex = draftOrder.indexOf(managerId);
  if (managerIndex === -1) return null;

  const totalTeams = draftOrder.length;
  const currentRound = Math.floor(totalPicksMade / totalTeams) + 1;
  
  // Handle snake draft logic
  let nextPickInRound;
  if (currentRound % 2 === 1) {
    // Odd rounds: normal order
    nextPickInRound = managerIndex + 1;
  } else {
    // Even rounds: reverse order
    nextPickInRound = totalTeams - managerIndex;
  }

  const nextPickNumber = ((currentRound - 1) * totalTeams) + nextPickInRound;
  
  // Simple check: if the next pick number is greater than total picks made, this manager is up next
  if (nextPickNumber > totalPicksMade) {
    return nextPickNumber;
  }

  // If we're here, calculate the next round for this manager
  const nextRound = currentRound + 1;
  let nextRoundPickInRound;
  if (nextRound % 2 === 1) {
    nextRoundPickInRound = managerIndex + 1;
  } else {
    nextRoundPickInRound = totalTeams - managerIndex;
  }

  return ((nextRound - 1) * totalTeams) + nextRoundPickInRound;
}

/**
 * Maps Sleeper draft status to internal status
 * @param {string} sleeperStatus - Status from Sleeper API
 * @returns {string} Internal status
 */
export function mapDraftStatus(sleeperStatus) {
  const statusMap = {
    'pre_draft': 'PRE_DRAFT',
    'drafting': 'IN_PROGRESS',
    'complete': 'COMPLETED',
    'paused': 'PAUSED'
  };

  return statusMap[sleeperStatus] || 'UNKNOWN';
}

/**
 * Calculates current round based on pick number and settings
 * @param {number} currentPick - Current pick number
 * @param {Object} settings - Draft settings
 * @returns {number} Current round number
 */
export function calculateCurrentRound(currentPick, settings) {
  const teamsCount = settings?.teams || 12;
  return Math.ceil(currentPick / teamsCount);
}

/**
 * Processes draft settings into internal format
 * @param {Object} sleeperSettings - Settings from Sleeper API
 * @returns {Object} Processed settings
 */
export function processDraftSettings(sleeperSettings = {}) {
  return {
    rounds: sleeperSettings.rounds || 15,
    teams: sleeperSettings.teams || 12,
    pickTimer: sleeperSettings.pick_timer || 90,
    type: sleeperSettings.type || 'snake',
    reversal: sleeperSettings.reversal_round || null,
    alpha_sort: sleeperSettings.alpha_sort || false
  };
}

/**
 * Creates a map of user IDs to user information
 * @param {Array} leagueUsers - Array of league users
 * @returns {Object} Map of user ID to user info
 */
export function createUserMap(leagueUsers = []) {
  const userMap = {};
  leagueUsers.forEach(user => {
    userMap[user.userId] = {
      displayName: user.displayName,
      username: user.username,
      avatar: user.avatar
    };
  });
  return userMap;
}

/**
 * Creates a map of player IDs to player information
 * @param {Array} playerDatabase - Array of player data
 * @returns {Object} Map of player ID to player info
 */
export function createPlayerMap(playerDatabase = []) {
  const playerMap = {};
  playerDatabase.forEach(player => {
    // Handle different possible ID formats
    const playerId = player.sleeper_id || player.player_id || player.id;
    if (playerId) {
      playerMap[playerId] = {
        name: player.name,
        position: player.position,
        team: player.team,
        projectedPoints: player.projected_2025_points || 0
      };
    }
  });
  return playerMap;
}

/**
 * Compares two draft states to detect changes
 * @param {Object} oldState - Previous draft state
 * @param {Object} newState - New draft state
 * @returns {Object} Change detection results
 */
export function detectDraftChanges(oldState, newState) {
  if (!oldState || !newState) {
    return {
      hasChanges: true,
      newPicks: newState?.picks || [],
      statusChanged: true,
      pickCountChanged: true
    };
  }

  const statusChanged = oldState.status !== newState.status;
  const pickCountChanged = oldState.picks.length !== newState.picks.length;
  const newPicks = newState.picks.slice(oldState.picks.length);

  return {
    hasChanges: statusChanged || pickCountChanged,
    newPicks,
    statusChanged,
    pickCountChanged,
    oldPickCount: oldState.picks.length,
    newPickCount: newState.picks.length
  };
}

/**
 * Validates processed draft data for completeness and consistency
 * @param {Object} draftData - Processed draft data
 * @returns {Object} Validation results
 */
export function validateDraftData(draftData) {
  const errors = [];
  const warnings = [];

  if (!draftData) {
    errors.push('Draft data is null or undefined');
    return { isValid: false, errors, warnings };
  }

  // Required fields validation
  if (!draftData.draftId) errors.push('Missing draft ID');
  if (!draftData.status) errors.push('Missing draft status');
  if (!Array.isArray(draftData.picks)) errors.push('Picks must be an array');
  if (!Array.isArray(draftData.managers)) errors.push('Managers must be an array');

  // Data consistency validation
  if (draftData.picks && draftData.currentPick) {
    if (draftData.picks.length + 1 !== draftData.currentPick) {
      warnings.push('Current pick number may be inconsistent with picks array length');
    }
  }

  // Manager data validation
  if (draftData.managers) {
    draftData.managers.forEach((manager, index) => {
      if (!manager.managerId) {
        errors.push(`Manager at index ${index} missing managerId`);
      }
      if (!manager.managerName) {
        warnings.push(`Manager at index ${index} missing display name`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Creates a draft state snapshot for comparison and caching
 * @param {Object} draftData - Processed draft data
 * @returns {Object} Draft state snapshot
 */
export function createDraftSnapshot(draftData) {
  if (!draftData) return null;

  return {
    draftId: draftData.draftId,
    status: draftData.status,
    currentPick: draftData.currentPick,
    totalPicks: draftData.totalPicks,
    pickCount: draftData.picks.length,
    lastPickTimestamp: draftData.picks.length > 0 
      ? draftData.picks[draftData.picks.length - 1].timestamp 
      : null,
    snapshotTime: new Date()
  };
}