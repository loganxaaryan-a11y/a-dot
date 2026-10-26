const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.match(html,/<\/body>\s*<\/html>\s*$/,'HTML must be complete');
assert.equal(scripts.length,1,'The complete game script must exist');
const source=scripts[0][1];
const noop=()=>{};
const canvas=new Proxy({measureText:()=>({width:10}),createRadialGradient:()=>({addColorStop:noop}),createLinearGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop});
function element(){
  const classes=new Set(),attrs=new Map(),events={};
  return {style:{setProperty:noop},classList:{add:(...x)=>x.forEach(v=>classes.add(v)),remove:(...x)=>x.forEach(v=>classes.delete(v)),contains:x=>classes.has(x),toggle:(x,b)=>{if(b===undefined)b=!classes.has(x);b?classes.add(x):classes.delete(x);return b}},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),getAttribute:k=>attrs.get(k)||null,addEventListener:(k,f)=>events[k]=f,click:()=>events.click?.(),appendChild:noop,remove:noop,focus:noop,scrollIntoView:noop,children:[],textContent:'',innerHTML:'',tabIndex:-1,disabled:false,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),getContext:()=>canvas,setPointerCapture:noop};
}
function boot(width=800,height=600){
  const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element()]));
  const context={document:{getElementById:id=>{assert.ok(elements.has(id),`Missing DOM target ${id}`);return elements.get(id)},addEventListener:noop,createElement:element,querySelectorAll:()=>[],querySelector:()=>null,hidden:false,body:element()},matchMedia:()=>({matches:false}),innerWidth:width,innerHeight:height,devicePixelRatio:1,addEventListener:noop,performance:{now:()=>0},requestAnimationFrame:noop,navigator:{},URL:{createObjectURL:()=>'',revokeObjectURL:noop},Blob:function(){},setTimeout:noop,console};
  context.window=context;
  vm.createContext(context);
  // Expose lexical game functions only in this test VM, never in the published page.
  const expose=`window.audit={reset,update,render,updateHint,updateSkipOffer,noteProgress,recordSkip,showHint,computeHintProfile,buildHintRead,buildDimensionProfile,dimensionTitle,buildStrategyProfile,buildCrossGameRead,buildDirectorCuts,buildPlayProfile,reportText,sessionJSON,setupNBack,setupTracking,mirrorDown,
    enterMaze(){reset();phase='maze';mazeMetrics.start=0;updateHint();updateSkipOffer()},
    tick(t){activeTime=t;updateHint();updateSkipOffer()},
    time(t){activeTime=t},pointer(down){pointer.down=down},
    state(){return{phase,hintHistory,hintTier,activeHintEvent,mazeMetrics,clusterMetrics,doorMetrics,orbitMetrics,ravenMetrics,nbackMetrics,trackingMetrics,mirrorMetrics}},
    hints(events,skips=[]){hintHistory=events;skipHistory=skips},
    nextContext(){phase='raven';setupRaven(1);updateHint();updateSkipOffer()},
    memoryRecall(t){phase='nback';setupNBack();nback.state='recall';activeTime=t;updateHint();updateSkipOffer()}
  };`;
  assert.match(source,/\}\)\(\);\s*$/);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/,expose+'})();'),context,{timeout:10000});
  return{g:context.audit,w:context,elements};
}
const {g,w,elements}=boot();
test('all built-in game checks pass at desktop and phone sizes',()=>{
  for(const [width,height] of [[800,600],[390,844],[1440,900]]){
    const r=width===800?w.__SELF_PLAYTEST__:boot(width,height).w.__SELF_PLAYTEST__;
    assert.equal(r.passed,true);
    assert.ok(r.clusterEconomyBots.integratedRuns.every(run=>run.churn>=2&&run.won&&run.advancedPastDoor));
  }
});
test('idle hint is displayed at 15s and clear hint at 45s',()=>{
  g.enterMaze();for(let t=1;t<15;t++)g.tick(t);assert.equal(g.state().hintHistory.length,0);
  g.tick(15);assert.equal(g.state().hintHistory[0].offeredAt,15);assert.equal(g.state().hintTier,1);
  g.tick(44);assert.equal(g.state().hintHistory.length,1);
  g.tick(45);assert.equal(g.state().hintTier,2);assert.equal(g.computeHintProfile().supersededCount,1);
});
test('holding the pointer postpones display without restarting the clock',()=>{
  g.enterMaze();g.pointer(true);g.tick(16);assert.equal(g.state().hintHistory.length,0);
  g.pointer(false);g.tick(17);assert.equal(g.state().hintHistory.length,1);
});
test('requesting clearer instructions records a request and exposes a keyboard button',()=>{
  g.enterMaze();g.tick(15);const button=elements.get('hint-whisper');assert.equal(button.tabIndex,0);
  button.click();assert.equal(g.state().hintTier,2);assert.equal(g.computeHintProfile().requestedCount,1);
  g.time(18);g.noteProgress();assert.equal(button.tabIndex,-1);assert.equal(g.computeHintProfile().actedCount,1);
});
test('clear hint does not revert to nudge before 45s',()=>{
  g.enterMaze();g.tick(15);elements.get('hint-whisper').click();const text=elements.get('hint-whisper').textContent;
  g.tick(20);assert.equal(elements.get('hint-whisper').textContent,text);
});
test('progress restarts idle timing and does not imply a solved task',()=>{
  g.enterMaze();g.tick(15);g.time(17);g.noteProgress();let hp=g.computeHintProfile();
  assert.equal(hp.actedCount,1);assert.equal(hp.fastCount,1);assert.equal(hp.medianLatency,2);
  assert.doesNotMatch(g.buildHintRead(hp),/solved around|missing a fact|unlocked you/);
  g.tick(31);assert.equal(g.state().hintHistory.length,1);g.tick(32);assert.equal(g.state().hintHistory.length,2);
});
test('a skip is never counted as acting on a hint',()=>{
  g.enterMaze();g.tick(15);g.time(18);g.recordSkip({key:'maze',stage:'Maze',part:'stage'});
  const hp=g.computeHintProfile();assert.equal(hp.actedCount,0);assert.equal(hp.skippedCount,1);
});
test('Ravens skips are matched to the actual puzzle, not every matrix',()=>{
  g.reset();g.hints([{key:'raven-1',stage:'Ravens',part:'matrix',tier:1,offeredAt:15,actedAt:null,latency:null}], [{key:'raven-2',stage:'Ravens',part:'matrix',at:90}]);
  assert.equal(g.computeHintProfile().skippedCount,0);assert.equal(g.computeHintProfile().unobservedCount,1);
});
test('an unanswered hint remains unknown rather than claiming success',()=>{
  g.enterMaze();g.tick(15);const hp=g.computeHintProfile();assert.equal(hp.unobservedCount,1);
  assert.match(g.buildHintRead(hp),/no follow-up action/);assert.doesNotMatch(g.buildHintRead(hp),/solved around|ignored/);
});
test('median action latency averages the middle pair for even sample counts',()=>{
  g.hints([2,8].map(latency=>({tier:1,offeredAt:0,actedAt:latency,latency})));
  assert.equal(g.computeHintProfile().medianLatency,5);
});
test('replay clears all prior hint state',()=>{
  g.enterMaze();g.tick(15);g.reset();g.time(4);g.noteProgress();
  assert.equal(g.state().hintHistory.length,0);assert.equal(g.state().activeHintEvent,null);
});
test('a new stage gets its own idle clock and no previous hint credit',()=>{
  g.enterMaze();g.tick(15);g.time(20);g.nextContext();g.time(21);g.noteProgress();
  assert.equal(g.computeHintProfile().actedCount,0);g.tick(35);assert.equal(g.state().hintHistory.length,1);
  g.tick(36);assert.equal(g.state().hintHistory.length,2);
});
test('memory recall gets fifteen seconds after its instructions become available',()=>{
  g.reset();g.memoryRecall(100);g.tick(114);assert.equal(g.state().hintHistory.length,0);
  g.tick(115);assert.equal(g.state().hintHistory[0].offeredAt,115);
});
test('no play data produces no dimension scores or invented title',()=>{
  g.reset();const dims=g.buildDimensionProfile().dims;
  assert.ok(dims.every(d=>d.score===null&&d.confidence===0&&d.pole==='Not enough data'));
  assert.equal(g.dimensionTitle(dims),null);
});
test('skipped spatial stages do not become low exploration or planning scores',()=>{
  g.reset();const s=g.state();for(const m of [s.mazeMetrics,s.clusterMetrics,s.doorMetrics]){m.start=0;m.end=10;m.skips=1;}
  s.clusterMetrics.counts.line=10;s.doorMetrics.trackLengthDrawn=100;
  const dims=g.buildDimensionProfile().dims;
  assert.ok(dims.filter(d=>['explore','force','plan','pattern'].includes(d.id)).every(d=>d.score===null));
});
test('observed maze evidence can be scored without scoring missing games',()=>{
  g.reset();const m=g.state().mazeMetrics;m.start=0;m.end=10;m.damagingImpacts=6;
  const dims=g.buildDimensionProfile().dims;assert.equal(dims.find(d=>d.id==='force').score,100);
  assert.equal(dims.find(d=>d.id==='plan').score,null);
});
test('return pulls record hint follow-up before the finished report is built',()=>{
  w.__PLAYTEST_MIRROR__();g.tick(0);g.tick(15);g.time(17);g.mirrorDown({x:400,y:300});
  assert.equal(g.computeHintProfile().actedCount,1);
});
test('report and exported data remain usable with missing game evidence',()=>{
  const r=w.__PLAYTEST_REPORT__();assert.equal(r.phase,'report');assert.equal(r.visible,true);
  assert.equal(elements.get('dimension-list').innerHTML.includes('NaN'),false);
  assert.match(elements.get('dimension-list').innerHTML,/Not enough data/);
  const exported=JSON.parse(g.sessionJSON());assert.equal(exported.dimensions.dims.length,7);
  const text=g.reportText();assert.match(text,/HOW YOU MOVE/);assert.doesNotMatch(text,/null\/100|NaN|undefined/);
});
test('all gameplay preview entry points render without exceptions',()=>{
  for(const name of ['__PLAYTEST_RAVENS__','__PLAYTEST_NBACK__','__PLAYTEST_TRACKING__','__PLAYTEST_ORBIT__','__PLAYTEST_MIRROR__']){
    w[name]();g.render();g.update(.016);g.render();
  }
});
test('unplayed games cannot generate successful strategy claims or rates',()=>{
  g.reset();const p=g.buildPlayProfile();
  assert.ok(p.strategies.every(s=>s.token==='unobserved'));
  assert.ok(Object.values(p.values).every(x=>x===null));
  assert.match(g.buildCrossGameRead(p.strategies),/not enough recorded play/);
});
test('partial maze and field skips do not claim successful completion',()=>{
  g.reset();const s=g.state();s.mazeMetrics.skips=1;s.mazeMetrics.breaks.push({});
  s.clusterMetrics.skips=1;s.clusterMetrics.closedLoops.push({});
  const p=g.buildStrategyProfile();assert.equal(p[0].token,'skip');assert.equal(p[1].token,'skip');
  assert.match(p[1].read,/1 loops/);assert.doesNotMatch(p[0].read,/reached the exit/);
});
test('synthetic report cannot claim games were played',()=>{
  w.__PLAYTEST_REPORT__();const text=g.reportText();
  assert.doesNotMatch(text,/reached the exit|reached the door without|0 of 0 launches|100% economy/);
  assert.match(text,/No results were recorded for the first seven games/);
});
