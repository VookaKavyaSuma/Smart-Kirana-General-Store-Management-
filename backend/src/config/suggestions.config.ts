/**
 * Configuration for Suggested Items Ranking & Scoring (Requirement FR-9.2)
 *
 * Scoring Formula:
 * Score = 0.4 * normalised_margin + 0.4 * normalised_total_profit + 0.2 * normalised_units_sold_per_week
 */
export const SUGGESTIONS_CONFIG = {
  WEIGHTS: {
    MARGIN: 0.4,
    TOTAL_PROFIT: 0.4,
    UNITS_PER_WEEK: 0.2,
  },
  THRESHOLDS: {
    // Items worth buying more of: overall composite score >= 50 (on a 0-100 scale)
    WORTH_BUYING_SCORE: 50,
    // Fast selling velocity threshold in units sold per week
    FAST_SELLING_VELOCITY: 2.0,
    // Slow selling / review thresholds
    SLOW_VELOCITY: 1.0,
    LOW_MARGIN_PERCENT: 15.0,
  },
};
