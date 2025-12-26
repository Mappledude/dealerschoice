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

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2, rules: "Best 5 out of 7 cards" }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA', holeCards: 4, rules: "Use EXACTLY 2 hand + 3 board cards!" }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3, rules: "3 hole cards dealt; discard 1 after flop." }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2, rules: "LOWEST ranked hand wins the pot!" } 
};

const INITIAL_PLAYERS = Array.from({ length: TOTAL_SEATS }, () => null);

// --- SEAT COMPONENT (1.5 Scale Restored) ---
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
                className={`w-[2.5vw] h-[3.5vw] rounded-[0.4vw] flex flex-col items-start justify-start p-[0.2vw] border border-white/40 shadow-lg absolute 
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
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 5000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 10, bb: 20 });
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isDeployingPlayer, setIsDeployingPlayer] = useState(false);

  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [potData, setPotData] = useState([{ amount: 0 }]);
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
        setActiveVariant(data.activeVariant || VARIANTS.HOLDEM);
        setHighestBet(data.highestBet || 0);
        setActiveIdx(data.activeIdx);
        setPotData(data.potData || [{ amount: 0 }]);
        
        if (data.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true);
            setTimeout(() => setPotTransferring(false), 3000);
        }
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

  // --- HANDLERS ---
  const handleLogin = () => {
    // STRICT ADMIN ROUTING
    if (passwordInput === 'pass') {
        setCurrentView(VIEWS.ADMIN);
    } else {
        socket.emit('playerLogin', { password: passwordInput });
    }
  };

  const handleJoinRoom = () => {
      if (!selectedTableForJoin || !userProfile) return;
      const rId = selectedTableForJoin.id;
      setCurrentRoomId(rId);
      socket.emit('joinRoom', { roomId: rId, profile: userProfile, buyIn: 500 }, (res) => {
          if (res?.status === 'ok') setCurrentView(VIEWS.GAME);
      });
      setSelectedTableForJoin(null);
  };

  const handleAction = (type, amt = 0) => {
      if (!currentRoomId) return;
      socket.emit('playerAction', { roomId: currentRoomId, type, amount: amt || raiseAmount });
  };

  const winnerIdx = useMemo(() => players.findIndex(p => p?.isWinner), [players]);
  const winnerPos = useMemo(() => {
    if (winnerIdx === -1) return DISPLAY_POSITIONS[0];
    const relativeIdx = heroSeatIdx === -1 ? winnerIdx : (winnerIdx - heroSeatIdx + TOTAL_SEATS) % TOTAL_SEATS;
    return DISPLAY_POSITIONS[relativeIdx];
  }, [winnerIdx, heroSeatIdx]);

  // --- VIEWS ---
  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center text-white">
        <div className="w-[30vw] min-w-[380px] p-12 rounded-[2vw] bg-black/60 border border-white/10 backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-10">
            <Lock size={32} className="text-[#fbbf24]" />
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="ENTER CODE..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-center font-black text-[#fbbf24] outline-none uppercase tracking-widest"/>
            <button onClick={handleLogin} className="w-full p-6 rounded-2xl bg-[#fbbf24] font-black uppercase text-black hover:scale-105 transition-all tracking-widest">Sit at Table</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex relative overflow-hidden text-white font-sans">
        <aside className="w-72 bg-[#0f172a] border-r border-white/10 flex flex-col z-[100]">
            <div className="p-8 border-b border-white/5 mb-8 text-[#fbbf24] flex items-center gap-3">
                <ShieldAlert size={20} /><span className="font-black uppercase tracking-widest text-sm">Super Admin</span>
            </div>
            <nav className="flex-1 px-4 flex flex-col gap-2">
                <button onClick={() => setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'text-white/40 hover:bg-white/5'}`}><Users size={18}/> Registry</button>
                <button onClick={() => setAdminTab(ADMIN_TABS.TABLES)} className={`flex items-center gap-4 p-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'text-white/40 hover:bg-white/5'}`}><Layers size={18}/> Control</button>
            </nav>
            <div className="p-8 mt-auto border-t border-white/5"><button onClick={() => setCurrentView(VIEWS.LOGIN)} className="flex items-center gap-4 text-white/40 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors"><ArrowLeft size={16}/> Logout</button></div>
        </aside>
        <main className="flex-1 flex flex-col p-12 overflow-y-auto relative z-10">
            {isAddingPlayer && (<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="w-[25vw] min-w-[320px] bg-slate-900 border border-white/10 rounded-[1.5vw] p-8 shadow-2xl flex flex-col gap-6 text-white"><h3 className="text-xl font-black uppercase tracking-widest flex items-center gap-3"><UserPlus size={20} className="text-indigo-400"/> Provision Profile</h3><div className="flex flex-col gap-4 text-slate-950"><input value={newPlayer.name} onChange={e => setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="w-full bg-white p-4 rounded-xl text-xs font-black uppercase outline-none"/><input type="number" value={newPlayer.chips} onChange={e => setNewPlayer({...newPlayer, chips: Number(e.target.value)})} placeholder="CHIPS" className="w-full bg-white p-4 rounded-xl text-xs font-black outline-none"/><input value={newPlayer.password} onChange={e => setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASSCODE" className="w-full bg-white p-4 rounded-xl text-xs font-black outline-none"/></div><div className="flex gap-4"><button onClick={() => setIsAddingPlayer(false)} className="flex-1 p-4 rounded-xl bg-white/5 font-black uppercase text-[10px]">Cancel</button><button disabled={isDeployingPlayer} onClick={() => {
                const uid = Math.random().toString(36).substr(2, 9);
                socket.emit('adminCreatePlayer', {...newPlayer, uid, id: uid}, () => setIsAddingPlayer(false));
            }} className="flex-2 p-4 rounded-xl bg-indigo-600 font-black uppercase text-[10px] tracking-widest">Confirm</button></div></div></div>)}
            
            {adminTab === ADMIN_TABS.PLAYERS && (<div className="flex flex-col gap-8 animate-in fade-in"><div className="flex items-center justify-between border-b border-white/10 pb-6"><h2 className="text-2xl font-black uppercase tracking-widest text-white">Registry</h2><button onClick={() => setIsAddingPlayer(true)} className="flex items-center gap-3 p-4 px-8 bg-[#fbbf24] text-black rounded-2xl font-black uppercase text-xs shadow-xl"><PlusCircle size={18}/> New Profile</button></div><div className="bg-white/5 border border-white/10 rounded-[2vw] overflow-hidden"><table className="w-full text-left border-collapse"><thead className="bg-white/5 border-b border-white/10"><tr className="text-[10px] font-black uppercase tracking-widest text-white/40"><th className="p-6">Identification</th><th className="p-6">Bankroll</th><th className="p-6 text-right">Utility</th></tr></thead><tbody>{allProfiles.map((p, i) => (<tr key={i} className="border-b border-white/5"><td className="p-6 font-black uppercase text-sm">{String(p.name)} <span className="text-[8px] opacity-20 block">UID: {String(p.uid)}</span></td><td className="p-6 font-mono font-black text-emerald-400">${Number(p.chips).toLocaleString()}</td><td className="p-6 text-right"><button onClick={() => socket.emit('adminDeletePlayer', p.uid)} className="p-2 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"><Trash2 size={14}/></button></td></tr>))}</tbody></table></div></div>)}
            
            {adminTab === ADMIN_TABS.TABLES && (
                <div className="flex flex-col gap-8 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-white/10 pb-6"><h2 className="text-2xl font-black uppercase tracking-widest text-white">Room Control</h2><button onClick={() => { if(window.confirm("HARD RESET?")) socket.emit('adminNuclearReset'); }} className="p-4 px-8 bg-red-600 border border-red-500 rounded-2xl font-black uppercase text-xs">Nuclear Reset</button></div>
                    <section className="bg-white/5 p-8 rounded-[2vw] border border-white/10 shadow-2xl flex flex-col gap-6">
                        <h3 className="text-lg font-black uppercase text-[#fbbf24]">Deploy Room</h3>
                        <div className="flex gap-4"><input value={newTable.name} onChange={e => setNewTable({...newTable, name: e.target.value})} placeholder="ROOM NAME" className="flex-1 bg-white p-4 rounded-xl text-xs font-black uppercase text-slate-950 outline-none"/><button onClick={() => { socket.emit('adminCreateRoom', {...newTable, id: 'room_'+Math.random().toString(36).substr(2,9)}); setNewTable({name:'', sb:10, bb:20}); }} className="p-4 bg-emerald-600 rounded-xl font-black px-10">Spawn Arena</button></div>
                    </section>
                    <div className="grid grid-cols-2 gap-6">{activeTables.map((t, i) => (<div key={i} className="p-8 bg-black/40 border border-white/10 rounded-2xl flex flex-col gap-6"><div className="flex justify-between font-black uppercase"><div className="text-xl text-[#fbbf24]">{t.name}</div><div>${t.sb}/${t.bb}</div></div><div className="flex gap-4"><button onClick={() => socket.emit('adminForceDeal', t.id)} className="flex-1 p-3 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 rounded-xl font-black uppercase text-[10px]">Force Deal</button><button onClick={() => socket.emit('adminDeleteRoom', t.id)} className="flex-1 p-3 bg-red-600/10 border border-red-500/30 text-red-500 rounded-xl font-black uppercase text-[10px]">Terminate</button></div></div>))}</div>
                </div>
            )}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-sans">
      <header className="h-16 bg-black/30 backdrop-blur-[30px] border-b border-white/10 flex items-center justify-between px-8 z-[8000]">
        <div className="flex flex-col justify-center bg-white/5 px-6 py-2 rounded-2xl">
          <span className="text-[#fbbf24] font-black text-[10px] tracking-widest uppercase">THIS HAND:</span>
          <span className="text-white font-black text-lg uppercase leading-none mt-1">{String(activeVariant?.name || "Texas Hold'em")}</span>
          <span className="text-white/40 text-[8px] font-bold italic">{String(activeVariant?.rules || "")}</span>
        </div>
        <button onClick={() => setCurrentView(VIEWS.LOBBY)} className="p-2 hover:bg-red-600/20 text-red-500 rounded-lg transition-all"><LogOut size={20}/></button>
      </header>

      <main className="flex-1 flex items-center justify-center relative min-h-screen">
        <div className="relative w-full max-w-[1600px] aspect-[21/10] mx-auto flex items-center justify-center">
            {players.map((p, i) => {
                if (!p || (userProfile && p.uid === userProfile.uid)) return null;
                const relativeIdx = heroSeatIdx === -1 ? i : (i - heroSeatIdx + TOTAL_SEATS) % TOTAL_SEATS;
                return <Seat key={i} player={p} displayPos={DISPLAY_POSITIONS[relativeIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} />;
            })}
            <div className="absolute inset-0 bg-emerald-950/5 rounded-[40%] border-[1.5vw] border-slate-900 shadow-[inset_0_0_15vw_rgba(0,0,0,0.9)]" />
            <div className="absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center z-30 pointer-events-none">
              <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-[800ms]`} style={{ top: potTransferring ? `${winnerPos.y - 43}vh` : '-4vw', left: potTransferring ? `${winnerPos.x - 50}vw` : '50%', transform: `translate(-50%, -50%) ${potTransferring ? 'scale(0.3)' : 'scale(1)'}`, opacity: potTransferring ? 0 : 1 }}>
                <div className="text-[4vw] font-black text-yellow-400 font-mono tracking-tighter">${Number(currentPotOnTable)}</div>
              </div>
              <div className="flex gap-2 scale-[1.7]">
                  {community.map((c, i) => (<div key={i} className="w-[3vw] h-[4.2vw] rounded-[0.4vw] border bg-white flex flex-col items-center justify-center text-slate-950 font-black"><span className="text-[0.9vw]">{c.value}</span><span className={`text-[1.8vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span></div>))}
              </div>
            </div>
            
            <div style={{ left: '50%', top: '98%', transform: 'translate(-50%, -100%)' }} className="absolute flex flex-col items-center z-50">
              <div className="relative flex items-center justify-center w-[12vw] h-[6vw] mb-2 overflow-visible">
                  {userSeat && !userSeat.isFolded && phase !== PHASES.IDLE && (
                    <div className="relative flex items-center justify-center w-full h-full scale-[1.5]">
                      {userSeat.hand.map((c, ci) => (
                        <div key={ci} className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] border border-white/40 flex flex-col items-start p-[0.3vw] font-bold absolute bg-white text-slate-950 shadow-2xl transition-all duration-300 ${isWinnerHero && phase === PHASES.SHOWDOWN ? 'ring-4 ring-yellow-400' : ''}`} style={{ transform: `translateX(${(ci - (userSeat.hand.length-1)/2) * 2.5}vw) rotate(${(ci - (userSeat.hand.length-1)/2) * 10}deg)`, transformOrigin: 'bottom center' }}>
                            <span className="text-[1vw] font-black leading-none">{c.value}</span><span className={`text-[1.5vw] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
              {userSeat && !isShowdown && phase !== PHASES.IDLE && (<div className="h-7 px-3 py-1 bg-purple-600 border border-purple-300 rounded-full shadow-[0_0_2vw_rgba(147,51,234,0.6)] mb-1 flex items-center"><span className="text-[10px] font-black text-white uppercase tracking-widest">Evaluating...</span></div>)}
              {userSeat && (<div className={`flex items-center p-[0.6vw] px-[2.5vw] rounded-full border-2 bg-black/95 transition-all ${activeIdx === heroSeatIdx ? 'border-cyan-400 shadow-[0_0_1vw_#22d3ee]' : 'border-white/10'}`}><div className="flex flex-col items-center"><div>{String(userSeat.name)}</div><div className="text-emerald-400 font-mono font-black">${userSeat.chips}</div></div></div>)}
            </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-[200px] bg-black/40 backdrop-blur-3xl border-t border-white/10 z-[6000] flex">
        <div className="w-1/3 h-full border-r border-white/10 p-6 flex flex-col overflow-hidden">
          <div className="text-slate-400 uppercase font-black text-[10px] tracking-widest mb-4">Intelligence Feed</div>
          <div className="flex-1 font-mono text-[10px] space-y-1 overflow-y-auto">{logs.map((l, i) => (<div key={i}><span className="text-white/20">[{String(l.time)}]</span> <span className="text-[#fbbf24] uppercase">{String(l.name || "ARENA")}</span> <span className="text-white/60 ml-2">{String(l.action)}</span></div>))}</div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-20">
          {isHeroTurn ? (
            <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-2">
              <div className="flex gap-4 justify-center">
                  <button onClick={() => handleAction('RAISE', Math.floor(currentPotOnTable * 0.5 + highestBet))} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-slate-300 hover:bg-white/10 transition-all">1/2 POT</button>
                  <button onClick={() => handleAction('RAISE', currentPotOnTable + highestBet)} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-[#fbbf24] hover:bg-white/10 transition-all">POT</button>
                  <button onClick={() => handleAction('RAISE', userSeat.chips + userSeat.currentBet)} className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-red-500 hover:bg-white/10 transition-all">MAX</button>
              </div>
              <div className="flex items-center gap-10">
                <input type="range" min={highestBet + 20} max={userSeat.chips + userSeat.currentBet} step="10" value={raiseAmount} onChange={(e) => setRaiseAmount(Number(e.target.value))} className="gold-slider flex-1" />
                <div className="w-32 bg-[#06080c] p-2 rounded-xl text-center font-black text-[#fbbf24] border border-white/10 shadow-inner tracking-widest font-mono text-xl">${Number(raiseAmount || highestBet)}</div>
              </div>
              <div className="flex justify-center gap-10">
                  <button onClick={() => handleAction('FOLD')} className="w-32 h-12 bg-red-950/40 border border-red-500/50 rounded-full font-black text-sm uppercase hover:bg-red-600 hover:text-white transition-all">FOLD</button>
                  <button onClick={() => handleAction('CALL')} className="w-48 h-12 bg-blue-950/40 border border-blue-500/50 rounded-full font-black text-base uppercase hover:bg-blue-600 hover:text-white transition-all">{highestBet > userSeat.currentBet ? `CALL $${highestBet - userSeat.currentBet}` : 'CHECK'}</button>
                  <button onClick={() => handleAction('RAISE')} className="w-32 h-12 bg-emerald-950/40 border border-emerald-500/50 rounded-full font-black text-sm uppercase hover:bg-emerald-600 hover:text-white transition-all">RAISE</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center opacity-80 h-full">
               <Target size={48} className="text-slate-600 animate-pulse"/>
               <span className="font-black uppercase text-[#fbbf24] text-lg tracking-[0.2em] mt-4">
                 {phase === PHASES.IDLE ? "WAITING FOR PLAYERS" : activeIdx !== -1 && players[activeIdx] ? `${String(players[activeIdx].name).toUpperCase()}'S TURN` : "WAITING"}
               </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;
