import type { ServerResponse } from 'node:http';

export function json(res: ServerResponse, data: unknown, statusCode = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

export function jsonError(res: ServerResponse, message: string, statusCode = 400): void {
  json(res, { error: message }, statusCode);
}

export function send(res: ServerResponse, body: string, type: string, statusCode = 200): void {
  res.writeHead(statusCode, { 'Content-Type': type });
  res.end(body);
}
