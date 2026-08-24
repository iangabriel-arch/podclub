/**
 * Vercel build.
 *
 * Produces two artifacts:
 *   dist/public   the static client, served from the CDN
 *   api/index.js  the JSON API as a single Node serverless function
 *
 * The function is pre-bundled here rather than compiled by Vercel so the "@shared"
 * and "@/..." path aliases resolve the same way they do locally. better-sqlite3 is
 * left external because it is a native module and must load from node_modules.
 */
import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';
import { rm } from 'node:fs/promises';

async function buildAll() {
  await rm('dist', { recursive: true, force: true });

  console.log('building client...');
  await viteBuild();

  console.log('building api function...');
  await esbuild({
    entryPoints: ['server/serverless.ts'],
    platform: 'node',
    target: 'node20',
    bundle: true,
    format: 'esm',
    outfile: 'api/index.js',
    define: { 'process.env.NODE_ENV': '"production"' },
    external: ['better-sqlite3'],
    // The bundle is ESM (package.json is type: module) but the externalised native
    // module is CommonJS, so give it a require().
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
    },
    minify: true,
    logLevel: 'info',
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
