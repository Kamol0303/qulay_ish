import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import type { Plugin } from 'vite';

function canConnect(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(700, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Starts Nest API automatically with `npm run dev` so Vite `/api` proxy
 * does not spam ECONNREFUSED when the backend was never started.
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
        console.log('[api] SKIP_API=1 — API avtomatik yoqilmaydi');
        return;
      }

      const apiPort = Number(process.env.API_PORT || 4000);
      if (await canConnect(apiPort)) {
        console.log(`[api] Allaqachon ishlayapti (:${apiPort})`);
        return;
      }

      const apiDir = path.resolve(server.config.root, 'api');
      console.log(`[api] Ishga tushirilmoqda → http://localhost:${apiPort}/api`);
      console.log('[api] Agar Postgres yo‘q bo‘lsa: npm run db:setup');

      child = spawn('npm', ['run', 'start:dev'], {
        cwd: apiDir,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env },
      });
      startedByUs = true;

      child.on('exit', (code, signal) => {
        if (startedByUs) {
          console.warn(`[api] To‘xtadi (code=${code ?? 'null'} signal=${signal ?? 'null'})`);
        }
        child = null;
        startedByUs = false;
      });

      server.httpServer?.once('close', stop);
      process.once('exit', stop);
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    },
  };
}

/** Throttle noisy proxy errors while API is booting. */
export function attachApiProxyGuards(proxy: {
  on: (event: string, fn: (...args: any[]) => void) => void;
}) {
  let lastLog = 0;
  proxy.on('error', (err: NodeJS.ErrnoException, _req: unknown, res: any) => {
    const now = Date.now();
    if (now - lastLog > 8000) {
      console.warn(
        `[vite] API ulanmadi (${err.code || err.message}). ` +
          'API avtomatik yoqiladi — bir necha soniya kuting, yoki: npm run api:dev',
      );
      lastLog = now;
    }
    if (res && !res.headersSent && typeof res.writeHead === 'function') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: 'API ishga tushmoqda. Bir necha soniya kuting.',
          statusCode: 503,
        }),
      );
    }
  });
}
