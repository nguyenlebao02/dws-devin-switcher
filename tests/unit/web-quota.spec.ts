import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../../src/web/router';
import { registerQuotaRoutes } from '../../src/web/handlers/quota';
import { AccountStore } from '../../src/core/store';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

// Mock modules that spawn processes so tests don't need real devin binary
const { mockReadQuotaForAccount, mockReadQuotaCache, mockWriteQuotaCache, mockMergeAccountQuotaWithCache, mockIsCacheBypassed } = vi.hoisted(() => ({
  mockReadQuotaForAccount: vi.fn(),
  mockReadQuotaCache: vi.fn(() => ({})),
  mockWriteQuotaCache: vi.fn(),
  mockMergeAccountQuotaWithCache: vi.fn((ready: unknown[]) => ({ fresh: [] as unknown[], stale: ready })),
  mockIsCacheBypassed: vi.fn(() => false),
}));

vi.mock('../../src/core/quota', () => ({
  readQuotaForAccount: mockReadQuotaForAccount,
}));

vi.mock('../../src/core/quota-cache', () => ({
  readQuotaCache: mockReadQuotaCache,
  writeQuotaCache: mockWriteQuotaCache,
  mergeAccountQuotaWithCache: mockMergeAccountQuotaWithCache,
  isCacheBypassed: mockIsCacheBypassed,
}));

function mockReq(method: string, url: string, bodyStr?: string): IncomingMessage {
  const req = new EventEmitter() as unknown as IncomingMessage;
  Object.assign(req, { method, url, headers: {} });
  if (bodyStr) {
    (req as any)._body = bodyStr;
  }
  return req;
}

function mockRes() {
  const state = { statusCode: 200, body: '', headers: {} as Record<string, string> };
  const onFinish = new EventEmitter();
  const res = {
    writeHead: vi.fn(function (this: any, code: number, headers?: Record<string, string>) {
      state.statusCode = code;
      if (headers) Object.assign(state.headers, headers);
      return this;
    }),
    end: vi.fn(function (this: any, data: string) {
      state.body = data;
      onFinish.emit('finish');
      return this;
    }),
    setHeader: vi.fn((name: string, value: string) => { state.headers[name] = value; }),
    getHeader: vi.fn((name: string) => state.headers[name]),
    headersSent: false,
    state,
    onFinish,
  } as unknown as ServerResponse & { state: typeof state; onFinish: EventEmitter };
  return res;
}

function parsedBody(res: ReturnType<typeof mockRes>): unknown {
  try { return JSON.parse(res.state.body); } catch { return null; }
}

function createReadyAccount(store: AccountStore, name: string): void {
  store.create(name);
  store.setAuthMetadata(store.findByName(name)!.id, {
    email: `${name}@test.com`,
    tier: 'pro',
    plan: 'Pro',
    orgId: 'org-abc',
  });
}

describe('Quota web handlers', () => {
  let sandbox: Sandbox;
  let router: Router;
  let prevDataHome: string | undefined;
  let prevConfigHome: string | undefined;

  function callHandler(method: string, url: string, body?: unknown): Promise<ReturnType<typeof mockRes>> {
    return new Promise((resolve, reject) => {
      try {
        const req = mockReq(method, url);
        const res = mockRes();
        res.onFinish.once('finish', () => resolve(res));
        const resolved = router.resolve(req);
        if (!resolved) {
          reject(new Error(`No route matched ${method} ${url}`));
          return;
        }
        const hasBody = ['POST', 'DELETE'].includes(method);
        const result = resolved.handler(req, res, resolved.params, hasBody ? body : null);
        if (result && typeof (result as Promise<void>).then === 'function') {
          (result as Promise<void>).catch((err: Error) => {
            if (!res.state.body) reject(err);
          });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  beforeEach(() => {
    sandbox = createSandbox();
    prevDataHome = process.env.DSW_DATA_HOME;
    prevConfigHome = process.env.DSW_CONFIG_HOME;
    process.env.DSW_DATA_HOME = sandbox.env.DSW_DATA_HOME;
    process.env.DSW_CONFIG_HOME = sandbox.env.DSW_CONFIG_HOME;
    router = new Router();
    registerQuotaRoutes(router);

    // Reset all mocked functions and set up defaults
    mockReadQuotaForAccount.mockReset();
    mockReadQuotaCache.mockReset();
    mockWriteQuotaCache.mockReset();
    mockMergeAccountQuotaWithCache.mockReset();
    mockIsCacheBypassed.mockReset();

    // Default implementations
    mockReadQuotaCache.mockReturnValue({});
    mockWriteQuotaCache.mockReturnValue(undefined);
    mockMergeAccountQuotaWithCache.mockImplementation((ready: unknown[]) => ({ fresh: [] as unknown[], stale: ready }));
    mockIsCacheBypassed.mockReturnValue(false);
    mockReadQuotaForAccount.mockImplementation((account: any) =>
      Promise.resolve({
        account,
        status: 'ok' as const,
        summary: { tier: 'pro', usedPercent: '30%', remainingPercent: '70%', resetsIn: '12h' },
        rawRedacted: '',
        exitCode: 0,
      })
    );
  });

  afterEach(() => {
    if (prevDataHome !== undefined) process.env.DSW_DATA_HOME = prevDataHome;
    else delete process.env.DSW_DATA_HOME;
    if (prevConfigHome !== undefined) process.env.DSW_CONFIG_HOME = prevConfigHome;
    else delete process.env.DSW_CONFIG_HOME;
    sandbox.cleanup();
  });

  describe('GET /api/accounts/:name/quota', () => {
    it('returns 404 for non-existent account', async () => {
      const res = await callHandler('GET', '/api/accounts/nobody/quota');
      expect(res.state.statusCode).toBe(404);
      const body = parsedBody(res) as any;
      expect(body).toBeTruthy();
    });

    it('returns needs-login status for accounts needing login', async () => {
      const store = new AccountStore();
      store.create('needs-login-acc');

      const res = await callHandler('GET', '/api/accounts/needs-login-acc/quota');
      expect(res.state.statusCode).toBe(200);
      const body = parsedBody(res) as any;
      expect(body.quota.status).toBe('needs-login');
      expect(mockReadQuotaForAccount).not.toHaveBeenCalled();
    });

    it('returns quota for a ready account', async () => {
      const store = new AccountStore();
      createReadyAccount(store, 'ready-acc');

      const res = await callHandler('GET', '/api/accounts/ready-acc/quota');
      expect(res.state.statusCode).toBe(200);

      const body = parsedBody(res) as any;
      expect(body.quota).toBeDefined();
      expect(body.quota.account.name).toBe('ready-acc');
      expect(body.quota.status).toBe('ok');
      expect(mockReadQuotaForAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/quota', () => {
    it('returns empty list when only needs-login accounts exist', async () => {
      const store = new AccountStore();
      store.create('login-me');
      store.create('login-me-too');

      const res = await callHandler('GET', '/api/quota');
      expect(res.state.statusCode).toBe(200);
      const body = parsedBody(res) as any;
      expect(body.quotas).toEqual([]);
      expect(body.message).toMatch(/no ready accounts/i);
      expect(mockReadQuotaForAccount).not.toHaveBeenCalled();
    });

    it('reads quotas with refresh=1 for ready accounts', async () => {
      const store = new AccountStore();
      createReadyAccount(store, 'acc-a');
      createReadyAccount(store, 'acc-b');

      const res = await callHandler('GET', '/api/quota?refresh=1');
      expect(res.state.statusCode).toBe(200);
      const body = parsedBody(res) as any;
      expect(body.quotas).toHaveLength(2);
      expect(body.cached).toBe(false);
      expect(body.fetchedAt).toEqual(expect.any(Number));
      // Should have called readQuotaForAccount for each ready account
      expect(mockReadQuotaForAccount).toHaveBeenCalledTimes(2);
    });

    it('handles single ready account', async () => {
      const store = new AccountStore();
      createReadyAccount(store, 'solo');

      const res = await callHandler('GET', '/api/quota?refresh=1');
      expect(res.state.statusCode).toBe(200);
      const body = parsedBody(res) as any;
      expect(body.quotas).toHaveLength(1);
      expect(body.quotas[0].account.name).toBe('solo');
    });
  });
});
