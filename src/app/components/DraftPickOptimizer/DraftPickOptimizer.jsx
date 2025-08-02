/**
 * DraftPickOptimizer - Main container component
 * Integrates with YourDraftPicks to provide real-time draft pick recommendations
 * Manages state, real-time updates, and coordinates all optimization subsystems
 * Includes performance optimizations: memoization, debouncing, and incremental updates
 */

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import styles from "./DraftPickOptimizer.module.css";
import SafeAnimationWrapper from "./SafeAnimationWrapper";
import { RecommendationCard } from "./RecommendationCard";
import { OptimizationFactors } from "./OptimizationFactors";
import {
  generateRankedRecommendations,
  assessRosterNeeds,
} from "./OptimizationEngine";
import {
  analyzeLeagueNeeds,
  predictManagerTargeting,
  calculatePositionUrgencyScores,
} from "./CompetitionAnalyzer";
import { projectPlayerAvailability } from "./AvailabilityPredictor";
import { useDebounce, useDebouncedCallback } from "./hooks/useDebounce";
import { useOptimizationCache } from "./hooks/useOptimizationCache";
import { usePerformanceMonitor } from "./hooks/usePerformanceMonitor";
import ErrorBoundary from "./ErrorBoundary";
import { ErrorMessage, LoadingWithError } from "./ErrorMessages";
import {
  generateFallbackRecommendations,
  validatePlayerData,
} from "./FallbackRecommendations";
import {
  validateAndSanitizePlayer,
  validatePlayerArray,
  validateDraftContext,
  createDegradedContext,
  canProvideRecommendations,
} from "./GracefulDegradation";
import { createRetryableOptimization, safeExecute } from "./RetryMechanism";
import {
  generateAlternativePlayerSuggestions,
  createWaitVsPickNowAdvisory,
  generatePositionScarcityWarnings,
  generateDraftStrategyInsights,
} from "./AdvancedRecommendations";
import {
  UserDocumentation,
  HelpIcon,
  TOOLTIP_CONTENT,
} from "./UserDocumentation";

export function DraftPickOptimizer({
  user,
  leagueUsers,
  data,
  draft,
  selectedMemberId,
  memberPicks,
  draftedPlayerIds,
  calculateCompositeValue,
  rosterFormat,
}) {
  // State management for recommendations and UI
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showFactorDetails, setShowFactorDetails] = useState(false);

  // UI States (keeping necessary states, removed problematic animation ones)
  const [previousRecommendations, setPreviousRecommendations] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showUpdateIndicator, setShowUpdateIndicator] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [degradedMode, setDegradedMode] = useState(false);

  // State for optimization analysis data
  const [competitionData, setCompetitionData] = useState(null);
  const [availabilityProjections, setAvailabilityProjections] = useState(null);
  const [optimizationFactors, setOptimizationFactors] = useState(null);
  const [rosterNeedsAnalysis, setRosterNeedsAnalysis] = useState(null);

  // State for advanced recommendation features
  const [alternativePlayerSuggestions, setAlternativePlayerSuggestions] =
    useState({});
  const [waitVsPickNowAdvisories, setWaitVsPickNowAdvisories] = useState({});
  const [positionScarcityWarnings, setPositionScarcityWarnings] = useState([]);
  const [draftStrategyInsights, setDraftStrategyInsights] = useState(null);

  // Performance optimization hooks
  const { getCachedCalculation, getCacheStats, clearCache } =
    useOptimizationCache();
  const {
    performanceMetrics,
    timeCalculation,
    getPerformanceSummary,
    meetsPerformanceTarget,
  } = usePerformanceMonitor();

  // Only show optimizer for the current user and when it's their turn or close to it
  const isCurrentUser = selectedMemberId === user.user_id;
  const currentPickNumber = draft.picks?.length + 1 || 1;
  const totalManagers = leagueUsers?.length || 12;

  // Calculate if it's user's turn or close to their turn
  const userTurnInfo = useMemo(() => {
    if (!isCurrentUser || !draft.picks)
      return { isUserTurn: false, picksUntilTurn: 999 };

    // Simple draft order calculation (assumes snake draft)
    const currentRound = Math.ceil(currentPickNumber / totalManagers);
    const pickInRound = ((currentPickNumber - 1) % totalManagers) + 1;

    // Find user's position in draft order (simplified)
    const userDraftPosition =
      leagueUsers.findIndex((u) => u.user_id === user.user_id) + 1;

    let userPickInRound;
    if (currentRound % 2 === 1) {
      // Odd round - normal order
      userPickInRound = userDraftPosition;
    } else {
      // Even round - reverse order (snake)
      userPickInRound = totalManagers - userDraftPosition + 1;
    }

    const isUserTurn = pickInRound === userPickInRound;
    const picksUntilTurn = isUserTurn
      ? 0
      : Math.abs(userPickInRound - pickInRound);

    return { isUserTurn, picksUntilTurn, userDraftPosition };
  }, [
    currentPickNumber,
    totalManagers,
    user.user_id,
    leagueUsers,
    isCurrentUser,
    draft.picks,
  ]);

  // Only show optimizer if it's user's turn or within 3 picks
  const shouldShowOptimizer = isCurrentUser && userTurnInfo.picksUntilTurn <= 3;

  // Debounce draft state changes to prevent excessive recalculations
  const debouncedDraftedPlayerIds = useDebounce(draftedPlayerIds, 150);
  const debouncedCurrentPickNumber = useDebounce(currentPickNumber, 100);

  // Debug logging for drafted players
  // useEffect(() => {
  //   if (process.env.NODE_ENV === "development") {
  //     console.log("DraftPickOptimizer - Drafted Players Debug:", {
  //       draftedPlayerIdsType: typeof draftedPlayerIds,
  //       draftedPlayerIdsSize: draftedPlayerIds?.size || 0,
  //       isSet: draftedPlayerIds instanceof Set,
  //       sampleDraftedIds:
  //         draftedPlayerIds instanceof Set
  //           ? Array.from(draftedPlayerIds).slice(0, 5)
  //           : "Not a Set",
  //       currentPickNumber,
  //       totalPicks: draft.picks?.length || 0,
  //       memberPicks:
  //         memberPicks?.map((p) => ({
  //           name: p.metadata?.name,
  //           position: p.metadata?.position,
  //           pickNo: p.pick_no,
  //         })) || [],
  //     });
  //   }
  // }, [draftedPlayerIds, currentPickNumber, draft.picks, memberPicks]);

  // Get available players (not drafted) - memoized for performance with validation
  const availablePlayers = useMemo(() => {
    if (!data?.players || !debouncedDraftedPlayerIds) return [];

    // Debug logging BEFORE filtering
    // if (process.env.NODE_ENV === "development") {
    //   console.log("BEFORE filtering - Total players:", data.players?.length);
    //   console.log(
    //     "Sample players from data:",
    //     data.players?.slice(0, 5).map((p) => ({
    //       name: p.player_info?.name,
    //       position: p.player_info?.position,
    //       player_id: p.player_info?.player_id,
    //       points: p.player_info?.projected_2025_points,
    //     }))
    //   );
    //   console.log(
    //     "Drafted player IDs:",
    //     Array.from(debouncedDraftedPlayerIds || [])
    //   );
    // }

    const rawPlayers = data.players.filter((player) => {
      const hasPlayerInfo = player?.player_info;
      const hasPlayerId = player?.player_info?.player_id;
      const isNotDrafted = !debouncedDraftedPlayerIds.has(
        player.player_info?.player_id
      );

      // Debug individual player filtering
      if (process.env.NODE_ENV === "development" && player?.player_info?.name) {
        const playerName = player.player_info.name;
        if (
          playerName.includes("Josh") ||
          playerName.includes("Christian") ||
          playerName.includes("Ashton")
        ) {
          // console.log(`Filtering ${playerName}:`, {
          //   hasPlayerInfo,
          //   hasPlayerId,
          //   playerId: player.player_info?.player_id,
          //   isNotDrafted,
          //   isDrafted: debouncedDraftedPlayerIds.has(
          //     player.player_info?.player_id
          //   ),
          //   willInclude: hasPlayerInfo && hasPlayerId && isNotDrafted,
          // });
        }
      }

      return hasPlayerInfo && hasPlayerId && isNotDrafted;
    });

    // Debug logging AFTER filtering
    // if (process.env.NODE_ENV === "development") {
    //   console.log("AFTER filtering - Available players:", rawPlayers.length);
    //   console.log(
    //     "Top available players:",
    //     rawPlayers
    //       .sort(
    //         (a, b) =>
    //           (b.player_info?.projected_2025_points || 0) -
    //           (a.player_info?.projected_2025_points || 0)
    //       )
    //       .slice(0, 10)
    //       .map((p) => ({
    //         name: p.player_info?.name,
    //         position: p.player_info?.position,
    //         points: p.player_info?.projected_2025_points,
    //       }))
    //   );
    // }

    // Validate and sanitize player data
    const validatedPlayers = validatePlayerArray(rawPlayers, {
      strict: false,
      fillDefaults: true,
    });

    // Debug logging AFTER validation
    // if (process.env.NODE_ENV === "development") {
    //   console.log("AFTER validation - Valid players:", validatedPlayers.length);
    // }

    return validatedPlayers;
  }, [data?.players, debouncedDraftedPlayerIds]);

  // Build current roster state for optimization context - memoized for performance
  const currentRoster = useMemo(() => {
    if (!memberPicks || !rosterFormat) return null;

    // Count positions
    const positionCounts = {};
    memberPicks.forEach((pick) => {
      const position = pick.metadata?.position;
      if (position) {
        positionCounts[position] = (positionCounts[position] || 0) + 1;
      }
    });

    // Build starters structure (simplified for optimization)
    const starters = {};
    rosterFormat.forEach(({ position, slots }) => {
      starters[position] = Array(slots).fill(null);
    });

    // Fill starters with current picks (simplified assignment)
    const sortedPicks = [...memberPicks].sort((a, b) => a.pick_no - b.pick_no);
    sortedPicks.forEach((pick) => {
      const position = pick.metadata?.position;
      if (position && starters[position]) {
        const emptySlot = starters[position].findIndex((slot) => slot === null);
        if (emptySlot !== -1) {
          starters[position][emptySlot] = pick;
        }
      }
    });

    const roster = {
      starters,
      bench: [],
      positionCounts,
    };

    // Debug logging for current roster
    // if (process.env.NODE_ENV === "development") {
    //   console.log("Current Roster Debug:", {
    //     positionCounts,
    //     starters: Object.keys(starters).reduce((acc, pos) => {
    //       acc[pos] = starters[pos]
    //         .filter((p) => p !== null)
    //         .map((p) => ({
    //           name: p.metadata?.name,
    //           position: p.metadata?.position,
    //         }));
    //       return acc;
    //     }, {}),
    //     rosterFormat:
    //       rosterFormat?.map((r) => ({
    //         position: r.position,
    //         slots: r.slots,
    //       })) || [],
    //   });
    // }

    return roster;
  }, [memberPicks, rosterFormat]);

  // Memoize expensive league analysis calculations
  const leagueAnalysisData = useMemo(() => {
    if (!leagueUsers || !draft.picks || !rosterFormat) return null;

    return {
      leagueAnalysis: analyzeLeagueNeeds(
        leagueUsers,
        draft.picks,
        rosterFormat
      ),
      draftOrder: leagueUsers,
      totalManagers: leagueUsers.length,
    };
  }, [leagueUsers, draft.picks, rosterFormat]);

  // Memoize optimization context to prevent unnecessary recalculations with validation
  const optimizationContext = useMemo(() => {
    if (!currentRoster || !leagueAnalysisData) {
      // Create degraded context if basic data is available
      if (availablePlayers.length > 0) {
        const degradedContext = createDegradedContext({
          currentRoster,
          rosterFormat,
          calculateCompositeValue,
          currentPickNumber: debouncedCurrentPickNumber,
          picksUntilNext: userTurnInfo.picksUntilTurn,
          memberPicks,
          draftedPlayerIds: debouncedDraftedPlayerIds,
          selectedMemberId,
          leagueUsers, // Include leagueUsers in degraded context
        });
        setDegradedMode(true);
        return degradedContext;
      }
      return null;
    }

    const context = {
      currentRoster,
      rosterFormat,
      calculateCompositeValue,
      currentPickNumber: debouncedCurrentPickNumber,
      picksUntilNext: userTurnInfo.picksUntilTurn,
      leagueUsers, // Add leagueUsers to context for validation
      ...leagueAnalysisData,
      memberPicks,
      draftedPlayerIds: debouncedDraftedPlayerIds,
      selectedMemberId,
    };

    // Validate context
    const { context: validatedContext, issues } = validateDraftContext(context);

    if (issues.length > 0) {
      console.warn("Draft context validation issues:", issues);
      setDegradedMode(true);
    } else {
      setDegradedMode(false);
    }

    return validatedContext;
  }, [
    currentRoster,
    leagueAnalysisData,
    calculateCompositeValue,
    debouncedCurrentPickNumber,
    userTurnInfo.picksUntilTurn,
    memberPicks,
    debouncedDraftedPlayerIds,
    selectedMemberId,
    availablePlayers.length,
    leagueUsers, // Add leagueUsers dependency
    rosterFormat, // Add rosterFormat dependency
  ]);

  // Fallback calculation function for when main optimization fails
  const performFallbackCalculation = useCallback(
    (context) => {
      console.warn("Using fallback optimization calculation");

      const fallbackRecommendations = generateFallbackRecommendations(
        availablePlayers,
        {
          currentRoster: context.currentRoster,
          rosterFormat: context.rosterFormat,
          calculateCompositeValue: context.calculateCompositeValue,
          memberPicks: context.memberPicks,
        }
      );

      return {
        recommendations: fallbackRecommendations,
        competitionData: null,
        availabilityProjections: null,
        rosterNeedsAnalysis: null,
        lastUpdated: new Date(),
        fallbackMode: true,
      };
    },
    [availablePlayers]
  );

  // Main optimization calculation function with error handling
  const performOptimizationCalculation = useCallback(
    (context) => {
      if (!context || !availablePlayers.length) {
        return {
          recommendations: [],
          competitionData: null,
          availabilityProjections: null,
          rosterNeedsAnalysis: null,
          lastUpdated: new Date(),
        };
      }

      // Check if we can provide meaningful recommendations
      const { canRecommend, reasons } = canProvideRecommendations(
        availablePlayers,
        context
      );
      if (!canRecommend) {
        throw new Error(
          `Cannot provide recommendations: ${reasons.join(", ")}`
        );
      }

      // Analyze league-wide competition with error handling
      let leagueAnalysis;
      try {
        leagueAnalysis =
          context.leagueAnalysis ||
          analyzeLeagueNeeds(
            context.leagueUsers || [],
            context.memberPicks || [],
            context.rosterFormat
          );
      } catch (error) {
        console.error("League analysis failed:", error);
        leagueAnalysis = {
          managerNeeds: {},
          positionDemand: {},
          totalManagers: context.totalManagers || 12,
        };
      }

      // Predict manager targeting with error handling
      let targetingPrediction;
      try {
        targetingPrediction = predictManagerTargeting(
          leagueAnalysis,
          context.draftOrder || [],
          context.currentPickNumber || 1,
          Math.min(10, (context.picksUntilNext || 0) + 5)
        );
      } catch (error) {
        console.error("Manager targeting prediction failed:", error);
        targetingPrediction = { nextFewPicks: [], positionTargeting: {} };
      }

      // Calculate position urgency scores with error handling
      let urgencyScores;
      try {
        urgencyScores = calculatePositionUrgencyScores(
          leagueAnalysis,
          targetingPrediction
        );
      } catch (error) {
        console.error("Position urgency calculation failed:", error);
        urgencyScores = { urgencyScores: {} };
      }

      // Project player availability for top players with position diversity
      // Ensure we get top players from each position, not just overall top scorers
      const playersByPosition = {};
      availablePlayers.forEach((player) => {
        const pos = player.player_info?.position;
        if (pos) {
          if (!playersByPosition[pos]) playersByPosition[pos] = [];
          playersByPosition[pos].push(player);
        }
      });

      // Sort each position by projected points and take top players from each
      Object.keys(playersByPosition).forEach((pos) => {
        playersByPosition[pos].sort(
          (a, b) =>
            (b.player_info?.projected_2025_points || 0) -
            (a.player_info?.projected_2025_points || 0)
        );
      });

      // Take top players ensuring position diversity
      const topPlayers = [];
      // Ensure we get at least 8 players per major position (QB, RB, WR, TE)
      const playersPerPosition = Math.max(8, Math.ceil(
        25 / Object.keys(playersByPosition).length
      ));

      Object.keys(playersByPosition).forEach((pos) => {
        const positionPlayers = playersByPosition[pos].slice(
          0,
          playersPerPosition
        );
        topPlayers.push(...positionPlayers);
        
        // Debug logging for position selection
        if (process.env.NODE_ENV === "development") {
          console.log(`Position ${pos} - Taking ${positionPlayers.length} players:`, 
            positionPlayers.map(p => ({
              name: p.player_info?.name,
              points: p.player_info?.projected_2025_points,
              rank: p.player_info?.overall_rank
            }))
          );
          
          // Special debug for WRs to see if top WRs are available
          // if (pos === 'WR') {
          //   console.log(`All available WRs (top 15):`, 
          //     playersByPosition[pos].slice(0, 8).map(p => ({
          //       name: p.player_info?.name,
          //       points: p.player_info?.projected_2025_points,
          //       rank: p.player_info?.overall_rank
          //     }))
          //   );
          // }
        }
      });

      // Fill remaining slots with overall top players if we have fewer than 25
      if (topPlayers.length < 25) {
        const remainingPlayers = availablePlayers
          .filter(
            (p) =>
              !topPlayers.some(
                (tp) => tp.player_info?.player_id === p.player_info?.player_id
              )
          )
          .sort(
            (a, b) =>
              (b.player_info?.projected_2025_points || 0) -
              (a.player_info?.projected_2025_points || 0)
          )
          .slice(0, 25 - topPlayers.length);
        topPlayers.push(...remainingPlayers);
      }

      // Limit to 25 total
      const finalTopPlayers = topPlayers.slice(0, 25);

      // Debug logging
      if (process.env.NODE_ENV === "development") {
        const positionBreakdown = {};
        finalTopPlayers.forEach(p => {
          const pos = p.player_info?.position;
          if (pos) {
            positionBreakdown[pos] = (positionBreakdown[pos] || 0) + 1;
          }
        });
        
        console.log("Optimization Debug:", {
          availablePlayersCount: availablePlayers.length,
          topPlayersCount: finalTopPlayers.length,
          positionBreakdown,
          sampleTopPlayers: finalTopPlayers.slice(0, 10).map((p) => ({
            name: p.player_info?.name,
            position: p.player_info?.position,
            points: p.player_info?.projected_2025_points,
          
          })),
        });
      }

      // Debug logging
      if (process.env.NODE_ENV === "development") {
        const positionBreakdown = {};
        finalTopPlayers.forEach((p) => {
          const pos = p.player_info?.position;
          if (pos) {
            positionBreakdown[pos] = (positionBreakdown[pos] || 0) + 1;
          }
        });

        // console.log("Optimization Debug:", {
        //   availablePlayersCount: availablePlayers.length,
        //   topPlayersCount: finalTopPlayers.length,
        //   positionBreakdown,
        //   sampleTopPlayers: finalTopPlayers.slice(0, 10).map((p) => ({
        //     name: p.player_info?.name,
        //     position: p.player_info?.position,
        //     points: p.player_info?.projected_2025_points,
        //   })),
        // });
      }

      let availabilityData;
      try {
        availabilityData = projectPlayerAvailability(finalTopPlayers, {
          currentPickNumber: context.currentPickNumber,
          picksUntilNext: context.picksUntilNext,
          leagueAnalysis,
          targetingPrediction,
          draftOrder: context.draftOrder,
          totalManagers: context.totalManagers,
          userFuturePicks: [], // Would calculate user's future picks in real implementation
        });
      } catch (error) {
        console.error("Availability projection failed:", error);
        availabilityData = {
          projections: {},
          summary: {
            totalPlayers: finalTopPlayers.length,
            highRiskPlayers: 0,
            safeWaitPlayers: 0,
            mediumRiskPlayers: 0,
          },
        };
      }

      // Enhanced optimization context
      const enhancedContext = {
        ...context,
        leagueAnalysis,
        targetingPrediction,
        urgencyScores,
      };

      // Generate recommendations with error handling
      let rankedRecommendations;
      try {
        rankedRecommendations = generateRankedRecommendations(
          finalTopPlayers,
          enhancedContext
        );

        // Debug logging
        if (process.env.NODE_ENV === "development") {
          console.log("Recommendations Generated:", {
            inputPlayersCount: topPlayers.length,
            recommendationsCount: rankedRecommendations.length,
            topRecommendations: rankedRecommendations.slice(0, 5).map((r) => ({
              name: r.player?.player_info?.name,
              position: r.player?.player_info?.position,
              score: r.optimization?.score,
              rank: r.rank,
              test:r.optimization
            })),
          });
        }
      } catch (error) {
        console.error("Recommendation generation failed:", error);
        rankedRecommendations = generateFallbackRecommendations(
          finalTopPlayers,
          context
        );
      }

      // Analyze roster needs with error handling
      let rosterNeeds;
      try {
        rosterNeeds = assessRosterNeeds(
          context.currentRoster,
          context.rosterFormat
        );
      } catch (error) {
        console.error("Roster needs analysis failed:", error);
        rosterNeeds = {
          positionNeeds: {},
          totalNeeds: 0,
          criticalNeeds: [],
          summary: "Roster analysis unavailable",
        };
      }

      return {
        recommendations: rankedRecommendations,
        competitionData: leagueAnalysis,
        availabilityProjections: availabilityData,
        rosterNeedsAnalysis: rosterNeeds,
        lastUpdated: new Date(),
      };
    },
    [availablePlayers]
  );

  // Create retryable optimization system
  const retryableOptimization = useMemo(() => {
    return createRetryableOptimization(
      performOptimizationCalculation,
      performFallbackCalculation,
      {
        retry: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 5000,
          retryCondition: (error) => {
            // Retry on network errors, timeouts, and calculation failures
            return (
              error.name === "NetworkError" ||
              error.name === "TimeoutError" ||
              error.message?.includes("timeout") ||
              error.message?.includes("calculation") ||
              error.message?.includes("optimization")
            );
          },
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTimeout: 30000,
        },
      }
    );
  }, [performOptimizationCalculation, performFallbackCalculation]);

  // Calculate optimization recommendations with retry mechanism and error handling
  const calculateRecommendations = useCallback(async () => {
    if (!shouldShowOptimizer || !optimizationContext) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use retryable optimization with caching and performance monitoring
      const result = await timeCalculation(async () => {
        const optimizationResult = await retryableOptimization.execute(
          optimizationContext
        );
        return getCachedCalculation(
          optimizationContext,
          () => optimizationResult
        );
      }, "optimization");

      const {
        recommendations: rankedRecommendations,
        competitionData: leagueAnalysis,
        availabilityProjections: availabilityData,
        rosterNeedsAnalysis: rosterNeeds,
        fallbackMode: isFallbackMode,
        fromCache,
        incremental,
        calculationTime,
      } = result.result;

      // Update state
      setRecommendations(rankedRecommendations);
      setCompetitionData(leagueAnalysis);
      setAvailabilityProjections(availabilityData);
      setRosterNeedsAnalysis(rosterNeeds);
      setLastUpdated(new Date());
      setFallbackMode(isFallbackMode || false);
      setRetryCount(0); // Reset retry count on success

      // Set optimization factors from first recommendation for display
      if (rankedRecommendations.length > 0) {
        setOptimizationFactors(rankedRecommendations[0].optimization.factors);
      }

      // Generate advanced recommendation features
      if (rankedRecommendations.length > 0 && !isFallbackMode) {
        try {
          // Generate alternative player suggestions for each recommendation
          const alternatives = {};
          const advisories = {};

          rankedRecommendations.forEach((recommendation) => {
            const playerId = recommendation.playerId;

            // Generate alternative suggestions
            alternatives[playerId] = generateAlternativePlayerSuggestions(
              recommendation,
              availablePlayers,
              optimizationContext
            );

            // Generate wait vs pick now advisory
            advisories[playerId] = createWaitVsPickNowAdvisory(
              recommendation,
              optimizationContext
            );
          });

          setAlternativePlayerSuggestions(alternatives);
          setWaitVsPickNowAdvisories(advisories);

          // Generate position scarcity warnings
          const scarcityWarnings = generatePositionScarcityWarnings(
            rankedRecommendations,
            optimizationContext
          );
          setPositionScarcityWarnings(scarcityWarnings);

          // Generate draft strategy insights
          const strategyInsights = generateDraftStrategyInsights(
            rankedRecommendations,
            optimizationContext
          );
          setDraftStrategyInsights(strategyInsights);
        } catch (advancedError) {
          console.warn(
            "Advanced recommendation features failed:",
            advancedError
          );
          // Don't fail the entire calculation if advanced features fail
        }
      } else {
        // Clear advanced features if in fallback mode
        setAlternativePlayerSuggestions({});
        setWaitVsPickNowAdvisories({});
        setPositionScarcityWarnings([]);
        setDraftStrategyInsights(null);
      }

      // Log performance information in development
      if (process.env.NODE_ENV === "development") {
        console.log(
          `Optimization calculation completed in ${result.calculationTime?.toFixed(
            2
          )}ms`,
          {
            fromCache,
            incremental,
            fallbackMode: isFallbackMode,
            degradedMode,
            meetsTarget: result.meetsTarget,
            recommendationsCount: rankedRecommendations.length,
          }
        );
      }
    } catch (err) {
      console.error("Error calculating recommendations:", err);
      setError(err);
      setRetryCount((prev) => prev + 1);

      // Try fallback if main optimization completely fails
      if (!fallbackMode) {
        try {
          console.warn("Main optimization failed, attempting fallback");
          const fallbackResult = await performFallbackCalculation(
            optimizationContext
          );
          setRecommendations(fallbackResult.recommendations);
          setFallbackMode(true);
          setLastUpdated(new Date());
        } catch (fallbackErr) {
          console.error("Fallback calculation also failed:", fallbackErr);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [
    shouldShowOptimizer,
    optimizationContext,
    timeCalculation,
    getCachedCalculation,
    retryableOptimization,
    fallbackMode,
    degradedMode,
    performFallbackCalculation,
  ]);

  // Use a ref to store the debounced timeout
  const debounceTimeoutRef = useRef(null);

  // Debounced calculation function to prevent excessive recalculations
  const debouncedCalculateRecommendations = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      calculateRecommendations();
      debounceTimeoutRef.current = null;
    }, 200);
  }, [calculateRecommendations]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // UI Polish: Animation and visual feedback functions
  const handleCardExpand = useCallback((playerId) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  }, []);

  const handleCardHover = useCallback((playerId) => {
    setHoveredCard(playerId);
  }, []);

  const handleCardLeave = useCallback(() => {
    setHoveredCard(null);
  }, []);

  // Smooth update animation when recommendations change
  useEffect(() => {
    if (recommendations.length > 0 && previousRecommendations.length > 0) {
      setIsAnimating(true);
      setShowUpdateIndicator(true);

      const animationTimer = setTimeout(() => {
        setIsAnimating(false);
      }, 300);

      const indicatorTimer = setTimeout(() => {
        setShowUpdateIndicator(false);
      }, 2000);

      return () => {
        clearTimeout(animationTimer);
        clearTimeout(indicatorTimer);
      };
    }
    setPreviousRecommendations(recommendations);
  }, [recommendations, previousRecommendations]);

  // Loading progress simulation for better UX
  useEffect(() => {
    if (loading) {
      setLoadingProgress(0);
      const progressInterval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 200);

      return () => clearInterval(progressInterval);
    } else {
      setLoadingProgress(100);
      setTimeout(() => setLoadingProgress(0), 500);
    }
  }, [loading]);

  // Keyboard navigation support
  const handleKeyNavigation = useCallback((e, action, data) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action(data);
    }
  }, []);

  // Real-time update system - recalculate when draft picks are made
  useEffect(() => {
    if (shouldShowOptimizer) {
      debouncedCalculateRecommendations();
    }
  }, [shouldShowOptimizer, debouncedCalculateRecommendations]);

  // Handle recommendation selection for detailed view
  const handleRecommendationSelect = useCallback((recommendation) => {
    setSelectedRecommendation(recommendation);
    setOptimizationFactors(recommendation.optimization.factors);
  }, []);

  // Handle retry after error
  const handleRetry = useCallback(() => {
    setError(null);
    setRetryCount(0);
    calculateRecommendations();
  }, [calculateRecommendations]);

  // Handle fallback mode toggle
  const handleFallback = useCallback(() => {
    setFallbackMode(true);
    setError(null);
    calculateRecommendations();
  }, [calculateRecommendations]);

  // Handle reset to normal mode
  const handleReset = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setFallbackMode(false);
    setDegradedMode(false);
    retryableOptimization.resetCircuitBreaker();
    clearCache();
    calculateRecommendations();
  }, [calculateRecommendations, retryableOptimization, clearCache]);

  // Don't render if not user's turn or close to it
  if (!shouldShowOptimizer) {
    return null;
  }

  return (
    <ErrorBoundary showDetails={process.env.NODE_ENV === "development"}>
      <SafeAnimationWrapper>
        <div
          className={`mt-6 p-3 sm:p-6 bg-[var(--secondary)]/20 rounded-lg border border-[var(--border)] ${styles.optimizerContainer}`}
          role="region"
          aria-labelledby="optimizer-heading"
          aria-describedby="optimizer-description"
        >
        {/* Removed inline styles to prevent animation conflicts */}
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-3 sm:space-y-0">
          <div className="flex-1">
            <h3
              id="optimizer-heading"
              className="text-lg sm:text-xl font-bold text-[var(--foreground)] flex items-center"
            >
              <span
                className="w-3 h-3 bg-blue-500 rounded-full mr-2 sm:mr-3 animate-pulse"
                aria-hidden="true"
              ></span>
              <span className="truncate">Draft Pick Optimizer</span>
              <button
                onClick={() => setShowDocumentation(true)}
                className="ml-2 p-1 text-gray-400 hover:text-gray-300 rounded-full hover:bg-[var(--secondary)]/20 transition-colors"
                aria-label="Open optimizer documentation"
                title="Learn how the optimizer works"
              >
                ?
              </button>
            </h3>
            <p
              id="optimizer-description"
              className="text-xs sm:text-sm opacity-80 mt-1"
            >
              {userTurnInfo.isUserTurn
                ? "It's your turn! Here are the top recommendations:"
                : `${userTurnInfo.picksUntilTurn} picks until your turn`}
            </p>
          </div>

          {lastUpdated && (
            <div className="text-xs opacity-60 space-y-1 flex-shrink-0">
              <div className="text-right flex items-center justify-end space-x-2">
                <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
                {showUpdateIndicator && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></span>
                    Updated
                  </span>
                )}
              </div>
              {performanceMetrics.totalCalculations > 0 && (
                <div className="flex items-center justify-end space-x-2">
                  <span>
                    Calc: {performanceMetrics.averageCalculationTime.toFixed(0)}
                    ms
                  </span>
                  {!meetsPerformanceTarget(
                    performanceMetrics.averageCalculationTime
                  ) && (
                    <span
                      className="text-yellow-400 text-xs animate-pulse"
                      title="Performance warning"
                    >
                      ⚠
                    </span>
                  )}
                  {getCacheStats().hitRate > 0 && (
                    <span className="text-green-400" title="Cache hit rate">
                      Cache: {(getCacheStats().hitRate * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error State with comprehensive error handling */}
        {error && (
          <div className="mb-6">
            <ErrorMessage
              error={error}
              onRetry={handleRetry}
              onFallback={handleFallback}
              onReset={handleReset}
              retryCount={retryCount}
              maxRetries={3}
              showDetails={process.env.NODE_ENV === "development"}
            />
          </div>
        )}

        {/* Mode indicators */}
        {(fallbackMode || degradedMode) && !error && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-400">⚠️</span>
              <div className="text-sm text-yellow-300">
                {fallbackMode && degradedMode ? (
                  <>Running in simplified mode with limited data</>
                ) : fallbackMode ? (
                  <>
                    Using simplified recommendations due to calculation issues
                  </>
                ) : (
                  <>
                    Running with limited data - some features may be unavailable
                  </>
                )}
              </div>
              <button
                onClick={handleReset}
                className="ml-auto px-2 py-1 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 rounded transition-colors"
              >
                Try Full Mode
              </button>
            </div>
          </div>
        )}

        {/* Loading State with Error Recovery and Progress */}
        {loading && (
          <div className="mb-6 p-4 bg-[var(--secondary)]/10 border border-[var(--border)] rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--primary)] border-t-transparent"></div>
              <span className="text-sm">
                {fallbackMode
                  ? "Calculating simplified recommendations..."
                  : degradedMode
                  ? "Calculating with limited data..."
                  : "Calculating optimal recommendations..."}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[var(--border)] rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--primary)] to-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>

            <div className="text-xs opacity-60 mt-2 text-center">
              {loadingProgress < 30
                ? "Analyzing available players..."
                : loadingProgress < 60
                ? "Calculating optimization scores..."
                : loadingProgress < 90
                ? "Generating recommendations..."
                : "Finalizing results..."}
            </div>
          </div>
        )}

        <LoadingWithError
          isLoading={false} // We handle loading above
          error={null} // Error is handled separately above
          onRetry={handleRetry}
          onFallback={handleFallback}
          loadingMessage=""
          className="hidden" // Hide the default loading component
        />

        {/* Roster Needs Summary - Responsive */}
        {rosterNeedsAnalysis && !loading && (
          <div
            className="mb-4 sm:mb-6 p-3 sm:p-4 bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-lg"
            role="region"
            aria-labelledby="roster-analysis-heading"
          >
            <h4
              id="roster-analysis-heading"
              className="font-semibold text-[var(--foreground)] mb-2 text-sm sm:text-base"
            >
              Roster Analysis
            </h4>
            <p className="text-xs sm:text-sm opacity-90">
              {rosterNeedsAnalysis.summary}
            </p>
            {rosterNeedsAnalysis.criticalNeeds.length > 0 && (
              <div
                className="mt-2 flex flex-wrap gap-1 sm:gap-2"
                role="list"
                aria-label="Critical roster needs"
              >
                {rosterNeedsAnalysis.criticalNeeds.map((need) => (
                  <span
                    key={need.position}
                    role="listitem"
                    className={`px-2 py-1 text-xs rounded-full touch-target ${
                      need.urgency === "high"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                    aria-label={`Need ${need.needed} ${need.position} players, ${need.urgency} urgency`}
                  >
                    {need.needed} {need.position}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recommendations with smooth transitions and responsive layout */}
        {recommendations.length > 0 && !loading && (
          <div
            className="space-y-6 transition-all duration-500 ease-in-out"
            role="region"
            aria-labelledby="recommendations-heading"
            aria-live="polite"
            aria-atomic="false"
          >
            <h4 id="recommendations-heading" className="sr-only">
              Player Recommendations
            </h4>

            {/* Desktop/Tablet: 2-column grid, Mobile: Horizontal scroll */}
            <div
              className="hidden sm:grid sm:grid-cols-1 lg:grid-cols-2 sm:gap-4"
              role="list"
              aria-label={`${recommendations.length} player recommendations`}
            >
              {recommendations.map((recommendation, index) => (
                <div
                  key={recommendation.playerId}
                  role="listitem"
                  className={`transform transition-opacity duration-300 ease-in-out ${styles.fadeInAnimation}`}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <RecommendationCard
                    player={recommendation.player}
                    optimization={recommendation.optimization}
                    rank={recommendation.rank}
                    recommendation={recommendation.recommendation}
                    alternativeSuggestions={
                      alternativePlayerSuggestions[recommendation.playerId] ||
                      []
                    }
                    waitVsPickNowAdvisory={
                      waitVsPickNowAdvisories[recommendation.playerId]
                    }
                    showAdvancedFeatures={!fallbackMode && !degradedMode}
                    isMobile={false}
                  />
                </div>
              ))}
            </div>

            {/* Mobile: Horizontal scrolling layout */}
            <div className="sm:hidden">
              <div
                className="flex space-x-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
                role="list"
                aria-label={`${recommendations.length} player recommendations, swipe to navigate`}
                tabIndex="0"
                onKeyDown={(e) => {
                  const container = e.currentTarget;
                  const cardWidth = container.firstChild?.offsetWidth || 300;
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    container.scrollBy({
                      left: -cardWidth,
                      behavior: "smooth",
                    });
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    container.scrollBy({ left: cardWidth, behavior: "smooth" });
                  }
                }}
              >
                {recommendations.map((recommendation, index) => (
                  <div
                    key={recommendation.playerId}
                    className={`flex-none w-72 transform transition-opacity duration-300 ease-in-out snap-start ${styles.fadeInAnimation}`}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <RecommendationCard
                      player={recommendation.player}
                      optimization={recommendation.optimization}
                      rank={recommendation.rank}
                      recommendation={recommendation.recommendation}
                      alternativeSuggestions={
                        alternativePlayerSuggestions[recommendation.playerId] ||
                        []
                      }
                      waitVsPickNowAdvisory={
                        waitVsPickNowAdvisories[recommendation.playerId]
                      }
                      showAdvancedFeatures={!fallbackMode && !degradedMode}
                      isMobile={true}
                    />
                  </div>
                ))}
              </div>

              {/* Mobile scroll indicator */}
              <div className="flex justify-center mt-2 space-x-1">
                {recommendations.map((_, index) => (
                  <div
                    key={index}
                    className="w-2 h-2 rounded-full bg-[var(--border)] opacity-50"
                  />
                ))}
              </div>
            </div>

            {/* Position Scarcity Warnings */}
            {positionScarcityWarnings.length > 0 && !fallbackMode && (
              <div className="mt-6 p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                <h4 className="font-semibold text-red-400 mb-3 flex items-center">
                  <span className="w-3 h-3 bg-red-400 rounded-full mr-2 animate-pulse"></span>
                  Position Scarcity Alerts
                </h4>
                <div className="space-y-3">
                  {positionScarcityWarnings.map((warning, index) => (
                    <div
                      key={warning.playerId}
                      className={`p-3 rounded-lg border ${
                        warning.severity === "critical"
                          ? "bg-red-500/20 border-red-500/40"
                          : warning.severity === "high"
                          ? "bg-orange-500/20 border-orange-500/40"
                          : "bg-yellow-500/20 border-yellow-500/40"
                      }`}
                    >
                      <div className="text-sm font-medium mb-1">
                        {warning.warning}
                      </div>
                      <div className="text-xs opacity-90">
                        {warning.recommendation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Draft Strategy Insights */}
            {draftStrategyInsights && !fallbackMode && (
              <div className="mt-6 p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <h4 className="font-semibold text-purple-400 mb-3 flex items-center">
                  <span className="w-3 h-3 bg-purple-400 rounded-full mr-2"></span>
                  Draft Strategy Insights
                </h4>

                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-purple-300 mb-1">
                      Overall Strategy
                    </div>
                    <div className="text-sm opacity-90">
                      {draftStrategyInsights.overallStrategy}
                    </div>
                  </div>

                  {draftStrategyInsights.insights.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-purple-300 mb-2">
                        Key Insights
                      </div>
                      <div className="space-y-2">
                        {draftStrategyInsights.insights
                          .slice(0, 3)
                          .map((insight, index) => (
                            <div
                              key={index}
                              className={`text-xs p-2 rounded ${
                                insight.priority === "critical"
                                  ? "bg-red-500/20"
                                  : insight.priority === "high"
                                  ? "bg-orange-500/20"
                                  : "bg-blue-500/20"
                              }`}
                            >
                              <div className="font-medium mb-1">
                                {insight.message}
                              </div>
                              <div className="opacity-80">
                                {insight.actionable}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {draftStrategyInsights.nextPhaseStrategy && (
                    <div>
                      <div className="text-sm font-medium text-purple-300 mb-1">
                        Next Phase Strategy
                      </div>
                      <div className="text-xs opacity-90">
                        <span className="font-medium">
                          {draftStrategyInsights.nextPhaseStrategy.timeframe}:{" "}
                        </span>
                        {draftStrategyInsights.nextPhaseStrategy.strategy}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Factor Details Toggle */}
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setShowFactorDetails(!showFactorDetails)}
                className="px-4 py-2 bg-[var(--secondary)]/50 hover:bg-[var(--secondary)]/70 rounded-lg transition-colors border border-[var(--border)]"
              >
                {showFactorDetails ? "Hide" : "Show"} Detailed Factor Analysis
              </button>
            </div>

            {/* Detailed Factor Analysis */}
            {showFactorDetails && optimizationFactors && (
              <div className="mt-6 p-4 bg-[var(--secondary)]/30 rounded-lg border border-[var(--border)]">
                <OptimizationFactors
                  factors={optimizationFactors}
                  showComparison={false}
                />
              </div>
            )}
          </div>
        )}

        {/* No Recommendations State */}
        {!loading && !error && recommendations.length === 0 && (
          <div className="text-center py-8 opacity-60">
            <div className="text-lg mb-2">No recommendations available</div>
            <div className="text-sm">
              {availablePlayers.length === 0
                ? "No players available for analysis"
                : "Unable to generate recommendations with current data"}
            </div>
          </div>
        )}

        {/* Competition & Availability Summary */}
        {competitionData && availabilityProjections && !loading && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[var(--secondary)]/20 rounded-lg border border-[var(--border)]">
              <h5 className="font-semibold text-[var(--foreground)] mb-2">
                League Competition
              </h5>
              <div className="space-y-2 text-sm">
                {Object.entries(competitionData.positionDemand).map(
                  ([position, demand]) => (
                    <div key={position} className="flex justify-between">
                      <span>{position}:</span>
                      <span
                        className={`font-medium ${
                          demand.competitionLevel === "very_high"
                            ? "text-red-400"
                            : demand.competitionLevel === "high"
                            ? "text-orange-400"
                            : demand.competitionLevel === "medium"
                            ? "text-yellow-400"
                            : "text-green-400"
                        }`}
                      >
                        {demand.competitionLevel.replace("_", " ")}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="p-4 bg-[var(--secondary)]/20 rounded-lg border border-[var(--border)]">
              <h5 className="font-semibold text-[var(--foreground)] mb-2">
                Availability Summary
              </h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>High Risk Players:</span>
                  <span className="font-medium text-red-400">
                    {availabilityProjections.summary.highRiskPlayers}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Safe to Wait:</span>
                  <span className="font-medium text-green-400">
                    {availabilityProjections.summary.safeWaitPlayers}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Medium Risk:</span>
                  <span className="font-medium text-yellow-400">
                    {availabilityProjections.summary.mediumRiskPlayers}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* User Documentation Modal */}
        <UserDocumentation
          isOpen={showDocumentation}
          onClose={() => setShowDocumentation(false)}
        />
      </SafeAnimationWrapper>
    </ErrorBoundary>
  );
}

export default DraftPickOptimizer;
