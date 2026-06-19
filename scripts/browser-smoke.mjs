import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFile, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';

const projectRoot = process.cwd();
const distRoot = resolve(projectRoot, 'dist');
const host = '127.0.0.1';
const port = Number(process.env.SMOKE_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;
const screenshotPath = join(tmpdir(), `uk-driving-trainer-smoke-${Date.now()}.png`);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
]);

if (!existsSync(join(distRoot, 'index.html'))) {
  fail('dist/index.html was not found. Run npm run build before browser smoke.');
}

const chromePath = findChrome();
if (!chromePath) {
  fail('Chrome or Edge executable was not found. Set CHROME_BIN to run browser smoke.');
}

const server = createStaticServer(distRoot);

try {
  await listen(server, port, host);

  await runChrome([
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,720',
    '--virtual-time-budget=5000',
    `--screenshot=${screenshotPath}`,
    `${baseUrl}/`,
  ]);

  const screenshotBytes = statSync(screenshotPath).size;
  if (screenshotBytes < 25_000) {
    fail(`Smoke screenshot is too small (${screenshotBytes} bytes); page may be blank.`);
  }

  const resultDom = await runChrome([
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,720',
    '--virtual-time-budget=7000',
    '--dump-dom',
    `${baseUrl}/?smoke=results`,
  ]);

  assertIncludes(resultDom, 'results-overlay', 'Results overlay did not render.');
  assertIncludes(resultDom, '评估通过', 'Passed result text did not render.');
  assertIncludes(resultDom, 'hud-speed__value', 'HUD did not render.');

  console.log(`Browser smoke passed using ${chromePath}`);
  console.log(`Screenshot bytes: ${screenshotBytes}`);
} finally {
  server.close();
  if (existsSync(screenshotPath)) {
    unlinkSync(screenshotPath);
  }
}

function createStaticServer(root) {
  return createServer((request, response) => {
    const url = new URL(request.url ?? '/', baseUrl);
    const pathname = decodeURIComponent(url.pathname);
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = resolve(root, `.${safePath}`);

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    readFile(filePath, (error, data) => {
      if (error) {
        readFile(join(root, 'index.html'), (fallbackError, fallbackData) => {
          if (fallbackError) {
            response.writeHead(404);
            response.end('Not found');
            return;
          }

          response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          response.end(fallbackData);
        });
        return;
      }

      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
      });
      response.end(data);
    });
  });
}

function listen(httpServer, listenPort, listenHost) {
  return new Promise((resolveListen, rejectListen) => {
    httpServer.once('error', rejectListen);
    httpServer.listen(listenPort, listenHost, () => resolveListen());
  });
}

function runChrome(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(chromePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun(stdout);
        return;
      }

      rejectRun(new Error(`Chrome exited with ${code}.\n${stderr}`));
    });
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

function assertIncludes(value, expected, message) {
  if (!value.includes(expected)) {
    fail(message);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

mkdirSync(tmpdir(), { recursive: true });
