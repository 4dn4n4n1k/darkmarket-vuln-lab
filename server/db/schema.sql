-- server/db/schema.sql
-- Dark Market Simulator — Database Schema

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,          -- MD5 (intentionally weak for Flag 2)
    role TEXT DEFAULT 'buyer',       -- 'buyer' | 'seller' | 'admin'
    session_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price_btc REAL NOT NULL,
    seller_id INTEGER REFERENCES users(id),
    category TEXT,
    rating REAL DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER REFERENCES listings(id),
    user_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,           -- NOT sanitized → Stored XSS (Flag 3)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER REFERENCES users(id),
    listing_id INTEGER REFERENCES listings(id),
    amount_btc REAL,
    status TEXT DEFAULT 'pending',
    secret_note TEXT,                -- Exposed via IDOR (Flag 4)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token TEXT NOT NULL,             -- e.g., DMS{s0m3_h4sh_h3r3}
    vulnerability TEXT NOT NULL,
    points INTEGER NOT NULL,
    difficulty TEXT NOT NULL,        -- 'easy' | 'medium' | 'hard'
    level INTEGER NOT NULL DEFAULT 1,               -- CTF level (1 = first challenge)
    prerequisite_flag_id INTEGER REFERENCES flags(id) -- NULL = always unlocked
);

CREATE TABLE IF NOT EXISTS flag_captures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    flag_id INTEGER REFERENCES flags(id),
    payload_used TEXT,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, flag_id)
);

CREATE TABLE IF NOT EXISTS attack_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    payload TEXT,
    pattern_matched TEXT,            -- Which PATTERNS key matched
    flag_triggered INTEGER REFERENCES flags(id),
    session_user_id INTEGER REFERENCES users(id)
);
