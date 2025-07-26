import { describe, it, expect } from 'vitest';
import {
  analyzeLeagueNeeds,
  calculatePositionDemand,
  predictManagerTargeting,
  calculatePositionUrgencyScores,
  calculateEnhancedCompetitionScore
} from '../CompetitionAnalyzer.js';

// Mock data
const mockLeagueUsers = [
  { user_id: 'manager1', name: 'Manager 1' },
  { user_id: 'manager2', name: 'Manager 2' },
  { user_id: 'manager3', name: 'Manager 3' },
  { user_id: 'manager4', name: 'Manager 4' }
];

const mockRosterFormat = [
  { position: 'QB', slots: 1 },
  { position: 'RB', slots: 2 },
  { position: 'WR', slots: 2 },
  { position: 'TE', slots: 1 },
  { position: 'FLEX', slots: 1 }
];

const mockDraftPicks = [
  { picked_by: 'manager1', metadata: { position: 'QB' }, pick_no: 1 },
  { picked_by: 'manager1', metadata: { position: 'RB' }, pick_no: 5 },
  { picked_by: 'manager2', metadata: { position: 'WR' }, pick_no: 2 },
  { picked_by: 'manager2', metadata: { position: 'RB' }, pick_no: 6 },
  { picked_by: 'manager3', metadata: { position: 'TE' }, pick_no: 3 },
  { picked_by: 'manager3', metadata: { position: 'WR' }, pick_no: 7 },
  { picked_by: 'manager4', metadata: { position: 'RB' }, pick_no: 4 },
  { picked_by: 'manager4', metadata: { position: 'QB' }, pick_no: 8 }
];

const mockDraftOrder = [
  { user_id: 'manager1' },
  { user_id: 'manager2' },
  { user_id: 'manager3' },
  { user_id: 'manager4' }
];

const mockPlayer = {
  player_info: {
    player_id: 'test-player-1',
    name: 'Test Player',
    position: 'RB',
    team: 'TEST',
    overall_rank: 25,
    position_rank: 8,
    projected_2025_points: 250
  }
};

describe('CompetitionAnalyzer', () => {
  describe('analyzeLeagueNeeds', () => {
    it('should analyze league-wide roster needs correctly', () => {
      const result = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      
      expect(result).toHaveProperty('managerNeeds');
      expect(result).toHaveProperty('positionDemand');
      expect(result).toHaveProperty('totalManagers');
      expect(result.totalManagers).toBe(4);
      
      // Check manager needs structure
      expect(result.managerNeeds).toHaveProperty('manager1');
      expect(result.managerNeeds.manager1).toHaveProperty('QB');
      expect(result.managerNeeds.manager1).toHaveProperty('RB');
      expect(result.managerNeeds.manager1).toHaveProperty('WR');
      expect(result.managerNeeds.manager1).toHaveProperty('TE');
      expect(result.managerNeeds.manager1).toHaveProperty('FLEX');
      
      // Verify manager1's needs (has QB and RB)
      expect(result.managerNeeds.manager1.QB.needed).toBe(0); // Has 1, needs 1
      expect(result.managerNeeds.manager1.RB.needed).toBe(1); // Has 1, needs 2
      expect(result.managerNeeds.manager1.WR.needed).toBe(2); // Has 0, needs 2
      expect(result.managerNeeds.manager1.TE.needed).toBe(1); // Has 0, needs 1
      expect(result.managerNeeds.manager1.FLEX.needed).toBe(1); // Has 0, needs 1
    });

    it('should calculate position demand correctly', () => {
      const result = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      
      expect(result.positionDemand).toHaveProperty('QB');
      expect(result.positionDemand).toHaveProperty('RB');
      expect(result.positionDemand).toHaveProperty('WR');
      expect(result.positionDemand).toHaveProperty('TE');
      expect(result.positionDemand).toHaveProperty('FLEX');
      
      // Check QB demand (2 managers have QB, 2 still need)
      expect(result.positionDemand.QB.totalSlotsNeeded).toBe(4); // 4 managers * 1 slot each
      expect(result.positionDemand.QB.slotsFilled).toBe(2); // 2 QBs drafted
      expect(result.positionDemand.QB.managersStillNeed).toBe(2); // 2 managers need QB
      
      // Check RB demand (3 managers have RB, 1 still needs)
      expect(result.positionDemand.RB.totalSlotsNeeded).toBe(8); // 4 managers * 2 slots each
      expect(result.positionDemand.RB.slotsFilled).toBe(3); // 3 RBs drafted
      expect(result.positionDemand.RB.managersStillNeed).toBe(4); // All managers still need more RBs
    });

    it('should determine competition levels correctly', () => {
      const result = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      
      // TE should have high competition (3 of 4 managers need TE = 75%)
      expect(result.positionDemand.TE.competitionLevel).toBe('very_high');
      expect(result.positionDemand.TE.competitionScore).toBeGreaterThan(80);
      
      // QB should have medium competition (2 of 4 managers need QB = 50%)
      expect(result.positionDemand.QB.competitionLevel).toBe('high');
      expect(result.positionDemand.QB.competitionScore).toBeGreaterThan(60);
    });

    it('should calculate urgency levels correctly', () => {
      const result = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      
      // Manager2 needs QB (0/1 = 100% needed = high urgency)
      expect(result.managerNeeds.manager2.QB.urgency).toBe('high');
      
      // Manager1 needs 1 more RB (1/2 = 50% needed = high urgency)
      expect(result.managerNeeds.manager1.RB.urgency).toBe('high');
      
      // Manager1 has filled QB requirement (1/1 = 0% needed = none)
      expect(result.managerNeeds.manager1.QB.urgency).toBe('none');
    });

    it('should handle missing data gracefully', () => {
      const result = analyzeLeagueNeeds(null, null, null);
      
      expect(result).toHaveProperty('error');
      expect(result.managerNeeds).toEqual({});
      expect(result.positionDemand).toEqual({});
      expect(result.totalManagers).toBe(0);
    });

    it('should set likelyToTarget flag correctly', () => {
      const result = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      
      // Manager2 needs QB and should be likely to target it
      expect(result.managerNeeds.manager2.QB.likelyToTarget).toBe(true);
      
      // Manager1 has filled QB and should not be likely to target it
      expect(result.managerNeeds.manager1.QB.likelyToTarget).toBe(false);
      
      // FLEX with only 1 slot needed might not be likely to target
      // (depends on implementation - FLEX needs >= 2 to be likely target)
      expect(result.managerNeeds.manager1.FLEX.likelyToTarget).toBe(false);
    });
  });

  describe('calculatePositionDemand', () => {
    it('should return position demand analysis', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const result = calculatePositionDemand(leagueAnalysis, 'RB');
      
      expect(result).toHaveProperty('competitionScore');
      expect(result).toHaveProperty('competitionLevel');
      expect(result).toHaveProperty('managersNeed');
      expect(result).toHaveProperty('slotsRemaining');
      expect(result).toHaveProperty('explanation');
      
      expect(result.competitionScore).toBeGreaterThan(0);
      expect(result.managersNeed).toBe(4); // All managers need more RBs
      expect(result.explanation).toContain('managers need RB');
    });

    it('should handle missing position data', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const result = calculatePositionDemand(leagueAnalysis, 'K'); // Kicker not in format
      
      expect(result.competitionScore).toBe(50);
      expect(result.competitionLevel).toBe('medium');
      expect(result.explanation).toContain('missing data');
    });

    it('should generate appropriate explanations for different competition levels', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      
      const teResult = calculatePositionDemand(leagueAnalysis, 'TE');
      expect(teResult.explanation).toContain('extremely high competition');
      
      const qbResult = calculatePositionDemand(leagueAnalysis, 'QB');
      expect(qbResult.explanation).toContain('high competition');
    });
  });

  describe('predictManagerTargeting', () => {
    it('should predict manager targeting for next few picks', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const result = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      
      expect(result).toHaveProperty('nextFewPicks');
      expect(result).toHaveProperty('positionTargeting');
      expect(result).toHaveProperty('analysisRange');
      
      expect(result.nextFewPicks).toHaveLength(4);
      expect(result.analysisRange.startPick).toBe(9);
      expect(result.analysisRange.endPick).toBe(12);
      
      // Check structure of pick predictions
      result.nextFewPicks.forEach(pick => {
        expect(pick).toHaveProperty('pickNumber');
        expect(pick).toHaveProperty('managerId');
        expect(pick).toHaveProperty('urgentNeeds');
        expect(pick).toHaveProperty('moderateNeeds');
        expect(pick).toHaveProperty('primaryTarget');
        expect(pick).toHaveProperty('likelyTargets');
      });
    });

    it('should identify urgent needs correctly', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const result = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      
      // Find manager2's next pick (should need QB urgently)
      const manager2Pick = result.nextFewPicks.find(pick => pick.managerId === 'manager2');
      expect(manager2Pick).toBeDefined();
      expect(manager2Pick.urgentNeeds).toContain('QB');
    });

    it('should track position targeting frequency', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const result = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      
      expect(result.positionTargeting).toHaveProperty('QB');
      expect(result.positionTargeting.QB).toHaveProperty('managersLikelyToTarget');
      expect(result.positionTargeting.QB).toHaveProperty('pickNumbers');
      expect(result.positionTargeting.QB).toHaveProperty('urgencyLevel');
      
      expect(result.positionTargeting.QB.managersLikelyToTarget).toBeGreaterThan(0);
    });

    it('should handle missing data gracefully', () => {
      const result = predictManagerTargeting(null, null, 8, 4);
      
      expect(result).toHaveProperty('error');
      expect(result.nextFewPicks).toEqual([]);
      expect(result.positionTargeting).toEqual({});
    });

    it('should prioritize urgent needs over moderate needs', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const result = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      
      // Find a manager with both urgent and moderate needs
      const pickWithBothNeeds = result.nextFewPicks.find(pick => 
        pick.urgentNeeds.length > 0 && pick.moderateNeeds.length > 0
      );
      
      if (pickWithBothNeeds) {
        expect(pickWithBothNeeds.primaryTarget).not.toBeNull();
        expect(pickWithBothNeeds.urgentNeeds).toContain(pickWithBothNeeds.primaryTarget);
      }
    });
  });

  describe('calculatePositionUrgencyScores', () => {
    it('should calculate urgency scores for all positions', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const targetingPrediction = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      const result = calculatePositionUrgencyScores(leagueAnalysis, targetingPrediction);
      
      expect(result).toHaveProperty('urgencyScores');
      expect(result).toHaveProperty('analysisTimestamp');
      
      expect(result.urgencyScores).toHaveProperty('QB');
      expect(result.urgencyScores).toHaveProperty('RB');
      expect(result.urgencyScores).toHaveProperty('WR');
      expect(result.urgencyScores).toHaveProperty('TE');
      expect(result.urgencyScores).toHaveProperty('FLEX');
      
      // Check structure of urgency scores
      Object.values(result.urgencyScores).forEach(score => {
        expect(score).toHaveProperty('score');
        expect(score).toHaveProperty('competitionLevel');
        expect(score).toHaveProperty('managersNeed');
        expect(score).toHaveProperty('managersTargeting');
        expect(score).toHaveProperty('urgencyLevel');
        expect(score).toHaveProperty('explanation');
        
        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.score).toBeLessThanOrEqual(100);
      });
    });

    it('should apply correct base urgency for competition levels', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const targetingPrediction = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      const result = calculatePositionUrgencyScores(leagueAnalysis, targetingPrediction);
      
      // TE should have higher or equal urgency to QB due to higher competition
      // Both may hit the 100 cap, so we check that TE is at least as high
      expect(result.urgencyScores.TE.score).toBeGreaterThanOrEqual(result.urgencyScores.QB.score);
      
      // Verify that high competition positions have high scores
      expect(result.urgencyScores.TE.score).toBeGreaterThan(70);
      expect(result.urgencyScores.QB.score).toBeGreaterThan(50);
    });

    it('should adjust for targeting pressure', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const targetingPrediction = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      const result = calculatePositionUrgencyScores(leagueAnalysis, targetingPrediction);
      
      // Positions with managers likely to target should have higher scores
      Object.keys(result.urgencyScores).forEach(position => {
        const score = result.urgencyScores[position];
        if (score.managersTargeting > 0) {
          expect(score.explanation).toContain('likely to target');
        }
      });
    });

    it('should handle missing data gracefully', () => {
      const result = calculatePositionUrgencyScores(null, null);
      
      expect(result).toHaveProperty('error');
      expect(result.urgencyScores).toEqual({});
    });

    it('should generate comprehensive explanations', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const targetingPrediction = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      const result = calculatePositionUrgencyScores(leagueAnalysis, targetingPrediction);
      
      Object.values(result.urgencyScores).forEach(score => {
        expect(score.explanation).toContain('competition');
        expect(score.explanation).toContain('managers need');
      });
    });
  });

  describe('calculateEnhancedCompetitionScore', () => {
    it('should use enhanced analysis when available', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const targetingPrediction = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      const urgencyScores = calculatePositionUrgencyScores(leagueAnalysis, targetingPrediction);
      
      const context = {
        leagueAnalysis,
        targetingPrediction,
        urgencyScores
      };
      
      const result = calculateEnhancedCompetitionScore(mockPlayer, context);
      
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('explanation');
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.explanation).not.toContain('basic analysis');
    });

    it('should fallback to basic analysis when enhanced data unavailable', () => {
      const context = {}; // No enhanced data
      const result = calculateEnhancedCompetitionScore(mockPlayer, context);
      
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('explanation');
      expect(result.explanation).toContain('basic analysis');
    });

    it('should handle missing position data in enhanced analysis', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const targetingPrediction = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      const urgencyScores = calculatePositionUrgencyScores(leagueAnalysis, targetingPrediction);
      
      const context = {
        leagueAnalysis,
        targetingPrediction,
        urgencyScores
      };
      
      const kickerPlayer = {
        player_info: { ...mockPlayer.player_info, position: 'K' }
      };
      
      const result = calculateEnhancedCompetitionScore(kickerPlayer, context);
      
      expect(result.score).toBe(50);
      expect(result.explanation).toContain('insufficient data');
    });

    it('should return urgency-based scores for valid positions', () => {
      const leagueAnalysis = analyzeLeagueNeeds(mockLeagueUsers, mockDraftPicks, mockRosterFormat);
      const targetingPrediction = predictManagerTargeting(leagueAnalysis, mockDraftOrder, 8, 4);
      const urgencyScores = calculatePositionUrgencyScores(leagueAnalysis, targetingPrediction);
      
      const context = {
        leagueAnalysis,
        targetingPrediction,
        urgencyScores
      };
      
      const result = calculateEnhancedCompetitionScore(mockPlayer, context);
      
      // Score should match the urgency score for RB position
      const expectedScore = urgencyScores.urgencyScores.RB.score;
      expect(result.score).toBe(expectedScore);
      expect(result.explanation).toBe(urgencyScores.urgencyScores.RB.explanation);
    });
  });
});