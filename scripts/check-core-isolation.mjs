// Verifies that the engine entry point does not depend on React or the DOM,
// and that importing the package has no side effect on window or document.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const coreDir = new URL('../dist/core/', import.meta.url).pathname;
const problems = [];
for (const file of readdirSync(coreDir).filter((name) => name.endsWith('.js'))) {
  const source = readFileSync(join(coreDir, file), 'utf8');
  if (/from ['"]react/.test(source)) problems.push(`${file} imports React`);
  if (/\b(window|document)\./.test(source)) problems.push(`${file} uses window or document`);
}

const core = await import('../dist/core/index.js');
if (typeof core.createTimelineController !== 'function') problems.push('core entry does not export createTimelineController');
const react = await import('../dist/react/index.js');
if (typeof react.Timeline !== 'function') problems.push('main entry does not export Timeline');
if (typeof globalThis.window !== 'undefined' || typeof globalThis.document !== 'undefined') {
  problems.push('importing the package defined window or document');
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('core isolation: ok');
