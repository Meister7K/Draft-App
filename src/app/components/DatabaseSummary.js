"use client";

import { useState, useEffect, useRef } from "react";
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// Helper to calculate mean
const calculateMean = (dataArray) => {
    if (dataArray.length === 0) return 0;
    const sum = dataArray.reduce((acc, val) => acc + val, 0);
    return sum / dataArray.length;
};

// Helper to calculate standard deviation (sample standard deviation)
const calculateStdDev = (dataArray, mean) => {
    if (dataArray.length < 2) return 0;
    const sumOfSquares = dataArray.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
    return Math.sqrt(sumOfSquares / (dataArray.length - 1));
};

// Helper for Normal Distribution Probability Density Function (PDF)
const normalPdf = (x, mean, stdDev) => {
    if (stdDev === 0) return 0; // Avoid division by zero
    const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
    const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
    return coefficient * Math.exp(exponent);
};

// Function to generate normal curve data points with dynamic scaling and X-offset
const generateNormalCurveData = (mean, stdDev, minDataVal, maxDataVal, numPoints = 100, scaleFactor = 1, xOffset = 0) => {
    if (stdDev === 0) return [];

    const curveData = [];
    const range = maxDataVal - minDataVal;

    for (let i = 0; i < numPoints; i++) {
        const data_val = minDataVal + (i / (numPoints - 1)) * range; // This is the Y-coordinate of the curve
        const pdf_val = normalPdf(data_val, mean, stdDev);
        const scaled_pdf_val = pdf_val * scaleFactor; // This is the X-coordinate of the curve's 'density'
        curveData.push({ x: xOffset + scaled_pdf_val, y: data_val }); // Store as { X-axis value, Y-axis value } for Chart.js
    }
    return curveData;
};


export function DatabaseSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState("QB");
  const [selectedYear, setSelectedYear] = useState("2024");
  const [selectedAdpType, setSelectedAdpType] = useState("adp_2qb");
  const [availablePositions, setAvailablePositions] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);

  // Refs for Chart.js canvases
  const chart1Ref = useRef(null);
  let chart1Instance = useRef(null);
  const chart2Ref = useRef(null); // New ref for the second chart
  let chart2Instance = useRef(null); // New instance for the second chart
  const chart3Ref = useRef(null); // Ref for the third chart
  let chart3Instance = useRef(null); // Instance for the third chart


  // Define a color map for positions
  const positionColors = {
    QB: "#FF5733", // Red-orange
    RB: "#337AFF", // Blue
    WR: "#33FF57", // Green
    TE: "#FF33DA", // Pink/Magenta
    K: "#33FFF0", // Cyan
    DEF: "#FFBD33", // Orange
    // Add more positions and colors as needed
    default: "#888888", // Grey for unknown positions
  };

  // Define available ADP types with labels for the dropdown
  const adpTypes = [
    { value: "adp_2qb", label: "ADP (2QB)" },
    { value: "adp_dynasty", label: "ADP (Dynasty)" },
    { value: "adp_dynasty_2qb", label: "ADP (Dynasty 2QB)" },
    { value: "adp_dynasty_half_ppr", label: "ADP (Dynasty Half-PPR)" },
    { value: "adp_dynasty_ppr", label: "ADP (Dynasty PPR)" },
    { value: "adp_dynasty_std", label: "ADP (Dynasty Standard)" },
    { value: "adp_half_ppr", label: "ADP (Half-PPR)" },
    { value: "adp_idp", label: "ADP (IDP)" },
    { value: "adp_ppr", label: "ADP (PPR)" },
    { value: "adp_rookie", label: "ADP (Rookie)" },
    { value: "adp_std", label: "ADP (Standard)" },
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch("/api/process-fantasy-data");
        if (!response.ok) {
          throw new Error("Failed to load fantasy data");
        }
        const jsonData = await response.json();
        console.log("API Response:", jsonData);
        console.log("Players sample:", jsonData.players?.slice(0, 2));
        setData(jsonData);

        // Extract available positions and years
        const positions = new Set();
        const years = new Set();

        jsonData.players.forEach((player) => {
          if (player.player_info.position) {
            positions.add(player.player_info.position);
          }
          Object.keys(player.seasons).forEach((year) => {
            years.add(year);
          });
        });

        console.log("Available positions:", Array.from(positions));
        console.log("Available years:", Array.from(years));

        setAvailablePositions(Array.from(positions).sort());
        setAvailableYears(Array.from(years).sort((a, b) => b - a));

        // Set default year to most recent available
        if (years.size > 0) {
          setSelectedYear(Array.from(years).sort((a, b) => b - a)[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Get filtered data for the Fantasy Points vs Projected Points dot plot
  const getFantasyVsProjectedPlotData = () => {
    if (!data || !data.players) {
      return [];
    }

    const filteredPlayers = data.players.filter(
      (player) => player.player_info.position === selectedPosition
    );

    const mappedData = filteredPlayers.map((player) => {
      const seasonData = player.seasons[selectedYear];
      return {
        name: player.player_info.name,
        team: player.player_info.team,
        player_id: player.player_info.player_id,
        fantasy_points: seasonData?.fantasy_points || 0,
        projected_fantasy_points: seasonData?.projected_fantasy_points || 0,
        overall_rank: player.player_info.overall_rank,
        position_rank: player.player_info.position_rank,
        position: player.player_info.position,
      };
    });

    const filteredData = mappedData.filter(
      (player) =>
        player.fantasy_points > 0 || player.projected_fantasy_points > 0
    );

    return filteredData.sort(
      (a, b) =>
        b.fantasy_points +
        b.projected_fantasy_points -
        (a.fantasy_points + a.projected_fantasy_points)
    );
  };

  // Get filtered data for the ADP vs Projected Points dot plot
  const getAdpVsProjectedPlotData = () => {
    if (!data || !data.players) {
      return [];
    }

    const mappedData = data.players.map((player) => {
      const seasonData = player.seasons[selectedYear];
      const adp = seasonData?.season_projected_totals?.[selectedAdpType] || 999;
      return {
        name: player.player_info.name,
        team: player.player_info.team,
        player_id: player.player_id,
        projected_fantasy_points: seasonData?.projected_fantasy_points || 0,
        adp: adp,
        position: player.player_info.position,
      };
    });

    const filteredData = mappedData.filter(
      (player) => player.projected_fantasy_points > 0 && player.adp > 0 && player.adp !== 999
    );

    return filteredData.sort((a, b) => a.adp - b.adp);
  };

  // Get filtered data for the ADP vs Actual Fantasy Points dot plot
  const getActualVsAdpPlotData = () => {
    if (!data || !data.players) {
      return [];
    }

    const mappedData = data.players.map((player) => {
      const seasonData = player.seasons[selectedYear];
      const adp = seasonData?.season_projected_totals?.[selectedAdpType] || 999;
      return {
        name: player.player_info.name,
        team: player.player_info.team,
        player_id: player.player_id,
        fantasy_points: seasonData?.fantasy_points || 0,
        adp: adp,
        position: player.player_info.position,
      };
    });

    const filteredData = mappedData.filter(
      (player) => player.fantasy_points > 0 && player.adp > 0 && player.adp !== 999
    );

    return filteredData.sort((a, b) => a.adp - b.adp);
  };


  const fantasyVsProjectedPlotData = getFantasyVsProjectedPlotData();
  const adpVsProjectedPlotData = getAdpVsProjectedPlotData();
  const actualVsAdpPlotData = getActualVsAdpPlotData();

  // Get the label for the currently selected ADP type
  const currentAdpLabel = adpTypes.find(type => type.value === selectedAdpType)?.label || "ADP";

  // Chart.js - Actual vs Projected Fantasy Points (Chart 1) - Now with Normal Curve
  useEffect(() => {
    if (!chart1Ref.current || fantasyVsProjectedPlotData.length === 0) return;

    if (chart1Instance.current) {
      chart1Instance.current.destroy();
    }

    const ctx = chart1Ref.current.getContext('2d');

    const datasets = [];

    // Scatter data for Chart 1
    const scatterData = fantasyVsProjectedPlotData.map(player => ({
      x: player.fantasy_points,
      y: player.projected_fantasy_points,
      name: player.name,
      team: player.team,
      isTopRanked: player.overall_rank && player.overall_rank <= 50,
    }));

    // Separate datasets for top-ranked and other players for distinct styling
    const topRankedData = scatterData.filter(p => p.isTopRanked);
    const otherPlayersData = scatterData.filter(p => !p.isTopRanked);

    datasets.push({
        label: 'Top 50 Overall Rank',
        data: topRankedData,
        backgroundColor: '#ec2e50',
        borderColor: '#ec2e50',
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#ec2e50',
        pointBorderColor: '#ec2e50',
        type: 'scatter',
    });
    datasets.push({
        label: 'Other Players',
        data: otherPlayersData,
        backgroundColor: '#60a5fa', // blue-400
        borderColor: '#3b82f6', // blue-500
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#60a5fa',
        pointBorderColor: '#3b82f6',
        type: 'scatter',
    });


    // Diagonal line data
    const maxVal = Math.max(
      ...scatterData.map(p => p.x),
      ...scatterData.map(p => p.y),
      1
    );
    const diagonalLineData = [{x: 0, y: 0}, {x: maxVal, y: maxVal}];

    datasets.push({
        label: 'Perfect Prediction',
        data: diagonalLineData,
        type: 'line', // This is a line dataset
        borderColor: 'var(--primary)',
        borderWidth: 1,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0, // Hide points on this line
    });

    // Add Normal Curve for Chart 1 (for projected_fantasy_points of the selected position)
    const projectedPointsValues = fantasyVsProjectedPlotData.map(p => p.projected_fantasy_points);
    if (projectedPointsValues.length >= 2) {
        const mean = calculateMean(projectedPointsValues);
        const stdDev = calculateStdDev(projectedPointsValues, mean);

        if (stdDev !== 0) {
            const curveMinY = mean - 3 * stdDev;
            const curveMaxY = mean + 3 * stdDev;

            // Determine scale factor based on the overall X-axis range (Fantasy Points)
            const maxActualPoints = Math.max(...scatterData.map(p => p.x), 1);
            const targetHorizontalExtent = maxActualPoints * 0.1; // Make curve about 10% of chart width

            const peakPdfValue = normalPdf(mean, mean, stdDev);
            const actualScaleFactor = peakPdfValue > 0 ? targetHorizontalExtent / peakPdfValue : 0;

            // Offset the curve slightly from the Y-axis (left edge)
            const xOffset = maxActualPoints * 0.01;

            const normalCurveData = generateNormalCurveData(mean, stdDev, curveMinY, curveMaxY, 100, actualScaleFactor, xOffset);
            
            if (normalCurveData.length > 0) {
                datasets.push({
                    label: `${selectedPosition} Projected Points Distribution`,
                    data: normalCurveData,
                    type: 'line',
                    borderColor: positionColors[selectedPosition] || positionColors.default,
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    xAxisID: 'x',
                    yAxisID: 'y'
                });
            }
        }
    }


    chart1Instance.current = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.dataset.type === 'line' && context.dataset.label.includes('Distribution')) {
                    return `${context.dataset.label} (Value: ${context.raw.y.toFixed(1)}, Density Scale: ${context.raw.x.toFixed(2)})`;
                }
                const player = context.raw;
                let label = `${player.name} (${player.team})`;
                label += `\nFantasy Points: ${player.x.toFixed(1)}`;
                label += `\nProjected Points: ${player.y.toFixed(1)}`;
                if (player.isTopRanked) {
                  label += `\nOverall Rank: Top 50`;
                }
                return label.split('\n');
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: `Fantasy Points (${selectedYear})`,
              color: '#E0E0E0' // Fixed light color for visibility
            },
            grid: {
                color: 'rgba(var(--border-rgb), 0.3)',
            },
            ticks: {
                color: '#E0E0E0' // Fixed light color for visibility
            }
          },
          y: {
            type: 'linear',
            title: {
              display: true,
              text: `Projected Fantasy Points (${selectedYear})`,
              color: '#E0E0E0' // Fixed light color for visibility
            },
            grid: {
                color: 'rgba(var(--border-rgb), 0.3)',
            },
            ticks: {
                color: '#E0E0E0' // Fixed light color for visibility
            }
          }
        }
      }
    });

    return () => {
      if (chart1Instance.current) {
        chart1Instance.current.destroy();
      }
    };
  }, [fantasyVsProjectedPlotData, selectedYear, selectedPosition, positionColors]);


  // Chart.js - ADP vs Projected Fantasy Points (Chart 2) - Now with Normal Curves
  useEffect(() => {
    if (!chart2Ref.current || adpVsProjectedPlotData.length === 0) return;

    if (chart2Instance.current) {
      chart2Instance.current.destroy();
    }

    const ctx = chart2Ref.current.getContext('2d');

    const datasets = [];
    const positionsUnique = [...new Set(adpVsProjectedPlotData.map(p => p.position))].sort();

    // Determine the overall ADP range for dynamic scaling of normal curves
    const maxOverallADP = Math.max(...adpVsProjectedPlotData.map(p => p.adp), 1);
    const minOverallADP = Math.min(...adpVsProjectedPlotData.map(p => p.adp), 0);
    const adpRange = maxOverallADP - minOverallADP;

    // Target the curve's peak to extend a certain percentage of the ADP range horizontally
    const targetHorizontalExtentFraction = 0.2; // 20% of the ADP range
    const targetHorizontalExtent = adpRange * targetHorizontalExtentFraction;


    // Add scatter data for each position
    positionsUnique.forEach(pos => {
        const dataForPosition = adpVsProjectedPlotData.filter(p => p.position === pos);
        datasets.push({
            label: pos, // Label for the scatter points of this position
            data: dataForPosition.map(player => ({
                x: player.adp,
                y: player.projected_fantasy_points,
                name: player.name,
                team: player.team,
                position: player.position,
            })),
            backgroundColor: positionColors[pos] || positionColors.default,
            borderColor: positionColors[pos] || positionColors.default,
            pointRadius: 4,
            pointHoverRadius: 6,
            type: 'scatter', // Explicitly set type to scatter for this dataset
        });
    });

    // Add normal curve data for each position
    positionsUnique.forEach(pos => {
        const dataForPosition = adpVsProjectedPlotData.filter(p => p.position === pos);
        const projectedPointsValues = dataForPosition.map(p => p.projected_fantasy_points);
        
        if (projectedPointsValues.length < 2) return; // Need at least 2 points for std dev calculation

        const mean = calculateMean(projectedPointsValues);
        const stdDev = calculateStdDev(projectedPointsValues, mean);

        if (stdDev === 0) return;

        // Define the range for the y-axis of the curve (Projected Fantasy Points)
        const curveMinY = mean - 3 * stdDev;
        const curveMaxY = mean + 3 * stdDev;

        const peakPdfValue = normalPdf(mean, mean, stdDev);
        const actualScaleFactor = peakPdfValue > 0 ? targetHorizontalExtent / peakPdfValue : 0;

        // X-offset for these curves will be near the min ADP for that position, or a fixed small ADP value
        // Let's use a fixed small ADP value for visual consistency for all curves on chart 2
        const xOffsetForCurve = minOverallADP + adpRange * 0.01; // Offset slightly from the left edge

        const normalCurveData = generateNormalCurveData(mean, stdDev, curveMinY, curveMaxY, 100, actualScaleFactor, xOffsetForCurve);
        
        if (normalCurveData.length > 0) {
            datasets.push({
                label: `${pos} Normal Curve`,
                data: normalCurveData, // Data is now { x: scaled_pdf_value, y: projected_points_value }
                type: 'line', // This is a line dataset
                borderColor: positionColors[pos] || positionColors.default,
                borderWidth: 1.5,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0, // Hide points on this line
                xAxisID: 'x', // Scaled PDF values map to the X-axis (ADP)
                yAxisID: 'y'  // Projected Fantasy Points values map to the Y-axis (Projected Points)
            });
        }
    });

    chart2Instance.current = new Chart(ctx, {
      type: 'scatter', // Default type, but datasets can override
      data: {
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.dataset.type === 'line') {
                    // Tooltip for normal curve
                    return `${context.dataset.label} (Value: ${context.raw.y.toFixed(1)}, Density Scale: ${context.raw.x.toFixed(2)})`;
                }
                const player = context.raw;
                let label = `${player.name} (${player.team})`;
                label += `\nPosition: ${player.position}`;
                label += `\nProjected Points: ${player.y.toFixed(1)}`;
                label += `\n${currentAdpLabel}: ${player.x}`;
                return label.split('\n');
              }
            }
          }
        },
        scales: {
          x: { // This is the ADP axis (scatter X)
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: currentAdpLabel,
              color: '#E0E0E0' // Fixed light color for visibility
            },
            grid: {
                color: 'rgba(var(--border-rgb), 0.3)',
            },
            ticks: {
                color: '#E0E0E0' // Fixed light color for visibility
            }
          },
          y: { // This is the Projected Fantasy Points axis (scatter Y)
            type: 'linear',
            title: {
              display: true,
              text: `Projected Fantasy Points (${selectedYear})`,
              color: '#E0E0E0' // Fixed light color for visibility
            },
            grid: {
                color: 'rgba(var(--border-rgb), 0.3)',
            },
            ticks: {
                color: '#E0E0E0' // Fixed light color for visibility
            }
          }
        }
      }
    });

    return () => {
      if (chart2Instance.current) {
        chart2Instance.current.destroy();
      }
    };
  }, [adpVsProjectedPlotData, selectedYear, currentAdpLabel, positionColors]);

  // Chart.js - ADP vs Actual Fantasy Points (Chart 3) - Now using Chart.js with Normal Curves
  useEffect(() => {
    if (!chart3Ref.current || actualVsAdpPlotData.length === 0) return;

    if (chart3Instance.current) {
        chart3Instance.current.destroy();
    }

    const ctx = chart3Ref.current.getContext('2d');

    const datasets = [];
    const positionsUniqueChart3 = [...new Set(actualVsAdpPlotData.map(p => p.position))].sort();

    // Determine the overall ADP range for dynamic scaling of normal curves on Chart 3
    const maxOverallADPChart3 = Math.max(...actualVsAdpPlotData.map(p => p.adp), 1);
    const minOverallADPChart3 = Math.min(...actualVsAdpPlotData.map(p => p.adp), 0);
    const adpRangeChart3 = maxOverallADPChart3 - minOverallADPChart3;

    // Target the curve's peak to extend a certain percentage of the ADP range horizontally
    const targetHorizontalExtentFractionChart3 = 0.2; // 20% of the ADP range
    const targetHorizontalExtentChart3 = adpRangeChart3 * targetHorizontalExtentFractionChart3;


    // Add scatter data for each position
    positionsUniqueChart3.forEach(pos => {
        const dataForPosition = actualVsAdpPlotData.filter(p => p.position === pos);
        datasets.push({
            label: pos,
            data: dataForPosition.map(player => ({
                x: player.adp, // ADP on X-axis
                y: player.fantasy_points, // Actual Fantasy Points on Y-axis
                name: player.name,
                team: player.team,
                position: player.position,
            })),
            backgroundColor: positionColors[pos] || positionColors.default,
            borderColor: positionColors[pos] || positionColors.default,
            pointRadius: 4,
            pointHoverRadius: 6,
            type: 'scatter',
        });
    });

    // Add normal curve data for each position on Chart 3
    positionsUniqueChart3.forEach(pos => {
        const dataForPosition = actualVsAdpPlotData.filter(p => p.position === pos);
        const fantasyPointsValues = dataForPosition.map(p => p.fantasy_points);
        
        if (fantasyPointsValues.length < 2) return; 

        const mean = calculateMean(fantasyPointsValues);
        const stdDev = calculateStdDev(fantasyPointsValues, mean);

        if (stdDev === 0) return;

        // Define the range for the y-axis of the curve (Actual Fantasy Points)
        const curveMinY = mean - 3 * stdDev;
        const curveMaxY = mean + 3 * stdDev;

        const peakPdfValue = normalPdf(mean, mean, stdDev);
        const actualScaleFactor = peakPdfValue > 0 ? targetHorizontalExtentChart3 / peakPdfValue : 0;

        // X-offset for these curves will be near the min ADP for visual clarity
        const xOffsetForCurve = minOverallADPChart3 + adpRangeChart3 * 0.01;

        const normalCurveData = generateNormalCurveData(mean, stdDev, curveMinY, curveMaxY, 100, actualScaleFactor, xOffsetForCurve);
        
        if (normalCurveData.length > 0) {
            datasets.push({
                label: `${pos} Normal Curve`,
                data: normalCurveData,
                type: 'line',
                borderColor: positionColors[pos] || positionColors.default,
                borderWidth: 1.5,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0,
                xAxisID: 'x',
                yAxisID: 'y'
            });
        }
    });


    chart3Instance.current = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.type === 'line') {
                                return `${context.dataset.label} (Value: ${context.raw.y.toFixed(1)}, Density Scale: ${context.raw.x.toFixed(2)})`;
                            }
                            const player = context.raw;
                            let label = `${player.name} (${player.team})`;
                            label += `\nPosition: ${player.position}`;
                            label += `\nActual Points: ${player.y.toFixed(1)}`;
                            label += `\n${currentAdpLabel}: ${player.x}`;
                            return label.split('\n');
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: currentAdpLabel,
                        color: '#E0E0E0'
                    },
                    grid: {
                        color: 'rgba(var(--border-rgb), 0.3)',
                    },
                    ticks: {
                        color: '#E0E0E0'
                    }
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: `Actual Fantasy Points (${selectedYear})`,
                        color: '#E0E0E0'
                    },
                    grid: {
                        color: 'rgba(var(--border-rgb), 0.3)',
                    },
                    ticks: {
                        color: '#E0E0E0'
                    }
                }
            }
        }
    });

    return () => {
        if (chart3Instance.current) {
            chart3Instance.current.destroy();
        }
    };
  }, [actualVsAdpPlotData, selectedYear, currentAdpLabel, positionColors]);


  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-400 text-red-300 rounded-lg bg-red-900/60 card">
        Error: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 border border-yellow-400 text-yellow-300 rounded-lg bg-yellow-900/60 card">
        No data available
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 text-[var(--foreground)]">
          Fantasy Data Visualizations
        </h2>
        <p className="opacity-80">
          Interactive dot plots showing various fantasy football metrics.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--foreground)]">
            Position:
          </label>
          <select
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
            className="border border-[var(--border)] rounded px-3 py-2 bg-[var(--background)] text-[var(--foreground)]"
          >
            {availablePositions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--foreground)]">
            Year:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="border border-[var(--border)] rounded px-3 py-2 bg-[var(--background)] text-[var(--foreground)]"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* New ADP Type Filter */}
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--foreground)]">
            ADP Type:
          </label>
          <select
            value={selectedAdpType}
            onChange={(e) => setSelectedAdpType(e.target.value)}
            className="border border-[var(--border)] rounded px-3 py-2 bg-[var(--background)] text-[var(--foreground)]"
          >
            {adpTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-sm opacity-80">
          {fantasyVsProjectedPlotData.length} players shown for current position
        </div>
      </div>

      {/* Charts Container */}
      <div className="mb-12 flex flex-wrap lg:flex-nowrap gap-6 justify-center">
        {/* First Dot Plot: Actual vs Projected Fantasy Points (Chart.js) */}
        <div className="flex-1 min-w-[500px] h-[400px]">
          <h3 className="text-xl font-semibold mb-3 text-[var(--foreground)] text-center">
            Actual vs Projected Fantasy Points
          </h3>
          <div className="relative h-full w-full border border-[var(--border)] rounded bg-[var(--background)]">
            <canvas ref={chart1Ref}></canvas>
          </div>
        </div>

        {/* Second Dot Plot: ADP vs Projected Points (Chart.js) */}
        <div className="flex-1 min-w-[500px] h-[400px]">
          <h3 className="text-xl font-semibold mb-3 text-[var(--foreground)] text-center">
            {currentAdpLabel} vs Projected Fantasy Points
          </h3>
          <div className="relative h-full w-full border border-[var(--border)] rounded bg-[var(--background)]">
            <canvas ref={chart2Ref}></canvas>
          </div>
        </div>

        {/* Third Dot Plot: Actual Fantasy Points vs ADP (Chart.js) */}
        <div className="flex-1 min-w-[500px] h-[400px]">
          <h3 className="text-xl font-semibold mb-3 text-[var(--foreground)] text-center">
            Actual Fantasy Points vs {currentAdpLabel}
          </h3>
          <div className="relative h-full w-full border border-[var(--border)] rounded bg-[var(--background)]">
            <canvas ref={chart3Ref}></canvas>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-6 flex flex-wrap gap-6 text-sm justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[var(--primary)]"></div>
          <span>Top 50 Overall Rank (1st Chart)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-400"></div>
          <span>Other Players (1st Chart)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0 border-t border-[var(--primary)] border-dashed"></div>
          <span>Perfect Prediction Line (1st Chart)</span>
        </div>
        {/* Legend for position colors for 2nd and 3rd charts */}
        <div className="flex items-center gap-2 border-l pl-4 border-[var(--border)]">
            <span className="font-semibold">Positions (2nd & 3rd Charts):</span>
        </div>
        {Object.entries(positionColors).map(([pos, color]) => (
            <div key={pos} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                <span>{pos}</span>
            </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-6 h-0 border-t border-[var(--primary)] border-dashed"></div>
          <span>Normal Curve (All Charts)</span>
        </div>
      </div>

      {/* Top Performers Table */}
      <div className="border rounded-lg p-4 border-[var(--border)] bg-[var(--secondary)]">
        <h3 className="text-lg font-semibold mb-3 text-[var(--foreground)]">
          Top {selectedPosition} Players - {selectedYear}
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)]">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                  Player
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                  Team
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                  Fantasy Points
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                  Projected Points
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                  Difference
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                  Overall Rank
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">
                  {currentAdpLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {fantasyVsProjectedPlotData.slice(0, 10).map((player, index) => {
                const difference =
                  player.fantasy_points - player.projected_fantasy_points;
                // Find ADP from the adpVsProjectedPlotData for consistency or ensure it's in the current player object
                const playerAdpData = adpVsProjectedPlotData.find(p => p.player_id === player.player_id);
                const playerAdp = playerAdpData ? `#${playerAdpData.adp}` : 'N/A';

                return (
                  <tr
                    key={player.player_id}
                    className={
                      index % 2 === 0
                        ? "bg-[var(--background)]"
                        : "bg-[var(--secondary)]"
                    }
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-[var(--foreground)]">
                      {player.name}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm opacity-80">
                      {player.team}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium opacity-90">
                      {player.fantasy_points.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium opacity-90">
                      {player.projected_fantasy_points.toFixed(1)}
                    </td>
                    <td
                      className={`px-3 py-2 whitespace-nowrap text-sm font-medium ${
                        difference >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {difference >= 0 ? "+" : ""}
                      {difference.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm opacity-80">
                      #{player.overall_rank || "N/A"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm opacity-80">
                      {playerAdp}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}