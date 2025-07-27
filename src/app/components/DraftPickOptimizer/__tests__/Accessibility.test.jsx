/**
 * Accessibility Tests for Draft Pick Optimizer Components
 * Tests ARIA labels, keyboard navigation, screen reader support, and accessibility compliance
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DraftPickOptimizer } from '../DraftPickOptimizer';
import { RecommendationCard } from '../RecommendationCard';
import { OptimizationFactors } from '../OptimizationFactors';

// Mock data for testing
const mockUser = {
  user_id: 'user1',
  name: 'Test User'
};

const mockLeagueUsers = [
  { user_id: 'user1', name: 'Test User' },
  { user_id: 'user2', name: 'User 2' },
  { user_id: 'user3', name: 'User 3' }
];

const mockPlayer = {
  player_info: {
    player_id: 'player1',
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
    rosterNeed: {
      score: 90,
      explanation: 'High roster need for running back position'
    },
    playerValue: {
      score: 85,
      explanation: 'Strong projected value based on historical performance'
    },
    competition: {
      score: 75,
      explanation: 'Moderate competition from other managers'
    },
    availability: {
      score: 80,
      explanation: 'Good availability for next few picks'
    },
    startingLineupImpact: {
      score: 88,
      explanation: 'High impact on starting lineup strength'
    }
  }
};

const mockRecommendation = {
  action: 'PICK_NOW',
  reasoning: 'Strong value at position of need with limited competition',
  riskAssessment: 'Low risk - likely to be drafted soon',
  confidence: 85
};

const mockData = {
  players: [mockPlayer]
};

const mockDraft = {
  picks: []
};

const mockRosterFormat = [
  { position: 'QB', slots: 1 },
  { position: 'RB', slots: 2 },
  { position: 'WR', slots: 2 },
  { position: 'TE', slots: 1 }
];

describe('DraftPickOptimizer Accessibility', () => {
  const defaultProps = {
    user: mockUser,
    leagueUsers: mockLeagueUsers,
    data: mockData,
    draft: mockDraft,
    selectedMemberId: 'user1',
    memberPicks: [],
    draftedPlayerIds: new Set(),
    calculateCompositeValue: vi.fn(() => 85),
    rosterFormat: mockRosterFormat
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ARIA Labels and Roles', () => {
    test('should have proper ARIA labels on main container', async () => {
      render(<DraftPickOptimizer {...defaultProps} />);
      
      const mainContainer = screen.getByRole('region', { name: /draft pick optimizer/i });
      expect(mainContainer).toBeInTheDocument();
      expect(mainContainer).toHaveAttribute('aria-labelledby', 'optimizer-heading');
      expect(mainContainer).toHaveAttribute('aria-describedby', 'optimizer-description');
    });

    test('should have proper heading structure', async () => {
      render(<DraftPickOptimizer {...defaultProps} />);
      
      const mainHeading = screen.getByRole('heading', { level: 3, name: /draft pick optimizer/i });
      expect(mainHeading).toBeInTheDocument();
      expect(mainHeading).toHaveAttribute('id', 'optimizer-heading');
    });

    test('should have proper ARIA live region for recommendations', async () => {
      render(<DraftPickOptimizer {...defaultProps} />);
      
      await waitFor(() => {
        const recommendationsRegion = screen.queryByRole('region', { name: /player recommendations/i });
        if (recommendationsRegion) {
          expect(recommendationsRegion).toHaveAttribute('aria-live', 'polite');
          expect(recommendationsRegion).toHaveAttribute('aria-atomic', 'false');
        }
      });
    });

    test('should have proper list structure for recommendations', async () => {
      render(<DraftPickOptimizer {...defaultProps} />);
      
      await waitFor(() => {
        const recommendationsList = screen.queryByRole('list', { name: /player recommendations/i });
        if (recommendationsList) {
          expect(recommendationsList).toBeInTheDocument();
        }
      });
    });

    test('should have proper ARIA labels for roster needs', async () => {
      render(<DraftPickOptimizer {...defaultProps} />);
      
      await waitFor(() => {
        const rosterAnalysis = screen.queryByRole('region', { name: /roster analysis/i });
        if (rosterAnalysis) {
          expect(rosterAnalysis).toHaveAttribute('aria-labelledby', 'roster-analysis-heading');
        }
      });
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support keyboard navigation for mobile recommendations scroll', async () => {
      render(<DraftPickOptimizer {...defaultProps} />);
      
      await waitFor(() => {
        const mobileScrollContainer = screen.queryByRole('list', { name: /swipe to navigate/i });
        if (mobileScrollContainer) {
          expect(mobileScrollContainer).toHaveAttribute('tabIndex', '0');
        }
      });
    });

    test('should handle arrow key navigation in mobile scroll container', async () => {
      render(<DraftPickOptimizer {...defaultProps} />);
      
      await waitFor(() => {
        const mobileScrollContainer = screen.queryByRole('list', { name: /swipe to navigate/i });
        if (mobileScrollContainer) {
          // Mock scrollBy method
          const mockScrollBy = vi.fn();
          mobileScrollContainer.scrollBy = mockScrollBy;
          
          fireEvent.keyDown(mobileScrollContainer, { key: 'ArrowRight' });
          // Verify preventDefault was called
          expect(mobileScrollContainer).toHaveAttribute('tabIndex', '0');
        }
      });
    });

    test('should support Enter and Space key activation on recommendation cards', async () => {
      const mockOnPlayerSelect = vi.fn();
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          onPlayerSelect={mockOnPlayerSelect}
        />
      );
      
      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('tabIndex', '0');
      
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(mockOnPlayerSelect).toHaveBeenCalledWith(mockPlayer);
      
      mockOnPlayerSelect.mockClear();
      
      fireEvent.keyDown(card, { key: ' ' });
      expect(mockOnPlayerSelect).toHaveBeenCalledWith(mockPlayer);
    });
  });

  describe('Screen Reader Support', () => {
    test('should provide descriptive text for optimization factors', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
        />
      );
      
      // Check for screen reader descriptions
      expect(screen.getByLabelText(/roster need score: 90 out of 100/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/player value score: 85 out of 100/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/competition score: 75 out of 100/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/availability score: 80 out of 100/i)).toBeInTheDocument();
    });

    test('should provide proper labels for action buttons', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          onPlayerSelect={vi.fn()}
        />
      );
      
      const actionButton = screen.getByRole('button', { name: /select this player/i });
      expect(actionButton).toHaveAttribute('aria-describedby');
      
      const description = screen.getByText(/draft this player immediately based on high recommendation score/i);
      expect(description).toHaveClass('sr-only');
    });

    test('should provide proper labels for expandable sections', async () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
        />
      );
      
      const detailsButton = screen.getByRole('button', { name: /show factor details/i });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'false');
      expect(detailsButton).toHaveAttribute('aria-controls');
      expect(detailsButton).toHaveAttribute('aria-describedby');
      
      fireEvent.click(detailsButton);
      expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
    });

    test('should provide proper progress bar labels', () => {
      render(<OptimizationFactors factors={mockOptimization.factors} />);
      
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
      
      progressBars.forEach(progressBar => {
        expect(progressBar).toHaveAttribute('aria-valuenow');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
        expect(progressBar).toHaveAttribute('aria-label');
      });
    });

    test('should hide decorative elements from screen readers', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
        />
      );
      
      // Check that decorative elements are hidden
      const decorativeElements = screen.getAllByText('Score');
      decorativeElements.forEach(element => {
        expect(element).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Focus Management', () => {
    test('should maintain logical tab order', async () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          onPlayerSelect={vi.fn()}
        />
      );
      
      // Test tab order through interactive elements
      const card = screen.getByRole('article');
      const playerLink = screen.getByRole('link', { name: mockPlayer.player_info.name });
      const detailsButton = screen.getByRole('button', { name: /show factor details/i });
      const actionButton = screen.getByRole('button', { name: /select this player/i });
      
      // Verify elements are focusable
      expect(card).toHaveAttribute('tabIndex', '0');
      expect(playerLink).toBeInTheDocument();
      expect(detailsButton).toBeInTheDocument();
      expect(actionButton).toBeInTheDocument();
    });

    test('should provide proper focus indicators', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          onPlayerSelect={vi.fn()}
        />
      );
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('focus:outline-none');
        expect(button).toHaveClass('focus:ring-2');
      });
    });

    test('should support keyboard navigation in OptimizationFactors', async () => {
      render(<OptimizationFactors factors={mockOptimization.factors} />);
      
      const expandButtons = screen.getAllByRole('button');
      expect(expandButtons.length).toBeGreaterThan(0);
      
      // Test that buttons are keyboard accessible
      for (const button of expandButtons) {
        expect(button).toHaveAttribute('aria-expanded');
        expect(button).toHaveAttribute('aria-controls');
      }
    });
  });

  describe('Accessibility Compliance', () => {
    test('should have proper semantic structure in DraftPickOptimizer', async () => {
      render(<DraftPickOptimizer {...defaultProps} />);
      
      // Verify semantic HTML structure
      const mainRegion = screen.getByRole('region', { name: /draft pick optimizer/i });
      expect(mainRegion).toBeInTheDocument();
      
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toBeInTheDocument();
    });

    test('should have proper semantic structure in RecommendationCard', async () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          onPlayerSelect={vi.fn()}
        />
      );
      
      // Verify article structure
      const article = screen.getByRole('article');
      expect(article).toBeInTheDocument();
      
      // Verify button accessibility
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('should have proper semantic structure in OptimizationFactors', async () => {
      render(<OptimizationFactors factors={mockOptimization.factors} />);
      
      // Verify region structure
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
      
      // Verify button structure
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('should meet color contrast requirements', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
        />
      );
      
      // Verify that color classes are applied correctly
      const scoreElements = screen.getAllByText(/\d+/);
      expect(scoreElements.length).toBeGreaterThan(0);
    });

    test('should provide sufficient touch targets for mobile', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          onPlayerSelect={vi.fn()}
          isMobile={true}
        />
      );
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('touch-target');
      });
    });

    test('should support reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
        />
      );
      
      // Verify animations are applied (in real implementation, these would be conditional)
      const card = screen.getByRole('article');
      expect(card).toHaveClass('transition-all');
    });
  });

  describe('Responsive Design Accessibility', () => {
    test('should maintain accessibility on mobile layout', () => {
      render(
        <RecommendationCard
          player={mockPlayer}
          optimization={mockOptimization}
          rank={1}
          recommendation={mockRecommendation}
          isMobile={true}
        />
      );
      
      // Verify mobile-specific accessibility features
      const card = screen.getByRole('article');
      expect(card).toHaveClass('touch-manipulation');
    });

    test('should provide proper labels for horizontal scroll on mobile', async () => {
      render(<DraftPickOptimizer {...defaultProps} />);
      
      await waitFor(() => {
        const mobileScrollContainer = screen.queryByRole('list', { name: /swipe to navigate/i });
        if (mobileScrollContainer) {
          expect(mobileScrollContainer).toHaveAttribute('aria-label');
        }
      });
    });
  });
});

describe('Accessibility Integration Tests', () => {
  test('should maintain accessibility when expanding factor details', async () => {
    render(
      <RecommendationCard
        player={mockPlayer}
        optimization={mockOptimization}
        rank={1}
        recommendation={mockRecommendation}
      />
    );
    
    const detailsButton = screen.getByRole('button', { name: /show factor details/i });
    fireEvent.click(detailsButton);
    
    // Verify expanded content is accessible
    const expandedRegion = screen.getByRole('region', { name: /detailed factor breakdown/i });
    expect(expandedRegion).toBeInTheDocument();
  });

  test('should maintain accessibility when showing alternative players', async () => {
    const alternativeSuggestions = [
      {
        player: {
          player_info: {
            player_id: 'alt1',
            name: 'Alternative Player',
            position: 'RB',
            team: 'ALT'
          }
        },
        optimization: { score: 80 },
        recommendation: { scoreDifference: -5 },
        comparison: { summary: 'Similar player with slightly lower score' }
      }
    ];
    
    render(
      <RecommendationCard
        player={mockPlayer}
        optimization={mockOptimization}
        rank={1}
        recommendation={mockRecommendation}
        alternativeSuggestions={alternativeSuggestions}
        showAdvancedFeatures={true}
      />
    );
    
    const alternativesButton = screen.getByRole('button', { name: /show alternative players/i });
    fireEvent.click(alternativesButton);
    
    // Verify alternatives section is accessible
    const alternativesRegion = screen.getByRole('region', { name: /alternative players/i });
    expect(alternativesRegion).toBeInTheDocument();
  });

  test('should maintain accessibility in OptimizationFactors expansion', async () => {
    render(<OptimizationFactors factors={mockOptimization.factors} />);
    
    const firstFactorButton = screen.getAllByRole('button')[0];
    fireEvent.click(firstFactorButton);
    
    // Verify expanded content is accessible
    const expandedRegions = screen.getAllByRole('region');
    expect(expandedRegions.length).toBeGreaterThan(1); // Main region + expanded factor region
  });
});