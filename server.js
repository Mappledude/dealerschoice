// --- UPDATED RANKHAND (Positional Kicker Weighting) ---
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
    let isStraight = false, straightHigh = 0;

    for(let i=0; i <= uniqueRanks.length - 5; i++) {
        if(uniqueRanks[i] === uniqueRanks[i+4] + 4) { isStraight = true; straightHigh = uniqueRanks[i]; break; }
    }
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

    // FIXED: Precision power scale (15^7) ensures kicker-by-kicker comparison
    const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
    return { power, name, cards: sorted.slice(0, 5) };
};

// --- CORRECTED GETBESTHAND (Fixes Pre-flop & Joker logic) ---
const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0) return null;

    if (variantId === 'REDSBLACKS') {
        const isRed = (s) => s === '♥' || s === '♦';
        const reds = hole.filter(c => isRed(c.suit)).length;
        const blacks = hole.length - reds;
        const evals = [];

        // Joker Rule: mix of colors (at least 1R and 1B among 4 hole cards)
        if (reds > 0 && blacks > 0) {
            for (let i = 0; i < hole.length; i++) {
                const card4 = hole[i];
                const others = hole.filter((_, idx) => idx !== i);
                const oReds = others.filter(c => isRed(c.suit)).length;
                if ((oReds === 2 && (3-oReds) === 1) || (oReds === 1 && (3-oReds) === 2)) {
                    // Valid joker found. Mimics anything to make best hand with 'card4'.
                    // If pre-flop (no comm), best hand is at least a Pair of 'card4'.
                    if (comm.length === 0) {
                        const preFlopPower = 1 * Math.pow(15, 7) + VM[card4.value] * Math.pow(15, 6);
                        evals.push({ power: preFlopPower, name: `Pair of ${card4.value}s`, cards: [card4, card4] });
                    } else {
                        // Joker mimics card that completes the best 5-card combo using hole-card-4 and board
                        VALUES.forEach(v => {
                            const wild = { value: v, suit: card4.suit, id: 'wild' };
                            const pool = [card4, wild, ...comm];
                            combinations(pool, Math.min(pool.length, 5)).forEach(c => {
                                evals.push(rankHand(c));
                            });
                        });
                    }
                }
            }
        } else {
            // Same color: Play best 2 from hole and 3 from board
            if (comm.length === 0) {
                combinations(hole, 2).forEach(h => {
                    const v1 = VM[h[0].value], v2 = VM[h[1].value];
                    const p = (v1 === v2 ? 1 * Math.pow(15, 7) : 0) + Math.max(v1, v2) * Math.pow(15, 6);
                    evals.push({ power: p, name: v1 === v2 ? `Pair of ${h[0].value}s` : `High Card ${h[0].value}`, cards: h });
                });
            } else {
                combinations(hole, 2).forEach(h => {
                    combinations(comm, Math.min(comm.length, 3)).forEach(c => {
                        evals.push(rankHand([...h, ...c]));
                    });
                });
            }
        }
        return evals.length ? evals.sort((a,b) => b.power - a.power)[0] : { power: 0, name: "High Card", cards: [] };
    }

    // Default Hold'em/Pineapple: If pre-flop, strength is just based on hole pair/high-card
    if (comm.length === 0) {
        const sortedHole = [...hole].sort((a,b) => VM[b.value] - VM[a.value]);
        const counts = sortedHole.reduce((acc, c) => { acc[c.value] = (acc[c.value] || 0) + 1; return acc; }, {});
        const hasPair = Object.values(counts).some(v => v >= 2);
        const name = hasPair ? `Pair of ${sortedHole[0].value}s` : `High Card ${sortedHole[0].value}`;
        const p = (hasPair ? 1 * Math.pow(15, 7) : 0) + VM[sortedHole[0].value] * Math.pow(15, 6);
        return { power: p, name, cards: sortedHole };
    }

    const full = [...hole, ...comm];
    let best = null;
    combinations(full, Math.min(full.length, 5)).forEach(c => {
        const res = rankHand(c);
        if (!best || res.power > best.power) best = res;
    });
    return best;
};
