/**
 * ProjectionEngine - Core projection algorithms
 * Implements weighted scoring system for player evaluation and pick value calculations
 */

export class ProjectionEngine {
  constructor(playerDataProcessor = null, adpEnabled = false) {
    this.playerDataProcessor = playerDataProcessor;
    this.adpEnabled = adpEnabled;
    
    // Weighting factors for pick value calculation
    this.weights = {
      projectedPoints: 0.35,
      positionalNeed: 0.25,
      positionScarcity: 0.20,
      competitionLevel: 0.10,
      adpValue: 0.05,
      replacementValue: 0.05
    };
    
    // Position requirements for standard roster format
    this.standardRosterFormat = {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1, // RB/WR/TE eligible
      BENCH: 6
    };
  }

  /**
   * Calculate pick value for a player given current roster and draft context
   * @param {Object} player - Player object with projected points and position
   * @param {Object} roster - Current roster composition
   * @param {Object} draftContext - Draft state and competitive analysis
   * @returns {Number} Weighted pick value score
   */
  calculatePickValue(player, roster, draftContext) {
    if (!player || !roster || !draftContext) {
      throw new Error('Missing required parameters for pick value calculation');
    }

    const factors = {
      projectedPoints: this.calculateProjectedPointsScore(player),
      positionalNeed: this.calculatePositionalNeed(player.position, roster),
      positionScarcity: this.calculatePositionScarcity(player.position, draftContext),
      competitionLevel: this.calculateCompetitionLevel(player, draftContext),
      adpValue: this.adpEnabled ? this.calculateADPValue(player) : 0,
      replacementValue: this.calculateReplacementValue(player, draftContext)
    };

    // Calculate base weighted score
    let baseScore = this.weightedScore(factors, this.weights);

    // Apply ADP efficiency adjustment if enabled
    if (this.adpEnabled && draftContext.currentPick) {
      const adpEfficiency = this.calculateADPEfficiency(player, draftContext.currentPick);
      const efficiencyWeight = 0.1; // 10% influence on final score
      baseScore = baseScore * (1 + (adpEfficiency - 50) / 100 * efficiencyWeight);
    }

    return Math.max(0, Math.min(100, baseScore)); // Ensure score stays within bounds
  }

  /**
   * Calculate projected points score (normalized 0-100)
   * @param {Object} player - Player object
   * @returns {Number} Projected points score
   */
  calculateProjectedPointsScore(player) {
    if (!player.projected_2025_points) {
      return 0;
    }

    // Get position-specific normalization
    const positionPlayers = this.playerDataProcessor?.getPlayersByPosition(player.position) || [];
    if (positionPlayers.length === 0) {
      return player.projected_2025_points / 10; // Fallback normalization
    }

    const maxPoints = Math.max(...positionPlayers.map(p => p.projected_2025_points));
    const minPoints = Math.min(...positionPlayers.map(p => p.projected_2025_points));
    
    if (maxPoints === minPoints) {
      return 100;
    }

    // Normalize to 0-100 scale
    return ((player.projected_2025_points - minPoints) / (maxPoints - minPoints)) * 100;
  }

  /**
   * Calculate positional need score based on current roster
   * @param {String} position - Player position
   * @param {Object} roster - Current roster composition
   * @returns {Number} Positional need score (0-100)
   */
  calculatePositionalNeed(position, roster) {
    const currentCount = this.getCurrentPositionCount(position, roster);
    const requiredCount = this.getRequiredPositionCount(position);
    const totalRosterSpots = this.getTotalRosterSpots();
    
    // Calculate how many more of this position are needed
    const needed = Math.max(0, requiredCount - currentCount);
    const remaining = Math.max(0, totalRosterSpots - this.getTotalRosterCount(roster));
    
    if (remaining === 0) {
      return needed > 0 ? 100 : 0; // Critical need if no spots left
    }

    // Higher score for positions that are needed urgently
    const urgencyMultiplier = needed > 0 ? 2 : 1;
    const needScore = (needed / requiredCount) * 100 * urgencyMultiplier;
    
    return Math.min(100, needScore);
  }

  /**
   * Calculate position scarcity score
   * @param {String} position - Player position
   * @param {Object} draftContext - Draft context with available players
   * @returns {Number} Position scarcity score (0-100)
   */
  calculatePositionScarcity(position, draftContext) {
    const availablePlayers = draftContext.availablePlayers || [];
    const positionPlayers = availablePlayers.filter(p => p.position === position);
    
    if (positionPlayers.length === 0) {
      return 100; // Maximum scarcity if no players available
    }

    // Calculate value dropoff between tiers
    const sortedPlayers = positionPlayers.sort((a, b) => b.projected_2025_points - a.projected_2025_points);
    
    if (sortedPlayers.length < 2) {
      return 50; // Medium scarcity for single player
    }

    // Calculate average dropoff between consecutive players
    let totalDropoff = 0;
    for (let i = 0; i < sortedPlayers.length - 1; i++) {
      totalDropoff += sortedPlayers[i].projected_2025_points - sortedPlayers[i + 1].projected_2025_points;
    }
    
    const avgDropoff = totalDropoff / (sortedPlayers.length - 1);
    
    // Normalize dropoff to 0-100 scale (higher dropoff = higher scarcity)
    const maxExpectedDropoff = 50; // Adjust based on position
    return Math.min(100, (avgDropoff / maxExpectedDropoff) * 100);
  }

  /**
   * Calculate competition level for a player
   * @param {Object} player - Player object
   * @param {Object} draftContext - Draft context with manager needs
   * @returns {Number} Competition level score (0-100)
   */
  calculateCompetitionLevel(player, draftContext) {
    const managerNeeds = draftContext.managerNeeds || [];
    
    // Count how many managers need this position and pick before us
    const competingManagers = managerNeeds.filter(manager => {
      const needsPosition = manager.needs && manager.needs[player.position] > 0;
      const picksBefore = manager.nextPick < draftContext.currentPick;
      return needsPosition && picksBefore;
    });

    const competitionCount = competingManagers.length;
    const maxCompetition = Math.min(12, managerNeeds.length); // Max 12 team league
    
    // Higher competition = higher urgency to draft now
    return (competitionCount / maxCompetition) * 100;
  }

  /**
   * Calculate ADP value score
   * @param {Object} player - Player object
   * @returns {Number} ADP value score (0-100)
   */
  calculateADPValue(player) {
    if (!this.adpEnabled) {
      return 0;
    }

    // Try different ADP sources in order of preference
    const adp = player.adp || 
                (player.adpData?.adp_ppr) || 
                (player.adpData?.adp_half_ppr) || 
                (player.adpData?.adp_std) ||
                null;

    if (!adp || adp === 999) { // 999 is often used as placeholder
      return 0;
    }

    // Lower ADP (earlier pick) = higher value
    // Normalize ADP to 0-100 scale with position-specific adjustments
    const maxADP = this.getMaxADPForPosition(player.position);
    const minADP = 1;
    
    // Calculate base ADP score
    const normalizedScore = Math.max(0, (maxADP - adp) / (maxADP - minADP) * 100);
    
    // Apply position-specific ADP weighting
    const positionWeight = this.getADPPositionWeight(player.position);
    
    // Ensure final score doesn't exceed 100
    return Math.min(100, normalizedScore * positionWeight);
  }

  /**
   * Get maximum expected ADP for a position
   * @param {String} position - Player position
   * @returns {Number} Maximum ADP for position
   */
  getMaxADPForPosition(position) {
    const maxADPs = {
      QB: 180,  // QBs can go late
      RB: 120,  // RBs typically go earlier
      WR: 150,  // WRs have wide range
      TE: 200   // TEs can go very late
    };
    
    return maxADPs[position] || 200;
  }

  /**
   * Get ADP weighting factor for position
   * @param {String} position - Player position
   * @returns {Number} Position weight factor (0.5-1.5)
   */
  getADPPositionWeight(position) {
    // Different positions have different ADP reliability
    const weights = {
      QB: 0.8,  // QB ADP less reliable due to late drafting
      RB: 1.2,  // RB ADP very reliable, scarcity driven
      WR: 1.0,  // WR ADP baseline reliability
      TE: 0.9   // TE ADP somewhat reliable
    };
    
    return weights[position] || 1.0;
  }

  /**
   * Calculate ADP-adjusted pick value with market efficiency consideration
   * @param {Object} player - Player object
   * @param {Number} currentPick - Current draft pick number
   * @returns {Number} ADP efficiency score (0-100)
   */
  calculateADPEfficiency(player, currentPick) {
    if (!this.adpEnabled || !player.adp) {
      return 50; // Neutral score when ADP not available
    }

    const adp = player.adp;
    const pickDifference = currentPick - adp;
    
    if (pickDifference > 0) {
      // Player available later than ADP suggests - good value
      return Math.min(100, 50 + (pickDifference * 2));
    } else {
      // Player going earlier than ADP - potentially reaching
      return Math.max(0, 50 + (pickDifference * 1.5));
    }
  }

  /**
   * Calculate replacement value score
   * @param {Object} player - Player object
   * @param {Object} draftContext - Draft context with available players
   * @returns {Number} Replacement value score (0-100)
   */
  calculateReplacementValue(player, draftContext) {
    const availablePlayers = draftContext.availablePlayers || [];
    const positionPlayers = availablePlayers.filter(p => p.position === player.position);
    
    if (positionPlayers.length === 0) {
      return 100; // Maximum value if no replacements
    }

    // Sort by projected points
    const sortedPlayers = positionPlayers.sort((a, b) => b.projected_2025_points - a.projected_2025_points);
    
    // Find replacement level (typically around 50th percentile)
    const replacementIndex = Math.floor(sortedPlayers.length * 0.5);
    const replacementPlayer = sortedPlayers[replacementIndex];
    
    if (!replacementPlayer) {
      return 50; // Medium value if can't determine replacement
    }

    // Calculate value above replacement
    const valueAboveReplacement = player.projected_2025_points - replacementPlayer.projected_2025_points;
    
    // Normalize to 0-100 scale
    const maxExpectedValue = 100; // Adjust based on position
    return Math.max(0, Math.min(100, (valueAboveReplacement / maxExpectedValue) * 100));
  }

  /**
   * Calculate weighted score from factors
   * @param {Object} factors - Score factors
   * @param {Object} weights - Weight factors
   * @returns {Number} Weighted total score
   */
  weightedScore(factors, weights) {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [factor, score] of Object.entries(factors)) {
      const weight = weights[factor] || 0;
      totalScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Get current count of players at a position in roster
   * @param {String} position - Position to count
   * @param {Object} roster - Current roster
   * @returns {Number} Current count
   */
  getCurrentPositionCount(position, roster) {
    if (!roster || !roster[position]) {
      return 0;
    }

    let count = roster[position].length || 0;
    
    // Count FLEX eligible players if checking RB/WR/TE
    if (['RB', 'WR', 'TE'].includes(position) && roster.FLEX) {
      const flexCount = roster.FLEX.filter(p => p.position === position).length;
      count += flexCount;
    }

    return count;
  }

  /**
   * Get required count for a position
   * @param {String} position - Position to check
   * @returns {Number} Required count
   */
  getRequiredPositionCount(position) {
    return this.standardRosterFormat[position] || 0;
  }

  /**
   * Get total roster spots
   * @returns {Number} Total roster spots
   */
  getTotalRosterSpots() {
    return Object.values(this.standardRosterFormat).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Get total current roster count
   * @param {Object} roster - Current roster
   * @returns {Number} Total current count
   */
  getTotalRosterCount(roster) {
    if (!roster) return 0;
    
    return Object.values(roster).reduce((total, players) => {
      return total + (Array.isArray(players) ? players.length : 0);
    }, 0);
  }

  /**
   * Set ADP enabled state
   * @param {Boolean} enabled - Whether ADP should be enabled
   */
  setADPEnabled(enabled) {
    this.adpEnabled = enabled;
  }

  /**
   * Update weighting factors
   * @param {Object} newWeights - New weight factors
   */
  updateWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Get top N picks for a roster given available players
   * @param {Object} roster - Current roster
   * @param {Array} availablePlayers - Available players to choose from
   * @param {Object} draftContext - Draft context
   * @param {Number} count - Number of top picks to return
   * @returns {Array} Top picks with scores and reasoning
   */
  getTopPicks(roster, availablePlayers, draftContext, count = 3) {
    if (!availablePlayers || availablePlayers.length === 0) {
      return [];
    }

    const scoredPlayers = availablePlayers.map(player => {
      const score = this.calculatePickValue(player, roster, draftContext);
      const reasoning = this.generatePickReasoning(player, roster, draftContext, score);
      
      return {
        player,
        score,
        reasoning
      };
    });

    // Sort by score descending and return top N
    return scoredPlayers
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  /**
   * Generate reasoning for a pick recommendation
   * @param {Object} player - Player object
   * @param {Object} roster - Current roster
   * @param {Object} draftContext - Draft context
   * @param {Number} score - Calculated score
   * @returns {String} Pick reasoning
   */
  generatePickReasoning(player, roster, draftContext, score) {
    const reasons = [];
    
    // Check positional need
    const currentCount = this.getCurrentPositionCount(player.position, roster);
    const requiredCount = this.getRequiredPositionCount(player.position);
    
    if (currentCount < requiredCount) {
      reasons.push(`Fills ${player.position} need (${currentCount}/${requiredCount})`);
    }

    // Check if top tier player
    if (player.position_rank <= 5) {
      reasons.push(`Top-tier ${player.position} (rank ${player.position_rank})`);
    }

    // Check projected points
    if (player.projected_2025_points > 250) {
      reasons.push(`High projected points (${player.projected_2025_points.toFixed(1)})`);
    }

    // Check competition
    const competition = this.calculateCompetitionLevel(player, draftContext);
    if (competition > 70) {
      reasons.push('High competition - may not be available later');
    }

    // Default reasoning if no specific reasons
    if (reasons.length === 0) {
      reasons.push(`Best available ${player.position} with ${score.toFixed(1)} value score`);
    }

    return reasons.join('; ');
  }
}