import test from 'node:test';
import assert from 'node:assert/strict';
import {plan,sample,totalGas,totalTime} from '../physics.js';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('10 m/s example, with and without fan',()=>{
  const on=plan({scenario:'demo'}),off=plan({scenario:'demo',fan:false});
  for(const p of [on,off]){near(p.burn,1);near(p.burnDistance,5);near(p.coast,4);near(p.straightTime,5);near(p.curveTime,3);near(p.duration,8);near(p.straightGas,40);}
  near(on.fmax,6000);near(on.side,4000);near(on.curveGas,24);near(off.side,8000);near(off.curveGas,48);
});
test('90 kg optimum has early burn and long coast, then constant speed',()=>{
  const p=plan();near(p.v,12);near(p.straightGas,48);near(p.curveGas,42);near(p.burn,1.2);near(p.burnDistance,7.2);near(p.coast,3.15);near(p.straightTime,4.35);near(p.curveTime,2.5);near(p.duration,6.85);near(p.side,8400);
  for(let t=p.straightTime;t<=p.duration;t+=.01){const s=sample(p,t);near(s.v,12);near(s.tail,0);near(s.friction+s.side,2000*s.v*s.v/20);near(Math.hypot(s.x,s.z+20),20);}
  const end=sample(p,p.duration);near(end.gas,0);near(end.x,20);near(end.z,-20);near(end.heading,Math.PI/2);
});
test('fan switch and true pi recompute the allocation',()=>{
  for(const fan of [true,false])for(const exactPi of [true,false]){const p=plan({fan,exactPi});near(p.straightGas+p.curveGas,90);assert.ok(p.v<=30);near(totalGas(p.v,fan,exactPi?Math.PI:3),90);near(sample(p,p.duration).gas,0);}
  assert.ok(plan({fan:false}).v<12);assert.ok(plan({exactPi:true}).v<12);
});
test('optimum is the fastest feasible speed in the model',()=>{
  for(const fan of [true,false])for(const pi of [3,Math.PI]){const p=plan({fan,exactPi:pi===Math.PI});for(let v=.2;v<30;v+=.03){if(totalGas(v,fan,pi)<=90)assert.ok(totalTime(v,pi)>=p.duration-1e-9);}}
});
test('position, velocity and gas are continuous at normal phase boundaries',()=>{
  for(const scenario of ['demo','optimal'])for(const fan of [true,false]){const p=plan({scenario,fan});for(const boundary of [p.burn,p.straightTime,p.duration]){const before=sample(p,boundary-1e-8),after=sample(p,boundary);near(before.v,after.v,1e-6);near(before.gas,after.gas,1e-6);near(before.x,after.x,1e-6);near(before.z,after.z,1e-6);}}
});
test('incorrect allocation is infeasible at B and uses a separate sliding model',()=>{
  const p=plan({scenario:'wrong'});near(p.v,22.5);near(p.burn,2.25);near(p.burnDistance,25.3125);near(p.straightTime,3.125);near(p.required,50625);near(p.required-p.fmax,44625);
  const start=sample(p,p.straightTime),slip=sample(p,p.straightTime+.1),end=sample(p,p.duration);assert.equal(start.slip,true);near(start.gas,0);near(start.side,0);near(slip.v,22.2);near(slip.z,0);assert.equal(end.phase,'runoff');near(end.friction,0);near(end.x,29);assert.ok(end.progress<1);
  const a=sample(p,p.straightTime+p.slipExitTime-1e-8),b=sample(p,p.straightTime+p.slipExitTime);near(a.x,b.x,1e-6);near(a.v,b.v,1e-6);
});
test('repeated seeking is deterministic and preserves nonnegative gas',()=>{
  for(const scenario of ['demo','optimal','wrong'])for(const fan of [true,false])for(const exactPi of [true,false]){const p=plan({scenario,fan,exactPi});for(let i=0;i<=1000;i++){const t=p.duration*i/1000,s=sample(p,t);assert.deepEqual(s,sample(p,t));assert.ok(s.gas>=0&&s.gas<=p.initialGas);near(s.gas+s.usedStraight+s.usedCurve,p.initialGas,1e-7);assert.ok(s.v>=0);}}
});
test('true pi geometry agrees with the stated speed',()=>{
  const p=plan({exactPi:true}),dt=1e-5,t=p.straightTime+.8,a=sample(p,t),b=sample(p,t+dt);near(Math.hypot(b.x-a.x,b.z-a.z)/dt,p.v,1e-5);
});
