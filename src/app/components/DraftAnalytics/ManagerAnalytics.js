/**
 * ManagerAnalytics Display Component
 * Provides comprehensive statistical analysis and visualization for individual managers
 * Optimized with React.useMemo, React.useCallback, and performance monitoring
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";

// Dynamically import Chart.js components to avoid SSR issues
const Pie = dynamic(
  () => import("react-chartjs-2").then((mod) => ({ default: mod.Pie })),
  { ssr: false }
);
const Bar = dynamic(
  () => import("react-chartjs-2").then((mod) => ({ default: mod.Bar })),
  { ssr: false }
);
const Line = dynamic(
  () => import("react-chartjs-2").then((mod) => ({ default: mod.Line })),
  { ssr: false }
);
import { FilterControls } from "./FilterControls.js";
import { HistoricalDataManager } from "./HistoricalData.js";
import { VirtualizedTable } from "./VirtualizedPlayerList.js";
import { StatisticalInsights } from "./StatisticalInsights.js";

// Register Chart.js components including LineElement and PointElement for trend charts
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Filler,
} from "chart.js";
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Filler
);

export function ManagerAnalytics({
  managerId,
  historicalData,
  currentDraft,
  availablePlayers,
  leagueUsers,
  onManagerChange,
  leagueId,
  data,
  sharedFilters,
  onSharedFiltersChange,
  // New props for better integration
  hoveredPlayer,
  setHoveredPlayer,
  tooltipPosition,
  setTooltipPosition,
  isDraftActive,
  currentDraftInfo,
  user,
}) {
  console.log("[ManagerAnalytics] Component initialized with props:", {
    managerId,
    hasHistoricalData: !!historicalData,
    hasData: !!data,
    hasLeagueUsers: !!leagueUsers,
    leagueUsersCount: leagueUsers?.length || 0,
    hasAvailablePlayers: !!availablePlayers,
    availablePlayersCount: availablePlayers?.length || 0,
    userObject: user,
    leagueUsersFirst3: leagueUsers?.slice(0, 3)
  });
  
  console.log("[ManagerAnalytics] Historical data source check:", {
    historicalDataKeys: historicalData ? Object.keys(historicalData) : null,
    historicalDataType: typeof historicalData,
    hasPlayersArray: !!(historicalData && historicalData.players),
    playersCount: historicalData?.players?.length || 0,
    isJsonData: !!(historicalData && historicalData.players && historicalData.players[0]?.player_info)
  });

  // Helper functions for statistics (defined first to avoid hoisting issues)
  const calculatePositionFrequencies = useCallback((picks) => {
    const positionCounts = {};
    const positionRounds = {};

    picks.forEach((pick) => {
      // Handle both Sleeper API format (pick.player_data.position) and JSON format (pick.position)
      const position = pick.player_data?.position || pick.position;
      if (!position) return;

      positionCounts[position] = (positionCounts[position] || 0) + 1;
      if (!positionRounds[position]) positionRounds[position] = [];
      if (pick.round) positionRounds[position].push(pick.round);
    });

    const result = {};
    Object.keys(positionCounts).forEach((position) => {
      const count = positionCounts[position];
      const rounds = positionRounds[position] || [];
      result[position] = {
        count,
        percentage: ((count / picks.length) * 100).toFixed(1),
        averageRound:
          rounds.length > 0
            ? (rounds.reduce((sum, r) => sum + r, 0) / rounds.length).toFixed(1)
            : "N/A",
      };
    });

    return result;
  }, []);

  const calculateAveragePickPosition = useCallback((picks) => {
    if (picks.length === 0) return 0;
    const totalPickPosition = picks.reduce(
      (sum, pick) => sum + (pick.pick_no || 0),
      0
    );
    return totalPickPosition / picks.length;
  }, []);

  const calculateMostFrequentPlayers = useCallback((picks) => {
    const playerCounts = {};

    picks.forEach((pick) => {
      // Handle both Sleeper API format (pick.player_data.name) and JSON format (pick.name)
      const playerName = pick.player_data?.name || pick.name || "Unknown";
      const position = pick.player_data?.position || pick.position;
      
      if (!playerCounts[playerName]) {
        playerCounts[playerName] = {
          name: playerName,
          position: position,
          count: 0,
          seasons: new Set(),
          rounds: [],
        };
      }

      playerCounts[playerName].count++;
      if (pick.season) playerCounts[playerName].seasons.add(pick.season);
      if (pick.round) playerCounts[playerName].rounds.push(pick.round);
    });

    return Object.values(playerCounts)
      .map((player) => ({
        ...player,
        seasons: Array.from(player.seasons),
        percentage: ((player.count / picks.length) * 100).toFixed(1),
        averageRound:
          player.rounds.length > 0
            ? (
                player.rounds.reduce((sum, r) => sum + r, 0) /
                player.rounds.length
              ).toFixed(1)
            : "N/A",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, []);

  const getFavoritePosition = useCallback((picks) => {
    const positionCounts = {};
    picks.forEach((pick) => {
      // Handle both Sleeper API format (pick.player_data.position) and JSON format (pick.position)
      const position = pick.player_data?.position || pick.position;
      if (position) {
        positionCounts[position] = (positionCounts[position] || 0) + 1;
      }
    });

    return (
      Object.entries(positionCounts).reduce(
        (max, [pos, count]) =>
          count > (max.count || 0) ? { position: pos, count } : max,
        {}
      ).position || "N/A"
    );
  }, []);

  // State management
  const [state, setState] = useState({
    managerData: null,
    loading: false,
    error: null,
    activeView: "overview",
  });

  // Create HistoricalDataManager instance (same as PredictionEngine)
  const [dataManager] = useState(() => new HistoricalDataManager());

  // Filter state with persistence across tab switches
  const [filters, setFilters] = useState(() => {
    // Try to load from localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(
          `managerAnalytics_${managerId || "default"}`
        );
        if (stored) {
          return {
            ...{
              positions: [],
              teams: [],
              searchTerm: "",
              startSeason: "",
              endSeason: "",
              minConfidence: 0,
              maxConfidence: 100,
              minRound: 1,
              maxRound: 20,
              sortBy: "name",
              sortDirection: "asc",
              showOnlyAvailable: false,
              patternSearch: "",
            },
            ...JSON.parse(stored),
          };
        }
      } catch (error) {
        console.warn("Failed to load filters from localStorage:", error);
      }
    }

    return {
      positions: [],
      teams: [],
      searchTerm: "",
      startSeason: "",
      endSeason: "",
      minConfidence: 0,
      maxConfidence: 100,
      minRound: 1,
      maxRound: 20,
      sortBy: "name",
      sortDirection: "asc",
      showOnlyAvailable: false,
      patternSearch: "",
    };
  });

  // Save filters to localStorage when they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          `managerAnalytics_${managerId || "default"}`,
          JSON.stringify(filters)
        );
      } catch (error) {
        console.warn("Failed to save filters to localStorage:", error);
      }
    }
  }, [filters, managerId]);

  // Apply filters function
  const applyFilters = useCallback((data, filters) => {
    if (!data || !Array.isArray(data)) return [];

    let filtered = [...data];

    // Position filter
    if (filters.positions && filters.positions.length > 0) {
      filtered = filtered.filter((item) => {
        // Handle both Sleeper API format (item.player_data.position) and JSON format (item.position)
        const position = item.player_data?.position || item.position;
        return filters.positions.includes(position);
      });
    }

    // Team filter
    if (filters.teams && filters.teams.length > 0) {
      filtered = filtered.filter((item) => {
        // Handle both Sleeper API format (item.player_data.team) and JSON format (item.team)
        const team = item.player_data?.team || item.team;
        return filters.teams.includes(team);
      });
    }

    // Search term filter
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const searchTerm = filters.searchTerm.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        // Handle both Sleeper API format and JSON format
        const name = (item.player_data?.name || item.name || item.playerName || "").toLowerCase();
        const position = (item.player_data?.position || item.position || "").toLowerCase();
        const team = (item.player_data?.team || item.team || "").toLowerCase();
        return (
          name.includes(searchTerm) ||
          position.includes(searchTerm) ||
          team.includes(searchTerm)
        );
      });
    }

    // Season filter
    if (filters.startSeason || filters.endSeason) {
      filtered = filtered.filter((item) => {
        const season = parseInt(item.season);
        if (isNaN(season)) return true;

        if (filters.startSeason && season < parseInt(filters.startSeason))
          return false;
        if (filters.endSeason && season > parseInt(filters.endSeason))
          return false;

        return true;
      });
    }

    // Round filter
    if (filters.minRound || filters.maxRound) {
      filtered = filtered.filter((item) => {
        const round = parseInt(
          item.round || item.averageRound || item.avgRound
        );
        if (isNaN(round)) return true;

        if (filters.minRound && round < filters.minRound) return false;
        if (filters.maxRound && round > filters.maxRound) return false;

        return true;
      });
    }

    // Sort the filtered data
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let aVal = a[filters.sortBy];
        let bVal = b[filters.sortBy];

        // Handle different data types
        if (typeof aVal === "string" && typeof bVal === "string") {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          // Numbers are fine as-is
        } else {
          // Convert to strings for comparison
          aVal = String(aVal || "").toLowerCase();
          bVal = String(bVal || "").toLowerCase();
        }

        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;

        return filters.sortDirection === "desc" ? -comparison : comparison;
      });
    }

    return filtered;
  }, []);

  // Responsive chart options based on screen size
  const getResponsiveChartOptions = useCallback((baseOptions, chartType) => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const isTablet = typeof window !== "undefined" && window.innerWidth < 1024;

    const responsiveOptions = { ...baseOptions };

    if (isMobile) {
      // Mobile optimizations
      if (chartType === "pie") {
        responsiveOptions.plugins.legend.position = "bottom";
        responsiveOptions.plugins.legend.labels.padding = 10;
        responsiveOptions.plugins.legend.labels.font.size = 10;
      } else if (chartType === "bar") {
        responsiveOptions.scales.x.ticks.maxRotation = 90;
        responsiveOptions.scales.x.ticks.font.size = 9;
        responsiveOptions.scales.y.ticks.font.size = 9;
      } else if (chartType === "line") {
        responsiveOptions.plugins.legend.labels.font.size = 10;
        responsiveOptions.scales.x.ticks.font.size = 9;
        responsiveOptions.scales.y.ticks.font.size = 9;
      }
    } else if (isTablet) {
      // Tablet optimizations
      if (chartType === "pie") {
        responsiveOptions.plugins.legend.labels.font.size = 11;
      }
    }

    return responsiveOptions;
  }, []);

  // Load manager data when manager ID changes (using same approach as PredictionEngine)
  useEffect(() => {
    const loadManagerData = async () => {
      console.log("[ManagerAnalytics] loadManagerData called with:", {
        managerId,
        hasDataManager: !!dataManager,
        managerIdType: typeof managerId,
        managerIdValue: managerId
      });

      if (!managerId) {
        console.log("[ManagerAnalytics] No managerId provided, clearing data");
        setState((prevState) => ({
          ...prevState,
          managerData: null,
        }));
        return;
      }

      setState((prevState) => ({
        ...prevState,
        loading: true,
        error: null,
      }));

      try {
        console.log(
          "[ManagerAnalytics] Using HistoricalDataManager to load data for managerId:",
          managerId
        );

        // Use the same approach as PredictionEngine - load data via HistoricalDataManager
        const managerData = await dataManager.loadManagerData(managerId);
        
        console.log("[ManagerAnalytics] Raw data from HistoricalDataManager:", {
          hasData: !!managerData,
          dataKeys: managerData ? Object.keys(managerData) : null,
          dataQuality: managerData?.dataQuality,
          picksCount: managerData?.picks?.length || 0,
          seasonsCount: managerData?.seasons?.length || 0,
          firstFewPicks: managerData?.picks?.slice(0, 3),
          isSleeperData: !!(managerData?.picks?.[0]?.player_data),
          isJsonData: !!(managerData?.picks?.[0]?.player_info),
          samplePick: managerData?.picks?.[0]
        });
        
        // Check if we're getting Sleeper API data or JSON file data
        if (managerData?.picks?.length > 0) {
          const firstPick = managerData.picks[0];
          if (firstPick.player_info) {
            console.warn("[ManagerAnalytics] WARNING: Received JSON file data instead of Sleeper API data!");
            console.log("[ManagerAnalytics] Sample JSON pick:", firstPick);
          } else if (firstPick.player_data) {
            console.log("[ManagerAnalytics] SUCCESS: Received Sleeper API data");
            console.log("[ManagerAnalytics] Sample Sleeper pick:", firstPick);
          } else {
            console.log("[ManagerAnalytics] Unknown data format:", firstPick);
          }
        }

        console.log(
          "[ManagerAnalytics] Received data from HistoricalDataManager:",
          {
            hasData: !!managerData,
            dataKeys: managerData ? Object.keys(managerData) : null,
            picksCount: managerData?.picks?.length || 0,
            seasonsCount: managerData?.seasons?.length || 0,
          }
        );

        setState((prevState) => ({
          ...prevState,
          managerData: managerData,
          loading: false,
        }));
      } catch (err) {
        console.error("[ManagerAnalytics] Error loading manager data:", err);
        setState((prevState) => ({
          ...prevState,
          error: `Failed to load manager data: ${err.message}`,
          loading: false,
        }));
      }
    };

    loadManagerData();
  }, [managerId, dataManager]);

  // Calculate statistics from manager data (using HistoricalDataManager's statistics)
  const statistics = useMemo(() => {
    console.log("[ManagerAnalytics] Calculating statistics from managerData:", {
      hasManagerData: !!state.managerData,
      hasStatistics: !!(state.managerData && state.managerData.statistics),
      hasPicks: !!(state.managerData && state.managerData.picks),
      picksCount: state.managerData?.picks?.length || 0,
    });

    if (!state.managerData) {
      console.log(
        "[ManagerAnalytics] No manager data available for statistics"
      );
      return null;
    }

    // Use statistics from HistoricalDataManager if available
    if (state.managerData.statistics) {
      console.log(
        "[ManagerAnalytics] Using statistics from HistoricalDataManager:",
        state.managerData.statistics
      );
      console.log(
        "[ManagerAnalytics] averageDraftPositions structure:",
        state.managerData.statistics.averageDraftPositions
      );
      console.log(
        "[ManagerAnalytics] Sample picks for position check:",
        state.managerData.picks?.slice(0, 3)
      );

      // Calculate overall average pick position from actual picks data
      let overallAveragePickPosition = 0;
      if (state.managerData.picks && state.managerData.picks.length > 0) {
        overallAveragePickPosition = calculateAveragePickPosition(
          state.managerData.picks
        );
      }

      const finalStats = {
        totalPicks: state.managerData.statistics.totalPicks,
        positionFrequencies: state.managerData.statistics.positionFrequencies,
        averagePickPosition: overallAveragePickPosition,
        mostFrequentPlayers: state.managerData.statistics.mostFrequentPlayers,
        favoritePosition: getFavoritePosition(state.managerData.picks || []),
        seasonsActive: state.managerData.seasons?.length || 0,
      };

      console.log("[ManagerAnalytics] Final statistics object:", finalStats);
      return finalStats;
    }

    // Fallback to manual calculation if no statistics from HistoricalDataManager
    if (!state.managerData.picks || state.managerData.picks.length === 0) {
      console.log(
        "[ManagerAnalytics] No picks available for statistics calculation"
      );
      return null;
    }

    try {
      console.log(
        "[ManagerAnalytics] Calculating statistics manually from picks"
      );
      return {
        totalPicks: state.managerData.picks.length,
        positionFrequencies: calculatePositionFrequencies(
          state.managerData.picks
        ),
        averagePickPosition: calculateAveragePickPosition(
          state.managerData.picks
        ),
        mostFrequentPlayers: calculateMostFrequentPlayers(
          state.managerData.picks
        ),
        favoritePosition: getFavoritePosition(state.managerData.picks),
        seasonsActive: state.managerData.seasons?.length || 0,
      };
    } catch (error) {
      console.error("[ManagerAnalytics] Error calculating statistics:", error);
      return null;
    }
  }, [state.managerData]);

  // Get selected manager info (memoized)
  const selectedManager = useMemo(() => {
    if (!managerId || !leagueUsers) return null;
    return leagueUsers.find((user) => user.user_id === managerId);
  }, [managerId, leagueUsers]);

  // Data quality assessment (using HistoricalDataManager's assessment)
  const dataQuality = useMemo(() => {
    if (!state.managerData) return null;

    // Use dataQuality from HistoricalDataManager if available
    if (state.managerData.dataQuality) {
      const quality = state.managerData.dataQuality;
      if (typeof quality === "string") {
        // Convert string quality to object format
        return {
          score:
            quality === "good"
              ? 90
              : quality === "limited"
              ? 60
              : quality === "insufficient"
              ? 30
              : 0,
          issues: quality === "none" ? ["No draft data available"] : [],
          recommendations:
            quality === "insufficient"
              ? ["More draft history needed for better analytics"]
              : [],
        };
      }
      return quality;
    }

    // Fallback assessment
    const picks = state.managerData.picks || [];
    if (picks.length === 0) {
      return {
        score: 0,
        issues: ["No draft data available"],
        recommendations: [
          "Manager needs to participate in drafts to generate analytics",
        ],
      };
    }

    return {
      score: picks.length >= 20 ? 90 : picks.length >= 10 ? 60 : 30,
      issues: picks.length < 10 ? ["Limited draft history"] : [],
      recommendations:
        picks.length < 20
          ? ["More draft history would improve statistical accuracy"]
          : [],
    };
  }, [state.managerData]);

  // Extract available seasons and positions for filtering
  const availableSeasons = useMemo(() => {
    if (!state.managerData?.seasons || state.managerData.seasons.length === 0) {
      return ["2024", "2023", "2022", "2021", "2020"]; // Default seasons
    }
    return state.managerData.seasons.sort((a, b) => b - a); // Most recent first
  }, [state.managerData?.seasons]);

  const availablePositions = useMemo(() => {
    const defaultPositions = ["QB", "RB", "WR", "TE", "K", "DEF"];

    if (!state.managerData?.picks || state.managerData.picks.length === 0) {
      return defaultPositions;
    }

    const positions = new Set();
    state.managerData.picks.forEach((pick) => {
      // Handle both Sleeper API format (pick.player_data.position) and JSON format (pick.position)
      const position = pick.player_data?.position || pick.position;
      if (position && position !== "UNKNOWN") {
        positions.add(position);
      }
    });

    // If no positions found, return defaults
    if (positions.size === 0) {
      return defaultPositions;
    }

    return Array.from(positions).sort();
  }, [state.managerData?.picks]);

  // Apply filters to historical data
  const filteredHistoricalData = useMemo(() => {
    if (!state.managerData?.picks) return [];
    return applyFilters(state.managerData.picks, filters);
  }, [state.managerData?.picks, filters]);

  // Apply filters to most frequent players
  const filteredFrequentPlayers = useMemo(() => {
    if (!statistics?.mostFrequentPlayers) return [];
    return applyFilters(statistics.mostFrequentPlayers, filters);
  }, [statistics?.mostFrequentPlayers, filters]);

  // Get available teams for filtering
  const availableTeams = useMemo(() => {
    if (!state.managerData?.picks || state.managerData.picks.length === 0) {
      return [];
    }

    const teams = new Set();
    state.managerData.picks.forEach((pick) => {
      const team = pick.team;
      if (team && team !== "UNKNOWN") {
        teams.add(team);
      }
    });

    return Array.from(teams).sort();
  }, [state.managerData?.picks]);

  // Handle manager selection change (optimized with useCallback)
  const handleManagerChange = useCallback(
    (newManagerId) => {
      if (onManagerChange) {
        onManagerChange(newManagerId);
      }
    },
    [onManagerChange]
  );

  // View change handler
  const handleViewChange = useCallback((newView) => {
    setState((prevState) => ({
      ...prevState,
      activeView: newView,
    }));
  }, []);

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (newFilters) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  // Prepare chart data for position frequencies
  const positionChartData = useMemo(() => {
    if (!statistics || !statistics.positionFrequencies) {
      return null;
    }

    const positions = Object.keys(statistics.positionFrequencies);
    const colors = {
      QB: "#8B5CF6", // Purple
      RB: "#10B981", // Green
      WR: "#3B82F6", // Blue
      TE: "#F59E0B", // Amber
      K: "#EF4444", // Red
      DEF: "#6B7280", // Gray
    };

    return {
      labels: positions,
      datasets: [
        {
          data: positions.map(
            (pos) => statistics.positionFrequencies[pos].percentage
          ),
          backgroundColor: positions.map((pos) => colors[pos] || "#9CA3AF"),
          borderWidth: 2,
          borderColor: "#FFFFFF",
        },
      ],
    };
  }, [statistics?.positionFrequencies]);

  // Prepare chart data for most frequently drafted players
  const playersChartData = useMemo(() => {
    if (!filteredFrequentPlayers || filteredFrequentPlayers.length === 0) {
      return null;
    }

    const topPlayers = filteredFrequentPlayers.slice(0, 10);

    return {
      labels: topPlayers.map((player) => player.playerName || player.name),
      datasets: [
        {
          label: "Times Drafted",
          data: topPlayers.map((player) => player.draftCount || player.count),
          backgroundColor: "#3B82F6",
          borderColor: "#1D4ED8",
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [filteredFrequentPlayers, filters.sortBy, filters.sortDirection]);

  // Calculate year-over-year trends for StatisticalInsights
  const yearOverYearTrends = useMemo(() => {
    if (
      !state.managerData?.picks ||
      !state.managerData?.seasons ||
      state.managerData.seasons.length < 2
    ) {
      return null;
    }

    // Group picks by season and calculate position percentages
    const seasonData = {};
    state.managerData.picks.forEach((pick) => {
      const season = pick.season;
      // Handle both Sleeper API format (pick.player_data.position) and JSON format (pick.position)
      const position = pick.player_data?.position || pick.position;

      if (!season || !position) return;

      if (!seasonData[season]) {
        seasonData[season] = {
          total: 0,
          positions: {},
          averagePickPosition: 0,
          totalPickPosition: 0,
        };
      }

      seasonData[season].total++;
      seasonData[season].positions[position] =
        (seasonData[season].positions[position] || 0) + 1;
      seasonData[season].totalPickPosition += pick.pick_no || 0;
    });

    // Convert to percentages and calculate averages
    const trends = {};
    Object.keys(seasonData).forEach((season) => {
      const data = seasonData[season];
      trends[season] = {
        totalPicks: data.total,
        averagePickPosition:
          data.total > 0 ? data.totalPickPosition / data.total : 0,
        positionPercentages: {},
      };

      Object.keys(data.positions).forEach((position) => {
        trends[season].positionPercentages[position] =
          data.total > 0 ? (data.positions[position] / data.total) * 100 : 0;
      });
    });

    return trends;
  }, [state.managerData?.picks, state.managerData?.seasons]);

  // Prepare trend chart data for year-over-year analysis
  const trendChartData = useMemo(() => {
    if (!yearOverYearTrends) {
      return null;
    }

    // Convert to percentages and prepare chart data
    const seasons = Object.keys(yearOverYearTrends).sort();
    const positions = ["QB", "RB", "WR", "TE"];
    const colors = {
      QB: "#8B5CF6", // Purple
      RB: "#10B981", // Green
      WR: "#3B82F6", // Blue
      TE: "#F59E0B", // Amber
    };

    const datasets = positions.map((position) => ({
      label: position,
      data: seasons.map((season) => {
        const seasonTrends = yearOverYearTrends[season];
        return seasonTrends?.positionPercentages[position]?.toFixed(1) || 0;
      }),
      borderColor: colors[position],
      backgroundColor: colors[position] + "20", // Add transparency
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: colors[position],
      pointBorderColor: "#FFFFFF",
      pointBorderWidth: 2,
    }));

    return {
      labels: seasons,
      datasets,
    };
  }, [state.managerData?.picks, state.managerData?.seasons]);

  // Simple loading state for players
  const loadedPlayers = statistics?.mostFrequentPlayers || [];
  const isLoadingPlayers = false;
  const hasMorePlayers = false;
  const loadMorePlayers = () => {};

  if (state.loading) {
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

  if (state.error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">
            Error Loading Manager Data
          </h3>
          <p className="text-red-600 mt-1">{state.error}</p>
          <button
            onClick={() => handleManagerChange(managerId)}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  console.log("[ManagerAnalytics] Rendering component with state:", {
    loading: state.loading,
    error: state.error,
    hasManagerData: !!state.managerData,
    hasStatistics: !!statistics,
    managerId,
  });

  return (
    <div className="p-6 space-y-6">
      {/* Manager Selection */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Manager Analytics</h2>
        <div className="flex items-center space-x-4">
          <label
            htmlFor="manager-select"
            className="text-sm font-medium text-gray-200"
          >
            Select Manager:
          </label>
          <select
            id="manager-select"
            value={managerId || ""}
            onChange={(e) => handleManagerChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a manager...</option>
            {leagueUsers?.map((user) => (
              <option key={user.user_id} value={user.user_id}>
                {user.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!managerId && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            Select a manager to view their draft analytics
          </p>
          <div className="mt-4 text-xs text-gray-400">
            Available managers: {leagueUsers?.length || 0}
          </div>
        </div>
      )}

      {managerId && !state.managerData && !state.loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            No historical data available for this manager
          </p>
          <div className="mt-4 text-xs text-gray-400">
            Manager ID: {managerId}
            <br />
            Error: {state.error || "No error"}
          </div>
        </div>
      )}

      {managerId && state.managerData && !statistics && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            Unable to calculate statistics for this manager
          </p>
          <div className="mt-4 text-xs text-gray-400">
            Manager has {state.managerData.picks?.length || 0} picks but
            statistics calculation failed
            <br />
            Manager data keys:{" "}
            {state.managerData
              ? Object.keys(state.managerData).join(", ")
              : "none"}
            <br />
            Has statistics from HistoricalDataManager:{" "}
            {!!(state.managerData && state.managerData.statistics)}
          </div>
        </div>
      )}

      {managerId &&
        state.managerData &&
        state.managerData.picks?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No draft picks found for this manager
            </p>
            <div className="mt-4 text-xs text-gray-400">
              This manager may not have participated in any drafts in the
              available data
            </div>
          </div>
        )}

      {managerId &&
        state.managerData &&
        (statistics || state.managerData.picks?.length === 0) && (
          <>
            {/* No Picks Available */}
            {state.managerData.picks?.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-2">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-4 4-4-4m0 0L7 9l4-4 4 4z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500">No draft history found</p>
                <p className="text-sm text-gray-400 mt-1">
                  This manager hasn't participated in any completed drafts in
                  the analyzed seasons
                </p>
                <div className="mt-4 text-xs text-gray-400">
                  Searched seasons:{" "}
                  {state.managerData.seasons?.join(", ") || "None"}
                  <br />
                  Leagues found: {state.managerData.leagues?.length || 0}
                </div>
              </div>
            )}

            {/* Data Quality Indicator */}
            {state.managerData.picks?.length > 0 && dataQuality && (
              <div
                className={`p-3 rounded-lg ${
                  dataQuality.score >= 80
                    ? "bg-green-800 border border-green-200"
                    : dataQuality.score >= 60
                    ? "bg-yellow-700 border border-yellow-200"
                    : "bg-red-800 border border-red-200"
                }`}
              >
                <p className="text-sm">
                  <span className="font-medium">Data Quality: </span>
                  {dataQuality.score >= 80
                    ? "Excellent"
                    : dataQuality.score >= 60
                    ? "Good"
                    : "Limited"}{" "}
                  ({state.managerData.picks?.length || 0} picks across{" "}
                  {state.managerData.seasons?.length || 0} seasons)
                </p>
              </div>
            )}

            {/* View Tabs - Only show if we have picks and statistics */}
            {state.managerData.picks?.length > 0 && statistics && (
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {["overview", "positions", "players", "trends"].map(
                    (view) => (
                      <button
                        key={view}
                        onClick={() => handleViewChange(view)}
                        className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                          state.activeView === view
                            ? "border-blue-500 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {view}
                      </button>
                    )
                  )}
                </nav>
              </div>
            )}

            {/* Filter Controls - Show for relevant tabs */}
            {(state.activeView === "players" ||
              state.activeView === "positions") && (
              <FilterControls
                onFiltersChange={handleFiltersChange}
                availablePositions={availablePositions}
                availableSeasons={availableSeasons}
                availableTeams={availableTeams}
                showPositionFilter={true}
                showDateRangeFilter={true}
                showSearchFilter={state.activeView === "players"}
                showSortOptions={true}
                showTeamFilter={availableTeams.length > 1}
                showAdvancedFilters={true}
                sortOptions={[
                  { key: "playerName", label: "Player Name" },
                  { key: "name", label: "Player Name" },
                  { key: "position", label: "Position" },
                  { key: "draftCount", label: "Draft Count" },
                  { key: "count", label: "Draft Count" },
                  { key: "percentage", label: "Draft Percentage" },
                  { key: "avgRound", label: "Average Round" },
                  { key: "averageRound", label: "Average Round" },
                  { key: "season", label: "Season" },
                  { key: "round", label: "Round" },
                ]}
                initialFilters={filters}
                context="analytics"
                className="mb-6"
              />
            )}

            {/* Overview Tab */}
            {state.activeView === "overview" && (
              <>
                {console.log(
                  "[ManagerAnalytics] Rendering overview with statistics:",
                  statistics
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className=" p-4 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500">
                      Total Picks
                    </h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {statistics?.totalPicks || 0}
                    </p>
                  </div>
                  <div className=" p-4 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500">
                      Avg Pick Position
                    </h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {statistics?.averagePickPosition?.toFixed(1) || "N/A"}
                    </p>
                  </div>
                  <div className=" p-4 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500">
                      Favorite Position
                    </h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {statistics?.favoritePosition || "N/A"}
                    </p>
                  </div>
                  <div className=" p-4 rounded-lg border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500">
                      Seasons
                    </h3>
                    <p className="text-2xl font-bold text-gray-900">
                      {state.managerData.seasons?.length || 0}
                    </p>
                  </div>
                </div>
              </>
            )}
            {/* Position Analysis Tab */}
            {state.activeView === "positions" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Position Frequency Chart */}
                <div className=" p-4 sm:p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Position Frequency
                  </h3>
                  {positionChartData ? (
                    <div className="h-64 sm:h-72 lg:h-64">
                      <Pie
                        data={positionChartData}
                        options={getResponsiveChartOptions(
                          {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: {
                              intersect: false,
                              mode: "index",
                            },
                            plugins: {
                              legend: {
                                position: "bottom",
                                labels: {
                                  padding: 20,
                                  usePointStyle: true,
                                  font: {
                                    size: 12,
                                  },
                                },
                              },
                              tooltip: {
                                backgroundColor: "rgba(0, 0, 0, 0.8)",
                                titleColor: "#FFFFFF",
                                bodyColor: "#FFFFFF",
                                borderColor: "#374151",
                                borderWidth: 1,
                                cornerRadius: 6,
                                displayColors: true,
                                callbacks: {
                                  title: (context) => {
                                    return `${context[0].label} Position`;
                                  },
                                  label: (context) => {
                                    const position = context.label;
                                    const percentage = context.parsed;
                                    const positionData =
                                      statistics?.positionFrequencies?.[
                                        position
                                      ];
                                    return [
                                      `Percentage: ${percentage}%`,
                                      `Count: ${positionData.count} picks`,
                                      `Avg Round: ${positionData.averageRound}`,
                                    ];
                                  },
                                },
                              },
                              title: {
                                display: false,
                              },
                            },
                            // Accessibility improvements
                            accessibility: {
                              announceNewData: {
                                enabled: true,
                              },
                            },
                            // Animation for better UX
                            animation: {
                              animateRotate: true,
                              animateScale: true,
                              duration: 1000,
                            },
                          },
                          "pie"
                        )}
                        aria-label="Position frequency distribution chart"
                        role="img"
                      />
                    </div>
                  ) : (
                    <p className="text-gray-500">No position data available</p>
                  )}
                </div>

                {/* Position Details Table */}
                <div className=" p-4 sm:p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Position Details
                  </h3>
                  {statistics?.positionFrequencies ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Position
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Count
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              %
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Avg Round
                            </th>
                          </tr>
                        </thead>
                        <tbody className=" divide-y divide-gray-200">
                          {Object.entries(
                            statistics?.positionFrequencies || {}
                          ).map(([position, data]) => (
                            <tr key={position}>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900">
                                {position}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-500">
                                {data.count}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-500">
                                {data.percentage}%
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-500">
                                {data.averageRound?.toFixed(1) || "N/A"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500">No position data available</p>
                  )}
                </div>
              </div>
            )}
            {/* Players Tab */}
            {state.activeView === "players" && (
              <div className="space-y-6">
                {/* Most Frequently Drafted Players Chart */}
                <div className=" p-4 sm:p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Most Frequently Drafted Players
                  </h3>
                  {playersChartData ? (
                    <div className="h-64 sm:h-72">
                      <Bar
                        data={playersChartData}
                        options={getResponsiveChartOptions(
                          {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: {
                              intersect: false,
                              mode: "index",
                            },
                            plugins: {
                              legend: {
                                display: false,
                              },
                              tooltip: {
                                backgroundColor: "rgba(0, 0, 0, 0.8)",
                                titleColor: "#FFFFFF",
                                bodyColor: "#FFFFFF",
                                borderColor: "#374151",
                                borderWidth: 1,
                                cornerRadius: 6,
                                displayColors: false,
                                callbacks: {
                                  title: (context) => {
                                    return context[0].label;
                                  },
                                  label: (context) => {
                                    const playerIndex = context.dataIndex;
                                    const player =
                                      filteredFrequentPlayers[playerIndex];
                                    if (!player)
                                      return `Times Drafted: ${context.parsed.y}`;

                                    return [
                                      `Times Drafted: ${
                                        player.draftCount || player.count
                                      }`,
                                      `Position: ${
                                        player.position || "Unknown"
                                      }`,
                                      `Percentage: ${player.percentage}% of drafts`,
                                      `Avg Round: ${
                                        player.averageRound ||
                                        player.avgRound ||
                                        "N/A"
                                      }`,
                                    ];
                                  },
                                },
                              },
                              title: {
                                display: false,
                              },
                            },
                            scales: {
                              x: {
                                grid: {
                                  display: false,
                                },
                                ticks: {
                                  maxRotation: 45,
                                  minRotation: 0,
                                  font: {
                                    size: 11,
                                  },
                                },
                              },
                              y: {
                                beginAtZero: true,
                                grid: {
                                  color: "rgba(0, 0, 0, 0.1)",
                                },
                                ticks: {
                                  stepSize: 1,
                                  font: {
                                    size: 11,
                                  },
                                },
                                title: {
                                  display: true,
                                  text: "Times Drafted",
                                  font: {
                                    size: 12,
                                    weight: "bold",
                                  },
                                },
                              },
                            },
                            // Accessibility improvements
                            accessibility: {
                              announceNewData: {
                                enabled: true,
                              },
                            },
                            // Animation for better UX
                            animation: {
                              duration: 1000,
                              easing: "easeOutQuart",
                            },
                          },
                          "bar"
                        )}
                        aria-label="Most frequently drafted players chart"
                        role="img"
                      />
                    </div>
                  ) : (
                    <p className="text-gray-500">No player data available</p>
                  )}
                </div>

                {/* Virtualized Players Table */}
                <div className=" p-4 sm:p-6 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Draft History
                    </h3>
                    <div className="text-sm text-gray-500">
                      Showing {filteredFrequentPlayers.length} of{" "}
                      {statistics?.mostFrequentPlayers?.length || 0} players
                    </div>
                  </div>
                  {filteredFrequentPlayers &&
                  filteredFrequentPlayers.length > 0 ? (
                    <VirtualizedTable
                      data={filteredFrequentPlayers}
                      columns={[
                        {
                          key: "name",
                          header: "Player",
                          width: "40%",
                          render: (value, player) => (
                            <div>
                              <p className="font-medium text-gray-900">
                                {player.playerName || player.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {player.team || "Unknown Team"}
                              </p>
                            </div>
                          ),
                        },
                        {
                          key: "position",
                          header: "Position",
                          width: "15%",
                          render: (value) => (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {value}
                            </span>
                          ),
                        },
                        {
                          key: "count",
                          header: "Times Drafted",
                          width: "20%",
                          render: (value, player) => (
                            <div>
                              <p className="font-medium">
                                {player.draftCount || player.count}
                              </p>
                              <p className="text-xs text-gray-500">
                                {player.percentage?.toFixed(1) || 0}% of drafts
                              </p>
                            </div>
                          ),
                        },
                        {
                          key: "avgRound",
                          header: "Avg Round",
                          width: "25%",
                          render: (value, player) => {
                            const avgRound =
                              player.avgRound || player.averageRound;
                            return avgRound ? (
                              <div>
                                <p className="font-medium">
                                  {avgRound.toFixed(1)}
                                </p>
                                {player.positionRange && (
                                  <p className="text-xs text-gray-500">
                                    Range: {player.positionRange.earliest}-
                                    {player.positionRange.latest}
                                  </p>
                                )}
                              </div>
                            ) : (
                              "N/A"
                            );
                          },
                        },
                      ]}
                      itemHeight={60}
                      containerHeight={400}
                      className="mt-4"
                      emptyMessage={
                        filters.searchTerm ||
                        filters.positions.length > 0 ||
                        filters.startSeason ||
                        filters.endSeason
                          ? "No players match the current filters"
                          : "No player data available"
                      }
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">
                        {filters.searchTerm ||
                        filters.positions.length > 0 ||
                        filters.startSeason ||
                        filters.endSeason
                          ? "No players match the current filters"
                          : "No player data available"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Trends Tab */}
            {state.activeView === "trends" && (
              <div className="space-y-6">
                {/* Year-over-Year Trend Chart */}
                <div className=" p-4 sm:p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Position Trends Over Time
                  </h3>
                  {trendChartData ? (
                    <div className="h-64 sm:h-80 lg:h-96">
                      <Line
                        data={trendChartData}
                        options={getResponsiveChartOptions(
                          {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: {
                              intersect: false,
                              mode: "index",
                            },
                            plugins: {
                              legend: {
                                position: "top",
                                labels: {
                                  padding: 20,
                                  usePointStyle: true,
                                  font: {
                                    size: 12,
                                  },
                                },
                              },
                              tooltip: {
                                backgroundColor: "rgba(0, 0, 0, 0.8)",
                                titleColor: "#FFFFFF",
                                bodyColor: "#FFFFFF",
                                borderColor: "#374151",
                                borderWidth: 1,
                                cornerRadius: 6,
                                displayColors: true,
                                callbacks: {
                                  title: (context) => {
                                    return `Season ${context[0].label}`;
                                  },
                                  label: (context) => {
                                    return `${context.dataset.label}: ${context.parsed.y}% of picks`;
                                  },
                                  afterBody: (context) => {
                                    const season = context[0].label;
                                    const seasonPicks =
                                      state.managerData.picks.filter(
                                        (pick) => pick.season === season
                                      );
                                    return [
                                      `Total picks in ${season}: ${seasonPicks.length}`,
                                    ];
                                  },
                                },
                              },
                              title: {
                                display: false,
                              },
                            },
                            scales: {
                              x: {
                                grid: {
                                  display: true,
                                  color: "rgba(0, 0, 0, 0.1)",
                                },
                                title: {
                                  display: true,
                                  text: "Season",
                                  font: {
                                    size: 12,
                                    weight: "bold",
                                  },
                                },
                              },
                              y: {
                                beginAtZero: true,
                                max: 100,
                                grid: {
                                  color: "rgba(0, 0, 0, 0.1)",
                                },
                                ticks: {
                                  callback: function (value) {
                                    return value + "%";
                                  },
                                },
                                title: {
                                  display: true,
                                  text: "Percentage of Picks",
                                  font: {
                                    size: 12,
                                    weight: "bold",
                                  },
                                },
                              },
                            },
                            // Accessibility improvements
                            accessibility: {
                              announceNewData: {
                                enabled: true,
                              },
                            },
                            // Animation for better UX
                            animation: {
                              duration: 1500,
                              easing: "easeOutQuart",
                            },
                          },
                          "line"
                        )}
                        aria-label="Position trends over time chart"
                        role="img"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">
                        {state.managerData?.seasons?.length < 2
                          ? "Need at least 2 seasons of data to show trends"
                          : "No trend data available"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Statistical Insights */}
                <div className=" rounded-lg border border-gray-200">
                  <StatisticalInsights
                    managerId={managerId}
                    managerStats={statistics}
                    yearOverYearTrends={yearOverYearTrends}
                    leagueId={leagueId}
                    data={data}
                    picks={state.managerData?.picks}
                  />
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}
