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

/** @param {unknown} search */
export function isEnglishLanguageOverride(search) {
  if (typeof search !== 'string') return false;
  return new URLSearchParams(search).get('lang') === 'en';
}

/**
 * `?lang=en` is the one explicit user override. It can only keep the page in
 * English; Chinese still requires a confirmed Simplified-Chinese system tag.
 * @param {{systemLanguage?: unknown, search?: unknown}} [options]
 */
export function getUiLanguage({
  systemLanguage = globalThis.navigator?.language,
  search = globalThis.location?.search ?? globalThis.window?.location?.search,
} = {}) {
  if (isEnglishLanguageOverride(search)) return 'en';
  return isSimplifiedChineseSystemLanguage(systemLanguage)
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
    switchToEnglish: 'Switch to English',
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
    check: 'Check',
    typeAnswer: 'Type a number',
    enterNumber: 'Enter a number, for example 9 or 1.0.',
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
    switchToEnglish: '切换为英文',
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
    check: '确定',
    typeAnswer: '输入数值',
    enterNumber: '请输入一个数，例如 9 或 1.0。',
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
    'How could you calculate its speed? What do you think the hidden speed is?': '怎样计算这次发球的速度？你认为此时的发球速度是多少？',
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
    'Work out the hidden speed from those two lines, one step at a time.': '根据这两条虚线，一步一步算出被隐藏的速度。',
    'Follow the dashed horizontal line from the hit point to the net.': '沿着水平虚线，从击球点看到球网。',
    'Follow the dashed horizontal line from the hit point to the far baseline.': '沿着水平虚线，从击球点看到对方底线。',
    'Compare the height of the hit point with the height of A.': '比较击球点的高度和 A 点的高度。',
    'Compare the height of the hit point with the height of C.': '比较击球点的高度和 C 点的高度。',
    'Use the vertical fall you just found, not the horizontal distance.': '用刚才求出的竖直下落高度，而不是水平距离。',
    'The fall time depends only on the vertical fall:': '下落时间只由竖直下落高度决定：',
    'Does a legal serve have to meet both conditions, or is one of them enough?': '合法的发球必须同时满足这两个条件，还是满足其中一个就够了？',
    'So does a legal serve need both conditions, or is one enough?': '所以，合法的发球需要同时满足两个条件，还是满足一个就够？',
    'Each serve meets one condition and still fails: one hits the net, the other lands long.': '每一球都只满足一个条件，结果都失败了：一球挂网，一球出界。',
    'Right — both at once. The speeds that work are where the two conditions overlap.': '对，必须同时满足。可行的速度是两个条件的重叠部分，也就是交集。',
    'A legal serve has to meet both at once. The speeds that work are where the two conditions overlap.': '合法的发球必须同时满足两个条件。可行的速度是两个条件的重叠部分，也就是交集。',
    'Both at once': '同时满足',
    'One is enough': '满足一个就够',
  };
  if (exact[message]) return exact[message];

  let match;
  if ((match = /^The marked points can also be selected directly on the court\.$/.exec(message))) return exact[match[0]];
  if ((match = /^horizontal distance · ([\d.]+|\?) m$/.exec(message))) return `水平距离 · ${match[1]} m`;
  if ((match = /^vertical fall · ([\d.]+|\?) m$/.exec(message))) return `竖直下落 · ${match[1]} m`;
  if ((match = /^Yes — ([ABC])\.$/.exec(message))) return `对，${match[1]}。`;
  if ((match = /^Yes — (.+)\.$/.exec(message))) return `对，${match[1]}。`;
  if ((match = /^How far does the ball travel horizontally from the hit point to ([AC])\?$/.exec(message))) return `从击球点到 ${match[1]}，球的水平距离是多少？`;
  if ((match = /^Try again: how far is ([AC]) horizontally from the hit point\?$/.exec(message))) return `再试一次：${match[1]} 与击球点的水平距离是多少？`;
  if ((match = /^([\d.]+) m takes the ball all the way to the far baseline\. A is at the net\.$/.exec(message))) return `${match[1]} m 已经一直到了对方底线。A 在球网处。`;
  if ((match = /^([\d.]+) m only reaches the net\. C is on the far baseline, a full court away\.$/.exec(message))) return `${match[1]} m 只到球网。C 在对方底线，要跨过整个场地。`;
  if ((match = /^How far does the ball fall between the hit point and ([AC])\?$/.exec(message))) return `从击球点到 ${match[1]}，球竖直下落了多少？`;
  if ((match = /^Try again: how far has the ball dropped when it (reaches A|lands at C)\?$/.exec(message))) return `再试一次：球${match[1] === 'reaches A' ? '到达 A 点' : '落到 C 点'}时，一共下落了多少？`;
  if ((match = /^([\d.]+) m is how high A is above the floor, not how far the ball has fallen\. The ball starts ([\d.]+) m up\.$/.exec(message))) return `${match[1]} m 是 A 点离地面的高度，不是球下落的高度。球是从 ${match[2]} m 高处出发的。`;
  if ((match = /^([\d.]+) m is the fall all the way to the floor\. At A the ball is still ([\d.]+) m above the floor\.$/.exec(message))) return `${match[1]} m 是一直落到地面的下落高度。到 A 点时，球离地面还有 ${match[2]} m。`;
  if ((match = /^([\d.]+) m only takes the ball down to the top of the net\. C is on the floor\.$/.exec(message))) return `${match[1]} m 只是下落到网顶的高度。C 点在地面上。`;
  if ((match = /^([\d.]+) m is the height of the net\. C is on the floor, so the ball falls the full height of the hit point\.$/.exec(message))) return `${match[1]} m 是球网的高度。C 点在地面上，所以球要下落击球点的全部高度。`;
  if ((match = /^How long does the ball take to fall ([\d.]+) m\?$/.exec(message))) return `球下落 ${match[1]} m 需要多长时间？`;
  if ((match = /^So how long does the ball take to reach ([AC])\?$/.exec(message))) return `那么，球到达 ${match[1]} 点需要多长时间？`;
  if ((match = /^([\d.]+) s is the time to fall all the way to the floor\. The ball reaches A much sooner, after falling only ([\d.]+) m\.$/.exec(message))) return `${match[1]} s 是一直落到地面所用的时间。球到达 A 点要早得多，那时只下落了 ${match[2]} m。`;
  if ((match = /^([\d.]+) s is the time to fall ([\d.]+) m, the height of the net, not the fall to A\.$/.exec(message))) return `${match[1]} s 是下落 ${match[2]} m（球网的高度）所用的时间，不是下落到 A 点的时间。`;
  if ((match = /^([\d.]+) s only covers the first ([\d.]+) m, down to the top of the net\. To reach C the ball falls the whole ([\d.]+) m\.$/.exec(message))) return `${match[1]} s 只对应前 ${match[2]} m 的下落，也就是落到网顶的高度。要到达 C 点，球要下落全部 ${match[3]} m。`;
  if ((match = /^([\d.]+) s is the time to fall ([\d.]+) m, the height of the net\. To reach C the ball falls the whole ([\d.]+) m\.$/.exec(message))) return `${match[1]} s 是下落 ${match[2]} m（球网的高度）所用的时间。要到达 C 点，球要下落全部 ${match[3]} m。`;
  if ((match = /^You now have two conditions: (v > [\d.]+ m\/s) to clear the net, and (v ≤ [\d.]+ m\/s) to land in\.$/.exec(message))) return `现在有两个条件：${match[1]} 才能过网，${match[2]} 才能落在界内。`;
  if ((match = /^Test that idea\. (\d+) m\/s meets (v ≤ [\d.]+ m\/s), and (\d+) m\/s meets (v > [\d.]+ m\/s)\. Watch both\.$/.exec(message))) return `来检验这个想法。${match[1]} m/s 满足 ${match[2]}，${match[3]} m/s 满足 ${match[4]}。看看这两球。`;
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
  if ((match = /^Watch that limiting serve\. I will hide its speed: it (just reaches A|just lands at C)\.$/.exec(message))) return `观察这次临界发球。我先隐藏它的速度：它${match[1] === 'just reaches A' ? '恰好到达 A 点' : '恰好落在 C 点'}。`;
  if ((match = /^We will use ([AC]): it is where the (slowest|fastest) legal serve reaches its limit\.$/.exec(message))) return `我们使用 ${match[1]} 点：${match[2] === 'slowest' ? '最慢' : '最快'}的合法发球会恰好到达这里。`;
  if ((match = /^We will use (.+)\.$/.exec(message))) return `我们用 ${match[1]}。`;
  if ((match = /^So which point fixes the (minimum-speed|maximum-speed) boundary\?$/.exec(message))) return `那么，哪个点决定${match[1] === 'minimum-speed' ? '最小速度' : '最大速度'}边界？`;
  if ((match = /^Which point does the (slowest|fastest) legal serve just (pass through|land on)\?$/.exec(message))) return `哪一个点是${match[1] === 'slowest' ? '最慢' : '最快'}合法发球恰好${match[2] === 'pass through' ? '通过' : '落在'}的位置？`;
  if ((match = /^What is the speed of the serve that just (reaches A|lands at C)\?$/.exec(message))) return `恰好${match[1] === 'reaches A' ? '到达 A 点' : '落在 C 点'}的发球速度是多少？`;
  if ((match = /^Using that calculation, what is the speed that just (reaches A|lands at C)\?$/.exec(message))) return `根据刚才的计算，恰好${match[1] === 'reaches A' ? '到达 A 点' : '落在 C 点'}的速度是多少？`;
  if ((match = /^The hidden speed is ([\d.]+) m\/s\.$/.exec(message))) return `此时的发球速度是 ${match[1]} m/s。`;
  if ((match = /^The limiting speed is ([\d.]+) m\/s\.$/.exec(message))) return `临界速度是 ${match[1]} m/s。`;
  if ((match = /^Yes\. The hidden speed is ([\d.]+) m\/s\.$/.exec(message))) return `对。此时的发球速度是 ${match[1]} m/s。`;
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
