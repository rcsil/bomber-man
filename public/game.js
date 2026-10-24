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
    const sub=document.createElement('small');sub.textContent=state.phase==='lobby'?'Pronto para jogar':state.phase==='playing'?(p.alive?'Vivo • 💣 '+p.capacity+' • 🔥 '+p.range+' • ⚡ '+p.speed+(p.kick?' • 👟':''):'Eliminado'):`🏆 ${p.wins} vitória(s)`;
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
function draw(){
  if(!state)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<state.board.length;y++)for(let x=0;x<state.board[y].length;x++){
    const v=state.board[y][x];
    ctx.fillStyle=(x+y)%2?'#63b67b':'#6bc582';tile(x,y);ctx.fillStyle='#ffffff12';ctx.fillRect(x*TILE+3,y*TILE+3,TILE-6,2);
    if(v===1){ctx.fillStyle='#5b8bc5';tile(x,y);ctx.fillStyle='#8cb8eb';ctx.fillRect(x*TILE+3,y*TILE+3,TILE-6,6);ctx.fillStyle='#38649b';ctx.fillRect(x*TILE+3,y*TILE+TILE-9,TILE-6,6);}
    if(v===2){ctx.fillStyle='#ad633d';ctx.fillRect(x*TILE+3,y*TILE+3,TILE-6,TILE-6);ctx.strokeStyle='#f4bb75';ctx.lineWidth=4;ctx.strokeRect(x*TILE+7,y*TILE+7,TILE-14,TILE-14);ctx.beginPath();ctx.moveTo(x*TILE+7,y*TILE+7);ctx.lineTo((x+1)*TILE-7,(y+1)*TILE-7);ctx.stroke();}
  }
  for(const p of state.powerups){
    ctx.fillStyle=({range:'#ffad53',capacity:'#71f1c1',speed:'#87c5ff',kick:'#ed9fff'})[p.type]||'#fff';circle(p.x*TILE+24,p.y*TILE+24,16);ctx.fillStyle='#101724';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText(({range:'🔥',capacity:'+',speed:'⚡',kick:'👟'})[p.type]||'?',p.x*TILE+24,p.y*TILE+31);
  }
  for(const b of state.bombs){
    const cx=b.x*TILE+24,cy=b.y*TILE+26;
    ctx.fillStyle='#090d1a';circle(cx,cy,17);ctx.fillStyle='#6e7a94';circle(cx-5,cy-6,5);
    ctx.strokeStyle='#e7c365';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx+7,cy-14);ctx.lineTo(cx+13,cy-22);ctx.stroke();
    ctx.fillStyle='#f4c65a';circle(cx+13,cy-22,4);
  }
  for(const f of state.flames){
    ctx.fillStyle='#ff8b25';ctx.fillRect(f.x*TILE+2,f.y*TILE+2,TILE-4,TILE-4);
    ctx.fillStyle='#ffe16d';ctx.fillRect(f.x*TILE+11,f.y*TILE+11,TILE-22,TILE-22);
  }
  for(const p of state.players){
    if(!p.alive)continue;
    const cx=p.x*TILE+24,cy=p.y*TILE+25;
    ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(cx,cy+16,17,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.color;circle(cx,cy,17);ctx.fillStyle='#fff';ctx.fillRect(cx-9,cy-4,7,8);ctx.fillRect(cx+3,cy-4,7,8);ctx.fillStyle='#121827';ctx.fillRect(cx-6,cy-1,3,5);ctx.fillRect(cx+6,cy-1,3,5);
    if(p.id===myId){ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,20,0,Math.PI*2);ctx.stroke();}
    ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#101827';ctx.strokeText(p.name,cx,cy-23);ctx.fillStyle='#fff';ctx.fillText(p.name,cx,cy-23);
  }
}
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',a:'left',s:'down',d:'right',W:'up',A:'left',S:'down',D:'right'};
const down=new Set();
document.addEventListener('keydown',e=>{
 if(!roomId||['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;
 if(e.code==='Space'){e.preventDefault();if(!e.repeat)socket.emit('input',{bomb:true});return;}
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
$('bombControl').addEventListener('pointerdown',e=>{e.preventDefault();socket.emit('input',{bomb:true});});
})();
