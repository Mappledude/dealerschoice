import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v1.8.2-ULTRA";
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

let profiles = []; 
let rooms = {};

// --- Utilities ---
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

// --- Hand Evaluator ---
const rankHand = (cards) => {
    if (!cards || cards.length < 5) return { power: 0, name: "Evaluating" };
    const ranks = cards.map(c => VM[c.value]).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);
    const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
    const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
    const isFlush = new Set(suits).size === 1;
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
    
    let isStraight = false, straightHigh = 0;
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
    if (!isStraight && uniqueRanks.includes(14) && [5,4,3,2].every(r => uniqueRanks.includes(r))) {
        isStraight = true; straightHigh = 5;
    }

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

    if (variantId === 'HOLDEM' || variantId === 'PINEAPPLE' || variantId === 'MUFLIS' || variantId === 'REDSBLACKS') {
        combinations([...hole, ...board], Math.min(5, hole.length + board.length)).forEach(c => {
            const res = rankHand(c);
            if (variantId === 'MUFLIS') {
                if (bestHigh.power === -1 || res.power < bestHigh.power) bestHigh = res;
            } else {
                if (res.power > bestHigh.power) bestHigh = res;
            }
        });
    } else if (variantId === 'OMAHA' || variantId === 'HILOW') {
        if (board.length >= 3) {
            const boardCombos = combinations(board, 3);
            const holePairs = combinations(hole, 2);
            holePairs.forEach(h => {
                boardCombos.forEach(b => {
                    const res = rankHand([...h, ...b]);
                    if (res.power > bestHigh.power) bestHigh = res;
                    // Low hand (8 or better) for Hi-Low
                    if (variantId === 'HILOW') {
                        const lowRanks = [...new Set([...h, ...b].map(c => VM[c.value]))];
                        if (lowRanks.length === 5 && lowRanks.every(r => r <= 9)) {
                            const lowPower = lowRanks.sort((a,b) => b-a).reduce((acc, r, i) => acc + (r * Math.pow(15, 5-i)), 0);
                            if (!bestLow || lowPower < bestLow.power) bestLow = { power: lowPower, name: "Low Hand", cards: [...h, ...b] };
                        }
                    }
                });
            });
        }
    }
    return { high: bestHigh, low: bestLow };
};

const serializeRoom = (room) => {
    if (!room) return null;
    const { deck, ignitionTimer, ...rest } = room;
    return rest;
};

// --- Game Loop Management ---

const startHand = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    const activePlayers = room.players.filter(p => p !== null);
    if (activePlayers.length < 2) {
        room.phase = PHASES.IDLE;
        return;
    }

    // Dealer's Choice: Set variant based on dealer seat
    const dealer = room.players[room.dealerIdx];
    const nextVariant = dealer?.pendingVariant || 'HOLDEM';
    room.activeVariant = { id: nextVariant, name: nextVariant };

    room.deck = shuffle(createDeck());
    room.community = [];
    room.potAmount = 0;
    room.highestBet = room.bb;
    room.phase = PHASES.PRE_FLOP;

    const cardsToDeal = (nextVariant === 'OMAHA' || nextVariant === 'HILOW') ? 4 : (nextVariant === 'PINEAPPLE' ? 3 : 2);

    room.players.forEach((p, idx) => {
        if (p) {
            p.isFolded = false;
            p.currentBet = (idx === (room.dealerIdx + 1) % 10) ? room.sb : (idx === (room.dealerIdx + 2) % 10 ? room.bb : 0);
            p.chips -= p.currentBet;
            p.lastAction = null;
            p.hand = Array.from({ length: cardsToDeal }, () => room.deck.pop());
            const evalRes = getBestHand(p.hand, [], room.activeVariant.id);
            p.strength = evalRes.high.name;
            p.winProbability = 50;
        }
    });

    room.activeIdx = (room.dealerIdx + 3) % 10;
    while (!room.players[room.activeIdx]) room.activeIdx = (room.activeIdx + 1) % 10;

    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    io.to(roomId).emit('log', { name: 'SYSTEM', action: `${room.activeVariant.id} DEALT`, type: 'phase' });
    
    if (room.players[room.activeIdx].isBot) processBotTurn(roomId);
};

const advancePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    // Collect bets into pot
    room.players.forEach(p => { if(p) { room.potAmount += p.currentBet; p.currentBet = 0; } });
    room.highestBet = 0;

    if (room.phase === PHASES.PRE_FLOP) {
        room.phase = PHASES.FLOP;
        room.community = [room.deck.pop(), room.deck.pop(), room.deck.pop()];
    } else if (room.phase === PHASES.FLOP) {
        room.phase = PHASES.TURN;
        room.community.push(room.deck.pop());
    } else if (room.phase === PHASES.TURN) {
        room.phase = PHASES.RIVER;
        room.community.push(room.deck.pop());
    } else {
        room.phase = PHASES.SHOWDOWN;
        handleShowdown(roomId);
        return;
    }

    // Reset actor to first left of dealer
    room.activeIdx = (room.dealerIdx + 1) % 10;
    while (!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded) room.activeIdx = (room.activeIdx + 1) % 10;

    // Update strengths
    room.players.forEach(p => {
        if (p && !p.isFolded) {
            const res = getBestHand(p.hand, room.community, room.activeVariant.id);
            p.strength = res.high.name;
            if (res.low) p.lowStrength = res.low.name;
        }
    });

    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    if (room.players[room.activeIdx].isBot) processBotTurn(roomId);
};

const handleShowdown = (roomId) => {
    const room = rooms[roomId];
    const active = room.players.filter(p => p && !p.isFolded);
    
    // Simple winner logic for now (High only)
    let winner = active[0];
    active.forEach(p => {
        const pEval = getBestHand(p.hand, room.community, room.activeVariant.id);
        const wEval = getBestHand(winner.hand, room.community, room.activeVariant.id);
        if (pEval.high.power > wEval.high.power) winner = p;
    });

    const winRes = getBestHand(winner.hand, room.community, room.activeVariant.id);
    winner.chips += room.potAmount;
    
    room.showdownWinners = [{ name: winner.name, amount: room.potAmount, rank: winRes.high.name, hand: winRes.high.cards }];
    io.to(roomId).emit('roomUpdate', serializeRoom(room));

    setTimeout(() => {
        room.dealerIdx = (room.dealerIdx + 1) % 10;
        while (!room.players[room.dealerIdx]) room.dealerIdx = (room.dealerIdx + 1) % 10;
        room.phase = PHASES.IDLE;
        room.showdownWinners = null;
        startHand(roomId);
    }, 5000);
};

const executeAction = (roomId, uid, type, amount) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;

    const player = room.players[room.activeIdx];
    if (!player || player.uid !== uid) return;

    player.lastAction = type;
    if (type === 'FOLD') player.isFolded = true;
    else if (type === 'CALL') {
        const diff = room.highestBet - player.currentBet;
        player.chips -= diff;
        player.currentBet += diff;
    } else if (type === 'RAISE') {
        const added = amount - player.currentBet;
        player.chips -= added;
        player.currentBet = amount;
        if (amount > room.highestBet) room.highestBet = amount;
    }

    // Check if round over
    const active = room.players.filter(p => p && !p.isFolded);
    const allMatched = active.every(p => p.currentBet === room.highestBet);
    
    if (allMatched) {
        advancePhase(roomId);
    } else {
        room.activeIdx = (room.activeIdx + 1) % 10;
        while (!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded) room.activeIdx = (room.activeIdx + 1) % 10;
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
        if (room.players[room.activeIdx].isBot) processBotTurn(roomId);
    }
};

const processBotTurn = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players[room.activeIdx];
    if (player && player.isBot) {
        setTimeout(() => {
            const callAmount = room.highestBet - player.currentBet;
            executeAction(roomId, player.uid, callAmount > 0 ? 'CALL' : 'CHECK', 0);
        }, 1000);
    }
};

// --- Socket Interface ---
io.on('connection', (socket) => {
    socket.on('getInitialData', () => {
        socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) });
    });

    socket.on('playerLogin', ({ password }) => {
        const profile = profiles.find(p => String(p.password) === String(password));
        if (profile) socket.emit('loginSuccess', profile);
        else socket.emit('loginError', "Key Invalid.");
    });

    socket.on('adminCreatePlayer', (p) => {
        profiles.push({ ...p, uid: 'u_' + Math.random().toString(36).slice(2, 9), chips: Number(p.chips) });
        io.emit('profilesUpdate', profiles);
    });

    socket.on('adminDeletePlayer', (uid) => {
        profiles = profiles.filter(p => p.uid !== uid);
        io.emit('profilesUpdate', profiles);
    });

    socket.on('adminCreateRoom', (data) => {
        const roomId = data.id || 'room_' + Math.random().toString(36).slice(2, 9);
        rooms[roomId] = { 
            id: roomId, name: data.name || "Arena", sb: 0.25, bb: 0.50, players: Array(10).fill(null), 
            phase: PHASES.IDLE, community: [], potAmount: 0, highestBet: 0, activeIdx: -1, dealerIdx: 0, 
            activeVariant: { id: 'HOLDEM' } 
        };
        io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
    });

    socket.on('adminDeleteRoom', (roomId) => {
        delete rooms[roomId];
        io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
    });

    socket.on('adminNuclearReset', () => {
        rooms = {};
        profiles = [];
        io.emit('lobbyUpdate', []);
        io.emit('profilesUpdate', []);
    });

    socket.on('adminAddBot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const seatIdx = room.players.findIndex(p => p === null);
        if (seatIdx === -1) return;
        room.players[seatIdx] = { uid: 'bot_'+Math.random(), name: "BOT_"+(seatIdx+1), chips: 100, isBot: true, seatIdx, isFolded: false, currentBet: 0 };
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
        if (room.players.filter(p=>p).length >= 2) setTimeout(() => startHand(roomId), 5000);
    });

    socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
        const room = rooms[roomId];
        if (!room) return callback({status:'error'});
        const seatIdx = room.players.findIndex(p => p === null);
        room.players[seatIdx] = { ...profile, chips: buyIn, seatIdx, isFolded: false, currentBet: 0 };
        socket.join(roomId);
        callback({status:'ok'});
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
        if (room.players.filter(p=>p).length >= 2) setTimeout(() => startHand(roomId), 5000);
    });

    socket.on('playerAction', ({ roomId, type, amount }) => {
        const room = rooms[roomId];
        if (room) executeAction(roomId, room.players[room.activeIdx].uid, type, amount);
    });

    socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
        profiles.forEach(p => { if(p.uid === uid) p.pendingVariant = pendingVariant; });
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server ready.`));
