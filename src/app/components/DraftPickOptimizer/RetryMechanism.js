/**
 * RetryMechanism - Provides retry logic for failed optimization calculations
 * Implements exponential backoff, circuit breaker pattern, and graceful degradation
 */

/**
 * Retry configuration options
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (error) => {
    // Retry on network errors, timeouts, and temporary failures
    return (
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError' ||
      error.message?.includes('timeout') ||
      error.message?.includes('network') ||
      error.message?.includes('fetch') ||
      error.status >= 500 // Server errors
    );
  }
};

/**
 * Circuit breaker states
 */
const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',     // Normal operation
  OPEN: 'OPEN',         // Failing, reject requests
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Circuit breaker for optimization calculations
 */
class OptimizationCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 30000; // 30 seconds
    this.monitoringPeriod = options.monitoringPeriod || 60000; // 1 minute
    
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.successCount = 0;
    
    // Reset failure count periodically
    this.resetInterval = setInterval(() => {
      if (this.state === CIRCUIT_STATES.CLOSED && this.failureCount > 0) {
        this.failureCount = Math.max(0, this.failureCount - 1);
      }
    }, this.monitoringPeriod);
  }

  async execute(operation, fallback = null) {
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        // Circuit is open, use fallback
        if (fallback) {
          console.warn('Circuit breaker OPEN - using fallback');
          return await fallback();
        }
        throw new Error('Circuit breaker is OPEN - operation rejected');
      } else {
        // Try to recover
        this.state = CIRCUIT_STATES.HALF_OPEN;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      
      // If circuit is now open and we have a fallback, use it
      if (this.state === CIRCUIT_STATES.OPEN && fallback) {
        console.warn('Circuit breaker opened - using fallback after failure');
        return await fallback();
      }
      
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.state = CIRCUIT_STATES.CLOSED;
      console.log('Circuit breaker recovered - state: CLOSED');
    }
  }

  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      // Failed during recovery attempt
      this.state = CIRCUIT_STATES.OPEN;
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
      console.warn('Circuit breaker recovery failed - state: OPEN');
    } else if (this.failureCount >= this.failureThreshold) {
      // Too many failures, open the circuit
      this.state = CIRCUIT_STATES.OPEN;
      this.nextAttemptTime = Date.now() + this.recoveryTimeout;
      console.warn(`Circuit breaker opened after ${this.failureCount} failures - state: OPEN`);
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  reset() {
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  destroy() {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
    }
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff(operation, config = {}) {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError;
  
  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error;
      
      // Don't retry if this is the last attempt or if retry condition fails
      if (attempt === finalConfig.maxRetries || !finalConfig.retryCondition(error)) {
        break;
      }
      
      // Calculate delay with exponential backoff
      let delay = Math.min(
        finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
        finalConfig.maxDelay
      );
      
      // Add jitter to prevent thundering herd
      if (finalConfig.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }
      
      console.warn(`Optimization attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Create a retry-enabled optimization function
 */
export function createRetryableOptimization(optimizationFunction, fallbackFunction, options = {}) {
  const circuitBreaker = new OptimizationCircuitBreaker(options.circuitBreaker);
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retry };
  
  return {
    async execute(context) {
      const operation = () => retryWithBackoff(
        () => optimizationFunction(context),
        retryConfig
      );
      
      const fallback = fallbackFunction ? () => fallbackFunction(context) : null;
      
      try {
        return await circuitBreaker.execute(operation, fallback);
      } catch (error) {
        console.error('All retry attempts failed for optimization:', error);
        
        // If we have a fallback and haven't used it yet, try it now
        if (fallbackFunction) {
          console.warn('Using fallback after all retries failed');
          return await fallbackFunction(context);
        }
        
        throw error;
      }
    },
    
    getCircuitBreakerState() {
      return circuitBreaker.getState();
    },
    
    resetCircuitBreaker() {
      circuitBreaker.reset();
    },
    
    destroy() {
      circuitBreaker.destroy();
    }
  };
}

/**
 * Timeout wrapper for operations
 */
export function withTimeout(operation, timeoutMs = 5000) {
  return Promise.race([
    operation(),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

/**
 * Safe execution wrapper that catches and logs errors
 */
export async function safeExecute(operation, fallback = null, context = 'operation') {
  try {
    return await operation();
  } catch (error) {
    console.error(`Safe execution failed for ${context}:`, error);
    
    if (fallback) {
      try {
        console.warn(`Using fallback for ${context}`);
        return await fallback();
      } catch (fallbackError) {
        console.error(`Fallback also failed for ${context}:`, fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

/**
 * Batch retry for multiple operations
 */
export async function retryBatch(operations, config = {}) {
  const results = [];
  const errors = [];
  
  for (let i = 0; i < operations.length; i++) {
    try {
      const result = await retryWithBackoff(operations[i], config);
      results.push({ index: i, result, success: true });
    } catch (error) {
      errors.push({ index: i, error, success: false });
      results.push({ index: i, error, success: false });
    }
  }
  
  return {
    results,
    errors,
    successCount: results.filter(r => r.success).length,
    errorCount: errors.length
  };
}

/**
 * Create a debounced retry function
 */
export function createDebouncedRetry(operation, debounceMs = 300, retryConfig = {}) {
  let timeoutId = null;
  let lastPromise = null;
  
  return function debouncedRetry(...args) {
    // Cancel previous timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Return existing promise if still pending
    if (lastPromise) {
      return lastPromise;
    }
    
    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          lastPromise = retryWithBackoff(() => operation(...args), retryConfig);
          const result = await lastPromise;
          lastPromise = null;
          resolve(result);
        } catch (error) {
          lastPromise = null;
          reject(error);
        }
      }, debounceMs);
    });
  };
}

export { OptimizationCircuitBreaker, CIRCUIT_STATES };