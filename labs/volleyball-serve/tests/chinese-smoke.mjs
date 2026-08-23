import assert from 'node:assert/strict';

import { installDom } from './fake-dom.mjs';

Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'zh-CN' },
  configurable: true,
});

const dom = installDom();
global.window.location = { assign() {} };

await import('../js/main.js');
await dom.settle();

const control = dom.el('#controls').querySelector('#serve');
const coachLog = dom.el('#coach').querySelector('#coachLog');

assert.equal(dom.el('#pageTitle').textContent, '排球发球');
assert.equal(dom.el('#taskHeading').textContent, '任务');
assert.equal(control.textContent, '发球');
assert.match(dom.el('#taskPrompt').textContent, /一名球员/);
assert.match(coachLog.children[0]?.textContent || '', /欢迎/);
assert.equal(dom.el('#verdictReadout').textContent, '—');

const slider = dom.el('#controls').querySelector('#speed');
slider.value = '15';
slider.dispatch('input');
control.dispatch('click');
await dom.tick(4);
await dom.play(1_200);

const options = dom.el('#coach').querySelector('#coachOptions').children;
assert.deepEqual(options.map((option) => option.textContent), ['更快', '更慢']);
assert.ok(coachLog.children.some((message) => /比球网带低/.test(message.textContent)));

console.log('Simplified-Chinese lab smoke passed');
