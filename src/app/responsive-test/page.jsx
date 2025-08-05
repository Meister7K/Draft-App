'use client';

import { useState, useEffect, useMemo } from 'react';
import VorpTable from './VorpTable';
import RosterGrid from './RosterGrid';
import DraftBoard from './DraftBoard';
import { useVorp } from '../hooks/useVorp';
import { calculateBaselines } from '../utils/vorpCalculator';

export default function ResponsiveTestPage() {
  // State for raw data from sources
  const [storageData, setStorageData] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  
  // A single, reliable loading state for all initial data
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for the live draft picks
  const [currentPicks, setCurrentPicks] = useState([]);

  // This single useEffect handles all initial data fetching to prevent race conditions.
  useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // --- Step 1: Load synchronous data from localStorage ---
        const localDataString = localStorage.getItem('draftAppData');
        if (!localDataString) {
          throw new Error("Could not find draft data in localStorage. Please ensure you've set up the draft first.");
        }
        const parsedData = JSON.parse(localDataString);
        setStorageData(parsedData);
        if (parsedData?.draftData?.picks) {
          setCurrentPicks(parsedData.draftData.picks);
        }

        // --- Step 2: Fetch asynchronous data from the API ---
        const response = await fetch('/api/raw-fantasy-data');
        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        const apiData = await response.json();
        setPlayerData(apiData);

      } catch (err) {
        console.error("Failed to load application data:", err);
        setError(err.message);
      } finally {
        // This will always run, ensuring the loading screen is removed
        // even if an error occurred.
        setIsLoading(false);
      }
    };

    loadAllData();
  }, []); // Empty dependency array ensures this runs only once on mount.

  // --- Data Processing (Memoized) ---
  const { draftData, leagueData, leagueUsers } = storageData || {};
  const year = draftData?.season;
  const rosterSetup = leagueData?.selectedLeague.roster_positions || [];
  const managers = leagueUsers || [];
  const initialPicks = draftData?.picks || [];
  const totalRounds = leagueData?.selectedLeague.settings.rounds || 15;

  // ✅ THE FIX: This now returns a flat array of player objects, which all
  // downstream hooks and components expect.
  const newPlayerData = useMemo(() => 
    playerData && year
      ? Object.values(playerData.players).map((player) => {
          const { player_info, seasons } = player;
          // Return a single object instead of a [key, value] tuple
          return {
            id: player_info.player_id,
            name: player_info.name,
            pos: player_info.position,
            team: player_info.team,
            fpts: seasons[year]?.season_projected_totals?.pts_half_ppr ?? 0,
          };
        })
      : [], [playerData, year]);

      const analyzedPicks = useMemo(() => {
        if (!newPlayerData.length || !initialPicks.length || !rosterSetup.length || !managers.length) return [];
        
        const playerMap = new Map(newPlayerData.map(p => [p.id, p]));
        let availablePlayerIds = new Set(newPlayerData.map(p => p.id));
        
        // Create a running simulation of each manager's roster
        const managerRosters = new Map(managers.map(m => [m.user_id, []]));
        // Define starting slot counts based on roster setup
        const starterCounts = {};
        rosterSetup.forEach(pos => {
            if(pos !== 'BN') { // Bench spots are not starters
                starterCounts[pos] = (starterCounts[pos] || 0) + 1;
            }
        });
    
        return initialPicks.map(pick => {
          const availablePlayersNow = [...availablePlayerIds].map(id => playerMap.get(id)).filter(Boolean);
          const baselines = calculateBaselines(availablePlayersNow, rosterSetup, managers.length);
          const player = playerMap.get(pick.player_id);
          
          let historicalVorp = 0;
          let historicalVorpAll = 0;
          let rosterVorp = 0;
    
          if (player) {
              // --- Standard VORP Calculations ---
              let positionalBaseline = baselines[player.pos] || 0;
              if (['RB', 'WR', 'TE'].includes(player.pos)) {
                  positionalBaseline = Math.max(positionalBaseline, baselines['FLEX']);
              }
              historicalVorp = player.fpts - positionalBaseline;
              historicalVorpAll = player.fpts - (baselines['GLOBAL'] || 0);
    
              // --- Roster-Specific VORP Calculation ---
              const managerId = pick.picked_by;
              const currentRoster = managerRosters.get(managerId) || [];
              const playersAtPos = currentRoster.filter(p => p.pos === player.pos);
              const numStartersForPos = starterCounts[player.pos] || 0;
    
              if (playersAtPos.length < numStartersForPos) {
                  // The player fills an empty starting spot. Their value is their points over the baseline.
                  rosterVorp = player.fpts - positionalBaseline;
              } else {
                  // The starting spots are full. Is this player better than the worst starter?
                  const sortedPlayersAtPos = [...playersAtPos].sort((a,b) => b.fpts - a.fpts);
                  const worstStarter = sortedPlayersAtPos[numStartersForPos - 1];
                  if (worstStarter) {
                      // The value is the upgrade over the worst starter.
                      rosterVorp = player.fpts - worstStarter.fpts;
                  } else {
                      // This case handles bench players where there are no starters of that type (e.g. 3rd QB)
                      rosterVorp = 0;
                  }
              }
          }
          
          // Update the simulation state for the next pick
          if(player) {
              const currentManagerRoster = managerRosters.get(pick.picked_by) || [];
              currentManagerRoster.push(player);
              managerRosters.set(pick.picked_by, currentManagerRoster);
          }
          availablePlayerIds.delete(pick.player_id);
    
          return { ...pick, player, historicalVorp, historicalVorpAll, rosterVorp };
        });
      }, [newPlayerData, initialPicks, rosterSetup, managers]);

  // Create the playerMap once
const playerMap = useMemo(() => new Map(newPlayerData.map(p => [p.id, p])), [newPlayerData]);

// Update the hook call
const { rankedPlayers, baselines } = useVorp(
    newPlayerData, 
    currentPicks, 
    managers, 
    rosterSetup, 
    draftData?.draft_order, // Pass draft order
    playerMap              // Pass player map
);

const handleDraftPlayer = (playerId) => {
  if (!draftOrder) return;

  const nextPickNumber = currentPicks.length + 1;
  const managerPickingId = Object.keys(draftOrder).find(key => draftOrder[key] === ((nextPickNumber -1) % managers.length) + 1);
  
  // Fallback if the draft logic is more complex (e.g., snake)
  // This is a simplified linear draft for demonstration
  const pickingManager = managers[(nextPickNumber - 1) % managers.length];

  const newPick = {
    draft_id: draftData?.draft_id || "simulated_draft",
    pick_no: nextPickNumber,
    player_id: playerId,
    picked_by: pickingManager?.user_id || "unknown",
    metadata: {}, // Add player metadata if needed
  };

  setCurrentPicks(prevPicks => [...prevPicks, newPick]);
};

  // --- Render Logic ---
  // --- Determine Current Picker ---
  const currentPickNumber = currentPicks.length + 1;
  const numManagers = managers.length;
  const draftType = draftData?.type;

  let currentDraftSlot;
  if (draftType === 'snake' && numManagers > 0) {
      const round = Math.ceil(currentPickNumber / numManagers);
      const pickInRound = (currentPickNumber - 1) % numManagers;
      if (round % 2 === 0) { // Even round, order is reversed
          currentDraftSlot = numManagers - pickInRound;
      } else { // Odd round, normal order
          currentDraftSlot = pickInRound + 1;
      }
  } else if (numManagers > 0) { // Linear draft
      currentDraftSlot = (currentPickNumber - 1) % numManagers + 1;
  }

  const currentPickerId = draftData?.draft_order
      ? Object.keys(draftData.draft_order).find(key => draftData.draft_order[key] === currentDraftSlot)
      : null;

  const currentPicker = managers.find(m => m.user_id === currentPickerId);

  if (isLoading) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading Draft Data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-red-500 p-4 bg-gray-800 rounded-lg">
          <h3 className="font-bold text-lg">An Error Occurred</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
     <div className="bg-gray-900 min-h-screen">
      <div className="container mx-auto p-4 space-y-8">
      <VorpTable 
    rankedPlayers={rankedPlayers}
    baselines={baselines}
    onDraft={handleDraftPlayer}
    currentPicker={currentPicker} // Add this line
/>
        <DraftBoard
            analyzedPicks={analyzedPicks}
            managers={managers}
            totalRounds={totalRounds}
        />
        <RosterGrid 
            analyzedPicks={analyzedPicks}
            managers={managers}
            rosterSetup={rosterSetup}
        />
      </div>
    </div>
  );
}
