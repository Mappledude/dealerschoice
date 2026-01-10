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

const VERSION = "v1.0.79";
const APP_NAME = "Dealers Choice";
const TOTAL_SEATS = 10; 

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const V_LABEL = { 1: 'Ace(Low)', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };

const TURN_TIME_LIMIT = 24; 
const SECURE_SEAT_TIME = 3 * 60 * 1000; 

const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2, HILOW: 4, REDSBLACKS: 4 };
const variantNames = {
  HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple",
  MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks"
};

const BOT_NAMES = ["Baabu Shona", "Laddoo", "Chikku", "Guddu", "Kalia", "Chinky", "Bunty", "Babli", "Chhotu", "Motu", "Jadiya", "Piddi"];

const BOT_PERSONALITIES = {
    "Baabu Shona": "CALCULATED", "Chinky": "CALCULATED", "Motu": "CALCULATED",
    "Kalia": "AGGRESSIVE", "Chikku": "AGGRESSIVE", "Bunty": "AGGRESSIVE",
    "Jadiya": "TIGHT", "Guddu": "TIGHT", "Babli": "TIGHT",
    "Laddoo": "PASSIVE", "Chhotu": "PASSIVE", "Piddi": "PASSIVE"
};

// --- SEEDED DATA ---
const SEEDED_PLAYERS = [
  { name: 'Vivek', password: 'sablani', uid: 'u_vivek', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Aroosa', password: 'saeed', uid: 'u_aroosa', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Ram', password: 'shahani', uid: 'u_ram', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Brij', password: 'lulla', uid: 'u_brij', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Thashaan', password: '222', uid: 'u_thashaan', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Nish', password: 'sevkani', uid: 'u_nish', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Marlon', password: 'king', uid: 'u_marlon', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Tarun', password: 'shroff', uid: 'u_tarun', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'P1', password: 'p1', uid: 'u_p1', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' }
];

const SEEDED_ROOMS_DATA = [
  { id: 'room_q1', name: 'Q1', sb: 1, bb: 2, minBuy: 50, maxBuy: 100 },
  { id: 'room_10', name: '$10 Arena', sb: 0.25, bb: 0.5, minBuy: 5, maxBuy: 10 },
  { id: 'room_100', name: '$100 Arena', sb: 1, bb: 2, minBuy: 50, maxBuy: 100 },
  { id: 'room_500', name: '$500 Arena', sb: 2, bb: 5, minBuy: 200, maxBuy: 500 }
];

let profiles = [...SEEDED_PLAYERS]; 
let rooms = {};

// Initialize seeded rooms
SEEDED_ROOMS_DATA.forEach(data => {
  rooms[data.id] = { 
    ...data, 
    players: Array(TOTAL_SEATS).fill(null), 
    phase: PHASES.IDLE, 
    community: [], 
    potData: [{amount:0}], 
    dealerIdx: 0, 
    timeRemaining: 20, 
    gameInProgress: false, 
    lastRaiseIncrement: data.bb 
  };
});

let disconnectTimeouts = {}; 

const serializeRoom = (room) => {
    if (!room) return null;
    const { timer, deck, ignitionTimer, ...rest } = room;
    return { ...rest, minRaiseAmount: room.highestBet + room.lastRaiseIncrement };
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
  if (!cards || cards.length < 5) return { power: 0, name: "Pre-flop", cards: [] };
  const getVal = (v) => (isAceLow && v === 'A') ? 1 : VM[v];
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
            const resH = rankHand([...h, ...b], false);
            if (resH.power > bestHigh.power) bestHigh = resH;
            const resL = rankHand([...h, ...b], true);
            if (!bestLow || resL.power < bestLow.power) { bestLow = { ...resL, name: resL.name.replace('High Card', 'Low') }; }
    });});
  } else if (variantId === 'REDSBLACKS') {
      const reds = hole.filter(c => c.suit === '♥' || c.suit === '♦');
      const blacks = hole.filter(c => c.suit === '♣' || c.suit === '♠');
      let possibleJokerHands = [];
      hole.forEach((fourthCard) => {
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
      holePairs.forEach(h => { boardCombos.forEach(b => {
              const res = rankHand([...h, ...b], true); 
              if (bestHigh.power === -1 || res.power < bestHigh.power) bestHigh = res;
      });});
  }
  return { high: bestHigh, low: bestLow };
};

const updateRoomStrengths = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    const variantId = room.activeVariant?.id || 'HOLDEM';
    const isPreFlop = room.phase === PHASES.PRE_FLOP;
    room.players.forEach(p => {
        if (p && p.hand && !p.isFolded && !p.waitingForNextHand) {
            const evaluation = getBestHand(p.hand, room.community, variantId);
            p.strength = evaluation.high.name;
            p.strengthPower = evaluation.high.power;
            if (isPreFlop) { p.winProbability = 0; p.lowWinProbability = 0; } 
            else {
                const maxPower = 9 * Math.pow(15, 7);
                const rawProb = (p.strengthPower / maxPower) * 100;
                p.winProbability = variantId === 'MUFLIS' ? Math.max(5, 100 - rawProb) : Math.min(99, Math.max(5, rawProb));
                if (evaluation.low) {
                    p.lowStrength = evaluation.low.name;
                    p.lowStrengthPower = evaluation.low.power;
                    const rawLowProb = 100 - ((p.lowStrengthPower / (Math.pow(15, 6) * 13)) * 100);
                    p.lowWinProbability = Math.min(100, Math.max(5, rawLowProb * 1.5));
                } else { p.lowWinProbability = 0; p.lowStrength = variantId === 'HILOW' ? "No Qualifier" : null; }
            }
        }
    });
};

const processShowdown = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    room.activeIdx = -1;
    room.gameInProgress = false; // Reset early so next ignition isn't blocked
    if (room.timer) clearInterval(room.timer);
    
    const activePlayers = room.players.filter(p => p !== null && !p.waitingForNextHand);
    const variantId = room.activeVariant?.id || 'HOLDEM';
    const rawPotsWins = [];
    
    const contributions = activePlayers.map(p => ({ uid: p.uid, amount: p.totalContribution, folded: p.isFolded, name: p.name, player: p })).sort((a, b) => a.amount - b.amount);
    
    let lastLevel = 0;
    const pots = [];
    contributions.forEach((c, idx) => {
        const diff = c.amount - lastLevel;
        if (diff > 0) {
            let segAmount = 0; let eligible = [];
            contributions.slice(idx).forEach(other => {
                segAmount += diff;
                if (!other.folded) eligible.push(other.uid);
            });
            if (eligible.length > 0) pots.push({ amount: segAmount, eligible });
            lastLevel = c.amount;
        }
    });

    pots.forEach(pot => {
        const eligiblePlayers = room.players.filter(p => p && pot.eligible.includes(p.uid));
        if (eligiblePlayers.length === 1) {
            const soleWinner = eligiblePlayers[0];
            soleWinner.chips += pot.amount;
            rawPotsWins.push({ name: soleWinner.name, uid: soleWinner.uid, rank: "!", hand: [], amount: pot.amount, winning5Ids: [] });
            return;
        }
        
        const evals = eligiblePlayers.map(p => ({ player: p, res: getBestHand(p.hand, room.community, variantId) }));
        
        if (variantId === 'HILOW') {
            const lowHalf = Math.floor((pot.amount * 100) / 2) / 100;
            const highHalf = ((pot.amount * 100) - (lowHalf * 100)) / 100;
            const eligibleLow = evals.filter(e => e.res && e.res.low);
            if (eligibleLow.length > 0) {
                const lowSorted = [...eligibleLow].sort((a, b) => a.res.low.power - b.res.low.power);
                const winnersL = lowSorted.filter(e => e.res.low.power === lowSorted[0].res.low.power);
                winnersL.forEach(w => { 
                    const share = lowHalf / winnersL.length; 
                    w.player.chips += share; 
                    rawPotsWins.push({ name: w.player.name, uid: w.player.uid, rank: `LOW: ${w.res.low.name}`, hand: w.res.low.cards, amount: share, winning5Ids: w.res.low.cards.map(c => c.id) }); 
                });
                const highSorted = [...evals].sort((a, b) => b.res.high.power - a.res.high.power);
                const winnersH = highSorted.filter(e => e.res.high.power === highSorted[0].res.high.power);
                winnersH.forEach(w => { 
                    const share = highHalf / winnersH.length; 
                    w.player.chips += share; 
                    rawPotsWins.push({ name: w.player.name, uid: w.player.uid, rank: `HIGH: ${w.res.high.name}`, hand: w.res.high.cards, amount: share, winning5Ids: w.res.high.cards.map(c => c.id) }); 
                });
            } else {
                const highSorted = [...evals].sort((a, b) => b.res.high.power - a.res.high.power);
                const winnersH = highSorted.filter(e => e.res.high.power === highSorted[0].res.high.power);
                winnersH.forEach(w => { 
                    const share = pot.amount / winnersH.length; 
                    w.player.chips += share; 
                    rawPotsWins.push({ name: w.player.name, uid: w.player.uid, rank: `SCOOP: ${w.res.high.name}`, hand: w.res.high.cards, amount: share, winning5Ids: w.res.high.cards.map(c => c.id) }); 
                });
            }
        } else {
            evals.sort((a, b) => variantId === 'MUFLIS' ? (a.res.high.power - b.res.high.power) : (b.res.high.power - a.res.high.power));
            const winners = evals.filter(e => e.res.high.power === evals[0].res.high.power);
            winners.forEach(w => { 
                const share = pot.amount / winners.length; 
                w.player.chips += share; 
                rawPotsWins.push({ name: w.player.name, uid: w.player.uid, rank: w.res.high.name, hand: w.res.high.cards, amount: share, winning5Ids: w.res.high.cards.map(c => c.id) }); 
            });
        }
    });

    room.showdownWinners = rawPotsWins;
    room.phase = PHASES.SHOWDOWN;
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    
    room.showdownWinners.forEach(w => {
      const cardStr = w.hand && w.hand.length > 0 ? ` (${w.hand.map(c => `${c.value}${c.suit}`).join(', ')})` : "";
      io.to(roomId).emit('log', { 
        name: w.name, 
        action: w.rank === "!" ? `SCOOPED THE POT $${w.amount.toFixed(2)}` : `WON $${w.amount.toFixed(2)} WITH ${w.rank.toUpperCase()}${cardStr}`, 
        type: 'win' 
      });
    });

    const muckOnly = room.showdownWinners.every(w => w.rank === "!");
    const cycleTime = muckOnly ? 1500 : 3500;
    const totalDelay = Math.max(cycleTime, room.showdownWinners.length * cycleTime);
    
    setTimeout(() => {
        room.players.forEach(p => { 
          if (p) { 
              p.waitingForNextHand = false; 
              p.lastAction = null; 
              if (p.isBot && p.chips < Number(room.bb)) { 
                  p.chips = Number(room.maxBuy); 
                  io.to(roomId).emit('log', { name: "SYSTEM", action: `${p.name.toUpperCase()} RE-BOUGHT`, type: 'phase' }); 
              } 
          } 
        });
        const seatedIdxs = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
        if (seatedIdxs.length >= 2) { 
            room.dealerIdx = seatedIdxs[(seatedIdxs.indexOf(room.dealerIdx) + 1) % seatedIdxs.length]; 
            runIgnition(roomId); 
        } else { 
            room.phase = PHASES.IDLE; 
            io.to(roomId).emit('roomUpdate', serializeRoom(room)); 
        }
    }, totalDelay);
};

const runIgnition = (roomId) => {
  const room = rooms[roomId]; 
  if (!room) return;

  if (room.ignitionTimer) {
      clearTimeout(room.ignitionTimer);
      room.ignitionTimer = null;
  }

  const seatedIdxs = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
  if (seatedIdxs.length < 2) { 
    room.phase = PHASES.IDLE; 
    room.gameInProgress = false;
    io.to(roomId).emit('roomUpdate', serializeRoom(room)); 
    return; 
  }

  room.gameInProgress = true;
  room.showdownWinners = null; 
  room.winning5Ids = [];
  
  if (room.dealerIdx === undefined || room.dealerIdx === -1 || !room.players[room.dealerIdx]) {
      room.dealerIdx = seatedIdxs[0];
  }
  
  const dealerSeat = room.players[room.dealerIdx];
  if (dealerSeat.isBot) {
      const vIds = Object.keys(variantNames);
      dealerSeat.pendingVariant = vIds[Math.floor(Math.random() * vIds.length)];
  }

  const variantId = dealerSeat.pendingVariant || 'HOLDEM';
  room.activeVariant = { id: variantId, name: variantNames[variantId], holeCards: holeCardsMap[variantId] };
  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; 
  room.potData = [{ amount: 0 }]; 
  room.highestBet = Number(room.bb); 
  room.lastRaiseIncrement = Number(room.bb);
  room.phase = PHASES.PRE_FLOP;
  
  room.players.forEach(p => { if (p) { 
      if (seatedIdxs.includes(p.seatIdx)) { 
          p.hand = room.deck.splice(0, room.activeVariant.holeCards); 
          p.currentBet = 0; p.totalContribution = 0; p.isFolded = false; 
          p.isWinner = false; p.lastAction = null; p.actedThisStreet = false; 
          p.winProbability = 0; p.lowWinProbability = 0; p.strength = "Pre-flop"; 
          p.lowStrength = null; p.waitingForNextHand = false; p.isDisconnected = false; 
      } else { 
          p.waitingForNextHand = true; p.hand = []; 
      }
  } });

  let sbIdx, bbIdx;
  if (seatedIdxs.length === 2) {
      sbIdx = room.dealerIdx;
      bbIdx = seatedIdxs[(seatedIdxs.indexOf(room.dealerIdx) + 1) % 2];
  } else {
      sbIdx = seatedIdxs[(seatedIdxs.indexOf(room.dealerIdx) + 1) % seatedIdxs.length];
      bbIdx = seatedIdxs[(seatedIdxs.indexOf(room.dealerIdx) + 2) % seatedIdxs.length];
  }

  const sbA = Math.min(Number(room.sb), room.players[sbIdx].chips); 
  room.players[sbIdx].chips -= sbA; room.players[sbIdx].currentBet = sbA; room.players[sbIdx].totalContribution = sbA;
  const bbA = Math.min(Number(room.bb), room.players[bbIdx].chips); 
  room.players[bbIdx].chips -= bbA; room.players[bbIdx].currentBet = bbA; room.players[bbIdx].totalContribution = bbA;
  
  io.to(roomId).emit('log', { name: "SYSTEM", action: `${room.players[room.dealerIdx].name.toUpperCase()} DEALING ${room.activeVariant.name.toUpperCase()}`, type: 'phase' });
  updateRoomStrengths(roomId); 
  
  room.activeIdx = seatedIdxs[(seatedIdxs.indexOf(bbIdx) + 1) % seatedIdxs.length]; 
  startTurnTimer(roomId); 
  io.to(roomId).emit('roomUpdate', serializeRoom(room)); 
  triggerBotTurn(roomId);
};

const performAction = (roomId, type, amount) => {
    const room = rooms[roomId]; if (!room || room.activeIdx === -1) return;
    const player = room.players[room.activeIdx]; if (!player || player.isFolded) { moveToNextPlayer(roomId); return; }
    if (room.timer) clearInterval(room.timer);
    player.actedThisStreet = true;
    if (type === 'FOLD') { player.isFolded = true; player.lastAction = "FOLD"; io.to(roomId).emit('log', { name: player.name, action: `FOLDED`, type: 'fold' }); } 
    else if (type === 'CALL') { 
        const diff = room.highestBet - player.currentBet; const actual = Math.min(diff, player.chips); 
        player.chips -= actual; player.currentBet += actual; player.totalContribution += actual; 
        player.lastAction = actual > 0 ? "CALL" : "CHECK"; 
        io.to(roomId).emit('log', { name: player.name, action: actual > 0 ? `CALLED $${actual.toFixed(2)}` : `CHECKED`, type: 'bet' }); 
    } else if (type === 'RAISE') { 
        const min = room.highestBet + room.lastRaiseIncrement; const actualRaise = Math.max(amount, min); const capped = Math.min(actualRaise, player.chips + player.currentBet); 
        const diff = capped - player.currentBet; const increment = capped - room.highestBet;
        player.chips -= diff; player.currentBet = capped; player.totalContribution += diff; room.highestBet = capped; player.lastAction = "RAISE"; 
        if (increment >= room.lastRaiseIncrement) { room.lastRaiseIncrement = increment; room.players.forEach(p => { if (p && p.uid !== player.uid) p.actedThisStreet = false; }); } 
        io.to(roomId).emit('log', { name: player.name, action: `RAISED to $${capped.toFixed(2)}`, type: 'bet' }); 
    }
    moveToNextPlayer(roomId);
};

const moveToNextPlayer = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    updateRoomStrengths(roomId);
    const active = room.players.filter(p => p && !p.isFolded && !p.waitingForNextHand && !p.isDisconnected);
    const allMatched = active.every(p => p.chips < 0.01 || p.currentBet === room.highestBet);
    const allActed = active.every(p => p.chips < 0.01 || p.actedThisStreet);
    if (active.length <= 1) { room.activeIdx = -1; collectBets(room); io.to(roomId).emit('roomUpdate', serializeRoom(room)); setTimeout(() => processShowdown(roomId), 500); } 
    else if (allMatched && allActed) { room.activeIdx = -1; collectBets(room); io.to(roomId).emit('roomUpdate', serializeRoom(room)); setTimeout(() => nextPhase(roomId), 1000); } 
    else { 
        let nextIdx = (room.activeIdx + 1) % TOTAL_SEATS;
        for (let i = 0; i < TOTAL_SEATS; i++) {
            const p = room.players[nextIdx];
            if (p && !p.isFolded && !p.waitingForNextHand && !p.isDisconnected) { room.activeIdx = nextIdx; startTurnTimer(room.id); io.to(room.id).emit('roomUpdate', serializeRoom(room)); triggerBotTurn(room.id); return; }
            nextIdx = (nextIdx + 1) % TOTAL_SEATS;
        }
    }
};

const collectBets = (room) => { room.players.forEach(p => { if (p) { room.potData[0].amount += p.currentBet; p.currentBet = 0; p.actedThisStreet = false; p.lastAction = null; } }); room.highestBet = 0; room.lastRaiseIncrement = Number(room.bb); };

const nextPhase = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    room.players.forEach(p => { if(p) p.lastAction = null; });
    const active = room.players.filter(p => p && !p.isFolded && !p.waitingForNextHand && !p.isDisconnected);
    
    if (active.length <= 1 || (room.players.filter(p => p && !p.isFolded && p.chips > 0.01).length <= 1 && room.phase !== PHASES.RIVER)) {
        if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = room.deck.splice(0, 3); }
        else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(...room.deck.splice(0, 1)); }
        else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(...room.deck.splice(0, 1)); }
        else { processShowdown(roomId); return; }
        io.to(roomId).emit('log', { name: "SYSTEM", action: `${room.phase} DEALT`, type: 'phase' }); updateRoomStrengths(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room)); setTimeout(() => nextPhase(roomId), 800); return;
    }

    if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = room.deck.splice(0, 3); }
    else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(...room.deck.splice(0, 1)); }
    else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(...room.deck.splice(0, 1)); }
    else { processShowdown(roomId); return; }
    
    io.to(roomId).emit('log', { name: "SYSTEM", action: `${room.phase} DEALT`, type: 'phase' }); 
    updateRoomStrengths(roomId);
    
    let nextIdx = (room.dealerIdx + 1) % TOTAL_SEATS;
    for (let i = 0; i < TOTAL_SEATS; i++) {
        const p = room.players[nextIdx];
        if (p && !p.isFolded && p.chips > 0.01 && !p.waitingForNextHand && !p.isDisconnected) { 
            room.activeIdx = nextIdx; 
            startTurnTimer(roomId); 
            io.to(roomId).emit('roomUpdate', serializeRoom(room)); 
            triggerBotTurn(roomId); 
            return; 
        }
        nextIdx = (nextIdx + 1) % TOTAL_SEATS;
    }
};

const startTurnTimer = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    if (room.timer) clearInterval(room.timer);
    room.timeRemaining = TURN_TIME_LIMIT;
    room.timer = setInterval(() => {
        room.timeRemaining--;
        if (room.timeRemaining <= 0) { clearInterval(room.timer); const p = room.players[room.activeIdx]; if (p) performAction(roomId, (room.highestBet - p.currentBet) > 0 ? 'FOLD' : 'CALL', 0); } 
        else io.to(roomId).emit('roomUpdate', serializeRoom(room));
    }, 1000);
};

const triggerBotTurn = (roomId) => {
    const room = rooms[roomId]; if (!room || room.activeIdx === -1) return;
    const player = room.players[room.activeIdx]; if (!player || !player.isBot) return;
    setTimeout(() => {
        const current = rooms[roomId]; if (!current || current.activeIdx === -1 || current.players[current.activeIdx]?.uid !== player.uid) return;
        let winProb = Math.max(player.winProbability || 0, player.lowWinProbability || 0);
        const personality = BOT_PERSONALITIES[player.name] || "CALCULATED";
        let mod = personality === "TIGHT" ? -15 : personality === "AGGRESSIVE" ? 15 : personality === "PASSIVE" ? -10 : 0;
        let effective = winProb + mod;
        if (Math.random() < 0.05) effective = 90;
        let type = 'CALL'; let raiseAmt = 0;
        if (effective > 85) { if (Math.random() < 0.7) { type = 'RAISE'; raiseAmt = current.highestBet + (current.lastRaiseIncrement * (personality === "AGGRESSIVE" ? 3 : 2)); } }
        else if (effective > 60) { if (Math.random() < 0.3) { type = 'RAISE'; raiseAmt = current.highestBet + current.lastRaiseIncrement; } }
        else if (effective < 30 && (current.highestBet - player.currentBet) > current.bb) { type = personality === "AGGRESSIVE" && Math.random() < 0.4 ? 'CALL' : 'FOLD'; }
        else if (effective < 15) type = 'FOLD';
        if (type === 'FOLD' && (current.highestBet - player.currentBet) <= 0.01) type = 'CALL';
        performAction(roomId, type, raiseAmt);
    }, 1500);
};

const removePlayerGlobally = (uid, force = false) => {
    Object.values(rooms).forEach(room => {
        const idx = room.players.findIndex(p => p && p.uid === uid);
        if (idx !== -1) {
            const player = room.players[idx];
            if (force || player.isBot) {
                const prof = profiles.find(x => x.uid === uid);
                if (prof) prof.chips += (Number(player.chips) + Number(player.currentBet || 0));
                if (room.activeIdx === idx) moveToNextPlayer(room.id);
                room.players[idx] = null;
                if (room.players.filter(pl => pl && !pl.isBot).length === 0) { if (room.timer) clearInterval(room.timer); room.players = Array(10).fill(null); room.phase = PHASES.IDLE; room.gameInProgress = false; }
                io.to(room.id).emit('roomUpdate', serializeRoom(room));
            } else {
                player.isDisconnected = true; io.to(room.id).emit('log', { name: "SYSTEM", action: `${player.name.toUpperCase()} DISCONNECTED`, type: 'phase' }); io.to(room.id).emit('roomUpdate', serializeRoom(room));
                const key = `${uid}_${room.id}`; if (disconnectTimeouts[key]) clearTimeout(disconnectTimeouts[key]);
                disconnectTimeouts[key] = setTimeout(() => { removePlayerGlobally(uid, true); delete disconnectTimeouts[key]; }, SECURE_SEAT_TIME);
            }
        }
    });
};

io.on('connection', (socket) => {
  let seatedUid = null;
  socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) }));
  socket.on('playerLogin', ({ password }) => {
    const profile = profiles.find(p => p.password.toLowerCase() === password.toLowerCase());
    if (profile) { seatedUid = profile.uid; let activeRoomId = null; for (const room of Object.values(rooms)) { if (room.players.some(p => p && p.uid === profile.uid)) { activeRoomId = room.id; break; } } socket.emit('loginSuccess', { profile, activeRoomId }); }
  });
  socket.on('playerRebuy', ({ roomId, uid, amount }) => {
    const room = rooms[roomId]; 
    const player = room?.players.find(p => p && p.uid === uid); 
    const profile = profiles.find(p => p.uid === uid);
    if (room && player && profile && profile.chips >= amount) { 
        profile.chips -= amount; 
        player.chips += amount; 
        io.to(roomId).emit('log', { name: String(player.name), action: `RE-BOUGHT FOR $${amount}`, type: 'phase' }); 
        io.to(roomId).emit('roomUpdate', serializeRoom(room)); 
        io.emit('profilesUpdate', profiles); 
        const seated = room.players.filter(p => p && p.chips > 0);
        if (room.phase === PHASES.IDLE && seated.length >= 2 && !room.ignitionTimer && !room.gameInProgress) {
            room.ignitionTimer = setTimeout(() => { room.ignitionTimer = null; runIgnition(roomId); }, 2000);
        }
    }
  });
  socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
    const room = rooms[roomId]; if (!room) { if (typeof callback === 'function') callback({ status: 'error' }); return; }
    const existingIdx = room.players.findIndex(p => p && p.uid === profile.uid);
    if (existingIdx !== -1) {
        const timeoutKey = `${profile.uid}_${roomId}`; if (disconnectTimeouts[timeoutKey]) { clearTimeout(disconnectTimeouts[timeoutKey]); delete disconnectTimeouts[timeoutKey]; }
        room.players[existingIdx].isDisconnected = false; seatedUid = profile.uid; socket.join(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room)); if (typeof callback === 'function') callback({ status: 'ok' }); return;
    }
    if (Object.values(rooms).some(r => r.players.some(p => p && p.uid === profile.uid))) { if (typeof callback === 'function') callback({ status: 'error', message: 'ALREADY_SEATED' }); return; }
    let globalProfile = profiles.find(p => p.uid === profile.uid || p.name === profile.name);
    if (!globalProfile) { globalProfile = { ...profile, chips: 1000 }; profiles.push(globalProfile); }
    if (globalProfile.chips < Number(buyIn)) { if (typeof callback === 'function') callback({ status: 'error' }); return; }
    globalProfile.chips -= Number(buyIn);
    const emptyIdx = room.players.findIndex(p => p === null); if (emptyIdx === -1) { if (typeof callback === 'function') callback({ status: 'error' }); return; }
    seatedUid = profile.uid;
    room.players[emptyIdx] = { ...profile, chips: Number(buyIn), seatIdx: emptyIdx, currentBet: 0, totalContribution: 0, isFolded: false, waitingForNextHand: room.gameInProgress, pendingVariant: profile.pendingVariant || 'HOLDEM', isDisconnected: false };
    socket.join(roomId); 
    io.to(roomId).emit('log', { name: String(profile.name), action: 'JOINED ARENA', type: 'phase' }); 
    if (typeof callback === 'function') callback({ status: 'ok' }); 
    io.to(roomId).emit('roomUpdate', serializeRoom(room)); 
    io.emit('profilesUpdate', profiles); 
    const seated = room.players.filter(p => p && p.chips > 0);
    if (room.phase === PHASES.IDLE && seated.length >= 2 && !room.ignitionTimer && !room.gameInProgress) {
        room.ignitionTimer = setTimeout(() => { room.ignitionTimer = null; runIgnition(roomId); }, 2000);
    }
  });
  socket.on('playerAction', ({ roomId, type, amount }) => performAction(roomId, type, amount));
  socket.on('leaveRoom', ({ uid }) => { removePlayerGlobally(uid, true); seatedUid = null; io.emit('profilesUpdate', profiles); });
  socket.on('disconnect', () => { if (seatedUid) { removePlayerGlobally(seatedUid, false); io.emit('profilesUpdate', profiles); } });
  socket.on('adminAddBot', ({ roomId }) => {
    const room = rooms[roomId]; if (!room) return;
    const emptyIdx = room.players.findIndex(p => p === null); if (emptyIdx === -1) return;
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const botId = Math.random().toString(36).slice(2, 7);
    room.players[emptyIdx] = { uid: `bot_${botId}`, name: botName, isBot: true, chips: Number(room.maxBuy), seatIdx: emptyIdx, currentBet: 0, totalContribution: 0, isFolded: false, waitingForNextHand: room.gameInProgress, pendingVariant: 'HOLDEM', isDisconnected: false };
    io.to(roomId).emit('log', { name: "SYSTEM", action: `${botName} ENTERED`, type: 'phase' }); io.to(roomId).emit('roomUpdate', serializeRoom(room)); 
    const seated = room.players.filter(p => p && p.chips > 0);
    if (room.phase === PHASES.IDLE && seated.length >= 2 && !room.ignitionTimer && !room.gameInProgress) {
        room.ignitionTimer = setTimeout(() => { room.ignitionTimer = null; runIgnition(roomId); }, 2000);
    }
  });
  socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
    const p = profiles.find(x => x.uid === uid); if (p) p.pendingVariant = pendingVariant;
    Object.values(rooms).forEach(room => { const player = room.players.find(pl => pl && pl.uid === uid); if (player) { player.pendingVariant = pendingVariant; io.to(room.id).emit('roomUpdate', serializeRoom(room)); } });
  });
  socket.on('adminNuclearReset', () => { rooms = {}; profiles = profiles.filter(p => p.role === 'admin'); io.emit('lobbyUpdate', []); io.emit('profilesUpdate', profiles); });
  socket.on('adminCreatePlayer', (p) => { profiles.push({ ...p, chips: Number(p.chips) }); io.emit('profilesUpdate', profiles); });
  socket.on('adminUpdatePlayer', (data) => {
    const { uid, chips, password } = data; const p = profiles.find(x => x.uid === uid);
    if (p) {
        if (chips !== undefined) p.chips = Number(chips);
        if (password !== undefined) p.password = password;
        Object.values(rooms).forEach(room => { const player = room.players.find(pl => pl && pl.uid === uid); if (player) { if (chips !== undefined) player.chips = Number(chips); if (password !== undefined) player.password = password; io.to(room.id).emit('roomUpdate', serializeRoom(room)); } });
        io.emit('profilesUpdate', profiles);
    }
  });
  socket.on('adminDeleteRoom', (roomId) => { if (rooms[roomId]) { delete rooms[roomId]; io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); } });
  socket.on('adminCreateRoom', (data) => { rooms[data.id] = { ...data, players: Array(TOTAL_SEATS).fill(null), phase: PHASES.IDLE, community: [], potData: [{amount:0}], dealerIdx: 0, timeRemaining: 20, gameInProgress: false, lastRaiseIncrement: 2 }; io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`${APP_NAME} ${VERSION} running on port ${PORT}`));
