import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// MongoDB connection - use new Atlas credentials
// Override any old MONGODB_URI with the new working one for production
const MONGODB_URI = 'mongodb+srv://kelvinwilson_db_user_projectmanagement:7OzhXlQUzEEfKQSn@cluster0.rkbnvuf.mongodb.net/?appName=Cluster0';

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Using MongoDB URI:', MONGODB_URI.substring(0, 60) + '...');

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
// Log important environment values for debugging CORS issues
console.log('FRONTEND_ORIGIN=', process.env.FRONTEND_ORIGIN);
console.log('NODE_ENV=', process.env.NODE_ENV);
const io = new IOServer(httpServer, {
  cors: { origin: process.env.FRONTEND_ORIGIN || '*' }
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