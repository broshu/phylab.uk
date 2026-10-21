import {C} from './physics.js';
import {createRun, step, autopilot, par, laneVelocity, speed, G} from './sim.js';

const $ = id => document.getElementById(id), all = s => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
if (params.get('embed') === '1') document.body.classList.add('embed');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
};

let fanOn = params.get('fan') !== '0';
let run = createRun({fan: fanOn});
let pilot = null, pilotKind = null, paused = false, view = null, lastFrame = 0, resultShown = false;
const held = {tail: new Set(), side: new Set()};
let sidePower = Number($('power').value) * 1000;
const opts = {forces: true, xray: false};
let interlock = params.get('interlock') !== '0';

const kN = n => `${(n / 1000).toFixed(1)} kN`;
const isHeld = k => held[k].size > 0;
const bestKey = () => `jet-roadster-best-${fanOn ? 'fan' : 'nofan'}`;

function control() {
  if (pilot) return pilot;
  const tail = isHeld('tail') ? 1 : 0, side = isHeld('side');
  return s => ({tail, side: side && (!interlock || s.x >= 0), sidePower});
}

function restart({keepPilot = false} = {}) {
  run = createRun({fan: fanOn});
  if (!keepPilot) { pilot = null; pilotKind = null; }
  paused = false; resultShown = false;
  $('result').hidden = true; $('hint').hidden = !!pilot;
  view?.reset();
  draw(0);
}

function startPilot(kind) {
  restart();
  pilot = autopilot(kind, fanOn); pilotKind = kind;
  $('hint').hidden = true;
  step(run, pilot, 0);
}

function setPower(newtons) {
  sidePower = Math.max(0, Math.min(G.sideMax, Math.round(newtons / 100) * 100));
  $('power').value = (sidePower / 1000).toFixed(1);
  $('powerValue').textContent = kN(sidePower);
  $('sideBtnInfo').textContent = `${kN(sidePower)} · ${(sidePower / C.u).toFixed(0)} kg/s`;
}

// ---------- input ----------
const KEYS = {ArrowUp: 'tail', KeyW: 'tail', ArrowLeft: 'side', KeyA: 'side'};
function press(kind, source) {
  if (pilot || run.status === 'over') return;
  held[kind].add(source);
  if (run.status === 'ready') { $('hint').hidden = true; step(run, control(), 0); }
}
function release(kind, source) { held[kind].delete(source); }
document.addEventListener('keydown', e => {
  if (e.target.closest?.('input,select,textarea')) return;
  if (KEYS[e.code]) { e.preventDefault(); press(KEYS[e.code], e.code); return; }
  if (e.repeat) return;
  if (e.code === 'KeyR') restart();
  else if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  else if (e.code === 'KeyQ') setPower(sidePower - 500);
  else if (e.code === 'KeyE') setPower(sidePower + 500);
  else if (e.code === 'KeyV') { const order = ['chase', 'cockpit', 'overview', 'top']; setView(order[(order.indexOf(view?.mode ?? 'chase') + 1) % order.length]); }
});
document.addEventListener('keyup', e => { if (KEYS[e.code]) release(KEYS[e.code], e.code); });
window.addEventListener('blur', () => { held.tail.clear(); held.side.clear(); });
for (const [id, kind] of [['tailBtn', 'tail'], ['sideBtn', 'side']]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); press(kind, 'p' + e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, e => release(kind, 'p' + e.pointerId));
  b.addEventListener('contextmenu', e => e.preventDefault());
}
$('power').addEventListener('input', e => setPower(Number(e.target.value) * 1000));
$('resetBtn').addEventListener('click', () => restart());
$('againBtn').addEventListener('click', () => restart());
$('watchBtn').addEventListener('click', () => startPilot('ideal'));
$('pauseBtn').addEventListener('click', togglePause);
all('[data-auto]').forEach(b => b.addEventListener('click', () => startPilot(b.dataset.auto)));
all('[data-fan]').forEach(b => b.addEventListener('click', () => { fanOn = b.dataset.fan === 'true'; syncSetup(); restart(); }));
$('showForces').addEventListener('change', e => { opts.forces = e.target.checked; });
$('xray').addEventListener('change', e => { opts.xray = e.target.checked; });
$('interlock').addEventListener('change', e => { interlock = e.target.checked; restart(); });
$('interlock').checked = interlock;
all('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
$('fullBtn').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('rig').requestFullscreen(); } catch { /* fullscreen refused */ }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && run.status === 'running') { paused = true; syncPause(); } });

function togglePause() { if (run.status !== 'running') return; paused = !paused; syncPause(); }
function syncPause() { $('pauseBtn').textContent = paused ? '▶' : 'Ⅱ'; $('pauseBtn').setAttribute('aria-label', paused ? 'Resume' : 'Pause'); }
function setView(mode) {
  view?.cameraView(mode);
  all('[data-view]').forEach(b => b.classList.toggle('selected', b.dataset.view === mode));
  $('viewport').dataset.view = mode;
}
function syncSetup() {
  all('[data-fan]').forEach(b => { const on = (b.dataset.fan === 'true') === fanOn; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); });
  const p = par(fanOn);
  $('parNote').innerHTML = `The game draws a true circle (<i>π</i> = 3.14159…). Its ideal plan${fanOn ? '' : ' with the fan off'}: reach B at ${p.v.toFixed(2)} m/s using ${p.straightGas.toFixed(1)} kg, then ${p.curveGas.toFixed(1)} kg of side jet at ${kN(p.side)} — ${p.duration.toFixed(2)} s.`;
  showBest();
}
function showBest() {
  const best = Number(store.get(bestKey()));
  $('bestReadout').textContent = best ? `${best.toFixed(2)} s` : '—';
  $('bestReadout').title = `Ideal plan: ${par(fanOn).duration.toFixed(2)} s`;
}

// ---------- drawing ----------
function draw(dt) {
  const lane = laneVelocity(run), v = speed(run);
  const p = par(fanOn);
  const status = run.status === 'ready' ? 'Ready' : run.status === 'running'
    ? (run.offTime !== null ? (run.result === 'off' ? 'Off the road' : 'Skidding!') : paused ? 'Paused' : pilotKind ? `Autopilot · ${pilotKind === 'ideal' ? 'ideal plan' : 'all on the straight'}` : run.region === 'ice' ? 'On the ice' : 'In the curve')
    : run.result === 'finished' ? 'Reached C' : run.result === 'stalled' ? 'Stopped' : 'Run lost';
  $('statusText').textContent = status;
  $('statusChip').dataset.state = run.offTime !== null ? 'danger' : run.result === 'finished' ? 'done' : run.status === 'running' && !paused ? 'live' : 'idle';
  $('timer').textContent = (run.result === 'finished' ? run.finishTime : run.t).toFixed(2);

  $('speed').textContent = v.toFixed(1); $('dashSpeed').textContent = v.toFixed(1);
  $('speedArc').setAttribute('stroke-dasharray', `${Math.min(1, v / 25)} 1`);
  $('gas').textContent = run.gas.toFixed(1); $('dashGas').textContent = run.gas.toFixed(1);
  const gasPct = `${run.gas / C.gas * 100}%`; $('gasBar').style.width = gasPct; $('dashGasBar').style.width = gasPct;
  for (const id of ['gasBar', 'dashGasBar']) $(id).classList.toggle('low', run.gas < 15);
  $('dashFlow').textContent = `${run.flow.toFixed(1)} kg/s`;
  $('usedStraight').textContent = run.usedStraight.toFixed(1); $('usedCurve').textContent = run.usedCurve.toFixed(1);
  $('regionTag').textContent = lane.region === 'ice' ? 'Ice' : 'Curve';

  // Grip: share of the friction limit that the curve currently demands.
  let grip = 0, gripText = '—', note = 'On the ice there is no friction at all.';
  if (lane.region === 'curve') {
    const need = run.offTime !== null ? run.fmax : Math.abs(run.required - run.side);
    grip = need / run.fmax; gripText = run.offTime !== null ? 'sliding' : `${Math.round(grip * 100)}%`;
    note = run.offTime !== null ? 'Tyres are sliding: friction is kinetic, μN, against the slide.'
      : run.side > run.required ? 'Side jet stronger than needed: friction now points outward.'
      : 'Friction supplies what the side jet does not.';
  } else if (lane.region === 'ice' && v > 0) {
    const req = C.m * v * v / C.R;
    note = `At this speed the curve will need ${kN(req)} toward O; friction can give ${kN(run.fmax)}.`;
  }
  $('gripText').textContent = gripText; $('gripNote').textContent = note;
  for (const id of ['gripBar', 'dashGrip']) { $(id).style.width = `${Math.min(1, grip) * 100}%`; $(id).classList.toggle('over', run.offTime !== null); }

  $('fTail').textContent = kN(run.tail); $('fSide').textContent = kN(run.side);
  $('fFrictionLabel').textContent = run.frictionKind === 'kinetic' ? 'Kinetic friction' : run.frictionKind === 'static' ? 'Static friction' : 'Friction';
  $('fFriction').textContent = run.frictionKind ? `${kN(Math.abs(run.friction))}${run.friction < 0 ? ' out' : ' in'}` : '0.0 kN';
  $('fRequired').textContent = lane.region === 'curve' && run.offTime === null ? kN(run.required) : '—';
  $('fLimit').textContent = kN(run.fmax);

  const tailOn = run.tail > 0, sideOn = run.side > 0;
  $('lampTail').classList.toggle('on', tailOn); $('lampSide').classList.toggle('on', sideOn); $('lampSkid').classList.toggle('on', run.offTime !== null);
  const live = run.status === 'running';
  $('tailBtn').classList.toggle('firing', live && (tailOn || (isHeld('tail') && run.gas > 0)));
  $('sideBtn').classList.toggle('firing', live && (sideOn || (isHeld('side') && run.gas > 0 && (!interlock || run.x >= 0))));
  $('sideBtn').classList.toggle('armed', live && isHeld('side') && interlock && run.x < 0);
  $('lampTail').classList.toggle('on', live && tailOn); $('lampSide').classList.toggle('on', live && sideOn);
  for (const b of [$('tailBtn'), $('sideBtn'), $('power')]) b.disabled = !!pilot;
  if (pilot) { $('power').value = (run.side / 1000).toFixed(1); $('powerValue').textContent = kN(run.side); }

  view?.update(run, {...opts, fan: fanOn}, dt);
  if (run.status === 'over' && !resultShown) showResult(p);
}

function showResult(p) {
  resultShown = true; held.tail.clear(); held.side.clear();
    let title, body, stats = [];
  if (run.result === 'finished') {
    const gap = run.finishTime - p.duration;
    title = pilotKind === 'ideal' ? `Ideal run: ${run.finishTime.toFixed(2)} s` : gap < 0.01 ? `${run.finishTime.toFixed(2)} s — that is the ideal run` : `Reached C in ${run.finishTime.toFixed(2)} s`;
    body = gap < 0.01 ? 'Every kilogram of air was used where it counts.'
      : run.gas > 1 ? `You still had ${run.gas.toFixed(1)} kg of air at C. Spend more of it on the straight and enter the curve faster.`
      : 'Close. Try a shorter, earlier burn and the least side thrust that still holds the curve.';
    stats = [['Ideal plan', `${p.duration.toFixed(2)} s`], ['Behind ideal', `${Math.max(0, gap).toFixed(2)} s`], ['Air left', `${run.gas.toFixed(1)} kg`]];
    if (!pilotKind) {
      const best = Number(store.get(bestKey()));
      if (!best || run.finishTime < best) { store.set(bestKey(), run.finishTime.toFixed(3)); showBest(); stats.push(['Personal best', 'New!']); }
    }
  } else if (run.result === 'skid' && run.offEdge === 'outer') {
    const curveV = run.lost.speed, need = run.lost.required;
    title = run.lost.gas <= 0.01 ? 'Out of air in the curve' : 'Skidded off the curve';
    body = run.lost.gas <= 0.01
      ? `The tank ran dry, so only friction was left: ${kN(run.fmax)} against the ${kN(need)} the curve needs at ${curveV.toFixed(1)} m/s.`
      : `At ${curveV.toFixed(1)} m/s the curve needs ${kN(need)} toward O. Friction gives at most ${kN(run.fmax)}, so the side jet had to give at least ${kN(Math.max(0, need - run.fmax))}.`;
    stats = [['Speed', `${curveV.toFixed(1)} m/s`], ['Needed', kN(need)], ['Air left', `${run.gas.toFixed(1)} kg`]];
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
  $('resultTitle').textContent = title; $('resultBody').textContent = body;
  $('resultStats').innerHTML = stats.map(([k, val]) => `<div><span>${k}</span><b>${val}</b></div>`).join('');
  $('watchBtn').hidden = pilotKind === 'ideal';
  $('result').dataset.kind = run.result === 'finished' ? 'good' : 'bad';
  $('result').hidden = false;
  if (pilotKind) { pilot = null; }
}

// ---------- loop ----------
setPower(sidePower); syncSetup(); setView('chase');
try { const {createScene} = await import('./scene.js'); view = createScene($('scene'), $('labels')); setView('chase'); }
catch (error) { $('renderError').hidden = false; console.error('3D initialisation failed', error); }
draw(0);
function frame(now) {
  const real = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0; lastFrame = now;
  let dt = 0;
  if (run.status === 'running' && !paused) { dt = real * Number($('timeScale').value); step(run, control(), dt); }
  draw(dt);
  view?.render(real);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
