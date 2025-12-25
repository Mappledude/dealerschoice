const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: ["https://dealerschoice.vercel.app", "http://localhost:3000"] }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://dealerschoice.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

// --- GAME STATE ---
let gameState = {
  players: [],
  pot: 0,
  board: [],
  phase: 'IDLE'
};

// --- GAME ENGINE LOGIC ---
function startNewHand() {
  gameState.pot = 60; // Initial blind/ante pool
  gameState.board = [];
  gameState.phase = 'PRE_FLOP';
  
  // Deal mock cards to all connected players
  const ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const suits = ['♠','♥','♦','♣'];
  
  gameState.players = gameState.players.map(p => ({
    ...p,
    hand: [
      { rank: ranks[Math.floor(Math.random()*13)], suit: suits[Math.floor(Math.random()*4)] },
      { rank: ranks[Math.floor(Math.random()*13)], suit: suits[Math.floor(Math.random()*4)] }
    ],
    isFolded: false
  }));

  io.emit('gameUpdate', gameState); // Broadcast new state to everyone
}

io.on('connection', (socket) => {
  console.log(`User Joined: ${socket.id}`);

  // Add new player to state
  const newPlayer = {
    id: socket.id,
    name: `Player ${gameState.players.length + 1}`,
    chips: 2000,
    hand: [],
    isFolded: false
  };
  gameState.players.push(newPlayer);

  // AUTO-START TRIGGER: If 2 or more players are here, start dealing
  if (gameState.players.length >= 2 && gameState.phase === 'IDLE') {
    startNewHand();
  } else {
    socket.emit('gameUpdate', gameState); // Send current state to new player
  }

  socket.on('disconnect', () => {
    console.log(`User Left: ${socket.id}`);
    gameState.players = gameState.players.filter(p => p.id !== socket.id);
    if (gameState.players.length < 2) gameState.phase = 'IDLE';
    io.emit('gameUpdate', gameState);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Poker Brain Active on Port ${PORT}`));
