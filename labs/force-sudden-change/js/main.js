(function () {
  'use strict';

  const P = window.ForcePhysics;
  const $ = (sel) => document.querySelector(sel);

  const stage = $('#stageCanvas');
  const graph = $('#graphCanvas');
  const sctx = stage.getContext('2d');
  const gctx = graph.getContext('2d');

  const els = {
    modeButtons: document.querySelectorAll('.mode-button'),
    subButtons: document.querySelectorAll('.sub-button'),
    microTabs: $('#microTabs'),
    statusPill: $('#statusPill'),
    dragHint: $('#dragHint'),
    actionA: $('#actionA'),
    actionB: $('#actionB'),
    resetButton: $('#resetButton'),
    speedInput: $('#speedInput'),
    speedValue: $('#speedValue'),
    speedPill: $('#speedPill'),
    pauseButton: $('#pauseButton'),
    autoSlow: $('#autoSlow'),
    autoSlowRow: $('#autoSlowRow'),
    autoSlowText: $('#autoSlowText'),
    metricLabels: [$('#m1Label'), $('#m2Label'), $('#m3Label'), $('#m4Label')],
    metricValues: [$('#m1Value'), $('#m2Value'), $('#m3Value'), $('#m4Value')],
    verdict: $('#verdictMetric'),
    stageTitle: $('#stageTitle'),
    stageSubtitle: $('#stageSubtitle'),
    legend: $('#legend'),
    timeReadout: $('#timeReadout'),
    narrative: $('#narrative'),
    graphTitle: $('#graphTitle'),
    graphNote: $('#graphNote'),
    graphLegend: $('#graphLegend')
  };

  const C = {
    ink: '#17212f',
    muted: '#647084',
    grid: '#e3e9f1',
    axis: '#9aa7b8',
    tension: '#2f6fd6',
    hand: '#e07b1f',
    friction: '#d64545',
    weight: '#7f8793',
    green: '#14936f',
    navy: '#264761',
    purple: '#7b61c4',
    steel: '#56677d',
    ball: '#d9a02b',
    block: '#8aa0b8'
  };

  const SPEEDS = [1, 0.1, 0.01, 0.001];
  const g = P.g;

  // ---------------------------------------------------------------- helpers
  const fmt = (v, d = 1) => (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toFixed(d);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function mix(c1, c2, t) {
    t = clamp(t, 0, 1);
    const a = c1.match(/\w\w/g).map((h) => parseInt(h, 16));
    const b = c2.match(/\w\w/g).map((h) => parseInt(h, 16));
    return 'rgb(' + a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',') + ')';
  }
  // Deformation colour: stretched is red, compressed is blue, zero is grey
  function strainColor(r) {
    return r >= 0 ? mix('#b8c2d0', '#d64545', r) : mix('#b8c2d0', '#2f6fd6', -r);
  }
  function contactColor(r) {
    return r < 0.6 ? mix('#16a34a', '#ef8a17', r / 0.6) : mix('#ef8a17', '#d64545', (r - 0.6) / 0.4);
  }

  function arrow(ctx, x1, y1, x2, y2, color, w = 4, head = 12) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 3) return;
    const ux = dx / len, uy = dy / len;
    head = Math.min(head, len * 0.9);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - ux * head * 0.8, y2 - uy * head * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5);
    ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function text(ctx, str, x, y, opt = {}) {
    ctx.save();
    ctx.font = (opt.weight || 700) + ' ' + (opt.size || 14) + 'px Inter, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = opt.color || C.ink;
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.base || 'middle';
    if (opt.bg) {
      const w = ctx.measureText(str).width, h = (opt.size || 14) + 8;
      const x0 = opt.align === 'center' ? x - w / 2 : opt.align === 'right' ? x - w : x;
      ctx.fillStyle = opt.bg;
      roundRect(ctx, x0 - 6, y - h / 2, w + 12, h, 6);
      ctx.fill();
      ctx.fillStyle = opt.color || C.ink;
    }
    ctx.fillText(str, x, y);
    ctx.restore();
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

  function hatch(ctx, x1, y1, x2, y2, dir) {
    // dir: 'up' 天花板（阴影在上方），'left' 墙（阴影在左侧），'down' 地面
    ctx.save();
    ctx.strokeStyle = '#3c4656';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#8391a3';
    ctx.beginPath();
    if (dir === 'left') {
      for (let y = y1; y < y2; y += 12) { ctx.moveTo(x1, y + 12); ctx.lineTo(x1 - 12, y); }
    } else if (dir === 'up') {
      for (let x = x1; x < x2; x += 12) { ctx.moveTo(x, y1); ctx.lineTo(x + 12, y1 - 12); }
    }
    ctx.stroke();
    ctx.restore();
  }

  // 竖直弹簧：从 (x, y1) 到 (x, y2)
  function vCoil(ctx, x, y1, y2, turns, half, color, lw) {
    const lead = Math.min(12, (y2 - y1) * 0.12);
    const a = y1 + lead, b = y2 - lead;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, a);
    const n = turns * 2;
    for (let i = 0; i < n; i++) {
      const y = a + (b - a) * (i + 0.5) / n;
      ctx.lineTo(x + (i % 2 ? -half : half), y);
    }
    ctx.lineTo(x, b);
    ctx.lineTo(x, y2);
    ctx.stroke();
    ctx.restore();
  }

  // 水平弹簧
  function hCoil(ctx, x1, x2, y, turns, half, color, lw) {
    const lead = Math.min(12, Math.abs(x2 - x1) * 0.12) * Math.sign(x2 - x1 || 1);
    const a = x1 + lead, b = x2 - lead;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(a, y);
    const n = turns * 2;
    for (let i = 0; i < n; i++) {
      const x = a + (b - a) * (i + 0.5) / n;
      ctx.lineTo(x, y + (i % 2 ? -half : half));
    }
    ctx.lineTo(b, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  }

  function drawBall(ctx, x, y, r, held) {
    ctx.save();
    const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
    grad.addColorStop(0, '#f6d489');
    grad.addColorStop(1, C.ball);
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#a0721a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (held) {
      ctx.strokeStyle = C.hand;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(x, y, r + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHand(ctx, x, y, active) {
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.45;
    ctx.fillStyle = active ? C.hand : '#c9a27c';
    ctx.strokeStyle = '#9a5210';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    text(ctx, 'Hand', x, y + 1, { color: '#fff', align: 'center', size: 11, weight: 800 });
    ctx.restore();
  }

  // 右侧读数：竖直条
  function drawBars(ctx, x0, y0, w, h, bars) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e1e7ef';
    ctx.lineWidth = 1;
    roundRect(ctx, x0, y0, w, h, 8);
    ctx.fill();
    ctx.stroke();
    text(ctx, 'Live readout', x0 + 14, y0 + 20, { size: 13, color: C.muted });
    const n = bars.length;
    const colW = (w - 16) / n;
    const top = y0 + 78, bottom = y0 + h - 58;
    bars.forEach((b, i) => {
      const cx = x0 + 8 + colW * (i + 0.5);
      const bw = Math.min(30, colW * 0.42);
      ctx.fillStyle = '#eef3f8';
      roundRect(ctx, cx - bw / 2, top, bw, bottom - top, 5);
      ctx.fill();
      const r = clamp(Math.abs(b.value) / b.max, 0, 1);
      const bh = (bottom - top) * r;
      if (bh > 0.5) {
        ctx.fillStyle = b.color;
        roundRect(ctx, cx - bw / 2, bottom - bh, bw, bh, Math.min(5, bh / 2));
        ctx.fill();
      }
      for (const m of b.marks || []) {
        const my = bottom - (bottom - top) * clamp(m.v / b.max, 0, 1);
        ctx.strokeStyle = m.color || '#3c4656';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx - bw / 2 - 6, my);
        ctx.lineTo(cx + bw / 2 + 6, my);
        ctx.stroke();
        ctx.setLineDash([]);
        if (m.label) text(ctx, m.label, cx + bw / 2 + 5, my - 8, { size: 10, color: m.color || C.muted, weight: 700 });
      }
      text(ctx, b.text, cx, y0 + 50, { align: 'center', size: colW > 70 ? 17 : 14, weight: 800, color: b.color });
      const lines = b.label.split('\n');
      lines.forEach((ln, k) => text(ctx, ln, cx, bottom + 18 + k * 16, { align: 'center', size: 12, color: C.muted }));
    });
    ctx.restore();
  }

  // ---------------------------------------------------------------- recorder
  function makeRecorder(n, windowLen) {
    return { n, window: windowLen, bd: windowLen / 480, buckets: [], cur: null, t: 0 };
  }
  function record(rec, t, vals) {
    rec.t = t;
    const idx = Math.floor(t / rec.bd);
    let b = rec.cur;
    if (!b || b.idx !== idx) {
      b = { idx, min: vals.slice(), max: vals.slice(), last: vals.slice() };
      rec.buckets.push(b);
      rec.cur = b;
      if (rec.buckets.length > 500) rec.buckets.shift();
      return;
    }
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v < b.min[i]) b.min[i] = v;
      if (v > b.max[i]) b.max[i] = v;
      b.last[i] = v;
    }
  }

  // ---------------------------------------------------------------- state
  const app = {
    mode: 'rigid',
    view: 'chain',
    speed: 0,
    paused: false,
    sims: {},
    rec: null,
    drag: null,
    acc: 0,
    narrative: '',
    verdict: '',
    slowActive: false,
    demoTimer: null,
    W: 0, H: 0, GW: 0, GH: 0
  };
  const key = () => (app.mode === 'micro' ? app.view : app.mode);
  const scene = () => SCENES[key()];
  const sim = () => app.sims[key()];

  function say(narr, verdict) {
    if (narr !== undefined && narr !== null) { app.narrative = narr; els.narrative.textContent = narr; }
    if (verdict !== undefined && verdict !== null) { app.verdict = verdict; els.verdict.textContent = verdict; }
  }

  // ---------------------------------------------------------------- 悬挂场景（钢丝 / 弹簧 / 螺旋钢丝）
  function makeHangScene(kind, opt) {
    return {
      kind,
      title: opt.title,
      subtitle: opt.subtitle,
      hint: 'Hold the ball, drag it up or down, then let go.',
      dt: P.HANG[kind].dt,
      rate: 1,
      window: 4,
      timeLabel: (t) => fmtTime(t),
      legend: [['Wire or spring force', C.tension], ['Pull by hand', C.hand], ['Weight', C.weight]].map((x, i) => i === 0 ? [opt.forceName, C.tension] : x),
      graph: {
        title: opt.forceName + ' and pull by hand over time',
        note: opt.graphNote,
        series: [
          { label: opt.forceName, color: C.tension, get: (s) => P.hangForce(s) },
          { label: 'Pull by hand', color: C.hand, get: (s) => s.hand }
        ],
        yMin: -10, yMax: 50, unit: 'N',
        refs: [{ v: 10, label: 'mg = 10 N', color: C.weight }]
      },
      create() {
        const s = P.createHanging(kind);
        s.watch = null;
        return s;
      },
      step(s, dt) {
        P.stepHanging(s, dt);
        const w = s.watch;
        if (w && !w.done) {
          const T = P.hangForce(s);
          if (Math.abs(T - g) <= 0.1 * Math.abs(w.T0 - g)) {
            w.done = true;
            w.dur = s.t - w.t0;
            opt.onSettle && opt.onSettle(s, w);
          }
          if (s.t - w.t0 > 0.5 && !w.done) w.done = true;
        }
      },
      release(s) {
        if (!s.held) return;
        const T0 = P.hangForce(s);
        const hand0 = s.hand;
        s.held = false;
        s.watch = { t0: s.t, T0, hand0, done: Math.abs(T0 - g) < 1 };
        opt.onRelease(s, s.watch);
      },
      actionA: {
        label: () => 'Pull to ' + opt.demoF + ' N, then release',
        run(s) {
          s.held = true;
          s.y = s.target = opt.demoF / s.k;
          s.v = 0;
          s.a = 0;
          s.hand = opt.demoF - g;
          s.watch = null;
          say('The ball is held: elastic force ' + opt.demoF + ' N, pull by hand ' + (opt.demoF - g) + ' N. Letting go now…', null);
          clearTimeout(app.demoTimer);
          app.demoTimer = setTimeout(() => { if (sim() === s) this_release(s); }, 700);
        }
      },
      actionB: null,
      layout(W, H) {
        const RW = readoutWidth(W);
        const sw = W - RW;
        const cx = sw * 0.47;
        const ceil = 44;
        const R = 24;
        const room = H - ceil - 2 * R - 80;
        const ppm = Math.min(opt.maxPpm, room / (opt.L0 + P.HANG[kind].yMax * opt.mag));
        return { RW, sw, cx, ceil, R, ppm, L0px: opt.L0 * ppm, ext: ppm * opt.mag };
      },
      ballY(s, L) {
        return L.ceil + L.L0px + s.y * L.ext + L.R;
      },
      draw(ctx, W, H, s) {
        const L = this.layout(W, H);
        const by = this.ballY(s, L);
        const T = P.hangForce(s);
        hatch(ctx, L.cx - 90, L.ceil, L.cx + 90, L.ceil, 'up');
        const topOfBall = by - L.R;
        if (opt.connector === 'wire') {
          ctx.save();
          ctx.lineWidth = 3;
          ctx.strokeStyle = T > 0 ? strainColor(T / 50) : '#9aa7b8';
          ctx.beginPath();
          ctx.moveTo(L.cx, L.ceil);
          if (s.y < 0) {
            const bulge = Math.min(40, -s.y * L.ext * 1.5);
            ctx.quadraticCurveTo(L.cx + bulge, (L.ceil + topOfBall) / 2, L.cx, topOfBall);
          } else ctx.lineTo(L.cx, topOfBall);
          ctx.stroke();
          ctx.restore();
        } else {
          vCoil(ctx, L.cx, L.ceil, topOfBall, opt.turns, 16, strainColor(T / 45), 2.6);
        }
        drawBall(ctx, L.cx, by, L.R, s.held);

        // 原长与形变量标尺
        const rx = L.cx - 62;
        const natY = L.ceil + L.L0px;
        ctx.save();
        ctx.strokeStyle = '#9aa7b8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(rx - 14, natY);
        ctx.lineTo(L.cx + 30, natY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(rx, L.ceil + 4);
        ctx.lineTo(rx, natY);
        ctx.stroke();
        ctx.restore();
        text(ctx, 'Natural length', rx - 8, (L.ceil + natY) / 2, { align: 'right', size: 13, color: C.muted });
        const xEnd = topOfBall;
        if (Math.abs(xEnd - natY) > 1) {
          ctx.save();
          ctx.strokeStyle = C.navy;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(rx, natY);
          ctx.lineTo(rx, xEnd);
          ctx.moveTo(rx - 7, xEnd);
          ctx.lineTo(rx + 7, xEnd);
          ctx.stroke();
          ctx.restore();
        }
        text(ctx, 'x = ' + opt.xText(s.y), rx - 8, (natY + xEnd) / 2 + (Math.abs(xEnd - natY) < 20 ? 16 : 0), { align: 'right', size: 14, color: C.navy, weight: 800 });
        if (opt.magNote) text(ctx, opt.magNote, rx - 8, natY + (xEnd > natY ? -14 : 16) - (Math.abs(xEnd - natY) < 20 ? 0 : 0), { align: 'right', size: 11, color: C.muted, weight: 600 });

        // 受力箭头（2 px/N）
        const k = 2;
        const ax = L.cx + L.R + 22;
        if (Math.abs(T) > 0.2) arrow(ctx, ax, by, ax, by - T * k, C.tension, 4);
        text(ctx, opt.forceSym + ' = ' + fmt(T) + ' N', ax + 10, by - Math.max(18, T * k * 0.6), { size: 14, color: C.tension });
        arrow(ctx, ax + 44, by, ax + 44, by + g * k, C.weight, 4);
        text(ctx, 'mg', ax + 54, by + g * k, { size: 13, color: C.weight });
        if (s.held && Math.abs(s.hand) > 0.3) {
          arrow(ctx, L.cx, by + L.R + 4, L.cx, by + L.R + 4 + s.hand * k, C.hand, 5);
          text(ctx, 'Hand ' + fmt(s.hand) + ' N', L.cx - 14, by + L.R + 14 + Math.max(0, s.hand * k) * 0.5, { align: 'right', size: 14, color: C.hand });
        }
        if (!s.held && !s.watch && Math.abs(s.v) < 1e-6) {
          text(ctx, '↓ Hold the ball and pull down', L.cx + L.R + 12, by + L.R + 26, { size: 13, color: C.muted, weight: 700 });
        }
        if (opt.extraDraw) opt.extraDraw(ctx, W, H, s, L, by);

        drawBars(ctx, W - L.RW + 8, 16, L.RW - 24, H - 32, [
          { label: 'Stretch\nx', value: s.y, max: P.HANG[kind].yMax, text: opt.xText(s.y), color: C.navy },
          { label: 'Force\n' + opt.forceSym, value: T, max: 50, text: fmt(T) + ' N', color: C.tension, marks: [{ v: 10, label: 'mg', color: C.weight }] },
          { label: 'Hand\nforce', value: s.hand, max: 50, text: fmt(s.hand) + ' N', color: C.hand }
        ]);
      },
      metrics(s) {
        const a = s.a;
        return [
          [opt.xName, opt.xText(s.y)],
          [opt.forceName, fmt(P.hangForce(s)) + ' N'],
          ['Pull by hand', (s.held ? fmt(s.hand) : '0.0') + ' N'],
          ['Acceleration of the ball', Math.abs(a) < 0.05 ? '0' : fmt(Math.abs(a)) + ' m/s² ' + (a > 0 ? 'down' : 'up')]
        ];
      },
      status(s) {
        if (s.held) return ['Held', 'hold'];
        if (Math.abs(s.v) > (kind === 'rigid' ? 1e-5 : 5e-3)) return ['Moving', 'move'];
        return ['At rest', 'still'];
      },
      pointerDown(s, x, y) {
        const L = this.layout(app.W, app.H);
        const by = this.ballY(s, L);
        if (Math.hypot(x - L.cx, y - by) > L.R + 26) return false;
        s.held = true;
        s.target = s.y;
        s.watch = null;
        app.drag = { off: y - by };
        say('The hand holds the ball: pulling down stretches the wire or spring and the elastic force grows.', null);
        return true;
      },
      pointerMove(s, x, y) {
        const L = this.layout(app.W, app.H);
        const by = y - app.drag.off;
        s.target = clamp((by - L.R - L.ceil - L.L0px) / L.ext, s.yMin, s.yMax);
      },
      pointerUp(s) { this.release(s); }
    };
  }
  function this_release(s) { scene().release(s); }

  function fmtTime(t) {
    if (t <= 0) return '0';
    if (t < 1e-3) return (t * 1e6).toFixed(0) + ' μs';
    if (t < 1) return (t * 1e3).toFixed(1) + ' ms';
    return t.toFixed(2) + ' s';
  }

  function readoutWidth(W) {
    return clamp(W * 0.27, 190, 270);
  }

  const rigidScene = makeHangScene('rigid', {
    title: 'Rigid object · steel wire holding a ball',
    subtitle: 'Wire length 1 m, diameter 1 mm, k ≈ 1.6×10⁵ N/m. Its deformation is only tens of micrometres, so the picture magnifies it 2000 times.',
    forceName: 'Wire tension', forceSym: 'T', xName: 'Wire extension',
    connector: 'wire', L0: 1, mag: 2000, maxPpm: 250, demoF: 40,
    magNote: 'Deformation magnified 2000 times',
    graphNote: 'After release the wire tension returns to mg within a few milliseconds: at ×1 speed that is a vertical line (a sudden change). Slow the playback to ×1/1000 to see it happen.',
    xText: (y) => (y < 0 ? 'slack ' : '') + fmt(Math.abs(y) * 1e6) + ' μm',
    onRelease(s, w) {
      say('At release: pull by hand ' + fmt(w.hand0) + ' N → 0, and the wire tension starts to fall from ' + fmt(w.T0) + ' N back to mg…', null);
    },
    onSettle(s, w) {
      const dx = Math.abs(w.T0 - g) / s.k * 1e6;
      say('Wire tension ' + fmt(w.T0) + ' N → about 10 N took only ' + fmtTime(w.dur) + ' (the ball moves just ' + fmt(dx, 0) + ' μm).',
        'At release the pull by hand drops suddenly to 0; the wire tension returns to mg within ' + fmtTime(w.dur) + ', far shorter than the time we observe, so we treat it as a sudden change.');
    }
  });

  const springScene = makeHangScene('spring', {
    title: 'Spring · spring holding a ball',
    subtitle: 'Spring k = 50 N/m, ball 1 kg. It is the same F = kx, but to change the force the ball must move tens of centimetres.',
    forceName: 'Spring force', forceSym: 'Fₛ', xName: 'Spring extension',
    connector: 'coil', turns: 14, L0: 0.5, mag: 1, maxPpm: 260, demoF: 25,
    graphNote: 'At release the pull by hand drops suddenly to 0, but the spring force curve is continuous: it changes only as the ball moves.',
    xText: (y) => (y < 0 ? 'compressed ' : '') + fmt(Math.abs(y) * 100) + ' cm',
    onRelease(s, w) {
      const a = (w.T0 - g) / s.m;
      const dx = Math.abs(w.T0 - g) / s.k * 100;
      say('At release: pull by hand ' + fmt(w.hand0) + ' N → 0; the spring force is still ' + fmt(w.T0) + ' N.',
        'At release the spring force did not change (' + fmt(w.T0) + ' N), but the acceleration of the ball jumped to ' + fmt(Math.abs(a)) + ' m/s² ' + (a > 0 ? 'upward' : 'downward') +
        '. For the force to return to 10 N the ball must first move ' + fmt(dx) + ' cm, which takes time.');
    }
  });

  // ---------------------------------------------------------------- 摩擦力（宏观）
  const BW = 0.3, BH = 0.2;
  const frictionScene = {
    title: 'Friction · pulling a block on a horizontal surface with a force scale',
    subtitle: 'Block 1 kg, maximum static friction 5 N, sliding friction 3.5 N. Drag the “hand” to pull the scale, or press “Pull steadily”.',
    hint: 'Drag the “hand” (orange dot) left or right to pull or push the scale.',
    dt: P.FRICTION.dt,
    rate: 1,
    window: 8,
    slowFactor: 1,
    legend: [['Pull F', C.hand], ['Friction f', C.friction]],
    graph: {
      title: 'Pull and friction over time',
      note: 'Static friction changes together with the pull; at 5 N the block starts to slide and the friction at once becomes 3.5 N (static → sliding jump); when the block stops it becomes static friction again (sliding → static jump).',
      series: [
        { label: 'Pull F', color: C.hand, get: (s) => Math.abs(s.F) },
        { label: 'Friction f', color: C.friction, get: (s) => Math.abs(s.f) }
      ],
      yMin: 0, yMax: 8, unit: 'N',
      refs: [{ v: 5, label: 'Maximum static friction 5 N', color: '#9b2c2c' }, { v: 3.5, label: 'Sliding friction 3.5 N', color: C.muted }]
    },
    create() {
      const s = P.createFriction();
      s.cam = 0;
      s.evIdx = 0;
      return s;
    },
    step(s, dt) {
      P.stepFriction(s, dt);
    },
    events(s) {
      while (s.evIdx < s.events.length) {
        const e = s.events[s.evIdx++];
        if (e.type === 'static-kinetic') {
          say('Pull above 5 N: the block starts to slide, friction ' + fmt(Math.abs(e.from)) + ' N → ' + fmt(Math.abs(e.to)) + ' N。',
            'Static → sliding jump: after static friction reaches its maximum of ' + fmt(Math.abs(e.from)) + ' N, the moment the block slides the friction becomes sliding friction of ' + fmt(Math.abs(e.to)) + ' N.');
        } else if (e.type === 'kinetic-static') {
          say('The block stops: friction ' + fmt(Math.abs(e.from)) + ' N → ' + fmt(Math.abs(e.to)) + ' N (static friction).',
            'Sliding → static jump: the moment the block stops, the sliding friction of ' + fmt(Math.abs(e.from)) + ' N becomes a static friction of ' + fmt(Math.abs(e.to)) + ' N that balances the pull.');
        } else if (e.type === 'release') {
          say('Released: the pull vanishes, static friction ' + fmt(Math.abs(e.from)) + ' N → 0.',
            'Static friction changes suddenly with the pull: once the pull is removed the block no longer tends to slide, so static friction at once becomes 0.');
        }
      }
    },
    actionA: {
      label: (s) => (s.auto ? 'Stop pulling' : 'Pull steadily'),
      run(s) {
        if (!s.attached) { s.attached = true; s.H = s.X + s.L0; }
        s.auto = s.auto ? 0 : 0.1;
        if (s.auto) say('The hand moves right at a steady 10 cm/s, the scale stretches, and the pull grows gradually.', null);
      }
    },
    actionB: {
      label: (s) => (s.attached ? 'Release' : 'Grab again'),
      run(s) {
        if (s.attached) P.releaseFriction(s);
        else { s.attached = true; s.H = s.X + s.L0; say('The hand grabs the scale again.', null); }
      }
    },
    layout(W, H, s) {
      const RW = readoutWidth(W);
      const sw = W - RW;
      const ppm = Math.min(320, (sw - 80) / 1.3);
      const floorY = H * 0.62;
      const ox = 50;
      return { RW, sw, ppm, floorY, ox };
    },
    sx(s, L, xw) { return L.ox + (xw - s.cam) * L.ppm; },
    draw(ctx, W, H, s) {
      const L = this.layout(W, H, s);
      // 相机跟随物块
      const bx = this.sx(s, L, s.X);
      if (bx > L.sw * 0.42) s.cam = s.X - (L.sw * 0.42 - L.ox) / L.ppm;
      if (bx < L.ox) s.cam = s.X;
      const sx = (xw) => this.sx(s, L, xw);
      // 地面
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, L.sw, H);
      ctx.clip();
      ctx.fillStyle = '#e9edf2';
      ctx.fillRect(0, L.floorY, L.sw, H - L.floorY);
      ctx.strokeStyle = '#3c4656';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, L.floorY);
      ctx.lineTo(L.sw, L.floorY);
      ctx.stroke();
      ctx.strokeStyle = '#a3afbf';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const off = (s.cam * L.ppm) % 16;
      for (let x = -off; x < L.sw + 16; x += 16) { ctx.moveTo(x, L.floorY + 2); ctx.lineTo(x - 10, L.floorY + 14); }
      ctx.stroke();
      text(ctx, 'Rough horizontal surface', 12, L.floorY + 30, { size: 12, color: C.muted });
      // 位置刻度（每 10 cm）
      for (let m = Math.floor(s.cam * 10) / 10; m < s.cam + L.sw / L.ppm; m += 0.1) {
        const x = sx(m);
        ctx.fillStyle = '#b3bdca';
        ctx.fillRect(x, L.floorY + 40, 1, 8);
      }
      // 物块
      const bw = BW * L.ppm, bh = BH * L.ppm;
      const x0 = sx(s.X), yTop = L.floorY - bh;
      ctx.fillStyle = s.stuck ? '#9fb3c8' : '#c7a6a6';
      ctx.strokeStyle = '#4b5b6e';
      ctx.lineWidth = 2;
      roundRect(ctx, x0, yTop, bw, bh, 4);
      ctx.fill();
      ctx.stroke();
      text(ctx, 'm = 1 kg', x0 + bw / 2, yTop + bh / 2, { align: 'center', size: 14, color: '#2b3a4c' });
      // 测力计
      const gy = yTop + bh * 0.45;
      const gx1 = x0 + bw;
      const handX = s.attached ? sx(s.H + BW) : sx(s.X + BW + s.L0);
      const ext = s.attached ? s.H - s.X - s.L0 : 0;
      hCoil(ctx, gx1, handX, gy, 10, 9, strainColor(ext / 0.3), 2.4);
      drawHand(ctx, s.attached ? handX : handX + 18, s.attached ? gy : gy - 34, s.attached);
      // 力的箭头（24 px/N）
      const k = 24;
      if (Math.abs(s.F) > 0.02) {
        arrow(ctx, handX + (s.F > 0 ? 18 : -18), gy, handX + (s.F > 0 ? 18 : -18) + s.F * k, gy, C.hand, 4);
        text(ctx, 'Pull F = ' + fmt(Math.abs(s.F), 2) + ' N', handX + 18, gy - 30, { size: 14, color: C.hand });
      }
      if (Math.abs(s.f) > 0.02) {
        const fx = x0 + bw / 2;
        arrow(ctx, fx, L.floorY - 6, fx + s.f * k, L.floorY - 6, C.friction, 4);
        text(ctx, (s.stuck ? 'Static friction ' : 'Sliding friction ') + fmt(Math.abs(s.f), 2) + ' N', fx, L.floorY + 64, { align: 'center', size: 14, color: C.friction, bg: 'rgba(255,255,255,0.85)' });
      }
      text(ctx, s.stuck ? 'At rest' : 'Sliding v = ' + fmt(Math.abs(s.V) * 100) + ' cm/s', x0 + bw / 2, yTop - 18, { align: 'center', size: 13, color: s.stuck ? C.green : C.friction });
      if (!s.auto && Math.abs(s.F) < 0.02 && s.attached) text(ctx, '← Drag the “hand” →', handX, gy + 36, { align: 'center', size: 13, color: C.muted });
      ctx.restore();
      drawBars(ctx, W - L.RW + 8, 16, L.RW - 24, H - 32, [
        { label: 'Scale\nstretch', value: ext, max: 0.4, text: fmt(ext * 100) + ' cm', color: C.navy },
        { label: 'Pull\nF', value: s.F, max: 8, text: fmt(Math.abs(s.F), 2), color: C.hand },
        { label: (s.stuck ? 'Static' : 'Sliding') + '\nfriction f', value: s.f, max: 8, text: fmt(Math.abs(s.f), 2), color: C.friction, marks: [{ v: 5, label: '5', color: '#9b2c2c' }, { v: 3.5, label: '3.5', color: C.muted }] }
      ]);
    },
    metrics(s) {
      const ext = s.attached ? s.H - s.X - s.L0 : 0;
      return [
        ['Scale stretch', (ext < 0 ? 'compressed ' : '') + fmt(Math.abs(ext) * 100) + ' cm'],
        ['Pull F', fmt(Math.abs(s.F), 2) + ' N'],
        [s.stuck ? 'Static friction f' : 'Sliding friction f', fmt(Math.abs(s.f), 2) + ' N'],
        ['Block speed', fmt(Math.abs(s.V) * 100) + ' cm/s']
      ];
    },
    status(s) { return s.stuck ? ['At rest', 'still'] : ['Sliding', 'slide']; },
    pointerDown(s, x, y) {
      const L = this.layout(app.W, app.H, s);
      const bh = BH * L.ppm;
      const gy = L.floorY - bh + bh * 0.45;
      const hx = s.attached ? this.sx(s, L, s.H + BW) : this.sx(s, L, s.X + BW + s.L0);
      if (Math.hypot(x - hx, y - gy) > 46 && !(Math.abs(y - gy) < 60 && x > hx - 10)) return false;
      if (!s.attached) { s.attached = true; s.H = s.X + s.L0; }
      s.auto = 0;
      app.drag = { x0: x, H0: s.H, ppm: L.ppm };
      return true;
    },
    pointerMove(s, x) {
      const H = app.drag.H0 + (x - app.drag.x0) / app.drag.ppm;
      s.H = clamp(H, s.X + s.L0 - 0.2, s.X + s.L0 + 0.48);
    },
    pointerUp() {}
  };

  // ---------------------------------------------------------------- 微观 1：原子链
  const MAG_CHAIN = 12;
  const chainScene = {
    title: 'Microscopic · atomic chain: elastic force in a rigid object',
    subtitle: 'In a solid the forces between atoms act like very stiff springs. Pull the atom on the right: the deformation passes from atom to atom, right to left. Atom displacements are magnified 12 times.',
    hint: 'Hold the rightmost atom (the hand), drag it left or right, then let go.',
    dt: P.CHAIN.dt,
    rate: 14, // 每秒 14 个时间单位 ≈ 1 ps：放慢约 10¹² 倍
    window: 70,
    legend: [['Stretched (in tension)', C.friction], ['Compressed', C.tension]],
    graph: {
      title: 'Force at the hand end and at the wall end',
      note: 'When the force at the hand end changes, the wall end follows only after about 0.8 ps: this is the time the force takes to pass from atom to atom. For a real 1 m wire it is only about 0.2 ms.',
      series: [
        { label: 'Force at hand end', color: C.hand, get: (s) => P.bondStrain(s, s.n) * P.CHAIN.forceUnit_pN },
        { label: 'Force at wall end', color: C.tension, get: (s) => P.bondStrain(s, 1) * P.CHAIN.forceUnit_pN }
      ],
      yMin: -60, yMax: 110, unit: 'pN',
      refs: []
    },
    timeLabel: (t) => (t * P.CHAIN.timeUnit_ps).toFixed(2) + ' ps',
    create() {
      const s = P.createChain();
      s.jerk = null;
      return s;
    },
    step(s, dt) {
      P.stepChain(s, dt);
      const j = s.jerk;
      if (j && !j.done) {
        const e = j.e;
        if (j.tHand === null && P.bondStrain(s, s.n) >= 0.5 * e) j.tHand = s.t;
        if (j.tWall === null && P.bondStrain(s, 1) >= 0.5 * e) j.tWall = s.t;
        if (j.tHand !== null && j.tWall !== null) {
          j.done = true;
          const d = (j.tWall - j.tHand) * P.CHAIN.timeUnit_ps;
          say('After the hand end was loaded, the wall end felt the same force about ' + d.toFixed(2) + ' ps later.',
            'The force is passed on by changes in atomic spacing, one atom after another, at the speed of sound. ' + s.n + ' atoms took about ' + d.toFixed(2) + ' ps; a 1 m wire takes about 0.2 ms, so on the macroscopic scale the elastic force of a rigid object changes almost “at the same time” everywhere.');
        }
      }
    },
    actionA: {
      label: () => 'Give a sharp pull',
      run(s) {
        s.held = true;
        s.target = s.n + 0.12;
        s.jerk = { e: 0.12 / s.n, tHand: null, tWall: null, done: false };
        say('The hand suddenly pulls right… watch the deformation travel right to left.', null);
      }
    },
    actionB: {
      label: () => 'Release',
      run(s) { if (s.held) { s.held = false; say('Released: the right-hand atom is free, and the stretch travels back left, oscillating and dying away.', null); } }
    },
    layout(W, H, s) {
      const RW = readoutWidth(W);
      const sw = W - RW;
      const x0 = 64;
      const sp = Math.min(62, (sw - x0 - 60) / (s.n + MAG_CHAIN * 0.2));
      return { RW, sw, x0, sp, ay: H * 0.34, py: H * 0.76 };
    },
    ax(s, L, i) { return L.x0 + i * L.sp + (s.x[i] - i) * L.sp * MAG_CHAIN; },
    draw(ctx, W, H, s) {
      const L = this.layout(W, H, s);
      hatch(ctx, L.x0 - 20, L.ay - 70, L.x0 - 20, L.ay + 70, 'left');
      text(ctx, 'Wall', L.x0 - 40, L.ay - 84, { size: 13, color: C.muted });
      ctx.save();
      ctx.strokeStyle = '#3c4656';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(L.x0 - 20, L.ay);
      ctx.lineTo(this.ax(s, L, 0), L.ay);
      ctx.stroke();
      ctx.restore();
      for (let i = 1; i <= s.n; i++) {
        const e = P.bondStrain(s, i);
        const a = this.ax(s, L, i - 1), b = this.ax(s, L, i);
        const gap = Math.min(11, L.sp * 0.28);
        hCoil(ctx, a + gap, b - gap, L.ay, 3, 6, strainColor(e / 0.012), 2.4 + Math.min(2, Math.abs(e) * 150));
      }
      for (let i = 0; i <= s.n; i++) {
        const x = this.ax(s, L, i);
        ctx.save();
        ctx.fillStyle = i === 0 ? '#3c4656' : '#7f90a6';
        ctx.strokeStyle = '#46566a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, L.ay, Math.min(11, L.sp * 0.28), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      const xn = this.ax(s, L, s.n);
      if (s.held) drawHand(ctx, xn + 32, L.ay, true);
      else text(ctx, '← Drag →', xn, L.ay + 32, { align: 'center', size: 12, color: C.muted });
      const F = P.chainForces(s);
      const u = P.CHAIN.forceUnit_pN;
      const k = 1.1;
      if (Math.abs(F.wall * u) > 1) {
        arrow(ctx, L.x0 - 20, L.ay - 40, L.x0 - 20 + F.wall * u * k, L.ay - 40, C.tension, 4);
      }
      text(ctx, 'Force at wall ' + fmt(F.wall * u, 0) + ' pN', L.x0 - 12, L.ay - 58, { size: 13, color: C.tension });
      if (Math.abs(F.hand * u) > 1) arrow(ctx, xn + 14, L.ay + 44, xn + 14 + F.hand * u * k, L.ay + 44, C.hand, 4);
      text(ctx, 'Hand end ' + fmt(F.hand * u, 0) + ' pN', xn, L.ay + 62, { align: 'center', size: 13, color: C.hand });
      text(ctx, 'Atomic spacing r₀ ≈ 0.25 nm · displacements magnified 12 times', L.x0 - 20, 22, { size: 12, color: C.muted, weight: 600 });

      // 各键的形变分布
      const top = L.py - 58, bot = L.py + 58;
      text(ctx, 'Stretch of each bond (deformation along the chain)', L.x0 - 20, top - 22, { size: 13, color: C.ink });
      ctx.save();
      ctx.strokeStyle = '#c3ccd8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L.x0 - 20, L.py);
      ctx.lineTo(this.ax(s, L, 0) + s.n * L.sp + 10, L.py);
      ctx.stroke();
      ctx.restore();
      for (let i = 1; i <= s.n; i++) {
        const e = P.bondStrain(s, i);
        const cx = L.x0 + (i - 0.5) * L.sp;
        const h = clamp(e / 0.015, -1, 1) * (bot - L.py);
        ctx.fillStyle = strainColor(e / 0.012);
        ctx.fillRect(cx - L.sp * 0.3, Math.min(L.py, L.py - h), L.sp * 0.6, Math.abs(h));
      }
      text(ctx, 'Wall', L.x0 - 20, bot + 16, { size: 12, color: C.muted });
      text(ctx, 'Hand', L.x0 + s.n * L.sp, bot + 16, { size: 12, color: C.muted, align: 'right' });

      const dL = (s.x[s.n] - s.n) * 250;
      drawBars(ctx, W - L.RW + 8, 16, L.RW - 24, H - 32, [
        { label: 'Total\nΔL', value: dL, max: 50, text: fmt(dL, 0) + ' pm', color: C.navy },
        { label: 'Hand\nforce', value: F.hand * u, max: 100, text: fmt(F.hand * u, 0), color: C.hand },
        { label: 'Wall\nforce', value: F.wall * u, max: 100, text: fmt(F.wall * u, 0), color: C.tension }
      ]);
    },
    metrics(s) {
      const F = P.chainForces(s);
      const u = P.CHAIN.forceUnit_pN;
      const dL = (s.x[s.n] - s.n) * 250;
      return [
        ['Total stretch ΔL', fmt(dL, 1) + ' pm'],
        ['Average stretch per bond', fmt(dL / s.n, 2) + ' pm (' + fmt(dL / s.n / 250 * 100, 2) + '%)'],
        ['Force at hand end', fmt(F.hand * u, 0) + ' pN'],
        ['Force at wall end', fmt(F.wall * u, 0) + ' pN']
      ];
    },
    status(s) { return s.held ? ['Held', 'hold'] : ['Free end', 'move']; },
    pointerDown(s, x, y) {
      const L = this.layout(app.W, app.H, s);
      const xn = this.ax(s, L, s.n);
      if (Math.hypot(x - xn, y - L.ay) > 40 && Math.hypot(x - xn - 32, y - L.ay) > 30) return false;
      s.held = true;
      s.target = s.x[s.n];
      s.jerk = null;
      app.drag = { x0: x, T0: s.x[s.n], k: L.sp * MAG_CHAIN };
      return true;
    },
    pointerMove(s, x) {
      s.target = clamp(app.drag.T0 + (x - app.drag.x0) / app.drag.k, s.n - 0.12, s.n + 0.2);
    },
    pointerUp(s) {
      s.held = false;
      say('Released: the right-hand atom is free, and the deformation travels back left, oscillating and dying away.', null);
    }
  };

  // ---------------------------------------------------------------- 微观 2：螺旋钢丝
  const MAG_LATTICE = 18;
  const coilScene = makeHangScene('microSpring', {
    title: 'Microscopic · spring: a coiled wire',
    subtitle: 'A spring is also a wire, and the deformation between its atoms is just as small; the coil shape magnifies the tiny twist of the wire into an extension of tens of centimetres. In the magnifier the shift of the atomic layers is magnified 18 times.',
    forceName: 'Spring force', forceSym: 'Fₛ', xName: 'Spring extension',
    connector: 'coil', turns: 12, L0: 0.5, mag: 1, maxPpm: 300, demoF: 15,
    graphNote: 'The spring force changes continuously, only as the extension changes.',
    xText: (y) => (y < 0 ? 'compressed ' : '') + fmt(Math.abs(y) * 100) + ' cm',
    onRelease(s, w) {
      say('At release the spring force is still ' + fmt(w.T0) + ' N; the deformation between the atoms in the wire has had no time to change either.',
        'With the spring stretched ' + fmt(Math.abs(w.T0) / s.k * 100) + ' cm, the atomic layers inside the wire are shifted by only ' + fmt(P.wireShear(Math.abs(w.T0)) * 100, 2) + '%. For the deformation to change the ball must first move tens of centimetres, so the elastic force cannot change suddenly.');
    },
    extraDraw(ctx, W, H, s, L, by) {
      // 放大镜：钢丝内部原子层的剪切
      const F = P.hangForce(s);
      const gamma = P.wireShear(F);
      const r = Math.min(110, (L.sw - L.cx - 150) * 0.5, H * 0.26);
      if (r < 50) return;
      const cx = L.sw - r - 8, cy = H * 0.34;
      const px = L.cx + 16, py = (L.ceil + by - L.R) / 2;
      ctx.save();
      ctx.strokeStyle = '#9aa7b8';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.moveTo(px + 10, py);
      ctx.lineTo(cx - r, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.clip();
      const sp = r / 3.2;
      const shift = gamma * MAG_LATTICE * sp;
      const pos = (i, j) => [cx + (i - 3) * sp + (j - 3) * shift, cy + (j - 3) * sp];
      for (let j = 0; j <= 6; j++) {
        for (let i = 0; i <= 6; i++) {
          const [x, y] = pos(i, j);
          if (i < 6) {
            const [x2, y2] = pos(i + 1, j);
            ctx.strokeStyle = '#c3ccd8';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
          }
          if (j < 6) {
            const [x2, y2] = pos(i, j + 1);
            ctx.strokeStyle = strainColor(Math.abs(gamma) / 0.012);
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
          }
        }
      }
      for (let j = 0; j <= 6; j++) for (let i = 0; i <= 6; i++) {
        const [x, y] = pos(i, j);
        ctx.fillStyle = '#7f90a6';
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = '#46566a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      text(ctx, 'Inside the wire (magnifier)', cx, cy - r - 14, { align: 'center', size: 13, color: C.ink });
      text(ctx, 'Layer shift γ = ' + fmt(gamma * 100, 2) + '%', cx, cy + r + 18, { align: 'center', size: 14, color: C.friction, weight: 800 });
      text(ctx, '(magnified 18 times)', cx, cy + r + 38, { align: 'center', size: 12, color: C.muted, weight: 600 });
    }
  });
  coilScene.layout = function (W, H) {
    const RW = readoutWidth(W);
    const sw = W - RW;
    const cx = sw * 0.3;
    const ceil = 44, R = 24;
    const room = H - ceil - 2 * R - 80;
    const ppm = Math.min(300, room / (0.5 + P.HANG.microSpring.yMax));
    return { RW, sw, cx, ceil, R, ppm, L0px: 0.5 * ppm, ext: ppm };
  };
  coilScene.metrics = function (s) {
    const F = P.hangForce(s);
    const gamma = P.wireShear(F);
    return [
      ['Spring extension', (s.y < 0 ? 'compressed ' : '') + fmt(Math.abs(s.y) * 100) + ' cm'],
      ['Spring force', fmt(F) + ' N'],
      ['Atomic layer shift in the wire', fmt(Math.abs(gamma) * 100, 2) + '%'],
      ['Shift between neighbouring layers', fmt(Math.abs(gamma) * 250, 2) + ' pm']
    ];
  };
  coilScene.hint = 'Hold the ball and drag it up or down to see how small the shift of the atomic layers is in the magnifier.';
  coilScene.actionA = {
    label: () => 'Pull to 15 N, then release',
    run(s) {
      s.held = true;
      s.y = s.target = 15 / s.k;
      s.v = 0; s.a = 0; s.hand = 5;
      s.watch = null;
      clearTimeout(app.demoTimer);
      app.demoTimer = setTimeout(() => { if (sim() === s) coilScene.release(s); }, 700);
    }
  };

  // ---------------------------------------------------------------- 微观 3：接触点
  const contactsScene = {
    title: 'Microscopic · contact points: where friction comes from',
    subtitle: 'Two surfaces really touch only at a few bumps, where the atoms bond together. Move the block slightly (less than 1 μm) and the contact points are sheared, producing static friction.',
    hint: 'Hold and drag left or right on the picture (like a hand pulling the scale), or press “Pull steadily”.',
    dt: P.MF.dt,
    rate: 1,
    window: 5,
    slowFactor: 1 / 200,
    legend: [['Small contact deformation', '#16a34a'], ['Close to breaking', '#d64545']],
    graph: {
      title: 'Pull and friction over time',
      note: 'As the pull grows the contact points are tilted further; the weakest breaks first, its load passes to the others, then they break in bulk, the block slides and the friction drops suddenly. While sliding, contact points keep breaking and re-forming with uneven deformation, so the average friction is smaller.',
      series: [
        { label: 'Pull F', color: C.hand, get: (s) => Math.abs(s.F) },
        { label: 'Friction f', color: C.friction, get: (s) => Math.abs(s.f) }
      ],
      yMin: 0, yMax: 7, unit: 'N',
      refs: []
    },
    create() {
      const s = P.createContacts();
      s.flash = new Array(s.junctions.length).fill(0);
      s.prevOn = s.junctions.map((j) => j.on);
      s.slip = null;
      s.stickMax = 0;
      s.calm = 0;
      return s;
    },
    step(s, dt) {
      P.stepContacts(s, dt);
      const f = Math.abs(s.f);
      const moving = Math.abs(s.V) > 300;
      if (!s.slip) {
        s.stickMax = Math.max(s.stickMax, f);
        if (moving) s.slip = { peak: s.stickMax, sum: 0, n: 0, bondedMin: s.bonded };
      } else {
        if (moving) { s.slip.sum += f; s.slip.n++; s.slip.bondedMin = Math.min(s.slip.bondedMin, s.bonded); s.calm = 0; }
        else if ((s.calm += dt) > 0.003) {
          const sl = s.slip;
          const avg = sl.n ? sl.sum / sl.n : f;
          say('Just now: maximum static friction about ' + fmt(sl.peak, 2) + ' N → average while sliding about ' + fmt(avg, 2) + ' N → static friction of ' + fmt(f, 2) + ' N after stopping.',
            'The block starts to slide when the contact points break in bulk (static → sliding); while sliding they keep breaking and re-forming with uneven stretch, so the average friction is only about ' + fmt(avg, 2) + ' N, less than the maximum static friction of ' + fmt(sl.peak, 2) + ' N.');
          s.slip = null;
          s.stickMax = f;
        }
      }
    },
    slowing(s) { return Math.abs(s.V) > 150 || (s.slip && s.calm < 0.003); },
    actionA: {
      label: (s) => (s.auto ? 'Stop pulling' : 'Pull steadily'),
      run(s) {
        if (!s.attached) { s.attached = true; s.H = s.X; }
        s.auto = s.auto ? 0 : P.MF.handSpeed;
        if (s.auto) say('The hand pulls the scale steadily, the pull slowly grows, and the contact points tilt further and further.', null);
      }
    },
    actionB: {
      label: (s) => (s.attached ? 'Release' : 'Grab again'),
      run(s) {
        if (s.attached) {
          const before = Math.abs(s.f);
          s.attached = false; s.auto = 0;
          say('Released: the pull vanishes, the contact points spring back, and static friction ' + fmt(before, 2) + ' N quickly becomes 0.',
            'Static friction is provided by the elastic deformation of the contact points. The deformation is only a fraction of a micrometre and recovers extremely fast, so static friction can change suddenly with the pull.');
        } else { s.attached = true; s.H = s.X; }
      }
    },
    layout(W, H) {
      const RW = readoutWidth(W);
      const sw = W - RW;
      const spx = sw / 44;
      return { RW, sw, spx, yI: H * 0.5 };
    },
    draw(ctx, W, H, s) {
      const L = this.layout(W, H);
      const left = s.X - 2; // 屏幕左边缘对应的世界坐标（μm）
      const sx = (w) => (w - left) * L.spx;
      const yI = L.yI;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, L.sw, H);
      ctx.clip();
      // 下表面（固定）
      const low = (w) => yI + 18 + 5 * Math.sin(w * 1.3) + 4 * Math.sin(w * 3.7 + 1) + 2 * Math.sin(w * 7.1);
      ctx.fillStyle = '#d7dde5';
      ctx.beginPath();
      ctx.moveTo(0, H - 40);
      for (let x = 0; x <= L.sw; x += 3) ctx.lineTo(x, low(left + x / L.spx));
      ctx.lineTo(L.sw, H - 40);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#6b7a8d';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(ctx, 'Table (fixed)', 12, H - 58, { size: 12, color: C.muted });
      // 上表面（物块）
      const us = s.junctions.map((j) => j.u);
      const up = (b) => {
        const bb = ((b % 40) + 40) % 40;
        let d = 9;
        for (const u of us) d = Math.min(d, Math.abs(bb - u), Math.abs(bb - u + 40), Math.abs(bb - u - 40));
        const tip = Math.max(0, 1 - d / 0.55);
        return yI - 20 - 4 * Math.sin(b * 2.1) - 3 * Math.sin(b * 5.3 + 2) + 16 * tip;
      };
      ctx.fillStyle = s.attached ? '#9fb3c8' : '#aebfd0';
      ctx.beginPath();
      ctx.moveTo(0, 24);
      for (let x = 0; x <= L.sw; x += 3) ctx.lineTo(x, up(x / L.spx - 2));
      ctx.lineTo(L.sw, 24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#4b5b6e';
      ctx.stroke();
      text(ctx, 'Underside of the block', 12, 44, { size: 12, color: '#2b3a4c' });
      // 接触点
      s.junctions.forEach((j, i) => {
        const xu = sx(s.X + j.u);
        if (j.on) {
          const z = P.strainOf(s, j);
          const r = Math.abs(z) / j.zc;
          const xa = sx(j.a);
          ctx.save();
          ctx.strokeStyle = contactColor(r);
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(xu, yI - 5);
          ctx.lineTo(xa, yI + 7);
          ctx.stroke();
          ctx.fillStyle = '#3c4656';
          ctx.beginPath(); ctx.arc(xu, yI - 5, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(xa, yI + 7, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          ctx.save();
          ctx.strokeStyle = '#b8c2d0';
          ctx.setLineDash([2, 3]);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(xu, yI - 5); ctx.lineTo(xu, yI + 7); ctx.stroke();
          ctx.restore();
        }
        if (s.flash[i] > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, s.flash[i] / 0.3);
          ctx.strokeStyle = C.friction;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(xu - 7, yI - 7); ctx.lineTo(xu + 7, yI + 7);
          ctx.moveTo(xu + 7, yI - 7); ctx.lineTo(xu - 7, yI + 7);
          ctx.stroke();
          ctx.restore();
        }
      });
      // 比例尺
      ctx.fillStyle = C.ink;
      ctx.fillRect(16, H - 22, 5 * L.spx, 3);
      text(ctx, '5 μm', 16 + 5 * L.spx + 8, H - 20, { size: 12, color: C.ink });
      // 力
      const k = 22;
      const ay = 90;
      if (Math.abs(s.F) > 0.02) {
        arrow(ctx, L.sw - 30 - Math.max(0, s.F) * k, ay, L.sw - 30 - Math.max(0, s.F) * k + s.F * k, ay, C.hand, 4);
        text(ctx, 'Scale pull F = ' + fmt(Math.abs(s.F), 2) + ' N', L.sw - 30, ay - 22, { align: 'right', size: 14, color: C.hand });
      } else text(ctx, s.attached ? '← Hold and drag left or right →' : 'Released', L.sw - 30, ay - 22, { align: 'right', size: 13, color: C.muted });
      if (Math.abs(s.f) > 0.02) {
        const fx = L.sw * 0.5;
        arrow(ctx, fx, yI - 44, fx + (s.f > 0 ? 1 : -1) * Math.abs(s.f) * k, yI - 44, C.friction, 4);
        text(ctx, 'Friction from the contact points ' + fmt(Math.abs(s.f), 2) + ' N', fx, yI - 64, { align: 'center', size: 14, color: C.friction, bg: 'rgba(255,255,255,0.85)' });
      }
      text(ctx, Math.abs(s.V) > 150 ? 'Sliding' : 'At rest (contact points only tilted)', L.sw * 0.5, H - 20, { align: 'center', size: 13, color: Math.abs(s.V) > 150 ? C.friction : C.green });
      ctx.restore();
      const n = s.junctions.length;
      drawBars(ctx, W - L.RW + 8, 16, L.RW - 24, H - 32, [
        { label: 'Bonded\ncontacts', value: s.bonded, max: n, text: s.bonded + '/' + n, color: C.green },
        { label: 'Pull\nF', value: s.F, max: 7, text: fmt(Math.abs(s.F), 2), color: C.hand },
        { label: 'Friction\nf', value: s.f, max: 7, text: fmt(Math.abs(s.f), 2), color: C.friction }
      ]);
    },
    metrics(s) {
      return [
        ['Bonded contact points', s.bonded + ' / ' + s.junctions.length],
        ['Pull F', fmt(Math.abs(s.F), 2) + ' N'],
        ['Friction f', fmt(Math.abs(s.f), 2) + ' N'],
        ['Block displacement', fmt(s.X, 2) + ' μm']
      ];
    },
    status(s) { return Math.abs(s.V) > 150 ? ['Sliding', 'slide'] : ['At rest', 'still']; },
    pointerDown(s, x) {
      const L = this.layout(app.W, app.H);
      if (!s.attached) { s.attached = true; s.H = s.X; }
      s.auto = 0;
      app.drag = { x0: x, H0: s.H, spx: L.spx };
      return true;
    },
    pointerMove(s, x) {
      s.H = clamp(app.drag.H0 + (x - app.drag.x0) / app.drag.spx, s.X - 8, s.X + 14);
    },
    pointerUp() {}
  };

  const SCENES = { rigid: rigidScene, spring: springScene, friction: frictionScene, chain: chainScene, coil: coilScene, contacts: contactsScene };

  // ---------------------------------------------------------------- UI
  function speedFactor() { return SPEEDS[app.speed]; }

  function resetRecorder() {
    const sc = scene();
    app.rec = makeRecorder(sc.graph.series.length, sc.window * speedFactor());
    app.acc = 0;
  }

  function resetSim() {
    clearTimeout(app.demoTimer);
    app.sims[key()] = scene().create();
    resetRecorder();
    const sc = scene();
    say(sc.hint, 'Drag or press a button to start.');
  }

  function applyScene() {
    const sc = scene();
    if (!app.sims[key()]) app.sims[key()] = sc.create();
    els.modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === app.mode));
    els.subButtons.forEach((b) => b.classList.toggle('active', b.dataset.view === app.view));
    els.microTabs.hidden = app.mode !== 'micro';
    els.stageTitle.textContent = sc.title;
    els.stageSubtitle.textContent = sc.subtitle;
    els.dragHint.textContent = sc.hint;
    els.graphTitle.textContent = sc.graph.title;
    els.graphNote.textContent = sc.graph.note;
    els.legend.innerHTML = sc.legend.map(([t, c]) => '<span><i style="background:' + c + '"></i>' + t + '</span>').join('');
    els.graphLegend.innerHTML = sc.graph.series.map((s) => '<span><i style="background:' + s.color + '"></i>' + s.label + '</span>').join('');
    els.autoSlowRow.hidden = !sc.slowing;
    els.actionB.hidden = !sc.actionB;
    els.actionB.parentElement.classList.toggle('single', !sc.actionB);
    const s = sim();
    s.metricsInit = true;
    resetRecorder();
    say(sc.hint, 'Drag or press a button to start.');
    updateSpeedUI();
    resize();
  }

  function updateSpeedUI() {
    const f = speedFactor();
    els.speedValue.textContent = f === 1 ? '×1' : '×1/' + Math.round(1 / f);
    const k = key();
    let t;
    if (k === 'chain') t = 'Slowed by about ' + ['10¹²', '10¹³', '10¹⁴', '10¹⁵'][app.speed] + ' times';
    else t = f === 1 ? 'Normal speed' : 'Slowed ' + Math.round(1 / f) + ' times';
    if (app.slowActive) t = 'Automatic slow motion ×200';
    els.speedPill.textContent = app.paused ? 'Paused' : t;
    els.speedPill.className = 'status-pill ' + (app.slowActive ? 'slow' : 'neutral');
  }

  els.modeButtons.forEach((b) => b.addEventListener('click', () => { app.mode = b.dataset.mode; applyScene(); }));
  els.subButtons.forEach((b) => b.addEventListener('click', () => { app.view = b.dataset.view; applyScene(); }));
  els.actionA.addEventListener('click', () => { const sc = scene(); sc.actionA.run.call(sc.actionA, sim()); });
  els.actionB.addEventListener('click', () => { const sc = scene(); if (sc.actionB) sc.actionB.run.call(sc.actionB, sim()); });
  els.resetButton.addEventListener('click', resetSim);
  els.pauseButton.addEventListener('click', togglePause);
  els.speedInput.addEventListener('input', () => { app.speed = +els.speedInput.value; resetRecorder(); updateSpeedUI(); });

  function togglePause() {
    app.paused = !app.paused;
    els.pauseButton.textContent = app.paused ? 'Resume' : 'Pause';
    updateSpeedUI();
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    const modes = ['rigid', 'spring', 'friction', 'micro'];
    if (e.key >= '1' && e.key <= '4') { app.mode = modes[+e.key - 1]; applyScene(); }
    else if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 'r' || e.key === 'R') resetSim();
    else if (e.key === 's' || e.key === 'S') { app.speed = (app.speed + 1) % 4; els.speedInput.value = app.speed; resetRecorder(); updateSpeedUI(); }
  });

  function canvasPoint(e) {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  stage.addEventListener('pointerdown', (e) => {
    const [x, y] = canvasPoint(e);
    const sc = scene();
    if (sc.pointerDown(sim(), x, y)) {
      clearTimeout(app.demoTimer);
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('dragging');
      app.dragging = true;
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!app.dragging) return;
    const [x, y] = canvasPoint(e);
    scene().pointerMove(sim(), x, y);
  });
  function endDrag() {
    if (!app.dragging) return;
    app.dragging = false;
    stage.classList.remove('dragging');
    scene().pointerUp(sim());
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // ---------------------------------------------------------------- canvas sizing
  function fit(canvas, ctx) {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [r.width, r.height];
  }
  function resize() {
    [app.W, app.H] = fit(stage, sctx);
    [app.GW, app.GH] = fit(graph, gctx);
  }
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------- graph
  function niceStep(range) {
    const raw = range / 5;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }

  function drawGraph() {
    const ctx = gctx, W = app.GW, H = app.GH;
    ctx.clearRect(0, 0, W, H);
    const sc = scene();
    const gr = sc.graph;
    const rec = app.rec;
    const pad = { l: 52, r: 16, t: 14, b: 34 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const y = (v) => pad.t + ph * (1 - (v - gr.yMin) / (gr.yMax - gr.yMin));
    const tEnd = Math.max(rec.window, rec.t);
    const tStart = tEnd - rec.window;
    const x = (t) => pad.l + pw * (t - tStart) / rec.window;
    ctx.save();
    ctx.font = '600 11px Inter, "PingFang SC", sans-serif';
    const step = niceStep(gr.yMax - gr.yMin);
    for (let v = Math.ceil(gr.yMin / step) * step; v <= gr.yMax + 1e-9; v += step) {
      ctx.strokeStyle = Math.abs(v) < 1e-9 ? C.axis : C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(W - pad.r, y(v)); ctx.stroke();
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(+v.toFixed(3) + '', pad.l - 6, y(v));
    }
    ctx.textAlign = 'left';
    ctx.fillText(gr.unit, 6, pad.t + 4);
    for (const ref of gr.refs) {
      ctx.strokeStyle = ref.color;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(pad.l, y(ref.v)); ctx.lineTo(W - pad.r, y(ref.v)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ref.color;
      ctx.textAlign = 'right';
      ctx.fillText(ref.label, W - pad.r - 4, y(ref.v) - 8);
    }
    // 时间轴
    const tl = sc.timeLabel || fmtTime;
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 4; i++) {
      const t = tStart + rec.window * i / 4;
      const px = pad.l + pw * i / 4;
      ctx.strokeStyle = C.grid;
      ctx.beginPath(); ctx.moveTo(px, pad.t); ctx.lineTo(px, pad.t + ph); ctx.stroke();
      ctx.fillText(t < 0 ? '' : tl(Math.max(0, t)), px, pad.t + ph + 8);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, pad.t - 2, pw, ph + 4);
    ctx.clip();
    for (let si = 0; si < gr.series.length; si++) {
      ctx.strokeStyle = gr.series[si].color;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (const b of rec.buckets) {
        const t0 = b.idx * rec.bd;
        if (t0 < tStart - rec.bd) continue;
        const px = x(t0 + rec.bd / 2);
        const lo = y(b.min[si]), hi = y(b.max[si]), last = y(b.last[si]);
        if (!started) { ctx.moveTo(px, lo); started = true; }
        ctx.lineTo(px, lo);
        ctx.lineTo(px, hi);
        ctx.lineTo(px, last);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  // ---------------------------------------------------------------- loop
  let lastT = performance.now();
  let lastUI = 0;
  function frame(now) {
    const dtReal = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const sc = scene();
    const s = sim();
    if (!app.paused) {
      let f = speedFactor();
      const slow = !!(sc.slowing && els.autoSlow.checked && sc.slowing(s));
      if (slow !== app.slowActive) { app.slowActive = slow; updateSpeedUI(); }
      if (slow) f = Math.min(f, sc.slowFactor);
      app.acc += dtReal * sc.rate * f;
      let count = 0;
      const maxSteps = 6000;
      while (app.acc >= sc.dt && count < maxSteps) {
        sc.step(s, sc.dt);
        record(app.rec, s.t, sc.graph.series.map((q) => q.get(s)));
        app.acc -= sc.dt;
        count++;
      }
      if (count >= maxSteps) app.acc = 0;
      if (sc.events) sc.events(s);
      if (s.flash) {
        s.junctions.forEach((j, i) => {
          if (s.prevOn[i] && !j.on) s.flash[i] = 0.5;
          s.prevOn[i] = j.on;
          s.flash[i] = Math.max(0, s.flash[i] - dtReal);
        });
      }
    }
    sctx.clearRect(0, 0, app.W, app.H);
    sc.draw(sctx, app.W, app.H, s);
    drawGraph();
    if (now - lastUI > 100) {
      lastUI = now;
      sc.metrics(s).forEach(([label, value], i) => {
        els.metricLabels[i].textContent = label;
        els.metricValues[i].textContent = value;
      });
      const [st, cls] = sc.status(s);
      els.statusPill.textContent = st;
      els.statusPill.className = 'status-pill ' + cls;
      els.timeReadout.textContent = 't = ' + (sc.timeLabel || fmtTime)(s.t);
      els.actionA.textContent = sc.actionA.label(s);
      if (sc.actionB) els.actionB.textContent = sc.actionB.label(s);
    }
    requestAnimationFrame(frame);
  }

  applyScene();
  requestAnimationFrame(frame);
})();
