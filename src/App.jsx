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

// --- PRODUCTION SOCKET CONFIGURATION (With Local Dev Support) ---
const SOCKET_URL = window.location.hostname === 'localhost' || window.location.hostname === '0.0.0.0' 
    ? "http://localhost:10000" 
    : "https://poker-server-3vin.onrender.com"; 

const socket = io(SOCKET_URL, { transports: ['websocket'] });

const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES', LOGS: 'LOGS' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const DISPLAY_POSITIONS = [
  { x: 50, y: 96 }, { x: 18, y: 82 }, { x: 5,  y: 50 }, { x: 8,  y: 22 }, { x: 28, y: 8  },
  { x: 50, y: 4  }, { x: 72, y: 8  }, { x: 92, y: 22 }, { x: 95, y: 50 }, { x: 82, y: 82 }
];

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2 }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA', holeCards: 4 }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3 }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2 } 
};

const INITIAL_PLAYERS = Array.from({ length: TOTAL_SEATS }, () => null);

// --- PERFORMANCE OPTIMIZED HEADER (React.memo) ---
const AppHeader = React.memo(({ activeVariant, pendingVariantId, onVariantChange, walletBalance, onLogout }) => {
    const [version, setVersion] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setVersion('v1.0.9-Stable'), 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <header className="absolute top-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-[4px] border-b border-white/10 flex items-center justify-between px-8 z-[8000] shadow-xl">
            <div className="flex flex-col justify-center bg-white/5 px-6 py-2 rounded-2xl">
                <span className="text-[#fbbf24] font-black text-[10px] tracking-widest uppercase">THIS HAND:</span>
                <span className="text-white font-black text-lg uppercase leading-none mt-1">{activeVariant?.name || "Texas Hold'em"}</span>
            </div>
            
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 bg-emerald-600/10 border border-emerald-500/20 px-8 py-2 rounded-2xl">
                <Coins size={20} className="text-emerald-400" />
                <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black text-emerald-400/60 uppercase tracking-[0.3em]">Global Wallet</span>
                    <span className="text-xl font-mono font-black text-emerald-400 leading-none mt-1">${Number(walletBalance).toLocaleString()}</span>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-2 rounded-2xl text-white">
                    <span className="text-white/40 font-bold uppercase text-[9px] tracking-widest">On turn, deal:</span>
                    <select value={pendingVariantId} onChange={(e) => onVariantChange(e.target.value)} className="bg-transparent text-[#fbbf24] font-black text-sm uppercase outline-none cursor-pointer">
                        {Object.entries(VARIANTS).map(([k, v]) => <option key={k} value={k} className="bg-slate-900">{v.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest pt-1">{version}</span>
                    <button onClick={onLogout} className="p-2 hover:bg-red-600/20 rounded-lg text-red-500 shadow-md"><LogOut size={20}/></button>
                </div>
            </div>
        </header>
    );
}, (prev, next) => {
    return prev.walletBalance === next.walletBalance && 
           prev.activeVariant?.id === next.activeVariant?.id && 
           prev.pendingVariantId === next.pendingVariantId;
});

const Seat = ({ 
  player, displayPos, phase, winning5Ids, 
  isCollectingBets, isActiveTurn, strengthLabel, potTransferring, isHero, timeRemaining
}) => {
    if (!player || !player.hand || !displayPos) return null;
    const isShowdown = phase === PHASES.SHOWDOWN;

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col-reverse items-center z-20 transition-all duration-500 ${player?.isFolded ? 'opacity-20 grayscale scale-95' : 'opacity-100'}`}>
            <div className={`flex items-center gap-2 p-[0.6vw] px-[2vw] rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl relative transition-all ${isActiveTurn ? 'border-cyan-400 shadow-[0_0_1.5vw_#22d3ee] scale-105' : 'border-white/10'} ${player.isWinner && isShowdown ? (potTransferring ? 'border-yellow-400 scale-125' : 'border-yellow-400 scale-110 shadow-[0_0_2vw_#fbbf24]') : ''}`}>
                {isActiveTurn && timeRemaining > 0 && (
                    <div className={`absolute -right-12 flex items-center justify-center w-10 h-10 rounded-full border-2 bg-black/80 font-black text-sm z-50 ${timeRemaining <= 10 ? 'border-red-500 text-red-500 animate-pulse' : 'border-cyan-400 text-cyan-400'}`}>
                        {timeRemaining}
                    </div>
                )}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                        {player?.isDealer && <div className="w-[0.8vw] h-[0.8vw] bg-red-600 rounded-full animate-pulse" />}
                        <span className="text-[1.1vw] font-black text-white leading-none uppercase tracking-widest">{String(player?.name)}</span>
                    </div>
                    <span className={`text-[1.2vw] font-mono font-black mt-1.5 text-emerald-500/80`}>${Number(player?.chips || 0)}</span>
                </div>
            </div>

            {/* SNUG BET BUBBLES */}
            {player.currentBet > 0 && (
                <div className="absolute bg-gradient-to-b from-[#fbbf24] to-[#d97706] text-black font-black text-[1vw] px-[1.2vw] py-[0.3vw] rounded-full shadow-[0_0_20px_rgba(251,191,36,0.6)] border border-white/20 transition-all duration-[800ms] z-[250]"
                    style={{ 
                        top: isCollectingBets ? `${43 - displayPos.y}vh` : (isHero ? '-7.2vw' : (displayPos.y > 50 ? '-5vw' : '5vw')), 
                        left: isCollectingBets ? `${50 - displayPos.x}vw` : '50%',
                        transform: `translate(-50%, -100%) ${isCollectingBets ? 'scale(0.2)' : 'scale(1)'}`,
                        opacity: isCollectingBets ? 0 : 1
                    }}>
                    ${player.currentBet}
                </div>
            )}

            {player?.hand?.length > 0 && !player.isFolded && (
                <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mb-4 overflow-visible">
                    {(player.hand).map((c, ci) => {
                        const isWinningCard = isShowdown && player.isWinner && Array.isArray(winning5Ids) && winning5Ids.includes(c.id);
                        return (
                            <div key={ci} className={`w-[2.5vw] h-[3.5vw] rounded-[0.4vw] flex flex-col items-start justify-start p-[0.2vw] border shadow-lg absolute transition-all duration-300 ${isShowdown ? 'bg-white text-slate-950' : 'bg-gradient-to-br from-slate-700 to-black'} ${isWinningCard ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_#fbbf24] z-[100] border-white' : 'border-white/40'} ${isShowdown && !isWinningCard ? 'opacity-40 scale-90 grayscale' : ''}`} style={{ transform: `translateX(${(ci - (player.hand.length - 1) / 2) * 2.5}vw) rotate(${(ci - (player.hand.length - 1) / 2) * 10}deg) scale(1.5)`, transformOrigin: 'bottom center' }}>
                                {isShowdown ? ( <div className="flex flex-col items-start leading-none h-full w-full pl-0.5 pt-0.5"><span className="text-[0.8vw] font-black">{c.value}</span><span className={`text-[1.2vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-950'}`}>{c.suit}</span></div> ) : ( <div className="w-full h-full flex items-center justify-center opacity-40"><ShieldCheck size={12}/></div> )}
                            </div>
                        );
                    })}
                </div>
            )}
            
            {strengthLabel && !player.isFolded && phase !== PHASES.IDLE && (isHero || isShowdown) && (
                <div className="h-7 px-3 bg-purple-600 border border-purple-400 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)] mb-2 flex items-center animate-in fade-in"><span className="text-[9px] font-black uppercase text-white tracking-widest">{String(strengthLabel)}</span></div>
            )}
        </div>
    );
};

const App = () => {
  const [currentView, setCurrentView] = useState(VIEWS.LOGIN);
  const [adminTab, setAdminTab] = useState(ADMIN_TABS.PLAYERS);
  const [userProfile, setUserProfile] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [buyInAmount, setBuyInAmount] = useState(500);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [activeTables, setActiveTables] = useState([]);
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [winningPlayerIndices, setWinningPlayerIndices] = useState([]); 
  const [logs, setLogs] = useState([]);
  const [isCollectingBets, setIsCollectingBets] = useState(false);
  const [visiblePotAmount, setVisiblePotAmount] = useState(0);
  const [potTransferring, setPotTransferring] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 5000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 10, bb: 20, minBuy: 400, maxBuy: 2000 });

  useEffect(() => {
    socket.on('roomUpdate', (data) => {
        if (!data?.players) return;
        if (data.phase !== phase && phase !== PHASES.IDLE) {
            setIsCollectingBets(true);
            setTimeout(() => { setIsCollectingBets(false); setVisiblePotAmount(data.potData?.[0]?.amount || 0); }, 800);
        } else { setVisiblePotAmount(data.potData?.[0]?.amount || 0); }
        const nextPlayers = [...INITIAL_PLAYERS];
        data.players.forEach((p, i) => { if (p) nextPlayers[i] = p; });
        setPlayers(nextPlayers);
        setPhase(data.phase);
        setCommunity(data.community || []);
        setActiveVariant(data.activeVariant || VARIANTS.HOLDEM);
        setHighestBet(data.highestBet);
        setActiveIdx(data.activeIdx);
        setWinning5Ids(data.winning5Ids || []);
        setWinningPlayerIndices(data.winningPlayerIndices || []);
        setTimeRemaining(data.timeRemaining || 30);
        if (data.phase === PHASES.SHOWDOWN) { setPotTransferring(true); setTimeout(() => setPotTransferring(false), 4000); }
    });
    socket.on('profilesUpdate', (list) => {
        setAllProfiles(list);
        if (userProfile) {
            const updatedMe = list.find(p => p.uid === userProfile.uid);
            if (updatedMe) setUserProfile(updatedMe);
        }
    });
    socket.on('loginSuccess', (profile) => { setUserProfile(profile); setCurrentView(VIEWS.LOBBY); });
    socket.on('log', (data) => {
        const logEntry = { id: Math.random(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ...data };
        setLogs(prev => [logEntry, ...prev].slice(0, 50));
    });
    socket.on('lobbyUpdate', (list) => setActiveTables(list));

    return () => { socket.off('roomUpdate'); socket.off('profilesUpdate'); socket.off('log'); socket.off('lobbyUpdate'); };
  }, [phase, userProfile]);

  const heroSeatIdx = useMemo(() => userProfile ? players.findIndex(p => p && p.uid === userProfile.uid) : -1, [players, userProfile]);
  const userSeat = heroSeatIdx !== -1 ? players[heroSeatIdx] : null;
  const isShowdown = phase === PHASES.SHOWDOWN; // Defined in App scope
  const isHeroTurn = activeIdx !== -1 && heroSeatIdx !== -1 && activeIdx === heroSeatIdx && phase !== PHASES.IDLE && phase !== PHASES.SHOWDOWN;
  const callRequired = highestBet - (userSeat?.currentBet || 0);

  const getCurrentStrength = useCallback((p) => {
    if (!p || !p.hand || p.hand.length === 0 || community.length < 3) return null;
    const VM = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    const getCombos = (arr, k) => { const fn = (n, src, got, all) => { if (n === 0) { all.push(got); return; } for (let j = 0; j < src.length; j++) { fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all); } }; const all = []; fn(k, arr, [], all); return all; };
    const rankHand = (cards) => {
        const rks = cards.map(c => VM[c.value]).sort((a,b)=>b-a);
        const vc = Object.values(rks.reduce((a,c)=>{a[c]=(a[c]||0)+1;return a},{})).sort((a,b)=>b-a);
        const suits = cards.map(c => c.suit);
        const isF = new Set(suits).size === 1;
        let isS = true; for(let i=0;i<4;i++) if(rks[i]!==rks[i+1]+1) isS=false;
        if(!isS && JSON.stringify(rks)==="[14,5,4,3,2]") isS=true;
        if(isS && isF) return { p: 8, n: "Straight Flush" }; if(vc[0]===4) return { p: 7, n: "Four of a Kind" }; if(vc[0]===3 && vc[1]===2) return { p: 6, n: "Full House" }; if(isF) return { p: 5, n: "Flush" }; if(isS) return { p: 4, n: "Straight" }; if(vc[0]===3) return { p: 3, n: "Three of a Kind" }; if(vc[0]===2 && vc[1]===2) return { p: 2, n: "Two Pair" }; if(vc[0]===2) return { p: 1, n: "Pair" }; return { p: 0, n: "High Card" };
    };
    const combos = getCombos([...p.hand, ...community], 5);
    let best = { p: -1, n: "" };
    combos.forEach(c => { const res = rankHand(c); if (res.p > best.p) best = res; });
    return best.n;
  }, [community]);

  const handleLogin = () => {
    if (passwordInput === 'pass') setCurrentView(VIEWS.ADMIN);
    else socket.emit('playerLogin', { password: passwordInput });
  };

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center text-white font-sans">
        <div className="w-[30vw] min-w-[380px] p-12 rounded-[2vw] bg-black/60 border border-white/10 backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-10">
            <Lock size={32} className="text-[#fbbf24]" />
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (passwordInput === 'pass' ? setCurrentView(VIEWS.ADMIN) : socket.emit('playerLogin', { password: passwordInput }))} placeholder="ENTER CODE..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-center font-black text-[#fbbf24] outline-none uppercase tracking-widest"/>
            <button onClick={() => passwordInput === 'pass' ? setCurrentView(VIEWS.ADMIN) : socket.emit('playerLogin', { password: passwordInput })} className="w-full p-6 rounded-2xl bg-[#fbbf24] font-black uppercase text-black hover:scale-105 transition-all">Sit at Table</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex relative overflow-hidden text-white font-sans">
        <aside className="w-72 bg-[#0f172a] border-r border-white/10 flex flex-col z-[100]">
            <div className="p-8 border-b border-white/5 mb-8 text-[#fbbf24] flex items-center gap-3"><ShieldAlert size={20} /><span className="font-black uppercase tracking-widest text-sm">Super Admin</span></div>
            <nav className="flex-1 px-4 flex flex-col gap-2">
                <button onClick={() => setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase transition-all ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'text-white/40 hover:bg-white/5'}`}><Users size={18}/> Registry</button>
                <button onClick={() => setAdminTab(ADMIN_TABS.TABLES)} className={`flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase transition-all ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'text-white/40 hover:bg-white/5'}`}><Layers size={18}/> Control</button>
            </nav>
            <div className="p-8 mt-auto border-t border-white/5"><button onClick={() => setCurrentView(VIEWS.LOGIN)} className="flex items-center gap-4 text-white/40 hover:text-white font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> Logout</button></div>
        </aside>
        <main className="flex-1 flex flex-col p-12 overflow-y-auto relative z-10">
            {adminTab === ADMIN_TABS.PLAYERS && (<div className="flex flex-col gap-8 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-white/10 pb-6"><h2 className="text-2xl font-black uppercase tracking-widest text-white">Identity Registry</h2><button onClick={() => setIsAddingPlayer(true)} className="flex items-center gap-3 p-4 px-8 bg-[#fbbf24] text-black rounded-2xl font-black uppercase text-xs shadow-xl transition-all hover:scale-105 active:scale-95"><PlusCircle size={18}/> New Profile</button></div>
                <div className="bg-white/5 border border-white/10 rounded-[2vw] overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr className="text-[10px] font-black uppercase tracking-widest text-white/40"><th className="p-6">Identification</th><th className="p-6">Bankroll</th><th className="p-6 text-right">Utility</th></tr>
                        </thead>
                        <tbody>
                            {allProfiles?.map((p, i) => (<tr key={i} className="border-b border-white/5 transition-colors">
                                <td className="p-6 font-black uppercase text-sm">{String(p.name)} <span className="text-[8px] opacity-20 block">UID: {String(p.uid)}</span></td>
                                <td className="p-6 font-mono text-emerald-400 font-bold">${Number(p.chips || 0).toLocaleString()}</td>
                                <td className="p-6 text-right flex justify-end gap-2">
                                    <button onClick={() => { const amt = Number(prompt("New Balance:", p.chips)); if(!isNaN(amt)) socket.emit('adminEditChips', {uid: p.uid, chips: amt}); }} className="p-2 text-cyan-400 hover:bg-cyan-600/20 rounded-lg"><Edit3 size={14}/></button>
                                    <button onClick={() => socket.emit('adminDeletePlayer', p.uid)} className="p-2 text-red-500 hover:bg-red-600/20 rounded-lg"><Trash2 size={14}/></button>
                                </td>
                            </tr>))}
                        </tbody>
                    </table>
                </div>
            </div>)}

            {isAddingPlayer && (<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"><div className="w-[25vw] min-w-[320px] bg-slate-900 border border-white/10 rounded-[1.5vw] p-8 shadow-2xl flex flex-col gap-6 text-white"><h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-3"><UserPlus size={20} className="text-indigo-400"/> Provision Profile</h3><div className="flex flex-col gap-4 text-slate-950"><input value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="w-full bg-white p-4 rounded-xl text-xs font-black uppercase outline-none"/><input type="number" value={newPlayer.chips} onChange={e => setNewPlayer({...newPlayer, chips: Number(e.target.value)})} placeholder="CHIPS" className="w-full bg-white p-4 rounded-xl text-xs font-black outline-none"/><input value={newPlayer.password} onChange={e => setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASSCODE" className="w-full bg-white p-4 rounded-xl text-xs font-black outline-none"/></div><div className="flex gap-4"><button onClick={() => setIsAddingPlayer(false)} className="flex-1 p-4 rounded-xl bg-white/5 font-black uppercase text-[10px]">Cancel</button><button onClick={() => { const uid = Math.random().toString(36).substr(2, 9); socket.emit('adminCreatePlayer', {...newPlayer, uid, id: uid}, () => setIsAddingPlayer(false)); }} className="flex-2 p-4 rounded-xl bg-indigo-600 font-black uppercase text-[10px] tracking-widest">Confirm</button></div></div></div>)}

            {adminTab === ADMIN_TABS.TABLES && (
                <div className="flex flex-col gap-8 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-white/10 pb-6"><h2 className="text-2xl font-black uppercase tracking-widest text-white">Room Control</h2><button onClick={() => { if(window.confirm("HARD RESET ALL SERVER DATA?")) socket.emit('adminNuclearReset'); }} className="p-4 px-8 bg-red-600 border border-red-500 rounded-2xl font-black uppercase text-xs hover:bg-red-600 hover:text-white transition-all">Nuclear Reset</button></div>
                    <section className="bg-white/5 p-8 rounded-[2vw] border border-white/10 shadow-2xl flex flex-col gap-6 text-slate-950">
                        <h3 className="text-lg font-black uppercase text-[#fbbf24] flex items-center gap-3"><PlusCircle size={20}/> Deploy Arena Room</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input value={newTable.name} onChange={e => setNewTable({...newTable, name: e.target.value})} placeholder="ROOM NAME" className="bg-white p-4 rounded-xl text-xs font-black uppercase outline-none"/><div className="grid grid-cols-2 gap-2"><input type="number" value={newTable.sb} onChange={e => setNewTable({...newTable, sb: Number(e.target.value)})} placeholder="SB" className="bg-white p-4 rounded-xl text-xs font-black"/><input type="number" value={newTable.bb} onChange={e => setNewTable({...newTable, bb: Number(e.target.value)})} placeholder="BB" className="bg-white p-4 rounded-xl text-xs font-black"/></div><div className="grid grid-cols-2 gap-2"><input type="number" value={newTable.minBuy} onChange={e => setNewTable({...newTable, minBuy: Number(e.target.value)})} placeholder="MIN BUY" className="bg-white p-4 rounded-xl text-xs font-black"/><input type="number" value={newTable.maxBuy} onChange={e => setNewTable({...newTable, maxBuy: Number(e.target.value)})} placeholder="MAX BUY" className="bg-white p-4 rounded-xl text-xs font-black"/></div><button onClick={() => { socket.emit('adminCreateRoom', {...newTable, id: 'room_'+Math.random().toString(36).substr(2,9)}); setNewTable({name:'', sb:10, bb:20, minBuy:400, maxBuy:2000}); }} className="bg-emerald-600 rounded-xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] transition-all text-white">Spawn Arena</button></div>
                    </section>
                    <div className="grid grid-cols-2 gap-6">{activeTables?.map((t, i) => (<div key={i} className="p-8 bg-black/40 border border-white/10 rounded-2xl flex flex-col gap-6 shadow-xl relative group"><div className="flex justify-between items-center"><div className="text-xl font-black uppercase text-[#fbbf24]">{t.name}</div><div className="font-mono text-sm">${t.sb}/${t.bb}</div></div><div className="flex gap-4"><button onClick={() => socket.emit('adminForceDeal', t.id)} className="flex-1 p-3 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 rounded-xl font-black uppercase text-[10px] transition-all hover:bg-emerald-600 hover:text-white">Force Deal</button><button onClick={() => socket.emit('adminAddBot', t.id)} className="flex-1 p-3 bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 rounded-xl font-black uppercase text-[10px] transition-all hover:bg-indigo-600 hover:text-white flex items-center justify-center gap-2"><Bot size={14}/> Add Bot</button><button onClick={() => socket.emit('adminDeleteRoom', t.id)} className="flex-1 p-3 bg-red-600/10 border border-red-500/30 text-red-500 rounded-xl font-black uppercase text-[10px] transition-all hover:bg-red-600 hover:text-white">Terminate</button></div></div>))}</div>
                </div>
            )}
        </main>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div className="h-screen bg-[#06080c] flex flex-col text-white font-sans">
        {selectedTableForJoin && (<div className="absolute inset-0 z-[9000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in"><div className="w-[30vw] min-w-[360px] p-12 rounded-[2vw] bg-slate-900 border border-[#fbbf24]/30 shadow-2xl flex flex-col gap-10">
            <div className="text-center space-y-1"><span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#fbbf24]">Table Entrance</span><h3 className="text-3xl font-black uppercase tracking-widest text-white">{String(selectedTableForJoin.name)}</h3></div>
            <div className="space-y-6"><div className="flex justify-between font-black"><span className="text-white/40 uppercase text-[10px] tracking-widest">Entry Buy-In</span><span className="text-emerald-400 text-3xl font-mono">${Number(buyInAmount)}</span></div><input type="range" min={selectedTableForJoin.minBuy || 400} max={selectedTableForJoin.maxBuy || 2000} step="100" value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="gold-slider" /></div>
            <div className="flex gap-4"><button onClick={() => setSelectedTableForJoin(null)} className="flex-1 p-6 rounded-2xl bg-white/5 border border-white/10 font-black uppercase tracking-widest">Back</button><button onClick={() => { socket.emit('joinRoom', { roomId: selectedTableForJoin.id, profile: {...userProfile, pendingVariant: pendingVariantId}, buyIn: buyInAmount }, (res) => res?.status === 'ok' && setCurrentView(VIEWS.GAME)); setSelectedTableForJoin(null); }} className="flex-2 p-6 rounded-2xl bg-emerald-600 font-black uppercase shadow-xl hover:scale-105 active:scale-95 transition-all text-sm tracking-widest">Confirm Seat</button></div>
        </div></div>)}
        <header className="h-20 border-b border-white/10 bg-black/40 backdrop-blur-xl flex items-center justify-between px-12 z-50 shadow-xl"><div className="flex items-center gap-4"><LayoutGrid size={24} className="text-[#fbbf24]" /><h2 className="text-xl font-black uppercase tracking-[0.3em]">Arena Lobby</h2></div><div className="flex items-center gap-12"><div className="flex items-center gap-4 bg-white/5 border border-white/10 p-3 px-6 rounded-2xl shadow-inner"><div className="flex flex-col items-start"><span className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none">Identity</span><span className="text-sm font-black text-white uppercase mt-1">{String(userProfile?.name)}</span></div></div><button onClick={() => { setCurrentView(VIEWS.LOGIN); setUserProfile(null); }} className="p-3 hover:bg-red-600/10 rounded-xl text-white/40 hover:text-red-500 shadow-lg transition-all"><LogOut size={20}/></button></div></header>
        <main className="flex-1 p-20 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {activeTables?.map((t, i) => (<div key={i} className="p-10 rounded-[3vw] bg-white/5 border border-white/5 backdrop-blur-3xl flex flex-col gap-8 shadow-2xl hover:border-[#fbbf24]/30 transition-all group relative overflow-hidden"><div className="flex flex-col gap-1"><h3 className="text-2xl font-black uppercase tracking-[0.1em]">{String(t.name)}</h3><div className="text-[9px] text-white/40 uppercase mt-1 font-bold tracking-widest leading-none">Players: {[...new Set(t.players?.filter(Boolean).map(p => String(p.name)))].join(', ') || 'Empty'}</div></div><div className="flex justify-between items-center bg-black/60 p-6 rounded-2xl border border-white/5 shadow-inner"><div className="flex flex-col"><span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none mb-1">Stakes</span><span className="text-xl font-black text-[#fbbf24]">${t.sb} / ${t.bb}</span></div></div><button onClick={() => { setSelectedTableForJoin(t); setBuyInAmount(t.minBuy || 400); }} className="w-full p-8 rounded-3xl bg-emerald-600 border border-emerald-500/50 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-[0.3em] text-white">Join Arena</button></div>))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-sans">
      <AppHeader 
        activeVariant={activeVariant} 
        pendingVariantId={pendingVariantId} 
        onVariantChange={(vid) => { setPendingVariantId(vid); if(userProfile) socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: vid}); }}
        walletBalance={userProfile?.chips || 0}
        onLogout={() => { setCurrentView(VIEWS.LOBBY); setPlayers(INITIAL_PLAYERS); }}
      />

      <main className="flex-1 flex items-center justify-center relative min-h-screen">
        <div className="relative w-full max-w-[1600px] aspect-[21/10] mx-auto flex items-center justify-center -translate-y-[4vh] max-h-[70vh]">
            <div className="absolute inset-0 pointer-events-none z-20">
              {players.map((p, i) => {
                if (!p || (userProfile && p.uid === userProfile.uid)) return null;
                const relativeIdx = (i - heroSeatIdx + TOTAL_SEATS) % TOTAL_SEATS;
                return <Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[relativeIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} strengthLabel={getCurrentStrength(p)} isCollectingBets={isCollectingBets} potTransferring={potTransferring} isHero={false} timeRemaining={timeRemaining} />;
              })}
            </div>
            <div className="absolute inset-0 bg-emerald-950/5 rounded-[40%] border-[1.5vw] border-slate-900 shadow-[inset_0_0_15vw_rgba(0,0,0,0.9)]" />
            <div className={`absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center z-30 pointer-events-none`}>
              <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-[800ms] ease-out`} style={{ transform: `translate(-50%, -50%) ${potTransferring ? 'scale(0.2)' : 'scale(1)'}`, opacity: potTransferring ? 0 : 1, top: potTransferring ? `${winnerPos.y - 43}vh` : '-4vw', left: potTransferring ? `${winnerPos.x - 50}vw` : '50%' }}>
                <div className="text-[4vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-2xl">${Number(visiblePotAmount)}</div>
              </div>
              <div className="flex gap-2 scale-[1.7]">
                  {community.map((c, j) => (<div key={j} className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] border bg-white flex flex-col items-center justify-center text-slate-950 font-black shadow-lg transition-all duration-300 ${Array.isArray(winning5Ids) && winning5Ids.includes(c.id) ? 'ring-4 ring-yellow-400 z-[300]' : ''}`}><span className="text-[0.9vw]">{c.value}</span><span className={`text-[1.8vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span></div>))}
              </div>
            </div>
            
            <div style={{ left: '50%', top: '98%', transform: 'translate(-50%, -100%)' }} className="absolute flex flex-col items-center z-50">
              {userSeat?.currentBet > 0 && (
                <div className={`absolute bg-gradient-to-b from-[#fbbf24] to-[#d97706] text-black font-black text-[1vw] px-[1.2vw] py-[0.3vw] rounded-full shadow-[0_0_20px_rgba(251,191,36,0.6)] border border-white/20 transition-all duration-[800ms] z-[250]`}
                  style={{ top: isCollectingBets ? `${43 - 98}vh` : '-7.2vw', left: '50%', transform: `translate(-50%, 0%) ${isCollectingBets ? 'scale(0.2)' : 'scale(1)'}`, opacity: isCollectingBets ? 0 : 1 }}>
                  ${userSeat.currentBet}
                </div>
              )}
              <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mb-2 overflow-visible">
                  {userSeat && !userSeat.isFolded && phase !== PHASES.IDLE && (
                    <div className="relative flex items-center justify-center w-full h-full scale-[1.5]">
                      {userSeat.hand.map((c, ci) => (
                        <div key={ci} className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] border border-white/40 flex flex-col items-start p-[0.3vw] font-bold absolute bg-white text-slate-950 shadow-2xl transition-all duration-300 ${isWinnerHero && phase === PHASES.SHOWDOWN && Array.isArray(winning5Ids) && winning5Ids.includes(c.id) ? 'ring-4 ring-yellow-400 z-[200]' : (phase === PHASES.SHOWDOWN && !isWinnerHero ? 'opacity-40 grayscale scale-90' : '')}`} style={{ transform: `translateX(${(ci - (userSeat.hand.length-1)/2) * 2.5}vw) rotate(${(ci - (userSeat.hand.length-1)/2) * 10}deg)`, transformOrigin: 'bottom center' }}>
                            <span className="text-[1vw] font-black leading-none">{c.value}</span><span className={`text-[1.5vw] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
              {userSeat && !isShowdown && phase !== PHASES.IDLE && (<div className="z-[5001] h-7 px-3 py-1 bg-purple-600/95 border border-purple-300/30 rounded-full shadow-[0_0_2vw_rgba(147,51,234,0.6)] animate-in fade-in transition-all flex items-center relative -mt-3 mb-1"><span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">{String(getCurrentStrength(userSeat) || "Evaluating...")}</span></div>)}
              <div className={`flex items-center gap-[0.5vw] p-[0.6vw] px-[2.5vw] rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl transition-all duration-300 relative pointer-events-auto z-50 ${userSeat?.isWinner && isShowdown ? (potTransferring ? 'border-yellow-400 scale-125 shadow-[0_0_3vw_#fbbf24]' : 'border-yellow-400 scale-110 shadow-[0_0_2vw_#fbbf24]') : 'border-white/10'} ${activeIdx === heroSeatIdx ? 'border-cyan-400 shadow-[0_0_1.5vw_#22d3ee]' : ''}`}>
                {activeIdx === heroSeatIdx && timeRemaining > 0 && (
                    <div className={`absolute -right-12 flex items-center justify-center w-10 h-10 rounded-full border-2 bg-black/80 font-black text-sm z-50 transition-colors ${timeRemaining <= 10 ? 'border-red-500 text-red-500 animate-pulse' : 'border-cyan-400 text-cyan-400'}`}>{timeRemaining}</div>
                )}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">{userSeat?.isDealer && <div className="w-[0.8vw] h-[0.8vw] bg-red-600 rounded-full animate-pulse" />}<span className="text-[1.2vw] font-black text-white leading-none uppercase tracking-widest">{String(userSeat?.name)}</span></div><span className={`text-[1.3vw] font-mono font-black mt-1 text-emerald-500/80`}>${Number(userSeat?.chips || 0)}</span></div></div>
            </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-[200px] bg-black/40 backdrop-blur-3xl border-t border-white/10 z-[6000] flex">
        <div className="w-1/3 h-full border-r border-white/10 p-6 flex flex-col overflow-hidden text-white font-sans">
          <div className="text-slate-400 uppercase font-black text-[10px] tracking-widest mb-4 tracking-[0.2em] border-b border-white/10 pb-3"><Info size={18}/> INTELLIGENCE FEED</div>
          <div className="flex-1 font-mono text-[10px] space-y-1 overflow-y-auto scrollbar-hide flex flex-col">{logs.map((l, i) => (<div key={i}><span className="text-white/20">[{String(l.time)}]</span> <span className="text-[#fbbf24] uppercase">{String(l.name || "ARENA")}</span> <span className="text-white/60 ml-2">{String(l.action)}</span></div>))}</div>
        </div>
        <div className="flex-1 h-full bg-white/5 flex flex-col justify-between py-6 px-10 pointer-events-auto relative shadow-inner overflow-hidden text-white font-sans">
          {isHeroTurn ? (
            <div className="flex flex-col justify-between items-center w-full h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex gap-4 justify-center items-center w-full mt-0"><div className="flex gap-4"><button onClick={() => handleAction('RAISE', Math.min(userSeat.chips + userSeat.currentBet, Math.floor(visiblePotAmount * 0.5 + highestBet)))} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase text-slate-300 hover:brightness-125 transition-all flex items-center justify-center">1/2 POT</button><button onClick={() => handleAction('RAISE', Math.min(userSeat.chips + userSeat.currentBet, visiblePotAmount + highestBet))} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase text-[#fbbf24] hover:brightness-125 transition-all flex items-center justify-center">POT</button><button onClick={() => handleAction('RAISE', userSeat.chips + userSeat.currentBet)} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase text-red-500 hover:brightness-125 transition-all flex items-center justify-center">MAX</button></div></div>
              <div className="flex items-center justify-between gap-0 w-full px-4 flex-1"><div className="flex-1 flex items-center h-12 pr-4"><input type="range" min={highestBet + 20} max={userSeat.chips + userSeat.currentBet} step="10" value={raiseAmount} onChange={(e) => setRaiseAmount(Number(e.target.value))} className="gold-slider" /></div><div className="w-32 h-10 flex items-center bg-[#06080c] border border-white/10 rounded-lg px-3 shadow-inner"><span className="text-[#fbbf24] font-black mr-1 text-sm">$</span><input type="number" value={raiseAmount} onChange={(e) => setRaiseAmount(Math.max(0, Math.min(userSeat.chips + userSeat.currentBet, parseInt(e.target.value) || 0)))} className="bg-transparent border-none outline-none text-[#fbbf24] font-mono font-black w-full text-base" /></div></div>
              <div className="flex items-center justify-center gap-8 w-full mb-0"><button onClick={() => handleAction('FOLD')} className="w-32 h-12 bg-red-950/40 border border-red-500/50 rounded-full font-black text-sm uppercase hover:brightness-125 shadow-lg tracking-widest">FOLD</button><button onClick={() => handleAction('CALL')} className="w-48 h-12 bg-blue-950/40 border border-blue-500/50 rounded-full font-black text-base uppercase hover:brightness-125 shadow-lg tracking-widest">{callRequired > 0 ? `CALL $${callRequired}` : 'CHECK'}</button><button onClick={() => handleAction('RAISE', raiseAmount)} className="w-32 h-12 bg-emerald-950/40 border border-emerald-500/50 rounded-full font-black text-sm uppercase hover:brightness-125 shadow-xl transition-all tracking-widest flex items-center justify-center"><Zap size={20} className="mr-2"/>RAISE</button></div>
            </div>
          ) : (
            <div className="flex col flex-col items-center justify-center gap-4 h-full">
               <Target size={48} className={(phase === PHASES.IDLE && players.filter(Boolean).length >= 2) ? "text-[#22d3ee] animate-pulse" : "text-slate-600"}/>
               <span className={`font-black uppercase text-[#fbbf24] animate-pulse text-[1.5vw] tracking-[0.2em]`}>
                 {phase === PHASES.IDLE ? (players.filter(Boolean).length < 2 ? "WAITING FOR PLAYERS" : "DEALING") : (isShowdown ? "REVEAL" : activeIdx !== -1 && players[activeIdx] ? `${String(players[activeIdx].name).toUpperCase()}'S TURN` : "WAITING")}
               </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;
