import { L } from './lang.js?v=20261020d';

// Falling-body animations shown inside chat messages.
// Each scene draws on a 320 × 240 logical canvas with its own fixed palette
// (like the site's other figures), so it reads the same in light and dark mode.
// Real-world scenes use g = 9.8 m/s² and air drag, slowed down so the eye can follow.

const W = 320;
const H = 240;
const G = 9.8;

const C = {
  skyTop: '#e7f0f7',
  skyBottom: '#f8fbfd',
  ground: '#9c8462',
  groundTop: '#7e9a52',
  ink: '#1d2620',
  muted: '#5d665f',
  heavy: '#5b6168',
  light: '#b9bec4',
  rope: '#8a6a3c',
  blue: '#0072B2',
  orange: '#D55E00',
  red: '#b7354a',
  glass: 'rgba(120, 170, 210, 0.9)',
  glassFill: 'rgba(200, 225, 245, 0.35)',
  coin: '#d9a520',
  coinEdge: '#9c7414',
};

/* ---------------- drawing helpers ---------------- */

function sky(ctx, groundY) {
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, C.skyTop);
  g.addColorStop(1, C.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, groundY);
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = C.groundTop;
  ctx.fillRect(0, groundY, W, 4);
}

function stone(ctx, x, y, r, seed = 1, heavy = r > 14) {
  ctx.save();
  ctx.beginPath();
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.13 * Math.sin(i * 2.3 + seed) + 0.06 * Math.cos(i * 4.1 + seed * 2);
    const px = x + Math.cos(a) * r * k;
    const py = y + Math.sin(a) * r * k * 0.82;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.2);
  const base = heavy ? C.heavy : C.light;
  g.addColorStop(0, heavy ? '#8b9198' : '#dfe2e5');
  g.addColorStop(1, base);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(29, 38, 32, 0.55)';
  ctx.stroke();
  ctx.restore();
}

function feather(ctx, x, y, angle, len = 46) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // vane
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.bezierCurveTo(-len * 0.2, -len * 0.26, len * 0.3, -len * 0.2, len / 2, -1);
  ctx.bezierCurveTo(len * 0.3, len * 0.16, -len * 0.2, len * 0.2, -len / 2 + 6, 1);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -len * 0.25, 0, len * 0.2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#d9d4c7');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 80, 60, 0.45)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // barbs
  ctx.strokeStyle = 'rgba(120, 110, 90, 0.35)';
  for (let i = -3; i <= 3; i++) {
    const bx = i * len * 0.11;
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.lineTo(bx + len * 0.08, -len * 0.14);
    ctx.moveTo(bx, 0);
    ctx.lineTo(bx + len * 0.07, len * 0.12);
    ctx.stroke();
  }
  // quill
  ctx.beginPath();
  ctx.moveTo(-len / 2 - 7, 1);
  ctx.lineTo(len / 2, -1);
  ctx.strokeStyle = '#8c7a5a';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function coin(ctx, x, y, r = 9) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.coinEdge;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y - 1.5, r, r * 0.42, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(x - r, y, x + r, y);
  g.addColorStop(0, '#f3cf5a');
  g.addColorStop(1, C.coin);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function text(ctx, s, x, y, { size = 11, color = C.ink, weight = 500, align = 'center' } = {}) {
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

function tag(ctx, s, x, y) {
  ctx.font = '600 10px Inter, system-ui, sans-serif';
  const w = ctx.measureText(s).width + 12;
  ctx.fillStyle = 'rgba(29, 38, 32, 0.72)';
  roundRect(ctx, x - w, y - 12, w, 16, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(s, x - w / 2, y);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Precompute a fall with quadratic air drag: dv/dt = g (1 - (v / vt)²). */
function dragFall(height, vt) {
  const dt = 1 / 600;
  const pts = [0];
  let v = 0;
  let y = 0;
  while (y < height) {
    v += G * (1 - (v / vt) ** 2) * dt;
    y += v * dt;
    pts.push(Math.min(y, height));
  }
  return { at: (t) => pts[Math.min(pts.length - 1, Math.max(0, Math.round(t / dt)))], land: (pts.length - 1) * dt };
}

const freeFall = (height) => ({
  at: (t) => Math.min(height, 0.5 * G * t * t),
  land: Math.sqrt((2 * height) / G),
});

function clock(ctx, t, x = W - 10, y = 20) {
  text(ctx, `t = ${t.toFixed(2)} s`, x, y, { size: 11, color: C.muted, weight: 600, align: 'right' });
}

function landedNote(ctx, s, x, y, color) {
  text(ctx, s, x, y, { size: 10.5, color, weight: 600 });
}

/* ---------------- scenes ---------------- */

/** Stone and feather dropped together in real air. */
function stoneFeather() {
  const top = 46;
  const groundY = 206;
  const metres = 1.6;
  const pxm = (groundY - top - 16) / metres;
  const slow = 0.6;
  const s = freeFall(metres);
  const f = dragFall(metres, 0.75);
  return {
    label: L('A stone and a feather dropped together in air', '石头和羽毛在空气中同时下落'),
    duration: f.land / slow + 1.4,
    draw(ctx, t) {
      const tp = t * slow;
      sky(ctx, groundY);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(29,38,32,0.25)';
      ctx.beginPath();
      ctx.moveTo(40, top);
      ctx.lineTo(280, top);
      ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, L('In air', '有空气'), 12, 20, { align: 'left', weight: 700, size: 12 });
      clock(ctx, Math.min(tp, f.land));
      tag(ctx, L('slow motion', '慢动作'), W - 10, 40);

      const sy = top + s.at(tp) * pxm;
      stone(ctx, 105, Math.min(sy, groundY - 13), 16, 1.3);
      if (tp >= s.land) landedNote(ctx, `${L('stone', '石头')}: ${s.land.toFixed(2)} s`, 105, groundY + 24, '#fff');

      const fy = top + f.at(tp) * pxm;
      const sway = Math.min(1, tp * 1.5) * 16 * Math.sin(tp * 5.2);
      const ang = 0.35 * Math.cos(tp * 5.2) + 0.15;
      const landed = tp >= f.land;
      feather(ctx, 215 + (landed ? 16 * Math.sin(f.land * 5.2) : sway), Math.min(fy, groundY - 5), landed ? 0.05 : ang);
      if (landed) landedNote(ctx, `${L('feather', '羽毛')}: ${f.land.toFixed(2)} s`, 215, groundY + 24, '#fff');
    },
  };
}

/** Aristotle's rule, imagined: constant speeds 8 and 4. */
function aristotleRule() {
  const top = 50;
  const groundY = 206;
  const span = groundY - top - 14;
  const tHeavy = 1.5;
  return {
    label: L("Aristotle's rule imagined: the heavy stone falls at speed 8, the light one at speed 4", '想象中亚里士多德的规则：重石头以速度 8 下落，轻石头以速度 4 下落'),
    duration: tHeavy * 2 + 1.4,
    draw(ctx, t) {
      ctx.fillStyle = '#f6f3ea';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#d8d1bf';
      ctx.fillRect(0, groundY, W, H - groundY);
      text(ctx, L("Aristotle's rule (imagined)", '亚里士多德的规则（想象）'), 12, 20, { align: 'left', weight: 700, size: 12 });
      text(ctx, L('speed grows with weight', '速度随重量增大'), 12, 35, { align: 'left', size: 10.5, color: C.muted });
      const lanes = [
        { x: 105, r: 16, v: 1 / tHeavy, color: C.blue, label: L('heavy · speed 8', '重 · 速度 8') },
        { x: 220, r: 10, v: 1 / (2 * tHeavy), color: C.orange, label: L('light · speed 4', '轻 · 速度 4') },
      ];
      for (const lane of lanes) {
        const p = Math.min(1, t * lane.v);
        // ghosts every 0.25 s show the even spacing of a constant speed
        for (let k = 0.25; k < t && k * lane.v < 1; k += 0.25) {
          ctx.globalAlpha = 0.18;
          stone(ctx, lane.x, top + k * lane.v * span, lane.r, lane.x, lane.r > 12);
          ctx.globalAlpha = 1;
        }
        stone(ctx, lane.x, top + p * span, lane.r, lane.x, lane.r > 12);
        text(ctx, lane.label, lane.x, groundY + 24, { size: 11, color: lane.color, weight: 700 });
      }
    },
  };
}

/** The contradiction: the same tied pair reasoned two ways. */
function contradiction() {
  const top = 70;
  const groundY = 200;
  const span = groundY - top - 22;
  const lanes = [
    { x: 55, t: 1.5, pair: false, color: C.muted, l1: L('heavy alone', '单独的重石头'), l2: L('speed 8', '速度 8') },
    { x: 160, t: 2.0, pair: true, color: C.blue, l1: L('light holds it back', '轻的拖住它'), l2: L('slower than 8', '比 8 慢') },
    { x: 265, t: 1.0, pair: true, color: C.orange, l1: L('heavier together', '合起来更重'), l2: L('faster than 8', '比 8 快') },
  ];
  return {
    label: L('The same tied pair falls slower than 8 by one argument and faster than 8 by the other', '同一对绑在一起的石头，按一种推理比 8 慢，按另一种推理比 8 快'),
    duration: 3.6,
    draw(ctx, t) {
      ctx.fillStyle = '#f6f3ea';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#d8d1bf';
      ctx.fillRect(0, groundY, W, H - groundY);
      ctx.strokeStyle = 'rgba(29,38,32,0.12)';
      for (const x of [107, 213]) {
        ctx.beginPath();
        ctx.moveTo(x, 8);
        ctx.lineTo(x, groundY);
        ctx.stroke();
      }
      for (const lane of lanes) {
        text(ctx, lane.l1, lane.x, 22, { size: 10.5, color: lane.color, weight: 700 });
        text(ctx, lane.l2, lane.x, 36, { size: 10.5, color: lane.color, weight: 600 });
        const y = top + Math.min(1, t / lane.t) * span;
        if (lane.pair) {
          stone(ctx, lane.x, y - 12, 13, 2, true);
          ctx.strokeStyle = C.rope;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(lane.x, y - 2);
          ctx.lineTo(lane.x, y + 6);
          ctx.stroke();
          stone(ctx, lane.x, y + 12, 8, 3, false);
        } else {
          stone(ctx, lane.x, y + 4, 13, 2, true);
        }
        if (t >= lane.t) text(ctx, `${lane.t.toFixed(1)} s`, lane.x, groundY + 22, { size: 11, color: lane.color, weight: 700 });
      }
      if (t > 2.2) {
        const a = Math.min(1, (t - 2.2) * 3);
        ctx.globalAlpha = a;
        ctx.fillStyle = C.red;
        ctx.beginPath();
        ctx.arc(213, 76, 15, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, '≠', 213, 83, { size: 18, color: '#fff', weight: 700 });
        roundRect(ctx, 133, 100, 160, 22, 11);
        ctx.fillStyle = 'rgba(183, 53, 74, 0.92)';
        ctx.fill();
        text(ctx, L('Same pair, two answers!', '同一对石头，两个答案！'), 213, 115, { size: 11, color: '#fff', weight: 700 });
        ctx.globalAlpha = 1;
      }
    },
  };
}

/** A feather-and-coin tube, with air and with the air pumped out. */
function tube() {
  const top = 46;
  const bottom = 214;
  const metres = 1.2;
  const pxm = (bottom - top - 22) / metres;
  const slow = 0.35;
  const c = freeFall(metres);
  const fa = dragFall(metres, 1.0);
  const tubes = [
    { x: 95, air: true, label: L('With air', '有空气') },
    { x: 225, air: false, label: L('Air pumped out', '抽掉空气') },
  ];
  return {
    label: L('A coin and a feather in a tube with air, and in a tube with no air', '硬币和羽毛分别在有空气和没有空气的管子里下落'),
    duration: fa.land / slow + 1.4,
    draw(ctx, t) {
      const tp = t * slow;
      ctx.fillStyle = '#f4f6f8';
      ctx.fillRect(0, 0, W, H);
      clock(ctx, Math.min(tp, fa.land), W - 10, 18);
      tag(ctx, L('slow motion', '慢动作'), 96, H - 8);
      for (const tb of tubes) {
        text(ctx, tb.label, tb.x, top - 12, { size: 11.5, weight: 700, color: tb.air ? C.ink : C.blue });
        // glass
        roundRect(ctx, tb.x - 30, top, 60, bottom - top, 14);
        ctx.fillStyle = tb.air ? 'rgba(200, 225, 245, 0.45)' : 'rgba(235, 242, 248, 0.25)';
        ctx.fill();
        ctx.strokeStyle = C.glass;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tb.x - 22, top + 14);
        ctx.lineTo(tb.x - 22, bottom - 14);
        ctx.stroke();
        // objects
        const cy = top + 14 + c.at(tp) * pxm;
        coin(ctx, tb.x + 12, Math.min(cy, bottom - 10));
        const fall = tb.air ? fa : c;
        const fy = top + 14 + fall.at(tp) * pxm;
        const sway = tb.air ? Math.min(1, tp * 2) * 5 * Math.sin(tp * 9) : 0;
        const ang = tb.air ? -1.25 + 0.25 * Math.sin(tp * 9) : -1.45;
        feather(ctx, tb.x - 8 + sway, Math.min(fy, bottom - 22), ang, 34);
      }
    },
  };
}

/** Galileo's tower drop (the Pisa story): a heavy and a light iron ball from 56 m. */
function pisa() {
  const top = 40;
  const groundY = 206;
  const metres = 56;
  const pxm = (groundY - top - 12) / metres;
  const slow = 0.55;
  // Iron balls in air: terminal speed grows with the radius (about 191 and 105 m/s).
  const heavy = dragFall(metres, 191);
  const light = dragFall(metres, 105);
  const end = Math.max(heavy.land, light.land);
  return {
    label: L('A heavy and a light iron ball dropped from the Leaning Tower of Pisa land almost together', '从比萨斜塔放下的重铁球和轻铁球几乎同时落地'),
    duration: end / slow + 1.6,
    draw(ctx, t) {
      const tp = t * slow;
      sky(ctx, groundY);
      // the leaning tower
      ctx.save();
      ctx.translate(78, groundY);
      ctx.rotate(0.07);
      ctx.fillStyle = '#efe9da';
      ctx.strokeStyle = 'rgba(29,38,32,0.35)';
      ctx.lineWidth = 1;
      const tw = 44;
      const th = groundY - top + 6;
      ctx.fillRect(-tw / 2, -th, tw, th);
      ctx.strokeRect(-tw / 2, -th, tw, th);
      for (let k = 1; k < 7; k++) {
        const y = -k * (th / 7);
        ctx.beginPath();
        ctx.moveTo(-tw / 2 - 3, y);
        ctx.lineTo(tw / 2 + 3, y);
        ctx.stroke();
        for (let c = -1; c <= 1; c++) {
          ctx.beginPath();
          ctx.arc(c * 13, y + th / 14, 3.2, Math.PI, 0);
          ctx.stroke();
        }
      }
      ctx.restore();
      text(ctx, L('Pisa, as the story goes', '传说中的比萨斜塔'), 12, 20, { align: 'left', weight: 700, size: 12 });
      clock(ctx, Math.min(tp, end));
      tag(ctx, L('slow motion', '慢动作'), W - 10, 40);
      const lanes = [
        { x: 170, fall: heavy, r: 13, name: L('heavy ball', '重球') },
        { x: 232, fall: light, r: 6, name: L('light ball', '轻球') },
      ];
      for (const lane of lanes) {
        const y = Math.min(top + lane.fall.at(tp) * pxm, groundY - lane.r);
        const g = ctx.createRadialGradient(lane.x - lane.r * 0.4, y - lane.r * 0.4, 1, lane.x, y, lane.r);
        g.addColorStop(0, '#9aa1a8');
        g.addColorStop(1, '#3d4248');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lane.x, y, lane.r, 0, Math.PI * 2);
        ctx.fill();
        if (tp >= lane.fall.land) landedNote(ctx, `${lane.name}: ${lane.fall.land.toFixed(2)} s`, lane.x, groundY + 24, '#fff');
      }
    },
  };
}

/**
 * Aristotle's own reasoning about the tied pair (debate group), imagined with
 * his rule: the heavy stone alone at speed 8, the pair at 12 (one heavier body)
 * or at 6 (the slow stone holds back the fast one).
 */
function tiedView(fast) {
  const top = 56;
  const groundY = 206;
  const span = groundY - top - 22;
  const tHeavy = 1.5;
  const tPair = fast ? tHeavy * (8 / 12) : tHeavy * (8 / 6);
  const pairColor = fast ? C.orange : C.blue;
  return {
    label: fast
      ? L("Aristotle's reasoning: tied together the stones are heavier, so the pair falls faster than 8", '亚里士多德的推理：绑在一起的石头更重，所以比 8 快')
      : L("Aristotle's reasoning: the slow stone holds back the fast one, so the pair falls slower than 8", '亚里士多德的推理：慢的石头拖住快的石头，所以比 8 慢'),
    duration: Math.max(tHeavy, tPair) + 1.4,
    draw(ctx, t) {
      ctx.fillStyle = '#f6f3ea';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#d8d1bf';
      ctx.fillRect(0, groundY, W, H - groundY);
      text(ctx, L("Aristotle's reasoning (imagined)", '亚里士多德的推理（想象）'), 12, 20, { align: 'left', weight: 700, size: 12 });
      text(ctx, fast ? L('one heavier body, so faster', '合成更重的物体，所以更快') : L('the slow stone holds back the fast one', '慢的石头拖住快的石头'), 12, 35, { align: 'left', size: 10.5, color: C.muted });
      // heavy stone alone
      const yh = top + Math.min(1, t / tHeavy) * span;
      stone(ctx, 105, yh + 4, 13, 2, true);
      text(ctx, L('heavy alone · 8', '单独的重石头 · 8'), 105, groundY + 24, { size: 11, color: C.muted, weight: 700 });
      // the tied pair
      const yp = top + Math.min(1, t / tPair) * span;
      stone(ctx, 220, yp - 12, 13, 2, true);
      ctx.strokeStyle = C.rope;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(220, yp - 2);
      ctx.lineTo(220, yp + 6);
      ctx.stroke();
      stone(ctx, 220, yp + 12, 8, 3, false);
      text(ctx, fast ? L('tied pair · 12?', '绑在一起 · 12？') : L('tied pair · 6?', '绑在一起 · 6？'), 220, groundY + 24, { size: 11, color: pairColor, weight: 700 });
    },
  };
}

const SCENES = {
  falling: stoneFeather,
  stones: aristotleRule,
  contradiction,
  tube,
  pisa,
  'tied-faster': () => tiedView(true),
  'tied-slower': () => tiedView(false),
};

export const hasAnimation = (id) => id in SCENES;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Build an animation card. It plays once when it scrolls into view and has a
 * Replay button. With reduced motion it waits for the button.
 */
export function animationCard(id) {
  const scene = SCENES[id]();
  const card = document.createElement('div');
  card.className = 'picture anim';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', scene.label);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'replay';
  button.textContent = reduceMotion ? L('▶ Play', '▶ 播放') : L('↻ Replay', '↻ 重播');
  const bar = document.createElement('div');
  bar.className = 'anim-bar';
  bar.append(button);
  card.append(canvas, bar);

  const ctx = canvas.getContext('2d');
  let raf = 0;
  let started = false;

  function size() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    scene.draw(ctx, t);
  }

  function play() {
    cancelAnimationFrame(raf);
    started = true;
    const t0 = performance.now();
    const tick = (now) => {
      const t = (now - t0) / 1000;
      frame(Math.min(t, scene.duration));
      if (t < scene.duration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  size();
  frame(0);
  button.addEventListener('click', () => {
    button.textContent = L('↻ Replay', '↻ 重播');
    play();
  });

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !started) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.6 },
    );
    // Observe once the card is in the document.
    requestAnimationFrame(() => io.observe(card));
  }
  return card;
}
