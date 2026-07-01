import express from 'express';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/tokenUtils.js';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// token functions moved to utils/tokenUtils.js

const toSafeUser = (user) => {
  const safeUser = user.toObject();
  delete safeUser.password;
  return safeUser;
};

const canManageProjects = (user) => !!user && (user.isAdmin || user.role === 'projectManager');
const canManageRoles = (user) => !!user && !!user.isAdmin;

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const requestedRole = typeof role === 'string' ? role : 'projectManager';
    const safeRole = ['user', 'projectManager', 'admin'].includes(requestedRole) ? requestedRole : 'projectManager';

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Only explicit 'admin' role grants admin privileges at signup
    const isAdmin = safeRole === 'admin';
    const user = await User.create({
      name,
      email,
      password,
      isAdmin,
      role: safeRole,
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid user data' });
    }

    const safeUser = toSafeUser(user);
    // create tokens and set refresh cookie like login
    const accessToken = generateAccessToken(safeUser._id);
    const refreshToken = generateRefreshToken(safeUser._id);
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(refreshToken);
    await user.save();
    const cookieOptions = {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    };
    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.status(201).json({
      _id: safeUser._id,
      name: safeUser.name,
      email: safeUser.email,
      phone: safeUser.phone,
      isAdmin: safeUser.isAdmin,
      role: safeUser.role,
      mustSetPassword: safeUser.mustSetPassword,
      token: accessToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Auth user & get token
router.post('/login', async (req, res) => {
  try {
    const { email, phone, identifier, password } = req.body;
    const loginIdentifier = identifier || email || phone;

    if (!loginIdentifier) {
      return res.status(400).json({ message: 'Email or phone is required' });
    }

    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { phone: loginIdentifier }],
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid login details' });
    }

    const hasPassword = !!user.password;
    const passwordProvided = typeof password === 'string' && password.length > 0;

    if (hasPassword && passwordProvided) {
      const passwordMatches = await user.matchPassword(password);
      if (!passwordMatches) {
        return res.status(401).json({ message: 'Invalid email, phone, or password' });
      }
    } else if (hasPassword && !passwordProvided) {
      return res.status(401).json({ message: 'Password required for this account' });
    }

    const safeUser = toSafeUser(user);
    // generate tokens
    const accessToken = generateAccessToken(safeUser._id);
    const refreshToken = generateRefreshToken(safeUser._id);

    // store refresh token for rotation/invalidation
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push(refreshToken);
    await user.save();

    // set httpOnly cookie for refresh token
    const cookieOptions = {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    };
    res.cookie('refreshToken', refreshToken, cookieOptions);

    return res.json({
      _id: safeUser._id,
      name: safeUser.name,
      email: safeUser.email,
      phone: safeUser.phone,
      isAdmin: safeUser.isAdmin,
      role: safeUser.role,
      mustSetPassword: !!safeUser.mustSetPassword,
      token: accessToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route POST /api/auth/refresh
// @desc  Refresh access token using httpOnly refresh token cookie
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      console.warn('[auth.refresh] No refresh token provided. cookies:', Object.keys(req.cookies || {}));
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      console.warn('[auth.refresh] verifyRefreshToken failed:', err && err.message ? err.message : err);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    // ensure token exists in user's stored refresh tokens
    if (!user.refreshTokens || !user.refreshTokens.includes(token)) {
      console.warn('[auth.refresh] refresh token not found in user record for userId=', String(user._id));
      return res.status(401).json({ message: 'Refresh token not recognized' });
    }

    // rotation: remove the used token and issue a new one
    user.refreshTokens = user.refreshTokens.filter(t => t !== token);
    const newRefresh = generateRefreshToken(user._id);
    user.refreshTokens.push(newRefresh);
    await user.save();

    const newAccess = generateAccessToken(user._id);

    const cookieOptions = {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    };
    res.cookie('refreshToken', newRefresh, cookieOptions);
    console.info('[auth.refresh] issued new access token for userId=', String(user._id));
    return res.json({ token: newAccess });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route POST /api/auth/logout
// @desc  Logout user and invalidate refresh token cookie
router.post('/logout', protect, async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (token && req.user) {
      req.user.refreshTokens = (req.user.refreshTokens || []).filter(t => t !== token);
      await req.user.save();
    }
    res.clearCookie('refreshToken');
    return res.json({ message: 'Logged out' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/auth/users
// @desc    Get all users for assignment
router.get('/users', protect, async (req, res) => {
  try {
    if (!canManageRoles(req.user)) {
      return res.status(403).json({ message: 'Only admins can view all users' });
    }

    const users = await User.find({}).select('-password');
    res.json(users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isAdmin: !!user.isAdmin,
      role: user.role,
      mustSetPassword: !!user.mustSetPassword,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin or Project Manager: create a user (no password) and return user; user must set password on first login
router.post('/users', protect, async (req, res) => {
  try {
    if (!canManageProjects(req.user)) {
      return res.status(403).json({ message: 'Only admins or project managers can invite users' });
    }

    const { name, email, phone } = req.body;
    if (!email || !name) return res.status(400).json({ message: 'Name and email required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({ name, email, phone, mustSetPassword: true, role: 'user' });
    res.status(201).json(toSafeUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Complete initial setup: set password for a user who mustSetPassword
router.post('/complete-setup', async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) return res.status(400).json({ message: 'userId and password required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.mustSetPassword) return res.status(400).json({ message: 'Setup not required' });

    user.password = password;
    user.mustSetPassword = false;
    await user.save();

    res.json({ message: 'Password set successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle admin status for a user (only admins may do this)
router.put('/users/:id/admin', protect, async (req, res) => {
  try {
    if (!canManageRoles(req.user)) {
      return res.status(403).json({ message: 'Only admins can change user roles' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (typeof req.body.isAdmin === 'boolean') {
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Only admins can grant or revoke admin status' });
      }
      user.isAdmin = req.body.isAdmin;
      user.role = req.body.isAdmin ? 'admin' : 'user';
    }

    await user.save();
    await user.save();
    res.json(toSafeUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Role update endpoint for admins/project managers
router.put('/users/:id/role', protect, async (req, res) => {
  try {
    if (!canManageRoles(req.user)) {
      return res.status(403).json({ message: 'Only admins can change user roles' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const hasIsAdmin = Object.prototype.hasOwnProperty.call(req.body, 'isAdmin');
    if (hasIsAdmin) {
      if (!req.user.isAdmin) {
        return res.status(403).json({ message: 'Only admins can change admin status' });
      }
      user.isAdmin = !!req.body.isAdmin;
      user.role = user.isAdmin ? 'admin' : 'user';
    }

    await user.save();
    res.json(toSafeUser(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;