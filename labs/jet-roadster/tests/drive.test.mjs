import test from 'node:test';
import assert from 'node:assert/strict';
import {createCar, drive, speed, surfaceAt, turnRadius, forward} from '../drive.js?v=20261021-4';
import {C, WORLD} from '../constants.js?v=20261021-4';
const near = (a, b, e) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const at = (s, x, z, yaw = 0) => Object.assign(s, {x, z, yaw});
const roll = (s, v) => { const f = forward(s.yaw); s.vx = v * f.x; s.vz = v * f.z; return s; };

test('surfaces: the straight and the rink are ice, the rest has μ = 0.1', () => {
  assert.equal(surfaceAt(-20, 0).mu, 0); assert.equal(surfaceAt(WORLD.icePad.x, WORLD.icePad.z).mu, 0);
  assert.equal(surfaceAt(10, -5).mu, C.mu); assert.equal(surfaceAt(-20, 5).mu, C.mu);
});
test('tail jet: a = 10 m/s² and 40 kg/s, from rest on the ice', () => {
  const s = at(createCar({unlimited: false}), -45, 0); drive(s, {tail: 1}, 1);
  near(speed(s), 10, 1e-9); near(s.x, -45 + 5, 1e-6); near(s.gas, 50, 1e-9);
});
test('on ice, steering and brakes do nothing', () => {
  const s = roll(at(createCar(), -40, 0), 10); drive(s, {steer: 1, brake: true}, 2);
  near(speed(s), 10, 1e-9); near(s.z, 0, 1e-9); near(s.yaw, 0, 1e-12);
});
test('brakes on the ground: deceleration 0.7·μN/m (fan on: 2.1 m/s²)', () => {
  const s = roll(at(createCar(), 30, 60), 10); drive(s, {brake: true}, 1);
  near(speed(s), 10 - 2.1, 1e-6); assert.ok(s.grip);
  drive(s, {brake: true}, 10); near(speed(s), 0, 1e-9);
});
test('steady turn grips while m v²/r ≤ μN, and slides beyond', () => {
  const steer = 1, r = C.wheelbase / Math.tan(C.steerMax);       // ≈ 7.3 m at full lock
  for (const [v, grips] of [[Math.sqrt(6000 * r / C.m) * 0.95, true], [Math.sqrt(6000 * r / C.m) * 1.1, false]]) {
    const s = roll(at(createCar(), 40, 60), v); s.steer = C.steerMax;
    drive(s, {steer, tail: 0}, 1.5);
    assert.equal(s.grip, grips, `v=${v}`);
    if (grips) { near(speed(s), v, 1e-6); near(Math.abs(turnRadius(s)), r, 1e-9); near(s.friction, C.m * v * v / r, 1); }
    else { near(s.friction, 6000, 1e-6); assert.ok(s.slip); }
  }
});
test('the fan triples the grip: same turn at the same speed slides without it', () => {
  const v = 6, steerAngle = .3, run = fan => { const s = roll(at(createCar({fan}), 40, 60), v); s.steer = steerAngle; drive(s, {steer: steerAngle / C.steerMax}, .5); return s.grip; };
  assert.equal(run(true), true); assert.equal(run(false), false);
});
test('a side jet on the ground is held by static friction up to μN', () => {
  const s = at(createCar(), 40, 60); drive(s, {sideL: true, sidePower: 5000}, 1); near(speed(s), 0, 1e-9); assert.ok(s.grip);
  const t = at(createCar(), 40, 60); drive(t, {sideL: true, sidePower: 8000}, 1); near(speed(t), (8000 - 6000) / C.m, 1e-6); assert.ok(!t.grip);
});
test('a side jet on the ice drifts the car sideways while it keeps its heading', () => {
  const s = at(createCar(), -40, 0); drive(s, {sideL: true, sidePower: 4000}, 1);
  near(s.vz, -2, 1e-9); near(s.yaw, 0, 1e-12);
});
test('steering returns to centre when released, at a finite rate', () => {
  const s = roll(at(createCar(), 40, 60), 2); drive(s, {steer: 1}, .1); near(s.steer, .18, 1e-9);
  drive(s, {steer: 1}, 1); near(s.steer, C.steerMax, 1e-12); drive(s, {}, 1); near(s.steer, 0, 1e-12);
});
test('the world edge stops the car', () => {
  const s = roll(at(createCar(), WORLD.maxX - 1, 60), 10); drive(s, {}, 1); near(s.x, WORLD.maxX, 1e-9); near(s.vx, 0, 1e-12); assert.ok(s.wallTime !== null);
});
test('limited air runs out and the jets stop', () => {
  const s = at(createCar({unlimited: false}), 0, 60); drive(s, {tail: 1, sideL: true, sidePower: 20000}, 3); near(s.gas, 0, 1e-9); assert.equal(s.tail, 0);
});
test('free drive starts on the ground, facing the ice straight', () => {
  const s = createCar(); assert.equal(surfaceAt(s.x, s.z).mu, C.mu); assert.equal(s.yaw, 0); assert.ok(s.x < -C.L);
});
