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
let rooms = {};      // Game states indexed by ID
let profiles = [];   // Player registry
let globalLogs = [];

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Initial Hydration for the client
    socket.emit('lobbyUpdate', Object.values(rooms));
    socket.emit('profilesUpdate', profiles);

    // 1. NUCLEAR RESET
    socket.on('adminNuclearReset', (callback) => {
        console.log("!!! EMERGENCY NUCLEAR RESET INITIATED !!!");
        
        rooms = {};
        profiles = [];
        globalLogs = [];

        // Broadcast wipe to all clients
        io.emit('lobbyUpdate', []);
        io.emit('profilesUpdate', []);
        io.emit('globalLog', { name: 'SYSTEM', action: 'SERVER WIPED', type: 'system' });

        // Force disconnect all to clear stale states
        io.sockets.sockets.forEach((s) => {
            s.disconnect(true);
        });

        if (callback) callback({ status: 'ok' });
    });

    // 2. ADMIN: Create Room
    socket.on('adminCreateRoom', (roomData, callback) => {
        const newRoom = {
            ...roomData,
            id: roomData.id || `room_${Date.now()}`,
            phase: 'IDLE',
            players: Array(10).fill(null),
            community: [],
            potData: [{ label: 'MAIN', amount: 0, eligible: [] }],
            activeIdx: -1,
            highestBet: 0
        };
        rooms[newRoom.id] = newRoom;
        io.emit('lobbyUpdate', Object.values(rooms));
        console.log(`Room Created: ${newRoom.name}`);
        if (callback) callback({ status: 'ok', room: newRoom });
    });

    // 3. ADMIN: Create Player
    socket.on('adminCreatePlayer', (profileData, callback) => {
        const newPlayer = { 
            ...profileData, 
            uid: profileData.uid || Math.random().toString(36).substr(2, 9),
            status: 'Verified' 
        };
        profiles.push(newPlayer);
        io.emit('profilesUpdate', profiles);
        if (callback) callback({ status: 'ok', player: newPlayer });
    });

    // 4. ADMIN: Delete Room / Player
    socket.on('adminDeleteRoom', (roomId) => {
        delete rooms[roomId];
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('adminDeletePlayer', (uid) => {
        profiles = profiles.filter(p => p.uid !== uid);
        io.emit('profilesUpdate', profiles);
    });

    // 5. PLAYER: Login
    socket.on('playerLogin', (data) => {
        const user = profiles.find(p => p.password === data.password);
        if (user) {
            socket.emit('loginSuccess', user);
        }
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

    // 7. GAME: Player Actions
    socket.on('playerAction', (data) => {
        console.log("Action received:", data);
        // Game engine logic would go here
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`POKER SERVER RUNNING ON PORT ${PORT}`);
});
