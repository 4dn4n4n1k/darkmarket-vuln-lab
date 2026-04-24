'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireAuth } = require('../middleware/authGuard');
const flagService = require('../utils/flagService');

// ── GET /flags ────────────────────────────────────────────────────────────────
// Returns all flags ordered by level with locked/captured status per user.
router.get('/', (req, res, next) => {
  try {
    const flags = db
      .prepare('SELECT id, name, vulnerability, points, difficulty, level, prerequisite_flag_id FROM flags ORDER BY level ASC')
      .all();

    const userId = req.session?.userId;
    const capturedIds = userId
      ? db.prepare('SELECT flag_id FROM flag_captures WHERE user_id = ?').all(userId).map(r => r.flag_id)
      : [];

    const data = flags.map(f => {
      const captured = capturedIds.includes(f.id);
      const locked   = f.prerequisite_flag_id
        ? !capturedIds.includes(f.prerequisite_flag_id)
        : false;

      return {
        id:                  f.id,
        name:                f.name,
        vulnerability:       f.vulnerability,
        points:              f.points,
        difficulty:          f.difficulty,
        level:               f.level,
        captured,
        locked,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── GET /flags/xss-beacon ─────────────────────────────────────────────────────
// ⚠️ XSS Flag Trigger — called by successful XSS payloads (Flag 3)
router.get('/xss-beacon', (req, res, next) => {
  try {
    const result = flagService.award({
      userId:      req.session?.userId || null,
      flagName:    'flag_stored_xss',
      payloadUsed: 'xss-beacon',
      req,
    });

    if (result.locked) {
      return res.status(403).json({ success: false, locked: true, message: result.lockMessage });
    }

    res.json({ success: true, flag: result.token, level: result.level });
  } catch (err) {
    next(err);
  }
});

// ── POST /flags/submit ────────────────────────────────────────────────────────
// Manual flag token submission with prerequisite gating.
router.post('/submit', requireAuth, (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token required.' });
    }

    const flag = db.prepare('SELECT * FROM flags WHERE token = ?').get(token);
    if (!flag) {
      return res.status(404).json({ success: false, message: 'Unknown flag token.' });
    }

    // ── Level-gate: check prerequisite ─────────────────────────────────────
    if (flag.prerequisite_flag_id) {
      const prereqCaptured = db
        .prepare('SELECT id FROM flag_captures WHERE user_id = ? AND flag_id = ?')
        .get(req.session.userId, flag.prerequisite_flag_id);

      if (!prereqCaptured) {
        const blocker = db
          .prepare('SELECT vulnerability, level FROM flags WHERE id = ?')
          .get(flag.prerequisite_flag_id);
        return res.status(403).json({
          success: false,
          locked:  true,
          message: `🔒 Level ${flag.level} is locked. Complete Level ${blocker?.level ?? '?'} (${blocker?.vulnerability ?? 'previous challenge'}) first.`,
        });
      }
    }

    // ── Check if already captured ───────────────────────────────────────────
    const existing = db
      .prepare('SELECT id FROM flag_captures WHERE user_id = ? AND flag_id = ?')
      .get(req.session.userId, flag.id);

    if (existing) {
      return res.json({ success: false, message: 'Flag already captured.', points_earned: 0 });
    }

    // ── Record capture ──────────────────────────────────────────────────────
    db.prepare(
      'INSERT INTO flag_captures (user_id, flag_id, payload_used) VALUES (?, ?, ?)'
    ).run(req.session.userId, flag.id, 'manual-submit');

    if (global.wsBroadcast) {
      global.wsBroadcast({
        event:      'flag_captured',
        user:       req.session.username,
        flag:       flag.name,
        flag_level: flag.level,
        points:     flag.points,
        timestamp:  new Date().toISOString(),
      });
    }

    res.json({
      success:      true,
      message:      `✅ Flag accepted! +${flag.points} points. Level ${flag.level} complete.`,
      points_earned: flag.points,
      level:        flag.level,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
