'use strict';

// Page-specific hints for Hacker Mode
const HINTS = {
  login: [
    { severity: 'low',  text: 'This login form has no rate limiting or CAPTCHA.' },
    { severity: 'high', text: "What happens if the username field contains a single quote ( ' )?" },
    { severity: 'high', text: "Try: ' OR 1=1 -- as the username. What does the server say?" },
  ],
  market: [
    { severity: 'low',  text: 'Look at the URL structure for individual listings.' },
    { severity: 'low',  text: 'The comment section on listings might not sanitize input.' },
    { severity: 'med',  text: 'Your session JWT might be weaker than it looks. Try decoding it at jwt.io.' },
  ],
  listing: [
    { severity: 'high', text: 'Comments are rendered directly into the DOM. No sanitization detected.' },
    { severity: 'high', text: "Try posting: <script>alert(1)</script> as a comment." },
    { severity: 'med',  text: "XSS beacon at /flags/xss-beacon — what if your payload calls it?" },
  ],
  orders: [
    { severity: 'high', text: 'No ownership check on /orders/:id. Try changing the order ID in the URL.' },
    { severity: 'med',  text: "You own order #12. What's in order #1?" },
  ],
  files: [
    { severity: 'high', text: 'The file endpoint accepts a filename. What if you pass a path?' },
    { severity: 'high', text: "Try: /files?file=../../../.env" },
    { severity: 'med',  text: 'URL encode the dots: %2e%2e%2f' },
  ],
  admin: [
    { severity: 'high', text: 'Admin panel protected only by JWT signature — no role check.' },
    { severity: 'high', text: "JWT secret is 'supersecret'. Forge a token with role:'admin'." },
    { severity: 'med',  text: "Use: node -e \"console.log(require('jsonwebtoken').sign({id:1,role:'admin'},'supersecret'))\"" },
  ],
};

/**
 * Injects CTF hints into response headers for Hacker Mode.
 * Also exposes /api/hints endpoint logic (mounted by app.js).
 */
const hintInjector = (req, res, next) => {
  // Inject a subtle header hinting at Hacker Mode
  res.setHeader('X-CTF-Hint', 'Enable Hacker Mode for page-specific guidance.');
  next();
};

hintInjector.getHints = (page) => HINTS[page] || [];

module.exports = hintInjector;
