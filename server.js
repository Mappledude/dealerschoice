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
let globalPlayers = []; 
let rooms = {}; 

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♣', '♥', '♦'];

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

// --- MULTIPLAYER ENGINE ---
io.on('connection', (socket) => {
    console.log('Client Connected:', socket.id);

    socket.emit('profilesUpdate', globalPlayers);
    socket.emit('lobbyUpdate', Object.values(rooms));

    socket.on('adminNuclearReset', () => {
        globalPlayers = []; rooms = {};
        io.emit('profilesUpdate', []); io.emit('lobbyUpdate', []);
        console.log('NUCLEAR PURGE: Memory cleared.');
    });

    socket.on('adminCreatePlayer', (data, callback) => {
        if (!data.uid) return;
        globalPlayers.push(data);
        io.emit('profilesUpdate', globalPlayers);
        if (callback) callback({ status: 'ok' });
    });

    socket.on('adminCreateRoom', (data) => {
        rooms[data.id] = { 
            ...data, 
            players: Array.from({ length: 10 }, () => null),
            community: [],
            phase: 'IDLE',
            highestBet: 0,
            lastRaiseAmt: data.bb || 20,
            dealerIdx: -1,
            activeIdx: -1,
            activeVariant: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2 }
        };
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('adminChangeVariant', (data) => {
        const { roomId, variantId } = data;
        const room = rooms[roomId];
        if (!room) return;
        const config = {
            HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2 },
            OMAHA: { id: 'OMAHA', name: 'OMAHA', holeCards: 4 },
            PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3 },
            MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2 }
        }[variantId];
        room.activeVariant = config;
        io.to(roomId).emit('roomUpdate', room);
    });

    // --- AUTOMATIC IGNITION ENGINE ---
    const runIgnition = (roomId) => {
        const room = rooms[roomId];
        if (!room || room.phase !== 'IDLE') return;

        const seatedIndices = room.players.map((p, i) => p ? i : null).filter(i => i !== null);
        if (seatedIndices.length < 2) return;

        // Advance Dealer
        if (room.dealerIdx === -1 || !seatedIndices.includes(room.dealerIdx)) {
            room.dealerIdx = seatedIndices[0];
        } else {
            const currentPos = seatedIndices.indexOf(room.dealerIdx);
            room.dealerIdx = seatedIndices[(currentPos + 1) % seatedIndices.length];
        }

        const dIdx = seatedIndices.indexOf(room.dealerIdx);
        const sbIdx = seatedIndices[(dIdx + 1) % seatedIndices.length];
        const bbIdx = seatedIndices[(dIdx + 2) % seatedIndices.length];
        room.activeIdx = seatedIndices[(seatedIndices.indexOf(bbIdx) + 1) % seatedIndices.length];

        const SB_VAL = room.sb || 10;
        const BB_VAL = room.bb || 20;
        let deck = shuffle(createDeck());
        const v = room.activeVariant || { holeCards: 2 };

        room.players = room.players.map((p, i) => {
            if (!p) return null;
            let hand = [];
            for (let j = 0; j < v.holeCards; j++) { hand.push(deck.pop()); }
            let chips = p.chips;
            let currentBet = 0;
            if (i === sbIdx) { chips -= SB_VAL; currentBet = SB_VAL; }
            if (i === bbIdx) { chips -= BB_VAL; currentBet = BB_VAL; }
            return { ...p, hand, chips, currentBet, isFolded: false, isWinner: false, isDealer: (i === room.dealerIdx) };
        });

        room.phase = 'PRE_FLOP';
        room.community = [];
        room.deck = deck;
        room.highestBet = BB_VAL;
        room.lastRaiseAmt = BB_VAL;
        
        io.to(roomId).emit('roomUpdate', room);
        io.to(roomId).emit('log', { action: "AUTO-DEAL: HAND STARTED", type: 'system' });
    };

    socket.on('adminForceDeal', (roomId) => runIgnition(roomId));

    socket.on('playerLogin', (data) => {
        const profile = globalPlayers.find(p => p.password === data.password);
        if (profile) socket.emit('loginSuccess', profile);
    });

    socket.on('joinRoom', (data, callback) => {
        const { roomId, profile, buyIn } = data;
        const room = rooms[roomId];
        if (!room) return;

        socket.join(roomId);
        let seatIdx = room.players.findIndex(p => p && p.uid === profile.uid);
        if (seatIdx === -1) {
            seatIdx = room.players.findIndex(p => p === null);
            if (seatIdx !== -1) {
                room.players[seatIdx] = { ...profile, chips: buyIn, uid: profile.uid, isDealer: false };
            }
        }

        io.to(roomId).emit('roomUpdate', room);
        io.emit('lobbyUpdate', Object.values(rooms));
        if (callback) callback({ status: 'ok' });

        // AUTO-DEAL CHECK
        const seatedCount = room.players.filter(Boolean).length;
        if (seatedCount >= 2 && room.phase === 'IDLE') {
            io.to(roomId).emit('log', { action: "WAITING FOR PLAYERS (3s...)", type: 'system' });
            setTimeout(() => runIgnition(roomId), 3000);
        }
    });

    socket.on('playerAction', (data) => {
        const { roomId, type, amount } = data;
        const room = rooms[roomId];
        if (!room || room.activeIdx === -1) return;

        const player = room.players[room.activeIdx];
        if (!player) return;

        // Authoritative Betting Logic
        if (type === 'FOLD') {
            player.isFolded = true;
        } else if (type === 'CALL') {
            const callAmount = room.highestBet - player.currentBet;
            player.chips -= callAmount;
            player.currentBet = room.highestBet;
        } else if (type === 'RAISE') {
            const raiseTo = amount;
            const extra = raiseTo - player.currentBet;
            player.chips -= extra;
            player.currentBet = raiseTo;
            room.highestBet = raiseTo;
        }

        // Advance turn
        const seated = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(i => i !== null);
        const currentPos = seated.indexOf(room.activeIdx);
        room.activeIdx = seated[(currentPos + 1) % seated.length];
        
        io.to(roomId).emit('roomUpdate', room);
    });

    socket.on('adminDeletePlayer', (uid) => {
        globalPlayers = globalPlayers.filter(p => p.uid !== uid);
        io.emit('profilesUpdate', globalPlayers);
    });

    socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms)); });

    socket.on('disconnect', () => { console.log('Client Disconnected'); });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
