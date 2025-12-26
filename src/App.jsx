import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from "socket.io-client";
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign
} from 'lucide-react';

// --- SOCKET CONFIG ---
// Replace the URL below with your actual Render URL (e.g., https://poker-server.onrender.com)
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? "https://your-poker-app.onrender.com" 
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

  return (
    <div style={{ left: `${pos.x}%`, top: `${pos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 transition-all duration-1000 ${player?.isFolded ? 'opacity-20 grayscale scale-95' : (dimPlayer ? 'opacity-50' : 'opacity-100')}`}>
      
      {/* Name Badge */}
      <div className={`flex items-center gap-2 p-1 px-5 rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl transition-all duration-500 relative ${isWinner && isShowdown ? 'border-yellow-400 shadow-[0_0_30px_rgba(251,191,36,0.8)] scale-110' : 'border-white/10'}`}>
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
                {player?.isDealer && <div className="w-3 h-3 bg-red-600 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.8)] animate-pulse" />}
                <span className="text-[9px] font-black text-white leading-none uppercase tracking-widest">{String(player?.name || "Player")}</span>
            </div>
            <span className={`text-[10px] font-mono font-black mt-0.5 transition-all duration-500 ${isWinner && isShowdown ? 'text-emerald-400 animate-pulse scale-125' : 'text-emerald-500/80'}`}>${Number(player?.chips || 0)}</span>
        </div>
      </div>

      {/* Cards: Positioned BELOW for Hero, kept at 1.8x original scale */}
      {player?.hand?.length > 0 && !player.isFolded && (
        <div className={`flex items-end pointer-events-none transition-all duration-1000 mt-4 overflow-visible justify-center relative w-full h-16`}>
          {(player.hand || []).map((c, ci) => {
            const isWinningCard = winning5Ids.includes(c.id);
            const handSize = player.hand.length;
            const fanOffset = isHero ? (ci - (handSize - 1) / 2) * 45 : (ci * -12);
            
            return (
              <div key={ci} 
                className={`w-10 h-14 rounded-[6px] border-none flex flex-col items-start justify-start p-1.5 text-[8px] font-bold transition-all duration-700 absolute
                ${showCards ? 'bg-white text-slate-950 shadow-2xl' : 'bg-slate-900 border border-white/10'} 
                ${isWinningCard && isShowdown ? 'scale-[1.25] z-[500] border-yellow-400' : ''}`} 
                style={{ 
                  transform: `translateX(${fanOffset}px) scale(${isHero ? 1.8 : 1})`, 
                  zIndex: isWinningCard ? 700 : ci,
                  top: '0px',
                  transformOrigin: 'top center'
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
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [winningPlayerIndex, setWinningPlayerIndex] = useState(-1); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [logs, setLogs] = useState([]);
  
  const hasProcessedShowdown = useRef(false);
  const timerRef = useRef(null);
  const autoResetTimer = useRef(null);

  const isShowdown = useMemo(() => phase === PHASES.SHOWDOWN, [phase]);
  const heroSeatIdx = useMemo(() => players.findIndex(p => p?.userId === LOCAL_USER_ID), [players]);
  const userSeat = useMemo(() => players.find(p => p?.userId === LOCAL_USER_ID), [players]);
  const actualPotAmount = useMemo(() => (potData || []).reduce((acc, p) => acc + (p?.amount || 0), 0), [potData]);
  const currentPotOnTable = useMemo(() => actualPotAmount + (players || []).reduce((s, p) => s + (p?.currentBet || 0), 0), [actualPotAmount, players]);
  const seatedCount = useMemo(() => (players || []).filter(p => p && p.isSeated).length, [players]);
  const isHeroTurn = useMemo(() => activeIdx !== -1 && heroSeatIdx !== -1 && activeIdx === heroSeatIdx && phase !== PHASES.IDLE && !isShowdown, [activeIdx, heroSeatIdx, phase, isShowdown]);
  const minRaiseTo = useMemo(() => highestBet + lastRaiseAmt, [highestBet, lastRaiseAmt]);
  const maxAllIn = useMemo(() => userSeat?.chips || 0, [userSeat]);

  // Production-Ready Logging
  const addLog = useCallback((data) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logEntry = { 
      id: Date.now() + Math.random(), 
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
    if (!hand || hand.length === 0 || board.length < 3) return { power: 0, hand: [], name: "Evaluating..." };
    const subsets = getCombinations([...hand, ...board], 5);
    let best = { power: -1, name: "High Card", hand: [] };
    subsets.forEach(c => { 
        const r = rankFiveCardHand(c); 
        if (r.power > best.power) { best = { ...r, hand: c }; } 
    });
    return best;
  }, []);

  const handleDeal = useCallback(() => {
    if (seatedCount < 2) return;
    hasProcessedShowdown.current = false;
    setCommunity([]);
    setPotData([{ label: 'MAIN', amount: 0, eligible: [] }]);
    setLastRaiseAmt(BLINDS.bb);
    setPhase(PHASES.PRE_FLOP);
    const variantChoice = VARIANTS[pendingVariantId];
    setActiveVariant(variantChoice);
    
    const fullDeck = SUITS.flatMap(s => VALUES.map(v => ({suit: s, value: v, rank: VALUE_MAP[v], id: v+s}))).sort(() => Math.random() - 0.5);
    let nextPlayers = players.map(p => p ? { ...p, hand: [], currentBet: 0, totalContributed: 0, isFolded: false, acted: false, isWinner: false, handResult: null } : p);
    const dIdx = nextPlayers.findIndex(p => p?.isDealer);
    let sbIdx = getNextSeatedPlayer(dIdx, nextPlayers);
    let bbIdx = getNextSeatedPlayer(sbIdx, nextPlayers);
    nextPlayers[sbIdx].chips -= BLINDS.sb; nextPlayers[sbIdx].currentBet = BLINDS.sb;
    nextPlayers[bbIdx].chips -= BLINDS.bb; nextPlayers[bbIdx].currentBet = BLINDS.bb;
    const cardMap = nextPlayers.map(p => p ? fullDeck.splice(0, variantChoice.holeCards) : []);
    setPlayers(nextPlayers.map((p, i) => p ? { ...p, hand: cardMap[i] } : p));
    setDeck(fullDeck); setHighestBet(BLINDS.bb); setPotData([{ label: 'MAIN', amount: 60, eligible: [] }]); setActiveIdx(getNextSeatedPlayer(bbIdx, nextPlayers));
  }, [players, seatedCount, getNextSeatedPlayer, pendingVariantId]);

  const handleAction = useCallback((type, amt = 0) => {
    const player = players[activeIdx];
    if (!player) return;
    let nextPlayers = [...players];
    if (type === 'FOLD') nextPlayers[activeIdx].isFolded = true;
    if (type === 'CALL' || type === 'CHECK') {
      const callVal = Math.min(player.chips, highestBet - player.currentBet);
      nextPlayers[activeIdx].currentBet += callVal; nextPlayers[activeIdx].chips -= callVal;
    }
    if (type === 'RAISE') {
      const additional = Math.min(player.chips, amt - player.currentBet);
      nextPlayers[activeIdx].chips -= additional; nextPlayers[activeIdx].currentBet = player.currentBet + additional;
      setHighestBet(nextPlayers[activeIdx].currentBet);
    }
    nextPlayers[activeIdx].acted = true;
    const totalActive = nextPlayers.filter(p => p && p.isSeated && !p.isFolded);
    if (totalActive.every(p => p.acted && (p.currentBet === highestBet || p.chips === 0))) {
        setPotData(prev => [{ ...prev[0], amount: prev[0].amount + nextPlayers.reduce((sum, p) => sum + (p?.currentBet || 0), 0) }]);
        setPlayers(nextPlayers.map(p => p ? { ...p, currentBet: 0, acted: false } : null));
        setHighestBet(0);
        if (phase === PHASES.PRE_FLOP) { setPhase(PHASES.FLOP); setCommunity(deck.slice(0, 3)); setDeck(deck.slice(3)); }
        else if (phase === PHASES.FLOP) { setPhase(PHASES.TURN); setCommunity([...community, deck[0]]); setDeck(deck.slice(1)); }
        else if (phase === PHASES.TURN) { setPhase(PHASES.RIVER); setCommunity([...community, deck[0]]); setDeck(deck.slice(1)); }
        else setPhase(PHASES.SHOWDOWN);
    } else { setPlayers(nextPlayers); setActiveIdx(getNextSeatedPlayer(activeIdx, nextPlayers)); }
  }, [activeIdx, players, highestBet, phase, deck, community, getNextSeatedPlayer]);

  useEffect(() => { 
    if (phase === PHASES.IDLE && seatedCount >= 2) { 
      const dealDelay = setTimeout(() => handleDeal(), 1000); return () => clearTimeout(dealDelay); 
    } 
  }, [phase, seatedCount, handleDeal]);

  // Handle Socket Events for Production
  useEffect(() => {
    socket.on("connect", () => addLog({ action: "SYNCED TO ARENA", type: 'system' }));
    return () => socket.off("connect");
  }, [addLog]);

  return (
    <div className="h-screen bg-[#05070a] text-white font-sans flex flex-col overflow-hidden relative">
      <header className="h-16 bg-black/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8 z-[1000]">
        <div className="flex items-center gap-6">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400"><ChevronLeft className={sidebarOpen ? 'rotate-0' : 'rotate-180'} /></button>
          <div className="flex flex-col"><h1 className="text-[10px] font-black tracking-[0.3em] mb-1">DEALER'S CHOICE</h1><span className="text-[8px] text-yellow-500 font-black">{activeVariant.name}</span></div>
        </div>
        <div className="flex items-center gap-4">
          <select value={pendingVariantId} onChange={(e) => setPendingVariantId(e.target.value)} className="bg-transparent text-yellow-500 text-[10px] font-black uppercase outline-none border-none cursor-pointer">
            {Object.entries(VARIANTS).map(([k, v]) => <option key={k} value={k} className="bg-slate-900">{v.name}</option>)}
          </select>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-[#0f172a]/95 border-r border-white/5 transition-all duration-300 overflow-hidden z-[6000]`}>
          <div className="p-6 space-y-4">
            <button onClick={() => { const emptyIdx = players.findIndex(p => p === null); if (emptyIdx !== -1) { setPlayers(prev => prev.map((p, i) => i === emptyIdx ? { id: emptyIdx, userId: `bot_${Math.random()}`, name: BOT_NAMES[emptyIdx % 10], isBot: true, chips: 2000, hand: [], currentBet: 0, totalContributed: 0, isFolded: false, isSeated: true, acted: false, joinedAt: Date.now(), handResult: null } : p)); } }} className="w-full flex items-center gap-3 bg-indigo-600/10 border border-indigo-500/20 p-4 rounded-xl text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/20"><UserPlus size={16}/> Add Bot</button>
            <button onClick={() => { setPlayers(INITIAL_PLAYERS); setPhase(PHASES.IDLE); setCommunity([]); setPotData([{label:'MAIN', amount:0, eligible:[]}]); }} className="w-full flex items-center gap-3 bg-red-950/20 border border-red-500/30 p-4 rounded-xl text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-950/40"><Trash2 size={16}/> Clear Arena</button>
          </div>
        </aside>

        <main className="flex-1 relative flex items-center justify-center pt-16">
          <div className="relative w-[92%] h-[45vh] aspect-[4.1/1] -mt-[180px]">
            <div className="absolute inset-0 rounded-[300px] border-[16px] border-slate-900 bg-emerald-950/5 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] overflow-hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
               <div className="flex items-center gap-12"><div className="text-[54px] font-black text-yellow-400 font-mono">${actualPotAmount}</div><div className="flex gap-2">{community.map((c, i) => (<div key={i} className="w-10 h-14 bg-white rounded-md flex flex-col items-center justify-center text-slate-950 font-bold shadow-xl border-2"><span className="text-xs">{c.value}</span><span className={`text-4xl ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span></div>))}</div></div>
            </div>
            {players.map((p, i) => (<Seat key={i} player={p} index={i} phase={phase} dealStaggerIndex={dealStaggerIndex} winning5Ids={winning5Ids} />))}
          </div>
        </main>
      </div>

      <div className="fixed bottom-10 left-5 w-[300px] h-[200px] bg-black/40 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 overflow-hidden z-[2000]">
          <div className="text-slate-400 uppercase font-black text-[9px] mb-4 border-b border-white/10 pb-2 flex gap-2"><Info size={12}/> Intelligence Feed</div>
          <div className="font-mono text-[9px] space-y-2 overflow-y-auto pr-2 scrollbar-hide h-full">{logs.map((l) => (<div key={l.id} className="border-b border-white/5 pb-1 opacity-70"><span className="text-slate-500 mr-2">[{l.time}]</span><span className="text-cyan-400 font-black">{l.name} </span>{l.action}</div>))}</div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 flex justify-center pb-8 z-[5000] pointer-events-none">
        <div className="flex flex-col items-center pointer-events-auto">
          {userSeat && !userSeat.isFolded && phase !== PHASES.IDLE && (<div className="px-6 py-2 mb-6 bg-purple-600 border border-purple-400 rounded-full text-[10px] font-black uppercase shadow-xl">{evaluateBestHandSync(userSeat.hand, community, activeVariant).name}</div>)}
          {isHeroTurn ? (
            <div className="flex flex-col items-center gap-6 bg-black/40 backdrop-blur-3xl p-8 rounded-[40px] border border-white/10">
              <div className="flex items-center gap-6 w-full max-w-lg"><div className="text-2xl font-black text-[#fbbf24] font-mono w-24">${raiseAmount}</div><input type="range" min={minRaiseTo} max={maxAllIn} step="10" value={raiseAmount} onChange={(e) => setRaiseAmount(Number(e.target.value))} className="gold-slider flex-1" /></div>
              <div className="flex gap-4">
                <button onClick={() => handleAction('FOLD')} className="w-40 h-16 bg-red-950/40 border border-red-500/50 rounded-full font-black text-red-400">FOLD</button>
                <button onClick={() => handleAction('CALL')} className="w-72 h-16 bg-blue-950/40 border border-blue-500/50 rounded-full font-black text-blue-400 uppercase">{highestBet > userSeat.currentBet ? 'CALL' : 'CHECK'}</button>
                <button onClick={() => handleAction('RAISE', raiseAmount)} className="w-40 h-16 bg-emerald-950/40 border border-emerald-500/50 rounded-full font-black text-emerald-400 uppercase">RAISE</button>
              </div>
            </div>
          ) : (<div className="h-20 w-[400px] bg-black/40 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center gap-6 opacity-60"><Target size={28} className="text-slate-600" /><span className="text-[14px] font-black uppercase tracking-[0.6em] text-slate-500">{phase === PHASES.IDLE ? "WAITING" : "ACTIVE"}</span></div>)}
        </div>
      </footer>
      <div className="fixed bottom-4 right-6 text-[8px] font-mono text-white/20">v58.1</div>
      <style dangerouslySetInnerHTML={{ __html: `input[type=range].gold-slider { -webkit-appearance: none; background: transparent; width: 100%; } input[type=range].gold-slider::-webkit-slider-runnable-track { height: 4px; background: #fbbf24; border-radius: 4px; } input[type=range].gold-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 32px; width: 32px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 20px #fbbf24; cursor: pointer; margin-top: -14px; }` }} />
    </div>
  );
};

export default App;
