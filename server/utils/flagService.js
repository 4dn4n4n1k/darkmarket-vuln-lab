'use strict';

const crypto = require('crypto');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const db = require('../db/connection');

const FLAG_SALT = process.env.FLAG_SALT || 'DMS_INTERNAL_SALT';

/**
 * Generate a flag token from its name.
 * Matches the format used in seed.js.
 */
function generateToken(name, difficulty) {
  const hex = crypto
    .createHmac('sha256', FLAG_SALT)
    .update(name)
    .digest('hex')
    .slice(0, 8);
  const vuln = name.replace('flag_', '').replace(/_/g, '-');
  return `DMS{${hex}_${vuln}_${difficulty}}`;
}

/**
 * Award a flag to a user — with level-gated prerequisite enforcement.
 *
 * @param {object} opts
 * @param {number|null} opts.userId   — session user ID (null if unauthenticated)
 * @param {string}      opts.flagName — e.g. 'flag_sqli_login'
 * @param {string}      opts.payloadUsed
 * @param {object}      opts.req      — Express request (for logging)
 *
 * @returns {{ token, points, alreadyCaptured, locked, lockMessage, level }}
 */
function award({ userId, flagName, payloadUsed, req }) {
  const flag = db.prepare('SELECT * FROM flags WHERE name = ?').get(flagName);
  if (!flag) {
    console.warn(`[flagService] Unknown flag name: ${flagName}`);
    return { token: 'DMS{unknown_flag}', points: 0, alreadyCaptured: false, locked: false };
  }

  // ── Prerequisite / level-gate check ──────────────────────────────────────
  // A flag with a prerequisite_flag_id can only be awarded after the player
  // has already captured that prerequisite flag.
  if (flag.prerequisite_flag_id && userId) {
    const prereqCaptured = db
      .prepare('SELECT id FROM flag_captures WHERE user_id = ? AND flag_id = ?')
      .get(userId, flag.prerequisite_flag_id);

    if (!prereqCaptured) {
      const blocker = db
        .prepare('SELECT vulnerability, level FROM flags WHERE id = ?')
        .get(flag.prerequisite_flag_id);

      return {
        token:          null,
        points:         0,
        locked:         true,
        level:          flag.level,
        lockMessage:    `🔒 Level ${flag.level} is locked. Complete Level ${blocker?.level ?? '?'} (${blocker?.vulnerability ?? 'previous challenge'}) first.`,
        alreadyCaptured: false,
      };
    }
  }

  // ── Award ─────────────────────────────────────────────────────────────────
  let alreadyCaptured = false;

  if (userId) {
    const existing = db
      .prepare('SELECT id FROM flag_captures WHERE user_id = ? AND flag_id = ?')
      .get(userId, flag.id);

    if (existing) {
      alreadyCaptured = true;
    } else {
      db.prepare(
        'INSERT INTO flag_captures (user_id, flag_id, payload_used) VALUES (?, ?, ?)'
      ).run(userId, flag.id, payloadUsed || null);

      // Broadcast flag capture via WebSocket
      if (global.wsBroadcast) {
        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
        global.wsBroadcast({
          event:      'flag_captured',
          user:       user?.username || 'anonymous',
          flag:       flag.name,
          flag_level: flag.level,
          points:     flag.points,
          timestamp:  new Date().toISOString(),
        });
      }
    }
  }

  return {
    token:          flag.token,
    points:         flag.points,
    level:          flag.level,
    locked:         false,
    alreadyCaptured,
  };
}

module.exports = { award };
