export class ActualDraftEngine {
  constructor(availablePlayers, draftInfo, leagueUsers, year) {
    this.availablePlayers = availablePlayers;
    this.draftInfo = draftInfo;
    this.leagueUsers = leagueUsers;
    this.year = year;
    
    // Cache for expensive calculations
    this.tierCache = {};
    this.scarcityCache = {};
    this.projectionCache = {};
  }

  /**
   * Analyze the entire draft and evaluate each pick
   */
  async analyzeEntireDraft(draftPicks) {
    console.log('[ActualDraftEngine] Starting draft analysis with', draftPicks.length, 'picks');
    
    const pickAnalyses = [];
    const managerGrades = {};
    const positionAnalysis = {};
    const roundAnalysis = {};
    
    // Initialize manager grades
    this.leagueUsers.forEach(user => {
      managerGrades[user.user_id] = {
        managerId: user.user_id,
        managerName: user.display_name,
        picks: [],
        averageGrade: 0,
        totalValue: 0,
        bestPick: null,
        worstPick: null,
        positionBreakdown: {}
      };
    });

    // Sort picks by pick number to analyze in draft order
    const sortedPicks = [...draftPicks].sort((a, b) => a.pick_no - b.pick_no);
    
    // Simulate the draft state at each pick
    for (let i = 0; i < sortedPicks.length; i++) {
      const currentPick = sortedPicks[i];
      const pickNumber = currentPick.pick_no;
      
      // Get available players at the time of this pick
      const availableAtPick = this.getAvailablePlayersAtPick(sortedPicks, i);
      
      // Calculate optimal pick for comparison
      const optimalPick = this.calculateOptimalPick(
        availableAtPick,
        pickNumber,
        currentPick.picked_by,
        sortedPicks.slice(0, i)
      );
      
      // Analyze this specific pick
      const pickAnalysis = await this.analyzeIndividualPick(
        currentPick,
        availableAtPick,
        pickNumber,
        sortedPicks.slice(0, i), // Previous picks
        optimalPick
      );
      
      pickAnalyses.push(pickAnalysis);
      
      // Update manager grades
      const managerId = currentPick.picked_by;
      if (managerGrades[managerId]) {
        managerGrades[managerId].picks.push(pickAnalysis);
        managerGrades[managerId].totalValue += pickAnalysis.grade;
        
        // Track best and worst picks
        if (!managerGrades[managerId].bestPick || pickAnalysis.grade > managerGrades[managerId].bestPick.grade) {
          managerGrades[managerId].bestPick = pickAnalysis;
        }
        if (!managerGrades[managerId].worstPick || pickAnalysis.grade < managerGrades[managerId].worstPick.grade) {
          managerGrades[managerId].worstPick = pickAnalysis;
        }
        
        // Position breakdown
        const position = currentPick.player_data?.player_info?.position;
        if (position) {
          if (!managerGrades[managerId].positionBreakdown[position]) {
            managerGrades[managerId].positionBreakdown[position] = {
              count: 0,
              totalGrade: 0,
              averageGrade: 0
            };
          }
          managerGrades[managerId].positionBreakdown[position].count++;
          managerGrades[managerId].positionBreakdown[position].totalGrade += pickAnalysis.grade;
          managerGrades[managerId].positionBreakdown[position].averageGrade = 
            managerGrades[managerId].positionBreakdown[position].totalGrade / 
            managerGrades[managerId].positionBreakdown[position].count;
        }
      }
      
      // Update position analysis
      const position = currentPick.player_data?.player_info?.position;
      if (position) {
        if (!positionAnalysis[position]) {
          positionAnalysis[position] = {
            totalPicks: 0,
            averageGrade: 0,
            totalGrade: 0,
            bestPick: null,
            worstPick: null,
            averageRound: 0,
            totalRound: 0
          };
        }
        
        positionAnalysis[position].totalPicks++;
        positionAnalysis[position].totalGrade += pickAnalysis.grade;
        positionAnalysis[position].averageGrade = positionAnalysis[position].totalGrade / positionAnalysis[position].totalPicks;
        positionAnalysis[position].totalRound += Math.ceil(pickNumber / (this.leagueUsers.length || 12));
        positionAnalysis[position].averageRound = positionAnalysis[position].totalRound / positionAnalysis[position].totalPicks;
        
        if (!positionAnalysis[position].bestPick || pickAnalysis.grade > positionAnalysis[position].bestPick.grade) {
          positionAnalysis[position].bestPick = pickAnalysis;
        }
        if (!positionAnalysis[position].worstPick || pickAnalysis.grade < positionAnalysis[position].worstPick.grade) {
          positionAnalysis[position].worstPick = pickAnalysis;
        }
      }
      
      // Update round analysis
      const round = Math.ceil(pickNumber / (this.leagueUsers.length || 12));
      if (!roundAnalysis[round]) {
        roundAnalysis[round] = {
          round,
          totalPicks: 0,
          averageGrade: 0,
          totalGrade: 0,
          bestPick: null,
          worstPick: null,
          positionBreakdown: {}
        };
      }
      
      roundAnalysis[round].totalPicks++;
      roundAnalysis[round].totalGrade += pickAnalysis.grade;
      roundAnalysis[round].averageGrade = roundAnalysis[round].totalGrade / roundAnalysis[round].totalPicks;
      
      if (!roundAnalysis[round].bestPick || pickAnalysis.grade > roundAnalysis[round].bestPick.grade) {
        roundAnalysis[round].bestPick = pickAnalysis;
      }
      if (!roundAnalysis[round].worstPick || pickAnalysis.grade < roundAnalysis[round].worstPick.grade) {
        roundAnalysis[round].worstPick = pickAnalysis;
      }
      
      if (position) {
        if (!roundAnalysis[round].positionBreakdown[position]) {
          roundAnalysis[round].positionBreakdown[position] = 0;
        }
        roundAnalysis[round].positionBreakdown[position]++;
      }
    }
    
    // Calculate final manager averages
    Object.values(managerGrades).forEach(manager => {
      if (manager.picks.length > 0) {
        manager.averageGrade = manager.totalValue / manager.picks.length;
      }
    });
    
    // Calculate overall draft statistics
    const overallStats = this.calculateOverallStats(pickAnalyses);
    
    console.log('[ActualDraftEngine] Analysis complete:', {
      totalPicks: pickAnalyses.length,
      averageGrade: overallStats.averageGrade,
      managersAnalyzed: Object.keys(managerGrades).length
    });
    
    return {
      pickAnalyses,
      managerGrades: Object.values(managerGrades).filter(m => m.picks.length > 0),
      positionAnalysis,
      roundAnalysis,
      overallStats,
      draftInfo: this.draftInfo
    };
  }

  /**
   * Calculate the optimal pick for a given situation
   */
  calculateOptimalPick(availablePlayers, pickNumber, managerId, previousPicks) {
    if (availablePlayers.length === 0) return null;
    
    // Calculate manager's current roster needs based on previous picks
    const managerPicks = previousPicks.filter(p => p.picked_by === managerId);
    const positionCounts = {};
    
    managerPicks.forEach(pick => {
      const position = pick.player_data?.player_info?.position;
      if (position) {
        positionCounts[position] = (positionCounts[position] || 0) + 1;
      }
    });
    
    // Score each available player
    const scoredPlayers = availablePlayers.map(player => ({
      player,
      score: this.calculateOptimalPickScore(player, pickNumber, positionCounts, availablePlayers)
    }));
    
    // Sort by score and return the best option
    scoredPlayers.sort((a, b) => b.score - a.score);
    

    
    const optimalPlayer = scoredPlayers[0];
    

    
    return {
      player: optimalPlayer.player,
      score: optimalPlayer.score,
      reasoning: this.generateOptimalPickReasoning(optimalPlayer.player, pickNumber, positionCounts)
    };
  }

  /**
   * Calculate optimal pick score for a player using improved logic
   */
  calculateOptimalPickScore(player, pickNumber, positionCounts, availablePlayers) {
    const projectedPoints = player.seasons?.[this.year]?.season_projected_totals?.pts_half_ppr || 0;
    const adp = player.seasons?.[this.year]?.season_projected_totals?.adp_2qb || 999;
    const position = player.player_info.position;
    
    let score = 0;
    
    // Base value from projected points (0-40)
    score += Math.min(40, (projectedPoints / 400) * 40);
    
    // Position need urgency (0-25)
    const currentAtPosition = positionCounts[position] || 0;
    const positionNeed = this.calculatePositionNeed(position, currentAtPosition, pickNumber);
    score += positionNeed;
    
    // ADP value (0-20) - penalize reaching too early, reward value
    const adpValue = Math.max(0, Math.min(20, ((adp - pickNumber) / 50) * 20));
    score -= Math.max(0, adpValue - 10); // Penalty for reaching
    score += Math.max(0, 10 - adpValue); // Bonus for value
    
    // Starting lineup impact (0-15)
    const lineupImpact = this.calculateLineupImpact(position, currentAtPosition);
    score += lineupImpact;
    
    // Position scarcity and tier analysis (0-20)
    const scarcityBonus = this.calculateAdvancedScarcity(position, availablePlayers, pickNumber);
    score += scarcityBonus;
    
    return Math.max(0, score);
  }

  /**
   * Calculate position need with more nuanced logic
   */
  calculatePositionNeed(position, currentCount, pickNumber) {
    const round = Math.ceil(pickNumber / (this.leagueUsers.length || 12));
    
    // Standard roster requirements
    const requirements = {
      QB: { min: 1, ideal: 2, max: 3 },
      RB: { min: 2, ideal: 4, max: 6 },
      WR: { min: 2, ideal: 4, max: 6 },
      TE: { min: 1, ideal: 2, max: 3 },
      K: { min: 1, ideal: 1, max: 2 },
      DEF: { min: 1, ideal: 1, max: 2 }
    };
    
    const req = requirements[position] || { min: 0, ideal: 1, max: 2 };
    
    // Urgent need (haven't met minimum)
    if (currentCount < req.min) {
      if (round <= 10) return 25;
      if (round <= 13) return 20;
      return 15;
    }
    
    // Filling to ideal
    if (currentCount < req.ideal) {
      if (position === 'RB' || position === 'WR') {
        if (round <= 8) return 15;
        if (round <= 12) return 10;
      }
      if (position === 'QB' && round >= 8) return 12;
      if (position === 'TE' && round >= 6) return 8;
      return 5;
    }
    
    // Depth/upside picks
    if (currentCount < req.max) {
      if ((position === 'RB' || position === 'WR') && round >= 10) return 3;
      return 1;
    }
    
    return 0;
  }

  /**
   * Calculate starting lineup impact
   */
  calculateLineupImpact(position, currentCount) {
    if (currentCount === 0) return 15; // First starter
    if (currentCount === 1 && ['RB', 'WR'].includes(position)) return 10; // Second starter
    if (currentCount < 3 && ['RB', 'WR'].includes(position)) return 5; // Flex consideration
    return 0;
  }

  /**
   * Calculate advanced scarcity including tier breaks
   */
  calculateAdvancedScarcity(position, availablePlayers, pickNumber) {
    const positionPlayers = availablePlayers
      .filter(p => p.player_info.position === position)
      .sort((a, b) => {
        const aPoints = a.seasons?.[this.year]?.season_projected_totals?.pts_half_ppr || 0;
        const bPoints = b.seasons?.[this.year]?.season_projected_totals?.pts_half_ppr || 0;
        return bPoints - aPoints;
      });
    
    if (positionPlayers.length === 0) return 0;
    
    // Find tier breaks (significant point drops)
    let tierBreakBonus = 0;
    for (let i = 0; i < Math.min(positionPlayers.length - 1, 10); i++) {
      const currentPoints = positionPlayers[i].seasons?.[this.year]?.season_projected_totals?.pts_half_ppr || 0;
      const nextPoints = positionPlayers[i + 1].seasons?.[this.year]?.season_projected_totals?.pts_half_ppr || 0;
      const dropoff = currentPoints - nextPoints;
      
      // Significant tier break
      if (dropoff > (position === 'QB' ? 15 : position === 'TE' ? 10 : 20)) {
        if (i < 3) tierBreakBonus += 15; // Top tier
        else if (i < 6) tierBreakBonus += 10; // Second tier
        else tierBreakBonus += 5; // Later tiers
        break;
      }
    }
    
    // Position scarcity relative to demand
    const scarcityRatio = positionPlayers.length / Math.max(1, availablePlayers.length * this.getExpectedPositionRatio(position));
    const scarcityBonus = scarcityRatio < 1 ? (1 - scarcityRatio) * 10 : 0;
    
    return Math.min(20, tierBreakBonus + scarcityBonus);
  }

  /**
   * Get position need bonus based on roster construction
   */
  getPositionNeedBonus(position, currentCount, pickNumber) {
    const round = Math.ceil(pickNumber / (this.leagueUsers.length || 12));
    
    // Early rounds - prioritize skill positions
    if (round <= 6) {
      if (position === 'RB' && currentCount < 2) return 25;
      if (position === 'WR' && currentCount < 2) return 25;
      if (position === 'QB' && currentCount === 0 && round >= 3) return 20;
      if (position === 'TE' && currentCount === 0 && round >= 4) return 15;
    }
    
    // Mid rounds - fill needs
    if (round <= 10) {
      if (position === 'QB' && currentCount === 0) return 30;
      if (position === 'TE' && currentCount === 0) return 25;
      if ((position === 'RB' || position === 'WR') && currentCount < 3) return 15;
    }
    
    // Late rounds - depth and upside
    if (position === 'K' && currentCount === 0 && round >= 14) return 20;
    if (position === 'DEF' && currentCount === 0 && round >= 13) return 20;
    
    return 0;
  }

  /**
   * Generate reasoning for optimal pick
   */
  generateOptimalPickReasoning(player, pickNumber, positionCounts) {
    const position = player.player_info.position;
    const round = Math.ceil(pickNumber / (this.leagueUsers.length || 12));
    const currentAtPosition = positionCounts[position] || 0;
    const projectedPoints = player.seasons?.[this.year]?.season_projected_totals?.pts_half_ppr || 0;
    
    const reasons = [];
    
    if (projectedPoints > 250) {
      reasons.push("High projected points");
    }
    
    if (currentAtPosition === 0) {
      reasons.push(`First ${position}`);
    } else if (currentAtPosition < 2 && ['RB', 'WR'].includes(position)) {
      reasons.push(`Second ${position} for depth`);
    }
    
    if (round <= 3 && ['RB', 'WR'].includes(position)) {
      reasons.push("Early round skill position");
    }
    
    if (round >= 10 && position === 'QB' && currentAtPosition === 0) {
      reasons.push("Late QB value");
    }
    
    return reasons.length > 0 ? reasons.join(" • ") : "Best available player";
  }

  /**
   * Analyze an individual pick and determine if it was optimal
   */
  async analyzeIndividualPick(pick, availablePlayers, pickNumber, previousPicks, optimalPick) {
    const pickedPlayer = pick.player_data;
    if (!pickedPlayer) {
      return {
        pick,
        grade: 0,
        reasoning: "Player data not available",
        betterOptions: [],
        pickValue: 0,
        opportunityCost: 0,
        optimalPick: null
      };
    }



    // Calculate the value of the picked player
    const pickedPlayerValue = this.calculatePlayerValue(pickedPlayer, pickNumber);
    
    // Find better alternatives that were available
    const betterOptions = this.findBetterAlternatives(
      pickedPlayer, 
      availablePlayers, 
      pickNumber,
      pick.picked_by,
      previousPicks
    );
    
    // Calculate opportunity cost
    const opportunityCost = betterOptions.length > 0 ? 
      Math.max(...betterOptions.map(p => this.calculatePlayerValue(p, pickNumber))) - pickedPlayerValue : 0;
    
    // Calculate grade (0-100)
    const grade = this.calculatePickGrade(
      pickedPlayer,
      pickNumber,
      betterOptions,
      opportunityCost,
      availablePlayers
    );
    
    // Generate reasoning
    const reasoning = this.generatePickReasoning(
      pickedPlayer,
      pickNumber,
      betterOptions,
      grade,
      opportunityCost
    );
    
    return {
      pick,
      pickedPlayer,
      grade: Math.round(grade),
      reasoning,
      betterOptions: betterOptions.slice(0, 5), // Top 5 alternatives
      pickValue: pickedPlayerValue,
      opportunityCost: Math.round(opportunityCost),
      pickNumber,
      round: Math.ceil(pickNumber / (this.leagueUsers.length || 12)),
      managerName: pick.manager_name,
      optimalPick: optimalPick // Add optimal pick for comparison
    };
  }

  /**
   * Get available players at the time of a specific pick
   */
  getAvailablePlayersAtPick(allPicks, pickIndex) {
    const picksUpToNow = allPicks.slice(0, pickIndex);
    const draftedPlayerIds = new Set(picksUpToNow.map(p => p.player_id));
    

    
    const availableAtThisPick = this.availablePlayers.filter(player => 
      !draftedPlayerIds.has(player.player_info.player_id)
    );
    

    
    return availableAtThisPick;
  }

  /**
   * Calculate the value of a player at a specific pick
   */
  calculatePlayerValue(player, pickNumber) {
    if (!player?.seasons?.[this.year]?.season_projected_totals) {
      return 0;
    }
    
    const projectedPoints = player.seasons[this.year].season_projected_totals.pts_half_ppr || 0;
    const adp = player.seasons[this.year].season_projected_totals.adp_2qb || 999;
    const position = player.player_info.position;
    
    let value = 0;
    
    // Base projected points value (0-50)
    value += Math.min(50, (projectedPoints / 300) * 50);
    
    // ADP value - positive if picked later than ADP, negative if earlier
    const adpDifference = adp - pickNumber;
    value += Math.max(-25, Math.min(25, adpDifference * 0.5));
    
    // Position scarcity bonus
    const positionMultiplier = this.getPositionScarcityMultiplier(position);
    value *= positionMultiplier;
    
    // Round adjustment - higher value for good picks in later rounds
    const round = Math.ceil(pickNumber / (this.leagueUsers.length || 12));
    if (round > 5 && projectedPoints > 150) {
      value += 10; // Bonus for finding value in later rounds
    }
    
    return Math.max(0, value);
  }

  /**
   * Find better alternatives that were available at pick time
   */
  findBetterAlternatives(pickedPlayer, availablePlayers, pickNumber, managerId, previousPicks) {
    const pickedPlayerValue = this.calculatePlayerValue(pickedPlayer, pickNumber);
    
    return availablePlayers
      .filter(player => {
        const playerValue = this.calculatePlayerValue(player, pickNumber);
        return playerValue > pickedPlayerValue;
      })
      .sort((a, b) => {
        const aValue = this.calculatePlayerValue(a, pickNumber);
        const bValue = this.calculatePlayerValue(b, pickNumber);
        return bValue - aValue;
      });
  }

  /**
   * Calculate a grade for the pick (0-100)
   */
  calculatePickGrade(player, pickNumber, betterOptions, opportunityCost, availablePlayers) {
    let grade = 50; // Start at average
    
    // Base player value component (0-40 points)
    const playerValue = this.calculatePlayerValue(player, pickNumber);
    grade += Math.min(40, playerValue * 0.4);
    
    // Opportunity cost penalty (0-30 points deducted)
    if (betterOptions.length > 0) {
      const penaltyFactor = Math.min(1, betterOptions.length / 10); // More alternatives = bigger penalty
      grade -= Math.min(30, opportunityCost * 0.3 * penaltyFactor);
    }
    
    // ADP accuracy bonus/penalty (±10 points)
    if (player?.seasons?.[this.year]?.season_projected_totals?.adp_2qb) {
      const adp = player.seasons[this.year].season_projected_totals.adp_2qb;
      const adpDifference = Math.abs(adp - pickNumber);
      
      if (adpDifference <= 5) {
        grade += 10; // Bonus for picking near ADP
      } else if (adpDifference > 20) {
        grade -= 10; // Penalty for picking way off ADP
      }
    }
    
    // Position scarcity consideration (±5 points)
    const position = player.player_info.position;
    const positionScarcity = this.calculatePositionScarcity(position, availablePlayers);
    if (positionScarcity > 0.7) {
      grade += 5; // Bonus for picking scarce positions
    }
    
    // Round context adjustment
    const round = Math.ceil(pickNumber / (this.leagueUsers.length || 12));
    if (round <= 3 && betterOptions.length > 5) {
      grade -= 5; // Penalty for missing obvious value in early rounds
    } else if (round > 10 && playerValue > 30) {
      grade += 5; // Bonus for finding value in late rounds
    }
    
    return Math.max(0, Math.min(100, grade));
  }

  /**
   * Generate reasoning text for the pick
   */
  generatePickReasoning(player, pickNumber, betterOptions, grade, opportunityCost) {
    const reasons = [];
    const round = Math.ceil(pickNumber / (this.leagueUsers.length || 12));
    const position = player.player_info.position;
    const projectedPoints = player.seasons?.[this.year]?.season_projected_totals?.pts_half_ppr || 0;
    const adp = player.seasons?.[this.year]?.season_projected_totals?.adp_2qb;
    
    // Grade-based primary assessment
    if (grade >= 85) {
      reasons.push("Excellent pick");
    } else if (grade >= 70) {
      reasons.push("Good value");
    } else if (grade >= 55) {
      reasons.push("Reasonable selection");
    } else if (grade >= 40) {
      reasons.push("Questionable choice");
    } else {
      reasons.push("Poor value");
    }
    
    // ADP context
    if (adp) {
      const adpDiff = pickNumber - adp;
      if (adpDiff < -10) {
        reasons.push("reached early");
      } else if (adpDiff > 10) {
        reasons.push("good value vs ADP");
      }
    }
    
    // Alternative context
    if (betterOptions.length > 0) {
      if (betterOptions.length <= 2) {
        reasons.push("few better options available");
      } else if (betterOptions.length <= 5) {
        reasons.push("some better alternatives existed");
      } else {
        reasons.push("many better players available");
      }
    } else {
      reasons.push("best available player");
    }
    
    // Round context
    if (round <= 3 && projectedPoints < 200) {
      reasons.push("low upside for early round");
    } else if (round > 8 && projectedPoints > 150) {
      reasons.push("solid late-round value");
    }
    
    // Position context
    if (position === "QB" && round <= 5) {
      reasons.push("early QB investment");
    } else if (position === "TE" && round <= 3) {
      reasons.push("premium TE selection");
    }
    
    return reasons.join(" • ");
  }

  /**
   * Calculate position scarcity multiplier
   */
  getPositionScarcityMultiplier(position) {
    const multipliers = {
      'QB': 1.0,
      'RB': 1.2,
      'WR': 1.1,
      'TE': 1.3,
      'K': 0.8,
      'DEF': 0.8
    };
    return multipliers[position] || 1.0;
  }

  /**
   * Calculate position scarcity at draft time
   */
  calculatePositionScarcity(position, availablePlayers) {
    const positionPlayers = availablePlayers.filter(p => p.player_info.position === position);
    const totalPlayers = availablePlayers.length;
    
    if (totalPlayers === 0) return 1.0;
    
    const positionRatio = positionPlayers.length / totalPlayers;
    const expectedRatio = this.getExpectedPositionRatio(position);
    
    // Scarcity is higher when actual ratio is lower than expected
    return Math.max(0, (expectedRatio - positionRatio) / expectedRatio);
  }

  /**
   * Get expected position ratio in draft
   */
  getExpectedPositionRatio(position) {
    const ratios = {
      'QB': 0.15,
      'RB': 0.35,
      'WR': 0.35,
      'TE': 0.15
    };
    return ratios[position] || 0.1;
  }

  /**
   * Calculate overall draft statistics
   */
  calculateOverallStats(pickAnalyses) {
    if (pickAnalyses.length === 0) {
      return {
        totalPicks: 0,
        averageGrade: 0,
        excellentPicks: 0,
        poorPicks: 0,
        totalOpportunityCost: 0
      };
    }
    
    const totalGrade = pickAnalyses.reduce((sum, pick) => sum + pick.grade, 0);
    const excellentPicks = pickAnalyses.filter(pick => pick.grade >= 85).length;
    const poorPicks = pickAnalyses.filter(pick => pick.grade < 40).length;
    const totalOpportunityCost = pickAnalyses.reduce((sum, pick) => sum + pick.opportunityCost, 0);
    
    return {
      totalPicks: pickAnalyses.length,
      averageGrade: Math.round(totalGrade / pickAnalyses.length),
      excellentPicks,
      poorPicks,
      totalOpportunityCost: Math.round(totalOpportunityCost),
      gradeDistribution: {
        excellent: excellentPicks,
        good: pickAnalyses.filter(pick => pick.grade >= 70 && pick.grade < 85).length,
        average: pickAnalyses.filter(pick => pick.grade >= 55 && pick.grade < 70).length,
        poor: pickAnalyses.filter(pick => pick.grade >= 40 && pick.grade < 55).length,
        terrible: poorPicks
      }
    };
  }
}