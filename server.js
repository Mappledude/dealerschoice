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

const saveToDisk = () => {
    try {
        const data = JSON.stringify({ globalProfiles, rooms }, null, 2);
        fs.writeFileSync(DB_PATH, data);
    } catch (err) { console.error("Disk Save Error:", err); }
};

const loadFromDisk = () => {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = JSON.parse(fs.readFileSync(DB_PATH));
            globalProfiles = data.globalProfiles || [];
            rooms = data.rooms || {};
        }
    } catch (err) { console.log("Fresh DB Init"); }
};
loadFromDisk();

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♣', '♥', '♦'];
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const getCombinations = (arr, k) => {
    const fn = (n, src, got, all) => {
        if (n === 0) { all.push(got); return; }
        for (let j = 0; j < src.length; j++) fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
    };
    const all = []; fn(k, arr, [], all); return all;
};

const rankHand = (cards) => {
    if (!cards || cards.length < 5) return { power: 0, name: "High Card", cards: [] };
    const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
    const ranks = sorted.map(c => VM[c.value]);
    const suits = sorted.map(c => c.suit);
    const isFlush = new Set(suits).size === 1;
    let isStraight = true;
    for (let i = 0; i < 4; i++) if (ranks[i] !== ranks[i + 1] + 1) isStraight = false;
    if (!isStraight && JSON.stringify(ranks) === "[14,5,4,3,2]") isStraight = true;

    const counts = {}; ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
    const tiebreakerRanks = Object.entries(counts)
        .map(([rank, count]) => ({ r: parseInt(rank), c: count }))
        .sort((a, b) => b.c - a.c || b.r - a.r);

    const compArr = [];
    tiebreakerRanks.forEach(item => { for(let i=0; i < item.c; i++) compArr.push(item.r); });

    const vc = tiebreakerRanks.map(x => x.c);
    let score = 0, name = "High Card";
    if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
    else if (vc[0] === 4) { score = 7; name = "Four of a Kind"; }
    else if (vc[0] === 3 && vc[1] === 2) { score = 6; name = "Full House"; }
    else if (isFlush) { score = 5; name = "Flush"; }
    else if (isStraight) { score = 4; name = "Straight"; }
    else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
    else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
    else if (vc[0] === 2) { score = 1; name = "Pair"; }

    const power = score * 1e10 + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 4 - i)), 0);
    return { power, name, cards: sorted };
};

const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0) return null;
    let best = null;
    if (variantId === 'OMAHA') {
        if (comm.length < 3) return null;
        const holeCombos = getCombinations(hole, 2);
        const commCombos = getCombinations(comm, 3);
        holeCombos.forEach(h => {
            commCombos.forEach(c => {
                const res = rankHand([...h, ...c]);
                if (!best || res.power > best.power) best = res;
            });
        });
    } else {
        const full = [...hole, ...comm];
        if (full.length < 5) return null;
        const combos = getCombinations(full, 5);
        combos.forEach(c => {
            const res = rankHand(c);
            if (!best || res.power > best.power) best = res;
        });
    }
    return best;
};

const startShotClock = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    clearInterval(roomIntervals[roomId]);
    
    const p = room.players[room.activeIdx];
    if (!p) return;

    // SMARTER BOT LOGIC: Acts in 1.5s
    if (p.isBot) {
        setTimeout(() => {
            const currentRoom = rooms[roomId];
            if (!currentRoom || currentRoom.activeIdx === -1 || currentRoom.players[currentRoom.activeIdx]?.uid !== p.uid) return;
            
            const best = getBestHand(p.hand, currentRoom.community, currentRoom.activeVariant?.id);
            const score = best ? (best.power / 1e10) : 0;
            const callAmt = currentRoom.highestBet - p.currentBet;
            const pot = currentRoom.potData[0].amount;
            const isMuflis = currentRoom.activeVariant?.id === 'MUFLIS';
            const isLowPhase = currentRoom.activeVariant?.id === 'HILOW';

            let type = 'CALL';
            let amt = 0;

            if (isMuflis) {
                if (score < 1) { // High Card is good in Muflis
                    type = Math.random() > 0.3 ? 'RAISE' : 'CALL';
                    amt = currentRoom.highestBet + Math.max(currentRoom.bb, Math.floor(pot * 0.3));
                } else if (score > 2 && callAmt > 200) type = 'FOLD';
            } else {
                if (score >= 3) { // Trips or better
                    type = 'RAISE';
                    amt = currentRoom.highestBet + Math.max(currentRoom.bb, Math.floor(pot * 0.5));
                } else if (score < 1 && callAmt > p.chips * 0.2) {
                    type = Math.random() > 0.1 ? 'FOLD' : 'CALL';
                }
            }

            if (type === 'RAISE') amt = Math.min(p.chips + p.currentBet, amt);
            handleAction(roomId, type, amt);
        }, 1500);
    }

    room.timeRemaining = 30;
    roomIntervals[roomId] = setInterval(() => {
        if (!rooms[roomId]) return clearInterval(roomIntervals[roomId]);
        rooms[roomId].timeRemaining--;
        if (rooms[roomId].timeRemaining <= 0) {
            clearInterval(roomIntervals[roomId]);
            const ap = rooms[roomId].players[rooms[roomId].activeIdx];
            const canCheck = rooms[roomId].highestBet === ap.currentBet;
            io.to(roomId).emit('log', { name: "SYSTEM", action: `${ap.name} timed out. Auto-${canCheck ? 'checked' : 'folded'}.`, type: 'system' });
            handleAction(roomId, canCheck ? 'CALL' : 'FOLD', 0);
        } else {
            io.to(roomId).emit('roomUpdate', rooms[roomId]);
        }
    }, 1000);
};

const handleAction = (roomId, type, amount) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    const p = room.players[room.activeIdx];
    if (!p) return;

    p.hasActed = true;
    let logMsg = "";
    if (type === 'FOLD') { p.isFolded = true; logMsg = "folded"; }
    else if (type === 'CALL') {
        const diff = Math.min(p.chips, room.highestBet - p.currentBet);
        p.chips -= diff; p.currentBet += diff;
        logMsg = diff === 0 ? "checked" : `called $${diff}`;
    } else if (type === 'RAISE') {
        const diff = amount - p.currentBet;
        p.chips -= diff; p.currentBet = amount;
        room.highestBet = amount;
        logMsg = `raised to $${amount}`;
        room.players.forEach(op => { if (op && op.uid !== p.uid && op.chips > 0) op.hasActed = false; });
    }
    io.to(roomId).emit('log', { name: p.name, action: logMsg });

    const active = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const withChips = active.filter(i => room.players[i].chips > 0);
    const allMatched = active.every(i => room.players[i].currentBet === room.highestBet || room.players[i].chips === 0);
    const allActed = active.every(i => room.players[i].hasActed || room.players[i].chips === 0);

    if (active.length === 1) processShowdown(roomId);
    else if (allMatched && (allActed || withChips.length <= 1)) advancePhase(roomId);
    else {
        const cur = active.indexOf(room.activeIdx);
        room.activeIdx = active[(cur + 1) % active.length];
        startShotClock(roomId);
    }
};

const advancePhase = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    let pot = 0;
    room.players.forEach(p => { if (p) { pot += p.currentBet; p.currentBet = 0; p.hasActed = false; } });
    room.potData[0].amount += pot;
    room.highestBet = 0;

    if (room.phase === PHASES.PRE_FLOP) {
        room.phase = PHASES.FLOP; room.community = [room.deck.pop(), room.deck.pop(), room.deck.pop()];
    } else if (room.phase === PHASES.FLOP) {
        room.phase = PHASES.TURN; room.community.push(room.deck.pop());
    } else if (room.phase === PHASES.TURN) {
        room.phase = PHASES.RIVER; room.community.push(room.deck.pop());
    } else {
        processShowdown(roomId);
        return;
    }

    const active = room.players.map((p, i) => (p && !p.isFolded) ? i : null).filter(x => x !== null);
    const withChips = active.filter(i => room.players[i].chips > 0);

    room.players.forEach(p => {
        if (p && p.hand?.length > 0 && !p.isFolded) {
            const best = getBestHand(p.hand, room.community, room.activeVariant?.id);
            p.strength = best ? best.name : "High Card";
        }
    });

    if (withChips.length <= 1) {
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
    let streetPot = 0;
    room.players.forEach(p => { if (p) { streetPot += p.currentBet; p.currentBet = 0; } });
    room.potData[0].amount += streetPot;
    const totalPot = room.potData[0].amount;

    const evals = activeIndices.map(i => ({ 
        i, 
        res: getBestHand(room.players[i].hand, room.community, room.activeVariant?.id) 
    }));

    room.showdownWinners = [];

    // Safety: If game ended early (everyone folded), the remaining player wins everything.
    if (evals.length === 1 || !evals[0].res) {
        const winnerIdx = activeIndices[0];
        const p = room.players[winnerIdx];
        p.chips += totalPot; p.isWinner = true;
        room.showdownWinners.push({ name: p.name, rank: p.strength || "Winner", hand: p.hand, amount: totalPot });
        io.to(roomId).emit('log', { name: "ARENA", action: `${p.name} wins $${totalPot}`, type: 'win' });
    } else if (room.activeVariant?.id === 'HILOW') {
        evals.sort((a, b) => (b.res?.power || 0) - (a.res?.power || 0));
        const highWinners = evals.filter(e => e.res.power === evals[0].res.power);
        const lowEvals = [...evals].sort((a, b) => (a.res?.power || 0) - (b.res?.power || 0));
        const lowWinners = lowEvals.filter(e => e.res.power === lowEvals[0].res.power);
        
        const highShare = Math.floor(totalPot / 2 / highWinners.length);
        const lowShare = Math.floor(totalPot / 2 / lowWinners.length);

        highWinners.forEach(w => {
            room.players[w.i].chips += highShare; room.players[w.i].isWinner = true;
            room.showdownWinners.push({ name: room.players[w.i].name, rank: w.res.name, hand: w.res.cards, amount: highShare, type: 'High' });
        });
        lowWinners.forEach(w => {
            room.players[w.i].chips += lowShare; room.players[w.i].isWinner = true;
            room.showdownWinners.push({ name: room.players[w.i].name, rank: w.res.name, hand: w.res.cards, amount: lowShare, type: 'Low' });
        });
        room.winning5Ids = highWinners[0].res.cards.map(c => c.id);
    } else {
        const isMuflis = room.activeVariant?.id === 'MUFLIS';
        evals.sort((a, b) => isMuflis ? (a.res.power - b.res.power) : (b.res.power - a.res.power));
        const winners = evals.filter(e => e.res.power === evals[0].res.power);
        const share = Math.floor(totalPot / winners.length);
        winners.forEach(w => {
            const p = room.players[w.i];
            p.chips += share; p.isWinner = true;
            room.winning5Ids = w.res.cards.map(c => c.id);
            room.showdownWinners.push({ name: p.name, rank: w.res.name, hand: w.res.cards, amount: share });
        });
    }

    io.to(roomId).emit('roomUpdate', room);
    saveToDisk();

    setTimeout(() => {
        if (!rooms[roomId]) return;
        room.phase = PHASES.IDLE;
        room.community = []; room.winning5Ids = []; room.showdownWinners = null;
        room.players.forEach(p => { if (p) { p.hand = []; p.isWinner = false; p.isFolded = false; p.currentBet = 0; p.hasActed = false; p.strength = ""; p.isSittingOut = false; } });
        const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) {
            const dIdx = seated.indexOf(room.dealerIdx);
            room.dealerIdx = seated[(dIdx + 1) % seated.length];
            runIgnition(roomId);
        }
    }, 9000);
};

const runIgnition = (roomId) => {
    const room = rooms[roomId];
    const seated = room?.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null) || [];
    if (!room || seated.length < 2) return;

    if (!room.players[room.dealerIdx]) room.dealerIdx = seated[0];
    const dealer = room.players[room.dealerIdx];
    const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2, HILOW: 2 };
    const variantNames = { HOLDEM: "Hold'em", OMAHA: "OMAHA", PINEAPPLE: "Pineapple", MUFLIS: "Muflis", HILOW: "Hi-Low" };
    const vId = dealer.pendingVariant || 'HOLDEM';
    room.activeVariant = { id: vId, name: variantNames[vId], holeCards: holeCardsMap[vId] };

    let deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
    room.deck = deck; room.community = []; room.potData = [{ amount: 0 }]; room.highestBet = room.bb;

    const dIdx = seated.indexOf(room.dealerIdx);
    const sbIdx = seated[(dIdx + 1) % seated.length];
    const bbIdx = seated[(dIdx + 2) % seated.length];

    room.players.forEach((p, i) => {
        if (!p) return;
        p.hand = Array.from({ length: room.activeVariant.holeCards }, () => room.deck.pop());
        const bet = Math.min(p.chips, (i === sbIdx) ? room.sb : (i === bbIdx) ? room.bb : 0);
        p.chips -= bet; p.currentBet = bet; p.isFolded = false; p.isWinner = false; p.hasActed = false;
        p.isDealer = (i === room.dealerIdx); p.strength = ""; p.isSittingOut = false;
    });

    room.phase = PHASES.PRE_FLOP;
    room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
    startShotClock(roomId);
};

io.on('connection', (socket) => {
    socket.on('playerLogin', (d) => {
        const p = globalProfiles.find(x => x.password === d.password);
        if (p) socket.emit('loginSuccess', p);
        else socket.emit('loginFailure', { message: 'Invalid Login' });
    });
    socket.on('joinRoom', (d, cb) => {
        const room = rooms[d.roomId];
        if (!room) return;
        const slot = room.players.findIndex(p => p === null);
        if (slot !== -1) {
            const isMidGame = room.phase !== PHASES.IDLE;
            room.players[slot] = { 
                ...d.profile, chips: d.buyIn, buyInOrigin: d.buyIn, socketId: socket.id, 
                hand: [], strength: "", isFolded: isMidGame, isSittingOut: isMidGame
            };
            if (room.dealerIdx === -1) room.dealerIdx = slot;
            socket.join(d.roomId);
            io.to(d.roomId).emit('log', { name: "ARENA", action: `${d.profile.name} joined`, type: 'system' });
            io.to(d.roomId).emit('roomUpdate', room);
            io.emit('lobbyUpdate', Object.values(rooms));
            if (cb) cb({ status: 'ok' });
            if (!isMidGame && room.players.filter(p => p).length >= 2) runIgnition(d.roomId);
        }
    });
    socket.on('getInitialData', () => {
        socket.emit('initialDataResponse', { profiles: globalProfiles, rooms: Object.values(rooms) });
        socket.emit('lobbyUpdate', Object.values(rooms));
    });
    socket.on('adminCreatePlayer', (d, cb) => { globalProfiles.push(d); saveToDisk(); io.emit('profilesUpdate', globalProfiles); if (cb) cb(); });
    socket.on('adminDeletePlayer', (uid) => { globalProfiles = globalProfiles.filter(p => p.uid !== uid); saveToDisk(); io.emit('profilesUpdate', globalProfiles); });
    socket.on('adminEditChips', (d) => { const p = globalProfiles.find(x => x.uid === d.uid); if (p) p.chips = d.chips; saveToDisk(); io.emit('profilesUpdate', globalProfiles); });
    socket.on('adminCreateRoom', (d) => { 
        rooms[d.id] = { ...d, players: Array(10).fill(null), community: [], phase: PHASES.IDLE, potData: [{ amount: 0 }], dealerIdx: -1, activeIdx: -1 }; 
        saveToDisk(); io.emit('lobbyUpdate', Object.values(rooms)); 
    });
    socket.on('adminDeleteRoom', (id) => { delete rooms[id]; saveToDisk(); io.emit('lobbyUpdate', Object.values(rooms)); });
    socket.on('adminAddChips', (d) => {
        const r = rooms[d.roomId];
        const rp = r?.players.find(x => x && x.uid === d.uid);
        const p = globalProfiles.find(x => x.uid === d.uid);
        if (rp && p && p.chips >= d.chips) {
            rp.chips += d.chips; rp.buyInOrigin += d.chips; p.chips -= d.chips;
            io.to(d.roomId).emit('roomUpdate', r); io.emit('profilesUpdate', globalProfiles); saveToDisk();
        }
    });
    socket.on('adminAddBot', (d) => {
        const room = rooms[d.roomId];
        const slot = room?.players.findIndex(p => p === null);
        if (slot !== -1) {
            const botVar = ['HOLDEM', 'OMAHA', 'PINEAPPLE', 'MUFLIS', 'HILOW'][Math.floor(Math.random()*5)];
            const isMidGame = room.phase !== PHASES.IDLE;
            room.players[slot] = { 
                name: "BOT_" + Math.random().toString(36).slice(2, 5).toUpperCase(), 
                uid: 'bot_' + Math.random(), chips: 2000, isBot: true, hand: [], pendingVariant: botVar, 
                strength: "", isFolded: isMidGame, isSittingOut: isMidGame
            };
            io.to(d.roomId).emit('roomUpdate', room); io.emit('lobbyUpdate', Object.values(rooms));
            if (!isMidGame && room.players.filter(p => p).length >= 2) runIgnition(d.roomId);
        }
    });
    socket.on('playerAction', (d) => handleAction(d.roomId, d.type, d.amount));
    socket.on('updatePlayerSettings', (d) => {
        const p = globalProfiles.find(x => x.uid === d.uid);
        if (p) p.pendingVariant = d.pendingVariant;
        Object.values(rooms).forEach(r => { const rp = r.players.find(x => x && x.uid === d.uid); if (rp) rp.pendingVariant = d.pendingVariant; });
        saveToDisk();
    });
    socket.on('disconnecting', () => {
        for (const roomId of socket.rooms) {
            const room = rooms[roomId];
            if (room) {
                const idx = room.players.findIndex(p => p?.socketId === socket.id);
                if (idx !== -1) {
                    if (room.activeIdx === idx && room.phase !== PHASES.IDLE) handleAction(roomId, 'FOLD', 0);
                    const p = room.players[idx];
                    const prof = globalProfiles.find(x => x.uid === p.uid);
                    if (prof) { prof.chips += (p.chips - p.buyInOrigin); saveToDisk(); io.emit('profilesUpdate', globalProfiles); }
                    room.players[idx] = null;
                    const remaining = room.players.filter(p => p && !p.isSittingOut);
                    if (remaining.length < 2 && room.phase !== PHASES.IDLE) processShowdown(roomId);
                    io.to(roomId).emit('roomUpdate', room); io.emit('lobbyUpdate', Object.values(rooms));
                }
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT);
