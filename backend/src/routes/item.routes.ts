import { Router } from 'express';
import { ItemController } from '../controllers/item.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { uploadImageMiddleware } from '../middlewares/upload.middleware.js';

export const itemRouter = Router();

itemRouter.use(requireAuth);

itemRouter.get('/', ItemController.listItems);
itemRouter.post('/', ItemController.createItem);
itemRouter.post('/upload-photo', uploadImageMiddleware.single('photo'), ItemController.uploadPhoto);
itemRouter.get('/:id', ItemController.getItemById);
itemRouter.put('/:id', ItemController.updateItem);
itemRouter.delete('/:id', ItemController.deleteItem);
itemRouter.post('/:id/sold', ItemController.recordUnitsSold);
itemRouter.post('/:id/stock-count', ItemController.updateStockCount);
itemRouter.post('/:id/restock', ItemController.restockItem);

