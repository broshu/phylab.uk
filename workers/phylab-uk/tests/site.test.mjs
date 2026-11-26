// 检查 www 跳转，以及构建出的 _site 不含后台代码、测试照片、说明文档。
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import worker from '../src/index.js';

const env = { ASSETS: { fetch: async (request) => new Response(`asset ${new URL(request.url).pathname}`) } };

test('www.phylab.uk 跳到 phylab.uk，保留路径', async () => {
  const r = await worker.fetch(new Request('https://www.phylab.uk/labs/cyclotron/?x=1'), env);
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('Location'), 'https://phylab.uk/labs/cyclotron/?x=1');
});

test('phylab.uk 直接发网站文件', async () => {
  const r = await worker.fetch(new Request('https://phylab.uk/research/'), env);
  assert.equal(await r.text(), 'asset /research/');
});

test('_site 只有网站文件', () => {
  const site = new URL('../../../_site/', import.meta.url);
  assert.ok(existsSync(new URL('index.html', site)), '先运行 npm run site');
  assert.ok(existsSync(new URL('404.html', site)));
  assert.ok(existsSync(new URL('literature/library/index.html', site)));
  for (const hidden of ['workers', 'scripts', '.github', 'CNAME', 'labs/ar-electric-field-beta2/test', 'labs/ar-electric-field/test photo', 'literature/scripts', 'literature/README.md']) {
    assert.ok(!existsSync(new URL(hidden, site)), `${hidden} 不应发布`);
  }
});
