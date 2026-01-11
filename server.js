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

const VERSION = "v1.1.3";
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

const BOT_NAMES = ["Ram", "Bipin", "Brij", "Manoj", "Aneesh", "Priya", "Jyoti", "Brij", "Nandu", "Hardevi", "Lalit", "Sona"];

const SEEDED_PLAYERS = [
  { name: 'Vivek', password: 'sablani', uid: 'u_vivek', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Aroosa', password: 'saeed', uid: 'u_aroosa', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Ram', password: 'shahani', uid: 'u_ram', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Divya', password: 'shahani2', uid: 'u_divya', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Brij', password: 'lulla', uid: 'u_brij', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Priya L', password: 'lulla2', uid: 'u_priyal', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Thashaan', password: 'lulla3', uid: 'u_thashaan', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Nish', password: 'sevkani', uid: 'u_nish', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Marlon', password: 'king', uid: 'u_marlon', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Tarun', password: 'shroff', uid: 'u_tarun', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Kavita', password: 'shroff2', uid: 'u_kavita', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Manoj', password: 'gulrajani', uid: 'u_manoj', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Namrata', password: 'gulrajani2', uid: 'u_namrata', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Aneesh', password: 'mittal', uid: 'u_aneesh', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Monika', password: 'mittal2', uid: 'u_monika', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Sanjay N', password: 'nariani', uid: 'u_sanjay', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Hardevi', password: 'nariani2', uid: 'u_hardevi', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Sunil', password: 'sahaetiya', uid: 'u_sunil', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Priya S', password: 'sahaetiya2', uid: 'u_priyas', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Nandu', password: 'gandhi', uid: 'u_nandu', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Jyoti', password: 'gandhi2', uid: 'u_jyoti', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Sanjay G', password: 'gehani', uid: 'u_sanjayg', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Lalit', password: 'dama', uid: 'u_lalit', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Sona', password: 'dama2', uid: 'u_sona', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'Bipin', password: 'ratnani', uid: 'u_sona', chips: 10000, role: 'player', pendingVariant: 'RANDOM' },
  { name: 'P1', password: 'p1', uid: 'u_p1', chips: 10000, role: 'player', pendingVariant: 'RANDOM' }
];

let profiles = [...SEEDED_PLAYERS]; 
let rooms = {};

const SEEDED_ROOMS_DATA = [
    { id: 'room_sindhi', name: 'Sindhi', sb: 1, bb: 2, minBuy: 50, maxBuy: 100 },
    { id: 'room_10', name: '$10 Buy-in', sb: 0.25, bb: 0.5, minBuy: 5, maxBuy: 10 },
    { id: 'room_50', name: '$50 Buy-in', sb: 0.50, bb: 1, minBuy: 25, maxBuy: 50 },
    { id: 'room_500', name: '$500 Buy-in', sb: 2, bb: 5, minBuy: 200, maxBuy: 500 }
];

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
    highestBet: 0, 
    lastRaiseIncrement: data.bb 
  };
});

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
  let isFlush = new Set(sorted.map(c => c.suit)).size === 1;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false, straightHigh = 0;
  if (uniqueRanks.length >= 5) {
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
    if (!isStraight && !isAceLow && uniqueRanks.includes(14) && [5,4,3,2].every(r => uniqueRanks.includes(r))) { isStraight = true; straightHigh = 5; }
  }
  const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
  const vc = groups.map(x => x.c);
  let score = 0, name = `High Card ${V_LABEL[ranks[0]]}`;
  if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
  else if (vc[0] === 4) { score = 7; name = `Four of a Kind ${V_LABEL[groups[0].r]}s`; }
  else if (vc[0] === 3 && vc[1] === 2) { score = 6; name = "Full House"; }
  else if (isFlush) { score = 5; name = "Flush"; }
  else if (isStraight) { score = 4; name = "Straight"; }
  else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
  else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
  else if (vc[0] === 2) { score = 1; name = `Pair of ${V_LABEL[groups[0].r]}s`; }
  const power = score * Math.pow(15, 7) + groups.reduce((acc, g, i) => acc + (g.r * Math.pow(15, 6-i)), 0);
  return { power, name, cards: sorted.slice(0, 5) };
};

const getBestHand = (hole, comm, variantId) => {
  let bestHigh = { power: -1, name: "Pre-flop" }, bestLow = null;
  const boardCombos = combinations(comm, 3), holePairs = combinations(hole, 2);
  if (variantId === 'HOLDEM' || variantId === 'PINEAPPLE') {
    combinations([...hole, ...comm], 5).forEach(c => { const res = rankHand(c); if (res.power > bestHigh.power) bestHigh = res; });
  } else {
    holePairs.forEach(h => boardCombos.forEach(b => {
        if (variantId === 'HILOW') {
            const resH = rankHand([...h, ...b], false); if (resH.power > bestHigh.power) bestHigh = resH;
            const resL = rankHand([...h, ...b], true); if (!bestLow || resL.power < bestLow.power) bestLow = resL;
        } else if (variantId === 'MUFLIS') {
            const res = rankHand([...h, ...b], true); if (bestHigh.power === -1 || res.power < bestHigh.power) bestHigh = res;
        } else {
            const res = rankHand([...h, ...b]); if (res.power > bestHigh.power) bestHigh = res;
        }
    }));
  }
  return { high: bestHigh, low: bestLow };
};

const updateRoomStrengths = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    const variantId = room.activeVariant?.id || 'HOLDEM';
    room.players.forEach(p => {
        if (p && p.hand && !p.isFolded && !p.waitingForNextHand) {
            const evaluation = getBestHand(p.hand, room.community, variantId);
            p.strength = evaluation.high.name;
            p.strengthPower = evaluation.high.power;
            const maxPower = 9 * Math.pow(15, 7);
            const rawProb = (p.strengthPower / maxPower) * 100;
            p.winProbability = variantId === 'MUFLIS' ? Math.max(5, 100 - rawProb) : Math.min(99, Math.max(5, rawProb));
            if (evaluation.low) {
                p.lowStrength = evaluation.low.name;
                p.lowWinProbability = 100 - ((evaluation.low.power / (Math.pow(15, 6) * 13)) * 100);
            } else { p.lowStrength = null; p.lowWinProbability = 0; }
        }
    });
};

const triggerBotTurn = (roomId) => {
    const room = rooms[roomId]; if (!room || room.activeIdx === -1) return;
    const p = room.players[room.activeIdx]; if (!p || !p.isBot) return;
    setTimeout(() => {
        const actRoom = rooms[roomId]; if(!actRoom || actRoom.activeIdx === -1) return;
        performAction(roomId, Math.random() > 0.8 ? 'RAISE' : 'CALL', actRoom.highestBet + actRoom.lastRaiseIncrement);
    }, 1500);
};

const startTurnTimer = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    if (room.timer) clearInterval(room.timer);
    room.timeRemaining = TURN_TIME_LIMIT;
    room.timer = setInterval(() => {
        room.timeRemaining--;
        if (room.timeRemaining <= 0) { clearInterval(room.timer); performAction(roomId, (room.highestBet > (room.players[room.activeIdx]?.currentBet || 0)) ? 'FOLD' : 'CALL', 0); } 
        else io.to(roomId).emit('roomUpdate', serializeRoom(room));
    }, 1000);
};

const processShowdown = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    room.activeIdx = -1; room.gameInProgress = false; if (room.timer) clearInterval(room.timer);
    const variantId = room.activeVariant?.id || 'HOLDEM';
    const rawPotsWins = [];
    const activePlayers = room.players.filter(p => p && !p.waitingForNextHand);
    const contributions = activePlayers.map(p => ({ uid: p.uid, amount: p.totalContribution, folded: p.isFolded, name: p.name, player: p })).sort((a,b) => a.amount - b.amount);
    
    let lastLevel = 0, pots = [];
    contributions.forEach((c, idx) => {
        const diff = c.amount - lastLevel;
        if (diff > 0) {
            let seg = 0, el = [];
            contributions.slice(idx).forEach(other => { seg += diff; if (!other.folded) el.push(other.uid); });
            if (el.length > 0) pots.push({ amount: seg, eligible: el });
            lastLevel = c.amount;
        }
    });

    pots.forEach(pot => {
        const eligible = room.players.filter(p => p && pot.eligible.includes(p.uid));
        if (eligible.length === 1) {
            eligible[0].chips += pot.amount;
            rawPotsWins.push({ name: eligible[0].name, uid: eligible[0].uid, rank: "!", hand: [], amount: pot.amount });
            return;
        }
        const evals = eligible.map(p => ({ player: p, res: getBestHand(p.hand, room.community, variantId) }));
        if (variantId === 'HILOW') {
            const lowHalf = pot.amount / 2, highHalf = pot.amount - lowHalf;
            const eligibleLow = evals.filter(e => e.res.low);
            if (eligibleLow.length > 0) {
                eligibleLow.sort((a,b) => a.res.low.power - b.res.low.power);
                eligibleLow[0].player.chips += lowHalf;
                rawPotsWins.push({ name: eligibleLow[0].player.name, uid: eligibleLow[0].player.uid, rank: `LOW: ${eligibleLow[0].res.low.name}`, hand: eligibleLow[0].res.low.cards, amount: lowHalf, winning5Ids: eligibleLow[0].res.low.cards.map(c=>c.id) });
                evals.sort((a,b) => b.res.high.power - a.res.high.power);
                evals[0].player.chips += highHalf;
                rawPotsWins.push({ name: evals[0].player.name, uid: evals[0].player.uid, rank: `HIGH: ${evals[0].res.high.name}`, hand: evals[0].res.high.cards, amount: highHalf, winning5Ids: evals[0].res.high.cards.map(c=>c.id) });
            } else {
                evals.sort((a,b) => b.res.high.power - a.res.high.power);
                evals[0].player.chips += pot.amount;
                rawPotsWins.push({ name: evals[0].player.name, uid: evals[0].player.uid, rank: `SCOOP: ${evals[0].res.high.name}`, hand: evals[0].res.high.cards, amount: pot.amount, winning5Ids: evals[0].res.high.cards.map(c=>c.id) });
            }
        } else {
            evals.sort((a, b) => variantId === 'MUFLIS' ? a.res.high.power - b.res.high.power : b.res.high.power - a.res.high.power);
            evals[0].player.chips += pot.amount;
            rawPotsWins.push({ name: evals[0].player.name, uid: evals[0].player.uid, rank: evals[0].res.high.name, hand: evals[0].res.high.cards, amount: pot.amount, winning5Ids: evals[0].res.high.cards.map(c=>c.id) });
        }
    });

    room.showdownWinners = rawPotsWins; room.phase = PHASES.SHOWDOWN;
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    
    room.showdownWinners.forEach(w => {
        io.to(roomId).emit('log', { name: w.name, action: w.rank === "!" ? `SCOOPED THE POT $${w.amount.toFixed(2)}` : `WON $${w.amount.toFixed(2)} WITH ${w.rank.toUpperCase()}`, type: 'win' });
    });

    const cycle = room.showdownWinners.every(w => w.rank === "!") ? 2000 : 8000;
    setTimeout(() => {
        room.players.forEach(p => { if (p) { p.waitingForNextHand = false; p.lastAction = null; if (p.isBot && p.chips < room.bb) p.chips = room.maxBuy; } });
        const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) { room.dealerIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length]; runIgnition(roomId); }
        else { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', serializeRoom(room)); }
    }, Math.max(cycle, room.showdownWinners.length * cycle));
};

const runIgnition = (roomId) => {
  const room = rooms[roomId]; if (!room) return;
  const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
  if (seated.length < 2) { room.phase = PHASES.IDLE; room.gameInProgress = false; io.to(roomId).emit('roomUpdate', serializeRoom(room)); return; }
  
  room.gameInProgress = true; room.showdownWinners = null; 
  if (room.dealerIdx === undefined || room.dealerIdx === -1 || !room.players[room.dealerIdx]) {
      room.dealerIdx = seated[0];
  }
  
  const dealerSeat = room.players[room.dealerIdx];
  if (!dealerSeat) return;

  let variantId = dealerSeat.pendingVariant || 'RANDOM';
  if (variantId === 'RANDOM') { const vIds = Object.keys(variantNames); variantId = vIds[Math.floor(Math.random() * vIds.length)]; }
  
  const vName = variantNames[variantId] || "Poker";
  room.activeVariant = { id: variantId, name: vName, holeCards: holeCardsMap[variantId] };
  
  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; room.potData = [{ amount: 0 }]; room.highestBet = room.bb; room.lastRaiseIncrement = room.bb; room.phase = PHASES.PRE_FLOP;
  
  room.players.forEach(p => { if (p) { p.hand = room.deck.splice(0, room.activeVariant.holeCards); p.currentBet = 0; p.totalContribution = 0; p.isFolded = false; p.actedThisStreet = false; p.waitingForNextHand = false; } });

  let sbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length], bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
  room.players[sbIdx].chips -= room.sb; room.players[sbIdx].currentBet = room.sb; room.players[sbIdx].totalContribution = room.sb;
  room.players[bbIdx].chips -= room.bb; room.players[bbIdx].currentBet = room.bb; room.players[bbIdx].totalContribution = room.bb;
  
  io.to(roomId).emit('log', { name: "SYSTEM", action: `${dealerSeat.name.toUpperCase()} DEALING ${vName.toUpperCase()}`, type: 'phase' });
  
  updateRoomStrengths(roomId);
  room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
  startTurnTimer(roomId); triggerBotTurn(roomId);
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
};

const performAction = (roomId, type, amount) => {
    const room = rooms[roomId]; if (!room || room.activeIdx === -1) return;
    const player = room.players[room.activeIdx]; if (!player) return;
    if (room.timer) clearInterval(room.timer);
    player.actedThisStreet = true;
    if (type === 'FOLD') { player.isFolded = true; player.lastAction = "FOLD"; io.to(roomId).emit('log', { name: player.name, action: 'FOLDED', type: 'fold' }); }
    else if (type === 'CALL') { const diff = room.highestBet - player.currentBet; const act = Math.min(diff, player.chips); player.chips -= act; player.currentBet += act; player.totalContribution += act; player.lastAction = act > 0 ? "CALL" : "CHECK"; io.to(roomId).emit('log', { name: player.name, action: act > 0 ? `CALLED $${act.toFixed(2)}` : 'CHECKED', type: 'bet' }); }
    else if (type === 'RAISE') { const diff = amount - player.currentBet; player.chips -= diff; player.currentBet = amount; player.totalContribution += diff; room.highestBet = amount; player.lastAction = "RAISE"; io.to(roomId).emit('log', { name: player.name, action: `RAISED to $${amount.toFixed(2)}`, type: 'bet' }); }
    updateRoomStrengths(roomId);
    moveToNextPlayer(roomId);
};

const moveToNextPlayer = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    const active = room.players.filter(p => p && !p.isFolded && !p.waitingForNextHand);
    const allMatch = active.every(p => p.chips < 0.01 || p.currentBet === room.highestBet);
    const allAct = active.every(p => p.actedThisStreet);
    if (active.length <= 1) { room.players.forEach(p => { if (p) { room.potData[0].amount += p.currentBet; p.currentBet = 0; } }); processShowdown(roomId); }
    else if (allMatch && allAct) { 
        room.players.forEach(p => { if (p) { room.potData[0].amount += p.currentBet; p.currentBet = 0; p.actedThisStreet = false; } });
        room.highestBet = 0;
        if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = room.deck.splice(0, 3); }
        else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(...room.deck.splice(0, 1)); }
        else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(...room.deck.splice(0, 1)); }
        else { processShowdown(roomId); return; }
        io.to(roomId).emit('log', { name: "SYSTEM", action: `${room.phase} DEALT`, type: 'phase' });
        updateRoomStrengths(roomId);
        room.activeIdx = (room.dealerIdx + 1) % TOTAL_SEATS;
        while (!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded) room.activeIdx = (room.activeIdx + 1) % TOTAL_SEATS;
        startTurnTimer(roomId); triggerBotTurn(roomId);
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
    } else {
        room.activeIdx = (room.activeIdx + 1) % TOTAL_SEATS;
        while (!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded) room.activeIdx = (room.activeIdx + 1) % TOTAL_SEATS;
        startTurnTimer(roomId); triggerBotTurn(roomId);
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
    }
};

io.on('connection', (socket) => {
  socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) }));
  socket.on('playerLogin', ({ password }) => {
    const prof = profiles.find(p => p.password === password);
    if (prof) {
        let activeRoomId = null;
        for(const r of Object.values(rooms)) { if(r.players.some(p => p && p.uid === prof.uid)) { activeRoomId = r.id; break; } }
        socket.emit('loginSuccess', { profile: prof, activeRoomId });
    }
  });
  socket.on('joinRoom', ({ roomId, profile, buyIn }, cb) => {
    const room = rooms[roomId]; if (!room) return;
    
    // Global seated check
    const alreadySeated = Object.values(rooms).some(r => r.players.some(p => p && p.uid === profile.uid));
    if (alreadySeated) {
        if (cb) cb({ status: 'error', message: 'ALREADY_SEATED' });
        return;
    }

    const empty = room.players.findIndex(p => p === null); if (empty === -1) return;
    room.players[empty] = { ...profile, chips: buyIn, seatIdx: empty, currentBet: 0, totalContribution: 0, isFolded: false, waitingForNextHand: room.gameInProgress, pendingVariant: profile.pendingVariant || 'RANDOM' };
    socket.join(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room));
    if (room.phase === PHASES.IDLE && room.players.filter(p => p && p.chips > 0).length >= 2) runIgnition(roomId);
    if (cb) cb({status:'ok'});
  });
  socket.on('adminAddBot', ({ roomId }) => {
    const room = rooms[roomId], empty = room.players.findIndex(p => p === null); if (empty === -1) return;
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    room.players[empty] = { uid: `bot_${Math.random()}`, name, isBot: true, chips: room.maxBuy, seatIdx: empty, currentBet: 0, totalContribution: 0, isFolded: false, waitingForNextHand: room.gameInProgress, pendingVariant: 'RANDOM' };
    io.to(roomId).emit('log', { name: "SYSTEM", action: `${name} ENTERED`, type: 'phase' });
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    if (room.phase === PHASES.IDLE && room.players.filter(p => p && p.chips > 0).length >= 2) runIgnition(roomId);
  });
  socket.on('playerRebuy', ({ roomId, uid, amount }) => {
    const room = rooms[roomId], p = room.players.find(x => x && x.uid === uid), prof = profiles.find(x => x.uid === uid);
    if (p && prof && prof.chips >= amount) { prof.chips -= amount; p.chips += amount; io.to(roomId).emit('log', { name: p.name, action: `RE-BOUGHT $${amount}`, type: 'phase' }); io.to(roomId).emit('roomUpdate', serializeRoom(room)); io.emit('profilesUpdate', profiles); }
  });
  socket.on('playerAction', ({ roomId, type, amount }) => performAction(roomId, type, amount));
  socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
    const p = profiles.find(x => x.uid === uid); if (p) p.pendingVariant = pendingVariant;
    Object.values(rooms).forEach(r => { const pl = r.players.find(x=>x && x.uid === uid); if(pl) pl.pendingVariant = pendingVariant; });
  });
});

server.listen(10000, '0.0.0.0', () => console.log(`Server v${VERSION} Running`));
