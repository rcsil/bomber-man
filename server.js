'use strict';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const httpServer = http.createServer(app);
const io = new Server(httpServer, { transports: ['websocket', 'polling'], perMessageDeflate: false });
const PORT = Number(process.env.PORT) || 3000;
const WIDTH = 15, HEIGHT = 13, MAX_PLAYERS = 4;
const TICK_MS = 25, MOVE_INTERVAL = 160, BOMB_FUSE = 2100, FLAME_MS = 650, ROUND_MS = 150000;
const COLORS = ['#5ee3ff', '#ff6c9b', '#ffe17b', '#b0ff72'];
const SPAWNS = [{x:1,y:1},{x:13,y:11},{x:13,y:1},{x:1,y:11}];
const rooms = new Map();
const occupants = new Map();

function code() {
  let result;
  do { result = crypto.randomBytes(3).toString('hex').toUpperCase(); } while(rooms.has(result));
  return result;
}
function generateMap() {
  const board = [];
  const safe = new Set();
  for (const s of SPAWNS) for (const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) safe.add(`${s.x+dx},${s.y+dy}`);
  for (let y=0;y<HEIGHT;y++) {
    const row=[];
    for (let x=0;x<WIDTH;x++) {
      const wall = x===0||y===0||x===WIDTH-1||y===HEIGHT-1||(x%2===0&&y%2===0);
      row.push(wall ? 1 : safe.has(`${x},${y}`) ? 0 : Math.random()<0.68 ? 2 : 0);
    }
    board.push(row);
  }
  return board;
}
function createRoom(socket, name) {
  const id=code();
  const room={id, players:[], host:socket.id, phase:'lobby', board:generateMap(), bombs:[], flames:[], powerups:[], winner:null, countDown:null, startedAt:null, nextCollapse:0, collapseStep:0};
  rooms.set(id,room);
  joinRoom(socket,room,name);
}
function cleanName(name) { return String(name||'Jogador').trim().slice(0,18)||'Jogador'; }
function joinRoom(socket,room,name) {
  if (room.phase!=='lobby') return socket.emit('errorMessage','A partida já começou. Entre na próxima rodada.');
  if (room.players.length>=MAX_PLAYERS) return socket.emit('errorMessage','Sala cheia (máximo de 4 jogadores).');
  const taken=new Set(room.players.map(p=>p.slot));
  const slot=[0,1,2,3].find(n=>!taken.has(n));
  const spawn=SPAWNS[slot];
  room.players.push({id:socket.id,name:cleanName(name),slot,color:COLORS[slot],x:spawn.x,y:spawn.y,alive:true,capacity:1,range:2,lastMove:0,keys:{},bombsPlaced:0,speed:0,kick:false,glove:false,pierce:false,shield:0,remote:false,wins:0});
  occupants.set(socket.id,room.id);
  socket.join(room.id);
  socket.emit('joined',{roomId:room.id,playerId:socket.id});
  broadcast(room);
}
function publicState(room) {
  return {id:room.id,phase:room.phase,host:room.host,board:room.board,
    players:room.players.map(({id,name,slot,color,x,y,alive,capacity,range,speed,kick,glove,pierce,shield,remote,wins})=>({id,name,slot,color,x,y,alive,capacity,range,speed,kick,glove,pierce,shield,remote,wins})),
    bombs:room.bombs.map(({x,y,owner,placedAt,range,remote,pierce})=>({x,y,owner,placedAt,range,remote,pierce})),
    flames:room.flames.map(({x,y,until})=>({x,y,until})),powerups:room.powerups,winner:room.winner,remaining:room.phase==='playing'?Math.max(0,ROUND_MS-(Date.now()-room.startedAt)):0};
}
function broadcast(room) { io.to(room.id).emit('state',publicState(room)); }
function resetRound(room) {
  room.board=generateMap(); room.bombs=[];room.flames=[];room.powerups=[];room.winner=null;
  for(const p of room.players) {
    const pos=SPAWNS[p.slot];
    Object.assign(p,{x:pos.x,y:pos.y,alive:true,capacity:1,range:2,lastMove:0,keys:{},bombsPlaced:0,speed:0,kick:false,glove:false,pierce:false,shield:0,remote:false});
  }
  room.phase='playing';room.startedAt=Date.now();room.nextCollapse=room.startedAt+ROUND_MS;room.collapseStep=0;
  broadcast(room);
}
function inBounds(x,y) { return x>=0&&x<WIDTH&&y>=0&&y<HEIGHT; }
function hasBomb(room,x,y){return room.bombs.some(b=>b.x===x&&b.y===y);}
function move(room,p,dir,now) {
  if(!p.alive||now-p.lastMove<Math.max(105,MOVE_INTERVAL-p.speed*15)) return;
  const vectors={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  if(!vectors[dir]) return;
  const [dx,dy]=vectors[dir], x=p.x+dx, y=p.y+dy;
  if(!inBounds(x,y)||room.board[y][x]!==0 ) return;
  const blocking=room.bombs.find(b=>b.x===x&&b.y===y);
  if(blocking){
    const nx=x+dx,ny=y+dy;
    if(!p.kick||!inBounds(nx,ny)||room.board[ny][nx]!==0||hasBomb(room,nx,ny))return;
    blocking.x=nx;blocking.y=ny;
  }
  p.x=x;p.y=y;p.lastMove=now;
  const index=room.powerups.findIndex(power=>power.x===x&&power.y===y);
  if(index!==-1){ const power=room.powerups.splice(index,1)[0]; if(power.type==='range') p.range=Math.min(6,p.range+1); else if(power.type==='capacity') p.capacity=Math.min(5,p.capacity+1); else if(power.type==='speed')p.speed=Math.min(3,p.speed+1); else if(power.type==='kick')p.kick=true; else if(power.type==='glove')p.glove=true; else if(power.type==='pierce')p.pierce=true; else if(power.type==='shield')p.shield=Math.min(2,p.shield+1); else if(power.type==='remote')p.remote=true; }
  hitPlayers(room,now);
  return true;
}
function placeBomb(room,p,now){
  if(!p.alive||hasBomb(room,p.x,p.y)||room.bombs.filter(b=>b.owner===p.id).length>=p.capacity) return;
  room.bombs.push({x:p.x,y:p.y,owner:p.id,range:p.range,placedAt:now,detonateAt:now+(p.remote?10000:BOMB_FUSE),remote:p.remote,pierce:p.pierce});
  broadcast(room);
}
function hitPlayers(room,now){
  for(const p of room.players){
    if(p.alive&&room.flames.some(f=>f.x===p.x&&f.y===p.y&&f.until>now)){if(p.shield>0){p.shield--;p.x=SPAWNS[p.slot].x;p.y=SPAWNS[p.slot].y;}else p.alive=false;}
  }
}
function explode(room,bomb,now){
  if(!room.bombs.includes(bomb)) return;
  room.bombs.splice(room.bombs.indexOf(bomb),1);
  const affected=[{x:bomb.x,y:bomb.y}];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    for(let distance=1;distance<=bomb.range;distance++){
      const x=bomb.x+dx*distance, y=bomb.y+dy*distance;
      if(!inBounds(x,y)||room.board[y][x]===1)break;
      affected.push({x,y});
      if(room.board[y][x]===2){
        room.board[y][x]=0;
        if(Math.random()<0.38 && !room.powerups.some(p=>p.x===x&&p.y===y)){const types=['range','range','capacity','capacity','speed','speed','kick','glove','pierce','shield','remote'];room.powerups.push({x,y,type:types[Math.floor(Math.random()*types.length)]});}
        if(!bomb.pierce)break;
      }
    }
  }
  for(const {x,y} of affected){
    const other=room.bombs.find(b=>b.x===x&&b.y===y);
    if(other) other.detonateAt=now;
    room.powerups=room.powerups.filter(p=>p.x!==x||p.y!==y);
    const flame=room.flames.find(f=>f.x===x&&f.y===y);
    if(flame) flame.until=now+FLAME_MS;
    else room.flames.push({x,y,until:now+FLAME_MS});
  }
  hitPlayers(room,now);
}
function collapse(room,now){
  const ring=room.collapseStep++;
  if(ring>=Math.min(WIDTH,HEIGHT)/2)return;
  for(let y=ring;y<HEIGHT-ring;y++)for(let x=ring;x<WIDTH-ring;x++){
    if(x!==ring&&y!==ring&&x!==WIDTH-1-ring&&y!==HEIGHT-1-ring)continue;
    room.board[y][x]=1;
    room.powerups=room.powerups.filter(p=>p.x!==x||p.y!==y);
    room.bombs=room.bombs.filter(b=>b.x!==x||b.y!==y);
    for(const p of room.players)if(p.x===x&&p.y===y)p.alive=false;
  }
  room.nextCollapse=now+5500;
}
function removePlayer(socket){
  const roomId=occupants.get(socket.id);
  if(!roomId)return;
  occupants.delete(socket.id);
  const room=rooms.get(roomId);
  socket.leave(roomId);
  if(!room)return;
  room.players=room.players.filter(p=>p.id!==socket.id);
  room.bombs=room.bombs.filter(b=>b.owner!==socket.id);
  if(!room.players.length){rooms.delete(roomId);return;}
  if(room.host===socket.id)room.host=room.players[0].id;
  if(room.phase==='playing'&&room.players.filter(p=>p.alive).length<=1)finishRound(room);
  broadcast(room);
}
function finishRound(room){
  if(room.phase!=='playing') return;
  const survivors=room.players.filter(p=>p.alive);
  room.winner=survivors.length===1?survivors[0].id:null;
  if(survivors.length===1)survivors[0].wins++;
  room.phase='finished';
  for(const p of room.players)p.keys={};
}

io.on('connection',socket=>{
  socket.on('createRoom',data=>{
    if(occupants.has(socket.id))removePlayer(socket);
    createRoom(socket,data?.name);
  });
  socket.on('joinRoom',data=>{
    if(occupants.has(socket.id))removePlayer(socket);
    const id=String(data?.roomId||'').toUpperCase().trim();
    const room=rooms.get(id);
    if(!room)return socket.emit('errorMessage','Sala não encontrada. Verifique o código.');
    joinRoom(socket,room,data?.name);
  });
  socket.on('startGame',()=>{
    const room=rooms.get(occupants.get(socket.id));
    if(!room||room.host!==socket.id||!['lobby','finished'].includes(room.phase))return;
    if(room.players.length<2)return socket.emit('errorMessage','São necessários pelo menos 2 jogadores.');
    resetRound(room);
  });
  socket.on('input',data=>{
    const room=rooms.get(occupants.get(socket.id));
    if(!room||room.phase!=='playing')return;
    const p=room.players.find(p=>p.id===socket.id);
    if(!p||!p.alive)return;
    const dir=String(data?.direction||'');
    if(['up','down','left','right'].includes(dir)) {
      p.keys[dir]=Boolean(data.pressed);
      if(data.pressed && move(room,p,dir,Date.now())) broadcast(room);
    }
    if(data?.bomb===true)placeBomb(room,p,Date.now());
    if(data?.detonate===true&&p.remote){const mine=room.bombs.find(b=>b.owner===p.id&&b.remote);if(mine){mine.detonateAt=Date.now();}}
    if(data?.punch===true&&p.glove){const direction=['up','down','left','right'].find(dir=>p.keys[dir])||'down';const [dx,dy]={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[direction];const b=room.bombs.find(b=>b.x===p.x+dx&&b.y===p.y+dy);if(b){const nx=b.x+dx*2,ny=b.y+dy*2;if(inBounds(nx,ny)&&room.board[ny][nx]===0&&!hasBomb(room,nx,ny)){b.x=nx;b.y=ny;broadcast(room);}}}
  });
  socket.on('leaveRoom',()=>removePlayer(socket));
  socket.on('disconnect',()=>removePlayer(socket));
});
setInterval(()=>{
  const now=Date.now();
  for(const room of rooms.values()){
    if(room.phase!=='playing')continue;
    let changed=false;
    if(now>=room.nextCollapse){collapse(room,now);changed=true;}
    for(const p of room.players){
      if(!p.alive)continue;
      const direction=['up','down','left','right'].find(dir=>p.keys[dir]);
      if(direction && move(room,p,direction,now)) changed=true;
    }
    let safety=0;
    while(safety++<50){
      const bomb=room.bombs.find(b=>b.detonateAt<=now);
      if(!bomb)break;
      explode(room,bomb,now);
      changed=true;
    }
    const flamesBefore=room.flames.length;
    room.flames=room.flames.filter(f=>f.until>now);
    if(flamesBefore!==room.flames.length) changed=true;
    hitPlayers(room,now);
    if(room.players.filter(p=>p.alive).length<=1){finishRound(room);changed=true;}
    if(changed)broadcast(room);
  }
},TICK_MS);
httpServer.listen(PORT,()=>console.log(`Bomber Arena rodando em http://localhost:${PORT}`));
