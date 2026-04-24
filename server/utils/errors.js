'use strict';

/**
 * AppError — Structured error class for the centralized error handler.
 * Use this instead of raw res.status().json() calls.
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

module.exports = { AppError };
