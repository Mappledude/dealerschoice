import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, { 
  cors: { origin: "*" },
  pingTimeout: 60000, 
  pingInterval: 25000  
});

const VERSION = "v1.3.11";
const TOTAL_SEATS = 10; 

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const V_LABEL = { 1: 'Ace(Low)', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };

const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2, HILOW: 4, REDSBLACKS: 4 };
const variantNames = { HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple", MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks" };
const BOT_NAMES = ["Baabu Shona", "Laddoo", "Chikku", "Guddu", "Kalia", "Chinky", "Bunty", "Babli", "Chhotu", "Motu", "Jadiya", "Piddi"];

let profiles = []; 
let rooms = {};
let connectedUsers = new Map();

// Helper: Rank calculation
const rankHand = (cards, isAceLow = false) => {
  if (!cards || cards.length < 5) return { power: 0, name: "...", cards: [] };
  const getVal = (v) => (isAceLow && v === 'A') ? 1 : VM[v];
  const sorted = [...cards].sort((a, b) => getVal(b.value) - getVal(a.value));
  const ranks = sorted.map(c => getVal(c.value));
  const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
  let compArr = []; groups.forEach(g => { for (let i = 0; i < g.c; i++) compArr.push(g.r); });
  const vc = groups.map(x => x.c);
  const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false, straightHigh = 0;
  if (uniqueRanks.length >= 5) {
    for (let i = 0; i <= uniqueRanks.length - 5; i++) { if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; } }
    if (!isStraight && !isAceLow && uniqueRanks.includes(14) && [5,4,3,2].every(r => uniqueRanks.includes(r))) { isStraight = true; straightHigh = 5; compArr = [5, 4, 3, 2, 1]; }
  }
  let score = 0, name = `High Card ${V_LABEL[compArr[0]] || compArr[0]}`;
  if (vc[0] === 5) score = 9, name = `Five of a Kind`;
  else if (isStraight && isFlush) score = 8, name = "Straight Flush";
  else if (vc[0] === 4) score = 7, name = `Four of a Kind`;
  else if (vc[0] === 3 && vc[1] >= 2) score = 6, name = `Full House`;
  else if (isFlush) score = 5, name = `Flush`;
  else if (isStraight) score = 4, name = `Straight`;
  else if (vc[0] === 3) score = 3, name = `Three of a Kind`;
  else if (vc[0] === 2 && vc[1] === 2) score = 2, name = `Two Pair`;
  else if (vc[0] === 2) score = 1, name = `Pair`;
  const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
  return { power, name, cards: sorted.slice(0, 5) };
};

const combinations = (array, k) => {
  let result = [];
  const fn = (start, prev) => { if (prev.length === k) { result.push(prev); return; } for (let i = start; i < array.length; i++) { fn(i + 1, [...prev, array[i]]); } };
  fn(0, []); return result;
};

const VARIATION_STRATEGIES = {
  HOLDEM: (hole, comm) => { let best = { power: -1 }; combinations([...hole, ...comm], 5).forEach(c => { const r = rankHand(c); if (r.power > best.power) best = r; }); return { high: best, low: null }; },
  OMAHA: (hole, comm) => { let best = { power: -1 }; combinations(hole, 2).forEach(h => { combinations(comm, 3).forEach(b => { const r = rankHand([...h, ...b]); if (r.power > best.power) best = r; }); }); return { high: best, low: null }; },
  PINEAPPLE: (hole, comm) => { let best = { power: -1 }; combinations([...hole, ...comm], 5).forEach(c => { const r = rankHand(c); if (r.power > best.power) best = r; }); return { high: best, low: null }; },
  MUFLIS: (hole, comm) => { let bestWeak = { power: 9999999999 }; combinations([...hole, ...comm], 5).forEach(c => { const r = rankHand(c, true); if (r.power < bestWeak.power) bestWeak = r; }); return { high: bestWeak, low: null }; },
  HILOW: (hole, comm) => { 
    let bestH = { power: -1 }, bestL = { power: 9999999999 };
    combinations(hole, 2).forEach(h => { combinations(comm, 3).forEach(b => {
      const rH = rankHand([...h, ...b], false); if (rH.power > bestH.power) bestH = rH;
      const rL = rankHand([...h, ...b], true); if (rL.power < bestL.power) bestL = rL;
    });});
    return { high: bestH, low: { ...bestL, name: `Low: ${bestL.name}` } };
  },
  REDSBLACKS: (hole, comm) => {
    const reds = hole.filter(c => c.suit === '♥' || c.suit === '♦');
    const blacks = hole.filter(c => c.suit === '♣' || c.suit === '♠');
    const hasJoker = (reds.length === 2 && blacks.length >= 1) || (blacks.length === 2 && reds.length >= 1);
    let best = { power: -1 };
    if (hasJoker) { hole.forEach(f => { combinations(comm, 3).forEach(b => { for (let v of VALUES) { for (let s of SUITS) { const r = rankHand([{value:v, suit:s}, f, ...b]); if (r.power > best.power) best = { ...r, name: `${r.name} (Joker)` }; } } }); }); }
    else { combinations(hole, 2).forEach(h => { combinations(comm, 3).forEach(b => { const r = rankHand([...h, ...b]); if (r.power > best.power) best = { ...r, name: `${r.name} (Natural)` }; }); }); }
    return { high: best, low: null };
  }
};

const serializeRoom = (room) => { 
  if (!room) return null; 
  const { deck, ignitionTimer, ...rest } = room; 
  return { ...rest, minRaiseAmount: (room.highestBet || 0) + (room.lastRaiseIncrement || (room.bb || 2)) }; 
};

const updateRoomStrengths = (roomId) => {
  const room = rooms[roomId]; if (!room) return;
  const vId = room.activeVariant?.id || 'HOLDEM';
  room.players.forEach(p => {
    if (p && p.hand && !p.isFolded) {
      const evalRes = (VARIATION_STRATEGIES[vId] || VARIATION_STRATEGIES.HOLDEM)(p.hand, room.community);
      p.strength = evalRes.high.name; p.strengthPower = evalRes.high.power;
      const maxPower = 9 * Math.pow(15, 7);
      p.winProbability = vId === 'MUFLIS' ? (1 - (p.strengthPower / maxPower)) * 100 : (p.strengthPower / maxPower) * 100;
      if (evalRes.low) { p.lowStrength = evalRes.low.name; p.lowWinProbability = 50; }
    }
  });
};

const triggerBotTurn = (roomId) => {
    const room = rooms[roomId]; if (!room || room.activeIdx === -1) return;
    const player = room.players[room.activeIdx]; if (!player || !player.isBot) return;
    setTimeout(() => {
        const current = rooms[roomId]; if (!current || current.activeIdx === -1 || current.players[current.activeIdx]?.uid !== player.uid) return;
        performAction(roomId, current.highestBet > player.currentBet ? 'CALL' : 'CHECK', 0);
    }, 2000);
};

const processShowdown = (roomId) => {
  const room = rooms[roomId]; if (!room) return;
  room.phase = PHASES.SHOWDOWN;
  const active = room.players.filter(p => p && !p.isFolded);
  
  if (active.length > 0) {
    active.sort((a,b) => b.strengthPower - a.strengthPower);
    const maxPower = active[0].strengthPower;
    const winners = active.filter(p => p.strengthPower === maxPower);
    
    // Split pot aggregation
    const share = Math.floor(room.potAmount / winners.length);
    room.showdownWinners = winners.map(w => {
      w.chips += share;
      w.isWinner = true;
      return { name: w.name, amount: share, rank: w.strength, hand: w.hand, winning5Ids: [] }; 
    });
    
    const winnerNames = winners.map(w => w.name).join(' & ');
    io.to(roomId).emit('log', { name: "SYSTEM", action: `${winnerNames} SPLIT POT $${room.potAmount} WITH ${winners[0].strength}`, type: 'win', timestamp: Date.now() });
  }
  
  room.potAmount = 0;
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
  
  // Extended 8 second showdown
  setTimeout(() => { 
    room.dealerIdx = (room.dealerIdx + 1) % TOTAL_SEATS;
    while (!room.players[room.dealerIdx]) room.dealerIdx = (room.dealerIdx + 1) % TOTAL_SEATS;
    room.players.forEach(p => { if (p) p.isWinner = false; });
    room.phase = PHASES.IDLE;
    runIgnition(roomId);
  }, 8000);
};

const nextPhase = (roomId) => {
  const room = rooms[roomId]; if (!room) return;
  room.players.forEach(p => { if (p) p.actedThisStreet = false; });
  if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = room.deck.splice(0, 3); }
  else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(room.deck.shift()); }
  else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(room.deck.shift()); }
  else { return processShowdown(roomId); }
  
  room.highestBet = 0; room.players.forEach(p => { if (p) p.currentBet = 0; });
  room.activeIdx = (room.dealerIdx + 1) % TOTAL_SEATS;
  while (!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded) { room.activeIdx = (room.activeIdx + 1) % TOTAL_SEATS; }
  updateRoomStrengths(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room));
  triggerBotTurn(roomId);
};

const performAction = (roomId, type, amount) => {
    const room = rooms[roomId]; if (!room || room.activeIdx === -1) return;
    const player = room.players[room.activeIdx]; if (!player) return;
    player.actedThisStreet = true;
    if (type === 'FOLD') { player.isFolded = true; player.lastAction = "FOLD"; io.to(roomId).emit('log', { name: player.name, action: 'folds', type: 'fold', timestamp: Date.now() }); }
    else if (type === 'CALL' || type === 'CHECK') { 
        const diff = room.highestBet - player.currentBet; 
        player.chips -= diff; 
        player.currentBet += diff; 
        room.potAmount += diff;
        player.lastAction = type; 
    }
    else if (type === 'RAISE') { 
        const diff = amount - player.currentBet; 
        player.chips -= diff; 
        player.currentBet = amount; 
        room.potAmount += diff;
        room.highestBet = amount; 
        player.lastAction = "RAISE"; 
    }
    moveToNextPlayer(roomId);
};

const moveToNextPlayer = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    updateRoomStrengths(roomId);
    const active = room.players.filter(p => p && !p.isFolded && !p.waitingForNextHand);
    const allMatched = active.every(p => p.currentBet === room.highestBet);
    const allActed = active.every(p => p.actedThisStreet);

    if (active.length <= 1) return processShowdown(roomId);
    if (allMatched && allActed) return nextPhase(roomId);
    
    room.activeIdx = (room.activeIdx + 1) % TOTAL_SEATS;
    while (!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded || room.players[room.activeIdx].waitingForNextHand) {
        room.activeIdx = (room.activeIdx + 1) % TOTAL_SEATS;
    }
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    triggerBotTurn(roomId);
};

const runIgnition = (roomId) => {
  const room = rooms[roomId]; if (!room) return;
  const seated = room.players.filter(p => p && p.chips > 0);
  if (seated.length < 2) { room.phase = PHASES.IDLE; return; }
  
  const dSeat = room.players[room.dealerIdx]; 
  
  // RANDOM VARIATION FOR BOTS
  if (dSeat && (dSeat.isBot || !dSeat.pendingVariant)) {
    const keys = Object.keys(variantNames);
    dSeat.pendingVariant = keys[Math.floor(Math.random() * keys.length)];
  }

  const vId = dSeat?.pendingVariant || 'HOLDEM'; 
  room.activeVariant = { id: vId, name: variantNames[vId], holeCards: holeCardsMap[vId] };
  io.to(roomId).emit('log', { name: "SYSTEM", action: `${dSeat?.name || 'DEALER'} LOCKS IN ${variantNames[vId]}`, type: 'phase', timestamp: Date.now() });
  
  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; room.phase = PHASES.PRE_FLOP; room.highestBet = room.bb || 2; room.lastRaiseIncrement = room.bb || 2;
  
  room.players.forEach(p => { if (p) { 
    p.hand = room.deck.splice(0, room.activeVariant.holeCards); 
    p.isFolded = false; p.currentBet = 0; p.actedThisStreet = false; p.lastAction = null; p.waitingForNextHand = false; 
  } });
  
  const seatedIdxs = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
  const sbIdx = seatedIdxs[(seatedIdxs.indexOf(room.dealerIdx) + 1) % seatedIdxs.length];
  const bbIdx = seatedIdxs[(seatedIdxs.indexOf(room.dealerIdx) + 2) % seatedIdxs.length];
  
  room.players[sbIdx].chips -= room.sb || 1; room.players[sbIdx].currentBet = room.sb || 1;
  room.players[bbIdx].chips -= room.bb || 2; room.players[bbIdx].currentBet = room.bb || 2;
  room.potAmount = (room.sb || 1) + (room.bb || 2);
  room.activeIdx = seatedIdxs[(seatedIdxs.indexOf(bbIdx) + 1) % seatedIdxs.length];
  
  updateRoomStrengths(roomId); 
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
  triggerBotTurn(roomId);
};

io.on('connection', (socket) => {
  socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) }));
  
  socket.on('playerLogin', ({ password }) => {
    const profile = profiles.find(p => p.password.toLowerCase() === String(password).toLowerCase());
    if (profile) {
      if (connectedUsers.has(profile.uid)) {
        io.to(connectedUsers.get(profile.uid)).emit('forceLogout');
      }
      connectedUsers.set(profile.uid, socket.id);
      socket.emit('loginSuccess', profile);
    }
  });

  socket.on('adminNuclearReset', () => {
    rooms = {}; profiles = profiles.filter(p => p.role === 'admin');
    io.emit('lobbyUpdate', []); io.emit('profilesUpdate', profiles);
  });

  socket.on('adminCreatePlayer', (data) => {
    const p = { uid: data.uid, name: data.name, password: data.password, chips: Number(data.chips) || 1000, role: 'player' };
    profiles.push(p); io.emit('profilesUpdate', profiles);
  });

  socket.on('adminAddBot', ({ roomId }) => {
    const room = rooms[roomId]; if (!room) return;
    const emptyIdx = room.players.findIndex(p => p === null); if (emptyIdx === -1) return;
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    room.players[emptyIdx] = { uid: `bot_${Math.random()}`, name, isBot: true, chips: 1000, seatIdx: emptyIdx, isFolded: false, waitingForNextHand: room.phase !== PHASES.IDLE, currentBet: 0 };
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
    if (room.phase === PHASES.IDLE && room.players.filter(p => p && p.chips > 0).length >= 2) runIgnition(roomId);
  });

  socket.on('adminCreateRoom', (data) => {
    rooms[data.id] = { ...data, players: Array(TOTAL_SEATS).fill(null), phase: PHASES.IDLE, community: [], dealerIdx: 0, highestBet: 0, lastRaiseIncrement: (data.bb || 2) };
    io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
  });

  socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
    const room = rooms[roomId]; if (!room) return;
    const idx = room.players.findIndex(p => p === null);
    if (idx !== -1) {
      room.players[idx] = { ...profile, chips: Number(buyIn), seatIdx: idx, isFolded: false, waitingForNextHand: room.phase !== PHASES.IDLE, currentBet: 0 };
      socket.join(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room));
      io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
      if (callback) callback({ status: 'ok' });
    }
  });

  socket.on('playerAction', ({ roomId, type, amount }) => performAction(roomId, type, amount));

  socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
    const profile = profiles.find(p => p.uid === uid);
    if (profile) profile.pendingVariant = pendingVariant;
    Object.values(rooms).forEach(room => {
      const seated = room.players.find(p => p && p.uid === uid);
      if (seated) seated.pendingVariant = pendingVariant;
    });
  });

  socket.on('previewVariation', ({ roomId, variantId }) => {
    const room = rooms[roomId]; if (room) { room.pendingVariant = variantId; io.to(roomId).emit('variantPreview', variantId); }
  });

  socket.on('disconnect', () => {
    for (let [uid, sid] of connectedUsers.entries()) {
      if (sid === socket.id) { connectedUsers.delete(uid); break; }
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`ARENA ${VERSION} ONLINE`));
