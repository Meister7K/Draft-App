/**
 * Tests for roster evaluation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRosterComposition,
  calculateRosterNeeds,
  calculatePositionUrgency,
  playerFillsNeed,
  STANDARD_ROSTER_FORMAT
} from '../rosterEvaluator.js';

describe('rosterEvaluator', () => {
  const mockPicks = [
    { player: { name: "Josh Allen", position: "QB", projected_2025_points: 347.48 } },
    { player: { name: "Christian McCaffrey", position: "RB", projected_2025_points: 280.5 } },
    { player: { name: "Tyreek Hill", position: "WR", projected_2025_points: 250.3 } }
  ];

  describe('calculateRosterComposition', () => {
    it('should calculate roster composition correctly', () => {
      const roster = calculateRosterComposition(mockPicks);
      
      expect(roster.QB).toHaveLength(1);
      expect(roster.RB).toHaveLength(1);
      expect(roster.WR).toHaveLength(1);
      expect(roster.TE).toHaveLength(0);
      expect(roster.totalPicks).toBe(3);
    });

    it('should handle empty picks array', () => {
      const roster = calculateRosterComposition([]);
      
      expect(roster.QB).toHaveLength(0);
      expect(roster.totalPicks).toBe(0);
    });
  });

  describe('calculateRosterNeeds', () => {
    it('should calculate remaining needs correctly', () => {
      const roster = calculateRosterComposition(mockPicks);
      const needs = calculateRosterNeeds(roster);
      
      expect(needs.QB).toBe(0); // Already have 1, need 1
      expect(needs.RB).toBe(1); // Have 1, need 2
      expect(needs.WR).toBe(1); // Have 1, need 2
      expect(needs.TE).toBe(1); // Have 0, need 1
      expect(needs.FLEX).toBe(1); // Have 0, need 1
    });
  });

  describe('calculatePositionUrgency', () => {
    it('should calculate urgency levels correctly', () => {
      const needs = { QB: 0, RB: 2, WR: 1, TE: 1, FLEX: 1, BENCH: 5 };
      const urgency = calculatePositionUrgency(needs, 10);
      
      expect(urgency.QB).toBe('none');
      expect(urgency.RB).toBe('low'); // 2/10 = 0.2
      expect(urgency.WR).toBe('low'); // 1/10 = 0.1
    });

    it('should handle critical urgency', () => {
      const needs = { QB: 1, RB: 0, WR: 0, TE: 0, FLEX: 0, BENCH: 0 };
      const urgency = calculatePositionUrgency(needs, 1);
      
      expect(urgency.QB).toBe('critical'); // 1/1 = 1.0
    });
  });

  describe('playerFillsNeed', () => {
    it('should identify when player fills direct position need', () => {
      const player = { name: "Travis Kelce", position: "TE" };
      const needs = { QB: 0, RB: 0, WR: 0, TE: 1, FLEX: 0, BENCH: 0 };
      
      expect(playerFillsNeed(player, needs)).toBe(true);
    });

    it('should identify when player fills flex need', () => {
      const player = { name: "Christian McCaffrey", position: "RB" };
      const needs = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 1, BENCH: 0 };
      
      expect(playerFillsNeed(player, needs)).toBe(true);
    });

    it('should identify when player fills bench need', () => {
      const player = { name: "Josh Allen", position: "QB" };
      const needs = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, BENCH: 1 };
      
      expect(playerFillsNeed(player, needs)).toBe(true);
    });

    it('should return false when player fills no need', () => {
      const player = { name: "Josh Allen", position: "QB" };
      const needs = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, BENCH: 0 };
      
      expect(playerFillsNeed(player, needs)).toBe(false);
    });
  });
});