// In-memory stand-in for the parts of the GitHub GraphQL API the Worker uses.
export function fakeGitHub(initial = {}) {
  const files = new Map(Object.entries(initial));
  let head = 'c0', commits = [];
  const realFetch = globalThis.fetch;
  const handler = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url !== 'https://api.github.com/graphql') return realFetch(input, init);
    const { query, variables } = JSON.parse(init.body);
    if (query.includes('createCommitOnBranch')) {
      const input = variables.input;
      if (input.expectedHeadOid !== head) {
        return Response.json({ errors: [{ type: 'STALE_DATA', message: `Expected branch to point to "${input.expectedHeadOid}" but it did not. Pull and try again.` }] });
      }
      for (const a of input.fileChanges.additions) files.set(a.path, Buffer.from(a.contents, 'base64').toString('utf8'));
      for (const d of input.fileChanges.deletions) files.delete(d.path);
      head = `c${commits.length + 1}`;
      commits.push({ oid: head, message: input.message, additions: input.fileChanges.additions.map(a => a.path), deletions: input.fileChanges.deletions.map(d => d.path) });
      return Response.json({ data: { createCommitOnBranch: { commit: { oid: head } } } });
    }
    const repository = { ref: { target: { oid: head } } };
    for (const m of query.matchAll(/(\w+): object\(expression: "([^"]+)"\) \{ \.\.\. on (Tree|Blob)/g)) {
      const [, alias, expression, kind] = m;
      const path = expression.slice(expression.indexOf(':') + 1);
      if (kind === 'Blob') repository[alias] = files.has(path) ? { text: files.get(path) } : null;
      else {
        const entries = [...files.keys()].filter(f => f.startsWith(`${path}/`) && !f.slice(path.length + 1).includes('/'))
          .map(f => ({ name: f.split('/').pop(), path: f, type: 'blob', object: { text: files.get(f), isBinary: false } }));
        repository[alias] = entries.length ? { entries } : null;
      }
    }
    return Response.json({ data: { repository } });
  };
  return {
    files, commits,
    get head() { return head; },
    bump() { head = `${head}x`; },
    install() { globalThis.fetch = handler; },
    restore() { globalThis.fetch = realFetch; },
  };
}
