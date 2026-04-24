'use strict';
// scoreboard.js — WebSocket client for real-time leaderboard updates

function initScoreboard(onEvent) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl    = `${protocol}//${window.location.host}`;

  let ws;
  let reconnectDelay = 2000;

  function connect() {
    ws = new WebSocket(wsUrl);

    ws.addEventListener('open', () => {
      reconnectDelay = 2000;
      console.log('[ws] Connected to DarkMarket live feed.');
    });

    ws.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.event === 'flag_captured' && typeof onEvent === 'function') {
          onEvent(data);
        }
      } catch { /* ignore non-JSON */ }
    });

    ws.addEventListener('close', () => {
      console.log(`[ws] Disconnected. Reconnecting in ${reconnectDelay}ms...`);
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    });

    ws.addEventListener('error', () => {
      ws.close();
    });
  }

  connect();
}
