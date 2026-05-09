import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../router';
import { json, jsonError } from './_shared';
import { AccountStore } from '../../core/store';
import { buildProfileEnv } from '../../core/profile-env';
import { resolveAppPaths } from '../../config/paths';

export function registerRunRoutes(router: Router): void {
  router.post('/api/run', async (_req, res, _params, body) => {
    const name = (body && typeof body === 'object' && 'name' in body ? (body as Record<string, unknown>).name : undefined) as string | undefined;
    const rawArgs = (body && typeof body === 'object' && 'args' in body ? (body as Record<string, unknown>).args : undefined);
    const args = Array.isArray(rawArgs) ? rawArgs.filter((a): a is string => typeof a === 'string') : undefined;

    if (!name) {
      jsonError(res, 'Account name is required', 400);
      return;
    }

    const store = new AccountStore();
    const account = store.findByName(name);
    if (!account) {
      jsonError(res, `Account not found: ${name}`, 404);
      return;
    }

    if (account.needsLogin) {
      jsonError(res, `Account ${name} needs login. Run dsw login ${name} first.`, 400);
      return;
    }

    const appPaths = resolveAppPaths();
    const env = buildProfileEnv(account.id, appPaths, process.env);
    const cmd = `dsw use ${account.name}${args?.length ? ' ' + args.join(' ') : ''}`;

    json(res, {
      command: cmd,
      env: {
        XDG_DATA_HOME: env.XDG_DATA_HOME,
        XDG_CONFIG_HOME: env.XDG_CONFIG_HOME,
      },
      account: { name: account.name, email: account.email, tier: account.tier, plan: account.plan },
    });
  });
}
