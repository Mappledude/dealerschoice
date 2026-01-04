import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v1.0.0-PRO";
const APP_NAME = "Dealers Choice";

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const TURN_TIME_LIMIT = 20; 

let profiles = []; 
let rooms = {};

// --- UTILS ---
const serializeRoom = (room) => {
    const { timer, ignitionTimer, deck, ...rest } = room;
    return rest;
};

const combinations = (array, k) => {
  let result = [];
  const fn = (start, prev) => {
    if (prev.length === k) { result.push(prev); return; }
    for (let i = start; i < array.length; i++) { fn(i + 1, [...prev, array[i]]); }
  };
  fn(0, []);
  return result;
};

const rankHand = (cards) => {
  if (!cards || cards.length < 5) return { power: 0, name: "High Card", cards: [] };
  const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
  const ranks = sorted.map(c => VM[c.value]);
  const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
  let compArr = [];
  groups.forEach(g => { for (let i = 0; i < g.c; i++) compArr.push(g.r); });
  const vc = groups.map(x => x.c);
  const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; break; }
  }
  if (!isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(5) && uniqueRanks.includes(4) && uniqueRanks.includes(3) && uniqueRanks.includes(2)) {
    isStraight = true; compArr = [5, 4, 3, 2, 1]; 
  }
  let score = 0, name = "High Card";
  if (isStraight && isFlush) score = 8;
  else if (vc[0] === 4) score = 7;
  else if (vc[0] === 3 && vc[1] === 2) score = 6;
  else if (isFlush) score = 5;
  else if (isStraight) score = 4;
  else if (vc[0] === 3) score = 3;
  else if (vc[0] === 2 && vc[1] === 2) score = 2;
  else if (vc[0] === 2) score = 1;
  const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
  return { power, name, cards: sorted.slice(0, 5) };
};

const getBestHand = (hole, comm) => {
  if (!hole || hole.length === 0) return null;
  const full = [...hole, ...comm];
  let best = null;
  combinations(full, Math.min(full.length, 5)).forEach(c => {
    const res = rankHand(c);
    if (!best || res.power > best.power) best = res;
  });
  return best;
};

// --- CORE HANDLERS ---
const performAction = (roomId, type, amount) => {
  const room = rooms[roomId];
  if (!room) return;
  if (room.timer) clearInterval(room.timer);

  const player = room.players[room.activeIdx];
  if (!player) return;

  if (type === 'FOLD') { player.isFolded = true; player.lastAction = "FOLD"; }
  else if (type === 'CALL') {
    const diff = room.highestBet - player.currentBet;
    const actualCall = Math.min(diff, player.chips);
    player.chips -= actualCall; player.currentBet += actualCall;
    player.lastAction = actualCall > 0 ? "CALL" : "CHECK";
  } else if (type === 'RAISE') {
    const diff = amount - player.currentBet;
    player.chips -= diff; player.currentBet = amount;
    room.highestBet = amount; player.lastAction = "RAISE";
  }

  const seated = room.players.map((p, i) => (p && !p.isFolded && (p.chips > 0 || p.currentBet > 0)) ? i : null).filter(x => x !== null);
  const nextIdx = seated[(seated.indexOf(room.activeIdx) + 1) % seated.length];
  const allMatched = room.players.every(p => !p || p.isFolded || p.chips === 0 || p.currentBet === room.highestBet);

  if (allMatched && (nextIdx === seated[0] || seated.length < 2)) {
      nextPhase(roomId);
  } else {
    room.activeIdx = nextIdx;
    startTurnTimer(roomId);
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
  }
};

const nextPhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const roundTotal = room.players.reduce((acc, p) => acc + (p?.currentBet || 0), 0);
    room.potData[0].amount += roundTotal;
    room.players.forEach(p => { if (p) { p.currentBet = 0; p.lastAction = null; } });
    room.highestBet = 0;

    if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = room.deck.splice(0, 3); }
    else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(...room.deck.splice(0, 1)); }
    else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(...room.deck.splice(0, 1)); }
    else { processShowdown(roomId); return; }
    
    const seated = room.players.map((p, i) => (p && !p.isFolded && p.chips > 0) ? i : null).filter(x => x !== null);
    if (seated.length < 2) { processShowdown(roomId); return; }
    room.activeIdx = seated[0];
    startTurnTimer(roomId);
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    const active = room.players.filter(p => p && !p.isFolded);
    const evals = active.map(p => ({ i: room.players.indexOf(p), res: getBestHand(p.hand, room.community) }));
    if (evals.length > 0) {
        const maxP = Math.max(...evals.map(e => e.res.power));
        const winners = evals.filter(e => e.res.power === maxP);
        const share = Math.floor(room.potData[0].amount / winners.length);
        room.showdownWinners = winners.map(w => ({ name: room.players[w.i].name, rank: w.res.name, hand: w.res.cards, amount: share }));
        winners.forEach(w => { room.players[w.i].chips += share; room.players[w.i].isWinner = true; });
    }
    room.phase = PHASES.SHOWDOWN;
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    setTimeout(() => {
        const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) {
            room.dealerIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
            runIgnition(roomId);
        } else {
            room.phase = PHASES.IDLE;
            io.to(roomId).emit('roomUpdate', serializeRoom(room));
        }
    }, 4000); 
};

const runIgnition = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;
  const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
  if (seated.length < 2) { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', serializeRoom(room)); return; }
  if (room.dealerIdx === undefined || !room.players[room.dealerIdx]) room.dealerIdx = seated[0];
  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; room.potData = [{ amount: 0 }]; room.highestBet = room.bb; room.phase = PHASES.PRE_FLOP; room.showdownWinners = null;
  room.players.forEach(p => { if (p) { p.hand = room.deck.splice(0, 2); p.currentBet = 0; p.isFolded = false; p.isWinner = false; p.lastAction = null; } });
  const sbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
  const bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
  room.players[sbIdx].chips -= room.sb; room.players[sbIdx].currentBet = room.sb;
  room.players[bbIdx].chips -= room.bb; room.players[bbIdx].currentBet = room.bb;
  room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
  startTurnTimer(roomId);
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
};

const cashOutPlayer = (uid) => {
    Object.values(rooms).forEach(room => {
        const pIdx = room.players.findIndex(p => p && p.uid === uid);
        if (pIdx !== -1) {
            const player = room.players[pIdx];
            const profile = profiles.find(pr => pr.uid === uid);
            if (profile) {
                // Return table chips to wallet. currentBet remains in pot.
                profile.chips += player.chips;
            }
            room.players[pIdx] = null;
            io.to(room.id).emit('roomUpdate', serializeRoom(room));
            io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
            io.emit('profilesUpdate', profiles);
        }
    });
};

const startTurnTimer = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.timer) clearInterval(room.timer);
    room.timeRemaining = TURN_TIME_LIMIT;
    room.timer = setInterval(() => {
        room.timeRemaining--;
        if (room.timeRemaining <= 0) {
            clearInterval(room.timer);
            const player = room.players[room.activeIdx];
            if (!player) return;
            const toCall = room.highestBet - (player.currentBet || 0);
            performAction(roomId, toCall > 0 ? 'FOLD' : 'CALL', 0);
        } else {
            io.to(roomId).emit('roomUpdate', serializeRoom(room));
        }
    }, 1000);
};

io.on('connection', (socket) => {
  let sUid = null;
  socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) }));
  socket.on('playerLogin', ({ password }) => {
    const profile = profiles.find(p => p.password === password);
    if (profile) { sUid = profile.uid; socket.emit('loginSuccess', profile); }
  });
  socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
    const room = rooms[roomId]; if (!room) return callback({ status: 'error' });
    let globalProfile = profiles.find(p => p.uid === profile.uid);
    if (!globalProfile) { globalProfile = { ...profile, chips: 10000 }; profiles.push(globalProfile); }
    if (globalProfile.chips < Number(buyIn)) return callback({ status: 'error' });
    globalProfile.chips -= Number(buyIn);
    const emptyIdx = room.players.findIndex(p => p === null);
    room.players[emptyIdx] = { ...profile, chips: Number(buyIn), seatIdx: emptyIdx, currentBet: 0, isFolded: false };
    sUid = profile.uid; socket.join(roomId);
    callback({ status: 'ok' });
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    io.emit('profilesUpdate', profiles);
    if (room.phase === PHASES.IDLE && room.players.filter(Boolean).length >= 2) {
        if (!room.ignitionTimer) room.ignitionTimer = setTimeout(() => { room.ignitionTimer = null; runIgnition(roomId); }, 3000);
    }
  });
  socket.on('playerRebuy', ({ roomId, uid, amount }) => {
      const room = rooms[roomId]; if (!room) return;
      const pIdx = room.players.findIndex(p => p && p.uid === uid);
      const profile = profiles.find(p => p.uid === uid);
      if (pIdx !== -1 && profile && profile.chips >= amount) {
          profile.chips -= amount; room.players[pIdx].chips += amount;
          io.to(roomId).emit('roomUpdate', serializeRoom(room));
          io.emit('profilesUpdate', profiles);
      }
  });
  socket.on('leaveRoom', ({ uid }) => cashOutPlayer(uid));
  socket.on('disconnect', () => { if (sUid) cashOutPlayer(sUid); });
  socket.on('playerAction', ({ roomId, type, amount }) => performAction(roomId, type, amount));
  socket.on('adminNuclearReset', () => { rooms = {}; profiles = []; io.emit('lobbyUpdate', []); io.emit('profilesUpdate', []); io.emit('roomUpdate', null); });
  socket.on('adminCreatePlayer', (p) => { profiles.push(p); io.emit('profilesUpdate', profiles); });
  socket.on('adminCreateRoom', (data) => { rooms[data.id] = { ...data, players: Array(10).fill(null), phase: PHASES.IDLE, community: [], potData: [{amount:0}], dealerIdx: 0, timeRemaining: 20 }; io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); });
  socket.on('adminDeletePlayer', (uid) => { profiles = profiles.filter(p => p.uid !== uid); io.emit('profilesUpdate', profiles); });
  socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); });
});

server.listen(10000, () => console.log(`${APP_NAME} ${VERSION} running`));
