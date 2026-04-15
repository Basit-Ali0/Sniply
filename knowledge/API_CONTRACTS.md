# Snip.ly — API Contracts v1.0

> Base URL: `https://api.snip.ly`  
> All requests and responses use `Content-Type: application/json` unless noted.  
> Authentication via `X-API-Key` header on all `/api/*` routes.  
> Public redirect endpoint (`GET /:code`) requires no auth.

---

## Table of Contents

1. [Authentication](#authentication)
2. [POST /api/shorten](#post-apishorten)
3. [GET /:code](#get-code)
4. [GET /api/links](#get-apilinks)
5. [GET /api/links/:code](#get-apilinksscode)
6. [GET /api/links/:code/stats](#get-apilinkscodesstats)
7. [PATCH /api/links/:code](#patch-apilinkscode)
8. [DELETE /api/links/:code](#delete-apilinkscode)
9. [GET /qr/:code](#get-qrcode)
10. [WebSocket /ws](#websocket-ws)
11. [Error Reference](#error-reference)
12. [Data Models](#data-models)

---

## Authentication

All `/api/*` endpoints require an API key passed as a header.

```
X-API-Key: sk_live_xxxxxxxxxxxxxxxx
```

Missing or invalid key returns:

```json
HTTP 401
{
  "error": "UNAUTHORIZED",
  "message": "Missing or invalid API key"
}
```

---

## POST /api/shorten

Create a new short link.

**Request**

```
POST /api/shorten
X-API-Key: sk_live_xxx
Content-Type: application/json
```

```json
{
  "url": "https://github.com/Basit-Ali0/secure-share",
  "slug": "maskedfile",
  "expiry_at": "2026-12-31T23:59:59Z",
  "max_clicks": 1000,
  "password": "secretword"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | Yes | Destination URL. Must include `http://` or `https://`. Max 2048 chars. |
| `slug` | string | No | Custom short code. Alphanumeric + hyphens only. 3–32 chars. |
| `expiry_at` | ISO 8601 string | No | Link deactivates after this timestamp. |
| `max_clicks` | integer | No | Link deactivates after this many clicks. Min 1. |
| `password` | string | No | Visitors must enter this password before being redirected. |

**Response 201 — Created**

```json
{
  "code": "x9k2p",
  "short_url": "https://snip.ly/x9k2p",
  "long_url": "https://github.com/Basit-Ali0/secure-share",
  "qr_url": "https://api.snip.ly/qr/x9k2p",
  "created_at": "2026-04-15T10:32:00Z",
  "expiry_at": "2026-12-31T23:59:59Z",
  "max_clicks": 1000,
  "password_protected": true
}
```

**Errors**

| Status | Error Code | When |
|---|---|---|
| 400 | `INVALID_URL` | URL missing scheme, malformed, or over 2048 chars |
| 400 | `INVALID_SLUG` | Slug contains special characters or is under 3 chars |
| 409 | `SLUG_TAKEN` | Custom slug already exists |
| 422 | `URL_BLOCKED` | URL flagged by Safe Browsing check |

```json
HTTP 409
{
  "error": "SLUG_TAKEN",
  "message": "The slug 'maskedfile' is already in use. Choose a different one."
}
```

---

## GET /:code

Redirect to the destination URL. This is the **hot path** — served from Redis cache, no auth required.

```
GET /x9k2p
```

**Response 302 — Redirect (cache hit, < 5ms)**

```
HTTP/1.1 302 Found
Location: https://github.com/Basit-Ali0/secure-share
X-Cache: HIT
X-Response-Time: 2ms
```

> **Why 302 and not 301?**  
> 301 is cached permanently by browsers. Subsequent clicks would bypass the server entirely and never be recorded. 302 ensures every click passes through Redis, is counted, and appears in the live dashboard. This is intentional.

**Response 302 — Redirect (cache miss, < 30ms)**

```
HTTP/1.1 302 Found
Location: https://github.com/Basit-Ali0/secure-share
X-Cache: MISS
X-Response-Time: 18ms
```

**Errors**

| Status | Error Code | When |
|---|---|---|
| 302 | — | Password-protected link — redirects to `/enter-password/:code` page instead |
| 404 | `LINK_NOT_FOUND` | Short code does not exist |
| 410 | `LINK_EXPIRED` | Link has passed its `expiry_at` timestamp |
| 410 | `CLICK_LIMIT_REACHED` | Link has hit its `max_clicks` limit |
| 410 | `LINK_INACTIVE` | Link has been manually deactivated |

```json
HTTP 410
{
  "error": "LINK_EXPIRED",
  "message": "This link expired on 2026-03-01T00:00:00Z."
}
```

---

## GET /api/links

List all links belonging to the authenticated user.

**Request**

```
GET /api/links?page=1&limit=20&status=active
X-API-Key: sk_live_xxx
```

| Query Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Results per page. Max 100. |
| `status` | string | all | Filter by `active`, `inactive`, `expired` |
| `sort` | string | created_at | Sort by `created_at`, `click_count` |
| `order` | string | desc | `asc` or `desc` |

**Response 200**

```json
{
  "links": [
    {
      "code": "x9k2p",
      "short_url": "https://snip.ly/x9k2p",
      "long_url": "https://github.com/Basit-Ali0/secure-share",
      "click_count": 1482,
      "active": true,
      "created_at": "2026-04-15T10:32:00Z",
      "expiry_at": null,
      "max_clicks": null,
      "password_protected": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "total_pages": 3
  }
}
```

---

## GET /api/links/:code

Get a single link by its short code.

**Request**

```
GET /api/links/x9k2p
X-API-Key: sk_live_xxx
```

**Response 200**

```json
{
  "code": "x9k2p",
  "short_url": "https://snip.ly/x9k2p",
  "long_url": "https://github.com/Basit-Ali0/secure-share",
  "click_count": 1482,
  "unique_clicks": 834,
  "active": true,
  "created_at": "2026-04-15T10:32:00Z",
  "expiry_at": null,
  "max_clicks": null,
  "password_protected": false,
  "qr_url": "https://api.snip.ly/qr/x9k2p"
}
```

**Errors**

| Status | Error Code | When |
|---|---|---|
| 404 | `LINK_NOT_FOUND` | Code does not exist or belongs to another user |

---

## GET /api/links/:code/stats

Get analytics for a specific link.

**Request**

```
GET /api/links/x9k2p/stats?from=2026-04-01T00:00:00Z&to=2026-04-15T23:59:59Z
X-API-Key: sk_live_xxx
```

| Query Param | Type | Required | Description |
|---|---|---|---|
| `from` | ISO 8601 | No | Start of date range. Defaults to link creation date. |
| `to` | ISO 8601 | No | End of date range. Defaults to now. |

**Response 200**

```json
{
  "code": "x9k2p",
  "period": {
    "from": "2026-04-01T00:00:00Z",
    "to": "2026-04-15T23:59:59Z"
  },
  "totals": {
    "clicks": 1482,
    "unique_clicks": 834
  },
  "top_referrers": [
    { "referrer": "twitter.com", "clicks": 612 },
    { "referrer": "direct", "clicks": 401 },
    { "referrer": "linkedin.com", "clicks": 289 },
    { "referrer": "github.com", "clicks": 180 }
  ],
  "top_countries": [
    { "country": "IN", "clicks": 540 },
    { "country": "US", "clicks": 310 },
    { "country": "GB", "clicks": 198 }
  ],
  "hourly_breakdown": [
    { "hour": "2026-04-15T00:00:00Z", "clicks": 34 },
    { "hour": "2026-04-15T01:00:00Z", "clicks": 12 }
  ]
}
```

> `referrer` is `"direct"` when the HTTP `Referer` header is absent.

---

## PATCH /api/links/:code

Update a link's properties. Only the fields you send are updated.

**Request**

```
PATCH /api/links/x9k2p
X-API-Key: sk_live_xxx
Content-Type: application/json
```

```json
{
  "url": "https://github.com/Basit-Ali0/secure-share/releases",
  "active": true,
  "expiry_at": "2027-01-01T00:00:00Z",
  "max_clicks": 5000
}
```

| Field | Type | Description |
|---|---|---|
| `url` | string | New destination URL. Triggers immediate Redis cache invalidation. |
| `active` | boolean | `false` immediately deactivates — Redis key deleted, returns 410 on next hit. |
| `expiry_at` | ISO 8601 or `null` | Update or remove expiry. |
| `max_clicks` | integer or `null` | Update or remove click limit. |

**Response 200**

```json
{
  "code": "x9k2p",
  "short_url": "https://snip.ly/x9k2p",
  "long_url": "https://github.com/Basit-Ali0/secure-share/releases",
  "active": true,
  "updated_at": "2026-04-15T11:00:00Z"
}
```

> **Cache invalidation:** On any PATCH, the Redis key for this code is immediately DEL'd. The next redirect will be a cache miss and will re-populate from the updated DB record.

**Errors**

| Status | Error Code | When |
|---|---|---|
| 400 | `INVALID_URL` | New URL is malformed |
| 404 | `LINK_NOT_FOUND` | Code does not exist or belongs to another user |

---

## DELETE /api/links/:code

Permanently delete a link and all its click event history.

**Request**

```
DELETE /api/links/x9k2p
X-API-Key: sk_live_xxx
```

**Response 204 — No Content**

```
HTTP/1.1 204 No Content
```

> Redis key is DEL'd immediately. Any subsequent request to `GET /x9k2p` returns 404.

**Errors**

| Status | Error Code | When |
|---|---|---|
| 404 | `LINK_NOT_FOUND` | Code does not exist or belongs to another user |

---

## GET /qr/:code

Returns a QR code image for the short URL. No auth required.

**Request**

```
GET /qr/x9k2p?size=256
```

| Query Param | Type | Default | Description |
|---|---|---|---|
| `size` | integer | 200 | Output image size in pixels. Min 100, max 1000. |
| `format` | string | png | `png` or `svg` |

**Response 200**

```
Content-Type: image/png
[binary image data]
```

---

## WebSocket /ws

Real-time click event stream. Connect once per dashboard session. Subscribe to individual link rooms by short code.

**Connection**

```
wss://api.snip.ly/ws
X-API-Key: sk_live_xxx  ← sent as query param since WS headers are limited
```

```
wss://api.snip.ly/ws?api_key=sk_live_xxx
```

---

### Client → Server Messages

**subscribe** — start receiving events for a link

```json
{
  "type": "subscribe",
  "code": "x9k2p"
}
```

**unsubscribe** — stop receiving events for a link

```json
{
  "type": "unsubscribe",
  "code": "x9k2p"
}
```

---

### Server → Client Messages

**subscribed** — confirms subscription

```json
{
  "type": "subscribed",
  "code": "x9k2p",
  "current_stats": {
    "total_clicks": 1482,
    "unique_clicks": 834
  }
}
```

**click_event** — fires every time a click is processed by the BullMQ worker

```json
{
  "type": "click_event",
  "code": "x9k2p",
  "clicked_at": "2026-04-15T11:04:32Z",
  "country": "IN",
  "referrer": "twitter.com",
  "total_clicks": 1483,
  "unique_clicks": 835
}
```

> `referrer` is `"direct"` when absent. `country` is a 2-letter ISO code. `total_clicks` and `unique_clicks` are the updated running totals after this event.

**link_updated** — fires when the link is modified via PATCH

```json
{
  "type": "link_updated",
  "code": "x9k2p",
  "active": false
}
```

**link_deleted** — fires when the link is deleted

```json
{
  "type": "link_deleted",
  "code": "x9k2p"
}
```

**error** — sent when a message is malformed or subscription fails

```json
{
  "type": "error",
  "message": "Link not found or access denied"
}
```

---

## Error Reference

All error responses follow this shape:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description of what went wrong."
}
```

| Code | HTTP Status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Valid key but no access to this resource |
| `LINK_NOT_FOUND` | 404 | Short code does not exist |
| `LINK_EXPIRED` | 410 | Link has passed expiry_at |
| `CLICK_LIMIT_REACHED` | 410 | Link has hit max_clicks |
| `LINK_INACTIVE` | 410 | Link was manually deactivated |
| `INVALID_URL` | 400 | Malformed or missing scheme in URL |
| `INVALID_SLUG` | 400 | Slug contains invalid characters |
| `SLUG_TAKEN` | 409 | Custom slug already in use |
| `URL_BLOCKED` | 422 | URL flagged as malicious |
| `RATE_LIMITED` | 429 | Too many requests — back off and retry |
| `INTERNAL_ERROR` | 500 | Something went wrong on our end |

---

## Data Models

### Link

```typescript
interface Link {
  id: bigint;               // BIGSERIAL — Base62 encoded to produce code
  code: string;             // Base62 short code or custom slug
  long_url: string;         // Destination URL
  user_id: string | null;   // UUID — null for anonymous links
  active: boolean;          // Whether link is currently redirecting
  click_count: number;      // Denormalized — incremented atomically by worker
  expiry_at: string | null; // ISO 8601 — nullable
  max_clicks: number | null; // nullable
  password_hash: string | null; // bcrypt hash — nullable
  created_at: string;       // ISO 8601
  updated_at: string;       // ISO 8601
}
```

### ClickEvent

```typescript
interface ClickEvent {
  id: string;          // UUID
  link_id: bigint;     // FK → links.id
  clicked_at: string;  // ISO 8601
  referrer: string | null; // HTTP Referer header value — null = direct
  country: string | null;  // ISO 3166-1 alpha-2 country code
  user_agent: string | null; // Raw User-Agent header
  ip_hash: string;     // SHA-256 of IP — NEVER store raw IP
}
```

### Base62 Encoding

Short codes are generated by encoding the PostgreSQL `BIGSERIAL` ID to Base62.

```
Alphabet: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789
```

| DB ID | Short Code |
|---|---|
| 1 | `a` |
| 62 | `B` |
| 1,000 | `qi` |
| 1,000,000 | `4c92` |

No random generation. No collision checks. Guaranteed unique by construction.

---

*Snip.ly API Contracts v1.0 — April 2026*
