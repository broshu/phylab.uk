// GitHub access. Reads use one GraphQL query for everything the review desk
// needs; writes are single commits (createCommitOnBranch), so a decision that
// moves a review file and edits papers.json lands as one change.

const API = 'https://api.github.com';

/** @param {any} env */
export function repoOf(env) {
  const [owner, name] = (env.GITHUB_REPO || 'broshu/phylab.uk').split('/');
  return { owner, name, full: `${owner}/${name}` };
}
export function branchOf(env) {
  return env.GITHUB_BRANCH || 'main';
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

/** Raw file bytes for the mirror, or null when the path is not a file. */
export async function fetchRaw(env, path, ref) {
  const url = `${API}/repos/${repoOf(env).full}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
  const response = await fetch(url, { headers: headers(env, { Accept: 'application/vnd.github.raw+json' }) });
  if (response.status === 404) { await response.body?.cancel(); return null; }
  if (!response.ok) throw new Error(`GitHub ${response.status} for ${path}`);
  if ((response.headers.get('content-type') || '').includes('application/json') && !path.endsWith('.json')) {
    await response.body?.cancel();
    return null;
  }
  return response;
}

export async function listBranches(env) {
  const response = await fetch(`${API}/repos/${repoOf(env).full}/branches?per_page=50`, {
    headers: headers(env, { Accept: 'application/vnd.github+json' }),
  });
  if (!response.ok) throw new Error(`GitHub ${response.status} listing branches`);
  return (await response.json()).map(b => b.name);
}

export async function graphql(env, query, variables) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not set');
  const response = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: headers(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`GitHub GraphQL ${response.status}`);
  const data = await response.json();
  if (data.errors?.length) {
    const error = new Error(`GitHub: ${data.errors.map(e => e.message).join('; ')}`);
    error.stale = data.errors.some(e => /expected|head|stale|oid/i.test(`${e.type || ''} ${e.message}`));
    throw error;
  }
  return data.data;
}

const TREE = '... on Tree { entries { name path type object { ... on Blob { text isBinary } } } }';
const BLOB = '... on Blob { text }';

/**
 * Read several folders (all their text files) and single files in one request.
 * @param {{ folders?: string[], files?: string[] }} wanted
 * @returns {{ head: string, folders: Record<string, {name:string,path:string,text:string}[]>, files: Record<string, string|null> }}
 */
export async function readRepo(env, { folders = [], files = [] }) {
  const { owner, name } = repoOf(env);
  const branch = branchOf(env);
  const parts = [
    ...folders.map((f, i) => `d${i}: object(expression: ${JSON.stringify(`${branch}:${f}`)}) { ${TREE} }`),
    ...files.map((f, i) => `f${i}: object(expression: ${JSON.stringify(`${branch}:${f}`)}) { ${BLOB} }`),
  ];
  const query = `query($owner: String!, $name: String!, $ref: String!) { repository(owner: $owner, name: $name) {
    ref(qualifiedName: $ref) { target { oid } } ${parts.join('\n')} } }`;
  const data = await graphql(env, query, { owner, name, ref: `refs/heads/${branch}` });
  const repo = data.repository;
  const out = { head: repo.ref.target.oid, folders: {}, files: {} };
  folders.forEach((f, i) => {
    out.folders[f] = (repo[`d${i}`]?.entries || [])
      .filter(e => e.type === 'blob' && e.object && !e.object.isBinary && typeof e.object.text === 'string')
      .map(e => ({ name: e.name, path: e.path, text: e.object.text }));
  });
  files.forEach((f, i) => { out.files[f] = repo[`f${i}`]?.text ?? null; });
  return out;
}

export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** One commit with any number of added/changed and deleted files. */
export async function commitFiles(env, { head, headline, body = '', additions = [], deletions = [] }) {
  const { full } = repoOf(env);
  const query = `mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }`;
  const data = await graphql(env, query, { input: {
    branch: { repositoryNameWithOwner: full, branchName: branchOf(env) },
    expectedHeadOid: head,
    message: { headline, body },
    fileChanges: {
      additions: additions.map(a => ({ path: a.path, contents: encodeBase64(a.contents) })),
      deletions: deletions.map(path => ({ path })),
    },
  } });
  return data.createCommitOnBranch.commit.oid;
}

/**
 * Read, change, commit; retry when someone else committed in between.
 * @param {(snapshot: Awaited<ReturnType<typeof readRepo>>) => ({ headline: string, body?: string, additions?: any[], deletions?: string[], result?: any } | null)} change
 */
export async function transact(env, wanted, change) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const snapshot = await readRepo(env, wanted);
    const plan = change(snapshot);
    if (!plan || (!plan.additions?.length && !plan.deletions?.length)) return { commit: null, result: plan?.result };
    try {
      const commit = await commitFiles(env, { head: snapshot.head, ...plan });
      return { commit, result: plan.result };
    } catch (error) {
      if (!error.stale || attempt === 3) throw error;
    }
  }
  return { commit: null };
}
