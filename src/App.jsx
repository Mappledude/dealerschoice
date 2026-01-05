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

const VERSION = "v1.8.2-ULTRA";
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
                    style={{ transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y}px)`, left: '50%', top: '50%' }}>
                    <PotInspiredBet amount={player.currentBet} visuals={visuals} />
                </div>
            )}

            <div style={{ transform: `translateY(${visuals.badgeY}px) scale(${visuals.badgeScale || 1.0})` }}
                className={`relative z-50 flex flex-col items-center p-1.5 rounded-2xl border bg-slate-950/95 backdrop-blur-lg transition-all duration-300 min-w-[90px] md:min-w-[190px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] ${isActiveTurn ? 'border-cyan-400 ring-2 ring-cyan-400/40 scale-105 shadow-[0_0_100px_rgba(34,211,238,0.3)]' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 animate-pulse-glow' : ''}`}>
                {isDealer && ( <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white rounded-full border-2 border-slate-900 shadow-xl flex items-center justify-center text-slate-950 text-[8px] font-black z-[110]">D</div> )}
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
  const [loginError, setLoginError] = useState(null);
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dealerIdx, setDealerIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([{ id: 'init', time: new Date().toLocaleTimeString(), name: 'SYSTEM', action: 'SECURE LINK ESTABLISHED', type: 'phase' }]);
  const [potAmount, setPotAmount] = useState(0);
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState(10);
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [currentShowdownIdx, setCurrentShowdownIdx] = useState(0);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [showVisualControls, setShowVisualControls] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [expandedHands, setExpandedHands] = useState(new Set()); 
  const [isConnected, setIsConnected] = useState(false);
  
  const [pendingDeleteTableId, setPendingDeleteTableId] = useState(null);
  const [pendingDeletePlayerUid, setPendingDeletePlayerUid] = useState(null);

  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 100, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10 });

  const isMobile = window.innerWidth < 768;
  const [visuals, setVisuals] = useState({
    heroCardScale: 4.0, heroCardY: 22, oppCardScale: 1.0, oppCardY: -25,
    commCardScale: 1.8, commCardY: -7, betScale: 1.0, betY: 0,
    badgeY: 85, badgeScale: 1.0, potScale: 1.0, potY: 0,
    footerHeight: isMobile ? 215 : 220, tableZoom: isMobile ? 0.75 : 0.85, holeCardFan: 25
  });

  const heroIdx = useMemo(() => userProfile ? players.findIndex(p => p && p.uid === userProfile.uid) : -1, [players, userProfile]);
  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);
  const totalDisplayPot = useMemo(() => potAmount + players.reduce((a, p) => a + (p?.currentBet || 0), 0), [potAmount, players]);

  const handleAction = useCallback((type, amt = 0) => {
    if (currentRoomId) socket.emit('playerAction', { roomId: currentRoomId, type, amount: Number(amt || raiseInput) });
  }, [currentRoomId, raiseInput]);

  const handleLogin = useCallback(() => { 
    setLoginError(null);
    if (passwordInput.toLowerCase().trim() === 'pass') { 
        setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin' }); 
        setCurrentView(VIEWS.ADMIN); 
        socket.emit('getInitialData'); 
    } else socket.emit('playerLogin', { password: passwordInput });
  }, [passwordInput]);

  useEffect(() => {
    socket.on('connect', () => { setIsConnected(true); socket.emit('getInitialData'); });
    socket.on('initialDataResponse', (d) => { setActiveTables(d.rooms || []); setAllProfiles(d.profiles || []); });
    socket.on('roomUpdate', (d) => {
        if (!d) return;
        setPlayers(() => { const next = Array(10).fill(null); d.players.forEach((p, i) => { if(p) next[i] = {...p, seatIdx: i}; }); return next; });
        setPhase(d.phase); setCommunity(d.community || []); setPotAmount(d.potAmount || 0);
        setActiveIdx(d.activeIdx); setHighestBet(d.highestBet); setDealerIdx(d.dealerIdx);
        if (d.activeVariant) setActiveVariant(VARIANTS[d.activeVariant.id] || VARIANTS.HOLDEM);
        if (d.showdownWinners) setShowdownWinners(d.showdownWinners);
    });
    socket.on('lobbyUpdate', (l) => setActiveTables(l || []));
    socket.on('profilesUpdate', (l) => setAllProfiles(l || []));
    socket.on('loginSuccess', (p) => { setUserProfile(p); setPendingVariantId(p.pendingVariant || 'HOLDEM'); setCurrentView(VIEWS.LOBBY); });
    socket.on('loginError', (m) => setLoginError(m));
    socket.on('log', (l) => setLogs(p => [...p, { id: Math.random(), time: new Date().toLocaleTimeString(), ...l }].slice(-50)));
    return () => { socket.off(); };
  }, []);

  const groupedLogs = useMemo(() => {
    const handGroups = [];
    let currentHand = { id: 'latest', variantName: activeVariant?.name, isOngoing: phase !== PHASES.IDLE, summaries: [] };
    [...logs].reverse().forEach(log => {
      if (log.type === 'phase' && log.action.includes('DEALT')) {
        handGroups.push(currentHand);
        currentHand = { id: log.id, variantName: activeVariant?.name, isOngoing: false, summaries: [] };
      }
      if (log.name && log.name !== 'SYSTEM') currentHand.summaries.push({ name: log.name, amount: log.amount || log.action, rank: log.rank || '...' });
    });
    handGroups.push(currentHand);
    return handGroups.filter(h => h.summaries.length > 0);
  }, [logs, activeVariant, phase]);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#020408] flex items-center justify-center p-6 text-white uppercase font-black">
        <div className="w-full max-w-[400px] p-10 bg-black/80 border border-white/10 rounded-[3rem] backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-10">
            <Lock size={44} className="text-yellow-500 animate-pulse" />
            <div className="w-full flex flex-col gap-2">
                <input type="password" value={passwordInput} onChange={(e)=>setPasswordInput(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&handleLogin()} placeholder="ARENA KEY" className={`w-full bg-white/5 border ${loginError ? 'border-red-500' : 'border-white/10'} p-6 rounded-2xl text-center tracking-[0.8em] text-[#fbbf24] outline-none text-2xl font-black uppercase`}/>
                {loginError && <p className="text-red-500 text-[10px] text-center">{loginError}</p>}
            </div>
            <button onClick={handleLogin} className="w-full p-6 bg-gradient-to-r from-amber-400 to-yellow-600 text-black rounded-2xl font-black text-xl shadow-2xl uppercase">AUTHENTICATE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white uppercase font-black overflow-hidden">
        <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-8 flex flex-col gap-4 bg-black/20 shrink-0">
            <h2 className="text-[#fbbf24] flex items-center gap-2 mb-4 italic"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`p-4 rounded-xl text-xs font-black font-mono tracking-widest ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black shadow-[0_0_15px_#fbbf24]' : 'bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`p-4 rounded-xl text-xs font-black font-mono tracking-widest ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black shadow-[0_0_15px_#fbbf24]' : 'bg-white/5'}`}>TABLES</button>
            <button onClick={() => { if(!nuclearConfirm) setNuclearConfirm(true); else { socket.emit('adminNuclearReset'); setNuclearConfirm(false); } }} className={`p-4 rounded-xl border-2 transition-all uppercase ${nuclearConfirm ? 'bg-red-600 border-white text-white' : 'bg-white/5 text-red-500 border-red-500/20'}`}><Bomb size={14}/> {nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</button>
            <button onClick={()=>setCurrentView(VIEWS.LOBBY)} className="p-4 rounded-xl bg-cyan-600 text-black font-black text-xs">EXIT</button>
        </aside>
        <main className="flex-1 p-12 overflow-y-auto bg-black/40">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8">
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10 shadow-inner">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="PLAYER NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 uppercase text-white text-sm font-mono"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="SECURE KEY" className="bg-black/40 p-3 rounded-xl border border-white/10 uppercase text-white text-sm font-mono"/>
                        <button onClick={() => { if(newPlayer.name) { socket.emit('adminCreatePlayer', newPlayer); setNewPlayer({name:'', chips:100, password:''}); } }} className="bg-[#fbbf24] text-black rounded-xl font-black p-3 text-sm font-mono tracking-widest uppercase italic">CREATE</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                        {allProfiles.map(p => (
                            <div key={p.uid} className="flex justify-between p-4 border-b border-white/5 items-center hover:bg-white/5 transition-colors">
                                <span className="text-sm font-black font-mono italic uppercase">{p.name}</span>
                                <div className="flex gap-4 items-center">
                                    <span className="text-emerald-400 text-lg font-mono">${p.chips.toLocaleString()}</span>
                                    {pendingDeletePlayerUid === p.uid ? (
                                        <button onClick={() => { socket.emit('adminDeletePlayer', p.uid); setPendingDeletePlayerUid(null); }} className="bg-red-600 text-white text-[8px] px-2 py-1 rounded">SURE?</button>
                                    ) : (
                                        <button onClick={() => setPendingDeletePlayerUid(p.uid)} className="text-red-500"><Trash2 size={18}/></button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4 border border-white/10 shadow-inner">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 uppercase text-white text-sm font-mono"/>
                        <button onClick={() => { if(newTable.name) { socket.emit('adminCreateRoom', newTable); setNewTable({name:'', sb:0.25, bb:0.5}); } }} className="bg-emerald-600 text-white rounded-xl font-black p-3 text-sm font-mono tracking-widest uppercase italic">DEPLOY</button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {activeTables.map(t => (
                            <div key={t.id} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10 font-mono">
                              <div><h4 className="text-[#fbbf24] font-black text-lg italic">{t.name}</h4><p className="text-[10px] text-white/40 tracking-widest uppercase">STAKES: ${t.sb}/${t.bb}</p></div>
                              {pendingDeleteTableId === t.id ? (
                                  <button onClick={() => { socket.emit('adminDeleteRoom', t.id); setPendingDeleteTableId(null); }} className="bg-red-600 text-white px-4 py-1.5 rounded-xl text-[10px] font-black">TERMINATE NOW</button>
                              ) : (
                                  <button onClick={() => setPendingDeleteTableId(t.id)} className="text-red-500 font-black text-[10px] tracking-widest uppercase italic">TERMINATE</button>
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
    <div className="h-screen bg-[#06080c] flex flex-col text-white font-black uppercase overflow-hidden">
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-12 bg-black/40 backdrop-blur-md shrink-0">
          <h2 className="tracking-[0.4em] text-xl flex items-center gap-4 font-black"><LayoutGrid className="text-[#fbbf24] w-6"/> LOBBY</h2>
          <div className="flex items-center gap-10 font-black">
            <span className="text-emerald-400 font-mono text-2xl tracking-tighter">${Number(userProfile?.chips || 0).toLocaleString()}</span>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500"><LogOut size={16}/></button>
          </div>
        </header>
        <main className="flex-1 p-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 overflow-y-auto">
            {activeTables.map((t) => (
              <div key={t.id} className="p-8 bg-white/5 border border-white/5 rounded-3xl flex flex-col gap-6 shadow-2xl group transition-all font-black">
                <h3 className="text-2xl tracking-widest text-white group-hover:text-[#fbbf24] uppercase font-black">{t.name}</h3>
                <div className="bg-black/60 p-6 rounded-2xl flex justify-between items-center border border-white/5 shadow-inner uppercase font-black">
                  <div className="flex flex-col"><span className="text-[8px] text-white/40 tracking-widest uppercase">STAKES</span><span className="text-[#fbbf24] text-xl font-black">${t.sb}/${t.bb}</span></div>
                  <div className="flex flex-col items-end"><span className="text-[8px] text-white/40 tracking-widest uppercase">SEATS</span><span className="text-white/80 font-mono text-base font-black">{t.players?.filter(p=>p).length || 0}/10</span></div>
                </div>
                <button onClick={()=>{ socket.emit('joinRoom', { roomId: t.id, profile: userProfile, buyIn: 10 }, (res)=>{ if(res.status==='ok'){ setCurrentRoomId(t.id); setCurrentView(VIEWS.GAME); } }); }} className="w-full p-8 bg-emerald-600 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-[10px] font-black uppercase font-mono tracking-widest">ENTER ARENA</button>
              </div>
            ))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#020408] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      {intelExpanded && (
        <div onClick={() => setIntelExpanded(false)} className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-md p-6 pt-[100px] flex flex-col animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[800px] mx-auto bg-slate-900/90 border border-yellow-500/20 rounded-3xl p-6 flex flex-col flex-1 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0 font-mono italic">
               <div className="flex items-center gap-2"><Eye className="text-[#fbbf24]" size={20} /><h3 className="text-xl text-[#fbbf24] tracking-widest">INTELLIGENCE</h3></div>
               <button onClick={() => setIntelExpanded(false)} className="text-white/40 hover:text-white"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide font-mono">
                {groupedLogs.map((hand, hidx) => (
                    <div key={hidx} className="flex flex-col border border-white/5 rounded-2xl bg-black/40 overflow-hidden mb-4 p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] text-cyan-400 tracking-widest font-black italic">{hand.variantName || 'HAND'} DATA</span>
                          {hand.isOngoing && <span className="text-[8px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded animate-pulse">LIVE</span>}
                        </div>
                        {hand.summaries.map((s, si) => (
                            <div key={si} className="text-xs flex gap-2 mb-1">
                                <span className="text-white uppercase font-black">{s.name}:</span>
                                <span className="text-emerald-400">{s.amount}</span>
                                <span className="text-white/40 italic">/ {s.rank}</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <header className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-8 z-[80] shadow-2xl backdrop-blur-md shrink-0 font-black h-20">
        <div className="flex items-center gap-1.5 flex-1">
            <div className="bg-white/5 px-4 py-2 rounded-xl flex flex-col justify-center shadow-inner min-w-[120px]">
              <span className="text-[#fbbf24] text-[10px] leading-none mb-1 font-mono">VARIANT:</span>
              <span className="text-white text-sm font-mono italic">{activeVariant?.name || "IDLE"}</span>
            </div>
            <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl flex flex-col justify-center shadow-inner min-w-[120px]">
              <span className="text-cyan-400 text-[10px] leading-none mb-1 font-mono uppercase">On My Deal:</span>
              <select value={pendingVariantId} onChange={(e) => { setPendingVariantId(e.target.value); socket.emit('updatePlayerSettings', {uid: userProfile?.uid, pendingVariant: e.target.value}); }} className="bg-transparent text-white outline-none text-xs cursor-pointer font-black uppercase appearance-none font-mono italic">
                {Object.entries(VARIANTS).map(([k,v]) => (<option key={k} value={k} className="bg-slate-900">{v.name}</option>))}
              </select>
            </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => socket.emit('adminAddBot', { roomId: currentRoomId })} className="p-3 bg-white/5 border border-white/10 rounded-xl text-indigo-400 hover:bg-white/10 transition-colors"><Bot size={18}/></button>
          <button onClick={() => setIntelExpanded(true)} className="p-3 bg-white/5 border border-white/10 rounded-xl text-[#fbbf24] hover:bg-white/10 transition-colors"><Eye size={18}/></button>
          <button onClick={() => setCurrentView(VIEWS.LOBBY)} className="p-3 bg-white/5 border border-white/10 rounded-xl text-red-500"><LogOut size={18}/></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-[#0f3d2e]/40 to-black overflow-hidden font-black">
        <div style={{ transform: `scale(${visuals.tableZoom})` }} className="relative w-full max-w-[1400px] aspect-[21/10] flex items-center justify-center h-full origin-center">
            <div className="absolute inset-0 bg-[#0f3d2e]/60 rounded-[50%] border-[2.5vw] border-slate-900/80 shadow-[inset_0_0_20vw_rgba(0,0,0,0.9)] border-double font-black uppercase overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/felt.png')]" />
            </div>
            <div className="absolute inset-0 pointer-events-none z-20">
              {(players || []).map((p, i) => { if (!p) return null; const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; return (<Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} seatIdx={i} visuals={visuals} isCollectingBets={potTransferring} />); })}
            </div>
            <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center">
              {!potTransferring && ( 
                <div className="flex flex-col items-center drop-shadow-[0_0_30px_#fbbf24]" style={{ transform: `scale(${visuals.potScale})` }}>
                  <div className="text-[6vw] font-black text-yellow-500 font-mono tracking-tighter">${Number(totalDisplayPot).toLocaleString()}</div>
                </div> 
              )}
              {community.length > 0 && (
                <div className="flex gap-4 mt-14 transition-transform" style={{ transform: `scale(${visuals.commCardScale}) translateY(${visuals.commCardY}px)` }}>
                  {community.map((c, j) => (<div key={j} className="w-[3.5vw] h-[5.5vw] rounded-lg border bg-white flex flex-col items-center justify-center text-black font-black shadow-2xl"><span className="text-[1.2vw] font-mono leading-none">{c.value}</span><span className={`text-[2vw] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{c.suit}</span></div>))}
                </div>
              )}
            </div>
        </div>
      </main>

      <footer style={{ height: visuals.footerHeight }} className="bg-[#05070a]/95 backdrop-blur-3xl border-t border-white/5 flex flex-col z-[100] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] shrink-0 font-black uppercase">
        <div className="flex-1 flex flex-col justify-center px-10 relative overflow-visible">
          {activeVariant?.id === 'HILOW' && heroPlayerObj && !heroPlayerObj.isFolded && (
             <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-4 w-full justify-center">
                <div className="bg-emerald-950/40 px-6 py-2 rounded-xl border border-emerald-500/20 text-emerald-400 font-mono flex flex-col items-center">
                    <span className="text-[10px] text-white/40 uppercase font-black">LOW HAND</span>
                    <span className="text-xl font-black italic">{heroPlayerObj.lowStrength || "---"}</span>
                </div>
                <div className="bg-purple-950/40 px-6 py-2 rounded-xl border border-purple-500/20 text-purple-400 font-mono flex flex-col items-center">
                    <span className="text-[10px] text-white/40 uppercase font-black">HIGH HAND</span>
                    <span className="text-xl font-black italic">{heroPlayerObj.strength || "---"}</span>
                </div>
             </div>
          )}
          
          {activeIdx === heroIdx && phase !== PHASES.IDLE && heroPlayerObj ? (
            <div className="flex flex-col gap-4 items-center w-full mt-4">
                {activeVariant?.id !== 'HILOW' && (
                    <div className="bg-slate-900/60 px-8 py-2 rounded-2xl border border-white/5 flex flex-col items-center">
                        <span className="text-xl text-purple-400 italic font-black font-mono">{heroPlayerObj.strength || "..."}</span>
                        <span className="text-lg text-yellow-400 font-mono font-black italic">{heroPlayerObj.winProbability}% WIN PROB</span>
                    </div>
                )}
                <div className="flex gap-4 w-full items-center justify-center font-black mt-2">
                    <button onClick={()=>handleAction('FOLD')} className="flex-1 h-20 bg-gradient-to-b from-red-950/80 to-red-900/60 border border-red-500/30 rounded-xl font-black text-lg tracking-widest font-mono">FOLD</button>
                    <button onClick={()=>handleAction('CALL')} className="flex-1 h-20 bg-gradient-to-b from-indigo-950/80 to-indigo-900/60 border border-indigo-400/30 rounded-xl text-2xl font-black font-mono">
                      {highestBet > heroPlayerObj.currentBet ? `CALL $${(highestBet - heroPlayerObj.currentBet).toLocaleString()}` : 'CHECK'}
                    </button>
                    <div className="flex-[1.5] flex gap-2 items-center bg-[#0d1117] border border-yellow-500/20 p-2 rounded-xl">
                        <input type="number" step="0.25" value={raiseInput} onChange={(e) => setRaiseInput(Number(e.target.value))} className="w-full bg-transparent text-center font-mono text-4xl text-yellow-400 outline-none font-black tracking-tighter" />
                        <button onClick={()=>handleAction('RAISE')} className="flex-1 h-16 bg-gradient-to-r from-yellow-600 to-amber-700 border border-yellow-400/30 rounded-lg flex items-center justify-center font-black text-2xl font-mono"><Zap size={22} className="mr-1 text-black"/> BET</button>
                    </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase">
                {showdownWinners ? (
                    <div className="w-full flex flex-col items-center justify-center gap-4 animate-in zoom-in duration-500">
                        <div className="flex items-center gap-3 text-yellow-400 font-black tracking-widest text-2xl uppercase bg-yellow-400/10 px-8 py-2 rounded-full border border-yellow-400/20 font-mono">
                            <Trophy size={28} /> {showdownWinners[0].name} WINS ${showdownWinners[0].amount.toLocaleString()}!
                        </div>
                        <div className="flex gap-2">
                            {showdownWinners[0].hand.map((c, i) => (
                                <div key={i} className="w-16 h-24 bg-white rounded-xl flex flex-col items-center justify-center text-black shadow-2xl relative overflow-hidden">
                                    <span className="text-[20px] font-black absolute top-1 left-2 font-mono">{c.value}</span>
                                    <span className={`text-[36px] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{c.suit}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : ( 
                    <div className="flex flex-col items-center gap-4">
                        {phase === PHASES.IDLE ? (
                          <div className="flex flex-col items-center gap-3 font-mono italic animate-pulse text-white/20 tracking-widest">INITIALIZING ARENA CORE...</div>
                        ) : (
                          <div className="flex flex-row items-center gap-10 px-8">
                                <div className="flex flex-col items-start bg-yellow-950/20 px-8 py-3 rounded-2xl border border-yellow-500/20 font-mono">
                                    <span className="text-yellow-500 text-[13px] animate-pulse mb-1 font-black italic tracking-widest">ACTION ON</span>
                                    <span className="text-white text-4xl italic uppercase font-black">{players[activeIdx]?.name || "..."}</span>
                                </div>
                                {heroPlayerObj && !heroPlayerObj.isFolded && activeVariant?.id !== 'HILOW' && (
                                  <div className="flex flex-col bg-slate-950/60 p-4 rounded-2xl border border-white/5 font-mono italic">
                                      <span className="text-[24px] text-purple-400 font-black tracking-tight">{heroPlayerObj.strength || "..."}</span>
                                      <span className="text-yellow-400 text-lg font-black">{heroPlayerObj.winProbability}% WIN PROB</span>
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
          @keyframes bet-slam { 0% { transform: translate(-50%, 0) scale(4); opacity: 0; filter: blur(20px); } 100% { transform: translate(-50%, 0) scale(1); opacity: 1; filter: blur(0); } }
          .animate-bet-slam { animation: bet-slam 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
          @keyframes bet-vortex { 0% { opacity: 1; } 100% { transform: translate(-50%, -45vh) scale(0); opacity: 0; filter: blur(15px); } }
          .animate-bet-vortex { animation: bet-vortex 0.7s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards; }
          @keyframes card-deal { 0% { transform: translateY(-500px) rotate(360deg) scale(0); opacity: 0; } 100% { opacity: 1; } }
          .animate-deal-card { animation: card-deal 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
          html, body { overscroll-behavior-y: contain; height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; background-color: #020408; font-family: 'JetBrains Mono', monospace; }
      `}</style>
    </div>
  );
};

export default App;
