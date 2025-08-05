"use client";

import { useState } from "react";

export function AnalyticsPanel({ analytics, draftState }) {
  const [activeTab, setActiveTab] = useState("overview");

  const getPositionColors = (position) => {
    const colors = {
      QB: "bg-red-500 text-red-300 border-red-500",
      RB: "bg-teal-500 text-teal-300 border-teal-500",
      WR: "bg-blue-500 text-blue-300 border-blue-500",
      TE: "bg-green-500 text-green-300 border-green-500",
      FLEX: "bg-yellow-500 text-yellow-300 border-yellow-500",
      BENCH: "bg-purple-500 text-purple-300 border-purple-500",
    };
    return colors[position] || "bg-gray-500 text-gray-300 border-gray-500";
  };

  const getPositionBadgeColor = (position) => {
    const colors = {
      QB: "bg-red-900 text-red-300 border-red-700",
      RB: "bg-teal-900 text-teal-300 border-teal-700",
      WR: "bg-blue-900 text-blue-300 border-blue-700",
      TE: "bg-green-900 text-green-300 border-green-700",
      FLEX: "bg-yellow-900 text-yellow-300 border-yellow-700",
      BENCH: "bg-purple-900 text-purple-300 border-purple-700",
    };
    return colors[position] || "bg-gray-900 text-gray-300 border-gray-700";
  };

  const renderOverview = () => (
    <div className="space-y-8">
      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-blue-100">Total Points</h4>
            <svg
              className="w-5 h-5 text-blue-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="text-2xl font-bold">
            {Object.values(analytics.totalProjectedPoints)
              .reduce((sum, points) => sum + points, 0)
              .toLocaleString()}
          </div>
          <div className="text-xs text-blue-200 mt-1">Across all rosters</div>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-green-100">
              Average Points
            </h4>
            <svg
              className="w-5 h-5 text-green-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <div className="text-2xl font-bold">
            {Object.keys(analytics.totalProjectedPoints).length > 0
              ? Math.round(
                  Object.values(analytics.totalProjectedPoints).reduce(
                    (sum, points) => sum + points,
                    0
                  ) / Object.keys(analytics.totalProjectedPoints).length
                )
              : "N/A"}
          </div>
          <div className="text-xs text-green-200 mt-1">Per manager</div>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-purple-100">
              Optimal Picks
            </h4>
            <svg
              className="w-5 h-5 text-purple-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
          <div className="text-2xl font-bold">
            {analytics.optimalPicks.length}
          </div>
          <div className="text-xs text-purple-200 mt-1">Score over 80</div>
        </div>

        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-orange-100">
              Avg Pick Score
            </h4>
            <svg
              className="w-5 h-5 text-orange-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </div>
          <div className="text-2xl font-bold">
            {draftState.picks.length > 0
              ? Math.round(
                  draftState.picks.reduce((sum, pick) => sum + pick.score, 0) /
                    draftState.picks.length
                )
              : "N/A"}
          </div>
          <div className="text-xs text-orange-200 mt-1">Out of 100</div>
        </div>
      </div>

      {/* Roster Rankings */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
          <svg
            className="w-5 h-5 mr-2 text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            />
          </svg>
          Roster Rankings by Projected Points
        </h4>
        <div className="space-y-3">
          {Object.entries(analytics.totalProjectedPoints)
            .sort(([, a], [, b]) => b - a)
            .map(([managerId, points], index) => {
              const roster = draftState.rosters[managerId];
              const rankColors = [
                "bg-yellow-500",
                "bg-gray-400",
                "bg-amber-600",
              ];
              const rankColor = rankColors[index] || "bg-blue-500";

              return (
                <div
                  key={managerId}
                  className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-8 h-8 ${rankColor} rounded-full flex items-center justify-center text-white font-bold text-sm`}
                    >
                      #{index + 1}
                    </div>
                    <div className="text-white font-medium">
                      {roster?.managerName || managerId}
                    </div>
                  </div>
                  <div className="text-green-400 font-bold text-lg">
                    {points.toLocaleString()} pts
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );

  const renderPositionScarcity = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <svg
          className="w-6 h-6 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <h4 className="text-xl font-bold text-white">
          Position Scarcity Analysis
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(analytics.positionScarcity).map(([position, data]) => {
          const positionColors = getPositionColors(position);
          const scarcityPercentage =
            typeof data.scarcity === "number" && !isNaN(data.scarcity)
              ? data.scarcity * 100
              : 0;

          return (
            <div
              key={position}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`px-3 py-1 rounded-full text-sm font-bold border ${getPositionBadgeColor(
                    position
                  )}`}
                >
                  {position}
                </div>
                <div
                  className={`text-2xl font-bold ${
                    positionColors.split(" ")[1]
                  }`}
                >
                  {scarcityPercentage.toFixed(1)}%
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Drafted:</span>
                  <span className="text-white font-medium">{data.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Remaining:</span>
                  <span className="text-white font-medium">
                    {data.remaining}
                  </span>
                </div>

                {/* Scarcity Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Scarcity Level</span>
                    <span>
                      {scarcityPercentage > 50
                        ? "High"
                        : scarcityPercentage > 25
                        ? "Medium"
                        : "Low"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        positionColors.split(" ")[0]
                      }`}
                      style={{ width: `${Math.min(100, scarcityPercentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderValueDropoffs = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <svg
          className="w-6 h-6 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 17h8m0 0V9m0 8l-8-8-4 4-6 6"
          />
        </svg>
        <h4 className="text-xl font-bold text-white">Position Tier Analysis</h4>
        <div className="text-sm text-gray-400">
          (Tiers break at 30pt total drop or 10pt single drop)
        </div>
      </div>

      {Object.keys(analytics.valueDropoffs).length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
          <svg
            className="w-12 h-12 text-gray-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-gray-400">
            No tier analysis available. Complete the draft to see position tier
            breakdowns.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {Object.entries(analytics.valueDropoffs).map(([position, data]) => {
            const positionColors = getPositionColors(position);
            const {
              tiers = [],
              dropoffs = [],
              totalTiers = 0,
              positionDepth = 0,
            } = data;

            return (
              <div
                key={position}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-bold border ${getPositionBadgeColor(
                        position
                      )}`}
                    >
                      {position}
                    </div>
                    <h5 className="text-lg font-semibold text-white">
                      Tier Analysis
                    </h5>
                  </div>
                  <div className="text-right text-sm text-gray-400">
                    <div>{totalTiers} Tiers</div>
                    <div>{positionDepth} Players</div>
                  </div>
                </div>

                {/* Tier Overview */}
                <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                  <div className="text-sm font-medium text-gray-300 mb-2">
                    Tier Breakdown:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tiers.map((tier, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-1 text-xs"
                      >
                        <div
                          className={`w-3 h-3 rounded-full ${
                            positionColors.split(" ")[0]
                          }`}
                          style={{ opacity: 1 - index * 0.15 }}
                        ></div>
                        <span className="text-gray-300">
                          T{tier.tierNumber}: {tier.players.length}p
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tier Dropoffs */}
                <div className="space-y-3">
                  {dropoffs.length > 0 ? (
                    dropoffs.map((dropoff, index) => (
                      <div
                        key={index}
                        className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="text-sm font-medium text-gray-300">
                            {dropoff.tierBreak}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-bold ${
                                dropoff.significance === "Major"
                                  ? "bg-red-600 text-white"
                                  : dropoff.significance === "Significant"
                                  ? "bg-yellow-600 text-white"
                                  : "bg-green-600 text-white"
                              }`}
                            >
                              {dropoff.significance}
                            </span>
                            <div
                              className={`text-lg font-bold ${
                                dropoff.dropoff > 20
                                  ? "text-red-400"
                                  : dropoff.dropoff > 10
                                  ? "text-yellow-400"
                                  : "text-green-400"
                              }`}
                            >
                              -{dropoff.dropoff.toFixed(1)} pts
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                            <div className="text-gray-400">
                              Tier {dropoff.fromTier.number} (Last):
                            </div>
                            <div className="text-white font-medium">
                              {dropoff.fromTier.lastPlayer}
                            </div>
                            <div className="text-gray-300">
                              {dropoff.fromTier.points.toFixed(1)} pts • Pick #
                              {dropoff.fromTier.pickNumber}
                            </div>
                            <div className="text-gray-400">
                              {dropoff.fromTier.playerCount} players in tier
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-gray-400">
                              Tier {dropoff.toTier.number} (First):
                            </div>
                            <div className="text-white font-medium">
                              {dropoff.toTier.firstPlayer}
                            </div>
                            <div className="text-gray-300">
                              {dropoff.toTier.points.toFixed(1)} pts • Pick #
                              {dropoff.toTier.pickNumber}
                            </div>
                            <div className="text-gray-400">
                              {dropoff.toTier.playerCount} players in tier
                            </div>
                          </div>
                        </div>

                        {/* Tier Start Comparison */}
                        {dropoff.tierStartDropoff !== dropoff.dropoff && (
                          <div className="mt-2 pt-2 border-t border-gray-600">
                            <div className="text-xs text-gray-400">
                              Tier start dropoff:{" "}
                              <span className="text-yellow-400 font-medium">
                                -{dropoff.tierStartDropoff.toFixed(1)} pts
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500 text-sm">
                        {tiers.length > 0
                          ? `Single tier detected (${
                              tiers[0]?.players.length || 0
                            } players)`
                          : "No tier analysis available for this position yet."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderOptimalPicks = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <svg
          className="w-6 h-6 text-yellow-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
        <h4 className="text-xl font-bold text-white">
          Optimal Picks (Score over 80)
        </h4>
      </div>

      {analytics.optimalPicks.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
          <svg
            className="w-12 h-12 text-gray-500 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.5-.816-6.207-2.175.168-.288.336-.576.504-.864C7.798 10.64 9.798 10 12 10s4.202.64 5.703 1.961c.168.288.336.576.504.864A7.962 7.962 0 0112 15z"
            />
          </svg>
          <p className="text-gray-400">
            No optimal picks found yet. Complete the draft to see high-scoring
            selections.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {analytics.optimalPicks.map((pick, index) => {
            const positionColors = getPositionColors(
              pick.player.player_info.position
            );

            return (
              <div
                key={index}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="bg-yellow-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                      #{pick.pickNumber}
                    </div>
                    <div>
                      <div className="text-white font-semibold">
                        {pick.managerName}
                      </div>
                      <div className="text-gray-400 text-sm">
                        Pick #{pick.pickNumber}
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-600 text-white px-3 py-1 rounded-full font-bold text-sm">
                    {Math.round(pick.score)}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="text-lg font-bold text-white">
                      {pick.player.player_info.name}
                    </div>
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-medium border ${getPositionBadgeColor(
                        pick.player.player_info.position
                      )}`}
                    >
                      {pick.player.player_info.position}
                    </div>
                  </div>
                  <div className="text-green-400 font-semibold">
                    {pick.player.seasons?.[
                      "2025"
                    ]?.season_projected_totals?.pts_half_ppr?.toFixed(1) ||
                      0}{" "}
                    pts
                  </div>
                </div>

                <div className="bg-gray-700 rounded-lg p-3">
                  <p className="text-gray-300 text-sm italic">
                    {pick.reasoning}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderTabs = () => (
    <div className="flex space-x-1 bg-gray-700 p-1 rounded-lg">
      <button
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          activeTab === "overview"
            ? "bg-blue-600 text-white shadow-lg"
            : "text-gray-300 hover:text-white hover:bg-gray-600"
        }`}
        onClick={() => setActiveTab("overview")}
      >
        Overview
      </button>
      <button
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          activeTab === "scarcity"
            ? "bg-blue-600 text-white shadow-lg"
            : "text-gray-300 hover:text-white hover:bg-gray-600"
        }`}
        onClick={() => setActiveTab("scarcity")}
      >
        Position Scarcity
      </button>
      <button
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          activeTab === "dropoffs"
            ? "bg-blue-600 text-white shadow-lg"
            : "text-gray-300 hover:text-white hover:bg-gray-600"
        }`}
        onClick={() => setActiveTab("dropoffs")}
      >
        Value Dropoffs
      </button>
      <button
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          activeTab === "optimal"
            ? "bg-blue-600 text-white shadow-lg"
            : "text-gray-300 hover:text-white hover:bg-gray-600"
        }`}
        onClick={() => setActiveTab("optimal")}
      >
        Optimal Picks
      </button>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return renderOverview();
      case "scarcity":
        return renderPositionScarcity();
      case "dropoffs":
        return renderValueDropoffs();
      case "optimal":
        return renderOptimalPicks();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <svg
              className="w-7 h-7 mr-3 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Draft Analytics
          </h2>
        </div>
        {renderTabs()}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">{renderContent()}</div>
    </div>
  );
}
