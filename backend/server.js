import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import boardRoutes from './routes/boards.js';
import columnRoutes from './routes/columns.js';
import cardRoutes from './routes/cards.js';
import authRoutes from './routes/auth.js';

import { MongoMemoryServer } from 'mongodb-memory-server';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
app.use(express.json());

// MongoDB connection (replace with your local or Atlas URI)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/project_management';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    // Seed some initial data if the database is empty
    const Board = mongoose.models.Board || mongoose.model('Board', new mongoose.Schema({ title: String }));
    const boards = await Board.find();
    if (boards.length === 0) {
      await Board.create({ title: 'Main Project Board' });
      console.log('Seeded initial Board data');
    }
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Basic route
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running normally' });
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/cards', cardRoutes);

// Error handler for malformed JSON/body-parser errors and other exceptions
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    console.error('JSON parse error:', err);
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: err ? err.message : 'Server error' });
});

// Create HTTP server and attach Socket.IO for real-time notifications
const httpServer = createServer(app);
const io = new IOServer(httpServer, {
  cors: { origin: process.env.FRONTEND_ORIGIN || '*' }
});

// Map of userId -> socketId for quick lookup
global.connectedSockets = new Map();
global.io = io;

io.on('connection', (socket) => {
  // Client should emit 'authenticate' with their JWT token after connecting
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      const userId = decoded.id;
      socket.userId = userId;
      global.connectedSockets.set(String(userId), socket.id);
      socket.emit('authenticated');
    } catch (err) {
      socket.emit('unauthorized');
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) global.connectedSockets.delete(String(socket.userId));
  });
});

httpServer.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});