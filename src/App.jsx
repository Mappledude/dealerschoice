
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare, Clock, BarChart3, BookOpen, Activity, Percent, Flame, Target as TargetIcon
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
  { x: 50, y: 92 }, { x: 15, y: 82 }, { x: 6,  y: 45 }, { x: 12, y: 12 }, { x: 30, y: 3  },
  { x: 50, y: 1  }, { x: 70, y: 3  }, { x: 88, y: 12 }, { x: 94, y: 45 }, { x: 85, y: 82 }
];

const BET_OFFSETS = [
  { x: 0, y: -160 },   { x: 100, y: -110 }, { x: 130, y: 0 },    { x: 100, y: 110 },  { x: 60, y: 130 },   
  { x: 0, y: 150 },    { x: -60, y: 130 },  { x: -100, y: 110 }, { x: -130, y: 0 },   { x: -100, y: -110 } 
];

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em' }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA' }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple' }, 
  MUFLIS: { id: 'Muflis', name: 'Muflis' },
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

const CardSymbol = ({ suit }) => {
  const isRed = suit === '♥' || suit === '♦';
  return (
    <span className={isRed ? 'text-red-600' : 'text-slate-900'}>
      {suit}
    </span>
  );
};

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  strengthLabel, potTransferring, timeRemaining, isHero, hiLowAwards, 
  cardScale, relativeIdx
}) => {
    if (!player || !displayPos) return null;
    const isShowdown = phase === PHASES.SHOWDOWN;
    const currentCardScale = isHero ? cardScale : 1.0;
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };

    const highAward = hiLowAwards?.high?.find(a => a.i === player.seatIdx);
    const lowAward = hiLowAwards?.low?.find(a => a.i === player.seatIdx);

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-700 ${player.isFolded ? 'opacity-30 grayscale scale-95 blur-[0.5px]' : 'opacity-100'}`}>
            
            {(isHero || isShowdown) && !player.isFolded && player.winProbability !== undefined && phase !== PHASES.IDLE && (
              <div className="absolute top-[-55px] flex flex-col items-center gap-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-3 py-0.5 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                  <Flame size={12} className={player.winProbability > 70 ? 'text-orange-500 animate-pulse' : 'text-slate-400'} />
                  <span className="text-[10px] font-black text-white font-mono">{Math.round(player.winProbability)}%</span>
                </div>
              </div>
            )}

            {player.lastAction && !isActiveTurn && !isCollectingBets && (
              <div className="absolute top-[-30px] animate-bounce-short z-[200]">
                <span className={`text-[8px] font-black px-2 py-0.5 rounded shadow-lg uppercase border border-white/20 ${
                  player.lastAction === 'FOLD' ? 'bg-red-600 text-white' : 
                  player.lastAction === 'RAISE' ? 'bg-amber-500 text-black' : 
                  'bg-blue-600 text-white'
                }`}>
                  {player.lastAction}
                </span>
              </div>
            )}

            {isShowdown && potTransferring && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-20 flex flex-col gap-1 items-center z-[500]">
                    {highAward && <span className="bg-emerald-600 text-white text-[8px] md:text-[10px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-lg whitespace-nowrap uppercase">HIGH WINNER (+${highAward.amount.toLocaleString()})</span>}
                    {lowAward && <span className="bg-orange-600 text-white text-[8px] md:text-[10px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-lg whitespace-nowrap uppercase">LOW WINNER (+${lowAward.amount.toLocaleString()})</span>}
                </div>
            )}

            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-700 ${isCollectingBets ? 'animate-fling-to-pot opacity-0' : 'opacity-100'}`}
                    style={{ transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y}px)`, left: '50%', top: '50%' }}>
                    <div className="bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-black font-black text-[10px] md:text-[13px] px-4 py-1 rounded-full shadow-[0_8px_20px_rgba(0,0,0,0.8)] border-t border-white/40 flex items-center gap-1.5 whitespace-nowrap tracking-tighter">
                        <Coins size={12} fill="black" />
                        ${String(player.currentBet.toLocaleString())}
                    </div>
                </div>
            )}

            <div className={`relative flex flex-col items-center p-1.5 rounded-2xl border-2 bg-slate-900/95 backdrop-blur-md transition-all duration-300 min-w-[100px] md:min-w-[150px] shadow-2xl ${isActiveTurn ? 'border-cyan-400 ring-4 ring-cyan-400/40 scale-105 shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 animate-pulse-glow' : ''}`}>
                {player.isDealer && (
                    <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center z-30">
                        <div className="w-4 h-4 bg-red-600 rounded-full border-2 border-white shadow-[0_0_10px_rgba(220,38,38,0.8)] animate-pulse" />
                    </div>
                )}
                <div className="flex flex-col items-center gap-0.5 w-full">
                    <span className="text-[10px] md:text-[12px] font-black text-white/90 uppercase tracking-tight truncate w-full text-center px-2">{String(player.name || "Anon")}</span>
                    <span className={`text-[11px] md:text-[14px] font-mono font-black ${player.chips === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                        ${Number(player.chips || 0).toLocaleString()}
                    </span>
                    {isActiveTurn && <span className="text-[7px] text-cyan-400 font-black animate-pulse tracking-widest mt-0.5">THINKING...</span>}
                </div>
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="absolute -bottom-2 w-full px-2 h-1.5">
                        <div className="w-full h-full bg-black/40 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-cyan-400 transition-all duration-1000 linear" style={{ width: `${(timeRemaining / 30) * 100}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible translate-y-[55px]">
                    {player.hand.map((c, ci) => (
                        <div key={c.id || ci} className={`w-[6vw] md:w-[3vw] h-[9vw] md:h-[5vw] rounded-[4px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-300 ${isShowdown || isHero ? 'bg-white text-black' : 'bg-slate-800'} ${isShowdown && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_20px_#fbbf24]' : 'border-white/20'}`} style={{ transform: `translateX(${(ci - (player.hand.length - 1) / 2) * 20}px) rotate(${(ci - (player.hand.length - 1) / 2) * 8}deg) scale(${1.4 * currentCardScale})`, transformOrigin: 'bottom center' }}>
                            {(isShowdown || isHero) && (
                                <><span className="text-[10px] md:text-[12px] font-black leading-none">{String(c.value)}</span><span className={`text-[12px] md:text-[16px] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></>
                            )}
                            {!(isShowdown || isHero) && ( <div className="w-full h-full flex items-center justify-center opacity-20"><ShieldCheck size={14}/></div> )}
                        </div>
                    ))}
                    
                    {strengthLabel && !player.isFolded && (isHero || isShowdown) && phase !== PHASES.IDLE && (
                        <div className="absolute -bottom-12 z-[120] whitespace-nowrap bg-purple-600/90 backdrop-blur-md px-3 py-1 rounded-full border border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-in fade-in zoom-in" style={{ transform: `translate(0px, -60px)`, bottom: '0px' }}>
                             <span className="text-[9px] md:text-[11px] font-black uppercase text-white tracking-widest">{String(strengthLabel)}</span>
                        </div>
                    )}
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
  const [nuclearConfirm, setNuclearConfirm] = useState(false);

  // Graphics states
  const [headerHeight, setHeaderHeight] = useState(64); 
  const [footerHeight, setFooterHeight] = useState(230); 
  const [tableZoom, setTableZoom] = useState(1);
  const [heroCardScale, setHeroCardScale] = useState(1.3);
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

  const heroPlayerObj = useMemo(() => {
    if (heroIdx === -1) return null;
    return players[heroIdx];
  }, [players, heroIdx]);

  const isBrokeStatus = useMemo(() => !!heroPlayerObj?.isBust, [heroPlayerObj]);

  const minRaiseAllowed = useMemo(() => {
      const bb = 20; 
      return Math.max(highestBet + bb, highestBet * 2);
  }, [highestBet]);

  const heroDrawIntelligence = useMemo(() => {
    if (!heroPlayerObj || heroPlayerObj.isFolded || community.length < 3 || community.length === 5) return null;
    const suits = [...heroPlayerObj.hand, ...community].map(c => c.suit);
    const suitCounts = suits.reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {});
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    const remainingCards = 5 - community.length;

    const draws = [];
    if (maxSuitCount === 4) {
      const outs = 9;
      const prob = remainingCards === 2 ? (outs * 4) - (outs - 8) : outs * 2;
      draws.push({ name: 'FLUSH', prob: Math.round(prob), best: "NUT FLUSH" });
    }
    if (draws.length === 0) {
      draws.push({ name: 'FULL HOUSE', prob: 12, best: "QUATS/BOAT" });
      draws.push({ name: 'STRAIGHT', prob: 18, best: "HIGH STRAIGHT" });
    }
    return draws[0];
  }, [heroPlayerObj, community]);

  const handleAction = useCallback((type, amt = 0) => {
      const roomId = currentRoomId; if (!roomId) return;
      socket.emit('playerAction', { roomId, type, amount: type === 'RAISE' ? Number(amt || raiseInput) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleLogin = useCallback(() => { 
      if (passwordInput === 'pass') { 
          socket.emit('getInitialData'); 
          setUserProfile({ name: 'SUPER ADMIN', uid: 'admin_1' }); 
          setCurrentView(VIEWS.ADMIN); 
      } 
      else { socket.emit('playerLogin', { password: passwordInput }); }
  }, [passwordInput]);

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile) return;
    const rId = selectedTableForJoin.id;
    socket.emit('joinRoom', { roomId: rId, profile: { ...userProfile, pendingVariant: pendingVariantId }, buyIn: buyInAmount }, (res) => {
        if (res?.status === 'ok') { setCurrentRoomId(rId); setCurrentView(VIEWS.GAME); setSelectedTableForJoin(null); }
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

  const addBot = useCallback(() => {
      if (!currentRoomId) return;
      socket.emit('adminAddBot', { roomId: currentRoomId });
  }, [currentRoomId]);

  const getWinnerDisplayPos = useCallback((idx) => {
    const heroSeatOffset = heroIdx !== -1 ? heroIdx : 0;
    const relativeIdx = (idx - heroSeatOffset + TOTAL_SEATS) % TOTAL_SEATS;
    return DISPLAY_POSITIONS[relativeIdx] || { x: 50, y: 50 };
  }, [heroIdx]);

  useEffect(() => {
    socket.on('roomUpdate', (d) => {
        if (!d) { setPlayers(INITIAL_PLAYERS); setPhase(PHASES.IDLE); setPotAmount(0); setCommunity([]); return; }
        if (d.id) setCurrentRoomId(d.id);
        const phaseChanged = d.phase !== phase && phase !== PHASES.IDLE && d.phase !== PHASES.IDLE;
        const currentPotValue = Number(d.potData?.[0]?.amount || 0);
        const potIncreased = currentPotValue > potAmount;

        if (phaseChanged) {
            setIsCollectingBets(true);
            setTimeout(() => {
                setIsCollectingBets(false);
                if (potIncreased) { setPotAnimating(true); setTimeout(() => setPotAnimating(false), 800); }
            }, 1200);
        } else if (potIncreased && d.phase === phase) {
             setPotAnimating(true); setTimeout(() => setPotAnimating(false), 800);
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

        setPhase(d.phase); setCommunity(d.community || []); setActiveVariant(d.activeVariant || VARIANTS.HOLDEM);
        setHighestBet(Number(d.highestBet) || 0); setActiveIdx(d.activeIdx ?? -1); setWinning5Ids(d.winning5Ids || []);
        setPotAmount(currentPotValue); setTimeRemaining(Number(d.timeRemaining) || 30);

        if (d.activeIdx !== -1 && d.players?.[d.activeIdx]?.uid === userProfile?.uid) {
            const bb = 20; 
            const minRaise = Math.max(Number(d.highestBet) + bb, Number(d.highestBet) * 2);
            setRaiseInput(prev => (prev < minRaise) ? minRaise : prev);
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
        const entry = { id: Math.random(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), ...d };
        setLogs(prev => [entry, ...prev].slice(0, 50));
    });

    return () => { 
        socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); socket.off('loginSuccess'); socket.off('log'); 
    };
  }, [phase, potAmount, userProfile, phase]);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white font-black uppercase tracking-tighter">
        <div className="w-full max-w-[400px] p-8 md:p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8 font-black">
            <div className="p-5 bg-white/5 rounded-full ring-1 ring-white/10 shadow-inner"><Lock size={32} className="text-[#fbbf24]" /></div>
            <div className="w-full space-y-4 font-black">
                <label className="text-[10px] text-white/40 block ml-2">ACCESS PASSCODE</label>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-xl font-black uppercase"/>
            </div>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl hover:scale-[1.02] font-black text-lg transition-transform uppercase">ENTER ARENA</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white font-black uppercase overflow-hidden font-black">
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 p-4 md:p-8 flex flex-row md:flex-col gap-4 bg-black/20 shrink-0 font-black">
            <h2 className="text-[#fbbf24] tracking-widest hidden md:flex items-center gap-2 mb-4 font-black"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-3 md:p-4 rounded-xl text-xs md:text-sm transition-all font-black ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-white/40'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-3 md:p-4 rounded-xl text-xs md:text-sm transition-all font-black ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-white/40'}`}>TABLES</button>
            <button onClick={handleNuclear} className={`hidden md:flex mt-auto p-4 rounded-xl items-center justify-center gap-2 border-2 transition-all font-black ${nuclearConfirm ? 'bg-red-600 border-white text-white animate-pulse' : 'bg-red-950/20 border-red-500 text-red-500'}`}>
                {nuclearConfirm ? <Bomb size={20}/> : <ShieldAlert size={20}/>}
                <span>{nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</span>
            </button>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="p-3 md:p-4 text-white/20 hover:text-white text-xs flex items-center gap-2 font-black"><ArrowLeft size={16}/></button>
        </aside>
        <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-black/40 font-black font-black uppercase font-black uppercase">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8 animate-in fade-in">
                    <h3 className="text-xl md:text-2xl tracking-widest border-l-4 border-[#fbbf24] pl-4 font-black">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10 shadow-xl font-black">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#fbbf24] font-black uppercase"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#fbbf24] font-black uppercase"/>
                        <button onClick={()=>socket.emit('adminCreatePlayer', {...newPlayer, uid: Math.random().toString(36).slice(2)})} className="bg-[#fbbf24] text-black rounded-xl font-black p-4 transition-all">CREATE</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10 font-black">
                        {(allProfiles || []).map(p => (
                            <div key={p.uid} className="flex justify-between p-4 md:p-6 border-b border-white/5 hover:bg-white/5 transition-all font-black">
                                <span className="uppercase">{String(p.name)} <span className="text-white/20 ml-2">[{String(p.password)}]</span></span>
                                <div className="flex gap-4 items-center font-black">
                                    <span className="text-emerald-400 font-mono text-sm md:text-lg tracking-tighter">${Number(p.chips || 0).toLocaleString()}</span>
                                    <button onClick={()=>{const n = prompt("NEW WALLET", p.chips); if(n) socket.emit('adminEditChips', {uid: p.uid, chips: Number(n)})}}><Edit3 size={18} className="text-cyan-400"/></button>
                                    <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)}><Trash2 size={18} className="text-red-500"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8 animate-in fade-in font-black uppercase">
                    <h3 className="text-xl md:text-2xl tracking-widest border-l-4 border-emerald-500 pl-4 font-black">ARENA CONTROL</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 border border-white/10 shadow-xl font-black uppercase font-black uppercase font-black uppercase font-black">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#fbbf24] font-black uppercase font-black uppercase"/>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-black uppercase font-black uppercase font-black">
                            <div className="space-y-1"><span className="text-[9px] text-white/40 font-black">SB</span><input value={newTable.sb} type="number" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[9px] text-white/40 font-black">BB</span><input value={newTable.bb} type="number" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[9px] text-white/40 font-black">MIN</span><input value={newTable.minBuy} type="number" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[9px] text-white/40 font-black">MAX</span><input value={newTable.maxBuy} type="number" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})}/></div>
                        </div>
                        <button onClick={handleSpawnArena} className="bg-emerald-600 rounded-xl font-black p-4 uppercase transition-all font-black font-black uppercase font-black uppercase font-black">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-black uppercase font-black uppercase font-black font-black uppercase">
                        {(activeTables || []).map(t => (
                            <div key={t.id} className="bg-white/5 p-4 md:p-6 rounded-2xl flex justify-between items-center border border-white/10 hover:border-emerald-500/50 transition-all shadow-lg font-black uppercase">
                                <div><h4 className="text-[#fbbf24] text-base md:text-lg font-black truncate">{String(t.name)}</h4><p className="text-[10px] text-white/40 tracking-widest">${t.sb}/${t.bb} | {t.players?.filter(Boolean).length || 0}/10 SEATED</p></div>
                                <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 p-2 md:p-3 rounded-xl text-red-500 hover:bg-red-500 transition-all font-black uppercase font-black">TERMINATE</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div className="h-screen bg-[#06080c] flex flex-col text-white font-black uppercase overflow-hidden font-black font-black">
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 px-6 font-black uppercase">
                <div className="w-full max-w-[400px] p-8 md:p-12 bg-slate-900 border border-[#fbbf24]/30 rounded-[2vw] shadow-2xl flex flex-col gap-10">
                    <h3 className="text-2xl md:text-3xl text-center tracking-widest text-[#fbbf24] underline underline-offset-8 uppercase font-black font-black uppercase font-black">{String(selectedTableForJoin.name)}</h3>
                    <div className="space-y-6 font-black text-center uppercase">
                        <div className="flex justify-between items-center text-[10px] text-white/40 tracking-widest font-black font-black"><span>BUY-IN AMOUNT</span><span className="text-emerald-400 text-xl md:text-2xl font-mono">${buyInAmount.toLocaleString()}</span></div>
                        <input type="range" min={selectedTableForJoin.minBuy || 400} max={selectedTableForJoin.maxBuy || 2000} step={100} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fbbf24]" />
                    </div>
                    <div className="flex gap-4 font-black font-black font-black uppercase font-black">
                        <button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black uppercase font-black uppercase">BACK</button>
                        <button onClick={joinRoom} className="flex-2 p-5 bg-emerald-600 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all text-sm tracking-widest font-black uppercase font-black uppercase">SIT DOWN</button>
                    </div>
                </div>
            </div>
        )}
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 md:px-12 bg-black/40 backdrop-blur-md shadow-xl z-50 shrink-0 font-black">
            <h2 className="tracking-widest md:tracking-[0.4em] text-sm md:text-xl flex items-center gap-4 font-black font-black uppercase font-black uppercase font-black"><LayoutGrid className="text-[#fbbf24]"/> LOBBY</h2>
            <div className="flex items-center gap-6 md:gap-10 font-black">
                <div className="flex flex-col items-end font-black uppercase font-black uppercase font-black uppercase">
                    <span className="text-[8px] md:text-[10px] text-white/40 uppercase italic">ID: {String(userProfile?.name || "??")}</span>
                    <span className="text-emerald-400 font-mono text-base md:text-2xl tracking-tighter font-black">${Number(userProfile?.chips || 0).toLocaleString()}</span>
                </div>
                <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={24}/></button>
            </div>
        </header>
        <main className="flex-1 p-6 md:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 overflow-y-auto bg-gradient-to-br from-transparent to-white/5 font-black uppercase">
            {(activeTables || []).map((t) => (
                <div key={t.id} className="p-8 bg-white/5 border border-white/5 rounded-3xl flex flex-col gap-6 shadow-2xl hover:border-[#fbbf24]/20 transition-all group relative overflow-hidden font-black">
                    <h3 className="text-xl md:text-2xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors uppercase font-black font-black uppercase font-black uppercase">{String(t.name)}</h3>
                    <div className="bg-black/60 p-4 md:p-6 rounded-2xl flex justify-between items-center border border-white/5 shadow-inner uppercase font-black font-black uppercase font-black uppercase">
                        <div className="flex flex-col font-black uppercase font-black uppercase"><span className="text-[8px] text-white/40 tracking-widest font-black uppercase font-black uppercase font-black">STAKES</span><span className="text-[#fbbf24] text-lg md:text-xl font-black">${t.sb}/${t.bb}</span></div>
                        <div className="flex flex-col items-end font-black font-black uppercase"><span className="text-[8px] text-white/40 tracking-widest font-black uppercase font-black uppercase font-black">SEATS</span><span className="text-white/80 font-mono text-sm md:text-base font-black font-black uppercase">{t.players?.filter(p=>p).length || 0}/10</span></div>
                    </div>
                    <button onClick={()=>setSelectedTableForJoin(t)} className="w-full p-6 md:p-8 bg-emerald-600 rounded-2xl tracking-widest shadow-xl hover:scale-[1.02] transition-all font-black uppercase font-black uppercase font-black uppercase font-black">ENTER ARENA</button>
                </div>
            ))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      
      {showRules && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-lg animate-in fade-in duration-300 p-6 font-black uppercase">
          <div className="w-full max-w-[500px] bg-slate-900 border border-[#fbbf24]/40 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,1)] p-8 flex flex-col gap-6 relative overflow-hidden font-black uppercase">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><BookOpen size={120} className="text-[#fbbf24]"/></div>
            <h3 className="text-2xl md:text-3xl font-black text-[#fbbf24] tracking-widest border-b border-white/10 pb-4 uppercase font-black uppercase">{activeVariant.name} RULES</h3>
            <div className="text-sm md:text-lg leading-relaxed text-white/80 font-black italic tracking-wide font-black uppercase">
              {VARIANT_RULES[activeVariant.id] || "Rules coming soon..."}
            </div>
            <button onClick={() => setShowRules(false)} className="mt-4 w-full p-4 bg-[#fbbf24] text-black font-black rounded-xl hover:scale-[1.02] transition-transform font-black uppercase font-black">UNDERSTOOD</button>
          </div>
        </div>
      )}

      {isBrokeStatus && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6 font-black uppercase">
                <div className="w-full max-w-[400px] p-10 bg-slate-900 border-2 border-red-500 rounded-3xl text-center shadow-[0_0_100px_rgba(239,68,68,0.4)] font-black uppercase">
                    <AlertTriangle size={80} className="text-red-500 animate-pulse mb-6 mx-auto" />
                    <h2 className="text-3xl font-black mb-2 uppercase font-black uppercase">BUSTED!</h2>
                    <button onClick={() => socket.emit('adminAddChips', { roomId: currentRoomId, uid: userProfile.uid, chips: 1000 })} className="w-full p-6 bg-emerald-600 text-white rounded-2xl shadow-xl animate-bounce font-black uppercase">REBUY $1,000</button>
                </div>
          </div>
      )}

      {/* HEADER */}
      <header style={{ height: `${headerHeight}px` }} className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4 md:px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black uppercase">
        <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowRules(true)}
              className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 shadow-inner truncate font-black uppercase group hover:bg-white/10 transition-colors"
            >
                <span className="text-[#fbbf24] text-[8px] md:text-[10px] tracking-widest font-black">ARENA:</span>
                <span className="text-white ml-2 text-[10px] md:text-xs font-black underline decoration-dashed decoration-[#fbbf24]/40 underline-offset-4 font-black uppercase">{String(activeVariant.name)}</span>
            </button>
            <button onClick={() => setShowLayoutControls(!showLayoutControls)} className={`p-2 rounded-lg transition-all font-black uppercase ${showLayoutControls ? 'bg-[#fbbf24] text-black shadow-[0_0_15px_#fbbf24]' : 'bg-white/5 text-white/40'}`}>
                <Sliders size={18}/>
            </button>
        </div>

        {showLayoutControls && (
            <div className="absolute top-16 left-4 bg-black/95 border border-white/10 p-6 rounded-2xl shadow-2xl z-[1000] flex flex-col gap-5 min-w-[280px] animate-in slide-in-from-top-4 backdrop-blur-xl font-black uppercase">
                <div className="grid grid-cols-2 gap-4 font-black uppercase">
                    <div className="space-y-1">
                        <span className="text-[8px] text-white/40 uppercase font-black uppercase font-black">HEADER</span>
                        <input type="range" min="40" max="100" value={headerHeight} onChange={(e)=>setHeaderHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none"/>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[8px] text-white/40 uppercase font-black uppercase font-black">FOOTER</span>
                        <input type="range" min="120" max="400" value={footerHeight} onChange={(e)=>setFooterHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none"/>
                    </div>
                </div>
                <div className="space-y-1 font-black uppercase font-black">
                    <span className="text-[8px] text-white/40 uppercase font-black">TABLE ZOOM ({Math.round(tableZoom * 100)}%)</span>
                    <input type="range" min="0.5" max="1.5" step="0.05" value={tableZoom} onChange={(e)=>setTableZoom(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none"/>
                </div>
                <div className="space-y-1 font-black uppercase font-black">
                    <span className="text-[8px] text-white/40 uppercase text-emerald-400 font-black">HERO CARDS ({Math.round(heroCardScale * 100)}%)</span>
                    <input type="range" min="0.5" max="2.5" step="0.1" value={heroCardScale} onChange={(e)=>setHeroCardScale(Number(e.target.value))} className="w-full accent-emerald-500 h-1 bg-white/10 rounded-full appearance-none"/>
                </div>
                <button onClick={()=>setShowLayoutControls(false)} className="bg-[#fbbf24] text-black font-black py-2 rounded-lg text-[10px] tracking-widest uppercase font-black uppercase">CLOSE</button>
            </div>
        )}

        <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-xl flex items-center gap-4 shadow-inner font-black uppercase">
            <span className="hidden sm:inline text-white/40 text-[9px] tracking-widest uppercase font-black uppercase font-black">DEALER CHOICE:</span>
            <select value={pendingVariantId} onChange={(e) => {setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value})}} className="bg-transparent text-[#fbbf24] outline-none text-xs cursor-pointer font-black uppercase">
                {Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900 font-black uppercase">{v.name}</option>)}
            </select>
        </div>
        <div className="flex gap-2 font-black uppercase font-black">
            <button onClick={addBot} className="text-indigo-400 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-indigo-400/20 font-black uppercase font-black"><Bot size={20}/></button>
            <button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/20 font-black font-black uppercase"><LogOut size={20}/></button>
        </div>
      </header>

      {/* TABLE AREA */}
      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-[#041a14] to-[#020a08] overflow-hidden px-2 py-2 font-black uppercase">
        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 10}px)` }} className="relative w-full max-w-[1400px] aspect-[21/10] flex items-center justify-center h-full transition-all duration-500 ease-out origin-center font-black">
            
            <div className="absolute inset-0 bg-[#0f3d2e] rounded-[50%] border-[2.5vw] border-[#1a110a] shadow-[inset_0_0_20vw_rgba(0,0,0,0.9),0_20px_100px_rgba(0,0,0,0.8)] border-double font-black uppercase" />
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden translate-y-[22%] font-black uppercase font-black">
                <span className="text-[12vw] font-black text-white/5 italic tracking-tighter uppercase select-none rotate-[-8deg] whitespace-nowrap font-black">
                  {activeVariant.name}
                </span>
            </div>

            <div className="absolute inset-0 pointer-events-none z-20 font-black uppercase">
              {(players || []).map((p, i) => {
                if (!p) return null;
                const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS;
                return (
                  <Seat 
                    key={i} 
                    player={p} 
                    displayPos={DISPLAY_POSITIONS[rIdx]} 
                    phase={phase} 
                    winning5Ids={winning5Ids} 
                    isActiveTurn={activeIdx === i} 
                    strengthLabel={p.strength} 
                    isCollectingBets={isCollectingBets} 
                    timeRemaining={timeRemaining} 
                    isHero={i === heroIdx} 
                    hiLowAwards={hiLowAwards} 
                    cardScale={heroCardScale} 
                    relativeIdx={rIdx}
                  />
                );
              })}
            </div>

            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center font-black">
              {!potTransferring && (
                <div className={`flex flex-col items-center transition-all duration-500 font-black uppercase ${potAnimating ? 'scale-110' : 'scale-100'}`}>
                    <div className={`text-[6vw] md:text-[5vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-[0_10px_30px_rgba(0,0,0,0.9)] ${potAnimating ? 'animate-pot-pulse' : ''}`}>
                      ${Number(totalDisplayPot || 0).toLocaleString()}
                    </div>
                </div>
              )}
              <div className="flex gap-2 md:gap-4 scale-[1.1] md:scale-[1.8] mt-6 md:mt-12 font-black uppercase font-black">
                  {(community || []).map((c, j) => (
                    <div key={c.id || j} className={`w-[6vw] md:w-[3.5vw] h-[9vw] md:h-[5.5vw] rounded-lg border-2 bg-gradient-to-tr from-slate-50 to-white flex flex-col items-center justify-center text-slate-900 font-black transition-all duration-700 shadow-[0_10px_40px_rgba(0,0,0,0.8)] ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 z-30 shadow-[0_0_50px_rgba(251,191,36,0.6)]' : 'border-white/10'}`}>
                        <span className="text-[12px] md:text-[14px] font-black leading-none">{String(c.value)}</span>
                        <span className="text-[16px] md:text-[20px] mt-1 leading-none"><CardSymbol suit={c.suit} /></span>
                    </div>
                  ))}
              </div>
            </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ height: `${footerHeight}px` }} className="bg-black/95 backdrop-blur-3xl border-t border-white/5 flex z-[100] shadow-[0_-15px_50px_rgba(0,0,0,1)] shrink-0 font-black uppercase overflow-hidden font-black">
        
        {/* INTELLIGENCE FEED */}
        <div className="hidden md:flex w-[32%] border-r border-white/10 p-3 flex-col overflow-hidden text-[10px] font-mono tracking-widest font-black uppercase">
            <div className="text-white/40 mb-2 flex items-center justify-between border-b border-white/5 pb-2 px-2 uppercase">
                <div className="flex items-center gap-2 font-black uppercase"><Eye size={14} className="text-[#fbbf24]"/> ACTIVITY LOG</div>
                <div className="flex items-center gap-1 text-emerald-500 animate-pulse text-[8px] font-black uppercase"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> SECURE FEED</div>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide font-black p-0.5">
                {(logs || []).map(l => (
                    <div key={l.id} className="animate-in slide-in-from-left duration-300 flex items-center gap-3 border-l-4 border-white/5 pl-3 py-1 hover:bg-white/5 transition-colors border-b border-white/5 rounded-r-lg">
                        <span className="text-white/20 text-[7px] font-black shrink-0 w-10">{String(l.time)}</span> 
                        <div className="flex items-center gap-x-2 font-black leading-none overflow-hidden font-black">
                            <span className={`font-black uppercase text-[9px] px-1.5 py-0.5 rounded-sm shrink-0 shadow-sm ${
                                l.type === 'win' ? 'bg-emerald-500/20 text-emerald-400' : 
                                l.type === 'variant' ? 'bg-purple-500/20 text-purple-400' : 
                                l.type === 'fold' ? 'bg-red-500/20 text-red-400' :
                                l.type === 'phase' ? 'bg-cyan-500/20 text-cyan-400' :
                                'bg-yellow-500/20 text-[#fbbf24]'
                            }`}>{String(l.name)}</span>
                            <span className="text-white/60 lowercase tracking-tight text-[9px] font-black truncate">{String(l.action)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* ACTION / ANALYTICS CENTER */}
        <div className="flex-1 flex flex-col justify-between relative bg-gradient-to-t from-black to-white/5 py-4 px-4 md:px-10 font-black uppercase overflow-hidden">
          
          {activeIdx === heroIdx && phase !== PHASES.SHOWDOWN && phase !== PHASES.IDLE && heroPlayerObj ? (
            <>
               <div className="flex items-center justify-between bg-black/60 backdrop-blur-2xl rounded-3xl p-3 border border-white/10 mb-2 animate-in slide-in-from-bottom-4 duration-700 font-black uppercase">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-600/20 rounded-2xl flex items-center justify-center border border-purple-500/40 font-black">
                      <TargetIcon size={20} className="text-purple-400" />
                    </div>
                    <div className="flex flex-col font-black">
                      <span className="text-[8px] text-white/30 tracking-[0.2em] font-black uppercase font-black uppercase">CURRENT HAND</span>
                      <span className="text-[12px] text-purple-300 font-black uppercase font-black uppercase">{heroPlayerObj.strength || "HIGH CARD"}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end font-black">
                    <span className="text-[8px] text-white/30 tracking-[0.2em] font-black uppercase font-black uppercase">PROJECTED BEST</span>
                    <div className="flex items-center gap-3 font-black">
                      <div className="flex flex-col items-end font-black uppercase">
                        <span className="text-[10px] text-cyan-400 font-black font-black uppercase font-black">{heroDrawIntelligence?.name || "STAND PAT"}</span>
                        <span className="text-[7px] text-white/20 uppercase font-black uppercase font-black">{heroDrawIntelligence?.best || ""}</span>
                      </div>
                      <span className="text-[20px] text-cyan-400 font-mono font-black font-black">{heroDrawIntelligence?.prob || '--'}%</span>
                    </div>
                  </div>
              </div>

              <div className="flex flex-col gap-3 h-full justify-end font-black uppercase">
                  <div className="flex gap-3 w-full justify-center font-black uppercase mb-1">
                      {['1/2 POT', 'POT', 'MAX'].map((label, i) => (
                        <button 
                          key={i}
                          onClick={() => {
                            const amt = i === 0 ? highestBet + Math.floor(totalDisplayPot * 0.5) : 
                                        i === 1 ? highestBet + totalDisplayPot : 
                                        heroPlayerObj.chips + heroPlayerObj.currentBet;
                            handleAction('RAISE', amt);
                          }}
                          className="px-6 py-2 bg-slate-900 border border-white/10 rounded-full text-[10px] font-black hover:bg-white hover:text-black transition-all shadow-[0_5px_15px_rgba(0,0,0,0.5)] active:translate-y-1 font-black"
                        >
                          {label}
                        </button>
                      ))}
                  </div>

                  <div className="grid grid-cols-12 gap-4 font-black uppercase">
                      <button onClick={()=>handleAction('FOLD')} className="col-span-3 h-16 md:h-18 bg-red-950/40 border-2 border-red-600/50 rounded-3xl flex flex-col items-center justify-center active:scale-95 transition-all shadow-xl font-black font-black uppercase">
                        <X size={20} className="text-red-500 mb-0.5" />
                        <span className="text-[10px] font-black text-red-500 uppercase font-black">FOLD</span>
                      </button>
                      
                      <button onClick={()=>handleAction('CALL')} className="col-span-5 h-16 md:h-18 bg-gradient-to-b from-indigo-500 to-indigo-700 border-2 border-indigo-400 shadow-[0_10px_30px_rgba(79,70,229,0.3)] rounded-3xl flex flex-col items-center justify-center active:scale-95 transition-all font-black uppercase font-black uppercase">
                          <span className="text-sm md:text-lg font-black tracking-[0.2em] font-black uppercase">{highestBet > heroPlayerObj.currentBet ? 'CALL' : 'CHECK'}</span>
                          <span className="text-[10px] font-mono opacity-80 font-black uppercase">{highestBet > heroPlayerObj.currentBet ? `$${(highestBet - heroPlayerObj.currentBet).toLocaleString()}` : 'CONFIRM'}</span>
                      </button>

                      <div className="col-span-4 h-16 md:h-18 bg-black/60 border-2 border-emerald-500/30 rounded-3xl flex flex-col overflow-hidden shadow-inner font-black uppercase font-black">
                          <div className="flex-1 flex items-center justify-center bg-black/40 px-3 font-black uppercase">
                              <span className="text-emerald-500 text-[12px] mr-1 font-black font-black uppercase">$</span>
                              <input type="number" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(heroPlayerObj.chips + heroPlayerObj.currentBet, Math.max(minRaiseAllowed, Number(e.target.value))))} className="w-full bg-transparent text-center font-mono text-base text-white outline-none font-black" />
                          </div>
                          <button onClick={()=>handleAction('RAISE', raiseInput)} className="h-8 bg-emerald-600 flex items-center justify-center hover:bg-emerald-500 transition-all font-black uppercase">
                            <Zap size={14} className="text-white mr-2"/><span className="text-[10px] font-black uppercase">RAISE</span>
                          </button>
                      </div>
                  </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase">
                {showdownWinners && showdownWinners.length > 0 ? (
                    <div className="flex flex-col items-center gap-3 w-full h-full justify-center">
                        <div className="flex items-center gap-3 text-yellow-400 animate-pulse font-black tracking-[0.4em] text-xs uppercase font-black">
                             <Sparkles size={18} /> {showdownWinners.length > 1 ? "SPLIT POT SHOWDOWN" : "ARENA CHAMPION"}
                        </div>
                        <div className="flex gap-6 items-center justify-center animate-in fade-in slide-in-from-bottom-8 duration-1000 w-full overflow-x-auto pb-2 font-black font-black uppercase">
                            {showdownWinners.slice(0, 2).map((winner, idx) => (
                                <div key={idx} className="flex items-center gap-5 bg-black/80 p-4 rounded-[2.5rem] border-2 border-[#fbbf24]/30 shadow-[0_20px_60px_rgba(0,0,0,1)] min-w-[300px] shrink-0 font-black uppercase font-black uppercase">
                                    <div className="flex flex-col items-center shrink-0 border-r border-white/10 pr-5 font-black uppercase">
                                        <div className="text-[#fbbf24] font-black text-sm md:text-lg tracking-widest font-black uppercase">{winner.name}</div>
                                        <div className="text-emerald-400 font-mono text-sm md:text-lg font-black font-black uppercase">+${(winner.amount || 0).toLocaleString()}</div>
                                        <div className="text-[8px] text-white/50 tracking-tighter uppercase mt-1 italic font-black uppercase">{winner.rank}</div>
                                    </div>
                                    <div className="flex gap-1.5 font-black uppercase">
                                        {(winner.hand || []).map((c, ci) => (
                                            <div key={ci} className="w-8 h-12 bg-white rounded-md flex flex-col items-center justify-center text-slate-900 shadow-xl transform hover:scale-110 transition-all font-black bg-glimmer">
                                                <span className="text-[10px] font-black leading-none font-black uppercase">{String(c.value)}</span>
                                                <span className="text-[14px] font-black uppercase"><CardSymbol suit={c.suit} /></span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500 w-full font-black uppercase font-black uppercase">
                        {phase === PHASES.IDLE ? (
                             <div className="flex flex-col items-center gap-3 font-black uppercase font-black">
                                <div className="p-4 bg-white/5 rounded-full animate-pulse border border-white/5 shadow-2xl font-black uppercase font-black uppercase"><Target size={42} className="text-[#fbbf24]"/></div>
                                <span className="text-white/40 tracking-[0.5em] text-xs md:text-xl font-black italic uppercase font-black uppercase font-black uppercase">WAITING FOR HAND</span>
                             </div>
                        ) : (
                          <>
                            {heroPlayerObj && !heroPlayerObj.isFolded && (
                                <div className="w-full grid grid-cols-2 gap-6 bg-black/60 backdrop-blur-3xl rounded-[2rem] p-4 border-2 border-white/10 animate-in zoom-in duration-700 mb-6 font-black uppercase shadow-inner font-black uppercase">
                                    <div className="flex flex-col gap-1 font-black font-black uppercase font-black uppercase">
                                        <div className="flex items-center gap-2 text-[9px] text-[#fbbf24] tracking-[0.2em] font-black uppercase mb-1 font-black">
                                            <TargetIcon size={14}/> CURRENT HAND
                                        </div>
                                        <div className="text-xl md:text-2xl text-white font-black tracking-tighter font-black uppercase">
                                            {heroPlayerObj.strength || "HIGH CARD"}
                                        </div>
                                        <div className="text-[10px] text-purple-400 font-black tracking-widest mt-1 font-black uppercase font-black uppercase font-black uppercase font-black uppercase">EST. EQUITY: {heroPlayerObj.winProbability ? Math.round(heroPlayerObj.winProbability) : '--'}%</div>
                                    </div>
                                    <div className="flex flex-col items-end border-l border-white/10 pl-6 font-black uppercase font-black uppercase font-black uppercase font-black uppercase font-black uppercase font-black uppercase font-black">
                                        <div className="flex items-center gap-2 text-[9px] text-cyan-400 tracking-[0.2em] font-black uppercase mb-2 font-black uppercase font-black uppercase">
                                            <Activity size={14}/> PROJECTED BEST
                                        </div>
                                        <div className="flex flex-col gap-1 w-full font-black uppercase">
                                          <div className="flex items-center justify-between text-[11px] font-black font-black uppercase">
                                            <span className="text-white/60 font-black uppercase">{heroDrawIntelligence?.name || "STAND PAT"}</span>
                                            <span className="text-cyan-400 font-mono font-black font-black uppercase">{heroDrawIntelligence?.prob || '--'}%</span>
                                          </div>
                                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1 font-black uppercase">
                                             <div className="h-full bg-cyan-400 shadow-[0_0_10px_cyan]" style={{ width: `${heroDrawIntelligence?.prob || 0}%` }} />
                                          </div>
                                          <div className="text-[7px] text-white/20 uppercase mt-1 font-black uppercase">{heroDrawIntelligence?.best || ""}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col items-center gap-2 font-black uppercase font-black">
                                <div className="flex items-center gap-3 text-cyan-400 animate-pulse mb-1 font-black uppercase">
                                    <MessageSquare size={18} />
                                    <span className="text-[10px] md:text-xs font-black tracking-[0.4em] uppercase font-black uppercase font-black uppercase">WAITING ON RESPONSE</span>
                                </div>
                                <span className="text-2xl md:text-4xl font-black text-white tracking-widest drop-shadow-[0_10px_20px_rgba(0,0,0,1)] font-black uppercase">{players[activeIdx]?.name || "ARENA"}</span>
                            </div>
                          </>
                        )}
                    </div>
                )}
            </div>
          )}
        </div>
      </footer>

      <style>{`
          @keyframes progress { from { width: 100%; } to { width: 0%; } }
          @keyframes fling-to-pot { 
            0% { transform: translate(calc(-50% + var(--bx, 0px)), var(--by, 0px)) scale(1.2); filter: blur(0px); opacity: 1; } 
            100% { transform: translate(0, -30vh) scale(0.1) rotate(720deg); filter: blur(8px); opacity: 0; } 
          }
          @keyframes transfer-chip { 0% { top: 43%; left: 50%; opacity: 1; transform: translate(-50%, -50%) scale(1.5); } 100% { top: var(--ty); left: var(--tx); opacity: 0; transform: translate(-50%, -50%) scale(0.1); } }
          @keyframes pot-pulse { 0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } 50% { transform: scale(1.05); filter: drop-shadow(0 0 40px #fbbf24); } }
          .animate-pot-pulse { animation: pot-pulse 1.2s ease-in-out infinite; }
          .bg-glimmer { background: linear-gradient(135deg, #fff 0%, #fff 40%, #fbbf24 50%, #fff 60%, #fff 100%); background-size: 200% 200%; animation: glimmer 3s infinite; }
          @keyframes glimmer { 0% { background-position: -100% -100%; } 100% { background-position: 200% 200%; } }
          .animate-winner-ring { animation: winner-ring 2s infinite; }
          @keyframes winner-ring { 0%, 100% { box-shadow: 0 0 0px #fbbf24; border-color: #fbbf24; } 50% { box-shadow: 0 0 40px #fbbf24; border-color: white; } }
          .animate-pulse-fast { animation: pulse 0.8s infinite; }
          @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } }
          ::-webkit-scrollbar { display: none; }
          .bg-felt-texture { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E"); }
          @keyframes bounce-short { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          .animate-bounce-short { animation: bounce-short 1s infinite; }
      `}</style>
    </div>
  );
};

export default App;
