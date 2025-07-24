/**
 * PredictionEngine Display Component
 * Provides draft prediction interface and results display
 * Optimized with React.useMemo, React.useCallback, debouncing, and virtualization
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { HistoricalDataManager } from './HistoricalData.js';
import { 
  generatePredictionRanking, 
  filterAvailablePlayers,
  validatePredictionInputs 
} from './utils/index.js';
import { 
  useDebounce, 
  useDebouncedCallback, 
  useExpensiveMemo,
  useProgressiveLoading,
  useVirtualScrolling,
  usePerformanceMonitor,
  useOptimizedEventHandler
} from './utils/performanceOptimizations.js';
import { FilterControls, useFilterState, applyFilters } from './FilterControls.js';

export function PredictionEngine({
  managerId,
  draftPosition: initialDraftPosition,
  historicalData,
  availablePlayers,
  leagueUsers,
  leagueContext = {},
  onManagerChange,
  onDraftPositionChange,
  sharedFilters,
  onSharedFiltersChange,
  // New props for better integration
  hoveredPlayer,
  setHoveredPlayer,
  tooltipPosition,
  setTooltipPosition,
  isDraftActive,
  currentDraftInfo,
  user
}) {
  const [selectedManagerId, setSelectedManagerId] = useState(managerId);
  const [draftPosition, setDraftPosition] = useState(initialDraftPosition || 1);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [managerData, setManagerData] = useState(null);
  const [expandedPrediction, setExpandedPrediction] = useState(null);
  const [dataManager] = useState(() => new HistoricalDataManager());

  // Filter state with persistence across tab switches
  const [filters, setFilters] = useFilterState({
    positions: [],
    teams: [],
    searchTerm: '',
    startSeason: '',
    endSeason: '',
    minConfidence: 0,
    maxConfidence: 100,
    minRound: 1,
    maxRound: 20,
    sortBy: 'confidence',
    sortDirection: 'desc',
    showOnlyAvailable: true,
    patternSearch: ''
  }, `predictionEngine_${managerId || 'default'}`);

  // Performance monitoring
  const performanceMetrics = usePerformanceMonitor('PredictionEngine', [
    selectedManagerId, 
    draftPosition, 
    predictions.length
  ]);

  // Debounce inputs to prevent excessive calculations
  const debouncedManagerId = useDebounce(selectedManagerId, 300);
  const debouncedDraftPosition = useDebounce(draftPosition, 500);

  // Load manager data when debounced manager ID changes
  useEffect(() => {
    const loadManagerData = async () => {
      console.log('[PredictionEngine] loadManagerData called with:', {
        debouncedManagerId,
        hasDataManager: !!dataManager
      });

      if (!debouncedManagerId) {
        console.log('[PredictionEngine] No debouncedManagerId, clearing data');
        setManagerData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        console.log('[PredictionEngine] Calling dataManager.loadManagerData...');
        const data = await dataManager.loadManagerData(debouncedManagerId);
        console.log('[PredictionEngine] Received data from dataManager:', {
          hasData: !!data,
          dataKeys: data ? Object.keys(data) : null,
          picksCount: data?.picks?.length || 0
        });
        setManagerData(data);
      } catch (err) {
        console.error('[PredictionEngine] Error loading manager data:', err);
        setError(`Failed to load data for manager: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadManagerData();
  }, [debouncedManagerId, dataManager]);

  // Generate predictions when inputs change
  useEffect(() => {
    console.log('[PredictionEngine] Generate predictions effect triggered:', {
      selectedManagerId,
      hasManagerData: !!managerData,
      managerDataKeys: managerData ? Object.keys(managerData) : null,
      picksCount: managerData?.picks?.length || 0,
      hasAvailablePlayers: !!availablePlayers,
      availablePlayersCount: availablePlayers?.length || 0
    });

    if (!selectedManagerId || !managerData || !availablePlayers || availablePlayers.length === 0) {
      console.log('[PredictionEngine] Missing required data, clearing predictions');
      setPredictions([]);
      return;
    }

    const generatePredictions = () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[PredictionEngine] Generating predictions with data:', {
          managerDataPicks: managerData.picks?.length || 0,
          availablePlayersCount: availablePlayers.length
        });

        // Validate inputs
        const validation = validatePredictionInputs({
          managerId: selectedManagerId,
          draftPosition,
          availablePlayers,
          historicalData: managerData
        });

        if (!validation.isValid) {
          throw new Error(`Invalid inputs: ${validation.errors.join(', ')}`);
        }

        // Generate predictions
        const newPredictions = generatePredictionRanking(
          selectedManagerId,
          draftPosition,
          managerData,
          availablePlayers,
          leagueContext
        );

        console.log('[PredictionEngine] Generated predictions:', {
          predictionsCount: newPredictions.length,
          samplePrediction: newPredictions[0] || null
        });

        setPredictions(newPredictions);
      } catch (err) {
        console.error('[PredictionEngine] Error generating predictions:', err);
        setError(`Failed to generate predictions: ${err.message}`);
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce prediction generation to avoid excessive calculations
    const timeoutId = setTimeout(generatePredictions, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedManagerId, draftPosition, managerData, availablePlayers, leagueContext]);

  // Handle manager selection change
  const handleManagerChange = useCallback((newManagerId) => {
    setSelectedManagerId(newManagerId);
    setExpandedPrediction(null);
    if (onManagerChange) {
      onManagerChange(newManagerId);
    }
  }, [onManagerChange]);

  // Handle draft position change
  const handleDraftPositionChange = useCallback((newPosition) => {
    const position = Math.max(1, Math.min(300, parseInt(newPosition) || 1));
    setDraftPosition(position);
    setExpandedPrediction(null);
    if (onDraftPositionChange) {
      onDraftPositionChange(position);
    }
  }, [onDraftPositionChange]);

  // Get selected manager info
  const selectedManager = useMemo(() => {
    if (!selectedManagerId || !leagueUsers) return null;
    return leagueUsers.find(user => user.user_id === selectedManagerId);
  }, [selectedManagerId, leagueUsers]);

  // Calculate current round and position in round
  const roundInfo = useMemo(() => {
    const totalTeams = leagueContext.totalTeams || 12;
    const round = Math.ceil(draftPosition / totalTeams);
    const positionInRound = ((draftPosition - 1) % totalTeams) + 1;
    return { round, positionInRound, totalTeams };
  }, [draftPosition, leagueContext.totalTeams]);

  // Data quality assessment
  const dataQuality = useMemo(() => {
    if (!managerData || !managerData.picks) {
      return { quality: 'none', score: 0, message: 'No historical data available' };
    }

    const pickCount = managerData.picks.length;
    const seasonCount = managerData.seasons?.length || 0;

    if (pickCount < 5) {
      return { 
        quality: 'insufficient', 
        score: 20, 
        message: `Only ${pickCount} historical picks available. Predictions may be unreliable.` 
      };
    } else if (pickCount < 20 || seasonCount < 2) {
      return { 
        quality: 'limited', 
        score: 60, 
        message: `Limited data (${pickCount} picks, ${seasonCount} seasons). Predictions have moderate reliability.` 
      };
    } else {
      return { 
        quality: 'good', 
        score: 90, 
        message: `Good data quality (${pickCount} picks, ${seasonCount} seasons). Predictions are reliable.` 
      };
    }
  }, [managerData]);

  // Extract available positions for filtering
  const availablePositions = useMemo(() => {
    if (!availablePlayers) return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const positions = new Set(availablePlayers.map(player => 
      player.player_info?.position || player.position
    ).filter(Boolean));
    return Array.from(positions).sort();
  }, [availablePlayers]);

  // Apply filters to predictions
  const filteredPredictions = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];
    
    let filtered = [...predictions];

    // Apply position filter
    if (filters.positions && filters.positions.length > 0) {
      filtered = filtered.filter(prediction => 
        filters.positions.includes(prediction.position)
      );
    }

    // Apply search filter
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(prediction => {
        const name = (prediction.playerName || '').toLowerCase();
        const position = (prediction.position || '').toLowerCase();
        const team = (prediction.team || '').toLowerCase();
        return name.includes(searchLower) || 
               position.includes(searchLower) || 
               team.includes(searchLower);
      });
    }

    // Apply confidence range filter
    if (filters.minConfidence > 0 || filters.maxConfidence < 100) {
      filtered = filtered.filter(prediction => 
        prediction.confidence >= filters.minConfidence && 
        prediction.confidence <= filters.maxConfidence
      );
    }

    // Apply pattern search
    if (filters.patternSearch && filters.patternSearch.trim()) {
      const patternLower = filters.patternSearch.toLowerCase();
      filtered = filtered.filter(prediction => {
        const reasoning = (prediction.reasoning || '').toLowerCase();
        return reasoning.includes(patternLower);
      });
    }

    // Apply sorting
    if (filters.sortBy) {
      filtered.sort((a, b) => {
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

    return filtered;
  }, [predictions, filters]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setExpandedPrediction(null); // Close expanded prediction when filters change
  }, [setFilters]);

  // Get confidence level styling
  const getConfidenceStyle = (confidence) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (confidence >= 40) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  // Get confidence level text
  const getConfidenceText = (confidence) => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    if (confidence >= 40) return 'Low';
    return 'Very Low';
  };

  if (loading && !predictions.length) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Draft Predictions</h2>
        
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Manager Selection */}
          <div className="flex items-center space-x-2">
            <label htmlFor="prediction-manager-select" className="text-sm font-medium text-gray-200 whitespace-nowrap">
              Manager:
            </label>
            <select
              id="prediction-manager-select"
              value={selectedManagerId || ''}
              onChange={(e) => handleManagerChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
            >
              <option value="">Choose manager...</option>
              {leagueUsers?.map(user => (
                <option key={user.user_id} value={user.user_id}>
                  {user.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Draft Position Input */}
          <div className="flex items-center space-x-2">
            <label htmlFor="draft-position-input" className="text-sm font-medium text-gray-200 whitespace-nowrap">
              Pick #:
            </label>
            <input
              id="draft-position-input"
              type="number"
              min="1"
              max="300"
              value={draftPosition}
              onChange={(e) => handleDraftPositionChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-20"
            />
            <span className="text-sm text-gray-500">
              (Round {roundInfo.round}, Pick {roundInfo.positionInRound})
            </span>
          </div>
        </div>
      </div>

      {/* No Manager Selected */}
      {!selectedManagerId && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-500">Select a manager to generate draft predictions</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Prediction Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Data Quality Indicator */}
      {selectedManagerId && dataQuality && (
        <div className={`p-4 rounded-lg border ${
          dataQuality.quality === 'good' ? 'bg-green-50 border-green-200' :
          dataQuality.quality === 'limited' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {dataQuality.quality === 'good' ? (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : dataQuality.quality === 'limited' ? (
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                dataQuality.quality === 'good' ? 'text-green-800' :
                dataQuality.quality === 'limited' ? 'text-yellow-800' :
                'text-red-800'
              }`}>
                Data Quality: {dataQuality.quality === 'good' ? 'Good' : dataQuality.quality === 'limited' ? 'Limited' : 'Insufficient'}
              </p>
              <p className={`text-sm mt-1 ${
                dataQuality.quality === 'good' ? 'text-green-700' :
                dataQuality.quality === 'limited' ? 'text-yellow-700' :
                'text-red-700'
              }`}>
                {dataQuality.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      {selectedManagerId && predictions.length > 0 && (
        <FilterControls
          onFiltersChange={handleFiltersChange}
          availablePositions={availablePositions}
          availableSeasons={[]}
          showPositionFilter={true}
          showDateRangeFilter={false}
          showSearchFilter={true}
          showSortOptions={true}
          showTeamFilter={false}
          showAdvancedFilters={true}
          sortOptions={[
            { key: 'confidence', label: 'Confidence' },
            { key: 'playerName', label: 'Player Name' },
            { key: 'position', label: 'Position' },
            { key: 'team', label: 'Team' }
          ]}
          initialFilters={filters}
          context="predictions"
          className="mb-6"
        />
      )}

      {/* Predictions Results */}
      {selectedManagerId && predictions.length > 0 && (
        <div className=" rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Predictions for {selectedManager?.display_name} at Pick #{draftPosition}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Showing {Math.min(filteredPredictions.length, 20)} of {predictions.length} predictions based on historical patterns
                </p>
              </div>
              {filteredPredictions.length !== predictions.length && (
                <div className="text-sm text-blue-600">
                  {filteredPredictions.length} filtered results
                </div>
              )}
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {filteredPredictions.slice(0, 20).map((prediction, index) => (
              <div key={prediction.playerId} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {prediction.playerName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {prediction.position} • {prediction.team}
                          {prediction.playerData?.overallRank && (
                            <span> • Overall #{prediction.playerData.overallRank}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceStyle(prediction.confidence)}`}>
                      {getConfidenceText(prediction.confidence)} ({prediction.confidence}%)
                    </div>
                    
                    <button
                      onClick={() => setExpandedPrediction(
                        expandedPrediction === prediction.playerId ? null : prediction.playerId
                      )}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg 
                        className={`h-5 w-5 transform transition-transform ${
                          expandedPrediction === prediction.playerId ? 'rotate-180' : ''
                        }`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {expandedPrediction === prediction.playerId && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Reasoning */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Prediction Reasoning</h4>
                        <p className="text-sm text-gray-600">{prediction.reasoning}</p>
                      </div>
                      
                      {/* Historical Basis */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Historical Basis</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          {prediction.historicalBasis?.positionFrequency && (
                            <p>
                              {prediction.position} drafted {prediction.historicalBasis.positionFrequency.percentage.toFixed(1)}% of the time
                            </p>
                          )}
                          {prediction.historicalBasis?.similarPicks > 0 && (
                            <p>Based on {prediction.historicalBasis.similarPicks} similar historical picks</p>
                          )}
                          {prediction.historicalBasis?.roundType && (
                            <p>Typical {prediction.historicalBasis.roundType}-round selection pattern</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Confidence Factors */}
                    {prediction.factors && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Confidence Factors</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          {Object.entries(prediction.factors).map(([factor, value]) => (
                            <div key={factor} className="bg-gray-50 px-2 py-1 rounded">
                              <span className="capitalize">{factor.replace(/([A-Z])/g, ' $1').trim()}: </span>
                              <span className="font-medium">{Math.round(value || 0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Predictions Available */}
      {selectedManagerId && !loading && !error && (
        <>
          {predictions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-gray-500">No predictions available</p>
              <p className="text-sm text-gray-400 mt-1">
                {!availablePlayers || availablePlayers.length === 0 
                  ? 'No available players to predict from'
                  : 'Insufficient historical data for reliable predictions'
                }
              </p>
            </div>
          ) : predictions.length > 0 && filteredPredictions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <p className="text-gray-500">No predictions match your filters</p>
              <p className="text-sm text-gray-400 mt-1">
                Try adjusting your position, confidence, or search filters
              </p>
            </div>
          ) : null}
        </>
      )}

      {/* Loading Overlay */}
      {loading && predictions.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className=" rounded-lg p-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-200">Updating predictions...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}