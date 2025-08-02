/**
 * Draft Projection System - Main exports
 */

// Main components
export { default as DraftProjectionSystem } from './DraftProjectionSystem.jsx';

// Ideal Draft Projector components
export { default as IdealDraftProjector } from './IdealDraftProjector/IdealDraftProjector.jsx';
export { default as ManagerSelector } from './IdealDraftProjector/ManagerSelector.jsx';
export { default as ProjectedPicksDisplay } from './IdealDraftProjector/ProjectedPicksDisplay.jsx';
export { default as RosterAnalysis } from './IdealDraftProjector/RosterAnalysis.jsx';

// Actual Draft Evaluator components
export { default as ActualDraftEvaluator } from './ActualDraftEvaluator/ActualDraftEvaluator.jsx';
export { SleeperAPIConnector } from './ActualDraftEvaluator/SleeperAPIConnector.js';
export { default as LiveDraftDisplay } from './ActualDraftEvaluator/LiveDraftDisplay.jsx';
export { default as IdealPicksPreview } from './ActualDraftEvaluator/IdealPicksPreview.jsx';
export { default as PickEvaluator } from './ActualDraftEvaluator/PickEvaluator.jsx';

// Shared components and utilities
export { PlayerDataProcessor, playerDataProcessor } from './shared/PlayerDataProcessor.js';
export { ProjectionEngine } from './shared/ProjectionEngine.js';
export { CompetitiveAnalyzer } from './shared/CompetitiveAnalyzer.js';
export { PositionValueCalculator } from './shared/PositionValueCalculator.js';
export { default as ADPToggle } from './shared/ADPToggle.jsx';

// Utility functions
export * from './utils/rosterEvaluator.js';
export * from './utils/positionCalculations.js';

// Example components
export { default as PlayerDataExample } from './examples/PlayerDataExample.jsx';