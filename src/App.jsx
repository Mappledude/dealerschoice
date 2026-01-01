import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare
} from 'lucide-react';
import io from 'socket.io-client';

const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

// Pushed seats further toward edges
const DISPLAY_POSITIONS = [
  { x: 50, y: 92 }, { x: 15, y: 82 }, { x: 6,  y: 45 }, { x: 12, y: 12 }, { x: 30, y: 3  },
  { x: 50, y: 1  }, { x: 70, y: 3  }, { x: 88, y: 12 }, { x: 94, y: 45 }, { x: 85, y: 82 }
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
    const highAward = hiLowAwards?.high?.find(a => a.i === player.seatIdx);
    const lowAward = hiLowAwards?.low?.find(a => a.i === player.seatIdx);
    const isBottomHalf = displayPos.y > 50;

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'}`}>
            
            {/* BET BUBBLE */}
            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-500 ${isCollectingBets ? 'animate-fling-to-pot opacity-0' : 'opacity-100'}`}
                    style={{ transform: `translate(-50%, ${isBottomHalf ? '-150px' : '110px'})`, left: '50%' }}>
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-black text-[10px] md:text-[12px] px-3 py-1 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)] border border-white/30 flex items-center gap-1">
                        <Coins size={10} />
                        ${String(player.currentBet.toLocaleString())}
                    </div>
                </div>
            )}

            {/* PLAYER AVATAR */}
            <div className={`relative flex flex-col items-center p-1.5 rounded-2xl border-2 bg-slate-900/95 backdrop-blur-md transition-all duration-300 min-w-[100px] md:min-w-[150px] shadow-2xl ${isActiveTurn ? 'border-cyan-400 ring-4 ring-cyan-400/20 scale-105' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 animate-pulse-glow' : ''}`}>
                {player.isDealer && (
                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-white rounded-full flex items-center justify-center border-2 border-slate-800 shadow-lg z-10">
                        <span className="text-black font-black text-[10px]">D</span>
                    </div>
                )}
                <div className="flex flex-col items-center gap-0.5 w-full">
                    <span className="text-[10px] md:text-[12px] font-black text-white/90 uppercase tracking-tight truncate w-full text-center px-2">{String(player.name || "Anon")}</span>
                    <span className={`text-[11px] md:text-[14px] font-mono font-black ${player.chips === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                        ${Number(player.chips || 0).toLocaleString()}
                    </span>
                </div>
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="absolute -bottom-2 w-full px-2 h-1.5">
                        <div className="w-full h-full bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400 transition-all duration-1000 linear" style={{ width: `${(timeRemaining / 30) * 100}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {/* CARDS */}
            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible translate-y-[55px]">
                    {player.hand.map((c, ci) => (
                        <div key={c.id || ci} className={`w-[5.5vw] md:w-[3vw] h-[8vw] md:h-[5vw] rounded-[4px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-300 ${isShowdown || isHero ? 'bg-white text-black' : 'bg-slate-800'} ${isShowdown && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_20px_#fbbf24]' : 'border-white/20'}`} style={{ transform: `translateX(${(ci - (player.hand.length - 1) / 2) * 20}px) rotate(${(ci - (player.hand.length - 1) / 2) * 8}deg) scale(${1.4 * (cardScale || 1)})`, transformOrigin: 'bottom center' }}>
                            {(isShowdown || isHero) && (
                                <><span className="text-[10px] md:text-[12px] font-black leading-none">{String(c.value)}</span><span className={`text-[12px] md:text-[16px] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></>
                            )}
                            {!(isShowdown || isHero) && ( <div className="w-full h-full flex items-center justify-center opacity-20"><ShieldCheck size={14}/></div> )}
                        </div>
                    ))}
                    {strengthLabel && !player.isFolded && (isHero || isShowdown) && phase !== PHASES.IDLE && (
                        <div className="absolute -bottom-12 z-[110] whitespace-nowrap bg-indigo-600 px-2 py-0.5 rounded border border-indigo-400 shadow-lg animate-in fade-in zoom-in">
                             <span className="text-[8px] md:text-[9px] font-black uppercase text-white tracking-widest">{String(strengthLabel)}</span>
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

  const [headerHeight, setHeaderHeight] = useState(64); 
  const [footerHeight, setFooterHeight] = useState(200); 
  const [tableZoom, setTableZoom] = useState(1);
  const [cardScale, setCardScale] = useState(1);
  const [showLayoutControls, setShowLayoutControls] = useState(false);

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
                </div>
            ) : (
                <div className="flex flex-col gap-8 animate-in fade-in font-black uppercase">
                    <h3 className="text-xl md:text-2xl tracking-widest border-l-4 border-emerald-500 pl-4 font-black">ARENA CONTROL</h3>
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
        <main className="flex-1 p-6 md:p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 overflow-y-auto bg-gradient-to-br from-transparent to-white/5 font-black uppercase font-black">
            {(activeTables || []).map((t) => (
                <div key={t.id} className="p-8 bg-white/5 border border-white/5 rounded-3xl flex flex-col gap-6 shadow-2xl hover:border-[#fbbf24]/20 transition-all group relative overflow-hidden font-black">
                    <h3 className="text-xl md:text-2xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors uppercase font-black">{String(t.name)}</h3>
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
      {isBrokeStatus && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6 font-black">
                <div className="w-full max-w-[400px] p-10 bg-slate-900 border-2 border-red-500 rounded-3xl text-center shadow-[0_0_100px_rgba(239,68,68,0.4)] font-black uppercase">
                    <AlertTriangle size={80} className="text-red-500 animate-pulse mb-6 mx-auto" />
                    <h2 className="text-3xl font-black mb-2">BUSTED!</h2>
                    <button onClick={() => socket.emit('adminAddChips', { roomId: currentRoomId, uid: userProfile.uid, chips: 1000 })} className="w-full p-6 bg-emerald-600 text-white rounded-2xl shadow-xl animate-bounce font-black">REBUY $1,000</button>
                </div>
          </div>
      )}

      <header style={{ height: `${headerHeight}px` }} className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4 md:px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black uppercase">
        <div className="flex items-center gap-2">
            <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 shadow-inner truncate font-black uppercase">
                <span className="text-[#fbbf24] text-[8px] md:text-[10px] tracking-widest">ARENA:</span>
                <span className="text-white ml-2 text-[10px] md:text-xs">{String(activeVariant.name)}</span>
            </div>
            <button onClick={() => setShowLayoutControls(!showLayoutControls)} className={`p-2 rounded-lg transition-all font-black uppercase ${showLayoutControls ? 'bg-[#fbbf24] text-black shadow-[0_0_15px_#fbbf24]' : 'bg-white/5 text-white/40'}`}>
                <Sliders size={18}/>
            </button>
        </div>
        <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-xl flex items-center gap-4 shadow-inner font-black uppercase">
            <span className="hidden sm:inline text-white/40 text-[9px] tracking-widest uppercase">DEALER CHOICE:</span>
            <select value={pendingVariantId} onChange={(e) => {setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value})}} className="bg-transparent text-[#fbbf24] outline-none text-xs cursor-pointer font-black">
                {Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900 font-black">{v.name}</option>)}
            </select>
        </div>
        <div className="flex gap-2 font-black uppercase">
            <button onClick={addBot} className="text-indigo-400 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-indigo-400/20 font-black" title="Bot"><Bot size={20}/></button>
            <button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/20 font-black"><LogOut size={20}/></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-emerald-950/20 to-transparent overflow-hidden px-2 py-2 font-black uppercase">
        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 10}px)` }} className="relative w-full max-w-[1400px] aspect-[21/10] flex items-center justify-center h-full transition-transform duration-300 ease-out origin-center font-black">
            <div className="absolute inset-0 bg-[#0f3d2e]/40 rounded-[50%] border-[2vw] border-slate-900/60 shadow-[inset_0_0_15vw_rgba(0,0,0,0.8)] border-double font-black uppercase" />
            <div className="absolute inset-0 pointer-events-none z-20 font-black uppercase">
              {(players || []).map((p, i) => {
                if (!p) return null;
                const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS;
                return <Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} strengthLabel={p.strength} isCollectingBets={isCollectingBets} timeRemaining={timeRemaining} isHero={i === heroIdx} hiLowAwards={hiLowAwards} cardScale={cardScale} />;
              })}
            </div>
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center">
              {!potTransferring && (
                <div className={`flex flex-col items-center transition-all duration-300 font-black uppercase ${potAnimating ? 'scale-110' : 'scale-100'}`}>
                    <div className={`text-[6vw] md:text-[5vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow(0 0 20px rgba(0,0,0,0.8)) ${potAnimating ? 'animate-pot-pulse' : ''}`}>${Number(potAmount || 0).toLocaleString()}</div>
                </div>
              )}
              <div className="flex gap-2 md:gap-4 scale-[1.1] md:scale-[1.8] mt-6 md:mt-12 font-black uppercase">
                  {(community || []).map((c, j) => (
                    <div key={c.id || j} className={`w-[6vw] md:w-[3vw] h-[9vw] md:h-[5vw] rounded-[4px] border bg-white flex flex-col items-center justify-center text-black font-black transition-all duration-300 ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 z-30 shadow-[0_0_40px_rgba(251,191,36,0.6)]' : 'border-white/20 shadow-2xl'}`}>
                        <span className="text-[14px] md:text-[0.9vw] font-black">{String(c.value)}</span><span className={`text-[18px] md:text-[1.8vw] font-black ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                    </div>
                  ))}
              </div>
            </div>
        </div>
      </main>

      <footer style={{ height: `${footerHeight}px` }} className="bg-black/95 backdrop-blur-3xl border-t border-white/10 flex z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 font-black uppercase overflow-hidden">
        
        {/* INTELLIGENCE & ACTIVITY FEED */}
        <div className="flex w-[35%] border-r border-white/10 p-4 flex-col overflow-hidden text-[10px] font-mono tracking-widest font-black uppercase">
            <div className="text-white/40 mb-2 flex items-center justify-between border-b border-white/5 pb-2 uppercase">
                <div className="flex items-center gap-2"><Eye size={14} className="text-[#fbbf24]"/> INTELLIGENCE FEED</div>
                <div className="flex items-center gap-1 text-emerald-500 animate-pulse"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> MONITORING</div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide font-black p-1">
                {(logs || []).map(l => (
                    <div key={l.id} className="animate-in slide-in-from-left duration-300 flex items-start gap-3 border-l-2 border-white/10 pl-3 py-2 bg-white/5 rounded-r-xl group hover:bg-white/10 transition-colors">
                        <span className="text-white/20 text-[7px] font-black shrink-0 mt-1">{String(l.time)}</span> 
                        <div className="flex flex-wrap items-center gap-x-2 font-black leading-tight">
                            <span className={`font-black uppercase text-[9px] md:text-[10px] px-1.5 rounded ${
                                l.type === 'win' ? 'bg-emerald-500/20 text-emerald-400' : 
                                l.type === 'variant' ? 'bg-purple-500/20 text-purple-400' : 
                                l.type === 'fold' ? 'bg-red-500/20 text-red-400' :
                                l.type === 'phase' ? 'bg-cyan-500/20 text-cyan-400' :
                                'bg-yellow-500/20 text-[#fbbf24]'
                            }`}>{String(l.name)}</span>
                            <span className="text-white/70 lowercase tracking-normal text-[9px] md:text-[10px] font-black">{String(l.action)}</span>
                        </div>
                    </div>
                ))}
                {logs.length === 0 && <div className="flex items-center justify-center h-full text-white/10 italic text-[10px]">Awaiting arena activity...</div>}
            </div>
        </div>

        {/* ACTION CONTROLS / STATUS PANEL */}
        <div className="flex-1 flex flex-col justify-center px-4 md:px-10 relative bg-white/5 shadow-inner py-3 font-black uppercase">
          {activeIdx === heroIdx && phase !== PHASES.SHOWDOWN && phase !== PHASES.IDLE && heroPlayerObj ? (
            <div className="flex flex-col gap-3 md:gap-5 animate-in slide-in-from-bottom duration-500 items-center w-full font-black uppercase">
                <div className="flex gap-2 w-full max-w-[600px] font-black uppercase">
                    <button onClick={()=>handleAction('RAISE', highestBet + Math.floor(potAmount * 0.5))} className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] md:text-[12px] hover:bg-white/20 transition-all font-black">1/2 POT</button>
                    <button onClick={()=>handleAction('RAISE', highestBet + potAmount)} className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] md:text-[12px] hover:bg-white/20 transition-all font-black">POT</button>
                    <button onClick={()=>handleAction('RAISE', heroPlayerObj.chips + heroPlayerObj.currentBet)} className="flex-1 py-2 bg-red-900/30 border border-red-500/50 rounded-xl text-[10px] md:text-[12px] text-red-500 hover:bg-red-600 hover:text-white transition-all font-black">ALL-IN</button>
                </div>
                <div className="flex gap-3 md:gap-6 w-full items-center justify-center font-black">
                    <button onClick={()=>handleAction('FOLD')} className="w-16 md:w-32 h-14 md:h-16 bg-red-950/60 border-2 border-red-500/50 rounded-2xl tracking-[0.2em] hover:brightness-125 transition-all font-black text-xs shadow-xl">FOLD</button>
                    <button onClick={()=>handleAction('CALL')} className="flex-1 max-w-[360px] h-14 md:h-16 bg-indigo-900/60 border-2 border-indigo-400/50 rounded-2xl text-sm md:text-xl tracking-[0.3em] hover:brightness-125 font-black shadow-xl shadow-indigo-900/20">
                        {highestBet > heroPlayerObj.currentBet ? `CALL $${(highestBet - heroPlayerObj.currentBet).toLocaleString()}` : 'CHECK'}
                    </button>
                    <div className="flex gap-2 items-center bg-black/60 border border-white/10 p-1 md:p-2 rounded-2xl shadow-inner min-w-[120px] md:min-w-[320px] font-black uppercase">
                        <div className="flex items-center bg-black/40 px-3 md:px-5 rounded-xl border border-white/5 h-12 md:h-14 font-black uppercase">
                            <span className="text-[#fbbf24] text-[12px] md:text-xl font-mono mr-1">$</span>
                            <input type="number" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(heroPlayerObj.chips + heroPlayerObj.currentBet, Math.max(minRaiseAllowed, Number(e.target.value))))} className="w-10 md:w-28 bg-transparent text-center font-mono text-sm md:text-2xl text-[#fbbf24] outline-none font-black" />
                        </div>
                        <button onClick={()=>handleAction('RAISE', raiseInput)} className="flex-1 h-12 md:h-14 bg-emerald-600/60 border border-emerald-400/50 rounded-xl flex items-center justify-center hover:brightness-125 font-black uppercase text-xs md:text-xl shadow-xl shadow-emerald-900/20">
                            <Zap size={20} className="md:mr-2 text-emerald-400"/> RAISE
                        </button>
                    </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase">
                {showdownWinners && showdownWinners.length > 0 ? (
                    <div className="flex items-center gap-6 md:gap-14 animate-in fade-in zoom-in duration-700 w-full h-full justify-center font-black">
                        <div className="flex flex-col items-center font-black">
                            <div className="p-4 bg-yellow-500/10 rounded-full border-2 border-yellow-500/20 animate-bounce mb-2 shadow-[0_0_40px_rgba(251,191,36,0.1)] font-black"><Trophy size={42} className="text-[#fbbf24]" /></div>
                            <div className="text-center font-black">
                                <h4 className="text-[#fbbf24] text-base md:text-2xl font-black truncate max-w-[120px] md:max-w-none">{showdownWinners[0].name || "Anon"} SCOOPS!</h4>
                                <p className="text-emerald-400 text-[10px] md:text-xs font-black tracking-widest">{showdownWinners[0].rank || "Hand"}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4 font-black">
                             <div className="flex gap-2 p-4 bg-black/50 rounded-3xl border-2 border-yellow-500/20 relative shadow-2xl">
                                  <div className="absolute -top-4 -right-4 bg-emerald-500 text-black px-4 py-1.5 rounded-full font-black text-lg md:text-2xl shadow-xl animate-pulse ring-4 ring-black z-20">+${(showdownWinners[0].amount || 0).toLocaleString()}</div>
                                  {(showdownWinners[0].hand || []).map((c, ci) => (
                                     <div key={ci} className="w-[10vw] md:w-[4.5vw] h-[14vw] md:h-[6.5vw] bg-white rounded-xl flex flex-col items-center justify-center text-black shadow-2xl ring-2 ring-yellow-400/50 transform hover:scale-110 transition-all duration-300 font-black bg-glimmer">
                                         <span className="text-[14px] md:text-[1.2vw] font-black">{String(c.value)}</span>
                                         <span className={`text-[18px] md:text-[2.2vw] font-black ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                                     </div>
                                  ))}
                             </div>
                             <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5"><div className="h-full bg-emerald-500 animate-[progress_7.5s_linear] shadow-[0_0_15px_#10b981] rounded-full" style={{width: '100%'}} /></div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                        {phase === PHASES.IDLE ? (
                             <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-white/5 rounded-full animate-pulse"><Target size={36} className="text-white/20"/></div>
                                <span className="text-white/40 tracking-[0.4em] text-xs md:text-lg font-black italic">ARENA IDLE</span>
                             </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2 text-cyan-400 animate-pulse mb-1">
                                    <MessageSquare size={16} />
                                    <span className="text-[10px] md:text-xs font-black tracking-[0.2em]">WAITING ON</span>
                                </div>
                                <span className="text-2xl md:text-4xl font-black text-white tracking-tighter drop-shadow-lg">{players[activeIdx]?.name || "OPPONENT"}</span>
                                <div className="flex gap-1.5 mt-2">
                                    {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-cyan-400/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                                </div>
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
          @keyframes transfer-chip { 0% { top: 43%; left: 50%; opacity: 1; transform: translate(-50%, -50%) scale(1); filter: brightness(2); } 100% { top: var(--ty); left: var(--tx); opacity: 0; transform: translate(-50%, -50%) scale(0.1); filter: brightness(1); } }
          @keyframes pot-pulse { 0% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } 50% { transform: scale(1.1); filter: drop-shadow(0 0 30px #fbbf24) brightness(1.2); } 100% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } }
          .animate-pot-pulse { animation: pot-pulse 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .animate-transfer-chip { animation: transfer-chip 1s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; }
          .bg-glimmer { background: linear-gradient(135deg, #fff 0%, #fff 40%, #fbbf24 50%, #fff 60%, #fff 100%); background-size: 200% 200%; animation: glimmer 3s infinite; }
          @keyframes glimmer { 0% { background-position: -100% -100%; } 100% { background-position: 200% 200%; } }
          .animate-pulse-glow { animation: pulse-glow 2s infinite ease-in-out; }
          @keyframes pulse-glow { 0% { box-shadow: 0 0 0px rgba(34,211,238,0); } 50% { box-shadow: 0 0 20px rgba(34,211,238,0.6); } 100% { box-shadow: 0 0 0px rgba(34,211,238,0); } }
          ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
