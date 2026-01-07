import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare, Clock, BarChart3, Settings, Maximize, Minimize, Copy, Check, Activity, BookOpen
} from 'lucide-react';
import io from 'socket.io-client';

const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { 
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000 
});

const VERSION = "v2.0.9-PRO";
const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const DISPLAY_POSITIONS = [
  { x: 50, y: 92 }, { x: 15, y: 82 }, { x: 6,  y: 45 }, { x: 12, y: 12 }, { x: 30, y: 3  },
  { x: 50, y: 1  }, { x: 70, y: 3  }, { x: 88, y: 12 }, { x: 94, y: 45 }, { x: 85, y: 82 }
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

const INTEL_COLORS = [
  'text-emerald-400', 'text-fuchsia-400', 'text-sky-400', 
  'text-amber-400', 'text-rose-400', 'text-indigo-400', 
  'text-cyan-400', 'text-orange-400', 'text-lime-400', 
  'text-violet-400', 'text-teal-400'
];

const getPlayerIntelColor = (name) => {
  if (!name || name === 'SYSTEM') return 'text-white/60';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return INTEL_COLORS[Math.abs(hash) % INTEL_COLORS.length];
};

const Confetti = ({ active }) => {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-[1000] overflow-hidden">
      {[...Array(25)].map((_, i) => (
        <div key={i} className="confetti-particle" style={{
          left: `${Math.random() * 100}%`,
          backgroundColor: ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#ffffff'][i % 5],
          animationDelay: `${Math.random() * 2}s`,
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
    const isWinner = isShowdown && player.uid === currentWinnerUid;
    const shouldRevealCards = isHero || (isShowdown && !player.isFolded);
    
    const activePot = pots?.find(p => p.amount > 0); 
    const isPotEligible = isShowdown ? activePot?.eligibleUids?.includes(player.uid) : true;
    const isLosingAtShowdown = isShowdown && !isWinner && !player.isFolded && currentWinnerUid;
    
    const currentCardScale = isHero ? visuals.heroCardScale : visuals.oppCardScale;
    const currentCardY = isHero ? visuals.heroCardY : visuals.oppCardY;
    const stackCount = Math.min(6, Math.max(1, Math.ceil(player.currentBet / 15)));
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };

    return (
        <div 
          style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} 
          className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 
            ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'} 
            ${(isLosingAtShowdown || !isPotEligible) ? 'opacity-40 grayscale-[0.7] scale-95' : ''}
            ${isActiveTurn && timeRemaining < 5 ? 'animate-panic-pulse' : ''}`}
        >
            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-700 ${isCollectingBets ? 'animate-fling-to-pot' : 'animate-bet-splash'}`}
                    style={{ 
                      transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y + visuals.betY}px) scale(${visuals.betScale})`, 
                      left: '50%', top: '50%' 
                    }}>
                    <div className="relative flex flex-col items-center">
                      <div className="flex -space-x-1 mb-[-4px]">
                        {[...Array(stackCount)].map((_, i) => (
                          <div key={i} className="w-3 h-3 bg-amber-500 rounded-full border border-black/30 shadow-sm" style={{ transform: `translateY(${i * -1.5}px)` }} />
                        ))}
                      </div>
                      <div className="relative z-10 bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-black text-[9px] md:text-[11px] px-2 py-0.5 rounded-full shadow-xl border border-white/40 flex items-center gap-1 whitespace-nowrap">
                          <Coins size={8} /> ${String(player.currentBet)}
                      </div>
                    </div>
                </div>
            )}

            <div 
                style={{ transform: `translateY(${visuals.badgeY}px)` }}
                className={`relative z-50 flex flex-col items-center p-2 rounded-xl border bg-slate-900/95 backdrop-blur-md transition-all duration-300 min-w-[84px] md:min-w-[180px] shadow-2xl
                  ${isActiveTurn ? 'border-white/30 ring-2 ring-white/10 scale-105' : 'border-white/10'} 
                  ${isWinner ? 'border-yellow-400 ring-4 ring-yellow-400/40 scale-110' : ''}`}
            >
                {isDealer && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white animate-pulse z-[110]" />}
                <div className="flex flex-col items-center gap-0 w-full">
                    <div className="flex items-center gap-1">
                      {player.isBot && <Bot size={10} className="text-indigo-400" />}
                      <span className="text-[8.5px] md:text-[14.5px] font-black text-white/90 uppercase truncate">{String(player.name || "Anon")}</span>
                    </div>
                    <span className={`text-[11px] md:text-[17px] font-mono font-black ${player.chips <= 1 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>${Number(player.chips).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
            </div>

            {player.hand && Array.isArray(player.hand) && !player.isFolded && !player.waitingForNextHand && (
                <div className="relative z-10 flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible">
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const offset = ci - mid;
                        const fanRotation = offset * visuals.holeCardFan;
                        const isRedSuit = c.suit === '♥' || c.suit === '♦';
                        const suitColor = isRedSuit ? 'text-red-600' : 'text-black';
                        const isWinnerCard = isWinner && winning5Ids.includes(c.id);

                        return (
                          <div key={c.id || ci} 
                              className={`w-[5vw] md:w-[3vw] h-[7vw] md:h-[5vw] rounded-[3px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-500 ${shouldRevealCards ? 'bg-white text-black' : 'bg-slate-800'} ${isWinnerCard ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_50px_#fbbf24]' : 'border-white/20'}`} 
                              style={{ 
                                transform: `translateX(${offset * 2.2}vw) rotate(${fanRotation}deg) scale(${currentCardScale})`, 
                                transformOrigin: 'bottom center', 
                                top: `${currentCardY}px` 
                              }}>
                              {shouldRevealCards && ( 
                                <>
                                  <span className={`text-[8px] md:text-[11px] font-black leading-none ${suitColor}`}>{String(c.value)}</span>
                                  <span className={`text-[7px] md:text-[13px] leading-none ${suitColor}`}>{String(c.suit)}</span>
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
  const [timeRemaining, setTimeRemaining] = useState(15); 
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
  const [isConnected, setIsConnected] = useState(false);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [showBanner, setShowBanner] = useState(false); 

  const [pots, setPots] = useState([]); 

  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 100, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10 });

  const [visuals, setVisuals] = useState({
    heroCardScale: 4.0, heroCardY: 22, oppCardScale: 1.0, oppCardY: -31,
    commCardScale: 1.8, commCardY: -7, betScale: 2.0, betY: 47,
    badgeY: 85, footerHeight: 270, tableZoom: window.innerWidth < 768 ? 0.75 : 0.85, holeCardFan: 25
  });

  const logEndRef = useRef(null);
  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => p && p.uid === userProfile.uid);
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);
  const totalDisplayPot = useMemo(() => {
    const tableBets = players.reduce((acc, p) => acc + (p?.currentBet || 0), 0);
    return potAmount + tableBets;
  }, [potAmount, players]);

  const isBrokeStatus = useMemo(() => {
    if (!heroPlayerObj) return false;
    const isOutOfChips = Number(heroPlayerObj.chips) <= 1;
    const hasNoActiveBet = Number(heroPlayerObj.currentBet) <= 0;
    const isHandResolved = phase === PHASES.IDLE;
    return isOutOfChips && hasNoActiveBet && isHandResolved;
  }, [heroPlayerObj, phase]);

  const groupedLogs = useMemo(() => {
    const hands = [];
    let currentHand = { id: 'init-hand', actions: [], summaries: [], variantName: 'Standard', isOngoing: true, winnerSummary: "In Progress..." };
    logs.forEach((log) => {
      const actRaw = log.action.toUpperCase();
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
          currentHand.summaries.push({ name: log.name, amount: log.action.match(/\$(\d+\.?\d*)/)?.[0] || 'Pot' });
        }
      }
    });
    if (currentHand.actions.length > 0) hands.push(currentHand);
    return hands.reverse();
  }, [logs]);

  useEffect(() => {
    let startTimer;
    let endTimer;

    if (phase === PHASES.FLOP) {
      startTimer = setTimeout(() => {
        setShowBanner(true);
        endTimer = setTimeout(() => setShowBanner(false), 1500);
      }, 2000);
    } else {
      setShowBanner(false);
    }

    return () => {
      clearTimeout(startTimer);
      clearTimeout(endTimer);
    };
  }, [phase]);

  const getBannerStyles = () => {
    switch (activeVariant?.id) {
      case 'HOLDEM': return 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]';
      case 'OMAHA': return 'text-fuchsia-500 drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]';
      case 'MUFLIS': return 'text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]';
      case 'HILOW': return 'bg-gradient-to-b from-amber-400 via-slate-100 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]';
      case 'REDSBLACKS': return 'bg-gradient-to-r from-red-600 via-black to-red-600 bg-clip-text text-transparent animate-red-black-shift drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]';
      default: return 'text-white/90 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]';
    }
  };

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('initialDataResponse', (data) => {
      if (data.rooms) setActiveTables(data.rooms);
      if (data.profiles) setAllProfiles(data.profiles);
    });
    socket.on('roomUpdate', (d) => {
        if (!d) return;
        setPlayers(() => { 
          const next = Array(TOTAL_SEATS).fill(null); 
          (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
          return next; 
        });
        setPhase(d.phase);
        setCommunity(d.community || []);
        setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0);
        setActiveIdx(d.activeIdx ?? -1);
        setHighestBet(d.highestBet || 0);
        setDealerIdx(d.dealerIdx ?? -1);
        setTimeRemaining(d.timeRemaining || 0);
        setPots(d.pots || []);
        if (d.activeVariant) setActiveVariant(VARIANTS[d.activeVariant.id] || d.activeVariant);

        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true);
            setShowdownWinners(d.showdownWinners || []);
            setWinning5Ids(d.winning5Ids || []);
            setCurrentShowdownIdx(0);
            const winners = d.showdownWinners || [];
            winners.forEach((_, i) => {
                setTimeout(() => setCurrentShowdownIdx(i), i * 4000);
            });
            setTimeout(() => setPotTransferring(false), winners.length * 4000);
        }
    });
    socket.on('loginSuccess', (p) => { 
      setUserProfile(p); 
      setPendingVariantId(p.pendingVariant || 'HOLDEM');
      setCurrentView(VIEWS.LOBBY); 
      socket.emit('getInitialData'); 
    });
    // Forced Logout Listener
    socket.on('forcedLogout', (data) => {
      setUserProfile(null);
      setCurrentView(VIEWS.LOGIN);
    });
    
    socket.on('lobbyUpdate', (list) => setActiveTables(list || []));
    socket.on('profilesUpdate', (list) => setAllProfiles(list || []));
    socket.on('log', (d) => setLogs(prev => [...prev, { ...d, id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }].slice(-100)));
    socket.emit('getInitialData');
    return () => { 
      socket.off('connect'); socket.off('roomUpdate'); 
      socket.off('lobbyUpdate'); socket.off('profilesUpdate');
      socket.off('loginSuccess'); socket.off('log'); 
      socket.off('initialDataResponse');
      socket.off('forcedLogout');
    };
  }, []);

  const handleLogin = useCallback(() => {
    const normalizedPassword = passwordInput.trim().toLowerCase();
    if (normalizedPassword === 'pass') {
        setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin', chips: 0 });
        setCurrentView(VIEWS.ADMIN);
        socket.emit('getInitialData');
    } else {
        socket.emit('playerLogin', { password: normalizedPassword });
    }
  }, [passwordInput]);

  const handleAction = useCallback((type, amt = 0) => {
    socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(amt || raiseInput) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleAllIn = useCallback(() => {
    if (!heroPlayerObj) return;
    const totalStack = Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet);
    handleAction('RAISE', totalStack);
  }, [heroPlayerObj, handleAction]);

  const currentWinner = showdownWinners[currentShowdownIdx];

  const spotlightPos = useMemo(() => {
    if (!currentWinner) return null;
    const sIdx = players.findIndex(p => p && p.uid === currentWinner.uid);
    if (sIdx === -1) return null;
    const rIdx = (sIdx - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS;
    return DISPLAY_POSITIONS[rIdx];
  }, [currentWinner, players, heroIdx]);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white uppercase font-black">
        <div className="w-full max-w-[400px] p-8 md:p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8">
            <Lock size={32} className="text-[#fbbf24]" />
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-xl font-black uppercase"/>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl font-black text-lg transition-transform uppercase">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white uppercase font-black overflow-hidden pt-[env(safe-area-inset-top)]">
        <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-3 md:p-8 flex flex-row md:flex-col gap-2 md:gap-4 bg-black/20 shrink-0">
            <h2 className="hidden md:flex text-[#fbbf24] items-center gap-2 mb-4 font-black"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[10px] font-black ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[10px] font-black ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>TABLES</button>
            <button onClick={()=>{ if(!nuclearConfirm){setNuclearConfirm(true); setTimeout(()=>setNuclearConfirm(false),3000); return;} socket.emit('adminNuclearReset'); setNuclearConfirm(false); }} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all ${nuclearConfirm ? 'bg-red-600 border-white' : 'bg-white/5 text-red-500 border-red-500/20'}`}>
                <Bomb size={14}/> {nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}
            </button>
            <button onClick={()=>setCurrentView(VIEWS.LOBBY)} className="flex-1 md:flex-none p-2.5 md:p-4 rounded-xl bg-cyan-600 text-black font-black text-[10px]">BACK TO LOBBY</button>
        </aside>
        <main className="flex-1 p-5 md:p-12 overflow-y-auto bg-black/40">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8">
                    <h3 className="text-xl border-l-4 border-[#fbbf24] pl-4">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm uppercase"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm uppercase"/>
                        <button onClick={()=>{ socket.emit('adminCreatePlayer', {...newPlayer, password: newPlayer.password.trim().toLowerCase(), uid: Math.random().toString(36).slice(2)}); setNewPlayer({name:'', chips:100, password:''}); }} className="bg-[#fbbf24] text-black rounded-xl font-black p-3 text-sm">CREATE</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                        {allProfiles.map(p => (
                            <div key={p.uid} className="flex justify-between p-4 border-b border-white/5 items-center hover:bg-white/5 transition-colors">
                                <span className="text-sm font-black truncate max-w-[120px]">{String(p.name)}</span>
                                <div className="flex gap-4 items-center">
                                    <span className="text-emerald-400 font-mono font-black">${Number(p.chips || 0).toLocaleString()}</span>
                                    <button onClick={()=>{const n = prompt("NEW WALLET", String(p.chips || 0)); if(n !== null) socket.emit('adminEditChips', {uid: p.uid, chips: Number(n)})}} className="text-cyan-400"><Edit3 size={14}/></button>
                                    <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    <h3 className="text-xl border-l-4 border-emerald-500 pl-4">ARENA CONTROL</h3>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border border-white/10">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm uppercase"/>
                        <input type="number" step="0.25" value={newTable.sb} onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})} placeholder="SB" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm"/>
                        <input type="number" step="0.25" value={newTable.bb} onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})} placeholder="BB" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm"/>
                        <button onClick={()=>{ socket.emit('adminCreateRoom', {...newTable, id: 'room_' + Math.random().toString(36).slice(2, 9)}); setNewTable({name:'', sb:0.25, bb:0.50, minBuy:5, maxBuy:10}); }} className="bg-emerald-600 text-white rounded-xl font-black p-3 text-sm lg:col-span-3">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {activeTables.map(t => (
                            <div key={t.id} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10">
                              <div>
                                <h4 className="text-[#fbbf24] font-black text-base">{String(t.name)}</h4>
                                <p className="text-[10px] text-white/40 tracking-widest uppercase">${t.sb}/${t.bb} • {t.players?.filter(p=>p).length}/10 Seats</p>
                              </div>
                              <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 px-3 py-1.5 rounded-xl text-red-500 font-black text-[10px]">TERMINATE</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div className="h-screen bg-[#06080c] flex flex-col text-white font-black uppercase overflow-hidden">
        <header className="h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-5 md:px-12 bg-black/40 backdrop-blur-md shadow-xl shrink-0 pt-[env(safe-area-inset-top)]">
          <h2 className="tracking-[0.2em] md:tracking-[0.4em] text-xs md:text-xl flex items-center gap-2 md:gap-4 font-black"><LayoutGrid className="text-[#fbbf24] w-3 md:w-6"/> LOBBY</h2>
          <div className="flex items-center gap-3 md:gap-10 font-black">
            <div className="flex flex-col items-end"><span className="text-[7px] text-white/40 uppercase italic truncate max-w-[50px] md:max-w-none">{String(userProfile?.name || "??")}</span><span className="text-emerald-400 font-mono text-xs md:text-2xl tracking-tighter">${Number(userProfile?.chips || 0).toLocaleString()}</span></div>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={16}/></button>
          </div>
        </header>
        
        <main className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden">
          <div className="flex-1 flex flex-col bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="grid grid-cols-4 md:grid-cols-5 bg-black/60 p-4 border-b border-white/10 text-[10px] md:text-xs tracking-[0.2em] text-white/40 font-black sticky top-0_ z-10 uppercase">
              <div className="col-span-1 md:col-span-2">Arena Name</div>
              <div className="text-center">Stakes (SB/BB)</div>
              <div className="text-center">Players</div>
              <div className="text-right">Action</div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeTables.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-20 text-white/20">
                  <ShieldAlert size={48} />
                  <span className="tracking-[0.5em] text-sm">No Active Arenas</span>
                </div>
              ) : (
                activeTables.map((t, idx) => (
                  <div key={t.id} className={`grid grid-cols-4 md:grid-cols-5 p-4 md:p-6 items-center border-b border-white/5 hover:bg-[#fbbf24]/5 transition-all group ${idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}`}>
                    <div className="col-span-1 md:col-span-2 flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        <h3 className="text-xs md:text-xl font-black text-white group-hover:text-[#fbbf24] transition-colors truncate">{String(t.name)}</h3>
                      </div>
                      <span className="text-[7px] md:text-[9px] text-white/20 tracking-widest pl-5">{t.id}</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-emerald-400 font-mono text-sm md:text-2xl font-black">${t.sb} / ${t.bb}</span>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <div className="text-white/80 font-mono text-xs md:text-lg font-black">{t.players?.filter(p=>p).length || 0} / 10</div>
                      <div className="hidden md:flex flex-wrap gap-1 justify-center max-w-[150px]">
                        {t.players?.filter(p=>p).slice(0, 3).map((p, pi) => (
                          <div key={pi} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[7px] font-black text-white/40 truncate max-w-[40px] uppercase">{p.name}</div>
                        ))}
                        {(t.players?.filter(p=>p).length > 3) && <span className="text-[7px] text-white/20">+{t.players.filter(p=>p).length - 3}</span>}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        onClick={() => {
                          socket.emit('joinRoom', { roomId: t.id, profile: userProfile, buyIn: 10 }, (res) => {
                            if (res?.status === 'ok') { setCurrentRoomId(t.id); setCurrentView(VIEWS.GAME); }
                          });
                        }} 
                        className="bg-emerald-600 text-white px-4 md:px-10 py-2 md:py-4 rounded-xl font-black text-[9px] md:text-sm tracking-widest hover:scale-105 active:scale-95 hover:bg-emerald-500 transition-all shadow-xl group-hover:shadow-emerald-500/20 uppercase"
                      >
                        ENTER
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
    </div>
  );

  return (
    <div className={`h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase transition-all duration-700`}>
      
      {/* Redesigned Intel Feed Modal */}
      {intelExpanded && (
        <div onClick={() => setIntelExpanded(false)} className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-md p-6 pt-[100px] flex flex-col gap-4 animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[950px] mx-auto bg-slate-900/95 border border-white/10 rounded-3xl p-6 flex flex-col flex-1 overflow-hidden shadow-2xl mb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-2"><Eye className="text-[#fbbf24]" size={20} /><h3 className="text-xl text-[#fbbf24] font-black uppercase tracking-widest">Intelligence Access</h3></div>
                <div className="flex items-center gap-3">
                  <button onClick={() => {
                    const text = logs.map(l => `[${l.time}] ${l.name}: ${l.action}`).join('\n');
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000);
                  }} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[10px] font-black uppercase ${copySuccess ? 'bg-emerald-600 border-emerald-400' : 'bg-white/5'}`}>
                    {copySuccess ? <Check size={14}/> : <Copy size={14}/>} {copySuccess ? 'Copied' : 'Copy Logs'}
                  </button>
                  <button onClick={() => setIntelExpanded(false)} className="text-white/40 hover:text-white"><X size={24} /></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide font-mono">
                {groupedLogs.map((hand) => (
                  <div key={hand.id} className="flex flex-col border border-white/5 rounded-2xl bg-black/40 overflow-hidden shadow-lg">
                    <button onClick={() => setExpandedHands(prev => { const n = new Set(prev); if(n.has(hand.id)) n.delete(hand.id); else n.add(hand.id); return n; })} className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <ChevronRight className={`transition-transform ${expandedHands.has(hand.id) ? 'rotate-90' : ''}`} size={14} />
                        <span className="text-[#fbbf24] text-xs font-black uppercase tracking-widest">Hand Event</span>
                        <span className="text-white/50 text-[10px] italic">{hand.winnerSummary}</span>
                      </div>
                    </button>
                    {expandedHands.has(hand.id) && (
                      <div className="p-4 space-y-2 bg-black/60 border-t border-white/5">
                        {hand.actions.map((l, i) => {
                          const playerColor = getPlayerIntelColor(l.name);
                          return (
                            <div key={i} className={`flex gap-4 text-[11px] leading-tight ${playerColor}`}>
                              <span className="text-white/20 shrink-0 w-10">{l.time}</span>
                              <span className="w-20 shrink-0 font-black">{l.name}:</span>
                              <span className="flex-1 opacity-90">{l.action}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setShowRulesModal(false)}>
          <div className="w-full max-w-[600px] bg-slate-900 border-2 border-cyan-500/40 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
              <h3 className="text-xl md:text-3xl text-cyan-400 font-black tracking-tighter uppercase flex items-center gap-3">
                <BookOpen size={24} /> {activeVariant?.name} Manual
              </h3>
              <button onClick={() => setShowRulesModal(false)} className="text-white/40 hover:text-white transition-colors p-2 bg-white/5 rounded-full"><X size={24}/></button>
            </div>
            <div className="space-y-6">
              {(activeVariant?.rules || []).map((rule, idx) => (
                <div key={idx} className="flex gap-4 items-start group">
                  <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] flex items-center justify-center font-black group-hover:scale-110 transition-transform">0{idx + 1}</span>
                  <p className="text-sm md:text-lg text-white/80 font-black leading-snug uppercase tracking-tight">{rule}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowRulesModal(false)} className="w-full mt-10 py-5 bg-cyan-600 hover:bg-cyan-500 text-black font-black uppercase text-sm md:text-base rounded-2xl transition-all shadow-lg active:scale-95">Acknowledge Rules</button>
          </div>
        </div>
      )}

      {isBrokeStatus && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6">
            <div className="w-full max-w-[400px] p-8 bg-slate-900 border-2 border-red-500 rounded-[2.5rem] text-center shadow-[0_0_100px_rgba(239,68,68,0.4)] font-black">
              <AlertTriangle size={64} className="text-red-500 animate-pulse mb-6 mx-auto" />
              <h2 className="text-3xl font-black mb-2 uppercase italic tracking-tighter">Busted!</h2>
              <p className="text-white/40 mb-8 text-[10px] tracking-[0.2em] uppercase">Stack is $1 or less • Maintain your seat?</p>
              
              {(userProfile?.chips || 0) >= 5 ? (
                <button 
                  onClick={() => socket.emit('playerRebuy', { roomId: currentRoomId, uid: userProfile.uid, amount: 10 })} 
                  className="w-full p-6 bg-emerald-600 text-white rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all font-black uppercase text-sm flex items-center justify-center gap-3"
                >
                  <Coins size={18}/> REBUY $10.00
                </button>
              ) : (
                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-white/30 text-[10px] font-black uppercase tracking-widest">
                  INSUFFICIENT WALLET (Min $5)
                </div>
              )}
              
              <button 
                onClick={() => { socket.emit('leaveRoom', { uid: userProfile.uid }); setCurrentView(VIEWS.LOBBY); }} 
                className="mt-6 text-white/20 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
              >
                <LogOut size={12}/> EXIT ARENA
              </button>
            </div>
          </div>
      )}

      {phase === PHASES.SHOWDOWN && spotlightPos && (
        <div className="fixed inset-0 z-[60] pointer-events-none transition-opacity duration-1000" style={{
           background: `radial-gradient(circle at ${spotlightPos.x}% ${spotlightPos.y}%, transparent 5%, rgba(0,0,0,0.85) 45%)`
        }} />
      )}

      <header className="h-16 md:h-20 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-black/80 backdrop-blur-md z-[80] shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <button onClick={() => setShowRulesModal(true)} 
            className={`px-2 py-1.5 rounded-xl border flex flex-col justify-center min-w-[80px] transition-all duration-500
              ${(phase === PHASES.FLOP || phase === PHASES.TURN) ? 'bg-yellow-400/20 border-yellow-400 ring-2 ring-yellow-400 animate-attention-grabber scale-110 z-10' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
          >
            <span className={`text-yellow-400 text-[8px] tracking-widest uppercase flex items-center gap-1 leading-none mb-1 animate-glow`}>THIS HAND: <Info size={8}/></span>
            <span className="text-white text-[10px] md:text-sm font-black truncate uppercase leading-none">{activeVariant?.name || 'Holdem'}</span>
          </button>
          
          <div className="bg-white/5 border border-white/10 px-2 py-1.5 rounded-xl flex flex-col justify-center min-w-[100px] h-full">
            <span className="text-cyan-400 text-[8px] uppercase tracking-wider leading-none mb-1">ON MY DEAL:</span>
            <select value={pendingVariantId} onChange={(e) => { 
              setPendingVariantId(e.target.value); 
              socket.emit('updatePlayerSettings', {uid: userProfile?.uid, pendingVariant: e.target.value}); 
            }} className="bg-transparent text-white outline-none text-[10px] md:text-xs cursor-pointer font-black uppercase appearance-none leading-none w-full">
              {Object.entries(VARIANTS).map(([k,v]) => (<option key={k} value={k} className="bg-slate-900">{v.name}</option>))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex gap-1 md:gap-2">
            <button onClick={() => socket.emit('adminAddBot', { roomId: currentRoomId })} className="text-indigo-400 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-white/5"><Bot size={18}/></button>
            <button onClick={() => setIntelExpanded(!intelExpanded)} className={`${intelExpanded ? 'text-white bg-indigo-600' : 'text-[#fbbf24] bg-white/5'} p-2 border border-white/5 rounded-xl hover:bg-white/10 transition-colors shadow-lg`}><Eye size={18}/></button>
            <button onClick={() => setShowVisualControls(true)} className="text-cyan-400 p-2 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all"><Settings size={18}/></button>
            <button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid }); setCurrentView(VIEWS.LOBBY);}} className="text-red-500 p-2 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all"><LogOut size={18}/></button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex items-center justify-center bg-emerald-950/10 overflow-hidden">
        <Confetti active={phase === PHASES.SHOWDOWN} />
        
        {showBanner && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none animate-banner-pop">
            <div className={`text-[12vw] md:text-[8vw] font-black uppercase tracking-[0.2em] italic text-center ${getBannerStyles()}`}>
               {activeVariant?.name}
            </div>
          </div>
        )}

        <div style={{ transform: `scale(${visuals.tableZoom})` }} className="relative w-full max-w-[1400px] aspect-[18/9] flex items-center justify-center transition-transform duration-500">
            <div className="absolute inset-0 bg-[#0f3d2e]/40 rounded-[50%] border-[2vw] border-slate-900 shadow-[inset_0_0_15vw_rgba(0,0,0,0.8)]" />
            <div className="absolute inset-0 z-20 pointer-events-none font-black">
              {players.map((p, i) => { 
                if (!p) return null; 
                const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; 
                return (<Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={currentWinner?.uid === p.uid ? currentWinner.hand.map(c => c.id) : []} currentWinnerUid={currentWinner?.uid} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} seatIdx={i} visuals={visuals} timeRemaining={timeRemaining} isCollectingBets={potTransferring} pots={pots} />); 
              })}
            </div>

            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none">
              <div className="flex flex-col-reverse items-center gap-2">
                {pots.length > 0 ? (
                  pots.map((pot, pidx) => (
                    <div key={pidx} className={`flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500`} style={{ opacity: (phase === PHASES.SHOWDOWN && currentWinner?.potIdx !== pidx) ? 0.3 : 1 }}>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          {pot.eligibleUids.map(uid => {
                             const p = players.find(pl => pl && pl.uid === uid);
                             return p ? <div key={uid} className="w-4 h-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[6px] font-black text-white/60">{p.name[0]}</div> : null;
                          })}
                        </div>
                        <div className={`text-[2vw] md:text-[3.5vw] font-black ${pot.isMain ? 'text-yellow-400' : 'text-cyan-400'} font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]`}>
                          ${pot.amount.toFixed(2)}
                        </div>
                      </div>
                      <span className="text-[8px] md:text-[10px] text-white/40 uppercase tracking-[0.2em]">{pot.isMain ? 'Main Pot' : `Side Pot #${pidx + 1}`}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[6vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-[0_0_30px_rgba(0,0,0,0.8)] animate-pulse">
                    $0.00
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 mt-6" style={{ transform: `scale(${visuals.commCardScale}) translateY(${visuals.commCardY}px)` }}>
                {community.map((c, j) => {
                  const isRed = c.suit === '♥' || c.suit === '♦';
                  const isWin = currentWinner?.hand.some(wc => wc.id === c.id);
                  return (
                    <div key={c.id || j} className={`w-[3vw] h-[4.5vw] rounded-[2px] bg-white border flex flex-col items-center justify-center text-black transition-all duration-300 ${isWin ? 'ring-2 ring-yellow-400 scale-125 z-40 shadow-[0_0_30px_rgba(251,191,36,0.6)]' : 'opacity-80 border-white/20'}`}>
                      <span className={`text-[1.1vw] font-black leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>{c.value}</span>
                      <span className={`text-[2vw] leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>{c.suit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
        </div>
      </main>

      <footer style={{ height: visuals.footerHeight }} className="bg-black/95 border-t border-white/10 z-[100] pt-2 px-2 pb-2 md:p-8 shrink-0 shadow-[0_-15px_50px_rgba(0,0,0,0.7)] flex flex-col items-center justify-start">
        {phase === PHASES.SHOWDOWN && currentWinner ? (
          <div key={currentShowdownIdx} className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-700">
            <div className="flex items-center gap-2 md:gap-4 text-yellow-400 text-[2.6vw] sm:text-lg md:text-4xl mb-2 md:mb-4 rank-shimmer font-black italic tracking-tighter uppercase text-center whitespace-nowrap">
              <Trophy className="w-3 h-3 md:w-9 md:h-9 drop-shadow-lg" /> 
              {currentWinner.name} won with {currentWinner.rank === '!' ? 'a muck' : currentWinner.rank} (${currentWinner.amount.toFixed(2)})
            </div>
            
            <div className="flex gap-2 md:gap-4 px-4 py-6 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-md overflow-x-auto max-w-full no-scrollbar justify-center">
              {currentWinner.hand.map((c, ci) => (
                <div key={ci} className={`w-14 h-20 md:w-24 md:h-36 bg-white rounded-lg flex flex-col items-center justify-center text-black shadow-2xl relative overflow-hidden shrink-0 ${c.isJoker ? 'ring-4 ring-purple-500 animate-pulse' : 'ring-1 ring-black/10'}`} 
                     style={{ animation: `card-flip-hero 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`, animationDelay: `${ci * 0.15}s` }}>
                  {c.isJoker && <div className="absolute inset-0 bg-purple-500/10 flex items-center justify-center"><span className="text-[10px] md:text-xs font-black text-purple-700 rotate-[-45deg] opacity-40 uppercase">Joker</span></div>}
                  <span className={`text-lg md:text-2xl font-black absolute top-1 left-1.5 leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{c.value}</span>
                  <span className={`text-5xl md:text-7xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{c.suit}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`flex flex-col items-center w-full max-w-4xl mx-auto transition-all duration-500 ${activeIdx !== heroIdx && phase !== PHASES.IDLE ? 'opacity-30 grayscale pointer-events-none scale-95' : ''}`}>
             
             {heroPlayerObj && phase !== PHASES.IDLE && (
               <div className="flex justify-between w-full px-2 mt-1">
                  <div className="flex flex-col items-start min-w-[120px] md:min-w-[140px]">
                    {activeVariant?.id === 'HILOW' && (
                      <>
                        <span className="text-[7px] md:text-[10px] text-white/40 uppercase tracking-widest font-black leading-none mb-0.5">Low Strength</span>
                        <span className="text-emerald-400 text-[12px] md:text-[22px] font-black leading-none truncate max-w-[150px]">{heroPlayerObj?.lowStrength || '---'}</span>
                        <span className="text-amber-500 text-[8px] md:text-[16px] font-mono font-black mt-0.5 leading-none">{phase === PHASES.PRE_FLOP ? '-' : Math.round(heroPlayerObj?.lowWinProbability || 0)}% PROB.</span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-col items-end min-w-[120px] md:min-w-[140px]">
                    <span className="text-[7px] md:text-[10px] text-white/40 uppercase tracking-widest font-black leading-none mb-0.5">{activeVariant?.id === 'HILOW' ? 'High Strength' : 'Hand Strength'}</span>
                    <span className="text-purple-400 text-[12px] md:text-[22px] font-black leading-none truncate max-w-[150px]">{heroPlayerObj?.strength || 'Analysing...'}</span>
                    <span className="text-amber-500 text-[8px] md:text-[16px] font-mono font-black mt-0.5 leading-none">{phase === PHASES.PRE_FLOP ? '-' : Math.round(heroPlayerObj?.winProbability || 0)}% PROB.</span>
                  </div>
               </div>
             )}

             {phase !== PHASES.IDLE && (
               <div className="flex flex-col gap-1 md:gap-2 w-full mt-1.5">
                  <div className="flex gap-1 w-full font-black uppercase">
                    <button onClick={()=>handleAction('RAISE', highestBet + Math.floor(totalDisplayPot * 0.5))} className="flex-1 h-7 md:h-10 bg-white/5 border border-white/10 rounded-lg text-[8px] md:text-xs hover:bg-white/20 transition-all font-black">1/2 POT</button>
                    <button onClick={()=>handleAction('RAISE', highestBet + totalDisplayPot)} className="flex-1 h-7 md:h-10 bg-white/5 border border-white/10 rounded-lg text-[8px] md:text-xs hover:bg-white/20 transition-all font-black">POT</button>
                    <button onClick={handleAllIn} className="flex-1 h-7 md:h-10 bg-red-900/40 border border-red-500/50 rounded-lg text-[8px] md:text-xs text-red-500 hover:bg-red-600 hover:text-white transition-all font-black">ALL-IN</button>
                  </div>

                  <div className="flex gap-1.5 md:gap-2 w-full">
                    <button onClick={() => handleAction('FOLD')} className="flex-1 bg-red-950/80 border-2 border-red-500/50 py-2.5 md:py-4 rounded-xl text-[10px] md:text-lg font-black hover:bg-red-600 hover:text-white transition-all shadow-xl uppercase tracking-widest">FOLD</button>
                    <button onClick={() => handleAction('CALL')} className="flex-1 bg-indigo-900/80 border-2 border-indigo-400/50 py-2.5 md:py-4 rounded-xl text-[10px] md:text-lg font-black hover:bg-indigo-500 hover:text-white transition-all shadow-xl uppercase tracking-widest px-1 truncate">
                      {highestBet > (heroPlayerObj?.currentBet || 0) ? `CALL $${(highestBet - (heroPlayerObj?.currentBet || 0)).toFixed(2)}` : 'CHECK'}
                    </button>
                    <div className="flex-[2] flex bg-black/60 border-2 border-white/20 rounded-xl overflow-hidden shadow-inner font-black">
                      <div className="flex items-center px-1.5 md:px-4 text-emerald-400 text-sm md:text-2xl font-mono">$</div>
                      <input type="number" step="0.25" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(Number(heroPlayerObj?.chips || 0) + Number(heroPlayerObj?.currentBet || 0), Math.max(0, Number(e.target.value))))} className="w-full bg-transparent text-center text-sm md:text-3xl outline-none font-mono text-white p-1 md:p-2" />
                      <button onClick={() => handleAction('RAISE')} className="bg-emerald-600 px-3 md:px-8 text-[9px] md:text-xl font-black hover:bg-emerald-400 hover:text-black transition-all uppercase tracking-tighter shadow-lg flex items-center gap-1 md:gap-2 shrink-0"><Zap size={14}/> RAISE</button>
                    </div>
                  </div>
               </div>
             )}
             
             {phase === PHASES.IDLE && (
               <div className="flex flex-col items-center gap-1 py-4 md:py-10 opacity-30">
                  <Activity className="animate-pulse text-emerald-400" size={16} />
                  <span className="text-xs md:text-xl italic tracking-[0.5em]">Waiting...</span>
               </div>
             )}
          </div>
        )}
      </footer>

      <style>{`
        @keyframes indicator-glow {
          0%, 100% { text-shadow: 0 0 2px rgba(251, 191, 36, 0); opacity: 0.7; }
          50% { text-shadow: 0 0 10px rgba(251, 191, 36, 0.8); opacity: 1; }
        }
        .animate-glow {
          animation: indicator-glow 2s ease-in-out infinite;
        }
        @keyframes attention-ping {
          0% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.08); filter: brightness(1.3); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        .animate-attention-grabber {
          animation: attention-ping 1s ease-in-out infinite;
        }
        @keyframes fling-to-pot { 
          0% { transform: translate(calc(-50% + 0px), 0px) scale(2.0); filter: brightness(2); } 
          15% { transform: translate(calc(-50% + 40px), -15vh) scale(1.4); filter: brightness(1.5); }
          100% { transform: translate(calc(-50% + 20px), -45vh) scale(0) rotate(720deg); opacity: 0; } 
        }
        @keyframes card-flip-hero {
          0% { transform: rotateY(110deg) scale(0.4); opacity: 0; filter: blur(10px); }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; filter: blur(0px); }
        }
        .rank-shimmer {
          background: linear-gradient(90deg, #fbbf24 0%, #fff 40%, #fff 60%, #fbbf24 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 2.5s linear infinite;
          font-weight: 900;
        }
        @keyframes shimmer { to { background-position: 200% center; } }
        .confetti-particle {
          position: absolute; width: 8px; height: 8px; top: -10px;
          animation: fall linear forwards;
          border-radius: 2px;
        }
        @keyframes fall {
          0% { transform: translateY(0vh) rotate(0deg); }
          100% { transform: translateY(110vh) rotate(720deg); }
        }
        @keyframes panic-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px #ef4444); }
          50% { transform: scale(1.05); filter: drop-shadow(0 0 25px #ef4444); }
        }
        @keyframes bet-splash { 
          0% { transform: translate(-50%, -50%) scale(0) rotate(-180deg); opacity: 0; } 
          60% { transform: translate(-50%, -50%) scale(1.3) rotate(10deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; } 
        }
        .animate-bet-splash { animation: bet-splash 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes banner-pop {
          0% { transform: scale(0.5); opacity: 0; filter: blur(20px); }
          20% { transform: scale(1.1); opacity: 1; filter: blur(0px); }
          80% { transform: scale(1); opacity: 1; filter: blur(0px); }
          100% { transform: scale(1.5); opacity: 0; filter: blur(20px); }
        }
        .animate-banner-pop { animation: banner-pop 1.5s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
        @keyframes red-black-shift {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        .animate-red-black-shift {
          background-size: 200% auto;
          animation: red-black-shift 1s linear infinite;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #fbbf24; border-radius: 4px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        html, body { overscroll-behavior-y: contain; height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
      `}</style>

      {showVisualControls && (
        <div className="fixed inset-0 z-[2000] bg-black/90 flex items-center justify-center p-6 backdrop-blur-lg animate-in fade-in duration-300">
          <div className="bg-slate-900 border-2 border-white/20 p-8 md:p-12 rounded-[3rem] w-full max-w-[1000px] h-[90vh] overflow-y-auto scrollbar-hide shadow-[0_0_100px_rgba(0,0,0,0.8)] relative">
            <button onClick={() => setShowVisualControls(false)} className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors"><X size={32}/></button>
            <h3 className="text-2xl md:text-4xl mb-12 font-black italic tracking-tighter flex items-center gap-4 text-[#fbbf24] uppercase border-b border-white/10 pb-4"><Settings2 size={40}/> Visual Calibration</h3>
            
            <div className="space-y-12 pb-14">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h4 className="text-emerald-400 font-black tracking-widest uppercase text-sm border-l-4 border-emerald-400 pl-4">Global Layout</h4>
                  <div className="flex flex-col gap-4">
                    <label className="text-white/60 uppercase text-[10px]">Table Zoom ({visuals.tableZoom.toFixed(2)})</label>
                    <input type="range" min="0.4" max="1.5" step="0.05" value={visuals.tableZoom} onChange={(e) => setVisuals({...visuals, tableZoom: Number(e.target.value)})} className="accent-emerald-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="text-white/60 uppercase text-[10px]">Action HUD Height ({visuals.footerHeight}px)</label>
                    <input type="range" min="150" max="600" step="10" value={visuals.footerHeight} onChange={(e) => setVisuals({...visuals, footerHeight: Number(e.target.value)})} className="accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-purple-400 font-black tracking-widest uppercase text-sm border-l-4 border-purple-400 pl-4">Hole Cards</h4>
                  <div className="flex flex-col gap-4">
                    <label className="text-white/60 uppercase text-[10px]">Card Scale ({visuals.heroCardScale.toFixed(1)})</label>
                    <input type="range" min="1.0" max="6.0" step="0.1" value={visuals.heroCardScale} onChange={(e) => setVisuals({...visuals, heroCardScale: Number(e.target.value)})} className="accent-purple-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="text-white/60 uppercase text-[10px]">Y Offset ({visuals.heroCardY}px)</label>
                    <input type="range" min="-200" max="200" step="5" value={visuals.heroCardY} onChange={(e) => setVisuals({...visuals, heroCardY: Number(e.target.value)})} className="accent-purple-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="text-white/60 uppercase text-[10px]">Fan Spread ({visuals.holeCardFan} deg)</label>
                    <input type="range" min="0" max="60" step="1" value={visuals.holeCardFan} onChange={(e) => setVisuals({...visuals, holeCardFan: Number(e.target.value)})} className="accent-pink-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-amber-400 font-black tracking-widest uppercase text-sm border-l-4 border-amber-400 pl-4">Betting Labels</h4>
                  <div className="flex flex-col gap-4">
                    <label className="text-white/60 uppercase text-[10px]">Label Scale ({visuals.betScale.toFixed(1)})</label>
                    <input type="range" min="0.5" max="4.0" step="0.1" value={visuals.betScale} onChange={(e) => setVisuals({...visuals, betScale: Number(e.target.value)})} className="accent-amber-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="text-white/60 uppercase text-[10px]">Label Y Position ({visuals.betY}px)</label>
                    <input type="range" min="-300" max="300" step="5" value={visuals.betY} onChange={(e) => setVisuals({...visuals, betY: Number(e.target.value)})} className="accent-amber-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-cyan-400 font-black tracking-widest uppercase text-sm border-l-4 border-cyan-400 pl-4">The Board</h4>
                  <div className="flex flex-col gap-4">
                    <label className="text-white/60 uppercase text-[10px]">Comm Card Scale ({visuals.commCardScale.toFixed(1)})</label>
                    <input type="range" min="1.0" max="4.0" step="0.1" value={visuals.commCardScale} onChange={(e) => setVisuals({...visuals, commCardScale: Number(e.target.value)})} className="accent-cyan-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="text-white/60 uppercase text-[10px]">Comm Y Position ({visuals.commCardY}px)</label>
                    <input type="range" min="-100" max="100" step="5" value={visuals.commCardY} onChange={(e) => setVisuals({...visuals, commCardY: Number(e.target.value)})} className="accent-cyan-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => setShowVisualControls(false)} className="w-full bg-emerald-600 py-6 rounded-2xl font-black text-xl hover:brightness-125 transition-all shadow-xl active:scale-95 mb-10">ACCEPT CHANGES</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
