import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);

// Logic Upgrade: Handling mobile connectivity and long sessions
const io = new Server(server, { 
  cors: { origin: "*" },
  pingTimeout: 60000, 
  pingInterval: 25000  
});

// VERSION: v1.0.27 (Internal Server)
const VERSION = "v1.0.27";
const APP_NAME = "Dealers Choice";
const TOTAL_SEATS = 10; 

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const V_LABEL = { 1: 'Ace(Low)', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };

const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2, HILOW: 4, REDSBLACKS: 4 };
const variantNames = {
  HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple",
  MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks"
};

const BOT_NAMES = ["Baabu Shona", "Laddoo", "Chikku", "Guddu", "Kalia", "Chinky", "Bunty", "Babli", "Chhotu", "Motu", "Jadiya", "Piddi"];

const BOT_PERSONALITIES = {
    "Baabu Shona": "CALCULATED", "Chinky": "CALCULATED", "Motu": "CALCULATED",
    "Kalia": "AGGRESSIVE", "Chikku": "AGGRESSIVE", "Bunty": "AGGRESSIVE",
    "Jadiya": "TIGHT", "Guddu": "TIGHT", "Babli": "TIGHT",
    "Laddoo": "PASSIVE", "Chhotu": "PASSIVE", "Piddi": "PASSIVE"
};

// --- FLUID MATH UTILS ---
const round = (val) => Math.round(val * 100) / 100;

let profiles = []; 
let rooms = {};
let disconnectTimeouts = {}; 

const serializeRoom = (room) => {
    if (!room) return null;
    const { timer, deck, ignitionTimer, ...rest } = room;
    return { ...rest, minRaiseAmount: round(room.highestBet + room.lastRaiseIncrement) };
};

const combinations = (array, k) => {
  let result = [];
  const fn = (start, prev) => {
    if (prev.length === k) { result.push(prev); return; }
    for (let i = start; i < array.length; i++) { fn(i + 1, [...prev, array[i]]); }
  };
  fn(0, []);
  return result;
};

const rankHand = (cards, isAceLow = false) => {
  if (!cards || cards.length < 5) return { power: 0, name: "Pre-flop", cards: [] };
  const getVal = (v) => (isAceLow && v === 'A') ? 1 : VM[v];
  const sorted = [...cards].sort((a, b) => getVal(b.value) - getVal(a.value));
  const ranks = sorted.map(c => getVal(c.value));
  const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
  let compArr = [];
  groups.forEach(g => { for (let i = 0; i < g.c; i++) compArr.push(g.r); });
  const vc = groups.map(x => x.c);
  const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;
  if (uniqueRanks.length >= 5) {
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
    if (!isStraight && !isAceLow && uniqueRanks.includes(14) && [5,4,3,2].every(r => uniqueRanks.includes(r))) {
        isStraight = true; straightHigh = 5; compArr = [5, 4, 3, 2, 1]; 
    }
  }
  let score = 0, name = `High Card ${V_LABEL[compArr[0]] || compArr[0]}`;
  if (vc[0] === 5) { score = 9; name = `Five of a Kind ${V_LABEL[groups[0].r]}s`; }
  else if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
  else if (vc[0] === 4) { score = 7; name = `Four of a Kind ${V_LABEL[groups[0].r]}s`; }
  else if (vc[0] === 3 && vc[1] >= 2) { score = 6; name = `Full House, ${V_LABEL[groups[0].r]}s full of ${V_LABEL[groups[1].r]}s`; }
  else if (isFlush) { score = 5; name = `Flush, ${V_LABEL[compArr[0]]} high`; }
  else if (isStraight) { score = 4; name = `Straight, ${V_LABEL[straightHigh]} high`; }
  else if (vc[0] === 3) { score = 3; name = `Three of a Kind ${V_LABEL[groups[0].r]}s`; }
  else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = `Two Pair, ${V_LABEL[groups[0].r]}s and ${V_LABEL[groups[1].r]}s`; }
  else if (vc[0] === 2) { score = 1; name = `Pair of ${V_LABEL[groups[0].r]}s`; }
  const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
  return { power, name, cards: sorted.slice(0, 5) };
};

const getBestHand = (hole, comm, variantId) => {
  if (!hole || hole.length === 0 || !comm || comm.length < 3) return { high: { power: 0, name: "Pre-flop" }, low: null };
  let bestHigh = { power: -1, name: "Pre-flop" };
  let bestLow = null;
  const boardCombos = combinations(comm, 3);
  const holePairs = combinations(hole, 2);
  if (variantId === 'HOLDEM' || variantId === 'PINEAPPLE') {
    combinations([...hole, ...comm], 5).forEach(c => {
        const res = rankHand(c);
        if (res.power > bestHigh.power) bestHigh = res;
    });
  } else if (variantId === 'OMAHA') {
    holePairs.forEach(h => { boardCombos.forEach(b => {
            const res = rankHand([...h, ...b]);
            if (res.power > bestHigh.power) bestHigh = res;
    });});
  } else if (variantId === 'HILOW') {
    holePairs.forEach(h => { boardCombos.forEach(b => {
            const resH = rankHand([...h, ...b], false);
            if (resH.power > bestHigh.power) bestHigh = resH;
            const resL = rankHand([...h, ...b], true);
            if (!bestLow || resL.power < bestLow.power) { bestLow = { ...resL, name: resL.name.replace('High Card', 'Low') }; }
    });});
  } else if (variantId === 'MUFLIS') {
      holePairs.forEach(h => { boardCombos.forEach(b => {
              const res = rankHand([...h, ...b], true); 
              if (bestHigh.power === -1 || res.power < bestHigh.power) bestHigh = res;
      });});
  }
  return { high: bestHigh, low: bestLow };
};

const updateRoomStrengths = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const variantId = room.activeVariant?.id || 'HOLDEM';
    room.players.forEach(p => {
        if (p && p.hand && !p.isFolded && !p.waitingForNextHand) {
            const evaluation = getBestHand(p.hand, room.community, variantId);
            p.strength = evaluation.high.name;
            p.strengthPower = evaluation.high.power;
            if (room.phase === PHASES.PRE_FLOP) { p.winProbability = 0; p.lowWinProbability = 0; } 
            else {
                const maxPower = 9 * Math.pow(15, 7);
                const rawProb = (p.strengthPower / maxPower) * 100;
                p.winProbability = variantId === 'MUFLIS' ? round(Math.max(5, 100 - rawProb)) : round(Math.min(99, Math.max(5, rawProb)));
                if (evaluation.low) {
                    p.lowStrength = evaluation.low.name;
                    p.lowStrengthPower = evaluation.low.power;
                    const rawLowProb = 100 - ((p.lowStrengthPower / (Math.pow(15, 6) * 13)) * 100);
                    p.lowWinProbability = round(Math.min(100, Math.max(5, rawLowProb * 1.5)));
                } else { p.lowWinProbability = 0; p.lowStrength = variantId === 'HILOW' ? "No Qualifier" : null; }
            }
        }
    });
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    room.activeIdx = -1;
    room.gameInProgress = false;
    if (room.timer) clearInterval(room.timer);
    const activePlayers = room.players.filter(p => p !== null && !p.waitingForNextHand);
    const variantId = room.activeVariant?.id || 'HOLDEM';
    const rawPotsWins = [];
    const contributions = activePlayers.map(p => ({ uid: p.uid, amount: p.totalContribution, folded: p.isFolded, name: p.name, player: p })).sort((a, b) => a.amount - b.amount);
    let lastLevel = 0;
    const pots = [];
    contributions.forEach((c, idx) => {
        const diff = round(c.amount - lastLevel);
        if (diff > 0) {
            let segAmount = 0;
            let eligible = [];
            contributions.slice(idx).forEach(other => {
                segAmount = round(segAmount + diff);
                if (!other.folded) eligible.push(other.uid);
            });
            if (eligible.length > 0) pots.push({ amount: segAmount, eligible });
            else if (pots.length > 0) pots[pots.length-1].amount = round(pots[pots.length-1].amount + segAmount);
            lastLevel = c.amount;
        }
    });
    const totalUnfolded = activePlayers.filter(p => !p.isFolded).length;
    pots.forEach(pot => {
        const eligiblePlayers = room.players.filter(p => p && pot.eligible.includes(p.uid));
        if (totalUnfolded === 1 && eligiblePlayers.length === 1) {
            const soleWinner = eligiblePlayers[0];
            soleWinner.chips = round(soleWinner.chips + pot.amount);
            rawPotsWins.push({ name: soleWinner.name, uid: soleWinner.uid, rank: "!", hand: [], amount: pot.amount });
            return;
        }
        const evals = eligiblePlayers.map(p => ({ player: p, res: getBestHand(p.hand, room.community, variantId) }));
        if (variantId === 'HILOW') {
            const lowHalf = round(pot.amount / 2);
            const highHalf = round(pot.amount - lowHalf);
            const eligibleLow = evals.filter(e => e.res && e.res.low);
            if (eligibleLow.length > 0) {
                const lowSorted = [...eligibleLow].sort((a, b) => a.res.low.power - b.res.low.power);
                const winnersL = lowSorted.filter(e => e.res.low.power === lowSorted[0].res.low.power);
                winnersL.forEach(w => { const share = round(lowHalf / winnersL.length); w.player.chips = round(w.player.chips + share); rawPotsWins.push({ name: w.player.name, uid: w.player.uid, rank: `LOW: ${w.res.low.name}`, hand: w.res.low.cards, amount: share }); });
                const highSorted = [...evals].sort((a, b) => b.res.high.power - a.res.high.power);
                const winnersH = highSorted.filter(e => e.res.high.power === highSorted[0].res.high.power);
                winnersH.forEach(w => { const share = round(highHalf / winnersH.length); w.player.chips = round(w.player.chips + share); rawPotsWins.push({ name: w.player.name, uid: w.player.uid, rank: `HIGH: ${w.res.high.name}`, hand: w.res.high.cards, amount: share }); });
            } else {
                const highSorted = [...evals].sort((a, b) => b.res.high.power - a.res.high.power);
                const winnersH = highSorted.filter(e => e.res.high.power === highSorted[0].res.high.power);
                winnersH.forEach(w => { const share = round(pot.amount / winnersH.length); w.player.chips = round(w.player.chips + share); rawPotsWins.push({ name: w.player.name, uid: w.player.uid, rank: `SCOOP: ${w.res.high.name}`, hand: w.res.high.cards, amount: share }); });
            }
        } else {
            evals.sort((a, b) => variantId === 'MUFLIS' ? (a.res.high.power - b.res.high.power) : (b.res.high.power - a.res.high.power));
            const winners = evals.filter(e => e.res.high.power === evals[0].res.high.power);
            winners.forEach(w => { const share = round(pot.amount / winners.length); w.player.chips = round(w.player.chips + share); rawPotsWins.push({ name: w.player.name, uid: w.player.uid, rank: w.res.high.name, hand: w.res.high.cards, amount: share }); });
        }
    });
    const aggregated = {};
    rawPotsWins.forEach(win => {
        if (!aggregated[win.uid]) aggregated[win.uid] = { ...win };
        else {
            aggregated[win.uid].amount = round(aggregated[win.uid].amount + win.amount);
            if (win.rank !== "!" && aggregated[win.uid].rank !== "!" && !aggregated[win.uid].rank.includes(win.rank)) {
                aggregated[win.uid].rank = `${aggregated[win.uid].rank} & ${win.rank}`;
                const existingIds = aggregated[win.uid].hand.map(c => c.id);
                win.hand.forEach(c => { if (!existingIds.includes(c.id)) aggregated[win.uid].hand.push(c); });
            }
        }
    });
    room.showdownWinners = Object.values(aggregated);
    room.phase = PHASES.SHOWDOWN;
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    room.showdownWinners.forEach(w => {
      io.to(roomId).emit('log', { name: w.name, action: w.rank === "!" ? `SCOOPED THE POT` : `WON TOTAL $${w.amount.toFixed(2)} WITH ${w.rank.toUpperCase()}`, type: 'win' });
    });
    setTimeout(() => {
        room.players.forEach(p => { if (p) { p.waitingForNextHand = false; p.lastAction = null; if (p.isBot && p.chips < Number(room.bb)) { p.chips = Number(room.maxBuy); io.to(roomId).emit('log', { name: "SYSTEM", action: `${p.name.toUpperCase()} RE-BOUGHT FOR $${room.maxBuy}`, type: 'phase' }); } } });
        const seated = room.players.map((p, i) => (p && p.chips > 0.01) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) { room.dealerIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length]; runIgnition(roomId); } 
        else { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', serializeRoom(room)); }
    }, (room.showdownWinners.length || 1) * 5000);
};

const triggerBotTurn = (roomId) => {
    const room = rooms[roomId];
    if (!room || room.activeIdx === -1) return;
    const player = room.players[room.activeIdx];
    if (!player || !player.isBot) return;
    setTimeout(() => {
        const currentRoom = rooms[roomId];
        if (!currentRoom || currentRoom.activeIdx === -1 || currentRoom.players[currentRoom.activeIdx]?.uid !== player.uid) return;
        let winProb = Math.max(player.winProbability || 0, player.lowWinProbability || 0);
        const personality = BOT_PERSONALITIES[player.name] || "CALCULATED";
        let personalityMod = personality === "TIGHT" ? -15 : personality === "AGGRESSIVE" ? 15 : personality === "PASSIVE" ? -10 : 0;
        let bluffChance = personality === "AGGRESSIVE" ? 20 : personality === "TIGHT" ? 2 : 5;
        let effectiveWinProb = winProb + personalityMod;
        if (Math.random() * 100 < bluffChance) effectiveWinProb = 90;
        let type = 'CALL'; let raiseAmt = 0; const rand = Math.random() * 100;
        if (effectiveWinProb > 85) {
            if (personality === "PASSIVE" && rand < 80) type = 'CALL';
            else if (rand < 70) { type = 'RAISE'; raiseAmt = round(currentRoom.highestBet + (currentRoom.lastRaiseIncrement * (personality === "AGGRESSIVE" ? 3 : 2))); }
            else type = 'CALL';
        } else if (effectiveWinProb > 60) {
            if (personality === "TIGHT" && rand < 70) type = 'CALL';
            else if (rand < 30) { type = 'RAISE'; raiseAmt = round(currentRoom.highestBet + currentRoom.lastRaiseIncrement); }
            else type = 'CALL';
        } else if (effectiveWinProb < 30 && round(currentRoom.highestBet - player.currentBet) > 0.01) {
            if (personality === "AGGRESSIVE" && rand < 40) type = 'CALL';
            else type = 'FOLD';
        } else if (effectiveWinProb < 15) type = 'FOLD';
        if (type === 'FOLD' && round(currentRoom.highestBet - player.currentBet) <= 0.01) type = 'CALL';
        performAction(roomId, type, raiseAmt);
    }, 1500);
};

const performAction = (roomId, type, amount) => {
    const room = rooms[roomId]; if (!room || room.activeIdx === -1) return;
    if (room.timer) clearInterval(room.timer);
    const player = room.players[room.activeIdx]; if (!player) { moveToNextPlayer(roomId); return; }
    player.actedThisStreet = true;
    if (type === 'FOLD') { player.isFolded = true; player.lastAction = "FOLD"; io.to(roomId).emit('log', { name: player.name, action: `FOLDED`, type: 'fold' }); } 
    else if (type === 'CALL') {
        const diff = round(room.highestBet - (player.currentBet || 0));
        const actualCall = Math.min(diff, player.chips);
        player.chips = round(player.chips - actualCall); player.currentBet = round((player.currentBet || 0) + actualCall); player.totalContribution = round((player.totalContribution || 0) + actualCall);
        player.lastAction = actualCall > 0 ? "CALL" : "CHECK"; 
        io.to(roomId).emit('log', { name: player.name, action: actualCall > 0 ? `CALLED $${actualCall.toFixed(2)}` : `CHECKED`, type: 'bet' });
    } else if (type === 'RAISE') {
        const minLegalRaise = round(room.highestBet + room.lastRaiseIncrement);
        const playerMax = round(player.chips + (player.currentBet || 0));
        const cappedRaise = Math.min(Math.max(amount, minLegalRaise), playerMax);
        const diff = round(cappedRaise - (player.currentBet || 0));
        const increment = round(cappedRaise - room.highestBet);
        player.chips = round(player.chips - diff); player.currentBet = cappedRaise; player.totalContribution = round((player.totalContribution || 0) + diff);
        room.highestBet = cappedRaise; player.lastAction = "RAISE";
        if (increment >= room.lastRaiseIncrement) { room.lastRaiseIncrement = increment; room.players.forEach(p => { if (p && p.uid !== player.uid) p.actedThisStreet = false; }); }
        io.to(roomId).emit('log', { name: player.name, action: `RAISED to $${cappedRaise.toFixed(2)}`, type: 'bet' });
    }
    moveToNextPlayer(roomId);
};

const moveToNextPlayer = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    updateRoomStrengths(roomId);
    const active = room.players.filter(p => p && !p.isFolded && !p.waitingForNextHand && !p.isDisconnected);
    const allMatched = active.every(p => p.chips < 0.01 || Math.abs(p.currentBet - room.highestBet) < 0.01);
    const allActed = active.every(p => p.chips < 0.01 || p.actedThisStreet);
    
    // Phase 5: Flawless transition logic
    if (active.length <= 1) { room.activeIdx = -1; collectBets(room); io.to(roomId).emit('roomUpdate', serializeRoom(room)); setTimeout(() => processShowdown(roomId), 1000); } 
    else if (allMatched && allActed) { room.activeIdx = -1; collectBets(room); io.to(roomId).emit('roomUpdate', serializeRoom(room)); setTimeout(() => nextPhase(roomId), 1200); } 
    else {
        const seated = room.players.map((p, i) => (p && !p.isFolded && !p.waitingForNextHand && !p.isDisconnected) ? i : null).filter(x => x !== null);
        room.activeIdx = seated[(seated.indexOf(room.activeIdx) + 1) % seated.length];
        if (room.players[room.activeIdx].chips < 0.01) setTimeout(() => performAction(room.id, 'CALL', 0), 800); 
        else { startTurnTimer(room.id); io.to(room.id).emit('roomUpdate', serializeRoom(room)); triggerBotTurn(room.id); }
    }
};

const collectBets = (room) => { room.players.forEach(p => { if (p) { room.potData[0].amount = round(room.potData[0].amount + (p.currentBet || 0)); p.currentBet = 0; p.actedThisStreet = false; p.lastAction = null; } }); room.highestBet = 0; room.lastRaiseIncrement = Number(room.bb); };

const nextPhase = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    room.players.forEach(p => { if(p) p.lastAction = null; });
    const activeNonAllIn = room.players.filter(p => p && !p.isFolded && p.chips > 0.01 && !p.waitingForNextHand && !p.isDisconnected);
    const active = room.players.filter(p => p && !p.isFolded && !p.waitingForNextHand && !p.isDisconnected);
    if (active.length <= 1 || (activeNonAllIn.length <= 1 && room.phase !== PHASES.RIVER)) {
        if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = room.deck.splice(0, 3); }
        else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(...room.deck.splice(0, 1)); }
        else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(...room.deck.splice(0, 1)); }
        else { processShowdown(roomId); return; }
        updateRoomStrengths(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room)); setTimeout(() => nextPhase(roomId), 1500); return;
    }
    if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = room.deck.splice(0, 3); }
    else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(...room.deck.splice(0, 1)); }
    else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(...room.deck.splice(0, 1)); }
    else { processShowdown(roomId); return; }
    updateRoomStrengths(roomId);
    const seated = room.players.map((p, i) => (p && !p.isFolded && p.chips > 0.01 && !p.waitingForNextHand && !p.isDisconnected) ? i : null).filter(x => x !== null);
    room.activeIdx = seated.length > 0 ? seated[0] : -1;
    if (room.activeIdx !== -1) { startTurnTimer(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room)); triggerBotTurn(roomId); } else { setTimeout(() => nextPhase(roomId), 1500); }
};

const startTurnTimer = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    if (room.timer) clearInterval(room.timer);
    room.timeRemaining = 24;
    room.timer = setInterval(() => {
        room.timeRemaining--;
        if (room.timeRemaining <= 0) { clearInterval(room.timer); const p = room.players[room.activeIdx]; if (p) performAction(roomId, round(room.highestBet - (p.currentBet || 0)) > 0.01 ? 'FOLD' : 'CALL', 0); } 
        else { io.to(roomId).emit('roomUpdate', serializeRoom(room)); }
    }, 1000);
};

const runIgnition = (roomId) => {
  const room = rooms[roomId]; if (!room || room.gameInProgress) return;
  if (room.ignitionTimer) clearTimeout(room.ignitionTimer);
  room.ignitionTimer = null;
  const seated = room.players.map((p, i) => (p && p.chips > 0.01) ? i : null).filter(x => x !== null);
  if (seated.length < 2) { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', serializeRoom(room)); return; }
  room.gameInProgress = true;
  if (room.dealerIdx === undefined || !room.players[room.dealerIdx]) room.dealerIdx = seated[0];
  const dealerSeat = room.players[room.dealerIdx];
  if (dealerSeat.isBot) { const vIds = Object.keys(variantNames); dealerSeat.pendingVariant = vIds[Math.floor(Math.random() * vIds.length)]; }
  const variantId = dealerSeat.pendingVariant || 'HOLDEM';
  room.activeVariant = { id: variantId, name: variantNames[variantId], holeCards: holeCardsMap[variantId] };
  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; room.potData = [{ amount: 0 }]; room.highestBet = Number(room.bb); room.lastRaiseIncrement = Number(room.bb);
  room.phase = PHASES.PRE_FLOP;
  room.players.forEach(p => { if (p) { if (seated.includes(p.seatIdx)) { p.hand = room.deck.splice(0, room.activeVariant.holeCards); p.currentBet = 0; p.totalContribution = 0; p.isFolded = false; p.lastAction = null; p.actedThisStreet = false; p.winProbability = 0; p.lowWinProbability = 0; p.strength = "Pre-flop"; p.lowStrength = null; p.waitingForNextHand = false; } else { p.waitingForNextHand = true; p.hand = []; } } });
  const sbIdx = seated[(seated.indexOf(room.dealerIdx) + 1) % seated.length];
  const bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
  const sbAmt = round(Math.min(Number(room.sb), room.players[sbIdx].chips));
  room.players[sbIdx].chips = round(room.players[sbIdx].chips - sbAmt); room.players[sbIdx].currentBet = sbAmt; room.players[sbIdx].totalContribution = sbAmt;
  const bbAmt = round(Math.min(Number(room.bb), room.players[bbIdx].chips));
  room.players[bbIdx].chips = round(room.players[bbIdx].chips - bbAmt); room.players[bbIdx].currentBet = bbAmt; room.players[bbIdx].totalContribution = bbAmt;
  io.to(roomId).emit('log', { name: "SYSTEM", action: `${dealerSeat.name.toUpperCase()} DEALING ${room.activeVariant.name.toUpperCase()}`, type: 'phase' });
  updateRoomStrengths(roomId); room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length]; startTurnTimer(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room)); triggerBotTurn(roomId);
};

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => console.log(`${APP_NAME} ${VERSION} running on port ${PORT}`));
