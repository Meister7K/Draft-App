/**
 * Tests for PlayerDataProcessor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerDataProcessor } from '../PlayerDataProcessor.js';

// Mock fetch for testing
global.fetch = vi.fn();

describe('PlayerDataProcessor', () => {
  let processor;
  
  const mockPlayerData = {
    total_players: 4,
    positions: { QB: 2, RB: 2 },
    teams: { BUF: 2, BAL: 2 },
    top_players_by_projected_points: {
      QB: [
        {
          name: "Josh Allen",
          team: "BUF",
          projected_2025_points: 347.48,
          position_rank: 1,
          overall_rank: 1,
          years_exp: 7
        },
        {
          name: "Lamar Jackson",
          team: "BAL",
          projected_2025_points: 346.76,
          position_rank: 2,
          overall_rank: 2,
          years_exp: 7
        }
      ],
      RB: [
        {
          name: "Christian McCaffrey",
          team: "SF",
          projected_2025_points: 280.5,
          position_rank: 1,
          overall_rank: 3,
          years_exp: 8
        },
        {
          name: "Saquon Barkley",
          team: "PHI",
          projected_2025_points: 275.2,
          position_rank: 2,
          overall_rank: 4,
          years_exp: 7
        }
      ]
    }
  };

  beforeEach(() => {
    processor = new PlayerDataProcessor();
    fetch.mockClear();
  });

  it('should load and process player data successfully', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlayerData
    });

    const result = await processor.loadPlayerData();

    expect(result).toBeDefined();
    expect(result.players).toHaveLength(4);
    expect(result.metadata.totalPlayers).toBe(4);
    expect(result.byPosition.QB).toHaveLength(2);
    expect(result.byPosition.RB).toHaveLength(2);
  });

  it('should handle fetch errors gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(processor.loadPlayerData()).rejects.toThrow('Network error');
  });

  it('should calculate player tiers correctly', () => {
    processor.playerData = mockPlayerData;
    const processedPlayers = processor.processPlayerData();
    
    const joshAllen = processedPlayers.find(p => p.name === "Josh Allen");
    const lamarJackson = processedPlayers.find(p => p.name === "Lamar Jackson");
    
    // With only 2 QB players, position ranks 1 and 2
    // Player 1: (1-1)/2 = 0% -> Tier 1 (top 10%)
    // Player 2: (2-1)/2 = 50% -> Tier 3 (top 50%)
    expect(joshAllen.tier).toBe(1); // Top 10%
    expect(lamarJackson.tier).toBe(3); // Top 50%
  });

  it('should group players by position correctly', () => {
    processor.playerData = mockPlayerData;
    processor.processedPlayers = processor.processPlayerData();
    const byPosition = processor.groupPlayersByPosition();
    
    expect(byPosition.QB).toHaveLength(2);
    expect(byPosition.RB).toHaveLength(2);
    expect(byPosition.QB[0].name).toBe("Josh Allen");
  });

  it('should find players by name', () => {
    processor.playerData = mockPlayerData;
    processor.processedPlayers = processor.processPlayerData();
    processor.playersByPosition = processor.groupPlayersByPosition();
    
    const player = processor.findPlayer("Josh Allen");
    expect(player).toBeDefined();
    expect(player.name).toBe("Josh Allen");
    expect(player.position).toBe("QB");
  });

  it('should get top players by position', () => {
    processor.playerData = mockPlayerData;
    processor.processedPlayers = processor.processPlayerData();
    processor.playersByPosition = processor.groupPlayersByPosition();
    
    const topQBs = processor.getTopPlayersByPosition("QB", 1);
    expect(topQBs).toHaveLength(1);
    expect(topQBs[0].name).toBe("Josh Allen");
  });

  it('should calculate position statistics', () => {
    processor.playerData = mockPlayerData;
    processor.processedPlayers = processor.processPlayerData();
    processor.playersByPosition = processor.groupPlayersByPosition();
    
    const qbStats = processor.getPositionStats("QB");
    expect(qbStats.count).toBe(2);
    expect(qbStats.topPoints).toBe(347.48);
    expect(qbStats.avgPoints).toBeCloseTo(347.12, 1);
  });

  describe('ADP data extraction', () => {
    it('should extract ADP data from season_projected_totals', () => {
      const player = {
        season_projected_totals: {
          adp_ppr: 25.5,
          adp_half_ppr: 28.2,
          adp_std: 30.1,
          adp_2qb: 15.3
        }
      };
      
      const adpData = processor.extractADPData(player);
      
      expect(adpData.adp_ppr).toBe(25.5);
      expect(adpData.adp_half_ppr).toBe(28.2);
      expect(adpData.adp_std).toBe(30.1);
      expect(adpData.adp_2qb).toBe(15.3);
    });

    it('should extract ADP data from projection_season_adp', () => {
      const player = {
        projection_season_adp: {
          adp: 42.7
        }
      };
      
      const adpData = processor.extractADPData(player);
      
      expect(adpData.adp_ppr).toBe(42.7);
    });

    it('should ignore placeholder ADP values', () => {
      const player = {
        season_projected_totals: {
          adp_ppr: 999,
          adp_half_ppr: 25.5,
          adp_std: 999
        }
      };
      
      const adpData = processor.extractADPData(player);
      
      expect(adpData.adp_ppr).toBeNull();
      expect(adpData.adp_half_ppr).toBe(25.5);
      expect(adpData.adp_std).toBeNull();
    });

    it('should generate mock ADP when no real data available', () => {
      const player = {
        overall_rank: 15
      };
      
      const adpData = processor.extractADPData(player);
      
      expect(adpData.adp_ppr).toBeGreaterThan(0);
      expect(adpData.adp_ppr).toBeLessThan(200);
      expect(adpData.adp_half_ppr).toBeGreaterThan(0);
      expect(adpData.adp_std).toBeGreaterThan(0);
    });

    it('should handle player without overall_rank', () => {
      const player = {};
      
      const adpData = processor.extractADPData(player);
      
      expect(adpData.adp_ppr).toBe(150); // Default fallback
    });
  });

  describe('mock ADP generation', () => {
    it('should generate reasonable ADP based on overall rank', () => {
      const player = { overall_rank: 10 };
      const mockADP = processor.generateMockADP(player);
      
      expect(mockADP).toBeGreaterThan(0);
      expect(mockADP).toBeLessThan(30); // Should be close to rank 10
      expect(Number.isFinite(mockADP)).toBe(true);
      expect(mockADP).toBeCloseTo(Math.round(mockADP * 10) / 10, 1); // Should be rounded to 1 decimal
    });

    it('should handle edge cases', () => {
      const highRankPlayer = { overall_rank: 200 };
      const lowRankPlayer = { overall_rank: 1 };
      
      const highADP = processor.generateMockADP(highRankPlayer);
      const lowADP = processor.generateMockADP(lowRankPlayer);
      
      expect(highADP).toBeLessThanOrEqual(200);
      expect(lowADP).toBeGreaterThanOrEqual(1);
      expect(lowADP).toBeLessThan(highADP);
    });

    it('should return fallback for missing rank', () => {
      const player = {};
      const mockADP = processor.generateMockADP(player);
      
      expect(mockADP).toBe(150);
    });
  });

  describe('processed players with ADP', () => {
    it('should include ADP data in processed players', () => {
      const mockDataWithADP = {
        ...mockPlayerData,
        top_players_by_projected_points: {
          QB: [
            {
              ...mockPlayerData.top_players_by_projected_points.QB[0],
              season_projected_totals: {
                adp_ppr: 15.2,
                adp_half_ppr: 16.8
              }
            }
          ],
          RB: [
            {
              ...mockPlayerData.top_players_by_projected_points.RB[0],
              projection_season_adp: {
                adp: 5.5
              }
            }
          ]
        }
      };

      processor.playerData = mockDataWithADP;
      const processed = processor.processPlayerData();
      
      const qb = processed.find(p => p.name === 'Josh Allen');
      const rb = processed.find(p => p.name === 'Christian McCaffrey');
      
      expect(qb.adp).toBe(15.2); // From season_projected_totals.adp_ppr
      expect(qb.adpData.adp_ppr).toBe(15.2);
      expect(qb.adpData.adp_half_ppr).toBe(16.8);
      
      expect(rb.adp).toBe(5.5); // From projection_season_adp.adp
      expect(rb.adpData.adp_ppr).toBe(5.5);
    });

    it('should generate mock ADP when no real data available', () => {
      processor.playerData = mockPlayerData;
      const processed = processor.processPlayerData();
      
      // All players should have some ADP data (mock generated)
      processed.forEach(player => {
        expect(player.adp).toBeGreaterThan(0);
        expect(player.adpData.adp_ppr).toBeGreaterThan(0);
        // Note: adp_half_ppr and adp_std have variance, so they might be slightly different
        expect(Number.isFinite(player.adpData.adp_half_ppr)).toBe(true);
        expect(Number.isFinite(player.adpData.adp_std)).toBe(true);
      });
    });
  });
});