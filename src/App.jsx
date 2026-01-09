import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare, Clock, BarChart3, Settings, Maximize, Minimize, Copy, Check, Activity, BookOpen, Terminal, ChevronRight as ChevronRightIcon, HelpCircle
} from 'lucide-react';
import io from 'socket.io-client';

// --- CONSTANTS ---
// VERSION: v1.0.88
const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { 
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000 
});

const VERSION = "v1.0.88";
const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const VARIANT_COLORS = {
  HOLDEM: '#22d3ee',
  OMAHA: '#a855f7',
  PINEAPPLE: '#eab308',
  MUFLIS: '#39FF14',
  HILOW: '#ff007f', 
  REDSBLACKS: '#ff0000'
};

const HILOW_SECONDARY_COLOR = '#bfff00'; 
const TABLE_FELT_COLOR = '#0f172a'; 

const getContrastColor = (hex) => {
  if (!hex) return 'white';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? 'black' : 'white';
};

const NEON_PALETTE = [
  'text-[#39FF14]', 'text-[#FF00FF]', 'text-[#00FFFF]', 'text-[#FF5F1F]', 'text-[#FFFF00]', 'text-[#B026FF]',
];

const getNeonNameColor = (name) => {
  if (!name || name === "SYSTEM") return "text-white";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return NEON_PALETTE[Math.abs(hash) % NEON_PALETTE.length];
};

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', rules: ["Each player gets 2 hole cards.", "Standard high hand rankings apply.", "Best 5-card combination from 2 hole + 5 community cards wins."] }, 
  OMAHA: { id: 'OMAHA', name: 'Omaha', rules: ["Each player gets 4 hole cards.", "You MUST use EXACTLY 2 hole cards and 3 community cards.", "Standard high hand rankings apply."] }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', rules: ["Each player gets 3 hole cards.", "Standard high hand rankings.", "Similar to Hold'em but with an extra card for better drawing potential."] }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', rules: ["Worst hand wins the pot.", "Ace is the lowest card (value 1).", "The 'best' hand is the one that would normally be the weakest.", "You MUST use BOTH hole cards and 3 board cards."] }, 
  HILOW: { id: 'HILOW', name: 'Hi-Low Split', rules: ["Pot is split 50/50 between the High hand and the Low hand.", "4 hole cards dealt.", "Must use 2 hole + 3 board cards for both halves.", "All hands qualify for the low half; straights and flushes count against you."] }, 
  REDSBLACKS: { id: 'REDSBLACKS', name: 'Reds & Blacks', rules: ["4 hole cards dealt.", "Special Joker mechanic: If your hand contains color combinations, you may play with enhanced strength.", "Dynamic wildcards based on suit parity."] }
};

const DISPLAY_POSITIONS = [
  { x: 50, y: 92 }, { x: 25, y: 84 }, { x: 10, y: 62 }, { x: 10, y: 38 }, { x: 25, y: 16 },
  { x: 50, y: 8  }, { x: 75, y: 16 }, { x: 90, y: 38 }, { x: 90, y: 62 }, { x: 75, y: 84 }
];

const DashTimer = ({ timeRemaining }) => {
  const percentage = Math.max(0, (timeRemaining / 24) * 100);
  const color = timeRemaining < 6 ? '#ef4444' : timeRemaining < 12 ? '#f59e0b' : '#22d3ee';
  return (
    <div className="w-24 md:w-32 h-1.5 bg-white/10 rounded-full relative mt-1 overflow-hidden">
      <div className="absolute inset-0 flex gap-1 items-center px-1">
        {Array.from({ length: 8 }).map((_, i) => (<div key={`bg-seg-${i}`} className="h-1 flex-1 bg-white/5 rounded-full" />))}
      </div>
      <div className="absolute inset-0 overflow-hidden transition-all duration-1000 linear" style={{ width: `${percentage}%` }}>
        <div className="w-24 md:w-32 h-full flex gap-1 items-center px-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`timer-seg-${i}`} className="h-1 flex-1 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
          ))}
        </div>
      </div>
    </div>
  );
};

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  isDealer, potTransferring, timeRemaining, isHero, 
  relativeIdx, visuals, bigBlind, showdownWinners, formatRank
}) => {
    const [ghostAction, setGhostAction] = useState(null);
    const lastActionStr = player?.lastAction || "";
    const currentBetNum = player?.currentBet || 0;
    const isFoldedBool = player?.isFolded || false;
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    
    const vecX = 50 - displayPos.x;
    const vecY = 50 - displayPos.y;
    const cardInwardX = isMobile ? vecX * 0.15 : vecX * 0.12;
    const cardInwardY = isMobile ? vecY * 0.20 : vecY * 0.18;

    const currentAction = useMemo(() => {
        if (!player) return null;
        if (isFoldedBool) return { text: "FOLDED", color: "text-red-500", glow: "shadow-[0_0_30px_rgba(239,68,68,0.8)]" };
        if (phase === PHASES.PRE_FLOP && currentBetNum > 0 && !lastActionStr) {
            if (currentBetNum === bigBlind) return { text: `BB $${currentBetNum}`, color: "text-indigo-400", glow: "shadow-[0_0_30px_rgba(129,140,248,0.8)]" };
            return { text: `SB $${currentBetNum}`, color: "text-purple-400", glow: "shadow-[0_0_30px_rgba(168,85,247,0.8)]" };
        }
        if (!lastActionStr) return null;
        switch (lastActionStr) {
            case 'RAISE': return { text: `RAISE $${currentBetNum}`, color: "text-orange-500", glow: "shadow-[0_0_30px_rgba(249,115,22,0.8)]" };
            case 'CALL': return { text: `CALL $${currentBetNum}`, color: "text-emerald-400", glow: "shadow-[0_0_30px_rgba(52,211,153,0.8)]" };
            case 'CHECK': return { text: "CHECK", color: "text-slate-400", glow: "shadow-[0_0_30px_rgba(148,163,184,0.5)]" };
            default: return null;
        }
    }, [lastActionStr, currentBetNum, isFoldedBool, phase, bigBlind]);

    useEffect(() => {
        if (currentAction) {
            setGhostAction(currentAction);
        } else if (isCollectingBets) {
            const timer = setTimeout(() => setGhostAction(null), 2000);
            return () => clearTimeout(timer);
        } else {
            setGhostAction(null);
        }
    }, [currentAction, isCollectingBets]);

    if (!player || !displayPos) return null;

    const isMuckWin = phase === PHASES.SHOWDOWN && showdownWinners?.some(w => w.rank === "!");
    const shouldRevealCards = isHero || (phase === PHASES.SHOWDOWN && !isMuckWin);
    const cardZIndex = isHero ? 'z-[200]' : 'z-[80]';

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500 ${isHero ? 'z-[100]' : 'z-20'} ${player.waitingForNextHand ? 'opacity-50' : ''}`}>
            {player.waitingForNextHand && (<div className="absolute top-[-35px] bg-slate-900 text-cyan-400 text-[8px] px-2 py-0.5 rounded-full border border-cyan-500/50 uppercase font-bold tracking-[0.2em] z-[150] backdrop-blur-md">WAITING</div>)}
            
            {/* HOLE CARDS */}
            {player.hand && Array.isArray(player.hand) && !player.waitingForNextHand && (
                <div 
                  className={`flex items-center justify-center w-[15vw] lg:w-[12vh] h-[8vw] lg:h-[8vh] pointer-events-none transition-all duration-500 ${cardZIndex} ${isHero ? 'absolute' : 'relative -mb-[5.25vw] lg:-mb-[4vh]'} ${isFoldedBool ? 'opacity-30 grayscale scale-90' : 'opacity-100'}`} 
                  style={isHero ? { transform: isMobile ? `translate(${cardInwardX}vw, ${cardInwardY}vw)` : `translate(${cardInwardX * 0.4}vh, calc(${cardInwardY * 0.4}vh - 140px))` } : {}}
                >
                    {player.hand.map((c, ci) => {
                        const offset = ci - (player.hand.length - 1) / 2;
                        const cardSpacing = isHero ? 3 : 1.8;
                        const rotation = isHero ? (offset * visuals.holeCardFan) : 0;
                        const scaleBase = isHero ? (isMobile ? 3.68 : 6.44) : 1.0;
                        const isRed = c.suit === '♥' || c.suit === '♦';
                        const isWinningCard = (winning5Ids || []).includes(c.id);
                        const isHighlighted = phase === PHASES.SHOWDOWN && player.isWinner && isWinningCard && !isMuckWin;

                        return (
                          <div 
                            key={`${c.id || ci}-${ci}`} 
                            className={`w-[7.5vw] lg:w-[5.5vh] h-[10.5vw] lg:h-[8vh] rounded-lg flex flex-col items-start justify-start p-1 border absolute transition-all duration-300 shadow-2xl ${shouldRevealCards ? 'bg-white' : 'bg-slate-900 border-white/20'} ${isHighlighted ? 'ring-4 ring-yellow-400 scale-110 shadow-[0_0_30px_#fbbf24] z-[300]' : ''}`} 
                            style={{ 
                              transform: `translateX(${offset * cardSpacing}${isMobile ? 'vw' : 'vh'}) rotate(${rotation}deg) scale(${isHighlighted ? 1.1 : 1.0})`, 
                              transformOrigin: 'bottom center', 
                              zIndex: isHighlighted ? 350 : 100 + ci 
                            }}
                          >
                              {shouldRevealCards && (<><span className={`text-[10px] lg:text-[1.4vh] font-black leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{String(c.value)}</span><span className={`text-[12px] lg:text-[2vh] leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{String(c.suit)}</span></>)}
                              {isHighlighted && (<div className="absolute inset-0 ring-4 ring-yellow-400 rounded-lg animate-pulse" />)}
                          </div>
                        );
                    })}
                </div>
            )}

            {/* PLAYER HUD WRAPPER */}
            <div className="relative flex flex-col items-center">
                {/* NAME HUD */}
                <div className={`relative z-[90] flex flex-col items-center p-2 lg:p-3 rounded-xl border transition-all duration-300 min-w-[120px] lg:min-w-[14vh] overflow-hidden backdrop-blur-xl scale-[0.85] ${isActiveTurn ? 'border-white ring-4 ring-white/20 bg-slate-800 shadow-[0_0_40px_rgba(255,255,255,0.2)]' : 'border-white/10 bg-black/80'} ${player.isWinner && phase === PHASES.SHOWDOWN ? 'border-yellow-400 ring-2 ring-yellow-400/50' : ''} ${isFoldedBool ? 'opacity-30 grayscale' : 'opacity-100'}`}>
                    
                    {/* DEALER INDICATOR */}
                    {isDealer && (
                        <div className="absolute top-2 right-2 z-[100] pointer-events-none">
                          <div className="w-2.5 h-2.5 bg-red-900 rounded-full border border-red-950 shadow-[inset_0_0_4px_rgba(0,0,0,0.5)]" />
                        </div>
                    )}

                    {currentAction && isFoldedBool && (<div key={`action-overlay-${String(currentAction.text)}`} className={`absolute inset-0 z-50 flex items-center justify-center bg-black/60 animate-action-flash-once border-2 rounded-xl border-white/40 ${currentAction.glow}`}><span className={`text-sm lg:text-lg font-black italic uppercase tracking-tighter text-center px-2 drop-shadow-[0_0_10px_rgba(0,0,0,1)] ${currentAction.color}`}>{String(currentAction.text)}</span></div>)}
                    {player.isDisconnected && (<div className="absolute inset-0 z-[150] bg-red-950/60 backdrop-blur-[1px] flex items-center justify-center border border-red-500/40 rounded-xl overflow-hidden"><span className="text-white text-[10px] md:text-xs font-black animate-pulse uppercase tracking-[0.2em] px-2 text-center">LINK LOST • SECURED</span></div>)}
                    <div className="flex flex-col items-center w-full relative z-10 py-1 overflow-hidden">
                        <div className="flex flex-col items-center gap-0.5 shrink-0 mb-1">
                          <div className="flex items-center gap-1 opacity-60">
                            {player.isBot && <Bot size={10} className="text-indigo-400" />}
                            <span className="text-[12px] lg:text-[1.6vh] font-black text-white uppercase tracking-wider truncate max-w-[80px] lg:max-w-[12vh]">{String(player.name)}</span>
                          </div>
                          {phase === PHASES.SHOWDOWN && !isFoldedBool && player.strength && (
                            <div className="text-[8px] lg:text-[1.1vh] text-cyan-400 font-bold tracking-tighter animate-in fade-in slide-in-from-bottom-1 duration-500 whitespace-nowrap overflow-hidden">
                              {formatRank(player.strength)}
                            </div>
                          )}
                        </div>
                        <div className="w-full h-[24px] lg:h-[3.5vh] relative flex items-center justify-center">
                            <div 
                                className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${ghostAction && !isFoldedBool ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}
                            >
                                {player.chips <= 0 && !isFoldedBool && phase !== PHASES.IDLE && !player.waitingForNextHand ? (
                                    <span className="text-[14px] lg:text-[2.2vh] font-black italic uppercase text-red-500 leading-none tracking-tighter">
                                        All-in ${Number(player.totalContribution + (player.currentBet || 0)).toLocaleString(undefined, {minimumFractionDigits: 0})}
                                    </span>
                                ) : (
                                    <span className={`text-[18px] lg:text-[2.8vh] font-mono font-black ${player.chips <= 0 ? 'text-red-500' : 'text-emerald-400'} leading-none tracking-tighter`}>
                                        ${Number(player.chips).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </span>
                                )}
                            </div>
                            {ghostAction && !isFoldedBool && (
                                <div className={`absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg transition-opacity duration-500 ${isCollectingBets ? 'opacity-50 animate-pulse' : 'opacity-100 animate-action-flash-once'}`}>
                                    <span className={`text-[14px] lg:text-[2.2vh] font-black italic uppercase tracking-tight text-center px-1 drop-shadow-md whitespace-nowrap ${ghostAction.color}`}>{String(ghostAction.text)}</span>
                                </div>
                            )}
                        </div>
                        {isActiveTurn && <DashTimer timeRemaining={timeRemaining} />}
                    </div>
                </div>
            </div>
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
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dealerIdx, setDealerIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [bigBlind, setBigBlind] = useState(2);
  const [minRaiseAmount, setMinRaiseAmount] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(24);
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState(100); 
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [currentShowdownIdx, setCurrentShowdownIdx] = useState(0);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [showVisualControls, setShowVisualControls] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [expandedHands, setExpandedHands] = useState(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [announcement, setAnnouncement] = useState(null); 
  const [rebuyAmount, setRebuyAmount] = useState(100);
  const [showRebuyModal, setShowRebuyModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [preAction, setPreAction] = useState(null);
  const [handAttention, setHandAttention] = useState(false);
  const [dealAttention, setDealAttention] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 1000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 1, bb: 2, minBuy: 50, maxBuy: 100, pendingVariant: 'HOLDEM' });
  const [noiseSeed, setNoiseSeed] = useState(1);

  const joinLock = useRef(false);
  const phaseRef = useRef(PHASES.IDLE); 
  const currentHandId = useRef(Date.now());
  const turnInitializedRef = useRef(-1); 

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  const [visuals, setVisuals] = useState({ 
    heroCardScale: 2.0, 
    heroCardY: 20, 
    oppCardScale: 1.0, 
    oppCardY: -10, 
    commCardScale: 1.5, 
    commCardY: 0, 
    betScale: 1.5, 
    betY: 0, 
    badgeY: 0, 
    footerHeight: 250, 
    tableZoom: 0.9, 
    holeCardFan: 35 
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setNoiseSeed(s => (s + 1) % 1000);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => p && (p.uid === userProfile.uid || p.name === userProfile.name));
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);
  
  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + (Number(p?.currentBet) || 0), 0);
    return Number(potAmount) + currentBetsSum;
  }, [potAmount, players]);

  const handleForceSync = useCallback(() => {
    socket.disconnect().connect();
    socket.emit('getInitialData');
    if (currentRoomId && userProfile) {
      socket.emit('joinRoom', { roomId: currentRoomId, profile: userProfile, buyIn: 0 });
    }
  }, [currentRoomId, userProfile]);

  const handleAction = useCallback((type, amt = 0) => {
    const finalAmount = amt !== 0 ? amt : raiseInput;
    if (currentRoomId) {
      socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(finalAmount) : 0 });
    }
  }, [currentRoomId, raiseInput]);

  const handleAllIn = useCallback(() => {
    if (!heroPlayerObj) return;
    handleAction('RAISE', Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet));
  }, [heroPlayerObj, handleAction]);

  const handleRebuy = useCallback(() => {
    if (!currentRoomId || !userProfile) return;
    socket.emit('playerRebuy', { roomId: currentRoomId, uid: userProfile.uid, amount: rebuyAmount });
    setShowRebuyModal(false);
  }, [currentRoomId, userProfile, rebuyAmount]);

  const handleLogin = useCallback(() => { 
    if (passwordInput.toLowerCase().trim() === 'pass') { 
        setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin' }); 
        setCurrentView(VIEWS.ADMIN); 
        socket.emit('getInitialData'); 
    } else {
        socket.emit('playerLogin', { password: passwordInput.toLowerCase().trim() });
    }
  }, [passwordInput]);

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile || joinLock.current) return;
    joinLock.current = true; 
    setIsJoining(true);
    socket.emit('joinRoom', { 
      roomId: selectedTableForJoin.id, 
      profile: { ...userProfile, pendingVariant: pendingVariantId }, 
      buyIn: Math.min(buyInAmount, userProfile.chips) 
    }, (res) => {
        joinLock.current = false; 
        setIsJoining(false);
        if (res?.status === 'ok') { 
          setCurrentRoomId(selectedTableForJoin.id); 
          setCurrentView(VIEWS.GAME); 
          setSelectedTableForJoin(null); 
        }
    });
  }, [selectedTableForJoin, userProfile, pendingVariantId, buyInAmount]);

  const formatRank = (rank) => {
    if (!rank || typeof rank !== 'string' || rank === "null" || rank === "No Qualifier") return rank || "";
    if (rank.includes(" & ")) return rank.split(" & ").map(r => formatRank(r)).join(" & ");
    
    const lower = rank.toLowerCase();
    let prefix = "";
    if (lower.startsWith("high: ")) prefix = "HIGH: ";
    else if (lower.startsWith("low: ")) prefix = "LOW: ";
    else if (lower.startsWith("scoop: ")) prefix = "SCOOP: ";
    
    const cleanRank = rank.replace(/^(high|low|scoop): /i, "");
    const cleanLower = cleanRank.toLowerCase();
    let result = cleanRank;

    const getVal = (str) => str.split(' ').pop();

    if (cleanLower.includes("five of a kind")) {
      result = `5 of a KIND, ${getVal(cleanRank)}`;
    } else if (cleanLower.includes("straight flush")) {
      result = "STRAIGHT FLUSH";
    } else if (cleanLower.includes("four of a kind")) {
      result = `4 of a KIND, ${getVal(cleanRank)}`;
    } else if (cleanLower.includes("full house")) {
      result = cleanRank.toUpperCase();
    } else if (cleanLower.includes("three of a kind")) {
      result = `3 of a KIND, ${getVal(cleanRank)}`;
    } else if (cleanLower.includes("two pair")) {
      result = "Two Pair, " + cleanRank.split(' ').slice(-3).join(' '); 
    } else if (cleanLower.includes("pair")) {
      result = `Pair, ${getVal(cleanRank)}`;
    } else if (cleanLower.includes("high card")) {
      result = `High ${getVal(cleanRank)}`;
    } else if (cleanLower.includes("low")) {
      result = `Low ${getVal(cleanRank)}`;
    }

    return prefix + result;
  };

  // UPDATED: Dynamic Hand Strength Intensity with "Low 6" prioritization
  const getStrengthClass = (strength) => {
    if (!strength) return "";
    const s = strength.toLowerCase();
    
    // NEW: Low hand priority for Muflis and Low portion of Hi-Low
    if (s.includes("low") || s.includes("high card")) {
      // Best possible lows in Hi-Low/Muflis context get Monster intensity
      if (s.includes(" 5") || s.includes(" 6")) return "strength-hi-res-monster";
      if (s.includes(" 7") || s.includes(" 8")) return "strength-hi-res-strong";
      if (s.includes(" 9") || s.includes(" 10")) return "strength-hi-res-ember";
      return "strength-hi-res-smolder";
    }

    if (s.includes("straight flush") || s.includes("4 of a kind") || s.includes("full house") || s.includes("5 of a kind")) {
      return "strength-hi-res-monster";
    }
    if (s.includes("flush") || s.includes("straight") || s.includes("3 of a kind")) {
      return "strength-hi-res-strong";
    }
    if (s.includes("pair")) {
      return "strength-hi-res-ember";
    }
    return "strength-hi-res-smolder";
  };

  const handHistory = useMemo(() => {
    const hands = []; 
    let currentHand = null;
    ([...logs].reverse()).forEach(log => {
        if (String(log.action).includes("IS DEALING") || String(log.action).includes("PRE_FLOP DEALT")) {
            if (currentHand) hands.push(currentHand);
            currentHand = { 
              id: log.handId || `hand-${log.timestamp}-${Math.random()}`, 
              winner: null, 
              rank: null, 
              amount: null, 
              events: [], 
              variant: String(log.action).split('DEALING ')[1] || "Poker" 
            };
        }
        if (currentHand) {
            currentHand.events.push(log);
            if (log.type === 'win') {
                const match = String(log.action).match(/WON \$([\d.]+) WITH (.*)/);
                const matchScoop = String(log.action).match(/SCOOPED THE POT \$([\d.]+)/);
                if (match) { 
                  currentHand.winner = log.name; 
                  currentHand.amount = match[1]; 
                  currentHand.rank = match[2]; 
                } else if (matchScoop) { 
                  currentHand.winner = log.name; 
                  currentHand.amount = matchScoop[1]; 
                  currentHand.rank = "Muck/Default"; 
                }
            }
        }
    });
    if (currentHand) hands.push(currentHand);
    return hands.reverse();
  }, [logs]);

  const copyActivityToClipboard = () => {
    let text = "--- DEALER'S CHOICE POKER ARE ---\n\n";
    handHistory.forEach(hand => {
      text += `[${hand.variant.toUpperCase()} HAND]\n`;
      hand.events.forEach(ev => { 
        text += `[${new Date(ev.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}] ${ev.name}: ${ev.action}\n`; 
      });
      if (hand.winner) text += `RESULT: ${hand.winner} WON $${hand.amount} with ${hand.rank}\n`;
      text += "---------------------------------------\n\n";
    });
    const textArea = document.createElement("textarea"); 
    textArea.value = text; 
    document.body.appendChild(textArea); 
    textArea.select();
    try { document.execCommand('copy'); } catch (err) {} 
    document.body.removeChild(textArea);
  };

  const ActivityFeedContent = () => (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
        <div className="flex items-center justify-between text-indigo-400 text-[10px] mb-4 border-b border-indigo-500/20 pb-2 font-black tracking-[0.2em] uppercase">
            <div className="flex items-center gap-2"><Terminal size={14}/> Activity Log</div>
            <div className="flex items-center gap-2">
                <button onClick={copyActivityToClipboard} className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1 transition-all active:scale-95"><Copy size={10} /> Copy</button>
                {isMobile && <button onClick={() => setIntelExpanded(false)} className="text-white/30 hover:text-white"><X size={14}/></button>}
            </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 pr-1 font-black">
            {handHistory.length > 0 ? handHistory.map((hand) => (
                <div key={hand.id} className="border border-white/5 rounded-xl overflow-hidden bg-white/5">
                    <button onClick={() => { 
                      const n = new Set(expandedHands); 
                      if (n.has(hand.id)) n.delete(hand.id); 
                      else n.add(hand.id); 
                      setExpandedHands(n); 
                    }} className="w-full p-3 flex flex-col items-start gap-1 transition-all hover:bg-white/5">
                        <div className="flex items-center justify-between w-full">
                            <span className="text-[9px] text-indigo-400 font-bold tracking-widest uppercase">{String(hand.variant)} HAND</span>
                            <ChevronRightIcon size={12} className={`transition-transform text-white/40 ${expandedHands.has(hand.id) ? 'rotate-90' : ''}`} />
                        </div>
                        <div className="text-[11px] text-white/90 text-left">
                            {hand.winner ? (<span className="flex items-center gap-2 text-emerald-400 uppercase"><Trophy size={10} /> <span className={getNeonNameColor(hand.winner)}>{String(hand.winner)}</span> WON ${String(hand.amount)}</span>) : (<span className="text-white/40 italic uppercase">HAND IN PROGRESS...</span>)}
                        </div>
                        {hand.winner && (<div className="text-[9px] text-white/40 font-bold truncate w-full text-left uppercase">{formatRank(String(hand.rank))}</div>)}
                    </button>
                    {expandedHands.has(hand.id) && (
                      <div className="px-3 pb-3 border-t border-white/5 bg-black/40 space-y-1 pt-2">
                        {hand.events.map((ev, i) => (
                          <div key={ev.uniqueKey || `ev-${i}`} className={`text-[9px] md:text-[10px] leading-tight py-1 border-l-2 pl-2 ${ev.type === 'win' ? 'border-emerald-500 bg-emerald-500/5' : ev.type === 'fold' ? 'border-red-500 bg-red-500/5' : 'border-indigo-500 bg-indigo-500/5'}`}>
                            <span className="text-white/30 font-mono mr-2 uppercase">[{new Date(ev.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}]</span> 
                            <span className={getNeonNameColor(ev.name)}>{String(ev.name)}</span>: <span className="text-white/90 uppercase">{String(ev.action)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
            )) : (<div className="flex flex-col items-center justify-center py-20 text-white/10 gap-3"><Activity size={32} className="animate-pulse" /><span className="text-[10px] tracking-widest font-black uppercase">Scanning for hand data...</span></div>)}
        </div>
    </div>
  );

  useEffect(() => {
    const handleRoomUpdate = (d) => {
        if (!d) return;
        setPlayers(() => { 
          const next = Array(TOTAL_SEATS).fill(null); 
          (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
          return next; 
        });
        const isPhaseTransition = d.phase !== phaseRef.current;
        if (isPhaseTransition && d.phase === PHASES.PRE_FLOP) {
            const vId = d.activeVariant?.id || 'HOLDEM';
            setAnnouncement({ text: VARIANTS[vId]?.name || "Poker", color: VARIANT_COLORS[vId] || '#fff' });
            setTimeout(() => setAnnouncement(null), 1500);
            currentHandId.current = Date.now();
        }
        if (isPhaseTransition && [PHASES.FLOP, PHASES.TURN, PHASES.RIVER].includes(d.phase)) {
            const cardString = d.community?.map(c => `${c.value}${c.suit}`).join(' ') || "";
            setLogs(prev => [{ 
              name: "SYSTEM", 
              action: `${d.phase} DEALT [ ${cardString} ]`, 
              type: 'phase', 
              handId: currentHandId.current, 
              timestamp: Date.now(), 
              uniqueKey: `board-${Date.now()}` 
            }, ...prev]);
            setHandAttention(true);
            setTimeout(() => { 
              setHandAttention(false); 
              setDealAttention(true); 
              setTimeout(() => setDealAttention(false), 1000); 
            }, 3000);
            
            if (d.phase === PHASES.TURN) {
                const vId = d.activeVariant?.id || 'HOLDEM';
                setTimeout(() => { 
                  setAnnouncement({ text: VARIANTS[vId]?.name || "Poker", color: VARIANT_COLORS[vId] || '#fff' }); 
                  setTimeout(() => setAnnouncement(null), 1500); 
                }, 3000); 
            }
        }
        phaseRef.current = d.phase;
        setPhase(d.phase); 
        setCommunity(d.community || []); 
        setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0); 
        setActiveIdx(d.activeIdx ?? -1); 
        setHighestBet(d.highestBet || 0); 
        if (d.bb) setBigBlind(d.bb); 
        if (d.minRaiseAmount !== undefined) setMinRaiseAmount(d.minRaiseAmount); 
        setDealerIdx(d.dealerIdx ?? -1); 
        setTimeRemaining(d.timeRemaining || 0);
        if (d.activeVariant) { 
          const vId = typeof d.activeVariant === 'string' ? d.activeVariant : d.activeVariant.id; 
          setActiveVariant(VARIANTS[vId] || { id: vId, name: d.activeVariant.name || vId, rules: [] }); 
        }
        
        if (d.phase === PHASES.SHOWDOWN && !showdownWinners) {
            setPotTransferring(true); 
            setCurrentShowdownIdx(0); 
            const rawWinners = d.showdownWinners || []; 
            setShowdownWinners(rawWinners); 
            setWinning5Ids(rawWinners[0]?.winning5Ids || d.winning5Ids || []);
            const dur = rawWinners.some(w => w.rank === "!") ? 2000 : 5000;
            if (rawWinners.length > 1) { 
                for (let i = 1; i < rawWinners.length; i++) { 
                    setTimeout(() => { 
                        if (phaseRef.current === PHASES.SHOWDOWN) {
                            setCurrentShowdownIdx(i);
                            setWinning5Ids(rawWinners[i]?.winning5Ids || []);
                        }
                    }, i * dur); 
                } 
            }
            setTimeout(() => setPotTransferring(false), Math.max(1, rawWinners.length) * dur);
        } else if (d.phase !== PHASES.SHOWDOWN) { 
          setPotTransferring(false); 
          setShowdownWinners(null); 
        }
    };
    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('lobbyUpdate', setActiveTables);
    socket.on('log', (l) => setLogs(prev => [{...l, handId: currentHandId.current, timestamp: Date.now(), uniqueKey: `${Date.now()}-${Math.random()}`}, ...prev].slice(0, 100)));
    socket.on('profilesUpdate', (list) => { 
      setAllProfiles(list); 
      setUserProfile(prev => { 
        if (!prev) return null; 
        const updated = list.find(p => p.uid === prev.uid); 
        return updated ? { ...prev, chips: updated.chips } : prev; 
      }); 
    });
    socket.on('initialDataResponse', ({ profiles: pList, rooms: rList }) => { 
      setAllProfiles(pList); 
      setActiveTables(rList); 
    });
    
    socket.on('loginSuccess', (p) => { 
        const prof = p.profile || p; 
        setUserProfile(prof); 
        setPendingVariantId(prof.pendingVariant || 'HOLDEM'); 
        socket.emit('getInitialData'); 

        if (prof.role === 'admin') {
            setCurrentView(VIEWS.ADMIN);
            return;
        }

        if (p.activeRoomId) { 
            setCurrentRoomId(p.activeRoomId); 
            socket.emit('joinRoom', { roomId: p.activeRoomId, profile: prof, buyIn: 0 }, (res) => { 
                if (res?.status === 'ok') setCurrentView(VIEWS.GAME); 
                else setCurrentView(VIEWS.LOBBY); 
            }); 
        } else setCurrentView(VIEWS.LOBBY); 
    });
    
    return () => { 
      socket.off('roomUpdate'); 
      socket.off('lobbyUpdate'); 
      socket.off('profilesUpdate'); 
      socket.off('initialDataResponse'); 
      socket.off('loginSuccess'); 
      socket.off('log'); 
    };
  }, [showdownWinners]);

  useEffect(() => {
    if (activeIdx === heroIdx && heroPlayerObj && turnInitializedRef.current !== activeIdx) {
      turnInitializedRef.current = activeIdx;
      const min = minRaiseAmount || (highestBet + bigBlind);
      setRaiseInput(Math.min(min, Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet)));
      if (preAction === 'FOLD') { 
        handleAction('FOLD'); 
        setPreAction(null); 
      } else if (preAction === 'CHECK') { 
        handleAction('CALL'); 
        setPreAction(null); 
      }
    } else if (activeIdx !== heroIdx) { 
      turnInitializedRef.current = -1; 
    }
  }, [activeIdx, heroIdx, heroPlayerObj, highestBet, bigBlind, minRaiseAmount, preAction, handleAction]);

  if (currentView === VIEWS.LOGIN) return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#06080c] flex items-center justify-center p-6 text-white uppercase font-black">
        <div className="w-full max-w-[400px] p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-2">
                <Lock size={32} className="text-[#fbbf24] animate-pulse" />
                <span className="text-white/20 text-[10px] font-mono tracking-widest">{VERSION}</span>
            </div>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-xl font-black focus:bg-white/10 transition-all"/>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl font-black text-lg hover:scale-105 active:scale-95 transition-transform uppercase">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#06080c] flex flex-col md:flex-row text-white uppercase font-black overflow-hidden pt-[env(safe-area-inset-top)]">
        <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-4 md:p-8 flex flex-row md:flex-col gap-2 md:gap-4 bg-black/20 shrink-0">
            <h2 className="hidden md:flex text-[#fbbf24] items-center gap-2 mb-4 font-black"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-3 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-3 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>TABLES</button>
            <button onClick={()=>{
              if(!nuclearConfirm){
                setNuclearConfirm(true); 
                setTimeout(()=>setNuclearConfirm(false),3000); 
                return;
              } 
              socket.emit('adminNuclearReset'); 
              setNuclearConfirm(false);
            }} className={`flex-1 md:flex-none p-3 rounded-xl flex items-center justify-center gap-2 border-2 transition-all uppercase ${nuclearConfirm ? 'bg-red-600 border-white text-white' : 'bg-white/5 text-red-500 border-red-500/20'}`}>
                <Bomb size={14}/> {nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}
            </button>
            <button onClick={()=>{setCurrentView(VIEWS.LOBBY); socket.emit('getInitialData');}} className="flex-1 md:flex-none p-3 rounded-xl bg-cyan-600 text-black font-black text-[9px] md:text-xs">BACK TO LOBBY</button>
        </aside>
        <main className="flex-1 p-5 md:p-12 overflow-y-auto bg-black/40">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-[#fbbf24] pl-4 font-black">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm"/>
                        <button onClick={() => { if (!newPlayer.name.trim()) return; socket.emit('adminCreatePlayer', { ...newPlayer, uid: 'p_' + Math.random().toString(36).slice(2, 7) }); setNewPlayer({ ...newPlayer, name: '', password: '' }); }} className="bg-[#fbbf24] text-black rounded-xl font-black p-3 text-sm">CREATE PLAYER</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                        {allProfiles.length > 0 ? allProfiles.map(p => (
                            <div key={p.uid} className="flex justify-between p-3 md:p-4 border-b border-white/5 items-center hover:bg-white/5">
                                <span className="text-[10px] md:text-sm font-black truncate max-w-[100px]">{String(p.name)}</span>
                                <div className="flex gap-2 md:gap-4 items-center">
                                  <span className="text-emerald-400 font-mono text-xs md:text-lg">${Number(p.chips || 0).toLocaleString()}</span>
                                  <button onClick={()=>{const n = prompt("NEW WALLET", String(p.chips || 0)); if(n !== null && n !== "") socket.emit('adminUpdatePlayer', {uid: p.uid, chips: Number(n)})}} className="text-cyan-400" title="Edit Wallet"><Edit3 size={14}/></button>
                                  <button onClick={()=>{const n = prompt("NEW PASSWORD", String(p.password || "")); if(n !== null && n !== "") socket.emit('adminUpdatePlayer', {uid: p.uid, password: n})}} className="text-amber-400" title="Edit Password"><Key size={14}/></button>
                                  <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        )) : <div className="p-10 text-center text-white/20">NO PLAYERS REGISTERED</div>}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-emerald-500 pl-4 font-black">ARENA CONTROL</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border border-white/10">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm"/>
                        <div className="flex gap-2">
                          <input type="number" step="0.05" value={newTable.sb} onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})} placeholder="SB" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm w-1/2"/>
                          <input type="number" step="0.05" value={newTable.bb} onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})} placeholder="BB" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm w-1/2"/>
                        </div>
                        <div className="flex gap-2">
                          <input type="number" value={newTable.minBuy} onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})} placeholder="MIN BUY" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm w-1/2"/>
                          <input type="number" value={newTable.maxBuy} onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})} placeholder="MAX BUY" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white text-sm w-1/2"/>
                        </div>
                        <button onClick={() => { if (!newTable.name.trim()) return; socket.emit('adminCreateRoom', { ...newTable, id: 'room_' + Date.now().toString(36), sb: Number(newTable.sb), bb: Number(newTable.bb), minBuy: Number(newTable.minBuy), maxBuy: Number(newTable.maxBuy) }); setNewTable({ ...newTable, name: '' }); }} className="bg-emerald-600 text-white rounded-xl font-black p-3 text-sm lg:col-span-3">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 md:gap-4">
                        {activeTables.length > 0 ? activeTables.map(t => (
                            <div key={t.id} className="bg-white/5 p-3 rounded-2xl flex justify-between items-center border border-white/10">
                              <div><h4 className="text-[#fbbf24] font-black text-xs md:text-base">{String(t.name)}</h4><p className="text-[8px] text-white/40 tracking-widest uppercase">${t.sb}/${t.bb} • Buy-in: ${t.minBuy}-${t.maxBuy}</p></div>
                              <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 px-2 py-1.5 rounded-xl text-red-500 font-black text-[8px]">TERMINATE</button>
                            </div>
                        )) : <div className="p-10 text-center text-white/20">NO ACTIVE ARENAS</div>}
                    </div>
                </div>
            )}
        </main>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#000] flex flex-col text-white font-black uppercase overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6">
              <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-emerald-500/30 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.2)] flex flex-col gap-10">
                <h3 className="text-3xl text-center text-emerald-400 uppercase font-black">{String(selectedTableForJoin.name)}</h3>
                <div className="space-y-4 font-black text-center uppercase">
                  <div className="flex justify-between items-center text-[10px] text-white/40 tracking-[0.2em] font-black"><span>SEATING AMOUNT</span><span className="text-emerald-400 text-2xl font-mono">${Math.min(buyInAmount, userProfile?.chips || 0).toLocaleString()}</span></div>
                  <input type="range" min={selectedTableForJoin.minBuy || 50} max={Math.min(selectedTableForJoin.maxBuy || 100, userProfile?.chips || 100)} step={1} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                </div>
                <div className="flex gap-4"><button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-4 bg-white/5 border border-white/10 rounded-xl font-black text-xs uppercase">CANCEL</button><button onClick={joinRoom} disabled={isJoining} className="flex-2 p-4 bg-emerald-600 rounded-xl shadow-lg transition-all text-xs font-black uppercase">CONFIRM SEAT</button></div>
              </div>
            </div>
        )}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-6 md:px-12 bg-black/60 backdrop-blur-md shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="flex flex-col"><h2 className="tracking-[0.5em] text-lg font-black flex items-center gap-3"><LayoutGrid className="text-emerald-400 w-5"/> ARENA DIRECTORY</h2><span className="text-[8px] text-white/30 tracking-[0.2em]">VERSION {VERSION}</span></div>
          <div className="flex items-center gap-6 font-black">
            <div className="flex items-end flex-col"><span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">{String(userProfile?.name)}</span><span className="text-emerald-400 font-mono text-2xl tracking-tighter leading-none">${Number(userProfile?.chips || 0).toLocaleString()}</span></div>
            <button onClick={handleForceSync} className="text-white/20 hover:text-emerald-400 transition-all"><RefreshCcw size={20} className="active:animate-spin"/></button>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={20}/></button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-12 overflow-y-auto bg-gradient-to-b from-slate-900/20 to-black font-black uppercase text-center">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
                {activeTables.map((t) => (
                    <div key={t.id} className="group relative bg-slate-900/40 border border-white/5 rounded-2xl md:rounded-3xl flex flex-col p-6 md:p-8 shadow-2xl transition-all hover:border-emerald-500/30 hover:bg-slate-900/60 font-black overflow-hidden text-left">
                      <h3 className="text-xl md:text-3xl text-white font-black tracking-tight mb-4 uppercase truncate">{String(t.name)}</h3>
                      <div className="flex flex-col gap-4 mb-6">
                        <div className="flex justify-between items-end border-b border-white/5 pb-2"><div className="flex flex-col"><span className="text-[8px] text-white/30 tracking-widest">STAKES</span><span className="text-emerald-400 text-xl md:text-2xl font-mono leading-none">${t.sb}/${t.bb}</span></div><div className="flex flex-col items-end"><span className="text-[8px] text-white/30 tracking-widest">BUY-IN</span><span className="text-white/80 text-sm md:text-lg font-mono leading-none">${t.minBuy}-${t.maxBuy}</span></div></div>
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] text-white/30 tracking-widest flex items-center gap-1.5 uppercase"><Users size={10} /> Seated Players ({(t.players || []).filter(p=>p).length}/10)</span>
                          <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-black/40 rounded-xl border border-white/5">{(t.players || []).filter(p=>p).map((p, idx) => (<span key={`${t.id}-p-${idx}`} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[8px] text-white/80 font-black tracking-tight flex items-center gap-1">{p.isBot && <Bot size={8} className="text-indigo-400" />}{String(p.name).toUpperCase()}</span>))}</div>
                        </div>
                      </div>
                      <button onClick={()=>{ setSelectedTableForJoin(t); setBuyInAmount(t.maxBuy); }} className="w-full py-4 md:py-6 bg-emerald-600 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black tracking-[0.2em] shadow-lg transition-all active:scale-95 hover:brightness-110 flex items-center justify-center gap-2 group-hover:bg-emerald-500">JOIN ARENA <ChevronRight size={14}/></button>
                    </div>
                ))}
            </div>
        </main>
    </div>
  );

  return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter select-none">
      
      {/* HI-RES SVG DISTORTION FILTERS */}
      <svg style={{ visibility: 'hidden', position: 'absolute', width: 0, height: 0 }}>
        <filter id="fire-hi-res">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.2" numOctaves="3" seed={noiseSeed} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      {announcement && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none">
          <div className="relative">
            <div className="absolute inset-0 blur-[40px] opacity-50 bg-current scale-150 animate-pulse" style={{ color: announcement.color }} />
            <h1 className="text-[10vw] font-black uppercase italic animate-announcement-pop drop-shadow-[0_0_50px_rgba(0,0,0,1)] text-center px-10 relative z-10" style={{ color: announcement.color }}>{String(announcement.text)}</h1>
          </div>
        </div>
      )}
      {showRebuyModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6">
          <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl flex flex-col gap-10">
            <h3 className="text-3xl text-center text-indigo-400 uppercase font-black">ARENA TOP-UP</h3>
            <div className="space-y-4 font-black text-center uppercase">
              <div className="flex justify-between items-center text-[10px] text-white/40 tracking-[0.2em] font-black">
                <span>CREDIT AMOUNT</span>
                <span className="text-indigo-400 text-2xl font-mono">${Math.min(rebuyAmount, userProfile?.chips || 0).toLocaleString()}</span>
              </div>
              <input type="range" min={1} max={userProfile?.chips || 100} step={1} value={rebuyAmount} onChange={(e) => setRebuyAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
            </div>
            <div className="flex gap-4">
              <button onClick={()=>setShowRebuyModal(false)} className="flex-1 p-4 bg-white/5 border border-white/10 rounded-xl font-black text-xs uppercase">CANCEL</button>
              <button onClick={handleRebuy} className="flex-2 p-4 bg-indigo-600 rounded-xl shadow-lg transition-all text-xs font-black uppercase">INJECT FUNDS</button>
            </div>
          </div>
        </div>
      )}
      {showRulesModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6">
          <div className="w-full max-w-[500px] p-8 bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl flex flex-col gap-6 relative">
            <button onClick={()=>setShowRulesModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X/></button>
            <h3 className="text-2xl font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2"><BookOpen size={24}/> {activeVariant?.name} Rules</h3>
            <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2 font-black">
              {activeVariant?.rules?.map((rule, ri) => (
                <div key={`rule-${ri}`} className="flex gap-3 text-sm text-white/80 leading-relaxed uppercase">
                  <span className="text-cyan-500 shrink-0">•</span>
                  <span>{String(rule)}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowRulesModal(false)} className="w-full py-4 bg-cyan-600 rounded-xl font-black uppercase tracking-widest hover:brightness-110">Understood</button>
          </div>
        </div>
      )}
      <header className="bg-black/80 border-b border-white/5 flex items-center justify-between px-4 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black pt-[env(safe-area-inset-top)] h-[45px] md:h-[55px]">
        <div className="flex-1 flex items-center">
          <button 
            onClick={()=>setShowRulesModal(true)} 
            style={{ backgroundColor: VARIANT_COLORS[activeVariant?.id || 'HOLDEM'] || '#1e293b' }} 
            className={`border px-3 py-1 rounded-lg flex flex-col min-w-[120px] transition-all duration-500 relative overflow-hidden group active:scale-95 shadow-lg ${handAttention ? 'animate-hand-trigger border-white' : 'border-black/20'}`}
          >
            <span style={{ color: getContrastColor(VARIANT_COLORS[activeVariant?.id || 'HOLDEM']) }} className="text-[8px] tracking-widest leading-none mb-0.5 uppercase font-black flex items-center gap-1 opacity-70">This Hand: <HelpCircle size={8}/></span>
            <span style={{ color: getContrastColor(VARIANT_COLORS[activeVariant?.id || 'HOLDEM']) }} className="text-xs md:text-sm font-black truncate drop-shadow-sm">{String(activeVariant?.name)}</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 md:gap-4">
          <button onClick={() => setIntelExpanded(!intelExpanded)} className={`${intelExpanded ? 'text-white bg-indigo-600 border-indigo-400' : 'text-indigo-400 bg-white/5 border-white/10'} p-1.5 border rounded-lg transition-all shadow-lg active:scale-95`} title="Activity Log"><Eye size={16}/></button>
          <button onClick={() => setShowVisualControls(!showVisualControls)} className={`${showVisualControls ? 'text-white bg-cyan-600 border-cyan-400' : 'text-cyan-400 bg-white/5 border-white/10'} p-1.5 border rounded-lg transition-all shadow-lg active:scale-95`} title="Settings"><Settings size={16}/></button>
          <button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid }); setCurrentView(VIEWS.LOBBY);}} className="text-red-500 p-1.5 bg-white/5 border border-white/10 rounded-lg shadow-lg active:scale-95 hover:bg-red-500/10 transition-all" title="Exit Arena"><LogOut size={16}/></button>
        </div>
        <div className="flex-1 flex items-center justify-end">
          <div className={`bg-slate-900 border px-3 py-1 rounded-lg flex flex-col min-w-[120px] relative transition-all duration-300 group ${dealAttention ? 'animate-deal-trigger border-white' : 'border-white/10'}`}>
            <span className="text-emerald-400 text-[8px] tracking-widest leading-none mb-0.5 uppercase font-bold">On My Deal:</span>
            <div className="flex items-center">
              <select 
                value={pendingVariantId} 
                onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value}); }} 
                className="bg-transparent text-white text-[10px] md:text-xs outline-none font-black appearance-none cursor-pointer z-10 w-full"
              >
                {Object.entries(VARIANTS).map(([k,v]) => (<option key={`opt-${k}`} value={k} className="bg-slate-900">{v.name}</option>))}
              </select>
              <ChevronDown size={12} className="text-white/30 pointer-events-none ml-1" />
            </div>
          </div>
        </div>
      </header>
      {intelExpanded && (
        <div className={`fixed bottom-[240px] left-4 w-[85vw] md:w-96 bg-black/20 border border-indigo-500/30 rounded-2xl backdrop-blur-sm z-[150] shadow-[0_0_50px_rgba(0,0,0,0.4)] animate-in slide-in-from-left duration-300 flex flex-col h-[50vh] max-h-[500px] ${!isMobile ? 'hidden' : ''}`}>
          <ActivityFeedContent />
        </div>
      )}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {intelExpanded && !isMobile && (
          <aside className="w-80 bg-black/40 border-r border-white/5 hidden lg:flex flex-col animate-in slide-in-from-left duration-300">
            <ActivityFeedContent />
          </aside>
        )}
        <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-slate-900 to-black overflow-hidden font-black uppercase text-center">
            {heroPlayerObj && !heroPlayerObj.isFolded && phase !== PHASES.IDLE && (
              <>
                {activeVariant?.id === 'HILOW' && (
                  <div className="absolute top-6 left-6 z-[90] flex flex-col items-start pointer-events-none animate-in fade-in slide-in-from-left duration-700">
                      <span className="text-[8px] md:text-[10px] text-white/30 tracking-[0.3em] font-black mb-1">LOW STRENGTH</span>
                      <span className={`text-[14px] lg:text-[2.5vh] font-black tracking-tighter transition-all duration-500 ${getStrengthClass(heroPlayerObj?.lowStrength)}`}>{phase === PHASES.PRE_FLOP ? "-" : formatRank(heroPlayerObj?.lowStrength)}</span>
                      {/* Dynamic Win Prob Glow */}
                      <span className={`text-[11px] lg:text-[1.5vh] font-mono mt-1 transition-all duration-500`}
                            style={{ 
                              textShadow: `0 0 ${Math.pow(heroPlayerObj.lowWinProbability / 8, 1.6)}px #fbbf24`,
                              color: heroPlayerObj.lowWinProbability > 85 ? '#fff' : '#fbbf24',
                              filter: `brightness(${1 + (heroPlayerObj.lowWinProbability / 30)}) drop-shadow(0 0 10px rgba(251,191,36,${heroPlayerObj.lowWinProbability/100}))`
                            }}>
                        {Math.round(heroPlayerObj?.lowWinProbability || 0)}% WIN PROB
                      </span>
                  </div>
                )}
                <div className="absolute top-6 right-6 z-[90] flex flex-col items-end pointer-events-none animate-in fade-in slide-in-from-right duration-700">
                  <span className="text-[8px] md:text-[10px] text-white/30 tracking-[0.3em] font-black mb-1">STRENGTH</span>
                  <span className={`text-[14px] lg:text-[2.5vh] font-black tracking-tighter transition-all duration-500 ${getStrengthClass(heroPlayerObj?.strength)}`}>{phase === PHASES.PRE_FLOP ? "-" : formatRank(String(heroPlayerObj?.strength))}</span>
                  {/* Dynamic Win Prob Glow */}
                  <span className={`text-[11px] lg:text-[1.5vh] font-mono mt-1 transition-all duration-500`}
                        style={{ 
                          textShadow: `0 0 ${Math.pow(heroPlayerObj.winProbability / 8, 1.6)}px #fbbf24`,
                          color: heroPlayerObj.winProbability > 85 ? '#fff' : '#fbbf24',
                          filter: `brightness(${1 + (heroPlayerObj.winProbability / 30)}) drop-shadow(0 0 10px rgba(251,191,36,${heroPlayerObj.winProbability/100}))`
                        }}>
                    {Math.round(heroPlayerObj?.winProbability || 0)}% WIN PROB
                  </span>
                </div>
              </>
            )}
            <div style={{ transform: isMobile ? `scale(${visuals.tableZoom})` : `scale(${Math.min(visuals.tableZoom, 1.2)})` }} className="relative w-full max-w-[1400px] aspect-[15/10] lg:aspect-[16/9] flex items-center justify-center h-full origin-center">
                <div className="absolute inset-[-20px] rounded-[50%] z-0">
                    <div 
                        className="absolute inset-0 rounded-[50%] blur-[20px] opacity-40 animate-pulse"
                        style={{
                            background: activeVariant?.id === 'REDSBLACKS' 
                                ? 'conic-gradient(#ff0000 0deg 120deg, #000 120deg 180deg, #ff0000 180deg 300deg, #000 300deg 360deg)'
                                : activeVariant?.id === 'HILOW'
                                ? `linear-gradient(to right, ${VARIANT_COLORS.HILOW}, ${HILOW_SECONDARY_COLOR})`
                                : VARIANT_COLORS[activeVariant?.id || 'HOLDEM']
                        }}
                    />
                    <div className="absolute inset-0 rounded-[50%] border-[24px] border-[#0a0a0a] shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_2px_10px_rgba(255,255,255,0.1)]" />
                </div>
                <div className="absolute inset-0 rounded-[50%] border-[40px] border-[#1a110a] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] z-0 bg-[#2b1d12]" />
                <div 
                  className={`absolute inset-[35px] rounded-[50%] transition-all duration-700 overflow-hidden ${activeVariant?.id === 'MUFLIS' ? 'animate-muflis-glow' : ''} ${activeVariant?.id === 'OMAHA' ? 'animate-omaha-swirl' : ''}`} 
                  style={{ 
                    backgroundColor: TABLE_FELT_COLOR,
                    backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 75%)`,
                    boxShadow: `inset 0 0 100px rgba(0,0,0,0.6)`
                  }} 
                >
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
                </div>
                <div className="absolute inset-[15%] rounded-[50%] border border-white/10 pointer-events-none z-10" />
                <button onClick={handleForceSync} className="absolute bottom-6 right-6 z-[150] bg-black/60 border border-white/20 p-3 rounded-full text-white/40 hover:text-white transition-all shadow-xl active:scale-95 group pointer-events-auto" title="Force Sync State"><RefreshCcw size={20} className="group-active:animate-spin" /></button>
                <div className="absolute inset-0 pointer-events-none z-20">{(players || []).map((p, i) => { if (!p) return null; const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; return (<Seat key={`seat-${i}`} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} visuals={visuals} bigBlind={bigBlind} showdownWinners={showdownWinners} isCollectingBets={potTransferring} timeRemaining={timeRemaining} formatRank={formatRank} />); })}</div>
                <div className="absolute top-[calc(48%-50px)] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full">
                  {!potTransferring && (
                    <div className="flex flex-col items-center mb-3 transition-all">
                      <span className="text-white/20 text-[10px] tracking-[0.5em] mb-1 uppercase font-bold">Total Pot:</span>
                      <div className="text-[6vw] lg:text-[6vh] font-black text-white font-mono tracking-tighter leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">${Number(totalDisplayPot).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                  )}
                  {community.length > 0 && (
                    <div className="flex gap-2 md:gap-4 mt-4 transition-transform" style={{ transform: isMobile ? `scale(${visuals.commCardScale})` : `scale(${visuals.commCardScale * 0.8})` }}>
                      {(community || []).map((c, j) => { 
                        const isRed = c.suit === '♥' || c.suit === '♦'; 
                        return (
                          <div key={`comm-${c.id || j}-${j}`} className={`w-[8vw] lg:w-[6vh] h-[11vw] lg:h-[9vh] rounded-xl border-2 bg-white flex flex-col items-start justify-start p-1.5 text-black font-black transition-all duration-500 ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 shadow-[0_0_30px_#fbbf24]' : 'border-white/10'}`}>
                            <span className={`text-[12px] lg:text-[1.6vh] font-black leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{String(c.value)}</span>
                            <span className={`text-[14px] lg:text-[2.2vh] font-black leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{String(c.suit)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {activeIdx === heroIdx && heroPlayerObj && phase !== PHASES.IDLE && (
                  <div className="absolute right-4 md:right-[20px] top-[15%] bottom-[15%] w-16 md:w-20 flex flex-col items-center justify-end z-[250] pointer-events-auto">
                    <div className="flex-1 w-full relative flex items-center justify-center py-4">
                      <input type="range" min={Math.min(minRaiseAmount || (highestBet + bigBlind), Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet))} max={Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet)} step={1} value={raiseInput} onChange={(e) => setRaiseInput(Number(e.target.value))} className="vertical-range appearance-none bg-white/10 w-8 md:w-10 h-full rounded-full accent-emerald-500 cursor-pointer" style={{ WebkitAppearance: 'slider-vertical', writingMode: 'bt-lr' }} />
                    </div>
                    <div className="mt-4 bg-black/95 border-2 border-emerald-400 px-3 py-2 rounded-xl animate-in zoom-in duration-300 flex flex-col items-center min-w-[110px]">
                      <span className="text-[8px] text-white/40 tracking-widest mb-1 font-bold uppercase text-center">Raise To</span>
                      <div className="flex items-center justify-center w-full">
                        <span className="text-emerald-500 font-mono text-lg md:text-2xl mr-0.5">$</span>
                        <input type="number" value={raiseInput} onChange={(e) => { 
                          const val = Number(e.target.value); 
                          const min = minRaiseAmount || (highestBet + bigBlind); 
                          const max = Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet); 
                          setRaiseInput(Math.max(min, Math.min(val, max))); 
                        }} className="bg-transparent text-emerald-400 font-mono text-xl md:text-3xl font-black text-center outline-none w-full" />
                      </div>
                    </div>
                  </div>
                )}
            </div>
        </main>
      </div>
      <footer style={{ height: `calc(${visuals.footerHeight}px + env(safe-area-inset-bottom))` }} className="bg-black border-t border-white/10 flex flex-col z-[100] shrink-0 pb-[env(safe-area-inset-bottom)]">
        <div className="flex-1 flex flex-col items-center justify-start px-4 relative pt-6"> 
          {phase === PHASES.SHOWDOWN && showdownWinners && showdownWinners.length > 0 ? (
            (() => {
                const winner = showdownWinners[currentShowdownIdx];
                if (!winner) return null;
                const isHiLo = activeVariant?.id === 'HILOW'; 
                const isLowWin = String(winner.rank).includes("LOW:"); 
                const isMuckWin = winner.rank === "!";
                const themeColor = isLowWin ? "text-emerald-400" : (isHiLo ? "text-amber-400" : "text-white");
                const cardBorder = isLowWin ? "border-emerald-400/50" : (isHiLo ? "border-amber-400/50" : "border-white/20");
                return (
                    <div key={`winner-disp-${winner.name}-${currentShowdownIdx}`} className="flex flex-col items-center justify-start w-full gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className={`flex items-center gap-3 bg-white/5 px-5 py-1 rounded-full border border-white/10 max-w-full overflow-hidden shadow-2xl`}>
                            <Trophy size={14} className={themeColor + " animate-bounce shrink-0"} />
                            <div className="text-sm md:text-xl font-black tracking-tighter flex items-center gap-2 leading-none whitespace-nowrap">
                              <span className={getNeonNameColor(winner.name)}>{String(winner.name).toUpperCase()}</span>
                              {isMuckWin ? (
                                <span className="text-white ml-2">SCOOPED THE POT</span>
                              ) : (
                                <>
                                  <span className="text-white/40">WON TOTAL</span>
                                  <span className="text-emerald-400 font-mono ml-2">+${Number(winner.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </>
                              )}
                            </div>
                        </div>
                        {!isMuckWin && (
                          <>
                            <div className="text-[10px] md:text-sm font-black text-white/60 tracking-widest uppercase">HOLDING <span className={themeColor}>{String(formatRank(winner.rank))}</span></div>
                            <div className="flex gap-1 justify-center mt-1">
                              {(winner.hand || []).map((c, ci) => (
                                <div key={`winner-card-${ci}`} className={`w-10 md:w-16 h-13 md:h-20 bg-white rounded flex flex-col items-start justify-start p-1 text-black shadow-2xl border-t-2 border-x-2 ${cardBorder} relative overflow-hidden`}>
                                  <span className={`text-[11px] md:text-sm font-black leading-tight ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span>
                                  <span className={`text-[13px] md:text-xl leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                                  <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-black/40 to-transparent" />
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                    </div>
                );
            })()
          ) : (
            <div className={`flex flex-col gap-4 items-center w-full transition-all duration-500`}>
                {heroPlayerObj && heroPlayerObj.chips < bigBlind && (phase === PHASES.IDLE || phase === PHASES.SHOWDOWN || heroPlayerObj.isFolded || heroPlayerObj.waitingForNextHand) ? (
                    <div className="flex flex-row items-center justify-between w-full max-w-[420px] p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl lg:flex-col lg:bg-transparent lg:border-0 lg:p-0 lg:gap-4 lg:py-6 my-2 lg:my-0">
                        <div className="flex flex-col items-start lg:items-center gap-0.5"><span className="text-white/40 tracking-wider lg:tracking-[0.2em] text-[10px] lg:text-xs font-black italic uppercase text-left lg:text-center">Broke in Arena</span><span className="text-indigo-400 text-[12px] lg:text-[10px] uppercase font-black tracking-widest font-mono">Wallet: ${userProfile?.chips.toLocaleString()}</span></div>
                        <button onClick={()=>{ setRebuyAmount(100); setShowRebuyModal(true); }} className="px-5 py-3 bg-indigo-600 border border-indigo-400 rounded-xl lg:px-12 lg:py-5 lg:rounded-2xl font-black text-xs lg:text-xl hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] uppercase shrink-0"><Coins size={16} className="lg:w-6 lg:h-6"/> Re-buy</button>
                    </div>
                ) : heroPlayerObj && heroPlayerObj.chips >= bigBlind * 0.01 && phase !== PHASES.IDLE ? (
                  <>
                    <div className="flex gap-2 w-full max-w-[600px] font-black text-center uppercase">
                      <button onClick={() => { if (activeIdx !== heroIdx) return; handleAction('RAISE', highestBet + Math.floor(totalDisplayPot * 0.5)); }} className={`flex-1 h-9 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : 'hover:bg-white/10'}`}>1/2 POT</button>
                      <button onClick={() => { if (activeIdx !== heroIdx) return; handleAction('RAISE', highestBet + totalDisplayPot); }} className={`flex-1 h-9 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : 'hover:bg-white/10'}`}>POT</button>
                      <button onClick={handleAllIn} className={`flex-1 h-9 bg-red-900/30 border border-red-500/50 rounded-xl text-[10px] text-red-500 font-black transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : ''}`}>ALL-IN</button>
                    </div>
                    <div className="flex flex-row gap-2 w-full max-w-[800px] items-stretch justify-center font-black h-14">
                      <button onClick={() => { if (activeIdx === heroIdx) handleAction('FOLD'); else setPreAction(preAction === 'FOLD' ? null : 'FOLD'); }} className={`flex-1 bg-red-950/60 border rounded-xl text-lg font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${activeIdx === heroIdx ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : preAction === 'FOLD' ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-red-500/20 opacity-60'}`}>{preAction === 'FOLD' && <Check size={20} className="text-emerald-400" />} FOLD</button>
                      <button onClick={() => { if (activeIdx === heroIdx) handleAction('CALL'); else setPreAction(preAction === 'CHECK' ? null : 'CHECK'); }} className={`flex-1 bg-white/10 border rounded-xl text-xl font-black truncate px-2 flex items-center justify-center gap-2 transition-all ${activeIdx === heroIdx ? 'border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : preAction === 'CHECK' ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-white/5 opacity-60'}`}>{preAction === 'CHECK' && <Check size={20} className="text-emerald-400" />} {activeIdx === heroIdx ? (highestBet > (heroPlayerObj?.currentBet || 0) + 0.005 ? `CALL $${(highestBet - (heroPlayerObj?.currentBet || 0)).toLocaleString()}` : 'CHECK') : 'CHECK'}</button>
                      <div className={`flex-[1.5] flex bg-black/40 border border-white/10 rounded-xl overflow-hidden transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : ''}`}>
                        <button onClick={()=> { if(activeIdx === heroIdx) handleAction('RAISE', raiseInput); }} className="flex-1 bg-emerald-600 border border-emerald-400 rounded-lg flex items-center justify-center font-black text-lg uppercase transition-all active:scale-95"><Zap size={20} className="mr-1"/> RAISE</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-10"><span className="text-white/10 tracking-[0.8em] text-sm font-black italic animate-pulse">ARENA OBSERVATION</span></div>
                )}
            </div>
          )}
        </div>
      </footer>
      {showVisualControls && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={() => setShowVisualControls(false)}>
          <div className="w-full max-w-[400px] bg-black/60 border border-white/20 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-lg text-cyan-400 font-black flex items-center gap-2 uppercase"><Settings2 size={20}/> Configuration</h3>
              <X size={24} className="cursor-pointer text-white/40 hover:text-white" onClick={() => setShowVisualControls(false)}/>
            </div>
            <div className="space-y-6">
              <button onClick={() => { if (currentRoomId) socket.emit('adminAddBot', { roomId: currentRoomId }); }} className="w-full py-4 bg-white/5 border border-white/10 text-white font-black rounded-xl uppercase flex items-center justify-center gap-2 hover:bg-white/10 transition-all"><Bot size={18}/> Add Arena Bot</button>
              <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-white/60 uppercase tracking-widest font-black flex justify-between">Table Zoom <span>{Math.round(visuals.tableZoom * 100)}%</span></label>
                  <input type="range" min="0.3" max="1.5" step="0.05" value={visuals.tableZoom} onChange={(e) => setVisuals({...visuals, tableZoom: Number(e.target.value)})} className="accent-cyan-400 cursor-pointer" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-white/60 uppercase tracking-widest font-black flex justify-between">HUD Action Height <span>{visuals.footerHeight}px</span></label>
                  <input type="range" min="150" max="350" step="10" value={visuals.footerHeight} onChange={(e) => setVisuals({...visuals, footerHeight: Number(e.target.value)})} className="accent-indigo-400 cursor-pointer" />
                </div>
              </div>
            </div>
            <button onClick={() => setShowVisualControls(false)} className="w-full py-4 bg-cyan-600 text-black font-black rounded-xl uppercase hover:brightness-110">Save & Apply</button>
          </div>
        </div>
      )}
      <style>{`
          @keyframes announcement-pop { 0% { transform: scale(0.5); opacity: 0; filter: blur(10px); } 30% { transform: scale(1.1); opacity: 1; filter: blur(0px); } 70% { transform: scale(1); opacity: 1; filter: blur(0px); } 100% { transform: scale(1.3); opacity: 0; filter: blur(20px); } }
          .animate-announcement-pop { animation: announcement-pop 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes action-flash-once { 0% { opacity: 0; transform: scale(0.9); } 40% { opacity: 1; transform: scale(1.05); filter: brightness(1.5); } 100% { opacity: 1; transform: scale(1); filter: brightness(1.1); } }
          .animate-action-flash-once { animation: action-flash-once 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes attention-trigger { 0% { box-shadow: 0 0px 0px rgba(255,255,255,0); border-color: rgba(255,255,255,0.1); transform: scale(1); } 30% { box-shadow: 0 0 40px rgba(255,255,255,0.9), inset 0 0 10px rgba(255,255,255,0.5); border-color: rgba(255,255,255,1); transform: scale(1.08); } 100% { box-shadow: 0 0 0px rgba(255,255,255,0); border-color: rgba(255,255,255,0.1); transform: scale(1); } }
          .animate-hand-trigger { animation: attention-trigger 3s cubic-bezier(0.17, 0.67, 0.83, 0.67); }
          .animate-deal-trigger { animation: attention-trigger 1s cubic-bezier(0.17, 0.67, 0.83, 0.67); }
          @keyframes high-prob-pulse {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.1); filter: brightness(1.5); }
          }
          .animate-high-prob { animation: high-prob-pulse 1s infinite ease-in-out; }
          
          /* HI-RES STEADY BURNING TEXT EFFECTS (Heat Distortion) */
          .strength-hi-res-monster { 
            color: #fff; 
            font-weight: 900; 
            filter: url(#fire-hi-res) brightness(1.4); 
            text-shadow: 0 0 4px #fff, 0 -2px 10px #ff0, 0 -4px 15px #f90, 0 -8px 25px #f20;
          }

          .strength-hi-res-strong { 
            color: #ffda44; 
            font-weight: 800; 
            filter: url(#fire-hi-res) brightness(1.1);
            text-shadow: 0 0 3px #fff, 0 -1px 8px #ff0, 0 -3px 15px #f90;
          }

          .strength-hi-res-ember { 
            color: #ff4d00; 
            filter: url(#fire-hi-res) brightness(0.9);
            text-shadow: 0 0 5px #f20, 0 0 10px #700;
          }

          .strength-hi-res-smolder { 
            color: #820; 
            filter: url(#fire-hi-res) brightness(0.7);
            text-shadow: 0 0 2px #310;
            opacity: 0.8;
          }

          @keyframes muflis-glow { 0%, 100% { box-shadow: 0 0 30px #39FF1444, inset 0 0 50px #39FF1466; border-color: #39FF1466; } 50% { box-shadow: 0 0 40px #1a5a0699, inset 0 0 60px #1a5a0699; border-color: #1a5a0666; } }
          .animate-muflis-glow { animation: muflis-glow 4s infinite ease-in-out; }
          @keyframes omaha-swirl { 0% { box-shadow: 0 0 30px #a855f744, inset 20px 20px 50px #a855f722; border-color: #a855f744; } 25% { box-shadow: 0 0 35px #a855f744, inset -20px 20px 50px #a855f722; border-color: #a855f755; } 50% { box-shadow: 0 0 30px #a855f744, inset -20px -20px 50px #a855f722; border-color: #a855f744; } 75% { box-shadow: 0 0 35px #a855f744, inset 20px -20px 50px #a855f722; border-color: #a855f755; } 100% { box-shadow: 0 0 30px #a855f744, inset 20px 20px 50px #a855f722; border-color: #a855f744; } }
          .animate-omaha-swirl { animation: omaha-swirl 8s infinite linear; }
          html, body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; background: #000; }
          input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .vertical-range { -webkit-appearance: slider-vertical; width: 32px; height: 100%; background: rgba(255, 255, 255, 0.1); outline: none; border-radius: 999px; }
          .vertical-range::-webkit-slider-thumb { -webkit-appearance: none; width: 32px; height: 32px; background: rgba(16, 185, 129, 0.5); border: 4px solid #10b981; border-radius: 50%; cursor: pointer; }
          .vertical-range::-moz-range-thumb { width: 32px; height: 32px; background: rgba(16, 185, 129, 0.5); border: 4px solid #10b981; border-radius: 50%; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default App;
