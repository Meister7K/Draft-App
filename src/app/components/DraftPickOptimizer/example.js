/**
 * Example usage of the OptimizationEngine
 * This demonstrates how to integrate the optimization engine with YourDraftPicks component
 */

import { 
  calculateOptimizationScore, 
  assessRosterNeeds 
} from './OptimizationEngine.js';

// Example: How to use the optimization engine in YourDraftPicks component
export function exampleOptimizationUsage(
  availablePlayers,
  currentRoster,
  rosterFormat,
  calculateCompositeValue,
  currentPickNumber = 30
) {
  // 1. Assess current roster needs
  const rosterNeeds = assessRosterNeeds(currentRoster, rosterFormat);
  console.log('Roster Analysis:', rosterNeeds.summary);
  console.log('Critical Needs:', rosterNeeds.criticalNeeds);

  // 2. Create optimization context
  const context = {
    currentRoster,
    rosterFormat,
    calculateCompositeValue,
    currentPickNumber,
    picksUntilNext: 5 // Example: 5 picks until user's next turn
  };

  // 3. Calculate optimization scores for available players
  const playerRecommendations = availablePlayers
    .map(player => ({
      player,
      optimization: calculateOptimizationScore(player, context)
    }))
    .sort((a, b) => b.optimization.score - a.optimization.score)
    .slice(0, 5); // Top 5 recommendations

  // 4. Display recommendations
  console.log('\n=== TOP 5 DRAFT RECOMMENDATIONS ===');
  playerRecommendations.forEach((rec, index) => {
    const { player, optimization } = rec;
    const { score, factors } = optimization;
    
    console.log(`\n${index + 1}. ${player.player_info.name} (${player.player_info.position})`);
    console.log(`   Overall Score: ${score.toFixed(1)}/100`);
    console.log(`   Factors:`);
    console.log(`     • Roster Need: ${factors.rosterNeed.score.toFixed(1)} - ${factors.rosterNeed.explanation}`);
    console.log(`     • Player Value: ${factors.playerValue.score.toFixed(1)} - ${factors.playerValue.explanation}`);
    console.log(`     • Competition: ${factors.competition.score.toFixed(1)} - ${factors.competition.explanation}`);
    console.log(`     • Availability: ${factors.availability.score.toFixed(1)} - ${factors.availability.explanation}`);
    console.log(`     • Lineup Impact: ${factors.startingLineupImpact.score.toFixed(1)} - ${factors.startingLineupImpact.explanation}`);
  });

  return playerRecommendations;
}

// Example data structures that match YourDraftPicks component
export const exampleData = {
  // Current roster state (from YourDraftPicks component)
  currentRoster: {
    positionCounts: { QB: 1, RB: 1, WR: 1, TE: 0 },
    starters: {
      QB: [{ 
        player: { 
          player_info: { 
            name: 'Josh Allen',
            position: 'QB',
            projected_2025_points: 320 
          } 
        } 
      }],
      RB: [
        { 
          player: { 
            player_info: { 
              name: 'Christian McCaffrey',
              position: 'RB',
              projected_2025_points: 300 
            } 
          } 
        }, 
        null
      ],
      WR: [
        { 
          player: { 
            player_info: { 
              name: 'Tyreek Hill',
              position: 'WR',
              projected_2025_points: 280 
            } 
          } 
        }, 
        null
      ],
      TE: [null],
      FLEX: [null]
    }
  },

  // Roster format (from YourDraftPicks component)
  rosterFormat: [
    { position: 'QB', slots: 1 },
    { position: 'RB', slots: 2 },
    { position: 'WR', slots: 2 },
    { position: 'TE', slots: 1 },
    { position: 'FLEX', slots: 1 }
  ],

  // Available players (filtered from data.players in YourDraftPicks)
  availablePlayers: [
    {
      player_info: {
        player_id: 'player-1',
        name: 'Travis Kelce',
        position: 'TE',
        team: 'KC',
        overall_rank: 20,
        position_rank: 1,
        projected_2025_points: 240
      }
    },
    {
      player_info: {
        player_id: 'player-2',
        name: 'Davante Adams',
        position: 'WR',
        team: 'LV',
        overall_rank: 25,
        position_rank: 8,
        projected_2025_points: 220
      }
    },
    {
      player_info: {
        player_id: 'player-3',
        name: 'Saquon Barkley',
        position: 'RB',
        team: 'PHI',
        overall_rank: 30,
        position_rank: 12,
        projected_2025_points: 210
      }
    },
    {
      player_info: {
        player_id: 'player-4',
        name: 'Lamar Jackson',
        position: 'QB',
        team: 'BAL',
        overall_rank: 35,
        position_rank: 5,
        projected_2025_points: 290
      }
    }
  ]
};

// Mock calculateCompositeValue function (from YourDraftPicks)
export const mockCalculateCompositeValue = (player, isDrafted = false, pickNumber = null) => {
  const position = player.player_info.position;
  const overallRank = player.player_info.overall_rank || 999;
  const projectedPoints = player.player_info.projected_2025_points || 0;

  // Simplified version of the actual calculateCompositeValue logic
  const baseMultipliers = {
    QB: 2.2, RB: 1.8, WR: 1.6, TE: 2.4,
  };

  const baseMultiplier = baseMultipliers[position] || 1.0;
  const overallRankScore = Math.max(0, (300 - overallRank) / 300) * 100;
  const projectedPointsScore = Math.min(projectedPoints / 400 * 100, 100);

  return (overallRankScore * 0.4 + projectedPointsScore * 0.6) * baseMultiplier;
};

// Example usage
if (typeof window === 'undefined') {
  // Only run in Node.js environment (for testing)
  console.log('=== DRAFT PICK OPTIMIZER EXAMPLE ===');
  
  const recommendations = exampleOptimizationUsage(
    exampleData.availablePlayers,
    exampleData.currentRoster,
    exampleData.rosterFormat,
    mockCalculateCompositeValue,
    25 // Current pick number
  );

  console.log(`\nGenerated ${recommendations.length} recommendations`);
  console.log('Integration with YourDraftPicks component ready!');
}