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
  // Charges in normalized world coords (-1..1 in both axes). Dynamic list.
  var charges = [
    { x: -0.45, y: 0.0, q: 5 },
    { x: 0.45, y: 0.0, q: -5 }
  ];
  var selected = 0;               // index of the charge the slider edits
  var settings = {
    levels: 10,
    showLines: true,
    showEquip: true,
    view3D: "surface",   // "surface" (height = V) | "equipot" (isosurfaces)
    shells: 5,           // number of equipotential shells per sign
    showZero: false      // draw the V = 0 surface
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

  // ---- True 3-D physics (for equipotential SURFACES in space) ----------
  // The point charges live on the plane y = 0 at (c.x, 0, c.y) in scene
  // coordinates. The full-space potential is the exact Coulomb sum
  //   V(x,y,z) = Σ k q / sqrt((x-c.x)^2 + y^2 + (z-c.y)^2)      — no clamp.
  // An equipotential surface is the level set { V = V0 }, extracted with
  // marching cubes. Normals come from the exact analytic gradient below,
  // so the shading involves no finite-difference approximation.
  function potential3D(x, y, z) {
    var v = 0;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var dx = x - c.x, dy = y, dz = z - c.y;
      var r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r < RMIN) r = RMIN;
      v += K * c.q / r;
    }
    return v;
  }

  // ∇V(x,y,z); grad(kq/r) = -k q r_vec / r^3.  Returns [gx,gy,gz].
  function gradient3D(x, y, z) {
    var gx = 0, gy = 0, gz = 0;
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var dx = x - c.x, dy = y, dz = z - c.y;
      var r2 = dx * dx + dy * dy + dz * dz;
      var r = Math.sqrt(r2);
      if (r < RMIN) r = RMIN;
      var s = -K * c.q / (r2 * r);   // = -kq / r^3
      gx += s * dx; gy += s * dy; gz += s * dz;
    }
    return [gx, gy, gz];
  }

  // ---- DOM ------------------------------------------------------------
  var c2 = document.getElementById("canvas2d");
  var x2 = c2.getContext("2d");
  var c3 = document.getElementById("canvas3d");

  var qSel = document.getElementById("qSel");
  var qSelVal = document.getElementById("qSelVal");
  var clearAll = document.getElementById("clearAll");
  var levels = document.getElementById("levels");
  var lvlVal = document.getElementById("lvlVal");
  var tLines = document.getElementById("tLines");
  var tEquip = document.getElementById("tEquip");
  var reset = document.getElementById("reset");

  // 3D view-mode controls
  var vSurface = document.getElementById("vSurface");
  var vEquipot = document.getElementById("vEquipot");
  var shells = document.getElementById("shells");
  var shellsVal = document.getElementById("shellsVal");
  var tZero = document.getElementById("tZero");
  var equipCtrl = document.getElementById("equipCtrl");
  var surf3dTitle = document.getElementById("surf3dTitle");
  var surf3dSub = document.getElementById("surf3dSub");
  var surf3dLegend = document.getElementById("surf3dLegend");

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
  var TRAY = 56;   // px height of the charge tray (palette) below the field

  // world(-1..1) -> screen for the field area (excludes the tray strip)
  function w2s(wx, wy) {
    var m = 18, fh = dim2.h - TRAY;
    return {
      x: m + (wx + 1) / 2 * (dim2.w - 2 * m),
      y: m + (wy + 1) / 2 * (fh - 2 * m)
    };
  }
  function s2w(sx, sy) {
    var m = 18, fh = dim2.h - TRAY;
    return {
      x: (sx - m) / (dim2.w - 2 * m) * 2 - 1,
      y: (sy - m) / (fh - 2 * m) * 2 - 1
    };
  }

  // ---- 2D rendering ---------------------------------------------------
  // Offscreen buffer: the heat-map is rendered per-pixel at reduced
  // resolution, then scaled up with bilinear smoothing — no visible blocks.
  var heat = document.createElement("canvas");
  var heatX = heat.getContext("2d");

  function draw2D(coarse) {
    var w = dim2.w, h = dim2.h, fh = h - TRAY;
    x2.clearRect(0, 0, w, h);

    x2.save();
    x2.beginPath(); x2.rect(0, 0, w, fh); x2.clip();   // field area only

    // background potential heat-map. Colour uses a smooth tanh
    // compression (colour is inherently bounded even though V is not).
    var scale = coarse ? 8 : 3;
    var hw = Math.max(2, Math.round(w / scale));
    var hh = Math.max(2, Math.round(fh / scale));
    heat.width = hw; heat.height = hh;
    var img = heatX.createImageData(hw, hh);
    var data = img.data;
    var idx = 0;
    for (var py = 0; py < hh; py++) {
      var sy = (py + 0.5) * fh / hh;
      for (var px = 0; px < hw; px++) {
        var wc = s2w((px + 0.5) * w / hw, sy);
        var col = potColor(potentialAt(wc.x, wc.y));
        data[idx++] = col[0]; data[idx++] = col[1]; data[idx++] = col[2]; data[idx++] = 255;
      }
    }
    heatX.putImageData(img, 0, 0);
    x2.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in x2) x2.imageSmoothingQuality = "high";
    x2.drawImage(heat, 0, 0, hw, hh, 0, 0, w, fh);

    drawGrid2D();
    if (settings.showEquip) drawEquipotentials(coarse);
    if (settings.showLines) drawFieldLines();
    x2.restore();

    drawTray();
    drawCharges2D();   // after the tray, so a dragged charge shows on top
  }

  // ---- charge tray (palette): drag a template into the field to add ----
  function trayPos(i) {
    return { x: 64 + i * 46, y: dim2.h - TRAY / 2 };
  }

  function drawTray() {
    var w = dim2.w, fh = dim2.h - TRAY;
    x2.fillStyle = "#fafaf8";
    x2.fillRect(0, fh, w, TRAY);
    x2.strokeStyle = "#d9d9d4"; x2.lineWidth = 1;
    x2.beginPath(); x2.moveTo(0, fh + 0.5); x2.lineTo(w, fh + 0.5); x2.stroke();

    x2.fillStyle = "#646464"; x2.font = "12px Inter, sans-serif";
    x2.textAlign = "left"; x2.textBaseline = "middle";
    x2.fillText("Add:", 16, dim2.h - TRAY / 2);
    drawChargeMarker(trayPos(0).x, trayPos(0).y, 5, 12, false, 1);
    drawChargeMarker(trayPos(1).x, trayPos(1).y, -5, 12, false, 1);
    x2.fillStyle = "#646464";
    x2.fillText("drag into the field · drag a charge out of the field to remove it",
                136, dim2.h - TRAY / 2);
  }

  // faint reference grid over the heat-map
  function drawGrid2D() {
    x2.lineWidth = 1;
    for (var i = -4; i <= 4; i++) {
      var v = i / 4;
      x2.strokeStyle = i === 0 ? "rgba(17,17,17,0.10)" : "rgba(17,17,17,0.045)";
      var a = w2s(v, -1), b = w2s(v, 1);
      x2.beginPath(); x2.moveTo(a.x, a.y); x2.lineTo(b.x, b.y); x2.stroke();
      var c = w2s(-1, v), d = w2s(1, v);
      x2.beginPath(); x2.moveTo(c.x, c.y); x2.lineTo(d.x, d.y); x2.stroke();
    }
  }

  function potColor(v) {
    var t = Math.tanh(v * 0.7);           // -1 .. 1, honest but bounded for colour
    var u;
    if (t >= 0) {
      u = Math.pow(t, 0.8) * 0.6;                             // gentle, capped ramp
      return [255 - u * 8, 255 - u * 150, 255 - u * 148];     // toward soft red
    }
    u = Math.pow(-t, 0.8) * 0.6;
    return [255 - u * 160, 255 - u * 92, 255 - u * 8];        // toward soft blue
  }

  function drawEquipotentials(coarse) {
    var N = coarse ? 80 : 130;
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
    var nSrc = 0;
    for (var s0 = 0; s0 < charges.length; s0++) {
      if (charges[s0].q !== 0 && (hasPos ? charges[s0].q > 0 : charges[s0].q < 0)) nSrc++;
    }
    if (!nSrc) return;
    // fixed total line budget so many-charge presets stay readable & fast
    var nSeed = Math.max(4, Math.round(28 / nSrc)), seedR = 0.09;
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

  // one charge marker: circle + glyph (+/−), optional selection ring
  function drawChargeMarker(px, py, q, r, isSel, alpha) {
    x2.globalAlpha = alpha;
    x2.beginPath();
    x2.arc(px, py, r, 0, Math.PI * 2);
    x2.fillStyle = q > 0 ? COL.posFill : (q < 0 ? COL.negFill : "#9a9a9a");
    x2.fill();
    x2.lineWidth = 2.5; x2.strokeStyle = "#fff"; x2.stroke();
    x2.strokeStyle = "#fff"; x2.lineWidth = 2.6; x2.lineCap = "round";
    x2.beginPath();
    x2.moveTo(px - r * 0.5, py); x2.lineTo(px + r * 0.5, py);
    if (q > 0) { x2.moveTo(px, py - r * 0.5); x2.lineTo(px, py + r * 0.5); }
    x2.stroke();
    if (isSel) {
      x2.beginPath();
      x2.arc(px, py, r + 4.5, 0, Math.PI * 2);
      x2.lineWidth = 1.6; x2.strokeStyle = "rgba(17,17,17,0.55)";
      x2.setLineDash([4, 3]);
      x2.stroke();
      x2.setLineDash([]);
    }
    x2.globalAlpha = 1;
  }

  function drawCharges2D() {
    var base = charges.length > 6 ? 9 : 12;   // smaller markers when crowded
    for (var i = 0; i < charges.length; i++) {
      var c = charges[i];
      var p = w2s(c.x, c.y);
      var r = base + Math.min(9, Math.abs(c.q)) * 0.7;
      // outside the field -> ghosted: releasing here removes the charge
      var out = Math.abs(c.x) > 1 || Math.abs(c.y) > 1;
      drawChargeMarker(p.x, p.y, c.q, r, i === selected, out ? 0.45 : 1);
    }
  }

  // ---- 3D: honest potential surface via THREE.js ----------------------
  var THREE = window.THREE;
  var renderer, scene, camera, surfMesh, baseGeo, baseA, baseB, colorAttr, chargeDots = [], dotGeo;
  var wireGeo, wireLines, wireN = 44;  // surface-following mesh lines (rows/cols)
  var equipotGroup;                    // holds the equipotential-surface meshes
  var groundGrid;                      // reference grid on the charge plane
  var GRID_N = 200;                    // fine grid -> spikes stay thin
  var HEIGHT = 0.32;                   // height per unit V (no ceiling applied)
  var BG3D = 0xf3f5f9;                 // light background, matches the page theme
  var orbit = { yaw: -0.6, pitch: 0.62, radius: 3.3 };
  var dirty = true;
  var chargeDragging = false;          // true while a charge is being dragged

  // sampling box for the 3-D field (scene units): x,z in +/-BXZ, y in +/-BY
  var BXZ = 1.5, BY = 1.15;
  var RES_IDLE = 66, RES_DRAG = 44;    // grid points along x/z (idle vs. dragging)

  function init3D() {
    renderer = new THREE.WebGLRenderer({ canvas: c3, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(BG3D, 1);

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(BG3D, 4.5, 11);   // edges melt into the background
    camera = new THREE.PerspectiveCamera(48, 1, 0.01, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe5ee, 0.72));
    var dl = new THREE.DirectionalLight(0xffffff, 0.5);
    dl.position.set(2.5, 5, 2); scene.add(dl);
    var dl2 = new THREE.DirectionalLight(0xbcd0ff, 0.15);
    dl2.position.set(-3, 2, -2); scene.add(dl2);

    // faint reference ground grid at V = 0 (the plane the charges sit on)
    groundGrid = new THREE.GridHelper(2, 20, 0xb9c2d0, 0xdde3ec);
    groundGrid.position.y = 0; scene.add(groundGrid);

    // potential surface
    baseGeo = new THREE.PlaneGeometry(2, 2, GRID_N, GRID_N);
    var pos = baseGeo.attributes.position, cnt = pos.count;
    baseA = new Float32Array(cnt); baseB = new Float32Array(cnt);
    for (var i = 0; i < cnt; i++) { baseA[i] = pos.getX(i); baseB[i] = pos.getY(i); }
    colorAttr = new THREE.BufferAttribute(new Float32Array(cnt * 3), 3);
    baseGeo.setAttribute("color", colorAttr);
    var mat = new THREE.MeshPhongMaterial({
      vertexColors: true, side: THREE.DoubleSide,
      shininess: 26, specular: 0x445261, flatShading: false
    });
    surfMesh = new THREE.Mesh(baseGeo, mat);
    scene.add(surfMesh);

    // light "graph paper" lines draped over the surface (rows + columns only,
    // no triangle diagonals) — gives the surface structure on the light bg
    wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute("position",
      new THREE.BufferAttribute(new Float32Array(2 * wireN * (wireN + 1) * 2 * 3), 3));
    wireLines = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({
      color: 0x64748b, transparent: true, opacity: 0.22
    }));
    scene.add(wireLines);

    // group that will hold the equipotential isosurface shells (built on demand)
    equipotGroup = new THREE.Group();
    equipotGroup.visible = false;
    scene.add(equipotGroup);

    // charge marker dots sitting on the base plane (synced to charge list)
    dotGeo = new THREE.SphereGeometry(0.035, 16, 16);
    syncDots3D();

    applyView3D();       // set initial visibility for the chosen mode
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

  // keep one 3D dot per charge (list length can change at runtime)
  function syncDots3D() {
    while (chargeDots.length < charges.length) {
      var dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      scene.add(dot); chargeDots.push(dot);
    }
    while (chargeDots.length > charges.length) {
      var old = chargeDots.pop();
      scene.remove(old); old.material.dispose();
    }
  }

  // Rebuild surface heights + colours from the honest potential (no clamp).
  function build3D() {
    syncDots3D();
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

    // update the draped mesh lines (lifted slightly to avoid z-fighting)
    var LIFT = 0.004;
    var wp = wireGeo.attributes.position.array, o = 0, N = wireN;
    for (var j = 0; j <= N; j++) {
      var gy = -1 + 2 * j / N;
      for (var gi = 0; gi < N; gi++) {
        var x0 = -1 + 2 * gi / N, x1 = -1 + 2 * (gi + 1) / N;
        wp[o++] = x0; wp[o++] = potentialAt(x0, gy) * HEIGHT + LIFT; wp[o++] = gy;
        wp[o++] = x1; wp[o++] = potentialAt(x1, gy) * HEIGHT + LIFT; wp[o++] = gy;
      }
    }
    for (var gi2 = 0; gi2 <= N; gi2++) {
      var gx = -1 + 2 * gi2 / N;
      for (var j2 = 0; j2 < N; j2++) {
        var y0 = -1 + 2 * j2 / N, y1 = -1 + 2 * (j2 + 1) / N;
        wp[o++] = gx; wp[o++] = potentialAt(gx, y0) * HEIGHT + LIFT; wp[o++] = y0;
        wp[o++] = gx; wp[o++] = potentialAt(gx, y1) * HEIGHT + LIFT; wp[o++] = y1;
      }
    }
    wireGeo.attributes.position.needsUpdate = true;

    for (var d = 0; d < chargeDots.length; d++) {
      chargeDots[d].position.set(charges[d].x, 0.02, charges[d].y);
      chargeDots[d].material.color.set(charges[d].q >= 0 ? COL.posFill : COL.negFill);
      chargeDots[d].visible = charges[d].q !== 0;
    }
  }

  // colour ramp (light theme): blue (well) -> paper white (V=0) -> red (peak);
  // tips deepen (rather than lighten) so extremes stay visible on the light bg
  function surfColor(t) {
    var mid = [0.965, 0.965, 0.96];
    if (t >= 0) {
      var hot = [1.0, 0.45, 0.40], deep = [0.72, 0.13, 0.12];
      var u = Math.pow(t, 0.55);
      var r = lerp3(mid, hot, u);
      if (t > 0.75) r = lerp3(r, deep, (t - 0.75) / 0.25);
      return r;
    } else {
      var cold = [0.42, 0.65, 1.0], abyss = [0.10, 0.26, 0.62];
      var a = Math.pow(-t, 0.55);
      var b = lerp3(mid, cold, a);
      if (-t > 0.75) b = lerp3(b, abyss, (-t - 0.75) / 0.25);
      return b;
    }
  }
  function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // ---- 3D: true equipotential SURFACES (isosurfaces of V in space) -----
  // Choose the iso-values as a geometric ladder. For a lone charge V0 sits on
  // a sphere of radius r = k|q|/V0, so a geometric ladder in V0 gives shells
  // that are pleasantly spread in radius from ~0.14 out to ~1.25.
  function equipotLevels(M) {
    var qmax = 0;
    for (var i = 0; i < charges.length; i++) qmax = Math.max(qmax, Math.abs(charges[i].q));
    if (qmax === 0) return [];
    var Vhi = K * qmax / 0.14;     // innermost shell (small sphere near a charge)
    var Vlo = K * qmax / 1.25;     // outermost shell (large sphere)
    if (Vlo >= Vhi) Vlo = Vhi * 0.5;
    var levels = [];
    if (M <= 1) { levels.push(Vhi); return levels; }
    var ratio = Math.pow(Vlo / Vhi, 1 / (M - 1));
    for (var k = 0; k < M; k++) levels.push(Vhi * Math.pow(ratio, k));  // descending
    return levels;
  }

  function makeShellMaterial(rgb, opacity) {
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
      transparent: true, opacity: opacity,
      side: THREE.DoubleSide, depthWrite: false,
      shininess: 55, specular: 0x556070
    });
  }

  // Build one isosurface mesh at value `iso`. Positions come from marching
  // cubes; per-vertex normals come from the EXACT analytic gradient ∇V, so
  // the smooth shading is honest (no finite-difference / faceting error).
  function addShell(field, nx, ny, nz, origin, spacing, iso, rgb, opacity) {
    var pos = window.MC.polygonize(field, nx, ny, nz, origin, spacing, iso);
    if (!pos) return;
    var n = pos.length;
    var nrm = new Float32Array(n);
    // outward normal: for a positive shell "outside" is lower V (normal = -∇V);
    // for a negative shell "outside" is higher V (normal = +∇V).
    var sgn = iso >= 0 ? -1 : 1;
    for (var i = 0; i < n; i += 3) {
      var g = gradient3D(pos[i], pos[i + 1], pos[i + 2]);
      var gx = g[0] * sgn, gy = g[1] * sgn, gz = g[2] * sgn;
      var len = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      nrm[i] = gx / len; nrm[i + 1] = gy / len; nrm[i + 2] = gz / len;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    equipotGroup.add(new THREE.Mesh(geo, makeShellMaterial(rgb, opacity)));
  }

  function clearEquipot() {
    for (var i = equipotGroup.children.length - 1; i >= 0; i--) {
      var m = equipotGroup.children[i];
      m.geometry.dispose(); m.material.dispose();
      equipotGroup.remove(m);
    }
  }

  function buildEquipot(res) {
    syncDots3D();
    updateChargeDots();
    clearEquipot();

    // grid: uniform spacing; fewer points in y (shorter axis)
    var nx = res, nz = res;
    var ny = Math.max(8, Math.round(res * BY / BXZ));
    var origin = [-BXZ, -BY, -BXZ];
    var spacing = [2 * BXZ / (nx - 1), 2 * BY / (ny - 1), 2 * BXZ / (nz - 1)];

    // sample the exact potential once; every shell reuses this field
    var field = new Float32Array(nx * ny * nz);
    var idx = 0;
    for (var iz = 0; iz < nz; iz++) {
      var z = origin[2] + iz * spacing[2];
      for (var iy = 0; iy < ny; iy++) {
        var y = origin[1] + iy * spacing[1];
        for (var ix = 0; ix < nx; ix++) {
          field[idx++] = potential3D(origin[0] + ix * spacing[0], y, z);
        }
      }
    }

    var M = settings.shells;
    var levels = equipotLevels(M);
    var deepRed = [0.80, 0.12, 0.12], liteRed = [1.0, 0.60, 0.55];
    var deepBlue = [0.09, 0.30, 0.75], liteBlue = [0.55, 0.75, 1.0];
    for (var k = 0; k < levels.length; k++) {
      var f = M > 1 ? k / (M - 1) : 0;        // 0 = innermost, 1 = outermost
      var op = 0.42 - 0.24 * f;               // inner shells a touch more solid
      var Lv = levels[k];
      addShell(field, nx, ny, nz, origin, spacing,  Lv, lerp3(deepRed, liteRed, f), op);
      addShell(field, nx, ny, nz, origin, spacing, -Lv, lerp3(deepBlue, liteBlue, f), op);
    }

    // optional V = 0 surface (e.g. the mid-plane of a balanced dipole)
    if (settings.showZero) {
      addShell(field, nx, ny, nz, origin, spacing, 0, [0.54, 0.60, 0.36], 0.20);
    }
  }

  // keep the charge dots in sync (position + colour) — shared by both modes
  function updateChargeDots() {
    for (var d = 0; d < chargeDots.length; d++) {
      chargeDots[d].position.set(charges[d].x, 0.02, charges[d].y);
      chargeDots[d].material.color.set(charges[d].q >= 0 ? COL.posFill : COL.negFill);
      chargeDots[d].visible = charges[d].q !== 0;
    }
  }

  // ---- switch between the two right-panel visualisations ----------------
  var SURF_TXT = {
    title: "3D potential surface (height = V, unclamped)",
    sub: "Drag to orbit · scroll to zoom. Spikes run off the top/bottom of the frame — that is the true 1/r singularity."
  };
  var EQ_TXT = {
    title: "Equipotential surfaces in 3D (level sets of V)",
    sub: "Drag to orbit · scroll to zoom."
  };

  function applyView3D() {
    var eq = settings.view3D === "equipot";
    if (surfMesh) surfMesh.visible = !eq;
    if (wireLines) wireLines.visible = !eq;
    if (equipotGroup) equipotGroup.visible = eq;

    if (surf3dTitle) surf3dTitle.textContent = (eq ? EQ_TXT : SURF_TXT).title;
    if (surf3dSub) surf3dSub.textContent = (eq ? EQ_TXT : SURF_TXT).sub;
    if (surf3dLegend) surf3dLegend.innerHTML = eq
      ? '<span><span class="swatch" style="background:#cc2020"></span>Positive equipotential (V &gt; 0)</span>' +
        '<span><span class="swatch" style="background:#4f8bff"></span>Negative equipotential (V &lt; 0)</span>' +
        '<span>Inner shell = higher |V| (closer to a charge)</span>'
      : '<span><span class="swatch" style="background:var(--pos)"></span>Higher potential (peak)</span>' +
        '<span><span class="swatch" style="background:var(--neg)"></span>Lower potential (well)</span>';

    if (vSurface) vSurface.setAttribute("aria-pressed", eq ? "false" : "true");
    if (vEquipot) vEquipot.setAttribute("aria-pressed", eq ? "true" : "false");
    if (vSurface) vSurface.classList.toggle("active", !eq);
    if (vEquipot) vEquipot.classList.toggle("active", eq);
    if (equipCtrl) equipCtrl.style.display = eq ? "" : "none";
  }

  function setView3D(mode) {
    if (settings.view3D === mode) return;
    settings.view3D = mode;
    applyView3D();
    dirty = true;   // trigger a rebuild of whichever representation is now active
  }

  function animate3D() {
    requestAnimationFrame(animate3D);
    if (dirty) {
      if (settings.view3D === "equipot") buildEquipot(chargeDragging ? RES_DRAG : RES_IDLE);
      else build3D();
      dirty = false;
    }
    // camera from spherical orbit around a point slightly above the plane
    // (centre on the plane itself when showing equipotential shells)
    var ty = settings.view3D === "equipot" ? 0.0 : 0.12;
    var tgt = new THREE.Vector3(0, ty, 0);
    var cp = Math.cos(orbit.pitch), sp = Math.sin(orbit.pitch);
    // flip the up vector past the poles so the view stays continuous
    camera.up.set(0, cp >= 0 ? 1 : -1, 0);
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
      orbit.pitch = drag.pitch + (t.clientY - drag.y) * 0.006;   // free 360° tumble
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
    if (e.button !== undefined && e.button !== 0) return;   // left button / touch only
    var p = pointer(e);
    // existing charges first (topmost wins)
    for (var i = charges.length - 1; i >= 0; i--) {
      var sp = w2s(charges[i].x, charges[i].y);
      var dx = p.x - sp.x, dy = p.y - sp.y;
      if (dx * dx + dy * dy < 24 * 24) {
        selected = i; dragging = i;
        syncQSlider(); draw2D();
        e.preventDefault(); return;
      }
    }
    // tray templates: grabbing one spawns a new charge that follows the pointer
    for (var t = 0; t < 2; t++) {
      var tp = trayPos(t);
      var dxt = p.x - tp.x, dyt = p.y - tp.y;
      if (dxt * dxt + dyt * dyt < 18 * 18) {
        var wc = s2w(p.x, p.y);
        charges.push({ x: wc.x, y: wc.y, q: t === 0 ? 5 : -5 });
        selected = charges.length - 1;
        dragging = selected;
        syncQSlider(); draw2D(true); dirty = true;
        e.preventDefault(); return;
      }
    }
  }
  function onMove(e) {
    if (dragging < 0) return;
    var p = pointer(e);
    var wc = s2w(p.x, p.y);
    charges[dragging].x = wc.x;   // unclamped — free to leave the field
    charges[dragging].y = wc.y;
    chargeDragging = true;        // lower-res 3D rebuild while dragging
    e.preventDefault();
    draw2D(true); dirty = true;   // coarse while dragging, for responsiveness
  }
  function onUp() {
    if (dragging < 0) return;
    var c = charges[dragging];
    if (Math.abs(c.x) > 1 || Math.abs(c.y) > 1) {
      // released outside the field -> remove (also cancels an un-dragged template click)
      charges.splice(dragging, 1);
      if (selected >= charges.length) selected = charges.length - 1;
      syncQSlider();
    } else {
      c.x = Math.max(-0.95, Math.min(0.95, c.x));
      c.y = Math.max(-0.95, Math.min(0.95, c.y));
    }
    dragging = -1;
    chargeDragging = false;
    refresh();   // full-quality redraw + high-res 3D update
  }
  c2.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  c2.addEventListener("touchstart", onDown, { passive: false });
  c2.addEventListener("touchmove", onMove, { passive: false });
  c2.addEventListener("touchend", onUp);

  // right-click a charge to delete it
  c2.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    var p = pointer(e);
    for (var i = charges.length - 1; i >= 0; i--) {
      var sp = w2s(charges[i].x, charges[i].y);
      var dx = p.x - sp.x, dy = p.y - sp.y;
      if (dx * dx + dy * dy < 24 * 24) {
        charges.splice(i, 1);
        if (selected >= charges.length) selected = charges.length - 1;
        syncQSlider(); refresh();
        return;
      }
    }
  });

  // ---- Charge management & presets -------------------------------------
  function refresh() { draw2D(); dirty = true; }

  function syncQSlider() {
    if (selected >= 0 && selected < charges.length) {
      qSel.value = charges[selected].q;
      qSelVal.textContent = fmt(charges[selected].q);
      qSel.disabled = false;
    } else {
      qSelVal.textContent = "–";
      qSel.disabled = true;
    }
  }

  var PRESETS = {
    dipole: [{ x: -0.45, y: 0, q: 5 }, { x: 0.45, y: 0, q: -5 }],
    like:   [{ x: -0.45, y: 0, q: 5 }, { x: 0.45, y: 0, q: 5 }],
    single: [{ x: 0, y: 0, q: 5 }],
    quad:   [{ x: -0.4, y: -0.4, q: 5 }, { x: 0.4, y: -0.4, q: -5 },
             { x: 0.4, y: 0.4, q: 5 }, { x: -0.4, y: 0.4, q: -5 }],
    // parallel-plate capacitor: two facing rows of point charges
    plates: (function () {
      var a = [], n = 8;
      for (var i = 0; i < n; i++) {
        var x = -0.66 + 1.32 * i / (n - 1);
        a.push({ x: x, y: -0.4, q: 3 });    // upper plate, positive
        a.push({ x: x, y: 0.4, q: -3 });    // lower plate, negative
      }
      return a;
    })()
  };

  function applyPreset(name) {
    charges = PRESETS[name].map(function (c) { return { x: c.x, y: c.y, q: c.q }; });
    selected = 0;
    syncQSlider(); refresh();
  }

  // ---- Controls -------------------------------------------------------
  function fmt(q) { return (q > 0 ? "+" : "") + q; }
  qSel.addEventListener("input", function () {
    if (selected < 0 || selected >= charges.length) return;
    charges[selected].q = +qSel.value;
    qSelVal.textContent = fmt(charges[selected].q);
    refresh();
  });
  clearAll.addEventListener("click", function () {
    charges = []; selected = -1; syncQSlider(); refresh();
  });
  [["pDipole", "dipole"], ["pLike", "like"], ["pSingle", "single"],
   ["pQuad", "quad"], ["pPlates", "plates"]].forEach(function (pair) {
    document.getElementById(pair[0]).addEventListener("click", function () {
      applyPreset(pair[1]);
    });
  });
  levels.addEventListener("input", function () {
    settings.levels = +levels.value; lvlVal.textContent = settings.levels; draw2D();
  });
  tLines.addEventListener("change", function () { settings.showLines = tLines.checked; draw2D(); });
  tEquip.addEventListener("change", function () { settings.showEquip = tEquip.checked; draw2D(); });

  // 3D view-mode controls
  if (vSurface) vSurface.addEventListener("click", function () { setView3D("surface"); });
  if (vEquipot) vEquipot.addEventListener("click", function () { setView3D("equipot"); });
  if (shells) shells.addEventListener("input", function () {
    settings.shells = +shells.value; shellsVal.textContent = settings.shells;
    if (settings.view3D === "equipot") dirty = true;
  });
  if (tZero) tZero.addEventListener("change", function () {
    settings.showZero = tZero.checked;
    if (settings.view3D === "equipot") dirty = true;
  });

  reset.addEventListener("click", function () {
    settings.levels = 10; levels.value = 10; lvlVal.textContent = "10";
    settings.shells = 5; if (shells) { shells.value = 5; shellsVal.textContent = "5"; }
    settings.showZero = false; if (tZero) tZero.checked = false;
    setView3D("surface");
    orbit.yaw = -0.6; orbit.pitch = 0.62; orbit.radius = 3.3;
    applyPreset("dipole");
  });

  // ---- Init / resize --------------------------------------------------
  function resizeAll() {
    dim2 = fit2d();
    draw2D();
    if (renderer) fit3d();
  }
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeAll, 120);   // debounced
  });

  dim2 = fit2d();
  draw2D();
  if (THREE) init3D();
})();
