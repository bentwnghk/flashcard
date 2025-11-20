export interface SM2Result {
  interval: number;      // Days until next review
  repetitions: number;   // Number of successful reviews
  easeFactor: number;    // Difficulty multiplier (1.3 - 2.5)
  nextReviewDate: Date;  // Calculated next review date
}

export interface SM2Input {
  quality: number;       // 0-5 rating
  repetitions: number;   // Current repetitions
  easeFactor: number;    // Current ease factor
  interval: number;      // Current interval in days
}

/**
 * Calculate next review using SuperMemo 2 (SM-2) algorithm
 * 
 * Quality ratings:
 * 0 - Complete blackout
 * 1 - Incorrect but remembered something
 * 2 - Correct but very difficult (Hard)
 * 3 - Correct with some hesitation (Good)
 * 4 - Correct with ease
 * 5 - Perfect recall (Easy)
 */
export function calculateSM2(input: SM2Input): SM2Result {
  const { quality, repetitions, easeFactor, interval } = input;

  // Validate quality rating
  if (quality < 0 || quality > 5) {
    throw new Error('Quality must be between 0 and 5');
  }

  // Calculate new ease factor
  let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Ensure ease factor stays within bounds
  newEaseFactor = Math.max(1.3, newEaseFactor);

  let newRepetitions: number;
  let newInterval: number;

  // If quality < 3, the card is failed
  if (quality < 3) {
    newRepetitions = 0;
    newInterval = 1; // Review again tomorrow
  } else {
    newRepetitions = repetitions + 1;

    // Calculate interval based on repetition number
    if (newRepetitions === 1) {
      newInterval = 1; // First successful review: 1 day
    } else if (newRepetitions === 2) {
      newInterval = 6; // Second successful review: 6 days
    } else {
      // Subsequent reviews: multiply previous interval by ease factor
      newInterval = Math.round(interval * newEaseFactor);
    }
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    interval: newInterval,
    repetitions: newRepetitions,
    easeFactor: newEaseFactor,
    nextReviewDate
  };
}

/**
 * Map user-friendly button labels to quality ratings
 */
export const QUALITY_RATINGS = {
  AGAIN: 0,  // Complete failure
  HARD: 2,   // Difficult but correct
  GOOD: 3,   // Correct with some effort
  EASY: 5    // Perfect recall
} as const;

/**
 * Get suggested intervals for display (before user rates)
 */
export function getSuggestedIntervals(currentInterval: number, easeFactor: number) {
  return {
    again: '< 1 day',
    hard: `${Math.round(currentInterval * 1.2)} days`,
    good: `${Math.round(currentInterval * easeFactor)} days`,
    easy: `${Math.round(currentInterval * easeFactor * 1.3)} days`
  };
}

/**
 * Determine if a card is "mature" (well-learned)
 * A card is considered mature if interval >= 21 days
 */
export function isCardMature(interval: number): boolean {
  return interval >= 21;
}

export type QualityRating = typeof QUALITY_RATINGS[keyof typeof QUALITY_RATINGS];