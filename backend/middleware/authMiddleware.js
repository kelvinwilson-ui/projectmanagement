import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      req.user = await User.findById(decoded.id).select('-password');
      return next();
    } catch (error) {
      console.warn('[auth.protect] token verification failed:', error && error.message ? error.message : error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    console.warn('[auth.protect] No Bearer token present in Authorization header');
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};