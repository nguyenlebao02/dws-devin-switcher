import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../router';
import { json, jsonError } from './_shared';
import { AccountStore } from '../../core/store';
import { ensureProfileDirs, removeProfileDir } from '../../core/profile-paths';

export function registerAccountRoutes(router: Router): void {
  router.get('/api/accounts', (_req, res) => {
    const store = new AccountStore();
    const accounts = store.list();

    const url = new URL(_req.url ?? '/', 'http://localhost');
    const orgFilter = url.searchParams.get('org');
    const statusFilter = url.searchParams.get('status');

    let filtered = accounts;
    if (orgFilter) {
      filtered = filtered.filter((a) => a.orgId === orgFilter);
    }
    if (statusFilter === 'needs-login') {
      filtered = filtered.filter((a) => a.needsLogin);
    } else if (statusFilter === 'ready') {
      filtered = filtered.filter((a) => !a.needsLogin);
    }

    json(res, { accounts: filtered });
  });

  router.post('/api/accounts', async (_req, res, _params, body) => {
    const store = new AccountStore();
    const name = (body && typeof body === 'object' && 'name' in body ? (body as Record<string, unknown>).name : undefined) as string | undefined;
    const trimmed = name?.trim();

    try {
      const baseName = trimmed || `pending-${Date.now()}`;
      if (!trimmed) {
        // For unnamed accounts, generate a unique pending name
        const existing = new Set(store.list().map((a) => a.name));
        let candidate = baseName;
        let idx = 2;
        while (existing.has(candidate)) {
          candidate = `${baseName}-${idx}`;
          idx++;
        }
        const account = store.create(candidate);
        ensureProfileDirs(account.id);
        json(res, { account }, 201);
      } else {
        const account = store.create(trimmed);
        ensureProfileDirs(account.id);
        json(res, { account }, 201);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('already exists')) {
        jsonError(res, message, 409);
      } else {
        jsonError(res, message, 400);
      }
    }
  });

  router.get('/api/accounts/:name', (_req, res, params) => {
    const store = new AccountStore();
    const account = store.findByName(params.name!);
    if (!account) {
      jsonError(res, `Account not found: ${params.name}`, 404);
      return;
    }
    json(res, { account });
  });

  router.delete('/api/accounts/:name', (_req, res, params) => {
    const url = new URL(_req.url ?? '/', 'http://localhost');
    if (url.searchParams.get('yes') !== 'true') {
      jsonError(res, `Refusing to remove ${params.name} without ?yes=true confirmation`, 400);
      return;
    }

    const store = new AccountStore();
    const account = store.findByName(params.name!);
    if (!account) {
      jsonError(res, `Account not found: ${params.name}`, 404);
      return;
    }

    store.remove(params.name!);
    removeProfileDir(account.id);
    json(res, { deleted: account });
  });
}
