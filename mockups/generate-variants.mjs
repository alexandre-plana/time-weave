import {readFile, writeFile} from 'node:fs/promises';
const base = await readFile(new URL('./index.html', import.meta.url), 'utf8');
for (const [slug, name, density] of [['console','Console','compact'],['horizon','Horizon','standard'],['studio','Studio','standard']]) {
  const html = base
    .replace('<html lang="fr">', `<html lang="fr" class="variant-${slug}">`)
    .replace('<title>Time Weave — Atelier de timelines</title>', `<title>Time Weave — ${name}</title>`)
    .replace('<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="styles.css">\n  <link rel="stylesheet" href="variants.css">')
    .replace('<script src="app.js" defer></script>', '<script src="app.js" defer></script>\n  <script src="variants.js" defer></script>')
    .replace('<body data-density="standard">', `<body data-density="${density}" data-variant="${slug}">`);
  await writeFile(new URL(`./${slug}.html`, import.meta.url), html);
}
console.log('3 variantes générées. La maquette originale est conservée.');
