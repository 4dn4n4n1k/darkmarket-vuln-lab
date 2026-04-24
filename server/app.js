'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const path = require('path');
const http = require('http');
const session = require('express-session');
const WebSocket = require('ws');

// ── Routes ───────────────────────────────────────────────────────────────────
const authRoutes    = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const orderRoutes   = require('./routes/orders');
const fileRoutes    = require('./routes/files');
const fetchRoutes   = require('./routes/fetch');
const flagRoutes    = require('./routes/flags');
const adminRoutes   = require('./routes/admin');
const scoreRoutes   = require('./routes/score');
const hintRoutes    = require('./routes/hints');

// ── Middleware ───────────────────────────────────────────────────────────────
const attackLogger  = require('./middleware/attackLogger');
const hintInjector  = require('./middleware/hintInjector');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3000;

// ── WebSocket — Real-time Scoreboard ─────────────────────────────────────────
const wss = new WebSocket.Server({ server });

global.wsBroadcast = (data) => {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
};

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'connected', message: 'DarkMarket live feed connected.' }));
});

// ── Core Middleware ───────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session (intentionally weak secret)
app.use(session({
  secret:            process.env.SESSION_SECRET || 'notverysecret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge:   24 * 60 * 60 * 1000, // 24h
  },
}));

// Custom middleware
app.use(attackLogger);   // Logs suspicious payloads
app.use(hintInjector);   // Injects CTF hints into response headers

// ── Static Files ──────────────────────────────────────────────────────────────
app.use('/assets', express.static(path.join(__dirname, '../client/assets')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/auth',          authRoutes);
app.use('/listings',      listingRoutes);
app.use('/orders',        orderRoutes);
app.use('/files',         fileRoutes);
app.use('/fetch-preview', fetchRoutes);
app.use('/flags',         flagRoutes);
app.use('/admin',         adminRoutes);
app.use('/score',         scoreRoutes);
app.use('/api/hints',     hintRoutes);

// ── Page Routes (served BEFORE API routes where they conflict) ─────────────────
const pagesDir = path.join(__dirname, '../client/pages');

app.get('/', (req, res) => {
  if (req.session?.userId) {
    res.redirect('/market');
  } else {
    res.redirect('/login');
  }
});

app.get('/login',      (req, res) => res.sendFile(path.join(pagesDir, 'login.html')));
app.get('/market',     (req, res) => res.sendFile(path.join(pagesDir, 'market.html')));
app.get('/listing/:id',(req, res) => res.sendFile(path.join(pagesDir, 'listing.html')));
app.get('/scoreboard', (req, res) => res.sendFile(path.join(pagesDir, 'scoreboard.html')));
app.get('/dashboard',  (req, res) => res.sendFile(path.join(pagesDir, 'dashboard.html')));
// /orders page must come AFTER the API route since orderRoutes handles GET /
// The orders HTML page is served at /my-orders to avoid conflict with /orders API
app.get('/my-orders',  (req, res) => res.sendFile(path.join(pagesDir, 'orders.html')));
app.get('/attack-map', (req, res) => res.sendFile(path.join(pagesDir, 'attack-map.html')));

// ── Centralized Error Handler ─────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const status  = err.statusCode || 500;
  const message = err.name === 'AppError' ? err.message : 'Internal server error.';
  res.status(status).json({ success: false, message });
});

// ── Start Server ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🕶️  DarkMarket Simulator running at http://localhost:${PORT}`);
  console.log(`   Admin panel: http://localhost:${PORT}/dashboard`);
  console.log(`   Scoreboard:  http://localhost:${PORT}/scoreboard`);
  console.log(`\n   ⚠️  Educational CTF only — all vulnerabilities are intentional.\n`);
});

module.exports = { app, server };
