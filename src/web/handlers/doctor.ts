import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../router';
import { json } from './_shared';
import { resolveAppPaths } from '../../config/paths';
import { AccountStore } from '../../core/store';
import { getPtyAvailability } from '../../core/pty-runner';
import { runCapture } from '../../util/exec';

let cachedDevinVersion: string | null = null;
let cachedDevinVersionAt = 0;
const DEVIN_VERSION_TTL_MS = 60_000;

export function registerDoctorRoutes(router: Router): void {
  router.get('/api/doctor', async (_req, res) => {
    const appPaths = resolveAppPaths();
    const store = new AccountStore();
    const accounts = store.list();

    let devinVersion = cachedDevinVersion;
    if (!devinVersion || Date.now() - cachedDevinVersionAt > DEVIN_VERSION_TTL_MS) {
      try {
        const result = await runCapture('devin', ['--version'], { timeoutMs: 10_000 });
        devinVersion = (result.stdout || result.stderr || '').split('\n')[0]?.trim() || 'unknown';
      } catch {
        devinVersion = 'not found';
      }
      cachedDevinVersion = devinVersion;
      cachedDevinVersionAt = Date.now();
    }

    let ptyAvailable = false;
    try {
      const pty = await getPtyAvailability();
      ptyAvailable = pty.available;
    } catch {
      ptyAvailable = false;
    }

    json(res, {
      devinVersion,
      ptyAvailable,
      accountCount: accounts.length,
      paths: {
        dataHome: appPaths.dataHome,
        configHome: appPaths.configHome,
        storePath: appPaths.storePath,
        profilesDir: appPaths.profilesDir,
      },
    });
  });
}
