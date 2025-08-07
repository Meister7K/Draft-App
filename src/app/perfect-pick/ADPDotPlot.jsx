"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import * as d3 from "d3";

const ADPDotPlot = ({ playerData, currentPicks }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Toggle states for positions and trend lines
  const [visiblePositions, setVisiblePositions] = useState({
    QB: true,
    RB: true,
    WR: true,
    TE: true
  });
  const [showTrendLines, setShowTrendLines] = useState(true);

  // Get drafted player IDs
  const draftedPlayerIds = useMemo(() => {
    return new Set(currentPicks.map((pick) => pick.player_id));
  }, [currentPicks]);

  // Filter players with ADP < 300 and prepare data
  const plotData = useMemo(() => {
    if (!playerData || !Array.isArray(playerData)) return [];

    return playerData
      .filter((player) => player.adp < 300 && player.adp !== 999)
      .filter((player) => visiblePositions[player.pos]) // Filter by visible positions
      .map((player) => ({
        ...player,
        isDrafted: draftedPlayerIds.has(player.id),
      }));
  }, [playerData, draftedPlayerIds, visiblePositions]);

  // Position colors
  const positionColors = {
    QB: "#ef4444",
    RB: "#3b82f6", 
    WR: "#22c55e",
    TE: "#ec4899",
  };

  // Chart dimensions
  const width = containerWidth;
  const height = Math.max(400, Math.min(600, containerWidth * 0.6));
  const margin = { top: 40, right: 40, bottom: 60, left: 80 };

  // Handle responsive width
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(Math.max(600, Math.min(width - 32, 1200)));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle functions
  const togglePosition = (position) => {
    setVisiblePositions(prev => ({
      ...prev,
      [position]: !prev[position]
    }));
  };

  const toggleAllPositions = () => {
    const allVisible = Object.values(visiblePositions).every(v => v);
    const newState = allVisible ? 
      { QB: false, RB: false, WR: false, TE: false } : 
      { QB: true, RB: true, WR: true, TE: true };
    setVisiblePositions(newState);
  };

  // Calculate trend lines
  const trendLines = useMemo(() => {
    const positions = ['QB', 'RB', 'WR', 'TE'];
    const trends = {};

    positions.forEach(pos => {
      const positionData = plotData.filter(p => p.pos === pos && !p.isDrafted);
      if (positionData.length < 3) return;

      const n = positionData.length;
      const sumX = positionData.reduce((sum, p) => sum + p.adp, 0);
      const sumY = positionData.reduce((sum, p) => sum + p.fpts, 0);
      const sumXY = positionData.reduce((sum, p) => sum + (p.adp * p.fpts), 0);
      const sumXX = positionData.reduce((sum, p) => sum + (p.adp * p.adp), 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      const minADPForPos = Math.min(...positionData.map(p => p.adp));
      const maxADPForPos = Math.max(...positionData.map(p => p.adp));
      
      trends[pos] = {
        slope,
        intercept,
        data: positionData,
        minADP: minADPForPos,
        maxADP: maxADPForPos,
        color: positionColors[pos]
      };
    });

    return trends;
  }, [plotData, positionColors]);

  // D3 Chart Effect
  useEffect(() => {
    if (!plotData.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Create scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(plotData, d => d.adp))
      .range([margin.left, width - margin.right])
      .nice();

    const yScale = d3.scaleLinear()
      .domain(d3.extent(plotData, d => d.fpts))
      .range([height - margin.bottom, margin.top])
      .nice();

    // Create axes
    const xAxis = d3.axisBottom(xScale).tickSize(-height + margin.top + margin.bottom);
    const yAxis = d3.axisLeft(yScale).tickSize(-width + margin.left + margin.right);

    // Add grid lines
    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .selectAll("line")
      .attr("stroke", "#374151")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.5);

    svg.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(yAxis)
      .selectAll("line")
      .attr("stroke", "#374151")
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.5);

    // Style grid text
    svg.selectAll(".grid text")
      .attr("fill", "#9ca3af")
      .attr("font-size", "12px");

    svg.selectAll(".grid path")
      .attr("stroke", "#9ca3af")
      .attr("stroke-width", 2);

    // Add trend lines (only if showTrendLines is true)
    if (showTrendLines) {
      Object.entries(trendLines).forEach(([pos, trend]) => {
        const line = d3.line()
          .x(d => xScale(d.adp))
          .y(d => yScale(d.fpts));

        const trendData = [
          { adp: trend.minADP, fpts: trend.slope * trend.minADP + trend.intercept },
          { adp: trend.maxADP, fpts: trend.slope * trend.maxADP + trend.intercept }
        ];

        svg.append("path")
          .datum(trendData)
          .attr("fill", "none")
          .attr("stroke", trend.color)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,5")
          .attr("opacity", 0.7)
          .attr("d", line);
      });
    }

    // Create tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "d3-tooltip")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000");

    // Add data points
    svg.selectAll(".dot")
      .data(plotData)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("cx", d => xScale(d.adp))
      .attr("cy", d => yScale(d.fpts))
      .attr("r", 4)
      .attr("fill", d => d.isDrafted ? "#000000" : positionColors[d.pos])
      .attr("stroke", d => d.isDrafted ? "#6b7280" : "none")
      .attr("stroke-width", d => d.isDrafted ? 1 : 0)
      .attr("opacity", d => d.isDrafted ? 0.7 : 0.8)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr("r", 6)
          .attr("opacity", 1);

        tooltip
          .style("visibility", "visible")
          .html(`
            <div><strong>${d.name}</strong> (${d.pos}) - ${d.team}</div>
            <div>ADP: ${d.adp.toFixed(1)}</div>
            <div>Projected: ${d.fpts.toFixed(1)} pts</div>
            ${d.isDrafted ? '<div style="color: #ef4444;">[DRAFTED]</div>' : ''}
          `);
      })
      .on("mousemove", function(event) {
        tooltip
          .style("top", (event.pageY - 10) + "px")
          .style("left", (event.pageX + 10) + "px");
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr("r", 4)
          .attr("opacity", d => d.isDrafted ? 0.7 : 0.8);

        tooltip.style("visibility", "hidden");
      });

    // Add axis labels
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .attr("fill", "#f3f4f6")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text("ADP (Average Draft Position)");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", "#f3f4f6")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text("Projected Fantasy Points");

    // Cleanup tooltip on unmount
    return () => {
      d3.select(".d3-tooltip").remove();
    };

  }, [plotData, trendLines, width, height, margin, positionColors, showTrendLines]);

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            ADP vs Projected Fantasy Points
          </h2>
          <p className="text-gray-300 text-sm">
            Players with ADP &lt; 300 only. Drafted players are shown in black. Hover over points for details.
          </p>
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isMinimized ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
          <span>{isMinimized ? 'Expand' : 'Minimize'}</span>
        </button>
      </div>

      {!isMinimized && (
        <>
          {/* Interactive Legend */}
          <div className="mb-6 space-y-4">
        {/* Position toggles */}
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <span className="text-white font-medium">Positions:</span>
            <button
              onClick={toggleAllPositions}
              className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              {Object.values(visiblePositions).every(v => v) ? 'Hide All' : 'Show All'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {Object.entries(positionColors).map(([pos, color]) => (
              <button
                key={pos}
                onClick={() => togglePosition(pos)}
                className={`flex items-center gap-2 px-3 py-1 rounded transition-all duration-200 ${
                  visiblePositions[pos] 
                    ? 'bg-gray-700 hover:bg-gray-600' 
                    : 'bg-gray-800 opacity-50 hover:opacity-75'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ 
                    backgroundColor: visiblePositions[pos] ? color : '#6b7280',
                    opacity: visiblePositions[pos] ? 1 : 0.5
                  }}
                ></div>
                <span className={`${visiblePositions[pos] ? 'text-gray-300' : 'text-gray-500'}`}>
                  {pos}
                </span>
              </button>
            ))}
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="w-4 h-4 rounded-full bg-black border border-gray-500"></div>
              <span className="text-gray-300">Drafted</span>
            </div>
          </div>
        </div>

        {/* Trend line toggle */}
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <span className="text-white font-medium">Trend Lines:</span>
            <button
              onClick={() => setShowTrendLines(!showTrendLines)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                showTrendLines 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {showTrendLines ? 'Hide Trends' : 'Show Trends'}
            </button>
          </div>
          {showTrendLines && (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {Object.entries(trendLines)
                .filter(([pos]) => visiblePositions[pos]) // Only show trends for visible positions
                .map(([pos, trend]) => (
                <div key={`trend-legend-${pos}`} className="flex items-center gap-2">
                  <svg width="20" height="8">
                    <line
                      x1="0"
                      y1="4"
                      x2="20"
                      y2="4"
                      stroke={trend.color}
                      strokeWidth="2"
                      strokeDasharray="3,2"
                    />
                  </svg>
                  <span className="text-gray-300">{pos} Trend</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div ref={containerRef} className="bg-gray-900 p-4 rounded-lg overflow-x-auto">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="text-gray-300"
        />
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-2xl font-bold text-white">
            {plotData.length}
          </div>
          <div className="text-gray-300 text-sm">Total Players</div>
        </div>
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-2xl font-bold text-white">
            {plotData.filter((p) => !p.isDrafted).length}
          </div>
          <div className="text-gray-300 text-sm">Available</div>
        </div>
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-2xl font-bold text-white">
            {plotData.filter((p) => p.isDrafted).length}
          </div>
          <div className="text-gray-300 text-sm">Drafted</div>
        </div>
        <div className="bg-gray-700 p-3 rounded">
          <div className="text-2xl font-bold text-white">
            {plotData.length > 0 ? Math.round((plotData.filter((p) => p.isDrafted).length / plotData.length) * 100) : 0}%
          </div>
          <div className="text-gray-300 text-sm">Drafted %</div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default ADPDotPlot;