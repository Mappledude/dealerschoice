const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// GLOBAL STATE: Persists as long as the server is running
let globalPlayers = []; 
let globalRooms = [];

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // --- ADMIN ACTIONS ---
    socket.on('adminCreatePlayer', (data, callback) => {
        const newPlayer = { ...data, id: Date.now(), status: 'Verified' };
        globalPlayers.push(newPlayer);
        io.emit('playerCreated', newPlayer); // Notify all admins
        if (callback) callback({ status: 'ok', player: newPlayer }); // Unlocks the "Deploying" button
    });

    socket.on('adminCreateRoom', (data, callback) => {
        const newRoom = { ...data, id: `room_${Date.now()}`, players: [], phase: 'IDLE' };
        globalRooms.push(newRoom);
        io.emit('lobbyUpdate', globalRooms); // Notify all players in lobby
        if (callback) callback({ status: 'ok', room: newRoom });
    });

    // --- PLAYER ACTIONS ---
    socket.on('playerLogin', (data, callback) => {
        const found = globalPlayers.find(p => p.name === data.name && p.password === data.password);
        if (found) {
            callback({ success: true, profile: found, rooms: globalRooms });
        } else {
            callback({ success: false, message: 'Invalid Credentials' });
        }
    });

    socket.on('disconnect', () => console.log('User Disconnected:', socket.id));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
