import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {C, WORLD} from './constants.js?v=20261021-4';

// Scene colours follow the site palette (light paper / dark slate). Physics colours keep
// one meaning in both: blue = jet thrust, amber = friction, ink dashes = toward the centre.
const PALETTES = {
  light: {bg:'#f4f1e8', ground:'#ebe6d8', grid:'#d6d0bf', ice:'#d3e4e9', iceEdge:'#8fb1bd', asphalt:'#5a625c', kerbA:'#2f5d4f', kerbB:'#faf8f1',
    lane:'#faf8f1', mark:'#62695f', paint:'#b7354a', glass:'#9fbfcc', thrust:'#2468a6', friction:'#94620e', radial:'#1c2b25', jet:'#86aac2',
    trail:'#2f5d4f', slip:'#b7354a', cone:'#d9822b', fence:'#9a9482', hemiSky:'#fffaf0', hemiGround:'#b8b09c', sun:'#fff6e6'},
  dark: {bg:'#14181b', ground:'#191e21', grid:'#273035', ice:'#3a5560', iceEdge:'#7398a6', asphalt:'#2c3235', kerbA:'#9ccbb4', kerbB:'#3a4540',
    lane:'#c9d2cc', mark:'#abb6af', paint:'#c9505e', glass:'#7fa3b2', thrust:'#9bc9f5', friction:'#eac477', radial:'#e7ece8', jet:'#a7c8da',
    trail:'#9ccbb4', slip:'#ff99a7', cone:'#e39a52', fence:'#4d5b54', hemiSky:'#c9d8e0', hemiGround:'#22292c', sun:'#e8f0f4'}
};

function puff() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.55, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * update(vm, opts, dt) draws one frame from a plain view model:
 *   {x, z, yaw, smoothYaw, steer, vx, vz, tail, sideL, sideR, fx, fz, frictionKind, centre, slip}
 * yaw: 0 = +x, π/2 = −z. sideL pushes the car to its left. (fx, fz): friction on the car.
 * centre: {x, z} the car is turning about, or null.
 */
export function createScene(container, labelLayer) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 600);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.minDistance = 8; controls.maxDistance = 220; controls.maxPolarAngle = Math.PI * .47;

  // Every coloured material is registered with a palette key so the scheme can switch live.
  const themed = [];
  const tint = (material, key) => { themed.push([material, key]); return material; };
  const mat = (key, roughness = .7, extra = {}) => tint(new THREE.MeshStandardMaterial({roughness, ...extra}), key);
  const basic = (key, extra = {}) => tint(new THREE.MeshBasicMaterial(extra), key);

  const hemi = new THREE.HemisphereLight('#fff', '#888', 2.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 2.4); sun.position.set(-30, 70, 40); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, {left: -75, right: 75, top: 65, bottom: -65}); sun.shadow.bias = -.001; sun.shadow.normalBias = .1;
  scene.add(sun, sun.target);

  function box(w, h, d, x, y, z, material, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); m.receiveShadow = true; parent.add(m); return m;
  }
  function line(points, key, opacity = 1, dashed = false, parent = scene) {
    const geom = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const material = tint(dashed ? new THREE.LineDashedMaterial({transparent: true, opacity, dashSize: .8, gapSize: .55}) : new THREE.LineBasicMaterial({transparent: true, opacity}), key);
    const object = new THREE.Line(geom, material); if (dashed) object.computeLineDistances(); parent.add(object); return object;
  }
  const arc = (cx, cz, r, a0, a1, y = .12, n = 120) => Array.from({length: n + 1}, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.sin(a), y, cz + r * Math.cos(a)]; });

  // ---------- ground and challenge track ----------
  const cx = (WORLD.minX + WORLD.maxX) / 2, cz = (WORLD.minZ + WORLD.maxZ) / 2, spanX = WORLD.maxX - WORLD.minX, spanZ = WORLD.maxZ - WORLD.minZ;
  box(spanX + 80, .2, spanZ + 80, cx, -.55, cz, mat('ground', .95));
  const grid = new THREE.GridHelper(Math.max(spanX, spanZ) + 60, 44); grid.position.set(cx, -.43, cz); grid.material.transparent = true; grid.material.opacity = .22; tint(grid.material, 'grid'); scene.add(grid);
  const ice = mat('ice', .12, {metalness: .1});
  box(C.L, .25, 2 * C.roadHalfWidth, -C.L / 2, -.11, 0, ice);
  for (const z of [-C.roadHalfWidth, C.roadHalfWidth]) box(C.L, .05, .14, -C.L / 2, .05, z, mat('iceEdge', .4));
  const sheen = mat('lane', .1, {transparent: true, opacity: .35, depthWrite: false});
  for (let i = 0; i < 28; i++) { const m = box(1 + (i % 4), .01, .03, -44 + (i * 13.37 % 43), .035, -2.6 + (i * 1.73 % 5.2), sheen); m.rotation.y = (i % 5) * .13; }
  const rIn = C.R - C.roadHalfWidth, rOut = C.R + C.roadHalfWidth;
  const roadPos = [], roadIdx = [], n = 120;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; for (const r of [rIn, rOut]) roadPos.push(r * Math.sin(a), .025, -C.R + r * Math.cos(a)); if (i < n) { const j = i * 2; roadIdx.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); } }
  const roadGeom = new THREE.BufferGeometry(); roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3)); roadGeom.setIndex(roadIdx); roadGeom.computeVertexNormals();
  const road = new THREE.Mesh(roadGeom, mat('asphalt', .95, {side: THREE.DoubleSide})); road.receiveShadow = true; scene.add(road);
  const kerbA = mat('kerbA', .6), kerbB = mat('kerbB', .6);
  for (let i = 0; i < 26; i++) { const a = (i + .5) / 26 * Math.PI / 2; for (const r of [rIn - .25, rOut + .25]) { const m = box(.5, .1, 1.2, r * Math.sin(a), .04, -C.R + r * Math.cos(a), i % 2 ? kerbA : kerbB); m.rotation.y = a; } }
  line([[-C.L, .12, 0], [0, .12, 0]], 'lane', .7, true);
  line(arc(0, -C.R, C.R, 0, Math.PI / 2), 'lane', .8, true);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 8; i++) {
    box(.5, .025, .75, -C.L + .25 + j * .5, .06, -2.625 + i * .75, (i + j) % 2 ? kerbA : kerbB);
    box(.75, .025, .5, rIn + .375 + i * .75, .06, -C.R + .25 - j * .5, (i + j) % 2 ? kerbA : kerbB);
  }
  line([[0, .1, 0], [0, .1, -C.R], [C.R, .1, -C.R]], 'mark', .45, true);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.3, .45, 32), basic('mark', {side: THREE.DoubleSide})); ring.rotation.x = -Math.PI / 2; ring.position.set(0, .1, -C.R); scene.add(ring);
  const dims = [line([[-C.L, .1, 8], [-C.L, .1, 9.4]], 'mark', .7), line([[0, .1, 8], [0, .1, 9.4]], 'mark', .7), line([[-C.L, .1, 8.7], [0, .1, 8.7]], 'mark', .5)];

  // ---------- free-drive world ----------
  const world = new THREE.Group(); scene.add(world);
  const pad = WORLD.icePad, padMesh = new THREE.Mesh(new THREE.CylinderGeometry(pad.r, pad.r, .2, 72), ice);
  padMesh.position.set(pad.x, -.1, pad.z); padMesh.receiveShadow = true; world.add(padMesh);
  line(arc(pad.x, pad.z, pad.r, 0, 2 * Math.PI, .05, 96), 'iceEdge', .9, false, world);
  const circ = WORLD.circle;
  line(arc(circ.x, circ.z, circ.r, 0, 2 * Math.PI, .08, 160), 'mark', .75, true, world);
  for (const r of [circ.r - 3, circ.r + 3]) line(arc(circ.x, circ.z, r, 0, 2 * Math.PI, .06, 160), 'mark', .3, false, world);
  const circDot = ring.clone(); circDot.position.set(circ.x, .1, circ.z); world.add(circDot);
  const coneMat = mat('cone', .55), coneBand = mat('kerbB', .5);
  const cones = WORLD.cones.map(({x, z}) => {
    const g = new THREE.Group(); g.position.set(x, -.02, z); world.add(g);
    const body = new THREE.Mesh(new THREE.ConeGeometry(.32, .9, 20), coneMat); body.position.y = .5; body.castShadow = true; g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.19, .24, .14, 20), coneBand); band.position.y = .58; g.add(band);
    box(.7, .06, .7, 0, .03, 0, coneMat, g);
    return {g, x, z, fall: 0, dir: 0};
  });
  const fenceMat = mat('fence', .8);
  for (const [x0, z0, x1, z1] of [[WORLD.minX, WORLD.minZ, WORLD.maxX, WORLD.minZ], [WORLD.minX, WORLD.maxZ, WORLD.maxX, WORLD.maxZ], [WORLD.minX, WORLD.minZ, WORLD.minX, WORLD.maxZ], [WORLD.maxX, WORLD.minZ, WORLD.maxX, WORLD.maxZ]]) {
    const len = Math.hypot(x1 - x0, z1 - z0), m = box(x1 === x0 ? .4 : len + .4, .6, z1 === z0 ? .4 : len + .4, (x0 + x1) / 2, .2, (z0 + z1) / 2, fenceMat, world); m.castShadow = true;
  }

  const labels = [];
  function label(text, position, cls = '', group = null) {
    const el = document.createElement('span'); el.className = 'world-label ' + cls; el.textContent = text; labelLayer.append(el);
    const item = {el, position: new THREE.Vector3(...position), show: true, group}; labels.push(item); return item;
  }
  label('A', [-C.L, .6, 4.6], 'point'); label('B', [0, .6, 4.8], 'point'); label('C', [rOut - 1.5, .6, -C.R - 4], 'point'); label('O', [0, .4, -C.R - 2], 'point');
  label('AB = 45 m', [-23, .3, 10.8], 'road'); label('Ice · no friction', [-27, .2, -5], 'road'); label('Grip zone · μ = 0.1', [27, .2, -9], 'road'); label('R = 20 m', [-2.5, .3, -10], 'road');
  label('Ice rink · μ = 0', [pad.x, .3, pad.z], 'road', world); label('R = 20 m circle', [circ.x, .3, circ.z + 2], 'road', world); label('Slalom', [-22, .3, 25], 'road', world);
  label('Ground everywhere else · μ = 0.1', [60, .3, -50], 'road', world);

  // ---------- car: a generic jet roadster, enlarged 1.35× for visibility ----------
  const car = new THREE.Group(); car.scale.setScalar(1.35); scene.add(car);
  const paint = mat('paint', .28, {metalness: .35, side: THREE.DoubleSide});
  const glass = mat('glass', .1, {metalness: .2, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide});
  const dark = new THREE.MeshStandardMaterial({color: '#1c2226', roughness: .45, metalness: .5});
  const chrome = new THREE.MeshStandardMaterial({color: '#b9c3c6', roughness: .25, metalness: .85});
  function loft(profiles, material) {
    const positions = [], indices = [];
    for (const [x, w, bottom, shoulder, top] of profiles) { for (const [z, y] of [[-w, bottom], [-w, shoulder], [-w * .63, top], [w * .63, top], [w, shoulder], [w, bottom]]) positions.push(x, y, z); }
    for (let j = 0; j < profiles.length - 1; j++) for (let k = 0; k < 6; k++) { const a = j * 6 + k, b = j * 6 + (k + 1) % 6, c = (j + 1) * 6 + k, d = (j + 1) * 6 + (k + 1) % 6; indices.push(a, b, c, b, d, c); }
    for (let k = 1; k < 5; k++) { indices.push(0, k + 1, k); const s = (profiles.length - 1) * 6; indices.push(s, s + k, s + k + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material); mesh.castShadow = true; car.add(mesh); return mesh;
  }
  loft([[-2.35, .68, .36, .7, .77], [-1.7, 1, .25, .87, .96], [-.8, 1.03, .25, .88, 1], [.8, 1, .25, .78, .93], [1.8, .91, .28, .57, .65], [2.45, .68, .32, .48, .49]], paint);
  const cabin = loft([[-1.2, .72, .78, .94, 1.05], [-.65, .65, .89, 1.35, 1.46], [.15, .6, .88, 1.4, 1.48], [1.05, .78, .81, .85, .9]], glass);
  box(4.1, .16, 1.65, 0, .3, 0, dark, car);
  const brakeLight = new THREE.MeshStandardMaterial({color: '#ff5047', emissive: '#f93231', emissiveIntensity: .6});
  box(.08, .12, 1.5, -2.33, .68, 0, brakeLight, car);
  for (const z of [-.64, .64]) box(.5, .065, .16, 2, .55, z, new THREE.MeshStandardMaterial({color: '#f4fbff', emissive: '#d8f2ff', emissiveIntensity: 1.2}), car);
  const tanks = new THREE.Group(); car.add(tanks);
  const tankMat = new THREE.MeshStandardMaterial({color: '#6fb3c4', roughness: .3, metalness: .6});
  for (const z of [-.36, .36]) { const t = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .85, 5, 12), tankMat); t.rotation.z = Math.PI / 2; t.position.set(-.65, .7, z); tanks.add(t); }
  const wheels = [];
  for (const x of [-1.52, 1.47]) for (const z of [-1.01, 1.01]) {
    const g = new THREE.Group(); g.position.set(x, .45, z); g.rotation.order = 'YZX'; g.userData.front = x > 0; car.add(g);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(.44, .44, .25, 24), new THREE.MeshStandardMaterial({color: '#15191b', roughness: .9})); tyre.rotation.x = Math.PI / 2; tyre.castShadow = true; g.add(tyre);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.29, .29, .27, 24), chrome); rim.rotation.x = Math.PI / 2; g.add(rim);
    for (let i = 0; i < 5; i++) { const s = box(.5, .055, .285, 0, 0, 0, dark, g); s.rotation.z = i * Math.PI / 5; }
    wheels.push(g);
  }
  for (const z of [-.4, .4]) { const j = new THREE.Mesh(new THREE.CylinderGeometry(.13, .16, .22, 16), chrome); j.rotation.z = Math.PI / 2; j.position.set(-2.35, .5, z); car.add(j); }
  for (const x of [-.65, .65]) for (const z of [-1.05, 1.05]) { const j = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, .18, 16), chrome); j.rotation.x = Math.PI / 2; j.position.set(x, .47, z); car.add(j); }
  const fan = new THREE.Group(); fan.position.set(0, .21, 0); car.add(fan);
  for (let i = 0; i < 4; i++) { const b = box(.85, .025, .1, 0, 0, 0, chrome, fan); b.rotation.y = i * Math.PI / 4; }

  // ---------- trail: green while rolling, red once the tyres slide ----------
  const MAX_TRAIL = 6000, trailPos = new Float32Array(MAX_TRAIL * 3), trailCol = new Float32Array(MAX_TRAIL * 3), flags = new Uint8Array(MAX_TRAIL);
  const trailGeom = new THREE.BufferGeometry(); trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeom.setAttribute('color', new THREE.BufferAttribute(trailCol, 3)); trailGeom.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeom, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, opacity: .9})); trail.frustumCulled = false; scene.add(trail);
  let trailCount = 0, trailClock = 0;

  // ---------- forces ----------
  const arrow = key => { const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 4, '#000', .6, .35); themed.push([a.line.material, key], [a.cone.material, key]); scene.add(a); return a; };
  const tailArrow = arrow('thrust'), sideArrow = arrow('thrust'), frictionArrow = arrow('friction');
  const radial = line([[0, 2, 0], [0, 2, 1]], 'radial', .55, true);
  const tailLabel = label('', [0, 0, 0], 'force'), sideLabel = label('', [0, 0, 0], 'force'), frictionLabel = label('', [0, 0, 0], 'force friction'), radialLabel = label('toward centre', [0, 0, 0], 'force radial');

  // ---------- exhaust: compressed air, slowed down so it can be seen ----------
  const COUNT = 480, pPos = new Float32Array(COUNT * 3), pCol = new Float32Array(COUNT * 3), parts = Array.from({length: COUNT}, () => ({age: 9, life: 1, x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0}));
  const pGeom = new THREE.BufferGeometry(); pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeom.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(pGeom, new THREE.PointsMaterial({size: .5, map: puff(), alphaTest: .02, vertexColors: true, transparent: true, opacity: .9, depthWrite: false, sizeAttenuation: true})); points.frustumCulled = false; scene.add(points);
  let nextPart = 0; const carry = {tail: 0, sideL: 0, sideR: 0};

  let palette = PALETTES.light; const bgColor = new THREE.Color(), jetColor = new THREE.Color();
  function setScheme(darkMode) {
    palette = darkMode ? PALETTES.dark : PALETTES.light;
    for (const [m, key] of themed) m.color.set(palette[key]);
    scene.background = new THREE.Color(palette.bg); scene.fog = new THREE.Fog(palette.bg, 110, 260);
    hemi.color.set(palette.hemiSky); hemi.groundColor.set(palette.hemiGround); sun.color.set(palette.sun);
    bgColor.set(palette.bg); jetColor.set(palette.jet); recolourTrail();
  }

  // ---------- cameras ----------
  let mode = 'chase', worldMode = 'challenge', width = 1, height = 1, yaw = 0, rolled = 0;
  const carPos = new THREE.Vector3(), camGoal = new THREE.Vector3(), lookGoal = new THREE.Vector3(), look = new THREE.Vector3();
  const fwd = () => new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), lft = () => new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  function cameraView(next) {
    mode = next; const aspect = width / height, free = worldMode === 'free';
    controls.enabled = mode === 'overview' || mode === 'top';
    camera.fov = mode === 'cockpit' ? 62 : 42; camera.updateProjectionMatrix();
    const t = free ? new THREE.Vector3(-5, 0, 0) : new THREE.Vector3(-11, 0, -5);
    if (mode === 'top') { controls.target.copy(t); camera.position.set(t.x, Math.max(free ? 150 : 70, (free ? 210 : 112) / aspect), t.z + .01); }
    else if (mode === 'overview') { controls.target.copy(t); camera.position.copy(t).add(new THREE.Vector3(-.15, .65, 1).normalize().multiplyScalar(Math.max(free ? 120 : 62, (free ? 190 : 108) / aspect))); }
    else snapFollow();
    controls.update();
    // Cockpit: keep the bonnet in view; hide what would sit around the driver's eyes.
    const inside = mode === 'cockpit';
    cabin.visible = !inside; wheels.forEach(w => w.visible = !inside);
    for (const d of dims) d.visible = !free && (mode === 'overview' || mode === 'top');
  }
  function followGoals() {
    const f = fwd();
    if (mode === 'cockpit') { camGoal.copy(carPos).addScaledVector(f, -.6).setY(2.05); lookGoal.copy(carPos).addScaledVector(f, 25).setY(-.4); }
    else { camGoal.copy(carPos).addScaledVector(f, -17).setY(8.5); lookGoal.copy(carPos).addScaledVector(f, 9).setY(0); }
  }
  function snapFollow() { followGoals(); camera.position.copy(camGoal); look.copy(lookGoal); camera.lookAt(look); }
  function resize() {
    width = container.clientWidth; height = Math.max(1, container.clientHeight);
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
    if (mode === 'overview' || mode === 'top') cameraView(mode);
  }

  function recolourTrail() {
    const g = new THREE.Color(palette.trail), r = new THREE.Color(palette.slip);
    for (let i = 0; i < trailCount; i++) { const c = flags[i] ? r : g; trailCol.set([c.r, c.g, c.b], i * 3); }
    trailGeom.attributes.color.needsUpdate = true;
  }
  function pushTrail(x, z, slip) {
    if (trailCount >= MAX_TRAIL) {           // keep the newest half
      const keep = MAX_TRAIL / 2;
      trailPos.copyWithin(0, (MAX_TRAIL - keep) * 3); trailCol.copyWithin(0, (MAX_TRAIL - keep) * 3); flags.copyWithin(0, MAX_TRAIL - keep); trailCount = keep;
    }
    const c = new THREE.Color(slip ? palette.slip : palette.trail), i = trailCount++;
    trailPos.set([x, .16, z], i * 3); trailCol.set([c.r, c.g, c.b], i * 3); flags[i] = slip ? 1 : 0;
    trailGeom.setDrawRange(0, trailCount); trailGeom.attributes.position.needsUpdate = true; trailGeom.attributes.color.needsUpdate = true;
  }

  function reset(vm) {
    trailCount = 0; trailClock = 0; trailGeom.setDrawRange(0, 0); rolled = 0;
    for (const p of parts) p.age = 9;
    for (const c of cones) { c.fall = 0; c.g.rotation.set(0, 0, 0); }
    carry.tail = carry.sideL = carry.sideR = 0;
    if (vm) { yaw = vm.yaw; carPos.set(vm.x, .06, vm.z); if (mode === 'chase' || mode === 'cockpit') snapFollow(); }
  }
  function setWorld(next) {
    worldMode = next; world.visible = next === 'free';
    for (const l of labels) if (l.group === world) l.show = next === 'free';
    cameraView(mode);
  }

  function emit(kind, dt, rate, f, l, vCar) {
    carry[kind] += rate * dt;
    while (carry[kind] >= 1) {
      carry[kind] -= 1; const p = parts[nextPart]; nextPart = (nextPart + 1) % COUNT;
      const pair = Math.random() < .5 ? -1 : 1, jitter = () => (Math.random() - .5);
      p.age = 0; p.life = .55 + Math.random() * .25;
      if (kind === 'tail') {
        p.x = carPos.x - f.x * 3.2 + l.x * .54 * pair; p.z = carPos.z - f.z * 3.2 + l.z * .54 * pair; p.y = .68;
        p.vx = vCar.x * .3 - f.x * 14 + jitter() * 2.4; p.vz = vCar.z * .3 - f.z * 14 + jitter() * 2.4; p.vy = jitter() * .9;
      } else {
        const out = kind === 'sideL' ? -1 : 1;     // pushing left means blowing out to the right
        p.x = carPos.x + l.x * 1.55 * out + f.x * .88 * pair; p.z = carPos.z + l.z * 1.55 * out + f.z * .88 * pair; p.y = .64;
        p.vx = vCar.x * .3 + l.x * 11 * out + jitter() * 2; p.vz = vCar.z * .3 + l.z * 11 * out + jitter() * 2; p.vy = jitter() * .8;
      }
    }
  }

  function update(vm, opts, dt) {
    const v = Math.hypot(vm.vx, vm.vz);
    carPos.set(vm.x, .06, vm.z);
    if (vm.smoothYaw && dt > 0) { let d = vm.yaw - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * Math.min(1, dt * 10); } else if (!vm.smoothYaw || v === 0) yaw = vm.yaw;
    car.position.copy(carPos); car.rotation.y = yaw;
    rolled += v * dt;
    for (const w of wheels) w.rotation.set(0, w.userData.front ? vm.steer || 0 : 0, -rolled / (.44 * 1.35));
    fan.visible = opts.fan && mode !== 'cockpit'; fan.rotation.y += opts.fan ? dt * 40 : 0;
    paint.transparent = opts.xray; paint.opacity = opts.xray ? .38 : 1; paint.depthWrite = !opts.xray; paint.needsUpdate = true; tanks.visible = opts.xray;
    brakeLight.emissiveIntensity = vm.brake ? 2.4 : .6;

    trailClock += dt;
    if (trailClock >= .03 || trailCount === 0) { pushTrail(vm.x, vm.z, vm.slip); trailClock = 0; }

    // Cones topple when the car drives into them (markers only: they do not push back).
    for (const c of cones) {
      if (!c.fall && Math.hypot(vm.x - c.x, vm.z - c.z) < 1.9 && v > .5) { c.fall = .001; c.dir = Math.atan2(-vm.vz, vm.vx); }
      if (c.fall > 0 && c.fall < 1) { c.fall = Math.min(1, c.fall + dt * 3); c.g.rotation.set(0, c.dir, -c.fall * Math.PI / 2 * .95); }
    }

    // Forces (hidden in the cockpit, where they would sit overhead).
    const f = fwd(), l = lft(), show = opts.forces && mode !== 'cockpit', top = carPos.clone().setY(2.3), scale = 1 / 2500;
    tailArrow.visible = tailLabel.show = show && vm.tail > 0;
    if (tailArrow.visible) { const o = top.clone().addScaledVector(f, 1.2); tailArrow.position.copy(o); tailArrow.setDirection(f); tailArrow.setLength(vm.tail * scale, .8, .45); tailLabel.position.copy(o).addScaledVector(f, vm.tail * scale + 1).setY(3.1); tailLabel.el.textContent = `Tail thrust ${(vm.tail / 1000).toFixed(1)} kN`; }
    const side = (vm.sideL || 0) - (vm.sideR || 0), sdir = l.clone().multiplyScalar(Math.sign(side) || 1);
    sideArrow.visible = sideLabel.show = show && Math.abs(side) > 0;
    if (sideArrow.visible) { const o = top.clone().addScaledVector(f, -1.6), len = Math.max(.9, Math.abs(side) * scale); sideArrow.position.copy(o); sideArrow.setDirection(sdir); sideArrow.setLength(len, Math.min(.8, .25 + Math.abs(side) / 20000), .4); sideLabel.position.copy(o).addScaledVector(sdir, len + 1.1).setY(4.4); sideLabel.el.textContent = `Side thrust ${(Math.abs(side) / 1000).toFixed(1)} kN`; }
    const fr = Math.hypot(vm.fx || 0, vm.fz || 0);
    frictionArrow.visible = frictionLabel.show = show && fr > 1;
    if (frictionArrow.visible) { const dir = new THREE.Vector3(vm.fx / fr, 0, vm.fz / fr), o = top.clone().addScaledVector(f, 1.8).setY(1.6), len = Math.max(.9, fr * scale); frictionArrow.position.copy(o); frictionArrow.setDirection(dir); frictionArrow.setLength(len, .55, .3); frictionLabel.position.copy(o).addScaledVector(dir, len + 1.1).setY(2.2); frictionLabel.el.textContent = `${vm.frictionKind === 'kinetic' ? 'Kinetic' : 'Static'} friction ${(fr / 1000).toFixed(1)} kN`; }
    radial.visible = radialLabel.show = show && !!vm.centre;
    if (radial.visible) {
      const o = carPos.clone().setY(1.2), c = new THREE.Vector3(vm.centre.x, 1.2, vm.centre.z), d = c.clone().sub(o), len = Math.min(9, d.length()), e = o.clone().addScaledVector(d.normalize(), len);
      radial.geometry.dispose(); radial.geometry = new THREE.BufferGeometry().setFromPoints([o, e]); radial.computeLineDistances(); radialLabel.position.copy(e).addScaledVector(d, 1.5);
    }

    // Exhaust particles.
    const vCar = new THREE.Vector3(vm.vx, 0, vm.vz);
    if (dt > 0) {
      if (vm.tail > 0) emit('tail', dt, 180 * vm.tail / 20000, f, l, vCar);
      if (vm.sideL > 0) emit('sideL', dt, 40 + 140 * vm.sideL / 20000, f, l, vCar);
      if (vm.sideR > 0) emit('sideR', dt, 40 + 140 * vm.sideR / 20000, f, l, vCar);
      for (const p of parts) { if (p.age > p.life) continue; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 1 - 1.4 * dt; p.vz *= 1 - 1.4 * dt; }
    }
    const c = new THREE.Color();
    parts.forEach((p, i) => {
      const alive = p.age <= p.life; pPos[i * 3] = p.x; pPos[i * 3 + 1] = alive ? p.y : -50; pPos[i * 3 + 2] = p.z;
      c.copy(jetColor).lerp(bgColor, Math.min(1, p.age / p.life)); pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
    });
    pGeom.attributes.position.needsUpdate = true; pGeom.attributes.color.needsUpdate = true;

    // Keep the shadow camera on the car once it leaves the challenge track.
    sun.target.position.set(worldMode === 'free' ? vm.x : -10, 0, worldMode === 'free' ? vm.z : -8); sun.position.copy(sun.target.position).add(new THREE.Vector3(-30, 70, 40));
  }

  const proj = new THREE.Vector3();
  function render(frameDt = 1 / 60) {
    if (mode === 'chase' || mode === 'cockpit') {
      followGoals();
      const k = mode === 'cockpit' ? 1 : 1 - Math.exp(-frameDt * 6);
      camera.position.lerp(camGoal, k); look.lerp(lookGoal, k); camera.lookAt(look);
    } else controls.update();
    renderer.render(scene, camera);
    for (const item of labels) {
      proj.copy(item.position).project(camera);
      const hideRoad = (mode === 'cockpit' || mode === 'chase') && item.el.classList.contains('road');
      const visible = item.show && !hideRoad && proj.z < 1 && proj.z > -1 && Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.05;
      item.el.style.display = visible ? 'block' : 'none';
      if (visible) { item.el.style.left = `${(proj.x * .5 + .5) * width}px`; item.el.style.top = `${(-proj.y * .5 + .5) * height}px`; }
    }
  }

  const mq = matchMedia('(prefers-color-scheme: dark)'); setScheme(mq.matches); mq.addEventListener?.('change', e => setScheme(e.matches));
  new ResizeObserver(resize).observe(container); resize(); setWorld('challenge'); cameraView('chase');
  return {update, render, cameraView, setWorld, reset, resize, get mode() { return mode; }};
}
