# Snip.ly

High-performance URL shortener with a real-time analytics dashboard (Fastify + Next.js monorepo).

## Structure

| Package | Description |
|--------|-------------|
| `packages/api` | Fastify API server (TypeScript) |
| `packages/frontend` | Next.js 14 App Router UI |

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (Postgres + API URL + anon key)
- An [Upstash](https://upstash.com) Redis database

## Setup

1. Copy `.env.example` to `.env` at the repo root (or place env vars where you run the API) and fill in real values.
2. From the repo root: `npm install`
3. Run `packages/api/migrations/001_initial.sql` in the Supabase SQL editor.
4. `npm run dev:api` — starts the API on `PORT` (default `3001`).
5. `npm run dev:frontend` — starts Next.js on port `3000`.

## Scripts

- `npm run test` — Vitest unit tests for `@sniply/api`
- `npm run build` — build API + frontend workspaces

## Specs

Product and engineering docs live in [`knowledge/`](knowledge/AGENT_BRIEFING.md).

## Base62 note

Short codes use the alphabet from `SYSTEM_DESIGN.md`. Encoded values use **standard base-62** (least significant digit first). The illustrative table in the design doc mixes examples that do not all match this single scheme; the implementation and tests follow the reversible encode/decode used in code (e.g. `1000` ↔ `qi`).
