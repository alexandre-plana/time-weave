import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4180);
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.output',
  timeout: 20_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    viewport: { width: 1400, height: 900 },
    locale: 'fr-FR',
    timezoneId: 'UTC',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    // Listed first so the slow benchmark starts on its own worker while the other tests run.
    // The benchmark runs ~15 s of scenarios on its own; it gets a longer timeout and its own project.
    { name: 'bench', testMatch: /bench\.spec\.ts/, timeout: 60_000, use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } },
    { name: 'examples', testIgnore: /bench\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } },
  ],
  webServer: {
    command: `npm run build:examples && npx vite preview --config examples/vite.config.ts --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/operations/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
