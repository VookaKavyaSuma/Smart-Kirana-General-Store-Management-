import { Response } from 'express';
import { SearchService } from '../services/search.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class SearchController {
  /**
   * Instant search items with fuzzy & Telugu/English support (FR-7.1, FR-7.2, FR-7.5, FR-7.6)
   */
  static async searchItems(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const q = (req.query.q as string) || '';
    const result = await SearchService.searchItems(storeId, q);

    res.json({
      success: true,
      items: result.items,
      durationMs: result.durationMs,
    });
  }

  /**
   * Get search suggestions ordered by how often that user searched them (FR-7.3)
   */
  static async getSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const q = (req.query.q as string) || '';
    const suggestions = await SearchService.getSuggestions(storeId, q);

    res.json({
      success: true,
      suggestions,
    });
  }

  /**
   * Record a search term or opened item to SearchHistory (FR-7.4)
   */
  static async recordSearchHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { searchWord, itemId } = req.body;
    if (!searchWord || !searchWord.trim()) {
      res.status(400).json({ success: false, error: 'Search word is required.' });
      return;
    }

    const record = await SearchService.recordSearchHistory(storeId, searchWord, itemId);
    res.json({
      success: true,
      record,
    });
  }

  /**
   * Delete a suggestion from search history (FR-7.7)
   */
  static async deleteSuggestion(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    await SearchService.deleteSuggestion(storeId, id);

    res.json({
      success: true,
      message: 'Suggestion removed from search history.',
    });
  }

  /**
   * Process voice input commands (FR-2.4 to FR-2.7)
   */
  static async handleVoiceCommand(req: AuthenticatedRequest, res: Response): Promise<void> {
    const storeId = req.store?.id;
    if (!storeId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { command, language } = req.body;
    if (!command || !command.trim()) {
      res.status(400).json({ success: false, error: 'Voice command is required.' });
      return;
    }

    const result = await SearchService.handleVoiceCommand(storeId, command, language || 'en');
    res.json({
      success: true,
      ...result,
    });
  }
}

