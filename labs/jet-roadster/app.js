// Page shell: mode switching, input, the frame loop and the HUD. Each mode (challenge.js,
// free.js) owns its own model and returns a plain readout and view model every frame.
import {C} from './constants.js?v=20261021-4';
import {createChallenge} from './challenge.js?v=20261021-4';
import {createFree} from './free.js?v=20261021-4';

const $ = id => document.getElementById(id), all = s => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
if (params.get('embed') === '1') document.body.classList.add('embed');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
};
const kN = n => `${(n / 1000).toFixed(1)} kN`;

let fanOn = params.get('fan') !== '0';
const games = {
  challenge: createChallenge({fan: fanOn, interlock: params.get('interlock') !== '0'}),
  free: createFree({fan: fanOn, unlimited: params.get('air') !== 'limited'})
};
let mode = params.get('mode') === 'free' ? 'free' : 'challenge', game = games[mode];
let paused = false, view = null, lastFrame = 0, sidePower = 8000;
const opts = {forces: true, xray: false};

// ---------- input: every key or pointer is a source holding an action ----------
const KEYS = {
  challenge: {ArrowUp: 'tail', KeyW: 'tail', ArrowLeft: 'sideL', KeyA: 'sideL', KeyQ: 'sideL'},
  free: {ArrowUp: 'tail', KeyW: 'tail', ArrowDown: 'brake', KeyS: 'brake', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', KeyQ: 'sideL', KeyE: 'sideR'}
};
const held = new Map();
const isHeld = a => (held.get(a)?.size ?? 0) > 0;
function press(action, source) { if (game.piloted) return; if (!held.has(action)) held.set(action, new Set()); held.get(action).add(source); }
function release(action, source) { held.get(action)?.delete(source); }
function releaseAll() { held.clear(); }
function input() {
  return {tail: isHeld('tail'), brake: isHeld('brake'), steer: (isHeld('left') ? 1 : 0) - (isHeld('right') ? 1 : 0),
    sideL: isHeld('sideL'), sideR: isHeld('sideR'), sidePower};
}

document.addEventListener('keydown', e => {
  if (e.target.closest?.('input:not([type=range]):not([type=checkbox]),select,textarea')) return;
  const action = KEYS[mode][e.code];
  if (action) { e.preventDefault(); press(action, e.code); return; }
  if (e.repeat) return;
  if (e.code === 'KeyR') restart();
  else if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  else if (e.code === 'BracketLeft') setPower(sidePower - 500);
  else if (e.code === 'BracketRight') setPower(sidePower + 500);
  else if (e.code === 'KeyV') { const order = ['chase', 'cockpit', 'overview', 'top']; setView(order[(order.indexOf(view?.mode ?? 'chase') + 1) % order.length]); }
});
document.addEventListener('keyup', e => { const action = KEYS[mode][e.code]; if (action) release(action, e.code); });
window.addEventListener('blur', releaseAll);
for (const b of all('[data-action]')) {
  const action = b.dataset.action, id = e => 'p' + e.pointerId;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); press(action, id(e)); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, e => release(action, id(e)));
  b.addEventListener('contextmenu', e => e.preventDefault());
}

// ---------- settings and buttons ----------
function setPower(newtons) {
  sidePower = Math.max(0, Math.min(C.sideMax, Math.round(newtons / 100) * 100));
  $('power').value = (sidePower / 1000).toFixed(1); $('powerValue').textContent = kN(sidePower);
  for (const el of all('.side-info')) el.textContent = `${kN(sidePower)} · ${(sidePower / C.u).toFixed(0)} kg/s`;
}
$('power').addEventListener('input', e => setPower(Number(e.target.value) * 1000));
$('power').addEventListener('change', e => e.target.blur());
$('resetBtn').addEventListener('click', () => restart());
$('againBtn').addEventListener('click', () => restart());
$('watchBtn').addEventListener('click', () => { restart(); games.challenge.startPilot('ideal'); });
$('pauseBtn').addEventListener('click', togglePause);
all('[data-auto]').forEach(b => b.addEventListener('click', () => { restart(); games.challenge.startPilot(b.dataset.auto); }));
all('[data-fan]').forEach(b => b.addEventListener('click', () => { fanOn = b.dataset.fan === 'true'; games.challenge.fan = fanOn; games.free.fan = fanOn; syncSetup(); restart(); }));
$('showForces').addEventListener('change', e => { opts.forces = e.target.checked; });
$('xray').addEventListener('change', e => { opts.xray = e.target.checked; });
$('interlock').checked = params.get('interlock') !== '0';
$('interlock').addEventListener('change', e => { games.challenge.interlock = e.target.checked; restart(); });
$('limitedAir').checked = params.get('air') === 'limited';
$('limitedAir').addEventListener('change', e => { games.free.unlimited = !e.target.checked; restart(); });
all('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
all('.mode-tabs [data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('fullBtn').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('rig').requestFullscreen(); } catch { /* fullscreen refused */ }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && game.running) { paused = true; syncPause(); } });

function togglePause() { if (!game.running) return; paused = !paused; syncPause(); }
function syncPause() { $('pauseBtn').textContent = paused ? '▶' : 'Ⅱ'; $('pauseBtn').setAttribute('aria-label', paused ? 'Resume' : 'Pause'); }
function setView(next) {
  view?.cameraView(next);
  all('[data-view]').forEach(b => b.classList.toggle('selected', b.dataset.view === next));
  $('viewport').dataset.view = next;
}
function restart() {
  game.reset(); paused = false; syncPause(); releaseAll();
  $('result').hidden = true;
  view?.reset(game.viewModel());
}
function setMode(next) {
  mode = next; game = games[mode];
  document.body.dataset.mode = mode;
  all('.mode-tabs [data-mode]').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('selected', on); b.setAttribute('aria-selected', on); });
  $('timeScale').value = mode === 'free' ? '1' : '0.5';
  view?.setWorld(mode === 'free' ? 'free' : 'challenge');
  restart();
  try { const url = new URL(location.href); if (mode === 'free') url.searchParams.set('mode', 'free'); else url.searchParams.delete('mode'); history.replaceState(null, '', url); } catch { /* sandboxed */ }
}
function syncSetup() {
  all('[data-fan]').forEach(b => { const on = (b.dataset.fan === 'true') === fanOn; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', on); });
  const p = games.challenge.par();
  $('parNote').innerHTML = `The game draws a true circle (<i>π</i> = 3.14159…). Its ideal plan${fanOn ? '' : ' with the fan off'}: reach B at ${p.v.toFixed(2)} m/s using ${p.straightGas.toFixed(1)} kg, then ${p.curveGas.toFixed(1)} kg of side jet at ${kN(p.side)} — ${p.duration.toFixed(2)} s.`;
  showBest();
}
function showBest() {
  const best = Number(store.get(games.challenge.bestKey()));
  $('bestReadout').textContent = best ? `${best.toFixed(2)} s` : '—';
  $('bestReadout').title = `Ideal plan: ${games.challenge.par().duration.toFixed(2)} s`;
}

// ---------- HUD ----------
function render(ro) {
  $('statusText').textContent = ro.status; $('statusChip').dataset.state = ro.state;
  $('timer').textContent = ro.timer.toFixed(2);
  for (const id of ['speed', 'dashSpeed']) $(id).textContent = ro.speed.toFixed(1);
  $('speedArc').setAttribute('stroke-dasharray', `${Math.min(1, ro.speed / 25)} 1`);

  const unlimited = ro.gas === null, gasText = unlimited ? '∞' : ro.gas.toFixed(1), pct = unlimited ? '100%' : `${ro.gas / C.gas * 100}%`;
  for (const id of ['gas', 'dashGas']) $(id).textContent = gasText;
  $('gasMax').textContent = unlimited ? ' unlimited' : ' / 90 kg'; $('dashGasUnit').textContent = unlimited ? '' : ' kg';
  for (const id of ['gasBar', 'dashGasBar']) { $(id).style.width = pct; $(id).classList.toggle('low', !unlimited && ro.gas < 15); $(id).classList.toggle('endless', unlimited); }
  $('dashFlow').textContent = `${ro.flow.toFixed(1)} kg/s`;
  if (ro.split) { $('usedStraight').textContent = ro.split.straight.toFixed(1); $('usedCurve').textContent = ro.split.curve.toFixed(1); }
  $('regionTag').textContent = ro.region;

  $('gripText').textContent = ro.gripText; $('gripNote').textContent = ro.gripNote;
  for (const id of ['gripBar', 'dashGrip']) { $(id).style.width = `${Math.min(1, ro.grip) * 100}%`; $(id).classList.toggle('over', ro.sliding); }

  const f = ro.forces;
  $('fTail').textContent = kN(f.tail); $('fSide').textContent = kN(f.side);
  $('fFrictionLabel').textContent = f.frictionKind === 'kinetic' ? 'Kinetic friction' : f.frictionKind === 'static' ? 'Static friction' : 'Friction';
  $('fFriction').textContent = f.frictionKind ? `${kN(f.friction)}${f.frictionDir}` : '0.0 kN';
  $('fRequired').textContent = f.required === null ? '—' : kN(f.required);
  $('fLimit').textContent = kN(f.limit);
  $('fRadius').textContent = f.radius === null ? 'straight' : `${f.radius.toFixed(1)} m`;

  for (const [lamp, on] of Object.entries(ro.lamps)) $('lamp' + lamp[0].toUpperCase() + lamp.slice(1)).classList.toggle('on', on);
  for (const b of all('[data-action]')) {
    const s = ro.firing[b.dataset.action];
    b.classList.toggle('firing', s === true); b.classList.toggle('armed', s === 'armed'); b.disabled = game.piloted;
  }
  $('power').disabled = game.piloted;
  if (ro.sidePowerShown !== null) { $('power').value = (ro.sidePowerShown / 1000).toFixed(1); $('powerValue').textContent = kN(ro.sidePowerShown); }
  $('wheelIcon').style.transform = `rotate(${-ro.steer * 135}deg)`;
  $('hint').hidden = !game.ready || game.piloted;
}

function showResult(r) {
  releaseAll();
  $('resultTitle').textContent = r.title; $('resultBody').textContent = r.body;
  $('resultStats').innerHTML = r.stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('watchBtn').hidden = !r.offerIdeal; $('result').dataset.kind = r.kind; $('result').hidden = false;
  if (r.newBest) showBest();
}

// ---------- loop ----------
setPower(sidePower); syncSetup();
try { const {createScene} = await import('./scene.js?v=20261021-4'); view = createScene($('scene'), $('labels')); }
catch (error) { $('renderError').hidden = false; console.error('3D initialisation failed', error); }
setMode(mode); setView('chase');
function frame(now) {
  const real = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0; lastFrame = now;
  const inp = input(), simulated = paused ? 0 : game.advance(real * Number($('timeScale').value), inp);
  render(game.readout(inp, paused));
  view?.update(game.viewModel(), {...opts, fan: fanOn}, simulated);
  const r = game.outcome(store); if (r) showResult(r);
  view?.render(real);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
