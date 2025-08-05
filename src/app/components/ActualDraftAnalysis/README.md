# Actual Draft Analysis Component

This component analyzes real draft picks from Sleeper leagues and evaluates the quality of each pick decision.

## Features

### 🎯 Pick-by-Pick Analysis
- Evaluates each draft pick against available alternatives
- Calculates opportunity cost for suboptimal picks
- Provides detailed reasoning for pick grades
- Shows better options that were available at pick time

### 📊 Manager Performance Grading
- Grades each manager's draft performance (0-100 scale)
- Identifies best and worst picks for each manager
- Analyzes position-specific drafting tendencies
- Ranks managers by overall draft quality

### 📈 Position & Round Analysis
- Breaks down draft performance by position
- Analyzes round-by-round draft quality
- Shows position distribution and timing
- Identifies draft trends and patterns

### 🔍 Advanced Metrics
- **Pick Value**: Calculated based on projected points, ADP, and position scarcity
- **Opportunity Cost**: Measures value lost by not selecting better available options
- **Grade Distribution**: Shows overall draft quality across all picks
- **Position Scarcity**: Factors in supply/demand for each position

## Components

### ActualDraftAnalysis.jsx
Main container component that:
- Loads available drafts for a league
- Fetches draft picks from Sleeper API
- Integrates with player database
- Manages analysis state and UI

### ActualDraftEngine.js
Core analysis engine that:
- Simulates draft state at each pick
- Evaluates pick quality using multiple factors
- Calculates grades and opportunity costs
- Generates detailed pick reasoning

### ActualDraftAnalyticsPanel.jsx
Results display component with tabs for:
- **Overview**: Key stats and manager rankings
- **Pick Analysis**: Individual pick breakdowns with filtering
- **Position Analysis**: Performance by position
- **Round Analysis**: Round-by-round breakdown

### ActualDraftBoard.jsx
Visual draft board component that displays:
- **Round-by-Round Layout**: Shows picks organized by draft rounds
- **Interactive Pick Cards**: Click to expand detailed analysis
- **Filtering Options**: Filter by position and manager
- **Visual Grading**: Color-coded grades and position indicators
- **Position Breakdown**: Summary stats for each position
- **Better Options Display**: Shows missed opportunities for each pick

## Grading Algorithm

The pick grading system (0-100) considers:

1. **Base Player Value** (0-40 points)
   - Projected fantasy points
   - Position scarcity multiplier
   - Round context adjustments

2. **Opportunity Cost Penalty** (0-30 points deducted)
   - Number of better alternatives available
   - Value difference from best alternative

3. **ADP Accuracy Bonus/Penalty** (±10 points)
   - Bonus for picking near consensus ADP
   - Penalty for reaching too early/late

4. **Context Adjustments** (±5 points)
   - Position scarcity considerations
   - Round-specific expectations
   - Late-round value bonuses

## Usage

```jsx
import { ActualDraftAnalysis } from './components/ActualDraftAnalysis';

<ActualDraftAnalysis
  league={selectedLeague}
  user={userData}
  leagueUsers={leagueUsers}
  data={playerDatabase}
  onBack={handleBack}
/>
```

## Data Requirements

- **Sleeper League Data**: League info and settings
- **Draft Picks**: Complete draft pick data from Sleeper API
- **Player Database**: Fantasy football player projections and ADP
- **League Users**: Manager information for display names

## Key Differences from PerfectDraft

While PerfectDraft simulates optimal picks, ActualDraftAnalysis:
- Uses real draft picks from completed drafts
- Evaluates actual decision quality vs. optimal choices
- Provides historical performance analysis
- Focuses on learning from past draft decisions

## Performance Considerations

- Caches expensive calculations during analysis
- Processes picks sequentially to maintain draft state
- Uses memoization for repeated calculations
- Optimized for analyzing 15+ round drafts with 12+ teams

## Future Enhancements

- Multi-season draft analysis
- Manager comparison tools
- Draft strategy recommendations
- Integration with league scoring settings
- Export functionality for analysis results