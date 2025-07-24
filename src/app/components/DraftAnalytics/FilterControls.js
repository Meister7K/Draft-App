/**
 * FilterControls Component
 * Provides comprehensive filtering and sorting controls for Draft Analytics
 * Supports position filtering, date range filtering, search, sorting options, and pattern search
 * Enhanced with filter state persistence across tab switches and advanced filtering capabilities
 * Task 11: Interactive filtering and sorting capabilities implementation
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDebounce } from "./utils/performanceOptimizations.js";

export function FilterControls({
  onFiltersChange,
  availablePositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
  availableSeasons = [],
  availableTeams = [],
  showPositionFilter = true,
  showDateRangeFilter = true,
  showSearchFilter = true,
  showSortOptions = true,
  showTeamFilter = false,
  showAdvancedFilters = false,
  sortOptions = [
    { key: 'name', label: 'Player Name' },
    { key: 'position', label: 'Position' },
    { key: 'count', label: 'Draft Count' },
    { key: 'percentage', label: 'Draft Percentage' },
    { key: 'avgRound', label: 'Average Round' },
    { key: 'season', label: 'Season' },
    { key: 'confidence', label: 'Confidence' },
    { key: 'round', label: 'Round' }
  ],
  initialFilters = {},
  className = "",
  context = 'general' // 'analytics', 'predictions', 'general'
}) {
  // Filter state
  const [filters, setFilters] = useState({
    positions: [],
    teams: [],
    searchTerm: '',
    startSeason: '',
    endSeason: '',
    minConfidence: 0,
    maxConfidence: 100,
    minRound: 1,
    maxRound: 20,
    sortBy: context === 'predictions' ? 'confidence' : 'name',
    sortDirection: context === 'predictions' ? 'desc' : 'asc',
    showOnlyAvailable: context === 'predictions',
    patternSearch: '',
    ...initialFilters
  });

  // Debounce search term to prevent excessive filtering
  const debouncedSearchTerm = useDebounce(filters.searchTerm, 300);

  // Debounce pattern search to prevent excessive filtering
  const debouncedPatternSearch = useDebounce(filters.patternSearch, 500);

  // Update filters when debounced search terms change
  useEffect(() => {
    if (debouncedSearchTerm !== filters.searchTerm) {
      const updatedFilters = { ...filters, searchTerm: debouncedSearchTerm };
      setFilters(updatedFilters);
      onFiltersChange?.(updatedFilters);
    }
  }, [debouncedSearchTerm, filters, onFiltersChange]);

  useEffect(() => {
    if (debouncedPatternSearch !== filters.patternSearch) {
      const updatedFilters = { ...filters, patternSearch: debouncedPatternSearch };
      setFilters(updatedFilters);
      onFiltersChange?.(updatedFilters);
    }
  }, [debouncedPatternSearch, filters, onFiltersChange]);

  // Handle position filter change
  const handlePositionChange = useCallback((position, checked) => {
    const updatedPositions = checked
      ? [...filters.positions, position]
      : filters.positions.filter(p => p !== position);
    
    const updatedFilters = { ...filters, positions: updatedPositions };
    setFilters(updatedFilters);
    onFiltersChange?.(updatedFilters);
  }, [filters, onFiltersChange]);

  // Handle team filter change
  const handleTeamChange = useCallback((team, checked) => {
    const updatedTeams = checked
      ? [...filters.teams, team]
      : filters.teams.filter(t => t !== team);
    
    const updatedFilters = { ...filters, teams: updatedTeams };
    setFilters(updatedFilters);
    onFiltersChange?.(updatedFilters);
  }, [filters, onFiltersChange]);

  // Handle search term change (immediate for UI, debounced for filtering)
  const handleSearchChange = useCallback((value) => {
    setFilters(prev => ({ ...prev, searchTerm: value }));
  }, []);

  // Handle pattern search change (immediate for UI, debounced for filtering)
  const handlePatternSearchChange = useCallback((value) => {
    setFilters(prev => ({ ...prev, patternSearch: value }));
  }, []);

  // Handle date range changes
  const handleDateRangeChange = useCallback((field, value) => {
    const updatedFilters = { ...filters, [field]: value };
    setFilters(updatedFilters);
    onFiltersChange?.(updatedFilters);
  }, [filters, onFiltersChange]);

  // Handle range filter changes (confidence, round)
  const handleRangeChange = useCallback((field, value) => {
    const numValue = parseInt(value) || 0;
    const updatedFilters = { ...filters, [field]: numValue };
    setFilters(updatedFilters);
    onFiltersChange?.(updatedFilters);
  }, [filters, onFiltersChange]);

  // Handle checkbox filter changes
  const handleCheckboxChange = useCallback((field, checked) => {
    const updatedFilters = { ...filters, [field]: checked };
    setFilters(updatedFilters);
    onFiltersChange?.(updatedFilters);
  }, [filters, onFiltersChange]);

  // Handle sort changes
  const handleSortChange = useCallback((sortBy, sortDirection) => {
    const updatedFilters = { ...filters, sortBy, sortDirection };
    setFilters(updatedFilters);
    onFiltersChange?.(updatedFilters);
  }, [filters, onFiltersChange]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    const clearedFilters = {
      positions: [],
      teams: [],
      searchTerm: '',
      startSeason: '',
      endSeason: '',
      minConfidence: 0,
      maxConfidence: 100,
      minRound: 1,
      maxRound: 20,
      sortBy: context === 'predictions' ? 'confidence' : 'name',
      sortDirection: context === 'predictions' ? 'desc' : 'asc',
      showOnlyAvailable: context === 'predictions',
      patternSearch: ''
    };
    setFilters(clearedFilters);
    onFiltersChange?.(clearedFilters);
  }, [onFiltersChange, context]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filters.positions.length > 0 ||
           filters.teams.length > 0 ||
           filters.searchTerm.trim() !== '' ||
           filters.patternSearch.trim() !== '' ||
           filters.startSeason !== '' ||
           filters.endSeason !== '' ||
           filters.minConfidence > 0 ||
           filters.maxConfidence < 100 ||
           filters.minRound > 1 ||
           filters.maxRound < 20 ||
           (context === 'predictions' && !filters.showOnlyAvailable);
  }, [filters, context]);

  return (
    <div className={` border border-gray-200 rounded-lg p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Filters & Sorting</h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Position Filter */}
        {showPositionFilter && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-200 uppercase tracking-wide">
              Positions
            </label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {availablePositions.map(position => (
                <label key={position} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.positions.includes(position)}
                    onChange={(e) => handlePositionChange(position, e.target.checked)}
                    className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-200">{position}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Team Filter */}
        {showTeamFilter && availableTeams.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-200 uppercase tracking-wide">
              Teams
            </label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {availableTeams.map(team => (
                <label key={team} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.teams.includes(team)}
                    onChange={(e) => handleTeamChange(team, e.target.checked)}
                    className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-200">{team}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Search Filter */}
        {showSearchFilter && (
          <div className="space-y-2">
            <label htmlFor="search-filter" className="text-xs font-medium text-gray-200 uppercase tracking-wide">
              Search Players
            </label>
            <div className="space-y-2">
              <div className="relative">
                <input
                  id="search-filter"
                  type="text"
                  placeholder="Search by name, team..."
                  value={filters.searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {filters.searchTerm && (
                  <button
                    onClick={() => handleSearchChange('')}
                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Pattern Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search patterns (e.g., 'RB early', 'late round')"
                  value={filters.patternSearch}
                  onChange={(e) => handlePatternSearchChange(e.target.value)}
                  className="w-full px-3 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {filters.patternSearch && (
                  <button
                    onClick={() => handlePatternSearchChange('')}
                    className="absolute right-1 top-1 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Date Range Filter */}
        {showDateRangeFilter && availableSeasons.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-200 uppercase tracking-wide">
              Season Range
            </label>
            <div className="space-y-2">
              <select
                value={filters.startSeason}
                onChange={(e) => handleDateRangeChange('startSeason', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">From season...</option>
                {availableSeasons.map(season => (
                  <option key={season} value={season}>{season}</option>
                ))}
              </select>
              <select
                value={filters.endSeason}
                onChange={(e) => handleDateRangeChange('endSeason', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">To season...</option>
                {availableSeasons.map(season => (
                  <option key={season} value={season}>{season}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Sort Options */}
        {showSortOptions && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-200 uppercase tracking-wide">
              Sort By
            </label>
            <div className="space-y-2">
              <select
                value={filters.sortBy}
                onChange={(e) => handleSortChange(e.target.value, filters.sortDirection)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {sortOptions.map(option => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
              <div className="flex space-x-1">
                <button
                  onClick={() => handleSortChange(filters.sortBy, 'asc')}
                  className={`flex-1 px-2 py-1 text-xs rounded ${
                    filters.sortDirection === 'asc'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-200 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  ↑ Asc
                </button>
                <button
                  onClick={() => handleSortChange(filters.sortBy, 'desc')}
                  className={`flex-1 px-2 py-1 text-xs rounded ${
                    filters.sortDirection === 'desc'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-200 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  ↓ Desc
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-200 uppercase tracking-wide">
              Advanced
            </label>
            <div className="space-y-2">
              {/* Confidence Range (for predictions) */}
              {context === 'predictions' && (
                <div className="space-y-1">
                  <label className="text-xs text-gray-600">Confidence Range</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.minConfidence}
                      onChange={(e) => handleRangeChange('minConfidence', e.target.value)}
                      className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-500 w-8">{filters.minConfidence}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.maxConfidence}
                      onChange={(e) => handleRangeChange('maxConfidence', e.target.value)}
                      className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs text-gray-500 w-8">{filters.maxConfidence}%</span>
                  </div>
                </div>
              )}

              {/* Round Range */}
              <div className="space-y-1">
                <label className="text-xs text-gray-600">Round Range</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={filters.minRound}
                    onChange={(e) => handleRangeChange('minRound', e.target.value)}
                    className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Min"
                  />
                  <span className="text-xs text-gray-500">to</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={filters.maxRound}
                    onChange={(e) => handleRangeChange('maxRound', e.target.value)}
                    className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Show Only Available (for predictions) */}
              {context === 'predictions' && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.showOnlyAvailable}
                    onChange={(e) => handleCheckboxChange('showOnlyAvailable', e.target.checked)}
                    className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-xs text-gray-200">Show only available players</span>
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="pt-2 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {filters.positions.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Positions: {filters.positions.join(', ')}
              </span>
            )}
            {filters.searchTerm.trim() && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Search: "{filters.searchTerm}"
              </span>
            )}
            {(filters.startSeason || filters.endSeason) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Seasons: {filters.startSeason || 'All'} - {filters.endSeason || 'All'}
              </span>
            )}
            {filters.patternSearch.trim() && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                Pattern: "{filters.patternSearch}"
              </span>
            )}
            {(filters.minConfidence > 0 || filters.maxConfidence < 100) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                Confidence: {filters.minConfidence}%-{filters.maxConfidence}%
              </span>
            )}
            {(filters.minRound > 1 || filters.maxRound < 20) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                Rounds: {filters.minRound}-{filters.maxRound}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for managing filter state persistence across components
export function useFilterState(initialFilters = {}, storageKey = 'draftAnalyticsFilters') {
  const [filters, setFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(storageKey);
        return stored ? { ...initialFilters, ...JSON.parse(stored) } : initialFilters;
      } catch (error) {
        console.warn('Failed to load stored filters:', error);
        return initialFilters;
      }
    }
    return initialFilters;
  });

  // Save filters to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(filters));
      } catch (error) {
        console.warn('Failed to save filters:', error);
      }
    }
  }, [filters, storageKey]);

  return [filters, setFilters];
}

// Utility function to apply filters to data
export function applyFilters(data, filters) {
  if (!data || !Array.isArray(data)) return [];

  let filteredData = [...data];

  // Apply position filter
  if (filters.positions && filters.positions.length > 0) {
    filteredData = filteredData.filter(item => 
      filters.positions.includes(item.position)
    );
  }

  // Apply team filter
  if (filters.teams && filters.teams.length > 0) {
    filteredData = filteredData.filter(item => 
      filters.teams.includes(item.team)
    );
  }

  // Apply search filter
  if (filters.searchTerm && filters.searchTerm.trim()) {
    const searchLower = filters.searchTerm.toLowerCase();
    filteredData = filteredData.filter(item => {
      const name = (item.playerName || item.name || '').toLowerCase();
      const position = (item.position || '').toLowerCase();
      const team = (item.team || '').toLowerCase();
      return name.includes(searchLower) || 
             position.includes(searchLower) || 
             team.includes(searchLower);
    });
  }

  // Apply pattern search filter
  if (filters.patternSearch && filters.patternSearch.trim()) {
    const patternLower = filters.patternSearch.toLowerCase();
    filteredData = filteredData.filter(item => {
      // Search in various fields that might contain patterns
      const reasoning = (item.reasoning || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      const position = (item.position || '').toLowerCase();
      const round = item.round || item.avgRound || item.averageRound;
      
      // Pattern matching for common draft terms
      let patternMatch = reasoning.includes(patternLower) || 
                        description.includes(patternLower) || 
                        notes.includes(patternLower);
      
      // Special pattern matching for draft-specific terms
      if (patternLower.includes('early') && round && round <= 5) patternMatch = true;
      if (patternLower.includes('late') && round && round >= 10) patternMatch = true;
      if (patternLower.includes('middle') && round && round > 5 && round < 10) patternMatch = true;
      if (patternLower.includes(position)) patternMatch = true;
      
      return patternMatch;
    });
  }

  // Apply season range filter
  if (filters.startSeason || filters.endSeason) {
    filteredData = filteredData.filter(item => {
      const itemSeason = item.season || item.year;
      if (!itemSeason) return true; // Include items without season data
      
      const season = parseInt(itemSeason);
      const startSeason = filters.startSeason ? parseInt(filters.startSeason) : null;
      const endSeason = filters.endSeason ? parseInt(filters.endSeason) : null;
      
      if (startSeason && season < startSeason) return false;
      if (endSeason && season > endSeason) return false;
      return true;
    });
  }

  // Apply confidence range filter (for predictions)
  if (filters.minConfidence > 0 || filters.maxConfidence < 100) {
    filteredData = filteredData.filter(item => {
      const confidence = item.confidence || 0;
      return confidence >= filters.minConfidence && confidence <= filters.maxConfidence;
    });
  }

  // Apply round range filter
  if (filters.minRound > 1 || filters.maxRound < 20) {
    filteredData = filteredData.filter(item => {
      const round = item.round || item.avgRound || item.averageRound;
      if (!round) return true; // Include items without round data
      return round >= filters.minRound && round <= filters.maxRound;
    });
  }

  // Apply "show only available" filter (for predictions)
  if (filters.showOnlyAvailable && filters.showOnlyAvailable === true) {
    filteredData = filteredData.filter(item => 
      item.isAvailable !== false // Include items that are available or don't have availability info
    );
  }

  // Apply sorting
  if (filters.sortBy) {
    filteredData.sort((a, b) => {
      let aValue = a[filters.sortBy];
      let bValue = b[filters.sortBy];

      // Handle different data types
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue || '').toLowerCase();
      } else if (typeof aValue === 'number') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      } else {
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return filters.sortDirection === 'desc' ? -comparison : comparison;
    });
  }

  return filteredData;
}

// Utility function for advanced pattern matching
export function matchesPattern(item, pattern) {
  if (!pattern || !pattern.trim()) return true;
  
  const patternLower = pattern.toLowerCase();
  const tokens = patternLower.split(/\s+/);
  
  // Get searchable fields from the item
  const searchableText = [
    item.playerName || item.name || '',
    item.position || '',
    item.team || '',
    item.reasoning || '',
    item.description || '',
    item.notes || ''
  ].join(' ').toLowerCase();
  
  // Check if all tokens match
  const allTokensMatch = tokens.every(token => {
    // Direct text match
    if (searchableText.includes(token)) return true;
    
    // Pattern-specific matches
    const round = item.round || item.avgRound || item.averageRound;
    
    // Round-based patterns
    if (token === 'early' && round && round <= 5) return true;
    if (token === 'late' && round && round >= 10) return true;
    if (token === 'middle' && round && round > 5 && round < 10) return true;
    if (token === 'first' && round && round === 1) return true;
    if (token === 'second' && round && round === 2) return true;
    
    // Confidence-based patterns (for predictions)
    const confidence = item.confidence || 0;
    if (token === 'high' && confidence >= 80) return true;
    if (token === 'medium' && confidence >= 60 && confidence < 80) return true;
    if (token === 'low' && confidence < 60) return true;
    
    // Frequency-based patterns
    const count = item.draftCount || item.count || 0;
    if (token === 'frequent' && count >= 3) return true;
    if (token === 'rare' && count === 1) return true;
    
    return false;
  });
  
  return allTokensMatch;
}

// Utility function to get filter suggestions based on data
export function getFilterSuggestions(data, context = 'general') {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      positions: [],
      teams: [],
      seasons: [],
      patterns: []
    };
  }
  
  const positions = [...new Set(data.map(item => item.position).filter(Boolean))].sort();
  const teams = [...new Set(data.map(item => item.team).filter(Boolean))].sort();
  const seasons = [...new Set(data.map(item => item.season || item.year).filter(Boolean))].sort((a, b) => b - a);
  
  // Generate pattern suggestions based on context
  let patterns = [];
  if (context === 'predictions') {
    patterns = ['high confidence', 'low confidence', 'early round', 'late round', 'RB heavy', 'WR heavy'];
  } else if (context === 'analytics') {
    patterns = ['frequent picks', 'rare picks', 'early round', 'late round', 'consistent', 'trending'];
  }
  
  return {
    positions,
    teams,
    seasons,
    patterns
  };
}