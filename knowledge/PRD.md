Snip.ly — Product Requirements Document | v1.0 | April 2026
Page 1

# SNIP.LY

Product Requirements Document

Version 1.0 | April 2026 | Author: Basit Ali

Snip.ly — Product Requirements Document | v1.0 | April 2026
Page 2

# 1. Problem Statement

Long URLs are untrustworthy, untrackable, and break across character-limited platforms. Existing shorteners (Bit.ly, TinyURL) are either paywalled for analytics, require account creation for basic use, or offer nothing beyond a raw click count.

Snip.ly fills the gap: a developer-first URL shortener that is fast, open, and ships a real-time analytics dashboard — live click events streamed via WebSocket, geographic breakdown, and referrer analysis, all updating the moment a link is clicked anywhere in the world.

## Core Insight

The redirect is a commodity. The real product is the live analytics dashboard. Anyone can shorten a URL. Nobody ships a genuinely real-time click stream out of the box at this level.

# 2. Product Vision

Snip.ly is a high-performance URL shortener and real-time analytics platform built on an event-driven architecture. Sub-5ms redirect latency via Redis caching. Asynchronous click event processing via BullMQ. A live WebSocket dashboard that updates the moment any link is clicked — no polling, no page refresh, no delay.

# 3. Target Users

|  User Type | Description | Primary Need  |
| --- | --- | --- |
|  Developer / Builder | Engineers sharing project links, API docs, portfolio URLs | Clean short URL + knowing who is clicking and from where  |
|  Content Creator | YouTubers, newsletter writers, social media users | Branded short links + per-platform click tracking  |
|  Marketing / Growth | Startups running campaigns across multiple channels | Referrer breakdown, per-link analytics, click timeline  |
|  Power User | Privacy-conscious users who want to own their data | Full control, no third-party data leakage, self-hostable  |

# 4. Goals &amp; Success Metrics

## Primary Goals

- Redirect any short URL in under 5ms p99 via Redis cache hit

- Process click events asynchronously — the redirect must never wait for a DB write
- Live dashboard receives click events within 500ms of them occurring
- Support custom slugs, link expiry, click limits, and password protection
- Never store raw IP addresses — only hashed identifiers for unique click detection

## Success Metrics

|  Metric | Target | How Measured  |
| --- | --- | --- |
|  Redirect latency — cache hit | < 5ms p99 | Server-side timing middleware  |
|  Redirect latency — cache miss | < 30ms p99 | Server-side timing middleware  |
|  Click event processing lag | < 2s | Timestamp delta: click → DB write  |
|  WebSocket dashboard update | < 500ms | Client-side WS message timing  |
|  API uptime | > 99.5% | UptimeRobot monitoring  |
|  Short code collision rate | 0% | ConditionExpression on every write  |

## 5. Scope

### In Scope — v1.0

- URL shortening via REST API and web UI
- Base62 encoded short codes (6 characters, generated from auto-increment DB ID)
- Custom slug support with collision detection
- Redis caching layer for sub-5ms redirects on cache hit
- 302 redirect — deliberate choice to preserve analytics (301 caches at browser, kills tracking)
- Async click event pipeline via BullMQ — redirect never waits for DB write
- Click metadata captured: timestamp, referrer, user-agent, country (via IP geolocation)
- Real-time WebSocket dashboard: live click feed, total clicks, unique clicks, top referrers, geo map
- Link management: expiry (TTL), max-click limit, deactivation, destination URL update
- API key authentication for programmatic access
- QR code generation per link
- Cache invalidation on link deactivation or deletion — takes effect immediately

### Out of Scope — v1.0

- Team and workspace accounts — v2
- Custom domain support — v2
- UTM parameter auto-injection — v2
- A/B split links — v2
- Link-in-bio pages
- Native mobile app

Snip.ly — Product Requirements Document | v1.0 | April 2026

Snip.ly — Product Requirements Document | v1.0 | April 2026

# 6. Assumptions &amp; Constraints

|  Assumption / Constraint | Detail  |
| --- | --- |
|  Infrastructure budget | Free tier only: Upstash Redis (10k cmds/day), Render (750 hrs/month), Supabase (500MB). Architecture must work within these limits.  |
|  Geo IP | ip-api.com free tier — 45 requests/minute. Geo results cached in Redis by IP hash with 24h TTL to stay within limits.  |
|  Redirect volume | At 10k Redis commands/day and ~2 commands per redirect (GET + conditional SET), max is ~5,000 redirects/day on free tier. Sufficient for portfolio.  |
|  Short code design | Base62 (a-z, A-Z, 0-9), case-sensitive, 6 characters minimum. Generated from auto-increment ID — no random generation, no collision checks needed by construction.  |
|  Privacy | Raw IP addresses are personal data. Only SHA-256 hashed IPs are stored. Never log raw IPs anywhere in the pipeline.  |
|  Browser support | Last 2 versions of Chrome, Safari, Firefox. No IE support.  |

# 7. High-Level Feature List

|  Feature | Priority | Notes  |
| --- | --- | --- |
|  URL shortening (API + UI) | Must Have | Core product  |
|  Base62 short code generation | Must Have | From auto-increment ID — zero collision risk  |
|  302 redirect with Redis cache | Must Have | Hot path — must be < 5ms on cache hit  |
|  Async click event processing | Must Have | BullMQ worker — redirect never blocks on this  |
|  Real-time WebSocket dashboard | Must Have | The showpiece feature — do not cut this  |
|  Geographic click breakdown | Must Have | Country-level via ip-api.com  |
|  Referrer tracking | Must Have | From HTTP Referer header  |
|  Custom slugs | Should Have | Collision-checked on write  |
|  Link expiry (TTL) | Should Have | Redis TTL + DB expiry_at field  |
|  Max click limit | Should Have | Worker checks and deactivates  |
|  Link deactivation | Must Have | Immediate — Redis key DEL'd on deactivate  |
|  Destination URL update | Should Have | Cache invalidation required  |
|  Password-protected links | Should Have | bcrypt hash stored, prompt on redirect  |

Page 4

Snip.ly — Product Requirements Document | v1.0 | April 2026

|  Feature | Priority | Notes  |
| --- | --- | --- |
|  QR code generation | Nice to Have | qrcode npm package, returned in POST response  |
|  Stats CSV export | Nice to Have | v1.0 stretch goal  |
|  Rate limiting (anti-abuse) | Should Have | Redis counter — 10 shortens/min per API key  |

# 8. Non-Functional Requirements

|  Category | Requirement  |
| --- | --- |
|  Performance | Redirect p99 < 5ms (cache hit), < 30ms (cache miss). Dashboard WS update < 500ms from click.  |
|  Reliability | No click event loss — BullMQ retries failed jobs up to 3 times with exponential backoff.  |
|  Security | No raw IPs stored. API keys hashed at rest. Password-protected links use bcrypt. HTTPS only in production.  |
|  Privacy | GDPR-aware design: IP hashing, /privacy page, click tracking disclosed in link preview metadata.  |
|  Observability | Structured logs on all API routes. BullMQ job failure alerts. Uptime monitoring via UptimeRobot.  |
|  Scalability | Architecture documented for Kafka migration at high scale. BullMQ chosen as cost-effective equivalent for current traffic.  |

# The One Rule

The live WebSocket dashboard is the entire point of this project. If you cut anything due to time, cut QR codes or CSV export. Never cut the real-time dashboard — that is what separates this from a tutorial.

Page 5



