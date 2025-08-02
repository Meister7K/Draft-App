/**
 * Tests for position calculation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePositionScarcity,
  createValueTiers,
  calculateTierAverage,
  calculateValueDropoff,
  calculateReplacementValue
} from '../positionCalculations.js';

describe('positionCalculations', () => {
  const mockPlayers = [
    { name: "Player 1", projected_2025_points: 300 },
    { name: "Player 2", projected_2025_points: 280 },
    { name: "Player 3", projected_2025_points: 275 },
    { name: "Player 4", projected_2025_points: 250 },
    { name: "Player 5", projected_2025_points: 200 }
  ];

  describe('createValueTiers', () => {
    it('should create tiers based on value dropoff', () => {
      const tiers = createValueTiers(mockPlayers);
      
      expect(tiers.length).toBeGreaterThan(0);
      expect(tiers[0]).toContain(mockPlayers[0]); // Top player in first tier
    });

    it('should handle empty player array', () => {
      const tiers = createValueTiers([]);
      expect(tiers).toEqual([]);
    });
  });

  describe('calculateTierAverage', () => {
    it('should calculate correct average for tier', () => {
      const tier = [mockPlayers[0], mockPlayers[1]]; // 300, 280
      const average = calculateTierAverage(tier);
      
      expect(average).toBe(290);
    });

    it('should return 0 for empty tier', () => {
      const average = calculateTierAverage([]);
      expect(average).toBe(0);
    });
  });

  describe('calculateValueDropoff', () => {
    it('should calculate dropoff between consecutive players', () => {
      const dropoffs = calculateValueDropoff(mockPlayers.slice(0, 3));
      
      expect(dropoffs).toHaveLength(2);
      expect(dropoffs[0].pointsDropoff).toBe(20); // 300 - 280
      expect(dropoffs[1].pointsDropoff).toBe(5); // 280 - 275
    });

    it('should handle single player array', () => {
      const dropoffs = calculateValueDropoff([mockPlayers[0]]);
      expect(dropoffs).toEqual([]);
    });
  });

  describe('calculatePositionScarcity', () => {
    it('should calculate scarcity score', () => {
      const scarcity = calculatePositionScarcity(mockPlayers);
      
      expect(scarcity).toBeGreaterThanOrEqual(0);
      expect(scarcity).toBeLessThanOrEqual(100);
    });

    it('should return 100 for empty position', () => {
      const scarcity = calculatePositionScarcity([]);
      expect(scarcity).toBe(100);
    });

    it('should account for already drafted players', () => {
      const scarcityWithDrafted = calculatePositionScarcity(mockPlayers, 2);
      const scarcityWithoutDrafted = calculatePositionScarcity(mockPlayers, 0);
      
      expect(scarcityWithDrafted).toBeGreaterThanOrEqual(scarcityWithoutDrafted);
    });
  });

  describe('calculateReplacementValue', () => {
    it('should calculate replacement value correctly', () => {
      const replacement = calculateReplacementValue(mockPlayers, 1, 5); // 1 starter per team, 5 teams
      
      expect(replacement.replacementIndex).toBe(5);
      expect(replacement.replacementValue).toBe(200); // 5th player (index 4)
      expect(replacement.valueAboveReplacement).toHaveLength(5);
    });

    it('should handle empty player array', () => {
      const replacement = calculateReplacementValue([], 1, 12);
      
      expect(replacement.replacementIndex).toBe(0);
      expect(replacement.replacementValue).toBe(0);
      expect(replacement.valueAboveReplacement).toEqual([]);
    });
  });
});