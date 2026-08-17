/**
 * Horizontal-launch projectile model. Pure functions, no side effects, no DOM.
 * Origin: ground directly below the contact point. x points into the far court,
 * y points up. The ball starts at (0, hitHeight) with velocity (v, 0).
 */

/** Horizontal displacement at time t. */
export function xAt(t, v) {
  return v * t;
}

/** Height at time t. */
export function yAt(t, h, g) {
  return h - 0.5 * g * t * t;
}

/** Time needed to travel a horizontal distance x. */
export function timeAtX(x, v) {
  return x / v;
}

/** Time needed to fall `drop` metres; returns 0 for drop <= 0. */
export function timeToFall(drop, g) {
  return drop <= 0 ? 0 : Math.sqrt((2 * drop) / g);
}

/** Total time from height h to the ground — independent of v, the key idea here. */
export function flightTime(h, g) {
  return timeToFall(h, g);
}

/** Horizontal distance at landing. */
export function landingX(v, h, g) {
  return v * flightTime(h, g);
}

/** Ball height when it reaches horizontal position x (0 if already landed). */
export function heightAtX(x, v, h, g) {
  const t = timeAtX(x, v);
  return Math.max(0, yAt(t, h, g));
}

/**
 * The two boundary speeds.
 *   vMin — just grazes the net: height at the net exactly equals net height
 *   vMax — lands exactly on the far baseline
 * vMin is exclusive (must be strictly greater); vMax counts as in (line ball is good).
 */
export function solveBounds({ g, hitHeight, netHeight, netDistance, courtEnd }) {
  const drop = hitHeight - netHeight;
  const vMin = drop <= 0 ? Infinity : netDistance / timeToFall(drop, g);
  const vMax = courtEnd / flightTime(hitHeight, g);
  return { vMin, vMax, feasible: vMin < vMax };
}

/**
 * Sampled trajectory up to landing, for rendering.
 * @returns {{x:number,y:number,t:number}[]}
 */
export function trajectory(v, h, g, samples = 120) {
  const tEnd = flightTime(h, g);
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = (tEnd * i) / samples;
    pts.push({ t, x: xAt(t, v), y: yAt(t, h, g) });
  }
  return pts;
}
