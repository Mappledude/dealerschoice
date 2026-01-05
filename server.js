import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v1.8.1-ULTRA";
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

const combinations = (array, k) => {
  let result = [];
  const fn = (start, prev) => {
    if (prev.length === k) { result.push(prev); return; }
    for (let i = start; i < array.length; i++) { fn(i + 1, [...prev, array[i]]); }
  };
  fn(0, []);
  return result;
};

const rankHand = (cards) => {
  if (!cards || cards.length < 5) return { power: 0, name: "Evaluating" };
  const ranks = cards.map(c => VM[c.value]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
  const isFlush = new Set(suits).size === 1;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false, straightHigh = 0;
  for (let i = 0; i <= uniqueRanks.length - 5; i++) { if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; } }
  if (!isStraight && uniqueRanks.includes(14) && [5,4,3,2].every(r => uniqueRanks.includes(r))) { isStraight = true; straightHigh = 5; }
  const vc = groups.map(x => x.c);
  let score = 0, name = "High Card";
  if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
  else if (vc[0] === 4) { score = 7; name = "Four of a Kind"; }
  else if (vc[0] === 3 && vc[1] >= 2) { score = 6; name = "Full House"; }
  else if (isFlush) { score = 5; name = "Flush"; }
  else if (isStraight) { score = 4; name = "Straight"; }
  else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
  else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
  else if (vc[0] === 2) { score = 1; name = "Pair"; }
  const power = score * Math.pow(15, 7) + groups.reduce((acc, g, i) => acc + (g.r * Math.pow(15, 6 - i)), 0);
  return { power, name, cards: cards.slice(0, 5) };
};

const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0 || !comm || comm.length < 3) return { high: { power: 0, name: "..." }, low: null };
    let bestHigh = { power: -1, name: "Evaluating..." };
    let bestLow = null;
    if (variantId === 'HOLDEM' || variantId === 'PINEAPPLE' || variantId === 'MUFLIS') {
        combinations([...hole, ...comm], 5).forEach(c => {
            const res = rankHand(c);
            if (variantId === 'MUFLIS') { if (bestHigh.power === -1 || res.power < bestHigh.power) bestHigh = res; }
            else { if (res.power > bestHigh.power) bestHigh = res; }
        });
    } else if (variantId === 'OMAHA' || variantId === 'HILOW' || variantId === 'REDSBLACKS') {
        const boardCombos = combinations(comm, 3);
        const holePairs = combinations(hole, 2);
        holePairs.forEach(h => { boardCombos.forEach(b => {
            const res = rankHand([...h, ...b]);
            if (res.power > bestHigh.power) bestHigh = res;
            if (variantId === 'HILOW' && res.name === "High Card") { if (!bestLow || res.power < bestLow.power) bestLow = res; }
        }); });
    }
    return { high: bestHigh, low: bestLow };
};

io.on('connection', (socket) => {
    socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) }));

    socket.on('playerLogin', ({ password }) => {
        const profile = profiles.find(p => p.password === password);
        if (profile) socket.emit('loginSuccess', profile);
    });

    socket.on('adminCreatePlayer', (p) => { 
        profiles.push({ ...p, uid: 'u_' + Math.random().toString(36).slice(2, 9), chips: Number(p.chips) }); 
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
            name: data.name || "Arena",
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
        
        // Critical: Join the socket room to receive table updates
        socket.join(roomId);
        
        callback({ status: 'ok' });
        
        // Broadcast updates
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
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server ${VERSION} ready.`));
