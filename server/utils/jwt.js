'use strict';

// INTENTIONALLY WEAK — Do not change JWT_SECRET value or algorithm.
// Flag 2 ("Token Heist") depends on this secret being brute-forceable.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

/**
 * Sign a payload — no expiry intentionally (Flag 2 attack surface).
 * @param {object} payload
 * @returns {string} JWT token
 */
const sign = (payload) => jwt.sign(payload, JWT_SECRET);

/**
 * Verify a token — only checks signature, not role/expiry.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verify = (token) => jwt.verify(token, JWT_SECRET);

module.exports = { sign, verify, JWT_SECRET };
