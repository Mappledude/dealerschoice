import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v0.1.7";
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const BOT_NAMES = ["Ace_Bot", "Sharky", "BluffMaster", "Foldy", "Annie_AllIn", "Checky", "GambleTron", "Moneymaker"];

let profiles = []; 
let rooms = {};

// --- POKER ENGINE UTILS ---
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
    const groups = Object.entries(counts).map(([r, c]) => ({ r: parseInt(r), c })).sort((a, b) => b.c - a.c || b.r - a.r);
    const vc = groups.map(x => x.c);
    const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
    const uniqueRanks = [...new Set(ranks)].sort((a,b) => b-a);
    let isStraight = false, straightHigh = 0;
    for(let i=0; i <= uniqueRanks.length - 5; i++) {
        if(uniqueRanks[i] === uniqueRanks[i+4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
    if(!isStraight && uniqueRanks.includes(14) && uniqueRanks.slice(-4).join(',') === '5,4,3,2') { isStraight = true; straightHigh = 5; }
    
    let score = 0, name = "High Card";
    if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
    else if (vc[0] === 4) { score = 7; name = "Four of a Kind"; }
    else if (vc[0] === 3 && vc[1] === 2) { score = 6; name = "Full House"; }
    else if (isFlush) { score = 5; name = "Flush"; }
    else if (isStraight) { score = 4; name = "Straight"; }
    else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
    else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
    else if (vc[0] === 2) { score = 1; name = "Pair"; }

    const power = score * Math.pow(15, 7) + groups.reduce((acc, g, i) => acc + (g.r * Math.pow(15, 6 - i)), 0);
    return { power, name, cards: sorted.slice(0, 5) };
};

const getBestHand = (hole, comm) => {
    const fullPool = [...hole, ...comm];
    let best = { power: 0, name: "High Card", cards: [] };
    combinations(fullPool, Math.min(fullPool.length, 5)).forEach(combo => {
        const res = rankHand(combo);
        if (res.power > best.power) best = res;
    });
    return best;
};

// --- GAME STATE TRANSITIONS ---

const checkStart = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.phase !== PHASES.IDLE) return;
    const seated = room.players.filter(p => p !== null);
    if (seated.length >= 2) {
        if (room.startTimer) return;
        io.to(roomId).emit('log', { name: "SYSTEM", action: "Game starting in 3s...", type: 'phase' });
        room.startTimer = setTimeout(() => {
            if (room.players.filter(p => p !== null).length >= 2) runIgnition(roomId);
            room.startTimer = null;
        }, 3000);
    }
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const seatedIdx = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
    
    room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
    room.community = [];
    room.potData = [{ amount: 0 }];
    room.phase = PHASES.PRE_FLOP;
    room.highestBet = room.bb;
    room.dealerIdx = seatedIdx[(seatedIdx.indexOf(room.dealerIdx || seatedIdx[0]) + 1) % seatedIdx.length];

    const sbIdx = seatedIdx[(seatedIdx.indexOf(room.dealerIdx) + 1) % seatedIdx.length];
    const bbIdx = seatedIdx[(seatedIdx.indexOf(room.dealerIdx) + 2) % seatedIdx.length];

    room.players.forEach((p, i) => {
        if (!p) return;
        p.hand = room.deck.splice(0, 2);
        p.currentBet = 0;
        p.isFolded = false;
        p.isWinner = false;
        p.lastAction = null;
        if (i === sbIdx) { p.chips -= room.sb; p.currentBet = room.sb; }
        if (i === bbIdx) { p.chips -= room.bb; p.currentBet = room.bb; }
    });

    room.activeIdx = seatedIdx[(seatedIdx.indexOf(bbIdx) + 1) % seatedIdx.length];
    broadcastRoom(roomId);
    checkBotAction(roomId);
};

const nextPhase = (roomId) => {
    const room = rooms[roomId];
    // Collect bets into pot
    const roundBets = room.players.reduce((acc, p) => acc + (p?.currentBet || 0), 0);
    room.potData[0].amount += roundBets;
    room.players.forEach(p => { if (p) p.currentBet = 0; p.lastAction = null; });
    room.highestBet = 0;

    if (room.phase === PHASES.PRE_FLOP) {
        room.phase = PHASES.FLOP;
        room.community = room.deck.splice(0, 3);
    } else if (room.phase === PHASES.FLOP) {
        room.phase = PHASES.TURN;
        room.community.push(...room.deck.splice(0, 1));
    } else if (room.phase === PHASES.TURN) {
        room.phase = PHASES.RIVER;
        room.community.push(...room.deck.splice(0, 1));
    } else {
        return showdown(roomId);
    }

    const seatedIdx = room.players.map((p, i) => p && !p.isFolded ? i : null).filter(x => x !== null);
    room.activeIdx = seatedIdx[(seatedIdx.indexOf(room.dealerIdx) + 1) % seatedIdx.length] || seatedIdx[0];
    
    broadcastRoom(roomId);
    checkBotAction(roomId);
};

const showdown = (roomId) => {
    const room = rooms[roomId];
    room.phase = PHASES.SHOWDOWN;
    const active = room.players.filter(p => p && !p.isFolded);
    const results = active.map(p => ({
        uid: p.uid,
        name: p.name,
        hand: p.hand,
        res: getBestHand(p.hand, room.community)
    })).sort((a, b) => b.res.power - a.res.power);

    const winner = results[0];
    const winPlayer = room.players.find(p => p?.uid === winner.uid);
    winPlayer.chips += room.potData[0].amount;
    winPlayer.isWinner = true;
    room.winning5Ids = winner.res.cards.map(c => c.id);
    room.showdownWinners = [{ name: winner.name, rank: winner.res.name, amount: room.potData[0].amount, hand: winner.hand }];

    io.to(roomId).emit('log', { name: winner.name, action: `wins $${room.potData[0].amount} with ${winner.res.name}`, type: 'win' });
    broadcastRoom(roomId);

    setTimeout(() => {
        room.phase = PHASES.IDLE;
        broadcastRoom(roomId);
        checkStart(roomId);
    }, 8000);
};

const checkBotAction = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1 || room.phase === PHASES.SHOWDOWN) return;
    const p = room.players[room.activeIdx];
    if (p && p.isBot) {
        setTimeout(() => processAction(roomId, room.activeIdx, room.highestBet > p.currentBet ? 'CALL' : 'CALL', 0), 1500);
    }
};

const processAction = (roomId, playerIdx, type, amount) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx !== playerIdx) return;

    const p = room.players[playerIdx];
    if (type === 'FOLD') {
        p.isFolded = true;
        p.lastAction = 'FOLD';
    } else {
        const callAmt = room.highestBet - p.currentBet;
        const actual = Math.min(p.chips, callAmt);
        p.chips -= actual;
        p.currentBet += actual;
        p.lastAction = actual > 0 ? 'CALL' : 'CHECK';
    }

    // Check if betting round over
    const active = room.players.filter(p => p && !p.isFolded);
    if (active.length === 1) return showdown(roomId);

    const allMatched = active.every(p => p.currentBet === room.highestBet && p.lastAction !== null);
    
    if (allMatched) {
        nextPhase(roomId);
    } else {
        const seated = room.players.map((pl, i) => (pl && !pl.isFolded) ? i : null).filter(x => x !== null);
        const next = seated[(seated.indexOf(room.activeIdx) + 1) % seated.length];
        room.activeIdx = next;
        broadcastRoom(roomId);
        checkBotAction(roomId);
    }
};

const broadcastRoom = (roomId) => {
    const room = rooms[roomId];
    if (room) {
        room.players.forEach(p => {
            if (p && !p.isFolded && room.community.length > 0) {
                p.strength = getBestHand(p.hand, room.community).name;
            }
        });
        io.to(roomId).emit('roomUpdate', room);
    }
};

// --- CORE SOCKET LISTENERS ---
io.on('connection', (socket) => {
    socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms) }));

    socket.on('playerLogin', ({ password }) => {
        let p = profiles.find(x => x.password === password);
        if (!p && password) {
            p = { uid: 'u_' + Math.random().toString(36).slice(2, 7), name: `Player_${password}`, password, chips: 5000, pendingVariant: 'HOLDEM' };
            profiles.push(p);
            io.emit('profilesUpdate', profiles);
        }
        if (p) socket.emit('loginSuccess', p);
    });

    socket.on('adminCreateRoom', (config) => {
        const id = config.id || 'r_' + Math.random().toString(36).slice(2, 7);
        rooms[id] = { ...config, id, players: Array(10).fill(null), community: [], potData: [{ amount: 0 }], phase: PHASES.IDLE, highestBet: 0, dealerIdx: 0, activeIdx: -1 };
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
        const room = rooms[roomId];
        const seat = room?.players.findIndex(p => p === null);
        if (!room || seat === -1) return callback?.({ status: 'error' });
        room.players[seat] = { ...profile, chips: buyIn, currentBet: 0, isFolded: false, seatIdx: seat };
        socket.join(roomId);
        callback?.({ status: 'ok' });
        broadcastRoom(roomId);
        checkStart(roomId);
    });

    socket.on('playerAction', ({ roomId, type, amount }) => {
        const room = rooms[roomId];
        if (room) processAction(roomId, room.activeIdx, type, amount);
    });

    socket.on('adminAddBot', ({ roomId }) => {
        const room = rooms[roomId];
        const seat = room?.players.findIndex(p => p === null);
        if (!room || seat === -1) return;
        room.players[seat] = { uid: 'b_'+Math.random().toString(36).slice(2,5), name: BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)], chips: 2000, currentBet: 0, isFolded: false, isBot: true, seatIdx: seat };
        broadcastRoom(roomId);
        checkStart(roomId);
    });
    
    socket.on('adminNuclearReset', () => { rooms = {}; profiles = []; io.emit('lobbyUpdate', []); io.emit('profilesUpdate', []); });
});

server.listen(process.env.PORT || 10000, () => console.log(`${VERSION} Online`));
