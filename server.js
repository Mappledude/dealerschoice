import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- CONSTANTS ---
const TOTAL_SEATS = 10;
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♥', '♦', '♣', '♠'];
const VM = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 3, HILOW: 4, REDSBLACKS: 4 };
const variantNames = { HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple", MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks" };

// --- STATE ---
let profiles = [];
let rooms = {};

// --- HAND RANKING ENGINE (v0.1 Precision) ---
const combinations = (array, k) => {
    let result = [];
    const fn = (start, prev) => {
        if (prev.length === k) { result.push(prev); return; }
        for (let i = start; i < array.length; i++) { fn(i + 1, [...prev, array[i]]); }
    };
    fn(0, []);
    return result;
};

const rankHand = (cards) => {
    if (!cards || cards.length < 5) return { power: 0, name: "High Card", cards: [] };
    const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
    const ranks = sorted.map(c => VM[c.value]);
    const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
    const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
    let compArr = []; groups.forEach(g => { for(let i=0; i<g.c; i++) compArr.push(g.r); });
    const vc = groups.map(x => x.c);
    const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
    const uniqueRanks = [...new Set(ranks)].sort((a,b) => b-a);
    let isStraight = false;
    for(let i=0; i <= uniqueRanks.length - 5; i++) { if(uniqueRanks[i] === uniqueRanks[i+4] + 4) { isStraight = true; break; } }
    if(!isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(5) && uniqueRanks.includes(4) && uniqueRanks.includes(3) && uniqueRanks.includes(2)) { isStraight = true; compArr = [5, 4, 3, 2, 1]; }
    let score = 0, name = "High Card";
    if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
    else if (vc[0] === 4) { score = 7; name = "Four of a Kind"; }
    else if (vc[0] === 3 && vc[1] === 2) { score = 6; name = "Full House"; }
    else if (isFlush) { score = 5; name = "Flush"; }
    else if (isStraight) { score = 4; name = "Straight"; }
    else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
    else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
    else if (vc[0] === 2) { score = 1; name = "Pair"; }
    const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
    return { power, name, cards: sorted.slice(0, 5) };
};

const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0) return null;
    if (variantId === 'REDSBLACKS') {
        const isRed = (s) => s === '♥' || s === '♦';
        const evals = [];
        for (let i = 0; i < hole.length; i++) {
            const card4 = hole[i];
            const others = hole.filter((_, idx) => idx !== i);
            const oReds = others.filter(c => isRed(c.suit)).length;
            if (oReds > 0 && (others.length - oReds) > 0) {
                if (comm.length === 0) {
                    const p = 1 * Math.pow(15, 7) + VM[card4.value] * Math.pow(15, 6);
                    evals.push({ power: p, name: `Pair of ${card4.value}s`, cards: [card4, card4] });
                } else {
                    combinations(comm, Math.min(comm.length, 3)).forEach(boardSet => {
                        const wild = { ...card4, id: 'wild-joker' };
                        evals.push(rankHand([...boardSet, card4, wild]));
                    });
                }
            }
        }
        if (evals.length === 0) {
            combinations(hole, 2).forEach(h => {
                combinations(comm, Math.min(comm.length, 3)).forEach(c => {
                    const pool = [...h, ...c];
                    while(pool.length < 5) pool.push({value: '2', suit: '♠', id: 'filler'});
                    evals.push(rankHand(pool));
                });
            });
        }
        return evals.sort((a,b) => b.power - a.power)[0];
    }
    const full = [...hole, ...comm];
    let best = null;
    combinations(full, Math.min(full.length, 5)).forEach(c => {
        const res = rankHand(c);
        if (variantId === 'MUFLIS') { if (!best || res.power < best.power) best = res; }
        else { if (!best || res.power > best.power) best = res; }
    });
    return best;
};

const nextPhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.phase === PHASES.PRE_FLOP) {
        room.phase = PHASES.FLOP;
        room.community = room.deck.splice(0, 3);
    } else if (room.phase === PHASES.FLOP) {
        room.phase = PHASES.TURN;
        room.community.push(...room.deck.splice(0, 1));
    } else if (room.phase === PHASES.TURN) {
        room.phase = PHASES.RIVER;
        room.community.push(...room.deck.splice(0, 1));
    } else if (room.phase === PHASES.RIVER) {
        processShowdown(roomId);
        return;
    }
    room.highestBet = 0;
    room.players.forEach(p => { if(p) p.currentBet = 0; });
    io.to(roomId).emit('roomUpdate', room);
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const active = room.players.filter(p => p && !p.isFolded);
    if (active.length === 0) return;
    const evals = active.map(p => ({ idx: room.players.indexOf(p), res: getBestHand(p.hand, room.community, room.activeVariant?.id) }));
    let winPower = Math.max(...evals.map(e => e.res.power));
    let winners = evals.filter(e => e.res.power === winPower);
    let share = Math.floor(room.potData[0].amount / winners.length);
    room.showdownWinners = winners.map(w => {
        const p = room.players[w.idx]; p.chips += share; p.isWinner = true;
        io.to(roomId).emit('log', { name: p.name, action: `wins $${share} with ${w.res.name}`, type: 'win', cards: w.res.cards });
        return { name: p.name, rank: w.res.name, hand: w.res.cards, amount: share };
    });
    room.phase = PHASES.SHOWDOWN;
    io.to(roomId).emit('roomUpdate', room);
    setTimeout(() => {
        const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) { room.dealerIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length]; runIgnition(roomId); }
        else { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', room); }
    }, 8000);
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
    if (seated.length < 2) return;
    const dealer = room.players[room.dealerIdx] || room.players[seated[0]];
    const vId = dealer.pendingVariant || 'HOLDEM';
    room.activeVariant = { id: vId, name: variantNames[vId] };
    io.to(roomId).emit('log', { name: dealer.name, action: `deals ${variantNames[vId]}`, type: 'variant' });
    room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: Math.random().toString(), value: v, suit: s }))).sort(() => Math.random() - 0.5);
    room.community = []; room.potData = [{ amount: 0 }]; room.phase = PHASES.PRE_FLOP;
    room.players.forEach(p => { if (p) { p.hand = room.deck.splice(0, holeCardsMap[vId] || 2); p.isFolded = false; p.isWinner = false; p.currentBet = 0; } });
    const sbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
    const bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
    room.players[sbIdx].chips -= room.sb; room.players[sbIdx].currentBet = room.sb;
    room.players[bbIdx].chips -= room.bb; room.players[bbIdx].currentBet = room.bb;
    room.potData[0].amount = room.sb + room.bb; room.highestBet = room.bb;
    room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
    io.to(roomId).emit('roomUpdate', room);
};

// --- HANDLERS ---
io.on('connection', (socket) => {
    socket.on('getInitialData', () => { socket.emit('initialDataResponse', { rooms: Object.values(rooms), profiles }); });
    socket.on('playerLogin', ({ password }) => {
        const p = profiles.find(x => x.password === password);
        if (p) socket.emit('loginSuccess', p);
    });
    socket.on('adminCreatePlayer', (data) => {
        const exists = profiles.find(p => p.name === data.name);
        if (!exists) { profiles.push({ ...data, chips: Number(data.chips || 10) }); io.emit('profilesUpdate', profiles); io.emit('initialDataResponse', { rooms: Object.values(rooms), profiles }); }
    });
    socket.on('adminDeletePlayer', (uid) => { profiles = profiles.filter(p => p.uid !== uid); io.emit('profilesUpdate', profiles); io.emit('initialDataResponse', { rooms: Object.values(rooms), profiles }); });
    socket.on('adminCreateRoom', (data) => {
        rooms[data.id] = { ...data, players: Array(TOTAL_SEATS).fill(null), phase: PHASES.IDLE, community: [], potData: [{amount: 0}], dealerIdx: 0, highestBet: 0.50, timeRemaining: 30 };
        io.emit('lobbyUpdate', Object.values(rooms)); io.emit('initialDataResponse', { rooms: Object.values(rooms), profiles });
    });
    socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms)); io.emit('initialDataResponse', { rooms: Object.values(rooms), profiles }); });
    socket.on('adminNuclearReset', () => { rooms = {}; profiles = []; io.emit('lobbyUpdate', []); io.emit('profilesUpdate', []); io.emit('initialDataResponse', { rooms: [], profiles: [] }); });
    socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
        const room = rooms[roomId]; if (!room) return callback({ status: 'error' });
        const seatIdx = room.players.findIndex(p => p === null); if (seatIdx === -1) return callback({ status: 'error' });
        room.players[seatIdx] = { ...profile, chips: Number(buyIn), currentBet: 0, isFolded: false, hand: [] };
        socket.join(roomId); if (room.players.filter(Boolean).length === 2 && room.phase === PHASES.IDLE) runIgnition(roomId);
        io.to(roomId).emit('roomUpdate', room); callback({ status: 'ok' });
    });
    socket.on('playerAction', ({ roomId, type, amount }) => {
        const room = rooms[roomId]; if (!room) return;
        const player = room.players[room.activeIdx];
        if (type === 'FOLD') player.isFolded = true;
        if (type === 'CALL') { const diff = room.highestBet - player.currentBet; player.chips -= diff; player.currentBet += diff; room.potData[0].amount += diff; }
        if (type === 'RAISE') { const diff = amount - player.currentBet; player.chips -= diff; player.currentBet = amount; room.potData[0].amount += diff; room.highestBet = amount; }
        const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
        const active = room.players.filter(p => p && !p.isFolded);
        if (active.length === 1) processShowdown(roomId);
        else {
            const nextIdx = seated[(seated.indexOf(room.activeIdx) + 1) % seated.length]; room.activeIdx = nextIdx;
            if (room.players.every(p => !p || p.isFolded || p.currentBet === room.highestBet)) nextPhase(roomId);
            else io.to(roomId).emit('roomUpdate', room);
        }
    });
});

server.listen(10000, () => { console.log(`Dealers Choice v0.1 running on port 10000`); });
