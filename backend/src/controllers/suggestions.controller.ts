import { Request, Response } from 'express';
import { SuggestionsService, SuggestionPeriod } from '../services/suggestions.service.js';
import { SUGGESTIONS_CONFIG } from '../config/suggestions.config.js';

export class SuggestionsController {
  /**
   * GET /api/v1/suggestions?period=last_30_days|last_90_days|all_time
   */
  static async getSuggestions(req: Request, res: Response): Promise<void> {
    const storeId = (req as any).store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const rawPeriod = req.query.period as string;
    let period: SuggestionPeriod = 'last_30_days';
    if (rawPeriod === 'last_90_days' || rawPeriod === 'all_time') {
      period = rawPeriod;
    }

    try {
      const data = await SuggestionsService.getSuggestions(storeId, period);
      res.json({ success: true, ...data });
    } catch (err: any) {
      console.error('getSuggestions error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to generate suggestions' });
    }
  }

  /**
   * GET /api/v1/suggestions/weights
   * Returns current scoring weights from config
   */
  static async getWeights(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      weights: SUGGESTIONS_CONFIG.WEIGHTS,
      thresholds: SUGGESTIONS_CONFIG.THRESHOLDS,
    });
  }
}

