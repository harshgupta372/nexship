# NexShip — Complete Architecture Reference
**Last updated:** 2026-05-14

This document covers everything built in NexShip from scratch — what every piece does, why it exists, and how they connect.

---

## What Is NexShip?

NexShip is a shipment tracking platform built as a microservices system. A customer places a shipment order. An admin assigns a delivery agent. The agent updates the status as the package moves. The customer can track it in real time. Every status change triggers notifications and analytics — all automatically, via Kafka events.

The point isn't just the features — it's the architecture. NexShip demonstrates: microservices communication, event-driven design, JWT auth, distributed tracing, CI/CD, and automated testing. Portfolio-grade, production-pattern code.

---

## High-Level Architecture

```
Client (Browser)
      │
      ▼
┌─────────────┐
│   Gateway   │  Port 3000 — single entry point for ALL traffic
│  (Express)  │  Verifies JWT, stamps request ID, proxies to services
└──────┬──────┘
       │ HTTP proxy (with x-user-id, x-user-role, x-request-id headers)
       ├──────────────────────────────────────────────────────┐
       │              │              │              │          │
       ▼              ▼              ▼              ▼          ▼
  auth-service   order-service  tracking-service  analytics  notification
   (port 3001)   (port 3002)    (port 3003)       (port 3005) (port 3004)
       │              │
       │              │ publishes Kafka events
       │              ▼
       │        ┌──────────────────────────────────────────────┐
       │        │              Apache Kafka                     │
       │        │  Topics:                                      │
       │        │  • order.created                             │
       │        │  • order.status.updated                      │
       │        │  • order.assigned                            │
       │        └──────┬───────────────┬──────────────┬────────┘
       │               │               │              │
       │               ▼               ▼              ▼
       │        tracking-service  notification   analytics-service
       │        (consumes events) (consumes)     (consumes)
       │
       ▼
   MongoDB
   (separate DB per service — no shared data)
```

---

## Request Flow — Placing an Order

This is the most important flow to understand. Everything else is a variation of it.

```
1. Client sends: POST /orders
   Headers: Authorization: Bearer <jwt>
   Body: { origin, destination, packageDetails }

2. Gateway receives request
   → Stamps x-request-id: a9849579-... (UUID, unique per request)
   → Verifies JWT signature + expiry
   → Decodes: { userId: "abc", role: "CUSTOMER" }
   → Injects headers: x-user-id: abc, x-user-role: CUSTOMER
   → Proxies full request to order-service:3002

3. Order Service receives request
   → Reads x-user-id, x-user-role from headers (trusts gateway)
   → Checks role === CUSTOMER (only customers can place orders)
   → Creates Order document in MongoDB
   → Publishes Kafka event to topic "order.created":
     { orderId, customerId, status: "CREATED", requestId: a9849579-... }
   → Returns 201 { order }

4. Kafka delivers event to consumers (async, after response sent)
   → tracking-service: creates tracking record, initializes timeline
   → analytics-service: records OrderEvent in its own MongoDB
   (notification-service doesn't act on order.created — no email for just placing)

5. All service logs show: x-request-id: a9849579-...
   → If anything fails, grep that ID across all logs = full picture
```

---

## Services

### 1. API Gateway (`gateway/` — port 3000)

**Purpose:** Single entry point. No service is reachable directly — everything goes through here.

**What it does:**

1. **Request ID stamping** — every request gets a UUID (`x-request-id`). If the client sends one, it's kept. Otherwise generated. This ID travels through all services and Kafka payloads — lets you trace one request across all logs.

2. **JWT Authentication** — middleware checks `Authorization: Bearer <token>` header, verifies signature with `JWT_ACCESS_SECRET`, decodes the payload. Rejects with 401 if missing/invalid/expired.

3. **Public routes bypass** — `/auth/register`, `/auth/login`, `/auth/refresh`, `/health` skip auth check (you can't require a token to get a token).

4. **Identity injection** — after JWT verification, injects `x-user-id` and `x-user-role` into proxied request headers. Downstream services read these instead of re-verifying JWT.

5. **Proxy routing** — routes by URL prefix:
   - `/auth/*` → auth-service:3001
   - `/orders/*` → order-service:3002
   - `/tracking/*` → tracking-service:3003
   - `/notifications/*` → notification-service:3004
   - `/analytics/*` → analytics-service:3005

**Why a gateway?** Centralized auth = downstream services stay simple. They trust headers from gateway (internal network only — never exposed to clients directly).

**Key files:**
- [gateway/index.js](../gateway/index.js) — main app, request ID middleware, proxy routes
- [gateway/src/middleware/auth.js](../gateway/src/middleware/auth.js) — JWT verification

---

### 2. Auth Service (`services/auth-service/` — port 3001)

**Purpose:** User registration, login, token management.

**Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/register` | Create account. Returns user object (no tokens). |
| POST | `/auth/login` | Verify credentials. Returns accessToken + refreshToken. |
| POST | `/auth/refresh` | Exchange refresh token for new token pair. |
| POST | `/auth/logout` | Invalidate refresh token. |

**Roles:** CUSTOMER, AGENT, ADMIN. Stored on user, encoded in JWT, forwarded by gateway.

**Security decisions:**

| Decision | Why |
|----------|-----|
| bcrypt cost factor 12 | Higher cost = slower brute force. 12 is production sweet spot. |
| Two JWT secrets (access + refresh) | Compromised access token doesn't expose refresh token. |
| Access token TTL: 15 minutes | Stolen token expires fast. |
| Refresh token TTL: 7 days | Long enough for UX, stored in DB so revokable. |
| Refresh token rotation | Every `/refresh` issues new pair, invalidates old. Reusing old token = replay attack detected = entire session killed. |
| `jti: Date.now()` in refresh tokens | Makes each token unique even if generated within same second. Required for rotation to work reliably. |
| Login returns same error for wrong password AND unknown email | Prevents user enumeration — attacker can't discover which emails are registered. |
| Logout always 200 | Doesn't reveal whether token existed in DB. |

**Rate limiting** (in-memory, resets on restart):
- `/auth/login` — 5 attempts per 15 minutes per IP
- `/auth/register` — 10 registrations per hour per IP
- `/auth/refresh` — 20 attempts per 15 minutes per IP

**Key files:**
- [services/auth-service/src/routes/auth.js](../services/auth-service/src/routes/auth.js) — all endpoints
- [services/auth-service/src/models/User.js](../services/auth-service/src/models/User.js) — User schema
- [services/auth-service/src/app.js](../services/auth-service/src/app.js) — Express app (separated from server start for testability)

---

### 3. Order Service (`services/order-service/` — port 3002)

**Purpose:** Core business logic. Create and manage shipment orders.

**Endpoints:**

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/orders` | CUSTOMER only | Place new order |
| GET | `/orders` | All roles | List orders (filtered by role) |
| GET | `/orders/:id` | Owner or ADMIN | Get single order |
| PATCH | `/orders/:id/status` | AGENT (own), ADMIN | Update order status |
| PATCH | `/orders/:id/assign` | ADMIN only | Assign delivery agent |

**Role-based data filtering:**
- CUSTOMER → sees only their own orders
- AGENT → sees only orders assigned to them
- ADMIN → sees everything

**Status state machine** — prevents arbitrary status jumps:
```
CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
    ↘          ↘                                      ↘
  CANCELLED  CANCELLED                             CANCELLED
```
Trying to jump ASSIGNED → DELIVERED returns 400 with the allowed transitions listed.

**Kafka events published:**
- `order.created` — when customer places order
- `order.status.updated` — when agent/admin updates status
- `order.assigned` — when admin assigns an agent (also publishes `order.status.updated` so tracking + notification catch it)

**Key files:**
- [services/order-service/src/routes/orders.js](../services/order-service/src/routes/orders.js) — all endpoints
- [services/order-service/src/models/Order.js](../services/order-service/src/models/Order.js) — Order schema
- [services/order-service/src/kafka/producer.js](../services/order-service/src/kafka/producer.js) — Kafka event publisher

---

### 4. Tracking Service (`services/tracking-service/` — port 3003)

**Purpose:** Maintains full status timeline for every order. Customers query this to see where their package is.

**How it works:** Pure Kafka consumer — no HTTP writes. Listens to events, builds timeline. Exposes read API.

**Consumes:**
- `order.created` → creates tracking record, adds CREATED to timeline
- `order.status.updated` → appends new status to timeline, updates `currentStatus`

**Kafka handler pattern:** Uses a `HANDLERS` map (`topic → function`) instead of if-else chains. Clean, extensible.

**Idempotent design:** `order.created` handler uses MongoDB `upsert` with `$setOnInsert` — safe to re-process if Kafka delivers the same message twice (at-least-once delivery).

**Key files:**
- [services/tracking-service/src/kafka/consumer.js](../services/tracking-service/src/kafka/consumer.js) — event handlers
- [services/tracking-service/src/models/Tracking.js](../services/tracking-service/src/models/Tracking.js) — Tracking schema with embedded timeline array

---

### 5. Notification Service (`services/notification-service/` — port 3004)

**Purpose:** Sends email notifications to customers when their order status changes.

**Consumes:** `order.status.updated`

**Emails sent on:**
- ASSIGNED — "Your order has been picked up by a delivery agent"
- PICKED_UP — package in hand
- OUT_FOR_DELIVERY — "Your package is out for delivery today"
- DELIVERED — "Your package has been delivered"
- CANCELLED — cancellation notice

Uses Nodemailer with Gmail SMTP. `customerEmail` carried in Kafka payload from order-service.

**Key files:**
- [services/notification-service/src/kafka/consumer.js](../services/notification-service/src/kafka/consumer.js)
- [services/notification-service/src/mailer/sendMail.js](../services/notification-service/src/mailer/sendMail.js)

---

### 6. Analytics Service (`services/analytics-service/` — port 3005)

**Purpose:** Records every order event for admin dashboard metrics.

**Consumes:** `order.created`, `order.status.updated`, `order.assigned`

**What it stores:** An `OrderEvent` document per Kafka message — orderId, customerId, agentId, event type, status, timestamp. Raw event log, not aggregated — aggregation happens at query time.

**Key files:**
- [services/analytics-service/src/kafka/consumer.js](../services/analytics-service/src/kafka/consumer.js)
- [services/analytics-service/src/models/OrderEvent.js](../services/analytics-service/src/models/OrderEvent.js)

---

## Kafka — Event-Driven Communication

**Why Kafka instead of direct HTTP between services?**

If order-service called tracking-service directly (HTTP), they'd be coupled — if tracking goes down, the status update fails. With Kafka: order-service publishes and forgets. Tracking/notification/analytics consume independently. Services can restart, lag behind, or fail — Kafka retains messages and they catch up.

**Topics and who uses them:**

| Topic | Published by | Consumed by |
|-------|-------------|-------------|
| `order.created` | order-service | tracking-service, analytics-service |
| `order.status.updated` | order-service | tracking-service, notification-service, analytics-service |
| `order.assigned` | order-service | analytics-service |

**Consumer groups:** Each service has its own group ID (`tracking-service-group`, `analytics-service-group`, etc.). Kafka tracks offset per group — each service reads all messages independently at its own pace.

**fromBeginning: false** — consumers only process messages published after they start. A fresh deploy won't reprocess all historical orders.

---

## Distributed Request ID Tracing

Every request gets a UUID at the gateway. That UUID travels everywhere:

```
Gateway stamps:        x-request-id: a9849579-a717-4cd1-ace2-2c036af5cf5f

Order service logs:    [order-service] x-request-id:a9849579... order created: <id>
                       (also embedded in Kafka payload)

Tracking logs:         [tracking] x-request-id:a9849579... order created: <id>

Analytics logs:        [analytics] x-request-id:a9849579... recorded: order.created
```

**Why it matters:** If a request fails silently somewhere in the chain, you grep that one UUID across all service logs. You see exactly where it entered, what each service did with it, and where it stopped. Without this, debugging distributed failures is guesswork.

---

## Database Design

Each service has its own MongoDB database. Services never share a database or query each other's data. The only cross-service communication is Kafka events and HTTP through the gateway.

| Service | Database | Collections |
|---------|----------|-------------|
| auth-service | `nexship-auth` | `users` |
| order-service | `nexship-orders` | `orders` |
| tracking-service | `nexship-tracking` | `trackings` |
| notification-service | `nexship-notifications` | `notificationlogs` |
| analytics-service | `nexship-analytics` | `orderevents` |

**Why separate DBs?** This is the microservices contract — no shared state. If you share a DB, services become coupled at the data layer even if they're separate processes. Schema changes in one service can break another.

---

## Testing

Jest integration tests covering the two most business-critical services.

**Auth Service — 18 tests:**
- Register: valid data, duplicate email, missing fields, invalid role, password length, response never leaks hashed password
- Login: valid credentials, wrong password, unknown email (same error — no enumeration), missing fields
- Refresh: valid rotation, replay attack detection (reused token → 401), invalid token, missing token
- Logout: token invalidated after logout, unknown token still returns 200, missing token → 400

**Order Service — 24 tests:**
- Create: CUSTOMER creates, AGENT/ADMIN blocked, validation (missing address, zero weight, negative weight)
- List: customer sees only own, admin sees all, agent sees only assigned
- Get single: owner fetch, cross-customer blocked, admin can access any, 404
- Assign: admin assigns, customer/agent blocked, double-assign blocked, missing agentId
- Status update: agent updates own, admin updates any, customer blocked, invalid transition with allowed list, full happy path ASSIGNED → DELIVERED, 404

**Test infrastructure:**
- `mongodb-memory-server` — real MongoDB in RAM, no Docker needed, auto-cleanup
- `supertest` — HTTP requests against Express app without a real port
- Rate limiting skipped in test env (`NODE_ENV=test`) so tests don't hit 429
- Kafka producer mocked in order-service tests — no Kafka needed

---

## Infrastructure

### Docker Compose

Local dev stack. All services, Kafka, Zookeeper, MongoDB in containers.

**Boot order enforced with health checks:**
```
Zookeeper → Kafka → MongoDB → [all services] → Gateway
```
Each `depends_on` uses `condition: service_healthy` — services only start after dependencies pass their health check. Not just "container started" — actually ready.

**Kafka topic auto-creation:** A `kafka-setup` one-shot container runs on boot, creates `order.created`, `order.status.updated`, `order.assigned` topics.

### Jenkins CI/CD

Pipeline stages: **Build → Test → Push → Deploy**

- Build: `docker build` for all 6 services + gateway
- Test: `npm ci && npm test` for each service (blocks deploy if tests fail)
- Push: images to DockerHub tagged with `BUILD_NUMBER` + `latest`
- Deploy: SSH into server, `docker-compose up -d --remove-orphans`

Secrets (DockerHub credentials, SSH key) stored in Jenkins Credentials Store — never hardcoded.

---

## Frontend

React + Vite app. Minimalist dark theme inspired by Google Classroom.

**Three role-based dashboards:**

**Customer view:**
- Place new order (form with origin/destination/package details)
- View order list with status badges
- Click order to see full tracking timeline

**Agent view:**
- See assigned orders
- Update order status through valid transitions

**Admin view:**
- See all orders
- Assign agents to orders
- Full platform visibility

**Auth flow:** Login → JWT stored in localStorage → sent as `Authorization: Bearer <token>` on every API call → gateway verifies → user identity flows to all services.

---

## Complete Project Structure

```
nexship/
├── docker-compose.yml              # Full local stack with health checks
├── Jenkinsfile                     # CI/CD pipeline
├── daily-updates/                  # Project logs
│   ├── day-1.md
│   └── architecture.md             # This file
│
├── gateway/                        # Port 3000 — single entry point
│   ├── Dockerfile
│   ├── package.json
│   ├── index.js                    # Request ID + auth middleware + proxy
│   └── src/
│       └── middleware/
│           └── auth.js             # JWT verification + header injection
│
├── services/
│   ├── auth-service/               # Port 3001 — register/login/tokens
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── jest.config.js
│   │   ├── index.js                # Server start (imports app.js)
│   │   ├── src/
│   │   │   ├── app.js              # Express app (testable, no server start)
│   │   │   ├── models/User.js
│   │   │   └── routes/auth.js      # register/login/refresh/logout
│   │   └── tests/
│   │       ├── setup.js            # Test env vars
│   │       └── auth.test.js        # 18 tests
│   │
│   ├── order-service/              # Port 3002 — order CRUD + Kafka producer
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── jest.config.js
│   │   ├── index.js
│   │   ├── src/
│   │   │   ├── app.js
│   │   │   ├── models/Order.js
│   │   │   ├── routes/orders.js    # All order endpoints
│   │   │   └── kafka/
│   │   │       └── producer.js     # publishEvent()
│   │   └── tests/
│   │       ├── setup.js
│   │       └── orders.test.js      # 24 tests
│   │
│   ├── tracking-service/           # Port 3003 — timeline from Kafka events
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── index.js
│   │   └── src/
│   │       ├── models/Tracking.js  # { orderId, currentStatus, timeline[] }
│   │       ├── routes/tracking.js  # GET /tracking/:orderId
│   │       └── kafka/
│   │           └── consumer.js     # Handles order.created + order.status.updated
│   │
│   ├── notification-service/       # Port 3004 — email via Nodemailer
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── index.js
│   │   └── src/
│   │       ├── mailer/sendMail.js  # Gmail SMTP
│   │       └── kafka/
│   │           └── consumer.js     # Sends email on status changes
│   │
│   └── analytics-service/          # Port 3005 — event log for admin metrics
│       ├── Dockerfile
│       ├── package.json
│       ├── index.js
│       └── src/
│           ├── models/OrderEvent.js
│           ├── routes/analytics.js
│           └── kafka/
│               └── consumer.js     # Records every order event
│
└── frontend/                       # React + Vite, port 5173
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── pages/
            ├── Login.jsx
            ├── CustomerDashboard.jsx
            ├── AgentDashboard.jsx
            └── AdminDashboard.jsx
```

---

## What's Left

| Item | Status | Notes |
|------|--------|-------|
| Auth Service | Done | Tests included |
| Order Service | Done | Tests included |
| Tracking Service | Done | No tests yet |
| Notification Service | Done | No tests yet |
| Analytics Service | Done | No tests yet |
| API Gateway | Done | |
| Docker Compose | Done | |
| Frontend | Done (basic) | UI can be improved |
| Rate Limiting | Done | Auth service only |
| Request ID Tracing | Done | End-to-end verified |
| Jest Tests | Done | 42 tests, auth + order |
| Jenkins CI/CD | Done | Test stage pending wire-up |
| Kubernetes | Skipped | Not in scope for now |
| README | Not started | |
| Prometheus + Grafana | Not started | Last priority |
