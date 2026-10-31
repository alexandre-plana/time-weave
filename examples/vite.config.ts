import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@time-weave/react/styles.css', replacement: src('styles.css') },
      { find: '@time-weave/react/core', replacement: src('core/index.ts') },
      { find: /^@time-weave\/react$/, replacement: src('react/index.ts') },
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('index.html', import.meta.url)),
        operations: fileURLToPath(new URL('operations/index.html', import.meta.url)),
        history: fileURLToPath(new URL('history/index.html', import.meta.url)),
        relative: fileURLToPath(new URL('relative/index.html', import.meta.url)),
        surveillance: fileURLToPath(new URL('surveillance/index.html', import.meta.url)),
        bench: fileURLToPath(new URL('bench/index.html', import.meta.url)),
      },
    },
  },
});
