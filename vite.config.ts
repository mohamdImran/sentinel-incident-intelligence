import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin, Connect } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Dynamic reverse-proxy plugin.
 * Routes /dynamic-proxy/* to whatever URL is in the X-Proxy-Target header.
 * This lets the ConnectPage validate user-entered URLs without CORS issues,
 * since the request goes Node → Elastic (server-side), not browser → Elastic.
 */
function dynamicProxyPlugin(): Plugin {
  return {
    name: 'dynamic-proxy',
    configureServer(server) {
      const handler: Connect.NextHandleFunction = async (
        req: IncomingMessage,
        res: ServerResponse,
        next: Connect.NextFunction
      ) => {
        if (!req.url?.startsWith('/dynamic-proxy')) return next();

        const target = req.headers['x-proxy-target'] as string | undefined;
        if (!target) {
          res.writeHead(400);
          res.end('Missing X-Proxy-Target header');
          return;
        }

        
        const path = req.url.replace(/^\/dynamic-proxy/, '') || '/';

        
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        await new Promise<void>(resolve => req.on('end', resolve));
        const body = chunks.length ? Buffer.concat(chunks) : undefined;

        
        const forwardHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (['host', 'x-proxy-target', 'connection', 'transfer-encoding'].includes(k)) continue;
          if (typeof v === 'string') forwardHeaders[k] = v;
          else if (Array.isArray(v)) forwardHeaders[k] = v[0];
        }

        try {
          const upstream = await fetch(`${target.replace(/\/$/, '')}${path}`, {
            method: req.method ?? 'GET',
            headers: forwardHeaders,
            body: body?.length ? body : undefined,
            // @ts-ignore — Node 18+ fetch supports this
            duplex: 'half',
          });

          const contentType = upstream.headers.get('content-type') ?? 'application/json';
          const isSSE = contentType.includes('text/event-stream');

          res.writeHead(upstream.status, {
            'content-type': contentType,
            'access-control-allow-origin': '*',
            ...(isSSE ? {
              'cache-control': 'no-cache',
              'connection': 'keep-alive',
              'x-accel-buffering': 'no',
            } : {}),
          });

          if (isSSE && upstream.body) {
            
            const reader = upstream.body.getReader();
            const pump = async () => {
              while (true) {
                const { done, value } = await reader.read();
                if (done) { res.end(); break; }
                res.write(Buffer.from(value));
              }
            };
            pump().catch(() => res.end());
          } else {
            const buf = await upstream.arrayBuffer();
            res.end(Buffer.from(buf));
          }
        } catch (err) {
          res.writeHead(502);
          res.end(JSON.stringify({ error: String(err) }));
        }
      };

      server.middlewares.use(handler);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), dynamicProxyPlugin()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      proxy: {
        
        '/kibana-proxy': {
          target: env.VITE_KIBANA_URL ?? 'http://localhost:5601',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/kibana-proxy/, ''),
          secure: true,
        },
        
        '/es-proxy': {
          target: env.VITE_ES_URL ?? 'http://localhost:9200',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/es-proxy/, ''),
          secure: true,
        },
      },
    },
  };
});
