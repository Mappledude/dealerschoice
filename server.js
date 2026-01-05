import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v1.3.3-PRO";
const APP_NAME = "Dealers Choice";

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const V_LABEL = { 1: 'Ace(Low)', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };

const TURN_TIME_LIMIT = 15; 

// Master Mapping for Hand Rules
const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2, HILOW: 4, REDSBLACKS: 4 };
const variantNames = {
  HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple",
  MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks"
};

let profiles = []; 
let rooms = {};

const serializeRoom = (room) => {
    if (!room) return null;
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

const rankHand = (cards, isAceLow = false) => {
  if (!cards || cards.length < 5) return { power: 0, name: "Invalid", cards: [] };
  
  const getVal = (v) => {
      if (isAceLow && v === 'A') return 1;
      return VM[v];
  };

  const sorted = [...cards].sort((a, b) => getVal(b.value) - getVal(a.value));
  const ranks = sorted.map(c => getVal(c.value));
  const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
  
  let compArr = [];
  groups.forEach(g => { for (let i = 0; i < g.c; i++) compArr.push(g.r); });
  const vc = groups.map(x => x.c);
  
  const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;

  if (uniqueRanks.length >= 5) {
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
    if (!isStraight && uniqueRanks.includes(isAceLow ? 1 : 14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
        isStraight = true; straightHigh = 5; 
        compArr = [5, 4, 3, 2, 1]; 
    }
  }

  let score = 0, name = `High Card ${V_LABEL[compArr[0]] || compArr[0]}`;
  if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
  else if (vc[0] === 4) { score = 7; name = `Four of a Kind ${V_LABEL[groups[0].r] || groups[0].r}s`; }
  else if (vc[0] === 3 && vc[1] >= 2) { score = 6; name = `Full House, ${V_LABEL[groups[0].r] || groups[0].r}s over ${V_LABEL[groups[1].r] || groups[1].r}s`; }
  else if (isFlush) { score = 5; name = `Flush, ${V_LABEL[compArr[0]] || compArr[0]} high`; }
  else if (isStraight) { score = 4; name = `Straight, ${V_LABEL[straightHigh] || straightHigh} high`; }
  else if (vc[0] === 3) { score = 3; name = `Three of a Kind ${V_LABEL[groups[0].r] || groups[0].r}s`; }
  else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = `Two Pair, ${V_LABEL[groups[0].r] || groups[0].r}s and ${V_LABEL[groups[1].r] || groups[1].r}s`; }
  else if (vc[0] === 2) { score = 1; name = `Pair of ${V_LABEL[groups[0].r] || groups[0].r}s`; }

  const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
  return { power, name, cards: sorted };
};

const getBestHand = (hole, comm, variantId) => {
  if (!hole || hole.length === 0) return { high: { power: 0, name: "No Hand" }, low: null };
  let bestHigh = { power: -1 };
  let bestLow = null;

  if (variantId === 'OMAHA' || variantId === 'HILOW') {
      // Exactly 2 hole cards + 3 board cards
      const holeCombos = combinations(hole, 2);
      const boardCombos = combinations(comm, 3);
      holeCombos.forEach(h => {
          boardCombos.forEach(b => {
              if (b.length < 3) return;
              const res = rankHand([...h, ...b]);
              if (res.power > bestHigh.power) bestHigh = res;
              if (variantId === 'HILOW') {
                  const uniqueRanks = [...new Set([...h, ...b].map(c => VM[c.value]))].filter(r => r <= 8).sort((x, y) => x - y);
                  if (uniqueRanks.length >= 5) {
                      const lowRanks = uniqueRanks.slice(0, 5);
                      const lowPower = lowRanks.reduce((acc, v, i) => acc + (v * Math.pow(15, i)), 0);
                      if (!bestLow || lowPower < bestLow.power) bestLow = { power: lowPower, name: `Low ${V_LABEL[lowRanks[4]]}-High`, cards: lowRanks };
                  }
              }
          });
      });
  } else if (variantId === 'REDSBLACKS') {
      // Joker Logic: 2R+1B or 2B+1R in subset forms wildcard
      const reds = hole.filter(c => c.suit === '♥' || c.suit === '♦');
      const blacks = hole.filter(c => c.suit === '♣' || c.suit === '♠');
      const canFormJoker = (reds.length >= 1 && blacks.length >= 1 && (reds.length + blacks.length >= 3));
      
      const boardCombos = combinations(comm, 3);
      if (canFormJoker) {
          boardCombos.forEach(b => {
              hole.forEach(hSideCard => {
                  for (let v of VALUES) {
                      for (let s of SUITS) {
                          const res = rankHand([{value: v, suit: s}, hSideCard, ...b]);
                          if (res.power > bestHigh.power) bestHigh = { ...res, name: `${res.name} (Joker)` };
                      }
                  }
              });
          });
      } else {
          // Natural: 4 cards of same color
          combinations(hole, 2).forEach(h => {
              boardCombos.forEach(b => {
                  const res = rankHand([...h, ...b]);
                  if (res.power > bestHigh.power) bestHigh = res;
              });
          });
      }
  } else if (variantId === 'MUFLIS') {
      // Weakest hand power wins
      combinations([...hole, ...comm], 5).forEach(c => {
          const res = rankHand(c, true); 
          if (bestHigh.power === -1 || res.power < bestHigh.power) bestHigh = res;
      });
  } else {
      combinations([...hole, ...comm], 5).forEach(c => {
          const res = rankHand(c);
          if (res.power > bestHigh.power) bestHigh = res;
      });
  }
  return { high: bestHigh, low: bestLow };
};

const updateRoomStrengths = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const variantId = room.activeVariant?.id || 'HOLDEM';
    room.players.forEach(p => {
        if (p && p.hand && !p.isFolded) {
            const evaluation = getBestHand(p.hand, room.community, variantId);
            p.strength = evaluation.high.name;
            p.strengthPower = evaluation.high.power;
            const rawProb = (p.strengthPower / (8 * Math.pow(15, 7))) * 100;
            p.winProbability = variantId === 'MUFLIS' ? Math.max(5, 100 - rawProb) : Math.min(99, Math.max(5, rawProb));
        }
    });
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    room.activeIdx = -1;
    room.gameInProgress = false;
    const active = room.players.filter(p => p && !p.isFolded);
    const variantId = room.activeVariant?.id || 'HOLDEM';
    const totalPot = Number(room.potData[0].amount);
    room.showdownWinners = [];

    const evals = active.map(p => ({ player: p, res: getBestHand(p.hand, room.community, variantId) }));

    if (variantId === 'HILOW') {
        const highSorted = [...evals].sort((a, b) => b.res.high.power - a.res.high.power);
        const lowSorted = evals.filter(e => e.res.low).sort((a, b) => a.res.low.power - b.res.low.power);
        if (lowSorted.length > 0) {
            const half = Math.floor(totalPot / 2);
            highSorted[0].player.chips += half;
            lowSorted[0].player.chips += (totalPot - half);
            room.showdownWinners.push({ name: highSorted[0].player.name, rank: `HIGH: ${highSorted[0].res.high.name}`, hand: highSorted[0].res.high.cards, amount: half });
            room.showdownWinners.push({ name: lowSorted[0].player.name, rank: `LOW: ${lowSorted[0].res.low.name}`, hand: lowSorted[0].player.hand, amount: (totalPot - half) });
        } else {
            evals.sort((a, b) => b.res.high.power - a.res.high.power)[0].player.chips += totalPot;
            room.showdownWinners.push({ name: evals[0].player.name, rank: evals[0].res.high.name, hand: evals[0].res.high.cards, amount: totalPot });
        }
    } else if (variantId === 'MUFLIS') {
        evals.sort((a, b) => a.res.high.power - b.res.high.power);
        evals[0].player.chips += totalPot;
        room.showdownWinners.push({ name: evals[0].player.name, rank: `MUFLIS: ${evals[0].res.high.name}`, hand: evals[0].res.high.cards, amount: totalPot });
    } else {
        evals.sort((a, b) => b.res.high.power - a.res.high.power);
        evals[0].player.chips += totalPot;
        room.showdownWinners.push({ name: evals[0].player.name, rank: evals[0].res.high.name, hand: evals[0].res.high.cards, amount: totalPot });
    }

    room.phase = PHASES.SHOWDOWN;
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    room.showdownWinners.forEach(w => io.to(roomId).emit('log', { name: w.name, action: `WON $${w.amount.toFixed(2)} WITH ${w.rank.toUpperCase()}`, type: 'win' }));

    setTimeout(() => {
        const seated = room.players.map((p, i) => (p && Number(p.chips) > 0.50) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) {
            const currentDealerIndexInSeated = seated.indexOf(room.dealerIdx);
            room.dealerIdx = seated[(currentDealerIndexInSeated + 1) % seated.length];
            runIgnition(roomId);
        } else {
            room.phase = PHASES.IDLE;
            io.to(roomId).emit('roomUpdate', serializeRoom(room));
        }
    }, 6000);
};

const runIgnition = (roomId) => {
  const room = rooms[roomId];
  if (!room || room.gameInProgress) return;
  if (room.ignitionTimer) clearTimeout(room.ignitionTimer);
  room.ignitionTimer = null;

  const seated = room.players.map((p, i) => (p && Number(p.chips) > 0.50) ? i : null).filter(x => x !== null);
  if (seated.length < 2) { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', serializeRoom(room)); return; }

  room.gameInProgress = true;
  if (room.dealerIdx === undefined || !room.players[room.dealerIdx]) room.dealerIdx = seated[0];
  const dealerSeat = room.players[room.dealerIdx];
  
  // MASTER DESIGN: Bot Dealer picks random variant
  if (dealerSeat.isBot) {
      const variantKeys = Object.keys(variantNames);
      dealerSeat.pendingVariant = variantKeys[Math.floor(Math.random() * variantKeys.length)];
  }

  // FORCE LOCK VARIANT
  const variantId = dealerSeat.pendingVariant || 'HOLDEM';
  room.activeVariant = { id: variantId, name: variantNames[variantId], holeCards: holeCardsMap[variantId] };
  
  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; 
  room.potData = [{ amount: 0 }]; 
  room.highestBet = Number(room.bb); 
  room.phase = PHASES.PRE_FLOP;
  
  room.players.forEach(p => { 
      if (p) { 
          p.hand = room.deck.splice(0, room.activeVariant.holeCards); 
          p.currentBet = 0; p.isFolded = false; p.isWinner = false; 
          p.lastAction = null; p.actedThisStreet = false; p.winProbability = 0; 
      } 
  });
  
  const sbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
  const bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
  room.players[sbIdx].chips -= Number(room.sb); room.players[sbIdx].currentBet = Number(room.sb);
  room.players[bbIdx].chips -= Number(room.bb); room.players[bbIdx].currentBet = Number(room.bb);
  
  io.to(roomId).emit('log', { name: "SYSTEM", action: `${dealerSeat.name.toUpperCase()} IS DEALING ${room.activeVariant.name.toUpperCase()} (${room.activeVariant.holeCards} CARDS)`, type: 'phase' });
  io.to(roomId).emit('log', { name: room.players[sbIdx].name, action: `POSTED SB $${room.sb}`, type: 'bet' });
  io.to(roomId).emit('log', { name: room.players[bbIdx].name, action: `POSTED BB $${room.bb}`, type: 'bet' });
  
  updateRoomStrengths(roomId);
  room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
  startTurnTimer(roomId);
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
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
      io.to(roomId).emit('log', { name: player.name, action: `FOLDED`, type: 'fold' });
  } 
  else if (type === 'CALL') {
    const diff = Math.max(0, Number(room.highestBet) - Number(player.currentBet));
    const actualCall = Math.min(diff, Number(player.chips));
    player.chips -= actualCall; player.currentBet += actualCall;
    player.lastAction = actualCall > 0 ? "CALL" : "CHECK";
    io.to(roomId).emit('log', { name: player.name, action: actualCall > 0 ? `CALLED $${actualCall.toFixed(2)}` : `CHECKED`, type: 'bet' });
  } else if (type === 'RAISE') {
    const raiseVal = Math.max(Number(amount), Number(room.highestBet) + Number(room.bb));
    const cappedRaise = Math.min(raiseVal, Number(player.chips) + Number(player.currentBet));
    const diff = cappedRaise - Number(player.currentBet);
    player.chips -= diff; player.currentBet = cappedRaise;
    room.highestBet = cappedRaise; player.lastAction = "RAISE";
    room.players.forEach(p => { if (p && p.uid !== player.uid) p.actedThisStreet = false; });
    io.to(roomId).emit('log', { name: player.name, action: `RAISED TO $${cappedRaise.toFixed(2)}`, type: 'bet' });
  }

  updateRoomStrengths(roomId);
  const activePlayers = room.players.filter(p => p && !p.isFolded);
  if (activePlayers.length <= 1 || (activePlayers.every(p => Number(p.chips) < 0.01 || (p.actedThisStreet && Number(p.currentBet) === Number(room.highestBet))))) {
      room.activeIdx = -1; io.to(roomId).emit('roomUpdate', serializeRoom(room));
      setTimeout(() => nextPhase(roomId), 800);
  } else {
    const seated = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    room.activeIdx = seated[(seated.indexOf(room.activeIdx) + 1) % seated.length];
    if (room.players[room.activeIdx] && Number(room.players[room.activeIdx].chips) < 0.01) performAction(roomId, 'CALL', 0);
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

    if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = room.deck.splice(0, 3); }
    else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(...room.deck.splice(0, 1)); }
    else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(...room.deck.splice(0, 1)); }
    else { processShowdown(roomId); return; }

    io.to(roomId).emit('log', { name: "SYSTEM", action: `${room.phase} DEALT - POT $${room.potData[0].amount.toFixed(2)}`, type: 'phase' });
    updateRoomStrengths(roomId);
    const seated = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    room.activeIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
    if (room.players[room.activeIdx] && Number(room.players[room.activeIdx].chips) < 0.01) performAction(roomId, 'CALL', 0);
    else { startTurnTimer(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room)); }
};

const startTurnTimer = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.timer) clearInterval(room.timer);
    const activePlayer = room.players[room.activeIdx];
    if (activePlayer && activePlayer.isBot && room.activeIdx !== -1) {
        setTimeout(() => {
            const r = rooms[roomId];
            if (!r || r.activeIdx === -1) return;
            const p = r.players[r.activeIdx];
            if (p && p.uid === activePlayer.uid) {
                const diff = Number(r.highestBet) - Number(p.currentBet || 0);
                if (diff === 0) performAction(roomId, 'CALL', 0);
                else { Math.random() < 0.7 ? performAction(roomId, 'CALL', 0) : performAction(roomId, 'FOLD', 0); }
            }
        }, 1500 + Math.random() * 2000);
    }
    room.timeRemaining = TURN_TIME_LIMIT;
    room.timer = setInterval(() => {
        room.timeRemaining--;
        if (room.timeRemaining <= 0) {
            clearInterval(room.timer);
            const p = room.players[room.activeIdx];
            if (p) performAction(roomId, (Number(room.highestBet) - Number(p.currentBet || 0)) > 0 ? 'FOLD' : 'CALL', 0);
        } else { io.to(roomId).emit('roomUpdate', serializeRoom(room)); }
    }, 1000);
};

const cashOutPlayer = (uid) => {
    Object.values(rooms).forEach(room => {
        const idx = room.players.findIndex(p => p && p.uid === uid);
        if (idx !== -1) {
            const p = room.players[idx];
            const prof = profiles.find(x => x.uid === uid);
            if (prof) prof.chips += (Number(p.chips) + Number(p.currentBet || 0));
            room.players[idx] = null;
            io.to(room.id).emit('log', { name: p.name, action: `LEFT ARENA`, type: 'phase' });
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
    
    // Server-side check for double-joining
    if (room.players.some(p => p && p.uid === profile.uid)) return callback({ status: 'error' });

    let globalProfile = profiles.find(p => p.uid === profile.uid || p.name === profile.name);
    if (!globalProfile) { globalProfile = { ...profile, chips: 100 }; profiles.push(globalProfile); }
    if (globalProfile.chips < Number(buyIn)) return callback({ status: 'error' });
    globalProfile.chips -= Number(buyIn);
    const emptyIdx = room.players.findIndex(p => p === null);
    if (emptyIdx === -1) return callback({ status: 'error' });
    
    room.players[emptyIdx] = { ...profile, chips: Number(buyIn), seatIdx: emptyIdx, currentBet: 0, isFolded: false, pendingVariant: globalProfile.pendingVariant || profile.pendingVariant || 'HOLDEM' };
    socket.join(roomId);
    
    io.to(roomId).emit('log', { name: profile.name, action: 'JOINED ARENA', type: 'phase' });
    
    callback({ status: 'ok' });
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    io.emit('profilesUpdate', profiles);
    if (room.phase === PHASES.IDLE && room.players.filter(Boolean).length >= 2 && !room.ignitionTimer) {
        room.ignitionTimer = setTimeout(() => runIgnition(roomId), 3000);
    }
  });

  socket.on('adminAddBot', ({ roomId }) => {
    const room = rooms[roomId]; if (!room) return;
    const emptyIdx = room.players.findIndex(p => p === null); if (emptyIdx === -1) return;
    const botId = Math.random().toString(36).slice(2, 7);
    
    // Strict Bot Stake Fix
    const botBuyIn = room.maxBuy || 10;
    
    room.players[emptyIdx] = { uid: `bot_${botId}`, name: `BOT_${botId.toUpperCase()}`, isBot: true, chips: Number(botBuyIn), seatIdx: emptyIdx, currentBet: 0, isFolded: false, pendingVariant: 'HOLDEM' };
    io.to(roomId).emit('log', { name: "SYSTEM", action: `BOT_${botId.toUpperCase()} JOINED ($${botBuyIn})`, type: 'phase' });
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    if (room.phase === PHASES.IDLE && room.players.filter(Boolean).length >= 2 && !room.ignitionTimer) {
        room.ignitionTimer = setTimeout(() => runIgnition(roomId), 3000);
    }
  });

  socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
    const p = profiles.find(x => x.uid === uid); if (p) p.pendingVariant = pendingVariant;
    Object.values(rooms).forEach(room => {
        const player = room.players.find(pl => pl && pl.uid === uid);
        if (player) { 
            player.pendingVariant = pendingVariant; 
            io.to(room.id).emit('log', { name: player.name, action: `CHOSE ${variantNames[pendingVariant].toUpperCase()} FOR DEAL`, type: 'variant' });
            io.to(room.id).emit('roomUpdate', serializeRoom(room)); 
        }
    });
  });

  socket.on('playerAction', ({ roomId, type, amount }) => performAction(roomId, type, amount));
  socket.on('leaveRoom', ({ uid }) => cashOutPlayer(uid));
  socket.on('adminNuclearReset', () => { rooms = {}; profiles = profiles.filter(p => p.role === 'admin'); io.emit('lobbyUpdate', []); io.emit('profilesUpdate', profiles); io.emit('roomUpdate', null); });
  socket.on('adminCreatePlayer', (p) => { profiles.push({ ...p, chips: Number(p.chips) }); io.emit('profilesUpdate', profiles); });
  socket.on('adminCreateRoom', (data) => { 
    const defaultData = { sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10 };
    rooms[data.id] = { ...defaultData, ...data, players: Array(10).fill(null), phase: PHASES.IDLE, community: [], potData: [{amount:0}], dealerIdx: 0, timeRemaining: 20, gameInProgress: false }; 
    io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); 
  });
  socket.on('adminEditChips', ({ uid, chips }) => { const p = profiles.find(x => x.uid === uid); if (p) { p.chips = Number(chips); io.emit('profilesUpdate', profiles); } });
  socket.on('adminDeletePlayer', (uid) => { profiles = profiles.filter(p => p.uid !== uid); io.emit('profilesUpdate', profiles); });
  socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`${APP_NAME} ${VERSION} running on port ${PORT}`));
