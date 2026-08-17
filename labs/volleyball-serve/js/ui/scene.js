/**
 * Canvas scene: side view of the court, trajectory and flight animation.
 * Reads the store, never writes to it. All drawing goes through one
 * world→screen transform, so changing the framing means editing VIEW only.
 */
import { trajectory, flightTime } from '../core/physics.js';
import { Verdict } from '../core/evaluator.js';
import { readPalette, onSchemeChange } from './theme.js';

// World window in metres. yMin is negative to leave room for the ground labels.
// x and y share one scale, so the parabola keeps its true shape.
const VIEW = { xMin: -2.4, xMax: 20.4, yMin: -1.0, yMax: 3.9 };

export function createScene(canvas, store) {
  const ctx = canvas.getContext('2d');
  const anim = { t: 0, playing: true, last: 0 };
  let geom = null;
  let palette = readPalette();

  function resize() {
    const cssW = canvas.parentElement.clientWidth;
    const cssH = Math.max(190, Math.min(360, cssW / 4.6));
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const worldW = VIEW.xMax - VIEW.xMin;
    const worldH = VIEW.yMax - VIEW.yMin;
    const scale = Math.min(cssW / worldW, cssH / worldH);
    const offX = (cssW - worldW * scale) / 2;
    const offY = (cssH - worldH * scale) / 2;
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

  function drawBackground(problem) {
    const { cssW, cssH, toX, toY } = geom;
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, cssW, cssH);

    const gy = toY(0);
    ctx.fillStyle = palette.ground;
    ctx.fillRect(0, gy, cssW, cssH - gy);

    // far half of the court, net → baseline
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

  function drawNet(problem) {
    const { toX, toY } = geom;
    const x = toX(problem.netDistance);
    const top = toY(problem.netHeight);
    const bottom = toY(0);

    ctx.strokeStyle = palette.net;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, top);
    ctx.stroke();

    // tape along the top of the net
    ctx.fillStyle = palette.sky;
    ctx.fillRect(x - 4, top - 5, 8, 6);
    ctx.strokeStyle = palette.net;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 4, top - 5, 8, 6);

    // mesh texture
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

  function drawServer(problem) {
    const { toX, toY } = geom;
    const x = toX(0);
    const yTop = toY(problem.hitHeight);

    ctx.strokeStyle = palette.groundLine;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, toY(0));
    ctx.lineTo(x, yTop);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = palette.ink;
    ctx.font = font(12);
    ctx.textAlign = 'right';
    ctx.fillText(`contact ${problem.hitHeight} m`, x - 8, yTop + 4);

    ctx.beginPath();
    ctx.arc(x, yTop, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPath(pts, color, width, dashed = false) {
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

  function drawGhosts(problem, bounds) {
    const { g, hitHeight } = problem;
    ctx.globalAlpha = 0.45;
    drawPath(trajectory(bounds.vMin, hitHeight, g, 60), palette.bad, 1.5, true);
    drawPath(trajectory(bounds.vMax, hitHeight, g, 60), palette.info, 1.5, true);
    ctx.globalAlpha = 1;
  }

  /** When the serve hits the net the ball stops there — it does not fly on. */
  function stopTime(problem, result) {
    const tEnd = flightTime(problem.hitHeight, problem.g);
    return result.verdict === Verdict.NET ? Math.min(result.tNet, tEnd) : tEnd;
  }

  function drawBall(problem, result) {
    const { toX, toY } = geom;
    const t = Math.min(anim.t, stopTime(problem, result));
    const bx = result.v * t;
    const by = problem.hitHeight - 0.5 * problem.g * t * t;

    ctx.beginPath();
    ctx.arc(toX(bx), toY(by), 6, 0, Math.PI * 2);
    ctx.fillStyle = palette.ball;
    ctx.fill();
    ctx.strokeStyle = palette.ball;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function drawOutcome(problem, result) {
    const { toX, toY, cssW } = geom;

    if (result.verdict === Verdict.NET) {
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
    const x = toX(Math.min(result.xLand, VIEW.xMax - 0.3));
    ctx.fillStyle = result.verdict === Verdict.IN ? palette.ok : palette.bad;
    ctx.beginPath();
    ctx.ellipse(x, gy, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = font(12);
    ctx.textAlign = 'center';
    const label = `${result.xLand.toFixed(1)} m`;
    const halfW = ctx.measureText(label).width / 2;
    ctx.fillText(label, Math.min(Math.max(x, halfW + 4), cssW - halfW - 4), gy - 10);
  }

  function pathColor(verdict) {
    if (verdict === Verdict.IN) return palette.ok;
    if (verdict === Verdict.NET) return palette.bad;
    return palette.info;
  }

  function render() {
    const { problem, result, showGhosts } = store.get();
    if (!geom) resize();
    drawBackground(problem);
    if (showGhosts) drawGhosts(problem, result.bounds);

    const pts = trajectory(result.v, problem.hitHeight, problem.g);
    const tStop = stopTime(problem, result);
    const flown = pts.filter((p) => p.t <= tStop);
    if (flown.length < pts.length) {
      // what would have happened without the net, for reference only
      ctx.globalAlpha = 0.28;
      drawPath(pts.slice(flown.length - 1), palette.bad, 1.5, true);
      ctx.globalAlpha = 1;
    }
    drawPath(flown, pathColor(result.verdict), 2.5);

    drawNet(problem);
    drawServer(problem);
    drawOutcome(problem, result);
    drawBall(problem, result);
  }

  function loop(ts) {
    const dt = anim.last ? (ts - anim.last) / 1000 : 0;
    anim.last = ts;
    const { problem, result } = store.get();
    if (anim.playing) {
      anim.t += dt * 0.5; // half speed, easier to follow
      if (anim.t > stopTime(problem, result) + 0.6) anim.t = 0;
    }
    render();
    requestAnimationFrame(loop);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      resize();
      render();
    });
  }
  onSchemeChange(() => {
    palette = readPalette();
    render();
  });
  store.subscribe(() => {
    anim.t = 0; // replay whenever a parameter changes
  });

  resize();
  requestAnimationFrame(loop);

  return { render, resize, replay: () => (anim.t = 0) };
}
