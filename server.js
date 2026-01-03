// --- RELEVANT PORTIONS FOR SERVER.JS ---

// 1. FIXED BET_OFFSETS (Syntax Fix)
const BET_OFFSETS = [
  { x: 0, y: -160 },   { x: 100, y: -110 }, { x: 130, y: 0 },    { x: 100, y: 110 },  { x: 60, y: 130 },    
  { x: 0, y: 150 },    { x: -60, y: 130 },  { x: -100, y: 110 }, { x: -130, y: 0 },   { x: -100, y: -110 } 
];

// 2. UPDATED runIgnition (Show Dealer Name in Feed)
const runIgnition = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    const seated = room.players.map((p, i) => (p && p.chips > 0) ? i : null).filter(x => x !== null);
    if (seated.length < 2) { room.phase = PHASES.IDLE; io.to(roomId).emit('roomUpdate', room); return; }
    
    if (!room.players[room.dealerIdx]) room.dealerIdx = seated[0];
    const dealer = room.players[room.dealerIdx];
    const vId = dealer.pendingVariant || 'HOLDEM';
    room.activeVariant = { id: vId, name: variantNames[vId], holeCards: holeCardsMap[vId] || 2 };
    
    // Changed "DEALER" to dealer.name
    io.to(roomId).emit('log', { name: dealer.name, action: `deals ${variantNames[vId]}`, type: 'variant' });

    room.deck = VALUES.flatMap(v => SUITS.map(s => ({ id: `${v}${s}-${Math.random()}`, value: v, suit: s }))).sort(() => Math.random() - 0.5);
    room.community = []; room.potData = [{ amount: 0 }]; room.highestBet = room.bb;

    // ... blinds logic ...
    
    updateStrengths(room);
    room.phase = PHASES.PRE_FLOP; 
    const bbPos = seated.indexOf(bbIdx);
    room.activeIdx = seated[(bbPos + 1) % seated.length];
    startShotClock(roomId);
    io.to(roomId).emit('roomUpdate', room);
};

// 3. UPDATED processShowdown (Include winning cards in log)
const processShowdown = (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    // ... evaluation logic ...
    
    winners.forEach(w => { 
        const p = room.players[w.i]; p.chips += share; p.isWinner = true; 
        room.winning5Ids = w.res.cards.map(c => c.id); 
        room.showdownWinners.push({ name: p.name, rank: w.res.name, hand: w.res.cards, amount: share }); 
        
        // Added cards property to log
        io.to(roomId).emit('log', { 
            name: p.name, 
            action: `wins $${share.toLocaleString()} with ${w.res.name}`, 
            type: 'win',
            cards: w.res.cards 
        });
    });
    // ... rest of shutdown ...
};

// 4. UPDATED getBestHand (Flexible Joker Wild Card)
const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0) return null;
    if (variantId === 'REDSBLACKS') {
        const isRed = (s) => s === '♥' || s === '♦';
        const reds = hole.filter(c => isRed(c.suit)).length;
        const blacks = hole.length - reds;
        const evals = [];

        if (reds > 0 && blacks > 0) {
            for (let i = 0; i < hole.length; i++) {
                const companion = hole[i];
                const others = hole.filter((_, idx) => idx !== i);
                const oReds = others.filter(c => isRed(c.suit)).length;
                if ((oReds === 2 && (3-oReds) === 1) || (oReds === 1 && (3-oReds) === 2)) {
                    // Valid Joker. The 3 joker cards act as a wild mimicking anything.
                    VALUES.forEach(v => {
                        const wild = { value: v, suit: companion.suit, id: 'wild' };
                        const pool = [companion, wild, ...comm];
                        combinations(pool, Math.min(pool.length, 5)).forEach(c => {
                            const padded = [...c];
                            while(padded.length < 5) padded.push({value: '2', suit: '♠', id: 'filler'});
                            evals.push(rankHand(padded));
                        });
                    });
                }
            }
        } else {
            // Same color: play best 2 from hole and 3 from board
            combinations(hole, 2).forEach(h => {
                combinations(comm, Math.min(comm.length, 3)).forEach(c => {
                    const pool = [...h, ...c];
                    const padded = [...pool];
                    while(padded.length < 5) padded.push({value: '2', suit: '♠', id: 'filler'});
                    evals.push(rankHand(padded));
                });
            });
        }
        return evals.length ? evals.sort((a,b) => b.power - a.power)[0] : { power: 0, name: "High Card", cards: [] };
    }
    // ... standard holdem logic ...
};
