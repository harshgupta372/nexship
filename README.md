# NexShip

Production-pattern microservices platform for shipment tracking. Customers place orders, admins assign agents, agents update status — every event fans out through Kafka to tracking, notification, and analytics services automatically.

Built as a portfolio project to demonstrate: microservices architecture, event-driven design, JWT auth with refresh token rotation, distributed request tracing, CI/CD pipelines, and automated testing.

---

## Architecture

```
Client
  │
  ▼
┌─────────────────────────────────────────┐
│              API Gateway :3000           │
│  • JWT verification                     │
│  • Request ID stamping (UUID)           │
│  • Injects x-user-id, x-user-role      │
│  • Proxies to downstream services       │
└──────┬──────┬──────┬──────┬────────────┘
       │      │      │      │
       ▼      ▼      ▼      ▼
   auth   order  track  analytics  notification
   :3001  :3002  :3003   :3005       :3004
              │
              │  Kafka events (async)
              ▼
   ┌──────────────────────────┐
   │        Apache Kafka      │
   │  • order.created         │
   │  • order.status.updated  │
   │  • order.assigned        │
   └────┬──────────┬──────────┘
        │          │          │
        ▼          ▼          ▼
   tracking   notification  analytics
   (timeline)  (email)      (metrics)
```

Each service has its own MongoDB database. No shared state — cross-service communication is Kafka only.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + Express |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | express-validator |
| Database | MongoDB + Mongoose |
| Messaging | Apache Kafka (KafkaJS) |
| Email | Nodemailer (Gmail SMTP) |
| Testing | Jest + Supertest + mongodb-memory-server |
| Containerization | Docker + Docker Compose |
| CI/CD | Jenkins |
| Frontend | React + Vite |

---

## Running Locally

**Prerequisites:** Docker + Docker Compose

```bash
git clone https://github.com/harshgupta372/nexship.git
cd nexship
cp gateway/.env.example gateway/.env
cp services/auth-service/.env.example services/auth-service/.env
# fill in JWT secrets in each .env

docker-compose up --build
```

Services boot in order: Zookeeper → Kafka → MongoDB → all services → Gateway

Gateway available at `http://localhost:3000`

---

## Environment Variables

### Gateway (`gateway/.env`)
```
PORT=3000
JWT_ACCESS_SECRET=your-access-secret
AUTH_SERVICE_URL=http://auth-service:3001
ORDER_SERVICE_URL=http://order-service:3002
TRACKING_SERVICE_URL=http://tracking-service:3003
NOTIFICATION_SERVICE_URL=http://notification-service:3004
ANALYTICS_SERVICE_URL=http://analytics-service:3005
```

### Auth Service (`services/auth-service/.env`)
```
PORT=3001
MONGO_URI=mongodb://mongo:27017/nexship-auth
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

### Order Service (`services/order-service/.env`)
```
PORT=3002
MONGO_URI=mongodb://mongo:27017/nexship-orders
KAFKA_BROKERS=kafka:9092
```

---

## API Reference

All requests go through the gateway at `http://localhost:3000`.
Protected routes require `Authorization: Bearer <accessToken>`.

### Auth

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/auth/register` | Public | Register. Body: `{ name, email, password, role? }` |
| POST | `/auth/login` | Public | Login. Returns `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | Public | Rotate tokens. Body: `{ refreshToken }` |
| POST | `/auth/logout` | Public | Invalidate refresh token. Body: `{ refreshToken }` |

**Roles:** `CUSTOMER` · `AGENT` · `ADMIN`

### Orders

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/orders` | CUSTOMER | Place new order |
| GET | `/orders` | All | List orders (role-filtered) |
| GET | `/orders/:id` | Owner / ADMIN | Get single order |
| PATCH | `/orders/:id/status` | AGENT (own) / ADMIN | Update status |
| PATCH | `/orders/:id/assign` | ADMIN | Assign delivery agent |

**Order status flow:**
```
CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
    ↘          ↘                                       ↘
 CANCELLED  CANCELLED                              CANCELLED
```

### Tracking

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/tracking/:orderId` | All | Full status timeline for an order |

### Analytics

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/analytics/events` | ADMIN | All recorded order events |

---

## Example Flow

```bash
# 1. Register a customer
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@test.com","password":"password123","role":"CUSTOMER"}'

# 2. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"password123"}'
# → { accessToken: "eyJ...", refreshToken: "eyJ..." }

# 3. Place order
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"address":"123 Main St","city":"Mumbai","pincode":"400001"},
    "destination": {"address":"456 Park Ave","city":"Delhi","pincode":"110001"},
    "packageDetails": {"weight": 2.5, "description": "Documents"}
  }'
# → Order created. Kafka fires order.created → tracking + analytics consume it.

# 4. Admin assigns agent
curl -X PATCH http://localhost:3000/orders/<orderId>/assign \
  -H "Authorization: Bearer <adminToken>" \
  -H "Content-Type: application/json" \
  -d '{"agentId":"<agentUserId>"}'

# 5. Track the order
curl http://localhost:3000/tracking/<orderId> \
  -H "Authorization: Bearer eyJ..."
```

---

## Running Tests

```bash
# Auth service — 18 tests
cd services/auth-service && npm test

# Order service — 24 tests
cd services/order-service && npm test
```

Tests use `mongodb-memory-server` (real MongoDB in RAM) and mock Kafka — no Docker required.

**What's tested:**
- Auth: register validation, duplicate email, login security, refresh token rotation, replay attack detection, logout invalidation
- Orders: role-based access, order creation, status state machine, agent assignment, invalid transitions, full delivery happy path

---

## CI/CD Pipeline (Jenkins)

```
Test → Build → Push → Deploy
```

1. **Test** — Jest suites for auth + order service. Failure aborts pipeline — broken code never reaches Docker or production.
2. **Build** — `docker build` all 6 services + gateway, tagged with `BUILD_NUMBER`.
3. **Push** — images pushed to DockerHub as `BUILD_NUMBER` + `latest`.
4. **Deploy** — SSH into server, `docker-compose pull && docker-compose up -d`.

Jenkins credentials store holds DockerHub login and SSH deploy key — no secrets in code.

---

## Key Design Decisions

**Why Kafka instead of direct HTTP between services?**
If order-service called tracking-service directly, they'd be coupled — tracking down = status update fails. With Kafka, order-service publishes and forgets. Consumers process independently at their own pace.

**Why separate MongoDB per service?**
Shared DB = services coupled at the data layer. Schema change in one breaks another. Each service owns its data exclusively — the microservices contract.

**Why refresh token rotation?**
Every `/auth/refresh` issues a new token pair and invalidates the old one. If an old token is reused, it signals a replay attack — the system kills the entire session. Stolen refresh tokens become useless after the legitimate user refreshes once.

**Why request ID tracing?**
Gateway stamps a UUID on every request. It travels through HTTP headers into Kafka payloads, logged by every service. When something fails, grep that one ID across all service logs — full picture across 6 services instantly.

---

## Project Structure

```
nexship/
├── docker-compose.yml
├── Jenkinsfile
├── README.md
├── gateway/
│   ├── Dockerfile
│   ├── index.js                    # Request ID + JWT middleware + proxy
│   └── src/middleware/auth.js
├── frontend/                       # React + Vite
│   └── src/pages/
│       ├── Login.jsx
│       ├── CustomerDashboard.jsx
│       ├── AgentDashboard.jsx
│       └── AdminDashboard.jsx
└── services/
    ├── auth-service/               # 18 Jest tests ✓
    ├── order-service/              # 24 Jest tests ✓
    ├── tracking-service/
    ├── notification-service/
    └── analytics-service/
```
