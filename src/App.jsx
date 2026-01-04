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
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'}`}>
            
            {(isHero || isShowdown) && !player.isFolded && player.winProbability !== undefined && phase !== PHASES.IDLE && (
              <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 z-[300] flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-300">
                <div className="bg-slate-900/80 backdrop-blur-xl border border-cyan-500/50 px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                  <TrendingUp size={10} className="text-cyan-400" />
                  <span className="text-[9px] font-black text-white font-mono">{Math.round(player.winProbability)}%</span>
                </div>
              </div>
            )}

            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-700 ${isCollectingBets ? 'animate-fling-to-pot opacity-0 scale-0' : 'animate-bet-splash opacity-100'}`}
                    style={{ transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y}px)`, left: '50%', top: '50%' }}>
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-black text-[10px] md:text-[12px] px-3 py-1 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.6)] border border-white/30 flex items-center gap-1 whitespace-nowrap">
                        <Coins size={10} className="animate-spin-slow" />
                        ${String(player.currentBet.toLocaleString())}
                    </div>
                </div>
            )}

            <div 
                style={{ transform: `translateY(${playerBadgeOffset}px)` }}
                className={`relative z-50 flex flex-col items-center p-1.5 rounded-2xl border-2 bg-slate-900/95 backdrop-blur-md transition-all duration-300 min-w-[100px] md:min-w-[150px] shadow-2xl ${isActiveTurn ? 'border-cyan-400 ring-4 ring-cyan-400/40 scale-105 shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 animate-pulse-glow' : ''}`}
            >
                {isActiveTurn && <div className="absolute -top-2 w-full px-2 h-1.5 z-[60]"><div className="w-full h-full bg-cyan-400 rounded-full animate-pulse" /></div>}
                <div className="flex flex-col items-center gap-0.5 w-full">
                    <span className="text-[10px] md:text-[12px] font-black text-white/90 uppercase tracking-tight truncate w-full text-center px-2">{String(player.name || "Anon")}</span>
                    <span className={`text-[11px] md:text-[14px] font-mono font-black ${player.chips === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                        ${Number(player.chips || 0).toLocaleString()}
                    </span>
                </div>
            </div>

            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative z-10 flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible">
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const offset = ci - mid;
                        const currentRotation = offset * holeCardRotation;
                        
                        return (
                          <div key={c.id || ci} 
                              className={`w-[5.5vw] md:w-[3vw] h-[8vw] md:h-[5vw] rounded-[4px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-300 ${isShowdown || isHero ? 'bg-white text-black' : 'bg-slate-800'} ${isShowdown && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_20px_#fbbf24]' : 'border-white/20'}`} 
                              style={{ 
                                  transform: `translateX(${offset * 1.5}vw) rotate(${currentRotation}deg) scale(${1.5 * currentCardScale})`, 
                                  transformOrigin: 'bottom center', 
                                  top: player.hand.length > 2 ? '15px' : '45px' 
                              }}>
                              {(isShowdown || isHero) && (
                                  <><span className="text-[10px] md:text-[12px] font-black leading-none">{String(c.value)}</span><span className={`text-[12px] md:text-[16px] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></>
                              )}
                              {!(isShowdown || isHero) && ( <div className="w-full h-full flex items-center justify-center opacity-20"><ShieldCheck size={14}/></div> )}
                          </div>
                        );
                    })}

                    {strengthLabel && !player.isFolded && (isHero || isShowdown) && phase !== PHASES.IDLE && (
                        <div className="absolute -bottom-12 z-[120] whitespace-nowrap bg-purple-600/90 backdrop-blur-md px-3 py-1 rounded-full border border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-in fade-in zoom-in h-7 flex items-center justify-center">
                             <span className="text-[9px] md:text-[11px] font-black uppercase text-white tracking-widest">
                                {phase === PHASES.PRE_FLOP ? "Pre-flop" : String(strengthLabel)}
                             </span>
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
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Layout Controls
  const [headerHeight, setHeaderHeight] = useState(64); 
  const [footerHeight, setFooterHeight] = useState(220); 
  const [tableZoom, setTableZoom] = useState(0.85);
  const [heroCardScale, setHeroCardScale] = useState(2.2);
  const [communityCardScale, setCommunityCardScale] = useState(2.8);
  const [holeCardRotation, setHoleCardRotation] = useState(15);
  const [playerBadgeOffset, setPlayerBadgeOffset] = useState(110);
  const [showLayoutControls, setShowLayoutControls] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + (p?.currentBet || 0), 0);
    return potAmount + currentBetsSum;
  }, [potAmount, players]);

  const heroIdx = useMemo(() => {
    if (!userProfile) return -1;
    return players.findIndex(p => p?.uid === userProfile?.uid);
  }, [players, userProfile]);

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

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile) return;
    const rId = selectedTableForJoin.id;
    socket.emit('joinRoom', { roomId: rId, profile: userProfile, buyIn: buyInAmount }, (res) => {
        if (res?.status === 'ok') { 
          setCurrentRoomId(rId); 
          setCurrentView(VIEWS.GAME); 
          setSelectedTableForJoin(null); 
        }
    });
  }, [selectedTableForJoin, userProfile, buyInAmount]);

  useEffect(() => {
    socket.on('roomUpdate', (d) => {
        if (!d) return;
        if (d.id) setCurrentRoomId(d.id);

        setPlayers(prev => {
            const next = [...INITIAL_PLAYERS];
            (d.players || []).forEach((p, i) => { if(p) next[i] = p; });
            return next;
        });
        setPhase(d.phase);
        setCommunity(d.community || []);
        setPotAmount(d.potData?.[0]?.amount || 0);
        setActiveIdx(d.activeIdx);
        setHighestBet(d.highestBet);

        if (d.activeVariant) {
            const vId = typeof d.activeVariant === 'string' ? d.activeVariant : d.activeVariant.id;
            setActiveVariant(VARIANTS[vId] || VARIANTS.HOLDEM);
        }

        if (d.phase === PHASES.SHOWDOWN) setShowdownWinners(d.showdownWinners);
        else setShowdownWinners(null);
    });

    socket.on('loginSuccess', (p) => { 
        setUserProfile(p); 
        setPendingVariantId(p.pendingVariant || 'HOLDEM');
        setCurrentView(VIEWS.LOBBY); 
        socket.emit('getInitialData'); 
    });

    socket.on('lobbyUpdate', (list) => setActiveTables(list || []));
    socket.on('profilesUpdate', (list) => setAllProfiles(list || []));
    socket.on('initialDataResponse', (d) => { 
        setAllProfiles(d.profiles || []); 
        setActiveTables(d.rooms || []); 
    });
    
    socket.on('log', (entry) => {
        setLogs(prev => [{ id: Math.random(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), ...entry }, ...prev].slice(0, 50));
    });

    return () => { 
        socket.off('roomUpdate'); socket.off('loginSuccess'); socket.off('lobbyUpdate'); 
        socket.off('profilesUpdate'); socket.off('initialDataResponse'); socket.off('log');
    };
  }, []);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white uppercase tracking-tighter font-black">
        <div className="w-full max-w-[400px] p-10 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8">
            <Lock size={40} className="text-[#fbbf24]" />
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="PASSCODE" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-[#fbbf24] outline-none text-xl font-black uppercase tracking-widest"/>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl hover:scale-[1.02] font-black text-lg transition-transform uppercase">ENTER ARENA</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white font-black uppercase overflow-hidden font-black">
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 p-4 md:p-8 flex flex-row md:flex-col gap-4 bg-black/20 shrink-0">
            <h2 className="text-[#fbbf24] tracking-widest hidden md:flex items-center gap-2 mb-4 font-black"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-3 md:p-4 rounded-xl text-xs transition-all ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5 text-white/40'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-3 md:p-4 rounded-xl text-xs transition-all ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5 text-white/40'}`}>TABLES</button>
            <button onClick={handleNuclear} className={`hidden md:flex mt-4 p-4 rounded-xl items-center justify-center gap-2 border-2 transition-all font-black ${nuclearConfirm ? 'bg-red-600 border-white text-white animate-pulse' : 'bg-red-950/20 border-red-500 text-red-500'}`}>
                {nuclearConfirm ? <Bomb size={20}/> : <ShieldAlert size={20}/>}
                <span>{nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</span>
            </button>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="p-3 md:p-4 text-white/20 hover:text-white text-xs flex items-center gap-2 mt-auto"><ArrowLeft size={16}/> BACK</button>
        </aside>
        <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-black/40 font-black uppercase">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8">
                    <h3 className="text-xl tracking-widest border-l-4 border-[#fbbf24] pl-4 font-black">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10 shadow-xl">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#fbbf24] font-black"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#fbbf24] font-black"/>
                        <button onClick={()=>socket.emit('adminCreatePlayer', {...newPlayer, uid: 'u_'+Math.random().toString(36).slice(2,7)})} className="bg-[#fbbf24] text-black rounded-xl font-black p-4">CREATE</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10 font-black">
                        {(allProfiles || []).map(p => (
                            <div key={p.uid} className="flex justify-between p-4 border-b border-white/5 hover:bg-white/5">
                                <span>{p.name} <span className="text-white/20 ml-2">[{p.password}]</span></span>
                                <div className="flex gap-4 items-center">
                                    <span className="text-emerald-400 font-mono font-black">${Number(p.chips || 0).toLocaleString()}</span>
                                    <button onClick={()=>{const n = prompt("NEW WALLET", p.chips); if(n) socket.emit('adminEditChips', {uid: p.uid, chips: Number(n)})}}><Edit3 size={18} className="text-cyan-400"/></button>
                                    <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)}><Trash2 size={18} className="text-red-500"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8 font-black">
                    <h3 className="text-xl tracking-widest border-l-4 border-emerald-500 pl-4 font-black">ARENA CONTROL</h3>
                    <div className="bg-white/5 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 border border-white/10">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#fbbf24] font-black"/>
                        <div className="grid grid-cols-4 gap-2 font-black">
                            <input value={newTable.sb} type="number" className="bg-black/40 p-3 rounded-lg border border-white/10" placeholder="SB" onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})}/>
                            <input value={newTable.bb} type="number" className="bg-black/40 p-3 rounded-lg border border-white/10" placeholder="BB" onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})}/>
                            <input value={newTable.minBuy} type="number" className="bg-black/40 p-3 rounded-lg border border-white/10" placeholder="MIN" onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})}/>
                            <input value={newTable.maxBuy} type="number" className="bg-black/40 p-3 rounded-lg border border-white/10" placeholder="MAX" onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})}/>
                        </div>
                        <button onClick={handleSpawnArena} className="bg-emerald-600 rounded-xl font-black p-4">SPAWN ARENA</button>
                    </div>
                </div>
            )}
        </main>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div className="h-screen bg-[#06080c] flex flex-col text-white font-black uppercase overflow-hidden font-black">
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 md:px-12 bg-black/40 backdrop-blur-md z-50 shrink-0 font-black">
            <h2 className="tracking-widest md:tracking-[0.4em] text-sm md:text-xl flex items-center gap-4 font-black"><LayoutGrid className="text-[#fbbf24]"/> LOBBY</h2>
            <div className="flex items-center gap-6 md:gap-10 font-black">
                <div className="flex flex-col items-end">
                    <span className="text-[8px] text-white/40 italic">ID: {String(userProfile?.name || "??")}</span>
                    <span className="text-emerald-400 font-mono text-base md:text-2xl">${Number(userProfile?.chips || 0).toLocaleString()}</span>
                </div>
                <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={24}/></button>
            </div>
        </header>
        <main className="flex-1 p-6 md:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 overflow-y-auto font-black uppercase">
            {(activeTables || []).map((t) => (
                <div key={t.id} className="p-8 bg-white/5 border border-white/5 rounded-3xl flex flex-col gap-6 shadow-2xl hover:border-[#fbbf24]/20 transition-all group font-black">
                    <h3 className="text-xl md:text-2xl tracking-widest text-white group-hover:text-[#fbbf24]">{String(t.name)}</h3>
                    <div className="bg-black/60 p-6 rounded-2xl flex justify-between items-center border border-white/5">
                        <div className="flex flex-col"><span className="text-[8px] text-white/40">STAKES</span><span className="text-[#fbbf24] text-xl font-black">${t.sb}/${t.bb}</span></div>
                        <div className="flex flex-col items-end"><span className="text-[8px] text-white/40">SEATS</span><span className="text-white/80 font-mono">{t.players?.filter(p=>p).length || 0}/10</span></div>
                    </div>
                    <button onClick={()=>setSelectedTableForJoin(t)} className="w-full p-6 bg-emerald-600 rounded-2xl tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all font-black">ENTER ARENA</button>
                </div>
            ))}
        </main>
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-6 font-black uppercase">
                <div className="w-full max-w-[400px] p-10 bg-slate-900 border border-[#fbbf24]/30 rounded-3xl shadow-2xl flex flex-col gap-8">
                    <h3 className="text-2xl text-center tracking-widest text-[#fbbf24]">{selectedTableForJoin.name}</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px] text-white/40"><span>BUY-IN</span><span className="text-emerald-400 text-2xl font-mono">${buyInAmount.toLocaleString()}</span></div>
                        <input type="range" min={400} max={2000} step={100} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fbbf24]" />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-5 bg-white/5 border border-white/10 rounded-2xl font-black">BACK</button>
                        <button onClick={joinRoom} className="flex-2 p-5 bg-emerald-600 rounded-2xl font-black">SIT DOWN</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      
      <header style={{ height: `${headerHeight}px` }} className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4 md:px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black uppercase">
        <div className="flex items-center gap-2">
            <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 shadow-inner truncate font-black uppercase">
                <span className="text-[#fbbf24] text-[8px] md:text-[10px] tracking-widest font-black uppercase italic text-opacity-70">This Hand:</span>
                <span className="text-white ml-2 text-[10px] md:text-xs font-black">{activeVariant?.name || "Hold'em"}</span>
            </div>
            <button onClick={() => setShowLayoutControls(!showLayoutControls)} className={`p-2 rounded-lg transition-all font-black uppercase ${showLayoutControls ? 'bg-[#fbbf24] text-black shadow-[0_0_15px_#fbbf24]' : 'bg-white/5 text-white/40'}`}>
                <Sliders size={18}/>
            </button>
        </div>

        {showLayoutControls && (
            <div className="absolute top-16 left-4 bg-black/95 border border-white/10 p-6 rounded-2xl shadow-2xl z-[1000] flex flex-col gap-5 min-w-[280px] max-h-[80vh] overflow-y-auto scrollbar-hide animate-in slide-in-from-top-4 backdrop-blur-xl font-black">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <span className="text-[8px] text-white/40 uppercase font-black">HEADER</span>
                        <input type="range" min="40" max="100" value={headerHeight} onChange={(e)=>setHeaderHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none"/>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[8px] text-white/40 uppercase font-black">FOOTER</span>
                        <input type="range" min="120" max="400" value={footerHeight} onChange={(e)=>setFooterHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none"/>
                    </div>
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] text-white/40 uppercase font-black">TABLE ZOOM ({Math.round(tableZoom * 100)}%)</span>
                    <input type="range" min="0.5" max="1.5" step="0.05" value={tableZoom} onChange={(e)=>setTableZoom(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none"/>
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] text-white/40 uppercase text-orange-400 font-black">PLAYER BADGE OFFSET ({playerBadgeOffset}px)</span>
                    <input type="range" min="-200" max="250" step="1" value={playerBadgeOffset} onChange={(e)=>setPlayerBadgeOffset(Number(e.target.value))} className="w-full accent-orange-500 h-1 bg-white/10 rounded-full appearance-none"/>
                </div>
                <div className="space-y-1">
                    <span className="text-[8px] text-white/40 uppercase text-indigo-400 font-black">HOLE CARD ROTATION ({holeCardRotation}°)</span>
                    <input type="range" min="0" max="45" step="1" value={holeCardRotation} onChange={(e)=>setHoleCardRotation(Number(e.target.value))} className="w-full accent-indigo-500 h-1 bg-white/10 rounded-full appearance-none"/>
                </div>
                <button onClick={()=>setShowLayoutControls(false)} className="bg-[#fbbf24] text-black font-black py-2 rounded-lg text-[10px] tracking-widest uppercase">CLOSE</button>
            </div>
        )}

        <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-xl flex items-center gap-4 shadow-inner font-black uppercase">
            <span className="hidden sm:inline text-white/40 text-[9px] tracking-widest uppercase font-black">On my deal:</span>
            <select value={pendingVariantId} onChange={(e) => {
                setPendingVariantId(e.target.value); 
                socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value});
            }} className="bg-transparent text-[#fbbf24] outline-none text-xs cursor-pointer font-black">
                {Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900 font-black">{v.name}</option>)}
            </select>
        </div>

        <div className="flex gap-2 font-black uppercase items-center">
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl mr-2 font-mono text-[11px] text-[#fbbf24] shadow-inner">
                <Clock size={14} />
                {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button onClick={addBot} className="text-indigo-400 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-indigo-400/20 font-black" title="Bot"><Bot size={20}/></button>
            <button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/20 font-black"><LogOut size={20}/></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-emerald-950/20 to-transparent overflow-hidden font-black uppercase">
        <div style={{ transform: `scale(${tableZoom})` }} className="relative w-full max-w-[1200px] aspect-[21/9] flex items-center justify-center h-full transition-transform duration-500 origin-center font-black">
            
            <div className="absolute inset-0 bg-[#0f3d2e]/40 rounded-[50%] border-[2vw] border-slate-900/60 shadow-[inset_0_0_15vw_rgba(0,0,0,0.8)]" />
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                <span className="text-[12vw] font-black italic rotate-[-12deg] uppercase">{activeVariant?.name}</span>
            </div>

            <div className="absolute inset-0 pointer-events-none z-20 font-black">
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
                    isHero={i === heroIdx} 
                    strengthLabel={p.strength}
                    cardScale={heroCardScale} 
                    relativeIdx={rIdx}
                    holeCardRotation={holeCardRotation}
                    playerBadgeOffset={playerBadgeOffset}
                  />
                );
              })}
            </div>

            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full justify-center">
                <div className="text-[5vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-2xl">
                    ${Number(totalDisplayPot || 0).toLocaleString()}
                </div>
                <div className="flex gap-4 mt-8 transition-transform" style={{ transform: `scale(${communityCardScale})` }}>
                    {(community || []).map((c, j) => (
                        <div key={j} className={`w-[3.5vw] h-[5vw] rounded-[4px] border bg-white flex flex-col items-center justify-center text-black font-black shadow-xl transition-all ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 z-30 shadow-[0_0_20px_rgba(251,191,36,0.6)]' : ''}`}>
                            <span className="text-[12px]">{c.value}</span>
                            <span className={`text-[18px] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{c.suit}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </main>

      <footer style={{ height: `${footerHeight}px` }} className="bg-black/95 border-t border-white/10 flex z-[100] font-black uppercase overflow-hidden">
        
        <div className="w-[30%] border-r border-white/10 p-4 overflow-y-auto scrollbar-hide text-[10px] space-y-2 uppercase">
            <div className="text-[#fbbf24] border-b border-white/5 pb-1 font-black">LIVE INTELLIGENCE</div>
            {(logs || []).map(l => (
                <div key={l.id} className="flex gap-2 text-white/40">
                    <span className="shrink-0">{l.time}</span>
                    <span className="text-white lowercase font-black">{l.name} {l.action}</span>
                </div>
            ))}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white/5">
          {activeIdx === heroIdx && phase !== PHASES.SHOWDOWN && phase !== PHASES.IDLE && heroIdx !== -1 ? (
            <div className="flex flex-col gap-4 w-full max-w-[800px] animate-in slide-in-from-bottom duration-500 font-black">
                <div className="flex gap-3 justify-center">
                    <button onClick={()=>handleAction('RAISE', highestBet + potAmount)} className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-xs hover:bg-white/20 font-black">POT</button>
                    <button onClick={()=>handleAction('RAISE', players[heroIdx].chips + players[heroIdx].currentBet)} className="px-6 py-2 bg-red-900/30 border border-red-500/50 rounded-xl text-xs text-red-500 font-black">ALL-IN</button>
                </div>
                <div className="flex gap-4 items-center justify-center">
                    <button onClick={()=>handleAction('FOLD')} className="w-32 h-16 bg-red-950/60 border-2 border-red-500/50 rounded-2xl text-xs font-black">FOLD</button>
                    <button onClick={()=>handleAction('CALL')} className="flex-1 h-16 bg-indigo-900/60 border-2 border-indigo-400/50 rounded-2xl text-xl font-black">
                        {highestBet > players[heroIdx].currentBet ? `CALL $${highestBet - players[heroIdx].currentBet}` : 'CHECK'}
                    </button>
                    <div className="flex gap-2 items-center bg-black/60 p-2 rounded-2xl border border-white/10">
                        <input type="number" value={raiseInput} onChange={(e) => setRaiseInput(Number(e.target.value))} className="w-24 bg-transparent text-center text-[#fbbf24] text-xl font-mono outline-none font-black" />
                        <button onClick={()=>handleAction('RAISE', raiseInput)} className="px-8 h-12 bg-emerald-600 rounded-xl font-black">RAISE</button>
                    </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase">
                {showdownWinners && showdownWinners.length > 0 ? (
                    <div className="flex flex-wrap gap-4 items-center justify-center w-full overflow-y-auto px-4 py-2">
                        {showdownWinners.map((winner, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-2 bg-black/60 p-4 rounded-[2rem] border-2 border-yellow-500/40 shadow-[0_0_50px_rgba(251,191,36,0.3)] min-w-[280px] animate-showdown-card-pop relative overflow-hidden" style={{ animationDelay: `${idx * 0.2}s` }}>
                                <div className="text-[#fbbf24] font-black text-2xl tracking-tighter uppercase animate-pulse">{winner.name}</div>
                                <div className="text-emerald-400 font-mono text-xl font-black">+${(winner.amount || 0).toLocaleString()}</div>
                                <div className="text-white/80 text-[10px] tracking-[0.2em] px-3 py-0.5 bg-yellow-600/20 rounded-full border border-yellow-500/30 font-black">{winner.rank}</div>
                                <div className="flex gap-1 mt-1">
                                    {(winner.hand || []).map((c, ci) => (
                                        <div key={ci} className="w-10 h-14 bg-white rounded-lg flex flex-col items-center justify-center text-black shadow-xl font-black">
                                            <span className="text-[10px]">{String(c.value)}</span>
                                            <span className={`text-xl ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-white/20 font-black">
                        {phase === PHASES.IDLE ? (
                             <div className="flex flex-col items-center gap-2">
                                <Target size={40} className="animate-pulse" />
                                <span className="text-lg tracking-widest font-black">ARENA IDLE</span>
                             </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[10px] tracking-[0.4em] text-cyan-400 font-black">WAITING ON</span>
                                <span className="text-3xl text-white font-black">{players[activeIdx]?.name || "OPPONENT"}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
          )}
        </div>
      </footer>

      <style>{`
          @keyframes fling-to-pot { 
            0% { transform: translate(-50%, -100%) scale(1.5); opacity: 1; } 
            100% { transform: translate(calc(-50% + 50vw), -40vh) scale(0.1); opacity: 0; } 
          }
          .animate-fling-to-pot { animation: fling-to-pot 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards; }
          .animate-pulse-glow { animation: pulse-glow 2s infinite; }
          @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 0px rgba(251,191,36,0); } 50% { box-shadow: 0 0 30px rgba(251,191,36,0.4); } }
          ::-webkit-scrollbar { display: none; }
          .animate-bet-splash { animation: bet-splash 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes bet-splash { from { transform: translate(-50%, -50%) scale(0.2); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
          @keyframes showdown-pop {
            0% { transform: scale(0.7) translateY(40px); opacity: 0; }
            100% { transform: scale(1) translateY(0); opacity: 1; }
          }
          .animate-showdown-card-pop { animation: showdown-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
    </div>
  );
};

export default App;
