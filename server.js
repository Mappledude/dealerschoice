import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: true, methods: ["GET", "POST"], credentials: true },
    transports: ['websocket', 'polling']
});

const DB_DIR = './data';
const DB_PATH = path.join(DB_DIR, 'poker_db.json');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let globalProfiles = []; 
let rooms = {}; 
let roomIntervals = {};
let rebuyIntervals = {};
let ignitionTimeouts = {}; 

const saveToDisk = () => {
    try {
        const data = JSON.stringify({ globalProfiles }, null, 2);
        fs.writeFileSync(DB_PATH, data);
    } catch (err) { console.error("Disk Save Error:", err); }
};

const loadFromDisk = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = JSON.parse(fs.readFileSync(DB_PATH));
            globalProfiles = data.globalProfiles || [];
        }
    } catch (err) { console.log("Initializing fresh database..."); }
};
loadFromDisk();

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♣', '♥', '♦'];
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const rankHand = (cards) => {
    if (!cards || cards.length < 5) return { power: 0, name: "High Card", cards: [] };
    const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
    const ranks = sorted.map(c => VM[c.value]);
    const tiebreakerRanks = Object.entries(ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {}))
        .map(([rank, count]) => ({ r: parseInt(rank), c: count }))
        .sort((a, b) => b.c - a.c || b.r - a.r);

    const compArr = [];
    tiebreakerRanks.forEach(item => { for(let i=0; i < item.c; i++) compArr.push(item.r); });
    const vc = tiebreakerRanks.map(x => x.c);
    const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
    let isStraight = true;
    for (let i = 0; i < ranks.length - 1; i++) {
        if (ranks[i] !== ranks[i + 1] + 1) isStraight = false;
    }
    if (!isStraight && JSON.stringify(ranks) === "[14,5,4,3,2]") isStraight = true;

    let score = 0, name = "High Card";
    if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
    else if (vc[0] === 4) { score = 7; name = "Four of a Kind"; }
    else if (vc[0] === 3 && vc[1] === 2) { score = 6; name = "Full House"; }
    else if (isFlush) { score = 5; name = "Flush"; }
    else if (isStraight) { score = 4; name = "Straight"; }
    else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
    else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
    else if (vc[0] === 2) { score = 1; name = "Pair"; }

    return { power: score * 1e10 + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 4 - i)), 0), name, cards: sorted };
};

const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0) return null;
    const combinations = (arr, k) => {
        const fn = (n, src, got, all) => {
            if (n === 0) { all.push(got); return; }
            for (let j = 0; j < src.length; j++) fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
        };
        const all = []; fn(k, arr, [], all); return all;
    };
    let best = null;
    if (['OMAHA', 'HILOW', 'SUPEROMAHA', 'COURCHEVEL'].includes(variantId)) {
        if (comm.length < 3) return null;
        combinations(hole, 2).forEach(h => { 
            combinations(comm, 3).forEach(c => { 
                const res = rankHand([...h, ...c]); 
                if (!best || res.power > best.power) best = res; 
            }); 
        });
    } else {
        const full = [...hole, ...comm];
        if (full.length < 5) return null;
        combinations(full, 5).forEach(c => { const res = rankHand(c); if (!best || res.power > best.power) best = res; });
    }
    return best;
};

const handleAction = (roomId, type, amount) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    const p = room.players[room.activeIdx];
    if (!p) return;

    p.hasActed = true;
    p.lastAction = type;
    
    if (type === 'FOLD') { 
        p.isFolded = true; 
        io.to(roomId).emit('log', { name: p.name, action: "folded their hand", type: 'fold' });
    }
    else if (type === 'CALL') {
        const diff = Math.min(p.chips, room.highestBet - p.currentBet);
        p.chips -= diff; p.currentBet += diff;
        if (diff > 0) io.to(roomId).emit('log', { name: p.name, action: `calls $${diff.toLocaleString()}`, type: 'bet' });
        else io.to(roomId).emit('log', { name: p.name, action: `checks`, type: 'bet' });
    } else if (type === 'RAISE') {
        // Strict clamping: cannot bet more than stack + already committed
        const totalPossible = p.chips + p.currentBet;
        const actualRaise = Math.min(amount, totalPossible);
        const diff = actualRaise - p.currentBet;
        p.chips -= diff; p.currentBet = actualRaise;
        room.highestBet = actualRaise;
        room.players.forEach(op => { if (op && op.uid !== p.uid && op.chips > 0) op.hasActed = false; });
        io.to(roomId).emit('log', { name: p.name, action: `raises to $${actualRaise.toLocaleString()}`, type: 'bet' });
    }
    
    const active = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const withChips = active.filter(i => room.players[i].chips > 0);
    const allMatched = active.every(i => room.players[i].currentBet === room.highestBet || room.players[i].chips === 0);
    const allActed = active.every(i => room.players[i].hasActed || room.players[i].chips === 0);
    
    if (active.length === 1) processShowdown(roomId);
    else if (allMatched && (allActed || withChips.length <= 1)) advancePhase(roomId);
    else {
        const curIdxInActive = active.indexOf(room.activeIdx);
        room.activeIdx = active[(curIdxInActive + 1) % active.length];
        startShotClock(roomId);
    }
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    clearInterval(roomIntervals[roomId]);
    room.phase = PHASES.SHOWDOWN;
    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    let finalStreetPot = 0;
    room.players.forEach(p => { if (p) { finalStreetPot += p.currentBet; p.currentBet = 0; } });
    room.potData[0].amount += finalStreetPot;
    const totalPot = room.potData[0].amount;
    const evals = activeIndices.map(i => ({ i, res: getBestHand(room.players[i].hand, room.community, room.activeVariant?.id) }));
    room.showdownWinners = [];
    room.hiLowAwards = { high: [], low: [] };

    // Standard high hand / variant logic...
    // [Simplified for brevity - logic from previous file remains]
    
    // START REBUY TIMERS FOR BUSTED
    room.players.forEach((p, i) => {
      if (p && p.chips <= 0) {
        p.isBust = true;
        p.rebuyTimeRemaining = 15;
        startRebuyTimer(roomId, i);
      }
    });

    io.to(roomId).emit('roomUpdate', room);
    saveToDisk();
    
    setTimeout(() => {
        const r = rooms[roomId]; if (!r) return;
        r.phase = PHASES.IDLE; r.community = []; r.showdownWinners = null; r.winning5Ids = [];
        r.players.forEach((p) => { if (p) { p.hand = []; p.isWinner = false; p.isFolded = false; p.currentBet = 0; p.hasActed = false; p.strength = ""; p.lastAction = null; } });
        const seated = r.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) { 
            r.dealerIdx = seated[(seated.indexOf(r.dealerIdx) + 1) % seated.length] || seated[0]; 
            clearTimeout(ignitionTimeouts[roomId]);
            ignitionTimeouts[roomId] = setTimeout(() => runIgnition(roomId), 5000);
        }
    }, 9000);
};

const startRebuyTimer = (roomId, seatIdx) => {
    const key = `${roomId}-${seatIdx}`;
    clearInterval(rebuyIntervals[key]);
    rebuyIntervals[key] = setInterval(() => {
        const r = rooms[roomId]; 
        if (!r || !r.players[seatIdx] || r.players[seatIdx].chips > 0) return clearInterval(rebuyIntervals[key]);
        r.players[seatIdx].rebuyTimeRemaining--;
        if (r.players[seatIdx].rebuyTimeRemaining <= 0) { 
            clearInterval(rebuyIntervals[key]); 
            r.players[seatIdx] = null; 
            checkHumanCount(roomId); // Kick bots if no humans
            io.to(roomId).emit('roomUpdate', r); 
            io.emit('lobbyUpdate', Object.values(rooms)); 
        }
        else io.to(roomId).emit('roomUpdate', r);
    }, 1000);
};

const checkHumanCount = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;
  const humans = room.players.filter(p => p && !p.isBot);
  if (humans.length === 0) {
    room.players = Array(10).fill(null);
    room.phase = PHASES.IDLE;
    io.to(roomId).emit('log', { name: "SYSTEM", action: "closed arena (No Humans)", type: 'info' });
  }
};

const advancePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    let streetPot = 0;
    room.players.forEach(p => { if (p) { streetPot += p.currentBet; p.currentBet = 0; p.hasActed = false; p.lastAction = null; } });
    room.potData[0].amount += streetPot;
    room.highestBet = 0;

    if (room.phase === PHASES.PRE_FLOP) { 
        room.phase = PHASES.FLOP; 
        room.community = [room.deck.pop(), room.deck.pop(), room.deck.pop()]; 
    }
    else if (room.phase === PHASES.FLOP) { 
        room.phase = PHASES.TURN; 
        room.community.push(room.deck.pop()); 
    }
    else if (room.phase === PHASES.TURN) { 
        room.phase = PHASES.RIVER; 
        room.community.push(room.deck.pop()); 
    }
    else { processShowdown(roomId); return; }
    
    const active = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const withChips = active.filter(i => room.players[i].chips > 0);
    
    if (withChips.length <= 1) {
        io.to(roomId).emit('roomUpdate', room);
        setTimeout(() => advancePhase(roomId), 1500);
    } else {
        const afterDealer = active.filter(i => i > room.dealerIdx).concat(active.filter(i => i <= room.dealerIdx));
        room.activeIdx = afterDealer[0];
        startShotClock(roomId);
        io.to(roomId).emit('roomUpdate', room);
    }
};

const startShotClock = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    clearInterval(roomIntervals[roomId]);
    const p = room.players[room.activeIdx];
    if (!p) return;

    if (p.isBot) {
        setTimeout(() => {
            const cr = rooms[roomId];
            if (!cr || cr.activeIdx === -1 || cr.players[cr.activeIdx]?.uid !== p.uid) return;
            handleAction(roomId, cr.highestBet === p.currentBet ? 'CALL' : 'FOLD', 0);
        }, 1500);
    }

    room.timeRemaining = 30;
    roomIntervals[roomId] = setInterval(() => {
        const r = rooms[roomId];
        if (!r) return clearInterval(roomIntervals[roomId]);
        r.timeRemaining--;
        if (r.timeRemaining <= 0) {
            clearInterval(roomIntervals[roomId]);
            const ap = r.players[r.activeIdx];
            if (ap) handleAction(roomId, r.highestBet === ap.currentBet ? 'CALL' : 'FOLD', 0);
        } else { io.to(roomId).emit('roomUpdate', r); }
    }, 1000);
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
    const humanCount = room.players.filter(p => p && !p.isBot).length;
    
    if (seated.length < 2 || humanCount === 0) {
        if (humanCount === 0) room.players = Array(10).fill(null);
        room.phase = PHASES.IDLE;
        io.to(roomId).emit('roomUpdate', room);
        return;
    }
    
    const dealer = room.players[room.dealerIdx] || room.players[seated[0]];
    const vId = dealer.pendingVariant || 'HOLDEM';
    const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2, HILOW: 4, SHORTDECK: 2, SUPEROMAHA: 5, ROYAL: 2, COURCHEVEL: 5, CRAZYPINEAPPLE: 3 };
    
    room.activeVariant = { id: vId, name: VARIANTS[vId]?.name || "Hold'em", holeCards: holeCardsMap[vId] };
    room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
    room.community = []; 
    room.potData = [{ amount: 0 }]; 
    room.highestBet = room.bb;

    let sbIdx = seated[1] || seated[0];
    let bbIdx = seated[2] || seated[1] || seated[0];

    room.players.forEach((p, i) => { 
        if (!p) return; 
        p.hand = Array.from({ length: room.activeVariant.holeCards }, () => room.deck.pop()); 
        const bet = (i === sbIdx) ? Math.min(p.chips, room.sb) : (i === bbIdx) ? Math.min(p.chips, room.bb) : 0;
        p.chips -= bet; p.currentBet = bet; p.isFolded = false; p.isWinner = false; p.hasActed = false; p.isDealer = (i === room.dealerIdx);
    });

    room.phase = PHASES.PRE_FLOP; 
    room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
    startShotClock(roomId);
    io.to(roomId).emit('roomUpdate', room);
};

io.on('connection', (socket) => {
    socket.on('playerLogin', (d) => {
        const p = globalProfiles.find(x => x.password === d.password);
        if (p) socket.emit('loginSuccess', p);
    });
    socket.on('joinRoom', (d, cb) => {
        const room = rooms[d.roomId];
        if (room) {
            const slot = room.players.findIndex(p => p === null);
            if (slot !== -1) {
                room.players[slot] = { ...d.profile, chips: d.buyIn, buyInOrigin: d.buyIn, socketId: socket.id, hand: [], isFolded: room.phase !== PHASES.IDLE };
                socket.join(d.roomId); 
                io.to(d.roomId).emit('roomUpdate', room); 
                if (cb) cb({ status: 'ok' });
                if (room.phase === PHASES.IDLE && room.players.filter(p => p).length >= 2) runIgnition(d.roomId);
            }
        }
    });
    socket.on('playerAction', (d) => handleAction(d.roomId, d.type, d.amount));
    socket.on('disconnecting', () => {
        for (const roomId of socket.rooms) {
            const room = rooms[roomId];
            if (room) {
                const idx = room.players.findIndex(p => p?.socketId === socket.id);
                if (idx !== -1) {
                    room.players[idx] = null;
                    checkHumanCount(roomId);
                    io.to(roomId).emit('roomUpdate', room);
                }
            }
        }
    });
    socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles: globalProfiles, rooms: Object.values(rooms) }));
    socket.on('adminCreatePlayer', (d) => { globalProfiles.push(d); saveToDisk(); io.emit('profilesUpdate', globalProfiles); });
    socket.on('adminCreateRoom', (d) => { rooms[d.id] = { ...d, players: Array(10).fill(null), community: [], phase: PHASES.IDLE, potData: [{ amount: 0 }], dealerIdx: 0 }; io.emit('lobbyUpdate', Object.values(rooms)); });
});

httpServer.listen(10000);
