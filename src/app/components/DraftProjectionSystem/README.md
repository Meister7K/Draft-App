# Draft Projection System

A comprehensive fantasy football draft analysis system with two main components:

1. **Ideal Draft Projector** - Projects optimal picks for any manager based on roster needs and player values
2. **Actual Draft Evaluator** - Connects to Sleeper API for real-time draft analysis and pick evaluation

## Project Structure

```
DraftProjectionSystem/
├── DraftProjectionSystem.jsx          # Main container component
├── IdealDraftProjector/               # Ideal draft projection components
│   ├── IdealDraftProjector.jsx
│   ├── ManagerSelector.jsx
│   ├── ProjectedPicksDisplay.jsx
│   └── RosterAnalysis.jsx
├── ActualDraftEvaluator/              # Real-time draft evaluation components
│   ├── ActualDraftEvaluator.jsx
│   ├── SleeperAPIConnector.js
│   ├── LiveDraftDisplay.jsx
│   ├── IdealPicksPreview.jsx
│   └── PickEvaluator.jsx
├── shared/                            # Shared components and core logic
│   ├── PlayerDataProcessor.js         # ✅ IMPLEMENTED
│   ├── ProjectionEngine.js            # To be implemented
│   ├── CompetitiveAnalyzer.js         # To be implemented
│   ├── PositionValueCalculator.js     # To be implemented
│   └── ADPToggle.jsx                  # To be implemented
├── utils/                             # Utility functions
│   ├── rosterEvaluator.js             # ✅ IMPLEMENTED
│   ├── positionCalculations.js        # ✅ IMPLEMENTED
│   ├── draftSimulator.js              # To be implemented
│   └── pickGrader.js                  # To be implemented
├── examples/                          # Example components
│   └── PlayerDataExample.jsx          # ✅ IMPLEMENTED
└── __tests__/                         # Test files
    ├── PlayerDataProcessor.test.js    # ✅ IMPLEMENTED
    ├── rosterEvaluator.test.js        # ✅ IMPLEMENTED
    └── positionCalculations.test.js   # ✅ IMPLEMENTED
```

## Completed Components (Task 1)

### PlayerDataProcessor
- Loads and processes `fantasy_football_db_summary.json`
- Provides structured access to player data
- Groups players by position and team
- Calculates player tiers and statistics
- Includes comprehensive search and filtering capabilities

### Roster Evaluation Utilities
- `calculateRosterComposition()` - Analyzes current roster makeup
- `calculateRosterNeeds()` - Determines remaining position needs
- `calculatePositionUrgency()` - Evaluates urgency levels for positions
- `playerFillsNeed()` - Checks if a player addresses roster needs
- `getRosterProgress()` - Tracks roster construction progress

### Position Calculation Utilities
- `calculatePositionScarcity()` - Determines position scarcity scores
- `createValueTiers()` - Groups players into value tiers
- `calculateValueDropoff()` - Analyzes value differences between players
- `calculateReplacementValue()` - Computes value above replacement level
- `calculateOptimalDraftWindow()` - Suggests optimal draft timing

## Usage Examples

### Loading Player Data
```javascript
import { playerDataProcessor } from './shared/PlayerDataProcessor.js';

// Load data
const data = await playerDataProcessor.loadPlayerData();

// Get top players by position
const topQBs = playerDataProcessor.getTopPlayersByPosition('QB', 10);

// Find specific player
const player = playerDataProcessor.findPlayer('Josh Allen');

// Get position statistics
const qbStats = playerDataProcessor.getPositionStats('QB');
```

### Roster Analysis
```javascript
import { 
  calculateRosterComposition, 
  calculateRosterNeeds,
  calculatePositionUrgency 
} from './utils/rosterEvaluator.js';

// Analyze current roster
const roster = calculateRosterComposition(draftPicks);
const needs = calculateRosterNeeds(roster);
const urgency = calculatePositionUrgency(needs, remainingPicks);
```

### Position Analysis
```javascript
import { 
  calculatePositionScarcity,
  createValueTiers,
  calculateReplacementValue 
} from './utils/positionCalculations.js';

// Analyze position scarcity
const scarcity = calculatePositionScarcity(rbPlayers);
const tiers = createValueTiers(rbPlayers);
const replacement = calculateReplacementValue(rbPlayers, 2, 12);
```

## Testing

All implemented components include comprehensive unit tests:

```bash
npm test -- --run src/app/components/DraftProjectionSystem
```

## Data Requirements

The system expects player data in the following format from `fantasy_football_db_summary.json`:

```json
{
  "total_players": 260,
  "positions": { "QB": 40, "RB": 100, "WR": 100, "TE": 20 },
  "top_players_by_projected_points": {
    "QB": [
      {
        "name": "Josh Allen",
        "team": "BUF",
        "projected_2025_points": 347.48,
        "position_rank": 1,
        "overall_rank": 1,
        "years_exp": 7
      }
    ]
  }
}
```

## Next Steps

The following components are ready for implementation in subsequent tasks:

1. **ProjectionEngine** (Task 2.1) - Core projection algorithms
2. **CompetitiveAnalyzer** (Task 2.2) - Manager needs analysis
3. **PositionValueCalculator** (Task 2.3) - Scarcity analysis
4. **UI Components** (Tasks 3.1-3.4) - React components for display
5. **Sleeper API Integration** (Tasks 5.1-5.2) - Real-time draft data

## Requirements Addressed

This implementation addresses the following requirements:

- **Requirement 1.4**: Player data processing from fantasy_football_db_summary.json
- **Requirement 1.5**: Roster analysis and position calculations
- **Foundation for all other requirements**: Provides the data layer and utility functions needed for projection algorithms, competitive analysis, and UI components