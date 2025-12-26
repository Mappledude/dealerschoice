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

// --- SERVER STATE (RAM) ---
let rooms = {};      // Stores active game states
let profiles = [];   // Stores player bankrolls and passcodes
let globalLogs = [];

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Initial Hydration
    socket.emit('lobbyUpdate', Object.values(rooms));
    socket.emit('profilesUpdate', profiles);

    // 1. NUCLEAR RESET (The "Kill" Command)
    socket.on('adminNuclearReset', () => {
        console.log("!!! EMERGENCY NUCLEAR RESET INITIATED !!!");
        
        rooms = {};
        profiles = [];
        globalLogs = [];

        // Broadcast the wipe to all connected clients
        io.emit('lobbyUpdate', []);
        io.emit('profilesUpdate', []);
        io.emit('globalLog', { name: 'SYSTEM', action: 'SERVER WIPED', type: 'system' });

        // Force everyone to the login screen by disconnecting sockets
        // This clears any "stale" connections hanging onto old data
        io.sockets.sockets.forEach((s) => {
            s.disconnect(true);
        });
    });

    // 2. ADMIN: Create Room
    socket.on('adminCreateRoom', (roomData) => {
        const newRoom = {
            ...roomData,
            phase: 'IDLE',
            players: Array(10).fill(null),
            community: [],
            potData: [{ label: 'MAIN', amount: 0, eligible: [] }],
            activeIdx: -1,
            highestBet: 0
        };
        rooms[roomData.id] = newRoom;
        io.emit('lobbyUpdate', Object.values(rooms));
        console.log(`Room Created: ${roomData.name}`);
    });

    // 3. ADMIN: Create Player
    socket.on('adminCreatePlayer', (profile, callback) => {
        profiles.push(profile);
        io.emit('profilesUpdate', profiles);
        if (callback) callback({ status: 'ok' });
    });

    // 4. ADMIN: Delete Room
    socket.on('adminDeleteRoom', (roomId) => {
        delete rooms[roomId];
        io.emit('lobbyUpdate', Object.values(rooms));
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
            
            // Find first empty seat
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
            io.emit('lobbyUpdate', Object.values(rooms)); // Update player count in lobby
            if (callback) callback({ status: 'ok' });
        }
    });

    // 7. GAME: Player Actions
    socket.on('playerAction', (data) => {
        // Here you would implement your betting logic, 
        // updating the room object and emitting 'roomUpdate'
        console.log("Action received:", data);
    });

    socket.on('disconnect', () => {
        console.log(`User Disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
    console.log(`POKER SERVER RUNNING ON PORT ${PORT}`);
});
