'use strict';

const path = require('path');
const Database = require('better-sqlite3');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'market.sqlite');

let db;

try {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.error('❌ Failed to open database:', err.message);
  console.error('Run `npm run db:seed` first.');
  process.exit(1);
}

module.exports = db;
