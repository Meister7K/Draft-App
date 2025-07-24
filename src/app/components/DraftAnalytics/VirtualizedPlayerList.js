/**
 * VirtualizedPlayerList Component
 * Provides virtualized scrolling for large player lists to improve performance
 * Enhanced with improved virtualization, lazy loading, and performance optimizations
 */

"use client";

import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { 
  useVirtualScrolling, 
  useEnhancedVirtualization,
  useIntersectionObserver,
  useDebounce,
  useOptimizedEventHandler
} from './utils/performanceOptimizations.js';

export function VirtualizedPlayerList({
  players = [],
  itemHeight = 60,
  containerHeight = 400,
  overscan = 5,
  onPlayerClick,
  renderPlayer,
  className = "",
  emptyMessage = "No players available",
  enableSearch = false,
  searchPlaceholder = "Search players...",
  enableLazyLoading = true,
  lazyLoadThreshold = 100
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);

  // Debounce search term to prevent excessive filtering
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Filter players based on search term (memoized)
  const filteredPlayers = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return players;
    
    const searchLower = debouncedSearchTerm.toLowerCase();
    return players.filter(player => {
      const name = (player.playerName || player.name || '').toLowerCase();
      const position = (player.position || '').toLowerCase();
      const team = (player.team || '').toLowerCase();
      
      return name.includes(searchLower) || 
             position.includes(searchLower) || 
             team.includes(searchLower);
    });
  }, [players, debouncedSearchTerm]);

  // Use enhanced virtual scrolling hook
  const {
    visibleItems,
    totalHeight,
    handleScroll,
    startIndex,
    endIndex,
    visibleCount,
    isScrolling,
    scrollToItem,
    containerRef
  } = useEnhancedVirtualization(filteredPlayers, itemHeight, containerHeight, {
    overscan,
    enableSmoothScrolling: true,
    bufferSize: 10,
    scrollThrottleDelay: 16
  });

  // Optimized search handler
  const handleSearchChange = useOptimizedEventHandler(
    (event) => {
      const value = event.target.value;
      setSearchTerm(value);
      setIsSearching(value.length > 0);
    },
    [setSearchTerm, setIsSearching],
    { debounce: true, delay: 200 }
  );

  // Optimized player click handler
  const handlePlayerClick = useCallback((player) => {
    if (onPlayerClick) {
      onPlayerClick(player);
    }
  }, [onPlayerClick]);

  // Enhanced player renderer with lazy loading support
  const LazyPlayerItem = useCallback(({ player, index, isVisible }) => {
    const [ref, isIntersecting] = useIntersectionObserver({
      threshold: 0.1,
      rootMargin: '50px'
    });

    // Only render content if visible or intersecting (for lazy loading)
    const shouldRender = !enableLazyLoading || isVisible || isIntersecting;

    if (!shouldRender) {
      return (
        <div
          ref={ref}
          className="flex items-center justify-center p-3 border-b border-gray-200"
          style={{ height: itemHeight }}
        >
          <div className="animate-pulse bg-gray-200 rounded w-full h-8"></div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="flex items-center justify-between p-3 border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150"
        onClick={() => handlePlayerClick(player)}
        style={{ cursor: onPlayerClick ? 'pointer' : 'default' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {player.playerName || player.name || 'Unknown Player'}
          </p>
          <p className="text-sm text-gray-500">
            {player.position} • {player.team || 'Unknown Team'}
            {player.draftCount && (
              <span> • Drafted {player.draftCount} times</span>
            )}
          </p>
        </div>
        {player.avgRound && (
          <div className="text-sm text-gray-500">
            Avg Round: {player.avgRound.toFixed(1)}
          </div>
        )}
      </div>
    );
  }, [enableLazyLoading, itemHeight, handlePlayerClick, onPlayerClick]);

  // Default player renderer
  const defaultRenderPlayer = useCallback((player, index, isVisible) => {
    if (renderPlayer) {
      return renderPlayer(player, index);
    }
    return <LazyPlayerItem player={player} index={index} isVisible={isVisible} />;
  }, [renderPlayer, LazyPlayerItem]);

  // Memoized visible items rendering with enhanced performance
  const renderedItems = useMemo(() => {
    return visibleItems.map(({ item, index, top, isVisible }) => (
      <div
        key={item.playerId || item.player_id || index}
        style={{
          position: 'absolute',
          top: `${top}px`,
          left: 0,
          right: 0,
          height: `${itemHeight}px`
        }}
      >
        {defaultRenderPlayer(item, index, isVisible)}
      </div>
    ));
  }, [visibleItems, itemHeight, defaultRenderPlayer]);

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setIsSearching(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  if (!players || players.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`} style={{ height: containerHeight }}>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  if (filteredPlayers.length === 0 && debouncedSearchTerm) {
    return (
      <div className={`relative ${className}`}>
        {/* Search Input */}
        {enableSearch && (
          <div className="mb-3 relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        
        <div className="flex flex-col items-center justify-center border border-gray-200 rounded-lg" style={{ height: containerHeight }}>
          <p className="text-gray-500">No players found matching "{debouncedSearchTerm}"</p>
          <button
            onClick={clearSearch}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Clear search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      {enableSearch && (
        <div className="mb-3 relative">
          <input
            ref={searchInputRef}
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Virtual scroll container */}
      <div
        ref={containerRef}
        className={`overflow-auto border border-gray-200 rounded-lg ${isScrolling ? 'pointer-events-none' : ''}`}
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        {/* Total height spacer */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {renderedItems}
        </div>
      </div>

      {/* Enhanced status bar */}
      <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
        <span>
          Showing {startIndex + 1}-{Math.min(endIndex, filteredPlayers.length)} of {filteredPlayers.length} players
          {debouncedSearchTerm && ` (filtered from ${players.length})`}
        </span>
        <div className="flex items-center space-x-2">
          <span>{visibleCount} visible</span>
          {isScrolling && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
              Scrolling
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * VirtualizedTable Component
 * Provides virtualized table for large datasets with enhanced performance
 */
export function VirtualizedTable({
  data = [],
  columns = [],
  itemHeight = 50,
  containerHeight = 400,
  overscan = 5,
  onRowClick,
  className = "",
  emptyMessage = "No data available",
  enableSorting = false,
  enableFiltering = false,
  stickyHeader = true
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filters, setFilters] = useState({});

  // Apply sorting and filtering (memoized)
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply filters
    if (enableFiltering && Object.keys(filters).length > 0) {
      result = result.filter(item => {
        return Object.entries(filters).every(([key, filterValue]) => {
          if (!filterValue) return true;
          const itemValue = String(item[key] || '').toLowerCase();
          const filter = String(filterValue).toLowerCase();
          return itemValue.includes(filter);
        });
      });
    }

    // Apply sorting
    if (enableSorting && sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, filters, sortConfig, enableFiltering, enableSorting]);

  // Use enhanced virtual scrolling hook
  const {
    visibleItems,
    totalHeight,
    handleScroll,
    startIndex,
    endIndex,
    isScrolling,
    containerRef
  } = useEnhancedVirtualization(processedData, itemHeight, containerHeight, {
    overscan,
    enableSmoothScrolling: true,
    bufferSize: 5,
    scrollThrottleDelay: 16
  });

  // Optimized sort handler
  const handleSort = useCallback((columnKey) => {
    if (!enableSorting) return;
    
    setSortConfig(prevConfig => ({
      key: columnKey,
      direction: prevConfig.key === columnKey && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, [enableSorting]);

  // Optimized filter handler
  const handleFilterChange = useCallback((columnKey, value) => {
    if (!enableFiltering) return;
    
    setFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  }, [enableFiltering]);

  // Optimized row click handler
  const handleRowClick = useCallback((item, index) => {
    if (onRowClick) {
      onRowClick(item, index);
    }
  }, [onRowClick]);

  // Enhanced table header with sorting and filtering
  const renderHeader = useMemo(() => (
    <div className={`${stickyHeader ? 'sticky top-0' : ''} bg-gray-50 border-b border-gray-200 z-10`}>
      {/* Column Headers */}
      <div className="flex" style={{ height: itemHeight }}>
        {columns.map((column, index) => (
          <div
            key={column.key || index}
            className={`flex items-center px-3 py-2 text-xs font-medium text-gray-500 uppercase ${column.className || ''} ${
              enableSorting && column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''
            }`}
            style={{ 
              width: column.width || `${100 / columns.length}%`,
              minWidth: column.minWidth || 'auto'
            }}
            onClick={() => enableSorting && column.sortable !== false && handleSort(column.key)}
          >
            <span className="flex items-center">
              {column.header}
              {enableSorting && column.sortable !== false && sortConfig.key === column.key && (
                <svg 
                  className={`ml-1 h-3 w-3 transform ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              )}
            </span>
          </div>
        ))}
      </div>
      
      {/* Filter Row */}
      {enableFiltering && (
        <div className="flex border-t border-gray-200 " style={{ height: itemHeight }}>
          {columns.map((column, index) => (
            <div
              key={`filter-${column.key || index}`}
              className="flex items-center px-2 py-1"
              style={{ 
                width: column.width || `${100 / columns.length}%`,
                minWidth: column.minWidth || 'auto'
              }}
            >
              {column.filterable !== false && (
                <input
                  type="text"
                  placeholder={`Filter ${column.header}...`}
                  value={filters[column.key] || ''}
                  onChange={(e) => handleFilterChange(column.key, e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  ), [columns, itemHeight, stickyHeader, enableSorting, enableFiltering, sortConfig, filters, handleSort, handleFilterChange]);

  // Render table rows
  const renderedRows = useMemo(() => {
    return visibleItems.map(({ item, index, top }) => (
      <div
        key={item.id || index}
        className="flex border-b border-gray-200 hover:bg-gray-50"
        style={{
          position: 'absolute',
          top: `${top + itemHeight}px`, // Account for header height
          left: 0,
          right: 0,
          height: `${itemHeight}px`,
          cursor: onRowClick ? 'pointer' : 'default'
        }}
        onClick={() => onRowClick?.(item, index)}
      >
        {columns.map((column, colIndex) => (
          <div
            key={column.key || colIndex}
            className={`flex items-center px-3 py-2 text-sm ${column.className || ''}`}
            style={{ 
              width: column.width || `${100 / columns.length}%`,
              minWidth: column.minWidth || 'auto'
            }}
          >
            {column.render ? column.render(item[column.key], item, index) : item[column.key]}
          </div>
        ))}
      </div>
    ));
  }, [visibleItems, columns, itemHeight, onRowClick]);

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center border border-gray-200 rounded-lg ${className}`} style={{ height: containerHeight }}>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Virtual table container */}
      <div
        className="overflow-auto border border-gray-200 rounded-lg"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        {renderHeader}
        {/* Total height spacer */}
        <div style={{ height: totalHeight + itemHeight, position: 'relative' }}>
          {renderedRows}
        </div>
      </div>

      {/* Status bar */}
      <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
        <span>
          Showing {startIndex + 1}-{Math.min(endIndex, data.length)} of {data.length} rows
        </span>
      </div>
    </div>
  );
}