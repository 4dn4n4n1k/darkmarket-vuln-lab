'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'market.sqlite');
const FLAG_SALT = process.env.FLAG_SALT || 'DMS_INTERNAL_SALT';

// ── Ensure DB directory exists ──────────────────────────────────────────────
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── Load and execute schema ─────────────────────────────────────────────────
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

// Drop and recreate flags + captures so level/prerequisite columns are fresh
db.exec('DROP TABLE IF EXISTS flag_captures;');
db.exec('DROP TABLE IF EXISTS flags;');
db.exec(schema);

console.log('✅ Schema applied.');

// ── Flag token generator ────────────────────────────────────────────────────
function generateToken(name, difficulty) {
  const hex = crypto
    .createHmac('sha256', FLAG_SALT)
    .update(name)
    .digest('hex')
    .slice(0, 8);
  const vuln = name.replace('flag_', '').replace(/_/g, '-');
  return `DMS{${hex}_${vuln}_${difficulty}}`;
}

// ── Seed flags (ordered — each level requires the previous one) ───────────────
// Level 1 → 2 → 3 → 4 → 5 → 6, each gate locked behind its predecessor.
const flagDefs = [
  { level: 1, name: 'flag_sqli_login',     vulnerability: 'SQL Injection',   points: 100, difficulty: 'easy',   prerequisite: null },
  { level: 2, name: 'flag_jwt_forge',      vulnerability: 'Broken JWT Auth', points: 150, difficulty: 'medium', prerequisite: 'flag_sqli_login'     },
  { level: 3, name: 'flag_stored_xss',     vulnerability: 'Stored XSS',      points: 150, difficulty: 'medium', prerequisite: 'flag_jwt_forge'      },
  { level: 4, name: 'flag_idor_order',     vulnerability: 'IDOR',            points: 200, difficulty: 'medium', prerequisite: 'flag_stored_xss'     },
  { level: 5, name: 'flag_path_traversal', vulnerability: 'Path Traversal',  points: 250, difficulty: 'hard',   prerequisite: 'flag_idor_order'     },
  { level: 6, name: 'flag_ssrf',           vulnerability: 'SSRF',            points: 300, difficulty: 'hard',   prerequisite: 'flag_path_traversal' },
];

// Insert flags one-by-one (sequential) so prerequisite_flag_id can reference the row just inserted.
const flagsTransaction = db.transaction(() => {
  for (const f of flagDefs) {
    const token = generateToken(f.name, f.difficulty);
    const prereqRow = f.prerequisite
      ? db.prepare('SELECT id FROM flags WHERE name = ?').get(f.prerequisite)
      : null;
    db.prepare(
      `INSERT INTO flags (name, token, vulnerability, points, difficulty, level, prerequisite_flag_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(f.name, token, f.vulnerability, f.points, f.difficulty, f.level, prereqRow?.id ?? null);
    console.log(`  🏴 [Lvl ${f.level}] ${f.name}: ${token}`);
  }
});
flagsTransaction();
console.log('✅ Flags seeded.');

// ── MD5 helper (intentionally weak) ─────────────────────────────────────────
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// ── Seed users ───────────────────────────────────────────────────────────────
const users = [
  { username: 'admin',    password: md5('admin123'), role: 'admin'  },
  { username: 'd4t4b0y',  password: md5('hunter22'), role: 'seller' },
  { username: 'z3r0day',  password: md5('qwerty99'), role: 'seller' },
  { username: 'ghost99',  password: md5('pass1234'), role: 'buyer'  },
  { username: 'hax0r',    password: md5('secret42'), role: 'buyer'  },
  { username: 'n0m4d',    password: md5('abc12345'), role: 'buyer'  },
  { username: 'darkweb1', password: md5('hello123'), role: 'seller' },
  { username: 'cyph3r',   password: md5('cyph3r99'), role: 'buyer'  },
];

const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)'
);
const usersTransaction = db.transaction(() => {
  for (const u of users) {
    insertUser.run(u.username, u.password, u.role);
  }
});
usersTransaction();
console.log(`✅ Users seeded (${users.length} users).`);

// ── Seed listings ────────────────────────────────────────────────────────────
const listings = [
  {
    title: 'Database Dump — Fortune 500 (Encrypted)',
    description: '3.2M records including emails and MD5 hashes. Fortune 500 company. Sample available upon request. Verified by 3 independent buyers.',
    price_btc: 0.045,
    seller: 'd4t4b0y',
    category: 'data',
    rating: 4.2,
    is_featured: 1,
  },
  {
    title: 'Zero-Day: Apache RCE (CVE-FAKE-001)',
    description: 'Pre-auth remote code execution on Apache 2.4.x. Full working PoC included. Tested on Ubuntu 22.04 and CentOS 9. No patch available.',
    price_btc: 1.25,
    seller: 'z3r0day',
    category: 'exploits',
    rating: 4.8,
    is_featured: 1,
  },
  {
    title: 'Credential Stealer Kit v3.2',
    description: 'Modular browser credential harvester. Supports Chrome, Firefox, Edge. Auto-exfil via Telegram bot. FUD for 30 days guaranteed.',
    price_btc: 0.012,
    seller: 'darkweb1',
    category: 'tools',
    rating: 3.9,
    is_featured: 0,
  },
  {
    title: 'RDP Access — EU Financial Institution',
    description: 'Persistent admin-level RDP to mid-size bank. Win Server 2019. AV disabled. Guaranteed 72h access window. Logs cleaned.',
    price_btc: 0.38,
    seller: 'd4t4b0y',
    category: 'access',
    rating: 4.6,
    is_featured: 1,
  },
  {
    title: 'Phishing Kit — Banking Portals x12',
    description: '12 cloned banking portals with backend credential capture. Includes hosting setup guide. Anti-detect measures built in.',
    price_btc: 0.008,
    seller: 'darkweb1',
    category: 'tools',
    rating: 4.1,
    is_featured: 0,
  },
  {
    title: 'Social Security Number Database — 800K Records',
    description: 'Full name, DOB, SSN, address. Scraped from healthcare breach. 98% validity rate tested. Segmented by state.',
    price_btc: 0.22,
    seller: 'd4t4b0y',
    category: 'data',
    rating: 3.7,
    is_featured: 0,
  },
  {
    title: 'SSH Botnet C2 Panel Access',
    description: '4,200 compromised SSH nodes. Global distribution. Panel includes geolocation, bandwidth stats, and batch command execution.',
    price_btc: 0.55,
    seller: 'z3r0day',
    category: 'access',
    rating: 4.4,
    is_featured: 1,
  },
  {
    title: 'Ransomware Builder — Custom Strains',
    description: 'Drag-and-drop ransomware builder. AES-256 encryption, Tor C2, auto-propagation via SMB. Monthly updates included.',
    price_btc: 0.09,
    seller: 'darkweb1',
    category: 'tools',
    rating: 4.0,
    is_featured: 0,
  },
  {
    title: 'Credit Card Fullz — Fresh Batch (Jan 2025)',
    description: '500 credit card fullz. Valid through 2026. US-issued. Includes billing address, CVV, SSN. Guaranteed 90% hit rate.',
    price_btc: 0.03,
    seller: 'd4t4b0y',
    category: 'data',
    rating: 4.3,
    is_featured: 0,
  },
  {
    title: 'Keylogger: Silent Phantom v2',
    description: 'Kernel-level keylogger. Supports Windows 10/11. Encrypted log exfil via DNS tunneling. Survives reboots and AV scans.',
    price_btc: 0.007,
    seller: 'z3r0day',
    category: 'tools',
    rating: 4.5,
    is_featured: 1,
  },
  {
    title: 'Insider Threat Package — Tech Giant',
    description: 'Ongoing access via disgruntled employee. Source code repos, internal Slack, email archives. Updated weekly.',
    price_btc: 2.1,
    seller: 'd4t4b0y',
    category: 'access',
    rating: 4.9,
    is_featured: 1,
  },
  {
    title: 'DDoS-as-a-Service — 500Gbps',
    description: 'Layer 3/4/7 DDoS. 500Gbps capacity. Hourly pricing. Bypass Cloudflare, Akamai. Dashboard with real-time stats.',
    price_btc: 0.02,
    seller: 'darkweb1',
    category: 'other',
    rating: 3.5,
    is_featured: 0,
  },
];

const insertListing = db.prepare(
  `INSERT OR IGNORE INTO listings (title, description, price_btc, seller_id, category, rating, is_featured)
   VALUES (?, ?, ?, (SELECT id FROM users WHERE username = ?), ?, ?, ?)`
);
const listingsTransaction = db.transaction(() => {
  for (const l of listings) {
    insertListing.run(l.title, l.description, l.price_btc, l.seller, l.category, l.rating, l.is_featured ? 1 : 0);
  }
});
listingsTransaction();
console.log(`✅ Listings seeded (${listings.length} listings).`);

// ── Seed orders (for IDOR Flag 4) ───────────────────────────────────────────
const orderNotes = [
  'Delivery via dead drop. Check channel 7 for coordinates.',
  'Key: 4a7d9f2c. Package left at node_7. Use the signal phrase.',
  'Monero wallet funded. Await confirmation on Jabber.',
  'Shipping via onion drop. Estimated 24h delivery window.',
  'Escrow released. Contact vendor for decryption key.',
  'Delivery confirmed by vendor. Check your dead drop box.',
  'Order processed. Awaiting payment confirmation.',
  'Encrypted package sent. Use key: X7-DELTA-9 to decrypt.',
  'VPN credentials enclosed. Connect before accessing resource.',
  'Package dispatched. Reference ID: DM-2025-0042.',
  'Secured via PGP. Fingerprint: 0xDEADBEEF.',
  'Vendor confirms receipt of payment. Awaiting shipment.',
  'Underground channel 12 activated. Monitor signal.',
  'Encrypted payload delivered. Decryption instructions in note.',
  'Hidden service up at: kq8m7...onion — use Tor only.',
  'Exchange initiated. 3 confirmations required.',
  'Access credentials sent via encrypted email.',
  'Digital handoff complete. Files available for 48h only.',
  'Escrow timer: 12h remaining. Confirm receipt.',
  'Job done. Wipe this note after reading.',
];

// Get user IDs
const buyerIds = db.prepare("SELECT id FROM users WHERE role = 'buyer' OR role = 'admin'").all().map(r => r.id);
const listingIds = db.prepare('SELECT id FROM listings').all().map(r => r.id);

const insertOrder = db.prepare(
  'INSERT OR IGNORE INTO orders (buyer_id, listing_id, amount_btc, status, secret_note) VALUES (?, ?, ?, ?, ?)'
);
const statuses = ['pending', 'delivered', 'disputed', 'completed'];
const ordersTransaction = db.transaction(() => {
  for (let i = 0; i < 20; i++) {
    const buyerId = buyerIds[i % buyerIds.length];
    const listingId = listingIds[i % listingIds.length];
    const amount = (Math.random() * 0.5 + 0.01).toFixed(4);
    const status = statuses[i % statuses.length];
    insertOrder.run(buyerId, listingId, parseFloat(amount), status, orderNotes[i]);
  }
});
ordersTransaction();
console.log('✅ Orders seeded (20 orders).');

// ── Seed comments (safe ones) ────────────────────────────────────────────────
const comments = [
  { listingId: 1, username: 'ghost99',  content: 'Legit, came as described. Quick delivery.' },
  { listingId: 1, username: 'hax0r',    content: 'Sample checked out. Buying full set.' },
  { listingId: 2, username: 'cyph3r',   content: 'Tested in lab env. Exploit works as described.' },
  { listingId: 4, username: 'n0m4d',    content: 'Access held for 72h as promised. 5 stars.' },
  { listingId: 7, username: 'ghost99',  content: 'C2 panel is clean. Nodes responsive globally.' },
  { listingId: 10, username: 'hax0r',   content: 'Kernel-level confirmed. Bypassed Defender on Win11.' },
];

const insertComment = db.prepare(
  `INSERT INTO comments (listing_id, user_id, content)
   VALUES (?, (SELECT id FROM users WHERE username = ?), ?)`
);
const commentsTransaction = db.transaction(() => {
  for (const c of comments) {
    try {
      insertComment.run(c.listingId, c.username, c.content);
    } catch (e) {
      // skip duplicates
    }
  }
});
commentsTransaction();
console.log(`✅ Comments seeded (${comments.length} comments).`);

// ── Create public directory with sample files ────────────────────────────────
const publicDir = path.join(__dirname, '../../client/public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(
  path.join(publicDir, 'readme.txt'),
  'DarkMarket Public File Server\n================================\nAvailable files: readme.txt, catalog.txt, terms.txt\n'
);
fs.writeFileSync(
  path.join(publicDir, 'catalog.txt'),
  'PRODUCT CATALOG v2.1\n====================\nSee /listings for full marketplace inventory.\nCategories: data, exploits, tools, access, other\n'
);
fs.writeFileSync(
  path.join(publicDir, 'terms.txt'),
  'TERMS OF SERVICE\n================\nAll sales are final. No refunds. Escrow recommended for orders > 0.1 BTC.\n'
);

console.log('✅ Public files created.');

db.close();
console.log('\n🎯 Database seeded successfully! Run: npm run dev\n');
