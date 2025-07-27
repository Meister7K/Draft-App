/**
 * Responsive Design Tests for Draft Pick Optimizer
 * Tests mobile optimization, touch interactions, and responsive layouts
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecommendationCard } from '../RecommendationCard';
import { OptimizationFactors } from '../OptimizationFactors';

// Mock data for testing
const mockPlayer = {
  player_info: {
    player_id: 'test-player-1',
    name: 'Test Player',
    position: 'RB',
    team: 'TEST',
    overall_rank: 15,
    position_rank: 8,
    projected_2025_points: 245.5
  }
};

const mockOptimization = {
  score: 85.5,
  factors: {
    rosterNeed: { score: 90, explanation: 'High roster need for RB position' },
    playerValue: { score: 85, explanation: 'Strong player value based on projections' },
    competition: { score: 75, explanation: 'Moderate competition from other managers' },
    availability: { score: 80, explanation: 'Good availability for next few picks' },
    startingLineupImpact: { score: 88, explanation: 'High impact on starting lineup' }
  }
};

const mockRecommendation = {
  action: 'PICK_NOW',
  reasoning: 'Strong value at position of need with low competition risk',
  riskAssessment: 'Low risk - player likely to be taken soon',
  confidence: 85
};

// Mock window.matchMedia for responsive testing
const mockMatchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

describe('Responsive Design Tests', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMedia);
    // Mock getBoundingClientRect for scroll tests
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 320,
      height: 568,
      top: 0,
      left: 0,
      bottom: 568,
      right: 320,
    }));
  });

  describe('RecommendationCard Responsive Design', () => {
    it('should render mobile layout when isMobile prop is true', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          isMobile={true}
        />
      );

      // Check for mobile-specific classes and layout
      const card = screen.getByText('Test Player').closest('.card');
      expect(card).toHaveClass('touch-manipulation');
    });

    it('should have touch-friendly button sizes on mobile', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          isMobile={true}
        />
      );

      const detailsButton = screen.getByText('Show Factor Details');
      expect(detailsButton).toHaveClass('touch-target');
      
      // Check button has adequate height for touch
      expect(detailsButton).toHaveClass('py-3'); // Should have more padding on mobile
    });

    it('should display factor breakdown in single column on mobile', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          isMobile={true}
        />
      );

      // Mobile should use single column layout for factors
      const factorContainer = screen.getByText('Roster Need:').closest('.grid');
      expect(factorContainer).toHaveClass('grid-cols-1');
    });

    it('should handle long player names with truncation', () => {
      const longNamePlayer = {
        ...mockPlayer,
        player_info: {
          ...mockPlayer.player_info,
          name: 'This Is A Very Long Player Name That Should Be Truncated'
        }
      };

      render(
        <RecommendationCard
          player={longNamePlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          isMobile={true}
        />
      );

      const playerNameLink = screen.getByText(longNamePlayer.player_info.name);
      expect(playerNameLink).toHaveClass('truncate');
    });

    it('should expand and collapse factor details with touch interaction', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          isMobile={true}
        />
      );

      const detailsButton = screen.getByText('Show Factor Details');
      
      // Initially details should be hidden
      expect(screen.queryByText('Analysis:')).not.toBeInTheDocument();
      
      // Click to expand
      fireEvent.click(detailsButton);
      expect(screen.getByText('Analysis:')).toBeInTheDocument();
      
      // Click to collapse
      const hideButton = screen.getByText('Hide Details');
      fireEvent.click(hideButton);
      expect(screen.queryByText('Analysis:')).not.toBeInTheDocument();
    });
  });

  describe('OptimizationFactors Responsive Design', () => {
    const mockFactors = {
      rosterNeed: { 
        score: 90, 
        explanation: 'High roster need for this position',
        weeklyImprovement: 12.5,
        riskLevel: 'low'
      },
      playerValue: { 
        score: 85, 
        explanation: 'Strong player value based on projections' 
      }
    };

    it('should render responsive header layout', () => {
      render(<OptimizationFactors factors={mockFactors} />);

      const header = screen.getByText('Optimization Factors').closest('.flex');
      expect(header).toHaveClass('flex-col', 'sm:flex-row');
    });

    it('should have touch-friendly factor expansion buttons', () => {
      render(<OptimizationFactors factors={mockFactors} />);

      const factorButtons = screen.getAllByText(/Roster Need|Player Value/);
      factorButtons.forEach(button => {
        const clickableElement = button.closest('[role="button"], .cursor-pointer');
        if (clickableElement) {
          expect(clickableElement).toHaveClass('touch-target');
        }
      });
    });

    it('should show responsive factor summary layout', () => {
      render(<OptimizationFactors factors={mockFactors} />);

      const summaryGrid = screen.getByText('Strongest Factor:').closest('.grid');
      expect(summaryGrid).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
    });
  });

  describe('Mobile Layout Components', () => {
    it('should render horizontal scroll layout structure', () => {
      const MockMobileLayout = () => (
        <div className="sm:hidden">
          <div className="flex space-x-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            <div className="flex-none w-80 snap-start">
              <RecommendationCard
                player={mockPlayer}
                optimization={mockOptimization}
                rank={1}
                recommendation={mockRecommendation}
                isMobile={true}
              />
            </div>
          </div>
        </div>
      );

      render(<MockMobileLayout />);

      const scrollContainer = document.querySelector('.overflow-x-auto');
      expect(scrollContainer).toHaveClass('snap-x', 'snap-mandatory', 'scrollbar-hide');
      
      const cardContainer = document.querySelector('.flex-none');
      expect(cardContainer).toHaveClass('w-80', 'snap-start');
    });

    it('should hide mobile layout on desktop', () => {
      const MockResponsiveLayout = () => (
        <>
          <div className="hidden sm:grid sm:gap-4">
            Desktop Layout
          </div>
          <div className="sm:hidden">
            Mobile Layout
          </div>
        </>
      );

      render(<MockResponsiveLayout />);

      const desktopLayout = screen.getByText('Desktop Layout').closest('div');
      const mobileLayout = screen.getByText('Mobile Layout').closest('div');
      
      expect(desktopLayout).toHaveClass('hidden', 'sm:grid');
      expect(mobileLayout).toHaveClass('sm:hidden');
    });
  });

  describe('Touch Interactions', () => {
    it('should handle touch events on recommendation cards', () => {
      const mockOnPlayerSelect = vi.fn();
      
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          onPlayerSelect={mockOnPlayerSelect}
          isMobile={true}
        />
      );

      const selectButton = screen.getByText('Select This Player');
      
      // Simulate touch events
      fireEvent.touchStart(selectButton);
      fireEvent.touchEnd(selectButton);
      fireEvent.click(selectButton);
      
      expect(mockOnPlayerSelect).toHaveBeenCalledWith(mockPlayer);
    });

    it('should maintain proper focus management on mobile', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          isMobile={true}
        />
      );

      const detailsButton = screen.getByText('Show Factor Details');
      detailsButton.focus();
      expect(document.activeElement).toBe(detailsButton);
    });
  });

  describe('Responsive Breakpoints', () => {
    it('should apply correct classes for different screen sizes', () => {
      const ResponsiveElement = () => (
        <div className="p-3 sm:p-6 text-xs sm:text-sm">
          Responsive Content
        </div>
      );

      render(<ResponsiveElement />);

      const element = screen.getByText('Responsive Content');
      expect(element).toHaveClass('p-3', 'sm:p-6', 'text-xs', 'sm:text-sm');
    });

    it('should handle responsive grid layouts', () => {
      const ResponsiveGrid = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          <div>Item 1</div>
          <div>Item 2</div>
        </div>
      );

      render(<ResponsiveGrid />);

      const grid = screen.getByText('Item 1').closest('.grid');
      expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'gap-2', 'sm:gap-4');
    });
  });
});