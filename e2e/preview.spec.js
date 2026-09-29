import { test, expect } from '@playwright/test';
import { buildServer, startServer } from './helpers/server.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let srv;

test.beforeAll(async () => {
  buildServer();
  srv = await startServer({ port: 18204, webDir, seed: { 'note.txt': 'hello-preview', 'bin.dat': 'xxxx' } });
});

test.afterAll(async () => {
  await srv?.stop();
});

async function login(page) {
  await page.goto(srv.base + '/');
  await page.fill('input[placeholder*="token"]', srv.token);
  await page.fill('input[placeholder*="PIN"]', srv.pin);
  await page.click('button[type=submit]');
  await expect(page.getByText('note.txt')).toBeVisible();
}

test('text preview shows contents inline', async ({ page }) => {
  await login(page);
  await page.click('button[aria-label="Preview note.txt"]');
  await expect(page.getByRole('dialog')).toContainText('hello-preview');
});

test('binary has no preview button', async ({ page }) => {
  await login(page);
  await expect(page.locator('button[aria-label="Preview bin.dat"]')).toHaveCount(0);
});
