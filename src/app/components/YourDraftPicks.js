"use client";

import { useState, useEffect, useMemo } from "react";
import { WeeklyProjectionsChart } from "./WeeklyProjectionsChart";

export function YourDraftPicks({
  user,
  leagueUsers,
  data,
  draft,
}) {
  // State for selected member
  const [selectedMemberId, setSelectedMemberId] = useState(user.user_id);

  // Get position counts for the selected member's drafted players
  const getSelectedMemberPositionCounts = () => {
    const memberPicks = draft.picks.filter(pick => pick.picked_by === selectedMemberId);
    const positionCounts = {};
    
    memberPicks.forEach(pick => {
      const position = pick.metadata?.position;
      if (position) {
        positionCounts[position] = (positionCounts[position] || 0) + 1;
      }
    });
    
    return positionCounts;
  };

  // Calculate composite value for a player based on position scarcity and performance metrics
  const calculateCompositeValue = (player, isDrafted = false, pickNumber = null) => {
    if (!player?.player_info) return 0;
    
    const position = player.player_info.position;
    const overallRank = player.player_info.overall_rank || 999;
    const positionRank = player.player_info.position_rank || 999;
    const projectedPoints = player.player_info.projected_2025_points || 0;

    // For drafted players, use static value calculation
    if (isDrafted && pickNumber) {
      // Get position counts at time of draft (before this pick)
      const picksBeforeThis = draft.picks.filter(pick => pick.pick_no < pickNumber && pick.picked_by === selectedMemberId);
      const positionCountsAtDraft = {};
      picksBeforeThis.forEach(pick => {
        const pos = pick.metadata?.position;
        if (pos) {
          positionCountsAtDraft[pos] = (positionCountsAtDraft[pos] || 0) + 1;
        }
      });

      return calculateStaticValue(player, positionCountsAtDraft, pickNumber);
    }

    // For available players, use current position counts
    const positionCounts = getSelectedMemberPositionCounts();
    return calculateDynamicValue(player, positionCounts, draft.picks.length + 1);
  };

  // Static value calculation for drafted players
  const calculateStaticValue = (player, positionCountsAtDraft, pickNumber) => {
    const position = player.player_info.position;
    const overallRank = player.player_info.overall_rank || 999;
    const positionRank = player.player_info.position_rank || 999;
    const projectedPoints = player.player_info.projected_2025_points || 0;

    // Starting lineup requirements
    const positionRequirements = {
      QB: 2,      // Only 2 QB slots, no FLEX eligibility
      RB: 2 + 2,  // 2 RB slots + 2 FLEX slots
      WR: 2 + 2,  // 2 WR slots + 2 FLEX slots
      TE: 1 + 2,  // 1 TE slot + 2 FLEX slots
    };

    const coreRequirements = {
      QB: 2, RB: 2, WR: 2, TE: 1,
    };

    const baseMultipliers = {
      QB: 2.2, RB: 1.8, WR: 1.6, TE: 2.4,
    };

    const currentCount = positionCountsAtDraft[position] || 0;
    const coreNeeded = coreRequirements[position] || 0;
    const maxNeeded = positionRequirements[position] || 1;
    const baseMultiplier = baseMultipliers[position] || 1.0;
    
    let finalMultiplier = baseMultiplier;

    // Position-specific value drops based on scarcity and FLEX eligibility
    if (position === "QB" && currentCount >= coreNeeded) {
      // QB: Drastic drop after 2 QBs (no FLEX eligibility)
      finalMultiplier = baseMultiplier * 0.15; // 85% reduction
    } else if (position === "TE" && currentCount >= coreNeeded) {
      // TE: Drastic drop after 1 TE (limited depth)
      finalMultiplier = baseMultiplier * 0.20; // 80% reduction
    } else if ((position === "RB" || position === "WR") && currentCount >= coreNeeded) {
      // RB/WR: More gradual drop due to FLEX eligibility and depth
      if (currentCount >= maxNeeded) {
        finalMultiplier = baseMultiplier * 0.40; // 60% reduction for excess
      } else {
        // Gradual reduction between core and max needed
        const progressToMax = (currentCount - coreNeeded) / (maxNeeded - coreNeeded);
        finalMultiplier = baseMultiplier * (1 - (progressToMax * 0.50)); // Up to 50% reduction
      }
    } else if (currentCount >= maxNeeded) {
      // Heavy penalty for excess players at any position
      finalMultiplier = baseMultiplier * 0.30; // 70% reduction for excess players
    } else {
      // Gradual reduction for positions not yet at core requirement
      const reductionPerPlayer = position === "QB" || position === "TE" ? 0.25 : 0.15;
      const reduction = Math.min(currentCount * reductionPerPlayer, 0.6);
      finalMultiplier = Math.max(baseMultiplier * (1 - reduction), 0.4);
    }

    // Draft position bonus - reward good players taken at later picks
    let draftPositionBonus = 1.0;
    const expectedPickForRank = overallRank;
    if (pickNumber > expectedPickForRank) {
      // Player available later than expected - significant bonus value
      const pickDifference = pickNumber - expectedPickForRank;
      // More generous bonus scaling: up to 100% bonus for major steals
      draftPositionBonus = 1.0 + Math.min(pickDifference / 50, 1.0); // Up to 100% bonus
      
      // Extra bonus for really late steals (50+ picks later than expected)
      if (pickDifference >= 50) {
        draftPositionBonus += Math.min((pickDifference - 50) / 100, 0.5); // Additional 50% bonus
      }
    }

    const overallRankScore = Math.max(0, (300 - overallRank) / 300) * 100;
    const positionRankScore = Math.max(0, (100 - positionRank) / 100) * 100;
    const projectedPointsScore = Math.min(projectedPoints / 400 * 100, 100);

    const compositeValue = (
      overallRankScore * 0.3 +
      positionRankScore * 0.25 +
      projectedPointsScore * 0.35 +
      (finalMultiplier - 1) * 10
    ) * finalMultiplier * draftPositionBonus;

    return Math.round(compositeValue * 10) / 10;
  };

  // Dynamic value calculation for available players
  const calculateDynamicValue = (player, positionCounts, currentPickNumber) => {
    const position = player.player_info.position;
    const overallRank = player.player_info.overall_rank || 999;
    const positionRank = player.player_info.position_rank || 999;
    const projectedPoints = player.player_info.projected_2025_points || 0;

    const positionRequirements = {
      QB: 2, RB: 2 + 2, WR: 2 + 2, TE: 1 + 2,
    };

    const coreRequirements = {
      QB: 2, RB: 2, WR: 2, TE: 1,
    };

    const baseMultipliers = {
      QB: 2.2, RB: 1.8, WR: 1.6, TE: 2.4,
    };

    const currentCount = positionCounts[position] || 0;
    const coreNeeded = coreRequirements[position] || 0;
    const maxNeeded = positionRequirements[position] || 1;
    const baseMultiplier = baseMultipliers[position] || 1.0;
    
    let finalMultiplier = baseMultiplier;

    // Position-specific value drops based on scarcity and FLEX eligibility
    if (position === "QB" && currentCount >= coreNeeded) {
      // QB: Drastic drop after 2 QBs (no FLEX eligibility)
      finalMultiplier = baseMultiplier * 0.15; // 85% reduction
    } else if (position === "TE" && currentCount >= coreNeeded) {
      // TE: Drastic drop after 1 TE (limited depth)
      finalMultiplier = baseMultiplier * 0.20; // 80% reduction
    } else if ((position === "RB" || position === "WR") && currentCount >= coreNeeded) {
      // RB/WR: More gradual drop due to FLEX eligibility and depth
      if (currentCount >= maxNeeded) {
        finalMultiplier = baseMultiplier * 0.40; // 60% reduction for excess
      } else {
        // Gradual reduction between core and max needed
        const progressToMax = (currentCount - coreNeeded) / (maxNeeded - coreNeeded);
        finalMultiplier = baseMultiplier * (1 - (progressToMax * 0.50)); // Up to 50% reduction
      }
    } else if (currentCount >= maxNeeded) {
      // Heavy penalty for excess players at any position
      finalMultiplier = baseMultiplier * 0.30; // 70% reduction for excess players
    } else {
      // Gradual reduction for positions not yet at core requirement
      const reductionPerPlayer = position === "QB" || position === "TE" ? 0.25 : 0.15;
      const reduction = Math.min(currentCount * reductionPerPlayer, 0.6);
      finalMultiplier = Math.max(baseMultiplier * (1 - reduction), 0.4);
    }

    // Draft position bonus - reward good players taken at later picks
    let draftPositionBonus = 1.0;
    const expectedPickForRank = overallRank;
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

    const overallRankScore = Math.max(0, (300 - overallRank) / 300) * 100;
    const positionRankScore = Math.max(0, (100 - positionRank) / 100) * 100;
    const projectedPointsScore = Math.min(projectedPoints / 400 * 100, 100);

    const compositeValue = (
      overallRankScore * 0.3 +
      positionRankScore * 0.25 +
      projectedPointsScore * 0.35 +
      (finalMultiplier - 1) * 10
    ) * finalMultiplier * draftPositionBonus;

    return Math.round(compositeValue * 10) / 10;
  };

  // Extract roster format from draft settings (memoized to prevent infinite re-renders)
  const rosterFormat = useMemo(() => {
    const settings = draft?.settings || {};
    return [
      { position: "QB", slots: settings.slots_qb || 1, label: "Quarterback" },
      { position: "RB", slots: settings.slots_rb || 2, label: "Running Back" },
      { position: "WR", slots: settings.slots_wr || 2, label: "Wide Receiver" },
      { position: "TE", slots: settings.slots_te || 1, label: "Tight End" },
      {
        position: "FLEX",
        slots: settings.slots_flex || 1,
        label: "Flex (RB/WR/TE)",
      },
    ].filter(({ slots }) => slots > 0); // Only include positions with slots > 0
  }, [draft?.settings]);

  // Use leagueUsers prop if provided, otherwise fall back to just the user
  const leagueMembers =
    Array.isArray(leagueUsers) && leagueUsers.length > 0
      ? leagueUsers
      : [user];

  // Find selected member object
  const selectedMember =
    leagueMembers.find((m) => m.user_id === selectedMemberId) || user;

  // Picks for selected member
  const memberPicks = draft.picks.filter(
    (pick) => pick.picked_by === selectedMemberId
  );

  // Get all drafted player IDs
  const draftedPlayerIds = new Set(
    draft.picks.map((pick) => pick.metadata?.player_id)
  );

  // Get best available players by position, excluding already used best available players
  const getBestAvailableByPosition = (
    position,
    count = 1,
    excludePlayerIds = new Set()
  ) => {
    let availablePlayers = data.players.filter(
      (p) =>
        !draftedPlayerIds.has(p.player_info.player_id) &&
        !excludePlayerIds.has(p.player_info.player_id)
    );

    if (position === "FLEX") {
      // For FLEX, include RB, WR, TE
      availablePlayers = availablePlayers.filter((p) =>
        ["RB", "WR", "TE"].includes(p.player_info.position)
      );
    } else {
      availablePlayers = availablePlayers.filter(
        (p) => p.player_info.position === position
      );
    }

    // Sort by projected points (descending)
    availablePlayers.sort(
      (a, b) =>
        (b.player_info.projected_2025_points || 0) -
        (a.player_info.projected_2025_points || 0)
    );

    return availablePlayers.slice(0, count);
  };

  // Get player data for each pick
  const picksWithPlayerData = memberPicks.map((pick) => {
    const player = data.players.find(
      (p) => p.player_info.player_id === pick.metadata?.player_id
    );
    return { ...pick, player };
  });

  // Initialize empty roster
  const initialRoster = useMemo(() => {
    const roster = {
      starters: {},
      bench: [],
    };
    // Initialize starter slots
    rosterFormat.forEach(({ position, slots }) => {
      roster.starters[position] = Array(slots).fill(null);
    });
    return roster;
  }, [rosterFormat]);
  const [roster, setRoster] = useState(initialRoster);
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  // Track which empty slots are filled with best available players
  // Format: { "QB-0": true, "RB-1": false, etc. }
  const [filledSlots, setFilledSlots] = useState({});

  // Reset roster when selectedMemberId changes (when different manager is selected)
  useEffect(() => {
    // Recalculate memberPicks for the new selected member
    const newMemberPicks = draft.picks.filter(
      (pick) => pick.picked_by === selectedMemberId
    );
    
    // Recalculate roster with new member picks
    const newRoster = {
      starters: {},
      bench: [],
    };

    // Initialize starter slots
    rosterFormat.forEach(({ position, slots }) => {
      newRoster.starters[position] = Array(slots).fill(null);
    });

    // Get player data for each pick
    const picksWithPlayerData = newMemberPicks.map((pick) => {
      const player = data.players.find(
        (p) => p.player_info.player_id === pick.metadata?.player_id
      );
      return { ...pick, player };
    });

    // Sort picks by draft order
    const sortedPicks = [...picksWithPlayerData].sort(
      (a, b) => a.pick_no - b.pick_no
    );

    sortedPicks.forEach((pick) => {
      const position = pick.metadata?.position;
      let placed = false;

      // Try to place in starting lineup
      if (position && newRoster.starters[position]) {
        const emptySlot = newRoster.starters[position].findIndex(
          (slot) => slot === null
        );
        if (emptySlot !== -1) {
          newRoster.starters[position][emptySlot] = pick;
          placed = true;
        }
      }

      // Try to place in FLEX if RB, WR, or TE
      if (!placed && ["RB", "WR", "TE"].includes(position)) {
        const flexEmptySlot = newRoster.starters.FLEX.findIndex(
          (slot) => slot === null
        );
        if (flexEmptySlot !== -1) {
          newRoster.starters.FLEX[flexEmptySlot] = pick;
          placed = true;
        }
      }

      // If not placed in starters, add to bench
      if (!placed) {
        newRoster.bench.push(pick);
      }
    });

    setRoster(newRoster);
    // Clear any drag state when switching managers
    setDraggedPlayer(null);
    setDragOverSlot(null);
    // Clear filled slots when switching managers
    setFilledSlots({});
  }, [selectedMemberId, draft.picks, data.players, rosterFormat]);

  // Reset selected member to current user when draft changes (switching leagues)
  useEffect(() => {
    setSelectedMemberId(user.user_id);
  }, [draft?.draft_id, user.user_id]);

  // Create enhanced roster with best available players filling selected empty slots
  const getEnhancedRoster = () => {
    const enhancedRoster = {
      starters: { ...roster.starters },
      bench: [...roster.bench],
    };

    // Copy starter arrays to avoid mutation
    Object.keys(enhancedRoster.starters).forEach((pos) => {
      enhancedRoster.starters[pos] = [...roster.starters[pos]];
    });

    // Track which best available players are already used
    const usedBestAvailableIds = new Set();

    // Fill selected empty slots with best available players
    // Process in a specific order to ensure consistent player assignment
    const filledSlotEntries = Object.entries(filledSlots)
      .filter(([_, isFilled]) => isFilled)
      .sort(); // Sort to ensure consistent ordering

    filledSlotEntries.forEach(([slotKey, _]) => {
      const [position, indexStr] = slotKey.split("-");
      const index = parseInt(indexStr);
      const player = enhancedRoster.starters[position][index];

      // If slot is empty and user has toggled it to be filled
      if (player === null) {
        const bestAvailable = getBestAvailableByPosition(
          position,
          1,
          usedBestAvailableIds
        );

        if (bestAvailable[0]) {
          // Add this player to the used set
          usedBestAvailableIds.add(bestAvailable[0].player_info.player_id);

          // Create a mock pick object for the best available player
          enhancedRoster.starters[position][index] = {
            metadata: {
              player_id: bestAvailable[0].player_info.player_id,
              first_name: bestAvailable[0].player_info.name.split(" ")[0],
              last_name: bestAvailable[0].player_info.name
                .split(" ")
                .slice(1)
                .join(" "),
              position: bestAvailable[0].player_info.position,
              team: bestAvailable[0].player_info.team,
            },
            player: bestAvailable[0],
            round: "FA",
            draft_slot: "FA",
            pick_no: "FA",
            pick_id: `fa-${bestAvailable[0].player_info.player_id}`,
            isBestAvailable: true, // Flag to identify these players
          };
        }
      }
    });

    return enhancedRoster;
  };

  // Toggle function for individual slots
  const toggleSlotFill = (position, index) => {
    const slotKey = `${position}-${index}`;
    setFilledSlots((prev) => ({
      ...prev,
      [slotKey]: !prev[slotKey],
    }));
  };

  // Check if a player can be placed in a specific position
  const canPlayerFitPosition = (playerPosition, slotPosition) => {
    if (slotPosition === "BENCH") return true;
    if (slotPosition === playerPosition) return true;
    if (slotPosition === "FLEX" && ["RB", "WR", "TE"].includes(playerPosition))
      return true;
    return false;
  };

  // Handle drag start
  const handleDragStart = (e, player, fromPosition, fromIndex) => {
    setDraggedPlayer({ player, fromPosition, fromIndex });
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle drag over
  const handleDragOver = (e, toPosition, toIndex) => {
    e.preventDefault();
    if (
      draggedPlayer &&
      canPlayerFitPosition(draggedPlayer.player.metadata?.position, toPosition)
    ) {
      e.dataTransfer.dropEffect = "move";
      setDragOverSlot({ position: toPosition, index: toIndex });
    } else {
      e.dataTransfer.dropEffect = "none";
      setDragOverSlot(null);
    }
  };

  // Handle drag leave
  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  // Handle drop
  const handleDrop = (e, toPosition, toIndex) => {
    e.preventDefault();
    setDragOverSlot(null);

    if (!draggedPlayer) return;

    const { player, fromPosition, fromIndex } = draggedPlayer;
    const playerPosition = player.metadata?.position;

    // Check if drop is valid
    if (!canPlayerFitPosition(playerPosition, toPosition)) {
      setDraggedPlayer(null);
      return;
    }

    // Don't do anything if dropping in the same spot
    if (fromPosition === toPosition && fromIndex === toIndex) {
      setDraggedPlayer(null);
      return;
    }

    setRoster((prevRoster) => {
      const newRoster = {
        starters: { ...prevRoster.starters },
        bench: [...prevRoster.bench],
      };

      // Copy starter arrays to avoid mutation
      Object.keys(newRoster.starters).forEach((pos) => {
        newRoster.starters[pos] = [...prevRoster.starters[pos]];
      });

      // Remove player from original position
      if (fromPosition === "BENCH") {
        newRoster.bench = newRoster.bench.filter((_, i) => i !== fromIndex);
      } else {
        newRoster.starters[fromPosition][fromIndex] = null;
      }

      // Add player to new position
      if (toPosition === "BENCH") {
        newRoster.bench.push(player);
      } else {
        // If target slot is occupied, move that player to bench
        const existingPlayer = newRoster.starters[toPosition][toIndex];
        if (existingPlayer) {
          newRoster.bench.push(existingPlayer);
        }
        newRoster.starters[toPosition][toIndex] = player;
      }

      return newRoster;
    });

    setDraggedPlayer(null);
  };

  // Calculate total projected points and composite value for starting lineup
  const calculateStartingLineupStats = () => {
    let totalPoints = 0;
    let totalCompositeValue = 0;
    let playerCount = 0;
    let draftedPlayerCount = 0;
    let bestAvailableCount = 0;

    const currentRoster = getEnhancedRoster();

    rosterFormat.forEach(({ position }) => {
      currentRoster.starters[position].forEach((pick) => {
        if (pick && pick.player) {
          if (pick.player.player_info.projected_2025_points) {
            totalPoints += pick.player.player_info.projected_2025_points;
          }
          
          // Use static value for drafted players, dynamic for best available
          if (pick.isBestAvailable) {
            totalCompositeValue += calculateCompositeValue(pick.player, false);
          } else {
            totalCompositeValue += calculateCompositeValue(pick.player, true, pick.pick_no);
          }
          playerCount++;

          if (pick.isBestAvailable) {
            bestAvailableCount++;
          } else {
            draftedPlayerCount++;
          }
        }
      });
    });

    return { totalPoints, totalCompositeValue, playerCount, draftedPlayerCount, bestAvailableCount };
  };

  const { totalPoints, totalCompositeValue, playerCount, draftedPlayerCount, bestAvailableCount } =
    calculateStartingLineupStats();

  const renderPlayer = (pick, position, index, isDragOver = false) => {
    const slotKey = `${position}-${index}`;
    const isSlotFilled = filledSlots[slotKey];

    if (!pick) {
      return (
        <div
          className={`p-3 border-2 border-dashed rounded-lg transition-colors ${
            isDragOver
              ? "border-[var(--primary)] bg-[var(--primary)]/10"
              : "border-[var(--border)] opacity-50"
          }`}
          onDragOver={(e) => handleDragOver(e, position, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, position, index)}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {isDragOver ? "Drop Here" : "Empty Slot"}
            </span>
            <button
              onClick={() => toggleSlotFill(position, index)}
              className={`ml-2 px-2 py-1 text-xs rounded transition-colors ${
                isSlotFilled
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-gray-600 text-gray-300 hover:bg-gray-500"
              }`}
            >
              {isSlotFilled ? "✓ Filled" : "Fill"}
            </button>
          </div>
        </div>
      );
    }

    const isDragging = draggedPlayer?.player === pick;
    const isBestAvailable = pick.isBestAvailable;

    return (
      <div
        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
          isBestAvailable ? "cursor-default" : "cursor-move"
        } ${
          isDragging
            ? "opacity-50 bg-[var(--primary)]/20 border-[var(--primary)]"
            : isDragOver
            ? "bg-[var(--primary)]/10 border-[var(--primary)]"
            : isBestAvailable
            ? "bg-green-500/10 border-green-500/30"
            : "bg-[var(--secondary)]/30 border-[var(--border)] hover:bg-[var(--secondary)]/50"
        }`}
        draggable={!isBestAvailable}
        onDragStart={
          !isBestAvailable
            ? (e) => handleDragStart(e, pick, position, index)
            : undefined
        }
        onDragOver={
          !isBestAvailable
            ? (e) => handleDragOver(e, position, index)
            : undefined
        }
        onDragLeave={!isBestAvailable ? handleDragLeave : undefined}
        onDrop={
          !isBestAvailable ? (e) => handleDrop(e, position, index) : undefined
        }
      >
        <div className="flex items-center space-x-4">
          <div
            className={`font-bold py-1 px-3 rounded-full text-sm ${
              isBestAvailable
                ? "text-green-400 bg-green-500/20"
                : "text-[var(--primary)] bg-[var(--primary)]/10"
            }`}
          >
            {isBestAvailable ? "FA" : `${pick.round}.${pick.draft_slot}`}
          </div>
          <div>
            <a
              href={`/player/${pick.metadata?.player_id}`}
              className="font-medium text-[var(--foreground)] hover:underline cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              {pick.metadata?.first_name} {pick.metadata?.last_name}
            </a>
            <p className="text-sm opacity-80">
              {pick.metadata?.position} - {pick.metadata?.team}
              {isBestAvailable && (
                <span className="text-green-400 ml-2">(Best Available)</span>
              )}
            </p>
            {pick.player && (
              <div className="text-xs text-[var(--foreground)] opacity-90 mt-1">
                <div>
                  Projected 2025:{" "}
                  {pick.player.player_info.projected_2025_points?.toFixed(1)}{" "}
                  pts
                </div>
                <div>
                  Position Rank: #{pick.player.player_info.position_rank}
                </div>
                <div className="text-green-400 font-semibold">
                  Value Score: {isBestAvailable 
                    ? calculateCompositeValue(pick.player, false)
                    : calculateCompositeValue(pick.player, true, pick.pick_no)
                  }
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm opacity-80">
            {isBestAvailable ? "Available" : `Pick #${pick.pick_no}`}
          </p>
          {isBestAvailable ? (
            <button
              onClick={() => toggleSlotFill(position, index)}
              className="mt-1 px-2 py-1 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              ✕ Remove
            </button>
          ) : (
            <div className="text-xs opacity-60 mt-1">🔄 Drag to move</div>
          )}
        </div>
      </div>
    );
  };

  const renderAvailablePlayer = (player) => {
    if (!player) {
      return (
        <div className="p-3 border-2 border-dashed border-[var(--border)] rounded-lg text-center opacity-30">
          <span className="text-sm">No Available Players</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
        <div className="flex items-center space-x-4">
          <div className="text-blue-400 font-bold py-1 px-3 rounded-full text-sm bg-blue-500/20">
            #{player.player_info.position_rank}
          </div>
          <div>
            <a
              href={`/player/${player.player_info.player_id}`}
              className="font-medium text-[var(--foreground)] hover:underline cursor-pointer"
            >
              {player.player_info.name}
            </a>
            <p className="text-sm opacity-80">
              {player.player_info.position} - {player.player_info.team}
            </p>
            <div className="text-xs text-[var(--foreground)] opacity-90 mt-1">
              <div>
                Projected 2025:{" "}
                {player.player_info.projected_2025_points?.toFixed(1)} pts
              </div>
              <div>Overall Rank: #{player.player_info.overall_rank}</div>
              <div className="text-blue-400 font-semibold">
                Value Score: {calculateCompositeValue(player, false)}
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-blue-400 font-medium">AVAILABLE</p>
        </div>
      </div>
    );
  };

  return (
    <div className="mb-6 mt-2">
      <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
        {selectedMemberId === user.user_id
          ? "Your Draft Picks"
          : `${
              selectedMember.display_name || selectedMember.username || "Member"
            }'s Draft Picks`}
      </h3>

      {/* Member selector */}
      {leagueMembers.length > 1 && (
        <div className="mb-6 flex items-center space-x-2">
          <label
            htmlFor="member-select"
            className="text-sm font-medium text-[var(--foreground)] opacity-80"
          >
            View drafted players for:
          </label>
          <select
            id="member-select"
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="border border-[var(--border)] rounded px-2 py-1 text-sm bg-[var(--secondary)] text-[var(--foreground)]"
          >
            {leagueMembers.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.display_name || member.username || member.user_id}
                {member.user_id === user.user_id ? " (YOU)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {memberPicks.length === 0 ? (
        <div className="text-[var(--foreground)] opacity-60 text-sm">
          No picks yet.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Weekly Projections Chart */}
          <WeeklyProjectionsChart
            roster={getEnhancedRoster()}
            rosterFormat={rosterFormat}
            data={data}
          />

          {/* Starting Lineup */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-[var(--foreground)] flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Starting Lineup
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-lg px-3 py-2">
                  <div className="text-xs font-medium text-[var(--foreground)] opacity-60">
                    Weekly Average Projected Points
                  </div>
                  <div className="text-lg font-bold text-[var(--primary)]">
                    {(totalPoints / 17).toFixed(2)} pts
                  </div>
                  <div className="text-xs opacity-80">
                    {draftedPlayerCount} drafted
                    {bestAvailableCount > 0 &&
                      ` + ${bestAvailableCount} available`}
                  </div>
                </div>
                
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                  <div className="text-xs font-medium text-[var(--foreground)] opacity-60">
                    Total Team Value Score
                  </div>
                  <div className="text-lg font-bold text-green-400">
                    {totalCompositeValue.toFixed(1)}
                  </div>
                  <div className="text-xs opacity-80">
                    {rosterFormat.reduce((sum, { slots }) => sum + slots, 0)}{" "}
                    starters
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {rosterFormat.map(({ position, slots, label }) => {
                const enhancedRoster = getEnhancedRoster();

                // Get already used best available player IDs for this position
                const usedBestAvailableIds = new Set();
                enhancedRoster.starters[position].forEach((pick) => {
                  if (pick?.isBestAvailable) {
                    usedBestAvailableIds.add(pick.metadata.player_id);
                  }
                });

                const bestAvailable = getBestAvailableByPosition(
                  position,
                  slots,
                  usedBestAvailableIds
                );

                return (
                  <div key={position}>
                    <h5 className="text-sm font-medium text-[var(--foreground)] opacity-80 mb-2">
                      {label} ({slots} slot{slots > 1 ? "s" : ""})
                    </h5>
                    <div className="space-y-2">
                      {enhancedRoster.starters[position].map((pick, index) => {
                        const isDragOver =
                          dragOverSlot?.position === position &&
                          dragOverSlot?.index === index;

                        // For display purposes, show enhanced pick if slot is filled, otherwise original
                        const originalPick = roster.starters[position][index];
                        const slotKey = `${position}-${index}`;
                        const displayPick = filledSlots[slotKey]
                          ? pick
                          : originalPick;

                        return (
                          <div
                            key={`${position}-${index}`}
                            className="grid grid-cols-2 gap-4"
                          >
                            <div>
                              <div className="text-xs font-medium text-[var(--foreground)] opacity-60 mb-1">
                                {filledSlots[slotKey] && pick?.isBestAvailable
                                  ? "Projected Player"
                                  : "Your Player"}
                              </div>
                              {renderPlayer(
                                displayPick,
                                position,
                                index,
                                isDragOver
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-blue-400 opacity-80 mb-1">
                                Best Available
                              </div>
                              {renderAvailablePlayer(bestAvailable[index])}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bench */}
          <div>
            <h4 className="text-md font-semibold text-[var(--foreground)] mb-3 flex items-center">
              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
              Bench ({roster.bench.length} player
              {roster.bench.length > 1 ? "s" : ""})
            </h4>
            <div
              className={`space-y-2 min-h-[60px] p-3 rounded-lg border-2 border-dashed transition-colors ${
                dragOverSlot?.position === "BENCH"
                  ? "border-[var(--primary)] bg-[var(--primary)]/5"
                  : "border-[var(--border)]/50"
              }`}
              onDragOver={(e) =>
                handleDragOver(e, "BENCH", roster.bench.length)
              }
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "BENCH", roster.bench.length)}
            >
              {roster.bench.length === 0 ? (
                <div className="text-center text-[var(--foreground)] opacity-60 py-4">
                  {dragOverSlot?.position === "BENCH"
                    ? "Drop player here"
                    : "No bench players"}
                </div>
              ) : (
                roster.bench.map((pick, index) => (
                  <div key={pick.pick_id}>
                    {renderPlayer(pick, "BENCH", index)}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
