import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

async function runFixture(emptyPopular = false) {
  const directory = await mkdtemp(join(tmpdir(), 'public-performance-test-'));
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    const empty = emptyPopular && request.url === '/popular';
    response.end(`<!doctype html><html data-performance-ready="true" data-performance-outcome="${empty ? 'empty' : 'ready'}"><body>
      <h1>Synthetic public fixture</h1>
      ${request.url === '/discovery' ? '<a href="https://example.invalid/video/synthetic-item">External video</a>' : ''}
      ${empty ? '' : '<a href="/video/synthetic-item">Watch synthetic content</a><a href="/u/synthetic-creator">Synthetic profile</a><div data-testid="profile-header"><h1>Synthetic creator</h1></div>'}
      <video autoplay muted playsinline width="320" height="180"></video><canvas hidden width="320" height="180"></canvas>
      <script>
        const canvas = document.querySelector('canvas');
        const drawing = canvas.getContext('2d');
        setInterval(() => { drawing.fillStyle = Date.now() % 2 ? 'red' : 'blue'; drawing.fillRect(0, 0, 320, 180); }, 30);
        document.querySelector('video').srcObject = canvas.captureStream(30);
        document.addEventListener('click', event => {
          const anchor = event.target.closest('a');
          if (!anchor || !anchor.pathname.startsWith('/video/')) return;
          event.preventDefault();
          if (anchor.origin !== location.origin) return;
          document.documentElement.dataset.performanceReady = 'false';
          history.pushState(null, '', anchor.pathname);
          document.querySelector('video').remove();
          const video = document.createElement('video');
          video.autoplay = true; video.muted = true; video.width = 320; video.height = 180; video.playsInline = true;
          document.body.append(video);
          video.srcObject = canvas.captureStream(30);
          requestAnimationFrame(() => { document.documentElement.dataset.performanceReady = 'true'; });
        });
      </script>
      </body></html>`);
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const child = spawn(process.execPath, ['scripts/performance/audit.mjs', '--origin', `http://127.0.0.1:${server.address().port}`,
    '--output', directory, '--samples', '1', '--observe-ms', '300', '--timeout-ms', '2000', '--search', 'synthetic-private-search'], { stdio: 'pipe' });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  try {
    const [code] = await once(child, 'exit');
    const json = await readFile(join(directory, 'report.json'), 'utf8');
    const markdown = await readFile(join(directory, 'report.md'), 'utf8');
    return { code, report: JSON.parse(json), serialized: json + markdown + output };
  } finally {
    server.close();
    await once(server, 'close');
    await rm(directory, { recursive: true, force: true });
  }
}

test('CLI audits six routes on both devices and writes anonymous JSON and Markdown', async () => {
  const { code, report, serialized } = await runFixture();
  assert.equal(code, 0, JSON.stringify(report.samples.filter(row => row.failures.length)));
  assert.equal(report.passed, true);
  assert.equal(report.samples.length, 14);
  assert.equal(report.samples.filter(row => row.mode === 'soft-navigation').length, 2);
  assert.ok(report.samples.filter(row => row.mode === 'soft-navigation').every(row => row.lcpMs === null && row.contentReadyMs > 0));
  assert.ok(report.samples.filter(row => row.route === '/video/:id').every(row => row.firstAdvancingVideoMs > 0));
  assert.ok(!serialized.includes('synthetic-item'));
  assert.ok(!serialized.includes('synthetic-creator'));
  assert.ok(!serialized.includes('synthetic-private-search'));
});

test('CLI fails an empty public page even with advisory performance budgets', async () => {
  const { code, report } = await runFixture(true);
  assert.equal(code, 1);
  assert.equal(report.passed, false);
  assert.equal(report.strict, false);
  assert.ok(report.samples.filter(row => row.route === '/popular').every(row => row.failures.includes('content-empty')));
});
