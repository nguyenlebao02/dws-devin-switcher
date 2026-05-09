import { createServer, type IncomingMessage, type ServerResponse, type Server as HttpServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import type { AppPaths } from '../config/paths';
import { Router } from './router';
import { json, jsonError, send } from './handlers/_shared';
import { registerAccountRoutes } from './handlers/accounts';
import { registerAuthRoutes } from './handlers/auth';
import { registerQuotaRoutes } from './handlers/quota';
import { registerRunRoutes } from './handlers/run';
import { registerDoctorRoutes } from './handlers/doctor';
import { registerOrgRoutes } from './handlers/orgs';

export interface WebServerOptions {
  port: number;
  host: string;
  appPaths?: AppPaths;
}

export class WebServer {
  private server: HttpServer | null = null;
  private router = new Router();
  private started = false;

  constructor(private options: WebServerOptions) {}

  getRouter(): Router {
    return this.router;
  }

  async start(): Promise<void> {
    registerAccountRoutes(this.router);
    registerAuthRoutes(this.router);
    registerQuotaRoutes(this.router);
    registerRunRoutes(this.router);
    registerDoctorRoutes(this.router);
    registerOrgRoutes(this.router);
    this.registerHealth();

    this.server = createServer((req, res) => this.handleRequest(req, res));
    this.server.requestTimeout = 30_000;

    return new Promise((resolve, reject) => {
      this.server!.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.options.port} is already in use`));
        } else {
          reject(err);
        }
      });

      this.server!.listen(this.options.port, this.options.host, () => {
        this.started = true;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server!.close(() => resolve());
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const resolved = this.router.resolve(req);
      if (resolved) {
        const hasBody = ['POST', 'DELETE'].includes(req.method ?? '');
        const body = hasBody ? await this.router.parseBody(req) : null;
        await resolved.handler(req, res, resolved.params, body);
      } else if (req.method === 'GET') {
        serveStaticFile(req, res);
      } else {
        jsonError(res, 'Not found', 404);
      }
    } catch (err) {
      if (!res.headersSent) {
        const message = err instanceof Error ? err.message : String(err);
        jsonError(res, message, 500);
      }
    }
  }

  private registerHealth(): void {
    this.router.get('/api/health', (_req, res) => {
      try {
        const pkgPath = join(dirname(__dirname), '..', 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        json(res, { ok: true, version: pkg.version, uptime: process.uptime() });
      } catch {
        json(res, { ok: true, version: 'unknown', uptime: process.uptime() });
      }
    });
  }
}

function serveStaticFile(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? '/';
  const filename = url === '/' ? 'index.html' : url.slice(1);

  // Block path traversal: reject paths containing .. or \
  if (filename.includes('..') || filename.includes('\\')) {
    jsonError(res, 'Not found', 404);
    return;
  }

  const frontendDirs = [
    resolve(join(__dirname, 'frontend')),
    resolve(join(dirname(__dirname), 'web', 'frontend')),
  ];

  for (const frontendDir of frontendDirs) {
    const candidate = resolve(join(frontendDir, filename));
    if (!candidate.startsWith(frontendDir + '\\') && !candidate.startsWith(frontendDir + '/')) continue;
    if (existsSync(candidate)) {
      const content = readFileSync(candidate, 'utf8');
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        html: 'text/html; charset=utf-8',
        css: 'text/css; charset=utf-8',
        js: 'application/javascript; charset=utf-8',
        svg: 'image/svg+xml',
        png: 'image/png',
      };
      send(res, content, mimeTypes[ext ?? ''] ?? 'application/octet-stream');
      return;
    }
  }

  jsonError(res, 'Not found', 404);
}
