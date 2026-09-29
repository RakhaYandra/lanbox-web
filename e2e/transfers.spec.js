import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer, startServer } from './helpers/server.js';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let srv;
let workdir;

test.beforeAll(async () => {
  buildServer();
  srv = await startServer({ port: 18206, webDir, limit: '5MB/s', seed: { 'e2e.txt': 'seed' } });
  workdir = mkdtempSync(path.join(tmpdir(), 'lanbox-e2e-xfer-'));
  writeFileSync(path.join(workdir, 'slow30'), randomBytes(30 * 1024 * 1024));
});

test.afterAll(async () => {
  await srv?.stop();
  rmSync(workdir, { recursive: true, force: true });
});

test('active upload appears in panel and can be cancelled', async ({ page }) => {
  await page.goto(srv.base + '/');
  await page.fill('input[placeholder*="token"]', srv.token);
  await page.fill('input[placeholder*="PIN"]', srv.pin);
  await page.click('button[type=submit]');
  await expect(page.getByText('e2e.txt')).toBeVisible();

  await page.setInputFiles('input[type=file]', path.join(workdir, 'slow30'));
  await expect(page.getByText('Active transfers')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('slow30', { exact: false }).first()).toBeVisible();
  await page.click('button[aria-label="Cancel slow30"]');
  await expect(page.getByText('Active transfers')).toHaveCount(0, { timeout: 10000 });
});
