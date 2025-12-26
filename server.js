const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- AUTHORITATIVE SERVER MEMORY ---
let rooms = {};      
let profiles = [];   

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Initial Hydration
    socket.emit('lobbyUpdate', Object.values(rooms));
    socket.emit('profilesUpdate', profiles);

    // 1. NUCLEAR RESET
    socket.on('adminNuclearReset', () => {
        console.log("!!! EMERGENCY NUCLEAR RESET INITIATED !!!");
        rooms = {};
        profiles = [];
        io.emit('lobbyUpdate', []);
        io.emit('profilesUpdate', []);
        io.sockets.sockets.forEach((s) => s.disconnect(true));
    });

    // 2. ADMIN: Create Room
    socket.on('adminCreateRoom', (roomData) => {
        const roomId = roomData.id || `room_${Date.now()}`;
        rooms[roomId] = {
            ...roomData,
            id: roomId,
            phase: 'IDLE',
            players: Array(10).fill(null),
            community: [],
            potData: [{ label: 'MAIN', amount: 0, eligible: [] }],
            activeIdx: -1,
            highestBet: 0
        };
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    // 3. ADMIN: Create Player
    socket.on('adminCreatePlayer', (profile, callback) => {
        profiles.push(profile);
        io.emit('profilesUpdate', profiles);
        if (callback) callback({ status: 'ok' });
    });

    // 4. ADMIN: Delete Logic
    socket.on('adminDeleteRoom', (id) => {
        delete rooms[id];
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('adminDeletePlayer', (uid) => {
        profiles = profiles.filter(p => p.uid !== uid);
        io.emit('profilesUpdate', profiles);
    });

    // 5. PLAYER: Login
    socket.on('playerLogin', (data) => {
        const user = profiles.find(p => p.password === data.password);
        if (user) socket.emit('loginSuccess', user);
    });

    // 6. PLAYER: Join Room
    socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
        const room = rooms[roomId];
        if (room) {
            socket.join(roomId);
            const seatIdx = room.players.findIndex(p => p === null);
            if (seatIdx !== -1) {
                room.players[seatIdx] = { 
                    ...profile, 
                    chips: buyIn, 
                    seat: seatIdx,
                    isFolded: false,
                    currentBet: 0,
                    hand: []
                };
            }
            io.to(roomId).emit('roomUpdate', room);
            io.emit('lobbyUpdate', Object.values(rooms));
            if (callback) callback({ status: 'ok' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER LIVE ON PORT ${PORT}`);
});
