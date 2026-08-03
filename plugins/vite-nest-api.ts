import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import type { Plugin, ProxyOptions } from 'vite';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkApiHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port, path: '/api/stats/counts', timeout: 1000 },
      (res) => {
        res.resume();
        resolve((res.statusCode || 500) < 500);
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForApi(port: number, timeoutMs: number, isAlive?: () => boolean) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await checkApiHealth(port)) return true;
    if (isAlive && !isAlive()) return false;
    await sleep(500);
  }
  return false;
}

/**
 * If API is down, start it and BLOCK Vite listen until healthy.
 * This prevents ECONNREFUSED proxy spam on first page load.
 */
export function nestApiDevPlugin(): Plugin {
  let child: ChildProcess | null = null;
  let startedByUs = false;

  const stop = () => {
    if (child && startedByUs) {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
      child = null;
      startedByUs = false;
    }
  };

  return {
    name: 'nest-api-dev',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.SKIP_API === '1' || process.env.VITE_SKIP_API === '1') {
        return;
      }

      const apiPort = Number(process.env.API_PORT || 4000);
      if (await checkApiHealth(apiPort)) {
        console.log(`[api] Tayyor (:${apiPort})`);
        return;
      }

      const apiDir = path.resolve(server.config.root, 'api');
      console.log(`[api] Ishga tushirilmoqda → http://localhost:${apiPort}/api`);
      console.log('[api] Vite API tayyor bo‘lguncha kutadi (ECONNREFUSED chiqmasligi uchun)...');

      child = spawn('npm', ['run', 'start:dev'], {
        cwd: apiDir,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env },
      });
      startedByUs = true;

      let alive = true;
      child.on('exit', (code, signal) => {
        alive = false;
        if (startedByUs) {
          console.error(
            `[api] To‘xtadi (code=${code ?? 'null'} signal=${signal ?? 'null'}). ` +
              'Avval: npm run db:setup',
          );
        }
        child = null;
        startedByUs = false;
      });

      const ready = await waitForApi(apiPort, 90_000, () => alive);
      if (!ready) {
        stop();
        throw new Error(
          'API 90s ichida ishga tushmadi. Terminalda API xatosini ko‘ring, keyin: npm run db:setup && npm run api:dev',
        );
      }

      console.log(`[api] Tayyor (:${apiPort}) — frontend ochilmoqda`);

      server.httpServer?.once('close', stop);
      process.once('exit', stop);
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    },
  };
}

/** Quiet proxy errors — Vite still logs some, but we answer 503 cleanly. */
export function attachApiProxyGuards(proxy: {
  on: (event: string, fn: (...args: any[]) => void) => void;
}) {
  proxy.on('error', (err: NodeJS.ErrnoException, _req: unknown, res: any) => {
    if (res && !res.headersSent && typeof res.writeHead === 'function') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: 'API vaqtincha mavjud emas',
          statusCode: 503,
          detail: err.code || err.message,
        }),
      );
    }
  });
}

export type { ProxyOptions };
