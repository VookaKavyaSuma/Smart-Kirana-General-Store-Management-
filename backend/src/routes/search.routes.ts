import { Router } from 'express';
import { SearchController } from '../controllers/search.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const searchRouter = Router();

searchRouter.use(requireAuth);

searchRouter.get('/', SearchController.searchItems);
searchRouter.get('/suggestions', SearchController.getSuggestions);
searchRouter.post('/history', SearchController.recordSearchHistory);
searchRouter.delete('/suggestions/:id', SearchController.deleteSuggestion);
searchRouter.post('/voice-command', SearchController.handleVoiceCommand);
