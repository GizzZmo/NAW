/**
 * Local development API server for /api/generate-blueprint.
 *
 * Vite does not serve the Vercel serverless functions in `api/`.
 * Run this alongside `npm run dev` (or use `npm run dev:local`).
 *
 * Usage:
 *   npx tsx server/local-api.ts
 * Then set VITE_API_PROXY=http://localhost:3001 in .env or rely on the Vite proxy.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import handler from '../api/generate-blueprint';

const PORT = Number(process.env.API_PORT) || 3001;

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url?.startsWith('/api/generate-blueprint')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;

  const mockReq = {
    method: req.method,
    headers: req.headers,
    body: body ? JSON.parse(body) : {},
  };

  const mockRes = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    json(data: unknown) {
      res.writeHead(this.statusCode, {
        'Content-Type': 'application/json',
        ...this.headers,
      });
      res.end(JSON.stringify(data));
    },
  };

  try {
    await handler(mockReq as any, mockRes as any);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Local API error' }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`Local API listening on http://localhost:${PORT}/api/generate-blueprint`);
});
