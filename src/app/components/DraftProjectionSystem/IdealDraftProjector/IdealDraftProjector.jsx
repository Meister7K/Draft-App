'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ProjectionEngine } from '../shared/ProjectionEngine.js';
import { playerDataProcessor } from '../shared/PlayerDataProcessor.js';
import ManagerSelector from './ManagerSelector.jsx';
import ProjectedPicksDisplay from './ProjectedPicksDisplay.jsx';
import RosterAnalysis from './RosterAnalysis.jsx';
import ADPToggle from '../shared/ADPToggle.jsx';

/**
 * IdealDraftProjector - Main component for projecting ideal draft picks
 * Implements manager selection and projection display with ProjectionEngine integration
 */
export default function IdealDraftProjector({ 
  leagueData = null, 
  rosterFormat = null, 
  adpEnabled = false,
  onADPToggle = null 
}) {
  // State management for selected manager and projection data
  const [selectedManager, setSelectedManager] = useState(null);
  const [projectionData, setProjectionData] = useState(null);
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize ProjectionEngine with ADP settings
  const projectionEngine = useMemo(() => {
    const engine = new ProjectionEngine(playerDataProcessor, adpEnabled);
    return engine;
  }, [adpEnabled]);

  // Update ProjectionEngine ADP setting when adpEnabled changes
  useEffect(() => {
    if (projectionEngine) {
      projectionEngine.setADPEnabled(adpEnabled);
    }
  }, [projectionEngine, adpEnabled]);

  // Load player data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await playerDataProcessor.loadPlayerData();
        setPlayerData(data);
        
        // Set default manager if league data is available
        if (leagueData?.managers?.length > 0 && !selectedManager) {
          setSelectedManager(leagueData.managers[0]);
        }
      } catch (err) {
        console.error('Error loading player data:', err);
        setError('Failed to load player data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [leagueData, selectedManager]);

  // Calculate projections when manager or settings change
  useEffect(() => {
    if (selectedManager && playerData && projectionEngine) {
      calculateIdealDraft();
    }
  }, [selectedManager, playerData, projectionEngine, adpEnabled]);

  /**
   * Calculate ideal draft projections for selected manager
   */
  const calculateIdealDraft = async () => {
    if (!selectedManager || !playerData) return;

    try {
      setLoading(true);
      
      // Create mock draft context for projection calculations
      const draftContext = createDraftContext();
      const managerRoster = getCurrentRoster(selectedManager);
      
      // Calculate projections for all draft rounds
      const rounds = [];
      let simulatedRoster = { ...managerRoster };
      
      // Assume 15 rounds for standard draft
      const totalRounds = 15;
      
      for (let round = 1; round <= totalRounds; round++) {
        const pickPosition = calculatePickPosition(selectedManager, round);
        const availablePlayers = getAvailablePlayers(round, draftContext);
        
        // Get top 3 picks for this round
        const topPicks = projectionEngine.getTopPicks(
          simulatedRoster, 
          availablePlayers, 
          draftContext, 
          3
        );
        
        rounds.push({
          round,
          pickPosition,
          topPicks,
          availablePlayers: availablePlayers.length
        });
        
        // Simulate taking the top pick for next round calculation
        if (topPicks.length > 0) {
          const topPick = topPicks[0].player;
          simulatedRoster = addPlayerToRoster(simulatedRoster, topPick);
        }
      }
      
      setProjectionData({
        manager: selectedManager,
        rounds,
        currentRoster: managerRoster,
        totalProjectedValue: calculateTotalProjectedValue(rounds)
      });
      
    } catch (err) {
      console.error('Error calculating ideal draft:', err);
      setError('Failed to calculate draft projections. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create draft context for projection calculations
   */
  const createDraftContext = () => {
    const allPlayers = playerData?.players || [];
    const managers = leagueData?.managers || [];
    
    // Create mock manager needs analysis
    const managerNeeds = managers.map((manager, index) => ({
      managerId: manager.id || `manager_${index}`,
      managerName: manager.name || `Manager ${index + 1}`,
      nextPick: (index + 1) * 2, // Mock pick calculation
      needs: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        FLEX: 1,
        BENCH: 6
      }
    }));

    return {
      availablePlayers: allPlayers,
      managerNeeds,
      currentPick: selectedManager?.draftPosition || 1,
      totalManagers: managers.length || 12
    };
  };

  /**
   * Get current roster for a manager
   */
  const getCurrentRoster = (manager) => {
    // Return empty roster for now - will be populated from actual draft data
    return {
      QB: [],
      RB: [],
      WR: [],
      TE: [],
      FLEX: [],
      BENCH: []
    };
  };

  /**
   * Calculate pick position for a manager in a given round
   */
  const calculatePickPosition = (manager, round) => {
    const draftPosition = manager?.draftPosition || 1;
    const totalManagers = leagueData?.managers?.length || 12;
    
    // Snake draft calculation
    if (round % 2 === 1) {
      // Odd rounds: normal order
      return ((round - 1) * totalManagers) + draftPosition;
    } else {
      // Even rounds: reverse order
      return ((round - 1) * totalManagers) + (totalManagers - draftPosition + 1);
    }
  };

  /**
   * Get available players for a given round
   */
  const getAvailablePlayers = (round, draftContext) => {
    // For now, return all players - in real implementation, 
    // this would filter out already drafted players
    return draftContext.availablePlayers || [];
  };

  /**
   * Add player to roster simulation
   */
  const addPlayerToRoster = (roster, player) => {
    const newRoster = { ...roster };
    const position = player.position;
    
    // Add to appropriate position array
    if (!newRoster[position]) {
      newRoster[position] = [];
    }
    
    newRoster[position] = [...newRoster[position], player];
    
    return newRoster;
  };

  /**
   * Calculate total projected value for all rounds
   */
  const calculateTotalProjectedValue = (rounds) => {
    return rounds.reduce((total, round) => {
      const topPick = round.topPicks[0];
      return total + (topPick?.score || 0);
    }, 0);
  };

  /**
   * Handle manager selection change
   */
  const handleManagerChange = (manager) => {
    setSelectedManager(manager);
    setProjectionData(null); // Clear previous projections
  };

  // Render loading state
  if (loading) {
    return (
      <div className="ideal-draft-projector">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading draft projections...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="ideal-draft-projector">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ideal-draft-projector">
      <div className="projector-header">
        <h2>Ideal Draft Projector</h2>
        <p>Project optimal picks for any manager based on roster needs and player values</p>
      </div>

      <div className="projector-controls">
        <ManagerSelector
          managers={leagueData?.managers || []}
          selectedManager={selectedManager}
          onManagerChange={handleManagerChange}
          loading={loading}
        />
        
        {onADPToggle && (
          <ADPToggle
            enabled={adpEnabled}
            onChange={onADPToggle}
            showLabel={true}
            showDescription={true}
            className="adp-toggle-wrapper"
          />
        )}
      </div>

      {selectedManager && (
        <div className="projector-content">
          <div className="content-grid">
            <div className="roster-section">
              <RosterAnalysis
                manager={selectedManager}
                currentRoster={projectionData?.currentRoster}
                rosterFormat={rosterFormat}
                playerData={playerData}
              />
            </div>
            
            <div className="projections-section">
              <ProjectedPicksDisplay
                projectionData={projectionData}
                loading={loading}
                selectedManager={selectedManager}
              />
            </div>
          </div>
        </div>
      )}

      {!selectedManager && !loading && (
        <div className="no-manager-selected">
          <p>Select a manager to view their ideal draft projections</p>
        </div>
      )}

      <style jsx>{`
        .ideal-draft-projector {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .projector-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .projector-header h2 {
          color: #333;
          margin-bottom: 10px;
        }

        .projector-header p {
          color: #666;
          font-size: 16px;
        }

        .projector-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .adp-toggle-wrapper {
          flex-shrink: 0;
        }

        .content-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 30px;
          margin-top: 20px;
        }

        .roster-section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
        }

        .projections-section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
        }

        .loading-container,
        .error-container,
        .no-manager-selected {
          text-align: center;
          padding: 40px;
          background: #f8f9fa;
          border-radius: 8px;
          margin: 20px 0;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-container button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 15px;
        }

        .error-container button:hover {
          background: #0056b3;
        }

        @media (max-width: 768px) {
          .ideal-draft-projector {
            padding: 15px;
          }

          .projector-controls {
            flex-direction: column;
            gap: 15px;
          }

          .content-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }
      `}</style>
    </div>
  );
}