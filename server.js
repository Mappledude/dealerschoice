import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- VERSION & METADATA ---
const VERSION = "v0.1";
const APP_NAME = "Dealers Choice";

// --- CONSTANTS ---
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 3, HILOW: 4, REDSBLACKS: 4 };
const variantNames = {
  HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple",
  MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks"
};

// --- STATE ---
let profiles = []; 
let rooms = {};

// --- UTILS ---
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
  let isStraight = false, straightHigh = 0;
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
  }
  if (!isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(5) && uniqueRanks.includes(4) && uniqueRanks.includes(3) && uniqueRanks.includes(2)) {
    isStraight = true; straightHigh = 5; compArr = [5, 4, 3, 2, 1]; 
  }
  let score = 0, name = "High Card";
  if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
  else if (vc[0] === 4) { score = 7; name = "Four of a Kind"; }
  else if (vc[0] === 3 && vc[1] === 2) { score = 6; name = "Full House"; }
  else if (isFlush) { score = 5; name = "Flush"; }
  else if (isStraight) { score = 4; name = "Straight"; }
  else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
  else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
  else if (vc[0] === 2) { score = 1; name = "Pair"; }
  const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
  return { power, name, cards: sorted.slice(0, 5) };
};

const getBestHand = (hole, comm, variantId) => {
  if (!hole || hole.length === 0) return null;
  const full = [...hole, ...comm];
  if (variantId === 'OMAHA' || variantId === 'HILOW') {
    let best = null;
    combinations(hole, 2).forEach(h => {
      combinations(comm, Math.min(comm.length, 3)).forEach(c => {
        const res = rankHand([...h, ...c]);
        if (!best || res.power > best.power) best = res;
      });
    });
    return best;
  }
  let best = null;
  combinations(full, Math.min(full.length, 5)).forEach(c => {
    const res = rankHand(c);
    if (variantId === 'MUFLIS') {
        if (!best || res.power < best.power) best = res;
    } else {
        if (!best || res.power > best.power) best = res;
    }
  });
  return best;
};

// --- CORE GAME ENGINE ---
const runIgnition = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;
  const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
  if (seated.length < 2) { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', room); return; }

  if (!room.players[room.dealerIdx]) room.dealerIdx = seated[0];
  const dealer = room.players[room.dealerIdx];
  const vId = dealer.pendingVariant || 'HOLDEM';
  room.activeVariant = { id: vId, name: variantNames[vId], holeCards: holeCardsMap[vId] };

  io.to(roomId).emit('log', { name: dealer.name, action: `deals ${variantNames[vId]}`, type: 'variant' });

  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; 
  room.potData = [{ amount: 0 }]; 
  room.highestBet = room.bb;
  room.phase = PHASES.PRE_FLOP;
  room.winning5Ids = [];

  room.players.forEach(p => {
    if (!p) return;
    p.hand = room.deck.splice(0, room.activeVariant.holeCards);
    p.currentBet = 0; p.isFolded = false; p.isWinner = false; p.lastAction = null;
  });

  const sbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
  const bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
  
  room.players[sbIdx].chips -= room.sb; room.players[sbIdx].currentBet = room.sb; room.players[sbIdx].lastAction = "SB";
  room.players[bbIdx].chips -= room.bb; room.players[bbIdx].currentBet = room.bb; room.players[bbIdx].lastAction = "BB";
  
  room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
  room.timeRemaining = 30;
  io.to(roomId).emit('roomUpdate', room);
};

const nextPhase = (roomId) => {
  const room = rooms[roomId];
  const roundTotal = room.players.reduce((acc, p) => acc + (p?.currentBet || 0), 0);
  room.potData[0].amount += roundTotal;
  room.players.forEach(p => { if (p) { p.currentBet = 0; p.lastAction = null; } });
  room.highestBet = 0;

  if (room.phase === PHASES.PRE_FLOP) {
    room.phase = PHASES.FLOP;
    room.community = room.deck.splice(0, 3);
  } else if (room.phase === PHASES.FLOP) {
    room.phase = PHASES.TURN;
    room.community.push(...room.deck.splice(0, 1));
  } else if (room.phase === PHASES.TURN) {
    room.phase = PHASES.RIVER;
    room.community.push(...room.deck.splice(0, 1));
  } else if (room.phase === PHASES.RIVER) {
    processShowdown(roomId);
    return;
  }
  
  const seated = room.players.map((p, i) => (p && !p.isFolded && p.chips > 0) ? i : null).filter(x => x !== null);
  room.activeIdx = seated[0];
  io.to(roomId).emit('roomUpdate', room);
};

const processShowdown = (roomId) => {
  const room = rooms[roomId];
  const active = room.players.filter(p => p && !p.isFolded);
  const evals = active.map(p => ({
    i: room.players.indexOf(p),
    res: getBestHand(p.hand, room.community, room.activeVariant.id)
  }));

  let winners = [];
  if (room.activeVariant.id === 'MUFLIS') {
    const minPower = Math.min(...evals.map(e => e.res.power));
    winners = evals.filter(e => e.res.power === minPower);
  } else {
    const maxPower = Math.max(...evals.map(e => e.res.power));
    winners = evals.filter(e => e.res.power === maxPower);
  }

  const share = Math.floor(room.potData[0].amount / winners.length);
  room.showdownWinners = [];
  winners.forEach(w => {
    const p = room.players[w.i];
    p.chips += share;
    p.isWinner = true;
    room.winning5Ids = w.res.cards.map(c => c.id);
    room.showdownWinners.push({ name: p.name, rank: w.res.name, hand: w.res.cards, amount: share });
    io.to(roomId).emit('log', { name: p.name, action: `wins $${share.toLocaleString()} with ${w.res.name}`, type: 'win' });
  });

  room.phase = PHASES.SHOWDOWN;
  io.to(roomId).emit('roomUpdate', room);
  
  setTimeout(() => {
    const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
    if (seated.length >= 2) {
      room.dealerIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
      runIgnition(roomId);
    } else {
      room.phase = PHASES.IDLE;
      io.to(roomId).emit('roomUpdate', room);
    }
  }, 8500);
};

// --- SOCKETS ---
io.on('connection', (socket) => {
  socket.on('getInitialData', () => {
    socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms) });
  });

  socket.on('playerLogin', ({ password }) => {
    const profile = profiles.find(p => p.password === password);
    if (profile) socket.emit('loginSuccess', profile);
  });

  socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
    const room = rooms[roomId];
    if (!room) return callback({ status: 'error' });
    const emptyIdx = room.players.findIndex(p => p === null);
    if (emptyIdx === -1) return callback({ status: 'error', message: 'Full' });
    
    room.players[emptyIdx] = { ...profile, chips: Number(buyIn), seatIdx: emptyIdx, currentBet: 0, isFolded: false };
    socket.join(roomId);
    callback({ status: 'ok' });
    io.to(roomId).emit('roomUpdate', room);
    if (room.phase === PHASES.IDLE && room.players.filter(Boolean).length >= 2) runIgnition(roomId);
  });

  socket.on('playerAction', ({ roomId, type, amount }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players[room.activeIdx];
    if (!player) return;

    if (type === 'FOLD') {
      player.isFolded = true;
      player.lastAction = "FOLD";
      io.to(roomId).emit('log', { name: player.name, action: "folds", type: "fold" });
    } else if (type === 'CALL') {
      const diff = room.highestBet - player.currentBet;
      player.chips -= diff;
      player.currentBet += diff;
      player.lastAction = diff > 0 ? "CALL" : "CHECK";
    } else if (type === 'RAISE') {
      const diff = amount - player.currentBet;
      player.chips -= diff;
      player.currentBet = amount;
      room.highestBet = amount;
      player.lastAction = "RAISE";
    }

    const seated = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const nextIdx = seated[(seated.indexOf(room.activeIdx) + 1) % seated.length];
    
    const allMatched = room.players.every(p => !p || p.isFolded || p.currentBet === room.highestBet);
    if (allMatched && nextIdx === seated[0]) nextPhase(roomId);
    else {
      room.activeIdx = nextIdx;
      io.to(roomId).emit('roomUpdate', room);
    }
  });

  socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
    const profile = profiles.find(p => p.uid === uid);
    if (profile) profile.pendingVariant = pendingVariant;
  });

  // Admin Events
  socket.on('adminNuclearReset', () => { rooms = {}; profiles = []; io.emit('lobbyUpdate', []); io.emit('profilesUpdate', []); });
  socket.on('adminCreatePlayer', (p) => { profiles.push(p); io.emit('profilesUpdate', profiles); });
  socket.on('adminDeletePlayer', (uid) => { profiles = profiles.filter(p => p.uid !== uid); io.emit('profilesUpdate', profiles); });
  socket.on('adminEditChips', ({ uid, chips }) => { const p = profiles.find(x => x.uid === uid); if(p) p.chips = Number(chips); io.emit('profilesUpdate', profiles); });
  socket.on('adminCreateRoom', (data) => { rooms[data.id] = { ...data, players: Array(10).fill(null), phase: PHASES.IDLE, community: [], potData: [{amount:0}], dealerIdx: 0 }; io.emit('lobbyUpdate', Object.values(rooms)); });
  socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms)); });
  socket.on('adminAddBot', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room) return;
      const emptyIdx = room.players.findIndex(p => p === null);
      if (emptyIdx !== -1) {
          room.players[emptyIdx] = { name: "BOT_"+Math.random().toString(36).slice(2,5).toUpperCase(), chips: 2000, uid: 'bot_'+Math.random(), isBot: true };
          io.to(roomId).emit('roomUpdate', room);
          if (room.phase === PHASES.IDLE && room.players.filter(Boolean).length >= 2) runIgnition(roomId);
      }
  });
});

server.listen(10000, () => console.log(`${APP_NAME} ${VERSION} running`));
