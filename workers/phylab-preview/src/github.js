// Small GitHub REST client. Every call uses the Worker's own token, so the
// mirror is never served from GitHub's 5-minute raw CDN cache.

const API = 'https://api.github.com';

/** @param {any} env */
export function repoOf(env) {
  return env.GITHUB_REPO || 'broshu/phylab.uk';
}

/** @param {any} env @param {Record<string,string>} [extra] */
function headers(env, extra = {}) {
  return {
    ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
    'User-Agent': 'phylab-preview',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
}

export function validBranch(name) {
  return typeof name === 'string' && name.length <= 100 && /^[A-Za-z0-9._/-]+$/.test(name) &&
    !name.includes('..') && !name.startsWith('/') && !name.endsWith('/');
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

/** Raw file bytes, or null when the path does not exist. */
export async function fetchRaw(env, path, ref) {
  const url = `${API}/repos/${repoOf(env)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
  const response = await fetch(url, { headers: headers(env, { Accept: 'application/vnd.github.raw+json' }) });
  if (response.status === 404) { await response.body?.cancel(); return null; }
  if (!response.ok) throw new Error(`GitHub ${response.status} for ${path}`);
  // A directory comes back as a JSON listing; the caller treats that as "not a file".
  if ((response.headers.get('content-type') || '').includes('application/json') && !path.endsWith('.json')) {
    await response.body?.cancel();
    return null;
  }
  return response;
}

function decodeBase64(text) {
  const binary = atob(text.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
}
function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** A text file with its blob sha, needed to update it. */
export async function readFile(env, path, ref = env.GITHUB_BRANCH || 'main') {
  const url = `${API}/repos/${repoOf(env)}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
  const response = await fetch(url, { headers: headers(env, { Accept: 'application/vnd.github+json' }) });
  if (!response.ok) throw new Error(`GitHub ${response.status} reading ${path}`);
  const data = await response.json();
  return { sha: data.sha, text: decodeBase64(data.content) };
}

/**
 * Read a text file, change it, and commit. Retries when someone else committed
 * in between (GitHub answers 409 or 422 for a stale sha).
 * @param {(text: string) => string | null} change return null to skip the commit
 */
export async function updateFile(env, path, message, change) {
  const branch = env.GITHUB_BRANCH || 'main';
  for (let attempt = 0; attempt < 3; attempt++) {
    const { sha, text } = await readFile(env, path, branch);
    const next = change(text);
    if (next === null || next === text) return { changed: false };
    const response = await fetch(`${API}/repos/${repoOf(env)}/contents/${encodePath(path)}`, {
      method: 'PUT',
      headers: headers(env, { Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message, content: encodeBase64(next), sha, branch }),
    });
    if (response.ok) {
      const data = await response.json();
      return { changed: true, commit: data.commit?.sha || '' };
    }
    if (![409, 422].includes(response.status) || attempt === 2) {
      throw new Error(`GitHub ${response.status} committing ${path}: ${(await response.text()).slice(0, 200)}`);
    }
  }
  return { changed: false };
}

export async function listBranches(env) {
  const response = await fetch(`${API}/repos/${repoOf(env)}/branches?per_page=50`, {
    headers: headers(env, { Accept: 'application/vnd.github+json' }),
  });
  if (!response.ok) throw new Error(`GitHub ${response.status} listing branches`);
  const data = await response.json();
  return data.map(b => b.name);
}

export { encodeBase64, decodeBase64 };
