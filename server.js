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

const VERSION = "v1.1.0";
const TOTAL_SEATS = 10; 

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const V_LABEL = { 1: 'Ace(Low)', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };

const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2, HILOW: 4, REDSBLACKS: 4 };
const variantNames = {
  HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple",
  MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks"
};

let profiles = []; 
let rooms = {};

// Helper: Timestamp generator
const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const combinations = (array, k) => {
  let result = [];
  const fn = (start, prev) => {
    if (prev.length === k) { result.push(prev); return; }
    for (let i = start; i < array.length; i++) { fn(i + 1, [...prev, array[i]]); }
  };
  fn(0, []);
  return result;
};

// CORE EVALUATOR (rankHand)
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
  if (vc[0] === 5) { score = 9; name = `Five of a Kind ${V_LABEL[groups[0].r]}s`; }
  else if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
  else if (vc[0] === 4) { score = 7; name = `Four of a Kind ${V_LABEL[groups[0].r]}s`; }
  else if (vc[0] === 3 && vc[1] >= 2) { score = 6; name = `Full House`; }
  else if (isFlush) { score = 5; name = `Flush`; }
  else if (isStraight) { score = 4; name = `Straight`; }
  else if (vc[0] === 3) { score = 3; name = `Three of a Kind`; }
  else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = `Two Pair`; }
  else if (vc[0] === 2) { score = 1; name = `Pair`; }
  const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
  return { power, name, cards: sorted.slice(0, 5) };
};

// STRATEGY PATTERN ENGINE
const VARIATION_STRATEGIES = {
  HOLDEM: (hole, comm) => {
    let best = { power: -1 };
    combinations([...hole, ...comm], 5).forEach(c => { const r = rankHand(c); if (r.power > best.power) best = r; });
    return { high: best, low: null };
  },
  OMAHA: (hole, comm) => {
    let best = { power: -1 };
    // Strict 2+3 Rule
    combinations(hole, 2).forEach(h => {
      combinations(comm, 3).forEach(b => {
        const r = rankHand([...h, ...b]);
        if (r.power > best.power) best = r;
      });
    });
    return { high: best, low: null };
  },
  PINEAPPLE: (hole, comm) => {
    let best = { power: -1 };
    combinations([...hole, ...comm], 5).forEach(c => { const r = rankHand(c); if (r.power > best.power) best = r; });
    return { high: best, low: null };
  },
  MUFLIS: (hole, comm) => {
    let bestWeakest = { power: 99999999999 };
    // Aces are 1
    combinations([...hole, ...comm], 5).forEach(c => {
      const r = rankHand(c, true);
      if (r.power < bestWeakest.power) bestWeakest = r;
    });
    return { high: bestWeakest, low: null };
  },
  HILOW: (hole, comm) => {
    let bestHigh = { power: -1 }, bestLow = { power: 99999999999 };
    combinations(hole, 2).forEach(h => {
      combinations(comm, 3).forEach(b => {
        const rH = rankHand([...h, ...b], false);
        if (rH.power > bestHigh.power) bestHigh = rH;
        const rL = rankHand([...h, ...b], true);
        if (rL.power < bestLow.power) bestLow = rL;
      });
    });
    return { high: bestHigh, low: { ...bestLow, name: `Low: ${bestLow.name}` } };
  },
  REDSBLACKS: (hole, comm) => {
    const reds = hole.filter(c => c.suit === '♥' || c.suit === '♦');
    const blacks = hole.filter(c => c.suit === '♣' || c.suit === '♠');
    // Joker Logic: Exactly 3 cards color mix?
    const hasJokerMix = (reds.length === 2 && blacks.length >= 1) || (blacks.length === 2 && reds.length >= 1);
    
    let best = { power: -1 };
    if (hasJokerMix) {
      // Find the "remaining 4th card" - simpler approximation: try every hole card as the 4th, with Joker wildcard
      hole.forEach(fourth => {
        combinations(comm, 3).forEach(b => {
          // Joker creates best possible 5th card
          for (let v of VALUES) {
            for (let s of SUITS) {
              const r = rankHand([{value:v, suit:s}, fourth, ...b]);
              if (r.power > best.power) best = { ...r, name: `${r.name} (Joker)` };
            }
          }
        });
      });
    } else {
      // Natural: any 2 of 4 hole
      combinations(hole, 2).forEach(h => {
        combinations(comm, 3).forEach(b => {
          const r = rankHand([...h, ...b]);
          if (r.power > best.power) best = { ...r, name: `${r.name} (Natural)` };
        });
      });
    }
    return { high: best, low: null };
  }
};

const getBestHand = (hole, comm, variantId) => {
  if (!hole || hole.length === 0 || !comm || comm.length < 3) return { high: { power: 0, name: "..." }, low: null };
  const strategy = VARIATION_STRATEGIES[variantId] || VARIATION_STRATEGIES.HOLDEM;
  return strategy(hole, comm);
};

// ... (Rest of game server logic from v1.0.96 with these engine updates) ...

const serializeRoom = (room) => {
  if (!room) return null;
  const { timer, deck, ignitionTimer, ...rest } = room;
  return { ...rest, minRaiseAmount: room.highestBet + room.lastRaiseIncrement };
};

const updateRoomStrengths = (roomId) => {
  const room = rooms[roomId]; if (!room) return;
  const vId = room.activeVariant?.id || 'HOLDEM';
  room.players.forEach(p => {
    if (p && p.hand && !p.isFolded && !p.waitingForNextHand) {
      const evalResult = getBestHand(p.hand, room.community, vId);
      p.strength = evalResult.high.name;
      p.strengthPower = evalResult.high.power;
      // Probabilities (Simplified for Arena performance)
      const maxPower = 9 * Math.pow(15, 7);
      p.winProbability = vId === 'MUFLIS' ? (1 - (p.strengthPower / maxPower)) * 100 : (p.strengthPower / maxPower) * 100;
      if (evalResult.low) {
        p.lowStrength = evalResult.low.name;
        p.lowStrengthPower = evalResult.low.power;
        p.lowWinProbability = 50; // Mock placeholder
      }
    }
  });
};

const runIgnition = (roomId) => {
  const room = rooms[roomId]; if (!room) return;
  const seatedIdxs = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
  if (seatedIdxs.length < 2) { room.phase = PHASES.IDLE; return; }

  const dealerSeat = room.players[room.dealerIdx];
  // Bot Dealer randomization
  if (dealerSeat.isBot) {
    const vIds = Object.keys(variantNames);
    dealerSeat.pendingVariant = vIds[Math.floor(Math.random() * vIds.length)];
  }

  const vId = dealerSeat.pendingVariant || 'HOLDEM';
  room.activeVariant = { id: vId, name: variantNames[vId], holeCards: holeCardsMap[vId] };
  
  io.to(roomId).emit('log', { 
    name: "SYSTEM", 
    action: `[${getTimestamp()}] ${dealerSeat.name.toUpperCase()} LOCKS IN ${variantNames[vId].toUpperCase()}`, 
    type: 'phase' 
  });
  
  // Dealing logic...
  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; room.phase = PHASES.PRE_FLOP;
  room.players.forEach(p => { if (p) { p.hand = room.deck.splice(0, room.activeVariant.holeCards); p.isFolded = false; p.currentBet = 0; p.actedThisStreet = false; } });
  
  updateRoomStrengths(roomId);
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
};

io.on('connection', (socket) => {
  socket.on('previewVariation', ({ roomId, variantId }) => {
    const room = rooms[roomId]; if (!room) return;
    room.pendingVariant = variantId;
    io.to(roomId).emit('variantPreview', variantId);
  });

  socket.on('adminNuclearReset', () => {
    rooms = {}; 
    profiles = profiles.filter(p => p.role === 'admin');
    io.emit('lobbyUpdate', []);
    io.emit('profilesUpdate', profiles);
    console.log("TRIPLE PURGE: SERVER RAM WIPED");
  });

  // ... (Remainder of Socket.io logic preserved) ...
  socket.on('adminCreateRoom', (data) => { rooms[data.id] = { ...data, players: Array(TOTAL_SEATS).fill(null), phase: PHASES.IDLE, community: [], dealerIdx: 0, lastRaiseIncrement: 2 }; io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); });
  socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
    const room = rooms[roomId]; if (!room) return;
    const emptyIdx = room.players.findIndex(p => p === null);
    if (emptyIdx !== -1) {
      room.players[emptyIdx] = { ...profile, chips: Number(buyIn), seatIdx: emptyIdx, isFolded: false, waitingForNextHand: room.phase !== PHASES.IDLE };
      socket.join(roomId);
      io.to(roomId).emit('roomUpdate', serializeRoom(room));
      if (callback) callback({ status: 'ok' });
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`ARENA ENGINE ${VERSION} ONLINE`));
