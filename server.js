import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- CONSTANTS ---
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♥', '♦', '♣', '♠'];
const VM = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 3, HILOW: 4, REDSBLACKS: 4 };
const variantNames = { HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple", MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks" };

// --- STATE ---
let profiles = [];
let rooms = {};

// --- UTILS ---
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

// --- HANDLERS ---
io.on('connection', (socket) => {
    socket.on('getInitialData', () => {
        socket.emit('initialDataResponse', { rooms: Object.values(rooms), profiles });
    });

    socket.on('playerLogin', ({ password }) => {
        const p = profiles.find(x => x.password === password);
        if (p) socket.emit('loginSuccess', p);
    });

    // ADMIN HANDLERS
    socket.on('adminCreatePlayer', (data) => {
        profiles.push({ ...data, chips: Number(data.chips) });
        io.emit('profilesUpdate', profiles);
    });

    socket.on('adminDeletePlayer', (uid) => {
        profiles = profiles.filter(p => p.uid !== uid);
        io.emit('profilesUpdate', profiles);
    });

    socket.on('adminEditChips', ({ uid, chips }) => {
        const p = profiles.find(x => x.uid === uid);
        if (p) p.chips = Number(chips);
        io.emit('profilesUpdate', profiles);
    });

    socket.on('adminCreateRoom', (data) => {
        const newRoom = { 
            ...data, 
            players: Array(TOTAL_SEATS).fill(null), 
            phase: PHASES.IDLE, community: [], potData: [{amount: 0}], dealerIdx: 0 
        };
        rooms[data.id] = newRoom;
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('adminDeleteRoom', (id) => {
        delete rooms[id];
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('adminNuclearReset', () => {
        rooms = {}; profiles = [];
        io.emit('lobbyUpdate', []);
        io.emit('profilesUpdate', []);
    });
});

server.listen(10000, () => {
    console.log(`Dealers Choice v0.1 running on port 10000`);
});
