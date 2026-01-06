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

const VERSION = "v1.7.6-PRO";
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
  { x: 0, y: -280 },   { x: 180, y: -160 }, { x: 200, y: 0 },     { x: 180, y: 160 },  { x: 120, y: 180 },    
  { x: 0, y: 220 },    { x: -120, y: 180 }, { x: -180, y: 160 }, { x: -200, y: 0 },   { x: -180, y: -160 } 
];

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', rules: ["2 hole cards", "Standard high ranking"] }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA', rules: ["4 hole cards", "Must use exactly 2 hand + 3 board"] }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', rules: ["3 hole cards"] }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', rules: ["Weakest hand wins", "Ace is 1"] }, 
  HILOW: { id: 'HILOW', name: 'Hi-Low Split', rules: ["Split pot High/Low", "4 hole cards"] }, 
  REDSBLACKS: { id: 'REDSBLACKS', name: 'Reds & Blacks', rules: ["Joker mechanics", "4 hole cards"] }
};

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  isDealer, potTransferring, timeRemaining, isHero, 
  relativeIdx, seatIdx, visuals, showdownWinnersCount, isDefaultWin, currentWinnerName
}) => {
    if (!player || !displayPos) return null;
    
    const isShowdown = phase === PHASES.SHOWDOWN;
    const isWinnerDisplayed = isShowdown && player.name === currentWinnerName;
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };
    const currentCardScale = isHero ? visuals.heroCardScale : visuals.oppCardScale;
    const currentCardY = isHero ? visuals.heroCardY : visuals.oppCardY;

    // Timer Logic
    const isWarning = timeRemaining <= 5;
    const progress = (timeRemaining / 15);
    const totalSegments = 12;
    const activeSegments = Math.ceil(progress * totalSegments);

    const stackHeight = Math.min(12, 2 + Math.floor(Math.log10(Math.max(1, player.currentBet)) * 3));
    const stackShadow = `0 ${stackHeight / 2}px 0 #92400e, 0 ${stackHeight}px 0 #78350f, 0 ${stackHeight + 4}px 15px rgba(0,0,0,0.6)`;

    let betAnimClass = "animate-bet-slide";
    if (player.lastAction === 'RAISE' || player.lastAction === 'BET') {
        betAnimClass = "animate-bet-slam-3d";
    }
    if (isCollectingBets) {
        betAnimClass = "animate-fling-to-pot";
    }

    const isMucking = isShowdown && !player.isWinner && !player.isFolded;

    const auraColor = player.lastAction === 'FOLD' ? 'shadow-[0_0_40px_rgba(220,38,38,0.5)]' : 
                      (player.lastAction === 'RAISE' || player.lastAction === 'BET') ? 'shadow-[0_0_40px_rgba(251,191,36,0.4)]' : 
                      player.lastAction === 'CALL' ? 'shadow-[0_0_40px_rgba(34,211,238,0.3)]' : '';

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'} ${player.waitingForNextHand ? 'opacity-50' : ''}`}>
            {player.waitingForNextHand && (
                <div className="absolute top-[-20px] bg-slate-800 text-white text-[8px] px-2 py-0.5 rounded border border-white/20 uppercase font-black tracking-widest z-[150]">Waiting...</div>
            )}
            
            {/* KINETIC LAUNCHER LABEL */}
            {player.lastAction && !isActiveTurn && !isCollectingBets && !player.waitingForNextHand && (
              <div className="absolute top-[-30px] z-[200] animate-action-glitch">
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase border border-white/20 ${
                  player.lastAction === 'FOLD' ? 'bg-red-600 text-white' : 
                  player.lastAction === 'RAISE' ? 'bg-amber-500 text-black' : 
                  'bg-blue-600 text-white'
                }`} style={{ transform: `scale(${visuals.betScale}) translateY(${visuals.betY}px)` }}>{String(player.lastAction)}</span>
              </div>
            )}

            {/* 3D CHIP STACK WITH IMPACT RING */}
            {player.currentBet > 0 && (
                <div key={`${player.uid}-${player.currentBet}`} className="absolute z-[120] left-1/2 top-1/2 pointer-events-none" 
                    style={{ transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y + visuals.betY}px)` }}>
                    {(player.lastAction === 'RAISE' || player.lastAction === 'BET') && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-yellow-400/50 animate-impact-ring" />
                    )}
                    <div className={`${betAnimClass} transition-all duration-700`} style={{ transform: `scale(${visuals.betScale})` }}>
                        <div className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-black text-[9px] md:text-[12px] px-2.5 py-1 rounded-full border border-white/30 flex items-center gap-1 whitespace-nowrap shadow-xl"
                             style={{ boxShadow: stackShadow, transform: `translateY(-${stackHeight/2}px)` }}>
                            <Coins size={10} className="animate-pulse" />
                            ${String(player.currentBet)}
                        </div>
                    </div>
                </div>
            )}

            <div style={{ transform: `translateY(${visuals.badgeY}px)` }}
                className={`relative z-50 flex flex-col items-center p-1 rounded-xl border bg-slate-900/95 backdrop-blur-md transition-all duration-300 min-w-[84px] md:min-w-[180px] shadow-2xl overflow-hidden ${isActiveTurn ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-white/10'} ${isWinnerDisplayed ? 'border-yellow-400 animate-pulse-glow scale-110 z-[200]' : ''} ${(player.lastAction && !isActiveTurn) ? auraColor : ''} ${isWarning && isActiveTurn ? 'animate-emergency-vibrate border-red-500/80' : ''}`}>
                
                {isActiveTurn && (
                  <div className="absolute inset-0 pointer-events-none z-[65] opacity-30">
                    <div className="w-full h-[2px] bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-scanline" />
                  </div>
                )}

                {/* Overload Warning removed as requested */}

                {isActiveTurn && (
                  <div className="absolute bottom-0 left-0 w-full h-[4px] md:h-[6px] flex gap-[1px] px-1 pb-1 z-[70]">
                    {[...Array(totalSegments)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`flex-1 h-full rounded-[1px] transition-all duration-300 ${
                          i < activeSegments 
                            ? (isWarning ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]') 
                            : 'bg-white/5 shadow-none'
                        }`}
                        style={{ opacity: i < activeSegments ? 1 : 0.2 }}
                      />
                    ))}
                  </div>
                )}

                {isDealer && ( <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white shadow-[0_0_12px_rgba(220,38,38,0.9)] animate-pulse z-[110]" /> )}
                
                <div className="flex flex-col items-center gap-0 w-full relative z-[75] py-1 md:py-2">
                    <div className="flex items-center gap-1">
                      {player.isBot && <Bot size={8} className="text-indigo-400" />}
                      <span className="text-[8.5px] md:text-[14.5px] font-black text-white/90 uppercase tracking-tight truncate max-w-[60px] md:max-w-[100px]">{String(player.name || "Anon")}</span>
                    </div>
                    <span className={`text-[11px] md:text-[17px] font-mono font-black ${player.chips <= 1 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>${Number(player.chips).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
            </div>

            {player.hand && Array.isArray(player.hand) && !player.isFolded && !player.waitingForNextHand && (
                <div className={`relative z-[60] flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible transition-all duration-700 ${isMucking ? 'animate-muck-cards' : ''}`}>
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const offset = ci - mid;
                        const fanRotation = offset * visuals.holeCardFan;
                        const fanTranslation = offset * (player.hand.length > 2 ? 2.0 : 3.5);
                        const isRedSuit = c.suit === '♥' || c.suit === '♦';
                        const suitColor = isRedSuit ? 'text-red-600' : 'text-black';
                        const isWinningCard = isShowdown && player.isWinner && (winning5Ids || []).includes(c.id);
                        return (
                          <div key={c.id || ci} 
                              className={`w-[5vw] md:w-[3vw] h-[7vw] md:h-[5vw] rounded-[3px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-300 animate-deal-card ${isShowdown || isHero ? 'bg-white text-black' : 'bg-slate-800'} ${isWinningCard ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_200px_#fbbf24] animate-pulse-glow' : 'border-white/20'}`} 
                              style={{ transform: `translateX(${fanTranslation}vw) rotate(${fanRotation}deg) scale(${currentCardScale})`, transformOrigin: 'bottom center', top: `${currentCardY}px`, animationDelay: `${seatIdx * 0.1}s` }}>
                              {(isShowdown || isHero) && ( 
                                <>
                                  <span className={`text-[9px] md:text-[12px] font-black leading-none ${suitColor}`}>{String(c.value)}</span>
                                  <span className={`text-[11px] md:text-[16px] leading-none ${suitColor}`}>{String(c.suit)}</span>
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

const ShowdownAmount = ({ target }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let start = 0;
        const end = Number(target);
        const duration = 1500;
        const startTime = performance.now();
        const update = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            setCount(progress * end);
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }, [target]);
    return <div className="bg-yellow-500 text-black px-2 md:px-4 py-0.5 rounded-full font-mono text-[10px] md:text-3xl font-black shadow-inner">
        +${count.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>;
};

const App = () => {
  const [currentView, setCurrentView] = useState(VIEWS.LOGIN);
  const [adminTab, setAdminTab] = useState(ADMIN_TABS.PLAYERS);
  const [userProfile, setUserProfile] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dealerIdx, setDealerIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([{ id: 'init', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), name: 'SYSTEM', action: 'INTELLIGENCE LINK ESTABLISHED', type: 'phase' }]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(15); 
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState(10); 
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potAnimating, setPotAnimating] = useState(false);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [currentShowdownIdx, setCurrentShowdownIdx] = useState(0);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [showVisualControls, setShowVisualControls] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [expandedHands, setExpandedHands] = useState(new Set()); 
  const [copySuccess, setCopySuccess] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const joinLock = useRef(false);
  
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 100, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10, pendingVariant: 'HOLDEM' });

  const isMobile = window.innerWidth < 768;
  const headerHeight = isMobile ? 56 : 72; 

  const [visuals, setVisuals] = useState({
    heroCardScale: 4.0, heroCardY: 22, oppCardScale: 1.0, oppCardY: -25,
    commCardScale: 1.8, commCardY: -7, betScale: 1.6, betY: 47,
    badgeY: 85, 
    footerHeight: 270, 
    tableZoom: window.innerWidth < 768 ? 0.75 : 0.85, 
    holeCardFan: 25
  });

  const footerHeight = visuals.footerHeight;
  const tableZoom = visuals.tableZoom;
  const logEndRef = useRef(null);

  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => p && (p.uid === userProfile.uid || p.name === userProfile.name));
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);
  const heroWinProb = useMemo(() => heroPlayerObj?.winProbability || 0, [heroPlayerObj]);
  const heroLowWinProb = useMemo(() => heroPlayerObj?.lowWinProbability || 0, [heroPlayerObj]);

  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + (Number(p?.currentBet) || 0), 0);
    return Number(potAmount) + currentBetsSum;
  }, [potAmount, players]);

  useEffect(() => {
    if (potAmount > 0) {
      setPotAnimating(true);
      const t = setTimeout(() => setPotAnimating(false), 600);
      return () => clearTimeout(t);
    }
  }, [potAmount]);

  const handleAction = useCallback((type, amt = 0) => {
    const finalAmount = amt !== 0 ? amt : raiseInput;
    if (currentRoomId) socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(finalAmount) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleLogin = useCallback(() => { 
    if (passwordInput.toLowerCase().trim() === 'pass') { 
        setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin' }); 
        setCurrentView(VIEWS.ADMIN); socket.emit('getInitialData'); 
    } else socket.emit('playerLogin', { password: passwordInput });
  }, [passwordInput]);

  const addBot = useCallback(() => { 
    if (currentRoomId && isConnected) {
      socket.emit('adminAddBot', { roomId: currentRoomId });
    }
  }, [currentRoomId, isConnected]);

  const handleCopyLogs = useCallback(() => {
    const text = logs.map(l => `[${l.time}] ${l.name}: ${l.action}`).join('\n');
    const textArea = document.createElement("textarea");
    textArea.value = text; document.body.appendChild(textArea); textArea.select();
    try { document.execCommand('copy'); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); } catch (err) {}
    document.body.removeChild(textArea);
  }, [logs]);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('initialDataResponse', (data) => { if (data.rooms) setActiveTables(data.rooms); if (data.profiles) setAllProfiles(data.profiles); });
    socket.on('roomUpdate', (d) => {
        if (!d) { setPlayers(INITIAL_PLAYERS); setPhase(PHASES.IDLE); return; }
        setPlayers(() => { const next = Array(TOTAL_SEATS).fill(null); (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); return next; });
        setPhase(d.phase); setCommunity(d.community || []); setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0);
        setActiveIdx(d.activeIdx ?? -1); setHighestBet(d.highestBet || 0); setDealerIdx(d.dealerIdx ?? -1);
        setTimeRemaining(d.timeRemaining !== undefined ? Math.max(0, d.timeRemaining) : 0);
        if (d.activeVariant) setActiveVariant(VARIANTS[d.activeVariant.id] || { name: d.activeVariant.name });
        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true);
            const winners = d.showdownWinners || [];
            setShowdownWinners(winners); setWinning5Ids(d.winning5Ids || []);
            const duration = (winners[0]?.rank === "!" ? 1500 : 5000) * winners.length;
            setTimeout(() => setPotTransferring(false), duration);
        }
    });
    socket.on('loginSuccess', (p) => { setUserProfile(p); setPendingVariantId(p.pendingVariant || 'HOLDEM'); setCurrentView(VIEWS.LOBBY); });
    socket.on('log', (d) => setLogs(prev => [...prev, { id: Math.random() + '-' + Date.now(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), ...d }].slice(-100)));
    socket.emit('getInitialData');
    return () => socket.off();
  }, []);

  const groupedLogs = useMemo(() => {
    const hands = [];
    let currentHand = { id: 'init-hand', actions: [], summaries: [], variantName: 'Standard', isOngoing: true, winnerSummary: "In Progress..." };
    logs.forEach((log) => {
      const actRaw = log.action.toUpperCase();
      const isHandStart = log.name === 'SYSTEM' && (actRaw.includes('IS DEALING') || actRaw.includes('HAND START'));
      if (isHandStart) {
        if (currentHand.actions.length > 0) {
          currentHand.isOngoing = false;
          currentHand.winnerSummary = currentHand.summaries.length > 0 ? currentHand.summaries.map(s => `${s.name} won ${s.amount} w/ ${s.rank}`).join('; ') : "Pot Swept";
          hands.push(currentHand);
        }
        currentHand = { id: log.id, actions: [log], summaries: [], variantName: 'Poker', isOngoing: true, winnerSummary: "Live actions..." };
      } else {
        currentHand.actions.push(log);
        if (log.type === 'win') {
          currentHand.summaries.push({ name: log.name, amount: log.action.match(/\$(\d+\.?\d*)/)?.[0] || "", rank: log.action.split('WITH ')[1] || "Win" });
        }
      }
    });
    if (currentHand.actions.length > 0) hands.push(currentHand);
    return hands.reverse(); 
  }, [logs]);

  const toggleHandExpansion = (id) => setExpandedHands(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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
            <h2 className="hidden md:flex text-[#fbbf24] items-center gap-2 mb-4"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>TABLES</button>
            <button onClick={() => socket.emit('adminNuclearReset')} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl flex items-center justify-center gap-2 border-2 bg-white/5 text-red-500 border-red-500/20`}><Bomb size={14}/> NUCLEAR</button>
            <button onClick={()=>setCurrentView(VIEWS.LOBBY)} className="flex-1 md:flex-none p-2.5 md:p-4 rounded-xl bg-cyan-600 text-black font-black text-[9px] md:text-xs">BACK TO LOBBY</button>
        </aside>
        <main className="flex-1 p-5 md:p-12 overflow-y-auto bg-black/40">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-[#fbbf24] pl-4">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                        {allProfiles.map(p => (
                            <div key={p.uid} className="flex justify-between p-3 md:p-4 border-b border-white/5 items-center hover:bg-white/5">
                                <span className="text-[10px] md:text-sm font-black truncate max-w-[100px]">{String(p.name)}</span>
                                <div className="flex gap-2 md:gap-4 items-center"><span className="text-emerald-400 font-mono text-xs md:text-lg">${Number(p.chips || 0).toLocaleString()}</span></div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-emerald-500 pl-4">ARENA CONTROL</h3>
                    <div className="grid grid-cols-1 gap-2.5 md:gap-4">
                        {activeTables.map(t => (
                            <div key={t.id} className="bg-white/5 p-3 rounded-2xl flex justify-between items-center border border-white/10">
                              <div>
                                <h4 className="text-[#fbbf24] font-black text-xs md:text-base">{String(t.name)}</h4>
                                <p className="text-[8px] text-white/40 tracking-widest uppercase">${t.sb}/${t.bb} • {t.players?.filter(Boolean).length}/10 Seats</p>
                              </div>
                              <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 px-2 py-1.5 rounded-xl text-red-500 font-black text-[8px]">TERMINATE</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div className="h-screen bg-[#06080c] flex flex-col text-white font-black uppercase overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
              <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-[#fbbf24]/30 rounded-3xl shadow-2xl flex flex-col gap-6 md:gap-10">
                <h3 className="text-xl md:text-3xl text-center text-[#fbbf24] underline underline-offset-8 uppercase font-black">{String(selectedTableForJoin.name)}</h3>
                <div className="space-y-4 font-black text-center uppercase">
                  <div className="flex justify-between items-center text-[10px] text-white/40 tracking-widest font-black"><span>BUY-IN AMOUNT</span><span className="text-emerald-400 text-lg md:text-2xl font-mono">${Math.min(buyInAmount, userProfile?.chips || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <input type="range" min={selectedTableForJoin.minBuy || 5} max={Math.min(selectedTableForJoin.maxBuy || 10, userProfile?.chips || 10)} step={0.25} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fbbf24]" />
                </div>
                <div className="flex gap-4"><button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black text-[10px] uppercase">BACK</button><button onClick={() => { socket.emit('joinRoom', { roomId: selectedTableForJoin.id, profile: userProfile, buyIn: buyInAmount }, (res) => { if(res.status === 'ok') { setCurrentRoomId(selectedTableForJoin.id); setCurrentView(VIEWS.GAME); setSelectedTableForJoin(null); } }); }} className={`flex-2 p-3.5 rounded-2xl shadow-lg transition-all text-[10px] tracking-widest font-black uppercase bg-emerald-600 hover:scale-105 active:scale-95`}>SIT DOWN</button></div>
              </div>
            </div>
        )}
        <header className="h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-5 md:px-12 bg-black/40 backdrop-blur-md shrink-0 pt-[env(safe-area-inset-top)]">
          <h2 className="tracking-[0.2em] md:tracking-[0.4em] text-xs md:text-xl flex items-center gap-2 md:gap-4 font-black"><LayoutGrid className="text-[#fbbf24] w-3 md:w-6"/> LOBBY</h2>
          <div className="flex items-center gap-3 md:gap-10 font-black">
            <div className="flex flex-col items-end"><span className="text-[7px] text-white/40 uppercase italic">{String(userProfile?.name || "??")}</span><span className="text-emerald-400 font-mono text-xs md:text-2xl">${Number(userProfile?.chips || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={16}/></button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-10 overflow-y-auto bg-gradient-to-br from-transparent to-white/5 font-black uppercase">
            {activeTables.map((t) => (
              <div key={t.id} className="p-4 md:p-8 bg-white/5 border border-white/5 rounded-2xl md:rounded-3xl flex flex-col gap-3 md:gap-6 shadow-2xl hover:border-[#fbbf24]/20 transition-all group relative overflow-hidden font-black">
                <h3 className="text-lg md:text-2xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors uppercase font-black">{String(t.name)}</h3>
                <div className="bg-black/60 p-3 md:p-6 rounded-2xl flex justify-between items-center border border-white/5 shadow-inner uppercase font-black">
                  <div className="flex flex-col font-black"><span className="text-[7px] md:text-[8px] text-white/40 tracking-widest">STAKES</span><span className="text-[#fbbf24] text-base md:text-xl font-black">${t.sb}/${t.bb}</span></div>
                  <div className="flex flex-col items-end font-black"><span className="text-[7px] md:text-[8px] text-white/40 tracking-widest">SEATS</span><span className="text-white/80 font-mono text-[10px] md:text-base font-black">{t.players?.filter(Boolean).length || 0}/10</span></div>
                </div>
                <button onClick={()=>setSelectedTableForJoin(t)} className="relative z-20 w-full p-4 md:p-8 bg-emerald-600 rounded-xl md:rounded-2xl tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-[9px] md:text-[10px] font-black uppercase">ENTER ARENA</button>
              </div>
            ))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      {/* MODALS */}
      {intelExpanded && (
        <div onClick={() => setIntelExpanded(false)} className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-md p-6 pt-[100px] flex flex-col animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[950px] mx-auto bg-slate-900/95 border border-white/10 rounded-3xl p-6 flex flex-col flex-1 overflow-hidden shadow-2xl mb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2"><Eye className="text-[#fbbf24]" size={20} /><h3 className="text-xl text-[#fbbf24] uppercase tracking-widest">Intelligence Link</h3></div>
                <div className="flex items-center gap-3">
                  <button onClick={handleCopyLogs} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[10px] uppercase tracking-widest ${copySuccess ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-[#fbbf24]'}`}>
                    {copySuccess ? <Check size={14}/> : <Copy size={14}/>} {copySuccess ? 'Copied' : 'Copy Logs'}
                  </button>
                  <button onClick={() => setIntelExpanded(false)} className="text-white/40 hover:text-white"><X size={24} /></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 font-mono text-xs">
                {groupedLogs.map((hand) => (
                  <div key={hand.id} className="border border-white/5 rounded-2xl bg-black/40 overflow-hidden">
                    <button onClick={() => toggleHandExpansion(hand.id)} className="w-full text-left p-4 hover:bg-white/5 flex justify-between items-center">
                      <span className="text-[#fbbf24] tracking-widest text-xs">{hand.variantName} HAND</span>
                      <span className="text-white/40 text-[10px] italic truncate ml-4 flex-1 text-right">{hand.winnerSummary}</span>
                    </button>
                    {expandedHands.has(hand.id) && (
                      <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-4">
                        {hand.actions.map((l, i) => (
                          <div key={i} className="text-[11px] uppercase tracking-tight flex gap-3">
                            <span className="text-white/20 shrink-0">{l.time}</span>
                            <span className="text-white/80"><span className="text-[#fbbf24]/60">{l.name}:</span> {l.action}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {showVisualControls && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 md:p-12">
            <div className="w-full max-w-[800px] bg-slate-900 border-2 border-white/20 rounded-[3rem] p-10 flex flex-col gap-8 shadow-2xl relative">
                <div className="flex items-center justify-between border-b-2 border-white/10 pb-6">
                    <h3 className="text-lg md:text-2xl text-[#fbbf24] flex items-center gap-4 uppercase tracking-tighter"><Settings2 size={44}/> Table Configuration</h3>
                    <button onClick={() => setShowVisualControls(false)} className="text-white/40 hover:text-white transition-colors p-2"><X size={44}/></button>
                </div>
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] md:text-base text-white/60 uppercase">Arena Zoom ({visuals.tableZoom.toFixed(2)})</label>
                        <input type="range" min="0.3" max="1.5" step="0.05" value={visuals.tableZoom} onChange={(e) => setVisuals({...visuals, tableZoom: Number(e.target.value)})} className="accent-cyan-400 h-6 cursor-pointer" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] md:text-base text-white/60 uppercase">HUD Height ({visuals.footerHeight}px)</label>
                        <input type="range" min="200" max="600" step="1" value={visuals.footerHeight} onChange={(e) => setVisuals({...visuals, footerHeight: Number(e.target.value)})} className="accent-cyan-400 h-6 cursor-pointer" />
                    </div>
                    <button onClick={() => setShowVisualControls(false)} className="w-full py-6 bg-emerald-600 rounded-[2rem] text-lg font-black uppercase mt-4">Save Profile</button>
                </div>
            </div>
        </div>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-12" onClick={() => setShowRulesModal(false)}>
          <div className="w-full max-w-[600px] bg-slate-900 border-2 border-cyan-500/40 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
              <h3 className="text-xl md:text-3xl text-cyan-400 font-black uppercase flex items-center gap-3"><BookOpen size={24} /> {activeVariant?.name} Manual</h3>
              <button onClick={() => setShowRulesModal(false)} className="text-white/40 hover:text-white transition-colors p-2 bg-white/5 rounded-full"><X size={24}/></button>
            </div>
            <div className="space-y-6">
              {(activeVariant?.rules || []).map((rule, idx) => (
                <div key={idx} className="flex gap-4 items-start group">
                  <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] flex items-center justify-center font-black">0{idx + 1}</span>
                  <p className="text-sm md:text-lg text-white/80 leading-snug uppercase tracking-tight">{rule}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowRulesModal(false)} className="w-full mt-10 py-5 bg-cyan-600 text-black font-black uppercase rounded-2xl">Return to Arena</button>
          </div>
        </div>
      )}

      {/* HUD HEADER */}
      <header className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-2 md:px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black pt-[env(safe-area-inset-top)]" style={{ height: `calc(${headerHeight}px + env(safe-area-inset-top))` }}>
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
            <button onClick={() => setShowRulesModal(true)} className="bg-white/5 px-2 py-1.5 rounded-lg md:rounded-xl border border-white/5 shadow-inner truncate font-black flex flex-col justify-center min-w-[70px] md:min-w-[110px] h-[44px] md:h-[56px] text-left">
              <span className="text-[#fbbf24] text-[8px] md:text-[10px] leading-none mb-0.5 uppercase tracking-wider flex items-center gap-1">This Hand: <Info size={8} /></span>
              <span className="text-white text-[10px] md:text-sm truncate leading-none">{String(activeVariant?.name || "Hold'em")}</span>
            </button>
            <div className="bg-white/5 border border-white/10 px-2 py-1.5 rounded-lg md:rounded-xl flex flex-col justify-center shadow-inner min-w-[70px] md:min-w-[110px] h-[44px] md:h-[56px]">
                <span className="text-cyan-400 text-[8px] md:text-[10px] leading-none mb-0.5 uppercase tracking-wider">On My Deal:</span>
                <select value={pendingVariantId} onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value}); }} className="bg-transparent text-white outline-none text-[10px] md:text-sm cursor-pointer font-black uppercase appearance-none leading-none w-full">
                    {Object.entries(VARIANTS).map(([k,v]) => (<option key={k} value={k} className="bg-slate-900">{isMobile ? k : v.name}</option>))}
                </select>
            </div>
        </div>
        <div className="flex gap-1 md:gap-2.5 items-center">
            <button onClick={addBot} className={`${isConnected ? 'text-indigo-400' : 'text-white/20'} p-2 md:p-3 bg-white/5 border border-white/10 rounded-lg md:rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors shadow-lg active:scale-95`} title={isConnected ? "Add Bot" : "Connecting..."}>
                {isConnected ? <Bot size={18}/> : <Activity size={18} className="animate-pulse" />}
            </button>
            <button onClick={() => setIntelExpanded(!intelExpanded)} className={`${intelExpanded ? 'text-white bg-indigo-600' : 'text-[#fbbf24] bg-white/5'} p-2 md:p-3 border border-white/10 rounded-lg md:rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors shadow-lg`}><Eye size={18}/></button>
            <button onClick={() => setShowVisualControls(true)} className="text-cyan-400 p-2 md:p-3 bg-white/5 border border-white/10 rounded-lg md:rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors shadow-lg"><Settings size={18}/></button>
            <button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid });setCurrentView(VIEWS.LOBBY);}} className="text-red-500 p-2 md:p-3 bg-white/5 border border-white/10 rounded-lg md:rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors shadow-lg"><LogOut size={18}/></button>
        </div>
      </header>

      {/* GAME ARENA */}
      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-emerald-950/20 to-transparent overflow-hidden px-1 py-1 font-black uppercase">
        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 40}px)` }} className="relative w-full max-w-[1400px] aspect-[15/10] md:aspect-[21/10] flex items-center justify-center h-full origin-center">
            <div className="absolute inset-0 bg-[#0f3d2e]/40 rounded-[50%] border-[3vw] md:border-[2vw] border-slate-900/60 shadow-[inset_0_0_15vw_rgba(0,0,0,0.8)] border-double uppercase" />
            
            {phase === PHASES.SHOWDOWN && showdownWinners && (
                <div className="absolute inset-0 z-[200] pointer-events-none">
                    {[...Array(15)].map((_, i) => ( <div key={i} className={`coin-particle coin-${i % 8} absolute top-1/2 left-1/2 w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_100px_#fbbf24] z-[300]`} /> ))}
                </div>
            )}

            <div className="absolute inset-0 pointer-events-none z-20">
              {(players || []).map((p, i) => { 
                if (!p) return null; 
                const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; 
                return (<Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} seatIdx={i} visuals={visuals} timeRemaining={timeRemaining} isCollectingBets={potTransferring} showdownWinnersCount={showdownWinners?.length || 0} isDefaultWin={showdownWinners?.[0]?.rank === '!'} currentWinnerName={showdownWinners?.[currentShowdownIdx]?.name} />); 
              })}
            </div>
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center">
              <div className={`flex flex-col items-center transition-all duration-300 font-black uppercase ${potAnimating ? 'scale-110' : 'scale-100'}`}>
                <div className={`text-[10vw] md:text-[5vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] ${potAnimating ? 'animate-pot-receive' : ''}`}>
                  ${Number(totalDisplayPot).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
              </div>
              <div className="flex gap-1.5 md:gap-4 mt-4 md:mt-12 font-black uppercase transition-transform" style={{ transform: `scale(${visuals.commCardScale}) translateY(${visuals.commCardY}px)` }}>
                {(community || []).map((c, j) => {
                  const isRedSuit = c.suit === '♥' || c.suit === '♦';
                  const isWinningCard = phase === PHASES.SHOWDOWN && winning5Ids?.includes(c.id);
                  return (
                    <div key={j} className={`w-[6vw] md:w-[3vw] h-[9vw] md:h-[5vw] rounded-[3px] border bg-white flex flex-col items-center justify-center text-black font-black transition-all duration-300 ${isWinningCard ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_40px_rgba(251,191,36,0.6)]' : `border-white/20 shadow-2xl ${phase === PHASES.SHOWDOWN ? 'opacity-40 grayscale-[0.5]' : 'opacity-100 grayscale-0'}`}`}>
                      <span className={`text-[10px] md:text-[0.9vw] font-black leading-none ${isRedSuit ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span>
                      <span className={`text-[13px] md:text-[2.2vw] font-black leading-none ${isRedSuit ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
        </div>
      </main>

      {/* ACTION FOOTER */}
      <footer style={{ height: `calc(${visuals.footerHeight}px + env(safe-area-inset-bottom))` }} className="bg-black/95 backdrop-blur-3xl border-t border-white/10 flex flex-col z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="flex-1 flex flex-col justify-start pt-3 md:pt-6 pb-2 px-2 md:px-10 relative bg-white/5 shadow-inner">
          {phase === PHASES.SHOWDOWN && showdownWinners && showdownWinners.length > 0 ? (
            <div className="flex flex-col items-center justify-start h-full animate-in fade-in zoom-in duration-700">
                <div className="flex items-center gap-2 text-yellow-400 animate-pulse-glow font-black tracking-[0.2em] text-[10px] md:text-3xl uppercase text-center px-4 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)] mb-4">
                  <Trophy size={14} className="md:size-8" /> 
                  {showdownWinners[currentShowdownIdx].rank === "!" ? "EVERYONE FOLDED" : `VICTORY: ${showdownWinners[currentShowdownIdx].name}`}
                </div>
                <div className="flex items-center gap-3 md:gap-8 bg-black/70 p-2 md:p-6 rounded-[1.5rem] md:rounded-[3.5rem] border-2 border-yellow-500/40 shadow-2xl min-w-[200px] md:min-w-[450px] animate-showdown-card-pop">
                    <div className="flex flex-col items-center shrink-0">
                        <div className="text-white font-black text-[12px] md:text-3xl drop-shadow-lg uppercase mb-0.5">{String(showdownWinners[currentShowdownIdx].name)}</div>
                        <ShowdownAmount target={showdownWinners[currentShowdownIdx].amount} />
                        <div className="text-yellow-400/80 text-[6px] md:text-[10px] tracking-widest uppercase mt-1.5 font-black italic">{String(showdownWinners[currentShowdownIdx].rank === "!" ? "POT SWEPT" : showdownWinners[currentShowdownIdx].rank)}</div>
                    </div>
                    {showdownWinners[currentShowdownIdx].rank !== "!" && (
                        <div className="flex gap-1 md:gap-2 items-center justify-center">
                            {(showdownWinners[currentShowdownIdx].hand || []).map((c, ci) => (
                                <div key={ci} className="w-6 md:w-16 h-9 md:h-24 bg-white rounded-sm md:rounded-xl flex flex-col items-center justify-center text-black shadow-lg ring-1 ring-black/5 relative overflow-hidden" 
                                    style={{ animation: `card-slam-showdown 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`, animationDelay: `${0.6 + ci * 0.15}s`, opacity: 0 }}>
                                    <span className={`text-[8px] md:text-[20px] font-black absolute top-0.5 left-1 leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span>
                                    <span className={`text-[12px] md:text-[36px] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
          ) : (
            <div className={`flex flex-col gap-2 md:gap-4 items-center w-full font-black uppercase transition-all duration-500 ${activeIdx !== heroIdx ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                {heroPlayerObj && !heroPlayerObj.isFolded && phase !== PHASES.IDLE ? (
                    <>
                        {/* BET SLIDER */}
                        <div className="w-full max-w-[600px] px-2 mt-4">
                          <input 
                            type="range" 
                            min={Math.min(heroPlayerObj.chips + heroPlayerObj.currentBet, highestBet === 0 ? 0.25 : highestBet * 2)}
                            max={heroPlayerObj.chips + heroPlayerObj.currentBet}
                            step={0.25}
                            value={raiseInput}
                            onChange={(e) => setRaiseInput(Number(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-all"
                          />
                          <div className="flex justify-between text-[8px] text-white/30 uppercase mt-1 tracking-widest font-black">
                            <span>Min Raise</span>
                            <span>All-In</span>
                          </div>
                        </div>

                        <div className="flex flex-row gap-1 w-full items-center justify-center font-black mt-4">
                            <button disabled={activeIdx !== heroIdx} onClick={()=>handleAction('FOLD')} className="flex-1 h-10 md:h-16 bg-red-950/60 border border-red-500/50 rounded-lg tracking-[0.1em] hover:brightness-125 transition-all font-black text-[10px] md:text-sm shadow-xl uppercase">FOLD</button>
                            <button disabled={activeIdx !== heroIdx} onClick={()=>handleAction('CALL')} className="flex-1 h-10 md:h-16 bg-indigo-900/60 border border-indigo-400/50 rounded-xl text-[10px] md:text-xl tracking-[0.1em] hover:brightness-125 font-black shadow-xl px-1 truncate">
                                {highestBet > (heroPlayerObj?.currentBet || 0) ? `CALL $${(highestBet - (heroPlayerObj?.currentBet || 0)).toLocaleString()}` : 'CHECK'}
                            </button>
                            <div className="flex-[2] flex gap-1 items-center bg-black/60 border border-white/10 p-0.5 md:p-1.5 rounded-lg shadow-inner overflow-hidden">
                                <div className="flex items-center bg-black/40 px-1 md:px-5 rounded-md border border-white/5 h-9 md:h-14 flex-1">
                                    <span className="text-[#fbbf24] text-[10px] md:text-xl font-mono mr-0.5">$</span>
                                    <input disabled={activeIdx !== heroIdx} type="number" step="0.25" value={raiseInput} onChange={(e) => setRaiseInput(Math.max(0, Number(e.target.value)))} className="w-full bg-transparent text-center font-mono text-xs md:text-2xl text-[#fbbf24] outline-none font-black" />
                                </div>
                                <button disabled={activeIdx !== heroIdx} onClick={()=>handleAction('RAISE', raiseInput)} className="flex-1 h-9 md:h-14 bg-emerald-600/60 border border-400/50 rounded-md flex items-center justify-center hover:brightness-125 font-black text-[9px] md:text-xl shadow-xl"><Zap size={10} className="mr-0.5 text-emerald-400"/> RAISE</button>
                            </div>
                        </div>

                        {/* Hand Strength / Win Prob HUD */}
                        <div className="flex justify-between w-full max-w-[600px] mt-4 px-1.5 pb-2">
                            <div className="flex flex-col items-start min-w-[80px]">
                                {activeVariant?.id === 'HILOW' && (
                                    <>
                                        <span className="text-[6px] md:text-[8px] text-white/40 tracking-[0.1em] font-black uppercase leading-none mb-1">Low Potential</span>
                                        <span className="text-[10px] md:text-[20px] text-emerald-400 font-black uppercase leading-none">
                                            {phase === PHASES.PRE_FLOP ? "WAITING..." : String(heroPlayerObj?.lowStrength || "---")}
                                        </span>
                                        <span className="text-[#fbbf24] text-[8px] md:text-[14px] font-mono font-black mt-1 tracking-tight">
                                            {phase === PHASES.PRE_FLOP ? '-' : Math.round(heroLowWinProb)}% CONFIDENCE
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="flex flex-col items-end min-w-[80px]">
                                <span className="text-[6px] md:text-[8px] text-white/40 tracking-[0.1em] font-black uppercase leading-none mb-1">
                                    {activeVariant?.id === 'HILOW' ? 'High Potential' : 'Current Evaluation'}
                                </span>
                                <span className="text-[10px] md:text-[20px] text-purple-400 font-black uppercase leading-none text-right">
                                    {phase === PHASES.PRE_FLOP ? "PRE-FLOP" : String(heroPlayerObj?.strength || "ANALYZING...")}
                                </span>
                                <span className="text-[#fbbf24] text-[8px] md:text-[14px] font-mono font-black mt-1 tracking-tight">
                                    {phase === PHASES.PRE_FLOP ? '-' : Math.round(heroWinProb)}% CONFIDENCE
                                </span>
                            </div>
                        </div>
                    </>
                ) : ( <div className="py-10 text-white/20 tracking-[0.4em] text-[10px] md:text-lg font-black italic uppercase text-center w-full">Arena Idle</div> )}
            </div>
          )}
        </div>
      </footer>
      <style>{`
          @keyframes scanline { 0% { top: 0; } 100% { top: 100%; } }
          .animate-scanline { animation: scanline 2s linear infinite; }
          @keyframes emergency-vibrate { 0% { transform: translate(0); } 20% { transform: translate(-0.2px, 0.2px); } 40% { transform: translate(-0.2px, -0.2px); } 60% { transform: translate(0.2px, 0.2px); } 80% { transform: translate(0.2px, -0.2px); } 100% { transform: translate(0); } }
          .animate-emergency-vibrate { animation: emergency-vibrate 0.1s linear infinite; }
          @keyframes flicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
          .animate-flicker { animation: flicker 0.4s infinite; }
          @keyframes action-glitch { 0% { transform: scale(0.5) skewX(20deg); opacity: 0; filter: blur(10px); } 30% { transform: scale(1.2) skewX(-10deg); opacity: 1; filter: blur(0px); } 100% { transform: scale(1) skewX(0); opacity: 1; } }
          .animate-action-glitch { animation: action-glitch 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
          @keyframes bet-slam-3d { 0% { transform: translate(-50%, -250%) scale(3) rotate(-15deg); opacity: 0; filter: blur(10px) brightness(5); } 15% { opacity: 1; } 70% { transform: translate(-50%, -50%) scale(0.9) rotate(5deg); filter: blur(0px) brightness(1.5); } 100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; } }
          .animate-bet-slam-3d { animation: bet-slam-3d 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; animation-delay: 0.15s; opacity: 0; }
          @keyframes impact-ring { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; border-width: 4px; } 100% { transform: translate(-50%, -50%) scale(10); opacity: 0; border-width: 1px; } }
          .animate-impact-ring { animation: impact-ring 0.6s ease-out forwards; animation-delay: 0.6s; }
          @keyframes muck-cards { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(-500px) rotate(180deg) scale(0.2); opacity: 0; } }
          .animate-muck-cards { animation: muck-cards 0.8s cubic-bezier(0.5, 0, 0.75, 0) forwards; }
          @keyframes coin-trail { 0% { transform: translate(0, 0) scale(1); opacity: 1; } 100% { transform: translate(var(--target-x), var(--target-y)) scale(0.5); opacity: 0; } }
          .coin-particle { animation: coin-trail 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
          .coin-0 { --target-x: -200px; --target-y: 200px; } .coin-1 { --target-x: 200px; --target-y: 200px; } .coin-2 { --target-x: 300px; --target-y: -200px; }
          @keyframes impact-shake { 0%, 100% { transform: translateY(0); } 25% { transform: translateY(2px) translateX(2px); } 50% { transform: translateY(-2px) translateX(-2px); } 75% { transform: translateY(1px) translateX(-1px); } }
          .animate-impact-shake { animation: impact-shake 0.3s cubic-bezier(.36,.07,.19,.97) both; }
          @keyframes pot-receive { 0% { transform: scale(1); } 40% { transform: scale(1.2) brightness(1.5); } 100% { transform: scale(1); } }
          .animate-pot-receive { animation: pot-receive 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
          .animate-pulse-glow { animation: pulse-glow 1.5s infinite ease-in-out; }
          @keyframes pulse-glow { 0% { box-shadow: 0 0 5px rgba(251,191,36,0.2); } 50% { box-shadow: 0 0 35px rgba(251,191,36,0.7); } 100% { box-shadow: 0 0 5px rgba(251,191,36,0.2); } }
          @keyframes card-slam-showdown { 0% { transform: translateY(-100px) scale(2); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
          html, body { overscroll-behavior-y: contain; height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
      `}</style>
    </div>
  );
};

export default App;
