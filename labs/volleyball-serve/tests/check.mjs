/**
 * Numerical self-check: node tests/check.mjs
 * Verifies the two boundary speeds, the verdict flip on either side of them,
 * and that the time of flight really is independent of the launch speed.
 */
import assert from 'node:assert/strict';
import { getProblem } from '../js/config/problem.js';
import { evaluate, Verdict } from '../js/core/evaluator.js';
import { flightTime, solveBounds } from '../js/core/physics.js';
import { createPlayer, SERVE_TIMELINE } from '../js/ui/player.js';

const p = getProblem();
const { vMin, vMax, feasible } = solveBounds(p);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

let fails = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    fails++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
};

console.log('problem:', {
  h: p.hitHeight, net: p.netHeight, toNet: p.netDistance, baseline: p.courtEnd, g: p.g,
});
console.log(`bounds: vMin = ${vMin.toFixed(4)}  vMax = ${vMax.toFixed(4)}\n`);

check('time of flight = 0.8 s', () => assert(near(flightTime(p.hitHeight, p.g), 0.8)));
check('vMax = 22.5 m/s', () => assert(near(vMax, 22.5)));
check('vMin = 9√5 ≈ 20.1246 m/s', () => assert(near(vMin, 9 * Math.sqrt(5), 1e-9)));
check('a legal window exists', () => assert(feasible));

check('at vMin the ball exactly grazes the tape', () => {
  const r = evaluate(p, vMin);
  assert(near(r.heightAtNet, p.netHeight, 1e-9), `got ${r.heightAtNet}`);
});
check('at vMax the ball lands exactly on the baseline', () => {
  const r = evaluate(p, vMax);
  assert(near(r.xLand, p.courtEnd, 1e-9), `got ${r.xLand}`);
});

check('just below vMin → net', () => assert.equal(evaluate(p, vMin - 0.05).verdict, Verdict.NET));
check('just above vMin → in', () => assert.equal(evaluate(p, vMin + 0.05).verdict, Verdict.IN));
check('just below vMax → in', () => assert.equal(evaluate(p, vMax - 0.05).verdict, Verdict.IN));
check('just above vMax → out', () => assert.equal(evaluate(p, vMax + 0.05).verdict, Verdict.OUT));

check('time of flight does not depend on v', () =>
  assert(near(evaluate(p, 12).tLand, evaluate(p, 28).tLand)));

check('21 and 22 m/s are both good serves', () => {
  assert.equal(evaluate(p, 21).verdict, Verdict.IN);
  assert.equal(evaluate(p, 22).verdict, Verdict.IN);
});

check('slider range covers both bounds', () =>
  assert(p.speed.min < vMin && p.speed.max > vMax));

const figure = createPlayer(p);
const standingPose = figure.pose('aim', 0, 0.5);
const contactPose = figure.pose('serve', SERVE_TIMELINE.contact, 0.5);
check('server starts with the front foot behind the serve line', () =>
  assert(standingPose.frontFoot.x < 0, `front foot at ${standingPose.frontFoot.x}`));
check('jump carries the front foot forward', () =>
  assert(contactPose.frontFoot.x > standingPose.frontFoot.x, 'front foot did not move forward'));
check('contact point stays over the serve line', () =>
  assert(near(contactPose.ball.x, 0) && near(figure.contactPoint.x, 0)));

console.log('\nsample speeds:');
for (const v of [15, 18, 20, 20.5, 21, 22, 22.5, 23, 25]) {
  const r = evaluate(p, v);
  console.log(
    `  v=${String(v).padStart(5)}  height at net=${r.heightAtNet.toFixed(2)} m  ` +
      `landing=${r.xLand.toFixed(2)} m  → ${r.verdict}`,
  );
}

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
