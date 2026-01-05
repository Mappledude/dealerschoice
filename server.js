import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v1.8.5-ULTRA";
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

let profiles = []; 
let rooms = {};

const serializeRoom = (room) => {
    if (!room) return null;
    const { timer, deck, ignitionTimer, ...rest } = room;
    return rest;
};

io.on('connection', (socket) => {
    socket.on('getInitialData', () => {
        socket.emit('initialDataResponse', { 
            profiles, 
            rooms: Object.values(rooms).map(serializeRoom) 
        });
    });

    socket.on('playerLogin', ({ password }) => {
        const profile = profiles.find(p => p.password === password);
        if (profile) socket.emit('loginSuccess', profile);
    });

    // --- ADMIN ACTIONS ---
    socket.on('adminCreatePlayer', (p) => { 
        const newP = { ...p, uid: 'u_' + Math.random().toString(36).slice(2, 9), chips: Number(p.chips) };
        profiles.push(newP); 
        io.emit('profilesUpdate', profiles); 
    });

    socket.on('adminEditChips', ({ uid, chips }) => {
        const p = profiles.find(x => x.uid === uid);
        if (p) { p.chips = Number(chips); io.emit('profilesUpdate', profiles); }
    });

    socket.on('adminDeletePlayer', (uid) => {
        profiles = profiles.filter(p => p.uid !== uid);
        io.emit('profilesUpdate', profiles);
    });

    socket.on('adminCreateRoom', (data) => {
        const roomId = data.id || 'room_' + Math.random().toString(36).slice(2, 9);
        rooms[roomId] = { 
            id: roomId,
            name: data.name || "New Arena",
            sb: data.sb || 0.25, 
            bb: data.bb || 0.50, 
            minBuy: data.minBuy || 5, 
            maxBuy: data.maxBuy || 10,
            players: Array(10).fill(null), 
            phase: PHASES.IDLE, 
            community: [], 
            potAmount: 0, 
            highestBet: 0, 
            activeIdx: -1, 
            dealerIdx: 0, 
            timeRemaining: 20,
            activeVariant: { id: data.pendingVariant || 'HOLDEM' }
        };
        io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
    });

    socket.on('adminDeleteRoom', (roomId) => {
        delete rooms[roomId];
        io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
    });

    socket.on('adminNuclearReset', () => {
        rooms = {};
        profiles = profiles.filter(p => p.role === 'admin');
        io.emit('lobbyUpdate', []);
        io.emit('profilesUpdate', profiles);
    });

    // --- BOT ACTIONS ---
    socket.on('adminAddBot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;

        const seatIdx = room.players.findIndex(p => p === null);
        if (seatIdx === -1) return;

        const botNames = ["Alpha", "Beta", "Gamma", "Neon", "Cyber", "Turbo", "Ace", "Jack", "Queen", "King"];
        const name = botNames[Math.floor(Math.random() * botNames.length)] + " " + Math.floor(Math.random() * 99);

        const botObj = {
            uid: 'bot_' + Math.random().toString(36).slice(2, 9),
            name: name,
            chips: room.maxBuy || 10,
            isBot: true,
            seatIdx,
            isFolded: false,
            currentBet: 0,
            hand: null,
            lastAction: null,
            winProbability: 0
        };

        room.players[seatIdx] = botObj;
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
    });

    // --- GAMEPLAY ACTIONS ---
    socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
        const room = rooms[roomId];
        if (!room) return callback({ status: 'error', message: 'Arena not found' });
        
        const seatIdx = room.players.findIndex(p => p === null);
        if (seatIdx === -1) return callback({ status: 'error', message: 'Arena full' });

        const playerObj = { 
            ...profile, 
            chips: buyIn, 
            seatIdx, 
            isFolded: false, 
            currentBet: 0, 
            hand: null, 
            lastAction: null,
            winProbability: 0
        };

        room.players[seatIdx] = playerObj;
        socket.join(roomId);
        
        callback({ status: 'ok' });
        io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
    });

    socket.on('leaveRoom', ({ uid }) => {
        Object.values(rooms).forEach(room => {
            const idx = room.players.findIndex(p => p && p.uid === uid);
            if (idx !== -1) {
                room.players[idx] = null;
                socket.leave(room.id);
                io.to(room.id).emit('roomUpdate', serializeRoom(room));
                io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
            }
        });
    });

    socket.on('playerAction', ({ roomId, type, amount }) => {
        const room = rooms[roomId];
        if (!room) return;
        // Core game action logic to be expanded
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server ${VERSION} active.`));
