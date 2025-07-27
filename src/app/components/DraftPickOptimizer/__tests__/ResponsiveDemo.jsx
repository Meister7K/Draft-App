/**
 * Responsive Design Demo for Draft Pick Optimizer
 * Manual testing component to verify mobile optimization
 */

"use client";

import { useState } from 'react';
import { RecommendationCard } from '../RecommendationCard';
import { OptimizationFactors } from '../OptimizationFactors';

// Mock data for demo
const mockPlayer = {
  player_info: {
    player_id: 'demo-player-1',
    name: 'Christian McCaffrey',
    position: 'RB',
    team: 'SF',
    overall_rank: 3,
    position_rank: 1,
    projected_2025_points: 285.5
  }
};

const mockOptimization = {
  score: 92.5,
  factors: {
    rosterNeed: { 
      score: 95, 
      explanation: 'Critical need for RB position - only have 1 RB on roster',
      weeklyImprovement: 15.2,
      riskLevel: 'low'
    },
    playerValue: { 
      score: 98, 
      explanation: 'Elite tier player with consistent high performance',
      weeklyImprovement: 18.7,
      riskLevel: 'low'
    },
    competition: { 
      score: 85, 
      explanation: 'High competition - 8 managers still need RB',
      estimatedPickRange: { earliest: 2, latest: 6, mostLikely: 4 }
    },
    availability: { 
      score: 75, 
      explanation: 'Moderate availability - likely gone within 3 picks',
      estimatedPickRange: { earliest: 2, latest: 6, mostLikely: 4 },
      riskLevel: 'medium'
    },
    startingLineupImpact: { 
      score: 94, 
      explanation: 'Massive impact on starting lineup - would be RB1',
      weeklyImprovement: 22.3,
      impactType: 'starter_upgrade'
    }
  }
};

const mockRecommendation = {
  action: 'PICK_NOW',
  reasoning: 'Elite RB at critical position of need. High competition means he won\'t last much longer.',
  riskAssessment: 'Low risk - proven elite performer with minimal injury concerns',
  confidence: 92
};

const mockAlternatives = [
  {
    player: {
      player_info: {
        player_id: 'alt-1',
        name: 'Saquon Barkley',
        position: 'RB',
        team: 'PHI',
        overall_rank: 8,
        position_rank: 3
      }
    },
    optimization: { score: 88.2 },
    recommendation: { 
      scoreDifference: -4.3,
      recommendation: 'Strong alternative with similar upside but slightly lower floor'
    },
    comparison: {
      summary: 'Similar elite talent but with more injury risk and new team concerns'
    }
  },
  {
    player: {
      player_info: {
        player_id: 'alt-2',
        name: 'Derrick Henry',
        position: 'RB',
        team: 'BAL',
        overall_rank: 12,
        position_rank: 5
      }
    },
    optimization: { score: 84.7 },
    recommendation: { 
      scoreDifference: -7.8,
      recommendation: 'Solid alternative but age concerns and workload questions'
    },
    comparison: {
      summary: 'Reliable veteran option but declining upside and durability questions'
    }
  }
];

const mockWaitAdvisory = {
  action: 'PICK_NOW',
  confidence: 88,
  reasoning: 'With 8 managers needing RB and only 3 elite options available, waiting is too risky',
  waitingRisk: {
    reasoning: 'Very high risk - likely to be taken in next 2-3 picks based on league needs analysis'
  },
  nextBestAction: {
    reasoning: 'If not available, pivot to Saquon Barkley or consider elite WR like Tyreek Hill'
  }
};

export function ResponsiveDemo() {
  const [isMobileView, setIsMobileView] = useState(false);
  const [showFactors, setShowFactors] = useState(false);

  const toggleMobileView = () => {
    setIsMobileView(!isMobileView);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4">
      <div className="max-w-6xl mx-auto">
        {/* Demo Controls */}
        <div className="mb-8 p-4 bg-[var(--secondary)]/20 rounded-lg border border-[var(--border)]">
          <h1 className="text-2xl font-bold mb-4">Draft Pick Optimizer - Responsive Design Demo</h1>
          <div className="flex flex-wrap gap-4 items-center">
            <button
              onClick={toggleMobileView}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                isMobileView 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-[var(--secondary)] text-[var(--foreground)] border border-[var(--border)]'
              }`}
            >
              {isMobileView ? 'Mobile View (Active)' : 'Switch to Mobile View'}
            </button>
            <button
              onClick={() => setShowFactors(!showFactors)}
              className="px-4 py-2 rounded-lg font-semibold bg-green-500/20 text-green-400 border border-green-500/40"
            >
              {showFactors ? 'Hide' : 'Show'} Optimization Factors
            </button>
            <div className="text-sm opacity-80">
              Current viewport: <span className="font-semibold">{isMobileView ? 'Mobile' : 'Desktop'}</span>
            </div>
          </div>
        </div>

        {/* Mobile View Simulation */}
        {isMobileView && (
          <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="text-yellow-400 font-semibold mb-2">📱 Mobile View Simulation</div>
            <div className="text-sm opacity-90">
              This simulates how the components look on mobile devices. 
              The actual responsive behavior uses CSS media queries and will adapt automatically.
            </div>
          </div>
        )}

        {/* Recommendation Card Demo */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Recommendation Card</h2>
          <div className={isMobileView ? 'max-w-sm' : 'max-w-2xl'}>
            <RecommendationCard
              player={mockPlayer}
              optimization={mockOptimization}
              rank={1}
              recommendation={mockRecommendation}
              alternativeSuggestions={mockAlternatives}
              waitVsPickNowAdvisory={mockWaitAdvisory}
              showAdvancedFeatures={true}
              isMobile={isMobileView}
              onPlayerSelect={(player) => {
                alert(`Selected: ${player.player_info.name}`);
              }}
            />
          </div>
        </div>

        {/* Horizontal Scroll Demo (Mobile Only) */}
        {isMobileView && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Mobile Horizontal Scroll</h2>
            <div className="max-w-sm">
              <div className="flex space-x-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
                {[1, 2, 3].map((rank) => (
                  <div
                    key={rank}
                    className="flex-none w-80 snap-start"
                  >
                    <RecommendationCard
                      player={{
                        ...mockPlayer,
                        player_info: {
                          ...mockPlayer.player_info,
                          name: `Player ${rank}`,
                          player_id: `demo-player-${rank}`
                        }
                      }}
                      optimization={{
                        ...mockOptimization,
                        score: mockOptimization.score - (rank - 1) * 5
                      }}
                      rank={rank}
                      recommendation={mockRecommendation}
                      isMobile={true}
                    />
                  </div>
                ))}
              </div>
              
              {/* Scroll indicator */}
              <div className="flex justify-center mt-2 space-x-1">
                {[1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="w-2 h-2 rounded-full bg-[var(--border)] opacity-50"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Optimization Factors Demo */}
        {showFactors && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Optimization Factors</h2>
            <div className={isMobileView ? 'max-w-sm' : 'max-w-2xl'}>
              <OptimizationFactors
                factors={mockOptimization.factors}
                showComparison={false}
              />
            </div>
          </div>
        )}

        {/* Responsive Features Checklist */}
        <div className="mb-8 p-4 bg-[var(--primary)]/10 rounded-lg border border-[var(--primary)]/30">
          <h2 className="text-lg font-semibold mb-4">✅ Responsive Features Implemented</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Mobile Layout:</h3>
              <ul className="space-y-1 opacity-90">
                <li>• Horizontal scrolling recommendation cards</li>
                <li>• Touch-friendly button sizes (44px minimum)</li>
                <li>• Collapsible factor details</li>
                <li>• Single-column factor breakdown</li>
                <li>• Responsive text sizing</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Touch Interactions:</h3>
              <ul className="space-y-1 opacity-90">
                <li>• Touch-friendly tap targets</li>
                <li>• Smooth scrolling with snap points</li>
                <li>• Proper focus management</li>
                <li>• Touch manipulation optimization</li>
                <li>• Prevent zoom on input focus</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Testing Instructions */}
        <div className="p-4 bg-[var(--secondary)]/20 rounded-lg border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-4">🧪 Testing Instructions</h2>
          <div className="space-y-3 text-sm opacity-90">
            <div>
              <strong>Desktop Testing:</strong>
              <ul className="ml-4 mt-1 space-y-1">
                <li>• Resize browser window to test responsive breakpoints</li>
                <li>• Verify components stack vertically on narrow screens</li>
                <li>• Check that text scales appropriately</li>
              </ul>
            </div>
            <div>
              <strong>Mobile Testing:</strong>
              <ul className="ml-4 mt-1 space-y-1">
                <li>• Use browser dev tools mobile simulation</li>
                <li>• Test touch interactions on buttons and expandable sections</li>
                <li>• Verify horizontal scroll works smoothly</li>
                <li>• Check that all text is readable at mobile sizes</li>
              </ul>
            </div>
            <div>
              <strong>Accessibility Testing:</strong>
              <ul className="ml-4 mt-1 space-y-1">
                <li>• Tab through all interactive elements</li>
                <li>• Verify focus indicators are visible</li>
                <li>• Test with screen reader if available</li>
                <li>• Check color contrast in different themes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResponsiveDemo;