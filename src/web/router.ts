import type { IncomingMessage, ServerResponse } from 'node:http';

export type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
  body: unknown
) => Promise<void> | void;

interface Route {
  method: string;
  segments: (string | ParamSegment)[];
  handler: Handler;
}

type ParamSegment = { name: string };

export class Router {
  private routes: Route[] = [];

  get(pattern: string, handler: Handler): void {
    this.add('GET', pattern, handler);
  }

  post(pattern: string, handler: Handler): void {
    this.add('POST', pattern, handler);
  }

  delete(pattern: string, handler: Handler): void {
    this.add('DELETE', pattern, handler);
  }

  private add(method: string, pattern: string, handler: Handler): void {
    const segments = pattern.split('/').filter(Boolean).map((seg) => {
      if (seg.startsWith(':')) return { name: seg.slice(1) };
      return seg;
    });
    this.routes.push({ method, segments, handler });
  }

  resolve(req: IncomingMessage): { handler: Handler; params: Record<string, string> } | null {
    const method = req.method ?? 'GET';
    const parts = (req.url ?? '/').split('?')[0]!.split('/').filter(Boolean);
    const params: Record<string, string> = {};

    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== parts.length) continue;

      let match = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i]!;
        const part = parts[i]!;
        if (typeof seg === 'string') {
          if (seg !== part) {
            match = false;
            break;
          }
        } else {
          params[seg.name] = decodeURIComponent(part);
        }
      }

      if (match) return { handler: route.handler, params };
    }

    return null;
  }

  parseBody(req: IncomingMessage): Promise<unknown> {
    const MAX_BODY_BYTES = 1_000_000;
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      req.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BODY_BYTES) {
          req.destroy(new Error('Request body too large'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('close', () => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Client disconnected'));
        }
      });

      let resolved = false;
      req.on('end', () => {
        if (resolved) return;
        resolved = true;
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw.trim()) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error('Invalid JSON body'));
        }
      });

      req.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
    });
  }
}
