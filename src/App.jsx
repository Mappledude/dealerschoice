import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor
} from 'lucide-react';
import io from 'socket.io-client';

// --- PRODUCTION SOCKET CONFIGURATION ---
const SOCKET_URL = "https://poker-server-3vin.onrender.com"; 
const socket = io(SOCKET_URL, { transports: ['websocket'] });

// --- ENVIRONMENT DETECTION ---
const isProduction = !window.location.hostname.includes('gemini') && 
                     !window.location.hostname.includes('localhost') &&
                     !window.location.hostname.includes('usercontent');

// --- CONSTANTS & CONFIG ---
const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES', LOGS: 'LOGS' };

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2, rules: "Best 5 out of 7 cards" }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA', holeCards: 4, rules: "Use EXACTLY 2 hand + 3 board cards!" }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3, rules: "3 hole cards dealt; discard 1 after flop." }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2, rules: "LOWEST ranked hand wins the pot!" } 
};

const PHASES = { 
  IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' 
};

const DISPLAY_POSITIONS = [
  { x: 50, y: 96 }, { x: 18, y: 82 }, { x: 5,  y: 50 }, { x: 8,  y: 22 }, { x: 28, y: 8  },
  { x: 50, y: 4  }, { x: 72, y: 8  }, { x: 92, y: 22 }, { x: 95, y: 50 }, { x: 82, y: 82 }
];

const VALUE_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const SUITS = ['♠', '♣', '♥', '♦'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const INITIAL_PLAYERS = Array.from({ length: TOTAL_SEATS }, () => null);

// --- SUB-COMPONENTS ---
const Seat = ({ 
  player, displayPos, phase, dealStaggerIndex, winning5Ids, 
  isWinnerCalculated, potTransferring 
}) => {
  if (!player || !displayPos) return null;
  const isShowdown = phase === PHASES.SHOWDOWN;
  const isWinner = player.isWinner;

  return (
    <div 
      style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} 
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col-reverse items-center z-20 transition-all duration-1000 ease-out 
        ${player?.isFolded ? 'opacity-20 grayscale scale-95' : 'opacity-100'}
        ${isShowdown && isWinner ? 'z-[500]' : 'z-20'}`}
    >
      <div className={`flex items-center gap-2 p-[0.6vw] px-[2vw] rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl transition-all duration-300 relative 
        ${isWinner && isShowdown ? (potTransferring ? 'border-yellow-400 scale-125 shadow-[0_0_3vw_rgba(251,191,36,0.8)]' : 'border-yellow-400 scale-110 shadow-[0_0_2vw_rgba(251,191,36,0.6)]') : 'border-white/10'}`}>
        <div className="flex flex-col items-center">
            {player.isAllIn && !player.isFolded && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white animate-pulse">All-In</div>
            )}
            <div className="flex items-center gap-2">
                {player?.isDealer && <div className="w-[0.8vw] h-[0.8vw] bg-red-600 rounded-full shadow-[0_0_0.5vw_rgba(220,38,38,0.8)] animate-pulse" />}
                <span className="text-[1.1vw] font-black text-white leading-none uppercase tracking-widest whitespace-nowrap">{String(player?.name || "Player")}</span>
            </div>
            <span className={`text-[1.2vw] font-mono font-black mt-1.5 transition-all duration-500 ${isWinner && isShowdown ? 'text-emerald-400 animate-pulse' : 'text-emerald-500/80'}`}>${Number(player?.chips || 0)}</span>
        </div>
      </div>

      {player?.hand?.length > 0 && !player.isFolded && (
        <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mb-4 overflow-visible">
          {(player.hand || []).map((c, ci) => {
            const fanOffset = (ci - (player.hand.length - 1) / 2) * 2.5; 
            const rotation = (ci - (player.hand.length - 1) / 2) * 10; 
            const isWinningCard = (winning5Ids || []).includes(c.id);
            const shouldHighlight = isShowdown && isWinner && isWinningCard;

            return (
              <div key={ci} 
                className={`w-[2.5vw] h-[3.5vw] rounded-[0.4vw] flex flex-col items-start justify-start p-[0.2vw] transition-all duration-700 brightness-110 border border-white/40 shadow-lg absolute overflow-hidden
                ${isShowdown ? 'bg-gradient-to-br from-white via-white to-slate-50 text-slate-950' : 'bg-gradient-to-br from-slate-700 via-slate-900 to-black'} 
                ${dealStaggerIndex >= ci ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[-1vw]'} 
                ${shouldHighlight ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_#fbbf24] animate-pulse z-[100]' : 'opacity-100'}`} 
                style={{ transform: `translateX(${fanOffset}vw) rotate(${rotation}deg) scale(1.5)`, transformOrigin: 'bottom center', zIndex: (isShowdown && isWinner ? 500 : 100) + ci }}
              >
                {isShowdown ? (
                   <div className="flex flex-col items-start leading-none h-full w-full pl-0.5 pt-0.5 relative">
                     <span className="text-[0.8vw] font-black text-slate-950 block mb-0.5 leading-none">{String(c.value)}</span>
                     <span className={`text-[1.2vw] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-950'}`}>{String(c.suit)}</span>
                   </div>
                 ) : ( <div className="w-full h-full flex items-center justify-center opacity-40 relative"><ShieldCheck size={12} className="text-white/20" /></div> )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const App = () => {
  // --- SESSION STATE ---
  const [currentView, setCurrentView] = useState(VIEWS.LOGIN);
  const [adminTab, setAdminTab] = useState(ADMIN_TABS.PLAYERS);
  const [userProfile, setUserProfile] = useState(null);
  const [userNameInput, setUserNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [buyInAmount, setBuyInAmount] = useState(500);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);

  // --- REGISTRY STATE (LOBBY & ADMIN) ---
  const [allProfiles, setAllProfiles] = useState([]);
  const [activeTables, setActiveTables] = useState([]);
  const [globalLogs, setGlobalLogs] = useState([]);
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 5000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 10, bb: 20 });
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isDeployingPlayer, setIsDeployingPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);

  // --- GAME ARENA STATE ---
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [potData, setPotData] = useState([{ label: 'MAIN', amount: 0, eligible: [] }]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [lastRaiseAmt, setLastRaiseAmt] = useState(40);
  const [dealStaggerIndex, setDealStaggerIndex] = useState(-1);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [winningPlayerIndices, setWinningPlayerIndices] = useState([]); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [potTransferring, setPotTransferring] = useState(false);
  
  const lastLogRef = useRef({ time: 0, text: '' });

  // --- PERSISTENCE: Initial Hydration ---
  useEffect(() => {
    const savedProfiles = localStorage.getItem('poker_profiles');
    const savedTables = localStorage.getItem('poker_rooms');
    if (savedProfiles) setAllProfiles(JSON.parse(savedProfiles));
    if (savedTables) setActiveTables(JSON.parse(savedTables));
  }, []);

  // --- PERSISTENCE: Sync on Update ---
  useEffect(() => {
    localStorage.setItem('poker_profiles', JSON.stringify(allProfiles));
  }, [allProfiles]);

  useEffect(() => {
    localStorage.setItem('poker_rooms', JSON.stringify(activeTables));
  }, [activeTables]);

  // --- MULTIPLAYER SYNC ---
  useEffect(() => {
    socket.on('gameUpdate', (state) => {
        setPlayers(state.players || INITIAL_PLAYERS);
        setCommunity(state.community || []);
        setPhase(state.phase || PHASES.IDLE);
        setActiveVariant(state.activeVariant || VARIANTS.HOLDEM);
        setPotData(state.potData || [{ label: 'MAIN', amount: 0, eligible: [] }]);
        setActiveIdx(state.activeIdx ?? -1);
        setHighestBet(state.highestBet || 0);
        setLastRaiseAmt(state.lastRaiseAmt || 40);
        setWinning5Ids(state.winning5Ids || []);
        setWinningPlayerIndices(state.winningPlayerIndices || []);
        setPotTransferring(state.potTransferring || false);
        setIsAnimating(state.isAnimating || false);
    });

    socket.on('lobbyUpdate', (tables) => setActiveTables(tables));
    socket.on('profilesUpdate', (profiles) => setAllProfiles(profiles));

    socket.on('loginSuccess', (profile) => {
        setUserProfile(profile);
        setCurrentView(VIEWS.LOBBY);
        addLog({ action: `IDENTIFICATION AUTHENTICATED: ${profile.name.toUpperCase()}`, type: 'system' });
    });

    socket.on('globalLog', (log) => setGlobalLogs(prev => [log, ...prev].slice(0, 100)));
    socket.on('log', (data) => addLog(data));

    return () => {
        socket.off('gameUpdate'); socket.off('lobbyUpdate');
        socket.off('profilesUpdate'); socket.off('loginSuccess');
        socket.off('globalLog'); socket.off('log');
    };
  }, []);

  // --- DERIVED PERSPECTIVE ---
  const heroSeatIdx = useMemo(() => {
      if (!userProfile) return -1;
      return players.findIndex(p => p?.uid === userProfile.uid);
  }, [players, userProfile]);

  const userSeat = heroSeatIdx !== -1 ? players[heroSeatIdx] : null;
  const isShowdown = phase === PHASES.SHOWDOWN;
  const isWinnerCalculated = (winningPlayerIndices || []).length > 0;
  const isWinnerHero = isShowdown && heroSeatIdx !== -1 && (winningPlayerIndices || []).includes(heroSeatIdx);

  const actualPotAmount = useMemo(() => (potData || []).reduce((acc, p) => acc + (p?.amount || 0), 0), [potData]);
  const currentPotOnTable = useMemo(() => actualPotAmount + (players || []).reduce((s, p) => s + (p?.currentBet || 0), 0), [actualPotAmount, players]);

  const isHeroTurn = activeIdx !== -1 && heroSeatIdx !== -1 && activeIdx === heroSeatIdx && phase !== PHASES.IDLE && !isShowdown;
  const minRaiseTo = highestBet + lastRaiseAmt;
  const maxAllIn = userSeat?.chips || 0;

  const addLog = useCallback((data) => {
    const logKey = `${data.name}-${data.action}-${data.amount}`;
    const now = Date.now();
    if (now - lastLogRef.current.time < 500 && lastLogRef.current.text === logKey) return;
    lastLogRef.current = { time: now, text: logKey };

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logEntry = { 
        id: Date.now() + Math.random(), 
        time: String(timestamp), 
        name: data.name ? String(data.name) : "", 
        action: data.action ? String(data.action) : "", 
        amount: data.amount ? String(data.amount) : null, 
        type: data.type ? String(data.type) : 'info' 
    };
    setLogs(prev => [logEntry, ...prev].slice(0, 50));
  }, []);

  const evaluateBestHandSync = useCallback((hand, board, v) => {
    if (!hand || hand.length === 0 || board.length < 3) return { power: 0, hand: [], name: "Evaluating..." };
    const subsets = getCombinations([...hand, ...board], 5);
    let best = { power: -1, name: "High Card", hand: [] };
    subsets.forEach(c => { 
        const r = rankFiveCardHand(c); 
        if (r.power > best.power) { best = r; } 
    });
    return best;
  }, []);

  const getCurrentStrength = useCallback((p) => {
    if (!p || p.isFolded || !p.hand || p.hand.length === 0) return "";
    const result = evaluateBestHandSync(p.hand, community, activeVariant);
    return String(activeVariant?.id === 'MUFLIS' ? `MUFLIS: ${result.name}` : result.name);
  }, [community, activeVariant, evaluateBestHandSync]);

  // --- HANDLERS ---
  const handleLogin = () => {
    if (passwordInput === 'pass') {
        setCurrentView(VIEWS.ADMIN);
    } else {
        if (socket.connected) {
            socket.emit('playerLogin', { password: passwordInput });
        } else {
            const match = allProfiles.find(p => p.password === passwordInput || p.uid === passwordInput);
            if (match) {
                setUserProfile(match);
                setCurrentView(VIEWS.LOBBY);
            } else {
                addLog({ action: "INVALID PASSCODE", type: 'system' });
            }
        }
    }
  };

  const handleJoinRoom = () => {
      if (!selectedTableForJoin || !userProfile) return;
      const buyIn = buyInAmount;
      if (socket.connected) {
          socket.emit('joinRoom', { roomId: selectedTableForJoin.id, uid: userProfile.uid, buyIn: buyIn });
      } else {
          setPlayers(prev => {
              const next = [...prev];
              next[0] = { ...userProfile, chips: buyIn, isSeated: true, hand: [], currentBet: 0, isFolded: false, isWinner: false };
              return next;
          });
      }
      setSelectedTableForJoin(null);
      setCurrentView(VIEWS.GAME);
  };

  // ADMIN PLAYER CREATION
  const handleAdminCreatePlayer = () => {
      const { name, password, chips } = newPlayer;
      if (!name || !password) return;
      setIsDeployingPlayer(true);
      const uid = Math.random().toString(36).substr(2, 9);
      const payload = { name, password, chips, id: uid, uid: uid };

      if (socket.connected) {
          socket.emit('adminCreatePlayer', payload, (res) => {
            setAllProfiles(prev => [...prev, payload]);
            setIsDeployingPlayer(false);
            setIsAddingPlayer(false);
            setNewPlayer({ name: '', chips: 5000, password: '' });
          });
      } else {
          setAllProfiles(prev => [...prev, payload]);
          setIsDeployingPlayer(false);
          setIsAddingPlayer(false);
          setNewPlayer({ name: '', chips: 5000, password: '' });
          addLog({ action: `SIMULATION: PLAYER ${name} PROVISIONED`, type: 'system' });
      }
  };

  // ADMIN ROOM CREATION
  const handleAdminCreateTable = () => {
      if (!newTable.name) return;
      const roomId = 'room_' + Math.random().toString(36).substr(2, 9);
      const payload = { ...newTable, id: roomId, count: 0 };
      
      if (socket.connected) {
          socket.emit('adminCreateRoom', payload);
      } else {
          // Simulation Immediate Update
          setActiveTables(prev => {
              const updated = [...prev, payload];
              localStorage.setItem('poker_rooms', JSON.stringify(updated));
              return updated;
          });
          addLog({ action: `SIMULATION: ROOM ${newTable.name.toUpperCase()} SPAWNED`, type: 'system' });
      }
      setNewTable({ name: '', sb: 10, bb: 20 });
  };

  const handleAction = (type, amt = 0) => { socket.emit('playerAction', { type, amount: amt }); };
  const handleDeal = () => { socket.emit('dealRequest', { variantId: pendingVariantId }); };
  const handleAddBot = () => { socket.emit('addBot'); };
  const handleClearArena = () => { socket.emit('adminResetServer'); };

  const winnerPos = useMemo(() => {
      const idx = (winningPlayerIndices && winningPlayerIndices[0]) || 0;
      const displayIdx = heroSeatIdx === -1 ? idx : (idx - heroSeatIdx + TOTAL_SEATS) % TOTAL_SEATS;
      return DISPLAY_POSITIONS[displayIdx] || DISPLAY_POSITIONS[0];
  }, [winningPlayerIndices, heroSeatIdx]);

  // --- RENDER VIEWS ---

  if (currentView === VIEWS.LOGIN) {
      return (
        <div className="h-screen bg-[#06080c] flex items-center justify-center relative overflow-hidden text-white font-sans">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a202c_0%,_#06080c_100%)] pointer-events-none" />
            <div className="w-[30vw] min-w-[380px] p-12 rounded-[2vw] bg-black/60 border border-white/10 backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-10">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-20 h-20 rounded-full bg-[#fbbf24]/10 border border-[#fbbf24]/30 flex items-center justify-center shadow-[0_0_3vw_rgba(251,191,36,0.1)]"><Lock size={32} className="text-[#fbbf24]" /></div>
                    <h1 className="text-2xl font-black uppercase tracking-[0.4em]">Identity Access</h1>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1">SIT AT TABLE ENTRANCE</p>
                </div>
                <div className="w-full flex flex-col gap-6">
                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-white/20 uppercase ml-4 tracking-widest">Entry Passcode</label>
                        <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="ENTER CODE..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-center text-sm font-black uppercase tracking-widest text-[#fbbf24] focus:border-[#fbbf24] outline-none transition-all"/>
                    </div>
                    <button onClick={handleLogin} className="w-full mt-4 p-6 rounded-2xl bg-[#fbbf24] border border-[#fbbf24]/50 shadow-xl font-black uppercase tracking-[0.3em] text-black">Authenticate</button>
                </div>
            </div>
        </div>
      );
  }

  if (currentView === VIEWS.ADMIN) {
      return (
        <div className="h-screen bg-[#06080c] flex relative overflow-hidden text-white font-sans">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_#1e293b_0%,_#06080c_100%)] pointer-events-none" />
            
            {isAddingPlayer && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-[25vw] min-w-[320px] bg-slate-900 border border-white/10 rounded-[1.5vw] p-8 shadow-2xl flex flex-col gap-6">
                        <h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-3"><UserPlus size={20} className="text-indigo-400"/> New Profile</h3>
                        <div className="flex flex-col gap-4">
                            <input value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} placeholder="USERNAME" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs font-black uppercase outline-none focus:border-indigo-500"/>
                            <input type="number" value={newPlayer.chips} onChange={e => setNewPlayer({...newPlayer, chips: Number(e.target.value)})} placeholder="INITIAL CHIPS" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs font-black outline-none"/>
                            <input value={newPlayer.password} onChange={e => setNewPlayer({...newPlayer, password: e.target.value})} placeholder="SECRET PASSWORD" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs font-black outline-none"/>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setIsAddingPlayer(false)} className="flex-1 p-4 rounded-xl bg-white/5 font-black uppercase text-[10px]">Cancel</button>
                            <button disabled={isDeployingPlayer} onClick={handleAdminCreatePlayer} className="flex-2 p-4 rounded-xl bg-indigo-600 font-black uppercase text-[10px]">{isDeployingPlayer ? "DEPLOYING..." : "Deploy Profile"}</button>
                        </div>
                    </div>
                </div>
            )}

            <aside className="w-72 bg-[#0f172a] border-r border-white/10 flex flex-col z-[100]">
                <div className="p-8 border-b border-white/5 mb-8 text-[#fbbf24]"><div className="flex items-center gap-3"><ShieldAlert size={20} /><span className="font-black uppercase tracking-widest text-sm">Super Admin</span></div></div>
                <nav className="flex-1 px-4 flex flex-col gap-2">
                    <button onClick={() => setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black shadow-lg' : 'text-white/40 hover:bg-white/5'}`}><Users size={18}/> Player Registry</button>
                    <button onClick={() => setAdminTab(ADMIN_TABS.TABLES)} className={`flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black shadow-lg' : 'text-white/40 hover:bg-white/5'}`}><Layers size={18}/> Room Control</button>
                </nav>
                <div className="p-8 mt-auto border-t border-white/5"><button onClick={() => setCurrentView(VIEWS.LOGIN)} className="flex items-center gap-4 text-white/40 hover:text-white font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16}/> Back to Login</button></div>
            </aside>

            <main className="flex-1 flex flex-col p-12 overflow-y-auto relative z-10">
                {adminTab === ADMIN_TABS.PLAYERS && (
                    <div className="flex flex-col gap-8 animate-in slide-in-from-right-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-6"><div className="flex flex-col"><h2 className="text-2xl font-black uppercase tracking-widest">Player Registry</h2><span className="text-[10px] font-bold text-white/30 uppercase">{allProfiles.length} Total Verified</span></div>
                        <button onClick={() => setIsAddingPlayer(true)} className="flex items-center gap-3 p-4 px-8 bg-[#fbbf24] text-black rounded-2xl font-black uppercase text-xs shadow-xl"><PlusCircle size={18}/> Add New Player</button></div>
                        <div className="bg-white/5 border border-white/10 rounded-[2vw] overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 border-b border-white/10"><tr className="text-[10px] font-black uppercase tracking-widest text-white/40"><th className="p-6">Identification</th><th className="p-6">Bankroll</th><th className="p-6 text-right">Utility</th></tr></thead>
                                <tbody>
                                    {allProfiles.map((p, i) => (<tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors"><td className="p-6 font-black uppercase text-sm">{p.name} <span className="text-[8px] opacity-20 block font-mono">UID: {p.uid}</span></td><td className="p-6 font-mono font-black text-emerald-400">${Number(p.chips).toLocaleString()}</td><td className="p-6 text-right flex items-center justify-end gap-3"><button className="p-2 bg-white/5 border border-white/10 rounded-lg text-[#fbbf24]"><Edit3 size={14}/></button></td></tr>))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {adminTab === ADMIN_TABS.TABLES && (
                    <div className="flex flex-col gap-8 animate-in slide-in-from-right-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-6"><h2 className="text-2xl font-black uppercase tracking-widest">Room Control</h2><button onClick={handleClearArena} className="p-4 px-8 bg-red-600/20 border border-red-500/30 text-red-500 rounded-2xl font-black uppercase text-xs">Clear Server</button></div>
                        <section className="bg-white/5 border border-white/10 rounded-[2vw] p-8 flex flex-col gap-8">
                            <h3 className="text-lg font-black uppercase tracking-widest flex items-center gap-3"><PlusCircle size={20} className="text-emerald-400"/> Initialize Room</h3>
                            <div className="space-y-4">
                                <input value={newTable.name} onChange={e => setNewTable({...newTable, name: e.target.value})} placeholder="ROOM NAME" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-xs font-black outline-none focus:border-emerald-500"/>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="number" value={newTable.sb} onChange={e => setNewTable({...newTable, sb: Number(e.target.value)})} placeholder="SMALL BLIND" className="bg-white/5 p-4 rounded-xl border border-white/10 text-xs font-black outline-none"/>
                                    <input type="number" value={newTable.bb} onChange={e => setNewTable({...newTable, bb: Number(e.target.value)})} placeholder="BIG BLIND" className="bg-white/5 p-4 rounded-xl border border-white/10 text-xs font-black outline-none"/>
                                </div>
                                <button onClick={handleAdminCreateTable} className="w-full p-5 bg-emerald-600 rounded-xl font-black uppercase text-xs hover:bg-emerald-500 transition-all shadow-xl mt-4">Spawn Arena Room</button>
                            </div>
                        </section>
                        {/* List Active Simulation Rooms */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {activeTables.map((t, i) => (
                                <div key={i} className="p-6 bg-black/40 border border-white/10 rounded-2xl flex justify-between items-center">
                                    <div><span className="text-[10px] font-black text-white/40 block">Room</span><span className="font-black uppercase text-[#fbbf24]">{t.name}</span></div>
                                    <div className="text-right"><span className="text-[10px] font-black text-white/40 block">Stakes</span><span className="font-mono text-xs">${t.sb}/${t.bb}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
      );
  }

  // --- VIEW: LOBBY ---
  if (currentView === VIEWS.LOBBY) {
      return (
        <div className="h-screen bg-[#06080c] flex flex-col relative overflow-hidden text-white font-sans">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a202c_0%,_#06080c_100%)] pointer-events-none" />
            
            {selectedTableForJoin && (
                <div className="absolute inset-0 z-[9000] flex items-center justify-center pointer-events-auto bg-black/80 backdrop-blur-md">
                    <div className="w-[30vw] min-w-[360px] p-12 rounded-[2vw] bg-slate-900 border border-[#fbbf24]/30 shadow-2xl flex flex-col gap-10 animate-in zoom-in-95 duration-300">
                        <div className="text-center space-y-1"><span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#fbbf24]">Buy-In Allocation</span><h3 className="text-3xl font-black uppercase tracking-widest text-white">{selectedTableForJoin.name}</h3></div>
                        <div className="space-y-6">
                            <div className="flex justify-between items-end px-2"><span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Table Stakes</span><span className="text-3xl font-mono font-black text-emerald-400">${buyInAmount}</span></div>
                            <input type="range" min={selectedTableForJoin.bb * 20} max={userProfile?.chips || 1000} step="100" value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="gold-slider" />
                            <div className="flex justify-between text-[8px] font-black text-white/20 uppercase px-1"><span>Min: 20BB</span><span>Max: Wallet</span></div>
                        </div>
                        <div className="flex gap-4"><button onClick={() => setSelectedTableForJoin(null)} className="flex-1 p-6 rounded-2xl bg-white/5 border border-white/10 font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all">Back</button>
                        <button onClick={handleJoinRoom} className="flex-2 p-6 rounded-2xl bg-emerald-600 border border-emerald-500/50 font-black uppercase text-sm tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all">Confirm Seat</button></div>
                    </div>
                </div>
            )}

            <header className="h-20 border-b border-white/10 bg-black/40 backdrop-blur-xl flex items-center justify-between px-12 z-50 shadow-xl">
                <div className="flex items-center gap-4"><LayoutGrid size={24} className="text-[#fbbf24]" /><h2 className="text-xl font-black uppercase tracking-[0.3em]">Arena Lobby</h2></div>
                <div className="flex items-center gap-12">
                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-3 px-6 rounded-2xl">
                        <div className="flex flex-col items-start"><span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Identification</span><span className="text-sm font-black text-white uppercase">{userProfile?.name}</span></div>
                        <div className="w-px h-6 bg-white/10 mx-2" />
                        <div className="flex flex-col items-end"><span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Global Wallet</span><span className="text-sm font-mono font-black text-emerald-400">${Number(userProfile?.chips).toLocaleString()}</span></div>
                    </div>
                    <button onClick={() => setCurrentView(VIEWS.LOGIN)} className="p-3 hover:bg-red-600/10 rounded-xl text-white/40 hover:text-red-500 transition-all"><LogOut size={20}/></button>
                </div>
            </header>
            
            <main className="flex-1 p-20 overflow-y-auto">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {activeTables.map((t, i) => (
                        <div key={i} className="p-10 rounded-[3vw] bg-white/5 border border-white/5 backdrop-blur-3xl flex flex-col gap-8 shadow-2xl hover:border-[#fbbf24]/30 transition-all group relative overflow-hidden">
                            <div className="flex flex-col gap-1"><h3 className="text-2xl font-black uppercase tracking-[0.1em]">{t.name}</h3><span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Active Game Instance</span></div>
                            <div className="flex justify-between items-center bg-black/60 p-6 rounded-2xl border border-white/5 shadow-inner">
                                <div className="flex flex-col"><span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Blinds</span><span className="text-xl font-black text-[#fbbf24]">${t.sb} / ${t.bb}</span></div>
                                <div className="flex flex-col items-end"><span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Load</span><span className="text-xl font-black text-white">{t.count || 0} / 10</span></div>
                            </div>
                            <button onClick={() => { setSelectedTableForJoin(t); setBuyInAmount(t.bb * 20); }} className="w-full p-8 rounded-3xl bg-emerald-600 border border-emerald-500/50 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-[0.3em] text-white">Join Table</button>
                        </div>
                    ))}
                    {activeTables.length === 0 && (<div className="col-span-full text-center p-32 opacity-10 flex flex-col items-center gap-6"><Target size={80} strokeWidth={1}/><span className="text-xl font-black uppercase tracking-[0.5em]">Establishing Global Handshake...</span></div>)}
                </div>
            </main>
        </div>
      );
  }

  // --- VIEW: GAME ARENA ---
  return (
    <div className="h-screen bg-[#06080c] text-white font-sans flex flex-col overflow-hidden relative selection:bg-cyan-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a202c_0%,_#06080c_100%)] pointer-events-none" />
      <header className="absolute top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-[30px] border-b border-white/10 flex items-center justify-between px-8 z-[8000] shadow-xl">
        <div className="flex items-center gap-6">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 hover:bg-white/5 rounded-lg transition-all active:scale-90 ${userProfile?.isAdmin ? 'text-[#fbbf24]' : 'text-slate-400'}`}>
            {userProfile?.isAdmin ? <ShieldAlert size={20} /> : <ChevronLeft size={20} className={sidebarOpen ? 'rotate-0' : 'rotate-180'} />}
          </button>
          <div className="flex items-center gap-6 bg-white/5 border border-white/10 px-6 py-2 rounded-2xl">
            <span className="text-[#fbbf24] font-black text-xl uppercase whitespace-nowrap">THIS HAND:</span>
            <div className="flex flex-col leading-tight"><span className="text-[#fbbf24] font-black text-xl uppercase tracking-widest leading-none">{String(activeVariant?.name || "Texas Hold'em")}</span><span className="text-white/60 text-sm font-bold italic tracking-tight mt-1">{String(activeVariant?.rules || "")}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end w-72 text-right"><span className="text-white/40 font-bold uppercase text-xs tracking-widest mb-1">On my turn, deal:</span>
              <select value={pendingVariantId} onChange={(e) => setPendingVariantId(String(e.target.value))} className="bg-transparent text-[#fbbf24] font-black text-lg uppercase border-none outline-none cursor-pointer leading-none" >
                  {Object.entries(VARIANTS).map(([k, v]) => <option key={k} value={k} className="bg-slate-900">{String(v.name)}</option>)}
              </select>
           </div>
           <button onClick={() => setCurrentView(VIEWS.LOBBY)} className="p-2 hover:bg-red-600/20 rounded-lg text-red-500 transition-all"><LogOut size={20}/></button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center relative min-h-screen pt-16 pb-36 px-4">
        <div className="relative w-full max-w-[1600px] aspect-[21/10] mx-auto transition-all duration-1000 flex items-center justify-center">
            <div className="absolute inset-0 pointer-events-none z-20">
              {players.map((p, i) => {
                if (!p || (userProfile && p.uid === userProfile.uid)) return null;
                if (heroSeatIdx !== -1 && i === heroSeatIdx) return null;
                const relativeIdx = heroSeatIdx === -1 ? i : (i - heroSeatIdx + TOTAL_SEATS) % TOTAL_SEATS;
                return <Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[relativeIdx]} phase={phase} dealStaggerIndex={dealStaggerIndex} winning5Ids={winning5Ids} potTransferring={potTransferring && (winningPlayerIndices || []).includes(i)} isWinnerCalculated={isWinnerCalculated} />;
              })}
            </div>
            <div className="absolute inset-0 bg-emerald-950/5 rounded-[40%] border-[1.5vw] border-slate-900 shadow-[inset_0_0_8vw_rgba(245,158,11,0.2),inset_0_0_15vw_rgba(0,0,0,0.9)] overflow-hidden" />
            <div className={`absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center z-30 pointer-events-none`}>
              <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-[800ms] ease-in-out`} style={{ top: potTransferring ? `${winnerPos.y - 43}vh` : '-2.5vw', left: potTransferring ? `${winnerPos.x - 50}vw` : '50%', transform: `translate(-50%, -50%) ${potTransferring ? 'scale(0.3)' : 'scale(1)'}`, opacity: potTransferring ? 0 : 1 }}>
                <div className="text-[4vw] font-black text-yellow-400 drop-shadow-[0_0.3vw_1vw_rgba(0,0,0,0.8)] font-mono tracking-tighter leading-none">${Number(currentPotOnTable)}</div>
              </div>
              <div className={`flex gap-2 relative items-center justify-center min-w-[15vw] scale-[1.7]`}>
                  {(community || []).map((c, i) => {
                      const shouldHighlight = isShowdown && isWinnerCalculated && (winning5Ids || []).includes(c.id);
                      return <div key={i} className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] border border-white/40 flex flex-col items-center justify-center font-bold text-slate-950 brightness-110 shadow-2xl transition-all duration-300 ${shouldHighlight ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_#fbbf24] animate-pulse' : 'bg-white'}`}><div className="flex flex-col items-center leading-none"><span className="text-[0.9vw] font-black">{String(c.value)}</span><span className={`text-[1.8vw] mt-[0.1vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{String(c.suit)}</span></div></div>;
                  })}
              </div>
            </div>

            <div style={{ left: '50%', top: '98%', transform: 'translate(-50%, -100%)' }} className={`absolute flex flex-col items-center pointer-events-none w-fit h-fit z-50`}>
              <div className="relative flex items-center justify-center w-[12vw] h-[6vw] overflow-visible">
                  {userSeat && !userSeat.isFolded && phase !== PHASES.IDLE && (
                    <div className="relative flex items-center justify-center w-full h-full scale-[1.5]">
                      {(userSeat.hand || []).map((c, ci) => {
                        const fanOffset = (ci - (userSeat.hand.length - 1) / 2) * 2.5; 
                        const rotation = (ci - (userSeat.hand.length - 1) / 2) * 10; 
                        const shouldHighlightHero = isWinnerHero && (winning5Ids || []).includes(c.id);
                        return <div key={ci} className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] border border-white/40 flex flex-col items-start justify-start p-[0.3vw] font-bold brightness-110 absolute bg-white text-slate-950 shadow-2xl overflow-hidden transition-all duration-300 ${shouldHighlightHero ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_#fbbf24] animate-pulse z-[100]' : 'opacity-100'}`} style={{ transform: `translateX(${fanOffset}vw) rotate(${rotation}deg)`, transformOrigin: 'bottom center', zIndex: shouldHighlightHero ? 200 : ci }}><div className="flex flex-col items-start h-full w-full pl-0.5 pt-0.5 relative leading-none"><span className="text-[1vw] font-black mb-[0.1vw]">{String(c.value)}</span><span className={`text-[1.5vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-950'}`}>{String(c.suit)}</span></div></div>;
                      })}
                    </div>
                  )}
              </div>
              {getCurrentStrength(userSeat) && !isShowdown && phase !== PHASES.IDLE && (<div className="z-[5001] h-7 px-3 py-1 bg-purple-600/95 border border-purple-300/30 rounded-full shadow-[0_0_2vw_rgba(147,51,234,0.6)] animate-in fade-in zoom-in whitespace-nowrap pointer-events-auto transition-all flex items-center relative -mt-3 mb-1"><span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">{String(getCurrentStrength(userSeat))}</span></div>)}
              {userSeat && (<div className={`flex items-center gap-[0.5vw] p-[0.6vw] px-[2.5vw] rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl transition-all duration-300 relative pointer-events-auto z-50 ${userSeat.isWinner && isShowdown ? (potTransferring ? 'border-yellow-400 scale-125 shadow-[0_0_3vw_#fbbf24]' : 'border-yellow-400 scale-110 shadow-[0_0_2vw_#fbbf24]') : 'border-white/10'}`}><div className="flex flex-col items-center">{userSeat.isAllIn && !userSeat.isFolded && (<div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white animate-pulse">All-In</div>)}<div className="flex items-center gap-2">{userSeat.isDealer && <div className="w-[0.8vw] h-[0.8vw] bg-red-600 rounded-full animate-pulse" />}<span className="text-[1.2vw] font-black text-white leading-none uppercase tracking-widest">{String(userSeat.name)}</span></div><span className={`text-[1.3vw] font-mono font-black mt-1 transition-all duration-500 ${userSeat.isWinner && isShowdown ? 'text-emerald-400' : 'text-emerald-500/80'}`}>${Number(userSeat.chips)}</span></div></div>)}
            </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-[200px] bg-black/40 backdrop-blur-3xl border-t border-white/10 z-[6000] flex flex-row items-end gap-0 pointer-events-none text-white">
        <div className="flex-1 h-full bg-white/5 border-r border-white/10 p-6 flex flex-col pointer-events-auto overflow-hidden">
          <div className="flex items-center gap-2 text-slate-400 uppercase font-black text-sm mb-4 tracking-[0.2em] border-b border-white/10 pb-3"><Info size={18}/> INTELLIGENCE FEED</div>
          <div className="flex-1 font-mono text-xs leading-4 space-y-0 overflow-y-auto pr-2 scrollbar-hide flex flex-col">
            {logs.map((l) => (<div key={l.id} className="py-0.5 border-b border-white/5 flex gap-3 h-4 items-center flex-shrink-0"><span className="text-slate-500 shrink-0">[{String(l.time)}]</span><span className={l.type === 'system' ? 'text-yellow-400 font-black uppercase' : (l.type === 'win' ? 'text-yellow-400 font-black' : 'text-cyan-400 font-black')}>{l.name ? String(l.name) : ""}</span><span className={l.type === 'win' ? 'text-yellow-400 font-bold uppercase' : (l.type === 'system' ? 'text-yellow-400 font-black uppercase' : 'text-slate-300')}>{String(l.action)} {l.amount ? `$${l.amount}` : ''}</span></div>))}
          </div>
        </div>
        <div className="flex-1 h-full bg-white/5 flex flex-col justify-between py-6 px-10 pointer-events-auto relative shadow-inner overflow-hidden">
          {isHeroTurn ? (
            <div className="flex flex-col justify-between items-center w-full h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex gap-4 justify-center items-center w-full mt-0"><span className="text-sm font-black uppercase tracking-widest text-slate-500 mr-2">Quick Bet</span><div className="flex gap-4"><button onClick={() => handleAction('RAISE', Math.min(maxAllIn, Math.floor(currentPotOnTable * 0.5 + highestBet)))} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase text-slate-300 hover:brightness-125 transition-all flex items-center justify-center">1/2 POT</button><button onClick={() => handleAction('RAISE', Math.min(maxAllIn, Math.floor(currentPotOnTable + highestBet)))} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase text-[#fbbf24] hover:brightness-125 transition-all flex items-center justify-center">POT</button><button onClick={() => handleAction('RAISE', maxAllIn)} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-xs font-black uppercase text-red-500 hover:brightness-125 transition-all flex items-center justify-center">MAX</button></div></div>
              <div className="flex items-center justify-between gap-0 w-full px-4 flex-1"><div className="flex-1 flex items-center h-12 pr-4"><input type="range" min={minRaiseTo} max={maxAllIn} step="10" value={raiseAmount} onChange={(e) => setRaiseAmount(Number(e.target.value))} className="gold-slider" /></div><div className="w-32 h-10 relative flex items-center bg-[#06080c] border border-white/10 rounded-lg px-3 group focus-within:border-[#fbbf24] transition-all"><span className="text-[#fbbf24] font-black mr-1 text-sm">$</span><input type="number" value={raiseAmount} onChange={(e) => setRaiseAmount(Math.max(0, Math.min(maxAllIn, parseInt(e.target.value) || 0)))} className="bg-transparent border-none outline-none text-[#fbbf24] font-mono font-black w-full text-base" /></div></div>
              <div className="flex items-center justify-center gap-8 w-full mb-0"><button onClick={() => handleAction('FOLD')} className="w-32 h-12 bg-red-950/40 border border-red-500/50 rounded-full font-black text-sm uppercase tracking-[0.15em] text-red-400 hover:brightness-125 shadow-lg">FOLD</button><button onClick={() => handleAction('CALL')} className="w-48 h-12 bg-blue-950/40 border border-blue-500/50 rounded-full font-black text-base uppercase tracking-[0.15em] text-blue-400 hover:brightness-125 shadow-lg">{highestBet > (userSeat?.currentBet || 0) ? 'CALL' : 'CHECK'}</button><button onClick={() => handleAction('RAISE', raiseAmount)} className="w-32 h-12 bg-emerald-950/40 border border-emerald-500/50 rounded-full font-black text-sm uppercase tracking-[0.15em] text-emerald-400 hover:brightness-125 gap-2 shadow-lg"><Zap size={20}/> RAISE</button></div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 opacity-80 h-full">
               <Target size={48} className={phase === PHASES.IDLE && activeTables.length > 0 ? "text-[#22d3ee] animate-pulse" : "text-slate-600"}/>
               <span className={`font-black uppercase text-[#fbbf24] animate-pulse text-[1.5vw] tracking-[0.2em]`}>
                 {phase === PHASES.IDLE && activeTables.length > 0 ? "DEALING" : (isShowdown ? "REVEAL" : activeIdx !== -1 && players[activeIdx] ? (players[activeIdx].uid === userProfile?.uid ? "YOUR TURN" : `${players[activeIdx].name.toUpperCase()}'S TURN`) : "WAITING")}
               </span>
            </div>
          )}
        </div>
      </footer>
      <style dangerouslySetInnerHTML={{ __html: `.gold-slider { -webkit-appearance: none; background: transparent; width: 100%; } .gold-slider::-webkit-slider-runnable-track { height: 4px; background: #fbbf24; border-radius: 4px; } .gold-slider::-webkit-slider-thumb { -webkit-appearance: none; height: 38px; width: 38px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 30px #fbbf24, inset 0 0 10px rgba(255,255,255,0.8); cursor: pointer; margin-top: -17px; transition: all 0.2s; } .scrollbar-hide::-webkit-scrollbar { display: none; }`}} />
    </div>
  );
};

export default App;
