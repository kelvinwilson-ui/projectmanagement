import dotenv from 'dotenv';
import express from 'express'; // <-- FIX 1: Added missing express import
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import cors from "cors";
import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// FIX 2: Check for a Railway/Env variable first, fallback to string if absolutely necessary for now
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kelvinwilson_db_user_projectmanagement:7OzhXlQUzEEfKQSn@cluster0.rkbnvuf.mongodb.net/?appName=Cluster0';

// CORS Configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://projectmanagement-xi-three.vercel.app'
];

// NOTE: It is highly recommended to move this app.use(cors(...)) and app.use(express.json()) 
// inside your 'app.js' file right BEFORE you define any routes (app.use('/api', ...))
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Using MongoDB URI:', MONGODB_URI.substring(0, 30) + '...');

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

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);

console.log('FRONTEND_ORIGIN=', process.env.FRONTEND_ORIGIN);
const io = new IOServer(httpServer, {
  cors: { 
    origin: allowedOrigins,
    credentials: true, 
    methods: ['GET', 'POST'] 
  }
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

// Railway dynamically assigns a port, so we listen on process.env.PORT via PORT variable
httpServer.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});