// Checks that the packed library works with React 18.3 (the lowest supported
// peer version): installs the archive in a temporary application with React 18,
// type-checks a strict consumer against @types/react 18 and runs a jsdom suite.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const started = Date.now();
const run = (command, args, cwd, inherit = false) =>
  execFileSync(command, args, { cwd, stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'inherit'] })?.toString() ?? '';
const versionOf = (name) => JSON.parse(run('node', ['-p', `JSON.stringify(require("${name}/package.json").version)`], root));

const packDir = mkdtempSync(join(tmpdir(), 'time-weave-pack-'));
const app = mkdtempSync(join(tmpdir(), 'time-weave-react18-'));
let failed = false;
try {
  // `npm pack` runs `prepack`, which builds the library.
  const packOutput = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', packDir], root));
  const tarball = join(packDir, packOutput[0].filename);

  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'react18-consumer', private: true, type: 'module' }));
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      tarball,
      'react@18.3.1',
      'react-dom@18.3.1',
      '@types/react@18',
      '@types/react-dom@18',
      `typescript@${versionOf('typescript')}`,
      `vitest@${versionOf('vitest')}`,
      `jsdom@${versionOf('jsdom')}`,
      '@testing-library/react@16',
      `@testing-library/dom@${versionOf('@testing-library/dom')}`,
    ],
    app,
  );
  const installed = JSON.parse(run('node', ['-p', 'JSON.stringify(require("react-dom/package.json").version)'], app));
  if (!installed.startsWith('18.')) throw new Error(`Expected react-dom 18, got ${installed}`);

  // (a) Strict type-check of a consumer against React 18 types.
  writeFileSync(
    join(app, 'app.tsx'),
    `import { useState } from 'react';
import { Timeline, PlaybackControls, DetailModal, useTimelineController, useTimelineSnapshot } from 'time-weave';
import type { TimelineProps } from 'time-weave';
import { createManualScheduler, type TimelineItem } from 'time-weave/core';
import 'time-weave/styles.css';

type Meta = { value: number };
const items: TimelineItem<Meta>[] = [{ id: 'a', rowId: 'r', at: 5, label: 'A', meta: { value: 1 } }];

export function App() {
  const [scheduler] = useState(() => createManualScheduler());
  const controller = useTimelineController<unknown, Meta>({
    mode: 'relative',
    domain: { start: 0, end: 10 },
    rows: [{ id: 'r', label: 'R' }],
    source: items,
    scheduler,
  });
  const snapshot = useTimelineSnapshot(controller);
  const [open, setOpen] = useState(false);
  const detail: TimelineProps<unknown, Meta>['detail'] = (item) => <p>{item.meta?.value}</p>;
  return (
    <>
      <Timeline controller={controller} detail={detail} toolbar={<PlaybackControls controller={controller} />} />
      <output>{snapshot.time}</output>
      {open && (
        <DetailModal title="Info" onClose={() => setOpen(false)} inertRoot={null}>
          body
        </DetailModal>
      )}
      <button type="button" onClick={() => setOpen(true)}>open</button>
    </>
  );
}
`,
  );
  writeFileSync(join(app, 'styles.d.ts'), "declare module '*.css';\n");
  writeFileSync(
    join(app, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        jsx: 'react-jsx',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        noEmit: true,
        skipLibCheck: false,
        types: [],
      },
      files: ['app.tsx', 'styles.d.ts'],
    }),
  );
  run('npx', ['tsc', '-p', 'tsconfig.json'], app, true);
  console.log('react 18 types: ok');

  // (b) Runtime behaviour under React 18 in jsdom.
  writeFileSync(
    join(app, 'vitest.config.mjs'),
    `export default { test: { include: ['react18.test.jsx'], environment: 'jsdom' } };\n`,
  );
  writeFileSync(
    join(app, 'react18.test.jsx'),
    `import { StrictMode, useState, version } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackControls, Timeline, DetailModal, useTimelineController } from 'time-weave';
import { createManualScheduler, createTimelineController } from 'time-weave/core';

// Any React warning (act, unknown DOM attribute, invalid prop...) fails the test.
let errors;
beforeEach(() => {
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args.map(String).join(' ')));
  vi.spyOn(console, 'warn').mockImplementation((...args) => errors.push(args.map(String).join(' ')));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  expect(errors).toEqual([]);
});

const rows = [
  { id: 'root', label: 'Connecteurs' },
  { id: 'a', label: 'Réseau A', parentId: 'root' },
  { id: 'b', label: 'Réseau B', parentId: 'root' },
];
const items = [
  { id: 'i1', rowId: 'a', at: 1000, label: 'Mesure 1' },
  { id: 'i2', rowId: 'a', at: 3000, label: 'Mesure 2' },
  { id: 'i3', rowId: 'b', start: 2000, end: 6000, label: 'Cycle' },
];

function makeController() {
  const scheduler = createManualScheduler();
  const controller = createTimelineController({
    mode: 'relative',
    domain: { start: 0, end: 10_000 },
    rows,
    source: items,
    keys: [{ id: 'k1', at: 4000, label: 'Alerte' }],
    scheduler,
  });
  controller.start();
  return { controller, scheduler };
}

describe('React 18', () => {
  it('runs on React 18', () => {
    expect(version.startsWith('18.')).toBe(true);
  });

  it('plays, advances and pauses with PlaybackControls', () => {
    const { controller, scheduler } = makeController();
    render(<Timeline controller={controller} toolbar={<PlaybackControls controller={controller} />} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(controller.getSnapshot().transport).toBe('playing');
    act(() => scheduler.advance(500));
    expect(controller.getSnapshot().time).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(controller.getSnapshot().transport).toBe('paused');
    expect(screen.getByRole('slider', { name: 'Current time' }).getAttribute('aria-valuenow')).toBe(String(controller.getSnapshot().time));
  });

  it('expands a row and moves focus between items', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    expect(screen.queryByText('Réseau A')).toBeNull();
    // expand() from outside must re-render too.
    const toggle = screen.getByRole('button', { name: 'Expand Connecteurs' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Réseau A')).toBeTruthy();
    expect(document.querySelectorAll('.tw-item[tabindex="0"]')).toHaveLength(1);
    const first = screen.getByRole('button', { name: /Mesure 1/ });
    act(() => first.focus());
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('data-item-id')).toBe('i2');
    // useId-derived ids must resolve (aria references point to real elements).
    for (const el of document.querySelectorAll('[aria-describedby],[aria-labelledby],[aria-controls]')) {
      for (const attr of ['aria-describedby', 'aria-labelledby', 'aria-controls']) {
        for (const id of (el.getAttribute(attr) ?? '').split(/\\s+/).filter(Boolean)) {
          expect(document.getElementById(id), attr + '=' + id).not.toBeNull();
        }
      }
    }
  });

  it('opens the detail dialog, makes the frame inert and closes on Escape', () => {
    const { controller } = makeController();
    controller.expand('root');
    render(<Timeline controller={controller} detail />);
    const trigger = screen.getByRole('button', { name: /Cycle/ });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(dialog.textContent).toContain('Réseau B');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(document.getElementById(labelledBy).textContent).toBe('Cycle');
    expect(document.querySelector('[inert]')).not.toBeNull();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[inert]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('standalone DetailModal portals and closes', () => {
    function Host() {
      const [open, setOpen] = useState(true);
      return open ? <DetailModal title="Info" onClose={() => setOpen(false)}>body</DetailModal> : <p>closed</p>;
    }
    render(<Host />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByText('closed')).toBeTruthy();
  });

  it('useTimelineController under StrictMode keeps one active clock and stops on unmount', () => {
    const seen = new Set();
    function Harness() {
      const [scheduler] = useState(() => createManualScheduler());
      const controller = useTimelineController({ domain: { start: 0, end: 1000 }, mode: 'relative', scheduler });
      seen.add(controller);
      return <Timeline controller={controller} />;
    }
    const { unmount } = render(<StrictMode><Harness /></StrictMode>);
    const used = Array.from(seen).filter((c) => c.getSnapshot().status === 'ready');
    expect(used).toHaveLength(1);
    expect(used[0].isActive()).toBe(true);
    unmount();
    expect(used[0].isActive()).toBe(false);
  });
});
`,
  );
  run('npx', ['vitest', 'run', '--config', 'vitest.config.mjs'], app, true);
  console.log(`react 18 check: ok (${((Date.now() - started) / 1000).toFixed(1)}s)`);
} catch (error) {
  failed = true;
  console.error(`react 18 check: FAILED (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  if (!error?.status) console.error(error);
} finally {
  rmSync(app, { recursive: true, force: true });
  rmSync(packDir, { recursive: true, force: true });
}
if (failed) process.exit(1);
