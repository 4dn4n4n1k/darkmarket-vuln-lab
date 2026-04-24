'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// ── GET /score ────────────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const rows = db.prepare(`
      SELECT u.id, u.username,
             COALESCE(SUM(f.points), 0) AS total_points,
             COUNT(fc.id) AS flags_captured,
             MAX(fc.captured_at) AS last_capture
      FROM users u
      LEFT JOIN flag_captures fc ON fc.user_id = u.id
      LEFT JOIN flags f ON f.id = fc.flag_id
      GROUP BY u.id
      HAVING flags_captured > 0
      ORDER BY total_points DESC, last_capture ASC
      LIMIT 20
    `).all();

    const data = rows.map((r, i) => ({
      rank:           i + 1,
      username:       r.username,
      points:         r.total_points,
      flags_captured: r.flags_captured,
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
