# 🕶️ Dark Market Simulator

> **An intentionally vulnerable CTF-style web application for learning offensive and defensive security.**

---

## ⚠️ Legal Disclaimer

This project is a **100% fictional, sandboxed educational environment**. All listings, users, and data are fabricated. No real transactions, real credentials, or real exploits against live systems are involved. This is a **Capture The Flag (CTF)** platform designed for cybersecurity education.

---

## 🎯 What Is This?

Dark Market Simulator is a dark-web-aesthetic marketplace deliberately seeded with classic web vulnerabilities. Users ("hackers") browse fictional listings, discover hidden attack surfaces, exploit them, and collect cryptographic flags — all in a safe, local or containerized environment.

It serves three audiences:

| Role | What They Get |
|------|--------------|
| **Student** | Hands-on practice with OWASP Top 10 in a realistic UI |
| **Instructor** | A ready-made CTF platform with a logging dashboard |
| **Researcher** | A honeypot-style analytics layer for studying attack patterns |

---

## ✨ Feature Overview

### 🛒 Fake Marketplace UI
- Browse fictional listings (database dumps, zero-days, tools — all fake)
- BTC-style pricing, seller ratings, comment threads
- Dark UI aesthetic with Tor-style branding

### 💣 Intentional Vulnerabilities (CTF Challenges)
| Flag | Vulnerability | Technique |
|------|--------------|-----------|
| 🏴 Flag 1 | SQL Injection | `' OR 1=1 --` login bypass |
| 🏴 Flag 2 | Broken Auth | JWT secret brute-force |
| 🏴 Flag 3 | Stored XSS | Script injection via comments |
| 🏴 Flag 4 | IDOR | Accessing other users' orders |
| 🏴 Flag 5 | Path Traversal | Reading server config files |
| 🏴 Flag 6 | SSRF | Internal network probing |

### 🖥️ Hacker Mode Terminal
- Toggle-able side panel that transforms the UI
- Context-aware hints injected per page
- Simulated terminal with fake `nmap`, `sqlmap` output

### 📊 Logging Dashboard
- Every exploit attempt is logged (payload, endpoint, timestamp)
- Visual heatmap of most-targeted endpoints
- Export logs as JSON/CSV for academic reporting

### 🏆 Flag & Scoreboard System
- Cryptographic flags in `DMS{...}` format
- Real-time global leaderboard (or class-specific)
- Per-flag point values and difficulty ratings

---

## 🗂️ Repository Structure

```
dark-market-sim/
├── README.md                    # This file
├── ARCHITECTURE.md              # System design & data flow
├── SKILL.md                     # Coding standards & AI assistant context
├── CTF_CHALLENGES.md            # Vulnerability design specs
├── API_SPEC.md                  # REST API reference
├── SECURITY_NOTES.md            # Safe deployment guidelines
│
├── server/                      # Node.js + Express backend
│   ├── app.js
│   ├── routes/
│   │   ├── auth.js              # Intentionally vulnerable auth
│   │   ├── listings.js
│   │   ├── admin.js
│   │   └── flags.js
│   ├── middleware/
│   │   ├── logger.js            # Attack attempt logger
│   │   └── hintInjector.js
│   ├── db/
│   │   ├── schema.sql
│   │   └── seed.js
│   └── utils/
│       └── flagGenerator.js
│
├── client/                      # Vanilla HTML/CSS/JS frontend
│   ├── index.html
│   ├── assets/
│   │   ├── css/
│   │   │   ├── dark-theme.css
│   │   │   └── terminal.css
│   │   └── js/
│   │       ├── hacker-mode.js
│   │       ├── terminal.js
│   │       └── scoreboard.js
│   └── pages/
│       ├── login.html
│       ├── market.html
│       ├── listing.html
│       ├── dashboard.html       # Admin/logging (protected)
│       └── scoreboard.html
│
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
└── docs/
    ├── screenshots/
    └── writeups/                # Solution writeups (instructor-only)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- SQLite3 (bundled via `better-sqlite3`)

### Installation

```bash
git clone https://github.com/yourname/dark-market-sim.git
cd dark-market-sim
npm install
npm run db:seed       # Seeds fake listings, users, flags
npm run dev           # Starts on http://localhost:3000
```

### Docker (Recommended for Isolation)

```bash
docker-compose up --build
# App: http://localhost:3000
# Dashboard: http://localhost:3000/admin  (admin:admin123)
```

---

## 🔧 Environment Variables

```env
PORT=3000
NODE_ENV=development
DB_PATH=./server/db/market.sqlite
JWT_SECRET=supersecret          # Intentionally weak — part of Flag 2
ADMIN_PASSWORD=admin123
FLAG_SALT=DMS_INTERNAL_SALT
SESSION_SECRET=notverysecret
```

---

## 🧪 Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend | Node.js + Express | Fast, approachable, wide tooling |
| Database | SQLite (better-sqlite3) | Zero-config, portable, easy to inspect |
| Auth | JWT + express-session | Allows realistic JWT vulnerability |
| Frontend | Vanilla HTML/CSS/JS | No framework overhead, max transparency |
| Containerization | Docker + Compose | Safe isolation for deployment |
| Logging | Winston + SQLite | Structured logs, queryable |

---

## 📚 Academic Use

This project can be cited/documented as:

> "Designed and deployed a purpose-built vulnerable web application modeled on real-world dark marketplace architecture, implementing OWASP Top 10 vulnerabilities as gamified CTF challenges with a real-time attack logging and analytics dashboard."

---

## 📄 License

MIT License — for educational use only.
