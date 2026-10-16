import { readFile } from 'node:fs/promises';

/** Wrangler imports .html as text; mirror that for node --test. */
/** @type {import('node:module').LoadHook} */
export const load = async (url, context, nextLoad) => {
  if (!url.endsWith('.html')) return nextLoad(url, context);
  return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(await readFile(new URL(url), 'utf8'))};` };
};
