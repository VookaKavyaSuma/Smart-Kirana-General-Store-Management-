import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { authRouter } from './routes/auth.routes.js';
import { itemRouter } from './routes/item.routes.js';
import { supplierRouter } from './routes/supplier.routes.js';
import { purchaseRouter } from './routes/purchase.routes.js';
import { billRouter } from './routes/bill.routes.js';
import { checkDatabaseConnection } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// CORS configuration allowing cookies and sessions
app.use(
  cors({
    origin: [FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files for public items
app.use('/uploads/items', express.static(path.join(process.cwd(), 'uploads', 'items')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'Smart Kirana Store Management API',
    version: '1.3.0',
    time: new Date().toISOString(),
  });
});

// Mount Routes under both /api/v1 and /api
app.use('/api/v1/auth', authRouter);
app.use('/api/auth', authRouter);

app.use('/api/v1/items', itemRouter);
app.use('/api/items', itemRouter);

app.use('/api/v1/suppliers', supplierRouter);
app.use('/api/suppliers', supplierRouter);

app.use('/api/v1/purchases', purchaseRouter);
app.use('/api/purchases', purchaseRouter);

app.use('/api/v1/bills', billRouter);
app.use('/api/bills', billRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (
    err.name === 'MulterError' ||
    err.message?.includes('Invalid file type') ||
    err.message?.includes('File exceeds') ||
    err.code === 'LIMIT_FILE_SIZE'
  ) {
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  console.error('[SERVER ERROR]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Smart Kirana Backend API listening on port ${PORT}`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`======================================================`);
    await checkDatabaseConnection();
  });
}

export default app;
