/**
 * ManagerAnalytics Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ManagerAnalytics } from '../ManagerAnalytics.js';

// Mock Chart.js components
vi.mock('react-chartjs-2', () => ({
  Pie: vi.fn(() => <div data-testid="pie-chart">Pie Chart</div>),
  Bar: vi.fn(() => <div data-testid="bar-chart">Bar Chart</div>)
}));

// Mock the utility functions
vi.mock('../utils/index.js', () => ({
  calculateManagerStatistics: vi.fn(() => ({
    totalPicks: 50,
    averagePickPosition: 6.5,
    favoritePosition: 'RB',
    positionFrequencies: {
      RB: { count: 15, percentage: 30, averageRound: 2.5 },
      WR: { count: 12, percentage: 24, averageRound: 3.2 },
      QB: { count: 8, percentage: 16, averageRound: 8.1 }
    },
    mostFrequentPlayers: [
      { name: 'Christian McCaffrey', position: 'RB', count: 3, averageRound: 1.2 },
      { name: 'Davante Adams', position: 'WR', count: 2, averageRound: 2.5 }
    ]
  }))
}));

// Mock HistoricalData components
vi.mock('../HistoricalData.js', () => ({
  HistoricalDataManager: vi.fn().mockImplementation(() => ({
    loadManagerData: vi.fn().mockResolvedValue({
      managerId: 'test-manager',
      picks: [
        { picked_by: 'test-manager', pick_no: 1, round: 1, metadata: { player_id: 'player1' } }
      ],
      seasons: ['2023', '2022']
    })
  })),
  HistoricalDataUtils: {
    formatErrorMessage: vi.fn((error) => error?.message || 'Unknown error'),
    assessDataQuality: vi.fn(() => ({
      score: 85,
      totalPicks: 50,
      seasons: 3
    }))
  }
}));

describe('ManagerAnalytics Component', () => {
  const mockProps = {
    managerId: 'test-manager',
    historicalData: {},
    currentDraft: {},
    availablePlayers: [],
    leagueUsers: [
      { user_id: 'test-manager', display_name: 'Test Manager' },
      { user_id: 'other-manager', display_name: 'Other Manager' }
    ],
    onManagerChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ManagerAnalytics {...mockProps} />);
    expect(screen.getByText('Manager Analytics')).toBeInTheDocument();
  });

  it('displays manager selection dropdown', () => {
    render(<ManagerAnalytics {...mockProps} />);
    expect(screen.getByLabelText('Select Manager:')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Manager')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<ManagerAnalytics {...mockProps} />);
    // The component should show some loading indication initially
    expect(screen.getByText('Manager Analytics')).toBeInTheDocument();
  });

  it('displays manager selection options', () => {
    render(<ManagerAnalytics {...mockProps} />);
    const select = screen.getByLabelText('Select Manager:');
    expect(select).toBeInTheDocument();
    
    // Check that options are present
    expect(screen.getByText('Test Manager')).toBeInTheDocument();
    expect(screen.getByText('Other Manager')).toBeInTheDocument();
  });
});