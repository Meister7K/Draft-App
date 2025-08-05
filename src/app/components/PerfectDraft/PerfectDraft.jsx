'use client'

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PerfectDraftEngine } from './PerfectDraftEngine';
import { RosterDisplay } from './RosterDisplay';
import { DraftBoard } from './DraftBoard';
import { AnalyticsPanel } from './AnalyticsPanel';
import './PerfectDraft.module.css';

export function PerfectDraft({ 
  playerData, 
  draftData, 
  leagueData, 
  leagueUsers,
  year
}) {
  const [draftState, setDraftState] = useState({
    currentPick: 1,
    totalPicks: 0,
    draftOrder: [],
    picks: [],
    availablePlayers: [],
    rosters: {},
    isComplete: false
  });

  const [analytics, setAnalytics] = useState({
    totalProjectedPoints: {},
    positionScarcity: {},
    valueDropoffs: {},
    optimalPicks: []
  });

  // Initialize draft state
  useEffect(() => {
    console.log('--- Initializing Draft State ---');
    console.log('playerData:', playerData);
    console.log('draftData:', draftData);
    console.log('leagueUsers:', leagueUsers);
    console.log(year)
    
    if (playerData?.players && draftData && leagueUsers) {
      console.log('Data is valid, proceeding with initialization.');
      
      const totalPicks = leagueUsers.length * 16; // Assuming 16 rounds
      
      // FIX: Ensure draftData.draft_order is an array before using it.
      const draftOrder = Array.isArray(draftData.draft_order) ? 
        draftData.draft_order : 
        leagueUsers.map((user, index) => ({
          managerId: user.user_id,
          managerName: user.display_name || user.username,
          draftPosition: index + 1
      }));

      console.log('draftOrder after check:', draftOrder);

      const availablePlayers = playerData.players.map(player => ({
        ...player,
        isDrafted: false,
        draftedBy: null,
        pickNumber: null
      }));

      const rosters = {};
      leagueUsers.forEach(user => {
        // Log the user and the draftOrder before the find operation
        console.log(`Processing user: ${user.user_id}`);
        console.log('Draft order for find operation:', draftOrder);
        
        const draftPosition = draftOrder.find(d => d.managerId === user.user_id)?.draftPosition || 1;
        
        rosters[user.user_id] = {
          managerId: user.user_id,
          managerName: user.display_name || user.username,
          draftPosition: draftPosition,
          picks: [],
          roster: {
            QB: [],
            RB: [],
            WR: [],
            TE: [],
            FLEX: [],
            BENCH: []
          },
          projectedPoints: 0,
          positionNeeds: calculatePositionNeeds(leagueData?.roster_positions)
        };
      });

      setDraftState({
        currentPick: 1,
        totalPicks,
        draftOrder,
        picks: [],
        availablePlayers,
        rosters,
        isComplete: false
      });
      console.log('Initial draft state set successfully.');
    } else {
      console.warn('One or more required data props are missing. Cannot initialize draft state.');
    }
  }, [playerData, draftData, leagueUsers, leagueData]);

  // Calculate position needs based on roster format
  const calculatePositionNeeds = useCallback((rosterPositions) => {
    if (!rosterPositions) {
      // Default roster format
      return {
        QB: 2,
        RB: 2,
        WR: 2,
        TE: 1,
        FLEX: 2,
        BENCH: 6
      };
    }

    const needs = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      FLEX: 0,
      BENCH: 0
    };

    // Parse roster positions from Sleeper format
    Object.entries(rosterPositions).forEach(([position, count]) => {
      if (position === 'QB') needs.QB = count;
      else if (position === 'RB') needs.RB = count;
      else if (position === 'WR') needs.WR = count;
      else if (position === 'TE') needs.TE = count;
      else if (position === 'FLEX') needs.FLEX = count;
      else if (position === 'BN') needs.BENCH = count;
    });

    return needs;
  }, []);

  // Execute perfect draft
  const executePerfectDraft = useCallback(() => {
    console.log('--- Executing Perfect Draft ---');
    if (!draftState.availablePlayers.length || draftState.isComplete) {
      console.warn('Draft cannot be executed. Either no players are available or the draft is already complete.');
      return;
    }

    const newDraftState = { ...draftState };
    const newPicks = [];

    // Execute all picks
    for (let pickNumber = 1; pickNumber <= draftState.totalPicks; pickNumber++) {
      // Use snake draft logic to determine current manager
      const numTeams = draftState.draftOrder.length;
      const currentRound = Math.ceil(pickNumber / numTeams);
      let draftPosition;
      
      if (currentRound % 2 === 1) {
        // Odd rounds: normal order (1, 2, 3, ...)
        draftPosition = ((pickNumber - 1) % numTeams) + 1;
      } else {
        // Even rounds: reverse order (..., 3, 2, 1)
        draftPosition = numTeams - ((pickNumber - 1) % numTeams);
      }
      
      const currentManager = draftState.draftOrder.find(
        d => d.draftPosition === draftPosition
      );

      if (!currentManager) {
        console.error(`Could not find manager for pick #${pickNumber}.`);
        continue;
      }

      // Create a fresh engine instance with current draft state for each pick
      const engine = new PerfectDraftEngine(
        newDraftState.availablePlayers,
        newDraftState.rosters,
        draftState.draftOrder,
        leagueData?.roster_positions,
        year
      );

      const optimalPick = engine.getOptimalPick(
        pickNumber,
        currentManager.managerId,
        newDraftState.availablePlayers,
        newDraftState.rosters
      );

      if (optimalPick) {
        console.log(optimalPick);

        // Update draft state
        newDraftState.availablePlayers = newDraftState.availablePlayers.filter(
          p => p.player_info.player_id !== optimalPick.player.player_info.player_id
        );

        // Update roster
        newDraftState.rosters[currentManager.managerId].picks.push(optimalPick);
        newDraftState.rosters[currentManager.managerId].roster[optimalPick.player.player_info.position].push(optimalPick.player);

        // Update projected points
        newDraftState.rosters[currentManager.managerId].projectedPoints += 
          optimalPick.player.seasons[year]?.season_projected_totals?.pts_half_ppr || 0;

        // Update position needs
        // Check if position needs exist and decrement.
        if (newDraftState.rosters[currentManager.managerId].positionNeeds[optimalPick.player.player_info.position] !== undefined) {
          newDraftState.rosters[currentManager.managerId].positionNeeds[optimalPick.player.player_info.position]--;
        } else {
          console.warn(`Position need not found for ${optimalPick.player.player_info.position}.`);
        }

        newPicks.push({
          pickNumber,
          managerId: currentManager.managerId,
          managerName: currentManager.managerName,
          player: optimalPick.player,
          reasoning: optimalPick.reasoning,
          score: optimalPick.analysis.totalValue
        });
      } else {
        console.warn(`No optimal pick found for pick #${pickNumber}.`);
      }
    }

    newDraftState.picks = newPicks;
    newDraftState.isComplete = true;
    newDraftState.currentPick = draftState.totalPicks + 1;

    setDraftState(newDraftState);
    console.log('Draft execution complete. New draft state set.');

    // Calculate analytics
    const newAnalytics = calculateAnalytics(newDraftState);
    setAnalytics(newAnalytics);
    console.log('Analytics calculated and set.');
  }, [draftState, leagueUsers, leagueData]);

  // Calculate analytics
  const calculateAnalytics = useCallback((state) => {
    const totalProjectedPoints = {};
    const positionScarcity = {};
    const valueDropoffs = {};
    const optimalPicks = [];

    // Calculate total projected points for each roster
    Object.values(state.rosters).forEach(roster => {
      totalProjectedPoints[roster.managerId] = roster.projectedPoints;
    });

    // Calculate position scarcity
    const positionCounts = {};
    state.picks.forEach(pick => {
      const position = pick.player.player_info.position;
      positionCounts[position] = (positionCounts[position] || 0) + 1;
    });

    Object.keys(positionCounts).forEach(position => {
      // Add check to prevent division by zero
      const totalPicks = state.picks.length;
      positionScarcity[position] = {
        total: positionCounts[position],
        remaining: state.availablePlayers.filter(p => p.player_info.position === position).length,
        scarcity: totalPicks > 0 ? positionCounts[position] / totalPicks : 0
      };
    });

    // Calculate value dropoffs with intelligent tier detection
    const positionGroups = {};
    state.picks.forEach(pick => {
      const position = pick.player.player_info.position;
      if (!positionGroups[position]) positionGroups[position] = [];
      const projectedPoints = pick.player.seasons?.[year]?.season_projected_totals?.pts_half_ppr || 0;
      positionGroups[position].push({
        pickNumber: pick.pickNumber,
        projectedPoints: projectedPoints,
        playerName: pick.player.player_info.name,
        managerId: pick.managerId
      });
    });

    Object.keys(positionGroups).forEach(position => {
      const sorted = positionGroups[position].sort((a, b) => b.projectedPoints - a.projectedPoints); // Sort by points descending
      
      if (sorted.length === 0) {
        valueDropoffs[position] = [];
        return;
      }

      const tiers = [];
      let currentTier = [];
      let tierStartPoints = null;
      let tierNumber = 1;

      for (let i = 0; i < sorted.length; i++) {
        const player = sorted[i];
        
        if (currentTier.length === 0) {
          // Start new tier
          currentTier = [player];
          tierStartPoints = player.projectedPoints;
        } else {
          const dropFromTierStart = tierStartPoints - player.projectedPoints;
          const dropFromPrevious = sorted[i-1].projectedPoints - player.projectedPoints;
          
          // Check if we need to start a new tier
          const shouldStartNewTier = dropFromTierStart > 30 || dropFromPrevious > 10;
          
          if (shouldStartNewTier) {
            // Finish current tier
            tiers.push({
              tierNumber: tierNumber,
              players: [...currentTier],
              tierStartPoints: tierStartPoints,
              tierEndPoints: currentTier[currentTier.length - 1].projectedPoints
            });
            
            // Start new tier
            tierNumber++;
            currentTier = [player];
            tierStartPoints = player.projectedPoints;
          } else {
            // Add to current tier
            currentTier.push(player);
          }
        }
      }

      // Add final tier
      if (currentTier.length > 0) {
        tiers.push({
          tierNumber: tierNumber,
          players: [...currentTier],
          tierStartPoints: tierStartPoints,
          tierEndPoints: currentTier[currentTier.length - 1].projectedPoints
        });
      }

      // Calculate dropoffs between tiers
      const dropoffs = [];
      for (let i = 1; i < tiers.length; i++) {
        const previousTier = tiers[i-1];
        const currentTier = tiers[i];
        
        // Get the last player of previous tier and first player of current tier
        const lastPlayerPrevTier = previousTier.players[previousTier.players.length - 1];
        const firstPlayerCurrentTier = currentTier.players[0];
        
        const dropoffValue = lastPlayerPrevTier.projectedPoints - firstPlayerCurrentTier.projectedPoints;
        
        dropoffs.push({
          tierBreak: `Tier ${previousTier.tierNumber} → Tier ${currentTier.tierNumber}`,
          tierNumber: currentTier.tierNumber,
          dropoff: dropoffValue,
          fromTier: {
            number: previousTier.tierNumber,
            lastPlayer: lastPlayerPrevTier.playerName,
            points: lastPlayerPrevTier.projectedPoints,
            pickNumber: lastPlayerPrevTier.pickNumber,
            playerCount: previousTier.players.length
          },
          toTier: {
            number: currentTier.tierNumber,
            firstPlayer: firstPlayerCurrentTier.playerName,
            points: firstPlayerCurrentTier.projectedPoints,
            pickNumber: firstPlayerCurrentTier.pickNumber,
            playerCount: currentTier.players.length
          },
          // Additional tier info
          tierStartDropoff: previousTier.tierStartPoints - currentTier.tierStartPoints,
          significance: dropoffValue > 20 ? 'Major' : dropoffValue > 10 ? 'Significant' : 'Minor'
        });
      }

      valueDropoffs[position] = {
        tiers: tiers,
        dropoffs: dropoffs,
        totalTiers: tiers.length,
        positionDepth: sorted.length
      };
    });

    // Identify optimal picks
    state.picks.forEach(pick => {
      if (pick.score > 0.8) { // High score threshold
        optimalPicks.push(pick);
      }
    });

    return {
      totalProjectedPoints,
      positionScarcity,
      valueDropoffs,
      optimalPicks
    };
  }, []);

  // Reset draft
  const resetDraft = useCallback(() => {
    console.log('--- Resetting Draft ---');
    if (playerData?.players && draftData && leagueUsers) {
      const totalPicks = leagueUsers.length * 16;
      
      const draftOrder = Array.isArray(draftData.draft_order) ? 
        draftData.draft_order : 
        leagueUsers.map((user, index) => ({
          managerId: user.user_id,
          managerName: user.display_name || user.username,
          draftPosition: index + 1
      }));

      const availablePlayers = playerData.players.map(player => ({
        ...player,
        isDrafted: false,
        draftedBy: null,
        pickNumber: null
      }));

      const rosters = {};
      leagueUsers.forEach(user => {
        const draftPosition = draftOrder.find(d => d.managerId === user.user_id)?.draftPosition || 1;

        rosters[user.user_id] = {
          managerId: user.user_id,
          managerName: user.display_name || user.username,
          draftPosition: draftPosition,
          picks: [],
          roster: {
            QB: [],
            RB: [],
            WR: [],
            TE: [],
            FLEX: [],
            BENCH: []
          },
          projectedPoints: 0,
          positionNeeds: calculatePositionNeeds(leagueData?.roster_positions)
        };
      });

      setDraftState({
        currentPick: 1,
        totalPicks,
        draftOrder,
        picks: [],
        availablePlayers,
        rosters,
        isComplete: false
      });

      setAnalytics({
        totalProjectedPoints: {},
        positionScarcity: {},
        valueDropoffs: {},
        optimalPicks: []
      });
      console.log('Draft state reset successfully.');
    } else {
      console.warn('Cannot reset draft due to missing initial data.');
    }
  }, [playerData, draftData, leagueUsers, leagueData, calculatePositionNeeds]);

  if (!playerData || !draftData || !leagueUsers) {
    console.log('Data not yet loaded, showing loading message.');
    return <div>Loading draft data...</div>;
  }

  return (
    <div className="perfect-draft-container">
      <div className="perfect-draft-header">
        <h1>Perfect Draft Simulator</h1>
        <div className="draft-controls">
          <button 
            onClick={executePerfectDraft}
            disabled={draftState.isComplete}
            className="execute-draft-btn"
          >
            Execute Perfect Draft
          </button>
          <button 
            onClick={resetDraft}
            className="reset-draft-btn"
          >
            Reset Draft
          </button>
        </div>
      </div>

      <div className="draft-content">
        <div className="draft-board-section">
          <DraftBoard 
            draftState={draftState}
            analytics={analytics}
            year={year}
          />
        </div>

        <div className="rosters-section">
          <RosterDisplay 
            rosters={draftState.rosters}
            analytics={analytics}
          />
        </div>

        <div className="analytics-section">
          <AnalyticsPanel 
            analytics={analytics}
            draftState={draftState}
          />
        </div>
      </div>
    </div>
  );
}
