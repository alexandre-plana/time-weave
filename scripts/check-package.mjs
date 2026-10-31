// Packs the library, installs the archive in a separate temporary application
// and checks that JavaScript, type declarations and styles can be imported.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString();

const packOutput = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', tmpdir()], root));
const tarball = join(tmpdir(), packOutput[0].filename);
const files = packOutput[0].files.map((file) => file.path);
for (const required of ['dist/core/index.js', 'dist/core/index.d.ts', 'dist/react/index.js', 'dist/react/index.d.ts', 'dist/styles.css']) {
  if (!files.includes(required)) throw new Error(`Missing ${required} in the archive`);
}
if (files.some((file) => file.startsWith('src/') || file.startsWith('tests/'))) throw new Error('Sources leaked into the archive');

const app = mkdtempSync(join(tmpdir(), 'time-weave-consumer-'));
try {
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }));
  const reactVersion = JSON.parse(run('node', ['-p', 'JSON.stringify(require("react/package.json").version)'], root));
  const typesVersion = JSON.parse(run('node', ['-p', 'JSON.stringify(require("@types/react/package.json").version)'], root));
  const tsVersion = JSON.parse(run('node', ['-p', 'JSON.stringify(require("typescript/package.json").version)'], root));
  run('npm', ['install', '--no-audit', '--no-fund', tarball, `react@${reactVersion}`, `react-dom@${reactVersion}`, `@types/react@${typesVersion}`, `typescript@${tsVersion}`], app);

  writeFileSync(
    join(app, 'app.tsx'),
    `import { Timeline, PlaybackControls, useTimelineController, frenchLabels } from '@time-weave/react';
import { createTimelineController, type TimelineItem } from '@time-weave/react/core';
import '@time-weave/react/styles.css';

const items: TimelineItem<{ value: number }>[] = [{ id: 'a', rowId: 'r', at: 5, meta: { value: 1 } }];
const controller = createTimelineController({ mode: 'relative', domain: { start: 0, end: 10 }, rows: [{ id: 'r', label: 'R' }], source: items });
controller.seek(4);
const time: number = controller.getSnapshot().time;

export function App() {
  const c = useTimelineController({ domain: { start: 0, end: 10 } });
  return <Timeline controller={c} labels={frenchLabels} toolbar={<PlaybackControls controller={c} />} />;
}
export { time };
`,
  );
  writeFileSync(join(app, 'styles.d.ts'), "declare module '*.css';\n");
  writeFileSync(
    join(app, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { strict: true, jsx: 'react-jsx', module: 'NodeNext', moduleResolution: 'NodeNext', noEmit: true, skipLibCheck: false, types: [] },
      files: ['app.tsx', 'styles.d.ts'],
    }),
  );
  run('npx', ['tsc', '-p', 'tsconfig.json'], app);

  writeFileSync(
    join(app, 'check.mjs'),
    `import { createTimelineController } from '@time-weave/react/core';
import * as main from '@time-weave/react';
import { createRequire } from 'node:module';
const c = createTimelineController({ mode: 'relative', domain: { start: 0, end: 10 } });
c.seek(3);
if (c.getSnapshot().time !== 3) throw new Error('engine does not work');
if (typeof main.Timeline !== 'function') throw new Error('Timeline missing');
const require = createRequire(import.meta.url);
const css = require.resolve('@time-weave/react/styles.css');
console.log('styles at', css);
`,
  );
  console.log(run('node', ['check.mjs'], app).trim());
  if (!existsSync(join(app, 'node_modules/@time-weave/react/dist/styles.css'))) throw new Error('styles missing');
  console.log('package check: ok');
} finally {
  rmSync(app, { recursive: true, force: true });
  rmSync(tarball, { force: true });
}
