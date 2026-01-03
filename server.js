import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- CONSTANTS ---
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const BOT_NAMES = ["Ace_Bot", "River_Rat", "Sharky", "BluffMaster", "Foldy", "Annie_AllIn", "Checky", "GambleTron", "PokerFace", "Moneymaker"];

let profiles = []; 
let rooms = {};

// --- GAME LOGIC ---
const checkStart = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.phase !== PHASES.IDLE) return;

    const seated = room.players.filter(p => p !== null);
    if (seated.length >= 2) {
        if (room.startTimer) return;
        
        io.to(roomId).emit('log', { name: "SYSTEM", action: "Arena active. Dealing in 3s...", type: 'phase' });
        
        room.startTimer = setTimeout(() => {
            if (room.players.filter(p => p !== null).length >= 2) {
                runIgnition(roomId);
            }
            room.startTimer = null;
        }, 3000);
    }
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    const seatedIndices = room.players.map((p, i) => p ? i : null).filter(x => x !== null);
    if (seatedIndices.length < 2) {
        room.phase = PHASES.IDLE;
        io.to(roomId).emit('roomUpdate', room);
        return;
    }

    // Reset Hand State
    room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
    room.community = [];
    room.potData = [{ amount: 0 }];
    room.highestBet = room.bb;
    room.phase = PHASES.PRE_FLOP;
    room.winning5Ids = [];

    // Dealer & Blinds Rotation
    room.dealerIdx = seatedIndices[(seatedIndices.indexOf(room.dealerIdx) + 1) % seatedIndices.length];
    const sbIdx = seatedIndices[(seatedIndices.indexOf(room.dealerIdx) + 1) % seatedIndices.length];
    const bbIdx = seatedIndices[(seatedIndices.indexOf(room.dealerIdx) + 2) % seatedIndices.length];
    
    // Deal Cards per Variant
    room.players.forEach((p, i) => {
        if (!p) return;
        const vId = p.pendingVariant || 'HOLDEM';
        const count = ['OMAHA', 'HILOW', 'REDSBLACKS'].includes(vId) ? 4 : ['PINEAPPLE', 'MUFLIS'].includes(vId) ? 3 : 2;
        
        p.hand = room.deck.splice(0, count);
        p.currentBet = 0;
        p.isFolded = false;
        p.isWinner = false;
        p.lastAction = null;
        p.strength = "High Card";

        if (i === sbIdx) { p.chips -= room.sb; p.currentBet = room.sb; }
        if (i === bbIdx) { p.chips -= room.bb; p.currentBet = room.bb; }
    });

    room.activeIdx = seatedIndices[(seatedIndices.indexOf(bbIdx) + 1) % seatedIndices.length];
    room.timeRemaining = 30;

    io.to(roomId).emit('log', { 
        name: room.players[room.dealerIdx].name, 
        action: `deals ${room.players[room.dealerIdx].pendingVariant || 'Holdem'}`, 
        type: 'variant' 
    });
    io.to(roomId).emit('roomUpdate', room);
};

// --- SOCKET EVENTS ---
io.on('connection', (socket) => {
    socket.on('getInitialData', () => {
        socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms) });
    });

    socket.on('playerLogin', ({ password }) => {
        let p = profiles.find(x => x.password === password);
        if (!p && password) {
            p = { uid: 'u_' + Math.random().toString(36).slice(2, 7), name: `Player_${password}`, password, chips: 5000, pendingVariant: 'HOLDEM' };
            profiles.push(p);
            io.emit('profilesUpdate', profiles);
        }
        if (p) socket.emit('loginSuccess', p);
    });

    socket.on('adminCreateRoom', (config) => {
        const roomId = config.id || 'room_' + Math.random().toString(36).slice(2, 7);
        rooms[roomId] = {
            ...config,
            id: roomId,
            players: Array(10).fill(null),
            community: [],
            potData: [{ amount: 0 }],
            phase: PHASES.IDLE,
            highestBet: 0,
            dealerIdx: 0,
            activeIdx: -1
        };
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
        const room = rooms[roomId];
        if (!room) return callback?.({ status: 'error' });
        const seat = room.players.findIndex(p => p === null);
        if (seat === -1) return callback?.({ status: 'full' });

        room.players[seat] = { ...profile, chips: buyIn, currentBet: 0, isFolded: false, seatIdx: seat };
        socket.join(roomId);
        io.to(roomId).emit('roomUpdate', room);
        callback?.({ status: 'ok' });
        checkStart(roomId);
    });

    socket.on('adminAddBot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const seat = room.players.findIndex(p => p === null);
        if (seat === -1) return;

        const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + "_" + Math.floor(Math.random() * 99);
        room.players[seat] = {
            uid: 'bot_' + Math.random().toString(36).slice(2, 7),
            name: botName,
            chips: 2000,
            currentBet: 0,
            isFolded: false,
            isBot: true,
            seatIdx: seat,
            pendingVariant: 'HOLDEM'
        };

        io.to(roomId).emit('roomUpdate', room);
        io.to(roomId).emit('log', { name: "SYSTEM", action: `added bot ${botName}`, type: 'variant' });
        checkStart(roomId);
    });

    socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
        const p = profiles.find(x => x.uid === uid);
        if (p) p.pendingVariant = pendingVariant;
    });

    socket.on('adminNuclearReset', () => {
        rooms = {};
        profiles = [];
        io.emit('lobbyUpdate', []);
        io.emit('profilesUpdate', []);
    });

    socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms)); });
    socket.on('adminDeletePlayer', (uid) => { profiles = profiles.filter(x => x.uid !== uid); io.emit('profilesUpdate', profiles); });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server v0.1.6 Running on ${PORT}`));
