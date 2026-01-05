import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare, Clock, BarChart3, Settings, Maximize, Minimize
} from 'lucide-react';
import io from 'socket.io-client';

const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

const VERSION = "v1.1.7-PRO";
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
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', desc: '2 Hole Cards' }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA', desc: '4 Hole Cards (Use 2)' }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', desc: '3 Hole Cards' }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', desc: 'Low Hand Wins' },
  HILOW: { id: 'HILOW', name: 'Hi-Low Split', desc: '4 Hole Cards' },
  REDSBLACKS: { id: 'REDSBLACKS', name: 'Reds & Blacks', desc: '4 Hole Cards (Joker logic)' }
};

const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  isDealer, strengthLabel, potTransferring, timeRemaining, isHero, 
  relativeIdx, seatIdx, visuals
}) => {
    if (!player || !displayPos) return null;
    const isShowdown = phase === PHASES.SHOWDOWN;
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };
    const currentCardScale = isHero ? visuals.heroCardScale : visuals.oppCardScale;
    const currentCardY = isHero ? visuals.heroCardY : visuals.oppCardY;

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'}`}>
            {(isHero || isShowdown) && !player.isFolded && phase !== PHASES.IDLE && player.winProbability > 0 && (
              <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 z-[300] flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-300">
                <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-500/50 px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                  <span className="text-[10px] font-black text-white font-mono">{Math.round(player.winProbability)}%</span>
                </div>
              </div>
            )}
            {player.lastAction && !isActiveTurn && !isCollectingBets && (
              <div className="absolute top-[-30px] animate-bounce-short z-[200]">
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase border border-white/20 ${
                  player.lastAction === 'FOLD' ? 'bg-red-600 text-white' : 
                  player.lastAction === 'RAISE' ? 'bg-amber-500 text-black' : 
                  'bg-blue-600 text-white'
                }`} style={{ transform: `scale(${visuals.betScale}) translateY(${visuals.betY}px)` }}>{String(player.lastAction)}</span>
              </div>
            )}
            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-700 ${isCollectingBets ? 'animate-fling-to-pot opacity-0 scale-0' : 'animate-bet-splash opacity-100'}`}
                    style={{ 
                      transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y + visuals.betY}px) scale(${visuals.betScale})`, 
                      left: '50%', 
                      top: '50%' 
                    }}>
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-black text-[9px] md:text-[12px] px-2 py-0.5 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.6)] border border-white/30 flex items-center gap-1 whitespace-nowrap"><Coins size={8} />${String(player.currentBet.toLocaleString())}</div>
                </div>
            )}
            <div style={{ transform: `translateY(${visuals.badgeY}px)` }}
                className={`relative z-50 flex flex-col items-center p-1 rounded-xl border bg-slate-900/95 backdrop-blur-md transition-all duration-300 min-w-[70px] md:min-w-[150px] shadow-2xl ${isActiveTurn ? 'border-cyan-400 ring-2 ring-cyan-400/40 scale-105 shadow-[0_0_200px_rgba(34,211,238,0.2)]' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 animate-pulse-glow' : ''}`}>
                {isDealer && ( <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white shadow-[0_0_12px_rgba(220,38,38,0.9)] animate-pulse z-[110]" /> )}
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="absolute -top-1 w-full px-1.5 h-1 z-[60]">
                        <div className="w-full h-full bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400 transition-all duration-1000 linear" style={{ width: `${(timeRemaining / 15) * 100}%` }} />
                        </div>
                    </div>
                )}
                <div className="flex flex-col items-center gap-0 w-full">
                    <div className="flex items-center gap-1">
                      {player.isBot && <Bot size={6} className="text-indigo-400" />}
                      <span className="text-[7px] md:text-[12px] font-black text-white/90 uppercase tracking-tight truncate max-w-[50px] md:max-w-[80px]">{String(player.name || "Anon")}</span>
                    </div>
                    <span className={`text-[9px] md:text-[14px] font-mono font-black ${player.chips === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>${Number(player.chips || 0).toLocaleString()}</span>
                </div>
            </div>
            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative z-10 flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible">
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const offset = ci - mid;
                        const fanRotation = offset * visuals.holeCardFan;
                        const fanTranslation = offset * (player.hand.length > 2 ? 2.0 : 3.5);
                        return (
                          <div key={c.id || ci} 
                              className={`w-[5vw] md:w-[3vw] h-[7vw] md:h-[5vw] rounded-[3px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-300 animate-deal-card ${isShowdown || isHero ? 'bg-white text-black' : 'bg-slate-800'} ${isShowdown && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_20px_#fbbf24]' : 'border-white/20'}`} 
                              style={{ transform: `translateX(${fanTranslation}vw) rotate(${fanRotation}deg) scale(${currentCardScale})`, transformOrigin: 'bottom center', top: `${currentCardY}px`, animationDelay: `${seatIdx * 0.1}s` }}>
                              {(isShowdown || isHero) && ( <><span className="text-[9px] md:text-[12px] font-black leading-none">{String(c.value)}</span><span className={`text-[11px] md:text-[16px] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></> )}
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
  const [logs, setLogs] = useState([{ id: 'init', time: new Date().toLocaleTimeString(), name: 'SYSTEM', action: 'INTELLIGENCE LINK ESTABLISHED', type: 'phase' }]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(15); 
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState(1000);
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potAnimating, setPotAnimating] = useState(false);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [showVisualControls, setShowVisualControls] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);
  
  // Missing states from previous turn
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 5000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 10, bb: 20, minBuy: 400, maxBuy: 2000, pendingVariant: 'HOLDEM' });

  const isMobile = window.innerWidth < 768;
  const headerHeight = isMobile ? 56 : 72; 

  const [visuals, setVisuals] = useState({
    heroCardScale: 4.0, heroCardY: 22, oppCardScale: 1.0, oppCardY: -25,
    commCardScale: 1.8, commCardY: -7, betScale: 2.0, betY: 47,
    badgeY: 85, footerHeight: 230, tableZoom: 0.85, holeCardFan: 25
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

  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + (Number(p?.currentBet) || 0), 0);
    return Number(potAmount) + currentBetsSum;
  }, [potAmount, players]);

  const isBrokeStatus = useMemo(() => heroPlayerObj && Number(heroPlayerObj.chips) <= 0 && phase !== PHASES.SHOWDOWN && phase !== PHASES.IDLE, [heroPlayerObj, phase]);

  const minRaiseAllowed = useMemo(() => {
      const bb = 20; return Math.max(highestBet + bb, highestBet * 2);
  }, [highestBet]);

  useEffect(() => {
    if (intelExpanded) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, intelExpanded]);

  const handleAction = useCallback((type, amt = 0) => {
    if (currentRoomId) socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(amt || raiseInput) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleAllIn = useCallback(() => {
    if (!heroPlayerObj) return;
    const totalStack = Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet);
    if (totalStack <= highestBet) handleAction('CALL'); else handleAction('RAISE', totalStack);
  }, [heroPlayerObj, highestBet, handleAction]);

  const addBot = useCallback(() => { if (currentRoomId) socket.emit('adminAddBot', { roomId: currentRoomId }); }, [currentRoomId]);

  const handleNuclear = useCallback(() => {
      if (!nuclearConfirm) { setNuclearConfirm(true); setTimeout(() => setNuclearConfirm(false), 3000); return; }
      socket.emit('adminNuclearReset'); setNuclearConfirm(false); 
  }, [nuclearConfirm]);

  const handleSpawnArena = useCallback(() => {
    if (!newTable.name) return;
    socket.emit('adminCreateRoom', { ...newTable, id: 'room_' + Math.random().toString(36).slice(2, 9) });
    setNewTable({ name: '', sb: 10, bb: 20, minBuy: 400, maxBuy: 2000, pendingVariant: 'HOLDEM' });
  }, [newTable]);

  const handleCreatePlayer = useCallback(() => {
    if (!newPlayer.name) return;
    socket.emit('adminCreatePlayer', { ...newPlayer, uid: Math.random().toString(36).slice(2) });
    setNewPlayer({ name: '', chips: 5000, password: '' });
  }, [newPlayer]);

  const handleLogin = useCallback(() => { 
    if (passwordInput.toLowerCase().trim() === 'pass') { 
        setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin' }); 
        setCurrentView(VIEWS.ADMIN); socket.emit('getInitialData'); 
    } else socket.emit('playerLogin', { password: passwordInput });
  }, [passwordInput]);

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile) return;
    socket.emit('joinRoom', { roomId: selectedTableForJoin.id, profile: { ...userProfile, pendingVariant: pendingVariantId }, buyIn: buyInAmount }, (res) => {
        if (res?.status === 'ok') { setCurrentRoomId(selectedTableForJoin.id); setCurrentView(VIEWS.GAME); setSelectedTableForJoin(null); }
    });
  }, [selectedTableForJoin, userProfile, pendingVariantId, buyInAmount]);

  useEffect(() => {
    const handleRoomUpdate = (d) => {
        if (!d) return;
        setPlayers(() => { const next = [...INITIAL_PLAYERS]; (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); return next; });
        setPhase(d.phase); setCommunity(d.community || []); setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0);
        setActiveIdx(d.activeIdx ?? -1); setHighestBet(d.highestBet || 0); setDealerIdx(d.dealerIdx ?? -1);
        setTimeRemaining(d.timeRemaining !== undefined ? Math.max(0, d.timeRemaining) : 0);
        if (d.activeVariant) {
            const vId = typeof d.activeVariant === 'string' ? d.activeVariant : d.activeVariant.id;
            setActiveVariant(VARIANTS[vId] || { id: vId, name: d.activeVariant.name || vId });
        }
        if (d.phase === PHASES.SHOWDOWN) { setPotTransferring(true); setShowdownWinners(d.showdownWinners || null); setTimeout(() => setPotTransferring(false), 4000); }
    };
    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('lobbyUpdate', (list) => setActiveTables(list || []));
    socket.on('profilesUpdate', (list) => { setAllProfiles(list || []); setUserProfile(prev => { if (!prev) return prev; const me = list?.find(p => p.uid === prev.uid || p.name === prev.name); return me ? { ...prev, chips: me.chips } : prev; }); });
    socket.on('initialDataResponse', (d) => { if (d.profiles) setAllProfiles(d.profiles); if (d.rooms) setActiveTables(d.rooms); });
    socket.on('loginSuccess', (p) => { setUserProfile(p); setPendingVariantId(p.pendingVariant || 'HOLDEM'); setCurrentView(VIEWS.LOBBY); socket.emit('getInitialData'); });
    socket.on('log', (d) => setLogs(prev => [...prev, { id: Math.random() + '-' + Date.now(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), ...d }].slice(-100)));
    socket.emit('getInitialData');
    return () => { socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); socket.off('initialDataResponse'); socket.off('loginSuccess'); socket.off('log'); };
  }, []);

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
            <button onClick={handleNuclear} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl flex items-center justify-center gap-2 border-2 ${nuclearConfirm ? 'bg-red-600 border-white text-white' : 'bg-white/5 text-red-500'}`}>{nuclearConfirm ? <Bomb size={14}/> : <ShieldAlert size={14}/>}<span className="text-[9px] md:text-xs">{nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</span></button>
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
                                <div className="flex gap-2 md:gap-4 items-center"><span className="text-emerald-400 font-mono text-xs md:text-lg">${Number(p.chips || 0).toLocaleString()}</span><button onClick={()=>{const n = prompt("NEW WALLET", p.chips); if(n) socket.emit('adminEditChips', {uid: p.uid, chips: Number(n)})}} className="text-cyan-400"><Edit3 size={14}/></button><button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500"><Trash2 size={14}/></button></div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-emerald-500 pl-4">ARENA CONTROL</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 border border-white/10">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm"/>
                        <button onClick={handleSpawnArena} className="bg-emerald-600 text-white rounded-xl font-black p-3 text-sm">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 md:gap-4">
                        {activeTables.map(t => (
                            <div key={t.id} className="bg-white/5 p-3 rounded-2xl flex justify-between items-center border border-white/10">
                              <div><h4 className="text-[#fbbf24] font-black text-xs md:text-base">{String(t.name)}</h4><p className="text-[8px] text-white/40 tracking-widest uppercase">${t.sb}/${t.bb}</p></div>
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
    <div className="h-screen bg-[#06080c] flex flex-col text-white font-black uppercase overflow-hidden">
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
              <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-[#fbbf24]/30 rounded-3xl shadow-2xl flex flex-col gap-6 md:gap-10">
                <h3 className="text-xl md:text-3xl text-center text-[#fbbf24] underline underline-offset-8 uppercase font-black">{String(selectedTableForJoin.name)}</h3>
                <div className="space-y-4 font-black text-center uppercase">
                  <div className="flex justify-between items-center text-[10px] text-white/40 tracking-widest font-black"><span>BUY-IN AMOUNT</span><span className="text-emerald-400 text-lg md:text-2xl font-mono">${buyInAmount.toLocaleString()}</span></div>
                  <input type="range" min={selectedTableForJoin.minBuy || 400} max={selectedTableForJoin.maxBuy || 2000} step={100} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fbbf24]" />
                </div>
                <div className="flex gap-4"><button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black text-[10px] uppercase">BACK</button><button onClick={joinRoom} className="flex-2 p-3.5 bg-emerald-600 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all text-[10px] tracking-widest font-black uppercase">SIT DOWN</button></div>
              </div>
            </div>
        )}
        <header className="h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-5 md:px-12 bg-black/40 backdrop-blur-md shadow-xl shrink-0">
          <h2 className="tracking-[0.2em] md:tracking-[0.4em] text-xs md:text-xl flex items-center gap-2 md:gap-4 font-black"><LayoutGrid className="text-[#fbbf24] w-3 md:w-6"/> LOBBY</h2>
          <div className="flex items-center gap-3 md:gap-10 font-black">
            <div className="flex flex-col items-end"><span className="text-[7px] text-white/40 uppercase italic truncate max-w-[50px] md:max-w-none">{String(userProfile?.name || "??")}</span><span className="text-emerald-400 font-mono text-xs md:text-2xl tracking-tighter">${Number(userProfile?.chips || 0).toLocaleString()}</span></div>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={16}/></button>
          </div>
        </header>
        <main className="flex-1 p-5 md:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-10 overflow-y-auto bg-gradient-to-br from-transparent to-white/5 font-black uppercase">
            {activeTables.length === 0 ? (<div className="col-span-full flex flex-col items-center justify-center p-20 text-white/20 gap-4 uppercase font-black"><ShieldAlert size={48} /><span className="text-sm tracking-[0.4em]">NO ACTIVE ARENAS</span></div>) : (activeTables.map((t) => (<div key={t.id} className="p-5 md:p-8 bg-white/5 border border-white/5 rounded-3xl flex flex-col gap-4 md:gap-6 shadow-2xl hover:border-[#fbbf24]/20 transition-all group relative overflow-hidden font-black"><h3 className="text-lg md:text-2xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors uppercase font-black">{String(t.name)}</h3><div className="bg-black/60 p-4 md:p-6 rounded-2xl flex justify-between items-center border border-white/5 shadow-inner uppercase font-black"><div className="flex flex-col font-black"><span className="text-[7px] md:text-[8px] text-white/40 tracking-widest">STAKES</span><span className="text-[#fbbf24] text-base md:text-xl font-black">${t.sb}/${t.bb}</span></div><div className="flex flex-col items-end font-black"><span className="text-[7px] md:text-[8px] text-white/40 tracking-widest">SEATS</span><span className="text-white/80 font-mono text-[10px] md:text-base font-black">{t.players?.filter(p=>p).length || 0}/10</span></div></div><button onClick={()=>setSelectedTableForJoin(t)} className="relative z-20 w-full p-5 md:p-8 bg-emerald-600 rounded-2xl tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-[10px] font-black uppercase">ENTER ARENA</button></div>)))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      {intelExpanded && (
        <div onClick={() => setIntelExpanded(false)} className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-md p-6 pt-[100px] flex flex-col gap-4 animate-in fade-in duration-300">
          <div className="w-full max-w-[800px] mx-auto bg-slate-900/80 border border-white/10 rounded-3xl p-6 flex flex-col flex-1 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
               <div className="flex items-center gap-2"><Eye className="text-[#fbbf24]" size={20} /><h3 className="text-xl text-[#fbbf24] font-black uppercase tracking-widest">Intelligence Access</h3></div>
               <div className="flex items-center gap-2"><div className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse font-black uppercase">Live Link Active</div><X size={20} className="text-white/40" /></div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide font-mono">
                {(logs || []).map(l => (
                    <div key={l.id} className="flex items-start gap-4 p-3 border-b border-white/5 hover:bg-white/5 transition-colors group">
                        <span className="text-white/20 text-xs w-20 shrink-0 font-black">{String(l.time)}</span>
                        <div className="flex flex-wrap items-center gap-2 overflow-hidden"><span className={`px-2 py-0.5 rounded-md text-xs font-black uppercase ${l.type === 'win' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : l.type === 'variant' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : l.type === 'fold' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : l.type === 'phase' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20'}`}>{String(l.name)}</span><span className="text-white/70 text-sm font-black tracking-tight uppercase">{String(l.action)}</span></div>
                    </div>
                ))}
                <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}

      {showVisualControls && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 md:p-12">
            <div className="w-full max-w-[1000px] h-[90vh] bg-slate-900/60 border-2 border-white/20 rounded-[3rem] p-10 md:p-20 flex flex-col gap-12 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-y-auto scrollbar-hide relative">
                <div className="flex items-center justify-between border-b-2 border-white/10 pb-10 sticky top-0 bg-transparent z-10"><h3 className="text-4xl md:text-7xl text-[#fbbf24] flex items-center gap-6 font-black uppercase tracking-tighter"><Settings2 size={64}/> Display Configuration</h3><button onClick={() => setShowVisualControls(false)} className="text-white/40 hover:text-white transition-colors p-4"><X size={64}/></button></div>
                <div className="flex flex-col gap-20 pb-20">
                    <div className="flex flex-col gap-10"><h4 className="text-3xl md:text-5xl tracking-[0.2em] text-emerald-400 uppercase font-black border-l-8 border-emerald-400 pl-8">Arena Layout</h4><div className="flex flex-col gap-10"><div className="flex flex-col gap-4"><label className="text-2xl md:text-4xl text-white/60 uppercase font-black">Table Zoom ({visuals.tableZoom.toFixed(2)})</label><input type="range" min="0.3" max="1.5" step="0.05" value={visuals.tableZoom} onChange={(e) => setVisuals({...visuals, tableZoom: Number(e.target.value)})} className="accent-emerald-400 h-8 cursor-pointer" /></div><div className="flex flex-col gap-4"><label className="text-2xl md:text-4xl text-white/60 uppercase font-black">Actions HUD Height ({visuals.footerHeight}px)</label><input type="range" min="40" max="600" step="1" value={visuals.footerHeight} onChange={(e) => setVisuals({...visuals, footerHeight: Number(e.target.value)})} className="accent-indigo-400 h-8 cursor-pointer" /></div></div></div>
                    <div className="flex flex-col gap-10"><h4 className="text-3xl md:text-5xl tracking-[0.2em] text-purple-400 uppercase font-black border-l-8 border-purple-400 pl-8">Hole Cards</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-12"><div className="flex flex-col gap-4"><label className="text-2xl md:text-4xl text-white/60 uppercase font-black">SIZE SCALE ({visuals.heroCardScale.toFixed(1)})</label><input type="range" min="1.0" max="6.0" step="0.1" value={visuals.heroCardScale} onChange={(e) => setVisuals({...visuals, heroCardScale: Number(e.target.value)})} className="accent-purple-500 h-8 cursor-pointer" /></div><div className="flex flex-col gap-4"><label className="text-2xl md:text-4xl text-white/60 uppercase font-black">Y POSITION ({visuals.heroCardY}px)</label><input type="range" min="-200" max="200" step="1" value={visuals.heroCardY} onChange={(e) => setVisuals({...visuals, heroCardY: Number(e.target.value)})} className="accent-purple-500 h-8 cursor-pointer" /></div><div className="flex flex-col gap-4 md:col-span-2"><label className="text-2xl md:text-4xl text-white/60 uppercase font-black">CARD FAN SPREAD ({visuals.holeCardFan} deg)</label><input type="range" min="0" max="60" step="1" value={visuals.holeCardFan} onChange={(e) => setVisuals({...visuals, holeCardFan: Number(e.target.value)})} className="accent-pink-500 h-8 cursor-pointer" /></div></div></div>
                    <div className="flex flex-col gap-10"><h4 className="text-3xl md:text-5xl tracking-[0.2em] text-amber-500 uppercase font-black border-l-8 border-amber-500 pl-8">Action Labels</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-12"><div className="flex flex-col gap-4"><label className="text-2xl md:text-4xl text-white/60 uppercase font-black">TEXT SCALE ({visuals.betScale.toFixed(1)})</label><input type="range" min="0.5" max="4.0" step="0.1" value={visuals.betScale} onChange={(e) => setVisuals({...visuals, betScale: Number(e.target.value)})} className="accent-amber-500 h-8 cursor-pointer" /></div><div className="flex flex-col gap-4"><label className="text-2xl md:text-4xl text-white/60 uppercase font-black">Y OFFSET ({visuals.betY}px)</label><input type="range" min="-300" max="300" step="1" value={visuals.betY} onChange={(e) => setVisuals({...visuals, betY: Number(e.target.value)})} className="accent-amber-500 h-8 cursor-pointer" /></div></div></div>
                    <div className="flex flex-col gap-10"><h4 className="text-3xl md:text-5xl tracking-[0.2em] text-cyan-400 uppercase font-black border-l-8 border-cyan-400 pl-8">The Board</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-12"><div className="flex flex-col gap-4"><label className="text-2xl md:text-4xl text-white/60 uppercase font-black">SIZE SCALE ({visuals.commCardScale.toFixed(1)})</label><input type="range" min="1.0" max="4.0" step="0.1" value={visuals.commCardScale} onChange={(e) => setVisuals({...visuals, commCardScale: Number(e.target.value)})} className="accent-cyan-500 h-8 cursor-pointer" /></div><div className="flex flex-col gap-4"><label className="text-2xl md:text-4xl text-white/60 uppercase font-black">Y OFFSET ({visuals.commCardY}px)</label><input type="range" min="-100" max="100" step="1" value={visuals.commCardY} onChange={(e) => setVisuals({...visuals, commCardY: Number(e.target.value)})} className="accent-cyan-500 h-8 cursor-pointer" /></div></div></div>
                    <button onClick={() => setShowVisualControls(false)} className="w-full py-10 bg-emerald-600 rounded-[2rem] text-4xl md:text-6xl font-black uppercase shadow-2xl hover:brightness-125 transition-all active:scale-95">Accept & Save Changes</button>
                </div>
            </div>
        </div>
      )}

      {isBrokeStatus && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6">
            <div className="w-full max-w-[400px] p-8 bg-slate-900 border-2 border-red-500 rounded-3xl text-center shadow-[0_0_100px_rgba(239,68,68,0.4)] font-black">
              <AlertTriangle size={64} className="text-red-500 animate-pulse mb-4 mx-auto" />
              <h2 className="text-xl md:text-3xl font-black mb-2 uppercase">Busted!</h2>
              <p className="text-white/40 mb-5 text-[8px] tracking-widest uppercase">Rebuy Required</p>
              {(userProfile?.chips || 0) >= 1000 ? (<button onClick={() => socket.emit('playerRebuy', { roomId: currentRoomId, uid: userProfile.uid, amount: 1000 })} className="w-full p-5 bg-emerald-600 text-white rounded-2xl shadow-xl animate-bounce font-black uppercase text-xs">REBUY $1,000</button>) : (<div className="p-5 bg-white/5 rounded-2xl border border-white/10 text-white/40 text-[10px] font-black uppercase">INSUFFICIENT WALLET</div>)}
              <button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid }); setCurrentView(VIEWS.LOBBY);}} className="mt-4 text-white/20 hover:text-white text-[9px] uppercase underline">EXIT ARENA</button>
            </div>
          </div>
      )}

      <header className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-2 md:px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black" style={{ height: `${headerHeight}px` }}>
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
            <div className="bg-white/5 px-2 py-1.5 rounded-lg md:rounded-xl border border-white/5 shadow-inner truncate font-black uppercase flex flex-col justify-center min-w-[70px] md:min-w-[110px] h-[44px] md:h-[56px]"><span className="text-[#fbbf24] text-[8px] md:text-[10px] leading-none mb-0.5 uppercase tracking-wider">This Hand:</span><span className="text-white text-[10px] md:text-sm truncate leading-none">{String(activeVariant?.name || "Hold'em")}</span></div>
            <div className="bg-white/5 border border-white/10 px-2 py-1.5 rounded-lg md:rounded-xl flex flex-col justify-center shadow-inner min-w-[70px] md:min-w-[110px] h-[44px] md:h-[56px]"><span className="text-cyan-400 text-[8px] md:text-[10px] leading-none mb-0.5 uppercase tracking-wider">On My Deal:</span><select value={pendingVariantId} onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value}); }} className="bg-transparent text-white outline-none text-[10px] md:text-sm cursor-pointer font-black uppercase appearance-none leading-none w-full">{Object.entries(VARIANTS).map(([k,v]) => (<option key={k} value={k} className="bg-slate-900">{isMobile ? k : v.name}</option>))}</select></div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-4">
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 md:px-4 py-2 rounded-lg font-mono text-[10px] md:text-[13px] shadow-inner h-[40px] md:h-[52px]"><TrendingUp size={12} className="text-cyan-400" /><span className="text-[#fbbf24] font-black">{Math.round(heroWinProb)}%</span></div>
          <div className="flex gap-1 md:gap-2.5 items-center">
              <button onClick={addBot} className="text-indigo-400 p-2 md:p-3 bg-white/5 border border-white/10 rounded-lg md:rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors"><Bot size={18}/></button>
              <button onClick={() => setIntelExpanded(!intelExpanded)} className={`${intelExpanded ? 'text-white bg-indigo-600' : 'text-[#fbbf24] bg-white/5'} p-2 md:p-3 border border-white/10 rounded-lg md:rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors`}><Eye size={18}/></button>
              <button onClick={() => setShowVisualControls(true)} className="text-cyan-400 p-2 md:p-3 bg-white/5 border border-white/10 rounded-lg md:rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors"><Settings size={18}/></button>
              <button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid });setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2 md:p-3 bg-white/5 border border-white/10 rounded-lg md:rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors"><LogOut size={18}/></button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-emerald-950/20 to-transparent overflow-hidden px-1 py-1 font-black uppercase">
        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 10}px)` }} className="relative w-full max-w-[1400px] aspect-[15/10] md:aspect-[21/10] flex items-center justify-center h-full origin-center font-black">
            <div className="absolute inset-0 bg-[#0f3d2e]/40 rounded-[50%] border-[3vw] md:border-[2vw] border-slate-900/60 shadow-[inset_0_0_15vw_rgba(0,0,0,0.8)] border-double font-black uppercase" />
            <div className="absolute inset-0 pointer-events-none z-20 font-black uppercase">
              {(players || []).map((p, i) => { if (!p) return null; const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; return (<Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} seatIdx={i} visuals={visuals} timeRemaining={timeRemaining} />); })}
            </div>
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center">
              {!potTransferring && ( <div className={`flex flex-col items-center transition-all duration-300 font-black uppercase ${potAnimating ? 'scale-110' : 'scale-100'}`}><div className={`text-[10vw] md:text-[5vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] ${potAnimating ? 'animate-pot-pulse' : ''}`}>${Number(totalDisplayPot || 0).toLocaleString()}</div></div> )}
              {['HOLDEM', 'OMAHA', 'PINEAPPLE', 'HILOW', 'MUFLIS', 'REDSBLACKS'].includes(activeVariant?.id) && (
                <div className="flex gap-1.5 md:gap-4 mt-4 md:mt-12 font-black uppercase transition-transform" style={{ transform: `scale(${visuals.commCardScale}) translateY(${visuals.commCardY}px)` }}>
                  {(community || []).map((c, j) => (<div key={c.id || j} className={`w-[6vw] md:w-[3vw] h-[9vw] md:h-[5vw] rounded-[3px] border bg-white flex flex-col items-center justify-center text-black font-black transition-all duration-300 ${winning5Ids?.includes(c.id) ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_40px_rgba(251,191,36,0.6)]' : 'border-white/20 shadow-2xl'}`}><span className="text-[10px] md:text-[0.9vw] font-black leading-none">{String(c.value)}</span><span className={`text-[13px] md:text-[2.2vw] font-black leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></div>))}
                </div>
              )}
            </div>
        </div>
      </main>

      <footer style={{ height: `${footerHeight}px` }} className="bg-black/95 backdrop-blur-3xl border-t border-white/10 flex flex-col z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 font-black uppercase overflow-hidden">
        <div className="flex-1 flex flex-col justify-center px-2 md:px-10 relative bg-white/5 shadow-inner py-1.5 md:py-3 font-black uppercase">
          {activeIdx === heroIdx && phase !== PHASES.IDLE && heroPlayerObj ? (
            <div className="flex flex-col gap-2 md:gap-5 animate-in slide-in-from-bottom duration-500 items-center w-full font-black uppercase">
                <div className="absolute top-0 right-1.5 animate-in slide-in-from-right duration-500"><div className="flex flex-col items-end"><span className="text-[4px] md:text-[7px] text-white/40 tracking-[0.1em] font-black uppercase leading-none">Strength</span><span className="text-[7px] md:text-[14px] text-purple-400 font-black uppercase leading-none">{String(heroPlayerObj.strength || "High Card")}</span></div></div>
                {Number(heroPlayerObj.chips) > 0 ? (<>
                        <div className="flex gap-1.5 md:gap-2 w-full max-w-[600px] font-black uppercase"><button onClick={()=>handleAction('RAISE', highestBet + Math.floor(potAmount * 0.5))} className="flex-1 h-8 md:h-10 bg-white/5 border border-white/10 rounded-md text-[9px] md:text-[12px] hover:bg-white/20 transition-all font-black uppercase flex items-center justify-center">1/2 POT</button><button onClick={()=>handleAction('RAISE', highestBet + potAmount)} className="flex-1 h-8 md:h-10 bg-white/5 border border-white/10 rounded-md text-[9px] md:text-[12px] hover:bg-white/20 transition-all font-black uppercase flex items-center justify-center">POT</button><button onClick={handleAllIn} className="flex-1 h-8 md:h-10 bg-red-900/30 border border-red-500/50 rounded-md text-[9px] md:text-[12px] text-red-500 hover:bg-red-600 hover:text-white transition-all font-black uppercase flex items-center justify-center">ALL-IN</button></div>
                        <div className="flex flex-col md:flex-row gap-2 md:gap-6 w-full items-center justify-center font-black">
                            <div className="flex gap-1.5 w-full md:w-auto md:flex-1 justify-center"><button onClick={()=>handleAction('FOLD')} className="flex-1 md:w-32 h-14 md:h-16 bg-red-950/60 border border-red-500/50 rounded-xl tracking-[0.1em] hover:brightness-125 transition-all font-black text-[10px] md:text-sm shadow-xl uppercase">FOLD</button><button onClick={()=>handleAction('CALL')} className="flex-[2] md:flex-1 md:max-w-[360px] h-14 md:h-16 bg-indigo-900/60 border border-indigo-400/50 rounded-xl text-[11px] md:text-xl tracking-[0.1em] hover:brightness-125 font-black shadow-xl uppercase px-2 truncate">{highestBet > heroPlayerObj.currentBet ? (highestBet - heroPlayerObj.currentBet >= heroPlayerObj.chips ? `ALL-IN` : `CALL $${(highestBet - heroPlayerObj.currentBet).toLocaleString()}`) : 'CHECK'}</button></div>
                            <div className="flex gap-1.5 items-center bg-black/60 border border-white/10 p-1 md:p-1.5 rounded-xl shadow-inner w-full md:min-w-[320px] md:w-auto font-black uppercase"><div className="flex items-center bg-black/40 px-2 md:px-5 rounded-lg border border-white/5 h-12 md:h-14 font-black uppercase flex-1 md:flex-none"><span className="text-[#fbbf24] text-[12px] md:text-xl font-mono mr-0.5">$</span><input type="number" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet), Math.max(0, Number(e.target.value))))} className="w-full md:w-28 bg-transparent text-center font-mono text-sm md:text-2xl text-[#fbbf24] outline-none font-black" /></div><button onClick={()=>handleAction('RAISE', raiseInput)} className="flex-1 h-12 md:h-14 bg-emerald-600/60 border border-emerald-400/50 rounded-lg flex items-center justify-center hover:brightness-125 font-black uppercase text-[11px] md:text-xl shadow-xl"><Zap size={12} className="mr-1 text-emerald-400"/> RAISE</button></div>
                        </div></>) : ( <div className="flex flex-col items-center gap-1 animate-pulse"><span className="text-lg md:text-4xl font-black text-white tracking-tighter uppercase">ALL-IN POSITION</span></div> )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase">
                {phase === PHASES.SHOWDOWN && showdownWinners && showdownWinners.length > 0 ? (
                    <div className="flex flex-col items-center gap-1 md:gap-3 w-full h-full justify-center">
                        <div className="flex items-center gap-1.5 text-yellow-400 animate-pulse font-black tracking-[0.2em] text-[7px] md:text-xs uppercase leading-none"><Trophy size={10} /> SHOWDOWN WINNERS</div>
                        <div className="flex flex-wrap gap-1.5 md:gap-6 items-center justify-center animate-in fade-in zoom-in duration-700 w-full overflow-y-auto px-1">
                            {showdownWinners.map((winner, idx) => (
                                <div key={idx} className="flex items-center gap-2 md:gap-6 bg-black/60 p-1 md:p-4 rounded-xl md:rounded-[2rem] border border-yellow-500/30 shadow-[0_0_30px_rgba(251,191,36,0.2)] min-w-[150px] md:min-w-[320px] animate-showdown-card-pop" style={{ animationDelay: `${idx * 0.1}s` }}><div className="flex flex-col items-center shrink-0"><div className="text-[#fbbf24] font-black text-[9px] md:text-2xl drop-shadow-lg uppercase truncate max-w-[45px] md:max-w-none">{String(winner.name)}</div><div className="text-emerald-400 font-mono text-[9px] md:text-xl font-black">+${(winner.amount || 0).toLocaleString()}</div><div className="text-yellow-400 text-[5px] md:text-[8px] tracking-widest uppercase mt-0.5">{String(winner.rank)}</div></div><div className="flex gap-1 items-center justify-center">{(winner.hand || []).map((c, ci) => (<div key={ci} className="w-5 md:w-12 h-8 md:h-18 bg-white rounded-sm md:rounded-lg flex flex-col items-center justify-center text-black shadow-xl" style={{ animation: `card-flip 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards`, animationDelay: `${0.2 + ci * 0.1}s`, opacity: 0 }}><span className="text-[7px] md:text-[14px] font-black absolute top-0.5 left-0.5 leading-none">{String(c.value)}</span><span className={`text-[10px] md:text-2xl ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></div>))}</div></div>))}
                        </div>
                    </div>
                ) : ( 
                    <div className="flex flex-col items-center gap-1 md:gap-4 animate-in fade-in duration-500 font-black uppercase w-full max-w-[1000px]">
                      {phase === PHASES.IDLE ? (<div className="flex flex-col items-center gap-1 md:gap-3"><span className="text-white/40 tracking-[0.2em] md:tracking-[0.4em] text-[10px] md:text-lg font-black italic uppercase leading-none">Arena Idle</span></div>) : (
                        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4 px-4">
                           <div className="flex flex-col items-center md:items-start"><span className="text-cyan-400 text-[8px] md:text-[12px] animate-pulse mb-1 font-black">PLAYER TURN</span><span className="text-white text-sm md:text-3xl font-black tracking-tighter drop-shadow-lg uppercase leading-none">{String(players[activeIdx]?.name || "OPPONENT")}</span></div>
                           {heroPlayerObj && !heroPlayerObj.isFolded && (
                              <div className="flex items-center gap-4 bg-white/5 p-3 md:p-4 rounded-2xl border border-white/10 shadow-inner">
                                 <div className="flex flex-col"><span className="text-white/40 text-[7px] md:text-[10px] font-black">YOUR HAND</span><span className="text-purple-400 text-xs md:text-xl font-black uppercase">{String(heroPlayerObj.strength || "High Card")}</span></div>
                                 <div className="h-6 md:h-10 w-px bg-white/10" />
                                 <div className="flex flex-col items-end"><span className="text-white/40 text-[7px] md:text-[10px] font-black">WIN PROB.</span><span className="text-[#fbbf24] text-xs md:text-xl font-mono font-black">{Math.round(heroWinProb)}%</span></div>
                              </div>
                           )}
                        </div>
                      )}
                    </div> 
                )}
            </div>
          )}
        </div>
      </footer>
      <style>{`
          @keyframes progress { from { width: 100%; } to { width: 0%; } }
          @keyframes fling-to-pot { 0% { transform: translate(-50%, -100%) scale(1.5); filter: blur(0px); } 100% { transform: translate(0, -35vh) scale(0.1) rotate(1080deg); filter: blur(4px); opacity: 0; } }
          @keyframes pot-pulse { 0% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } 50% { transform: scale(1.1); filter: drop-shadow(0 0 30px #fbbf24) brightness(1.2); } 100% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } }
          .animate-pot-pulse { animation: pot-pulse 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .animate-pulse-glow { animation: pulse-glow 2s infinite ease-in-out; }
          @keyframes pulse-glow { 0% { box-shadow: 0 0 20px rgba(34,211,238,0.6); } 50% { box-shadow: 0 0 20px rgba(34,211,238,0.6); } 100% { box-shadow: 0 0 20px rgba(34,211,238,0); } }
          ::-webkit-scrollbar { display: none; }
          @keyframes bounce-short { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
          .animate-bounce-short { animation: bounce-short 1.5s ease-in-out infinite; }
          @keyframes showdown-pop { 0% { transform: scale(0.7) translateY(40px) rotateX(-20deg); opacity: 0; } 100% { transform: scale(1) translateY(0) rotateX(0deg); opacity: 1; } }
          .animate-showdown-card-pop { animation: showdown-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes card-flip { 0% { transform: rotateY(90deg) scale(0.5); opacity: 0; } 100% { transform: rotateY(0deg) scale(1); opacity: 1; } }
          @keyframes bet-splash { 0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
          .animate-bet-splash { animation: bet-splash 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes deal-card { 0% { top: 40%; left: 50%; transform: translate(-50%, -50%) scale(0.2) rotate(720deg); opacity: 0; } 100% { opacity: 1; } }
          .animate-deal-card { animation: deal-card 0.5s cubic-bezier(0.2, 0.8, 0.2, 1.1) forwards; }
          html, body { overscroll-behavior-y: contain; height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
      `}</style>
    </div>
  );
};

export default App;
