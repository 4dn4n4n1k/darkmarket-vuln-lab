'use strict';

// ⚠️ INTENTIONALLY VULNERABLE — IDOR on GET /:id (Flag 4)
// Do NOT add WHERE buyer_id = userId check. See SKILL.md 2.1.

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireAuth } = require('../middleware/authGuard');
const flagService = require('../utils/flagService');
const { AppError } = require('../utils/errors');

// ── POST /orders ──────────────────────────────────────────────────────────────
router.post('/', requireAuth, (req, res, next) => {
  try {
    const { listing_id, amount_btc } = req.body;
    if (!listing_id || !amount_btc) {
      return res.status(400).json({ success: false, message: 'listing_id and amount_btc required.' });
    }

    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listing_id);
    if (!listing) throw new AppError('Listing not found.', 404);

    const note = 'Order placed via marketplace. Delivery details encrypted.';
    const result = db.prepare(
      'INSERT INTO orders (buyer_id, listing_id, amount_btc, status, secret_note) VALUES (?, ?, ?, ?, ?)'
    ).run(req.session.userId, listing_id, parseFloat(amount_btc), 'pending', note);

    res.json({ success: true, data: { id: result.lastInsertRowid, status: 'pending' } });
  } catch (err) {
    next(err);
  }
});

// ── GET /orders ───────────────────────────────────────────────────────────────
// Safe — uses buyer_id = userId (intentional contrast with the IDOR below)
router.get('/', requireAuth, (req, res, next) => {
  try {
    const orders = db.prepare(`
      SELECT o.id, o.listing_id, o.amount_btc, o.status, o.created_at, l.title AS listing_title
      FROM orders o
      LEFT JOIN listings l ON o.listing_id = l.id
      WHERE o.buyer_id = ?
      ORDER BY o.created_at DESC
    `).all(req.session.userId);

    res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
});

// ── GET /orders/:id ───────────────────────────────────────────────────────────
// ⚠️ VULNERABLE TO IDOR (Flag 4) — no ownership check
router.get('/:id', requireAuth, (req, res, next) => {
  try {
    // INTENTIONALLY VULNERABLE — Missing: WHERE buyer_id = req.session.userId
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);

    if (!order) throw new AppError('Order not found.', 404);

    // Flag awarded if user accesses someone else's order
    if (order.buyer_id !== req.session.userId) {
      const flag = flagService.award({
        userId: req.session.userId,
        flagName: 'flag_idor_order',
        payloadUsed: req.params.id,
        req,
      });
      return res.json({ success: true, data: order, flag: flag.token });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
