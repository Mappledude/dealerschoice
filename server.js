import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const VERSION = "v2.0.6-PRO";
const APP_NAME = "Dealers Choice";

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const V_LABEL = { 1: 'Ace(Low)', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };

const TURN_TIME_LIMIT = 22; // INCREASED: from 15 to 22

const holeCardsMap = { HOLDEM: 2, OMAHA: 4, PINEAPPLE: 3, MUFLIS: 2, HILOW: 4, REDSBLACKS: 4 };
const variantNames = {
  HOLDEM: "Texas Hold'em", OMAHA: "Omaha", PINEAPPLE: "Pineapple",
  MUFLIS: "Muflis", HILOW: "Hi-Low Split", REDSBLACKS: "Reds & Blacks"
};

const BOT_NAMES = [
  "Doyle", "Stu", "Phil", "Johnny", "Vanessa", "Chris", "Annie", "Erik", "Daniel", 
  "Gus", "Tom", "Scotty", "Huck", "Jennifer", "Barry", "Justin", "Liv", "Maria", 
  "Antonio", "Vic", "Fedor", "Bryn", "Negreanu", "Ivey", "Hellmuth"
];

let profiles = []; 
let rooms = {};
const activeSessions = new Map();

const serializeRoom = (room) => {
    if (!room) return null;
    const { timer, deck, ignitionTimer, ...rest } = room;
    return rest;
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

const rankHand = (cards, isAceLow = false, isLowHand = false) => {
  if (!cards || cards.length < 5) return { power: 0, name: "Pre-flop", cards: cards || [] };
  const getVal = (v) => (isAceLow && v === 'A') ? 1 : VM[v];
  const sorted = [...cards].sort((a, b) => getVal(b.value) - getVal(a.value));
  const ranks = sorted.map(c => getVal(c.value));
  const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
  const groups = Object.entries(counts).map(([rank, count]) => ({ r: parseInt(rank), c: count })).sort((a, b) => b.c - a.c || b.r - a.r);
  let compArr = [];
  groups.forEach(g => { for (let i = 0; i < g.c; i++) compArr.push(g.r); });
  const vc = groups.map(x => x.c);
  
  const isFlush = isLowHand ? false : new Set(sorted.map(c => c.suit)).size === 1;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let isStraight = false;
  let straightHigh = 0;

  if (!isLowHand && uniqueRanks.length >= 5) {
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i] === uniqueRanks[i + 4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
    const wheelRanks = [14, 5, 4, 3, 2];
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
  const defaultHigh = { power: 0, name: "Uncontested", cards: hole || [] };
  if (!hole || hole.length === 0) return { high: defaultHigh, low: null };
  if (!comm || comm.length < 3) return { high: defaultHigh, low: null };
  
  let bestHigh = { power: -1, name: "Pre-flop", cards: hole };
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
            const resH = rankHand([...h, ...b], false, false);
            if (resH.power > bestHigh.power) bestHigh = resH;
            const resL = rankHand([...h, ...b], true, true);
            if (!bestLow || resL.power < bestLow.power) { 
                bestLow = { ...resL, name: resL.name.replace('High Card', 'Low') }; 
            }
    });});
  } else if (variantId === 'REDSBLACKS') {
      const reds = hole.filter(c => c.suit === '♥' || c.suit === '♦');
      const blacks = hole.filter(c => c.suit === '♣' || c.suit === '♠');
      let possibleJokerHands = [];
      if ((reds.length >= 2 && blacks.length >= 1) || (blacks.length >= 2 && reds.length >= 1)) {
          hole.forEach((fourthCard) => {
              boardCombos.forEach(b => { 
                  for (let v of VALUES) { 
                      for (let s of SUITS) {
                          const jokerCard = { value: v, suit: s, isJoker: true, id: 'joker-' + Math.random() };
                          const res = rankHand([jokerCard, fourthCard, ...b]);
                          possibleJokerHands.push({...res, name: `${res.name} (JOKER)`});
                      }
                  }
              });
          });
      }
      if (possibleJokerHands.length > 0) {
          possibleJokerHands.sort((a, b) => b.power - a.power);
          if (possibleJokerHands[0].power > bestHigh.power) bestHigh = possibleJokerHands[0];
      } else {
          holePairs.forEach(h => { boardCombos.forEach(b => {
                  const res = rankHand([...h, ...b]);
                  if (res.power > bestHigh.power) bestHigh = { ...res, name: `${res.name} (NATURAL)` };
          });});
      }
  } else if (variantId === 'MUFLIS') {
      combinations([...hole, ...comm], 5).forEach(c => {
          const res = rankHand(c, true); 
          if (bestHigh.power === -1 || res.power < bestHigh.power) bestHigh = res;
      });
  }
  if (!bestHigh.cards) bestHigh.cards = [];
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
            if (room.phase === PHASES.PRE_FLOP) {
                p.winProbability = 0; p.lowWinProbability = 0;
            } else {
                const rawProb = (p.strengthPower / (9 * Math.pow(15, 7))) * 100;
                p.winProbability = variantId === 'MUFLIS' ? Math.max(5, 100 - rawProb) : Math.min(99, Math.max(5, rawProb));
                if (evaluation.low) {
                    p.lowStrength = evaluation.low.name;
                    p.lowStrengthPower = evaluation.low.power;
                    const rawLowProb = 100 - ((p.lowStrengthPower / (Math.pow(15, 6) * 13)) * 100);
                    p.lowWinProbability = Math.min(100, Math.max(5, rawLowProb * 1.5));
                } else { p.lowWinProbability = 0; }
            }
        }
    });
};

const calculatePots = (room) => {
    const activePlayers = room.players.filter(p => p !== null && !p.waitingForNextHand);
    const contributions = activePlayers.map(p => ({ uid: p.uid, amount: p.totalContribution, folded: p.isFolded, name: p.name })).sort((a, b) => a.amount - b.amount);
    let lastLevel = 0; const pots = [];
    contributions.forEach((c, idx) => {
        const diff = c.amount - lastLevel;
        if (diff > 0) {
            let segAmount = 0; let eligible = [];
            contributions.slice(idx).forEach(other => { segAmount += diff; if (!other.folded) eligible.push(other.uid); });
            if (eligible.length > 0) pots.push({ amount: segAmount, eligibleUids: eligible, isMain: idx === 0 });
            else {
                const playerToRefund = room.players.find(p => p && p.uid === c.uid);
                if (playerToRefund) playerToRefund.chips += segAmount;
            }
            lastLevel = c.amount;
        }
    });
    return pots;
};

const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    room.activeIdx = -1; room.gameInProgress = false; if (room.timer) clearInterval(room.timer);
    const pots = calculatePots(room); room.pots = pots; 
    const variantId = room.activeVariant?.id || 'HOLDEM';
    let allShowdownWinners = [];
    pots.forEach((pot, potIdx) => {
        const eligiblePlayers = room.players.filter(p => p && pot.eligibleUids.includes(p.uid));
        const evals = eligiblePlayers.map(p => ({ player: p, res: getBestHand(p.hand, room.community, variantId) }));
        if (evals.length === 0) return;
        if (variantId === 'HILOW') {
            const lowHalf = Math.floor((pot.amount * 100) / 2) / 100;
            const highHalf = ((pot.amount * 100) - (lowHalf * 100)) / 100;
            const highSorted = [...evals].sort((a, b) => (b.res.high.power || 0) - (a.res.high.power || 0));
            highSorted.filter(e => e.res.high.power === highSorted[0].res.high.power).forEach(w => {
                const share = highHalf / highSorted.filter(e => e.res.high.power === highSorted[0].res.high.power).length;
                w.player.chips += share; allShowdownWinners.push({ name: w.player.name, uid: w.player.uid, rank: `HIGH: ${w.res.high.name}`, hand: w.res.high.cards || [], amount: share, potIdx });
            });
            const lowSorted = [...evals].sort((a, b) => (a.res.low?.power || 0) - (b.res.low?.power || 0));
            lowSorted.filter(e => e.res.low?.power === lowSorted[0].res.low?.power).forEach(w => {
                const share = lowHalf / lowSorted.filter(e => e.res.low?.power === lowSorted[0].res.low?.power).length;
                w.player.chips += share; allShowdownWinners.push({ name: w.player.name, uid: w.player.uid, rank: `LOW: ${w.res.low?.name || 'Low'}`, hand: w.res.low?.cards || [], amount: share, potIdx });
            });
        } else {
            evals.sort((a, b) => variantId === 'MUFLIS' ? (a.res.high.power - b.res.high.power) : (b.res.high.power - a.res.high.power));
            const winners = evals.filter(e => e.res.high.power === evals[0].res.high.power);
            winners.forEach(w => {
                const share = pot.amount / winners.length; w.player.chips += share;
                allShowdownWinners.push({ name: w.player.name, uid: w.player.uid, rank: w.res.high.name, hand: w.res.high.cards || [], amount: share, potIdx });
            });
        }
    });
    room.showdownWinners = allShowdownWinners;
    room.winning5Ids = [...new Set(allShowdownWinners.flatMap(w => (w.hand || []).map(c => c ? c.id : null).filter(id => id)))];
    room.phase = PHASES.SHOWDOWN; io.to(roomId).emit('roomUpdate', serializeRoom(room));
    const totalDuration = allShowdownWinners.length * 7000; // INCREASED: Match 7s per winner
    setTimeout(() => {
        room.players.forEach(p => { if (p) { p.waitingForNextHand = false; if (p.isBot && p.chips < Number(room.bb)) p.chips += 10; } });
        const seated = room.players.map((p, i) => (p && p.chips > Number(room.bb)) ? i : null).filter(x => x !== null);
        if (seated.length >= 2) {
            const curDealerIdx = seated.indexOf(room.dealerIdx);
            room.dealerIdx = seated[(curDealerIdx + 1) % seated.length];
            runIgnition(roomId);
        } else { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', serializeRoom(room)); }
    }, totalDuration + 2000);
};

const performAction = (roomId, type, amount) => {
    const room = rooms[roomId]; if (!room || room.activeIdx === -1) return;
    if (room.timer) clearInterval(room.timer);
    const player = room.players[room.activeIdx]; if (!player) { moveToNextPlayer(roomId); return; }
    player.actedThisStreet = true;
    if (type === 'FOLD') { player.isFolded = true; }
    else if (type === 'CALL') {
        let diff = room.highestBet - player.currentBet; const actualCall = Math.min(diff, player.chips);
        player.chips -= actualCall; player.currentBet += actualCall; player.totalContribution += actualCall;
    } else if (type === 'RAISE') {
        const diff = amount - player.currentBet;
        player.chips -= diff; player.currentBet = amount; player.totalContribution += diff;
        room.highestBet = amount; room.players.forEach(p => { if (p && p.uid !== player.uid) p.actedThisStreet = false; });
    }
    moveToNextPlayer(roomId);
};

const moveToNextPlayer = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    updateRoomStrengths(roomId);
    const active = room.players.filter(p => p && !p.isFolded && !p.waitingForNextHand);
    const allMatched = active.every(p => p.chips < 0.01 || p.currentBet === room.highestBet);
    const allActed = active.every(p => p.chips < 0.01 || p.actedThisStreet);
    if (active.length <= 1) { room.activeIdx = -1; collectBets(room); io.to(roomId).emit('roomUpdate', serializeRoom(room)); setTimeout(() => processShowdown(roomId), 1000); }
    else if (allMatched && allActed) { room.activeIdx = -1; collectBets(room); io.to(roomId).emit('roomUpdate', serializeRoom(room)); setTimeout(() => nextPhase(roomId), 1200); }
    else {
        const seated = room.players.map((p, i) => (p && !p.isFolded && !p.waitingForNextHand) ? i : null).filter(x => x !== null);
        room.activeIdx = seated[(seated.indexOf(room.activeIdx) + 1) % seated.length];
        if (room.players[room.activeIdx].chips < 0.01) setTimeout(() => performAction(room.id, 'CALL', 0), 800);
        else { startTurnTimer(room.id); io.to(room.id).emit('roomUpdate', serializeRoom(room)); triggerBotTurn(room.id); }
    }
};

const collectBets = (room) => {
    room.players.forEach(p => { if (p) { room.potData[0].amount += p.currentBet; p.currentBet = 0; p.actedThisStreet = false; } });
    room.highestBet = 0;
};

const nextPhase = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    const active = room.players.filter(p => p && !p.isFolded && !p.waitingForNextHand);
    if (active.length <= 1) { processShowdown(roomId); return; }
    if (room.phase === PHASES.PRE_FLOP) { room.phase = PHASES.FLOP; room.community = room.deck.splice(0, 3); }
    else if (room.phase === PHASES.FLOP) { room.phase = PHASES.TURN; room.community.push(...room.deck.splice(0, 1)); }
    else if (room.phase === PHASES.TURN) { room.phase = PHASES.RIVER; room.community.push(...room.deck.splice(0, 1)); }
    else { processShowdown(roomId); return; }
    updateRoomStrengths(roomId);
    const seated = room.players.map((p, i) => (p && !p.isFolded && p.chips > 0.01 && !p.waitingForNextHand) ? i : null).filter(x => x !== null);
    room.activeIdx = seated.length > 0 ? seated[0] : -1;
    if (room.activeIdx !== -1) { startTurnTimer(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room)); triggerBotTurn(roomId); }
    else { setTimeout(() => nextPhase(roomId), 1500); }
};

const triggerBotTurn = (roomId) => {
    const room = rooms[roomId]; if (!room || room.activeIdx === -1) return;
    const player = room.players[room.activeIdx]; if (!player || !player.isBot) return;
    setTimeout(() => {
        const currentRoom = rooms[roomId];
        if (!currentRoom || currentRoom.activeIdx === -1 || currentRoom.players[currentRoom.activeIdx]?.uid !== player.uid) return;
        performAction(roomId, 'CALL', 0);
    }, 1500);
};

const startTurnTimer = (roomId) => {
    const room = rooms[roomId]; if (!room) return;
    if (room.timer) clearInterval(room.timer);
    room.timeRemaining = TURN_TIME_LIMIT;
    room.timer = setInterval(() => {
        room.timeRemaining--;
        if (room.timeRemaining <= 0) {
            clearInterval(room.timer);
            const p = room.players[room.activeIdx];
            if (p) performAction(room.id, (room.highestBet - p.currentBet) > 0 ? 'FOLD' : 'CALL', 0);
        } else { io.to(roomId).emit('roomUpdate', serializeRoom(room)); }
    }, 1000);
};

const runIgnition = (roomId) => {
  const room = rooms[roomId]; if (!room || room.gameInProgress) return;
  const seated = room.players.map((p, i) => (p && p.chips > Number(room.bb)) ? i : null).filter(x => x !== null);
  if (seated.length < 2) { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', serializeRoom(room)); return; }
  room.gameInProgress = true;
  if (room.dealerIdx === undefined || !room.players[room.dealerIdx]) room.dealerIdx = seated[0];
  const dealerSeat = room.players[room.dealerIdx];
  const variantId = dealerSeat.isBot ? Object.keys(holeCardsMap)[Math.floor(Math.random()*6)] : (dealerSeat.pendingVariant || 'HOLDEM');
  room.activeVariant = { id: variantId, name: variantNames[variantId], holeCards: holeCardsMap[variantId] };
  room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
  room.community = []; room.potData = [{ amount: 0 }]; room.highestBet = Number(room.bb); room.phase = PHASES.PRE_FLOP;
  room.players.forEach(p => { if (p) { 
      if (seated.includes(p.seatIdx)) {
        p.hand = room.deck.splice(0, room.activeVariant.holeCards); p.currentBet = 0; p.totalContribution = 0; p.isFolded = false; p.actedThisStreet = false;
        p.strength = "Pre-flop"; p.waitingForNextHand = false;
      } else { p.waitingForNextHand = true; p.hand = []; }
  } });
  const bbIdx = seated[(seated.indexOf(room.dealerIdx) + 2) % seated.length];
  room.players[bbIdx].chips -= Number(room.bb); room.players[bbIdx].currentBet = Number(room.bb); room.players[bbIdx].totalContribution = Number(room.bb);
  updateRoomStrengths(roomId);
  room.activeIdx = seated[(seated.indexOf(bbIdx) + 1) % seated.length];
  startTurnTimer(roomId); io.to(roomId).emit('roomUpdate', serializeRoom(room));
};

const removePlayerGlobally = (uid) => {
    Object.values(rooms).forEach(room => {
        const idx = room.players.findIndex(p => p && p.uid === uid);
        if (idx !== -1) { room.players[idx] = null; io.to(room.id).emit('roomUpdate', serializeRoom(room)); }
    });
    activeSessions.delete(uid);
};

io.on('connection', (socket) => {
  let seatedUid = null;
  socket.on('playerLogin', ({ password }) => {
    const profile = profiles.find(p => p.password === password);
    if (profile) { seatedUid = profile.uid; socket.emit('loginSuccess', profile); }
  });
  socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
    const room = rooms[roomId]; if (!room) return callback({ status: 'error' });
    const emptyIdx = room.players.findIndex(p => p === null);
    if (emptyIdx === -1) return callback({ status: 'error' });
    room.players[emptyIdx] = { ...profile, chips: Number(buyIn), seatIdx: emptyIdx, currentBet: 0, totalContribution: 0, isFolded: false, waitingForNextHand: room.gameInProgress };
    socket.join(roomId); callback({ status: 'ok' });
    io.to(roomId).emit('roomUpdate', serializeRoom(room));
    if (room.phase === PHASES.IDLE && room.players.filter(p => p && p.chips > Number(room.bb)).length >= 2) runIgnition(roomId);
  });
  socket.on('playerAction', ({ roomId, type, amount }) => performAction(roomId, type, amount));
  socket.on('leaveRoom', ({ uid }) => removePlayerGlobally(uid));
  socket.on('disconnect', () => { if (seatedUid) removePlayerGlobally(seatedUid); });
  socket.on('updatePlayerSettings', ({ uid, pendingVariant }) => {
    const p = profiles.find(x => x.uid === uid); if (p) p.pendingVariant = pendingVariant;
  });
  socket.on('adminNuclearReset', () => { rooms = {}; profiles = profiles.filter(p => p.role === 'admin'); io.emit('lobbyUpdate', []); });
  socket.on('adminCreatePlayer', (p) => { profiles.push({ ...p, chips: Number(p.chips) }); io.emit('profilesUpdate', profiles); });
  socket.on('adminCreateRoom', (data) => { 
    rooms[data.id] = { ...data, players: Array(10).fill(null), phase: PHASES.IDLE, community: [], potData: [{amount:0}], dealerIdx: 0, timeRemaining: 22, gameInProgress: false }; 
    io.emit('lobbyUpdate', Object.values(rooms).map(serializeRoom)); 
  });
  socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms).map(serializeRoom) });
});

server.listen(process.env.PORT || 10000);
