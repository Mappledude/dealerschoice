// ... (imports and initial setup remain the same)

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
        const winnerIdx = activeIndices[0];
        const p = room.players[winnerIdx];
        if (p) {
            p.chips += totalPot; p.isWinner = true;
            room.showdownWinners.push({ name: p.name, rank: "Winner", hand: p.hand, amount: totalPot });
            io.to(roomId).emit('log', { name: p.name, action: `wins $${totalPot.toLocaleString()} (Opponents Folded)`, type: 'win' });
        }
    } else if (room.activeVariant?.id === 'HILOW') {
        // High Winner Calculation
        evals.sort((a, b) => b.res.power - a.res.power);
        const highWinners = evals.filter(e => e.res.power === evals[0].res.power);
        
        // Low Winner Calculation (Simplistic: literal lowest hand power)
        const sortedLow = [...evals].sort((a, b) => a.res.power - b.res.power);
        const lowWinners = sortedLow.filter(e => e.res.power === sortedLow[0].res.power);

        const highShare = Math.floor(totalPot / 2 / highWinners.length);
        const lowShare = Math.floor(totalPot / 2 / lowWinners.length);
        
        // Process High Winners
        highWinners.forEach(w => { 
            const p = room.players[w.i];
            p.chips += highShare; 
            p.isWinner = true; 
            room.showdownWinners.push({ name: p.name, rank: `HIGH: ${w.res.name}`, hand: w.res.cards, amount: highShare }); 
            room.hiLowAwards.high.push({ i: w.i, amount: highShare });
            io.to(roomId).emit('log', { name: p.name, action: `wins $${highShare.toLocaleString()} with HIGH ${w.res.name}`, type: 'win' });
        });

        // Process Low Winners
        lowWinners.forEach(w => { 
            const p = room.players[w.i];
            p.chips += lowShare; 
            p.isWinner = true; 
            room.showdownWinners.push({ name: p.name, rank: `LOW: ${w.res.name}`, hand: w.res.cards, amount: lowShare }); 
            room.hiLowAwards.low.push({ i: w.i, amount: lowShare });
            io.to(roomId).emit('log', { name: p.name, action: `wins $${lowShare.toLocaleString()} with LOW ${w.res.name}`, type: 'win' });
        });
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
            io.to(roomId).emit('log', { name: p.name, action: `wins $${share.toLocaleString()} with ${w.res.name}`, type: 'win' });
        });
    }

    io.to(roomId).emit('roomUpdate', room);
    saveToDisk();
    // ... (rest of function)
};
// ... (rest of server code)
