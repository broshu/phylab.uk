/**
 * Coaching / hint service.
 * ------------------------------------------------------------------
 * Currently a local rule-based implementation (offline, instant). The
 * interface is deliberately async so that swapping in a real model call
 * only means replacing the body of createTutor — feedback.js stays as is.
 *
 * Remote version:
 *   export function createTutor({ endpoint }) {
 *     return { async hint(ctx) { const r = await fetch(endpoint, {...}); return r.json(); } };
 *   }
 */
import { Verdict } from '../core/evaluator.js';

const fmt = (x, n = 1) => Number(x).toFixed(n);

/** Each rule reads: what happened → why → what to change next. */
function ruleHint(problem, result) {
  const { bounds } = result;

  if (result.verdict === Verdict.NET) {
    return {
      level: result.v < bounds.vMin - 3 ? 'far' : 'near',
      title: 'Into the net',
      body:
        `The ball takes ${fmt(result.tNet, 2)} s to reach the net, and in that ` +
        `time it has already dropped ${fmt(result.dropAtNet, 2)} m — it arrives ` +
        `at ${fmt(result.heightAtNet, 2)} m, which is ${fmt(-result.netClearance, 2)} m ` +
        `below the tape. Slower serves spend longer getting there, so they fall ` +
        `further. Try a larger speed.`,
      focus: 'net',
    };
  }

  if (result.verdict === Verdict.OUT) {
    return {
      level: result.v > bounds.vMax + 3 ? 'far' : 'near',
      title: 'Long — out',
      body:
        `However hard you hit it, a ball released at ${fmt(problem.hitHeight, 1)} m ` +
        `takes ${fmt(result.tLand, 2)} s to reach the floor. In that time this ` +
        `serve travels ${fmt(result.xLand, 1)} m, overshooting the baseline by ` +
        `${fmt(result.outBy, 1)} m. Try a smaller speed.`,
      focus: 'landing',
    };
  }

  return {
    level: 'ok',
    title: 'Good serve',
    body:
      `It crosses the net at ${fmt(result.heightAtNet, 2)} m, clearing the tape by ` +
      `${fmt(result.netClearance, 2)} m, and lands ${fmt(result.xLand, 1)} m out — ` +
      `${fmt(-result.outBy, 1)} m inside the baseline. The legal window is about ` +
      `${fmt(bounds.vMin, 1)}–${fmt(bounds.vMax, 1)} m/s, only ` +
      `${fmt(bounds.vMax - bounds.vMin, 1)} m/s wide: serving leaves very little margin.`,
    focus: 'both',
  };
}

/** Progressive scaffolding once a student has tried several times. */
function scaffold(problem, result, attempts) {
  if (attempts < 4) return null;
  if (result.verdict === Verdict.NET) {
    return `Think: to just graze the tape, how far may the ball fall before the net? (${fmt(
      problem.hitHeight,
      1,
    )} − ${fmt(problem.netHeight, 1)} = ?) Get the time from that, then divide ${
      problem.netDistance
    } m by it.`;
  }
  if (result.verdict === Verdict.OUT) {
    return `Think: the time of flight depends only on the height, t = √(2h/g). Once you have t, the largest legal speed is ${problem.courtEnd} m ÷ t.`;
  }
  return null;
}

export function createTutor() {
  return {
    /**
     * @param {{problem:Object, result:Object, attempts:number}} ctx
     * @returns {Promise<{title:string, body:string, level:string, scaffold?:string}>}
     */
    async hint({ problem, result, attempts = 0 }) {
      const h = ruleHint(problem, result);
      const extra = scaffold(problem, result, attempts);
      return extra ? { ...h, scaffold: extra } : h;
    },
  };
}
