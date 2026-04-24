'use strict';

const { AppError } = require('../utils/errors');

/**
 * Middleware: requires an active session.
 */
const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  next();
};

/**
 * Middleware: requires admin role in session.
 */
const requireAdmin = (req, res, next) => {
  if (!req.session?.userId || req.session?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden.' });
  }
  next();
};

module.exports = { requireAuth, requireAdmin };
