# 🏗️ ARCHITECTURE.md — Dark Market Simulator

> **Full system design, data flow, and component relationships.**

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│                                                                 │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│   │  Market UI   │   │ Hacker Mode  │   │  Scoreboard UI   │  │
│   │ (HTML/CSS)   │   │  Terminal    │   │  (JS/WebSocket)  │  │
│   └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘  │
└──────────┼──────────────────┼─────────────────────┼────────────┘
           │                  │                     │
           ▼       REST API / Fetch                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER LAYER (Express.js)                │
│                                                                 │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────┐  │
│  │  /auth      │ │  /listings   │ │  /flags  │ │  /admin   │  │
│  │  (vuln)     │ │  (IDOR/XSS)  │ │  (CTF)   │ │ dashboard │  │
│  └──────┬──────┘ └──────┬───────┘ └────┬─────┘ └─────┬─────┘  │
│         │               │              │              │         │
│  ┌──────▼───────────────▼──────────────▼──────────────▼──────┐  │
│  │              Middleware Pipeline                           │  │
│  │  AttackLogger → HintInjector → AuthGuard → RateLimit      │  │
│  └────────────────────────────────┬───────────────────────────┘  │
└───────────────────────────────────┼────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER (SQLite)                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    users     │  │   listings   │  │    attack_logs       │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤  │
│  │ id           │  │ id           │  │ id                   │  │
│  │ username     │  │ title        │  │ timestamp            │  │
│  │ password_hash│  │ description  │  │ endpoint             │  │
│  │ role         │  │ price_btc    │  │ payload              │  │
│  │ session_token│  │ seller_id    │  │ ip_address           │  │
│  │ orders (JSON)│  │ category     │  │ flag_triggered       │  │
│  └──────────────┘  │ rating       │  │ user_agent           │  │
│                    └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   comments   │  │    flags     │  │    flag_captures     │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤  │
│  │ id           │  │ id           │  │ user_id              │  │
│  │ listing_id   │  │ name         │  │ flag_id              │  │
│  │ user_id      │  │ token        │  │ captured_at          │  │
│  │ content (XSS)│  │ points       │  │ payload_used         │  │
│  │ created_at   │  │ difficulty   │  └──────────────────────┘  │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Request Lifecycle

### Normal Request
```
Browser → Express Router → Middleware Chain → Route Handler → SQLite → JSON Response
```

### Attack Attempt (e.g., SQL Injection on /login)
```
Browser
  └─► POST /auth/login  { username: "' OR 1=1 --", password: "x" }
        └─► AttackLogger.log(payload, endpoint, ip)          [DB write]
              └─► HintInjector.check(payload)                [hint returned?]
                    └─► authRoute.login(req, res)
                          └─► VULNERABLE: db.query(raw SQL)
                                └─► Returns all users         ← SQL Injection succeeds
                                      └─► Flag 1 awarded
                                            └─► flagCapture.record(userId, flag1)
                                                  └─► 200 { token, flag: "DMS{...}" }
```

---

## 3. Component Breakdown

### 3.1 Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| Market Page | `client/pages/market.html` | Listing grid, search bar |
| Login Page | `client/pages/login.html` | Vulnerable auth form |
| Listing Detail | `client/pages/listing.html` | IDOR + XSS comment section |
| Hacker Terminal | `client/assets/js/terminal.js` | Simulated CLI panel |
| Hacker Mode Toggle | `client/assets/js/hacker-mode.js` | UI transformation + hint injection |
| Scoreboard | `client/pages/scoreboard.html` | Real-time leaderboard via WebSocket |
| Admin Dashboard | `client/pages/dashboard.html` | Log viewer, heatmap, exports |

### 3.2 Backend Routes

| Route | Method | Vulnerability | Flag |
|-------|--------|--------------|------|
| `/auth/login` | POST | SQL Injection (raw query) | Flag 1 |
| `/auth/token` | POST | Weak JWT secret | Flag 2 |
| `/listings/:id/comments` | POST | Stored XSS | Flag 3 |
| `/orders/:id` | GET | IDOR (no ownership check) | Flag 4 |
| `/files` | GET | Path Traversal (`../`) | Flag 5 |
| `/fetch-preview` | POST | SSRF (unvalidated URL) | Flag 6 |

### 3.3 Middleware Pipeline

```javascript
// server/app.js — Middleware order matters
app.use(express.json())
app.use(morgan('combined'))          // HTTP logging
app.use(attackLogger)                // Custom: logs suspicious payloads
app.use(hintInjector)                // Injects CTF hints into response headers
app.use(sessionMiddleware)
app.use('/auth',     authRoutes)
app.use('/listings', listingRoutes)
app.use('/orders',   orderRoutes)    // IDOR lives here
app.use('/files',    fileRoutes)     // Path traversal lives here
app.use('/fetch',    fetchRoutes)    // SSRF lives here
app.use('/flags',    flagRoutes)
app.use('/admin',    adminRoutes)    // Protected (weakly)
app.use('/score',    scoreRoutes)
```

### 3.4 Attack Logger (Core Infrastructure)

```javascript
// server/middleware/logger.js
// Every request is inspected for known attack patterns
// Matching requests are logged to attack_logs table
// Pattern library:
const PATTERNS = {
  sqli:      [/('|--|;|OR\s+1=1|UNION\s+SELECT)/i],
  xss:       [/<script|onerror=|javascript:/i],
  traversal: [/\.\.\//],
  ssrf:      [/(localhost|127\.0\.0\.1|169\.254)/i],
  jwt:       [/eyJ[A-Za-z0-9+/=]+\.eyJ/]  // Detects JWT manipulation
}
```

---

## 4. Database Schema

```sql
-- server/db/schema.sql

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,          -- MD5 (intentionally weak for Flag 2)
    role TEXT DEFAULT 'buyer',       -- 'buyer' | 'seller' | 'admin'
    session_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price_btc REAL NOT NULL,
    seller_id INTEGER REFERENCES users(id),
    category TEXT,
    rating REAL DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER REFERENCES listings(id),
    user_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,           -- NOT sanitized → Stored XSS (Flag 3)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER REFERENCES users(id),
    listing_id INTEGER REFERENCES listings(id),
    amount_btc REAL,
    status TEXT DEFAULT 'pending',
    secret_note TEXT,                -- Exposed via IDOR (Flag 4)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token TEXT NOT NULL,             -- e.g., DMS{s0m3_h4sh_h3r3}
    vulnerability TEXT NOT NULL,
    points INTEGER NOT NULL,
    difficulty TEXT NOT NULL         -- 'easy' | 'medium' | 'hard'
);

CREATE TABLE flag_captures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    flag_id INTEGER REFERENCES flags(id),
    payload_used TEXT,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, flag_id)
);

CREATE TABLE attack_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    payload TEXT,
    pattern_matched TEXT,            -- Which PATTERNS key matched
    flag_triggered INTEGER REFERENCES flags(id),
    session_user_id INTEGER REFERENCES users(id)
);
```

---

## 5. Authentication Flow (Intentionally Broken)

```
Normal JWT Flow vs. Dark Market Simulator Flow

SECURE (What it should be):          VULNERABLE (What we do):
─────────────────────────            ────────────────────────────────
1. Hash password (bcrypt)            1. Hash password (MD5 — crackable)
2. Sign JWT (strong RS256)           2. Sign JWT (HS256 + weak secret)
3. Validate JWT per request          3. No expiry set on JWT
4. Refresh tokens used               4. Signature not verified on /admin
5. CSRF protection                   5. No CSRF tokens
```

---

## 6. Hacker Mode Architecture

```
User clicks [Enter Hacker Mode]
    │
    ▼
hacker-mode.js
    ├── Injects `.hacker-mode` class on <body>  → Dark terminal aesthetic
    ├── Opens terminal panel (slide-in CSS)
    ├── Fetches page-specific hints from /api/hints?page=<current>
    │       Server reads URL → returns contextual hint from hints.json
    └── Terminal.js initializes
            ├── Fake command registry: nmap, sqlmap, ls, whoami, help
            ├── Each command returns pre-scripted realistic output
            └── Hidden commands: `flag`, `dump`, `crack` → trigger hint escalation
```

---

## 7. WebSocket — Real-time Scoreboard

```
server/routes/score.js
    └── ws.Server attached to Express HTTP server
            ├── On flag_capture event → broadcast { user, flag, points, total }
            ├── Clients receive update → scoreboard re-renders
            └── Leaderboard sorted by: total_points DESC, captured_at ASC
```

---

## 8. Deployment Topology

### Local Dev
```
localhost:3000  →  Express (nodemon)  →  market.sqlite
```

### Docker (Recommended)
```
docker-compose up
    ├── web:   node:18-alpine  →  port 3000
    └── (optional) nginx:alpine  →  reverse proxy, port 80
```

### Classroom / CTF Event
```
VPS / LAN server
    └── Docker Compose
            ├── App container (3000, internal)
            ├── Nginx (80 → 3000)
            └── Persistent volume: /data/market.sqlite
```

---

## 9. Security Boundary

> 🔴 **Critical**: The vulnerabilities are intentional and scoped to the application layer only.

| Layer | Secure? | Notes |
|-------|---------|-------|
| Host OS | ✅ Yes | Docker containerizes the app |
| Network | ✅ Yes | SSRF is sandboxed to Docker network |
| Real credentials | ✅ Yes | No real passwords, keys, or PII in seed data |
| Real filesystem | ✅ Yes | Path traversal is chrooted inside `/app/public` |
| Application layer | ❌ Intentional | All 6 vulnerabilities are by design |
