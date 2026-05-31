import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generate a short-lived JWT access token for the given user ID.
 * @param {string|ObjectId} userId
 * @returns {string} signed JWT
 */
export const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

/**
 * Generate a long-lived JWT refresh token for the given user ID.
 * @param {string|ObjectId} userId
 * @returns {string} signed JWT
 */
export const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

/**
 * Verify a JWT access token and return its decoded payload.
 * Throws a JsonWebTokenError if the token is invalid or expired.
 * @param {string} token
 * @returns {{ id: string, iat: number, exp: number }}
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
};

/**
 * Verify a JWT refresh token and return its decoded payload.
 * Throws a JsonWebTokenError if the token is invalid or expired.
 * @param {string} token
 * @returns {{ id: string, iat: number, exp: number }}
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
};
