const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- STATE ---
let profiles = []; 
let rooms = {};

// --- BOT NAMES ---
const BOT_NAMES = ["Ace_Bot", "River_Rat", "Sharky", "BluffMaster", "Foldy", "AllIn_Annie", "Checky", "GambleTron", "PokerFace", "Moneymaker"];

io.on('connection', (socket) => {
    // ... (Login and Lobby events remain the same) ...

    socket.on('playerLogin', ({ password }) => {
        let p = profiles.find(x => x.password === password);
        if (!p && password) {
            p = { uid: 'u_' + Math.random().toString(36).slice(2, 7), name: `Player_${password}`, password, chips: 5000, pendingVariant: 'HOLDEM' };
            profiles.push(p);
        }
        if (p) socket.emit('loginSuccess', p);
    });

    socket.on('getInitialData', () => {
        socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms) });
    });

    socket.on('adminCreateRoom', (config) => {
        rooms[config.id] = {
            ...config,
            players: Array(10).fill(null),
            community: [],
            potData: [{ amount: 0 }],
            phase: 'IDLE',
            highestBet: 0,
            dealerIdx: 0,
            activeIdx: -1
        };
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
        const room = rooms[roomId];
        if (!room) return callback({ status: 'error' });
        const seat = room.players.findIndex(p => p === null);
        if (seat === -1) return callback({ status: 'full' });

        room.players[seat] = { ...profile, chips: buyIn, currentBet: 0, isFolded: false, seatIdx: seat };
        socket.join(roomId);
        io.to(roomId).emit('roomUpdate', room);
        callback({ status: 'ok' });
    });

    // --- ADD BOT LOGIC ---
    socket.on('adminAddBot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const seat = room.players.findIndex(p => p === null);
        if (seat === -1) return;

        const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + "_" + Math.floor(Math.random() * 99);
        const botId = 'bot_' + Math.random().toString(36).slice(2, 7);
        
        room.players[seat] = {
            uid: botId,
            name: botName,
            chips: 1000,
            currentBet: 0,
            isFolded: false,
            isBot: true,
            seatIdx: seat
        };

        io.to(roomId).emit('roomUpdate', room);
        io.to(roomId).emit('log', { name: "SYSTEM", action: `added bot ${botName}`, type: 'variant' });
    });

    socket.on('adminNuclearReset', () => {
        rooms = {};
        profiles = [];
        io.emit('lobbyUpdate', []);
        io.emit('profilesUpdate', []);
    });
});

server.listen(10000, () => console.log("Server v0.1.2 Running"));
