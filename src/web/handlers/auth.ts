import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../router';
import { json, jsonError } from './_shared';
import { AccountStore } from '../../core/store';
import { readAuthStatus } from '../../core/auth';
import { readProfileOrgId } from '../../core/profile-config';

const loginSessions = new Map<string, { status: 'running' | 'completed' | 'failed'; accountName?: string; email?: string; name?: string; createdAt: number }>();

function evictOldSessions(): void {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min TTL
  for (const [key, session] of loginSessions) {
    if (session.createdAt < cutoff) loginSessions.delete(key);
  }
}

export function registerAuthRoutes(router: Router): void {
  router.post('/api/accounts/:name/login', async (_req, res, params) => {
    const store = new AccountStore();
    const account = store.findByName(params.name!);
    if (!account) {
      jsonError(res, `Account not found: ${params.name}`, 404);
      return;
    }

    // Check if already logged in
    try {
      const status = await readAuthStatus(account.id);
      if (status.loggedIn) {
        store.setAuthMetadata(account.id, {
          email: status.email ?? null,
          tier: status.tier ?? null,
          plan: status.plan ?? null,
          orgId: readProfileOrgId(account.id),
        });
        json(res, { status: 'already-logged-in', account: store.findByName(params.name!) });
        return;
      }
    } catch {
      // Will try login below
    }

    // Since login spawns an interactive browser process, return instructions
    evictOldSessions();
    const sessionId = `${account.id}-${Date.now()}`;
    loginSessions.set(sessionId, { status: 'running', createdAt: Date.now() });

    // Return manual command + OAuth guidance
    json(res, {
      status: 'started',
      loginId: sessionId,
      manualCommand: `dsw login ${account.name}`,
      message: 'Run the command above in your terminal. Devin will open a browser for authentication.',
    });
  });

  router.get('/api/accounts/:name/login-status', async (_req, res, params) => {
    const store = new AccountStore();
    const account = store.findByName(params.name!);
    if (!account) {
      jsonError(res, `Account not found: ${params.name}`, 404);
      return;
    }

    // Check current auth status
    try {
      const status = await readAuthStatus(account.id);
      if (status.loggedIn) {
        store.setAuthMetadata(account.id, {
          email: status.email ?? null,
          tier: status.tier ?? null,
          plan: status.plan ?? null,
          orgId: readProfileOrgId(account.id),
        });
        json(res, { status: 'completed', account: store.findByName(params.name!) });
        return;
      }
    } catch {
      // Not logged in yet
    }

    json(res, { status: account.needsLogin ? 'needs-login' : 'unknown' });
  });
}
