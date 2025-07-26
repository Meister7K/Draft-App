/**
 * Custom hook for caching optimization calculations to improve performance
 * Implements incremental updates and memoization for expensive calculations
 */

import { useState, useCallback, useMemo, useRef } from 'react';

/**
 * Cache key generator for optimization calculations
 * @param {Object} context - Optimization context
 * @returns {string} Cache key
 */
function generateCacheKey(context) {
  const {
    currentPickNumber,
    picksUntilNext,
    memberPicks,
    draftedPlayerIds,
    selectedMemberId
  } = context;

  // Create a stable key based on draft state
  const memberPicksKey = memberPicks?.map(p => p.player_id).sort().join(',') || '';
  const draftedPlayersKey = Array.from(draftedPlayerIds || []).sort().join(',');
  
  return `${selectedMemberId}-${currentPickNumber}-${picksUntilNext}-${memberPicksKey}-${draftedPlayersKey}`;
}

/**
 * Custom hook for caching optimization calculations
 * @returns {Object} Cache utilities and cached calculation function
 */
export function useOptimizationCache() {
  const [cache, setCache] = useState(new Map());
  const [lastCacheKey, setLastCacheKey] = useState(null);
  const calculationTimeRef = useRef(0);
  const cacheHitsRef = useRef(0);
  const cacheMissesRef = useRef(0);

  // Clear cache when it gets too large
  const clearCacheIfNeeded = useCallback(() => {
    if (cache.size > 50) {
      // Keep only the 10 most recent entries
      const entries = Array.from(cache.entries());
      const recentEntries = entries.slice(-10);
      setCache(new Map(recentEntries));
    }
  }, [cache.size]);

  // Get cached result or mark as cache miss
  const getCachedResult = useCallback((cacheKey) => {
    if (cache.has(cacheKey)) {
      cacheHitsRef.current++;
      return cache.get(cacheKey);
    }
    cacheMissesRef.current++;
    return null;
  }, [cache]);

  // Store result in cache
  const setCachedResult = useCallback((cacheKey, result, calculationTime) => {
    const cacheEntry = {
      result,
      timestamp: Date.now(),
      calculationTime
    };
    
    setCache(prevCache => {
      const newCache = new Map(prevCache);
      newCache.set(cacheKey, cacheEntry);
      return newCache;
    });
    
    setLastCacheKey(cacheKey);
    calculationTimeRef.current = calculationTime;
    
    // Clean up cache if needed
    clearCacheIfNeeded();
  }, [clearCacheIfNeeded]);

  // Check if incremental update is possible
  const canUseIncrementalUpdate = useCallback((newCacheKey, oldCacheKey) => {
    if (!oldCacheKey || !newCacheKey) return false;
    
    const oldParts = oldCacheKey.split('-');
    const newParts = newCacheKey.split('-');
    
    // Can use incremental update if only pick number changed by 1
    if (oldParts.length === newParts.length && oldParts.length >= 3) {
      const oldPickNumber = parseInt(oldParts[1]);
      const newPickNumber = parseInt(newParts[1]);
      
      // Same user, pick number increased by 1, same roster
      return (
        oldParts[0] === newParts[0] && // Same user
        newPickNumber === oldPickNumber + 1 && // Pick advanced by 1
        oldParts[3] === newParts[3] // Same member picks
      );
    }
    
    return false;
  }, []);

  // Perform incremental update on cached result
  const performIncrementalUpdate = useCallback((cachedResult, context) => {
    if (!cachedResult?.result) return null;
    
    const { recommendations } = cachedResult.result;
    if (!recommendations || !Array.isArray(recommendations)) return null;
    
    // For incremental updates, we mainly need to update availability scores
    // since competition and other factors change minimally with single pick changes
    try {
      const updatedRecommendations = recommendations.map(rec => {
        // Recalculate only availability factor for performance
        const availabilityFactor = calculateAvailabilityScore(rec.player, context);
        
        // Update the availability factor
        const updatedFactors = {
          ...rec.optimization.factors,
          availability: availabilityFactor
        };
        
        // Recalculate overall score with new availability
        const weights = {
          rosterNeed: 0.25,
          playerValue: 0.30,
          competition: 0.20,
          availability: 0.15,
          startingLineupImpact: 0.10
        };
        
        const newScore = Object.keys(updatedFactors).reduce((total, factorKey) => {
          return total + (updatedFactors[factorKey].score * weights[factorKey]);
        }, 0);
        
        return {
          ...rec,
          optimization: {
            ...rec.optimization,
            score: Math.round(newScore * 10) / 10,
            factors: updatedFactors
          }
        };
      });
      
      // Re-sort by new scores
      updatedRecommendations.sort((a, b) => b.optimization.score - a.optimization.score);
      
      // Update rankings
      updatedRecommendations.forEach((rec, index) => {
        rec.rank = index + 1;
      });
      
      return {
        ...cachedResult.result,
        recommendations: updatedRecommendations.slice(0, 5), // Keep top 5
        lastUpdated: new Date(),
        updateType: 'incremental'
      };
    } catch (error) {
      console.warn('Incremental update failed, will perform full calculation:', error);
      return null;
    }
  }, []);

  // Main cached calculation function
  const getCachedCalculation = useCallback((context, calculationFunction) => {
    const startTime = performance.now();
    const cacheKey = generateCacheKey(context);
    
    // Try to get cached result
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult.result,
        fromCache: true,
        cacheHit: true
      };
    }
    
    // Check if we can do incremental update
    if (lastCacheKey && canUseIncrementalUpdate(cacheKey, lastCacheKey)) {
      const lastCachedResult = getCachedResult(lastCacheKey);
      if (lastCachedResult) {
        const incrementalResult = performIncrementalUpdate(lastCachedResult, context);
        if (incrementalResult) {
          const calculationTime = performance.now() - startTime;
          setCachedResult(cacheKey, incrementalResult, calculationTime);
          return {
            ...incrementalResult,
            fromCache: false,
            incremental: true,
            calculationTime
          };
        }
      }
    }
    
    // Perform full calculation
    const result = calculationFunction(context);
    const calculationTime = performance.now() - startTime;
    
    setCachedResult(cacheKey, result, calculationTime);
    
    return {
      ...result,
      fromCache: false,
      incremental: false,
      calculationTime
    };
  }, [getCachedResult, setCachedResult, lastCacheKey, canUseIncrementalUpdate, performIncrementalUpdate]);

  // Cache statistics
  const getCacheStats = useCallback(() => {
    return {
      cacheSize: cache.size,
      cacheHits: cacheHitsRef.current,
      cacheMisses: cacheMissesRef.current,
      hitRate: cacheHitsRef.current / (cacheHitsRef.current + cacheMissesRef.current) || 0,
      lastCalculationTime: calculationTimeRef.current
    };
  }, [cache.size]);

  // Clear cache manually
  const clearCache = useCallback(() => {
    setCache(new Map());
    setLastCacheKey(null);
    cacheHitsRef.current = 0;
    cacheMissesRef.current = 0;
    calculationTimeRef.current = 0;
  }, []);

  return {
    getCachedCalculation,
    getCacheStats,
    clearCache
  };
}

// Helper function for availability calculation (simplified for incremental updates)
function calculateAvailabilityScore(player, context) {
  const { currentPickNumber, picksUntilNext } = context;
  const overallRank = player.player_info?.overall_rank || 999;
  
  let score = 50;
  let explanation = "Moderate availability expected";
  
  if (overallRank < currentPickNumber - 20) {
    score = 20;
    explanation = "Low availability - player ranked higher than current pick";
  } else if (overallRank > currentPickNumber + 20) {
    score = 80;
    explanation = "High availability - player likely available in later rounds";
  }
  
  return {
    score,
    explanation: `${explanation} (incremental update)`
  };
}

export default useOptimizationCache;