# Snip.ly — Agent Briefing & Document Index
**Version:** 1.0 | **April 2026** | **Author:** Basit Ali

This is the entry point for the AI agent building Snip.ly. Read this document first, then read all referenced documents in full before writing a single line of code.

---

## What You Are Building

Snip.ly is a high-performance URL shortener with a real-time analytics dashboard. It is not a tutorial project. The defining feature is a live WebSocket dashboard that streams click events the moment they happen anywhere in the world — no polling, no page refresh.

**The one rule that overrides everything else:** The real-time WebSocket dashboard must ship. If time or complexity forces a trade-off, cut QR codes or CSV export. Never cut the dashboard.

---

## Document Index

You have four specification documents. All of them must be read before implementation begins. They are not optional reading.

| Document | Purpose | Read When |
|---|---|---|
| **This file** (AGENT_BRIEFING.md) | Entry point, reading order, build sequence | First |
| **PRD.md** | What to build, why, success metrics, scope | Second |
| **SYSTEM_DESIGN.md** | How to architect it — stack, data layer, flows | Third |
| **API_CONTRACTS.md** | Every endpoint, request/response shape, error codes | Fourth |
| **IMPLEMENTATION_RULES.md** | Hard constraints the agent must follow during build | Fifth, then keep open |

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| API Server | Fastify (Node.js / TypeScript) |
| Frontend | Next.js 14, App Router |
| Database | PostgreSQL via Supabase |
| Cache + Queue | Redis via Upstash + BullMQ |
| WebSocket | @fastify/websocket |
| Deployment | Render (API + Frontend) or Vercel (Frontend) |

---

## Monorepo Structure

```
/snip.ly
├── packages/
│   ├── api/        ← Fastify API server
│   └── frontend/   ← Next.js frontend
├── .env.example
└── README.md
```

Never merge these two packages. They are separately deployable. Next.js has no API routes — all backend logic lives in the Fastify package.

---

## Build Sequence

Follow this sequence exactly. Do not skip phases or build features out of order.

### Phase 1 — Foundation
- [ ] Monorepo setup (npm workspaces, tsconfig, shared types)
- [ ] Fastify app scaffolding (`app.ts`, `server.ts`, `config.ts`)
- [ ] Environment variable validation at startup (zod)
- [ ] PostgreSQL plugin + Supabase connection
- [ ] Redis plugin + Upstash connection
- [ ] Run database migrations (create `links`, `click_events` tables)
- [ ] `base62.ts` utility + unit tests
- [ ] `hash.ts` utility (SHA-256 + bcrypt) + unit tests

### Phase 2 — Core Redirect Path (the hot path)
- [ ] `POST /api/shorten` — create link, write to DB, populate Redis cache
- [ ] `GET /:code` — redirect route, Redis-first, cache miss fallback, 302 response
- [ ] BullMQ queue setup (`clickQueue`)
- [ ] Click worker (`clickWorker.ts`) — geo lookup, unique detection, DB write
- [ ] Auth middleware (Bearer JWT validation hook)
- [ ] Rate limiting middleware (Redis-backed, 10 shortens/min)

### Phase 3 — Link Management API
- [ ] `GET /api/links` — paginated list
- [ ] `GET /api/links/:code` — single link detail
- [ ] `GET /api/links/:code/stats` — analytics with date range
- [ ] `PATCH /api/links/:code` — update + cache invalidation
- [ ] `DELETE /api/links/:code` — delete + Redis DEL

### Phase 4 — Real-Time Dashboard (do not skip)
- [ ] WebSocket server (`@fastify/websocket`)
- [ ] Room subscription model (`rooms` Map)
- [ ] `wsEmitter` EventEmitter connecting BullMQ worker to WS layer
- [ ] Click worker emits `click_event` after DB write
- [ ] `link_updated` and `link_deleted` WS events on PATCH/DELETE
- [ ] Next.js `useWebSocket.ts` hook with reconnect logic
- [ ] `LiveClickFeed.tsx` component
- [ ] Dashboard page consuming live events

### Phase 5 — Frontend Pages
- [ ] Landing page + shorten form
- [ ] Dashboard page (link list + live feed)
- [ ] Single link detail page (stats + chart)
- [ ] Password-entry page (`/enter-password/:code`)
- [ ] Privacy page (`/privacy`)

### Phase 6 — Remaining Features
- [ ] `GET /qr/:code` — QR code generation (PNG + SVG)
- [ ] Password-protected links (bcrypt verify flow)
- [ ] Link expiry enforcement (worker check + Redis TTL)
- [ ] Max-click limit enforcement (worker check + deactivation)

### Phase 7 — Hardening
- [ ] `@fastify/helmet` — HTTP security headers
- [ ] CORS restricted to `FRONTEND_URL`
- [ ] Global error handler (no stack traces to client)
- [ ] Structured logging verified (no raw IPs in any log)
- [ ] All integration tests passing
- [ ] `.env.example` complete and committed

---

## Critical Constraints Snapshot

These are the most important rules from `IMPLEMENTATION_RULES.md`. Full rules are in that document.

**Security — absolute:**
- Never store or log a raw IP address. SHA-256 hash only.
- Link passwords stored as bcrypt hash (cost factor 12).
- HTTPS only in production. `trustProxy: true` on Render.

**Architecture — absolute:**
- Redirect is always `302`, never `301`.
- The click queue job is never `await`ed in the redirect route.
- No database or Redis calls in route handlers — go through services.
- No Next.js API routes — all backend logic in Fastify.

**TypeScript — absolute:**
- `strict: true`. No `any`. No untyped external API responses.

**Redis budget:**
- Redirect hot path: 1 Redis command (`HGETALL`).
- Click worker: max 4 Redis commands per click.
- Stay within 10,000 commands/day on Upstash free tier.

---

## Definition of Done

The project is complete when all of the following are true:

- `GET /:code` returns a 302 in under 5ms on a Redis cache hit (measured by `X-Response-Time` header).
- A click on any short URL appears in the live WebSocket dashboard within 500ms.
- `POST /api/shorten` creates a link, and the short URL immediately redirects correctly.
- Custom slugs, expiry, max-click limits, and password protection all work end-to-end.
- No raw IP address appears in the database, Redis, or any log line.
- All required tests from `IMPLEMENTATION_RULES.md §14` are passing.
- `.env.example` is committed and documents every required variable.
- The app deploys successfully to Render (API) and Render or Vercel (frontend).

---

*Snip.ly Agent Briefing v1.0 — April 2026*
