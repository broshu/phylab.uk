/**
 * Problem configuration layer.
 * ------------------------------------------------------------------
 * Every piece of "question data" lives here. To add a new scenario
 * (spike, different net height, longer court) add an entry to PROBLEMS —
 * no physics or rendering code needs to change.
 */

/** @typedef {Object} Problem
 * @property {string} id
 * @property {string} title
 * @property {string} prompt        question text
 * @property {number} g             gravitational acceleration, m/s^2
 * @property {number} hitHeight     contact point height, m
 * @property {number} netHeight     net height, m
 * @property {number} netDistance   horizontal distance from server to net, m
 * @property {number} courtEnd      horizontal distance from server to far baseline, m
 * @property {{min:number,max:number,step:number,default:number}} speed slider range
 * @property {Object} [adjustable]  which parameters students may change (future levels)
 */

/** @type {Record<string, Problem>} */
export const PROBLEMS = {
  'serve-basic': {
    id: 'serve-basic',
    title: 'Volleyball Serve',
    titleZh: '排球发球',
    prompt:
      'A player jumps at the baseline and hits the ball horizontally from a ' +
      'height of 3.2 m. The net is 2.2 m high and 9 m away; the far baseline ' +
      'is 18 m away. Ignoring air resistance and taking g = 10 m/s², which ' +
      'launch speeds clear the net and still land in?',
    promptZh:
      '一名球员在底线处起跳，从 3.2 m 高处水平击球。球网高 2.2 m，' +
      '距离击球点 9 m；对方底线距离 18 m。忽略空气阻力，取 g = 10 m/s²，' +
      '哪些初速度既能越过球网，又能落在界内？',
    g: 10,
    hitHeight: 3.2,
    netHeight: 2.2,
    netDistance: 9,
    courtEnd: 18,
    speed: { min: 0, max: 30, step: 1, default: 15, unit: 'm/s' },
    adjustable: {
      speed: true,
      hitHeight: false,
      netHeight: false,
    },
  },
};

export const DEFAULT_PROBLEM_ID = 'serve-basic';

/** Return a shallow copy so runtime code cannot mutate the config. */
export function getProblem(id = DEFAULT_PROBLEM_ID, language = 'en') {
  const p = PROBLEMS[id];
  if (!p) throw new Error(`Unknown problem id: ${id}`);
  return {
    ...p,
    title: language === 'zh-Hans' ? p.titleZh : p.title,
    prompt: language === 'zh-Hans' ? p.promptZh : p.prompt,
    speed: { ...p.speed },
    adjustable: { ...p.adjustable },
  };
}
