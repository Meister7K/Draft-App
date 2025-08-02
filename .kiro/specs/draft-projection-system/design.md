# Design Document

## Overview

The Draft Projection System consists of two integrated components that provide comprehensive draft analysis for fantasy football managers. The Ideal Draft Projector analyzes roster construction, player values, and competitive dynamics to project optimal picks for any manager, while the Actual Draft Evaluator connects to the Sleeper API to provide real-time draft analysis and pick evaluation. The system leverages projected points data, positional scarcity analysis, and competitive modeling to deliver strategic insights throughout the draft process.

## Architecture

### Component Structure
```
DraftProjectionSystem/
├── DraftProjectionSystem.jsx (Main container component)
├── IdealDraftProjector/
│   ├── IdealDraftProjector.jsx (Main projector component)
│   ├── ManagerSelector.jsx (Manager selection dropdown)
│   ├── ProjectedPicksDisplay.jsx (Shows ideal picks by round)
│   ├── RosterAnalysis.jsx (Current roster and needs analysis)
│   └── PositionScarcityAnalysis.jsx (Position depth and value)
├── ActualDraftEvaluator/
│   ├── ActualDraftEvaluator.jsx (Main evaluator component)
│   ├── SleeperAPIConnector.js (Sleeper API integration)
│   ├── LiveDraftDisplay.jsx (Real-time draft status)
│   ├── IdealPicksPreview.jsx (Top 3 picks before selection)
│   └── PickEvaluator.jsx (Post-pick analysis and grading)
├── shared/
│   ├── ProjectionEngine.js (Core projection algorithms)
│   ├── CompetitiveAnalyzer.js (Other managers' needs analysis)
│   ├── PositionValueCalculator.js (Position scarcity and value)
│   ├── PlayerDataProcessor.js (Fantasy football DB integration)
│   └── ADPToggle.jsx (ADP data toggle component)
└── utils/
    ├── draftSimulator.js (Draft scenario simulation)
    ├── rosterEvaluator.js (Roster composition analysis)
    └── pickGrader.js (Pick quality evaluation)
```

### Data Flow Architecture
```
Fantasy Football DB → PlayerDataProcessor → ProjectionEngine
                                              ↓
Manager Selection → CompetitiveAnalyzer → IdealDraftProjector
                                              ↓
Sleeper API → SleeperAPIConnector → ActualDraftEvaluator
                                              ↓
Real-time Updates → PickEvaluator → Pick Analysis Display
```

### Integration Points
- **Data Sources**: Fantasy football database (JSON), Sleeper API, league roster formats
- **State Management**: React Context for shared draft state and manager data
- **Real-time Updates**: WebSocket or polling for live draft data
- **Responsive Design**: CSS Grid and Flexbox for mobile-first responsive layout

## Components and Interfaces

### DraftProjectionSystem (Main Container)
**Props:**
```javascript
{
  leagueId: String,              // League identifier
  userId: String,                // Current user ID
  leagueData: Object,            // League configuration and members
  rosterFormat: Object,          // League roster requirements
  draftSettings: Object          // Draft format and settings
}
```

**State:**
```javascript
{
  selectedManager: String,       // Currently selected manager for analysis
  adpEnabled: Boolean,          // Whether to include ADP in calculations
  draftData: Object,            // Current draft state and picks
  playerDatabase: Array,        // Processed player data with projections
  competitiveAnalysis: Object,  // Other managers' needs and tendencies
  activeTab: String             // "ideal" or "actual" component view
}
```

### IdealDraftProjector Component
**Core Functionality:**
```javascript
// Main projection calculation
calculateIdealDraft(manager, draftState, competitiveContext) {
  const rounds = [];
  let simulatedRoster = getCurrentRoster(manager);
  
  for (let round = 1; round <= totalRounds; round++) {
    const pickPosition = calculatePickPosition(manager, round, draftState);
    const availablePlayers = simulateAvailablePlayers(round, competitiveContext);
    const topPicks = calculateTopPicks(simulatedRoster, availablePlayers, 3);
    
    rounds.push({
      round,
      pickPosition,
      topPicks,
      reasoning: generatePickReasoning(topPicks, simulatedRoster)
    });
    
    // Simulate taking the top pick for next round calculation
    simulatedRoster = addPlayerToRoster(simulatedRoster, topPicks[0]);
  }
  
  return rounds;
}
```

**Pick Evaluation Algorithm:**
```javascript
calculatePickValue(player, roster, draftContext) {
  const factors = {
    projectedPoints: getProjectedPoints(player),
    positionalNeed: calculatePositionalNeed(player.position, roster),
    positionScarcity: calculatePositionScarcity(player.position, draftContext),
    competitionLevel: calculateCompetition(player, draftContext.managerNeeds),
    adpValue: adpEnabled ? calculateADPValue(player) : 0,
    replacementValue: calculateReplacementValue(player, draftContext.availablePlayers)
  };
  
  return weightedScore(factors, {
    projectedPoints: 0.35,
    positionalNeed: 0.25,
    positionScarcity: 0.20,
    competitionLevel: 0.10,
    adpValue: 0.05,
    replacementValue: 0.05
  });
}
```

### ActualDraftEvaluator Component
**Sleeper API Integration:**
```javascript
class SleeperAPIConnector {
  constructor(leagueId) {
    this.leagueId = leagueId;
    this.baseURL = 'https://api.sleeper.app/v1';
    this.pollInterval = 5000; // 5 second polling for live updates
  }
  
  async getDraftData() {
    const response = await fetch(`${this.baseURL}/league/${this.leagueId}/drafts`);
    const drafts = await response.json();
    const activeDraft = drafts.find(draft => draft.status === 'drafting') || drafts[0];
    
    if (activeDraft) {
      const picks = await this.getDraftPicks(activeDraft.draft_id);
      return {
        draftId: activeDraft.draft_id,
        status: activeDraft.status,
        picks,
        currentPick: picks.length + 1,
        draftOrder: activeDraft.draft_order
      };
    }
    
    return null;
  }
  
  async getDraftPicks(draftId) {
    const response = await fetch(`${this.baseURL}/draft/${draftId}/picks`);
    return await response.json();
  }
  
  startLiveUpdates(callback) {
    this.pollTimer = setInterval(async () => {
      const draftData = await this.getDraftData();
      callback(draftData);
    }, this.pollInterval);
  }
  
  stopLiveUpdates() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }
}
```

**Pick Evaluation System:**
```javascript
evaluatePick(selectedPlayer, availableAlternatives, managerRoster, draftContext) {
  const selectedValue = calculatePickValue(selectedPlayer, managerRoster, draftContext);
  const bestAlternatives = availableAlternatives
    .map(player => ({
      player,
      value: calculatePickValue(player, managerRoster, draftContext)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  
  const optimalPick = bestAlternatives[0];
  const valueDifference = optimalPick.value - selectedValue;
  
  return {
    grade: calculateGrade(valueDifference),
    selectedPlayerValue: selectedValue,
    optimalPlayerValue: optimalPick.value,
    valueDifference,
    betterAlternatives: bestAlternatives.filter(alt => alt.value > selectedValue),
    reasoning: generateEvaluationReasoning(selectedPlayer, optimalPick.player, managerRoster),
    positionalNeedMet: evaluatePositionalNeed(selectedPlayer, managerRoster)
  };
}

calculateGrade(valueDifference) {
  if (valueDifference <= 5) return 'A';
  if (valueDifference <= 15) return 'B';
  if (valueDifference <= 30) return 'C';
  if (valueDifference <= 50) return 'D';
  return 'F';
}
```

### CompetitiveAnalyzer Component
**Manager Needs Analysis:**
```javascript
analyzeManagerNeeds(managers, currentPicks, rosterFormat) {
  return managers.map(manager => {
    const currentRoster = buildCurrentRoster(manager.user_id, currentPicks);
    const needs = calculateRosterNeeds(currentRoster, rosterFormat);
    const urgency = calculatePositionUrgency(needs, manager.draftPosition);
    
    return {
      managerId: manager.user_id,
      managerName: manager.display_name,
      currentRoster,
      needs,
      urgency,
      likelyTargets: predictLikelyTargets(needs, urgency, manager.draftPosition)
    };
  });
}

predictPlayerAvailability(player, draftContext, targetPick) {
  const managersWhoNeedPosition = draftContext.managerNeeds
    .filter(manager => manager.needs[player.position] > 0)
    .filter(manager => manager.nextPick < targetPick);
  
  const competitionScore = managersWhoNeedPosition.length * player.positionRank;
  const availabilityProbability = Math.max(0, 1 - (competitionScore / 100));
  
  return {
    probability: availabilityProbability,
    competingManagers: managersWhoNeedPosition.length,
    riskLevel: availabilityProbability < 0.3 ? 'high' : 
               availabilityProbability < 0.7 ? 'medium' : 'low'
  };
}
```

### PositionValueCalculator Component
**Scarcity Analysis:**
```javascript
calculatePositionScarcity(position, playerDatabase, draftContext) {
  const positionPlayers = playerDatabase.filter(p => p.position === position);
  const tiers = createValueTiers(positionPlayers);
  const dropoffAnalysis = calculateValueDropoff(tiers);
  
  return {
    totalPlayers: positionPlayers.length,
    tiers,
    valueDropoff: dropoffAnalysis,
    scarcityScore: calculateScarcityScore(dropoffAnalysis),
    recommendedDraftWindow: calculateOptimalDraftWindow(dropoffAnalysis, draftContext)
  };
}

createValueTiers(players) {
  const sortedPlayers = players.sort((a, b) => b.projected_2025_points - a.projected_2025_points);
  const tiers = [];
  let currentTier = [];
  let lastValue = null;
  
  sortedPlayers.forEach((player, index) => {
    const valueDropoff = lastValue ? lastValue - player.projected_2025_points : 0;
    
    if (valueDropoff > 20 || currentTier.length >= 12) { // Significant dropoff or tier size limit
      if (currentTier.length > 0) {
        tiers.push([...currentTier]);
        currentTier = [];
      }
    }
    
    currentTier.push(player);
    lastValue = player.projected_2025_points;
  });
  
  if (currentTier.length > 0) {
    tiers.push(currentTier);
  }
  
  return tiers;
}
```

## Data Models

### Player Data Model
```javascript
{
  name: String,                    // Player name
  team: String,                    // NFL team
  position: String,                // QB, RB, WR, TE
  projected_2025_points: Number,   // Fantasy point projection
  position_rank: Number,           // Rank within position
  overall_rank: Number,            // Overall player rank
  years_exp: Number,               // Years of experience
  adp: Number,                     // Average draft position (if available)
  tier: Number,                    // Value tier within position
  scarcityScore: Number,           // Position scarcity metric
  competitionLevel: String         // "low", "medium", "high"
}
```

### Draft State Model
```javascript
{
  draftId: String,                 // Unique draft identifier
  status: String,                  // "pre_draft", "drafting", "complete"
  currentPick: Number,             // Current overall pick number
  totalPicks: Number,              // Total picks in draft
  draftOrder: Array,               // Manager draft order
  picks: Array,                    // Completed picks
  managers: Array,                 // Manager data and roster needs
  timeRemaining: Number,           // Pick clock time remaining
  lastUpdated: Date                // Last data refresh timestamp
}
```

### Manager Analysis Model
```javascript
{
  managerId: String,               // Manager identifier
  managerName: String,             // Display name
  draftPosition: Number,           // Draft position (1-12)
  nextPick: Number,                // Next overall pick number
  currentRoster: {
    QB: Array,                     // Current QB picks
    RB: Array,                     // Current RB picks
    WR: Array,                     // Current WR picks
    TE: Array,                     // Current TE picks
    FLEX: Array,                   // Flex eligible players
    BENCH: Array                   // Bench players
  },
  rosterNeeds: {
    QB: Number,                    // QBs still needed
    RB: Number,                    // RBs still needed
    WR: Number,                    // WRs still needed
    TE: Number,                    // TEs still needed
    FLEX: Number,                  // Flex spots still needed
    BENCH: Number                  // Bench spots still needed
  },
  urgencyLevels: {
    QB: String,                    // "low", "medium", "high", "critical"
    RB: String,
    WR: String,
    TE: String
  },
  likelyTargets: Array             // Predicted player targets
}
```

### Pick Evaluation Model
```javascript
{
  pickNumber: Number,              // Overall pick number
  round: Number,                   // Draft round
  managerId: String,               // Manager who made pick
  selectedPlayer: Object,          // Player selected
  evaluation: {
    grade: String,                 // A, B, C, D, F
    score: Number,                 // Numerical score (0-100)
    valueGained: Number,           // Value above replacement
    positionalNeedMet: Boolean,    // Whether pick addressed roster need
    reasoning: String              // Explanation of grade
  },
  alternatives: Array,             // Better available options
  contextFactors: {
    rosterNeed: String,            // How much position was needed
    positionScarcity: String,      // Position scarcity at time of pick
    competitionLevel: String,      // Competition for player/position
    timingOptimality: String       // Whether timing was optimal
  }
}
```

## Error Handling

### API Integration Errors
- **Sleeper API Failures**: Implement retry logic with exponential backoff, cache last known state
- **Rate Limiting**: Respect API rate limits, implement request queuing
- **Network Connectivity**: Provide offline mode with cached data, show connection status
- **Invalid League Data**: Validate league configuration, provide helpful error messages

### Data Processing Errors
- **Missing Player Data**: Handle players not in database, use fallback projections
- **Malformed Draft Data**: Validate draft picks and roster data, skip invalid entries
- **Calculation Errors**: Implement safe math operations, handle edge cases gracefully
- **Memory Issues**: Implement data pagination for large leagues, optimize calculations

### User Interface Errors
- **Component Failures**: Use error boundaries to prevent cascade failures
- **State Synchronization**: Implement optimistic updates with rollback capability
- **Responsive Layout**: Test across device sizes, provide fallback layouts
- **Performance Issues**: Implement loading states, debounce expensive operations

## Testing Strategy

### Unit Tests
- **Projection Algorithms**: Test pick value calculations with various roster scenarios
- **Competitive Analysis**: Test manager needs analysis with different draft states
- **Position Scarcity**: Test tier creation and value dropoff calculations
- **Pick Evaluation**: Test grading system with known good/bad picks

### Integration Tests
- **Sleeper API**: Test API integration with mock responses and error scenarios
- **Component Communication**: Test data flow between ideal projector and actual evaluator
- **Real-time Updates**: Test live draft updates and state synchronization
- **ADP Toggle**: Test projection changes when ADP is enabled/disabled

### End-to-End Tests
- **Complete Draft Simulation**: Test full draft projection and evaluation workflow
- **Manager Selection**: Test switching between different managers and their projections
- **Responsive Design**: Test component behavior across different screen sizes
- **Error Recovery**: Test graceful handling of API failures and data issues

### Performance Testing
- **Calculation Speed**: Ensure projections calculate within 1 second for 12-team leagues
- **Memory Usage**: Monitor memory consumption during long draft sessions
- **API Response Time**: Test with various network conditions and API response times
- **Large Dataset Handling**: Test with maximum league sizes and player databases

## Implementation Considerations

### Performance Optimizations
- **Memoization**: Cache expensive calculations using React.useMemo and useCallback
- **Virtual Scrolling**: Implement for large player lists and draft history
- **Debounced Updates**: Prevent excessive recalculations during rapid state changes
- **Background Processing**: Use Web Workers for complex projection calculations

### User Experience
- **Loading States**: Show calculation progress for complex projections
- **Smooth Transitions**: Animate between different managers and draft states
- **Clear Visual Hierarchy**: Distinguish between ideal projections and actual picks
- **Contextual Help**: Provide tooltips and explanations for complex metrics

### Accessibility
- **Screen Reader Support**: Provide descriptive text for all projection data
- **Keyboard Navigation**: Enable full keyboard access to all functionality
- **Color Independence**: Use patterns and text in addition to color coding
- **Focus Management**: Maintain logical focus flow through complex interfaces

### Mobile Responsiveness
- **Touch-Friendly Interface**: Optimize for touch interactions on mobile devices
- **Compact Data Display**: Efficiently present complex data on small screens
- **Swipe Navigation**: Enable swipe gestures for switching between managers
- **Offline Capability**: Cache essential data for offline draft analysis