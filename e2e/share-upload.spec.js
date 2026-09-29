import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer, startServer } from './helpers/server.js';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let srv;

test.beforeAll(async () => {
  buildServer();
  srv = await startServer({ port: 18205, webDir, seed: { 'inbox/': '' } });
});

test.afterAll(async () => {
  await srv?.stop();
});

async function login(page) {
  await page.goto(srv.base + '/');
  await page.fill('input[placeholder*="token"]', srv.token);
  await page.fill('input[placeholder*="PIN"]', srv.pin);
  await page.click('button[type=submit]');
  await expect(page.getByText('inbox')).toBeVisible();
}

test('request-files share on a directory', async ({ page }) => {
  await login(page);
  await page.check('input[aria-label="Select inbox"]');
  await page.click('button:has-text("Request files to inbox")');
  const urlText = await page.getByText(/\/api\/v1\/shares\//).textContent();
  const url = (urlText.match(/https?:\/\/\S+/) || [])[0];
  expect(url).toBeTruthy();

  // guest upload through the share URL needs no server credentials
  await page.goto(url);
  await expect(page.getByText('Send files')).toBeVisible();
  await page.setInputFiles('input[type=file]', {
    name: 'guest.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('guest-via-share'),
  });
  await page.click('button:has-text("Upload")');
  await page.waitForTimeout(1500);

  // owner sees the file after refresh (fresh session -> login again)
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(srv.base + '/');
  await page.fill('input[placeholder*="token"]', srv.token);
  await page.fill('input[placeholder*="PIN"]', srv.pin);
  await page.click('button[type=submit]');
  await page.click('button:has-text("inbox")');
  await expect(page.getByText('guest.txt')).toBeVisible({ timeout: 10000 });
});

test('CLI share --upload then guest upload', async () => {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(
    'go', ['run', './cmd/lanbox', 'share', '/inbox', '--from', new URL(srv.base).host,
      '--token', srv.token, '--pin', srv.pin, '--upload'],
    { cwd: path.resolve(webDir, '..', '..', 'lanbox'), env: { ...process.env, LANBOX_TOKEN: srv.token, LANBOX_PIN: srv.pin } },
  ).toString();
  const url = (out.match(/URL: (\S+)/) || [])[1];
  expect(url).toBeTruthy();
});
