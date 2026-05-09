import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../../src/web/router';

describe('Router', () => {
  describe('resolve', () => {
    it('matches exact GET path', () => {
      const router = new Router();
      const handler = () => {};
      router.get('/api/health', handler);

      const result = router.resolve({ method: 'GET', url: '/api/health' } as IncomingMessage);
      expect(result).not.toBeNull();
      expect(result!.handler).toBe(handler);
      expect(result!.params).toEqual({});
    });

    it('matches parameterized path with :name', () => {
      const router = new Router();
      const handler = () => {};
      router.get('/api/accounts/:name', handler);

      const result = router.resolve({ method: 'GET', url: '/api/accounts/primary' } as IncomingMessage);
      expect(result).not.toBeNull();
      expect(result!.params).toEqual({ name: 'primary' });
    });

    it('matches multiple parameters', () => {
      const router = new Router();
      const handler = () => {};
      router.get('/api/:resource/:id', handler);

      const result = router.resolve({ method: 'GET', url: '/api/accounts/abc-123' } as IncomingMessage);
      expect(result).not.toBeNull();
      expect(result!.params).toEqual({ resource: 'accounts', id: 'abc-123' });
    });

    it('returns null for wrong HTTP method', () => {
      const router = new Router();
      router.post('/api/accounts', () => {});

      const result = router.resolve({ method: 'GET', url: '/api/accounts' } as IncomingMessage);
      expect(result).toBeNull();
    });

    it('returns null when no routes match', () => {
      const router = new Router();
      router.get('/api/health', () => {});

      const result = router.resolve({ method: 'GET', url: '/api/unknown' } as IncomingMessage);
      expect(result).toBeNull();
    });

    it('defaults method to GET when request has no method', () => {
      const router = new Router();
      const handler = () => {};
      router.get('/api/test', handler);

      const result = router.resolve({ url: '/api/test' } as IncomingMessage);
      expect(result).not.toBeNull();
      expect(result!.handler).toBe(handler);
    });

    it('handles root path /', () => {
      const router = new Router();
      const handler = () => {};
      router.get('/', handler);

      const result = router.resolve({ method: 'GET', url: '/' } as IncomingMessage);
      expect(result).not.toBeNull();
      expect(result!.handler).toBe(handler);
    });

    it('strips query string before matching', () => {
      const router = new Router();
      const handler = () => {};
      router.get('/api/accounts', handler);

      const result = router.resolve({ method: 'GET', url: '/api/accounts?page=1' } as IncomingMessage);
      expect(result).not.toBeNull();
      expect(result!.handler).toBe(handler);
    });

    it('decodes URI-encoded parameter values', () => {
      const router = new Router();
      const handler = () => {};
      router.get('/api/items/:name', handler);

      const result = router.resolve({ method: 'GET', url: '/api/items/hello%20world' } as IncomingMessage);
      expect(result).not.toBeNull();
      expect(result!.params).toEqual({ name: 'hello world' });
    });

    it('rejects mismatched segment count', () => {
      const router = new Router();
      router.get('/api/accounts/:name', () => {});

      const result = router.resolve({ method: 'GET', url: '/api/accounts' } as IncomingMessage);
      expect(result).toBeNull();
    });
  });

  describe('parseBody', () => {
    it('parses valid JSON body', async () => {
      const router = new Router();
      const req = new EventEmitter() as unknown as IncomingMessage;
      Object.assign(req, { method: 'POST', url: '/', headers: {} });

      const promise = router.parseBody(req);
      process.nextTick(() => {
        req.emit('data', Buffer.from('{"key":"value","num":42}'));
        req.emit('end');
      });

      await expect(promise).resolves.toEqual({ key: 'value', num: 42 });
    });

    it('returns null for empty body', async () => {
      const router = new Router();
      const req = new EventEmitter() as unknown as IncomingMessage;
      Object.assign(req, { method: 'POST', url: '/', headers: {} });

      const promise = router.parseBody(req);
      process.nextTick(() => req.emit('end'));

      await expect(promise).resolves.toBeNull();
    });

    it('returns null for whitespace-only body', async () => {
      const router = new Router();
      const req = new EventEmitter() as unknown as IncomingMessage;
      Object.assign(req, { method: 'POST', url: '/', headers: {} });

      const promise = router.parseBody(req);
      process.nextTick(() => {
        req.emit('data', Buffer.from('   '));
        req.emit('end');
      });

      await expect(promise).resolves.toBeNull();
    });

    it('rejects invalid JSON', async () => {
      const router = new Router();
      const req = new EventEmitter() as unknown as IncomingMessage;
      Object.assign(req, { method: 'POST', url: '/', headers: {} });

      const promise = router.parseBody(req);
      process.nextTick(() => {
        req.emit('data', Buffer.from('not json'));
        req.emit('end');
      });

      await expect(promise).rejects.toThrow('Invalid JSON body');
    });

    it('rejects on request stream error', async () => {
      const router = new Router();
      const req = new EventEmitter() as unknown as IncomingMessage;
      Object.assign(req, { method: 'POST', url: '/', headers: {} });

      const promise = router.parseBody(req);
      req.emit('error', new Error('stream error'));

      await expect(promise).rejects.toThrow('stream error');
    });
  });
});
