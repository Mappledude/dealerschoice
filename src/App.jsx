import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare, Clock, BarChart3
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
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', desc: '2 Hole Cards' }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA', desc: '4 Hole Cards (Use 2)' }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', desc: '3 Hole Cards' }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', desc: 'Low Hand Wins' },
  HILOW: { id: 'HILOW', name: 'Hi-Low Split', desc: '4 Hole Cards' },
  REDSBLACKS: { id: 'REDSBLACKS', name: 'Reds & Blacks', desc: '4 Hole Cards (Joker logic)' }
};

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  strengthLabel, potTransferring, timeRemaining, isHero, hiLowAwards, 
  cardScale, relativeIdx, holeCardRotation, playerBadgeOffset,
  handStrengthYOffset, handStrengthXOffset
}) => {
    if (!player || !displayPos) return null;
    const isShowdown = phase === PHASES.SHOWDOWN;
    const currentCardScale = isHero ? cardScale : 1.0;

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'}`}>
            <div style={{ transform: `translateY(${playerBadgeOffset}px)` }} className={`relative z-50 flex flex-col items-center p-1.5 rounded-2xl border-2 bg-slate-900/95 backdrop-blur-md min-w-[100px] md:min-w-[150px] shadow-2xl ${isActiveTurn ? 'border-cyan-400 ring-4 ring-cyan-400/40 scale-105' : 'border-white/10'}`}>
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="absolute -top-2 w-full px-2 h-1.5 z-[60]">
                        <div className="w-full h-full bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400 transition-all duration-1000 linear" style={{ width: `${(timeRemaining / 30) * 100}%` }} />
                        </div>
                    </div>
                )}
                <div className="flex flex-col items-center gap-0.5 w-full uppercase">
                    <span className="text-[10px] md:text-[12px] font-black text-white/90 truncate w-full text-center px-2">{String(player.name || "Anon")}</span>
                    <span className="text-[11px] md:text-[14px] font-mono font-black text-emerald-400">${Number(player.chips || 0).toLocaleString()}</span>
                    {isActiveTurn && <span className="text-[7px] text-cyan-400 font-black animate-pulse tracking-widest mt-0.5">THINKING...</span>}
                </div>
            </div>

            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative z-10 flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible">
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const offset = ci - mid;
                        const currentRotation = offset * (player.hand.length > 2 ? holeCardRotation * 0.6 : holeCardRotation);
                        return (
                          <div key={ci} className={`w-[5.5vw] md:w-[3vw] h-[8vw] md:h-[5vw] rounded-[4px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-300 ${isShowdown || isHero ? 'bg-white text-black' : 'bg-slate-800'}`} 
                              style={{ transform: `translateX(${offset * (player.hand.length > 2 ? 1.4 : 2.5)}vw) rotate(${currentRotation}deg) scale(${1.5 * currentCardScale})`, transformOrigin: 'bottom center', top: player.hand.length > 2 ? '15px' : '45px' }}>
                              {(isShowdown || isHero) && (<><span className="text-[10px] md:text-[12px] font-black">{String(c.value)}</span><span className={`text-[12px] md:text-[16px] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></>)}
                          </div>
                        );
                    })}
                    {strengthLabel && (isHero || isShowdown) && phase !== PHASES.IDLE && (
                        <div className="absolute -bottom-12 z-[120] bg-purple-600/90 px-3 py-1 rounded-full border border-purple-400" style={{ transform: `translate(${handStrengthXOffset}px, ${handStrengthYOffset}px)`, bottom: '-15px' }}>
                             <span className="text-[9px] md:text-[11px] font-black uppercase text-white">{phase === PHASES.PRE_FLOP ? "Pre-flop" : String(strengthLabel)}</span>
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
  const [buyInAmount, setBuyInAmount] = useState(10);
  const [isCollectingBets, setIsCollectingBets] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 5000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 0.25, bb: 0.50, minBuy: 10, maxBuy: 10, pendingVariant: 'HOLDEM' });
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potAnimating, setPotAnimating] = useState(false);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Dealers Choice v0.1 Official Defaults
  const [headerHeight, setHeaderHeight] = useState(64); 
  const [footerHeight, setFooterHeight] = useState(200); 
  const [tableZoom, setTableZoom] = useState(0.75); // 75%
  const [heroCardScale, setHeroCardScale] = useState(2.5); // 250%
  const [communityCardScale, setCommunityCardScale] = useState(3.0); // 300%
  const [holeCardRotation, setHoleCardRotation] = useState(25); // 25 degrees
  const [playerBadgeOffset, setPlayerBadgeOffset] = useState(100); // 100px
  const [handStrengthYOffset, setHandStrengthYOffset] = useState(30); // 30px
  const [handStrengthXOffset, setHandStrengthXOffset] = useState(0); // 0px

  const [showLayoutControls, setShowLayoutControls] = useState(false);

  const viewRef = useRef(currentView);
  useEffect(() => { viewRef.current = currentView; }, [currentView]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + (p?.currentBet || 0), 0);
    return potAmount + currentBetsSum;
  }, [potAmount, players]);

  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => p && (p.uid === userProfile.uid || p.password === userProfile.password));
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);
  const isBrokeStatus = useMemo(() => !!heroPlayerObj?.isBust, [heroPlayerObj]);

  const minRaiseAllowed = useMemo(() => {
      return Math.max(highestBet + 0.50, highestBet * 2);
  }, [highestBet]);

  const handleAction = useCallback((type, amt = 0) => {
      if (!currentRoomId) return;
      socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(amt || raiseInput) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleLogin = useCallback(() => { 
      if (passwordInput === 'pass') { 
          socket.emit('getInitialData'); 
          setUserProfile({ name: 'SUPER ADMIN', uid: 'admin_1' }); 
          setCurrentView(VIEWS.ADMIN); 
      } 
      else { socket.emit('playerLogin', { password: passwordInput }); }
  }, [passwordInput]);

  const handleCreatePlayer = useCallback(() => {
      if (!newPlayer.name || !newPlayer.password) return;
      socket.emit('adminCreatePlayer', { ...newPlayer, uid: 'p_' + Math.random().toString(36).slice(2, 9) });
      setNewPlayer({ name: '', chips: 5000, password: '' });
  }, [newPlayer]);

  const handleSpawnArena = useCallback(() => {
    if (!newTable.name) return;
    const id = 'room_' + Math.random().toString(36).slice(2, 9);
    socket.emit('adminCreateRoom', { ...newTable, id });
    setNewTable({ name: '', sb: 0.25, bb: 0.50, minBuy: 10, maxBuy: 10, pendingVariant: 'HOLDEM' });
  }, [newTable]);

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile) return;
    socket.emit('joinRoom', { roomId: selectedTableForJoin.id, profile: { ...userProfile, pendingVariant: pendingVariantId }, buyIn: buyInAmount }, (res) => {
        if (res?.status === 'ok') { setCurrentRoomId(selectedTableForJoin.id); setCurrentView(VIEWS.GAME); setSelectedTableForJoin(null); }
    });
  }, [selectedTableForJoin, userProfile, pendingVariantId, buyInAmount]);

  useEffect(() => {
    const handleLobbyUpdate = (list) => setActiveTables(list || []);
    const handleProfilesUpdate = (list) => setAllProfiles(list || []);
    const handleInitialData = (d) => {
        if (d.rooms) setActiveTables(d.rooms);
        if (d.profiles) setAllProfiles(d.profiles);
    };
    const handleLoginSuccess = (p) => { 
        if (viewRef.current === VIEWS.ADMIN) return;
        setUserProfile(p); 
        setPendingVariantId(p.pendingVariant || 'HOLDEM'); 
        setCurrentView(VIEWS.LOBBY); 
        socket.emit('getInitialData'); 
    };

    socket.on('lobbyUpdate', handleLobbyUpdate);
    socket.on('profilesUpdate', handleProfilesUpdate);
    socket.on('initialDataResponse', handleInitialData);
    socket.on('loginSuccess', handleLoginSuccess);

    return () => {
        socket.off('lobbyUpdate', handleLobbyUpdate);
        socket.off('profilesUpdate', handleProfilesUpdate);
        socket.off('initialDataResponse', handleInitialData);
        socket.off('loginSuccess', handleLoginSuccess);
    };
  }, []);

  useEffect(() => {
    const handleRoomUpdate = (d) => {
        if (!d) return;
        if (d.id) setCurrentRoomId(d.id);
        const currentPotValue = Number(d.potData?.[0]?.amount || 0);
        const potIncreased = currentPotValue > potAmount;

        if (d.phase !== phase && phase !== PHASES.IDLE) {
            setIsCollectingBets(true);
            setTimeout(() => {
                setIsCollectingBets(false);
                if (potIncreased) { setPotAnimating(true); setTimeout(() => setPotAnimating(false), 600); }
            }, 1200);
        } else if (potIncreased && d.phase === phase) {
             setPotAnimating(true); setTimeout(() => setPotAnimating(false), 600);
        }

        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true);
            setShowdownWinners(d.showdownWinners || null);
            setTimeout(() => setPotTransferring(false), 7500);
        }

        setPlayers(() => { 
            const next = [...INITIAL_PLAYERS]; 
            (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
            return next; 
        });

        setPhase(d.phase); setCommunity(d.community || []); 
        setHighestBet(Number(d.highestBet) || 0); setActiveIdx(d.activeIdx ?? -1); setWinning5Ids(d.winning5Ids || []);
        setPotAmount(currentPotValue);
        setTimeRemaining(Number(d.timeRemaining) || 30);
    };

    const handleLog = (d) => {
        const entry = { id: Math.random(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), ...d };
        setLogs(prev => [entry, ...prev].slice(0, 50));
    };

    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('log', handleLog);

    return () => { 
        socket.off('roomUpdate', handleRoomUpdate); 
        socket.off('log', handleLog); 
    };
  }, [phase, potAmount]);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white font-black uppercase tracking-tighter">
        <div className="w-full max-w-[400px] p-8 md:p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8">
            <Lock size={32} className="text-[#fbbf24]" />
            <div className="w-full space-y-4">
                <label className="text-[10px] text-white/40 block ml-2 tracking-widest font-black uppercase">ACCESS PASSCODE</label>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-xl font-black uppercase"/>
            </div>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl hover:scale-[1.02] font-black text-lg transition-transform uppercase">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white font-black uppercase overflow-hidden font-black">
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 p-4 md:p-8 flex flex-row md:flex-col gap-4 bg-black/20 shrink-0">
            <h2 className="text-[#fbbf24] tracking-widest hidden md:flex items-center gap-2 mb-4 font-black uppercase"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-3 md:p-4 rounded-xl text-xs md:text-sm transition-all font-black ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5 text-white/40'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-3 md:p-4 rounded-xl text-xs md:text-sm transition-all font-black ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5 text-white/40'}`}>TABLES</button>
            <button onClick={()=>{if(!nuclearConfirm){setNuclearConfirm(true); setTimeout(()=>setNuclearConfirm(false),3000);}else{socket.emit('adminNuclearReset'); setNuclearConfirm(false);}}} className={`hidden md:flex mt-auto p-4 rounded-xl items-center justify-center gap-2 border-2 transition-all font-black ${nuclearConfirm ? 'bg-red-600 border-white text-white animate-pulse' : 'bg-red-950/20 border-red-500 text-red-500'}`}>
                {nuclearConfirm ? <Bomb size={20}/> : <ShieldAlert size={20}/>}
                <span>{nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</span>
            </button>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="p-3 md:p-4 text-white/20 hover:text-white text-xs flex items-center gap-2 font-black uppercase"><ArrowLeft size={16}/></button>
        </aside>
        <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-black/40 font-black">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8 animate-in fade-in">
                    <h3 className="text-xl md:text-2xl tracking-widest border-l-4 border-[#fbbf24] pl-4 font-black uppercase">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10 shadow-xl">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#fbbf24] font-black uppercase"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#fbbf24] font-black uppercase"/>
                        <button onClick={handleCreatePlayer} className="bg-[#fbbf24] text-black rounded-xl font-black p-4 transition-all uppercase">CREATE</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10 font-black">
                        {(allProfiles || []).map(p => (
                            <div key={p.uid} className="flex justify-between p-4 md:p-6 border-b border-white/5 hover:bg-white/5 transition-all">
                                <span className="uppercase font-black">{String(p.name)} <span className="text-white/20 ml-2 font-black">[{String(p.password)}]</span></span>
                                <div className="flex gap-4 items-center font-black">
                                    <span className="text-emerald-400 font-mono text-sm md:text-lg tracking-tighter font-black uppercase font-black font-mono">${Number(p.chips || 0).toLocaleString()}</span>
                                    <button onClick={()=>{const n = prompt("NEW WALLET", p.chips); if(n) socket.emit('adminEditChips', {uid: p.uid, chips: Number(n)})}}><Edit3 size={18} className="text-cyan-400"/></button>
                                    <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)}><Trash2 size={18} className="text-red-500"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8 animate-in fade-in font-black uppercase">
                    <h3 className="text-xl md:text-2xl tracking-widest border-l-4 border-emerald-500 pl-4 font-black uppercase">ARENA CONTROL</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 border border-white/10 shadow-xl">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#fbbf24] font-black uppercase"/>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-black">
                            <div className="space-y-1"><span className="text-[9px] text-white/40 font-black tracking-widest uppercase font-black">SB</span><input value={newTable.sb} type="number" step="0.01" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[9px] text-white/40 font-black tracking-widest uppercase font-black">BB</span><input value={newTable.bb} type="number" step="0.01" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[9px] text-white/40 font-black tracking-widest uppercase font-black">MIN</span><input value={newTable.minBuy} type="number" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[9px] text-white/40 font-black tracking-widest uppercase font-black">MAX</span><input value={newTable.maxBuy} type="number" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})}/></div>
                        </div>
                        <button onClick={handleSpawnArena} className="bg-emerald-600 rounded-xl font-black p-4 uppercase transition-all font-black uppercase uppercase">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-black">
                        {(activeTables || []).map(t => (
                            <div key={t.id} className="bg-white/5 p-4 md:p-6 rounded-2xl flex justify-between items-center border border-white/10 hover:border-emerald-500/50 transition-all shadow-lg font-black uppercase">
                                <div><h4 className="text-[#fbbf24] text-base md:text-lg font-black truncate uppercase font-black uppercase">{String(t.name)}</h4><p className="text-[10px] text-white/40 tracking-widest font-black uppercase font-black font-mono">${t.sb}/${t.bb} | {t.players?.filter(Boolean).length || 0}/10 SEATED</p></div>
                                <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 p-2 md:p-3 rounded-xl text-red-500 hover:bg-red-500 transition-all font-black uppercase">TERMINATE</button>
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
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300 px-6 font-black uppercase">
                <div className="w-full max-w-[400px] p-8 md:p-12 bg-slate-900 border border-[#fbbf24]/30 rounded-[2vw] shadow-2xl flex flex-col gap-10">
                    <h3 className="text-2xl md:text-3xl text-center tracking-widest text-[#fbbf24] underline underline-offset-8 uppercase font-black uppercase">{String(selectedTableForJoin.name)}</h3>
                    <div className="space-y-6 font-black text-center uppercase">
                        <div className="flex justify-between items-center text-[10px] text-white/40 tracking-widest font-black uppercase uppercase"><span>FIXED BUY-IN</span><span className="text-emerald-400 text-xl md:text-2xl font-mono uppercase font-black">${buyInAmount.toLocaleString()}</span></div>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-[#fbbf24]" style={{width:'100%'}}/></div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black uppercase uppercase tracking-widest">BACK</button>
                        <button onClick={joinRoom} className="flex-2 p-5 bg-emerald-600 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all text-sm tracking-widest font-black uppercase uppercase tracking-widest">SIT DOWN</button>
                    </div>
                </div>
            </div>
        )}
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 md:px-12 bg-black/40 backdrop-blur-md shadow-xl z-50 shrink-0 font-black">
            <h2 className="tracking-widest md:tracking-[0.4em] text-sm md:text-xl flex items-center gap-4 font-black uppercase italic text-opacity-80 uppercase uppercase font-black"><LayoutGrid className="text-[#fbbf24]"/> Dealers Choice <span className="text-[10px] text-white/20 not-italic ml-2 font-black uppercase">v0.1</span></h2>
            <div className="flex items-center gap-6 md:gap-10 font-black">
                <div className="flex flex-col items-end font-black uppercase uppercase">
                    <span className="text-[8px] md:text-[10px] text-white/40 uppercase italic uppercase">ID: {String(userProfile?.name || "??")}</span>
                    <span className="text-emerald-400 font-mono text-base md:text-2xl tracking-tighter font-black uppercase font-black font-mono">${Number(userProfile?.chips || 0).toLocaleString()}</span>
                </div>
                <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all uppercase font-black"><LogOut size={24}/></button>
            </div>
        </header>
        <main className="flex-1 p-6 md:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 overflow-y-auto bg-gradient-to-br from-transparent to-white/5 font-black uppercase">
            {(activeTables || []).map((t) => (
                <div key={t.id} className="p-8 bg-white/5 border border-white/5 rounded-3xl flex flex-col gap-6 shadow-2xl hover:border-[#fbbf24]/20 transition-all group relative overflow-hidden font-black uppercase">
                    <h3 className="text-xl md:text-2xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors uppercase font-black uppercase font-black uppercase">{String(t.name)}</h3>
                    <div className="bg-black/60 p-4 md:p-6 rounded-2xl flex justify-between items-center border border-white/5 shadow-inner uppercase font-black uppercase font-black uppercase font-black uppercase font-mono">
                        <div className="flex flex-col font-black uppercase font-black uppercase uppercase font-black"><span className="text-[8px] text-white/40 tracking-widest font-black uppercase uppercase">STAKES</span><span className="text-[#fbbf24] text-lg md:text-xl font-black uppercase font-black uppercase uppercase font-black">${t.sb}/${t.bb}</span></div>
                        <div className="flex flex-col items-end font-black font-black uppercase uppercase font-black uppercase font-black uppercase font-black"><span className="text-[8px] text-white/40 tracking-widest font-black uppercase uppercase font-black uppercase font-black uppercase font-black">SEATS</span><span className="text-white/80 font-mono text-sm md:text-base font-black uppercase uppercase font-black uppercase font-black uppercase font-black">{t.players?.filter(p=>p).length || 0}/10</span></div>
                    </div>
                    <button 
                      onClick={()=>{setSelectedTableForJoin(t); setBuyInAmount(t.minBuy || 10);}} 
                      className="relative z-20 w-full p-6 md:p-8 bg-emerald-600 rounded-2xl tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all font-black uppercase cursor-pointer pointer-events-auto shadow-[0_0_20px_rgba(16,185,129,0.3)] uppercase tracking-widest uppercase font-black"
                    >
                      ENTER ARENA
                    </button>
                </div>
            ))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter font-black">
      
      {isBrokeStatus && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6 font-black uppercase uppercase font-black">
                <div className="w-full max-w-[400px] p-10 bg-slate-900 border-2 border-red-500 rounded-3xl text-center shadow-[0_0_100px_rgba(239,68,68,0.4)] font-black uppercase font-black">
                    <AlertTriangle size={80} className="text-red-500 animate-pulse mb-6 mx-auto uppercase font-black" />
                    <h2 className="text-3xl font-black mb-2 tracking-tighter uppercase uppercase font-black uppercase font-black">BUSTED!</h2>
                    <button onClick={() => socket.emit('adminAddChips', { roomId: currentRoomId, uid: userProfile.uid, chips: 10 })} className="w-full p-6 bg-emerald-600 text-white rounded-2xl shadow-xl animate-bounce font-black uppercase tracking-widest uppercase font-black uppercase font-black">REBUY $10.00</button>
                </div>
          </div>
      )}

      <header style={{ height: `${headerHeight}px` }} className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4 md:px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black uppercase font-black">
        <div className="flex items-center gap-2 font-black uppercase font-black uppercase font-black">
            <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 shadow-inner truncate font-black uppercase font-black uppercase font-black">
                <span className="text-[#fbbf24] text-[8px] md:text-[10px] tracking-widest font-black uppercase italic text-opacity-70 uppercase font-black uppercase font-black uppercase font-black">This Hand:</span>
                <span className="text-white ml-2 text-[10px] md:text-xs font-black uppercase font-black uppercase font-black uppercase font-black">{activeVariant?.name || "Hold'em"}</span>
            </div>
            <button onClick={() => setShowLayoutControls(!showLayoutControls)} className={`p-2 rounded-lg transition-all font-black uppercase ${showLayoutControls ? 'bg-[#fbbf24] text-black shadow-[0_0_15px_#fbbf24]' : 'bg-white/5 text-white/40'}`}>
                <Sliders size={18}/>
            </button>
        </div>

        {showLayoutControls && (
            <div className="absolute top-16 left-4 bg-black/95 border border-white/10 p-6 rounded-2xl shadow-2xl z-[1000] flex flex-col gap-5 min-w-[280px] max-h-[80vh] overflow-y-auto scrollbar-hide animate-in slide-in-from-top-4 backdrop-blur-xl font-black uppercase font-black">
                <div className="grid grid-cols-2 gap-4 font-black font-black uppercase font-black">
                    <div className="space-y-1 font-black uppercase font-black uppercase font-black"><span className="text-[8px] text-white/40 uppercase font-black tracking-widest uppercase font-black uppercase font-black uppercase font-black">HEADER</span><input type="range" min="40" max="100" value={headerHeight} onChange={(e)=>setHeaderHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none font-black font-black uppercase font-black"/></div>
                    <div className="space-y-1 font-black uppercase font-black uppercase font-black"><span className="text-[8px] text-white/40 uppercase font-black tracking-widest uppercase font-black uppercase font-black uppercase font-black">FOOTER</span><input type="range" min="120" max="400" value={footerHeight} onChange={(e)=>setFooterHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none font-black font-black uppercase font-black"/></div>
                </div>
                <div className="space-y-1 font-black uppercase font-black uppercase font-black"><span className="text-[8px] text-white/40 uppercase font-black tracking-widest uppercase font-black uppercase font-black uppercase font-black">TABLE ZOOM ({Math.round(tableZoom * 100)}%)</span><input type="range" min="0.5" max="1.5" step="0.05" value={tableZoom} onChange={(e)=>setTableZoom(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none font-black font-black uppercase font-black"/></div>
                <div className="space-y-1 font-black uppercase font-black uppercase font-black"><span className="text-[8px] text-white/40 uppercase text-emerald-400 font-black tracking-widest uppercase font-black uppercase font-black uppercase font-black">HERO CARD SIZE ({Math.round(heroCardScale * 100)}%)</span><input type="range" min="0.5" max="3.5" step="0.1" value={heroCardScale} onChange={(e)=>setHeroCardScale(Number(e.target.value))} className="w-full accent-emerald-500 h-1 bg-white/10 rounded-full appearance-none font-black font-black uppercase font-black"/></div>
                <div className="space-y-1 font-black uppercase font-black uppercase font-black"><span className="text-[8px] text-white/40 uppercase text-blue-400 font-black tracking-widest uppercase font-black uppercase font-black uppercase font-black">COMMUNITY CARD SIZE ({Math.round(communityCardScale * 100)}%)</span><input type="range" min="0.5" max="4.0" step="0.1" value={communityCardScale} onChange={(e)=>setCommunityCardScale(Number(e.target.value))} className="w-full accent-blue-500 h-1 bg-white/10 rounded-full appearance-none font-black font-black uppercase font-black"/></div>
                <div className="space-y-1 font-black uppercase font-black uppercase font-black"><span className="text-[8px] text-white/40 uppercase text-orange-400 font-black tracking-widest uppercase font-black uppercase font-black uppercase font-black">PLAYER BADGE OFFSET ({playerBadgeOffset}px)</span><input type="range" min="-200" max="200" step="1" value={playerBadgeOffset} onChange={(e)=>setPlayerBadgeOffset(Number(e.target.value))} className="w-full accent-orange-500 h-1 bg-white/10 rounded-full appearance-none font-black font-black uppercase font-black"/></div>
                <div className="grid grid-cols-2 gap-4 font-black font-black uppercase font-black">
                  <div className="space-y-1 font-black uppercase font-black uppercase font-black"><span className="text-[8px] text-white/40 uppercase text-purple-400 font-black tracking-widest uppercase font-black uppercase font-black uppercase font-black">STRENGTH Y ({handStrengthYOffset}px)</span><input type="range" min="-200" max="200" step="1" value={handStrengthYOffset} onChange={(e)=>setHandStrengthYOffset(Number(e.target.value))} className="w-full accent-purple-500 h-1 bg-white/10 rounded-full appearance-none font-black font-black uppercase font-black"/></div>
                  <div className="space-y-1 font-black uppercase font-black uppercase font-black"><span className="text-[8px] text-white/40 uppercase text-purple-400 font-black tracking-widest uppercase font-black uppercase font-black uppercase font-black">STRENGTH X ({handStrengthXOffset}px)</span><input type="range" min="-200" max="200" step="1" value={handStrengthXOffset} onChange={(e)=>setHandStrengthXOffset(Number(e.target.value))} className="w-full accent-purple-500 h-1 bg-white/10 rounded-full appearance-none font-black font-black uppercase font-black"/></div>
                </div>
                <div className="space-y-1 font-black font-black uppercase font-black"><span className="text-[8px] text-white/40 uppercase text-indigo-400 font-black tracking-widest uppercase font-black uppercase font-black uppercase font-black">HOLE CARD ROTATION ({holeCardRotation}°)</span><input type="range" min="0" max="45" step="1" value={holeCardRotation} onChange={(e)=>setHoleCardRotation(Number(e.target.value))} className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none font-black font-black uppercase font-black"/></div>
                <button onClick={()=>setShowLayoutControls(false)} className="bg-[#fbbf24] text-black font-black py-2 rounded-lg text-[10px] tracking-widest uppercase uppercase uppercase font-black font-black uppercase font-black">CLOSE</button>
            </div>
        )}

        <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-xl flex items-center gap-4 shadow-inner font-black uppercase uppercase uppercase font-black uppercase font-black">
            <span className="hidden sm:inline text-white/40 text-[9px] tracking-widest uppercase font-black uppercase uppercase uppercase font-black uppercase font-black">On my deal:</span>
            <select value={pendingVariantId} onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value}); }} className="bg-transparent text-[#fbbf24] outline-none text-xs cursor-pointer font-black uppercase uppercase uppercase font-black uppercase font-black">
                {Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900 font-black uppercase uppercase font-black font-black uppercase font-black">{v.name}</option>)}
            </select>
        </div>
        <div className="flex gap-2 font-black uppercase items-center font-black uppercase uppercase font-black uppercase font-black font-black uppercase font-black">
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl mr-2 font-mono text-[11px] text-[#fbbf24] shadow-inner uppercase font-black uppercase uppercase uppercase font-black uppercase font-black font-black uppercase font-black">
                <Clock size={14} />
                {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button onClick={() => socket.emit('adminAddBot', { roomId: currentRoomId })} className="text-indigo-400 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-indigo-400/20 font-black uppercase uppercase uppercase font-black uppercase font-black uppercase font-black uppercase font-black" title="Bot"><Bot size={20}/></button>
            <button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/20 font-black uppercase uppercase uppercase font-black uppercase font-black uppercase font-black uppercase font-black"><LogOut size={20}/></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-emerald-950/20 to-transparent overflow-hidden px-2 py-2 font-black uppercase tracking-tighter uppercase uppercase font-black uppercase font-black uppercase font-black">
        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 10}px)` }} className="relative w-full max-w-[1400px] aspect-[21/10] flex items-center justify-center h-full transition-transform duration-300 ease-out origin-center font-black uppercase font-black uppercase font-black">
            <div className="absolute inset-0 bg-[#0f3d2e]/40 rounded-[50%] border-[2vw] border-slate-900/60 shadow-[inset_0_0_15vw_rgba(0,0,0,0.8)] border-double uppercase font-black uppercase font-black" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden translate-y-[20%] uppercase font-black uppercase font-black">
                <span className="text-[12vw] font-black text-white/5 italic tracking-tighter uppercase select-none rotate-[-12deg] whitespace-nowrap uppercase font-black uppercase font-black uppercase font-black">{activeVariant?.name || "Hold'em"}</span>
            </div>

            <div className="absolute inset-0 pointer-events-none z-20 font-black uppercase uppercase font-black uppercase font-black">
              {(players || []).map((p, i) => {
                if (!p) return null;
                const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS;
                return (
                  <Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} strengthLabel={p.strength} isCollectingBets={isCollectingBets} timeRemaining={timeRemaining} isHero={i === heroIdx} cardScale={heroCardScale} relativeIdx={rIdx} holeCardRotation={holeCardRotation} playerBadgeOffset={playerBadgeOffset} handStrengthYOffset={handStrengthYOffset} handStrengthXOffset={handStrengthXOffset} />
                );
              })}
            </div>

            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center uppercase font-black uppercase font-black">
              {!potTransferring && (
                <div className={`flex flex-col items-center transition-all duration-300 font-black uppercase uppercase uppercase font-black uppercase font-black ${potAnimating ? 'scale-110' : 'scale-100'}`}>
                    <div className={`text-[6vw] md:text-[5vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] ${potAnimating ? 'animate-pot-pulse' : ''}`}>${Number(potAmount || 0).toLocaleString()}</div>
                </div>
              )}
              {['HOLDEM', 'OMAHA', 'PINEAPPLE', 'HILOW', 'MUFLIS', 'REDSBLACKS'].includes(activeVariant?.id) && (
                <div className="flex gap-2 md:gap-4 mt-6 md:mt-12 font-black uppercase transition-transform duration-300 uppercase uppercase font-black uppercase font-black" style={{ transform: `scale(${communityCardScale})` }}>
                    {(community || []).map((c, j) => (
                        <div key={c.id || j} className={`w-[6vw] md:w-[3vw] h-[9vw] md:h-[5vw] rounded-[4px] border bg-white flex flex-col items-center justify-center text-black font-black transition-all duration-300 ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 z-30 shadow-[0_0_40px_rgba(251,191,36,0.6)]' : 'border-white/20 shadow-2xl'} uppercase uppercase font-black uppercase font-black`}>
                            <span className="text-[14px] md:text-[0.9vw] font-black uppercase uppercase font-black uppercase font-black">{String(c.value)}</span><span className={`text-[18px] md:text-[2.2vw] font-black ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'} uppercase uppercase font-black uppercase font-black`}>{String(c.suit)}</span>
                        </div>
                    ))}
                </div>
              )}
            </div>
        </div>
      </main>

      <footer style={{ height: `${footerHeight}px` }} className="bg-black/95 backdrop-blur-3xl border-t border-white/10 flex z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 font-black uppercase overflow-hidden uppercase uppercase font-black uppercase font-black">
        <div className="flex w-[35%] border-r border-white/10 p-2 flex-col overflow-hidden text-[12px] font-mono tracking-widest font-black uppercase uppercase uppercase font-black uppercase font-black">
            <div className="text-white/40 mb-1 flex items-center justify-between border-b border-white/5 pb-1 px-1 uppercase tracking-tighter uppercase uppercase font-black uppercase font-black">
                <div className="flex items-center gap-1.5 font-black uppercase uppercase font-black uppercase font-black"><Eye size={12} className="text-[#fbbf24]"/> INTELLIGENCE</div>
                <div className="flex items-center gap-1 text-emerald-500 animate-pulse text-[10px] uppercase font-black uppercase font-black"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> LIVE</div>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide font-black p-0.5 uppercase uppercase font-black uppercase font-black">
                {(logs || []).map(l => (
                    <div key={l.id} className="animate-in slide-in-from-left duration-200 flex items-center gap-2 border-l-2 border-white/10 pl-2 py-0.5 hover:bg-white/5 transition-colors border-b border-white/5 uppercase font-black uppercase font-black">
                        <span className="text-white/20 text-[9px] font-black shrink-0 w-10 uppercase uppercase font-black uppercase font-black">{String(l.time)}</span> 
                        <div className="flex items-center gap-x-1.5 font-black leading-none overflow-hidden uppercase uppercase font-black uppercase font-black">
                            <span className={`font-black uppercase text-[11px] px-1.5 py-0.5 rounded-sm shrink-0 ${l.type === 'win' ? 'bg-emerald-500/20 text-emerald-400' : l.type === 'variant' ? 'bg-purple-500/20 text-purple-400' : l.type === 'fold' ? 'bg-red-500/20 text-red-400' : l.type === 'phase' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-yellow-500/20 text-[#fbbf24]'} uppercase uppercase font-black uppercase font-black`}>{String(l.name)}</span>
                            <span className="text-white/60 lowercase tracking-tight text-[11px] font-black truncate uppercase font-black uppercase font-black font-black uppercase font-black">{String(l.action)}</span>
                            {l.type === 'win' && l.cards && (
                                <div className="flex gap-0.5 ml-1 shrink-0 scale-90 origin-left uppercase uppercase font-black uppercase font-black">
                                    {l.cards.map((c, ci) => (
                                        <div key={ci} className={`flex items-center px-1 rounded-sm text-[8px] font-bold ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600 bg-white' : 'text-slate-900 bg-white'} uppercase uppercase font-black uppercase font-black`}>{c.value}{c.suit}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
        {/* Footer controls matches v0.1 logic */}
      </footer>
      <style>{`
          @keyframes fling-to-pot { 
            0% { transform: translate(-50%, -100%) scale(1.5); filter: blur(0px); opacity: 1; } 
            40% { transform: translate(calc(-50% + 20vw), -50vh) scale(0.8) rotate(360deg); filter: blur(2px); }
            100% { transform: translate(calc(-50% + (50vw - 50%)), -35vh) scale(0.1) rotate(1440deg); filter: blur(8px); opacity: 0; } 
          }
          @keyframes pot-pulse { 0% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } 50% { transform: scale(1.1); filter: drop-shadow(0 0 30px #fbbf24) brightness(1.2); } 100% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } }
          .animate-pot-pulse { animation: pot-pulse 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .bg-glimmer { background: linear-gradient(135deg, #fff 0%, #fff 40%, #fbbf24 50%, #fff 60%, #fff 100%); background-size: 200% 200%; animation: glimmer 3s infinite; }
          @keyframes glimmer { 0% { background-position: -100% -100%; } 100% { background-position: 200% 200%; } }
          .animate-pulse-glow { animation: pulse-glow 2s infinite ease-in-out; }
          @keyframes pulse-glow { 0% { box-shadow: 0 0 0px rgba(34,211,238,0); } 50% { box-shadow: 0 0 20px rgba(34,211,238,0.6); } 100% { box-shadow: 0 0 0px rgba(34,211,238,0); } }
          ::-webkit-scrollbar { display: none; }
          @keyframes bounce-short { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
          .animate-bounce-short { animation: bounce-short 1.5s ease-in-out infinite; }
          .animate-fling-to-pot { animation: fling-to-pot 0.9s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards; }
          @keyframes bet-splash { 0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
          .animate-bet-splash { animation: bet-splash 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes showdown-pop { 0% { transform: scale(0.7) translateY(40px) rotateX(-20deg); opacity: 0; } 100% { transform: scale(1) translateY(0) rotateX(0deg); opacity: 1; } }
          .animate-showdown-card-pop { animation: showdown-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes card-flip { 0% { transform: rotateY(90deg) scale(0.5); opacity: 0; } 100% { transform: rotateY(0deg) scale(1); opacity: 1; } }
          .animate-spin-slow { animation: spin 3s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default App;
