// Free drive: the same jet car, now with steering and brakes, anywhere in the world.
// Point mass with a heading. The tyres can push in any horizontal direction, but the total
// friction force is at most μN (the friction circle). While that is enough, the car rolls
// where its wheels point: no sideways slip, and it turns about a centre a distance
// wheelbase / tan(steer) to the side. When the demand is larger, the tyres slide and friction
// is kinetic: μN against the sliding. On ice μ = 0, so steering and brakes do nothing.
import {C, TAIL, WORLD, frictionLimit} from './constants.js?v=20261021-4';

export function surfaceAt(x, z) {
  const onStraight = x >= -C.L && x <= 0 && Math.abs(z) <= C.roadHalfWidth;
  const pad = WORLD.icePad, onPad = Math.hypot(x - pad.x, z - pad.z) <= pad.r;
  return onStraight || onPad ? {name: 'ice', mu: 0} : {name: 'ground', mu: C.mu};
}

export function createCar({fan = true, unlimited = true} = {}) {
  const {x, z, yaw} = WORLD.start, surface = surfaceAt(x, z);
  return {fan, unlimited, t: 0, x, z, vx: 0, vz: 0, yaw, yawRate: 0, steer: 0, gas: C.gas,
    tail: 0, sideL: 0, sideR: 0, brake: false, flow: 0, fx: 0, fz: 0, friction: 0, fmax: frictionLimit(fan, surface.mu), demand: 0,
    grip: true, slip: false, surface: surface.name, wallTime: null, distance: 0};
}

export const forward = yaw => ({x: Math.cos(yaw), z: -Math.sin(yaw)});
export const left = yaw => ({x: -Math.sin(yaw), z: -Math.cos(yaw)});
export const speed = s => Math.hypot(s.vx, s.vz);

/** Signed turning radius for the current steer angle (positive = turning left), or Infinity. */
export function turnRadius(s) { return Math.abs(s.steer) < 1e-4 ? Infinity : C.wheelbase / Math.tan(s.steer); }

function substep(s, input, h) {
  // Steering wheel: moves at a finite rate, recentres when released.
  const target = Math.max(-1, Math.min(1, input.steer || 0)) * C.steerMax;
  const rate = input.steer ? C.steerRate : C.steerReturn, d = target - s.steer;
  s.steer += Math.sign(d) * Math.min(Math.abs(d), rate * h);

  // Jets.
  let tail = input.tail ? TAIL : 0;
  const power = Math.max(0, Math.min(C.sideMax, input.sidePower ?? 0));
  let sideL = input.sideL ? power : 0, sideR = input.sideR ? power : 0;
  let flow = (tail + sideL + sideR) / C.u;
  if (!s.unlimited) {
    if (flow * h > s.gas) { const k = flow > 0 ? s.gas / (flow * h) : 0; tail *= k; sideL *= k; sideR *= k; flow *= k; }
    s.gas = Math.max(0, s.gas - flow * h);
  }
  s.tail = tail; s.sideL = sideL; s.sideR = sideR; s.flow = flow; s.brake = !!input.brake;

  const f = forward(s.yaw), l = left(s.yaw);
  const jx = tail * f.x + (sideL - sideR) * l.x, jz = tail * f.z + (sideL - sideR) * l.z;
  const vx1 = s.vx + jx / C.m * h, vz1 = s.vz + jz / C.m * h;

  // Tyres: what force would keep the car rolling where its wheels point?
  const surface = surfaceAt(s.x, s.z), fmax = frictionLimit(s.fan, surface.mu);
  const u = vx1 * f.x + vz1 * f.z;                       // speed along the car
  const yawRate = u * Math.tan(s.steer) / C.wheelbase;   // rolling turn rate
  const brakeDv = s.brake ? Math.min(Math.abs(u), C.brakeShare * fmax / C.m * h) : 0;
  const uT = u - Math.sign(u) * brakeDv, yaw2 = s.yaw + yawRate * h, f2 = forward(yaw2);
  const needX = C.m * (uT * f2.x - vx1) / h, needZ = C.m * (uT * f2.z - vz1) / h, need = Math.hypot(needX, needZ);
  let fx, fz, turn;
  if (need <= fmax + 1e-9) {                             // static friction: roll without slipping
    fx = needX; fz = needZ; turn = yawRate; s.grip = true;
  } else {                                               // kinetic friction against the slide
    const k = need > 0 ? fmax / need : 0;
    fx = needX * k; fz = needZ * k; turn = yawRate * k; s.grip = false;
  }
  s.fx = fx; s.fz = fz; s.friction = Math.hypot(fx, fz); s.fmax = fmax; s.demand = fmax > 0 ? need / fmax : (need > 1 ? Infinity : 0);
  s.slip = !s.grip && need > 1;
  const vx2 = vx1 + fx / C.m * h, vz2 = vz1 + fz / C.m * h;
  s.x += (s.vx + vx2) / 2 * h; s.z += (s.vz + vz2) / 2 * h;
  s.distance += Math.hypot(vx2, vz2) * h;
  s.vx = vx2; s.vz = vz2; s.yaw = yaw2 - yawRate * h + turn * h; s.yawRate = turn;
  s.surface = surface.name;

  // World edge: a barrier that stops the motion into it.
  if (s.x < WORLD.minX || s.x > WORLD.maxX) { s.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, s.x)); s.vx = 0; s.wallTime = s.t; }
  if (s.z < WORLD.minZ || s.z > WORLD.maxZ) { s.z = Math.max(WORLD.minZ, Math.min(WORLD.maxZ, s.z)); s.vz = 0; s.wallTime = s.t; }
  s.t += h;
}

/** Advance by dt seconds. input: {tail, brake, steer (−1 right … +1 left), sideL, sideR, sidePower}. */
export function drive(s, input, dt) {
  let left = dt;
  while (left > 1e-12) { const h = Math.min(C.h, left); substep(s, input, h); left -= h; }
  return s;
}
