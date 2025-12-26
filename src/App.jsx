import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign
} from 'lucide-react';

// --- LIVE MULTIPLAYER CONFIG ---
const SOCKET_URL = "https://poker-server-3vin.onrender.com"; 
const TOTAL_SEATS = 10;

// ADD THESE BACK: The black screen happens because the UI crashes looking for these
const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2, rules: "Best 5 out of 7 cards" }, 
  OMAHA: { id: 'OMAHA', name: 'Omaha', holeCards: 4, rules: "Use EXACTLY 2 hand + 3 board cards!" }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3, rules: "3 hole cards dealt; discard 1 after flop." }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2, rules: "LOWEST ranked hand wins the pot!" } 
};

const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const SEAT_POSITIONS = [
  { x: 50, y: 96 }, { x: 18, y: 82 }, { x: 5,  y: 50 }, { x: 8,  y: 22 }, { x: 28, y: 8  },
  { x: 50, y: 4  }, { x: 72, y: 8  }, { x: 92, y: 22 }, { x: 95, y: 50 }, { x: 82, y: 82 }
];

// --- SUB-COMPONENTS ---
const Seat = ({ player, index, phase, localId, winning5Ids, potTransferring }) => {
  if (!player || player.userId === localId) return null;
  const pos = SEAT_POSITIONS[index];
  const isShowdown = phase === PHASES.SHOWDOWN;
  const isWinner = player.isWinner;

  return (
    <div 
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }} 
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col-reverse items-center z-20 transition-all duration-1000 
        ${player?.isFolded ? 'opacity-20 grayscale scale-95' : 'opacity-100'}`}
    >
      <div className={`flex items-center gap-2 p-[0.6vw] px-[2vw] rounded-full border-2 bg-black/95 backdrop-blur-xl shadow-2xl transition-all duration-300 relative 
        ${isWinner && isShowdown ? (potTransferring ? 'border-yellow-400 scale-125 shadow-[0_0_3vw_#fbbf24]' : 'border-yellow-400 scale-110 shadow-[0_0_2vw_#fbbf24]') : 'border-white/10'}`}>
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
                {player?.isDealer && <div className="w-[0.8vw] h-[0.8vw] bg-red-600 rounded-full shadow-[0_0_0.5vw_rgba(220,38,38,0.8)] animate-pulse" />}
                <span className="text-[1.1vw] font-black text-white leading-none uppercase tracking-widest whitespace-nowrap">{player?.name}</span>
            </div>
            <span className={`text-[1.2vw] font-mono font-black mt-1.5 ${isWinner && isShowdown ? 'text-emerald-400 animate-pulse' : 'text-emerald-500/80'}`}>${player?.chips}</span>
        </div>
      </div>

      {player?.hand?.length > 0 && !player.isFolded && (
        <div className="flex flex-row items-end justify-center mb-2 overflow-visible relative">
          {player.hand.map((c, ci) => {
            const isWinningCard = (winning5Ids || []).includes(c.id);
            const shouldHighlight = isShowdown && isWinner && isWinningCard;
            return (
              <div key={ci} 
                className={`w-[2.5vw] h-[3.5vw] rounded-[0.4vw] flex flex-col items-start p-[0.2vw] transition-all duration-500 border border-white/40 shadow-lg relative
                ${isShowdown ? 'bg-white text-slate-950' : 'bg-slate-900'} 
                ${shouldHighlight ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_#fbbf24] z-[100]' : ''}`} 
                style={{ transform: `rotate(${(ci - (player.hand.length - 1) / 2) * 5}deg) scale(0.8)`, transformOrigin: 'bottom center', marginLeft: ci > 0 ? '-1.5vw' : '0' }}
              >
                {isShowdown && (
                   <div className="flex flex-col items-start leading-none h-full w-full pl-0.5 pt-0.5 relative">
                     <span className="text-[0.8vw] font-black">{c.value}</span>
                     <span className={`text-[1.2vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span>
                   </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const App = () => {
  const [socket, setSocket] = useState(null);
  const [localId, setLocalId] = useState(null);
  const [players, setPlayers] = useState(Array(TOTAL_SEATS).fill(null));
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [community, setCommunity] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [potData, setPotData] = useState([{ amount: 0 }]);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [winningPlayerIndices, setWinningPlayerIndices] = useState([]);
  const [potTransferring, setPotTransferring] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [highestBet, setHighestBet] = useState(0);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(newSocket);
    newSocket.on('connect', () => {
        setLocalId(newSocket.id);
        newSocket.emit('joinGame', { name: 'Hero' }); // Trigger the first seat
    });
    newSocket.on('gameUpdate', (data) => {
      setPlayers(data.players || Array(TOTAL_SEATS).fill(null));
      setPhase(data.phase || PHASES.IDLE);
      setCommunity(data.community || []);
      setActiveIdx(data.activeIdx ?? -1);
      setPotData(data.potData || [{ amount: 0 }]);
      setWinning5Ids(data.winning5Ids || []);
      setWinningPlayerIndices(data.winningPlayerIndices || []);
      setPotTransferring(data.potTransferring || false);
      setActiveVariant(VARIANTS[data.variantId] || VARIANTS.HOLDEM);
      setHighestBet(data.highestBet || 0);
    });
    newSocket.on('log', (log) => setLogs(prev => [log, ...prev].slice(0, 50)));
    return () => newSocket.close();
  }, []);

  const userSeat = useMemo(() => (players || []).find(p => p?.userId === localId), [players, localId]);
  const isHeroTurn = activeIdx !== -1 && userSeat && players[activeIdx]?.userId === localId && phase !== PHASES.IDLE;
  const currentPotOnTable = useMemo(() => (potData[0]?.amount || 0) + (players || []).reduce((s, p) => s + (p?.currentBet || 0), 0), [potData, players]);

  const handleAction = (type, amt = 0) => { if (socket) socket.emit('playerAction', { type, amount: amt }); };
  const handleAddBot = () => { if (socket) socket.emit('addBot'); };
  const handleClearArena = () => { if (socket) socket.emit('clearArena'); };

  const winnerPos = useMemo(() => {
    if (!winningPlayerIndices || winningPlayerIndices.length === 0) return { x: 50, y: 43 };
    return SEAT_POSITIONS[winningPlayerIndices[0]] || { x: 50, y: 43 };
  }, [winningPlayerIndices]);

  return (
    <div className="h-screen bg-[#06080c] text-white font-sans flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a202c_0%,_#06080c_100%)] pointer-events-none" />
      
      {/* Header & Sidebar always visible for Admin testing */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-[30px] border-b border-white/10 flex items-center justify-between px-8 z-[8000]">
        <div className="flex items-center gap-6">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400">
            <ChevronLeft size={20} className={sidebarOpen ? 'rotate-0' : 'rotate-180'} />
          </button>
          <span className="text-[#fbbf24] font-black text-xl uppercase tracking-widest">LIVE ARENA</span>
        </div>
      </header>

      <aside className={`fixed left-0 top-16 bottom-[200px] bg-[#0f172a]/95 backdrop-blur-[25px] border-r border-white/5 transition-all duration-500 z-[7500] ${sidebarOpen ? 'w-[20vw] min-w-[280px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
        <div className="p-6 space-y-4">
          <button onClick={handleAddBot} className="w-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 p-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600/30">Add Bot</button>
          <button onClick={handleClearArena} className="w-full bg-red-950/20 border border-red-500/30 text-red-400 p-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-red-950/40">Clear Table</button>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center relative pt-16 pb-36 px-4">
        <div className="relative w-full max-w-[1600px] aspect-[21/10] mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-emerald-950/5 rounded-[40%] border-[1.5vw] border-slate-900 shadow-[inset_0_0_8vw_rgba(245,158,11,0.2)]" />
            
            <div className="absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
              <div 
                className="transition-all duration-1000"
                style={{ 
                    transform: potTransferring ? `translate(${winnerPos.x - 50}vw, ${winnerPos.y - 43}vh) scale(0.3)` : 'scale(1)',
                    opacity: potTransferring ? 0 : 1
                }}
              >
                <div className="text-[4vw] font-black text-yellow-400 font-mono tracking-tighter">${currentPotOnTable}</div>
              </div>

              <div className="flex gap-2 scale-[1.7] mt-10 justify-center">
                {community.map((c, i) => (
                  <div key={i} className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] bg-white text-slate-950 flex flex-col items-center justify-center font-bold shadow-2xl ${winning5Ids.includes(c.id) ? 'ring-4 ring-yellow-400' : ''}`}>
                    <span className="text-[0.9vw] font-black">{c.value}</span>
                    <span className={`text-[1.8vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span>
                  </div>
                ))}
              </div>
            </div>

            {players.map((p, i) => <Seat key={i} player={p} index={i} phase={phase} localId={localId} winning5Ids={winning5Ids} potTransferring={potTransferring} />)}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
              <div className="relative w-[12vw] h-[6vw] flex items-center justify-center scale-[1.5]">
                {userSeat?.hand?.map((c, ci) => (
                  <div key={ci} 
                    className={`w-[3vw] h-[4.2vw] rounded-[0.4vw] bg-white text-slate-950 absolute p-[0.3vw] shadow-2xl transition-all duration-300 ${winning5Ids.includes(c.id) && phase === PHASES.SHOWDOWN ? 'ring-4 ring-yellow-400 scale-110' : ''}`}
                    style={{ transform: `translateX(${(ci - (userSeat.hand.length - 1) / 2) * 2.5}vw) rotate(${(ci - (userSeat.hand.length - 1) / 2) * 10}deg)`, transformOrigin: 'bottom center' }}
                  >
                    <span className="text-[1vw] font-black block">{c.value}</span>
                    <span className={`text-[1.5vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : ''}`}>{c.suit}</span>
                  </div>
                ))}
              </div>
              
              {userSeat && phase !== PHASES.IDLE && phase !== PHASES.SHOWDOWN && (
                <div className="h-7 px-3 bg-purple-600/95 rounded-full shadow-lg flex items-center mt-2 mb-2">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest whitespace-nowrap">Evaluating...</span>
                </div>
              )}

              <div className={`flex items-center gap-4 px-10 py-2 rounded-full border-2 bg-black shadow-2xl ${userSeat?.isWinner && isShowdown ? 'border-yellow-400 scale-125 shadow-[0_0_3vw_#fbbf24]' : 'border-white/10'}`}>
                <div className="text-center">
                  <div className="text-[1.2vw] font-black uppercase tracking-widest">{userSeat?.name || "JOINING..."}</div>
                  <div className="text-emerald-500 font-mono font-black text-[1.3vw] tracking-tighter">${userSeat?.chips || 0}</div>
                </div>
              </div>
            </div>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-[200px] bg-black/40 backdrop-blur-3xl border-t border-white/10 z-[6000] flex pointer-events-auto">
        <div className="flex-1 p-6 border-r border-white/10 overflow-hidden">
          <div className="text-slate-400 uppercase font-black text-sm mb-4 border-b border-white/10 pb-2 tracking-widest">Intelligence Feed</div>
          <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px]">
            {logs.map((l, i) => <div key={i} className={l.type === 'win' ? 'text-yellow-400 font-bold' : 'text-slate-300'}>[{l.time}] {l.action}</div>)}
          </div>
        </div>

        <div className="flex-1 py-6 px-10 flex flex-col justify-center items-center relative">
          {isHeroTurn ? (
            <div className="w-full h-full flex flex-col justify-between animate-in fade-in slide-in-from-bottom-2">
              <div className="flex gap-4 justify-center">
                <button onClick={() => handleAction('RAISE', Math.floor(currentPotOnTable * 0.5 + highestBet))} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-[10px] font-black hover:bg-white/10 transition-all">1/2 POT</button>
                <button onClick={() => handleAction('RAISE', currentPotOnTable + highestBet)} className="w-24 h-10 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-yellow-400 hover:bg-white/10 transition-all">POT</button>
              </div>
              <div className="flex gap-8 justify-center mt-4">
                <button onClick={() => handleAction('FOLD')} className="w-32 h-12 bg-red-950/40 border border-red-500/50 rounded-full font-black text-xs text-red-400 hover:bg-red-950/60 transition-all">FOLD</button>
                <button onClick={() => handleAction('CALL')} className="w-48 h-12 bg-blue-950/40 border border-blue-500/50 rounded-full font-black text-sm text-blue-400 hover:bg-blue-950/60 transition-all">{highestBet > (userSeat?.currentBet || 0) ? 'CALL' : 'CHECK'}</button>
                <button onClick={() => handleAction('RAISE', highestBet + 40)} className="w-32 h-12 bg-emerald-950/40 border border-emerald-500/50 rounded-full font-black text-xs text-emerald-400 hover:bg-emerald-950/60 transition-all">RAISE</button>
              </div>
            </div>
          ) : (
            <div className="text-center opacity-80">
              <Target size={40} className="mx-auto mb-2 text-[#22d3ee] animate-pulse" />
              <div className="font-black text-[1.5vw] tracking-widest text-[#fbbf24] uppercase">
                {activeIdx !== -1 ? `${(players[activeIdx]?.name || "PLAYER").toUpperCase()}'S TURN` : "WAITING FOR PLAYERS"}
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;
