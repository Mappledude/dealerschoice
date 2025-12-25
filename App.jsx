import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign
} from 'lucide-react';

// --- MULTIPLAYER CONNECTION TIER ---
const SOCKET_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001' 
  : 'https://poker-server-3vin.onrender.com';

// TASK 1: Robust Production Socket Initialization
// Render free tier requires polling fallback and long timeouts (60s) to handle spin-up
const socket = io(SOCKET_URL, { 
  transports: ["polling", "websocket"],
  timeout: 60000, 
  reconnection: true,
  reconnectionAttempts: Infinity,
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
  { x: 50, y: 92 }, { x: 6,  y: 68 }, { x: 4,  y: 39 }, 
  { x: 12, y: 20 }, { x: 30, y: 10 }, { x: 50, y: 8 }, 
  { x: 70, y: 10 }, { x: 88, y: 20 }, { x: 96, y: 39 }, { x: 94, y: 68 }  
];

const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const INITIAL_PLAYERS = Array.from({ length: TOTAL_SEATS }, (_, i) => 
  i === 0 ? {
    id: 0, userId: LOCAL_USER_ID, name: "Hero", isBot: false, chips: 2000, 
    hand: [], currentBet: 0, totalContributed: 0, isFolded: false, 
    isAdmin: true, isDealer: true, isSeated: true, acted: false,
    handResult: null, variantId: 'HOLDEM'
  } : null
);

// --- UTILS ---
const getCombinations = (arr, k) => {
  const result = [];
  const helper = (start, combo) => {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]); helper(i + 1, combo); combo.pop();
    }
  };
  helper(0, []); return result;
};

const rankFiveCardHand = (cards) => {
  if (!cards || cards.length < 5) return { power: 0, name: "Evaluating..." };
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
  return { power: score * 1000000 + (firstRank * 1000) + (uniqueRanks[1] || 0), name, hand: cards.slice(0, 5) };
};

// --- SUB-COMPONENTS ---
const Seat = ({ player, index, phase, dealStaggerIndex, winning5Ids }) => {
  if (!player) return null;
  const pos = SEAT_POSITIONS[index];
  const isHero = player?.userId === LOCAL_USER_ID;
  const isShowdown = phase === PHASES.SHOWDOWN;
  const showCards = isHero || isShowdown;
  const isWinner = player.isWinner;
  if (isHero && !isShowdown) return null;

  return (
    <div style={{ left: `${pos.x}%`, top: `${pos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 transition-all duration-1000 ${player?.isFolded ? 'opacity-20 grayscale' : (isShowdown && !isWinner ? 'opacity-50' : 'opacity-100')}`}>
      {isWinner && isShowdown && <div className="absolute inset-[-30px] rounded-full bg-yellow-500/10 blur-[40px] animate-pulse ring-4 ring-yellow-400/20" />}
      {!isHero && player?.hand?.length > 0 && !player.isFolded && (
        <div className="flex items-end pointer-events-none transition-all duration-1000 mb-[-12px] overflow-visible">
          {(player.hand || []).map((c, ci) => {
            const isWinningCard = winning5Ids.includes(c.id);
            // TASK 5: Compace Opponent Scale (0.85x)
            return (
              <div key={ci} className={`w-10 h-14 rounded-[6px] border-none flex flex-col items-start justify-start p-1 text-[10px] font-bold shadow-2xl transition-all duration-500 ${showCards ? 'bg-white text-slate-950' : 'bg-slate-900 border border-white/10'} ${dealStaggerIndex >= ci ? 'opacity-100' : 'opacity-0'} ${isWinningCard ? 'drop-shadow-[0_0_20px_rgba(250,204,21,1)] border-2 border-yellow-400' : ''}`} style={{ transform: `translateX(${ci * -12}px) scale(${isShowdown ? (isWinningCard ? 1.105 : 0.85) : 0.85})`, zIndex: isWinningCard ? 700 : ci }}>
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
      <div className={`flex items-center gap-2 p-1 px-5 rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl transition-all duration-500 relative ${isWinner && isShowdown ? 'border-yellow-400 scale-110' : 'border-white/10'}`}>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            {player?.isDealer && <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />}
            <span className="text-[9px] font-black text-white leading-none uppercase tracking-widest">{String(player?.name)}</span>
          </div>
          <span className={`text-[10px] font-mono font-black mt-0.5 ${isWinner && isShowdown ? 'text-emerald-400 animate-pulse' : 'text-emerald-500/80'}`}>${Number(player?.chips)}</span>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  // 1. REFS (Top of scope declaration)
  const hasProcessedShowdown = useRef(false);
  const timerRef = useRef(null);
  const autoResetTimer = useRef(null);

  // 2. STATE
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [potData, setPotData] = useState([{ label: 'MAIN', amount: 0 }]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [lastRaiseAmt, setLastRaiseAmt] = useState(BLINDS.bb);
  const [deck, setDeck] = useState([]);
  const [dealStaggerIndex, setDealStaggerIndex] = useState(-1);
  const [countdown, setCountdown] = useState(null);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [winningPlayerIndex, setWinningPlayerIndex] = useState(-1); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [potMovingWinnerIdx, setPotMovingWinnerIdx] = useState(-1);
  const [isConnected, setIsConnected] = useState(socket.connected);

  // 3. TASK 1: CONSOLE DIAGNOSTICS
  useEffect(() => {
    console.log("-----------------------------------------");
    console.log("DEALER'S CHOICE POKER: Connection Heartbeat");
    console.log("Target Server:", SOCKET_URL);

    const onConnect = () => {
      console.log("✅ SUCCESS: Linked to Render server:", socket.id);
      setIsConnected(true);
    };

    const onDisconnect = () => {
      console.log("❌ ALERT: Disconnected from Render backend.");
      setIsConnected(false);
    };

    const onError = (err) => {
      console.error("🔥 CONNECTION_ERROR:", err.message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
    };
  }, []);

  // 4. DERIVED STATE
  const isShowdown = useMemo(() => phase === PHASES.SHOWDOWN, [phase]);
  const userSeat = useMemo(() => players.find(p => p?.userId === LOCAL_USER_ID), [players]);
  const actualPotAmount = useMemo(() => (potData || []).reduce((acc, p) => acc + (p?.amount || 0), 0), [potData]);
  const currentPotOnTable = useMemo(() => actualPotAmount + (players || []).reduce((s, p) => s + (p?.currentBet || 0), 0), [actualPotAmount, players]);
  const seatedCount = useMemo(() => (players || []).filter(p => p && p.isSeated).length, [players]);
  const isHeroTurn = useMemo(() => activeIdx !== -1 && players[activeIdx]?.userId === LOCAL_USER_ID && phase !== PHASES.IDLE && !isShowdown, [activeIdx, players, phase, isShowdown]);
  const minRaiseTo = useMemo(() => highestBet + lastRaiseAmt, [highestBet, lastRaiseAmt]);
  const maxAllIn = useMemo(() => userSeat?.chips || 0, [userSeat]);

  // 5. ENGINE HELPERS
  const addLog = useCallback((data) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLogs(prev => [{ 
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(), 
      time: String(timestamp), 
      name: String(data.name || "System"), 
      action: String(data.action || ""), 
      amount: data.amount ? String(data.amount) : null, 
      type: String(data.type || 'info') 
    }, ...prev].slice(0, 50));
  }, []);

  const getNextSeatedPlayer = useCallback((startIndex, list = players) => {
    for (let i = 1; i <= TOTAL_SEATS; i++) {
      const idx = (startIndex + i) % TOTAL_SEATS;
      const p = list[idx];
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
        subsets.forEach(combo => { 
            const r = rankFiveCardHand(combo); 
            if (r.power > best.power) { best = { ...r, hand: combo }; } 
        });
        return best;
    }
  }, []);

  const handleDeal = useCallback(() => {
    if (seatedCount < 2) return;
    hasProcessedShowdown.current = false;
    setCommunity([]); setPotData([{ label: 'MAIN', amount: 0 }]); setLastRaiseAmt(BLINDS.bb);
    setWinning5Ids([]); setWinningPlayerIndex(-1); setPotMovingWinnerIdx(-1);
    
    let dIdx = players.findIndex(p => p?.isDealer && p.isSeated);
    if (dIdx === -1) dIdx = 0;

    const variantChoice = VARIANTS[pendingVariantId];
    setActiveVariant(variantChoice);

    setTimeout(() => {
      const suitsList = ['♠','♣','♥','♦'];
      const deckFull = suitsList.flatMap(s => VALUES.map(v => ({suit:s, value:v, rank:VALUE_MAP[v], id:v+s}))).sort(() => Math.random() - 0.5);
      
      let nextPlayers = players.map(p => p ? { ...p, hand: [], currentBet: 0, totalContributed: 0, isFolded: false, acted: false, winner: false, isWinner: false, handResult: null } : p);
      let sbIdx = getNextSeatedPlayer(dIdx, nextPlayers);
      let bbIdx = getNextSeatedPlayer(sbIdx, nextPlayers);
      let utgIdx = getNextSeatedPlayer(bbIdx, nextPlayers);
      
      nextPlayers[sbIdx].chips -= BLINDS.sb; nextPlayers[sbIdx].currentBet = BLINDS.sb;
      nextPlayers[bbIdx].chips -= BLINDS.bb; nextPlayers[bbIdx].currentBet = BLINDS.bb;
      
      nextPlayers.forEach((p, i) => { if(p) p.hand = deckFull.splice(0, variantChoice.holeCards); });
      setPlayers(nextPlayers); setDeck(deckFull); setHighestBet(BLINDS.bb); setPotData([{ label: 'MAIN', amount: 60 }]); 
      setPhase(PHASES.PRE_FLOP); setActiveIdx(utgIdx);
      Array.from({ length: variantChoice.holeCards }).forEach((_, i) => setTimeout(() => setDealStaggerIndex(i), i * 200));
    }, 1000);
  }, [players, seatedCount, getNextSeatedPlayer, pendingVariantId]);

  const handleAction = useCallback((type, amt = 0) => {
    const player = players[activeIdx];
    if (!player) return;
    let nextPlayers = [...players];
    if (type === 'FOLD') { nextPlayers[activeIdx].isFolded = true; addLog({ name: player.name, action: "FOLDED" }); }
    if (type === 'CALL') {
      const callVal = Math.min(player.chips, highestBet - player.currentBet);
      nextPlayers[activeIdx].currentBet += callVal; nextPlayers[activeIdx].chips -= callVal;
    }
    if (type === 'RAISE') {
      const add = Math.min(player.chips, amt - player.currentBet);
      nextPlayers[activeIdx].currentBet += add; nextPlayers[activeIdx].chips -= add;
      setHighestBet(nextPlayers[activeIdx].currentBet);
    }
    nextPlayers[activeIdx].acted = true;
    const activeOnes = nextPlayers.filter(p => p && p.isSeated && !p.isFolded);
    if (activeOnes.every(p => p.acted && (p.currentBet === highestBet || p.chips === 0))) {
      setTimeout(() => {
        const roundPot = nextPlayers.reduce((sum, p) => sum + (p?.currentBet || 0), 0);
        setPotData(prev => [{ ...prev[0], amount: prev[0].amount + roundPot }]);
        setPlayers(nextPlayers.map(p => p ? { ...p, currentBet: 0, acted: false } : null));
        setHighestBet(0); 
        if (phase === PHASES.PRE_FLOP) { setCommunity(deck.splice(0, 3)); setPhase(PHASES.FLOP); }
        else if (phase === PHASES.FLOP) { setCommunity(prev => [...prev, ...deck.splice(0, 1)]); setPhase(PHASES.TURN); }
        else if (phase === PHASES.TURN) { setCommunity(prev => [...prev, ...deck.splice(0, 1)]); setPhase(PHASES.RIVER); }
        else { setPhase(PHASES.SHOWDOWN); }
        setActiveIdx(getNextSeatedPlayer(players.findIndex(p => p?.isDealer)));
      }, 800);
    } else { setPlayers(nextPlayers); setActiveIdx(getNextSeatedPlayer(activeIdx, nextPlayers)); }
  }, [activeIdx, phase, highestBet, deck, players, getNextSeatedPlayer, addLog]);

  // 6. HEARTBEAT ENGINE
  useEffect(() => { 
    if (phase === PHASES.IDLE && seatedCount >= 2 && isConnected) { 
      const t = setTimeout(handleDeal, 1000); 
      return () => clearTimeout(t); 
    } 
  }, [phase, seatedCount, handleDeal, isConnected]);

  // TASK 3 & 4: Economy & Showdown
  useEffect(() => {
    if (isShowdown && !hasProcessedShowdown.current) {
      hasProcessedShowdown.current = true;
      const isMuflis = activeVariant.id === 'MUFLIS';
      const evaluated = players.map(p => (!p || !p.isSeated || p.isFolded) ? p : { ...p, handResult: evaluateBestHandSync(p.hand, community, activeVariant) });
      const winners = evaluated.filter(p => p && !p.isFolded && p.isSeated).sort((a,b) => isMuflis ? a.handResult.power - b.handResult.power : b.handResult.power - a.handResult.power);
      
      if (winners.length > 0) {
        const winner = winners[0]; const winIdx = players.findIndex(p => p?.userId === winner.userId);
        setWinning5Ids(winner.handResult.hand.map(c => c.id)); setWinningPlayerIndex(winIdx);
        setPotMovingWinnerIdx(winIdx);
        addLog({ name: String(winner.name), action: `WINNER: ${winner.name} - ${winner.handResult.name.toUpperCase()} ($${actualPotAmount})`, type: 'win' });
        setTimeout(() => setPlayers(prev => prev.map((p, i) => i === winIdx ? { ...p, chips: p.chips + actualPotAmount, isWinner: true } : p)), 1200);
      }
      setCountdown(6);
    }
  }, [isShowdown, actualPotAmount, players, community, activeVariant, evaluateBestHandSync, addLog]);

  useEffect(() => {
    if (countdown !== null) {
      if (countdown > 0) { 
        autoResetTimer.current = setTimeout(() => setCountdown(countdown - 1), 1000); 
      } else { 
        setCountdown(null); setWinning5Ids([]); setWinningPlayerIndex(-1); setPhase(PHASES.IDLE); 
        setPlayers(prev => prev.map(p => p ? { ...p, isDealer: false, isWinner: false } : null)); handleDeal(); 
      }
    }
    return () => { if (autoResetTimer.current) clearTimeout(autoResetTimer.current); };
  }, [countdown, handleDeal]);

  const getCurrentStrength = useCallback((p) => {
    if (!p || p.isFolded || !p.hand || p.hand.length === 0) return null;
    const res = evaluateBestHandSync(p.hand, community, activeVariant);
    return String(res.name);
  }, [community, activeVariant, evaluateBestHandSync]);

  return (
    <div className="h-screen bg-[#06080c] text-white font-sans flex flex-col overflow-hidden relative selection:bg-cyan-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a202c_0%,_#06080c_100%)] pointer-events-none" />
      
      {/* Broadcast Header */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-[30px] border-b border-white/10 flex items-center justify-between px-10 z-[1000] shadow-xl">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition-all active:scale-90"><ChevronLeft size={22} className={sidebarOpen ? 'rotate-0' : 'rotate-180'} /></button>
          <div className="flex flex-col text-left"><h1 className="text-xs font-black uppercase tracking-[0.5em] text-white leading-tight">DEALER'S CHOICE</h1><span className="text-[7px] text-cyan-400 font-bold uppercase tracking-[0.6em] opacity-80">Render Sync V56.4</span></div>
        </div>
        <div className="flex-1 flex justify-center gap-12 items-baseline opacity-80">
           <div className="flex gap-10 items-baseline">
               <div className="flex flex-col items-center"><span className="text-[7px] font-black uppercase tracking-widest text-slate-500">Win Prob.</span><span className="text-sm font-black font-mono text-emerald-400 italic leading-none">64%</span></div>
               <div className="flex flex-col items-center"><span className="text-[7px] font-black uppercase tracking-widest text-slate-500">Hand Rank</span><span className="text-sm font-black font-mono text-cyan-400 italic leading-none">TOP 15%</span></div>
               <div className="flex flex-col items-center"><span className="text-[7px] font-black uppercase tracking-widest text-slate-500">Draw %</span><span className="text-sm font-black font-mono text-yellow-400 italic leading-none">12.4%</span></div>
           </div>
        </div>
        <div className="flex flex-col items-end w-56 relative items-baseline">
           <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Variant</span>
           <select value={pendingVariantId} onChange={(e) => setPendingVariantId(e.target.value)} className="bg-transparent text-[#fbbf24] font-black text-[11px] uppercase outline-none cursor-pointer text-right">
               {Object.entries(VARIANTS).map(([k, v]) => <option key={k} value={k} className="bg-slate-900">{v.name}</option>)}
           </select>
        </div>
      </header>

      {/* Arena Area */}
      <div className="flex-1 flex overflow-hidden relative pt-16">
        <aside className={`${sidebarOpen ? 'w-[15vw] min-w-[240px]' : 'w-0'} bg-[#0f172a]/95 backdrop-blur-[25px] border-r border-white/5 transition-all duration-500 flex flex-col overflow-hidden z-[6000]`}>
          <div className="flex-1 overflow-y-auto p-4 pt-10 space-y-8">
            <section className="text-left">
              <div className="mb-4 border-b border-white/10 pb-2 uppercase font-black text-[10px] text-slate-400">Admin Controls</div>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => { const emptyIdx = players.findIndex(p => p === null); if (emptyIdx !== -1) { const botName = BOT_NAMES[emptyIdx]; const newBot = { id: emptyIdx, userId: `bot_${Math.random()}`, name: String(botName), isBot: true, chips: 2000, hand: [], currentBet: 0, totalContributed: 0, isFolded: false, isSeated: true, acted: false, handResult: null }; setPlayers(prev => prev.map((p, i) => i === emptyIdx ? newBot : p)); addLog({ name: String(botName), action: "entered arena", type: 'join' }); } }} className="bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 p-4 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-600/20 transition-all"><UserPlus size={16}/> Add Bot</button>
                <button onClick={() => setPlayers(INITIAL_PLAYERS)} className="bg-red-950/20 border border-red-500/30 text-red-400 p-4 rounded-xl font-black text-[10px] uppercase hover:bg-red-950/40 transition-all"><Trash2 size={16}/> Clear Arena</button>
              </div>
            </section>
          </div>
        </aside>

        <main className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ isolation: 'isolate' }}>
          <div className="relative w-[92%] h-[45vh] aspect-[4.1/1] flex items-center justify-center p-12 -mt-[280px]">
            <div className="absolute inset-0 bg-emerald-950/5 rounded-[300px] border-[22px] border-slate-900 shadow-[inset_0_0_120px_rgba(245,158,11,0.25),inset_0_0_200px_rgba(0,0,0,0.95),0_0_100px_rgba(0,0,0,0.8)] overflow-hidden" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-3 z-[30] w-[600px] items-center justify-center -mt-[10px]">
              {/* Community Cards */}
              <div className="flex gap-3 mt-4">
                {(community || []).map((c, i) => {
                  const isWinningCard = winning5Ids.includes(c.id);
                  return (
                    <div key={i} className={`w-10 h-14 rounded-[6px] border-none flex flex-col items-center justify-center font-bold text-slate-950 transition-all duration-500 brightness-125 ${isWinningCard ? 'drop-shadow-[0_0_20px_rgba(250,204,21,1)] scale-[2.2] z-[500] border-2 border-yellow-400 bg-white' : (isShowdown ? 'opacity-20 scale-[1.3] bg-white' : 'scale-[1.7] bg-white shadow-[2px_2px_5px_rgba(0,0,0,0.5),_inset_0_0_0_1px_rgba(0,0,0,0.1)]')}`}>
                      <span className="text-[14px] leading-none mb-1 opacity-60 font-black">{c.value}</span>
                      <span className={`text-4xl ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span>
                    </div>
                  );
                })}
              </div>
              
              {/* Pot Physics */}
              {!isShowdown || potMovingWinnerIdx !== -1 ? (
                <div 
                  className={`absolute flex items-center gap-3 transition-all duration-[1200ms] ease-in-out ${potMovingWinnerIdx !== -1 ? 'scale-50 opacity-0 pointer-events-none' : 'animate-in fade-in zoom-in'}`} 
                  style={{ 
                    left: potMovingWinnerIdx !== -1 ? `${SEAT_POSITIONS[potMovingWinnerIdx].x}%` : 'calc(100%+20px)', 
                    top: potMovingWinnerIdx !== -1 ? `${SEAT_POSITIONS[potMovingWinnerIdx].y}%` : '50%', 
                    transform: potMovingWinnerIdx !== -1 ? 'translate(-50%, -50%)' : 'translateY(-50%)' 
                  }}
                >
                  <Coins size={32} className="text-yellow-400" />
                  <div className="flex flex-col"><span className="text-[9px] font-black uppercase text-white/40">Pot</span><span className="text-4xl font-black font-mono text-yellow-400">${actualPotAmount}</span></div>
                </div>
              ) : null}
            </div>
            <div className="absolute inset-0 pointer-events-none z-20">{(players || []).map((p, i) => (<Seat key={i} player={p} index={i} phase={phase} dealStaggerIndex={dealStaggerIndex} winning5Ids={winning5Ids} />))}</div>
          </div>
        </main>
      </div>

      {/* Hero Cockpit */}
      <footer className={`fixed bottom-0 left-0 right-0 z-[5000] flex flex-col items-center pb-[20px] pointer-events-none transition-all duration-1000 ${isShowdown && !userSeat?.isWinner ? 'opacity-40' : 'opacity-100'}`}>
        <div className="w-full max-w-[1600px] flex flex-col items-center relative h-fit overflow-visible">
          
          {/* TIER 1: The Crown */}
          {userSeat && (
            <div className={`mb-[15px] z-[6000] transform -translate-y-[15px] transition-all duration-500 pointer-events-auto flex flex-col items-center p-1 px-5 rounded-full border-2 bg-black/95 backdrop-blur-xl border-white/10 shadow-2xl`}>
              <div className="flex items-center gap-2 font-black text-white uppercase tracking-widest text-[9px]">{String(userSeat.name)}</div>
              <span className={`text-[10px] font-mono font-black transition-all duration-300 ${userSeat.isWinner && isShowdown ? 'text-emerald-400 animate-bounce scale-125' : 'text-emerald-500/80'}`}>${Number(userSeat.chips)}</span>
            </div>
          )}

          {/* TASK 2: The Navy Void (60px Gap) */}
          <div className="h-[60px]" /> 

          {/* TIER 2: Hole Cards (Sovereign Fan) */}
          {userSeat && !userSeat.isFolded && phase !== PHASES.IDLE && (
            <div className="mb-[15px] flex items-center justify-center pointer-events-auto h-24 relative overflow-visible">
              <div className="relative flex items-center justify-center z-[50]">
                {(userSeat.hand || []).map((c, ci) => {
                  const isWinningCard = winning5Ids.includes(c.id);
                  const fanOffset = (ci - (userSeat.hand.length - 1) / 2) * 50;
                  return (
                    <div key={ci} className={`w-10 h-14 bg-gradient-to-br from-white via-white to-slate-50 rounded-[6px] flex flex-col items-start justify-start p-1.5 text-[8px] font-bold shadow-2xl transition-all duration-1000 brightness-125`} style={{ position:'absolute', zIndex:isWinningCard?700:(100+ci), left:'0', transform: `translateX(${fanOffset}px) scale(${isShowdown ? (isWinningCard?2.34:1.8) : 1.8})`, transformOrigin:'bottom center', bottom:'10px', filter:isShowdown && !isWinningCard ? 'grayscale(0.5) brightness(0.6) opacity(0.2)' : 'none', boxShadow:isWinningCard?'0 0 20px rgba(250,204,21,1)':'none' }}>
                      <span className="text-[11px] font-black leading-none text-slate-950">{c.value}</span><span className={`text-[15px] -mt-1 leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-950'}`}>{c.suit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TIER 3: Hand Strength Bubble (15px gap below cards) */}
          {userSeat && !userSeat.isFolded && phase !== PHASES.IDLE && getCurrentStrength(userSeat) && (
            <div className="mb-[15px] px-6 py-2 text-white font-black text-[9px] uppercase rounded-full border shadow-2xl animate-in fade-in bg-indigo-600/90 border-indigo-300/30">
              {String(getCurrentStrength(userSeat))}
            </div>
          )}

          {/* Interaction Deck */}
          <div className="flex flex-col items-center gap-[10px] pointer-events-auto w-[440px] mb-[20px]">
            {isHeroTurn && (
              <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
                <div className="flex gap-4 justify-center mb-[10px]">
                  <button onClick={() => setRaiseAmount(Math.min(maxAllIn, Math.floor(currentPotOnTable * 0.5 + highestBet)))} className="px-7 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-slate-300 hover:bg-white/10">1/2 POT</button>
                  <button onClick={() => setRaiseAmount(Math.min(maxAllIn, Math.floor(currentPotOnTable + highestBet)))} className="px-7 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-[#fbbf24] hover:bg-white/10">POT</button>
                  <button onClick={() => setRaiseAmount(maxAllIn)} className="px-7 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-red-500 hover:bg-white/10">MAX</button>
                </div>
                <div className="w-full flex items-center gap-5 relative"><div className="absolute left-[-60px] text-[#fbbf24] font-black font-mono text-2xl">${raiseAmount}</div><input type="range" min={minRaiseTo} max={maxAllIn} step="10" value={raiseAmount} onChange={(e) => setRaiseAmount(Number(e.target.value))} className="gold-slider flex-1" /></div>
              </div>
            )}
          </div>

          <div className="flex justify-center items-center gap-6 mt-2 mb-[10px] pointer-events-auto scale-[0.85] z-[9999]">
            {isHeroTurn ? (
              <><button onClick={() => handleAction('FOLD')} className="w-40 h-16 bg-red-950/40 border border-red-500/50 rounded-full font-black text-[12px] text-red-400 hover:scale-105">FOLD</button><button onClick={() => handleAction('CALL')} className="w-72 h-16 bg-blue-950/40 border border-blue-500/50 rounded-full font-black text-[13px] text-blue-400 hover:scale-105">CALL / CHECK</button><button onClick={() => handleAction('RAISE', raiseAmount)} className="w-40 h-16 bg-emerald-950/40 border border-red-500/50 rounded-full font-black text-[12px] text-emerald-400 hover:scale-105 flex items-center justify-center gap-2 transition-all shadow-lg"><Zap size={16}/> RAISE</button></>
            ) : (
              <div className="flex justify-center items-center gap-10 px-24 py-7 bg-black/40 backdrop-blur-3xl rounded-full border border-white/10 shadow-2xl">
                <Target size={32} className={`text-slate-700 ${phase === PHASES.IDLE && seatedCount >= 2 ? 'text-[#22d3ee] animate-pulse' : ''}`}/>
                <span className={`font-black uppercase text-[16px] tracking-[0.8em] ${!isConnected ? 'text-red-400 italic' : (phase === PHASES.IDLE && seatedCount >= 2) ? 'text-[#22d3ee] animate-pulse' : 'text-slate-600'}`}>
                  {/* TASK 1: Dynamic Connection Status Indicator */}
                  {!isConnected ? "CONNECTING TO ARENA..." : isShowdown ? "WINNER REVEAL" : (phase === PHASES.IDLE && seatedCount >= 2) ? "DEALING HAND..." : "WAITING"}
                </span>
              </div>
            )}
          </div>
        </div>
      </footer>
      <style dangerouslySetInnerHTML={{ __html: `input[type=range].gold-slider { -webkit-appearance: none; background: transparent; width: 100%; } input[type=range].gold-slider::-webkit-slider-runnable-track { height: 4px; background: #fbbf24; border-radius: 4px; } input[type=range].gold-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 38px; width: 38px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 30px #fbbf24, inset 0 0 10px rgba(255,255,255,0.8); cursor: pointer; margin-top: -17px; transition: all 0.2s; } .scrollbar-hide::-webkit-scrollbar { display: none; }`}} />
    </div>
  );
};

export default App;
