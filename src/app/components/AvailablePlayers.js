"use client";

import { useState, useEffect } from "react";

export function AvailablePlayers({
  data,
  draft,
  hoveredPlayer,
  setHoveredPlayer,
  tooltipPosition,
  setTooltipPosition,
  selectedManagerId,
  setSelectedManagerId,
  leagueUsers,

}) {
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [sortBy, setSortBy] = useState("overall_rank"); // "overall_rank", "projected_2025", "position_rank", "composite_value", "adp_2qb", "adp_ppr", "adp_half_ppr", "adp_std"
  const [selectedADP, setSelectedADP] = useState("adp_2qb"); // Default to 2QB ADP

  // Get position counts for the selected manager's drafted players
  const getManagerPositionCounts = () => {
    if (!selectedManagerId) return {};

    const managerPicks = draft.picks.filter(
      (pick) => pick.picked_by === selectedManagerId
    );
    const positionCounts = {};

    managerPicks.forEach((pick) => {
      const position = pick.metadata?.position;
      if (position) {
        positionCounts[position] = (positionCounts[position] || 0) + 1;
      }
    });

    return positionCounts;
  };


  const year = data.metadata.current_season
  
  // Calculate composite value for a player based on position scarcity and performance metrics
  const calculateCompositeValue = (player, currentPickNumber = null) => {
    const position = player.player_info.position;
    const overallRank = player.player_info.overall_rank || 999;
    const positionRank = player.player_info.position_rank || 999;
    const projectedPoints = player.player_info.projected_2025_points || 0;

    // Get current position counts for the selected manager
    const positionCounts = getManagerPositionCounts();

    // Starting lineup requirements: 2 QBs, 2 RBs, 2 WRs, 1 TE, 2 FLEX (RB/WR/TE eligible)
    const positionRequirements = {
      QB: 2, // Only 2 QB slots, no FLEX eligibility
      RB: 2 + 2, // 2 RB slots + 2 FLEX slots (can be filled by RB)
      WR: 2 + 2, // 2 WR slots + 2 FLEX slots (can be filled by WR)
      TE: 1 + 2, // 1 TE slot + 2 FLEX slots (can be filled by TE)
    };

    // Core position requirements (before FLEX consideration)
    const coreRequirements = {
      QB: 2, // Must have 2 QBs
      RB: 2, // Must have 2 RBs
      WR: 2, // Must have 2 WRs
      TE: 1, // Must have 1 TE
    };

    // Base position scarcity multipliers
    const baseMultipliers = {
      QB: 2.1, // High value due to 2QB format
      RB: 1.9, // High value due to scarcity and FLEX eligibility
      WR: 1.8, // Good value due to FLEX eligibility
      TE: 1.7, // Highest multiplier due to scarcity (only 1 required + FLEX eligible)
    };

    // Calculate dynamic multiplier based on how many of this position the manager already has
    const currentCount = positionCounts[position] || 0;
    const coreNeeded = coreRequirements[position] || 0;
    const maxNeeded = positionRequirements[position] || 1;
    const baseMultiplier = baseMultipliers[position] || 1.0;

    let finalMultiplier = baseMultiplier;

    // Position-specific value drops based on scarcity and FLEX eligibility
    if (position === "QB" && currentCount >= coreNeeded) {
      // QB: Drastic drop after 2 QBs (no FLEX eligibility)
      finalMultiplier = baseMultiplier * 0.3; // 35% reduction
    } else if (position === "TE" && currentCount >= coreNeeded) {
      // TE: Drastic drop after 1 TE (limited depth)
      finalMultiplier = baseMultiplier * 0.2; // 80% reduction
    } else if (
      (position === "RB" || position === "WR") &&
      currentCount >= coreNeeded
    ) {
      // RB/WR: Very gradual drop due to FLEX eligibility and deep position groups
      if (currentCount >= maxNeeded) {
        finalMultiplier = baseMultiplier * 0.7; // Only 30% reduction for excess (very forgiving)
      } else {
        // Very gradual reduction between core and max needed
        const progressToMax =
          (currentCount - coreNeeded) / (maxNeeded - coreNeeded);
        finalMultiplier = baseMultiplier * (1 - progressToMax * 0.25); // Only up to 25% reduction
      }
    } else if (currentCount >= maxNeeded) {
      // Heavy penalty for excess players at any position
      finalMultiplier = baseMultiplier * 0.3; // 70% reduction for excess players
    } else {
      // Gradual reduction for positions not yet at core requirement
      const reductionPerPlayer =
        position === "QB" || position === "TE" ? 0.25 : 0.08; // Even more forgiving for RB/WR
      const reduction = Math.min(currentCount * reductionPerPlayer, 0.5); // Lower cap
      finalMultiplier = Math.max(baseMultiplier * (1 - reduction), 0.5); // Higher minimum
    }

    // Draft position value adjustment - reward good players taken at later picks
    let draftPositionBonus = 1.0;
    if (currentPickNumber) {
      const expectedPickForRank = overallRank; // Rough approximation
      if (currentPickNumber > expectedPickForRank) {
        // Player available later than expected - significant bonus value
        const pickDifference = currentPickNumber - expectedPickForRank;
        // More generous bonus scaling: up to 100% bonus for major steals
        draftPositionBonus = 1.0 + Math.min(pickDifference / 50, 1.0); // Up to 100% bonus

        // Extra bonus for really late steals (50+ picks later than expected)
        if (pickDifference >= 50) {
          draftPositionBonus += Math.min((pickDifference - 50) / 100, 0.5); // Additional 50% bonus
        }
      }
    }

    // Normalize ranks (lower rank = higher value)
    const overallRankScore = Math.max(0, (300 - overallRank) / 300) * 100;
    const positionRankScore = Math.max(0, (100 - positionRank) / 100) * 100;

    // Normalize projected points (higher points = higher value)
    const maxProjectedPoints = 400; // Approximate max for normalization
    const projectedPointsScore = Math.min(
      (projectedPoints / maxProjectedPoints) * 100,
      100
    );

    // Weighted composite calculation
    const compositeValue =
      (overallRankScore * 0.25 + // 25% weight on overall rank
        positionRankScore * 0.15 + // 25% weight on position rank
        projectedPointsScore * 0.5 + // 40% weight on projected points
        (finalMultiplier - 1) * 10) * // 10% weight on position scarcity
      finalMultiplier *
      draftPositionBonus;

    return Math.round(compositeValue * 10) / 10; // Round to 1 decimal place
  };

  // Store static value scores for drafted players
  const getDraftedPlayerStaticValue = (playerId) => {
    const draftedPick = draft.picks.find(
      (pick) => pick.metadata?.player_id === playerId
    );
    if (!draftedPick) return null;

    const player = data.players.find(
      (p) => p.player_info.player_id === playerId
    );
    if (!player) return null;

    // Calculate value at time of draft using the pick number
    return calculateCompositeValue(player, draftedPick.pick_no);
  };

  // Get all drafted player IDs
  const draftedPlayerIds = new Set(
    draft.picks.map((pick) => pick.metadata?.player_id)
  );

  // Get available players with filtering and sorting
  const getAvailablePlayers = () => {
    let availablePlayers = data.players.filter(
      (p) => !draftedPlayerIds.has(p.player_info.player_id)
    );

    
    // Filter by selected positions
    if (selectedPositions.length > 0) {
      availablePlayers = availablePlayers.filter((p) =>
        selectedPositions.includes(p.player_info.position)
      );
    }

    // Sort based on selected criteria
    availablePlayers.sort((a, b) => {
      switch (sortBy) {
        case "projected_2025":
          return (
            (b.player_info.projected_2025_points || 0) -
            (a.player_info.projected_2025_points || 0)
          );
        case "position_rank":
          return (
            (a.player_info.position_rank || 999) -
            (b.player_info.position_rank || 999)
          );
        case "composite_value":
          const currentPickNumber = draft.picks.length + 1;
          return (
            calculateCompositeValue(b, currentPickNumber) -
            calculateCompositeValue(a, currentPickNumber)
          );
        case "adp_2qb":
        case "adp_ppr":
        case "adp_half_ppr":
        case "adp_std":
        case "adp_dynasty":
        case "adp_dynasty_2qb":
        case "adp_dynasty_half_ppr":
        case "adp_dynasty_ppr":
        case "adp_dynasty_std":
        case "adp_rookie":
        case "adp_idp":
          // For ADP, lower values are better (earlier picks)
          const aADP = a.seasons?.[year]?.season_projected_totals?.[sortBy] || 999;
          const bADP = b.seasons?.[year]?.season_projected_totals?.[sortBy] || 999;
          return aADP - bADP;
        case "overall_rank":
        default:
          return (
            (a.player_info.overall_rank || 999) -
            (b.player_info.overall_rank || 999)
          );
      }
    });


    return availablePlayers;
  };

  const availablePlayers = getAvailablePlayers();

  // Calculate static tier-based color highlighting for players by position (uses all players for consistent tiers)
  const getPlayerTierInfo = () => {
    const tierInfo = new Map();

    // Group ALL players by position (including drafted ones for static tier calculation)
    const playersByPosition = {};
    data.players.forEach((player) => {
      const position = player.player_info.position;
      if (!playersByPosition[position]) {
        playersByPosition[position] = [];
      }
      playersByPosition[position].push(player);
    });

    // Define tier colors (from best to worst)
    const tierColors = [
      {
        bg: "bg-purple-500/15",
        border: "border-purple-500/40",
        text: "text-purple-400",
        name: "Elite",
      },
      {
        bg: "bg-blue-500/15",
        border: "border-blue-500/40",
        text: "text-blue-400",
        name: "Tier 1",
      },
      {
        bg: "bg-green-500/15",
        border: "border-green-500/40",
        text: "text-green-400",
        name: "Tier 2",
      },
      {
        bg: "bg-yellow-500/15",
        border: "border-yellow-500/40",
        text: "text-yellow-400",
        name: "Tier 3",
      },
      {
        bg: "bg-orange-500/15",
        border: "border-orange-500/40",
        text: "text-orange-400",
        name: "Tier 4",
      },
      {
        bg: "bg-red-500/15",
        border: "border-red-500/40",
        text: "text-red-400",
        name: "Tier 5",
      },
      {
        bg: "bg-gray-500/15",
        border: "border-gray-500/40",
        text: "text-gray-400",
        name: "Deep",
      },
    ];

    // Analyze each position for tier breaks
    Object.entries(playersByPosition).forEach(([position, players]) => {
      // Sort players by projected points (descending)
      const sortedPlayers = [...players].sort(
        (a, b) =>
          (b.player_info.projected_2025_points || 0) -
          (a.player_info.projected_2025_points || 0)
      );

      if (sortedPlayers.length === 0) return;

      // Find significant drop-offs in projected points
      const tierBreaks = [0]; // Always start with tier 0
      const projectedPoints = sortedPlayers.map(
        (p) => p.player_info.projected_2025_points || 0
      );

      // Calculate percentage drops between consecutive players
      for (let i = 1; i < projectedPoints.length; i++) {
        const currentPoints = projectedPoints[i];
        const previousPoints = projectedPoints[i - 1];

        if (previousPoints > 0) {
          const dropPercentage =
            (previousPoints - currentPoints) / previousPoints;

          // Significant drop thresholds based on position
          let dropThreshold = 0.08; // 8% default
          if (position === "QB") dropThreshold = 0.06; // QBs have more consistent scoring
          if (position === "TE") dropThreshold = 0.1; // TEs have bigger gaps
          if (position === "K" || position === "DEF") dropThreshold = 0.12; // More volatile positions

          // Also consider absolute point drops
          const absoluteDrop = previousPoints - currentPoints;
          const absoluteThreshold =
            position === "QB" ? 15 : position === "TE" ? 8 : 10;

          if (
            dropPercentage >= dropThreshold ||
            absoluteDrop >= absoluteThreshold
          ) {
            tierBreaks.push(i);
          }
        }
      }

      // Limit to maximum number of tiers
      const maxTiers = Math.min(tierColors.length, tierBreaks.length);
      const finalTierBreaks = tierBreaks.slice(0, maxTiers);

      // Assign tier info to each player
      sortedPlayers.forEach((player, index) => {
        let tierIndex = 0;
        for (let i = finalTierBreaks.length - 1; i >= 0; i--) {
          if (index >= finalTierBreaks[i]) {
            tierIndex = i;
            break;
          }
        }

        // Ensure we don't exceed available colors
        tierIndex = Math.min(tierIndex, tierColors.length - 1);

        tierInfo.set(player.player_info.player_id, {
          tier: tierIndex + 1,
          tierName: tierColors[tierIndex].name,
          colors: tierColors[tierIndex],
          positionRankInTier: index - (finalTierBreaks[tierIndex] || 0) + 1,
          totalInTier:
            (finalTierBreaks[tierIndex + 1] || sortedPlayers.length) -
            (finalTierBreaks[tierIndex] || 0),
          overallPositionRank: index + 1, // Overall rank within position (including all players)
        });
      });
    });

    return tierInfo;
  };

  const playerTierInfo = getPlayerTierInfo();

  // Calculate which players should be highlighted for the selected manager's upcoming picks
  const getManagerPickHighlights = () => {
    if (!selectedManagerId || !draft) {
      return new Map();
    }

    const isDraftActive =
      draft.status === "drafting" || draft.status === "paused";
    if (!isDraftActive) {
      return new Map();
    }

    // Get draft slot from draft_order data
    const draftSlot = draft.draft_order?.[selectedManagerId];
    if (!draftSlot) {
      return new Map();
    }

    // Get team count from draft settings or calculate from draft_order
    const teamCount =
      draft.settings?.teams || Object.keys(draft.draft_order || {}).length;
    if (teamCount === 0) {
      return new Map();
    }

    // Get total rounds from draft settings
    const totalRounds = draft.settings?.rounds || 15;

    // Calculate all upcoming picks for this manager in a snake draft
    const highlights = new Map();
    const totalPicksSoFar = draft.picks.length;

    // Generate all pick numbers for this manager
    const managerPickNumbers = [];
    for (let round = 1; round <= totalRounds; round++) {
      let pickInRound;
      if (round % 2 === 1) {
        // Odd rounds: normal order (1, 2, 3, ...)
        pickInRound = draftSlot;
      } else {
        // Even rounds: reverse order (snake)
        pickInRound = teamCount - draftSlot + 1;
      }

      const overallPickNumber = (round - 1) * teamCount + pickInRound;

      // Only include future picks
      if (overallPickNumber > totalPicksSoFar) {
        managerPickNumbers.push({
          overallPick: overallPickNumber,
          round: round,
          pickInRound: pickInRound,
        });
      }
    }

    // Sort by overall pick number
    managerPickNumbers.sort((a, b) => a.overallPick - b.overallPick);

    // Map each upcoming pick to its position in the available players list
    // The position in the available players list is based on how many picks will happen before this manager's pick
    managerPickNumbers.forEach((pickInfo) => {
      // Calculate how many picks will happen between now and this manager's pick
      const picksUntilThisPick = pickInfo.overallPick - totalPicksSoFar;

      // The position in the available players list is (picksUntilThisPick - 1) because:
      // - If this is the very next pick (picksUntilThisPick = 1), it should be at index 0
      // - If this is the 2nd next pick (picksUntilThisPick = 2), it should be at index 1
      // - etc.
      const positionInList = picksUntilThisPick - 1;

      // Only highlight if the position is within the available players list
      if (positionInList >= 0 && positionInList < availablePlayers.length) {
        highlights.set(
          positionInList,
          `${pickInfo.round}.${pickInfo.pickInRound}`
        );
      }
    });

    return highlights;
  };

  const managerPickHighlights = getManagerPickHighlights();

  // Get all unique positions from available players
  const allPositions = Array.from(
    new Set(
      data.players
        .filter((p) => !draftedPlayerIds.has(p.player_info.player_id))
        .map((p) => p.player_info.position)
    )
  ).sort();

  // Initialize selected positions to all positions on first load
  useEffect(() => {
    if (selectedPositions.length === 0 && allPositions.length > 0) {
      setSelectedPositions(allPositions);
    }
  }, [allPositions.length]);

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
        Available Players Not Yet Drafted
      </h3>

      {/* Manager Selector for Draft Order Highlighting */}
      {leagueUsers &&
        leagueUsers.length > 1 &&
        (draft.status === "drafting" || draft.status === "paused") && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex flex-col space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-green-400">
                    📋 Show draft order for:
                  </span>
                  <select
                    value={selectedManagerId || ""}
                    onChange={(e) => {
                      if (setSelectedManagerId) {
                        setSelectedManagerId(e.target.value);
                      }
                    }}
                    className="border border-green-500/50 rounded px-3 py-1 text-sm bg-[var(--background)] text-[var(--foreground)] min-w-[150px]"
                  >
                    <option value="">Select Manager</option>
                    {leagueUsers.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.display_name ||
                          member.username ||
                          member.user_id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2 text-xs text-green-400 opacity-80">
                  <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                  <span>
                    Green highlights show upcoming picks in draft order
                  </span>
                </div>
              </div>

              {/* Position Needs Display */}
              {selectedManagerId && (
                <div className="border-t border-green-500/20 pt-3">
                  <div className="text-xs font-medium text-green-400 mb-2">
                    Position Needs (affects Value Score):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(getManagerPositionCounts()).map(
                      ([position, count]) => {
                        const maxNeeded =
                          { QB: 2, RB: 4, WR: 4, TE: 3 }[position] || 1;
                        const needsMore = count < maxNeeded;
                        const excess = count >= maxNeeded;

                        return (
                          <div
                            key={position}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              excess
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : needsMore
                                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                : "bg-green-500/20 text-green-400 border border-green-500/30"
                            }`}
                          >
                            {position}: {count}/{maxNeeded}
                            {excess && " (excess)"}
                          </div>
                        );
                      }
                    )}

                    {/* Show positions with 0 players */}
                    {["QB", "RB", "WR", "TE"].map((position) => {
                      const positionCounts = getManagerPositionCounts();
                      const count = positionCounts[position] || 0;
                      const maxNeeded = { QB: 2, RB: 4, WR: 4, TE: 3 }[
                        position
                      ];

                      if (count === 0) {
                        return (
                          <div
                            key={position}
                            className="px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30"
                          >
                            {position}: 0/{maxNeeded} (high need)
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Controls Row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        {/* Position Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {allPositions.map((position) => (
            <label
              key={position}
              className="flex items-center space-x-1 text-sm px-2 py-1 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedPositions.includes(position)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedPositions((prev) => [...prev, position]);
                  } else {
                    setSelectedPositions((prev) =>
                      prev.filter((p) => p !== position)
                    );
                  }
                }}
              />
              <span>{position}</span>
            </label>
          ))}
          <span className="ml-2 text-xs text-[var(--foreground)] opacity-60">
            Filter by position
          </span>
        </div>

        {/* Sort Options */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-[var(--foreground)] opacity-80">
              Sort by:
            </span>
            <div className="flex bg-[var(--background)] rounded-lg p-1">
              <button
                onClick={() => setSortBy("overall_rank")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  sortBy === "overall_rank"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--foreground)] opacity-60 hover:opacity-80"
                }`}
              >
                Overall Rank
              </button>
              <button
                onClick={() => setSortBy("projected_2025")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  sortBy === "projected_2025"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--foreground)] opacity-60 hover:opacity-80"
                }`}
              >
                Projected 2025
              </button>
              <button
                onClick={() => setSortBy("position_rank")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  sortBy === "position_rank"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--foreground)] opacity-60 hover:opacity-80"
                }`}
              >
                Position Rank
              </button>
              <button
                onClick={() => setSortBy("composite_value")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  sortBy === "composite_value"
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--foreground)] opacity-60 hover:opacity-80"
                }`}
              >
                Value Score
              </button>
              <button
                onClick={() => setSortBy(selectedADP)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  sortBy === selectedADP
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--foreground)] opacity-60 hover:opacity-80"
                }`}
              >
                ADP
              </button>
            </div>
          </div>
          
          {/* ADP Type Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-[var(--foreground)] opacity-80">
              ADP Type:
            </span>
            <select
              value={selectedADP}
              onChange={(e) => {
                setSelectedADP(e.target.value);
                if (sortBy.startsWith('adp_')) {
                  setSortBy(e.target.value);
                }
              }}
              className="border border-[var(--border)] rounded px-2 py-1 text-xs bg-[var(--background)] text-[var(--foreground)]"
            >
              <option value="adp_2qb">2QB</option>
              <option value="adp_ppr">PPR</option>
              <option value="adp_half_ppr">Half PPR</option>
              <option value="adp_std">Standard</option>
              <option value="adp_dynasty">Dynasty</option>
              <option value="adp_dynasty_2qb">Dynasty 2QB</option>
              <option value="adp_dynasty_ppr">Dynasty PPR</option>
              <option value="adp_dynasty_half_ppr">Dynasty Half PPR</option>
              <option value="adp_dynasty_std">Dynasty Std</option>
              <option value="adp_rookie">Rookie</option>
              <option value="adp_idp">IDP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tier Legend */}
      <div className="mb-3 p-3 bg-[var(--secondary)]/20 border border-[var(--border)] rounded-lg">
        <div className="text-xs font-medium text-[var(--foreground)] opacity-80 mb-2">
          Player Tiers (based on projected points drop-offs within each
          position):
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center space-x-1 px-2 py-1 bg-purple-500/15 border border-purple-500/40 rounded text-xs">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span className="text-purple-400 font-medium">Elite</span>
          </div>
          <div className="flex items-center space-x-1 px-2 py-1 bg-blue-500/15 border border-blue-500/40 rounded text-xs">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-400 font-medium">Tier 1</span>
          </div>
          <div className="flex items-center space-x-1 px-2 py-1 bg-green-500/15 border border-green-500/40 rounded text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-400 font-medium">Tier 2</span>
          </div>
          <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-500/15 border border-yellow-500/40 rounded text-xs">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-yellow-400 font-medium">Tier 3</span>
          </div>
          <div className="flex items-center space-x-1 px-2 py-1 bg-orange-500/15 border border-orange-500/40 rounded text-xs">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <span className="text-orange-400 font-medium">Tier 4</span>
          </div>
          <div className="flex items-center space-x-1 px-2 py-1 bg-red-500/15 border border-red-500/40 rounded text-xs">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-400 font-medium">Tier 5</span>
          </div>
          <div className="flex items-center space-x-1 px-2 py-1 bg-gray-500/15 border border-gray-500/40 rounded text-xs">
            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            <span className="text-gray-400 font-medium">Deep</span>
          </div>
        </div>
      </div>

      {/* Players Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-[var(--border)]">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                Player
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                Team
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  sortBy === "overall_rank"
                    ? "text-[var(--primary)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                Overall Rank
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  sortBy === "projected_2025"
                    ? "text-[var(--primary)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                Projected 2025
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  sortBy === "position_rank"
                    ? "text-[var(--primary)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                Position Rank
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  sortBy === "composite_value"
                    ? "text-[var(--primary)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                Value Score
              </th>
              <th
                className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  sortBy === selectedADP
                    ? "text-[var(--primary)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                ADP ({selectedADP.replace('adp_', '').replace('_', ' ').toUpperCase()})
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {availablePlayers.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-4 text-[var(--foreground)] opacity-60 text-sm text-center"
                >
                  No players found for selected position(s).
                </td>
              </tr>
            ) : (
              availablePlayers.map((player, index) => {
                // Check if this player position should be highlighted
                const pickLabel = managerPickHighlights.get(index);
                const shouldHighlight = pickLabel !== undefined;

                // Get tier information for color highlighting
                const tierInfo = playerTierInfo.get(
                  player.player_info.player_id
                );
                const tierColors = tierInfo?.colors;

                return (
                  <tr
                    key={player.player_info.player_id}
                    className={`transition-colors duration-150 cursor-pointer relative ${
                      shouldHighlight
                        ? "bg-green-500/5 hover:bg-green-500/10 border-l-4 border-green-500"
                        : tierColors
                        ? `${tierColors.bg} hover:${tierColors.bg.replace(
                            "/15",
                            "/25"
                          )} border-l-2 ${tierColors.border}`
                        : "hover:bg-[var(--secondary)]/50"
                    }`}
                    onMouseEnter={(e) => {
                      setHoveredPlayer(player);
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPosition({
                        x: rect.right + 10,
                        y: rect.top + window.scrollY,
                      });
                    }}
                    onMouseLeave={() => setHoveredPlayer(null)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--foreground)] relative">
                      {shouldHighlight && (
                        <>
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 shadow-lg"></div>
                          <div className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded-md font-bold z-10 shadow-md border border-green-400">
                            Pick {pickLabel}
                          </div>
                        </>
                      )}
                      <a
                        href={`/player/${player.player_info.player_id}`}
                        className="hover:underline cursor-pointer text-[var(--primary)]"
                        style={{ marginLeft: shouldHighlight ? "85px" : "0" }}
                      >
                        {player.player_info.name}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm opacity-80">
                      <div className="flex items-center space-x-2">
                        <span>{player.player_info.position}</span>
                        {tierInfo && (
                          <span
                            className={`px-1.5 py-0.5 text-xs font-medium rounded ${tierColors.bg} ${tierColors.text} ${tierColors.border} border`}
                          >
                            {tierInfo.tierName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm opacity-80">
                      {player.player_info.team}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm opacity-90">
                      #{player.player_info.overall_rank || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm opacity-90">
                      {player.player_info.projected_2025_points?.toFixed(1) ??
                        "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm opacity-90">
                      #{player.player_info.position_rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm opacity-90">
                      <span className="font-semibold text-[var(--primary)]">
                        {calculateCompositeValue(
                          player,
                          draft.picks.length + 1
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm opacity-90">
                      {player.seasons?.[year]?.season_projected_totals?.[selectedADP] 
                        ? player.seasons[year].season_projected_totals[selectedADP].toFixed(1)
                        : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
