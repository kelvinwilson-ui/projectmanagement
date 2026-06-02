import test from 'node:test';
import assert from 'node:assert';
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../utils/tokenUtils.js';

test('token generation and verification', (t) => {
  const userId = 'abc123';
  const access = generateAccessToken(userId);
  const refresh = generateRefreshToken(userId);

  const decodedAccess = verifyAccessToken(access);
  const decodedRefresh = verifyRefreshToken(refresh);

  assert.strictEqual(decodedAccess.id, userId);
  assert.strictEqual(decodedRefresh.id, userId);
});
