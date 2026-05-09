import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../../src/web/router';
import { registerAccountRoutes } from '../../src/web/handlers/accounts';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

function mockReq(method: string, url: string): IncomingMessage {
  const req = new EventEmitter() as unknown as IncomingMessage;
  Object.assign(req, { method, url, headers: {} });
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
    setHeader: vi.fn((name: string, value: string) => {
      state.headers[name] = value;
    }),
    getHeader: vi.fn((name: string) => state.headers[name]),
    headersSent: false,
    state,
    onFinish,
  } as unknown as ServerResponse & { state: typeof state; onFinish: EventEmitter };
  return res;
}

describe('Account web handlers', () => {
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

  function parsedBody(res: ReturnType<typeof mockRes>): unknown {
    try {
      return JSON.parse(res.state.body);
    } catch {
      return null;
    }
  }

  beforeEach(() => {
    sandbox = createSandbox();
    prevDataHome = process.env.DSW_DATA_HOME;
    prevConfigHome = process.env.DSW_CONFIG_HOME;
    process.env.DSW_DATA_HOME = sandbox.env.DSW_DATA_HOME;
    process.env.DSW_CONFIG_HOME = sandbox.env.DSW_CONFIG_HOME;
    router = new Router();
    registerAccountRoutes(router);
  });

  afterEach(() => {
    if (prevDataHome !== undefined) {
      process.env.DSW_DATA_HOME = prevDataHome;
    } else {
      delete process.env.DSW_DATA_HOME;
    }
    if (prevConfigHome !== undefined) {
      process.env.DSW_CONFIG_HOME = prevConfigHome;
    } else {
      delete process.env.DSW_CONFIG_HOME;
    }
    sandbox.cleanup();
  });

  describe('POST /api/accounts', () => {
    it('creates an account with name and returns 201', async () => {
      const res = await callHandler('POST', '/api/accounts', { name: 'test-account' });
      expect(res.state.statusCode).toBe(201);
      const body = parsedBody(res) as any;
      expect(body.account).toBeDefined();
      expect(body.account.name).toBe('test-account');
      expect(body.account.id).toBeTruthy();
    });

    it('rejects duplicate name with 409', async () => {
      await callHandler('POST', '/api/accounts', { name: 'dup' });
      const res = await callHandler('POST', '/api/accounts', { name: 'dup' });
      expect(res.state.statusCode).toBe(409);
      const body = parsedBody(res) as any;
      expect(body.error).toMatch(/already exists/i);
    });

    it('generates a pending name when name is empty', async () => {
      const res = await callHandler('POST', '/api/accounts', { name: '' });
      expect(res.state.statusCode).toBe(201);
      const body = parsedBody(res) as any;
      expect(body.account.name).toMatch(/^pending-/);
    });

    it('generates a pending name when body has no name field', async () => {
      const res = await callHandler('POST', '/api/accounts', {});
      expect(res.state.statusCode).toBe(201);
      const body = parsedBody(res) as any;
      expect(body.account.name).toMatch(/^pending-/);
    });

    it('generates unique pending names for multiple unnamed accounts', async () => {
      await callHandler('POST', '/api/accounts', { name: '' });
      const res2 = await callHandler('POST', '/api/accounts', { name: '' });
      expect(res2.state.statusCode).toBe(201);
      const body2 = parsedBody(res2) as any;
      expect(body2.account.name).toMatch(/^pending-/);
    });
  });

  describe('GET /api/accounts', () => {
    it('returns empty list when no accounts exist', async () => {
      const res = await callHandler('GET', '/api/accounts');
      expect(res.state.statusCode).toBe(200);
      const body = parsedBody(res) as any;
      expect(body.accounts).toEqual([]);
    });

    it('returns all accounts', async () => {
      await callHandler('POST', '/api/accounts', { name: 'alpha' });
      await callHandler('POST', '/api/accounts', { name: 'beta' });

      const res = await callHandler('GET', '/api/accounts');
      expect(res.state.statusCode).toBe(200);
      const body = parsedBody(res) as any;
      expect(body.accounts).toHaveLength(2);
      const names = body.accounts.map((a: any) => a.name).sort();
      expect(names).toEqual(['alpha', 'beta']);
    });
  });

  describe('GET /api/accounts/:name', () => {
    it('returns an existing account by name', async () => {
      await callHandler('POST', '/api/accounts', { name: 'by-name' });
      const res = await callHandler('GET', '/api/accounts/by-name');
      expect(res.state.statusCode).toBe(200);
      const body = parsedBody(res) as any;
      expect(body.account.name).toBe('by-name');
    });

    it('returns 404 for unknown account', async () => {
      const res = await callHandler('GET', '/api/accounts/nonexistent');
      expect(res.state.statusCode).toBe(404);
      const body = parsedBody(res) as any;
      expect(body.error).toContain('nonexistent');
    });
  });

  describe('DELETE /api/accounts/:name', () => {
    it('refuses deletion without ?yes=true (400)', async () => {
      await callHandler('POST', '/api/accounts', { name: 'temp' });
      const res = await callHandler('DELETE', '/api/accounts/temp');
      expect(res.state.statusCode).toBe(400);
      const body = parsedBody(res) as any;
      expect(body.error).toContain('?yes=true');
    });

    it('deletes with ?yes=true and returns 200', async () => {
      await callHandler('POST', '/api/accounts', { name: 'delete-me' });
      const res = await callHandler('DELETE', '/api/accounts/delete-me?yes=true');
      expect(res.state.statusCode).toBe(200);
      const body = parsedBody(res) as any;
      expect(body.deleted.name).toBe('delete-me');

      // Verify it's gone
      const getRes = await callHandler('GET', '/api/accounts/delete-me');
      expect(getRes.state.statusCode).toBe(404);
    });

    it('returns 404 when deleting unknown account with ?yes=true', async () => {
      const res = await callHandler('DELETE', '/api/accounts/ghost?yes=true');
      expect(res.state.statusCode).toBe(404);
    });
  });
});
