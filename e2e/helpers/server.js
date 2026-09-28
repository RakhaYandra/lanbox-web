// Spawns a lanbox server for E2E. Requires a sibling ../lanbox checkout
// (CI checks it out; see .github/workflows/e2e.yml).
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lanboxDir = path.resolve(root, '..', 'lanbox');
const binPath = path.join(root, 'e2e', '.bin', 'lanbox-e2e');

export function buildServer() {
  execFileSync('go', ['build', '-o', binPath, './cmd/lanbox'], { cwd: lanboxDir });
}

export async function startServer({ port, webDir, limit, seed } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'lanbox-e2e-'));
  const dataDir = path.join(dir, 'data');
  const { openSync, mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(dataDir, { recursive: true });
  for (const [name, content] of Object.entries(seed || {})) {
    writeFileSync(path.join(dataDir, name), content);
  }
  const logPath = path.join(dir, 'serve.log');
  const logFd = openSync(logPath, 'w');
  const args = ['serve', '--dir', dataDir, '--port', String(port)];
  if (webDir) args.push('--web-dir', webDir);
  if (limit) args.push('--limit', limit);
  const proc = spawn(binPath, args, { stdio: ['ignore', logFd, logFd] });
  const { readFileSync } = await import('node:fs');
  const deadline = Date.now() + 10000;
  for (;;) {
    try {
      const log = readFileSync(logPath, 'utf8');
      const token = (log.match(/token=([0-9a-f]+)/) || [])[1];
      const pin = (log.match(/PIN:\s+(\S+)/) || [])[1];
      if (token && pin) {
        return {
          base: `http://localhost:${port}`,
          token,
          pin,
          async stop() {
            proc.kill('SIGINT');
            await new Promise((r) => setTimeout(r, 500));
            rmSync(dir, { recursive: true, force: true });
          },
        };
      }
    } catch {}
    if (Date.now() > deadline) {
      proc.kill('SIGKILL');
      throw new Error('server did not print token/PIN in time; log at ' + logPath);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}
