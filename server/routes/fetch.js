'use strict';

// ⚠️ INTENTIONALLY VULNERABLE — SSRF (Flag 6)
// Do NOT validate or whitelist URLs. See SKILL.md 2.1.

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { requireAuth } = require('../middleware/authGuard');
const flagService = require('../utils/flagService');

// ── POST /fetch-preview ───────────────────────────────────────────────────────
// ⚠️ VULNERABLE TO SSRF (Flag 6)
router.post('/', requireAuth, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ success: false, message: 'url is required.' });
  }

  try {
    // INTENTIONALLY VULNERABLE — No URL validation or whitelist
    const response = await fetch(url, { timeout: 5000 });
    const body = await response.text();

    // Award flag if internal service is probed
    if (
      url.includes('localhost') ||
      url.includes('127.0.0.1') ||
      url.includes('169.254')
    ) {
      const flag = flagService.award({
        userId: req.session?.userId || null,
        flagName: 'flag_ssrf',
        payloadUsed: url,
        req,
      });
      return res.json({ content: body, flag: flag.token });
    }

    res.json({ content: body.substring(0, 2000) });
  } catch (err) {
    // VERBOSE_ERROR_INTENTIONAL
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
