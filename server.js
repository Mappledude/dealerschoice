const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- VERSION & METADATA ---
const VERSION = "v0.1";
const APP_NAME = "Dealers Choice";

// --- CONSTANTS ---
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const holeCardsMap = { 
    HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 3, HILOW: 4, REDSBLACKS: 4 
};

const variantNames = {
    HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple",
    MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks"
};

// --- STATE MANAGEMENT ---
let profiles = []; // Persistent user wallets
let rooms = {};

// --- UTILS ---
const combinations = (array, k) => {
    let result = [];
    const fn = (start, prev) => {
        if (prev.length === k) { result.push(prev); return; }
        for (let i = start; i < array.length; i++) { fn(i + 1, [...prev, array[i]]); }
    };
    fn(0, []);
    return result;
};

// --- HAND RANKING ENGINE (Precision v0.1) ---
const rankHand = (cards) => {
    if (!cards || cards.length < 5) return { power: 0, name: "High Card", cards: [] };
    
    const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
    const ranks = sorted.map(c => VM[c.value]);
    const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
    
    const groups = Object.entries(counts)
        .map(([rank, count]) => ({ r: parseInt(rank), c: count }))
        .sort((a, b) => b.c - a.c || b.r - a.r);

    let compArr = [];
    groups.forEach(g => { for(let i=0; i<g.c; i++) compArr.push(g.r); });
    
    const vc = groups.map(x => x.c);
    const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
    
    const uniqueRanks = [...new Set(ranks)].sort((a,b) => b-a);
    let isStraight = false, straightHigh = 0;

    for(let i=0; i <= uniqueRanks.length - 5; i++) {
        if(uniqueRanks[i] === uniqueRanks[i+4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
    // A-5 Wheel
    if(!isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(5) && uniqueRanks.includes(4) && uniqueRanks.includes(3) && uniqueRanks.includes(2)) {
        isStraight = true; straightHigh = 5; compArr = [5, 4, 3, 2, 1]; 
    }

    let score = 0, name = "High Card";
    if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
    else if (vc[0] === 4) { score = 7; name = "Four of a Kind"; }
    else if (vc[0] === 3 && vc[1] === 2) { score = 6; name = "Full House"; }
    else if (isFlush) { score = 5; name = "Flush"; }
    else if (isStraight) { score = 4; name = "Straight"; }
    else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
    else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
    else if (vc[0] === 2) { score = 1; name = "Pair"; }

    // Precision Positional Weighting (Base 15)
    const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
    return { power, name, cards: sorted.slice(0, 5) };
};

// --- LOW HAND EVALUATOR (8-or-Better for Hi-Low) ---
const getLowScore = (cards) => {
    const uniqueRanks = [...new Set(cards.map(c => VM[c.value]))].filter(r => r <= 8).sort((a,b) => b - a);
    if (uniqueRanks.length < 5) return null;
    return uniqueRanks.slice(0, 5).reduce((acc, r, i) => acc + (r * Math.pow(10, 4 - i)), 0);
};

// --- GET BEST HAND (Variant-Specific) ---
const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0) return null;

    if (variantId === 'REDSBLACKS') {
        const isRed = (s) => s === '♥' || s === '♦';
        const reds = hole.filter(c => isRed(c.suit)).length;
        const blacks = hole.length - reds;
        
        // Joker Rule: 3 cards contain a mix of colors (2R1B or 1R2B)
        // Note: Logic applies to the first 3 cards dealt usually, or any 3 among 4. 
        // Following prompt: "3 Joker cards act as wild mimicking the 4th hole card"
        const evals = [];
        for (let i = 0; i < hole.length; i++) {
            const card4 = hole[i];
            const others = hole.filter((_, idx) => idx !== i);
            const oReds = others.filter(c => isRed(c.suit)).length;
            
            if (oReds > 0 && (others.length - oReds) > 0) { // Mixed colors found in the "others" group
                if (comm.length === 0) {
                    // Pre-flop strength is a pair of Card 4
                    const p = 1 * Math.pow(15, 7) + VM[card4.value] * Math.pow(15, 6);
                    evals.push({ power: p, name: `Pair of ${card4.value}s`, cards: [card4, card4] });
                } else {
                    // Flop+: Joker mimics the 4th card, create virtual pair, combine with 3 from board
                    combinations(comm, Math.min(comm.length, 3)).forEach(boardSet => {
                        const wild = { ...card4, id: 'wild-joker' };
                        evals.push(rankHand([...boardSet, card4, wild]));
                    });
                }
            }
        }
        
        // If no Joker conditions met, fallback to standard Omaha logic (2 from hand, 3 from board)
        if (evals.length === 0) {
            combinations(hole, 2).forEach(h => {
                combinations(comm, Math.min(comm.length, 3)).forEach(c => {
                    const pool = [...h, ...c];
                    while(pool.length < 5) pool.push({value: '2', suit: '♠', id: 'filler'});
                    evals.push(rankHand(pool));
                });
            });
        }
        return evals.sort((a,b) => b.power - a.power)[0];
    }

    if (variantId === 'OMAHA' || variantId === 'HILOW') {
        let best = null;
        combinations(hole, 2).forEach(h => {
            combinations(comm, Math.min(comm.length, 3)).forEach(c => {
                const res = rankHand([...h, ...c]);
                if (!best || res.power > best.power) best = res;
            });
        });
        return best;
    }

    if (variantId === 'MUFLIS') {
        const full = [...hole, ...comm];
        let best = null;
        combinations(full, Math.min(full.length, 5)).forEach(c => {
            const res = rankHand(c);
            // In Muflis, the internal power is inverted for comparison
            if (!best || res.power < best.power) best = res;
        });
        return best;
    }

    // Default Holdem / Pineapple
    const full = [...hole, ...comm];
    let best = null;
    combinations(full, Math.min(full.length, 5)).forEach(c => {
        const res = rankHand(c);
        if (!best || res.power > best.power) best = res;
    });
    return best;
};

// --- CORE GAME ENGINE ---

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
    if (seated.length < 2) return;

    if (!room.players[room.dealerIdx]) room.dealerIdx = seated[0];
    const dealer = room.players[room.dealerIdx];
    const vId = dealer.pendingVariant || 'HOLDEM';
    room.activeVariant = { id: vId, name: variantNames[vId], holeCards: holeCardsMap[vId] };

    // Log dealer name and variant
    io.to(roomId).emit('log', { name: dealer.name, action: `deals ${variantNames[vId]}`, type: 'variant' });

    room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
    room.community = []; 
    room.potData = [{ amount: 0 }]; 
    room.highestBet = room.bb;
    room.phase = PHASES.PRE_FLOP;

    // Deal cards
    room.players.forEach(p => {
        if (!p) return;
        p.hand = room.deck.splice(0, room.activeVariant.holeCards);
        p.currentBet = 0; p.isFolded = false; p.isWinner = false; p.lastAction = null;
    });

    const sbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
    const bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
    
    room.players[sbIdx].chips -= room.sb; room.players[sbIdx].currentBet = room.sb;
    room.players[bbIdx].chips -= room.bb; room.players[bbIdx].currentBet = room.bb;
    
    room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
    room.timeRemaining = 30;
    io.to(roomId).emit('roomUpdate', room);
};

// ... Betting logic, nextPhase logic ...

// --- SHOWDOWN LOGIC (Includes Logs & Winning Cards) ---
const processShowdown = (roomId) => {
    const room = rooms[roomId];
    const active = room.players.filter(p => p && !p.isFolded);
    
    const evals = active.map(p => ({
        i: room.players.indexOf(p),
        res: getBestHand(p.hand, room.community, room.activeVariant.id)
    }));

    // Find winners based on variant
    let winners = [];
    if (room.activeVariant.id === 'MUFLIS') {
        const minPower = Math.min(...evals.map(e => e.res.power));
        winners = evals.filter(e => e.res.power === minPower);
    } else {
        const maxPower = Math.max(...evals.map(e => e.res.power));
        winners = evals.filter(e => e.res.power === maxPower);
    }

    const share = Math.floor(room.potData[0].amount / winners.length);
    room.showdownWinners = [];

    winners.forEach(w => {
        const p = room.players[w.i];
        p.chips += share;
        p.isWinner = true;
        room.winning5Ids = w.res.cards.map(c => c.id);
        room.showdownWinners.push({ name: p.name, rank: w.res.name, hand: w.res.cards, amount: share });
        
        // PRODUCTION FEED: Show Winner Name + Hand Icons
        io.to(roomId).emit('log', { 
            name: p.name, 
            action: `wins $${share.toLocaleString()} with ${w.res.name}`, 
            type: 'win',
            cards: w.res.cards 
        });
    });

    room.phase = PHASES.SHOWDOWN;
    io.to(roomId).emit('roomUpdate', room);
    
    setTimeout(() => {
        const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
        room.dealerIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
        runIgnition(roomId);
    }, 8000);
};

// --- BOOTSTRAP ---
server.listen(10000, () => {
    console.log(`${APP_NAME} ${VERSION} running on port 10000`);
});
