/**
 * StatisticalInsights Component
 * Displays advanced statistical insights including consistency scoring, trend detection,
 * league comparisons, and unique pattern identification
 * Optimized with React.useMemo, React.useCallback, and performance monitoring
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  calculateConsistencyScoring,
  detectTrends,
  buildLeagueComparisons,
  identifyUniquePatterns,
  createVisualIndicators,
} from "./utils/statisticalInsights.js";
import { aggregateLeagueData } from "./utils/dataAggregation.js";
import {
  useDebounce,
  useDebouncedCallback,
  useExpensiveMemo,
  usePerformanceMonitor,
  useOptimizedEventHandler,
} from "./utils/performanceOptimizations.js";

export function StatisticalInsights({
  managerId,
  managerStats,
  yearOverYearTrends,
  leagueId,
  data,
  picks,
}) {
  const [insightsState, setInsightsState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeInsight, setActiveInsight] = useState("consistency");

  // Debounce manager ID to prevent excessive calculations
  const debouncedManagerId = useDebounce(managerId, 300);

  // Expensive memoized calculation of insights
  const insights = useExpensiveMemo(
    () => {
      if (!debouncedManagerId || !managerStats || !picks) {
        return null;
      }

      try {
        // Calculate consistency scoring
        const consistencyScoring = calculateConsistencyScoring(
          picks,
          yearOverYearTrends
        );

        // Detect trends
        const trendDetection = detectTrends(yearOverYearTrends);

        // Get league data for comparisons
        let leagueComparisons = {
          positionComparisons: {},
          roundComparisons: {},
          overallComparison: "insufficient_data",
          standoutMetrics: [],
        };
        if (leagueId && data) {
          try {
            const leagueData = aggregateLeagueData(data, leagueId);
            leagueComparisons = buildLeagueComparisons(
              managerStats,
              leagueData.leagueAverages
            );
          } catch (err) {
            console.warn("Could not calculate league comparisons:", err);
          }
        }

        // Identify unique patterns
        const uniquePatterns = identifyUniquePatterns(
          managerStats,
          leagueComparisons,
          consistencyScoring,
          trendDetection
        );

        // Create visual indicators
        const visualIndicators = createVisualIndicators(
          trendDetection,
          leagueComparisons,
          uniquePatterns
        );

        return {
          consistencyScoring,
          trendDetection,
          leagueComparisons,
          uniquePatterns,
          visualIndicators,
        };
      } catch (err) {
        console.error("Error calculating insights:", err);
        return null;
      }
    },
    [
      debouncedManagerId,
      managerStats?.totalPicks,
      picks?.length,
      yearOverYearTrends,
      leagueId,
      data?.players?.length,
    ],
    {
      maxCacheSize: 5,
      ttl: 10 * 60 * 1000, // 10 minutes
      enableLogging: process.env.NODE_ENV === "development",
    }
  );

  // Performance monitoring
  const performanceMetrics = usePerformanceMonitor("StatisticalInsights", [
    managerId,
    activeInsight,
    picks?.length,
    insights !== null,
  ]);
  // Handle loading and error states
  useEffect(() => {
    if (!debouncedManagerId || !managerStats || !picks) {
      setLoading(false);
      setError(null);
      return;
    }

    if (insights === null) {
      setLoading(true);
      setError("Failed to calculate statistical insights");
    } else {
      setLoading(false);
      setError(null);
    }
  }, [debouncedManagerId, managerStats, picks, insights]);

  // Optimized tab change handler with debouncing
  const handleTabChange = useDebouncedCallback(
    (newTab) => {
      setActiveInsight(newTab);
    },
    150,
    []
  );

  // Memoized render functions to prevent unnecessary re-renders
  const renderConsistencyScoring = useCallback(() => {
    if (!insights?.consistencyScoring) return null;

    const { consistencyScoring } = insights;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">
          Consistency Analysis
        </h3>

        {/* Overall Consistency Score */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Overall Consistency</h4>
              <p className="text-sm text-gray-600 capitalize">
                {consistencyScoring.consistencyLevel.replace("_", " ")}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {consistencyScoring.overallConsistency}
              </div>
              <div className="text-sm text-gray-500">out of 100</div>
            </div>
          </div>
        </div>

        {/* Detailed Consistency Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className=" p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">
              Position Consistency
            </h4>
            <div className="flex items-center">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${consistencyScoring.positionConsistency}%`,
                    }}
                  ></div>
                </div>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-900">
                {consistencyScoring.positionConsistency}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              How consistent position preferences are
            </p>
          </div>

          <div className=" p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">
              Round Consistency
            </h4>
            <div className="flex items-center">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${consistencyScoring.roundConsistency}%` }}
                  ></div>
                </div>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-900">
                {consistencyScoring.roundConsistency}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              How consistent round strategies are
            </p>
          </div>

          <div className=" p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Player Loyalty</h4>
            <div className="flex items-center">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${consistencyScoring.playerLoyalty}%` }}
                  ></div>
                </div>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-900">
                {consistencyScoring.playerLoyalty}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tendency to redraft same players
            </p>
          </div>
        </div>
      </div>
    );
  }, [insights?.consistencyScoring]);

  // Render trend detection section
  const renderTrendDetection = useCallback(() => {
    if (!insights?.trendDetection) return null;

    const { trendDetection } = insights;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Trend Analysis</h3>

        {trendDetection.trendDetected ? (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg border border-orange-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 flex items-center">
                  <span className="mr-2">📈</span>
                  Trend Detected:{" "}
                  {trendDetection.trendType.replace("_", " ").toUpperCase()}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  Recent drafting patterns show significant changes compared to
                  historical behavior
                </p>
                {trendDetection.details && (
                  <div className="mt-2 text-xs text-gray-500">
                    <p>
                      Analyzed {trendDetection.details.seasonsAnalyzed} seasons
                    </p>
                    <p>
                      Recent: {trendDetection.details.recentSeasons?.join(", ")}
                    </p>
                    <p>
                      Historical:{" "}
                      {trendDetection.details.historicalSeasons?.join(", ")}
                    </p>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-orange-600">
                  {trendDetection.confidence}%
                </div>
                <div className="text-xs text-gray-500">confidence</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900">
              No Significant Trends Detected
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              {trendDetection.trendType === "insufficient_data"
                ? "Not enough historical data to detect trends"
                : "Drafting patterns remain relatively stable over time"}
            </p>
          </div>
        )}
      </div>
    );
  }, [insights?.trendDetection]);

  // Render league comparisons section
  const renderLeagueComparisons = useCallback(() => {
    if (!insights?.leagueComparisons) return null;

    const { leagueComparisons } = insights;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">
          League Comparisons
        </h3>

        {/* Overall Comparison */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-medium text-gray-900">Overall Assessment</h4>
          <p className="text-sm text-gray-600 capitalize mt-1">
            {leagueComparisons.overallComparison.replace("_", " ")} compared to
            league average
          </p>
        </div>

        {/* Standout Metrics */}
        {leagueComparisons.standoutMetrics &&
          leagueComparisons.standoutMetrics.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Notable Differences</h4>
              {leagueComparisons.standoutMetrics.map((metric, index) => (
                <div
                  key={index}
                  className=" p-3 rounded border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-900">
                      {metric.description}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        metric.difference > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {metric.difference > 0 ? "+" : ""}
                      {metric.difference.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

        {/* Position Comparisons */}
        {Object.keys(leagueComparisons.positionComparisons || {}).length >
          0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">
              Position Preferences vs League
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(leagueComparisons.positionComparisons).map(
                ([position, comparison]) => (
                  <div
                    key={position}
                    className=" p-3 rounded border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">
                        {position}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          comparison.percentageDifference > 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {comparison.percentageDifference > 0 ? "+" : ""}
                        {comparison.percentageDifference.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      You: {comparison.managerPercentage.toFixed(1)}% | League:{" "}
                      {comparison.leaguePercentage.toFixed(1)}%
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  }, [insights?.leagueComparisons]);

  // Render unique patterns section
  const renderUniquePatterns = useCallback(() => {
    if (!insights?.uniquePatterns) return null;

    const { uniquePatterns } = insights;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Unique Patterns</h3>

        {/* Uniqueness Score */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Uniqueness Score</h4>
              <p className="text-sm text-gray-600">
                How distinctive your draft style is
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-600">
                {uniquePatterns.uniquenessScore}
              </div>
              <div className="text-sm text-gray-500">out of 100</div>
            </div>
          </div>
        </div>

        {/* Identified Patterns */}
        {uniquePatterns.patterns && uniquePatterns.patterns.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Identified Patterns</h4>
            {uniquePatterns.patterns.map((pattern, index) => (
              <div
                key={index}
                className=" p-4 rounded-lg border border-gray-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 capitalize">
                      {pattern.type.replace("_", " ")}
                    </h5>
                    <p className="text-sm text-gray-600 mt-1">
                      {pattern.description}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {pattern.confidence}%
                    </div>
                    <div className="text-xs text-gray-500">confidence</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900">
              No Distinctive Patterns
            </h4>
            <p className="text-sm text-gray-600 mt-1">
              Your draft style follows common patterns without significant
              deviations
            </p>
          </div>
        )}
      </div>
    );
  }, [insights?.uniquePatterns]);

  // Render visual indicators section
  const renderVisualIndicators = useCallback(() => {
    if (
      !insights?.visualIndicators ||
      !insights.visualIndicators.indicators.length
    )
      return null;

    const { visualIndicators } = insights;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Key Insights</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visualIndicators.indicators.map((indicator, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border-l-4 ${
                indicator.severity === "high"
                  ? "border-red-500 bg-red-50"
                  : indicator.severity === "medium"
                  ? "border-yellow-500 bg-yellow-50"
                  : "border-blue-500 bg-blue-50"
              }`}
            >
              <div className="flex items-start">
                <span className="text-lg mr-2">{indicator.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {indicator.message}
                  </p>
                  {indicator.confidence && (
                    <p className="text-xs text-gray-500 mt-1">
                      Confidence: {indicator.confidence}%
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
          <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-blue-600">
                {visualIndicators.indicatorSummary.trends}
              </div>
              <div className="text-xs text-gray-500">Trends</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {visualIndicators.indicatorSummary.comparisons}
              </div>
              <div className="text-xs text-gray-500">Comparisons</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-600">
                {visualIndicators.indicatorSummary.patterns}
              </div>
              <div className="text-xs text-gray-500">Patterns</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-600">
                {visualIndicators.indicatorSummary.highSeverity}
              </div>
              <div className="text-xs text-gray-500">High Priority</div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [insights?.visualIndicators]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error Loading Insights</h3>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p className="text-gray-500">No insights available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Insight Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: "consistency", label: "Consistency" },
            { key: "trends", label: "Trends" },
            { key: "comparisons", label: "League Comparison" },
            { key: "patterns", label: "Unique Patterns" },
            { key: "indicators", label: "Key Insights" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeInsight === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-200 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Insight Content */}
      <div className="min-h-[400px]">
        {activeInsight === "consistency" && renderConsistencyScoring()}
        {activeInsight === "trends" && renderTrendDetection()}
        {activeInsight === "comparisons" && renderLeagueComparisons()}
        {activeInsight === "patterns" && renderUniquePatterns()}
        {activeInsight === "indicators" && renderVisualIndicators()}
      </div>
    </div>
  );
}
