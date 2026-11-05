/* UI and drawing use a precomputed, deterministic physical trajectory. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const color = {ink:'#23384b', muted:'#738399', orange:'#c68116', blue:'#2576d6', green:'#14936f'};
  let sim, time = 0, running = false, lastFrame = null;
  const clean = n => Math.abs(n) < .0005 ? 0 : n;
  const number = n => clean(n).toFixed(2);
  const signed = n => (clean(n) > 0 ? '+' : '') + number(n);
  function rebuild() {
    sim = RampPhysics.simulate(+$('massSmall').value, +$('massRamp').value, +$('speed').value);
    time = 0; running = false; lastFrame = null;
    $('heightPrediction').textContent = number(sim.hMax) + ' m';
    $('flightPrediction').textContent = `Critical speed to fly out ${number(sim.criticalSpeed)} m/s · ${sim.willFly ? 'flies out of the top' : 'returns along the surface'}`;
    $('durationLabel').textContent = number(sim.end.t) + ' s';
    $('totalEnergy').textContent = number(sim.energy) + ' J';
    render();
  }
  for (const id of ['massSmall','massRamp','speed']) {
    const field = $(id), range = $(id+'Range');
    range.addEventListener('input', () => {field.value = range.value; rebuild();});
    field.addEventListener('change', () => {
      let value = Number(field.value);
      if (!Number.isFinite(value) || field.value === '') value = Number(range.value);
      value = Math.round(Math.max(+field.min, Math.min(+field.max, value)) * 10) / 10;
      field.value = range.value = value; rebuild();
    });
  }
  function play() {if (time >= sim.end.t) time = 0; running = !running; lastFrame = null; render();}
  $('play').addEventListener('click', play);
  $('timeline').addEventListener('input', () => {running = false; time = +$('timeline').value / 1000 * sim.end.t; render();});
  ['vectors','trail'].forEach(id => $(id).addEventListener('change', render));
  document.addEventListener('keydown', event => {
    if (/INPUT|SELECT|BUTTON|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.code === 'Space') {event.preventDefault();play();}
  });
  document.addEventListener('visibilitychange', () => {lastFrame = null;});
  function surface(id) {
    const canvas = $(id), rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = rect.width, h = rect.height;
    if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {
      canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
    }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    ctx.lineCap = 'round';ctx.lineJoin = 'round';ctx.font = '12px "Avenir Next", "PingFang SC", sans-serif';
    return {ctx,w,h};
  }
  function line(ctx,x1,y1,x2,y2,stroke,width=1,dash=[]) {
    ctx.beginPath();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);
  }
  function label(ctx,text,x,y,fill=color.muted,align='left') {ctx.fillStyle=fill;ctx.textAlign=align;ctx.fillText(text,x,y);ctx.textAlign='left';}
  function arrow(ctx,x,y,dx,dy,stroke,text) {
    const len = Math.hypot(dx,dy);
    if (len < 2) {label(ctx,text,x+12,y-9,stroke);return;}
    line(ctx,x,y,x+dx,y+dy,stroke,2.4);
    const a=Math.atan2(dy,dx);ctx.beginPath();ctx.fillStyle=stroke;ctx.moveTo(x+dx,y+dy);
    ctx.lineTo(x+dx-8*Math.cos(a-.45),y+dy-8*Math.sin(a-.45));ctx.lineTo(x+dx-8*Math.cos(a+.45),y+dy-8*Math.sin(a+.45));ctx.closePath();ctx.fill();
    label(ctx,text,x+dx/2,y+dy/2-10,stroke,'center');
  }
  function drawMotion(s) {
    const {ctx,w,h}=surface('motion');
    const top=sim.R, qEnd=sim.R, base=sim.entranceHeight;
    const minX=Math.min(0,sim.end.x)-.15;
    const maxX=sim.end.X+qEnd+.45, extent=maxX-minX;
    const scale=Math.min((w-90)/(extent+.65),(h-112)/(Math.max(top,sim.hMax)+base+.3));
    const left=(w-extent*scale)/2-minX*scale, ground=h-52;
    const x = value => left+value*scale, y = value => ground-(value+base)*scale;
    const tick=extent>12?2:1;
    for (let i=Math.ceil(minX/tick)*tick;i<=maxX;i+=tick) {
      line(ctx,x(i),38,x(i),ground,'#e9eef4',1,[3,5]);
      line(ctx,x(i),ground,x(i),ground+5,'#9aa9b9');label(ctx,String(i),x(i),ground+19,color.muted,'center');
    }
    label(ctx,'x / m',w-14,ground+19,color.muted,'right');
    line(ctx,18,ground,w-18,ground,'#8394a6',1.5);
    for(let i=20;i<w-20;i+=15) line(ctx,i,ground+8,i+8,ground,'#c2ccd7');
    label(ctx,'Smooth horizontal ground',w/2,h-10,color.muted,'center');
    line(ctx,x(0),y(0)-12,x(0),ground,'#a0adbd',1,[4,4]);
    label(ctx,'Initial entrance',x(0),ground+34,color.muted,'center');
    // All positions are in the ground frame; the camera remains fixed for a run.
    ctx.beginPath();ctx.moveTo(x(s.X),y(0));
    for(let i=1;i<=100;i++){const theta=Math.PI/2*i/100;ctx.lineTo(x(s.X+sim.R*Math.sin(theta)),y(sim.R*(1-Math.cos(theta))));}
    ctx.lineTo(x(s.X+qEnd+.3),y(top));ctx.lineTo(x(s.X+qEnd+.3),ground);ctx.lineTo(x(s.X),ground);ctx.closePath();
    const gradient=ctx.createLinearGradient(0,y(top),0,ground);gradient.addColorStop(0,'#e0eaf4');gradient.addColorStop(1,'#b5cadd');ctx.fillStyle=gradient;ctx.fill();ctx.strokeStyle='#516e89';ctx.lineWidth=2;ctx.stroke();
    ctx.font='italic 25px Georgia, serif';label(ctx,'M',x(s.X+qEnd*.78),y(top*.22),color.ink,'center');ctx.font='12px "Avenir Next", "PingFang SC", sans-serif';
    if ($('trail').checked && time>0) {
      ctx.beginPath();ctx.strokeStyle='#c6811675';ctx.lineWidth=2;ctx.setLineDash([4,4]);
      const step=Math.max(1,Math.floor(sim.samples.length/500));
      let first=true;
      for(let i=0;i<sim.samples.length && sim.samples[i].t<=time;i+=step){const p=sim.samples[i];if(first){ctx.moveTo(x(p.x),y(p.h));first=false;}else ctx.lineTo(x(p.x),y(p.h));}
      ctx.lineTo(x(s.x),y(s.h));ctx.stroke();ctx.setLineDash([]);
    }
    if(s.h+base>.015){const hx=x(s.x)-26;line(ctx,hx,ground,hx,y(s.h),color.green,1.5,[3,3]);line(ctx,hx-5,y(s.h),x(s.x),y(s.h),'#14936f66',1,[3,3]);label(ctx,'y',hx-7,(ground+y(s.h))/2,color.green,'right');}
    const angle=s.theta, size=18;
    const bx=x(s.x)-Math.sin(angle)*size/2, by=y(s.h)-Math.cos(angle)*size/2;
    ctx.save();ctx.translate(bx,by);ctx.rotate(-angle);ctx.fillStyle='#efb955';ctx.strokeStyle='#ac731c';ctx.lineWidth=1.8;ctx.fillRect(-size/2,-size/2,size,size);ctx.strokeRect(-size/2,-size/2,size,size);ctx.restore();
    ctx.font='italic 20px Georgia, serif';label(ctx,'m',bx+(s.vx<0?16:-16),by-10,color.orange,s.vx<0?'left':'right');ctx.font='12px "Avenir Next", "PingFang SC", sans-serif';
    if($('vectors').checked){
      const vectorScale=Math.min(17,(w*.20)/sim.v0);
      arrow(ctx,bx,by-23,s.vx*vectorScale,-s.vy*vectorScale,color.orange,time===0?'v₀':'v');
      arrow(ctx,x(s.X+qEnd*.6),ground-18,s.V*vectorScale,0,color.blue,'V');
    }
    label(ctx,`m = ${sim.m} kg`,18,23,color.orange);label(ctx,`M = ${sim.M} kg`,115,23,color.blue);
    label(ctx,'→ initial velocity to the right',w-18,23,color.muted,'right');
  }
  function drawGraph(s) {
    const {ctx,w,h}=surface('velocity');
    const a=43,b=w-18,c=20,d=h-32;
    const low=Math.min(0,sim.end.vx)-sim.v0*.12, high=Math.max(sim.v0,sim.end.V)*1.13;
    const x=t=>a+(b-a)*t/sim.end.t, y=v=>d-(v-low)/(high-low)*(d-c);
    for(let i=0;i<=4;i++){const v=low+(high-low)*i/4;line(ctx,a,y(v),b,y(v),'#e7ecf2');label(ctx,v.toFixed(1),a-7,y(v)+4,color.muted,'right');}
    line(ctx,a,y(0),b,y(0),'#b8c4d0');
    line(ctx,x(sim.peak.t),c,x(sim.peak.t),d,'#9aa7b8',1,[4,4]);
    if(sim.launch){
      const start=x(sim.launch.t),end=x(sim.reentry.t);ctx.fillStyle='#2576d612';ctx.fillRect(start,c,end-start,d-c);
      label(ctx,'In the air',(start+end)/2,c+12,color.blue,'center');
    }
    ctx.fillStyle='#14936f12';ctx.fillRect(x(sim.exit.t),c,x(sim.end.t)-x(sim.exit.t),d-c);
    label(ctx,Math.abs(sim.exit.vx)<1e-8?'Falling':'Projectile',(x(sim.exit.t)+x(sim.end.t))/2,c+12,color.green,'center');
    for(const [key,stroke] of [['vx',color.orange],['V',color.blue]]) {
      ctx.beginPath();ctx.strokeStyle=stroke;ctx.lineWidth=2.2;
      const stride=Math.max(1,Math.floor(sim.samples.length/350));
      for(let i=0;i<sim.samples.length;i+=stride){const p=sim.samples[i];if(i===0)ctx.moveTo(x(p.t),y(p[key]));else ctx.lineTo(x(p.t),y(p[key]));}
      ctx.lineTo(x(sim.end.t),y(sim.end[key]));ctx.stroke();
    }
    line(ctx,x(s.t),c,x(s.t),d,'#20324766',1);
    for(const [value,fill] of [[s.vx,color.orange],[s.V,color.blue]]){ctx.beginPath();ctx.arc(x(s.t),y(value),4,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}
    label(ctx,'0',a,d+20);label(ctx,number(sim.peak.t),x(sim.peak.t),d+20,color.muted,'center');label(ctx,number(sim.end.t)+' s',b,d+20,color.muted,'right');
  }
  function render() {
    if(!sim)return;
    const s=sim.at(time), atPeak=Math.abs(time-sim.peak.t)<.008, ended=time>=sim.end.t;
    $('play').textContent=running?'Pause':ended?'Replay':time>0?'Resume':'Play';
    const flying=s.phase==='flight', falling=s.phase==='fall';
    const dropName=Math.abs(s.vx)<1e-8?'falling vertically':'projectile';
    $('phase').textContent=ended?'Landed':time===0?'Ready':falling?`Left the entrance · ${dropName}`:atPeak?(flying?'Highest point in the air':'Highest point on the surface'):flying?(s.vy>0?'Flying out · rising':'In the air · falling'):time<sim.peak.t?'Sliding up the surface':sim.willFly?'Back on the surface · sliding down':'Sliding down the surface';
    $('narrative').textContent=ended?`The block has touched the ground, so its height is 0. Just before touchdown vₓ = ${signed(s.vx)} m/s and vᵧ = ${signed(s.vy)} m/s.`:time===0?'Click “Play” to watch the whole motion until the block lands.':falling?`The block has left the entrance and is in ${dropName} motion. Its horizontal velocity stays the same and its vertical speed grows as it falls.`:atPeak?`Highest point: the block and the base move to the right together at ${number(s.V)} m/s.`:time<sim.peak.t?'The block slides up to the right relative to the base, and the base speeds up to the right.':'The block slides down to the left relative to the base, then leaves the entrance and lands on the ground.';
    if(flying) $('narrative').textContent=atPeak?`Highest point in the air: the vertical velocity is zero, and the block and the base move to the right together at ${number(s.V)} m/s.`:`The block flies out of the top as a projectile while the base moves right at a constant ${number(s.V)} m/s. The block will fall back onto the top.`;
    $('timeLabel').textContent=number(time)+' s';$('timeline').value=time/sim.end.t*1000;
    $('timeline').setAttribute('aria-valuetext',number(time)+' seconds');
    $('vx').textContent=signed(s.vx)+' m/s';$('V').textContent=signed(s.V)+' m/s';$('height').textContent=number(s.h+sim.entranceHeight)+' m';$('displacement').textContent=number(s.X)+' m';
    for(const key of ['km','kM','pe']){$(key).textContent=number(s[key])+' J';$(key+'Bar').style.width=Math.max(0,s[key]/sim.energy*100)+'%';}
    $('momentum').textContent=`Total horizontal momentum ${number(sim.m*s.vx+sim.M*s.V)} kg·m/s · unchanged`;
    drawMotion(s);drawGraph(s);
  }
  new ResizeObserver(render).observe($('motion'));
  rebuild();
  function frame(timestamp) {
    if(running && !document.hidden){
      if(lastFrame!==null) time=Math.min(sim.end.t,time+Math.min((timestamp-lastFrame)/1000,.05)*+$('rate').value);
      if(time>=sim.end.t)running=false;
      render();
    }
    lastFrame=timestamp;requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
