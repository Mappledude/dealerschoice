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

const VERSION = "v1.7.29-PRO";
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
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', rules: ["2 Hole Cards", "Standard High Hand"] }, 
  OMAHA: { id: 'OMAHA', name: 'Omaha', rules: ["4 Hole Cards", "Exactly 2 Hole + 3 Board"] }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', rules: ["3 Hole Cards", "Standard High Hand"] }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', rules: ["Weakest hand wins", "Ace is 1"] }, 
  HILOW: { id: 'HILOW', name: 'Hi-Low Split', rules: ["4 Hole Cards", "Split Pot (High & Low Winner)"] }, 
  REDSBLACKS: { id: 'REDSBLACKS', name: 'Reds & Blacks', rules: ["4 Hole Cards", "Dynamic Joker Mechanic"] }
};

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  isDealer, potTransferring, timeRemaining, isHero, 
  relativeIdx, seatIdx, visuals, showdownWinnersCount, isDefaultWin
}) => {
    if (!player || !displayPos) return null;
    const isRevealed = isHero || (phase === PHASES.SHOWDOWN && !isDefaultWin);
    const currentCardScale = isHero ? visuals.heroCardScale : visuals.oppCardScale;
    const currentCardY = isHero ? visuals.heroCardY : visuals.oppCardY;

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'}`}>
            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-700 ${isCollectingBets ? 'animate-fling-to-pot' : 'animate-bet-splash'}`}
                    style={{ transform: `translate(calc(-50% + ${BET_OFFSETS[relativeIdx].x}px), ${BET_OFFSETS[relativeIdx].y + visuals.betY}px) scale(${visuals.betScale})`, left: '50%', top: '50%' }}>
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-black text-[9px] px-2 py-0.5 rounded-full border border-white/30 flex items-center gap-1 shadow-lg font-black tracking-tight">${Number(player.currentBet).toFixed(2)}</div>
                </div>
            )}
            <div style={{ transform: `translateY(${visuals.badgeY}px)` }}
                className={`relative z-50 flex flex-col items-center p-1 rounded-xl border bg-slate-900/95 backdrop-blur-md transition-all duration-300 min-w-[84px] md:min-w-[180px] shadow-2xl ${isActiveTurn ? 'border-cyan-400 ring-2 ring-cyan-400/40 scale-105' : 'border-white/10'} ${player.isWinner && phase === PHASES.SHOWDOWN ? 'border-yellow-400 animate-pulse-glow' : ''}`}>
                {isDealer && ( <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-[0_0_12px_rgba(220,38,38,0.9)] animate-pulse z-[110]" /> )}
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="absolute -top-1 w-full px-1.5 h-1 z-[60]">
                        <div className="w-full h-full bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400 transition-all duration-1000 linear" style={{ width: `${(timeRemaining / 15) * 100}%` }} />
                        </div>
                    </div>
                )}
                <div className="flex flex-col items-center w-full p-1">
                    <span className="text-[8.5px] md:text-[14.5px] font-black text-white/90 uppercase truncate max-w-[100px] tracking-tight">{String(player.name)}</span>
                    <span className={`text-[11px] md:text-[17px] font-mono font-black text-emerald-400`}>${Number(player.chips).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
            </div>
            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative z-10 flex items-center justify-center w-[12vw] h-[6vw] mt-4">
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const fanTranslation = (ci - mid) * (player.hand.length > 2 ? 2.0 : 3.5);
                        const isRed = c.suit === '♥' || c.suit === '♦';
                        return (
                          <div key={c.id || `card-${player.uid}-${ci}`} 
                              className={`w-[5vw] md:w-[3vw] h-[7vw] md:h-[5vw] rounded-[3px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-300 ${isRevealed ? 'bg-white' : 'bg-slate-800'}`} 
                              style={{ transform: `translateX(${fanTranslation}vw) scale(${currentCardScale})`, top: `${currentCardY}px`, animationDelay: `${ci * 0.1}s` }}>
                              {isRevealed && ( <><span className={`text-[9px] md:text-[12px] font-black leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span><span className={`text-[11px] md:text-[16px] leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></> )}
                          </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const App = () => {
  // Core UI States
  const [currentView, setCurrentView] = useState(VIEWS.LOGIN);
  const [userProfile, setUserProfile] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState(10);

  // Gameplay Engine States
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dealerIdx, setDealerIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [currentShowdownIdx, setCurrentShowdownIdx] = useState(0);

  // Management States
  const [adminTab, setAdminTab] = useState(ADMIN_TABS.PLAYERS);
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editFormData, setEditFormData] = useState({ chips: 0, password: '' });
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 100, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10 });
  const [nuclearConfirm, setNuclearConfirm] = useState(false);

  // UX States
  const [logs, setLogs] = useState([]);
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [expandedHands, setExpandedHands] = useState(new Set()); 
  const [copySuccess, setCopySuccess] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Performance Refs
  const joinLock = useRef(false);
  const userProfileRef = useRef(null);
  const currentViewRef = useRef(null);

  const isMobile = window.innerWidth < 768;
  const visuals = {
    heroCardScale: 4.0, heroCardY: 22, oppCardScale: 1.0, oppCardY: -25,
    commCardScale: 1.8, commCardY: -7, betScale: 2.0, betY: 47,
    badgeY: 85, footerHeight: 270, tableZoom: isMobile ? 0.75 : 0.85
  };

  const heroIdx = useMemo(() => {
    if (!userProfile) return -1;
    return players.findIndex(p => p && p.uid === userProfile.uid);
  }, [players, userProfile]);

  const heroPlayerObj = heroIdx !== -1 ? players[heroIdx] : null;
  const isDefaultWin = showdownWinners?.length > 0 && showdownWinners.every(w => w.rank === "!");

  useEffect(() => { 
    userProfileRef.current = userProfile; 
    currentViewRef.current = currentView;
  }, [userProfile, currentView]);

  // RELIABILITY RECOVERY ENGINE: Bypasses hanging join requests if server has seated you
  useEffect(() => {
    if (userProfile && currentView === VIEWS.LOBBY) {
        const seatingFound = activeTables.find(t => t.players?.some(p => p && p.uid === userProfile.uid));
        if (seatingFound) {
            console.log("Seating Match Found via Registry Sync.");
            setCurrentRoomId(seatingFound.id);
            setCurrentView(VIEWS.GAME);
            joinLock.current = false;
            setIsJoining(false);
        }
    }
  }, [activeTables, userProfile, currentView]);

  // Auto-correct Buy-In amount based on table constraints
  useEffect(() => {
    if (selectedTableForJoin && userProfile) {
        const min = selectedTableForJoin.minBuy || 5;
        const max = Math.min(userProfile.chips || 100, selectedTableForJoin.maxBuy || 100);
        setBuyInAmount(Math.max(min, Math.min(buyInAmount, max)));
    }
  }, [selectedTableForJoin, userProfile]);

  const groupedLogs = useMemo(() => {
    const hands = [];
    let currentHand = { id: 'init', actions: [], summaries: [], variantName: 'Standard', isOngoing: true, winnerSummary: "..." };
    logs.forEach((l, idx) => {
      if (l.name === 'SYSTEM' && (l.action.includes('DEALING') || l.action.includes('START'))) {
          if (currentHand.actions.length > 0) hands.push(currentHand);
          currentHand = { id: `hand-log-${idx}-${Date.now()}`, actions: [l], summaries: [], variantName: l.action.split(' ').pop(), isOngoing: true, winnerSummary: "In Progress" };
      } else {
          currentHand.actions.push(l);
          if (l.type === 'win') currentHand.summaries.push(l);
      }
    });
    hands.push(currentHand);
    return hands.reverse();
  }, [logs]);

  const handleAction = (type, amt = 0) => {
    const val = amt !== 0 ? amt : raiseInput;
    socket.emit('playerAction', { roomId: currentRoomId, type, amount: Number(val) });
  };

  const handleLogin = useCallback(() => {
    if (passwordInput.toLowerCase().trim() === 'pass') {
      setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin', chips: 10000 });
      setCurrentView(VIEWS.ADMIN); // FIX: Ensure direct Admin transition
      socket.emit('getInitialData');
    } else {
      socket.emit('playerLogin', { password: passwordInput.toLowerCase() });
    }
  }, [passwordInput]);

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile || joinLock.current) return;
    joinLock.current = true;
    setIsJoining(true);
    
    const safety = setTimeout(() => { joinLock.current = false; setIsJoining(false); }, 4000);

    socket.emit('joinRoom', { 
        roomId: selectedTableForJoin.id, 
        profile: { ...userProfile, pendingVariant: pendingVariantId }, 
        buyIn: Number(buyInAmount)
    }, (res) => {
        clearTimeout(safety);
        if (res?.status === 'ok' || res?.message === 'ALREADY_SEATED') { 
            setCurrentRoomId(selectedTableForJoin.id); 
            setCurrentView(VIEWS.GAME); 
            setSelectedTableForJoin(null); 
        } else {
            console.error("Entry Denied:", res?.message);
        }
        joinLock.current = false;
        setIsJoining(false);
    });
  }, [selectedTableForJoin, userProfile, pendingVariantId, buyInAmount]);

  const handleCreatePlayer = useCallback(() => {
    if (!newPlayer.name) return;
    socket.emit('adminCreatePlayer', { ...newPlayer, password: newPlayer.password.toLowerCase(), uid: `player-${Math.random().toString(36).slice(2)}` });
    setNewPlayer({ name: '', chips: 100, password: '' });
  }, [newPlayer]);

  const handleSpawnArena = useCallback(() => {
    if (!newTable.name) return;
    socket.emit('adminCreateRoom', { ...newTable, id: 'room_' + Math.random().toString(36).slice(2, 9) });
    setNewTable({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10 });
  }, [newTable]);

  const handleUpdateProfile = () => {
      if (!editingProfile) return;
      socket.emit('adminUpdatePlayer', { uid: editingProfile.uid, chips: Number(editFormData.chips), password: editFormData.password.toLowerCase() });
      setEditingProfile(null);
  };

  const handleCopyLogs = useCallback(() => {
    const text = logs.map(l => `[${l.time}] ${l.name}: ${l.action}`).join('\n');
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try { document.execCommand('copy'); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); } catch (err) {}
    document.body.removeChild(textArea);
  }, [logs]);

  // One-time Socket Listeners Initialization
  useEffect(() => {
    const onRoomUpdate = (d) => {
        if (!d) return;
        setPlayers(() => { 
            const next = Array(10).fill(null); 
            (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
            return next; 
        });
        setPhase(d.phase); setCommunity(d.community || []); setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0);
        setActiveIdx(d.activeIdx ?? -1); setDealerIdx(d.dealerIdx ?? -1); setHighestBet(d.highestBet || 0);
        setTimeRemaining(d.timeRemaining || 0);
        if (d.activeVariant) setActiveVariant(VARIANTS[d.activeVariant.id] || VARIANTS.HOLDEM);
        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true); setCurrentShowdownIdx(0);
            const winners = [...(d.showdownWinners || [])];
            setShowdownWinners(winners);
            const isDef = winners.every(w => w.rank === "!");
            const totalDur = isDef ? 1500 : (d.activeVariant?.id === 'HILOW' ? 10000 : 5000);
            const stepDur = totalDur / Math.max(1, winners.length);
            for(let i=1; i<winners.length; i++) setTimeout(() => setCurrentShowdownIdx(i), i * stepDur);
            setTimeout(() => setPotTransferring(false), totalDur);
        }
    };
    
    socket.on('connect', () => setIsConnected(true));
    socket.on('roomUpdate', onRoomUpdate);
    socket.on('lobbyUpdate', setActiveTables);
    socket.on('profilesUpdate', (p) => {
        setAllProfiles(p);
        if (userProfileRef.current) {
            const match = p.find(prof => prof.uid === userProfileRef.current.uid);
            if (match) setUserProfile(match);
        }
    });
    socket.on('loginSuccess', (p) => { 
        if (currentViewRef.current === VIEWS.ADMIN) return; 
        setUserProfile(p); 
        setPendingVariantId(p.pendingVariant || 'HOLDEM'); 
        setCurrentView(VIEWS.LOBBY); 
        socket.emit('getInitialData'); 
    });
    socket.on('log', d => setLogs(prev => [...prev, { id: `log-${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), ...d }].slice(-100)));
    
    socket.emit('getInitialData');
    return () => {
        socket.off('connect');
        socket.off('roomUpdate');
        socket.off('lobbyUpdate');
        socket.off('profilesUpdate');
        socket.off('loginSuccess');
        socket.off('log');
    };
  }, []);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 uppercase font-black text-white">
        <div className="w-full max-w-[400px] p-10 bg-black/60 border border-white/10 rounded-3xl flex flex-col items-center gap-8 shadow-2xl">
            <Lock size={32} className="text-yellow-400" />
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-yellow-400 outline-none text-xl font-black"/>
            <button onClick={handleLogin} className="w-full p-6 bg-yellow-400 text-black rounded-2xl transition-transform active:scale-95 uppercase font-black">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white uppercase font-black overflow-hidden pt-[env(safe-area-inset-top)] relative">
        {editingProfile && (
            <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
                <div className="w-full max-w-[400px] bg-slate-900 border-2 border-cyan-500 rounded-3xl p-8 flex flex-col gap-6 shadow-[0_0_80px_rgba(34,211,238,0.2)]">
                    <h3 className="text-xl text-cyan-400 uppercase font-black text-center">Edit {editingProfile.name}</h3>
                    <div className="flex flex-col gap-4">
                        <input type="number" value={editFormData.chips} onChange={e=>setEditFormData({...editFormData, chips: e.target.value})} className="bg-black/40 p-4 rounded-xl text-yellow-400 outline-none border border-white/10 font-mono font-black"/>
                        <input type="text" value={editFormData.password} onChange={e=>setEditFormData({...editFormData, password: e.target.value})} placeholder="New Password" className="bg-black/40 p-4 rounded-xl outline-none border border-white/10 text-white font-black"/>
                    </div>
                    <button onClick={handleUpdateProfile} className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 rounded-2xl text-black transition-all font-black uppercase">SAVE CHANGES</button>
                    <button onClick={()=>setEditingProfile(null)} className="text-xs text-white/40 uppercase underline font-black">Cancel</button>
                </div>
            </div>
        )}
        <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-4 flex md:flex-col gap-2 bg-black/20 shrink-0">
            <h2 className="hidden md:block text-yellow-400 mb-4 px-2 tracking-widest text-center font-black">ADMIN PANEL</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-4 rounded-xl transition-colors font-black uppercase ${adminTab===ADMIN_TABS.PLAYERS ? 'bg-yellow-400 text-black' : 'bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-4 rounded-xl transition-colors font-black uppercase ${adminTab===ADMIN_TABS.TABLES ? 'bg-yellow-400 text-black' : 'bg-white/5'}`}>TABLES</button>
            <button onClick={() => { if(nuclearConfirm) { socket.emit('adminNuclearReset'); setNuclearConfirm(false); } else { setNuclearConfirm(true); setTimeout(()=>setNuclearConfirm(false), 3000); }}} className={`flex-1 md:flex-none p-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all font-black uppercase ${nuclearConfirm ? 'bg-red-600 border-white text-white' : 'bg-white/5 text-red-500 border-red-500/20'}`}>
                <Bomb size={14}/> {nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}
            </button>
            <button onClick={()=>setCurrentView(VIEWS.LOBBY)} className="p-4 rounded-xl bg-cyan-600 text-black transition-all font-black uppercase">LOBBY</button>
        </aside>
        <main className="flex-1 p-8 overflow-y-auto bg-black/40 font-black uppercase">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-6">
                    <h3 className="text-xl border-l-4 border-yellow-400 pl-4">Player Registry</h3>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm font-black"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm font-black"/>
                        <button onClick={handleCreatePlayer} className="bg-yellow-400 text-black rounded-xl font-black p-3 text-sm uppercase">CREATE</button>
                    </div>
                    <div className="flex flex-col gap-2">
                        {allProfiles.map(p => (
                            <div key={`prof-registry-${p.uid}`} className="flex justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                <span className="font-black uppercase">{p.name}</span>
                                <div className="flex gap-4 items-center">
                                    <span className="text-emerald-400 font-mono font-black">${Number(p.chips || 0).toLocaleString()}</span>
                                    <button onClick={()=>{setEditingProfile(p); setEditFormData({chips: p.chips, password: ''})}} className="text-cyan-400"><Edit3 size={16}/></button>
                                    <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    <h3 className="text-xl border-l-4 border-emerald-500 pl-4">Arena Control</h3>
                    <div className="flex flex-col gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 shadow-inner">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none uppercase text-white text-sm font-black"/>
                            <div className="flex gap-2">
                                <input type="number" step="0.05" value={newTable.sb} onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})} placeholder="SB" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none w-1/2 font-black"/>
                                <input type="number" step="0.05" value={newTable.bb} onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})} placeholder="BB" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none w-1/2 font-black"/>
                            </div>
                            <div className="flex gap-2">
                                <input type="number" value={newTable.minBuy} onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})} placeholder="MIN" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none w-1/2 font-black"/>
                                <input type="number" value={newTable.maxBuy} onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})} placeholder="MAX" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none w-1/2 font-black"/>
                            </div>
                        </div>
                        <button onClick={handleSpawnArena} className="bg-emerald-600 p-4 rounded-xl text-white font-black hover:bg-emerald-500 transition-all uppercase shadow-lg">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {activeTables.map(t => (
                            <div key={`arena-man-row-${t.id}`} className="bg-white/5 p-4 rounded-xl flex justify-between items-center border border-white/10 transition-colors hover:bg-white/10">
                              <div className="min-w-0">
                                <h4 className="text-yellow-400 font-black truncate uppercase">{t.name}</h4>
                                <p className="text-[10px] text-white/40 uppercase font-black font-mono tracking-tighter">${t.sb}/${t.bb} • Buy-in: ${t.minBuy}-${t.maxBuy}</p>
                              </div>
                              <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 px-4 py-2 rounded-xl text-red-500 font-black text-xs hover:bg-red-900 transition-colors shrink-0 uppercase">TERMINATE</button>
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
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
                <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-yellow-400/30 rounded-3xl flex flex-col gap-6 shadow-2xl">
                    <h3 className="text-xl text-yellow-400 uppercase text-center font-black">{selectedTableForJoin.name}</h3>
                    <div className="flex justify-between text-xs text-white/40 font-black uppercase"><span>Min Stake Required</span><span>${selectedTableForJoin.minBuy}</span></div>
                    <input type="range" min={selectedTableForJoin.minBuy || 5} max={Math.min(userProfile?.chips || 10, selectedTableForJoin.maxBuy || 100)} step={1} value={buyInAmount} onChange={e=>setBuyInAmount(Number(e.target.value))} className="w-full accent-yellow-400 cursor-pointer"/>
                    <div className="flex gap-4">
                        <button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-4 bg-white/5 rounded-xl border border-white/10 font-black uppercase">BACK</button>
                        <button onClick={joinRoom} disabled={isJoining} className={`flex-2 p-4 rounded-xl transition-all active:scale-95 font-black uppercase shadow-lg ${isJoining ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                            {isJoining ? 'JOINING...' : `SIT DOWN ($${buyInAmount})`}
                        </button>
                    </div>
                </div>
            </div>
        )}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 shrink-0">
            <h2 className="text-xl flex items-center gap-4 font-black"><LayoutGrid className="text-yellow-400"/> LOBBY</h2>
            <div className="flex items-center gap-4 md:gap-6">
                <div className="text-right"><div className="text-[10px] text-white/40 truncate max-w-[80px] font-black uppercase">{userProfile?.name}</div><div className="text-emerald-400 font-mono text-xs md:text-sm font-black">${Number(userProfile?.chips || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
                {userProfile?.role === 'admin' && <button onClick={()=>setCurrentView(VIEWS.ADMIN)} className="text-white/20 hover:text-white transition-colors"><Settings size={18}/></button>}
                <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={18}/></button>
            </div>
        </header>
        <main className="flex-1 p-4 overflow-y-auto pt-8 scroll-smooth pb-24">
            <div className="max-w-[1200px] mx-auto hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/10 text-white/40 text-[10px] tracking-[0.2em] font-black uppercase">
                <div className="md:col-span-3">Arena Name</div>
                <div className="md:col-span-2 text-center">Stakes</div>
                <div className="md:col-span-4 text-center">Seated Players</div>
                <div className="md:col-span-1 text-center">Seats</div>
                <div className="md:col-span-2"></div>
            </div>
            <div className="max-w-[1200px] mx-auto flex flex-col gap-2 mt-2 font-black uppercase">
                {activeTables.map(t => (
                    <div key={`lobby-entry-item-${t.id}`} className="bg-white/5 border border-white/5 rounded-xl md:rounded-2xl p-4 md:p-0 transition-all hover:bg-white/10 group shadow-lg">
                        <div className="hidden md:grid grid-cols-12 items-center gap-4 px-6 py-4">
                            <div className="md:col-span-3"><h3 className="text-lg text-white font-black truncate uppercase">{t.name}</h3></div>
                            <div className="md:col-span-2 text-center"><span className="text-yellow-400 font-black font-mono">${t.sb}/${t.bb}</span></div>
                            <div className="md:col-span-4 flex flex-wrap justify-center gap-1">
                                {t.players?.filter(p => p).map((p) => (
                                    <div key={`lobby-seated-p-${t.id}-${p.uid}`} className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                                        {p.isBot && <Bot size={10} className="text-indigo-400 shrink-0" />}
                                        <span className="text-[10px] text-white/80 font-black">{p.name}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="md:col-span-1 text-center font-mono text-white/80 font-black">{t.players?.filter(p=>p).length || 0}/10</div>
                            <div className="md:col-span-2"><button onClick={()=>setSelectedTableForJoin(t)} className="w-full py-3 bg-emerald-600 rounded-xl text-[10px] font-black hover:bg-emerald-500 transition-colors shadow-md">Enter Arena</button></div>
                        </div>
                        <div className="flex md:hidden flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex flex-col min-w-0 flex-1">
                                    <h3 className="text-[14px] text-white font-black truncate uppercase leading-tight font-black">{t.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-yellow-400 text-[10px] font-black font-mono">${t.sb}/${t.bb}</span>
                                        <span className="text-white/20">|</span>
                                        <span className="text-white/60 text-[10px] font-mono font-black">{t.players?.filter(p=>p).length || 0}/10 SEATS</span>
                                    </div>
                                </div>
                                <button onClick={()=>setSelectedTableForJoin(t)} className="px-6 py-3 bg-emerald-600 rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95 transition-transform shrink-0">ENTER</button>
                            </div>
                            <div className="flex flex-wrap gap-1 border-t border-white/5 pt-2">
                                {t.players?.filter(p => p).map((p) => (
                                    <div key={`lobby-seated-mobile-${t.id}-${p.uid}`} className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                                        {p.isBot && <Bot size={8} className="text-indigo-400 shrink-0" />}
                                        <span className="text-[8px] text-white/60 font-black">{p.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      <header className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4 h-16 shrink-0 z-50 shadow-xl">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
            <div className="bg-white/5 px-3 py-1 rounded-lg border border-white/10 flex flex-col min-w-[80px]">
                <span className="text-yellow-400 text-[8px] leading-none uppercase tracking-widest font-black">Variant</span>
                <span className="text-[10px] truncate font-black uppercase">{activeVariant?.name || 'Holdem'}</span>
            </div>
            <div className="bg-white/5 px-3 py-1 rounded-lg border border-white/10 flex flex-col min-w-[100px]">
                <span className="text-cyan-400 text-[8px] leading-none uppercase tracking-widest font-black">My Turn Choice</span>
                <select value={pendingVariantId} onChange={e=>{setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid:userProfile.uid, pendingVariant:e.target.value});}} className="bg-transparent outline-none text-[10px] cursor-pointer appearance-none font-black uppercase">
                    {Object.entries(VARIANTS).map(([k,v])=>(<option key={`opt-v-engine-${k}`} value={k} className="bg-slate-900">{v.name}</option>))}
                </select>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={()=>setIntelExpanded(!intelExpanded)} className={`${intelExpanded ? 'bg-indigo-600 text-white' : 'bg-white/5 text-yellow-400'} p-2 rounded-lg transition-colors`}><Eye size={18}/></button>
            <button onClick={()=>{socket.emit('leaveRoom',{uid:userProfile.uid}); setCurrentView(VIEWS.LOBBY);}} className="p-2 bg-white/5 rounded-lg text-red-500 hover:bg-red-950/20 transition-colors shadow-inner"><LogOut size={18}/></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-emerald-950/20 to-transparent">
        <div style={{ transform: `scale(${visuals.tableZoom})` }} className="relative w-full max-w-[1400px] aspect-[21/10] flex items-center justify-center origin-center">
            <div className="absolute inset-0 bg-[#0f3d2e]/40 rounded-[50%] border-[3vw] border-slate-900/60 shadow-[inset_0_0_15vw_rgba(0,0,0,0.8)]" />
            <div className="absolute inset-0 z-20 pointer-events-none">
              {(players || []).map((p, i) => { 
                  if (!p) return null; 
                  const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + 10) % 10; 
                  return (
                    <Seat 
                      key={`seat-pos-render-${p.uid || i}`} 
                      player={p} 
                      displayPos={DISPLAY_POSITIONS[rIdx]} 
                      phase={phase} 
                      winning5Ids={winning5Ids} 
                      isActiveTurn={activeIdx === i} 
                      isHero={i === heroIdx} 
                      relativeIdx={rIdx} 
                      seatIdx={i}
                      visuals={visuals} 
                      isDefaultWin={isDefaultWin} 
                      isDealer={dealerIdx === i}
                      timeRemaining={timeRemaining}
                      isCollectingBets={potTransferring}
                      showdownWinnersCount={showdownWinners?.length || 0}
                    />
                  ); 
              })}
            </div>
            <div className="absolute top-[48%] flex flex-col items-center z-30 w-full pointer-events-none">
              {!potTransferring && <div className="text-[5vw] font-mono text-yellow-400 drop-shadow-xl font-black tracking-tighter">${Number(potAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
              <div className="flex gap-2 mt-4" style={{ transform: `scale(${visuals.commCardScale})` }}>
                  {community.map((c, ci) => {
                      const isRed = c.suit === '♥' || c.suit === '♦';
                      return (
                        <div key={`comm-card-board-${c.id || ci}`} className={`w-[3vw] h-[5vw] rounded-[3px] bg-white border flex flex-col items-center justify-center transition-all ${winning5Ids.includes(c.id) ? 'ring-2 ring-yellow-400 scale-110 z-40 shadow-[0_0_20px_#fbbf24]' : 'border-black/10 shadow-lg'}`}>
                            <span className={`text-[1vw] font-black leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>{c.value}</span>
                            <span className={`text-[2vw] font-black leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>{c.suit}</span>
                        </div>
                      );
                  })}
              </div>
            </div>
        </div>
      </main>

      <footer style={{ height: visuals.footerHeight }} className="bg-black/95 border-t border-white/10 flex flex-col z-[100] relative shadow-2xl overflow-visible">
        <div className="flex-1 p-4 relative overflow-hidden flex flex-col items-center justify-center font-black">
          {phase === PHASES.SHOWDOWN && showdownWinners ? (
            <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-500">
                <div className="text-yellow-400 text-xl md:text-3xl mb-4 text-center tracking-widest drop-shadow-md font-black uppercase">
                    {(() => {
                        const w = showdownWinners[currentShowdownIdx];
                        if(!w) return "";
                        if(w.rank === "!") return `${w.name} wins the pot!`;
                        const label = w.rank.startsWith("LOW") ? "low game" : (w.rank.startsWith("HIGH") ? "high game" : "hand");
                        return `${w.name} wins the ${label} with ${w.rank.replace(/^(HIGH:|LOW:)\s*/i, '')}!`;
                    })()}
                </div>
                <div className="flex items-center bg-black/60 p-6 rounded-3xl border-2 border-yellow-400/40 gap-8 shadow-2xl">
                    <div className="flex flex-col items-center shrink-0">
                        <div className="text-2xl font-black uppercase text-white">{showdownWinners[currentShowdownIdx]?.name}</div>
                        <div className="text-emerald-400 text-3xl font-mono font-black">+${Number(showdownWinners[currentShowdownIdx]?.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                    {showdownWinners[currentShowdownIdx]?.rank === "!" ? (
                        <div className="p-4 bg-yellow-500/10 rounded-full shadow-inner"><Coins size={64} className="text-yellow-400 animate-bounce" /></div>
                    ) : (
                        <div className="flex gap-2">
                            {(showdownWinners[currentShowdownIdx]?.hand || []).map((c, ci) => {
                                const isR = c.suit === '♥' || c.suit === '♦';
                                return (
                                    <div key={`winner-reveal-c-${c.id || ci}`} className="w-16 h-24 bg-white rounded-xl flex flex-col items-center justify-center shadow-xl animate-showdown-pop" style={{ animationDelay: `${ci * 0.1}s` }}>
                                        <span className={`text-xl font-black ${isR ? 'text-red-600' : 'text-black'}`}>{c.value}</span>
                                        <span className={`text-3xl ${isR ? 'text-red-600' : 'text-black'}`}>{c.suit}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
          ) : (
            <div className={`flex flex-col gap-4 items-center w-full transition-all duration-500 ${activeIdx !== heroIdx ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                {!heroPlayerObj?.isFolded && phase !== PHASES.IDLE ? (<>
                    <div className="flex gap-2 w-full max-w-[600px]">
                        <button onClick={()=>handleAction('FOLD')} className="flex-1 h-14 bg-red-950/60 border border-red-500/50 rounded-xl font-black hover:bg-red-900 transition-colors uppercase shadow-lg">FOLD</button>
                        <button onClick={()=>handleAction('CALL')} className="flex-1 h-14 bg-indigo-900/60 border border-indigo-400/50 rounded-xl font-black hover:bg-indigo-800 transition-colors uppercase shadow-lg">
                            {highestBet > (heroPlayerObj?.currentBet || 0) ? `CALL $${(highestBet - heroPlayerObj.currentBet).toFixed(2)}` : 'CHECK'}
                        </button>
                        <div className="flex-[2] flex gap-2 items-center bg-black/40 border border-white/10 p-1.5 rounded-xl shadow-inner">
                            <input type="number" step="0.25" value={raiseInput} onChange={(e) => setRaiseInput(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full bg-transparent text-center text-yellow-400 text-2xl font-mono outline-none font-black"/>
                            <button onClick={()=>handleAction('RAISE', raiseInput)} className="bg-emerald-600 hover:bg-emerald-500 px-6 h-full rounded-lg font-black shadow-lg transition-all active:scale-95 uppercase">RAISE</button>
                        </div>
                    </div>
                    <div className="flex justify-between w-full max-w-[600px] text-[10px] tracking-widest font-black uppercase">
                        <div className="flex flex-col font-black"><span className="text-white/40 uppercase">Low Potential</span><span className="text-emerald-400 font-black">{heroPlayerObj?.lowStrength || '---'}</span></div>
                        <div className="flex flex-col items-end font-black"><span className="text-white/40 uppercase">High Potential</span><span className="text-purple-400 font-black">{heroPlayerObj?.strength || '---'}</span></div>
                    </div>
                </>) : (<div className="py-10 text-white/20 italic tracking-[0.4em] uppercase font-black text-center font-black">Syncing Session / Calculating Hands</div>)}
            </div>
          )}
        </div>
      </footer>
      <style>{`
          @keyframes fling-to-pot { 0% { transform: translate(calc(-50% + 0px), 0px) scale(2.0); } 100% { transform: translate(calc(-50% + 10px), -45vh) scale(0); opacity: 0; } }
          @keyframes pulse-glow { 0% { box-shadow: 0 0 5px rgba(251,191,36,0.2); } 50% { box-shadow: 0 0 35px rgba(251,191,36,0.7); } 100% { box-shadow: 0 0 5px rgba(251,191,36,0.2); } }
          @keyframes showdown-pop { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
          .animate-showdown-pop { animation: showdown-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          .animate-fling-to-pot { animation: fling-to-pot 0.6s ease-in forwards; }
          .animate-bet-splash { animation: showdown-pop 0.3s ease-out forwards; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          html, body { height: 100%; overflow: hidden; margin: 0; background: #06080c; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
      `}</style>
      
      {intelExpanded && (
        <div onClick={() => setIntelExpanded(false)} className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-md p-6 pt-[100px] flex flex-col gap-4 animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[950px] mx-auto bg-slate-900/95 border border-white/10 rounded-3xl p-6 flex flex-col flex-1 overflow-hidden shadow-2xl mb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-2"><Eye className="text-yellow-400" size={20} /><h3 className="text-xl text-yellow-400 uppercase tracking-widest font-black uppercase">Intelligence Hub</h3></div>
                <div className="flex items-center gap-4">
                    <button onClick={handleCopyLogs} className={`text-[10px] bg-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors uppercase font-black ${copySuccess ? 'text-emerald-400' : ''}`}>{copySuccess ? 'Copied!' : 'Copy Logs'}</button>
                    <button onClick={() => setIntelExpanded(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 font-mono text-xs custom-scrollbar">
                {groupedLogs.map((hand, hIdx) => {
                  const isExpanded = expandedHands.has(hand.id) || (hIdx === 0 && hand.isOngoing);
                  return (
                    <div key={`hand-registry-${hand.id}`} className="flex flex-col border border-white/5 rounded-2xl bg-black/40 overflow-hidden shadow-lg group">
                      <button onClick={() => { const n = new Set(expandedHands); if(n.has(hand.id)) n.delete(hand.id); else n.add(hand.id); setExpandedHands(n); }} className="p-4 flex items-center justify-between w-full hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4 overflow-hidden">
                            <span className="text-yellow-400 uppercase font-black tracking-widest shrink-0 uppercase">{hand.variantName} Hand</span>
                            <span className="text-white/20 text-[10px] shrink-0">|</span>
                            <span className="text-white/40 text-[10px] italic font-black truncate max-w-[400px] uppercase font-black">{hand.winnerSummary}</span>
                        </div>
                        {hand.isOngoing && <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30 animate-pulse font-black uppercase shrink-0 font-black">ACTIVE</span>}
                      </button>
                      {isExpanded && (
                        <div className="flex flex-col border-t border-white/5 bg-black/60">
                          {hand.actions.map((l, li) => (
                             <div key={`act-reg-${hand.id}-${li}`} className="flex items-start gap-3 p-3 border-b border-white/5 hover:bg-white/5">
                               <span className="text-white/20 text-[10px] pt-0.5 w-20 shrink-0 font-black">{String(l.time)}</span>
                               <span className="text-white/80 text-[12px] uppercase flex-1 font-black">
                                 <span className="text-yellow-400/60 mr-2 uppercase">{l.name}:</span> {l.action}
                               </span>
                             </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
