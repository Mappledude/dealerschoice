import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v1.7.0-ULTRA";
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

let profiles = []; 
let rooms = {};

const combinations = (array, k) => {
  let result = [];
  const fn = (start, prev) => {
    if (prev.length === k) { result.push(prev); return; }
    for (let i = start; i < array.length; i++) { fn(i + 1, [...prev, array[i]]); }
  };
  fn(0, []);
  return result;
};

// --- Standard High Hand Ranking ---
const rankHand = (cards) => {
  if (!cards || cards.length < 5) return { power: 0, name: "Pre-flop" };
  
  const ranks = cards.map(c => VM[c.value]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
  
  const isFlush = new Set(suits).size === 1;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;

  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
  }
  if (!isStraight && uniqueRanks.includes(14) && [5,4,3,2].every(r => uniqueRanks.includes(r))) {
    isStraight = true; straightHigh = 5;
  }

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

// --- Variant Best Hand Evaluator ---
const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0 || !comm || comm.length < 3) return { high: { power: 0, name: "Pre-flop" }, low: null };

    let bestHigh = { power: -1, name: "Evaluating..." };
    let bestLow = null;

    if (variantId === 'HOLDEM' || variantId === 'PINEAPPLE') {
        combinations([...hole, ...comm], 5).forEach(c => {
            const res = rankHand(c);
            if (res.power > bestHigh.power) bestHigh = res;
        });
    } else if (variantId === 'OMAHA' || variantId === 'HILOW') {
        const boardCombos = combinations(comm, 3);
        const holePairs = combinations(hole, 2);
        
        holePairs.forEach(h => {
            boardCombos.forEach(b => {
                const res = rankHand([...h, ...b]);
                if (res.power > bestHigh.power) bestHigh = res;
                
                if (variantId === 'HILOW') {
                    // Low is simply the weakest High-Card hand (Straights/Flushes break Low)
                    if (res.name === "High Card") {
                        if (!bestLow || res.power < bestLow.power) bestLow = res;
                    }
                }
            });
        });
    } else if (variantId === 'MUFLIS') {
        combinations([...hole, ...comm], 5).forEach(c => {
            const res = rankHand(c);
            if (bestHigh.power === -1 || res.power < bestHigh.power) bestHigh = res;
        });
    }
    
    return { high: bestHigh, low: bestLow };
};

// --- MONTE CARLO SIMULATION ENGINE (1,000 Iterations) ---
const simulateEquity = (player, board, deck, variantId, otherPlayersCount) => {
    let winsHigh = 0;
    let winsLow = 0;
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
        const simDeck = [...deck].sort(() => Math.random() - 0.5);
        
        // 1. Complete Board
        const simBoard = [...board];
        while (simBoard.length < 5) simBoard.push(simDeck.pop());

        // 2. Assign Opponents
        const opponents = [];
        const cardsPerHand = (variantId === 'HOLDEM' || variantId === 'MUFLIS') ? 2 : (variantId === 'PINEAPPLE' ? 3 : 4);
        for (let j = 0; j < otherPlayersCount; j++) {
            opponents.push(simDeck.splice(0, cardsPerHand));
        }

        // 3. Evaluate Hero
        const heroRes = getBestHand(player.hand, simBoard, variantId);

        // 4. Check against Opponents
        let heroWinsH = true;
        let heroWinsL = variantId === 'HILOW' ? (heroRes.low !== null) : false;

        for (const oppHand of opponents) {
            const oppRes = getBestHand(oppHand, simBoard, variantId);
            
            if (variantId === 'MUFLIS') {
                if (oppRes.high.power < heroRes.high.power) heroWinsH = false;
            } else {
                if (oppRes.high.power > heroRes.high.power) heroWinsH = false;
                if (variantId === 'HILOW' && oppRes.low) {
                    if (!heroRes.low || oppRes.low.power < heroRes.low.power) heroWinsL = false;
                }
            }
            if (!heroWinsH && (variantId !== 'HILOW' || !heroWinsL)) break;
        }

        if (heroWinsH) winsHigh++;
        if (heroWinsL) winsLow++;
    }

    return { 
        high: (winsHigh / iterations) * 100, 
        low: (winsLow / iterations) * 100 
    };
};

const updateRoomStrengths = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.phase === PHASES.IDLE) return;

    const activePlayers = room.players.filter(p => p && !p.isFolded);
    
    room.players.forEach(p => {
        if (p && p.hand && !p.isFolded) {
            const evalRes = getBestHand(p.hand, room.community, room.activeVariant.id);
            p.strength = evalRes.high.name;
            p.lowStrength = evalRes.low ? "Low Qualifies" : "No Low";

            // Run Simulation
            const remainingDeck = VALUES.flatMap(v => SUITS.map(s => ({ value: v, suit: s })))
                .filter(c => !p.hand.some(ph => ph.value === c.value && ph.suit === c.suit))
                .filter(c => !room.community.some(cb => cb.value === c.value && cb.suit === c.suit));

            const equity = simulateEquity(p, room.community, remainingDeck, room.activeVariant.id, activePlayers.length - 1);
            p.winProbabilityHigh = equity.high;
            p.winProbabilityLow = equity.low;
            p.winProbability = (equity.high + equity.low) / (room.activeVariant.id === 'HILOW' ? 2 : 1);
        }
    });
};

// --- Standard Socket Logic with Admin Updates ---
io.on('connection', (socket) => {
    socket.on('getInitialData', () => socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms) }));
    
    socket.on('playerLogin', ({ password }) => {
        const profile = profiles.find(p => p.password === password);
        if (profile) socket.emit('loginSuccess', profile);
    });

    socket.on('adminCreatePlayer', (p) => { 
        profiles.push({ ...p, chips: Number(p.chips) }); 
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

    socket.on('adminDeleteRoom', (roomId) => {
        delete rooms[roomId];
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    // ... (rest of game loop/performAction remains as previously defined but calling updateRoomStrengths)
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server ${VERSION} active on port ${PORT}`));
