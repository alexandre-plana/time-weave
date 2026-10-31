// Runs the reference scenarios (examples/bench) in a real browser and prints a
// Markdown table ready to paste into docs/MESURES.md.
//
//   npm run bench               production build, headless Chromium
//   npm run bench -- --headed   visible window (closer to a real workstation)
//
// Requires Playwright with a Chromium browser (`npx playwright install chromium`
// on a workstation that does not have one yet).
import { spawn, execFileSync } from 'node:child_process';
import os from 'node:os';
import { chromium } from 'playwright';

const headed = process.argv.includes('--headed');
const port = 4190;
const root = new URL('..', import.meta.url).pathname;

execFileSync('npm', ['run', 'build:examples'], { cwd: root, stdio: 'inherit' });
const server = spawn('npx', ['vite', 'preview', '--config', 'examples/vite.config.ts', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});

try {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${port}/bench/index.html?run=1`);
  await page.waitForFunction(() => window.__bench?.done === true, null, { timeout: 180_000 });
  const bench = await page.evaluate(() => window.__bench);
  const version = browser.version();
  await browser.close();

  const cpu = os.cpus()[0]?.model ?? 'inconnu';
  console.log(`\n| Élément | Valeur |\n| --- | --- |`);
  console.log(`| Navigateur | Chromium ${version}${headed ? ' avec fenêtre' : ' sans interface'} |`);
  console.log(`| Machine | ${os.type()} ${os.release()}, ${os.cpus().length} cœurs, ${cpu} |`);
  console.log(`| Vue | ${bench.env.width} × ${bench.env.height}, densité ${bench.env.dpr} |`);
  console.log(`| Build | production (vite build + vite preview) |`);
  console.log(`\n| Scénario | Résultat |\n| --- | --- |`);
  for (const result of bench.results) console.log(`| ${result.scenario} | ${result.value} |`);
} finally {
  server.kill();
}
