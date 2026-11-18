// Lightweight logic smoke tests; run with node --test tests/game.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(saved=null){
 const events={};
 const elements=new Map();
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]||(()=>{})});
 const el=()=>({classList:{add(){},remove(){},toggle(){}},style:{},value:400,checked:true,textContent:'',innerHTML:'',getContext:()=>ctx,addEventListener(){}});
 const document={createElement:el,querySelector:s=>{if(!elements.has(s))elements.set(s,el());return elements.get(s)},querySelectorAll:()=>[],addEventListener(){},body:el(),exitPointerLock(){}};
 const sandbox={document,window:{},innerHeight:900,innerWidth:1440,localStorage:{getItem:()=>saved?JSON.stringify(saved):null,setItem(){}},addEventListener(type,fn){events[type]=fn;},requestAnimationFrame(){},events,console};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync('game.js','utf8'),sandbox);return s=>vm.runInContext(s,sandbox);
}
test('map, render, movement and ray collisions',()=>{const run=setup();assert.equal(run('solid(3.5,15.5)'),false);assert.equal(run('solid(-1,0)'),true);assert.equal(run('cast(3.5,15.5,0).d > 0'),true);run('render();start(true);render();update(.016)');assert.equal(run('bots.length'),0);assert.equal(run('mode'),'playing');});
test('weapons, reloading, rounds and match completion',()=>{const run=setup();run('sound=false;start(false)');assert.equal(run('bots.length'),3);run('shoot()');assert.equal(run('ammo'),29);run('reload=.01;update(.02)');assert.equal(run('ammo'),30);run('endRound(true)');assert.equal(run('ours'),1);assert.equal(run('mode'),'between');run('overlayAction()');assert.equal(run('round'),2);assert.equal(run('player.hp'),100);run('endRound(true);overlayAction();endRound(true)');assert.equal(run('ours'),3);assert.equal(run("$('#overlay-title').textContent"),'MISSION COMPLETE.');});
test('pause, return home, practice and timeout',()=>{const run=setup();run('start(false);pause()');assert.equal(run('mode'),'paused');run('resume();remaining=.001;update(.01)');assert.equal(run('theirs'),1);run('home()');assert.equal(run('mode'),'menu');run('start(true);remaining=.001;update(.01)');assert.equal(run('mode'),'playing');});
test('mouse is 54% slower, supports fractional sensitivity, and ignores paused input',()=>{
 const run=setup({sensitivity:4});run('start(true);player.a=0;events.mousemove({movementX:100,buttons:1})');
 assert.ok(Math.abs(run('player.a')-.12)<1e-9);assert.ok(run('MOUSE_RADIANS')<.00065/2);
 run('pause();events.mousemove({movementX:100,buttons:1})');assert.ok(Math.abs(run('player.a')-.12)<1e-9);
 const fine=setup({sensitivity:.5});assert.equal(fine('sensitivity'),.5);
});
test('all walkable map cells and bot spawns are connected',()=>{
 const run=setup();run('start(false);buildFlow()');
 assert.equal(run('MAP.every(row=>row.length===24)'),true);assert.equal(run('MAP.length'),22);
 assert.equal(run('bots.every(b=>!solid(b.x,b.y)&&Number.isFinite(flow[Math.floor(b.y)][Math.floor(b.x)]))'),true);
 assert.equal(run("MAP.every((row,y)=>[...row].every((cell,x)=>cell!=='0'||Number.isFinite(flow[y][x])))"),true);
 assert.equal(run("['2','3','4','5','6'].every(type=>MAP.some(row=>row.includes(type)))"),true);
});
test('bots navigate the new routes around solid cover',()=>{
 const run=setup();run('start(false);buildFlow();for(let i=0;i<6000;i++)for(const b of bots)followFlow(b,.016)');
 assert.equal(run('bots.every(b=>Math.hypot(b.x-player.x,b.y-player.y)<1.5)'),true);
 assert.equal(run('bots.every(b=>!solid(b.x,b.y))'),true);
});
test('all quality presets render and pause settings remain available',()=>{
 const run=setup();run('start(true);for(const q of [240,400,640]){quality=q;resize();render()}');assert.equal(run('depthBuffer.length'),640);
 run("pause();$('#pause-settings').onclick();$('#quality').value=240;$('#sensitivity').value=2.5;$('#close-settings').onclick()");assert.equal(run('mode'),'paused');assert.equal(run('sensitivity'),2.5);assert.equal(run('quality'),240);
});
