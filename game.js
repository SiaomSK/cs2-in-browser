'use strict';
const $=s=>document.querySelector(s), canvas=$('#world'), ctx=canvas.getContext('2d',{alpha:false});
// 0 walkable; 1 sandstone; 2 cargo; 3 blue plaster; 4/5 courtyard signs; 6 shutters.
const MAP=[
'111111111111111111111111',
'100000000000000000000001',
'100000330000000000000001',
'100000330022000140000001',
'100200630000000110000001',
'100200330000000110000001',
'100000330000000110022001',
'100000000141100000022001',
'100000000111100000000001',
'100000000000000000000001',
'100000110000000330000001',
'100200110000000630000001',
'100200110000000330000001',
'100000110000000330000001',
'100000000335300000000001',
'100000000333300000000001',
'100000000000000000022001',
'100000330000000110000001',
'100000350002200110000001',
'100000000000000000000001',
'100000000000000000000001',
'111111111111111111111111'];
const MOUSE_RADIANS=.0003; // 54% slower, including previously saved sensitivity.
const guns=[{name:'VANGUARD AR',type:'ASSAULT RIFLE',damage:34,mag:30,rate:.14,reload:1.6,desc:'The all-rounder. Reliable, controlled fire for any engagement.'},{name:'SPECTRE SMG',type:'SUBMACHINE GUN',damage:22,mag:40,rate:.085,reload:1.25,desc:'Fast and forgiving. A high-capacity weapon for close encounters.'},{name:'SENTINEL DMR',type:'MARKSMAN RIFLE',damage:75,mag:12,rate:.42,reload:1.9,desc:'Precision over volume. Heavy damage for deliberate, accurate shots.'}];
let selected=0, quality=400,sensitivity=4,sound=true,mode='menu',practice=false,player={x:4.5,y:14.5,a:-.5,hp:100},bots=[],keys={},firing=false,ammo=30,reload=0,cooldown=0,shot=0,hit=0,damage=0,round=1,ours=0,theirs=0,remaining=90,last=0,elapsed=0,overlayAction=null,audio=null;
try{const saved=JSON.parse(localStorage.getItem('breach-settings'));if(saved){quality=[240,400,640].includes(saved.quality)?saved.quality:400;sensitivity=Number.isFinite(saved.sensitivity)?Math.min(10,Math.max(.5,saved.sensitivity)):4;sound=saved.sound!==false;selected=Math.min(2,Math.max(0,saved.selected||0));}}catch{}
$('#sensitivity-value').textContent=sensitivity.toFixed(1);
$('#sensitivity').oninput=()=>$('#sensitivity-value').textContent=(+$('#sensitivity').value).toFixed(1);
$('#quality').value=quality;$('#sensitivity').value=sensitivity;$('#sound').checked=sound;
function solid(x,y){return MAP[Math.floor(y)]?.[Math.floor(x)]!=='0'}
function cast(x,y,a,max=35){const dx=Math.cos(a),dy=Math.sin(a);let mx=Math.floor(x),my=Math.floor(y),ddx=Math.abs(1/dx),ddy=Math.abs(1/dy),sx=dx<0?-1:1,sy=dy<0?-1:1,tx=(dx<0?x-mx:mx+1-x)*ddx,ty=(dy<0?y-my:my+1-y)*ddy,side=0,d=0;while(d<max){if(tx<ty){d=tx;tx+=ddx;mx+=sx;side=0}else{d=ty;ty+=ddy;my+=sy;side=1}if(!MAP[my]||MAP[my][mx]!=='0')break;}let u=side?x+d*dx:y+d*dy;return {d:Math.max(.01,d),side,u:u-Math.floor(u),type:MAP[my]?.[mx]||'1',mx,my};}
let depthBuffer=new Float32Array(quality);
function resize(){depthBuffer=new Float32Array(quality);canvas.width=quality;canvas.height=Math.round(quality*innerHeight/innerWidth);}
addEventListener('resize',resize);resize();
function tab(name){document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('hidden',p.id!==name+'-panel'));document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>tab(b.dataset.tab));$('#loadout-card').onclick=()=>tab('loadout');$('#guide-card').onclick=()=>tab('guide');
function save(){try{localStorage.setItem('breach-settings',JSON.stringify({quality,sensitivity,sound,selected}));}catch{}}
function armory(){ $('#weapons').innerHTML=guns.map((g,i)=>`<button class="weapon-card ${selected===i?'selected':''}" data-gun="${i}"><span class="tiny">${g.type}</span><h3>${g.name}</h3><svg class="rifle" viewBox="0 0 380 90"><path d="M24 34h70l10-12h100v8h91v5h62v9h-64v9H192l-9 7 17 25h-30l-19-27h-22l-7 27H99l6-32H68L24 70z"/></svg><p>${g.desc}</p><p>${g.damage} DAMAGE &nbsp; / &nbsp; ${g.mag} ROUNDS</p><span class="tiny">${selected===i?'✓ EQUIPPED':'SELECT WEAPON →'}</span></button>`).join('');document.querySelectorAll('[data-gun]').forEach(b=>b.onclick=()=>{selected=+b.dataset.gun;save();armory()});}armory();
$('#pause-settings').onclick=$('#settings-card').onclick=$('#settings-footer').onclick=()=>$('#settings').classList.remove('hidden');$('#close-settings').onclick=()=>{quality=+$('#quality').value;sensitivity=+$('#sensitivity').value;sound=$('#sound').checked;save();resize();$('#settings').classList.add('hidden')};
function beep(freq,duration=.07,volume=.035,type='square'){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();let o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.4,audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
function showOverlay(kicker,title,text,button,action){$('#overlay-kicker').textContent=kicker;$('#overlay-title').textContent=title;$('#overlay-text').textContent=text;$('#continue').innerHTML=button+' <span>→</span>';overlayAction=action;$('#overlay').classList.remove('hidden');document.exitPointerLock?.();firing=false;keys={};}
function lock(){try{const p=canvas.requestPointerLock?.();p?.catch(()=>{});}catch{}}
function resume(){mode='playing';$('#overlay').classList.add('hidden');lock();}
function newRound(){player={x:3.5,y:18.5,a:-Math.PI/2,hp:100};bots=practice?[]:[{x:11.5,y:5.5,hp:100,cd:1.8},{x:20.5,y:11.5,hp:100,cd:2.5},{x:12.5,y:12.5,hp:100,cd:3}];flowTimer=0;ammo=guns[selected].mag;reload=0;cooldown=0;remaining=90;shot=0;damage=0;$('#kill-feed').textContent=practice?'FREE PRACTICE • Explore the compound':'3 HOSTILES REMAINING';updateHUD();}
function start(free){practice=free;ours=theirs=0;round=1;newRound();$('#home').classList.add('hidden');$('#hud').classList.remove('hidden');document.body.classList.add('playing');resume();}
$('#deploy').onclick=()=>start(false);$('#practice').onclick=()=>start(true);$('#continue').onclick=()=>overlayAction?.();
function home(){mode='menu';document.exitPointerLock?.();$('#overlay').classList.add('hidden');$('#hud').classList.add('hidden');$('#home').classList.remove('hidden');document.body.classList.remove('playing');firing=false;keys={};}
$('#return-home').onclick=home;
function pause(){if(mode!=='playing')return;mode='paused';showOverlay('OPERATION PAUSED','TAKE A BREATHER.','Your round is paused. Ready when you are.','RESUME OPERATION',resume);}
$('#pause-button').onclick=pause;
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&mode==='playing')pause()});
addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','Space'].includes(e.code)&&mode==='playing')e.preventDefault();keys[e.code]=true;if(e.code==='Escape')pause();if(e.code==='KeyR'&&mode==='playing'&&!reload&&ammo<guns[selected].mag){reload=guns[selected].reload;beep(300,.15,.02,'sine');}});addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousemove',e=>{if(mode==='playing'&&(document.pointerLockElement||e.buttons===1))player.a+=e.movementX*MOUSE_RADIANS*sensitivity;});canvas.addEventListener('mousedown',e=>{if(mode==='playing'&&e.button===0){firing=true;if(!document.pointerLockElement)lock();}});addEventListener('mouseup',()=>firing=false);
function move(obj,dx,dy){const r=.22;if(!solid(obj.x+dx+Math.sign(dx)*r,obj.y-r)&&!solid(obj.x+dx+Math.sign(dx)*r,obj.y+r))obj.x+=dx;if(!solid(obj.x-r,obj.y+dy+Math.sign(dy)*r)&&!solid(obj.x+r,obj.y+dy+Math.sign(dy)*r))obj.y+=dy;}
function angle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function shoot(){if(reload||cooldown)return;if(!ammo){reload=guns[selected].reload;return;}ammo--;cooldown=guns[selected].rate;shot=.11;beep(100+Math.random()*50,.12,.055,'sawtooth');let target=null,nearest=100;for(const b of bots){if(b.hp<=0)continue;const d=Math.hypot(b.x-player.x,b.y-player.y),a=Math.atan2(b.y-player.y,b.x-player.x);if(Math.abs(angle(a-player.a))<Math.atan(.28/d)&&cast(player.x,player.y,a).d>d-.3&&d<nearest){target=b;nearest=d;}}if(target){target.hp-=guns[selected].damage;hit=.13;if(target.hp<=0){$('#kill-feed').textContent=`YOU  ›  HOSTILE   •   ${bots.filter(b=>b.hp>0).length} REMAINING`;beep(700,.1,.025,'sine');}}if(!practice&&bots.every(b=>b.hp<=0))endRound(true);}
function endRound(win){if(mode!=='playing')return;win?ours++:theirs++;mode='between';updateHUD();const finished=ours===3||theirs===3;showOverlay(finished?'OPERATION COMPLETE':`ROUND ${round} COMPLETE`,finished?(win?'MISSION COMPLETE.':'MISSION FAILED.'):(win?'SECTOR CLEARED.':'ROUND LOST.'),finished?`Final score ${ours} — ${theirs}. ${win?'Excellent work, operative.':'Regroup and try a different approach.'}`:(win?'All hostiles eliminated. Reload and prepare for the next round.':'The opposition held the sector. Use cover and keep moving.'),finished?'PLAY AGAIN':'NEXT ROUND',()=>{if(finished)start(false);else{round++;newRound();resume();}});}
function locationName(){return player.x<6?'WEST APPROACH':player.x>17?'EAST MARKET':player.y<10?'A / SUN COURT':player.y>15?'B / BLUE COURT':'MID / CONNECTOR';}
function updateHUD(){$('#location').textContent=locationName();$('#health').textContent=Math.max(0,Math.ceil(player.hp));$('#ammo').textContent=reload?'…':ammo;$('#weapon-name').textContent=reload?'RELOADING':guns[selected].name;$('#our-score').textContent=ours;$('#enemy-score').textContent=theirs;$('#round-label').textContent=practice?'PRACTICE':`ROUND ${round}`;$('#timer').textContent=practice?'∞':`${Math.floor(remaining/60)}:${String(Math.floor(remaining%60)).padStart(2,'0')}`;$('#hitmarker').classList.toggle('hidden',hit<=0);$('#damage-flash').style.opacity=damage>0?.6:0;}
function update(dt){const speed=(keys.ShiftLeft?3.5:2.5)*dt;let f=(keys.KeyW?1:0)-(keys.KeyS?1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0);const n=Math.hypot(f,s)||1;move(player,(Math.cos(player.a)*f-Math.sin(player.a)*s)*speed/n,(Math.sin(player.a)*f+Math.cos(player.a)*s)*speed/n);player.a+=((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))*dt*1.8;cooldown=Math.max(0,cooldown-dt);shot-=dt;hit-=dt;damage-=dt;if(reload){reload=Math.max(0,reload-dt);if(!reload)ammo=guns[selected].mag;}if(firing)shoot();if(mode!=='playing')return;if(!practice){remaining=Math.max(0,remaining-dt);if(remaining===0){endRound(false);return;}}flowTimer-=dt;if(flowTimer<=0){buildFlow();flowTimer=.6;}for(const b of bots){if(b.hp<=0)continue;const dx=player.x-b.x,dy=player.y-b.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx),visible=cast(b.x,b.y,a).d>d-.25;b.cd-=dt;if(visible&&d<12){if(d>3)move(b,dx/d*dt*.7,dy/d*dt*.7);if(b.cd<=0){b.cd=1+Math.random()*.7;if(Math.random()<.72){player.hp-=9+Math.random()*5;damage=.15;beep(75,.08,.025,'triangle');if(player.hp<=0){endRound(false);return;}}}}else{followFlow(b,dt);}}updateHUD();drawRadar();}
function drawRadar(){const c=$('#radar').getContext('2d');c.clearRect(0,0,150,150);const scale=130/Math.max(MAP.length,MAP[0].length),ox=10,oy=15;for(let y=0;y<MAP.length;y++)for(let x=0;x<MAP[y].length;x++)if(MAP[y][x]!=='0'){c.fillStyle=MAP[y][x]==='2'?'#677052':'#3d4b36';c.fillRect(ox+x*scale,oy+y*scale,scale-1,scale-1);}c.font='bold 10px monospace';c.fillStyle='#efd291';c.fillText('A',ox+11*scale,oy+5*scale);c.fillStyle='#89c6ce';c.fillText('B',ox+11*scale,oy+18*scale);for(const b of bots)if(b.hp>0&&Math.hypot(b.x-player.x,b.y-player.y)<7){c.fillStyle='#ef9166';c.fillRect(ox+b.x*scale-2,oy+b.y*scale-2,4,4);}c.save();c.translate(ox+player.x*scale,oy+player.y*scale);c.rotate(player.a);c.fillStyle='#d6f36b';c.beginPath();c.moveTo(6,0);c.lineTo(-4,-3);c.lineTo(-4,3);c.fill();c.restore();}
// Rebuilt at most twice a second, shared by all bots; prevents getting stuck at corners.
let flow=[],flowTimer=0;
const neighbors=[[1,0],[-1,0],[0,1],[0,-1]];
function buildFlow(){
 flow=MAP.map(row=>Array(row.length).fill(Infinity));
 const x=Math.floor(player.x),y=Math.floor(player.y),queue=[[x,y]];flow[y][x]=0;
 for(let i=0;i<queue.length;i++){const [cx,cy]=queue[i];for(const [dx,dy] of neighbors){const nx=cx+dx,ny=cy+dy;if(!solid(nx,ny)&&flow[ny][nx]===Infinity){flow[ny][nx]=flow[cy][cx]+1;queue.push([nx,ny]);}}}
}
function followFlow(b,dt){
 const x=Math.floor(b.x),y=Math.floor(b.y);let best=flow[y]?.[x]??Infinity,target=null;
 for(const [dx,dy] of neighbors){const value=flow[y+dy]?.[x+dx]??Infinity;if(value<best){best=value;target={x:x+dx+.5,y:y+dy+.5};}}
 if(!target)return;
 // Center in the current corridor before turning around a solid corner.
 if(target.x!==x+.5&&Math.abs(b.y-(y+.5))>.12)target={x:x+.5,y:y+.5};
 if(target.y!==y+.5&&Math.abs(b.x-(x+.5))>.12)target={x:x+.5,y:y+.5};
 const dx=target.x-b.x,dy=target.y-b.y,d=Math.hypot(dx,dy);if(d>.02)move(b,dx/d*Math.min(d,dt*.85),dy/d*Math.min(d,dt*.85));
}
// Small, deterministic texture atlases are generated once, not downloaded or rebuilt per frame.
function makeTexture(type,variant){
 const tile=document.createElement('canvas');tile.width=tile.height=128;const c=tile.getContext('2d');
 let seed=type.charCodeAt(0)*931+variant*177;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const blue=type==='3'||type==='5'||type==='6',crate=type==='2';
 c.fillStyle=crate?'#9b8256':blue?'#c6bda2':'#d9bb86';c.fillRect(0,0,128,128);
 if(blue){c.fillStyle='#4d8588';c.fillRect(0,55,128,73);c.fillStyle='#abc1ad';c.fillRect(0,53,128,3);}
 for(let i=0;i<1000;i++){const x=random()*128,y=random()*128;c.fillStyle=random()>.5?'rgba(255,245,208,.12)':'rgba(55,41,21,.10)';c.fillRect(x,y,1+random()*3,1+random()*2);}
 if(crate){
  for(let x=0;x<128;x+=16){c.fillStyle='#685836';c.fillRect(x,0,2,128);c.fillStyle='#baa375';c.fillRect(x+2,0,1,128);}
  c.fillStyle='#454d42';for(const x of [10,110]){c.fillRect(x,0,8,128);c.fillStyle='#9ca286';c.fillRect(x+2,5,2,3);c.fillRect(x+2,119,2,3);c.fillStyle='#454d42';}
  c.fillRect(0,15,128,7);c.fillRect(0,106,128,7);c.fillStyle='#ded2a8';c.fillRect(37,46,54,29);c.fillStyle='#4a4b38';c.font='bold 11px monospace';c.fillText('CARGO',46,59);c.font='8px monospace';c.fillText('SEC. 07',44,69);
 }else{
  // Stone courses, chipped stucco, dark footings and a sunlit cornice.
  c.strokeStyle='rgba(92,70,43,.22)';c.lineWidth=1;c.beginPath();
  for(let y=16;y<128;y+=20){c.moveTo(0,y);c.lineTo(128,y);for(let x=(y%40?0:24);x<128;x+=48){c.moveTo(x,y);c.lineTo(x,y+20);}}c.stroke();
  c.fillStyle='#e9d2a3';c.fillRect(0,0,128,5);c.fillStyle='#a68c63';c.fillRect(0,6,128,5);c.fillStyle='#736b53';c.fillRect(0,117,128,11);
  if(type==='4'||type==='5'){
   c.fillStyle=type==='4'?'#a35536':'#255e67';c.fillRect(24,27,80,65);c.strokeStyle='#e0cca2';c.strokeRect(27,30,74,59);c.fillStyle='#f6e5bc';c.font='bold 40px sans-serif';c.fillText(type==='4'?'A':'B',37,66);c.font='bold 9px monospace';c.fillText(type==='4'?'SUN COURT':'BLUE COURT',33,81);
  }else if(type==='6'||variant===1){
   c.fillStyle='#a38960';c.fillRect(28,24,74,64);c.fillStyle='#253e3c';c.fillRect(32,27,66,56);c.fillStyle='#407473';for(let y=30;y<82;y+=6)c.fillRect(35,y,59,3);c.fillStyle='#bba67f';c.fillRect(28,83,75,6);c.fillStyle='#122f30';c.fillRect(63,28,3,55);
  }else if(variant===2){
   c.fillStyle='#a78d65';c.fillRect(27,32,76,85);c.fillStyle='#495c50';c.fillRect(33,38,64,79);c.fillStyle='#718374';for(let x=37;x<96;x+=10)c.fillRect(x,39,2,77);c.fillStyle='#d0bb83';c.fillRect(79,77,4,4);
  }
 }
 // Shade variants are pre-baked so each ray needs only one drawImage.
 return Array.from({length:8},(_,i)=>{const shaded=document.createElement('canvas');shaded.width=shaded.height=128;const sc=shaded.getContext('2d');sc.drawImage(tile,0,0);sc.fillStyle=`rgba(23,35,35,${i*.075})`;sc.fillRect(0,0,128,128);return shaded;});
}
const textures={};for(const type of ['1','2','3','4','5','6'])textures[type]=Array.from({length:3},(_,v)=>makeTexture(type,v));
function drawGround(w,h,horizon,projection,p){
 const floor=ctx.createLinearGradient(0,horizon,0,h);floor.addColorStop(0,'#c3ae89');floor.addColorStop(1,'#a39370');ctx.fillStyle=floor;ctx.fillRect(0,horizon,w,h);
 if(quality===240)return;
 const co=Math.cos(p.a),si=Math.sin(p.a),step=4;
 // Coarse floor casting: world-anchored stone paving and courtyard paint.
 for(let y=Math.ceil(horizon+4);y<h;y+=step){const d=projection*.45/(y-horizon);if(d>25)continue;
  for(let x=0;x<w;x+=step){const side=(x-w/2)/projection,wx=p.x+d*(co-si*side),wy=p.y+d*(si+co*side),ix=Math.floor(wx*2),iy=Math.floor(wy*2);const seam=wx*2-ix<.065||wy*2-iy<.065;
   const court=wx>8&&wx<15&&((wy>2&&wy<7)||(wy>16&&wy<20));
   ctx.fillStyle=seam?'rgba(67,66,48,.16)':(ix+iy)%2===0?'rgba(245,225,184,.07)':'rgba(81,75,52,.035)';
   if(court&&(Math.abs(wx-8.5)<.09||Math.abs(wx-14.5)<.09||Math.abs(wy-2.5)<.09||Math.abs(wy-6.5)<.09||Math.abs(wy-16.5)<.09||Math.abs(wy-19.5)<.09))ctx.fillStyle='rgba(229,190,98,.65)';
   ctx.fillRect(x,y,step,step);
  }
 }
}
function render(){
 const w=canvas.width,h=canvas.height,menu=mode==='menu',p=menu?{x:11.5,y:12.5,a:-1.25+Math.sin(elapsed*.045)*.1}:player,horizon=h*.48,projection=w*.78;
 const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,'#578995');sky.addColorStop(.75,'#b6c8bd');sky.addColorStop(1,'#e4d6b2');ctx.fillStyle=sky;ctx.fillRect(0,0,w,horizon);
 ctx.fillStyle='#fff0c6';ctx.beginPath();ctx.arc(w*.76,h*.16,h*.035,0,7);ctx.fill();
 // Low-cost distant ridgeline and town silhouette.
 for(let layer=0;layer<2;layer++){ctx.fillStyle=layer?'#a8ad97':'#bcc2a8';ctx.beginPath();ctx.moveTo(0,horizon);for(let i=0;i<=w+10;i+=10){const v=i/w*7+p.a;ctx.lineTo(i,horizon-h*(.045+layer*.015)-Math.sin(v*3+layer)*h*.018-Math.sin(v*7)*h*.01);}ctx.lineTo(w,horizon);ctx.fill();}
 drawGround(w,h,horizon,projection,p);
 const depths=depthBuffer;
 for(let x=0;x<w;x++){
  const ray=Math.atan((x-w/2)/projection),r=cast(p.x,p.y,p.a+ray),d=r.d*Math.cos(ray),height=projection/d,top=horizon-height*.55,bottom=horizon+height*.45;depths[x]=d;
  const variant=(r.mx*7+r.my*5)%3,shade=Math.min(7,Math.floor(d*.16)+(r.side?2:0));
  const texture=(textures[r.type]||textures['1'])[variant][shade];
  ctx.drawImage(texture,Math.min(127,Math.floor(r.u*128)),0,1,128,x,top,1,height);
  // Contact shade only, no expensive realtime shadow maps.
  ctx.fillStyle='rgba(45,47,33,.18)';ctx.fillRect(x,bottom,1,Math.min(5,height*.05));
 }
if(!menu){const sorted=bots.filter(b=>b.hp>0).sort((a,b)=>Math.hypot(b.x-p.x,b.y-p.y)-Math.hypot(a.x-p.x,a.y-p.y));for(const b of sorted){const dist=Math.hypot(b.x-p.x,b.y-p.y),ang=angle(Math.atan2(b.y-p.y,b.x-p.x)-p.a),z=dist*Math.cos(ang);if(z<.2||Math.abs(ang)>1.2)continue;const center=w/2+Math.tan(ang)*projection,sz=projection/z,foot=horizon+sz*.45;ctx.save();ctx.beginPath();for(let x=Math.max(0,Math.floor(center-sz*.24));x<Math.min(w,center+sz*.24);x++)if(depths[x]>z-.12)ctx.rect(x,foot-sz,1,sz*1.1);ctx.clip();ctx.fillStyle='#323b30';ctx.fillRect(center-sz*.14,foot-sz*.66,sz*.28,sz*.36);ctx.fillStyle='#777b57';ctx.fillRect(center-sz*.18,foot-sz*.64,sz*.36,sz*.28);ctx.fillStyle='#454e36';ctx.fillRect(center-sz*.105,foot-sz*.67,sz*.21,sz*.32);ctx.fillStyle='#323c30';ctx.fillRect(center-sz*.13,foot-sz*.32,sz*.095,sz*.32);ctx.fillRect(center+sz*.035,foot-sz*.32,sz*.095,sz*.32);ctx.fillStyle='#b7a380';ctx.fillRect(center-sz*.09,foot-sz*.85,sz*.18,sz*.17);ctx.fillStyle='#424d37';ctx.fillRect(center-sz*.11,foot-sz*.9,sz*.22,sz*.11);ctx.fillStyle='#202820';ctx.fillRect(center-sz*.09,foot-sz*.79,sz*.18,sz*.045);ctx.fillStyle='#252c27';ctx.fillRect(center-sz*.2,foot-sz*.54,sz*.4,sz*.06);ctx.fillRect(center-sz*.025,foot-sz*.59,sz*.07,sz*.2);ctx.restore();}drawGun(w,h);}}
function drawGun(w,h){const sc=h/350,bob=mode==='playing'&&(keys.KeyW||keys.KeyS||keys.KeyA||keys.KeyD)?Math.sin(elapsed*11)*2:0;ctx.save();ctx.translate(w*.61,h+bob*sc+(reload?Math.sin(reload*5)*12+30:0)*sc);ctx.scale(sc,sc);const kick=shot>0?9:0;ctx.translate(0,kick);ctx.fillStyle='#77715a';ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(-6,-69);ctx.lineTo(9,-88);ctx.lineTo(62,-48);ctx.lineTo(90,0);ctx.fill();ctx.fillStyle='#303a31';ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(-47,-111);ctx.lineTo(-25,-139);ctx.lineTo(-7,-131);ctx.lineTo(50,-29);ctx.lineTo(42,0);ctx.fill();ctx.fillStyle='#4d5846';ctx.beginPath();ctx.moveTo(-47,-111);ctx.lineTo(-25,-139);ctx.lineTo(18,-40);ctx.lineTo(-4,-24);ctx.fill();ctx.fillStyle='#1d2721';ctx.fillRect(-30,-153,9,28);ctx.fillRect(-32,-157,13,6);ctx.fillStyle='#727c61';ctx.fillRect(-27,-153,3,6);for(let i=0;i<5;i++){ctx.fillStyle='#202a22';ctx.fillRect(-24+i*5,-104+i*10,17,4);}if(shot>0){ctx.fillStyle='#fff0aa';ctx.beginPath();ctx.moveTo(-26,-157);ctx.lineTo(-44,-181);ctx.lineTo(-29,-175);ctx.lineTo(-25,-202);ctx.lineTo(-18,-175);ctx.lineTo(-7,-185);ctx.lineTo(-19,-157);ctx.fill();}ctx.restore();}
function frame(t){const dt=Math.min((t-last)/1000||.016,.05);last=t;elapsed+=dt;if(mode==='playing')update(dt);render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
