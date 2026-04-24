'use strict';

// ⚠️ INTENTIONALLY VULNERABLE — Weak JWT (Flag 2)
// Only checks JWT signature, NOT user role. See CTF_CHALLENGES.md Flag 2.

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { verify } = require('../utils/jwt');
const flagService = require('../utils/flagService');

function getAdminData() {
  const totalUsers  = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const totalOrders = db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  const logsToday   = db.prepare(
    "SELECT COUNT(*) AS c FROM attack_logs WHERE timestamp >= datetime('now', '-1 day')"
  ).get().c;
  const topEndpoint = db.prepare(
    "SELECT endpoint, COUNT(*) AS cnt FROM attack_logs GROUP BY endpoint ORDER BY cnt DESC LIMIT 1"
  ).get();

  return {
    total_users:              totalUsers,
    total_orders:             totalOrders,
    attack_logs_today:        logsToday,
    top_targeted_endpoint:    topEndpoint?.endpoint || 'N/A',
  };
}

// ── GET /admin ────────────────────────────────────────────────────────────────
// ⚠️ VULNERABLE — only checks JWT signature, not role
router.get('/', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(403).json({ success: false, message: 'JWT required. Use Authorization: Bearer <token>' });
  }

  try {
    // INTENTIONALLY VULNERABLE — verifies signature but NOT role
    const decoded = verify(token);
    // Missing: if (decoded.role !== 'admin') throw new Error('Forbidden');

    const flag = flagService.award({
      userId: decoded.id || null,
      flagName: 'flag_jwt_forge',
      payloadUsed: token,
      req,
    });

    res.json({
      success: true,
      data:    getAdminData(),
      flag:    flag.token,
    });
  } catch (err) {
    res.status(403).json({ success: false, message: 'Invalid token.' });
  }
});

// ── GET /admin/logs ───────────────────────────────────────────────────────────
router.get('/logs', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(403).json({ success: false, message: 'JWT required.' });
  }

  try {
    verify(token); // Only signature check

    const { limit = 50, pattern, from } = req.query;
    let sql = 'SELECT * FROM attack_logs WHERE 1=1';
    const params = [];

    if (pattern) {
      sql += ' AND pattern_matched = ?';
      params.push(pattern);
    }
    if (from) {
      sql += ' AND timestamp >= ?';
      params.push(from);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = db.prepare(sql).all(...params);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(403).json({ success: false, message: 'Invalid token.' });
  }
});

// ── GET /admin/logs/export ────────────────────────────────────────────────────
router.get('/logs/export', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(403).json({ success: false, message: 'JWT required.' });

  try {
    verify(token);

    const logs = db.prepare('SELECT * FROM attack_logs ORDER BY timestamp DESC').all();
    const { format } = req.query;

    if (format === 'csv') {
      if (!logs.length) return res.type('text/csv').send('No logs.');
      const keys = Object.keys(logs[0]);
      const csv = [keys.join(','), ...logs.map((l) => keys.map((k) => JSON.stringify(l[k] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Disposition', 'attachment; filename="attack_logs.csv"');
      return res.type('text/csv').send(csv);
    }

    res.setHeader('Content-Disposition', 'attachment; filename="attack_logs.json"');
    res.json(logs);
  } catch (err) {
    res.status(403).json({ success: false, message: 'Invalid token.' });
  }
});

module.exports = router;
