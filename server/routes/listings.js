'use strict';

// ⚠️ INTENTIONALLY VULNERABLE — Stored XSS in comments (Flag 3)
// Do NOT sanitize req.body.content. See SKILL.md 2.1.

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireAuth } = require('../middleware/authGuard');
const { AppError } = require('../utils/errors');

// ── GET /listings ─────────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const { category, sort, featured, search } = req.query;

    let sql = `
      SELECT l.*, u.username AS seller_username
      FROM listings l
      LEFT JOIN users u ON l.seller_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      sql += ' AND l.category = ?';
      params.push(category);
    }
    if (featured === 'true' || featured === '1') {
      sql += ' AND l.is_featured = 1';
    }
    if (search) {
      sql += ' AND l.title LIKE ?';
      params.push(`%${search}%`);
    }

    const ORDER_MAP = {
      price_asc:  'l.price_btc ASC',
      price_desc: 'l.price_btc DESC',
      rating:     'l.rating DESC',
    };
    sql += ` ORDER BY ${ORDER_MAP[sort] || 'l.is_featured DESC, l.created_at DESC'}`;

    const listings = db.prepare(sql).all(...params);

    // Reshape seller info
    const data = listings.map((l) => ({
      id:          l.id,
      title:       l.title,
      description: l.description,
      price_btc:   l.price_btc,
      seller:      { id: l.seller_id, username: l.seller_username },
      category:    l.category,
      rating:      l.rating,
      is_featured: l.is_featured,
      created_at:  l.created_at,
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── GET /listings/:id ─────────────────────────────────────────────────────────
router.get('/:id', (req, res, next) => {
  try {
    const listing = db.prepare(`
      SELECT l.*, u.username AS seller_username, u.id AS seller_id_ref
      FROM listings l
      LEFT JOIN users u ON l.seller_id = u.id
      WHERE l.id = ?
    `).get(req.params.id);

    if (!listing) throw new AppError('Listing not found.', 404);

    // Comments — raw content, NOT sanitized (XSS vector)
    const comments = db.prepare(`
      SELECT c.id, c.content, c.created_at, u.username
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.listing_id = ?
      ORDER BY c.created_at ASC
    `).all(req.params.id);

    res.json({
      success: true,
      data: {
        id:          listing.id,
        title:       listing.title,
        description: listing.description,
        price_btc:   listing.price_btc,
        seller:      { id: listing.seller_id, username: listing.seller_username },
        category:    listing.category,
        rating:      listing.rating,
        is_featured: listing.is_featured,
        comments,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /listings/:id/comments ───────────────────────────────────────────────
// ⚠️ VULNERABLE TO STORED XSS (Flag 3) — do NOT sanitize content
router.post('/:id/comments', requireAuth, (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: 'Comment content required.' });
    }

    const listing = db.prepare('SELECT id FROM listings WHERE id = ?').get(req.params.id);
    if (!listing) throw new AppError('Listing not found.', 404);

    // INTENTIONALLY UNSANITIZED — Do not add sanitize-html here
    db.prepare(
      'INSERT INTO comments (listing_id, user_id, content) VALUES (?, ?, ?)'
    ).run(req.params.id, req.session.userId, content);

    res.json({ success: true, message: 'Comment posted.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /listings ────────────────────────────────────────────────────────────
router.post('/', requireAuth, (req, res, next) => {
  try {
    const { role } = req.session;
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Sellers only.' });
    }

    const { title, description, price_btc, category } = req.body;
    if (!title || !price_btc) {
      return res.status(400).json({ success: false, message: 'Title and price required.' });
    }

    const result = db.prepare(
      'INSERT INTO listings (title, description, price_btc, seller_id, category) VALUES (?, ?, ?, ?, ?)'
    ).run(title, description || '', parseFloat(price_btc), req.session.userId, category || 'other');

    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
