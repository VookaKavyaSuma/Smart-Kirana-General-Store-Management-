import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { SuggestionsController } from '../controllers/suggestions.controller.js';

export const suggestionsRouter = Router();

// Require authenticated session
suggestionsRouter.use(requireAuth);

// Get suggestions across the 3 lists (FR-9.1 to FR-9.6)
suggestionsRouter.get('/', SuggestionsController.getSuggestions);

// Get weights config
suggestionsRouter.get('/weights', SuggestionsController.getWeights);

