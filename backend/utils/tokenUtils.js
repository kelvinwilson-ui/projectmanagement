import jwt from 'jsonwebtoken';

export const generateAccessToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' });
export const generateRefreshToken = (id) => jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET || (process.env.JWT_SECRET || 'fallback_secret') + '_refresh', { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' });

export const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
export const verifyRefreshToken = (token) => jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || (process.env.JWT_SECRET || 'fallback_secret') + '_refresh');
