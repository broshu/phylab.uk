import { readFile } from 'node:fs/promises';

/** @type {import('node:module').LoadHook} */
export const load = async (url, context, nextLoad) => {
  if (url === 'stub:cloudflare-workers') {
    return { format: 'module', shortCircuit: true, source: 'export class WorkerEntrypoint { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }' };
  }
  if (!url.endsWith('.md')) return nextLoad(url, context);

  const markdown = await readFile(new URL(url), 'utf8');
  return {
    format: 'module',
    shortCircuit: true,
    source: `export default ${JSON.stringify(markdown)};`,
  };
};

// Node has no `cloudflare:workers`; tests get a minimal stand-in for WorkerEntrypoint.
/** @type {import('node:module').ResolveHook} */
export const resolve = async (specifier, context, nextResolve) => {
  if (specifier === 'cloudflare:workers') return { url: 'stub:cloudflare-workers', shortCircuit: true };
  return nextResolve(specifier, context);
};
