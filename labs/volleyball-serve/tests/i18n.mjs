import assert from 'node:assert/strict';

import {
  createLocalizer,
  getUiLanguage,
  isEnglishLanguageOverride,
  isSimplifiedChineseSystemLanguage,
  translateCoachMessage,
} from '../js/i18n.js';

assert.equal(isSimplifiedChineseSystemLanguage('zh-CN'), true);
assert.equal(isSimplifiedChineseSystemLanguage('zh-Hans-CN'), true);
assert.equal(isSimplifiedChineseSystemLanguage('zh-SG'), true);
assert.equal(isSimplifiedChineseSystemLanguage('zh'), false);
assert.equal(isSimplifiedChineseSystemLanguage('zh-TW'), false);
assert.equal(isSimplifiedChineseSystemLanguage('en-US'), false);
assert.equal(isEnglishLanguageOverride('?lang=en'), true);
assert.equal(isEnglishLanguageOverride('?lang=zh-Hans'), false);
assert.equal(getUiLanguage({ systemLanguage: 'zh-CN', search: '?lang=en' }), 'en');
assert.equal(getUiLanguage({ systemLanguage: 'zh-CN', search: '?lang=zh-Hans' }), 'zh-Hans');

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
assert.equal(
  translateCoachMessage('The hidden speed is 20.1 m/s.', 'zh-Hans'),
  '此时的发球速度是 20.1 m/s。',
);

console.log('conservative Simplified-Chinese localisation passed');
