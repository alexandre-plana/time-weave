#!/usr/bin/env node
/*
 * Rendu du film Time Weave.
 *   node motion/render.cjs cues                 → écrit out/cues.json (repères pour la musique)
 *   node motion/render.cjs stills 1.5,8,14 DIR  → images de contrôle PNG
 *   node motion/render.cjs video [fps]          → out/time-weave-demo.mp4 (nécessite out/music.wav)
 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const URL = 'file://' + path.join(ROOT, 'index.html') + '?capture';

async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.error('Erreur page :', e.message); process.exitCode = 1; });
  await page.goto(URL);
  await page.evaluate(() => window.ready);
  return page;
}
const png = async (page, t) => Buffer.from((await page.evaluate((x) => window.frameToPNG(x), t)).split(',')[1], 'base64');

async function main() {
  const [mode = 'video', arg, dir] = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    if (mode === 'cues') {
      const page = await openPage(browser);
      const data = await page.evaluate(() => ({ duration: TW.DURATION, cues: TW.CUES, zoom: TW.ZOOM_CURVE }));
      fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify(data));
      console.log(`${data.cues.length} repères écrits dans out/cues.json`);
    } else if (mode === 'stills') {
      const page = await openPage(browser);
      const target = dir || OUT;
      fs.mkdirSync(target, { recursive: true });
      for (const t of String(arg).split(',').map(Number)) {
        const f = path.join(target, `still-${t.toFixed(2).padStart(5, '0')}.png`);
        fs.writeFileSync(f, await png(page, t)); console.log(f);
      }
    } else {
      const fps = Number(arg || 60); const N = Math.round(fps * 60);
      const music = path.join(OUT, 'music.wav');
      const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'];
      if (fs.existsSync(music)) args.push('-i', music, '-c:a', 'aac', '-b:a', '256k', '-shortest');
      args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', path.join(OUT, 'time-weave-demo.mp4'));
      const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
      const workers = 4; const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser)));
      const done = new Map(); let next = 0, written = 0; const t0 = Date.now();
      const flush = async () => {
        while (done.has(written)) {
          const buf = done.get(written); done.delete(written);
          if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
          written++;
          if (written % (fps * 2) === 0) process.stdout.write(`\r${written}/${N} images · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
        }
      };
      let chain = Promise.resolve();
      await Promise.all(pages.map(async (page) => {
        while (true) {
          const i = next++; if (i >= N) break;
          done.set(i, await png(page, i / fps));
          while (done.size > 48 && !done.has(written)) await new Promise((r) => setTimeout(r, 5));
          chain = chain.then(flush); await chain;
        }
      }));
      await chain; ff.stdin.end();
      await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));
      console.log(`\nVidéo écrite : out/time-weave-demo.mp4 (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
