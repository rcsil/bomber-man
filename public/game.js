(() => {
'use strict';
const socket=io();
const $=id=>document.getElementById(id);
const canvas=$('board'),ctx=canvas.getContext('2d');
const TILE=48;
let myId=null,roomId=null,state=null,toastTimer=null;
const queryCode=new URLSearchParams(location.search).get('sala');
if(queryCode)$('roomCode').value=queryCode.toUpperCase().slice(0,6);
function toast(text){$('toast').textContent=text;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),3500);}
function nickname(){return $('name').value.trim()||'Jogador';}
$('create').onclick=()=>socket.emit('createRoom',{name:nickname()});
$('join').onclick=()=>socket.emit('joinRoom',{name:nickname(),roomId:$('roomCode').value.trim().toUpperCase()});
$('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/?sala='+roomId);toast('Link de convite copiado!');}catch{toast('Código da sala: '+roomId);}};
$('start').onclick=()=>socket.emit('startGame');
$('leave').onclick=()=>{socket.emit('leaveRoom');leaveUI();};
function leaveUI(){roomId=null;state=null;$('game').classList.add('hidden');$('home').classList.remove('hidden');history.replaceState({},'',location.pathname);}
socket.on('connect',()=>{$('connection').textContent='● Online';$('connection').style.color='#7ae9bd';});
socket.on('disconnect',()=>{$('connection').textContent='● Desconectado';$('connection').style.color='#ff7b99';if(roomId)toast('Conexão perdida. Atualize a página para entrar novamente.');});
socket.on('errorMessage',toast);
socket.on('joined',data=>{myId=data.playerId;roomId=data.roomId;$('home').classList.add('hidden');$('game').classList.remove('hidden');history.replaceState({},'',`?sala=${roomId}`);});
let drawing=false;
function scheduleDraw(){if(drawing)return;drawing=true;requestAnimationFrame(()=>{drawing=false;draw();});}
socket.on('state',data=>{if(!roomId||data.id!==roomId)return;state=data;renderHUD();scheduleDraw();});
function renderHUD(){
  $('copyCode').textContent=state.id+' ⧉';
  $('count').textContent=state.players.length+'/4';
  $('phase').textContent=({lobby:'AGUARDANDO',playing:'● EM JOGO',finished:'FIM DE RODADA'})[state.phase];
  $('phase').textContent += state.phase==='playing'?' • '+Math.ceil(state.remaining/1000)+'s':'';
  $('players').replaceChildren(...state.players.sort((a,b)=>a.slot-b.slot).map(p=>{
    const item=document.createElement('div');item.className='player'+(!p.alive&&state.phase==='playing'?' dead':'');
    const avatar=document.createElement('div');avatar.className='avatar';avatar.style.background=p.color;
    const info=document.createElement('div');const name=document.createElement('div');name.className='pname';name.textContent=p.name+(p.id===myId?' (você)':'');
    const sub=document.createElement('small');sub.textContent=state.phase==='lobby'?'Pronto para jogar':state.phase==='playing'?(p.alive?'Vivo • 💣 '+p.capacity+' • 🔥 '+p.range+' • ⚡ '+p.speed+(p.kick?' • 👟':'')+(p.glove?' • 🥊':'')+(p.pierce?' • ✨':'')+(p.shield?' • 🛡️':'')+(p.remote?' • 🎮':''):'Eliminado'):`🏆 ${p.wins} vitória(s)`;
    info.append(name,sub);item.append(avatar,info);return item;
  }));
  const overlay=$('overlay');
  overlay.classList.toggle('hidden',state.phase==='playing');
  const leader=state.host===myId;
  const start=$('start');
  start.classList.toggle('hidden',!leader||state.players.length<2);
  if(state.phase==='lobby'){
    overlay.querySelector('h2').textContent='Esperando jogadores';
    overlay.querySelector('p').textContent=state.players.length<2?'Convide pelo menos mais 1 amigo usando o código da sala.':leader?'Todo mundo pronto? Comece a partida!':'Aguardando o criador iniciar a partida.';
    start.textContent='COMEÇAR PARTIDA →';
  }else if(state.phase==='finished'){
    const champion=state.players.find(p=>p.id===state.winner);
    overlay.querySelector('h2').textContent=champion?'🏆 '+champion.name+' venceu!':'💥 Empate!';
    overlay.querySelector('p').textContent=leader?'Inicie uma revanche com os mesmos amigos.':'Esperando o criador iniciar uma revanche.';
    start.textContent='🔁 JOGAR NOVAMENTE';
  }
}
function tile(x,y){ctx.fillRect(x*TILE,y*TILE,TILE,TILE);}
function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
// Original 16-bit-inspired pixel art, not sprites extracted from another game.
ctx.imageSmoothingEnabled=false;
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}

// Sprites autorais em baixa resolução, desenhados numa grade virtual 24px.
// Um pixel da grade equivale a 2 pixels no tabuleiro. Paleta arcade de 16 bits.
function px(x,y,w,h,c){rect(x,y,w*2,h*2,c);}
function brick(X,Y){
 rect(X,Y,48,48,'#4d6388');
 rect(X+1,Y+1,46,34,'#8ca5c2');
 rect(X+3,Y+3,42,6,'#e2eff9');
 rect(X+3,Y+11,42,20,'#87a3c3');
 rect(X+4,Y+33,40,9,'#536b97');
 rect(X+4,Y+42,40,3,'#30446e');
 rect(X+23,Y+10,3,24,'#3f4a66');
 rect(X+3,Y+21,19,2,'#a8b1c5');
 rect(X+27,Y+21,18,2,'#a8b1c5');
 rect(X+4,Y+4,3,28,'#e4e6e2');
 rect(X+40,Y+6,3,27,'#4c5976');
}
function crate(X,Y){
 rect(X+3,Y+5,42,38,'#714e3c');
 rect(X+5,Y+4,38,35,'#ffd98a');
 rect(X+7,Y+6,34,5,'#ffe4a0');
 rect(X+8,Y+12,32,19,'#e59a58');
 rect(X+8,Y+32,32,6,'#a85b3b');
 rect(X+9,Y+10,6,27,'#f3b767');
 rect(X+33,Y+10,6,27,'#854734');
 rect(X+15,Y+19,18,4,'#ffcd79');
 rect(X+18,Y+23,12,7,'#94563e');
 rect(X+3,Y+38,42,5,'#574153');
 rect(X+9,Y+8,4,4,'#fff1c2');rect(X+35,Y+8,4,4,'#fff1c2');
}
const spriteCache=new Map();
function drawHero(cx,cy,color,frame,slot=0){
 const key=slot+':'+color+':'+frame;
 let sprite=spriteCache.get(key);
 if(!sprite){
  sprite=document.createElement('canvas');sprite.width=24;sprite.height=24;
  const g=sprite.getContext('2d');g.imageSmoothingEnabled=false;
  function r(x,y,w,h,c){g.fillStyle=c;g.fillRect(x,y,w,h)}
  const dark='#30334f',white='#fff9eb',shadow='#d6d5de',face='#ffca98';
  r(7,20+(frame?1:0),5,3,dark);r(13,20+(frame?0:1),5,3,dark);
  r(6,21+(frame?1:0),6,2,'#f9fbff');r(13,21+(frame?0:1),6,2,'#f9fbff');
  r(8,14,9,7,dark);r(9,14,7,6,color);r(10,18,5,2,'#f8b83e');
  r(4,13,4,5,dark);r(17,13,4,5,dark);r(4,15,3,3,white);r(18,15,3,3,white);
  r(5,6,15,10,dark);r(6,4,13,12,white);r(8,2,9,3,white);
  r(7,3,11,2,shadow);r(6,7,2,6,shadow);r(18,8,2,6,shadow);
  r(3,8,5,7,dark);r(3,9,5,5,white);r(17,8,5,7,dark);r(18,9,4,5,white);
  r(7,7,11,9,dark);r(8,8,9,7,face);
  r(9,9,2,4,'#282a40');r(15,9,2,4,'#282a40');
  r(9,9,1,1,'#ffffff');r(15,9,1,1,'#ffffff');
  r(11,14,4,1,'#c86d69');
  r(8,3,9,2,color);r(10,1,5,2,color);r(5,15,3,2,color);r(17,15,3,2,color);
  if(slot===1)r(11,2,3,2,'#ffb9d2');
  if(slot===2)r(11,2,3,2,'#ffe680');
  if(slot===3)r(11,2,3,2,'#a0f4ec');
  spriteCache.set(key,sprite);
 }
 ctx.drawImage(sprite,Math.round(cx-24),Math.round(cy-28),48,48);
}
function drawFlame(X,Y,t){
 const jitter=Math.floor(t/100)%2;
 rect(X+5,Y+17,38,16,'#db482f');
 rect(X+17,Y+5,16,38,'#e95231');
 rect(X+2,Y+20,44,9,'#ff952f');
 rect(X+20,Y+2,9,44,'#ff9b29');
 rect(X+8,Y+20,32,8,'#ffe06a');
 rect(X+20,Y+8,8,32,'#ffe86d');
 rect(X+19,Y+19,11,11,'#fff8cf');
 rect(X+4+jitter*2,Y+22,5,5,'#fff4b4');
 rect(X+37-jitter*2,Y+22,5,5,'#fff4b4');
 rect(X+22,Y+4+jitter*2,5,5,'#fff4b4');
 rect(X+22,Y+39-jitter*2,5,5,'#fff4b4');
}
function draw(){
 if(!state)return;
 const t=performance.now();
 ctx.clearRect(0,0,canvas.width,canvas.height);
 for(let y=0;y<state.board.length;y++)for(let x=0;x<state.board[y].length;x++){
  const X=x*TILE,Y=y*TILE,v=state.board[y][x];
  rect(X,Y,TILE,TILE,(x+y)%2?'#429943':'#4da64e');
  rect(X+2,Y+2,44,44,(x+y)%2?'#53aa50':'#5bb655');
  rect(X+4,Y+4,16,2,'#81cf69');rect(X+25,Y+26,16,2,'#378942');
  rect(X+4,Y+23,3,2,'#96d778');rect(X+31,Y+8,3,2,'#96d778');
  if(v===1)brick(X,Y);
  if(v===2)crate(X,Y);
 }
 const icons={range:'🔥',capacity:'💣',speed:'⚡',kick:'👟',glove:'🥊',pierce:'✨',shield:'🛡️',remote:'🎮'};
 for(const power of state.powerups){const X=power.x*TILE,Y=power.y*TILE;const hover=Math.round(Math.sin(t/240)*2);rect(X+9,Y+9+hover,30,31,'#3e4b80');rect(X+12,Y+11+hover,24,24,'#fff4bf');rect(X+11,Y+9,26,4,'#fff');ctx.textAlign='center';ctx.font='22px sans-serif';ctx.fillText(icons[power.type]||'?',X+24,Y+31+hover);}
 for(const bomb of state.bombs){const X=bomb.x*TILE,Y=bomb.y*TILE;const pulse=Math.sin(t/125)*2;rect(X+10,Y+30,29,10,'#27405f55');ctx.fillStyle='#1e2542';ctx.beginPath();ctx.arc(X+24,Y+25,16+pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#525d84';ctx.beginPath();ctx.arc(X+18,Y+18,7,0,Math.PI*2);ctx.fill();rect(X+24,Y+5,6,8,'#ffd36e');rect(X+30,Y+2,6,6,'#fff3a0');}
 for(const flame of state.flames){const X=flame.x*TILE,Y=flame.y*TILE;drawFlame(X,Y,t);}
 for(const p of state.players){if(!p.alive)continue;const X=p.x*TILE+24,Y=p.y*TILE+24;rect(X-15,Y+14,30,6,'#203c5077');drawHero(X,Y,p.color,Math.floor(t/150)%2,p.slot);if(p.shield){ctx.strokeStyle='#84f7ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,23,0,Math.PI*2);ctx.stroke();}if(p.id===myId){ctx.strokeStyle='#fff8a5';ctx.lineWidth=3;ctx.strokeRect(p.x*TILE+2,p.y*TILE+2,44,44);}ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#1b2035';ctx.strokeText(p.name,X,Y-26);ctx.fillStyle='#fff';ctx.fillText(p.name,X,Y-26);}
}
setInterval(()=>{if(state&&state.phase==='playing')scheduleDraw();},90);
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',a:'left',s:'down',d:'right',W:'up',A:'left',S:'down',D:'right'};
const down=new Set();
document.addEventListener('keydown',e=>{
 if(!roomId||['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;
 if(e.code==='Space'){e.preventDefault();if(!e.repeat)socket.emit('input',{bomb:true});return;}
 if(e.key==='e'||e.key==='E'){e.preventDefault();if(!e.repeat)socket.emit('input',{detonate:true});return;}
 if(e.key==='q'||e.key==='Q'){e.preventDefault();if(!e.repeat)socket.emit('input',{punch:true});return;}
 const dir=keys[e.key];if(!dir)return;e.preventDefault();if(!down.has(dir)){down.add(dir);socket.emit('input',{direction:dir,pressed:true});}
});
document.addEventListener('keyup',e=>{const dir=keys[e.key];if(dir){down.delete(dir);socket.emit('input',{direction:dir,pressed:false});}});
window.addEventListener('blur',()=>{for(const dir of down)socket.emit('input',{direction:dir,pressed:false});down.clear();});
for(const btn of document.querySelectorAll('[data-dir]')){
 const dir=btn.dataset.dir;
 const release=e=>{e.preventDefault();down.delete(dir);socket.emit('input',{direction:dir,pressed:false});};
 btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);down.add(dir);socket.emit('input',{direction:dir,pressed:true});});
 btn.addEventListener('pointerup',release);btn.addEventListener('pointercancel',release);
}
window.addEventListener('arenaAbility',e=>socket.emit('input',{[e.detail]:true}));
$('bombControl').addEventListener('pointerdown',e=>{e.preventDefault();socket.emit('input',{bomb:true});});
})();

