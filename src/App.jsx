import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare, Clock, BarChart3, Settings, Maximize, Minimize, Copy, Check, Activity, BookOpen, Terminal, ChevronRight as ChevronRightIcon, HelpCircle
} from 'lucide-react';
import io from 'socket.io-client';

// --- CONSTANTS ---
// VERSION: v1.1.2
const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { 
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000 
});

const VERSION = "v1.1.2";
const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const VARIANT_COLORS = {
  HOLDEM: '#22d3ee',
  OMAHA: '#a855f7',
  PINEAPPLE: '#eab308',
  MUFLIS: '#39FF14',
  HILOW: '#ff007f', 
  REDSBLACKS: '#ff0000'
};

const getContrastColor = (hex) => {
  if (!hex) return 'white';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? 'black' : 'white';
};

const NEON_PALETTE = ['text-[#39FF14]', 'text-[#FF00FF]', 'text-[#00FFFF]', 'text-[#FF5F1F]', 'text-[#FFFF00]', 'text-[#B026FF]'];

const getNeonNameColor = (name) => {
  if (!name || name === "SYSTEM") return "text-white";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return NEON_PALETTE[Math.abs(hash) % NEON_PALETTE.length];
};

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', rules: ["Each player gets 2 hole cards.", "Best 5-card combo wins."] }, 
  OMAHA: { id: 'OMAHA', name: 'Omaha', rules: ["Each player gets 4 hole cards.", "MUST use 2 from hand and 3 from board."] }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', rules: ["Each player gets 3 hole cards."] }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', rules: ["Worst hand wins the pot."] }, 
  HILOW: { id: 'HILOW', name: 'Hi-Low Split', rules: ["Pot split between High and Low."] }, 
  REDSBLACKS: { id: 'REDSBLACKS', name: 'Reds & Blacks', rules: ["4 hole cards dealt.", "Dynamic Joker mechanic."] }
};

const DISPLAY_POSITIONS = [
  { x: 50, y: 92 }, { x: 25, y: 84 }, { x: 10, y: 62 }, { x: 10, y: 38 }, { x: 25, y: 16 },
  { x: 50, y: 8  }, { x: 75, y: 16 }, { x: 90, y: 38 }, { x: 90, y: 62 }, { x: 75, y: 84 }
];

const DashTimer = ({ timeRemaining }) => {
  const percentage = Math.max(0, (timeRemaining / 24) * 100);
  const color = timeRemaining < 6 ? '#ef4444' : timeRemaining < 12 ? '#f59e0b' : '#22d3ee';
  return (
    <div className="w-24 md:w-32 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
      <div className="h-full bg-current transition-all duration-1000" style={{ width: `${percentage}%`, color, boxShadow: `0 0 10px ${color}` }} />
    </div>
  );
};

const Seat = ({ player, displayPos, phase, winning5Ids, isActiveTurn, isDealer, visuals, bigBlind, showdownWinners, formatRank, isHero }) => {
    if (!player) return null;
    const isFolded = player.isFolded;
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    
    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-500 ${isHero ? 'z-[100]' : 'z-20'}`}>
            {player.hand && player.hand.length > 0 && (
                <div className={`flex relative -mb-8 z-30 ${isFolded ? 'opacity-30 grayscale scale-90' : ''}`}>
                    {player.hand.map((c, ci) => (
                        <div key={ci} className={`w-[7vw] lg:w-[5vh] h-[10vw] lg:h-[7vh] rounded-md border absolute shadow-2xl transition-all ${isHero || phase === PHASES.SHOWDOWN ? 'bg-white' : 'card-back-diamond'}`}
                             style={{ transform: `translateX(${(ci - (player.hand.length-1)/2) * (isHero ? visuals.heroCardSpread : 2)}vh)`, transformOrigin: 'bottom center' }}>
                             {(isHero || phase === PHASES.SHOWDOWN) && (
                                 <div className={`flex flex-col p-1 text-left ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-900'}`}>
                                     <span className="text-[10px] font-black leading-none">{c.value}</span>
                                     <span className="text-sm leading-none">{c.suit}</span>
                                 </div>
                             )}
                        </div>
                    ))}
                </div>
            )}
            <div className={`relative z-[90] flex flex-col items-center p-2 lg:p-3 rounded-xl border transition-all duration-300 min-w-[120px] lg:min-w-[14vh] backdrop-blur-xl ${isActiveTurn ? 'border-white ring-4 ring-white/20 bg-slate-800' : 'border-white/10 bg-black/80'}`}>
                {isDealer && (
                    <div className="absolute bottom-[2px] left-1/2 -translate-x-1/2 z-[110]"><div className="w-2.5 h-2.5 bg-red-600 rounded-full border border-white shadow-[0_0_8px_red]" /></div>
                )}
                <div className={`flex flex-col items-center w-full transition-all ${isFolded ? 'opacity-40 grayscale' : ''}`}>
                    <span className="text-[12px] lg:text-[1.6vh] font-black text-white uppercase truncate max-w-[80px]">{player.name}</span>
                    <span className="text-[14px] lg:text-[2.2vh] font-mono font-black text-emerald-400">${Number(player.chips).toLocaleString()}</span>
                    {phase === PHASES.SHOWDOWN && player.strength && <span className="text-[8px] text-cyan-400 font-bold uppercase">{formatRank(player.strength)}</span>}
                </div>
                {isActiveTurn && <DashTimer timeRemaining={24} />}
            </div>
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
  const [logs, setLogs] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [expandedHands, setExpandedHands] = useState(new Set());
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState(100);
  const [raiseInput, setRaiseInput] = useState(0);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 10000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 1, bb: 2, minBuy: 50, maxBuy: 100 });
  const [nuclearConfirm, setNuclearConfirm] = useState(false);

  const visuals = { heroCardScale: 2.0, heroCardY: -54, heroCardSpread: 3.0, oppCardScale: 1.0, oppCardY: -10, commCardScale: 1.5, tableZoom: 0.9, footerHeight: 250, holeCardFan: 35 };

  const heroIdx = useMemo(() => userProfile ? players.findIndex(p => p && p.uid === userProfile.uid) : -1, [players, userProfile]);
  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);
  const totalDisplayPot = useMemo(() => {
    const sum = players.reduce((acc, p) => acc + (Number(p?.currentBet) || 0), 0);
    const total = Number(potAmount) + sum;
    return isNaN(total) ? 0 : total;
  }, [potAmount, players]);

  const handleForceSync = () => socket.emit('getInitialData');
  const handleAction = (type, amt = 0) => {
      const room = activeTables[0]?.id || 'room_100';
      socket.emit('playerAction', { roomId: room, type, amount: type === 'RAISE' ? Number(amt || raiseInput) : 0 });
  };

  const handleLogin = () => {
    if (passwordInput.toLowerCase().trim() === 'pass') {
      setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin' });
      setCurrentView(VIEWS.ADMIN);
      socket.emit('getInitialData');
    } else {
      socket.emit('playerLogin', { password: passwordInput });
    }
  };

  const copyActivityToClipboard = () => {
    let logTextExport = logs.map(l => `[${l.name}] ${l.action}`).join('\n');
    const textArea = document.createElement("textarea"); 
    textArea.value = logTextExport; 
    textArea.style.position = "fixed"; textArea.style.left = "-9999px"; textArea.style.top = "0";
    document.body.appendChild(textArea); 
    textArea.focus(); textArea.select();
    try { document.execCommand('copy'); } catch (err) { console.error("Export Error:", err); } 
    document.body.removeChild(textArea);
  };

  const handHistory = useMemo(() => {
    const hands = []; let cur = null;
    ([...logs].reverse()).forEach(log => {
        if (log.type === 'phase' && log.action.includes('DEALING')) {
            if (cur) hands.push(cur);
            cur = { id: log.timestamp, variant: log.action.split('DEALING ')[1] || "Poker", winner: null, events: [log], timestamp: log.timestamp };
        } else if (cur) {
            cur.events.push(log);
            if (log.type === 'win') { cur.winner = log.name; cur.amount = log.action.split('$')[1]?.split(' ')[0]; }
        }
    });
    if (cur) hands.push(cur);
    return hands.sort((a, b) => b.timestamp - a.timestamp);
  }, [logs]);

  const formatRank = (rank) => {
    if (!rank || rank === "null") return "";
    return rank.toUpperCase().replace(/\(NATURAL\)/g, "🍀").replace(/\(JOKER\)/g, "🃏");
  };

  useEffect(() => {
    socket.on('roomUpdate', d => {
        setPlayers(d.players); setPhase(d.phase); setCommunity(d.community || []);
        setActiveIdx(d.activeIdx); setDealerIdx(d.dealerIdx); setPotAmount(d.potAmount); setHighestBet(d.highestBet);
        if (d.activeVariant) setActiveVariant(VARIANTS[d.activeVariant.id] || VARIANTS.HOLDEM);
    });
    socket.on('initialDataResponse', d => { setAllProfiles(d.profiles); setActiveTables(d.rooms); });
    socket.on('profilesUpdate', setAllProfiles);
    socket.on('lobbyUpdate', setActiveTables);
    socket.on('log', l => setLogs(prev => [l, ...prev].slice(0, 200)));
    socket.on('loginSuccess', p => { setUserProfile(p); setCurrentView(VIEWS.LOBBY); socket.emit('getInitialData'); });
    return () => { socket.off('roomUpdate'); socket.off('initialDataResponse'); socket.off('log'); socket.off('loginSuccess'); };
  }, []);

  const ActivityFeedContent = () => (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
        <div className="flex items-center justify-between text-indigo-400 text-[10px] mb-4 border-b border-indigo-500/20 pb-2 font-black tracking-[0.2em] uppercase">
            <div className="flex items-center gap-2"><Terminal size={14}/> Activity Log</div>
            <button onClick={copyActivityToClipboard} className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1 transition-all"><Copy size={10} /> Export</button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 font-black">
            {handHistory.map(hand => (
                <div key={hand.id} className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
                    <button onClick={() => { const n = new Set(expandedHands); if(n.has(hand.id)) n.delete(hand.id); else n.add(hand.id); setExpandedHands(n); }} className="w-full p-3 flex flex-col text-left transition-all hover:bg-white/5">
                        <div className="flex justify-between w-full uppercase"><span className="text-[9px] text-indigo-400 tracking-widest">{hand.variant} HAND</span><ChevronRightIcon size={12} className={expandedHands.has(hand.id) ? 'rotate-90' : ''} /></div>
                        <div className="text-[11px] text-white/90 uppercase">{hand.winner ? <><span className={getNeonNameColor(hand.winner)}>{hand.winner}</span> WON ${hand.amount}</> : <span className="text-white/40 italic">In Progress...</span>}</div>
                    </button>
                    {expandedHands.has(hand.id) && (
                        <div className="px-3 pb-3 border-t border-white/5 bg-black/20 space-y-1 pt-2">
                            {hand.events.map((ev, i) => (<div key={i} className={`text-[9px] border-l-2 pl-2 ${ev.type==='win'?'border-emerald-500':ev.type==='fold'?'border-red-500':'border-indigo-500/30'}`}><span className={getNeonNameColor(ev.name)}>{ev.name}</span>: <span className="text-white/80 uppercase">{ev.action}</span></div>))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white font-black uppercase">
        <div className="w-full max-w-[400px] p-12 bg-black/60 border border-white/10 rounded-3xl flex flex-col items-center gap-8 shadow-2xl">
            <Lock size={32} className="text-[#fbbf24] animate-pulse" />
            <input type="password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center text-xl outline-none focus:bg-white/10 transition-all"/>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl font-black text-lg hover:scale-105 transition-transform">SIT AT TABLE</button>
            <span className="text-white/20 text-[10px] tracking-widest">{VERSION}</span>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white uppercase font-black overflow-hidden pt-[env(safe-area-inset-top)]">
        <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-8 flex flex-col gap-4 bg-black/20">
            <h2 className="text-[#fbbf24] flex items-center gap-2 mb-4"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`p-3 rounded-xl ${adminTab===ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`p-3 rounded-xl ${adminTab===ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>TABLES</button>
            <button onClick={()=>{ if(!nuclearConfirm){ setNuclearConfirm(true); setTimeout(()=>setNuclearConfirm(false),3000); return; } socket.emit('adminNuclearReset'); setNuclearConfirm(false); }} className={`p-3 rounded-xl border-2 transition-all ${nuclearConfirm ? 'bg-red-600 border-white text-white' : 'bg-white/5 text-red-500 border-red-500/20'}`}><Bomb size={14}/> {nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</button>
            <button onClick={()=>setCurrentView(VIEWS.LOBBY)} className="p-3 rounded-xl bg-cyan-600 text-black">BACK TO LOBBY</button>
        </aside>
        <main className="flex-1 p-12 overflow-y-auto">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8">
                    <h3 className="text-xl border-l-4 border-[#fbbf24] pl-4">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white"/>
                        <button onClick={() => { socket.emit('adminCreatePlayer', { ...newPlayer, uid: 'u_' + Date.now() }); setNewPlayer({ name: '', chips: 10000, password: '' }); }} className="bg-[#fbbf24] text-black rounded-xl p-3 font-black">CREATE PLAYER</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                        {allProfiles.map(p => (
                            <div key={p.uid} className="flex justify-between p-4 border-b border-white/5 items-center hover:bg-white/5">
                                <span className="font-black">{p.name}</span>
                                <div className="flex gap-4 items-center">
                                    <span className="text-emerald-400 font-mono">${Number(p.chips).toLocaleString()}</span>
                                    <button onClick={()=>{const n = prompt("NEW WALLET", p.chips); if(n!==null) socket.emit('adminUpdatePlayer', {uid: p.uid, chips: n})}} className="text-cyan-400"><Edit3 size={16}/></button>
                                    <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    <h3 className="text-xl border-l-4 border-emerald-500 pl-4">ARENA CONTROL</h3>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 border border-white/10">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white"/>
                        <div className="flex gap-2">
                            <input type="number" value={newTable.sb} onChange={e=>setNewTable({...newTable, sb: e.target.value})} placeholder="SB" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white w-1/2"/>
                            <input type="number" value={newTable.bb} onChange={e=>setNewTable({...newTable, bb: e.target.value})} placeholder="BB" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none text-white w-1/2"/>
                        </div>
                        <button onClick={() => { socket.emit('adminCreateRoom', { ...newTable, id: 'room_' + Date.now() }); setNewTable({ name: '', sb: 1, bb: 2, minBuy: 50, maxBuy: 100 }); }} className="bg-emerald-600 text-white rounded-xl p-3 font-black md:col-span-2">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {activeTables.map(t => (
                            <div key={t.id} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10">
                              <div><h4 className="text-[#fbbf24] font-black">{t.name}</h4><p className="text-[10px] text-white/40 tracking-widest">${t.sb}/${t.bb}</p></div>
                              <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 px-3 py-2 rounded-xl text-red-500 text-xs">TERMINATE</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#000] flex flex-col text-white font-black uppercase overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6">
              <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-emerald-500/30 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.2)] flex flex-col gap-10">
                <h3 className="text-3xl text-center text-emerald-400 font-black">{selectedTableForJoin.name}</h3>
                <div className="space-y-4 font-black text-center uppercase">
                  <div className="flex justify-between items-center text-[10px] text-white/40 tracking-[0.2em]"><span>SEATING AMOUNT</span><span className="text-emerald-400 text-2xl font-mono">${Math.min(buyInAmount, userProfile?.chips || 0).toLocaleString()}</span></div>
                  <input type="range" min={selectedTableForJoin.minBuy || 5} max={Math.min(selectedTableForJoin.maxBuy || 10, userProfile?.chips || 10000)} step={1} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                </div>
                <div className="flex gap-4"><button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-4 bg-white/5 border border-white/10 rounded-xl font-black text-xs uppercase">CANCEL</button><button onClick={() => { socket.emit('joinRoom', { roomId: selectedTableForJoin.id, profile: userProfile, buyIn: buyInAmount }, (res) => { if(res.status==='ok'){ setCurrentRoomId(selectedTableForJoin.id); setCurrentView(VIEWS.GAME); } }); }} className="flex-2 p-4 bg-emerald-600 rounded-xl shadow-lg text-xs font-black">CONFIRM SEAT</button></div>
              </div>
            </div>
        )}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-12 bg-black/60 shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="flex flex-col"><h2 className="tracking-[0.5em] text-lg font-black flex items-center gap-3"><LayoutGrid className="text-emerald-400 w-5"/> ARENA DIRECTORY</h2><span className="text-[8px] text-white/30 tracking-[0.2em]">VERSION {VERSION}</span></div>
          <div className="flex items-center gap-6 font-black">
            <div className="flex items-end flex-col"><span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">{userProfile?.name}</span><span className="text-emerald-400 font-mono text-2xl tracking-tighter leading-none">${Number(userProfile?.chips || 0).toLocaleString()}</span></div>
            <button onClick={handleForceSync} className="text-white/20 hover:text-emerald-400 transition-all"><RefreshCcw size={20} className="active:animate-spin" /></button>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={20}/></button>
          </div>
        </header>
        <main className="flex-1 p-12 overflow-y-auto floor-executive-parquet font-black uppercase text-center">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {activeTables.map((t) => (
                    <div key={t.id} className="group relative bg-slate-900/40 border border-white/5 rounded-3xl flex flex-col p-8 shadow-2xl transition-all hover:border-emerald-500/30 hover:bg-slate-900/60 font-black overflow-hidden text-left">
                      <h3 className="text-3xl text-white font-black tracking-tight mb-4 uppercase truncate">{t.name}</h3>
                      <div className="flex flex-col gap-4 mb-6">
                        <div className="flex justify-between items-end border-b border-white/5 pb-2"><div className="flex flex-col"><span className="text-[8px] text-white/30 tracking-widest">STAKES</span><span className="text-emerald-400 text-2xl font-mono leading-none">${t.sb}/${t.bb}</span></div><div className="flex flex-col items-end"><span className="text-[8px] text-white/30 tracking-widest">BUY-IN</span><span className="text-white/80 text-lg font-mono leading-none">${t.minBuy}-${t.maxBuy}</span></div></div>
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] text-white/30 tracking-widest flex items-center gap-1.5 uppercase"><Users size={10} /> Seated Players ({(t.players || []).filter(p=>p).length}/10)</span>
                          <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-black/40 rounded-xl border border-white/5">{(t.players || []).filter(p=>p).map((p, idx) => (<span key={idx} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[8px] text-white/80 font-black flex items-center gap-1">{p.isBot && <Bot size={8} className="text-indigo-400" />}{p.name.toUpperCase()}</span>))}</div>
                        </div>
                      </div>
                      <button onClick={()=>{ setSelectedTableForJoin(t); setBuyInAmount(t.maxBuy); }} className="w-full py-6 bg-emerald-600 rounded-2xl text-xs font-black shadow-lg transition-all active:scale-95 group-hover:bg-emerald-500">JOIN ARENA <ChevronRight size={14}/></button>
                    </div>
                ))}
            </div>
        </main>
    </div>
  );

  return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#1c1917] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter select-none">
      <svg style={{ visibility: 'hidden', position: 'absolute', width: 0, height: 0 }}><filter id="fire-hi-res"><feTurbulence type="fractalNoise" baseFrequency="0.05 0.2" numOctaves="3" seed={noiseSeed} result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" /></filter></svg>
      {intelExpanded && (
        <div className={`fixed bottom-[320px] left-4 w-[85vw] md:w-96 bg-black/40 border border-indigo-500/30 rounded-2xl backdrop-blur-md z-[150] shadow-[0_0_50px_rgba(0,0,0,0.4)] animate-in slide-in-from-left duration-300 flex flex-col h-[40vh] max-h-[450px] ${!isMobile ? 'hidden' : ''}`}><ActivityFeedContent /></div>
      )}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {intelExpanded && !isMobile && (<aside className="w-80 bg-black/40 border-r border-white/5 hidden lg:flex flex-col animate-in slide-in-from-left duration-300"><ActivityFeedContent /></aside>)}
        <main className="flex-1 flex flex-col items-center justify-center relative floor-executive-parquet overflow-hidden font-black uppercase text-center">
            {heroPlayerObj && !heroPlayerObj.isFolded && phase !== PHASES.IDLE && (
              <><div className="absolute top-6 left-6 z-[90] flex flex-col items-start pointer-events-none"><span className="text-[8px] md:text-[10px] text-white/30 tracking-[0.3em] font-normal mb-1">LOW STRENGTH</span><span className="text-white text-[14px] lg:text-[2.5vh] font-normal tracking-tighter">{(phase === PHASES.PRE_FLOP || !heroPlayerObj?.lowStrength || String(heroPlayerObj?.lowStrength) === "null") ? "-" : formatRank(String(heroPlayerObj?.lowStrength))}</span><span className="text-white text-[11px] lg:text-[1.5vh] font-normal mt-1">{Math.round(heroPlayerObj?.lowWinProbability || 0)}% WIN PROB</span></div><div className="absolute top-6 right-6 z-[90] flex flex-col items-end pointer-events-none"><span className="text-[8px] md:text-[10px] text-white/30 tracking-[0.3em] font-normal mb-1">STRENGTH</span><span className="text-white text-[14px] lg:text-[2.5vh] font-normal tracking-tighter">{(phase === PHASES.PRE_FLOP || !heroPlayerObj?.strength || String(heroPlayerObj?.strength) === "null") ? "-" : formatRank(String(heroPlayerObj?.strength))}</span><span className="text-white text-[11px] lg:text-[1.5vh] font-normal mt-1">{Math.round(heroPlayerObj?.winProbability || 0)}% WIN PROB</span></div></>
            )}
            <div style={{ transform: isMobile ? `scale(${visuals.tableZoom})` : `scale(${Math.min(visuals.tableZoom, 1.2)})` }} className="relative w-full max-w-[1400px] aspect-[15/10] lg:aspect-[16/9] flex items-center justify-center h-full origin-center">
                <div className="absolute inset-[-20px] rounded-[50%] z-0"><div className="absolute inset-[-10px] rounded-[50%] blur-[30px] opacity-80 animate-pulse scale-105" style={{ background: activeVariant?.id === 'REDSBLACKS' ? 'conic-gradient(#ff0000 0deg 120deg, #000 120deg 180deg, #ff0000 180deg 300deg, #000 300deg 360deg)' : activeVariant?.id === 'HILOW' ? `linear-gradient(to right, ${VARIANT_COLORS.HILOW}, ${HILOW_SECONDARY_COLOR})` : VARIANT_COLORS[activeVariant?.id || 'HOLDEM'] || '#1e293b' }} /><div className="absolute inset-0 rounded-[50%] border-[24px] border-[#0a0a0a] shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_2px_10px_rgba(255,255,255,0.1)]" /></div>
                <div className="absolute inset-0 rounded-[50%] border-[40px] border-[#1a110a] shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] z-0 bg-[#2b1d12]" /><div className={`absolute inset-[35px] rounded-[50%] transition-all duration-700 overflow-hidden ${activeVariant?.id === 'MUFLIS' ? 'animate-muflis-glow' : ''} ${activeVariant?.id === 'OMAHA' ? 'animate-omaha-swirl' : ''}`} style={{ backgroundColor: TABLE_FELT_COLOR, backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 75%)`, boxShadow: `inset 0 0 100px rgba(0,0,0,0.6)` }}><div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} /></div><div className="absolute inset-[15%] rounded-[50%] border border-white/10 pointer-events-none z-10" />
                <button onClick={handleForceSync} className="absolute bottom-6 right-6 z-[150] bg-black/60 border border-white/20 p-3 rounded-full text-white/40 hover:text-white transition-all shadow-xl active:scale-95 group pointer-events-auto"><RefreshCcw size={20} className="group-active:animate-spin" /></button>
                <div className="absolute inset-0 pointer-events-none z-20">{players.map((p, i) => <Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[i]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} visuals={visuals} bigBlind={bigBlind} showdownWinners={showdownWinners} formatRank={formatRank} />)}</div>
                <div className="absolute top-[calc(48%-50px)] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full">{!potTransferring && (
                    <div className="flex flex-col items-center mb-3 transition-all">
                      <span className="text-white/20 text-[10px] tracking-[0.5em] mb-1 uppercase font-bold">Total Pot:</span>
                      <div className="text-[6vw] lg:text-[6vh] font-black text-white font-mono tracking-tighter celestial-pot-glow">${Number(totalDisplayPot || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                  )}{community.length > 0 && (<div className="flex gap-2 md:gap-4 mt-4 transition-transform" style={{ transform: isMobile ? `scale(${visuals.commCardScale})` : `scale(${visuals.commCardScale * 0.8})` }}>{community.map((c, j) => { const isRed = c.suit === '♥' || c.suit === '♦'; return (<div key={j} className={`w-[8vw] lg:w-[6vh] h-[11vw] lg:h-[9vh] rounded-xl border-2 bg-white flex flex-col items-start justify-start p-1.5 text-black font-black transition-all duration-500 ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 shadow-[0_0_30px_#fbbf24]' : 'border-white/10'}`}><span className={`text-[12px] lg:text-[1.6vh] font-black leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{c.value}</span><span className={`text-[14px] lg:text-[2.2vh] font-black leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{c.suit}</span></div>); })}</div>)}</div>
                {activeIdx === heroIdx && heroPlayerObj && phase !== PHASES.IDLE && (<div className="absolute right-4 md:right-[20px] top-[15%] bottom-[15%] w-16 md:w-20 flex flex-col items-center justify-end z-[250] pointer-events-auto"><div className="flex-1 w-full relative flex items-center justify-center py-4"><input type="range" min={Math.min(minRaiseAmount || (highestBet + bigBlind), Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet))} max={Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet)} step={1} value={raiseInput} onChange={(e) => setRaiseInput(Number(e.target.value))} className="vertical-range appearance-none bg-white/10 w-8 md:w-10 h-full rounded-full accent-emerald-500 cursor-pointer" style={{ WebkitAppearance: 'slider-vertical', writingMode: 'bt-lr' }} /></div><div className="mt-4 bg-black/95 border-2 border-emerald-400 px-3 py-2 rounded-xl animate-in zoom-in duration-300 flex flex-col items-center min-w-[110px]"><span className="text-[8px] text-white/40 tracking-widest mb-1 font-bold uppercase text-center">Raise To</span><div className="flex items-center justify-center w-full"><span className="text-emerald-500 font-mono text-lg md:text-2xl mr-0.5">$</span><input type="number" value={raiseInput} onChange={(e) => setRaiseInput(Math.max(0, Number(e.target.value)))} className="bg-transparent text-emerald-400 font-mono text-xl md:text-3xl font-black text-center outline-none w-full" /></div></div></div>)}
            </div>
        </main>
      </div>
      <header className="bg-black/90 border-t border-white/10 flex items-center justify-between px-4 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black h-[50px] md:h-[60px]"><div className="flex-1 flex items-center"><button onClick={()=>setShowRulesModal(true)} style={{ backgroundColor: VARIANT_COLORS[activeVariant?.id || 'HOLDEM'] || '#1e293b' }} className={`border px-3 py-1 rounded-lg flex flex-col min-w-[120px] transition-all duration-500 relative group active:scale-95 shadow-lg ${handAttention ? 'animate-hand-trigger border-white' : 'border-black/20'}`}><span style={{ color: getContrastColor(VARIANT_COLORS[activeVariant?.id || 'HOLDEM']) }} className="text-[8px] tracking-widest leading-none mb-0.5 uppercase font-black flex items-center gap-1 opacity-70">This Hand: <HelpCircle size={8}/></span><span style={{ color: getContrastColor(VARIANT_COLORS[activeVariant?.id || 'HOLDEM']) }} className="text-xs md:text-sm font-black truncate drop-shadow-sm">{activeVariant?.name}</span></button></div><div className="flex-1 flex items-center justify-center gap-2 md:gap-4"><button onClick={() => setIntelExpanded(!intelExpanded)} className={`${intelExpanded ? 'text-white bg-indigo-600 border-indigo-400' : 'text-indigo-400 bg-white/5 border-white/10'} p-1.5 border rounded-lg transition-all shadow-lg active:scale-95`} title="Activity Log"><Eye size={16}/></button><button onClick={() => setShowVisualControls(!showVisualControls)} className={`${showVisualControls ? 'text-white bg-cyan-600 border-cyan-400' : 'text-cyan-400 bg-white/5 border-white/10'} p-1.5 border rounded-lg transition-all shadow-lg active:scale-95`} title="Settings"><Settings size={16}/></button><button onClick={() => {socket.emit('leaveRoom', { uid: userProfile.uid }); setCurrentView(VIEWS.LOBBY);}} className="text-red-500 p-1.5 bg-white/5 border border-white/10 rounded-lg shadow-lg active:scale-95 hover:bg-red-500/10 transition-all" title="Exit Arena"><LogOut size={16}/></button></div><div className="flex-1 flex items-center justify-end"><div style={{ backgroundColor: VARIANT_COLORS[pendingVariantId] || '#0f172a' }} className={`border px-3 py-1 rounded-lg flex flex-col min-w-[120px] relative transition-all duration-300 group ${dealAttention ? 'animate-deal-trigger border-white' : 'border-white/10'}`}><span style={{ color: getContrastColor(VARIANT_COLORS[pendingVariantId]) }} className="text-[8px] tracking-widest leading-none mb-0.5 uppercase font-bold opacity-70">On My Deal:</span><div className="flex items-center"><select value={pendingVariantId} style={{ color: getContrastColor(VARIANT_COLORS[pendingVariantId]) }} onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value}); }} className="bg-transparent text-[10px] md:text-xs outline-none font-black appearance-none cursor-pointer z-10 w-full">{Object.entries(VARIANTS).map(([k,v]) => (<option key={k} value={k} className="bg-slate-900 text-white">{v.name}</option>))}</select><ChevronDown size={12} style={{ color: getContrastColor(VARIANT_COLORS[pendingVariantId]) }} className="opacity-50 pointer-events-none ml-1" /></div></div></div></header>
      <footer style={{ height: `calc(${visuals.footerHeight}px + env(safe-area-inset-bottom))` }} className="bg-black border-t border-white/20 flex flex-col z-[100] shrink-0 pb-[env(safe-area-inset-bottom)]"><div className="flex-1 flex flex-col items-center justify-start px-4 relative pt-6">{phase === PHASES.SHOWDOWN && showdownWinners && showdownWinners.length > 0 ? (() => { const winner = showdownWinners[currentShowdownIdx]; if (!winner) return null; const isHiLo = activeVariant?.id === 'HILOW'; const isLowWin = String(winner.rank).includes("LOW:"); const isMuckWin = winner.rank === "!"; const themeColor = isLowWin ? "text-emerald-400" : (isHiLo ? "text-amber-400" : "text-white"); const cardBorder = isLowWin ? "border-emerald-400/50" : (isHiLo ? "border-amber-400/50" : "border-white/20"); return (<div key={currentShowdownIdx} className="flex flex-col items-center justify-start w-full gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500"><div className={`flex items-center gap-3 bg-white/5 px-5 py-1 rounded-full border border-white/10 max-w-full shadow-2xl`}><Trophy size={14} className={themeColor + " animate-bounce shrink-0"} /><div className="text-sm md:text-xl font-black tracking-tighter flex items-center gap-2 leading-none whitespace-nowrap"><span className={getNeonNameColor(winner.name)}>{winner.name.toUpperCase()}</span>{isMuckWin ? (<span className="text-white ml-2">SCOOPED THE POT</span>) : (<><span className="text-white/40">WON TOTAL</span><span className="text-emerald-400 font-mono ml-2">+${Number(winner.amount).toLocaleString()}</span></>)}</div></div>{!isMuckWin && (<><div className="text-[10px] md:text-sm font-normal text-white/60 tracking-widest uppercase">HOLDING <span className="text-white">{formatRank(winner.rank)}</span></div><div className="flex gap-1 justify-center mt-1">{winner.hand?.map((c, ci) => (
                                <div key={ci} className={`w-10 md:w-16 h-13 md:h-20 bg-white rounded flex flex-col items-start justify-start p-1 text-black shadow-2xl border-t-2 border-x-2 ${cardBorder} relative overflow-hidden`}>
                                  <span className={`text-[11px] md:text-sm font-black leading-tight ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{c.value}</span>
                                  <span className={`text-[13px] md:text-xl leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{c.suit}</span>
                                  <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-black/40 to-transparent" />
                                </div>
                              ))}</div></>)}</div>); })() : (<div className={`flex flex-col gap-4 items-center w-full`}>{heroPlayerObj && heroPlayerObj.chips < bigBlind && (phase === PHASES.IDLE || phase === PHASES.SHOWDOWN || heroPlayerObj.isFolded) ? (<div className="flex flex-row items-center justify-between w-full max-w-[420px] p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl lg:flex-col lg:bg-transparent lg:border-0 lg:p-0 lg:gap-4 lg:py-6 my-2 lg:my-0"><div className="flex flex-col items-start lg:items-center gap-0.5"><span className="text-white/40 tracking-wider text-[10px] font-black italic uppercase">Broke in Arena</span><span className="text-indigo-400 text-[12px] font-black font-mono">Wallet: ${userProfile?.chips.toLocaleString()}</span></div><button onClick={()=>{ setRebuyAmount(100); setShowRebuyModal(true); }} className="px-5 py-3 bg-indigo-600 border border-indigo-400 rounded-xl font-black text-xs hover:scale-105 transition-transform flex items-center gap-2 uppercase shrink-0"><Coins size={16}/> Re-buy</button></div>) : heroPlayerObj && phase !== PHASES.IDLE ? (<><div className="flex gap-2 w-full max-w-[600px] font-black text-center uppercase"><button onClick={() => handleAction('RAISE', highestBet + Math.floor(totalDisplayPot * 0.5))} className="flex-1 h-9 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10">1/2 POT</button><button onClick={() => handleAction('RAISE', highestBet + totalDisplayPot)} className="flex-1 h-9 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black hover:bg-white/10">POT</button><button onClick={handleAllIn} className="flex-1 h-9 bg-red-900/30 border border-red-500/50 rounded-xl text-[10px] text-red-500 font-black">ALL-IN</button></div><div className="flex flex-row gap-2 w-full max-w-[800px] items-stretch justify-center font-black h-14"><button onClick={() => handleAction('FOLD')} className={`flex-1 bg-red-950/60 border rounded-xl text-lg font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${activeIdx === heroIdx ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'border-red-500/20 opacity-60'}`}>FOLD</button><button onClick={() => handleAction('CALL')} className={`flex-1 bg-white/10 border rounded-xl text-xl font-black truncate px-2 flex items-center justify-center gap-2 transition-all ${activeIdx === heroIdx ? 'border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'border-white/5 opacity-60'}`}>{highestBet > (heroPlayerObj?.currentBet || 0) + 0.005 ? `CALL $${(highestBet - (heroPlayerObj?.currentBet || 0)).toLocaleString()}` : 'CHECK'}</button><div className={`flex-[1.5] flex bg-black/40 border border-white/10 rounded-xl transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale cursor-default' : ''}`}><button onClick={()=> handleAction('RAISE', raiseInput)} className="flex-1 bg-emerald-600 border border-emerald-400 rounded-lg flex items-center justify-center font-black text-lg uppercase active:scale-95"><Zap size={20} className="mr-1"/> RAISE</button></div></div></>) : (<div className="flex flex-col items-center gap-1 py-10"><span className="text-white/10 tracking-[0.8em] text-sm font-black italic animate-pulse">ARENA OBSERVATION</span></div>)}</div>)}</div></footer>
      {showVisualControls && (<div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={() => setShowVisualControls(false)}><div className="w-full max-w-[400px] bg-black/60 border border-white/20 rounded-3xl p-8 flex flex-col gap-6" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center border-b border-white/10 pb-4"><h3 className="text-lg text-cyan-400 font-black flex items-center gap-2 uppercase"><Settings2 size={20}/> Configuration</h3><X size={24} className="cursor-pointer text-white/40 hover:text-white" onClick={() => setShowVisualControls(false)}/></div><div className="space-y-6"><button onClick={() => socket.emit('adminAddBot', { roomId: activeTables[0]?.id })} className="w-full py-4 bg-white/5 border border-white/10 text-white font-black rounded-xl uppercase flex items-center justify-center gap-2 hover:bg-white/10 transition-all"><Bot size={18}/> Add Arena Bot</button><div className="flex flex-col gap-4 pt-4 border-t border-white/5"><div className="flex flex-col gap-2"><label className="text-[10px] text-white/60 uppercase tracking-widest font-black flex justify-between">Table Zoom <span>{Math.round(visuals.tableZoom * 100)}%</span></label><input type="range" min="0.3" max="1.5" step="0.05" value={visuals.tableZoom} onChange={(e) => setVisuals({...visuals, tableZoom: Number(e.target.value)})} className="accent-cyan-400 cursor-pointer" /></div><div className="flex flex-col gap-2"><label className="text-[10px] text-white/60 uppercase tracking-widest font-black flex justify-between">HUD Action Height <span>{visuals.footerHeight}px</span></label><input type="range" min="150" max="350" step="10" value={visuals.footerHeight} onChange={(e) => setVisuals({...visuals, footerHeight: Number(e.target.value)})} className="accent-indigo-400 cursor-pointer" /></div><div className="flex flex-col gap-2"><label className="text-[10px] text-white/60 uppercase tracking-widest font-black flex justify-between">Hero Card Scale <span>{visuals.heroCardScale.toFixed(2)}</span></label><input type="range" min="1.0" max="15.0" step="0.01" value={visuals.heroCardScale} onChange={(e) => setVisuals({...visuals, heroCardScale: Number(e.target.value)})} className="accent-cyan-400 cursor-pointer" /></div><div className="flex flex-col gap-2"><label className="text-[10px] text-white/60 uppercase tracking-widest font-black flex justify-between">Hero Card Y Offset <span>{visuals.heroCardY}px</span></label><input type="range" min="-300" max="300" step="1" value={visuals.heroCardY} onChange={(e) => setVisuals({...visuals, heroCardY: Number(e.target.value)})} className="accent-indigo-400 cursor-pointer" /></div><div className="flex flex-col gap-2"><label className="text-[10px] text-white/60 uppercase tracking-widest font-black flex justify-between">Hero Card Spread <span>{visuals.heroCardSpread.toFixed(2)}</span></label><input type="range" min="0.5" max="10.0" step="0.05" value={visuals.heroCardSpread} onChange={(e) => setVisuals({...visuals, heroCardSpread: Number(e.target.value)})} className="accent-cyan-400 cursor-pointer" /></div></div></div><button onClick={() => setShowVisualControls(false)} className="w-full py-4 bg-cyan-600 text-black font-black rounded-xl uppercase hover:brightness-110">Save & Apply</button></div></div>)}
      <style>{`.floor-executive-parquet { background-color: #292524; background-image: linear-gradient(90deg, transparent 50%, rgba(68, 64, 60, 0.5) 50%), linear-gradient(rgba(68, 64, 60, 0.5) 50%, transparent 50%); background-size: 100px 50px; box-shadow: inset 0 0 300px rgba(0,0,0,1); } .card-back-diamond { background-color: #991b1b; background-image: repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.1) 5px, rgba(0,0,0,0.1) 10px), repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0,0,0,0.1) 5px, rgba(0,0,0,0.1) 10px); } .celestial-pot-glow { text-shadow: 0 0 20px rgba(255,255,255,0.4); } @keyframes announcement-pop { 0% { transform: scale(0.5); opacity: 0; filter: blur(10px); } 30% { transform: scale(1.1); opacity: 1; filter: blur(0px); } 70% { transform: scale(1); opacity: 1; filter: blur(0px); } 100% { transform: scale(1.3); opacity: 0; filter: blur(20px); } } .animate-announcement-pop { animation: announcement-pop 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; } /* Unified Action Animation */ @keyframes action-status-in { 0% { opacity: 0; transform: translateY(10px) scale(0.9); filter: blur(4px); } 50% { opacity: 1; transform: translateY(-2px) scale(1.1); filter: blur(0px); } 100% { opacity: 1; transform: translateY(0) scale(1); } } .animate-action-status-in { animation: action-status-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }`}</style>
    </div>
  );
};

export default App;
