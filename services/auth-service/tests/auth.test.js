const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ─── Register ────────────────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  test('valid data → 201 with user object', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'John Doe',
      email: 'john@test.com',
      password: 'password123',
      role: 'CUSTOMER',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('john@test.com');
    expect(res.body.user.role).toBe('CUSTOMER');
  });

  test('response never includes hashed password', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Jane',
      email: 'jane@test.com',
      password: 'password123',
    });
    expect(res.body.user.hashedPassword).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });

  test('duplicate email → 409', async () => {
    const payload = { name: 'John', email: 'dup@test.com', password: 'password123' };
    await request(app).post('/auth/register').send(payload);
    const res = await request(app).post('/auth/register').send(payload);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already registered');
  });

  test('missing name → 400', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'noname@test.com',
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  test('invalid email → 400', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'John',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(res.status).toBe(400);
  });

  test('password under 6 chars → 400', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'John',
      email: 'short@test.com',
      password: '12345',
    });
    expect(res.status).toBe(400);
  });

  test('invalid role → 400', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'John',
      email: 'role@test.com',
      password: 'password123',
      role: 'SUPERADMIN',
    });
    expect(res.status).toBe(400);
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send({
      name: 'Login User',
      email: 'login@test.com',
      password: 'password123',
    });
  });

  test('valid credentials → 200 + accessToken + refreshToken', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'login@test.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('login@test.com');
  });

  test('wrong password → 401 with generic message', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'login@test.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  test('unknown email → 401 with same generic message (no enumeration)', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'ghost@test.com',
      password: 'password123',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  test('missing password → 400', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'login@test.com' });
    expect(res.status).toBe(400);
  });
});

// ─── Refresh ─────────────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  let refreshToken;

  beforeEach(async () => {
    await request(app).post('/auth/register').send({
      name: 'Refresh User',
      email: 'refresh@test.com',
      password: 'password123',
    });
    const loginRes = await request(app).post('/auth/login').send({
      email: 'refresh@test.com',
      password: 'password123',
    });
    refreshToken = loginRes.body.refreshToken;
  });

  test('valid token → 200 + new rotated token pair', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  test('reused token after rotation → 401 (replay attack blocked)', async () => {
    await request(app).post('/auth/refresh').send({ refreshToken });
    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });

  test('invalid token string → 401', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'fake.token.here' });
    expect(res.status).toBe(401);
  });

  test('missing token → 400', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  let refreshToken;

  beforeEach(async () => {
    await request(app).post('/auth/register').send({
      name: 'Logout User',
      email: 'logout@test.com',
      password: 'password123',
    });
    const loginRes = await request(app).post('/auth/login').send({
      email: 'logout@test.com',
      password: 'password123',
    });
    refreshToken = loginRes.body.refreshToken;
  });

  test('valid token → 200, subsequent refresh → 401', async () => {
    const logoutRes = await request(app).post('/auth/logout').send({ refreshToken });
    expect(logoutRes.status).toBe(200);

    const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  test('unknown token → still 200 (no token enumeration)', async () => {
    const res = await request(app).post('/auth/logout').send({ refreshToken: 'nonexistent.token' });
    expect(res.status).toBe(200);
  });

  test('missing token → 400', async () => {
    const res = await request(app).post('/auth/logout').send({});
    expect(res.status).toBe(400);
  });
});
