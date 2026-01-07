import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer as TimerIcon, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare, Clock, BarChart3, Settings, Maximize, Minimize, Copy, Check, Activity, BookOpen
} from 'lucide-react';
import io from 'socket.io-client';

const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { 
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000 
});

const VERSION = "v2.1.35-PRO";
const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const LANDSCAPE_POSITIONS = [
  { x: 50, y: 99 }, { x: 10, y: 85 }, { x: 1,  y: 50 }, { x: 10, y: 15 }, { x: 30, y: 1  },
  { x: 50, y: -1 }, { x: 70, y: 1  }, { x: 90, y: 15 }, { x: 99, y: 50 }, { x: 90, y: 85 }
];

const PORTRAIT_POSITIONS = [
  { x: 50, y: 99 }, { x: 12, y: 90 }, { x: 0,  y: 65 }, { x: 0,  y: 35 }, { x: 12, y: 10 },
  { x: 50, y: 1  }, { x: 88, y: 10 }, { x: 100, y: 35 }, { x: 100, y: 65 }, { x: 88, y: 90 }
];

const BET_OFFSETS = [
  { x: 0, y: -160 },   { x: 100, y: -110 }, { x: 130, y: 0 },    { x: 100, y: 110 },  { x: 60, y: 130 },    
  { x: 0, y: 150 },    { x: -60, y: 130 },  { x: -100, y: 110 }, { x: -130, y: 0 },   { x: -100, y: -110 } 
];

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', rules: ["2 hole cards.", "Best 5-card hand wins."] }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA', rules: ["4 hole cards.", "Must use exactly 2 hole + 3 board cards."] }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', rules: ["3 hole cards.", "Standard high hand rankings."] }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', rules: ["Weakest hand wins.", "Ace is 1."] }, 
  HILOW: { id: 'HILOW', name: 'Hi-Low Split', rules: ["4 hole cards.", "Pot split between High and Low winners."] }, 
  REDSBLACKS: { id: 'REDSBLACKS', name: 'Reds & Blacks', rules: ["4 hole cards.", "Joker formed by color mix."] }
};

const formatHandStrength = (str, currentPhase, variantId) => {
  if (currentPhase === PHASES.PRE_FLOP) return 'Pre-flop';
  if (!str) return '';
  const val = String(str);
  if (val === 'Analysing...' || val === '---') return val;
  if (val.toUpperCase() === "UNCONTESTED") return 'Pre-flop';
  
  let s = val.toUpperCase();
  if (variantId === 'MUFLIS' && s.includes("HIGH CARD")) {
    return s.replace("HIGH CARD ", "") + " HIGH";
  }
  if (s.includes("FIVE OF A KIND")) return "5 of a KIND";
  if (s.includes("STRAIGHT FLUSH")) return "STR FLUSH";
  if (s.includes("FOUR OF A KIND")) return "4 of a KIND";
  if (s.includes("FULL HOUSE")) return "FULL HOUSE";
  if (s.includes("FLUSH")) return "FLUSH";
  if (s.includes("STRAIGHT")) return "STRAIGHT";
  if (s.includes("THREE OF A KIND")) return "3 of a KIND";
  if (s.includes("TWO PAIR")) return "2 PAIR";
  if (s.includes("PAIR")) return "PAIR";
  if (s.includes("HIGH CARD")) return "HIGH";
  if (s.includes("LOW")) return "LOW"; 
  return s;
};

const Confetti = ({ active }) => {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-[1000] overflow-hidden">
      {[...Array(25)].map((_, i) => (
        <div key={i} className="confetti-particle" style={{
          left: `${Math.random() * 100}%`,
          backgroundColor: ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#ffffff'][i % 5],
          animationDelay: `${Math.random() * 100}%`,
          animationDuration: `${2 + Math.random() * 2}s`
        }} />
      ))}
    </div>
  );
};

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  isDealer, isHero, relativeIdx, visuals, timeRemaining, currentWinnerUid, pots
}) => {
    if (!player || !displayPos) return null;
    
    const isShowdown = phase === PHASES.SHOWDOWN;
    const shouldRevealCards = isHero || (isShowdown && !player.isFolded);
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };

    const currentCardScale = isHero 
      ? visuals.heroCardScale 
      : (isShowdown && !player.isFolded ? visuals.oppCardScale * 1.6 : visuals.oppCardScale);

    const xMultiplier = isHero ? 2.2 : 1.1;
    const timerRadius = 50;
    const timerCircumference = 2 * Math.PI * timerRadius;
    const turnLimit = 22; 
    const strokeDashoffset = timerCircumference - (Math.max(0, timeRemaining / turnLimit) * timerCircumference);

    return (
        <div 
          style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} 
          className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 
            ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'}
            ${isShowdown && !player.isFolded ? 'z-50' : ''}`}
        >
            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-1000 ${isCollectingBets ? 'animate-fling-to-pot' : 'animate-bet-entry'}`}
                    style={{ transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y + visuals.betY}px) scale(${visuals.betScale})`, left: '50%', top: '50%' }}>
                    <div className="relative flex flex-col items-center">
                      {/* REDESIGNED CHIP STACK: Much larger and professional */}
                      <div className="flex -space-x-4 mb-[-12px]">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} 
                            className="w-14 h-14 rounded-full border-2 border-black/40 shadow-2xl relative overflow-hidden" 
                            style={{ 
                              backgroundColor: i === 0 ? '#1e293b' : (i === 1 ? '#94a3b8' : '#64748b'),
                              transform: `translateY(${i * -4}px) rotateX(45deg)`,
                              zIndex: 10 - i,
                              boxShadow: '0 8px 12px -2px rgba(0,0,0,0.6), inset 0 3px 6px rgba(255,255,255,0.3)'
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-30">
                              <div className="w-10 h-10 rounded-full border-4 border-dashed border-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* REDESIGNED LABEL: Large text, glass effect */}
                      <div className="relative z-10 bg-slate-900/95 backdrop-blur-2xl text-white font-black text-[14px] md:text-lg px-5 py-2 rounded-xl shadow-[0_15px_35px_rgba(0,0,0,0.6)] border border-white/20 flex items-center gap-2 whitespace-nowrap overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
                          <span className="text-emerald-400 font-mono font-bold">$</span>
                          <span className="font-mono tracking-tighter">{Number(player.currentBet).toFixed(2)}</span>
                      </div>
                    </div>
                </div>
            )}

            <div style={{ transform: `translateY(${visuals.badgeY}px)` }} className="relative z-50">
                {isActiveTurn && (
                  <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] -rotate-90 pointer-events-none overflow-visible z-[-1]">
                    <circle cx="50%" cy="50%" r="48%" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                    <circle cx="50%" cy="50%" r="48%" fill="none" stroke={timeRemaining < 6 ? "#ef4444" : "#10b981"} strokeWidth="4"
                      strokeDasharray={`${timerCircumference} ${timerCircumference}`} style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s linear' }} strokeLinecap="round"
                    />
                  </svg>
                )}

                <div className={`relative flex flex-col items-center p-2 rounded-xl border bg-slate-900/95 backdrop-blur-md transition-all duration-300 min-w-[84px] md:min-w-[180px] shadow-2xl
                  ${isActiveTurn ? 'border-white/40 ring-1 ring-white/20 scale-105 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'border-white/10'} 
                  ${(isShowdown && player.uid === currentWinnerUid) ? 'border-yellow-400 ring-4 ring-yellow-400/40 scale-110' : ''}`}
                >
                    {isDealer && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white animate-pulse z-[110]" />}
                    <div className="flex flex-col items-center gap-0 w-full text-center">
                        <div className="flex items-center gap-1 mb-0.5 max-w-full text-white/70">
                          {player.isBot && <Bot size={10} className="text-indigo-400" />}
                          <span className="text-[8.5px] md:text-[14.5px] font-black uppercase truncate">{String(player.name || "Anon")}</span>
                        </div>
                        <span className={`text-[14px] md:text-[22px] font-mono font-black leading-none ${player.chips <= 1 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                          ${Number(player.chips).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </span>
                    </div>
                </div>
            </div>

            {player.hand && !player.isFolded && !player.waitingForNextHand && (
                <div className="relative z-10 flex items-center justify-center w-[12vw] h-[6vw] mt-4">
                    {player.hand.map((c, ci) => {
                        const fanRotation = (ci - (player.hand.length - 1) / 2) * visuals.holeCardFan;
                        const isRedSuit = c.suit === '♥' || c.suit === '♦';
                        const isWinCard = (isShowdown && winning5Ids.includes(c.id));

                        return (
                          <div key={c.id || ci} 
                              className={`w-[5vw] md:w-[3vw] h-[7vw] md:h-[5vw] rounded-[3px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-500 ${shouldRevealCards ? 'bg-white text-black' : 'bg-slate-800'} ${isWinCard ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_50px_#fbbf24]' : 'border-white/20'}`} 
                              style={{ transform: `translateX(${(ci - (player.hand.length-1)/2) * xMultiplier}vw) rotate(${fanRotation}deg) scale(${currentCardScale})`, transformOrigin: 'bottom center', top: `${isHero ? visuals.heroCardY : -31}px` }}>
                              {shouldRevealCards && ( 
                                <>
                                  <span className={`text-[8px] md:text-[11px] font-black leading-none ${isRedSuit ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span>
                                  <span className={`text-[7px] md:text-[13px] leading-none ${isRedSuit ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                                </> 
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
  // --- 1. STATE & HOOKS ---
  const [currentView, setCurrentView] = useState(VIEWS.LOGIN);
  const [adminTab, setAdminTab] = useState(ADMIN_TABS.PLAYERS);
  const [userProfile, setUserProfile] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [community, setCommunity] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dealerIdx, setDealerIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(22); 
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState([]);
  const [currentShowdownIdx, setCurrentShowdownIdx] = useState(0);
  const [showVisualControls, setShowVisualControls] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [expandedHands, setExpandedHands] = useState(new Set()); 
  const [copySuccess, setCopySuccess] = useState(false);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [showBanner, setShowBanner] = useState(false); 
  const [queuedAction, setQueuedAction] = useState(null);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 100, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10 });
  const [pots, setPots] = useState([]); 
  const [visuals, setVisuals] = useState({
    heroCardScale: 4.5, heroCardY: 0, oppCardScale: 1.0, oppCardY: -31,
    commCardScale: 4.0, commCardY: 5, betScale: 6.5, betY: 215, // INCREASED DEFAULT SCALE
    badgeY: 85, footerHeight: 260, tableZoom: 0.6, holeCardFan: 32
  });

  // --- 2. DERIVED VALUES ---
  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => p && p.uid === userProfile.uid);
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => (heroIdx !== -1 ? players[heroIdx] : null), [players, heroIdx]);
  const currentWinner = useMemo(() => (showdownWinners && showdownWinners.length > 0 ? showdownWinners[currentShowdownIdx] : null), [showdownWinners, currentShowdownIdx]);
  const totalDisplayPot = useMemo(() => potAmount + players.reduce((acc, p) => acc + (p?.currentBet || 0), 0), [potAmount, players]);

  const isBrokeStatus = useMemo(() => {
    if (!heroPlayerObj) return false;
    const chips = Number(heroPlayerObj.chips);
    const bet = Number(heroPlayerObj.currentBet);
    return chips <= 1 && bet <= 0 && phase === PHASES.IDLE;
  }, [heroPlayerObj, phase]);

  const groupedLogs = useMemo(() => {
    const hands = [];
    let currentHand = { id: 'init-hand', actions: [], summaries: [], variantName: 'Standard', isOngoing: true, winnerSummary: "In Progress..." };
    logs.forEach((log) => {
      const actRaw = String(log.action || '').toUpperCase();
      const isHandStart = log.name === 'SYSTEM' && (actRaw.includes('IS DEALING') || actRaw.includes('HAND START'));
      if (isHandStart) {
        if (currentHand.actions.length > 0) {
          currentHand.isOngoing = false;
          currentHand.winnerSummary = currentHand.summaries.length > 0 ? currentHand.summaries.map(s => `${s.name} won ${s.amount}`).join('; ') : "Pot Swept";
          hands.push(currentHand);
        }
        currentHand = { id: log.id || Math.random(), actions: [log], summaries: [], variantName: 'Poker', isOngoing: true, winnerSummary: "Live actions..." };
      } else {
        currentHand.actions.push(log);
        if (log.type === 'win') {
          currentHand.summaries.push({ name: String(log.name || 'Unknown'), amount: log.action?.match(/\$(\d+\.?\d*)/)?.[0] || 'Pot' });
        }
      }
    });
    if (currentHand.actions.length > 0) hands.push(currentHand);
    return hands.reverse();
  }, [logs]);

  // --- 3. HANDLERS ---
  const handleAction = useCallback((type, amt = 0) => {
    socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(amt || raiseInput) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleAllIn = useCallback(() => {
    if (!heroPlayerObj) return;
    const totalStack = Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet);
    handleAction('RAISE', totalStack);
  }, [heroPlayerObj, handleAction]);

  const handleLoginSubmit = useCallback(() => {
    const normalizedPassword = passwordInput.trim().toLowerCase();
    if (normalizedPassword === 'pass') {
      setUserProfile({ name: 'ADMIN', uid: 'admin_sys', role: 'admin', chips: 0 });
      setCurrentView(VIEWS.LOBBY);
      socket.emit('getInitialData');
    } else {
      socket.emit('playerLogin', { password: normalizedPassword });
    }
  }, [passwordInput]);

  const getBannerStyles = useCallback(() => {
    switch (activeVariant?.id) {
      case 'HOLDEM': return 'text-emerald-400 drop-shadow-md';
      case 'OMAHA': return 'text-fuchsia-500 drop-shadow-md';
      case 'MUFLIS': return 'text-cyan-300 drop-shadow-md';
      case 'HILOW': return 'text-amber-400 drop-shadow-md';
      case 'REDSBLACKS': return 'text-red-600 drop-shadow-md';
      default: return 'text-white/90 drop-shadow-md';
    }
  }, [activeVariant]);

  // --- 4. EFFECTS ---
  useEffect(() => {
    const handleResize = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
      if (portrait) {
        setVisuals({ tableZoom: 0.6, footerHeight: 260, heroCardScale: 4.5, heroCardY: 0, holeCardFan: 32, betScale: 6.5, betY: 215, commCardScale: 4.0, commCardY: 5, oppCardScale: 1.0, oppCardY: -31, badgeY: 85 });
      } else {
        setVisuals({ tableZoom: 0.85, footerHeight: 270, heroCardScale: 4.0, heroCardY: 22, holeCardFan: 25, betScale: 3.5, betY: 47, commCardScale: 1.8, commCardY: -7, oppCardScale: 1.0, oppCardY: -31, badgeY: 85 });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    socket.on('initialDataResponse', (data) => {
      if (data.rooms) setActiveTables(data.rooms);
      if (data.profiles) setAllProfiles(data.profiles);
    });
    socket.on('roomUpdate', (d) => {
        if (!d) return;
        setPlayers(() => { const next = Array(TOTAL_SEATS).fill(null); (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); return next; });
        setPhase(prev => { if (prev !== d.phase) setQueuedAction(null); return d.phase; });
        setCommunity(d.community || []); setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0);
        setActiveIdx(d.activeIdx ?? -1); setHighestBet(d.highestBet || 0); setDealerIdx(d.dealerIdx ?? -1); setTimeRemaining(d.timeRemaining || 0);
        setPots(d.pots || []); if (d.activeVariant) setActiveVariant(VARIANTS[d.activeVariant.id] || d.activeVariant);
        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true); setShowdownWinners(d.showdownWinners || []); setWinning5Ids(d.winning5Ids || []); setCurrentShowdownIdx(0);
            (d.showdownWinners || []).forEach((_, i) => setTimeout(() => setCurrentShowdownIdx(i), i * 7000));
            setTimeout(() => setPotTransferring(false), (d.showdownWinners || []).length * 7000);
        }
    });
    socket.on('loginSuccess', (p) => { setUserProfile(p); setCurrentView(VIEWS.LOBBY); });
    socket.on('log', (d) => setLogs(prev => [...prev, { ...d, id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }].slice(-100)));
    socket.emit('getInitialData');
    return () => { socket.off('roomUpdate'); socket.off('loginSuccess'); socket.off('log'); };
  }, []);

  useEffect(() => {
    if (activeIdx === heroIdx && queuedAction && phase !== PHASES.IDLE && heroIdx !== -1) {
      setTimeout(() => { handleAction(queuedAction); setQueuedAction(null); }, 500);
    }
  }, [activeIdx, heroIdx, queuedAction, phase, handleAction]);

  useEffect(() => {
    if (phase === PHASES.FLOP || phase === PHASES.TURN) {
      setTimeout(() => setShowBanner(true), 1500);
      setTimeout(() => setShowBanner(false), 3500);
    }
  }, [phase]);

  // --- 5. PAGE RENDERERS ---

  const renderLogin = () => (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white font-black uppercase">
        <div className="w-full max-w-[400px] p-8 md:p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8">
            <Lock size={32} className="text-[#fbbf24]" />
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLoginSubmit()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-xl font-black uppercase"/>
            <button onClick={handleLoginSubmit} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl font-black text-lg transition-transform uppercase">SIT AT TABLE</button>
        </div>
    </div>
  );

  const renderLobby = () => (
    <div className="h-screen bg-[#06080c] flex flex-col text-white font-black uppercase overflow-hidden">
        <header className="h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-5 md:px-12 bg-black/40 backdrop-blur-md shadow-xl shrink-0 pt-[env(safe-area-inset-top)]">
          <h2 className="tracking-[0.2em] md:tracking-[0.4em] text-xs md:text-xl flex items-center gap-2 md:gap-4 font-black"><LayoutGrid className="text-[#fbbf24] w-3 md:w-6"/> LOBBY</h2>
          <div className="flex items-center gap-3 md:gap-10 font-black">
            <div className="flex flex-col items-end"><span className="text-emerald-400 font-mono text-xs md:text-2xl tracking-tighter">${Number(userProfile?.chips || 0).toLocaleString()}</span></div>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={16}/></button>
          </div>
        </header>
        <main className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden">
          <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="flex-1 overflow-y-auto">
              {activeTables.map((t) => (
                <div key={t.id} className="flex p-4 md:p-6 items-center border-b border-white/5 hover:bg-[#fbbf24]/5 transition-all">
                  <div className="flex-1 text-xs md:text-xl text-white font-black uppercase">{String(t.name)}</div>
                  <button onClick={() => { socket.emit('joinRoom', { roomId: t.id, profile: userProfile, buyIn: 10 }, (res) => { if (res?.status === 'ok') { setCurrentRoomId(t.id); setCurrentView(VIEWS.GAME); } }); }} className="bg-emerald-600 text-white px-4 md:px-10 py-2 md:py-4 rounded-xl font-black shadow-lg uppercase">ENTER</button>
                </div>
              ))}
            </div>
          </div>
        </main>
    </div>
  );

  const renderGame = () => {
    const isSeekingAttention = phase === PHASES.FLOP || phase === PHASES.TURN;
    return (
      <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase">
        <header className="h-16 md:h-20 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-black/80 backdrop-blur-md z-[80] shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="w-[100px] md:w-[150px] flex justify-start">
            <div onClick={() => setShowRulesModal(true)} className={`relative px-3 py-2 rounded-2xl border transition-all duration-700 min-w-[100px] flex flex-col justify-center items-center overflow-hidden cursor-pointer ${isSeekingAttention ? 'bg-yellow-400/20 border-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.4)] ring-2 ring-yellow-400/20' : 'bg-slate-900 border-white/5'}`}>
              {isSeekingAttention && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-sweep pointer-events-none" />}
              <span className={`text-[7px] md:text-[8px] tracking-widest leading-none mb-1 ${isSeekingAttention ? 'text-yellow-400' : 'text-white/40'}`}>THIS HAND</span>
              <span className={`text-[10px] md:text-sm font-black truncate leading-none ${isSeekingAttention ? 'text-white scale-110' : 'text-white/90'}`}>{activeVariant?.name || 'HOLDEM'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => socket.emit('adminAddBot', { roomId: currentRoomId })} className="text-indigo-400 p-2.5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all"><Bot size={18}/></button>
            <button onClick={() => setIntelExpanded(!intelExpanded)} className={`p-2.5 rounded-2xl border border-white/5 transition-all ${intelExpanded ? 'bg-[#fbbf24] text-black' : 'bg-white/5 text-[#fbbf24]'}`}><Eye size={18}/></button>
            <button onClick={() => setShowVisualControls(true)} className="text-cyan-400 p-2.5 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all"><Settings size={18}/></button>
            <button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid }); setCurrentView(VIEWS.LOBBY);}} className="text-red-500 p-2.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"><LogOut size={18}/></button>
          </div>
          <div className="w-[140px] md:w-[180px] flex justify-end">
            <div className="relative bg-slate-800 border border-white/10 rounded-2xl flex items-center pl-3 pr-2 py-2 w-full max-w-[160px] hover:border-cyan-500/50 transition-all animate-dropdown-flash">
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-cyan-400 text-[7px] md:text-[8px] uppercase leading-none mb-1 tracking-wider whitespace-nowrap">ON MY DEAL:</span>
                <select value={pendingVariantId} onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile?.uid, pendingVariant: e.target.value}); }} className="bg-transparent text-white outline-none text-[9px] md:text-[11px] font-black uppercase appearance-none leading-tight w-full cursor-pointer pr-4">
                  {Object.entries(VARIANTS).map(([k,v]) => (<option key={k} value={k} className="bg-slate-900">{v.name}</option>))}
                </select>
              </div>
              <ChevronDown size={12} className="text-white/40 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </header>

        <main className="flex-1 relative flex items-center justify-center bg-emerald-950/10 overflow-hidden">
          {heroPlayerObj && phase !== PHASES.IDLE && (
            <div className="absolute inset-x-0 top-4 px-6 flex justify-between items-start pointer-events-none z-[70]">
              <div className="flex flex-col items-start min-w-[120px]">
                {activeVariant?.id === 'HILOW' && (
                  <>
                    <span className="text-[14px] md:text-[24px] font-black text-emerald-400 drop-shadow-md">{formatHandStrength(heroPlayerObj?.lowStrength, phase, activeVariant?.id)}</span>
                    <span className="text-amber-500 text-[10px] md:text-[18px] font-black">{phase === PHASES.PRE_FLOP ? '-' : Math.round(heroPlayerObj?.lowWinProbability || 0)}%</span>
                  </>
                )}
              </div>
              <div className="flex flex-col items-end min-w-[120px]">
                <span className="text-[14px] md:text-[24px] font-black text-purple-400 drop-shadow-md">{formatHandStrength(heroPlayerObj?.strength, phase, activeVariant?.id)}</span>
                <span className="text-amber-500 text-[10px] md:text-[18px] font-black">{phase === PHASES.PRE_FLOP ? '-' : Math.round(heroPlayerObj?.winProbability || 0)}%</span>
              </div>
            </div>
          )}
          <Confetti active={phase === PHASES.SHOWDOWN} />
          {showBanner && <div className="absolute inset-0 z-[600] flex items-center justify-center pointer-events-none animate-banner-pop"><div className={`text-[12vw] md:text-[8vw] font-black uppercase italic italic text-center ${getBannerStyles()}`}>{activeVariant?.name}</div></div>}
          <div style={{ transform: `scale(${visuals.tableZoom})` }} className={`relative w-full max-w-[1400px] z-10 flex items-center justify-center transition-all duration-500 ${isPortrait ? 'aspect-[10/16]' : 'aspect-[18/9]'}`}>
              <div className={`absolute inset-0 bg-[#0f3d2e]/40 border-[1.5vw] border-slate-900 shadow-[inset_0_0_10vw_rgba(0,0,0,0.8)] ${isPortrait ? 'rounded-[15vw]' : 'rounded-[50%]'}`} />
              <div className="absolute inset-0 z-20 pointer-events-none font-black">
                {players.map((p, i) => { if (!p) return null; const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; const pos = isPortrait ? PORTRAIT_POSITIONS[rIdx] : LANDSCAPE_POSITIONS[rIdx]; return (<Seat key={i} player={p} displayPos={pos} phase={phase} winning5Ids={(currentWinner && currentWinner.uid === p.uid) ? (currentWinner.hand || []).map(c => c.id) : []} currentWinnerUid={currentWinner?.uid} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} seatIdx={i} visuals={visuals} timeRemaining={timeRemaining} isCollectingBets={potTransferring} pots={pots} />); })}
              </div>
              <div className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center z-30 pointer-events-none ${isPortrait ? 'top-[42%]' : 'top-[48%] -translate-y-1/2'}`}>
                {pots.length > 0 && <div className="text-[6vw] font-black text-yellow-400 font-mono drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">${pots[0].amount.toFixed(2)}</div>}
                <div className={`flex gap-1 ${isPortrait ? 'mt-8 scale-125' : 'mt-6'}`} style={{ transform: `scale(${visuals.commCardScale}) translateY(${visuals.commCardY}px)` }}>
                  {community.map((c, j) => {
                    const isRed = c.suit === '♥' || c.suit === '♦';
                    const isWin = currentWinner && currentWinner.hand && currentWinner.hand.some(wc => wc.id === c.id);
                    return (<div key={c.id || j} className={`w-[3vw] h-[4.5vw] rounded-[2px] bg-white border flex flex-col items-center justify-center text-black transition-all ${isWin ? 'ring-2 ring-yellow-400 scale-125 shadow-[0_0_30px_#fbbf24]' : 'opacity-80'}`}><span className={`text-[1.1vw] font-black leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span><span className={`text-[2vw] leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></div>);
                  })}
                </div>
              </div>
          </div>
        </main>
        <footer style={{ height: visuals.footerHeight }} className="bg-black/95 border-t border-white/10 z-[100] px-2 md:p-8 flex flex-col items-center justify-start overflow-hidden shrink-0">
          {phase === PHASES.SHOWDOWN && currentWinner ? (
            <div key={currentShowdownIdx} className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-700">
              <div className="flex items-center gap-2 md:gap-4 text-yellow-400 text-[2.6vw] sm:text-lg md:text-4xl rank-shimmer font-black italic tracking-tighter uppercase text-center">
                <Trophy className="w-3 h-3 md:w-9 md:h-9" /> {String(currentWinner.name)} won with {formatHandStrength(currentWinner.rank, PHASES.SHOWDOWN, activeVariant?.id)} (${Number(currentWinner.amount).toFixed(2)})
              </div>
              <div className="flex gap-2 md:gap-4 px-4 py-6 justify-center">
                {(currentWinner.hand || []).map((c, ci) => (
                  <div key={ci} className={`w-14 h-20 md:w-24 md:h-36 bg-white rounded-lg flex flex-col items-center justify-center text-black shadow-2xl relative overflow-hidden shrink-0`}>
                    <span className={`text-lg md:text-2xl font-black absolute top-1 left-1.5 leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span>
                    <span className={`text-5xl md:text-7xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center w-full max-w-4xl mx-auto transition-all duration-500">
               {phase !== PHASES.IDLE && (
                 <div className="flex flex-col gap-1 md:gap-2 w-full mt-1.5">
                    <div className={`flex gap-1 w-full uppercase transition-all duration-500 ${activeIdx !== heroIdx ? 'opacity-20 pointer-events-none' : ''}`}>
                      <button onClick={()=>handleAction('RAISE', highestBet + Math.floor(totalDisplayPot * 0.5))} className="flex-1 h-7 md:h-10 bg-white/5 border border-white/10 rounded-lg text-[8px] md:text-xs font-black uppercase">1/2 POT</button>
                      <button onClick={()=>handleAction('RAISE', highestBet + totalDisplayPot)} className="flex-1 h-7 md:h-10 bg-white/5 border border-white/10 rounded-lg text-[8px] md:text-xs font-black uppercase">POT</button>
                      <button onClick={handleAllIn} className="flex-1 h-7 md:h-10 bg-red-900/40 border border-red-500/50 rounded-lg text-[8px] md:text-xs text-red-500 font-black uppercase">ALL-IN</button>
                    </div>
                    <div className="flex gap-1.5 md:gap-2 w-full">
                      <button onClick={() => activeIdx === heroIdx ? handleAction('FOLD') : setQueuedAction(queuedAction === 'FOLD' ? null : 'FOLD')} className={`flex-1 border-2 py-2.5 md:py-4 rounded-xl text-[10px] md:text-lg font-black uppercase transition-all ${activeIdx === heroIdx ? 'bg-red-950/80 border-red-500/50' : (queuedAction === 'FOLD' ? 'bg-red-600 border-white text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-red-950/20 border-red-500/20 text-red-500/50')}`}>FOLD {queuedAction === 'FOLD' && '✓'}</button>
                      <button onClick={() => activeIdx === heroIdx ? handleAction('CALL') : setQueuedAction(queuedAction === 'CALL' ? null : 'CALL')} className={`flex-1 border-2 py-2.5 md:py-4 rounded-xl text-[10px] md:text-lg font-black uppercase transition-all ${activeIdx === heroIdx ? 'bg-indigo-900/80 border-indigo-400/50' : (queuedAction === 'CALL' ? 'bg-indigo-600 border-white text-white shadow-[0_0_15px_rgba(129,140,248,0.5)]' : 'bg-indigo-950/20 border-indigo-400/20 text-indigo-400/50')}`}>{activeIdx === heroIdx ? (highestBet > (heroPlayerObj?.currentBet || 0) ? `CALL $${(highestBet - (heroPlayerObj?.currentBet || 0)).toFixed(2)}` : 'CHECK') : 'CHECK/CALL'} {queuedAction === 'CALL' && '✓'}</button>
                      <div className={`flex-[2] flex bg-black/60 border-2 border-white/20 rounded-xl overflow-hidden font-black transition-all ${activeIdx !== heroIdx ? 'opacity-20 pointer-events-none' : ''}`}>
                        <div className="flex items-center px-1.5 md:px-4 text-emerald-400 text-sm md:text-2xl font-mono">$</div>
                        <input type="number" step="0.25" value={raiseInput} onChange={(e) => setRaiseInput(Math.max(0, Number(e.target.value)))} className="w-full bg-transparent text-center text-sm md:text-3xl outline-none font-mono text-white p-1 md:p-2" />
                        <button onClick={() => handleAction('RAISE')} className="bg-emerald-600 px-3 md:px-8 text-[9px] md:text-xl uppercase hover:brightness-110 transition-all shadow-lg"><Zap size={14}/> RAISE</button>
                      </div>
                    </div>
                 </div>
               )}
               {phase === PHASES.IDLE && <div className="flex flex-col items-center gap-1 py-4 md:py-10 opacity-30"><Activity className="animate-pulse text-emerald-400" size={16} /><span className="text-xs md:text-xl italic tracking-[0.5em]">Waiting...</span></div>}
            </div>
          )}
        </footer>
      </div>
    );
  };

  const renderAdmin = () => (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white uppercase font-black pt-[env(safe-area-inset-top)]">
      <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-3 md:p-8 flex flex-row md:flex-col gap-2 md:gap-4 bg-black/20 shrink-0">
          <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[10px] font-black ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>PLAYERS</button>
          <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[10px] font-black ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>TABLES</button>
          <button onClick={()=>{ socket.emit('adminNuclearReset'); }} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl flex items-center justify-center bg-red-900 text-white font-black text-[10px]`}><Bomb size={14}/> NUCLEAR</button>
          <button onClick={()=>setCurrentView(VIEWS.LOBBY)} className="flex-1 md:flex-none p-2.5 md:p-4 rounded-xl bg-cyan-600 text-black font-black text-[10px]">LOBBY</button>
      </aside>
      <main className="flex-1 p-5 md:p-12 overflow-y-auto">
          {adminTab === ADMIN_TABS.PLAYERS ? (
              <div className="flex flex-col gap-8">
                  <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10">
                      <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm uppercase"/>
                      <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm uppercase"/>
                      <button onClick={()=>{ socket.emit('adminCreatePlayer', {...newPlayer, uid: Math.random().toString(36).slice(2)}); setNewPlayer({name:'', chips:100, password:''}); }} className="bg-[#fbbf24] text-black rounded-xl font-black p-3 text-sm">CREATE</button>
                  </div>
                  {allProfiles.map(p => (
                      <div key={p.uid} className="flex justify-between p-4 border-b border-white/5 items-center">
                          <span className="text-sm font-black text-white">{String(p.name)}</span>
                          <div className="flex gap-4 items-center">
                              <span className="text-emerald-400 font-mono font-black">${Number(p.chips || 0).toLocaleString()}</span>
                              <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500"><Trash2 size={14}/></button>
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              <div className="flex flex-col gap-8">
                  <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border border-white/10">
                      <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm uppercase"/>
                      <button onClick={()=>{ socket.emit('adminCreateRoom', {...newTable, id: 'room_' + Math.random().toString(36).slice(2, 9)}); }} className="bg-emerald-600 text-white rounded-xl font-black p-3 text-sm lg:col-span-3">SPAWN ARENA</button>
                  </div>
              </div>
          )}
      </main>
    </div>
  );

  // --- 6. MAIN RENDER ---
  const renderMain = () => {
    switch(currentView) {
      case VIEWS.LOGIN: return renderLogin();
      case VIEWS.LOBBY: return renderLobby();
      case VIEWS.GAME: return renderGame();
      case VIEWS.ADMIN: return renderAdmin();
      default: return renderLogin();
    }
  };

  return (
    <div className="h-screen w-full bg-[#06080c] relative">
      {renderMain()}
      
      {/* GLOBAL MODALS */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowRulesModal(false)}>
          <div className="w-full max-w-[600px] bg-slate-900 border-2 border-cyan-500/40 rounded-[2.5rem] p-8 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
              <h3 className="text-xl md:text-3xl text-cyan-400 font-black uppercase tracking-tight">{activeVariant?.name} Manual</h3>
              <button onClick={() => setShowRulesModal(false)} className="text-white/40 hover:text-white transition-colors p-2 bg-white/5 rounded-full"><X size={24}/></button>
            </div>
            <div className="space-y-6 max-h-[50vh] overflow-y-auto no-scrollbar">{(activeVariant?.rules || []).map((rule, idx) => (<p key={idx} className="text-sm md:text-lg text-white/80 font-black uppercase leading-tight">{rule}</p>))}</div>
            <button onClick={() => setShowRulesModal(false)} className="w-full mt-10 py-5 bg-cyan-600 text-black font-black uppercase rounded-2xl shadow-lg active:scale-95 transition-all">Acknowledge Rules</button>
          </div>
        </div>
      )}

      {showVisualControls && (
        <div className="fixed inset-0 z-[2000] bg-black/90 flex items-center justify-center p-6 backdrop-blur-lg">
          <div className="bg-slate-900 border-2 border-white/20 p-8 md:p-12 rounded-[3rem] w-full max-w-[1000px] h-[90vh] overflow-y-auto shadow-2xl relative no-scrollbar">
            <button onClick={() => setShowVisualControls(false)} className="absolute top-8 right-8 text-white/40 hover:text-white"><X size={32}/></button>
            <h3 className="text-2xl md:text-4xl mb-12 font-black italic text-[#fbbf24] uppercase border-b border-white/10 pb-4"><Settings2 size={40}/> Calibration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div>
                  <label className="text-emerald-400 uppercase text-[10px] font-black block mb-4">Table Zoom ({visuals.tableZoom})</label>
                  <input type="range" min="0.4" max="1.5" step="0.05" value={visuals.tableZoom} onChange={(e) => setVisuals({...visuals, tableZoom: Number(e.target.value)})} className="w-full h-2 bg-white/10 rounded-full appearance-none accent-emerald-500" />
                </div>
                <div>
                  <label className="text-indigo-400 uppercase text-[10px] font-black block mb-4">HUD Height ({visuals.footerHeight}px)</label>
                  <input type="range" min="150" max="600" step="10" value={visuals.footerHeight} onChange={(e) => setVisuals({...visuals, footerHeight: Number(e.target.value)})} className="w-full h-2 bg-white/10 rounded-full appearance-none accent-indigo-500" />
                </div>
                <div>
                  <label className="text-fuchsia-400 uppercase text-[10px] font-black block mb-4">Opponent Scale ({visuals.oppCardScale})</label>
                  <input type="range" min="0.1" max="4.0" step="0.1" value={visuals.oppCardScale} onChange={(e) => setVisuals({...visuals, oppCardScale: Number(e.target.value)})} className="w-full h-2 bg-white/10 rounded-full appearance-none accent-fuchsia-500" />
                </div>
              </div>
              <div className="space-y-8">
                <div>
                  <label className="text-purple-400 uppercase text-[10px] font-black block mb-4">Hero Card Scale ({visuals.heroCardScale})</label>
                  <input type="range" min="1.0" max="10.0" step="0.1" value={visuals.heroCardScale} onChange={(e) => setVisuals({...visuals, heroCardScale: Number(e.target.value)})} className="w-full h-2 bg-white/10 rounded-full appearance-none accent-purple-500" />
                </div>
                <div>
                  <label className="text-amber-400 uppercase text-[10px] font-black block mb-4">Bet Label Scale ({visuals.betScale})</label>
                  <input type="range" min="0.5" max="8.0" step="0.1" value={visuals.betScale} onChange={(e) => setVisuals({...visuals, betScale: Number(e.target.value)})} className="w-full h-2 bg-white/10 rounded-full appearance-none accent-amber-500" />
                </div>
                <div>
                  <label className="text-cyan-400 uppercase text-[10px] font-black block mb-4">Board Card Scale ({visuals.commCardScale})</label>
                  <input type="range" min="1.0" max="10.0" step="0.1" value={visuals.commCardScale} onChange={(e) => setVisuals({...visuals, commCardScale: Number(e.target.value)})} className="w-full h-2 bg-white/10 rounded-full appearance-none accent-cyan-500" />
                </div>
              </div>
            </div>
            <button onClick={() => setShowVisualControls(false)} className="w-full bg-emerald-600 py-6 rounded-2xl font-black text-xl mt-12 hover:brightness-110 shadow-xl transition-all">ACCEPT CHANGES</button>
          </div>
        </div>
      )}

      {intelExpanded && (
        <div onClick={() => setIntelExpanded(false)} className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-md p-6 pt-[100px] flex flex-col gap-4 animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[950px] mx-auto bg-slate-900/95 border border-white/10 rounded-3xl p-6 flex flex-col flex-1 overflow-hidden shadow-2xl mb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-2"><Eye className="text-[#fbbf24]" size={20} /><h3 className="text-xl text-[#fbbf24] font-black uppercase tracking-widest">Intelligence Access</h3></div>
                <button onClick={() => setIntelExpanded(false)} className="text-white/40 hover:text-white"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 font-mono no-scrollbar">
                {groupedLogs.map((hand) => (
                  <div key={hand.id} className="flex flex-col border border-white/5 rounded-2xl bg-black/40 overflow-hidden">
                    <button onClick={() => setExpandedHands(prev => { const n = new Set(prev); if(n.has(hand.id)) n.delete(hand.id); else n.add(hand.id); return n; })} className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10">
                      <div className="flex items-center gap-4">
                        <ChevronRight className={`transition-transform ${expandedHands.has(hand.id) ? 'rotate-90' : ''}`} size={14} />
                        <span className="text-[#fbbf24] text-xs font-black uppercase">Hand Event</span>
                        <span className="text-white/50 text-[10px] italic">{hand.winnerSummary}</span>
                      </div>
                    </button>
                    {expandedHands.has(hand.id) && (
                      <div className="p-4 space-y-2 bg-black/60 border-t border-white/5 text-[11px]">
                        {hand.actions.map((l, i) => (
                          <div key={i} className="flex gap-4"><span className="text-white/20 shrink-0 w-10">{l.time}</span><span className="font-black text-white/70">{String(l.name)}:</span><span className="flex-1 text-white/50">{String(l.action)}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dropdown-flash {
          0%, 80%, 100% { border-color: rgba(255, 255, 255, 0.1); box-shadow: 0 0 0 rgba(6, 182, 212, 0); }
          90% { border-color: #06b6d4; box-shadow: 0 0 20px rgba(6, 182, 212, 0.4); }
        }
        .animate-dropdown-flash { animation: dropdown-flash 4s infinite; }
        @keyframes shimmer-sweep {
          0% { transform: translateX(-100%) rotate(45deg); opacity: 0; }
          30% { opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateX(300%) rotate(45deg); opacity: 0; }
        }
        .animate-shimmer-sweep { animation: shimmer-sweep 2.5s infinite linear; }
        @keyframes bet-entry {
          0% { transform: translate(-50%, -40%) scale(0.8); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        .animate-bet-entry { animation: bet-entry 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
        @keyframes fling-to-pot {
          0% { transform: translate(-50%, -50%) scale(1); }
          100% { transform: translate(-50%, -300px) scale(0); opacity: 0; }
        }
        .animate-fling-to-pot { animation: fling-to-pot 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        .rank-shimmer { background: linear-gradient(90deg, #fbbf24 0%, #fff 40%, #fff 60%, #fbbf24 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 2.5s linear infinite; font-weight: 900; }
        @keyframes shimmer { to { background-position: 200% center; } }
        .confetti-particle { position: absolute; width: 8px; height: 8px; top: -10px; animation: fall linear forwards; border-radius: 2px; }
        @keyframes fall { 0% { transform: translateY(0vh) rotate(0deg); } 100% { transform: translateY(110vh) rotate(720deg); } }
        @keyframes banner-pop { 0% { transform: scale(0.5); opacity: 0; filter: blur(20px); } 100% { transform: scale(1); opacity: 1; filter: blur(0px); } }
        .animate-banner-pop { animation: banner-pop 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        html, body { overscroll-behavior-y: contain; height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
      `}</style>
    </div>
  );
};

export default App;
