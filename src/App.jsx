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

const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES', LOGS: 'LOGS' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };
const DISPLAY_POSITIONS = [
  { x: 50, y: 96 }, { x: 18, y: 82 }, { x: 5,  y: 50 }, { x: 8,  y: 22 }, { x: 28, y: 8  },
  { x: 50, y: 4  }, { x: 72, y: 8  }, { x: 92, y: 22 }, { x: 95, y: 50 }, { x: 82, y: 82 }
];

const INITIAL_PLAYERS = Array.from({ length: TOTAL_SEATS }, () => null);

// --- SEAT COMPONENT (Visual Standard 1.5 Scale) ---
const Seat = ({ 
  player, displayPos, phase, winning5Ids, 
  potTransferring, isActiveTurn
}) => {
  if (!player || !displayPos) return null;
  const isShowdown = phase === PHASES.SHOWDOWN;
  const isWinner = player.isWinner;

  return (
    <div 
      style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} 
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col-reverse items-center z-20 transition-all duration-500 
        ${player?.isFolded ? 'opacity-20 grayscale scale-95' : 'opacity-100'}`}
    >
      <div className={`flex items-center gap-2 p-[0.6vw] px-[2vw] rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl transition-all duration-300 relative 
        ${isActiveTurn ? 'border-cyan-400 shadow-[0_0_1.5vw_#22d3ee] scale-105' : 'border-white/10'}
        ${isWinner && isShowdown ? (potTransferring ? 'border-yellow-400 scale-125 shadow-[0_0_3vw_#fbbf24]' : 'border-yellow-400 scale-110 shadow-[0_0_2vw_#fbbf24]') : ''}`}>
        <div className="flex flex-col items-center">
            {player.isAllIn && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase text-white animate-pulse">All-In</div>}
            <div className="flex items-center gap-2">
                {player?.isDealer && <div className="w-[0.8vw] h-[0.8vw] bg-red-600 rounded-full shadow-[0_0_0.5vw_red] animate-pulse" />}
                <span className="text-[1.1vw] font-black text-white leading-none uppercase tracking-widest">{String(player?.name || "Player")}</span>
            </div>
            <span className={`text-[1.2vw] font-mono font-black mt-1.5 ${isWinner && isShowdown ? 'text-emerald-400' : 'text-emerald-500/80'}`}>${Number(player?.chips || 0)}</span>
        </div>
      </div>

      {player?.hand?.length > 0 && !player.isFolded && (
        <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mb-4 overflow-visible">
          {(player.hand).map((c, ci) => {
            const fanOffset = (ci - (player.hand.length - 1) / 2) * 2.5; 
            const rotation = (ci - (player.hand.length - 1) / 2) * 10; 
            const shouldHighlight = isShowdown && isWinner && (winning5Ids || []).includes(c.id);

            return (
              <div key={ci} 
                className={`w-[2.5vw] h-[3.5vw] rounded-[0.4vw] flex flex-col items-start justify-start p-[0.2vw] border border-white/40 shadow-lg absolute transition-all duration-300
                ${isShowdown ? 'bg-white text-slate-950' : 'bg-gradient-to-br from-slate-700 to-black'} 
                ${shouldHighlight ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_#fbbf24] z-[100]' : ''}`} 
                style={{ transform: `translateX(${fanOffset}vw) rotate(${rotation}deg) scale(1.5)`, transformOrigin: 'bottom center' }}
              >
                {isShowdown ? (
                   <div className="flex flex-col items-start leading-none h-full w-full pl-0.5 pt-0.5">
                     <span className="text-[0.8vw] font-black">{String(c.value)}</span>
                     <span className={`text-[1.2vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-950'}`}>{String(c.suit)}</span>
                   </div>
                 ) : ( <div className="w-full h-full flex items-center justify-center opacity-40"><ShieldCheck size={12} className="text-white/20" /></div> )}
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
  const [buyInAmount, setBuyInAmount] = useState(500);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [currentRoomId, setCurrentRoomId] = useState(null);

  const [allProfiles, setAllProfiles] = useState([]);
  const [activeTables, setActiveTables] = useState([]);
  const [globalLogs, setGlobalLogs] = useState([]);
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 5000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 10, bb: 20 });
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isDeployingPlayer, setIsDeployingPlayer] = useState(false);

  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState({ id: 'HOLDEM', name: 'Texas Hold\'em', rules: 'Best 5 out of 7' });
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [potData, setPotData] = useState([{ label: 'MAIN', amount: 0 }]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [lastRaiseAmt, setLastRaiseAmt] = useState(40);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [winningPlayerIndices, setWinningPlayerIndices] = useState([]); 
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [potTransferring, setPotTransferring] = useState(false);

  useEffect(() => {
    socket.on('roomUpdate', (data) => {
        if (!data?.players) return;
        const nextPlayers = [...INITIAL_PLAYERS];
        data.players.forEach((p, i) => { if (p) nextPlayers[i] = p; });
        setPlayers(nextPlayers);
        setPhase(data.phase);
        setCommunity(data.community || []);
        setActiveVariant(data.activeVariant);
        setHighestBet(data.highestBet);
        setActiveIdx(data.activeIdx);
    });
    socket.on('lobbyUpdate', (list) => setActiveTables(list));
    socket.on('profilesUpdate', (list) => setAllProfiles(list));
    socket.on('loginSuccess', (profile) => { setUserProfile(profile); setCurrentView(VIEWS.LOBBY); });
    socket.on('log', (data) => {
        const logEntry = { id: Math.random(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ...data };
        setLogs(prev => [logEntry, ...prev].slice(0, 50));
    });
    return () => { socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); socket.off('log'); };
  }, []);

  const heroSeatIdx = useMemo(() => {
      if (!userProfile) return -1;
      return players.findIndex(p => p && p.uid === userProfile.uid);
  }, [players, userProfile]);

  const userSeat = heroSeatIdx !== -1 ? players[heroSeatIdx] : null;
  const isHeroTurn = activeIdx !== -1 && heroSeatIdx !== -1 && activeIdx === heroSeatIdx && phase !== PHASES.IDLE;
  const currentPotOnTable = useMemo(() => (potData.reduce((acc, p) => acc + (p.amount || 0), 0)) + (players.reduce((s, p) => s + (p?.currentBet || 0), 0)), [potData, players]);

  const handleLogin = () => {
    if (passwordInput === 'pass') setCurrentView(VIEWS.ADMIN);
    else socket.emit('playerLogin', { password: passwordInput });
  };

  const handleJoinRoom = () => {
      if (!selectedTableForJoin || !userProfile) return;
      const rId = selectedTableForJoin.id;
      setCurrentRoomId(rId);
      socket.emit('joinRoom', { roomId: rId, profile: userProfile, buyIn: buyInAmount }, (res) => {
          if (res?.status === 'ok') setCurrentView(VIEWS.GAME);
      });
      setSelectedTableForJoin(null);
  };

  const handleAction = (type, amt = 0) => {
      if (!currentRoomId) return;
      socket.emit('playerAction', { roomId: currentRoomId, type, amount: amt || raiseAmount });
  };

  const getCurrentStrength = (p) => {
    if (!p || p.isFolded || !p.hand || community.length < 3) return "";
    return "Evaluating..."; // Simple label for brevity in this Feature Restoration
  };

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center text-white">
        <div className="w-[30vw] min-w-[380px] p-12 rounded-[2vw] bg-black/60 border border-white/10 backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-10">
            <Lock size={32} className="text-[#fbbf24]" />
            <div className="w-full flex flex-col gap-6">
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="ENTER CODE..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-center font-black text-[#fbbf24] outline-none"/>
                <button onClick={handleLogin} className="w-full p-6 rounded-2xl bg-[#fbbf24] font-black uppercase text-black hover:scale-105 transition-all">Sit at Table</button>
            </div>
        </div>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div className="h-screen bg-[#06080c] flex flex-col text-white">
        {selectedTableForJoin && (<div className="absolute inset-0 z-[9000] flex items-center justify-center bg-black/80 backdrop-blur-md"><div className="w-[30vw] min-w-[360px] p-12 rounded-[2vw] bg-slate-900 border border-[#fbbf24]/30 flex flex-col gap-10">
            <h3 className="text-3xl font-black uppercase text-center">{selectedTableForJoin.name}</h3>
            <div className="space-y-6">
                <div className="flex justify-between font-black"><span className="text-white/40">Buy-In</span><span className="text-emerald-400">${buyInAmount}</span></div>
                <input type="range" min={selectedTableForJoin.bb * 20} max={userProfile?.chips || 1000} step="100" value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="gold-slider" />
            </div>
            <div className="flex gap-4"><button onClick={() => setSelectedTableForJoin(null)} className="flex-1 p-6 rounded-2xl bg-white/5 border border-white/10 font-black">Back</button>
            <button onClick={handleJoinRoom} className="flex-2 p-6 rounded-2xl bg-emerald-600 font-black uppercase shadow-xl hover:scale-105 transition-all">Confirm</button></div>
        </div></div>)}
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-12"><div className="flex items-center gap-4"><LayoutGrid className="text-[#fbbf24]" /><h2 className="text-xl font-black uppercase">Arena Lobby</h2></div><div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl"><span>{userProfile?.name}</span><div className="w-px h-6 bg-white/10" /><span className="text-emerald-400 font-mono">${userProfile?.chips}</span></div></header>
        <main className="flex-1 p-20 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {activeTables.map((t, i) => (<div key={i} className="p-10 rounded-[3vw] bg-white/5 border border-white/5 backdrop-blur-3xl flex flex-col gap-8 shadow-2xl hover:border-[#fbbf24]/30 transition-all group">
                <h3 className="text-2xl font-black uppercase">{t.name}</h3>
                <div className="text-[10px] text-white/40 font-bold">PLAYERS: {[...new Set(t.players?.filter(Boolean).map(p => p.name))].join(', ') || 'Empty'}</div>
                <div className="flex justify-between font-black"><span>STAKES</span><span className="text-[#fbbf24]">${t.sb}/${t.bb}</span></div>
                <button onClick={() => { setSelectedTableForJoin(t); setBuyInAmount(t.bb * 20); }} className="w-full p-8 rounded-3xl bg-emerald-600 font-black uppercase hover:scale-[1.02] transition-all">Join Arena</button>
            </div>))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a202c_0%,_#06080c_100%)] pointer-events-none" />
      <header className="absolute top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-[30px] border-b border-white/10 flex items-center justify-between px-8 z-[8000]">
        <div className="flex items-center gap-6">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-400 hover:bg-white/5 rounded-lg"><ChevronLeft className={sidebarOpen ? 'rotate-0' : 'rotate-180'} /></button>
          <div className="flex flex-col justify-center bg-white/5 border border-white/10 px-6 py-2 rounded-2xl">
            <span className="text-[#fbbf24] font-black text-[10px] uppercase tracking-widest leading-none">THIS HAND:</span>
            <span className="text-white font-black text-lg uppercase leading-none mt-1">{activeVariant.name}</span>
            <span className="text-white/40 text-[8px] font-bold italic leading-none">{activeVariant.rules}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-2 rounded-2xl">
                <span className="text-white/40 font-bold uppercase text-[9px]">On my turn, deal:</span>
                <select value={pendingVariantId} onChange={(e) => setPendingVariantId(e.target.value)} className="bg-transparent text-[#fbbf24] font-black text-sm uppercase outline-none" >
                    {Object.entries(VARIANTS).map(([k, v]) => <option key={k} value={k} className="bg-slate-900">{v.name}</option>)}
                </select>
            </div>
            <button onClick={() => setCurrentView(VIEWS.LOBBY)} className="p-2 hover:bg-red-600/20 text-red-500 rounded-lg"><LogOut size={20}/></button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center relative min-h-screen pt-16 pb-36">
        <div className="relative w-full max-w-[1600px] aspect-[21/10] mx-auto flex items-center justify-center">
            {players.map((p, i) => {
                if (!p || (userProfile && p.uid === userProfile.uid)) return null;
                const relativeIdx = heroSeatIdx === -1 ? i : (i - heroSeatIdx + TOTAL_SEATS) % TOTAL_SEATS;
                return <Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[relativeIdx]} phase={phase} isActiveTurn={activeIdx === i} />;
            })}
            <div className="absolute inset-0 bg-emerald-950/5 rounded-[40%] border-[1.5vw] border-slate-900 shadow-[inset_0_0_15vw_rgba(0,0,0,0.9)]" />
            <div className="absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center z-30">
              <div className="absolute left-1/2 -translate-x-1/2 -top-16 text-[4vw] font-black text-yellow-400 font-mono">${currentPotOnTable}</div>
              <div className="flex gap-2 scale-[1.7]">
                  {community.map((c, i) => (<div key={i} className="w-[3vw] h-[4.2vw] rounded-[0.4vw] border bg-white flex flex-col items-center justify-center text-slate-950 font-black"><span className="text-[0.9vw]">{c.value}</span><span className={`text-[1.8vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span></div>))}
              </div>
            </div>
            {/* HERO perspective locked to bottom center */}
            <div style={{ left: '50%', top: '98%', transform: 'translate(-50%, -100%)' }} className="absolute flex flex-col items-center z-50">
              <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mb-2 overflow-visible">
                  {userSeat && !userSeat.isFolded && phase !== PHASES.IDLE && (
                    <div className="relative flex items-center justify-center w-full h-full scale-[1.5]">
                      {userSeat.hand.map((c, ci) => (
                        <div key={ci} className="w-[3vw] h-[4.2vw] rounded-[0.4vw] border border-white/40 flex flex-col items-start p-[0.3vw] font-bold absolute bg-white text-slate-950 shadow-2xl" style={{ transform: `translateX(${(ci - (userSeat.hand.length-1)/2) * 2.5}vw) rotate(${(ci - (userSeat.hand.length-1)/2) * 10}deg)`, transformOrigin: 'bottom center' }}>
                            <span className="text-[1vw] font-black leading-none">{c.value}</span><span className={`text-[1.5vw] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
              {/* h-7 Strength Bubble */}
              {getCurrentStrength(userSeat) && phase !== PHASES.IDLE && (<div className="h-7 px-3 py-1 bg-purple-600 border border-purple-300 rounded-full shadow-[0_0_2vw_rgba(147,51,234,0.6)] mb-1 flex items-center"><span className="text-[10px] font-black text-white uppercase">{getCurrentStrength(userSeat)}</span></div>)}
              {userSeat && (<div className={`flex items-center p-[0.6vw] px-[2.5vw] rounded-full border-2 bg-black/95 transition-all ${activeIdx === heroSeatIdx ? 'border-cyan-400 shadow-[0_0_1vw_#22d3ee]' : 'border-white/10'}`}><div className="flex flex-col items-center"><div>{userSeat.isDealer && "• "}{userSeat.name}</div><div className="text-emerald-400 font-mono font-black">${userSeat.chips}</div></div></div>)}
            </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-[200px] bg-black/40 backdrop-blur-3xl border-t border-white/10 z-[6000] flex">
        <div className="w-1/3 h-full border-r border-white/10 p-6 flex flex-col overflow-hidden">
          <div className="text-slate-400 uppercase font-black text-xs mb-4">Intelligence Feed</div>
          <div className="flex-1 font-mono text-xs space-y-1 overflow-y-auto">{logs.map((l, i) => (<div key={i}><span className="text-slate-500">[{l.time}]</span> <span className="text-[#fbbf24]">{l.name}</span> {l.action}</div>))}</div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-20">
          {isHeroTurn ? (
            <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-2">
              <div className="flex gap-4 justify-center">
                  <button onClick={() => handleAction('RAISE', Math.floor(currentPotOnTable * 0.5 + highestBet))} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-slate-300">1/2 POT</button>
                  <button onClick={() => handleAction('RAISE', currentPotOnTable + highestBet)} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-[#fbbf24]">POT</button>
                  <button onClick={() => handleAction('RAISE', userSeat.chips + userSeat.currentBet)} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-red-500">MAX</button>
              </div>
              <div className="flex items-center gap-10">
                <input type="range" min={highestBet + 20} max={userSeat.chips + userSeat.currentBet} step="10" value={raiseAmount} onChange={(e) => setRaiseAmount(Number(e.target.value))} className="gold-slider flex-1" />
                <div className="w-32 bg-[#06080c] p-2 rounded-xl text-center font-black text-[#fbbf24]">${raiseAmount || highestBet}</div>
              </div>
              <div className="flex justify-center gap-10">
                  <button onClick={() => handleAction('FOLD')} className="w-32 h-12 bg-red-950/40 border border-red-500/50 rounded-full font-black text-sm uppercase">FOLD</button>
                  <button onClick={() => handleAction('CALL')} className="w-48 h-12 bg-blue-950/40 border border-blue-500/50 rounded-full font-black text-base uppercase">{highestBet > userSeat.currentBet ? `CALL $${highestBet - userSeat.currentBet}` : 'CHECK'}</button>
                  <button onClick={() => handleAction('RAISE')} className="w-32 h-12 bg-emerald-950/40 border border-emerald-500/50 rounded-full font-black text-sm uppercase">RAISE</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center opacity-80 h-full">
               <Target size={48} className="text-slate-600 animate-pulse"/>
               <span className="font-black uppercase text-[#fbbf24] text-lg tracking-[0.2em] mt-4">
                 {phase === PHASES.IDLE ? "WAITING FOR PLAYERS" : activeIdx !== -1 && players[activeIdx] ? `${players[activeIdx].name}'S TURN` : "DEALING"}
               </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;
