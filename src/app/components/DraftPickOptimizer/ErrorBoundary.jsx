/**
 * ErrorBoundary - React error boundary for DraftPickOptimizer
 * Isolates optimizer failures from parent component and provides fallback UI
 * Includes retry mechanisms and user-friendly error messages
 */

"use client";

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastErrorTime: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true,
      error,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('DraftPickOptimizer Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      retryCount: this.state.retryCount + 1
    });

    // Report error to monitoring service if available
    if (typeof window !== 'undefined' && window.reportError) {
      window.reportError(error, {
        component: 'DraftPickOptimizer',
        errorInfo,
        retryCount: this.state.retryCount
      });
    }
  }

  handleRetry = () => {
    // Reset error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReset = () => {
    // Full reset including retry count
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastErrorTime: null
    });
  };

  render() {
    if (this.state.hasError) {
      const { error, retryCount, lastErrorTime } = this.state;
      const { fallbackComponent: FallbackComponent, showDetails = false } = this.props;

      // Use custom fallback component if provided
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            retryCount={retryCount}
            onRetry={this.handleRetry}
            onReset={this.handleReset}
          />
        );
      }

      // Default error UI
      return (
        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-400 mb-2">
                Draft Optimizer Temporarily Unavailable
              </h3>
              
              <p className="text-sm text-red-300 mb-4">
                The draft pick optimizer encountered an error and couldn't load properly. 
                Your draft functionality remains unaffected.
              </p>

              {/* Error details for development */}
              {showDetails && process.env.NODE_ENV === 'development' && (
                <div className="mb-4 p-3 bg-red-500/20 rounded text-xs font-mono text-red-200">
                  <div className="font-bold mb-1">Error Details:</div>
                  <div>{error?.message || 'Unknown error'}</div>
                  {error?.stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer">Stack Trace</summary>
                      <pre className="mt-1 whitespace-pre-wrap">{error.stack}</pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-3">
                <button
                  onClick={this.handleRetry}
                  className="px-4 py-2 bg-red-500/30 hover:bg-red-500/40 text-red-200 rounded transition-colors"
                  disabled={retryCount >= 3}
                >
                  {retryCount >= 3 ? 'Max Retries Reached' : `Retry (${retryCount}/3)`}
                </button>
                
                {retryCount >= 3 && (
                  <button
                    onClick={this.handleReset}
                    className="px-4 py-2 bg-gray-500/30 hover:bg-gray-500/40 text-gray-200 rounded transition-colors"
                  >
                    Reset
                  </button>
                )}
                
                <span className="text-xs text-red-300/70">
                  Last error: {lastErrorTime ? new Date(lastErrorTime).toLocaleTimeString() : 'Unknown'}
                </span>
              </div>

              {/* Helpful suggestions */}
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
                <div className="text-sm text-blue-300">
                  <div className="font-medium mb-1">While the optimizer is unavailable:</div>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>You can still view and manage your draft picks normally</li>
                    <li>Player rankings and values are still available</li>
                    <li>Try refreshing the page if the issue persists</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;