# 🗺️ PROJECT_PLAN.md — Development Roadmap

> **Phased build plan with tasks, dependencies, and definition of done for each milestone.**

---

## Project Phases

```
Phase 1 (Core)      → Phase 2 (Vulnerabilities)  → Phase 3 (Hacker Mode)
  ↓                         ↓                             ↓
Phase 4 (Dashboard) → Phase 5 (Gamification)     → Phase 6 (Polish & Docs)
```

Estimated total: **~40–60 hours** for solo developer.

---

## 📦 Phase 1 — Foundation

**Goal**: Running app with fake marketplace, no vulnerabilities yet.

### Tasks

| # | Task | File(s) | Est. |
|---|------|---------|------|
| 1.1 | Initialize Node.js project, install dependencies | `package.json` | 30m |
| 1.2 | Create SQLite schema + seed script | `server/db/schema.sql`, `seed.js` | 2h |
| 1.3 | Build Express app skeleton + middleware pipeline | `server/app.js` | 1h |
| 1.4 | Implement listings route (read-only) | `server/routes/listings.js` | 1h |
| 1.5 | Build dark-theme CSS system | `client/assets/css/dark-theme.css` | 2h |
| 1.6 | Build market page HTML | `client/pages/market.html` | 2h |
| 1.7 | Build listing detail page | `client/pages/listing.html` | 1.5h |
| 1.8 | Build login/register pages | `client/pages/login.html` | 1h |
| 1.9 | Basic session-based auth (secure, placeholder) | `server/routes/auth.js` | 1h |
| 1.10 | Docker setup | `docker/Dockerfile`, `docker-compose.yml` | 1h |

### Dependency Install

```bash
npm init -y
npm install express better-sqlite3 express-session jsonwebtoken node-fetch winston ws
npm install --save-dev nodemon
```

### Definition of Done
- [ ] `npm run dev` starts without errors
- [ ] Visiting `http://localhost:3000` shows the market page with seeded listings
- [ ] Login with `admin:admin123` redirects to market
- [ ] Docker Compose builds and runs

---

## 💣 Phase 2 — Vulnerabilities

**Goal**: All 6 CTF flags are exploitable and award flag tokens.

### Tasks

| # | Task | Flag | File(s) | Est. |
|---|------|------|---------|------|
| 2.1 | Replace secure auth query with raw SQL concatenation | Flag 1 | `routes/auth.js` | 45m |
| 2.2 | Implement flag service + flag table seeding | All | `utils/flagService.js` | 1.5h |
| 2.3 | Weaken JWT (HS256 + `supersecret`, no expiry) | Flag 2 | `utils/jwt.js` | 30m |
| 2.4 | Implement `/admin` with no role check | Flag 2 | `routes/admin.js` | 1h |
| 2.5 | Remove comment sanitization, use innerHTML render | Flag 3 | `routes/listings.js`, `listing.html` | 1h |
| 2.6 | Add XSS beacon endpoint `/flags/xss-beacon` | Flag 3 | `routes/flags.js` | 30m |
| 2.7 | Add IDOR orders route (no ownership check) | Flag 4 | `routes/orders.js` | 45m |
| 2.8 | Add path traversal file route (no path.resolve) | Flag 5 | `routes/files.js` | 45m |
| 2.9 | Add SSRF fetch preview endpoint | Flag 6 | `routes/fetch.js` | 45m |
| 2.10 | Integration test — verify all 6 flags can be captured | All | manual | 2h |

### Definition of Done
- [ ] Each of the 6 flags can be captured using documented payloads from `CTF_CHALLENGES.md`
- [ ] `flag_captures` table logs each capture
- [ ] Flag tokens appear in response JSON when triggered
- [ ] Flags are not revealed before exploitation

---

## 🖥️ Phase 3 — Hacker Mode

**Goal**: Toggle-able hacker UI with working terminal and contextual hints.

### Tasks

| # | Task | File(s) | Est. |
|---|------|---------|------|
| 3.1 | Design terminal panel CSS | `assets/css/terminal.css` | 1.5h |
| 3.2 | Build hacker-mode toggle (class injection + animation) | `assets/js/hacker-mode.js` | 1h |
| 3.3 | Implement terminal.js with command registry | `assets/js/terminal.js` | 3h |
| 3.4 | Add fake command outputs (nmap, sqlmap, ls, whoami) | `assets/js/terminal.js` | 2h |
| 3.5 | Build hints API endpoint | `server/routes/hints.js`, `hints.json` | 1h |
| 3.6 | Integrate hints display into Hacker Mode panel | `hacker-mode.js` | 1h |
| 3.7 | Add hint escalation on terminal command (`crack`, `dump`) | `terminal.js` | 1h |

### Terminal Commands to Implement

```
help        → list all commands
nmap        → fake port scan output for localhost
sqlmap      → hints about injectable endpoints
ls          → fake directory listing
whoami      → current session user info
jwt-decode  → decodes a JWT pasted by user
crack-jwt   → educational hint about JWT weakness
flag        → shows captured flags for current user
dump        → hints about database dumping
history     → command history
clear       → clears terminal
```

### Definition of Done
- [ ] Hacker Mode toggle transforms UI without breaking functionality
- [ ] All listed terminal commands return realistic output
- [ ] Hints displayed are page-specific
- [ ] Terminal remembers command history (up arrow)

---

## 📊 Phase 4 — Logging Dashboard

**Goal**: Visual admin panel showing attack analytics.

### Tasks

| # | Task | File(s) | Est. |
|---|------|---------|------|
| 4.1 | Build attack logger middleware | `middleware/logger.js` | 1.5h |
| 4.2 | Design admin dashboard HTML | `pages/dashboard.html` | 2h |
| 4.3 | Attack log table with filters | `pages/dashboard.html`, `routes/admin.js` | 1.5h |
| 4.4 | Endpoint heatmap (bar chart, vanilla JS) | `pages/dashboard.html` | 2h |
| 4.5 | Pattern breakdown pie chart | `pages/dashboard.html` | 1.5h |
| 4.6 | CSV/JSON export | `routes/admin.js` | 1h |
| 4.7 | Live log stream (polling or SSE) | `routes/admin.js` | 1h |

### Definition of Done
- [ ] Dashboard shows count of: total attempts, unique IPs, flags triggered
- [ ] Log table supports filter by pattern type, date range
- [ ] Heatmap correctly shows most-targeted endpoints
- [ ] Export produces valid JSON and CSV files

---

## 🏆 Phase 5 — Gamification & Scoreboard

**Goal**: Real-time scoreboard, flag submission, progress tracking.

### Tasks

| # | Task | File(s) | Est. |
|---|------|---------|------|
| 5.1 | Build scoreboard page | `pages/scoreboard.html` | 1.5h |
| 5.2 | Implement WebSocket server for live updates | `routes/score.js`, `app.js` | 1.5h |
| 5.3 | Implement WebSocket client | `assets/js/scoreboard.js` | 1h |
| 5.4 | Manual flag submission form + `/flags/submit` | `routes/flags.js` | 1h |
| 5.5 | User progress panel (flags captured, points, rank) | `pages/market.html` sidebar | 1h |
| 5.6 | Flag capture notifications (toast popup) | `assets/js/notifications.js` | 1h |

### Definition of Done
- [ ] Scoreboard updates in real-time when any user captures a flag
- [ ] Manual flag submit awards points and updates leaderboard
- [ ] User can see their own progress without refreshing
- [ ] Top 3 users highlighted on scoreboard

---

## ✨ Phase 6 — Polish & Documentation

**Goal**: Production-ready presentation, academic-quality docs.

### Tasks

| # | Task | File(s) | Est. |
|---|------|---------|------|
| 6.1 | Responsive design pass (mobile breakpoints) | All CSS | 2h |
| 6.2 | Onboarding flow (first-visit modal with rules) | `assets/js/onboarding.js` | 1h |
| 6.3 | Loading states, error messages, empty states | All pages | 1h |
| 6.4 | Write instructor writeups for all 6 flags | `docs/writeups/*.md` | 3h |
| 6.5 | Add screenshots to `docs/screenshots/` | — | 30m |
| 6.6 | Final README pass | `README.md` | 1h |
| 6.7 | Docker hardening (non-root user, health check) | `docker/Dockerfile` | 30m |
| 6.8 | `.gitignore`, `.env.example`, `CONTRIBUTING.md` | root | 30m |

---

## 🎯 Milestone Summary

| Milestone | When Complete | Deliverable |
|-----------|--------------|-------------|
| M1: Scaffold | End of Phase 1 | Browsable fake marketplace |
| M2: CTF Ready | End of Phase 2 | All 6 flags capturable |
| M3: Hacker Mode | End of Phase 3 | Terminal + hints working |
| M4: Analytics | End of Phase 4 | Dashboard with attack logs |
| M5: Gamified | End of Phase 5 | Live scoreboard + submissions |
| M6: Final | End of Phase 6 | Polished, documented, deployable |

---

## 📋 `package.json` Reference

```json
{
  "name": "dark-market-sim",
  "version": "1.0.0",
  "description": "Educational CTF-style intentionally vulnerable marketplace",
  "main": "server/app.js",
  "scripts": {
    "start": "node server/app.js",
    "dev": "nodemon server/app.js",
    "db:seed": "node server/db/seed.js",
    "db:reset": "rm -f server/db/market.sqlite && node server/db/seed.js",
    "test": "echo \"No automated tests — manual CTF testing\""
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "express": "^4.18.3",
    "express-session": "^1.18.0",
    "jsonwebtoken": "^9.0.2",
    "node-fetch": "^2.7.0",
    "winston": "^3.11.0",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```
