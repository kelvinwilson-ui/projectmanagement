import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import boardRoutes from './routes/boards.js';
import columnRoutes from './routes/columns.js';
import cardRoutes from './routes/cards.js';
import progressRoutes from './routes/progress.js';
import notificationsRoutes from './routes/notifications.js';

const createApp = (options = {}) => {
  const app = express();

  const normalizeOrigin = (value) => {
    if (typeof value !== 'string') return '';
    return value.replace(/[\r\n]/g, '').trim();
  };

  const productionOrigin = normalizeOrigin(process.env.FRONTEND_ORIGIN);
  const frontendOrigins = [
    productionOrigin,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  console.log('Allowed frontendOrigins:', frontendOrigins);

  const corsOrigin = process.env.NODE_ENV === 'production' && productionOrigin
    ? productionOrigin
    : frontendOrigins;

  app.use(cors({
    origin: corsOrigin,
    credentials: true,
  }));

  // Ensure Access-Control-Allow-Credentials is always sent
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ status: 'Server is running normally' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/boards', boardRoutes);
  app.use('/api/columns', columnRoutes);
  app.use('/api/cards', cardRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/notifications', notificationsRoutes);

  // Error handler
  app.use((err, req, res, next) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      console.error('JSON parse error:', err);
      return res.status(400).json({ message: 'Invalid JSON payload' });
    }
    console.error('Unhandled error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ message: err ? err.message : 'Server error' });
  });

  return app;
};

const app = createApp();
export default app;
export { createApp };
