import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare, Clock, BarChart3, BookOpen, Activity, Percent, Flame,
  TrendingDown, Gavel, Crown, Terminal, Shield, Cpu
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
  { x: 0, y: -165 },   { x: 110, y: -115 }, { x: 140, y: 0 },    { x: 110, y: 115 },  { x: 70, y: 140 },   
  { x: 0, y: 160 },    { x: -70, y: 140 },  { x: -110, y: 115 }, { x: -140, y: 0 },   { x: -110, y: -115 } 
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
  return <span className={isRed ? 'text-red-500' : 'text-slate-950'}>{suit}</span>;
};

const UIOverlay = ({ children, isOpen, onClose, title, icon: Icon }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 p-6 font-black uppercase">
      <div className="w-full max-w-[550px] bg-slate-900/80 border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,1)] p-8 flex flex-col gap-6 relative overflow-hidden ring-1 ring-white/5">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">{Icon && <Icon size={160} className="text-white" />}</div>
        <div className="flex justify-between items-center border-b border-white/10 pb-4 relative z-10 font-black">
          <h3 className="text-2xl font-black text-[#fbbf24] tracking-widest flex items-center gap-3 uppercase">{Icon && <Icon size={24} />} {title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"><X size={24} /></button>
        </div>
        <div className="relative z-10 min-h-[100px] text-white/80 leading-relaxed font-black uppercase tracking-tight">{children}</div>
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
    const currentCardScale = isHero ? cardScale : 1.0;
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-700 ${player.isFolded ? 'opacity-30 grayscale scale-90 blur-[1px]' : 'opacity-100'}`}>
            {player.lastAction && !isShowdown && !player.isFolded && (
              <div className="absolute top-[-80px] animate-action-float text-cyan-400 font-black text-[10px] tracking-[0.3em] uppercase whitespace-nowrap drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">{player.lastAction}</div>
            )}
            {(isHero || isShowdown) && !player.isFolded && player.winProbability !== undefined && phase !== PHASES.IDLE && (
              <div className="absolute top-[-55px] flex flex-col items-center gap-1 animate-in fade-in slide-in-from-bottom-2 duration-500 font-black">
                <div className={`bg-black/60 backdrop-blur-xl border px-3 py-1 rounded-full flex items-center gap-2 shadow-2xl transition-colors duration-500 ${player.winProbability > 70 ? 'border-orange-500/50' : 'border-white/10'}`}>
                  <Flame size={12} className={player.winProbability > 70 ? 'text-orange-500 animate-pulse' : 'text-slate-400'} />
                  <span className="text-[10px] font-black text-white font-mono">{Math.round(player.winProbability)}%</span>
                </div>
              </div>
            )}
            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-700 ${isCollectingBets ? 'animate-fling-to-pot opacity-0' : 'opacity-100'}`} style={{ transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y}px)`, left: '50%', top: '50%' }}>
                    <div className="bg-gradient-to-b from-amber-200 via-amber-500 to-amber-800 text-black font-black text-[11px] md:text-[14px] px-5 py-1.5 rounded-full shadow-[0_12px_25px_rgba(0,0,0,0.8)] border-t border-white/60 flex items-center gap-2 whitespace-nowrap tracking-tighter uppercase font-black font-black">
                        <div className="w-4 h-4 rounded-full border border-black/20 bg-white/20 flex items-center justify-center shrink-0 font-black"><Coins size={10} fill="black" /></div>
                        {Number(player.currentBet).toLocaleString()}
                    </div>
                </div>
            )}
            <div className={`relative flex flex-col items-center p-2 rounded-[2rem] border-2 bg-gradient-to-br from-slate-800/90 to-slate-950 backdrop-blur-xl transition-all duration-500 min-w-[120px] md:min-w-[170px] shadow-[0_15px_40px_rgba(0,0,0,0.7)] ${isActiveTurn ? 'border-cyan-400 ring-[12px] ring-cyan-400/10 scale-110 translate-y-[-5px]' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 animate-winner-ring z-50' : ''}`}>
                {player.isDealer && (
                    <div className="absolute -top-3 -right-3 flex items-center justify-center z-30 font-black font-black">
                        <div className="w-7 h-7 bg-white rounded-full border-[3px] border-slate-900 shadow-xl flex items-center justify-center font-black">
                          <div className="w-3.5 h-3.5 bg-red-600 rounded-full animate-pulse-fast shadow-[0_0_10px_red] font-black" />
                        </div>
                    </div>
                )}
                <div className="flex flex-col items-center gap-0.5 w-full font-black">
                    <span className="text-[9px] md:text-[11px] font-black text-white/50 uppercase tracking-[0.2em] truncate w-full text-center px-4 mb-1 font-black">{String(player.name || "Anon")}</span>
                    <div className="h-[1px] w-1/3 bg-white/10 mb-1 font-black font-black" />
                    <span className={`text-[14px] md:text-[18px] font-mono font-black tracking-tight ${player.chips === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400'} font-black`}>${Number(player.chips || 0).toLocaleString()}</span>
                </div>
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="absolute -bottom-2 w-[85%] h-1.5 bg-black/60 rounded-full overflow-hidden p-[2px] font-black">
                        <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000 linear shadow-[0_0_10px_cyan] font-black" style={{ width: `${(timeRemaining / 30) * 100}%` }} />
                    </div>
                )}
            </div>
            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible translate-y-[55px] font-black">
                    {player.hand.map((c, ci) => (
                        <div key={c.id || ci} className={`w-[6.5vw] md:w-[4vw] h-[10vw] md:h-[6vw] rounded-xl flex flex-col items-start p-2 border-2 shadow-[0_20px_45px_rgba(0,0,0,0.6)] absolute transition-all duration-700 ${isShowdown || isHero ? 'bg-gradient-to-br from-white via-slate-50 to-slate-100 text-slate-900' : 'bg-gradient-to-br from-slate-700 to-slate-900 border-white/10 text-transparent'} ${isShowdown && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-[6px] ring-yellow-400 scale-125 z-30 shadow-[0_0_60px_#fbbf24]' : ''} font-black`} style={{ transform: `translateX(${(ci - (player.hand.length - 1) / 2) * 28}px) rotate(${(ci - (player.hand.length - 1) / 2) * 12}deg) scale(${currentCardScale})`, transformOrigin: 'bottom center', zIndex: ci }}>
                            {(isShowdown || isHero) ? (
                                <div className="flex flex-col items-center w-full relative font-black">
                                  <span className="text-[14px] md:text-[16px] font-black leading-none tracking-tighter font-black">{String(c.value)}</span>
                                  <div className="text-[16px] md:text-[20px] leading-none mt-1"><CardSymbol suit={c.suit} /></div>
                                  <div className="mt-8 self-end opacity-10 rotate-12 scale-[2.5] translate-x-2 font-black"><CardSymbol suit={c.suit} /></div>
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center opacity-10 scale-150 font-black"><ShieldCheck className="text-white font-black" /></div>
                            )}
                        </div>
                    ))}
                    {strengthLabel && !player.isFolded && (isHero || isShowdown) && phase !== PHASES.IDLE && (
                        <div className="absolute -bottom-20 z-[120] whitespace-nowrap bg-purple-600/90 backdrop-blur-md px-5 py-1.5 rounded-full border border-purple-400 shadow-[0_10px_30px_rgba(168,85,247,0.5)] animate-in fade-in zoom-in duration-500 font-black">
                             <span className="text-[10px] md:text-[13px] font-black uppercase text-white tracking-[0.25em] font-black">{String(strengthLabel)}</span>
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
  const [footerHeight, setFooterHeight] = useState(250); 
  const [tableZoom, setTableZoom] = useState(1);
  const [heroCardScale, setHeroCardScale] = useState(1.4);
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
  const isBrokeStatus = useMemo(() => !!heroPlayerObj?.isBust, [heroPlayerObj]);
  const minRaiseAllowed = useMemo(() => Math.max(highestBet + 20, highestBet * 2), [highestBet]);

  const heroDrawIntelligence = useMemo(() => {
    if (!heroPlayerObj || heroPlayerObj.isFolded || community.length < 3 || community.length > 4) return null;
    const suitCounts = {};
    [...heroPlayerObj.hand, ...community].forEach(c => { suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1; });
    const draws = [];
    if (Math.max(...Object.values(suitCounts)) === 4) draws.push({ name: 'FLUSH DRAW', prob: 35, color: 'text-cyan-400' });
    if (draws.length === 0) draws.push({ name: 'TOP PAIR POTENTIAL', prob: 22, color: 'text-emerald-400' });
    return draws;
  }, [heroPlayerObj, community]);

  // --- ACTIONS ---
  
  const refreshState = useCallback(() => {
    socket.emit('getInitialData');
  }, []);

  const adminDeletePlayer = useCallback((uid) => { 
    if (window.confirm("ARENA PROTOCOL: TERMINATE USER?")) {
      socket.emit('adminDeletePlayer', uid); 
    }
  }, []);

  const adminDeleteRoom = useCallback((id) => { 
    if (window.confirm("ARENA PROTOCOL: TERMINATE INSTANCE?")) {
      socket.emit('adminDeleteRoom', id); 
    }
  }, []);

  const adminEditChips = useCallback((uid, current) => { 
    const n = prompt("NEW WALLET ALLOCATION:", current); 
    if(n !== null) socket.emit('adminEditChips', {uid, chips: Number(n)}); 
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
        const potIncreased = (Number(d.potData?.[0]?.amount || 0) > potAmount);
        if (d.phase !== phase && phase !== PHASES.IDLE) {
            setIsCollectingBets(true);
            setTimeout(() => { setIsCollectingBets(false); if (potIncreased) setPotAnimating(true); }, 1000);
            setTimeout(() => setPotAnimating(false), 1800);
        } else if (potIncreased) { setPotAnimating(true); setTimeout(() => setPotAnimating(false), 800); }
        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true); setShowdownWinners(d.showdownWinners || null); setHiLowAwards(d.hiLowAwards || null);
            setTimeout(() => { setPotTransferring(false); setShowdownWinners(null); }, 7500);
        }
        setPlayers(() => { const next = [...INITIAL_PLAYERS]; (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); return next; });
        setPhase(d.phase); setCommunity(d.community || []); setActiveVariant(d.activeVariant || VARIANTS.HOLDEM);
        setHighestBet(Number(d.highestBet) || 0); setActiveIdx(d.activeIdx ?? -1); setWinning5Ids(d.winning5Ids || []);
        setPotAmount(Number(d.potData?.[0]?.amount || 0)); setTimeRemaining(Number(d.timeRemaining) || 30);
        if (d.activeIdx !== -1 && d.players?.[d.activeIdx]?.uid === userProfile?.uid) {
            const minR = Math.max(Number(d.highestBet) + 20, Number(d.highestBet) * 2);
            setRaiseInput(p => p < minR ? minR : p);
        }
    });
    socket.on('lobbyUpdate', (list) => setActiveTables(list || []));
    socket.on('profilesUpdate', (list) => setAllProfiles(list || []));
    socket.on('initialDataResponse', (d) => { setAllProfiles(d.profiles || []); setActiveTables(d.rooms || []); });
    socket.on('loginSuccess', (p) => { setUserProfile(p); setPendingVariantId(p.pendingVariant || 'HOLDEM'); setCurrentView(VIEWS.LOBBY); socket.emit('getInitialData'); });
    socket.on('log', (d) => { setLogs(prev => [{ id: Math.random(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), ...d }, ...prev].slice(0, 50)); });
    return () => { socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); socket.off('loginSuccess'); socket.off('log'); };
  }, [phase, potAmount, userProfile]);

  // Sync state on admin open
  useEffect(() => {
    if (currentView === VIEWS.ADMIN) refreshState();
  }, [currentView, refreshState]);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white font-black uppercase tracking-tighter">
        <div className="w-full max-w-[420px] p-10 md:p-14 bg-slate-900/60 border border-white/10 rounded-[3rem] backdrop-blur-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col items-center gap-10 ring-1 ring-white/5 relative overflow-hidden font-black">
            <div className="p-6 bg-white/5 rounded-full ring-2 ring-white/10 shadow-inner relative font-black"><Lock size={36} className="text-[#fbbf24] animate-pulse-fast font-black" /></div>
            <div className="w-full space-y-6 relative z-10 font-black">
                <div className="text-center space-y-1 font-black"><h2 className="text-3xl font-black tracking-[0.3em] text-white font-black">ELITE ARENA</h2><p className="text-[9px] text-white/30 tracking-[0.5em] font-black uppercase">SYSTEM ACCESS REQUIRED</p></div>
                <div className="space-y-3 font-black">
                  <label className="text-[10px] text-white/40 block ml-2 tracking-widest font-black uppercase">AUTHENTICATION PASSCODE</label>
                  <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-black/40 border border-white/10 p-6 rounded-[1.5rem] text-center tracking-[0.6em] text-[#fbbf24] outline-none text-2xl font-black focus:border-[#fbbf24]/50 transition-all shadow-inner uppercase"/>
                </div>
            </div>
            <button onClick={handleLogin} className="w-full p-6 bg-gradient-to-r from-amber-400 to-amber-600 text-black rounded-[1.5rem] hover:scale-[1.03] active:scale-95 font-black text-lg transition-all shadow-[0_15px_30px_rgba(251,191,36,0.2)] uppercase relative z-10">INITIATE SESSION</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white font-black uppercase overflow-hidden font-black">
        <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-white/10 p-6 md:p-10 flex flex-row md:flex-col gap-5 bg-black/40 shrink-0 relative font-black">
            <h2 className="text-[#fbbf24] tracking-widest hidden md:flex items-center gap-3 mb-6 font-black text-xl uppercase"><Shield size={28}/> COMMAND</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-4 rounded-2xl text-xs md:text-sm transition-all font-black flex items-center gap-3 ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-white/30 hover:text-white hover:bg-white/10'} font-black uppercase`}><Users size={18}/> PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-4 rounded-2xl text-xs md:text-sm transition-all font-black flex items-center gap-3 ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-white/30 hover:text-white hover:bg-white/10'} font-black uppercase`}><Cpu size={18}/> TABLES</button>
            <button onClick={refreshState} className="flex-1 md:flex-none p-4 rounded-2xl text-xs bg-white/5 text-cyan-400 font-black flex items-center gap-3 hover:bg-cyan-400/10 uppercase"><RefreshCcw size={18}/> SYNC ENGINE</button>
            
            <div className="hidden md:flex flex-col mt-auto gap-3">
              <button onClick={handleNuclear} className={`w-full p-5 rounded-2xl items-center justify-center gap-3 border-2 transition-all font-black flex ${nuclearConfirm ? 'bg-red-600 border-white text-white animate-pulse' : 'bg-red-950/20 border-red-500/50 text-red-500 hover:bg-red-500'}`}>{nuclearConfirm ? <Bomb size={24}/> : <ShieldAlert size={24}/>}<span>{nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</span></button>
              <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white/20 hover:text-white text-xs flex items-center justify-center gap-2 font-black transition-all uppercase"><ArrowLeft size={16}/> RETURN</button>
            </div>
        </aside>
        <main className="flex-1 p-8 md:p-16 overflow-y-auto bg-[#080a0f] relative font-black uppercase">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-10 animate-in fade-in duration-500">
                    <h3 className="text-2xl md:text-3xl tracking-[0.2em] border-l-4 border-[#fbbf24] pl-6 font-black uppercase">REGISTRY CONTROL</h3>
                    <div className="bg-slate-900/50 p-6 md:p-8 rounded-[2rem] grid grid-cols-1 md:grid-cols-3 gap-6 border border-white/5 shadow-2xl">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="PLAYER NAME" className="w-full bg-black/60 p-5 rounded-2xl border border-white/5 outline-none focus:border-[#fbbf24] font-black uppercase shadow-inner"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASSCODE" className="w-full bg-black/60 p-5 rounded-2xl border border-white/5 outline-none focus:border-[#fbbf24] font-black uppercase shadow-inner"/>
                        <button onClick={()=>socket.emit('adminCreatePlayer', {...newPlayer, uid: Math.random().toString(36).slice(2)})} className="w-full h-[62px] bg-[#fbbf24] text-black rounded-2xl font-black p-4 transition-all uppercase hover:brightness-110">COMMIT USER</button>
                    </div>
                    <div className="bg-slate-900/40 rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl">
                        {(allProfiles || []).map((p, idx) => (
                            <div key={p.uid} className={`flex justify-between items-center p-5 md:p-7 hover:bg-white/5 transition-all group ${idx !== (allProfiles?.length || 0) -1 ? 'border-b border-white/5' : ''}`}>
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 transition-all"><User size={24} className="text-white/20" /></div>
                                    <div className="flex flex-col"><span className="uppercase text-lg font-black">{String(p.name)}</span><span className="text-white/20 text-[10px] tracking-widest font-black uppercase">TOKEN: {String(p.password)}</span></div>
                                </div>
                                <div className="flex gap-6 items-center">
                                    <div className="flex flex-col items-end"><span className="text-[10px] text-emerald-500/40 font-black tracking-widest mb-0.5 uppercase">BALANCE</span><span className="text-emerald-400 font-mono text-xl md:text-2xl font-black tracking-tighter">${Number(p.chips || 0).toLocaleString()}</span></div>
                                    <div className="flex gap-2">
                                      <button onClick={()=>adminEditChips(p.uid, p.chips)} className="p-3 bg-white/5 rounded-xl text-cyan-400 hover:bg-cyan-400 hover:text-black transition-all"><Edit3 size={18}/></button>
                                      <button onClick={()=>adminDeletePlayer(p.uid)} className="p-3 bg-white/5 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-10 animate-in fade-in duration-500 font-black uppercase">
                    <h3 className="text-2xl md:text-3xl tracking-[0.2em] border-l-4 border-emerald-500 pl-6 font-black uppercase">ARENA DEPLOYMENT</h3>
                    <div className="bg-slate-900/50 p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-6 relative overflow-hidden font-black">
                        <div className="col-span-full md:col-span-1 space-y-2"><label className="text-[9px] text-white/40 tracking-widest pl-2 uppercase font-black">INSTANCE IDENTIFIER</label><input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="w-full bg-black/60 p-5 rounded-2xl border border-white/5 outline-none focus:border-emerald-500/50 font-black uppercase shadow-inner"/></div>
                        <div className="grid grid-cols-4 gap-3 font-black">
                            <div className="space-y-2"><span className="text-[9px] text-white/40 font-black uppercase tracking-widest ml-1">SB</span><input value={newTable.sb} type="number" className="w-full bg-black/60 p-4 rounded-xl border border-white/5 font-black outline-none text-center" onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})}/></div>
                            <div className="space-y-2"><span className="text-[9px] text-white/40 font-black uppercase tracking-widest ml-1">BB</span><input value={newTable.bb} type="number" className="w-full bg-black/60 p-4 rounded-xl border border-white/5 font-black outline-none text-center" onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})}/></div>
                            <div className="space-y-2"><span className="text-[9px] text-white/40 font-black uppercase tracking-widest ml-1">MIN</span><input value={newTable.minBuy} type="number" className="w-full bg-black/60 p-4 rounded-xl border border-white/5 font-black outline-none text-center" onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})}/></div>
                            <div className="space-y-2"><span className="text-[9px] text-white/40 font-black uppercase tracking-widest ml-1">MAX</span><input value={newTable.maxBuy} type="number" className="w-full bg-black/60 p-4 rounded-xl border border-white/5 font-black outline-none text-center" onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})}/></div>
                        </div>
                        <button onClick={handleSpawnArena} className="col-span-full bg-emerald-600 rounded-2xl font-black p-5 uppercase transition-all shadow-xl hover:brightness-110 font-black">INITIALIZE ARENA INSTANCE</button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {(activeTables || []).map(t => (
                            <div key={t.id} className="bg-slate-900/40 p-6 md:p-8 rounded-[2rem] flex justify-between items-center border border-white/5 hover:border-emerald-500/40 transition-all shadow-xl font-black uppercase">
                                <div className="flex items-center gap-6 font-black"><div className="w-14 h-14 bg-emerald-500/5 rounded-2xl flex items-center justify-center border border-emerald-500/20 transition-all"><LayoutGrid size={28} className="text-emerald-500/40" /></div><div className="flex flex-col"><h4 className="text-[#fbbf24] text-xl font-black uppercase tracking-tighter truncate max-w-[150px]">{String(t.name)}</h4><p className="text-[10px] text-white/30 tracking-[0.2em] uppercase font-black font-mono">STAKES: ${t.sb}/${t.bb}</p></div></div>
                                <div className="flex items-center gap-6 font-black"><div className="flex flex-col items-end font-black"><span className="text-[9px] text-white/20 font-black uppercase mb-0.5">CAPACITY</span><span className="text-white/60 font-black text-xl font-black">{t.players?.filter(Boolean).length || 0}<span className="text-white/20 font-black">/10</span></span></div><button onClick={()=>adminDeleteRoom(t.id)} className="p-4 bg-red-950/20 border border-red-500/20 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20}/></button></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div className="h-screen bg-[#06080c] flex flex-col text-white font-black uppercase overflow-hidden font-black">
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-in fade-in duration-500 px-6 font-black uppercase">
                <div className="w-full max-w-[420px] p-10 md:p-14 bg-slate-900 border border-white/10 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,1)] flex flex-col gap-10 ring-1 ring-white/5 font-black">
                    <div className="space-y-2 text-center font-black uppercase"><h3 className="text-3xl md:text-4xl text-[#fbbf24] tracking-tighter uppercase font-black leading-tight italic font-black">{String(selectedTableForJoin.name)}</h3><div className="h-1 w-20 bg-emerald-500 mx-auto rounded-full font-black" /></div>
                    <div className="space-y-8 font-black text-center uppercase p-6 bg-black/40 rounded-[2rem] border border-white/5 shadow-inner">
                        <div className="flex justify-between items-center text-[10px] text-white/40 tracking-[0.3em] font-black uppercase border-b border-white/5 pb-4 font-black"><span>BUY-IN AMOUNT</span><span className="text-emerald-400 text-2xl md:text-3xl font-mono tracking-tighter font-black">${buyInAmount.toLocaleString()}</span></div>
                        <input type="range" min={selectedTableForJoin.minBuy || 400} max={selectedTableForJoin.maxBuy || 2000} step={100} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#fbbf24] shadow-xl font-black" />
                    </div>
                    <div className="flex gap-4 font-black"><button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all font-black uppercase tracking-widest text-xs">BACK</button><button onClick={joinRoom} className="flex-[2] p-6 bg-emerald-600 rounded-3xl shadow-[0_15px_30px_rgba(5,150,105,0.2)] hover:brightness-110 active:scale-95 transition-all text-sm tracking-[0.2em] font-black uppercase">SIT DOWN</button></div>
                </div>
            </div>
        )}
        <header className="h-24 border-b border-white/10 flex items-center justify-between px-8 md:px-16 bg-[#0a0c12]/80 backdrop-blur-xl shadow-2xl z-50 shrink-0 border-t-2 border-t-amber-500/20 font-black">
            <div className="flex items-center gap-6 font-black"><div className="w-12 h-12 bg-[#fbbf24]/10 rounded-2xl flex items-center justify-center border border-[#fbbf24]/30 shadow-[0_0_20px_rgba(251,191,36,0.1)] font-black"><Crown className="text-[#fbbf24]" size={28}/></div><h2 className="tracking-[0.4em] text-xl font-black flex items-center gap-4 italic uppercase">ARENA LOBBY</h2></div>
            <div className="flex items-center gap-8 md:gap-14 font-black"><div className="flex flex-col items-end uppercase group cursor-pointer font-black"><span className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-black mb-1">IDENTIFIED: {String(userProfile?.name || "??")}</span><span className="text-emerald-400 font-mono text-2xl md:text-4xl tracking-tighter font-black drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">${Number(userProfile?.chips || 0).toLocaleString()}</span></div><button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="p-3 bg-white/5 rounded-2xl text-white/20 hover:text-red-500 transition-all border border-white/5 font-black uppercase"><LogOut size={28}/></button></div>
        </header>
        <main className="flex-1 p-8 md:p-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 overflow-y-auto bg-gradient-to-br from-[#06080c] via-[#080a12] to-[#0d111a] font-black uppercase font-black">
            {(activeTables || []).map((t) => (
                <div key={t.id} className="group p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] flex flex-col gap-8 shadow-2xl hover:border-[#fbbf24]/30 hover:bg-slate-900/60 transition-all relative overflow-hidden font-black">
                    <div className="flex justify-between items-start relative z-10 font-black"><div className="space-y-1 font-black"><h3 className="text-2xl md:text-3xl tracking-tighter text-white font-black group-hover:text-[#fbbf24] transition-colors uppercase italic">{String(t.name)}</h3><div className="flex items-center gap-2 font-black"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_emerald]" /><span className="text-[9px] text-white/30 tracking-widest uppercase font-black">ACTIVE INSTANCE</span></div></div><div className="p-3 bg-white/5 rounded-2xl border border-white/5 font-black"><FastForward size={20} className="text-white/20 group-hover:text-white" /></div></div>
                    <div className="bg-black/40 p-6 md:p-8 rounded-[2rem] flex justify-between items-center border border-white/5 shadow-inner relative z-10 font-black"><div className="flex flex-col gap-1 font-black"><span className="text-[9px] text-white/20 tracking-[0.3em] font-black uppercase">STAKES</span><span className="text-[#fbbf24] text-xl md:text-2xl font-black">${t.sb}/${t.bb}</span></div><div className="h-10 w-[1px] bg-white/10 font-black" /><div className="flex flex-col items-end gap-1 font-black"><span className="text-[9px] text-white/20 tracking-[0.3em] font-black uppercase">POPULATION</span><span className="text-white/80 font-mono text-lg md:text-xl font-black tracking-tighter">{t.players?.filter(p=>p).length || 0}<span className="text-white/20">/10</span></span></div></div>
                    <button onClick={()=>setSelectedTableForJoin(t)} className="w-full p-6 md:p-8 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-[1.5rem] tracking-[0.3em] shadow-xl hover:translate-y-[-4px] transition-all font-black uppercase text-sm">ENTER ARENA</button>
                </div>
            ))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter font-executive font-black">
      <UIOverlay isOpen={showRules} onClose={() => setShowRules(false)} title="ARENA PROTOCOL" icon={BookOpen}>
        <div className="space-y-6 font-black uppercase"><div className="bg-white/5 p-6 rounded-3xl border border-white/5 shadow-inner font-black uppercase"><div className="text-[#fbbf24] text-[10px] tracking-[0.3em] mb-2 font-black uppercase">CURRENT VARIANT: {activeVariant.name}</div><div className="text-sm md:text-lg leading-relaxed text-white/90 font-black italic tracking-wide">{VARIANT_RULES[activeVariant.id] || "Rules coming soon..."}</div></div></div>
      </UIOverlay>
      <header style={{ height: `${headerHeight}px` }} className="bg-[#0a0a0a]/90 border-b border-white/10 flex items-center justify-between px-6 md:px-10 z-[80] shadow-2xl backdrop-blur-3xl shrink-0 font-black uppercase"><div className="flex items-center gap-4 font-black"><button onClick={() => setShowRules(true)} className="bg-white/5 px-4 py-2 rounded-2xl border border-white/10 shadow-inner flex items-center gap-3 font-black"><Info size={14} className="text-[#fbbf24]" /><span className="text-white text-[10px] md:text-xs font-black underline decoration-dashed decoration-[#fbbf24]/40">{String(activeVariant.name)}</span></button><button onClick={() => setShowLayoutControls(!showLayoutControls)} className={`p-2.5 rounded-xl transition-all ${showLayoutControls ? 'bg-[#fbbf24] text-black shadow-xl' : 'bg-white/5 text-white/30'}`}><Sliders size={20}/></button></div><div className="flex items-center gap-6 font-black"><div className="bg-white/5 border border-white/10 px-5 py-2 rounded-2xl flex items-center gap-5 font-black uppercase"><span className="hidden sm:inline text-white/30 text-[10px] tracking-[0.2em] font-black uppercase">DEALER CHOICE:</span><select value={pendingVariantId} onChange={(e) => {setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value})}} className="bg-transparent text-[#fbbf24] outline-none text-xs font-black uppercase cursor-pointer">{Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900 font-black">{v.name.toUpperCase()}</option>)}</select></div><div className="flex gap-3 font-black"><button onClick={()=>socket.emit('adminAddBot', {roomId: currentRoomId})} className="text-indigo-400 p-2.5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase hover:bg-indigo-400 hover:text-black transition-all"><Bot size={22}/></button><button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2.5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase hover:bg-red-500 hover:text-white transition-all"><LogOut size={22}/></button></div></div></header>
      <main className="flex-1 flex flex-col items-center justify-center relative bg-[#010a08] overflow-hidden px-4 py-4 font-black">
        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 20}px)` }} className="relative w-full max-w-[1450px] aspect-[21/10] flex items-center justify-center h-full transition-all duration-700 ease-out origin-center font-black">
            <div className="absolute inset-0 bg-[#121212] rounded-[50%] border-[2.8vw] border-[#1a110a] shadow-[0_40px_100px_rgba(0,0,0,1)] ring-[1px] ring-white/10 font-black" />
            <div className="absolute inset-[3.2vw] bg-[#0c3125] rounded-[50%] shadow-[inset_0_0_80px_rgba(0,0,0,0.9)] overflow-hidden font-black"><div className="absolute inset-0 bg-felt-texture opacity-20 font-black" /></div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 font-black"><span className="text-[13vw] font-black text-white/5 italic uppercase select-none rotate-[-6deg] font-black">{activeVariant.name}</span></div>
            <div className="absolute inset-0 pointer-events-none z-20 font-black uppercase font-black">{(players || []).map((p, i) => { if (!p) return null; const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; return (<Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} strengthLabel={p.strength} isCollectingBets={isCollectingBets} timeRemaining={timeRemaining} isHero={i === heroIdx} hiLowAwards={hiLowAwards} cardScale={heroCardScale} relativeIdx={rIdx} />); })}</div>
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center font-black">{!potTransferring && (<div className={`flex flex-col items-center transition-all duration-700 ${potAnimating ? 'scale-110' : 'scale-100'} font-black`}><div className={`text-[6.5vw] md:text-[5.5vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-2xl ${potAnimating ? 'animate-pot-pulse' : ''} font-black`}>${Number(totalDisplayPot || 0).toLocaleString()}</div><div className="h-2.5 w-48 bg-white/5 rounded-full mt-2 overflow-hidden border border-white/5 font-black"><div className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 animate-shimmer rounded-full font-black" style={{ width: '100%' }} /></div></div>)}<div className="flex gap-3 md:gap-5 scale-[1.1] md:scale-[1.85] mt-8 md:mt-16 font-black uppercase">{(community || []).map((c, j) => (<div key={c.id || j} className={`w-[6vw] md:w-[3.6vw] h-[9vw] md:h-[5.6vw] rounded-xl border-2 bg-gradient-to-tr from-white to-slate-200 flex flex-col items-center justify-center text-slate-900 font-black transition-all duration-700 shadow-2xl ${winning5Ids?.includes(c.id) ? 'ring-[5px] ring-yellow-400 scale-110' : 'border-white/10'}`}><span className="text-[13px] md:text-[15px] font-black tracking-tighter">{String(c.value)}</span><span className="text-[18px] md:text-[22px] mt-1"><CardSymbol suit={c.suit} /></span></div>))}</div></div>
        </div>
      </main>
      <footer style={{ height: `${footerHeight}px` }} className="bg-[#080a12]/95 backdrop-blur-3xl border-t border-white/10 flex z-[100] shadow-2xl shrink-0 font-black uppercase overflow-hidden font-black">
        <div className="hidden lg:flex w-[32%] border-r border-white/10 p-5 flex-col overflow-hidden text-[10px] font-mono tracking-[0.2em] font-black uppercase font-black"><div className="text-white/40 mb-3 flex items-center justify-between border-b border-white/5 pb-3 px-2 font-black uppercase"><div className="flex items-center gap-3 font-black"><Eye size={16} className="text-[#fbbf24]"/> ACTIVITY STREAM</div></div><div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide font-black font-black">{(logs || []).map(l => (<div key={l.id} className="animate-in slide-in-from-left duration-300 flex items-center gap-4 border-l-2 border-white/5 pl-4 py-2 hover:bg-white/5 transition-all border-b border-white/5 font-black uppercase"><span className="text-white/10 text-[8px] font-black shrink-0 w-12 font-mono">{String(l.time)}</span><div className="flex items-center gap-x-3 font-black uppercase"><span className={`font-black uppercase text-[10px] px-2 py-1 rounded-md ${l.type === 'win' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-[#fbbf24]'} font-black`}>{String(l.name)}</span><span className="text-white/50 lowercase tracking-tight text-[10px] font-black truncate max-w-[150px] font-black">{String(l.action)}</span></div></div>))}</div></div>
        <div className="flex-1 flex flex-col justify-between relative bg-gradient-to-t from-black to-white/5 py-5 px-6 md:px-12 font-black uppercase font-black">
          {activeIdx === heroIdx && phase !== PHASES.SHOWDOWN && phase !== PHASES.IDLE && heroPlayerObj ? (
            <div className="flex flex-col h-full justify-between animate-in slide-in-from-bottom-6 duration-700 font-black">
               <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-2xl rounded-[2.5rem] p-4 border border-white/10 font-black shadow-2xl">
                  <div className="flex items-center gap-6 font-black"><div className="w-12 h-12 bg-purple-600/10 rounded-2xl flex items-center justify-center font-black border border-purple-500/30"><Activity size={24} className="text-purple-400" /></div><div className="flex flex-col font-black"><span className="text-[9px] text-white/30 tracking-[0.4em] font-black uppercase font-black">ESTIMATED STRENGTH</span><span className="text-lg text-purple-200 font-black uppercase italic font-black">{heroPlayerObj.strength || "CALCULATING..."}</span></div></div>
                  <div className="flex flex-col items-end font-black"><span className="text-[9px] text-white/30 tracking-[0.4em] font-black uppercase font-black">EQUITY INDEX</span><div className="flex items-center gap-4 font-black"><div className="w-32 h-2 bg-black/40 rounded-full overflow-hidden border border-white/10 font-black shadow-inner"><div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000 font-black shadow-[0_0_10px_cyan]" style={{ width: `${heroPlayerObj.winProbability || 0}%` }} /></div><span className="text-2xl text-cyan-400 font-mono font-black">{Math.round(heroPlayerObj.winProbability || 0)}%</span></div></div>
               </div>
               <div className="grid grid-cols-12 gap-5 h-20 md:h-24 font-black uppercase"><button onClick={()=>handleAction('FOLD')} className="col-span-3 bg-red-950/20 border-2 border-red-500/30 rounded-[2rem] flex flex-col items-center justify-center font-black uppercase hover:bg-red-600 transition-all active:scale-95"><X size={24} className="text-red-500 mb-1" /><span className="text-[11px] font-black text-red-500 uppercase group-hover:text-white">FOLD</span></button><button onClick={()=>handleAction('CALL')} className="col-span-5 bg-gradient-to-b from-indigo-500 to-indigo-700 border-2 border-indigo-400 rounded-[2rem] flex flex-col items-center justify-center font-black uppercase shadow-xl hover:brightness-110 active:scale-95"><span className="text-xl md:text-3xl font-black italic uppercase leading-none">{highestBet > heroPlayerObj.currentBet ? 'CALL' : 'CHECK'}</span><span className="text-[11px] font-mono opacity-60 font-black">{highestBet > heroPlayerObj.currentBet ? `$${(highestBet - heroPlayerObj.currentBet).toLocaleString()}` : 'SYNC ACTION'}</span></button><div className="col-span-4 bg-slate-900/60 border-2 border-emerald-500/30 rounded-[2rem] flex flex-col overflow-hidden font-black shadow-xl"><div className="flex-1 flex items-center justify-center px-4 font-black"><span className="text-emerald-500 text-lg mr-2 font-black italic uppercase font-black">$</span><input type="number" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(heroPlayerObj.chips + heroPlayerObj.currentBet, Math.max(minRaiseAllowed, Number(e.target.value))))} className="w-full bg-transparent text-center font-mono text-xl text-white outline-none font-black uppercase" /></div><button onClick={()=>handleAction('RAISE', raiseInput)} className="h-10 bg-emerald-600 flex items-center justify-center hover:bg-emerald-500 transition-all font-black uppercase"><Zap size={18} className="text-white mr-3 animate-pulse"/><span className="text-[11px] font-black uppercase">EXECUTE RAISE</span></button></div></div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase font-black">
               <span className="text-white/20 text-[10px] tracking-[0.3em] font-black uppercase font-black mb-1">AWAITING DECISION</span>
               <span className="text-3xl md:text-5xl font-black text-white tracking-widest uppercase italic font-black">{players[activeIdx]?.name || "SYSTEM"}</span>
               <div className="flex gap-3 mt-6">
                  {[0, 1, 2].map(i => <div key={i} className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce shadow-[0_0_15px_rgba(34,211,238,0.7)]" style={{ animationDelay: `${i * 0.25}s` }} />)}
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
          @keyframes fling-to-pot { 0% { transform: translate(calc(-50% + var(--bx, 0px)), var(--by, 0px)) scale(1.2); opacity: 1; } 100% { transform: translate(0, -30vh) scale(0.1) rotate(720deg); opacity: 0; } }
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
