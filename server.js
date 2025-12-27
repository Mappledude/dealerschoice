import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());

const httpServer = createServer(app);
// --- CORS & ORIGIN LOCKDOWN (v1.2.2 Production) ---
const io = new Server(httpServer, {
    cors: { 
        origin: true, 
        methods: ["GET", "POST"],
        credentials: true 
    },
    transports: ['websocket', 'polling']
});

// --- PERSISTENCE ENGINE (Render Persistent Volume) ---
const DB_DIR = './data';
const DB_PATH = path.join(DB_DIR, 'poker_db.json');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

let globalProfiles = []; 
let rooms = {}; 
let roomIntervals = {}; 

const saveToDisk = () => {
    try {
        const data = JSON.stringify({ globalProfiles, rooms }, null, 2);
        fs.writeFileSync(DB_PATH, data);
    } catch (err) {
        console.error("Persistence Error:", err);
    }
};

const loadFromDisk = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH);
            const data = JSON.parse(raw);
            globalProfiles = data.globalProfiles || [];
            rooms = data.rooms || {};
            console.log("Database Hydrated from Persistent Volume.");
        } else {
            console.log("Initializing fresh production database.");
            saveToDisk();
        }
    } catch (err) {
        console.error("Hydration Error:", err);
    }
};

loadFromDisk();

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♣', '♥', '♦'];
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

// --- AUTHORITATIVE POKER EVALUATOR ---

const getCombinations = (arr, k) => {
    const fn = (n, src, got, all) => {
        if (n === 0) { all.push(got); return; }
        for (let j = 0; j < src.length; j++) {
            fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
        }
    };
    const all = [];
    fn(k, arr, [], all);
    return all;
};

const rankFiveCardHand = (cards) => {
    const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
    const ranks = sorted.map(c => VM[c.value]);
    const suits = sorted.map(c => c.suit);
    const isFlush = new Set(suits).size === 1;
    
    let isStraight = true;
    for (let i = 0; i < 4; i++) if (ranks[i] !== ranks[i + 1] + 1) isStraight = false;
    if (!isStraight && JSON.stringify(ranks) === JSON.stringify([14, 5, 4, 3, 2])) isStraight = true;

    const counts = {}; 
    ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
    const valCounts = Object.entries(counts)
        .map(([rank, count]) => ({ rank: parseInt(rank), count }))
        .sort((a, b) => b.count - a.count || b.rank - a.rank);

    let score = 0, name = "High Card";
    if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
    else if (valCounts[0].count === 4) { score = 7; name = "Four of a Kind"; }
    else if (valCounts[0].count === 3 && valCounts[1].count === 2) { score = 6; name = "Full House"; }
    else if (isFlush) { score = 5; name = "Flush"; }
    else if (isStraight) { score = 4; name = "Straight"; }
    else if (valCounts[0].count === 3) { score = 3; name = "Three of a Kind"; }
    else if (valCounts[0].count === 2 && valCounts[1].count === 2) { score = 2; name = "Two Pair"; }
    else if (valCounts[0].count === 2) { score = 1; name = "Pair"; }

    const power = score * 1e10 + valCounts.reduce((acc, v, i) => acc + (v.rank * Math.pow(100, 4 - i)), 0);
    const cardString = sorted.map(c => c.value).join('-');
    
    let summary = name;
    if (score === 1) summary = `Pair of ${sorted.find(c => counts[VM[c.value]] === 2).value}'s`;
    if (score === 6) summary = `Full House, ${sorted.find(c => counts[VM[c.value]] === 3).value}'s over ${sorted.find(c => counts[VM[c.value]] === 2).value}'s`;

    return { power, name, summary, cardString, cards: sorted };
};

const getBestHand = (holeCards, community) => {
    if (!holeCards || !Array.isArray(holeCards) || holeCards.length === 0) return null;
    const fullPool = [...holeCards, ...community];
    if (fullPool.length < 5) return null;
    const combos = getCombinations(fullPool, 5);
    let best = null;
    combos.forEach(combo => {
        const result = rankFiveCardHand(combo);
        if (!best || result.power > best.power) best = result;
    });
    return best;
};

// --- GAME LOGIC HELPERS ---

const clearShotClock = (roomId) => {
    if (roomIntervals[roomId]) {
        clearInterval(roomIntervals[roomId]);
        delete roomIntervals[roomId];
    }
};

const startShotClock = (roomId) => {
    clearShotClock(roomId);
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;

    room.timeRemaining = 30;
    roomIntervals[roomId] = setInterval(() => {
        const r = rooms[roomId];
        if (!r || r.activeIdx === -1) { clearShotClock(roomId); return; }
        r.timeRemaining -= 1;
        if (r.timeRemaining <= 0) {
            clearShotClock(roomId);
            const p = r.players[r.activeIdx];
            const canCheck = r.highestBet === p.currentBet;
            io.to(roomId).emit('log', { action: `${p.name} timed out and was auto-${canCheck ? 'checked' : 'folded'}`, type: 'system' });
            handleAction(roomId, canCheck ? 'CALL' : 'FOLD', 0);
        } else {
            io.to(roomId).emit('roomUpdate', r);
        }
    }, 1000);
};

const collectBets = (room) => {
    let streetPot = 0;
    room.players.forEach(p => { if (p) { streetPot += p.currentBet; p.currentBet = 0; p.hasActed = false; } });
    if (!room.potData) room.potData = [{ amount: 0 }];
    room.potData[0].amount += streetPot;
    room.highestBet = 0;
    saveToDisk();
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    clearShotClock(roomId);
    room.phase = PHASES.SHOWDOWN;
    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    
    const evals = activeIndices.map(i => ({ 
        index: i, 
        best: getBestHand(room.players[i].hand, room.community) 
    })).filter(e => e.best !== null);
    
    if (!evals || evals.length === 0) {
        room.phase = PHASES.IDLE;
        io.to(roomId).emit('roomUpdate', room);
        return;
    }
    
    const isMuflis = room.activeVariant?.id === 'MUFLIS';
    evals.sort((a, b) => isMuflis ? (a.best.power - b.best.power) : (b.best.power - a.best.power));
    
    const targetPower = evals[0].best.power;
    const winners = evals.filter(e => e.best.power === targetPower);
    
    collectBets(room);
    const totalPot = room.potData[0].amount;
    const share = Math.floor(totalPot / winners.length);

    winners.forEach(w => {
        const p = room.players[w.index];
        p.isWinner = true;
        p.chips += share;
        
        if (!p.isBot) {
            const profile = globalProfiles.find(prof => prof.uid === p.uid);
            if (profile) profile.chips += (p.chips - p.buyInOrigin);
            p.buyInOrigin = p.chips; 
        }
    });

    room.winning5Ids = winners[0].best.cards.map(c => c.id);
    room.winningPlayerIndices = winners.map(w => w.index);

    winners.forEach(w => {
        io.to(roomId).emit('log', { 
            action: `${room.players[w.index].name} wins $${share} with ${w.best.summary} (${w.best.cardString}).`, 
            type: 'win' 
        });
    });

    io.emit('profilesUpdate', globalProfiles);
    io.to(roomId).emit('roomUpdate', room);
    saveToDisk();

    setTimeout(() => {
        if (!rooms[roomId]) return;
        room.phase = PHASES.IDLE;
        room.community = [];
        room.winning5Ids = [];
        room.winningPlayerIndices = [];
        room.players.forEach(p => { if (p) { p.hand = []; p.isWinner = false; p.isFolded = false; p.currentBet = 0; p.hasActed = false; p.isAllIn = false; } });
        const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
        if (seated.length > 0) {
            const dPos = seated.indexOf(room.dealerIdx);
            room.dealerIdx = seated[(dPos + 1) % seated.length];
        }
        io.to(roomId).emit('roomUpdate', room);
        saveToDisk();
        setTimeout(() => runIgnition(roomId), 3000);
    }, 6000);
};

const handleAction = (roomId, type, amount) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    const player = room.players[room.activeIdx];
    player.hasActed = true;
    clearShotClock(roomId);
    
    if (type === 'FOLD') { 
        player.isFolded = true; 
    } else if (type === 'CALL') {
        const diff = room.highestBet - player.currentBet;
        if (diff >= player.chips) {
            player.currentBet += player.chips;
            player.chips = 0;
            player.isAllIn = true;
        } else {
            player.chips -= diff;
            player.currentBet = room.highestBet;
        }
    } else if (type === 'RAISE') {
        const targetAmount = Math.max(amount, room.highestBet + room.bb);
        const diff = targetAmount - player.currentBet;
        if (diff >= player.chips) {
            player.currentBet += player.chips;
            player.chips = 0;
            player.isAllIn = true;
            if (player.currentBet > room.highestBet) room.highestBet = player.currentBet;
        } else {
            player.chips -= diff;
            player.currentBet = targetAmount;
            room.highestBet = targetAmount;
        }
        room.players.forEach(p => { if (p && p.uid !== player.uid && !p.isAllIn) p.hasActed = false; });
    }

    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const allActed = activeIndices.every(i => room.players[i].hasActed || room.players[i].isAllIn);
    const allMatched = activeIndices.every(i => room.players[i].currentBet === room.highestBet || room.players[i].isAllIn);

    if (activeIndices.length === 1) { processShowdown(roomId); }
    else if (allActed && allMatched) { advancePhase(roomId); }
    else {
        const currentPos = activeIndices.indexOf(room.activeIdx);
        room.activeIdx = activeIndices[(currentPos + 1) % activeIndices.length];
        io.to(roomId).emit('roomUpdate', room);
        startShotClock(roomId);
    }
    saveToDisk();
};

const advancePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    collectBets(room);
    const deck = room.deck;
    if (room.phase === PHASES.PRE_FLOP) {
        room.phase = PHASES.FLOP;
        room.community = [deck.pop(), deck.pop(), deck.pop()];
    } else if (room.phase === PHASES.FLOP) {
        room.phase = PHASES.TURN;
        room.community.push(deck.pop());
    } else if (room.phase === PHASES.TURN) {
        room.phase = PHASES.RIVER;
        room.community.push(deck.pop());
    } else {
        processShowdown(roomId);
        return;
    }
    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const dealerPos = activeIndices.indexOf(room.dealerIdx);
    room.activeIdx = activeIndices[(dealerPos + 1) % activeIndices.length];
    io.to(roomId).emit('roomUpdate', room);
    startShotClock(roomId);
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.players.filter(Boolean).length < 2) return;
    const dealer = room.players[room.dealerIdx];
    const variantMap = { HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2 }, OMAHA: { id: 'OMAHA', name: 'OMAHA', holeCards: 4 }, PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3 }, MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2 } };
    const selectedId = dealer?.pendingVariant || room.pendingVariant || 'HOLDEM';
    room.activeVariant = variantMap[selectedId];
    const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
    const dIdx = seated.indexOf(room.dealerIdx);
    const sbIdx = seated[(dIdx + 1) % seated.length];
    const bbIdx = seated[(dIdx + 2) % seated.length];
    room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
    let deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s })));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    room.deck = deck;
    room.players = room.players.map((p, i) => {
        if (!p) return null;
        let hand = [];
        for (let j = 0; j < room.activeVariant.holeCards; j++) hand.push(room.deck.pop());
        let bet = (i === sbIdx) ? room.sb : (i === bbIdx) ? room.bb : 0;
        return { ...p, hand, chips: p.chips - bet, buyInOrigin: p.chips + bet, currentBet: bet, isFolded: false, isWinner: false, hasActed: false, isDealer: (i === room.dealerIdx), isAllIn: false };
    });
    room.phase = PHASES.PRE_FLOP;
    room.highestBet = room.bb;
    room.community = [];
    room.potData = [{ label: 'MAIN', amount: 0 }];
    io.to(roomId).emit('log', { action: `DEALER ${dealer.name} selected ${room.activeVariant.name}.`, type: 'system' });
    io.to(roomId).emit('roomUpdate', room);
    startShotClock(roomId);
};

io.on('connection', (socket) => {
    socket.on('playerLogin', (data) => {
        console.log('Login attempt for password:', data.password); // P1 Recovery Logging
        const profile = globalProfiles.find(p => p.password === data.password);
        if (profile) { 
            socket.emit('loginSuccess', profile); 
        } else {
            socket.emit('loginFailure', { message: 'Invalid Passcode' });
        }
    });

    socket.on('getInitialData', () => {
        socket.emit('initialDataResponse', { profiles: globalProfiles, rooms: Object.values(rooms) });
    });

    socket.on('updatePlayerSettings', (d) => { 
        const p = globalProfiles.find(p => p.uid === d.uid);
        if (p) p.pendingVariant = d.pendingVariant;
        Object.values(rooms).forEach(r => { 
            const rp = r.players.find(rp => rp && rp.uid === d.uid); 
            if (rp) { rp.pendingVariant = d.pendingVariant; if (rp.isDealer) r.pendingVariant = d.pendingVariant; }
        });
        saveToDisk();
    });

    socket.on('joinRoom', (data, cb) => {
        const room = rooms[data.roomId];
        if (!room) return;
        socket.join(data.roomId);
        if (!room.players.find(p => p && p.uid === data.profile.uid)) {
            const slot = room.players.findIndex(p => p === null);
            if (slot !== -1) {
                room.players[slot] = { ...data.profile, buyInOrigin: data.buyIn, chips: data.buyIn, socketId: socket.id, hand: [] };
                if (room.dealerIdx === -1) room.dealerIdx = slot;
                io.to(data.roomId).emit('log', { action: `${data.profile.name} has joined the arena.`, type: 'system' });
            }
        }
        io.to(data.roomId).emit('roomUpdate', room);
        if(cb) cb({ status: 'ok' });
        if (room.players.filter(Boolean).length >= 2 && room.phase === PHASES.IDLE) setTimeout(() => runIgnition(data.roomId), 3000);
    });

    socket.on('adminAddChips', (d) => {
        const r = rooms[d.roomId];
        const p = r?.players.find(rp => rp && rp.uid === d.uid);
        const profile = globalProfiles.find(prof => prof.uid === d.uid);
        if (p && profile && profile.chips >= d.chips) {
            p.chips += d.chips; p.buyInOrigin += d.chips; profile.chips -= d.chips;
            io.emit('profilesUpdate', globalProfiles); io.to(d.roomId).emit('roomUpdate', r);
            saveToDisk();
        }
    });

    socket.on('adminAddBot', (data) => {
        const room = rooms[data.roomId];
        if (!room) return;
        const botId = 'bot_' + Math.random().toString(36).substr(2, 5);
        const botProfile = { name: "BOT_"+botId.toUpperCase(), uid: botId, chips: 5000, isBot: true };
        const slot = room.players.findIndex(p => p === null);
        if (slot !== -1) {
            room.players[slot] = { ...botProfile, buyInOrigin: 5000, pendingVariant: 'HOLDEM', currentBet: 0, hand: [], isWinner: false, isFolded: false, hasActed: false, socketId: 'bot' };
            io.to(roomId).emit('roomUpdate', room);
            if (room.players.filter(Boolean).length >= 2 && room.phase === PHASES.IDLE) runIgnition(data.roomId);
            saveToDisk();
        }
    });

    socket.on('adminCreatePlayer', (d, cb) => { globalProfiles.push(d); io.emit('profilesUpdate', globalProfiles); if (cb) cb({status:'ok'}); saveToDisk(); });
    socket.on('adminCreateRoom', (d) => { rooms[d.id] = { ...d, players: Array.from({length:10},()=>null), community:[], phase:PHASES.IDLE, potData:[{amount:0}], dealerIdx:-1, activeIdx:-1 }; io.emit('lobbyUpdate', Object.values(rooms)); saveToDisk(); });
    socket.on('adminEditChips', (d) => {
        const p = globalProfiles.find(p => p.uid === d.uid);
        if (p) { p.chips = d.chips; io.emit('profilesUpdate', globalProfiles); saveToDisk(); }
    });

    socket.on('adminDeletePlayer', (uid) => { globalProfiles = globalProfiles.filter(p => p.uid !== uid); io.emit('profilesUpdate', globalProfiles); saveToDisk(); });
    socket.on('adminNuclearReset', () => { globalProfiles=[]; rooms={}; io.emit('profilesUpdate',[]); io.emit('lobbyUpdate',[]); saveToDisk(); });

    socket.on('disconnecting', () => {
        for (const roomId of socket.rooms) {
            const room = rooms[roomId];
            if (room) {
                const playerIdx = room.players.findIndex(p => p && p.socketId === socket.id);
                const player = room.players[playerIdx];
                if (player && !player.isBot) {
                    const profile = globalProfiles.find(p => p.uid === player.uid);
                    if (profile) { profile.chips += (player.chips - player.buyInOrigin); io.emit('profilesUpdate', globalProfiles); }
                    io.to(roomId).emit('log', { action: `${player.name} has left.`, type: 'system' });
                    room.players[playerIdx] = null;
                    if (room.players.filter(Boolean).length === 0) clearShotClock(roomId);
                    io.to(roomId).emit('roomUpdate', room);
                    saveToDisk();
                }
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`Authoritative stable engine: ${PORT}`));
