# Perfect Draft Simulator

A comprehensive fantasy football draft simulator that evaluates total roster projected points and makes optimal picks based on multiple factors.

## Features

### Core Functionality
- **Perfect Draft Execution**: Automatically executes a complete draft with optimal picks for each manager
- **Total Roster Evaluation**: Evaluates picks based on total projected points for the entire roster
- **Position Need Analysis**: Considers current roster position availability and needs
- **ADP Integration**: Factors in player ADP (Average Draft Position) for value assessment
- **Position Scarcity**: Analyzes position scarcity based on total league needs
- **Value Dropoff Analysis**: Identifies significant value dropoffs between player tiers

### Evaluation Factors

The PerfectDraftEngine evaluates each potential pick based on:

1. **Player Projected Points** (40% weight)
   - Base scoring from projected fantasy points
   - Normalized to 0-100 scale

2. **Position Need Bonus** (20% weight)
   - Higher bonus for more urgent position needs
   - Considers FLEX eligibility for RB/WR/TE

3. **ADP Value Bonus** (15% weight)
   - Bonus for drafting players below their ADP
   - Penalty for reaching above ADP

4. **Position Scarcity Bonus** (10% weight)
   - Higher bonus for scarcer positions
   - Based on remaining available players

5. **Value Dropoff Bonus** (10% weight)
   - Bonus for picks before significant value dropoffs
   - Prevents missing out on tier breaks

6. **Roster Balance Bonus** (5% weight)
   - Bonus for filling starting positions
   - Encourages balanced roster construction

### Components

#### PerfectDraft.jsx
Main component that orchestrates the entire draft simulation.

**Props:**
- `playerData`: Player database with projections and ADP
- `draftData`: Draft configuration and settings
- `leagueData`: League roster format and settings
- `leagueUsers`: Array of managers/teams

#### PerfectDraftEngine.js
Core logic engine that calculates optimal picks.

**Key Methods:**
- `getOptimalPick()`: Returns the best player for a given pick
- `calculatePlayerScore()`: Scores players based on multiple factors
- `getEligiblePlayers()`: Filters available players by roster needs
- `calculatePositionScarcity()`: Analyzes position scarcity across league

#### RosterDisplay.jsx
Displays each manager's roster with projected points and position needs.

**Features:**
- Roster rankings by projected points
- Position need visualization
- Detailed roster breakdown
- Interactive roster selection

#### DraftBoard.jsx
Shows the complete draft board with all picks.

**Features:**
- Round-by-round pick display
- Position filtering
- Pick scoring visualization
- Detailed pick analysis

#### AnalyticsPanel.jsx
Comprehensive analytics dashboard.

**Tabs:**
- **Overview**: Total points, averages, rankings
- **Position Scarcity**: Scarcity analysis by position
- **Value Dropoffs**: Tier break analysis
- **Optimal Picks**: High-scoring picks (score > 80)

## Usage

```jsx
import { PerfectDraft } from './components/PerfectDraft';

function App() {
  return (
    <PerfectDraft 
      playerData={playerData}
      draftData={draftData}
      leagueData={leagueData}
      leagueUsers={leagueUsers}
    />
  );
}
```

## Data Requirements

### Player Data Structure
```javascript
{
  players: [
    {
      player_info: {
        player_id: "string",
        name: "string",
        position: "QB|RB|WR|TE",
        projected_2025_points: number,
        adp_2qb: number,
        overall_rank: number,
        position_rank: number
      }
    }
  ]
}
```

### Draft Data Structure
```javascript
{
  season: "2025",
  draft_order: [
    {
      managerId: "string",
      managerName: "string",
      draftPosition: number
    }
  ],
  picks: [] // Will be populated during simulation
}
```

### League Data Structure
```javascript
{
  roster_positions: {
    QB: number,
    RB: number,
    WR: number,
    TE: number,
    FLEX: number,
    BN: number // Bench
  }
}
```

## Algorithm Details

### Scoring Formula
```
Score = (ProjectedPoints / 400) * 40 + 
        PositionNeedBonus + 
        ADPValueBonus + 
        ScarcityBonus + 
        DropoffBonus + 
        BalanceBonus
```

### Position Need Calculation
- QB: 2 slots (no FLEX eligibility)
- RB: 2 slots + 2 FLEX slots
- WR: 2 slots + 2 FLEX slots  
- TE: 1 slot + 2 FLEX slots
- FLEX: RB/WR/TE eligible
- BENCH: All positions

### Scarcity Analysis
- Very Scarce (< 10%): +10 points
- Scarce (< 20%): +7 points
- Moderately Scarce (< 30%): +5 points
- Plentiful (≥ 30%): +2 points

### Value Dropoff Thresholds
- Major Dropoff (> 50 pts): +10 points
- Significant Dropoff (> 30 pts): +7 points
- Moderate Dropoff (> 15 pts): +5 points
- Minor Dropoff (≤ 15 pts): +2 points

## Performance Features

- **Efficient Player Filtering**: Only evaluates eligible players
- **Cached Calculations**: Position scarcity calculated once per round
- **Optimized Sorting**: Efficient algorithms for large player pools
- **Responsive Design**: Works on desktop and mobile devices

## Future Enhancements

- **Custom Scoring Systems**: Support for different league scoring formats
- **Trade Analysis**: Evaluate potential trades during draft
- **Dynasty Considerations**: Long-term value for dynasty leagues
- **Injury Risk**: Factor in player injury history and risk
- **Bye Week Optimization**: Consider bye week conflicts
- **Advanced Analytics**: Machine learning for improved predictions

## Technical Notes

- Built with React hooks for state management
- CSS modules for scoped styling
- Responsive design with CSS Grid and Flexbox
- Optimized for performance with large datasets
- TypeScript ready (can be converted easily) 