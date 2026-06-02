import test from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import supertest from 'supertest';
import { createApp } from '../app.js';

let app;
let request;

test.before(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/project_management_test';
  await mongoose.connect(uri, { dbName: 'project_management_test' });
  // clear DB
  await mongoose.connection.dropDatabase().catch(() => {});
  app = createApp();
  request = supertest(app);
});

test.after(async () => {
  await mongoose.disconnect();
});

test('register and login flow', async (t) => {
  const user = { name: 'Test User', email: 'test@example.com', password: 'password123' };

  // register
  const regRes = await request.post('/api/auth/register').send(user);
  assert.strictEqual(regRes.status, 201);
  assert.ok(regRes.body.token, 'register should return token');

  // login
  const loginRes = await request.post('/api/auth/login').send({ identifier: user.email, password: user.password });
  assert.strictEqual(loginRes.status, 200);
  assert.ok(loginRes.body.token, 'login should return token');
});
