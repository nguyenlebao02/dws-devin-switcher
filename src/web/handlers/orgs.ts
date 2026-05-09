import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../router';
import { json } from './_shared';
import { AccountStore } from '../../core/store';

export function registerOrgRoutes(router: Router): void {
  router.get('/api/orgs', (_req, res) => {
    const store = new AccountStore();
    const accounts = store.list();

    const orgMap = new Map<string, { orgId: string; accountCount: number; accounts: Array<{ name: string; email: string | null; tier: string | null }> }>();

    for (const account of accounts) {
      const orgId = account.orgId ?? '(no org)';
      if (!orgMap.has(orgId)) {
        orgMap.set(orgId, { orgId, accountCount: 0, accounts: [] });
      }
      const entry = orgMap.get(orgId)!;
      entry.accountCount++;
      entry.accounts.push({ name: account.name, email: account.email, tier: account.tier });
    }

    json(res, { orgs: Array.from(orgMap.values()) });
  });
}
