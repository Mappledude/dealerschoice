import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v1.8.5-ULTRA";
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

let profiles = []; 
let rooms = {};

// --- Helper Utilities ---
const createDeck = () => {
    let deck = [];
    let id = 1;
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ id: id++, suit, value });
        }
    }
    return deck;
};

const shuffle = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
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

// --- Hand Evaluator Engine ---
const rankHand = (cards, isMuflis = false) => {
    if (!cards || cards.length < 5) return { power: 0, name: "Evaluating" };
    const valuesMap = isMuflis ? { ...VM, 'A': 1 } : VM;
    const ranks = cards.map(c => valuesMap[c.value]).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);
    const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
    const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
    const isFlush = new Set(suits).size === 1;
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
    let isStraight = false;
    for (let i = 0; i <= uniqueRanks.length - 5; i++) { if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; break; } }
    if (!isStraight && !isMuflis && uniqueRanks.includes(14) && [5,4,3,2].every(r => uniqueRanks.includes(r))) isStraight = true;
    const vc = groups.map(x => x.c);
    let score = 0, name = "High Card";
    if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
    else if (vc[0] === 4) { score = 7; name = "Four of a Kind"; }
    else if (vc[0] === 3 && vc[1] >= 2) { score = 6; name = "Full House"; }
    else if (isFlush) { score = 5; name = "Flush"; }
    else if (isStraight) { score = 4; name = "Straight"; }
    else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
    else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
    else if (vc[0] === 2) { score = 1; name = "Pair"; }
    const power = score * Math.pow(15, 7) + groups.reduce((acc, g, i) => acc + (g.r * Math.pow(15, 6 - i)), 0);
    return { power, name, cards: cards.slice(0, 5) };
};

const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0) return { high: { power: 0, name: "..." }, low: null };
    const board = comm || [];
    let bestHigh = { power: -1, name: "..." };
    let bestLow = null;

    if (variantId === 'REDSBLACKS') {
        const isRed = (c) => c.suit === '♥' || c.suit === '♦';
        const jokers = [];
        combinations(hole, 3).forEach(p3 => {
            const reds = p3.filter(isRed).length;
            const blacks = p3.length - reds;
            if ((reds === 2 && blacks === 1) || (reds === 1 && blacks === 2)) jokers.push(hole.find(c => !p3.includes(c)));
        });

        if (jokers.length > 0 && board.length >= 3) {
            const boardCombos = combinations(board, 3);
            const deck = createDeck();
            jokers.forEach(pc => { boardCombos.forEach(b3 => { deck.forEach(wild => {
                const res = rankHand([...b3, pc, wild]);
                if (res.power > bestHigh.power) bestHigh = { ...res, isJoker: true };
            }); }); });
        } else if (board.length >= 3) {
            combinations(board, 3).forEach(b3 => { combinations(hole, 2).forEach(h2 => {
                const res = rankHand([...h2, ...b3]);
                if (res.power > bestHigh.power) bestHigh = { ...res, isJoker: false };
            }); });
        }
    } else if (variantId === 'OMAHA' || variantId === 'HILOW') {
        if (board.length >= 3) {
            combinations(board, 3).forEach(b => { combinations(hole, 2).forEach(h => {
                const res = rankHand([...h, ...b]);
                if (res.power > bestHigh.power) bestHigh = res;
                if (variantId === 'HILOW') {
                    const lowRanks = [...new Set([...h, ...b].map(c => VM[c.value]))];
                    if (lowRanks.length === 5 && lowRanks.every(r => r <= 9)) {
                        const lowPower = lowRanks.sort((a,b) => b-a).reduce((acc, r, i) => acc + (r * Math.pow(15, 5-i)), 0);
                        if (!bestLow || lowPower < bestLow.power) bestLow = { power: lowPower, name: "Low Hand", cards: [...h, ...b] };
                    }
                }
            }); });
        }
    } else if (variantId === 'MUFLIS') {
        combinations([...hole, ...board], Math.min(5, hole.length + board.length)).forEach(c => {
            const res = rankHand(c, true);
            if (bestHigh.power === -1 || res.power < bestHigh.power) bestHigh = res;
        });
    } else {
        combinations([...hole, ...board], Math.min(5, hole.length + board.length)).forEach(c => {
            const res = rankHand(c);
            if (res.power > bestHigh.power) bestHigh = res;
        });
    }
    return { high: bestHigh, low: bestLow };
};

const serializeRoom = (room) => {
    if (!room) return null;
    const { deck, ignitionTimer, ...rest } = room;
    return rest;
};

// --- Game Logic Engine ---
const checkAndStartGame = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.phase !== PHASES.IDLE) return;
    const seatedCount = room.players.filter(p => p !== null).length;
    if (seatedCount >= 2 && !room.ignitionTimer) {
        io.to(roomId).emit('log', { name: 'SYSTEM', action: 'MINIMUM PLAYERS DETECTED. AUTO-DEAL IN 5s...', type: 'phase' });
        room.ignitionTimer = setTimeout(() => {
            if (rooms[roomId] && rooms[roomId].players.filter(p => p !== null).length >= 2) startHand(roomId);
            if (rooms[roomId]) rooms[roomId].ignitionTimer = null;
        }, 5000);
    }
};

const startHand = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const dealer = room.players[room.dealerIdx];
    if (dealer && dealer.isBot) {
        const variants = ['HOLDEM', 'OMAHA', 'PINEAPPLE', 'MUFLIS', 'HILOW', 'REDSBLACKS'];
        dealer.pendingVariant = variants[Math.floor(Math.random() * variants.length)];
    }
    room.activeVariant = { id: dealer?.pendingVariant || 'HOLDEM', name: dealer?.pendingVariant || 'HOLDEM' };
    room.deck = shuffle(createDeck());
    room.community = []; room.potAmount = 0; room.highestBet = room.bb; room.phase = PHASES.PRE_FLOP;
    const holeCount = (['OMAHA', 'HILOW', 'REDSBLACKS'].includes(room.activeVariant.id)) ? 4 : (room.activeVariant.id === 'PINEAPPLE' ? 3 : 2);
    room.players.forEach((p, idx) => {
        if (p) {
            p.isFolded = false;
            p.currentBet = (idx === (room.dealerIdx + 1) % 10) ? room.sb : (idx === (room.dealerIdx + 2) % 10 ? room.bb : 0);
            p.chips -= p.currentBet; p.lastAction = null;
            p.hand = Array.from({ length: holeCount }, () => room.deck.pop());
            const evalRes = getBestHand(p.hand, [], room.activeVariant.id);
            p.strength = evalRes.high.name; p.winProbability = 50;
        }
    });
    room.activeIdx = (room.dealerIdx + 3) % 10;
    while (!room.players[room.activeIdx]) room.activeIdx = (room.activeIdx + 1) % 10;
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    io.to(roomId).emit('log', { name: 'SYSTEM', action: `HAND START: ${room.activeVariant.id}`, type: 'phase' });
    if (room.players[room.activeIdx]?.isBot) processBotTurn(roomId);
};

const advancePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players.forEach(p => { if(p) { room.potAmount += p.currentBet; p.currentBet = 0; } });
    room.highestBet = 0;
    if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = [room.deck.pop(), room.deck.pop(), room.deck.pop()]; }
    else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(room.deck.pop()); }
    else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(room.deck.pop()); }
    else { room.phase = PHASES.SHOWDOWN; handleShowdown(roomId); return; }
    room.activeIdx = (room.dealerIdx + 1) % 10;
    while (!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded) room.activeIdx = (room.activeIdx + 1) % 10;
    room.players.forEach(p => {
        if (p && !p.isFolded) {
            const res = getBestHand(p.hand, room.community, room.activeVariant.id);
            p.strength = (res.high.isJoker ? "JOKER: " : "") + res.high.name;
            if (res.low) p.lowStrength = res.low.name;
        }
    });
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    if (room.players[room.activeIdx]?.isBot) processBotTurn(roomId);
};

const handleShowdown = (roomId) => {
    const room = rooms[roomId];
    const active = room.players.filter(p => p && !p.isFolded);
    if (room.activeVariant.id === 'HILOW') {
        let hiWinner = active[0], loWinner = null;
        active.forEach(p => {
            const pEval = getBestHand(p.hand, room.community, 'HILOW');
            const hEval = getBestHand(hiWinner.hand, room.community, 'HILOW');
            if (pEval.high.power > hEval.high.power) hiWinner = p;
            if (pEval.low) if (!loWinner || pEval.low.power < getBestHand(loWinner.hand, room.community, 'HILOW').low.power) loWinner = p;
        });
        const winList = [];
        if (loWinner) {
            const half = room.potAmount / 2; hiWinner.chips += half; loWinner.chips += half;
            winList.push({ name: hiWinner.name, amount: half, rank: "High Hand Winner", hand: getBestHand(hiWinner.hand, room.community, 'HILOW').high.cards });
            winList.push({ name: loWinner.name, amount: half, rank: "Low Hand Winner", hand: getBestHand(loWinner.hand, room.community, 'HILOW').low.cards });
        } else {
            hiWinner.chips += room.potAmount;
            winList.push({ name: hiWinner.name, amount: room.potAmount, rank: "High Sweeps Pot", hand: getBestHand(hiWinner.hand, room.community, 'HILOW').high.cards });
        }
        room.showdownWinners = winList;
    } else {
        let winner = active[0];
        active.forEach(p => {
            const pEval = getBestHand(p.hand, room.community, room.activeVariant.id);
            const wEval = getBestHand(winner.hand, room.community, room.activeVariant.id);
            if (room.activeVariant.id === 'MUFLIS' ? (pEval.high.power < wEval.high.power) : (pEval.high.power > wEval.high.power)) winner = p;
        });
        const res = getBestHand(winner.hand, room.community, room.activeVariant.id);
        winner.chips += room.potAmount;
        room.showdownWinners = [{ name: winner.name, amount: room.potAmount, rank: (res.high.isJoker ? "Joker " : "") + res.high.name, hand: res.high.cards }];
    }
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    setTimeout(() => {
        if (!rooms[roomId]) return;
        room.dealerIdx = (room.dealerIdx + 1) % 10;
        while (!room.players[room.dealerIdx]) room.dealerIdx = (room.dealerIdx + 1) % 10;
        room.phase = PHASES.IDLE; room.showdownWinners = null; startHand(roomId);
    }, 5000);
};

const executeAction = (roomId, uid, type, amount) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    const player = room.players[room.activeIdx];
    if (!player || player.uid !== uid) return;
    player.lastAction = type;
    if (type === 'FOLD') player.isFolded = true;
    else if (type === 'CALL') { const diff = room.highestBet - player.currentBet; player.chips -= diff; player.currentBet += diff; }
    else if (type === 'RAISE') { const added = amount - player.currentBet; player.chips -= added; player.currentBet = amount; if (amount > room.highestBet) room.highestBet = amount; }
    const active = room.players.filter(p => p && !p.isFolded);
    if (active.every(p => p.currentBet === room.highestBet)) advancePhase(roomId);
    else {
        room.activeIdx = (room.activeIdx + 1) % 10;
        while (!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded) room.activeIdx = (room.activeIdx + 1) % 10;
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
        if (room.players[room.activeIdx]?.isBot) processBotTurn(roomId);
    }
};

const processBotTurn = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    const bot = room.players[room.activeIdx];
    if (bot && bot.isBot) {
        setTimeout(() => {
            if (!rooms[roomId] || room.activeIdx === -1) return;
            const toCall = room.highestBet - bot.currentBet;
            executeAction(roomId, bot.uid, toCall > 0 ? 'CALL' : 'CHECK', 0);
        }, 1000);
    }
};

// --- Socket Implementation ---
io.on('connection', (socket) => {
    socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) }));
    socket.on('playerLogin', ({ password }) => {
        const p = profiles.find(x => String(x.password) === String(password));
        if (p) socket.emit('loginSuccess', p); else socket.emit('loginError', "Key Invalid.");
    });
    socket.on('adminCreatePlayer', (p) => {
        profiles.push({ ...p, uid: 'u_'+Math.random().toString(36).slice(2, 9), chips: Number(p.chips), pendingVariant: 'HOLDEM' });
        io.emit('profilesUpdate', profiles);
    });
    socket.on('adminDeletePlayer', (uid) => { profiles = profiles.filter(p => p.uid !== uid); io.emit('profilesUpdate', profiles); });
    socket.on('adminCreateRoom', (d) => {
        const id = 'room_'+Math.random().toString(36).slice(2, 9);
        rooms[id] = { id, name: d.name || "Arena", sb: 0.25, bb: 0.50, players: Array(10).fill(null), phase: PHASES.IDLE, community: [], potAmount: 0, highestBet: 0, activeIdx: -1, dealerIdx: 0, activeVariant: { id: 'HOLDEM' } };
        io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
    });
    socket.on('adminDeleteRoom', (rid) => { delete rooms[rid]; io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); });
    socket.on('adminNuclearReset', () => { rooms = {}; profiles = []; io.emit('lobbyUpdate', []); io.emit('profilesUpdate', []); });
    socket.on('adminAddBot', ({ roomId }) => {
        const room = rooms[roomId]; if (!room) return;
        const s = room.players.findIndex(p => p === null);
        if (s !== -1) {
            room.players[s] = { uid: 'bot_'+Math.random(), name: "BOT_"+(s+1), chips: 100, isBot: true, seatIdx: s, isFolded: false, currentBet: 0, pendingVariant: 'HOLDEM' };
            io.to(roomId).emit('roomUpdate', serializeRoom(room)); checkAndStartGame(roomId);
        }
    });
    socket.on('joinRoom', ({ roomId, profile, buyIn }, cb) => {
        const room = rooms[roomId]; if (!room) return cb({status:'error'});
        const s = room.players.findIndex(p => p === null);
        if (s === -1) return cb({status:'error'});
        room.players[s] = { ...profile, chips: buyIn, seatIdx: s, isFolded: false, currentBet: 0 };
        socket.join(roomId); cb({status:'ok'});
        io.to(roomId).emit('roomUpdate', serializeRoom(room)); checkAndStartGame(roomId);
    });
    socket.on('playerAction', (d) => {
        const r = rooms[d.roomId];
        if (r && r.players[r.activeIdx]) executeAction(d.roomId, r.players[r.activeIdx].uid, d.type, d.amount);
    });
    socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
        profiles.forEach(p => { if(p.uid === uid) p.pendingVariant = pendingVariant; });
        Object.values(rooms).forEach(r => r.players.forEach(p => { if(p && p.uid === uid) p.pendingVariant = pendingVariant; }));
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server v1.8.5-ULTRA ready.`));
