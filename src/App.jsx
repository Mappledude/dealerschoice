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

const VERSION = "v1.8.0-ULTRA";
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
  { x: 0, y: -180 },   { x: 120, y: -120 }, { x: 150, y: 0 },    { x: 120, y: 120 },  { x: 70, y: 150 },    
  { x: 0, y: 170 },    { x: -70, y: 150 },  { x: -120, y: 120 }, { x: -150, y: 0 },   { x: -120, y: -120 } 
];

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em' }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA' }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple' }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis' }, 
  HILOW: { id: 'HILOW', name: 'Hi-Low Split' }, 
  REDSBLACKS: { id: 'REDSBLACKS', name: 'Reds & Blacks' }
};

const PotInspiredBet = ({ amount, visuals }) => (
  <div className="relative flex flex-col items-center" style={{ transform: `scale(${visuals.betScale}) translateY(${visuals.betY}px)` }}>
    <div className="flex items-center gap-1">
      <div className="w-1 h-3 md:h-6 bg-yellow-500 shadow-[0_0_15px_#fbbf24]" />
      <span className="text-[12px] md:text-[20px] font-mono font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)] leading-none italic tracking-tighter">
        ${Number(amount).toLocaleString()}
      </span>
    </div>
  </div>
);

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  isDealer, potTransferring, timeRemaining, isHero, 
  relativeIdx, seatIdx, visuals
}) => {
    if (!player || !displayPos) return null;
    const isShowdown = phase === PHASES.SHOWDOWN;
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };
    const currentCardScale = isHero ? visuals.heroCardScale : visuals.oppCardScale;
    const currentCardY = isHero ? visuals.heroCardY : visuals.oppCardY;

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-[200] transition-all duration-500 overflow-visible ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'}`}>
            {player.lastAction && !isActiveTurn && !isCollectingBets && (
              <div className="absolute top-[-35px] animate-bounce-short z-[200]">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded shadow-xl uppercase border border-white/20 tracking-wider ${
                  player.lastAction === 'FOLD' ? 'bg-gradient-to-b from-red-500 to-red-700 text-white' : 
                  player.lastAction === 'RAISE' ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-black' : 
                  'bg-gradient-to-b from-indigo-500 to-indigo-700 text-white'
                }`}>{String(player.lastAction)}</span>
              </div>
            )}

            {player.currentBet > 0 && (
                <div className={`absolute z-[1000] transition-all duration-1000 ${isCollectingBets ? 'animate-bet-vortex' : 'animate-bet-slam'}`}
                    style={{ 
                      transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y}px)`, 
                      left: '50%', 
                      top: '50%' 
                    }}>
                    <PotInspiredBet amount={player.currentBet} visuals={visuals} />
                </div>
            )}

            <div style={{ transform: `translateY(${visuals.badgeY}px) scale(${visuals.badgeScale || 1.0})` }}
                className={`relative z-50 flex flex-col items-center p-1.5 rounded-2xl border bg-slate-950/95 backdrop-blur-lg transition-all duration-300 min-w-[90px] md:min-w-[190px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] ${isActiveTurn ? 'border-cyan-400 ring-2 ring-cyan-400/40 scale-105 shadow-[0_0_100px_rgba(34,211,238,0.3)]' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 animate-pulse-glow' : ''}`}>
                {isDealer && ( <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white rounded-full border-2 border-slate-900 shadow-xl flex items-center justify-center text-slate-950 text-[8px] font-black z-[110]">D</div> )}
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="absolute -top-1 w-full px-2 h-1.5 z-[60]">
                        <div className="w-full h-full bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000 linear" style={{ width: `${(timeRemaining / 15) * 100}%` }} />
                        </div>
                    </div>
                )}
                <div className="flex flex-col items-center gap-0.5 w-full">
                    <div className="flex items-center gap-1.5">
                      {player.isBot && <Bot size={10} className="text-indigo-400" />}
                      <span className="text-[10px] md:text-[15px] font-black text-white/95 uppercase tracking-tighter truncate max-w-[70px] md:max-w-110px] font-mono italic">{String(player.name || "Anon")}</span>
                    </div>
                    <span className={`text-[12px] md:text-[19px] font-mono font-black ${player.chips <= 1 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>${Number(player.chips).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
            </div>

            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative z-10 flex items-center justify-center w-[12vw] h-[6vw] mt-5 overflow-visible">
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const offset = ci - mid;
                        const fanRotation = offset * visuals.holeCardFan;
                        const fanTranslation = offset * (player.hand.length > 2 ? 2.5 : 4.0);
                        return (
                          <div key={c.id || ci} 
                              className={`w-[5.5vw] md:w-[3.5vw] h-[7.5vw] md:h-[5.5vw] rounded-lg flex flex-col items-start p-1 border shadow-2xl absolute transition-all duration-500 animate-deal-card ${isShowdown || isHero ? 'bg-white text-black' : 'bg-slate-900'} ${isShowdown && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 z-30 shadow-[0_0_40px_#fbbf24]' : 'border-white/10'}`} 
                              style={{ transform: `translateX(${fanTranslation}vw) rotate(${fanRotation}deg) scale(${currentCardScale})`, transformOrigin: 'bottom center', top: `${currentCardY}px`, animationDelay: `${seatIdx * 0.1}s` }}>
                              {(isShowdown || isHero) && ( <><span className="text-[10px] md:text-[14px] font-black leading-none">{String(c.value)}</span><span className={`text-[12px] md:text-[18px] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></> )}
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
  const [currentBB, setCurrentBB] = useState(0.50);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([{ id: 'init', time: new Date().toLocaleTimeString(), name: 'SYSTEM', action: 'SECURE LINK ESTABLISHED', type: 'phase' }]);
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
  
  const [pendingDeleteTableId, setPendingDeleteTableId] = useState(null);
  const [pendingDeletePlayerUid, setPendingDeletePlayerUid] = useState(null);
  const [editingPlayerUid, setEditingPlayerUid] = useState(null);
  const [editChipsValue, setEditChipsValue] = useState(0);

  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 100, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10, pendingVariant: 'HOLDEM' });

  const isMobile = window.innerWidth < 768;
  const headerHeight = isMobile ? 56 : 72; 

  const [visuals, setVisuals] = useState({
    heroCardScale: 4.0, heroCardY: 22, oppCardScale: 1.0, oppCardY: -25,
    commCardScale: 1.8, commCardY: -7, betScale: 1.0, betY: 0,
    badgeY: 85, badgeScale: 1.0, potScale: 1.0, potY: 0,
    footerHeight: window.innerWidth < 768 ? 215 : 220,
    tableZoom: window.innerWidth < 768 ? 0.75 : 0.85, 
    holeCardFan: 25
  });

  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => p && (p.uid === userProfile.uid || p.name === userProfile.name));
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);

  const heroWinProb = useMemo(() => {
      if (!heroPlayerObj) return 0;
      if (heroPlayerObj.winProbabilityHigh !== undefined && heroPlayerObj.winProbabilityLow !== undefined) {
          return (heroPlayerObj.winProbabilityHigh + heroPlayerObj.winProbabilityLow) / 2;
      }
      return heroPlayerObj.winProbability || 0;
  }, [heroPlayerObj]);

  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + (Number(p?.currentBet) || 0), 0);
    return Number(potAmount) + currentBetsSum;
  }, [potAmount, players]);

  const isBrokeStatus = useMemo(() => {
    if (!heroPlayerObj) return false;
    return Number(heroPlayerObj.chips) <= 1 && Number(heroPlayerObj.currentBet) <= 0 && (phase === PHASES.IDLE || phase === PHASES.SHOWDOWN);
  }, [heroPlayerObj, phase]);

  const handleAction = useCallback((type, amt = 0) => {
    const finalAmount = amt !== 0 ? amt : raiseInput;
    if (currentRoomId) socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(finalAmount) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleAllIn = useCallback(() => {
    if (!heroPlayerObj) return;
    handleAction('RAISE', Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet));
  }, [heroPlayerObj, handleAction]);

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile || isJoining) return;
    
    setIsJoining(true);
    socket.emit('joinRoom', { 
        roomId: selectedTableForJoin.id, 
        profile: { ...userProfile, pendingVariant: pendingVariantId }, 
        buyIn: Math.min(buyInAmount, userProfile.chips) 
    }, (res) => {
        setIsJoining(false);
        if (res?.status === 'ok') { 
            setCurrentRoomId(selectedTableForJoin.id); 
            setCurrentView(VIEWS.GAME); 
            setSelectedTableForJoin(null); 
        } else {
            console.error("Join failed:", res?.message);
        }
    });
  }, [selectedTableForJoin, userProfile, pendingVariantId, buyInAmount, isJoining]);

  const handleLogin = useCallback(() => { 
    if (passwordInput.toLowerCase().trim() === 'pass') { 
        setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin' }); 
        setCurrentView(VIEWS.ADMIN); socket.emit('getInitialData'); 
    } else socket.emit('playerLogin', { password: passwordInput });
  }, [passwordInput]);

  useEffect(() => {
    if (activeIdx === heroIdx && phase !== PHASES.IDLE && heroPlayerObj) {
      const minRequired = highestBet === 0 ? currentBB : Math.max(highestBet + currentBB, highestBet * 2);
      const stack = Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet);
      setRaiseInput(Math.min(stack, minRequired));
    }
  }, [activeIdx, heroIdx, phase, highestBet, currentBB, heroPlayerObj]);

  useEffect(() => {
    socket.on('connect', () => { setIsConnected(true); socket.emit('getInitialData'); });
    socket.on('disconnect', () => setIsConnected(false));
    
    socket.on('initialDataResponse', (data) => {
        if (data.rooms) setActiveTables(data.rooms);
        if (data.profiles) setAllProfiles(data.profiles);
    });

    const handleRoomUpdate = (d) => {
        if (!d) return;
        setPlayers(() => { 
          const next = Array(TOTAL_SEATS).fill(null); 
          (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
          return next; 
        });
        setPhase(d.phase); setCommunity(d.community || []); setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0);
        setActiveIdx(d.activeIdx ?? -1); setHighestBet(d.highestBet || 0); setDealerIdx(d.dealerIdx ?? -1);
        setTimeRemaining(d.timeRemaining !== undefined ? Math.max(0, d.timeRemaining) : 0);
        if (d.bb) setCurrentBB(Number(d.bb));
        if (d.activeVariant) {
            const vId = typeof d.activeVariant === 'string' ? d.activeVariant : d.activeVariant.id;
            setActiveVariant(VARIANTS[vId] || { id: vId, name: d.activeVariant.name || vId });
        }
        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true);
            setCurrentShowdownIdx(0);
            const rawWinners = d.showdownWinners || [];
            setShowdownWinners([...rawWinners]);
            setWinning5Ids(d.winning5Ids || []);
            const durationPerWinner = 4000;
            const totalDuration = (d.activeVariant?.id || d.activeVariant) === 'HILOW' ? 8000 : 4000;
            if (rawWinners.length > 1) {
                for (let i = 1; i < rawWinners.length; i++) { setTimeout(() => setCurrentShowdownIdx(i), i * durationPerWinner); }
            }
            setTimeout(() => setPotTransferring(false), totalDuration);
        }
    };
    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('lobbyUpdate', (list) => setActiveTables(list || []));
    socket.on('profilesUpdate', (list) => { setAllProfiles(list || []); setUserProfile(prev => { if (!prev) return prev; const me = list?.find(p => p.uid === prev.uid || p.name === prev.name); return me ? { ...prev, chips: me.chips } : prev; }); });
    socket.on('loginSuccess', (p) => { setUserProfile(p); setPendingVariantId(p.pendingVariant || 'HOLDEM'); setCurrentView(VIEWS.LOBBY); socket.emit('getInitialData'); });
    socket.on('log', (d) => setLogs(prev => [...prev, { id: Math.random() + '-' + Date.now(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), ...d }].slice(-100)));
    
    socket.emit('getInitialData');
    return () => { 
        socket.off('connect'); socket.off('disconnect'); socket.off('initialDataResponse');
        socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); socket.off('loginSuccess'); socket.off('log'); 
    };
  }, []);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#020408] flex items-center justify-center p-6 text-white uppercase font-black">
        <div className="w-full max-w-[400px] p-10 md:p-14 bg-black/80 border border-white/10 rounded-[3rem] backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col items-center gap-10">
            <Lock size={44} className="text-yellow-500 animate-pulse" />
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="ARENA KEY" className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl text-center tracking-[0.8em] text-[#fbbf24] outline-none text-2xl font-black uppercase"/>
            <button onClick={handleLogin} className="w-full p-6 bg-gradient-to-r from-amber-400 to-yellow-600 text-black rounded-2xl font-black text-xl transition-all hover:scale-[1.02] active:scale-95 shadow-2xl uppercase">AUTHENTICATE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white uppercase font-black overflow-hidden pt-[env(safe-area-inset-top)]">
        <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-3 md:p-8 flex flex-row md:flex-col gap-2 md:gap-4 bg-black/20 shrink-0">
            <h2 className="hidden md:flex text-[#fbbf24] items-center gap-2 mb-4 font-mono italic"><ShieldCheck size={20}/> ADMIN CORE</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[9px] md:text-xs font-black font-mono tracking-widest ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black shadow-[0_0_15px_#fbbf24]' : 'bg-white/5'}`}>PLAYER REGISTRY</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[9px] md:text-xs font-black font-mono tracking-widest ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black shadow-[0_0_15px_#fbbf24]' : 'bg-white/5'}`}>ARENA CONTROL</button>
            <button onClick={() => { if(!nuclearConfirm) { setNuclearConfirm(true); setTimeout(()=>setNuclearConfirm(false), 3000); } else { socket.emit('adminNuclearReset'); setNuclearConfirm(false); } }} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all uppercase ${nuclearConfirm ? 'bg-red-600 border-white text-white' : 'bg-white/5 text-red-500 border-red-500/20'}`}><Bomb size={14}/> {nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</button>
            <button onClick={()=>setCurrentView(VIEWS.LOBBY)} className="flex-1 md:flex-none p-2.5 md:p-4 rounded-xl bg-cyan-600 text-black font-black text-[9px] md:text-xs font-mono tracking-widest">EXIT TO LOBBY</button>
        </aside>
        <main className="flex-1 p-5 md:p-12 overflow-y-auto bg-black/40">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-[#fbbf24] pl-4 font-mono italic uppercase">Registry Access</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10 shadow-inner">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="PLAYER NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm font-mono"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="SECURE KEY" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm font-mono"/>
                        <button onClick={() => { if(newPlayer.name) { socket.emit('adminCreatePlayer', { ...newPlayer, uid: Math.random().toString(36).slice(2) }); setNewPlayer({name:'', chips:100, password:''}); } }} className="bg-[#fbbf24] text-black rounded-xl font-black p-3 text-sm font-mono tracking-widest">CREATE PROFILE</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                        {allProfiles.map(p => (
                            <div key={p.uid} className="flex flex-col md:flex-row justify-between p-4 border-b border-white/5 gap-4 md:items-center hover:bg-white/5 transition-colors">
                                <span className="text-[10px] md:text-sm font-black truncate max-w-[100px] font-mono italic">{String(p.name)}</span>
                                <div className="flex gap-4 items-center font-mono">
                                    {editingPlayerUid === p.uid ? (
                                        <div className="flex items-center gap-2 animate-in slide-in-from-right duration-300">
                                            <input type="number" value={editChipsValue} onChange={(e) => setEditChipsValue(Number(e.target.value))} className="w-20 bg-black/40 border border-emerald-500/50 rounded px-2 py-1 text-emerald-400 text-xs" />
                                            <button onClick={() => { socket.emit('adminEditChips', {uid: p.uid, chips: editChipsValue}); setEditingPlayerUid(null); }} className="text-emerald-400"><Check size={16}/></button>
                                            <button onClick={() => setEditingPlayerUid(null)} className="text-white/40"><X size={16}/></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <span className="text-emerald-400 text-xs md:text-lg">${Number(p.chips || 0).toLocaleString()}</span>
                                            <button onClick={()=>{ setEditingPlayerUid(p.uid); setEditChipsValue(p.chips); }} className="text-cyan-400 hover:scale-110 transition-transform"><Edit3 size={18}/></button>
                                        </div>
                                    )}
                                    {pendingDeletePlayerUid === p.uid ? (
                                        <div className="flex items-center gap-2 animate-in zoom-in duration-300">
                                            <button onClick={() => { socket.emit('adminDeletePlayer', p.uid); setPendingDeletePlayerUid(null); }} className="bg-red-600 text-white text-[8px] px-2 py-1 rounded font-black tracking-widest">SURE?</button>
                                            <button onClick={() => setPendingDeletePlayerUid(null)} className="text-white/40"><X size={14}/></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setPendingDeletePlayerUid(p.uid)} className="text-red-500 hover:scale-110 transition-transform"><Trash2 size={18}/></button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-emerald-500 pl-4 font-mono italic uppercase">Arena Deployment</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 border border-white/10 shadow-inner">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA DESIGNATION" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm font-mono"/>
                        <button onClick={() => { if(newTable.name) { socket.emit('adminCreateRoom', { ...newTable, id: 'room_' + Math.random().toString(36).slice(2, 9) }); setNewTable({name:'', sb:0.25, bb:0.5, minBuy:5, maxBuy:10}); } }} className="bg-emerald-600 text-white rounded-xl font-black p-3 text-sm font-mono tracking-widest">DEPLOY ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {activeTables.map(t => (
                            <div key={t.id} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10 font-mono shadow-md">
                              <div>
                                <h4 className="text-[#fbbf24] font-black text-xs md:text-lg italic">{String(t.name)}</h4>
                                <p className="text-[10px] text-white/40 tracking-[0.2em] uppercase">STAKES: ${t.sb}/${t.bb}</p>
                              </div>
                              {pendingDeleteTableId === t.id ? (
                                  <div className="flex items-center gap-3 animate-in slide-in-from-right duration-300">
                                      <button onClick={() => { socket.emit('adminDeleteRoom', t.id); setPendingDeleteTableId(null); }} className="bg-red-600 text-white px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest shadow-lg">TERMINATE NOW</button>
                                      <button onClick={() => setPendingDeleteTableId(null)} className="text-white/40 hover:text-white"><X size={20}/></button>
                                  </div>
                              ) : (
                                  <button onClick={() => setPendingDeleteTableId(t.id)} className="bg-red-950/40 px-4 py-2 rounded-xl text-red-500 font-black text-[10px] hover:bg-red-600 hover:text-white transition-all tracking-widest">TERMINATE</button>
                              )}
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
        <header className="h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-5 md:px-12 bg-black/40 backdrop-blur-md shrink-0 pt-[env(safe-area-inset-top)]">
          <h2 className="tracking-[0.2em] md:tracking-[0.4em] text-xs md:text-xl flex items-center gap-2 md:gap-4 font-black"><LayoutGrid className="text-[#fbbf24] w-3 md:w-6"/> LOBBY</h2>
          <div className="flex items-center gap-3 md:gap-10 font-black">
            <div className="flex flex-col items-end"><span className="text-emerald-400 font-mono text-xs md:text-2xl tracking-tighter">${Number(userProfile?.chips || 0).toLocaleString()}</span></div>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={16}/></button>
          </div>
        </header>
        <main className="flex-1 p-5 md:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-10 overflow-y-auto bg-gradient-to-br from-transparent to-white/5 font-black uppercase">
            {activeTables.map((t) => (
              <div key={t.id} className="p-5 md:p-8 bg-white/5 border border-white/5 rounded-3xl flex flex-col gap-4 md:gap-6 shadow-2xl hover:border-[#fbbf24]/20 transition-all group relative overflow-hidden font-black">
                <h3 className="text-lg md:text-2xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors uppercase font-black">{String(t.name)}</h3>
                <div className="bg-black/60 p-4 md:p-6 rounded-2xl flex justify-between items-center border border-white/5 shadow-inner uppercase font-black">
                  <div className="flex flex-col font-black"><span className="text-[7px] md:text-[8px] text-white/40 tracking-widest">STAKES</span><span className="text-[#fbbf24] text-base md:text-xl font-black">${t.sb}/${t.bb}</span></div>
                  <div className="flex flex-col items-end font-black"><span className="text-[7px] md:text-[8px] text-white/40 tracking-widest">SEATS</span><span className="text-white/80 font-mono text-[10px] md:text-base font-black">{t.players?.filter(p=>p).length || 0}/10</span></div>
                </div>
                <button onClick={()=>setSelectedTableForJoin(t)} className="relative z-20 w-full p-5 md:p-8 bg-emerald-600 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-[10px] font-black uppercase">ENTER ARENA</button>
              </div>
            ))}
        </main>
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
              <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-[#fbbf24]/30 rounded-3xl shadow-2xl flex flex-col gap-6 md:gap-10">
                <h3 className="text-xl md:text-3xl text-center text-[#fbbf24] underline underline-offset-8 uppercase font-black">{String(selectedTableForJoin.name)}</h3>
                <div className="space-y-4 font-black text-center uppercase">
                  <div className="flex justify-between items-center text-[10px] text-white/40 tracking-widest font-black"><span>BUY-IN AMOUNT</span><span className="text-emerald-400 text-lg md:text-2xl font-mono">${Math.min(buyInAmount, userProfile?.chips || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <input type="range" min={selectedTableForJoin.minBuy || 5} max={Math.min(selectedTableForJoin.maxBuy || 10, userProfile?.chips || 10)} step={0.25} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fbbf24]" />
                </div>
                <div className="flex gap-4">
                  <button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black text-[10px] uppercase">BACK</button>
                  <button onClick={joinRoom} disabled={isJoining} className={`flex-2 p-3.5 rounded-2xl shadow-lg transition-all text-[10px] font-black uppercase ${isJoining ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:scale-105 active:scale-95'}`}>{isJoining ? 'Joining...' : 'SIT DOWN'}</button>
                </div>
              </div>
            </div>
        )}
    </div>
  );

  return (
    <div className="h-screen bg-[#020408] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      {intelExpanded && (
        <div onClick={() => setIntelExpanded(false)} className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-md p-6 pt-[100px] flex flex-col animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[800px] mx-auto bg-slate-900/90 border border-yellow-500/20 rounded-3xl p-6 flex flex-col flex-1 overflow-hidden shadow-2xl mb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
               <div className="flex items-center gap-2"><Eye className="text-[#fbbf24]" size={20} /><h3 className="text-xl text-[#fbbf24] font-black uppercase font-mono tracking-widest italic">Intelligence Access</h3></div>
               <button onClick={() => setIntelExpanded(false)} className="text-white/40 hover:text-white"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide font-mono">
                {groupedLogs.map((hand) => (
                    <div key={hand.id} className="flex flex-col border border-white/5 rounded-2xl bg-black/40 overflow-hidden mb-4">
                      <button onClick={() => toggleHandExpansion(hand.id)} className={`flex flex-col items-start p-3 gap-1 transition-colors ${expandedHands.has(hand.id) ? 'bg-white/5' : 'hover:bg-white/5'}`}>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3"><span className="text-[11px] font-black uppercase text-cyan-400 tracking-widest">{hand.variantName}</span></div>
                          {hand.isOngoing && <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded animate-pulse">LIVE</span>}
                        </div>
                        <div className="flex flex-col w-full pl-6 mt-1 gap-1">
                          {hand.summaries.map((s, si) => (
                            <div key={si} className="flex flex-wrap items-baseline gap-2 text-left">
                              <span className="text-[12px] font-black text-white uppercase">{String(s.name)}</span>
                              <span className="text-[12px] font-black text-emerald-400">{String(s.amount)}</span>
                              <span className="text-[10px] font-black text-white/40 uppercase italic">/ {String(s.rank)}</span>
                            </div>
                          ))}
                        </div>
                      </button>
                    </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {showVisualControls && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-[1000px] h-[90vh] bg-slate-900 border-2 border-yellow-500/20 rounded-[3rem] p-10 flex flex-col gap-6 overflow-y-auto scrollbar-hide relative">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-2xl text-yellow-400 font-black uppercase font-mono">Arena Calibration</h3>
                    <button onClick={() => setShowVisualControls(false)} className="text-white/20 hover:text-white"><X size={32}/></button>
                </div>
                <div className="space-y-8 font-mono uppercase">
                    {[
                      { label: "Player Hole Cards", scale: 'heroCardScale', y: 'heroCardY', maxScale: 6 },
                      { label: "Player Name HUD", scale: 'badgeScale', y: 'badgeY', maxScale: 3 },
                      { label: "Total Pot $", scale: 'potScale', y: 'potY', maxScale: 4 },
                      { label: "Community Cards", scale: 'commCardScale', y: 'commCardY', maxScale: 4 },
                      { label: "Chip Bet Satellites", scale: 'betScale', y: 'betY', maxScale: 3 },
                    ].map((cfg, idx) => (
                      <div key={idx} className="flex flex-col gap-4 bg-black/40 p-6 rounded-2xl border border-white/5 shadow-inner">
                        <h4 className="text-yellow-500 font-black">{cfg.label}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-white/40">Size Scale ({visuals[cfg.scale]?.toFixed(2) || '1.0'})</label>
                            <input type="range" min="0.5" max={cfg.maxScale} step="0.05" value={visuals[cfg.scale] || 1} onChange={(e) => setVisuals({...visuals, [cfg.scale]: Number(e.target.value)})} className="accent-yellow-500" />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-[10px] text-white/40">Y-Axis Offset ({visuals[cfg.y]}px)</label>
                            <input type="range" min="-300" max="300" step="1" value={visuals[cfg.y]} onChange={(e) => setVisuals({...visuals, [cfg.y]: Number(e.target.value)})} className="accent-yellow-500" />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                <button onClick={() => setShowVisualControls(false)} className="w-full py-6 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-2xl text-black font-black">SAVE ARENA CONFIG</button>
            </div>
        </div>
      )}

      <header className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-2 md:px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black pt-[env(safe-area-inset-top)]" style={{ height: `calc(${headerHeight}px + env(safe-area-inset-top))` }}>
        <div className="flex items-center gap-1.5 overflow-hidden flex-1">
            <button onClick={() => setShowRulesModal(true)} className="bg-white/5 hover:bg-white/10 transition-colors px-2 py-1.5 rounded-xl border border-white/5 shadow-inner truncate font-black uppercase flex flex-col justify-center min-w-[70px] md:min-w-[110px] h-[44px] md:h-[56px] text-left">
              <span className="text-[#fbbf24] text-[8px] md:text-[10px] leading-none mb-0.5 uppercase tracking-wider flex items-center gap-1">This Hand: <Info size={8} /></span>
              <span className="text-white text-[10px] md:text-sm truncate leading-none font-mono italic">{String(activeVariant?.name || "Hold'em")}</span>
            </button>
            <div className="bg-white/5 border border-white/10 px-2 py-1.5 rounded-xl flex flex-col justify-center shadow-inner min-w-[70px] md:min-w-[110px] h-[44px] md:h-[56px]">
              <span className="text-cyan-400 text-[8px] md:text-[10px] leading-none mb-0.5 uppercase tracking-wider">On My Deal:</span>
              <select value={pendingVariantId} onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile?.uid, pendingVariant: e.target.value}); }} className="bg-transparent text-white outline-none text-[10px] md:text-sm cursor-pointer font-black uppercase appearance-none leading-none w-full font-mono italic">
                {Object.entries(VARIANTS).map(([k,v]) => (<option key={k} value={k} className="bg-slate-900">{isMobile ? k : v.name}</option>))}
              </select>
            </div>
        </div>
        <div className="flex items-center gap-1.5 md:gap-4">
          <div className="flex gap-1 md:gap-2.5 items-center">
              <button onClick={() => socket.emit('adminAddBot', { roomId: currentRoomId })} className={`${isConnected ? 'text-indigo-400' : 'text-white/20'} p-2 md:p-3 bg-white/5 border border-white/10 rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors shadow-lg active:scale-95`} title={isConnected ? "Add Bot" : "Connecting..."}>{isConnected ? <Bot size={18}/> : <Activity size={18} className="animate-pulse" />}</button>
              <button onClick={() => setIntelExpanded(!intelExpanded)} className={`${intelExpanded ? 'text-white bg-indigo-600' : 'text-[#fbbf24] bg-white/5'} p-2 md:p-3 border border-white/10 rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors`}><Eye size={18}/></button>
              <button onClick={() => setShowVisualControls(true)} className="text-cyan-400 p-2 md:p-3 bg-white/5 border border-white/10 rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors"><Settings size={18}/></button>
              <button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid });setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2 md:p-3 bg-white/5 border border-white/10 rounded-xl font-black h-[40px] w-[40px] md:h-[52px] md:w-[52px] flex items-center justify-center hover:bg-white/10 transition-colors"><LogOut size={18}/></button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-[#0f3d2e]/40 to-black overflow-hidden px-1 py-1 font-black uppercase">
        <div style={{ transform: `scale(${visuals.tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + visuals.footerHeight + 40}px)` }} className="relative w-full max-w-[1400px] aspect-[15/10] md:aspect-[21/10] flex items-center justify-center h-full origin-center font-black">
            <div className="absolute inset-0 bg-[#0f3d2e]/60 rounded-[50%] border-[3vw] md:border-[2.5vw] border-slate-900/80 shadow-[inset_0_0_20vw_rgba(0,0,0,0.9),0_20px_100px_rgba(0,0,0,0.5)] border-double font-black uppercase overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/felt.png')]" />
            </div>
            <div className="absolute inset-0 pointer-events-none z-20 font-black uppercase">
              {(players || []).map((p, i) => { if (!p) return null; const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; return (<Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} seatIdx={i} visuals={visuals} timeRemaining={timeRemaining} isCollectingBets={potTransferring} />); })}
            </div>
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center">
              {!potTransferring && ( 
                <div className={`flex flex-col items-center transition-all duration-300 font-black uppercase`} style={{ transform: `scale(${visuals.potScale || 1.1}) translateY(${visuals.potY || 0}px)` }}>
                  <div className={`text-[12vw] md:text-[6vw] font-black text-yellow-500 font-mono tracking-tighter drop-shadow-[0_0_30px_rgba(251,191,36,0.8)] ${potAnimating ? 'animate-pot-pulse' : ''}`}>
                    ${Number(totalDisplayPot).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </div>
                </div> 
              )}
              {community.length > 0 && (
                <div className="flex gap-2 md:gap-4 mt-6 md:mt-14 font-black uppercase transition-transform" style={{ transform: `scale(${visuals.commCardScale}) translateY(${visuals.commCardY}px)` }}>
                  {community.map((c, j) => (<div key={c.id || j} className={`w-[6vw] md:w-[3vw] h-[9vw] md:h-[5vw] rounded-lg border bg-white flex flex-col items-center justify-center text-black font-black transition-all duration-500 ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-115 z-30 shadow-[0_0_50px_rgba(251,191,36,0.8)]' : 'border-white/10 shadow-2xl'}`}><span className="text-[11px] md:text-[1vw] font-black leading-none font-mono">{String(c.value)}</span><span className={`text-[14px] md:text-[2.5vw] font-black leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></div>))}
                </div>
              )}
            </div>
        </div>
      </main>

      <footer style={{ height: `calc(${visuals.footerHeight}px + env(safe-area-inset-bottom))` }} className="bg-[#05070a]/95 backdrop-blur-3xl border-t border-white/5 flex flex-col z-[100] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] shrink-0 font-black uppercase overflow-visible pb-[env(safe-area-inset-bottom)]">
        <div className="flex-1 flex flex-col justify-center pt-2 md:pt-4 pb-2 px-3 md:px-10 relative bg-white/[0.02] shadow-inner font-black uppercase overflow-visible">
          {activeVariant?.id === 'HILOW' && heroPlayerObj && !heroPlayerObj.isFolded && phase !== PHASES.IDLE && (
            <>
              <div className="absolute top-2 left-2 z-[110] animate-in slide-in-from-left duration-500">
                 <div className="flex flex-col items-start bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-500/20 shadow-xl">
                    <span className="text-[5px] md:text-[8px] text-white/40 tracking-[0.2em] font-black uppercase leading-none mb-1">Low Hand Strength</span>
                    <span className="text-[10px] md:text-[18px] text-emerald-400 font-black uppercase leading-none font-mono italic mb-0.5">{String(heroPlayerObj.lowStrength || "...")}</span>
                    <span className="text-[10px] md:text-[14px] text-yellow-400 font-mono italic leading-none font-black">{Math.round(heroPlayerObj.winProbabilityLow || 0)}% WIN</span>
                 </div>
              </div>
              <div className="absolute top-2 right-2 z-[110] animate-in slide-in-from-right duration-500">
                 <div className="flex flex-col items-end bg-purple-950/40 px-3 py-1 rounded-lg border border-purple-500/20 shadow-xl">
                    <span className="text-[5px] md:text-[8px] text-white/40 tracking-[0.2em] font-black uppercase leading-none mb-1">High Hand Strength</span>
                    <span className="text-[10px] md:text-[18px] text-purple-400 font-black uppercase leading-none font-mono italic mb-0.5">{String(heroPlayerObj.strength || "...")}</span>
                    <span className="text-[10px] md:text-[14px] text-yellow-400 font-mono italic leading-none font-black">{Math.round(heroPlayerObj.winProbabilityHigh || 0)}% WIN</span>
                 </div>
              </div>
            </>
          )}
          {activeIdx === heroIdx && phase !== PHASES.IDLE && heroPlayerObj ? (
            <div className="flex flex-col gap-3 md:gap-5 animate-in slide-in-from-bottom duration-500 items-center w-full font-black uppercase">
                {activeVariant?.id !== 'HILOW' && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/60 px-6 py-2 rounded-2xl border border-white/5 flex flex-col items-center">
                        <span className="text-sm md:text-xl text-purple-400 italic mb-0.5 font-black uppercase font-mono">{String(heroPlayerObj.strength || "...")}</span>
                        <span className="text-xs md:text-lg text-yellow-400 font-mono font-black italic">{Math.round(heroWinProb)}% Win Probability</span>
                    </div>
                )}
                <div className="mt-12 flex gap-2 w-full max-w-[700px] font-black uppercase">
                    <button onClick={()=>handleAction('RAISE', highestBet + Math.floor(potAmount * 0.5))} className="flex-1 h-8 md:h-12 bg-white/5 border border-white/10 rounded-lg text-[9px] md:text-[14px] hover:bg-white/15 transition-all font-black uppercase flex items-center justify-center tracking-widest font-mono">1/2 POT</button>
                    <button onClick={()=>handleAction('RAISE', highestBet + potAmount)} className="flex-1 h-8 md:h-12 bg-white/5 border border-white/10 rounded-lg text-[9px] md:text-[14px] hover:bg-white/15 transition-all font-black uppercase flex items-center justify-center tracking-widest font-mono">POT</button>
                    <button onClick={handleAllIn} className="flex-1 h-8 md:h-12 bg-red-950/50 border border-red-500/40 rounded-lg text-[9px] md:text-[14px] text-red-500 hover:bg-red-600 hover:text-white transition-all font-black uppercase flex items-center justify-center tracking-widest shadow-lg font-mono">ALL-IN</button>
                </div>
                <div className="flex flex-row gap-2 w-full items-center justify-center font-black">
                    <button onClick={()=>handleAction('FOLD')} className="flex-1 h-12 md:h-20 bg-gradient-to-b from-red-950/80 to-red-900/60 border border-red-500/30 rounded-xl tracking-widest hover:brightness-125 transition-all font-black text-[11px] md:text-lg shadow-2xl uppercase font-mono">FOLD</button>
                    <button onClick={()=>handleAction('CALL')} className="flex-1 h-12 md:h-20 bg-gradient-to-b from-indigo-950/80 to-indigo-900/60 border border-indigo-400/30 rounded-xl text-[11px] md:text-2xl tracking-widest hover:brightness-125 font-black shadow-2xl uppercase px-2 truncate font-mono">{highestBet > heroPlayerObj.currentBet ? (highestBet - heroPlayerObj.currentBet >= heroPlayerObj.chips ? `ALL-IN` : `CALL $${(highestBet - heroPlayerObj.currentBet).toLocaleString()}`) : 'CHECK'}</button>
                    <div className="flex-[2] flex gap-2 items-center bg-[#0d1117] border border-yellow-500/20 p-1 md:p-2 rounded-xl shadow-[inset_0_2px_20px_rgba(0,0,0,1)] font-black uppercase overflow-hidden">
                        <div className="flex items-center bg-black/80 px-3 md:px-6 rounded-lg border border-white/5 h-10 md:h-16 font-black uppercase flex-1 shadow-inner group">
                            <span className="text-yellow-500 text-[12px] md:text-2xl font-mono mr-1.5 animate-pulse">$</span>
                            <input type="number" step="0.25" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet), Math.max(0, Number(e.target.value))))} className="w-full bg-transparent text-center font-mono text-sm md:text-4xl text-yellow-400 outline-none font-black tracking-tighter" />
                        </div>
                        <button onClick={()=>handleAction('RAISE', raiseInput)} className="flex-1 h-10 md:h-16 bg-gradient-to-r from-yellow-600 to-amber-700 border border-yellow-400/30 rounded-lg flex items-center justify-center hover:brightness-125 font-black uppercase text-[10px] md:text-2xl shadow-2xl tracking-tighter group font-mono">
                            <Zap size={18} className="mr-1 text-black group-hover:scale-125 transition-transform"/> BET
                        </button>
                    </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase overflow-visible">
                {phase === PHASES.SHOWDOWN && showdownWinners && showdownWinners.length > 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 md:gap-3 animate-in fade-in zoom-in duration-700 relative overflow-visible">
                        <div className="flex items-center gap-2 text-yellow-400 animate-pulse-glow font-black tracking-[0.3em] text-[10px] md:text-xl uppercase text-center px-4 drop-shadow-[0_0_20px_rgba(251,191,36,0.7)] bg-yellow-400/5 py-1 rounded-full border border-yellow-400/10">
                            <Trophy size={14} className="md:size-6" /> 
                            {showdownWinners.length === 1 
                              ? (showdownWinners[0].rank === "!" ? `${String(showdownWinners[0].name)} SWEEPS POT!` : `${String(showdownWinners[0].name)} WINS WITH ${String(showdownWinners[0].rank)}`)
                              : (showdownWinners.every(w => w.name === showdownWinners[0].name) ? `${String(showdownWinners[0].name)} WON BOTH POTS!` : `POT SPLIT: ${String(showdownWinners[currentShowdownIdx].name)}`)
                            }
                        </div>
                        <div className="flex flex-nowrap overflow-x-auto w-full gap-3 md:gap-8 px-4 justify-center no-scrollbar pb-1 overflow-visible">
                            {showdownWinners[currentShowdownIdx] && (
                                <div key={currentShowdownIdx} className="flex items-center gap-4 md:gap-8 bg-slate-950/90 p-3 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-yellow-500/40 shadow-[0_0_60px_rgba(0,0,0,0.8)] min-w-[240px] md:min-w-[500px] animate-showdown-card-pop shrink-0 font-mono">
                                    <div className="flex flex-col items-center shrink-0">
                                        <div className="text-white font-black text-[12px] md:text-2xl drop-shadow-2xl uppercase truncate max-w-[80px] md:max-w-none mb-0.5 tracking-tighter italic font-mono">{String(showdownWinners[currentShowdownIdx].name)}</div>
                                        <div className="bg-gradient-to-r from-yellow-400 to-amber-600 text-black px-3 py-0.5 rounded-full font-mono text-[10px] md:text-xl font-black shadow-inner tracking-widest">+${(showdownWinners[currentShowdownIdx].amount || 0).toLocaleString()}</div>
                                    </div>
                                    <div className="flex gap-1 md:gap-2 items-center justify-center">
                                        {(showdownWinners[currentShowdownIdx].hand || []).map((c, ci) => (
                                            <div key={ci} className="w-7 md:w-16 h-10 md:h-24 bg-white rounded-md md:rounded-xl flex flex-col items-center justify-center text-black shadow-2xl ring-1 ring-black/5 relative overflow-hidden" 
                                                 style={{ animation: `card-flip-hero 1.0s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`, animationDelay: `${0.4 + ci * 0.2}s`, opacity: 0 }}>
                                                <span className="text-[9px] md:text-[20px] font-black absolute top-0.5 left-1 leading-none font-mono">{String(c.value)}</span>
                                                <span className={`text-[14px] md:text-[36px] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : ( 
                    <div className="flex flex-col items-center justify-center relative font-black uppercase w-full">
                        <div className="flex flex-col items-center gap-1 md:gap-4 animate-in fade-in duration-500 font-black uppercase w-full max-w-[1000px]">
                          {phase === PHASES.IDLE ? (<div className="flex flex-col items-center gap-1 md:gap-3 font-mono italic animate-pulse text-white/20">ESTABLISHING SECURE ARENA...</div>) : (
                            <div className="flex flex-row items-center justify-between w-full gap-4 md:gap-10 px-4 md:px-8 animate-in fade-in duration-500 font-black uppercase">
                                <div className="flex flex-col items-start bg-yellow-950/20 px-5 py-2 rounded-2xl border border-yellow-500/20">
                                    <span className="text-yellow-500 text-[9px] md:text-[13px] animate-pulse mb-1 font-black tracking-widest font-mono">ACTION ON</span>
                                    <span className="text-white text-sm md:text-4xl font-mono italic drop-shadow-2xl uppercase leading-none truncate max-w-[100px] md:max-w-none font-black">{String(players[activeIdx]?.name || "OPPONENT")}</span>
                                </div>
                                {heroPlayerObj && !heroPlayerObj.isFolded && activeVariant?.id !== 'HILOW' && (
                                  <div className="flex items-center gap-4 md:gap-8 bg-slate-950/60 p-3 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-white/5 shadow-2xl">
                                      <div className="flex flex-col">
                                          <span className="text-[15px] md:text-[24px] text-purple-400 font-black uppercase tracking-tight italic mb-1 font-mono">{String(heroPlayerObj.strength || "...")}</span>
                                          <span className="text-yellow-400 text-sm md:text-lg font-mono tracking-tighter italic font-black">{Math.round(heroWinProb)}% Win Prob.</span>
                                      </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </div> 
                    </div>
                )}
            </div>
          )}
        </div>
      </footer>
      <style>{`
          @keyframes bet-slam { 0% { transform: translate(-50%, 0) scale(4); opacity: 0; filter: blur(20px); } 40% { transform: translate(-50%, 0) scale(0.8); opacity: 1; filter: blur(0); } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; } }
          .animate-bet-slam { animation: bet-slam 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
          @keyframes bet-vortex { 0% { transform: translate(-50%, 0) rotate(0deg) scale(1); opacity: 1; } 80% { transform: translate(calc(-50% + var(--target-x, 0px)), -40vh) rotate(360deg) scale(0.2); opacity: 0.8; } 100% { transform: translate(calc(-50% + var(--target-x, 0px)), -45vh) rotate(720deg) scale(0); opacity: 0; filter: blur(15px); } }
          .animate-bet-vortex { animation: bet-vortex 0.7s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; }
          @keyframes pot-pulse { 0% { transform: scale(1); filter: drop-shadow(0 0 10px #fbbf24); } 50% { transform: scale(1.1); filter: drop-shadow(0 0 50px #fbbf24) brightness(1.5); } 100% { transform: scale(1); filter: drop-shadow(0 0 10px #fbbf24); } }
          .animate-pot-pulse { animation: pot-pulse 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          @keyframes showdown-pop { 0% { transform: scale(0.8) translateY(20px); opacity: 0; filter: brightness(0) blur(10px); } 100% { transform: translate(0,0) scale(1) translateY(0); opacity: 1; filter: brightness(1) blur(0px); } }
          .animate-showdown-card-pop { animation: showdown-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes card-flip-hero { 0% { transform: rotateY(180deg) scale(0.1); opacity: 0; filter: blur(20px); } 100% { transform: rotateY(0deg) scale(1); opacity: 1; filter: blur(0px); } }
          html, body { overscroll-behavior-y: contain; height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; background-color: #020408; }
      `}</style>
    </div>
  );
};

export default App;
