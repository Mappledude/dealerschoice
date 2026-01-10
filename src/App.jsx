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
// VERSION: v1.1.20
const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { 
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000 
});

const VERSION = "v1.1.20";
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

const RAINBOW_GRADIENT = 'linear-gradient(to right, #22d3ee, #a855f7, #eab308, #39FF14, #ff007f, #ff0000)';

const HILOW_SECONDARY_COLOR = '#bfff00'; 
const TABLE_FELT_COLOR = '#0f172a'; 

const getContrastColor = (hex) => {
  if (hex === 'RANDOM') return 'black';
  if (!hex) return 'white';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? 'black' : 'white';
};

const NEON_PALETTE = [
  'text-[#39FF14]', 'text-[#FF00FF]', 'text-[#00FFFF]', 'text-[#FF5F1F]', 'text-[#FFFF00]', 'text-[#B026FF]',
];

const getNeonNameColor = (name) => {
  if (!name || name === "SYSTEM") return "text-white";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return NEON_PALETTE[Math.abs(hash) % NEON_PALETTE.length];
};

const VARIANTS = { 
  RANDOM: { id: 'RANDOM', name: 'Random', rules: ["The server will pick a different variation for you every time you deal.", "Keep your opponents guessing with dynamic rule changes."] },
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', rules: ["Each player gets 2 hole cards.", "Standard high hand rankings apply.", "Best 5-card combination from 2 hole + 5 community cards wins."] }, 
  OMAHA: { id: 'OMAHA', name: 'Omaha', rules: ["Each player gets 4 hole cards.", "You MUST use EXACTLY 2 hole cards and 3 community cards.", "Standard high hand rankings apply."] }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', rules: ["Each player gets 3 hole cards.", "Standard high hand rankings.", "Similar to Hold'em but with an extra card for better drawing potential."] }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', rules: ["Worst hand wins the pot.", "Ace is the lowest card (value 1).", "The 'best' hand is the one that would normally be the weakest.", "You MUST use BOTH hole cards and 3 board cards."] }, 
  HILOW: { id: 'HILOW', name: 'Hi-Low Split', rules: ["Pot is split 50/50 between the High hand and the Low hand.", "4 hole cards dealt.", "Must use 2 hole + 3 board cards for both halves.", "All hands qualify for the low half; straights and flushes count against you."] }, 
  REDSBLACKS: { id: 'REDSBLACKS', name: 'Reds & Blacks', rules: ["4 hole cards dealt.", "Special Joker mechanic: If your hand contains color combinations, you may play with enhanced strength.", "Dynamic wildcards based on suit parity."] }
};

const DISPLAY_POSITIONS = [
  { x: 50, y: 92 }, { x: 25, y: 84 }, { x: 10, y: 62 }, { x: 10, y: 38 }, { x: 25, y: 16 },
  { x: 50, y: 8  }, { x: 75, y: 16 }, { x: 90, y: 38 }, { x: 90, y: 62 }, { x: 75, y: 84 }
];

const DashTimer = ({ timeRemaining }) => {
  const percentage = Math.max(0, (timeRemaining / 24) * 100);
  const color = timeRemaining < 6 ? '#ef4444' : timeRemaining < 12 ? '#f59e0b' : '#22d3ee';
  return (
    <div className="w-24 md:w-32 h-1.5 bg-white/10 rounded-full relative mt-1 overflow-hidden">
      <div className="absolute inset-0 flex gap-1 items-center px-1">
        {Array.from({ length: 8 }).map((_, i) => (<div key={`bg-seg-${i}`} className="h-1 flex-1 bg-white/5 rounded-full" />))}
      </div>
      <div className="absolute inset-0 overflow-hidden transition-all duration-1000 linear" style={{ width: `${percentage}%` }}>
        <div className="w-24 md:w-32 h-full flex gap-1 items-center px-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`timer-seg-${i}`} className="h-1 flex-1 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
          ))}
        </div>
      </div>
    </div>
  );
};

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  isDealer, potTransferring, timeRemaining, isHero, 
  relativeIdx, visuals, bigBlind, showdownWinners, formatRank, isSpotlighted
}) => {
    const [ghostAction, setGhostAction] = useState(null);
    const lastActionStr = player?.lastAction || "";
    const currentBetNum = player?.currentBet || 0;
    const isFoldedBool = player?.isFolded || false;
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
    
    const vecX = 50 - displayPos.x;
    const vecY = 50 - displayPos.y;
    const cardInwardX = isMobile ? vecX * 0.15 : vecX * 0.12;
    const cardInwardY = isMobile ? vecY * 0.20 : vecY * 0.18;

    const currentAction = useMemo(() => {
        if (!player) return null;
        if (isFoldedBool) return { text: "FOLDED", color: "text-red-500", glow: "shadow-[0_0_20px_rgba(239,68,68,0.6)]" };
        if (phase === PHASES.PRE_FLOP && currentBetNum > 0 && !lastActionStr) {
            if (currentBetNum === bigBlind) return { text: `BB $${currentBetNum}`, color: "text-indigo-400", glow: "shadow-[0_0_20px_rgba(129,140,248,0.4)]" };
            return { text: `SB $${currentBetNum}`, color: "text-purple-400", glow: "shadow-[0_0_30px_rgba(168,85,247,0.4)]" };
        }
        if (!lastActionStr) return null;
        switch (lastActionStr) {
            case 'RAISE': return { text: `RAISE $${currentBetNum}`, color: "text-orange-500", glow: "shadow-[0_0_30px_rgba(249,115,22,0.6)]" };
            case 'CALL': return { text: `CALL $${currentBetNum}`, color: "text-emerald-400", glow: "shadow-[0_0_30px_rgba(52,211,153,0.6)]" };
            case 'CHECK': return { text: "CHECK", color: "text-slate-400", glow: "shadow-[0_0_30px_rgba(148,163,184,0.4)]" };
            default: return null;
        }
    }, [lastActionStr, currentBetNum, isFoldedBool, phase, bigBlind]);

    useEffect(() => {
        if (currentAction) {
            setGhostAction(currentAction);
        } else if (isCollectingBets) {
            const timer = setTimeout(() => setGhostAction(null), 2000);
            return () => clearTimeout(timer);
        } else {
            setGhostAction(null);
        }
    }, [currentAction, isCollectingBets]);

    if (!player || !displayPos) return null;

    const isMuckWin = phase === PHASES.SHOWDOWN && showdownWinners?.some(w => w.rank === "!");
    
    // Cards reveal for everyone in the showdown unless it was a single-player muck win
    const shouldRevealCards = isHero || (phase === PHASES.SHOWDOWN && !player.isFolded && (!isMuckWin || player.isWinner));
    const cardZIndex = isHero ? 'z-[200]' : 'z-[80]';

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-700 ${isHero ? 'z-[100]' : 'z-20'} ${player.waitingForNextHand ? 'opacity-50' : ''} ${isSpotlighted ? 'scale-[1.25] z-[400]' : ''}`}>
            {player.waitingForNextHand && (<div className="absolute top-[-35px] bg-slate-900 text-cyan-400 text-[8px] px-2 py-0.5 rounded-full border border-cyan-500/50 uppercase font-bold tracking-[0.2em] z-[150] backdrop-blur-md">WAITING</div>)}
            
            {/* HOLE CARDS */}
            {player.hand && Array.isArray(player.hand) && !player.waitingForNextHand && (
                <div 
                  className={`flex items-center justify-center w-[15vw] lg:w-[12vh] h-[8vw] lg:h-[8vh] pointer-events-none transition-all duration-500 ${cardZIndex} ${isHero ? 'absolute' : 'relative -mb-[5.25vw] lg:-mb-[4vh]'} ${isFoldedBool ? 'opacity-30 grayscale scale-90' : 'opacity-100'}`} 
                  style={isHero ? { transform: isMobile ? `translate(${cardInwardX}vw, ${cardInwardY}vw) translateY(${visuals.heroCardY}px)` : `translate(${cardInwardX * 0.4}vh, ${cardInwardY * 0.4}vh) translateY(${visuals.heroCardY}px)` } : {}}
                >
                    {player.hand.map((c, ci) => {
                        const offset = ci - (player.hand.length - 1) / 2;
                        
                        const cardSpacing = isHero ? visuals.heroCardSpread : (isMobile ? 3.75 : 2.75);
                        
                        const rotation = isHero ? (offset * visuals.holeCardFan) : 0;
                        const scaleBase = isHero ? visuals.heroCardScale : 1.0;
                        const isRed = c.suit === '♥' || c.suit === '♦';
                        const isWinningCard = (winning5Ids || []).includes(c.id);
                        const isHighlighted = phase === PHASES.SHOWDOWN && player.isWinner && isWinningCard && !isMuckWin;

                        return (
                          <div 
                            key={`seat-card-${player.uid}-${c.id || ci}`} 
                            className={`w-[7.5vw] lg:w-[5.5vh] h-[10.5vw] lg:h-[8vh] rounded-lg flex flex-col items-start justify-start p-1 border absolute transition-all duration-300 shadow-2xl ${shouldRevealCards ? 'bg-white' : 'bg-red-700 border-2 border-white'} ${isHighlighted ? 'ring-4 ring-yellow-400' : ''}`} 
                            style={{ 
                              transform: `translateX(${offset * cardSpacing}${isMobile ? 'vw' : 'vh'}) rotate(${rotation}deg) scale(${isHighlighted ? scaleBase * 1.1 : scaleBase})`, 
                              transformOrigin: 'bottom center', 
                              zIndex: isHighlighted ? 350 : 100 + ci,
                              backgroundImage: !shouldRevealCards ? 'url("data:image/svg+xml,%3Csvg width=\'12\' height=\'12\' viewBox=\'0 0 12 12\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M6 0l6 6-6 6-6-6z\' fill=\'%23ffffff\' fill-opacity=\'0.15\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")' : 'none'
                            }}
                          >
                              {shouldRevealCards && (<><span className={`text-[10px] lg:text-[1.4vh] font-black leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{String(c.value)}</span><span className={`text-[12px] lg:text-[2vh] leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{String(c.suit)}</span></>)}
                              {isHighlighted && (<div className="absolute inset-0 ring-4 ring-yellow-400 rounded-lg animate-pulse" />)}
                          </div>
                        );
                    })}
                </div>
            )}

            {/* PLAYER HUD WRAPPER */}
            <div className="relative flex flex-col items-center">
                <div className={`relative z-[90] flex flex-col items-center p-2 lg:p-3 rounded-xl border transition-all duration-300 min-w-[120px] lg:min-w-[14vh] overflow-hidden backdrop-blur-3xl scale-[0.85] ${isActiveTurn ? 'border-white ring-4 ring-white/20 bg-slate-800 shadow-[0_0_40px_rgba(255,255,255,0.2)]' : 'border-white/10 bg-black/60'} ${(player.isWinner && phase === PHASES.SHOWDOWN) || isSpotlighted ? 'border-yellow-400 ring-4 ring-yellow-400/50' : ''}`}>
                    
                    {isDealer && (
                        <div className="absolute top-2 right-2 z-[110] pointer-events-none">
                          <div className="w-2.5 h-2.5 bg-red-600 rounded-full border border-red-900 shadow-[0_0_8px_rgba(239,68,68,0.8),inset_0_0_2px_rgba(0,0,0,0.5)]" />
                        </div>
                    )}

                    <div className={`flex flex-col items-center w-full relative z-10 py-1 overflow-hidden transition-all duration-500 ${isFoldedBool ? 'opacity-40 grayscale' : 'opacity-100'}`}>
                        <div className="flex flex-col items-center gap-0.5 shrink-0 mb-1">
                          <div className="flex items-center gap-1 opacity-60">
                            {player.isBot && <Bot size={10} className="text-indigo-400" />}
                            <span className="text-[12px] lg:text-[1.6vh] font-black text-white uppercase tracking-wider truncate max-w-[80px] lg:max-w-[12vh]">{String(player.name)}</span>
                          </div>
                          {phase === PHASES.SHOWDOWN && !isFoldedBool && player.strength && (
                            <div className="text-[8px] lg:text-[1.1vh] text-cyan-400 font-bold tracking-tighter animate-in fade-in slide-in-from-bottom-1 duration-500 whitespace-nowrap overflow-hidden">
                              {formatRank(player.strength)}
                            </div>
                          )}
                        </div>

                        <div className="w-full h-[24px] lg:h-[3.5vh] relative flex items-center justify-center overflow-hidden">
                            {/* CHIP BALANCE / ALL-IN DISPLAY */}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${ghostAction ? 'opacity-0 -translate-y-4 scale-75 pointer-events-none' : 'opacity-100 translate-y-0 scale-100'}`}>
                                {player.chips <= 0 && phase !== PHASES.IDLE && !player.waitingForNextHand ? (
                                    <span className="text-[14px] lg:text-[2.2vh] font-black italic uppercase text-red-500 leading-none tracking-tighter animate-pulse">
                                        ALL-IN ${Number(player.totalContribution + (player.currentBet || 0)).toLocaleString(undefined, {minimumFractionDigits: 0})}
                                    </span>
                                ) : (
                                    <span className={`text-[18px] lg:text-[2.8vh] font-mono font-black ${player.chips <= 0 ? 'text-red-500' : 'text-emerald-400'} leading-none tracking-tighter`}>
                                        ${(Number(player.chips) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                    </span>
                                )}
                            </div>

                            {/* DYNAMIC ACTION TEXT */}
                            {ghostAction && (
                                <div key={`action-${ghostAction.text}`} className={`absolute inset-0 flex items-center justify-center transition-all duration-300 animate-action-status-in`}>
                                    <span className={`text-[14px] lg:text-[2.4vh] font-black italic uppercase tracking-tighter text-center drop-shadow-md whitespace-nowrap ${ghostAction.color}`}>
                                        {String(ghostAction.text)}
                                    </span>
                                </div>
                            )}
                        </div>
                        {isActiveTurn && <DashTimer timeRemaining={timeRemaining} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ShowdownLedger = ({ winners, formatRank, isMobile, isHiLo, revealCards }) => {
  // Group winners by uid to handle split pots (Scoops/Hi-Lo)
  const aggregated = useMemo(() => {
    const map = {};
    (winners || []).forEach((w, i) => {
      if (!w) return;
      const key = w.uid || `winner-${i}`;
      if (!map[key]) map[key] = { ...w, payouts: [] };
      map[key].payouts.push({ amount: w.amount, rank: w.rank, hand: w.hand });
    });
    const res = Object.values(map);
    if (isHiLo) {
        res.sort((a, b) => {
            const aHasLow = a.payouts.some(p => String(p.rank).includes("LOW:"));
            const bHasLow = b.payouts.some(p => String(p.rank).includes("LOW:"));
            return bHasLow - aHasLow;
        });
    }
    return res;
  }, [winners, isHiLo]);

  return (
    <div className="w-full max-w-[800px] bg-black/40 border border-white/10 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
      <div className="bg-white/5 px-4 py-1.5 border-b border-white/10 flex justify-between items-center shrink-0">
        <span className="text-[10px] tracking-[0.2em] font-black text-indigo-400 uppercase flex items-center gap-2"><Trophy size={12}/> Arena Distribution Ledger</span>
      </div>
      <div className={`flex-1 overflow-y-auto scrollbar-hide p-2 ${isHiLo && aggregated.length >= 2 ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}`}>
        {aggregated.map((player, idx) => (
          <div key={`ledger-item-${player.uid || idx}`} style={{ animationDelay: `${idx * 150}ms` }} className={`bg-white/5 rounded-xl p-1.5 flex flex-col gap-1 animate-in fade-in slide-in-from-left-2 duration-300 ${isHiLo ? 'border border-indigo-500/20' : ''}`}>
            <div className="flex justify-between items-center px-1">
              <span className={`text-[11px] font-black uppercase truncate max-w-[60%] ${getNeonNameColor(player.name)}`}>{String(player.name)}</span>
              <span className="text-emerald-400 font-mono text-[10px] font-black">
                +${(Number(player.payouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
              </span>
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="flex flex-col gap-0.5 px-1">
                {player.payouts.map((p, pi) => (
                  <div key={`payout-${pi}`} className={`text-[9px] uppercase font-bold leading-tight ${String(p.rank).includes("LOW:") ? 'text-emerald-400' : 'text-white/60'}`}>
                    {formatRank(p.rank)}
                  </div>
                ))}
              </div>

              <div className="flex gap-1 justify-center flex-wrap perspective-500">
                {(player.payouts[0]?.hand || []).map((c, ci) => (
                  <div key={`card-${ci}`} className="relative w-6 h-9">
                      <div className={`w-full h-full transition-all duration-700 preserve-3d ${revealCards ? 'rotate-y-180' : ''}`} style={{ transitionDelay: `${ci * 100}ms` }}>
                         {/* Back side */}
                         <div className="absolute inset-0 bg-red-800 rounded border border-white/20 backface-hidden shadow-sm" />
                         {/* Front side */}
                         <div className={`absolute inset-0 bg-white rounded border border-white/10 backface-hidden rotate-y-180 flex flex-col items-center justify-center p-0.5`}>
                            <span className={`text-[8px] font-black leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-900'}`}>{String(c.value)}</span>
                            <span className={`text-[10px] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-900'}`}>{String(c.suit)}</span>
                         </div>
                      </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
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
  const [pendingVariantId, setPendingVariantId] = useState('RANDOM'); 
  const [community, setCommunity] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dealerIdx, setDealerIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [bigBlind, setBigBlind] = useState(2);
  const [minRaiseAmount, setMinRaiseAmount] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(24);
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState(100); 
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [currentShowdownIdx, setCurrentShowdownIdx] = useState(0);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [showVisualControls, setShowVisualControls] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [expandedHands, setExpandedHands] = useState(new Set());
  const [announcement, setAnnouncement] = useState(null); 
  const [rebuyAmount, setRebuyAmount] = useState(100);
  const [showRebuyModal, setShowRebuyModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [preAction, setPreAction] = useState(null);
  const [handAttention, setHandAttention] = useState(false);
  const [dealAttention, setDealAttention] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 1000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 1, bb: 2, minBuy: 50, maxBuy: 100, pendingVariant: 'RANDOM' });
  const [noiseSeed, setNoiseSeed] = useState(1);
  const [revealShowdownCards, setRevealShowdownCards] = useState(false);

  const joinLock = useRef(false);
  const phaseRef = useRef(PHASES.IDLE); 
  const currentHandId = useRef(Date.now());
  const turnInitializedRef = useRef(-1); 

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  const [visuals, setVisuals] = useState({ 
    heroCardScale: 2.0,
    heroCardY: isMobile ? 0 : -54, 
    heroCardSpread: 3.0, 
    oppCardScale: 1.0, 
    oppCardY: -10, 
    commCardScale: 1.5, 
    commCardY: 0, 
    betScale: 1.5, 
    betY: 0, 
    badgeY: 0, 
    footerHeight: 280, 
    tableZoom: 0.9, 
    holeCardFan: 35 
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setNoiseSeed(s => (s + 1) % 1000);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => p && (p.uid === userProfile.uid || p.name === userProfile.name));
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);

  const effectiveMaxBet = useMemo(() => {
    if (!heroPlayerObj) return 0;
    const activeOpponents = players.filter(p => p && !p.isFolded && p.uid !== heroPlayerObj.uid && !p.waitingForNextHand);
    const heroStack = (Number(heroPlayerObj.chips) || 0) + (Number(heroPlayerObj.currentBet) || 0);
    if (activeOpponents.length === 0) return heroStack;
    const maxOpponentCapacity = Math.max(...activeOpponents.map(p => (Number(p.chips) || 0) + (Number(p.currentBet) || 0)));
    return Math.min(heroStack, maxOpponentCapacity);
  }, [players, heroPlayerObj]);
  
  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + (Number(p?.currentBet) || 0), 0);
    return Number(potAmount || 0) + currentBetsSum;
  }, [potAmount, players]);

  const handleForceSync = useCallback(() => {
    socket.disconnect().connect();
    socket.emit('getInitialData');
  }, []);

  const handleAction = useCallback((type, amt = 0) => {
    const finalAmount = amt !== 0 ? amt : raiseInput;
    if (currentRoomId) {
      socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(finalAmount) : 0 });
    }
  }, [currentRoomId, raiseInput]);

  const handleRaiseSubmit = useCallback((inputValue) => {
    if (activeIdx !== heroIdx) return;
    const min = minRaiseAmount || (highestBet + bigBlind);
    const max = Number(effectiveMaxBet);
    const finalAmt = Math.max(min, Math.min(Number(inputValue), max));
    handleAction('RAISE', finalAmt);
  }, [activeIdx, heroIdx, minRaiseAmount, highestBet, bigBlind, effectiveMaxBet, handleAction]);

  const handleRebuy = useCallback(() => {
    if (!currentRoomId || !userProfile) return;
    socket.emit('playerRebuy', { roomId: currentRoomId, uid: userProfile.uid, amount: rebuyAmount });
    setShowRebuyModal(false);
  }, [currentRoomId, userProfile, rebuyAmount]);

  const handleLogin = useCallback(() => { 
    if (passwordInput.toLowerCase().trim() === 'pass') { 
        setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin', chips: 0 }); 
        setCurrentView(VIEWS.ADMIN); 
        socket.emit('getInitialData'); 
    } else {
        socket.emit('playerLogin', { password: passwordInput.toLowerCase().trim() });
    }
  }, [passwordInput]);

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile || joinLock.current) return;
    joinLock.current = true; 
    socket.emit('joinRoom', { 
      roomId: selectedTableForJoin.id, 
      profile: { ...userProfile, pendingVariant: pendingVariantId }, 
      buyIn: Math.min(buyInAmount, (Number(userProfile.chips) || 0)) 
    }, (res) => {
        joinLock.current = false; 
        if (res?.status === 'ok') { setCurrentRoomId(selectedTableForJoin.id); setCurrentView(VIEWS.GAME); setSelectedTableForJoin(null); }
    });
  }, [selectedTableForJoin, userProfile, pendingVariantId, buyInAmount]);

  const formatRank = (rank) => {
    if (!rank || rank === "null" || rank === "undefined") return "";
    const rankStr = String(rank);
    const cleanRank = rankStr.replace(/^(high|low|scoop): /i, "");
    const match = rankStr.match(/^(high|low|scoop): /i);
    const prefix = match ? match[0] : "";
    return prefix.toUpperCase() + cleanRank.toUpperCase();
  };

  const handHistory = useMemo(() => {
    const hands = []; 
    let currentHand = null;
    ([...logs].reverse()).forEach((log, idx) => {
        if (!log) return;
        if (String(log.action).includes("DEALING") || String(log.action).includes("PRE_FLOP DEALT")) {
            if (currentHand) hands.push(currentHand);
            currentHand = { id: log.handId || `history-${idx}`, winner: null, amount: null, rank: null, events: [], variant: String(log.action).split('DEALING ')[1] || "Poker" };
        }
        if (currentHand) {
            currentHand.events.push(log);
            if (log.type === 'win') {
                const match = String(log.action).match(/WON \$([\d.]+) WITH (.*)/);
                const matchScoop = String(log.action).match(/SCOOPED THE POT \$([\d.]+)/);
                if (match) { currentHand.winner = log.name; currentHand.amount = match[1]; currentHand.rank = match[2]; }
                else if (matchScoop) { currentHand.winner = log.name; currentHand.amount = matchScoop[1]; currentHand.rank = "Scooped"; }
            }
        }
    });
    if (currentHand) hands.push(currentHand);
    return hands.reverse();
  }, [logs]);

  const copyActivityToClipboard = () => {
    let logTextExport = "--- DEALER'S CHOICE POKER ARENA LOG ---\n\n";
    handHistory.forEach(hand => {
      logTextExport += `[${hand.variant.toUpperCase()} HAND]\n`;
      (hand.events || []).forEach(ev => { 
        logTextExport += `[${new Date(ev.timestamp).toLocaleTimeString()}] ${ev.name}: ${ev.action}\n`; 
      });
      if (hand.winner) logTextExport += `RESULT: ${hand.winner} WON $${hand.amount} with ${hand.rank}\n`;
      logTextExport += "---------------------------------------\n\n";
    });
    const textArea = document.createElement("textarea"); 
    textArea.value = logTextExport; 
    document.body.appendChild(textArea); 
    textArea.select();
    try { document.execCommand('copy'); } catch (err) {} 
    document.body.removeChild(textArea);
  };

  const ActivityFeedContent = () => (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4">
        <div className="flex items-center justify-between text-indigo-400 text-[10px] mb-4 border-b border-indigo-500/20 pb-2 font-black tracking-[0.2em] uppercase">
            <div className="flex items-center gap-2"><Terminal size={14}/> Activity Log</div>
            <div className="flex items-center gap-2">
                <button onClick={copyActivityToClipboard} className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1 transition-all active:scale-95"><Copy size={10} /> Copy</button>
                <button onClick={() => setIntelExpanded(false)} className="text-white/30 hover:text-white"><X size={14}/></button>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3 pr-1 font-black">
            {handHistory.length > 0 ? handHistory.map((hand) => (
                <div key={hand.id} className="border border-white/5 rounded-xl overflow-hidden bg-white/5">
                    <button onClick={() => { 
                      const n = new Set(expandedHands); 
                      if (n.has(hand.id)) n.delete(hand.id); 
                      else n.add(hand.id); 
                      setExpandedHands(n); 
                    }} className="w-full p-3 flex flex-col items-start gap-1 transition-all hover:bg-white/5">
                        <div className="flex items-center justify-between w-full">
                            <span className="text-[9px] text-indigo-400 font-bold tracking-widest uppercase">{String(hand.variant)} HAND</span>
                            <ChevronRightIcon size={12} className={`transition-transform text-white/40 ${expandedHands.has(hand.id) ? 'rotate-90' : ''}`} />
                        </div>
                        <div className="text-[11px] text-white/90 text-left uppercase">
                            {hand.winner ? (<span className="flex items-center gap-2 text-emerald-400"><Trophy size={10} /> <span className={getNeonNameColor(hand.winner)}>{String(hand.winner)}</span> WON ${String(hand.amount)}</span>) : (<span className="text-white/40 italic">IN PROGRESS...</span>)}
                        </div>
                        {hand.winner && (<div className="text-[9px] text-white/40 font-bold truncate w-full text-left uppercase">{formatRank(hand.rank)}</div>)}
                    </button>
                    {expandedHands.has(hand.id) && (
                      <div className="px-3 pb-3 border-t border-white/5 bg-black/40 space-y-1 pt-2">
                        {(hand.events || []).map((ev, i) => (
                          <div key={i} className={`text-[9px] md:text-[10px] leading-tight py-1 border-l-2 pl-2 ${ev.type === 'win' ? 'border-emerald-500 bg-emerald-500/5' : ev.type === 'fold' ? 'border-red-500 bg-red-500/5' : 'border-indigo-500 bg-red-500/5'}`}>
                            <span className="text-white/30 font-mono mr-2 uppercase">[{new Date(ev.timestamp).toLocaleTimeString()}]</span> 
                            <span className={getNeonNameColor(ev.name)}>{String(ev.name)}</span>: <span className="text-white/90 uppercase">{String(ev.action)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
            )) : (<div className="flex flex-col items-center justify-center py-20 text-white/10 gap-3"><Activity size={32} className="animate-pulse" /><span className="text-[10px] tracking-widest font-black uppercase">Scanning for hand data...</span></div>)}
        </div>
    </div>
  );

  useEffect(() => {
    const handleRoomUpdate = (d) => {
        if (!d) return;
        setPlayers(() => { 
          const next = Array(TOTAL_SEATS).fill(null); 
          (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
          return next; 
        });
        const isPhaseTransition = d.phase !== phaseRef.current;
        if (isPhaseTransition && d.phase === PHASES.PRE_FLOP) {
            const vId = d.activeVariant?.id || 'HOLDEM';
            setAnnouncement({ text: VARIANTS[vId]?.name || "Poker", color: VARIANT_COLORS[vId] || '#fff' });
            setTimeout(() => setAnnouncement(null), 1500);
            currentHandId.current = Date.now();
        }
        if (isPhaseTransition && [PHASES.FLOP, PHASES.TURN, PHASES.RIVER].includes(d.phase)) {
            setHandAttention(true);
            setTimeout(() => { setHandAttention(false); setDealAttention(true); setTimeout(() => setDealAttention(false), 1000); }, 3000);
        }
        phaseRef.current = d.phase;
        setPhase(d.phase); setCommunity(d.community || []); setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0); 
        setActiveIdx(d.activeIdx ?? -1); setHighestBet(d.highestBet || 0); setBigBlind(d.bb || 2);
        if (d.minRaiseAmount !== undefined) setMinRaiseAmount(d.minRaiseAmount); 
        setDealerIdx(d.dealerIdx ?? -1); setTimeRemaining(d.timeRemaining || 0);
        if (d.activeVariant) {
          const vId = typeof d.activeVariant === 'string' ? d.activeVariant : d.activeVariant.id;
          setActiveVariant(VARIANTS[vId] || d.activeVariant);
        }

        if (d.phase === PHASES.SHOWDOWN && !showdownWinners) {
            setPotTransferring(true); setRevealShowdownCards(false);
            const rawWinners = d.showdownWinners || []; setShowdownWinners(rawWinners); 
            setWinning5Ids(rawWinners[0]?.winning5Ids || []);
            const dur = rawWinners.some(w => w?.rank === "!") ? 2000 : 8000;
            setTimeout(() => setRevealShowdownCards(true), 1200);
            if (rawWinners.length > 1) { 
                for (let i = 1; i < rawWinners.length; i++) { 
                    setTimeout(() => { if (phaseRef.current === PHASES.SHOWDOWN) { setCurrentShowdownIdx(i); setWinning5Ids(rawWinners[i]?.winning5Ids || []); }}, i * dur); 
                } 
            }
            setTimeout(() => setPotTransferring(false), Math.max(1, rawWinners.length) * dur);
        } else if (d.phase !== PHASES.SHOWDOWN) { 
          setPotTransferring(false); setShowdownWinners(null); setRevealShowdownCards(false);
        }
    };
    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('lobbyUpdate', setActiveTables);
    socket.on('log', (l) => setLogs(prev => [{...l, handId: currentHandId.current, timestamp: Date.now()}, ...prev].slice(0, 100)));
    socket.on('profilesUpdate', (pList) => {
        setAllProfiles(pList || []);
        if (userProfile) {
            const updated = (pList || []).find(x => x.uid === userProfile.uid);
            if (updated) setUserProfile(updated);
        }
    });
    socket.on('initialDataResponse', ({ profiles: pList, rooms: rList }) => { setAllProfiles(pList || []); setActiveTables(rList || []); });
    socket.on('loginSuccess', (p) => { 
        const prof = p.profile || p;
        setUserProfile(prof); socket.emit('getInitialData'); 
        if (p.activeRoomId) {
            setCurrentRoomId(p.activeRoomId);
            socket.emit('joinRoom', { roomId: p.activeRoomId, profile: prof, buyIn: 0 }, (res) => {
                if (res?.status === 'ok') setCurrentView(VIEWS.GAME);
                else setCurrentView(VIEWS.LOBBY);
            });
        } else {
            if (prof.role === 'admin') setCurrentView(VIEWS.ADMIN); else setCurrentView(VIEWS.LOBBY);
        }
    });
    return () => { socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); socket.off('initialDataResponse'); socket.off('loginSuccess'); socket.off('log'); };
  }, [showdownWinners, userProfile]);

  useEffect(() => {
    if (activeIdx === heroIdx && heroPlayerObj && turnInitializedRef.current !== activeIdx) {
      turnInitializedRef.current = activeIdx;
      setRaiseInput(Math.min(minRaiseAmount || (highestBet + bigBlind), Number(effectiveMaxBet)));
      if (preAction === 'FOLD') { handleAction('FOLD'); setPreAction(null); }
      else if (preAction === 'CHECK') { handleAction('CALL'); setPreAction(null); }
    } else if (activeIdx !== heroIdx) { turnInitializedRef.current = -1; }
  }, [activeIdx, heroIdx, heroPlayerObj, highestBet, bigBlind, minRaiseAmount, preAction, handleAction, effectiveMaxBet]);

  if (currentView === VIEWS.LOGIN) return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#06080c] flex items-center justify-center p-6 text-white uppercase font-black">
        <div className="w-full max-w-[400px] p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8 text-center">
            <div className="flex flex-col items-center gap-2">
                <h1 className="text-3xl font-black text-[#fbbf24] mb-2 tracking-tighter">DEALER'S CHOICE</h1>
                <div className="flex items-center gap-2">
                    <Lock size={24} className="text-[#fbbf24] animate-pulse" />
                    <span className="text-white/20 text-[10px] font-mono tracking-widest">{VERSION}</span>
                </div>
            </div>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-xl font-black focus:bg-white/10 transition-all"/>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl font-black text-lg hover:scale-105 active:scale-95 transition-transform uppercase">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#06080c] flex flex-col md:flex-row text-white font-black overflow-hidden uppercase">
        <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-4 flex flex-row md:flex-col gap-2 bg-black/20 shrink-0">
            <h2 className="hidden md:flex text-[#fbbf24] items-center gap-2 mb-4 font-black"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-3 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-3 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>TABLES</button>
            <button onClick={()=>{ if(!nuclearConfirm){ setNuclearConfirm(true); setTimeout(()=>setNuclearConfirm(false),3000); return; } socket.emit('adminNuclearReset'); setNuclearConfirm(false); }} className={`flex-1 md:flex-none p-3 rounded-xl flex items-center justify-center gap-2 border-2 transition-all uppercase ${nuclearConfirm ? 'bg-red-600 border-white text-white' : 'bg-white/5 text-red-500 border-red-500/20'}`}><Bomb size={14}/> {nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</button>
            <button onClick={()=>{setCurrentView(VIEWS.LOBBY); socket.emit('getInitialData');}} className="flex-1 md:flex-none p-3 rounded-xl bg-cyan-600 text-black font-black text-[9px] md:text-xs">BACK</button>
        </aside>
        <main className="flex-1 p-5 overflow-y-auto uppercase font-black">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-8">
                    <h3 className="text-xl border-l-4 border-[#fbbf24] pl-4">Registry</h3>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 uppercase outline-none"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-3 rounded-xl border border-white/10 uppercase outline-none"/>
                        <button onClick={() => { if (!newPlayer.name.trim()) return; socket.emit('adminCreatePlayer', { ...newPlayer, uid: 'p_' + Math.random().toString(36).slice(2, 7) }); setNewPlayer({ ...newPlayer, name: '', password: '' }); }} className="bg-[#fbbf24] text-black rounded-xl font-black">CREATE</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                        {allProfiles.map(p => (
                            <div key={`profile-${p.uid}`} className="flex justify-between p-4 border-b border-white/5 items-center hover:bg-white/5">
                                <span className="uppercase">{String(p.name)}</span>
                                <div className="flex gap-4 items-center">
                                  <span className="text-emerald-400 font-mono text-lg">${(Number(p.chips) || 0).toLocaleString()}</span>
                                  <button onClick={()=>{const n = prompt("NEW WALLET", String(p.chips || 0)); if(n !== null) socket.emit('adminUpdatePlayer', {uid: p.uid, chips: Number(n)})}} className="text-cyan-400"><Edit3 size={14}/></button>
                                  <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    <h3 className="text-xl border-l-4 border-emerald-500 pl-4 uppercase">Arenas</h3>
                    <div className="bg-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border border-white/10">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase"/>
                        <div className="flex gap-2">
                          <input type="number" step="0.05" value={newTable.sb} onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})} placeholder="SB" className="bg-black/40 p-3 rounded-xl border border-white/10 text-white text-sm w-1/2 outline-none"/>
                          <input type="number" step="0.05" value={newTable.bb} onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})} placeholder="BB" className="bg-black/40 p-3 rounded-xl border border-white/10 text-white text-sm w-1/2 outline-none"/>
                        </div>
                        <button onClick={() => { if (!newTable.name.trim()) return; socket.emit('adminCreateRoom', { ...newTable, id: 'room_' + Date.now().toString(36) }); setNewTable({ ...newTable, name: '' }); }} className="bg-emerald-600 rounded-xl font-black">SPAWN</button>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {activeTables.map(t => (
                            <div key={`table-admin-${t.id}`} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10">
                              <div className="uppercase"><h4 className="text-[#fbbf24] font-black">{String(t.name)}</h4><p className="text-[10px] text-white/40 font-black">${t.sb}/${t.bb}</p></div>
                              <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="text-red-500"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    </div>
  );

  if (currentView === VIEWS.LOBBY) return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#000] flex flex-col text-white font-black uppercase overflow-hidden">
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl px-6">
              <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-emerald-500/30 rounded-3xl flex flex-col gap-10 shadow-2xl">
                <h3 className="text-3xl text-center text-emerald-400 font-black">{String(selectedTableForJoin.name)}</h3>
                <div className="space-y-4 text-center font-black">
                  <div className="flex justify-between items-center text-[10px] text-white/40 tracking-[0.2em]"><span>BUY-IN</span><span className="text-emerald-400 text-2xl font-mono">${(Number(buyInAmount) || 0).toLocaleString()}</span></div>
                  <input type="range" min={selectedTableForJoin.minBuy || 50} max={Math.min(selectedTableForJoin.maxBuy || 100, (Number(userProfile?.chips) || 100))} step={1} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                </div>
                <div className="flex gap-4"><button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-4 bg-white/5 border border-white/10 rounded-xl font-black">CANCEL</button><button onClick={joinRoom} className="flex-2 p-4 bg-emerald-600 rounded-xl font-black shadow-lg">CONFIRM</button></div>
              </div>
            </div>
        )}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-6 md:px-12 bg-black/60 backdrop-blur-md">
          <h2 className="tracking-[0.5em] text-lg flex items-center gap-3 font-black"><LayoutGrid className="text-emerald-400 w-5"/> LOBBY <span className="text-[10px] text-white/20 font-mono tracking-widest">{VERSION}</span></h2>
          <div className="flex items-center gap-6 font-black">
            <div className="flex flex-col items-end"><span className="text-[10px] text-white/40 uppercase tracking-widest">{String(userProfile?.name)}</span><span className="text-emerald-400 font-mono text-2xl tracking-tighter">${(Number(userProfile?.chips) || 0).toLocaleString()}</span></div>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all active:scale-95"><LogOut size={20}/></button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-12 overflow-y-auto bg-gradient-to-b from-slate-900/20 to-black uppercase font-black">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {activeTables.map((t) => (
                    <div key={`lobby-table-${t.id}`} className="group bg-slate-900/40 border border-white/5 rounded-3xl flex flex-col p-8 shadow-2xl transition-all hover:border-emerald-500/30 font-black">
                      <h3 className="text-2xl text-white font-black mb-4 truncate">{String(t.name)}</h3>
                      <div className="flex flex-col gap-4 mb-6">
                        <div className="flex justify-between items-end border-b border-white/5 pb-2">
                            <div className="flex flex-col"><span className="text-[8px] text-white/30 uppercase tracking-widest">Stakes</span><span className="text-emerald-400 text-xl font-mono">${t.sb}/${t.bb}</span></div>
                            <div className="flex flex-col items-end"><span className="text-[8px] text-white/30 uppercase tracking-widest">Buy-in</span><span className="text-white/80 text-sm font-mono">${t.minBuy}-${t.maxBuy}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-black/40 rounded-xl min-h-[40px]">
                            {(t.players || []).filter(p=>p).map((p, idx) => (<span key={`seated-${p.uid || idx}`} className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[8px] flex items-center gap-1 font-black">{p.isBot && <Bot size={8} className="text-indigo-400" />}{String(p.name).toUpperCase()}</span>))}
                        </div>
                      </div>
                      <button onClick={()=>{ setSelectedTableForJoin(t); setBuyInAmount(t.maxBuy); }} className="w-full py-4 bg-emerald-600 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all font-black">JOIN ARENA</button>
                    </div>
                ))}
            </div>
        </main>
    </div>
  );

  return (
    <div style={{ height: 'calc(var(--vh, 1vh) * 100)' }} className="bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase select-none tracking-tighter">
      {phase === PHASES.SHOWDOWN && (<div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[250] transition-opacity duration-700 animate-in fade-in" />)}
      {announcement && (<div className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none"><div className="relative"><div className="absolute inset-0 blur-[40px] opacity-50 scale-150 animate-pulse rounded-full" style={{ backgroundColor: announcement.color }} /><h1 className="text-[10vw] font-black uppercase italic animate-announcement-pop relative z-10" style={{ color: announcement.color }}>{String(announcement.text)}</h1></div></div>)}
      
      {showRebuyModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-3xl px-6">
          <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-indigo-500/30 rounded-3xl flex flex-col gap-10 shadow-2xl">
            <h3 className="text-3xl text-center text-indigo-400 font-black">ARENA TOP-UP</h3>
            <div className="space-y-4 text-center font-black">
              <div className="flex justify-between items-center text-[10px] text-white/50 tracking-[0.2em]"><span>AMOUNT</span><span className="text-indigo-400 text-2xl font-mono">${(Number(rebuyAmount) || 0).toLocaleString()}</span></div>
              <input type="range" min={1} max={Number(userProfile?.chips) || 100} step={1} value={rebuyAmount} onChange={(e) => setRebuyAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
            </div>
            <div className="flex gap-4"><button onClick={()=>setShowRebuyModal(false)} className="flex-1 p-4 bg-white/5 border border-white/10 rounded-xl font-black">CANCEL</button><button onClick={handleRebuy} className="flex-2 p-4 bg-indigo-600 rounded-xl font-black active:scale-95 shadow-lg">INJECT FUNDS</button></div>
          </div>
        </div>
      )}

      {showRulesModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-3xl px-6" onClick={()=>setShowRulesModal(false)}>
          <div className="w-full max-w-[500px] p-8 bg-slate-900 border border-cyan-500/30 rounded-3xl relative shadow-2xl font-black uppercase" onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setShowRulesModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X/></button>
            <h3 className="text-2xl font-black text-cyan-400 mb-4 tracking-widest flex items-center gap-2"><BookOpen size={24}/> {activeVariant?.name || 'Poker'} Rules</h3>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto mb-6 pr-2">
              {(activeVariant?.rules || []).map((rule, ri) => (<div key={`rule-${ri}`} className="flex gap-3 text-sm text-white/80 leading-relaxed"><span className="text-cyan-500 shrink-0">•</span><span>{String(rule)}</span></div>))}
            </div>
            <button onClick={()=>setShowRulesModal(false)} className="w-full py-4 bg-cyan-600 rounded-xl font-black hover:brightness-110 active:scale-95 shadow-lg">Understood</button>
          </div>
        </div>
      )}

      {intelExpanded && (
        <div className={`fixed bottom-[240px] left-4 w-[85vw] md:w-96 bg-black/20 border border-indigo-500/30 rounded-2xl backdrop-blur-3xl z-[150] shadow-2xl animate-in slide-in-from-left flex flex-col h-[50vh] max-h-[500px]`}>
            <ActivityFeedContent />
        </div>
      )}

      <div className="flex-1 flex relative overflow-hidden">
        <main className="flex-1 flex flex-col items-center justify-center relative bg-[#06080c] overflow-hidden uppercase font-black text-center">
            <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(circle at 50% 45%, #162033 0%, #06080c 100%)' }} />
            
            {heroPlayerObj && !heroPlayerObj.isFolded && phase !== PHASES.IDLE && (
              <>
                {activeVariant?.id === 'HILOW' && (
                  <div className="absolute top-6 left-6 z-[90] flex flex-col items-start pointer-events-none font-black text-left">
                      <span className="text-[8px] md:text-[10px] text-white/50 tracking-[0.3em] uppercase">LOW STRENGTH</span>
                      <span className="text-[17px] lg:text-[3vh] text-white tracking-tighter shadow-lg">{phase === PHASES.PRE_FLOP ? "-" : (formatRank(heroPlayerObj?.lowStrength) || "-")}</span>
                      <span className="text-[12px] text-white/40 font-mono mt-1">{Math.round(heroPlayerObj?.lowWinProbability || 0)}% WIN PROB</span>
                  </div>
                )}
                <div className="absolute top-6 right-6 z-[90] flex flex-col items-end pointer-events-none font-black text-right">
                  <span className="text-[8px] md:text-[10px] text-white/50 tracking-[0.3em] uppercase">STRENGTH</span>
                  <span className="text-[17px] lg:text-[3vh] text-white tracking-tighter shadow-lg">{phase === PHASES.PRE_FLOP ? "-" : (formatRank(heroPlayerObj?.strength) || "-")}</span>
                  <span className="text-[12px] text-white/40 font-mono mt-1">{Math.round(heroPlayerObj?.winProbability || 0)}% WIN PROB</span>
                </div>
              </>
            )}

            <div style={{ transform: isMobile ? `scale(${visuals.tableZoom})` : `scale(${Math.min(visuals.tableZoom, 1.2)})` }} className="relative w-full max-w-[1400px] aspect-[16/9] flex items-center justify-center origin-center">
                <div className="absolute inset-[-20px] rounded-[50%] z-0">
                    <div className="absolute inset-0 rounded-[50%] blur-[20px] opacity-40 animate-pulse" style={{ background: activeVariant?.id === 'HILOW' ? `linear-gradient(to right, ${VARIANT_COLORS.HILOW}, #bfff00)` : (VARIANT_COLORS[activeVariant?.id] || '#22d3ee') }} />
                    <div className="absolute inset-0 rounded-[50%] border-[24px] border-[#0a0a0a] shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_2px_10px_rgba(255,255,255,0.1)]" />
                </div>
                <div className="absolute inset-0 rounded-[50%] border-[40px] border-[#1a110a] bg-[#2b1d12] shadow-[inset_0_0_20px_black]" />
                
                <button onClick={handleForceSync} className="absolute bottom-6 right-6 z-[150] bg-black/60 border border-white/20 p-3 rounded-full text-white/40 hover:text-white transition-all shadow-xl active:scale-95 group pointer-events-auto shadow-black/50"><RefreshCcw size={20} className="group-active:animate-spin"/></button>
                
                <div className="absolute inset-0 pointer-events-none z-20">
                    {(players || []).map((p, i) => { 
                        if (!p) return null; 
                        const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS; 
                        const isThisPlayerWinningShowdown = phase === PHASES.SHOWDOWN && showdownWinners && showdownWinners[currentShowdownIdx]?.uid === p.uid;
                        return (<Seat key={`seat-${p.uid || i}`} player={p} displayPos={DISPLAY_POSITIONS[rIdx]} phase={phase} winning5Ids={winning5Ids} isActiveTurn={activeIdx === i} isDealer={dealerIdx === i} isHero={i === heroIdx} relativeIdx={rIdx} visuals={visuals} bigBlind={bigBlind} showdownWinners={showdownWinners} isCollectingBets={potTransferring} timeRemaining={timeRemaining} formatRank={formatRank} isSpotlighted={isThisPlayerWinningShowdown} />); 
                    })}
                </div>
                <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-none w-full">
                  {!potTransferring && (
                    <div className="flex flex-col items-center mb-3 transition-all">
                      <span className="text-white/50 text-[10px] tracking-[0.5em] mb-1 font-black">TOTAL POT</span>
                      <div className="text-[6vw] lg:text-[6vh] font-black text-white font-mono tracking-tighter shadow-white/20 drop-shadow-xl">${(Number(totalDisplayPot) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                  )}
                  {community.length > 0 && (
                    <div className="flex gap-2 md:gap-4 mt-4 transition-transform" style={{ transform: isMobile ? `scale(${visuals.commCardScale})` : `scale(${visuals.commCardScale * 0.8})` }}>
                      {(community || []).map((c, j) => { 
                        const isRed = c.suit === '♥' || c.suit === '♦'; 
                        return (
                          <div key={`comm-card-${c.id || j}`} className={`w-[8vw] lg:w-[6vh] h-[11vw] lg:h-[9vh] rounded-xl border-2 bg-white flex flex-col items-start justify-start p-1.5 text-black font-black transition-all duration-500 shadow-2xl ${winning5Ids?.includes(c.id) ? 'ring-4 ring-yellow-400 scale-110 shadow-[0_0_30px_#fbbf24]' : 'border-white/10'}`}>
                            <span className={`text-[12px] lg:text-[1.6vh] leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{String(c.value)}</span>
                            <span className={`text-[14px] lg:text-[2.2vh] leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>{String(c.suit)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {activeIdx === heroIdx && heroPlayerObj && phase !== PHASES.IDLE && (
                  <div className="absolute right-4 md:right-[20px] top-[15%] bottom-[15%] w-16 md:w-20 flex flex-col items-center justify-end z-[250] pointer-events-auto">
                    <div className="flex-1 w-full relative flex items-center justify-center py-4">
                      <input type="range" min={Math.min(minRaiseAmount || (highestBet + bigBlind), Number(effectiveMaxBet))} max={Number(effectiveMaxBet)} step={1} value={raiseInput} onChange={(e) => setRaiseInput(Number(e.target.value))} className="vertical-range appearance-none bg-white/10 w-8 md:w-10 h-full rounded-full accent-emerald-500 cursor-pointer relative z-10" style={{ WebkitAppearance: 'slider-vertical', writingMode: 'bt-lr' }} />
                    </div>
                    <div className="mt-4 bg-black/95 border-2 border-emerald-400 px-3 py-2 rounded-xl flex flex-col items-center min-w-[110px] shadow-2xl animate-in zoom-in-50 font-black text-center">
                      <span className="text-[8px] text-white/50 tracking-widest uppercase font-black">Raise To</span>
                      <div className="flex items-center justify-center w-full"><span className="text-emerald-500 font-mono mr-0.5">$</span><input type="number" value={raiseInput} onFocus={(e) => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && handleRaiseSubmit(raiseInput)} onChange={(e) => setRaiseInput(Number(e.target.value))} className="bg-transparent text-emerald-400 font-mono text-xl font-black text-center outline-none w-full" /></div>
                    </div>
                  </div>
                )}
            </div>
        </main>
      </div>

      <footer style={{ height: `calc(${visuals.footerHeight}px + env(safe-area-inset-bottom))` }} className="bg-black border-t border-white/20 flex flex-col z-[400] shrink-0 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        <header className="bg-black/40 border-b border-white/10 flex items-center justify-between px-4 z-[80] shadow-xl backdrop-blur-3xl shrink-0 font-black h-[48px] md:h-[52px]">
          <div className="flex-1 flex items-center h-full">
            <button onClick={()=>setShowRulesModal(true)} style={{ backgroundColor: VARIANT_COLORS[activeVariant?.id || 'HOLDEM'] || '#1e293b' }} className={`border px-3 h-[36px] md:h-[42px] rounded-lg flex flex-col justify-center gap-0 border-white/10 shadow-lg ${handAttention ? 'animate-pulse ring-2 ring-white scale-105' : ''} transition-all active:scale-95`}>
              <span style={{ color: getContrastColor(VARIANT_COLORS[activeVariant?.id || 'HOLDEM']) }} className="text-[7px] md:text-[9px] uppercase font-black opacity-70">This Hand:</span>
              <span style={{ color: getContrastColor(VARIANT_COLORS[activeVariant?.id || 'HOLDEM']) }} className="text-[10px] md:text-sm font-black truncate leading-tight drop-shadow-sm">{String(activeVariant?.name || 'Poker')}</span>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center gap-4 h-full">
            <button onClick={() => setIntelExpanded(!intelExpanded)} className={`p-1.5 border border-white/20 rounded-lg active:scale-95 transition-all ${intelExpanded ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'text-indigo-400 bg-white/5'}`} title="Activity Log"><Eye size={16}/></button>
            <button onClick={() => setShowVisualControls(!showVisualControls)} className={`p-1.5 border border-white/20 rounded-lg active:scale-95 transition-all ${showVisualControls ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(34,211,238,0.5)]' : 'text-cyan-400 bg-white/5'}`} title="Settings"><Settings size={16}/></button>
            <button onClick={() => {if (userProfile) socket.emit('leaveRoom', { uid: userProfile.uid }); setCurrentView(VIEWS.LOBBY);}} className="text-red-500 p-1.5 border border-white/20 rounded-lg active:scale-95 transition-all bg-white/5 hover:bg-red-950/20 shadow-lg" title="Leave Arena"><LogOut size={16}/></button>
          </div>
          <div className="flex-1 flex items-center justify-end h-full">
            <div style={{ background: pendingVariantId === 'RANDOM' ? RAINBOW_GRADIENT : (VARIANT_COLORS[pendingVariantId] || '#0f172a') }} className={`border px-3 h-[36px] md:h-[42px] rounded-lg flex flex-col justify-center gap-0 relative border-white/10 ${dealAttention ? 'animate-pulse ring-2 ring-white scale-105' : ''} transition-all`}>
              <span style={{ color: 'black' }} className="text-[7px] md:text-[9px] uppercase opacity-80 font-black">On My Deal:</span>
              <select value={pendingVariantId} onChange={(e) => { setPendingVariantId(e.target.value); if (userProfile) socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value}); }} style={{ color: 'black' }} className="bg-transparent text-[10px] md:text-sm outline-none font-black appearance-none cursor-pointer z-10 w-full">
                  {Object.entries(VARIANTS).map(([k,v]) => (<option key={`choice-${k}`} value={k} className="bg-slate-900 text-white">{v.name}</option>))}
              </select>
              <ChevronDown size={10} style={{ color: 'black' }} className="absolute right-2 pointer-events-none opacity-50" />
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-start px-4 pt-0 overflow-hidden relative"> 
          {phase === PHASES.SHOWDOWN && showdownWinners && showdownWinners.length > 0 ? (
            (() => {
                if (showdownWinners.length > 1 || activeVariant?.id === 'HILOW') {
                  return <ShowdownLedger winners={showdownWinners} formatRank={formatRank} isMobile={isMobile} isHiLo={activeVariant?.id === 'HILOW'} revealCards={revealShowdownCards} />;
                }
                const winner = showdownWinners[0];
                if (!winner) return null;
                const isMuckWin = winner.rank === "!";
                return (
                    <div key={`win-footer-${winner.uid || 'single'}`} className="flex flex-col items-center justify-start w-full gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 h-full mt-2">
                        <div className="flex items-center gap-3 bg-white/5 px-5 py-1 rounded-full border border-white/10 shadow-2xl">
                            <Trophy size={14} className="text-yellow-400 animate-bounce" />
                            <div className="text-sm md:text-xl font-black flex items-center gap-2 whitespace-nowrap uppercase leading-none">
                              <span className={getNeonNameColor(winner.name)}>{String(winner.name || '').toUpperCase()}</span>
                              {isMuckWin ? <span className="text-white ml-2">SCOOPED THE POT</span> : <><span className="text-white/50 font-black">WON TOTAL</span><span className="text-emerald-400 font-mono ml-2">+${(Number(winner.amount) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></>}
                            </div>
                        </div>
                        {!isMuckWin && (
                          <>
                            <div className="text-[10px] md:text-sm font-black text-white/70 tracking-widest uppercase">HOLDING <span className="text-yellow-400">{String(formatRank(winner.rank))}</span></div>
                            <div className="flex gap-1 justify-center mt-1 perspective-500">
                              {(winner.hand || []).map((c, ci) => (
                                <div key={`reveal-card-${ci}`} className="relative w-10 md:w-16 h-14 md:h-20">
                                    <div className={`w-full h-full transition-all duration-700 preserve-3d ${revealShowdownCards ? 'rotate-y-180' : ''}`} style={{ transitionDelay: `${ci * 100}ms` }}>
                                        <div className="absolute inset-0 bg-red-800 rounded shadow-2xl border-2 border-white/20 backface-hidden" />
                                        <div className={`absolute inset-0 bg-white rounded shadow-2xl text-black rotate-y-180 backface-hidden flex flex-col items-start justify-start p-1`}>
                                            <span className={`text-[11px] md:text-sm font-black leading-tight ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span>
                                            <span className={`text-[13px] md:text-xl leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                                        </div>
                                    </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                    </div>
                );
            })()
          ) : (
            <div className="flex flex-col gap-2 md:gap-4 items-center w-full h-full justify-start mt-2">
                {heroPlayerObj && (Number(heroPlayerObj.chips) || 0) < Number(bigBlind) && (phase === PHASES.IDLE || phase === PHASES.SHOWDOWN || heroPlayerObj.isFolded || heroPlayerObj.waitingForNextHand) ? (
                    <div className="flex flex-row items-center justify-between w-full max-w-[420px] p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl animate-pulse shadow-[0_0_30px_rgba(79,70,229,0.3)]">
                        <div className="flex flex-col items-start gap-0.5">
                            <span className="text-white/50 tracking-wider text-[10px] font-black italic uppercase">Broke in Arena</span>
                            <span className="text-indigo-400 text-[12px] font-mono font-black uppercase">Wallet: ${(Number(userProfile?.chips) || 0).toLocaleString()}</span>
                        </div>
                        <button onClick={()=>{ setRebuyAmount(100); setShowRebuyModal(true); }} className="px-5 py-3 bg-indigo-600 border border-indigo-400 rounded-xl font-black text-xs hover:scale-105 transition-transform flex items-center gap-2 uppercase shrink-0 shadow-lg active:scale-95"><Coins size={16}/> Re-buy</button>
                    </div>
                ) : heroPlayerObj && (Number(heroPlayerObj.chips) || 0) >= bigBlind * 0.01 && phase !== PHASES.IDLE ? (
                    <div className="flex flex-row gap-2 w-full max-w-[400px] items-stretch justify-center h-16 md:h-10">
                      <button onClick={() => { if (activeIdx === heroIdx) handleAction('FOLD'); else setPreAction(preAction === 'FOLD' ? null : 'FOLD'); }} className={`flex-1 bg-red-950/60 border rounded-xl text-[14px] md:text-xs font-black transition-all ${activeIdx === heroIdx ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : preAction === 'FOLD' ? 'border-emerald-400 ring-1' : 'border-red-500/20 opacity-60'}`}>{preAction === 'FOLD' && <Check size={10} className="text-emerald-400" />} FOLD</button>
                      <button onClick={() => { if (activeIdx === heroIdx) handleAction('CALL'); else setPreAction(preAction === 'CHECK' ? null : 'CHECK'); }} className={`flex-1 bg-white/10 border rounded-xl text-[14px] md:text-sm font-black transition-all px-2 flex items-center justify-center gap-1 ${activeIdx === heroIdx ? 'border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : preAction === 'CHECK' ? 'border-emerald-400 ring-1' : 'border-white/10 opacity-60'}`}>{preAction === 'CHECK' && <Check size={10} className="text-emerald-400" />} {activeIdx === heroIdx ? (highestBet > (Number(heroPlayerObj?.currentBet) || 0) + 0.005 ? `CALL $${(Number(highestBet) - (Number(heroPlayerObj?.currentBet) || 0)).toLocaleString()}` : 'CHECK') : 'CHECK'}</button>
                      <div className={`flex-[1.5] flex bg-black/60 border border-white/20 rounded-xl overflow-hidden transition-all ${activeIdx !== heroIdx ? 'opacity-20 grayscale' : ''}`}>
                        <button onClick={()=> { if(activeIdx === heroIdx) handleRaiseSubmit(raiseInput); }} className={`flex-1 ${Number(raiseInput) >= Number(effectiveMaxBet) ? 'bg-amber-600 border-amber-400' : 'bg-emerald-600 border-emerald-400'} border rounded-lg font-black text-[14px] md:text-xs active:scale-95 transition-all shadow-xl uppercase`}>
                          {Number(raiseInput) >= Number(effectiveMaxBet) ? 'ALL IN' : 'RAISE'}
                        </button>
                      </div>
                    </div>
                ) : (
                  <div className="flex flex-col items-center py-10 opacity-20 animate-pulse font-black uppercase"><span className="text-white text-sm italic tracking-[1em]">OBSERVING</span></div>
                )}
            </div>
          )}
        </div>
      </footer>

      {showVisualControls && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-3xl p-6" onClick={() => setShowVisualControls(false)}>
          <div className="w-full max-w-[400px] bg-black/80 border border-white/20 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-white/10 pb-4 font-black"><h3 className="text-lg text-cyan-400 uppercase flex items-center gap-2"><Settings2 size={20}/> Configuration</h3><X size={24} className="cursor-pointer text-white/40 hover:text-white" onClick={() => setShowVisualControls(false)}/></div>
            <div className="space-y-6 font-black">
              <button onClick={() => { if (currentRoomId) socket.emit('adminAddBot', { roomId: currentRoomId }); }} className="w-full py-4 bg-white/10 border border-white/20 text-white rounded-xl uppercase flex items-center justify-center gap-2 hover:bg-white/20 transition-all active:scale-95"><Bot size={18}/> Add Arena Bot</button>
              <div className="flex flex-col gap-4 pt-4 border-t border-white/10">
                <div className="flex flex-col gap-2"><label className="text-[10px] text-white/70 uppercase flex justify-between tracking-widest font-black">Table Zoom <span>{Math.round((visuals.tableZoom || 0) * 100)}%</span></label><input type="range" min="0.3" max="1.5" step="0.05" value={visuals.tableZoom} onChange={(e) => setVisuals({...visuals, tableZoom: Number(e.target.value)})} className="accent-cyan-400 cursor-pointer" /></div>
                <div className="flex flex-col gap-2"><label className="text-[10px] text-white/70 uppercase flex justify-between tracking-widest font-black">HUD Height <span>{visuals.footerHeight || 280}px</span></label><input type="range" min="150" max="350" step="10" value={visuals.footerHeight} onChange={(e) => setVisuals({...visuals, footerHeight: Number(e.target.value)})} className="accent-indigo-400 cursor-pointer" /></div>
                <div className="flex flex-col gap-2"><label className="text-[10px] text-white/70 uppercase flex justify-between tracking-widest font-black">Hero Card Scale <span>{(Number(visuals.heroCardScale) || 2.0).toFixed(2)}</span></label><input type="range" min="1.0" max="5.0" step="0.1" value={visuals.heroCardScale} onChange={(e) => setVisuals({...visuals, heroCardScale: Number(e.target.value)})} className="accent-emerald-400 cursor-pointer" /></div>
                <div className="flex flex-col gap-2"><label className="text-[10px] text-white/70 uppercase flex justify-between tracking-widest font-black">Hero Card Y <span>{visuals.heroCardY}px</span></label><input type="range" min="-300" max="300" step="1" value={visuals.heroCardY} onChange={(e) => setVisuals({...visuals, heroCardY: Number(e.target.value)})} className="accent-indigo-400 cursor-pointer" /></div>
                <div className="flex flex-col gap-2"><label className="text-[10px] text-white/70 uppercase flex justify-between tracking-widest font-black">Hero Card Spread <span>{(Number(visuals.heroCardSpread) || 3.0).toFixed(1)}</span></label><input type="range" min="0.5" max="10.0" step="0.5" value={visuals.heroCardSpread} onChange={(e) => setVisuals({...visuals, heroCardSpread: Number(e.target.value)})} className="accent-cyan-400 cursor-pointer" /></div>
              </div>
            </div>
            <button onClick={() => setShowVisualControls(false)} className="w-full py-4 bg-cyan-600 text-black rounded-xl uppercase font-black shadow-lg hover:brightness-110 active:scale-95">Save & Apply</button>
          </div>
        </div>
      )}

      <style>{`
          @keyframes announcement-pop { 0% { transform: scale(0.5); opacity: 0; filter: blur(10px); } 30% { transform: scale(1.1); opacity: 1; filter: blur(0px); } 70% { transform: scale(1); opacity: 1; filter: blur(0px); } 100% { transform: scale(1.3); opacity: 0; filter: blur(20px); } }
          .animate-announcement-pop { animation: announcement-pop 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          .perspective-500 { perspective: 500px; }
          .preserve-3d { transform-style: preserve-3d; }
          .backface-hidden { backface-visibility: hidden; }
          .rotate-y-180 { transform: rotateY(180deg); }
          @keyframes action-status-in { 0% { opacity: 0; transform: translateY(10px) scale(0.9); } 50% { opacity: 1; transform: translateY(-2px) scale(1.1); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
          .animate-action-status-in { animation: action-status-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          html, body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; background: #000; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .vertical-range { -webkit-appearance: slider-vertical; width: 32px; height: 100%; background: rgba(255, 255, 255, 0.1); outline: none; border-radius: 999px; }
          .vertical-range::-webkit-slider-thumb { -webkit-appearance: none; width: 32px; height: 32px; background: rgba(16, 185, 129, 0.5); border: 4px solid #10b981; border-radius: 50%; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default App;
