import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: true, methods: ["GET", "POST"], credentials: true },
    transports: ['websocket', 'polling']
});

const DB_DIR = './data';
const DB_PATH = path.join(DB_DIR, 'poker_db.json');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let globalProfiles = []; 
let rooms = {}; 
let roomIntervals = {};
let rebuyIntervals = {};
let ignitionTimeouts = {}; 

const saveToDisk = () => {
    try {
        const data = JSON.stringify({ globalProfiles }, null, 2);
        fs.writeFileSync(DB_PATH, data);
    } catch (err) { console.error("Disk Save Error:", err); }
};

const loadFromDisk = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = JSON.parse(fs.readFileSync(DB_PATH));
            globalProfiles = data.globalProfiles || [];
        }
    } catch (err) { console.log("Initializing fresh database..."); }
};
loadFromDisk();

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♣', '♥', '♦'];
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const variantNames = { 
    HOLDEM: "Texas Hold'em", 
    OMAHA: "OMAHA", 
    PINEAPPLE: "Pineapple", 
    MUFLIS: "Muflis", 
    HILOW: "Hi-Low Split", 
    REDSBLACKS: "Reds & Blacks" 
};

const holeCardsMap = { 
    HOLDEM: 2, 
    OMAHA: 4, 
    PINEAPPLE: 3, 
    MUFLIS: 2, 
    HILOW: 4, 
    REDSBLACKS: 4 
};

const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const rankHand = (cards) => {
    if (!cards || cards.length < 5) return { power: 0, name: "High Card", cards: [] };
    
    const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
    const ranks = sorted.map(c => VM[c.value]);
    const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
    
    // Identifies pairs/sets/full-houses by sorting groups by count then by rank
    const tiebreakerRanks = Object.entries(counts)
        .map(([rank, count]) => ({ r: parseInt(rank), c: count }))
        .sort((a, b) => b.c - a.c || b.r - a.r);

    let compArr = [];
    tiebreakerRanks.forEach(item => { for(let i=0; i < item.c; i++) compArr.push(item.r); });
    
    const vc = tiebreakerRanks.map(x => x.c);
    const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
    
    const uniqueRanks = [...new Set(ranks)].sort((a,b) => b-a);
    let isStraight = false;
    let straightHigh = 0;

    for(let i=0; i <= uniqueRanks.length - 5; i++) {
        if(uniqueRanks[i] === uniqueRanks[i+4] + 4) { 
            isStraight = true; 
            straightHigh = uniqueRanks[i];
            break; 
        }
    }
    // A-5 Wheel detection
    if(!isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(5) && uniqueRanks.includes(4) && uniqueRanks.includes(3) && uniqueRanks.includes(2)) {
        isStraight = true;
        straightHigh = 5;
        compArr = [5, 4, 3, 2, 1]; 
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

    // FIXED: Precision power scale (15^7) handles up to 5 kickers without overlap or rounding errors
    const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
    return { power, name, cards: sorted.slice(0, 5) };
};

const combinations = (arr, k) => {
    const all = [];
    const fn = (n, src, got) => {
        if (n === 0) { all.push(got); return; }
        for (let j = 0; j < src.length; j++) fn(n - 1, src.slice(j + 1), got.concat([src[j]]));
    };
    fn(k, arr, []);
    return all;
};

const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0) return null;

    if (variantId === 'REDSBLACKS') {
        const isRed = (s) => s === '♥' || s === '♦';
        const reds = hole.filter(c => isRed(c.suit)).length;
        const blacks = hole.length - reds;
        
        const possibleEvals = [];

        // If Joker exists (mix of color in 4 cards), Joker (3 cards) acts as a flexible wild mimicing anything
        if (reds > 0 && blacks > 0) {
            for (let i = 0; i < hole.length; i++) {
                const card4 = hole[i];
                const others = hole.filter((_, idx) => idx !== i);
                const oReds = others.filter(c => isRed(c.suit)).length;
                const oBlacks = 3 - oReds;

                // A valid Joker is 2R1B or 1R2B among the OTHER 3 cards
                if ((oReds === 2 && oBlacks === 1) || (oReds === 1 && oBlacks === 2)) {
                    const boardSubsets = combinations(comm, Math.min(comm.length, 3));
                    boardSubsets.forEach(boardCards => {
                        // For each combination of board cards, find the best use of a Wild Card
                        VALUES.forEach(v => {
                            const wild = { value: v, suit: boardCards[0]?.suit || SUITS[0], id: 'wild' };
                            const pool = [card4, wild, ...boardCards];
                            const padded = [...pool];
                            while(padded.length < 5) padded.push({value: '2', suit: '♠', id: 'f'});
                            possibleEvals.push(rankHand(padded));
                        });
                    });
                }
            }
        } else {
            // Same Color Rule: use 2 from hand and 3 from board
            combinations(hole, 2).forEach(hSubset => {
                combinations(comm, Math.min(comm.length, 3)).forEach(boardSubset => {
                    const pool = [...hSubset, ...boardSubset];
                    const padded = [...pool];
                    while (padded.length < 5) padded.push({ value: '2', suit: '♠', id: 'f' });
                    possibleEvals.push(rankHand(padded));
                });
            });
        }

        if (possibleEvals.length > 0) {
            return possibleEvals.sort((a, b) => b.power - a.power)[0];
        }
        return { power: 0, name: "High Card", cards: [] };
    }

    if (variantId === 'OMAHA' || variantId === 'HILOW') {
        let best = null;
        combinations(hole, 2).forEach(h => {
            const bCount = Math.min(comm.length, 3);
            combinations(comm, bCount).forEach(c => {
                const pool = [...h, ...c];
                const padded = [...pool];
                while(padded.length < 5) padded.push({value: '2', suit: '♠', id: 'f'});
                const res = rankHand(padded);
                if (!best || res.power > best.power) best = res;
            });
        });
        return best;
    }

    // Default Hold'em / Pineapple
    const full = [...hole, ...comm];
    let best = null;
    combinations(full, Math.min(full.length, 5)).forEach(c => {
        const padded = [...c];
        while(padded.length < 5) padded.push({value: '2', suit: '♠', id: 'f'});
        const res = rankHand(padded);
        if (!best || res.power > best.power) best = res;
    });
    return best;
};

const updateStrengths = (room) => {
    room.players.forEach(p => {
        if (p && p.hand && p.hand.length > 0) {
            const best = getBestHand(p.hand, room.community, room.activeVariant?.id);
            if (best) p.strength = best.name;
            else p.strength = "High Card";
        }
    });
};

const startShotClock = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    clearInterval(roomIntervals[roomId]);
    const p = room.players[room.activeIdx];
    if (!p) return;

    if (p.isBot) {
        setTimeout(() => {
            const cr = rooms[roomId];
            if (!cr || cr.activeIdx === -1 || cr.players[cr.activeIdx]?.uid !== p.uid) return;
            const res = getBestHand(p.hand, cr.community, cr.activeVariant?.id);
            const score = res ? res.power / Math.pow(15, 7) : 0;
            let type = 'CALL', amt = 0;
            if (score >= 3) { type = 'RAISE'; amt = cr.highestBet + Math.max(cr.bb, Math.floor(cr.potData[0].amount * 0.4)); }
            else if (score < 1 && (cr.highestBet - p.currentBet) > 100 && Math.random() > 0.2) { type = 'FOLD'; }
            if (type === 'RAISE') amt = Math.min(p.chips + p.currentBet, amt);
            handleAction(roomId, type, amt);
        }, 1500);
    }

    room.timeRemaining = 30;
    roomIntervals[roomId] = setInterval(() => {
        const r = rooms[roomId];
        if (!r) return clearInterval(roomIntervals[roomId]);
        r.timeRemaining--;
        if (r.timeRemaining <= 0) {
            clearInterval(roomIntervals[roomId]);
            const ap = r.players[r.activeIdx];
            if (ap) handleAction(roomId, r.highestBet === ap.currentBet ? 'CALL' : 'FOLD', 0);
        } else { io.to(roomId).emit('roomUpdate', r); }
    }, 1000);
};

const handleAction = (roomId, type, amount) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    const p = room.players[room.activeIdx];
    if (!p) return;

    p.hasActed = true;
    p.lastAction = type;
    if (type === 'FOLD') { p.isFolded = true; io.to(roomId).emit('log', { name: p.name, action: "folded their hand", type: 'fold' }); }
    else if (type === 'CALL') {
        const diff = Math.min(p.chips, room.highestBet - p.currentBet);
        p.chips -= diff; p.currentBet += diff;
        if (diff > 0) io.to(roomId).emit('log', { name: p.name, action: `calls $${diff.toLocaleString()}`, type: 'bet' });
        else io.to(roomId).emit('log', { name: p.name, action: `checks`, type: 'bet' });
    } else if (type === 'RAISE') {
        const diff = amount - p.currentBet;
        p.chips -= diff; p.currentBet = amount;
        room.highestBet = amount;
        room.players.forEach(op => { if (op && op.uid !== p.uid && op.chips > 0) op.hasActed = false; });
        io.to(roomId).emit('log', { name: p.name, action: `raises to $${amount.toLocaleString()}`, type: 'bet' });
    }
    
    const active = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const withChips = active.filter(i => room.players[i].chips > 0);
    const allMatched = active.every(i => room.players[i].currentBet === room.highestBet || room.players[i].chips === 0);
    const allActed = active.every(i => room.players[i].hasActed || room.players[i].chips === 0);
    
    if (active.length === 1) processShowdown(roomId);
    else if (allMatched && (allActed || withChips.length <= 1)) advancePhase(roomId);
    else {
        const curIdxInActive = active.indexOf(room.activeIdx);
        room.activeIdx = active[(curIdxInActive + 1) % active.length];
        startShotClock(roomId);
    }
};

const advancePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    let streetPot = 0;
    room.players.forEach(p => { if (p) { streetPot += p.currentBet; p.currentBet = 0; p.hasActed = false; p.lastAction = null; } });
    room.potData[0].amount += streetPot;
    room.highestBet = 0;

    if (room.phase === PHASES.RIVER) {
        processShowdown(roomId);
        return;
    }

    if (room.phase === PHASES.PRE_FLOP) { 
        room.phase = PHASES.FLOP; 
        room.community = [room.deck.pop(), room.deck.pop(), room.deck.pop()]; 
        io.to(roomId).emit('log', { name: "DEALER", action: "deals the FLOP", type: 'phase' });
    }
    else if (room.phase === PHASES.FLOP) { 
        room.phase = PHASES.TURN; 
        room.community.push(room.deck.pop()); 
        io.to(roomId).emit('log', { name: "DEALER", action: "deals the TURN", type: 'phase' });
    }
    else if (room.phase === PHASES.TURN) { 
        room.phase = PHASES.RIVER; 
        room.community.push(room.deck.pop()); 
        io.to(roomId).emit('log', { name: "DEALER", action: "deals the RIVER", type: 'phase' });
    }
    
    updateStrengths(room);
    const active = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    if (active.filter(i => room.players[i].chips > 0).length <= 1) {
        io.to(roomId).emit('roomUpdate', room);
        setTimeout(() => advancePhase(roomId), 1500);
    } else {
        const afterDealer = active.filter(i => i > room.dealerIdx).concat(active.filter(i => i <= room.dealerIdx));
        room.activeIdx = afterDealer[0];
        startShotClock(roomId);
        io.to(roomId).emit('roomUpdate', room);
    }
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    clearInterval(roomIntervals[roomId]);
    room.phase = PHASES.SHOWDOWN;
    const activeIndices = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    
    let finalStreetPot = 0;
    room.players.forEach(p => { if (p) { finalStreetPot += p.currentBet; p.currentBet = 0; } });
    room.potData[0].amount += finalStreetPot;
    
    const totalPot = room.potData[0].amount;
    const evals = activeIndices.map(i => ({ i, res: getBestHand(room.players[i].hand, room.community, room.activeVariant?.id) }));
    
    room.showdownWinners = [];
    room.hiLowAwards = { high: [], low: [] };

    if (evals.length === 1 || !evals[0].res) {
        const pIdx = activeIndices[0];
        const p = room.players[pIdx];
        if (p) {
            p.chips += totalPot; p.isWinner = true;
            room.showdownWinners.push({ name: p.name, rank: "Winner", hand: p.hand, amount: totalPot });
            io.to(roomId).emit('log', { name: p.name, action: `wins $${totalPot.toLocaleString()} (Opponents Folded)`, type: 'win' });
        }
    } else if (room.activeVariant?.id === 'HILOW') {
        evals.sort((a, b) => b.res.power - a.res.power);
        const highWinners = evals.filter(e => e.res.power === evals[0].res.power);
        const sortedLow = [...evals].sort((a, b) => a.res.power - b.res.power);
        const lowWinners = sortedLow.filter(e => e.res.power === sortedLow[0].res.power);
        const highShare = Math.floor(totalPot / 2 / highWinners.length);
        const lowShare = Math.floor(totalPot / 2 / lowWinners.length);
        highWinners.forEach(w => { 
            const p = room.players[w.i]; p.chips += highShare; p.isWinner = true; 
            room.showdownWinners.push({ name: p.name, rank: `HIGH: ${w.res.name}`, hand: w.res.cards, amount: highShare }); 
            room.hiLowAwards.high.push({ i: w.i, amount: highShare });
        });
        lowWinners.forEach(w => { 
            const p = room.players[w.i]; p.chips += lowShare; p.isWinner = true; 
            room.showdownWinners.push({ name: p.name, rank: `LOW: ${w.res.name}`, hand: w.res.cards, amount: lowShare }); 
            room.hiLowAwards.low.push({ i: w.i, amount: lowShare });
        });
    } else {
        const isMuflis = room.activeVariant?.id === 'MUFLIS';
        evals.sort((a, b) => isMuflis ? (a.res.power - b.res.power) : (b.res.power - a.res.power));
        const winners = evals.filter(e => e.res.power === evals[0].res.power);
        const share = Math.floor(totalPot / winners.length);
        winners.forEach(w => { 
            const p = room.players[w.i]; p.chips += share; p.isWinner = true; 
            room.winning5Ids = w.res.cards.map(c => c.id); 
            room.showdownWinners.push({ name: p.name, rank: w.res.name, hand: w.res.cards, amount: share }); 
            io.to(roomId).emit('log', { name: p.name, action: `wins $${share.toLocaleString()} with ${w.res.name}`, type: 'win' });
        });
    }

    io.to(roomId).emit('roomUpdate', room);
    saveToDisk();
    setTimeout(() => {
        const r = rooms[roomId]; if (!r) return;
        r.phase = PHASES.IDLE; r.community = []; r.showdownWinners = null; r.winning5Ids = [];
        r.players.forEach((p, i) => { if (p) { p.hand = []; p.isWinner = false; p.isFolded = false; p.currentBet = 0; p.hasActed = false; p.strength = ""; p.lastAction = null; if (p.chips <= 0) { p.isBust = true; p.rebuyTimeRemaining = 15; startRebuyTimer(roomId, i); } } });
        const seated = r.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) { 
            r.dealerIdx = seated[(seated.indexOf(r.dealerIdx) + 1) % seated.length] || seated[0]; 
            clearTimeout(ignitionTimeouts[roomId]);
            ignitionTimeouts[roomId] = setTimeout(() => runIgnition(roomId), 5000);
        } else { io.to(roomId).emit('roomUpdate', r); }
    }, 9000);
};

const startRebuyTimer = (roomId, seatIdx) => {
    const key = `${roomId}-${seatIdx}`;
    clearInterval(rebuyIntervals[key]);
    rebuyIntervals[key] = setInterval(() => {
        const r = rooms[roomId]; if (!r || !r.players[seatIdx]) return clearInterval(rebuyIntervals[key]);
        r.players[seatIdx].rebuyTimeRemaining--;
        if (r.players[seatIdx].rebuyTimeRemaining <= 0) { 
            clearInterval(rebuyIntervals[key]); 
            r.players[seatIdx] = null; 
            io.to(roomId).emit('roomUpdate', r); io.emit('lobbyUpdate', Object.values(rooms)); 
        } else io.to(roomId).emit('roomUpdate', r);
    }, 1000);
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
    if (seated.length < 2) { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', room); return; }
    
    if (!room.players[room.dealerIdx]) room.dealerIdx = seated[0];
    const dealer = room.players[room.dealerIdx];
    const vId = dealer.pendingVariant || 'HOLDEM';
    room.activeVariant = { id: vId, name: variantNames[vId], holeCards: holeCardsMap[vId] || 2 };
    
    io.to(roomId).emit('log', { name: "DEALER", action: `deals ${variantNames[vId]}`, type: 'variant' });

    room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
    room.community = []; room.potData = [{ amount: 0 }]; room.highestBet = room.bb;

    let sbIdx, bbIdx;
    if (seated.length === 2) { sbIdx = room.dealerIdx; bbIdx = seated.find(i => i !== room.dealerIdx); }
    else { const dPos = seated.indexOf(room.dealerIdx); sbIdx = seated[(dPos + 1) % seated.length]; bbIdx = seated[(dPos + 2) % seated.length]; }

    room.players.forEach((p, i) => { 
        if (!p) return; 
        if (p.chips <= 0) { p.isFolded = true; p.isSittingOut = true; return; } 
        p.hand = Array.from({ length: room.activeVariant.holeCards }, () => room.deck.pop()); 
        const bet = (i === sbIdx) ? Math.min(p.chips, room.sb) : (i === bbIdx) ? Math.min(p.chips, room.bb) : 0;
        p.chips -= bet; p.currentBet = bet; p.isFolded = false; p.isWinner = false; p.hasActed = false; p.isDealer = (i === room.dealerIdx); p.isSittingOut = false; p.isBust = false; p.lastAction = null;
    });

    updateStrengths(room);
    room.phase = PHASES.PRE_FLOP; 
    const bbPos = seated.indexOf(bbIdx);
    room.activeIdx = seated[(bbPos + 1) % seated.length];
    startShotClock(roomId);
    io.to(roomId).emit('roomUpdate', room);
};

io.on('connection', (socket) => {
    socket.on('playerLogin', (d) => {
        const p = globalProfiles.find(x => x.password === d.password);
        if (p) socket.emit('loginSuccess', p); else socket.emit('loginFailure', { message: 'Invalid Passcode' });
    });
    socket.on('joinRoom', (d, cb) => {
        const room = rooms[d.roomId];
        if (room) {
            const slot = room.players.findIndex(p => p === null);
            if (slot !== -1) {
                const isMidGame = room.phase !== PHASES.IDLE;
                room.players[slot] = { ...d.profile, chips: d.buyIn, buyInOrigin: d.buyIn, socketId: socket.id, hand: [], strength: "", isFolded: isMidGame, isSittingOut: isMidGame };
                socket.join(d.roomId); 
                io.to(d.roomId).emit('roomUpdate', room); io.emit('lobbyUpdate', Object.values(rooms));
                if (cb) cb({ status: 'ok' });
                if (!isMidGame && room.players.filter(p => p && p.chips > 0).length >= 2) {
                    clearTimeout(ignitionTimeouts[d.roomId]);
                    ignitionTimeouts[d.roomId] = setTimeout(() => runIgnition(d.roomId), 5000);
                }
            }
        }
    });
    socket.on('getInitialData', () => { socket.emit('initialDataResponse', { profiles: globalProfiles, rooms: Object.values(rooms) }); });
    socket.on('adminCreatePlayer', (d, cb) => { globalProfiles.push(d); saveToDisk(); io.emit('profilesUpdate', globalProfiles); if (cb) cb(); });
    socket.on('adminDeletePlayer', (uid) => { globalProfiles = globalProfiles.filter(p => p.uid !== uid); saveToDisk(); io.emit('profilesUpdate', globalProfiles); });
    socket.on('adminEditChips', (d) => { const p = globalProfiles.find(x => x.uid === d.uid); if (p) { p.chips = d.chips; saveToDisk(); io.emit('profilesUpdate', globalProfiles); } });
    socket.on('adminCreateRoom', (d) => { 
        rooms[d.id] = { ...d, activeVariant: { id: d.pendingVariant, name: variantNames[d.pendingVariant] }, players: Array(10).fill(null), community: [], phase: PHASES.IDLE, potData: [{ amount: 0 }], dealerIdx: -1, activeIdx: -1 }; 
        io.emit('lobbyUpdate', Object.values(rooms)); 
    });
    socket.on('adminDeleteRoom', (id) => { delete rooms[id]; io.emit('lobbyUpdate', Object.values(rooms)); });
    socket.on('adminNuclearReset', () => {
        globalProfiles = []; rooms = {};
        Object.keys(roomIntervals).forEach(k => clearInterval(roomIntervals[k]));
        saveToDisk(); io.emit('profilesUpdate', []); io.emit('lobbyUpdate', []);
    });
    socket.on('adminAddChips', (d) => {
        const r = rooms[d.roomId]; const rp = r?.players.find(x => x && x.uid === d.uid); const p = globalProfiles.find(x => x.uid === d.uid);
        if (rp && p && p.chips >= d.chips) { 
            rp.chips += d.chips; rp.buyInOrigin += d.chips; p.chips -= d.chips; rp.isBust = false; 
            clearInterval(rebuyIntervals[`${d.roomId}-${r.players.indexOf(rp)}`]); 
            io.to(d.roomId).emit('roomUpdate', r); io.emit('profilesUpdate', globalProfiles); saveToDisk(); 
            if (r.phase === PHASES.IDLE && r.players.filter(p => p && p.chips > 0).length >= 2) {
                clearTimeout(ignitionTimeouts[d.roomId]);
                ignitionTimeouts[d.roomId] = setTimeout(() => runIgnition(d.roomId), 5000);
            }
        }
    });
    socket.on('adminAddBot', (d) => {
        const room = rooms[d.roomId];
        const slot = room?.players.findIndex(p => p === null);
        if (slot !== -1) {
            const botName = "BOT_" + Math.random().toString(36).slice(2, 5).toUpperCase();
            room.players[slot] = { name: botName, uid: 'bot_' + Math.random(), chips: 2000, isBot: true, hand: [], pendingVariant: 'HOLDEM', strength: "", isFolded: room.phase !== PHASES.IDLE, isSittingOut: room.phase !== PHASES.IDLE };
            io.to(d.roomId).emit('roomUpdate', room); io.emit('lobbyUpdate', Object.values(rooms));
            if (room.phase === PHASES.IDLE && room.players.filter(p => p && p.chips > 0).length >= 2) {
                clearTimeout(ignitionTimeouts[d.roomId]);
                ignitionTimeouts[d.roomId] = setTimeout(() => runIgnition(d.roomId), 5000);
            }
        }
    });
    socket.on('playerAction', (d) => handleAction(d.roomId, d.type, d.amount));
    socket.on('updatePlayerSettings', (d) => {
        const p = globalProfiles.find(x => x.uid === d.uid);
        if (p) p.pendingVariant = d.pendingVariant;
        Object.values(rooms).forEach(r => { 
            const rp = r.players.find(x => x && x.uid === d.uid); 
            if (rp) rp.pendingVariant = d.pendingVariant; 
        });
    });
    socket.on('disconnecting', () => {
        for (const roomId of socket.rooms) {
            const room = rooms[roomId];
            if (room) {
                const idx = room.players.findIndex(p => p?.socketId === socket.id);
                if (idx !== -1) {
                    if (room.activeIdx === idx && room.phase !== PHASES.IDLE) handleAction(roomId, 'FOLD', 0);
                    const prof = globalProfiles.find(x => x.uid === room.players[idx].uid);
                    if (prof) { prof.chips += (room.players[idx].chips - room.players[idx].buyInOrigin); saveToDisk(); io.emit('profilesUpdate', globalProfiles); }
                    room.players[idx] = null;
                    if (room.players.filter(p => p && !p.isSittingOut).length < 2 && room.phase !== PHASES.IDLE) processShowdown(roomId);
                    io.to(roomId).emit('roomUpdate', room); io.emit('lobbyUpdate', Object.values(rooms));
                }
            }
        }
    });
});

httpServer.listen(10000);
