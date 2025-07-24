'use client'
import React, { useState, useEffect } from 'react';
import { Search, Users, TrendingUp, Calendar, Trophy, Target, LayoutGrid, BarChart2, GitPullRequest } from 'lucide-react'; // Added GitPullRequest for new component icon
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Import existing components
import RoundTendenciesChart from '../components/RoundTendenciesChart';
import PositionalRunsChart from '../components/PositionalRunsChart';
import PositionalHeatmapChart from '../components/PositionalHeatmapChart';
import DraftSpotProbabilityHeatmap from '../components/DraftSpotHeatmap';

// Import the new component
import ManagerADPAnalysis from '../components/ManagerADPAnalysis';

// Register Chart.js components and the datalabels plugin
Chart.register(ArcElement, Tooltip, Legend, ChartDataLabels);

// Define a consistent color palette for positions
const POSITION_COLORS = {
  'QB': 'rgba(255, 99, 132, 0.7)', // Red
  'RB': 'rgba(54, 162, 235, 0.7)', // Blue
  'WR': 'rgba(255, 206, 86, 0.7)', // Yellow
  'TE': 'rgba(75, 192, 192, 0.7)', // Teal
  'K': 'rgba(153, 102, 255, 0.7)', // Purple
  'DEF': 'rgba(255, 159, 64, 0.7)', // Orange
  'DST': 'rgba(255, 159, 64, 0.7)', // Orange (same as DEF)
  'DL': 'rgba(199, 199, 199, 0.7)', // Grey
  'LB': 'rgba(80, 200, 120, 0.7)', // Greenish
  'DB': 'rgba(200, 100, 200, 0.7)', // Pinkish
  'IDP': 'rgba(100, 150, 200, 0.7)', // Light Blue
  'FLEX': 'rgba(220, 220, 50, 0.7)', // Olive
  'SUPER_FLEX': 'rgba(180, 100, 50, 0.7)', // Brown
  'Unknown': 'rgba(100, 100, 100, 0.7)', // Dark Grey for unknown
};

// A dedicated component for the position distribution pie chart
const PositionPieChart = ({ userData }) => {
  // Defensively check if positionDetails exists and has keys before rendering the chart.
  if (!userData || !userData.positionDetails || Object.keys(userData.positionDetails).length === 0) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg my-2 text-center text-gray-400">
        <p>No detailed position data available to generate a chart.</p>
        <p className="text-sm mt-2">(This can happen with older cached data or incomplete draft history.)</p>
      </div>
    );
  }

  // Prepare data for the chart
  const labels = Object.keys(userData.positionDetails);
  const data = labels.map(pos => userData.positionDetails[pos].count);
  const adps = labels.map(pos => {
    // Check if count is zero to avoid division by zero
    if (userData.positionDetails[pos].count === 0) {
      return 'N/A'; // Or some other indicator
    }
    // Calculate average draft position for the specific position
    return (userData.positionDetails[pos].totalPickNo / userData.positionDetails[pos].count).toFixed(1);
  });

  // Assign colors based on the defined POSITION_COLORS map
  const backgroundColors = labels.map(pos => POSITION_COLORS[pos] || POSITION_COLORS['Unknown']);

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Positions Drafted (Avg per Season)',
        data: data,
        backgroundColor: backgroundColors, // Use consistent colors
        borderColor: '#1f2937', // Matches dark card background
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
            color: '#e5e7eb' // Light text for dark background
        }
      },
      title: {
        display: true,
        text: `${userData.username}'s Positional Draft Strategy (Avg per Season)`,
        color: '#e5e7eb',
        font: {
            size: 16
        }
      },
      // Configure the datalabels plugin to show % and ADP
      datalabels: {
        display: true,
        formatter: (value, context) => {
          const dataset = context.chart.data.datasets[0];
          const total = dataset.data.reduce((acc, data) => acc + data, 0);
          const percentage = total === 0 ? '0.0' : ((value / total) * 100).toFixed(1);
          const adp = adps[context.dataIndex];
          // Return an array for multi-line labels
          return [`${percentage}%`, `ADP: ${adp}`];
        },
        color: '#ffffff',
        font: {
          weight: 'bold',
          size: 12,
        },
        textAlign: 'center',
      },
    },
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg my-2">
      <div style={{ position: 'relative', height: '400px', width: '100%' }}>
        <Pie data={chartData} options={options} />
      </div>
    </div>
  );
};


const SleeperDraftAnalyzer = () => {
  const [userInput, setUserInput] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leagueHistory, setLeagueHistory] = useState([]);
  const [draftData, setDraftData] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [step, setStep] = useState('search');
  const [expandedManager, setExpandedManager] = useState(null);
  const [playerData, setPlayerData] = useState(null);



  useEffect(() => {

    const loadData = async () => {
      try {
        const response = await fetch(
          "/db/fantasy_football_db.json"
        );
        if (!response.ok) {
          throw new Error("Failed to load database summary");
        }
        const jsonData = await response.json();
        setPlayerData(jsonData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
 
    //!
    try {
      const lastInput = localStorage.getItem('sleeperUserInput');
      if (lastInput) {
        setUserInput(lastInput);
      }
    } catch (err) {
      console.error("Could not read from localStorage:", err);
    }
  }, []);

  const fetchUserLeagues = async () => {
    if (!userInput || !year) {
      setError('Please enter both a Username/ID and a Year');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const cacheKey = `leagues_${userInput.toLowerCase()}_${year}`;
      const cachedLeagues = localStorage.getItem(cacheKey);
      if (cachedLeagues) {
        setLeagues(JSON.parse(cachedLeagues));
        setStep('selectLeague');
        setLoading(false);
        return;
      }
      
      let userId = userInput;
      if (isNaN(parseInt(userInput))) {
        const userResponse = await fetch(`https://api.sleeper.app/v1/user/${userInput}`);
        if (!userResponse.ok) throw new Error('Username not found.');
        const userData = await userResponse.json();
        if (!userData || !userData.user_id) throw new Error('Could not resolve username to a user ID.');
        userId = userData.user_id;
      }
      
      const response = await fetch(`https://api.sleeper.app/v1/user/${userId}/leagues/nfl/${year}`);
      if (!response.ok) throw new Error('User not found or no leagues for this year');
      
      const data = await response.json();
      setLeagues(data || []);
      
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem('sleeperUserInput', userInput);

      setStep('selectLeague');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getLeagueHistory = async (leagueId) => {
    const history = [];
    let currentId = leagueId;
    
    while (currentId) {
      try {
        const response = await fetch(`https://api.sleeper.app/v1/league/${currentId}`);
        const leagueData = await response.json();
        
        history.push({
          league_id: currentId,
          season: leagueData.season,
          name: leagueData.name,
          draft_id: leagueData.draft_id,
        });
        
        currentId = leagueData.previous_league_id;
      } catch (err) {
        console.error(`Error fetching league ${currentId}:`, err);
        break;
      }
    }
    
    return history.sort((a, b) => a.season.localeCompare(b.season));
  };

  const fetchAllDraftData = async (leagueHistory) => {
    const allDrafts = [];
    
    for (const league of leagueHistory) {
      if (league.draft_id) {
        try {
          const [draftResponse, picksResponse] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/draft/${league.draft_id}`),
            fetch(`https://api.sleeper.app/v1/draft/${league.draft_id}/picks`)
          ]);
          
          const draftInfo = await draftResponse.json();
          const picks = await picksResponse.json();
          
          allDrafts.push({
            season: league.season,
            league_name: league.name,
            draft_info: draftInfo,
            picks: picks || [],
            draft_settings: draftInfo.settings // Pass draft settings directly from draft_info
          });
        } catch (err) {
          console.error(`Error fetching draft data for ${league.season}:`, err);
        }
      }
    }
    
    return allDrafts;
  };

  const analyzeDraftData = (drafts, users) => {

    console.log(drafts)
    console.log(users)
    const userStats = {};
    const positionTrends = {};
    const roundAnalysis = {};
    
    const allPositionalRuns = []; 
    let maxRoundsInDraft = 0; 

    const RUN_THRESHOLD_COUNT = 5; 
    const RUN_THRESHOLD_PICKS_SPAN = 10; 

    users.forEach(user => {
      userStats[user.user_id] = {
        username: user.display_name,
        totalPicks: 0, // Raw total picks
        positions: {}, // Raw count of drafted positions
        positionDetails: {}, // For detailed chart data (overall)
        positionDetailsByRoundSection: { // For the round tendencies chart
          early: {}, 
          mid: {},   
          late: {}   
        },
        draftedPositionsByRoundAndSeason: {}, 
        roundPreferences: {}, // Raw round preferences
        averageFirstPickOverall: 0, // NEW: For average of their first pick number across seasons
        firstPickNumbers: [], // NEW: To store the pick numbers of their first picks in each season
        seasonsActive: 0,
        favoritePositionByRosterNeed: 'N/A', 
        favoritePositionRatio: null, 
        allPositionRatios: {}, 
      };
    });

    let mostRecentWeightedRosterSlots = {};

    drafts.forEach(draft => {
      const seasonUsers = new Set();
      const activeRuns = new Map();
      const userPicksInDraft = new Set(); // NEW: To track which users have already picked in THIS draft
      
      const rosterPositionsCount = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, FLEX: 0, SUPER_FLEX: 0, 
        DST:0, 
        DL: 0, LB: 0, DB: 0, IDP:0
      };
      if (draft.draft_settings) {
        const settings = draft.draft_settings;
        rosterPositionsCount.QB = settings.slots_qb || 0;
        rosterPositionsCount.RB = settings.slots_rb || 0;
        rosterPositionsCount.WR = settings.slots_wr || 0;
        rosterPositionsCount.TE = settings.slots_te || 0;
        rosterPositionsCount.K = settings.slots_k || 0; 
        rosterPositionsCount.DEF = (settings.slots_def || 0) + (settings.slots_dst || 0); 
        rosterPositionsCount.FLEX = settings.slots_flex || 0;
        rosterPositionsCount.SUPER_FLEX = settings.slots_sf || settings.slots_super_flex || 0; 
        rosterPositionsCount.DL = settings.slots_dl || 0;
        rosterPositionsCount.LB = settings.slots_lb || 0;
        rosterPositionsCount.DB = settings.slots_db || 0;
        rosterPositionsCount.IDP = settings.slots_idp || 0; 
      }

      const weightedRosterSlots = { ...rosterPositionsCount };
      weightedRosterSlots.WR = (weightedRosterSlots.WR || 0) + ((weightedRosterSlots.FLEX || 0) / 2);
      weightedRosterSlots.RB = (weightedRosterSlots.RB || 0) + ((weightedRosterSlots.FLEX || 0) / 2);
      weightedRosterSlots.TE = (weightedRosterSlots.TE || 0) + ((weightedRosterSlots.FLEX || 0) / 8);
      weightedRosterSlots.QB = (weightedRosterSlots.QB || 0) + ((weightedRosterSlots.SUPER_FLEX || 0)/5);

      mostRecentWeightedRosterSlots = weightedRosterSlots;


      draft.picks.forEach(pick => {
        if (userStats[pick.picked_by]) {
          seasonUsers.add(pick.picked_by);
          const user = userStats[pick.picked_by];
          const position = pick.metadata?.position || 'Unknown';
          const playerName = `${pick.metadata?.first_name || ''} ${pick.metadata?.last_name || ''}`.trim();
          const round = pick.round;

          if (round > maxRoundsInDraft) {
            maxRoundsInDraft = round;
          }

          user.totalPicks++;
          user.positions[position] = (user.positions[position] || 0) + 1;
          user.roundPreferences[round] = (user.roundPreferences[round] || 0) + 1;
          
          // NEW: Capture the first pick number for this user in this draft
          if (!userPicksInDraft.has(pick.picked_by)) {
            user.firstPickNumbers.push(pick.pick_no);
            userPicksInDraft.add(pick.picked_by);
          }
         
          console.log(pick)
          console.log(user)
          
          if (!user.positionDetails[position]) {
            user.positionDetails[position] = { count: 0, totalPickNo: 0 };
          }
          user.positionDetails[position].count++;
          user.positionDetails[position].totalPickNo += pick.pick_no;

          let roundSection;
          if (round >= 1 && round <= 4) {
            roundSection = 'early';
          } else if (round >= 5 && round <= 9) {
            roundSection = 'mid';
          } else {
            roundSection = 'late'; 
          }

          if (!user.positionDetailsByRoundSection[roundSection][position]) {
            user.positionDetailsByRoundSection[roundSection][position] = { count: 0, totalPickNo: 0 };
          }
          user.positionDetailsByRoundSection[roundSection][position].count++;
          user.positionDetailsByRoundSection[roundSection][position].totalPickNo += pick.pick_no;
          
          if (!positionTrends[draft.season]) positionTrends[draft.season] = {};
          positionTrends[draft.season][position] = (positionTrends[draft.season][position] || 0) + 1;
          
          if (!roundAnalysis[round]) roundAnalysis[round] = [];
          roundAnalysis[round].push(position);

          if (!user.draftedPositionsByRoundAndSeason[draft.season]) {
            user.draftedPositionsByRoundAndSeason[draft.season] = {};
          }
          if (!user.draftedPositionsByRoundAndSeason[draft.season][round]) {
            user.draftedPositionsByRoundAndSeason[draft.season][round] = {};
          }
          user.draftedPositionsByRoundAndSeason[draft.season][round][position] = 
            (user.draftedPositionsByRoundAndSeason[draft.season][round][position] || 0) + 1;


          const currentRunPicks = activeRuns.get(position) || [];
          
          const newPickInRun = { 
            pickNo: pick.pick_no, 
            pickedBy: pick.picked_by, 
            playerName: playerName,
            position: position 
          };
          currentRunPicks.push(newPickInRun);

          const filteredRunPicks = [];
          for (let i = currentRunPicks.length - 1; i >= 0; i--) {
            if (newPickInRun.pickNo - currentRunPicks[i].pickNo < RUN_THRESHOLD_PICKS_SPAN) {
              filteredRunPicks.unshift(currentRunPicks[i]); 
            } else {
              break;
            }
          }
          
          activeRuns.set(position, filteredRunPicks);

          if (filteredRunPicks.length >= RUN_THRESHOLD_COUNT) {
            const firstPickOfRun = filteredRunPicks[0];
            const lastPickOfRun = filteredRunPicks[filteredRunPicks.length - 1];

            const runId = `${draft.season}-${position}-${firstPickOfRun.pickNo}`;

            const existingRunIndex = allPositionalRuns.findIndex(r => 
              r.runId === runId
            );

            if (existingRunIndex === -1) {
              allPositionalRuns.push({
                runId: runId, 
                season: draft.season,
                position: position,
                startPick: firstPickOfRun.pickNo,
                endPick: lastPickOfRun.pickNo,
                numPicks: filteredRunPicks.length,
                initiator: users.find(u => u.user_id === firstPickOfRun.pickedBy)?.display_name || 'Unknown',
                ender: users.find(u => u.user_id === lastPickOfRun.pickedBy)?.display_name || 'Unknown',
                picksInRun: filteredRunPicks.map(p => ({ 
                  pickNo: p.pickNo, 
                  pickedBy: users.find(u => u.user_id === p.pickedBy)?.display_name || 'Unknown', 
                  playerName: p.playerName,
                  position: p.position
                }))
              });
            } else {
              const existingRun = allPositionalRuns[existingRunIndex];
              existingRun.endPick = lastPickOfRun.pickNo;
              existingRun.numPicks = filteredRunPicks.length;
              existingRun.ender = users.find(u => u.user_id === lastPickOfRun.pickedBy)?.display_name || 'Unknown';
              existingRun.picksInRun = filteredRunPicks.map(p => ({ 
                pickNo: p.pickNo, 
                pickedBy: users.find(u => u.user_id === p.pickedBy)?.display_name || 'Unknown', 
                playerName: p.playerName,
                position: p.position
              }));
            }
          }
        }
      });
      
      seasonUsers.forEach(userId => {
        userStats[userId].seasonsActive++;
      });
    });

    // NEW: Calculate average first pick number and normalize other stats
    Object.values(userStats).forEach(user => {
      if (user.seasonsActive > 0) {
        // Calculate average first pick number across all seasons
        if (user.firstPickNumbers.length > 0) {
          const sumOfFirstPicks = user.firstPickNumbers.reduce((acc, pickNo) => acc + pickNo, 0);
          user.averageFirstPickOverall = parseFloat((sumOfFirstPicks / user.firstPickNumbers.length).toFixed(1));
        } else {
          user.averageFirstPickOverall = 0; // No first picks recorded for this user
        }

        // Normalize raw position counts by seasons active
        for (const pos in user.positions) {
          user.positions[pos] = parseFloat((user.positions[pos] / user.seasonsActive).toFixed(1));
        }

        // Normalize detailed position data for charts by seasons active
        for (const pos in user.positionDetails) {
          user.positionDetails[pos].count = parseFloat((user.positionDetails[pos].count / user.seasonsActive).toFixed(1));
          user.positionDetails[pos].totalPickNo = parseFloat((user.positionDetails[pos].totalPickNo / user.seasonsActive).toFixed(1));
        }

        // Normalize position data by round section by seasons active
        for (const section in user.positionDetailsByRoundSection) {
          for (const pos in user.positionDetailsByRoundSection[section]) {
            user.positionDetailsByRoundSection[section][pos].count = parseFloat((user.positionDetailsByRoundSection[section][pos].count / user.seasonsActive).toFixed(1));
            user.positionDetailsByRoundSection[section][pos].totalPickNo = parseFloat((user.positionDetailsByRoundSection[section][pos].totalPickNo / user.seasonsActive).toFixed(1));
          }
        }
        
        // Normalize round preferences by seasons active
        for (const round in user.roundPreferences) {
          user.roundPreferences[round] = parseFloat((user.roundPreferences[round] / user.seasonsActive).toFixed(1));
        }
      }
    });

    // Calculate favorite position by roster need AFTER normalization
    Object.values(userStats).forEach(user => {
      let bestRatio = -1;
      let favoritePos = 'N/A';
      user.allPositionRatios = {}; 
     

      const relevantPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB', 'IDP']; 
      
      for (const pos of relevantPositions) {
        const draftedCount = user.positions[pos] || 0;
        let availableSlots = mostRecentWeightedRosterSlots[pos] || 0;

        if (pos === 'DEF' && mostRecentWeightedRosterSlots['DST']) {
          availableSlots += mostRecentWeightedRosterSlots['DST'];
        }
        
        let ratio;
        if (availableSlots > 0 && draftedCount > 0) {
          ratio = draftedCount / availableSlots;
        } else if (availableSlots === 0 && draftedCount > 0) {
            ratio = draftedCount * 1000; 
        } else {
            ratio = 0; 
        }

        user.allPositionRatios[pos] = ratio; 

        if (ratio > bestRatio) {
          bestRatio = ratio;
          favoritePos = pos;
        }
      }
      user.favoritePositionByRosterNeed = favoritePos;
      user.favoritePositionRatio = bestRatio; 
    });

    const predictions = generatePredictions(userStats, positionTrends, roundAnalysis);
    
    return {
      userStats: Object.entries(userStats)
        .filter(([userId, user]) => user.totalPicks > 0)
        .map(([userId, user]) => ({ ...user, user_id: userId })),
      positionTrends,
      roundAnalysis,
      predictions,
      totalSeasons: drafts.length,
      positionalRuns: allPositionalRuns,
      allSeasons: [...new Set(drafts.map(d => d.season))].sort(), 
      maxRoundsInDraft: maxRoundsInDraft 
    };
  };

  const generatePredictions = (userStats, positionTrends, roundAnalysis) => {
    const predictions = {
      likelyFirstRoundPicks: [],
      positionTrends: {},
      userBehaviorPredictions: []
    };

    const firstRoundPositions = roundAnalysis[1] || [];
    const positionCounts = {};
    firstRoundPositions.forEach(pos => {
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });
    
    predictions.likelyFirstRoundPicks = Object.entries(positionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([pos, count]) => ({ position: pos, probability: (count / firstRoundPositions.length * 100).toFixed(1) }));

    Object.values(userStats).forEach(user => {
      const favoritePosition = user.favoritePositionByRosterNeed;
      
      const favoriteRound = Object.entries(user.roundPreferences)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (favoritePosition !== 'N/A' && favoriteRound) { 
        predictions.userBehaviorPredictions.push({
          username: user.username,
          predictedFirstPick: favoritePosition, 
          preferredRound: favoriteRound[0],
          consistency: 'N/A' 
        });
      } else if (favoriteRound) {
         const originalFavoritePos = Object.entries(user.positions)
          .sort(([,a], [,b]) => b - a)[0];
         if (originalFavoritePos) {
           predictions.userBehaviorPredictions.push({
             username: user.username,
             predictedFirstPick: originalFavoritePos[0],
             preferredRound: favoriteRound[0],
             consistency: (originalFavoritePos[1] / user.totalPicks * 100).toFixed(1)
           });
         }
      }
    });

    return predictions;
  };

  const selectLeague = async (league) => {
    setSelectedLeague(league);
    setLoading(true);
    setStep('analyzing');
    
    try {
      const cacheKey = `analysis_${league.league_id}`;
      const cachedAnalysis = localStorage.getItem(cacheKey);

      if (cachedAnalysis) {
        const { analysis, history, drafts } = JSON.parse(cachedAnalysis);
        if (analysis && analysis.userStats && analysis.positionalRuns) {
            setAnalysis(analysis);
            setLeagueHistory(history);
            setDraftData(drafts);
            setStep('results');
            setLoading(false);
            return;
        } else {
            localStorage.removeItem(cacheKey); // Invalidate cache if data structure is old/incomplete
        }
      }
      
      const history = await getLeagueHistory(league.league_id);
      setLeagueHistory(history);
      
      const usersResponse = await fetch(`https://api.sleeper.app/v1/league/${league.league_id}/users`);
      const users = await usersResponse.json();
      
      const drafts = await fetchAllDraftData(history);
      setDraftData(drafts);
      
      const analysisResult = analyzeDraftData(drafts, users); 
      setAnalysis(analysisResult);
      
      const dataToCache = { analysis: analysisResult, history, drafts };
      localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
      
      setStep('results');
    } catch (err) {
      setError('Error analyzing league data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetAnalysis = () => {
    setStep('search');
    setLeagues([]);
    setSelectedLeague(null);
    setLeagueHistory([]);
    setDraftData([]);
    setAnalysis(null);
    setError('');
    setExpandedManager(null);
  };

  const toggleManagerView = (username) => {
    setExpandedManager(expandedManager === username ? null : username);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-4 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Trophy className="text-yellow-400" size={36}/>
            Sleeper Draft Analyzer
          </h1>
          <p className="text-gray-400">Analyze fantasy draft history and predict future trends</p>
        </div>

        {step === 'search' && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Search className="text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Find Your Leagues</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Sleeper Username or User ID
                </label>
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  placeholder="e.g., 'sleeper' or a user ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white"
                  min="2017"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
            
            <button
              onClick={fetchUserLeagues}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Searching...' : 'Find Leagues'}
            </button>
            
            {error && (
              <div className="mt-4 p-3 bg-red-900 border border-red-700 text-red-300 rounded-lg">
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'selectLeague' && leagues.length > 0 && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="text-green-400" />
              <h2 className="text-xl font-semibold text-white">Select a League</h2>
            </div>
            
            <div className="grid gap-3">
              {leagues.map((league) => (
                <div
                  key={league.league_id}
                  onClick={() => selectLeague(league)}
                  className="p-4 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-white">{league.name}</h3>
                      <p className="text-sm text-gray-400">
                        {league.total_rosters} teams • Season {league.season}
                      </p>
                    </div>
                    <div className="text-blue-400 text-2xl font-light">→</div>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={resetAnalysis}
              className="mt-4 text-blue-400 hover:text-blue-500 transition-colors"
            >
              ← Back to Search
            </button>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <h2 className="text-xl text-white font-semibold mb-2">Analyzing Draft Data</h2>
            <p className="text-gray-400">
              Fetching historical league data and crunching the numbers...
            </p>
          </div>
        )}

        {step === 'results' && analysis && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
               <div className="flex items-center gap-2 mb-4">
                <Calendar className="text-purple-400" />
                <h2 className="text-xl font-semibold text-white">League History</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 bg-blue-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-300">{analysis.totalSeasons}</div>
                  <div className="text-sm text-gray-400">Seasons Analyzed</div>
                </div>
                <div className="text-center p-4 bg-green-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-300">{analysis.userStats.length}</div>
                  <div className="text-sm text-gray-400">Active Managers</div>
                </div>
                <div className="text-center p-4 bg-purple-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-300">
                    {analysis.userStats.reduce((sum, user) => sum + user.totalPicks, 0).toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-400">Total Picks</div>
                </div>
              </div>
              
              <div className="text-sm text-gray-400">
                <strong>Seasons:</strong> {leagueHistory.map(l => l.season).join(', ')}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="text-blue-400" />
                <h2 className="text-xl font-semibold text-white">Manager Draft Profiles</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left p-3">Manager</th>
                      <th className="text-left p-3">Seasons</th>
                      <th className="text-left p-3">Total Picks</th>
                      <th className="text-left p-3">Avg Draft Position</th>
                      <th className="text-left p-3">Favorite Position</th> 
                      <th className="text-center p-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.userStats
                      .sort((a, b) => b.totalPicks - a.totalPicks)
                      .map((user, idx) => {
                        return (
                          <React.Fragment key={idx}>
                            <tr className="border-b border-gray-700 hover:bg-gray-700 cursor-pointer" onClick={() => toggleManagerView(user.username)}>
                              <td className="p-3 font-medium text-white">{user.username}</td>
                              <td className="p-3">{user.seasonsActive}</td>
                              <td className="p-3">{user.totalPicks}</td>
                              <td className="p-3">{user.averageFirstPickOverall.toFixed(1)}</td>
                              <td className="p-3">
                                {user.favoritePositionByRosterNeed !== 'N/A'
                                  ? (
                                    <span
                                      title={
                                        user.allPositionRatios
                                          ? Object.entries(user.allPositionRatios)
                                              .filter(([, ratio]) => ratio > 0) 
                                              .sort(([,a], [,b]) => b - a) 
                                              .map(([pos, ratio]) => `${pos}: ${ratio.toFixed(2)}`)
                                              .join('\n')
                                          : 'N/A'
                                      }
                                    >
                                      {user.favoritePositionByRosterNeed} ({user.favoritePositionRatio ? (user.favoritePositionRatio * 100).toFixed(1) : '0.0'}%)
                                    </span>
                                  )
                                  : 'N/A'
                                }
                              </td>
                              <td className="p-3 text-center text-xl">
                                  {expandedManager === user.username ? '▼' : '▶'}
                              </td>
                            </tr>
                            {expandedManager === user.username && (
                              <tr className="bg-gray-900">
                                <td colSpan="6">
                                  <PositionPieChart userData={user} />
                                  <RoundTendenciesChart userData={user} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="text-red-400" />
                <h2 className="text-xl font-semibold text-white">Draft Predictions</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-white mb-3">Likely First Round Positions</h3>
                  <div className="space-y-2">
                    {analysis.predictions.likelyFirstRoundPicks.map((pred, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                        <span className="font-medium">{pred.position}</span>
                        <span className="text-sm text-gray-400">{pred.probability}% probability</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-white mb-3">Top 5 Manager Predictions</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {analysis.predictions.userBehaviorPredictions.slice(0, 5).map((pred, idx) => (
                      <div key={idx} className="p-3 bg-gray-700 rounded-lg text-sm">
                        <div className="font-medium text-white">{pred.username}</div>
                        <div className="text-gray-400">
                          Likely pick: {pred.predictedFirstPick} ({pred.consistency}% consistency)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Positional Runs Analysis Section */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="text-orange-400" />
                <h2 className="text-xl font-semibold text-white">League-Wide Positional Runs</h2>
              </div>
              {analysis.positionalRuns && analysis.positionalRuns.length > 0 ? (
                <PositionalRunsChart positionalRuns={analysis.positionalRuns} />
              ) : (
                <div className="p-4 bg-gray-700 rounded-lg text-center text-gray-400">
                  No significant positional runs detected based on current analysis parameters (e.g., 5+ players of the same position within 10 picks).
                </div>
              )}
            </div>

            {/* Manager Positional Heatmap Chart Section */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <LayoutGrid className="text-teal-400" />
                <h2 className="text-xl font-semibold text-white">Positional Drafting Heatmap (By Manager)</h2>
              </div>
              {analysis.userStats && analysis.userStats.length > 0 ? (
                <PositionalHeatmapChart 
                  userStats={analysis.userStats} 
                  allSeasons={analysis.allSeasons}
                  maxRoundsInDraft={analysis.maxRoundsInDraft}
                />
              ) : (
                <div className="p-4 bg-gray-700 rounded-lg text-center text-gray-400">
                  Not enough data to generate positional drafting heatmap.
                </div>
              )}
            </div>

            {/* NEW: Draft Spot Positional Probability Heatmap Section */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="text-lime-400" /> {/* Using BarChart2 icon for this new component */}
                <h2 className="text-xl font-semibold text-white">Draft Spot Positional Probability</h2>
              </div>
              {draftData && draftData.length > 0 ? (
                <DraftSpotProbabilityHeatmap 
                  draftData={draftData} 
                  allSeasons={analysis.allSeasons}
                />
              ) : (
                <div className="p-4 bg-gray-700 rounded-lg text-center text-gray-400">
                  Not enough draft data to generate draft spot probability heatmap.
                </div>
              )}
            </div>

            {/* NEW: Manager ADP Analysis Section */}
            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <GitPullRequest className="text-pink-400" /> {/* Using GitPullRequest icon for this new component */}
                <h2 className="text-xl font-semibold text-white">Manager ADP Over/Underreach</h2>
              </div>
              {draftData && draftData.length > 0 && analysis.userStats && analysis.userStats.length > 0 ? (
                <ManagerADPAnalysis 
                  draftData={draftData} 
                  userStats={analysis.userStats}
                  allSeasons={analysis.allSeasons}
                  playerData ={playerData}
                />
              ) : (
                <div className="p-4 bg-gray-700 rounded-lg text-center text-gray-400">
                  Not enough data to analyze manager ADP tendencies.
                </div>
              )}
            </div>

            <button
              onClick={resetAnalysis}
              className="w-full bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Analyze Another League
            </button>
          </div>
        )}

        {leagues.length === 0 && step === 'selectLeague' && !loading && (
          <div className="bg-yellow-900 border border-yellow-700 text-yellow-300 p-4 rounded-lg text-center">
            No leagues found for this user and year. Try a different year or check the username/ID.
          </div>
        )}
      </div>
    </div>
  );
};

export default SleeperDraftAnalyzer;
