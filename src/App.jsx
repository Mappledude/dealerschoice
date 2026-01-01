import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders
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
  { x: 50, y: 78 }, { x: 18, y: 74 }, { x: 5,  y: 48 }, { x: 8,  y: 22 }, { x: 28, y: 8  },
  { x: 50, y: 4  }, { x: 72, y: 8  }, { x: 92, y: 22 }, { x: 95, y: 48 }, { x: 82, y: 74 }
];

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em' }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA' }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple' }, 
  MUFLIS: { id: 'Muflis', name: 'Muflis' },
  HILOW: { id: 'HILOW', name: 'Hi-Low Split' } 
};

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const Seat = ({ player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, strengthLabel, potTransferring, timeRemaining, isHero, hiLowAwards }) => {
    if (!player || !displayPos) return null;
    const isShowdown = phase === PHASES.SHOWDOWN;
    const highAward = hiLowAwards?.high?.find(a => a.i === player.seatIdx);
    const lowAward = hiLowAwards?.low?.find(a => a.i === player.seatIdx);

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col-reverse items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-20 grayscale scale-95' : 'opacity-100'}`}>
            {isShowdown && potTransferring && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-16 flex flex-col gap-1 items-center z-[500]">
                    {highAward && <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-lg whitespace-nowrap uppercase">HIGH WINNER (+${highAward.amount})</span>}
                    {lowAward && <span className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-lg whitespace-nowrap uppercase">LOW WINNER (+${lowAward.amount})</span>}
                </div>
            )}
            <div className={`flex items-center gap-2 p-[0.6vw] px-[2vw] rounded-full border-2 bg-black/95 backdrop-blur-xl transition-all duration-300 ${isActiveTurn ? 'border-cyan-400 shadow-[0_0_1.5vw_#22d3ee] scale-105' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 scale-110 shadow-[0_0_2vw_#fbbf24]' : ''}`}>
                {isActiveTurn && timeRemaining > 0 && (
                    <div className={`absolute -right-12 flex items-center justify-center w-10 h-10 rounded-full border-2 bg-black/80 font-black text-sm transition-colors ${timeRemaining <= 10 ? 'border-red-500 text-red-500 animate-pulse' : 'border-cyan-400 text-cyan-400'}`}>{String(timeRemaining)}</div>
                )}
                <div className="flex flex-col items-center">
                    <span className="text-[1vw] font-black text-white uppercase tracking-wider">{String(player.name)}</span>
                    <span className={`text-[1.1vw] font-mono font-black ${player.chips === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-500/80'}`}>{Number(player.chips).toLocaleString()}</span>
                </div>
            </div>
            {player.currentBet > 0 && (
                <div className={`absolute bg-gradient-to-b from-[#fbbf24] to-[#d97706] text-black font-black text-[0.9vw] px-4 py-1 rounded-full shadow-xl border border-white/20 z-[100] ${isCollectingBets ? 'animate-fling-to-pot' : 'animate-in fade-in zoom-in'}`}
                    style={{ top: isHero ? '-7.5vw' : '-5vw', left: '50%', transform: 'translate(-50%, -100%)', opacity: isCollectingBets ? 0 : 1 }}>
                    ${String(player.currentBet)}
                </div>
            )}
            {strengthLabel && !player.isFolded && (isHero || isShowdown) && phase !== PHASES.IDLE && (
                <div className="h-6 px-3 bg-purple-600 border border-purple-400 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.6)] mb-2 flex items-center animate-in fade-in zoom-in-95 duration-300">
                    <span className="text-[9px] font-black uppercase text-white tracking-widest">{String(strengthLabel)}</span>
                </div>
            )}
            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mb-4 overflow-visible">
                    {player.hand.map((c, ci) => (
                        <div key={c.id || ci} className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] flex flex-col items-start p-[0.3vw] border shadow-lg absolute transition-all duration-300 ${isShowdown || isHero ? 'bg-white text-black' : 'bg-slate-800'} ${isShowdown && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 z-30 shadow-[0_0_20px_#fbbf24]' : 'border-white/20'}`} style={{ transform: `translateX(${(ci - (player.hand.length - 1) / 2) * 3}vw) rotate(${(ci - (player.hand.length - 1) / 2) * 10}deg) scale(1.55)`, transformOrigin: 'bottom center' }}>
                            {(isShowdown || isHero) && (
                                <><span className="text-[1vw] font-black leading-none">{String(c.value)}</span><span className={`text-[1.4vw] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></>
                            )}
                            {!(isShowdown || isHero) && ( <div className="w-full h-full flex items-center justify-center opacity-20"><ShieldCheck size={12}/></div> )}
                        </div>
                    ))}
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
  const [hiLowAwards, setHiLowAwards] = useState(null);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);

  const [headerHeight, setHeaderHeight] = useState(64); 
  const [footerHeight, setFooterHeight] = useState(220); 
  const [tableZoom, setTableZoom] = useState(1);
  const [showLayoutControls, setShowLayoutControls] = useState(false);

  useEffect(() => {
    socket.on('roomUpdate', (d) => {
        if (!d) { setPlayers(INITIAL_PLAYERS); setPhase(PHASES.IDLE); setPotAmount(0); setCommunity([]); return; }
        const phaseChanged = d.phase !== phase && phase !== PHASES.IDLE;
        const potIncreased = Number(d.potData?.[0]?.amount) > potAmount;
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
            setPotTransferring(true); setHiLowAwards(d.hiLowAwards || null); setShowdownWinners(d.showdownWinners || null);
            setTimeout(() => { setPotTransferring(false); setShowdownWinners(null); }, 7500);
        }
        setPlayers(() => { 
            const next = [...INITIAL_PLAYERS]; 
            (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
            return next; 
        });
        setPhase(d.phase); setCommunity(d.community || []); setActiveVariant(d.activeVariant || VARIANTS.HOLDEM);
        setHighestBet(Number(d.highestBet) || 0); setActiveIdx(d.activeIdx ?? -1); setWinning5Ids(d.winning5Ids || []);
        setPotAmount(Number(d.potData?.[0]?.amount) || 0); setTimeRemaining(Number(d.timeRemaining) || 30);
        if (d.activeIdx !== -1 && d.players?.[d.activeIdx]?.uid === userProfile?.uid) {
            setRaiseInput(prev => (prev < Number(d.highestBet) + 20) ? Number(d.highestBet) + 20 : prev);
        }
    });
    socket.on('lobbyUpdate', (list) => setActiveTables(list || []));
    socket.on('profilesUpdate', (list) => {
        setAllProfiles(list || []);
        if (userProfile) { const updated = list.find(p => p.uid === userProfile.uid); if (updated) setUserProfile(updated); }
    });
    socket.on('initialDataResponse', (d) => { setAllProfiles(d.profiles || []); setActiveTables(d.rooms || []); });
    socket.on('loginSuccess', (p) => { setUserProfile(p); setPendingVariantId(p.pendingVariant || 'HOLDEM'); setCurrentView(VIEWS.LOBBY); socket.emit('getInitialData'); });
    socket.on('log', (d) => {
        const entry = { id: Math.random(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), ...d };
        setLogs(prev => [entry, ...prev].slice(0, 50));
    });
    return () => { socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); socket.off('loginSuccess'); socket.off('log'); };
  }, [phase, potAmount, userProfile]);

  const heroIdx = useMemo(() => userProfile ? players.findIndex(p => p && p.uid === userProfile.uid) : -1, [players, userProfile]);
  const heroPlayer = heroIdx !== -1 ? players[heroIdx] : null;
  const isBroke = useMemo(() => heroPlayer && heroPlayer.isBust, [heroPlayer]);

  const handleAction = (type, amt = 0) => {
      const roomId = currentRoomId; if (!roomId) return;
      socket.emit('playerAction', { roomId, type, amount: type === 'RAISE' ? Number(amt || raiseInput) : 0 });
  };

  const handleLogin = () => { 
      if (passwordInput === 'pass') { socket.emit('getInitialData'); setUserProfile({ name: 'SUPER ADMIN', uid: 'admin_1' }); setCurrentView(VIEWS.ADMIN); } 
      else { socket.emit('playerLogin', { password: passwordInput }); }
  };

  const joinRoom = () => {
    if (!selectedTableForJoin || !userProfile) return;
    const rId = selectedTableForJoin.id;
    socket.emit('joinRoom', { roomId: rId, profile: { ...userProfile, pendingVariant: pendingVariantId }, buyIn: buyInAmount }, (res) => {
        if (res?.status === 'ok') { setCurrentRoomId(rId); setCurrentView(VIEWS.GAME); setSelectedTableForJoin(null); }
    });
  };

  const handleSpawnArena = () => {
    if (!newTable.name) return;
    const id = 'room_' + Math.random().toString(36).slice(2, 9);
    socket.emit('adminCreateRoom', { ...newTable, id });
    setNewTable({ name: '', sb: 10, bb: 20, minBuy: 400, maxBuy: 2000, pendingVariant: 'HOLDEM' });
  };

  const handleNuclear = () => {
      if (!nuclearConfirm) { setNuclearConfirm(true); setTimeout(() => setNuclearConfirm(false), 3000); return; }
      socket.emit('adminNuclearReset');
      setNuclearConfirm(false);
  };

  const getWinnerDisplayPos = (idx) => {
      const heroSeatOffset = heroIdx !== -1 ? heroIdx : 0;
      const relativeIdx = (idx - heroSeatOffset + TOTAL_SEATS) % TOTAL_SEATS;
      return DISPLAY_POSITIONS[relativeIdx];
  };

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center text-white font-black uppercase tracking-tighter">
        <div className="w-[30vw] min-w-[380px] p-12 bg-black/60 border border-white/10 rounded-[2vw] backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8">
            <div className="p-4 bg-white/5 rounded-full ring-1 ring-white/10 shadow-inner font-black uppercase"><Lock size={32} className="text-[#fbbf24]" /></div>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="ENTER PASSCODE" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none"/>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl hover:scale-[1.02] font-black uppercase transition-all">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex text-white font-black uppercase overflow-hidden">
        <aside className="w-64 border-r border-white/10 p-8 flex flex-col gap-4 bg-black/20">
            <h2 className="text-[#fbbf24] mb-8 tracking-[0.2em] flex items-center gap-2 font-black"><ShieldCheck size={20}/>SUPER ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`p-4 rounded-xl text-left transition-all ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black scale-105' : 'text-white/40'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`p-4 rounded-xl text-left transition-all ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black scale-105' : 'text-white/40'}`}>TABLES</button>
            
            <button onClick={handleNuclear} className={`mt-auto p-4 rounded-xl flex items-center gap-2 transition-all border-2 ${nuclearConfirm ? 'bg-red-600 border-white text-white animate-pulse' : 'bg-red-950/20 border-red-500 text-red-500 hover:bg-red-600 hover:text-white'}`}>
                {nuclearConfirm ? <Bomb size={20}/> : <ShieldAlert size={20}/>}
                {nuclearConfirm ? 'CONFIRM WIPE' : 'NUCLEAR RESET'}
            </button>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="p-4 text-white/20 hover:text-white text-xs flex items-center gap-2 font-black font-black uppercase"><ArrowLeft size={14}/> LOGOUT</button>
        </aside>
        <main className="flex-1 p-12 overflow-y-auto font-black uppercase">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8 animate-in fade-in">
                    <h3 className="text-2xl tracking-widest underline decoration-[#fbbf24]/30 underline-offset-8">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-3 gap-4 border border-white/10 shadow-xl font-black">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 uppercase outline-none focus:border-[#fbbf24] font-black"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-4 rounded-xl border border-white/10 uppercase outline-none focus:border-[#fbbf24] font-black"/>
                        <button onClick={()=>socket.emit('adminCreatePlayer', {...newPlayer, uid: Math.random().toString(36).slice(2)})} className="bg-[#fbbf24] text-black rounded-xl font-black hover:scale-105 active:scale-95 transition-all uppercase">CREATE IDENTITY</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10 font-black">
                        {(allProfiles || []).map(p => (
                            <div key={p.uid} className="flex justify-between p-6 border-b border-white/5 hover:bg-white/5 transition-all font-black uppercase">
                                <span>{String(p.name)} <span className="text-white/20 ml-2">({String(p.password)})</span></span>
                                <div className="flex gap-4 items-center">
                                    <span className="text-emerald-400 font-mono text-lg font-black uppercase tracking-tighter">${Number(p.chips).toLocaleString()}</span>
                                    <button onClick={()=>{const n = prompt("NEW WALLET", p.chips); if(n) socket.emit('adminEditChips', {uid: p.uid, chips: Number(n)})}} className="text-cyan-400 font-black hover:scale-110 transition-all"><Edit3 size={18}/></button>
                                    <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500 font-black hover:scale-110 transition-all"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8 animate-in fade-in font-black uppercase">
                    <h3 className="text-2xl tracking-widest underline decoration-[#fbbf24]/30 underline-offset-8 font-black uppercase">ROOM CONTROL</h3>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-2 gap-4 border border-white/10 shadow-xl font-black uppercase">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ROOM NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 uppercase outline-none focus:border-[#fbbf24] font-black uppercase"/>
                        <div className="grid grid-cols-2 gap-2 font-black uppercase">
                            <div className="space-y-1 font-black"><span className="text-[10px] text-white/40">SB</span><input value={newTable.sb} type="number" className="w-full bg-black/40 p-4 rounded-xl border border-white/10 font-black uppercase" onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})}/></div>
                            <div className="space-y-1 font-black"><span className="text-[10px] text-white/40">BB</span><input value={newTable.bb} type="number" className="w-full bg-black/40 p-4 rounded-xl border border-white/10 font-black uppercase" onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})}/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-black uppercase">
                            <div className="space-y-1 font-black"><span className="text-[10px] text-white/40">MIN BUY</span><input value={newTable.minBuy} type="number" className="w-full bg-black/40 p-4 rounded-xl border border-white/10 font-black uppercase" onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})}/></div>
                            <div className="space-y-1 font-black"><span className="text-[10px] text-white/40">MAX BUY</span><input value={newTable.maxBuy} type="number" className="w-full bg-black/40 p-4 rounded-xl border border-white/10 font-black uppercase" onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})}/></div>
                        </div>
                        <div className="flex flex-col gap-1 bg-black/40 p-4 rounded-xl border border-white/10 font-black uppercase">
                            <span className="text-white/40 text-[10px]">VARIANT</span>
                            <select value={newTable.pendingVariant} onChange={e=>setNewTable({...newTable, pendingVariant: e.target.value})} className="bg-transparent text-[#fbbf24] outline-none flex-1 font-black font-black uppercase">
                                {Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900 font-black uppercase">{v.name}</option>)}
                            </select>
                        </div>
                        <button onClick={handleSpawnArena} className="bg-emerald-600 rounded-xl font-black hover:scale-105 transition-all p-4 font-black uppercase">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 font-black uppercase">
                        {(activeTables || []).map(t => (
                            <div key={t.id} className="bg-white/5 p-6 rounded-2xl flex justify-between items-center border border-white/10 hover:border-emerald-500/50 transition-all shadow-lg font-black uppercase font-black uppercase">
                                <div><h4 className="text-[#fbbf24] text-lg font-black uppercase font-black uppercase">{String(t.name)}</h4><p className="text-[10px] text-white/40 tracking-widest font-black uppercase font-black uppercase font-black uppercase font-black uppercase">${t.sb}/${t.bb} | {t.players?.filter(Boolean).length} SEATED</p></div>
                                <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 p-3 rounded-xl text-red-500 hover:bg-red-500 transition-all font-black uppercase font-black uppercase font-black uppercase">TERMINATE</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div className="h-screen bg-[#06080c] flex flex-col text-white font-black uppercase">
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                <div className="w-[30vw] p-12 bg-slate-900 border border-[#fbbf24]/30 rounded-[2vw] shadow-2xl flex flex-col gap-10">
                    <h3 className="text-3xl text-center tracking-widest text-[#fbbf24] underline underline-offset-8 font-black">{String(selectedTableForJoin.name)}</h3>
                    <div className="space-y-6 font-black uppercase text-center">
                        <div className="flex justify-between items-center text-xs text-white/40 tracking-widest font-black uppercase"><span>BUY-IN AMOUNT</span><span className="text-emerald-400 text-3xl font-mono font-black uppercase tracking-tighter">${buyInAmount.toLocaleString()}</span></div>
                        <input type="range" min={selectedTableForJoin.minBuy || 400} max={selectedTableForJoin.maxBuy || 2000} step={100} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fbbf24] font-black uppercase" />
                    </div>
                    <div className="flex gap-4 font-black">
                        <button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black uppercase">BACK</button>
                        <button onClick={joinRoom} className="flex-2 p-5 bg-emerald-600 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all text-sm tracking-widest font-black uppercase">CONFIRM SEAT</button>
                    </div>
                </div>
            </div>
        )}
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-12 bg-black/40 backdrop-blur-md shadow-xl z-50 font-black uppercase shrink-0">
            <h2 className="tracking-[0.4em] text-xl flex items-center gap-4 font-black uppercase"><LayoutGrid className="text-[#fbbf24]"/> ARENA LOBBY</h2>
            <div className="flex items-center gap-10 font-black uppercase">
                <div className="flex flex-col items-end font-black uppercase">
                    <span className="text-[10px] text-white/40 tracking-widest font-black uppercase italic">ID: {String(userProfile?.name)}</span>
                    <span className="text-emerald-400 font-mono text-2xl tracking-tighter font-black uppercase">${Number(userProfile?.chips).toLocaleString()}</span>
                </div>
                <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all hover:scale-110 font-black uppercase"><LogOut size={28}/></button>
            </div>
        </header>
        <main className="flex-1 p-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 overflow-y-auto bg-gradient-to-br from-transparent to-white/5 font-black uppercase">
            {(activeTables || []).map((t) => (
                <div key={t.id} className="p-10 bg-white/5 border border-white/5 rounded-[3vw] flex flex-col gap-8 shadow-2xl hover:border-[#fbbf24]/20 transition-all group relative overflow-hidden font-black uppercase">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity font-black uppercase"><LayoutGrid size={80}/></div>
                    <h3 className="text-2xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors font-black uppercase">{String(t.name)}</h3>
                    <div className="text-[10px] text-white/40 h-10 tracking-widest overflow-hidden font-black uppercase">
                        SEATED: {t.players?.filter(p => p).map(p => String(p.name)).join(', ') || 'NONE SEATED'}
                    </div>
                    <div className="bg-black/60 p-6 rounded-2xl flex justify-between items-center border border-white/5 shadow-inner font-black uppercase">
                        <div className="flex flex-col font-black uppercase"><span className="text-[8px] text-white/40 tracking-[0.2em]">STAKES</span><span className="text-[#fbbf24] text-xl tracking-tighter font-black uppercase">${t.sb}/${t.bb}</span></div>
                        <div className="flex flex-col items-end font-black uppercase"><span className="text-[8px] text-white/40 tracking-[0.2em]">SEATS</span><span className="text-white/80 font-mono font-black uppercase">{t.players?.filter(p=>p).length}/10</span></div>
                    </div>
                    <button onClick={()=>setSelectedTableForJoin(t)} className="w-full p-8 bg-emerald-600 rounded-[2vw] tracking-[0.2em] shadow-xl hover:scale-[1.02] font-black uppercase transition-all">ENTER ARENA</button>
                </div>
            ))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      {/* REBUY / BUST MODAL */}
      {isBroke && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-in zoom-in-95 duration-300 font-black uppercase">
                <div className="w-[90vw] md:w-[30vw] min-w-[320px] p-12 bg-slate-900 border-2 border-red-500 rounded-3xl text-center shadow-[0_0_80px_rgba(239,68,68,0.4)] font-black">
                    <div className="relative inline-block mb-6 font-black uppercase">
                        <AlertTriangle size={80} className="text-red-500 animate-pulse" />
                        <div className="absolute inset-0 flex items-center justify-center font-mono text-3xl text-white mt-2 font-black uppercase">
                            {heroPlayer.rebuyTimeRemaining}
                        </div>
                    </div>
                    <h2 className="text-4xl font-black tracking-widest text-white mb-2 underline decoration-red-500/50 underline-offset-8 uppercase font-black">BUSTED!</h2>
                    <p className="text-white/40 text-xs mb-8 tracking-widest uppercase mt-4 font-black uppercase">YOU HAVE {heroPlayer.rebuyTimeRemaining} SECONDS TO REBUY OR BE REMOVED.</p>
                    <button onClick={() => socket.emit('adminAddChips', { roomId: currentRoomId, uid: userProfile.uid, chips: 1000 })} className="w-full p-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase rounded-2xl transition-all shadow-xl tracking-[0.2em] animate-bounce font-black uppercase">REBUY $1,000</button>
                    <button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="w-full mt-4 p-4 text-white/20 hover:text-white transition-all text-xs tracking-widest font-black uppercase">EXIT ARENA</button>
                </div>
          </div>
      )}

      {/* HEADER */}
      <header style={{ height: `${headerHeight}px` }} className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4 md:px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black uppercase">
        <div className="flex items-center gap-3 font-black uppercase">
            <div className="bg-white/5 px-4 py-1.5 rounded-xl border border-white/5 shadow-inner truncate font-black uppercase">
                <span className="text-[#fbbf24] text-[8px] md:text-[10px] tracking-widest font-black uppercase">ARENA:</span>
                <span className="text-white ml-2 text-[10px] md:text-xs font-black uppercase">{String(activeVariant.name)}</span>
            </div>
            <button onClick={() => setShowLayoutControls(!showLayoutControls)} className={`p-2 rounded-lg transition-all font-black uppercase ${showLayoutControls ? 'bg-[#fbbf24] text-black' : 'bg-white/5 text-white/40'}`}>
                <Sliders size={18}/>
            </button>
        </div>

        {/* FLOATING LAYOUT CONTROLS */}
        {showLayoutControls && (
            <div className="absolute top-16 left-4 bg-black/90 border border-white/10 p-4 rounded-2xl shadow-2xl z-[1000] flex flex-col gap-4 min-w-[200px] animate-in slide-in-from-top-4 font-black uppercase">
                <div className="space-y-1 font-black uppercase">
                    <label className="text-[8px] text-white/40 block font-black uppercase">HEADER HEIGHT</label>
                    <input type="range" min="40" max="100" value={headerHeight} onChange={(e)=>setHeaderHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] font-black uppercase"/>
                </div>
                <div className="space-y-1 font-black uppercase">
                    <label className="text-[8px] text-white/40 block font-black uppercase">FOOTER HEIGHT</label>
                    <input type="range" min="100" max="350" value={footerHeight} onChange={(e)=>setFooterHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] font-black uppercase"/>
                </div>
                <div className="space-y-1 font-black uppercase">
                    <label className="text-[8px] text-white/40 block font-black uppercase">TABLE ZOOM</label>
                    <input type="range" min="0.5" max="1.5" step="0.05" value={tableZoom} onChange={(e)=>setTableZoom(Number(e.target.value))} className="w-full accent-[#fbbf24] font-black uppercase"/>
                </div>
                <button onClick={()=>setShowLayoutControls(false)} className="bg-white/5 p-2 rounded text-[10px] font-black uppercase">CLOSE</button>
            </div>
        )}

        <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-xl flex items-center gap-2 md:gap-4 shadow-inner font-black uppercase">
            <span className="hidden sm:inline text-white/40 text-[9px] tracking-widest font-black uppercase">DEALER:</span>
            <select value={pendingVariantId} onChange={(e) => {setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value})}} className="bg-transparent text-[#fbbf24] outline-none text-[10px] md:text-xs cursor-pointer font-black font-black uppercase">
                {Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900 font-black uppercase">{String(v.name)}</option>)}
            </select>
        </div>
        <div className="flex gap-2 font-black uppercase">
            <button onClick={()=>socket.emit('adminAddBot', {roomId: currentRoomId})} className="text-indigo-400 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-indigo-400/20 font-black uppercase" title="Bot"><Bot size={18}/></button>
            <button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/20 font-black uppercase" title="Exit"><LogOut size={18}/></button>
        </div>
      </header>

      {/* TABLE AREA */}
      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-emerald-950/10 to-transparent overflow-hidden font-black uppercase">
        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 20}px)` }} 
             className="relative w-full max-w-[1200px] aspect-[21/10] flex items-center justify-center h-full transition-transform duration-200 ease-out -translate-y-4 font-black uppercase">
            
            {potTransferring && showdownWinners?.map((w, wi) => {
                const targetIdx = players.findIndex(p => p?.name === w.name);
                const targetPos = getWinnerDisplayPos(targetIdx);
                return (
                    <div key={`award-${wi}`} className="absolute font-black text-emerald-400 font-mono text-[2vw] animate-transfer-chip z-[600]" style={{ '--tx': `${targetPos.x - 50}vw`, '--ty': `${targetPos.y - 43}vh` }}>
                        +${w.amount.toLocaleString()}
                    </div>
                );
            })}
            <div className="absolute inset-0 pointer-events-none z-20 font-black uppercase">
              {players.map((p, i) => {
                const isCurrentHero = p && userProfile && p.uid === userProfile.uid;
                if (!p || isCurrentHero) return null;
                const heroSeatOffset = heroIdx !== -1 ? heroIdx : 0;
                const rIdx = (i - heroSeatOffset + TOTAL_SEATS) % TOTAL_SEATS;
                return <Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} strengthLabel={p.strength} isCollectingBets={isCollectingBets} timeRemaining={timeRemaining} isHero={false} hiLowAwards={hiLowAwards} />;
              })}
            </div>
            
            <div className="absolute inset-0 bg-emerald-950/10 rounded-[45%] border-[1.5vw] border-slate-900 shadow-[inset_0_0_10vw_rgba(0,0,0,0.8)] font-black uppercase" />
            
            <div className="absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center font-black uppercase">
              {!potTransferring && (
                <div className={`flex flex-col items-center transition-all duration-300 font-black uppercase ${potAnimating ? 'scale-125' : 'scale-100 font-black uppercase'}`}>
                    <div className={`text-[4vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-2xl font-black uppercase ${potAnimating ? 'animate-pot-pulse font-black uppercase' : ''}`}>${Number(potAmount).toLocaleString()}</div>
                    <span className="text-[10px] text-[#fbbf24]/40 tracking-[0.4em] font-black uppercase">POT</span>
                </div>
              )}
              <div className="flex gap-2 md:gap-3 scale-[1.1] md:scale-[1.7] mt-4 md:mt-8 font-black uppercase">
                  {(community || []).map((c, j) => (
                    <div key={c.id || j} className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] border bg-white flex flex-col items-center justify-center text-black font-black uppercase ${winning5Ids?.includes(c.id) ? 'ring-2 md:ring-4 ring-yellow-400 scale-110 z-30 shadow-[0_0_20px_#fbbf24] font-black uppercase' : 'border-white/20 shadow-xl font-black uppercase'}`}>
                        <span className="text-[2.5vw] md:text-[0.9vw] font-black font-black uppercase">{String(c.value)}</span><span className={`text-[4vw] md:text-[1.8vw] font-black uppercase ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="absolute inset-0 pointer-events-none z-50 font-black uppercase">
              {heroPlayer && <Seat player={heroPlayer} displayPos={DISPLAY_POSITIONS[0]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === heroIdx} strengthLabel={heroPlayer.strength} isCollectingBets={isCollectingBets} timeRemaining={timeRemaining} isHero={true} hiLowAwards={hiLowAwards} />}
            </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ height: `${footerHeight}px` }} className="bg-black/80 backdrop-blur-3xl border-t border-white/10 flex z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 font-black uppercase">
        <div className="hidden sm:flex w-1/4 border-r border-white/10 p-4 md:p-6 flex flex-col overflow-hidden text-[10px] font-mono tracking-widest font-black uppercase">
            <div className="text-white/40 mb-4 flex items-center gap-2 border-b border-white/5 pb-2 uppercase font-black uppercase"><Info size={14}/> FEED</div>
            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide font-black uppercase">
                {logs.map(l => (
                    <div key={l.id} className="animate-in slide-in-from-left duration-300 flex items-start gap-2 border-l-2 border-white/5 pl-2 py-0.5 font-black uppercase">
                        <span className="text-white/20 text-[8px] font-black shrink-0 uppercase font-black uppercase">{String(l.time)}</span> 
                        <div className="flex flex-wrap gap-x-1 font-black uppercase">
                             <span className={`font-black uppercase text-[9px] font-black uppercase ${l.type === 'win' ? 'text-emerald-400 font-black uppercase' : l.type === 'variant' ? 'text-purple-400 font-black uppercase' : 'text-[#fbbf24] font-black uppercase'}`}>{String(l.name)}</span>
                             <span className="text-white/60 lowercase tracking-normal text-[9px] font-black uppercase">{String(l.action)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-4 md:px-10 relative bg-white/5 shadow-inner font-black uppercase">
          {activeIdx === heroIdx && phase !== PHASES.SHOWDOWN && phase !== PHASES.IDLE && heroPlayer ? (
            <div className="flex flex-col gap-3 md:gap-4 animate-in slide-in-from-bottom duration-500 items-center w-full font-black uppercase">
                <div className="flex gap-2 md:gap-3 justify-center w-full max-w-[600px] font-black uppercase">
                    <button onClick={()=>handleAction('RAISE', highestBet + Math.floor(potAmount * 0.5))} className="flex-1 py-1.5 md:py-2 bg-white/5 border border-white/10 rounded-xl text-[8px] md:text-[10px] hover:bg-[#fbbf24] hover:text-black transition-all font-black uppercase truncate px-1 uppercase font-black uppercase">1/2 POT</button>
                    <button onClick={()=>handleAction('RAISE', highestBet + potAmount)} className="flex-1 py-1.5 md:py-2 bg-white/5 border border-white/10 rounded-xl text-[8px] md:text-[10px] hover:bg-[#fbbf24] hover:text-black transition-all font-black uppercase truncate px-1 uppercase font-black uppercase">POT</button>
                    <button onClick={()=>handleAction('RAISE', heroPlayer.chips + heroPlayer.currentBet)} className="flex-1 py-1.5 md:py-2 bg-red-900/20 border border-red-500/50 rounded-xl text-[8px] md:text-[10px] text-red-500 hover:bg-red-600 transition-all font-black uppercase font-black uppercase">ALL-IN</button>
                </div>
                <div className="flex gap-2 md:gap-4 w-full items-center justify-center font-black uppercase">
                    <button onClick={()=>handleAction('FOLD')} className="w-16 md:w-24 h-12 md:h-16 bg-red-950/60 border border-red-500/50 rounded-2xl tracking-[0.1em] hover:brightness-125 transition-all font-black text-[10px] md:text-xs font-black uppercase">FOLD</button>
                    <button onClick={()=>handleAction('CALL')} className="flex-1 max-w-[280px] h-12 md:h-16 bg-blue-950/60 border border-blue-500/50 rounded-2xl text-sm md:text-xl tracking-[0.1em] hover:brightness-125 font-black uppercase uppercase font-black uppercase">
                        {highestBet > heroPlayer.currentBet ? `CALL $${highestBet - heroPlayer.currentBet}` : 'CHECK'}
                    </button>
                    <div className="flex gap-1 md:gap-2 items-center bg-black/60 border border-white/10 p-1 md:p-2 rounded-2xl shadow-inner min-w-[120px] md:min-w-[240px] font-black uppercase">
                        <div className="flex items-center bg-black/40 px-2 rounded-xl border border-white/5 font-black uppercase">
                            <span className="text-[#fbbf24] text-[10px] md:text-xs font-mono mr-0.5 uppercase font-black uppercase">$</span>
                            <input type="number" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(heroPlayer.chips + heroPlayer.currentBet, Math.max(highestBet + 20, Number(e.target.value))))} className="w-12 md:w-20 bg-transparent py-2 text-center font-mono text-sm md:text-xl text-[#fbbf24] outline-none font-black font-black font-black uppercase" />
                        </div>
                        <button onClick={()=>handleAction('RAISE', raiseInput)} className="flex-1 h-8 md:h-12 bg-emerald-950/60 border border-emerald-500/50 rounded-xl flex items-center justify-center hover:brightness-125 font-black uppercase text-[10px] md:text-base font-black uppercase"><Zap size={14}/><span className="hidden sm:inline ml-1 font-black uppercase">RAISE</span></button>
                    </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase">
                {showdownWinners && showdownWinners.length > 0 ? (
                    <div className="flex items-center gap-6 md:gap-10 animate-in fade-in zoom-in-95 duration-500 w-full h-full justify-center font-black uppercase">
                        <div className="flex flex-col items-center font-black uppercase">
                            <Trophy size={42} md:size={48} className="text-[#fbbf24] animate-bounce mb-1 font-black uppercase font-black uppercase" />
                            <div className="text-center font-black uppercase">
                                <h4 className="text-[#fbbf24] text-base md:text-xl font-black uppercase truncate max-w-[100px] md:max-w-none uppercase font-black uppercase font-black uppercase font-black uppercase font-black uppercase">SCOOP!</h4>
                                <p className="text-white/60 text-[8px] md:text-xs font-black uppercase tracking-widest font-black uppercase font-black uppercase">{showdownWinners[0].rank}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 font-black uppercase">
                             <div className="flex gap-2 p-3 bg-black/40 rounded-2xl border border-[#fbbf24]/30 relative font-black uppercase">
                                  <div className="absolute -top-2 -right-2 bg-emerald-500 text-black px-3 py-0.5 rounded-full font-black text-sm md:text-xl shadow-xl animate-pulse uppercase font-black uppercase">
                                     +${showdownWinners[0].amount.toLocaleString()}
                                  </div>
                                  {(showdownWinners[0].hand || []).map((c, ci) => (
                                     <div key={ci} className="w-[8vw] md:w-[4vw] h-[11vw] md:h-[5.5vw] bg-white rounded-lg flex flex-col items-center justify-center text-black shadow-2xl ring-2 ring-yellow-400/50 transform hover:scale-110 transition-all duration-300 font-black bg-glimmer uppercase font-black uppercase">
                                         <span className="text-[2.5vw] md:text-[1.2vw] font-black uppercase font-black uppercase">{c.value}</span>
                                         <span className={`text-[4vw] md:text-[2vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'} font-black uppercase`}>{c.suit}</span>
                                     </div>
                                  ))}
                             </div>
                             <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10 font-black uppercase">
                                 <div className="h-full bg-emerald-500 animate-[progress_7.5s_linear] shadow-[0_0_10px_#10b981]" style={{width: '100%'}} />
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 animate-pulse font-black uppercase">
                        <Target size={42} className="text-white/10 font-black uppercase"/>
                        <span className="text-[#fbbf24] tracking-[0.4em] text-sm md:text-lg font-black italic font-black uppercase">
                            {phase === PHASES.IDLE ? "ARENA IDLE" : "WAITING FOR MOVE"}
                        </span>
                    </div>
                )}
            </div>
          )}
        </div>
      </footer>
      <style>{`
          @keyframes progress { from { width: 100%; } to { width: 0%; } }
          @keyframes fling-to-pot { 0% { transform: translate(-50%, -100%) scale(1); } 100% { transform: translate(0, -30vh) scale(0.2) rotate(720deg); opacity: 0; } }
          @keyframes transfer-chip { 0% { top: 43%; left: 50%; opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { top: var(--ty); left: var(--tx); opacity: 0; transform: translate(-50%, -50%) scale(0.1); } }
          @keyframes pot-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.3); filter: brightness(1.5); } 100% { transform: scale(1); } }
          .animate-pot-pulse { animation: pot-pulse 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .animate-transfer-chip { animation: transfer-chip 1.2s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; }
          .bg-glimmer { background: linear-gradient(135deg, #fff 0%, #fff 40%, #fbbf24 50%, #fff 60%, #fff 100%); background-size: 200% 200%; animation: glimmer 3s infinite; }
          @keyframes glimmer { 0% { background-position: -100% -100%; } 100% { background-position: 200% 200%; } }
      `}</style>
    </div>
  );
};

export default App;
