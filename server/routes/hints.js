'use strict';

const express = require('express');
const router = express.Router();
const hintInjector = require('../middleware/hintInjector');

// ── GET /api/hints ────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { page } = req.query;
  const hints = hintInjector.getHints(page);
  res.json({ success: true, hints });
});

module.exports = router;
