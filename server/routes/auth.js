'use strict';

// ⚠️ INTENTIONALLY VULNERABLE — SQL Injection (Flag 1) + Weak JWT (Flag 2)
// See SKILL.md section 2.1 for constraints. Do NOT fix these vulnerabilities.

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { sign } = require('../utils/jwt');
const flagService = require('../utils/flagService');
const { AppError } = require('../utils/errors');
const crypto = require('crypto');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// ── POST /auth/register ──────────────────────────────────────────────────────
router.post('/register', (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username already taken.' });
    }

    // MD5 hash — intentionally weak (Flag 2 attack surface)
    const hashed = md5(password);
    const result = db.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, 'buyer')"
    ).run(username, hashed);

    res.json({
      success: true,
      data: { id: result.lastInsertRowid, username, role: 'buyer' },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /auth/login ─────────────────────────────────────────────────────────
// ⚠️ VULNERABLE TO SQL INJECTION (Flag 1)
// Raw string concatenation — do NOT convert to parameterized query.
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Credentials required.' });
  }

  const hashedPw = md5(password);

  // INTENTIONALLY VULNERABLE — Do not refactor
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${hashedPw}'`;

  try {
    const user = db.prepare(query).get(); // .get() throws on malformed SQL

    if (user) {
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.username = user.username;

      // Issue a JWT for /admin usage (intentionally weak)
      const token = sign({ id: user.id, username: user.username, role: user.role });

      // Award flag ONLY when admin was reached via SQL injection (not a normal login).
      // Detect injection by the presence of classic SQLi markers in the username field.
      const SQLI_PATTERN = /('|--|;|\bOR\b|\bUNION\b)/i;
      if (user.role === 'admin' && SQLI_PATTERN.test(username)) {
        const flag = flagService.award({
          userId: user.id,   // user.id is set in session above — points are now recorded
          flagName: 'flag_sqli_login',
          payloadUsed: username,
          req,
        });
        return res.json({
          success: true,
          redirect: '/market',
          token,
          flag: flag.token,
          message: 'Welcome back, admin.',
        });
      }

      return res.json({ success: true, redirect: '/market', token });
    }

    res.status(401).json({ success: false, message: 'Invalid credentials.' });
  } catch (err) {
    // Verbose error intentional — shows DB error to attacker
    // VERBOSE_ERROR_INTENTIONAL
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /auth/logout ────────────────────────────────────────────────────────
router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.json({ success: true, message: 'Logged out.' });
  });
});

// ── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  res.json({
    success: true,
    data: {
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
    },
  });
});

module.exports = router;
