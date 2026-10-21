// Challenge mode: A→B on ice, then the quarter circle to C. Wraps sim.js for the page.
import {C} from './constants.js?v=20261021-4';
import {createRun, step, autopilot, par, laneVelocity, speed, heading} from './sim.js?v=20261021-4';

const kN = n => `${(n / 1000).toFixed(1)} kN`;

export function createChallenge({fan = true, interlock = true} = {}) {
  let run, pilot = null, pilotKind = null, reported = false;
  const settings = {fan, interlock};

  function reset() { run = createRun({fan: settings.fan}); pilot = null; pilotKind = null; reported = false; }
  reset();

  function control(input) {
    if (pilot) return pilot;
    const tail = input.tail ? 1 : 0, side = !!input.sideL, power = input.sidePower;
    // The interlock is checked every physics step, so the jet opens exactly at B.
    return s => ({tail, side: side && (!settings.interlock || s.x >= 0), sidePower: power});
  }

  return {
    get ready() { return run.status === 'ready'; },
    get running() { return run.status === 'running'; },
    get piloted() { return !!pilot; },
    get fan() { return settings.fan; },
    set fan(v) { settings.fan = v; reset(); },
    set interlock(v) { settings.interlock = v; reset(); },
    reset,
    par: () => par(settings.fan),
    bestKey: () => `jet-roadster-best-${settings.fan ? 'fan' : 'nofan'}`,
    startPilot(kind) { reset(); pilot = autopilot(kind, settings.fan); pilotKind = kind; step(run, pilot, 0); },

    /** Advances the run. Returns the model time actually simulated. */
    advance(dt, input) {
      if (run.status === 'ready' && !pilot && (input.tail || input.sideL)) step(run, control(input), 0);
      if (run.status !== 'running') return 0;
      const t0 = run.t; step(run, control(input), dt); return run.t - t0;
    },

    readout(input, paused) {
      const lane = laneVelocity(run), v = speed(run), lost = run.offTime !== null, live = run.status === 'running';
      const status = run.status === 'ready' ? 'Ready' : live
        ? (lost ? (run.result === 'off' ? 'Off the road' : 'Skidding!') : paused ? 'Paused' : pilotKind ? `Autopilot · ${pilotKind === 'ideal' ? 'ideal plan' : 'all on the straight'}` : lane.region === 'ice' ? 'On the ice' : 'In the curve')
        : run.result === 'finished' ? 'Reached C' : run.result === 'stalled' ? 'Stopped' : 'Run lost';
      let grip = 0, gripText = '—', note = 'On the ice there is no friction at all.';
      if (lane.region === 'curve') {
        const need = lost ? run.fmax : Math.abs(run.required - run.side);
        grip = need / run.fmax; gripText = lost ? 'sliding' : `${Math.round(grip * 100)}%`;
        note = lost ? 'Tyres are sliding: friction is kinetic, μN, against the slide.'
          : run.side > run.required ? 'Side jet stronger than needed: friction now points outward.'
          : 'Friction supplies what the side jet does not.';
      } else if (v > 0) note = `At this speed the curve will need ${kN(C.m * v * v / C.R)} toward O; friction can give ${kN(run.fmax)}.`;
      const armed = live && input.sideL && settings.interlock && run.x < 0 && !pilot;
      return {
        status, state: lost ? 'danger' : run.result === 'finished' ? 'done' : live && !paused ? 'live' : 'idle',
        timer: run.result === 'finished' ? run.finishTime : run.t, speed: v, gas: run.gas, flow: run.flow,
        split: {straight: run.usedStraight, curve: run.usedCurve}, region: lane.region === 'ice' ? 'Ice' : 'Curve',
        grip, gripText, gripNote: note, sliding: lost,
        forces: {tail: run.tail, side: run.side, friction: run.frictionKind ? Math.abs(run.friction) : 0, frictionKind: run.frictionKind,
          frictionDir: run.frictionKind ? (run.friction < 0 ? ' out' : ' in') : '', required: lane.region === 'curve' && !lost ? run.required : null, limit: run.fmax, radius: null},
        lamps: {tail: live && run.tail > 0, side: live && run.side > 0, brake: false, skid: lost},
        firing: {tail: live && (run.tail > 0 || (input.tail && run.gas > 0)), sideL: armed ? 'armed' : live && (run.side > 0 || (input.sideL && run.gas > 0 && !armed))},
        steer: 0, sidePowerShown: pilot ? run.side : null
      };
    },

    viewModel() {
      const lane = laneVelocity(run), ln = {x: lane.nx, z: lane.nz};
      return {x: run.x, z: run.z, yaw: heading(run), smoothYaw: true, steer: 0, vx: run.vx, vz: run.vz,
        tail: run.tail, sideL: run.side, sideR: 0, brake: false,
        fx: run.frictionKind ? run.friction * ln.x : 0, fz: run.frictionKind ? run.friction * ln.z : 0, frictionKind: run.frictionKind,
        centre: lane.region === 'curve' && run.offTime === null ? {x: 0, z: -C.R} : null, slip: run.slip || run.offTime !== null};
    },

    /** The end-of-run summary, once per run. */
    outcome(store) {
      if (run.status !== 'over' || reported) return null;
      reported = true;
      const p = par(settings.fan), kind = run.result === 'finished' ? 'good' : 'bad';
      let title, body, stats = [], newBest = false;
      if (run.result === 'finished') {
        const gap = run.finishTime - p.duration;
        title = pilotKind === 'ideal' ? `Ideal run: ${run.finishTime.toFixed(2)} s` : gap < 0.01 ? `${run.finishTime.toFixed(2)} s — that is the ideal run` : `Reached C in ${run.finishTime.toFixed(2)} s`;
        body = gap < 0.01 ? 'Every kilogram of air was used where it counts.'
          : run.gas > 1 ? `You still had ${run.gas.toFixed(1)} kg of air at C. Spend more of it on the straight and enter the curve faster.`
          : 'Close. Try a shorter, earlier burn and the least side thrust that still holds the curve.';
        stats = [['Ideal plan', `${p.duration.toFixed(2)} s`], ['Behind ideal', `${Math.max(0, gap).toFixed(2)} s`], ['Air left', `${run.gas.toFixed(1)} kg`]];
        if (!pilotKind) {
          const best = Number(store.get(this.bestKey()));
          if (!best || run.finishTime < best) { store.set(this.bestKey(), run.finishTime.toFixed(3)); newBest = true; stats.push(['Personal best', 'New!']); }
        }
      } else if (run.result === 'skid' && run.offEdge === 'outer') {
        const {speed: v, required: need, gas} = run.lost;
        title = gas <= 0.01 ? 'Out of air in the curve' : 'Skidded off the curve';
        body = gas <= 0.01
          ? `The tank ran dry, so only friction was left: ${kN(run.fmax)} against the ${kN(need)} the curve needs at ${v.toFixed(1)} m/s.`
          : `At ${v.toFixed(1)} m/s the curve needs ${kN(need)} toward O. Friction gives at most ${kN(run.fmax)}, so the side jet had to give at least ${kN(Math.max(0, need - run.fmax))}.`;
        stats = [['Speed', `${v.toFixed(1)} m/s`], ['Needed', kN(need)], ['Air left', `${run.gas.toFixed(1)} kg`]];
      } else if (run.result === 'skid') {
        title = 'Pushed in toward O';
        body = `The side jet gave ${kN(run.lost.side)}, more than the curve needs plus what friction can hold back (${kN(run.lost.required)} + ${kN(run.fmax)}). Turn the side power down.`;
        stats = [['Speed', `${run.lost.speed.toFixed(1)} m/s`], ['Needed', kN(run.lost.required)], ['Air left', `${run.gas.toFixed(1)} kg`]];
      } else if (run.result === 'drift') {
        title = 'Reached B sliding sideways';
        body = 'The side jet on the ice gave the car a sideways velocity. With no friction, nothing could cancel it, so the tyres were already sliding at B. Save the side jet for the curve.';
        stats = [['Air left', `${run.gas.toFixed(1)} kg`]];
      } else if (run.result === 'off') {
        title = 'Slid off the ice';
        body = 'Ice has no friction: the sideways push from the side jet keeps the car drifting until it leaves the road.';
        stats = [['Air left', `${run.gas.toFixed(1)} kg`]];
      } else {
        title = 'Stopped before C';
        body = 'The car ran out of air before it had any speed to coast on.';
      }
      const wasIdeal = pilotKind === 'ideal';
      pilot = null;
      return {kind, title, body, stats, newBest, offerIdeal: !wasIdeal};
    }
  };
}
