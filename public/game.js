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
 rect(X,Y,48,48,'#343d57');
 rect(X+1,Y+1,46,34,'#8289a1');
 rect(X+3,Y+3,42,6,'#c3cad6');
 rect(X+3,Y+11,42,20,'#727e99');
 rect(X+4,Y+33,40,9,'#4c5670');
 rect(X+4,Y+42,40,3,'#252c42');
 rect(X+23,Y+10,3,24,'#3f4a66');
 rect(X+3,Y+21,19,2,'#a8b1c5');
 rect(X+27,Y+21,18,2,'#a8b1c5');
 rect(X+4,Y+4,3,28,'#e4e6e2');
 rect(X+40,Y+6,3,27,'#4c5976');
}
function crate(X,Y){
 rect(X+3,Y+5,42,38,'#46384a');
 rect(X+5,Y+4,38,35,'#f6c36c');
 rect(X+7,Y+6,34,5,'#ffe4a0');
 rect(X+8,Y+12,32,19,'#cc864c');
 rect(X+8,Y+32,32,6,'#aa5639');
 rect(X+9,Y+10,6,27,'#f3b767');
 rect(X+33,Y+10,6,27,'#854734');
 rect(X+15,Y+19,18,4,'#ffcd79');
 rect(X+18,Y+23,12,7,'#94563e');
 rect(X+3,Y+38,42,5,'#574153');
 rect(X+9,Y+8,4,4,'#fff1c2');rect(X+35,Y+8,4,4,'#fff1c2');
}
function hero(cx,cy,color,frame,slot=0){
 const X=Math.round(cx-24),Y=Math.round(cy-28);
 const bob=frame?1:0;
 // The silhouette is intentionally chunky, like a 24x24 handheld sprite.
 px(X,Y+44,7,2,'#34404a77');px(X+28,Y+44,7,2,'#34404a77');
 px(X+13,Y+35+bob,5,6,'#2b314c');px(X+26,Y+35-bob,5,6,'#2b314c');
 px(X+11,Y+37+bob,8,3,'#ffffff');px(X+25,Y+37-bob,8,3,'#ffffff');
 px(X+13,Y+28,19,8,color);px(X+10,Y+29,5,6,'#25304b');
 px(X+31,Y+29,5,6,'#25304b');
 px(X+6,Y+17,8,12,color);px(X+34,Y+17,8,12,color);
 px(X+7,Y+22,5,6,'#f8f2e4');px(X+36,Y+22,5,6,'#f8f2e4');
 px(X+10,Y+7,29,22,'#202a45');
 px(X+12,Y+5,25,23,'#f8f6e9');
 px(X+10,Y+6,29,7,color);px(X+14,Y+2,21,7,color);
 px(X+17,Y+0,15,3,'#ffffff');
 px(X+13,Y+13,23,11,'#20293e');
 px(X+16,Y+14,18,8,'#f8f6e9');
 px(X+19,Y+15,4,6,'#27324b');
 px(X+28,Y+15,4,6,'#27324b');
 px(X+20,Y+15,2,2,'#fff');px(X+29,Y+15,2,2,'#fff');
 px(X+12,Y+7,4,3,'#ffffff');
 px(X+17,Y+26,16,4,'#e0dccf');
 px(X+19,Y+28,12,4,color);
 if(slot===1){px(X+16,Y+5,7,2,'#ffe1fb');}
 if(slot===2){px(X+17,Y+5,7,2,'#ffe495');}
 if(slot===3){px(X+17,Y+5,7,2,'#b9efff');}
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
 for(const power of state.powerups){const X=power.x*TILE,Y=power.y*TILE;rect(X+10,Y+9,28,30,'#242d61');rect(X+13,Y+11,22,24,'#fff4bf');rect(X+11,Y+9,26,4,'#fff');ctx.textAlign='center';ctx.font='22px sans-serif';ctx.fillText(icons[power.type]||'?',X+24,Y+31);}
 for(const bomb of state.bombs){const X=bomb.x*TILE,Y=bomb.y*TILE;const pulse=Math.sin(t/125)*2;rect(X+10,Y+30,29,10,'#27405f55');ctx.fillStyle='#1e2542';ctx.beginPath();ctx.arc(X+24,Y+25,16+pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#525d84';ctx.beginPath();ctx.arc(X+18,Y+18,7,0,Math.PI*2);ctx.fill();rect(X+24,Y+5,6,8,'#ffd36e');rect(X+30,Y+2,6,6,'#fff3a0');}
 for(const flame of state.flames){const X=flame.x*TILE,Y=flame.y*TILE;drawFlame(X,Y,t);}
 for(const p of state.players){if(!p.alive)continue;const X=p.x*TILE+24,Y=p.y*TILE+24;rect(X-15,Y+14,30,6,'#203c5077');hero(X,Y,p.color,Math.floor(t/150)%2,p.slot);if(p.shield){ctx.strokeStyle='#84f7ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,23,0,Math.PI*2);ctx.stroke();}if(p.id===myId){ctx.strokeStyle='#fff8a5';ctx.lineWidth=3;ctx.strokeRect(p.x*TILE+2,p.y*TILE+2,44,44);}ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#1b2035';ctx.strokeText(p.name,X,Y-26);ctx.fillStyle='#fff';ctx.fillText(p.name,X,Y-26);}
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

