import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- VERSION & METADATA ---
const VERSION = "v0.1.3";
const APP_NAME = "Dealers Choice";

// --- CONSTANTS ---
const SUITS = ['♥', '♦', '♣', '♠'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VM = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, '10':10, 'J':11, 'Q':12, 'K':13, 'A':14 };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const BOT_NAMES = ["Ace_Bot", "River_Rat", "Sharky", "BluffMaster", "Foldy", "Annie_AllIn", "Checky", "GambleTron", "PokerFace", "Moneymaker"];

// --- STATE MANAGEMENT ---
let profiles = []; 
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

// --- HAND RANKING ENGINE ---
const rankHand = (cards) => {
    if (!cards || cards.length < 5) return { power: 0, name: "High Card", cards: [] };
    const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
    const ranks = sorted.map(c => VM[c.value]);
    const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
    const groups = Object.entries(counts).map(([r, c]) => ({ r: parseInt(r), c })).sort((a, b) => b.c - a.c || b.r - a.r);
    const vc = groups.map(x => x.c);
    const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
    const uniqueRanks = [...new Set(ranks)].sort((a,b) => b-a);
    let isStraight = false, straightHigh = 0;
    for(let i=0; i <= uniqueRanks.length - 5; i++) {
        if(uniqueRanks[i] === uniqueRanks[i+4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
    if(!isStraight && uniqueRanks.includes(14) && uniqueRanks.includes(5) && uniqueRanks.includes(4) && uniqueRanks.includes(3) && uniqueRanks.includes(2)) {
        isStraight = true; straightHigh = 5;
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

    const power = score * Math.pow(15, 7) + groups.reduce((acc, g, i) => acc + (g.r * Math.pow(15, 6 - i)), 0);
    return { power, name, cards: sorted.slice(0, 5) };
};

// --- CORE SOCKET LOGIC ---
io.on('connection', (socket) => {
    socket.on('getInitialData', () => {
        socket.emit('initialDataResponse', { profiles, rooms: Object.values(rooms) });
    });

    socket.on('playerLogin', ({ password }) => {
        let p = profiles.find(x => x.password === password);
        if (!p && password) {
            p = { uid: 'u_' + Math.random().toString(36).slice(2, 7), name: `Player_${password}`, password, chips: 5000, pendingVariant: 'HOLDEM' };
            profiles.push(p);
            io.emit('profilesUpdate', profiles);
        }
        if (p) socket.emit('loginSuccess', p);
    });

    socket.on('adminCreateRoom', (config) => {
        const roomId = config.id || 'room_' + Math.random().toString(36).slice(2, 7);
        rooms[roomId] = {
            ...config,
            id: roomId,
            players: Array(10).fill(null),
            community: [],
            potData: [{ amount: 0 }],
            phase: PHASES.IDLE,
            highestBet: 0,
            dealerIdx: 0,
            activeIdx: -1
        };
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('joinRoom', ({ roomId, profile, buyIn }, callback) => {
        const room = rooms[roomId];
        if (!room) return callback?.({ status: 'error' });
        const seat = room.players.findIndex(p => p === null);
        if (seat === -1) return callback?.({ status: 'full' });

        room.players[seat] = { ...profile, chips: buyIn, currentBet: 0, isFolded: false, seatIdx: seat };
        socket.join(roomId);
        io.to(roomId).emit('roomUpdate', room);
        callback?.({ status: 'ok' });
    });

    socket.on('adminAddBot', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        const seat = room.players.findIndex(p => p === null);
        if (seat === -1) return;

        const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + "_" + Math.floor(Math.random() * 99);
        const botId = 'bot_' + Math.random().toString(36).slice(2, 7);
        
        room.players[seat] = {
            uid: botId,
            name: botName,
            chips: 2000,
            currentBet: 0,
            isFolded: false,
            isBot: true,
            seatIdx: seat
        };

        io.to(roomId).emit('roomUpdate', room);
        io.to(roomId).emit('log', { name: "SYSTEM", action: `added bot ${botName}`, type: 'variant' });
    });

    socket.on('adminNuclearReset', () => {
        rooms = {};
        profiles = [];
        io.emit('lobbyUpdate', []);
        io.emit('profilesUpdate', []);
    });

    socket.on('adminDeleteRoom', (id) => {
        delete rooms[id];
        io.emit('lobbyUpdate', Object.values(rooms));
    });

    socket.on('adminCreatePlayer', (p) => {
        profiles.push({ ...p, chips: Number(p.chips) });
        io.emit('profilesUpdate', profiles);
    });

    socket.on('adminDeletePlayer', (uid) => {
        profiles = profiles.filter(x => x.uid !== uid);
        io.emit('profilesUpdate', profiles);
    });
});

server.listen(10000, () => {
    console.log(`${APP_NAME} ${VERSION} running on port 10000`);
});
