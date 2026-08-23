/**
 * Language selection for the Volleyball Serve lab.
 *
 * English is deliberately the default.  We only switch when the browser's
 * primary system-language tag explicitly identifies Simplified Chinese; a
 * generic `zh` tag, Traditional Chinese, and secondary preferred languages do
 * not change the interface.
 */
const SIMPLIFIED_CHINESE = /^(?:zh-(?:hans(?:-|$)|cn(?:-|$)|sg(?:-|$)))/i;

/** @param {unknown} language */
export function isSimplifiedChineseSystemLanguage(language) {
  return typeof language === 'string' && SIMPLIFIED_CHINESE.test(language.trim());
}

export function getUiLanguage() {
  return isSimplifiedChineseSystemLanguage(globalThis.navigator?.language)
    ? 'zh-Hans'
    : 'en';
}

const UI_COPY = {
  en: {
    pageTitle: 'Volleyball Serve',
    pageDescription: 'Projectile motion: find the serve speeds that clear the net and still land in.',
    result: 'Result',
    resultRecords: 'Open the internal question-and-answer records',
    internalRecords: 'Internal records',
    labs: 'Labs',
    returnToLabs: 'Return to Labs',
    task: 'Task',
    coach: 'Coach',
    aiCoach: 'AI Coach',
    aiQuestion: 'Question for AI Coach',
    askPlaceholder: 'Ask about what happened…',
    ask: 'Ask',
    speed: 'Speed',
    launchSpeed: 'Launch speed in {unit}',
    serve: 'Serve',
    serving: 'Serving…',
    watch: 'Watch…',
    serveAgain: 'Serve again',
    in: 'In',
    intoNet: 'Into the net',
    outLong: 'Out — long',
    gotItContinue: 'Got it — continue',
    aiThinking: 'AI Coach is thinking…',
    enterQuestion: 'Enter a question for Coach.',
    notConfigured: 'AI Coach is not configured.',
    requestFailed: 'AI Coach request failed.',
    presetStillAvailable: 'The preset Coach above is still available.',
    aiAssisted: 'AI + preset',
    presetFallback: 'Preset fallback',
    presetOnly: 'Preset only',
    readyToServe: 'Ready to serve',
    readyToServeBody: 'Pick a launch speed with the slider — watch the player wind up as it grows — then press Serve. The verdict appears once the ball lands.',
    ballInAir: 'Ball in the air…',
    ballInAirBody: 'Watch where it crosses the net and where it lands.',
    coaching: 'Coaching',
    everyServeLogged: 'Every serve is logged.',
    serveProgress: '{total} served · {successes} good{first}',
    firstSuccess: ' · first on serve {attempt}',
    horizontalDistance: 'horizontal distance · {value} m',
    verticalFall: 'vertical fall · {value} m',
    serveLine: 'serve line · 0 m',
    farBaseline: 'far baseline · {value} m',
    net: 'net {value} m',
    contact: 'contact {value} m',
    hitsNet: 'hits the net',
    faster: 'Faster',
    slower: 'Slower',
    correct: '🎉 Correct! 🎉',
    continueFallback: 'That connects to the paused Coach question. Use the idea above, then choose the option that best completes the next step.',
  },
  'zh-Hans': {
    pageTitle: '排球发球',
    pageDescription: '平抛运动：找出既能越过球网又能落在界内的发球速度。',
    result: '结果',
    resultRecords: '打开内部问答记录',
    internalRecords: '内部记录',
    labs: '实验',
    returnToLabs: '返回实验列表',
    task: '任务',
    coach: '教练',
    aiCoach: 'AI 教练',
    aiQuestion: '向 AI 教练提问',
    askPlaceholder: '问问刚才发生了什么…',
    ask: '提问',
    speed: '速度',
    launchSpeed: '初速度（{unit}）',
    serve: '发球',
    serving: '发球中…',
    watch: '观看中…',
    serveAgain: '再次发球',
    in: '界内',
    intoNet: '挂网',
    outLong: '出界——过远',
    gotItContinue: '明白了，继续',
    aiThinking: 'AI 教练正在思考…',
    enterQuestion: '请先向教练输入问题。',
    notConfigured: 'AI 教练尚未配置。',
    requestFailed: 'AI 教练请求失败。',
    presetStillAvailable: '上方的预设教练仍可继续使用。',
    aiAssisted: 'AI + 预设',
    presetFallback: '预设回复',
    presetOnly: '仅预设',
    readyToServe: '准备发球',
    readyToServeBody: '用滑块选择初速度——速度越大，球员的引臂越明显——然后点击“发球”。球落地后会显示结果。',
    ballInAir: '球在空中…',
    ballInAirBody: '观察它越过球网的位置和落点。',
    coaching: '教练指导',
    everyServeLogged: '每次发球都会记录。',
    serveProgress: '已发球 {total} 次 · 成功 {successes} 次{first}',
    firstSuccess: ' · 第 {attempt} 次首次成功',
    horizontalDistance: '水平距离 · {value} m',
    verticalFall: '竖直下落 · {value} m',
    serveLine: '发球线 · 0 m',
    farBaseline: '对方底线 · {value} m',
    net: '球网 {value} m',
    contact: '击球点 {value} m',
    hitsNet: '碰网',
    faster: '更快',
    slower: '更慢',
    correct: '🎉 正确！🎉',
    continueFallback: '这与暂停的教练问题相关。先利用上面的思路，再从恢复的选项中选择最合适的下一步。',
  },
};

/** @param {'en'|'zh-Hans'} language */
export function createLocalizer(language = getUiLanguage()) {
  const resolvedLanguage = language === 'zh-Hans' ? 'zh-Hans' : 'en';
  const copy = UI_COPY[resolvedLanguage];

  return {
    language: resolvedLanguage,
    isChinese: resolvedLanguage === 'zh-Hans',
    /** @param {keyof typeof UI_COPY.en} key @param {Record<string, string | number>} [values] */
    t(key, values = {}) {
      return String(copy[key] ?? UI_COPY.en[key] ?? key).replace(
        /\{(\w+)\}/g,
        (_, name) => String(values[name] ?? `{${name}}`),
      );
    },
  };
}

/**
 * The deterministic coach script predates localisation and is intentionally
 * kept as a readable English teaching script.  This adapter translates its
 * displayed messages only for the confirmed Simplified-Chinese experience.
 * Formulae and values stay unchanged.
 * @param {string} message
 * @param {'en'|'zh-Hans'} language
 */
export function translateCoachMessage(message, language = getUiLanguage()) {
  if (language !== 'zh-Hans') return message;

  const exact = {
    'Welcome! Have a try. Good luck!': '欢迎！试着发一次球吧，祝你顺利！',
    'The marked points can also be selected directly on the court.': '标出的点也可以直接在球场图中点击选择。',
    'The dashed lines show the horizontal distance and the vertical fall for that exact path.': '虚线标出了这条临界轨迹的水平距离和竖直下落高度。',
    'How could you calculate its speed? What do you think the hidden speed is?': '怎样计算它的速度？你认为隐藏的速度是多少？',
    'Write it in two steps:': '分两步计算：',
    'One speed that works is a start. How much room does the serve actually have?': '一个可行速度只是开始；这次发球实际有多少余量？',
    'Select every whole-number speed that works. Yours is already selected.': '选出所有可行的整数速度。你刚才的速度已经被选中。',
    'Then you already know roughly where the two limits sit. Point at them.': '这样你已经大致知道两个临界点在哪里了。请指出它们。',
    'Select both boundary points: the one that fixes the minimum speed and the one that fixes the maximum speed.': '选出两个临界点：一个决定最小速度，另一个决定最大速度。',
    'Let us build both limits properly, one at a time.': '我们来逐一严谨地推导这两个边界。',
    'That is evidence, not yet the explanation. Let us find the two limits behind it.': '这只是证据，还不是完整解释。我们来找出背后的两个边界。',
    '🎉 Both boundaries — nicely done! 🎉': '🎉 两个边界都找到了，做得好！🎉',
    Faster: '更快',
    Slower: '更慢',
  };
  if (exact[message]) return exact[message];

  let match;
  if ((match = /^The marked points can also be selected directly on the court\.$/.exec(message))) return exact[match[0]];
  if ((match = /^horizontal distance · ([\d.]+) m$/.exec(message))) return `水平距离 · ${match[1]} m`;
  if ((match = /^vertical fall · ([\d.]+) m$/.exec(message))) return `竖直下落 · ${match[1]} m`;
  if ((match = /^Yes — ([ABC])\.$/.exec(message))) return `对，${match[1]}。`;
  if ((match = /^Let us test ([\d.]+) m\/s\.$/.exec(message))) return `我们来测试 ${match[1]} m/s。`;
  if ((match = /^(\d+(?:\.\d+)? m\/s) is still too slow to clear the net\. Try again\.$/.exec(message))) return `${match[1]} 仍然太慢，无法越过球网。请再试一次。`;
  if ((match = /^(\d+(?:\.\d+)? m\/s) lands long beyond the baseline\. Try again\.$/.exec(message))) return `${match[1]} 会落到对方底线外。请再试一次。`;
  if ((match = /^Select all the whole-number speeds that can work\.$/.exec(message))) return '选出所有可行的整数速度。';
  if ((match = /^Exactly\. (.+) are the whole-number speeds inside the interval\.$/.exec(message))) return `没错，${match[1].replaceAll(' and ', ' 和 ')} 都是这个区间内的整数速度。`;
  if ((match = /^🎉 Exactly — (.+) work! 🎉$/.exec(message))) return `🎉 正确——${match[1].replaceAll(' and ', ' 和 ')} 都可行！🎉`;
  if ((match = /^Right — (.+), and nothing else\.$/.exec(message))) return `正确——${match[1].replaceAll(' and ', ' 和 ')}，没有别的速度。`;
  if ((match = /^The window has two edges we have not found yet\. Let us locate them\.$/.exec(message))) return '这个区间还有两个尚未找到的边界。我们来定位它们。';
  if ((match = /^Exactly\. A fixes the minimum-speed boundary at ([\d.]+) m\/s, and touching the tape is a fault, so (.+)\.$/.exec(message))) return `正确。A 点确定 ${match[1]} m/s 的最小速度边界；碰到球网带算失误，所以 ${match[2]}。`;
  if ((match = /^C fixes the maximum-speed boundary at ([\d.]+) m\/s, and a ball on the line is in, so (.+)\.$/.exec(message))) return `C 点确定 ${match[1]} m/s 的最大速度边界；压线球算界内，所以 ${match[2]}。`;
  if ((match = /^Watch that limiting serve\. I will hide its speed: it (just reaches A|just lands at C)\.$/.exec(message))) return `观察这次临界发球。我会隐藏它的速度：它${match[1] === 'just reaches A' ? '恰好到达 A 点' : '恰好落在 C 点'}。`;
  if ((match = /^We will use ([AC]): it is where the (slowest|fastest) legal serve reaches its limit\.$/.exec(message))) return `我们使用 ${match[1]} 点：${match[2] === 'slowest' ? '最慢' : '最快'}的合法发球会恰好到达这里。`;
  if ((match = /^So which point fixes the (minimum-speed|maximum-speed) boundary\?$/.exec(message))) return `那么，哪个点决定${match[1] === 'minimum-speed' ? '最小速度' : '最大速度'}边界？`;
  if ((match = /^Which point does the (slowest|fastest) legal serve just (pass through|land on)\?$/.exec(message))) return `哪一个点是${match[1] === 'slowest' ? '最慢' : '最快'}合法发球恰好${match[2] === 'pass through' ? '通过' : '落在'}的位置？`;
  if ((match = /^What is the speed of the serve that just (reaches A|lands at C)\?$/.exec(message))) return `恰好${match[1] === 'reaches A' ? '到达 A 点' : '落在 C 点'}的发球速度是多少？`;
  if ((match = /^Using that calculation, what is the speed that just (reaches A|lands at C)\?$/.exec(message))) return `根据刚才的计算，恰好${match[1] === 'reaches A' ? '到达 A 点' : '落在 C 点'}的速度是多少？`;
  if ((match = /^The hidden speed is ([\d.]+) m\/s\.$/.exec(message))) return `隐藏的速度是 ${match[1]} m/s。`;
  if ((match = /^The limiting speed is ([\d.]+) m\/s\.$/.exec(message))) return `临界速度是 ${match[1]} m/s。`;
  if ((match = /^Yes\. The hidden speed is ([\d.]+) m\/s\.$/.exec(message))) return `对。隐藏的速度是 ${match[1]} m/s。`;
  if ((match = /^B is on the floor at the foot of the net\. To arrive there the ball has to fall the whole ([\d.]+) m within ([\d.]+) m, which takes the full ([\d.]+) s, so that path is only ([\d.]+) m\/s\. That serve is buried in the net, not on the edge of anything\. A boundary point is the exact place where legal turns into illegal\.$/.exec(message))) return `B 在球网脚下的地面上。球要到达 B，必须在 ${match[2]} m 内下落完整的 ${match[1]} m，需用时 ${match[3]} s，因此这条轨迹的速度只有 ${match[4]} m/s。它会深深挂在网上，不是任何边界。边界点是合法与不合法恰好转换的位置。`;
  if ((match = /^([AC]) is the other boundary point, and it matters just as much — but it fixes the (slowest|fastest) legal serve\. Here we want the (slowest|fastest) legal serve\.$/.exec(message))) return `${match[1]} 是另一个边界点，也同样重要——但它决定的是${match[2] === 'slowest' ? '最慢' : '最快'}的合法发球。这里我们要找的是${match[3] === 'slowest' ? '最慢' : '最快'}的合法发球。`;
  if ((match = /^That point does not describe the (slowest|fastest) legal serve\.$/.exec(message))) return `这个点不能描述${match[1] === 'slowest' ? '最慢' : '最快'}的合法发球。`;
  if ((match = /^That leaves the (minimum-speed|maximum-speed) boundary\. It is found the same way, from the (slowest|fastest) legal serve: the path that (only just passes the top of the net|only just lands on the far baseline)\.$/.exec(message))) return `接下来是${match[1] === 'minimum-speed' ? '最小速度' : '最大速度'}边界。它也通过同样的方法得到：从${match[2] === 'slowest' ? '最慢' : '最快'}的合法发球出发，也就是${match[3] === 'only just passes the top of the net' ? '恰好通过球网顶端' : '恰好落在对方底线'}的轨迹。`;
  if ((match = /^Start with the (minimum-speed|maximum-speed) boundary\. It is set by the (slowest|fastest) legal serve: the path that (only just passes the top of the net|only just lands on the far baseline), (.+)\.$/.exec(message))) return `先从${match[1] === 'minimum-speed' ? '最小速度' : '最大速度'}边界开始。它由${match[2] === 'slowest' ? '最慢' : '最快'}的合法发球决定：这条轨迹${match[3] === 'only just passes the top of the net' ? '恰好通过球网顶端' : '恰好落在对方底线'}，距离为 ${match[4].replace(' m away and ', ' m，竖直高度为 ').replace(' m up', ' m')}。`;
  if ((match = /^Both limits hold at once: (.+)\.$/.exec(message))) return `两个条件必须同时满足：${match[1]}。`;
  if ((match = /^So the legal interval is (.+)\.$/.exec(message))) return `因此，合法速度区间为 ${match[1]}。`;
  if ((match = /^Together: (.+)\.$/.exec(message))) return `合在一起：${match[1]}。`;
  if ((match = /^To clear the net, should the next serve be faster or slower\?$/.exec(message))) return '要越过球网，下一次发球应该更快还是更慢？';
  if ((match = /^To bring that landing point back in, should the next serve be faster or slower\?$/.exec(message))) return '要让落点回到界内，下一次发球应该更快还是更慢？';
  if ((match = /^So should a serve that (hits the net|goes long) be faster or slower\?$/.exec(message))) return `所以，${match[1] === 'hits the net' ? '挂网' : '出界过远'}的发球应该更快还是更慢？`;
  if ((match = /^Let us test the idea that slower would help\. Watch these slower serves\.$/.exec(message))) return '我们来检验“更慢会有帮助”这个想法。观察这些更慢的发球。';
  if ((match = /^Let us test the idea that faster would help\. Watch these faster serves\.$/.exec(message))) return '我们来检验“更快会有帮助”这个想法。观察这些更快的发球。';
  if ((match = /^This serve is already at the slow end of the slider, so slowing down cannot help\.$/.exec(message))) return '这次发球已经是滑块的最小速度，再慢也不会有帮助。';
  if ((match = /^This serve is already at the fast end of the slider, so going faster cannot help\.$/.exec(message))) return '这次发球已经是滑块的最大速度，再快也不会有帮助。';
  if ((match = /^They reach the net lower, or land before it\. A slower ball spends longer falling\.$/.exec(message))) return '它们到达球网时更低，甚至会在球网前落地。速度更慢，球下落的时间更长。';
  if ((match = /^They stay in the air for the same time, so each faster serve travels farther and lands even more out\.$/.exec(message))) return '它们在空中的时间相同，因此速度越快，水平距离越远，出界也越多。';
  if ((match = /^Right\. To arrive above the tape, the ball must reach the net sooner, so it needs a larger speed\.$/.exec(message))) return '对。要在球网带上方到达球网，球必须更快到达那里，所以需要更大的速度。';
  if ((match = /^It needs to be faster: a slower ball takes longer to reach the net and falls further\.$/.exec(message))) return '它需要更快：速度更慢的球到达球网时间更长，会下落得更多。';
  if ((match = /^Right\. It must be slower: the ball is in the air for the same time, so a smaller speed means less horizontal distance\.$/.exec(message))) return '对。它必须更慢：球在空中的时间相同，速度更小意味着水平距离更短。';
  if ((match = /^It must be slower: the ball already passed the baseline, and more speed would carry it farther\.$/.exec(message))) return '它必须更慢：球已经越过底线，更大的速度只会让它飞得更远。';
  if ((match = /^A ball on the baseline is in, so the maximum-speed boundary includes its own value: (.+)\.$/.exec(message))) return `落在底线上算界内，因此最大速度边界包含等号：${match[1]}。`;
  if ((match = /^Touching the tape is a fault, so the minimum-speed boundary is strict: (.+)\.$/.exec(message))) return `碰到球网带算失误，因此最小速度边界是严格不等式：${match[1]}。`;
  if ((match = /^([\d.]+) m\/s worked: it clears the tape by ([\d.]+) m and lands ([\d.]+) m inside the baseline\.$/.exec(message))) return `${match[1]} m/s 可行：它越过球网带 ${match[2]} m，并落在底线内 ${match[3]} m。`;
  if ((match = /^At ([\d.]+) m\/s the ball reaches the net at ([\d.]+) m, ([\d.]+) m below the tape\.$/.exec(message))) return `速度为 ${match[1]} m/s 时，球到达球网的高度为 ${match[2]} m，比球网带低 ${match[3]} m。`;
  if ((match = /^At ([\d.]+) m\/s the ball lands at ([\d.]+) m, ([\d.]+) m beyond the ([\d.]+) m baseline\.$/.exec(message))) return `速度为 ${match[1]} m/s 时，球落在 ${match[2]} m 处，越过 ${match[4]} m 的底线 ${match[3]} m。`;
  if ((match = /^([\d.]+) m\/s reaches the net at ([\d.]+) m, ([\d.]+) m below the tape — too slow, as expected\.$/.exec(message))) return `${match[1]} m/s 到达球网时高度为 ${match[2]} m，比球网带低 ${match[3]} m——如预期一样，速度太慢。`;
  if ((match = /^([\d.]+) m\/s lands at ([\d.]+) m, ([\d.]+) m past the baseline — too fast, as expected\.$/.exec(message))) return `${match[1]} m/s 落在 ${match[2]} m 处，越过底线 ${match[3]} m——如预期一样，速度太快。`;
  if ((match = /^([\d.]+) m\/s clears the tape by ([\d.]+) m and lands ([\d.]+) m inside the baseline\.$/.exec(message))) return `${match[1]} m/s 越过球网带 ${match[2]} m，并落在底线内 ${match[3]} m。`;
  if ((match = /^That is (inside|outside) ([\d.]+ < v ≤ [\d.]+ m\/s)\.$/.exec(message))) return `它${match[1] === 'inside' ? '位于' : '不在'} ${match[2]} 的范围内。`;

  // Dynamic observation messages contain measurements.  They are retained in
  // place and their explanatory wording is translated without altering data.
  return message
    .replace('minimum-speed boundary', '最小速度边界')
    .replace('maximum-speed boundary', '最大速度边界')
    .replace('slowest legal serve', '最慢的合法发球')
    .replace('fastest legal serve', '最快的合法发球')
    .replace('the tape', '球网带')
    .replace('the baseline', '底线')
    .replace('the net', '球网')
    .replace('legal interval', '合法速度区间')
    .replaceAll(' and ', ' 和 ');
}
