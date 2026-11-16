import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import { generalApiLimiter } from './middlewares/rate-limit.middleware.js';
import { authRouter } from './routes/auth.routes.js';
import { itemRouter } from './routes/item.routes.js';
import { supplierRouter } from './routes/supplier.routes.js';
import { purchaseRouter } from './routes/purchase.routes.js';
import { billRouter } from './routes/bill.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { creditRouter } from './routes/credit.routes.js';
import { onlineRouter } from './routes/online.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { suggestionsRouter } from './routes/suggestions.routes.js';
import { checkDatabaseConnection, getDatabaseStatus } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Security Headers (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Managed separately or for API responses
  })
);

// CORS configuration allowing cookies and sessions
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Allow configured FRONTEND_URL or local development origins
      if (
        origin === FRONTEND_URL ||
        origin === 'http://localhost:5173' ||
        origin === 'http://127.0.0.1:5173' ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.netlify.app') ||
        origin.endsWith('.onrender.com') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// General Rate Limiter on all API routes
app.use('/api', generalApiLimiter);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files for public items and shop photos
app.use('/uploads/items', express.static(path.join(process.cwd(), 'uploads', 'items')));
app.use('/uploads/shops', express.static(path.join(process.cwd(), 'uploads', 'shops')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'Smart Kirana Store Management API',
    database: getDatabaseStatus()
      ? 'PostgreSQL (Supabase/Prisma Connected)'
      : 'In-Memory Fallback (Database Not Connected)',
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

app.use('/api/v1/search', searchRouter);
app.use('/api/search', searchRouter);

app.use('/api/v1/settings', settingsRouter);
app.use('/api/settings', settingsRouter);

app.use('/api/v1/credit', creditRouter);
app.use('/api/credit', creditRouter);

app.use('/api/v1/online', onlineRouter);
app.use('/api/online', onlineRouter);

app.use('/api/v1/reports', reportRouter);
app.use('/api/reports', reportRouter);

app.use('/api/v1/suggestions', suggestionsRouter);
app.use('/api/suggestions', suggestionsRouter);

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
