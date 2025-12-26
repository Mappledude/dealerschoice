import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from "socket.io-client"; // Surgical Add
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign
} from 'lucide-react';

// --- PRODUCTION SOCKET CONFIG ---
// This logic ensures the app works on Render and localhost automatically
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? "https://your-poker-server.onrender.com" // <--- REPLACE WITH YOUR RENDER URL
  : "http://localhost:3001";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: true
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

const SEAT_POSITIONS = [
  { x: 50, y: 92 }, 
  { x: 6,  y: 68 }, 
  { x: 4,  y: 39 }, 
  { x: 12, y: 20 }, 
  { x: 30, y: 10 }, 
  { x: 50, y: 8 }, 
  { x: 70, y: 10 }, 
  { x: 88, y: 20 }, 
  { x: 96, y: 39 }, 
  { x: 94, y: 68 }  
];

const INITIAL_PLAYERS = Array.from({ length: TOTAL_SEATS }, (_, i) => 
  i === 0 ? {
    id: 0,
    userId: LOCAL_USER_ID,
    name: "Hero",
    isBot: false,
    chips: 2000,
    hand: [],
    currentBet: 0,
    totalContributed: 0,
    isFolded: false,
    isAdmin: true,
    isDealer: true,
    isSeated: true,
    acted: false,
    joinedAt: Date.now(),
    handResult: null,
    variantId: 'HOLDEM',
    blindType: null
  } : null
);

const VALUE_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const SUITS = ['♠', '♣', '♥', '♦'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

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

// --- SUB-COMPONENTS ---
const Seat = ({ player, index, phase, dealStaggerIndex, winning5Ids }) => {
  if (!player) return null;
  const pos = SEAT_POSITIONS[index];
  const isHero = player?.userId === LOCAL_USER_ID;
  const isShowdown = phase === PHASES.SHOWDOWN;
  const showCards = isHero || isShowdown;
  const isWinner = player.isWinner;
  const dimPlayer = isShowdown && !isWinner; 

  if (isHero && !isShowdown) return null;

  return (
    <div style={{ left: `${pos.x}%`, top: `${pos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 transition-all duration-1000 ${player?.isFolded ? 'opacity-20 grayscale scale-95' : (dimPlayer ? 'opacity-50' : 'opacity-100')}`}>
      {isWinner && isShowdown && <div className="absolute inset-[-30px] rounded-full bg-yellow-500/10 blur-[40px] animate-pulse ring-4 ring-yellow-400/20 z-0" />}
      {!isHero && player?.hand?.length > 0 && !player.isFolded && (
        <div className={`flex items-end pointer-events-none transition-all duration-1000 mb-[-12px] overflow-visible`}>
          {(player.hand || []).map((c, ci) => {
            const isWinningCard = winning5Ids.includes(c.id);
            return (
              <div key={ci} 
                className={`w-10 h-14 rounded-[6px] border-none flex flex-col items-start justify-start p-1 text-[10px] font-bold transition-all duration-1000 brightness-125 
                ${showCards ? 'bg-gradient-to-br from-white via-white to-slate-50 text-slate-950 shadow-[2px_2px_5px_rgba(0,0,0,0.5),_inset_0_0_0_1px_rgba(0,0,0,0.1)]' : 'bg-slate-900 border border-white/10'} 
                ${dealStaggerIndex >= ci ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[-20px]'} 
                ${isShowdown && !isWinningCard ? 'opacity-20 grayscale-[0.5]' : 'opacity-100'} 
                ${isWinningCard ? 'drop-shadow-[0_0_10px_rgba(251,191,36,0.6)] drop-shadow-[0_0_20px_rgba(251,191,36,0.4)] z-[500] border-yellow-400' : ''}`} 
                style={{ 
                  transform: `translateX(${ci * -12}px) scale(${isShowdown ? (isWinningCard ? 1.1 : 0.85) : 0.85})`, 
                  zIndex: isWinningCard ? 700 : ci 
                }}
              >
                {showCards ? (
                   <div className="flex flex-col items-start leading-none h-full w-full pl-0.5 pt-0.5">
                     <span className="text-[10px] font-black">{c.value}</span>
                     <span className={`text-[14px] -mt-1 leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-950'}`}>{c.suit}</span>
                   </div>
                 ) : ( <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-950 rounded-[4px] opacity-50 shadow-inner" /> )}
              </div>
            );
          })}
        </div>
      )}
      <div className={`flex items-center gap-2 p-1 px-5 rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl transition-all duration-500 relative ${isWinner && isShowdown ? 'border-yellow-400 shadow-[0_0_30px_rgba(251,191,36,0.8)] scale-110' : 'border-white/10'}`}>
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
                {player?.isDealer && <div className="w-3 h-3 bg-red-600 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.8)] animate-pulse" />}
                <span className="text-[9px] font-black text-white leading-none uppercase tracking-widest">{String(player?.name || "Player")}</span>
            </div>
            <span className={`text-[10px] font-mono font-black mt-0.5 transition-all duration-500 ${isWinner && isShowdown ? 'text-emerald-400 animate-pulse scale-125' : 'text-emerald-500/80'}`}>${Number(player?.chips || 0)}</span>
        </div>
      </div>
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
  const [countdown, setCountdown] = useState(null);
  const [showSplash, setShowSplash] = useState(false);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [winningPlayerIndex, setWinningPlayerIndex] = useState(-1); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [handCount, setHandCount] = useState(1);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [potMovingWinnerIdx, setPotMovingWinnerIdx] = useState(-1);
  
  // 2. REFS
  const hasProcessedShowdown = useRef(false);
  const timerRef = useRef(null);
  const autoResetTimer = useRef(null);

  // 3. DERIVED STATE
  const isShowdown = useMemo(() => phase === PHASES.SHOWDOWN, [phase]);
  const heroSeatIdx = useMemo(() => players.findIndex(p => p?.userId === LOCAL_USER_ID), [players]);
  const userSeat = useMemo(() => players.find(p => p?.userId === LOCAL_USER_ID), [players]);
  const actualPotAmount = useMemo(() => (potData || []).reduce((acc, p) => acc + (p?.amount || 0), 0), [potData]);
  const currentPotOnTable = useMemo(() => actualPotAmount + (players || []).reduce((s, p) => s + (p?.currentBet || 0), 0), [actualPotAmount, players]);
  const seatedCount = useMemo(() => (players || []).filter(p => p && p.isSeated).length, [players]);
  const dealerIndex = useMemo(() => (players || []).findIndex(p => p?.isDealer), [players]);
  const isHeroTurn = useMemo(() => activeIdx !== -1 && heroSeatIdx !== -1 && activeIdx === heroSeatIdx && phase !== PHASES.IDLE && !isShowdown, [activeIdx, heroSeatIdx, phase, isShowdown]);
  const minRaiseTo = useMemo(() => highestBet + lastRaiseAmt, [highestBet, lastRaiseAmt]);
  const maxAllIn = useMemo(() => userSeat?.chips || 0, [userSeat]);

  // Production-Ready Logging
  const addLog = useCallback((data) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logEntry = { 
      id: Date.now() + Math.random(), // Secure replacement for randomUUID
      time: String(timestamp), 
      name: String(data.name || "System"), 
      action: String(data.action || ""), 
      amount: data.amount ? String(data.amount) : null, 
      type: String(data.type || 'info') 
    };
    setLogs(prev => [logEntry, ...prev].slice(0, 50));
  }, []);

  const getNextSeatedPlayer = useCallback((startIndex, currentPlayers = players) => {
    if (!currentPlayers) return -1;
    for (let i = 1; i <= TOTAL_SEATS; i++) {
      const idx = (startIndex + i) % TOTAL_SEATS;
      const p = currentPlayers[idx];
      if (p?.isSeated && !p?.isFolded && (p.chips > 0 || p.currentBet > 0 || p.userId === LOCAL_USER_ID)) return idx;
    }
    return -1;
  }, [players]);

  const evaluateBestHandSync = useCallback((hand, board, v) => {
    if (!hand || hand.length === 0 || board.length < 3) return { power: 0, hand: [], name: "Calculating..." };
    
    if (v.id === 'OMAHA') {
        const hCombos = getCombinations(hand, 2);
        const bCombos = getCombinations(board, 3);
        let best = { power: -1, hand: [], name: "High Card" };
        hCombos.forEach(hc => bCombos.forEach(bc => {
            const full = [...hc, ...bc];
            const r = rankFiveCardHand(full);
            if (r.power > best.power) { best = { ...r, hand: full }; }
        }));
        return best;
    } else {
        const subsets = getCombinations([...hand, ...board], 5);
        let best = { power: -1, name: "High Card", hand: [] };
        subsets.forEach(c => { 
            const r = rankFiveCardHand(c); 
            if (r.power > best.power) { best = { ...r, hand: c }; } 
        });
        return best;
    }
  }, []);

  const rotateDealer = useCallback(() => {
    const dIdx = players.findIndex(p => p?.isDealer);
    const nextD = getNextSeatedPlayer(dIdx);
    setPlayers(prev => (prev || []).map((p, i) => {
        if (!p) return null;
        return { ...p, isDealer: i === nextD, isWinner: false, hand: [], currentBet: 0, totalContributed: 0, acted: false, isFolded: false, handResult: null, blindType: null };
    }));
    setCommunity([]);
    setPotData([{ label: 'MAIN', amount: 0, eligible: [] }]);
    setPhase(PHASES.IDLE);
    setPotMovingWinnerIdx(-1);
    setWinning5Ids([]);
  }, [players, getNextSeatedPlayer]);

  const handleDeal = useCallback(() => {
    if (seatedCount < 2) return;
    hasProcessedShowdown.current = false;
    setCommunity([]);
    setPotData([{ label: 'MAIN', amount: 0, eligible: [] }]);
    setLastRaiseAmt(BLINDS.bb);
    setDealStaggerIndex(-1);
    setWinning5Ids([]);
    setWinningPlayerIndex(-1);
    setPotMovingWinnerIdx(-1);
    
    let dIdx = players.findIndex(p => p && p.isDealer && p.isSeated);
    if (dIdx === -1) { 
        dIdx = players.findIndex(p => p && p.isSeated); 
        setPlayers(prev => prev.map((p, i) => i === dIdx ? { ...p, isDealer: true } : { ...p, isDealer: false })); 
    }
    const variantChoice = VARIANTS[pendingVariantId];
    setActiveVariant(variantChoice);
    setShowSplash(true);
    setTimeout(() => {
        const suitsList = ['♠', '♣', '♥', '♦'];
        const valuesList = VALUES;
        const fullDeck = suitsList.flatMap(s => valuesList.map(v => ({suit: s, value: v, rank: VALUE_MAP[v], id: v+s}))).sort(() => Math.random() - 0.5);
        
        let nextPlayers = players.map(p => p ? { ...p, hand: [], currentBet: 0, totalContributed: 0, isFolded: false, acted: false, winner: false, isWinner: false, handResult: null, blindType: null } : p);
        let sbIdx = getNextSeatedPlayer(dIdx, nextPlayers);
        let bbIdx = getNextSeatedPlayer(sbIdx, nextPlayers);
        let utgIdx = getNextSeatedPlayer(bbIdx, nextPlayers);
        
        nextPlayers[sbIdx].chips -= BLINDS.sb; nextPlayers[sbIdx].currentBet = BLINDS.sb; nextPlayers[sbIdx].blindType = 'SB';
        nextPlayers[bbIdx].chips -= BLINDS.bb; nextPlayers[bbIdx].currentBet = BLINDS.bb; nextPlayers[bbIdx].blindType = 'BB';
        
        const cardMap = nextPlayers.map(p => p ? fullDeck.splice(0, variantChoice.holeCards) : []);
        setPlayers(nextPlayers.map((p, i) => p ? { ...p, hand: cardMap[i] } : p));
        setDeck(fullDeck); setHighestBet(BLINDS.bb); setPotData([{ label: 'MAIN', amount: 60, eligible: [] }]); setPhase(PHASES.PRE_FLOP); setShowSplash(false); setActiveIdx(utgIdx);
        Array.from({ length: variantChoice.holeCards }).forEach((_, i) => setTimeout(() => setDealStaggerIndex(i), i * 200));
    }, 2000);
  }, [players, seatedCount, getNextSeatedPlayer, pendingVariantId]);

  const handleAction = useCallback((type, amt = 0) => {
    const player = players[activeIdx];
    if (!player) return;
    let nextPlayers = [...players];
    if (type === 'FOLD') { nextPlayers[activeIdx].isFolded = true; addLog({ name: player.name, action: "FOLDED" }); }
    if (type === 'CALL' || type === 'CHECK') {
      const callVal = Math.min(player.chips, highestBet - player.currentBet);
      nextPlayers[activeIdx].currentBet += callVal; nextPlayers[activeIdx].chips -= callVal;
      addLog({ name: player.name, action: "CALLED" , amount: callVal > 0 ? String(callVal) : null });
    }
    if (type === 'RAISE') {
      const additional = Math.min(player.chips, amt - player.currentBet);
      const actualTotal = player.currentBet + additional;
      if (actualTotal > highestBet) setLastRaiseAmt(Math.max(actualTotal - highestBet, lastRaiseAmt));
      nextPlayers[activeIdx].chips -= additional; nextPlayers[activeIdx].currentBet = actualTotal; setHighestBet(actualTotal);
      addLog({ name: player.name, action: "RAISED to", amount: String(actualTotal) });
    }
    nextPlayers[activeIdx].acted = true;
    const totalActive = nextPlayers.filter(p => p && p.isSeated && !p.isFolded);
    if (totalActive.every(p => p.acted && (p.currentBet === highestBet || p.chips === 0))) {
        setTimeout(() => {
          const roundPot = nextPlayers.reduce((sum, p) => sum + (p?.currentBet || 0), 0);
          setPotData(prev => [{ ...prev[0], amount: prev[0].amount + roundPot }]);
          setPlayers(nextPlayers.map(p => p ? { ...p, currentBet: 0, acted: false } : null));
          setHighestBet(0); setLastRaiseAmt(BLINDS.bb);
          let nextPhase = PHASES.IDLE; let nextDeck = [...deck]; let nextCommunity = [...community];
          if (phase === PHASES.PRE_FLOP) { nextPhase = PHASES.FLOP; nextCommunity = nextDeck.splice(0, 3); }
          else if (phase === PHASES.FLOP) { nextPhase = PHASES.TURN; nextCommunity = [...nextCommunity, ...nextDeck.splice(0, 1)]; }
          else if (phase === PHASES.TURN) { nextPhase = PHASES.RIVER; nextCommunity = [...nextCommunity, ...nextDeck.splice(0, 1)]; }
          else { setPhase(PHASES.SHOWDOWN); return; }
          setPhase(nextPhase); setDeck(nextDeck); setCommunity(nextCommunity);
          setActiveIdx(getNextSeatedPlayer(dealerIndex, nextPlayers));
        }, 800);
    } else { setPlayers(nextPlayers); setActiveIdx(getNextSeatedPlayer(activeIdx, nextPlayers)); }
  }, [activeIdx, phase, highestBet, deck, community, players, getNextSeatedPlayer, dealerIndex, addLog]);

  const getCurrentStrength = useCallback((p) => {
    if (!p || p.isFolded || !p.hand || p.hand.length === 0) return null;
    if (isShowdown && winningPlayerIndex !== -1) {
       const winner = players[winningPlayerIndex];
       if (winner) return `🏆 ${String(winner.name).toUpperCase()} WINS $${actualPotAmount}`;
    }
    const result = evaluateBestHandSync(p.hand, community, activeVariant);
    return String(activeVariant.id === 'MUFLIS' ? `MUFLIS: ${result.name}` : result.name);
  }, [community, activeVariant, evaluateBestHandSync, isShowdown, winningPlayerIndex, players, actualPotAmount]);

  // Handle Socket Events for Production
  useEffect(() => {
    socket.on("connect", () => addLog({ action: "SYNCED TO ARENA", type: 'system' }));
    return () => socket.off("connect");
  }, [addLog]);

  // 5. LIFECYCLE EFFECTS
  useEffect(() => { 
    if (phase === PHASES.IDLE && seatedCount >= 2) { 
      const dealDelay = setTimeout(() => handleDeal(), 1000); 
      return () => clearTimeout(dealDelay); 
    } 
  }, [phase, seatedCount, handleDeal]);

  useEffect(() => {
    if (isShowdown && !hasProcessedShowdown.current) {
      hasProcessedShowdown.current = true;
      const isMuflis = activeVariant.id === 'MUFLIS';
      const evaluated = players.map(p => (!p || !p.isSeated || p.isFolded) ? p : { ...p, handResult: evaluateBestHandSync(p.hand, community, activeVariant) });
      
      const winners = evaluated
        .filter(p => p && !p.isFolded && p.isSeated)
        .sort((a,b) => isMuflis ? a.handResult.power - b.handResult.power : b.handResult.power - a.handResult.power);
      
      if (winners.length > 0) {
          const firstWinner = winners[0]; 
          const winIdx = players.findIndex(p => p?.userId === firstWinner.userId);
          const winCards = firstWinner.handResult.hand.map(c => c.id);
          
          setWinning5Ids(winCards); 
          setWinningPlayerIndex(winIdx);
          const share = Math.floor(actualPotAmount); 

          setPotMovingWinnerIdx(winIdx);

          addLog({ 
            name: String(firstWinner.name), 
            action: `WINNER: ${String(firstWinner.name)} - ${String(firstWinner.handResult.name).toUpperCase()} ($${share})`, 
            type: 'win' 
          });
          
          setTimeout(() => {
              setPlayers(prev => prev.map((p, i) => i === winIdx ? { ...p, chips: p.chips + share, isWinner: true } : p));
          }, 1200); 
      }
      setCountdown(6); 
    }
  }, [isShowdown, activeVariant, evaluateBestHandSync, actualPotAmount, players, community, addLog]);

  useEffect(() => {
    if (countdown !== null) {
      if (countdown > 0) { autoResetTimer.current = setTimeout(() => setCountdown(countdown - 1), 1000); }
      else { 
        setCountdown(null); setHandCount(prev => prev + 1); setWinning5Ids([]); setWinningPlayerIndex(-1); 
        rotateDealer(); setTimeout(() => handleDeal(), 500); 
      }
    }
    return () => clearTimeout(autoResetTimer.current);
  }, [countdown, players, getNextSeatedPlayer, handleDeal, rotateDealer]);

  useEffect(() => { if (activeIdx !== -1 && players[activeIdx]?.isBot && phase !== PHASES.IDLE && !isShowdown) { timerRef.current = setTimeout(() => handleAction('CALL'), 1500); } return () => clearTimeout(timerRef.current); }, [activeIdx, phase, isShowdown, handleAction, players]);

  return (
    <div className="h-screen bg-[#06080c] text-white font-sans flex flex-col overflow-hidden relative selection:bg-cyan-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a202c_0%,_#06080c_100%)] pointer-events-none" />
      
      <header className="absolute top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-[30px] border-b border-white/10 flex items-center justify-between px-10 z-[1000] shadow-xl">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-all active:scale-90"><ChevronLeft size={22} className={sidebarOpen ? 'rotate-0' : 'rotate-180'} /></button>
          <div className="flex flex-col text-left"><h1 className="text-xs font-black uppercase tracking-[0.5em] text-white leading-tight">DEALER'S CHOICE</h1><span className="text-[7px] text-cyan-400 font-bold uppercase tracking-[0.6em] opacity-80">Tactical Sync V55.5</span></div>
        </div>
        <div className="flex-1 flex justify-center gap-12 items-baseline opacity-80">
           <div className="flex gap-10 items-baseline">
               <div className="flex flex-col items-center"><span className="text-[7px] font-black uppercase tracking-widest text-slate-500">Win Prob.</span><span className="text-sm font-black font-mono text-emerald-400 italic leading-none">64%</span></div>
               <div className="flex flex-col items-center"><span className="text-[7px] font-black uppercase tracking-widest text-slate-500">Hand Rank</span><span className="text-sm font-black font-mono text-cyan-400 italic leading-none">TOP 15%</span></div>
               <div className="flex flex-col items-center"><span className="text-[7px] font-black uppercase tracking-widest text-slate-500">Draw %</span><span className="text-sm font-black font-mono text-yellow-400 italic leading-none">12.4%</span></div>
           </div>
        </div>
        <div className="flex flex-col items-end w-56 relative items-baseline">
           <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Dealer's Choice</span>
           <select 
             value={pendingVariantId} 
             onChange={(e) => { setPendingVariantId(e.target.value); addLog({ action: `PROTOCOL SHIFTED TO ${VARIANTS[e.target.value].name.toUpperCase()}`, type: 'system' }); }} 
             className="bg-transparent text-[#fbbf24] font-black text-[11px] uppercase border-none outline-none cursor-pointer text-right leading-none"
           >
               {Object.entries(VARIANTS).map(([k, v]) => <option key={k} value={k} className="bg-slate-900">{v.name}</option>)}
           </select>
        </div>
      </header>

      {/* Intelligence Feed */}
      <div className="fixed bottom-10 left-5 w-[18vw] min-w-[300px] h-[28vh] z-[2000] pointer-events-none scale-90 origin-bottom-left">
          <div className="w-full h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 flex flex-col shadow-2xl pointer-events-auto">
              <div className="flex items-center gap-2 text-slate-400 uppercase font-black text-[9px] mb-4 tracking-[0.2em] border-b border-white/10 pb-2"><Info size={12}/> Intelligence Feed</div>
              <div className="flex-1 font-mono text-[9px] space-y-2 overflow-y-auto pr-2 scrollbar-hide">
                {logs.map((l) => (
                  <div key={l.id} className="p-1 border-b border-white/5 flex gap-2">
                    <span className="text-slate-500">[{String(l.time)}]</span>
                    <span className={l.type === 'system' ? 'text-teal-400 font-bold' : 'text-cyan-400 font-black'}>{String(l.name === 'System' ? '' : l.name)}</span>
                    <span className={l.type === 'win' ? 'text-yellow-400 font-bold uppercase' : (l.type === 'system' ? 'text-teal-400 uppercase' : 'text-slate-300')}>{String(l.action)}</span>
                  </div>
                ))}
              </div>
          </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative pt-16">
        <aside className={`${sidebarOpen ? 'w-[15vw] min-w-[240px]' : 'w-0'} bg-[#0f172a]/95 backdrop-blur-[25px] border-r border-white/5 transition-all duration-500 flex flex-col overflow-hidden z-[6000]`}>
          <div className="flex-1 overflow-y-auto p-4 space-y-8 relative pt-10">
            <section className="text-left"><div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2"><div className="flex items-center gap-2 text-slate-400 uppercase font-black text-[10px] tracking-[0.2em]"><Settings2 size={14}/> Admin Controls</div></div><div className="grid grid-cols-1 gap-2"><button onClick={() => { const emptyIdx = players.findIndex(p => p === null); if (emptyIdx !== -1) { const botName = BOT_NAMES[emptyIdx % BOT_NAMES.length]; const newBot = { id: emptyIdx, userId: `bot_${Math.random()}`, name: botName, isBot: true, chips: 2000, hand: [], currentBet: 0, totalContributed: 0, isFolded: false, isSeated: true, acted: false, joinedAt: Date.now(), handResult: null, variantId: 'HOLDEM' }; setPlayers(prev => prev.map((p, i) => i === emptyIdx ? newBot : p)); addLog({ name: botName, action: "entered arena", type: 'join' }); } }} className="flex items-center gap-3 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 p-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600/20 transition-all active:scale-95"><UserPlus size={16}/> Add Bot</button><button onClick={() => { setPlayers(INITIAL_PLAYERS); setCommunity([]); setPotData([{ label: 'MAIN', amount: 0, eligible: [] }]); setPhase(PHASES.IDLE); setWinning5Ids([]); setWinningPlayerIndex(-1); addLog({ action: "Arena reset initiated" }); }} className="flex items-center gap-3 bg-red-950/20 border border-red-500/30 text-red-400 p-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-950/40 transition-all active:scale-95 shadow-xl"><Trash2 size={16}/> Clear Arena</button></div></section>
          </div>
        </aside>

        <main className="flex-1 relative flex items-center justify-center overflow-hidden transition-all duration-1000">
          <div className="relative w-[92%] h-[45vh] aspect-[4.1/1] flex items-center justify-center transition-all duration-1000 -mt-[280px]">
            <div className="absolute inset-0 bg-emerald-950/5 rounded-[300px] border-[22px] border-slate-900 shadow-[inset_0_0_120px_rgba(245,158,11,0.25),inset_0_0_200px_rgba(0,0,0,0.95)] overflow-hidden" />
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-3 z-[30] w-[600px] h-[150px] items-center justify-center pointer-events-none">
              <div className={`flex gap-3 mt-4 transition-all duration-1000`}>
                  {(community || []).map((c, i) => {
                      const isWinningCard = winning5Ids.includes(c.id);
                      return (
                        <div key={i} className={`w-10 h-14 rounded-[6px] flex flex-col items-center justify-center font-bold text-slate-950 transition-all duration-500 
                        ${isWinningCard ? 'scale-[2.21] z-[500] border-2 border-yellow-400 bg-white' : (isShowdown ? 'opacity-20 scale-[1.3] bg-white' : 'scale-[1.7] bg-white')}`}>
                            <span className="text-[14px] leading-none mb-1 font-black">{c.value}</span>
                            <span className={`text-4xl ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span>
                        </div>
                      );
                  })}
              </div>
              <div className={`flex items-center gap-3 transition-all duration-700`}>
                 <Coins size={32} className="text-yellow-400" />
                 <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-white/40">Pot</span><span className="text-4xl font-black font-mono text-yellow-400 tracking-tighter">${actualPotAmount}</span></div>
              </div>
            </div>
            
            <div className="absolute inset-0 pointer-events-none z-20">{(players || []).map((p, i) => (<Seat key={i} player={p} index={i} phase={phase} dealStaggerIndex={dealStaggerIndex} winning5Ids={winning5Ids} />))}</div>
          </div>
        </main>
      </div>

      <footer className={`fixed bottom-0 left-0 right-0 z-[5000] flex flex-col items-center pb-[20px] pointer-events-none`}>
        <div className="w-full max-w-[1600px] flex flex-col items-center relative h-fit">
          {userSeat && (
            <div className={`mb-[15px] p-1 px-5 rounded-full border-2 bg-black/95 border-white/10 pointer-events-auto`}>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                  {userSeat.isDealer && <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />}
                  <span className="text-[9px] font-black text-white leading-none uppercase tracking-widest">{String(userSeat.name)}</span>
                </div>
                <span className={`text-[10px] font-mono font-black mt-0.5 text-emerald-500/80`}>${Number(userSeat.chips)}</span>
              </div>
            </div>
          )}

          <div className="h-[60px]" />

          {/* Hero Hole Cards: CENTERED VERTICALLY BELOW BADGE */}
          {userSeat && !userSeat.isFolded && phase !== PHASES.IDLE && (
            <div className="mb-[15px] flex items-center justify-center pointer-events-auto h-24 relative overflow-visible">
                {(userSeat.hand || []).map((c, ci) => {
                  const isWinningCard = winning5Ids.includes(c.id);
                  const fanOffset = (ci - (userSeat.hand.length - 1) / 2) * 50;
                  return (
                    <div key={ci} className={`w-10 h-14 bg-white rounded-[6px] flex flex-col items-start p-1.5 text-[8px] font-bold shadow-2xl transition-all duration-1000 absolute`} 
                      style={{ 
                        transform: `translateX(${fanOffset}px) scale(${isShowdown ? (isWinningCard ? 2.34 : 1.8) : 1.8})`, 
                        bottom: '10px',
                        transformOrigin: 'bottom center'
                      }}>
                      <span className="text-[11px] font-black leading-none text-slate-950">{c.value}</span>
                      <span className={`text-[15px] -mt-1 leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-950'}`}>{c.suit}</span>
                    </div>
                  );
                })}
            </div>
          )}

          {userSeat && !userSeat.isFolded && phase !== PHASES.IDLE && getCurrentStrength(userSeat) && (
            <div className="mb-[15px] px-6 py-2 text-white font-black text-[9px] uppercase rounded-full bg-indigo-600/90 border border-indigo-300/30 z-[5001]">
              {String(getCurrentStrength(userSeat))}
            </div>
          )}

          {/* Action Interaction Deck */}
          <div className="flex flex-col items-center gap-[10px] pointer-events-auto w-[440px] mb-[20px]">
            {isHeroTurn && (
              <div className="w-full flex flex-col items-center">
                <div className="flex gap-4 mb-[10px]">
                  <button onClick={() => setRaiseAmount(Math.min(maxAllIn, Math.floor(currentPotOnTable * 0.5 + highestBet)))} className="px-7 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-slate-300">1/2 POT</button>
                  <button onClick={() => setRaiseAmount(maxAllIn)} className="px-7 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-red-500">MAX</button>
                </div>
                <div className="w-full flex items-center gap-5 relative">
                  <div className="absolute left-[-60px] text-[#fbbf24] font-black font-mono text-2xl">${raiseAmount}</div>
                  <input type="range" min={minRaiseTo} max={maxAllIn} step="10" value={raiseAmount} onChange={(e) => setRaiseAmount(Number(e.target.value))} className="gold-slider flex-1" />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center items-center gap-6 mt-2 mb-[10px] pointer-events-auto scale-[0.85] origin-center z-[9999]">
            {isHeroTurn ? (
              <><button onClick={() => handleAction('FOLD')} className="w-40 h-16 bg-red-950/40 border border-red-500/50 rounded-full font-black text-red-400">FOLD</button><button onClick={() => handleAction('CALL')} className="w-72 h-16 bg-blue-950/40 border border-blue-500/50 rounded-full font-black text-blue-400 uppercase">{highestBet > (userSeat?.currentBet || 0) ? 'CALL' : 'CHECK'}</button><button onClick={() => handleAction('RAISE', raiseAmount)} className="w-40 h-16 bg-emerald-950/40 border border-emerald-500/50 rounded-full font-black text-emerald-400 flex items-center justify-center gap-2"><Zap size={16}/> RAISE</button></>
            ) : (
              <div className="flex items-center gap-10 px-24 py-7 bg-black/40 rounded-full border border-white/10">
                <Target size={32} className="text-slate-700"/><span className="font-black uppercase text-[16px] tracking-[0.8em] text-slate-600">{phase === PHASES.IDLE ? "DEALING..." : "WAITING"}</span>
              </div>
            )}
          </div>
        </div>
      </footer>
      <style dangerouslySetInnerHTML={{ __html: `input[type=range].gold-slider { -webkit-appearance: none; background: transparent; width: 100%; } input[type=range].gold-slider::-webkit-slider-runnable-track { height: 4px; background: #fbbf24; border-radius: 4px; } input[type=range].gold-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 38px; width: 38px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 30px #fbbf24, inset 0 0 10px rgba(255,255,255,0.8); cursor: pointer; margin-top: -17px; }`}} />
    </div>
  );
};

export default App;
