import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

/**
 * POKER ARENA SERVER v1.1.0 - SEEDED STABLE (ESM Version)
 * Handles game state, betting rounds, and multi-variant evaluation
 */

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 10000;

// --- SEED DATA DEFINITIONS ---
const SEEDED_PLAYERS = [
  { name: 'Vivek', password: 'sablani', uid: 'u_vivek', chips: 10000, role: 'player' },
  { name: 'Aroosa', password: 'saeed', uid: 'u_aroosa', chips: 10000, role: 'player' },
  { name: 'Ram', password: 'shahani', uid: 'u_ram', chips: 10000, role: 'player' },
  { name: 'Brij', password: 'lulla', uid: 'u_brij', chips: 10000, role: 'player' },
  { name: 'Thashaan', password: '222', uid: 'u_thashaan', chips: 10000, role: 'player' },
  { name: 'Nish', password: 'sevkani', uid: 'u_nish', chips: 10000, role: 'player' },
  { name: 'Marlon', password: 'king', uid: 'u_marlon', chips: 10000, role: 'player' },
  { name: 'Tarun', password: 'shroff', uid: 'u_tarun', chips: 10000, role: 'player' }
];

const SEEDED_ROOMS = [
  { id: 'room_10', name: '$10 Arena', sb: 0.25, bb: 0.5, minBuy: 5, maxBuy: 10 },
  { id: 'room_100', name: '$100 Arena', sb: 1, bb: 2, minBuy: 50, maxBuy: 100 },
  { id: 'room_500', name: '$500 Arena', sb: 2, bb: 5, minBuy: 200, maxBuy: 500 }
];

// --- STATE MANAGEMENT ---
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

let profiles = [...SEEDED_PLAYERS];
let rooms = SEEDED_ROOMS.map(r => ({
  ...r,
  phase: PHASES.IDLE,
  players: Array(10).fill(null),
  community: [],
  potAmount: 0,
  activeIdx: -1,
  dealerIdx: 0,
  highestBet: 0,
  deck: []
}));

// --- HELPER FUNCTIONS ---
const updateRoom = (room) => {
  io.to(room.id).emit('roomUpdate', {
    ...room,
    deck: undefined 
  });
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('getInitialData', () => {
    socket.emit('initialDataResponse', { profiles, rooms });
  });

  socket.on('playerLogin', ({ password }) => {
    const cleanPass = password.toLowerCase().trim();
    let profile = profiles.find(p => p.password.toLowerCase() === cleanPass);
    
    if (profile) {
      socket.emit('loginSuccess', profile);
      io.emit('profilesUpdate', profiles);
    } else {
      socket.emit('loginError', { message: 'Invalid Credentials' });
    }
  });

  socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return callback({ status: 'error' });

    const existingIdx = room.players.findIndex(p => p && p.uid === profile.uid);
    if (existingIdx !== -1) {
      return callback({ status: 'ok' }); 
    }

    const seatIdx = room.players.findIndex(p => p === null);
    if (seatIdx === -1) return callback({ status: 'full' });

    const player = {
      ...profile,
      chips: buyIn || profile.chips,
      currentBet: 0,
      isFolded: false,
      hand: [],
      totalContribution: 0,
      waitingForNextHand: room.phase !== PHASES.IDLE
    };

    room.players[seatIdx] = player;
    socket.join(roomId);
    
    io.to(roomId).emit('log', {
      name: "SYSTEM",
      action: `${profile.name} JOINED THE TABLE`,
      timestamp: Date.now(),
      type: 'global'
    });

    updateRoom(room);
    callback({ status: 'ok' });
  });

  socket.on('adminCreateRoom', (roomData) => {
    const newRoom = {
      ...roomData,
      phase: PHASES.IDLE,
      players: Array(10).fill(null),
      community: [],
      potAmount: 0,
      activeIdx: -1,
      dealerIdx: 0,
      highestBet: 0,
      deck: [],
    };
    rooms.push(newRoom);
    io.emit('lobbyUpdate', rooms);
  });

  socket.on('playerAction', ({ roomId, type, amount }) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room || room.activeIdx === -1) return;

    const player = room.players[room.activeIdx];
    if (!player) return;

    if (type === 'FOLD') {
      player.isFolded = true;
    } else if (type === 'RAISE') {
      const diff = amount - player.currentBet;
      player.chips -= diff;
      player.currentBet = amount;
      room.highestBet = amount;
    } else if (type === 'CALL') {
      const diff = room.highestBet - player.currentBet;
      player.chips -= diff;
      player.currentBet = room.highestBet;
    }

    updateRoom(room);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`POKER ARENA SERVER v1.1.0 RUNNING ON PORT ${PORT}`);
  console.log(`SEEDED: ${SEEDED_PLAYERS.length} Players, ${SEEDED_ROOMS.length} Rooms`);
});
