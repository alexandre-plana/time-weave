import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// jsdom does not apply CSS: guard the stylesheet structure directly.
describe('styles.css', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('has no declaration outside a rule and balanced braces', () => {
    let depth = 0;
    const stray: string[] = [];
    for (const line of css.split('\n')) {
      if (depth === 0 && /^\s*--?[\w-]+\s*:/.test(line)) stray.push(line.trim());
      for (const char of line) {
        if (char === '{') depth++;
        if (char === '}') depth--;
      }
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(stray).toEqual([]);
    expect(depth).toBe(0);
  });

  it('starts with the light variables on the timeline, overview and dialog', () => {
    expect(css.trimStart().startsWith('.tw-timeline,\n.tw-overview,\n.tw-modal-backdrop {')).toBe(true);
    expect(css).toContain('--tw-accent: #0969da;');
  });
});
