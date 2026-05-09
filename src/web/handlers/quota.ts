import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../router';
import { json, jsonError } from './_shared';
import { AccountStore } from '../../core/store';
import { readQuotaForAccount, type AccountQuota } from '../../core/quota';
import { readQuotaCache, mergeAccountQuotaWithCache, writeQuotaCache, isCacheBypassed } from '../../core/quota-cache';
import { formatTimestamp } from '../../util/format';

export function registerQuotaRoutes(router: Router): void {
  router.get('/api/quota', async (_req, res) => {
    const store = new AccountStore();
    const accounts = store.list();
    const ready = accounts.filter((a) => !a.needsLogin);

    if (ready.length === 0) {
      json(res, { quotas: [], cached: false, message: 'No ready accounts' });
      return;
    }

    const url = new URL(_req.url ?? '/', 'http://localhost');
    const refresh = url.searchParams.get('refresh') === '1';

    const env = process.env;
    let quotas: AccountQuota[] = [];

    if (refresh || isCacheBypassed(env)) {
      quotas = await Promise.all(ready.map((a) => readQuotaForAccount(a, { baseEnv: env })));
      const cache = readQuotaCache();
      writeQuotaCache(cache, quotas);
      json(res, { quotas, cached: false, fetchedAt: Date.now() });
    } else {
      const cache = readQuotaCache();
      const { fresh, stale } = mergeAccountQuotaWithCache(ready, cache, env);
      const refreshed = await Promise.allSettled(stale.map((a) => readQuotaForAccount(a, { baseEnv: env })));
      const succeeded = refreshed.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<AccountQuota>).value);
      writeQuotaCache(cache, succeeded);
      quotas = [...fresh, ...succeeded];
      json(res, { quotas, cached: stale.length === 0, fetchedAt: Date.now() });
    }
  });

  router.get('/api/accounts/:name/quota', async (_req, res, params) => {
    const store = new AccountStore();
    const account = store.findByName(params.name!);
    if (!account) {
      jsonError(res, `Account not found: ${params.name}`, 404);
      return;
    }

    if (account.needsLogin) {
      json(res, {
        quota: {
          account,
          status: 'needs-login',
          summary: {},
          rawRedacted: '',
          exitCode: null,
        },
      });
      return;
    }

    const quota = await readQuotaForAccount(account);
    json(res, { quota });
  });
}
