// 1. UPDATED RANKHAND (Precision Kicker Weights)
const rankHand = (cards) => {
    if (!cards || cards.length < 5) return { power: 0, name: "High Card", cards: [] };
    
    const sorted = [...cards].sort((a, b) => VM[b.value] - VM[a.value]);
    const ranks = sorted.map(c => VM[c.value]);
    const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
    
    // Sort groups by size then by rank (e.g., [K,K,K, 2,2])
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

    // Weighted power ensures kickers break ties correctly (15^7 to 15^2)
    const power = score * Math.pow(15, 7) + compArr.reduce((acc, v, i) => acc + (v * Math.pow(15, 6 - i)), 0);
    return { power, name, cards: sorted.slice(0, 5) };
};

// 2. PERFECTED REDS & BLACKS JOKER LOGIC
const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0) return null;
    if (variantId === 'REDSBLACKS') {
        const isRed = (s) => s === '♥' || s === '♦';
        const reds = hole.filter(c => isRed(c.suit)).length;
        const blacks = hole.length - reds;
        const evals = [];

        // Joker Rule: mix of color exists (at least 1R and 1B among 4 cards)
        if (reds > 0 && blacks > 0) {
            // Test each card as the '4th card' that the Joker mimics
            for (let i = 0; i < hole.length; i++) {
                const base = hole[i];
                const others = hole.filter((_, idx) => idx !== i);
                const oReds = others.filter(c => isRed(c.suit)).length;
                if ((oReds === 2 && (3-oReds) === 1) || (oReds === 1 && (3-oReds) === 2)) {
                    // This is a valid joker combo. joker mimics anything to make the best hand with 'base'.
                    // We test every possible rank the Joker could take
                    VALUES.forEach(v => {
                        const wild = { value: v, suit: base.suit, id: 'wild' };
                        const pool = [base, wild, ...comm];
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
    // ... logic for other variants (Holdem, Omaha, etc.) ...
};
