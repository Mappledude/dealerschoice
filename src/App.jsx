import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer
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
  { x: 50, y: 96 }, { x: 18, y: 82 }, { x: 5,  y: 50 }, { x: 8,  y: 22 }, { x: 28, y: 8  },
  { x: 50, y: 4  }, { x: 72, y: 8  }, { x: 92, y: 22 }, { x: 95, y: 50 }, { x: 82, y: 82 }
];

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em' }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA' }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple' }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis' } 
};

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const Seat = ({ player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, strengthLabel, potTransferring, timeRemaining, isHero }) => {
    if (!player || !displayPos) return null;
    const isShowdown = phase === PHASES.SHOWDOWN;

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col-reverse items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-20 grayscale scale-95' : 'opacity-100'}`}>
            {/* 1. Player Info Bubble */}
            <div className={`flex items-center gap-2 p-[0.6vw] px-[2vw] rounded-full border-2 bg-black/95 backdrop-blur-xl transition-all duration-300 ${isActiveTurn ? 'border-cyan-400 shadow-[0_0_1.5vw_#22d3ee] scale-105' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 scale-110 shadow-[0_0_2.5vw_#fbbf24]' : ''}`}>
                {isActiveTurn && timeRemaining > 0 && (
                    <div className={`absolute -right-12 flex items-center justify-center w-10 h-10 rounded-full border-2 bg-black/80 font-black text-sm transition-colors ${timeRemaining <= 10 ? 'border-red-500 text-red-500 animate-pulse' : 'border-cyan-400 text-cyan-400'}`}>
                        {String(timeRemaining)}
                    </div>
                )}
                <div className="flex flex-col items-center">
                    <span className="text-[1vw] font-black text-white uppercase tracking-wider">{String(player.name)}</span>
                    <span className={`text-[1.1vw] font-mono font-black ${player.chips === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-500/80'}`}>
                        ${Number(player.chips).toLocaleString()}
                    </span>
                </div>
            </div>

            {/* 2. Current Bet Indicator (Animated Chip Toss) */}
            {player.currentBet > 0 && (
                <div className="absolute bg-gradient-to-b from-[#fbbf24] to-[#d97706] text-black font-black text-[0.9vw] px-4 py-1 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5),0_0_15px_rgba(251,191,36,0.3)] border border-white/30 transition-all z-[100]"
                    style={{ 
                        top: isCollectingBets ? `${43 - displayPos.y}vh` : (isHero ? '-7.5vw' : '-5vw'), 
                        left: isCollectingBets ? `${50 - displayPos.x}vw` : '50%', 
                        transform: `translate(-50%, -100%) ${isCollectingBets ? 'scale(0.2) rotate(360deg)' : 'scale(1)'}`, 
                        opacity: isCollectingBets ? 0 : 1,
                        transitionTimingFunction: isCollectingBets ? 'cubic-bezier(0.4, 0, 0.2, 1)' : 'ease-out',
                        transitionDuration: isCollectingBets ? '1000ms' : '500ms'
                    }}>
                    ${String(player.currentBet)}
                </div>
            )}

            {/* 3. Hand Strength Indicator (Purple Bubble) */}
            {strengthLabel && !player.isFolded && (isHero || isShowdown) && phase !== PHASES.IDLE && (
                <div className="h-6 px-3 bg-purple-600 border border-purple-400 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.6)] mb-2 flex items-center animate-in fade-in zoom-in-95 duration-300">
                    <span className="text-[9px] font-black uppercase text-white tracking-widest">{String(strengthLabel)}</span>
                </div>
            )}

            {/* 4. Player Cards */}
            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mb-4 overflow-visible">
                    {player.hand.map((c, ci) => (
                        <div key={c.id || ci} className={`w-[2.5vw] h-[3.5vw] rounded-[0.4vw] flex flex-col items-start p-[0.2vw] border shadow-2xl absolute transition-all duration-300 ${isShowdown || isHero ? 'bg-white text-black' : 'bg-gradient-to-br from-slate-700 to-black'} ${isShowdown && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 z-30' : 'border-white/20'}`} style={{ transform: `translateX(${(ci - (player.hand.length - 1) / 2) * 2.5}vw) rotate(${(ci - (player.hand.length - 1) / 2) * 10}deg) scale(1.5)`, transformOrigin: 'bottom center' }}>
                            {(isShowdown || isHero) && (
                                <><span className="text-[0.8vw] font-black leading-none">{String(c.value)}</span><span className={`text-[1.2vw] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></>
                            )}
                            {!(isShowdown || isHero) && (
                                <div className="w-full h-full flex items-center justify-center opacity-20"><ShieldCheck size={12}/></div>
                            )}
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
  const [newTable, setNewTable] = useState({ name: '', sb: 10, bb: 20, minBuy: 400, maxBuy: 2000 });
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potAnimating, setPotAnimating] = useState(false);

  useEffect(() => {
    socket.on('roomUpdate', (d) => {
        if (!d) return;
        
        const phaseChanged = d.phase !== phase && phase !== PHASES.IDLE;
        const potIncreased = Number(d.potData?.[0]?.amount) > potAmount;

        if (phaseChanged) {
            setIsCollectingBets(true);
            setTimeout(() => {
                setIsCollectingBets(false);
                if (potIncreased) {
                    setPotAnimating(true);
                    setTimeout(() => setPotAnimating(false), 500);
                }
            }, 1000);
        } else if (potIncreased && d.phase === phase) {
             setPotAnimating(true);
             setTimeout(() => setPotAnimating(false), 500);
        }

        setPlayers(() => { const next = [...INITIAL_PLAYERS]; d.players?.forEach((p, i) => { if (p) next[i] = p; }); return next; });
        setPhase(d.phase); 
        setCommunity(d.community || []); 
        setActiveVariant(d.activeVariant || VARIANTS.HOLDEM);
        setHighestBet(Number(d.highestBet) || 0); 
        setActiveIdx(d.activeIdx ?? -1); 
        setWinning5Ids(d.winning5Ids || []);
        setPotAmount(Number(d.potData?.[0]?.amount) || 0); 
        setTimeRemaining(Number(d.timeRemaining) || 30);
        
        if (d.activeIdx !== -1 && d.players?.[d.activeIdx]?.uid === userProfile?.uid) {
            setRaiseInput(prev => (prev < Number(d.highestBet) + 20) ? Number(d.highestBet) + 20 : prev);
        }
    });

    socket.on('lobbyUpdate', (list) => setActiveTables(list || []));
    socket.on('profilesUpdate', (list) => {
        setAllProfiles(list || []);
        if (userProfile) {
            const updated = list.find(p => p.uid === userProfile.uid);
            if (updated) setUserProfile(updated);
        }
    });
    socket.on('initialDataResponse', (d) => { setAllProfiles(d.profiles || []); setActiveTables(d.rooms || []); });
    socket.on('loginSuccess', (p) => { setUserProfile(p); setPendingVariantId(p.pendingVariant || 'HOLDEM'); setCurrentView(VIEWS.LOBBY); socket.emit('getInitialData'); });
    socket.on('log', (d) => setLogs(prev => [{ id: Math.random(), ...d }, ...prev].slice(0, 50)));
    return () => { socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); socket.off('loginSuccess'); socket.off('log'); };
  }, [phase, potAmount, userProfile]);

  const heroIdx = useMemo(() => userProfile ? players.findIndex(p => p && p.uid === userProfile.uid) : -1, [players, userProfile]);
  const heroPlayer = heroIdx !== -1 ? players[heroIdx] : null;

  const handleAction = (type, amt = 0) => {
      const roomId = currentRoomId;
      if (!roomId) return;
      const finalAmount = type === 'RAISE' ? Number(amt || raiseInput) : 0;
      socket.emit('playerAction', { roomId, type, amount: finalAmount });
  };

  const handleLogin = () => { 
      if (passwordInput === 'pass') { 
          socket.emit('getInitialData'); 
          setCurrentView(VIEWS.ADMIN); 
      } else {
          socket.emit('playerLogin', { password: passwordInput }); 
      }
  };

  const joinRoom = () => {
    if (!selectedTableForJoin || !userProfile) return;
    const rId = selectedTableForJoin.id;
    socket.emit('joinRoom', { 
        roomId: rId, 
        profile: { ...userProfile, pendingVariant: pendingVariantId }, 
        buyIn: buyInAmount 
    }, (res) => {
        if (res?.status === 'ok') {
            setCurrentRoomId(rId);
            setCurrentView(VIEWS.GAME);
            setSelectedTableForJoin(null);
        }
    });
  };

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center text-white font-black uppercase tracking-tighter">
        <div className="w-[30vw] p-12 bg-black/60 border border-white/10 rounded-[2vw] backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8">
            <div className="p-4 bg-white/5 rounded-full ring-1 ring-white/10 shadow-inner"><Lock size={32} className="text-[#fbbf24]" /></div>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="ENTER PASSCODE" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none focus:ring-2 focus:ring-[#fbbf24]/50 transition-all"/>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl font-black">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex text-white font-black uppercase overflow-hidden">
        <aside className="w-64 border-r border-white/10 p-8 flex flex-col gap-4 bg-black/20">
            <h2 className="text-[#fbbf24] mb-8 flex items-center gap-2"><ShieldCheck size={20}/> SUPER ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`p-4 rounded-xl text-left transition-all ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black scale-105' : 'text-white/40 hover:bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`p-4 rounded-xl text-left transition-all ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black scale-105' : 'text-white/40 hover:bg-white/5'}`}>TABLES</button>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="mt-auto flex items-center gap-2 text-red-500 text-xs hover:brightness-125 transition-all"><ArrowLeft size={14}/> LOGOUT</button>
        </aside>
        <main className="flex-1 p-12 overflow-y-auto bg-gradient-to-br from-transparent to-white/5">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-left-4">
                    <div className="flex justify-between items-center"><h3 className="text-2xl tracking-widest">PLAYER REGISTRY</h3></div>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-3 gap-4 border border-white/10 shadow-xl">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 uppercase outline-none focus:border-[#fbbf24]"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-4 rounded-xl border border-white/10 uppercase outline-none focus:border-[#fbbf24]"/>
                        <button onClick={()=>socket.emit('adminCreatePlayer', {...newPlayer, uid: Math.random().toString(36).slice(2)})} className="bg-[#fbbf24] text-black rounded-xl hover:brightness-110 active:scale-95 transition-all font-black">CREATE IDENTITY</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                        {allProfiles.map(p => (
                            <div key={p.uid} className="flex justify-between p-6 border-b border-white/5 hover:bg-white/5 transition-all">
                                <span>{String(p.name)} <span className="text-white/20 ml-2">({String(p.password)})</span></span>
                                <div className="flex gap-6 items-center">
                                    <span className="text-emerald-400 font-mono text-lg">${Number(p.chips).toLocaleString()}</span>
                                    <button onClick={()=>{const n = prompt("NEW WALLET", p.chips); if(n) socket.emit('adminEditChips', {uid: p.uid, chips: Number(n)})}} className="text-cyan-400 hover:scale-110 transition-all"><Edit3 size={18}/></button>
                                    <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500 hover:scale-110 transition-all"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-left-4">
                    <h3 className="text-2xl tracking-widest">ROOM CONTROL</h3>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-2 gap-4 border border-white/10 shadow-xl">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ROOM NAME" className="bg-black/40 p-4 rounded-xl border border-white/10 uppercase outline-none focus:border-[#fbbf24]"/>
                        <div className="grid grid-cols-2 gap-2"><input placeholder="SB" type="number" className="bg-black/40 p-4 rounded-xl border border-white/10" onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})}/><input placeholder="BB" type="number" className="bg-black/40 p-4 rounded-xl border border-white/10" onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})}/></div>
                        <div className="grid grid-cols-2 gap-2"><input placeholder="MIN" type="number" className="bg-black/40 p-4 rounded-xl border border-white/10" onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})}/><input placeholder="MAX" type="number" className="bg-black/40 p-4 rounded-xl border border-white/10" onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})}/></div>
                        <button onClick={()=>socket.emit('adminCreateRoom', {...newTable, id: 'room_'+Math.random()})} className="bg-emerald-600 rounded-xl hover:brightness-110 active:scale-95 transition-all font-black">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {activeTables.map(t => (
                            <div key={t.id} className="bg-white/5 p-6 rounded-2xl flex justify-between items-center border border-white/10 hover:border-emerald-500/50 transition-all">
                                <div><h4 className="text-[#fbbf24] text-lg">{String(t.name)}</h4><p className="text-[10px] text-white/40 tracking-widest">${t.sb}/${t.bb} | {t.players.filter(Boolean).length} SEATED</p></div>
                                <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 p-3 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all">TERMINATE</button>
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
                    <h3 className="text-3xl text-center tracking-widest text-[#fbbf24]">{String(selectedTableForJoin.name)}</h3>
                    <div className="space-y-6">
                        <div className="flex justify-between items-center text-xs text-white/40"><span>BUY-IN AMOUNT</span><span className="text-emerald-400 text-3xl font-mono">${buyInAmount}</span></div>
                        <input type="range" min={selectedTableForJoin.minBuy || 400} max={selectedTableForJoin.maxBuy || 2000} step={100} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fbbf24]" />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all">BACK</button>
                        <button onClick={joinRoom} className="flex-2 p-5 bg-emerald-600 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all text-sm tracking-widest">CONFIRM SEAT</button>
                    </div>
                </div>
            </div>
        )}
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-12 bg-black/40 backdrop-blur-md shadow-xl z-50">
            <h2 className="tracking-[0.4em] text-xl flex items-center gap-4"><LayoutGrid className="text-[#fbbf24]"/> ARENA LOBBY</h2>
            <div className="flex items-center gap-10">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-white/40 tracking-widest">IDENTITY: {String(userProfile?.name)}</span>
                    <span className="text-emerald-400 font-mono text-2xl tracking-tighter">${Number(userProfile?.chips).toLocaleString()}</span>
                </div>
                <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all hover:scale-110"><LogOut size={28}/></button>
            </div>
        </header>
        <main className="flex-1 p-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 overflow-y-auto">
            {activeTables.map((t) => (
                <div key={t.id} className="p-10 bg-white/5 border border-white/5 rounded-[3vw] flex flex-col gap-8 shadow-2xl hover:border-[#fbbf24]/20 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><LayoutGrid size={80}/></div>
                    <h3 className="text-2xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors">{String(t.name)}</h3>
                    <div className="text-[10px] text-white/40 h-10 tracking-widest">
                        SEATED: {t.players?.filter(p => p).map(p => String(p.name)).join(', ') || 'NONE SEATED'}
                    </div>
                    <div className="bg-black/60 p-6 rounded-2xl flex justify-between items-center border border-white/5">
                        <div className="flex flex-col"><span className="text-[8px] text-white/40 tracking-[0.2em]">STAKES</span><span className="text-[#fbbf24] text-xl tracking-tighter">${t.sb}/${t.bb}</span></div>
                        <div className="flex flex-col items-end"><span className="text-[8px] text-white/40 tracking-[0.2em]">CAPACITY</span><span className="text-white/80 font-mono">{t.players?.filter(p=>p).length}/10</span></div>
                    </div>
                    <button onClick={()=>setSelectedTableForJoin(t)} className="w-full p-8 bg-emerald-600 rounded-[2vw] tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-sm font-black">ENTER ARENA</button>
                </div>
            ))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase">
      <header className="absolute top-0 left-0 right-0 h-16 bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-8 z-[80] shadow-2xl backdrop-blur-md">
        <div className="bg-white/5 px-6 py-2 rounded-2xl border border-white/5 shadow-inner"><span className="text-[#fbbf24] text-[10px] tracking-widest">ARENA VARIANT:</span><span className="text-white ml-2 text-xs">{String(activeVariant.name)}</span></div>
        <div className="bg-white/5 border border-white/10 px-6 py-2 rounded-2xl flex items-center gap-4 shadow-inner">
            <span className="text-white/40 text-[9px] tracking-widest">DEALER CHOICE:</span>
            <select value={pendingVariantId} onChange={(e) => {setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value})}} className="bg-transparent text-[#fbbf24] outline-none text-xs cursor-pointer font-black">
                {Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900">{String(v.name)}</option>)}
            </select>
        </div>
        <div className="flex gap-4">
            <button onClick={()=>socket.emit('adminAddBot', {roomId: currentRoomId})} className="text-indigo-400 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-indigo-400/20 transition-all" title="Add Intelligence Bot"><Bot size={20}/></button>
            <button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-red-500/20 transition-all" title="Leave Arena"><LogOut size={20}/></button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center relative bg-gradient-to-b from-emerald-950/10 to-transparent">
        <div className="relative w-full max-w-[1600px] aspect-[21/10] flex items-center justify-center -translate-y-10">
            <div className="absolute inset-0 pointer-events-none z-20">
              {players.map((p, i) => {
                if (!p || p.uid === userProfile?.uid) return null;
                const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS;
                return <Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} strengthLabel={p.strength} isCollectingBets={isCollectingBets} timeRemaining={timeRemaining} isHero={false} />;
              })}
            </div>
            
            {/* The Table Surface */}
            <div className="absolute inset-0 bg-emerald-950/10 rounded-[40%] border-[1.5vw] border-slate-900 shadow-[inset_0_0_10vw_rgba(0,0,0,0.8),0_10px_30px_rgba(0,0,0,0.5)]" />
            
            {/* Central Community & Pot area */}
            <div className="absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none">
              <div className={`flex flex-col items-center transition-all duration-300 ${potAnimating ? 'scale-125' : 'scale-100'}`}>
                <span className="text-[10px] text-[#fbbf24]/40 tracking-[0.4em] mb-1">TOTAL POT</span>
                <div className={`text-[4vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-2xl ${potAnimating ? 'animate-pulse' : ''}`}>
                    ${Number(potAmount).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-3 scale-[1.7] mt-8">
                  {community.map((c, j) => (
                    <div key={c.id || j} className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] border bg-white flex flex-col items-center justify-center text-black ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 z-30' : 'border-white/20 shadow-xl'}`}>
                        <span className="text-[0.9vw] font-black">{String(c.value)}</span><span className={`text-[1.8vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* HERO SLOT */}
            <div style={{ left: '50%', top: '98%', transform: 'translate(-50%, -100%)' }} className="absolute flex flex-col items-center z-50">
              {heroPlayer && <Seat player={heroPlayer} displayPos={{x: 50, y: 100}} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === heroIdx} strengthLabel={heroPlayer.strength} isCollectingBets={isCollectingBets} timeRemaining={timeRemaining} isHero={true} />}
            </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-[220px] bg-black/80 backdrop-blur-3xl border-t border-white/10 flex z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="w-1/3 border-r border-white/10 p-6 flex flex-col overflow-hidden text-[10px] font-mono tracking-widest">
            <div className="text-white/40 mb-4 flex items-center gap-2 border-b border-white/5 pb-2"><Info size={14}/> LIVE ARENA FEED</div>
            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-hide">
                {logs.map(l => (
                    <div key={l.id} className="animate-in slide-in-from-left duration-300 flex items-start gap-2">
                        <span className="text-white/20">[{String(l.time)}]</span> 
                        <span className="text-[#fbbf24] flex-shrink-0">{String(l.name)}</span>
                        <span className="text-white/60 lowercase">{String(l.action)}</span>
                    </div>
                ))}
            </div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-10 relative bg-white/5 shadow-inner">
          {activeIdx === heroIdx && phase !== PHASES.SHOWDOWN && phase !== PHASES.IDLE && heroPlayer ? (
            <div className="flex flex-col gap-4 animate-in slide-in-from-bottom duration-500 items-center w-full">
                {/* PRESET ROW */}
                <div className="flex gap-3 justify-center w-full max-w-[600px]">
                    <button onClick={()=>handleAction('RAISE', highestBet + Math.floor(potAmount * 0.5))} className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] hover:bg-[#fbbf24] hover:text-black transition-all font-black tracking-widest uppercase">1/2 POT (${Math.floor(potAmount * 0.5)})</button>
                    <button onClick={()=>handleAction('RAISE', highestBet + potAmount)} className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] hover:bg-[#fbbf24] hover:text-black transition-all font-black tracking-widest uppercase">POT (${potAmount})</button>
                    <button onClick={()=>handleAction('RAISE', heroPlayer.chips + heroPlayer.currentBet)} className="flex-1 py-2 bg-red-900/20 border border-red-500/50 rounded-xl text-[10px] text-red-500 hover:bg-red-600 hover:text-white transition-all font-black tracking-widest uppercase">ALL-IN</button>
                </div>

                {/* ACTION ROW */}
                <div className="flex gap-4 w-full items-center justify-center">
                    <button onClick={()=>handleAction('FOLD')} className="w-24 h-16 bg-red-950/60 border border-red-500/50 rounded-2xl tracking-[0.2em] hover:brightness-125 transition-all shadow-xl font-black text-xs">FOLD</button>
                    <button onClick={()=>handleAction('CALL')} className="flex-1 max-w-[280px] h-16 bg-blue-950/60 border border-blue-500/50 rounded-2xl text-xl tracking-[0.2em] hover:brightness-125 transition-all shadow-xl font-black">
                        {highestBet > heroPlayer.currentBet ? `CALL $${highestBet - heroPlayer.currentBet}` : 'CHECK'}
                    </button>
                    
                    {/* CUSTOM RAISE AREA */}
                    <div className="flex gap-2 items-center bg-black/60 border border-white/10 p-2 rounded-2xl shadow-inner min-w-[240px]">
                        <div className="flex items-center bg-black/40 px-3 rounded-xl border border-white/5">
                            <span className="text-[#fbbf24] text-xs font-mono mr-1">$</span>
                            <input 
                                type="number" 
                                value={raiseInput} 
                                onChange={(e) => setRaiseInput(Math.min(heroPlayer.chips + heroPlayer.currentBet, Math.max(highestBet + 20, Number(e.target.value))))}
                                className="w-20 bg-transparent py-3 text-center font-mono text-xl text-[#fbbf24] outline-none"
                            />
                        </div>
                        <button onClick={()=>handleAction('RAISE', raiseInput)} className="flex-1 h-12 bg-emerald-950/60 border border-emerald-500/50 rounded-xl flex items-center justify-center hover:brightness-125 transition-all shadow-lg font-black tracking-widest"><Zap size={16} className="mr-2 text-emerald-400"/>RAISE</button>
                    </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 animate-pulse">
                <Target size={48} className="text-white/10"/>
                <span className="text-[#fbbf24] tracking-[0.5em] text-lg font-black italic">
                    {phase === PHASES.IDLE ? "WAITING FOR NEW DEAL" : (phase === PHASES.SHOWDOWN ? "SHOWDOWN REVEAL" : "WAITING FOR OPPONENT...")}
                </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;
