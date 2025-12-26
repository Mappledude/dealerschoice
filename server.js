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

// --- GAME ENGINE HELPERS ---

const collectBets = (room) => {
    let streetPot = 0;
    room.players.forEach(p => {
        if (p) {
            streetPot += p.currentBet;
            p.currentBet = 0;
            p.hasActed = false; 
        }
    });
    if (!room.potData || room.potData.length === 0) room.potData = [{ label: 'MAIN', amount: 0 }];
    room.potData[0].amount += streetPot;
    room.highestBet = 0;
    room.lastRaiseAmt = room.bb || 20; // Reset raise floor for next street
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
        room.phase = PHASES.SHOWDOWN;
        room.activeIdx = -1;
        io.to(roomId).emit('roomUpdate', room);
        return;
    }

    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const dealerPos = activeIndices.indexOf(room.dealerIdx);
    // Standard rule: Action after Flop starts left of dealer
    room.activeIdx = activeIndices[(dealerPos + 1) % activeIndices.length];

    io.to(roomId).emit('roomUpdate', room);
    io.to(roomId).emit('log', { action: `Phase Transition: ${String(room.phase)}`, type: 'system' });
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.phase !== PHASES.IDLE) return;
    const seated = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
    if (seated.length < 2) return;

    room.dealerIdx = (room.dealerIdx === -1) ? seated[0] : seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
    
    let sbIdx, bbIdx;
    if (seated.length === 2) {
        sbIdx = room.dealerIdx;
        bbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
    } else {
        sbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
        bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
    }
    
    room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];

    const SB_AMT = room.sb || 10;
    const BB_AMT = room.bb || 20;
    let deck = shuffle(createDeck());
    room.deck = deck;

    room.players = room.players.map((p, i) => {
        if (!p) return null;
        let hand = [];
        for (let j = 0; j < room.activeVariant.holeCards; j++) hand.push(deck.pop());
        let bet = (i === sbIdx) ? SB_AMT : (i === bbIdx) ? BB_AMT : 0;
        return { 
            ...p, 
            hand, 
            chips: p.chips - bet, 
            currentBet: bet, 
            isFolded: false, 
            isWinner: false, 
            hasActed: false, 
            isDealer: (i === room.dealerIdx) 
        };
    });

    room.phase = PHASES.PRE_FLOP;
    room.highestBet = BB_AMT;
    room.lastRaiseAmt = BB_AMT;
    room.community = [];
    room.potData = [{ label: 'MAIN', amount: 0 }];
    
    io.to(roomId).emit('roomUpdate', room);
    io.to(roomId).emit('log', { action: "Hand Started", type: 'system' });
};

// --- SOCKET ORCHESTRATION ---
io.on('connection', (socket) => {
    socket.emit('profilesUpdate', globalProfiles);
    socket.emit('lobbyUpdate', Object.values(rooms));

    socket.on('adminNuclearReset', () => {
        globalProfiles = []; rooms = {};
        io.emit('profilesUpdate', []); io.emit('lobbyUpdate', []);
    });

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
            potData: [{ label: 'MAIN', amount: 0 }],
            activeVariant: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2 }
        };
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('playerLogin', (data) => {
        const profile = globalProfiles.find(p => p.password === data.password);
        if (profile) {
            socket.emit('loginSuccess', profile);
            socket.emit('lobbyUpdate', Object.values(rooms));
        }
    });

    socket.on('joinRoom', (data, callback) => {
        const { roomId, profile, buyIn } = data;
        const room = rooms[roomId];
        if (!room) return;
        socket.join(roomId);

        if (room.players.findIndex(p => p && p.uid === profile.uid) === -1) {
            const slot = room.players.findIndex(p => p === null);
            if (slot !== -1) room.players[slot] = { ...profile, chips: buyIn, uid: profile.uid };
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
        if (!player) return;

        player.hasActed = true;

        if (type === 'FOLD') {
            player.isFolded = true;
            io.to(roomId).emit('log', { name: String(player.name), action: "Folds" });
        } else if (type === 'CALL') {
            const diff = room.highestBet - player.currentBet;
            player.chips -= diff;
            player.currentBet = room.highestBet;
            io.to(roomId).emit('log', { name: String(player.name), action: room.highestBet > 0 ? "Calls" : "Checks" });
        } else if (type === 'RAISE') {
            const diff = amount - player.currentBet;
            player.chips -= diff;
            player.currentBet = amount;
            room.highestBet = amount;
            // Everyone else must act again if a raise occurred
            room.players.forEach(p => { if (p && p.uid !== player.uid) p.hasActed = false; });
            io.to(roomId).emit('log', { name: String(player.name), action: `Raises to $${String(amount)}` });
        }

        const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
        const allActed = activeIndices.every(i => room.players[i].hasActed);
        const allMatched = activeIndices.every(i => room.players[i].currentBet === room.highestBet);

        if (activeIndices.length === 1) {
            collectBets(room);
            room.players[activeIndices[0]].isWinner = true;
            room.phase = PHASES.SHOWDOWN;
            io.to(roomId).emit('roomUpdate', room);
        } else if (allActed && allMatched) {
            advancePhase(roomId);
        } else {
            const currentPos = activeIndices.indexOf(room.activeIdx);
            room.activeIdx = activeIndices[(currentPos + 1) % activeIndices.length];
            io.to(roomId).emit('roomUpdate', room);
        }
    });

    socket.on('adminDeletePlayer', (uid) => {
        globalProfiles = globalProfiles.filter(p => p.uid !== uid);
        io.emit('profilesUpdate', globalProfiles);
    });

    socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms)); });
    socket.on('adminForceDeal', (roomId) => runIgnition(roomId));
    socket.on('adminNuclearReset', () => { globalProfiles = []; rooms = {}; io.emit('profilesUpdate', []); io.emit('lobbyUpdate', []); });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`Authoritative Backend Running`));
