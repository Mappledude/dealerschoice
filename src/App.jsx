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
// VERSION: v1.0.19
const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { 
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000 
});

const VERSION = "v1.0.19";
const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const VARIANT_COLORS = {
  HOLDEM: '#22d3ee',      // Cyan
  OMAHA: '#a855f7',       // Purple
  PINEAPPLE: '#10b981',   // Emerald
  MUFLIS: '#ef4444',      // Red
  HILOW: '#f59e0b',       // Amber
  REDSBLACKS: '#f43f5e'   // Rose
};

const NEON_PALETTE = [
  'text-[#39FF14]', // Neon Lime
  'text-[#FF00FF]', // Neon Fuchsia
  'text-[#00FFFF]', // Neon Cyan
  'text-[#FF5F1F]', // Neon Orange
  'text-[#FFFF00]', // Neon Yellow
  'text-[#B026FF]', // Neon Purple
];

const getNeonNameColor = (name) => {
  if (!name || name === "SYSTEM") return "text-white";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return NEON_PALETTE[Math.abs(hash) % NEON_PALETTE.length];
};

const VARIANTS = { 
  HOLDEM: { 
    id: 'HOLDEM', 
    name: 'Texas Hold\'em', 
    rules: ["Each player gets 2 hole cards.", "Standard high hand rankings apply.", "Best 5-card combination from 2 hole + 5 community cards wins."] 
  }, 
  OMAHA: { 
    id: 'OMAHA', 
    name: 'Omaha High', 
    rules: ["Each player gets 4 hole cards.", "You MUST use EXACTLY 2 hole cards and 3 community cards.", "Standard high hand rankings apply."] 
  }, 
  PINEAPPLE: { 
    id: 'PINEAPPLE', 
    name: 'Pineapple', 
    rules: ["Each player gets 3 hole cards.", "Standard high hand rankings.", "Similar to Hold'em but with an extra card for better drawing potential."] 
  }, 
  MUFLIS: { 
    id: 'MUFLIS', 
    name: 'Muflis (Lowball)', 
    rules: ["Worst hand wins the pot.", "Ace is the lowest card (value 1).", "The 'best' hand is the one that would normally be the weakest."] 
  }, 
  HILOW: { 
    id: 'HILOW', 
    name: 'Hi-Low Split', 
    rules: ["Pot is split 50/50 between the High hand and the Low hand.", "4 hole cards dealt.", "Must use 2 hole + 3 board cards for both halves.", "Low hand must be 8-or-better (Ace to 8) to qualify."] 
  }, 
  REDSBLACKS: { 
    id: 'REDSBLACKS', 
    name: 'Reds & Blacks', 
    rules: ["4 hole cards dealt.", "Special Joker mechanic: If your hand contains specific color combinations, you may play with enhanced strength.", "Dynamic wildcards based on suit parity."] 
  }
};

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const DISPLAY_POSITIONS = [
  { x: 50, y: 92 }, // Seat 0 (Bottom / Hero)
  { x: 25, y: 84 }, // Seat 1
  { x: 10, y: 62 }, // Seat 2
  { x: 10, y: 38 }, // Seat 3
  { x: 25, y: 16 }, // Seat 4
  { x: 50, y: 8  }, // Seat 5 (Top / Dealer)
  { x: 75, y: 16 }, // Seat 6
  { x: 90, y: 38 }, // Seat 7
  { x: 90, y: 62 }, // Seat 8
  { x: 75, y: 84 }  // Seat 9
];

const DashTimer = ({ timeRemaining }) => {
  const segments = Math.ceil(timeRemaining / 3);
  const color = timeRemaining < 6 ? '#ef4444' : timeRemaining < 12 ? '#f59e0b' : '#22d3ee';
  
  return (
    <div className="flex gap-1 items-center justify-center mt-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div 
          key={`timer-seg-${i}`} 
          className={`h-1 w-3 md:w-5 rounded-full transition-all duration-500 ${i < segments ? 'opacity-100 shadow-[0_0_8px]' : 'opacity-10'}`}
          style={{ 
            backgroundColor: color, 
            boxShadow: i < segments ? `0 0 10px ${color}` : 'none' 
          }}
        />
      ))}
    </div>
  );
};

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  isDealer, potTransferring, timeRemaining, isHero, 
  relativeIdx, visuals, bigBlind
}) => {
    if (!player || !displayPos) return null;

    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    const vecX = 50 - displayPos.x;
    const vecY = 50 - displayPos.y;
    const cardInwardX = vecX * 0.15;
    const cardInwardY = vecY * 0.20;

    const getActionDisplay = () => {
        if (player.isFolded) return { text: "FOLDED", color: "text-red-500", glow: "shadow-[0_0_30px_rgba(239,68,68,0.8)]" };
        if (phase === PHASES.PRE_FLOP && player.currentBet > 0 && !player.lastAction) {
            if (player.currentBet === bigBlind) return { text: `BB $${player.currentBet}`, color: "text-indigo-400", glow: "shadow-[0_0_30px_rgba(129,140,248,0.8)]" };
            return { text: `SB $${player.currentBet}`, color: "text-purple-400", glow: "shadow-[0_0_30px_rgba(168,85,247,0.8)]" };
        }
        if (!player.lastAction) return null;
        switch (player.lastAction) {
            case 'RAISE': return { text: `RAISED $${player.currentBet}`, color: "text-emerald-400", glow: "shadow-[0_0_30px_rgba(16,185,129,0.8)]" };
            case 'CALL': return { text: player.currentBet > 0 ? `CALLED $${player.currentBet}` : "CHECK", color: "text-cyan-400", glow: "shadow-[0_0_30px_rgba(34,211,238,0.8)]" };
            case 'CHECK': return { text: "CHECK", color: "text-cyan-400", glow: "shadow-[0_0_30_rgba(34,211,238,0.8)]" };
            default: return null;
        }
    };

    const action = getActionDisplay();
    const showActionOverlay = action && !isCollectingBets;

    return (
        <div 
          style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} 
          className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500 
            ${isHero ? 'z-[100]' : 'z-20'}
            ${player.isFolded ? 'opacity-30 grayscale scale-90' : 'opacity-100'} 
            ${player.waitingForNextHand ? 'opacity-50' : ''}`}
        >
            {player.waitingForNextHand && (
                <div className="absolute top-[-35px] bg-slate-900 text-cyan-400 text-[8px] px-2 py-0.5 rounded-full border border-cyan-500/50 uppercase font-bold tracking-[0.2em] z-[150] backdrop-blur-md">WAITING</div>
            )}

            {player.hand && Array.isArray(player.hand) && !player.isFolded && !player.waitingForNextHand && (
                <div 
                  className={`absolute flex items-center justify-center w-[15vw] h-[8vw] pointer-events-none ${isHero ? 'z-[200]' : 'z-[40]'}`}
                  style={{ transform: `translate(${cardInwardX}vw, ${cardInwardY}vw)` }}
                >
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const offset = ci - mid;
                        const isRedSuit = c.suit === '♥' || c.suit === '♦';
                        const cardSpacing = isHero ? 2 : (isMobile ? 3.75 : 2);
                        const rotation = isHero ? (offset * visuals.holeCardFan) : 0;
                        const scale = isHero ? 1.6 : 1.0;

                        return (
                          <div key={`${c.id || ci}-${ci}`} 
                              className={`w-[7.5vw] md:w-[4vw] h-[10.5vw] md:h-[5.5vw] rounded-lg flex flex-col items-start justify-start p-1 border absolute transition-all duration-300 shadow-2xl ${phase === PHASES.SHOWDOWN || isHero ? 'bg-white' : 'bg-slate-900 border-white/20'}`} 
                              style={{ 
                                transform: `translateX(${offset * cardSpacing}vw) rotate(${rotation}deg) scale(${scale})`, 
                                transformOrigin: 'bottom center', 
                                zIndex: 100 + ci
                              }}>
                              {(phase === PHASES.SHOWDOWN || isHero) && ( 
                                <>
                                  <span className={`text-[10px] md:text-sm font-black leading-tight ${isRedSuit ? 'text-red-600' : 'text-slate-900'}`}>{String(c.value)}</span>
                                  <span className={`text-[12px] md:text-lg leading-tight ${isRedSuit ? 'text-red-600' : 'text-slate-900'}`}>{String(c.suit)}</span>
                                </> 
                              )}
                              {phase === PHASES.SHOWDOWN && player.isWinner && (winning5Ids || []).includes(c.id) && (
                                <div className="absolute inset-0 ring-4 ring-yellow-400 rounded-lg animate-pulse" />
                              )}
                          </div>
                        );
                    })}
                </div>
            )}

            <div 
                className={`relative z-[90] flex flex-col items-center p-2 md:p-4 rounded-xl border transition-all duration-300 min-w-[120px] md:min-w-[220px] overflow-hidden backdrop-blur-xl scale-[0.85]
                  ${isActiveTurn ? 'border-white ring-4 ring-white/20 bg-slate-800 shadow-[0_0_40px_rgba(255,255,255,0.2)]' : 'border-white/10 bg-black/80'} 
                  ${player.isWinner && phase === PHASES.SHOWDOWN ? 'border-yellow-400 ring-2 ring-yellow-400/50' : ''}`}
            >
                {showActionOverlay && (
                    <div 
                      key={`action-${String(action.text)}`} 
                      className={`absolute inset-0 z-50 flex items-center justify-center bg-black animate-action-flash-once border-2 rounded-xl border-white/40 ${action.glow}`}
                    >
                        <span className={`text-sm md:text-3xl font-black italic uppercase tracking-tighter text-center px-2 drop-shadow-[0_0_10px_rgba(0,0,0,1)] ${action.color}`}>
                            {String(action.text)}
                        </span>
                    </div>
                )}

                {player.isDisconnected && (
                  <div className="absolute inset-0 z-[150] bg-red-950/60 backdrop-blur-[1px] flex items-center justify-center border border-red-500/40 rounded-xl overflow-hidden">
                    <span className="text-white text-[10px] md:text-xs font-black animate-pulse uppercase tracking-[0.2em] px-2 text-center">LINK LOST • SECURED</span>
                  </div>
                )}

                <div className="flex flex-col items-center w-full relative z-10 py-1">
                    <div className="flex items-center gap-1 opacity-60 mb-0.5">
                      {player.isBot && <Bot size={10} className="text-indigo-400" />}
                      <span className="text-[12px] md:text-lg font-black text-white uppercase tracking-wider truncate max-w-[80px] md:max-w-[150px]">{String(player.name)}</span>
                    </div>
                    <span className={`text-[20px] md:text-[36px] font-mono font-black ${player.chips <= 0 ? 'text-red-500' : 'text-emerald-400'} leading-none tracking-tighter`}>
                      ${Number(player.chips).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                    {isActiveTurn && <DashTimer timeRemaining={timeRemaining} />}
                </div>

                {isDealer && <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 w-2 h-2 md:w-3 md:h-3 bg-red-500 rounded-full shadow-[0_0_15px_#ef4444] animate-pulse z-20" />}
            </div>
        </div>
    );
};

const App = () => {
  // --- STATE ---
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
  const [bigBlind, setBigBlind] = useState(0.5);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(24);
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState(10); 
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [currentShowdownIdx, setCurrentShowdownIdx] = useState(0);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [showVisualControls, setShowVisualControls] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(true);
  const [expandedHands, setExpandedHands] = useState(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [announcement, setAnnouncement] = useState(null); 
  const [rebuyAmount, setRebuyAmount] = useState(10);
  const [showRebuyModal, setShowRebuyModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [preAction, setPreAction] = useState(null);
  const [handAttention, setHandAttention] = useState(false);
  const [dealAttention, setDealAttention] = useState(false);
  const [idleAlternator, setIdleAlternator] = useState(true);

  // --- REFS ---
  const joinLock = useRef(false);
  const phaseRef = useRef(PHASES.IDLE); 
  const currentHandId = useRef(Date.now());
  const turnInitializedRef = useRef(-1); // Fixes slider reset bug
  
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 100, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10, pendingVariant: 'HOLDEM' });

  // --- DERIVED ---
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  const [visuals, setVisuals] = useState({
    heroCardScale: 2.0, heroCardY: 20, oppCardScale: 1.0, oppCardY: -10,
    commCardScale: 1.5, commCardY: 0, betScale: 1.5, betY: 0,
    badgeY: 0, footerHeight: 250, tableZoom: 0.9, holeCardFan: 35
  });

  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => p && (p.uid === userProfile.uid || p.name === userProfile.name));
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);

  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + (Number(p?.currentBet) || 0), 0);
    return Number(potAmount) + currentBetsSum;
  }, [potAmount, players]);

  // --- ACTIONS ---
  const handleAction = useCallback((type, amt = 0) => {
    const finalAmount = amt !== 0 ? amt : raiseInput;
    if (currentRoomId) socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(finalAmount) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleAllIn = useCallback(() => {
    if (!heroPlayerObj) return;
    const totalStack = Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet);
    handleAction('RAISE', totalStack);
  }, [heroPlayerObj, handleAction]);

  const handleRebuy = useCallback(() => {
    if (!currentRoomId || !userProfile) return;
    socket.emit('playerRebuy', { roomId: currentRoomId, uid: userProfile.uid, amount: rebuyAmount });
    setShowRebuyModal(false);
  }, [currentRoomId, userProfile, rebuyAmount]);

  const addBot = useCallback(() => { 
    if (currentRoomId) socket.emit('adminAddBot', { roomId: currentRoomId });
  }, [currentRoomId]);

  const handleLogin = useCallback(() => { 
    if (passwordInput.toLowerCase().trim() === 'pass') { 
        setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin' }); 
        setCurrentView(VIEWS.ADMIN); socket.emit('getInitialData'); 
    } else socket.emit('playerLogin', { password: passwordInput.toLowerCase().trim() });
  }, [passwordInput]);

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile || joinLock.current) return;
    joinLock.current = true;
    setIsJoining(true);
    socket.emit('joinRoom', { 
        roomId: selectedTableForJoin.id, profile: { ...userProfile, pendingVariant: pendingVariantId }, buyIn: Math.min(buyInAmount, userProfile.chips) 
    }, (res) => {
        joinLock.current = false; setIsJoining(false);
        if (res?.status === 'ok') { setCurrentRoomId(selectedTableForJoin.id); setCurrentView(VIEWS.GAME); setSelectedTableForJoin(null); }
    });
  }, [selectedTableForJoin, userProfile, pendingVariantId, buyInAmount]);

  const handleCreatePlayer = useCallback(() => {
    if (!newPlayer.name.trim()) return;
    const playerUid = 'p_' + Math.random().toString(36).slice(2, 7);
    socket.emit('adminCreatePlayer', { ...newPlayer, uid: playerUid });
    setNewPlayer({ name: '', chips: 100, password: '' });
  }, [newPlayer]);

  const handleSpawnArena = useCallback(() => {
    if (!newTable.name.trim()) return;
    const roomId = 'room_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const roomData = { 
        ...newTable, id: roomId, sb: Number(newTable.sb), bb: Number(newTable.bb),
        minBuy: Number(newTable.minBuy), maxBuy: Number(newTable.maxBuy)
    };
    socket.emit('adminCreateRoom', roomData);
    setNewTable({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10, pendingVariant: 'HOLDEM' });
  }, [newTable]);

  const formatRank = (rank) => {
    if (!rank || typeof rank !== 'string') return "";
    const lower = rank.toLowerCase();
    if (lower.includes("five of a kind")) return "5 of a KIND";
    if (lower.includes("straight flush")) return "STRAIGHT FLUSH";
    if (lower.includes("four of a kind")) return "4 of a KIND";
    if (lower.includes("full house")) return "FULL HOUSE";
    if (lower.includes("flush")) return "FLUSH";
    if (lower.includes("straight")) return "STRAIGHT";
    if (lower.includes("three of a kind")) return "3 of a KIND";
    if (lower.includes("two pair")) return "Two Pair";
    if (lower.includes("pair")) return "Pair";
    if (lower.includes("high card")) {
      const parts = rank.split(' ');
      return `High ${parts[parts.length - 1]}`;
    }
    if (lower.includes("low")) {
      const parts = rank.split(' ');
      return `Low ${parts[parts.length - 1]}`;
    }
    return rank.split(',')[0].split(' of ')[0];
  };

  const handHistory = useMemo(() => {
    const hands = [];
    let currentHand = null;
    [...logs].reverse().forEach(log => {
        if (String(log.action).includes("IS DEALING") || String(log.action).includes("PRE_FLOP DEALT")) {
            if (currentHand) hands.push(currentHand);
            currentHand = { 
                id: log.handId || `hand-${log.timestamp}-${Math.random()}`, 
                winner: null, rank: null, amount: null, events: [], 
                variant: String(log.action).split('DEALING ')[1] || "Poker"
            };
        }
        if (currentHand) {
            currentHand.events.push(log);
            if (log.type === 'win') {
                const match = String(log.action).match(/WON \$([\d.]+) WITH (.*)/);
                if (match) {
                    currentHand.winner = log.name;
                    currentHand.amount = match[1];
                    currentHand.rank = match[2];
                } else if (String(log.action).includes("BY DEFAULT")) {
                    currentHand.winner = log.name;
                    currentHand.rank = "Muck/Default";
                }
            }
        }
    });
    if (currentHand) hands.push(currentHand);
    return hands.reverse();
  }, [logs]);

  const toggleHand = (id) => {
    const next = new Set(expandedHands);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedHands(next);
  };

  // --- EFFECTS ---
  useEffect(() => {
    const interval = setInterval(() => setIdleAlternator(p => !p), 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleRoomUpdate = (d) => {
        if (!d) return;
        setPlayers(() => { 
          const next = Array(TOTAL_SEATS).fill(null); 
          (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
          return next; 
        });
        
        const isPhaseTransition = d.phase !== phaseRef.current;
        if (isPhaseTransition && [PHASES.FLOP, PHASES.TURN, PHASES.RIVER].includes(d.phase)) {
            setHandAttention(true);
            setTimeout(() => {
                setHandAttention(false);
                setDealAttention(true);
                setTimeout(() => setDealAttention(false), 1000);
            }, 3000);
            
            if (d.phase === PHASES.FLOP) {
                const vId = d.activeVariant?.id || 'HOLDEM';
                setTimeout(() => {
                    setAnnouncement({ text: VARIANTS[vId]?.name || "Poker", color: VARIANT_COLORS[vId] || '#fff' });
                    setTimeout(() => setAnnouncement(null), 1500);
                }, 3000); 
            }
        }

        if (d.phase === PHASES.PRE_FLOP && phaseRef.current !== PHASES.PRE_FLOP) {
            currentHandId.current = Date.now();
        }
        
        const isShowdownTransition = d.phase === PHASES.SHOWDOWN && phaseRef.current !== PHASES.SHOWDOWN;
        phaseRef.current = d.phase;
        setPhase(d.phase);
        setCommunity(d.community || []);
        setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0);
        setActiveIdx(d.activeIdx ?? -1);
        setHighestBet(d.highestBet || 0);
        if (d.bb) setBigBlind(d.bb);
        setDealerIdx(d.dealerIdx ?? -1);
        setTimeRemaining(d.timeRemaining || 0);
        if (d.activeVariant) {
            const vId = typeof d.activeVariant === 'string' ? d.activeVariant : d.activeVariant.id;
            setActiveVariant(VARIANTS[vId] || { id: vId, name: d.activeVariant.name || vId, rules: [] });
        }
        
        if (isShowdownTransition) {
            setPotTransferring(true);
            setCurrentShowdownIdx(0);
            const rawWinners = d.showdownWinners || [];
            setShowdownWinners(rawWinners);
            setWinning5Ids(d.winning5Ids || []);
            const durationPerWinner = 4000;
            if (rawWinners.length > 1) {
                for (let i = 1; i < rawWinners.length; i++) {
                    setTimeout(() => {
                      if (phaseRef.current === PHASES.SHOWDOWN) setCurrentShowdownIdx(i);
                    }, i * durationPerWinner);
                }
            }
            setTimeout(() => setPotTransferring(false), Math.max(1, rawWinners.length) * durationPerWinner);
        } else if (d.phase !== PHASES.SHOWDOWN) {
            setPotTransferring(false);
            setShowdownWinners(null);
        }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!socket.connected) socket.connect();
        socket.emit('getInitialData');
        if (currentRoomId && userProfile) {
          socket.emit('joinRoom', { roomId: currentRoomId, profile: userProfile, buyIn: 0 }, (res) => {});
        }
      }
    };

    socket.on('connect', () => { setIsConnected(true); socket.emit('getInitialData'); });
    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('lobbyUpdate', setActiveTables);
    socket.on('log', (l) => setLogs(prev => [
      {...l, handId: currentHandId.current, timestamp: Date.now(), uniqueKey: `${Date.now()}-${Math.random()}`}, 
      ...prev
    ].slice(0, 100)));

    socket.on('profilesUpdate', (list) => { 
        setAllProfiles(list); 
        setUserProfile(prev => {
            if (!prev) return null;
            const updated = list.find(p => p.uid === prev.uid);
            return updated ? { ...prev, chips: updated.chips } : prev;
        });
    });
    socket.on('initialDataResponse', ({ profiles: pList, rooms: rList }) => { setAllProfiles(pList); setActiveTables(rList); });
    socket.on('loginSuccess', (payload) => { 
        const profile = payload.profile || payload;
        setUserProfile(profile); setPendingVariantId(profile.pendingVariant || 'HOLDEM'); 
        socket.emit('getInitialData'); 
        if (payload.activeRoomId) {
            setCurrentRoomId(payload.activeRoomId);
            socket.emit('joinRoom', { roomId: payload.activeRoomId, profile: profile, buyIn: 0 }, (res) => {
                if (res?.status === 'ok') setCurrentView(VIEWS.GAME); else setCurrentView(VIEWS.LOBBY);
            });
        } else { setCurrentView(VIEWS.LOBBY); }
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => { 
        socket.off('connect'); socket.off('roomUpdate'); socket.off('lobbyUpdate'); 
        socket.off('profilesUpdate'); socket.off('initialDataResponse'); socket.off('loginSuccess'); socket.off('log');
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentRoomId, userProfile]); 

  useEffect(() => {
    if (activeIdx === heroIdx && heroPlayerObj) { 
        // Sync raise slider to minimum bet ONLY when turn begins (detected via turnInitializedRef)
        if (turnInitializedRef.current !== activeIdx) {
          turnInitializedRef.current = activeIdx;
          const minAllowed = highestBet + bigBlind;
          const maxAllowed = Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet);
          setRaiseInput(Math.min(minAllowed, maxAllowed)); 
        }
        
        if (preAction) {
            if (preAction === 'FOLD') handleAction('FOLD');
            else if (preAction === 'CHECK') handleAction('CALL'); 
            setPreAction(null);
        }
    } else {
        turnInitializedRef.current = -1;
    }
  }, [activeIdx, heroIdx, highestBet, bigBlind, heroPlayerObj, preAction, handleAction]);

  // --- VIEWS ---
  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white uppercase font-black">
        <div className="w-full max-w-[400px] p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8">
            <div className="flex items-center gap-4">
              <Lock size={32} className="text-[#fbbf24] animate-pulse" />
              <span className="text-white/20 text-xs font-mono tracking-widest mt-auto pb-1">{VERSION}</span>
            </div>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-xl font-black focus:bg-white/10 transition-all"/>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl font-black text-lg hover:scale-105 active:scale-95 transition-transform uppercase">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white uppercase font-black overflow-hidden pt-[env(safe-area-inset-top)]">
        <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-4 md:p-8 flex flex-row md:flex-col gap-2 md:gap-4 bg-black/20 shrink-0">
            <h2 className="hidden md:flex text-[#fbbf24] items-center gap-2 mb-4 font-black"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-3 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-3 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>TABLES</button>
            <button onClick={()=>{if(!nuclearConfirm){setNuclearConfirm(true); setTimeout(()=>setNuclearConfirm(false),3000); return;} socket.emit('adminNuclearReset'); setNuclearConfirm(false);}} className={`flex-1 md:flex-none p-3 rounded-xl flex items-center justify-center gap-2 border-2 transition-all uppercase ${nuclearConfirm ? 'bg-red-600 border-white text-white' : 'bg-white/5 text-red-500 border-red-500/20'}`}>
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
                        <button onClick={handleCreatePlayer} className="bg-[#fbbf24] text-black rounded-xl font-black p-3 text-sm">CREATE PLAYER</button>
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
                        <button onClick={handleSpawnArena} className="bg-emerald-600 text-white rounded-xl font-black p-3 text-sm lg:col-span-3">SPAWN ARENA</button>
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
    <div className="h-screen bg-[#000] flex flex-col text-white font-black uppercase overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6">
              <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-emerald-500/30 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.2)] flex flex-col gap-10">
                <h3 className="text-3xl text-center text-emerald-400 uppercase font-black">{String(selectedTableForJoin.name)}</h3>
                <div className="space-y-4 font-black text-center uppercase">
                  <div className="flex justify-between items-center text-[10px] text-white/40 tracking-[0.2em] font-black"><span>SEATING AMOUNT</span><span className="text-emerald-400 text-2xl font-mono">${Math.min(buyInAmount, userProfile?.chips || 0).toLocaleString()}</span></div>
                  <input type="range" min={selectedTableForJoin.minBuy || 5} max={Math.min(selectedTableForJoin.maxBuy || 10, userProfile?.chips || 10)} step={0.25} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                </div>
                <div className="flex gap-4">
                  <button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-4 bg-white/5 border border-white/10 rounded-xl font-black text-xs uppercase">CANCEL</button>
                  <button onClick={joinRoom} disabled={isJoining} className="flex-2 p-4 bg-emerald-600 rounded-xl shadow-lg transition-all text-xs font-black uppercase">CONFIRM SEAT</button>
                </div>
              </div>
            </div>
        )}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-6 md:px-12 bg-black/60 backdrop-blur-md shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="flex flex-col"><h2 className="tracking-[0.5em] text-lg font-black flex items-center gap-3"><LayoutGrid className="text-emerald-400 w-5"/> ARENA DIRECTORY</h2><span className="text-[8px] text-white/30 tracking-[0.2em]">VERSION {VERSION}</span></div>
          <div className="flex items-center gap-6 font-black"><div className="flex items-end flex-col"><span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">{String(userProfile?.name)}</span><span className="text-emerald-400 font-mono text-2xl tracking-tighter leading-none">${Number(userProfile?.chips || 0).toLocaleString()}</span></div><button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={20}/></button></div>
        </header>
        <main className="flex-1 p-4 md:p-12 overflow-y-auto bg-gradient-to-b from-slate-900/20 to-black font-black uppercase text-center">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
                {activeTables.map((t) => (
                    <div key={t.id} className="group relative bg-slate-900/40 border border-white/5 rounded-2xl md:rounded-3xl flex flex-col p-6 md:p-8 shadow-2xl transition-all hover:border-emerald-500/30 hover:bg-slate-900/60 font-black overflow-hidden text-left">
                      <h3 className="text-xl md:text-3xl text-white font-black tracking-tight mb-4 uppercase truncate">{String(t.name)}</h3>
                      <div className="flex flex-col gap-4 mb-6">
                        <div className="flex justify-between items-end border-b border-white/5 pb-2">
                          <div className="flex flex-col"><span className="text-[8px] text-white/30 tracking-widest">STAKES</span><span className="text-emerald-400 text-xl md:text-2xl font-mono leading-none">${t.sb}/${t.bb}</span></div>
                          <div className="flex flex-col items-end"><span className="text-[8px] text-white/30 tracking-widest">BUY-IN</span><span className="text-white/80 text-sm md:text-lg font-mono leading-none">${t.minBuy}-${t.maxBuy}</span></div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] text-white/30 tracking-widest flex items-center gap-1.5 uppercase"><Users size={10} /> Seated Players ({(t.players || []).filter(p=>p).length}/10)</span>
                          <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-black/40 rounded-xl border border-white/5">
                            {(t.players || []).filter(p=>p).map((p, idx) => (<span key={`${t.id}-p-${idx}`} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[8px] text-white/80 font-black tracking-tight flex items-center gap-1">{p.isBot && <Bot size={8} className="text-indigo-400" />}{String(p.name).toUpperCase()}</span>))}
                          </div>
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
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter select-none">
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
            <h3 className="text-3xl text-center text-indigo-400 uppercase font-black">ARENA RE-BUY</h3>
            <div className="space-y-4 font-black text-center uppercase">
              <div className="flex justify-between items-center text-[10px] text-white/40 tracking-[0.2em] font-black"><span>CREDIT AMOUNT</span><span className="text-indigo-400 text-2xl font-mono">${Math.min(rebuyAmount, userProfile?.chips || 0).toLocaleString()}</span></div>
              <input type="range" min={5} max={userProfile?.chips || 10} step={0.25} value={rebuyAmount} onChange={(e) => setRebuyAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
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
                className={`bg-slate-900 border px-3 py-1 rounded-lg flex flex-col min-w-[120px] transition-all duration-300 relative overflow-hidden group active:scale-95 ${handAttention ? 'animate-hand-trigger border-white' : 'border-white/10'} ${!handAttention && idleAlternator ? 'animate-bounce-subtle' : ''}`}>
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-cyan-400 text-[8px] tracking-widest leading-none mb-0.5 uppercase font-bold flex items-center gap-1">This Hand is: <HelpCircle size={8}/></span>
              <span className="text-white text-xs md:text-sm font-black truncate">{String(activeVariant?.name)}</span>
            </button>
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 md:gap-4">
            <button onClick={() => setIntelExpanded(!intelExpanded)} className={`${intelExpanded ? 'text-white bg-indigo-600 border-indigo-400' : 'text-indigo-400 bg-white/5 border-white/10'} p-1.5 border rounded-lg transition-all shadow-lg active:scale-95`} title="Activity Feed"><Eye size={16}/></button>
            <button onClick={() => setShowVisualControls(!showVisualControls)} className={`${showVisualControls ? 'text-white bg-cyan-600 border-cyan-400' : 'text-cyan-400 bg-white/5 border-white/10'} p-1.5 border rounded-lg transition-all shadow-lg active:scale-95`} title="Settings"><Settings size={16}/></button>
            <button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid }); setCurrentView(VIEWS.LOBBY);}} className="text-red-500 p-1.5 bg-white/5 border border-white/10 rounded-lg shadow-lg active:scale-95 hover:bg-red-500/10 transition-all" title="Exit Arena"><LogOut size={16}/></button>
        </div>
        <div className="flex-1 flex items-center justify-end">
            <div className={`bg-slate-900 border px-3 py-1 rounded-lg flex flex-col min-w-[120px] relative transition-all duration-300 group ${dealAttention ? 'animate-deal-trigger border-white' : 'border-white/10'}`}>
                <span className="text-emerald-400 text-[8px] tracking-widest leading-none mb-0.5 uppercase font-bold">On My Deal:</span>
                <div className="flex items-center">
                    <select value={pendingVariantId} onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value}); }} className="bg-transparent text-white text-[10px] md:text-xs outline-none font-black appearance-none cursor-pointer z-10 w-full">
                        {Object.entries(VARIANTS).map(([k,v]) => (<option key={`opt-${k}`} value={k} className="bg-slate-900">{v.name}</option>))}
                    </select>
                    <ChevronDown size={12} className={`text-white/30 pointer-events-none ml-1 ${!dealAttention && !idleAlternator ? 'animate-bounce-subtle' : ''}`} />
                </div>
            </div>
        </div>
      </header>

      {intelExpanded && (
        <div className="absolute bottom-[240px] left-4 w-[85vw] md:w-96 bg-black/20 border border-indigo-500/30 rounded-2xl p-4 backdrop-blur-sm z-[150] shadow-[0_0_50px_rgba(0,0,0,0.4)] animate-in slide-in-from-left duration-300 flex flex-col h-[50vh] max-h-[500px]">
            <div className="flex items-center justify-between text-indigo-400 text-[10px] mb-4 border-b border-indigo-500/20 pb-2 font-black tracking-[0.2em] uppercase">
                <div className="flex items-center gap-2"><Terminal size={14}/> Activity</div>
                <button onClick={() => setIntelExpanded(false)} className="text-white/30 hover:text-white"><X size={14}/></button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 pr-1 font-black">
                {handHistory.length > 0 ? handHistory.map((hand) => (
                    <div key={hand.id} className="border border-white/5 rounded-xl overflow-hidden bg-white/5">
                        <button onClick={() => toggleHand(hand.id)} className="w-full p-3 flex flex-col items-start gap-1 transition-all hover:bg-white/5">
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
      )}

      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-slate-900 to-black overflow-hidden font-black uppercase text-center">
        {heroPlayerObj && !heroPlayerObj.isFolded && phase !== PHASES.IDLE && (
          <>
            {activeVariant?.id === 'HILOW' && (
               <div className="absolute top-6 left-6 z-[90] flex flex-col items-start pointer-events-none animate-in fade-in slide-in-from-left duration-700">
                <span className="text-[7px] md:text-[10px] text-white/30 tracking-[0.3em] font-black mb-1">LOW STRENGTH</span>
                <span className="text-[12px] md:text-[25px] text-emerald-400 font-black tracking-tighter drop-shadow-[0_0_20px_rgba(52,211,153,0.5)]">{phase === PHASES.PRE_FLOP ? "-" : formatRank(String(heroPlayerObj?.lowStrength))}</span>
                <span className="text-[#fbbf24] text-[9px] md:text-[17px] font-mono mt-1">{Math.round(heroPlayerObj?.lowWinProbability || 0)}% WIN PROB</span>
              </div>
            )}
            <div className="absolute top-6 right-6 z-[90] flex flex-col items-end pointer-events-none animate-in fade-in slide-in-from-right duration-700">
              <span className="text-[7px] md:text-[10px] text-white/30 tracking-[0.3em] font-black mb-1">STRENGTH</span>
              <span className="text-[12px] md:text-[25px] text-purple-400 font-black tracking-tighter drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]">{phase === PHASES.PRE_FLOP ? "-" : formatRank(String(heroPlayerObj?.strength))}</span>
              <span className="text-[#fbbf24] text-[9px] md:text-[17px] font-mono mt-1">{Math.round(heroPlayerObj?.winProbability || 0)}% WIN PROB</span>
            </div>
          </>
        )}

        <div style={{ transform: `scale(${visuals.tableZoom})` }} className="relative w-full max-w-[1400px] aspect-[15/10] md:aspect-[21/10] flex items-center justify-center h-full origin-center">
            <div className="absolute inset-0 bg-[#06080c] rounded-[50%] border-[2px] border-cyan-500/20 shadow-[inset_0_0_100px_rgba(34,211,238,0.1)]" />
            <div className="absolute inset-0 pointer-events-none z-20">
              {(players || []).map((p, i) => { 
                if (!p) return null; 
                const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; 
                return (<Seat key={`seat-${i}`} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} seatIdx={i} visuals={visuals} timeRemaining={timeRemaining} isCollectingBets={potTransferring} bigBlind={bigBlind} />); 
              })}
            </div>
            
            <div className="absolute top-[calc(48%-50px)] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full">
              {!potTransferring && ( 
                <div className="flex flex-col items-center mb-6">
                  <span className="text-white/20 text-[10px] tracking-[0.5em] mb-1 uppercase font-bold">Total Pot:</span>
                  <div className="text-[6vw] md:text-[4vw] font-black text-white font-mono tracking-tighter leading-none drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">${Number(totalDisplayPot).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div> 
              )}
              {community.length > 0 && (
                <div className="flex gap-2 md:gap-4 mt-4 transition-transform" style={{ transform: `scale(${visuals.commCardScale})` }}>
                  {(community || []).map((c, j) => {
                    const isRedSuit = c.suit === '♥' || c.suit === '♦';
                    return (
                      <div key={`comm-${c.id || j}-${j}`} className={`w-[8vw] md:w-[4vw] h-[11vw] md:h-[6vw] rounded-xl border-2 bg-white flex flex-col items-start justify-start p-1.5 text-black font-black transition-all duration-500 animate-in slide-in-from-bottom-4 ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 shadow-[0_0_30px_#fbbf24]' : 'border-white/10'}`}>
                        <span className={`text-[12px] md:text-sm font-black leading-tight ${isRedSuit ? 'text-red-600' : 'text-slate-900'}`}>{String(c.value)}</span>
                        <span className={`text-[14px] md:text-lg font-black leading-tight ${isRedSuit ? 'text-red-600' : 'text-slate-900'}`}>{String(c.suit)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Vertical Betting Slider HUD */}
            {activeIdx === heroIdx && heroPlayerObj && phase !== PHASES.IDLE && (
              <div className="absolute right-4 md:right-[20px] top-[15%] bottom-[15%] w-16 md:w-20 flex flex-col items-center justify-end z-[250] pointer-events-auto">
                <div className="flex-1 w-full relative flex items-center justify-center py-4">
                  <input 
                    type="range" 
                    min={Math.min(highestBet + bigBlind, Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet))} 
                    max={Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet)} 
                    step={0.25} 
                    value={raiseInput} 
                    onChange={(e) => setRaiseInput(Number(e.target.value))}
                    className="vertical-range appearance-none bg-white/10 w-8 md:w-10 h-full rounded-full accent-emerald-500 cursor-pointer border-2 border-white/20"
                    style={{ WebkitAppearance: 'slider-vertical', writingMode: 'bt-lr' }}
                  />
                </div>
                <div className="mt-4 bg-black/95 border-2 border-emerald-400 px-3 py-2 rounded-xl shadow-[0_0_40px_rgba(52,211,153,0.6)] animate-in zoom-in duration-300 flex flex-col items-center min-w-[110px]">
                  <span className="text-[8px] text-white/40 tracking-widest mb-1 font-bold uppercase text-center">Raise To</span>
                  <div className="flex items-center justify-center w-full">
                    <span className="text-emerald-500 font-mono text-lg md:text-2xl mr-0.5">$</span>
                    <input 
                      type="number"
                      value={raiseInput}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const min = highestBet + bigBlind;
                        const max = Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet);
                        setRaiseInput(Math.max(min, Math.min(val, max)));
                      }}
                      className="bg-transparent text-emerald-400 font-mono text-xl md:text-3xl font-black text-center outline-none w-full"
                    />
                  </div>
                </div>
              </div>
            )}
        </div>
      </main>

      <footer style={{ height: `calc(${visuals.footerHeight}px + env(safe-area-inset-bottom))` }} className="bg-black border-t border-white/10 flex flex-col z-[100] shadow-[0_-10px_50px_rgba(0,0,0,0.8)] shrink-0 font-black uppercase overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex-1 flex flex-col items-center justify-start px-4 relative pt-6"> 
          {phase === PHASES.SHOWDOWN && showdownWinners && showdownWinners.length > 0 ? (
            (() => {
                const winner = showdownWinners[currentShowdownIdx];
                if (!winner) return null;
                const isHiLo = activeVariant?.id === 'HILOW';
                const isLowWin = String(winner.rank).includes("LOW:");
                const themeColor = isLowWin ? "text-emerald-400" : (isHiLo ? "text-amber-400" : "text-white");
                const bgColor = isLowWin ? "bg-emerald-400/10" : (isHiLo ? "bg-amber-400/10" : "bg-white/5");
                const borderColor = isLowWin ? "border-emerald-400/30" : (isHiLo ? "border-amber-400/30" : "border-white/10");
                const cardBorder = isLowWin ? "border-emerald-400/50" : (isHiLo ? "border-amber-400/50" : "border-white/20");
                const winTypeLabel = isHiLo ? (isLowWin ? "THE LOW SIDE" : "THE HIGH SIDE") : "THE POT";
                const displayRank = formatRank(String(winner.rank).replace("LOW: ", "").replace("HIGH: ", ""));
                
                return (
                    <div key={`winner-disp-${winner.name}-${currentShowdownIdx}`} className="flex flex-col items-center justify-start w-full gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className={`flex items-center gap-3 ${bgColor} px-5 py-1 rounded-full border ${borderColor} max-w-full overflow-hidden shadow-2xl`}>
                            <Trophy size={14} className={themeColor + " animate-bounce shrink-0"} />
                            <div className="text-sm md:text-xl font-black tracking-tighter flex items-center gap-2 leading-none whitespace-nowrap">
                                <span className={getNeonNameColor(winner.name)}>{String(winner.name).toUpperCase()}</span>
                                <span className="text-white/40">WON</span>
                                <span className={themeColor}>{String(winTypeLabel)}</span>
                                <span className="text-emerald-400 font-mono ml-2">+${Number(winner.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                        <div className="text-[10px] md:text-sm font-black text-white/60 tracking-widest uppercase">
                          HOLDING <span className={themeColor}>{winner.rank === "!" ? "THE BEST HAND" : String(displayRank)}</span>
                        </div>
                        <div className="flex gap-1 justify-center mt-1">
                            {(winner.hand || []).map((c, ci) => (
                                <div key={`winner-card-${ci}`} className={`w-10 md:w-16 h-13 md:h-20 bg-white rounded flex flex-col items-start justify-start p-1 text-black shadow-2xl border-t-2 border-x-2 ${cardBorder} relative overflow-hidden`}>
                                    <span className={`text-[11px] md:text-sm font-black leading-tight ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span>
                                    <span className={`text-[13px] md:text-xl leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                                    <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-black/40 to-transparent" />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()
          ) : (
            <div className={`flex flex-col gap-4 items-center w-full transition-all duration-500`}>
                {heroPlayerObj && heroPlayerObj.chips >= bigBlind * 2 && phase !== PHASES.IDLE ? (<>
                    <div className="flex gap-2 w-full max-w-[600px] font-black text-center uppercase">
                        <button 
                            onClick={()=>handleAction('RAISE', highestBet + Math.floor(totalDisplayPot * 0.5))} 
                            className={`flex-1 h-10 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : 'hover:bg-white/10'}`}>
                            1/2 POT
                        </button>
                        <button 
                            onClick={()=>handleAction('RAISE', highestBet + totalDisplayPot)} 
                            className={`flex-1 h-10 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : 'hover:bg-white/10'}`}>
                            POT
                        </button>
                        <button 
                            onClick={handleAllIn} 
                            className={`flex-1 h-10 bg-red-900/30 border border-red-500/50 rounded-xl text-[10px] text-red-500 font-black transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : ''}`}>
                            ALL-IN
                        </button>
                    </div>
                    <div className="flex flex-row gap-2 w-full max-w-[800px] items-stretch justify-center font-black h-16">
                        <button 
                            onClick={() => {
                                if (activeIdx === heroIdx) handleAction('FOLD');
                                else setPreAction(preAction === 'FOLD' ? null : 'FOLD');
                            }} 
                            className={`flex-1 bg-red-950/60 border rounded-xl text-lg font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${activeIdx === heroIdx ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : preAction === 'FOLD' ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-red-500/20 opacity-60'}`}>
                            {preAction === 'FOLD' && <Check size={20} className="text-emerald-400" />} FOLD
                        </button>
                        <button 
                            onClick={() => {
                                if (activeIdx === heroIdx) handleAction('CALL');
                                else setPreAction(preAction === 'CHECK' ? null : 'CHECK');
                            }} 
                            className={`flex-1 bg-white/10 border rounded-xl text-xl font-black truncate px-2 flex items-center justify-center gap-2 transition-all ${activeIdx === heroIdx ? 'border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : preAction === 'CHECK' ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-white/5 opacity-60'}`}>
                            {preAction === 'CHECK' && <Check size={20} className="text-emerald-400" />} {activeIdx === heroIdx ? (highestBet > (heroPlayerObj?.currentBet || 0) ? `CALL $${(highestBet - (heroPlayerObj?.currentBet || 0)).toLocaleString()}` : 'CHECK') : 'CHECK'}
                        </button>
                        <div className={`flex-[1.5] flex bg-black/40 border border-white/10 rounded-xl overflow-hidden transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : ''}`}>
                            <button 
                                onClick={()=> { if(activeIdx === heroIdx) handleAction('RAISE', raiseInput); }} 
                                className="flex-1 bg-emerald-600 border border-emerald-400 rounded-lg flex items-center justify-center font-black text-lg uppercase transition-all active:scale-95">
                                <Zap size={20} className="mr-1"/> RAISE
                            </button>
                        </div>
                    </div>
                </>) : heroPlayerObj && heroPlayerObj.chips < bigBlind * 2 && (phase === PHASES.IDLE || phase === PHASES.SHOWDOWN) ? (
                    <div className="flex flex-col items-center gap-4 py-6">
                        <span className="text-white/40 tracking-[0.2em] text-xs font-black italic uppercase">Broke in Arena • Funds Available in Wallet</span>
                        <button onClick={()=>setShowRebuyModal(true)} className="px-12 py-5 bg-indigo-600 border-2 border-indigo-400 rounded-2xl font-black text-xl hover:scale-105 transition-transform flex items-center gap-3 shadow-[0_0_40px_rgba(79,70,229,0.4)] uppercase"><Coins size={24}/> Re-buy & Continue</button>
                    </div>
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
                    <button onClick={addBot} className="w-full py-4 bg-indigo-600/60 border border-indigo-400 text-white font-black rounded-xl uppercase flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all"><Bot size={18}/> Add Arena Bot</button>
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] text-white/60 uppercase tracking-widest font-black">Table Zoom</label>
                        <input type="range" min="0.3" max="1.5" step="0.05" value={visuals.tableZoom} onChange={(e) => setVisuals({...visuals, tableZoom: Number(e.target.value)})} className="accent-cyan-400 cursor-pointer" />
                    </div>
                </div>
                <button onClick={() => setShowVisualControls(false)} className="w-full py-4 bg-cyan-600 text-black font-black rounded-xl uppercase hover:brightness-110">Save & Apply</button>
            </div>
        </div>
      )}
      <style>{`
          @keyframes announcement-pop {
            0% { transform: scale(0.5); opacity: 0; filter: blur(10px); }
            30% { transform: scale(1.1); opacity: 1; filter: blur(0px); }
            70% { transform: scale(1); opacity: 1; filter: blur(0px); }
            100% { transform: scale(1.3); opacity: 0; filter: blur(20px); }
          }
          .animate-announcement-pop { animation: announcement-pop 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          
          @keyframes action-flash-once {
            0% { opacity: 0; transform: scale(0.9); }
            40% { opacity: 1; transform: scale(1.05); filter: brightness(1.5); }
            100% { opacity: 1; transform: scale(1); filter: brightness(1.1); }
          }
          .animate-action-flash-once { animation: action-flash-once 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          
          @keyframes attention-trigger {
            0% { box-shadow: 0 0 0px rgba(255,255,255,0); border-color: rgba(255,255,255,0.1); transform: scale(1); }
            30% { box-shadow: 0 0 40px rgba(255,255,255,0.9), inset 0 0 10px rgba(255,255,255,0.5); border-color: rgba(255,255,255,1); transform: scale(1.08); }
            100% { box-shadow: 0 0 0px rgba(255,255,255,0); border-color: rgba(255,255,255,0.1); transform: scale(1); }
          }
          .animate-hand-trigger { animation: attention-trigger 3s cubic-bezier(0.17, 0.67, 0.83, 0.67); }
          .animate-deal-trigger { animation: attention-trigger 1s cubic-bezier(0.17, 0.67, 0.83, 0.67); }

          @keyframes bounce-subtle {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(3px); }
          }
          .animate-bounce-subtle { animation: bounce-subtle 1.5s infinite ease-in-out; }

          html, body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; background: #000; }
          input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .vertical-range { -webkit-appearance: slider-vertical; width: 32px; height: 100%; background: rgba(255, 255, 255, 0.1); outline: none; border-radius: 999px; }
          .vertical-range::-webkit-slider-thumb { -webkit-appearance: none; width: 32px; height: 32px; background: rgba(16, 185, 129, 0.5); border: 4px solid #10b981; border-radius: 50%; box-shadow: 0 0 35px rgba(16, 185, 129, 1), 0 0 10px #fff; cursor: pointer; backdrop-filter: blur(4px); }
          .vertical-range::-moz-range-thumb { width: 32px; height: 32px; background: rgba(16, 185, 129, 0.5); border: 4px solid #10b981; border-radius: 50%; box-shadow: 0 0 35px rgba(16, 185, 129, 1), 0 0 10px #fff; cursor: pointer; backdrop-filter: blur(4px); }
      `}</style>
    </div>
  );
};

export default App;
