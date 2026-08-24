/**
 * Serverless entry point (Vercel).
 *
 * The long-running dev/prod server lives in ./index.ts and also serves the built
 * client. On Vercel the static client is served straight from the CDN, so this
 * entry only needs the JSON API. The project directory is read-only there, so the
 * SQLite file is kept in /tmp: the schema is created and seeded on cold start.
 */
process.env.SQLITE_PATH = process.env.SQLITE_PATH || '/tmp/podclub.db';

import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'node:http';
import { registerRoutes } from './routes';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes are registered eagerly; the promise is awaited by the first request so a
// cold start cannot race the router.
const ready = registerRoutes(createServer(app), app).then(() => {
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error('Internal Server Error:', err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message: err.message || 'Internal Server Error' });
  });
});

export default async function handler(req: Request, res: Response) {
  await ready;
  return app(req, res);
}
