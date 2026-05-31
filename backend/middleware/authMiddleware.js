import { verifyAccessToken } from '../utils/tokenUtils.js';
import User from '../models/User.js';

/**
 * protect — Express middleware that guards routes requiring authentication.
 *
 * Expects the client to send a Bearer token in the Authorization header:
 *   Authorization: Bearer <access_token>
 *
 * On success, attaches the authenticated User document to req.user and
 * calls next() to hand control to the route handler.
 *
 * Responds with:
 *   401 — if no token is provided or the token is invalid/expired
 *   404 — if the token is valid but the user no longer exists in the database
 */
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({ message: 'Not authorized, token is invalid or expired' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized' });
  }
};
