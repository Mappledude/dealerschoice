import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User
} from 'lucide-react';
import io from 'socket.io-client';

// --- SOCKET CONFIGURATION ---
// Priority order:
// 1) VITE_SOCKET_URL (set in Vercel/Netlify/Render env)
// 2) localhost during dev
// 3) Render production server
const SOCKET_URL =
  (import.meta?.env?.VITE_SOCKET_URL && String(import.meta.env.VITE_SOCKET_URL)) ||
  (typeof window !== 'undefined' && window.location?.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://poker-server-3vin.onrender.com');

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
});

// --- CONSTANTS & CONFIG ---
const TOTAL_SEATS = 10;
const LOCAL_USER_ID = 'human_player';

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2, rules: "Best 5 out of 7 cards" }, 
  OMAHA: { id: 'OMAHA', name: 'Omaha', holeCards: 4, rules: "Use EXACTLY 2 hand + 3 board cards!" }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3, rules: "3 hole cards dealt; discard 1 after flop." }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2, rules: "LOWEST ranked hand wins the pot!" } 
};

const PHASES = { 
  IDLE: 'IDLE', 
  PRE_FLOP: 'PRE_FLOP', 
  FLOP: 'FLOP', 
  TURN: 'TURN', 
  RIVER: 'RIVER', 
  SHOWDOWN: 'SHOWDOWN' 
};

const BLINDS = { sb: 20, bb: 40 }; 
const BOT_NAMES = ['Neon', 'Viper', 'Jinx', 'Cipher', 'Astra', 'Raven', 'Blaze', 'Frost', 'Shadow', 'Ghost'];

/**
 * FIXED COORDINATE GRID
 */
const SEAT_POSITIONS = [
  { x: 50, y: 96 }, // 0: Hero (Bottom Center)
  { x: 18, y: 82 }, // 1: Lower Corner Left
  { x: 5,  y: 50 }, // 2: Side Center Left
  { x: 8,  y: 22 }, // 3: Upper Corner Left
  { x: 28, y: 8  }, // 4: Top Shoulder Left
  { x: 50, y: 4  }, // 5: Top Center (Raven)
  { x: 72, y: 8  }, // 6: Top Shoulder Right
  { x: 92, y: 22 }, // 7: Upper Corner Right
  { x: 95, y: 50 }, // 8: Side Center Right
  { x: 82, y: 82 }  // 9: Lower Corner Right
];

const VALUE_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const SUITS = ['♠', '♣', '♥', '♦'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const INITIAL_PLAYERS = Array.from({ length: TOTAL_SEATS }, () => null);

// --- GLOBAL UTILITIES ---
const getCombinations = (arr, k) => {
  const getSubsets = (a, n) => {
    if (n === 0) return [[]];
    if (a.length === 0) return [];
    const first = a[0];
    const rest = a.slice(1);
    return [...getSubsets(rest, n - 1).map(s => [first, ...s]), ...getSubsets(rest, n)];
  };
  return getSubsets(arr, k);
};

const rankFiveCardHand = (cards) => {
  if (!cards || cards.length < 5) return { power: 0, hand: [], name: "Evaluating..." };
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const isFlush = new Set(suits).size === 1;
  let isStraight = true;
  for (let i = 0; i < 4; i++) if (ranks[i] !== ranks[i + 1] + 1) isStraight = false;
  if (!isStraight && JSON.stringify(ranks) === JSON.stringify([14, 5, 4, 3, 2])) isStraight = true;

  const counts = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const valCounts = Object.values(counts).sort((a, b) => b - a);
  const uniqueRanks = Object.keys(counts).map(Number).sort((a, b) => (counts[b] !== counts[a]) ? counts[b] - counts[a] : b - a);

  let score = 0, name = "High Card";
  const firstRank = uniqueRanks[0] || 0;
  if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
  else if (valCounts[0] === 4) { score = 7; name = "Four of a Kind"; }
  else if (valCounts[0] === 3 && valCounts[1] === 2) { score = 6; name = "Full House"; }
  else if (isFlush) { score = 5; name = "Flush"; }
  else if (isStraight) { score = 4; name = "Straight"; }
  else if (valCounts[0] === 3) { score = 3; name = "Three of a Kind"; }
  else if (valCounts[0] === 2 && valCounts[1] === 2) { score = 2; name = "Two Pair"; }
  else if (valCounts[0] === 2) { score = 1; name = "Pair"; }
  return { power: score * 1000000 + (firstRank * 1000) + (uniqueRanks[1] || 0), hand: cards, name };
};

const Seat = ({ 
  player, index, phase, dealStaggerIndex, winning5Ids, 
  isWinnerCalculated, potTransferring 
}) => {
  if (!player || player.userId === LOCAL_USER_ID) return null;
  const pos = SEAT_POSITIONS[index];
  const isShowdown = phase === PHASES.SHOWDOWN;
  const isWinner = player.isWinner;

  return (
    <div 
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }} 
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col-reverse items-center z-20 transition-all duration-1000 ease-out 
        ${player?.isFolded ? 'opacity-20 grayscale scale-95' : 'opacity-100'}`}
    >
      <div className={`flex items-center gap-2 p-[0.6vw] px-[2vw] rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl transition-all duration-300 relative 
        ${isWinner && isShowdown ? (potTransferring ? 'border-yellow-400 scale-125 shadow-[0_0_3vw_rgba(251,191,36,0.8)]' : 'border-yellow-400 scale-110 shadow-[0_0_2vw_rgba(251,191,36,0.6)]') : 'border-white/10'}`}>
        <div className="flex flex-col items-center">
            {player.isAllIn && !player.isFolded && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white animate-pulse">All-In</div>
            )}
            <div className="flex items-center gap-2">
                {player?.isDealer && <div className="w-[0.8vw] h-[0.8vw] bg-red-600 rounded-full shadow-[0_0_0.5vw_rgba(220,38,38,0.8)] animate-pulse" />}
                <span className="text-[1.1vw] font-black text-white leading-none uppercase tracking-widest whitespace-nowrap">{String(player?.name || "Player")}</span>
            </div>
            <span className={`text-[1.2vw] font-mono font-black mt-1.5 transition-all duration-500 ${isWinner && isShowdown ? 'text-emerald-400 animate-pulse' : 'text-emerald-500/80'}`}>${Number(player?.chips || 0)}</span>
        </div>
      </div>

      {player?.hand?.length > 0 && !player.isFolded && (
        <div className="flex flex-row items-end justify-center pointer-events-none mb-2 overflow-visible relative">
          {(player.hand || []).map((c, ci) => {
            const rotation = (ci - (player.hand.length - 1) / 2) * 5;
            const isWinningCard = (winning5Ids || []).includes(c.id);
            const shouldHighlight = isShowdown && isWinner && isWinningCard;

            return (
              <div key={ci} 
                className={`w-[2.5vw] h-[3.5vw] rounded-[0.4vw] flex flex-col items-start justify-start p-[0.2vw] transition-all duration-700 brightness-110 border border-white/40 shadow-lg relative
                ${isShowdown ? 'bg-gradient-to-br from-white via-white to-slate-50 text-slate-950' : 'bg-gradient-to-br from-slate-700 via-slate-900 to-black'} 
                ${dealStaggerIndex >= ci ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[-1vw]'} 
                ${shouldHighlight ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_#fbbf24] animate-pulse z-[100]' : 'opacity-100'}`} 
                style={{ 
                  transform: `rotate(${rotation}deg) scale(1.5)`, 
                  transformOrigin: 'bottom center', 
                  marginLeft: ci > 0 ? '-2.2vw' : '0', 
                  zIndex: shouldHighlight ? 200 : ci 
                }}
              >
                {isShowdown ? (
                   <div className="flex flex-col items-start leading-none h-full w-full pl-0.5 pt-0.5 relative">
                     <span className="text-[0.8vw] font-black text-slate-950 block mb-0.5 leading-none">{String(c.value)}</span>
                     <span className={`text-[1.2vw] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-950'}`}>{String(c.suit)}</span>
                   </div>
                 ) : ( 
                    <div className="w-full h-full flex items-center justify-center opacity-40 relative overflow-hidden">
                        <div className="absolute inset-0 m-0.5 border border-white/5 rounded-[0.2vw]" />
                        <ShieldCheck size={10} className="text-white/10" />
                    </div> 
                 )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const App = () => {
  // 1. STATE INITIALIZATION
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [potData, setPotData] = useState([{ label: 'MAIN', amount: 0, eligible: [] }]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [lastRaiseAmt, setLastRaiseAmt] = useState(BLINDS.bb);
  const [deck, setDeck] = useState([]);
  const [dealStaggerIndex, setDealStaggerIndex] = useState(-1);
  const [showSplash, setShowSplash] = useState(false);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [winningPlayerIndices, setWinningPlayerIndices] = useState([]); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [potTransferring, setPotTransferring] = useState(false);
  const [playerNameInput, setPlayerNameInput] = useState('');

  const hasProcessedShowdown = useRef(false);
  const timerRef = useRef(null);

  // 2. DERIVED STATE
  const isShowdown = phase === PHASES.SHOWDOWN;
  const isWinnerCalculated = winningPlayerIndices.length > 0;
  const heroSeatIdx = useMemo(() => players.findIndex(p => p?.userId === LOCAL_USER_ID), [players]);
  const userSeat = useMemo(() => players.find(p => p?.userId === LOCAL_USER_ID), [players]);

  const actualPotAmount = useMemo(() => (potData || []).reduce((acc, p) => acc + (p?.amount || 0), 0), [potData]);
  const currentPotOnTable = useMemo(() => actualPotAmount + (players || []).reduce((s, p) => s + (p?.currentBet || 0), 0), [actualPotAmount, players]);

  const seatedCount = players.filter(p => p && p.isSeated).length;
  const dealerIndex = players.findIndex(p => p?.isDealer);
  const isHeroTurn = activeIdx !== -1 && heroSeatIdx !== -1 && activeIdx === heroSeatIdx && phase !== PHASES.IDLE && !isShowdown;
  const minRaiseTo = highestBet + lastRaiseAmt;
  const maxAllIn = userSeat?.chips || 0;

  // 4. CORE ENGINE FUNCTIONS
  const addLog = useCallback((data) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logEntry = { 
        id: Date.now() + Math.random(), 
        time: String(timestamp), 
        name: data.name ? String(data.name) : "", 
        action: data.action ? String(data.action) : "", 
        amount: data.amount ? String(data.amount) : null, 
        type: data.type ? String(data.type) : 'info' 
    };
    setLogs(prev => [logEntry, ...prev].slice(0, 50));
  }, []);

  const getNextSeatedPlayer = useCallback((startIndex, currentPlayers = players) => {
    for (let i = 1; i <= TOTAL_SEATS; i++) {
      const idx = (startIndex + i) % TOTAL_SEATS;
      const p = currentPlayers[idx];
      if (p?.isSeated && !p?.isFolded && !p?.isAllIn && (p.chips > 0 || p.currentBet > 0 || p.userId === LOCAL_USER_ID)) return idx;
    }
    return -1;
  }, [players]);

  const evaluateBestHandSync = useCallback((hand, board, v) => {
    if (!hand || hand.length === 0 || board.length < 3) return { power: 0, hand: [], name: "Evaluating..." };
    if (v.id === 'OMAHA') {
        const hCombos = getCombinations(hand, 2);
        const bCombos = getCombinations(board, 3);
        let best = { power: -1, hand: [], name: "High Card" };
        hCombos.forEach(hc => bCombos.forEach(bc => {
            const r = rankFiveCardHand([...hc, ...bc]);
            if (r.power > best.power) { best = r; }
        }));
        return best;
    } else {
        const subsets = getCombinations([...hand, ...board], 5);
        let best = { power: -1, name: "High Card", hand: [] };
        subsets.forEach(c => { 
            const r = rankFiveCardHand(c); 
            if (r.power > best.power) { best = r; } 
        });
        return best;
    }
  }, []);

  const getCurrentStrength = useCallback((p) => {
    if (!p || p.isFolded || !p.hand || p.hand.length === 0) return "";
    if (phase === PHASES.SHOWDOWN && winningPlayerIndices.length > 0) {
       const winnerIndex = winningPlayerIndices[0];
       const winner = players[winnerIndex];
       if (winner) return `🏆 ${String(winner.name).toUpperCase()} WINS $${actualPotAmount}`;
    }
    const result = evaluateBestHandSync(p.hand, community, activeVariant);
    return String(activeVariant.id === 'MUFLIS' ? `MUFLIS: ${result.name}` : result.name);
  }, [community, activeVariant, evaluateBestHandSync, phase, winningPlayerIndices, players, actualPotAmount]);

  const rotateDealer = useCallback(() => {
    const dIdx = players.findIndex(p => p?.isDealer);
    const nextD = getNextSeatedPlayer(dIdx);
    setPlayers(prev => (prev || []).map((p, i) => {
        if (!p) return null;
        return { ...p, isDealer: i === nextD, isWinner: false, hand: [], currentBet: 0, acted: false, isFolded: false, handResult: null, isAllIn: false };
    }));
    setCommunity([]);
    setPotData([{ label: 'MAIN', amount: 0, eligible: [] }]);
    setPhase(PHASES.IDLE);
    setWinning5Ids([]);
    setWinningPlayerIndices([]);
    setPotTransferring(false);
    setIsAnimating(false);
  }, [players, getNextSeatedPlayer]);

  const handleAction = useCallback((type, amt = 0) => {
    const player = players[activeIdx];
    if (!player) return;
    let nextPlayers = [...players];
    let newHighestBet = highestBet;

    if (type === 'FOLD') { 
      nextPlayers[activeIdx].isFolded = true; 
      addLog({ name: String(player.name), action: "FOLDED" }); 
    }
    if (type === 'CALL' || type === 'CHECK') {
      const callVal = Math.min(player.chips, highestBet - player.currentBet);
      nextPlayers[activeIdx].currentBet += callVal; 
      nextPlayers[activeIdx].chips -= callVal;
      addLog({ name: String(player.name), action: callVal > 0 ? "CALLED" : "CHECKED", amount: callVal > 0 ? String(callVal) : null });
    }
    if (type === 'RAISE') {
      const additional = Math.min(player.chips, amt - player.currentBet);
      const actualTotal = player.currentBet + additional;
      setLastRaiseAmt(Math.max(actualTotal - highestBet, lastRaiseAmt));
      nextPlayers[activeIdx].chips -= additional; 
      nextPlayers[activeIdx].currentBet = actualTotal; 
      newHighestBet = actualTotal;
      setHighestBet(actualTotal);
      addLog({ name: String(player.name), action: "RAISED to", amount: String(actualTotal) });
    }

    if (nextPlayers[activeIdx].chips === 0 && !nextPlayers[activeIdx].isFolded) {
        nextPlayers[activeIdx].isAllIn = true;
        addLog({ name: nextPlayers[activeIdx].name, action: `IS ALL-IN FOR $${nextPlayers[activeIdx].currentBet}`, type: 'system' });
    }

    nextPlayers[activeIdx].acted = true;
    nextPlayers[activeIdx].totalContributed += player.currentBet;

    const totalActivePlayers = nextPlayers.filter(p => p && p.isSeated && !p.isFolded);
    const roundOver = totalActivePlayers.every(p => p.acted && (p.currentBet === newHighestBet || p.chips === 0 || p.isAllIn));

    setPlayers(nextPlayers);

    if (roundOver) {
        setTimeout(() => {
          const streetBets = nextPlayers.reduce((sum, p) => sum + (p?.currentBet || 0), 0);
          setPotData(prev => [{ ...prev[0], amount: prev[0].amount + streetBets }]);
          setPlayers(prev => prev.map(p => p ? { ...p, currentBet: 0, acted: false } : null));
          setHighestBet(0); 
          setLastRaiseAmt(BLINDS.bb);

          let nextPhase; 
          let nextDeck = [...deck];

          const chipsAvailable = nextPlayers.filter(p => p && p.isSeated && !p.isFolded && p.chips > 0).length;
          if (chipsAvailable <= 1 && phase !== PHASES.RIVER) {
             const boardNeeded = phase === PHASES.PRE_FLOP ? 5 : (phase === PHASES.FLOP ? 2 : 1);
             setCommunity(prev => [...prev, ...nextDeck.splice(0, boardNeeded)]);
             setPhase(PHASES.SHOWDOWN);
             return;
          }

          if (phase === PHASES.PRE_FLOP) { nextPhase = PHASES.FLOP; setCommunity(nextDeck.splice(0, 3)); }
          else if (phase === PHASES.FLOP) { nextPhase = PHASES.TURN; setCommunity(prev => [...prev, ...nextDeck.splice(0, 1)]); }
          else if (phase === PHASES.TURN) { nextPhase = PHASES.RIVER; setCommunity(prev => [...prev, ...nextDeck.splice(0, 1)]); }
          else { setPhase(PHASES.SHOWDOWN); return; }

          setPhase(nextPhase); 
          setDeck(nextDeck); 
          setActiveIdx(getNextSeatedPlayer(dealerIndex, nextPlayers));
        }, 800);
    } else { 
        setActiveIdx(getNextSeatedPlayer(activeIdx, nextPlayers)); 
    }
  }, [activeIdx, phase, highestBet, deck, community, players, getNextSeatedPlayer, dealerIndex, addLog, lastRaiseAmt]);

  const handleDeal = useCallback(() => {
    if (seatedCount < 2 || isAnimating) return;
    hasProcessedShowdown.current = false;
    setCommunity([]);
    setLastRaiseAmt(BLINDS.bb);
    setDealStaggerIndex(-1);
    setWinning5Ids([]);
    setWinningPlayerIndices([]);
    setPotTransferring(false);
    setIsAnimating(false);

    let dIdx = players.findIndex(p => p && p.isDealer && p.isSeated);
    if (dIdx === -1) { dIdx = players.findIndex(p => p && p.isSeated); setPlayers(prev => prev.map((p, i) => i === dIdx ? { ...p, isDealer: true } : { ...p, isDealer: false })); }

    const dealer = players[dIdx];
    const variantKeys = Object.keys(VARIANTS);
    const chosenVariantId = pendingVariantId || variantKeys[Math.floor(Math.random() * variantKeys.length)];
    const variantChoice = VARIANTS[chosenVariantId];

    addLog({ name: dealer?.name || "DEALER", action: `HAS CHOSEN ${variantChoice.name.toUpperCase()}`, type: 'system' });

    setActiveVariant(variantChoice);
    setShowSplash(true);
    setTimeout(() => {
        const fullDeck = SUITS.flatMap(s => VALUES.map(v => ({suit: s, value: v, rank: VALUE_MAP[v], id: v+s}))).sort(() => Math.random() - 0.5);
        let nextPlayers = players.map(p => p ? { ...p, hand: [], currentBet: 0, totalContributed: 0, isFolded: false, acted: false, isWinner: false, handResult: null, isAllIn: false } : p);
        let sbIdx = getNextSeatedPlayer(dIdx, nextPlayers);
        let bbIdx = getNextSeatedPlayer(sbIdx, nextPlayers);
        let utgIdx = getNextSeatedPlayer(bbIdx, nextPlayers);

        nextPlayers[sbIdx].chips -= BLINDS.sb; 
        nextPlayers[sbIdx].currentBet = BLINDS.sb;
        nextPlayers[bbIdx].chips -= BLINDS.bb; 
        nextPlayers[bbIdx].currentBet = BLINDS.bb;

        setPotData([{ label: 'MAIN', amount: 0, eligible: [] }]); 

        nextPlayers.forEach(p => { if(p) p.hand = fullDeck.splice(0, variantChoice.holeCards); });
        setPlayers(nextPlayers);
        setDeck(fullDeck); setHighestBet(BLINDS.bb); setPhase(PHASES.PRE_FLOP); setShowSplash(false); setActiveIdx(utgIdx);
        for(let i=0; i<variantChoice.holeCards; i++) setTimeout(() => setDealStaggerIndex(i), i * 200);
    }, 2000);
  }, [players, seatedCount, getNextSeatedPlayer, pendingVariantId, isAnimating, addLog]);

  useEffect(() => { 
    const onConnect = () => addLog({ name: 'SOCKET', action: `CONNECTED (${socket.id || 'ok'})`, type: 'system' });
    const onDisconnect = (reason) => addLog({ name: 'SOCKET', action: `DISCONNECTED (${String(reason)})`, type: 'system' });
    const onConnectError = (err) => addLog({ name: 'SOCKET', action: `CONNECT ERROR (${String(err?.message || err)})`, type: 'system' });
    const onLog = (data) => addLog(data);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('log', onLog);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('log', onLog);
    };
  }, [addLog]);

  useEffect(() => { if (phase === PHASES.IDLE && seatedCount >= 2 && !isAnimating) { const dealDelay = setTimeout(() => handleDeal(), 1000); return () => clearTimeout(dealDelay); } }, [phase, seatedCount, handleDeal, isAnimating]);

  useEffect(() => {
    if (isShowdown && !hasProcessedShowdown.current) {
      hasProcessedShowdown.current = true;
      setIsAnimating(true);
      const isMuflis = activeVariant.id === 'MUFLIS';
      const evaluated = players.map(p => (!p || !p.isSeated || p.isFolded) ? p : { ...p, handResult: evaluateBestHandSync(p.hand, community, activeVariant) });

      const winnersList = evaluated
        .filter(p => p && !p.isFolded && p.isSeated)
        .sort((a,b) => isMuflis ? a.handResult.power - b.handResult.power : b.handResult.power - a.handResult.power);

      if (winnersList.length > 0) {
          const topPower = winnersList[0].handResult.power;
          const tiedWinners = winnersList.filter(w => w.handResult.power === topPower);
          const winIndices = tiedWinners.map(w => players.findIndex(p => p?.userId === w.userId));
          setWinning5Ids(tiedWinners[0].handResult.hand.map(c => c.id)); 
          setWinningPlayerIndices(winIndices);
          const share = Math.floor(actualPotAmount / tiedWinners.length);

          setTimeout(() => {
              const ann = tiedWinners.length === 1 
                ? `${tiedWinners[0].name.toUpperCase()} WINS $${actualPotAmount} WITH A ${tiedWinners[0].handResult.name.toUpperCase()}`
                : `${tiedWinners.map(w => w.name.toUpperCase()).join(' & ')} SPLIT $${actualPotAmount} WITH A ${tiedWinners[0].handResult.name.toUpperCase()}`;

              addLog({ action: ann, type: 'win' });
              setPotTransferring(true); 
              setTimeout(() => {
                setPlayers(prev => prev.map((p, i) => winIndices.includes(i) ? { ...p, chips: p.chips + share, isWinner: true, handResult: evaluated[i].handResult } : p));
                setTimeout(() => { setIsAnimating(false); rotateDealer(); }, 1200);
              }, 800);
          }, 2000); 
      }
    }
  }, [isShowdown, actualPotAmount, players, community, rotateDealer, addLog, evaluateBestHandSync, activeVariant]);

  // SMART BOT AI
  useEffect(() => { 
    if (activeIdx !== -1 && players[activeIdx]?.isBot && phase !== PHASES.IDLE && !isShowdown) {
      const botId = players[activeIdx].userId;
      const botHand = evaluateBestHandSync(players[activeIdx].hand, community, activeVariant);
      const isMuflis = activeVariant.id === 'MUFLIS';
      const delay = Math.random() * 2000 + 1500; 

      let strength = isMuflis ? (1 - (botHand.power / 9000000)) : (botHand.power / 9000000);

      timerRef.current = setTimeout(() => {
        const currentBot = players.find(p => p?.userId === botId);
        if (!currentBot || currentBot.isFolded || currentBot.isAllIn) return;

        const potAmt = currentPotOnTable;
        const callAmt = highestBet - currentBot.currentBet;

        if (strength < 0.25) {
            if (callAmt > 0) { handleAction('FOLD'); } else { handleAction('CHECK'); }
        } else if (strength < 0.6) {
            if (Math.random() > 0.8 && currentBot.chips > potAmt * 0.5) { handleAction('RAISE', highestBet + Math.floor(potAmt * 0.5)); } else { handleAction('CALL'); }
        } else {
            if (Math.random() > 0.7 || currentBot.chips < potAmt) { handleAction('RAISE', currentBot.chips + currentBot.currentBet); } else { handleAction('RAISE', highestBet + potAmt); }
        }
      }, delay); 
    } 
    return () => clearTimeout(timerRef.current); 
  }, [activeIdx, phase, isShowdown, handleAction, players, community, activeVariant, evaluateBestHandSync, currentPotOnTable, highestBet]);

  const winnerPos = useMemo(() => {
      const idx = winningPlayerIndices[0] || 0;
      return SEAT_POSITIONS[idx] || SEAT_POSITIONS[0];
  }, [winningPlayerIndices]);

  const handleSitDown = () => {
    if (playerNameInput.trim().length === 0) return;
    const finalName = playerNameInput.trim().toUpperCase();
    const heroObj = {
      id: 0, userId: LOCAL_USER_ID, name: finalName, isBot: false, chips: 2000, hand: [], currentBet: 0, totalContributed: 0, isFolded: false, isAdmin: true, isDealer: true, isSeated: true, acted: false, joinedAt: Date.now(), handResult: null, variantId: 'HOLDEM', isAllIn: false
    };
    setPlayers(prev => prev.map((p, i) => i === 0 ? heroObj : p));
    addLog({ name: finalName, action: `HAS JOINED THE ARENA`, type: 'system' });
    socket.emit('sitPlayer', { name: finalName, seatIndex: 0 });
  };

  const handleAddBot = () => {
    const emptyIdx = players.findIndex(p => p === null);
    if (emptyIdx === -1) return;
    const nextBotName = BOT_NAMES[players.filter(p => p?.isBot).length % BOT_NAMES.length];
    setPlayers(prev => prev.map((p, i) => i === emptyIdx ? {
        id: emptyIdx, userId: `bot_${Math.random()}`, name: nextBotName, isBot: true, chips: 2000, hand: [], currentBet: 0, totalContributed: 0, isFolded: false, isSeated: true, acted: false, joinedAt: Date.now(), handResult: null, isDealer: false, isAllIn: false
    } : p));
  };

  return (
    <div className="h-screen bg-[#06080c] text-white font-sans flex flex-col overflow-hidden relative selection:bg-cyan-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a202c_0%,_#06080c_100%)] pointer-events-none" />

      <header className="absolute top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-[30px] border-b border-white/10 flex items-center justify-between px-8 z-[8000] shadow-xl">
        <div className="flex items-center gap-6">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-all active:scale-90"><ChevronLeft size={20} className={sidebarOpen ? 'rotate-0' : 'rotate-180'} /></button>
          <div className="flex items-center gap-6 bg-white/5 border border-white/10 px-6 py-2 rounded-2xl">
            <span className="text-[#fbbf24] font-black text-xl uppercase whitespace-nowrap">THIS HAND:</span>
            <div className="flex flex-col leading-tight">
              <span className="text-[#fbbf24] font-black text-xl uppercase tracking-widest leading-none">{String(activeVariant.name)}</span>
              <span className="text-white/60 text-sm font-bold italic tracking-tight mt-1">{String(activeVariant.rules)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end w-72 relative text-right">
           <span className="text-white/40 font-bold uppercase text-xs tracking-widest mb-1">On my turn, deal:</span>
           <select value={pendingVariantId} onChange={(e) => setPendingVariantId(String(e.target.value))} className="bg-transparent text-[#fbbf24] font-black text-lg uppercase border-none outline-none cursor-pointer leading-none">
               {Object.entries(VARIANTS).map(([k, v]) => <option key={k} value={k} className="bg-slate-900">{String(v.name)}</option>)}
           </select>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center relative min-h-screen pt-16 pb-36 px-4">
        <div className="relative w-full max-w-[1600px] aspect-[21/10] mx-auto transition-all duration-1000 flex items-center justify-center">

            {!userSeat && (
                <div className="absolute inset-0 z-[9000] flex items-center justify-center pointer-events-auto bg-black/40 backdrop-blur-md">
                    <div className="w-[30vw] min-w-[360px] p-10 rounded-[2vw] bg-black/80 border border-white/10 backdrop-blur-xl shadow-[0_0_5vw_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 flex flex-col items-center gap-8">
                        <div className="flex flex-col items-center gap-2"><div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_2vw_rgba(16,185,129,0.1)]"><User size={40} className="text-emerald-400" /></div><h2 className="text-2xl font-black uppercase tracking-[0.3em] text-white">Join Lobby</h2></div>
                        <div className="w-full flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Display Name</label>
                            <input type="text" maxLength={12} value={playerNameInput} onChange={(e) => setPlayerNameInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSitDown()} placeholder="ENTER YOUR NAME..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-xl font-black uppercase tracking-widest text-[#fbbf24] placeholder:text-white/10 focus:outline-none focus:border-[#fbbf24] transition-all" />
                        </div>
                        <button disabled={playerNameInput.trim().length === 0} onClick={handleSitDown} className="w-full p-6 rounded-2xl bg-emerald-600 border border-emerald-500/50 shadow-[0_0_3vw_rgba(16,185,129,0.2)] hover:bg-emerald-500 transition-all duration-300 disabled:opacity-20 disabled:grayscale disabled:pointer-events-none text-lg font-black uppercase tracking-[0.3em] text-white">Sit at Table</button>
                    </div>
                </div>
            )}

            <aside className={`fixed left-0 top-16 bottom-[200px] bg-[#0f172a]/95 backdrop-blur-[25px] border-r border-white/5 transition-all duration-500 flex flex-col overflow-hidden z-[7500] ${sidebarOpen ? 'w-[20vw] min-w-[280px] opacity-100 pointer-events-auto' : 'w-0 opacity-0 pointer-events-none'}`}>
              <div className="flex-1 overflow-y-auto p-6 space-y-8 relative pt-10">
                <section className="text-left"><div className="flex items-center justify-between mb-6 border-b border-white/10 pb-3"><div className="flex items-center gap-2 text-slate-400 uppercase font-black text-xs tracking-[0.2em]"><Settings2 size={16}/> Arena Settings</div></div>
                <div className="grid grid-cols-1 gap-4"><button onClick={handleAddBot} className="flex items-center gap-3 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 p-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600/20 transition-all shadow-xl"><UserPlus size={18}/> Add Bot</button>
                <button onClick={() => { setPlayers(INITIAL_PLAYERS); setCommunity([]); setPotData([{ label: 'MAIN', amount: 0, eligible: [] }]); setPhase(PHASES.IDLE); addLog({ action: "ARENA RESET", type: 'system' }); }} className="flex items-center gap-3 bg-red-950/20 border border-red-500/30 text-red-400 p-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-950/40 transition-all shadow-xl"><Trash2 size={18}/> Clear Arena</button></div></section>
              </div>
            </aside>

            <div className="absolute inset-0 bg-emerald-950/5 rounded-[40%] border-[1.5vw] border-slate-900 shadow-[inset_0_0_8vw_rgba(245,158,11,0.2),inset_0_0_15vw_rgba(0,0,0,0.9)] overflow-hidden" />

            <div className={`absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center z-30 pointer-events-none`}>
              <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-[800ms] ease-in-out`} style={{ top: potTransferring ? `${winnerPos.y - 43}vh` : '-2.5vw', left: potTransferring ? `${winnerPos.x - 50}vw` : '50%', transform: `translate(-50%, -50%) ${potTransferring ? 'scale(0.3)' : 'scale(1)'}`, opacity: potTransferring ? 0 : 1 }}>
                <div className="text-[4vw] font-black text-yellow-400 drop-shadow-[0_0.3vw_1vw_rgba(0,0,0,0.8)] font-mono tracking-tighter leading-none">${Number(currentPotOnTable)}</div>
              </div>

              {isShowdown && isWinnerCalculated && players[winningPlayerIndices[0]]?.handResult && (
                 <div className="absolute -top-32 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-600/0 via-yellow-400/90 to-yellow-600/0 px-16 py-2 whitespace-nowrap animate-in fade-in slide-in-from-top-4 duration-500 z-50">
                    <span className="text-black font-black text-[1.5vw] uppercase tracking-[0.2em] drop-shadow-sm">{players[winningPlayerIndices[0]]?.handResult?.name}</span>
                 </div>
              )}

              <div className={`flex gap-2 relative items-center justify-center min-w-[15vw] scale-[1.7]`}>
                  {(community || []).map((c, i) => {
                      const shouldHighlight = isShowdown && isWinnerCalculated && (winning5Ids || []).includes(c.id);
                      return (
                        <div key={i} className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] border border-white/40 flex flex-col items-center justify-center font-bold text-slate-950 brightness-110 shadow-2xl transition-all duration-300
                        ${shouldHighlight ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_#fbbf24] bg-gradient-to-br from-white via-white to-slate-100 animate-pulse' : 'bg-white shadow-[0.1vw_0.1vw_0.4vw_rgba(0,0,0,0.5)]'}`}>
                            <div className="flex flex-col items-center leading-none">
                               <span className="text-[0.9vw] font-black">{String(c.value)}</span>
                               <span className={`text-[1.8vw] mt-[0.1vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{String(c.suit)}</span>
                            </div>
                        </div>
                      );
                  })}
              </div>
            </div>

            <div className="absolute inset-0 pointer-events-none z-20">
              {(players || []).map((p, i) => i !== 0 && <Seat key={i} player={p} index={i} phase={phase} dealStaggerIndex={dealStaggerIndex} winning5Ids={winning5Ids} potTransferring={potTransferring && winningPlayerIndices.includes(i)} isWinnerCalculated={isWinnerCalculated} />)}
            </div>

            <div style={{ left: '50%', top: '98%', transform: 'translate(-50%, -100%)' }} className={`absolute flex flex-col items-center pointer-events-none w-fit h-fit z-50`}>
              <div className="relative flex items-center justify-center w-[12vw] h-[6vw] overflow-visible">
                  {userSeat && !userSeat.isFolded && phase !== PHASES.IDLE && (
                    <div className="relative flex items-center justify-center w-full h-full scale-[1.7]">
                      {(userSeat.hand || []).map((c, ci) => {
                        const fanOffset = (ci - (userSeat.hand.length - 1) / 2) * 2.5; 
                        const rotation = (ci - (userSeat.hand.length - 1) / 2) * 10; 
                        const isWinnerHero = isShowdown && winningPlayerIndices.includes(0);
                        const shouldHighlightHero = isWinnerHero && (winning5Ids || []).includes(c.id);

                        return (
                          <div key={ci} 
                            className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] border border-white/40 flex flex-col items-start justify-start p-[0.3vw] font-bold brightness-110 absolute bg-white text-slate-950 shadow-2xl overflow-hidden transition-all duration-300
                            ${shouldHighlightHero ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_#fbbf24] animate-pulse z-[100]' : 'opacity-100'}`} 
                            style={{ transform: `translateX(${fanOffset}vw) rotate(${rotation}deg)`, transformOrigin: 'bottom center', zIndex: shouldHighlightHero ? 200 : ci }}
                          >
                            <div className="flex flex-col items-start h-full w-full pl-0.5 pt-0.5 relative leading-none">
                              <span className="text-[1vw] font-black mb-[0.1vw]">{String(c.value)}</span>
                              <span className={`text-[1.5vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-950'}`}>{String(c.suit)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>

              {getCurrentStrength(userSeat) && !isShowdown && phase !== PHASES.IDLE && (
                <div className="z-[5001] h-7 px-3 py-1 bg-purple-600/95 border border-purple-300/30 rounded-full shadow-[0_0_2vw_rgba(147,51,234,0.6)] animate-in fade-in zoom-in whitespace-nowrap pointer-events-auto transition-all flex items-center relative -mt-3 mb-1">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">{String(getCurrentStrength(userSeat))}</span>
                </div>
              )}

              {userSeat && (
                <div className={`flex items-center gap-[0.5vw] p-[0.6vw] px-[2.5vw] rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl transition-all duration-300 relative pointer-events-auto z-50 
                  ${userSeat.isWinner && isShowdown ? (potTransferring ? 'border-yellow-400 scale-125 shadow-[0_0_3vw_#fbbf24]' : 'border-yellow-400 scale-110 shadow-[0_0_2vw_#fbbf24]') : 'border-white/10'}`}>
                  <div className="flex flex-col items-center">
                    {userSeat.isAllIn && !userSeat.isFolded && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white animate-pulse">All-In</div>
                    )}
                    <div className="flex items-center gap-2">
                      {userSeat.isDealer && <div className="w-[0.8vw] h-[0.8vw] bg-red-600 rounded-full animate-pulse" />}
                      <span className="text-[1.2vw] font-black text-white leading-none uppercase tracking-widest">{String(userSeat.name)}</span>
                    </div>
                    <span className={`text-[1.3vw] font-mono font-black mt-1 transition-all duration-500 ${userSeat.isWinner && isShowdown ? 'text-emerald-400' : 'text-emerald-500/80'}`}>${Number(userSeat.chips)}</span>
                  </div>
                </div>
              )}
            </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-[200px] bg-black/40 backdrop-blur-3xl border-t border-white/10 z-[6000] flex flex-row items-end gap-0 pointer-events-none">
        <div className="flex-1 h-full bg-white/5 border-r border-white/10 p-6 flex flex-col pointer-events-auto overflow-hidden">
          <div className="flex items-center gap-2 text-slate-400 uppercase font-black text-sm mb-4 tracking-[0.2em] border-b border-white/10 pb-3"><Info size={18}/> INTELLIGENCE FEED</div>
          <div className="flex-1 font-mono text-xs leading-4 space-y-0 overflow-y-auto pr-2 scrollbar-hide flex flex-col">
            {logs.map((l) => (
              <div key={l.id} className="py-0.5 border-b border-white/5 flex gap-3 h-4 items-center flex-shrink-0">
                <span className="text-slate-500 shrink-0">[{String(l.time)}]</span>
                <span className={l.type === 'system' ? 'text-yellow-400 font-black uppercase' : (l.type === 'win' ? 'text-yellow-400 font-black' : 'text-cyan-400 font-black')}>{l.name ? String(l.name) : ""}</span>
                <span className={l.type === 'win' ? 'text-yellow-400 font-bold uppercase' : (l.type === 'system' ? 'text-yellow-400 font-black uppercase' : 'text-slate-300')}>
                  {String(l.action)} {l.amount ? `$${l.amount}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 h-full bg-white/5 flex flex-col justify-between py-6 px-10 pointer-events-auto relative shadow-inner overflow-hidden">
          {isHeroTurn ? (
            <div className="flex flex-col justify-between items-center w-full h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex gap-4 justify-center items-center w-full mt-0">
                <span className="text-sm font-black uppercase tracking-widest text-slate-500 mr-2">Quick Bet</span>
                <div className="flex gap-4">
                  <button onClick={() => handleAction('RAISE', Math.min(maxAllIn, Math.floor(currentPotOnTable * 0.5 + highestBet)))} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase text-slate-300 hover:brightness-125 transition-all duration-300 flex items-center justify-center">1/2 POT</button>
                  <button onClick={() => handleAction('RAISE', Math.min(maxAllIn, Math.floor(currentPotOnTable + highestBet)))} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase text-[#fbbf24] hover:brightness-125 transition-all duration-300 flex items-center justify-center">POT</button>
                  <button onClick={() => handleAction('RAISE', maxAllIn)} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase text-red-500 hover:brightness-125 transition-all duration-300 flex items-center justify-center">MAX</button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-0 w-full px-4 flex-1">
                <div className="flex-1 flex items-center h-12 pr-4"><input type="range" min={minRaiseTo} max={maxAllIn} step="10" value={raiseAmount} onChange={(e) => setRaiseAmount(Number(e.target.value))} className="gold-slider" /></div>
                <div className="w-32 h-10 relative flex items-center bg-[#06080c] border border-white/10 rounded-lg px-3 group focus-within:border-[#fbbf24] transition-all"><span className="text-[#fbbf24] font-black mr-1 text-sm">$</span><input type="number" value={raiseAmount} onChange={(e) => setRaiseAmount(Math.max(0, Math.min(maxAllIn, parseInt(e.target.value) || 0)))} className="bg-transparent border-none outline-none text-[#fbbf24] font-mono font-black w-full text-base" /></div>
              </div>
              <div className="flex items-center justify-center gap-8 w-full mb-0">
                <button onClick={() => handleAction('FOLD')} className="w-32 h-12 bg-red-950/40 border border-red-500/50 rounded-full font-black text-sm uppercase tracking-[0.15em] text-red-400 hover:brightness-125 transition-all duration-300 shadow-lg">FOLD</button>
                <button onClick={() => handleAction('CALL')} className="w-48 h-12 bg-blue-950/40 border border-blue-500/50 rounded-full font-black text-base uppercase tracking-[0.15em] text-blue-400 hover:brightness-125 transition-all duration-300 shadow-lg">{highestBet > (userSeat?.currentBet || 0) ? 'CALL' : 'CHECK'}</button>
                <button onClick={() => handleAction('RAISE', raiseAmount)} className="w-32 h-12 bg-emerald-950/40 border border-emerald-500/50 rounded-full font-black text-sm uppercase tracking-[0.15em] text-emerald-400 hover:brightness-125 transition-all duration-300 gap-2 shadow-lg"><Zap size={20}/> RAISE</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 opacity-80 h-full">
               <Target size={48} className={phase === PHASES.IDLE && seatedCount >= 2 ? "text-[#22d3ee] animate-pulse" : "text-slate-600"}/>
               <span className={`font-black uppercase text-[#fbbf24] animate-pulse text-[1.5vw] tracking-[0.2em]`}>
                 {phase === PHASES.IDLE && seatedCount >= 2 ? "DEALING" : (isShowdown ? "REVEAL" : activeIdx !== -1 && players[activeIdx] ? (players[activeIdx].userId === LOCAL_USER_ID ? "YOUR TURN" : `${players[activeIdx].name.toUpperCase()}'S TURN`) : "WAITING")}
               </span>
            </div>
          )}
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce-in {
          0% { opacity: 0; transform: translate(-50%, 20px) scale(0.8); }
          50% { opacity: 1; transform: translate(-50%, -10px) scale(1.1); }
          70% { transform: translate(-50%, 5px) scale(0.95); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
};

export default App;
