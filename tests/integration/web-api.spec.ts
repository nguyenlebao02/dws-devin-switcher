import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebServer } from '../../src/web/server';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

interface SimpleResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

async function get(url: string): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function post(url: string, body: unknown): Promise<SimpleResponse> {
  const bodyStr = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr).toString(),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function del(url: string): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method: 'DELETE' },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function options(url: string): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method: 'OPTIONS' },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('Web API integration', () => {
  let sandbox: Sandbox;
  let server: WebServer;
  let baseUrl: string;
  let prevDataHome: string | undefined;
  let prevConfigHome: string | undefined;

  beforeAll(async () => {
    sandbox = createSandbox();
    prevDataHome = process.env.DSW_DATA_HOME;
    prevConfigHome = process.env.DSW_CONFIG_HOME;
    process.env.DSW_DATA_HOME = sandbox.env.DSW_DATA_HOME;
    process.env.DSW_CONFIG_HOME = sandbox.env.DSW_CONFIG_HOME;

    server = new WebServer({ port: 0, host: '127.0.0.1' });
    await server.start();
    const addr = (server as any).server.address() as { address: string; port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await server.stop();
    if (prevDataHome !== undefined) process.env.DSW_DATA_HOME = prevDataHome;
    else delete process.env.DSW_DATA_HOME;
    if (prevConfigHome !== undefined) process.env.DSW_CONFIG_HOME = prevConfigHome;
    else delete process.env.DSW_CONFIG_HOME;
    sandbox.cleanup();
  });

  describe('health', () => {
    it('GET /api/health returns ok status', async () => {
      const res = await get(`${baseUrl}/api/health`);
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);

      const body = JSON.parse(res.body);
      expect(body.ok).toBe(true);
      expect(typeof body.version).toBe('string');
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThan(0);
    });
  });

  describe('CORS headers', () => {
    it('OPTIONS preflight returns 204 with CORS headers', async () => {
      const res = await options(`${baseUrl}/api/accounts`);
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-methods']).toContain('GET');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
      expect(res.headers['access-control-allow-methods']).toContain('DELETE');
      expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
    });

    it('GET response includes CORS headers', async () => {
      const res = await get(`${baseUrl}/api/health`);
      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('POST response includes CORS headers', async () => {
      const res = await post(`${baseUrl}/api/accounts`, { name: 'cors-test' });
      expect(res.statusCode).toBe(201);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('account CRUD', () => {
    it('creates, reads, and deletes an account via HTTP', async () => {
      // Create account
      const createRes = await post(`${baseUrl}/api/accounts`, { name: 'e2e-test' });
      expect(createRes.statusCode).toBe(201);
      const createBody = JSON.parse(createRes.body);
      expect(createBody.account.name).toBe('e2e-test');
      expect(createBody.account.id).toBeTruthy();

      // List accounts
      const listRes = await get(`${baseUrl}/api/accounts`);
      expect(listRes.statusCode).toBe(200);
      const listBody = JSON.parse(listRes.body);
      expect(listBody.accounts.some((a: any) => a.name === 'e2e-test')).toBe(true);

      // Get by name
      const getRes = await get(`${baseUrl}/api/accounts/e2e-test`);
      expect(getRes.statusCode).toBe(200);
      const getBody = JSON.parse(getRes.body);
      expect(getBody.account.name).toBe('e2e-test');

      // Delete
      const delRes = await del(`${baseUrl}/api/accounts/e2e-test?yes=true`);
      expect(delRes.statusCode).toBe(200);
      const delBody = JSON.parse(delRes.body);
      expect(delBody.deleted.name).toBe('e2e-test');

      // Verify gone
      const afterRes = await get(`${baseUrl}/api/accounts/e2e-test`);
      expect(afterRes.statusCode).toBe(404);
    });

    it('rejects duplicate account creation', async () => {
      await post(`${baseUrl}/api/accounts`, { name: 'unique-name' });
      const dupRes = await post(`${baseUrl}/api/accounts`, { name: 'unique-name' });
      expect(dupRes.statusCode).toBe(409);
    });
  });

  describe('orgs', () => {
    it('GET /api/orgs returns org groupings', async () => {
      // Create some accounts
      await post(`${baseUrl}/api/accounts`, { name: 'org-test-1' });
      await post(`${baseUrl}/api/accounts`, { name: 'org-test-2' });

      const res = await get(`${baseUrl}/api/orgs`);
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.orgs)).toBe(true);
      // At least one org group (the '(no org)' group or whatever orgId these accounts have)
      expect(body.orgs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('404 handling', () => {
    it('returns JSON error for unknown GET route', async () => {
      const res = await get(`${baseUrl}/api/nonexistent`);
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('error');
    });
  });
});
