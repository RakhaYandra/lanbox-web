import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.js',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  // Backend uses a per-boot self-signed cert; ignore chain errors in tests
  // (auth is verified via token + PIN, not PKI).
  use: { headless: true, ignoreHTTPSErrors: true },
});
