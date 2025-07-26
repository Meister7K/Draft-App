import { describe, it, expect } from 'vitest';
import RecommendationCard from '../RecommendationCard.jsx';

describe('RecommendationCard', () => {
  it('should export the component', () => {
    expect(RecommendationCard).toBeDefined();
    expect(typeof RecommendationCard).toBe('function');
  });

  it('should be a React component', () => {
    // Basic test to ensure the component can be imported
    expect(RecommendationCard.name).toBe('RecommendationCard');
  });
});