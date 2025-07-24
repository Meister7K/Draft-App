/**
 * PredictionEngine Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PredictionEngine } from '../PredictionEngine.js';

// Mock the HistoricalDataManager
vi.mock('../HistoricalData.js', () => ({
  HistoricalDataManager: vi.fn().mockImplementation(() => ({
    loadManagerData: vi.fn().mockResolvedValue({
      managerId: 'test_manager',
      picks: [
        {
          picked_by: 'test_manager',
          round: 1,
          draft_slot: 1,
          metadata: { player_id: 'player1' },
          player_info: { position: 'RB' }
        }
      ],
      seasons: ['2023', '2024']
    })
  }))
}));

// Mock the prediction utilities
vi.mock('../utils/index.js', () => ({
  generatePredictionRanking: vi.fn().mockReturnValue([
    {
      playerId: 'player1',
      playerName: 'Test Player',
      position: 'RB',
      team: 'TEST',
      confidence: 85,
      factors: {
        dataStrength: 25,
        positionMatch: 20,
        playerQuality: 15,
        scarcity: 10,
        roundFit: 15
      },
      reasoning: 'Frequently drafts RB (45.2% of picks); High-quality RB (ranked #1 at position)',
      historicalBasis: {
        positionFrequency: { percentage: 45.2 },
        similarPicks: 5,
        roundType: 'early'
      },
      playerData: {
        overallRank: 1,
        positionRank: 1,
        projectedPoints: 285.5
      }
    }
  ]),
  filterAvailablePlayers: vi.fn().mockImplementation((players) => players),
  validatePredictionInputs: vi.fn().mockReturnValue({ isValid: true, errors: [] })
}));

describe('PredictionEngine Component', () => {
  const mockProps = {
    managerId: null,
    draftPosition: 1,
    historicalData: {},
    availablePlayers: [
      {
        player_info: {
          player_id: 'player1',
          name: 'Test Player',
          position: 'RB',
          team: 'TEST',
          overall_rank: 1,
          position_rank: 1,
          projected_2025_points: 285.5
        }
      }
    ],
    leagueUsers: [
      { user_id: 'manager1', display_name: 'Manager 1' },
      { user_id: 'manager2', display_name: 'Manager 2' }
    ],
    leagueContext: { totalTeams: 12 },
    onManagerChange: vi.fn(),
    onDraftPositionChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Render', () => {
    it('renders the component with header and controls', () => {
      render(<PredictionEngine {...mockProps} />);
      
      expect(screen.getByText('Draft Predictions')).toBeInTheDocument();
      expect(screen.getByLabelText('Manager:')).toBeInTheDocument();
      expect(screen.getByLabelText('Pick #:')).toBeInTheDocument();
    });

    it('shows no manager selected message initially', () => {
      render(<PredictionEngine {...mockProps} />);
      
      expect(screen.getByText('Select a manager to generate draft predictions')).toBeInTheDocument();
    });

    it('displays round information correctly', () => {
      render(<PredictionEngine {...mockProps} draftPosition={13} />);
      
      expect(screen.getByText('(Round 2, Pick 1)')).toBeInTheDocument();
    });
  });

  describe('Manager Selection', () => {
    it('renders manager dropdown with options', () => {
      render(<PredictionEngine {...mockProps} />);
      
      const select = screen.getByLabelText('Manager:');
      expect(select).toBeInTheDocument();
      
      expect(screen.getByText('Choose manager...')).toBeInTheDocument();
      expect(screen.getByText('Manager 1')).toBeInTheDocument();
      expect(screen.getByText('Manager 2')).toBeInTheDocument();
    });

    it('calls onManagerChange when manager is selected', async () => {
      render(<PredictionEngine {...mockProps} />);
      
      const select = screen.getByLabelText('Manager:');
      fireEvent.change(select, { target: { value: 'manager1' } });
      
      expect(mockProps.onManagerChange).toHaveBeenCalledWith('manager1');
    });
  });

  describe('Draft Position Input', () => {
    it('renders draft position input with correct value', () => {
      render(<PredictionEngine {...mockProps} draftPosition={5} />);
      
      const input = screen.getByLabelText('Pick #:');
      expect(input).toHaveValue(5);
    });

    it('calls onDraftPositionChange when position is changed', () => {
      render(<PredictionEngine {...mockProps} />);
      
      const input = screen.getByLabelText('Pick #:');
      fireEvent.change(input, { target: { value: '10' } });
      
      expect(mockProps.onDraftPositionChange).toHaveBeenCalledWith(10);
    });

    it('enforces minimum and maximum values', () => {
      render(<PredictionEngine {...mockProps} />);
      
      const input = screen.getByLabelText('Pick #:');
      
      // Test minimum value
      fireEvent.change(input, { target: { value: '0' } });
      expect(mockProps.onDraftPositionChange).toHaveBeenCalledWith(1);
      
      // Test maximum value
      fireEvent.change(input, { target: { value: '500' } });
      expect(mockProps.onDraftPositionChange).toHaveBeenCalledWith(300);
    });
  });

  describe('Predictions Display', () => {
    it('shows predictions when manager is selected', async () => {
      render(<PredictionEngine {...mockProps} managerId="manager1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Predictions for Manager 1 at Pick #1')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Test Player')).toBeInTheDocument();
      expect(screen.getByText('RB • TEST • Overall #1')).toBeInTheDocument();
      expect(screen.getByText('High (85%)')).toBeInTheDocument();
    });

    it('displays confidence levels with correct styling', async () => {
      render(<PredictionEngine {...mockProps} managerId="manager1" />);
      
      await waitFor(() => {
        const confidenceBadge = screen.getByText('High (85%)');
        expect(confidenceBadge).toHaveClass('text-green-600');
      });
    });

    it('shows expanded details when prediction is clicked', async () => {
      render(<PredictionEngine {...mockProps} managerId="manager1" />);
      
      await waitFor(() => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        fireEvent.click(expandButton);
      });
      
      expect(screen.getByText('Prediction Reasoning')).toBeInTheDocument();
      expect(screen.getByText('Historical Basis')).toBeInTheDocument();
      expect(screen.getByText('Confidence Factors')).toBeInTheDocument();
    });
  });

  describe('Data Quality Indicators', () => {
    it('shows good data quality indicator', async () => {
      render(<PredictionEngine {...mockProps} managerId="manager1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Data Quality: Good')).toBeInTheDocument();
      });
    });

    it('shows appropriate styling for data quality levels', async () => {
      render(<PredictionEngine {...mockProps} managerId="manager1" />);
      
      await waitFor(() => {
        const qualityIndicator = screen.getByText('Data Quality: Good').closest('div');
        expect(qualityIndicator).toHaveClass('bg-green-50');
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when prediction generation fails', async () => {
      const { generatePredictionRanking } = await import('../utils/index.js');
      generatePredictionRanking.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      render(<PredictionEngine {...mockProps} managerId="manager1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Prediction Error')).toBeInTheDocument();
        expect(screen.getByText(/Failed to generate predictions/)).toBeInTheDocument();
      });
    });

    it('shows no predictions message when no data available', async () => {
      render(<PredictionEngine {...mockProps} managerId="manager1" availablePlayers={[]} />);
      
      await waitFor(() => {
        expect(screen.getByText('No predictions available')).toBeInTheDocument();
        expect(screen.getByText('No available players to predict from')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading spinner during initial load', () => {
      render(<PredictionEngine {...mockProps} />);
      
      // Component should show loading state initially
      expect(screen.getByText('Draft Predictions')).toBeInTheDocument();
    });

    it('shows loading overlay when updating predictions', async () => {
      const { HistoricalDataManager } = await import('../HistoricalData.js');
      const mockManager = new HistoricalDataManager();
      mockManager.loadManagerData.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<PredictionEngine {...mockProps} managerId="manager1" />);
      
      // Should show loading state while data loads
      expect(screen.getByText('Draft Predictions')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('regenerates predictions when available players change', async () => {
      const { rerender } = render(<PredictionEngine {...mockProps} managerId="manager1" />);
      
      await waitFor(() => {
        expect(screen.getByText('Test Player')).toBeInTheDocument();
      });

      // Update available players
      const newPlayers = [
        {
          player_info: {
            player_id: 'player2',
            name: 'New Player',
            position: 'QB',
            team: 'NEW',
            overall_rank: 2,
            position_rank: 1,
            projected_2025_points: 275.0
          }
        }
      ];

      rerender(<PredictionEngine {...mockProps} managerId="manager1" availablePlayers={newPlayers} />);
      
      // Should trigger new prediction generation
      await waitFor(() => {
        expect(mockProps.onManagerChange).toHaveBeenCalled();
      });
    });

    it('updates predictions when draft position changes', async () => {
      const { rerender } = render(<PredictionEngine {...mockProps} managerId="manager1" draftPosition={1} />);
      
      await waitFor(() => {
        expect(screen.getByText('(Round 1, Pick 1)')).toBeInTheDocument();
      });

      rerender(<PredictionEngine {...mockProps} managerId="manager1" draftPosition={13} />);
      
      await waitFor(() => {
        expect(screen.getByText('(Round 2, Pick 1)')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper labels for form controls', () => {
      render(<PredictionEngine {...mockProps} />);
      
      expect(screen.getByLabelText('Manager:')).toBeInTheDocument();
      expect(screen.getByLabelText('Pick #:')).toBeInTheDocument();
    });

    it('has proper ARIA attributes for interactive elements', async () => {
      render(<PredictionEngine {...mockProps} managerId="manager1" />);
      
      await waitFor(() => {
        const expandButtons = screen.getAllByRole('button');
        expandButtons.forEach(button => {
          expect(button).toBeInTheDocument();
        });
      });
    });
  });

  describe('Responsive Design', () => {
    it('renders controls in responsive layout', () => {
      render(<PredictionEngine {...mockProps} />);
      
      const header = screen.getByText('Draft Predictions').closest('div');
      expect(header).toHaveClass('flex', 'flex-col', 'lg:flex-row');
    });

    it('handles mobile layout for prediction cards', async () => {
      render(<PredictionEngine {...mockProps} managerId="manager1" />);
      
      await waitFor(() => {
        const predictionCard = screen.getByText('Test Player').closest('div');
        expect(predictionCard).toHaveClass('flex', 'items-center');
      });
    });
  });
});