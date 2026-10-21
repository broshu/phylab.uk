// Real-time model for the playable run. SI units. Pure functions, no DOM.
// Straight A→B: frictionless ice, x ∈ [−45, 0], road centre z = 0, half-width 3 m.
// Curve B→C: quarter circle about O = (0, −20), lane radii 17–23 m, μ = 0.1.
// The tail jet pushes along the lane; the side jet exhausts outward, so its thrust points
// toward O (or toward the inner edge on the straight). Tyres roll freely along the lane;
// friction acts only across it: static while the tyres grip, kinetic (μN) while they slide.
// Results: finished, stalled, off (left the ice), drift (reached B sliding sideways),
// skid (static friction plus side thrust could not hold the arc; the car is then uncontrolled).
import {C, TAIL, frictionLimit} from './constants.js?v=20261021-4';
import {plan} from './physics.js?v=20261021-4';

const INNER_R = C.R - C.roadHalfWidth, OUTER_R = C.R + C.roadHalfWidth;

export function createRun({fan = true} = {}) {
  return {
    fan, fmax: frictionLimit(fan), t: 0, x: -C.L, z: 0, vx: 0, vz: 0, gas: C.gas,
    usedStraight: 0, usedCurve: 0, region: 'ice', grip: true, theta: 0, r: C.R,
    status: 'ready', result: null, leftRoad: null, lost: null, finishTime: null, offTime: null, offEdge: null,
    tail: 0, side: 0, friction: 0, frictionKind: null, required: 0, flow: 0, slip: false
  };
}

function frame(s) {
  if (s.x < 0) return {region: 'ice', tx: 1, tz: 0, nx: 0, nz: -1, r: null, theta: 0};
  const dz = s.z + C.R, r = Math.hypot(s.x, dz), theta = Math.atan2(s.x, dz);
  return {region: 'curve', tx: Math.cos(theta), tz: -Math.sin(theta), nx: -Math.sin(theta), nz: -Math.cos(theta), r, theta};
}

/** Lane-relative velocities: vt along the lane, vout across it (positive = toward the outer edge). */
export function laneVelocity(s) {
  const f = frame(s);
  return {...f, vt: s.vx * f.tx + s.vz * f.tz, vout: -(s.vx * f.nx + s.vz * f.nz)};
}

export function speed(s) { return Math.hypot(s.vx, s.vz); }

function substep(s, control, h) {
  const input = typeof control === 'function' ? control(s, h) : control;
  const before = laneVelocity(s);
  const crashed = s.offTime !== null;
  let tail = crashed ? 0 : Math.max(0, Math.min(1, Number(input.tail) || 0)) * TAIL;
  let side = crashed || !input.side ? 0 : Math.max(0, Math.min(C.sideMax, input.sidePower ?? 0));
  let flow = (tail + side) / C.u;
  if (flow * h > s.gas) { const k = flow > 0 ? s.gas / (flow * h) : 0; tail *= k; side *= k; flow *= k; }
  s.gas = Math.max(0, s.gas - flow * h);
  if (before.region === 'ice') s.usedStraight += flow * h; else s.usedCurve += flow * h;
  s.tail = tail; s.side = side; s.flow = flow; s.region = before.region;
  s.required = 0; s.friction = 0; s.frictionKind = null; s.slip = false;

  if (before.region === 'ice') {
    const ax = (tail * before.tx + side * before.nx) / C.m, az = (tail * before.tz + side * before.nz) / C.m;
    s.x += (s.vx + ax * h / 2) * h; s.z += (s.vz + az * h / 2) * h;   // exact for constant force
    s.vx += ax * h; s.vz += az * h;
    s.grip = Math.abs(s.vz) < 1e-9;
  } else if (crashed && (before.r > OUTER_R || before.r < INNER_R)) {
    s.x += s.vx * h; s.z += s.vz * h;        // frictionless run-off beyond the grip band
  } else {
    const {r, theta, vt, vout} = before, fmax = s.fmax;
    const required = C.m * vt * vt / r, need = required - side;
    s.required = required;
    if (!crashed && s.grip && Math.abs(need) <= fmax + 1e-9) {
      // Rolling without lateral slip: static friction supplies whatever the side jet does not.
      s.friction = need; s.frictionKind = 'static';
      const vt2 = vt + tail / C.m * h, th = theta + (vt + vt2) / 2 / r * h;
      s.x = r * Math.sin(th); s.z = -C.R + r * Math.cos(th);
      s.vx = vt2 * Math.cos(th); s.vz = -vt2 * Math.sin(th);
    } else {
      // Tyres slide across the lane: kinetic friction μN opposes the sliding.
      // A skidding car cannot be steered back onto the arc, so the run is lost.
      if (!crashed) { s.lost = {speed: vt, required, side, gas: s.gas}; lose(s, need > 0 ? 'outer' : 'inner', 'skid'); tail = side = 0; s.tail = s.side = s.flow = 0; }
      s.slip = true;
      const dir = Math.abs(vout) > 1e-9 ? Math.sign(vout) : Math.sign(need);
      const f = fmax * dir, inward = side + f;
      s.friction = f; s.frictionKind = 'kinetic';
      s.vx += (tail * before.tx + inward * before.nx) / C.m * h;
      s.vz += (tail * before.tz + inward * before.nz) / C.m * h;
      s.x += s.vx * h; s.z += s.vz * h;
      const after = laneVelocity(s);
      if (Math.sign(after.vout) !== Math.sign(vout) && Math.abs(vout) > 1e-9) { s.vx = after.vt * after.tx; s.vz = after.vt * after.tz; }
    }
  }
  s.t += h;
  const now = frame(s);
  s.theta = now.theta; s.r = now.r ?? C.R;
  if (s.offTime !== null) {
    const elapsed = s.t - s.offTime, onRoad = now.region === 'ice' ? Math.abs(s.z) <= C.roadHalfWidth : now.r <= OUTER_R && now.r >= INNER_R;
    if (!s.leftRoad && !onRoad) s.leftRoad = s.t;
    if ((s.leftRoad && s.t - s.leftRoad >= C.runoff) || elapsed >= 4 || speed(s) < 0.05) s.status = 'over';
    return;
  }
  if (now.region === 'ice') {
    if (Math.abs(s.z) > C.roadHalfWidth) { lose(s, s.z < 0 ? 'inner' : 'outer', 'off'); s.leftRoad = s.t; return; }
  } else {
    if (before.region === 'ice' && Math.abs(s.vz) > 1e-6) { lose(s, s.vz < 0 ? 'inner' : 'outer', 'drift'); return; }
    if (now.theta >= Math.PI / 2) {
      const prev = before.region === 'curve' ? before.theta : 0;
      const frac = (Math.PI / 2 - prev) / Math.max(1e-12, now.theta - prev);
      s.finishTime = s.t - h * (1 - Math.min(1, Math.max(0, frac)));
      s.status = 'over'; s.result = 'finished'; return;
    }
  }
  if (s.gas <= 1e-9 && speed(s) < 0.02) { s.status = 'over'; s.result = 'stalled'; }
}

function lose(s, edge, why) {
  if (s.offTime !== null) return;
  s.offTime = s.t; s.offEdge = edge; s.result = why; s.grip = false;
}

/** Advance by dt seconds of model time. Returns the run (mutated). */
export function step(s, control, dt) {
  if (s.status === 'ready') s.status = 'running';
  if (s.status !== 'running') return s;
  let left = dt;
  while (left > 1e-12 && s.status === 'running') {
    const h = Math.min(C.h, left);
    substep(s, control, h);
    left -= h;
  }
  return s;
}

/** Controllers that replay the textbook plans with the same physics as a player. */
export function autopilot(kind, fan = true) {
  const p = plan({fan, exactPi: true});
  if (kind === 'straight') return () => ({tail: 1, side: false, sidePower: 0});
  return (s, h) => {
    const lane = laneVelocity(s);
    if (lane.region === 'ice') {
      const short = p.v - lane.vt;
      return {tail: short <= 0 ? 0 : Math.min(1, short * C.m / (TAIL * h)), side: false, sidePower: 0};
    }
    const need = Math.max(0, C.m * lane.vt * lane.vt / lane.r - s.fmax);
    return {tail: 0, side: need > 0, sidePower: need};
  };
}

/** Reference plan on the lane centre, with true circle geometry (the game always uses it). */
export function par(fan = true) { return plan({fan, exactPi: true}); }

/** Direction the car body should face: along the lane while it rolls, swinging toward its
 *  velocity (nose turned in) once it slides. Radians, 0 = +x, π/2 = −z. */
export function heading(s) {
  const lane = laneVelocity(s), laneYaw = Math.atan2(-lane.tz, lane.tx);
  if (s.offTime === null) return laneYaw;
  const v = speed(s), velYaw = v > .3 ? Math.atan2(-s.vz, s.vx) : laneYaw;
  return velYaw + (s.offEdge === 'outer' ? .55 : -.55) * Math.min(1, (s.t - s.offTime) * 1.5);
}
