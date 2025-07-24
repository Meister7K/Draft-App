# Draft Analytics Utilities

This directory contains the core data processing utilities for the Draft Analytics feature. These utilities handle historical data parsing, statistical calculations, and data aggregation for fantasy football draft analysis.

## Overview

The utilities are organized into three main modules:

1. **Historical Data Parser** - Extracts and processes draft history from the database
2. **Statistical Calculations** - Calculates position frequencies, averages, and trends
3. **Data Aggregation** - Aggregates multiple seasons of data and provides league-wide statistics

## Modules

### Historical Data Parser (`historicalDataParser.js`)

Handles extraction and processing of historical draft data from the database.

#### Functions:

- `extractDraftHistoryByManager(data)` - Extracts draft history for all managers
- `getManagerDraftHistory(data, managerId)` - Gets history for a specific manager
- `enhancePicksWithPlayerData(picks, data)` - Adds player information to draft picks
- `filterHistoryByDateRange(managerHistory, startSeason, endSeason)` - Filters by date range
- `getAvailableSeasons(data)` - Gets all available seasons from the database

### Statistical Calculations (`statisticalCalculations.js`)

Calculates various statistical metrics from draft data.

#### Functions:

- `calculatePositionFrequencies(picks)` - Calculates position frequency statistics
- `calculateAverageDraftPositions(picks)` - Calculates average draft positions by position
- `calculateMostFrequentPlayers(picks)` - Identifies frequently drafted players
- `calculateRoundTendencies(picks, threshold)` - Analyzes early vs late round tendencies
- `calculateYearOverYearTrends(picks)` - Calculates trends across seasons
- `calculateManagerStatistics(picks)` - Comprehensive statistical summary

### Data Aggregation (`dataAggregation.js`)

Processes and aggregates multiple seasons of draft data.

#### Functions:

- `aggregateAllManagersData(data, options)` - Aggregates data for all managers
- `aggregateManagerData(data, managerId, options)` - Aggregates data for specific manager
- `aggregateLeagueData(data, leagueId, options)` - Aggregates league-wide statistics
- `calculateLeagueAverages(managersData)` - Calculates league averages for comparison
- `processMultiSeasonTrends(data, managerId, seasonsToAnalyze)` - Multi-season trend analysis

## Usage Examples

### Basic Manager Analysis

```javascript
import { aggregateManagerData } from './utils';

// Get comprehensive manager data
const managerData = aggregateManagerData(database, 'manager123');

console.log(`Total drafts: ${managerData.totalDrafts}`);
console.log(`Seasons: ${managerData.seasons.join(', ')}`);
console.log(`Most frequent position: ${getMostFrequentPosition(managerData.statistics.positionFrequencies)}`);
```

### Position Frequency Analysis

```javascript
import { calculatePositionFrequencies } from './utils';

const positionStats = calculatePositionFrequencies(picks);

Object.keys(positionStats).forEach(position => {
  const stats = positionStats[position];
  console.log(`${position}: ${stats.count} picks (${stats.percentage.toFixed(1)}%)`);
  console.log(`  Average round: ${stats.avgRound.toFixed(1)}`);
});
```

### League Comparison

```javascript
import { aggregateLeagueData } from './utils';

const leagueData = aggregateLeagueData(database, 'league456');

console.log(`League: ${leagueData.leagueName}`);
console.log(`Total managers: ${leagueData.totalManagers}`);
console.log(`League averages:`, leagueData.leagueAverages);
```

### Multi-Season Trends

```javascript
import { processMultiSeasonTrends } from './utils';

const trends = processMultiSeasonTrends(database, 'manager123', 3);

console.log(`Overall trend: ${trends.overallTrend}`);
trends.recentSeasons.forEach(season => {
  const seasonData = trends.trends[season];
  console.log(`${season}: ${seasonData.totalPicks} picks`);
});
```

## Data Structures

### Manager History Object

```javascript
{
  managerId: string,
  totalDrafts: number,
  seasons: number[],
  leagues: string[],
  picks: Pick[],
  statistics: ManagerStatistics
}
```

### Position Frequency Statistics

```javascript
{
  [position]: {
    count: number,
    percentage: number,
    avgRound: number,
    earliestRound: number,
    latestRound: number,
    rounds: number[]
  }
}
```

### Manager Statistics

```javascript
{
  totalPicks: number,
  positionFrequencies: PositionFrequencies,
  averageDraftPositions: AverageDraftPositions,
  mostFrequentPlayers: FrequentPlayer[],
  roundTendencies: RoundTendencies,
  yearOverYearTrends: YearOverYearTrends
}
```

## Testing

The utilities include comprehensive unit tests located in the `__tests__` directory:

- `historicalDataParser.test.js` - Tests for data parsing functions
- `statisticalCalculations.test.js` - Tests for statistical calculations
- `dataAggregation.test.js` - Tests for data aggregation functions
- `testRunner.js` - Simple test runner for verification

To run the basic verification tests:

```bash
node --experimental-modules src/app/components/DraftAnalytics/utils/__tests__/testRunner.js
```

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 1.1**: Historical data parsing functions extract draft history by manager
- **Requirement 2.1**: Statistical calculation utilities for position frequencies
- **Requirement 2.2**: Position frequency statistics with percentage breakdown and averages
- **Unit Tests**: Comprehensive test coverage for all data processing functions

## Performance Considerations

- All functions handle null/undefined inputs gracefully
- Large datasets are processed efficiently with minimal memory overhead
- Statistical calculations are optimized for performance
- Data structures are designed for fast lookups and aggregation

## Error Handling

- Functions return empty/default values for invalid inputs
- Null checks prevent runtime errors
- Missing data is handled gracefully with fallback values
- All edge cases are covered in the test suite