import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v1.1.7-PRO";
const APP_NAME = "Dealers Choice";

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const V_LABEL = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };

const TURN_TIME_LIMIT = 15; 

const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2, HILOW: 4, REDSBLACKS: 4 };
const variantNames = {
  HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple",
  MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks"
};

let profiles = []; 
let rooms = {};

const serializeRoom = (room) => {
    const { timer, deck, ignitionTimer, ...rest } = room;
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

/**
 * Standard 5-card Hand Ranking
 * Evaluates the best rank for a given 5-card set.
 */
const rankHand = (cards) => {
  if (!cards || cards.length < 2) return { power: 0, name: "High Card", cards: [] };
  const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
  const ranks = sorted.map(c => VM[c.value]);
  const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
  
  let compArr = [];
  groups.forEach(g => { for (let i = 0; i < g.c; i++) compArr.push(g.r); });
  const vc = groups.map(x => x.c);
  
  const isFlush = cards.length >= 5 && new Set(sorted.map(c => c.suit)).size === 1;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;

  if (uniqueRanks.length >= 5) {
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
    if (!isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
        isStraight = true; straightHigh = 5; compArr = [5, 4, 3, 2, 1]; 
    }
  }

  let score = 0, name = `High Card ${V_LABEL[compArr[0]]}`;
  if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
  else if (vc[0] === 4) { score = 7; name = `Four of a Kind ${V_LABEL[groups[0].r]}s`; }
  else if (vc[0] === 3 && vc[1] >= 2) { score = 6; name = `Full House, ${V_LABEL[groups[0].r]}s full of ${V_LABEL[groups[1].r]}s`; }
  else if (isFlush) { score = 5; name = `Flush, ${V_LABEL[compArr[0]]} high`; }
  else if (isStraight) { score = 4; name = `Straight, ${V_LABEL[straightHigh]} high`; }
  else if (vc[0] === 3) { score = 3; name = `Three of a Kind ${V_LABEL[groups[0].r]}s`; }
  else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = `Two Pair, ${V_LABEL[groups[0].r]}s and ${V_LABEL[groups[1].r]}s`; }
  else if (vc[0] === 2) { score = 1; name = `Pair of ${V_LABEL[groups[0].r]}s`; }

  const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
  return { power, name, cards: sorted.slice(0, 5) };
};

/**
 * Wild Card Solver
 * Iterates all 52 possibilities for the Joker to find the highest rank from a pool.
 */
const getBestHandWithWild = (naturalPool) => {
    let best = { power: -1, name: "No Hand", cards: [] };
    VALUES.forEach(v => {
        SUITS.forEach(s => {
            const combined = [...naturalPool, { value: v, suit: s }];
            combinations(combined, Math.min(combined.length, 5)).forEach(c => {
                const result = rankHand(c);
                if (result.power > best.power) best = result;
            });
        });
    });
    return { ...best, name: `${best.name} (Joker)` };
};

const getBestHand = (hole, comm, variantId) => {
  if (!hole || hole.length === 0) return { high: { power: 0, name: "No Hand" }, low: null };
  
  if (variantId === 'REDSBLACKS' && hole.length === 4) {
    const redCount = hole.filter(c => c.suit === '♥' || c.suit === '♦').length;
    const blackCount = hole.filter(c => c.suit === '♣' || c.suit === '♠').length;
    const hasJoker = (redCount > 0 && blackCount > 0 && redCount < 4 && blackCount < 4);
    let best = { power: -1, name: "No Hand", cards: [] };

    if (hasJoker) {
        // Joker Rules: 1 Hole Card + 1 Wild Wild + 5 Board Cards
        hole.forEach(hCard => {
            const pool = [hCard, ...comm];
            const result = getBestHandWithWild(pool);
            if (result.power > best.power) best = result;
        });
        // Check if natural 2-hole cards is better
        combinations(hole, 2).forEach(hCombo => {
            const pool = [...hCombo, ...comm];
            combinations(pool, Math.min(pool.length, 5)).forEach(c => {
                const result = rankHand(c);
                if (result.power > best.power) best = result;
            });
        });
    } else {
        // Natural Hand: 2 Hole + Board
        combinations(hole, 2).forEach(hCombo => {
            const pool = [...hCombo, ...comm];
            combinations(pool, Math.min(pool.length, 5)).forEach(c => {
                const result = rankHand(c);
                if (result.power > best.power) best = result;
            });
        });
    }
    return { high: best, low: null };
  }

  // Default Logic
  let bestHigh = null;
  const useHoleCount = (variantId === 'OMAHA' || variantId === 'HILOW') ? 2 : (variantId === 'PINEAPPLE' ? 2 : hole.length);
  combinations(hole, Math.min(hole.length, useHoleCount)).forEach(h => {
      const combined = [...h, ...comm];
      combinations(combined, Math.min(combined.length, 5)).forEach(c => {
          const high = rankHand(c);
          if (!bestHigh || high.power > bestHigh.power) bestHigh = high;
      });
  });
  return { high: bestHigh, low: null };
};

const updateRoomStrengths = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const variantId = room.activeVariant?.id || 'HOLDEM';

    const allCards = VALUES.flatMap(v => SUITS.map(s => ({ value: v, suit: s })));
    const remainingDeck = allCards.filter(card => 
        !room.community.some(c => c.value === card.value && c.suit === card.suit) &&
        !room.players.some(p => p && p.hand && p.hand.some(hc => hc.value === card.value && hc.suit === card.suit))
    );

    room.players.forEach(p => {
        if (p && p.hand && !p.isFolded) {
            const evaluation = getBestHand(p.hand, room.community, variantId);
            p.strength = evaluation.high.name;
            p.strengthPower = evaluation.high.power;

            if ([PHASES.FLOP, PHASES.TURN, PHASES.RIVER].includes(room.phase)) {
                if (room.phase === PHASES.RIVER) {
                    let isNutHand = true;
                    const possibleOpps = combinations(remainingDeck.slice(0, 15), 2);
                    for (let combo of possibleOpps) {
                        const oppBest = getBestHand(combo, room.community, variantId);
                        if (oppBest.high.power > p.strengthPower) { isNutHand = false; break; }
                    }
                    p.winProbability = isNutHand ? 100 : Math.min(99, Math.max(10, (p.strengthPower / (9 * Math.pow(15, 7))) * 100));
                } else {
                    p.winProbability = Math.min(95, Math.max(5, (p.strengthPower / (9 * Math.pow(15, 7))) * 90));
                }
            }
        }
    });
};

const performAction = (roomId, type, amount) => {
  const room = rooms[roomId];
  if (!room || room.activeIdx === -1) return;
  if (room.timer) clearInterval(room.timer);
  const player = room.players[room.activeIdx];
  if (!player) return;

  player.actedThisStreet = true;
  if (type === 'FOLD') { 
    player.isFolded = true; player.lastAction = "FOLD"; 
  } else if (type === 'CALL') {
    const diff = Math.max(0, Number(room.highestBet) - Number(player.currentBet));
    const actualCall = Math.min(diff, Number(player.chips));
    player.chips -= actualCall; player.currentBet += actualCall;
    player.lastAction = actualCall > 0 ? "CALL" : "CHECK";
  } else if (type === 'RAISE') {
    const minRaise = Number(room.highestBet) + Number(room.bb);
    const raiseVal = Math.max(Number(amount), minRaise);
    const cappedRaise = Math.min(raiseVal, Number(player.chips) + Number(player.currentBet));
    const diff = cappedRaise - Number(player.currentBet);
    player.chips -= diff; player.currentBet = cappedRaise;
    room.highestBet = cappedRaise; player.lastAction = "RAISE";
    room.players.forEach(p => { if (p && p.uid !== player.uid) p.actedThisStreet = false; });
  }

  updateRoomStrengths(roomId);

  const activePlayers = room.players.filter(p => p && !p.isFolded);
  const allMatched = activePlayers.every(p => Number(p.chips) === 0 || Number(p.currentBet) === Number(room.highestBet));
  const allActed = activePlayers.every(p => Number(p.chips) === 0 || p.actedThisStreet);
  
  if (activePlayers.length <= 1 || (allMatched && allActed)) {
      room.activeIdx = -1; io.to(roomId).emit('roomUpdate', serializeRoom(room));
      setTimeout(() => nextPhase(roomId), 800);
  } else {
    const seated = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const currentPos = seated.indexOf(room.activeIdx);
    room.activeIdx = seated[(currentPos + 1) % seated.length];
    const nextPlayer = room.players[room.activeIdx];
    if (nextPlayer && Number(nextPlayer.chips) === 0 && !nextPlayer.isFolded) performAction(roomId, 'CALL', 0);
    else { startTurnTimer(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room)); }
  }
};

const nextPhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const roundTotal = room.players.reduce((acc, p) => acc + (Number(p?.currentBet) || 0), 0);
    room.potData[0].amount += roundTotal;
    room.players.forEach(p => { if (p) { p.currentBet = 0; p.lastAction = null; p.actedThisStreet = false; } });
    room.highestBet = 0;

    const activePlayers = room.players.filter(p => p && !p.isFolded);
    if (activePlayers.length <= 1) { processShowdown(roomId); return; }

    let newCards = [];
    if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; newCards = room.deck.splice(0, 3); room.community = [...newCards]; }
    else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; newCards = room.deck.splice(0, 1); room.community.push(...newCards); }
    else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; newCards = room.deck.splice(0, 1); room.community.push(...newCards); }
    else { processShowdown(roomId); return; }

    io.to(roomId).emit('log', { name: "System", action: `${room.phase} DEALT`, type: 'phase', cards: newCards });
    updateRoomStrengths(roomId);
    
    const seated = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const dealerPosIdxInSeated = seated.indexOf(room.dealerIdx);
    room.activeIdx = seated[(dealerPosIdxInSeated + 1) % seated.length];
    const firstActer = room.players[room.activeIdx];
    if (firstActer && Number(firstActer.chips) === 0) performAction(roomId, 'CALL', 0);
    else { startTurnTimer(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room)); }
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    room.activeIdx = -1;
    room.gameInProgress = false;
    const active = room.players.filter(p => p && !p.isFolded);
    const variantId = room.activeVariant?.id || 'HOLDEM';
    const evals = active.map(p => ({ i: room.players.indexOf(p), res: getBestHand(p.hand, room.community, variantId) }));
    room.showdownWinners = [];
    const totalPot = Number(room.potData[0].amount);

    if (evals.length > 0) {
        const sortedHigh = [...evals].sort((a, b) => b.res.high.power - a.res.high.power);
        const highWinners = sortedHigh.filter(e => e.res.high.power === sortedHigh[0].res.high.power);
        const highAward = Math.floor(totalPot / highWinners.length);
        highWinners.forEach(w => {
            const p = room.players[w.i];
            p.chips += highAward; p.isWinner = true;
            room.showdownWinners.push({ name: p.name, rank: w.res.high.name, hand: w.res.high.cards, amount: highAward });
            io.to(roomId).emit('log', { 
                name: p.name, 
                action: `WON $${highAward.toLocaleString()} WITH ${w.res.high.name.toUpperCase()}`, 
                type: 'win' 
            });
        });
    }
    room.phase = PHASES.SHOWDOWN;
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    setTimeout(() => {
        const seated = room.players.map((p, i) => (p && Number(p.chips) > 0) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) {
            const nextDIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
            room.dealerIdx = nextDIdx; runIgnition(roomId);
        } else {
            room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', serializeRoom(room));
        }
    }, 6000); 
};

const runIgnition = (roomId) => {
  const room = rooms[roomId];
  if (!room || room.gameInProgress) return;
  if (room.ignitionTimer) clearTimeout(room.ignitionTimer);
  room.ignitionTimer = null;
  const seated = room.players.map((p, i) => (p && Number(p.chips) > 0) ? i : null).filter(x => x !== null);
  if (seated.length < 2) { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', serializeRoom(room)); return; }
  room.gameInProgress = true;
  if (room.dealerIdx === undefined || !room.players[room.dealerIdx]) room.dealerIdx = seated[0];
  const dealerIdx = room.dealerIdx;
  const dealer = room.players[dealerIdx];
  const variantId = dealer.pendingVariant || 'HOLDEM';
  room.activeVariant = { id: variantId, name: variantNames[variantId], holeCards: holeCardsMap[variantId] };
  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; room.potData = [{ amount: 0 }]; room.highestBet = Number(room.bb); room.phase = PHASES.PRE_FLOP;
  room.players.forEach(p => { if (p) { p.hand = room.deck.splice(0, room.activeVariant.holeCards); p.currentBet = 0; p.isFolded = false; p.isWinner = false; p.lastAction = null; p.actedThisStreet = false; p.winProbability = 0; } });
  const sbIdx = seated[(seated.indexOf(dealerIdx) + 1) % seated.length];
  const bbIdx = seated[(seated.indexOf(dealerIdx) + 2) % seated.length];
  room.players[sbIdx].chips -= Number(room.sb); room.players[sbIdx].currentBet = Number(room.sb);
  room.players[bbIdx].chips -= Number(room.bb); room.players[bbIdx].currentBet = Number(room.bb);
  updateRoomStrengths(roomId);
  room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
  startTurnTimer(roomId);
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
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
            if (player) {
                const diff = Number(room.highestBet) - Number(player.currentBet || 0);
                performAction(roomId, diff > 0 ? 'FOLD' : 'CALL', 0);
            }
        } else {
            io.to(roomId).emit('roomUpdate', serializeRoom(room));
        }
    }, 1000);
};

const cashOutPlayer = (uid) => {
    Object.values(rooms).forEach(room => {
        const idx = room.players.findIndex(p => p && (p.uid === uid));
        if (idx !== -1) {
            const p = room.players[idx];
            const prof = profiles.find(x => x.uid === uid || x.name === p.name);
            if (prof) prof.chips += (Number(p.chips) + Number(p.currentBet || 0));
            room.players[idx] = null;
            io.to(room.id).emit('roomUpdate', serializeRoom(room));
        }
    });
    io.emit('profilesUpdate', profiles);
};

io.on('connection', (socket) => {
  socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) }));
  socket.on('playerLogin', ({ password }) => {
    const profile = profiles.find(p => p.password === password);
    if (profile) socket.emit('loginSuccess', profile);
  });
  socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
    const room = rooms[roomId]; if (!room) return callback({ status: 'error' });
    let globalProfile = profiles.find(p => p.uid === profile.uid || p.name === profile.name);
    if (!globalProfile) { globalProfile = { ...profile, chips: 10000 }; profiles.push(globalProfile); }
    if (globalProfile.chips < Number(buyIn)) return callback({ status: 'error' });
    globalProfile.chips -= Number(buyIn);
    const emptyIdx = room.players.findIndex(p => p === null);
    if (emptyIdx === -1) return callback({ status: 'error' });
    room.players[emptyIdx] = { ...profile, chips: Number(buyIn), seatIdx: emptyIdx, currentBet: 0, isFolded: false, pendingVariant: profile.pendingVariant || 'HOLDEM' };
    socket.join(roomId);
    callback({ status: 'ok' });
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    io.emit('profilesUpdate', profiles);
    if (room.phase === PHASES.IDLE && room.players.filter(Boolean).length >= 2) {
        if (!room.ignitionTimer) room.ignitionTimer = setTimeout(() => runIgnition(roomId), 3000);
    }
  });
  socket.on('playerAction', ({ roomId, type, amount }) => performAction(roomId, type, amount));
  socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
    const p = profiles.find(x => x.uid === uid); if (p) p.pendingVariant = pendingVariant;
    Object.values(rooms).forEach(room => {
        const player = room.players.find(pl => pl && pl.uid === uid);
        if (player) { player.pendingVariant = pendingVariant; io.to(room.id).emit('roomUpdate', serializeRoom(room)); }
    });
  });
  socket.on('leaveRoom', ({ uid }) => cashOutPlayer(uid));
  socket.on('adminNuclearReset', () => { rooms = {}; profiles = profiles.filter(p => p.role === 'admin'); io.emit('lobbyUpdate', []); io.emit('profilesUpdate', profiles); io.emit('roomUpdate', null); });
  socket.on('adminCreatePlayer', (p) => { profiles.push({ ...p, chips: Number(p.chips) }); io.emit('profilesUpdate', profiles); });
  socket.on('adminCreateRoom', (data) => { 
      rooms[data.id] = { ...data, players: Array(10).fill(null), phase: PHASES.IDLE, community: [], potData: [{amount:0}], dealerIdx: 0, timeRemaining: 20, gameInProgress: false }; 
      io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); 
  });
  socket.on('adminEditChips', ({ uid, chips }) => {
      const p = profiles.find(x => x.uid === uid);
      if (p) { p.chips = Number(chips); io.emit('profilesUpdate', profiles); }
  });
  socket.on('adminDeletePlayer', (uid) => { profiles = profiles.filter(p => p.uid !== uid); io.emit('profilesUpdate', profiles); });
  socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`${APP_NAME} ${VERSION} running on port ${PORT}`));
