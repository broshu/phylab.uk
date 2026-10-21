// Free-drive mode: steer the jet car anywhere in the world. Wraps drive.js for the page.
import {C} from './constants.js?v=20261021-4';
import {createCar, drive, speed, turnRadius, left} from './drive.js?v=20261021-4';

const kN = n => `${(n / 1000).toFixed(1)} kN`;

export function createFree({fan = true, unlimited = true} = {}) {
  const settings = {fan, unlimited};
  let car, started = false;
  function reset() { car = createCar(settings); started = false; }
  reset();

  const anyInput = i => i.tail || i.brake || i.steer || i.sideL || i.sideR;

  return {
    get ready() { return !started; },
    get running() { return started; },
    get piloted() { return false; },
    get fan() { return settings.fan; },
    set fan(v) { settings.fan = v; reset(); },
    set unlimited(v) { settings.unlimited = v; reset(); },
    reset,

    advance(dt, input) {
      if (!started && anyInput(input)) started = true;
      if (!started) return 0;
      drive(car, input, dt); return dt;
    },

    readout(input, paused) {
      const v = speed(car), ice = car.surface === 'ice', r = turnRadius(car), turning = Number.isFinite(r) && v > .3;
      const required = turning && car.grip ? C.m * v * v / Math.abs(r) : null;
      const wall = car.wallTime !== null && car.t - car.wallTime < 1;
      let gripText = '—', grip = 0, note;
      if (ice) note = v > .3 ? 'Ice: μ = 0. Steering and brakes have nothing to push against, so the car keeps its velocity. Only the jets change it.'
        : 'Ice: μ = 0. Only the jets can move the car here.';
      else {
        grip = car.demand; gripText = car.slip ? 'sliding' : `${Math.round(Math.min(1, grip) * 100)}%`;
        note = car.slip ? (turning ? `Sliding: this turn needs m v²/r = ${kN(C.m * v * v / Math.abs(r))}, but the tyres give at most μN = ${kN(car.fmax)}. Slow down or steer less.`
            : `Sliding: the tyres give at most μN = ${kN(car.fmax)}, not enough to hold the car on the line its wheels point along.`)
          : turning ? `Turning radius ${Math.abs(r).toFixed(1)} m: friction gives m v²/r = ${kN(required)} toward the centre (limit ${kN(car.fmax)}).`
          : car.brake && v > .05 ? `Braking: friction acts backwards, ${kN(car.friction)}.`
          : 'Rolling straight: no sideways friction is needed.';
      }
      if (wall) note = 'You hit the fence at the edge of the field.';
      const status = !started ? 'Ready' : paused ? 'Paused' : car.slip ? 'Sliding!' : ice ? 'On ice' : v < .05 ? 'Stopped' : 'Driving';
      return {
        status, state: car.slip || wall ? 'danger' : started && !paused ? 'live' : 'idle',
        timer: car.t, speed: v, gas: settings.unlimited ? null : car.gas, flow: car.flow, split: null,
        region: ice ? 'Ice' : 'Ground', grip, gripText, gripNote: note, sliding: car.slip,
        forces: {tail: car.tail, side: Math.abs(car.sideL - car.sideR), friction: car.friction, frictionKind: car.friction > 1 ? (car.grip ? 'static' : 'kinetic') : null,
          frictionDir: '', required, limit: car.fmax, radius: turning ? Math.abs(r) : null},
        lamps: {tail: car.tail > 0, side: car.sideL > 0 || car.sideR > 0, brake: car.brake && v > .05, skid: car.slip},
        firing: {tail: car.tail > 0, brake: !!input.brake, left: input.steer > 0, right: input.steer < 0, sideL: car.sideL > 0, sideR: car.sideR > 0},
        steer: car.steer / C.steerMax, sidePowerShown: null
      };
    },

    viewModel() {
      const v = speed(car), r = turnRadius(car), l = left(car.yaw);
      const centre = Number.isFinite(r) && v > .3 && car.grip && car.surface !== 'ice' ? {x: car.x + l.x * r, z: car.z + l.z * r} : null;
      return {x: car.x, z: car.z, yaw: car.yaw, smoothYaw: false, steer: car.steer, vx: car.vx, vz: car.vz,
        tail: car.tail, sideL: car.sideL, sideR: car.sideR, brake: car.brake && v > .05,
        fx: car.fx, fz: car.fz, frictionKind: car.grip ? 'static' : 'kinetic', centre, slip: car.slip};
    },

    outcome() { return null; }
  };
}
