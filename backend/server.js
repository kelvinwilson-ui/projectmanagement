import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// MongoDB connection (replace with your local or Atlas URI)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/project_management';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    const Board = mongoose.models.Board || mongoose.model('Board', new mongoose.Schema({ title: String }));
    const boards = await Board.find();
    if (boards.length === 0) {
      await Board.create({ title: 'Main Project Board' });
      console.log('Seeded initial Board data');
    }
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Create HTTP server and attach Socket.IO for real-time notifications
const httpServer = createServer(app);
const io = new IOServer(httpServer, {
  cors: { origin: '*' }
});

// Map of userId -> socketId for quick lookup
global.connectedSockets = new Map();
global.io = io;

io.on('connection', (socket) => {
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