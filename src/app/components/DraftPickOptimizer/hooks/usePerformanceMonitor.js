/**
 * Custom hook for monitoring optimization performance
 * Tracks calculation times and provides performance metrics
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Performance monitoring hook for optimization calculations
 * @returns {Object} Performance monitoring utilities
 */
export function usePerformanceMonitor() {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageCalculationTime: 0,
    maxCalculationTime: 0,
    minCalculationTime: Infinity,
    totalCalculations: 0,
    slowCalculations: 0, // Calculations over 500ms
    recentCalculations: []
  });

  const calculationTimesRef = useRef([]);
  const performanceWarningRef = useRef(false);

  // Record a calculation time
  const recordCalculationTime = useCallback((calculationTime, calculationType = 'full') => {
    const timestamp = Date.now();
    
    calculationTimesRef.current.push({
      time: calculationTime,
      type: calculationType,
      timestamp
    });

    // Keep only last 50 calculations for memory efficiency
    if (calculationTimesRef.current.length > 50) {
      calculationTimesRef.current = calculationTimesRef.current.slice(-50);
    }

    // Update metrics
    setPerformanceMetrics(prevMetrics => {
      const allTimes = calculationTimesRef.current.map(calc => calc.time);
      const totalTime = allTimes.reduce((sum, time) => sum + time, 0);
      const avgTime = totalTime / allTimes.length;
      const maxTime = Math.max(...allTimes);
      const minTime = Math.min(...allTimes);
      const slowCount = allTimes.filter(time => time > 500).length;

      return {
        averageCalculationTime: Math.round(avgTime * 100) / 100,
        maxCalculationTime: Math.round(maxTime * 100) / 100,
        minCalculationTime: minTime === Infinity ? 0 : Math.round(minTime * 100) / 100,
        totalCalculations: allTimes.length,
        slowCalculations: slowCount,
        recentCalculations: calculationTimesRef.current.slice(-10).map(calc => ({
          ...calc,
          time: Math.round(calc.time * 100) / 100
        }))
      };
    });

    // Performance warning for slow calculations
    if (calculationTime > 500 && !performanceWarningRef.current) {
      console.warn(`Slow optimization calculation detected: ${calculationTime.toFixed(2)}ms`);
      performanceWarningRef.current = true;
      
      // Reset warning flag after 5 seconds
      setTimeout(() => {
        performanceWarningRef.current = false;
      }, 5000);
    }
  }, []);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const { averageCalculationTime, maxCalculationTime, slowCalculations, totalCalculations } = performanceMetrics;
    
    let status = 'good';
    let message = 'Performance is optimal';
    
    if (averageCalculationTime > 300) {
      status = 'warning';
      message = `Average calculation time is ${averageCalculationTime.toFixed(0)}ms (target: <300ms)`;
    }
    
    if (averageCalculationTime > 500) {
      status = 'critical';
      message = `Average calculation time is ${averageCalculationTime.toFixed(0)}ms (target: <500ms)`;
    }
    
    if (slowCalculations > totalCalculations * 0.2) {
      status = 'critical';
      message = `${slowCalculations} of ${totalCalculations} calculations exceeded 500ms`;
    }

    return {
      status,
      message,
      metrics: performanceMetrics
    };
  }, [performanceMetrics]);

  // Check if calculation meets performance target
  const meetsPerformanceTarget = useCallback((calculationTime) => {
    return calculationTime <= 500; // 500ms target from requirements
  }, []);

  // Get performance recommendations
  const getPerformanceRecommendations = useCallback(() => {
    const recommendations = [];
    const { averageCalculationTime, slowCalculations, totalCalculations } = performanceMetrics;

    if (averageCalculationTime > 300) {
      recommendations.push({
        type: 'optimization',
        message: 'Consider enabling calculation caching to improve performance',
        priority: 'medium'
      });
    }

    if (averageCalculationTime > 500) {
      recommendations.push({
        type: 'critical',
        message: 'Calculation times exceed target. Consider reducing analysis scope.',
        priority: 'high'
      });
    }

    if (slowCalculations > 5) {
      recommendations.push({
        type: 'analysis',
        message: 'Multiple slow calculations detected. Check for performance bottlenecks.',
        priority: 'medium'
      });
    }

    if (totalCalculations > 30 && slowCalculations === 0) {
      recommendations.push({
        type: 'success',
        message: 'Excellent performance! All calculations under 500ms.',
        priority: 'low'
      });
    }

    return recommendations;
  }, [performanceMetrics]);

  // Reset performance metrics
  const resetMetrics = useCallback(() => {
    calculationTimesRef.current = [];
    setPerformanceMetrics({
      averageCalculationTime: 0,
      maxCalculationTime: 0,
      minCalculationTime: Infinity,
      totalCalculations: 0,
      slowCalculations: 0,
      recentCalculations: []
    });
  }, []);

  // Performance timing wrapper
  const timeCalculation = useCallback(async (calculationFunction, calculationType = 'full') => {
    const startTime = performance.now();
    
    try {
      const result = await calculationFunction();
      const endTime = performance.now();
      const calculationTime = endTime - startTime;
      
      recordCalculationTime(calculationTime, calculationType);
      
      return {
        result,
        calculationTime,
        meetsTarget: meetsPerformanceTarget(calculationTime)
      };
    } catch (error) {
      const endTime = performance.now();
      const calculationTime = endTime - startTime;
      
      recordCalculationTime(calculationTime, `${calculationType}_error`);
      
      throw error;
    }
  }, [recordCalculationTime, meetsPerformanceTarget]);

  return {
    performanceMetrics,
    recordCalculationTime,
    getPerformanceSummary,
    getPerformanceRecommendations,
    meetsPerformanceTarget,
    resetMetrics,
    timeCalculation
  };
}

export default usePerformanceMonitor;