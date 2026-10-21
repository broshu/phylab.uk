import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {C,sample} from './physics.js';

export function createScene(container,labelLayer) {
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#111e2a');
  scene.fog=new THREE.FogExp2('#111e2a',0.005);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(40,1,0.1,450);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=0.08;controls.minDistance=9;controls.maxDistance=150;controls.maxPolarAngle=Math.PI*.47;
  controls.target.set(-10,0,-5);controls.enablePan=true;
  scene.add(new THREE.HemisphereLight('#d8f5ff','#23334b',2.4));
  const sun=new THREE.DirectionalLight('#e4f7ff',3.3);sun.position.set(-25,65,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-75;sun.shadow.camera.right=75;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.bias=-.001;sun.shadow.normalBias=.1;scene.add(sun);
  const rim=new THREE.DirectionalLight('#6bd6ed',2.3);rim.position.set(35,20,-25);scene.add(rim);
  const mat=(color,roughness=.7,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
  function box(w,h,d,x,y,z,material,parent=scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
  function line(points,color,opacity=1,dashed=false){const geom=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const material=dashed?new THREE.LineDashedMaterial({color,transparent:true,opacity,dashSize:.8,gapSize:.55}):new THREE.LineBasicMaterial({color,transparent:true,opacity});const object=new THREE.Line(geom,material);if(dashed)object.computeLineDistances();scene.add(object);return object;}
  const ground=box(230,.2,180,-5,-.55,-5,mat('#101c27'));
  const grid=new THREE.GridHelper(200,80,'#2d4758','#243b4b');grid.position.y=-.42;grid.material.transparent=true;grid.material.opacity=.32;scene.add(grid);
  box(45,.25,6,-22.5,-.11,0,mat('#51778a',.22,{metalness:.35}));
  box(45,.04,.13,-22.5,.05,-3,mat('#91cfdf',.3,{emissive:'#43697c',emissiveIntensity:.25}));
  box(45,.04,.13,-22.5,.05,3,mat('#91cfdf',.3,{emissive:'#43697c',emissiveIntensity:.25}));
  // Sparse elongated facets communicate ice without requiring texture assets.
  const ice=mat('#8dbccc',.15,{transparent:true,opacity:.22,depthWrite:false});
  for(let i=0;i<30;i++){const x=-44+(i*13.37%43);const z=-2.6+(i*1.73%5.2);const m=box(1+(i%4),.01,.02,x,.035,z,ice);m.rotation.y=(i%5)*.13;}
  const roadPos=[],roadIndices=[];const n=100;
  for(let i=0;i<=n;i++){const angle=i/n*Math.PI/2;for(const r of [17,23])roadPos.push(r*Math.sin(angle),.025,-20+r*Math.cos(angle));if(i<n){const j=i*2;roadIndices.push(j,j+2,j+1,j+1,j+2,j+3);}}
  const roadGeometry=new THREE.BufferGeometry();roadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roadPos,3));roadGeometry.setIndex(roadIndices);roadGeometry.computeVertexNormals();
  const curve=new THREE.Mesh(roadGeometry,mat('#283e49',.97,{side:THREE.DoubleSide}));curve.receiveShadow=true;scene.add(curve);
  for(let i=0;i<63;i++){const theta=(i+.5)/63*Math.PI/2;const strip=box(6,.025,.07,20*Math.sin(theta),.06,-20+20*Math.cos(theta),mat(i%4===0?'#60808a':'#3d535c'));strip.rotation.y=theta-Math.PI/2;}
  for(const radius of [17,23]){const pts=[];for(let i=0;i<=100;i++){const a=i/100*Math.PI/2;pts.push([radius*Math.sin(a),.09,-20+radius*Math.cos(a)]);}line(pts,'#8babb3',.8);}
  for(let i=0;i<23;i++){const a=(i+.5)/23*Math.PI/2;for(const r of [16.7,23.3]){const m=box(.6,.12,1.05,r*Math.sin(a),.035,-20+r*Math.cos(a),mat(i%2?'#364c58':'#93b2bc'));m.rotation.y=a;}}
  line([[-45,.12,0],[0,.12,0]],'#d6f1ff',.5,true);
  const centerPts=[];for(let i=0;i<=100;i++){const a=i/100*Math.PI/2;centerPts.push([20*Math.sin(a),.13,-20+20*Math.cos(a)]);}line(centerPts,'#c4d9d9',.45,true);
  for(let j=0;j<2;j++)for(let i=0;i<8;i++) {box(.5,.025,.75,-44.75+j*.5,.05,-2.625+i*.75,mat((i+j)%2?'#294653':'#d0e8eb'));const m=box(.75,.025,.5,17.375+i*.75,.06,-19.75-j*.5,mat((i+j)%2?'#28404d':'#d8e7e8'));}
  line([[0,.12,0],[0,.12,-20],[20,.12,-20]],'#90b9c9',.45,true);
  const center=new THREE.Mesh(new THREE.RingGeometry(.3,.43,32),new THREE.MeshBasicMaterial({color:'#8eabb9',side:THREE.DoubleSide}));center.rotation.x=-Math.PI/2;center.position.set(0,.1,-20);scene.add(center);
  line([[-45,.1,8],[-45,.1,9.4]],'#8cabbc',.6);line([[0,.1,8],[0,.1,9.4]],'#8cabbc',.6);line([[-45,.1,8.7],[0,.1,8.7]],'#8cabbc',.4);
  const labels=[];
  function label(text,position,cls=''){const el=document.createElement('span');el.className='world-label '+cls;el.textContent=text;labelLayer.append(el);const item={el,position:new THREE.Vector3(...position),show:true};labels.push(item);return item;}
  label('A',[-45,.6,4.6],'point');label('B',[0,.6,4.8],'point');label('C',[21,.6,-24],'point');label('O',[0,.4,-22],'point');
  label('AB = 45 m',[-23,.3,10.7],'road');label('光滑冰面',[-27,.2,-4.8],'road');label('防滑弯道 · μ = 0.1',[27,.2,-9],'road');label('R = 20 m',[-2,.3,-10],'road');
  const cLabel=label('BC = 30 m',[12,.2,-24],'road');

  const car=new THREE.Group();car.scale.setScalar(1.35);scene.add(car);
  const paint=mat('#dc5e59',.2,{metalness:.45,transparent:true,opacity:.43,depthWrite:false,side:THREE.DoubleSide});
  const glass=mat('#99d3e6',.1,{metalness:.25,transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide});
  const dark=mat('#111b25',.45,{metalness:.5}), chrome=mat('#a9bfca',.22,{metalness:.85});
  // Cross-section loft: low nose, wide fenders, compact cabin, tapering rear.
  function loft(profiles,material){const positions=[],indices=[];for(const [x,w,bottom,shoulder,top] of profiles){const ring=[[-w,bottom],[-w,shoulder],[-w*.63,top],[w*.63,top],[w,shoulder],[w,bottom]];for(const [z,y] of ring)positions.push(x,y,z);}for(let j=0;j<profiles.length-1;j++)for(let k=0;k<6;k++){const a=j*6+k,b=j*6+(k+1)%6,c=(j+1)*6+k,d=(j+1)*6+(k+1)%6;indices.push(a,b,c,b,d,c);}for(let k=1;k<5;k++){indices.push(0,k+1,k);const s=(profiles.length-1)*6;indices.push(s,s+k,s+k+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.castShadow=true;car.add(mesh);const edge=new THREE.LineSegments(new THREE.EdgesGeometry(g,22),new THREE.LineBasicMaterial({color:'#ffaaa0',transparent:true,opacity:.55}));car.add(edge);return mesh;}
  loft([[-2.35,.68,.36,.7,.77],[-1.7,1,.25,.87,.96],[-.8,1.03,.25,.88,1],[.8,1,.25,.78,.93],[1.8,.91,.28,.57,.65],[2.45,.68,.32,.48,.49]],paint);
  loft([[-1.2,.72,.78,.94,1.05],[-.65,.65,.89,1.35,1.46],[.15,.6,.88,1.4,1.48],[1.05,.78,.81,.85,.9]],glass);
  box(4.1,.16,1.65,0,.3,0,dark,car);
  box(.08,.12,1.5,-2.33,.68,0,mat('#ff5047',.4,{emissive:'#f93231',emissiveIntensity:1.5}),car);
  for(const z of [-.64,.64]){box(.5,.065,.16,2,.55,z,mat('#ebfeff',.2,{emissive:'#c2f5ff',emissiveIntensity:2}),car);box(.18,.1,.23,.7,1,z*1.65,chrome,car);}
  box(1.4,.1,1.4,.15,.52,0,mat('#1b3041',.3,{metalness:.6}),car);
  // Visible pressure cylinders and lines beneath the translucent body.
  const tankMat=mat('#7be4e9',.26,{metalness:.6,emissive:'#2b9aa7',emissiveIntensity:.22});
  for(const z of [-.36,.36]){const tank=new THREE.Mesh(new THREE.CapsuleGeometry(.2,.85,5,12),tankMat);tank.rotation.z=Math.PI/2;tank.position.set(-.65,.7,z);car.add(tank);for(const x of [-1,-.3])box(.06,.42,.44,x,.69,z,chrome,car);}
  for(const z of [-.38,.38])box(.5,.43,.44,.4,.84,z,mat('#112736'),car);
  const wheels=[];
  for(const x of [-1.52,1.47])for(const z of [-1.01,1.01]){const group=new THREE.Group();group.position.set(x,.45,z);car.add(group);const tyre=new THREE.Mesh(new THREE.CylinderGeometry(.44,.44,.25,24),mat('#080e15',.9));tyre.rotation.x=Math.PI/2;tyre.castShadow=true;group.add(tyre);const rim=new THREE.Mesh(new THREE.CylinderGeometry(.29,.29,.27,24),chrome);rim.rotation.x=Math.PI/2;group.add(rim);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.29,12),dark);hub.rotation.x=Math.PI/2;group.add(hub);for(let i=0;i<5;i++){const spoke=box(.5,.055,.285,0,0,0,dark,group);spoke.rotation.z=i*Math.PI/5;}wheels.push(group);}
  for(const z of [-.4,.4]){const jet=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,.22,16),chrome);jet.rotation.z=Math.PI/2;jet.position.set(-2.35,.5,z);car.add(jet);}
  for(const x of [-.65,.65]){const jet=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.18,16),chrome);jet.rotation.x=Math.PI/2;jet.position.set(x,.47,1.05);car.add(jet);}
  const fanRing=new THREE.Mesh(new THREE.RingGeometry(.55,.63,48),new THREE.MeshBasicMaterial({color:'#a8e9b9',transparent:true,opacity:.7,side:THREE.DoubleSide}));fanRing.rotation.x=-Math.PI/2;fanRing.position.y=.19;car.add(fanRing);
  const fanRotor=new THREE.Group();fanRotor.position.set(0,.21,0);for(let i=0;i<4;i++){const blade=box(.85,.025,.1,0,0,0,chrome,fanRotor);blade.rotation.y=i*Math.PI/4;}car.add(fanRotor);
  const underglow=new THREE.Mesh(new THREE.CircleGeometry(2.4,48),new THREE.MeshBasicMaterial({color:'#83d9c0',transparent:true,opacity:.07,depthWrite:false}));underglow.rotation.x=-Math.PI/2;underglow.position.y=.03;car.add(underglow);
  const trail=line([[0,.2,0],[0,.2,0]],'#b9edb7',.85);
  const thrustArrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),8,'#70d8ef',.85,.48);scene.add(thrustArrow);
  const frictionArrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(),2.4,'#efbc77',.6,.32);scene.add(frictionArrow);
  const radialLine=line([[0,2,0],[0,2,0]],'#d8e6ec',.65,true);
  const radialHead=new THREE.Mesh(new THREE.ConeGeometry(.2,.65,12),new THREE.MeshBasicMaterial({color:'#d8e6ec',transparent:true,opacity:.7}));scene.add(radialHead);
  const thrustLabel=label('尾喷推力 20.0 kN',[0,0,0],'force');const frictionLabel=label('静摩擦 6.0 kN',[0,0,0],'force friction');const radialLabel=label('向心方向',[0,0,0]);
  const warningLabel=label('失稳：无法沿目标弯道运动',[0,0,0],'danger');
  const count=200,particlePositions=new Float32Array(count*3),particleColors=new Float32Array(count*3);
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));particleGeo.setAttribute('color',new THREE.BufferAttribute(particleColors,3));
  const particleMat=new THREE.PointsMaterial({size:.28,vertexColors:true,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true});const particles=new THREE.Points(particleGeo,particleMat);particles.frustumCulled=false;scene.add(particles);
  let cameraMode='orbit',lastPosition=new THREE.Vector3(),lastState=null,lastPlan=null,width=1,height=1;
  function cameraView(mode){cameraMode=mode;const aspect=width/height;if(mode==='top'){controls.target.set(-11,0,-6);camera.position.set(-11,Math.max(65,108/aspect),-5.99);}else if(mode==='follow'&&lastState){const p=new THREE.Vector3(lastState.x,0,lastState.z);controls.target.copy(p).add(new THREE.Vector3(0,1,0));camera.position.copy(p).add(new THREE.Vector3(11,13,19));lastPosition.copy(p);}else {cameraMode='orbit';controls.target.set(-11,0,-5);const distance=Math.max(61,105/aspect);camera.position.copy(controls.target).add(new THREE.Vector3(-.15,.65,1).normalize().multiplyScalar(distance));}controls.update();}
  function resize(){const previous=camera.aspect;width=container.clientWidth;height=container.clientHeight;camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();renderer.setSize(width,height,false);if(Math.abs(previous-camera.aspect)>.15&&cameraMode!=='follow')cameraView(cameraMode);}
  new ResizeObserver(resize).observe(container);resize();cameraView('orbit');
  function replaceLine(object,points){object.geometry.dispose();object.geometry=new THREE.BufferGeometry().setFromPoints(points);if(object.material.isLineDashedMaterial)object.computeLineDistances();}
  function update(p,s,opts){lastState=s;lastPlan=p;car.position.set(s.x,.06,s.z);car.rotation.y=s.heading;wheels.forEach(w=>w.rotation.z=-s.travel/(.44*1.35));fanRing.visible=p.fan;fanRotor.visible=p.fan;fanRotor.rotation.y=s.t*14;underglow.visible=p.fan;paint.opacity=opts.transparent?.43:1;paint.depthWrite=!opts.transparent;glass.opacity=opts.transparent?.28:.72;
    cLabel.el.textContent=`BC = ${p.exactPi?'31.42':'30'} m`;
    const tangent=new THREE.Vector3(Math.cos(s.heading),0,-Math.sin(s.heading)),inward=new THREE.Vector3(-Math.sin(s.heading),0,-Math.cos(s.heading));
    const carPosition=new THREE.Vector3(s.x,2.1,s.z);const thrust=s.tail||s.side;
    thrustArrow.visible=opts.forces&&thrust>0;frictionArrow.visible=opts.forces&&s.friction>0;
    thrustLabel.show=thrustArrow.visible;frictionLabel.show=frictionArrow.visible;
    if(thrust){const direction=s.tail?tangent:inward;const origin=carPosition.clone();if(s.side)origin.addScaledVector(tangent,-1.7);thrustArrow.position.copy(origin);thrustArrow.setDirection(direction);thrustArrow.setLength(thrust/2500,Math.min(.85,thrust/9000),.4);thrustLabel.position.copy(origin).addScaledVector(direction,thrust/2500+1).y+=1;thrustLabel.el.textContent=`${s.tail?'尾喷':'侧喷'}推力 ${(thrust/1000).toFixed(1)} kN`;}
    if(s.friction){const direction=s.slip?new THREE.Vector3(-1,0,0):inward;const origin=carPosition.clone().addScaledVector(tangent,1.7);frictionArrow.position.copy(origin);frictionArrow.setDirection(direction);frictionArrow.setLength(s.friction/2500,.55,.3);frictionLabel.position.copy(origin).addScaledVector(direction,s.friction/2500+1).y+=1;frictionLabel.el.textContent=`${s.slip?'动':'静'}摩擦 ${(s.friction/1000).toFixed(1)} kN`;}
    radialLine.visible=radialHead.visible=opts.forces&&s.phase==='curve';radialLabel.show=radialLine.visible;
    if(radialLine.visible){const origin=carPosition.clone();origin.y=1.3;const end=origin.clone().addScaledVector(inward,10);replaceLine(radialLine,[origin,end]);radialHead.position.copy(end);radialHead.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),inward);radialLabel.position.copy(end).addScaledVector(inward,2);}
    warningLabel.show=s.slip;warningLabel.position.set(s.x,5,s.z);
    trail.visible=opts.trail;const path=[];for(let t=0;t<s.t;t+=.045){const q=sample(p,t);path.push(new THREE.Vector3(q.x,.18,q.z));}path.push(new THREE.Vector3(s.x,.18,s.z));if(path.length<2)path.push(path[0].clone());replaceLine(trail,path);trail.material.color.set(s.slip?'#ef9b87':'#b9edb7');
    particles.visible=opts.jets;
    for(let i=0;i<count;i++){const age=((i/count+s.t*1.19)%1)*.65,emitTime=s.t-age;const e=sample(p,Math.max(0,emitTime)),active=emitTime>=0&&(e.tail>0||e.side>0);const j=i*3;if(!active){particlePositions[j]=0;particlePositions[j+1]=-100;particlePositions[j+2]=0;continue;}
      const noise=Math.sin(i*127.1+33.8)*43758.5453,hash=noise-Math.floor(noise),spread=(hash*2-1)*age*.9;
      const tx=Math.cos(e.heading),tz=-Math.sin(e.heading),ox=Math.sin(e.heading),oz=Math.cos(e.heading);
      let x=e.x,y=.72,z=e.z;
      // Compressed air, rendered at a reduced visual speed; never flame particles.
      if(e.tail){x+=-3.2*tx+(i%2?.54:-.54)*ox;z+=-3.2*tz+(i%2?.54:-.54)*oz;x-=age*13*tx;z-=age*13*tz;x+=spread*ox;z+=spread*oz;}
      else{x+=1.55*ox+(i%2?.8:-.8)*tx;z+=1.55*oz+(i%2?.8:-.8)*tz;x+=age*10*ox+spread*tx;z+=age*10*oz+spread*tz;}
      particlePositions[j]=x;particlePositions[j+1]=y+spread*.4;particlePositions[j+2]=z;const alpha=1-age/.65;particleColors[j]=.4*alpha;particleColors[j+1]=.84*alpha;particleColors[j+2]=alpha;
    }
    particleGeo.attributes.position.needsUpdate=true;particleGeo.attributes.color.needsUpdate=true;
    if(cameraMode==='follow'){const now=new THREE.Vector3(s.x,0,s.z),delta=now.clone().sub(lastPosition);camera.position.add(delta);controls.target.add(delta);lastPosition.copy(now);}
  }
  const proj=new THREE.Vector3();
  function render(){controls.update();renderer.render(scene,camera);for(const item of labels){proj.copy(item.position).project(camera);const visible=item.show&&!(cameraMode==='follow'&&item.el.classList.contains('road'))&&proj.z<1&&proj.z>-1&&Math.abs(proj.x)<1.05&&Math.abs(proj.y)<1.05;item.el.style.display=visible?'block':'none';if(visible){item.el.style.left=`${(proj.x*.5+.5)*width}px`;item.el.style.top=`${(-proj.y*.5+.5)*height}px`;}}if(thrustLabel.show&&frictionLabel.show){const a=thrustLabel.el.getBoundingClientRect(),b=frictionLabel.el.getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)frictionLabel.el.style.top=`${parseFloat(frictionLabel.el.style.top)+26}px`;}}
  return {update,render,cameraView,resize};
}
