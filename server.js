import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v1.7.16-PRO";
const APP_NAME = "Dealers Choice";

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const V_LABEL = { 1: 'Ace(Low)', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };

const TURN_TIME_LIMIT = 15; 

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

const rankHand = (cards, isAceLow = false, isLowHand = false) => {
  if (!cards || cards.length < 5) return { power: 0, name: "Pre-flop", cards: [] };
  const getVal = (v) => (isAceLow && v === 'A') ? 1 : VM[v];
  const sorted = [...cards].sort((a, b) => getVal(b.value) - getVal(a.value));
  const ranks = sorted.map(c => getVal(c.value));
  const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
  let compArr = [];
  groups.forEach(g => { for (let i = 0; i < g.c; i++) compArr.push(g.r); });
  const vc = groups.map(x => x.c);
  
  const isFlush = isLowHand ? false : new Set(sorted.map(c => c.suit)).size === 1;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;

  if (!isLowHand && uniqueRanks.length >= 5) {
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
    const wheelRanks = [14, 5, 4, 3, 2];
    if (!isStraight && !isAceLow && uniqueRanks.includes(14) && [5,4,3,2].every(r => uniqueRanks.includes(r))) {
        isStraight = true; straightHigh = 5; compArr = [5, 4, 3, 2, 1]; 
    }
  }

  let score = 0, name = `High Card ${V_LABEL[compArr[0]] || compArr[0]}`;
  if (vc[0] === 5) { score = 9; name = `Five of a Kind ${V_LABEL[groups[0].r]}s`; }
  else if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
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

const getBestHand = (hole, comm, variantId) => {
  if (!hole || hole.length === 0 || !comm || comm.length < 3) return { high: { power: 0, name: "Pre-flop" }, low: null };
  let bestHigh = { power: -1, name: "Pre-flop" };
  let bestLow = null;
  const boardCombos = combinations(comm, 3);
  const holePairs = combinations(hole, 2);

  if (variantId === 'HOLDEM' || variantId === 'PINEAPPLE') {
    combinations([...hole, ...comm], 5).forEach(c => {
        const res = rankHand(c);
        if (res.power > bestHigh.power) bestHigh = res;
    });
  } else if (variantId === 'OMAHA') {
    holePairs.forEach(h => { boardCombos.forEach(b => {
            const res = rankHand([...h, ...b]);
            if (res.power > bestHigh.power) bestHigh = res;
    });});
  } else if (variantId === 'HILOW') {
    holePairs.forEach(h => { boardCombos.forEach(b => {
            const resH = rankHand([...h, ...b], false, false);
            if (resH.power > bestHigh.power) bestHigh = resH;
            const resL = rankHand([...h, ...b], true, true);
            if (!bestLow || resL.power < bestLow.power) { bestLow = { ...resL, name: resL.name.replace('High Card', 'Low') }; }
    });});
  } else if (variantId === 'REDSBLACKS') {
      const reds = hole.filter(c => c.suit === '♥' || c.suit === '♦');
      const blacks = hole.filter(c => c.suit === '♣' || c.suit === '♠');
      let possibleJokerHands = [];
      hole.forEach((fourthCard, idx) => {
          if ((reds.length >= 2 && blacks.length >= 1) || (blacks.length >= 2 && reds.length >= 1)) {
              boardCombos.forEach(b => { for (let v of VALUES) { for (let s of SUITS) {
                          const res = rankHand([{value: v, suit: s}, fourthCard, ...b]);
                          possibleJokerHands.push({...res, name: `${res.name} (JOKER)`});
              }}});
          }
      });
      if (possibleJokerHands.length > 0) {
          possibleJokerHands.sort((a, b) => b.power - a.power);
          if (possibleJokerHands[0].power > bestHigh.power) bestHigh = possibleJokerHands[0];
      } else {
          holePairs.forEach(h => { boardCombos.forEach(b => {
                  const res = rankHand([...h, ...b]);
                  if (res.power > bestHigh.power) bestHigh = { ...res, name: `${res.name} (NATURAL)` };
          });});
      }
  } else if (variantId === 'MUFLIS') {
      combinations([...hole, ...comm], 5).forEach(c => {
          const res = rankHand(c, true); 
          if (bestHigh.power === -1 || res.power < bestHigh.power) bestHigh = res;
      });
  }
  return { high: bestHigh, low: bestLow };
};

const updateRoomStrengths = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const variantId = room.activeVariant?.id || 'HOLDEM';
    const isPreFlop = room.phase === PHASES.PRE_FLOP;
    
    room.players.forEach(p => {
        if (p && p.hand && !p.isFolded && !p.waitingForNextHand) {
            const evaluation = getBestHand(p.hand, room.community, variantId);
            p.strength = evaluation.high.name;
            p.strengthPower = evaluation.high.power;
            
            if (isPreFlop) {
                p.winProbability = 0; p.lowWinProbability = 0;
            } else {
                const maxPower = 9 * Math.pow(15, 7);
                const rawProb = (p.strengthPower / maxPower) * 100;
                p.winProbability = variantId === 'MUFLIS' ? Math.max(5, 100 - rawProb) : Math.min(99, Math.max(5, rawProb));
                
                if (evaluation.low) {
                    p.lowStrength = evaluation.low.name;
                    p.lowStrengthPower = evaluation.low.power;
                    const rawLowProb = 100 - ((p.lowStrengthPower / (Math.pow(15, 6) * 13)) * 100);
                    p.lowWinProbability = Math.min(100, Math.max(5, rawLowProb * 1.5));
                } else { p.lowWinProbability = 0; }
            }
        }
    });
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    room.activeIdx = -1;
    room.gameInProgress = false;
    if (room.timer) clearInterval(room.timer);

    const activePlayers = room.players.filter(p => p !== null && !p.waitingForNextHand);
    const variantId = room.activeVariant?.id || 'HOLDEM';
    room.showdownWinners = [];

    const contributions = activePlayers.map(p => ({ 
        uid: p.uid, amount: p.totalContribution, folded: p.isFolded, name: p.name, player: p
    })).sort((a, b) => a.amount - b.amount);

    let lastLevel = 0;
    const pots = [];
    contributions.forEach((c, idx) => {
        const diff = c.amount - lastLevel;
        if (diff > 0) {
            let segAmount = 0;
            let eligible = [];
            contributions.slice(idx).forEach(other => {
                segAmount += diff;
                if (!other.folded) eligible.push(other.uid);
            });
            if (eligible.length > 0) pots.push({ amount: segAmount, eligible });
            else if (pots.length > 0) pots[pots.length-1].amount += segAmount;
            lastLevel = c.amount;
        }
    });

    const totalUnfolded = activePlayers.filter(p => !p.isFolded).length;

    pots.forEach(pot => {
        const eligiblePlayers = room.players.filter(p => p && pot.eligible.includes(p.uid));
        if (totalUnfolded === 1 && eligiblePlayers.length === 1) {
            const soleWinner = eligiblePlayers[0];
            soleWinner.chips += pot.amount;
            room.showdownWinners.push({ name: soleWinner.name, rank: "!", hand: [], amount: pot.amount });
            return;
        }

        const evals = eligiblePlayers.map(p => ({ player: p, res: getBestHand(p.hand, room.community, variantId) }));

        if (variantId === 'HILOW') {
            const lowHalf = Math.floor((pot.amount * 100) / 2) / 100;
            const highHalf = ((pot.amount * 100) - (lowHalf * 100)) / 100;
            const highSorted = [...evals].sort((a, b) => b.res.high.power - a.res.high.power);
            const winnersH = highSorted.filter(e => e.res.high.power === highSorted[0].res.high.power);
            winnersH.forEach(w => {
                const share = highHalf / winnersH.length; w.player.chips += share;
                room.showdownWinners.push({ name: w.player.name, rank: `HIGH: ${w.res.high.name}`, hand: w.res.high.cards, amount: share });
            });
            const lowSorted = [...evals].sort((a, b) => a.res.low.power - b.res.low.power);
            const winnersL = lowSorted.filter(e => e.res.low.power === lowSorted[0].res.low.power);
            winnersL.forEach(w => {
                const share = lowHalf / winnersL.length; w.player.chips += share;
                room.showdownWinners.push({ name: w.player.name, rank: `LOW: ${w.res.low.name}`, hand: w.res.low.cards, amount: share });
            });
        } else {
            evals.sort((a, b) => variantId === 'MUFLIS' ? (a.res.high.power - b.res.high.power) : (b.res.high.power - a.res.high.power));
            const winners = evals.filter(e => e.res.high.power === evals[0].res.high.power);
            winners.forEach(w => {
                const share = pot.amount / winners.length; w.player.chips += share;
                room.showdownWinners.push({ name: w.player.name, rank: w.res.high.name, hand: w.res.high.cards, amount: share });
            });
        }
    });

    room.phase = PHASES.SHOWDOWN;
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    
    // TIMING SYNC Logic
    const isDefaultWin = room.showdownWinners.length > 0 && room.showdownWinners.every(w => w.rank === "!");
    const finalDelay = isDefaultWin ? 1500 : (variantId === 'HILOW' ? 10000 : 5000);

    setTimeout(() => {
        if (!rooms[roomId]) return; 

        // Bot Management: Rebuy or Boot
        room.players.forEach((p, i) => {
            if (p && p.isBot) {
                if (p.chips <= Number(room.bb)) {
                    const profile = profiles.find(pr => pr.uid === p.uid);
                    if (profile && profile.chips >= room.maxBuy) {
                        profile.chips -= room.maxBuy;
                        p.chips += room.maxBuy;
                        io.to(roomId).emit('log', { name: p.name, action: `AUTO REBUY ($${room.maxBuy})`, type: 'phase' });
                    } else {
                        room.players[i] = null;
                        io.to(roomId).emit('log', { name: p.name, action: `BOOTED (WALLET DEPLETED)`, type: 'phase' });
                    }
                }
            }
            if (p) p.waitingForNextHand = false;
        });

        const seated = room.players.map((p, i) => (p && p.chips > Number(room.bb)) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) {
            const curDealerIdx = seated.indexOf(room.dealerIdx);
            room.dealerIdx = seated[(curDealerIdx + 1) % seated.length];
            runIgnition(roomId);
        } else {
            room.phase = PHASES.IDLE; 
            room.gameInProgress = false;
            room.community = [];
            room.potData = [{amount: 0}];
            io.to(roomId).emit('roomUpdate', serializeRoom(room));
        }
    }, finalDelay + 300);
};

const runIgnition = (roomId) => {
  const room = rooms[roomId];
  if (!room || room.gameInProgress) return;
  if (room.ignitionTimer) clearTimeout(room.ignitionTimer);
  room.ignitionTimer = null;
  
  const seated = room.players.map((p, i) => (p && p.chips > Number(room.bb)) ? i : null).filter(x => x !== null);
  if (seated.length < 2) { 
      room.phase = PHASES.IDLE; 
      room.gameInProgress = false;
      io.to(roomId).emit('roomUpdate', serializeRoom(room)); 
      return; 
  }
  
  room.gameInProgress = true;
  if (room.dealerIdx === undefined || !room.players[room.dealerIdx]) room.dealerIdx = seated[0];
  const dealerSeat = room.players[room.dealerIdx];

  // Logic Fix: Explicitly lookup variant choice
  let variantId = 'HOLDEM';
  if (dealerSeat.isBot) {
      const keys = Object.keys(holeCardsMap);
      variantId = keys[Math.floor(Math.random() * keys.length)];
  } else {
      // Sync from human profile to ensure accuracy
      const prof = profiles.find(p => p.uid === dealerSeat.uid);
      variantId = prof?.pendingVariant || dealerSeat.pendingVariant || 'HOLDEM';
  }

  room.activeVariant = { id: variantId, name: variantNames[variantId], holeCards: holeCardsMap[variantId] };
  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; room.potData = [{ amount: 0 }]; room.highestBet = Number(room.bb); room.phase = PHASES.PRE_FLOP;
  
  room.players.forEach(p => { if (p) { 
      if (seated.includes(p.seatIdx)) {
        p.hand = room.deck.splice(0, room.activeVariant.holeCards); 
        p.currentBet = 0; p.totalContribution = 0; p.isFolded = false; p.isWinner = false; p.lastAction = null; p.actedThisStreet = false;
        p.waitingForNextHand = false;
      } else {
        p.waitingForNextHand = true; p.hand = [];
      }
  } });

  const sbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
  const bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
  
  const sbAmt = Math.min(Number(room.sb), room.players[sbIdx].chips);
  room.players[sbIdx].chips -= sbAmt; room.players[sbIdx].currentBet = sbAmt; room.players[sbIdx].totalContribution = sbAmt;
  
  const bbAmt = Math.min(Number(room.bb), room.players[bbIdx].chips);
  room.players[bbIdx].chips -= bbAmt; room.players[bbIdx].currentBet = bbAmt; room.players[bbIdx].totalContribution = bbAmt;
  
  io.to(roomId).emit('log', { name: "SYSTEM", action: `${dealerSeat.name.toUpperCase()} IS DEALING ${room.activeVariant.name.toUpperCase()}`, type: 'phase' });
  updateRoomStrengths(roomId);
  room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
  startTurnTimer(roomId);
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
};

const removePlayerGlobally = (uid) => {
    Object.values(rooms).forEach(room => {
        const idx = room.players.findIndex(p => p && p.uid === uid);
        if (idx !== -1) {
            const p = room.players[idx];
            const prof = profiles.find(x => x.uid === uid);
            if (prof) prof.chips += (Number(p.chips) + Number(p.currentBet || 0));
            if (room.activeIdx === idx) moveToNextPlayer(room.id);
            room.players[idx] = null;

            // Vacated Table logic
            const humanCount = room.players.filter(pl => pl && !pl.isBot).length;
            if (humanCount === 0) {
                room.players.forEach((seat, sIdx) => { if (seat && seat.isBot) room.players[sIdx] = null; });
                room.phase = PHASES.IDLE;
                room.gameInProgress = false;
                room.community = [];
                room.potData = [{amount: 0}];
                room.activeIdx = -1;
                if (room.timer) clearInterval(room.timer);
                room.ignitionTimer = null;
                io.to(room.id).emit('log', { name: "SYSTEM", action: "ARENA VACATED - BOOTING BOTS", type: "phase" });
            }
            io.to(room.id).emit('roomUpdate', serializeRoom(room));
        }
    });
};

io.on('connection', (socket) => {
  let seatedUid = null;

  socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) }));
  
  socket.on('playerLogin', ({ password }) => {
    const profile = profiles.find(p => p.password === password);
    if (profile) { seatedUid = profile.uid; socket.emit('loginSuccess', profile); }
  });

  socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
    const p = profiles.find(x => x.uid === uid); 
    if (p) {
        p.pendingVariant = pendingVariant;
        // Propagate choice to all active seats immediately
        Object.values(rooms).forEach(room => {
            const player = room.players.find(pl => pl && pl.uid === uid);
            if (player) { player.pendingVariant = pendingVariant; }
        });
    }
  });

  socket.on('adminNuclearReset', () => { rooms = {}; profiles = profiles.filter(p => p.role === 'admin'); io.emit('lobbyUpdate', []); io.emit('profilesUpdate', profiles); io.emit('roomUpdate', null); });
  socket.on('adminCreatePlayer', (p) => { profiles.push({ ...p, chips: Number(p.chips) }); io.emit('profilesUpdate', profiles); });
  
  socket.on('adminUpdatePlayer', ({ uid, chips, password }) => {
    const p = profiles.find(x => x.uid === uid);
    if (p) {
        if (chips !== undefined) p.chips = Number(chips);
        if (password) p.password = password.toLowerCase();
        Object.values(rooms).forEach(room => {
            const player = room.players.find(pl => pl && pl.uid === uid);
            if (player && chips !== undefined) { player.chips = Number(chips); io.to(room.id).emit('roomUpdate', serializeRoom(room)); }
        });
        io.emit('profilesUpdate', profiles);
    }
  });

  socket.on('adminDeletePlayer', (uid) => { removePlayerGlobally(uid); profiles = profiles.filter(p => p.uid !== uid); io.emit('profilesUpdate', profiles); });
  socket.on('adminDeleteRoom', (roomId) => { if (rooms[roomId]) { delete rooms[roomId]; io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); } });

  socket.on('adminCreateRoom', (data) => { 
    const defaultData = { sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10 };
    rooms[data.id] = { ...defaultData, ...data, players: Array(10).fill(null), phase: PHASES.IDLE, community: [], potData: [{amount:0}], dealerIdx: 0, timeRemaining: 20, gameInProgress: false }; 
    io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); 
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`${APP_NAME} ${VERSION} running on port ${PORT}`));
