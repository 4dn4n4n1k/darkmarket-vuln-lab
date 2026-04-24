'use strict';

// ⚠️ INTENTIONALLY VULNERABLE — Path Traversal (Flag 5)
// Do NOT use path.resolve() sanitization. See SKILL.md 2.1.

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const flagService = require('../utils/flagService');

const PUBLIC_DIR = path.join(__dirname, '../../client/public');

// ── GET /files ────────────────────────────────────────────────────────────────
// ⚠️ VULNERABLE TO PATH TRAVERSAL (Flag 5)
router.get('/', (req, res, next) => {
  try {
    const { file } = req.query;

    if (!file) {
      // List available files (only in PUBLIC_DIR)
      const files = fs.readdirSync(PUBLIC_DIR).filter((f) => {
        const fp = path.join(PUBLIC_DIR, f);
        return fs.statSync(fp).isFile();
      });
      return res.json({ success: true, data: files });
    }

    // INTENTIONALLY VULNERABLE — No path.resolve() sanitization
    const filePath = path.join(PUBLIC_DIR, file);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return res.status(400).json({ success: false, message: 'Not a file.' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Award flag if traversal leads outside PUBLIC_DIR and hits sensitive files
    const resolvedFile = path.resolve(filePath);
    const resolvedPublic = path.resolve(PUBLIC_DIR);
    const isTraversal = !resolvedFile.startsWith(resolvedPublic);

    if (isTraversal && (file.includes('.env') || file.includes('config') || file.includes('schema'))) {
      const flag = flagService.award({
        userId: req.session?.userId || null,
        flagName: 'flag_path_traversal',
        payloadUsed: file,
        req,
      });
      return res.type('text').send(`${content}\n\n<!-- FLAG: ${flag.token} -->`);
    }

    res.type('text').send(content);
  } catch (err) {
    // VERBOSE_ERROR_INTENTIONAL
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
