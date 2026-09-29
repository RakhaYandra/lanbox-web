import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer, startServer } from './helpers/server.js';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let srv;
let workdir;

test.beforeAll(async () => {
  buildServer();
  srv = await startServer({ port: 18207, webDir, seed: { 'e2e.txt': 'seed' } });
  workdir = mkdtempSync(path.join(tmpdir(), 'lanbox-e2e-hist-'));
});

test.afterAll(async () => {
  await srv?.stop();
  rmSync(workdir, { recursive: true, force: true });
});

test('completed upload appears in history', async ({ page }) => {
  await page.goto(srv.base + '/');
  await page.fill('input[placeholder*="token"]', srv.token);
  await page.fill('input[placeholder*="PIN"]', srv.pin);
  await page.click('button[type=submit]');
  await expect(page.getByText('e2e.txt')).toBeVisible();
  const up = path.join(workdir, 'hist.txt');
  writeFileSync(up, 'history-proof');
  await page.setInputFiles('input[type=file]', up);
  await expect(page.getByText('Verified')).toBeVisible({ timeout: 15000 });
  await page.click('button:has-text("History")');
  await expect(page.locator('section[aria-label="History"]').getByText('hist.txt')).toBeVisible({ timeout: 10000 });
});
