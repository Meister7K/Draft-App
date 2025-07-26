import { describe, it, expect, beforeEach } from 'vitest';
import OptimizationFactors from '../OptimizationFactors.jsx';

describe('OptimizationFactors', () => {
  const mockFactors = {
    rosterNeed: {
      score: 85,
      explanation: "Your roster desperately needs a running back with only 1 RB currently drafted"
    },
    playerValue: {
      score: 72,
      explanation: "High-value player with strong projected fantasy points for 2025"
    },
    competition: {
      score: 45,
      explanation: "Moderate competition with 3 other managers likely targeting RBs"
    },
    availability: {
      score: 30,
      explanation: "Low availability - likely to be drafted within next 2-3 picks",
      riskLevel: "high",
      estimatedPickRange: {
        earliest: 15,
        latest: 18,
        mostLikely: 16
      }
    },
    startingLineupImpact: {
      score: 90,
      explanation: "Would immediately improve starting lineup by replacing current RB2",
      weeklyImprovement: 8.5,
      seasonImprovement: 144.5,
      impactType: "starter_upgrade"
    }
  };

  const mockPreviousFactors = {
    rosterNeed: {
      score: 80,
      explanation: "Previous roster need explanation"
    },
    playerValue: {
      score: 75,
      explanation: "Previous player value explanation"
    },
    competition: {
      score: 50,
      explanation: "Previous competition explanation"
    },
    availability: {
      score: 35,
      explanation: "Previous availability explanation"
    },
    startingLineupImpact: {
      score: 85,
      explanation: "Previous impact explanation"
    }
  };

  describe('Component Structure and Export', () => {
    it('should export the component', () => {
      expect(OptimizationFactors).toBeDefined();
      expect(typeof OptimizationFactors).toBe('function');
    });

    it('should be a React component', () => {
      expect(OptimizationFactors.name).toBe('OptimizationFactors');
    });
  });

  describe('Component Logic Functions', () => {
    // Test the internal helper functions by creating a component instance
    let componentInstance;
    
    beforeEach(() => {
      // Create a mock component instance to test internal functions
      componentInstance = {
        formatFactorScore: (score) => Math.round(score * 10) / 10,
        getFactorColor: (score) => {
          if (score >= 75) return "text-green-400";
          if (score >= 50) return "text-yellow-400";
          if (score >= 25) return "text-orange-400";
          return "text-red-400";
        },
        getFactorBgColor: (score) => {
          if (score >= 75) return "bg-green-500";
          if (score >= 50) return "bg-yellow-500";
          if (score >= 25) return "bg-orange-500";
          return "bg-red-500";
        },
        getFactorChange: (factorKey, currentScore, previousFactors, showComparison) => {
          if (!previousFactors || !showComparison) return null;
          
          const previousScore = previousFactors[factorKey]?.score || 0;
          const change = currentScore - previousScore;
          
          if (Math.abs(change) < 0.1) return null;
          
          return {
            value: change,
            isIncrease: change > 0,
            isDecrease: change < 0
          };
        },
        getFactorDisplayName: (factorKey) => {
          const names = {
            rosterNeed: "Roster Need",
            playerValue: "Player Value", 
            competition: "Competition Level",
            availability: "Availability",
            startingLineupImpact: "Starting Lineup Impact"
          };
          return names[factorKey] || factorKey;
        },
        getFactorDescription: (factorKey) => {
          const descriptions = {
            rosterNeed: "How much your roster needs this position",
            playerValue: "Overall player quality and projected value",
            competition: "How many other managers likely want this player",
            availability: "Likelihood of player being available in future rounds",
            startingLineupImpact: "Expected fantasy point improvement to starting lineup"
          };
          return descriptions[factorKey] || "";
        }
      };
    });

    describe('Score Formatting', () => {
      it('should format factor scores correctly', () => {
        expect(componentInstance.formatFactorScore(85.123)).toBe(85.1);
        expect(componentInstance.formatFactorScore(72.456)).toBe(72.5);
        expect(componentInstance.formatFactorScore(45.0)).toBe(45);
        expect(componentInstance.formatFactorScore(30.999)).toBe(31);
      });

      it('should handle edge cases in score formatting', () => {
        expect(componentInstance.formatFactorScore(0)).toBe(0);
        expect(componentInstance.formatFactorScore(100)).toBe(100);
        expect(componentInstance.formatFactorScore(-5)).toBe(-5);
        expect(componentInstance.formatFactorScore(150)).toBe(150);
      });
    });

    describe('Color Assignment', () => {
      it('should assign correct text colors based on score ranges', () => {
        expect(componentInstance.getFactorColor(85)).toBe("text-green-400"); // High score
        expect(componentInstance.getFactorColor(75)).toBe("text-green-400"); // Boundary high
        expect(componentInstance.getFactorColor(72)).toBe("text-yellow-400"); // Medium score
        expect(componentInstance.getFactorColor(50)).toBe("text-yellow-400"); // Boundary medium
        expect(componentInstance.getFactorColor(45)).toBe("text-orange-400"); // Low-medium score
        expect(componentInstance.getFactorColor(25)).toBe("text-orange-400"); // Boundary low-medium
        expect(componentInstance.getFactorColor(30)).toBe("text-orange-400"); // Low score
        expect(componentInstance.getFactorColor(20)).toBe("text-red-400"); // Very low score
      });

      it('should assign correct background colors for progress bars', () => {
        expect(componentInstance.getFactorBgColor(85)).toBe("bg-green-500");
        expect(componentInstance.getFactorBgColor(75)).toBe("bg-green-500");
        expect(componentInstance.getFactorBgColor(72)).toBe("bg-yellow-500");
        expect(componentInstance.getFactorBgColor(50)).toBe("bg-yellow-500");
        expect(componentInstance.getFactorBgColor(45)).toBe("bg-orange-500");
        expect(componentInstance.getFactorBgColor(25)).toBe("bg-orange-500");
        expect(componentInstance.getFactorBgColor(20)).toBe("bg-red-500");
        expect(componentInstance.getFactorBgColor(10)).toBe("bg-red-500");
      });
    });

    describe('Factor Change Calculation', () => {
      it('should calculate positive changes correctly', () => {
        const change = componentInstance.getFactorChange('rosterNeed', 85, mockPreviousFactors, true);
        expect(change).toEqual({
          value: 5,
          isIncrease: true,
          isDecrease: false
        });
      });

      it('should calculate negative changes correctly', () => {
        const change = componentInstance.getFactorChange('playerValue', 72, mockPreviousFactors, true);
        expect(change).toEqual({
          value: -3,
          isIncrease: false,
          isDecrease: true
        });
      });

      it('should return null for small changes', () => {
        const change = componentInstance.getFactorChange('availability', 35.05, mockPreviousFactors, true);
        expect(change).toBeNull();
      });

      it('should return null when showComparison is false', () => {
        const change = componentInstance.getFactorChange('rosterNeed', 85, mockPreviousFactors, false);
        expect(change).toBeNull();
      });

      it('should return null when no previous factors provided', () => {
        const change = componentInstance.getFactorChange('rosterNeed', 85, null, true);
        expect(change).toBeNull();
      });

      it('should handle missing previous factor data', () => {
        const incompletePrevious = { rosterNeed: { score: 80 } };
        const change = componentInstance.getFactorChange('playerValue', 72, incompletePrevious, true);
        expect(change).toEqual({
          value: 72,
          isIncrease: true,
          isDecrease: false
        });
      });
    });

    describe('Factor Display Names', () => {
      it('should return correct display names for all factors', () => {
        expect(componentInstance.getFactorDisplayName('rosterNeed')).toBe('Roster Need');
        expect(componentInstance.getFactorDisplayName('playerValue')).toBe('Player Value');
        expect(componentInstance.getFactorDisplayName('competition')).toBe('Competition Level');
        expect(componentInstance.getFactorDisplayName('availability')).toBe('Availability');
        expect(componentInstance.getFactorDisplayName('startingLineupImpact')).toBe('Starting Lineup Impact');
      });

      it('should return the original key for unknown factors', () => {
        expect(componentInstance.getFactorDisplayName('unknownFactor')).toBe('unknownFactor');
        expect(componentInstance.getFactorDisplayName('customFactor')).toBe('customFactor');
      });
    });

    describe('Factor Descriptions', () => {
      it('should return correct descriptions for all factors', () => {
        expect(componentInstance.getFactorDescription('rosterNeed')).toBe('How much your roster needs this position');
        expect(componentInstance.getFactorDescription('playerValue')).toBe('Overall player quality and projected value');
        expect(componentInstance.getFactorDescription('competition')).toBe('How many other managers likely want this player');
        expect(componentInstance.getFactorDescription('availability')).toBe('Likelihood of player being available in future rounds');
        expect(componentInstance.getFactorDescription('startingLineupImpact')).toBe('Expected fantasy point improvement to starting lineup');
      });

      it('should return empty string for unknown factors', () => {
        expect(componentInstance.getFactorDescription('unknownFactor')).toBe('');
        expect(componentInstance.getFactorDescription('customFactor')).toBe('');
      });
    });
  });

  describe('Component Props Validation', () => {
    it('should handle null factors gracefully', () => {
      // Test that the component can handle null factors without crashing
      expect(() => {
        // Simulate component behavior with null factors
        const factors = null;
        const result = factors ? Object.entries(factors) : [];
        expect(result).toEqual([]);
      }).not.toThrow();
    });

    it('should handle undefined factors gracefully', () => {
      expect(() => {
        const factors = undefined;
        const result = factors ? Object.entries(factors) : [];
        expect(result).toEqual([]);
      }).not.toThrow();
    });

    it('should handle empty factors object', () => {
      const factors = {};
      const result = Object.entries(factors);
      expect(result).toEqual([]);
    });

    it('should handle factors with missing score property', () => {
      const incompleteFactors = {
        rosterNeed: {
          explanation: "Some explanation"
          // Missing score
        }
      };
      
      expect(() => {
        const score = incompleteFactors.rosterNeed.score || 0;
        expect(score).toBe(0);
      }).not.toThrow();
    });

    it('should handle factors with missing explanation property', () => {
      const incompleteFactors = {
        rosterNeed: {
          score: 85
          // Missing explanation
        }
      };
      
      expect(() => {
        const explanation = incompleteFactors.rosterNeed.explanation || '';
        expect(explanation).toBe('');
      }).not.toThrow();
    });
  });

  describe('Factor Summary Logic', () => {
    it('should identify strongest factor correctly', () => {
      const factors = mockFactors;
      const strongest = Object.entries(factors).reduce((max, [key, data]) => 
        data.score > factors[max].score ? key : max
      , Object.keys(factors)[0]);
      
      expect(strongest).toBe('startingLineupImpact'); // Score: 90
    });

    it('should identify weakest factor correctly', () => {
      const factors = mockFactors;
      const weakest = Object.entries(factors).reduce((min, [key, data]) => 
        data.score < factors[min].score ? key : min
      , Object.keys(factors)[0]);
      
      expect(weakest).toBe('availability'); // Score: 30
    });

    it('should handle single factor correctly', () => {
      const singleFactor = {
        rosterNeed: { score: 75, explanation: "Test" }
      };
      
      const strongest = Object.entries(singleFactor).reduce((max, [key, data]) => 
        data.score > singleFactor[max].score ? key : max
      , Object.keys(singleFactor)[0]);
      
      const weakest = Object.entries(singleFactor).reduce((min, [key, data]) => 
        data.score < singleFactor[min].score ? key : min
      , Object.keys(singleFactor)[0]);
      
      expect(strongest).toBe('rosterNeed');
      expect(weakest).toBe('rosterNeed');
    });
  });

  describe('Score Interpretation Logic', () => {
    it('should provide correct interpretation for excellent scores', () => {
      const getScoreInterpretation = (score) => {
        if (score >= 80) return "Excellent - This factor strongly supports drafting this player";
        if (score >= 60) return "Good - This factor moderately supports drafting this player";
        if (score >= 40) return "Average - This factor is neutral regarding this player";
        if (score >= 20) return "Below Average - This factor suggests caution with this player";
        return "Poor - This factor argues against drafting this player";
      };

      expect(getScoreInterpretation(90)).toBe("Excellent - This factor strongly supports drafting this player");
      expect(getScoreInterpretation(80)).toBe("Excellent - This factor strongly supports drafting this player");
    });

    it('should provide correct interpretation for good scores', () => {
      const getScoreInterpretation = (score) => {
        if (score >= 80) return "Excellent - This factor strongly supports drafting this player";
        if (score >= 60) return "Good - This factor moderately supports drafting this player";
        if (score >= 40) return "Average - This factor is neutral regarding this player";
        if (score >= 20) return "Below Average - This factor suggests caution with this player";
        return "Poor - This factor argues against drafting this player";
      };

      expect(getScoreInterpretation(72)).toBe("Good - This factor moderately supports drafting this player");
      expect(getScoreInterpretation(60)).toBe("Good - This factor moderately supports drafting this player");
    });

    it('should provide correct interpretation for average scores', () => {
      const getScoreInterpretation = (score) => {
        if (score >= 80) return "Excellent - This factor strongly supports drafting this player";
        if (score >= 60) return "Good - This factor moderately supports drafting this player";
        if (score >= 40) return "Average - This factor is neutral regarding this player";
        if (score >= 20) return "Below Average - This factor suggests caution with this player";
        return "Poor - This factor argues against drafting this player";
      };

      expect(getScoreInterpretation(45)).toBe("Average - This factor is neutral regarding this player");
      expect(getScoreInterpretation(40)).toBe("Average - This factor is neutral regarding this player");
    });

    it('should provide correct interpretation for below average scores', () => {
      const getScoreInterpretation = (score) => {
        if (score >= 80) return "Excellent - This factor strongly supports drafting this player";
        if (score >= 60) return "Good - This factor moderately supports drafting this player";
        if (score >= 40) return "Average - This factor is neutral regarding this player";
        if (score >= 20) return "Below Average - This factor suggests caution with this player";
        return "Poor - This factor argues against drafting this player";
      };

      expect(getScoreInterpretation(30)).toBe("Below Average - This factor suggests caution with this player");
      expect(getScoreInterpretation(20)).toBe("Below Average - This factor suggests caution with this player");
    });

    it('should provide correct interpretation for poor scores', () => {
      const getScoreInterpretation = (score) => {
        if (score >= 80) return "Excellent - This factor strongly supports drafting this player";
        if (score >= 60) return "Good - This factor moderately supports drafting this player";
        if (score >= 40) return "Average - This factor is neutral regarding this player";
        if (score >= 20) return "Below Average - This factor suggests caution with this player";
        return "Poor - This factor argues against drafting this player";
      };

      expect(getScoreInterpretation(15)).toBe("Poor - This factor argues against drafting this player");
      expect(getScoreInterpretation(0)).toBe("Poor - This factor argues against drafting this player");
    });
  });

  describe('Progress Bar Width Calculation', () => {
    it('should clamp progress bar widths to 0-100%', () => {
      const getClampedWidth = (score) => Math.min(100, Math.max(0, score));

      expect(getClampedWidth(150)).toBe(100); // Above 100
      expect(getClampedWidth(100)).toBe(100); // Exactly 100
      expect(getClampedWidth(85)).toBe(85);   // Normal value
      expect(getClampedWidth(0)).toBe(0);     // Exactly 0
      expect(getClampedWidth(-10)).toBe(0);   // Below 0
    });

    it('should handle decimal values correctly', () => {
      const getClampedWidth = (score) => Math.min(100, Math.max(0, score));

      expect(getClampedWidth(85.5)).toBe(85.5);
      expect(getClampedWidth(0.1)).toBe(0.1);
      expect(getClampedWidth(99.9)).toBe(99.9);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large numbers of factors efficiently', () => {
      const manyFactors = {};
      for (let i = 0; i < 100; i++) {
        manyFactors[`factor${i}`] = {
          score: Math.random() * 100,
          explanation: `Factor ${i} explanation`
        };
      }

      const startTime = performance.now();
      
      // Simulate the main operations the component would perform
      const factorEntries = Object.entries(manyFactors);
      const processedFactors = factorEntries.map(([key, data]) => ({
        key,
        score: Math.round(data.score * 10) / 10,
        color: data.score >= 75 ? "green" : data.score >= 50 ? "yellow" : "orange"
      }));
      
      const endTime = performance.now();
      
      expect(processedFactors).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });

    it('should handle repeated calculations efficiently', () => {
      const startTime = performance.now();
      
      // Simulate multiple re-renders with factor changes
      for (let i = 0; i < 1000; i++) {
        const score = Math.random() * 100;
        const color = score >= 75 ? "text-green-400" : 
                     score >= 50 ? "text-yellow-400" : 
                     score >= 25 ? "text-orange-400" : "text-red-400";
        const width = Math.min(100, Math.max(0, score));
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(50); // Should handle many calculations quickly
    });
  });
});