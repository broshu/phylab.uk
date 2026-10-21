import test from 'node:test';
import assert from 'node:assert/strict';
import {plan, totalGas, totalTime} from '../physics.js?v=20261021-4';
const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test('10 m/s example, with and without fan (π = 3)', () => {
  const on = plan({v: 10}), off = plan({v: 10, fan: false});
  for (const p of [on, off]) { near(p.burn, 1); near(p.burnDistance, 5); near(p.coast, 4); near(p.straightTime, 5); near(p.curveTime, 3); near(p.duration, 8); near(p.straightGas, 40); }
  near(on.fmax, 6000); near(on.side, 4000); near(on.curveGas, 24); near(off.side, 8000); near(off.curveGas, 48);
});
test('90 kg optimum: v = 12 m/s, 48 + 42 kg, 6.85 s (π = 3, fan on)', () => {
  const p = plan(); near(p.v, 12); near(p.straightGas, 48); near(p.curveGas, 42); near(p.burn, 1.2); near(p.burnDistance, 7.2);
  near(p.coast, 3.15); near(p.straightTime, 4.35); near(p.curveTime, 2.5); near(p.duration, 6.85); near(p.side, 8400);
});
test('all air on the straight: 22.5 m/s needs 50.625 kN at B, 44.625 kN more than friction', () => {
  const p = plan({v: 22.5}); near(p.straightGas, 90); near(p.burn, 2.25); near(p.straightTime, 3.125); near(p.required, 50625); near(p.required - p.fmax, 44625);
});
test('fan switch and true π recompute the allocation within the budget', () => {
  for (const fan of [true, false]) for (const exactPi of [true, false]) {
    const p = plan({fan, exactPi}); near(p.straightGas + p.curveGas, 90); assert.ok(p.v <= 30); near(totalGas(p.v, fan, exactPi ? Math.PI : 3), 90);
  }
  assert.ok(plan({fan: false}).v < 12); assert.ok(plan({exactPi: true}).v < 12);
});
test('optimum is the fastest feasible speed in the model', () => {
  for (const fan of [true, false]) for (const pi of [3, Math.PI]) {
    const p = plan({fan, exactPi: pi === Math.PI});
    for (let v = .2; v < 30; v += .03) if (totalGas(v, fan, pi) <= 90) assert.ok(totalTime(v, pi) >= p.duration - 1e-9);
  }
});
