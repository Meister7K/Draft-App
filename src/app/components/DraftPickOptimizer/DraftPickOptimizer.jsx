/**
 * DraftPickOptimizer - Main container component
 * Integrates with YourDraftPicks to provide real-time draft pick recommendations
 * Manages state, real-time updates, and coordinates all optimization subsystems
 * Includes performance optimizations: memoization, debouncing, and incremental updates
 */

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { RecommendationCard } from "./RecommendationCard";
import { OptimizationFactors } from "./OptimizationFactors";
import { 
  generateRankedRecommendations, 
  assessRosterNeeds 
} from "./OptimizationEngine";
import { analyzeLeagueNeeds, predictManagerTargeting, calculatePositionUrgencyScores } from "./CompetitionAnalyzer";
import { projectPlayerAvailability } from "./AvailabilityPredictor";
import { useDebounce, useDebouncedCallback } from "./hooks/useDebounce";
import { useOptimizationCache } from "./hooks/useOptimizationCache";
import { usePerformanceMonitor } from "./hooks/usePerformanceMonitor";
import ErrorBoundary from "./ErrorBoundary";
import { ErrorMessage, LoadingWithError } from "./ErrorMessages";
import { generateFallbackRecommendations, validatePlayerData } from "./FallbackRecommendations";
import { validateAndSanitizePlayer, validatePlayerArray, validateDraftContext, createDegradedContext, canProvideRecommendations } from "./GracefulDegradation";
import { createRetryableOptimization, safeExecute } from "./RetryMechanism";

export function DraftPickOptimizer({
  user,
  leagueUsers,
  data,
  draft,
  selectedMemberId,
  memberPicks,
  draftedPlayerIds,
  calculateCompositeValue,
  rosterFormat
}) {
  // State management for recommendations and UI
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showFactorDetails, setShowFactorDetails] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [degradedMode, setDegradedMode] = useState(false);

  // State for optimization analysis data
  const [competitionData, setCompetitionData] = useState(null);
  const [availabilityProjections, setAvailabilityProjections] = useState(null);
  const [optimizationFactors, setOptimizationFactors] = useState(null);
  const [rosterNeedsAnalysis, setRosterNeedsAnalysis] = useState(null);

  // Performance optimization hooks
  const { getCachedCalculation, getCacheStats, clearCache } = useOptimizationCache();
  const { 
    performanceMetrics, 
    timeCalculation, 
    getPerformanceSummary,
    meetsPerformanceTarget 
  } = usePerformanceMonitor();

  // Only show optimizer for the current user and when it's their turn or close to it
  const isCurrentUser = selectedMemberId === user.user_id;
  const currentPickNumber = draft.picks?.length + 1 || 1;
  const totalManagers = leagueUsers?.length || 12;
  
  // Calculate if it's user's turn or close to their turn
  const userTurnInfo = useMemo(() => {
    if (!isCurrentUser || !draft.picks) return { isUserTurn: false, picksUntilTurn: 999 };
    
    // Simple draft order calculation (assumes snake draft)
    const currentRound = Math.ceil(currentPickNumber / totalManagers);
    const pickInRound = ((currentPickNumber - 1) % totalManagers) + 1;
    
    // Find user's position in draft order (simplified)
    const userDraftPosition = leagueUsers.findIndex(u => u.user_id === user.user_id) + 1;
    
    let userPickInRound;
    if (currentRound % 2 === 1) {
      // Odd round - normal order
      userPickInRound = userDraftPosition;
    } else {
      // Even round - reverse order (snake)
      userPickInRound = totalManagers - userDraftPosition + 1;
    }
    
    const isUserTurn = pickInRound === userPickInRound;
    const picksUntilTurn = isUserTurn ? 0 : Math.abs(userPickInRound - pickInRound);
    
    return { isUserTurn, picksUntilTurn, userDraftPosition };
  }, [currentPickNumber, totalManagers, user.user_id, leagueUsers, isCurrentUser, draft.picks]);

  // Only show optimizer if it's user's turn or within 3 picks
  const shouldShowOptimizer = isCurrentUser && userTurnInfo.picksUntilTurn <= 3;

  // Debounce draft state changes to prevent excessive recalculations
  const debouncedDraftedPlayerIds = useDebounce(draftedPlayerIds, 150);
  const debouncedCurrentPickNumber = useDebounce(currentPickNumber, 100);

  // Get available players (not drafted) - memoized for performance with validation
  const availablePlayers = useMemo(() => {
    if (!data?.players || !debouncedDraftedPlayerIds) return [];
    
    const rawPlayers = data.players.filter(player => 
      player?.player_info?.player_id && 
      !debouncedDraftedPlayerIds.has(player.player_info.player_id)
    );

    // Validate and sanitize player data
    return validatePlayerArray(rawPlayers, { strict: false, fillDefaults: true });
  }, [data?.players, debouncedDraftedPlayerIds]);

  // Build current roster state for optimization context - memoized for performance
  const currentRoster = useMemo(() => {
    if (!memberPicks || !rosterFormat) return null;

    // Count positions
    const positionCounts = {};
    memberPicks.forEach(pick => {
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
    sortedPicks.forEach(pick => {
      const position = pick.metadata?.position;
      if (position && starters[position]) {
        const emptySlot = starters[position].findIndex(slot => slot === null);
        if (emptySlot !== -1) {
          starters[position][emptySlot] = pick;
        }
      }
    });

    return {
      starters,
      bench: [],
      positionCounts
    };
  }, [memberPicks, rosterFormat]);

  // Memoize expensive league analysis calculations
  const leagueAnalysisData = useMemo(() => {
    if (!leagueUsers || !draft.picks || !rosterFormat) return null;
    
    return {
      leagueAnalysis: analyzeLeagueNeeds(leagueUsers, draft.picks, rosterFormat),
      draftOrder: leagueUsers,
      totalManagers: leagueUsers.length
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
          selectedMemberId
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
      ...leagueAnalysisData,
      memberPicks,
      draftedPlayerIds: debouncedDraftedPlayerIds,
      selectedMemberId
    };

    // Validate context
    const { context: validatedContext, issues } = validateDraftContext(context);
    
    if (issues.length > 0) {
      console.warn('Draft context validation issues:', issues);
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
    availablePlayers.length
  ]);

  // Fallback calculation function for when main optimization fails
  const performFallbackCalculation = useCallback((context) => {
    console.warn('Using fallback optimization calculation');
    
    const fallbackRecommendations = generateFallbackRecommendations(availablePlayers, {
      currentRoster: context.currentRoster,
      rosterFormat: context.rosterFormat,
      calculateCompositeValue: context.calculateCompositeValue,
      memberPicks: context.memberPicks
    });

    return {
      recommendations: fallbackRecommendations,
      competitionData: null,
      availabilityProjections: null,
      rosterNeedsAnalysis: null,
      lastUpdated: new Date(),
      fallbackMode: true
    };
  }, [availablePlayers]);

  // Main optimization calculation function with error handling
  const performOptimizationCalculation = useCallback((context) => {
    if (!context || !availablePlayers.length) {
      return {
        recommendations: [],
        competitionData: null,
        availabilityProjections: null,
        rosterNeedsAnalysis: null,
        lastUpdated: new Date()
      };
    }

    // Check if we can provide meaningful recommendations
    const { canRecommend, reasons } = canProvideRecommendations(availablePlayers, context);
    if (!canRecommend) {
      throw new Error(`Cannot provide recommendations: ${reasons.join(', ')}`);
    }

    // Analyze league-wide competition with error handling
    let leagueAnalysis;
    try {
      leagueAnalysis = context.leagueAnalysis || analyzeLeagueNeeds(context.leagueUsers || [], context.memberPicks || [], context.rosterFormat);
    } catch (error) {
      console.error('League analysis failed:', error);
      leagueAnalysis = { managerNeeds: {}, positionDemand: {}, totalManagers: context.totalManagers || 12 };
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
      console.error('Manager targeting prediction failed:', error);
      targetingPrediction = { nextFewPicks: [], positionTargeting: {} };
    }
    
    // Calculate position urgency scores with error handling
    let urgencyScores;
    try {
      urgencyScores = calculatePositionUrgencyScores(leagueAnalysis, targetingPrediction);
    } catch (error) {
      console.error('Position urgency calculation failed:', error);
      urgencyScores = { urgencyScores: {} };
    }
    
    // Project player availability for top players only (performance optimization)
    const topPlayers = availablePlayers
      .sort((a, b) => (b.player_info?.projected_2025_points || 0) - (a.player_info?.projected_2025_points || 0))
      .slice(0, 25); // Analyze top 25 available players for performance

    let availabilityData;
    try {
      availabilityData = projectPlayerAvailability(topPlayers, {
        currentPickNumber: context.currentPickNumber,
        picksUntilNext: context.picksUntilNext,
        leagueAnalysis,
        targetingPrediction,
        draftOrder: context.draftOrder,
        totalManagers: context.totalManagers,
        userFuturePicks: [] // Would calculate user's future picks in real implementation
      });
    } catch (error) {
      console.error('Availability projection failed:', error);
      availabilityData = { projections: {}, summary: { totalPlayers: topPlayers.length, highRiskPlayers: 0, safeWaitPlayers: 0, mediumRiskPlayers: 0 } };
    }

    // Enhanced optimization context
    const enhancedContext = {
      ...context,
      leagueAnalysis,
      targetingPrediction,
      urgencyScores
    };

    // Generate recommendations with error handling
    let rankedRecommendations;
    try {
      rankedRecommendations = generateRankedRecommendations(topPlayers, enhancedContext);
    } catch (error) {
      console.error('Recommendation generation failed:', error);
      rankedRecommendations = generateFallbackRecommendations(topPlayers, context);
    }

    // Analyze roster needs with error handling
    let rosterNeeds;
    try {
      rosterNeeds = assessRosterNeeds(context.currentRoster, context.rosterFormat);
    } catch (error) {
      console.error('Roster needs analysis failed:', error);
      rosterNeeds = { positionNeeds: {}, totalNeeds: 0, criticalNeeds: [], summary: 'Roster analysis unavailable' };
    }

    return {
      recommendations: rankedRecommendations,
      competitionData: leagueAnalysis,
      availabilityProjections: availabilityData,
      rosterNeedsAnalysis: rosterNeeds,
      lastUpdated: new Date()
    };
  }, [availablePlayers]);

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
              error.name === 'NetworkError' ||
              error.name === 'TimeoutError' ||
              error.message?.includes('timeout') ||
              error.message?.includes('calculation') ||
              error.message?.includes('optimization')
            );
          }
        },
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTimeout: 30000
        }
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
      const result = await timeCalculation(
        async () => {
          const optimizationResult = await retryableOptimization.execute(optimizationContext);
          return getCachedCalculation(optimizationContext, () => optimizationResult);
        },
        'optimization'
      );

      const { 
        recommendations: rankedRecommendations,
        competitionData: leagueAnalysis,
        availabilityProjections: availabilityData,
        rosterNeedsAnalysis: rosterNeeds,
        fallbackMode: isFallbackMode,
        fromCache,
        incremental,
        calculationTime
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

      // Log performance information in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Optimization calculation completed in ${result.calculationTime?.toFixed(2)}ms`, {
          fromCache,
          incremental,
          fallbackMode: isFallbackMode,
          degradedMode,
          meetsTarget: result.meetsTarget,
          recommendationsCount: rankedRecommendations.length
        });
      }

    } catch (err) {
      console.error('Error calculating recommendations:', err);
      setError(err);
      setRetryCount(prev => prev + 1);
      
      // Try fallback if main optimization completely fails
      if (!fallbackMode) {
        try {
          console.warn('Main optimization failed, attempting fallback');
          const fallbackResult = await performFallbackCalculation(optimizationContext);
          setRecommendations(fallbackResult.recommendations);
          setFallbackMode(true);
          setLastUpdated(new Date());
        } catch (fallbackErr) {
          console.error('Fallback calculation also failed:', fallbackErr);
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
    performFallbackCalculation
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

  // Handle player selection (could integrate with draft system)
  const handlePlayerSelect = useCallback((player) => {
    // This would integrate with the actual draft system
    console.log('Player selected for drafting:', player.player_info.name);
    // In real implementation, this might trigger a draft pick or add to watch list
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
    <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
      <div className="mt-6 p-6 bg-[var(--secondary)]/20 rounded-lg border border-[var(--border)]">
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .recommendation-card {
          animation: fadeInUp 0.3s ease-out forwards;
        }
        
        .performance-warning {
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-[var(--foreground)] flex items-center">
            <span className="w-3 h-3 bg-blue-500 rounded-full mr-3 animate-pulse"></span>
            Draft Pick Optimizer
          </h3>
          <p className="text-sm opacity-80 mt-1">
            {userTurnInfo.isUserTurn 
              ? "It's your turn! Here are the top recommendations:"
              : `${userTurnInfo.picksUntilTurn} picks until your turn`
            }
          </p>
        </div>
        
        {lastUpdated && (
          <div className="text-xs opacity-60 space-y-1">
            <div>Updated: {lastUpdated.toLocaleTimeString()}</div>
            {performanceMetrics.totalCalculations > 0 && (
              <div className="flex items-center space-x-2">
                <span>Calc: {performanceMetrics.averageCalculationTime.toFixed(0)}ms</span>
                {!meetsPerformanceTarget(performanceMetrics.averageCalculationTime) && (
                  <span className="text-yellow-400 text-xs">⚠</span>
                )}
                {getCacheStats().hitRate > 0 && (
                  <span className="text-green-400">Cache: {(getCacheStats().hitRate * 100).toFixed(0)}%</span>
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
            showDetails={process.env.NODE_ENV === 'development'}
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
                <>Using simplified recommendations due to calculation issues</>
              ) : (
                <>Running with limited data - some features may be unavailable</>
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

      {/* Loading State with Error Recovery */}
      <LoadingWithError
        isLoading={loading}
        error={null} // Error is handled separately above
        onRetry={handleRetry}
        onFallback={handleFallback}
        loadingMessage={
          fallbackMode 
            ? "Calculating simplified recommendations..." 
            : degradedMode 
              ? "Calculating with limited data..."
              : "Calculating optimal recommendations..."
        }
        className="mb-6"
      />

      {/* Roster Needs Summary */}
      {rosterNeedsAnalysis && !loading && (
        <div className="mb-6 p-4 bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-lg">
          <h4 className="font-semibold text-[var(--foreground)] mb-2">Roster Analysis</h4>
          <p className="text-sm opacity-90">{rosterNeedsAnalysis.summary}</p>
          {rosterNeedsAnalysis.criticalNeeds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {rosterNeedsAnalysis.criticalNeeds.map(need => (
                <span 
                  key={need.position}
                  className={`px-2 py-1 text-xs rounded-full ${
                    need.urgency === 'high' 
                      ? 'bg-red-500/20 text-red-400' 
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {need.needed} {need.position}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendations with smooth transitions */}
      {recommendations.length > 0 && !loading && (
        <div className="space-y-6 transition-all duration-500 ease-in-out">
          <div className="grid gap-4">
            {recommendations.map((recommendation, index) => (
              <div
                key={recommendation.playerId}
                className="transform transition-all duration-300 ease-in-out"
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: 'fadeInUp 0.3s ease-out forwards'
                }}
              >
                <RecommendationCard
                  player={recommendation.player}
                  optimization={recommendation.optimization}
                  rank={recommendation.rank}
                  recommendation={recommendation.recommendation}
                  onPlayerSelect={handlePlayerSelect}
                />
              </div>
            ))}
          </div>

          {/* Factor Details Toggle */}
          <div className="flex justify-center">
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
              : "Unable to generate recommendations with current data"
            }
          </div>
        </div>
      )}

      {/* Competition & Availability Summary */}
      {competitionData && availabilityProjections && !loading && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--secondary)]/20 rounded-lg border border-[var(--border)]">
            <h5 className="font-semibold text-[var(--foreground)] mb-2">League Competition</h5>
            <div className="space-y-2 text-sm">
              {Object.entries(competitionData.positionDemand).map(([position, demand]) => (
                <div key={position} className="flex justify-between">
                  <span>{position}:</span>
                  <span className={`font-medium ${
                    demand.competitionLevel === 'very_high' ? 'text-red-400' :
                    demand.competitionLevel === 'high' ? 'text-orange-400' :
                    demand.competitionLevel === 'medium' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {demand.competitionLevel.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-[var(--secondary)]/20 rounded-lg border border-[var(--border)]">
            <h5 className="font-semibold text-[var(--foreground)] mb-2">Availability Summary</h5>
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
    </ErrorBoundary>
  );
}

export default DraftPickOptimizer;