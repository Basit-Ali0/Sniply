# Snip.ly — System Design Document
**Version:** 1.0 | **April 2026** | **Author:** Basit Ali

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Component Breakdown](#3-component-breakdown)
4. [Data Layer](#4-data-layer)
5. [Redis Architecture](#5-redis-architecture)
6. [Async Click Pipeline](#6-async-click-pipeline)
7. [WebSocket Architecture](#7-websocket-architecture)
8. [Request Flows](#8-request-flows)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Scalability Notes](#10-scalability-notes)

---

## 1. Architecture Overview

Snip.ly is split into two independently deployed services:

- **API Server** — Fastify. Handles all REST endpoints, the redirect hot path, WebSocket connections, and the BullMQ worker process.
- **Frontend** — Next.js. Serves the dashboard UI, the password-entry page, and the QR/link preview pages.

Both services are stateless. All shared state lives in PostgreSQL (Supabase) and Redis (Upstash).

```
┌─────────────────────────────────────────────────────┐
│                      Client                         │
│         Browser / API Consumer / CLI                │
└──────────┬──────────────────────┬───────────────────┘
           │ REST / WS            │ Page requests
           ▼                      ▼
┌─────────────────┐    ┌─────────────────────┐
│  Fastify API    │    │    Next.js Frontend  │
│  (Render)       │    │    (Render / Vercel) │
└────────┬────────┘    └─────────────────────┘
         │
    ┌────┴────────────────┐
    │                     │
    ▼                     ▼
┌────────────┐     ┌────────────────┐
│  Supabase  │     │  Upstash Redis │
│ PostgreSQL │     │  Cache + Queue │
└────────────┘     └────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| API Server | **Fastify** | Faster than Express, schema-based validation, plugin ecosystem |
| Frontend | **Next.js 14 (App Router)** | Server components, built-in routing, easy Vercel deploy |
| Database | **PostgreSQL via Supabase** | Relational, BIGSERIAL for Base62, free tier (500MB) |
| Cache + Queue | **Redis via Upstash** | Serverless Redis, BullMQ compatible, free tier (10k cmds/day) |
| Job Queue | **BullMQ** | Built on Redis, retry logic, delay support, worker model |
| WebSocket | **Fastify WebSocket plugin** (`@fastify/websocket`) | Native WS within the Fastify server, no separate process |
| Geo IP | **ip-api.com** | Free tier, 45 req/min, country-level resolution |
| QR Codes | **qrcode** (npm) | Lightweight, PNG + SVG output, no external service |
| Auth | **Supabase OAuth (JWT)** | Secure, session-based auth using Supabase Auth (GitHub, Google, etc.) |
| Hashing | **bcrypt** (passwords), **SHA-256** (IPs) | bcrypt for safe password comparison; SHA-256 for IP anonymisation |
| Logging | **Pino** (built into Fastify) | Structured JSON logs, fast, zero config |

---

## 3. Component Breakdown

### 3.1 Fastify API Server

```
packages/api
├── src/
│   ├── app.ts                  # Fastify instance, plugin registration
│   ├── server.ts               # Entry point — listen on PORT
│   ├── config.ts               # Env vars, validated at startup
│   ├── plugins/
│   │   ├── redis.ts            # Upstash Redis client (ioredis)
│   │   ├── postgres.ts         # Supabase postgres client (@supabase/supabase-js or pg)
│   │   ├── bullmq.ts           # Queue + Worker registration
│   │   └── websocket.ts        # @fastify/websocket setup
│   ├── routes/
│   │   ├── redirect.ts         # GET /:code — hot path
│   │   ├── shorten.ts          # POST /api/shorten
│   │   ├── links.ts            # GET/PATCH/DELETE /api/links/*
│   │   ├── stats.ts            # GET /api/links/:code/stats
│   │   ├── qr.ts               # GET /qr/:code
│   │   └── ws.ts               # WebSocket /ws
│   ├── workers/
│   │   └── clickWorker.ts      # BullMQ worker — processes click events
│   ├── services/
│   │   ├── linkService.ts      # Link CRUD, cache invalidation
│   │   ├── clickService.ts     # Click event DB writes
│   │   ├── geoService.ts       # ip-api.com lookup + Redis cache
│   │   └── qrService.ts        # QR code generation
│   ├── middleware/
│   │   ├── auth.ts             # Bearer JWT validation hook
│   │   └── rateLimit.ts        # Redis-backed rate limiter (user_id)
│   └── utils/
│       ├── base62.ts           # encode(id) → short code
│       ├── hash.ts             # sha256(ip), bcrypt helpers
│       └── errors.ts           # Typed error factory
```

### 3.2 Next.js Frontend

```
packages/frontend
├── app/
│   ├── layout.tsx
│   ├── page.tsx                # Landing + shorten form
│   ├── dashboard/
│   │   └── page.tsx            # Link list + live stats dashboard
│   ├── links/
│   │   └── [code]/
│   │       └── page.tsx        # Single link detail + analytics
│   ├── enter-password/
│   │   └── [code]/
│   │       └── page.tsx        # Password entry gate for protected links
│   └── privacy/
│       └── page.tsx            # GDPR disclosure page
├── components/
│   ├── ShortenForm.tsx
│   ├── LinkCard.tsx
│   ├── LiveClickFeed.tsx       # WebSocket consumer — real-time event list
│   ├── StatsChart.tsx          # Hourly breakdown chart
│   ├── GeoMap.tsx              # Country click map
│   └── QRModal.tsx
├── hooks/
│   └── useWebSocket.ts         # WS connection manager with reconnect logic
└── lib/
    └── api.ts                  # Typed fetch wrapper for Fastify API
```

---

## 4. Data Layer

### 4.1 PostgreSQL Schema

```sql
-- Links table
CREATE TABLE links (
  id            BIGSERIAL PRIMARY KEY,           -- Source for Base62 code
  code          TEXT NOT NULL UNIQUE,            -- Base62 encoded id OR custom slug
  long_url      TEXT NOT NULL,                   -- Max 2048 chars enforced in app
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = anonymous link
  active        BOOLEAN NOT NULL DEFAULT true,
  click_count   BIGINT NOT NULL DEFAULT 0,       -- Denormalized, updated by worker
  expiry_at     TIMESTAMPTZ,                     -- NULL = no expiry
  max_clicks    INTEGER,                         -- NULL = no limit
  password_hash TEXT,                            -- bcrypt hash, NULL = no password
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_links_code ON links(code);
CREATE INDEX idx_links_user_id ON links(user_id);
CREATE INDEX idx_links_active ON links(active);

-- Click events table
CREATE TABLE click_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id     BIGINT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  clicked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  referrer    TEXT,           -- NULL = direct traffic
  country     CHAR(2),        -- ISO 3166-1 alpha-2, NULL if geo lookup fails
  user_agent  TEXT,
  ip_hash     TEXT NOT NULL   -- SHA-256 of raw IP — raw IP never stored
);

CREATE INDEX idx_click_events_link_id ON click_events(link_id);
CREATE INDEX idx_click_events_clicked_at ON click_events(clicked_at);
CREATE INDEX idx_click_events_link_time ON click_events(link_id, clicked_at);
```

### 4.2 Base62 Encoding

Short codes are derived deterministically from the PostgreSQL `BIGSERIAL` primary key. No random generation. No collision possible by construction.

```
Alphabet: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789

DB ID 1       → "a"
DB ID 62      → "B"
DB ID 1,000   → "qi"
DB ID 1,000,000 → "4c92"
```

Custom slugs bypass this encoding and are stored directly in the `code` column. Collision with an existing code is checked at write time (unique constraint on `links.code`).

### 4.3 Unique Click Detection

Raw IPs are never stored. To determine unique clicks, the worker computes `SHA-256(raw_ip + link_id + YYYY-MM-DD)` and checks a Redis SET per link per day:

```
Key:   uniq:{link_id}:{YYYY-MM-DD}
Type:  Redis SET
TTL:   48 hours
Value: SHA-256(raw_ip + link_id + YYYY-MM-DD)
```

If `SADD` returns 1 → new unique visitor. If 0 → already seen today.

---

## 5. Redis Architecture

### 5.1 Key Schema

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `link:{code}` | Hash | Matches `expiry_at` or indefinite | Redirect hot path cache |
| `geo:{ip_hash}` | String | 24 hours | Cached country lookup per IP hash |
| `uniq:{link_id}:{date}` | Set | 48 hours | Unique click tracking per link per day |
| `rl:{user_id}:{minute}` | String (INCR) | 60 seconds | Rate limiting — 10 shortens/min |
| `bull:{queue}:*` | BullMQ internal | Managed by BullMQ | Job queue state |

### 5.2 Redirect Cache Entry

```
HSET link:x9k2p
  long_url      "https://github.com/Basit-Ali0/secure-share"
  active        "1"
  password_hash ""          ← empty string means no password
  expiry_at     "1767225599" ← unix timestamp, 0 = no expiry
  max_clicks    "1000"      ← 0 = no limit
  click_count   "482"
```

On redirect, a single `HGETALL link:{code}` returns all necessary fields. No DB query on cache hit.

### 5.3 Cache Invalidation Rules

| Trigger | Action |
|---|---|
| `PATCH /api/links/:code` | `DEL link:{code}` immediately |
| `DELETE /api/links/:code` | `DEL link:{code}` immediately |
| Link deactivated (`active = false`) | `DEL link:{code}` immediately |
| `max_clicks` reached (worker) | `DEL link:{code}` immediately |
| `expiry_at` passed (worker check) | `DEL link:{code}` immediately |

The next redirect after a DEL is a cache miss. The route handler re-fetches from PostgreSQL and re-populates the cache.

---

## 6. Async Click Pipeline

The redirect route **never waits for a database write**. Click metadata is enqueued to BullMQ immediately after the 302 response is sent.

```
Browser
  │
  │  GET /x9k2p
  ▼
Fastify redirect route
  │
  ├─► HGETALL link:x9k2p  (Redis, ~1ms)
  │
  ├─► 302 Found → Location header  ◄── Response sent here. User is already redirected.
  │
  └─► Queue.add('click', { code, ip, referrer, userAgent })  (BullMQ, async)
            │
            ▼
      BullMQ Worker (same process, separate async context)
            │
            ├─► SHA-256(raw_ip + link_id + YYYY-MM-DD)
            ├─► SADD uniq:{link_id}:{date}  → is_unique
            ├─► GET geo:{ip_hash} OR ip-api.com lookup → country
            ├─► INSERT INTO click_events (...)
            ├─► UPDATE links SET click_count = click_count + 1
            ├─► Emit click_event via WebSocket to subscribed clients
            └─► Done
```

**BullMQ retry policy:** 3 attempts, exponential backoff starting at 1 second. Failed jobs after 3 attempts are moved to the dead-letter queue for manual inspection.

---

## 7. WebSocket Architecture

One WebSocket server runs inside the Fastify process via `@fastify/websocket`. Clients connect once per dashboard session.

### 7.1 Room Model

Each short code is a "room". The server maintains an in-memory Map of subscriptions:

```typescript
// In-memory subscription map (per process)
const rooms = new Map<string, Set<WebSocket>>();
// rooms.get('x9k2p') → Set of connected WebSocket clients subscribed to this code
```

### 7.2 Event Flow

```
BullMQ Worker finishes processing click
  │
  └─► wsEmitter.emit('click_event', { code, ...payload })
            │
            ▼
      WebSocket route handler
            │
            └─► rooms.get(code)?.forEach(client => client.send(JSON.stringify(payload)))
```

### 7.3 Connection Lifecycle

```
Client connects → wss://api.snip.ly/ws?token=eyJ...
  │
  ├─► Validate JWT token via Supabase → 401 close if invalid
  ├─► Connection accepted
  │
  ├─► Client sends: { type: "subscribe", code: "x9k2p" }
  │       └─► Verify code belongs to user
  │       └─► rooms.get('x9k2p').add(socket)
  │       └─► Send: { type: "subscribed", current_stats: { ... } }
  │
  ├─► [click events stream in as they are processed]
  │
  ├─► Client sends: { type: "unsubscribe", code: "x9k2p" }
  │       └─► rooms.get('x9k2p').delete(socket)
  │
  └─► On disconnect → remove socket from all rooms it was in
```

---

## 8. Request Flows

### 8.1 Redirect — Cache Hit (Hot Path)

```
GET /x9k2p
  └─► HGETALL link:x9k2p                    [Redis ~1ms]
        └─► active=1, not expired, no password
              └─► 302 → long_url             [Total: <5ms]
                    └─► Queue click job      [Async, non-blocking]
```

### 8.2 Redirect — Cache Miss

```
GET /x9k2p
  └─► HGETALL link:x9k2p                    [Redis: nil]
        └─► SELECT * FROM links WHERE code='x9k2p'  [Supabase ~15ms]
              └─► HSET link:x9k2p { ... }   [Redis: re-populate cache]
                    └─► 302 → long_url       [Total: <30ms]
                          └─► Queue click job [Async]
```

### 8.3 Create Short Link

```
POST /api/shorten
  ├─► Validate Bearer JWT → auth.users
  ├─► Validate request body (Fastify schema)
  ├─► Check Safe Browsing (if URL_BLOCKED list — v1: blocklist in env)
  ├─► INSERT INTO links (long_url, user_id, expiry_at, max_clicks, password_hash)
  │     RETURNING id
  ├─► base62encode(id) → code  (or use custom slug, check uniqueness)
  ├─► UPDATE links SET code = ? WHERE id = ?
  ├─► HSET link:{code} { ... }              [Populate cache immediately]
  └─► 201 { code, short_url, qr_url, ... }
```

### 8.4 Password-Protected Redirect

```
GET /x9k2p
  └─► HGETALL link:x9k2p → password_hash is set
        └─► 302 → /enter-password/x9k2p    [Frontend page]
              └─► User submits password
                    └─► POST /api/links/x9k2p/unlock { password }
                          └─► bcrypt.compare(password, hash)
                                └─► 200 { long_url }  [Frontend redirects client-side]
```

> Note: `/api/links/:code/unlock` is an implied internal endpoint used by the password page. It is not in the public API contracts as it is frontend-only.

---

## 9. Infrastructure & Deployment

### 9.1 Services

| Service | Provider | Free Tier Limit |
|---|---|---|
| API Server (Fastify) | Render | 750 hrs/month, spins down after 15 min inactivity |
| Frontend (Next.js) | Render or Vercel | Static + SSR, free tier |
| PostgreSQL | Supabase | 500MB storage, 2 CPU |
| Redis | Upstash | 10,000 commands/day |

### 9.2 Environment Variables

**API Server (.env)**

```
DATABASE_URL=postgresql://...         # Supabase connection string
SUPABASE_URL=https://...              # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=...         # Supabase service role key
REDIS_URL=redis://...                 # Upstash Redis URL
REDIS_TOKEN=...                       # Upstash auth token
PORT=3001
NODE_ENV=production
GEOIP_API_URL=http://ip-api.com/json  # Base URL for geo lookups
FRONTEND_URL=https://snip.ly          # For CORS origin
```

**Frontend (.env.local)**

```
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=https://api.snip.ly
NEXT_PUBLIC_WS_URL=wss://api.snip.ly/ws
```

### 9.3 CORS Policy

The Fastify API allows CORS only from `FRONTEND_URL` in production. All `/api/*` routes are CORS-enabled. The redirect route (`GET /:code`) and QR route are public and do not require CORS headers.

### 9.4 Render Spin-Down Behaviour

Render free tier spins the API server down after 15 minutes of inactivity. The first redirect after a cold start will be slow (~3–5 seconds). This is acceptable for a portfolio project. A UptimeRobot ping every 14 minutes can prevent spin-down if desired.

---

## 10. Scalability Notes

The current architecture is deliberately sized for free-tier constraints. The following migration paths are documented for reference.

| Bottleneck | Current Solution | Scale-Up Path |
|---|---|---|
| Redis command budget | 10k/day Upstash free tier | Upgrade Upstash plan or self-host Redis |
| Click event throughput | BullMQ on single process | Migrate queue to Kafka, run workers separately |
| DB write throughput | Single Supabase instance | Read replicas, connection pooling via PgBouncer |
| WebSocket connections | In-memory room Map (single process) | Migrate to Redis pub/sub for multi-process WS fan-out |
| Geo IP rate limit | 45 req/min ip-api.com, cached 24h | Self-host MaxMind GeoLite2 database |

---

*Snip.ly System Design v1.0 — April 2026*
