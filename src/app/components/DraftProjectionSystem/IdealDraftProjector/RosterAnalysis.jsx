'use client';

import React, { useMemo } from 'react';

/**
 * RosterAnalysis - Current roster display showing filled and unfilled positions
 * Implements roster need urgency indicators and position availability with visual progress indicators
 */
export default function RosterAnalysis({ 
  manager = null, 
  currentRoster = null, 
  rosterFormat = null, 
  playerData = null 
}) {
  // Default roster format if none provided
  const defaultRosterFormat = {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1, // RB/WR/TE eligible
    BENCH: 6
  };

  const activeRosterFormat = rosterFormat || defaultRosterFormat;

  /**
   * Calculate roster analysis data
   */
  const rosterAnalysis = useMemo(() => {
    if (!currentRoster) {
      // Return empty roster analysis
      return Object.keys(activeRosterFormat).map(position => ({
        position,
        required: activeRosterFormat[position],
        filled: 0,
        remaining: activeRosterFormat[position],
        players: [],
        urgency: calculateUrgency(position, 0, activeRosterFormat[position]),
        completionPercentage: 0
      }));
    }

    return Object.keys(activeRosterFormat).map(position => {
      const players = currentRoster[position] || [];
      const filled = players.length;
      const required = activeRosterFormat[position];
      const remaining = Math.max(0, required - filled);
      const completionPercentage = required > 0 ? (filled / required) * 100 : 100;

      return {
        position,
        required,
        filled,
        remaining,
        players,
        urgency: calculateUrgency(position, filled, required),
        completionPercentage
      };
    });
  }, [currentRoster, activeRosterFormat]);

  /**
   * Calculate urgency level for a position
   */
  function calculateUrgency(position, filled, required) {
    const remaining = required - filled;
    
    if (remaining <= 0) return 'complete';
    if (remaining === required) {
      // No players drafted yet
      if (['QB', 'TE'].includes(position)) return 'high';
      if (['RB', 'WR'].includes(position)) return 'critical';
      return 'medium';
    }
    if (remaining === 1) return 'medium';
    return 'low';
  }

  /**
   * Get urgency color
   */
  const getUrgencyColor = (urgency) => {
    const colors = {
      complete: '#27ae60',
      low: '#3498db',
      medium: '#f39c12',
      high: '#e67e22',
      critical: '#e74c3c'
    };
    return colors[urgency] || '#95a5a6';
  };

  /**
   * Get position color for styling
   */
  const getPositionColor = (position) => {
    const colors = {
      QB: '#8e44ad',
      RB: '#e74c3c',
      WR: '#3498db',
      TE: '#f39c12',
      FLEX: '#9b59b6',
      BENCH: '#95a5a6'
    };
    return colors[position] || '#95a5a6';
  };

  /**
   * Get urgency text
   */
  const getUrgencyText = (urgency) => {
    const texts = {
      complete: 'Complete',
      low: 'Low Priority',
      medium: 'Medium Priority',
      high: 'High Priority',
      critical: 'Critical Need'
    };
    return texts[urgency] || 'Unknown';
  };

  /**
   * Calculate total roster progress
   */
  const totalProgress = useMemo(() => {
    const totalRequired = Object.values(activeRosterFormat).reduce((sum, count) => sum + count, 0);
    const totalFilled = rosterAnalysis.reduce((sum, pos) => sum + pos.filled, 0);
    return totalRequired > 0 ? (totalFilled / totalRequired) * 100 : 0;
  }, [rosterAnalysis, activeRosterFormat]);

  /**
   * Get position priority order
   */
  const positionsByPriority = useMemo(() => {
    const priorityOrder = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
      complete: 0
    };

    return [...rosterAnalysis].sort((a, b) => {
      const aPriority = priorityOrder[a.urgency];
      const bPriority = priorityOrder[b.urgency];
      return bPriority - aPriority;
    });
  }, [rosterAnalysis]);

  if (!manager) {
    return (
      <div className="roster-analysis">
        <div className="empty-state">
          <h3>No Manager Selected</h3>
          <p>Select a manager to view their roster analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="roster-analysis">
      <div className="analysis-header">
        <h3>Roster Analysis</h3>
        <p>{manager.name || `Manager ${manager.id}`}</p>
      </div>

      <div className="overall-progress">
        <div className="progress-header">
          <span className="progress-label">Overall Progress</span>
          <span className="progress-percentage">{totalProgress.toFixed(0)}%</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ 
              width: `${totalProgress}%`,
              backgroundColor: totalProgress === 100 ? '#27ae60' : '#007bff'
            }}
          />
        </div>
      </div>

      <div className="positions-grid">
        {positionsByPriority.map((positionData) => (
          <div key={positionData.position} className="position-card">
            <div className="position-header">
              <div className="position-info">
                <span 
                  className="position-badge"
                  style={{ backgroundColor: getPositionColor(positionData.position) }}
                >
                  {positionData.position}
                </span>
                <div className="position-counts">
                  <span className="filled-count">{positionData.filled}</span>
                  <span className="separator">/</span>
                  <span className="required-count">{positionData.required}</span>
                </div>
              </div>
              
              <div 
                className="urgency-indicator"
                style={{ backgroundColor: getUrgencyColor(positionData.urgency) }}
              >
                {getUrgencyText(positionData.urgency)}
              </div>
            </div>

            <div className="position-progress">
              <div className="progress-bar small">
                <div 
                  className="progress-fill"
                  style={{ 
                    width: `${positionData.completionPercentage}%`,
                    backgroundColor: getUrgencyColor(positionData.urgency)
                  }}
                />
              </div>
            </div>

            <div className="position-details">
              {positionData.players.length > 0 ? (
                <div className="drafted-players">
                  <h5>Drafted Players:</h5>
                  <div className="players-list">
                    {positionData.players.map((player, index) => (
                      <div key={index} className="player-item">
                        <span className="player-name">{player.name}</span>
                        <span className="player-team">{player.team}</span>
                        {player.projected_2025_points && (
                          <span className="player-points">
                            {player.projected_2025_points.toFixed(1)} pts
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-position">
                  <span className="empty-text">No players drafted</span>
                  {positionData.remaining > 0 && (
                    <span className="remaining-text">
                      Need {positionData.remaining} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {positionData.position === 'FLEX' && (
              <div className="flex-note">
                <small>RB/WR/TE eligible</small>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="analysis-summary">
        <h4>Draft Priorities</h4>
        <div className="priorities-list">
          {positionsByPriority
            .filter(pos => pos.urgency !== 'complete')
            .slice(0, 3)
            .map((pos, index) => (
              <div key={pos.position} className="priority-item">
                <span className="priority-rank">#{index + 1}</span>
                <span 
                  className="priority-position"
                  style={{ color: getPositionColor(pos.position) }}
                >
                  {pos.position}
                </span>
                <span className="priority-reason">
                  Need {pos.remaining} more • {getUrgencyText(pos.urgency)}
                </span>
              </div>
            ))}
          
          {positionsByPriority.every(pos => pos.urgency === 'complete') && (
            <div className="all-complete">
              <span>🎉 All roster requirements fulfilled!</span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .roster-analysis {
          width: 100%;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .empty-state h3 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .empty-state p {
          margin: 0;
          color: #666;
        }

        .analysis-header {
          margin-bottom: 25px;
          text-align: center;
        }

        .analysis-header h3 {
          margin: 0 0 5px 0;
          color: #333;
        }

        .analysis-header p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .overall-progress {
          margin-bottom: 25px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .progress-label {
          font-weight: 600;
          color: #333;
        }

        .progress-percentage {
          font-weight: bold;
          color: #007bff;
        }

        .progress-bar {
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-bar.small {
          height: 4px;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .positions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }

        .position-card {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 15px;
          background: white;
          transition: box-shadow 0.2s ease;
        }

        .position-card:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .position-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .position-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .position-badge {
          padding: 4px 8px;
          border-radius: 4px;
          color: white;
          font-size: 12px;
          font-weight: bold;
          min-width: 35px;
          text-align: center;
        }

        .position-counts {
          display: flex;
          align-items: center;
          font-weight: 600;
        }

        .filled-count {
          color: #27ae60;
          font-size: 18px;
        }

        .separator {
          margin: 0 4px;
          color: #666;
        }

        .required-count {
          color: #666;
          font-size: 16px;
        }

        .urgency-indicator {
          padding: 4px 8px;
          border-radius: 12px;
          color: white;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
        }

        .position-progress {
          margin-bottom: 15px;
        }

        .position-details {
          min-height: 60px;
        }

        .drafted-players h5 {
          margin: 0 0 8px 0;
          color: #333;
          font-size: 14px;
        }

        .players-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .player-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          background: #f8f9fa;
          border-radius: 4px;
          font-size: 13px;
        }

        .player-name {
          font-weight: 600;
          color: #333;
        }

        .player-team {
          color: #666;
          font-size: 11px;
        }

        .player-points {
          color: #007bff;
          font-weight: 600;
        }

        .empty-position {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          text-align: center;
        }

        .empty-text {
          color: #999;
          font-style: italic;
          margin-bottom: 4px;
        }

        .remaining-text {
          color: #e74c3c;
          font-weight: 600;
          font-size: 12px;
        }

        .flex-note {
          margin-top: 8px;
          text-align: center;
        }

        .flex-note small {
          color: #666;
          font-style: italic;
        }

        .analysis-summary {
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .analysis-summary h4 {
          margin: 0 0 15px 0;
          color: #333;
        }

        .priorities-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .priority-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: white;
          border-radius: 6px;
          border-left: 4px solid #007bff;
        }

        .priority-rank {
          font-weight: bold;
          color: #007bff;
          min-width: 25px;
        }

        .priority-position {
          font-weight: bold;
          min-width: 50px;
        }

        .priority-reason {
          color: #666;
          font-size: 14px;
        }

        .all-complete {
          text-align: center;
          padding: 20px;
          background: #d4edda;
          border-radius: 6px;
          color: #155724;
          font-weight: 600;
        }

        /* Mobile responsive styles */
        @media (max-width: 768px) {
          .positions-grid {
            grid-template-columns: 1fr;
          }

          .position-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .urgency-indicator {
            align-self: flex-end;
          }

          .player-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
          }

          .priority-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}