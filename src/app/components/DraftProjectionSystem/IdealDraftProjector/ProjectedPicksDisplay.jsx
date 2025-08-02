'use client';

import React, { useState, useMemo } from 'react';

/**
 * ProjectedPicksDisplay - Display of top 3 ideal picks for each draft round
 * Implements pick reasoning and explanation display with responsive layout
 */
export default function ProjectedPicksDisplay({ 
  projectionData = null, 
  loading = false, 
  selectedManager = null 
}) {
  const [expandedRounds, setExpandedRounds] = useState(new Set([1, 2, 3])); // First 3 rounds expanded by default
  const [viewMode, setViewMode] = useState('rounds'); // 'rounds' or 'positions'

  /**
   * Toggle round expansion
   */
  const toggleRoundExpansion = (round) => {
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(round)) {
      newExpanded.delete(round);
    } else {
      newExpanded.add(round);
    }
    setExpandedRounds(newExpanded);
  };

  /**
   * Expand all rounds
   */
  const expandAllRounds = () => {
    if (projectionData?.rounds) {
      setExpandedRounds(new Set(projectionData.rounds.map(r => r.round)));
    }
  };

  /**
   * Collapse all rounds
   */
  const collapseAllRounds = () => {
    setExpandedRounds(new Set());
  };

  /**
   * Get position color for styling
   */
  const getPositionColor = (position) => {
    const colors = {
      QB: '#8e44ad',
      RB: '#e74c3c',
      WR: '#3498db',
      TE: '#f39c12'
    };
    return colors[position] || '#95a5a6';
  };

  /**
   * Format player projected points
   */
  const formatProjectedPoints = (points) => {
    return points ? points.toFixed(1) : '0.0';
  };

  /**
   * Get pick grade color
   */
  const getPickGradeColor = (score) => {
    if (score >= 80) return '#27ae60'; // Green
    if (score >= 60) return '#f39c12'; // Orange
    if (score >= 40) return '#e67e22'; // Dark orange
    return '#e74c3c'; // Red
  };

  /**
   * Group picks by position for position view
   */
  const picksByPosition = useMemo(() => {
    if (!projectionData?.rounds) return {};
    
    const grouped = {};
    
    projectionData.rounds.forEach(round => {
      round.topPicks.forEach((pick, index) => {
        const position = pick.player.position;
        if (!grouped[position]) {
          grouped[position] = [];
        }
        
        grouped[position].push({
          ...pick,
          round: round.round,
          pickPosition: round.pickPosition,
          rank: index + 1
        });
      });
    });
    
    // Sort each position by score
    Object.keys(grouped).forEach(position => {
      grouped[position].sort((a, b) => b.score - a.score);
    });
    
    return grouped;
  }, [projectionData]);

  // Render loading state
  if (loading) {
    return (
      <div className="projected-picks-display">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Calculating ideal picks...</p>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!projectionData || !selectedManager) {
    return (
      <div className="projected-picks-display">
        <div className="empty-state">
          <h3>No Projections Available</h3>
          <p>Select a manager to view their ideal draft projections</p>
        </div>
      </div>
    );
  }

  return (
    <div className="projected-picks-display">
      <div className="display-header">
        <div className="header-info">
          <h3>Ideal Draft Projections</h3>
          <p>
            {selectedManager.name || `Manager ${selectedManager.id}`} - 
            Total Projected Value: {projectionData.totalProjectedValue?.toFixed(1) || '0.0'}
          </p>
        </div>
        
        <div className="display-controls">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'rounds' ? 'active' : ''}`}
              onClick={() => setViewMode('rounds')}
            >
              By Rounds
            </button>
            <button
              className={`toggle-btn ${viewMode === 'positions' ? 'active' : ''}`}
              onClick={() => setViewMode('positions')}
            >
              By Position
            </button>
          </div>
          
          {viewMode === 'rounds' && (
            <div className="expand-controls">
              <button className="control-btn" onClick={expandAllRounds}>
                Expand All
              </button>
              <button className="control-btn" onClick={collapseAllRounds}>
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {viewMode === 'rounds' ? (
        <div className="rounds-view">
          {projectionData.rounds.map((round) => (
            <div key={round.round} className="round-container">
              <div 
                className="round-header"
                onClick={() => toggleRoundExpansion(round.round)}
              >
                <div className="round-info">
                  <h4>Round {round.round}</h4>
                  <span className="pick-info">
                    Pick #{round.pickPosition} • {round.availablePlayers} players available
                  </span>
                </div>
                <span className={`expand-icon ${expandedRounds.has(round.round) ? 'expanded' : ''}`}>
                  ▼
                </span>
              </div>

              {expandedRounds.has(round.round) && (
                <div className="picks-container">
                  {round.topPicks.length === 0 ? (
                    <div className="no-picks">
                      No suitable picks available for this round
                    </div>
                  ) : (
                    round.topPicks.map((pick, index) => (
                      <div key={index} className="pick-card">
                        <div className="pick-rank">#{index + 1}</div>
                        
                        <div className="player-info">
                          <div className="player-header">
                            <span 
                              className="position-badge"
                              style={{ backgroundColor: getPositionColor(pick.player.position) }}
                            >
                              {pick.player.position}
                            </span>
                            <h5 className="player-name">{pick.player.name}</h5>
                            <span className="player-team">{pick.player.team}</span>
                          </div>
                          
                          <div className="player-stats">
                            <div className="stat">
                              <span className="stat-label">Projected Points:</span>
                              <span className="stat-value">
                                {formatProjectedPoints(pick.player.projected_2025_points)}
                              </span>
                            </div>
                            <div className="stat">
                              <span className="stat-label">Position Rank:</span>
                              <span className="stat-value">#{pick.player.position_rank}</span>
                            </div>
                            <div className="stat">
                              <span className="stat-label">Pick Value:</span>
                              <span 
                                className="stat-value score"
                                style={{ color: getPickGradeColor(pick.score) }}
                              >
                                {pick.score.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pick-reasoning">
                          <h6>Why this pick?</h6>
                          <p>{pick.reasoning}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="positions-view">
          {Object.entries(picksByPosition).map(([position, picks]) => (
            <div key={position} className="position-container">
              <div className="position-header">
                <span 
                  className="position-badge large"
                  style={{ backgroundColor: getPositionColor(position) }}
                >
                  {position}
                </span>
                <h4>{position} Recommendations</h4>
                <span className="picks-count">{picks.length} picks</span>
              </div>

              <div className="position-picks">
                {picks.slice(0, 6).map((pick, index) => (
                  <div key={index} className="position-pick-card">
                    <div className="pick-header">
                      <span className="pick-round">R{pick.round}</span>
                      <span className="pick-rank">#{pick.rank}</span>
                    </div>
                    
                    <div className="player-summary">
                      <h6 className="player-name">{pick.player.name}</h6>
                      <div className="player-details">
                        <span>{pick.player.team}</span>
                        <span>{formatProjectedPoints(pick.player.projected_2025_points)} pts</span>
                        <span 
                          className="score"
                          style={{ color: getPickGradeColor(pick.score) }}
                        >
                          {pick.score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .projected-picks-display {
          width: 100%;
        }

        .loading-container,
        .empty-state {
          text-align: center;
          padding: 40px;
          background: #f8f9fa;
          border-radius: 8px;
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

        .display-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 25px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e0e0e0;
        }

        .header-info h3 {
          margin: 0 0 8px 0;
          color: #333;
        }

        .header-info p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .display-controls {
          display: flex;
          gap: 15px;
          align-items: center;
        }

        .view-toggle {
          display: flex;
          background: #f8f9fa;
          border-radius: 6px;
          overflow: hidden;
        }

        .toggle-btn {
          padding: 8px 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .toggle-btn.active {
          background: #007bff;
          color: white;
        }

        .expand-controls {
          display: flex;
          gap: 8px;
        }

        .control-btn {
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .control-btn:hover {
          background: #f8f9fa;
        }

        .round-container {
          margin-bottom: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }

        .round-header {
          padding: 15px 20px;
          background: #f8f9fa;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background-color 0.2s ease;
        }

        .round-header:hover {
          background: #e9ecef;
        }

        .round-info h4 {
          margin: 0 0 4px 0;
          color: #333;
        }

        .pick-info {
          font-size: 14px;
          color: #666;
        }

        .expand-icon {
          transition: transform 0.2s ease;
          color: #666;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .picks-container {
          padding: 20px;
        }

        .no-picks {
          text-align: center;
          color: #666;
          font-style: italic;
          padding: 20px;
        }

        .pick-card {
          display: flex;
          gap: 15px;
          padding: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          margin-bottom: 15px;
          background: white;
          transition: box-shadow 0.2s ease;
        }

        .pick-card:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .pick-rank {
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
          min-width: 40px;
          text-align: center;
        }

        .player-info {
          flex: 1;
        }

        .player-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .position-badge {
          padding: 4px 8px;
          border-radius: 4px;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }

        .position-badge.large {
          padding: 6px 12px;
          font-size: 14px;
        }

        .player-name {
          margin: 0;
          color: #333;
          font-size: 18px;
        }

        .player-team {
          color: #666;
          font-size: 14px;
        }

        .player-stats {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }

        .stat-value {
          font-weight: 600;
          color: #333;
        }

        .stat-value.score {
          font-weight: bold;
        }

        .pick-reasoning {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #f0f0f0;
        }

        .pick-reasoning h6 {
          margin: 0 0 8px 0;
          color: #333;
          font-size: 14px;
        }

        .pick-reasoning p {
          margin: 0;
          color: #666;
          font-size: 14px;
          line-height: 1.4;
        }

        .positions-view {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .position-container {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }

        .position-header {
          padding: 15px 20px;
          background: #f8f9fa;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .position-header h4 {
          margin: 0;
          flex: 1;
          color: #333;
        }

        .picks-count {
          font-size: 12px;
          color: #666;
          background: white;
          padding: 4px 8px;
          border-radius: 12px;
        }

        .position-picks {
          padding: 15px;
        }

        .position-pick-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          margin-bottom: 8px;
          background: white;
        }

        .pick-header {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .pick-round {
          background: #007bff;
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: bold;
        }

        .pick-rank {
          color: #666;
          font-size: 12px;
        }

        .player-summary {
          flex: 1;
          margin-left: 15px;
        }

        .player-summary .player-name {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 600;
        }

        .player-details {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #666;
        }

        .player-details .score {
          font-weight: bold;
        }

        /* Mobile responsive styles */
        @media (max-width: 768px) {
          .display-header {
            flex-direction: column;
            gap: 15px;
            align-items: stretch;
          }

          .display-controls {
            justify-content: space-between;
          }

          .pick-card {
            flex-direction: column;
            gap: 10px;
          }

          .pick-rank {
            align-self: flex-start;
          }

          .player-stats {
            flex-wrap: wrap;
            gap: 15px;
          }

          .positions-view {
            grid-template-columns: 1fr;
          }

          .position-header {
            flex-wrap: wrap;
            gap: 8px;
          }
        }
      `}</style>
    </div>
  );
}