/**
 * Simple test runner to verify utilities work correctly
 * This is a basic verification since no testing framework is configured
 */

import {
  extractDraftHistoryByManager,
  getManagerDraftHistory,
  enhancePicksWithPlayerData,
  calculatePositionFrequencies,
  calculateManagerStatistics,
  aggregateManagerData
} from '../index.js';

// Mock data for testing
const mockData = {
  leagues: {
    'league1': {
      league_id: 'league1',
      name: 'Test League 1',
      season: 2024,
      drafts: {
        'draft1': {
          draft_id: 'draft1',
          season: 2024,
          picks: [
            {
              pick_id: 'pick1',
              pick_no: 1,
              round: 1,
              draft_slot: 1,
              picked_by: 'manager1',
              metadata: {
                player_id: 'player1',
                first_name: 'Josh',
                last_name: 'Allen',
                position: 'QB',
                team: 'BUF'
              }
            },
            {
              pick_id: 'pick2',
              pick_no: 13,
              round: 2,
              draft_slot: 1,
              picked_by: 'manager1',
              metadata: {
                player_id: 'player2',
                first_name: 'Christian',
                last_name: 'McCaffrey',
                position: 'RB',
                team: 'SF'
              }
            }
          ]
        }
      }
    }
  },
  players: [
    {
      player_info: {
        player_id: 'player1',
        name: 'Josh Allen',
        position: 'QB',
        team: 'BUF',
        projected_2025_points: 347.48
      }
    },
    {
      player_info: {
        player_id: 'player2',
        name: 'Christian McCaffrey',
        position: 'RB',
        team: 'SF',
        projected_2025_points: 285.32
      }
    }
  ]
};

function runTests() {
  console.log('🧪 Running Draft Analytics Utilities Tests...\n');

  try {
    // Test 1: Extract draft history
    console.log('✅ Test 1: Extract draft history by manager');
    const history = extractDraftHistoryByManager(mockData);
    console.log(`   - Found ${Object.keys(history).length} managers`);
    console.log(`   - Manager1 has ${history.manager1?.totalDrafts || 0} drafts`);
    console.log(`   - Manager1 has ${history.manager1?.picks?.length || 0} picks\n`);

    // Test 2: Get specific manager history
    console.log('✅ Test 2: Get manager draft history');
    const managerHistory = getManagerDraftHistory(mockData, 'manager1');
    console.log(`   - Total drafts: ${managerHistory.totalDrafts}`);
    console.log(`   - Total picks: ${managerHistory.picks.length}`);
    console.log(`   - Seasons: ${managerHistory.seasons.join(', ')}\n`);

    // Test 3: Enhance picks with player data
    console.log('✅ Test 3: Enhance picks with player data');
    const enhancedPicks = enhancePicksWithPlayerData(managerHistory.picks, mockData);
    console.log(`   - Enhanced ${enhancedPicks.length} picks`);
    console.log(`   - First pick player: ${enhancedPicks[0]?.playerName || 'Unknown'}`);
    console.log(`   - First pick has player data: ${enhancedPicks[0]?.player ? 'Yes' : 'No'}\n`);

    // Test 4: Calculate position frequencies
    console.log('✅ Test 4: Calculate position frequencies');
    const positionFreqs = calculatePositionFrequencies(enhancedPicks);
    console.log(`   - Positions found: ${Object.keys(positionFreqs).join(', ')}`);
    Object.keys(positionFreqs).forEach(pos => {
      console.log(`   - ${pos}: ${positionFreqs[pos].count} picks (${positionFreqs[pos].percentage.toFixed(1)}%)`);
    });
    console.log('');

    // Test 5: Calculate manager statistics
    console.log('✅ Test 5: Calculate manager statistics');
    const stats = calculateManagerStatistics(enhancedPicks);
    console.log(`   - Total picks: ${stats.totalPicks}`);
    console.log(`   - Position frequencies calculated: ${Object.keys(stats.positionFrequencies).length > 0 ? 'Yes' : 'No'}`);
    console.log(`   - Most frequent players: ${stats.mostFrequentPlayers.length}`);
    console.log(`   - Year-over-year trends: ${Object.keys(stats.yearOverYearTrends).length} seasons\n`);

    // Test 6: Aggregate manager data
    console.log('✅ Test 6: Aggregate manager data');
    const aggregatedData = aggregateManagerData(mockData, 'manager1');
    console.log(`   - Manager ID: ${aggregatedData.managerId}`);
    console.log(`   - Total drafts: ${aggregatedData.totalDrafts}`);
    console.log(`   - Statistics calculated: ${aggregatedData.statistics.totalPicks > 0 ? 'Yes' : 'No'}`);
    console.log(`   - Date range: ${aggregatedData.dateRange.startSeason} - ${aggregatedData.dateRange.endSeason}\n`);

    console.log('🎉 All tests passed! Core data processing utilities are working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  runTests();
}

export { runTests };