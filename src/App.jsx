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
// VERSION: v1.0.66
const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { 
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000 
});

const VERSION = "v1.0.66";
const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const VARIANT_COLORS = {
  HOLDEM: '#22d3ee',      // Cyan
  OMAHA: '#a855f7',       // Purple
  PINEAPPLE: '#eab308',   // Yellow
  MUFLIS: '#39FF14',      // Toxic Emerald
  HILOW: '#6366f1',       // Electric Indigo
  REDSBLACKS: '#ff0000'   // Striking Red
};

const VARIANT_FELT_COLORS = {
  HOLDEM: '#070a13',
  OMAHA: '#070a13',
  PINEAPPLE: '#070a13',
  MUFLIS: '#070a13',
  HILOW: '#070a13',
  REDSBLACKS: '#070a13'
};

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

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const DISPLAY_POSITIONS = [
  { x: 50, y: 92 }, { x: 25, y: 84 }, { x: 10, y: 62 }, { x: 10, y: 38 }, { x: 25, y: 16 }, 
  { x: 50, y: 8  }, { x: 75, y: 16 }, { x: 90, y: 38 }, { x: 90, y: 62 }, { x: 75, y: 84 }
];

const DashTimer = ({ timeRemaining }) => {
  const percentage = Math.max(0, (timeRemaining / 24) * 100);
  const color = timeRemaining < 6 ? '#ef4444' : timeRemaining < 12 ? '#f59e0b' : '#22d3ee';
  return (
    <div className="w-24 md:w-32 h-1.5 bg-white/10 rounded-full relative mt-1 overflow-hidden">
      <div className="absolute inset-0 flex gap-1 items-center px-1">{Array.from({ length: 8 }).map((_, i) => (<div key={`bg-seg-${i}`} className="h-1 flex-1 bg-white/5 rounded-full" />))}</div>
      <div className="absolute inset-0 overflow-hidden transition-all duration-1000 linear" style={{ width: `${percentage}%` }}>
        <div className="w-24 md:w-32 h-full flex gap-1 items-center px-1">{Array.from({ length: 8 }).map((_, i) => (<div key={`timer-seg-${i}`} className="h-1 flex-1 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />))}</div>
      </div>
    </div>
  );
};

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, isDealer, potTransferring, timeRemaining, isHero, 
  relativeIdx, visuals, bigBlind, showdownWinners, currentWinnerHandIds, formatRank
}) => {
    if (!player || !displayPos) return null;
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    const vecX = 50 - displayPos.x;
    const vecY = 50 - displayPos.y;
    const cardInwardX = isMobile ? vecX * 0.15 : vecX * 0.12;
    const cardInwardY = isMobile ? vecY * 0.20 : vecY * 0.18;

    const getActionDisplay = () => {
        if (player.isFolded) return { text: "FOLDED", color: "text-red-500", glow: "shadow-[0_0_30px_rgba(239,68,68,0.8)]" };
        
        // Phase 4: Showdown HUD Recap
        if (phase === PHASES.SHOWDOWN && !player.waitingForNextHand && player.strength) {
            return { text: formatRank(player.strength), color: "text-amber-400", glow: "shadow-[0_0_30px_rgba(251,191,36,0.5)]" };
        }

        if (phase === PHASES.PRE_FLOP && player.currentBet > 0 && !player.lastAction) {
            if (player.currentBet === bigBlind) return { text: `BB $${player.currentBet}`, color: "text-indigo-400", glow: "shadow-[0_0_30px_rgba(129,140,248,0.8)]" };
            return { text: `SB $${player.currentBet}`, color: "text-purple-400", glow: "shadow-[0_0_30px_rgba(168,85,247,0.8)]" };
        }
        if (!player.lastAction) return null;
        switch (player.lastAction) {
            case 'RAISE': return { text: `RAISED $${player.currentBet}`, color: "text-emerald-400", glow: "shadow-[0_0_30px_rgba(16,185,129,0.8)]" };
            case 'CALL': return { text: `CALLED $${player.currentBet}`, color: "text-cyan-400", glow: "shadow-[0_0_30px_rgba(34,211,238,0.8)]" };
            case 'CHECK': return { text: "CHECK", color: "text-cyan-400", glow: "shadow-[0_0_30_rgba(34,211,238,0.8)]" };
            default: return null;
        }
    };

    const action = getActionDisplay();
    const showActionOverlay = action && player.isFolded; 
    const isMuckWin = phase === PHASES.SHOWDOWN && showdownWinners?.some(w => w.rank === "!");
    const shouldRevealCards = isHero || (phase === PHASES.SHOWDOWN && !isMuckWin);
    const cardZIndex = isHero ? 'z-[200]' : (phase === PHASES.SHOWDOWN ? 'z-[150]' : 'z-[40]');
    
    // Sync animation to global timestamp (6000ms loop)
    const globalSyncDelay = -(Date.now() % 6000);

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500 ${isHero ? 'z-[100]' : 'z-20'} ${player.isFolded ? 'opacity-30 grayscale scale-90' : 'opacity-100'} ${player.waitingForNextHand ? 'opacity-50' : ''}`}>
            {player.waitingForNextHand && (<div className="absolute top-[-35px] bg-slate-900 text-cyan-400 text-[8px] px-2 py-0.5 rounded-full border border-cyan-500/50 uppercase font-bold tracking-[0.2em] z-[150] backdrop-blur-md">WAITING</div>)}
            {player.hand && Array.isArray(player.hand) && !player.isFolded && !player.waitingForNextHand && (
                <div className={`absolute flex items-center justify-center w-[15vw] lg:w-[12vh] h-[8vw] lg:h-[8vh] pointer-events-none ${cardZIndex}`} style={{ transform: isMobile ? `translate(${cardInwardX}vw, ${cardInwardY}vw)` : `translate(${cardInwardX * 0.4}vh, calc(${cardInwardY * 0.4}vh - ${isHero ? '70px' : '0px'}))` }}>
                    {player.hand.map((c, ci) => {
                        const offset = ci - (player.hand.length - 1) / 2;
                        const isRedSuit = c.suit === '♥' || c.suit === '♦';
                        const rotation = isHero ? (offset * visuals.holeCardFan) : 0;
                        const isWinnerCard = (currentWinnerHandIds || []).includes(c.id);
                        return (<div key={`${c.id || ci}-${ci}`} className={`w-[7.5vw] lg:w-[5.5vh] h-[10.5vw] lg:h-[8vh] rounded-lg flex flex-col items-start justify-start p-1 border absolute transition-all duration-500 shadow-2xl ${shouldRevealCards ? 'bg-white' : 'bg-slate-900 border-white/20'} ${phase === PHASES.SHOWDOWN && !isWinnerCard ? 'opacity-20 grayscale' : 'opacity-100'}`} style={{ transform: isMobile ? `translateX(${offset * (isHero ? 2 : 3.75)}vw) rotate(${rotation}deg) scale(${isHero ? 1.6 : 1.0})` : `translateX(${offset * (isHero ? 1.5 : 1.8)}vh) rotate(${rotation}deg) scale(${isHero ? 1.4 : 1.0})`, transformOrigin: 'bottom center', zIndex: 100 + ci }}>{shouldRevealCards && (<><span className={`text-[10px] lg:text-[1.4vh] font-black leading-tight ${isRedSuit ? 'text-red-600' : 'text-slate-900'}`}>{String(c.value)}</span><span className={`text-[12px] lg:text-[2vh] leading-tight ${isRedSuit ? 'text-red-600' : 'text-slate-900'}`}>{String(c.suit)}</span></>)}{phase === PHASES.SHOWDOWN && isWinnerCard && !isMuckWin && (<div className="absolute inset-0 ring-4 ring-yellow-400 rounded-lg animate-pulse" />)}</div>);
                    })}
                </div>
            )}
            <div className={`relative z-[90] flex flex-col items-center p-2 lg:p-3 rounded-xl border transition-all duration-300 min-w-[120px] lg:min-w-[14vh] overflow-hidden backdrop-blur-xl scale-[0.85] ${isActiveTurn ? 'border-white ring-4 ring-white/20 bg-slate-800 shadow-[0_0_40px_rgba(255,255,255,0.2)]' : 'border-white/10 bg-black/80'} ${player.isWinner && phase === PHASES.SHOWDOWN ? 'border-yellow-400 ring-2 ring-yellow-400/50' : ''}`}>
                {showActionOverlay && (<div key={`action-overlay-${String(action.text)}`} className={`absolute inset-0 z-50 flex items-center justify-center bg-black/60 animate-action-flash-once border-2 rounded-xl border-white/40 ${action.glow}`}><span className={`text-sm lg:text-lg font-black italic uppercase tracking-tighter text-center px-2 drop-shadow-[0_0_10px_rgba(0,0,0,1)] ${action.color}`}>{String(action.text)}</span></div>)}
                {player.isDisconnected && (<div className="absolute inset-0 z-[150] bg-red-950/60 backdrop-blur-[1px] flex items-center justify-center border border-red-500/40 rounded-xl overflow-hidden"><span className="text-white text-[10px] md:text-xs font-black animate-pulse uppercase tracking-[0.2em] px-2 text-center">LINK LOST • SECURED</span></div>)}
                <div className="flex flex-col items-center w-full relative z-10 py-1 overflow-hidden">
                    <div className="flex items-center gap-1 opacity-60 mb-1 shrink-0">{player.isBot && <Bot size={10} className="text-indigo-400" />}<span className="text-[12px] lg:text-[1.6vh] font-black text-white uppercase tracking-wider truncate max-w-[80px] lg:max-w-[12vh]">{String(player.name)}</span></div>
                    <div className="w-full h-[24px] lg:h-[3.5vh] relative flex items-center justify-center">
                        {/* Synchronized Carousel: Fades Balance (3s) and Action/Result (3s) */}
                        <div 
                            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${action && !player.isFolded && !isCollectingBets ? 'animate-fade-balance' : 'opacity-100'}`}
                            style={action ? { animationDelay: `${globalSyncDelay}ms` } : {}}
                        >
                            <span className={`text-[18px] lg:text-[2.8vh] font-mono font-black ${player.chips <= 0 ? 'text-red-500' : 'text-emerald-400'} leading-none tracking-tighter`}>${Number(player.chips).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        {action && !player.isFolded && !isCollectingBets && (
                            <div 
                                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg animate-fade-action"
                                style={{ animationDelay: `${globalSyncDelay}ms` }}
                            >
                                <span className={`text-[14px] lg:text-[2.2vh] font-black italic uppercase tracking-tight text-center px-1 drop-shadow-md whitespace-nowrap ${action.color}`}>{String(action.text)}</span>
                            </div>
                        )}
                    </div>
                    {isActiveTurn && <DashTimer timeRemaining={timeRemaining} />}
                </div>
                {isDealer && <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full shadow-[0_0_15px_#ef4444] animate-pulse z-[60]" />}
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
  const [idleAlternator, setIdleAlternator] = useState(true);
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 1000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 1, bb: 2, minBuy: 50, maxBuy: 100, pendingVariant: 'HOLDEM' });

  const joinLock = useRef(false);
  const phaseRef = useRef(PHASES.IDLE); 
  const currentHandId = useRef(Date.now());
  const turnInitializedRef = useRef(-1); 
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;

  const [visuals, setVisuals] = useState({ heroCardScale: 2.0, heroCardY: 20, oppCardScale: 1.0, oppCardY: -10, commCardScale: 1.5, commCardY: 0, betScale: 1.5, betY: 0, badgeY: 0, footerHeight: typeof window !== 'undefined' && window.innerWidth < 1024 ? 150 : 250, tableZoom: 0.9, holeCardFan: 35 });

  const heroIdx = useMemo(() => userProfile ? players.findIndex(p => p && (p.uid === userProfile.uid || p.name === userProfile.name)) : -1, [players, userProfile]);
  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);
  const totalDisplayPot = useMemo(() => (Number(potAmount) + players.reduce((acc, p) => acc + (Number(p?.currentBet) || 0), 0)), [potAmount, players]);
  const currentWinnerHandIds = useMemo(() => (phase === PHASES.SHOWDOWN && showdownWinners ? (showdownWinners[currentShowdownIdx]?.hand || []).map(c => c.id) : []), [phase, showdownWinners, currentShowdownIdx]);

  const handleForceSync = useCallback(() => { socket.disconnect().connect(); socket.emit('getInitialData'); if (currentRoomId && userProfile) socket.emit('joinRoom', { roomId: currentRoomId, profile: userProfile, buyIn: 0 }, (res) => {}); }, [currentRoomId, userProfile]);
  const handleAction = useCallback((type, amt = 0) => { const finalAmount = amt !== 0 ? amt : raiseInput; if (currentRoomId) socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(finalAmount) : 0 }); }, [currentRoomId, raiseInput]);
  const handleAllIn = useCallback(() => { if (!heroPlayerObj) return; handleAction('RAISE', Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet)); }, [heroPlayerObj, handleAction]);
  const handleRebuy = useCallback(() => { if (currentRoomId && userProfile) socket.emit('playerRebuy', { roomId: currentRoomId, uid: userProfile.uid, amount: rebuyAmount }); setShowRebuyModal(false); }, [currentRoomId, userProfile, rebuyAmount]);
  const handleLogin = useCallback(() => { if (passwordInput.toLowerCase().trim() === 'pass') { setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin' }); setCurrentView(VIEWS.ADMIN); socket.emit('getInitialData'); } else socket.emit('playerLogin', { password: passwordInput.toLowerCase().trim() }); }, [passwordInput]);
  const joinRoom = useCallback(() => { if (!selectedTableForJoin || !userProfile || joinLock.current) return; joinLock.current = true; setIsJoining(true); socket.emit('joinRoom', { roomId: selectedTableForJoin.id, profile: { ...userProfile, pendingVariant: pendingVariantId }, buyIn: Math.min(buyInAmount, userProfile.chips) }, (res) => { joinLock.current = false; setIsJoining(false); if (res?.status === 'ok') { setCurrentRoomId(selectedTableForJoin.id); setCurrentView(VIEWS.GAME); setSelectedTableForJoin(null); } }); }, [selectedTableForJoin, userProfile, pendingVariantId, buyInAmount]);

  const formatRank = (rank) => {
    if (!rank || typeof rank !== 'string' || rank === "null" || rank === "No Qualifier") return rank || "";
    if (rank.includes(" & ")) return rank.split(" & ").map(r => formatRank(r)).join(" & ");
    const lower = rank.toLowerCase();
    let prefix = ""; if (lower.startsWith("high: ")) prefix = "HIGH: "; else if (lower.startsWith("low: ")) prefix = "LOW: "; else if (lower.startsWith("scoop: ")) prefix = "SCOOP: ";
    const cleanRank = rank.replace(/^(high|low|scoop): /i, "");
    const cleanLower = cleanRank.toLowerCase();
    let result = cleanRank;
    if (cleanLower.includes("five of a kind")) result = "5 of a KIND"; else if (cleanLower.includes("straight flush")) result = "STRAIGHT FLUSH"; else if (cleanLower.includes("four of a kind")) result = "4 of a KIND"; else if (cleanLower.includes("full house")) result = "FULL HOUSE"; else if (cleanLower.includes("flush")) result = "FLUSH"; else if (cleanLower.includes("straight")) result = "STRAIGHT"; else if (cleanLower.includes("three of a kind")) result = "3 of a KIND"; else if (cleanLower.includes("two pair")) result = "Two Pair"; else if (cleanLower.includes("pair")) result = "Pair"; else if (cleanLower.includes("high card")) result = `High ${cleanRank.split(' ').pop()}`; else if (cleanLower.includes("low")) result = `Low ${cleanRank.split(' ').pop()}`;
    return prefix + result;
  };

  useEffect(() => { const lastSeenVersion = localStorage.getItem('last_known_version'); if (lastSeenVersion && lastSeenVersion !== VERSION) { localStorage.setItem('last_known_version', VERSION); window.location.reload(); } else localStorage.setItem('last_known_version', VERSION); }, []);
  useEffect(() => { const updateVh = () => { let vh = window.innerHeight * 0.01; document.documentElement.style.setProperty('--vh', `${vh}px`); }; updateVh(); window.addEventListener('resize', updateVh); return () => window.removeEventListener('resize', updateVh); }, []);

  useEffect(() => {
    const handleRoomUpdate = (d) => {
        if (!d) return;
        setPlayers(() => { const next = Array(TOTAL_SEATS).fill(null); (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); return next; });
        const isPhaseTransition = d.phase !== phaseRef.current;
        if (isPhaseTransition && d.phase === PHASES.PRE_FLOP) { const vId = d.activeVariant?.id || 'HOLDEM'; setAnnouncement({ text: VARIANTS[vId]?.name || "Poker", color: VARIANT_COLORS[vId] || '#fff' }); setTimeout(() => setAnnouncement(null), 1500); }
        if (isPhaseTransition && [PHASES.FLOP, PHASES.TURN, PHASES.RIVER].includes(d.phase)) { setHandAttention(true); setTimeout(() => { setHandAttention(false); setDealAttention(true); setTimeout(() => setDealAttention(false), 1000); }, 3000); if (d.phase === PHASES.FLOP) { const vId = d.activeVariant?.id || 'HOLDEM'; setTimeout(() => { setAnnouncement({ text: VARIANTS[vId]?.name || "Poker", color: VARIANT_COLORS[vId] || '#fff' }); setTimeout(() => setAnnouncement(null), 1500); }, 3000); } }
        if (d.phase === PHASES.PRE_FLOP && phaseRef.current !== PHASES.PRE_FLOP) currentHandId.current = Date.now();
        const isShowdownTransition = d.phase === PHASES.SHOWDOWN && phaseRef.current !== PHASES.SHOWDOWN;
        phaseRef.current = d.phase; setPhase(d.phase); setCommunity(d.community || []); setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0); setActiveIdx(d.activeIdx ?? -1); setHighestBet(d.highestBet || 0); if (d.bb) setBigBlind(d.bb); if (d.minRaiseAmount !== undefined) setMinRaiseAmount(d.minRaiseAmount); setDealerIdx(d.dealerIdx ?? -1); setTimeRemaining(d.timeRemaining || 0); if (d.activeVariant) { const vId = typeof d.activeVariant === 'string' ? d.activeVariant : d.activeVariant.id; setActiveVariant(VARIANTS[vId] || { id: vId, name: d.activeVariant.name || vId, rules: [] }); }
        if (isShowdownTransition) { setPotTransferring(true); setCurrentShowdownIdx(0); const rawWinners = d.showdownWinners || []; setShowdownWinners(rawWinners); let durationPerWinner = rawWinners.some(w => w.rank === "!") ? 2000 : 5000; if (rawWinners.length > 1) { for (let i = 1; i < rawWinners.length; i++) { setTimeout(() => { if (phaseRef.current === PHASES.SHOWDOWN) setCurrentShowdownIdx(i); }, i * durationPerWinner); } } setTimeout(() => setPotTransferring(false), Math.max(1, rawWinners.length) * durationPerWinner); } else if (d.phase !== PHASES.SHOWDOWN) { setPotTransferring(false); setShowdownWinners(null); }
    };
    socket.on('connect', () => { setIsConnected(true); socket.emit('getInitialData'); }); socket.on('roomUpdate', handleRoomUpdate); socket.on('lobbyUpdate', setActiveTables); socket.on('log', (l) => setLogs(prev => [{...l, handId: currentHandId.current, timestamp: Date.now(), uniqueKey: `${Date.now()}-${Math.random()}`}, ...prev].slice(0, 100))); socket.on('profilesUpdate', (list) => { setAllProfiles(list); setUserProfile(prev => prev ? (list.find(p => p.uid === prev.uid) ? { ...prev, chips: list.find(p => p.uid === prev.uid).chips } : prev) : null); }); socket.on('initialDataResponse', ({ profiles: pList, rooms: rList }) => { setAllProfiles(pList); setActiveTables(rList); }); socket.on('loginSuccess', (payload) => { const profile = payload.profile || payload; setUserProfile(profile); setPendingVariantId(profile.pendingVariant || 'HOLDEM'); socket.emit('getInitialData'); if (payload.activeRoomId) { setCurrentRoomId(payload.activeRoomId); socket.emit('joinRoom', { roomId: payload.activeRoomId, profile: profile, buyIn: 0 }, (res) => { if (res?.status === 'ok') setCurrentView(VIEWS.GAME); else setCurrentView(VIEWS.LOBBY); }); } else setCurrentView(VIEWS.LOBBY); });
    return () => { socket.off('connect'); socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); socket.off('initialDataResponse'); socket.off('loginSuccess'); socket.off('log'); };
  }, []); 

  useEffect(() => {
    if (activeIdx === heroIdx && heroPlayerObj) { if (turnInitializedRef.current !== activeIdx) { turnInitializedRef.current = activeIdx; const minAllowed = minRaiseAmount || (highestBet + bigBlind); setRaiseInput(Math.min(minAllowed, Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet))); if (preAction === 'FOLD') { handleAction('FOLD'); setPreAction(null); } else if (preAction === 'CHECK') { handleAction('CALL'); setPreAction(null); } } } 
    else turnInitializedRef.current = -1;
  }, [activeIdx, heroIdx, highestBet, bigBlind, minRaiseAmount, heroPlayerObj, preAction, handleAction]);

  return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter select-none">
      {announcement && (<div className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none"><div className="relative"><div className="absolute inset-0 blur-[40px] opacity-50 bg-current scale-150 animate-pulse" style={{ color: announcement.color }} /><h1 className="text-[10vw] font-black uppercase italic animate-announcement-pop drop-shadow-[0_0_50px_rgba(0,0,0,1)] text-center px-10 relative z-10" style={{ color: announcement.color }}>{String(announcement.text)}</h1></div></div>)}
      {showRebuyModal && (<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6"><div className="w-full max-w-[400px] p-8 bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl flex flex-col gap-10"><h3 className="text-3xl text-center text-indigo-400 uppercase font-black">ARENA TOP-UP</h3><div className="space-y-4 font-black text-center uppercase"><div className="flex justify-between items-center text-[10px] text-white/40 tracking-[0.2em] font-black"><span>CREDIT AMOUNT</span><span className="text-indigo-400 text-2xl font-mono">${Math.min(rebuyAmount, userProfile?.chips || 0).toLocaleString()}</span></div><input type="range" min={1} max={userProfile?.chips || 100} step={1} value={rebuyAmount} onChange={(e) => setRebuyAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500" /></div><div className="flex gap-4"><button onClick={()=>setShowRebuyModal(false)} className="flex-1 p-4 bg-white/5 border border-white/10 rounded-xl font-black text-xs uppercase">CANCEL</button><button onClick={handleRebuy} className="flex-2 p-4 bg-indigo-600 rounded-xl shadow-lg transition-all text-xs font-black uppercase">INJECT FUNDS</button></div></div></div>)}
      {showRulesModal && (<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6"><div className="w-full max-w-[500px] p-8 bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl flex flex-col gap-6 relative"><button onClick={()=>setShowRulesModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X/></button><h3 className="text-2xl font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2"><BookOpen size={24}/> {activeVariant?.name} Rules</h3><div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2 font-black">{activeVariant?.rules?.map((rule, ri) => (<div key={`rule-${ri}`} className="flex gap-3 text-sm text-white/80 leading-relaxed uppercase"><span className="text-cyan-500 shrink-0">•</span><span>{String(rule)}</span></div>))}</div><button onClick={()=>setShowRulesModal(false)} className="w-full py-4 bg-cyan-600 rounded-xl font-black uppercase tracking-widest hover:brightness-110">Understood</button></div></div>)}
      <header className="bg-black/80 border-b border-white/5 flex items-center justify-between px-4 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black pt-[env(safe-area-inset-top)] h-[45px] md:h-[55px]"><div className="flex-1 flex items-center"><button onClick={()=>setShowRulesModal(true)} style={{ backgroundColor: VARIANT_COLORS[activeVariant?.id || 'HOLDEM'] || '#1e293b' }} className={`border px-3 py-1 rounded-lg flex flex-col min-w-[120px] transition-all duration-500 relative overflow-hidden group active:scale-95 shadow-lg ${handAttention ? 'animate-hand-trigger border-white' : 'border-black/20'} ${!handAttention && idleAlternator ? 'animate-bounce-subtle' : ''}`}><div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" /><span style={{ color: getContrastColor(VARIANT_COLORS[activeVariant?.id || 'HOLDEM']) }} className="text-[8px] tracking-widest leading-none mb-0.5 uppercase font-black flex items-center gap-1 opacity-70">This Hand: <HelpCircle size={8}/></span><span style={{ color: getContrastColor(VARIANT_COLORS[activeVariant?.id || 'HOLDEM']) }} className="text-xs md:text-sm font-black truncate drop-shadow-sm">{String(activeVariant?.name)}</span></button></div><div className="flex-1 flex items-center justify-center gap-2 md:gap-4"><button onClick={() => setIntelExpanded(!intelExpanded)} className={`${intelExpanded ? 'text-white bg-indigo-600 border-indigo-400' : 'text-indigo-400 bg-white/5 border-white/10'} p-1.5 border rounded-lg transition-all shadow-lg active:scale-95`}><Eye size={16}/></button><button onClick={() => setShowVisualControls(!showVisualControls)} className={`${showVisualControls ? 'text-white bg-cyan-600 border-cyan-400' : 'text-cyan-400 bg-white/5 border-white/10'} p-1.5 border rounded-lg transition-all shadow-lg active:scale-95`}><Settings size={16}/></button><button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid }); setCurrentView(VIEWS.LOBBY);}} className="text-red-500 p-1.5 bg-white/5 border border-white/10 rounded-lg shadow-lg active:scale-95 hover:bg-red-500/10 transition-all"><LogOut size={16}/></button></div><div className="flex-1 flex items-center justify-end"><div className={`bg-slate-900 border px-3 py-1 rounded-lg flex flex-col min-w-[120px] relative transition-all duration-300 group ${dealAttention ? 'animate-deal-trigger border-white' : 'border-white/10'}`}><span className="text-emerald-400 text-[8px] tracking-widest leading-none mb-0.5 uppercase font-bold">On My Deal:</span><div className="flex items-center"><select value={pendingVariantId} onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value}); }} className="bg-transparent text-white text-[10px] md:text-xs outline-none font-black appearance-none cursor-pointer z-10 w-full">{Object.entries(VARIANTS).map(([k,v]) => (<option key={`opt-${k}`} value={k} className="bg-slate-900">{v.name}</option>))}</select><ChevronDown size={12} className={`text-white/30 pointer-events-none ml-1 ${!dealAttention && !idleAlternator ? 'animate-bounce-subtle' : ''}`} /></div></div></div></header>
      <div className="flex-1 flex flex-row overflow-hidden relative">{intelExpanded && !isMobile && (<aside className="w-80 bg-black/40 border-r border-white/5 hidden lg:flex flex-col animate-in slide-in-from-left duration-300"><ActivityFeedContent /></aside>)}
        <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-slate-900 to-black overflow-hidden font-black uppercase text-center">{heroPlayerObj && !heroPlayerObj.isFolded && phase !== PHASES.IDLE && (<><div className="absolute top-6 right-6 z-[90] flex flex-col items-end pointer-events-none animate-in fade-in slide-in-from-right duration-700"><span className="text-[8px] md:text-[10px] text-white/30 tracking-[0.3em] font-black mb-1">STRENGTH</span><span className="text-[14px] lg:text-[2.5vh] text-purple-400 font-black tracking-tighter drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]">{phase === PHASES.PRE_FLOP ? "-" : formatRank(String(heroPlayerObj?.strength))}</span><span className="text-[#fbbf24] text-[11px] lg:text-[1.5vh] font-mono mt-1">{Math.round(heroPlayerObj?.winProbability || 0)}% WIN PROB</span></div></>)}
            <div style={{ transform: isMobile ? `scale(${visuals.tableZoom})` : `scale(${Math.min(visuals.tableZoom, 1.2)})` }} className="relative w-full max-w-[1400px] aspect-[15/10] lg:aspect-[16/9] flex items-center justify-center h-full origin-center">
                <div className={`absolute inset-0 rounded-[50%] border-[4px] transition-all duration-700 ${activeVariant?.id === 'REDSBLACKS' ? 'border-red-600 shadow-[0_0_50px_#ff0000]' : 'border-slate-800'} ${activeVariant?.id === 'MUFLIS' ? 'animate-muflis-glow' : ''} ${activeVariant?.id === 'OMAHA' ? 'animate-omaha-swirl' : ''} ${activeVariant?.id === 'HILOW' ? 'animate-hilow-split' : ''} ${activeVariant?.id === 'PINEAPPLE' ? 'animate-pineapple-spark' : ''}`} style={{ backgroundColor: '#070a13', boxShadow: !['REDSBLACKS', 'MUFLIS', 'OMAHA', 'HILOW', 'PINEAPPLE'].includes(activeVariant?.id) ? `0 0 30px ${VARIANT_COLORS[activeVariant?.id || 'HOLDEM']}44, inset 0 0 50px ${VARIANT_COLORS[activeVariant?.id || 'HOLDEM']}66` : (activeVariant?.id === 'REDSBLACKS' ? '0 0 50px #ff0000' : 'none') }} /><button onClick={handleForceSync} className="absolute bottom-6 right-6 z-[150] bg-black/60 border border-white/20 p-3 rounded-full text-white/40 hover:text-white hover:border-white/40 transition-all shadow-xl active:scale-95 group pointer-events-auto"><RefreshCcw size={20} className="group-active:animate-spin" /></button>
                <div className="absolute inset-0 pointer-events-none z-20">{(players || []).map((p, i) => { if (!p) return null; const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; return (<Seat key={`seat-${i}`} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} seatIdx={i} visuals={visuals} timeRemaining={timeRemaining} isCollectingBets={potTransferring} bigBlind={bigBlind} showdownWinners={showdownWinners} currentWinnerHandIds={currentWinnerHandIds} formatRank={formatRank} />); })}</div>
                <div className="absolute top-[calc(48%-50px)] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full">{!potTransferring && (<div className="flex flex-col items-center mb-6"><span className="text-white/20 text-[10px] tracking-[0.5em] mb-1 uppercase font-bold">Total Pot:</span><div className="text-[6vw] lg:text-[6vh] font-black text-white font-mono tracking-tighter leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">${Number(totalDisplayPot).toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>)}{community.length > 0 && (<div className="flex gap-2 md:gap-4 mt-4 transition-transform" style={{ transform: isMobile ? `scale(${visuals.commCardScale})` : `scale(${visuals.commCardScale * 0.8})` }}>
                    {(community || []).map((c, j) => { const isRedSuit = c.suit === '♥' || c.suit === '♦'; const isWinnerCard = (currentWinnerHandIds || []).includes(c.id); return (<div key={`comm-${c.id || j}-${j}`} className={`w-[8vw] lg:w-[6vh] h-[11vw] lg:h-[9vh] rounded-xl border-2 bg-white flex flex-col items-start justify-start p-1.5 text-black font-black transition-all duration-500 animate-in slide-in-from-bottom-4 ${isWinnerCard ? 'ring-4 ring-yellow-400 scale-110 shadow-[0_0_30px_#fbbf24]' : 'border-white/10 opacity-100'} ${phase === PHASES.SHOWDOWN && !isWinnerCard ? 'opacity-20 grayscale' : ''}`}><span className={`text-[12px] lg:text-[1.6vh] font-black leading-tight ${isRedSuit ? 'text-red-600' : 'text-slate-900'}`}>{String(c.value)}</span><span className={`text-[14px] lg:text-[2.2vh] font-black leading-tight ${isRedSuit ? 'text-red-600' : 'text-slate-900'}`}>{String(c.suit)}</span></div>); })}
                </div>)}</div>
                {activeIdx === heroIdx && heroPlayerObj && phase !== PHASES.IDLE && (<div className="absolute right-4 md:right-[20px] top-[15%] bottom-[15%] w-16 md:w-20 flex flex-col items-center justify-end z-[250] pointer-events-auto"><div className="flex-1 w-full relative flex items-center justify-center py-4"><input type="range" min={Math.min(minRaiseAmount || (highestBet + bigBlind), Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet))} max={Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet)} step={1} value={raiseInput} onChange={(e) => setRaiseInput(Number(e.target.value))} className="vertical-range appearance-none bg-white/10 w-8 md:w-10 h-full rounded-full accent-emerald-500 cursor-pointer" style={{ WebkitAppearance: 'slider-vertical', writingMode: 'bt-lr' }} /></div><div className="mt-4 bg-black/95 border-2 border-emerald-400 px-3 py-2 rounded-xl animate-in zoom-in duration-300 flex flex-col items-center min-w-[110px]"><span className="text-[8px] text-white/40 tracking-widest mb-1 font-bold uppercase text-center">Raise To</span><div className="flex items-center justify-center w-full"><span className="text-emerald-500 font-mono text-lg md:text-2xl mr-0.5">$</span><input type="number" value={raiseInput} onChange={(e) => { const val = Number(e.target.value); const min = minRaiseAmount || (highestBet + bigBlind); setRaiseInput(Math.max(min, Math.min(val, Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet)))); }} className="bg-transparent text-emerald-400 font-mono text-xl md:text-3xl font-black text-center outline-none w-full" /></div></div></div>)}
            </div>
        </main>
      </div>
      <footer style={{ height: `calc(${visuals.footerHeight}px + env(safe-area-inset-bottom))` }} className="bg-black border-t border-white/10 flex flex-col z-[100] shadow-[0_-10px_50px_rgba(0,0,0,0.8)] shrink-0 font-black uppercase overflow-hidden pb-[env(safe-area-inset-bottom)]"><div className="flex-1 flex flex-col items-center justify-start px-4 relative pt-6"> 
          {phase === PHASES.SHOWDOWN && showdownWinners && showdownWinners.length > 0 ? (
            (() => {
                const winner = showdownWinners[currentShowdownIdx]; if (!winner) return null;
                const isHiLo = activeVariant?.id === 'HILOW'; const isLowWin = String(winner.rank).includes("LOW:"); const isMuckWin = winner.rank === "!";
                const themeColor = isLowWin ? "text-emerald-400" : (isHiLo ? "text-amber-400" : "text-white");
                const cardBorder = isLowWin ? "border-emerald-400/50" : (isHiLo ? "border-amber-400/50" : "border-white/20");
                return (<div key={`winner-disp-${winner.name}-${currentShowdownIdx}`} className="flex flex-col items-center justify-start w-full gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500"><div className={`flex items-center gap-3 ${isLowWin ? "bg-emerald-400/10" : (isHiLo ? "bg-amber-400/10" : "bg-white/5")} px-5 py-1 rounded-full border ${isLowWin ? "border-emerald-400/30" : (isHiLo ? "border-amber-400/30" : "border-white/10")} max-w-full overflow-hidden shadow-2xl`}><Trophy size={14} className={themeColor + " animate-bounce shrink-0"} /><div className="text-sm md:text-xl font-black tracking-tighter flex items-center gap-2 leading-none whitespace-nowrap"><span className={getNeonNameColor(winner.name)}>{String(winner.name).toUpperCase()}</span>{isMuckWin ? (<span className="text-white ml-2">SCOOPED THE POT</span>) : (<><span className="text-white/40">WON TOTAL</span><span className="text-emerald-400 font-mono ml-2">+${Number(winner.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></>)}</div></div>{!isMuckWin && (<><div className="text-[10px] md:text-sm font-black text-white/60 tracking-widest uppercase">HOLDING <span className={themeColor}>{String(formatRank(winner.rank))}</span></div><div className="flex gap-1 justify-center mt-1">{(winner.hand || []).map((c, ci) => (<div key={`winner-card-${ci}`} className={`w-10 md:w-16 h-13 md:h-20 bg-white rounded flex flex-col items-start justify-start p-1 text-black shadow-2xl border-t-2 border-x-2 ${cardBorder} relative overflow-hidden`}><span className={`text-[11px] md:text-sm font-black leading-tight ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span><span className={`text-[13px] md:text-xl leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span><div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-black/40 to-transparent" /></div>))}</div></>)}</div>);
            })()
          ) : (
            <div className={`flex flex-col gap-4 items-center w-full transition-all duration-500`}>{heroPlayerObj && heroPlayerObj.chips < bigBlind && (phase === PHASES.IDLE || phase === PHASES.SHOWDOWN || heroPlayerObj.isFolded || heroPlayerObj.waitingForNextHand) ? (<div className="flex flex-row items-center justify-between w-full max-w-[420px] p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl lg:flex-col lg:bg-transparent lg:border-0 lg:p-0 lg:gap-4 lg:py-6 my-2 lg:my-0"><div className="flex flex-col items-start lg:items-center gap-0.5"><span className="text-white/40 tracking-wider lg:tracking-[0.2em] text-[10px] lg:text-xs font-black italic uppercase text-left lg:text-center">Broke in Arena</span><span className="text-indigo-400 text-[12px] lg:text-[10px] uppercase font-black tracking-widest font-mono">Wallet: ${userProfile?.chips.toLocaleString()}</span></div><button onClick={()=>{ setRebuyAmount(100); setShowRebuyModal(true); }} className="px-5 py-3 bg-indigo-600 border border-indigo-400 rounded-xl lg:px-12 lg:py-5 lg:rounded-2xl font-black text-xs lg:text-xl hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] uppercase shrink-0"><Coins size={16} className="lg:w-6 lg:h-6"/> Re-buy</button></div>) : heroPlayerObj && heroPlayerObj.chips >= bigBlind * 0.01 && phase !== PHASES.IDLE ? (<><div className="flex gap-2 w-full max-w-[600px] font-black text-center uppercase"><button onClick={() => { if (activeIdx !== heroIdx) return; handleAction('RAISE', highestBet + Math.floor(totalDisplayPot * 0.5)); }} className={`flex-1 h-9 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : 'hover:bg-white/10'}`}>1/2 POT</button><button onClick={() => { if (activeIdx !== heroIdx) return; handleAction('RAISE', highestBet + totalDisplayPot); }} className={`flex-1 h-9 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : 'hover:bg-white/10'}`}>POT</button><button onClick={handleAllIn} className={`flex-1 h-9 bg-red-900/30 border border-red-500/50 rounded-xl text-[10px] text-red-500 font-black transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : ''}`}>ALL-IN</button></div><div className="flex flex-row gap-2 w-full max-w-[800px] items-stretch justify-center font-black h-14"><button onClick={() => { if (activeIdx === heroIdx) handleAction('FOLD'); else setPreAction(preAction === 'FOLD' ? null : 'FOLD'); }} className={`flex-1 bg-red-950/60 border rounded-xl text-lg font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${activeIdx === heroIdx ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : preAction === 'FOLD' ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-red-500/20 opacity-60'}`}>{preAction === 'FOLD' && <Check size={20} className="text-emerald-400" />} FOLD</button><button onClick={() => { if (activeIdx === heroIdx) handleAction('CALL'); else setPreAction(preAction === 'CHECK' ? null : 'CHECK'); }} className={`flex-1 bg-white/10 border rounded-xl text-xl font-black truncate px-2 flex items-center justify-center gap-2 transition-all ${activeIdx === heroIdx ? 'border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : preAction === 'CHECK' ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-white/5 opacity-60'}`}>{preAction === 'CHECK' && <Check size={20} className="text-emerald-400" />} {activeIdx === heroIdx ? (highestBet > (heroPlayerObj?.currentBet || 0) + 0.005 ? `CALL $${(highestBet - (heroPlayerObj?.currentBet || 0)).toLocaleString()}` : 'CHECK') : (highestBet > (heroPlayerObj?.currentBet || 0) + 0.005 ? `CALL $${(highestBet - (heroPlayerObj?.currentBet || 0)).toLocaleString()}` : 'CHECK')}</button><div className={`flex-[1.5] flex bg-black/40 border border-white/10 rounded-xl overflow-hidden transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : ''}`}><button onClick={()=> { if(activeIdx === heroIdx) handleAction('RAISE', raiseInput); }} className="flex-1 bg-emerald-600 border border-emerald-400 rounded-lg flex items-center justify-center font-black text-lg uppercase transition-all active:scale-95"><Zap size={20} className="mr-1"/> RAISE</button></div></div></>) : (<div className="flex flex-col items-center gap-1 py-10"><span className="text-white/10 tracking-[0.8em] text-sm font-black italic animate-pulse">ARENA OBSERVATION</span></div>)}</div>
          )}
        </div></footer>
      {showVisualControls && (<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={() => setShowVisualControls(false)}><div className="w-full max-w-[400px] bg-black/60 border border-white/20 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center border-b border-white/10 pb-4"><h3 className="text-lg text-cyan-400 font-black flex items-center gap-2 uppercase"><Settings2 size={20}/> Configuration</h3><X size={24} className="cursor-pointer text-white/40 hover:text-white" onClick={() => setShowVisualControls(false)}/></div><div className="space-y-6"><button onClick={() => { if (currentRoomId) socket.emit('adminAddBot', { roomId: currentRoomId }); }} className="w-full py-4 bg-white/5 border border-white/10 text-white font-black rounded-xl uppercase flex items-center justify-center gap-2 hover:bg-white/10 transition-all"><Bot size={18}/> Add Arena Bot</button><div className="flex flex-col gap-4 pt-4 border-t border-white/5"><div className="flex flex-col gap-2"><label className="text-[10px] text-white/60 uppercase tracking-widest font-black flex justify-between">Table Zoom <span>{Math.round(visuals.tableZoom * 100)}%</span></label><input type="range" min="0.3" max="1.5" step="0.05" value={visuals.tableZoom} onChange={(e) => setVisuals({...visuals, tableZoom: Number(e.target.value)})} className="accent-cyan-400 cursor-pointer" /></div><div className="flex flex-col gap-2"><label className="text-[10px] text-white/60 uppercase tracking-widest font-black flex justify-between">HUD Action Height <span>{visuals.footerHeight}px</span></label><input type="range" min="150" max="350" step="10" value={visuals.footerHeight} onChange={(e) => setVisuals({...visuals, footerHeight: Number(e.target.value)})} className="accent-indigo-400 cursor-pointer" /></div></div></div><button onClick={() => setShowVisualControls(false)} className="w-full py-4 bg-cyan-600 text-black font-black rounded-xl uppercase hover:brightness-110">Save & Apply</button></div></div>)}
      <style>{`
          @keyframes announcement-pop { 0% { transform: scale(0.5); opacity: 0; filter: blur(10px); } 30% { transform: scale(1.1); opacity: 1; filter: blur(0px); } 70% { transform: scale(1); opacity: 1; filter: blur(0px); } 100% { transform: scale(1.3); opacity: 0; filter: blur(20px); } }
          .animate-announcement-pop { animation: announcement-pop 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes action-flash-once { 0% { opacity: 0; transform: scale(0.9); } 40% { opacity: 1; transform: scale(1.05); filter: brightness(1.5); } 100% { opacity: 1; transform: scale(1); filter: brightness(1.1); } }
          .animate-action-flash-once { animation: action-flash-once 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes attention-trigger { 0% { box-shadow: 0 0 0px rgba(255,255,255,0); border-color: rgba(255,255,255,0.1); transform: scale(1); } 30% { box-shadow: 0 0 40px rgba(255,255,255,0.9), inset 0 0 10px rgba(255,255,255,0.5); border-color: rgba(255,255,255,1); transform: scale(1.08); } 100% { box-shadow: 0 0 0px rgba(255,255,255,0); border-color: rgba(255,255,255,0.1); transform: scale(1); } }
          .animate-hand-trigger { animation: attention-trigger 3s cubic-bezier(0.17, 0.67, 0.83, 0.67); }
          .animate-deal-trigger { animation: attention-trigger 1s cubic-bezier(0.17, 0.67, 0.83, 0.67); }
          @keyframes bounce-subtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
          .animate-bounce-subtle { animation: bounce-subtle 1.5s infinite ease-in-out; }
          @keyframes fade-balance { 0%, 50% { opacity: 1; } 55%, 95% { opacity: 0; } 100% { opacity: 1; } }
          @keyframes fade-action { 0%, 50% { opacity: 0; } 55%, 95% { opacity: 1; } 100% { opacity: 0; } }
          .animate-fade-balance { animation: fade-balance 6s infinite cubic-bezier(0.4, 0, 0.2, 1); }
          .animate-fade-action { animation: fade-action 6s infinite cubic-bezier(0.4, 0, 0.2, 1); }
          @keyframes muflis-glow { 0%, 100% { box-shadow: 0 0 30px #39FF1444, inset 0 0 50px #39FF1466; border-color: #39FF1466; } 50% { box-shadow: 0 0 40px #1a5a0699, inset 0 0 60px #1a5a0699; border-color: #1a5a0666; } }
          .animate-muflis-glow { animation: muflis-glow 4s infinite ease-in-out; }
          @keyframes omaha-swirl { 0% { box-shadow: 0 0 30px #a855f744, inset 20px 20px 50px #a855f722; border-color: #a855f744; } 25% { box-shadow: 0 0 35px #a855f744, inset -20px 20px 50px #a855f722; border-color: #a855f755; } 50% { box-shadow: 0 0 30px #a855f744, inset -20px -20px 50px #a855f722; border-color: #a855f744; } 75% { box-shadow: 0 0 35px #a855f744, inset 20px -20px 50px #a855f722; border-color: #a855f755; } 100% { box-shadow: 0 0 30px #a855f744, inset 20px 20px 50px #a855f722; border-color: #a855f744; } }
          .animate-omaha-swirl { animation: omaha-swirl 8s infinite linear; }
          @keyframes hilow-split { 0%, 100% { box-shadow: 0 0 30px #6366f144, inset 40px 0 60px #6366f133, inset -40px 0 60px #22d3ee33; border-color: #6366f144; } 50% { box-shadow: 0 0 40px #6366f155, inset 60px 0 80px #6366f144, inset -60px 0 80px #22d3ee44; border-color: #6366f155; } }
          .animate-hilow-split { animation: hilow-split 5s infinite ease-in-out; }
          @keyframes pineapple-spark { 0%, 100% { box-shadow: 0 0 20px #eab30833, inset 0 0 40px #eab30844; border-color: #eab30844; } 10% { box-shadow: 0 0 25px #eab30855, inset 0 0 45px #eab30855; border-color: #eab30866; } 20% { box-shadow: 0 0 20px #eab30833, inset 0 0 40px #eab30844; border-color: #eab30844; } }
          .animate-pineapple-spark { animation: pineapple-spark 4s infinite linear; }
          html, body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; background: #000; }
          input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .vertical-range { -webkit-appearance: slider-vertical; width: 32px; height: 100%; background: rgba(255, 255, 255, 0.1); outline: none; border-radius: 999px; }
          .vertical-range::-webkit-slider-thumb { -webkit-appearance: none; width: 32px; height: 32px; background: rgba(16, 185, 129, 0.5); border: 4px solid #10b981; border-radius: 50%; cursor: pointer; }
          .vertical-range::-webkit-slider-thumb:hover { background: rgba(16, 185, 129, 0.8); }
          .vertical-range::-moz-range-thumb { width: 32px; height: 32px; background: rgba(16, 185, 129, 0.5); border: 4px solid #10b981; border-radius: 50%; cursor: pointer; }
      `}</style>
    </div>
  );
};
export default App;
