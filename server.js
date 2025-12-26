import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { 
        origin: "*",
        methods: ["GET", "POST"]
    } 
});

// GLOBAL STATE: Persists in server memory
let globalPlayers = []; 
let globalRooms = [];

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // --- ADMIN ACTIONS ---
    socket.on('adminCreatePlayer', (data, callback) => {
        const newPlayer = { ...data, id: Date.now(), status: 'Verified' };
        globalPlayers.push(newPlayer);
        io.emit('playerCreated', newPlayer);
        if (callback) callback({ status: 'ok', player: newPlayer });
    });

    socket.on('adminCreateRoom', (data, callback) => {
        const newRoom = { ...data, id: `room_${Date.now()}`, players: [], phase: 'IDLE' };
        globalRooms.push(newRoom);
        io.emit('lobbyUpdate', globalRooms);
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
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
