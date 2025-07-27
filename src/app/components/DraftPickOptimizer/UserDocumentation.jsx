/**
 * User Documentation and Tooltips for Draft Pick Optimizer
 * Provides contextual help and explanations for optimizer features
 */

"use client";

import { useState, useCallback } from "react";

// Tooltip component with improved accessibility
export function Tooltip({ children, content, position = "top", delay = 500 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  const showTooltip = useCallback(() => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  }, [delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  }, [timeoutId]);

  const positionClasses = {
    top: "bottom-full left-1/2 transform -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 transform -translate-x-1/2 mt-2",
    left: "right-full top-1/2 transform -translate-y-1/2 mr-2",
    right: "left-full top-1/2 transform -translate-y-1/2 ml-2"
  };

  const arrowClasses = {
    top: "top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800",
    bottom: "bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800",
    left: "left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800",
    right: "right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800"
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div 
          className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg max-w-xs ${positionClasses[position]} transition-opacity duration-200`}
          role="tooltip"
          aria-hidden="false"
        >
          {content}
          <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}></div>
        </div>
      )}
    </div>
  );
}

// Help icon with tooltip
export function HelpIcon({ content, className = "" }) {
  return (
    <Tooltip content={content}>
      <button
        className={`inline-flex items-center justify-center w-4 h-4 text-xs text-gray-400 hover:text-gray-300 rounded-full border border-gray-500 hover:border-gray-400 transition-colors ${className}`}
        aria-label="Help information"
        tabIndex="0"
      >
        ?
      </button>
    </Tooltip>
  );
}

// Feature explanation component
export function FeatureExplanation({ title, description, examples = [], tips = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={isExpanded}
      >
        <h4 className="font-semibold text-[var(--foreground)]">{title}</h4>
        <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      
      {isExpanded && (
        <div className="mt-3 space-y-3 text-sm opacity-90">
          <p>{description}</p>
          
          {examples.length > 0 && (
            <div>
              <h5 className="font-medium mb-2">Examples:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                {examples.map((example, index) => (
                  <li key={index}>{example}</li>
                ))}
              </ul>
            </div>
          )}
          
          {tips.length > 0 && (
            <div>
              <h5 className="font-medium mb-2">Tips:</h5>
              <ul className="list-disc list-inside space-y-1 ml-2">
                {tips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main documentation component
export function UserDocumentation({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg max-w-2xl max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            Draft Pick Optimizer Guide
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 text-2xl"
            aria-label="Close documentation"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <FeatureExplanation
            title="How the Optimizer Works"
            description="The Draft Pick Optimizer analyzes available players and recommends the best picks based on multiple factors including your roster needs, player value, competition from other managers, and availability projections."
            examples={[
              "If you need a RB and there's high competition, it will recommend picking one now",
              "If similar WRs are available later, it might suggest waiting and filling other needs first"
            ]}
            tips={[
              "The optimizer updates in real-time as picks are made",
              "Recommendations are ranked from 1-5 with detailed explanations"
            ]}
          />

          <FeatureExplanation
            title="Optimization Factors"
            description="Each recommendation is scored based on five key factors that determine the overall optimization score."
            examples={[
              "Roster Need (25%): How much you need this position",
              "Player Value (30%): The player's intrinsic quality and projected points",
              "Competition (20%): How many other managers need this position",
              "Availability (15%): Likelihood of the player being available later",
              "Starting Lineup Impact (10%): Direct fantasy point improvement"
            ]}
            tips={[
              "Higher scores indicate better picks for your specific situation",
              "Click on any recommendation to see detailed factor breakdowns"
            ]}
          />

          <FeatureExplanation
            title="Recommendation Actions"
            description="Each player recommendation includes an action suggestion to guide your decision-making."
            examples={[
              "PICK_NOW: High-value player likely to be taken soon",
              "CONSIDER: Good option, weigh against other needs",
              "WAIT: Similar players available later, fill other needs first"
            ]}
            tips={[
              "Consider the risk assessment when deciding whether to wait",
              "Look at alternative suggestions for similar players"
            ]}
          />

          <FeatureExplanation
            title="Advanced Features"
            description="The optimizer includes advanced features to help with complex draft decisions."
            examples={[
              "Alternative Player Suggestions: Similar players at the same position",
              "Wait vs Pick Now Advisory: Detailed analysis of timing decisions",
              "Position Scarcity Warnings: Alerts when positions are running thin",
              "Draft Strategy Insights: Overall approach recommendations"
            ]}
            tips={[
              "Use alternative suggestions to find value picks",
              "Pay attention to scarcity warnings for thin positions like TE"
            ]}
          />

          <FeatureExplanation
            title="Performance and Reliability"
            description="The optimizer is designed for speed and reliability during live drafts."
            examples={[
              "Calculations complete in under 500ms for real-time updates",
              "Caching system prevents redundant calculations",
              "Fallback mode ensures recommendations even if advanced features fail"
            ]}
            tips={[
              "Green cache indicator shows when calculations are optimized",
              "Yellow warning icon indicates slower performance",
              "Simplified mode activates automatically if needed"
            ]}
          />

          <FeatureExplanation
            title="Mobile and Accessibility"
            description="The optimizer is fully responsive and accessible across all devices."
            examples={[
              "Horizontal scrolling on mobile for easy navigation",
              "Keyboard navigation support for all features",
              "Screen reader compatible with proper ARIA labels"
            ]}
            tips={[
              "Swipe left/right on mobile to browse recommendations",
              "Use arrow keys on desktop for keyboard navigation",
              "All interactive elements are touch-friendly on mobile"
            ]}
          />
        </div>

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h3 className="font-semibold text-blue-400 mb-2">Quick Tips for Success</h3>
          <ul className="text-sm space-y-1 opacity-90">
            <li>• Trust the optimizer's rankings, but consider your league's specific tendencies</li>
            <li>• Pay attention to position scarcity warnings, especially for TE and QB</li>
            <li>• Use the wait vs pick now advisory for difficult timing decisions</li>
            <li>• Check alternative suggestions to find value picks at the same position</li>
            <li>• Monitor the roster analysis to ensure you're filling critical needs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Quick help tooltips for specific features
export const TOOLTIP_CONTENT = {
  optimizationScore: "Overall recommendation score (0-100) based on weighted factors. Higher scores indicate better picks for your specific situation.",
  
  rosterNeed: "How much you need this position based on your current roster and league requirements. Higher scores for unfilled positions.",
  
  playerValue: "The player's intrinsic quality based on projected points, rankings, and historical performance. Independent of your roster needs.",
  
  competition: "How many other managers need this position. Higher competition means the player is more likely to be drafted soon.",
  
  availability: "Likelihood of this player being available for your future picks. Lower availability suggests picking now.",
  
  startingLineupImpact: "Direct fantasy point improvement this player would provide to your starting lineup compared to current options.",
  
  waitVsPickNow: "Analysis of whether to draft this player now or wait for future picks. Considers availability risk and alternative options.",
  
  alternativePlayers: "Similar players at the same position who might provide comparable value. Useful for finding backup options.",
  
  positionScarcity: "Warning when quality players at a position are running low. Important for positions like TE and QB with limited depth.",
  
  draftStrategy: "Overall draft approach recommendations based on your roster state and available players. Helps with big-picture planning."
};

export default UserDocumentation;