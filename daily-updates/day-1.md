# NexShip — Day 1 Progress Log
**Date:** 2026-05-09

---

## Summary

Today you kicked off **NexShip** — a microservices-based shipment tracking platform built for your portfolio. You set up the full infrastructure with Docker Compose (Kafka, Zookeeper, MongoDB, all wired with health checks), wrote a Jenkins CI/CD pipeline covering all 6 planned services, built a production-grade **Auth Service** with JWT access/refresh tokens, refresh token rotation, replay attack detection, and anti-enumeration login security, and wired up an **API Gateway** that verifies JWTs and injects user identity headers so downstream services don't have to. Solid foundation — auth and infrastructure done, core business services up next.

---

## What Was Built Today

### 1. Infrastructure Layer

#### Docker Compose (`docker-compose.yml`)
- Orchestrates the full local dev stack: **Zookeeper → Kafka → MongoDB → auth-service → gateway**
- Every service has a proper `healthcheck` so Docker knows when it's genuinely ready
- `depends_on` uses `condition: service_healthy` — services only boot after their dependencies pass health checks (not just "started")
- MongoDB data persisted via a named volume `mongo-data`
- Services: Zookeeper (2181), Kafka (9092), MongoDB (27017), auth-service (3001), gateway (3000)

#### CI/CD Pipeline (`Jenkinsfile`)
- Full Jenkins pipeline with 4 stages: **Build → Test → Push → Deploy**
- Covers all 6 services: `auth-service`, `order-service`, `tracking-service`, `notification-service`, `analytics-service`, `gateway`
- Uses Jenkins credentials for DockerHub login and SSH deploy key (secrets never hardcoded)
- Each build tagged with `BUILD_NUMBER` + also tagged `latest`
- Deploy stage SSHes into the remote host and runs `docker-compose up -d --remove-orphans`

---

### 2. Auth Service (`services/auth-service` — port 3001)

Full JWT-based authentication service with refresh token rotation.

#### Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/register` | Register new user with role |
| POST | `/auth/login` | Login, returns token pair |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Invalidate refresh token |
| GET  | `/health` | Docker health check |

#### Security decisions made (and why)
- **bcrypt cost factor 12** — higher cost = slower brute force; 12 is the production sweet spot between security and latency
- **Dual JWT secrets** (`JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET`) — separate secrets mean a compromised access token doesn't expose the refresh token
- **Access token: 15min TTL** — short-lived so a stolen token expires fast
- **Refresh token: 7d TTL** — long enough for UX, stored in DB so it can be revoked
- **Refresh token rotation** — every `/refresh` call issues a brand new token pair and invalidates the old one; if an old token is reused, the system detects a replay attack and nukes the entire session
- **Anti-enumeration on login** — same `"Invalid credentials"` error whether the email doesn't exist OR the password is wrong; prevents attackers from harvesting valid emails
- **Logout always returns 200** — doesn't reveal whether the token existed in the DB

---

### 3. API Gateway (`gateway` — port 3000)

Single entry point for all client traffic. All requests pass through here before reaching any service.

#### What it does
- **JWT verification middleware** — validates `Authorization: Bearer <token>` on every request
- **Public path bypass** — `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /health` skip auth (they don't need a token to get a token)
- **Identity propagation** — on successful verification, injects `x-user-id` and `x-user-role` headers into the proxied request so downstream services get identity for free without re-verifying JWT
- Proxy routing to auth-service; stubs ready for remaining services

#### Why a gateway pattern?
- Single place to enforce auth, rate limiting, and request tracing — downstream services stay simple
- Downstream services trust `x-user-id` / `x-user-role` headers (internal network only — never exposed externally)

---

## Current Project Structure

```
nexship/
├── docker-compose.yml          # Full local stack
├── Jenkinsfile                 # CI/CD pipeline
├── gateway/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   └── src/
│       └── middleware/
│           └── auth.js         # JWT verification + header injection
└── services/
    └── auth-service/
        ├── Dockerfile
        ├── package.json
        ├── index.js            # Express app + MongoDB connect
        ├── .env.example
        └── src/
            ├── models/
            │   └── User.js
            ├── middleware/
            │   └── authMiddleware.js
            └── routes/
                └── auth.js     # All auth endpoints
```

---

## What's Missing — Next Steps

### Tier 1 — Core Business Logic (Priority)
These services are referenced in the Jenkinsfile but not built yet:

| Service | Purpose | Key Tech |
|---------|---------|----------|
| `order-service` | Create/manage shipment orders | Express + MongoDB |
| `tracking-service` | Real-time shipment location updates | Express + Kafka consumer |
| `notification-service` | Email/SMS alerts on status changes | Kafka consumer + Nodemailer/Twilio |
| `analytics-service` | Dashboard metrics (deliveries, delays) | Kafka consumer + MongoDB aggregations |

**`order-service` is the top priority** — it's the core of NexShip. Nothing ships without it.

### Tier 2 — Production Hardening
- **Rate limiting** on auth endpoints (`express-rate-limit`) — prevent brute force
- **Request ID tracing** — inject `x-request-id` at gateway, propagate through all services for distributed log correlation
- **Centralized logging** — structured JSON logs, ELK stack or Grafana Loki
- **Kafka event flow** — order-service publishes events → tracking/notification/analytics consume them (key distributed systems story)
- **Jest test suites** — Jenkinsfile runs `npm test` but no tests exist yet

### Tier 3 — Portfolio Polish
- `README.md` with architecture diagram, startup guide, and tech decision notes
- **Kubernetes manifests** — replace docker-compose for massive resume upgrade
- **Prometheus + Grafana** monitoring stack

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + Express |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | express-validator |
| Database | MongoDB + Mongoose |
| Messaging | Apache Kafka (Confluent) |
| Containerization | Docker + Docker Compose |
| CI/CD | Jenkins |
| Secrets | Jenkins Credentials Store |

---

## Build Plan — What's Coming Next

### Phase 1 — Backend Services (in order)

**Step 1: Order Service**
- Define Order schema (MongoDB) — orderId, customerId, agentId, origin, destination, status, timestamps
- Build REST endpoints — create order, get order, list orders (role-filtered), update status
- Publish Kafka event on every status change (`order.status.updated` topic)

**Step 2: Kafka Topics**
- Create topics: `order.status.updated`, `order.created`, `order.assigned`
- Add Kafka producer to order-service
- Update docker-compose to auto-create these topics on startup

**Step 3: Tracking Service**
- Kafka consumer — listens to `order.status.updated`
- Stores location + status history in MongoDB
- REST endpoint — get full tracking timeline for an order

**Step 4: Notification Service**
- Kafka consumer — listens to `order.status.updated`
- Sends email via Nodemailer on key status changes (Created, Out for Delivery, Delivered)

**Step 5: Analytics Service**
- Kafka consumer — aggregates all events
- Endpoints for admin dashboard — total orders, delivery rate, avg delivery time, delays

---

### Phase 2 — Frontend (after all backend done)
- React app — 3 dashboards (Customer / Agent / Admin)
- Connects to gateway, handles JWT auth flow

---

### Phase 3 — Hardening
- Rate limiting, request tracing, Jest tests, Kubernetes manifests
