import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,step,autopilot,par,laneVelocity,speed,G} from '../sim.js';
const run=(ctl,fan=true,dt=1/60)=>{const s=createRun({fan});let n=0;while(s.status!=='over'&&n++<100000)step(s,ctl,dt);return s;};
const near=(a,b,e)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);

test('autopilot replays the ideal plan: finishes at par and empties the tank',()=>{
  for(const fan of [true,false]){const p=par(fan),s=run(autopilot('ideal',fan),fan);
    assert.equal(s.result,'finished');near(s.finishTime,p.duration,2e-3);near(s.gas,0,0.02);near(s.r,20,1e-4);
    near(s.usedStraight,p.straightGas,1e-6);}
});
test('spending everything on the straight makes the car skid off the outer edge at B',()=>{
  const s=run(autopilot('straight'));assert.equal(s.result,'skid');assert.equal(s.offEdge,'outer');near(s.offTime,3.125,0.01);
});
test('no strategy of the form "burn, coast, constant side jet" beats par',()=>{
  const p=par(true);
  for(let v=9;v<=15;v+=0.25)for(let P=0;P<=20000;P+=500){
    const s=run((s,h)=>{const l=laneVelocity(s);if(l.region==='ice'){const d=v-l.vt;return{tail:d<=0?0:Math.min(1,d*2000/(G.tail*h))};}return{side:true,sidePower:P};},true,1/30);
    if(s.result==='finished')assert.ok(s.finishTime>=p.duration-2e-3,`v=${v} P=${P} t=${s.finishTime}`);
  }
});
test('static friction plus side thrust holds the arc only inside the window [mv²/R − μN, mv²/R + μN]',()=>{
  const v=10,req=2000*v*v/20;
  const ctl=P=>(s,h)=>{const l=laneVelocity(s);if(l.region==='ice'){const d=v-l.vt;return{tail:d<=0?0:Math.min(1,d*2000/(G.tail*h))};}return{side:true,sidePower:P};};
  const tooWeak=createRun();const tooStrong=createRun();const ok=createRun();
  for(const [s,P] of [[tooWeak,req-6000-300],[tooStrong,req+6000+300],[ok,req-5000]])while(s.status!=='over')step(s,ctl(P),1/60);
  assert.equal(tooWeak.result,'skid');assert.equal(tooWeak.offEdge,'outer');
  assert.equal(tooStrong.result,'skid');assert.equal(tooStrong.offEdge,'inner');
  assert.equal(ok.result,'finished');
});
test('side jet on the ice leaves a sideways drift that nothing can cancel',()=>{
  const s=run(s=>({tail:speed(s)<10?1:0,side:s.x>-10&&s.x<-9,sidePower:20000}));assert.equal(s.result,'drift');assert.equal(s.offEdge,'inner');
  const t=run(s=>({tail:1,side:true,sidePower:20000}));assert.equal(t.result,'off');assert.equal(t.offEdge,'inner');
});
test('gas never goes negative and jets stop when the tank is empty',()=>{
  const s=createRun();for(let i=0;i<150;i++){step(s,{tail:1},1/60);assert.ok(s.gas>=0);}
  near(s.gas,0,1e-9);near(s.usedStraight,90,1e-6);near(speed(s),22.5,1e-6);assert.equal(s.tail,0);
});
test('a gentle run with low speed needs no side jet when the fan is on',()=>{
  const s=run(s=>({tail:s.t<0.5}));assert.equal(s.result,'finished');near(s.gas,70,0.1);
});
