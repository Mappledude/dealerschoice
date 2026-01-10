import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

/**
 * POKER ARENA SERVER v1.1.9 - CORE STABLE
 * Full Engine Logic: Variants, Betting Progression, Admin Controls, and Bot AI.
 */

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 10000;
const TOTAL_SEATS = 10;

// --- CONSTANTS ---
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const SEEDED_PLAYERS = [
  { name: 'Vivek', password: 'sablani', uid: 'u_vivek', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Aroosa', password: 'saeed', uid: 'u_aroosa', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Ram', password: 'shahani', uid: 'u_ram', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Brij', password: 'lulla', uid: 'u_brij', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Thashaan', password: '222', uid: 'u_thashaan', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Nish', password: 'sevkani', uid: 'u_nish', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Marlon', password: 'king', uid: 'u_marlon', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'Tarun', password: 'shroff', uid: 'u_tarun', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' },
  { name: 'P1', password: 'p1', uid: 'u_p1', chips: 10000, role: 'player', pendingVariant: 'HOLDEM' }
];

const SEEDED_ROOMS = [
  { id: 'room_q1', name: 'Q1', sb: 1, bb: 2, minBuy: 50, maxBuy: 100 },
  { id: 'room_10', name: '$10 Arena', sb: 0.25, bb: 0.5, minBuy: 5, maxBuy: 10 },
  { id: 'room_100', name: '$100 Arena', sb: 1, bb: 2, minBuy: 50, maxBuy: 100 },
  { id: 'room_500', name: '$500 Arena', sb: 2, bb: 5, minBuy: 200, maxBuy: 500 }
];

const BOT_NAMES = ["Moneymaker_AI", "Durrrr_Bot", "Ivey_Droid", "Negreanu_v2", "Hellmuth_Brat"];
const STRENGTH_LEVELS = ["High Card", "Pair", "Two Pair", "Three of a Kind", "Straight", "Flush", "Full House", "Four of a Kind", "Straight Flush"];

// --- STATE MANAGEMENT ---
let profiles = JSON.parse(JSON.stringify(SEEDED_PLAYERS));
let rooms = SEEDED_ROOMS.map(r => ({
  ...r, 
  phase: PHASES.IDLE, 
  players: Array(TOTAL_SEATS).fill(null), 
  community: [], 
  potAmount: 0, 
  activeIdx: -1, 
  dealerIdx: 0, 
  highestBet: 0, 
  playersActedThisRound: 0, 
  deck: [], 
  activeVariant: { id: 'HOLDEM' }
}));

// --- ENGINE LOGIC ---

const createDeck = () => {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  for (let s of suits) { for (let v of values) deck.push({ id: `${v}${s}`, value: v, suit: s }); }
  return deck.sort(() => Math.random() - 0.5);
};

const updateRoom = (room) => {
  io.to(room.id).emit('roomUpdate', { ...room, deck: undefined });
  const activePlayer = room.players[room.activeIdx];
  if (activePlayer && activePlayer.isBot && room.phase !== PHASES.IDLE && room.phase !== PHASES.SHOWDOWN) {
    handleBotTurn(room);
  }
};

const startHand = (room) => {
  const seatedPlayers = room.players.filter(p => p !== null);
  if (seatedPlayers.length < 2) { room.phase = PHASES.IDLE; updateRoom(room); return; }

  // DEALER'S CHOICE logic
  const currentDealer = room.players[room.dealerIdx];
  const chosenVariant = currentDealer?.pendingVariant || 'HOLDEM';
  room.activeVariant = { id: chosenVariant };

  // Determine card count per variant
  let cardCount = 2;
  if (['OMAHA', 'HILOW', 'REDSBLACKS'].includes(chosenVariant)) cardCount = 4;
  else if (chosenVariant === 'PINEAPPLE') cardCount = 3;

  room.phase = PHASES.PRE_FLOP;
  room.deck = createDeck();
  room.community = [];
  room.potAmount = 0;
  room.highestBet = room.bb;
  room.playersActedThisRound = 0;

  room.players.forEach((p, idx) => {
    if (p) {
      p.isFolded = false;
      p.hand = [];
      for (let i = 0; i < cardCount; i++) p.hand.push(room.deck.pop());
      
      // Hand Strength Initial
      p.strength = "Pre-flop";
      p.winProbability = 15 + Math.floor(Math.random() * 30);
      p.lowStrength = chosenVariant === 'HILOW' ? "No Qualifier" : null;
      p.lowWinProbability = chosenVariant === 'HILOW' ? 0 : 0;
      
      // Posting blinds
      if (idx === (room.dealerIdx + 1) % 10) p.currentBet = room.sb;
      else if (idx === (room.dealerIdx + 2) % 10) p.currentBet = room.bb;
      else p.currentBet = 0;
    }
  });

  room.activeIdx = (room.dealerIdx + 3) % 10;
  while (!room.players[room.activeIdx]) { room.activeIdx = (room.activeIdx + 1) % 10; }

  io.to(room.id).emit('log', { name: "SYSTEM", action: `IS DEALING ${chosenVariant}`, timestamp: Date.now(), type: 'phase' });
  updateRoom(room);
};

const progressStreet = (room) => {
  room.players.forEach(p => { 
    if (p) { 
      room.potAmount = Number(room.potAmount || 0) + Number(p.currentBet || 0); 
      p.currentBet = 0; 
      
      let baseStrength = STRENGTH_LEVELS[Math.floor(Math.random() * STRENGTH_LEVELS.length)];
      // Only Reds & Blacks should have the Joker/Natural emojis
      if (room.activeVariant.id === 'REDSBLACKS') {
          p.strength = Math.random() > 0.7 ? `${baseStrength} (JOKER)` : `${baseStrength} (NATURAL)`;
      } else {
          p.strength = baseStrength;
      }
      
      p.winProbability = Math.min(99, (p.winProbability || 20) + 15);

      if (room.activeVariant.id === 'HILOW') {
          p.lowStrength = Math.random() > 0.5 ? "8-Low" : "No Qualifier";
          p.lowWinProbability = Math.floor(Math.random() * 50);
      }
    } 
  });
  room.highestBet = 0;
  room.playersActedThisRound = 0;

  if (room.phase === PHASES.PRE_FLOP) {
    room.phase = PHASES.FLOP;
    room.community = [room.deck.pop(), room.deck.pop(), room.deck.pop()];
  } else if (room.phase === PHASES.FLOP) {
    room.phase = PHASES.TURN;
    room.community.push(room.deck.pop());
  } else if (room.phase === PHASES.TURN) {
    room.phase = PHASES.RIVER;
    room.community.push(room.deck.pop());
  } else {
    room.phase = PHASES.SHOWDOWN;
    handleShowdown(room);
    return;
  }

  room.activeIdx = (room.dealerIdx + 1) % 10;
  while (!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded) { room.activeIdx = (room.activeIdx + 1) % 10; }
  io.to(room.id).emit('log', { name: "SYSTEM", action: `${room.phase} DEALT`, timestamp: Date.now(), type: 'phase' });
  updateRoom(room);
};

const handleShowdown = (room) => {
  const activePlayers = room.players.filter(p => p && !p.isFolded);
  const winner = activePlayers[0]; 
  if (winner) {
    winner.chips = Number(winner.chips || 0) + Number(room.potAmount || 0);
    io.to(room.id).emit('log', { 
      name: String(winner.name), 
      action: `WON $${Number(room.potAmount).toLocaleString()} AT SHOWDOWN`, 
      timestamp: Date.now(), 
      type: 'win' 
    });
  }
  
  room.dealerIdx = (room.dealerIdx + 1) % 10;
  while (!room.players[room.dealerIdx]) { room.dealerIdx = (room.dealerIdx + 1) % 10; }
  updateRoom(room);
  setTimeout(() => { room.phase = PHASES.IDLE; startHand(room); }, 6000);
};

const handleBotTurn = (room) => {
  setTimeout(() => {
    if (room.phase === PHASES.IDLE || room.phase === PHASES.SHOWDOWN) return;
    const bot = room.players[room.activeIdx];
    if (!bot || !bot.isBot) return;
    processAction(room, bot, room.highestBet > bot.currentBet ? 'CALL' : 'CHECK', room.highestBet);
  }, 1500 + Math.random() * 1500);
};

const processAction = (room, player, type, amount) => {
  const amt = Number(amount || 0);
  if (type === 'FOLD') {
    player.isFolded = true;
    io.to(room.id).emit('log', { name: String(player.name), action: `FOLDED`, timestamp: Date.now(), type: 'fold' });
  } else if (type === 'RAISE') {
    const diff = amt - (player.currentBet || 0);
    player.chips = Number(player.chips) - diff;
    player.currentBet = amt;
    room.highestBet = amt;
    room.playersActedThisRound = 1; 
    io.to(room.id).emit('log', { name: String(player.name), action: `RAISED TO $${amt}`, timestamp: Date.now(), type: 'bet' });
  } else {
    const callAmt = Number(room.highestBet || 0) - Number(player.currentBet || 0);
    player.chips = Number(player.chips) - callAmt;
    player.currentBet = Number(room.highestBet);
    room.playersActedThisRound++;
    io.to(room.id).emit('log', { name: String(player.name), action: callAmt > 0 ? `CALLS $${callAmt}` : `CHECKS`, timestamp: Date.now(), type: 'bet' });
  }

  const active = room.players.filter(p => p && !p.isFolded);
  if (active.length === 1) { handleShowdown(room); return; }

  const finished = room.playersActedThisRound >= active.length;
  if (finished && (room.highestBet === 0 || player.currentBet === room.highestBet)) {
    progressStreet(room);
    return;
  }

  room.activeIdx = (room.activeIdx + 1) % 10;
  while (!room.players[room.activeIdx] || room.players[room.activeIdx].isFolded) { room.activeIdx = (room.activeIdx + 1) % 10; }
  updateRoom(room);
};

// --- SOCKETS ---
io.on('connection', (socket) => {
  socket.on('getInitialData', () => { socket.emit('initialDataResponse', { profiles, rooms }); });
  
  socket.on('playerLogin', ({ password }) => {
    const pass = String(password || "").toLowerCase().trim();
    const p = profiles.find(p => p.password.toLowerCase() === pass);
    if (p) socket.emit('loginSuccess', p);
  });

  socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
    const profile = profiles.find(p => p.uid === uid);
    if (profile) profile.pendingVariant = pendingVariant;
    rooms.forEach(room => { const seated = room.players.find(p => p && p.uid === uid); if (seated) seated.pendingVariant = pendingVariant; });
  });

  socket.on('adminNuclearReset', () => {
    profiles = JSON.parse(JSON.stringify(SEEDED_PLAYERS));
    rooms = SEEDED_ROOMS.map(r => ({
      ...r, phase: PHASES.IDLE, players: Array(TOTAL_SEATS).fill(null), community: [], potAmount: 0, activeIdx: -1, dealerIdx: 0, highestBet: 0, playersActedThisRound: 0, deck: [], activeVariant: { id: 'HOLDEM' }
    }));
    io.emit('initialDataResponse', { profiles, rooms });
  });

  socket.on('adminUpdatePlayer', ({ uid, chips, password }) => {
    const p = profiles.find(prof => prof.uid === uid);
    if (p) {
        if (chips !== undefined) p.chips = Number(chips);
        if (password !== undefined) p.password = String(password);
        io.emit('profilesUpdate', profiles);
        rooms.forEach(r => r.players.forEach(seated => { if(seated && seated.uid === uid) seated.chips = p.chips; }));
    }
  });

  socket.on('adminCreatePlayer', (p) => {
    profiles.push({ ...p, chips: Number(p.chips || 1000), role: 'player', uid: 'u_' + Date.now(), pendingVariant: 'HOLDEM' });
    io.emit('profilesUpdate', profiles);
  });

  socket.on('adminCreateRoom', (roomData) => {
    rooms.push({ ...roomData, phase: PHASES.IDLE, players: Array(TOTAL_SEATS).fill(null), community: [], potAmount: 0, activeIdx: -1, dealerIdx: 0, highestBet: 0, playersActedThisRound: 0, deck: [], activeVariant: { id: 'HOLDEM' } });
    io.emit('lobbyUpdate', rooms);
  });

  socket.on('adminDeleteRoom', (id) => { rooms = rooms.filter(r => r.id !== id); io.emit('lobbyUpdate', rooms); });

  socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    // Enforcement: One user seat policy
    rooms.forEach(other => {
      other.players.forEach((seated, i) => {
        if (seated && seated.uid === profile.uid) {
            other.players[i] = null;
            io.to(other.id).emit('log', { name: "SYSTEM", action: `${String(seated.name)} MOVED TABLES`, timestamp: Date.now(), type: 'global' });
            updateRoom(other);
        }
      });
    });

    const seatIdx = room.players.findIndex(s => s === null);
    if (seatIdx !== -1) {
      room.players[seatIdx] = { ...profile, chips: Number(buyIn || 1000), currentBet: 0, isFolded: false, hand: [] };
      socket.join(roomId);
      if (typeof callback === 'function') callback({ status: 'ok' });
      io.to(roomId).emit('log', { name: "SYSTEM", action: `${String(profile.name)} JOINED`, timestamp: Date.now(), type: 'global' });
      if (room.players.filter(p => p).length >= 2 && room.phase === PHASES.IDLE) startHand(room);
      updateRoom(room);
    } else {
      if (typeof callback === 'function') callback({ status: 'full' });
    }
  });

  socket.on('adminAddBot', ({ roomId }) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const seatIdx = room.players.findIndex(s => s === null);
    if (seatIdx !== -1) {
      const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      room.players[seatIdx] = { 
        name, 
        isBot: true, 
        chips: Number(room.maxBuy || 100), 
        currentBet: 0, 
        isFolded: false, 
        hand: [], 
        uid: `bot_${Date.now()}`, 
        pendingVariant: 'HOLDEM' 
      };
      if (room.players.filter(p => p).length >= 2 && room.phase === PHASES.IDLE) startHand(room);
      updateRoom(room);
    }
  });

  socket.on('playerAction', ({ roomId, type, amount }) => {
    const room = rooms.find(r => r.id === roomId);
    const player = room?.players[room.activeIdx];
    if (player) processAction(room, player, type, amount);
  });
});

server.listen(PORT, () => console.log(`Arena Server v1.1.9 Running`));
