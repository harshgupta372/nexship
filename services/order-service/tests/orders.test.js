const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

// No Kafka needed in tests
jest.mock('../src/kafka/producer', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
  connectProducer: jest.fn().mockResolvedValue(undefined),
  disconnectProducer: jest.fn().mockResolvedValue(undefined),
}));

let mongod;

const CUSTOMER = { 'x-user-id': 'customer-1', 'x-user-role': 'CUSTOMER' };
const CUSTOMER2 = { 'x-user-id': 'customer-2', 'x-user-role': 'CUSTOMER' };
const AGENT = { 'x-user-id': 'agent-1', 'x-user-role': 'AGENT' };
const ADMIN = { 'x-user-id': 'admin-1', 'x-user-role': 'ADMIN' };

const VALID_ORDER = {
  origin: { address: '123 Main St', city: 'Mumbai', pincode: '400001' },
  destination: { address: '456 Park Ave', city: 'Delhi', pincode: '110001' },
  packageDetails: { weight: 2.5, description: 'Test package' },
};

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

// ─── Create Order ────────────────────────────────────────────────────────────

describe('POST /orders', () => {
  test('customer creates order → 201, status CREATED', async () => {
    const res = await request(app).post('/orders').set(CUSTOMER).send(VALID_ORDER);
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('CREATED');
    expect(res.body.order.customerId).toBe('customer-1');
  });

  test('agent cannot create order → 403', async () => {
    const res = await request(app).post('/orders').set(AGENT).send(VALID_ORDER);
    expect(res.status).toBe(403);
  });

  test('admin cannot create order → 403', async () => {
    const res = await request(app).post('/orders').set(ADMIN).send(VALID_ORDER);
    expect(res.status).toBe(403);
  });

  test('missing origin address → 400', async () => {
    const res = await request(app)
      .post('/orders')
      .set(CUSTOMER)
      .send({ ...VALID_ORDER, origin: { city: 'Mumbai', pincode: '400001' } });
    expect(res.status).toBe(400);
  });

  test('weight = 0 → 400', async () => {
    const res = await request(app)
      .post('/orders')
      .set(CUSTOMER)
      .send({ ...VALID_ORDER, packageDetails: { weight: 0 } });
    expect(res.status).toBe(400);
  });

  test('negative weight → 400', async () => {
    const res = await request(app)
      .post('/orders')
      .set(CUSTOMER)
      .send({ ...VALID_ORDER, packageDetails: { weight: -1 } });
    expect(res.status).toBe(400);
  });
});

// ─── List Orders ─────────────────────────────────────────────────────────────

describe('GET /orders', () => {
  beforeEach(async () => {
    await request(app).post('/orders').set(CUSTOMER).send(VALID_ORDER);
    await request(app).post('/orders').set(CUSTOMER2).send(VALID_ORDER);
  });

  test('customer sees only own orders', async () => {
    const res = await request(app).get('/orders').set(CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(1);
    expect(res.body.orders[0].customerId).toBe('customer-1');
  });

  test('admin sees all orders', async () => {
    const res = await request(app).get('/orders').set(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(2);
  });

  test('agent sees only assigned orders', async () => {
    const res = await request(app).get('/orders').set(AGENT);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(0); // no orders assigned to agent-1 yet
  });
});

// ─── Get Single Order ────────────────────────────────────────────────────────

describe('GET /orders/:id', () => {
  let orderId;

  beforeEach(async () => {
    const res = await request(app).post('/orders').set(CUSTOMER).send(VALID_ORDER);
    orderId = res.body.order._id;
  });

  test('customer fetches own order → 200', async () => {
    const res = await request(app).get(`/orders/${orderId}`).set(CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.order._id).toBe(orderId);
  });

  test('customer cannot fetch another customer\'s order → 403', async () => {
    const res = await request(app).get(`/orders/${orderId}`).set(CUSTOMER2);
    expect(res.status).toBe(403);
  });

  test('admin can fetch any order → 200', async () => {
    const res = await request(app).get(`/orders/${orderId}`).set(ADMIN);
    expect(res.status).toBe(200);
  });

  test('non-existent order → 404', async () => {
    const res = await request(app).get('/orders/000000000000000000000000').set(ADMIN);
    expect(res.status).toBe(404);
  });
});

// ─── Assign Agent ────────────────────────────────────────────────────────────

describe('PATCH /orders/:id/assign', () => {
  let orderId;

  beforeEach(async () => {
    const res = await request(app).post('/orders').set(CUSTOMER).send(VALID_ORDER);
    orderId = res.body.order._id;
  });

  test('admin assigns agent → 200, status ASSIGNED', async () => {
    const res = await request(app)
      .patch(`/orders/${orderId}/assign`)
      .set(ADMIN)
      .send({ agentId: 'agent-1' });
    expect(res.status).toBe(200);
    expect(res.body.order.agentId).toBe('agent-1');
    expect(res.body.order.status).toBe('ASSIGNED');
  });

  test('customer cannot assign → 403', async () => {
    const res = await request(app)
      .patch(`/orders/${orderId}/assign`)
      .set(CUSTOMER)
      .send({ agentId: 'agent-1' });
    expect(res.status).toBe(403);
  });

  test('agent cannot assign → 403', async () => {
    const res = await request(app)
      .patch(`/orders/${orderId}/assign`)
      .set(AGENT)
      .send({ agentId: 'agent-1' });
    expect(res.status).toBe(403);
  });

  test('assigning already-assigned order → 400', async () => {
    await request(app).patch(`/orders/${orderId}/assign`).set(ADMIN).send({ agentId: 'agent-1' });
    const res = await request(app)
      .patch(`/orders/${orderId}/assign`)
      .set(ADMIN)
      .send({ agentId: 'agent-2' });
    expect(res.status).toBe(400);
  });

  test('missing agentId → 400', async () => {
    const res = await request(app)
      .patch(`/orders/${orderId}/assign`)
      .set(ADMIN)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── Update Status ───────────────────────────────────────────────────────────

describe('PATCH /orders/:id/status', () => {
  let orderId;

  beforeEach(async () => {
    const createRes = await request(app).post('/orders').set(CUSTOMER).send(VALID_ORDER);
    orderId = createRes.body.order._id;
    await request(app).patch(`/orders/${orderId}/assign`).set(ADMIN).send({ agentId: 'agent-1' });
  });

  test('agent updates own order ASSIGNED → PICKED_UP → 200', async () => {
    const res = await request(app)
      .patch(`/orders/${orderId}/status`)
      .set(AGENT)
      .send({ status: 'PICKED_UP' });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('PICKED_UP');
  });

  test('admin can update any order status → 200', async () => {
    const res = await request(app)
      .patch(`/orders/${orderId}/status`)
      .set(ADMIN)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('CANCELLED');
  });

  test('customer cannot update status → 403', async () => {
    const res = await request(app)
      .patch(`/orders/${orderId}/status`)
      .set(CUSTOMER)
      .send({ status: 'PICKED_UP' });
    expect(res.status).toBe(403);
  });

  test('invalid status transition ASSIGNED → DELIVERED → 400 with allowed list', async () => {
    const res = await request(app)
      .patch(`/orders/${orderId}/status`)
      .set(AGENT)
      .send({ status: 'DELIVERED' });
    expect(res.status).toBe(400);
    expect(res.body.allowed).toContain('PICKED_UP');
    expect(res.body.allowed).toContain('CANCELLED');
  });

  test('full happy path: ASSIGNED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED', async () => {
    const steps = ['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    for (const status of steps) {
      const res = await request(app)
        .patch(`/orders/${orderId}/status`)
        .set(AGENT)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe(status);
    }
  });

  test('non-existent order → 404', async () => {
    const res = await request(app)
      .patch('/orders/000000000000000000000000/status')
      .set(ADMIN)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(404);
  });
});
