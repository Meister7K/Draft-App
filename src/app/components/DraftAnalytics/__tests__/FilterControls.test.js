/**
 * FilterControls Component Tests
 * Tests for the filtering and sorting functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilterControls, applyFilters } from '../FilterControls.js';

describe('FilterControls', () => {
  const mockOnFiltersChange = vi.fn();
  
  const defaultProps = {
    onFiltersChange: mockOnFiltersChange,
    availablePositions: ['QB', 'RB', 'WR', 'TE'],
    availableSeasons: ['2024', '2023', '2022'],
    showPositionFilter: true,
    showDateRangeFilter: true,
    showSearchFilter: true,
    showSortOptions: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render filter controls', () => {
    render(<FilterControls {...defaultProps} />);
    
    expect(screen.getByText('Filters & Sorting')).toBeInTheDocument();
    expect(screen.getByText('Positions')).toBeInTheDocument();
    expect(screen.getByText('Season Range')).toBeInTheDocument();
    expect(screen.getByText('Search Players')).toBeInTheDocument();
    expect(screen.getByText('Sort By')).toBeInTheDocument();
  });

  it('should handle position filter changes', async () => {
    render(<FilterControls {...defaultProps} />);
    
    const qbCheckbox = screen.getByLabelText('QB');
    fireEvent.click(qbCheckbox);
    
    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          positions: ['QB']
        })
      );
    });
  });

  it('should handle search input changes', async () => {
    render(<FilterControls {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search by name, team...');
    fireEvent.change(searchInput, { target: { value: 'mahomes' } });
    
    // Should debounce the search
    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          searchTerm: 'mahomes'
        })
      );
    }, { timeout: 500 });
  });

  it('should handle sort changes', async () => {
    render(<FilterControls {...defaultProps} />);
    
    const sortSelect = screen.getByDisplayValue('Player Name');
    fireEvent.change(sortSelect, { target: { value: 'position' } });
    
    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'position'
        })
      );
    });
  });

  it('should show active filters summary', () => {
    const propsWithFilters = {
      ...defaultProps,
      initialFilters: {
        positions: ['QB', 'RB'],
        searchTerm: 'test',
        startSeason: '2023',
        endSeason: '2024'
      }
    };
    
    render(<FilterControls {...propsWithFilters} />);
    
    expect(screen.getByText('Positions: QB, RB')).toBeInTheDocument();
    expect(screen.getByText('Search: "test"')).toBeInTheDocument();
    expect(screen.getByText('Seasons: 2023 - 2024')).toBeInTheDocument();
  });

  it('should clear all filters', async () => {
    const propsWithFilters = {
      ...defaultProps,
      initialFilters: {
        positions: ['QB'],
        searchTerm: 'test'
      }
    };
    
    render(<FilterControls {...propsWithFilters} />);
    
    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);
    
    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          positions: [],
          searchTerm: ''
        })
      );
    });
  });
});

describe('applyFilters', () => {
  const mockData = [
    { playerName: 'Patrick Mahomes', position: 'QB', team: 'KC', season: 2024, count: 5 },
    { playerName: 'Josh Allen', position: 'QB', team: 'BUF', season: 2023, count: 3 },
    { playerName: 'Derrick Henry', position: 'RB', team: 'TEN', season: 2024, count: 4 },
    { playerName: 'Davante Adams', position: 'WR', team: 'LV', season: 2022, count: 2 }
  ];

  it('should filter by position', () => {
    const filters = { positions: ['QB'] };
    const result = applyFilters(mockData, filters);
    
    expect(result).toHaveLength(2);
    expect(result.every(item => item.position === 'QB')).toBe(true);
  });

  it('should filter by search term', () => {
    const filters = { searchTerm: 'mahomes' };
    const result = applyFilters(mockData, filters);
    
    expect(result).toHaveLength(1);
    expect(result[0].playerName).toBe('Patrick Mahomes');
  });

  it('should filter by season range', () => {
    const filters = { startSeason: '2023', endSeason: '2024' };
    const result = applyFilters(mockData, filters);
    
    expect(result).toHaveLength(3);
    expect(result.every(item => item.season >= 2023 && item.season <= 2024)).toBe(true);
  });

  it('should sort data', () => {
    const filters = { sortBy: 'count', sortDirection: 'desc' };
    const result = applyFilters(mockData, filters);
    
    expect(result[0].count).toBe(5);
    expect(result[1].count).toBe(4);
    expect(result[2].count).toBe(3);
    expect(result[3].count).toBe(2);
  });

  it('should apply multiple filters', () => {
    const filters = {
      positions: ['QB'],
      searchTerm: 'allen',
      sortBy: 'playerName',
      sortDirection: 'asc'
    };
    const result = applyFilters(mockData, filters);
    
    expect(result).toHaveLength(1);
    expect(result[0].playerName).toBe('Josh Allen');
  });

  it('should handle empty data', () => {
    const filters = { positions: ['QB'] };
    const result = applyFilters([], filters);
    
    expect(result).toEqual([]);
  });

  it('should handle null data', () => {
    const filters = { positions: ['QB'] };
    const result = applyFilters(null, filters);
    
    expect(result).toEqual([]);
  });
});