'use strict';
// hacker-mode.js — Toggle hacker UI and fetch page-specific hints

let hackerActive = false;
let currentPage = 'market';

function initHackerMode(page) {
  currentPage = page || 'market';

  const btn   = document.getElementById('hacker-toggle');
  const panel = document.getElementById('hacker-panel');

  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    if (hackerActive) {
      closeHacker();
    } else {
      openHacker();
    }
  });

  // Auto-fetch hints
  fetchHints(currentPage);
}

function openHacker() {
  hackerActive = true;
  const panel = document.getElementById('hacker-panel');
  const btn   = document.getElementById('hacker-toggle');

  panel?.classList.remove('hidden');
  btn?.classList.add('active');
  document.body.classList.add('hacker-mode');

  // Focus terminal input
  setTimeout(() => {
    document.getElementById('terminal-input')?.focus();
  }, 350);

  if (typeof printWelcome === 'function') printWelcome();
}

function closeHacker() {
  hackerActive = false;
  const panel = document.getElementById('hacker-panel');
  const btn   = document.getElementById('hacker-toggle');

  panel?.classList.add('hidden');
  btn?.classList.remove('active');
  document.body.classList.remove('hacker-mode');
}

async function fetchHints(page) {
  try {
    const res  = await fetch('/api/hints?page=' + page);
    const data = await res.json();
    renderHints(data.hints || []);
  } catch {
    renderHints([]);
  }
}

function renderHints(hints) {
  const listEl = document.getElementById('hint-list');
  if (!listEl) return;

  if (!hints.length) {
    listEl.innerHTML = '<div style="color:var(--text-dim);font-size:11px;font-family:var(--font-mono);">No hints for this page.</div>';
    return;
  }

  listEl.innerHTML = hints.map(h => `
    <div class="hint-item severity-${h.severity}">
      <span class="hint-severity">${h.severity.toUpperCase()}</span>
      <span>${h.text}</span>
    </div>
  `).join('');
}
