/**
 * CompetitiveAnalyzer - Analyzes other managers' roster needs and draft positions
 * Provides competitive analysis for draft projections
 */

export class CompetitiveAnalyzer {
  constructor(rosterFormat = null) {
    // Standard roster format if none provided
    this.rosterFormat = rosterFormat || {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1, // RB/WR/TE eligible
      BENCH: 6
    };
    
    // Position priorities for different draft strategies
    this.positionPriorities = {
      'zero-rb': ['QB', 'WR', 'TE', 'RB'],
      'rb-heavy': ['RB', 'QB', 'WR', 'TE'],
      'balanced': ['RB', 'WR', 'QB', 'TE'],
      'wr-heavy': ['WR', 'RB', 'QB', 'TE']
    };
  }

  /**
   * Analyze all managers' roster needs and draft positions
   * @param {Array} managers - Array of manager objects with user_id and display_name
   * @param {Array} currentPicks - Array of completed draft picks
   * @param {Object} draftSettings - Draft settings including order and current pick
   * @returns {Array} Array of manager analysis objects
   */
  analyzeManagerNeeds(managers, currentPicks = [], draftSettings = {}) {
    if (!managers || !Array.isArray(managers)) {
      throw new Error('Managers array is required');
    }

    return managers.map(manager => {
      const currentRoster = this.buildCurrentRoster(manager.user_id, currentPicks);
      const needs = this.calculateRosterNeeds(currentRoster);
      const urgency = this.calculatePositionUrgency(needs, manager, draftSettings);
      const strategy = this.inferDraftStrategy(currentPicks, manager.user_id);
      const likelyTargets = this.predictLikelyTargets(needs, urgency, strategy);
      
      return {
        managerId: manager.user_id,
        managerName: manager.display_name || manager.username || `Manager ${manager.user_id}`,
        draftPosition: this.getDraftPosition(manager.user_id, draftSettings),
        nextPick: this.calculateNextPick(manager.user_id, draftSettings),
        currentRoster,
        needs,
        urgency,
        strategy,
        likelyTargets,
        totalPicks: currentPicks.filter(pick => pick.picked_by === manager.user_id).length
      };
    });
  }

  /**
   * Build current roster for a manager based on completed picks
   * @param {String} managerId - Manager's user ID
   * @param {Array} currentPicks - Array of completed picks
   * @returns {Object} Current roster by position
   */
  buildCurrentRoster(managerId, currentPicks) {
    const roster = {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      FLEX: [],
      BENCH: []
    };

    const managerPicks = currentPicks.filter(pick => pick.picked_by === managerId);
    
    managerPicks.forEach(pick => {
      const position = pick.metadata?.position || pick.position;
      if (position && roster[position] !== undefined) {
        roster[position].push({
          name: pick.metadata?.first_name && pick.metadata?.last_name 
            ? `${pick.metadata.first_name} ${pick.metadata.last_name}`
            : pick.player_id,
          position: position,
          pickNumber: pick.pick_no,
          round: pick.round
        });
      }
    });

    return roster;
  }

  /**
   * Calculate roster needs based on current roster and format requirements
   * @param {Object} currentRoster - Current roster by position
   * @returns {Object} Needs by position
   */
  calculateRosterNeeds(currentRoster) {
    const needs = {};
    
    // Calculate basic position needs
    Object.keys(this.rosterFormat).forEach(position => {
      const required = this.rosterFormat[position];
      const current = currentRoster[position]?.length || 0;
      needs[position] = Math.max(0, required - current);
    });

    // Handle FLEX eligibility - reduce FLEX need if RB/WR/TE are overfilled
    const flexEligiblePositions = ['RB', 'WR', 'TE'];
    let flexEligibleOverfill = 0;
    
    flexEligiblePositions.forEach(position => {
      const required = this.rosterFormat[position];
      const current = currentRoster[position]?.length || 0;
      if (current > required) {
        flexEligibleOverfill += current - required;
      }
    });

    needs.FLEX = Math.max(0, needs.FLEX - flexEligibleOverfill);

    return needs;
  }

  /**
   * Calculate position urgency levels based on needs and draft position
   * @param {Object} needs - Position needs
   * @param {Object} manager - Manager object
   * @param {Object} draftSettings - Draft settings
   * @returns {Object} Urgency levels by position
   */
  calculatePositionUrgency(needs, manager, draftSettings) {
    const urgency = {};
    const nextPick = this.calculateNextPick(manager.user_id, draftSettings);
    const totalRounds = draftSettings.rounds || 13;
    const remainingRounds = Math.max(0, totalRounds - Math.ceil(nextPick / (draftSettings.total_slots || 12)));

    Object.keys(needs).forEach(position => {
      const need = needs[position];
      
      if (need === 0) {
        urgency[position] = 'none';
      } else if (need >= remainingRounds) {
        urgency[position] = 'critical'; // More needs than remaining rounds
      } else if (need > remainingRounds * 0.7) {
        urgency[position] = 'high';
      } else if (need > remainingRounds * 0.4) {
        urgency[position] = 'medium';
      } else {
        urgency[position] = 'low';
      }
    });

    return urgency;
  }

  /**
   * Infer draft strategy based on early picks
   * @param {Array} currentPicks - All completed picks
   * @param {String} managerId - Manager's user ID
   * @returns {String} Inferred strategy
   */
  inferDraftStrategy(currentPicks, managerId) {
    const managerPicks = currentPicks
      .filter(pick => pick.picked_by === managerId)
      .sort((a, b) => a.pick_no - b.pick_no)
      .slice(0, 4); // Look at first 4 picks

    if (managerPicks.length < 2) {
      return 'unknown';
    }

    const positionCounts = {};
    managerPicks.forEach(pick => {
      const position = pick.metadata?.position || pick.position;
      if (position) {
        positionCounts[position] = (positionCounts[position] || 0) + 1;
      }
    });

    // Analyze strategy based on early picks
    if (positionCounts.RB >= 3) {
      return 'rb-heavy';
    } else if (positionCounts.WR >= 3) {
      return 'wr-heavy';
    } else if ((positionCounts.RB || 0) === 0 && managerPicks.length >= 3) {
      return 'zero-rb';
    } else {
      return 'balanced';
    }
  }

  /**
   * Predict likely targets for a manager
   * @param {Object} needs - Position needs
   * @param {Object} urgency - Position urgency levels
   * @param {String} strategy - Draft strategy
   * @returns {Array} Array of likely target positions in priority order
   */
  predictLikelyTargets(needs, urgency, strategy) {
    const targets = [];
    
    // Get positions with needs, sorted by urgency
    const neededPositions = Object.keys(needs)
      .filter(position => needs[position] > 0)
      .sort((a, b) => {
        const urgencyOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1, 'none': 0 };
        return urgencyOrder[urgency[b]] - urgencyOrder[urgency[a]];
      });

    // Apply strategy-based prioritization
    const strategyPriorities = this.positionPriorities[strategy] || this.positionPriorities.balanced;
    
    // Combine urgency and strategy
    strategyPriorities.forEach(position => {
      if (neededPositions.includes(position)) {
        targets.push({
          position,
          need: needs[position],
          urgency: urgency[position],
          priority: 'high'
        });
      }
    });

    // Add remaining needed positions
    neededPositions.forEach(position => {
      if (!targets.find(t => t.position === position)) {
        targets.push({
          position,
          need: needs[position],
          urgency: urgency[position],
          priority: 'medium'
        });
      }
    });

    return targets.slice(0, 3); // Return top 3 targets
  }

  /**
   * Predict player availability based on manager needs and draft positions
   * @param {Object} player - Player object
   * @param {Array} managerAnalysis - Array of manager analysis objects
   * @param {Number} targetPick - Pick number to check availability for
   * @returns {Object} Availability analysis
   */
  predictPlayerAvailability(player, managerAnalysis, targetPick) {
    if (!player || !managerAnalysis || !targetPick) {
      return {
        probability: 0.5,
        competingManagers: 0,
        riskLevel: 'medium'
      };
    }

    // Find managers who pick before the target pick and need this position
    const competingManagers = managerAnalysis.filter(manager => {
      const needsPosition = manager.needs[player.position] > 0;
      const picksBefore = manager.nextPick < targetPick && manager.nextPick > 0;
      const isLikelyTarget = manager.likelyTargets.some(target => 
        target.position === player.position && target.priority === 'high'
      );
      
      return needsPosition && picksBefore && isLikelyTarget;
    });

    const competitionCount = competingManagers.length;
    
    // Calculate availability probability
    // Base probability starts high and decreases with competition
    let probability = 0.9;
    
    // Reduce probability for each competing manager
    probability -= competitionCount * 0.15;
    
    // Adjust for player quality (higher ranked players more likely to be taken)
    if (player.position_rank <= 5) {
      probability -= 0.2; // Top 5 at position
    } else if (player.position_rank <= 12) {
      probability -= 0.1; // Top 12 at position
    }

    // Ensure probability stays within bounds
    probability = Math.max(0.1, Math.min(0.9, probability));

    // Determine risk level
    let riskLevel;
    if (probability >= 0.7) {
      riskLevel = 'low';
    } else if (probability >= 0.4) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    return {
      probability,
      competingManagers: competitionCount,
      riskLevel,
      competitorDetails: competingManagers.map(m => ({
        name: m.managerName,
        nextPick: m.nextPick,
        urgency: m.urgency?.[player.position] || 'unknown'
      }))
    };
  }

  /**
   * Calculate competition level for a position across all managers
   * @param {String} position - Position to analyze
   * @param {Array} managerAnalysis - Array of manager analysis objects
   * @returns {Object} Competition analysis
   */
  calculatePositionCompetition(position, managerAnalysis) {
    if (!managerAnalysis || !Array.isArray(managerAnalysis)) {
      return {
        totalNeed: 0,
        managersNeedingPosition: 0,
        averageUrgency: 'low',
        competitionLevel: 'low'
      };
    }

    const managersNeedingPosition = managerAnalysis.filter(manager => 
      manager.needs[position] > 0
    );

    const totalNeed = managersNeedingPosition.reduce((sum, manager) => 
      sum + manager.needs[position], 0
    );

    // Calculate average urgency
    const urgencyScores = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1, 'none': 0 };
    const avgUrgencyScore = managersNeedingPosition.length > 0 
      ? managersNeedingPosition.reduce((sum, manager) => 
          sum + urgencyScores[manager.urgency[position]], 0
        ) / managersNeedingPosition.length
      : 0;

    let averageUrgency = 'low';
    if (avgUrgencyScore >= 3.5) averageUrgency = 'critical';
    else if (avgUrgencyScore >= 2.5) averageUrgency = 'high';
    else if (avgUrgencyScore >= 1.5) averageUrgency = 'medium';

    // Determine overall competition level
    let competitionLevel = 'low';
    if (managersNeedingPosition.length >= 8) competitionLevel = 'high';
    else if (managersNeedingPosition.length >= 5) competitionLevel = 'medium';

    return {
      totalNeed,
      managersNeedingPosition: managersNeedingPosition.length,
      averageUrgency,
      competitionLevel,
      managersWithNeed: managersNeedingPosition.map(m => ({
        name: m.managerName,
        need: m.needs[position],
        urgency: m.urgency[position]
      }))
    };
  }

  /**
   * Get draft position for a manager
   * @param {String} managerId - Manager's user ID
   * @param {Object} draftSettings - Draft settings
   * @returns {Number} Draft position (1-12)
   */
  getDraftPosition(managerId, draftSettings) {
    if (!draftSettings.draft_order || !Array.isArray(draftSettings.draft_order)) {
      return 1; // Default position
    }

    const position = draftSettings.draft_order.indexOf(managerId);
    return position >= 0 ? position + 1 : 1;
  }

  /**
   * Calculate next pick number for a manager
   * @param {String} managerId - Manager's user ID
   * @param {Object} draftSettings - Draft settings
   * @returns {Number} Next pick number
   */
  calculateNextPick(managerId, draftSettings) {
    const draftPosition = this.getDraftPosition(managerId, draftSettings);
    const currentPick = draftSettings.pick_no || 1;
    const totalSlots = draftSettings.total_slots || 12;
    
    // If we're at pick 1, the next pick for manager 1 is pick 1
    if (currentPick === 1 && draftPosition === 1) {
      return 1;
    }
    
    // Calculate which round we're in based on current pick
    const currentRound = Math.ceil(currentPick / totalSlots);
    
    // Calculate this manager's pick in the current round
    let pickInCurrentRound;
    if (currentRound % 2 === 1) {
      // Odd round: normal order
      pickInCurrentRound = draftPosition;
    } else {
      // Even round: reverse order
      pickInCurrentRound = totalSlots - draftPosition + 1;
    }
    
    // Calculate absolute pick number for current round
    const pickInCurrentRoundAbsolute = (currentRound - 1) * totalSlots + pickInCurrentRound;
    
    // If this manager's pick in current round hasn't happened yet, return it
    if (pickInCurrentRoundAbsolute >= currentPick) {
      return pickInCurrentRoundAbsolute;
    }
    
    // Otherwise, calculate next round
    const nextRound = currentRound + 1;
    let nextRoundPick;
    
    if (nextRound % 2 === 1) {
      nextRoundPick = draftPosition;
    } else {
      nextRoundPick = totalSlots - draftPosition + 1;
    }
    
    return (nextRound - 1) * totalSlots + nextRoundPick;
  }

  /**
   * Update roster format
   * @param {Object} newFormat - New roster format
   */
  updateRosterFormat(newFormat) {
    this.rosterFormat = { ...this.rosterFormat, ...newFormat };
  }

  /**
   * Get roster format
   * @returns {Object} Current roster format
   */
  getRosterFormat() {
    return { ...this.rosterFormat };
  }
}