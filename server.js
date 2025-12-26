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

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

// --- MULTIPLAYER ENGINE ---
io.on('connection', (socket) => {
    socket.emit('profilesUpdate', globalPlayers);
    socket.emit('lobbyUpdate', Object.values(rooms));

    socket.on('adminNuclearReset', () => {
        globalPlayers = []; rooms = {};
        io.emit('profilesUpdate', []); io.emit('lobbyUpdate', []);
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
            phase: PHASES.IDLE,
            highestBet: 0,
            dealerIdx: -1,
            activeIdx: -1,
            activeVariant: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2 }
        };
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    const advancePhase = (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        // Reset per-street betting
        room.players.forEach(p => { if (p) p.currentBet = 0; });
        room.highestBet = 0;

        if (room.phase === PHASES.PRE_FLOP) {
            room.phase = PHASES.FLOP;
            room.community.push(room.deck.pop(), room.deck.pop(), room.deck.pop());
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

        // Action starts to the left of dealer for post-flop streets
        const seatedIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(i => i !== null);
        const dealerPos = seatedIndices.indexOf(room.dealerIdx);
        room.activeIdx = seatedIndices[(dealerPos + 1) % seatedIndices.length];

        io.to(roomId).emit('roomUpdate', room);
        io.to(roomId).emit('log', { action: `Phase: ${room.phase}`, type: 'system' });
    };

    const runIgnition = (roomId) => {
        const room = rooms[roomId];
        if (!room || room.phase !== PHASES.IDLE) return;
        const seatedIndices = room.players.map((p, i) => p ? i : null).filter(i => i !== null);
        if (seatedIndices.length < 2) return;

        room.dealerIdx = (room.dealerIdx === -1) ? seatedIndices[0] : seatedIndices[(seatedIndices.indexOf(room.dealerIdx) + 1) % seatedIndices.length];
        const sbIdx = seatedIndices[(seatedIndices.indexOf(room.dealerIdx) + 1) % seatedIndices.length];
        const bbIdx = seatedIndices[(seatedIndices.indexOf(room.dealerIdx) + 2) % seatedIndices.length];
        room.activeIdx = seatedIndices[(seatedIndices.indexOf(bbIdx) + 1) % seatedIndices.length];

        const SB = room.sb || 10;
        const BB = room.bb || 20;
        let deck = shuffle(createDeck());
        room.deck = deck;

        room.players = room.players.map((p, i) => {
            if (!p) return null;
            let hand = [];
            for (let j = 0; j < room.activeVariant.holeCards; j++) hand.push(deck.pop());
            let cBet = (i === sbIdx) ? SB : (i === bbIdx) ? BB : 0;
            return { ...p, hand, chips: p.chips - cBet, currentBet: cBet, isFolded: false, isWinner: false, isDealer: (i === room.dealerIdx) };
        });

        room.phase = PHASES.PRE_FLOP;
        room.highestBet = BB;
        room.community = [];
        io.to(roomId).emit('roomUpdate', room);
        io.to(roomId).emit('log', { action: "Hand Started", type: 'system' });
    };

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
            const callAmt = room.highestBet - player.currentBet;
            player.chips -= callAmt;
            player.currentBet = room.highestBet;
            io.to(roomId).emit('log', { name: player.name, action: room.highestBet > 0 ? `Calls $${callAmt}` : "Checks" });
        } else if (type === 'RAISE') {
            const extra = amount - player.currentBet;
            player.chips -= extra;
            player.currentBet = amount;
            room.highestBet = amount;
            io.to(roomId).emit('log', { name: player.name, action: `Raises to $${amount}` });
        }

        // Logic: Who is next?
        const activePlayers = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(i => i !== null);
        
        // End street check: All active players matched highestBet
        const allMatched = activePlayers.every(i => room.players[i].currentBet === room.highestBet);
        
        if (allMatched && activePlayers.length > 1) {
            advancePhase(roomId);
        } else if (activePlayers.length === 1) {
            // One winner by fold
            room.players[activePlayers[0]].isWinner = true;
            room.phase = PHASES.SHOWDOWN;
            io.to(roomId).emit('roomUpdate', room);
        } else {
            // Move turn
            const currentPos = activePlayers.indexOf(room.activeIdx);
            room.activeIdx = activePlayers[(currentPos + 1) % activePlayers.length];
            io.to(roomId).emit('roomUpdate', room);
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
        if (room.players.filter(Boolean).length === 2 && room.phase === PHASES.IDLE) {
            setTimeout(() => runIgnition(roomId), 2000);
        }
    });

    socket.on('adminNuclearReset', () => { globalPlayers = []; rooms = {}; io.emit('profilesUpdate', []); io.emit('lobbyUpdate', []); });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`Server: ${PORT}`));
