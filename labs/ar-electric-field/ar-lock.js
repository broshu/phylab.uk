/* =====================================================================
   ar-lock.js  —  "lock once, then move the camera" AR controllers
   ---------------------------------------------------------------------
   This is the jitter fix the whole lab is built around.

     SCAN phase  AR.js tracks the printed markers live.  We only watch
                 them to know they're there (a faint preview dot per
                 marker).  When they've been seen steadily for a moment
                 the scene AUTO-LOCKS (default), or the user taps Lock.

     LOCK phase  The charge layout is frozen into a rigid reference
                 frame and the field geometry is built ONCE.  Its shape
                 never changes again.  Every frame we recover the
                 reference frame's pose from whichever markers are
                 currently visible — averaging all of their (noisy)
                 readings into one pose and low-pass filtering it — and
                 drive a single anchor.  So: the field shape is rigid,
                 only the viewpoint moves, and the averaging keeps it
                 glued to the real desk as steadily as possible.

   Two flavours share the Lock mixin:
     arlock-planar : flat markers, charge AT the marker, in-plane field
                     + potential surface (uses EFieldPlanar).
     arlock-cube   : cube markers, charge at the CUBE CENTRE (each face
                     offset inward by ½ edge then averaged), 3-D field
                     lines (uses EField3D).
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- shared mixin ---------- */
  var Lock = {
    initBase: function () {
      this.cfg = EFieldUtil.readConfig(location.search);
      this.statusEl = document.querySelector('#status');
      this.locked = false;
      this.frozen = null;
      this.buildKey = '';
      this._apos = new THREE.Vector3();
      this._aquat = new THREE.Quaternion();
      this._scl = new THREE.Vector3(1, 1, 1);
      this._haveA = false;
      this._seenSince = 0;     // ms the markers have been continuously present
      this._flash = ''; this._flashUntil = 0;
      this._v = new THREE.Vector3();

      // anchor carries ALL frozen content; we only rewrite its matrix each frame
      this.anchor = new THREE.Group(); this.anchor.matrixAutoUpdate = false;
      this.el.object3D.add(this.anchor);
      this.content = new THREE.Group(); this.anchor.add(this.content);
      this.gridGroup  = new THREE.Group(); this.content.add(this.gridGroup);
      this.fieldGroup = new THREE.Group(); this.content.add(this.fieldGroup);
      this.potGroup   = new THREE.Group(); this.content.add(this.potGroup);
      this.glyphGroup = new THREE.Group(); this.content.add(this.glyphGroup);
      this.trajGroup  = new THREE.Group(); this.content.add(this.trajGroup);
      this.pGroup     = new THREE.Group(); this.content.add(this.pGroup);
      this.liveGroup  = new THREE.Group(); this.el.object3D.add(this.liveGroup);  // pre-lock preview (world)

      this.bindUI();
    },

    bindUI: function () {
      var self = this;
      var on = function (el, fn) { if (!el) return; var h = function (e) { if (e) { e.preventDefault(); e.stopPropagation(); } fn(); };
        el.addEventListener('click', h); el.addEventListener('touchend', h, { passive: false }); };
      var lock = document.querySelector('#lockBtn');
      on(lock, function () { if (self.locked) self.rescan(); else self.lockNow(); });
      // toggle buttons present for this page
      [['#t-grid', 'grid'], ['#t-field', 'field'], ['#t-pot', 'pot']].forEach(function (pair) {
        var el = document.querySelector(pair[0]); if (!el) return;
        on(el, function () {
          if (!self.locked || !self.builder.show.hasOwnProperty(pair[1])) return;
          self.builder.show[pair[1]] = !self.builder.show[pair[1]];
          el.classList.toggle('on', self.builder.show[pair[1]]);
          self.buildKey = '';
        });
      });
    },

    flash: function (msg) { this._flash = msg; this._flashUntil = performance.now() + 1800; },

    rescan: function () {
      this.locked = false; this.frozen = null; this._haveA = false; this.buildKey = ''; this._seenSince = 0;
      [this.gridGroup, this.fieldGroup, this.potGroup, this.glyphGroup, this.trajGroup, this.pGroup].forEach(EFieldUtil.clear);
      this.setUIState();
    },

    setUIState: function () {
      var lock = document.querySelector('#lockBtn');
      if (lock) {
        lock.classList.toggle('locked', this.locked);
        var ic = lock.querySelector('.ic'); if (ic) ic.textContent = this.locked ? '↻' : '🔒';
        var lab = lock.querySelector('.lab'); if (lab) lab.textContent = this.locked ? 'Re-scan' : 'Lock now';
      }
      ['#t-grid', '#t-field', '#t-pot'].forEach(function (sel) {
        var el = document.querySelector(sel); if (el) el.classList.toggle('disabled', !this.locked);
      }, this);
      if (this.locked && this.builder) {
        var b = this.builder;
        var set = function (sel, key) { var el = document.querySelector(sel); if (el && b.show.hasOwnProperty(key)) el.classList.toggle('on', b.show[key]); };
        set('#t-grid', 'grid'); set('#t-field', 'field'); set('#t-pot', 'pot');
      }
    },

    /* build the rigid reference frame M (basis u, normal, w at origin) and its inverse */
    buildFrame: function (markersForPlane) {
      var pl = EFieldUtil.fitPlane(markersForPlane);
      var w = new THREE.Vector3().crossVectors(pl.u, pl.normal).normalize();
      var M = new THREE.Matrix4().makeBasis(pl.u, pl.normal, w).setPosition(pl.origin);
      return { pl: pl, w: w, M: M, Minv: M.clone().invert() };
    },

    /* record K = markerWorld^-1 · M for every currently-visible tracking marker */
    captureAnchors: function (els, M) {
      var anchors = [];
      for (var i = 0; i < els.length; i++) { var o = els[i].object3D; if (!o.visible) continue;
        o.updateMatrixWorld(true);
        anchors.push({ el: els[i], K: o.matrixWorld.clone().invert().multiply(M) });
      }
      return anchors;
    },

    /* recover + smooth the reference-frame pose from visible markers (the averaging step) */
    updateAnchor: function () {
      var ests = [], i;
      for (i = 0; i < this.frozen.anchors.length; i++) {
        var o = this.frozen.anchors[i].el.object3D; if (!o.visible) continue;
        o.updateMatrixWorld(true);
        var E = o.matrixWorld.clone().multiply(this.frozen.anchors[i].K);
        var p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); E.decompose(p, q, s);
        ests.push({ p: p, q: q });
      }
      if (!EFieldUtil.averagePose(ests, this._apos, this._aquat, this.cfg.smooth, this._haveA)) return;
      this._haveA = true;
      this.anchor.matrix.compose(this._apos, this._aquat, this._scl);
      this.anchor.matrixWorldNeedsUpdate = true;
    },

    livePreview: function (charges) {
      EFieldUtil.clear(this.liveGroup);
      for (var i = 0; i < charges.length; i++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12),
          new THREE.MeshBasicMaterial({ color: charges[i].q > 0 ? EFieldUtil.COL.posFill : EFieldUtil.COL.negFill }));
        s.position.copy(charges[i].pos); this.liveGroup.add(s);
      }
    },

    /* auto-lock once ≥1 charge has been visible steadily for ~1.2 s */
    maybeAutoLock: function (time, nCharges) {
      if (!this.cfg.autolock || this.locked) return;
      if (nCharges < 1) { this._seenSince = 0; return; }
      if (!this._seenSince) this._seenSince = time;
      else if (time - this._seenSince > 1200) this.lockNow();
    }
  };

  /* =================================================================
     arlock-planar — flat stickers on the desk; each charge floats 2× the
     sticker edge ABOVE its sticker, and a true 3-D field is drawn around the
     floating charges. This gives a real 3-D field with only flat printouts
     (no 3-D printer needed). Lock-once freezes it so there is no jitter.
     ================================================================= */
  AFRAME.registerComponent('arlock-planar', Object.assign({}, Lock, {
    init: function () {
      this.initBase();
      if (!this.cfg._hasSmooth) this.cfg.smooth = 0.12;     // stickers are static → steady anchor
      this.chg = Array.from(document.querySelectorAll('a-marker.chg'));
      this.plateEls = Array.from(document.querySelectorAll('a-marker.plate'));
      this.guns = [
        { el: document.querySelector('a-marker.gun-pos'), q: +1, color: EFieldUtil.COL.gunPos },
        { el: document.querySelector('a-marker.gun-neg'), q: -1, color: EFieldUtil.COL.gunNeg }
      ].filter(function (g) { return g.el; });
      this.stemGroup = new THREE.Group(); this.content.add(this.stemGroup);
      this.plateGroup = new THREE.Group(); this.content.add(this.plateGroup);
      this.builder = new EField3D({
        cfg: this.cfg,
        lightTarget: this.content,
        groups: { field: this.fieldGroup, glyph: this.glyphGroup, traj: this.trajGroup, particle: this.pGroup, plate: this.plateGroup, pot: this.potGroup }
      });
      this.setUIState();
    },

    /* each visible flat marker → one charge, with the desk-up normal */
    liveCharges: function () {
      var out = [];
      for (var i = 0; i < this.chg.length; i++) { var o = this.chg[i].object3D; if (!o.visible) continue;
        var p = new THREE.Vector3(); o.getWorldPosition(p);
        var qn = new THREE.Quaternion(); o.getWorldQuaternion(qn);
        out.push({ pos: p, q: parseFloat(this.chg[i].dataset.q), normal: new THREE.Vector3(0, 1, 0).applyQuaternion(qn).normalize() });
      }
      return out;
    },

    /* world poses of any visible charged-plate markers (for the desk-plane fit / preview) */
    livePlates: function () {
      var out = [];
      for (var i = 0; i < this.plateEls.length; i++) { var o = this.plateEls[i].object3D; if (!o.visible) continue;
        var p = new THREE.Vector3(); o.getWorldPosition(p);
        var qn = new THREE.Quaternion(); o.getWorldQuaternion(qn);
        out.push({ pos: p, q: parseFloat(this.plateEls[i].dataset.q), quat: qn, normal: new THREE.Vector3(0, 1, 0).applyQuaternion(qn).normalize() });
      }
      return out;
    },

    lockNow: function () {
      var charges = this.liveCharges();
      var plates = this.livePlates();
      var visGuns = this.guns.filter(function (g) { return g.el.object3D.visible; });
      var planePts = charges.concat(plates), i;
      for (i = 0; i < visGuns.length; i++) { var p = new THREE.Vector3(); visGuns[i].el.object3D.getWorldPosition(p);
        var qn = new THREE.Quaternion(); visGuns[i].el.object3D.getWorldQuaternion(qn);
        planePts.push({ pos: p, q: 0, normal: new THREE.Vector3(0, 1, 0).applyQuaternion(qn).normalize() }); }
      if (!charges.length && !plates.length) { this.flash('No charge/plate stickers visible — point at them first'); return; }

      var fr = this.buildFrame(planePts), Minv = fr.Minv;
      var rot = new THREE.Matrix4().extractRotation(Minv);
      var lift = this.cfg.lift;

      // point charges → local 3-D: drop the sticker onto the desk (y=0), then float the charge up by `lift`.
      var items = [], stems = [];
      for (i = 0; i < charges.length; i++) {
        var base = charges[i].pos.clone().applyMatrix4(Minv); base.y = 0;     // sticker on the desk
        var top = base.clone(); top.y += lift;                                // charge floats above
        items.push({ pos: top, q: charges[i].q }); stems.push({ base: base, top: top, q: charges[i].q });
      }

      // charged plates → a square wall standing on the desk: side = plateSide (×edge), perpendicular to the desk,
      // total charge = plateQ × a point charge. ux = marker +X on the desk; uy = desk-up; n = plate normal.
      var half = this.cfg.plateSide / 2, hgt = this.cfg.plateSide;
      for (i = 0; i < plates.length; i++) {
        var pb = plates[i].pos.clone().applyMatrix4(Minv); pb.y = 0;
        var ux = new THREE.Vector3(1, 0, 0).applyQuaternion(plates[i].quat).applyMatrix4(rot); ux.y = 0;
        if (ux.lengthSq() < 1e-6) ux.set(1, 0, 0); ux.normalize();
        var uy = new THREE.Vector3(0, 1, 0);
        var n = new THREE.Vector3().crossVectors(ux, uy).normalize();
        items.push({ plate: true, base: pb, ux: ux, uy: uy, n: n, half: half, height: hgt, q: plates[i].q });
      }

      // guns → local muzzle on the desk, firing along the printed arrow (marker +X) projected onto the desk
      var gunsF = [];
      for (i = 0; i < visGuns.length; i++) { var g = visGuns[i];
        var wp = new THREE.Vector3(); g.el.object3D.getWorldPosition(wp);
        var wq = new THREE.Quaternion(); g.el.object3D.getWorldQuaternion(wq);
        var lp = wp.clone().applyMatrix4(Minv); lp.y = 0.02;
        var f = new THREE.Vector3(1, 0, 0).applyQuaternion(wq).applyMatrix4(rot); f.y = 0;
        if (f.lengthSq() < 1e-6) f.set(1, 0, 0); f.normalize();
        for (var t = 0; t < this.cfg.gundir; t++) { var tx = f.x; f.x = -f.z; f.z = tx; }
        gunsF.push({ pos: lp, dir: f, q: g.q, color: g.color });
      }

      var anchorEls = this.chg.concat(this.plateEls).concat(this.guns.map(function (g) { return g.el; }));
      var anchors = this.captureAnchors(anchorEls, fr.M);
      this.frozen = { items: items, stems: stems, guns: gunsF, anchors: anchors };
      this.locked = true; this.buildKey = '';
      fr.M.decompose(this._apos, this._aquat, this._scl); this._haveA = true; this._scl.set(1, 1, 1);
      EFieldUtil.clear(this.liveGroup);

      var S = 0.9;
      for (i = 0; i < items.length; i++) {
        if (items[i].plate) S = Math.max(S, items[i].base.length() + items[i].half + items[i].height);
        else S = Math.max(S, items[i].pos.length());
      }
      this._S = S + 1.1;
      this.setUIState();
      var nc = items.length;
      this.flash(nc + ' charge' + (nc !== 1 ? 's' : '') + ' locked · move around to view');
    },

    /* faint vertical stem from each sticker (on the desk) up to its floating charge */
    buildStems: function () {
      EFieldUtil.clear(this.stemGroup);
      for (var i = 0; i < this.frozen.stems.length; i++) {
        var st = this.frozen.stems[i];
        var col = st.q > 0 ? EFieldUtil.COL.posFill : EFieldUtil.COL.negFill;
        var g = new THREE.BufferGeometry().setFromPoints([st.base, st.top]);
        this.stemGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.5 })));
        var dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 10), new THREE.MeshBasicMaterial({ color: col }));
        dot.position.copy(st.base); this.stemGroup.add(dot);    // marks the sticker on the desk
      }
    },

    rebuild: function () {
      this.builder.build(this.frozen.items);
      this.builder.buildPotential(this.frozen.items, this._S);
      this.builder.buildTrajectories(this.frozen.guns, this.frozen.items, this._S);
      this.buildStems();
    },

    tick: function (time) {
      var msg;
      if (!this.locked) {
        var charges = this.liveCharges(), plates = this.livePlates();
        var n = charges.length + plates.length;
        var nGun = this.guns.filter(function (g) { return g.el.object3D.visible; }).length;
        this.livePreview(charges.concat(plates));
        this.maybeAutoLock(time, n);
        msg = (n || nGun)
          ? (n + ' charge' + (n !== 1 ? 's' : '') + (plates.length ? ' (' + plates.length + ' plate' + (plates.length > 1 ? 's' : '') + ')' : '') + (nGun ? ' + ' + nGun + ' gun' + (nGun > 1 ? 's' : '') : '') + ' — hold steady to lock…')
          : 'Point at the stickers so they are seen…';
      } else {
        var seen = this.frozen.anchors.filter(function (an) { return an.el.object3D.visible; }).length;
        var nc = this.frozen.items.length;
        msg = seen ? ('Locked · ' + nc + ' charge' + (nc !== 1 ? 's' : '') + ' · tracking ' + seen + ' marker' + (seen > 1 ? 's' : ''))
                   : 'Locked · point back at the stickers to keep tracking';
        this.updateAnchor();
        var key = this.builder.show.field + '|' + this.builder.show.pot;
        if (key !== this.buildKey) { this.rebuild(); this.buildKey = key; }
        this.builder.animate(time, this.frozen.guns);
      }
      var shown = (this._flash && time < this._flashUntil) ? this._flash : msg;
      if (this.statusEl.textContent !== shown) this.statusEl.textContent = shown;
    }
  }));

  /* =================================================================
     arlock-cube — cube markers, charge at cube centre, 3-D field
     ================================================================= */
  AFRAME.registerComponent('arlock-cube', Object.assign({}, Lock, {
    init: function () {
      this.initBase();
      // Cubes are placed static, so prefer a steadier (heavier-smoothed) anchor than
      // the plane default — unless the user pinned ?smooth= themselves.
      if (!this.cfg._hasSmooth) this.cfg.smooth = 0.12;
      this.cubePos = Array.from(document.querySelectorAll('a-marker.cube-pos'));
      this.cubeNeg = Array.from(document.querySelectorAll('a-marker.cube-neg'));
      this.guns = [
        { el: document.querySelector('a-marker.gun-pos'), q: +1, color: EFieldUtil.COL.gunPos },
        { el: document.querySelector('a-marker.gun-neg'), q: -1, color: EFieldUtil.COL.gunNeg }
      ].filter(function (g) { return g.el; });
      this.builder = new EField3D({
        cfg: this.cfg,
        lightTarget: this.content,
        groups: { field: this.fieldGroup, glyph: this.glyphGroup, traj: this.trajGroup, particle: this.pGroup, pot: this.potGroup }
      });
      this.setUIState();
    },

    /* world-space centre of one cube: each visible face stepped inward ½ edge, then averaged */
    cubeCentreWorld: function (faces) {
      var acc = new THREE.Vector3(), count = 0, p = new THREE.Vector3(), q = new THREE.Quaternion(), n = new THREE.Vector3();
      for (var i = 0; i < faces.length; i++) { var o = faces[i].object3D; if (!o.visible) continue;
        o.getWorldPosition(p); o.getWorldQuaternion(q);
        n.set(0, 1, 0).applyQuaternion(q).multiplyScalar(-this.cfg.cube);    // step into the cube
        acc.add(p.clone().add(n)); count++;
      }
      return count ? { pos: acc.multiplyScalar(1 / count), count: count } : null;
    },

    visibleCubeFaces: function () {
      var out = [];
      this.cubePos.concat(this.cubeNeg).forEach(function (el) { if (el.object3D.visible) out.push(el); });
      return out;
    },

    lockNow: function () {
      var cp = this.cubeCentreWorld(this.cubePos);
      var cn = this.cubeCentreWorld(this.cubeNeg);
      var centres = [];
      if (cp) centres.push({ pos: cp.pos, q: +1 });
      if (cn) centres.push({ pos: cn.pos, q: -1 });
      var visGuns = this.guns.filter(function (g) { return g.el.object3D.visible; });
      // plane is fitted from the visible face markers (the desk the cubes sit on)
      var planePts = [];
      this.visibleCubeFaces().forEach(function (el) { var o = el.object3D; var p = new THREE.Vector3(); o.getWorldPosition(p);
        var q = new THREE.Quaternion(); o.getWorldQuaternion(q); planePts.push({ pos: p, normal: new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize() }); });
      visGuns.forEach(function (g) { var o = g.el.object3D; var p = new THREE.Vector3(); o.getWorldPosition(p);
        var q = new THREE.Quaternion(); o.getWorldQuaternion(q); planePts.push({ pos: p, normal: new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize() }); });
      if (!centres.length) { this.flash('No cube visible — point at a cube face first'); return; }
      if (planePts.length < 1) { this.flash('Hold steady…'); return; }

      var fr = this.buildFrame(planePts), pl = fr.pl, Minv = fr.Minv;
      var rot = new THREE.Matrix4().extractRotation(Minv);

      // charges → local 3-D positions (keeps the cube height above the desk → true 3-D field)
      var charges = [];
      for (var i = 0; i < centres.length; i++) charges.push({ pos: centres[i].pos.clone().applyMatrix4(Minv), q: centres[i].q });

      // guns → local muzzle pose, firing along the printed arrow (marker +X) projected onto the desk
      var gunsF = [];
      for (i = 0; i < visGuns.length; i++) { var g = visGuns[i];
        var wp = new THREE.Vector3(); g.el.object3D.getWorldPosition(wp);
        var wq = new THREE.Quaternion(); g.el.object3D.getWorldQuaternion(wq);
        var lp = wp.clone().applyMatrix4(Minv);
        var f = new THREE.Vector3(1, 0, 0).applyQuaternion(wq).applyMatrix4(rot); f.y = 0;
        if (f.lengthSq() < 1e-6) f.set(1, 0, 0); f.normalize();
        for (var t = 0; t < this.cfg.gundir; t++) { var tx = f.x; f.x = -f.z; f.z = tx; }
        gunsF.push({ pos: lp, dir: f, q: g.q, color: g.color });
      }

      var anchorEls = this.cubePos.concat(this.cubeNeg).concat(this.guns.map(function (g) { return g.el; }));
      var anchors = this.captureAnchors(anchorEls, fr.M);
      this.frozen = { charges: charges, guns: gunsF, anchors: anchors };
      this.locked = true; this.buildKey = '';
      fr.M.decompose(this._apos, this._aquat, this._scl); this._haveA = true; this._scl.set(1, 1, 1);
      EFieldUtil.clear(this.liveGroup);

      var S = 0.9; for (i = 0; i < charges.length; i++) S = Math.max(S, charges[i].pos.length()); this._S = S + 1.1;
      this.setUIState();
      this.flash(centres.length + ' charge' + (centres.length !== 1 ? 's' : '') + ' locked at cube centre' + (centres.length !== 1 ? 's' : '') + ' · move around');
    },

    rebuild: function () {
      this.builder.build(this.frozen.charges);
      this.builder.buildPotential(this.frozen.charges, this._S);
      this.builder.buildTrajectories(this.frozen.guns, this.frozen.charges, this._S);
    },

    tick: function (time) {
      var msg;
      if (!this.locked) {
        var faces = this.visibleCubeFaces();
        var cp = this.cubeCentreWorld(this.cubePos), cn = this.cubeCentreWorld(this.cubeNeg);
        var preview = []; if (cp) preview.push({ pos: cp.pos, q: 1 }); if (cn) preview.push({ pos: cn.pos, q: -1 });
        this.livePreview(preview);
        this.maybeAutoLock(time, preview.length);
        msg = faces.length ? (faces.length + ' face' + (faces.length > 1 ? 's' : '') + ' seen — hold steady to lock…')
                           : 'Point at a cube so its faces are seen…';
      } else {
        var seen = this.frozen.anchors.filter(function (an) { return an.el.object3D.visible; }).length;
        msg = seen ? ('Locked · ' + this.frozen.charges.length + ' charge' + (this.frozen.charges.length !== 1 ? 's' : '') + ' · tracking ' + seen + ' marker' + (seen > 1 ? 's' : ''))
                   : 'Locked · point back at a cube to keep tracking';
        this.updateAnchor();
        var key = this.builder.show.field + '|' + this.builder.show.pot;
        if (key !== this.buildKey) { this.rebuild(); this.buildKey = key; }
        this.builder.animate(time, this.frozen.guns);
      }
      var shown = (this._flash && time < this._flashUntil) ? this._flash : msg;
      if (this.statusEl.textContent !== shown) this.statusEl.textContent = shown;
    }
  }));
})();
