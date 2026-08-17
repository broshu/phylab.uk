/**
 * Judgement layer: given a problem and a launch speed, produce every
 * intermediate quantity plus the verdict. UI modules consume this object and
 * never do physics themselves.
 */
import { flightTime, heightAtX, landingX, solveBounds, timeAtX } from './physics.js';

export const Verdict = {
  NET: 'net', // hits the net
  OUT: 'out', // lands beyond the baseline
  IN: 'in', // good serve
};

/**
 * @param {import('../config/problem.js').Problem} problem
 * @param {number} v launch speed, m/s
 */
export function evaluate(problem, v) {
  const { g, hitHeight: h, netHeight, netDistance, courtEnd } = problem;

  const tNet = timeAtX(netDistance, v);
  const dropAtNet = 0.5 * g * tNet * tNet;
  const heightAtNet = heightAtX(netDistance, v, h, g);
  const netClearance = heightAtNet - netHeight; // > 0 clears, < 0 into the net

  const tLand = flightTime(h, g);
  const xLand = landingX(v, h, g);
  const outBy = xLand - courtEnd; // > 0 means out

  const bounds = solveBounds(problem);

  let verdict;
  if (netClearance <= 0) verdict = Verdict.NET;
  else if (outBy > 0) verdict = Verdict.OUT;
  else verdict = Verdict.IN;

  return {
    v,
    verdict,
    passed: verdict === Verdict.IN,
    // clearing the net
    tNet,
    dropAtNet,
    heightAtNet,
    netClearance,
    // landing
    tLand,
    xLand,
    outBy,
    landingFromNet: xLand - netDistance,
    // boundary speeds
    bounds,
  };
}
