/**
 * Canvas scene: side view of the court, the server, the trajectory.
 * Reads the store, never writes to it — phase changes are reported through
 * callbacks so that main.js stays the only place that wires things together.
 *
 * Phases
 *   'aim'   nothing has been served yet; the player stands and winds up as the
 *           slider moves. No trajectory, no verdict.
 *   'serve' the animation is running: toss, jump, contact, flight.
 *   'done'  the ball has landed; the full path and the outcome stay on screen.
 *   'demo'  a serve played by the tutor: no jump, full-speed flight, so several
 *           of them can be shown in a row. Never sets a verdict.
 *
 * store.trails holds earlier trajectories to keep on screen (the tutor uses
 * them to show a family of serves); each entry is { v, label? }.
 */
import { trajectory, flightTime } from '../core/physics.js';
import { Verdict, evaluate } from '../core/evaluator.js';
import { readPalette, onSchemeChange } from './theme.js';
import { createPlayer, SERVE_TIMELINE } from './player.js';

// World window in metres. yMin is negative to leave room for the ground labels.
// x and y share one scale, so the parabola keeps its true shape.
const VIEW = { xMin: -2.4, xMax: 20.4, yMin: -1.0, yMax: 3.9 };

const BALL_SLOW = 0.5; // a student's serve is played at half speed
const SETTLE = 0.45; // pause after the ball lands before the verdict is called
const DEMO_SETTLE = 0.3; // the tutor's serves follow each other more quickly

export function createScene(canvas, store, { onLanded } = {}) {
  const ctx = canvas.getContext('2d');
  const { problem } = store.get();
  const player = createPlayer(problem);

  let geom = null;
  let palette = readPalette();
  let clock = 0; // seconds since the serve started
  let lastTs = 0;
  let landedFired = false;
  let demo = false;

  /**
   * The canvas fills its cell, so the size comes from the cell — not from a
   * hard-coded aspect ratio. Whatever vertical slack is left over is centred
   * and painted in the panel colour, which reads as padding.
   */
  function measure() {
    const box = canvas.parentElement;
    const cssW = box.clientWidth || 640;
    const minH = cssW / ((VIEW.xMax - VIEW.xMin) / (VIEW.yMax - VIEW.yMin));
    return { cssW, cssH: Math.max(box.clientHeight || 0, minH) };
  }

  function resize() {
    const { cssW, cssH } = measure();
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const worldW = VIEW.xMax - VIEW.xMin;
    const worldH = VIEW.yMax - VIEW.yMin;
    const scale = Math.min(cssW / worldW, cssH / worldH);
    const offX = (cssW - worldW * scale) / 2;
    // the court sits on the bottom of the box; any spare height becomes sky,
    // which is the panel colour anyway and so reads as padding
    const offY = Math.min(4, cssH - worldH * scale);
    geom = {
      cssW,
      cssH,
      scale,
      toX: (x) => offX + (x - VIEW.xMin) * scale,
      toY: (y) => cssH - offY - (y - VIEW.yMin) * scale,
    };
  }

  const font = (size) =>
    `${size}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;

  /** Flight time at which the ball stops: the net if it does not clear. */
  function stopTime(result) {
    const tEnd = flightTime(problem.hitHeight, problem.g);
    return result.verdict === Verdict.NET ? Math.min(result.tNet, tEnd) : tEnd;
  }

  /** Flight clock, seconds after contact (0 before the ball is struck). */
  function flightClock(phase, result) {
    if (phase === 'aim') return 0;
    const t = demo ? clock : Math.max(0, clock - SERVE_TIMELINE.contact) * BALL_SLOW;
    return Math.min(t, stopTime(result));
  }

  function speedFraction(state) {
    const s = state.problem.speed;
    return (state.v - s.min) / (s.max - s.min);
  }

  // ---------------------------------------------------------------- drawing

  function drawBackground() {
    const { cssW, cssH, toX, toY } = geom;
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, cssW, cssH);

    const gy = toY(0);
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, gy, cssW, cssH - gy);

    ctx.fillStyle = palette.court;
    ctx.fillRect(toX(problem.netDistance), gy, toX(problem.courtEnd) - toX(problem.netDistance), 6);

    ctx.strokeStyle = palette.groundLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(cssW, gy);
    ctx.stroke();

    tick(0, 'serve line · 0 m');
    tick(problem.courtEnd, `far baseline · ${problem.courtEnd} m`);

    function tick(x, label) {
      ctx.strokeStyle = palette.groundLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toX(x), gy - 7);
      ctx.lineTo(toX(x), gy + 7);
      ctx.stroke();
      ctx.fillStyle = palette.muted;
      ctx.font = font(12);
      ctx.textAlign = 'center';
      ctx.fillText(label, toX(x), gy + 22);
    }
  }

  function drawNet() {
    const { toX, toY } = geom;
    const x = toX(problem.netDistance);
    const top = toY(problem.netHeight);

    ctx.strokeStyle = palette.net;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, toY(0));
    ctx.lineTo(x, top);
    ctx.stroke();

    ctx.fillStyle = palette.sky;
    ctx.fillRect(x - 4, top - 5, 8, 6);
    ctx.strokeStyle = palette.net;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 4, top - 5, 8, 6);

    ctx.globalAlpha = 0.35;
    const meshBottom = toY(problem.netHeight - 1.0);
    for (let yy = top; yy < meshBottom; yy += 7) {
      ctx.beginPath();
      ctx.moveTo(x - 3.5, yy);
      ctx.lineTo(x + 3.5, yy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = palette.ink;
    ctx.font = font(12);
    ctx.textAlign = 'center';
    ctx.fillText(`net ${problem.netHeight} m`, x, top - 12);
  }

  /** Dashed marker at the contact height, so the 3.2 m is visible while aiming. */
  function drawContactMark() {
    const { toX, toY } = geom;
    const y = toY(problem.hitHeight);
    ctx.strokeStyle = palette.groundLine;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(toX(-2.1), y);
    ctx.lineTo(toX(1.1), y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = palette.muted;
    ctx.font = font(12);
    ctx.textAlign = 'left';
    ctx.fillText(`contact ${problem.hitHeight} m`, toX(-2.1), y - 7);
  }

  function drawPath(pts, color, width, dashed = false) {
    if (pts.length < 2) return;
    const { toX, toY } = geom;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dashed) ctx.setLineDash([5, 5]);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const sx = toX(p.x);
      const sy = toY(p.y);
      i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawGhosts(bounds) {
    ctx.globalAlpha = 0.45;
    drawPath(trajectory(bounds.vMin, problem.hitHeight, problem.g, 60), palette.bad, 1.5, true);
    drawPath(trajectory(bounds.vMax, problem.hitHeight, problem.g, 60), palette.info, 1.5, true);
    ctx.globalAlpha = 1;
  }

  function pathColor(verdict) {
    if (verdict === Verdict.IN) return palette.ok;
    if (verdict === Verdict.NET) return palette.bad;
    return palette.info;
  }

  function drawBall(result, tf) {
    const { toX, toY, scale } = geom;
    const bx = result.v * tf;
    const by = problem.hitHeight - 0.5 * problem.g * tf * tf;
    ctx.beginPath();
    // same radius the player uses, so the ball does not change size at contact
    ctx.arc(toX(bx), toY(by), Math.max(4, 0.105 * scale), 0, Math.PI * 2);
    ctx.fillStyle = palette.ball;
    ctx.fill();
  }

  function drawOutcome(result) {
    const { toX, toY, cssW } = geom;

    // too slow to even reach the net: it lands short, on this side
    const short = result.verdict === Verdict.NET && result.xLand < problem.netDistance;

    if (result.verdict === Verdict.NET && !short) {
      const x = toX(problem.netDistance);
      const y = toY(Math.max(0, result.heightAtNet));
      ctx.strokeStyle = palette.bad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 7);
      ctx.lineTo(x + 7, y + 7);
      ctx.moveTo(x + 7, y - 7);
      ctx.lineTo(x - 7, y + 7);
      ctx.stroke();
      ctx.fillStyle = palette.bad;
      ctx.font = font(12);
      ctx.textAlign = 'left';
      ctx.fillText('hits the net', x + 12, y + 4);
      return;
    }

    const gy = toY(0);
    const x = toX(Math.min(Math.max(result.xLand, VIEW.xMin + 0.3), VIEW.xMax - 0.3));
    ctx.fillStyle = result.verdict === Verdict.IN ? palette.ok : palette.bad;
    ctx.beginPath();
    ctx.ellipse(x, gy, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = font(12);
    ctx.textAlign = 'center';
    const label = `${result.xLand.toFixed(1)} m`;
    const half = ctx.measureText(label).width / 2;
    ctx.fillText(label, Math.min(Math.max(x, half + 4), cssW - half - 4), gy - 10);
  }

  /** Earlier serves kept on screen by the tutor: neutral colour, stop marked. */
  function drawTrails(trails) {
    const { toX, toY } = geom;
    trails.forEach(({ v, label }) => {
      const r = evaluate(problem, v);
      const stop = stopTime(r);
      const pts = trajectory(v, problem.hitHeight, problem.g).filter((p) => p.t <= stop);
      ctx.globalAlpha = 0.4;
      drawPath(pts, palette.muted, 1.5);
      const end = pts[pts.length - 1];
      if (end) {
        ctx.beginPath();
        ctx.arc(toX(end.x), toY(end.y), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = palette.muted;
        ctx.fill();
        if (label) {
          ctx.globalAlpha = 0.75;
          ctx.font = font(11);
          if (end.y < 0.05) {
            // it landed short: label below the ground line, where nothing else is
            ctx.textAlign = 'center';
            ctx.fillText(label, toX(end.x), toY(0) + 14);
          } else {
            // it died on the net: label just to the left of where it stopped
            ctx.textAlign = 'right';
            ctx.fillText(label, toX(end.x) - 7, toY(end.y) + 4);
          }
        }
      }
      ctx.globalAlpha = 1;
    });
  }

  function render() {
    const state = store.get();
    const { phase, result, showGhosts, trails } = state;
    if (!geom) resize();

    drawBackground();
    drawContactMark();
    if (showGhosts) drawGhosts(result.bounds);
    if (trails?.length) drawTrails(trails);

    if (phase !== 'aim') {
      const tf = flightClock(phase, result);
      const stop = stopTime(result);
      const flown = trajectory(result.v, problem.hitHeight, problem.g).filter((p) => p.t <= tf);
      const landed = tf >= stop;
      // neutral while it is still in the air: the colour would give the verdict away
      drawPath(flown, landed ? pathColor(result.verdict) : palette.muted, 2.5);
      if (landed) drawOutcome(result);
      if (demo || clock >= SERVE_TIMELINE.contact) drawBall(result, tf);
    }

    drawNet();
    player.draw(ctx, geom, palette, {
      mode: phase === 'serve' ? 'serve' : 'aim',
      t: clock,
      speedFrac: speedFraction(state),
      // the player only holds the ball until it is struck, and never in a demo
      showBall: phase === 'aim' || (phase === 'serve' && clock < SERVE_TIMELINE.contact),
    });
  }

  // ---------------------------------------------------------------- loop

  function loop(ts) {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;

    const { phase, result } = store.get();
    if (phase === 'serve' || phase === 'demo') {
      clock += dt;
      const finished = demo
        ? clock >= stopTime(result) + DEMO_SETTLE
        : clock - SERVE_TIMELINE.contact >= stopTime(result) / BALL_SLOW + SETTLE &&
          clock >= SERVE_TIMELINE.land;
      if (finished && !landedFired) {
        landedFired = true;
        onLanded?.(result, { demo });
      }
    }

    render();
    requestAnimationFrame(loop);
  }

  function refit() {
    resize();
    render();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', refit);
  }
  // the cell also changes height when the panel beside it does (opening Help)
  if (typeof ResizeObserver === 'function' && canvas.parentElement) {
    new ResizeObserver(refit).observe(canvas.parentElement);
  }
  onSchemeChange(() => {
    palette = readPalette();
    render();
  });

  resize();
  requestAnimationFrame(loop);

  return {
    render,
    resize: refit,
    /**
     * Start (or restart) the serve animation.
     * @param {{demo?:boolean}} opts demo = the tutor's quick serve: no jump,
     *        full-speed flight, so several can be played in a row.
     */
    serve({ demo: isDemo = false } = {}) {
      clock = 0;
      landedFired = false;
      demo = isDemo;
    },
    /** Back to the standing pose. */
    reset() {
      clock = 0;
      landedFired = false;
      demo = false;
    },
  };
}
