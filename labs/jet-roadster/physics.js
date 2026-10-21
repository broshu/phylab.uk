// SI units throughout. The rendering layer never advances or integrates this model.
export const C = Object.freeze({m:2000, g:10, u:500, flow:40, mu:0.1, L:45, R:20, gas:90, a:10, roadHalfWidth:3});
export function plan({scenario='optimal', fan=true, exactPi=false}={}) {
  const pi=exactPi?Math.PI:3, arc=pi*C.R/2;
  const fmax=C.mu*C.m*C.g*(fan?3:1);
  const A=C.m/C.u+C.m*arc/(C.R*C.u), B=fmax*arc/C.u;
  const optimum=(C.gas+Math.sqrt(C.gas*C.gas+4*A*B))/(2*A);
  const v=scenario==='demo'?10:scenario==='wrong'?22.5:optimum;
  const initialGas=scenario==='demo'?100:90;
  const burn=v/C.a, burnDistance=v*v/(2*C.a);
  const coast=(C.L-burnDistance)/v, straightTime=burn+coast;
  const side=Math.max(0,C.m*v*v/C.R-fmax), curveTime=arc/v;
  const straightGas=C.m*v/C.u, curveGas=side*curveTime/C.u;
  // Failure illustration: from B, a fully sliding particle with kinetic friction
  // opposite its velocity, then a frictionless run-off area. No steering dynamics.
  const slipDistance=Math.sqrt((C.R+C.roadHalfWidth)**2-C.R**2);
  const slideA=fmax/C.m;
  const slipExitSpeed=Math.sqrt(v*v-2*slideA*slipDistance);
  const slipExitTime=(v-slipExitSpeed)/slideA;
  const slipDuration=slipExitTime+(29-slipDistance)/slipExitSpeed;
  return {scenario,fan,exactPi,pi,arc,initialGas,fmax,v,burn,burnDistance,coast,straightTime,side,curveTime,straightGas,curveGas,optimum,slipDistance,slideA,slipExitSpeed,slipExitTime,
    duration:straightTime+(scenario==='wrong'?slipDuration:curveTime), required:C.m*v*v/C.R};
}
export function sample(p,time) {
  const t=Math.max(0,Math.min(time,p.duration));
  let state={t,v:0,x:-45,z:0,heading:0,theta:0,travel:0,phase:'burn',tail:20000,side:0,friction:0,required:0,gas:p.initialGas,usedStraight:0,usedCurve:0,flow:40,finished:t>=p.duration,slip:false};
  if(t<p.burn) {
    state.v=C.a*t; state.travel=C.a*t*t/2; state.usedStraight=C.flow*t;
  } else if(t<p.straightTime) {
    state.phase='coast';state.v=p.v;state.travel=p.burnDistance+p.v*(t-p.burn);state.usedStraight=p.straightGas;state.tail=0;state.flow=0;
  } else if(p.scenario==='wrong') {
    const dt=t-p.straightTime;
    state.slip=true;state.phase='slip';state.tail=0;state.flow=0;state.usedStraight=90;
    if(dt<p.slipExitTime) {state.travel=45+p.v*dt-p.slideA*dt*dt/2;state.v=p.v-p.slideA*dt;state.friction=p.fmax;}
    else {state.travel=45+p.slipDistance+p.slipExitSpeed*(dt-p.slipExitTime);state.v=p.slipExitSpeed;state.phase='runoff';}
    state.required=p.required;
  } else {
    const dt=Math.min(t-p.straightTime,p.curveTime), fraction=dt/p.curveTime;
    state.phase='curve';state.v=p.v;state.tail=0;state.side=p.side;
    state.required=p.required;state.friction=Math.min(p.fmax,p.required);state.flow=p.side/C.u;
    state.travel=45+p.v*dt;state.theta=fraction*Math.PI/2;
    state.heading=state.theta;state.usedStraight=p.straightGas;state.usedCurve=state.flow*dt;
    state.x=C.R*Math.sin(state.theta);state.z=-C.R+C.R*Math.cos(state.theta);
  }
  if(state.phase!=='curve')state.x=state.travel-45;
  state.gas=Math.max(0,p.initialGas-state.usedStraight-state.usedCurve);
  state.progress=state.slip?45/(45+p.arc):Math.min(1,state.travel/(45+p.arc));
  return state;
}
export function totalGas(v,fan=true,pi=3){const f=C.mu*C.m*C.g*(fan?3:1);return 4*v+Math.max(0,100*v*v-f)*(pi*10/v)/500;}
export function totalTime(v,pi=3){return (45+pi*10)/v+v/20;}
