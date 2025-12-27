import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- PERSISTENCE ENGINE ---
const DB_PATH = './poker_db.json';
let globalProfiles = []; 
let rooms = {}; 

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
            console.log("Database Hydrated from Disk.");
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
    return { power, name: `${name} (${cardString})`, cards: sorted };
};

const getBestHand = (holeCards, community) => {
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

const collectBets = (room) => {
    let streetPot = 0;
    room.players.forEach(p => {
        if (p) {
            streetPot += p.currentBet;
            p.currentBet = 0;
            p.hasActed = false; 
        }
    });
    if (!room.potData) room.potData = [{ label: 'MAIN', amount: 0 }];
    room.potData[0].amount += streetPot;
    room.highestBet = 0;
    room.lastRaiseAmt = room.bb || 20;
    saveToDisk();
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.phase = PHASES.SHOWDOWN;
    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    
    const evals = activeIndices.map(i => ({ 
        index: i, 
        best: getBestHand(room.players[i].hand, room.community) 
    }));
    evals.sort((a, b) => b.best.power - a.best.power);

    const winnerData = evals[0];
    const winner = room.players[winnerData.index];
    
    collectBets(room);
    const winAmount = room.potData[0].amount;

    winner.isWinner = true;
    winner.chips += winAmount; 
    room.winning5Ids = winnerData.best.cards.map(c => c.id);
    room.winningPlayerIndices = [winnerData.index];

    io.to(roomId).emit('roomUpdate', room);
    io.to(roomId).emit('log', { 
        name: String(winner.name), 
        action: `wins $${winAmount} with a ${winnerData.best.name}!`, 
        type: 'win' 
    });

    saveToDisk();

    setTimeout(() => {
        if (!rooms[roomId]) return;
        room.phase = PHASES.IDLE;
        room.community = [];
        room.winning5Ids = [];
        room.winningPlayerIndices = [];
        room.players.forEach(p => { if (p) { p.hand = []; p.isWinner = false; p.isFolded = false; p.currentBet = 0; p.hasActed = false; } });
        const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
        const currentDealerPos = seated.indexOf(room.dealerIdx);
        room.dealerIdx = seated[(currentDealerPos + 1) % seated.length];
        io.to(roomId).emit('roomUpdate', room);
        saveToDisk();
        setTimeout(() => runIgnition(roomId), 3000);
    }, 6000);
};

const advancePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    collectBets(room);
    
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
        processShowdown(roomId);
        return;
    }
    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const dealerPos = activeIndices.indexOf(room.dealerIdx);
    room.activeIdx = activeIndices[(dealerPos + 1) % activeIndices.length];
    io.to(roomId).emit('roomUpdate', room);
    saveToDisk();
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.players.filter(Boolean).length < 2) return;
    
    const dealer = room.players[room.dealerIdx];
    const variantId = dealer?.pendingVariant || 'HOLDEM';
    const variantMap = { 
        HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2 }, 
        OMAHA: { id: 'OMAHA', name: 'OMAHA', holeCards: 4 }, 
        PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3 }, 
        MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2 } 
    };
    room.activeVariant = variantMap[variantId];

    const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
    const dIdx = seated.indexOf(room.dealerIdx);
    const sbIdx = seated[(dIdx + 1) % seated.length];
    const bbIdx = seated[(dIdx + 2) % seated.length];
    room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];

    const SB_VAL = room.sb || 10;
    const BB_VAL = room.bb || 20;
    const shuffleArray = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    let deck = shuffleArray(VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))));
    room.deck = deck;

    room.players = room.players.map((p, i) => {
        if (!p) return null;
        let hand = [];
        for (let j = 0; j < room.activeVariant.holeCards; j++) hand.push(deck.pop());
        let bet = (i === sbIdx) ? SB_VAL : (i === bbIdx) ? BB_VAL : 0;
        return { ...p, hand, chips: p.chips - bet, currentBet: bet, isFolded: false, isWinner: false, hasActed: false, isDealer: (i === room.dealerIdx) };
    });

    room.phase = PHASES.PRE_FLOP;
    room.highestBet = BB_VAL;
    room.lastRaiseAmt = BB_VAL;
    room.community = [];
    room.potData = [{ label: 'MAIN', amount: 0 }];
    io.to(roomId).emit('roomUpdate', room);
    io.to(roomId).emit('log', { action: `Dealer ${dealer.name} chose ${room.activeVariant.name}`, type: 'system' });
    saveToDisk();
};

// --- SOCKET HANDLERS ---
io.on('connection', (socket) => {
    socket.emit('profilesUpdate', globalProfiles);
    socket.emit('lobbyUpdate', Object.values(rooms));

    socket.on('playerLogin', (data) => {
        const profile = globalProfiles.find(p => p.password === data.password);
        if (profile) { socket.emit('loginSuccess', profile); socket.emit('lobbyUpdate', Object.values(rooms)); }
    });

    socket.on('joinRoom', (data, callback) => {
        const { roomId, profile, buyIn } = data;
        const room = rooms[roomId];
        if (!room) return;
        socket.join(roomId);
        if (room.players.findIndex(p => p && p.uid === profile.uid) === -1) {
            const slot = room.players.findIndex(p => p === null);
            if (slot !== -1) {
                room.players[slot] = { ...profile, chips: buyIn, uid: profile.uid, pendingVariant: profile.pendingVariant || 'HOLDEM' };
                if (room.dealerIdx === -1) room.dealerIdx = slot;
            }
        }
        io.to(roomId).emit('roomUpdate', room);
        if (callback) callback({ status: 'ok' });
        saveToDisk();
        if (room.players.filter(Boolean).length >= 2 && room.phase === PHASES.IDLE) { setTimeout(() => runIgnition(roomId), 3000); }
    });

    socket.on('playerAction', (data) => {
        const { roomId, type, amount } = data;
        const room = rooms[roomId];
        if (!room || room.activeIdx === -1) return;
        const player = room.players[room.activeIdx];
        player.hasActed = true;

        if (type === 'FOLD') { 
            player.isFolded = true; 
            io.to(roomId).emit('log', { name: String(player.name), action: "Folds" });
        }
        else if (type === 'CALL') {
            const diff = room.highestBet - player.currentBet;
            player.chips -= diff;
            player.currentBet = room.highestBet;
            io.to(roomId).emit('log', { name: String(player.name), action: diff > 0 ? `Calls $${diff}` : "Checks" });
        }
        else if (type === 'RAISE') {
            const diff = amount - player.currentBet;
            player.chips -= diff;
            player.currentBet = amount;
            room.highestBet = amount;
            room.players.forEach(p => { if (p && p.uid !== player.uid) p.hasActed = false; });
            io.to(roomId).emit('log', { name: String(player.name), action: `Raises to $${amount}` });
        }

        const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
        const allActed = activeIndices.every(i => room.players[i].hasActed);
        const allMatched = activeIndices.every(i => room.players[i].currentBet === room.highestBet);

        if (activeIndices.length === 1) { processShowdown(roomId); }
        else if (allActed && allMatched) { advancePhase(roomId); }
        else {
            const currentPos = activeIndices.indexOf(room.activeIdx);
            room.activeIdx = activeIndices[(currentPos + 1) % activeIndices.length];
            io.to(roomId).emit('roomUpdate', room);
        }
        saveToDisk();
    });

    socket.on('updatePlayerSettings', (d) => { 
        const p = globalProfiles.find(p => p.uid === d.uid);
        if (p) {
            p.pendingVariant = d.pendingVariant;
            io.emit('log', { action: `${p.name} has pre-selected ${d.pendingVariant} for their next deal.`, type: 'system' });
        }
        Object.values(rooms).forEach(r => { 
            const rp = r.players.find(rp => rp && rp.uid === d.uid); 
            if (rp) rp.pendingVariant = d.pendingVariant; 
        });
        saveToDisk();
    });

    socket.on('adminCreatePlayer', (d, cb) => { globalProfiles.push(d); io.emit('profilesUpdate', globalProfiles); cb({status:'ok'}); saveToDisk(); });
    socket.on('adminCreateRoom', (d) => { rooms[d.id] = { ...d, players: Array.from({length:10},()=>null), community:[], phase:PHASES.IDLE, potData:[{amount:0}], dealerIdx:-1, activeIdx:-1 }; io.emit('lobbyUpdate', Object.values(rooms)); saveToDisk(); });
    socket.on('adminDeletePlayer', (uid) => { globalProfiles = globalProfiles.filter(p => p.uid !== uid); io.emit('profilesUpdate', globalProfiles); saveToDisk(); });
    socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms)); saveToDisk(); });
    socket.on('adminForceDeal', (roomId) => runIgnition(roomId));
    socket.on('adminNuclearReset', () => { globalProfiles=[]; rooms={}; io.emit('profilesUpdate',[]); io.emit('lobbyUpdate',[]); saveToDisk(); });
    
    socket.on('adminEditChips', (d) => {
        const p = globalProfiles.find(p => p.uid === d.uid);
        if (p) {
            p.chips = d.chips;
            io.emit('profilesUpdate', globalProfiles);
            Object.values(rooms).forEach(r => {
                const rp = r.players.find(rp => rp && rp.uid === d.uid);
                if (rp) {
                    rp.chips = d.chips;
                    io.to(r.id).emit('roomUpdate', r);
                }
            });
            saveToDisk();
        }
    });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`Authoritative Backend Running: ${PORT}`));
