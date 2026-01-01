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

const saveToDisk = () => {
    try {
        const data = JSON.stringify({ globalProfiles, rooms }, null, 2);
        fs.writeFileSync(DB_PATH, data);
    } catch (err) { console.error("Disk Save Error:", err); }
};

const loadFromDisk = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = JSON.parse(fs.readFileSync(DB_PATH));
            globalProfiles = data.globalProfiles || [];
            rooms = data.rooms || {};
        }
    } catch (err) { console.log("Fresh DB Init"); }
};
loadFromDisk();

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♣', '♥', '♦'];
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const getCombinations = (arr, k) => {
    const fn = (n, src, got, all) => {
        if (n === 0) { all.push(got); return; }
        for (let j = 0; j < src.length; j++) fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
    };
    const all = []; fn(k, arr, [], all); return all;
};

const rankHand = (cards) => {
    const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
    const ranks = sorted.map(c => VM[c.value]);
    const suits = sorted.map(c => c.suit);
    const isFlush = new Set(suits).size === 1;
    let isStraight = true;
    for (let i = 0; i < 4; i++) if (ranks[i] !== ranks[i + 1] + 1) isStraight = false;
    if (!isStraight && JSON.stringify(ranks) === "[14,5,4,3,2]") isStraight = true;
    const counts = {}; ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
    const vc = Object.values(counts).sort((a, b) => b - a);
    let score = 0, name = "High Card";
    if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
    else if (vc[0] === 4) { score = 7; name = "Four of a Kind"; }
    else if (vc[0] === 3 && vc[1] === 2) { score = 6; name = "Full House"; }
    else if (isFlush) { score = 5; name = "Flush"; }
    else if (isStraight) { score = 4; name = "Straight"; }
    else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
    else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
    else if (vc[0] === 2) { score = 1; name = "Pair"; }
    const power = score * 1e10 + ranks.reduce((acc, v, i) => acc + (v * Math.pow(100, 4 - i)), 0);
    return { power, name, cards: sorted };
};

const getBestHand = (hole, comm) => {
    const full = [...hole, ...comm];
    if (full.length < 5) return null;
    const combos = getCombinations(full, 5);
    let best = null;
    combos.forEach(c => {
        const res = rankHand(c);
        if (!best || res.power > best.power) best = res;
    });
    return best;
};

const startShotClock = (roomId) => {
    clearInterval(roomIntervals[roomId]);
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    room.timeRemaining = 30;
    roomIntervals[roomId] = setInterval(() => {
        if (!rooms[roomId]) return clearInterval(roomIntervals[roomId]);
        rooms[roomId].timeRemaining--;
        if (rooms[roomId].timeRemaining <= 0) {
            const p = rooms[roomId].players[rooms[roomId].activeIdx];
            const canCheck = rooms[roomId].highestBet === p.currentBet;
            handleAction(roomId, canCheck ? 'CALL' : 'FOLD', 0);
        } else {
            io.to(roomId).emit('roomUpdate', rooms[roomId]);
        }
    }, 1000);
};

const handleAction = (roomId, type, amount) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    const p = room.players[room.activeIdx];
    if (!p) return;

    p.hasActed = true;
    if (type === 'FOLD') p.isFolded = true;
    else if (type === 'CALL') {
        const diff = room.highestBet - p.currentBet;
        p.chips -= diff; p.currentBet = room.highestBet;
    } else if (type === 'RAISE') {
        const diff = amount - p.currentBet;
        p.chips -= diff; p.currentBet = amount;
        room.highestBet = amount;
        room.players.forEach(op => { if (op && op.uid !== p.uid) op.hasActed = false; });
    }

    const active = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const allMatched = active.every(i => room.players[i].currentBet === room.highestBet || room.players[i].chips === 0);
    const allActed = active.every(i => room.players[i].hasActed || room.players[i].chips === 0);

    if (active.length === 1) processShowdown(roomId);
    else if (allMatched && allActed) advancePhase(roomId);
    else {
        const cur = active.indexOf(room.activeIdx);
        room.activeIdx = active[(cur + 1) % active.length];
        startShotClock(roomId);
    }
};

const advancePhase = (roomId) => {
    const room = rooms[roomId];
    let pot = 0;
    room.players.forEach(p => { if (p) { pot += p.currentBet; p.currentBet = 0; p.hasActed = false; } });
    room.potData[0].amount += pot;
    room.highestBet = 0;

    if (room.phase === PHASES.PRE_FLOP) {
        room.phase = PHASES.FLOP; room.community = [room.deck.pop(), room.deck.pop(), room.deck.pop()];
    } else if (room.phase === PHASES.FLOP) {
        room.phase = PHASES.TURN; room.community.push(room.deck.pop());
    } else if (room.phase === PHASES.TURN) {
        room.phase = PHASES.RIVER; room.community.push(room.deck.pop());
    } else {
        processShowdown(roomId);
        return;
    }

    const active = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const dealerPos = active.indexOf(room.dealerIdx);
    room.activeIdx = active[(dealerPos + 1) % active.length];
    startShotClock(roomId);
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    clearInterval(roomIntervals[roomId]);
    room.phase = PHASES.SHOWDOWN;

    const active = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    let streetPot = 0;
    room.players.forEach(p => { if (p) { streetPot += p.currentBet; p.currentBet = 0; } });
    room.potData[0].amount += streetPot;

    const evals = active.map(i => ({ i, res: getBestHand(room.players[i].hand, room.community) }));
    const isMuflis = room.activeVariant?.id === 'MUFLIS';
    evals.sort((a, b) => isMuflis ? (a.res.power - b.res.power) : (b.res.power - a.res.power));

    const winners = evals.filter(e => e.res.power === evals[0].res.power);
    const share = Math.floor(room.potData[0].amount / winners.length);

    winners.forEach(w => {
        const p = room.players[w.i];
        p.chips += share; p.isWinner = true;
        room.winning5Ids = w.res.cards.map(c => c.id);
    });

    io.to(roomId).emit('roomUpdate', room);
    saveToDisk();

    setTimeout(() => {
        if (!rooms[roomId]) return;
        room.phase = PHASES.IDLE;
        room.community = [];
        room.winning5Ids = [];
        room.players.forEach(p => { if (p) { p.hand = []; p.isWinner = false; p.isFolded = false; p.currentBet = 0; p.hasActed = false; } });
        const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
        if (seated.length >= 2) {
            const dIdx = seated.indexOf(room.dealerIdx);
            room.dealerIdx = seated[(dIdx + 1) % seated.length];
            runIgnition(roomId);
        }
    }, 7000);
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.players.filter(Boolean).length < 2) return;

    const dealer = room.players[room.dealerIdx];
    const variants = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2 };
    const vId = dealer.pendingVariant || 'HOLDEM';
    room.activeVariant = { id: vId, name: vId, holeCards: variants[vId] };

    let deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
    room.deck = deck;
    room.community = [];
    room.potData = [{ amount: 0 }];
    room.highestBet = room.bb;

    const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
    const dIdx = seated.indexOf(room.dealerIdx);
    const sbIdx = seated[(dIdx + 1) % seated.length];
    const bbIdx = seated[(dIdx + 2) % seated.length];

    room.players.forEach((p, i) => {
        if (!p) return;
        p.hand = Array.from({ length: room.activeVariant.holeCards }, () => room.deck.pop());
        const bet = (i === sbIdx) ? room.sb : (i === bbIdx) ? room.bb : 0;
        p.chips -= bet; p.currentBet = bet; p.isFolded = false; p.isWinner = false; p.hasActed = false;
        p.isDealer = (i === room.dealerIdx);
    });

    room.phase = PHASES.PRE_FLOP;
    room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
    startShotClock(roomId);
};

io.on('connection', (socket) => {
    socket.on('playerLogin', (d) => {
        const p = globalProfiles.find(x => x.password === d.password);
        if (p) socket.emit('loginSuccess', p);
        else socket.emit('loginFailure', { message: 'Invalid Login' });
    });

    socket.on('joinRoom', (d, cb) => {
        const room = rooms[d.roomId];
        if (!room) return;
        const slot = room.players.findIndex(p => p === null);
        if (slot !== -1) {
            room.players[slot] = { ...d.profile, chips: d.buyIn, buyInOrigin: d.buyIn, socketId: socket.id, hand: [] };
            if (room.dealerIdx === -1) room.dealerIdx = slot;
            socket.join(d.roomId);
            io.to(d.roomId).emit('roomUpdate', room);
            io.emit('lobbyUpdate', Object.values(rooms));
            if (cb) cb({ status: 'ok' });
            if (room.players.filter(Boolean).length >= 2 && room.phase === PHASES.IDLE) runIgnition(d.roomId);
        }
    });

    socket.on('getInitialData', () => {
        socket.emit('initialDataResponse', { profiles: globalProfiles, rooms: Object.values(rooms) });
    });

    socket.on('adminCreatePlayer', (d, cb) => { globalProfiles.push(d); saveToDisk(); io.emit('profilesUpdate', globalProfiles); if (cb) cb(); });
    socket.on('adminDeletePlayer', (uid) => { globalProfiles = globalProfiles.filter(p => p.uid !== uid); saveToDisk(); io.emit('profilesUpdate', globalProfiles); });
    socket.on('adminEditChips', (d) => { const p = globalProfiles.find(x => x.uid === d.uid); if (p) p.chips = d.chips; saveToDisk(); io.emit('profilesUpdate', globalProfiles); });
    socket.on('adminCreateRoom', (d) => { 
        rooms[d.id] = { ...d, players: Array(10).fill(null), community: [], phase: PHASES.IDLE, potData: [{ amount: 0 }], dealerIdx: -1, activeIdx: -1 }; 
        saveToDisk(); io.emit('lobbyUpdate', Object.values(rooms)); 
    });
    socket.on('adminDeleteRoom', (id) => { delete rooms[id]; saveToDisk(); io.emit('lobbyUpdate', Object.values(rooms)); });

    socket.on('adminAddBot', (d) => {
        const room = rooms[d.roomId];
        const slot = room?.players.findIndex(p => p === null);
        if (slot !== -1) {
            const botVar = ['HOLDEM', 'OMAHA', 'PINEAPPLE', 'MUFLIS'][Math.floor(Math.random()*4)];
            room.players[slot] = { name: "BOT_" + Math.random().toString(36).slice(2, 5).toUpperCase(), uid: 'bot_' + Math.random(), chips: 2000, isBot: true, hand: [], pendingVariant: botVar };
            io.to(d.roomId).emit('roomUpdate', room);
            io.emit('lobbyUpdate', Object.values(rooms));
            if (room.players.filter(Boolean).length >= 2 && room.phase === PHASES.IDLE) runIgnition(d.roomId);
        }
    });

    socket.on('playerAction', (d) => handleAction(d.roomId, d.type, d.amount));
    
    socket.on('updatePlayerSettings', (d) => {
        const p = globalProfiles.find(x => x.uid === d.uid);
        if (p) p.pendingVariant = d.pendingVariant;
        Object.values(rooms).forEach(r => {
            const rp = r.players.find(x => x && x.uid === d.uid);
            if (rp) rp.pendingVariant = d.pendingVariant;
        });
        saveToDisk();
    });

    socket.on('disconnecting', () => {
        for (const roomId of socket.rooms) {
            const room = rooms[roomId];
            if (room) {
                const idx = room.players.findIndex(p => p?.socketId === socket.id);
                if (idx !== -1) {
                    const p = room.players[idx];
                    const prof = globalProfiles.find(x => x.uid === p.uid);
                    if (prof) { prof.chips += (p.chips - p.buyInOrigin); saveToDisk(); io.emit('profilesUpdate', globalProfiles); }
                    room.players[idx] = null;
                    if (room.players.filter(Boolean).length === 0) { room.phase = PHASES.IDLE; clearInterval(roomIntervals[roomId]); }
                    io.to(roomId).emit('roomUpdate', room);
                    io.emit('lobbyUpdate', Object.values(rooms));
                }
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`Server running: ${PORT}`));
