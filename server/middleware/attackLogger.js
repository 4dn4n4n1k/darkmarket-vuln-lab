'use strict';

const db = require('../db/connection');

// ── Attack pattern library ───────────────────────────────────────────────────
const PATTERNS = {
  sqli:      [/('|--|;|OR\s+1=1|UNION\s+SELECT)/i],
  xss:       [/<script|onerror\s*=|javascript:/i],
  traversal: [/\.\.\//],
  ssrf:      [/(localhost|127\.0\.0\.1|169\.254)/i],
  jwt:       [/eyJ[A-Za-z0-9+/=]+\.eyJ/],
};

/**
 * Inspects all request body fields, query params, and URL for attack patterns.
 * Matching requests are recorded in attack_logs.
 */
function detectPattern(input) {
  if (!input) return null;
  const str = typeof input === 'object' ? JSON.stringify(input) : String(input);
  for (const [name, regexes] of Object.entries(PATTERNS)) {
    for (const re of regexes) {
      if (re.test(str)) return name;
    }
  }
  return null;
}

function extractPayload(req) {
  const parts = [];
  if (req.body && Object.keys(req.body).length) parts.push(JSON.stringify(req.body));
  if (req.query && Object.keys(req.query).length) parts.push(JSON.stringify(req.query));
  return parts.join(' | ') || null;
}

const attackLogger = (req, res, next) => {
  const payload = extractPayload(req);
  const pattern = detectPattern(payload) || detectPattern(req.url);

  if (pattern) {
    try {
      db.prepare(
        `INSERT INTO attack_logs (ip_address, user_agent, endpoint, method, payload, pattern_matched, session_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        req.ip || req.socket?.remoteAddress || 'unknown',
        req.get('user-agent') || 'unknown',
        req.path,
        req.method,
        payload,
        pattern,
        req.session?.userId || null
      );
    } catch (err) {
      // Non-fatal — log to console only
      console.error('[attackLogger] DB write error:', err.message);
    }
  }

  next();
};

/**
 * Manual log trigger for edge cases inside route handlers.
 */
attackLogger.record = ({ req, pattern, flagId = null, note = '' }) => {
  try {
    db.prepare(
      `INSERT INTO attack_logs (ip_address, user_agent, endpoint, method, payload, pattern_matched, flag_triggered, session_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown',
      req.path,
      req.method,
      note,
      pattern,
      flagId,
      req.session?.userId || null
    );
  } catch (err) {
    console.error('[attackLogger.record] DB write error:', err.message);
  }
};

module.exports = attackLogger;
