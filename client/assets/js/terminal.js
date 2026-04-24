'use strict';
// terminal.js — Simulated CLI terminal for Hacker Mode

const HISTORY = [];
let histIdx = -1;

// ── Command Registry ─────────────────────────────────────────────────────────
const COMMANDS = {
  help:       { desc: 'List all available commands',        handler: cmdHelp      },
  nmap:       { desc: 'Fake port scan of localhost',        handler: cmdNmap      },
  sqlmap:     { desc: 'Hint at SQL injectable endpoints',   handler: cmdSqlmap    },
  whoami:     { desc: 'Show current session user info',     handler: cmdWhoami    },
  ls:         { desc: 'List fake files on the server',      handler: cmdLs        },
  'jwt-decode': { desc: 'Decode a pasted JWT token',       handler: cmdJwtDecode },
  'crack-jwt':  { desc: 'Hint about JWT weakness (Flag 2)', handler: cmdCrackJwt  },
  flag:       { desc: 'Show your captured flags',           handler: cmdFlag      },
  dump:       { desc: 'Hints about DB dumping (Flag 1)',    handler: cmdDump      },
  history:    { desc: 'Show command history',               handler: cmdHistory   },
  clear:      { desc: 'Clear the terminal',                 handler: cmdClear     },
  // Add new commands below:
  // myCmd: { desc: 'Description', handler: cmdMyCmd },
};

function printLine(text, cls = 'out') {
  const out = document.getElementById('terminal-output');
  if (!out) return;
  const line = document.createElement('div');
  line.className = 'terminal-line ' + cls;
  line.textContent = text;
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}

function printBlank() {
  const out = document.getElementById('terminal-output');
  if (!out) return;
  const line = document.createElement('div');
  line.className = 'terminal-line blank';
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}

function printWelcome() {
  const out = document.getElementById('terminal-output');
  if (out && out.children.length > 0) return; // already printed

  printLine('DarkMarket Terminal v1.0 — CTF Security Training', 'cmd');
  printLine('Type \'help\' to see available commands.', 'info');
  printLine('Tip: This terminal contains educational hints only.', 'out');
  printBlank();
}

// ── Command Handlers ─────────────────────────────────────────────────────────

function cmdHelp() {
  printLine('Available commands:', 'cmd');
  for (const [name, def] of Object.entries(COMMANDS)) {
    printLine(`  ${name.padEnd(14)} — ${def.desc}`, 'out');
  }
  printBlank();
}

function cmdNmap() {
  const lines = [
    'Starting Nmap 7.94 ( https://nmap.org )',
    'Nmap scan report for localhost (127.0.0.1)',
    'Host is up (0.0001s latency).',
    '',
    'PORT     STATE SERVICE VERSION',
    '3000/tcp open  http    Node.js Express',
    '  | http-title: DarkMarket',
    '  |_http-auth: No authentication required on /listings, /flags',
    '',
    'Service detection performed.',
    '1 IP address (1 host up) scanned in 0.22 seconds',
  ];
  lines.forEach(l => printLine(l, l.startsWith('3000') ? 'flag' : 'out'));
  printBlank();
}

function cmdSqlmap() {
  const lines = [
    '[INFO] Testing connection to target URL: http://localhost:3000/auth/login',
    '[INFO] Testing if POST parameter \'username\' is dynamic',
    '[WARN] Possible injectable parameter: username (error-based)',
    '[HINT] Try payload: \' OR 1=1 --',
    '[HINT] Server returns stack traces on SQL errors — useful for blind injection',
    '[INFO] Endpoint /auth/login appears vulnerable to SQL injection (Flag 1)',
  ];
  lines.forEach(l => printLine(l, l.includes('HINT') || l.includes('vulnerable') ? 'flag' : 'out'));
  printBlank();
}

async function cmdWhoami() {
  try {
    const res  = await fetch('/auth/me');
    const data = await res.json();
    if (data.success) {
      const u = data.data;
      printLine(`User: ${u.username}`, 'cmd');
      printLine(`  ID:   ${u.id}`, 'out');
      printLine(`  Role: ${u.role}`, 'out');
      printLine(`  JWT:  ${localStorage.getItem('dm_token') || '(not stored)'}`, 'out');
    } else {
      printLine('Not authenticated.', 'err');
    }
  } catch {
    printLine('Error fetching user.', 'err');
  }
  printBlank();
}

function cmdLs() {
  const files = [
    'drwxr-xr-x  client/public/',
    '-rw-r--r--  client/public/readme.txt',
    '-rw-r--r--  client/public/catalog.txt',
    '-rw-r--r--  client/public/terms.txt',
    '            [hint: try /files?file=../../../.env]',
  ];
  files.forEach(f => printLine(f, f.includes('hint') ? 'flag' : 'out'));
  printBlank();
}

function cmdJwtDecode(args) {
  const token = args[0] || localStorage.getItem('dm_token');
  if (!token) {
    printLine('Usage: jwt-decode <token>  (or store a token in localStorage as dm_token)', 'err');
    return;
  }
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT structure.');
    const payload = JSON.parse(atob(parts[1]));
    printLine('JWT Payload:', 'cmd');
    for (const [k, v] of Object.entries(payload)) {
      printLine(`  ${k}: ${JSON.stringify(v)}`, 'out');
    }
    printLine('Header alg: ' + JSON.parse(atob(parts[0])).alg, 'out');
    printBlank();
    printLine('[HINT] HS256 + weak secret = brute-forceable. Try: crack-jwt', 'flag');
  } catch {
    printLine('Failed to decode. Is this a valid JWT?', 'err');
  }
  printBlank();
}

function cmdCrackJwt() {
  const lines = [
    '[INFO] Analyzing JWT algorithm: HS256',
    '[INFO] HMAC-SHA256 with a guessable secret is crackable via wordlists.',
    '[HINT] The JWT secret is stored in .env as JWT_SECRET.',
    '[HINT] Try path traversal to read .env: /files?file=../../../.env',
    '[HINT] Common weak secrets: secret, password, 123456, supersecret',
    '[PAYLOAD] node -e "console.log(require(\'jsonwebtoken\').sign({id:1,role:\'admin\'},\'supersecret\'))"',
    '[TARGET] Use forged token on /admin endpoint.',
  ];
  lines.forEach(l => printLine(l, l.includes('HINT') || l.includes('PAYLOAD') ? 'flag' : 'out'));
  printBlank();
}

async function cmdFlag() {
  try {
    const res  = await fetch('/flags');
    const data = await res.json();
    printLine('Flag Status:', 'cmd');
    for (const f of data.data) {
      const icon = f.captured ? '✓' : '○';
      const cls  = f.captured ? 'flag' : 'out';
      printLine(`  ${icon} ${f.vulnerability.padEnd(20)} ${f.points}pts  [${f.difficulty}]`, cls);
    }
    const captured = data.data.filter(f => f.captured).length;
    printLine(`\nCaptured: ${captured}/${data.data.length}`, captured > 0 ? 'flag' : 'out');
  } catch {
    printLine('Error loading flags.', 'err');
  }
  printBlank();
}

function cmdDump() {
  const lines = [
    '[INFO] Database: SQLite (better-sqlite3)',
    '[INFO] Path: server/db/market.sqlite',
    '[HINT] Login form uses raw SQL string concatenation.',
    '[HINT] Payload: \' OR 1=1 --  → bypasses authentication',
    '[HINT] UNION-based: \' UNION SELECT 1,\'admin\',\'x\',\'admin\',null,null --',
    '[HINT] Once logged in as admin, JWT is issued — capture it (whoami)',
  ];
  lines.forEach(l => printLine(l, l.includes('HINT') || l.includes('PAYLOAD') ? 'flag' : 'out'));
  printBlank();
}

function cmdHistory() {
  if (!HISTORY.length) {
    printLine('No command history.', 'out');
    return;
  }
  HISTORY.forEach((cmd, i) => printLine(`  ${i + 1}  ${cmd}`, 'out'));
  printBlank();
}

function cmdClear() {
  const out = document.getElementById('terminal-output');
  if (out) out.innerHTML = '';
}

// ── Input Handler ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('terminal-input');
  if (!input) return;

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowUp') {
      if (histIdx < HISTORY.length - 1) histIdx++;
      input.value = HISTORY[HISTORY.length - 1 - histIdx] || '';
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      if (histIdx > 0) histIdx--;
      else { histIdx = -1; input.value = ''; }
      input.value = HISTORY[HISTORY.length - 1 - histIdx] || '';
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const raw = input.value.trim();
      if (!raw) return;

      HISTORY.push(raw);
      histIdx = -1;
      input.value = '';

      printLine('$ ' + raw, 'cmd');

      const [cmd, ...args] = raw.split(' ');
      const def = COMMANDS[cmd.toLowerCase()];

      if (def) {
        await def.handler(args);
      } else {
        printLine(`Command not found: ${cmd}. Type 'help'.`, 'err');
        printBlank();
      }
    }
  });
});
