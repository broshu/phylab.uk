/* ============================================================
   AR Electric Field · beta 2 — plane-only rewrite
   ------------------------------------------------------------
   Printed barcode cards lie flat on a horizontal desk. All cards
   are printed the same size; the card edge d is the unit of length.

     barcode 0 / 6   +q point charge  → floats 2d above its card
     barcode 1 / 7   −q point charge  → floats 2d above its card
     barcode 4       +2q plate        → 4d×4d board upright on the card
     barcode 5       −2q plate        → 4d×4d board upright on the card

   Anti-jitter ("lock once"):
     While scanning, every card's pose is low-pass filtered. Once the
     set of visible cards has been steady for ~1.2 s, the layout is
     frozen into one rigid desk frame and all geometry is built
     exactly once. Afterwards the cards are only used to recover the
     CAMERA pose: each visible card gives one (noisy) estimate of the
     desk frame; the estimates are averaged and smoothed over time.
     The field's shape can never wobble — only the viewpoint moves.

   Equipotential view hides the camera image: only the charges, field
   lines and equipotential surfaces remain, floating in dark space.
   The viewpoint keeps following the camera via the cards; when no
   card is in sight it falls back to the device gyroscope (if the
   user grants motion permission — otherwise the view simply holds).
   ============================================================ */
(function () {
'use strict';

/* ---------------- configuration ---------------- */
var Q = new URLSearchParams(location.search);
function num (k, d) { var v = parseFloat(Q.get(k)); return isFinite(v) ? v : d; }

var CFG = {
  lift: 2,                                   // charge height above the desk (×d)
  plateSide: 4,                              // plate edge length (×d)
  plateQ: 2,                                 // plate |charge| in units of q
  plateGrid: 13,                             // plate modelled as N×N sub-charges
  linesPerQ: Math.round(num('lines', 16)),   // field lines per unit of charge
  tubeR: 0.02,                               // field-line tube radius
  smooth: num('smooth', 0.12),               // anchor low-pass (lower = steadier)
  autolock: num('autolock', 1) !== 0,
  isoN: Math.round(num('grid', 46)),         // equipotential sampling resolution
  isoPerSign: Math.round(num('iso', 4)),     // equipotential levels per sign
  demo: Q.get('demo')
};

var COL = {
  pos: '#e0442e', neg: '#2f7cd6', posFill: '#e04333', negFill: '#2f7cd6',
  arrow: '#d9931b', grid: '#8a9a5b', zero: '#8b93a3'
};

var UP = new THREE.Vector3(0, 1, 0);
function V3 (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); }

function clearGroup (g) {
  for (var i = g.children.length - 1; i >= 0; i--) {
    var o = g.children[i];
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    g.remove(o);
  }
}

/* ================= pose maths ================= */

/* eigenvector of the smallest eigenvalue of a symmetric 3×3 (cyclic Jacobi) */
function smallestEigenvector (m) {
  var a = [m[0].slice(), m[1].slice(), m[2].slice()];
  var v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (var sweep = 0; sweep < 16; sweep++) {
    if (Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]) < 1e-12) break;
    for (var p = 0; p < 2; p++) for (var q = p + 1; q < 3; q++) {
      if (Math.abs(a[p][q]) < 1e-14) continue;
      var th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
      var c = Math.cos(th), s = Math.sin(th), k, x, y;
      for (k = 0; k < 3; k++) { x = a[k][p]; y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (k = 0; k < 3; k++) { x = a[p][k]; y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (k = 0; k < 3; k++) { x = v[k][p]; y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; }
    }
  }
  var d = [a[0][0], a[1][1], a[2][2]];
  var mi = d[0] <= d[1] ? (d[0] <= d[2] ? 0 : 2) : (d[1] <= d[2] ? 1 : 2);
  return V3(v[0][mi], v[1][mi], v[2][mi]).normalize();
}

/* Rigid desk frame from the observed cards: origin = centroid,
   +Y = desk normal (PCA of positions when ≥3 cards, else averaged card normals). */
function deskFrame (obs) {
  var o = V3(), up = V3(), i;
  for (i = 0; i < obs.length; i++) { o.add(obs[i].p); up.add(obs[i].up); }
  o.multiplyScalar(1 / obs.length); up.normalize();
  var n = up.clone();
  if (obs.length >= 3) {
    var C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], d = V3();
    for (i = 0; i < obs.length; i++) {
      d.subVectors(obs[i].p, o);
      var e = [d.x, d.y, d.z];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) C[r][c] += e[r] * e[c];
    }
    var pca = smallestEigenvector(C);
    if (pca.dot(up) < 0) pca.negate();
    if (pca.dot(up) > 0.5) n = pca;      // ignore PCA when cards are ~collinear
  }
  var ref = Math.abs(n.y) < 0.9 ? V3(0, 1, 0) : V3(1, 0, 0);
  var x = V3().crossVectors(ref, n).normalize();
  var z = V3().crossVectors(x, n).normalize();
  return new THREE.Matrix4().makeBasis(x, n, z).setPosition(o);
}

/* average several {p, q} pose estimates into one */
function averagePose (ests, outP, outQ) {
  outP.set(0, 0, 0);
  var acc = null, i, e, s;
  for (i = 0; i < ests.length; i++) {
    e = ests[i]; outP.add(e.p);
    if (!acc) acc = e.q.clone();
    else {
      s = acc.dot(e.q) < 0 ? -1 : 1;
      acc.x += s * e.q.x; acc.y += s * e.q.y; acc.z += s * e.q.z; acc.w += s * e.q.w;
    }
  }
  outP.multiplyScalar(1 / ests.length);
  outQ.copy(acc.normalize());
}

/* ================= physics (k = q = d = 1) ================= */

/* items → point-charge elements; a plate becomes a uniform N×N sheet
   of sub-charges with total charge ±plateQ */
function expandElements (items) {
  var els = [], i, it;
  for (i = 0; i < items.length; i++) {
    it = items[i];
    if (it.type === 'plate') {
      var n = CFG.plateGrid, qs = CFG.plateQ * it.q / (n * n);
      for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) {
        var sx = -it.half + 2 * it.half * a / (n - 1);
        var sy = it.side * b / (n - 1);
        els.push({ p: it.base.clone().addScaledVector(it.ux, sx).addScaledVector(UP, sy), q: qs });
      }
    } else els.push({ p: it.pos, q: it.q });
  }
  return els;
}

function fieldAt (p, els, out) {
  out.set(0, 0, 0);
  for (var i = 0; i < els.length; i++) {
    var e = els[i], dx = p.x - e.p.x, dy = p.y - e.p.y, dz = p.z - e.p.z;
    var r2 = dx * dx + dy * dy + dz * dz + 1e-9;
    var f = e.q / (r2 * Math.sqrt(r2));
    out.x += dx * f; out.y += dy * f; out.z += dz * f;
  }
  return out;
}

function potentialAt (x, y, z, els) {
  var V = 0;
  for (var i = 0; i < els.length; i++) {
    var e = els[i], dx = x - e.p.x, dy = y - e.p.y, dz = z - e.p.z;
    V += e.q / Math.sqrt(dx * dx + dy * dy + dz * dz + 1e-9);
  }
  return V;
}

/* ---- exact potential of a uniformly charged rectangle ----
   V = kσ ∬ dA/r has the closed form Σ± [ u·ln(v+r) + v·ln(u+r) − w·atan(uv/(w·r)) ]
   over the four corners. Finite everywhere (even on the sheet itself), so the
   potential relief and the isosurfaces carry no sub-charge graininess. */
var _rv = new THREE.Vector3();
function rectV (x, y, z, pl) {
  var d = _rv.set(x, y, z).sub(pl.base);
  var a = d.dot(pl.ux), b = d.dot(UP), w = d.dot(pl.n);
  var sigma = CFG.plateQ * pl.q / (2 * pl.half * pl.side);
  var u1 = -pl.half - a, u2 = pl.half - a, v1 = -b, v2 = pl.side - b;
  function F (u, v) {
    var r = Math.sqrt(u * u + v * v + w * w);
    /* NB: plain atan, not atan2. atan2(uv, wr) lands on the wrong branch
       when w < 0, adding a spurious 4πσ|w| inside the prism behind the
       plate — it rendered as huge blocky "slabs" in the shell view.
       r ≥ |w| > 0 whenever w ≠ 0, so the division is safe. */
    return u * Math.log(Math.max(v + r, 1e-12)) +
           v * Math.log(Math.max(u + r, 1e-12)) -
           (w === 0 ? 0 : w * Math.atan(u * v / (w * r)));
  }
  return sigma * (F(u2, v2) - F(u1, v2) - F(u2, v1) + F(u1, v1));
}

/* potential of the whole layout: exact point charges + exact plates */
function potentialItems (x, y, z, items) {
  var V = 0;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.type === 'plate') V += rectV(x, y, z, it);
    else {
      var dx = x - it.pos.x, dy = y - it.pos.y, dz = z - it.pos.z;
      V += it.q / Math.sqrt(dx * dx + dy * dy + dz * dz + 1e-9);
    }
  }
  return V;
}

/* distance from a point to a (finite) plate rectangle */
function plateDistance (p, pl) {
  var d = V3().subVectors(p, pl.base);
  var a = Math.max(-pl.half, Math.min(pl.half, d.dot(pl.ux)));
  var b = Math.max(0, Math.min(pl.side, d.dot(UP)));
  return p.distanceTo(pl.base.clone().addScaledVector(pl.ux, a).addScaledVector(UP, b));
}

/* scene extent: centre + max pairwise spread of the key points */
function metrics (items) {
  var pts = [], i, it;
  for (i = 0; i < items.length; i++) {
    it = items[i];
    if (it.type === 'plate') {
      [[-it.half, 0], [it.half, 0], [-it.half, it.side], [it.half, it.side]].forEach(function (c) {
        pts.push(it.base.clone().addScaledVector(it.ux, c[0]).addScaledVector(UP, c[1]));
      });
    } else pts.push(it.pos);
  }
  var c = V3(); pts.forEach(function (p) { c.add(p); }); c.multiplyScalar(1 / pts.length);
  var spread = 0;
  for (i = 0; i < pts.length; i++) for (var j = i + 1; j < pts.length; j++)
    spread = Math.max(spread, pts[i].distanceTo(pts[j]));
  return { center: c, spread: spread };
}

/* one field line — RK4 on the normalised direction field */
function traceLine (seed, els, dir, opt) {
  var pts = [seed.clone()], p = seed.clone(), h = 0.05;
  var E = V3(), k1 = V3(), k2 = V3(), k3 = V3(), k4 = V3(), t = V3();
  function slope (from, into) {
    fieldAt(from, els, E);
    var l = E.length(); if (l < 1e-9) return false;
    into.copy(E).multiplyScalar(dir / l); return true;
  }
  for (var i = 0; i < opt.maxSteps; i++) {
    if (!slope(p, k1)) break;
    if (!slope(t.copy(p).addScaledVector(k1, h / 2), k2)) break;
    if (!slope(t.copy(p).addScaledVector(k2, h / 2), k3)) break;
    if (!slope(t.copy(p).addScaledVector(k3, h), k4)) break;
    p.addScaledVector(k1, h / 6).addScaledVector(k2, h / 3).addScaledVector(k3, h / 3).addScaledVector(k4, h / 6);
    pts.push(p.clone());
    var stop = false, j;
    for (j = 0; j < opt.stopPts.length && !stop; j++) if (p.distanceTo(opt.stopPts[j]) < 0.14) stop = true;
    for (j = 0; j < opt.stopPlates.length && !stop; j++) if (plateDistance(p, opt.stopPlates[j]) < 0.1) stop = true;
    if (stop || p.distanceTo(opt.center) > opt.maxR) break;
  }
  return pts;
}

/* evenly spread seeds on a small sphere (Fibonacci lattice) */
function sphereSeeds (c, r, n) {
  var seeds = [], ga = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < n; i++) {
    var y = 1 - 2 * i / (n - 1), rr = Math.sqrt(Math.max(0, 1 - y * y)), t = ga * i;
    seeds.push(V3(c.x + r * Math.cos(t) * rr, c.y + r * y, c.z + r * Math.sin(t) * rr));
  }
  return seeds;
}

/* seeds spread uniformly over BOTH faces of a plate */
function plateSeeds (pl, perFace) {
  var m = Math.max(2, Math.round(Math.sqrt(perFace))), seeds = [];
  for (var i = 0; i < m; i++) for (var j = 0; j < m; j++) {
    var sx = -pl.half + 2 * pl.half * (i + 0.5) / m;
    var sy = pl.side * (j + 0.5) / m;
    var b = pl.base.clone().addScaledVector(pl.ux, sx).addScaledVector(UP, sy);
    seeds.push(b.clone().addScaledVector(pl.n, 0.1));
    seeds.push(b.clone().addScaledVector(pl.n, -0.1));
  }
  return seeds;
}

/* ================= visual builders ================= */

function addTube (group, pts, cFrom, cTo) {
  if (pts.length < 2) return;
  var curve = new THREE.CatmullRomCurve3(pts);
  var seg = Math.min(160, Math.max(12, pts.length));
  /* soft halo underlay (normal blending so it reads on light backgrounds) */
  var glow = new THREE.TubeGeometry(curve, seg, CFG.tubeR * 2.5, 6, false);
  var gcol = new THREE.Color(cFrom).lerp(new THREE.Color(cTo), 0.5);
  group.add(new THREE.Mesh(glow, new THREE.MeshBasicMaterial({
    color: gcol, transparent: true, opacity: 0.16, depthWrite: false
  })));
  /* crisp core with a colour gradient from source to sink */
  var geo = new THREE.TubeGeometry(curve, seg, CFG.tubeR, 6, false);
  var pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
  var A = new THREE.Color(cFrom), B = new THREE.Color(cTo), ring = 7;
  for (var i = 0; i < pos.count; i++) {
    var t = Math.floor(i / ring) / Math.max(1, pos.count / ring);
    var c = A.clone().lerp(B, Math.min(1, t));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true })));
}

/* direction cones along a traced line (dir = −1 means the trace ran against E) */
function addArrows (group, pts, dir) {
  [0.35, 0.7].forEach(function (f) {
    var i = Math.min(pts.length - 2, Math.max(0, Math.floor(f * (pts.length - 1))));
    var d = V3().subVectors(pts[i + 1], pts[i]).multiplyScalar(dir);
    if (d.lengthSq() < 1e-10) return;
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 10),
      new THREE.MeshBasicMaterial({ color: COL.arrow }));
    cone.position.copy(pts[i]);
    cone.quaternion.setFromUnitVectors(UP, d.normalize());
    group.add(cone);
  });
}

/* camera-facing ± disk */
function chargeSprite (q, size) {
  var cv = document.createElement('canvas'); cv.width = cv.height = 128;
  var g = cv.getContext('2d');
  g.fillStyle = q > 0 ? COL.posFill : COL.negFill;
  g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.moveTo(36, 64); g.lineTo(92, 64);
  if (q > 0) { g.moveTo(64, 36); g.lineTo(64, 92); }
  g.stroke();
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
  sp.renderOrder = 999; sp.scale.set(size, size, 1);
  return sp;
}

/* field lines for the whole frozen layout.
   Scientific conventions: the number of lines is proportional to |q|
   (16 per unit charge), lines leave + charges radially / plates
   perpendicular to their faces, and end on − charges/plates or run
   out of the picture.
   Lines are traced FORWARD from every + item and BACKWARD from every
   − item. A backward trace that lands on a + item retraces a forward
   line and is skipped — what survives are the lines that arrive at −
   from outside the picture (the far half of every big dipole loop),
   so − items are dressed as fully as + ones. */
function buildFieldLines (items, els, group) {
  clearGroup(group);
  if (!items.length) return;
  var hasPos = items.some(function (i) { return i.q > 0; });
  var hasNeg = items.some(function (i) { return i.q < 0; });
  var mixed = hasPos && hasNeg;
  var m = metrics(items);
  var maxR = mixed ? m.spread * 3 + 4 : m.spread + 3;
  var maxSteps = mixed ? 2600 : 700;

  function stopsAgainst (sign) {   // items of the opposite sign terminate a trace
    var st = { pts: [], plates: [] };
    items.forEach(function (it) {
      if (it.q * sign < 0) (it.type === 'plate' ? st.plates.push(it) : st.pts.push(it.pos));
    });
    return st;
  }
  function nearStop (p, st) {
    var i;
    for (i = 0; i < st.pts.length; i++) if (p.distanceTo(st.pts[i]) < 0.2) return true;
    for (i = 0; i < st.plates.length; i++) if (plateDistance(p, st.plates[i]) < 0.16) return true;
    return false;
  }

  items.forEach(function (src) {
    var dir = src.q > 0 ? 1 : -1;                 // − items are traced against E
    var st = stopsAgainst(src.q);
    var opt = { center: m.center, maxR: maxR, maxSteps: maxSteps,
      stopPts: st.pts, stopPlates: st.plates };
    var cA = src.q > 0 ? COL.pos : COL.neg;
    var cB = mixed ? (src.q > 0 ? COL.neg : COL.pos) : cA;
    var seeds = src.type === 'plate'
      ? plateSeeds(src, CFG.linesPerQ * CFG.plateQ / 2)
      : sphereSeeds(src.pos, 0.18, CFG.linesPerQ);
    seeds.forEach(function (s) {
      var pts = traceLine(s, els, dir, opt);
      if (pts.length < 4) return;
      if (dir < 0 && mixed && nearStop(pts[pts.length - 1], st)) return;   // duplicate of a forward line
      addTube(group, pts, cA, cB);
      addArrows(group, pts, dir);
    });
  });
}

/* translucent plate boards + ± sprites */
function buildPlates (items, group) {
  clearGroup(group);
  items.forEach(function (it) {
    if (it.type !== 'plate') return;
    var col = it.q > 0 ? COL.posFill : COL.negFill;
    var geo = new THREE.PlaneGeometry(2 * it.half, it.side);
    var basis = new THREE.Matrix4().makeBasis(it.ux, UP, it.n);
    var quat = new THREE.Quaternion().setFromRotationMatrix(basis);
    var centre = it.base.clone().addScaledVector(UP, it.side / 2);
    var face = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    face.position.copy(centre); face.quaternion.copy(quat); group.add(face);
    var edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
    edge.position.copy(centre); edge.quaternion.copy(quat); group.add(edge);
    var sp = chargeSprite(it.q, 0.4); sp.position.copy(centre); group.add(sp);
  });
}

/* ± sprites at the point charges */
function buildGlyphs (items, group) {
  clearGroup(group);
  items.forEach(function (it) {
    if (it.type === 'plate') return;
    var sp = chargeSprite(it.q, 0.34); sp.position.copy(it.pos); group.add(sp);
  });
}

/* desk-level cues (hidden in equipotential view): a dot on each card
   and a faint stem up to its floating charge */
function buildCards (items, group) {
  clearGroup(group);
  items.forEach(function (it) {
    var col = it.q > 0 ? COL.posFill : COL.negFill;
    var dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10),
      new THREE.MeshBasicMaterial({ color: col }));
    dot.position.copy(it.base).setY(0.01); group.add(dot);
    if (it.type === 'charge') {
      var geo = new THREE.BufferGeometry().setFromPoints([dot.position.clone(), it.pos]);
      group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.5 })));
    }
  });
}

/* ---- equipotential surfaces: marching tetrahedra over a sampled V grid ----
   Levels are at EQUAL potential steps (±Vmax·i/n), so closely packed
   shells mean a strong field — the standard textbook convention. */
var TETS = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
var CUBE = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];

function polyTet (P, Vv, t, iso, out) {
  var idx = 0;
  if (Vv[t[0]] < iso) idx |= 1;
  if (Vv[t[1]] < iso) idx |= 2;
  if (Vv[t[2]] < iso) idx |= 4;
  if (Vv[t[3]] < iso) idx |= 8;
  if (idx === 0 || idx === 15) return;
  function e (a, b) {
    var va = Vv[t[a]], vb = Vv[t[b]], pa = P[t[a]], pb = P[t[b]];
    var s = (iso - va) / (vb - va);
    return [pa[0] + s * (pb[0] - pa[0]), pa[1] + s * (pb[1] - pa[1]), pa[2] + s * (pb[2] - pa[2])];
  }
  function tri (a, b, c) { out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
  var a1, b1;
  switch (idx) {
    case 1: case 14: tri(e(0, 1), e(0, 2), e(0, 3)); break;
    case 2: case 13: tri(e(1, 0), e(1, 3), e(1, 2)); break;
    case 3: case 12: a1 = e(0, 3); b1 = e(1, 2); tri(a1, e(0, 2), b1); tri(a1, b1, e(1, 3)); break;
    case 4: case 11: tri(e(2, 0), e(2, 1), e(2, 3)); break;
    case 5: case 10: a1 = e(0, 1); b1 = e(2, 3); tri(a1, b1, e(0, 3)); tri(a1, e(1, 2), b1); break;
    case 6: case 9:  a1 = e(0, 1); b1 = e(2, 3); tri(a1, e(1, 3), b1); tri(a1, b1, e(0, 2)); break;
    case 7: case 8:  tri(e(3, 0), e(3, 2), e(3, 1)); break;
  }
}

function marchTets (vals, G, org, step, iso) {
  var out = [], P = new Array(8), Vv = new Array(8), c, gi;
  for (var k = 0; k < G - 1; k++) for (var j = 0; j < G - 1; j++) for (var i = 0; i < G - 1; i++) {
    var lo = Infinity, hi = -Infinity;
    for (c = 0; c < 8; c++) {
      gi = (i + CUBE[c][0]) + G * ((j + CUBE[c][1]) + G * (k + CUBE[c][2]));
      Vv[c] = vals[gi];
      if (Vv[c] < lo) lo = Vv[c];
      if (Vv[c] > hi) hi = Vv[c];
    }
    if (iso < lo || iso > hi) continue;
    for (c = 0; c < 8; c++) {
      P[c] = [org[0] + (i + CUBE[c][0]) * step, org[1] + (j + CUBE[c][1]) * step, org[2] + (k + CUBE[c][2]) * step];
    }
    for (c = 0; c < 6; c++) polyTet(P, Vv, TETS[c], iso, out);
  }
  return new Float32Array(out);
}

function buildIsoSurfaces (items, els, group) {
  clearGroup(group);
  if (!items.length) return;
  var m = metrics(items);
  var R = Math.min(6.5, Math.max(3.2, m.spread * 0.8 + 2.6));
  var N = CFG.isoN, G = N + 1, step = 2 * R / N;
  var org = [m.center.x - R, m.center.y - R, m.center.z - R];
  var vals = new Float32Array(G * G * G), n = 0;
  for (var k = 0; k < G; k++) for (var j = 0; j < G; j++) for (var i = 0; i < G; i++)
    vals[n++] = potentialItems(org[0] + i * step, org[1] + j * step, org[2] + k * step, items);

  var hasPos = items.some(function (it) { return it.q > 0; });
  var hasNeg = items.some(function (it) { return it.q < 0; });
  var Vmax = 1.4, levels = [];
  for (var L = 1; L <= CFG.isoPerSign; L++) {
    var v = Vmax * L / CFG.isoPerSign;
    if (hasPos) levels.push(v);
    if (hasNeg) levels.push(-v);
  }
  if (hasPos && hasNeg) levels.push(0);   // the V = 0 surface of a dipole

  levels.forEach(function (lvl) {
    var tris = marchTets(vals, G, org, step, lvl);
    if (!tris.length) return;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(tris, 3));
    /* analytic normals: an equipotential is everywhere ⊥ E, so n ∝ ∇V = −E */
    var nrm = new Float32Array(tris.length), p = V3(), E = V3();
    for (var vi = 0; vi < tris.length; vi += 3) {
      p.set(tris[vi], tris[vi + 1], tris[vi + 2]);
      fieldAt(p, els, E).normalize();
      nrm[vi] = -E.x; nrm[vi + 1] = -E.y; nrm[vi + 2] = -E.z;
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    var t = Math.abs(lvl) / Vmax;
    var color = lvl === 0 ? new THREE.Color(COL.zero)
      : lvl > 0 ? new THREE.Color('#e8825f').lerp(new THREE.Color('#c62817'), t)
                : new THREE.Color('#7fa9e8').lerp(new THREE.Color('#1a53c0'), t);
    var mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      color: color, transparent: true, opacity: lvl === 0 ? 0.12 : 0.16 + 0.16 * t,
      side: THREE.DoubleSide, depthWrite: false, shininess: 60
    }));
    mesh.renderOrder = Math.round(10 * t);   // inner (stronger) shells drawn last
    group.add(mesh);
  });
}

/* ---- potential relief (the beta-1 idea, made rigorous) ----
   The desk plane is lifted to h(x,z) = V(x, lift, z) — the TRUE potential
   (exact point charges + exact rectangle plates) sampled in the horizontal
   plane THROUGH the floating charges (y = lift = 2d), mapped 1:1 into
   height: one unit of kq/d is one card-edge d of height. In that plane a
   point charge is a genuine ±q/ρ singularity, so + charges rise as sharp
   peaks and − charges fall as deep funnels. (Sampling on the desk itself
   was wrong for point charges: 2d below a charge V is only q/2d ≈ 0.5 —
   a barely visible mound with no tip at all.) NO clipping, no scaling,
   no smoothing: this is AR, a spike is allowed to run right off the
   screen — the shape IS the potential, 1:1 (one kq/d = one card-edge d).
   Only the COLOUR ramp saturates at the highest contour level, otherwise
   the singular vertex would wash every other colour out.
   Contour rings are drawn every ΔV = 0.1 kq/d; because h = V they sit at
   exactly 0.1 d height steps, a live topographic map of V. */

/* marching squares: segments of the level set V = L on a G×G grid */
function contourSegments (V, G, x0, z0, step, L) {
  var segs = [];
  function ip (va, vb, pa, pb) {
    var t = (L - va) / (vb - va);
    return [pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1])];
  }
  for (var j = 0; j < G - 1; j++) for (var i = 0; i < G - 1; i++) {
    var x = x0 + i * step, z = z0 + j * step;
    var v00 = V[j * G + i], v10 = V[j * G + i + 1];
    var v01 = V[(j + 1) * G + i], v11 = V[(j + 1) * G + i + 1];
    var b00 = v00 > L, b10 = v10 > L, b01 = v01 > L, b11 = v11 > L;
    if (b00 === b10 && b10 === b11 && b11 === b01) continue;
    var p00 = [x, z], p10 = [x + step, z], p01 = [x, z + step], p11 = [x + step, z + step];
    var pts = [];
    if (b00 !== b10) pts.push(ip(v00, v10, p00, p10));
    if (b10 !== b11) pts.push(ip(v10, v11, p10, p11));
    if (b01 !== b11) pts.push(ip(v01, v11, p01, p11));
    if (b00 !== b01) pts.push(ip(v00, v01, p00, p01));
    for (var k = 0; k + 1 < pts.length; k += 2) segs.push(pts[k], pts[k + 1]);
  }
  return segs;
}

function buildHeightSurface (items, group) {
  clearGroup(group);
  if (!items.length) return;
  var m = metrics(items);
  var S = Math.min(6, Math.max(3, m.spread * 0.75 + 2.2));
  var x0 = m.center.x - S, z0 = m.center.z - S;
  var N = 120, G = N + 1, step = 2 * S / N;
  var yS = CFG.lift;                     // sample plane through the floating charges
  var V = new Float32Array(G * G), maxAbs = 1e-9, i, j, n;
  for (j = 0, n = 0; j < G; j++) for (i = 0; i < G; i++, n++) {
    var v = potentialItems(x0 + i * step, yS, z0 + j * step, items);
    V[n] = v;
    if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
  }

  /* the relief mesh: height IS the potential (1:1), coloured by signed V */
  var pos = new Float32Array(G * G * 3), col = new Float32Array(G * G * 3);
  var cNeut = new THREE.Color('#ded7c4'), cPos = new THREE.Color('#c62817'), cNeg = new THREE.Color('#1a53c0');
  var cScale = Math.min(maxAbs, 3);      // colour saturates at the top contour (30 × 0.1)
  for (j = 0, n = 0; j < G; j++) for (i = 0; i < G; i++, n++) {
    var t = Math.max(-1, Math.min(1, V[n] / cScale));
    pos[n * 3] = x0 + i * step;
    pos[n * 3 + 1] = V[n] + 0.01;
    pos[n * 3 + 2] = z0 + j * step;
    var c = t >= 0 ? cNeut.clone().lerp(cPos, Math.pow(t, 0.6))
                   : cNeut.clone().lerp(cNeg, Math.pow(-t, 0.6));
    col[n * 3] = c.r; col[n * 3 + 1] = c.g; col[n * 3 + 2] = c.b;
  }
  var idx = [];
  for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
    var a = j * G + i, b = a + 1, c2 = a + G, d2 = c2 + 1;
    idx.push(a, c2, b, b, c2, d2);
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.92, shininess: 24 })));

  /* contour rings every ΔV = 0.1 kq/d (= 0.1 d of height), plus V = 0 */
  var hasPos = items.some(function (it) { return it.q > 0; });
  var hasNeg = items.some(function (it) { return it.q < 0; });
  var lines = [];
  function ring (L) {
    var ss = contourSegments(V, G, x0, z0, step, L);
    for (var k = 0; k < ss.length; k++) lines.push(new THREE.Vector3(ss[k][0], L + 0.02, ss[k][1]));
  }
  var dV = 0.1, nLev = Math.min(30, Math.floor(maxAbs / dV));
  for (var lev = 1; lev <= nLev; lev++) {
    if (hasPos) ring(lev * dV);
    if (hasNeg) ring(-lev * dV);
  }
  if (hasPos && hasNeg) ring(0);
  if (lines.length) {
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines),
      new THREE.LineBasicMaterial({ color: '#3a453e', transparent: true, opacity: 0.55 })));
  }

  /* no drop lines any more: the potential is sampled in the charges' own
     plane, so each charge sits exactly on (in fact inside) its own spike —
     the peak/funnel itself marks the spot. A drop line to the unclipped
     singular vertex would just be a kilometre-long stray segment. */
}

/* faint desk grid (demo mode only — in AR the real desk is visible) */
function buildDeskGrid (group) {
  clearGroup(group);
  var pts = [];
  for (var i = -4; i <= 4; i++) {
    pts.push(V3(i, 0, -4), V3(i, 0, 4), V3(-4, 0, i), V3(4, 0, i));
  }
  var geo = new THREE.BufferGeometry().setFromPoints(pts);
  group.add(new THREE.LineSegments(geo,
    new THREE.LineBasicMaterial({ color: COL.grid, transparent: true, opacity: 0.4 })));
}

/* ================= device-orientation fallback ================= */
var Gyro = {
  q: null, ref: null, refM: null, tried: false,
  _q0: new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2),
  _z: new THREE.Vector3(0, 0, 1),
  enable: function () {
    if (this.tried) return;
    this.tried = true;
    var attach = function () { window.addEventListener('deviceorientation', Gyro._on, true); };
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(function (s) { if (s === 'granted') attach(); })
        .catch(function () { /* not allowed — the view simply holds still */ });
    } else attach();
  },
  _on: function (e) {
    if (e.alpha == null) return;
    var d = Math.PI / 180;
    var eu = new THREE.Euler(e.beta * d, e.alpha * d, -e.gamma * d, 'YXZ');
    var so = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * d;
    Gyro.q = new THREE.Quaternion().setFromEuler(eu).multiply(Gyro._q0)
      .multiply(new THREE.Quaternion().setFromAxisAngle(Gyro._z, -so));
  }
};

/* ================= the A-Frame component ================= */
AFRAME.registerComponent('efield-ar', {
  init: function () {
    this.demo = !!CFG.demo;
    this.photo = this.el.hasAttribute && this.el.hasAttribute('data-photo');
    this.locked = false;
    this.items = null; this.els = null; this.anchors = [];
    this.show = { field: true, pot: false, hgt: false };
    this.isoBuilt = false;

    /* the anchor carries ALL frozen content; only its matrix is rewritten */
    this.anchor = new THREE.Group();
    this.anchor.matrixAutoUpdate = false;
    this.el.object3D.add(this.anchor);
    var G = function () { return new THREE.Group(); };
    this.gCards = G(); this.gField = G(); this.gIso = G(); this.gHgt = G();
    this.gGlyph = G(); this.gPlate = G(); this.gDesk = G();
    var self = this;
    [this.gCards, this.gField, this.gIso, this.gHgt, this.gGlyph, this.gPlate, this.gDesk]
      .forEach(function (g) { self.anchor.add(g); });
    this.gIso.visible = false;
    this.gHgt.visible = false;
    this.gLive = G(); this.el.object3D.add(this.gLive);     // scan-phase preview dots

    this.anchor.add(new THREE.AmbientLight(0xffffff, 0.75));
    var dl = new THREE.DirectionalLight(0xffffff, 0.65);
    dl.position.set(2, 5, 2); this.anchor.add(dl);

    this._p = V3(); this._q = new THREE.Quaternion(); this._s = V3(1, 1, 1);
    this.scan = {};                       // barcode value → smoothed card pose
    this._stableCount = -1; this._stableSince = 0;
    this._flash = ''; this._flashUntil = 0;
    this.statusEl = document.getElementById('status');

    this.markers = Array.prototype.slice.call(this.el.querySelectorAll('a-marker'));
    this.bindUI();
    if (this.photo) this.bindOrbit();     // a photo can't move — the mouse replaces the iPad
    if (this.demo) this.setupDemo();
  },

  /* ---------- photo-test orbit: drag = look around, wheel/pinch = dolly ----------
     The photo is static, so the marker-derived pose never changes. The orbit is
     an extra rigid transform premultiplied onto the tracked anchor each frame:
     yaw spins the frozen scene about its own desk normal, pitch tilts it about
     the screen's horizontal axis, both through the layout centre. Physics and
     the lock pipeline are untouched. */
  bindOrbit: function () {
    var self = this, ptrs = new Map(), lastPinch = 0;
    this.orbit = { yaw: 0, pitch: 0, dolly: 0 };
    function onUI (t) { return t && t.closest && t.closest('#controls, #gate, #legend'); }
    window.addEventListener('pointerdown', function (e) {
      if (onUI(e.target)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    window.addEventListener('pointermove', function (e) {
      if (!ptrs.has(e.pointerId) || !self.locked) return;
      var p = ptrs.get(e.pointerId);
      if (ptrs.size === 1) {
        self.orbit.yaw -= (e.clientX - p.x) * 0.006;
        self.orbit.pitch = Math.max(-1.35, Math.min(1.35, self.orbit.pitch + (e.clientY - p.y) * 0.005));
      }
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) {
        var a = Array.from(ptrs.values());
        var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (lastPinch) self.orbit.dolly += (d - lastPinch) * 0.01;
        lastPinch = d;
      }
    });
    var end = function (e) { ptrs.delete(e.pointerId); if (ptrs.size < 2) lastPinch = 0; };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('wheel', function (e) {
      if (self.locked) self.orbit.dolly -= e.deltaY * 0.004;
    }, { passive: true });
    window.addEventListener('dblclick', function () {
      self.orbit.yaw = 0; self.orbit.pitch = 0; self.orbit.dolly = 0;
    });
  },

  applyOrbit: function () {
    var o = this.orbit;
    if (!o || (!o.yaw && !o.pitch && !o.dolly) || !this._pivot) return;
    var base = this.anchor.matrix;
    var P = this._pivot.clone().applyMatrix4(base);      // pivot: layout centre, world
    var deskY = V3(base.elements[4], base.elements[5], base.elements[6]).normalize();
    var R = new THREE.Matrix4().makeRotationAxis(V3(1, 0, 0), o.pitch)
      .multiply(new THREE.Matrix4().makeRotationAxis(deskY, o.yaw));
    var O = new THREE.Matrix4().makeTranslation(P.x, P.y, P.z)
      .multiply(R)
      .multiply(new THREE.Matrix4().makeTranslation(-P.x, -P.y, -P.z));
    var len = P.length() || 1;                           // dolly along the view ray, clamped
    var d = Math.max(-2.5 * len, Math.min(0.6 * len, o.dolly));
    O.premultiply(new THREE.Matrix4().makeTranslation(-P.x * d / len, -P.y * d / len, -P.z * d / len));
    this.anchor.matrix.premultiply(O);
    this.anchor.matrixWorldNeedsUpdate = true;
  },

  /* ---------- UI ---------- */
  bindUI: function () {
    var self = this;
    function on (id, fn) {
      var el = document.getElementById(id); if (!el) return;
      var h = function (e) { e.preventDefault(); e.stopPropagation(); fn(); };
      el.addEventListener('click', h);
      el.addEventListener('touchend', h, { passive: false });
    }
    on('lockBtn', function () { Gyro.enable(); self.locked ? self.rescan() : self.lock(); });
    on('t-field', function () {
      if (!self.locked) return;
      self.show.field = !self.show.field;
      self.gField.visible = self.show.field;
      document.getElementById('t-field').classList.toggle('on', self.show.field);
    });
    on('t-pot', function () {
      if (!self.locked) return;
      Gyro.enable();                       // user gesture → motion permission prompt
      self.show.pot = !self.show.pot;
      if (self.show.pot && self.show.hgt) {          // Shells ⟷ Relief: mutually exclusive
        self.show.hgt = false;
        self.gHgt.visible = false;
        var hb = document.getElementById('t-hgt');
        if (hb) hb.classList.remove('on');
      }
      if (self.show.pot && !self.isoBuilt) {
        self.flash('Computing equipotential surfaces…');
        setTimeout(function () {
          buildIsoSurfaces(self.items, self.els, self.gIso);
          self.isoBuilt = true;
          self.applyPotView();
        }, 30);
      } else self.applyPotView();
    });
    on('t-hgt', function () {
      if (!self.locked) return;
      self.show.hgt = !self.show.hgt;
      if (self.show.hgt && self.show.pot) {          // Relief ⟷ Shells: mutually exclusive
        self.show.pot = false;
        self.applyPotView();                         // hides shells, restores the camera view
      }
      self.gHgt.visible = self.show.hgt;
      document.getElementById('t-hgt').classList.toggle('on', self.show.hgt);
    });
    this.refreshUI();
  },

  /* equipotential view: hide the camera image (and desk cues) — only the
     charges, field lines and equipotential shells stay, in dark space */
  applyPotView: function () {
    var pot = this.show.pot;
    this.gIso.visible = pot;
    this.gCards.visible = !pot;
    this.gDesk.visible = !pot && this.demo;
    document.body.classList.toggle('space', pot);
    /* the AR source is #arjs-video: a <video> (webcam) or an <img> (photo test) */
    document.querySelectorAll('#arjs-video, video, body > img').forEach(function (el) {
      el.style.visibility = pot ? 'hidden' : 'visible';
    });
    var b = document.getElementById('t-pot');
    if (b) b.classList.toggle('on', pot);
  },

  refreshUI: function () {
    var lb = document.getElementById('lockBtn');
    if (lb) {
      lb.style.display = this.demo ? 'none' : '';
      lb.querySelector('.ic').textContent = this.locked ? '↻' : '🔒';
      lb.querySelector('.lab').textContent = this.locked ? 'Re-scan' : 'Lock now';
      lb.classList.toggle('locked', this.locked);
    }
    var self = this;
    ['t-field', 't-pot', 't-hgt'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('disabled', !self.locked);
    });
    var f = document.getElementById('t-field');
    if (f) f.classList.toggle('on', this.show.field && this.locked);
    var p = document.getElementById('t-pot');
    if (p) p.classList.toggle('on', this.show.pot);
    var h = document.getElementById('t-hgt');
    if (h) h.classList.toggle('on', this.show.hgt);
  },

  flash: function (msg) { this._flash = msg; this._flashUntil = performance.now() + 2000; },

  /* ---------- scan phase: low-pass every visible card's pose ---------- */
  updateScan: function () {
    for (var i = 0; i < this.markers.length; i++) {
      var el = this.markers[i], o = el.object3D;
      if (!o.visible) continue;
      o.updateMatrixWorld(true);
      var p = V3(), q = new THREE.Quaternion(), s = V3();
      o.matrixWorld.decompose(p, q, s);
      var rec = this.scan[el.dataset.value];
      if (!rec) this.scan[el.dataset.value] = { el: el, p: p, q: q };
      else {
        rec.p.lerp(p, 0.25);
        if (rec.q.dot(q) < 0) { q.set(-q.x, -q.y, -q.z, -q.w); }
        rec.q.slerp(q, 0.25);
      }
    }
  },

  visibleRecs: function () {
    var out = [];
    for (var k in this.scan) if (this.scan[k].el.object3D.visible) out.push(this.scan[k]);
    return out;
  },

  previewDots: function (recs) {
    while (this.gLive.children.length < recs.length) {
      this.gLive.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), new THREE.MeshBasicMaterial()));
    }
    for (var i = 0; i < this.gLive.children.length; i++) {
      var d = this.gLive.children[i];
      d.visible = i < recs.length;
      if (d.visible) {
        d.position.copy(recs[i].p);
        d.material.color.set(+recs[i].el.dataset.q > 0 ? COL.posFill : COL.negFill);
      }
    }
  },

  /* ---------- lock: freeze the layout, build everything once ---------- */
  lock: function () {
    var recs = this.visibleRecs();
    if (!recs.length) { this.flash('No cards in view — point the camera at them first'); return; }

    var obs = recs.map(function (r) {
      return { p: r.p, up: V3(0, 1, 0).applyQuaternion(r.q) };
    });
    var M = deskFrame(obs);
    /* sanity: a real desk frame sits some distance from the camera — a
       near-origin frame means degenerate detections, refuse to freeze them */
    if (V3().setFromMatrixPosition(M).length() < 0.15) { this.flash('Hold steady…'); return; }
    var Minv = M.clone().invert();
    var rot = new THREE.Matrix4().extractRotation(Minv);

    /* card poses → charge/plate items in the rigid desk frame */
    var items = [];
    recs.forEach(function (r) {
      var lp = r.p.clone().applyMatrix4(Minv); lp.y = 0;      // card sits on the desk
      var q = parseFloat(r.el.dataset.q);
      if (r.el.dataset.kind === 'plate') {
        var ux = V3(1, 0, 0).applyQuaternion(r.q).applyMatrix4(rot);
        ux.y = 0;
        if (ux.lengthSq() < 1e-6) ux.set(1, 0, 0);
        ux.normalize();
        items.push({ type: 'plate', q: q, base: lp, ux: ux,
          n: V3().crossVectors(ux, UP).normalize(),
          half: CFG.plateSide / 2, side: CFG.plateSide });
      } else {
        items.push({ type: 'charge', q: q, base: lp, pos: lp.clone().setY(CFG.lift) });
      }
    });

    /* per-card offset K = cardWorld⁻¹·M — replayed each frame to re-estimate
       the desk frame's pose from whichever cards are visible */
    this.anchors = recs.map(function (r) {
      var W = new THREE.Matrix4().compose(r.p, r.q, V3(1, 1, 1));
      return { el: r.el, K: W.invert().multiply(M) };
    });

    this.items = items;
    this.els = expandElements(items);
    /* photo-orbit pivot: the layout centre on the desk, raised 2d — the
       height where the charges float — so the scene turns about them */
    var mc = metrics(items).center;
    this._pivot = V3(mc.x, CFG.lift, mc.z);
    this.locked = true;
    this.isoBuilt = false;
    M.decompose(this._p, this._q, this._s); this._s.set(1, 1, 1);
    this.anchor.matrix.copy(M);
    this.anchor.matrixWorldNeedsUpdate = true;
    if (Gyro.q) { Gyro.ref = Gyro.q.clone(); Gyro.refM = this.anchor.matrix.clone(); }

    this.buildAll();
    clearGroup(this.gLive);
    this.refreshUI();
    var nc = items.filter(function (i) { return i.type === 'charge'; }).length;
    var np = items.length - nc;
    this.flash('Locked · ' + (nc ? nc + ' charge' + (nc > 1 ? 's' : '') : '') +
      (nc && np ? ' + ' : '') + (np ? np + ' plate' + (np > 1 ? 's' : '') : '') + ' · move around');
  },

  buildAll: function () {
    buildFieldLines(this.items, this.els, this.gField);
    buildPlates(this.items, this.gPlate);
    buildGlyphs(this.items, this.gGlyph);
    buildCards(this.items, this.gCards);
    buildHeightSurface(this.items, this.gHgt);
    this.gField.visible = this.show.field;
    this.gHgt.visible = this.show.hgt;
    if (this.show.pot) { buildIsoSurfaces(this.items, this.els, this.gIso); this.isoBuilt = true; }
  },

  rescan: function () {
    this.locked = false;
    this.items = null; this.els = null; this.anchors = [];
    this.scan = {}; this._stableCount = -1; this._stableSince = 0;
    this.show.pot = false; this.show.hgt = false; this.gHgt.visible = false;
    this.applyPotView();
    [this.gField, this.gIso, this.gHgt, this.gGlyph, this.gPlate, this.gCards]
      .forEach(function (g) { clearGroup(g); });
    this.refreshUI();
  },

  /* ---------- locked phase: recover ONE pose from all visible cards ---------- */
  trackAnchor: function () {
    var ests = [];
    for (var i = 0; i < this.anchors.length; i++) {
      var a = this.anchors[i], o = a.el.object3D;
      if (!o.visible) continue;
      o.updateMatrixWorld(true);
      var E = o.matrixWorld.clone().multiply(a.K);
      var p = V3(), q = new THREE.Quaternion(), s = V3();
      E.decompose(p, q, s);
      ests.push({ p: p, q: q });
    }
    if (ests.length) {
      var tp = V3(), tq = new THREE.Quaternion();
      averagePose(ests, tp, tq);
      this._p.lerp(tp, CFG.smooth);        // low-pass: marker noise cancels out
      this._q.slerp(tq, CFG.smooth);
      this.anchor.matrix.compose(this._p, this._q, this._s);
      this.anchor.matrixWorldNeedsUpdate = true;
      if (Gyro.q) { Gyro.ref = Gyro.q.clone(); Gyro.refM = this.anchor.matrix.clone(); }
    } else if (Gyro.q && Gyro.ref && Gyro.refM) {
      /* no card in sight → rotate the last known anchor by the camera's own
         rotation since then (gyro), so the view keeps following the device */
      var dq = Gyro.q.clone().invert().multiply(Gyro.ref);
      this.anchor.matrix.copy(new THREE.Matrix4().makeRotationFromQuaternion(dq).multiply(Gyro.refM));
      this.anchor.matrixWorldNeedsUpdate = true;
      this.anchor.matrix.decompose(this._p, this._q, this._s); this._s.set(1, 1, 1);
    }
    if (this.photo) this.applyOrbit();
    return ests.length;
  },

  tick: function (time) {
    if (this.demo) { this.demoTick(time); return; }
    var msg;
    if (!this.locked) {
      this.updateScan();
      var recs = this.visibleRecs();
      this.previewDots(recs);
      if (CFG.autolock) {
        if (recs.length !== this._stableCount) { this._stableCount = recs.length; this._stableSince = time; }
        else if (recs.length > 0 && time - this._stableSince > 1200) this.lock();
      }
      msg = recs.length
        ? recs.length + ' card' + (recs.length > 1 ? 's' : '') + ' in view — hold steady to lock…'
        : 'Point the camera at the printed cards…';
    } else {
      var seen = this.trackAnchor();
      msg = this.photo
        ? 'Locked · photo test — drag to orbit, scroll/pinch to zoom, double-tap to reset'
        : seen
          ? 'Locked · tracking ' + seen + ' card' + (seen > 1 ? 's' : '')
          : (Gyro.ref ? 'Locked · gyro view — show a card to re-anchor'
                      : 'Locked · point back at the cards to track');
    }
    var shown = (this._flash && performance.now() < this._flashUntil) ? this._flash : msg;
    if (this.statusEl && this.statusEl.textContent !== shown) this.statusEl.textContent = shown;
  },

  /* ---------- desktop demo (no camera): ?demo=dipole|like|plates|mixed ---------- */
  setupDemo: function () {
    var layouts = {
      dipole: [{ t: 'c', q: 1, x: -1.5 }, { t: 'c', q: -1, x: 1.5 }],
      like:   [{ t: 'c', q: 1, x: -1.5 }, { t: 'c', q: 1, x: 1.5 }],
      plates: [{ t: 'p', q: 1, x: -1.2 }, { t: 'p', q: -1, x: 1.2 }],
      mixed:  [{ t: 'c', q: 1, x: -2 },   { t: 'p', q: -1, x: 1.4 }]
    };
    var lay = layouts[CFG.demo] || layouts.dipole;
    this.items = lay.map(function (s) {
      if (s.t === 'c') return { type: 'charge', q: s.q, base: V3(s.x, 0, 0), pos: V3(s.x, CFG.lift, 0) };
      var ux = V3(0, 0, 1);
      return { type: 'plate', q: s.q, base: V3(s.x, 0, 0), ux: ux,
        n: V3().crossVectors(ux, UP).normalize(), half: CFG.plateSide / 2, side: CFG.plateSide };
    });
    this.els = expandElements(this.items);
    this.locked = true;
    this.anchor.matrix.identity(); this.anchor.matrixWorldNeedsUpdate = true;
    this.buildAll();
    buildDeskGrid(this.gDesk);
    this.refreshUI();

    var cam = { th: 0.6, ph: 0.32, r: 8.5 };
    this.cam = cam;
    var drag = null;
    window.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('#controls')) return;
      drag = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      cam.th -= (e.clientX - drag.x) * 0.008;
      cam.ph = Math.max(-1.2, Math.min(1.45, cam.ph + (e.clientY - drag.y) * 0.006));
      drag = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', function () { drag = null; });
    window.addEventListener('wheel', function (e) {
      cam.r = Math.max(3, Math.min(20, cam.r + e.deltaY * 0.01));
    }, { passive: true });
  },

  demoTick: function (time) {
    var cam3 = this.el.camera;
    if (!cam3) return;
    var c = this.cam, tgt = V3(0, 1.2, 0);
    cam3.position.set(
      tgt.x + c.r * Math.cos(c.ph) * Math.sin(c.th),
      tgt.y + c.r * Math.sin(c.ph),
      tgt.z + c.r * Math.cos(c.ph) * Math.cos(c.th));
    cam3.lookAt(tgt);
    var msg = (this._flash && performance.now() < this._flashUntil) ? this._flash
      : 'Demo · drag to orbit, scroll to zoom · layouts: ?demo=dipole / like / plates / mixed';
    if (this.statusEl && this.statusEl.textContent !== msg) this.statusEl.textContent = msg;
  }
});

/* ================= scene bootstrap ================= */
var MARKS = [
  { v: 0, kind: 'charge', q: 1 }, { v: 1, kind: 'charge', q: -1 },
  { v: 6, kind: 'charge', q: 1 }, { v: 7, kind: 'charge', q: -1 },
  { v: 4, kind: 'plate', q: 1 },  { v: 5, kind: 'plate', q: -1 }
];

/* kind: 'ar' (webcam) · 'photo' (a still image runs through the SAME AR
   pipeline — for testing without a camera) · 'demo' (no AR at all).
   Built with insertAdjacentHTML so the elements are parser-created with all
   attributes in place before the custom elements upgrade (exactly like the
   static markup A-Frame and AR.js are developed against). */
function makeScene (kind, photo) {
  var R = ' renderer="logarithmicDepthBuffer: true; precision: medium; antialias: true; alpha: true"';
  var html;
  if (kind === 'demo') {
    html = '<a-scene embedded vr-mode-ui="enabled: false"' + R + ' efield-ar>' +
      '<a-entity camera="fov: 48" look-controls="enabled: false" wasd-controls="enabled: false"></a-entity>' +
      '</a-scene>';
  } else {
    var src = kind === 'photo'
      ? 'sourceType: image; sourceUrl: ' + photo.url +
        '; sourceWidth: ' + photo.w + '; sourceHeight: ' + photo.h +
        '; displayWidth: ' + photo.w + '; displayHeight: ' + photo.h
      : 'sourceType: webcam; sourceWidth: 1024; sourceHeight: 768; displayWidth: 1024; displayHeight: 768';
    var markers = MARKS.map(function (m) {
      return '<a-marker type="barcode" value="' + m.v + '"' +
        ' data-kind="' + m.kind + '" data-q="' + m.q + '" data-value="' + m.v + '"' +
        ' smooth="true" smoothCount="5" smoothTolerance="0.01" smoothThreshold="2"></a-marker>';
    }).join('');
    html = '<a-scene embedded vr-mode-ui="enabled: false"' + R +
      (kind === 'photo' ? ' data-photo="1"' : '') +
      ' arjs="' + src + '; detectionMode: mono_and_matrix; matrixCodeType: 3x3; patternRatio: 0.5; ' +
      'labelingMode: black_region; maxDetectionRate: 60; debugUIEnabled: false"' +
      ' efield-ar>' + markers + '<a-entity camera></a-entity></a-scene>';
  }
  document.body.insertAdjacentHTML('beforeend', html);
  return document.body.lastElementChild;
}

if (typeof document !== 'undefined' && document.addEventListener) {
  /* surface any runtime error in the status pill — AR bugs on iPads are
     otherwise invisible (no console at hand) */
  window.addEventListener('error', function (e) {
    var st = document.getElementById('status');
    if (st && e.message) st.textContent = '⚠ ' + e.message;
  });

  document.addEventListener('DOMContentLoaded', function () {
    var gate = document.getElementById('gate');
    if (!gate) return;
    if (CFG.demo) {
      gate.classList.add('hidden');
      document.body.classList.add('demo');
      makeScene('demo');
      return;
    }
    var kicks = function () {
      var kick = function () { window.dispatchEvent(new Event('resize')); };
      setTimeout(kick, 300); setTimeout(kick, 1200);
    };
    document.getElementById('startBtn').addEventListener('click', function () {
      var s = makeScene('ar');
      var reveal = function () { gate.classList.add('hidden'); };
      setTimeout(reveal, 1500);   // fallback if the video event never fires
      s.addEventListener('arjs-video-loaded', function () { reveal(); kicks(); });
      s.addEventListener('camera-error', function () {
        var st = document.getElementById('status');
        if (st) st.textContent = 'Camera unavailable — check permission & HTTPS';
        reveal();
      });
    });

    /* photo test: the uploaded picture becomes the AR camera feed — the
       detection, lock and rendering pipeline is exactly the live one */
    var pBtn = document.getElementById('photoBtn'), pFile = document.getElementById('photoFile');
    if (pBtn && pFile) {
      pBtn.addEventListener('click', function (e) { e.preventDefault(); pFile.click(); });
      pFile.addEventListener('change', function () {
        var f = pFile.files && pFile.files[0];
        if (!f) return;
        var img = new Image();
        img.onload = function () {
          var sc = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
          var cv = document.createElement('canvas');
          cv.width = Math.round(img.naturalWidth * sc);
          cv.height = Math.round(img.naturalHeight * sc);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          cv.toBlob(function (blob) {
            makeScene('photo', { url: URL.createObjectURL(blob), w: cv.width, h: cv.height });
            gate.classList.add('hidden');
            document.body.classList.add('photo');
            kicks();
          }, 'image/jpeg', 0.92);
        };
        img.src = URL.createObjectURL(f);
      });
    }
  });
}

/* test hook (used by the node test-suite; harmless in the browser) */
if (typeof window !== 'undefined') {
  window.__EF = {
    CFG: CFG, expandElements: expandElements, fieldAt: fieldAt, potentialAt: potentialAt,
    rectV: rectV, potentialItems: potentialItems, contourSegments: contourSegments,
    plateDistance: plateDistance, traceLine: traceLine, sphereSeeds: sphereSeeds,
    plateSeeds: plateSeeds, metrics: metrics, marchTets: marchTets,
    deskFrame: deskFrame, averagePose: averagePose, smallestEigenvector: smallestEigenvector
  };
}
})();
