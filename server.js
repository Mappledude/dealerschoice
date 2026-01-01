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

    const power = score * 1e10 + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 4 - i)), 0);
    return { power, name, cards: sorted };
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
    if (variantId === 'OMAHA') {
        if (comm.length < 3) return null;
        combinations(hole, 2).forEach(h => { combinations(comm, 3).forEach(c => { const res = rankHand([...h, ...c]); if (!best || res.power > best.power) best = res; }); });
    } else {
        const full = [...hole, ...comm];
        if (full.length < 5) return null;
        combinations(full, 5).forEach(c => { const res = rankHand(c); if (!best || res.power > best.power) best = res; });
    }
    return best;
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
            const res = getBestHand(p.hand, cr.community, cr.activeVariant?.id);
            const score = res ? res.power / 1e10 : 0;
            let type = 'CALL', amt = 0;
            if (score >= 3) { type = 'RAISE'; amt = cr.highestBet + Math.max(cr.bb, Math.floor(cr.potData[0].amount * 0.4)); }
            else if (score < 1 && (cr.highestBet - p.currentBet) > 100 && Math.random() > 0.2) { type = 'FOLD'; }
            if (type === 'RAISE') amt = Math.min(p.chips + p.currentBet, amt);
            handleAction(roomId, type, amt);
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
            handleAction(roomId, r.highestBet === ap.currentBet ? 'CALL' : 'FOLD', 0);
        } else { io.to(roomId).emit('roomUpdate', r); }
    }, 1000);
};

const handleAction = (roomId, type, amount) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    const p = room.players[room.activeIdx];
    if (!p) return;

    p.hasActed = true;
    if (type === 'FOLD') { p.isFolded = true; }
    else if (type === 'CALL') {
        const diff = Math.min(p.chips, room.highestBet - p.currentBet);
        p.chips -= diff; p.currentBet += diff;
    } else if (type === 'RAISE') {
        const diff = amount - p.currentBet;
        p.chips -= diff; p.currentBet = amount;
        room.highestBet = amount;
        room.players.forEach(op => { if (op && op.uid !== p.uid && op.chips > 0) op.hasActed = false; });
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

const advancePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    let pot = 0;
    room.players.forEach(p => { if (p) { pot += p.currentBet; p.currentBet = 0; p.hasActed = false; } });
    room.potData[0].amount += pot;
    room.highestBet = 0;

    if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = [room.deck.pop(), room.deck.pop(), room.deck.pop()]; }
    else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(room.deck.pop()); }
    else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(room.deck.pop()); }
    else { processShowdown(roomId); return; }
    
    const active = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const withChips = active.filter(i => room.players[i].chips > 0);

    // Update strengths for UI
    room.players.forEach(p => {
        if (p && p.hand?.length > 0 && !p.isFolded) {
            const best = getBestHand(p.hand, room.community, room.activeVariant?.id);
            p.strength = best ? best.name : "High Card";
        }
    });

    if (withChips.length <= 1) {
        // Auto-run to next phase if betting is impossible
        io.to(roomId).emit('roomUpdate', room);
        setTimeout(() => advancePhase(roomId), 1500);
    } else {
        const afterDealer = active.filter(i => i > room.dealerIdx).concat(active.filter(i => i <= room.dealerIdx));
        room.activeIdx = afterDealer[0];
        startShotClock(roomId);
        io.to(roomId).emit('roomUpdate', room);
    }
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    clearInterval(roomIntervals[roomId]);
    room.phase = PHASES.SHOWDOWN;
    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    let streetPot = 0;
    room.players.forEach(p => { if (p) { streetPot += p.currentBet; p.currentBet = 0; } });
    room.potData[0].amount += streetPot;
    const totalPot = room.potData[0].amount;
    
    const evals = activeIndices.map(i => ({ 
        i, 
        res: getBestHand(room.players[i].hand, room.community, room.activeVariant?.id) 
    }));
    
    room.showdownWinners = [];

    if (evals.length === 1 || !evals[0].res) {
        const p = room.players[activeIndices[0]];
        p.chips += totalPot; p.isWinner = true;
        room.showdownWinners.push({ name: p.name, rank: p.strength || "Winner", hand: p.hand, amount: totalPot });
    } else if (room.activeVariant?.id === 'HILOW') {
        evals.sort((a, b) => b.res.power - a.res.power);
        const highWinners = evals.filter(e => e.res.power === evals[0].res.power);
        const lowWinners = [...evals].sort((a,b)=>a.res.power - b.res.power).filter((e,_,arr)=>e.res.power === arr[0].res.power);
        const highShare = Math.floor(totalPot/2/highWinners.length);
        const lowShare = Math.floor(totalPot/2/lowWinners.length);
        highWinners.forEach(w => { room.players[w.i].chips += highShare; room.players[w.i].isWinner = true; room.showdownWinners.push({ name: room.players[w.i].name, rank: w.res.name, hand: w.res.cards, amount: highShare }); });
        lowWinners.forEach(w => { room.players[w.i].chips += lowShare; room.players[w.i].isWinner = true; room.showdownWinners.push({ name: room.players[w.i].name, rank: w.res.name, hand: w.res.cards, amount: lowShare }); });
    } else {
        const isMuflis = room.activeVariant?.id === 'MUFLIS';
        evals.sort((a, b) => isMuflis ? (a.res.power - b.res.power) : (b.res.power - a.res.power));
        const winners = evals.filter(e => e.res.power === evals[0].res.power);
        winners.forEach(w => { 
            const p = room.players[w.i]; 
            p.chips += Math.floor(totalPot/winners.length); 
            p.isWinner = true; 
            room.showdownWinners.push({ name: p.name, rank: w.res.name, hand: w.res.cards, amount: Math.floor(totalPot/winners.length) }); 
        });
    }

    io.to(roomId).emit('roomUpdate', room);
    saveToDisk();

    setTimeout(() => {
        const r = rooms[roomId]; if (!r) return;
        r.phase = PHASES.IDLE; r.community = []; r.showdownWinners = null;
        r.players.forEach((p, i) => { if (p) { p.hand = []; p.isWinner = false; p.isFolded = false; p.currentBet = 0; p.hasActed = false; if (p.chips <= 0) { p.isBust = true; p.rebuyTimeRemaining = 15; startRebuyTimer(roomId, i); } } });
        const seated = r.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) { 
            r.dealerIdx = seated[(seated.indexOf(r.dealerIdx) + 1) % seated.length] || seated[0]; 
            runIgnition(roomId); 
        } else {
            io.to(roomId).emit('roomUpdate', r);
        }
    }, 9000);
};

const startRebuyTimer = (roomId, seatIdx) => {
    const key = `${roomId}-${seatIdx}`;
    clearInterval(rebuyIntervals[key]);
    rebuyIntervals[key] = setInterval(() => {
        const r = rooms[roomId]; if (!r || !r.players[seatIdx]) return clearInterval(rebuyIntervals[key]);
        r.players[seatIdx].rebuyTimeRemaining--;
        if (r.players[seatIdx].rebuyTimeRemaining <= 0) { clearInterval(rebuyIntervals[key]); r.players[seatIdx] = null; io.to(roomId).emit('roomUpdate', r); io.emit('lobbyUpdate', Object.values(rooms)); }
        else io.to(roomId).emit('roomUpdate', r);
    }, 1000);
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    const seated = room?.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null) || [];
    if (seated.length < 2) return;
    if (!room.players[room.dealerIdx]) room.dealerIdx = seated[0];
    const dealer = room.players[room.dealerIdx];
    const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2, HILOW: 2 };
    const variantNames = { HOLDEM: "Hold'em", OMAHA: "OMAHA", PINEAPPLE: "Pineapple", MUFLIS: "Muflis", HILOW: "Hi-Low" };
    const vId = dealer.pendingVariant || 'HOLDEM';
    room.activeVariant = { id: vId, name: variantNames[vId], holeCards: holeCardsMap[vId] };
    room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
    room.community = []; room.potData = [{ amount: 0 }]; room.highestBet = room.bb;
    const sbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
    const bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
    room.players.forEach((p, i) => { if (!p) return; if (p.chips <= 0) { p.isFolded = true; return; } p.hand = Array.from({ length: room.activeVariant.holeCards }, () => room.deck.pop()); const bet = Math.min(p.chips, (i === sbIdx) ? room.sb : (i === bbIdx) ? room.bb : 0); p.chips -= bet; p.currentBet = bet; p.isFolded = false; p.isWinner = false; p.hasActed = false; p.isDealer = (i === room.dealerIdx); p.isSittingOut = false; p.isBust = false; });
    room.phase = PHASES.PRE_FLOP; room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
    startShotClock(roomId);
    io.to(roomId).emit('roomUpdate', room);
};

io.on('connection', (socket) => {
    socket.on('playerLogin', (d) => {
        const p = globalProfiles.find(x => x.password === d.password);
        if (p) socket.emit('loginSuccess', p); else socket.emit('loginFailure', { message: 'Invalid Passcode' });
    });
    socket.on('joinRoom', (d, cb) => {
        const room = rooms[d.roomId];
        if (room) {
            const slot = room.players.findIndex(p => p === null);
            if (slot !== -1) {
                const isMidGame = room.phase !== PHASES.IDLE;
                room.players[slot] = { ...d.profile, chips: d.buyIn, buyInOrigin: d.buyIn, socketId: socket.id, hand: [], strength: "", isFolded: isMidGame, isSittingOut: isMidGame };
                socket.join(d.roomId); io.to(d.roomId).emit('roomUpdate', room); io.emit('lobbyUpdate', Object.values(rooms));
                if (cb) cb({ status: 'ok' });
                if (room.phase === PHASES.IDLE && room.players.filter(p => p).length >= 2) runIgnition(d.roomId);
            }
        }
    });
    socket.on('getInitialData', () => { socket.emit('initialDataResponse', { profiles: globalProfiles, rooms: Object.values(rooms) }); });
    socket.on('adminCreatePlayer', (d, cb) => { globalProfiles.push(d); saveToDisk(); io.emit('profilesUpdate', globalProfiles); if (cb) cb(); });
    socket.on('adminDeletePlayer', (uid) => { globalProfiles = globalProfiles.filter(p => p.uid !== uid); saveToDisk(); io.emit('profilesUpdate', globalProfiles); });
    socket.on('adminEditChips', (d) => { const p = globalProfiles.find(x => x.uid === d.uid); if (p) { p.chips = d.chips; saveToDisk(); io.emit('profilesUpdate', globalProfiles); } });
    socket.on('adminCreateRoom', (d) => { rooms[d.id] = { ...d, players: Array(10).fill(null), community: [], phase: PHASES.IDLE, potData: [{ amount: 0 }], dealerIdx: -1, activeIdx: -1 }; io.emit('lobbyUpdate', Object.values(rooms)); });
    socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms)); });
    socket.on('adminNuclearReset', () => {
        globalProfiles = []; rooms = {};
        Object.keys(roomIntervals).forEach(k => clearInterval(roomIntervals[k]));
        Object.keys(rebuyIntervals).forEach(k => clearInterval(rebuyIntervals[k]));
        roomIntervals = {}; rebuyIntervals = {};
        saveToDisk(); io.emit('profilesUpdate', []); io.emit('lobbyUpdate', []); io.emit('roomUpdate', null);
    });
    socket.on('adminAddChips', (d) => {
        const r = rooms[d.roomId]; const rp = r?.players.find(x => x && x.uid === d.uid); const p = globalProfiles.find(x => x.uid === d.uid);
        if (rp && p && p.chips >= d.chips) { rp.chips += d.chips; rp.buyInOrigin += d.chips; p.chips -= d.chips; rp.isBust = false; clearInterval(rebuyIntervals[`${d.roomId}-${r.players.indexOf(rp)}`]); io.to(d.roomId).emit('roomUpdate', r); io.emit('profilesUpdate', globalProfiles); saveToDisk(); if (r.phase === PHASES.IDLE && r.players.filter(p => p && p.chips > 0).length >= 2) runIgnition(d.roomId); }
    });
    socket.on('playerAction', (d) => handleAction(d.roomId, d.type, d.amount));
    socket.on('disconnecting', () => {
        for (const roomId of socket.rooms) {
            const room = rooms[roomId];
            if (room) {
                const idx = room.players.findIndex(p => p?.socketId === socket.id);
                if (idx !== -1) {
                    if (room.activeIdx === idx && room.phase !== PHASES.IDLE) handleAction(roomId, 'FOLD', 0);
                    const prof = globalProfiles.find(x => x.uid === room.players[idx].uid);
                    if (prof) { prof.chips += (room.players[idx].chips - room.players[idx].buyInOrigin); saveToDisk(); io.emit('profilesUpdate', globalProfiles); }
                    room.players[idx] = null;
                    if (room.players.filter(p => p && !p.isSittingOut).length < 2 && room.phase !== PHASES.IDLE) processShowdown(roomId);
                    io.to(roomId).emit('roomUpdate', room); io.emit('lobbyUpdate', Object.values(rooms));
                }
            }
        }
    });
});
httpServer.listen(10000);
