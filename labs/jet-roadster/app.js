import {plan,sample} from './physics.js';
const $=id=>document.getElementById(id),all=s=>[...document.querySelectorAll(s)];
const params=new URLSearchParams(location.search);
if(params.get('embed')==='1')document.body.classList.add('embed');
if(params.get('classroom')==='1')document.body.classList.add('classroom');
let config={scenario:['demo','optimal','wrong'].includes(params.get('scene'))?params.get('scene'):'optimal',fan:params.get('fan')!=='0',exactPi:params.get('pi')==='exact'};
let p=plan(config),t=0,playing=false,view=null,lastFrame=0,needsUpdate=true;
const opts={forces:true,transparent:true,jets:true,trail:true};
const fmt=(n,d=2)=>Number(n.toFixed(d)).toString();
function force(id,n){$(id).innerHTML=`${(n/1000).toFixed(1)} <small>kN</small>`;}
function setPlay(value){playing=value;$('playText').textContent=value?'暂停实验':t>=p.duration?'重新播放':t>0?'继续实验':'开始实验';$('playIcon').textContent=value?'Ⅱ':'▶';needsUpdate=true;}
function configure(){p=plan(config);t=0;setPlay(false);$('gasTotal').textContent=p.initialGas;$('timeline').max=p.duration;$('timeline').value=0;$('timeEnd').textContent=p.duration.toFixed(2);$('piMode').value=config.exactPi?'exact':'3';
  all('[data-scenario]').forEach(b=>{const selected=b.dataset.scenario===config.scenario;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',selected);const q=plan({...config,scenario:b.dataset.scenario});b.querySelector('.scenario-value').innerHTML=`${fmt(q.straightGas,1)} + ${b.dataset.scenario==='wrong'?0:fmt(q.curveGas,1)}<span> kg</span>`;});
  all('[data-fan]').forEach(b=>{const selected=(b.dataset.fan==='true')===config.fan;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});
  $('burnMark').innerHTML=`尾喷结束 <span>${p.burn.toFixed(2)} s</span>`;$('curveMark').innerHTML=`${config.scenario==='wrong'?'B 点失稳':'进入弯道'} <span>${p.straightTime.toFixed(2)} s</span>`;$('endMark').innerHTML=config.scenario==='wrong'?'滑出示意结束':`到达 C <span>${p.duration.toFixed(2)} s</span>`;
  $('timelineCaption').textContent=config.scenario==='wrong'?'实验时间（B 后为滑动示意）':'实验时间';$('straightBudget').textContent=` / ${fmt(p.straightGas)} kg`;$('curveBudget').textContent=` / ${config.scenario==='wrong'?'0':fmt(p.curveGas)} kg`;
  $('modelStrip').textContent=`${config.exactPi?'真实 π；弯道长 31.416 m，图形路程与计时一致。':'π = 3；弯道计程 30 m，标准 90° 图形按进度映射。'}车辆外形放大 1.35 倍。`;
  if(config.scenario==='wrong'){$('insightTitle').textContent='直道更快，不代表全程更快。';$('insightBody').textContent=`${p.burn.toFixed(2)} s 用完 90 kg，滑行至 B 时速度 22.5 m/s；所需向心力 50.625 kN，静摩擦上限仅 ${fmt(p.fmax/1000)} kN。`;}
  else{$('insightTitle').textContent=config.scenario==='optimal'?'不是一路喷气，而是先加速，再滑行。':'相同速度，吸附能节省多少压缩空气？';$('insightBody').textContent=`直道喷气 ${p.burn.toFixed(2)} s → 滑行 ${p.coast.toFixed(2)} s → 匀速过弯 ${p.curveTime.toFixed(2)} s，总用时 ${p.duration.toFixed(2)} s。${config.scenario==='demo'?`示范装气 100 kg，总耗气 ${fmt(p.straightGas+p.curveGas)} kg。`:''}`;}
  needsUpdate=true;update();
}
function update(){const s=sample(p,t);$('velocity').textContent=s.v.toFixed(1);$('timeNow').textContent=t.toFixed(2);$('timeline').value=t;$('speedArc').setAttribute('stroke-dasharray',`${Math.min(1,s.v/25)} 1`);
  $('velocityCaption').textContent=config.scenario==='wrong'?(s.slip?'已失稳 · 不再匀速过弯':'入弯速度 22.5 m/s · 侧喷无余气'):`目标过弯速度 ${fmt(p.v,3)} m/s`;
  force('tailForce',s.tail);force('sideForce',s.side);force('frictionForce',s.friction);force('requiredForce',s.required);
  $('frictionLabel').textContent=s.slip?'动摩擦力':'静摩擦力';$('requiredLabel').textContent=s.slip?'B 点所需向心力':'所需向心力';
  $('gasLeft').textContent=s.gas.toFixed(1);$('gasBar').style.width=`${s.gas/p.initialGas*100}%`;$('gasBar').style.background=s.gas<10?'var(--site-amber)':'var(--site-green)';$('straightUsed').textContent=s.usedStraight.toFixed(1);$('curveUsed').textContent=s.usedCurve.toFixed(1);$('flowRate').textContent=s.finished?'—':`${s.flow.toFixed(1)} kg/s`;$('gasStatus').textContent=s.finished?'演示结束':s.tail?'尾喷':s.side?'侧喷':s.slip?'气量耗尽':'不耗气';
  const data={burn:['01 / 尾喷加速',`先加速 ${fmt(p.burnDistance)} m，再滑行到 B 点`,'直道光滑：尾喷开启时，a = 10 m/s²'],coast:['02 / 关闭尾喷 · 惯性滑行',`余下 ${fmt(45-p.burnDistance)} m 不喷气，速度保持不变`,'合力为零：F = 0，v 保持不变'],curve:['03 / 侧喷补足向心力',`向外排气，向内受推 · 匀速 ${fmt(p.v,2)} m/s`,`f + F侧 = ${fmt(s.friction/1000)} + ${fmt(s.side/1000)} = ${fmt(s.required/1000)} kN`],slip:['失稳 / 全滑动质点示意','摩擦改为反向速度，汽车沿 B 点切线滑出',`B 点向心力缺口 ${fmt((p.required-p.fmax)/1000,3)} kN；失稳后非匀速`],runoff:['失稳 / 已驶离防滑带','进入无摩擦缓冲区，无法到达目标 C 点','缓冲区忽略摩擦；此段为简化滑出示意']};
  const current=data[s.phase];$('phaseNumber').textContent=current[0];$('phaseText').textContent=current[1];$('forceNote').textContent=(s.finished&&!s.slip?'抵达前瞬时值：':'')+current[2];$('liveBadge').textContent=s.finished?'终点值':'LIVE';
  $('stageStatus').textContent=s.finished?(s.slip?'未能通过弯道':'已到达 C'):playing?(s.slip?'失稳示意':'实验运行中'):t>0?'已暂停':'准备就绪';
  if(s.finished&&!s.slip){$('phaseNumber').textContent='完成 / 抵达 C 点';$('phaseText').textContent=`总用气 ${fmt(s.usedStraight+s.usedCurve)} kg · 剩余 ${fmt(s.gas)} kg`;}
  view?.update(p,s,opts);needsUpdate=false;
}
all('[data-scenario]').forEach(b=>b.addEventListener('click',()=>{config.scenario=b.dataset.scenario;configure();}));
all('[data-fan]').forEach(b=>b.addEventListener('click',()=>{config.fan=b.dataset.fan==='true';configure();}));
$('piMode').addEventListener('change',e=>{config.exactPi=e.target.value==='exact';configure();});
$('playBtn').addEventListener('click',()=>{if(t>=p.duration)t=0;setPlay(!playing);});
$('resetBtn').addEventListener('click',()=>{t=0;setPlay(false);update();});
$('timeline').addEventListener('input',e=>{t=Number(e.target.value);if(Math.abs(t-p.duration)<1e-8)t=p.duration;setPlay(false);update();});
$('burnMark').addEventListener('click',()=>{t=p.burn;setPlay(false);update();});
$('curveMark').addEventListener('click',()=>{t=p.straightTime;setPlay(false);update();});
for(const [id,key] of [['showForces','forces'],['transparentCar','transparent'],['showJets','jets'],['showTrail','trail']])$(id).addEventListener('change',e=>{opts[key]=e.target.checked;needsUpdate=true;});
for(const [id,mode] of [['orbitBtn','orbit'],['topBtn','top'],['followBtn','follow']])$(id).addEventListener('click',()=>{view?.cameraView(mode);all('.view-buttons button').forEach(b=>b.classList.toggle('selected',b.id===id));});
function classroom(on){document.body.classList.toggle('classroom',on);$('classroomBtn').setAttribute('aria-pressed',on);}
$('classroomBtn').addEventListener('click',()=>classroom(true));$('exitClassroom').addEventListener('click',()=>classroom(false));
$('fullBtn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else {classroom(true);await document.documentElement.requestFullscreen();}}catch{$('stageStatus').textContent='浏览器未允许全屏，已切换课堂布局';}});
for(const id of ['showWorking','notesBtn'])$(id).addEventListener('click',()=>{$('working').open=true;$('working').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON','A','SUMMARY','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();$('playBtn').click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)setPlay(false);});
configure();
try{const {createScene}=await import('./scene.js');view=createScene($('scene'),$('labels'));update();}catch(error){$('renderError').hidden=false;console.error('3D initialization failed',error);}
function frame(now){const dt=lastFrame?Math.min((now-lastFrame)/1000,.05):0;lastFrame=now;if(playing){t=Math.min(p.duration,t+dt*Number($('speed').value));needsUpdate=true;if(t>=p.duration)setPlay(false);}if(needsUpdate)update();view?.render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
