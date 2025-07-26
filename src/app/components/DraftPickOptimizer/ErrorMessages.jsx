/**
 * ErrorMessages - User-friendly error messages and recovery options
 * Provides contextual error information and actionable recovery steps
 */

"use client";

import React from 'react';

/**
 * Error message configurations
 */
const ERROR_CONFIGS = {
  CALCULATION_FAILED: {
    title: 'Calculation Error',
    icon: '⚠️',
    severity: 'warning',
    description: 'The optimizer encountered an error while calculating recommendations.',
    userMessage: 'We\'re having trouble analyzing the current draft situation. Your draft functionality remains unaffected.',
    recoveryOptions: ['retry', 'fallback', 'refresh']
  },
  DATA_UNAVAILABLE: {
    title: 'Data Unavailable',
    icon: '📊',
    severity: 'info',
    description: 'Required player or draft data is not available.',
    userMessage: 'Some player data is missing or loading. Recommendations may be limited.',
    recoveryOptions: ['wait', 'refresh', 'continue']
  },
  NETWORK_ERROR: {
    title: 'Connection Issue',
    icon: '🌐',
    severity: 'error',
    description: 'Unable to connect to the optimization service.',
    userMessage: 'There seems to be a connection issue. Please check your internet connection.',
    recoveryOptions: ['retry', 'offline', 'refresh']
  },
  TIMEOUT_ERROR: {
    title: 'Processing Timeout',
    icon: '⏱️',
    severity: 'warning',
    description: 'The optimization calculation took too long to complete.',
    userMessage: 'The analysis is taking longer than expected. This might be due to high server load.',
    recoveryOptions: ['retry', 'simplify', 'fallback']
  },
  INVALID_DATA: {
    title: 'Data Validation Error',
    icon: '🔍',
    severity: 'warning',
    description: 'The player or draft data contains invalid information.',
    userMessage: 'Some of the draft data appears to be incomplete or invalid.',
    recoveryOptions: ['fallback', 'refresh', 'continue']
  },
  CIRCUIT_BREAKER_OPEN: {
    title: 'Service Temporarily Unavailable',
    icon: '🔌',
    severity: 'error',
    description: 'The optimization service is temporarily disabled due to repeated failures.',
    userMessage: 'The optimizer is temporarily disabled to prevent further issues. It will automatically retry soon.',
    recoveryOptions: ['wait', 'fallback', 'reset']
  },
  UNKNOWN_ERROR: {
    title: 'Unexpected Error',
    icon: '❌',
    severity: 'error',
    description: 'An unexpected error occurred.',
    userMessage: 'Something unexpected happened. Please try again or refresh the page.',
    recoveryOptions: ['retry', 'refresh', 'report']
  }
};

/**
 * Determine error type from error object
 */
function getErrorType(error) {
  if (!error) return 'UNKNOWN_ERROR';
  
  const message = error.message?.toLowerCase() || '';
  const name = error.name?.toLowerCase() || '';
  
  if (name.includes('network') || message.includes('network') || message.includes('fetch')) {
    return 'NETWORK_ERROR';
  }
  
  if (name.includes('timeout') || message.includes('timeout')) {
    return 'TIMEOUT_ERROR';
  }
  
  if (message.includes('circuit breaker') || message.includes('circuit') && message.includes('open')) {
    return 'CIRCUIT_BREAKER_OPEN';
  }
  
  if (message.includes('validation') || message.includes('invalid data')) {
    return 'INVALID_DATA';
  }
  
  if (message.includes('data') && (message.includes('unavailable') || message.includes('missing'))) {
    return 'DATA_UNAVAILABLE';
  }
  
  if (message.includes('calculation') || message.includes('optimization')) {
    return 'CALCULATION_FAILED';
  }
  
  return 'UNKNOWN_ERROR';
}

/**
 * Recovery action handlers
 */
const RECOVERY_ACTIONS = {
  retry: {
    label: 'Try Again',
    description: 'Retry the optimization calculation',
    variant: 'primary'
  },
  fallback: {
    label: 'Use Basic Mode',
    description: 'Switch to simplified recommendations',
    variant: 'secondary'
  },
  refresh: {
    label: 'Refresh Page',
    description: 'Reload the page to reset the optimizer',
    variant: 'secondary'
  },
  wait: {
    label: 'Wait & Retry',
    description: 'Wait a moment and try again automatically',
    variant: 'secondary'
  },
  offline: {
    label: 'Continue Offline',
    description: 'Use cached data and basic functionality',
    variant: 'secondary'
  },
  simplify: {
    label: 'Simplify Analysis',
    description: 'Use faster, less detailed calculations',
    variant: 'secondary'
  },
  continue: {
    label: 'Continue Anyway',
    description: 'Proceed with limited functionality',
    variant: 'secondary'
  },
  reset: {
    label: 'Reset Optimizer',
    description: 'Reset the optimizer to its initial state',
    variant: 'secondary'
  },
  report: {
    label: 'Report Issue',
    description: 'Report this error for investigation',
    variant: 'secondary'
  }
};

/**
 * Main error message component
 */
export function ErrorMessage({ 
  error, 
  onRetry, 
  onFallback, 
  onRefresh, 
  onReset,
  retryCount = 0,
  maxRetries = 3,
  showDetails = false,
  className = ""
}) {
  const errorType = getErrorType(error);
  const config = ERROR_CONFIGS[errorType];
  
  const handleRecoveryAction = (actionType) => {
    switch (actionType) {
      case 'retry':
        onRetry?.();
        break;
      case 'fallback':
        onFallback?.();
        break;
      case 'refresh':
        if (onRefresh) {
          onRefresh();
        } else {
          window.location.reload();
        }
        break;
      case 'reset':
        onReset?.();
        break;
      case 'wait':
        setTimeout(() => onRetry?.(), 3000);
        break;
      case 'offline':
        onFallback?.();
        break;
      case 'simplify':
        onFallback?.();
        break;
      case 'continue':
        onFallback?.();
        break;
      case 'report':
        console.error('User reported error:', error);
        // Could integrate with error reporting service
        break;
      default:
        console.warn('Unknown recovery action:', actionType);
    }
  };

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'error':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
    }
  };

  const getButtonStyles = (variant) => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-500/30 hover:bg-blue-500/40 text-blue-200 border-blue-500/50';
      case 'secondary':
        return 'bg-gray-500/30 hover:bg-gray-500/40 text-gray-200 border-gray-500/50';
      default:
        return 'bg-gray-500/30 hover:bg-gray-500/40 text-gray-200 border-gray-500/50';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getSeverityStyles(config.severity)} ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-2xl">
          {config.icon}
        </div>
        
        <div className="flex-1">
          <h4 className="font-semibold text-lg mb-2">
            {config.title}
          </h4>
          
          <p className="text-sm opacity-90 mb-4">
            {config.userMessage}
          </p>

          {/* Retry count indicator */}
          {retryCount > 0 && (
            <div className="mb-3 text-xs opacity-70">
              Attempt {retryCount} of {maxRetries}
            </div>
          )}

          {/* Recovery actions */}
          <div className="flex flex-wrap gap-2 mb-4">
            {config.recoveryOptions.map(actionType => {
              const action = RECOVERY_ACTIONS[actionType];
              const isDisabled = actionType === 'retry' && retryCount >= maxRetries;
              
              return (
                <button
                  key={actionType}
                  onClick={() => handleRecoveryAction(actionType)}
                  disabled={isDisabled}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    isDisabled 
                      ? 'opacity-50 cursor-not-allowed bg-gray-500/20 text-gray-400' 
                      : getButtonStyles(action.variant)
                  }`}
                  title={action.description}
                >
                  {action.label}
                </button>
              );
            })}
          </div>

          {/* Error details for development */}
          {showDetails && process.env.NODE_ENV === 'development' && error && (
            <details className="mt-3 p-2 bg-black/20 rounded text-xs">
              <summary className="cursor-pointer font-medium">
                Technical Details
              </summary>
              <div className="mt-2 space-y-1">
                <div><strong>Type:</strong> {errorType}</div>
                <div><strong>Message:</strong> {error.message}</div>
                <div><strong>Name:</strong> {error.name}</div>
                {error.stack && (
                  <div>
                    <strong>Stack:</strong>
                    <pre className="mt-1 text-xs whitespace-pre-wrap">{error.stack}</pre>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Helpful tips */}
          <div className="mt-3 p-2 bg-white/5 rounded text-xs">
            <div className="font-medium mb-1">While the optimizer is unavailable:</div>
            <ul className="list-disc list-inside space-y-1 opacity-80">
              <li>Your draft picks and roster management work normally</li>
              <li>Player rankings and basic stats are still available</li>
              <li>You can continue drafting using your own strategy</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact error indicator for inline display
 */
export function ErrorIndicator({ error, onRetry, className = "" }) {
  const errorType = getErrorType(error);
  const config = ERROR_CONFIGS[errorType];
  
  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      <span className="text-red-400">{config.icon}</span>
      <span className="text-red-300">{config.title}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Loading state with error recovery
 */
export function LoadingWithError({ 
  isLoading, 
  error, 
  onRetry, 
  onFallback,
  loadingMessage = "Calculating recommendations...",
  className = ""
}) {
  if (error) {
    return (
      <ErrorMessage
        error={error}
        onRetry={onRetry}
        onFallback={onFallback}
        className={className}
      />
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg ${className}`}>
        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-blue-300">{loadingMessage}</span>
      </div>
    );
  }

  return null;
}

/**
 * Error boundary fallback component
 */
export function ErrorBoundaryFallback({ error, retryCount, onRetry, onReset }) {
  return (
    <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
      <div className="text-center">
        <div className="text-4xl mb-4">🚫</div>
        <h3 className="text-xl font-bold text-red-400 mb-2">
          Draft Optimizer Unavailable
        </h3>
        <p className="text-red-300 mb-6">
          The optimizer encountered a critical error and needs to be reset.
          Your draft functionality continues to work normally.
        </p>
        
        <div className="space-y-3">
          <ErrorMessage
            error={error}
            onRetry={onRetry}
            onReset={onReset}
            retryCount={retryCount}
            showDetails={true}
          />
        </div>
      </div>
    </div>
  );
}

export default ErrorMessage;