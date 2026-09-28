import { test, expect } from '@playwright/test';
import { buildServer, startServer } from './helpers/server.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let srv;

test.beforeAll(async () => {
  buildServer();
  srv = await startServer({ port: 18201, webDir, seed: { 'seed.txt': 'seed-file' } });
});

test.afterAll(async () => {
  await srv?.stop();
});

test('login screen without token, list after login', async ({ page }) => {
  await page.goto(srv.base + '/');
  await expect(page.getByText('Enter the token')).toBeVisible();
  await page.fill('input[placeholder*="token"]', srv.token);
  await page.fill('input[placeholder*="PIN"]', srv.pin);
  await page.click('button[type=submit]');
  await expect(page.getByText('seed.txt')).toBeVisible();
});
