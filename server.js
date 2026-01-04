// server.js
// Dealer's Choice Poker Server (Socket.IO)
// Designed to match the event contract used by App.jsx in this chat.
//
// NOTE: This is a compact, pragmatic engine intended to "play" smoothly.
// It supports:
// - lobby + profiles + admin CRUD
// - rooms (tables) with stakes and buy-in
// - turn timer
// - actions: FOLD / CALL(CHECK) / RAISE
// - basic betting rounds + community cards + showdown (simple evaluator)
//
// If you already have a more sophisticated server, you can merge only the
// missing endpoints/events.

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 10000;
const ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
app.use(cors({ origin: ORIGIN }));
app.get("/", (_req, res) => res.send("Dealer's Choice server is running."));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ORIGIN, methods: ["GET", "POST"] },
});

const TOTAL_SEATS = 10;
const PHASES = {
  IDLE: "IDLE",
  PRE_FLOP: "PRE_FLOP",
  FLOP: "FLOP",
  TURN: "TURN",
  RIVER: "RIVER",
  SHOWDOWN: "SHOWDOWN",
};

const VARIANTS = {
  HOLDEM: { id: "HOLDEM", name: "Texas Hold'em" },
  OMAHA: { id: "OMAHA", name: "OMAHA" },
  PINEAPPLE: { id: "PINEAPPLE", name: "Pineapple" },
  MUFLIS: { id: "MUFLIS", name: "Muflis" },
  HILOW: { id: "HILOW", name: "Hi-Low Split" },
  REDSBLACKS: { id: "REDSBLACKS", name: "Reds & Blacks" },
};

function nowMs() {
  return Date.now();
}

function safeInt(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function newDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const values = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const deck = [];
  let id = 0;
  for (const s of suits) {
    for (const v of values) {
      deck.push({ id: `c_${id++}`, suit: s, value: v });
    }
  }
  return shuffle(deck);
}

// -------------------- Simple Hand Evaluator (Hold'em style) --------------------
// This is not a full perfect evaluator, but it's good enough for fun play.
// It ranks 5-card hands by category + kickers. We compute best 5 out of 7.
//
// Categories (high -> low):
// 8: Straight Flush
// 7: Four of a Kind
// 6: Full House
// 5: Flush
// 4: Straight
// 3: Trips
// 2: Two Pair
// 1: One Pair
// 0: High Card

const V2R = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const R2V = Object.fromEntries(Object.entries(V2R).map(([k, v]) => [v, k]));

function combos(arr, k) {
  const res = [];
  const n = arr.length;
  function rec(start, path) {
    if (path.length === k) { res.push(path.slice()); return; }
    for (let i = start; i <= n - (k - path.length); i++) {
      path.push(arr[i]);
      rec(i + 1, path);
      path.pop();
    }
  }
  rec(0, []);
  return res;
}

function isStraight(ranksDesc) {
  // ranksDesc: unique ranks, sorted desc
  const ranks = Array.from(new Set(ranksDesc));
  // Wheel A-5
  if (ranks.includes(14)) ranks.push(1);
  ranks.sort((a, b) => b - a);

  for (let i = 0; i <= ranks.length - 5; i++) {
    let ok = true;
    for (let j = 0; j < 4; j++) {
      if (ranks[i + j] - 1 !== ranks[i + j + 1]) { ok = false; break; }
    }
    if (ok) return ranks[i] === 1 ? 5 : ranks[i];
  }
  return null;
}

function eval5(cards) {
  const ranks = cards.map(c => V2R[c.value]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);

  const byCount = Array.from(counts.entries()).sort((a, b) => {
    // count desc, then rank desc
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const isFlush = suits.every(s => s === suits[0]);
  const straightHigh = isStraight(ranks);

  if (isFlush && straightHigh) {
    return { cat: 8, kick: [straightHigh], label: "Straight Flush" };
  }

  if (byCount[0][1] === 4) {
    const quad = byCount[0][0];
    const kicker = byCount.find(x => x[0] !== quad)[0];
    return { cat: 7, kick: [quad, kicker], label: "Four of a Kind" };
  }

  if (byCount[0][1] === 3 && byCount[1][1] === 2) {
    return { cat: 6, kick: [byCount[0][0], byCount[1][0]], label: "Full House" };
  }

  if (isFlush) {
    return { cat: 5, kick: ranks.slice(0, 5), label: "Flush" };
  }

  if (straightHigh) {
    return { cat: 4, kick: [straightHigh], label: "Straight" };
  }

  if (byCount[0][1] === 3) {
    const trips = byCount[0][0];
    const kickers = byCount.filter(x => x[1] === 1).map(x => x[0]).sort((a, b) => b - a);
    return { cat: 3, kick: [trips, ...kickers.slice(0, 2)], label: "Three of a Kind" };
  }

  if (byCount[0][1] === 2 && byCount[1][1] === 2) {
    const p1 = Math.max(byCount[0][0], byCount[1][0]);
    const p2 = Math.min(byCount[0][0], byCount[1][0]);
    const kicker = byCount.find(x => x[1] === 1)[0];
    return { cat: 2, kick: [p1, p2, kicker], label: "Two Pair" };
  }

  if (byCount[0][1] === 2) {
    const pair = byCount[0][0];
    const kickers = byCount.filter(x => x[1] === 1).map(x => x[0]).sort((a, b) => b - a);
    return { cat: 1, kick: [pair, ...kickers.slice(0, 3)], label: "One Pair" };
  }

  return { cat: 0, kick: ranks.slice(0, 5), label: "High Card" };
}

function better(a, b) {
  if (a.cat !== b.cat) return a.cat - b.cat;
  const la = a.kick.length;
  const lb = b.kick.length;
  const l = Math.max(la, lb);
  for (let i = 0; i < l; i++) {
    const ka = a.kick[i] || 0;
    const kb = b.kick[i] || 0;
    if (ka !== kb) return ka - kb;
  }
  return 0;
}

function bestOf7(cards7) {
  const c5 = combos(cards7, 5);
  let best = null;
  let bestHand = null;
  for (const h of c5) {
    const e = eval5(h);
    if (!best || better(e, best) > 0) {
      best = e;
      bestHand = h;
    }
  }
  return { eval: best, bestHand };
}

// -------------------- In-memory state --------------------
const profiles = new Map(); // uid -> {uid,name,password,chips,pendingVariant}
const rooms = new Map(); // id -> roomState
const sockets = new Map(); // socket.id -> { uid?, roomId? }

function defaultRoom(id, name, sb, bb, minBuy, maxBuy) {
  return {
    id,
    name,
    sb: safeInt(sb, 10),
    bb: safeInt(bb, 20),
    minBuy: safeInt(minBuy, 400),
    maxBuy: safeInt(maxBuy, 2000),
    players: Array(TOTAL_SEATS).fill(null), // seat objects
    potData: [{ amount: 0 }],
    community: [],
    deck: [],
    phase: PHASES.IDLE,
    activeVariant: VARIANTS.HOLDEM,
    dealerIdx: -1,
    activeIdx: -1,
    highestBet: 0,
    actionsSinceRaise: 0,
    lastAggressorIdx: -1,
    timeRemaining: 30,
    turnTimerSeconds: 30,
    timer: null,
    handNo: 0,
    winning5Ids: [],
    showdownWinners: null,
    hiLowAwards: null,
  };
}

function seedDemo() {
  if (rooms.size === 0) {
    const r1 = defaultRoom("room_demo", "MAIN ARENA", 25, 50, 500, 5000);
    rooms.set(r1.id, r1);
  }
}
seedDemo();

function emitLobby() {
  const list = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    sb: r.sb,
    bb: r.bb,
    minBuy: r.minBuy,
    maxBuy: r.maxBuy,
    players: r.players,
  }));
  io.emit("lobbyUpdate", list);
}

function emitProfiles() {
  io.emit("profilesUpdate", Array.from(profiles.values()));
}

function emitRoom(room) {
  io.to(room.id).emit("roomUpdate", publicRoom(room));
}

function publicRoom(room) {
  return {
    id: room.id,
    name: room.name,
    sb: room.sb,
    bb: room.bb,
    minBuy: room.minBuy,
    maxBuy: room.maxBuy,
    players: room.players.map((p) => (p ? publicPlayer(p) : null)),
    potData: room.potData,
    community: room.community,
    phase: room.phase,
    activeVariant: room.activeVariant,
    dealerIdx: room.dealerIdx,
    activeIdx: room.activeIdx,
    highestBet: room.highestBet,
    winning5Ids: room.winning5Ids,
    timeRemaining: room.timeRemaining,
    turnTimerSeconds: room.turnTimerSeconds,
    showdownWinners: room.showdownWinners,
    hiLowAwards: room.hiLowAwards,
  };
}

function publicPlayer(p) {
  return {
    uid: p.uid,
    name: p.name,
    password: p.password,
    chips: p.chips,
    hand: p.hand,
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isDealer: p.isDealer,
    isWinner: p.isWinner,
    isBust: p.isBust,
    strength: p.strength,
    lastAction: p.lastAction,
    winProbability: p.winProbability, // optional, can be undefined
  };
}

function logEvent(room, type, name, action, extra = {}) {
  io.to(room.id).emit("log", { type, name, action, ...extra });
}

function seatCount(room) {
  return room.players.filter(Boolean).length;
}

function activePlayers(room) {
  return room.players
    .map((p, i) => (p ? { p, i } : null))
    .filter(Boolean)
    .filter(({ p }) => !p.isFolded && !p.isBust && p.chips >= 0);
}

function nextSeat(room, startIdx) {
  // next seat index with a non-bust, not folded player
  for (let step = 1; step <= TOTAL_SEATS; step++) {
    const idx = (startIdx + step) % TOTAL_SEATS;
    const p = room.players[idx];
    if (p && !p.isFolded && !p.isBust) return idx;
  }
  return -1;
}

function clearTimer(room) {
  if (room.timer) clearInterval(room.timer);
  room.timer = null;
}

function startTurnTimer(room) {
  clearTimer(room);
  room.timeRemaining = room.turnTimerSeconds || 30;

  room.timer = setInterval(() => {
    if (room.phase === PHASES.IDLE || room.phase === PHASES.SHOWDOWN) return;
    room.timeRemaining -= 1;
    if (room.timeRemaining <= 0) {
      // Auto action: CHECK if can, else CALL if affordable else FOLD
      const idx = room.activeIdx;
      const p = room.players[idx];
      if (p && !p.isFolded && !p.isBust) {
        const toCall = Math.max(0, room.highestBet - p.currentBet);
        if (toCall === 0) {
          applyAction(room, idx, "CALL", 0, true);
        } else if (p.chips >= toCall) {
          applyAction(room, idx, "CALL", 0, true);
        } else {
          applyAction(room, idx, "FOLD", 0, true);
        }
      }
    }
    emitRoom(room);
  }, 1000);
}

function resetForHand(room) {
  room.community = [];
  room.deck = newDeck();
  room.potData = [{ amount: 0 }];
  room.phase = PHASES.PRE_FLOP;
  room.highestBet = 0;
  room.actionsSinceRaise = 0;
  room.lastAggressorIdx = -1;
  room.winning5Ids = [];
  room.showdownWinners = null;
  room.hiLowAwards = null;

  // reset per player
  room.players.forEach((p, i) => {
    if (!p) return;
    p.hand = [];
    p.currentBet = 0;
    p.isFolded = false;
    p.isWinner = false;
    p.isDealer = false;
    p.lastAction = "";
    p.strength = "";
    p.winProbability = undefined;
    p.isBust = p.chips <= 0;
  });

  // move dealer
  const seated = room.players.map((p, i) => (p && !p.isBust ? i : null)).filter((x) => x !== null);
  if (seated.length < 2) {
    room.phase = PHASES.IDLE;
    room.activeIdx = -1;
    clearTimer(room);
    return false;
  }
  if (room.dealerIdx === -1 || !room.players[room.dealerIdx] || room.players[room.dealerIdx].isBust) {
    room.dealerIdx = seated[0];
  } else {
    // next seated player
    room.dealerIdx = nextSeat(room, room.dealerIdx);
  }
  room.players[room.dealerIdx].isDealer = true;

  // select activeVariant for this hand = dealer's pendingVariant if available
  const dealer = room.players[room.dealerIdx];
  const pv = (dealer && dealer.pendingVariant) || "HOLDEM";
  room.activeVariant = VARIANTS[pv] || VARIANTS.HOLDEM;
  logEvent(room, "variant", "Dealer", `dealt: ${room.activeVariant.name}`);

  // blinds: SB = next from dealer, BB = next from SB
  const sbIdx = nextSeat(room, room.dealerIdx);
  const bbIdx = nextSeat(room, sbIdx);

  // post blinds
  postBlind(room, sbIdx, room.sb);
  postBlind(room, bbIdx, room.bb);
  room.highestBet = room.bb;
  room.lastAggressorIdx = bbIdx;
  room.actionsSinceRaise = 0;

  // deal hole cards
  dealHole(room);

  // deal community later
  room.activeIdx = nextSeat(room, bbIdx); // first to act preflop (UTG)
  startTurnTimer(room);
  return true;
}

function postBlind(room, idx, amt) {
  const p = room.players[idx];
  if (!p || p.isBust) return;
  const a = Math.min(p.chips, amt);
  p.chips -= a;
  p.currentBet += a;
  p.lastAction = "RAISE";
  logEvent(room, "bet", p.name, `posts ${a}`);
  if (p.chips <= 0) p.isBust = true;
}

function dealHole(room) {
  const variant = room.activeVariant?.id || "HOLDEM";
  const count = variant === "HOLDEM" ? 2 : variant === "PINEAPPLE" ? 3 : 4;

  for (let c = 0; c < count; c++) {
    for (let i = 0; i < TOTAL_SEATS; i++) {
      const p = room.players[i];
      if (!p || p.isBust) continue;
      p.hand.push(room.deck.pop());
    }
  }
}

function burn(room) {
  room.deck.pop();
}

function dealFlop(room) {
  burn(room);
  room.community.push(room.deck.pop(), room.deck.pop(), room.deck.pop());
}

function dealTurn(room) {
  burn(room);
  room.community.push(room.deck.pop());
}

function dealRiver(room) {
  burn(room);
  room.community.push(room.deck.pop());
}

function moveBetsToPot(room) {
  let moved = 0;
  room.players.forEach((p) => {
    if (!p) return;
    moved += p.currentBet || 0;
    p.currentBet = 0;
    p.lastAction = "";
  });
  room.potData[0].amount = safeInt(room.potData[0].amount) + moved;
  room.highestBet = 0;
  room.actionsSinceRaise = 0;
  room.lastAggressorIdx = -1;
}

function bettingRoundComplete(room) {
  const act = activePlayers(room);
  if (act.length <= 1) return true;
  const allEqual = act.every(({ p }) => (p.currentBet || 0) === room.highestBet);
  if (!allEqual) return false;
  // if no one has raised since round began, complete after everyone has acted once.
  // we approximate using actionsSinceRaise reaching act.length-1 after last raise.
  return room.actionsSinceRaise >= act.length - 1;
}

function maybeAdvancePhase(room) {
  const act = activePlayers(room);
  if (act.length === 1) {
    // everyone folded -> award pot
    const winnerIdx = act[0].i;
    awardPot(room, [{ i: winnerIdx }], "All fold");
    return;
  }

  if (!bettingRoundComplete(room)) return;

  moveBetsToPot(room);

  if (room.phase === PHASES.PRE_FLOP) {
    room.phase = PHASES.FLOP;
    dealFlop(room);
    logEvent(room, "phase", "Board", "Flop");
  } else if (room.phase === PHASES.FLOP) {
    room.phase = PHASES.TURN;
    dealTurn(room);
    logEvent(room, "phase", "Board", "Turn");
  } else if (room.phase === PHASES.TURN) {
    room.phase = PHASES.RIVER;
    dealRiver(room);
    logEvent(room, "phase", "Board", "River");
  } else if (room.phase === PHASES.RIVER) {
    room.phase = PHASES.SHOWDOWN;
    runShowdown(room);
    return;
  }

  // start next betting round: first active seat left of dealer
  room.activeIdx = nextSeat(room, room.dealerIdx);
  room.timeRemaining = room.turnTimerSeconds;
  room.actionsSinceRaise = 0;
  room.lastAggressorIdx = -1;
  startTurnTimer(room);
}

function applyAction(room, idx, type, amount, isAuto = false) {
  if (room.phase === PHASES.IDLE || room.phase === PHASES.SHOWDOWN) return;
  if (idx !== room.activeIdx) return;

  const p = room.players[idx];
  if (!p || p.isFolded || p.isBust) return;

  const bb = safeInt(room.bb, 20);

  if (type === "FOLD") {
    p.isFolded = true;
    p.lastAction = "FOLD";
    logEvent(room, "fold", p.name, isAuto ? "auto-fold" : "fold");
  }

  if (type === "CALL") {
    const toCall = Math.max(0, room.highestBet - p.currentBet);
    const pay = Math.min(p.chips, toCall);
    p.chips -= pay;
    p.currentBet += pay;
    p.lastAction = toCall === 0 ? "CALL" : "CALL";
    logEvent(room, "bet", p.name, toCall === 0 ? (isAuto ? "auto-check" : "check") : `call ${pay}`);
    if (p.chips <= 0) p.isBust = true;
    room.actionsSinceRaise += 1;
  }

  if (type === "RAISE") {
    let target = safeInt(amount, 0);
    // Minimum raise: >= highestBet + bb (simple)
    const minRaise = room.highestBet + bb;
    if (target < minRaise) target = minRaise;

    // can't raise beyond stack + currentBet
    const maxTarget = p.currentBet + p.chips;
    target = Math.min(target, maxTarget);

    const add = Math.max(0, target - p.currentBet);
    p.chips -= add;
    p.currentBet += add;
    room.highestBet = Math.max(room.highestBet, p.currentBet);
    room.lastAggressorIdx = idx;
    room.actionsSinceRaise = 0;
    p.lastAction = "RAISE";
    logEvent(room, "bet", p.name, `raise to ${p.currentBet}`);
    if (p.chips <= 0) p.isBust = true;
  }

  // advance activeIdx
  const next = nextSeat(room, idx);
  room.activeIdx = next;
  room.timeRemaining = room.turnTimerSeconds;

  // if next is -1, end (shouldn't happen)
  maybeAdvancePhase(room);
}

function rankLabel(cat) {
  switch (cat) {
    case 8: return "Straight Flush";
    case 7: return "Four of a Kind";
    case 6: return "Full House";
    case 5: return "Flush";
    case 4: return "Straight";
    case 3: return "Trips";
    case 2: return "Two Pair";
    case 1: return "Pair";
    default: return "High Card";
  }
}

function runShowdown(room) {
  clearTimer(room);

  // Move any remaining bets
  moveBetsToPot(room);

  const act = activePlayers(room);
  if (act.length === 1) {
    awardPot(room, act, "All fold");
    return;
  }

  // Evaluate best of 7 (2 hole + 5 board) for all variants (fun mode).
  const results = act.map(({ p, i }) => {
    // If player has >2 hole cards (Omaha/Pineapple/etc), we still evaluate bestOf7
    // using all hole cards + board (not strict rules). Keeps game flowing.
    const cards = [...(p.hand || []), ...(room.community || [])];
    const { eval: e, bestHand } = bestOf7(cards.slice(0, 7));
    return { i, uid: p.uid, name: p.name, e, bestHand };
  });

  results.sort((a, b) => better(a.e, b.e));
  const best = results[results.length - 1];
  const winners = results.filter(r => better(r.e, best.e) === 0);

  // split pot among winners
  awardPot(room, winners, rankLabel(best.e.cat), best.bestHand, best.e.label);
}

function awardPot(room, winners, rank, bestHand = null, label = "") {
  const pot = safeInt(room.potData?.[0]?.amount, 0);

  const share = winners.length > 0 ? Math.floor(pot / winners.length) : pot;
  const remainder = winners.length > 0 ? pot - share * winners.length : 0;

  winners.forEach((w, idx) => {
    const p = room.players[w.i];
    if (!p) return;
    const add = share + (idx === 0 ? remainder : 0);
    p.chips += add;
    p.isWinner = true;
    p.strength = rank;
    p.lastAction = "";
    logEvent(room, "win", p.name, `wins ${add} (${rank})`, { cards: bestHand || p.hand || [] });
  });

  // Mark winning5Ids if bestHand provided
  room.winning5Ids = (bestHand || []).map(c => c.id);

  room.showdownWinners = winners.map((w, idx) => {
    const p = room.players[w.i];
    return {
      name: p?.name || "Winner",
      amount: share + (idx === 0 ? remainder : 0),
      rank: rank,
      hand: bestHand || p?.hand || [],
    };
  });

  room.potData[0].amount = 0;

  // After a brief showcase, start next hand (or go IDLE if <2 players)
  emitRoom(room);
  setTimeout(() => {
    // bust flags
    room.players.forEach(p => { if (p) p.isBust = p.chips <= 0; });
    const ok = resetForHand(room);
    if (!ok) {
      emitRoom(room);
      emitLobby();
      return;
    }
    emitRoom(room);
    emitLobby();
  }, 5000);
}

// -------------------- IO handlers --------------------
io.on("connection", (socket) => {
  sockets.set(socket.id, {});

  // Basic initial push
  socket.emit("initialDataResponse", {
    profiles: Array.from(profiles.values()),
    rooms: Array.from(rooms.values()).map((r) => ({
      id: r.id, name: r.name, sb: r.sb, bb: r.bb, minBuy: r.minBuy, maxBuy: r.maxBuy, players: r.players,
    })),
  });

  socket.on("getInitialData", () => {
    socket.emit("initialDataResponse", {
      profiles: Array.from(profiles.values()),
      rooms: Array.from(rooms.values()).map((r) => ({
        id: r.id, name: r.name, sb: r.sb, bb: r.bb, minBuy: r.minBuy, maxBuy: r.maxBuy, players: r.players,
      })),
    });
    emitLobby();
    emitProfiles();
  });

  socket.on("playerLogin", ({ password }) => {
    const p = Array.from(profiles.values()).find((x) => x.password === String(password || ""));
    if (!p) return;
    sockets.get(socket.id).uid = p.uid;
    socket.emit("loginSuccess", p);
  });

  socket.on("updatePlayerSettings", ({ uid, pendingVariant }) => {
    const p = profiles.get(uid);
    if (!p) return;
    p.pendingVariant = pendingVariant || "HOLDEM";
    emitProfiles();
  });

  socket.on("joinRoom", ({ roomId, profile, buyIn }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ status: "err", message: "No such room" });

    const uid = profile?.uid || sockets.get(socket.id).uid;
    const stored = uid ? profiles.get(uid) : null;
    const playerProfile = stored || profile;

    if (!playerProfile?.uid) return cb?.({ status: "err", message: "No profile" });

    // seat
    const seatIdx = room.players.findIndex((x) => x === null);
    if (seatIdx === -1) return cb?.({ status: "err", message: "Table full" });

    const bi = Math.max(room.minBuy, Math.min(room.maxBuy, safeInt(buyIn, room.minBuy)));
    if ((playerProfile.chips || 0) < bi) return cb?.({ status: "err", message: "Not enough chips" });

    // deduct from wallet
    playerProfile.chips -= bi;

    const seated = {
      uid: playerProfile.uid,
      name: playerProfile.name,
      password: playerProfile.password,
      chips: bi,
      pendingVariant: playerProfile.pendingVariant || "HOLDEM",
      hand: [],
      currentBet: 0,
      isFolded: false,
      isDealer: false,
      isWinner: false,
      isBust: false,
      strength: "",
      lastAction: "",
      winProbability: undefined,
    };
    room.players[seatIdx] = seated;

    // persist profile changes
    profiles.set(playerProfile.uid, playerProfile);

    sockets.get(socket.id).roomId = roomId;
    socket.join(roomId);

    cb?.({ status: "ok", seatIdx });

    emitLobby();
    emitProfiles();
    emitRoom(room);

    // Start if table idle and has >=2
    if (room.phase === PHASES.IDLE && seatCount(room) >= 2) {
      room.handNo += 1;
      const ok = resetForHand(room);
      if (ok) {
        emitRoom(room);
        emitLobby();
      }
    }
  });

  socket.on("playerAction", ({ roomId, type, amount }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const uid = sockets.get(socket.id)?.uid;
    if (!uid) return;

    const idx = room.players.findIndex((p) => p?.uid === uid);
    if (idx === -1) return;

    // apply
    applyAction(room, idx, String(type || ""), safeInt(amount, 0), false);
    emitRoom(room);
    emitLobby();
  });

  // -------------------- Admin --------------------
  socket.on("adminCreatePlayer", (p) => {
    if (!p?.uid) return;
    profiles.set(p.uid, {
      uid: p.uid,
      name: String(p.name || "PLAYER").toUpperCase(),
      password: String(p.password || "").trim(),
      chips: safeInt(p.chips, 5000),
      pendingVariant: "HOLDEM",
    });
    emitProfiles();
    emitLobby();
  });

  socket.on("adminDeletePlayer", (uid) => {
    profiles.delete(uid);
    // remove from rooms
    rooms.forEach((room) => {
      const idx = room.players.findIndex((p) => p?.uid === uid);
      if (idx !== -1) room.players[idx] = null;
      emitRoom(room);
    });
    emitProfiles();
    emitLobby();
  });

  socket.on("adminEditChips", ({ uid, chips }) => {
    const p = profiles.get(uid);
    if (!p) return;
    p.chips = safeInt(chips, p.chips);
    profiles.set(uid, p);
    emitProfiles();
  });

  socket.on("adminAddChips", ({ roomId, uid, chips }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const idx = room.players.findIndex((p) => p?.uid === uid);
    if (idx === -1) return;
    room.players[idx].chips += safeInt(chips, 1000);
    room.players[idx].isBust = false;
    emitRoom(room);
  });

  socket.on("adminCreateRoom", (t) => {
    const id = String(t.id || `room_${Math.random().toString(36).slice(2, 9)}`);
    const room = defaultRoom(id, String(t.name || "ARENA"), t.sb, t.bb, t.minBuy, t.maxBuy);
    room.turnTimerSeconds = safeInt(t.turnTimerSeconds, 30) || 30;
    rooms.set(room.id, room);
    emitLobby();
  });

  socket.on("adminDeleteRoom", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    clearTimer(room);
    rooms.delete(roomId);
    emitLobby();
  });

  socket.on("adminAddBot", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const seatIdx = room.players.findIndex((x) => x === null);
    if (seatIdx === -1) return;

    const botUid = `bot_${Math.random().toString(36).slice(2, 9)}`;
    const bot = {
      uid: botUid,
      name: `BOT_${seatIdx + 1}`,
      password: "",
      chips: Math.max(room.minBuy, 1000),
      pendingVariant: "HOLDEM",
      hand: [],
      currentBet: 0,
      isFolded: false,
      isDealer: false,
      isWinner: false,
      isBust: false,
      strength: "",
      lastAction: "",
      winProbability: undefined,
      isBot: true,
    };
    room.players[seatIdx] = bot;

    emitRoom(room);
    emitLobby();

    if (room.phase === PHASES.IDLE && seatCount(room) >= 2) {
      resetForHand(room);
      emitRoom(room);
    }
  });

  socket.on("adminNuclearReset", () => {
    rooms.forEach((room) => {
      clearTimer(room);
      room.players = Array(TOTAL_SEATS).fill(null);
      room.phase = PHASES.IDLE;
      room.potData = [{ amount: 0 }];
      room.community = [];
      room.deck = [];
      room.highestBet = 0;
      room.activeIdx = -1;
      room.dealerIdx = -1;
      room.winning5Ids = [];
      room.showdownWinners = null;
      room.hiLowAwards = null;
      emitRoom(room);
    });
    emitLobby();
  });

  socket.on("disconnect", () => {
    const meta = sockets.get(socket.id);
    sockets.delete(socket.id);

    // We DO NOT auto-kick from table on disconnect, because users refresh a lot.
    // If you want auto-kick, implement a timeout + rejoin token.
    if (meta?.roomId) {
      const room = rooms.get(meta.roomId);
      if (room) emitRoom(room);
    }
  });
});

// -------------------- Bot actions (basic) --------------------
// If bots are seated, let them act when it's their turn.
setInterval(() => {
  rooms.forEach((room) => {
    if (room.phase === PHASES.IDLE || room.phase === PHASES.SHOWDOWN) return;
    const idx = room.activeIdx;
    const p = room.players[idx];
    if (!p || !p.isBot || p.isFolded || p.isBust) return;

    const toCall = Math.max(0, room.highestBet - p.currentBet);
    const r = Math.random();

    if (toCall === 0) {
      // sometimes bet small
      if (r < 0.25 && p.chips > room.bb * 2) {
        applyAction(room, idx, "RAISE", room.highestBet + room.bb, true);
      } else {
        applyAction(room, idx, "CALL", 0, true);
      }
    } else {
      if (r < 0.15) {
        applyAction(room, idx, "FOLD", 0, true);
      } else if (r < 0.30 && p.chips > toCall + room.bb) {
        applyAction(room, idx, "RAISE", room.highestBet + room.bb, true);
      } else {
        applyAction(room, idx, "CALL", 0, true);
      }
    }
    emitRoom(room);
    emitLobby();
  });
}, 900);

server.listen(PORT, () => {
  console.log(`Dealer's Choice server listening on :${PORT}`);
  emitLobby();
  emitProfiles();
});
