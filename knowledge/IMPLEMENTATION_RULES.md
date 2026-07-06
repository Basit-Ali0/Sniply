# Snip.ly — Implementation Rules
**Version:** 1.0 | **April 2026** | **Author:** Basit Ali

These rules are non-negotiable constraints for the agent building this project. Every decision made during implementation must be consistent with these rules. When in doubt, stop and re-read this document before proceeding.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Naming Conventions](#2-naming-conventions)
3. [TypeScript Rules](#3-typescript-rules)
4. [Fastify Rules](#4-fastify-rules)
5. [Next.js Rules](#5-nextjs-rules)
6. [Database Rules](#6-database-rules)
7. [Redis Rules](#7-redis-rules)
8. [Security Rules](#8-security-rules)
9. [Error Handling](#9-error-handling)
10. [Async & Queue Rules](#10-async--queue-rules)
11. [WebSocket Rules](#11-websocket-rules)
12. [Environment & Config](#12-environment--config)
13. [Logging Rules](#13-logging-rules)
14. [Testing Expectations](#14-testing-expectations)
15. [What the Agent Must Never Do](#15-what-the-agent-must-never-do)

---

## 1. Project Structure

The repository is a monorepo with two packages. Do not merge them into a single process or a single Next.js app with API routes.

```
/snip.ly                      ← monorepo root
├── package.json              ← workspace root (npm workspaces)
├── packages/
│   ├── api/                  ← Fastify API server
│   └── frontend/             ← Next.js frontend
├── .env.example              ← committed, shows all required vars with placeholders
├── .gitignore
└── README.md
```

**Rule:** The Fastify API and Next.js frontend are two separate deployable units. Never use Next.js API routes for any backend logic. All backend logic lives in the Fastify `packages/api` package.

---

## 2. Naming Conventions

### Files & Folders

| Context | Convention | Example |
|---|---|---|
| Fastify route files | camelCase | `shorten.ts`, `links.ts` |
| Fastify service files | camelCase | `linkService.ts`, `geoService.ts` |
| Next.js components | PascalCase | `LinkCard.tsx`, `LiveClickFeed.tsx` |
| Next.js hooks | camelCase prefixed `use` | `useWebSocket.ts` |
| Next.js pages | Next.js convention (`page.tsx`) | `app/dashboard/page.tsx` |
| Utility files | camelCase | `base62.ts`, `hash.ts` |
| Config files | camelCase | `config.ts` |

### Variables & Functions

| Context | Convention | Example |
|---|---|---|
| Variables | camelCase | `linkCode`, `clickCount` |
| Functions | camelCase | `encodeBase62()`, `hashIp()` |
| Classes | PascalCase | `LinkService` |
| Constants | UPPER_SNAKE_CASE | `MAX_CLICKS_DEFAULT`, `REDIS_TTL_GEO` |
| TypeScript interfaces | PascalCase | `Link`, `ClickEvent`, `ApiResponse` |
| TypeScript types | PascalCase | `ShortCode`, `IsoTimestamp` |
| Redis keys | lowercase with colons | `link:x9k2p`, `geo:{ip_hash}` |
| API response fields | snake_case | `short_url`, `created_at`, `max_clicks` |
| Environment variables | UPPER_SNAKE_CASE | `DATABASE_URL`, `REDIS_TOKEN` |

---

## 3. TypeScript Rules

- **Strict mode is on.** `tsconfig.json` must have `"strict": true`. No exceptions.
- **No `any`.** Never use `any`. Use `unknown` and narrow the type, or define a proper interface.
- **No type assertions unless unavoidable.** If you use `as SomeType`, add a comment explaining why narrowing was not possible.
- **All function parameters and return types must be explicitly typed.** Do not rely on inference for public-facing functions.
- **Database query results must be typed.** Define the return shape and cast at the query boundary, not mid-function.
- **External API responses (ip-api.com, etc.) must be typed with an interface.** Never access properties on an untyped response object.

```typescript
// ✅ Correct
interface GeoResponse {
  status: 'success' | 'fail';
  countryCode: string;
}

// ❌ Wrong
const geo = await fetchGeo(ip);
return geo.countryCode; // geo is any — not allowed
```

---

## 4. Fastify Rules

### Plugin Registration

- Register all plugins in `app.ts` in this exact order: config → postgres → redis → bullmq → websocket → auth hook → rate limit hook → routes.
- Every plugin must be wrapped in `fastify-plugin` (`fp()`) if it decorates the Fastify instance.
- Do not register route-level plugins globally. Scope them to their route file.

### Route Schema

- Every route must have a Fastify JSON schema for request body, query params, and response shape.
- Schema validation is the first line of defence. Do not perform manual input validation that duplicates the schema.
- Response schemas must be defined for all 2xx responses. This enables Fastify's fast-json-stringify serialisation.

```typescript
// ✅ Correct — schema defined on the route
fastify.post('/api/shorten', {
  schema: {
    body: shortenBodySchema,
    response: { 201: shortenResponseSchema }
  }
}, handler);
```

### Auth Hook

- The auth hook (`preHandler`) must be registered on all `/api/*` routes using a Fastify scope, not per-route.
- The public redirect route (`GET /:code`) and QR route (`GET /qr/:code`) must be explicitly excluded from auth.
- Auth failure must return the exact error shape defined in the API Contracts: `{ error: "UNAUTHORIZED", message: "..." }`.

### Route Handlers

- Handlers must be thin. All business logic goes in service files under `src/services/`.
- A route handler should: validate (schema does this), call a service, return the result. Nothing more.
- Do not access the database or Redis directly from a route handler. Always go through a service.

---

## 5. Next.js Rules

### App Router Only

- Use the App Router exclusively (`app/` directory). Do not create anything in `pages/`.
- All data fetching for server-rendered pages uses `fetch()` inside Server Components with appropriate `cache` options.
- Client components (`'use client'`) are only used when browser APIs (WebSocket, event listeners, state) are required.

### API Communication

- All calls to the Fastify API go through `lib/api.ts`. Never call `fetch()` directly from a component.
- `lib/api.ts` must be a typed wrapper that throws typed errors on non-2xx responses.
- `NEXT_PUBLIC_API_URL` is the only allowed base URL for API calls. Never hardcode `localhost` or a production URL.

### WebSocket

- The WebSocket connection is managed by `hooks/useWebSocket.ts`.
- The hook must implement reconnection logic with exponential backoff (max 5 retries).
- WebSocket connection is established only on the dashboard page. It must be closed (`ws.close()`) in the `useEffect` cleanup function.
- Never create more than one WebSocket connection per page.

### No API Routes

- Do not create any files under `app/api/`. The frontend does not have API routes.
- If a frontend page needs data, it calls the Fastify API.

---

## 6. Database Rules

### Query Client

- Use the Supabase JS client (`@supabase/supabase-js`) or raw `pg` pool — choose one and be consistent across the entire codebase. Do not mix.
- The DB client is instantiated once in `plugins/postgres.ts` and decorated onto the Fastify instance. Never instantiate it elsewhere.

### Queries

- All DB queries are in service files. No raw SQL or query calls in route handlers or workers.
- Use parameterised queries always. Never interpolate user input into a query string.
- `click_count` on the `links` table is updated atomically: `UPDATE links SET click_count = click_count + 1`. Never read-then-write.
- Queries that touch the `links` table by `code` must use the `idx_links_code` index. Always query by `code`, never scan.

### Migrations

- All schema changes are SQL migration files in `packages/api/migrations/`.
- Migration files are named `001_initial.sql`, `002_add_indexes.sql` etc. — sequentially numbered.
- Never alter the schema by running ad-hoc queries in Supabase's dashboard for anything that should be reproducible.

### Cascade Deletes

- `click_events.link_id` has `ON DELETE CASCADE`. When a link is deleted via `DELETE /api/links/:code`, deleting the `links` row is sufficient — click history cleans up automatically.

---

## 7. Redis Rules

### Client

- Use `ioredis` as the Redis client. It is BullMQ's required peer dependency and the most compatible with Upstash.
- The Redis client is instantiated once in `plugins/redis.ts` and decorated onto the Fastify instance.

### Key Naming

Follow the key schema exactly as defined in the System Design. Do not invent new key patterns without updating the System Design doc.

```
link:{code}              → Hash — redirect cache
geo:{ip_hash}            → String — cached geo result
uniq:{link_id}:{date}    → Set — unique click tracking
rl:{user_id}:{min}       → String — rate limit counter
```

### TTLs

- Always set a TTL when writing to Redis. Never write a key with no expiry unless it is explicitly a permanent cache entry (none exist in v1).
- Geo cache TTL: **86400 seconds** (24 hours).
- Unique click set TTL: **172800 seconds** (48 hours).
- Rate limit key TTL: **60 seconds**.
- Redirect cache (`link:{code}`) TTL: set to `expiry_at - now()` in seconds if `expiry_at` is set, otherwise **no TTL** (permanent until DEL'd on deactivation or deletion).

### Upstash Budget

- The free tier allows **10,000 commands/day**. Every Redis operation counts.
- The redirect hot path uses exactly **1 command** (`HGETALL`). Do not add any additional Redis calls to the redirect route.
- The click worker uses a maximum of **4 commands** per click (SADD, GET/SET geo, pipeline for INCR).
- If a new feature requires Redis, calculate its command budget before implementing.

---

## 8. Security Rules

These rules are absolute. The agent must not deviate from them under any circumstance.

### IP Addresses

- **Raw IP addresses must never be stored anywhere** — not in the database, not in Redis, not in logs.
- The only allowed representation of an IP is its SHA-256 hash.
- Hash the IP at the earliest possible point in the click worker, before any other operation.
- The hash input is: `SHA-256(raw_ip + link_id + YYYY-MM-DD)`. This makes the hash non-reversible and scoped to a day.

### Passwords

- Link passwords are stored as bcrypt hashes with a cost factor of **12**.
- Never log or return the raw password or hash in any API response.
- `password_protected: true` is the only password-related field in any API response.

### Auth & JWTs

- User authentication is handled by Supabase Auth using Bearer JWTs.
- Never log or expose raw JWT tokens.

### HTTPS

- All production traffic is HTTPS only. The Fastify server must set `trustProxy: true` on Render so that `X-Forwarded-For` is used for IP extraction correctly.
- HTTP → HTTPS redirect is handled at the Render/CDN level, not in application code.

### Headers

- Fastify must register `@fastify/helmet` to set secure HTTP headers on all routes.
- CORS origin must be restricted to `FRONTEND_URL`. Never set `origin: '*'` in production.

---

## 9. Error Handling

### Error Response Shape

All error responses from the Fastify API must follow this exact shape, matching the API Contracts:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description."
}
```

- `error` is always a SCREAMING_SNAKE_CASE string from the error reference table in the API Contracts.
- `message` is a human-readable sentence. It may include variable data (e.g., the slug that was taken).
- Never return a stack trace, internal error message, or database error to the client.

### Error Factory

Use the error factory in `utils/errors.ts` to create all error responses. Never construct `{ error, message }` objects inline in route handlers.

```typescript
// ✅ Correct
throw createError('SLUG_TAKEN', `The slug '${slug}' is already in use.`, 409);

// ❌ Wrong
reply.code(409).send({ error: 'SLUG_TAKEN', message: '...' });
```

### Unhandled Errors

- Register a global `setErrorHandler` on the Fastify instance in `app.ts`.
- The global handler catches any unhandled error, logs it with `request.log.error`, and returns a generic `500 INTERNAL_ERROR` response.
- Never let an unhandled promise rejection crash the process. All async route handlers and worker jobs must have top-level try/catch.

### BullMQ Worker Errors

- If a worker job fails, log the error with the job ID and payload.
- After 3 retries, the job moves to the failed queue. Do not silently swallow worker errors.

---

## 10. Async & Queue Rules

### Redirect Route — Non-Blocking

- The redirect route must complete the 302 response before any click event work begins.
- Use `setImmediate` or fire-and-forget after sending the reply to add the job to BullMQ.
- Never `await` the queue add inside the redirect handler.

```typescript
// ✅ Correct
await reply.redirect(302, longUrl);
clickQueue.add('click', payload); // no await
```

### BullMQ Worker

- The worker runs in the same `packages/api` process but in its own async context.
- Worker concurrency is set to **5** — process up to 5 click events simultaneously.
- The worker file (`workers/clickWorker.ts`) exports a `startWorker()` function called from `server.ts` at startup.
- Workers must be gracefully shut down on `SIGTERM`/`SIGINT` — call `worker.close()` before process exit.

### No Blocking Operations

- Never use synchronous file I/O, `execSync`, or any other blocking Node.js API anywhere in the Fastify process.
- Geo lookups that miss the cache must be awaited inside the worker, never in the redirect route.

---

## 11. WebSocket Rules

- Use `@fastify/websocket` — do not install a separate `ws` server or use Socket.io.
- The in-memory `rooms` Map lives in the WebSocket route plugin scope. It is not a global variable.
- On client disconnect, the socket must be removed from every room it was subscribed to. Use a per-connection `subscriptions: Set<string>` tracker.
- WebSocket messages that fail JSON parsing must send an error frame and not crash the handler.
- Never broadcast to a client whose `readyState !== WebSocket.OPEN`.

```typescript
// ✅ Correct — always check readyState before send
rooms.get(code)?.forEach(client => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(payload));
  }
});
```

- The BullMQ worker communicates with the WebSocket layer via a Node.js `EventEmitter` (`wsEmitter`). Do not couple the worker directly to the WebSocket plugin.

---

## 12. Environment & Config

### Validation at Startup

- All required environment variables must be validated at application startup in `config.ts`.
- If a required variable is missing, the process must exit with a clear error message before starting the server.
- Use a validation library (e.g., `zod` or `envalid`) to parse and type the env vars.

```typescript
// config.ts must throw/exit on missing vars
const env = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  PORT: z.coerce.number().default(3001),
}).parse(process.env);
```

### .env Files

- `.env.example` is committed to the repo with placeholder values for all variables.
- `.env` and `.env.local` are gitignored and never committed.
- Never hardcode secrets, URLs, or credentials anywhere in the source code.

---

## 13. Logging Rules

Fastify uses Pino for logging by default. Do not replace or disable it.

### Log Levels

| Level | When to use |
|---|---|
| `info` | Request received, job completed, server started |
| `warn` | Cache miss, geo lookup failed (non-fatal), rate limit hit |
| `error` | Unhandled error, DB failure, worker job failed after retries |
| `debug` | Verbose internals — disabled in production |

### What to Log

- Every request is automatically logged by Fastify (method, url, statusCode, responseTime).
- Log at `info` level when: a link is created, deleted, or deactivated.
- Log at `warn` level when: a geo lookup fails and defaults to null, a BullMQ job is retried.
- Log at `error` level when: a DB query throws, a worker job exhausts retries.

### What to Never Log

- Raw IP addresses.
- Raw JWT tokens.
- Password fields (raw or hashed).
- Full request bodies on routes that accept sensitive data (`POST /api/shorten` — log only the code and url, not password).

### Log Format

- Production: JSON (Pino default).
- Development: Pretty-printed via `pino-pretty`.

---

## 14. Testing Expectations

The agent is not expected to achieve 100% coverage. The following tests must exist:

### Required Tests (packages/api)

| What | Type | Tool |
|---|---|---|
| `base62.ts` encode/decode | Unit | Vitest |
| `hash.ts` sha256 output | Unit | Vitest |
| `POST /api/shorten` — valid request | Integration | Fastify inject |
| `POST /api/shorten` — duplicate slug | Integration | Fastify inject |
| `GET /:code` — cache hit redirect | Integration | Fastify inject |
| `GET /:code` — expired link | Integration | Fastify inject |
| `PATCH /api/links/:code` — cache invalidation | Integration | Fastify inject |
| `DELETE /api/links/:code` — cascade | Integration | Fastify inject |
| Click worker — unique click detection | Unit | Vitest |

### Test Database

- Integration tests use a separate Supabase project or a local PostgreSQL instance via Docker.
- Never run integration tests against the production database.
- Each test suite seeds and tears down its own data. Tests must not depend on execution order.

---

## 15. What the Agent Must Never Do

This is the hard stop list. If asked to do any of these, refuse and flag it.

| Never | Why |
|---|---|
| Store a raw IP address anywhere | Privacy violation — SHA-256 only |
| Log a raw IP address | Same as above |
| Use `301` for the redirect | Breaks click tracking — always `302` |
| Use `any` in TypeScript | Type safety is non-negotiable |
| Call the database from a route handler directly | All DB access goes through services |
| Use Next.js API routes for backend logic | Backend is Fastify only |
| Create a new Redis key pattern not in the System Design | Document it first |
| `await` the click queue job in the redirect route | Blocks the response — kills the <5ms target |
| Use `origin: '*'` for CORS in production | Security violation |
| Send a stack trace or internal error to the client | Return `INTERNAL_ERROR` and log internally |
| Write raw SQL with interpolated user input | Use parameterised queries always |
| Hardcode any secret, URL, or credential | All config from environment variables |
| Implement the real-time dashboard as polling | WebSocket only — polling is explicitly out of scope |
| Cut the WebSocket dashboard to save time | It is the entire point of the project |

---

*Snip.ly Implementation Rules v1.0 — April 2026*
