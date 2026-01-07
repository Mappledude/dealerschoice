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

// --- CONSTANTS ---
const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { 
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000 
});

const VERSION = "v1.8.0-PRO";
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

const VARIANTS = { 
  HOLDEM: { 
    id: 'HOLDEM', 
    name: 'Texas Hold\'em', 
    desc: '2 Hole Cards',
    rules: [
      "Each player receives 2 hole cards.",
      "Use any combination of hole and community cards to make the best 5-card hand.",
      "Standard high hand poker ranking."
    ]
  }, 
  OMAHA: { 
    id: 'OMAHA', 
    name: 'OMAHA', 
    desc: '4 Hole Cards (Exactly 2 Hole + 3 Board)',
    rules: [
      "Each player receives 4 hole cards.",
      "STRICT RULE: You MUST use exactly 2 cards from your hand and exactly 3 cards from the board.",
      "Standard high hand ranking."
    ]
  }, 
  PINEAPPLE: { 
    id: 'PINEAPPLE', 
    name: 'Pineapple', 
    desc: '3 Hole Cards',
    rules: [
      "Each player receives 3 hole cards.",
      "Evaluation uses standard high-hand rankings using any combination."
    ]
  }, 
  MUFLIS: { 
    id: 'MUFLIS', 
    name: 'Muflis', 
    desc: 'Low Hand Wins (Ace is 1)',
    rules: [
      "Weakest hand wins the pot.",
      "Ace is treated as 1 (lowest).",
      "Standard rankings are flipped: High Card beats Pair, etc."
    ]
  }, 
  HILOW: { 
    id: 'HILOW', 
    name: 'Hi-Low Split', 
    desc: '4 Hole Cards',
    rules: [
      "Each player receives 4 hole cards.",
      "PARTITION RULE: Use 2 cards for High and the remaining 2 for Low.",
      "Combine your pairs with exactly 3 cards from the community board.",
      "Low hand winner is the absolute lowest hand (no qualifier).",
      "Pot is split 50/50 between High and Low winners."
    ]
  }, 
  REDSBLACKS: { 
    id: 'REDSBLACKS', 
    name: 'Reds & Blacks', 
    desc: 'Dynamic Joker mechanic',
    rules: [
      "Each player receives 4 hole cards.",
      "JOKER: Formed by 2 Red + 1 Black OR 2 Black + 1 Red cards.",
      "If you have a Joker, you use (Joker + 4th Hole Card) + 3 board cards.",
      "NATURAL: If all 4 cards are one color, use any 2 hole cards + 3 board cards."
    ]
  }
};

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const DISPLAY_POSITIONS = [
  { x: 50, y: 92 }, { x: 15, y: 82 }, { x: 6,  y: 45 }, { x: 12, y: 12 }, { x: 30, y: 3  },
  { x: 50, y: 1  }, { x: 70, y: 3  }, { x: 88, y: 12 }, { x: 94, y: 45 }, { x: 85, y: 82 }
];

const BET_OFFSETS = [
  { x: 0, y: -160 },   { x: 100, y: -110 }, { x: 130, y: 0 },    { x: 100, y: 110 },  { x: 60, y: 130 },    
  { x: 0, y: 150 },    { x: -60, y: 130 },  { x: -100, y: 110 }, { x: -130, y: 0 },   { x: -100, y: -110 } 
];

// --- COMPONENTS ---

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  isDealer, potTransferring, timeRemaining, isHero, 
  relativeIdx, seatIdx, visuals, showdownWinnersCount, dealerIdx, players
}) => {
    if (!player || !displayPos) return null;

    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };
    const currentCardScale = isHero ? visuals.heroCardScale : visuals.oppCardScale;
    const currentCardY = isHero ? visuals.heroCardY : visuals.oppCardY;

    const timeRatio = timeRemaining / 22;
    const timerColor = timeRemaining < 6 ? '#ef4444' : timeRemaining < 12 ? '#f59e0b' : '#22d3ee';
    const isUrgent = timeRemaining < 6 && isActiveTurn;

    return (
        <div 
          style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} 
          className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 
            ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'} 
            ${player.waitingForNextHand ? 'opacity-50' : ''}
            ${isUrgent ? 'animate-panic-pulse' : ''}`}
        >
            {player.waitingForNextHand && (
                <div className="absolute top-[-20px] bg-slate-800 text-white text-[8px] px-2 py-0.5 rounded border border-white/20 uppercase font-black tracking-widest z-[150]">Waiting...</div>
            )}
            
            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-700 ${isCollectingBets ? 'animate-fling-to-pot' : 'animate-bet-splash'}`}
                    style={{ 
                      transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y + visuals.betY}px) scale(1.0)`, 
                      left: '50%', 
                      top: '50%' 
                    }}>
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-black text-[14px] md:text-[24px] px-5 py-1.5 rounded-full shadow-[0_6px_0_rgba(0,0,0,0.4),0_12px_24px_rgba(0,0,0,0.6)] border-2 border-white/40 flex items-center gap-2 whitespace-nowrap leading-none">
                        <Coins size={16} className="animate-pulse" />
                        ${String(player.currentBet)}
                    </div>
                </div>
            )}

            <div 
                style={{ transform: `translateY(${visuals.badgeY}px)` }}
                className={`relative z-50 flex flex-col items-center p-1.5 md:p-3 rounded-2xl border bg-slate-900/95 backdrop-blur-md transition-all duration-300 min-w-[100px] md:min-w-[210px] shadow-2xl overflow-hidden
                  ${isActiveTurn ? 'border-transparent ring-2 ring-white/10 scale-105 shadow-[0_0_50px_rgba(255,255,255,0.1)]' : 'border-white/10'} 
                  ${player.isWinner && phase === PHASES.SHOWDOWN ? 'border-yellow-400 animate-pulse-glow' : ''}`}
            >
                {isActiveTurn && timeRemaining > 0 && (
                  <>
                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" preserveAspectRatio="none">
                      <rect 
                        x="0" y="0" width="100%" height="100%" 
                        fill="none" 
                        stroke={timerColor} 
                        strokeWidth="8" 
                        className="transition-all duration-1000 linear"
                        style={{
                          strokeDasharray: '600',
                          strokeDashoffset: (600 - (timeRatio * 600)).toString(),
                        }}
                      />
                    </svg>
                    <div className="absolute top-1 right-1.5 w-7 h-7 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-black/80 border border-white/10 z-20">
                      <span className="text-[10px] md:text-base font-mono font-black" style={{ color: timerColor }}>{timeRemaining}</span>
                    </div>
                  </>
                )}

                {isDealer && (
                  <div className="absolute top-1.5 right-1.5 flex flex-col items-center gap-0.5 z-[110]">
                    <div className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 bg-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-status-flash" />
                  </div>
                )}
                
                <div className="flex flex-col items-center gap-0.5 w-full relative z-10">
                    <div className="flex items-center gap-1 opacity-70">
                      {player.isBot && <Bot size={10} className="text-indigo-400" />}
                      <span className="text-[9px] md:text-[16px] font-black text-white/90 uppercase truncate max-w-[80px] md:max-w-[130px]">{String(player.name || "Anon")}</span>
                    </div>
                    <span className={`text-[15px] md:text-[28px] font-mono font-black ${player.chips <= 1 ? 'text-red-500 animate-pulse' : 'text-emerald-400'} leading-none drop-shadow-[0_2px_10px_rgba(16,185,129,0.3)]`}>
                      ${Number(player.chips).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                </div>
            </div>

            {player.hand && Array.isArray(player.hand) && !player.isFolded && !player.waitingForNextHand && (
                <div className="relative z-10 flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible">
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const offset = ci - mid;
                        const fanRotation = offset * visuals.holeCardFan;
                        const fanTranslation = offset * (player.hand.length > 2 ? 2.0 : 3.5);
                        const isRedSuit = c.suit === '♥' || c.suit === '♦';
                        const suitColor = isRedSuit ? 'text-red-600' : 'text-black';
                        return (
                          <div key={c.id || ci} 
                              className={`w-[5vw] md:w-[3vw] h-[7vw] md:h-[5vw] rounded-[3px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-300 animate-deal-card ${phase === PHASES.SHOWDOWN || isHero ? 'bg-white text-black' : 'bg-slate-800'} ${phase === PHASES.SHOWDOWN && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_200px_#fbbf24]' : 'border-white/20'}`} 
                              style={{ transform: `translateX(${fanTranslation}vw) rotate(${fanRotation}deg) scale(${currentCardScale})`, transformOrigin: 'bottom center', top: `${currentCardY}px`, animationDelay: `${seatIdx * 0.1}s` }}>
                              {(phase === PHASES.SHOWDOWN || isHero) && ( 
                                <>
                                  <span className={`text-[9px] md:text-[12px] font-black leading-none ${suitColor}`}>{String(c.value)}</span>
                                  <span className={`text-[9px] md:text-[16px] leading-none ${suitColor}`}>{String(c.suit)}</span>
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
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dealerIdx, setDealerIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([{ id: 'init', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), name: 'SYSTEM', action: 'INTELLIGENCE LINK ESTABLISHED', type: 'phase' }]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(22);
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
  const [announcement, setAnnouncement] = useState(null); 
  const joinLock = useRef(false);
  const phaseRef = useRef(PHASES.IDLE); 
  
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 100, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10, pendingVariant: 'HOLDEM' });

  const isMobile = window.innerWidth < 768;
  const headerHeight = isMobile ? 64 : 80; 

  const [visuals, setVisuals] = useState({
    heroCardScale: 4.0, heroCardY: 22, oppCardScale: 1.0, oppCardY: -25,
    commCardScale: 1.8, commCardY: -7, betScale: 2.0, betY: 47,
    badgeY: 85, 
    footerHeight: 270, 
    tableZoom: window.innerWidth < 768 ? 0.75 : 0.85, 
    holeCardFan: 25
  });

  const footerHeight = visuals.footerHeight;
  const tableZoom = visuals.tableZoom;

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

  const handleAction = useCallback((type, amt = 0) => {
    const finalAmount = amt !== 0 ? amt : raiseInput;
    if (currentRoomId) socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(finalAmount) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleAllIn = useCallback(() => {
    if (!heroPlayerObj) return;
    const totalStack = Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet);
    handleAction('RAISE', totalStack);
  }, [heroPlayerObj, handleAction]);

  const addBot = useCallback(() => { 
    if (currentRoomId && isConnected) {
      socket.emit('adminAddBot', { roomId: currentRoomId });
    }
  }, [currentRoomId, isConnected]);

  const handleLogin = useCallback(() => { 
    if (passwordInput.toLowerCase().trim() === 'pass') { 
        setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin' }); 
        setCurrentView(VIEWS.ADMIN); socket.emit('getInitialData'); 
    } else socket.emit('playerLogin', { password: passwordInput });
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

  const handleCreatePlayer = useCallback(() => {
    if (!newPlayer.name) return;
    socket.emit('adminCreatePlayer', { ...newPlayer, uid: Math.random().toString(36).slice(2) });
    setNewPlayer({ name: '', chips: 100, password: '' });
  }, [newPlayer]);

  const handleSpawnArena = useCallback(() => {
    if (!newTable.name) return;
    socket.emit('adminCreateRoom', { ...newTable, id: 'room_' + Math.random().toString(36).slice(2, 9) });
    setNewTable({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10, pendingVariant: 'HOLDEM' });
  }, [newTable]);

  const handleNuclear = useCallback(() => {
      if (!nuclearConfirm) {
          setNuclearConfirm(true);
          setTimeout(() => setNuclearConfirm(false), 3000);
          return;
      }
      socket.emit('adminNuclearReset');
      setNuclearConfirm(false);
  }, [nuclearConfirm]);

  const formatRank = (rank) => {
    if (!rank) return "";
    let clean = rank.split(',')[0].split(' of ')[0];
    const categories = [
        "five of a kind", "straight flush", "four of a kind", "full house", 
        "flush", "straight", "three of a kind", "two pair", "pair", "high card", "low"
    ];
    const lowerRank = clean.toLowerCase();
    for (const cat of categories) {
        if (lowerRank.includes(cat)) {
            return cat.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
    }
    return clean.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getShowdownText = (winner, allWinners) => {
    const name = String(winner.name);
    const amt = Number(winner.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2});
    if (winner.rank === "!") return `${name} wins $${amt} (Mucked)`;
    const isHi = String(winner.rank).includes("HIGH:");
    const isLo = String(winner.rank).includes("LOW:");
    const occurrences = allWinners.filter(w => w.name === winner.name).length;
    const isHiLoGame = allWinners.some(w => String(w.rank).includes("HIGH:") || String(w.rank).includes("LOW:"));
    if (occurrences > 1 && isHiLoGame) return `${name} SCOOPS $${amt}! (HI/LO)`;
    const cleanRank = formatRank(String(winner.rank).replace("HIGH: ", "").replace("LOW: ", ""));
    if (isHi) return `${name} wins $${amt} (HI) • ${cleanRank}`;
    if (isLo) return `${name} wins $${amt} (LO) • ${cleanRank}`;
    return `${name} wins $${amt} • ${cleanRank}`;
  };

  useEffect(() => {
    const handleRoomUpdate = (d) => {
        if (!d) return;

        setPlayers(() => { 
          const next = Array(TOTAL_SEATS).fill(null); 
          (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
          return next; 
        });

        // 3 SECOND DELAY FOR VARIATION NAME ANNOUNCEMENT
        if (d.phase !== phaseRef.current && d.phase !== PHASES.IDLE && d.phase !== PHASES.SHOWDOWN) {
            const vId = d.activeVariant?.id || 'HOLDEM';
            const vName = VARIANTS[vId]?.name || "Poker";
            
            setTimeout(() => {
                setAnnouncement({
                    text: vName,
                    color: VARIANT_COLORS[vId] || '#fff'
                });
                setTimeout(() => setAnnouncement(null), 1500);
            }, 3000); 
        }
        phaseRef.current = d.phase;

        setPhase(d.phase);
        setCommunity(d.community || []);
        setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0);
        setActiveIdx(d.activeIdx ?? -1);
        setHighestBet(d.highestBet || 0);
        setDealerIdx(d.dealerIdx ?? -1);
        setTimeRemaining(d.timeRemaining || 0);
        if (d.activeVariant) {
            const vId = typeof d.activeVariant === 'string' ? d.activeVariant : d.activeVariant.id;
            setActiveVariant(VARIANTS[vId] || { id: vId, name: d.activeVariant.name || vId, rules: [] });
        }
        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true);
            setCurrentShowdownIdx(0);
            const rawWinners = d.showdownWinners || [];
            setShowdownWinners(rawWinners);
            setWinning5Ids(d.winning5Ids || []);
            const durationPerWinner = 4000;
            if (rawWinners.length > 1) {
                for (let i = 1; i < rawWinners.length; i++) {
                    setTimeout(() => setCurrentShowdownIdx(i), i * durationPerWinner);
                }
            }
            setTimeout(() => setPotTransferring(false), rawWinners.length * durationPerWinner);
        }
    };

    socket.on('connect', () => setIsConnected(true));
    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('lobbyUpdate', setActiveTables);
    socket.on('profilesUpdate', (list) => { 
        setAllProfiles(list); 
        setUserProfile(prev => {
            if (!prev) return null;
            const updated = list.find(p => p.uid === prev.uid);
            return updated ? { ...prev, chips: updated.chips } : prev;
        });
    });
    socket.on('loginSuccess', (p) => { 
        setUserProfile(p); 
        setPendingVariantId(p.pendingVariant || 'HOLDEM'); 
        setCurrentView(VIEWS.LOBBY); 
    });

    return () => { 
        socket.off('connect');
        socket.off('roomUpdate'); 
        socket.off('lobbyUpdate'); 
        socket.off('profilesUpdate'); 
        socket.off('loginSuccess');
    };
  }, []); 

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white uppercase font-black">
        <div className="w-full max-w-[400px] p-8 md:p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-700">
            <Lock size={32} className="text-[#fbbf24] animate-pulse" />
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-xl font-black uppercase focus:bg-white/10 transition-all"/>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl font-black text-lg hover:scale-105 active:scale-95 transition-transform uppercase">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white uppercase font-black overflow-hidden pt-[env(safe-area-inset-top)]">
        <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-3 md:p-8 flex flex-row md:flex-col gap-2 md:gap-4 bg-black/20 shrink-0">
            <h2 className="hidden md:flex text-[#fbbf24] items-center gap-2 mb-4"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>TABLES</button>
            <button onClick={handleNuclear} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all uppercase ${nuclearConfirm ? 'bg-red-600 border-white text-white' : 'bg-white/5 text-red-500 border-red-500/20'}`}>
                <Bomb size={14}/> {nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}
            </button>
            <button onClick={()=>setCurrentView(VIEWS.LOBBY)} className="flex-1 md:flex-none p-2.5 md:p-4 rounded-xl bg-cyan-600 text-black font-black text-[9px] md:text-xs">BACK TO LOBBY</button>
        </aside>
        <main className="flex-1 p-5 md:p-12 overflow-y-auto bg-black/40">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-[#fbbf24] pl-4">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm"/>
                        <button onClick={handleCreatePlayer} className="bg-[#fbbf24] text-black rounded-xl font-black p-3 text-sm">CREATE</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                        {allProfiles.map(p => (
                            <div key={p.uid} className="flex justify-between p-3 md:p-4 border-b border-white/5 items-center hover:bg-white/5">
                                <span className="text-[10px] md:text-sm font-black truncate max-w-[100px]">{String(p.name)}</span>
                                <div className="flex gap-2 md:gap-4 items-center"><span className="text-emerald-400 font-mono text-xs md:text-lg">${Number(p.chips || 0).toLocaleString()}</span><button onClick={()=>{const n = prompt("NEW WALLET", String(p.chips || 0)); if(n !== null && n !== "") socket.emit('adminEditChips', {uid: p.uid, chips: Number(n)})}} className="text-cyan-400"><Edit3 size={14}/></button><button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500"><Trash2 size={14}/></button></div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-emerald-500 pl-4">ARENA CONTROL</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border border-white/10">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm"/>
                        <div className="flex gap-2">
                          <input type="number" step="0.05" value={newTable.sb} onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})} placeholder="SB" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm w-1/2"/>
                          <input type="number" step="0.05" value={newTable.bb} onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})} placeholder="BB" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm w-1/2"/>
                        </div>
                        <div className="flex gap-2">
                          <input type="number" value={newTable.minBuy} onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})} placeholder="MIN BUY" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm w-1/2"/>
                          <input type="number" value={newTable.maxBuy} onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})} placeholder="MAX BUY" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm w-1/2"/>
                        </div>
                        <button onClick={handleSpawnArena} className="bg-emerald-600 text-white rounded-xl font-black p-3 text-sm lg:col-span-3">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 md:gap-4">
                        {activeTables.map(t => (
                            <div key={t.id} className="bg-white/5 p-3 rounded-2xl flex justify-between items-center border border-white/10">
                              <div>
                                <h4 className="text-[#fbbf24] font-black text-xs md:text-base">{String(t.name)}</h4>
                                <p className="text-[8px] text-white/40 tracking-widest uppercase">${t.sb}/${t.bb} • Buy-in: ${t.minBuy}-${t.maxBuy}</p>
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
                <div className="flex gap-4"><button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black text-[10px] uppercase">BACK</button><button onClick={joinRoom} disabled={isJoining} className={`flex-2 p-3.5 rounded-2xl shadow-lg transition-all text-[10px] tracking-widest font-black uppercase ${isJoining ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:scale-105 active:scale-95'}`}>{isJoining ? 'Joining...' : 'SIT DOWN'}</button></div>
              </div>
            </div>
        )}
        <header className="h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-5 md:px-12 bg-black/40 backdrop-blur-md shadow-xl shrink-0 pt-[env(safe-area-inset-top)]">
          <h2 className="tracking-[0.2em] md:tracking-[0.4em] text-xs md:text-xl flex items-center gap-2 md:gap-4 font-black"><LayoutGrid className="text-[#fbbf24] w-3 md:w-6"/> LOBBY</h2>
          <div className="flex items-center gap-3 md:gap-10 font-black">
            <div className="flex flex-col items-end"><span className="text-[7px] text-white/40 uppercase italic truncate max-w-[50px] md:max-w-none">{String(userProfile?.name || "??")}</span><span className="text-emerald-400 font-mono text-xs md:text-2xl tracking-tighter">${Number(userProfile?.chips || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={16}/></button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-10 overflow-y-auto bg-gradient-to-br from-transparent to-white/5 font-black uppercase">
            {activeTables.length === 0 ? (<div className="col-span-full flex flex-col items-center justify-center p-20 text-white/20 gap-4 uppercase font-black"><ShieldAlert size={48} /><span className="text-sm tracking-[0.4em]">NO ACTIVE ARENAS</span></div>) : (activeTables.map((t) => (
              <div key={t.id} className="p-4 md:p-8 bg-white/5 border border-white/5 rounded-2xl md:rounded-3xl flex flex-col gap-3 md:gap-6 shadow-2xl hover:border-[#fbbf24]/20 transition-all group relative overflow-hidden font-black">
                <h3 className="text-lg md:text-2xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors uppercase font-black">{String(t.name)}</h3>
                <div className="bg-black/60 p-3 md:p-6 rounded-2xl flex justify-between items-center border border-white/5 shadow-inner uppercase font-black">
                  <div className="flex flex-col font-black"><span className="text-[7px] md:text-[8px] text-white/40 tracking-widest">STAKES</span><span className="text-[#fbbf24] text-base md:text-xl font-black">${t.sb}/${t.bb}</span></div>
                  <div className="flex flex-col items-end font-black"><span className="text-[7px] md:text-[8px] text-white/40 tracking-widest">SEATS</span><span className="text-white/80 font-mono text-[10px] md:text-base font-black">{t.players?.filter(p=>p).length || 0}/10</span></div>
                </div>
                <button onClick={()=>setSelectedTableForJoin(t)} className="relative z-20 w-full p-4 md:p-8 bg-emerald-600 rounded-xl md:rounded-2xl tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-[9px] md:text-[10px] font-black uppercase">ENTER ARENA</button>
              </div>
            )))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      {announcement && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none">
              <h1 
                className="text-[12vw] md:text-[8vw] font-black uppercase italic tracking-tighter animate-announcement-pop drop-shadow-[0_10px_50px_rgba(0,0,0,0.9)] text-center px-10"
                style={{ color: announcement.color, textShadow: `0 0 40px ${announcement.color}44` }}
              >
                  {announcement.text}
              </h1>
          </div>
      )}

      {showVisualControls && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 md:p-12">
            <div className="w-full max-w-[1000px] h-[90vh] bg-slate-900/90 border-2 border-white/20 rounded-[3rem] p-10 md:p-14 flex flex-col gap-8 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-y-auto scrollbar-hide relative">
                <div className="flex items-center justify-between border-b-2 border-white/10 pb-6 sticky top-0 bg-transparent z-10">
                    <h3 className="text-lg md:text-2xl text-[#fbbf24] flex items-center gap-4 font-black uppercase tracking-tighter"><Settings2 size={44}/> Display Configuration</h3>
                    <button onClick={() => setShowVisualControls(false)} className="text-white/40 hover:text-white transition-colors p-2"><X size={44}/></button>
                </div>
                <div className="flex flex-col gap-12 pb-14">
                    <div className="flex flex-col gap-6">
                        <h4 className="text-sm md:text-xl tracking-[0.2em] text-emerald-400 uppercase font-black border-l-4 border-emerald-400 pl-4">Arena Layout</h4>
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] md:text-base text-white/60 uppercase font-black">Table Zoom ({visuals.tableZoom.toFixed(2)})</label>
                                <input type="range" min="0.3" max="1.5" step="0.05" value={visuals.tableZoom} onChange={(e) => setVisuals({...visuals, tableZoom: Number(e.target.value)})} className="accent-emerald-400 h-6 cursor-pointer" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] md:text-base text-white/60 uppercase font-black">Actions HUD Height ({visuals.footerHeight}px)</label>
                                <input type="range" min="40" max="600" step="1" value={visuals.footerHeight} onChange={(e) => setVisuals({...visuals, footerHeight: Number(e.target.value)})} className="accent-indigo-400 h-6 cursor-pointer" />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-6">
                        <h4 className="text-sm md:text-xl tracking-[0.2em] text-purple-400 uppercase font-black border-l-4 border-purple-400 pl-4">Hole Cards</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] md:text-base text-white/60 uppercase font-black">SIZE SCALE ({visuals.heroCardScale.toFixed(1)})</label>
                                <input type="range" min="1.0" max="6.0" step="0.1" value={visuals.heroCardScale} onChange={(e) => setVisuals({...visuals, heroCardScale: Number(e.target.value)})} className="accent-purple-500 h-6 cursor-pointer" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] md:text-base text-white/60 uppercase font-black">Y POSITION ({visuals.heroCardY}px)</label>
                                <input type="range" min="-200" max="200" step="1" value={visuals.heroCardY} onChange={(e) => setVisuals({...visuals, heroCardY: Number(e.target.value)})} className="accent-purple-500 h-6 cursor-pointer" />
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setShowVisualControls(false)} className="w-full py-6 bg-emerald-600 rounded-[2rem] text-lg md:text-xl font-black uppercase shadow-2xl hover:brightness-125 transition-all active:scale-95 mb-[env(safe-area-inset-bottom)]">Accept & Save Changes</button>
                </div>
            </div>
        </div>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-12" onClick={() => setShowRulesModal(false)}>
          <div className="w-full max-w-[600px] bg-slate-900 border-2 border-cyan-500/40 rounded-[2.5rem] p-8 md:p-12 shadow-[0_0_80px_rgba(34,211,238,0.2)] animate-in zoom-in duration-300 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
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

      <header className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-2 md:px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black pt-[env(safe-area-inset-top)]" style={{ height: `calc(${headerHeight}px + env(safe-area-inset-top))` }}>
        <div className="flex items-center gap-2 overflow-hidden flex-1">
            <button 
                onClick={() => setShowRulesModal(true)}
                className={`bg-white/5 hover:bg-white/10 transition-all px-3 py-2 rounded-xl border border-white/10 shadow-inner flex flex-col justify-center min-w-[90px] md:min-w-[150px] h-[50px] md:h-[65px] relative group overflow-hidden ${phase === PHASES.FLOP || phase === PHASES.TURN ? 'animate-intelligence-link' : ''}`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[#fbbf24] text-[8px] md:text-[11px] leading-none mb-1 uppercase tracking-widest flex items-center gap-1.5 font-black">
                THIS HAND: <Sparkles size={10} className="animate-spin-slow" />
              </span>
              <span className="text-white text-[11px] md:text-lg truncate leading-none font-black drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">
                {String(activeVariant?.name || "Hold'em")}
              </span>
            </button>

            <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl flex flex-col justify-center shadow-inner min-w-[90px] md:min-w-[150px] h-[50px] md:h-[65px] relative group hover:bg-white/10 transition-all">
                <span className="text-cyan-400 text-[8px] md:text-[11px] leading-none mb-1 uppercase tracking-widest font-black">On My Deal:</span>
                <div className="relative flex items-center">
                    <select 
                        value={pendingVariantId} 
                        onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value}); }} 
                        className="bg-transparent text-white outline-none text-[11px] md:text-lg cursor-pointer font-black uppercase appearance-none leading-none w-full pr-6 z-10"
                    >
                        {Object.entries(VARIANTS).map(([k,v]) => (<option key={k} value={k} className="bg-slate-900">{isMobile ? k : v.name}</option>))}
                    </select>
                    <ChevronDown size={14} className="absolute right-0 text-cyan-400 pointer-events-none group-hover:translate-y-0.5 transition-transform" />
                </div>
                <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#22d3ee]" />
            </div>
        </div>

        <div className="flex items-center gap-2">
            <button 
                onClick={addBot} 
                className={`${isConnected ? 'text-indigo-400' : 'text-white/20'} p-3 md:p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all active:scale-95 shadow-xl`}
                title={isConnected ? "Add Bot" : "Connecting..."}
            >
                {isConnected ? <Bot size={20}/> : <Activity size={20} className="animate-pulse" />}
            </button>
            <button onClick={() => setIntelExpanded(!intelExpanded)} className={`${intelExpanded ? 'text-white bg-indigo-600' : 'text-[#fbbf24] bg-white/5'} p-3 md:p-4 border border-white/10 rounded-xl hover:bg-white/10 transition-all active:scale-95 shadow-xl`}><Eye size={20}/></button>
            <button onClick={() => setShowVisualControls(true)} className="text-cyan-400 p-3 md:p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all active:scale-95 shadow-xl"><Settings size={20}/></button>
            <button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid });setCurrentView(VIEWS.LOBBY);}} className="text-red-500 p-3 md:p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all active:scale-95 shadow-xl"><LogOut size={20}/></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-emerald-950/20 to-transparent overflow-hidden px-1 py-1 font-black uppercase">
        {/* TOP LEFT: FLOATING LOW STRENGTH TEXT (HILOW ONLY) */}
        {heroPlayerObj && !heroPlayerObj.isFolded && phase !== PHASES.IDLE && activeVariant?.id === 'HILOW' && (
          <div className="absolute top-4 left-4 md:top-10 md:left-10 z-[90] flex flex-col items-start pointer-events-none animate-in slide-in-from-left duration-700">
            <span className="text-[10px] md:text-sm text-white/40 tracking-[0.4em] font-black uppercase mb-1 drop-shadow-lg">Low Strength</span>
            <span className="text-[18px] md:text-4xl text-emerald-400 font-black uppercase leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
              {phase === PHASES.PRE_FLOP ? "Pre-flop" : formatRank(String(heroPlayerObj?.lowStrength || "Pre-flop"))}
            </span>
            <span className="text-[#fbbf24] text-[14px] md:text-2xl font-mono font-black mt-1 tracking-tighter drop-shadow-md">
              {phase === PHASES.PRE_FLOP ? '-' : Math.round(heroLowWinProb)}% PROB.
            </span>
          </div>
        )}

        {/* TOP RIGHT: FLOATING STRENGTH TEXT */}
        {heroPlayerObj && !heroPlayerObj.isFolded && phase !== PHASES.IDLE && (
          <div className="absolute top-4 right-4 md:top-10 md:right-10 z-[90] flex flex-col items-end pointer-events-none animate-in slide-in-from-right duration-700">
            <span className="text-[10px] md:text-sm text-white/40 tracking-[0.4em] font-black uppercase mb-1 drop-shadow-lg">
              {activeVariant?.id === 'HILOW' ? 'High Strength' : 'Hand Strength'}
            </span>
            <span className="text-[18px] md:text-4xl text-purple-400 font-black uppercase leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
              {phase === PHASES.PRE_FLOP ? "Pre-flop" : formatRank(String(heroPlayerObj?.strength || "Pre-flop"))}
            </span>
            <span className="text-[#fbbf24] text-[14px] md:text-2xl font-mono font-black mt-1 tracking-tighter drop-shadow-md">
              {phase === PHASES.PRE_FLOP ? '-' : Math.round(heroWinProb)}% PROB.
            </span>
          </div>
        )}

        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 40}px)` }} className="relative w-full max-w-[1400px] aspect-[15/10] md:aspect-[21/10] flex items-center justify-center h-full origin-center">
            <div className="absolute inset-0 bg-[#0f3d2e]/40 rounded-[50%] border-[3vw] md:border-[2vw] border-slate-900/60 shadow-[inset_0_0_15vw_rgba(0,0,0,0.8)] border-double" />
            <div className="absolute inset-0 pointer-events-none z-20">
              {(players || []).map((p, i) => { if (!p) return null; const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; return (<Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} seatIdx={i} visuals={visuals} timeRemaining={timeRemaining} isCollectingBets={potTransferring} showdownWinnersCount={showdownWinners?.length || 0} dealerIdx={dealerIdx} players={players} />); })}
            </div>
            
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center">
              {!potTransferring && ( <div className="flex flex-col items-center transition-all duration-300 font-black"><div className="text-[12vw] md:text-[6vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-[0_4px_30px_rgba(0,0,0,0.8)]">${Number(totalDisplayPot).toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div> )}
              {community.length > 0 && (
                <div className="flex gap-2 md:gap-5 mt-6 md:mt-16 transition-transform" style={{ transform: `scale(${visuals.commCardScale}) translateY(${visuals.commCardY}px)` }}>
                  {(community || []).map((c, j) => {
                    const isRedSuit = c.suit === '♥' || c.suit === '♦';
                    const suitColor = isRedSuit ? 'text-red-600' : 'text-black';
                    return (
                      <div key={c.id || j} className={`w-[6vw] md:w-[3.5vw] h-[9vw] md:h-[5.5vw] rounded-[4px] border-2 bg-white flex flex-col items-center justify-center text-black font-black transition-all duration-500 animate-in slide-in-from-bottom-2 ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 z-30 shadow-[0_0_50px_rgba(251,191,36,0.8)]' : 'border-white/20 shadow-2xl'}`}>
                        <span className={`text-[12px] md:text-[1vw] font-black leading-none ${suitColor}`}>{String(c.value)}</span>
                        <span className={`text-[16px] md:text-[2.5vw] font-black leading-none ${suitColor}`}>{String(c.suit)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        </div>
      </main>

      <footer style={{ height: `calc(${visuals.footerHeight}px + env(safe-area-inset-bottom))` }} className="bg-black/95 backdrop-blur-3xl border-t border-white/10 flex flex-col z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 font-black uppercase overflow-visible pb-[env(safe-area-inset-bottom)]">
        <div className="flex-1 flex flex-col justify-start pt-4 md:pt-10 px-2 md:px-10 relative bg-white/5">
          {phase === PHASES.SHOWDOWN && showdownWinners && showdownWinners.length > 0 ? (
            <div className="flex flex-col items-center justify-center h-full relative animate-in fade-in zoom-in duration-500">
                <div className="flex items-center gap-4 text-yellow-400 animate-pulse font-black tracking-[0.4em] text-lg md:text-4xl uppercase text-center drop-shadow-[0_0_30px_rgba(251,191,36,0.7)] mb-4 md:mb-10">
                    <Trophy size={40} className="md:size-12 text-yellow-400" />
                    {getShowdownText(showdownWinners[currentShowdownIdx], showdownWinners)}
                </div>
                <div className="flex gap-4 md:gap-10 items-center justify-center">
                    <div className="flex flex-col items-center scale-110 md:scale-125">
                        <div className="text-white font-black text-2xl md:text-5xl mb-4 tracking-tighter drop-shadow-lg">{showdownWinners[currentShowdownIdx].name}</div>
                        <div className="flex gap-3">
                            {(showdownWinners[currentShowdownIdx].hand || []).map((c, ci) => (
                                <div key={ci} className="w-16 md:w-28 h-24 md:h-40 bg-white rounded-xl flex flex-col items-center justify-center text-black shadow-[0_0_40px_rgba(0,0,0,0.5)] border-4 border-yellow-400/50 animate-showdown-card-pop">
                                    <span className={`text-xl md:text-4xl font-black ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{c.value}</span>
                                    <span className={`text-3xl md:text-7xl ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{c.suit}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          ) : (
            <div className={`flex flex-col gap-3 md:gap-6 items-center w-full transition-all duration-500 ${activeIdx !== heroIdx ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                {heroPlayerObj && !heroPlayerObj.isFolded && phase !== PHASES.IDLE ? (<>
                    <div className="flex gap-2 w-full max-w-[700px] font-black uppercase">
                        <button disabled={activeIdx !== heroIdx} onClick={()=>handleAction('RAISE', highestBet + Math.floor(totalDisplayPot * 0.5))} className="flex-1 h-8 md:h-12 bg-white/5 border border-white/10 rounded-xl text-[10px] md:text-[16px] hover:bg-white/20 transition-all font-black">1/2 POT</button>
                        <button disabled={activeIdx !== heroIdx} onClick={()=>handleAction('RAISE', highestBet + totalDisplayPot)} className="flex-1 h-8 md:h-12 bg-white/5 border border-white/10 rounded-xl text-[10px] md:text-[16px] hover:bg-white/20 transition-all font-black">POT</button>
                        <button disabled={activeIdx !== heroIdx} onClick={handleAllIn} className="flex-1 h-8 md:h-12 bg-red-900/30 border border-red-500/50 rounded-xl text-[10px] md:text-[16px] text-red-500 hover:bg-red-600 hover:text-white transition-all font-black">ALL-IN</button>
                    </div>
                    <div className="flex flex-row gap-2 w-full max-w-[800px] items-center justify-center font-black">
                        <button disabled={activeIdx !== heroIdx} onClick={()=>handleAction('FOLD')} className="flex-1 h-12 md:h-20 bg-red-950/60 border-2 border-red-500/50 rounded-2xl tracking-[0.2em] hover:brightness-125 transition-all font-black text-sm md:text-xl shadow-2xl">FOLD</button>
                        <button disabled={activeIdx !== heroIdx} onClick={()=>handleAction('CALL')} className="flex-1 h-12 md:h-20 bg-indigo-900/60 border-2 border-indigo-400/50 rounded-2xl text-sm md:text-3xl tracking-widest hover:brightness-125 font-black shadow-2xl px-1 truncate">
                            {highestBet > (heroPlayerObj?.currentBet || 0) ? (highestBet - (heroPlayerObj?.currentBet || 0) >= (heroPlayerObj?.chips || 0) ? `ALL-IN` : `CALL $${(highestBet - (heroPlayerObj?.currentBet || 0)).toLocaleString()}`) : 'CHECK'}
                        </button>
                        <div className="flex-[2] flex gap-2 items-center bg-black/60 border border-white/10 p-1 md:p-3 rounded-2xl shadow-inner font-black overflow-hidden">
                            <div className="flex items-center bg-black/40 px-2 md:px-6 rounded-xl border border-white/5 h-10 md:h-16 flex-1">
                                <span className="text-[#fbbf24] text-xs md:text-3xl font-mono mr-1">$</span>
                                <input disabled={activeIdx !== heroIdx} type="number" step="0.25" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet), Math.max(0, Number(e.target.value))))} className="w-full bg-transparent text-center font-mono text-sm md:text-3xl text-[#fbbf24] outline-none font-black" />
                            </div>
                            <button disabled={activeIdx !== heroIdx} onClick={()=>handleAction('RAISE', raiseInput)} className="flex-1 h-10 md:h-16 bg-emerald-600/60 border-2 border-emerald-400/50 rounded-xl flex items-center justify-center hover:brightness-125 font-black text-xs md:text-3xl shadow-2xl"><Zap size={24} className="mr-2 text-emerald-400"/> RAISE</button>
                        </div>
                    </div>
                </>) : (
                    <div className="flex flex-col items-center gap-2 py-12">
                        <span className="text-white/20 tracking-[0.5em] text-xs md:text-2xl font-black italic uppercase animate-pulse">Arena Idle / Observation Mode</span>
                    </div>
                )}
            </div>
          )}
        </div>
      </footer>
      <style>{`
          @keyframes announcement-pop {
            0% { transform: scale(0.5); opacity: 0; filter: blur(10px); }
            30% { transform: scale(1.1); opacity: 1; filter: blur(0px); }
            70% { transform: scale(1); opacity: 1; filter: blur(0px); }
            100% { transform: scale(1.5); opacity: 0; filter: blur(20px); }
          }
          .animate-announcement-pop { animation: announcement-pop 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes intelligence-link {
            0% { box-shadow: 0 0 0px #fbbf24; border-color: rgba(251,191,36,0.3); }
            50% { box-shadow: 0 0 25px #fbbf24; border-color: rgba(251,191,36,1); background-color: rgba(251,191,36,0.1); }
            100% { box-shadow: 0 0 0px #fbbf24; border-color: rgba(251,191,36,0.3); }
          }
          .animate-intelligence-link { animation: intelligence-link 1.5s infinite ease-in-out; }
          .animate-spin-slow { animation: spin 8s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes status-flash {
            0% { opacity: 0.4; transform: scale(0.9); }
            50% { opacity: 1; transform: scale(1.1); box-shadow: 0 0 15px #ef4444; }
            100% { opacity: 0.4; transform: scale(0.9); }
          }
          .animate-status-flash { animation: status-flash 2s infinite ease-in-out; }
          @keyframes panic-pulse {
            0% { transform: scale(1) translateX(-50%) translateY(-50%); }
            50% { transform: scale(1.08) translateX(-50%) translateY(-50%); filter: drop-shadow(0 0 40px #ef4444); }
            100% { transform: scale(1) translateX(-50%) translateY(-50%); }
          }
          .animate-panic-pulse { animation: panic-pulse 0.35s infinite cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 100 !important; }
          @keyframes showdown-pop { 
            0% { transform: scale(0.5) translateY(100px); opacity: 0; filter: brightness(3); } 
            100% { transform: scale(1) translateY(0); opacity: 1; filter: brightness(1); } 
          }
          .animate-showdown-card-pop { animation: showdown-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          html, body { overscroll-behavior-y: contain; height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; font-family: 'Inter', sans-serif; background: #06080c; }
      `}</style>
    </div>
  );
};

export default App;
