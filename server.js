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

let profiles = [
  { name: 'SYSTEM ADMIN', uid: 'admin_sys', password: 'pass', chips: 1000000, role: 'admin' }
]; 
let rooms = {};

// --- Helper Functions ---
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
    const { deck, ignitionTimer, ...rest } = room;
    return rest;
};

// --- Core Game Logic ---

const checkAndStartGame = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.phase !== PHASES.IDLE) return;

    const activeCount = room.players.filter(p => p !== null).length;
    
    // Logic: Deal cards 5 seconds after at least 2 players have joined
    if (activeCount >= 2 && !room.ignitionTimer) {
        io.to(roomId).emit('log', { name: 'SYSTEM', action: '2 PLAYERS DETECTED. DEALING IN 5 SECONDS...', type: 'phase' });
        
        room.ignitionTimer = setTimeout(() => {
            // Re-check count inside timeout to ensure players didn't leave
            const currentActiveCount = room.players.filter(p => p !== null).length;
            if (currentActiveCount >= 2) {
                startHand(roomId);
            } else {
                io.to(roomId).emit('log', { name: 'SYSTEM', action: 'PLAYER DISCONNECTED. WAITING FOR 2 PLAYERS...', type: 'phase' });
            }
            room.ignitionTimer = null;
            io.to(roomId).emit('roomUpdate', serializeRoom(room));
        }, 5000);
    }
};

const startHand = (roomId) => {
  const room = rooms[roomId];
  if (!room) return;

  room.deck = shuffle(createDeck());
  room.community = [];
  room.potAmount = 0;
  room.highestBet = room.bb;
  room.phase = PHASES.PRE_FLOP;

  room.players.forEach((p) => {
    if (p) {
      p.isFolded = false;
      p.currentBet = 0;
      p.lastAction = null;
      p.hand = [room.deck.pop(), room.deck.pop()];
      p.strength = "High Card";
      p.winProbability = 50;
    }
  });

  room.activeIdx = room.players.findIndex(p => p !== null);
  
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
  io.to(roomId).emit('log', { name: 'SYSTEM', action: 'NEW HAND DEALT', type: 'phase' });
  processBotTurn(roomId);
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
    const totalBet = Math.max(room.highestBet + room.bb, amount);
    const added = totalBet - player.currentBet;
    player.chips -= added;
    player.currentBet = totalBet;
    if (totalBet > room.highestBet) room.highestBet = totalBet;
  }

  // Next Turn
  let nextIdx = (room.activeIdx + 1) % 10;
  let found = false;
  for (let i = 0; i < 10; i++) {
    const p = room.players[nextIdx];
    if (p && !p.isFolded && p.chips > 0) {
      room.activeIdx = nextIdx;
      found = true;
      break;
    }
    nextIdx = (nextIdx + 1) % 10;
  }

  if (!found) room.phase = PHASES.SHOWDOWN;

  io.to(roomId).emit('roomUpdate', serializeRoom(room));
  io.to(roomId).emit('log', { name: player.name, action: type, amount: amount > 0 ? `$${amount}` : '' });
  
  if (room.phase === PHASES.SHOWDOWN) {
    setTimeout(() => {
      room.phase = PHASES.IDLE;
      io.to(roomId).emit('roomUpdate', serializeRoom(room));
      checkAndStartGame(roomId);
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

// --- Socket Handlers ---
io.on('connection', (socket) => {
    socket.on('getInitialData', () => {
        socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) });
    });

    socket.on('adminCreatePlayer', (p) => { 
        profiles.push({ ...p, uid: p.uid || 'u_' + Math.random().toString(36).slice(2, 9), chips: Number(p.chips || 100), role: 'player' }); 
        io.emit('profilesUpdate', profiles); 
    });

    socket.on('adminCreateRoom', (data) => {
        const roomId = data.id || 'room_' + Math.random().toString(36).slice(2, 9);
        rooms[roomId] = { 
            id: roomId, name: data.name || "Arena", sb: 0.25, bb: 0.50, players: Array(10).fill(null), 
            phase: PHASES.IDLE, community: [], potAmount: 0, highestBet: 0, activeIdx: -1, dealerIdx: 0, activeVariant: { id: 'HOLDEM' } 
        };
        io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom));
    });

    socket.on('adminAddBot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const seatIdx = room.players.findIndex(p => p === null);
        if (seatIdx === -1) return;

        room.players[seatIdx] = { 
            uid: 'bot_' + Math.random().toString(36).slice(2, 7), name: "BOT_X", 
            chips: 100, isBot: true, seatIdx, isFolded: false, currentBet: 0, hand: null, lastAction: null
        };

        io.to(roomId).emit('roomUpdate', serializeRoom(room));
        checkAndStartGame(roomId);
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
        checkAndStartGame(roomId);
    });

    socket.on('playerAction', ({ roomId, type, amount }) => {
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players[room.activeIdx];
        if (player) executeAction(roomId, player.uid, type, amount);
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server ${VERSION} ready.`));
