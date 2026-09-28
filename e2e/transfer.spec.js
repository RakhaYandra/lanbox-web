import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer, startServer } from './helpers/server.js';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let srv;
let workdir;

test.beforeAll(async () => {
  buildServer();
  srv = await startServer({ port: 18202, webDir, seed: { 'e2e.txt': 'seed-file' } });
  workdir = mkdtempSync(path.join(tmpdir(), 'lanbox-e2e-work-'));
});

test.afterAll(async () => {
  await srv?.stop();
  rmSync(workdir, { recursive: true, force: true });
});

async function login(page) {
  await page.goto(srv.base + '/');
  await page.fill('input[placeholder*="token"]', srv.token);
  await page.fill('input[placeholder*="PIN"]', srv.pin);
  await page.click('button[type=submit]');
  await expect(page.getByText('e2e.txt')).toBeVisible();
}

test('upload shows Verified, download contents match', async ({ page }) => {
  await login(page);
  const up = path.join(workdir, 'up.txt');
  writeFileSync(up, 'web-upload-proof');
  await page.setInputFiles('input[type=file]', up);
  await expect(page.getByText('Verified')).toBeVisible({ timeout: 15000 });
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.click('button:has-text("up.txt")'),
  ]);
  const body = readFileSync(await dl.path(), 'utf8');
  expect(body).toContain('web-upload-proof');
});

test('share URL, multi-download button, delete row', async ({ page }) => {
  await login(page);
  await page.check('input[aria-label="Select e2e.txt"]');
  await page.click('button:has-text("Share e2e.txt")');
  await expect(page.getByText(/\/api\/v1\/shares\//)).toBeVisible();
  await page.check('input[aria-label="Select up.txt"]');
  await expect(page.getByText('Download 2 files')).toBeVisible();
  const rowsBefore = await page.locator('.row').count();
  page.on('dialog', (d) => d.accept());
  await page.click('button[aria-label="Delete up.txt"]');
  await page.waitForFunction((n) => document.querySelectorAll('.row').length < n, rowsBefore, { timeout: 10000 });
});
