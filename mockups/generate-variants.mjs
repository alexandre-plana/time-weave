import {readFile, writeFile} from 'node:fs/promises';
const base = await readFile(new URL('./index.html', import.meta.url), 'utf8');
for (const [slug, name, density] of [['console','Console','compact'],['horizon','Horizon','standard'],['studio','Studio','standard']]) {
  const html = base
    .replace('<html lang="fr">', `<html lang="fr" class="variant-${slug}">`)
    .replace('<title>Time Weave — Atelier de timelines</title>', `<title>Time Weave — ${name}</title>`)
    .replace('<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="styles.css">\n  <link rel="stylesheet" href="variants.css">\n  <link rel="stylesheet" href="timeline-views.css">')
    .replace('<script src="app.js" defer></script>', '<script src="app.js" defer></script>\n  <script src="variants.js" defer></script>\n  <script src="timeline-views.js" defer></script>')
    .replace('<body data-density="standard">', `<body data-density="${density}" data-variant="${slug}">`);
  await writeFile(new URL(`./${slug}.html`, import.meta.url), html);
}
for (const [slug,name] of [['matrix','Matrice'],['arcs','Arches'],['lens','Loupe']]) {
  const html=base
    .replace('<html lang="fr">',`<html lang="fr" class="exploration-${slug}">`)
    .replace('<title>Time Weave — Atelier de timelines</title>',`<title>Time Weave — ${name}</title>`)
    .replace('<link rel="stylesheet" href="styles.css">','<link rel="stylesheet" href="styles.css">\n  <link rel="stylesheet" href="explorations.css">')
    .replace('<script src="app.js" defer></script>','<script src="app.js" defer></script>\n  <script src="explorations.js" defer></script>')
    .replace('<body data-density="standard">',`<body data-density="standard" data-exploration="${slug}">`);
  await writeFile(new URL(`./${slug}.html`,import.meta.url),html);
}
console.log('6 variantes générées. La maquette originale est conservée.');
