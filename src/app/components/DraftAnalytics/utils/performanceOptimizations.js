/**
 * Performance Optimization Utilities
 * Provides debouncing, memoization helpers, and virtualization utilities
 */

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';

/**
 * Custom hook for debounced values
 * @param {any} value - Value to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {any} Debounced value
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for debounced callbacks
 * @param {Function} callback - Callback function to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @param {Array} deps - Dependencies array
 * @returns {Function} Debounced callback
 */
export function useDebouncedCallback(callback, delay, deps = []) {
  const timeoutRef = useRef(null);

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay, ...deps]);
}

/**
 * Custom hook for memoized expensive calculations
 * @param {Function} computeFn - Function that performs expensive calculation
 * @param {Array} deps - Dependencies array
 * @param {Object} options - Options for memoization
 * @returns {any} Memoized result
 */
export function useExpensiveMemo(computeFn, deps, options = {}) {
  const { 
    maxCacheSize = 10,
    ttl = 5 * 60 * 1000, // 5 minutes default TTL
    enableLogging = false 
  } = options;

  const cacheRef = useRef(new Map());
  const timestampsRef = useRef(new Map());

  return useMemo(() => {
    const cacheKey = JSON.stringify(deps);
    const now = Date.now();

    // Check if we have a valid cached result
    if (cacheRef.current.has(cacheKey)) {
      const timestamp = timestampsRef.current.get(cacheKey);
      if (timestamp && (now - timestamp) < ttl) {
        if (enableLogging) {
          console.log('Using cached result for expensive calculation');
        }
        return cacheRef.current.get(cacheKey);
      }
    }

    // Clean up expired entries
    for (const [key, timestamp] of timestampsRef.current.entries()) {
      if (now - timestamp >= ttl) {
        cacheRef.current.delete(key);
        timestampsRef.current.delete(key);
      }
    }

    // Limit cache size
    if (cacheRef.current.size >= maxCacheSize) {
      const oldestKey = cacheRef.current.keys().next().value;
      cacheRef.current.delete(oldestKey);
      timestampsRef.current.delete(oldestKey);
    }

    // Compute new result
    if (enableLogging) {
      console.time('Expensive calculation');
    }
    
    const result = computeFn();
    
    if (enableLogging) {
      console.timeEnd('Expensive calculation');
    }

    // Cache the result
    cacheRef.current.set(cacheKey, result);
    timestampsRef.current.set(cacheKey, now);

    return result;
  }, deps);
}

/**
 * Custom hook for progressive data loading
 * @param {Array} data - Full dataset to load progressively
 * @param {number} batchSize - Number of items to load per batch
 * @param {number} delay - Delay between batches in milliseconds
 * @returns {Object} Progressive loading state and controls
 */
export function useProgressiveLoading(data, batchSize = 50, delay = 100) {
  const [loadedData, setLoadedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const timeoutRef = useRef(null);

  const totalBatches = Math.ceil((data?.length || 0) / batchSize);
  const hasMore = currentBatch < totalBatches;

  const loadNextBatch = useCallback(() => {
    if (!data || !hasMore || isLoading) return;

    setIsLoading(true);
    
    timeoutRef.current = setTimeout(() => {
      const startIndex = currentBatch * batchSize;
      const endIndex = Math.min(startIndex + batchSize, data.length);
      const nextBatch = data.slice(startIndex, endIndex);

      setLoadedData(prev => [...prev, ...nextBatch]);
      setCurrentBatch(prev => prev + 1);
      setIsLoading(false);
    }, delay);
  }, [data, currentBatch, batchSize, delay, hasMore, isLoading]);

  const loadAll = useCallback(() => {
    if (!data) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setLoadedData(data);
    setCurrentBatch(totalBatches);
    setIsLoading(false);
  }, [data, totalBatches]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setLoadedData([]);
    setCurrentBatch(0);
    setIsLoading(false);
  }, []);

  // Auto-load first batch when data changes
  useEffect(() => {
    if (data && data.length > 0 && loadedData.length === 0 && currentBatch === 0) {
      loadNextBatch();
    }
  }, [data, loadedData.length, currentBatch, loadNextBatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    loadedData,
    isLoading,
    hasMore,
    currentBatch,
    totalBatches,
    progress: totalBatches > 0 ? (currentBatch / totalBatches) * 100 : 0,
    loadNextBatch,
    loadAll,
    reset
  };
}

/**
 * Custom hook for virtual scrolling
 * @param {Array} items - Array of items to virtualize
 * @param {number} itemHeight - Height of each item in pixels
 * @param {number} containerHeight - Height of the container in pixels
 * @param {number} overscan - Number of items to render outside visible area
 * @returns {Object} Virtual scrolling state and helpers
 */
export function useVirtualScrolling(items, itemHeight, containerHeight, overscan = 5) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
      top: (startIndex + index) * itemHeight
    }));
  }, [items, startIndex, endIndex, itemHeight]);

  const handleScroll = useCallback((event) => {
    setScrollTop(event.target.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    startIndex,
    endIndex,
    visibleCount
  };
}

/**
 * Custom hook for intersection observer (for lazy loading)
 * @param {Object} options - Intersection observer options
 * @returns {Array} [ref, isIntersecting]
 */
export function useIntersectionObserver(options = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [element, setElement] = useState(null);

  const observer = useMemo(() => {
    if (typeof window === 'undefined') return null;
    
    return new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options
    });
  }, [options.threshold, options.rootMargin]);

  useEffect(() => {
    if (!element || !observer) return;

    observer.observe(element);
    return () => observer.unobserve(element);
  }, [element, observer]);

  const ref = useCallback((node) => {
    setElement(node);
  }, []);

  return [ref, isIntersecting];
}

/**
 * Performance monitoring hook
 * @param {string} componentName - Name of the component for logging
 * @param {Array} deps - Dependencies to monitor
 * @returns {Object} Performance metrics
 */
export function usePerformanceMonitor(componentName, deps = []) {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderDuration: 0
  });

  useEffect(() => {
    const now = Date.now();
    const renderDuration = now - lastRenderTimeRef.current;
    renderCountRef.current += 1;

    setMetrics(prev => ({
      renderCount: renderCountRef.current,
      lastRenderDuration: renderDuration,
      averageRenderTime: prev.averageRenderTime === 0 
        ? renderDuration 
        : (prev.averageRenderTime + renderDuration) / 2
    }));

    lastRenderTimeRef.current = now;

    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} render #${renderCountRef.current} took ${renderDuration}ms`);
    }
  }, deps);

  return metrics;
}

/**
 * Batch update hook for reducing re-renders
 * @param {number} delay - Delay before applying batched updates
 * @returns {Function} Batch update function
 */
export function useBatchedUpdates(delay = 16) {
  const updatesRef = useRef([]);
  const timeoutRef = useRef(null);

  const batchUpdate = useCallback((updateFn) => {
    updatesRef.current.push(updateFn);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const updates = updatesRef.current;
      updatesRef.current = [];

      // Apply all updates in a single batch
      updates.forEach(update => update());
    }, delay);
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return batchUpdate;
}

/**
 * Memory usage monitoring hook
 * @returns {Object} Memory usage information
 */
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const updateMemoryInfo = () => {
        setMemoryInfo({
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          usagePercentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
        });
      };

      updateMemoryInfo();
      const interval = setInterval(updateMemoryInfo, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, []);

  return memoryInfo;
}

/**
 * Optimized event handler creator
 * @param {Function} handler - Event handler function
 * @param {Array} deps - Dependencies array
 * @param {Object} options - Options for optimization
 * @returns {Function} Optimized event handler
 */
export function useOptimizedEventHandler(handler, deps, options = {}) {
  const { 
    throttle = false, 
    debounce = false, 
    delay = 100,
    preventDefault = false,
    stopPropagation = false 
  } = options;

  const timeoutRef = useRef(null);
  const lastCallRef = useRef(0);

  return useCallback((event) => {
    if (preventDefault) event.preventDefault();
    if (stopPropagation) event.stopPropagation();

    const now = Date.now();

    if (throttle) {
      if (now - lastCallRef.current < delay) return;
      lastCallRef.current = now;
      handler(event);
    } else if (debounce) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => handler(event), delay);
    } else {
      handler(event);
    }
  }, [handler, throttle, debounce, delay, preventDefault, stopPropagation, ...deps]);
}

/**
 * Enhanced virtualization hook with improved performance
 * @param {Array} items - Array of items to virtualize
 * @param {number} itemHeight - Height of each item in pixels
 * @param {number} containerHeight - Height of the container in pixels
 * @param {Object} options - Additional options
 * @returns {Object} Enhanced virtual scrolling state and helpers
 */
export function useEnhancedVirtualization(items, itemHeight, containerHeight, options = {}) {
  const {
    overscan = 5,
    enableSmoothScrolling = true,
    bufferSize = 10,
    scrollThrottleDelay = 16
  } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

  // Enhanced visible items with buffer
  const visibleItems = useMemo(() => {
    const bufferStart = Math.max(0, startIndex - bufferSize);
    const bufferEnd = Math.min(items.length, endIndex + bufferSize);
    
    return items.slice(bufferStart, bufferEnd).map((item, index) => ({
      item,
      index: bufferStart + index,
      top: (bufferStart + index) * itemHeight,
      isVisible: (bufferStart + index) >= startIndex && (bufferStart + index) < endIndex
    }));
  }, [items, startIndex, endIndex, itemHeight, bufferSize]);

  // Throttled scroll handler
  const handleScroll = useCallback((event) => {
    const newScrollTop = event.target.scrollTop;
    setScrollTop(newScrollTop);
    setIsScrolling(true);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set scrolling to false after delay
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  // Throttled scroll handler for better performance
  const throttledHandleScroll = useCallback(
    throttle(handleScroll, scrollThrottleDelay),
    [handleScroll, scrollThrottleDelay]
  );

  // Scroll to item function
  const scrollToItem = useCallback((index, alignment = 'auto') => {
    if (!containerRef.current) return;

    const itemTop = index * itemHeight;
    const containerScrollTop = containerRef.current.scrollTop;
    const containerBottom = containerScrollTop + containerHeight;

    let targetScrollTop = containerScrollTop;

    if (alignment === 'start' || (alignment === 'auto' && itemTop < containerScrollTop)) {
      targetScrollTop = itemTop;
    } else if (alignment === 'end' || (alignment === 'auto' && itemTop + itemHeight > containerBottom)) {
      targetScrollTop = itemTop + itemHeight - containerHeight;
    } else if (alignment === 'center') {
      targetScrollTop = itemTop - (containerHeight - itemHeight) / 2;
    }

    if (enableSmoothScrolling) {
      containerRef.current.scrollTo({
        top: Math.max(0, Math.min(targetScrollTop, totalHeight - containerHeight)),
        behavior: 'smooth'
      });
    } else {
      containerRef.current.scrollTop = Math.max(0, Math.min(targetScrollTop, totalHeight - containerHeight));
    }
  }, [itemHeight, containerHeight, totalHeight, enableSmoothScrolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll: throttledHandleScroll,
    startIndex,
    endIndex,
    visibleCount,
    isScrolling,
    scrollToItem,
    containerRef
  };
}

/**
 * Throttle function utility
 * @param {Function} func - Function to throttle
 * @param {number} delay - Throttle delay in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, delay) {
  let timeoutId;
  let lastExecTime = 0;
  
  return function (...args) {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
}

/**
 * Enhanced memoization hook with LRU cache
 * @param {Function} computeFn - Function that performs expensive calculation
 * @param {Array} deps - Dependencies array
 * @param {Object} options - Options for memoization
 * @returns {any} Memoized result
 */
export function useEnhancedMemo(computeFn, deps, options = {}) {
  const { 
    maxCacheSize = 20,
    ttl = 10 * 60 * 1000, // 10 minutes default TTL
    enableLogging = false,
    enableProfiling = false
  } = options;

  const cacheRef = useRef(new Map());
  const timestampsRef = useRef(new Map());
  const accessOrderRef = useRef([]);

  return useMemo(() => {
    const cacheKey = JSON.stringify(deps);
    const now = Date.now();

    // Check if we have a valid cached result
    if (cacheRef.current.has(cacheKey)) {
      const timestamp = timestampsRef.current.get(cacheKey);
      if (timestamp && (now - timestamp) < ttl) {
        // Update access order for LRU
        const index = accessOrderRef.current.indexOf(cacheKey);
        if (index > -1) {
          accessOrderRef.current.splice(index, 1);
        }
        accessOrderRef.current.push(cacheKey);

        if (enableLogging) {
          console.log('Using cached result for enhanced memo calculation');
        }
        return cacheRef.current.get(cacheKey);
      }
    }

    // Clean up expired entries
    for (const [key, timestamp] of timestampsRef.current.entries()) {
      if (now - timestamp >= ttl) {
        cacheRef.current.delete(key);
        timestampsRef.current.delete(key);
        const index = accessOrderRef.current.indexOf(key);
        if (index > -1) {
          accessOrderRef.current.splice(index, 1);
        }
      }
    }

    // Implement LRU eviction if cache is full
    if (cacheRef.current.size >= maxCacheSize) {
      const lruKey = accessOrderRef.current.shift();
      if (lruKey) {
        cacheRef.current.delete(lruKey);
        timestampsRef.current.delete(lruKey);
      }
    }

    // Compute new result with optional profiling
    let result;
    if (enableProfiling) {
      const startTime = performance.now();
      result = computeFn();
      const endTime = performance.now();
      console.log(`Enhanced memo calculation took ${endTime - startTime} milliseconds`);
    } else {
      if (enableLogging) {
        console.time('Enhanced memo calculation');
      }
      result = computeFn();
      if (enableLogging) {
        console.timeEnd('Enhanced memo calculation');
      }
    }

    // Cache the result
    cacheRef.current.set(cacheKey, result);
    timestampsRef.current.set(cacheKey, now);
    accessOrderRef.current.push(cacheKey);

    return result;
  }, deps);
}

/**
 * Advanced debouncing hook with immediate execution option
 * @param {Function} callback - Callback function to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @param {Object} options - Options for debouncing
 * @returns {Function} Advanced debounced callback
 */
export function useAdvancedDebounce(callback, delay, options = {}) {
  const {
    immediate = false,
    maxWait = null,
    leading = false,
    trailing = true
  } = options;

  const timeoutRef = useRef(null);
  const maxTimeoutRef = useRef(null);
  const lastCallTimeRef = useRef(0);
  const lastInvokeTimeRef = useRef(0);

  return useCallback((...args) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;
    const timeSinceLastInvoke = now - lastInvokeTimeRef.current;

    lastCallTimeRef.current = now;

    const invokeCallback = () => {
      lastInvokeTimeRef.current = Date.now();
      callback(...args);
    };

    const shouldInvokeLeading = leading && timeSinceLastInvoke >= delay;
    const shouldInvokeMaxWait = maxWait && timeSinceLastInvoke >= maxWait;

    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
    }

    // Immediate execution on first call
    if (immediate && timeSinceLastCall === 0) {
      invokeCallback();
      return;
    }

    // Leading edge execution
    if (shouldInvokeLeading) {
      invokeCallback();
    }

    // Max wait execution
    if (shouldInvokeMaxWait) {
      invokeCallback();
      return;
    }

    // Set up max wait timeout
    if (maxWait && !maxTimeoutRef.current) {
      maxTimeoutRef.current = setTimeout(() => {
        invokeCallback();
        maxTimeoutRef.current = null;
      }, maxWait - timeSinceLastInvoke);
    }

    // Trailing edge execution
    if (trailing) {
      timeoutRef.current = setTimeout(() => {
        if (!leading || timeSinceLastCall >= delay) {
          invokeCallback();
        }
      }, delay);
    }
  }, [callback, delay, immediate, maxWait, leading, trailing]);
}

/**
 * Resource pooling hook for expensive object creation
 * @param {Function} createResource - Function to create new resource
 * @param {Function} resetResource - Function to reset resource for reuse
 * @param {Object} options - Pooling options
 * @returns {Object} Resource pool interface
 */
export function useResourcePool(createResource, resetResource, options = {}) {
  const {
    maxPoolSize = 10,
    initialPoolSize = 3,
    enableLogging = false
  } = options;

  const poolRef = useRef([]);
  const activeResourcesRef = useRef(new Set());

  // Initialize pool
  useEffect(() => {
    if (poolRef.current.length === 0) {
      for (let i = 0; i < initialPoolSize; i++) {
        poolRef.current.push(createResource());
      }
      if (enableLogging) {
        console.log(`Initialized resource pool with ${initialPoolSize} resources`);
      }
    }
  }, [createResource, initialPoolSize, enableLogging]);

  const acquireResource = useCallback(() => {
    let resource;
    
    if (poolRef.current.length > 0) {
      resource = poolRef.current.pop();
      if (enableLogging) {
        console.log(`Acquired resource from pool (${poolRef.current.length} remaining)`);
      }
    } else {
      resource = createResource();
      if (enableLogging) {
        console.log('Created new resource (pool empty)');
      }
    }

    activeResourcesRef.current.add(resource);
    return resource;
  }, [createResource, enableLogging]);

  const releaseResource = useCallback((resource) => {
    if (!activeResourcesRef.current.has(resource)) {
      if (enableLogging) {
        console.warn('Attempted to release resource not acquired from pool');
      }
      return;
    }

    activeResourcesRef.current.delete(resource);

    if (poolRef.current.length < maxPoolSize) {
      if (resetResource) {
        resetResource(resource);
      }
      poolRef.current.push(resource);
      if (enableLogging) {
        console.log(`Released resource to pool (${poolRef.current.length} available)`);
      }
    } else {
      if (enableLogging) {
        console.log('Discarded resource (pool full)');
      }
    }
  }, [resetResource, maxPoolSize, enableLogging]);

  const getPoolStats = useCallback(() => ({
    available: poolRef.current.length,
    active: activeResourcesRef.current.size,
    total: poolRef.current.length + activeResourcesRef.current.size
  }), []);

  return {
    acquireResource,
    releaseResource,
    getPoolStats
  };
}

/**
 * Frame-based animation hook for smooth updates
 * @param {Function} callback - Animation callback
 * @param {Array} deps - Dependencies array
 * @returns {Object} Animation controls
 */
export function useAnimationFrame(callback, deps = []) {
  const requestRef = useRef();
  const previousTimeRef = useRef();
  const isRunningRef = useRef(false);

  const animate = useCallback((time) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime, time);
    }
    previousTimeRef.current = time;
    
    if (isRunningRef.current) {
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [callback]);

  const start = useCallback(() => {
    if (!isRunningRef.current) {
      isRunningRef.current = true;
      previousTimeRef.current = undefined;
      requestRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { start, stop, isRunning: isRunningRef.current };
}

/**
 * Optimized state batching hook
 * @param {Object} initialState - Initial state object
 * @param {number} batchDelay - Delay for batching updates
 * @returns {Array} [state, batchedSetState]
 */
export function useBatchedState(initialState, batchDelay = 16) {
  const [state, setState] = useState(initialState);
  const pendingUpdatesRef = useRef([]);
  const timeoutRef = useRef(null);

  const batchedSetState = useCallback((updater) => {
    pendingUpdatesRef.current.push(updater);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const updates = pendingUpdatesRef.current;
      pendingUpdatesRef.current = [];

      setState(prevState => {
        return updates.reduce((currentState, update) => {
          return typeof update === 'function' ? update(currentState) : { ...currentState, ...update };
        }, prevState);
      });
    }, batchDelay);
  }, [batchDelay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, batchedSetState];
}

/**
 * Lazy loading hook for components
 * @param {Function} importFn - Dynamic import function
 * @param {Object} options - Options for lazy loading
 * @returns {Object} Lazy loading state and component
 */
export function useLazyComponent(importFn, options = {}) {
  const { 
    fallback = null, 
    retryCount = 3, 
    retryDelay = 1000 
  } = options;

  const [component, setComponent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retries, setRetries] = useState(0);

  const loadComponent = useCallback(async () => {
    if (component || loading) return;

    setLoading(true);
    setError(null);

    try {
      const loadedComponent = await importFn();
      setComponent(loadedComponent.default || loadedComponent);
    } catch (err) {
      console.error('Error loading lazy component:', err);
      
      if (retries < retryCount) {
        setTimeout(() => {
          setRetries(prev => prev + 1);
          setLoading(false);
        }, retryDelay);
      } else {
        setError(err);
      }
    } finally {
      if (retries >= retryCount) {
        setLoading(false);
      }
    }
  }, [importFn, component, loading, retries, retryCount, retryDelay]);

  useEffect(() => {
    if (retries > 0 && retries <= retryCount) {
      loadComponent();
    }
  }, [retries, loadComponent, retryCount]);

  return {
    component,
    loading,
    error,
    loadComponent,
    LazyComponent: component || fallback
  };
}

/**
 * Enhanced progressive loading with chunked processing
 * @param {Array} data - Full dataset to load progressively
 * @param {number} chunkSize - Number of items to process per chunk
 * @param {number} delay - Delay between chunks in milliseconds
 * @param {Object} options - Additional options
 * @returns {Object} Progressive loading state and controls
 */
export function useChunkedProgressiveLoading(data, chunkSize = 100, delay = 50, options = {}) {
  const {
    enablePrioritization = false,
    priorityFn = null,
    maxConcurrentChunks = 3,
    enableCaching = true
  } = options;

  const [loadedData, setLoadedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [processingQueue, setProcessingQueue] = useState([]);
  const [error, setError] = useState(null);
  
  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);
  const activeChunksRef = useRef(0);

  const totalChunks = Math.ceil((data?.length || 0) / chunkSize);
  const hasMore = currentChunk < totalChunks;
  const progress = totalChunks > 0 ? (currentChunk / totalChunks) * 100 : 0;

  // Process a single chunk with optional prioritization
  const processChunk = useCallback(async (chunkIndex, chunkData) => {
    if (abortControllerRef.current?.signal.aborted) return null;

    try {
      activeChunksRef.current += 1;
      
      // Apply prioritization if enabled
      let processedChunk = chunkData;
      if (enablePrioritization && priorityFn) {
        processedChunk = chunkData.sort(priorityFn);
      }

      // Simulate processing delay for large chunks
      if (processedChunk.length > 50) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return {
        chunkIndex,
        data: processedChunk,
        timestamp: Date.now()
      };
    } catch (err) {
      console.error(`Error processing chunk ${chunkIndex}:`, err);
      throw err;
    } finally {
      activeChunksRef.current -= 1;
    }
  }, [enablePrioritization, priorityFn, delay]);

  // Load next batch of chunks
  const loadNextBatch = useCallback(async () => {
    if (!data || !hasMore || isLoading || activeChunksRef.current >= maxConcurrentChunks) return;

    setIsLoading(true);
    setError(null);

    try {
      const chunksToProcess = Math.min(maxConcurrentChunks, totalChunks - currentChunk);
      const chunkPromises = [];

      for (let i = 0; i < chunksToProcess; i++) {
        const chunkIndex = currentChunk + i;
        const startIndex = chunkIndex * chunkSize;
        const endIndex = Math.min(startIndex + chunkSize, data.length);
        const chunkData = data.slice(startIndex, endIndex);

        // Check cache first if enabled
        const cacheKey = `chunk_${chunkIndex}`;
        if (enableCaching && cacheRef.current.has(cacheKey)) {
          const cachedChunk = cacheRef.current.get(cacheKey);
          setLoadedData(prev => [...prev, ...cachedChunk.data]);
          continue;
        }

        chunkPromises.push(processChunk(chunkIndex, chunkData));
      }

      const processedChunks = await Promise.all(chunkPromises);
      
      processedChunks.forEach(chunk => {
        if (chunk) {
          // Cache the processed chunk
          if (enableCaching) {
            cacheRef.current.set(`chunk_${chunk.chunkIndex}`, chunk);
          }
          
          setLoadedData(prev => [...prev, ...chunk.data]);
        }
      });

      setCurrentChunk(prev => prev + chunksToProcess);
    } catch (err) {
      console.error('Error in chunked progressive loading:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [data, hasMore, isLoading, currentChunk, chunkSize, totalChunks, maxConcurrentChunks, processChunk, enableCaching]);

  // Load all remaining data at once
  const loadAll = useCallback(async () => {
    if (!data || !hasMore) return;

    // Cancel any ongoing operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const remainingData = data.slice(currentChunk * chunkSize);
      
      if (enablePrioritization && priorityFn) {
        remainingData.sort(priorityFn);
      }

      setLoadedData(prev => [...prev, ...remainingData]);
      setCurrentChunk(totalChunks);
    } catch (err) {
      console.error('Error loading all data:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [data, hasMore, currentChunk, chunkSize, totalChunks, enablePrioritization, priorityFn]);

  // Reset loading state
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setLoadedData([]);
    setCurrentChunk(0);
    setIsLoading(false);
    setError(null);
    setProcessingQueue([]);
    cacheRef.current.clear();
    activeChunksRef.current = 0;
  }, []);

  // Auto-load first batch when data changes
  useEffect(() => {
    if (data && data.length > 0 && loadedData.length === 0 && currentChunk === 0) {
      loadNextBatch();
    }
  }, [data, loadedData.length, currentChunk, loadNextBatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    loadedData,
    isLoading,
    hasMore,
    currentChunk,
    totalChunks,
    progress,
    error,
    activeChunks: activeChunksRef.current,
    loadNextBatch,
    loadAll,
    reset,
    cacheSize: cacheRef.current.size
  };
}

/**
 * Smart re-render optimization hook
 * @param {Function} component - Component render function
 * @param {Array} deps - Dependencies to watch
 * @param {Object} options - Optimization options
 * @returns {Function} Optimized render function
 */
export function useSmartRender(component, deps, options = {}) {
  const {
    maxRenderRate = 60, // Max renders per second
    enableBatching = true,
    batchDelay = 16, // ~60fps
    enableProfiling = process.env.NODE_ENV === 'development'
  } = options;

  const lastRenderRef = useRef(0);
  const pendingRenderRef = useRef(null);
  const renderCountRef = useRef(0);
  const [forceUpdate, setForceUpdate] = useState(0);

  const minRenderInterval = 1000 / maxRenderRate;

  const scheduleRender = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderRef.current;

    if (timeSinceLastRender >= minRenderInterval) {
      // Render immediately
      lastRenderRef.current = now;
      renderCountRef.current += 1;
      
      if (enableProfiling) {
        console.log(`Smart render #${renderCountRef.current} executed immediately`);
      }
      
      setForceUpdate(prev => prev + 1);
    } else if (enableBatching) {
      // Schedule batched render
      if (pendingRenderRef.current) {
        clearTimeout(pendingRenderRef.current);
      }
      
      const delay = Math.max(batchDelay, minRenderInterval - timeSinceLastRender);
      pendingRenderRef.current = setTimeout(() => {
        lastRenderRef.current = Date.now();
        renderCountRef.current += 1;
        
        if (enableProfiling) {
          console.log(`Smart render #${renderCountRef.current} executed after ${delay}ms delay`);
        }
        
        setForceUpdate(prev => prev + 1);
        pendingRenderRef.current = null;
      }, delay);
    }
  }, [minRenderInterval, enableBatching, batchDelay, enableProfiling]);

  // Watch dependencies and schedule renders
  useEffect(() => {
    scheduleRender();
  }, deps);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingRenderRef.current) {
        clearTimeout(pendingRenderRef.current);
      }
    };
  }, []);

  // Return memoized component
  return useMemo(() => {
    return component();
  }, [component, forceUpdate]);
}

/**
 * Advanced data transformation hook with caching and optimization
 * @param {any} data - Data to transform
 * @param {Function} transformFn - Transformation function
 * @param {Array} deps - Dependencies
 * @param {Object} options - Transformation options
 * @returns {any} Transformed data
 */
export function useOptimizedTransform(data, transformFn, deps, options = {}) {
  const {
    enableCaching = true,
    cacheSize = 50,
    enableProfiling = process.env.NODE_ENV === 'development',
    enableWorker = false,
    workerScript = null,
    chunkSize = 1000
  } = options;

  const cacheRef = useRef(new Map());
  const workerRef = useRef(null);
  const [result, setResult] = useState(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [error, setError] = useState(null);

  // Initialize web worker if enabled
  useEffect(() => {
    if (enableWorker && workerScript && typeof Worker !== 'undefined') {
      try {
        workerRef.current = new Worker(workerScript);
        workerRef.current.onmessage = (event) => {
          const { type, result, error } = event.data;
          if (type === 'transform-complete') {
            setResult(result);
            setIsTransforming(false);
          } else if (type === 'transform-error') {
            setError(new Error(error));
            setIsTransforming(false);
          }
        };
      } catch (err) {
        console.warn('Failed to initialize web worker:', err);
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [enableWorker, workerScript]);

  return useMemo(() => {
    const cacheKey = JSON.stringify({ data: data?.length || data, deps });
    
    // Check cache first
    if (enableCaching && cacheRef.current.has(cacheKey)) {
      if (enableProfiling) {
        console.log('Using cached transformation result');
      }
      return cacheRef.current.get(cacheKey);
    }

    // Perform transformation
    let transformedResult;
    
    if (enableProfiling) {
      console.time('Data transformation');
    }

    try {
      if (enableWorker && workerRef.current && Array.isArray(data) && data.length > chunkSize) {
        // Use web worker for large datasets
        setIsTransforming(true);
        setError(null);
        workerRef.current.postMessage({
          type: 'transform',
          data,
          transformFn: transformFn.toString(),
          chunkSize
        });
        return result; // Return previous result while processing
      } else {
        // Synchronous transformation
        transformedResult = transformFn(data);
      }
    } catch (err) {
      console.error('Error in data transformation:', err);
      setError(err);
      return data; // Return original data on error
    }

    if (enableProfiling) {
      console.timeEnd('Data transformation');
    }

    // Cache the result
    if (enableCaching && transformedResult !== undefined) {
      // Implement LRU cache
      if (cacheRef.current.size >= cacheSize) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }
      cacheRef.current.set(cacheKey, transformedResult);
    }

    return transformedResult;
  }, [data, transformFn, deps, enableCaching, cacheSize, enableProfiling, enableWorker, chunkSize, result]);
}