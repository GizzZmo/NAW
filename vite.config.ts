import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Serve /api/generate-blueprint inside the Vite dev server (no separate process). */
function localApiPlugin(): Plugin {
  return {
    name: 'naw-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/generate-blueprint')) return next();

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const bodyText = Buffer.concat(chunks).toString('utf8');
          const body = bodyText ? JSON.parse(bodyText) : {};

          const { default: handler } = await import('./api/generate-blueprint');

          const mockReq = { method: req.method, headers: req.headers, body };
          const mockRes = {
            statusCode: 200,
            headers: {} as Record<string, string>,
            status(code: number) { this.statusCode = code; return this; },
            setHeader(name: string, value: string) { this.headers[name] = value; return this; },
            json(data: unknown) {
              res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this.headers });
              res.end(JSON.stringify(data));
            },
          };

          await handler(mockReq as any, mockRes as any);
        } catch (err) {
          console.error('[local-api]', err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Local API error', detail: String(err) }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [localApiPlugin(), tailwindcss(), react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
