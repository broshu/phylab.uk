/* Electric Potential in 3D — 2D field/equipotential view + 3D potential surface.
   Self-contained, no dependencies. */
(function () {
  "use strict";

  // ---- State ----------------------------------------------------------
  // Charges in normalized world coords (-1..1 in both axes).
  var charges = [
    { x: -0.45, y: 0.0, q: 5 },   // A
    { x: 0.45, y: 0.0, q: -5 }    // B
  ];
  var settings = {
    levels: 10,
    showLines: true,
    showEquip: true,
    yaw: -0.6,    // 3D rotation around vertical
    pitch: 0.95   // tilt
  };

  var K = 0.06; // potential scaling constant (visual)

  // ---- DOM ------------------------------------------------------------
  var c2 = document.getElementById("canvas2d");
  var x2 = c2.getContext("2d");
  var c3 = document.getElementById("canvas3d");
  var x3 = c3.getContext("2d");

  var qa = document.getElementById("qa");
  var qb = document.getElementById("qb");
  var qaVal = document.getElementById("qaVal");
  var qbVal = document.getElementById("qbVal");
  var levels = document.getElementById("levels");
  var lvlVal = document.getElementById("lvlVal");
  var tLines = document.getElementById("tLines");
  var tEquip = document.getElementById("tEquip");
  var reset = document.getElementById("reset");

  // ---- Physics --------------------------------------------------------
  function potentialAt(wx, wy) {
    var v = 0;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var dx = wx - c.x, dy = wy - c.y;
      var r = Math.sqrt(dx * dx + dy * dy);
      if (r < 0.05) r = 0.05; // soften singularity
      v += K * c.q / r;
    }
    return v;
  }

  function fieldAt(wx, wy) {
    var ex = 0, ey = 0;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var dx = wx - c.x, dy = wy - c.y;
      var r2 = dx * dx + dy * dy;
      var r = Math.sqrt(r2);
      if (r < 0.05) r = 0.05, r2 = r * r;
      var s = K * c.q / (r2 * r);
      ex += s * dx; ey += s * dy;
    }
    return { ex: ex, ey: ey };
  }

  // ---- Sizing ---------------------------------------------------------
  function fit(cv) {
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth;
    var h = Math.round(w * 0.78);
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.height = h + "px";
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }
  var dim2, dim3;

  // world(-1..1) -> screen for 2D panel
  function w2s(wx, wy) {
    var m = 18;
    return {
      x: m + (wx + 1) / 2 * (dim2.w - 2 * m),
      y: m + (wy + 1) / 2 * (dim2.h - 2 * m)
    };
  }
  function s2w(sx, sy) {
    var m = 18;
    return {
      x: (sx - m) / (dim2.w - 2 * m) * 2 - 1,
      y: (sy - m) / (dim2.h - 2 * m) * 2 - 1
    };
  }

  // ---- 2D rendering ---------------------------------------------------
  function draw2D() {
    var w = dim2.w, h = dim2.h;
    x2.clearRect(0, 0, w, h);

    // background potential heatmap (low-res for speed)
    var step = 6;
    var img = x2.createImageData(w, h);
    var data = img.data;
    // precompute v range
    for (var py = 0; py < h; py += step) {
      for (var px = 0; px < w; px += step) {
        var wc = s2w(px, py);
        var v = potentialAt(wc.x, wc.y);
        var col = potColor(v);
        for (var yy = 0; yy < step && py + yy < h; yy++) {
          for (var xx = 0; xx < step && px + xx < w; xx++) {
            var idx = ((py + yy) * w + (px + xx)) * 4;
            data[idx] = col[0]; data[idx + 1] = col[1]; data[idx + 2] = col[2]; data[idx + 3] = 255;
          }
        }
      }
    }
    x2.putImageData(img, 0, 0);

    if (settings.showEquip) drawEquipotentials();
    if (settings.showLines) drawFieldLines();
    drawCharges2D();
  }

  function potColor(v) {
    // map potential to red(+)/white(0)/blue(-)
    var t = Math.max(-1, Math.min(1, v / 0.55));
    if (t >= 0) {
      return [255, 255 - t * 150, 255 - t * 150];
    } else {
      var a = -t;
      return [255 - a * 150, 255 - a * 90, 255];
    }
  }

  function drawEquipotentials() {
    // marching-squares on a grid for several levels
    var N = 130;
    var grid = [];
    var xs = [], ys = [];
    for (var i = 0; i <= N; i++) { xs[i] = -1 + 2 * i / N; ys[i] = -1 + 2 * i / N; }
    for (var j = 0; j <= N; j++) {
      grid[j] = [];
      for (var i2 = 0; i2 <= N; i2++) grid[j][i2] = potentialAt(xs[i2], ys[j]);
    }
    var L = settings.levels;
    x2.lineWidth = 1;
    x2.strokeStyle = "rgba(138,154,91,0.85)";
    for (var k = 1; k < L; k++) {
      var frac = k / L;
      var lev = (frac - 0.5) * 1.1; // spread around 0
      contour(grid, xs, ys, N, lev);
    }
  }

  function contour(grid, xs, ys, N, lev) {
    x2.beginPath();
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var v0 = grid[j][i], v1 = grid[j][i + 1], v2 = grid[j + 1][i + 1], v3 = grid[j + 1][i];
        var idx = (v0 > lev ? 1 : 0) | (v1 > lev ? 2 : 0) | (v2 > lev ? 4 : 0) | (v3 > lev ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        var pts = [];
        // edges: top(0-1), right(1-2), bottom(2-3), left(3-0)
        if (((idx & 1) ? 1 : 0) ^ ((idx & 2) ? 1 : 0)) pts.push(interp(xs[i], ys[j], v0, xs[i + 1], ys[j], v1, lev));
        if (((idx & 2) ? 1 : 0) ^ ((idx & 4) ? 1 : 0)) pts.push(interp(xs[i + 1], ys[j], v1, xs[i + 1], ys[j + 1], v2, lev));
        if (((idx & 4) ? 1 : 0) ^ ((idx & 8) ? 1 : 0)) pts.push(interp(xs[i + 1], ys[j + 1], v2, xs[i], ys[j + 1], v3, lev));
        if (((idx & 8) ? 1 : 0) ^ ((idx & 1) ? 1 : 0)) pts.push(interp(xs[i], ys[j + 1], v3, xs[i], ys[j], v0, lev));
        for (var p = 0; p + 1 < pts.length; p += 2) {
          var a = w2s(pts[p].x, pts[p].y), b = w2s(pts[p + 1].x, pts[p + 1].y);
          x2.moveTo(a.x, a.y); x2.lineTo(b.x, b.y);
        }
      }
    }
    x2.stroke();
  }

  function interp(xa, ya, va, xb, yb, vb, lev) {
    var t = (lev - va) / (vb - va);
    return { x: xa + t * (xb - xa), y: ya + t * (yb - ya) };
  }

  function drawFieldLines() {
    x2.strokeStyle = "rgba(60,60,60,0.7)";
    x2.lineWidth = 1.1;
    var perCharge = 16;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      if (c.q === 0) continue;
      var dir = c.q > 0 ? 1 : -1;
      for (var a = 0; a < perCharge; a++) {
        var ang = (a / perCharge) * Math.PI * 2;
        var wx = c.x + 0.07 * Math.cos(ang);
        var wy = c.y + 0.07 * Math.sin(ang);
        traceLine(wx, wy, dir);
      }
    }
  }

  function traceLine(wx, wy, dir) {
    x2.beginPath();
    var p = w2s(wx, wy);
    x2.moveTo(p.x, p.y);
    var ds = 0.012;
    for (var s = 0; s < 600; s++) {
      var f = fieldAt(wx, wy);
      var mag = Math.sqrt(f.ex * f.ex + f.ey * f.ey);
      if (mag < 1e-6) break;
      wx += dir * ds * f.ex / mag;
      wy += dir * ds * f.ey / mag;
      if (wx < -1.1 || wx > 1.1 || wy < -1.1 || wy > 1.1) break;
      // stop near a charge
      var stop = false;
      for (var i = 0; i < charges.length; i++) {
        var c = charges[i];
        var dx = wx - c.x, dy = wy - c.y;
        if (dx * dx + dy * dy < 0.0045) { stop = true; break; }
      }
      var sp = w2s(wx, wy);
      x2.lineTo(sp.x, sp.y);
      if (stop) break;
    }
    x2.stroke();
  }

  function drawCharges2D() {
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var p = w2s(c.x, c.y);
      var r = 9 + Math.min(9, Math.abs(c.q)) * 0.8;
      x2.beginPath();
      x2.arc(p.x, p.y, r, 0, Math.PI * 2);
      x2.fillStyle = c.q >= 0 ? "#f45b69" : "#2d7ff9";
      if (c.q === 0) x2.fillStyle = "#9a9a9a";
      x2.fill();
      x2.lineWidth = 2; x2.strokeStyle = "#fff"; x2.stroke();
      x2.fillStyle = "#fff";
      x2.font = "bold 13px Inter, sans-serif";
      x2.textAlign = "center"; x2.textBaseline = "middle";
      x2.fillText(c.q > 0 ? "+" : (c.q < 0 ? "−" : "0"), p.x, p.y);
      // label A/B
      x2.fillStyle = "#333";
      x2.font = "11px Inter, sans-serif";
      x2.fillText(i === 0 ? "A" : "B", p.x, p.y - r - 9);
    }
  }

  // ---- 3D rendering (potential surface) -------------------------------
  function draw3D() {
    var w = dim3.w, h = dim3.h;
    x3.clearRect(0, 0, w, h);

    var N = 46;               // grid resolution
    var cy = Math.cos(settings.yaw), sy = Math.sin(settings.yaw);
    var cp = Math.cos(settings.pitch), sp = Math.sin(settings.pitch);
    var scale = Math.min(w, h) * 0.42;
    var cx = w / 2, cz = h * 0.56;
    var heightScale = 0.9;

    function project(wx, wy, v) {
      // rotate around vertical (yaw) then tilt (pitch)
      var X = wx * cy - wy * sy;
      var Y = wx * sy + wy * cy;
      var Z = v * heightScale;
      // pitch: tilt Y up/down, Z becomes screen-up
      var sxp = X;
      var syp = Y * sp - Z * cp;
      return { x: cx + sxp * scale, y: cz + syp * scale };
    }

    // build vertices
    var pts = [], vals = [];
    for (var j = 0; j <= N; j++) {
      pts[j] = []; vals[j] = [];
      for (var i = 0; i <= N; i++) {
        var wx = -1 + 2 * i / N;
        var wy = -1 + 2 * j / N;
        var v = potentialAt(wx, wy);
        v = Math.max(-0.85, Math.min(0.85, v)); // clamp spikes
        pts[j][i] = project(wx, wy, v);
        vals[j][i] = v;
      }
    }

    // draw quads back-to-front (by average projected y of far edge)
    var quads = [];
    for (var j2 = 0; j2 < N; j2++) {
      for (var i2 = 0; i2 < N; i2++) {
        var depth = (pts[j2][i2].y + pts[j2 + 1][i2 + 1].y);
        quads.push({ i: i2, j: j2, d: depth });
      }
    }
    quads.sort(function (a, b) { return a.d - b.d; });

    for (var q = 0; q < quads.length; q++) {
      var i = quads[q].i, j = quads[q].j;
      var a = pts[j][i], b = pts[j][i + 1], cc = pts[j + 1][i + 1], d = pts[j + 1][i];
      var vAvg = (vals[j][i] + vals[j][i + 1] + vals[j + 1][i + 1] + vals[j + 1][i]) / 4;
      var col = surfColor(vAvg, vals, i, j, N);
      x3.beginPath();
      x3.moveTo(a.x, a.y); x3.lineTo(b.x, b.y); x3.lineTo(cc.x, cc.y); x3.lineTo(d.x, d.y); x3.closePath();
      x3.fillStyle = col.fill;
      x3.fill();
      x3.lineWidth = 0.5;
      x3.strokeStyle = col.stroke;
      x3.stroke();
    }
  }

  function surfColor(v, vals, i, j, N) {
    // simple shading from slope + potential-based hue
    var t = Math.max(-1, Math.min(1, v / 0.7));
    var r, g, bl;
    if (t >= 0) { r = 244; g = 120 - t * 40; bl = 120 - t * 40; }
    else { var a = -t; r = 90 + (1 - a) * 60; g = 150 + (1 - a) * 40; bl = 249; }
    // shade by local height difference (fake light)
    var dv = (vals[j][i + 1] - vals[j][i]);
    var sh = Math.max(0.65, Math.min(1.15, 1 + dv * 2.2));
    r = Math.round(Math.min(255, r * sh));
    g = Math.round(Math.min(255, g * sh));
    bl = Math.round(Math.min(255, bl * sh));
    return {
      fill: "rgba(" + r + "," + g + "," + bl + ",0.92)",
      stroke: "rgba(255,255,255,0.25)"
    };
  }

  // ---- Render all -----------------------------------------------------
  function render() {
    draw2D();
    draw3D();
  }

  // ---- Interaction: drag charges on 2D --------------------------------
  var dragging = -1;
  function pointer(e) {
    var rect = c2.getBoundingClientRect();
    var t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
  function onDown(e) {
    var p = pointer(e);
    for (var i = 0; i < charges.length; i++) {
      var sp = w2s(charges[i].x, charges[i].y);
      var dx = p.x - sp.x, dy = p.y - sp.y;
      if (dx * dx + dy * dy < 22 * 22) { dragging = i; e.preventDefault(); return; }
    }
  }
  function onMove(e) {
    if (dragging < 0) return;
    var p = pointer(e);
    var wc = s2w(p.x, p.y);
    charges[dragging].x = Math.max(-0.95, Math.min(0.95, wc.x));
    charges[dragging].y = Math.max(-0.95, Math.min(0.95, wc.y));
    e.preventDefault();
    render();
  }
  function onUp() { dragging = -1; }

  c2.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  c2.addEventListener("touchstart", onDown, { passive: false });
  c2.addEventListener("touchmove", onMove, { passive: false });
  c2.addEventListener("touchend", onUp);

  // ---- Interaction: rotate 3D -----------------------------------------
  var rot = null;
  function rotDown(e) {
    var t = e.touches ? e.touches[0] : e;
    rot = { x: t.clientX, y: t.clientY, yaw: settings.yaw, pitch: settings.pitch };
    e.preventDefault();
  }
  function rotMove(e) {
    if (!rot) return;
    var t = e.touches ? e.touches[0] : e;
    settings.yaw = rot.yaw + (t.clientX - rot.x) * 0.01;
    settings.pitch = Math.max(0.25, Math.min(1.45, rot.pitch + (t.clientY - rot.y) * 0.006));
    e.preventDefault();
    draw3D();
  }
  function rotUp() { rot = null; }
  c3.addEventListener("mousedown", rotDown);
  window.addEventListener("mousemove", rotMove);
  window.addEventListener("mouseup", rotUp);
  c3.addEventListener("touchstart", rotDown, { passive: false });
  c3.addEventListener("touchmove", rotMove, { passive: false });
  c3.addEventListener("touchend", rotUp);

  // ---- Controls -------------------------------------------------------
  function fmt(q) { return (q > 0 ? "+" : "") + q; }
  qa.addEventListener("input", function () {
    charges[0].q = +qa.value; qaVal.textContent = fmt(charges[0].q); render();
  });
  qb.addEventListener("input", function () {
    charges[1].q = +qb.value; qbVal.textContent = fmt(charges[1].q); render();
  });
  levels.addEventListener("input", function () {
    settings.levels = +levels.value; lvlVal.textContent = settings.levels; draw2D();
  });
  tLines.addEventListener("change", function () { settings.showLines = tLines.checked; draw2D(); });
  tEquip.addEventListener("change", function () { settings.showEquip = tEquip.checked; draw2D(); });
  reset.addEventListener("click", function () {
    charges[0] = { x: -0.45, y: 0, q: 5 };
    charges[1] = { x: 0.45, y: 0, q: -5 };
    settings.yaw = -0.6; settings.pitch = 0.95; settings.levels = 10;
    qa.value = 5; qb.value = -5; levels.value = 10;
    qaVal.textContent = "+5"; qbVal.textContent = "-5"; lvlVal.textContent = "10";
    render();
  });

  // ---- Init / resize --------------------------------------------------
  function resizeAll() {
    dim2 = fit(c2);
    dim3 = fit(c3);
    render();
  }
  window.addEventListener("resize", resizeAll);
  resizeAll();
})();
