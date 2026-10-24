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
function hero(cx,cy,color,frame){
 const x=Math.round(cx-17),y=Math.round(cy-20),step=frame?2:0;
 rect(x+5,y+31,10,7,'#27364d');rect(x+20,y+31,10,7,'#27364d');
 rect(x+3,y+23,32,11,color);rect(x+7,y+10,24,19,'#f8f6e8');
 rect(x+4,y+5,30,13,color);rect(x+8,y+1,22,8,color);
 rect(x+1,y+14,8,12,color);rect(x+29,y+14,8,12,color);
 rect(x+11,y+15,16,10,'#232b42');rect(x+13,y+17,4,5,'#fff');rect(x+21,y+17,4,5,'#fff');
 rect(x+15,y+18,2,3,'#141a2b');rect(x+23,y+18,2,3,'#141a2b');
 rect(x+8,y+27+step,8,6,'#f8f6e8');rect(x+23,y+27-step,8,6,'#f8f6e8');
 rect(x+11,y+8,16,3,'#ffffff66');
}
function draw(){
 if(!state)return;
 const t=performance.now();
 ctx.clearRect(0,0,canvas.width,canvas.height);
 for(let y=0;y<state.board.length;y++)for(let x=0;x<state.board[y].length;x++){
  const X=x*TILE,Y=y*TILE,v=state.board[y][x];
  rect(X,Y,TILE,TILE,(x+y)%2?'#83cc79':'#92d782');
  rect(X+3,Y+3,4,4,'#aee9a0');rect(X+31,Y+32,3,3,'#5ab668');
  if(v===1){rect(X,Y,TILE,TILE,'#405b9b');rect(X+3,Y+3,42,36,'#699ad0');rect(X+4,Y+4,40,6,'#b2d8ed');rect(X+5,Y+13,38,17,'#709cc8');rect(X+5,Y+34,38,8,'#29477e');rect(X+22,Y+11,4,23,'#426ca5');rect(X+7,Y+27,35,3,'#3b659a');}
  if(v===2){rect(X+3,Y+5,42,40,'#704229');rect(X+5,Y+5,38,30,'#e3a25c');rect(X+8,Y+9,32,6,'#f8cb7a');rect(X+8,Y+19,32,13,'#bf7743');rect(X+9,Y+37,30,5,'#84472f');rect(X+11,Y+7,6,32,'#965632');rect(X+31,Y+7,6,32,'#965632');rect(X+9,Y+21,31,4,'#f2bc71');}
 }
 const icons={range:'🔥',capacity:'💣',speed:'⚡',kick:'👟',glove:'🥊',pierce:'✨',shield:'🛡️',remote:'🎮'};
 for(const power of state.powerups){const X=power.x*TILE,Y=power.y*TILE;rect(X+10,Y+9,28,30,'#242d61');rect(X+13,Y+11,22,24,'#fff4bf');rect(X+11,Y+9,26,4,'#fff');ctx.textAlign='center';ctx.font='22px sans-serif';ctx.fillText(icons[power.type]||'?',X+24,Y+31);}
 for(const bomb of state.bombs){const X=bomb.x*TILE,Y=bomb.y*TILE;const pulse=Math.sin(t/125)*2;rect(X+10,Y+30,29,10,'#27405f55');ctx.fillStyle='#1e2542';ctx.beginPath();ctx.arc(X+24,Y+25,16+pulse,0,Math.PI*2);ctx.fill();ctx.fillStyle='#525d84';ctx.beginPath();ctx.arc(X+18,Y+18,7,0,Math.PI*2);ctx.fill();rect(X+24,Y+5,6,8,'#ffd36e');rect(X+30,Y+2,6,6,'#fff3a0');}
 for(const flame of state.flames){const X=flame.x*TILE,Y=flame.y*TILE;rect(X+4,Y+4,40,40,'#f35c36');rect(X+9,Y+2,30,44,'#ffaf3c');rect(X+18,Y+8,12,31,'#fff1a2');rect(X+2,Y+18,44,12,'#ffd34e');}
 for(const p of state.players){if(!p.alive)continue;const X=p.x*TILE+24,Y=p.y*TILE+24;rect(X-15,Y+14,30,6,'#203c5077');hero(X,Y,p.color,Math.floor(t/160)%2);if(p.shield){ctx.strokeStyle='#84f7ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(X,Y,23,0,Math.PI*2);ctx.stroke();}if(p.id===myId){ctx.strokeStyle='#fff8a5';ctx.lineWidth=3;ctx.strokeRect(p.x*TILE+2,p.y*TILE+2,44,44);}ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#1b2035';ctx.strokeText(p.name,X,Y-26);ctx.fillStyle='#fff';ctx.fillText(p.name,X,Y-26);}
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

