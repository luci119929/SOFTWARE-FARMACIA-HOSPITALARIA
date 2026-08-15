import { defineConfig, devices } from '@playwright/test';

// Chromium viene preinstalado en el entorno remoto (ver PLAYWRIGHT_BROWSERS_PATH);
// se puede sobreescribir la ruta con PLAYWRIGHT_CHROMIUM_PATH en otros entornos.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalSetup: './global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: chromiumPath } },
    },
  ],
  webServer: [
    {
      command: 'npm run dev --workspace backend',
      cwd: '..',
      url: 'http://localhost:4000/health',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --workspace frontend',
      cwd: '..',
      url: 'http://localhost:5173',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
