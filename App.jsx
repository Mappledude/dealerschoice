import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign
} from 'lucide-react';
import { io } from "socket.io-client";

// --- MULTIPLAYER CONNECTION ---
const SOCKET_URL = "https://poker-server-3vin.onrender.com";
const socket = io(SOCKET_URL, { transports: ["websocket"] });

// --- CONSTANTS & CONFIG ---
const TOTAL_SEATS = 10;
const LOCAL_USER_ID = 'human_player';

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', holeCards: 2, rules: "Best 5 out of 7 cards" }, 
  OMAHA: { id: 'OMAHA', name: 'Omaha', holeCards: 4, rules: "Use EXACTLY 2 hand + 3 board cards!" }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', holeCards: 3, rules: "3 hole cards dealt; discard 1 after flop." }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', holeCards: 2, rules: "LOWEST ranked hand wins the pot!" } 
};

const PHASES = { 
  IDLE: 'IDLE', 
  PRE_FLOP: 'PRE_FLOP', 
  FLOP: 'FLOP', 
  TURN: 'TURN', 
  RIVER: 'RIVER', 
  SHOWDOWN: 'SHOWDOWN' 
};

const SEAT_POSITIONS = [
  { x: 50, y: 92 }, { x: 6,  y: 68 }, { x: 4,  y: 39 }, { x: 12, y: 20 }, { x: 30, y: 10 }, 
  { x: 50, y: 8 }, { x: 70, y: 10 }, { x: 88, y: 20 }, { x: 96, y: 39 }, { x: 94, y: 68 }  
];

const INITIAL_PLAYERS = Array.from({ length: TOTAL_SEATS }, (_, i) => 
  i === 0 ? {
    id: 0, userId: LOCAL_USER_ID, name: "Hero", isBot: false, chips: 2000, 
    hand: [], currentBet: 0, totalContributed: 0, isFolded: false, isAdmin: true, 
    isDealer: true, isSeated: true, acted: false, joinedAt: Date.now(), handResult: null, 
    variantId: 'HOLDEM', blindType: null
  } : null
);

export default function App() {
  // 1. STATE & REFS
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [board, setBoard] = useState([]);
  const [pot, setPot] = useState(0);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [logs, setLogs] = useState(["Welcome to the Arena."]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  // 2. MULTIPLAYER SYNC EFFECT
  useEffect(() => {
    function onConnect() { setIsConnected(true); addLog("Connected to Poker Engine."); }
    function onDisconnect() { setIsConnected(false); addLog("Disconnected from Arena."); }
    function onGameUpdate(data) {
      if (data.players) setPlayers(data.players);
      if (data.pot !== undefined) setPot(data.pot);
      if (data.board) setBoard(data.board);
      if (data.phase) setPhase(data.phase);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('gameUpdate', onGameUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('gameUpdate', onGameUpdate);
    };
  }, []);

  // 3. UTILITIES
  const addLog = (msg) => {
    setLogs(prev => [String(msg), ...prev].slice(0, 50));
  };

  // 4. THE NAVY VOID RENDER
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 overflow-hidden">
      {/* HEADER / TOP BAR */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-amber-500 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.4)]">
            <Trophy className="w-5 h-5 text-slate-900" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100 uppercase">Dealer's Choice <span className="text-amber-500">PRO</span></h1>
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} border ${isConnected ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
            {isConnected ? 'LIVE SYNC' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {/* MAIN ARENA */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        {/* THE TABLE FELT */}
        <div className="relative w-full max-w-5xl aspect-[21/9] bg-emerald-900 rounded-[200px] border-[12px] border-slate-800 shadow-[inset_0_0_100px_rgba(0,0,0,0.6),0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center">
          
          {/* COMMUNITY CARDS ROW */}
          <div className="flex gap-3 scale-110">
            {board.map((card, i) => (
              <div key={i} className="w-16 h-24 bg-white rounded-md shadow-xl flex flex-col items-center justify-center border border-slate-300">
                <span className="text-slate-900 font-bold text-xl">{card.rank}</span>
                <span className="text-2xl">{card.suit}</span>
              </div>
            ))}
            {board.length === 0 && <div className="h-24 flex items-center text-emerald-800/40 font-black italic text-4xl tracking-widest uppercase">The Arena</div>}
          </div>

          {/* POT DISPLAY */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-16 flex items-center gap-2 bg-black/40 px-4 py-1.5 rounded-full border border-amber-500/30 backdrop-blur-sm shadow-2xl">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="text-amber-400 font-black text-lg tracking-tighter">${pot}</span>
          </div>
        </div>
      </div>

      {/* FOOTER COCKPIT (THE NAVY VOID ARCHITECTURE) */}
      <div className="h-80 bg-slate-900/80 border-t border-slate-800 backdrop-blur-xl relative z-50 flex flex-col items-center pt-6">
        
        {/* TIER 1: HERO NAME TAG (THE CROWN) */}
        <div className="bg-amber-500 px-6 py-1 rounded-full shadow-lg">
          <span className="text-slate-900 font-black uppercase text-sm tracking-widest">HERO | ${players[0]?.chips || 0}</span>
        </div>

        {/* TIER 2: 60PX NAVY VOID */}
        <div className="h-[60px] w-full flex items-center justify-center pointer-events-none">
           {/* This is the strict air gap enforced for visual clarity */}
        </div>

        {/* TIER 3: HOLE CARDS (THE FAN) */}
        <div className="flex gap-4 scale-[1.8] origin-bottom transition-all duration-500">
          {(players[0]?.hand || []).map((card, i) => (
             <div key={i} className="w-12 h-18 bg-white rounded shadow-2xl flex flex-col items-center justify-center border border-slate-200">
                <span className="text-slate-900 font-bold text-sm leading-none">{card.rank}</span>
                <span className="text-base leading-none">{card.suit}</span>
             </div>
          ))}
        </div>

        {/* TIER 4: ACTION COMMAND DECK */}
        <div className="mt-auto pb-6 flex gap-4">
          <button className="px-8 py-3 bg-slate-800 rounded-lg font-bold border border-slate-700 hover:bg-slate-700 transition-colors uppercase tracking-widest text-xs">Fold</button>
          <button className="px-8 py-3 bg-amber-600 rounded-lg font-bold shadow-lg shadow-amber-900/20 hover:bg-amber-500 transition-all uppercase tracking-widest text-xs text-slate-950">Call/Check</button>
          <button className="px-8 py-3 bg-emerald-600 rounded-lg font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all uppercase tracking-widest text-xs text-slate-950">Raise</button>
        </div>
      </div>

      {/* INTELLIGENCE FEED (LEFT) */}
      <div className="absolute bottom-6 left-6 w-72 h-40 bg-slate-950/80 border border-slate-800 rounded-xl backdrop-blur-md overflow-hidden flex flex-col shadow-2xl z-[100]">
        <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intelligence Feed</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 scrollbar-hide">
          {logs.map((log, i) => (
            <div key={i} className="text-slate-400 border-l border-slate-800 pl-2 opacity-90">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
