/**
 * PositionValueCalculator - Calculates position scarcity and value dropoff analysis
 * Implements tier creation algorithm and scarcity scoring for draft projections
 */

export class PositionValueCalculator {
  constructor(playerDataProcessor = null) {
    this.playerDataProcessor = playerDataProcessor;
    
    // Tier size limits by position
    this.tierSizeLimits = {
      QB: 8,   // Smaller tiers for QB due to fewer starters
      RB: 12,  // Standard tier size
      WR: 12,  // Standard tier size
      TE: 8    // Smaller tiers for TE due to fewer starters
    };
    
    // Value dropoff thresholds for tier breaks
    this.dropoffThresholds = {
      QB: 15,   // Points difference to create new tier
      RB: 20,   // Points difference to create new tier
      WR: 20,   // Points difference to create new tier
      TE: 15    // Points difference to create new tier
    };
    
    // Position depth expectations (how many players are typically drafted)
    this.positionDepth = {
      QB: 24,   // ~2 per team in 12-team league
      RB: 60,   // ~5 per team in 12-team league
      WR: 60,   // ~5 per team in 12-team league
      TE: 24    // ~2 per team in 12-team league
    };
  }

  /**
   * Calculate position scarcity for all positions
   * @param {Array} playerDatabase - Array of all players
   * @param {Object} draftContext - Current draft context
   * @returns {Object} Scarcity analysis by position
   */
  calculatePositionScarcity(playerDatabase, draftContext = {}) {
    if (!playerDatabase || !Array.isArray(playerDatabase)) {
      throw new Error('Player database is required');
    }

    const scarcityAnalysis = {};
    const positions = ['QB', 'RB', 'WR', 'TE'];

    positions.forEach(position => {
      const positionPlayers = playerDatabase.filter(p => p.position === position);
      const availablePlayers = this.getAvailablePlayers(positionPlayers, draftContext);
      
      scarcityAnalysis[position] = this.analyzePositionScarcity(
        position, 
        availablePlayers, 
        draftContext
      );
    });

    return scarcityAnalysis;
  }

  /**
   * Analyze scarcity for a specific position
   * @param {String} position - Position to analyze
   * @param {Array} availablePlayers - Available players at position
   * @param {Object} draftContext - Draft context
   * @returns {Object} Position scarcity analysis
   */
  analyzePositionScarcity(position, availablePlayers, draftContext = {}) {
    const tiers = this.createValueTiers(availablePlayers, position);
    const dropoffAnalysis = this.calculateValueDropoff(tiers);
    const scarcityScore = this.calculateScarcityScore(dropoffAnalysis, position);
    const draftWindow = this.calculateOptimalDraftWindow(dropoffAnalysis, position, draftContext);

    return {
      position,
      totalPlayers: availablePlayers.length,
      tiers,
      valueDropoff: dropoffAnalysis,
      scarcityScore,
      recommendedDraftWindow: draftWindow,
      depthAnalysis: this.analyzePositionDepth(availablePlayers, position),
      competitionLevel: this.calculatePositionCompetition(position, draftContext)
    };
  }

  /**
   * Create value tiers for players at a position
   * @param {Array} players - Players to tier
   * @param {String} position - Position being tiered
   * @returns {Array} Array of tiers, each containing player arrays
   */
  createValueTiers(players, position) {
    if (!players || players.length === 0) {
      return [];
    }

    // Sort players by projected points descending
    const sortedPlayers = [...players].sort((a, b) => 
      (b.projected_2025_points || 0) - (a.projected_2025_points || 0)
    );

    const tiers = [];
    let currentTier = [];
    let lastValue = null;
    const tierSizeLimit = this.tierSizeLimits[position] || 12;
    const dropoffThreshold = this.dropoffThresholds[position] || 20;

    sortedPlayers.forEach((player, index) => {
      const currentValue = player.projected_2025_points || 0;
      const valueDropoff = lastValue ? lastValue - currentValue : 0;

      // Create new tier if:
      // 1. Significant value dropoff
      // 2. Current tier is at size limit
      // 3. Natural position rank breaks (every 12 for skill positions)
      const shouldCreateNewTier = (
        (valueDropoff > dropoffThreshold && currentTier.length > 0) ||
        (currentTier.length >= tierSizeLimit) ||
        (index > 0 && index % 12 === 0 && valueDropoff > dropoffThreshold * 0.5)
      );

      if (shouldCreateNewTier && currentTier.length > 0) {
        tiers.push({
          tierNumber: tiers.length + 1,
          players: [...currentTier],
          averagePoints: this.calculateTierAverage(currentTier),
          topPlayer: currentTier[0],
          bottomPlayer: currentTier[currentTier.length - 1],
          tierSize: currentTier.length
        });
        currentTier = [];
      }

      currentTier.push({
        ...player,
        tierRank: currentTier.length + 1,
        valueDropoffFromPrevious: valueDropoff
      });
      
      lastValue = currentValue;
    });

    // Add final tier if it has players
    if (currentTier.length > 0) {
      tiers.push({
        tierNumber: tiers.length + 1,
        players: [...currentTier],
        averagePoints: this.calculateTierAverage(currentTier),
        topPlayer: currentTier[0],
        bottomPlayer: currentTier[currentTier.length - 1],
        tierSize: currentTier.length
      });
    }

    return tiers;
  }

  /**
   * Calculate value dropoff analysis between tiers
   * @param {Array} tiers - Array of tier objects
   * @returns {Object} Dropoff analysis
   */
  calculateValueDropoff(tiers) {
    if (!tiers || tiers.length === 0) {
      return {
        totalDropoff: 0,
        averageDropoff: 0,
        maxDropoff: 0,
        dropoffByTier: [],
        steepestDropoff: null
      };
    }

    const dropoffByTier = [];
    let totalDropoff = 0;
    let maxDropoff = 0;
    let steepestDropoff = null;

    for (let i = 0; i < tiers.length - 1; i++) {
      const currentTier = tiers[i];
      const nextTier = tiers[i + 1];
      
      const dropoff = currentTier.averagePoints - nextTier.averagePoints;
      
      dropoffByTier.push({
        fromTier: i + 1,
        toTier: i + 2,
        dropoff,
        fromAverage: currentTier.averagePoints,
        toAverage: nextTier.averagePoints,
        percentageDropoff: currentTier.averagePoints > 0 
          ? (dropoff / currentTier.averagePoints) * 100 
          : 0
      });

      totalDropoff += dropoff;
      
      if (dropoff > maxDropoff) {
        maxDropoff = dropoff;
        steepestDropoff = {
          fromTier: i + 1,
          toTier: i + 2,
          dropoff,
          percentageDropoff: currentTier.averagePoints > 0 
            ? (dropoff / currentTier.averagePoints) * 100 
            : 0
        };
      }
    }

    return {
      totalDropoff,
      averageDropoff: tiers.length > 1 ? totalDropoff / (tiers.length - 1) : 0,
      maxDropoff,
      dropoffByTier,
      steepestDropoff
    };
  }

  /**
   * Calculate scarcity score for a position
   * @param {Object} dropoffAnalysis - Value dropoff analysis
   * @param {String} position - Position being analyzed
   * @returns {Number} Scarcity score (0-100)
   */
  calculateScarcityScore(dropoffAnalysis, position) {
    if (!dropoffAnalysis || dropoffAnalysis.averageDropoff === 0) {
      return 50; // Medium scarcity if no dropoff data
    }

    // Base scarcity on average dropoff and steepest dropoff
    const avgDropoff = dropoffAnalysis.averageDropoff;
    const maxDropoff = dropoffAnalysis.maxDropoff;
    
    // Position-specific normalization factors
    const normalizationFactors = {
      QB: 30,  // QBs typically have smaller dropoffs
      RB: 40,  // RBs have moderate dropoffs
      WR: 40,  // WRs have moderate dropoffs
      TE: 25   // TEs have smaller dropoffs
    };
    
    const normalizationFactor = normalizationFactors[position] || 35;
    
    // Calculate base score from average dropoff
    let scarcityScore = (avgDropoff / normalizationFactor) * 60;
    
    // Add bonus for steep dropoffs (indicates clear tiers)
    if (maxDropoff > avgDropoff * 1.5) {
      scarcityScore += 20;
    }
    
    // Add bonus for positions with fewer total tiers (more concentrated value)
    const tierCount = dropoffAnalysis.dropoffByTier.length + 1;
    if (tierCount <= 3) {
      scarcityScore += 15;
    } else if (tierCount <= 5) {
      scarcityScore += 10;
    }
    
    // Normalize to 0-100 scale
    return Math.max(0, Math.min(100, scarcityScore));
  }

  /**
   * Calculate optimal draft window for a position
   * @param {Object} dropoffAnalysis - Value dropoff analysis
   * @param {String} position - Position being analyzed
   * @param {Object} draftContext - Draft context
   * @returns {Object} Draft window recommendation
   */
  calculateOptimalDraftWindow(dropoffAnalysis, position, draftContext = {}) {
    if (!dropoffAnalysis.steepestDropoff) {
      return {
        earlyWindow: { start: 1, end: 3 },
        optimalWindow: { start: 4, end: 8 },
        lateWindow: { start: 9, end: 15 },
        recommendation: 'No clear optimal window - draft based on value'
      };
    }

    const steepestDropoff = dropoffAnalysis.steepestDropoff;
    const currentRound = Math.ceil((draftContext.currentPick || 1) / (draftContext.totalSlots || 12));
    
    // Calculate windows based on steepest dropoff
    const earlyWindow = {
      start: 1,
      end: steepestDropoff.fromTier * 2, // Rough conversion from tier to round
      description: `Elite ${position} tier - highest value`
    };
    
    const optimalWindow = {
      start: earlyWindow.end + 1,
      end: earlyWindow.end + 4,
      description: `Value ${position} tier - good value before dropoff`
    };
    
    const lateWindow = {
      start: optimalWindow.end + 1,
      end: optimalWindow.end + 6,
      description: `Depth ${position} tier - after major dropoff`
    };

    // Generate recommendation based on current draft position
    let recommendation;
    if (currentRound <= earlyWindow.end) {
      recommendation = `Consider elite ${position}s now - major dropoff after tier ${steepestDropoff.fromTier}`;
    } else if (currentRound <= optimalWindow.end) {
      recommendation = `Good value window for ${position} - draft before tier ${steepestDropoff.toTier}`;
    } else {
      recommendation = `${position} value has dropped significantly - focus on other positions`;
    }

    return {
      earlyWindow,
      optimalWindow,
      lateWindow,
      recommendation,
      steepestDropoffAfterTier: steepestDropoff.fromTier
    };
  }

  /**
   * Analyze position depth relative to draft needs
   * @param {Array} availablePlayers - Available players
   * @param {String} position - Position being analyzed
   * @returns {Object} Depth analysis
   */
  analyzePositionDepth(availablePlayers, position) {
    const expectedDrafted = this.positionDepth[position] || 48;
    const availableCount = availablePlayers.length;
    
    // Calculate depth ratio
    const depthRatio = availableCount / expectedDrafted;
    
    let depthLevel;
    if (depthRatio >= 1.5) {
      depthLevel = 'deep';
    } else if (depthRatio >= 1.0) {
      depthLevel = 'adequate';
    } else if (depthRatio >= 0.7) {
      depthLevel = 'shallow';
    } else {
      depthLevel = 'very shallow';
    }

    return {
      availableCount,
      expectedDrafted,
      depthRatio,
      depthLevel,
      surplus: Math.max(0, availableCount - expectedDrafted),
      shortage: Math.max(0, expectedDrafted - availableCount)
    };
  }

  /**
   * Calculate position competition level
   * @param {String} position - Position to analyze
   * @param {Object} draftContext - Draft context with manager needs
   * @returns {String} Competition level
   */
  calculatePositionCompetition(position, draftContext = {}) {
    const managerNeeds = draftContext.managerNeeds || [];
    
    if (managerNeeds.length === 0) {
      return 'unknown';
    }

    // Count managers who need this position
    const managersNeedingPosition = managerNeeds.filter(manager => 
      manager.needs && manager.needs[position] > 0
    ).length;

    const totalManagers = managerNeeds.length;
    const competitionPercentage = managersNeedingPosition / totalManagers;

    if (competitionPercentage >= 0.8) {
      return 'very high';
    } else if (competitionPercentage >= 0.6) {
      return 'high';
    } else if (competitionPercentage >= 0.4) {
      return 'medium';
    } else if (competitionPercentage >= 0.2) {
      return 'low';
    } else {
      return 'very low';
    }
  }

  /**
   * Get available players (not yet drafted)
   * @param {Array} positionPlayers - All players at position
   * @param {Object} draftContext - Draft context with drafted players
   * @returns {Array} Available players
   */
  getAvailablePlayers(positionPlayers, draftContext = {}) {
    const draftedPlayerIds = new Set();
    
    // Collect drafted player IDs from current picks
    if (draftContext.currentPicks && Array.isArray(draftContext.currentPicks)) {
      draftContext.currentPicks.forEach(pick => {
        if (pick.player_id) {
          draftedPlayerIds.add(pick.player_id);
        }
        // Also check metadata for player identification
        if (pick.metadata?.first_name && pick.metadata?.last_name) {
          const fullName = `${pick.metadata.first_name} ${pick.metadata.last_name}`;
          draftedPlayerIds.add(fullName);
        }
      });
    }

    // Filter out drafted players
    return positionPlayers.filter(player => {
      const playerId = player.id || player.player_id;
      const playerName = player.name;
      
      // Check if player is drafted by ID or name
      return !draftedPlayerIds.has(playerId) && !draftedPlayerIds.has(playerName);
    });
  }

  /**
   * Calculate average points for a tier
   * @param {Array} tierPlayers - Players in the tier
   * @returns {Number} Average projected points
   */
  calculateTierAverage(tierPlayers) {
    if (!tierPlayers || tierPlayers.length === 0) {
      return 0;
    }

    const totalPoints = tierPlayers.reduce((sum, player) => 
      sum + (player.projected_2025_points || 0), 0
    );

    return Math.round((totalPoints / tierPlayers.length) * 100) / 100;
  }

  /**
   * Get tier for a specific player
   * @param {Object} player - Player object
   * @param {String} position - Player's position
   * @param {Array} playerDatabase - All players
   * @returns {Object} Player's tier information
   */
  getPlayerTier(player, position, playerDatabase) {
    const positionPlayers = playerDatabase.filter(p => p.position === position);
    const tiers = this.createValueTiers(positionPlayers, position);
    
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const playerInTier = tier.players.find(p => 
        p.name === player.name || p.id === player.id
      );
      
      if (playerInTier) {
        return {
          tierNumber: tier.tierNumber,
          tierRank: playerInTier.tierRank,
          tierSize: tier.tierSize,
          tierAverage: tier.averagePoints,
          isTopOfTier: playerInTier.tierRank === 1,
          isBottomOfTier: playerInTier.tierRank === tier.tierSize
        };
      }
    }

    return null; // Player not found in tiers
  }

  /**
   * Compare two positions for scarcity
   * @param {String} position1 - First position
   * @param {String} position2 - Second position
   * @param {Array} playerDatabase - All players
   * @param {Object} draftContext - Draft context
   * @returns {Object} Comparison result
   */
  comparePositionScarcity(position1, position2, playerDatabase, draftContext = {}) {
    const scarcity1 = this.analyzePositionScarcity(
      position1,
      playerDatabase.filter(p => p.position === position1),
      draftContext
    );
    
    const scarcity2 = this.analyzePositionScarcity(
      position2,
      playerDatabase.filter(p => p.position === position2),
      draftContext
    );

    return {
      position1: {
        position: position1,
        scarcityScore: scarcity1.scarcityScore,
        competitionLevel: scarcity1.competitionLevel
      },
      position2: {
        position: position2,
        scarcityScore: scarcity2.scarcityScore,
        competitionLevel: scarcity2.competitionLevel
      },
      moreScarcePosiiton: scarcity1.scarcityScore > scarcity2.scarcityScore ? position1 : position2,
      scarcityDifference: Math.abs(scarcity1.scarcityScore - scarcity2.scarcityScore),
      recommendation: this.generateScarcityComparison(scarcity1, scarcity2)
    };
  }

  /**
   * Generate scarcity comparison recommendation
   * @param {Object} scarcity1 - First position scarcity
   * @param {Object} scarcity2 - Second position scarcity
   * @returns {String} Recommendation text
   */
  generateScarcityComparison(scarcity1, scarcity2) {
    const diff = Math.abs(scarcity1.scarcityScore - scarcity2.scarcityScore);
    const moreScarcePosiiton = scarcity1.scarcityScore > scarcity2.scarcityScore 
      ? scarcity1.position 
      : scarcity2.position;

    if (diff < 10) {
      return `${scarcity1.position} and ${scarcity2.position} have similar scarcity - draft based on player value`;
    } else if (diff < 25) {
      return `${moreScarcePosiiton} is moderately more scarce - consider prioritizing if values are close`;
    } else {
      return `${moreScarcePosiiton} is significantly more scarce - strong priority unless major value difference`;
    }
  }

  /**
   * Update position depth expectations
   * @param {Object} newDepth - New depth expectations by position
   */
  updatePositionDepth(newDepth) {
    this.positionDepth = { ...this.positionDepth, ...newDepth };
  }

  /**
   * Update tier configuration
   * @param {Object} newConfig - New tier configuration
   */
  updateTierConfiguration(newConfig) {
    if (newConfig.tierSizeLimits) {
      this.tierSizeLimits = { ...this.tierSizeLimits, ...newConfig.tierSizeLimits };
    }
    if (newConfig.dropoffThresholds) {
      this.dropoffThresholds = { ...this.dropoffThresholds, ...newConfig.dropoffThresholds };
    }
  }
}