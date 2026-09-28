import { test, expect } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer, startServer } from './helpers/server.js';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let srv;
let workdir;
let want;

test.beforeAll(async () => {
  buildServer();
  srv = await startServer({ port: 18203, webDir, limit: '20MB/s', seed: { 'e2e.txt': 'seed' } });
  workdir = mkdtempSync(path.join(tmpdir(), 'lanbox-e2e-resume-'));
  const big = path.join(workdir, 'big30');
  writeFileSync(big, randomBytes(30 * 1024 * 1024));
  want = createHash('sha256').update(readFileSync(big)).digest('hex');
});

test.afterAll(async () => {
  await srv?.stop();
  rmSync(workdir, { recursive: true, force: true });
});

test('reload mid-download resumes with matching hash', async ({ page }) => {
  await page.goto(srv.base + '/');
  await page.fill('input[placeholder*="token"]', srv.token);
  await page.fill('input[placeholder*="PIN"]', srv.pin);
  await page.click('button[type=submit]');
  await expect(page.getByText('e2e.txt')).toBeVisible();

  // put big30 on the server through the UI itself
  await page.setInputFiles('input[type=file]', path.join(workdir, 'big30'));
  await expect(page.getByText('Verified')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'big30', exact: true })).toBeVisible();

  await page.click('button:has-text("big30")');
  await page.waitForFunction(
    () => [...document.querySelectorAll('.progress .pmeta')].some((el) => el.textContent.includes('/ 30')),
    null, { timeout: 20000 },
  );
  await page.waitForTimeout(2500);
  await page.reload();
  await expect(page.getByText('big30')).toBeVisible({ timeout: 15000 });

  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 90000 }),
    page.click('button:has-text("big30")'),
  ]);
  const gotHash = createHash('sha256').update(readFileSync(await dl.path())).digest('hex');
  expect(gotHash).toBe(want);
  await expect(page.getByText('resumed')).toBeVisible({ timeout: 10000 });
});
