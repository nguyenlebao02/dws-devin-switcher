import { spawn } from 'node:child_process';
import { WebServer } from '../../web/server';

export interface WebCommandOptions {
  port?: number;
  host?: string;
  open?: boolean;
}

export async function runWeb(options: WebCommandOptions): Promise<void> {
  const port = options.port ?? 3456;
  const host = options.host ?? '127.0.0.1';

  const server = new WebServer({ port, host });

  try {
    await server.start();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`dsw web: ${message}`);
    process.exitCode = 1;
    return;
  }

  const url = `http://${host}:${port}/`;
  process.stderr.write(`dsw web: Dashboard at ${url}\n`);
  process.stderr.write('dsw web: Press Ctrl+C to stop.\n');

  if (options.open) {
    const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(cmd, [url], { detached: true, stdio: 'ignore', shell: true });
  }

  // Keep alive until terminated
  await new Promise<void>((resolve) => {
    const cleanup = () => {
      process.off('SIGINT', cleanup);
      process.off('SIGTERM', cleanup);
      server.stop().then(resolve);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}
