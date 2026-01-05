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

let profiles = []; 
let rooms = {};

// --- Deck Management ---
const createDeck = () => {
  let deck = [];
  let id = 1;
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ id: id++, suit, value });
    }
  }
  return deck;
};

const shuffle = (deck) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const serializeRoom = (room) => {
    if (!room) return null;
    const { deck, ...rest } = room;
    return rest;
};

// --- Game Logic ---
const startHand = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;

  const players = room.players.filter(p => p !== null);
  if (players.length < 2) return;

  room.deck = shuffle(createDeck());
  room.community = [];
  room.potAmount = 0;
  room.highestBet = room.bb;
  room.phase = PHASES.PRE_FLOP;

  // Dealing Hole Cards
  room.players.forEach((p, idx) => {
    if (p) {
      p.isFolded = false;
      p.currentBet = 0;
      p.lastAction = null;
      // Basic 2 cards deal for testing
      p.hand = [room.deck.pop(), room.deck.pop()];
      p.strength = "High Card";
      p.winProbability = 50;
    }
  });

  // Pick first active player (simplified)
  room.activeIdx = room.players.findIndex(p => p !== null);
  
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
  io.to(roomId).emit('log', { name: 'SYSTEM', action: 'NEW HAND DEALT', type: 'phase' });
};

const executeAction = (roomId, uid, type, amount) => {
  const room = rooms[roomId];
  if (!room) return;

  const playerIdx = room.players.findIndex(p => p && p.uid === uid);
  if (playerIdx === -1 || playerIdx !== room.activeIdx) return;

  const player = room.players[playerIdx];
  player.lastAction = type;

  if (type === 'FOLD') {
    player.isFolded = true;
  } else if (type === 'CALL') {
    const diff = Math.min(player.chips, room.highestBet - player.currentBet);
    player.chips -= diff;
    player.currentBet += diff;
  } else if (type === 'RAISE') {
    const totalBet = amount;
    const added = totalBet - player.currentBet;
    player.chips -= added;
    player.currentBet = totalBet;
    if (totalBet > room.highestBet) room.highestBet = totalBet;
  }

  // Move Turn
  let nextIdx = (room.activeIdx + 1) % 10;
  let found = false;
  for (let i = 0; i < 10; i++) {
    const p = room.players[nextIdx];
    if (p && !p.isFolded) {
      room.activeIdx = nextIdx;
      found = true;
      break;
    }
    nextIdx = (nextIdx + 1) % 10;
  }

  if (!found) room.phase = PHASES.SHOWDOWN;

  io.to(roomId).emit('roomUpdate', serializeRoom(room));
  io.to(roomId).emit('log', { name: player.name, action: type, amount: `$${amount || room.highestBet}` });
  
  // If showdown, wait and reset
  if (room.phase === PHASES.SHOWDOWN) {
    setTimeout(() => {
      room.phase = PHASES.IDLE;
      io.to(roomId).emit('roomUpdate', serializeRoom(room));
    }, 5000);
  } else {
    processBotTurn(roomId);
  }
};

const processBotTurn = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;
  const player = room.players[room.activeIdx];
  if (player && player.isBot) {
    setTimeout(() => {
      executeAction(roomId, player.uid, 'CALL', 0);
    }, 1500);
  }
};

io.on('connection', (socket) => {
    socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) }));

    socket.on('adminAddBot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const seatIdx = room.players.findIndex(p => p === null);
        if (seatIdx === -1) return;

        const botId = 'bot_' + Math.random().toString(36).slice(2, 7);
        room.players[seatIdx] = { 
            uid: botId, name: "BOT_" + botId.toUpperCase(), 
            chips: room.maxBuy || 100, isBot: true, seatIdx, 
            isFolded: false, currentBet: 0, hand: null, lastAction: null
        };

        if (room.phase === PHASES.IDLE) startHand(roomId);
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
        processBotTurn(roomId);
    });

    socket.on('playerAction', ({ roomId, type, amount }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players[room.activeIdx];
        if (player) executeAction(roomId, player.uid, type, amount);
    });

    socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
        const room = rooms[roomId];
        if (!room) return callback({ status: 'error' });
        const seatIdx = room.players.findIndex(p => p === null);
        if (seatIdx === -1) return callback({ status: 'error' });

        room.players[seatIdx] = { ...profile, chips: buyIn, seatIdx, isFolded: false, currentBet: 0, hand: null };
        socket.join(roomId);
        callback({ status: 'ok' });
        io.to(roomId).emit('roomUpdate', serializeRoom(room));
    });

    socket.on('adminCreateRoom', (data) => {
        const roomId = data.id || 'room_' + Math.random().toString(36).slice(2, 9);
        rooms[roomId] = { id: roomId, name: data.name || "Arena", sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10, players: Array(10).fill(null), phase: PHASES.IDLE, community: [], potAmount: 0, highestBet: 0.5, activeIdx: -1, dealerIdx: 0, activeVariant: { id: 'HOLDEM' } };
        io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
    });

    socket.on('playerLogin', ({ password }) => {
        const profile = profiles.find(p => p.password === password);
        if (profile) socket.emit('loginSuccess', profile);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server ${VERSION} ready.`));
