import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus
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
  { x: 50, y: 76 }, { x: 15, y: 70 }, { x: 8,  y: 45 }, { x: 12, y: 20 }, { x: 30, y: 8  },
  { x: 50, y: 6  }, { x: 70, y: 8  }, { x: 88, y: 20 }, { x: 92, y: 45 }, { x: 85, y: 70 }
];

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em' }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA' }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple' }, 
  MUFLIS: { id: 'Muflis', name: 'Muflis' },
  HILOW: { id: 'HILOW', name: 'Hi-Low Split' } 
};

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const Seat = ({ player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, strengthLabel, potTransferring, timeRemaining, isHero, hiLowAwards, cardScale }) => {
    if (!player || !displayPos) return null;
    const isShowdown = phase === PHASES.SHOWDOWN;
    
    // Check if this specific player is a hi/low winner
    const highAward = hiLowAwards?.high?.find(a => a.i === player.seatIdx);
    const lowAward = hiLowAwards?.low?.find(a => a.i === player.seatIdx);

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col-reverse items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-20 grayscale scale-90' : 'opacity-100'}`}>
            {isShowdown && potTransferring && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-16 flex flex-col gap-1 items-center z-[500]">
                    {highAward && <span className="bg-emerald-600 text-white text-[8px] md:text-[10px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-lg whitespace-nowrap uppercase">HIGH WINNER (+${highAward.amount})</span>}
                    {lowAward && <span className="bg-orange-600 text-white text-[8px] md:text-[10px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-lg whitespace-nowrap uppercase">LOW WINNER (+${lowAward.amount})</span>}
                </div>
            )}
            
            <div className={`flex items-center gap-1.5 md:gap-2 p-1 md:p-[0.6vw] px-2 md:px-[2vw] rounded-full border-2 bg-black/95 backdrop-blur-xl transition-all duration-300 ${isActiveTurn ? 'border-cyan-400 shadow-[0_0_2vw_rgba(34,211,238,0.4)] animate-pulse-glow' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 scale-105 shadow-[0_0_3vw_#fbbf24]' : ''}`}>
                <div className="flex flex-col items-center">
                    <span className="text-[9px] md:text-[1vw] font-black text-white uppercase tracking-tighter truncate max-w-[50px] md:max-w-none">{String(player.name || "Anon")}</span>
                    <span className={`text-[10px] md:text-[1.1vw] font-mono font-black ${player.chips === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                        ${Number(player.chips || 0).toLocaleString()}
                    </span>
                </div>
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="w-5 h-5 md:w-8 md:h-8 flex items-center justify-center rounded-full bg-cyan-400 text-black font-black text-[9px] md:text-sm shadow-lg">{timeRemaining}</div>
                )}
            </div>

            {player.currentBet > 0 && (
                <div className={`absolute bg-gradient-to-b from-[#fbbf24] to-[#d97706] text-black font-black text-[9px] md:text-[0.9vw] px-2 md:px-4 py-0.5 md:py-1 rounded-full shadow-2xl border border-white/20 z-[100] ${isCollectingBets ? 'animate-fling-to-pot' : 'animate-in fade-in zoom-in'}`}
                    style={{ top: isHero ? '-11vw' : '-7vw', left: '50%', transform: 'translate(-50%, -100%)', opacity: isCollectingBets ? 0 : 1 }}>
                    ${String(player.currentBet)}
                </div>
            )}

            {/* HAND STRENGTH BUBBLE - PURPLE */}
            {strengthLabel && !player.isFolded && (isHero || isShowdown) && phase !== PHASES.IDLE && (
                <div className="absolute top-[-35px] md:top-[-50px] left-1/2 -translate-x-1/2 h-5 md:h-6 px-3 bg-purple-600 border border-purple-400 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.6)] z-[110] flex items-center animate-in fade-in zoom-in-95 duration-300">
                    <span className="text-[8px] md:text-[9px] font-black uppercase text-white tracking-widest whitespace-nowrap">{String(strengthLabel)}</span>
                </div>
            )}

            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative flex items-center justify-center w-[16vw] md:w-[12vw] h-[10vw] md:h-[6vw] mb-4 overflow-visible translate-y-[20px]">
                    {player.hand.map((c, ci) => (
                        <div key={c.id || ci} className={`w-[5.5vw] md:w-[3vw] h-[8vw] md:h-[5vw] rounded-[0.4vw] flex flex-col items-start p-[0.3vw] border shadow-lg absolute transition-all duration-300 ${isShowdown || isHero ? 'bg-white text-black' : 'bg-slate-800'} ${isShowdown && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-2 md:ring-4 ring-yellow-400 scale-110 z-30 shadow-[0_0_20px_#fbbf24]' : 'border-white/20'}`} style={{ transform: `translateX(${(ci - (player.hand.length - 1) / 2) * 4}vw) rotate(${(ci - (player.hand.length - 1) / 2) * 10}deg) scale(${1.7 * (cardScale || 1)})`, transformOrigin: 'bottom center' }}>
                            {(isShowdown || isHero) && (
                                <><span className="text-[1.2vw] md:text-[1vw] font-black leading-none">{String(c.value)}</span><span className={`text-[1.8vw] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></>
                            )}
                            {!(isShowdown || isHero) && ( <div className="w-full h-full flex items-center justify-center opacity-10"><ShieldCheck size={12}/></div> )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const App = () => {
  // 1. STATE & REF (Hoisted to Top)
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

  const [headerHeight, setHeaderHeight] = useState(64); 
  const [footerHeight, setFooterHeight] = useState(160); 
  const [tableZoom, setTableZoom] = useState(1);
  const [cardScale, setCardScale] = useState(1);
  const [showLayoutControls, setShowLayoutControls] = useState(false);

  // 2. DERIVED STATE (DEFINED AFTER MAIN STATE)
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

  // 3. CALLBACKS
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
        const phaseChanged = d.phase !== phase && phase !== PHASES.IDLE;
        const currentPotValue = Number(d.potData?.[0]?.amount || 0);
        const potIncreased = currentPotValue > potAmount;

        if (phaseChanged) {
            setIsCollectingBets(true);
            setTimeout(() => {
                setIsCollectingBets(false);
                if (potIncreased) { setPotAnimating(true); setTimeout(() => setPotAnimating(false), 500); }
            }, 1000);
        } else if (potIncreased && d.phase === phase) {
             setPotAnimating(true); setTimeout(() => setPotAnimating(false), 500);
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
            setRaiseInput(prev => (prev < Number(d.highestBet) + 20) ? Number(d.highestBet) + 20 : prev);
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
  }, [phase, potAmount, userProfile]);

  // --- VIEWS ---

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white font-black uppercase tracking-tighter">
        <div className="w-full max-w-[400px] p-8 md:p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8 font-black">
            <div className="p-5 bg-white/5 rounded-full ring-1 ring-white/10 shadow-inner"><Lock size={32} className="text-[#fbbf24]" /></div>
            <div className="w-full space-y-4">
                <label className="text-[10px] text-white/40 block ml-2">ACCESS PASSCODE</label>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-xl font-black uppercase"/>
            </div>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl hover:scale-[1.02] font-black text-lg transition-transform uppercase">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white font-black uppercase overflow-hidden">
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

        <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-black/40 font-black">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8 animate-in fade-in">
                    <h3 className="text-xl md:text-2xl tracking-widest border-l-4 border-[#fbbf24] pl-4 font-black">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10 shadow-xl">
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
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 border border-white/10 shadow-xl font-black">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 outline-none focus:border-[#fbbf24] font-black uppercase"/>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-black">
                            <div className="space-y-1"><span className="text-[9px] text-white/40">SB</span><input value={newTable.sb} type="number" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[9px] text-white/40">BB</span><input value={newTable.bb} type="number" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[9px] text-white/40">MIN</span><input value={newTable.minBuy} type="number" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})}/></div>
                            <div className="space-y-1"><span className="text-[9px] text-white/40">MAX</span><input value={newTable.maxBuy} type="number" className="w-full bg-black/40 p-3 rounded-lg border border-white/10 font-black" onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})}/></div>
                        </div>
                        <button onClick={handleSpawnArena} className="bg-emerald-600 rounded-xl font-black p-4 uppercase transition-all">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-black">
                        {(activeTables || []).map(t => (
                            <div key={t.id} className="bg-white/5 p-4 md:p-6 rounded-2xl flex justify-between items-center border border-white/10 hover:border-emerald-500/50 transition-all shadow-lg font-black uppercase">
                                <div><h4 className="text-[#fbbf24] text-base md:text-lg font-black truncate">{String(t.name)}</h4><p className="text-[10px] text-white/40 tracking-widest">${t.sb}/${t.bb} | {t.players?.filter(Boolean).length || 0}/10 SEATED</p></div>
                                <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 p-2 md:p-3 rounded-xl text-red-500 hover:bg-red-500 transition-all font-black">TERMINATE</button>
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
                    <h3 className="text-2xl md:text-3xl text-center tracking-widest text-[#fbbf24] underline underline-offset-8 uppercase font-black">{String(selectedTableForJoin.name)}</h3>
                    <div className="space-y-6 font-black text-center uppercase">
                        <div className="flex justify-between items-center text-[10px] text-white/40 tracking-widest font-black"><span>BUY-IN AMOUNT</span><span className="text-emerald-400 text-xl md:text-2xl font-mono">${buyInAmount.toLocaleString()}</span></div>
                        <input type="range" min={selectedTableForJoin.minBuy || 400} max={selectedTableForJoin.maxBuy || 2000} step={100} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fbbf24]" />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black uppercase">BACK</button>
                        <button onClick={joinRoom} className="flex-2 p-5 bg-emerald-600 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all text-sm tracking-widest font-black uppercase">SIT DOWN</button>
                    </div>
                </div>
            </div>
        )}
        
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-6 md:px-12 bg-black/40 backdrop-blur-md shadow-xl z-50 shrink-0 font-black">
            <h2 className="tracking-widest md:tracking-[0.4em] text-sm md:text-xl flex items-center gap-4 font-black"><LayoutGrid className="text-[#fbbf24]"/> LOBBY</h2>
            <div className="flex items-center gap-6 md:gap-10 font-black">
                <div className="flex flex-col items-end font-black uppercase">
                    <span className="text-[8px] md:text-[10px] text-white/40 uppercase italic">ID: {String(userProfile?.name || "??")}</span>
                    <span className="text-emerald-400 font-mono text-base md:text-2xl tracking-tighter">${Number(userProfile?.chips || 0).toLocaleString()}</span>
                </div>
                <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={24}/></button>
            </div>
        </header>

        <main className="flex-1 p-6 md:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 overflow-y-auto bg-gradient-to-br from-transparent to-white/5 font-black uppercase">
            {(activeTables || []).map((t) => (
                <div key={t.id} className="p-8 bg-white/5 border border-white/5 rounded-3xl flex flex-col gap-6 shadow-2xl hover:border-[#fbbf24]/20 transition-all group relative overflow-hidden font-black">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity font-black"><LayoutGrid size={64}/></div>
                    <h3 className="text-xl md:text-2xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors uppercase font-black">{String(t.name)}</h3>
                    <div className="text-[10px] text-white/40 h-8 md:h-10 tracking-widest overflow-hidden font-black uppercase">SEATED: {t.players?.filter(p => p).map(p => String(p.name)).join(', ') || 'NONE'}</div>
                    <div className="bg-black/60 p-4 md:p-6 rounded-2xl flex justify-between items-center border border-white/5 shadow-inner uppercase font-black">
                        <div className="flex flex-col font-black uppercase"><span className="text-[8px] text-white/40 tracking-widest">STAKES</span><span className="text-[#fbbf24] text-lg md:text-xl font-black">${t.sb}/${t.bb}</span></div>
                        <div className="flex flex-col items-end font-black"><span className="text-[8px] text-white/40 tracking-widest">SEATS</span><span className="text-white/80 font-mono text-sm md:text-base font-black">{t.players?.filter(p=>p).length || 0}/10</span></div>
                    </div>
                    <button onClick={()=>setSelectedTableForJoin(t)} className="w-full p-6 md:p-8 bg-emerald-600 rounded-2xl tracking-widest shadow-xl hover:scale-[1.02] transition-all font-black uppercase">ENTER ARENA</button>
                </div>
            ))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      {/* 1. REBUY / BUST MODAL */}
      {isBrokeStatus && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-in zoom-in-95 duration-300 p-6 font-black">
                <div className="w-full max-w-[400px] p-10 md:p-14 bg-slate-900 border-2 border-red-500 rounded-3xl text-center shadow-[0_0_100px_rgba(239,68,68,0.4)] font-black uppercase">
                    <div className="relative inline-block mb-6 font-black uppercase">
                        <AlertTriangle size={80} className="text-red-500 animate-pulse uppercase" />
                        <div className="absolute inset-0 flex items-center justify-center font-mono text-3xl text-white mt-1 uppercase font-black uppercase">
                            {heroPlayerObj?.rebuyTimeRemaining || 0}
                        </div>
                    </div>
                    <h2 className="text-3xl font-black tracking-widest text-white mb-2 uppercase">BUSTED!</h2>
                    <p className="text-white/40 text-[10px] mb-8 tracking-widest uppercase font-black uppercase font-black">REBUY NOW OR BE REMOVED FROM THE SEAT.</p>
                    <button onClick={() => socket.emit('adminAddChips', { roomId: currentRoomId, uid: userProfile.uid, chips: 1000 })} className="w-full p-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl shadow-xl tracking-[0.2em] animate-bounce font-black uppercase font-black">REBUY $1,000</button>
                    <button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="w-full mt-4 p-4 text-white/20 hover:text-white transition-all text-xs tracking-widest font-black uppercase font-black">EXIT</button>
                </div>
          </div>
      )}

      {/* 2. HEADER */}
      <header style={{ height: `${headerHeight}px` }} className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4 md:px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black uppercase">
        <div className="flex items-center gap-2">
            <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 shadow-inner truncate font-black uppercase">
                <span className="text-[#fbbf24] text-[8px] md:text-[10px] tracking-widest uppercase font-black">ARENA:</span>
                <span className="text-white ml-2 text-[10px] md:text-xs font-black">{String(activeVariant.name)}</span>
            </div>
            <button onClick={() => setShowLayoutControls(!showLayoutControls)} className={`p-2 rounded-lg transition-all font-black uppercase ${showLayoutControls ? 'bg-[#fbbf24] text-black shadow-[0_0_15px_#fbbf24]' : 'bg-white/5 text-white/40'}`}>
                <Sliders size={18}/>
            </button>
        </div>

        {showLayoutControls && (
            <div className="absolute top-16 left-4 bg-black/95 border border-white/10 p-6 rounded-2xl shadow-2xl z-[1000] flex flex-col gap-5 min-w-[240px] animate-in slide-in-from-top-4 backdrop-blur-xl font-black uppercase">
                <div className="space-y-2 font-black uppercase">
                    <div className="flex justify-between text-[8px] text-white/40 font-black uppercase"><span>HEADER</span><span>{headerHeight}PX</span></div>
                    <input type="range" min="40" max="100" value={headerHeight} onChange={(e)=>setHeaderHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none font-black"/>
                </div>
                <div className="space-y-2 font-black uppercase">
                    <div className="flex justify-between text-[8px] text-white/40 font-black uppercase"><span>HUD</span><span>{footerHeight}PX</span></div>
                    <input type="range" min="120" max="400" value={footerHeight} onChange={(e)=>setFooterHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none font-black"/>
                </div>
                <div className="space-y-2 font-black uppercase">
                    <div className="flex justify-between text-[8px] text-white/40 font-black uppercase"><span>ZOOM</span><span>{Math.round(tableZoom * 100)}%</span></div>
                    <input type="range" min="0.5" max="1.5" step="0.05" value={tableZoom} onChange={(e)=>setTableZoom(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none font-black"/>
                </div>
                <div className="space-y-2 font-black uppercase">
                    <div className="flex justify-between text-[8px] text-white/40 font-black uppercase"><span>CARD SIZE</span><span>{Math.round(cardScale * 100)}%</span></div>
                    <input type="range" min="0.5" max="2" step="0.1" value={cardScale} onChange={(e)=>setCardScale(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1 bg-white/10 rounded-full appearance-none font-black"/>
                </div>
                <button onClick={()=>setShowLayoutControls(false)} className="bg-[#fbbf24] text-black font-black py-2 rounded-lg text-[10px] tracking-widest uppercase font-black font-black">CLOSE</button>
            </div>
        )}

        <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-xl flex items-center gap-4 shadow-inner font-black uppercase">
            <span className="hidden sm:inline text-white/40 text-[9px] tracking-widest uppercase font-black font-black">DEALER CHOICE:</span>
            <select value={pendingVariantId} onChange={(e) => {setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value})}} className="bg-transparent text-[#fbbf24] outline-none text-xs cursor-pointer font-black font-black">
                {Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900 font-black">{v.name}</option>)}
            </select>
        </div>
        
        <div className="flex gap-2 font-black uppercase font-black uppercase">
            <button onClick={addBot} className="text-indigo-400 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-indigo-400/20 font-black" title="Bot"><Bot size={20}/></button>
            <button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/20 font-black"><LogOut size={20}/></button>
        </div>
      </header>

      {/* 3. ARENA TABLE */}
      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-emerald-950/20 to-transparent overflow-hidden px-2 py-2 font-black uppercase">
        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 10}px)` }} className="relative w-full max-w-[1400px] aspect-[21/10] flex items-center justify-center h-full transition-transform duration-300 ease-out origin-center font-black">
            {potTransferring && (showdownWinners || []).map((w, wi) => {
                const targetIdx = players.findIndex(p => p?.name === w.name);
                const targetPos = getWinnerDisplayPos(targetIdx);
                return <div key={`award-${wi}`} className="absolute font-black text-emerald-400 font-mono text-[2.5vw] animate-transfer-chip z-[600]" style={{ '--tx': `${targetPos.x - 50}vw`, '--ty': `${targetPos.y - 45}vh` }}>+${(w.amount || 0).toLocaleString()}</div>;
            })}
            <div className="absolute inset-0 pointer-events-none z-20 font-black uppercase font-black uppercase">
              {(players || []).map((p, i) => {
                if (!p || (userProfile && p.uid === userProfile.uid)) return null;
                const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS;
                return <Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} strengthLabel={p.strength} isCollectingBets={isCollectingBets} timeRemaining={timeRemaining} isHero={false} hiLowAwards={hiLowAwards} cardScale={cardScale} />;
              })}
            </div>
            <div className="absolute inset-0 bg-[#0f3d2e]/40 rounded-[50%] border-[2vw] border-slate-900/60 shadow-[inset_0_0_15vw_rgba(0,0,0,0.8)] border-double font-black uppercase font-black uppercase" />
            <div className="absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center">
              {!potTransferring && (
                <div className={`flex flex-col items-center transition-all duration-300 font-black uppercase ${potAnimating ? 'scale-125' : 'scale-100'}`}>
                    <div className={`text-[6vw] md:text-[5vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] ${potAnimating ? 'animate-pot-pulse' : ''}`}>${Number(potAmount || 0).toLocaleString()}</div>
                    <div className="px-4 py-1 bg-black/40 rounded-full border border-white/5 font-black uppercase"><span className="text-[10px] md:text-xs text-[#fbbf24] tracking-widest uppercase font-black">POT</span></div>
                </div>
              )}
              <div className="flex gap-2 md:gap-4 scale-[1.1] md:scale-[1.8] mt-6 md:mt-12 font-black uppercase">
                  {(community || []).map((c, j) => (
                    <div key={c.id || j} className={`w-[6vw] md:w-[3vw] h-[9vw] md:h-[5vw] rounded-[0.4vw] border bg-white flex flex-col items-center justify-center text-black font-black ${winning5Ids?.includes(c.id) ? 'ring-2 md:ring-4 ring-yellow-400 scale-110 z-30 shadow-[0_0_30px_#fbbf24] font-black uppercase' : 'border-white/20 shadow-2xl font-black uppercase'}`}>
                        <span className="text-[2.5vw] md:text-[0.9vw] font-black font-black uppercase">{String(c.value)}</span><span className={`text-[4vw] md:text-[1.8vw] font-black uppercase font-black uppercase ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'} font-black uppercase`}>{String(c.suit)}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="absolute inset-0 pointer-events-none z-50 font-black">{heroPlayerObj && <Seat player={heroPlayerObj} displayPos={DISPLAY_POSITIONS[0]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === heroIdx} strengthLabel={heroPlayerObj.strength} isCollectingBets={isCollectingBets} timeRemaining={timeRemaining} isHero={true} hiLowAwards={hiLowAwards} cardScale={cardScale} />}</div>
        </div>
      </main>

      {/* 4. FOOTER / HUD */}
      <footer style={{ height: `${footerHeight}px` }} className="bg-black/90 backdrop-blur-3xl border-t border-white/10 flex z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 font-black uppercase overflow-hidden font-black">
        <div className="hidden lg:flex w-1/4 border-r border-white/10 p-6 flex flex-col overflow-hidden text-[10px] font-mono tracking-widest font-black uppercase font-black">
            <div className="text-white/40 mb-4 flex items-center gap-2 border-b border-white/5 pb-2 uppercase font-black"><Info size={14}/> FEED</div>
            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide font-black uppercase">
                {(logs || []).map(l => (
                    <div key={l.id} className="animate-in slide-in-from-left duration-300 flex items-start gap-2 border-l-2 border-white/5 pl-2 py-0.5 font-black uppercase">
                        <span className="text-white/20 text-[8px] font-black shrink-0 uppercase font-black">{String(l.time)}</span> 
                        <div className="flex flex-wrap gap-x-1 font-black"><span className={`font-black uppercase text-[9px] ${l.type === 'win' ? 'text-emerald-400' : l.type === 'variant' ? 'text-purple-400' : 'text-[#fbbf24]'}`}>{String(l.name)}</span><span className="text-white/60 lowercase tracking-normal text-[9px] font-black">{String(l.action)}</span></div>
                    </div>
                ))}
            </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-4 md:px-10 relative bg-white/5 shadow-inner py-2 font-black uppercase font-black">
          {activeIdx === heroIdx && phase !== PHASES.SHOWDOWN && phase !== PHASES.IDLE && heroPlayerObj ? (
            <div className="flex flex-col gap-2 md:gap-4 animate-in slide-in-from-bottom duration-500 items-center w-full font-black uppercase">
                <div className="flex gap-2 w-full max-w-[600px] font-black uppercase">
                    <button onClick={()=>handleAction('RAISE', highestBet + Math.floor(potAmount * 0.5))} className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] md:text-[10px] hover:bg-[#fbbf24] hover:text-black transition-all font-black truncate px-1 uppercase font-black">1/2 POT</button>
                    <button onClick={()=>handleAction('RAISE', highestBet + potAmount)} className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] md:text-[10px] hover:bg-[#fbbf24] hover:text-black transition-all font-black truncate px-1 uppercase font-black">POT</button>
                    <button onClick={()=>handleAction('RAISE', heroPlayerObj.chips + heroPlayerObj.currentBet)} className="flex-1 py-2 bg-red-900/20 border border-red-500/50 rounded-xl text-[9px] md:text-[10px] text-red-500 hover:bg-red-600 transition-all font-black uppercase font-black">ALL-IN</button>
                </div>

                <div className="flex gap-2 md:gap-4 w-full items-center justify-center font-black">
                    <button onClick={()=>handleAction('FOLD')} className="w-16 md:w-28 h-12 md:h-16 bg-red-950/60 border-2 border-red-500/50 rounded-3xl tracking-widest hover:brightness-125 transition-all font-black text-xs uppercase shadow-lg shadow-red-900/20 font-black">FOLD</button>
                    <button onClick={()=>handleAction('CALL')} className="flex-1 max-w-[320px] h-12 md:h-16 bg-blue-900/60 border-2 border-blue-400/50 rounded-3xl text-sm md:text-xl tracking-widest hover:brightness-125 font-black uppercase shadow-lg shadow-blue-900/20 font-black uppercase">{highestBet > heroPlayerObj.currentBet ? `CALL $${highestBet - heroPlayerObj.currentBet}` : 'CHECK'}</button>
                    <div className="flex gap-1 md:gap-2 items-center bg-black/60 border border-white/10 p-1 md:p-2 rounded-3xl shadow-inner min-w-[100px] md:min-w-[280px] font-black uppercase">
                        <div className="flex items-center bg-black/40 px-2 md:px-4 rounded-xl border border-white/5 h-10 md:h-12 font-black uppercase">
                            <span className="text-[#fbbf24] text-[10px] md:text-xs font-mono mr-1 uppercase font-black">$</span>
                            <input type="number" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(heroPlayerObj.chips + heroPlayerObj.currentBet, Math.max(minRaiseAllowed, Number(e.target.value))))} className="w-8 md:w-24 bg-transparent text-center font-mono text-sm md:text-2xl text-[#fbbf24] outline-none font-black font-black uppercase" />
                        </div>
                        <button onClick={()=>handleAction('RAISE', raiseInput)} className="flex-1 h-10 md:h-12 bg-emerald-700/60 border border-emerald-400/50 rounded-2xl flex items-center justify-center hover:brightness-125 font-black uppercase text-xs md:text-xl shadow-lg shadow-emerald-900/20 font-black"><Zap size={18} className="md:mr-2 text-emerald-400"/></button>
                    </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase font-black uppercase font-black uppercase">
                {showdownWinners && showdownWinners.length > 0 ? (
                    <div className="flex items-center gap-6 md:gap-14 animate-in fade-in zoom-in-95 duration-500 w-full h-full justify-center font-black uppercase">
                        <div className="flex flex-col items-center font-black">
                            <div className="p-4 bg-yellow-500/10 rounded-full border-2 border-yellow-500/20 animate-bounce mb-2 shadow-[0_0_40px_rgba(251,191,36,0.1)] font-black uppercase"><Trophy size={42} className="text-[#fbbf24]" /></div>
                            <div className="text-center font-black uppercase">
                                <h4 className="text-[#fbbf24] text-base md:text-2xl font-black uppercase truncate max-w-[120px] md:max-w-none font-black uppercase">{showdownWinners[0].name || "Anon"} SCOOPS! font-black uppercase</h4>
                                <p className="text-white/40 text-[9px] md:text-xs font-black tracking-widest uppercase font-black uppercase">{showdownWinners[0].rank || "Hand"}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4 font-black uppercase">
                             <div className="flex gap-2 p-4 bg-black/50 rounded-3xl border-2 border-yellow-500/20 relative shadow-2xl font-black uppercase">
                                  <div className="absolute -top-4 -right-4 bg-emerald-500 text-black px-4 py-1.5 rounded-full font-black text-lg md:text-2xl shadow-xl animate-pulse ring-4 ring-black font-black uppercase">+${(showdownWinners[0].amount || 0).toLocaleString()}</div>
                                  {(showdownWinners[0].hand || []).map((c, ci) => (
                                     <div key={ci} className="w-[10vw] md:w-[4.5vw] h-[14vw] md:h-[6.5vw] bg-white rounded-xl flex flex-col items-center justify-center text-black shadow-2xl ring-2 ring-yellow-400/50 transform hover:scale-110 transition-all duration-300 font-black bg-glimmer">
                                         <span className="text-[3vw] md:text-[1.2vw] font-black uppercase">{String(c.value)}</span>
                                         <span className={`text-[5vw] md:text-[2.2vw] font-black uppercase ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'} font-black uppercase`}>{String(c.suit)}</span>
                                     </div>
                                  ))}
                             </div>
                             <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 font-black uppercase"><div className="h-full bg-emerald-500 animate-[progress_7.5s_linear] shadow-[0_0_15px_#10b981] rounded-full font-black uppercase" style={{width: '100%'}} /></div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-5 animate-pulse font-black uppercase">
                        <div className="p-5 bg-white/5 rounded-full border border-white/5 shadow-inner font-black"><Target size={42} className="text-white/20 font-black"/></div>
                        <span className="text-white/40 tracking-[0.5em] text-xs md:text-xl font-black italic font-black uppercase">{phase === PHASES.IDLE ? "ARENA IDLE" : "WAITING FOR MOVE"}</span>
                    </div>
                )}
            </div>
          )}
        </div>
      </footer>
      <style>{`
          @keyframes progress { from { width: 100%; } to { width: 0%; } }
          @keyframes fling-to-pot { 0% { transform: translate(-50%, -100%) scale(1.5); filter: blur(0px); } 100% { transform: translate(0, -35vh) scale(0.1) rotate(1080deg); filter: blur(4px); opacity: 0; } }
          @keyframes transfer-chip { 0% { top: 43%; left: 50%; opacity: 1; transform: translate(-50%, -50%) scale(1); filter: brightness(2); } 100% { top: var(--ty); left: var(--tx); opacity: 0; transform: translate(-50%, -50%) scale(0.1); filter: brightness(1); } }
          @keyframes pot-pulse { 0% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } 50% { transform: scale(1.4); filter: drop-shadow(0 0 30px #fbbf24) brightness(1.5); } 100% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } }
          .animate-pot-pulse { animation: pot-pulse 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .animate-transfer-chip { animation: transfer-chip 1s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; }
          .bg-glimmer { background: linear-gradient(135deg, #fff 0%, #fff 40%, #fbbf24 50%, #fff 60%, #fff 100%); background-size: 200% 200%; animation: glimmer 3s infinite; }
          @keyframes glimmer { 0% { background-position: -100% -100%; } 100% { background-position: 200% 200%; } }
          .animate-pulse-glow { animation: pulse-glow 2s infinite ease-in-out; }
          @keyframes pulse-glow { 0% { box-shadow: 0 0 0px rgba(34,211,238,0); } 50% { box-shadow: 0 0 20px rgba(34,211,238,0.6); } 100% { box-shadow: 0 0 0px rgba(34,211,238,0); } }
      `}</style>
    </div>
  );
};

export default App;
