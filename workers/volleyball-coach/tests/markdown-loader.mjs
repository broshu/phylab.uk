import { readFile } from 'node:fs/promises';

/** @type {import('node:module').LoadHook} */
export const load = async (url, context, nextLoad) => {
  if (!url.endsWith('.md')) return nextLoad(url, context);

  const markdown = await readFile(new URL(url), 'utf8');
  return {
    format: 'module',
    shortCircuit: true,
    source: `export default ${JSON.stringify(markdown)};`,
  };
};
