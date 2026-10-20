/**
 * Chinese (simplified) wording for every preset line the Worker sends.
 * The English line in the lesson script is the key. Lines the model writes
 * itself are already in Chinese when the chat is in Chinese (see buildPayload).
 *
 * When you change an English line in steps.js, counter.js, replies.js or
 * guided.js, change its key here too, or the Chinese chat shows the English.
 */
export const ZH = {
  // ---- premise
  "Here is a strange first move: let's agree that Aristotle's rule is TRUE, just for now. In one short sentence, what exactly is his rule about weight and falling?":
    '先来一步奇怪的棋：我们暂且承认亚里士多德的规则是对的。用一句话说说，他关于重量和下落的规则到底是什么？',
  "Clear. Now let's see if his rule survives a test. I'll step back.": '说清楚了。现在看看他的规则经不经得起检验。我先退到一边。',
  'You want to fight my rule before you can even say it? Say it first, young one. In one sentence, what does my rule say about weight and falling?':
    '连我的规则都还没说出来，就想反驳它？年轻人，先把它说出来。用一句话说说，我的规则对重量和下落是怎么说的？',
  'Look back at what Aristotle said. In one short sentence, what is his rule about weight and speed?': '回头看看亚里士多德说过的话。用一句话说说，他关于重量和速度的规则是什么？',
  "Fill the gap: 'According to Aristotle, the ___ a body is, the ___ it falls.'": "填空：「按亚里士多德的说法，物体越___，下落得越___。」",
  'His rule is: the heavier a body, the faster it falls. Can you say it in your own words, so we all agree on it?': '他的规则是：物体越重，下落越快。你能用自己的话说一遍，让大家对它达成一致吗？',
  "Aristotle's rule is: the heavier a body, the faster it falls. For now, we will pretend this is true.": '亚里士多德的规则是：物体越重，下落越快。我们暂且假设它是对的。',

  // ---- tie
  'My rule stands, young one. Read any book you like, it changes nothing: a heavier body falls faster. Break my rule with reasoning alone, if you can.':
    '年轻人，我的规则立得住。你随便翻什么书都改变不了：重的物体落得更快。有本事就只用推理推翻我的规则。',
  "That is the idea. I'll step back; make him follow it.": '就是这个想法。我退到一边，让他顺着你的想法往下走。',
  'Books and drops from towers do not move me, my friend. Every day the heavy body wins. Break my rule with reasoning alone, if you can.':
    '朋友，书本和从塔上扔东西都说服不了我。每天都是重的物体赢。有本事就只用推理推翻我的规则。',
  'Aristotle talks about a heavy stone and a light stone. What could you do with the two stones, only in your mind, to test his rule?':
    '亚里士多德说的是一块重石头和一块轻石头。只在脑子里想，你可以对这两块石头做点什么，来检验他的规则？',
  'What if you joined the two stones together, for example with a short rope? Ask Aristotle what his rule says then.':
    '如果把两块石头连在一起呢，比如用一根短绳绑住？问问亚里士多德，他的规则这时会怎么说。',
  'Try this: tell Aristotle you tie the heavy stone and the light stone together with a short rope, and ask how fast the pair falls by his rule.':
    '试试这样：告诉亚里士多德，你用短绳把重石头和轻石头绑在一起，再问他按他的规则，这一对石头落得多快。',
  "Here is the idea: tie a heavy stone and a light stone together with a short rope, and use Aristotle's own rule on the pair.":
    '思路是这样的：用短绳把一块重石头和一块轻石头绑在一起，再用亚里士多德自己的规则去分析这一对石头。',

  // ---- slower (guided) / counter
  'Very well, let us tie my heavy stone and a light stone together. By my rule, the heavy stone falls at speed 8 and the light stone at speed 4.':
    '好吧，那就把我的重石头和一块轻石头绑在一起。按我的规则，重石头以速度 8 下落，轻石头以速度 4 下落。',
  'The short rope is tight between them. You tell me, young one: does the light stone speed up the heavy one, or hold it back?':
    '两块石头之间的短绳绷紧了。年轻人，你说说：轻石头是让重石头变快，还是拖住它？',
  "Remember that answer. I'll step back again; keep pushing him.": '记住这个答案。我再退到一边，你继续追问他。',
  'Words, my friend, but not an answer. The heavy stone and the light stone are tied together. Does the light one speed the heavy one up, or hold it back?':
    '朋友，这只是话，不是答案。重石头和轻石头绑在一起了，轻的是让重的变快，还是拖住它？',
  'The heavy stone wants to go at 8. The light stone only wants 4. If a fast runner is tied to a slow runner, what happens to the fast runner?':
    '重石头想以 8 的速度落，轻石头只想以 4 的速度落。如果把一个跑得快的人和一个跑得慢的人绑在一起，跑得快的人会怎样？',
  'The rope gets tight, and the slow stone pulls back on the fast one. So is the pair faster or slower than 8?': '绳子绷紧了，慢的石头往回拉快的石头。那么这一对石头比 8 快还是比 8 慢？',
  'The light stone acts like a brake, so the pair falls slower than 8, somewhere between 4 and 8. Do you agree?': '轻石头就像刹车，所以这一对石头比 8 慢，在 4 和 8 之间。你同意吗？',
  'The light stone acts like a brake on the heavy one, so the tied pair falls slower than 8, somewhere between 4 and 8.': '轻石头对重石头起了刹车作用，所以绑在一起的石头比 8 慢，在 4 和 8 之间。',
  'Anything else, young one? Look at the tied pair as one body, if you like. Is it heavier or lighter than my heavy stone alone, and what does my rule say about that?':
    '年轻人，还有别的吗？你也可以把绑在一起的两块石头看成一个物体。它比我那块重石头重还是轻？我的规则又会怎么说？',
  'You turned his own rule on him. Keep going; I am watching.': '你用他自己的规则反过来对付他了。继续，我在旁边看着。',
  'Think again with my own rule. The tied pair, taken as one body: is it heavier or lighter than my heavy stone, and so how fast must it fall?':
    '用我自己的规则再想想。把绑在一起的两块石头看成一个物体：它比我的重石头重还是轻？那它该落得多快？',
  'Put both stones on a scale together. Do they weigh more or less than the heavy stone alone?': '把两块石头一起放到秤上。它们比单独那块重石头重，还是轻？',
  "The pair is heavier than the heavy stone. Now use Aristotle's own rule: a heavier body falls ___?": '这一对石头比重石头还重。现在用亚里士多德自己的规则：更重的物体下落得更___？',
  "By Aristotle's rule, the heavier pair must fall faster than 8, maybe 12. Do you see it?": '按亚里士多德的规则，更重的这一对石头一定比 8 快，也许是 12。看出来了吗？',
  "Together the stones weigh more than the heavy stone alone, so by Aristotle's own rule the pair must fall faster than 8.":
    '两块石头加在一起比单独的重石头更重，所以按亚里士多德自己的规则，这一对石头一定比 8 快。',
  'Tied together, the two stones make one body, heavier than my heavy stone. So by my rule the pair falls faster than 8, perhaps 12. My rule wins again, young one.':
    '绑在一起，两块石头就成了一个物体，比我的重石头还重。所以按我的规则，这一对石头比 8 快，也许是 12。年轻人，我的规则又赢了。',
  "That is the other side of his own rule. I'll step back.": '这正是他自己规则的另一面。我退到一边。',
  'My reasoning is simple: two stones tied together are one heavier body, and by my rule a heavier body falls faster. So the pair falls faster than 8.':
    '我的推理很简单：两块石头绑在一起就是一个更重的物体，按我的规则，更重的物体落得更快。所以这一对石头比 8 快。',
  'Alone, the light stone wants to fall at 4 and the heavy one at 8. When the rope is tight, what does the slow stone do to the fast one?':
    '单独落的时候，轻石头想以 4 的速度落，重石头想以 8 的速度落。绳子绷紧时，慢的石头会对快的石头做什么？',
  'Think of a fast runner tied to a slow runner. Does the slow one help the fast one, or hold him back? So is the pair faster or slower than 8?':
    '想想一个跑得快的人和一个跑得慢的人绑在一起。慢的会帮快的，还是拖住他？那这一对石头比 8 快还是慢？',
  "The light stone acts like a brake, so by Aristotle's own rule the pair should fall slower than 8, between 4 and 8. Can you tell him that?":
    '轻石头就像刹车，所以按亚里士多德自己的规则，这一对石头应该比 8 慢，在 4 和 8 之间。你能这样告诉他吗？',
  'But look at it another way: the slow light stone holds back the fast heavy one, so by the same rule the pair should fall slower than 8, between 4 and 8.':
    '但换个角度看：慢的轻石头拖住了快的重石头，所以按同一条规则，这一对石头应该比 8 慢，在 4 和 8 之间。',
  'Tied together, the slow light stone holds back the fast heavy one, and the heavy one pulls the light one along. So the pair falls between 4 and 8, perhaps 6. My rule wins again, young one.':
    '绑在一起后，慢的轻石头拖住快的重石头，重石头又拉着轻石头往下走。所以这一对石头的速度在 4 和 8 之间，也许是 6。年轻人，我的规则又赢了。',
  "You turned his own rule on him. I'll step back.": '你用他自己的规则反过来对付他了。我退到一边。',
  'My reasoning is simple: the slow stone holds back the fast one, so the pair falls between 4 and 8.': '我的推理很简单：慢的石头拖住快的石头，所以这一对石头的速度在 4 和 8 之间。',
  "By Aristotle's own rule, the heavier pair must fall faster than 8, maybe 12. Can you tell him that?": '按亚里士多德自己的规则，更重的这一对石头一定比 8 快，也许是 12。你能这样告诉他吗？',
  'But look at it another way: together the stones weigh more than the heavy stone alone, so by the same rule the pair must fall faster than 8.':
    '但换个角度看：两块石头加在一起比单独的重石头更重，所以按同一条规则，这一对石头一定比 8 快。',

  // ---- contradiction
  'Wait. You said this pair falls slower than 8, and now faster than 8, both from my own rule. What are you trying to show me?':
    '等等。你先说这一对石头比 8 慢，现在又说比 8 快，两个结论都出自我的规则。你想说明什么？',
  'Wait. By my own rule the pair falls faster than 8, and by my own rule it also falls slower than 8. What are you trying to show me?':
    '等等。按我的规则，这一对石头比 8 快；按我的规则，它又比 8 慢。你想说明什么？',
  'Wait. By my own rule the pair falls slower than 8, and by my own rule it also falls faster than 8. What are you trying to show me?':
    '等等。按我的规则，这一对石头比 8 慢；按我的规则，它又比 8 快。你想说明什么？',
  "That is the heart of it. I'll step back; finish it yourself.": '这就是关键。我退到一边，你自己把它完成吧。',
  'You gave me two answers for the same pair: slower than 8, and faster than 8. Tell me plainly: what do these two answers show?':
    '对同一对石头，你给了我两个答案：比 8 慢，又比 8 快。直接告诉我：这两个答案说明了什么？',
  'Can one pair of stones fall slower than 8 and faster than 8 at the same time?': '同一对石头能同时比 8 慢又比 8 快吗？',
  'Both answers came from the same rule. If a rule gives two answers that fight each other, what does that tell you about the rule?':
    '两个答案都来自同一条规则。如果一条规则推出两个互相打架的答案，这说明这条规则怎么了？',
  'The pair cannot be both slower and faster than 8. That is a contradiction, so the rule we started with must be wrong. Do you agree?':
    '这一对石头不可能既比 8 慢又比 8 快。这就是矛盾，所以我们一开始的规则一定是错的。你同意吗？',
  'One pair cannot be both slower and faster than 8. That is a contradiction, so the rule we started with must be wrong.':
    '同一对石头不可能既比 8 慢又比 8 快。这是矛盾，所以我们一开始的规则一定是错的。',

  // ---- conclusion
  'Then my rule leads to nonsense. So what IS true, clever one? How fast does the tied pair fall, if there is to be no contradiction at all?':
    '那我的规则就推出了荒谬的结论。聪明的年轻人，那什么才是对的？如果不能有任何矛盾，绑在一起的石头该落得多快？',
  "Well said. I'll step back now.": '说得好。我先退到一边。',
  'Then tell me what IS true, clever one. How fast must the tied pair fall, if there is to be no contradiction at all?':
    '那你告诉我什么才是对的，聪明的年轻人。如果不能有任何矛盾，绑在一起的石头必须落得多快？',
  'If tying the stones together changes nothing, then the pair falls at the same speed as each stone. What does that say about the heavy stone and the light stone?':
    '如果把石头绑在一起什么都不改变，那这一对石头和每块石头落得一样快。这对重石头和轻石头说明了什么？',
  'There is only one way the pair is neither slower nor faster than the heavy stone: both stones already fall at the same speed. So does weight decide falling speed?':
    '要让这一对石头既不比重石头慢也不比它快，只有一种可能：两块石头本来就落得一样快。那么，重量决定下落速度吗？',
  'Without air in the way, heavy and light bodies fall at the same rate. Weight does not decide falling speed. Can you say this in your own words?':
    '没有空气阻挡时，重的和轻的物体下落得一样快，重量不决定下落速度。你能用自己的话说一遍吗？',
  'Without air in the way, heavy and light bodies fall at the same rate. Weight does not decide how fast a body falls.':
    '没有空气阻挡时，重的和轻的物体下落得一样快。物体落得多快，不由重量决定。',

  // ---- method
  'And my feather? Now I see it: the air pushes hard on a light, wide feather. Take the air away, and a feather and a coin would fall side by side. So the air fooled me all these years.':
    '那我的羽毛呢？现在我明白了：空气对又轻又宽的羽毛推得很厉害。把空气抽走，羽毛和硬币就会并排落下。原来这么多年是空气骗了我。',
  'Young one, you have beaten me fairly, and with my own rule. I am not angry. I am impressed.': '年轻人，你用我自己的规则，公平地赢了我。我不生气，我很佩服。',
  'You used no lab and no tools, only your mind. Call it a thought experiment. Teach me your trick: in your own words, what steps did you follow to beat me?':
    '你没用实验室，也没用任何工具，只用了你的头脑。这就叫思想实验。教教我你的招数吧：用你自己的话说说，你是按哪几步赢了我的？',
  'Go on, young one. How did you beat me? Tell me the steps of your trick, one by one.': '说吧，年轻人。你是怎么赢我的？把你的招数一步一步告诉我。',
  "Start at the very beginning. What did we do with Aristotle's rule before we tested it?": '从最开始想。在检验亚里士多德的规则之前，我们先对它做了什么？',
  'Look at the notebook beside the chat. After you imagined the tied stones, what did you find when you reasoned in two ways?': '看看聊天旁边的笔记本。设想了绑在一起的石头之后，你用两种方式推理，发现了什么？',
  'You assumed his rule was true, imagined tied stones, reasoned two ways, found a contradiction, and so rejected the rule. Can you say these steps in your own short words?':
    '你先假设他的规则成立，设想了绑在一起的石头，用两种方式推理，发现了矛盾，于是否定了这条规则。你能用自己的话简短说说这几步吗？',
  'You assumed his rule was true, imagined a simple case, reasoned two ways, found a contradiction, and so rejected the rule.':
    '你先假设他的规则成立，设想了一个简单的情境，用两种方式推理，发现了矛盾，于是否定了这条规则。',

  // ---- done
  'So this is your trick: take the rule as true, just for now, imagine a simple case, reason it two ways, find the contradiction, and reject the rule. It works on any claim, even mine.':
    '原来这就是你的招数：先暂且承认规则成立，设想一个简单情境，用两种方式推理，找出矛盾，再否定这条规则。它对任何说法都管用，连我的也不例外。',
  'A good debate. Come back and argue with me again some day. You may ask me anything now.': '这场辩论很精彩。改天再来和我辩一辩。现在你可以问我任何问题。',
  'Forgive me, I lost my thread. Could you ask that again?': '抱歉，我刚才走神了。你能再问一遍吗？',
  'Ask us anything about falling bodies or thought experiments.': '关于物体下落或思想实验，你可以问我们任何问题。',

  // ---- entrances and fixed lines
  "Wait, don't give up yet! I'm Galileo, and I'm on your side. Aristotle argues well, but I think we can beat him with his own rule.":
    '等等，先别放弃！我是伽利略，我站在你这边。亚里士多德很会辩论，但我想我们能用他自己的规则打败他。',
  "Hard to win with examples, isn't it? Every time you find one, Aristotle finds an excuse. I'm Galileo, and I'm on your side. Let's try a different weapon: pure reasoning.":
    '靠举例子很难赢，对吧？你每找到一个例子，亚里士多德就能找到一个借口。我是伽利略，我站在你这边。我们换一种武器：纯粹的推理。',
  "You have pushed that point again and again, and Aristotle always finds an excuse. I'm Galileo, and I'm on your side. Examples will not move him. Let's use a weapon he cannot dodge: his own rule.":
    '这一点你已经说了一遍又一遍，亚里士多德总能找到借口。我是伽利略，我站在你这边。举例子说服不了他，我们用一件他躲不开的武器：他自己的规则。',
  "You called? I'm Galileo, and I'm on your side. Examples alone won't beat Aristotle. Let's beat him with pure reasoning instead.":
    '你叫我？我是伽利略，我站在你这边。光靠例子赢不了亚里士多德，我们用纯粹的推理来打败他。',
  'Calling for help already? Very well, bring anyone you like. The stones will still obey me.': '这么快就叫帮手了？好吧，你想叫谁都行。石头还是会听我的。',
  'Look around you, my friend. An apple drops quickly, but a leaf drifts down slowly. Is the apple not heavier?': '朋友，看看你周围。苹果落得很快，树叶却慢慢飘下来。苹果不是更重吗？',
  'Drop a hammer and a sheet of paper together. Which reaches the floor first? Your own hands will tell you.': '把锤子和一张纸同时放手，谁先落地？你自己的手会告诉你。',
  'A raindrop falls fast, a snowflake floats down. The heavier one hurries home. You say otherwise? Prove it.': '雨滴落得快，雪花慢慢飘。重的总是急着回家。你说不是？那就证明给我看。',
  'You talk about the air, but the air is part of nature. In the real world, heavy things win. Why should I believe otherwise?': '你说空气，可空气本来就是自然的一部分。在真实世界里，重的东西总是赢。我凭什么相信别的说法？',
  'An iron ball and a wooden ball of the same size: the iron one lands first. If it wins by a little, it still wins. What do you say?':
    '同样大小的铁球和木球，铁球先落地。哪怕只赢一点点，也是赢了。你怎么说？',
  'Galileo here, on your side. Let me help a little.': '我是伽利略，站在你这边。让我帮你一点。',
  "Let's put it together.": '我们把它理一理。',
  'My rule stands.': '我的规则依然成立。',
  "I'm here. Ask me anything about falling bodies or thought experiments.": '我在这儿。关于物体下落或思想实验，你可以问我任何问题。',
  "Well done. I'll step back now.": '做得好。我先退到一边。',
  'Sorry, I lost my train of thought. Could you ask that again?': '抱歉，我刚才走神了。你能再问一遍吗？',

  // ---- Aristotle's preset replies
  'No, the heavy one lands first. Watch!': '不，重的先落地。你看！',
  'Look again, young one. The heavy body touches the ground first, every time.': '年轻人，再看一遍。每一次都是重的物体先着地。',
  'The same time? Only to careless eyes. The heavier body always lands first.': '同时？那只是粗心的眼睛看到的。更重的物体总是先落地。',
  'Your experiment is not precise enough. There is a small difference, and the heavy body still wins.': '你的实验不够精确。其实有细微的差别，还是重的物体赢。',
  'Did you measure it closely? There is always a small gap, and the heavy body is ahead.': '你仔细测量了吗？总会有一点点差距，重的物体总是领先。',
  'Hands and eyes are not perfect, my friend. A tiny difference is still a difference, and it favours the heavy body.': '朋友，手和眼睛都不完美。再小的差别也是差别，而且总是重的物体占优。',
  'Even with no air at all, the heavier body would still fall faster.': '就算完全没有空气，更重的物体也还是会落得更快。',
  'Take the air away if you like. The heavy body still has the stronger desire to fall, so it still falls faster.': '你想把空气拿走就拿走吧。重的物体下落的愿望更强，所以它还是落得更快。',
  'Air is not the reason. Without it, the heavier body would still win the race.': '原因不在空气。没有空气，更重的物体照样赢。',
  'A place with no air? I have never seen one, and neither have you. In the real world, the heavy body wins.': '没有空气的地方？我没见过，你也没见过。在真实世界里，重的物体赢。',
  'You speak again of a place without air. Neither of us has stood in one. Here, where we live, the heavy body falls first.': '你又说没有空气的地方。我们俩谁也没站在那种地方过。在我们生活的地方，重的物体先落下。',
  'Far-away places with no air are only stories to me. On this Earth, which we can both see, the heavier body wins.': '遥远的、没有空气的地方，对我来说只是故事。在我们都看得见的地球上，更重的物体赢。',
  'Whoever wrote that never watched an apple and a leaf fall together. Every day my own eyes see the heavy body win.': '写这话的人一定没看过苹果和树叶一起落下。我每天都亲眼看到重的物体赢。',
  'A book can say anything, my friend. The stones in my garden say otherwise.': '朋友，书上什么都可以写。我花园里的石头可不是这么说的。',
  'Your teacher has read books; I have watched things fall. The heavy body wins.': '你的老师读过书，我却亲眼看过东西下落。重的物体赢。',
  'Letters on paper, and the laws of this Newton, do not make a stone fall. Show me one heavy body that loses.': '纸上的字母，还有这位牛顿的定律，都不能让石头落下。给我找一个输掉的重物来。',
  'Symbols again! Symbols do not fall; stones do, and the heavy stone falls faster.': '又是符号！符号不会下落，石头才会，而且重的石头落得更快。',
  'Your Newton and his letters cannot change what my eyes see: the heavier body is quicker.': '你的牛顿和他的字母改变不了我亲眼所见：更重的物体更快。',
  'I once dropped a heavy iron ball and a light one from the Leaning Tower of Pisa, and they landed almost together.': '我曾经从比萨斜塔上同时放下一个重铁球和一个轻铁球，它们几乎同时落地。',
  'Almost! There was a small difference, and you did not look closely.': '几乎！其实有细微的差别，是你没看清楚。',
  'Good, you see it at last. The matter is settled.': '很好，你终于明白了。这件事就这么定了。',
  'Call for help if you like. The stones will still obey me.': '想叫帮手就叫吧。石头还是会听我的。',
  'If you think otherwise, prove it.': '你要是不这么认为，就证明给我看。',
  'Prove me wrong, then.': '那就证明我错了。',
  'Words are easy, young one. Show me a proof.': '年轻人，说说很容易。拿出证明来。',
  'Can you prove that I am wrong?': '你能证明我是错的吗？',
  'Break my rule with reasoning alone, if you can.': '有本事就只用推理推翻我的规则。',

  // ---- guided group
  "Here is a smart first move: let's take Aristotle's rule as TRUE, just for now, so we can test it. In one short sentence, what exactly is the rule about weight and falling?":
    '先走聪明的一步：我们暂且承认亚里士多德的规则是对的，这样才能检验它。用一句话说说，这条关于重量和下落的规则到底是什么？',
  "Let's test the rule with two stones. By the rule, the heavy stone falls at speed 8 and the light stone at speed 4.": '我们用两块石头来检验这条规则。按这条规则，重石头以速度 8 下落，轻石头以速度 4 下落。',
  'Now I tie them together with a short rope. Think about it with me: does the light stone speed up the heavy one, or hold it back?':
    '现在我用短绳把它们绑在一起。和我一起想想：轻石头是让重石头变快，还是拖住它？',
  'Now look at the tied pair as one body. Is it heavier or lighter than the heavy stone alone, and what does the rule say about that?':
    '现在把绑在一起的两块石头看成一个物体。它比单独的重石头重还是轻？这条规则对此会怎么说？',
  'So you said this pair falls slower than 8, and now faster than 8, both from the same rule. What do these two answers show?':
    '你先说这一对石头比 8 慢，现在又说比 8 快，两个结论都出自同一条规则。这两个答案说明了什么？',
  'Then the rule leads to nonsense. So what IS true? How fast does the tied pair fall, if there is to be no contradiction at all?':
    '那这条规则就推出了荒谬的结论。那什么才是对的？如果不能有任何矛盾，绑在一起的石头该落得多快？',
  "Bravo! And Aristotle's feather? Air pushes hard on a light, wide feather. Pump the air out of a glass tube, and a feather and a coin fall side by side.":
    '太棒了！那亚里士多德的羽毛呢？空气对又轻又宽的羽毛推得很厉害。把玻璃管里的空气抽掉，羽毛和硬币就会并排落下。',
  'So the air fooled people for a very long time. Aristotle saw real things; the air was hiding the true rule. You found it with your own reasoning.':
    '所以空气骗了人们很长时间。亚里士多德看到的是真实的现象，只是空气把真正的规律藏了起来。你用自己的推理找到了它。',
  'You did it with no lab and no tools, only your mind. That is called a thought experiment. In your own words: what steps did you follow?':
    '你没用实验室，也没用任何工具，只用了你的头脑。这就叫思想实验。用你自己的话说说：你是按哪几步做的？',
  'Here is your method, the same one I used: take the rule as true, just for now, imagine a simple case, reason it two ways, find the contradiction, and reject the rule. You can use it on any claim.':
    '这就是你的方法，也是我用过的方法：先暂且承认规则成立，设想一个简单情境，用两种方式推理，找出矛盾，再否定这条规则。你可以把它用在任何说法上。',
  'Great work today. You may ask me anything now.': '今天做得很好。现在你可以问我任何问题。',
  'Good, thank you. Now look at a flat sheet of paper and the same sheet crumpled into a ball. Same weight, but do they fall the same way? What do you think?':
    '好的，谢谢你。现在看看一张平展的纸和同一张纸揉成的纸团。重量一样，它们落得一样吗？你怎么想？',
  'That is worth thinking about. Notice how air seems to push more on wide, light things, like a feather or an open sheet of paper.':
    '这值得好好想想。注意看，空气好像对又宽又轻的东西推得更厉害，比如羽毛或展开的纸。',
  'There is no wrong answer yet. Do you think a heavy stone falls faster than a light one? Say why you think so.': '现在还没有错误答案。你觉得重石头比轻石头落得快吗？说说你为什么这样想。',
  "Thank you for sharing your ideas. Examples can be tricky, because air gets in the way. So let's test the rule with a sharper tool: pure reasoning.":
    '谢谢你分享想法。举例子容易出问题，因为空气会碍事。所以我们换一件更锋利的工具来检验这条规则：纯粹的推理。',
  'Joining stones together? That is exactly my idea! Let us build it carefully, one step at a time.': '把石头连在一起？这正是我的想法！我们一步一步仔细地把它搭起来。',
};

const KEYS = Object.keys(ZH).sort((a, b) => b.length - a.length);

/**
 * Chinese for a preset line. Lines built from several preset pieces (a reply
 * plus a challenge, a return line plus a hint) are translated piece by piece.
 * Text the model wrote in Chinese passes through unchanged.
 * @param {string} text
 */
export function toZh(text) {
  if (!text) return text;
  if (ZH[text]) return ZH[text];
  let out = text;
  for (const key of KEYS) if (out.includes(key)) out = out.split(key).join(ZH[key]);
  // Pieces were joined with a space; Chinese needs none.
  return out.replace(/([　-鿿＀-￯])\s+(?=[　-鿿＀-￯])/g, '$1');
}
