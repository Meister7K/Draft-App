export class PerfectDraftEngine {
  constructor(
    availablePlayers,
    rosters,
    draftOrder,
    rosterPositions,
    year,
    totalRounds = 15
  ) {
    this.availablePlayers = availablePlayers;
    this.rosters = rosters;
    this.draftOrder = draftOrder;
    this.rosterPositions = rosterPositions;
    this.totalRounds = totalRounds;
    this.totalPicks = draftOrder.length * totalRounds;
    this.year = year;

    // Cache for expensive calculations
    this.tierCache = {};
    this.scarcityCache = {};
    this.projectionCache = {};
  }

  getOptimalPick(currentPickNumber, managerId, availablePlayers, rosters) {
    const currentRoster = rosters[managerId];
    const nextPickNumber = this.getNextPickNumber(currentPickNumber, managerId);
    const picksUntilNextTurn = this.getPicksUntilNextTurn(
      currentPickNumber,
      managerId
    );

    // Get eligible players for this manager
    const eligiblePlayers = this.getEligiblePlayers(
      availablePlayers,
      currentRoster.positionNeeds
    );

    if (eligiblePlayers.length === 0) {
      return this.getBestAvailablePlayer(availablePlayers, currentPickNumber);
    }

    // Perform tradeoff analysis for each eligible player
    const analyzedPlayers = eligiblePlayers.map((player) => ({
      player,
      analysis: this.performTradeoffAnalysis(
        player,
        currentRoster,
        currentPickNumber,
        nextPickNumber,
        picksUntilNextTurn,
        availablePlayers,
        rosters
      ),
    }));

    // Sort by total value (immediate + opportunity adjusted)
    analyzedPlayers.sort(
      (a, b) => b.analysis.totalValue - a.analysis.totalValue
    );

    const bestPick = analyzedPlayers[0];

    return {
      player: bestPick.player,
      analysis: bestPick.analysis,
      reasoning: this.generateAdvancedReasoning(
        bestPick.player,
        bestPick.analysis,
        currentPickNumber
      ),
    };
  }

  // Snake draft mechanics
  getNextPickNumber(currentPickNumber, managerId) {
    const numTeams = this.draftOrder.length;
    const currentRound = Math.ceil(currentPickNumber / numTeams);
    const positionInRound = ((currentPickNumber - 1) % numTeams) + 1;
    const managerPosition = this.draftOrder.indexOf(managerId) + 1;

    // If we're at the last round, no next pick
    if (currentRound >= this.totalRounds) return null;

    let nextRound = currentRound + 1;
    let nextPosition;

    // Snake logic: odd rounds go 1->N, even rounds go N->1
    if (nextRound % 2 === 1) {
      // Normal order
      nextPosition = managerPosition;
    } else {
      // Reverse order
      nextPosition = numTeams - managerPosition + 1;
    }

    return (nextRound - 1) * numTeams + nextPosition;
  }

  getPicksUntilNextTurn(currentPickNumber, managerId) {
    const nextPick = this.getNextPickNumber(currentPickNumber, managerId);
    return nextPick ? nextPick - currentPickNumber : null;
  }

  getRoundNumber(pickNumber) {
    return Math.ceil(pickNumber / this.draftOrder.length);
  }

  // Advanced tradeoff analysis
  performTradeoffAnalysis(
    player,
    currentRoster,
    currentPick,
    nextPick,
    picksUntilNext,
    availablePlayers,
    allRosters
  ) {
    const position = player.player_info.position;

    // 1. Calculate immediate value
    const immediateValue = this.calculateImmediateValue(
      player,
      currentRoster,
      currentPick,
      this.year
    );

    // 2. Calculate opportunity cost
    const opportunityCost = this.calculateOpportunityCost(
      player,
      nextPick,
      picksUntilNext,
      availablePlayers,
      currentRoster
    );

    // 3. Analyze tier positioning
    const tierAnalysis = this.analyzeTierPosition(player, availablePlayers);

    // 4. Predict positional runs
    const runPrediction = this.predictPositionalRuns(
      position,
      currentPick,
      allRosters,
      availablePlayers
    );

    // 5. Calculate positional scarcity trajectory
    const scarcityTrajectory = this.calculateScarcityTrajectory(
      position,
      currentPick,
      nextPick,
      availablePlayers
    );

    // 6. Evaluate wait vs draft decision
    const waitVsDraft = this.evaluateWaitVsDraft(
      player,
      currentPick,
      nextPick,
      availablePlayers,
      currentRoster
    );

    // Combine all factors into total value
    const totalValue = this.calculateTotalValue({
      immediateValue,
      opportunityCost,
      tierAnalysis,
      runPrediction,
      scarcityTrajectory,
      waitVsDraft,
    });

    return {
      immediateValue,
      opportunityCost,
      tierAnalysis,
      runPrediction,
      scarcityTrajectory,
      waitVsDraft,
      totalValue,
    };
  }

  calculateImmediateValue(player, currentRoster, currentPick, year) {
    const position = player.player_info.position;
    const projectedPoints =
      player.seasons[year]?.season_projected_totals?.pts_half_ppr || 0;
    const adp = player.seasons[year]?.season_projected_totals?.adp_2qb || 999;

    let value = 0;

    // Base projected points value (0-40)
    value += Math.min(40, (projectedPoints / 400) * 40);
    // console.log("start: "+value)

    // Position need urgency (0-25)
    const positionNeed = currentRoster.positionNeeds[position] || 0;
    if (positionNeed > 0) {
      const urgency = Math.min(25, (6 - positionNeed) * 5); // Higher urgency = higher value
      value += urgency;
    }

    // ADP value (0-20)
    const adpValue = Math.max(0, Math.min(20, ((adp - currentPick) / 50) * 20));

    value -= adpValue;
    // console.log("adp: "+adpValue)

    // Starting lineup impact (0-15)
    const lineupImpact = this.calculateStartingLineupImpact(
      player,
      currentRoster
    );
    value += lineupImpact;
    // console.log("impact: "+lineupImpact)

    return Math.min(100, value);
  }

  calculateOpportunityCost(
    player,
    nextPick,
    picksUntilNext,
    availablePlayers,
    currentRoster
  ) {
    if (!nextPick || picksUntilNext === null) return 0;

    const currentPlayerValue =
      player.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0;
    const currentPosition = player.player_info.position;

    // Get all positions this manager needs
    const neededPositions = Object.keys(currentRoster.positionNeeds)
      .filter((pos) => (currentRoster.positionNeeds[pos] || 0) > 0)
      .concat(["FLEX", "BENCH"]); // Always consider FLEX and BENCH

    // Calculate the best available player for each needed position
    const positionOptions = {};

    neededPositions.forEach((position) => {
      let eligiblePlayers;

      if (position === "FLEX") {
        // FLEX can be RB, WR, or TE
        eligiblePlayers = availablePlayers.filter((p) =>
          ["RB", "WR", "TE"].includes(p.player_info.position)
        );
      } else if (position === "BENCH") {
        // BENCH can be any position
        eligiblePlayers = availablePlayers;
      } else {
        // Specific position
        eligiblePlayers = availablePlayers.filter(
          (p) => p.player_info.position === position
        );
      }

      // Sort by projected points
      eligiblePlayers.sort((a, b) => {
        const aPoints =
          a.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0;
        const bPoints =
          b.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0;
        return bPoints - aPoints;
      });

      if (eligiblePlayers.length > 0) {
        // Estimate how many will be taken before next pick
        const positionDraftRate = this.getPositionDraftRate(
          position === "FLEX" ? "FLEX" : position === "BENCH" ? "ALL" : position
        );
        const estimatedTaken = Math.min(
          Math.floor(picksUntilNext * positionDraftRate),
          eligiblePlayers.length - 1
        );

        const bestAvailableAtNextPick = eligiblePlayers[estimatedTaken];
        if (bestAvailableAtNextPick) {
          const projectedValue =
            bestAvailableAtNextPick.seasons[this.year]?.season_projected_totals
              ?.pts_half_ppr || 0;

          // Weight by position need urgency
          const positionNeed = currentRoster.positionNeeds[position] || 0;
          const urgencyMultiplier =
            position === "BENCH"
              ? 0.3
              : position === "FLEX"
              ? 0.7
              : Math.min(2.0, positionNeed * 0.5);

          positionOptions[position] = {
            player: eligiblePlayers[0], // Best available now
            nextPickPlayer: bestAvailableAtNextPick,
            currentValue:
              eligiblePlayers[0].seasons[this.year]?.season_projected_totals
                ?.pts_half_ppr || 0,
            nextPickValue: projectedValue,
            urgencyMultiplier,
            estimatedTaken,
          };
        }
      }
    });

    // Find the best alternative option we could take at our next pick
    let bestAlternativeValue = 0;
    let bestAlternativePosition = null;

    Object.entries(positionOptions).forEach(([position, option]) => {
      const weightedValue = option.nextPickValue * option.urgencyMultiplier;
      if (weightedValue > bestAlternativeValue) {
        bestAlternativeValue = weightedValue;
        bestAlternativePosition = position;
      }
    });

    // Calculate comprehensive opportunity cost by evaluating all position tradeoffs
    let opportunityCost = 0;
    let maxTradeoffValue = 0;

    // 1. Calculate the value drop for the current position if we wait
    if (positionOptions[currentPosition]) {
      const currentPositionOption = positionOptions[currentPosition];
      const positionValueDrop =
        currentPlayerValue - currentPositionOption.nextPickValue;
      const weightedDrop =
        positionValueDrop * currentPositionOption.urgencyMultiplier;
      opportunityCost += weightedDrop;
      maxTradeoffValue = Math.max(maxTradeoffValue, Math.abs(weightedDrop));
    }

    // 2. Evaluate what we're giving up at ALL other needed positions
    Object.entries(positionOptions).forEach(([position, option]) => {
      if (position !== currentPosition) {
        // What's the best player we could get at this position now vs next pick
        const positionValueDrop = option.currentValue - option.nextPickValue;
        const weightedDrop = positionValueDrop * option.urgencyMultiplier;

        // This represents the opportunity cost of NOT taking this position now
        const positionOpportunityCost = weightedDrop * 0.7; // Weight other positions slightly less

        // If this alternative position has high value and urgency, increase opportunity cost
        if (positionOpportunityCost > 0) {
          opportunityCost += positionOpportunityCost;
          maxTradeoffValue = Math.max(
            maxTradeoffValue,
            positionOpportunityCost
          );
        }
      }
    });

    // 3. Calculate the best alternative tradeoff
    let bestTradeoffValue = 0;
    Object.entries(positionOptions).forEach(([position, option]) => {
      if (position !== currentPosition) {
        // Compare taking this player now vs the best alternative at this position
        const tradeoffValue =
          (option.currentValue - currentPlayerValue) * option.urgencyMultiplier;
        bestTradeoffValue = Math.max(bestTradeoffValue, tradeoffValue);
      }
    });

    // 4. Adjust opportunity cost based on best alternative
    if (bestTradeoffValue > 0) {
      // If there's a significantly better alternative, reduce the opportunity cost
      opportunityCost -= bestTradeoffValue * 0.4;
    }

    // 5. Factor in positional scarcity
    const currentPositionScarcity = this.calculatePositionScarcity(
      currentPosition,
      availablePlayers
    );
    const scarcityMultiplier = 1 + currentPositionScarcity * 0.3; // Up to 30% increase for scarce positions
    opportunityCost *= scarcityMultiplier;

    // Normalize to 0-50 scale with better distribution
    const normalizedCost = Math.max(
      0,
      Math.min(50, (opportunityCost / Math.max(100, maxTradeoffValue)) * 50)
    );

    return normalizedCost;
  }

  analyzeTierPosition(player, availablePlayers) {
    const position = player.player_info.position;
    const cacheKey = `${position}_tiers`;

    if (!this.tierCache[cacheKey]) {
      this.tierCache[cacheKey] = this.calculatePositionTiers(
        position,
        availablePlayers
      );
    }

    const tiers = this.tierCache[cacheKey];
    const playerPoints =
      player.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0;

    // Find which tier this player belongs to
    let tierNumber = 1;
    let isLastInTier = false;
    let tierBreakValue = 0;

    for (const tier of tiers) {
      if (playerPoints >= tier.minPoints) {
        isLastInTier =
          tier.players.length === 1 ||
          tier.players[tier.players.length - 1].player_info.player_id ===
            player.player_info.player_id;
        tierBreakValue = isLastInTier ? tier.dropoffToNext : 0;
        break;
      }
      tierNumber++;
    }

    return {
      tierNumber,
      isLastInTier,
      tierBreakValue: Math.min(30, (tierBreakValue / 20) * 30), // 0-30 scale
    };
  }

  calculatePositionTiers(position, availablePlayers) {
    const positionPlayers = availablePlayers
      .filter((p) => p.player_info.position === position)
      .sort(
        (a, b) =>
          (b.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0) -
          (a.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0)
      );

    const tiers = [];
    let currentTier = [];
    let lastPoints = null;

    for (const player of positionPlayers) {
      const points =
        player.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0;

      if (lastPoints === null) {
        currentTier = [player];
        lastPoints = points;
      } else {
        const dropoff = lastPoints - points;

        // Significant dropoff indicates new tier (adjust threshold by position)
        const dropoffThreshold =
          position === "QB" ? 15 : position === "TE" ? 10 : 20;

        if (dropoff > dropoffThreshold && currentTier.length > 0) {
          // Finish current tier
          tiers.push({
            players: [...currentTier],
            minPoints:
              currentTier[currentTier.length - 1].seasons[this.year]
                ?.season_projected_totals?.pts_half_ppr || 0,
            maxPoints:
              currentTier[0].seasons[this.year]?.season_projected_totals
                ?.pts_half_ppr || 0,
            dropoffToNext: dropoff,
          });
          currentTier = [player];
        } else {
          currentTier.push(player);
        }
        lastPoints = points;
      }
    }

    // Add final tier
    if (currentTier.length > 0) {
      tiers.push({
        players: currentTier,
        minPoints:
          currentTier[currentTier.length - 1].seasons[this.year]
            ?.season_projected_totals?.pts_half_ppr || 0,
        maxPoints:
          currentTier[0].seasons[this.year]?.season_projected_totals
            ?.pts_half_ppr || 0,
        dropoffToNext: 0,
      });
    }

    return tiers;
  }

  predictPositionalRuns(position, currentPick, allRosters, availablePlayers) {
    // Calculate how many teams need this position
    let teamsNeedingPosition = 0;
    Object.values(allRosters).forEach((roster) => {
      if ((roster.positionNeeds[position] || 0) > 0) {
        teamsNeedingPosition++;
      }
    });

    // Calculate available supply
    const availableAtPosition = availablePlayers.filter(
      (p) => p.player_info.position === position
    ).length;

    // Predict run likelihood based on supply/demand
    const demandRatio = teamsNeedingPosition / availableAtPosition;
    const runProbability = Math.min(1, demandRatio * 0.8);

    // Higher value if run is likely
    const runRisk = runProbability * 25; // 0-25 scale

    return {
      teamsNeedingPosition,
      availableAtPosition,
      runProbability,
      runRisk,
    };
  }

  calculateScarcityTrajectory(
    position,
    currentPick,
    nextPick,
    availablePlayers
  ) {
    if (!nextPick) return { scarcityIncrease: 0 };

    const picksBetween = nextPick - currentPick;
    const positionPlayers = availablePlayers.filter(
      (p) => p.player_info.position === position
    );

    // Estimate how many of this position will be taken
    const estimatedTaken = Math.min(
      Math.floor(picksBetween * this.getPositionDraftRate(position)),
      positionPlayers.length
    );

    const currentScarcity = positionPlayers.length / availablePlayers.length;
    const futureAvailable = Math.max(
      0,
      positionPlayers.length - estimatedTaken
    );
    const futureTotal = Math.max(1, availablePlayers.length - picksBetween);
    const futureScarcity = futureAvailable / futureTotal;

    const scarcityIncrease = Math.max(
      0,
      (currentScarcity - futureScarcity) * 100
    );

    return {
      currentScarcity,
      futureScarcity,
      scarcityIncrease: Math.min(20, scarcityIncrease), // 0-20 scale
    };
  }

  getPositionDraftRate(position) {
    // Historical draft rates by position
    const rates = {
      QB: 0.15,
      RB: 0.35,
      WR: 0.35,
      TE: 0.15,
      FLEX: 0.25, // RB/WR/TE combined rate
      ALL: 1.0, // For BENCH, any position can be drafted
    };
    return rates[position] || 0.25;
  }

  calculatePositionScarcity(position, availablePlayers) {
    // Calculate how scarce this position is relative to league needs
    const positionPlayers = availablePlayers.filter(
      (p) => p.player_info.position === position
    );
    const totalPlayers = availablePlayers.length;

    if (totalPlayers === 0) return 1.0; // Maximum scarcity if no players available

    const positionRatio = positionPlayers.length / totalPlayers;
    const expectedRatio = this.getPositionDraftRate(position);

    // Scarcity is higher when actual ratio is lower than expected
    const scarcity = Math.max(
      0,
      (expectedRatio - positionRatio) / expectedRatio
    );

    return Math.min(1.0, scarcity); // Cap at 1.0
  }

  evaluateWaitVsDraft(
    player,
    currentPick,
    nextPick,
    availablePlayers,
    currentRoster
  ) {
    if (!nextPick) return { shouldWait: false, waitValue: 0 };

    const position = player.player_info.position;
    const positionNeed = currentRoster.positionNeeds[position] || 0;

    // If urgent need, don't wait
    if (positionNeed >= 3) {
      return { shouldWait: false, waitValue: -10 };
    }

    // Calculate expected value of waiting
    const positionPlayers = availablePlayers
      .filter((p) => p.player_info.position === position)
      .sort(
        (a, b) =>
          (b.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0) -
          (a.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0)
      );

    const playerRank = positionPlayers.findIndex(
      (p) => p.player_info.player_id === player.player_info.player_id
    );
    const picksUntilNext = nextPick - currentPick;

    // Estimate how many will be taken
    const estimatedTaken = Math.floor(
      picksUntilNext * this.getPositionDraftRate(position)
    );

    if (playerRank < estimatedTaken) {
      // Player likely to be gone
      return { shouldWait: false, waitValue: -15 };
    }

    // Player might still be available - check alternative value
    const alternativePositions = ["QB", "RB", "WR", "TE"].filter(
      (pos) => pos !== position && (currentRoster.positionNeeds[pos] || 0) > 0
    );

    let bestAlternativeValue = 0;
    alternativePositions.forEach((altPos) => {
      const altPlayers = availablePlayers.filter(
        (p) => p.player_info.position === altPos
      );
      if (altPlayers.length > 0) {
        const bestAlt = altPlayers.reduce((best, p) =>
          (p.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0) >
          (best.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0)
            ? p
            : best
        );
        bestAlternativeValue = Math.max(
          bestAlternativeValue,
          bestAlt.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0
        );
      }
    });

    const waitValue =
      bestAlternativeValue >
      (player.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0)
        ? 10
        : -5;

    return {
      shouldWait: waitValue > 0,
      waitValue: Math.max(-15, Math.min(15, waitValue)),
    };
  }

  calculateTotalValue(factors) {
    const {
      immediateValue,
      opportunityCost,
      tierAnalysis,
      runPrediction,
      scarcityTrajectory,
      waitVsDraft,
    } = factors;

    // Weighted combination of all factors
    return (
      immediateValue * 0.3 + // 30% immediate value
      opportunityCost * 0.25 + // 25% opportunity cost
      tierAnalysis.tierBreakValue * 0.05 + // 20% tier breaks
      runPrediction.runRisk * 0.10 + // 15% run prediction
      scarcityTrajectory.scarcityIncrease * 0.05 + // 5% scarcity
      waitVsDraft.waitValue * 0.05 // 5% wait vs draft
    );
  }

  calculateStartingLineupImpact(player, currentRoster) {
    const position = player.player_info.position;
    const currentAtPosition = currentRoster.roster[position]?.length || 0;

    // High impact for filling starting slots
    if (currentAtPosition === 0) return 15; // First starter
    if (currentAtPosition === 1 && ["RB", "WR"].includes(position)) return 10; // Second starter
    if (currentAtPosition < 3) return 5; // Depth/flex

    return 0;
  }

  getEligiblePlayers(availablePlayers, positionNeeds) {
    const eligible = [];

    availablePlayers.forEach((player) => {
      const position = player.player_info.position;

      // Check if position is needed or can go to bench/flex
      if (
        positionNeeds[position] > 0 ||
        (positionNeeds.FLEX > 0 && ["RB", "WR", "TE"].includes(position)) ||
        positionNeeds.BENCH > 0
      ) {
        eligible.push(player);
      }
    });

    return eligible;
  }

  getBestAvailablePlayer(availablePlayers, currentPick) {
    const sorted = availablePlayers.sort((a, b) => {
      const aPoints =
        a.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0;
      const bPoints =
        b.seasons[this.year]?.season_projected_totals?.pts_half_ppr || 0;
      return bPoints - aPoints;
    });

    return {
      player: sorted[0],
      analysis: {
        immediateValue: 30,
        totalValue: 30,
      },
      reasoning: "Best available player - roster construction complete",
    };
  }

  generateAdvancedReasoning(player, analysis, currentPick) {
    const reasons = [];
    const {
      immediateValue,
      opportunityCost,
      tierAnalysis,
      runPrediction,
      waitVsDraft,
    } = analysis;

    // Primary decision factor
    if (immediateValue > 70) {
      reasons.push("High immediate value");
    } else if (opportunityCost > 30) {
      reasons.push("Significant opportunity cost");
    } else if (tierAnalysis.isLastInTier) {
      reasons.push("Last player in tier");
    }

    // Supporting factors
    if (runPrediction.runProbability > 0.6) {
      reasons.push("Positional run expected");
    }

    if (opportunityCost > 25) {
      reasons.push("May not be available at next pick");
    }

    if (waitVsDraft.shouldWait) {
      reasons.push("Could wait, but value is strong");
    }

    if (tierAnalysis.tierBreakValue > 15) {
      reasons.push("Major tier break after this player");
    }

    // Add value summary
    const valueDesc =
      analysis.totalValue > 80
        ? "Excellent"
        : analysis.totalValue > 60
        ? "Good"
        : "Reasonable";
    reasons.unshift(
      `${valueDesc} pick (${Math.round(analysis.totalValue)} value)`
    );

    return reasons.join(" • ");
  }

  // Utility method for draft analysis
  getDraftMetrics(currentPick) {
    return {
      round: this.getRoundNumber(currentPick),
      totalPicks: this.totalPicks,
      remainingPicks: this.totalPicks - currentPick,
      scarcityAnalysis: this.calculateLeaguePositionScarcity(),
      tierBreaks: this.getPositionValueDropoffs(),
    };
  }

  calculateLeaguePositionScarcity() {
    const positionCounts = {};

    this.availablePlayers.forEach((player) => {
      const position = player.player_info.position;
      positionCounts[position] = (positionCounts[position] || 0) + 1;
    });

    const scarcity = {};
    Object.keys(positionCounts).forEach((position) => {
      const available = positionCounts[position];
      const totalNeeded = Object.values(this.rosters).reduce(
        (sum, roster) => sum + (roster.positionNeeds[position] || 0),
        0
      );

      scarcity[position] = {
        available,
        needed: totalNeeded,
        ratio: available / Math.max(1, totalNeeded),
        scarcityLevel:
          available / Math.max(1, totalNeeded) < 1.5 ? "High" : "Normal",
      };
    });

    return scarcity;
  }

  getPositionValueDropoffs() {
    const dropoffs = {};

    ["QB", "RB", "WR", "TE"].forEach((position) => {
      const tiers = this.calculatePositionTiers(
        position,
        this.availablePlayers
      );
      dropoffs[position] = tiers.map((tier) => ({
        players: tier.players.length,
        topPoints: tier.maxPoints,
        bottomPoints: tier.minPoints,
        dropoffToNext: tier.dropoffToNext,
      }));
    });

    return dropoffs;
  }
}
