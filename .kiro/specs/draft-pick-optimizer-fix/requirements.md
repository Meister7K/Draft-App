# Requirements Document

## Introduction

The Draft Pick Optimizer is currently showing only one player recommendation when there are clearly many strong players available in the draft. Based on the screenshot provided, players like Lamar Jackson, Josh Allen, and other high-value players are available but not being evaluated by the optimizer. This issue needs to be diagnosed and fixed to ensure all available players are properly considered for recommendations.

## Requirements

### Requirement 1

**User Story:** As a fantasy football manager, I want the optimizer to evaluate all available players during the draft, so that I don't miss out on strong players that should be recommended.

#### Acceptance Criteria

1. WHEN the optimizer runs THEN it SHALL evaluate all players that are not drafted (not in draftedPlayerIds set)
2. WHEN there are multiple strong players available THEN the system SHALL show multiple recommendations, not just one
3. WHEN debugging is enabled THEN the system SHALL log the count of available players being evaluated
4. WHEN the available players list is filtered THEN the system SHALL not exclude players that should be considered
5. WHEN the optimization engine runs THEN it SHALL process the full list of available players before ranking them

### Requirement 2

**User Story:** As a developer debugging the optimizer, I want to see diagnostic information about player filtering, so that I can identify where players are being incorrectly excluded.

#### Acceptance Criteria

1. WHEN the optimizer calculates recommendations THEN it SHALL log the number of total available players
2. WHEN players are filtered for optimization THEN the system SHALL log how many players are being evaluated
3. WHEN the optimization engine returns results THEN it SHALL log the number of recommendations generated
4. WHEN there are fewer recommendations than expected THEN the system SHALL provide diagnostic information about why
5. WHEN debugging is enabled THEN the system SHALL show the player names and positions being evaluated

### Requirement 3

**User Story:** As a fantasy football manager, I want the optimizer to properly handle the case where many players are available, so that performance doesn't degrade while still showing all relevant options.

#### Acceptance Criteria

1. WHEN there are many available players THEN the system SHALL efficiently evaluate them without performance issues
2. WHEN filtering for performance THEN the system SHALL not exclude players that have high optimization potential
3. WHEN the optimization engine processes players THEN it SHALL prioritize by optimization score, not just projected points
4. WHEN there are more than 25 strong players available THEN the system SHALL still consider all of them for optimization
5. WHEN performance optimization is needed THEN the system SHALL filter after optimization scoring, not before