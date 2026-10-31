#!/usr/bin/env node
/*
 * Rendu d'une animation en boucle (page exposant window.frameAt(t)) vers un GIF.
 *   node motion/render-anim.cjs flow.html ../docs/assets/flux.gif 9 15 1100
 *   arguments : page, sortie, durée (s), images/s, largeur du GIF (px)
 *   node motion/render-anim.cjs flow.html image.png --still 5   → une image fixe
 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const [page = 'flow.html', out = '../docs/assets/flux.gif', durArg = '9', fpsArg = '15', widthArg = '1100'] = process.argv.slice(2);
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1600, height: 540 } });
  p.on('pageerror', (e) => { console.error('Erreur page :', e.message); process.exitCode = 1; });
  await p.goto('file://' + path.resolve(__dirname, page));
  await p.evaluate(() => window.ready);
  const png = async (t) => Buffer.from((await p.evaluate((x) => window.frameAt(x), t)).split(',')[1], 'base64');
  const target = path.resolve(__dirname, out);
  if (durArg === '--still') { fs.writeFileSync(target, await png(Number(fpsArg))); await browser.close(); return; }
  const dur = Number(durArg), fps = Number(fpsArg), n = Math.round(dur * fps);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-anim-'));
  for (let i = 0; i < n; i++) fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.png`), await png(i / fps));
  await browser.close();
  const vf = `scale=${widthArg}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  await new Promise((r, j) => spawn('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', path.join(dir, 'f%04d.png'), '-vf', vf, '-loop', '0', target], { stdio: 'inherit' }).on('close', (c) => (c ? j(new Error('ffmpeg ' + c)) : r())));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`${path.relative(process.cwd(), target)} · ${(fs.statSync(target).size / 1024).toFixed(0)} Ko`);
}
main().catch((e) => { console.error(e); process.exit(1); });
