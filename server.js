import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] } 
});

// Authoritative Server Memory
let globalPlayers = []; 
let globalRooms = [];

io.on('connection', (socket) => {
    console.log('User Connected:', socket.id);

    // --- ADMIN ACTIONS ---
    socket.on('adminCreatePlayer', (data, callback) => {
        const newPlayer = { ...data, id: Date.now(), status: 'Verified' };
        globalPlayers.push(newPlayer);
        io.emit('profilesUpdate', globalPlayers); 
        if (callback) callback({ status: 'ok', player: newPlayer });
    });

    socket.on('adminDeletePlayer', (playerId) => {
        globalPlayers = globalPlayers.filter(p => p.id !== playerId);
        io.emit('profilesUpdate', globalPlayers); 
    });

    socket.on('adminCreateRoom', (data, callback) => {
        const newRoom = { ...data, id: `room_${Date.now()}`, players: Array(10).fill(null), phase: 'IDLE' };
        globalRooms.push(newRoom);
        io.emit('lobbyUpdate', globalRooms);
        if (callback) callback({ status: 'ok', room: newRoom });
    });

    socket.on('adminDeleteRoom', (roomId) => {
        globalRooms = globalRooms.filter(r => r.id !== roomId);
        io.emit('lobbyUpdate', globalRooms); 
    });

    // NEW: The Triple Purge Backend Handler
    socket.on('adminNuclearReset', (callback) => {
        globalPlayers = []; 
        globalRooms = [];
        io.emit('profilesUpdate', []); // Wipe all client registries
        io.emit('lobbyUpdate', []);    // Wipe all client lobbies
        if (callback) callback({ status: 'ok' });
    });

    // --- PLAYER & ROOM SYNC ---
    socket.on('playerLogin', (data, callback) => {
        const found = globalPlayers.find(p => p.name === data.name && p.password === data.password);
        if (found) {
            callback({ success: true, profile: found, rooms: globalRooms });
        } else {
            callback({ success: false, message: 'Invalid Credentials' });
        }
    });

    socket.on('joinRoom', ({ roomId, profile, buyIn }) => {
        socket.join(roomId);
        const room = globalRooms.find(r => r.id === roomId);
        if (room) {
            const seatIndex = room.players.findIndex(p => p === null);
            if (seatIndex !== -1) {
                room.players[seatIndex] = { ...profile, tableChips: buyIn, socketId: socket.id };
            }
            io.to(roomId).emit('roomUpdate', room);
            io.emit('lobbyUpdate', globalRooms);
        }
    });

    socket.on('disconnect', () => {
        console.log('User Disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
