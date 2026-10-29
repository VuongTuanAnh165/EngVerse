const { spawn } = require('child_process');
const WebSocket = require('ws');

const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless',
  '--remote-debugging-port=9230',
  '--disable-gpu',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const listRes = await fetch('http://127.0.0.1:9230/json/list');
    const tabs = await listRes.json();
    const target = tabs.find(t => t.type === 'page');
    if (!target) return;

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.navigate', params: { url: 'http://localhost:3000/play/1' } }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.method === 'Page.loadEventFired') {
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 10,
            method: 'Runtime.evaluate',
            params: {
              expression: `({
                hasAlchemy: !!document.querySelector('.alchemy-game-container'),
                cardCount: document.querySelectorAll('.alchemy-card').length,
                stageTag: document.querySelector('.stage-tag')?.textContent,
                stageTitle: document.querySelector('.stage-title-text')?.textContent
              })`,
              returnByValue: true
            }
          }));
        }, 2000);
      }
      if (msg.id === 10) {
        console.log('PLAY_TEST_RESULT:', JSON.stringify(msg.result.result.value));
        ws.close();
        edge.kill();
        process.exit(0);
      }
    });
  } catch (err) {
    console.error('Error:', err);
    edge.kill();
    process.exit(1);
  }
}, 1500);

