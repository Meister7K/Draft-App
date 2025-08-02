/**
 * Tests for PositionValueCalculator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PositionValueCalculator } from '../PositionValueCalculator.js';

describe('PositionValueCalculator', () => {
  let calculator;
  let mockPlayerDatabase;
  let mockDraftContext;

  beforeEach(() => {
    calculator = new PositionValueCalculator();

    // Mock player database with different positions and projected points
    mockPlayerDatabase = [
      // QBs with clear tier breaks
      { name: 'Josh Allen', position: 'QB', projected_2025_points: 347.48, position_rank: 1, id: 'qb1' },
      { name: 'Lamar Jackson', position: 'QB', projected_2025_points: 346.76, position_rank: 2, id: 'qb2' },
      { name: 'Jayden Daniels', position: 'QB', projected_2025_points: 342.54, position_rank: 3, id: 'qb3' },
      { name: 'Jalen Hurts', position: 'QB', projected_2025_points: 336.06, position_rank: 4, id: 'qb4' },
      { name: 'Joe Burrow', position: 'QB', projected_2025_points: 320.12, position_rank: 5, id: 'qb5' }, // Tier break
      { name: 'Dak Prescott', position: 'QB', projected_2025_points: 310.45, position_rank: 6, id: 'qb6' },
      
      // RBs with gradual dropoff
      { name: 'Christian McCaffrey', position: 'RB', projected_2025_points: 280.5, position_rank: 1, id: 'rb1' },
      { name: 'Saquon Barkley', position: 'RB', projected_2025_points: 275.2, position_rank: 2, id: 'rb2' },
      { name: 'Derrick Henry', position: 'RB', projected_2025_points: 270.8, position_rank: 3, id: 'rb3' },
      { name: 'Josh Jacobs', position: 'RB', projected_2025_points: 265.1, position_rank: 4, id: 'rb4' },
      { name: 'Alvin Kamara', position: 'RB', projected_2025_points: 240.3, position_rank: 5, id: 'rb5' }, // Tier break
      { name: 'Aaron Jones', position: 'RB', projected_2025_points: 235.7, position_rank: 6, id: 'rb6' },
      
      // WRs with multiple tiers
      { name: 'Cooper Kupp', position: 'WR', projected_2025_points: 250.2, position_rank: 1, id: 'wr1' },
      { name: 'Tyreek Hill', position: 'WR', projected_2025_points: 248.9, position_rank: 2, id: 'wr2' },
      { name: 'Davante Adams', position: 'WR', projected_2025_points: 245.1, position_rank: 3, id: 'wr3' },
      { name: 'Stefon Diggs', position: 'WR', projected_2025_points: 220.4, position_rank: 4, id: 'wr4' }, // Tier break
      { name: 'DeAndre Hopkins', position: 'WR', projected_2025_points: 215.8, position_rank: 5, id: 'wr5' },
      
      // TEs with steep dropoff
      { name: 'Travis Kelce', position: 'TE', projected_2025_points: 180.5, position_rank: 1, id: 'te1' },
      { name: 'Mark Andrews', position: 'TE', projected_2025_points: 160.2, position_rank: 2, id: 'te2' }, // Big dropoff
      { name: 'George Kittle', position: 'TE', projected_2025_points: 145.8, position_rank: 3, id: 'te3' },
      { name: 'Darren Waller', position: 'TE', projected_2025_points: 140.1, position_rank: 4, id: 'te4' }
    ];

    mockDraftContext = {
      currentPick: 10,
      totalSlots: 12,
      currentPicks: [
        { player_id: 'qb1', metadata: { first_name: 'Josh', last_name: 'Allen' } },
        { player_id: 'rb1', metadata: { first_name: 'Christian', last_name: 'McCaffrey' } }
      ],
      managerNeeds: [
        { needs: { QB: 1, RB: 2, WR: 2, TE: 1 } },
        { needs: { QB: 1, RB: 1, WR: 2, TE: 1 } },
        { needs: { QB: 0, RB: 2, WR: 2, TE: 1 } }
      ]
    };
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(calculator.tierSizeLimits).toBeDefined();
      expect(calculator.dropoffThresholds).toBeDefined();
      expect(calculator.positionDepth).toBeDefined();
      
      expect(calculator.tierSizeLimits.QB).toBe(8);
      expect(calculator.tierSizeLimits.RB).toBe(12);
      expect(calculator.dropoffThresholds.QB).toBe(15);
      expect(calculator.positionDepth.QB).toBe(24);
    });
  });

  describe('calculatePositionScarcity', () => {
    it('should calculate scarcity for all positions', () => {
      const scarcity = calculator.calculatePositionScarcity(mockPlayerDatabase, mockDraftContext);
      
      expect(scarcity).toHaveProperty('QB');
      expect(scarcity).toHaveProperty('RB');
      expect(scarcity).toHaveProperty('WR');
      expect(scarcity).toHaveProperty('TE');
      
      expect(scarcity.QB).toHaveProperty('position');
      expect(scarcity.QB).toHaveProperty('totalPlayers');
      expect(scarcity.QB).toHaveProperty('tiers');
      expect(scarcity.QB).toHaveProperty('scarcityScore');
    });

    it('should throw error for invalid player database', () => {
      expect(() => {
        calculator.calculatePositionScarcity(null);
      }).toThrow('Player database is required');

      expect(() => {
        calculator.calculatePositionScarcity('not an array');
      }).toThrow('Player database is required');
    });

    it('should handle empty player database', () => {
      const scarcity = calculator.calculatePositionScarcity([]);
      
      Object.values(scarcity).forEach(positionScarcity => {
        expect(positionScarcity.totalPlayers).toBe(0);
        expect(positionScarcity.tiers).toHaveLength(0);
      });
    });
  });

  describe('analyzePositionScarcity', () => {
    it('should analyze QB scarcity correctly', () => {
      const qbPlayers = mockPlayerDatabase.filter(p => p.position === 'QB');
      const analysis = calculator.analyzePositionScarcity('QB', qbPlayers, mockDraftContext);
      
      expect(analysis.position).toBe('QB');
      expect(analysis.totalPlayers).toBe(6); // All QBs available (filtering happens in getAvailablePlayers)
      expect(analysis.tiers).toBeDefined();
      expect(analysis.scarcityScore).toBeGreaterThanOrEqual(0);
      expect(analysis.scarcityScore).toBeLessThanOrEqual(100);
      expect(analysis.competitionLevel).toBeDefined();
    });

    it('should handle position with no players', () => {
      const analysis = calculator.analyzePositionScarcity('QB', [], mockDraftContext);
      
      expect(analysis.totalPlayers).toBe(0);
      expect(analysis.tiers).toHaveLength(0);
      expect(analysis.scarcityScore).toBe(50); // Default medium scarcity
    });
  });

  describe('createValueTiers', () => {
    it('should create tiers for QB with clear breaks', () => {
      const qbPlayers = mockPlayerDatabase.filter(p => p.position === 'QB');
      const tiers = calculator.createValueTiers(qbPlayers, 'QB');
      
      expect(tiers.length).toBeGreaterThan(0);
      expect(tiers[0]).toHaveProperty('tierNumber');
      expect(tiers[0]).toHaveProperty('players');
      expect(tiers[0]).toHaveProperty('averagePoints');
      expect(tiers[0]).toHaveProperty('topPlayer');
      expect(tiers[0]).toHaveProperty('bottomPlayer');
      
      // First tier should have highest projected points
      expect(tiers[0].topPlayer.projected_2025_points).toBeGreaterThanOrEqual(
        tiers[tiers.length - 1].topPlayer.projected_2025_points
      );
    });

    it('should handle empty player array', () => {
      const tiers = calculator.createValueTiers([], 'QB');
      expect(tiers).toHaveLength(0);
    });

    it('should respect tier size limits', () => {
      // Create many players with similar values to test size limits
      const manyPlayers = Array.from({ length: 20 }, (_, i) => ({
        name: `Player ${i}`,
        position: 'RB',
        projected_2025_points: 200 - i, // Gradual decline
        id: `rb${i}`
      }));
      
      const tiers = calculator.createValueTiers(manyPlayers, 'RB');
      
      // Should create multiple tiers due to size limits
      expect(tiers.length).toBeGreaterThan(1);
      
      // No tier should exceed the size limit significantly
      tiers.forEach(tier => {
        expect(tier.tierSize).toBeLessThanOrEqual(calculator.tierSizeLimits.RB + 2); // Allow some flexibility
      });
    });

    it('should create tier breaks on significant value dropoffs', () => {
      const playersWithDropoff = [
        { name: 'Elite 1', position: 'WR', projected_2025_points: 300, id: 'wr1' },
        { name: 'Elite 2', position: 'WR', projected_2025_points: 295, id: 'wr2' },
        { name: 'Good 1', position: 'WR', projected_2025_points: 250, id: 'wr3' }, // 45 point dropoff
        { name: 'Good 2', position: 'WR', projected_2025_points: 245, id: 'wr4' }
      ];
      
      const tiers = calculator.createValueTiers(playersWithDropoff, 'WR');
      
      // Should create at least 2 tiers due to the significant dropoff
      expect(tiers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('calculateValueDropoff', () => {
    it('should calculate dropoff analysis correctly', () => {
      const qbPlayers = mockPlayerDatabase.filter(p => p.position === 'QB');
      const tiers = calculator.createValueTiers(qbPlayers, 'QB');
      const dropoff = calculator.calculateValueDropoff(tiers);
      
      expect(dropoff).toHaveProperty('totalDropoff');
      expect(dropoff).toHaveProperty('averageDropoff');
      expect(dropoff).toHaveProperty('maxDropoff');
      expect(dropoff).toHaveProperty('dropoffByTier');
      expect(dropoff).toHaveProperty('steepestDropoff');
      
      expect(dropoff.totalDropoff).toBeGreaterThanOrEqual(0);
      expect(dropoff.averageDropoff).toBeGreaterThanOrEqual(0);
      expect(dropoff.dropoffByTier).toBeInstanceOf(Array);
    });

    it('should handle empty tiers', () => {
      const dropoff = calculator.calculateValueDropoff([]);
      
      expect(dropoff.totalDropoff).toBe(0);
      expect(dropoff.averageDropoff).toBe(0);
      expect(dropoff.maxDropoff).toBe(0);
      expect(dropoff.dropoffByTier).toHaveLength(0);
      expect(dropoff.steepestDropoff).toBeNull();
    });

    it('should handle single tier', () => {
      const singleTier = [{
        tierNumber: 1,
        averagePoints: 300,
        players: [{ name: 'Player 1', projected_2025_points: 300 }]
      }];
      
      const dropoff = calculator.calculateValueDropoff(singleTier);
      
      expect(dropoff.totalDropoff).toBe(0);
      expect(dropoff.averageDropoff).toBe(0);
      expect(dropoff.dropoffByTier).toHaveLength(0);
    });

    it('should identify steepest dropoff correctly', () => {
      const tiersWithSteepDropoff = [
        { tierNumber: 1, averagePoints: 300, players: [] },
        { tierNumber: 2, averagePoints: 280, players: [] }, // 20 point dropoff
        { tierNumber: 3, averagePoints: 230, players: [] }  // 50 point dropoff (steepest)
      ];
      
      const dropoff = calculator.calculateValueDropoff(tiersWithSteepDropoff);
      
      expect(dropoff.steepestDropoff).toBeDefined();
      expect(dropoff.steepestDropoff.dropoff).toBe(50);
      expect(dropoff.steepestDropoff.fromTier).toBe(2);
      expect(dropoff.steepestDropoff.toTier).toBe(3);
    });
  });

  describe('calculateScarcityScore', () => {
    it('should calculate scarcity score within valid range', () => {
      const dropoffAnalysis = {
        averageDropoff: 25,
        maxDropoff: 40,
        dropoffByTier: [
          { dropoff: 20 },
          { dropoff: 30 }
        ]
      };
      
      const score = calculator.calculateScarcityScore(dropoffAnalysis, 'RB');
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return medium scarcity for no dropoff data', () => {
      const emptyDropoff = {
        averageDropoff: 0,
        maxDropoff: 0,
        dropoffByTier: []
      };
      
      const score = calculator.calculateScarcityScore(emptyDropoff, 'QB');
      expect(score).toBe(50);
    });

    it('should adjust score based on position', () => {
      const dropoffAnalysis = {
        averageDropoff: 20,
        maxDropoff: 30,
        dropoffByTier: [{ dropoff: 20 }, { dropoff: 30 }]
      };
      
      const qbScore = calculator.calculateScarcityScore(dropoffAnalysis, 'QB');
      const rbScore = calculator.calculateScarcityScore(dropoffAnalysis, 'RB');
      
      // QB should have higher scarcity for same dropoff due to different normalization
      expect(qbScore).toBeGreaterThan(rbScore);
    });

    it('should add bonus for steep dropoffs', () => {
      const normalDropoff = {
        averageDropoff: 20,
        maxDropoff: 25,
        dropoffByTier: [{ dropoff: 20 }]
      };
      
      const steepDropoff = {
        averageDropoff: 20,
        maxDropoff: 50, // Much steeper max dropoff
        dropoffByTier: [{ dropoff: 20 }]
      };
      
      const normalScore = calculator.calculateScarcityScore(normalDropoff, 'RB');
      const steepScore = calculator.calculateScarcityScore(steepDropoff, 'RB');
      
      expect(steepScore).toBeGreaterThan(normalScore);
    });
  });

  describe('calculateOptimalDraftWindow', () => {
    it('should calculate draft windows correctly', () => {
      const dropoffAnalysis = {
        steepestDropoff: {
          fromTier: 2,
          toTier: 3,
          dropoff: 40
        }
      };
      
      const window = calculator.calculateOptimalDraftWindow(dropoffAnalysis, 'RB', mockDraftContext);
      
      expect(window).toHaveProperty('earlyWindow');
      expect(window).toHaveProperty('optimalWindow');
      expect(window).toHaveProperty('lateWindow');
      expect(window).toHaveProperty('recommendation');
      
      expect(window.earlyWindow.start).toBeLessThan(window.earlyWindow.end);
      expect(window.optimalWindow.start).toBeLessThan(window.optimalWindow.end);
      expect(window.lateWindow.start).toBeLessThan(window.lateWindow.end);
    });

    it('should handle no clear dropoff', () => {
      const dropoffAnalysis = { steepestDropoff: null };
      
      const window = calculator.calculateOptimalDraftWindow(dropoffAnalysis, 'RB');
      
      expect(window.recommendation).toContain('No clear optimal window');
    });

    it('should provide context-aware recommendations', () => {
      const dropoffAnalysis = {
        steepestDropoff: { fromTier: 1, toTier: 2, dropoff: 30 }
      };
      
      const earlyContext = { ...mockDraftContext, currentPick: 5 };
      const lateContext = { ...mockDraftContext, currentPick: 50 };
      
      const earlyWindow = calculator.calculateOptimalDraftWindow(dropoffAnalysis, 'RB', earlyContext);
      const lateWindow = calculator.calculateOptimalDraftWindow(dropoffAnalysis, 'RB', lateContext);
      
      expect(earlyWindow.recommendation).not.toBe(lateWindow.recommendation);
    });
  });

  describe('analyzePositionDepth', () => {
    it('should analyze depth correctly', () => {
      const rbPlayers = mockPlayerDatabase.filter(p => p.position === 'RB');
      const depth = calculator.analyzePositionDepth(rbPlayers, 'RB');
      
      expect(depth).toHaveProperty('availableCount');
      expect(depth).toHaveProperty('expectedDrafted');
      expect(depth).toHaveProperty('depthRatio');
      expect(depth).toHaveProperty('depthLevel');
      expect(depth).toHaveProperty('surplus');
      expect(depth).toHaveProperty('shortage');
      
      expect(depth.availableCount).toBe(rbPlayers.length);
      expect(depth.expectedDrafted).toBe(calculator.positionDepth.RB);
      expect(['deep', 'adequate', 'shallow', 'very shallow']).toContain(depth.depthLevel);
    });

    it('should calculate depth levels correctly', () => {
      // Test deep position
      const manyPlayers = Array.from({ length: 90 }, (_, i) => ({ position: 'RB' }));
      const deepDepth = calculator.analyzePositionDepth(manyPlayers, 'RB');
      expect(deepDepth.depthLevel).toBe('deep');
      
      // Test shallow position (30/60 = 0.5 ratio, which is < 0.7 so "very shallow")
      const fewPlayers = Array.from({ length: 30 }, (_, i) => ({ position: 'RB' }));
      const shallowDepth = calculator.analyzePositionDepth(fewPlayers, 'RB');
      expect(shallowDepth.depthLevel).toBe('very shallow');
    });
  });

  describe('calculatePositionCompetition', () => {
    it('should calculate competition levels correctly', () => {
      const competition = calculator.calculatePositionCompetition('QB', mockDraftContext);
      
      expect(['very high', 'high', 'medium', 'low', 'very low', 'unknown']).toContain(competition);
    });

    it('should handle empty manager needs', () => {
      const emptyContext = { managerNeeds: [] };
      const competition = calculator.calculatePositionCompetition('QB', emptyContext);
      
      expect(competition).toBe('unknown');
    });

    it('should calculate competition percentages correctly', () => {
      const highCompetitionContext = {
        managerNeeds: [
          { needs: { QB: 1 } },
          { needs: { QB: 1 } },
          { needs: { QB: 1 } },
          { needs: { QB: 1 } }
        ]
      };
      
      const lowCompetitionContext = {
        managerNeeds: [
          { needs: { QB: 1 } },
          { needs: { QB: 0 } },
          { needs: { QB: 0 } },
          { needs: { QB: 0 } }
        ]
      };
      
      const highCompetition = calculator.calculatePositionCompetition('QB', highCompetitionContext);
      const lowCompetition = calculator.calculatePositionCompetition('QB', lowCompetitionContext);
      
      expect(['very high', 'high']).toContain(highCompetition);
      expect(['low', 'very low']).toContain(lowCompetition);
    });
  });

  describe('getAvailablePlayers', () => {
    it('should filter out drafted players correctly', () => {
      const qbPlayers = mockPlayerDatabase.filter(p => p.position === 'QB');
      const available = calculator.getAvailablePlayers(qbPlayers, mockDraftContext);
      
      // Should have one less QB (Josh Allen was drafted)
      expect(available.length).toBe(qbPlayers.length - 1);
      expect(available.find(p => p.name === 'Josh Allen')).toBeUndefined();
    });

    it('should handle empty draft context', () => {
      const qbPlayers = mockPlayerDatabase.filter(p => p.position === 'QB');
      const available = calculator.getAvailablePlayers(qbPlayers, {});
      
      // Should return all players if no draft context
      expect(available.length).toBe(qbPlayers.length);
    });

    it('should handle players identified by name', () => {
      const contextWithNames = {
        currentPicks: [
          { metadata: { first_name: 'Josh', last_name: 'Allen' } }
        ]
      };
      
      const qbPlayers = mockPlayerDatabase.filter(p => p.position === 'QB');
      const available = calculator.getAvailablePlayers(qbPlayers, contextWithNames);
      
      expect(available.find(p => p.name === 'Josh Allen')).toBeUndefined();
    });
  });

  describe('getPlayerTier', () => {
    it('should find player tier correctly', () => {
      const joshAllen = mockPlayerDatabase.find(p => p.name === 'Josh Allen');
      const tierInfo = calculator.getPlayerTier(joshAllen, 'QB', mockPlayerDatabase);
      
      expect(tierInfo).toBeDefined();
      expect(tierInfo.tierNumber).toBeDefined();
      expect(tierInfo.tierRank).toBeDefined();
      expect(tierInfo.tierSize).toBeDefined();
      expect(tierInfo.isTopOfTier).toBeDefined();
      expect(tierInfo.isBottomOfTier).toBeDefined();
    });

    it('should return null for player not found', () => {
      const fakePlayer = { name: 'Fake Player', id: 'fake' };
      const tierInfo = calculator.getPlayerTier(fakePlayer, 'QB', mockPlayerDatabase);
      
      expect(tierInfo).toBeNull();
    });
  });

  describe('comparePositionScarcity', () => {
    it('should compare two positions correctly', () => {
      const comparison = calculator.comparePositionScarcity('QB', 'RB', mockPlayerDatabase, mockDraftContext);
      
      expect(comparison).toHaveProperty('position1');
      expect(comparison).toHaveProperty('position2');
      expect(comparison).toHaveProperty('moreScarcePosiiton');
      expect(comparison).toHaveProperty('scarcityDifference');
      expect(comparison).toHaveProperty('recommendation');
      
      expect(comparison.position1.position).toBe('QB');
      expect(comparison.position2.position).toBe('RB');
      expect(['QB', 'RB']).toContain(comparison.moreScarcePosiiton);
    });

    it('should generate appropriate recommendations', () => {
      const comparison = calculator.comparePositionScarcity('QB', 'RB', mockPlayerDatabase, mockDraftContext);
      
      expect(comparison.recommendation).toBeDefined();
      expect(typeof comparison.recommendation).toBe('string');
      expect(comparison.recommendation.length).toBeGreaterThan(0);
    });
  });

  describe('utility methods', () => {
    it('should calculate tier average correctly', () => {
      const tierPlayers = [
        { projected_2025_points: 300 },
        { projected_2025_points: 280 },
        { projected_2025_points: 260 }
      ];
      
      const average = calculator.calculateTierAverage(tierPlayers);
      expect(average).toBeCloseTo(280, 1);
    });

    it('should handle empty tier for average calculation', () => {
      const average = calculator.calculateTierAverage([]);
      expect(average).toBe(0);
    });

    it('should update position depth', () => {
      const newDepth = { QB: 30, RB: 70 };
      calculator.updatePositionDepth(newDepth);
      
      expect(calculator.positionDepth.QB).toBe(30);
      expect(calculator.positionDepth.RB).toBe(70);
      expect(calculator.positionDepth.WR).toBe(60); // Should preserve other values
    });

    it('should update tier configuration', () => {
      const newConfig = {
        tierSizeLimits: { QB: 10 },
        dropoffThresholds: { RB: 25 }
      };
      
      calculator.updateTierConfiguration(newConfig);
      
      expect(calculator.tierSizeLimits.QB).toBe(10);
      expect(calculator.dropoffThresholds.RB).toBe(25);
      expect(calculator.tierSizeLimits.RB).toBe(12); // Should preserve other values
    });
  });
});