/* Electric Potential in 3D
   Left  : 2D field lines + equipotentials (styled to match the AR Electric Field lab).
   Right : a TRUE 3D potential surface, height = V = Σ k q / r, with NO clamping.
           The 1/r singularity is left intact, so each charge becomes an
           infinitely sharp spike. Because a real singularity is infinitely
           thin, the spikes taper to invisible needles on their own — exactly
           the point: the maths is honest, nothing is truncated.
   THREE.js is used for the surface; the 2D panel is plain canvas. */
(function () {
  "use strict";

  /* ---- palette (matches ar-electric-field / efield-core.js) ---------- */
  var COL = {
    pos:     "#ff5b5b",
    neg:     "#4f9bff",
    posFill: "#ff4d4d",
    negFill: "#3b9bff",
    arrow:   "#ffd34f"
  };

  // ---- State ----------------------------------------------------------
  // Charges in normalized world coords (-1..1 in both axes).
  var charges = [
    { x: -0.45, y: 0.0, q: 5 },   // A
    { x: 0.45, y: 0.0, q: -5 }    // B
  ];
  var settings = {
    levels: 10,
    showLines: true,
    showEquip: true
  };

  // ---- Physics constants ----------------------------------------------
  var K    = 0.06;   // potential scaling constant (visual units)
  var RMIN = 0.004;  // honest floor on r for V — smaller than the grid step,
                     // so the spike stays essentially a true singularity
                     // (very tall, very thin) rather than a rounded plateau.
  var SOFT = 0.03;   // softening used ONLY for field-line integration stability.

  // ---- Physics --------------------------------------------------------
  // Honest Coulomb potential: V = Σ k q / r, no clamping, minimal floor.
  function potentialAt(wx, wy) {
    var v = 0;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var dx = wx - c.x, dy = wy - c.y;
      var r = Math.sqrt(dx * dx + dy * dy);
      if (r < RMIN) r = RMIN;
      v += K * c.q / r;
    }
    return v;
  }

  function fieldAt(wx, wy) {
    var ex = 0, ey = 0, S2 = SOFT * SOFT;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var dx = wx - c.x, dy = wy - c.y;
      var r2 = dx * dx + dy * dy + S2;
      var r = Math.sqrt(r2);
      var s = K * c.q / (r2 * r);
      ex += s * dx; ey += s * dy;
    }
    return { ex: ex, ey: ey };
  }

  // ---- DOM ------------------------------------------------------------
  var c2 = document.getElementById("canvas2d");
  var x2 = c2.getContext("2d");
  var c3 = document.getElementById("canvas3d");

  var qa = document.getElementById("qa");
  var qb = document.getElementById("qb");
  var qaVal = document.getElementById("qaVal");
  var qbVal = document.getElementById("qbVal");
  var levels = document.getElementById("levels");
  var lvlVal = document.getElementById("lvlVal");
  var tLines = document.getElementById("tLines");
  var tEquip = document.getElementById("tEquip");
  var reset = document.getElementById("reset");

  // ---- Sizing (2D) ----------------------------------------------------
  function fit2d() {
    var dpr = window.devicePixelRatio || 1;
    var w = c2.clientWidth;
    var h = Math.round(w * 0.78);
    c2.width = w * dpr; c2.height = h * dpr;
    c2.style.height = h + "px";
    x2.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }
  var dim2;

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

    // background potential heat-map (low-res). Colour uses a smooth tanh
    // compression (colour is inherently bounded even though V is not).
    var step = 6;
    var img = x2.createImageData(w, h);
    var data = img.data;
    for (var py = 0; py < h; py += step) {
      for (var px = 0; px < w; px += step) {
        var wc = s2w(px, py);
        var col = potColor(potentialAt(wc.x, wc.y));
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
    var t = Math.tanh(v * 0.7);           // -1 .. 1, honest but bounded for colour
    if (t >= 0) return [255, 255 - t * 150, 255 - t * 150];   // toward red
    var a = -t;   return [255 - a * 150, 255 - a * 90, 255];  // toward blue
  }

  function drawEquipotentials() {
    var N = 130;
    var grid = [], xs = [], ys = [];
    for (var i = 0; i <= N; i++) { xs[i] = -1 + 2 * i / N; ys[i] = -1 + 2 * i / N; }
    for (var j = 0; j <= N; j++) {
      grid[j] = [];
      for (var i2 = 0; i2 <= N; i2++) grid[j][i2] = Math.tanh(potentialAt(xs[i2], ys[j]) * 0.7);
    }
    var L = settings.levels;
    x2.lineWidth = 1;
    x2.strokeStyle = "rgba(138,154,91,0.85)";
    for (var k = 1; k < L; k++) {
      var lev = (k / L - 0.5) * 1.85;   // evenly spread across the tanh range
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

  // ---- field lines (AR-styled: gradient tubes + yellow arrowheads) -----
  function drawFieldLines() {
    var hasPos = charges.some(function (c) { return c.q > 0; });
    var nSeed = 14, seedR = 0.09;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      if (c.q === 0) continue;
      // seed from sources: positive charges if any exist, else negative
      var isSource = hasPos ? c.q > 0 : c.q < 0;
      if (!isSource) continue;
      var dir = c.q > 0 ? 1 : -1;
      for (var a = 0; a < nSeed; a++) {
        var ang = (a / nSeed) * Math.PI * 2;
        traceLine(c.x + seedR * Math.cos(ang), c.y + seedR * Math.sin(ang), dir, c.q);
      }
    }
  }

  function traceLine(wx, wy, dir, sourceQ) {
    var pts = [{ x: wx, y: wy }];
    var ds = 0.02;
    for (var s = 0; s < 700; s++) {
      // RK2 midpoint integration along the (normalized) field direction
      var f1 = fieldAt(wx, wy), l1 = Math.hypot(f1.ex, f1.ey);
      if (l1 < 1e-7) break;
      var k1x = dir * ds * f1.ex / l1, k1y = dir * ds * f1.ey / l1;
      var f2 = fieldAt(wx + k1x, wy + k1y), l2 = Math.hypot(f2.ex, f2.ey);
      var dx2 = k1x, dy2 = k1y;
      if (l2 > 1e-7) { dx2 = 0.5 * (k1x + dir * ds * f2.ex / l2); dy2 = 0.5 * (k1y + dir * ds * f2.ey / l2); }
      wx += dx2; wy += dy2;
      pts.push({ x: wx, y: wy });
      if (wx < -1.15 || wx > 1.15 || wy < -1.15 || wy > 1.15) break;
      var stop = false;
      for (var i = 0; i < charges.length; i++) {
        var c = charges[i];
        if (c.q * sourceQ < 0) { // terminate on opposite charge
          var dxc = wx - c.x, dyc = wy - c.y;
          if (dxc * dxc + dyc * dyc < 0.05 * 0.05) { stop = true; break; }
        }
      }
      if (stop) break;
    }
    if (pts.length < 2) return;

    // draw as a coloured gradient (source colour -> opposite colour)
    var cFrom = sourceQ > 0 ? COL.pos : COL.neg;
    var cTo = COL.neg; // lines flow toward the sink; use neg as the far colour
    if (sourceQ < 0) cTo = COL.pos;
    var A = hexRGB(cFrom), B = hexRGB(cTo);
    x2.lineWidth = 2.2; x2.lineJoin = "round"; x2.lineCap = "round";
    for (var q = 0; q + 1 < pts.length; q++) {
      var t = q / (pts.length - 1);
      var p0 = w2s(pts[q].x, pts[q].y), p1 = w2s(pts[q + 1].x, pts[q + 1].y);
      x2.strokeStyle = "rgba(" +
        Math.round(A[0] + (B[0] - A[0]) * t) + "," +
        Math.round(A[1] + (B[1] - A[1]) * t) + "," +
        Math.round(A[2] + (B[2] - A[2]) * t) + ",0.92)";
      x2.beginPath(); x2.moveTo(p0.x, p0.y); x2.lineTo(p1.x, p1.y); x2.stroke();
    }
    // arrowheads along the line (field direction)
    var every = Math.max(14, Math.floor(pts.length / 3));
    for (var m = every; m < pts.length - 1; m += every) {
      arrowHead(pts[m], pts[m + 1]);
    }
  }

  function arrowHead(a, b) {
    var pa = w2s(a.x, a.y), pb = w2s(b.x, b.y);
    var ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    var L = 8, W = 4.5;
    x2.fillStyle = COL.arrow;
    x2.beginPath();
    x2.moveTo(pb.x, pb.y);
    x2.lineTo(pb.x - L * Math.cos(ang - 0.5), pb.y - L * Math.sin(ang - 0.5));
    x2.lineTo(pb.x - L * Math.cos(ang + 0.5), pb.y - L * Math.sin(ang + 0.5));
    x2.closePath(); x2.fill();
  }

  function hexRGB(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  function drawCharges2D() {
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var p = w2s(c.x, c.y);
      var r = 12 + Math.min(9, Math.abs(c.q)) * 0.7;
      x2.beginPath();
      x2.arc(p.x, p.y, r, 0, Math.PI * 2);
      x2.fillStyle = c.q >= 0 ? COL.posFill : COL.negFill;
      if (c.q === 0) x2.fillStyle = "#9a9a9a";
      x2.fill();
      x2.lineWidth = 2.5; x2.strokeStyle = "#fff"; x2.stroke();
      // + / - glyph drawn as strokes (matches the AR charge sprite)
      x2.strokeStyle = "#fff"; x2.lineWidth = 2.6; x2.lineCap = "round";
      x2.beginPath();
      x2.moveTo(p.x - r * 0.5, p.y); x2.lineTo(p.x + r * 0.5, p.y);
      if (c.q > 0) { x2.moveTo(p.x, p.y - r * 0.5); x2.lineTo(p.x, p.y + r * 0.5); }
      x2.stroke();
      // label A/B
      x2.fillStyle = "#333";
      x2.font = "11px Inter, sans-serif";
      x2.textAlign = "center"; x2.textBaseline = "middle";
      x2.fillText(i === 0 ? "A" : "B", p.x, p.y - r - 9);
    }
  }

  // ---- 3D: honest potential surface via THREE.js ----------------------
  var THREE = window.THREE;
  var renderer, scene, camera, surfMesh, baseGeo, baseA, baseB, colorAttr, chargeDots = [];
  var GRID_N = 200;                    // fine grid -> spikes stay thin
  var HEIGHT = 0.32;                   // height per unit V (no ceiling applied)
  var orbit = { yaw: -0.6, pitch: 0.62, radius: 3.3 };
  var dirty = true;

  function init3D() {
    renderer = new THREE.WebGLRenderer({ canvas: c3, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0b0e16, 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(48, 1, 0.01, 100);

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    var dl = new THREE.DirectionalLight(0xffffff, 0.7);
    dl.position.set(2.5, 5, 2); scene.add(dl);
    var dl2 = new THREE.DirectionalLight(0x88aaff, 0.25);
    dl2.position.set(-3, 2, -2); scene.add(dl2);

    // faint reference ground grid at V = 0
    var grid = new THREE.GridHelper(2, 20, 0x2a3550, 0x1a2338);
    grid.position.y = 0; scene.add(grid);

    // potential surface
    baseGeo = new THREE.PlaneGeometry(2, 2, GRID_N, GRID_N);
    var pos = baseGeo.attributes.position, cnt = pos.count;
    baseA = new Float32Array(cnt); baseB = new Float32Array(cnt);
    for (var i = 0; i < cnt; i++) { baseA[i] = pos.getX(i); baseB[i] = pos.getY(i); }
    colorAttr = new THREE.BufferAttribute(new Float32Array(cnt * 3), 3);
    baseGeo.setAttribute("color", colorAttr);
    var mat = new THREE.MeshPhongMaterial({
      vertexColors: true, side: THREE.DoubleSide,
      shininess: 24, specular: 0x223044, flatShading: false
    });
    surfMesh = new THREE.Mesh(baseGeo, mat);
    scene.add(surfMesh);

    // charge marker dots sitting on the base plane
    for (var d = 0; d < charges.length; d++) {
      var dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 16, 16),
        new THREE.MeshBasicMaterial({ color: charges[d].q >= 0 ? COL.posFill : COL.negFill })
      );
      scene.add(dot); chargeDots.push(dot);
    }

    fit3d();
    animate3D();
    setupOrbit();
  }

  function fit3d() {
    var w = c3.clientWidth;
    var h = Math.round(w * 0.78);
    renderer.setSize(w, h, false);
    c3.style.height = h + "px";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Rebuild surface heights + colours from the honest potential (no clamp).
  function build3D() {
    var pos = baseGeo.attributes.position, cnt = pos.count;
    var col = colorAttr.array;
    for (var i = 0; i < cnt; i++) {
      var a = baseA[i], b = baseB[i];
      var v = potentialAt(a, b);           // honest V — unbounded
      pos.setXYZ(i, a, v * HEIGHT, b);     // height IS the potential, no ceiling

      var t = Math.tanh(v * 0.6);          // colour only (bounded), sign-aware
      var c = surfColor(t);
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    pos.needsUpdate = true;
    colorAttr.needsUpdate = true;
    baseGeo.computeVertexNormals();

    for (var d = 0; d < chargeDots.length; d++) {
      chargeDots[d].position.set(charges[d].x, 0.02, charges[d].y);
      chargeDots[d].material.color.set(charges[d].q >= 0 ? COL.posFill : COL.negFill);
      chargeDots[d].visible = charges[d].q !== 0;
    }
  }

  // colour ramp: blue (well) -> dark neutral (V=0) -> red (peak)
  function surfColor(t) {
    var mid = [0.10, 0.16, 0.24];
    if (t >= 0) {
      var hot = [1.0, 0.36, 0.31], tip = [1.0, 0.86, 0.70];
      var u = Math.pow(t, 0.5);
      var r = lerp3(mid, hot, u);
      if (t > 0.8) r = lerp3(r, tip, (t - 0.8) / 0.2);
      return r;
    } else {
      var cold = [0.31, 0.61, 1.0], deep = [0.75, 0.88, 1.0];
      var a = Math.pow(-t, 0.5);
      var b = lerp3(mid, cold, a);
      if (-t > 0.8) b = lerp3(b, deep, (-t - 0.8) / 0.2);
      return b;
    }
  }
  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  function animate3D() {
    requestAnimationFrame(animate3D);
    if (dirty) { build3D(); dirty = false; }
    // camera from spherical orbit around a point slightly above the plane
    var tgt = new THREE.Vector3(0, 0.12, 0);
    var cp = Math.cos(orbit.pitch), sp = Math.sin(orbit.pitch);
    camera.position.set(
      tgt.x + orbit.radius * cp * Math.sin(orbit.yaw),
      tgt.y + orbit.radius * sp,
      tgt.z + orbit.radius * cp * Math.cos(orbit.yaw)
    );
    camera.lookAt(tgt);
    renderer.render(scene, camera);
  }

  function setupOrbit() {
    var drag = null;
    function down(e) {
      var t = e.touches ? e.touches[0] : e;
      drag = { x: t.clientX, y: t.clientY, yaw: orbit.yaw, pitch: orbit.pitch };
      e.preventDefault();
    }
    function move(e) {
      if (!drag) return;
      var t = e.touches ? e.touches[0] : e;
      orbit.yaw = drag.yaw - (t.clientX - drag.x) * 0.01;
      orbit.pitch = Math.max(0.05, Math.min(1.45, drag.pitch + (t.clientY - drag.y) * 0.006));
      e.preventDefault();
    }
    function up() { drag = null; }
    c3.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    c3.addEventListener("touchstart", down, { passive: false });
    c3.addEventListener("touchmove", move, { passive: false });
    c3.addEventListener("touchend", up);
    c3.addEventListener("wheel", function (e) {
      orbit.radius = Math.max(1.2, Math.min(8, orbit.radius + e.deltaY * 0.0015));
      e.preventDefault();
    }, { passive: false });
  }

  // ---- Interaction: drag charges on the 2D panel ----------------------
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
      if (dx * dx + dy * dy < 24 * 24) { dragging = i; e.preventDefault(); return; }
    }
  }
  function onMove(e) {
    if (dragging < 0) return;
    var p = pointer(e);
    var wc = s2w(p.x, p.y);
    charges[dragging].x = Math.max(-0.95, Math.min(0.95, wc.x));
    charges[dragging].y = Math.max(-0.95, Math.min(0.95, wc.y));
    e.preventDefault();
    draw2D(); dirty = true;
  }
  function onUp() { dragging = -1; }
  c2.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  c2.addEventListener("touchstart", onDown, { passive: false });
  c2.addEventListener("touchmove", onMove, { passive: false });
  c2.addEventListener("touchend", onUp);

  // ---- Controls -------------------------------------------------------
  function fmt(q) { return (q > 0 ? "+" : "") + q; }
  qa.addEventListener("input", function () {
    charges[0].q = +qa.value; qaVal.textContent = fmt(charges[0].q); draw2D(); dirty = true;
  });
  qb.addEventListener("input", function () {
    charges[1].q = +qb.value; qbVal.textContent = fmt(charges[1].q); draw2D(); dirty = true;
  });
  levels.addEventListener("input", function () {
    settings.levels = +levels.value; lvlVal.textContent = settings.levels; draw2D();
  });
  tLines.addEventListener("change", function () { settings.showLines = tLines.checked; draw2D(); });
  tEquip.addEventListener("change", function () { settings.showEquip = tEquip.checked; draw2D(); });
  reset.addEventListener("click", function () {
    charges[0] = { x: -0.45, y: 0, q: 5 };
    charges[1] = { x: 0.45, y: 0, q: -5 };
    settings.levels = 10;
    orbit.yaw = -0.6; orbit.pitch = 0.62; orbit.radius = 3.3;
    qa.value = 5; qb.value = -5; levels.value = 10;
    qaVal.textContent = "+5"; qbVal.textContent = "-5"; lvlVal.textContent = "10";
    draw2D(); dirty = true;
  });

  // ---- Init / resize --------------------------------------------------
  function resizeAll() {
    dim2 = fit2d();
    draw2D();
    if (renderer) fit3d();
  }
  window.addEventListener("resize", resizeAll);

  dim2 = fit2d();
  draw2D();
  if (THREE) init3D();
})();
