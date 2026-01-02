import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare, Clock, BarChart3, BookOpen, Activity, Percent, Flame,
  TrendingDown, Gavel, Crown, Terminal, Shield, Cpu, Check, CheckCircle2
} from 'lucide-react';
import io from 'socket.io-client';

const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const DISPLAY_POSITIONS = [
  { x: 50, y: 88 }, { x: 15, y: 80 }, { x: 8,  y: 50 }, { x: 15, y: 20 }, { x: 35, y: 8  },
  { x: 50, y: 6  }, { x: 65, y: 8  }, { x: 85, y: 20 }, { x: 92, y: 50 }, { x: 85, y: 80 }
];

const BET_OFFSETS = [
  { x: 0, y: -140 },   { x: 80, y: -100 }, { x: 110, y: 0 },    { x: 80, y: 100 },  { x: 60, y: 120 },   
  { x: 0, y: 130 },    { x: -60, y: 120 },  { x: -80, y: 100 }, { x: -110, y: 0 },   { x: -80, y: -100 } 
];

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em' }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA' }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple' }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis' },
  HILOW: { id: 'HILOW', name: 'Hi-Low Split' },
  SHORTDECK: { id: 'SHORTDECK', name: 'Short Deck (6+)' },
  SUPEROMAHA: { id: 'SUPEROMAHA', name: 'Super Omaha' },
  ROYAL: { id: 'ROYAL', name: 'Royal Hold\'em' },
  COURCHEVEL: { id: 'COURCHEVEL', name: 'Courchevel' },
  CRAZYPINEAPPLE: { id: 'CRAZYPINEAPPLE', name: 'Crazy Pineapple' }
};

const VARIANT_RULES = {
  HOLDEM: "Standard Texas Hold'em rules. Best 5-card hand using 2 hole and 5 board cards.",
  OMAHA: "Pot-Limit Omaha rules. Must use exactly 2 hole cards and 3 board cards.",
  PINEAPPLE: "3 cards dealt. Discard one card before pre-flop betting.",
  MUFLIS: "Standard worst hand is the winner. Royal Flushes lose to High Card.",
  HILOW: "Split pot between the best High and best Low (8-or-better) hand.",
  SHORTDECK: "2s through 5s removed. Flushes beat Full Houses.",
  SUPEROMAHA: "Action Omaha with 5 cards. High variance rules apply.",
  ROYAL: "20-card deck. Straights and Full Houses are standard minimums.",
  COURCHEVEL: "First flop card is revealed during pre-flop betting.",
  CRAZYPINEAPPLE: "3 cards dealt. Discard one card ONLY after the flop betting."
};

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

// --- HAND EVALUATION ENGINE ---
const VAL_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const rankHand = (cards) => {
    if (!cards || cards.length < 5) return { power: 0, name: "" };
    const sorted = [...cards].sort((a, b) => VAL_MAP[b.value] - VAL_MAP[a.value]);
    const ranks = sorted.map(c => VAL_MAP[c.value]);
    const counts = ranks.reduce((acc, r) => { acc[r] = (acc[r] || 0) + 1; return acc; }, {});
    const tiebreakerRanks = Object.entries(counts)
        .map(([rank, count]) => ({ r: parseInt(rank), c: count }))
        .sort((a, b) => b.c - a.c || b.r - a.r);

    const vc = tiebreakerRanks.map(x => x.c);
    const isFlush = new Set(sorted.map(c => c.suit)).size === 1;
    let isStraight = true;
    for (let i = 0; i < ranks.length - 1; i++) {
        if (ranks[i] !== ranks[i + 1] + 1) isStraight = false;
    }
    if (!isStraight && JSON.stringify(ranks) === "[14,5,4,3,2]") isStraight = true;

    let score = 0, name = "High Card";
    if (isStraight && isFlush) { score = 8; name = "Straight Flush"; }
    else if (vc[0] === 4) { score = 7; name = "Four of a Kind"; }
    else if (vc[0] === 3 && vc[1] === 2) { score = 6; name = "Full House"; }
    else if (isFlush) { score = 5; name = "Flush"; }
    else if (isStraight) { score = 4; name = "Straight"; }
    else if (vc[0] === 3) { score = 3; name = "Three of a Kind"; }
    else if (vc[0] === 2 && vc[1] === 2) { score = 2; name = "Two Pair"; }
    else if (vc[0] === 2) { score = 1; name = "Pair"; }

    const power = score * 1e10 + tiebreakerRanks.reduce((acc, v, i) => acc + (v.r * Math.pow(15, 4 - i)), 0);
    return { power, name };
};

const getBestHand = (hole, comm, variantId) => {
    if (!hole || hole.length === 0) return null;
    const combinations = (arr, k) => {
        const results = [];
        const f = (start, current) => {
            if (current.length === k) { results.push([...current]); return; }
            for (let i = start; i < arr.length; i++) {
                current.push(arr[i]); f(i + 1, current); current.pop();
            }
        };
        f(0, []); return results;
    };

    let best = { power: -1, name: "" };
    if (['OMAHA', 'HILOW', 'SUPEROMAHA', 'COURCHEVEL'].includes(variantId)) {
        if (hole.length < 2 || comm.length < 3) return null;
        const h2s = combinations(hole, 2);
        const c3s = combinations(comm, 3);
        h2s.forEach(h => {
            c3s.forEach(c => {
                const res = rankHand([...h, ...c]);
                if (res.power > best.power) best = res;
            });
        });
    } else {
        const full = [...hole, ...comm];
        if (full.length < 5) return null;
        const combos = combinations(full, 5);
        combos.forEach(c => {
            const res = rankHand(c);
            if (res.power > best.power) best = res;
        });
    }
    return best.name ? best : null;
};

// --- UI COMPONENTS ---

const CardSymbol = ({ suit }) => {
  const isRed = suit === '♥' || suit === '♦';
  return <span className={isRed ? 'text-red-500' : 'text-slate-950'}>{suit}</span>;
};

const UIOverlay = ({ children, isOpen, onClose, title, icon: Icon }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 p-4 font-black uppercase">
      <div className="w-full max-w-[550px] bg-slate-900 border border-white/10 rounded-[2rem] shadow-[0_0_100px_rgba(0,0,0,1)] p-6 flex flex-col gap-5 relative overflow-hidden ring-1 ring-white/5">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">{Icon && <Icon size={160} className="text-white" />}</div>
        <div className="flex justify-between items-center border-b border-white/10 pb-4 relative z-10">
          <h3 className="text-xl font-black text-[#fbbf24] tracking-widest flex items-center gap-3 uppercase">{Icon && <Icon size={24} />} {title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"><X size={24} /></button>
        </div>
        <div className="relative z-10 min-h-[100px] text-white/80 leading-relaxed font-black uppercase tracking-tight text-sm overflow-y-auto max-h-[70vh] pr-2">
          {children}
        </div>
      </div>
    </div>
  );
};

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  strengthLabel, potTransferring, timeRemaining, isHero, hiLowAwards, 
  cardScale, relativeIdx
}) => {
    if (!player || !displayPos) return null;
    const isShowdown = phase === PHASES.SHOWDOWN;
    const currentCardScale = isHero ? cardScale : 0.85;
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-700 ${player.isFolded ? 'opacity-30 grayscale scale-75' : 'opacity-100'}`}>
            {player.lastAction && !isShowdown && !player.isFolded && (
              <div className="absolute top-[-70px] animate-action-float text-cyan-400 font-black text-[10px] tracking-[0.2em] uppercase whitespace-nowrap drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">{player.lastAction}</div>
            )}
            
            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-1000 ${isCollectingBets ? 'animate-fling-to-pot' : 'opacity-100'}`} style={{ transform: `translate(calc(-50% + ${betOffset.x * 0.7}px), ${betOffset.y} * 0.7px)`, left: '50%', top: '50%', '--bx': `${-betOffset.x * 0.7}px`, '--by': `${-betOffset.y * 0.7 - 50}px` }}>
                    <div className="bg-gradient-to-b from-amber-200 via-amber-500 to-amber-800 text-black font-black text-[9px] md:text-[12px] px-3 py-1.5 rounded-full shadow-lg border-t border-white/60 flex items-center gap-1 whitespace-nowrap tracking-tighter uppercase">
                        <div className="w-4 h-4 rounded-full border border-black/20 bg-white/20 flex items-center justify-center shrink-0"><Coins size={10} fill="black" /></div>
                        {Number(player.currentBet).toLocaleString()}
                    </div>
                </div>
            )}

            <div className={`relative flex flex-col items-center p-1.5 rounded-[1.5rem] border-2 bg-gradient-to-br from-slate-800/95 to-slate-950 backdrop-blur-xl transition-all duration-500 min-w-[90px] md:min-w-[150px] shadow-2xl ${isActiveTurn ? 'border-cyan-400 ring-[8px] ring-cyan-400/10 scale-110' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 animate-winner-ring z-50' : ''}`}>
                {player.isDealer && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full border-2 border-slate-900 flex items-center justify-center font-black text-[10px] text-black shadow-xl">D</div>
                )}
                <div className="flex flex-col items-center w-full font-black">
                    <span className="text-[8px] md:text-[10px] font-black text-white/50 uppercase tracking-widest truncate w-full text-center px-2 mb-0.5">{String(player.name || "Anon")}</span>
                    <span className={`text-[12px] md:text-[16px] font-mono font-black tracking-tight ${player.chips === 0 ? 'text-red-500' : 'text-emerald-400'}`}>${Number(player.chips || 0).toLocaleString()}</span>
                </div>
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="absolute -bottom-1.5 w-[80%] h-1 bg-black/60 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-400" style={{ width: `${(timeRemaining / 30) * 100}%` }} />
                    </div>
                )}
            </div>

            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative flex items-center justify-center w-[10vw] h-[5vw] mt-2 overflow-visible translate-y-[35px] font-black">
                    {player.hand.map((c, ci) => (
                        <div key={c.id || ci} className={`w-[6vw] md:w-[3.5vw] h-[9vw] md:h-[5.5vw] rounded-lg flex flex-col items-start p-1 border-2 shadow-xl absolute transition-all duration-700 ${isShowdown || isHero ? 'bg-gradient-to-br from-white to-slate-100 text-slate-900' : 'bg-gradient-to-br from-slate-700 to-slate-900 border-white/10 text-transparent'} ${isShowdown && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-[4px] ring-yellow-400 scale-125 z-30 shadow-[0_0_40px_#fbbf24]' : ''} font-black`} style={{ transform: `translateX(${(ci - (player.hand.length - 1) / 2) * 22}px) rotate(${(ci - (player.hand.length - 1) / 2) * 8}deg) scale(${currentCardScale})`, transformOrigin: 'bottom center', zIndex: ci }}>
                            {(isShowdown || isHero) ? (
                                <div className="flex flex-col items-center w-full relative font-black leading-none">
                                  <span className="text-[10px] md:text-[14px] font-black tracking-tighter">{String(c.value)}</span>
                                  <div className="text-[12px] md:text-[18px] mt-0.5"><CardSymbol suit={c.suit} /></div>
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center opacity-10"><ShieldCheck className="text-white" size={16} /></div>
                            )}
                        </div>
                    ))}
                    {strengthLabel && !player.isFolded && (isHero || isShowdown) && phase !== PHASES.IDLE && (
                        <div className="absolute -bottom-16 z-[120] whitespace-nowrap bg-purple-600/90 px-3 py-1 rounded-full border border-purple-400 shadow-lg font-black">
                             <span className="text-[8px] md:text-[11px] font-black uppercase text-white tracking-widest">{String(strengthLabel)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const App = () => {
  const [user, setUser] = useState(null);
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
  const [highestBet, setHighestBet] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState(1000);
  const [isCollectingBets, setIsCollectingBets] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 5000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 10, bb: 20, minBuy: 400, maxBuy: 2000, pendingVariant: 'HOLDEM' });
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potAnimating, setPotAnimating] = useState(false);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [hiLowAwards, setHiLowAwards] = useState(null);
  
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState(null);
  const [editingChipsUid, setEditingChipsUid] = useState(null);
  const [editChipsVal, setEditChipsVal] = useState(0);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);

  const [headerHeight, setHeaderHeight] = useState(64); 
  const [footerHeight, setFooterHeight] = useState(window.innerWidth < 768 ? 170 : 250); 
  const [tableZoom, setTableZoom] = useState(window.innerWidth < 768 ? 0.7 : 1);
  const [heroCardScale, setHeroCardScale] = useState(window.innerWidth < 768 ? 1.2 : 1.4);
  const [showLayoutControls, setShowLayoutControls] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + (p?.currentBet || 0), 0);
    return potAmount + currentBetsSum;
  }, [potAmount, players]);

  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => p && p.uid === userProfile.uid);
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);

  const heroStrength = useMemo(() => {
    if (!heroPlayerObj || !heroPlayerObj.hand || heroPlayerObj.hand.length === 0 || heroPlayerObj.isFolded) return null;
    if (phase === PHASES.IDLE) return null;
    const res = getBestHand(heroPlayerObj.hand, community, activeVariant.id);
    return res ? res.name : null;
  }, [heroPlayerObj, community, activeVariant, phase]);

  const isBrokeStatus = useMemo(() => !!heroPlayerObj?.isBust, [heroPlayerObj]);
  const minRaiseAllowed = useMemo(() => Math.max(highestBet + 20, highestBet * 2), [highestBet]);

  // Handle Resize
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 768) {
        setTableZoom(0.7);
        setFooterHeight(180);
      } else {
        setTableZoom(1);
        setFooterHeight(250);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const refreshState = useCallback(() => {
    socket.emit('getInitialData');
  }, []);

  const handleAction = useCallback((type, amt = 0) => {
      if (!currentRoomId) return;
      socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(amt || raiseInput) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleLogin = useCallback(() => { 
      if (passwordInput === 'pass') { 
          refreshState();
          setUserProfile({ name: 'SUPER ADMIN', uid: 'admin_1', isAdmin: true }); 
          setCurrentView(VIEWS.ADMIN); 
      } 
      else { socket.emit('playerLogin', { password: passwordInput }); }
  }, [passwordInput, refreshState]);

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile) return;
    socket.emit('joinRoom', { roomId: selectedTableForJoin.id, profile: { ...userProfile, pendingVariant: pendingVariantId }, buyIn: buyInAmount }, (res) => {
        if (res?.status === 'ok') { setCurrentRoomId(selectedTableForJoin.id); setCurrentView(VIEWS.GAME); setSelectedTableForJoin(null); }
    });
  }, [selectedTableForJoin, userProfile, pendingVariantId, buyInAmount]);

  const handleSpawnArena = useCallback(() => {
    if (!newTable.name) return;
    const id = 'room_' + Math.random().toString(36).slice(2, 9);
    socket.emit('adminCreateRoom', { ...newTable, id });
    setNewTable({ name: '', sb: 10, bb: 20, minBuy: 400, maxBuy: 2000, pendingVariant: 'HOLDEM' });
  }, [newTable]);

  const handleNuclear = useCallback(() => {
      if (!nuclearConfirm) { setNuclearConfirm(true); setTimeout(() => setNuclearConfirm(false), 3000); return; }
      socket.emit('adminNuclearReset');
      setNuclearConfirm(false);
  }, [nuclearConfirm]);

  useEffect(() => {
    socket.on('roomUpdate', (d) => {
        if (!d) { setPlayers(INITIAL_PLAYERS); setPhase(PHASES.IDLE); setPotAmount(0); setCommunity([]); return; }
        if (d.id) setCurrentRoomId(d.id);
        const nextPotAmt = Number(d.potData?.[0]?.amount || 0);
        const potIncreased = (nextPotAmt > potAmount);
        
        if (d.phase !== phase && phase !== PHASES.IDLE) {
            setIsCollectingBets(true);
            setTimeout(() => { 
                setIsCollectingBets(false); 
                if (potIncreased) setPotAnimating(true); 
            }, 1200);
            setTimeout(() => setPotAnimating(false), 2200);
        } else if (potIncreased) { 
            setPotAnimating(true); 
            setTimeout(() => setPotAnimating(false), 800); 
        }

        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true); 
            setShowdownWinners(d.showdownWinners || null); 
            setHiLowAwards(d.hiLowAwards || null);
            setTimeout(() => { setPotTransferring(false); setShowdownWinners(null); }, 7500);
        }

        setPlayers(() => { 
            const next = [...INITIAL_PLAYERS]; 
            (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
            return next; 
        });

        setPhase(d.phase); 
        setCommunity(d.community || []); 
        setActiveVariant(d.activeVariant || VARIANTS.HOLDEM);
        setHighestBet(Number(d.highestBet) || 0); 
        setActiveIdx(d.activeIdx ?? -1); 
        setWinning5Ids(d.winning5Ids || []);
        setPotAmount(nextPotAmt); 
        setTimeRemaining(Number(d.timeRemaining) || 30);

        if (d.activeIdx !== -1 && d.players?.[d.activeIdx]?.uid === userProfile?.uid) {
            const minR = Math.max(Number(d.highestBet) + 20, Number(d.highestBet) * 2);
            setRaiseInput(p => p < minR ? minR : p);
        }
    });

    socket.on('lobbyUpdate', (list) => setActiveTables(list || []));
    socket.on('profilesUpdate', (list) => setAllProfiles(list || []));
    socket.on('initialDataResponse', (d) => { setAllProfiles(d.profiles || []); setActiveTables(d.rooms || []); });
    socket.on('loginSuccess', (p) => { 
        setUserProfile(p); 
        setPendingVariantId(p.pendingVariant || 'HOLDEM'); 
        setCurrentView(VIEWS.LOBBY); 
        socket.emit('getInitialData'); 
    });
    socket.on('log', (d) => { 
        setLogs(prev => [{ id: Math.random(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), ...d }, ...prev].slice(0, 50)); 
    });

    return () => { 
        socket.off('roomUpdate'); 
        socket.off('lobbyUpdate'); 
        socket.off('profilesUpdate'); 
        socket.off('loginSuccess'); 
        socket.off('log'); 
    };
  }, [phase, potAmount, userProfile]);

  useEffect(() => {
    if (currentView === VIEWS.ADMIN) refreshState();
  }, [currentView, refreshState]);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white font-black uppercase tracking-tighter">
        <div className="w-full max-w-[420px] p-8 md:p-14 bg-slate-900/60 border border-white/10 rounded-[3rem] backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-10 ring-1 ring-white/5 relative overflow-hidden">
            <div className="p-6 bg-white/5 rounded-full ring-2 ring-white/10 shadow-inner relative"><Lock size={36} className="text-[#fbbf24] animate-pulse-fast" /></div>
            <div className="w-full space-y-6 relative z-10">
                <div className="text-center space-y-1"><h2 className="text-2xl md:text-3xl font-black tracking-[0.2em] text-white">ELITE ARENA</h2><p className="text-[9px] text-white/30 tracking-[0.5em] font-black uppercase">SYSTEM ACCESS REQUIRED</p></div>
                <div className="space-y-3">
                  <label className="text-[10px] text-white/40 block ml-2 tracking-widest font-black uppercase">AUTHENTICATION PASSCODE</label>
                  <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-black/40 border border-white/10 p-5 rounded-[1.2rem] text-center tracking-[0.6em] text-[#fbbf24] outline-none text-xl font-black focus:border-[#fbbf24]/50 transition-all shadow-inner uppercase"/>
                </div>
            </div>
            <button onClick={handleLogin} className="w-full p-5 bg-gradient-to-r from-amber-400 to-amber-600 text-black rounded-[1.2rem] hover:scale-[1.03] active:scale-95 font-black text-lg transition-all shadow-xl uppercase relative z-10">INITIATE SESSION</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white font-black uppercase overflow-hidden">
        <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-white/10 p-4 md:p-10 flex flex-row md:flex-col gap-4 bg-black/40 shrink-0 relative">
            <h2 className="text-[#fbbf24] tracking-widest hidden md:flex items-center gap-3 mb-6 font-black text-xl uppercase"><ShieldCheck size={28}/> COMMAND</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-3 rounded-xl text-xs md:text-sm transition-all font-black flex items-center justify-center md:justify-start gap-3 ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5 text-white/30'}`}><Users size={16}/> PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-3 rounded-xl text-xs md:text-sm transition-all font-black flex items-center justify-center md:justify-start gap-3 ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5 text-white/30'}`}><Cpu size={16}/> TABLES</button>
            <div className="hidden md:flex flex-col mt-auto gap-3">
              <button onClick={handleNuclear} className={`w-full p-4 rounded-xl items-center justify-center gap-3 border-2 transition-all font-black flex ${nuclearConfirm ? 'bg-red-600 border-white text-white animate-pulse' : 'bg-red-950/20 border-red-500/50 text-red-500 hover:bg-red-500'}`}>{nuclearConfirm ? <Bomb size={24}/> : <ShieldAlert size={24}/>}<span>{nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</span></button>
              <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/20 hover:text-white text-xs flex items-center justify-center gap-2 font-black transition-all uppercase"><ArrowLeft size={16}/> RETURN</button>
            </div>
        </aside>
        <main className="flex-1 p-4 md:p-16 overflow-y-auto bg-[#080a0f] relative font-black uppercase">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8 animate-in fade-in duration-500">
                    <h3 className="text-xl md:text-3xl tracking-[0.2em] border-l-4 border-[#fbbf24] pl-4 font-black uppercase">REGISTRY CONTROL</h3>
                    <div className="bg-slate-900/50 p-6 rounded-[1.5rem] grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/5 shadow-2xl">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="PLAYER NAME" className="w-full bg-black/60 p-4 rounded-xl border border-white/5 outline-none focus:border-[#fbbf24] font-black uppercase shadow-inner"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASSCODE" className="w-full bg-black/60 p-4 rounded-xl border border-white/5 outline-none focus:border-[#fbbf24] font-black uppercase shadow-inner"/>
                        <button onClick={()=>socket.emit('adminCreatePlayer', {...newPlayer, uid: Math.random().toString(36).slice(2)})} className="w-full h-[56px] bg-[#fbbf24] text-black rounded-xl font-black p-4 transition-all uppercase hover:brightness-110">COMMIT</button>
                    </div>
                    <div className="bg-slate-900/40 rounded-[1.5rem] overflow-hidden border border-white/5 shadow-2xl">
                        {(allProfiles || []).map((p, idx) => (
                            <div key={p.uid} className={`flex justify-between items-center p-4 md:p-6 hover:bg-white/5 transition-all group ${idx !== (allProfiles?.length || 0) -1 ? 'border-b border-white/5' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 transition-all"><User size={20} className="text-white/20" /></div>
                                    <div className="flex flex-col"><span className="uppercase text-sm md:text-lg font-black">{String(p.name)}</span><span className="text-white/20 text-[8px] tracking-widest font-black uppercase">ID: {String(p.password)}</span></div>
                                </div>
                                <div className="flex gap-4 items-center">
                                    {editingChipsUid === p.uid ? (
                                      <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl">
                                        <input type="number" value={editChipsVal} onChange={e=>setEditChipsVal(Number(e.target.value))} className="w-20 bg-transparent text-emerald-400 font-mono text-right outline-none font-black text-xs" />
                                        <button onClick={()=>{socket.emit('adminEditChips', {uid: p.uid, chips: editChipsVal}); setEditingChipsUid(null);}} className="text-emerald-500"><CheckCircle2 size={20}/></button>
                                        <button onClick={()=>setEditingChipsUid(null)} className="text-red-500"><X size={20}/></button>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-end">
                                        <span className="text-[9px] text-emerald-500/40 font-black tracking-widest uppercase">BALANCE</span>
                                        <span className="text-emerald-400 font-mono text-base md:text-xl font-black">${Number(p.chips || 0).toLocaleString()}</span>
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <button onClick={()=>{setEditingChipsUid(p.uid); setEditChipsVal(p.chips);}} className="p-2.5 bg-white/5 rounded-lg text-cyan-400 hover:bg-cyan-400/20"><Edit3 size={16}/></button>
                                      {confirmDeletePlayer === p.uid ? (
                                        <div className="flex gap-1 animate-in slide-in-from-right">
                                          <button onClick={()=>{socket.emit('adminDeletePlayer', p.uid); setConfirmDeletePlayer(null);}} className="bg-red-600 text-white p-2.5 rounded-lg"><Trash2 size={16}/></button>
                                          <button onClick={()=>setConfirmDeletePlayer(null)} className="bg-white/5 text-white/40 p-2.5 rounded-lg"><X size={16}/></button>
                                        </div>
                                      ) : (
                                        <button onClick={()=>setConfirmDeletePlayer(p.uid)} className="p-2.5 bg-white/5 rounded-lg text-red-500"><Trash2 size={16}/></button>
                                      )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8 animate-in fade-in duration-500 font-black uppercase">
                    <h3 className="text-xl md:text-3xl tracking-[0.2em] border-l-4 border-emerald-500 pl-4 font-black uppercase">ARENA DEPLOYMENT</h3>
                    <div className="bg-slate-900/50 p-6 rounded-[1.5rem] border border-white/5 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-4 relative overflow-hidden">
                        <div className="col-span-full space-y-2"><label className="text-[9px] text-white/40 tracking-widest pl-2 uppercase font-black">INSTANCE IDENTIFIER</label><input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="w-full bg-black/60 p-4 rounded-xl border border-white/5 outline-none focus:border-emerald-500/50 font-black uppercase shadow-inner"/></div>
                        <div className="grid grid-cols-4 gap-3">
                            <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase tracking-widest">SB</span><input value={newTable.sb} type="number" className="w-full bg-black/60 p-3 rounded-lg border border-white/5 font-black outline-none text-center" onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase tracking-widest">BB</span><input value={newTable.bb} type="number" className="w-full bg-black/60 p-3 rounded-lg border border-white/5 font-black outline-none text-center" onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase tracking-widest">MIN</span><input value={newTable.minBuy} type="number" className="w-full bg-black/60 p-3 rounded-lg border border-white/5 font-black outline-none text-center" onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase tracking-widest">MAX</span><input value={newTable.maxBuy} type="number" className="w-full bg-black/60 p-3 rounded-lg border border-white/5 font-black outline-none text-center" onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})}/></div>
                        </div>
                        <button onClick={handleSpawnArena} className="col-span-full bg-emerald-600 rounded-xl font-black p-4 uppercase transition-all shadow-xl hover:brightness-110">INITIALIZE ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {(activeTables || []).map(t => (
                            <div key={t.id} className="bg-slate-900/40 p-4 rounded-2xl flex justify-between items-center border border-white/5 hover:border-emerald-500/40 transition-all shadow-xl font-black uppercase">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-emerald-500/5 rounded-xl flex items-center justify-center border border-emerald-500/20"><LayoutGrid size={20} className="text-emerald-500/40" /></div>
                                  <div className="flex flex-col"><h4 className="text-[#fbbf24] text-base font-black uppercase tracking-tighter truncate max-w-[120px]">{String(t.name)}</h4><p className="text-[8px] text-white/30 tracking-[0.2em] uppercase font-black font-mono">STAKES: ${t.sb}/${t.bb}</p></div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col items-end"><span className="text-[8px] text-white/20 font-black uppercase mb-0.5">CAPACITY</span><span className="text-white/60 font-black text-sm">{t.players?.filter(Boolean).length || 0}<span className="text-white/20">/10</span></span></div>
                                    {confirmDeleteId === t.id ? (
                                      <div className="flex gap-1 animate-in slide-in-from-right">
                                        <button onClick={()=>{socket.emit('adminDeleteRoom', t.id); setConfirmDeleteId(null);}} className="bg-red-600 text-white p-2.5 rounded-lg font-black text-[9px]">YES</button>
                                        <button onClick={()=>setConfirmDeleteId(null)} className="bg-white/5 text-white/40 p-2.5 rounded-lg font-black text-[9px]">NO</button>
                                      </div>
                                    ) : (
                                      <button onClick={()=>setConfirmDeleteId(t.id)} className="p-2.5 bg-red-950/20 border border-red-500/20 rounded-lg text-red-500"><Trash2 size={16}/></button>
                                    )}
                                </div>
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
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-in fade-in duration-500 px-4">
                <div className="w-full max-w-[420px] p-8 md:p-14 bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,1)] flex flex-col gap-8 ring-1 ring-white/5">
                    <div className="space-y-1 text-center font-black uppercase"><h3 className="text-2xl md:text-4xl text-[#fbbf24] tracking-tighter uppercase font-black leading-tight italic">{String(selectedTableForJoin.name)}</h3><div className="h-0.5 w-16 bg-emerald-500 mx-auto rounded-full" /></div>
                    <div className="space-y-6 font-black text-center uppercase p-5 bg-black/40 rounded-[1.5rem] border border-white/5 shadow-inner">
                        <div className="flex justify-between items-center text-[9px] text-white/40 tracking-widest font-black uppercase border-b border-white/5 pb-3"><span>BUY-IN AMOUNT</span><span className="text-emerald-400 text-xl md:text-3xl font-mono tracking-tighter">${buyInAmount.toLocaleString()}</span></div>
                        <input type="range" min={selectedTableForJoin.minBuy || 400} max={selectedTableForJoin.maxBuy || 2000} step={100} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#fbbf24] shadow-xl" />
                    </div>
                    <div className="flex gap-4"><button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black uppercase tracking-widest text-[10px]">BACK</button><button onClick={joinRoom} className="flex-[2] p-4 bg-emerald-600 rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all text-xs tracking-widest font-black uppercase">SIT DOWN</button></div>
                </div>
            </div>
        )}
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 md:px-12 bg-[#0a0c12]/80 backdrop-blur-xl shadow-2xl z-50 shrink-0">
            <div className="flex items-center gap-4"><div className="w-10 h-10 bg-[#fbbf24]/10 rounded-xl flex items-center justify-center border border-[#fbbf24]/30"><Crown className="text-[#fbbf24]" size={22}/></div><h2 className="tracking-[0.2em] text-sm md:text-xl font-black uppercase">ARENA LOBBY</h2></div>
            <div className="flex items-center gap-6"><div className="flex flex-col items-end uppercase group"><span className="text-[8px] text-white/20 uppercase tracking-[0.2em] font-black mb-0.5">ID: {String(userProfile?.name || "??")}</span><span className="text-emerald-400 font-mono text-xl md:text-3xl tracking-tighter">${Number(userProfile?.chips || 0).toLocaleString()}</span></div><button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="p-2.5 bg-white/5 rounded-xl text-white/20 hover:text-red-500 transition-all border border-white/5 font-black uppercase"><LogOut size={22}/></button></div>
        </header>
        <main className="flex-1 p-6 md:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 overflow-y-auto bg-gradient-to-br from-[#06080c] via-[#080a12] to-[#0d111a] font-black uppercase">
            {(activeTables || []).map((t) => (
                <div key={t.id} className="group p-8 bg-slate-900/40 border border-white/5 rounded-[2.5rem] flex flex-col gap-6 shadow-2xl hover:border-[#fbbf24]/30 hover:bg-slate-900/60 transition-all relative overflow-hidden">
                    <div className="flex justify-between items-start relative z-10"><div className="space-y-1"><h3 className="text-xl md:text-3xl tracking-tighter text-white font-black group-hover:text-[#fbbf24] transition-colors uppercase italic">{String(t.name)}</h3><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /><span className="text-[8px] text-white/30 tracking-widest uppercase font-black">ACTIVE</span></div></div></div>
                    <div className="bg-black/40 p-5 rounded-[1.5rem] flex justify-between items-center border border-white/5 shadow-inner relative z-10"><div className="flex flex-col gap-1"><span className="text-[8px] text-white/20 tracking-widest font-black uppercase">STAKES</span><span className="text-[#fbbf24] text-lg font-black">${t.sb}/${t.bb}</span></div><div className="flex flex-col items-end gap-1"><span className="text-[8px] text-white/20 tracking-widest font-black uppercase">SEATS</span><span className="text-white/80 font-mono text-base font-black tracking-tighter">{t.players?.filter(p=>p).length || 0}<span className="text-white/20">/10</span></span></div></div>
                    <button onClick={()=>setSelectedTableForJoin(t)} className="w-full p-5 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl tracking-[0.2em] shadow-lg transition-all font-black uppercase text-xs">ENTER ARENA</button>
                </div>
            ))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter font-executive">
      <UIOverlay isOpen={showRules} onClose={() => setShowRules(false)} title="ARENA PROTOCOL" icon={BookOpen}>
        <div className="space-y-4 font-black uppercase"><div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner font-black uppercase"><div className="text-[#fbbf24] text-[9px] tracking-[0.3em] mb-2 font-black uppercase">VARIANT: {activeVariant.name}</div><div className="text-sm leading-relaxed text-white/90 font-black italic tracking-wide">{VARIANT_RULES[activeVariant.id] || "Rules coming soon..."}</div></div></div>
      </UIOverlay>

      {/* HEADER */}
      <header style={{ height: `${headerHeight}px` }} className="bg-[#0a0a0a]/90 border-b border-white/10 flex items-center justify-between px-4 md:px-10 z-[80] shadow-2xl backdrop-blur-3xl shrink-0 font-black uppercase">
        <div className="flex items-center gap-2">
            <button onClick={() => setShowRules(true)} className="bg-white/5 px-3 py-2 rounded-xl border border-white/10 flex items-center gap-2 font-black active:scale-95"><Info size={14} className="text-[#fbbf24]" /><span className="text-white text-[9px] font-black underline decoration-dashed decoration-[#fbbf24]/40">{String(activeVariant.name)}</span></button>
            <button onClick={() => setShowLayoutControls(!showLayoutControls)} className={`p-2 rounded-lg transition-all ${showLayoutControls ? 'bg-[#fbbf24] text-black shadow-xl' : 'bg-white/5 text-white/30'}`}><Sliders size={18}/></button>
            <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-white/5 ml-2">
                <Clock size={14} className="text-cyan-400" />
                <span className={`text-[12px] font-mono font-black ${timeRemaining <= 10 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>0:{String(timeRemaining).padStart(2, '0')}</span>
            </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex bg-white/5 border border-white/10 px-4 py-2 rounded-xl items-center gap-3 font-black uppercase"><span className="text-white/30 text-[9px] tracking-[0.2em] font-black uppercase">DEALER CHOICE:</span><select value={pendingVariantId} onChange={(e) => {setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value})}} className="bg-transparent text-[#fbbf24] outline-none text-[10px] font-black uppercase cursor-pointer uppercase">{Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900 font-black uppercase">{v.name.toUpperCase()}</option>)}</select></div>
          <div className="flex gap-2"><button onClick={()=>socket.emit('adminAddBot', {roomId: currentRoomId})} className="text-indigo-400 p-2 bg-white/5 border border-white/10 rounded-xl font-black uppercase hover:bg-indigo-400 active:scale-90"><Bot size={18}/></button><button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2 bg-white/5 border border-white/10 rounded-xl font-black uppercase hover:bg-red-500 active:scale-90"><LogOut size={18}/></button></div>
        </div>
      </header>

      {/* TABLE */}
      <main className="flex-1 flex flex-col items-center justify-center relative bg-[#010a08] overflow-hidden">
        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 40}px)` }} className="relative w-full max-w-[1450px] aspect-[21/10] flex items-center justify-center h-full transition-all duration-700 ease-out origin-center">
            <div className="absolute inset-0 bg-[#121212] rounded-[50%] border-[2.8vw] border-[#1a110a] shadow-[0_40px_100px_rgba(0,0,0,1)] ring-[1px] ring-white/10 font-black" />
            <div className="absolute inset-[3.2vw] bg-[#0c3125] rounded-[50%] shadow-[inset_0_0_80px_rgba(0,0,0,0.9)] overflow-hidden"><div className="absolute inset-0 bg-felt-texture opacity-20 font-black" /></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"><span className="text-[13vw] font-black text-white/5 italic uppercase select-none rotate-[-6deg] font-black">{activeVariant.name}</span></div>
            <div className="absolute inset-0 pointer-events-none z-20 font-black uppercase">{(players || []).map((p, i) => { if (!p) return null; const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; return (<Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} strengthLabel={i === heroIdx ? heroStrength : p.strength} isCollectingBets={isCollectingBets} timeRemaining={timeRemaining} isHero={i === heroIdx} hiLowAwards={hiLowAwards} cardScale={heroCardScale} relativeIdx={rIdx} />); })}</div>
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center">{!potTransferring && (<div className={`flex flex-col items-center transition-all duration-700 ${potAnimating ? 'scale-110' : 'scale-100'}`}><div className={`text-[6.5vw] md:text-[5.5vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-2xl ${potAnimating ? 'animate-pot-pulse' : ''}`}>${Number(totalDisplayPot || 0).toLocaleString()}</div><div className="h-2.5 w-32 bg-white/5 rounded-full mt-2 overflow-hidden border border-white/5"><div className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 animate-shimmer rounded-full" style={{ width: '100%' }} /></div></div>)}<div className="flex gap-2 md:gap-5 scale-[1.1] md:scale-[1.85] mt-6 md:mt-12 font-black uppercase">{(community || []).map((c, j) => (<div key={c.id || j} className={`w-[6vw] md:w-[3.6vw] h-[9vw] md:h-[5.6vw] rounded-xl border-2 bg-gradient-to-tr from-white to-slate-200 flex flex-col items-center justify-center text-slate-900 font-black transition-all duration-700 shadow-2xl ${winning5Ids?.includes(c.id) ? 'ring-[5px] ring-yellow-400 scale-110' : 'border-white/10'}`}><span className="text-[11px] md:text-[15px] font-black tracking-tighter">{String(c.value)}</span><span className="text-[16px] md:text-[22px] mt-1"><CardSymbol suit={c.suit} /></span></div>))}</div></div>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ height: `${footerHeight}px` }} className="bg-[#080a12]/95 backdrop-blur-3xl border-t border-white/10 flex flex-col lg:flex-row z-[100] shadow-2xl shrink-0 font-black uppercase overflow-hidden">
        <div className="hidden lg:flex w-[32%] border-r border-white/10 p-5 flex-col overflow-hidden text-[10px] font-mono tracking-[0.2em] font-black uppercase"><div className="text-white/40 mb-3 flex items-center justify-between border-b border-white/5 pb-3 px-2 font-black uppercase"><div className="flex items-center gap-3"><Eye size={16} className="text-[#fbbf24]"/> ACTIVITY</div></div><div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide font-black">{(logs || []).map(l => (<div key={l.id} className="animate-in slide-in-from-left duration-300 flex items-center gap-4 border-l-2 border-white/5 pl-4 py-2 hover:bg-white/5 transition-all border-b border-white/5 font-black uppercase"><span className="text-white/10 text-[8px] font-black shrink-0 w-12 font-mono">{String(l.time)}</span><div className="flex items-center gap-x-3 font-black uppercase"><span className={`font-black uppercase text-[10px] px-2 py-1 rounded-md ${l.type === 'win' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-[#fbbf24]'} font-black`}>{String(l.name)}</span><span className="text-white/50 lowercase tracking-tight text-[10px] font-black truncate max-w-[150px]">{String(l.action)}</span></div></div>))}</div></div>
        
        <div className="flex-1 flex flex-col justify-between relative py-3 px-4 md:px-12 font-black uppercase">
          {activeIdx === heroIdx && phase !== PHASES.SHOWDOWN && phase !== PHASES.IDLE && heroPlayerObj ? (
            <div className="flex flex-col h-full justify-between animate-in slide-in-from-bottom-4 duration-500 font-black">
               <div className="flex items-center justify-between bg-slate-900/60 rounded-[1.5rem] p-2 border border-white/10 font-black shadow-2xl">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-600/10 rounded-xl flex items-center justify-center font-black border border-purple-500/30"><Activity size={20} className="text-purple-400" /></div><div className="flex flex-col"><span className="text-[8px] text-white/30 tracking-widest font-black uppercase">STRENGTH</span><span className="text-sm font-black italic">{String(heroStrength || "...")}</span></div></div>
                  <div className="flex flex-col items-end"><span className="text-[8px] text-white/30 tracking-widest font-black uppercase">EQUITY</span><div className="flex items-center gap-3 font-black"><div className="w-20 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10 font-black shadow-inner"><div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000 font-black shadow-[0_0_10px_cyan]" style={{ width: `${heroPlayerObj.winProbability || 0}%` }} /></div><span className="text-lg text-cyan-400 font-mono font-black">{Math.round(heroPlayerObj.winProbability || 0)}%</span></div></div>
               </div>

               <div className="grid grid-cols-12 gap-3 h-16 md:h-24 font-black uppercase">
                  <button onClick={()=>handleAction('FOLD')} className="col-span-3 bg-red-950/20 border-2 border-red-500/30 rounded-2xl flex flex-col items-center justify-center font-black uppercase hover:bg-red-600 active:scale-95"><X size={20} className="text-red-500" /><span className="text-[10px] font-black text-red-500 uppercase">FOLD</span></button>
                  <button onClick={()=>handleAction('CALL')} className="col-span-5 bg-gradient-to-b from-indigo-500 to-indigo-700 border-2 border-indigo-400 rounded-2xl flex flex-col items-center justify-center font-black uppercase shadow-xl active:scale-95"><span className="text-lg md:text-3xl font-black italic uppercase leading-none">{highestBet > heroPlayerObj.currentBet ? 'CALL' : 'CHECK'}</span><span className="text-[9px] font-mono opacity-60 font-black">{highestBet > heroPlayerObj.currentBet ? `$${(highestBet - heroPlayerObj.currentBet).toLocaleString()}` : 'SYNC'}</span></button>
                  <div className="col-span-4 bg-slate-900/60 border-2 border-emerald-500/30 rounded-2xl flex flex-col overflow-hidden font-black shadow-xl"><div className="flex-1 flex items-center justify-center px-2 font-black"><span className="text-emerald-500 text-base mr-1 font-black italic uppercase">$</span><input type="number" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(heroPlayerObj.chips + heroPlayerObj.currentBet, Math.max(minRaiseAllowed, Number(e.target.value))))} className="w-full bg-transparent text-center font-mono text-lg text-white outline-none font-black uppercase" /></div><button onClick={()=>handleAction('RAISE', raiseInput)} className="h-8 bg-emerald-600 flex items-center justify-center hover:bg-emerald-500 font-black uppercase"><Zap size={14} className="text-white mr-2"/><span className="text-[9px] font-black uppercase">RAISE</span></button></div>
               </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase">
               <span className="text-white/20 text-[8px] tracking-[0.3em] font-black uppercase mb-1">WAITING FOR ACTION</span>
               <span className="text-2xl md:text-5xl font-black text-white tracking-widest uppercase italic font-black">{players[activeIdx]?.name || "SYSTEM"}</span>
               <div className="flex gap-2 mt-4">
                  {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.25}s` }} />)}
                </div>
            </div>
          )}
        </div>
      </footer>
      <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700;900&display=swap');
          .font-executive { font-family: 'Noto Sans', sans-serif; }
          @keyframes action-float { 0% { transform: translateY(0); opacity: 0; } 20% { transform: translateY(-10px); opacity: 1; } 80% { transform: translateY(-20px); opacity: 1; } 100% { transform: translateY(-30px); opacity: 0; } }
          .animate-action-float { animation: action-float 2.5s ease-out forwards; }
          @keyframes fling-to-pot { 0% { transform: translate(0, 0) scale(1.2); opacity: 1; } 100% { transform: translate(var(--bx), var(--by)) scale(0.1); opacity: 0; } }
          @keyframes pot-pulse { 0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } 50% { transform: scale(1.05); filter: drop-shadow(0 0 50px #fbbf24); } }
          .animate-pot-pulse { animation: pot-pulse 1.4s ease-in-out infinite; }
          .animate-winner-ring { animation: winner-ring 2.5s infinite; }
          @keyframes winner-ring { 0%, 100% { box-shadow: 0 0 0px #fbbf24; border-color: #fbbf24; } 50% { box-shadow: 0 0 60px #fbbf24; border-color: white; } }
          .animate-pulse-fast { animation: pulse 1s infinite; }
          @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.6; } }
          .bg-felt-texture { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E"); }
          .animate-shimmer { background: linear-gradient(90deg, transparent, rgba(251,191,36,0.5), transparent); background-size: 200% 100%; animation: shimmer 2.5s infinite linear; }
          @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
