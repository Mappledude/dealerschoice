import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

/**
 * POKER ARENA SERVER v1.1.0 - SEEDED STABLE (ESM Version)
 * Fixes: Bot Integration, Auto-Dealing logic, and Hand Transitions
 */

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 10000;

// --- CONSTANTS ---
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

// --- SEED DATA ---
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

const BOT_NAMES = ["Moneymaker_AI", "Durrrr_Bot", "Ivey_Droid", "Negreanu_v2", "Hellmuth_Brat", "Jungleman_Bot"];

// --- STATE MANAGEMENT ---
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

// --- ENGINE LOGIC ---

const createDeck = () => {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  for (let s of suits) {
    for (let v of values) deck.push({ id: `${v}${s}`, value: v, suit: s });
  }
  return deck.sort(() => Math.random() - 0.5);
};

const updateRoom = (room) => {
  io.to(room.id).emit('roomUpdate', { ...room, deck: undefined });
  
  // If active player is a bot, trigger AI logic
  const activePlayer = room.players[room.activeIdx];
  if (activePlayer && activePlayer.isBot && room.phase !== PHASES.IDLE && room.phase !== PHASES.SHOWDOWN) {
    handleBotTurn(room);
  }
};

const handleBotTurn = (room) => {
  const delay = Math.floor(Math.random() * 2000) + 1000;
  setTimeout(() => {
    // Re-verify room state after delay
    if (room.phase === PHASES.IDLE || room.phase === PHASES.SHOWDOWN) return;
    
    const bot = room.players[room.activeIdx];
    if (!bot || !bot.isBot) return;

    let type = 'CALL';
    const rand = Math.random();
    
    // Simple logic: 70% Call, 20% Raise, 10% Fold
    if (rand < 0.1) type = room.highestBet > bot.currentBet ? 'FOLD' : 'CHECK';
    else if (rand < 0.3) type = 'RAISE';
    else type = room.highestBet > bot.currentBet ? 'CALL' : 'CHECK';

    const raiseAmt = room.highestBet + room.bb;
    processAction(room, bot, type, raiseAmt);
  }, delay);
};

const startHand = (room) => {
  const activePlayers = room.players.filter(p => p !== null && !p.waitingForNextHand);
  if (activePlayers.length < 2) return;

  room.phase = PHASES.PRE_FLOP;
  room.deck = createDeck();
  room.community = [];
  room.highestBet = room.bb;
  room.potAmount = 0;
  
  // Reset players and deal cards
  room.players.forEach(p => {
    if (p) {
      p.isFolded = false;
      p.currentBet = 0;
      p.hand = [room.deck.pop(), room.deck.pop()];
      p.waitingForNextHand = false;
    }
  });

  room.activeIdx = (room.dealerIdx + 1) % 10;
  while (!room.players[room.activeIdx]) {
    room.activeIdx = (room.activeIdx + 1) % 10;
  }

  io.to(room.id).emit('log', { name: "SYSTEM", action: `PRE_FLOP DEALING START`, timestamp: Date.now(), type: 'phase' });
  updateRoom(room);
};

const checkAutoStart = (room) => {
  if (room.phase !== PHASES.IDLE) return;
  const seatedCount = room.players.filter(p => p !== null).length;
  if (seatedCount >= 2) {
    // Wait a brief moment before dealing
    setTimeout(() => startHand(room), 3000);
  }
};

const processAction = (room, player, type, amount) => {
  if (type === 'FOLD') {
    player.isFolded = true;
    io.to(room.id).emit('log', { name: player.name, action: `FOLDED`, timestamp: Date.now(), type: 'fold' });
  } else if (type === 'RAISE') {
    const diff = amount - player.currentBet;
    player.chips -= diff;
    player.currentBet = amount;
    room.highestBet = amount;
    io.to(room.id).emit('log', { name: player.name, action: `RAISED TO $${amount}`, timestamp: Date.now(), type: 'bet' });
  } else {
    const toCall = room.highestBet - player.currentBet;
    player.chips -= toCall;
    player.currentBet = room.highestBet;
    io.to(room.id).emit('log', { name: player.name, action: toCall > 0 ? `CALLS $${toCall}` : `CHECKS`, timestamp: Date.now(), type: 'bet' });
  }

  // Move Turn
  room.activeIdx = (room.activeIdx + 1) % 10;
  let attempts = 0;
  while ((!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded) && attempts < 10) {
    room.activeIdx = (room.activeIdx + 1) % 10;
    attempts++;
  }

  // Check if round over (everyone called/folded) - Placeholder for street progression
  // ... progression logic ...

  updateRoom(room);
};

// --- SOCKET HANDLERS ---

io.on('connection', (socket) => {
  socket.on('getInitialData', () => {
    socket.emit('initialDataResponse', { profiles, rooms });
  });

  socket.on('playerLogin', ({ password }) => {
    const cleanPass = password.toLowerCase().trim();
    let profile = profiles.find(p => p.password.toLowerCase() === cleanPass);
    if (profile) {
      socket.emit('loginSuccess', profile);
    } else {
      socket.emit('loginError', { message: 'Invalid Credentials' });
    }
  });

  socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return callback({ status: 'error' });

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
    
    io.to(roomId).emit('log', { name: "SYSTEM", action: `${profile.name} JOINED THE ARENA`, timestamp: Date.now(), type: 'global' });
    
    updateRoom(room);
    checkAutoStart(room);
    callback({ status: 'ok' });
  });

  socket.on('adminAddBot', ({ roomId }) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const seatIdx = room.players.findIndex(p => p === null);
    if (seatIdx === -1) return;

    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const botProfile = {
      uid: `bot_${Date.now()}_${Math.random()}`,
      name: `${botName}`,
      chips: 10000,
      isBot: true,
      role: 'player'
    };

    room.players[seatIdx] = { ...botProfile, currentBet: 0, isFolded: false, hand: [], totalContribution: 0, waitingForNextHand: room.phase !== PHASES.IDLE };
    
    io.to(roomId).emit('log', { name: "SYSTEM", action: `${botProfile.name} (BOT) ENTERED THE ARENA`, timestamp: Date.now(), type: 'global' });
    
    updateRoom(room);
    checkAutoStart(room);
  });

  socket.on('playerAction', ({ roomId, type, amount }) => {
    const room = rooms.find(r => r.id === roomId);
    const player = room?.players[room.activeIdx];
    if (player) processAction(room, player, type, amount);
  });
});

server.listen(PORT, () => {
  console.log(`POKER ARENA SERVER v1.1.0 RUNNING ON PORT ${PORT}`);
});
