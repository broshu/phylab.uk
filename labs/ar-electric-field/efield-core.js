/* =====================================================================
   efield-core.js  —  shared physics + geometry for the AR Electric Field lab
   ---------------------------------------------------------------------
   Three things live here, all framework-agnostic (plain THREE.js):

     EFieldUtil      small shared helpers (config parsing, plane fit /
                     PCA eigenvector, rigid-frame pose recovery).
     EFieldPlanar    2-D, in-plane visualiser: grid, field lines that
                     stay in the desk plane, a potential height-surface,
                     charge glyphs and the +/- electron-gun trajectories.
                     Used by the Plane-AR page and the Photo page.
     EField3D        full 3-D field lines (sphere-seeded Coulomb tubes)
                     for charges floating in space, plus 3-D electron-gun
                     trajectories.  Used by the Cube-AR page.

   Both builders write into caller-supplied THREE.Group()s and map their
   internal coordinates to world/anchor space through a caller-supplied
   L(a,b,h) (planar) or directly via local Vector3s (3-D).  This lets the
   exact same maths drive a live AR anchor, a frozen anchor, or a static
   photo without copy-pasting the geometry code three times.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---- colours used across the whole lab ---- */
  var COL = {
    pos:      '#ff5b5b',  // positive charge / field leaving +
    neg:      '#4f9bff',  // negative charge / field entering −
    posFill:  '#ff4d4d',
    negFill:  '#3b9bff',
    arrow:    '#ffd34f',  // field-direction arrowheads
    gunPos:   '#ffd76a',  // positive electron gun (fires e⁺)
    gunNeg:   '#7fd0ff',  // negative electron gun (fires e⁻)
    gridMain: '#39e0c8',
    gridFaint:'#1f6f8c'
  };

  /* =================================================================
     EFieldUtil — parsing + geometry helpers shared by everything
     ================================================================= */
  var EFieldUtil = {
    COL: COL,

    /* read all tuning knobs from ?query= with sensible defaults */
    readConfig: function (search) {
      var q = new URLSearchParams(search || '');
      var num = function (k, d) { var v = parseFloat(q.get(k)); return isFinite(v) ? v : d; };
      return {
        K:       num('k', 0.45),     // Coulomb strength
        SOFT:    num('soft', 0.16),  // softening for the field (avoids blow-up at r→0)
        SSOFT:   num('ssoft', 0.05), // tiny softening for the potential surface → sharp peaks
        PSMOOTH: Math.round(num('psmooth', 4)),
        HEIGHT:  num('height', 0.4), // potential → height scale
        HCLAMP:  num('hclamp', 4.0), // max |height|
        gundir:  Math.round(num('gundir', 0)) & 3,
        cube:    num('cube', 1.0),   // cube half-edge in marker-width units
        lift:    num('lift', 2.0),   // Plane AR: how far above the sticker the charge floats (in marker-widths)
        tube3d:  num('tube', 0.025), // 3-D field-line tube radius (bold + glow)
        seeds3d: Math.round(num('seeds', 18)), // 3-D field lines per point source
        plateSide: num('plateside', 4.0),      // charged-plate side length in marker-widths
        plateQ:    num('plateq', 2.0),         // charged-plate total charge in point-charge units
        plateGrid: Math.round(num('plategrid', 7)),  // plate modelled as N×N sub-charges
        plateSeed: Math.round(num('plateseed', 4)),  // field lines per plate face = K×K
        smooth:  num('smooth', 0.3), // anchor pose smoothing (lock modes)
        _hasSmooth: q.has('smooth'),
        autolock:num('autolock', 1), // 1 = auto-freeze once markers are stable
        pcfg: {
          speed:    num('pspeed', 0.7),
          force:    num('pforce', 0.5),
          dt:       0.03,
          maxSteps: 520
        }
      };
    },

    /* Best-fit plane through a set of {pos, normal}.
       1 point → its own plane; 2 → averaged normals; 3+ → PCA (least squares). */
    fitPlane: function (pts) {
      var i, c, n = pts.length, origin = new THREE.Vector3();
      for (i = 0; i < n; i++) origin.add(pts[i].pos);
      origin.multiplyScalar(1 / n);
      var normal = new THREE.Vector3(), v = new THREE.Vector3();
      if (n <= 2) {
        for (i = 0; i < n; i++) normal.add(pts[i].normal);
        if (normal.lengthSq() < 1e-9) normal.set(0, 1, 0);
        normal.normalize();
      } else {
        var xx=0,xy=0,xz=0,yy=0,yz=0,zz=0;
        for (i = 0; i < n; i++) {
          var d = v.subVectors(pts[i].pos, origin);
          xx+=d.x*d.x; xy+=d.x*d.y; xz+=d.x*d.z; yy+=d.y*d.y; yz+=d.y*d.z; zz+=d.z*d.z;
        }
        normal = this.smallestEigenVector([[xx,xy,xz],[xy,yy,yz],[xz,yz,zz]]);
        var avg = new THREE.Vector3();
        for (i = 0; i < n; i++) avg.add(pts[i].normal);
        if (normal.dot(avg) < 0) normal.multiplyScalar(-1);
      }
      var ref = Math.abs(normal.y) < 0.92 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
      var u = new THREE.Vector3().crossVectors(ref, normal).normalize();
      var w = new THREE.Vector3().crossVectors(normal, u).normalize();
      return { origin: origin, normal: normal, u: u, v: w };
    },

    /* eigenvector of the smallest eigenvalue of a symmetric 3×3 (Jacobi) */
    smallestEigenVector: function (A) {
      var a=[A[0].slice(),A[1].slice(),A[2].slice()], V=[[1,0,0],[0,1,0],[0,0,1]], s,i;
      for (s=0;s<24;s++){
        var p=0,qd=1,max=Math.abs(a[0][1]),o02=Math.abs(a[0][2]),o12=Math.abs(a[1][2]);
        if(o02>max){max=o02;p=0;qd=2;} if(o12>max){max=o12;p=1;qd=2;}
        if(max<1e-10) break;
        var app=a[p][p],aqq=a[qd][qd],apq=a[p][qd],phi=0.5*Math.atan2(2*apq,aqq-app),c=Math.cos(phi),si=Math.sin(phi);
        for(i=0;i<3;i++){var x=a[i][p],y=a[i][qd];a[i][p]=c*x-si*y;a[i][qd]=si*x+c*y;}
        for(i=0;i<3;i++){var x2=a[p][i],y2=a[qd][i];a[p][i]=c*x2-si*y2;a[qd][i]=si*x2+c*y2;}
        for(i=0;i<3;i++){var x3=V[i][p],y3=V[i][qd];V[i][p]=c*x3-si*y3;V[i][qd]=si*x3+c*y3;}
      }
      var e=[a[0][0],a[1][1],a[2][2]],mi=0; if(e[1]<e[mi])mi=1; if(e[2]<e[mi])mi=2;
      return new THREE.Vector3(V[0][mi],V[1][mi],V[2][mi]).normalize();
    },

    /* Average a set of pose estimates {p:Vector3, q:Quaternion} into one
       smoothed pose.  This is the heart of the jitter fix: many noisy marker
       readings are averaged into ONE rigid frame, then low-pass filtered. */
    averagePose: function (ests, outPos, outQuat, smoothAlpha, havePrev) {
      if (!ests.length) return false;
      var ap = new THREE.Vector3(), aq = null, i, e;
      for (i = 0; i < ests.length; i++) {
        e = ests[i]; ap.add(e.p);
        if (!aq) aq = e.q.clone();
        else {
          if (aq.dot(e.q) < 0) { e.q.x*=-1; e.q.y*=-1; e.q.z*=-1; e.q.w*=-1; }
          aq.x+=e.q.x; aq.y+=e.q.y; aq.z+=e.q.z; aq.w+=e.q.w;
        }
      }
      ap.multiplyScalar(1 / ests.length); aq.normalize();
      if (!havePrev) { outPos.copy(ap); outQuat.copy(aq); }
      else { outPos.lerp(ap, smoothAlpha); outQuat.slerp(aq, smoothAlpha); }
      return true;
    },

    /* dispose + empty a THREE.Group */
    clear: function (group) {
      for (var i = group.children.length - 1; i >= 0; i--) {
        var o = group.children[i];
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
        group.remove(o);
      }
    },

    /* a camera-facing +/- disk sprite */
    chargeGlyph: function (q) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 128;
      var g = cv.getContext('2d');
      g.fillStyle = q > 0 ? COL.posFill : COL.negFill;
      g.beginPath(); g.arc(64,64,58,0,Math.PI*2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(34,64); g.lineTo(94,64);
      if (q > 0) { g.moveTo(64,34); g.lineTo(64,94); }
      g.stroke();
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
      sp.renderOrder = 999;
      return sp;
    }
  };

  /* =================================================================
     EFieldPlanar — 2-D, in-plane visualiser (grid + field + potential)
       cfg     : config object from EFieldUtil.readConfig
       groups  : { grid, field, pot, glyph, traj, particle }
       L(a,b,h): map plane coords (a,b) + height h to world/anchor Vector3
       lightTarget : group lights are added to (for the potential surface)
       ringNormal()? : optional fn returning plane normal Quaternion (photo)
     ================================================================= */
  function EFieldPlanar(opts) {
    this.cfg = opts.cfg;
    this.g = opts.groups;
    this.L = opts.L;
    this.lightTarget = opts.lightTarget || null;
    this.ringQuat = opts.ringQuat || null;   // Quaternion or null
    this.mode3d = !!opts.mode3d;
    this.potOpacity = opts.potOpacity != null ? opts.potOpacity : 0.85;
    this.show = { grid: true, field: true, pot: false };
    this._lit = false;
  }
  EFieldPlanar.prototype = {
    field2D: function (a, b, cs) {
      var Ea=0,Eb=0,i,c,dx,dy,r2,r,r3,K=this.cfg.K,S2=this.cfg.SOFT*this.cfg.SOFT;
      for (i=0;i<cs.length;i++){ c=cs[i]; dx=a-c.a; dy=b-c.b; r2=dx*dx+dy*dy+S2; r=Math.sqrt(r2); r3=r2*r;
        Ea+=K*c.q*dx/r3; Eb+=K*c.q*dy/r3; }
      return { Ea: Ea, Eb: Eb };
    },
    potential2D: function (a, b, cs) {
      var V=0,i,c,dx,dy,K=this.cfg.K,S2=this.cfg.SOFT*this.cfg.SOFT;
      for (i=0;i<cs.length;i++){ c=cs[i]; dx=a-c.a; dy=b-c.b; V+=K*c.q/Math.sqrt(dx*dx+dy*dy+S2); }
      return V;
    },
    pHeight: function (a, b, cs) {
      if (this.show.pot && cs.length) {
        var V = this.potential2D(a,b,cs);
        return Math.max(-this.cfg.HCLAMP, Math.min(this.cfg.HCLAMP, V*this.cfg.HEIGHT)) + 0.02;
      }
      return 0.02;
    },

    /* tech grid laid on the plane */
    buildGrid: function (cs2, S) {
      EFieldUtil.clear(this.g.grid); if (!this.show.grid) return;
      var div = Math.max(8, Math.min(28, Math.round(S*4))), step=(2*S)/div, pos=[], col=[];
      var cM=new THREE.Color(COL.gridMain), cF=new THREE.Color(COL.gridFaint), self=this, i;
      function Ln(p1,p2,c,o){ pos.push(p1.x,p1.y,p1.z,p2.x,p2.y,p2.z); for(var s=0;s<2;s++) col.push(c.r*o,c.g*o,c.b*o); }
      for (i=0;i<=div;i++){ var t=-S+i*step, maj=(i%4===0), c=maj?cM:cF, o=maj?1:0.55;
        Ln(self.L(t,-S,0.002), self.L(t,S,0.002), c, o);
        Ln(self.L(-S,t,0.002), self.L(S,t,0.002), c, o); }
      var geo=new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
      this.g.grid.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors:true, transparent:true, opacity:0.55 })));
    },

    /* field lines, traced inside the plane (RK2) */
    buildField: function (cs2, S) {
      EFieldUtil.clear(this.g.field); if (!this.show.field || !cs2.length) return;
      var hasPos = cs2.some(function(c){return c.q>0;});
      var src = cs2.filter(function(c){ return hasPos ? c.q>0 : c.q<0; });
      var seedR = hasPos ? 0.18 : S*0.85, nSeed = 14;
      var opts = { step:0.05, maxSteps:240, minR:0.16, maxR:S*1.25 };
      for (var s=0;s<src.length;s++) for (var i=0;i<nSeed;i++){
        var th=(i/nSeed)*Math.PI*2;
        var line=this.traceField(src[s].a+seedR*Math.cos(th), src[s].b+seedR*Math.sin(th), cs2, opts);
        if (line.length<2) continue;
        this.addTube(this.g.field, line, src[s].q>0?COL.pos:COL.neg, COL.neg);
        this.addArrows(this.g.field, line);
      }
    },
    traceField: function (a, b, cs2, opts) {
      var pts=[], A=a, B=b, st=opts.step, i;
      for (i=0;i<opts.maxSteps;i++){
        pts.push(this.L(A,B,0.012));
        var f1=this.field2D(A,B,cs2), l1=Math.hypot(f1.Ea,f1.Eb); if (l1<1e-7) break;
        var k1a=(f1.Ea/l1)*st, k1b=(f1.Eb/l1)*st;
        var f2=this.field2D(A+k1a,B+k1b,cs2), l2=Math.hypot(f2.Ea,f2.Eb), dA=k1a, dB=k1b;
        if (l2>1e-7){ dA=0.5*(k1a+(f2.Ea/l2)*st); dB=0.5*(k1b+(f2.Eb/l2)*st); }
        A+=dA; B+=dB; var stop=false;
        for (var j=0;j<cs2.length;j++){ if (Math.hypot(A-cs2[j].a,B-cs2[j].b)<opts.minR){ pts.push(this.L(A,B,0.012)); stop=true; break; } }
        if (stop) break;
        if (Math.hypot(A,B)>opts.maxR){ pts.push(this.L(A,B,0.012)); break; }
      }
      return pts;
    },

    addTube: function (group, points, cFrom, cTo) {
      if (points.length<2) return;
      var curve=new THREE.CatmullRomCurve3(points), seg=Math.min(80,Math.max(8,points.length));
      var geo=new THREE.TubeGeometry(curve,seg,0.009,4,false);
      var cA=new THREE.Color(cFrom), cB=new THREE.Color(cTo), p=geo.attributes.position, colors=new Float32Array(p.count*3), ring=5,i;
      for (i=0;i<p.count;i++){ var t=Math.floor(i/ring)/Math.max(1,p.count/ring), c=cA.clone().lerp(cB,Math.min(1,t));
        colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
      group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors:true })));
    },
    addArrows: function (group, pts) {
      var every=Math.max(10,Math.floor(pts.length/3)),i;
      for (i=every;i<pts.length-1;i+=every){
        var dir=new THREE.Vector3().subVectors(pts[i+1],pts[i]); if (dir.lengthSq()<1e-9) continue;
        var cone=new THREE.Mesh(new THREE.ConeGeometry(0.028,0.075,10), new THREE.MeshBasicMaterial({ color: COL.arrow }));
        cone.position.copy(pts[i]); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
        group.add(cone);
      }
    },

    /* potential height-surface: sharp +hills, black-hole −wells, smoothed */
    buildPotential: function (cs2, S) {
      EFieldUtil.clear(this.g.pot); if (!this.show.pot || !cs2.length) return;
      var N=128, M=N+1, geo=new THREE.PlaneGeometry(2*S,2*S,N,N), pos=geo.attributes.position, cnt=pos.count;
      var colors=new Float32Array(cnt*3);
      var cHot=new THREE.Color('#ff6a4f'), cTip=new THREE.Color('#fff2cf'), cMid=new THREE.Color('#0c1626'), cHole=new THREE.Color('#000000');
      var ss=this.cfg.SSOFT, abx=new Float32Array(cnt), aby=new Float32Array(cnt), hgt=new Float32Array(cnt), self=this, i;
      var Vat=function(a,b){ var V=0,k,c,dx,dy; for(k=0;k<cs2.length;k++){ c=cs2[k]; dx=a-c.a; dy=b-c.b; V+=self.cfg.K*c.q/Math.sqrt(dx*dx+dy*dy+ss*ss); } return V; };
      for (i=0;i<cnt;i++){ var a=pos.getX(i), b=pos.getY(i); abx[i]=a; aby[i]=b;
        hgt[i]=Math.max(-this.cfg.HCLAMP, Math.min(this.cfg.HCLAMP, Vat(a,b)*this.cfg.HEIGHT)); }
      var al=0.5, p2;
      for (p2=0;p2<this.cfg.PSMOOTH;p2++){ var sm=hgt.slice();
        for (var y=1;y<N;y++) for (var x=1;x<N;x++){ var idx=y*M+x;
          hgt[idx]=sm[idx]*(1-al)+(sm[idx-1]+sm[idx+1]+sm[idx-M]+sm[idx+M])*(al*0.25); } }
      for (var ci=0;ci<cs2.length;ci++){ var bi=-1,bd=1e9; for(i=0;i<cnt;i++){ var ddx=abx[i]-cs2[ci].a, ddy=aby[i]-cs2[ci].b, dd=ddx*ddx+ddy*ddy; if(dd<bd){bd=dd;bi=i;} }
        if (bi>=0){ abx[bi]=cs2[ci].a; aby[bi]=cs2[ci].b; hgt[bi]=Math.max(-this.cfg.HCLAMP,Math.min(this.cfg.HCLAMP,Vat(cs2[ci].a,cs2[ci].b)*this.cfg.HEIGHT)); } }
      for (i=0;i<cnt;i++){ var L=this.L(abx[i],aby[i],hgt[i]); pos.setXYZ(i,L.x,L.y,L.z);
        var vt=Math.max(-1,Math.min(1,hgt[i]/this.cfg.HCLAMP)), c;
        if (vt>=0){ c=cMid.clone().lerp(cHot,Math.pow(vt,0.5)); if(vt>0.75) c.lerp(cTip,(vt-0.75)/0.25*0.85); }
        else c=cMid.clone().lerp(cHole,Math.pow(-vt,0.45));
        colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b; }
      pos.needsUpdate=true;
      geo.setAttribute('color', new THREE.BufferAttribute(colors,3)); geo.computeVertexNormals();
      var mat=new THREE.MeshPhongMaterial({ vertexColors:true, side:THREE.DoubleSide, shininess:30, specular:0x1b2230, flatShading:false,
        transparent:this.mode3d, opacity:this.mode3d?this.potOpacity:1, depthWrite:!this.mode3d });
      this.g.pot.add(new THREE.Mesh(geo, mat));
      if (!this._lit && this.lightTarget){ var amb=new THREE.AmbientLight(0xffffff,0.7), dir=new THREE.DirectionalLight(0xffffff,0.7);
        dir.position.set(2,5,2); this.lightTarget.add(amb); this.lightTarget.add(dir); this._lit=true; }
      for (var ri=0;ri<cs2.length;ri++){ if (cs2[ri].q<0){
        var rg=new THREE.Mesh(new THREE.TorusGeometry(0.16,0.02,12,48), new THREE.MeshBasicMaterial({ color:'#7ad0ff', transparent:true, opacity:0.9 }));
        rg.position.copy(this.L(cs2[ri].a,cs2[ri].b,0.01));
        if (this.ringQuat){ rg.quaternion.copy(this.ringQuat); rg.rotateX(Math.PI/2); } else rg.rotation.x=Math.PI/2;
        this.g.pot.add(rg); } }
    },

    buildGlyphs: function (cs2) {
      EFieldUtil.clear(this.g.glyph);
      for (var i=0;i<cs2.length;i++){ var sp=EFieldUtil.chargeGlyph(cs2[i].q);
        sp.position.copy(this.L(cs2[i].a,cs2[i].b,this.pHeight(cs2[i].a,cs2[i].b,cs2)));
        sp.scale.set(0.18,0.18,0.18); this.g.glyph.add(sp); }
    },

    /* gun trajectory: integrate a test charge once through the frozen field */
    traceParticle: function (gun, cs2, S) {
      var cfg=this.cfg.pcfg, dt=cfg.dt, path=[], A=gun.a+gun.da*0.16, B=gun.b+gun.db*0.16,
          va=gun.da*cfg.speed, vb=gun.db*cfg.speed, maxR=S*1.4, i;
      for (i=0;i<cfg.maxSteps;i++){ path.push({a:A,b:B});
        var f=this.field2D(A,B,cs2); va+=f.Ea*gun.q*cfg.force*dt; vb+=f.Eb*gun.q*cfg.force*dt; A+=va*dt; B+=vb*dt;
        if (Math.hypot(A,B)>maxR){ path.push({a:A,b:B}); break; }
        var hit=false; for (var j=0;j<cs2.length;j++){ if (cs2[j].q*gun.q<0 && Math.hypot(A-cs2[j].a,B-cs2[j].b)<0.12){ path.push({a:A,b:B}); hit=true; break; } }
        if (hit) break;
      }
      return path;
    },
    buildTrajectories: function (guns, cs2, S) {
      EFieldUtil.clear(this.g.traj);
      for (var gi=0;gi<guns.length;gi++){ var gun=guns[gi]; gun.path2=null;
        var path=this.traceParticle(gun,cs2,S); if (path.length<2) continue;
        gun.path2=path; gun.dur=Math.max(2200,path.length*14);
        var self=this, wpts=path.map(function(p){ return self.L(p.a,p.b,self.pHeight(p.a,p.b,cs2)); });
        this.g.traj.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(wpts),
          new THREE.LineBasicMaterial({ color:gun.color, transparent:true, opacity:0.35 })));
      }
    },
    animate: function (time, guns, cs2) {
      EFieldUtil.clear(this.g.particle);
      for (var gi=0;gi<guns.length;gi++){ var gun=guns[gi]; if (!gun.path2) continue;
        var n=gun.path2.length, col=new THREE.Color(gun.color), CT=3, k;
        for (k=0;k<CT;k++){
          var ph=(((time/gun.dur)+k/CT)%1), fi=ph*(n-1), i0=Math.floor(fi), f=fi-i0, i1=Math.min(n-1,i0+1);
          var P=gun.path2[i0], Q=gun.path2[i1], a=P.a+(Q.a-P.a)*f, b=P.b+(Q.b-P.b)*f;
          var s=new THREE.Mesh(new THREE.SphereGeometry(0.05,16,16), new THREE.MeshBasicMaterial({ color:col }));
          s.position.copy(this.L(a,b,this.pHeight(a,b,cs2))); this.g.particle.add(s);
        }
      }
    }
  };

  /* =================================================================
     EField3D — full 3-D field lines for charges floating in space.
       groups : { field, glyph, traj, particle }
       Charges are { pos: THREE.Vector3 (local/anchor frame), q }.
     ================================================================= */
  function EField3D(opts) {
    this.cfg = opts.cfg;
    this.g = opts.groups;
    this.show = { field: true };
  }
  EField3D.prototype = {
    fieldAt: function (p, charges) {
      var E=new THREE.Vector3(), d=new THREE.Vector3(), i,c,r2,r;
      for (i=0;i<charges.length;i++){ c=charges[i]; d.subVectors(p,c.pos); r2=d.lengthSq();
        if (r2<1e-5) continue; r=Math.sqrt(r2); E.addScaledVector(d, c.q/(r2*r)); }
      return E;
    },
    seedSphere: function (center, radius, n) {
      var seeds=[], phi=Math.PI*(3-Math.sqrt(5)), i;
      for (i=0;i<n;i++){ var y=1-(i/(n-1))*2, r=Math.sqrt(Math.max(0,1-y*y)), t=phi*i;
        seeds.push(new THREE.Vector3(center.x+radius*Math.cos(t)*r, center.y+radius*y, center.z+radius*Math.sin(t)*r)); }
      return seeds;
    },
    traceLine: function (seed, elements, dir, opts) {
      var pts=[], p=seed.clone(), E=new THREE.Vector3(), i, k, sinks=opts.sinks;
      for (i=0;i<opts.maxSteps;i++){ pts.push(p.clone()); E.copy(this.fieldAt(p,elements));
        var len=E.length(); if (len<1e-7) break; E.multiplyScalar((dir*opts.step)/len); p.add(E);
        var done=false;
        if (sinks){
          for (k=0;k<sinks.points.length;k++){ if (p.distanceTo(sinks.points[k])<opts.minR){ pts.push(p.clone()); done=true; break; } }
          if (!done) for (k=0;k<sinks.plates.length;k++){ if (this.plateDist(p,sinks.plates[k])<opts.minR){ pts.push(p.clone()); done=true; break; } }
        } else {
          for (k=0;k<elements.length;k++){ if (p.distanceTo(elements[k].pos)<opts.minR){ pts.push(p.clone()); done=true; break; } }
        }
        if (done) break;
        if (p.distanceTo(opts.center)>opts.maxR){ pts.push(p.clone()); break; }
      }
      return pts;
    },

    /* ---- charged-plate helpers ---- */
    /* seed points spread over BOTH faces of a plate, just off the surface */
    seedPlate: function (plate, K) {
      var seeds=[], eps=0.12, i, j;
      for (i=0;i<K;i++){ var xi=-plate.half + (2*plate.half)*(K<=1?0.5:i/(K-1));
        for (j=0;j<K;j++){ var yj=plate.height*(K<=1?0.5:j/(K-1));
          var b=plate.base.clone().addScaledVector(plate.ux,xi).addScaledVector(plate.uy,yj);
          seeds.push(b.clone().addScaledVector(plate.n, eps));
          seeds.push(b.clone().addScaledVector(plate.n,-eps)); } }
      return seeds;
    },
    /* distance from P to the finite plate (clamped to the square) */
    plateDist: function (P, plate) {
      var d=P.clone().sub(plate.base);
      var a=Math.max(-plate.half, Math.min(plate.half, d.dot(plate.ux)));
      var b=Math.max(0, Math.min(plate.height, d.dot(plate.uy)));
      return P.distanceTo(plate.base.clone().addScaledVector(plate.ux,a).addScaledVector(plate.uy,b));
    },

    /* expand the scene items into field "elements" (point charges + plate sub-charges) */
    _scene: function (items) {
      var elements=[], keypts=[], hasPos=false, hasNeg=false, M=Math.max(2,this.cfg.plateGrid), i, j, it;
      for (it=0; it<items.length; it++){ var item=items[it];
        if (item.plate){
          if (item.q>0) hasPos=true; else hasNeg=true;
          var qsub=(this.cfg.plateQ*item.q)/(M*M);   // uniform: total = plateQ × point charge
          for (i=0;i<M;i++){ var xi=-item.half + (2*item.half)*(i/(M-1));
            for (j=0;j<M;j++){ var yj=item.height*(j/(M-1));
              elements.push({ pos:item.base.clone().addScaledVector(item.ux,xi).addScaledVector(item.uy,yj), q:qsub }); } }
          var corners=[[-item.half,0],[item.half,0],[-item.half,item.height],[item.half,item.height]];
          for (i=0;i<4;i++) keypts.push(item.base.clone().addScaledVector(item.ux,corners[i][0]).addScaledVector(item.uy,corners[i][1]));
        } else {
          if (item.q>0) hasPos=true; else hasNeg=true;
          elements.push({ pos:item.pos, q:item.q }); keypts.push(item.pos);
        }
      }
      return { elements:elements, keypts:keypts, hasPos:hasPos, hasNeg:hasNeg };
    },

    build: function (items) {
      EFieldUtil.clear(this.g.field); EFieldUtil.clear(this.g.glyph); if (this.g.plate) EFieldUtil.clear(this.g.plate);
      this.elements=[];
      if (!this.show.field || !items.length){ this.buildGlyphs(items); return; }
      var sc=this._scene(items); this.elements=sc.elements;
      var center=new THREE.Vector3(), i, j;
      for (i=0;i<sc.keypts.length;i++) center.add(sc.keypts[i]); center.multiplyScalar(1/sc.keypts.length);
      var spread=0; for (i=0;i<sc.keypts.length;i++) for (j=i+1;j<sc.keypts.length;j++) spread=Math.max(spread, sc.keypts[i].distanceTo(sc.keypts[j]));
      var hasPos=sc.hasPos, hasNeg=sc.hasNeg, dipole=hasPos&&hasNeg;
      var maxR=dipole ? spread*6+2.0 : spread*1.6+1.5;
      var sourceSign=hasPos?1:-1, dir=sourceSign>0?+1:-1;
      // sinks = items of opposite sign to the sources (where lines terminate)
      var sinks={ points:[], plates:[] };
      for (i=0;i<items.length;i++){ var it=items[i]; if (it.q*sourceSign<0){ if (it.plate) sinks.plates.push(it); else sinks.points.push(it.pos); } }
      var opts={ step:0.04, maxSteps: dipole?2200:600, minR:0.13, maxR:maxR, center:center, sinks:sinks };
      for (i=0;i<items.length;i++){ var src=items[i]; if (src.q*sourceSign<=0) continue;     // sources of the chosen sign
        var cFrom=src.q>0?COL.pos:COL.neg, cTo=(src.q>0&&hasNeg)?COL.neg:cFrom;
        var seeds = src.plate ? this.seedPlate(src, this.cfg.plateSeed) : this.seedSphere(src.pos,0.2,this.cfg.seeds3d);
        for (j=0;j<seeds.length;j++){ var pts=this.traceLine(seeds[j], this.elements, dir, opts);
          this.addTube(this.g.field, pts, cFrom, cTo); this.decorateArrows(this.g.field, pts, COL.arrow, sourceSign>0); }
      }
      for (i=0;i<items.length;i++) if (items[i].plate) this.drawPlate(items[i]);
      this.buildGlyphs(items);
    },

    /* translucent charged plate + border + sign glyph */
    drawPlate: function (plate) {
      var grp=this.g.plate||this.g.glyph, col=plate.q>0?COL.posFill:COL.negFill;
      var geo=new THREE.PlaneGeometry(2*plate.half, plate.height);
      var m=new THREE.Matrix4().makeBasis(plate.ux, plate.uy, plate.n);
      var quat=new THREE.Quaternion().setFromRotationMatrix(m);
      var centre=plate.base.clone().addScaledVector(plate.uy, plate.height/2);
      var face=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.22, side:THREE.DoubleSide, depthWrite:false }));
      face.position.copy(centre); face.quaternion.copy(quat); grp.add(face);
      var edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color:col, transparent:true, opacity:0.9 }));
      edges.position.copy(centre); edges.quaternion.copy(quat); grp.add(edges);
      var sp=EFieldUtil.chargeGlyph(plate.q); sp.position.copy(centre); sp.scale.set(0.4,0.4,0.4); grp.add(sp);
    },

    buildGlyphs: function (items) {
      EFieldUtil.clear(this.g.glyph);
      for (var i=0;i<items.length;i++){ if (items[i].plate) continue; var sp=EFieldUtil.chargeGlyph(items[i].q);
        sp.position.copy(items[i].pos); sp.scale.set(0.3,0.3,0.3); this.g.glyph.add(sp); }
    },
    /* Bold, glowing 3-D tube: a soft additive glow underlay + a crisp gradient core. */
    addTube: function (group, points, cFrom, cTo) {
      if (points.length<2) return;
      var curve=new THREE.CatmullRomCurve3(points), seg=Math.min(120,Math.max(8,points.length*2));
      var R=this.cfg.tube3d;
      // glow underlay (additive, no depth write so the core always shows through)
      var gcol=new THREE.Color(cFrom).lerp(new THREE.Color(cTo),0.5);
      var gg=new THREE.TubeGeometry(curve,seg,R*2.6,8,false);
      group.add(new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color:gcol, transparent:true, opacity:0.16,
        blending:THREE.AdditiveBlending, depthWrite:false })));
      // crisp gradient core
      var geo=new THREE.TubeGeometry(curve,seg,R,8,false);
      var cA=new THREE.Color(cFrom), cB=new THREE.Color(cTo), pos=geo.attributes.position, colors=new Float32Array(pos.count*3), ring=9, i;
      for (i=0;i<pos.count;i++){ var t=Math.floor(i/ring)/Math.max(1,pos.count/ring); var c=cA.clone().lerp(cB,Math.min(1,t));
        colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
      group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors:true })));
    },
    addArrow: function (group, p, dir, colorHex) {
      if (dir.length()<1e-6) return;
      var r=Math.max(0.05, this.cfg.tube3d*2.4);
      var cone=new THREE.Mesh(new THREE.ConeGeometry(r,r*2.6,12), new THREE.MeshBasicMaterial({ color: colorHex }));
      cone.position.copy(p); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
      group.add(cone);
    },
    decorateArrows: function (group, pts, colorHex, forward) {
      var every=Math.max(8,Math.floor(pts.length/3)),i;
      for (i=every;i<pts.length-1;i+=every){ var dir=new THREE.Vector3().subVectors(pts[i+1],pts[i]); if(!forward) dir.multiplyScalar(-1);
        this.addArrow(group, pts[i], dir, colorHex); }
    },

    /* 3-D electron-gun trajectory: integrate a test charge through the field */
    traceParticle3D: function (gun, S) {
      var cfg=this.cfg.pcfg, dt=cfg.dt, path=[], els=this.elements||[];
      var p=gun.pos.clone().addScaledVector(gun.dir,0.16), vel=gun.dir.clone().multiplyScalar(cfg.speed);
      var maxR=S*1.6+1.2, E=new THREE.Vector3(), i, j;
      for (i=0;i<cfg.maxSteps;i++){ path.push(p.clone());
        E.copy(this.fieldAt(p,els)); vel.addScaledVector(E, gun.q*cfg.force*dt); p.addScaledVector(vel,dt);
        if (p.distanceTo(gun.pos)>maxR) { path.push(p.clone()); break; }
        var hit=false; for (j=0;j<els.length;j++){ if (els[j].q*gun.q<0 && p.distanceTo(els[j].pos)<0.1){ path.push(p.clone()); hit=true; break; } }
        if (hit) break;
      }
      return path;
    },
    buildTrajectories: function (guns, charges, S) {
      EFieldUtil.clear(this.g.traj);
      for (var gi=0;gi<guns.length;gi++){ var gun=guns[gi]; gun.path3=null;
        if (!gun.pos) continue;
        var path=this.traceParticle3D(gun,S); if (path.length<2) continue;
        gun.path3=path; gun.dur=Math.max(2200,path.length*14);
        this.g.traj.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path),
          new THREE.LineBasicMaterial({ color:gun.color, transparent:true, opacity:0.35 })));
      }
    },
    animate: function (time, guns) {
      EFieldUtil.clear(this.g.particle);
      for (var gi=0;gi<guns.length;gi++){ var gun=guns[gi]; if (!gun.path3) continue;
        var n=gun.path3.length, col=new THREE.Color(gun.color), CT=3, k;
        for (k=0;k<CT;k++){ var ph=(((time/gun.dur)+k/CT)%1), fi=ph*(n-1), i0=Math.floor(fi), f=fi-i0, i1=Math.min(n-1,i0+1);
          var P=gun.path3[i0], Q=gun.path3[i1];
          var s=new THREE.Mesh(new THREE.SphereGeometry(0.05,16,16), new THREE.MeshBasicMaterial({ color:col }));
          s.position.set(P.x+(Q.x-P.x)*f, P.y+(Q.y-P.y)*f, P.z+(Q.z-P.z)*f); this.g.particle.add(s);
        }
      }
    }
  };

  global.EFieldUtil = EFieldUtil;
  global.EFieldPlanar = EFieldPlanar;
  global.EField3D = EField3D;
})(window);
