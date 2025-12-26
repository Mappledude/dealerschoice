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

// --- GLOBAL GAME MEMORY ---
let globalPlayers = []; // Registry of all profiles
let rooms = {}; // Active game instances { roomId: { state } }

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♣', '♥', '♦'];

// --- HELPERS ---
const createDeck = () => {
    let deck = [];
    VALUES.forEach(v => {
        SUITS.forEach(s => {
            deck.push({ id: `${v}${s}-${Math.random()}`, value: v, suit: s });
        });
    });
    return deck;
};

const shuffle = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // Sync Initial Data
    socket.emit('profilesUpdate', globalPlayers);
    socket.emit('lobbyUpdate', Object.values(rooms));

    // Admin: Nuclear Reset
    socket.on('adminNuclearReset', () => {
        globalPlayers = [];
        rooms = {};
        io.emit('profilesUpdate', globalPlayers);
        io.emit('lobbyUpdate', []);
        console.log('SYSTEM HARD WIPE EXECUTED');
    });

    // Admin: Create Player
    socket.on('adminCreatePlayer', (data, callback) => {
        globalPlayers.push(data);
        io.emit('profilesUpdate', globalPlayers);
        if (callback) callback({ status: 'ok' });
    });

    // Admin: Create Room
    socket.on('adminCreateRoom', (data) => {
        rooms[data.id] = { 
            ...data, 
            players: Array.from({ length: 10 }, () => null),
            community: [],
            phase: 'IDLE',
            highestBet: 0,
            potData: [{ label: 'MAIN', amount: 0, eligible: [] }]
        };
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    // Admin: Force Deal
    socket.on('adminForceDeal', (roomId) => {
        const room = rooms[roomId];
        if (!room) return;

        console.log(`FORCING DEAL: Room ${roomId}`);
        
        let deck = shuffle(createDeck());
        const variant = room.activeVariant || { holeCards: 2 };
        
        // Distribute Cards to non-null players
        room.players = room.players.map(p => {
            if (!p) return null;
            let hand = [];
            for (let i = 0; i < variant.holeCards; i++) {
                hand.push(deck.pop());
            }
            return { ...p, hand, isFolded: false, isWinner: false, currentBet: 0 };
        });

        room.phase = 'PRE_FLOP';
        room.community = [];
        room.deck = deck; // Store remaining deck
        
        io.to(roomId).emit('roomUpdate', room);
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    // Player: Login
    socket.on('playerLogin', (data) => {
        const profile = globalPlayers.find(p => p.password === data.password);
        if (profile) socket.emit('loginSuccess', profile);
    });

    // Player: Join Room
    socket.on('joinRoom', (data, callback) => {
        const { roomId, profile, buyIn } = data;
        const room = rooms[roomId];
        if (!room) return;

        socket.join(roomId);
        
        // Find first empty seat
        const seatIdx = room.players.findIndex(p => p === null);
        if (seatIdx !== -1) {
            room.players[seatIdx] = { ...profile, chips: buyIn, uid: profile.uid };
        }

        io.to(roomId).emit('roomUpdate', room);
        io.emit('lobbyUpdate', Object.values(rooms));
        if (callback) callback({ status: 'ok' });
    });

    socket.on('disconnect', () => {
        console.log('User Disconnected');
    });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
