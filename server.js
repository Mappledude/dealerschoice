const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// 1. Explicitly allow your Vercel frontend
app.use(cors({
  origin: ["https://dealerschoice.vercel.app", "http://localhost:3000"]
}));

const server = http.createServer(app);

// 2. Configure Socket.io with specific origins
const io = new Server(server, {
  cors: {
    origin: ["https://dealerschoice.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

// 3. Ensure the server uses Render's dynamic port
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// --- POKER CONSTANTS (Mirrored from Frontend) ---
const TOTAL_SEATS = 10;
const BLINDS = { sb: 20, bb: 40 };
const PHASES = { 
  IDLE: 'IDLE', 
  PRE_FLOP: 'PRE_FLOP', 
  FLOP: 'FLOP', 
  TURN: 'TURN', 
  RIVER: 'RIVER', 
  SHOWDOWN: 'SHOWDOWN' 
};

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2 }, 
  OMAHA: { id: 'OMAHA', name: 'Omaha', holeCards: 4 }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3 }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2 } 
};

const VALUE_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const SUITS = ['♠', '♣', '♥', '♦'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// --- STATE STORE ---
const rooms = {};

// --- HELPER FUNCTIONS ---
const createDeck = () => {
  return SUITS.flatMap(s => VALUES.map(v => ({
    suit: s,
    value: v,
    rank: VALUE_MAP[v],
    id: v + s
  }))).sort(() => Math.random() - 0.5);
};

// Combinations utility for hand evaluation
const getCombinations = (arr, k) => {
  const result = [];
  const helper = (start, combo) => {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  };
  helper(0, []);
  return result;
};

// 5-Card Ranker
const rankFiveCardHand = (cards) => {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = new Set(suits).size === 1;
  let isStraight = true;
  for (let i = 0; i < 4; i++) if (ranks[i] !== ranks[i + 1] + 1) isStraight = false;
  if (!isStraight && JSON.stringify(ranks) === JSON.stringify([14, 5, 4, 3, 2])) isStraight = true;

  const counts = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const valCounts = Object.values(counts).sort((a, b) => b - a);
  const uniqueRanks = Object.keys(counts).map(Number).sort((a, b) => (counts[b] !== counts[a]) ? counts[b] - counts[a] : b - a);

  let score = 0, name = "High Card";
  const firstRank = uniqueRanks[0] || 0;
  if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
  else if (valCounts[0] === 4) { score = 7; name = "Four of a Kind"; }
  else if (valCounts[0] === 3 && valCounts[1] === 2) { score = 6; name = "Full House"; }
  else if (isFlush) { score = 5; name = "Flush"; }
  else if (isStraight) { score = 4; name = "Straight"; }
  else if (valCounts[0] === 3) { score = 3; name = "Three of a Kind"; }
  else if (valCounts[0] === 2 && valCounts[1] === 2) { score = 2; name = "Two Pair"; }
  else if (valCounts[0] === 2) { score = 1; name = "Pair"; }
  return { 
    power: score * 1000000 + (firstRank * 1000) + (uniqueRanks[1] || 0), 
    name,
    hand: cards 
  };
};

const evaluateBestHand = (hand, board, variantId) => {
  if (variantId === 'OMAHA') {
    const hCombos = getCombinations(hand, 2);
    const bCombos = getCombinations(board, 3);
    let best = { power: -1 };
    hCombos.forEach(hc => bCombos.forEach(bc => {
      const res = rankFiveCardHand([...hc, ...bc]);
      if (res.power > best.power) best = res;
    }));
    return best;
  } else {
    const subsets = getCombinations([...hand, ...board], 5);
    let best = { power: -1 };
    subsets.forEach(combo => {
      const res = rankFiveCardHand(combo);
      if (res.power > best.power) best = res;
    });
    return best;
  }
};

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        players: Array(TOTAL_SEATS).fill(null),
        phase: PHASES.IDLE,
        community: [],
        pot: 0,
        deck: [],
        activeIdx: -1,
        dealerIdx: 0,
        highestBet: 0,
        variant: VARIANTS.HOLDEM
      };
    }
    socket.emit('sync_state', rooms[roomId]);
  });

  socket.on('sit_player', ({ roomId, seatIdx, name, chips }) => {
    const room = rooms[roomId];
    if (!room || room.players[seatIdx]) return;

    room.players[seatIdx] = {
      id: socket.id,
      name,
      chips,
      hand: [],
      currentBet: 0,
      isFolded: false,
      isSeated: true,
      isDealer: false,
      acted: false
    };

    io.to(roomId).emit('sync_state', room);
  });

  socket.on('start_game', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    const seatedPlayers = room.players.filter(p => p !== null);
    if (seatedPlayers.length < 2) return;

    // Reset game state
    room.phase = PHASES.PRE_FLOP;
    room.deck = createDeck();
    room.community = [];
    room.pot = 0;
    room.highestBet = BLINDS.bb;

    // Blinds & Dealer Logic
    room.players.forEach(p => { if (p) { p.hand = []; p.isFolded = false; p.currentBet = 0; p.acted = false; }});
    
    // Assign Blinds (Simplified)
    const sbIdx = (room.dealerIdx + 1) % TOTAL_SEATS;
    const bbIdx = (room.dealerIdx + 2) % TOTAL_SEATS;
    
    room.players[sbIdx].chips -= BLINDS.sb;
    room.players[sbIdx].currentBet = BLINDS.sb;
    room.players[bbIdx].chips -= BLINDS.bb;
    room.players[bbIdx].currentBet = BLINDS.bb;
    room.pot = BLINDS.sb + BLINDS.bb;

    // Deal cards
    room.players.forEach((p, i) => {
      if (p) {
        p.hand = room.deck.splice(0, room.variant.holeCards);
        // Send private cards only to the specific player
        io.to(p.id).emit('private_cards', p.hand);
      }
    });

    room.activeIdx = (room.dealerIdx + 3) % TOTAL_SEATS;
    io.to(roomId).emit('sync_state', room);
  });

  socket.on('action', ({ roomId, type, amount }) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;

    const player = room.players[room.activeIdx];
    if (player.id !== socket.id) return;

    if (type === 'FOLD') player.isFolded = true;
    if (type === 'CALL') {
      const callAmt = room.highestBet - player.currentBet;
      player.chips -= callAmt;
      player.currentBet = room.highestBet;
      room.pot += callAmt;
    }
    if (type === 'RAISE') {
      const raiseAmt = amount - player.currentBet;
      player.chips -= raiseAmt;
      player.currentBet = amount;
      room.highestBet = amount;
      room.pot += raiseAmt;
    }

    player.acted = true;

    // Determine next player or next phase
    // ... (Add betting round logic here)

    io.to(roomId).emit('sync_state', room);
  });

  socket.on('disconnect', () => {
    console.log("User Disconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`POKER SERVER RUNNING ON PORT ${PORT}`);
});
