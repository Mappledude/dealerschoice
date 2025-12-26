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

// --- GLOBAL BACKEND MEMORY ---
let globalProfiles = []; 
let rooms = {}; 

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♣', '♥', '♦'];
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

// --- POKER UTILITIES ---
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

// --- GAME ENGINE: STREET ADVANCEMENT ---
const advancePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    // Reset street-specific betting data
    room.highestBet = 0;
    room.players.forEach(p => { if (p) p.currentBet = 0; });

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
        room.activeIdx = -1;
        io.to(roomId).emit('roomUpdate', room);
        io.to(roomId).emit('log', { action: "Hand Complete: Showdown", type: 'system' });
        return;
    }

    // Determine first actor post-flop (left of dealer)
    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const dealerPos = activeIndices.indexOf(room.dealerIdx);
    room.activeIdx = activeIndices[(dealerPos + 1) % activeIndices.length];

    io.to(roomId).emit('roomUpdate', room);
    io.to(roomId).emit('log', { action: `Phase Transition: ${room.phase}`, type: 'system' });
};

// --- GAME ENGINE: IGNITION (DEAL) ---
const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.phase !== PHASES.IDLE) return;

    const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
    if (seated.length < 2) return;

    // Rotate Dealer Button
    if (room.dealerIdx === -1 || !seated.includes(room.dealerIdx)) {
        room.dealerIdx = seated[0];
    } else {
        const dPos = seated.indexOf(room.dealerIdx);
        room.dealerIdx = seated[(dPos + 1) % seated.length];
    }

    const dIdx = seated.indexOf(room.dealerIdx);
    const sbIdx = seated[(dIdx + 1) % seated.length];
    const bbIdx = seated[(dIdx + 2) % seated.length];
    
    // Action starts UTG (Left of BB)
    room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];

    const SB_VAL = room.sb || 10;
    const BB_VAL = room.bb || 20;
    let deck = shuffle(createDeck());
    room.deck = deck;
    room.community = [];
    room.highestBet = BB_VAL;

    room.players = room.players.map((p, i) => {
        if (!p) return null;
        let hand = [];
        const cardCount = room.activeVariant?.holeCards || 2;
        for (let j = 0; j < cardCount; j++) hand.push(deck.pop());
        
        let bet = (i === sbIdx) ? SB_VAL : (i === bbIdx) ? BB_VAL : 0;
        return { 
            ...p, 
            hand, 
            chips: p.chips - bet, 
            currentBet: bet, 
            isFolded: false, 
            isWinner: false, 
            isDealer: (i === room.dealerIdx) 
        };
    });

    room.phase = PHASES.PRE_FLOP;
    io.to(roomId).emit('roomUpdate', room);
    io.to(roomId).emit('log', { action: "Auto-Deal: New Hand Started", type: 'system' });
};

// --- SOCKET ORCHESTRATION ---
io.on('connection', (socket) => {
    console.log('User Joined:', socket.id);

    // Sync Initial Data for generic listeners
    socket.emit('profilesUpdate', globalProfiles);
    socket.emit('lobbyUpdate', Object.values(rooms));

    // Admin: Nuclear Wipe
    socket.on('adminNuclearReset', () => {
        globalProfiles = []; rooms = {};
        io.emit('profilesUpdate', []); io.emit('lobbyUpdate', []);
        console.log('HARD SYSTEM PURGE');
    });

    // Registry & Room Management
    socket.on('adminCreatePlayer', (data, cb) => {
        globalProfiles.push(data);
        io.emit('profilesUpdate', globalProfiles);
        if (cb) cb({ status: 'ok' });
    });

    socket.on('adminCreateRoom', (data) => {
        rooms[data.id] = { 
            ...data, 
            players: Array.from({ length: 10 }, () => null),
            community: [], phase: PHASES.IDLE, highestBet: 0, dealerIdx: -1, activeIdx: -1,
            activeVariant: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2 }
        };
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    // Player flow: Login
    socket.on('playerLogin', (data) => {
        console.log('Login attempt for:', data.password);
        const profile = globalProfiles.find(p => p.password === data.password);
        if (profile) {
            socket.emit('loginSuccess', profile);
            // Immediately hydrate the lobby for this specific socket
            socket.emit('lobbyUpdate', Object.values(rooms));
        }
    });

    // Player flow: Join & Seat
    socket.on('joinRoom', (data, callback) => {
        const { roomId, profile, buyIn } = data;
        const room = rooms[roomId];
        if (!room) return;
        socket.join(roomId);

        const existingIdx = room.players.findIndex(p => p && p.uid === profile.uid);
        if (existingIdx === -1) {
            const slot = room.players.findIndex(p => p === null);
            if (slot !== -1) room.players[slot] = { ...profile, chips: buyIn, uid: profile.uid };
        }

        io.to(roomId).emit('roomUpdate', room);
        io.emit('lobbyUpdate', Object.values(rooms));
        if (callback) callback({ status: 'ok' });

        // Auto-Deal Trigger (Wait for 2nd player)
        const count = room.players.filter(Boolean).length;
        if (count >= 2 && room.phase === PHASES.IDLE) {
            io.to(roomId).emit('log', { action: "Players Ready (Dealing in 3s...)", type: 'system' });
            setTimeout(() => runIgnition(roomId), 3000);
        }
    });

    // Authoritative Action Handling
    socket.on('playerAction', (data) => {
        const { roomId, type, amount } = data;
        const room = rooms[roomId];
        if (!room || room.activeIdx === -1) return;

        const player = room.players[room.activeIdx];
        if (!player) return;

        if (type === 'FOLD') {
            player.isFolded = true;
            io.to(roomId).emit('log', { name: player.name, action: "Folds" });
        } else if (type === 'CALL') {
            const diff = room.highestBet - player.currentBet;
            player.chips -= diff;
            player.currentBet = room.highestBet;
            io.to(roomId).emit('log', { name: player.name, action: room.highestBet > 0 ? `Calls $${diff}` : "Checks" });
        } else if (type === 'RAISE') {
            const diff = amount - player.currentBet;
            player.chips -= diff;
            player.currentBet = amount;
            room.highestBet = amount;
            io.to(roomId).emit('log', { name: player.name, action: `Raises to $${amount}` });
        }

        const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
        const allMatched = activeIndices.every(i => room.players[i].currentBet === room.highestBet);

        if (activeIndices.length === 1) {
            // One player left
            room.players[activeIndices[0]].isWinner = true;
            room.phase = PHASES.SHOWDOWN;
            io.to(roomId).emit('roomUpdate', room);
        } else if (allMatched) {
            advancePhase(roomId);
        } else {
            // Move Turn
            const currentPos = activeIndices.indexOf(room.activeIdx);
            room.activeIdx = activeIndices[(currentPos + 1) % activeIndices.length];
            io.to(roomId).emit('roomUpdate', room);
        }
    });

    socket.on('disconnect', () => { console.log('Client Disconnected'); });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`Authoritative Poker Server: ${PORT}`));
