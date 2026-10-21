// Closed-form textbook solution. Used for par times, the notes and tests; the game itself
// is advanced by sim.js (challenge) and drive.js (free drive).
import {C, frictionLimit} from './constants.js?v=20261021-4';

/**
 * Burn at full tail thrust to speed v, coast to B, then hold the arc with the least side thrust.
 * v defaults to the fastest speed the 90 kg budget allows.
 */
export function plan({fan = true, exactPi = false, v} = {}) {
  const pi = exactPi ? Math.PI : 3, arc = pi * C.R / 2, fmax = frictionLimit(fan);
  // Gas: m·v/u on the straight + (m v²/R − fmax)·(arc/v)/u in the curve = budget
  const A = C.m / C.u + C.m * arc / (C.R * C.u), B = fmax * arc / C.u;
  const optimum = (C.gas + Math.sqrt(C.gas * C.gas + 4 * A * B)) / (2 * A);
  const speed = v ?? optimum;
  const burn = speed / C.a, burnDistance = speed * speed / (2 * C.a);
  const coast = (C.L - burnDistance) / speed, straightTime = burn + coast;
  const required = C.m * speed * speed / C.R;
  const side = Math.max(0, required - fmax), curveTime = arc / speed;
  const straightGas = C.m * speed / C.u, curveGas = side * curveTime / C.u;
  return {fan, exactPi, pi, arc, fmax, v: speed, optimum, burn, burnDistance, coast, straightTime,
    required, side, curveTime, straightGas, curveGas, duration: straightTime + curveTime};
}

/** Total air used and total time for entry speed v (straight burn, then least side thrust). */
export function totalGas(v, fan = true, pi = 3) { const p = plan({fan, exactPi: pi !== 3, v}); return p.straightGas + p.curveGas; }
export function totalTime(v, pi = 3) { return (C.L + pi * C.R / 2) / v + v / (2 * C.a); }
