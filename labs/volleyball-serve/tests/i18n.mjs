import assert from 'node:assert/strict';

import {
  createLocalizer,
  isSimplifiedChineseSystemLanguage,
  translateCoachMessage,
} from '../js/i18n.js';

assert.equal(isSimplifiedChineseSystemLanguage('zh-CN'), true);
assert.equal(isSimplifiedChineseSystemLanguage('zh-Hans-CN'), true);
assert.equal(isSimplifiedChineseSystemLanguage('zh-SG'), true);
assert.equal(isSimplifiedChineseSystemLanguage('zh'), false);
assert.equal(isSimplifiedChineseSystemLanguage('zh-TW'), false);
assert.equal(isSimplifiedChineseSystemLanguage('en-US'), false);

const chinese = createLocalizer('zh-Hans');
assert.equal(chinese.t('serve'), '发球');
assert.equal(chinese.t('outLong'), '出界——过远');
assert.equal(createLocalizer('en').t('serve'), 'Serve');
assert.equal(
  translateCoachMessage('To clear the net, should the next serve be faster or slower?', 'zh-Hans'),
  '要越过球网，下一次发球应该更快还是更慢？',
);
assert.equal(
  translateCoachMessage('To clear the net, should the next serve be faster or slower?', 'en'),
  'To clear the net, should the next serve be faster or slower?',
);

console.log('conservative Simplified-Chinese localisation passed');
