/**
 * Performance Monitor Component
 * Provides real-time performance monitoring and optimization suggestions
 */

"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMemoryMonitor, usePerformanceMonitor } from './performanceOptimizations.js';

export function PerformanceMonitor({ 
  componentName = 'Component',
  enabled = process.env.NODE_ENV === 'development',
  showUI = false,
  thresholds = {
    renderTime: 16, // 16ms for 60fps
    memoryUsage: 80, // 80% memory usage
    rerenderCount: 10 // 10 re-renders per second
  }
}) {
  const [isVisible, setIsVisible] = useState(showUI);
  const [alerts, setAlerts] = useState([]);
  const [performanceHistory, setPerformanceHistory] = useState([]);
  
  const memoryInfo = useMemoryMonitor();
  const performanceMetrics = usePerformanceMonitor(componentName, []);
  
  const alertTimeoutRef = useRef(new Map());
  const historyRef = useRef([]);

  // Add performance data to history
  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    const entry = {
      timestamp: now,
      renderTime: performanceMetrics.lastRenderDuration,
      renderCount: performanceMetrics.renderCount,
      memoryUsage: memoryInfo?.usagePercentage || 0
    };

    historyRef.current.push(entry);
    
    // Keep only last 100 entries
    if (historyRef.current.length > 100) {
      historyRef.current = historyRef.current.slice(-100);
    }

    setPerformanceHistory([...historyRef.current]);
  }, [performanceMetrics, memoryInfo, enabled]);

  // Check for performance issues
  useEffect(() => {
    if (!enabled) return;

    const checkPerformance = () => {
      const newAlerts = [];

      // Check render time
      if (performanceMetrics.lastRenderDuration > thresholds.renderTime) {
        newAlerts.push({
          id: 'render-time',
          type: 'warning',
          message: `Slow render detected: ${performanceMetrics.lastRenderDuration}ms (target: ${thresholds.renderTime}ms)`,
          suggestion: 'Consider using React.memo, useMemo, or useCallback to optimize re-renders'
        });
      }

      // Check memory usage
      if (memoryInfo && memoryInfo.usagePercentage > thresholds.memoryUsage) {
        newAlerts.push({
          id: 'memory-usage',
          type: 'error',
          message: `High memory usage: ${memoryInfo.usagePercentage.toFixed(1)}%`,
          suggestion: 'Check for memory leaks, clear unused references, or implement data virtualization'
        });
      }

      // Check re-render frequency
      const recentHistory = historyRef.current.slice(-10);
      if (recentHistory.length >= 10) {
        const timeSpan = recentHistory[recentHistory.length - 1].timestamp - recentHistory[0].timestamp;
        const rerenderRate = (recentHistory.length / timeSpan) * 1000; // per second
        
        if (rerenderRate > thresholds.rerenderCount) {
          newAlerts.push({
            id: 'rerender-rate',
            type: 'warning',
            message: `High re-render rate: ${rerenderRate.toFixed(1)}/sec`,
            suggestion: 'Use debouncing, throttling, or optimize state updates to reduce re-renders'
          });
        }
      }

      // Update alerts with auto-dismiss
      newAlerts.forEach(alert => {
        // Clear existing timeout for this alert type
        if (alertTimeoutRef.current.has(alert.id)) {
          clearTimeout(alertTimeoutRef.current.get(alert.id));
        }

        // Set new timeout to dismiss alert
        const timeoutId = setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== alert.id));
          alertTimeoutRef.current.delete(alert.id);
        }, 5000);

        alertTimeoutRef.current.set(alert.id, timeoutId);
      });

      setAlerts(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const uniqueNewAlerts = newAlerts.filter(a => !existingIds.has(a.id));
        return [...prev, ...uniqueNewAlerts];
      });
    };

    const interval = setInterval(checkPerformance, 1000);
    return () => {
      clearInterval(interval);
      alertTimeoutRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    };
  }, [performanceMetrics, memoryInfo, thresholds, enabled]);

  const dismissAlert = useCallback((alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    if (alertTimeoutRef.current.has(alertId)) {
      clearTimeout(alertTimeoutRef.current.get(alertId));
      alertTimeoutRef.current.delete(alertId);
    }
  }, []);

  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* Performance Monitor Toggle Button */}
      <button
        onClick={toggleVisibility}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Toggle Performance Monitor"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>

      {/* Performance Alerts */}
      {alerts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg shadow-lg border-l-4 ${
                alert.type === 'error' 
                  ? 'bg-red-50 border-red-400 text-red-800' 
                  : 'bg-yellow-50 border-yellow-400 text-yellow-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs mt-1 opacity-80">{alert.suggestion}</p>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Performance Monitor Panel */}
      {isVisible && (
        <div className="fixed bottom-16 right-4 z-50  border border-gray-200 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Performance Monitor</h3>
            <button
              onClick={toggleVisibility}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Current Metrics */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Component:</span>
              <span className="font-medium">{componentName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Renders:</span>
              <span className="font-medium">{performanceMetrics.renderCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Last Render:</span>
              <span className={`font-medium ${
                performanceMetrics.lastRenderDuration > thresholds.renderTime ? 'text-red-600' : 'text-green-600'
              }`}>
                {performanceMetrics.lastRenderDuration}ms
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Avg Render:</span>
              <span className="font-medium">{performanceMetrics.averageRenderTime.toFixed(1)}ms</span>
            </div>
            {memoryInfo && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Memory:</span>
                <span className={`font-medium ${
                  memoryInfo.usagePercentage > thresholds.memoryUsage ? 'text-red-600' : 'text-green-600'
                }`}>
                  {memoryInfo.usagePercentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Performance History Chart */}
          {performanceHistory.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-gray-200 mb-2">Render Time History</h4>
              <div className="h-16 bg-gray-50 rounded relative overflow-hidden">
                <svg className="w-full h-full">
                  {performanceHistory.map((entry, index) => {
                    const x = (index / (performanceHistory.length - 1)) * 100;
                    const y = 100 - (entry.renderTime / (thresholds.renderTime * 2)) * 100;
                    const color = entry.renderTime > thresholds.renderTime ? '#ef4444' : '#10b981';
                    
                    return (
                      <circle
                        key={index}
                        cx={`${x}%`}
                        cy={`${Math.max(5, Math.min(95, y))}%`}
                        r="1"
                        fill={color}
                      />
                    );
                  })}
                  {/* Threshold line */}
                  <line
                    x1="0%"
                    y1={`${100 - (thresholds.renderTime / (thresholds.renderTime * 2)) * 100}%`}
                    x2="100%"
                    y2={`${100 - (thresholds.renderTime / (thresholds.renderTime * 2)) * 100}%`}
                    stroke="#f59e0b"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                </svg>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0ms</span>
                <span className="text-yellow-600">{thresholds.renderTime}ms target</span>
                <span>{thresholds.renderTime * 2}ms</span>
              </div>
            </div>
          )}

          {/* Optimization Suggestions */}
          <div>
            <h4 className="text-xs font-medium text-gray-200 mb-2">Optimization Tips</h4>
            <div className="space-y-1 text-xs text-gray-600">
              <div>• Use React.memo for expensive components</div>
              <div>• Implement useMemo for heavy calculations</div>
              <div>• Use useCallback for event handlers</div>
              <div>• Consider virtualization for large lists</div>
              <div>• Debounce frequent state updates</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Performance profiler hook for measuring component performance
 * @param {string} componentName - Name of the component
 * @param {Object} options - Profiling options
 * @returns {Object} Profiling utilities
 */
export function usePerformanceProfiler(componentName, options = {}) {
  const {
    enableProfiling = process.env.NODE_ENV === 'development',
    sampleRate = 1.0, // Sample 100% of renders by default
    enableMemoryTracking = true
  } = options;

  const profileDataRef = useRef([]);
  const startTimeRef = useRef(null);
  const memoryStartRef = useRef(null);

  const startProfiling = useCallback((label = 'render') => {
    if (!enableProfiling || Math.random() > sampleRate) return;

    startTimeRef.current = performance.now();
    
    if (enableMemoryTracking && 'memory' in performance) {
      memoryStartRef.current = performance.memory.usedJSHeapSize;
    }

    if (typeof performance.mark === 'function') {
      performance.mark(`${componentName}-${label}-start`);
    }
  }, [componentName, enableProfiling, sampleRate, enableMemoryTracking]);

  const endProfiling = useCallback((label = 'render', metadata = {}) => {
    if (!enableProfiling || !startTimeRef.current) return;

    const endTime = performance.now();
    const duration = endTime - startTimeRef.current;
    
    let memoryDelta = 0;
    if (enableMemoryTracking && memoryStartRef.current && 'memory' in performance) {
      memoryDelta = performance.memory.usedJSHeapSize - memoryStartRef.current;
    }

    const profileEntry = {
      component: componentName,
      label,
      duration,
      memoryDelta,
      timestamp: endTime,
      metadata
    };

    profileDataRef.current.push(profileEntry);

    // Keep only last 1000 entries
    if (profileDataRef.current.length > 1000) {
      profileDataRef.current = profileDataRef.current.slice(-1000);
    }

    if (typeof performance.mark === 'function' && typeof performance.measure === 'function') {
      performance.mark(`${componentName}-${label}-end`);
      performance.measure(
        `${componentName}-${label}`,
        `${componentName}-${label}-start`,
        `${componentName}-${label}-end`
      );
    }

    // Log slow operations
    if (duration > 16) { // Slower than 60fps
      console.warn(`Slow ${label} in ${componentName}: ${duration.toFixed(2)}ms`, metadata);
    }

    startTimeRef.current = null;
    memoryStartRef.current = null;
  }, [componentName, enableProfiling, enableMemoryTracking]);

  const getProfileData = useCallback(() => {
    return [...profileDataRef.current];
  }, []);

  const clearProfileData = useCallback(() => {
    profileDataRef.current = [];
  }, []);

  const getAveragePerformance = useCallback((label = 'render') => {
    const entries = profileDataRef.current.filter(entry => entry.label === label);
    if (entries.length === 0) return null;

    const totalDuration = entries.reduce((sum, entry) => sum + entry.duration, 0);
    const totalMemory = entries.reduce((sum, entry) => sum + entry.memoryDelta, 0);

    return {
      averageDuration: totalDuration / entries.length,
      averageMemoryDelta: totalMemory / entries.length,
      sampleCount: entries.length,
      minDuration: Math.min(...entries.map(e => e.duration)),
      maxDuration: Math.max(...entries.map(e => e.duration))
    };
  }, []);

  return {
    startProfiling,
    endProfiling,
    getProfileData,
    clearProfileData,
    getAveragePerformance
  };
}