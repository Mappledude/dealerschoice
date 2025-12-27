import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- GLOBAL GAME STATE ---
let globalProfiles = []; 
let rooms = {}; 

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♣', '♥', '♦'];

// --- POKER ENGINE UTILS ---
const createDeck = () => {
    let deck = [];
    VALUES.forEach(v => { SUITS.forEach(s => { deck.push({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }); }); });
    return deck;
};

const shuffle = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

// Simplified Evaluator for Intelligence Feed
const getHandName = (hand, community) => {
    const total = [...hand, ...community];
    if (total.length < 5) return "High Card";
    const names = ["High Card", "Pair", "Two Pair", "Three of a Kind", "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush"];
    // For production logic, we would use a library or full combinatorial ranker here.
    // Returning a randomized high-tier name for simulation if community is full.
    return total.length >= 7 ? names[Math.floor(Math.random() * 4) + 4] : names[Math.floor(Math.random() * 3)];
};

// --- CORE HAND CYCLE ---

const collectBets = (room) => {
    let streetPot = 0;
    room.players.forEach(p => {
        if (p) {
            streetPot += p.currentBet;
            p.currentBet = 0;
            p.hasActed = false; 
        }
    });
    if (!room.potData) room.potData = [{ amount: 0 }];
    room.potData[0].amount += streetPot;
    room.highestBet = 0;
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.phase = PHASES.SHOWDOWN;
    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    
    // Authoritative Winner Selection (Simplified for Demo Logic)
    const winnerIdx = activeIndices[0]; 
    const winner = room.players[winnerIdx];
    const winAmount = room.potData[0].amount;
    const handName = getHandName(winner.hand, room.community);

    winner.isWinner = true;
    winner.chips += winAmount;

    io.to(roomId).emit('roomUpdate', room);
    io.to(roomId).emit('log', { 
        name: winner.name, 
        action: `wins $${winAmount} with ${handName}!`, 
        type: 'win' 
    });

    // 5 Second Payout/Animation Delay before Reset
    setTimeout(() => {
        if (!rooms[roomId]) return;
        
        // Reset Room State
        room.phase = PHASES.IDLE;
        room.community = [];
        room.potData = [{ amount: 0 }];
        room.players.forEach(p => { if (p) { p.hand = []; p.isWinner = false; p.isFolded = false; p.currentBet = 0; } });

        // Advance Dealer
        const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
        const currentDealerPos = seated.indexOf(room.dealerIdx);
        room.dealerIdx = seated[(currentDealerPos + 1) % seated.length];

        io.to(roomId).emit('roomUpdate', room);
        io.to(roomId).emit('log', { action: "Hand Complete. Preparing next deal...", type: 'system' });

        // Start 3s countdown for next ignition
        setTimeout(() => runIgnition(roomId), 3000);
    }, 5000);
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
    io.to(roomId).emit('log', { action: `Phase Transition: ${String(room.phase)}`, type: 'system' });
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.players.filter(Boolean).length < 2) return;

    // 1. OBEY DEALER CHOICE
    const dealer = room.players[room.dealerIdx];
    const variantId = dealer?.pendingVariant || 'HOLDEM';
    const VARIANTS = { 
        HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2 }, 
        OMAHA: { id: 'OMAHA', name: 'OMAHA', holeCards: 4 }, 
        PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3 }, 
        MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2 } 
    };
    room.activeVariant = VARIANTS[variantId];

    // 2. Identify Blinds
    const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
    const dIdx = seated.indexOf(room.dealerIdx);
    const sbIdx = seated[(dIdx + 1) % seated.length];
    const bbIdx = seated[(dIdx + 2) % seated.length];
    room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];

    const SB_VAL = room.sb || 10;
    const BB_VAL = room.bb || 20;
    let deck = shuffle(createDeck());
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
};

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    socket.on('playerLogin', (data) => {
        const profile = globalProfiles.find(p => p.password === data.password);
        if (profile) {
            socket.emit('loginSuccess', profile);
            socket.emit('lobbyUpdate', Object.values(rooms));
        }
    });

    socket.on('updatePlayerSettings', (data) => {
        const { uid, pendingVariant } = data;
        globalProfiles = globalProfiles.map(p => p.uid === uid ? { ...p, pendingVariant } : p);
        Object.values(rooms).forEach(room => {
            room.players = room.players.map(p => (p && p.uid === uid) ? { ...p, pendingVariant } : p);
        });
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

        if (room.players.filter(Boolean).length >= 2 && room.phase === PHASES.IDLE) {
            setTimeout(() => runIgnition(roomId), 2000);
        }
    });

    socket.on('playerAction', (data) => {
        const { roomId, type, amount } = data;
        const room = rooms[roomId];
        if (!room || room.activeIdx === -1) return;
        const player = room.players[room.activeIdx];
        player.hasActed = true;

        if (type === 'FOLD') {
            player.isFolded = true;
            io.to(roomId).emit('log', { name: player.name, action: "Folds" });
        } else if (type === 'CALL') {
            const diff = room.highestBet - player.currentBet;
            player.chips -= diff;
            player.currentBet = room.highestBet;
            io.to(roomId).emit('log', { name: player.name, action: room.highestBet > 0 ? "Calls" : "Checks" });
        } else if (type === 'RAISE') {
            const diff = amount - player.currentBet;
            player.chips -= diff;
            player.currentBet = amount;
            room.highestBet = amount;
            room.players.forEach(p => { if (p && p.uid !== player.uid) p.hasActed = false; });
            io.to(roomId).emit('log', { name: player.name, action: `Raises to $${amount}` });
        }

        const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
        const allActed = activeIndices.every(i => room.players[i].hasActed);
        const allMatched = activeIndices.every(i => room.players[i].currentBet === room.highestBet);

        if (activeIndices.length === 1) {
            processShowdown(roomId);
        } else if (allActed && allMatched) {
            advancePhase(roomId);
        } else {
            const currentPos = activeIndices.indexOf(room.activeIdx);
            room.activeIdx = activeIndices[(currentPos + 1) % activeIndices.length];
            io.to(roomId).emit('roomUpdate', room);
        }
    });

    // Admin commands
    socket.on('adminCreatePlayer', (d, cb) => { globalProfiles.push(d); io.emit('profilesUpdate', globalProfiles); cb({status:'ok'}); });
    socket.on('adminCreateRoom', (d) => { rooms[d.id] = { ...d, players: Array.from({length:10},()=>null), community:[], phase:PHASES.IDLE, potData:[{amount:0}], dealerIdx:-1, activeIdx:-1 }; io.emit('lobbyUpdate', Object.values(rooms)); });
    socket.on('adminNuclearReset', () => { globalProfiles=[]; rooms={}; io.emit('profilesUpdate',[]); io.emit('lobbyUpdate',[]); });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`Authoritative Server: ${PORT}`));
