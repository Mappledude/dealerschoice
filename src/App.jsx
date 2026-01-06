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

const VERSION = "v1.7.15-PRO";
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
  { x: 0, y: -160 },   { x: 100, y: -110 }, { x: 130, y: 0 },    { x: 100, y: 110 },  { x: 60, y: 130 },    
  { x: 0, y: 150 },    { x: -60, y: 130 },  { x: -100, y: 110 }, { x: -130, y: 0 },   { x: -100, y: -110 } 
];

const VARIANTS = { 
  HOLDEM: { 
    id: 'HOLDEM', 
    name: 'Texas Hold\'em', 
    desc: '2 Hole Cards',
    rules: [
      "Each player receives 2 hole cards.",
      "Use any combination of hole and community cards to make the best 5-card hand.",
      "Standard high hand poker ranking."
    ]
  }, 
  OMAHA: { 
    id: 'OMAHA', 
    name: 'OMAHA', 
    desc: '4 Hole Cards (Exactly 2 Hole + 3 Board)',
    rules: [
      "Each player receives 4 hole cards.",
      "STRICT RULE: You MUST use exactly 2 cards from your hand and exactly 3 cards from the board.",
      "Standard high hand ranking."
    ]
  }, 
  PINEAPPLE: { 
    id: 'PINEAPPLE', 
    name: 'Pineapple', 
    desc: '3 Hole Cards',
    rules: [
      "Each player receives 3 hole cards.",
      "Evaluation uses standard high-hand rankings using any combination."
    ]
  }, 
  MUFLIS: { 
    id: 'MUFLIS', 
    name: 'Muflis', 
    desc: 'Low Hand Wins (Ace is 1)',
    rules: [
      "Weakest hand wins the pot.",
      "Ace is treated as 1 (lowest).",
      "Standard rankings are flipped: High Card beats Pair, etc."
    ]
  }, 
  HILOW: { 
    id: 'HILOW', 
    name: 'Hi-Low Split', 
    desc: '4 Hole Cards',
    rules: [
      "Each player receives 4 hole cards.",
      "PARTITION RULE: Use 2 cards for High and the remaining 2 for Low.",
      "Combine your pairs with exactly 3 cards from the community board.",
      "Low hand winner is the absolute lowest hand (no qualifier).",
      "Pot is split 50/50 between High and Low winners."
    ]
  }, 
  REDSBLACKS: { 
    id: 'REDSBLACKS', 
    name: 'Reds & Blacks', 
    desc: 'Dynamic Joker mechanic',
    rules: [
      "Each player receives 4 hole cards.",
      "JOKER: Formed by 2 Red + 1 Black OR 2 Black + 1 Red cards.",
      "If you have a Joker, you use (Joker + 4th Hole Card) + 3 board cards.",
      "NATURAL: If all 4 cards are one color, use any 2 hole cards + 3 board cards."
    ]
  }
};

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  isDealer, potTransferring, timeRemaining, isHero, 
  relativeIdx, seatIdx, visuals, showdownWinnersCount, isDefaultWin
}) => {
    if (!player || !displayPos) return null;
    const isRevealed = isHero || (phase === PHASES.SHOWDOWN && !isDefaultWin);
    
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };
    const currentCardScale = isHero ? visuals.heroCardScale : visuals.oppCardScale;
    const currentCardY = isHero ? visuals.heroCardY : visuals.oppCardY;

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'} ${player.waitingForNextHand ? 'opacity-50' : ''}`}>
            {player.waitingForNextHand && (
                <div className="absolute top-[-20px] bg-slate-800 text-white text-[8px] px-2 py-0.5 rounded border border-white/20 uppercase font-black tracking-widest z-[150]">Waiting...</div>
            )}
            {player.lastAction && !isActiveTurn && !isCollectingBets && !player.waitingForNextHand && (
              <div className="absolute top-[-30px] animate-bounce-short z-[200]">
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase border border-white/20 ${
                  player.lastAction === 'FOLD' ? 'bg-red-600 text-white' : 
                  player.lastAction === 'RAISE' ? 'bg-amber-500 text-black' : 
                  'bg-blue-600 text-white'
                }`} style={{ transform: `scale(${visuals.betScale}) translateY(${visuals.betY}px)` }}>{String(player.lastAction)}</span>
              </div>
            )}
            {player.currentBet > 0 && (
                <div className={`absolute z-[100] transition-all duration-700 ${isCollectingBets ? 'animate-fling-to-pot' : 'animate-bet-splash'}`}
                    style={{ 
                      transform: `translate(calc(-50% + ${betOffset.x}px), ${betOffset.y + visuals.betY}px) scale(${visuals.betScale})`, 
                      left: '50%', 
                      top: '50%' 
                    }}>
                    <div className="bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-black text-[9px] md:text-[12px] px-2 py-0.5 rounded-full shadow-[0_4px_0_rgba(0,0,0,0.4),0_8px_15px_rgba(0,0,0,0.6)] border border-white/30 flex items-center gap-1 whitespace-nowrap">
                        <Coins size={8} className="animate-pulse" />
                        ${String(player.currentBet)}
                    </div>
                </div>
            )}
            <div style={{ transform: `translateY(${visuals.badgeY}px)` }}
                className={`relative z-50 flex flex-col items-center p-1 rounded-xl border bg-slate-900/95 backdrop-blur-md transition-all duration-300 min-w-[84px] md:min-w-[180px] shadow-2xl ${isActiveTurn ? 'border-cyan-400 ring-2 ring-cyan-400/40 scale-105 shadow-[0_0_200px_rgba(34,211,238,0.2)]' : 'border-white/10'} ${player.isWinner && phase === PHASES.SHOWDOWN ? 'border-yellow-400 animate-pulse-glow' : ''}`}>
                {isDealer && ( <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white shadow-[0_0_12px_rgba(220,38,38,0.9)] animate-pulse z-[110]" /> )}
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="absolute -top-1 w-full px-1.5 h-1 z-[60]">
                        <div className="w-full h-full bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400 transition-all duration-1000 linear" style={{ width: `${(timeRemaining / 15) * 100}%` }} />
                        </div>
                    </div>
                )}
                <div className="flex flex-col items-center gap-0 w-full">
                    <div className="flex items-center gap-1">
                      {player.isBot && <Bot size={8} className="text-indigo-400" />}
                      <span className="text-[8.5px] md:text-[14.5px] font-black text-white/90 uppercase tracking-tight truncate max-w-[60px] md:max-w-[100px]">{String(player.name || "Anon")}</span>
                    </div>
                    <span className={`text-[11px] md:text-[17px] font-mono font-black ${player.chips <= 1 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>${Number(player.chips).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
            </div>
            {player.hand && Array.isArray(player.hand) && !player.isFolded && !player.waitingForNextHand && (
                <div className="relative z-10 flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible">
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const offset = ci - mid;
                        const fanRotation = offset * visuals.holeCardFan;
                        const fanTranslation = offset * (player.hand.length > 2 ? 2.0 : 3.5);
                        const isRed = c.suit === '♥' || c.suit === '♦';
                        return (
                          <div key={c.id || ci} 
                              className={`w-[5vw] md:w-[3vw] h-[7vw] md:h-[5vw] rounded-[3px] flex flex-col items-start p-[2px] border shadow-xl absolute transition-all duration-300 animate-deal-card ${isRevealed ? 'bg-white text-black' : 'bg-slate-800'} ${isRevealed && player.isWinner && (winning5Ids || []).includes(c.id) ? 'ring-2 ring-yellow-400 scale-110 z-30 shadow-[0_0_200px_#fbbf24]' : 'border-white/20'}`} 
                              style={{ transform: `translateX(${fanTranslation}vw) rotate(${fanRotation}deg) scale(${currentCardScale})`, transformOrigin: 'bottom center', top: `${currentCardY}px`, animationDelay: `${ci * 0.1}s` }}>
                              {isRevealed && ( <><span className={`text-[9px] md:text-[12px] font-black leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>{String(c.value)}</span><span className={`text-[11px] md:text-[16px] leading-none ${isRed ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span></> )}
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
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [activeVariant, setActiveVariant] = useState(VARIANTS.HOLDEM);
  const [pendingVariantId, setPendingVariantId] = useState('HOLDEM');
  const [community, setCommunity] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dealerIdx, setDealerIdx] = useState(-1);
  const [highestBet, setHighestBet] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([{ id: 'init', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), name: 'SYSTEM', action: 'INTELLIGENCE LINK ESTABLISHED', type: 'phase' }]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(15); 
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState(10); 
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potAnimating, setPotAnimating] = useState(false);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [currentShowdownIdx, setCurrentShowdownIdx] = useState(0);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [showVisualControls, setShowVisualControls] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [expandedHands, setExpandedHands] = useState(new Set()); 
  const [copySuccess, setCopySuccess] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const joinLock = useRef(false);
  
  const [editingProfile, setEditingProfile] = useState(null);
  const [editFormData, setEditFormData] = useState({ chips: 0, password: '' });

  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 100, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10, pendingVariant: 'HOLDEM' });

  const isMobile = window.innerWidth < 768;
  const headerHeight = isMobile ? 56 : 72; 

  const [visuals, setVisuals] = useState({
    heroCardScale: 4.0, heroCardY: 22, oppCardScale: 1.0, oppCardY: -25,
    commCardScale: 1.8, commCardY: -7, betScale: 2.0, betY: 47,
    badgeY: 85, 
    footerHeight: 270, 
    tableZoom: window.innerWidth < 768 ? 0.75 : 0.85, 
    holeCardFan: 25
  });

  const footerHeight = visuals.footerHeight;
  const tableZoom = visuals.tableZoom;
  const logEndRef = useRef(null);

  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => p && (p.uid === userProfile.uid || p.name === userProfile.name));
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => heroIdx !== -1 ? players[heroIdx] : null, [players, heroIdx]);
  const heroWinProb = useMemo(() => heroPlayerObj?.winProbability || 0, [heroPlayerObj]);
  const heroLowWinProb = useMemo(() => heroPlayerObj?.lowWinProbability || 0, [heroPlayerObj]);

  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + (Number(p?.currentBet) || 0), 0);
    return Number(potAmount) + currentBetsSum;
  }, [potAmount, players]);

  const isBrokeStatus = useMemo(() => {
    if (!heroPlayerObj) return false;
    const isOutOfChips = Number(heroPlayerObj.chips) <= 1;
    const hasNoActiveBet = Number(heroPlayerObj.currentBet) <= 0;
    const isHandResolved = phase === PHASES.IDLE;
    return isOutOfChips && hasNoActiveBet && isHandResolved;
  }, [heroPlayerObj, phase]);

  const isDefaultWin = useMemo(() => 
    showdownWinners?.length > 0 && showdownWinners.every(w => w.rank === "!"),
    [showdownWinners]
  );

  const groupedLogs = useMemo(() => {
    const hands = [];
    let currentHand = { id: 'init-hand', actions: [], summaries: [], variantName: 'Standard', isOngoing: true, winnerSummary: "In Progress..." };
    
    logs.forEach((log) => {
      const actRaw = log.action.toUpperCase();
      const isHandStart = log.name === 'SYSTEM' && (actRaw.includes('IS DEALING') || actRaw.includes('HAND START'));
      
      if (isHandStart) {
        if (currentHand.actions.length > 0) {
          currentHand.isOngoing = false;
          if (currentHand.summaries.length > 0) {
            currentHand.winnerSummary = currentHand.summaries.map(s => 
              `${s.name} won ${s.amount} w/ ${s.rank} ${s.cards}`
            ).join('; ');
          } else {
            currentHand.winnerSummary = "Pot Swept / Hand Reset";
          }
          hands.push(currentHand);
        }
        
        let detectedVariant = 'Standard';
        Object.values(VARIANTS).forEach(v => {
           if (actRaw.includes(v.name.toUpperCase()) || actRaw.includes(v.id.toUpperCase())) {
             detectedVariant = v.name;
           }
        });

        currentHand = { 
          id: log.id, 
          actions: [log], 
          summaries: [], 
          variantName: detectedVariant,
          isOngoing: true,
          winnerSummary: "Live actions..."
        };
      } else {
        currentHand.actions.push(log);
        if (log.type === 'win') {
          const amtMatch = log.action.match(/\$(\d+\.?\d*)/);
          const rankMatch = log.action.split('WITH ')[1];
          const isSweep = actRaw.includes("WON!");
          const matchWinner = showdownWinners?.find(w => w.name === log.name);
          const cardStr = matchWinner?.hand?.map(c => `${c.value}${c.suit}`).join(', ') || '';

          currentHand.summaries.push({
            name: log.name,
            amount: amtMatch ? amtMatch[0] : (isSweep ? "Pot" : ""),
            rank: isSweep ? " Everyone Folded" : (rankMatch || "Winning Hand"),
            cards: cardStr ? `[${cardStr}]` : ""
          });
        }
      }
    });
    
    if (currentHand.actions.length > 0) {
       if (!currentHand.isOngoing && currentHand.summaries.length > 0) {
          currentHand.winnerSummary = currentHand.summaries.map(s => 
            `${s.name} won ${s.amount} w/ ${s.rank} ${s.cards}`
          ).join('; ');
       }
       hands.push(currentHand);
    }
    return hands.reverse(); 
  }, [logs, showdownWinners]);

  const toggleHandExpansion = (id) => {
    setExpandedHands(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (intelExpanded) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, intelExpanded]);

  const handleAction = useCallback((type, amt = 0) => {
    const finalAmount = amt !== 0 ? amt : raiseInput;
    if (currentRoomId) socket.emit('playerAction', { roomId: currentRoomId, type, amount: type === 'RAISE' ? Number(finalAmount) : 0 });
  }, [currentRoomId, raiseInput]);

  const handleAllIn = useCallback(() => {
    if (!heroPlayerObj) return;
    const totalStack = Number(heroPlayerObj.chips) + Number(heroPlayerObj.currentBet);
    handleAction('RAISE', totalStack);
  }, [heroPlayerObj, handleAction]);

  const addBot = useCallback(() => { 
    if (currentRoomId && isConnected) {
      socket.emit('adminAddBot', { roomId: currentRoomId });
    }
  }, [currentRoomId, isConnected]);

  const handleCreatePlayer = useCallback(() => {
    if (!newPlayer.name) return;
    socket.emit('adminCreatePlayer', { ...newPlayer, password: newPlayer.password.toLowerCase(), uid: Math.random().toString(36).slice(2) });
    setNewPlayer({ name: '', chips: 100, password: '' });
  }, [newPlayer]);

  const handleSpawnArena = useCallback(() => {
    if (!newTable.name) return;
    socket.emit('adminCreateRoom', { ...newTable, id: 'room_' + Math.random().toString(36).slice(2, 9) });
    setNewTable({ name: '', sb: 0.25, bb: 0.50, minBuy: 5, maxBuy: 10, pendingVariant: 'HOLDEM' });
  }, [newTable]);

  const handleNuclear = useCallback(() => {
      if (!nuclearConfirm) {
          setNuclearConfirm(true);
          setTimeout(() => setNuclearConfirm(false), 3000);
          return;
      }
      socket.emit('adminNuclearReset');
      setNuclearConfirm(false);
  }, [nuclearConfirm]);

  const handleCopyLogs = useCallback(() => {
    const text = logs.map(l => `[${l.time}] ${l.name}: ${l.action}`).join('\n');
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {}
    document.body.removeChild(textArea);
  }, [logs]);

  const handleLogin = useCallback(() => { 
    if (passwordInput.toLowerCase().trim() === 'pass') { 
        setUserProfile({ name: 'SYSTEM ADMIN', uid: 'admin_sys', role: 'admin' }); 
        setCurrentView(VIEWS.ADMIN); socket.emit('getInitialData'); 
    } else socket.emit('playerLogin', { password: passwordInput.toLowerCase() });
  }, [passwordInput]);

  const joinRoom = useCallback(() => {
    if (!selectedTableForJoin || !userProfile || joinLock.current) return;
    joinLock.current = true;
    setIsJoining(true);
    socket.emit('joinRoom', { 
        roomId: selectedTableForJoin.id, 
        profile: { ...userProfile, pendingVariant: pendingVariantId }, 
        buyIn: Math.min(buyInAmount, userProfile.chips) 
    }, (res) => {
        joinLock.current = false;
        setIsJoining(false);
        if (res?.status === 'ok') { 
            setCurrentRoomId(selectedTableForJoin.id); 
            setCurrentView(VIEWS.GAME); 
            setSelectedTableForJoin(null); 
        }
    });
  }, [selectedTableForJoin, userProfile, pendingVariantId, buyInAmount]);

  const handleUpdateProfile = useCallback(() => {
      if (!editingProfile) return;
      socket.emit('adminUpdatePlayer', {
          uid: editingProfile.uid,
          chips: Number(editFormData.chips),
          password: editFormData.password !== "" ? editFormData.password.toLowerCase() : undefined
      });
      setEditingProfile(null);
  }, [editingProfile, editFormData]);

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    socket.on('initialDataResponse', (data) => {
      if (data.rooms) setActiveTables(data.rooms);
      if (data.profiles) setAllProfiles(data.profiles);
    });

    const handleRoomUpdate = (d) => {
        if (!d) {
          setPlayers(INITIAL_PLAYERS); setPhase(PHASES.IDLE); setCommunity([]); setPotAmount(0);
          setActiveIdx(-1); setHighestBet(0); setDealerIdx(-1); setWinning5Ids([]);
          setShowdownWinners(null); setPotTransferring(false); return;
        }
        setPlayers(() => { 
          const next = Array(TOTAL_SEATS).fill(null); 
          (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
          return next; 
        });
        setPhase(d.phase); setCommunity(d.community || []); setPotAmount(d.potAmount || d.potData?.[0]?.amount || 0);
        setActiveIdx(d.activeIdx ?? -1); setHighestBet(d.highestBet || 0); setDealerIdx(d.dealerIdx ?? -1);
        setTimeRemaining(d.timeRemaining !== undefined ? Math.max(0, d.timeRemaining) : 0);
        if (d.activeVariant) {
            const vId = typeof d.activeVariant === 'string' ? d.activeVariant : d.activeVariant.id;
            setActiveVariant(VARIANTS[vId] || { id: vId, name: d.activeVariant.name || vId, rules: [] });
        }
        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true);
            setCurrentShowdownIdx(0);
            const rawWinners = d.showdownWinners || [];
            const sortedWinners = [...rawWinners].sort((a, b) => {
               const aLow = String(a.rank).toUpperCase().includes('LOW');
               const bLow = String(b.rank).toUpperCase().includes('LOW');
               if (aLow && !bLow) return -1;
               if (!aLow && bLow) return 1;
               return 0;
            });
            setShowdownWinners(sortedWinners);
            setWinning5Ids(d.winning5Ids || []);
            
            const variantId = d.activeVariant?.id || 'HOLDEM';
            const isDefWin = sortedWinners.length > 0 && sortedWinners.every(w => w.rank === "!");
            
            let totalDuration = 5000;
            if (isDefWin) {
                totalDuration = 1500;
            } else if (variantId === 'HILOW') {
                totalDuration = 10000;
            }
            
            const durationPerWinner = totalDuration / sortedWinners.length;
            
            if (sortedWinners.length > 1) {
                for (let i = 1; i < sortedWinners.length; i++) {
                    setTimeout(() => setCurrentShowdownIdx(i), i * durationPerWinner);
                }
            }
            setTimeout(() => setPotTransferring(false), totalDuration);
        }
    };
    socket.on('roomUpdate', handleRoomUpdate);
    socket.on('lobbyUpdate', (list) => setActiveTables(list || []));
    socket.on('profilesUpdate', (list) => { 
        setAllProfiles(list || []); 
        setUserProfile(prev => { 
            if (!prev) return prev; 
            const me = list?.find(p => p.uid === prev.uid || p.name === prev.name); 
            return me ? { ...prev, chips: me.chips } : prev; 
        }); 
    });
    socket.on('loginSuccess', (p) => { setUserProfile(p); setPendingVariantId(p.pendingVariant || 'HOLDEM'); setCurrentView(VIEWS.LOBBY); socket.emit('getInitialData'); });
    socket.on('log', (d) => setLogs(prev => [...prev, { id: Math.random() + '-' + Date.now(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), ...d }].slice(-100)));
    
    socket.emit('getInitialData');
    
    return () => { 
      socket.off('connect'); socket.off('disconnect');
      socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); 
      socket.off('initialDataResponse'); socket.off('loginSuccess'); socket.off('log'); 
    };
  }, []);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white uppercase font-black">
        <div className="w-full max-w-[400px] p-8 md:p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8">
            <Lock size={32} className="text-[#fbbf24]" />
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-xl font-black uppercase"/>
            <button onClick={handleLogin} className="w-full p-6 bg-[#fbbf24] text-black rounded-2xl font-black text-lg transition-transform uppercase">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white uppercase font-black overflow-hidden pt-[env(safe-area-inset-top)] relative">
        {editingProfile && (
            <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
                <div className="w-full max-w-[400px] bg-slate-900 border-2 border-cyan-500 rounded-3xl p-8 flex flex-col gap-6 shadow-[0_0_80px_rgba(34,211,238,0.2)]">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h3 className="text-xl text-cyan-400 flex items-center gap-2">
                           <Edit3 size={20}/> EDIT {editingProfile.name}
                        </h3>
                        <button onClick={() => setEditingProfile(null)} className="text-white/40 hover:text-white"><X/></button>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-white/40">WALLET BALANCE</label>
                            <input type="number" value={editFormData.chips} onChange={e=>setEditFormData({...editFormData, chips: e.target.value})} className="bg-black/40 border border-white/10 p-4 rounded-xl text-[#fbbf24] font-mono outline-none"/>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-white/40">NEW PASSWORD (OPTIONAL)</label>
                            <input type="text" value={editFormData.password} onChange={e=>setEditFormData({...editFormData, password: e.target.value})} placeholder="••••••••" className="bg-black/40 border border-white/10 p-4 rounded-xl text-white outline-none"/>
                        </div>
                    </div>
                    <button onClick={handleUpdateProfile} className="w-full py-5 bg-cyan-600 hover:bg-cyan-500 rounded-2xl transition-all shadow-lg active:scale-95 text-black">SAVE CHANGES</button>
                </div>
            </div>
        )}

        <aside className="w-full md:w-64 border-b md:border-r border-white/10 p-3 md:p-8 flex flex-row md:flex-col gap-2 md:gap-4 bg-black/20 shrink-0">
            <h2 className="hidden md:flex text-[#fbbf24] items-center gap-2 mb-4"><ShieldCheck size={20}/> ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl text-[9px] md:text-xs font-black ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black' : 'bg-white/5'}`}>TABLES</button>
            <button onClick={handleNuclear} className={`flex-1 md:flex-none p-2.5 md:p-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all uppercase ${nuclearConfirm ? 'bg-red-600 border-white text-white' : 'bg-white/5 text-red-500 border-red-500/20'}`}>
                <Bomb size={14}/> {nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}
            </button>
            <button onClick={()=>setCurrentView(VIEWS.LOBBY)} className="flex-1 md:flex-none p-2.5 md:p-4 rounded-xl bg-cyan-600 text-black font-black text-[9px] md:text-xs">BACK TO LOBBY</button>
        </aside>
        <main className="flex-1 p-5 md:p-12 overflow-y-auto bg-black/40">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-[#fbbf24] pl-4">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 border border-white/10">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PASS" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm"/>
                        <button onClick={handleCreatePlayer} className="bg-[#fbbf24] text-black rounded-xl font-black p-3 text-sm">CREATE</button>
                    </div>
                    <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                        {allProfiles.map(p => (
                            <div key={p.uid} className="flex justify-between p-3 md:p-4 border-b border-white/5 items-center hover:bg-white/5">
                                <span className="text-[10px] md:text-sm font-black truncate max-w-[100px]">{String(p.name)}</span>
                                <div className="flex gap-2 md:gap-4 items-center">
                                  <span className="text-emerald-400 font-mono text-xs md:text-lg">${Number(p.chips || 0).toLocaleString()}</span>
                                  <button 
                                    onClick={()=>{
                                      setEditingProfile(p);
                                      setEditFormData({ chips: p.chips || 0, password: '' });
                                    }} 
                                    className="text-cyan-400 p-2 hover:bg-white/5 rounded-lg transition-colors"
                                  >
                                    <Edit3 size={14}/>
                                  </button>
                                  <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="text-red-500 p-2 hover:bg-white/5 rounded-lg transition-colors"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-5 md:gap-8">
                    <h3 className="text-lg md:text-xl border-l-4 border-emerald-500 pl-4">ARENA CONTROL</h3>
                    <div className="bg-white/5 p-4 md:p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border border-white/10">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="ARENA NAME" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm"/>
                        <div className="flex gap-2">
                          <input type="number" step="0.05" value={newTable.sb} onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})} placeholder="SB" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm w-1/2"/>
                          <input type="number" step="0.05" value={newTable.bb} onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})} placeholder="BB" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm w-1/2"/>
                        </div>
                        <div className="flex gap-2">
                          <input type="number" value={newTable.minBuy} onChange={e=>setNewTable({...newTable, minBuy: Number(e.target.value)})} placeholder="MIN BUY" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm w-1/2"/>
                          <input type="number" value={newTable.maxBuy} onChange={e=>setNewTable({...newTable, maxBuy: Number(e.target.value)})} placeholder="MAX BUY" className="bg-black/40 p-3 rounded-xl border border-white/10 outline-none uppercase text-white text-sm w-1/2"/>
                        </div>
                        <button onClick={handleSpawnArena} className="bg-emerald-600 text-white rounded-xl font-black p-3 text-sm lg:col-span-3">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 md:gap-4">
                        {activeTables.map(t => (
                            <div key={t.id} className="bg-white/5 p-3 rounded-2xl flex justify-between items-center border border-white/10">
                              <div>
                                <h4 className="text-[#fbbf24] font-black text-xs md:text-base">{String(t.name)}</h4>
                                <p className="text-[8px] text-white/40 tracking-widest uppercase">${t.sb}/${t.bb} • Buy-in: ${t.minBuy}-${t.maxBuy}</p>
                              </div>
                              <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-950/40 px-2 py-1.5 rounded-xl text-red-500 font-black text-[8px]">TERMINATE</button>
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
        {selectedTableForJoin && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
              <div className="w-full max-w-[400px] p-8 bg-slate-900 border border-[#fbbf24]/30 rounded-3xl shadow-2xl flex flex-col gap-6 md:gap-10">
                <h3 className="text-xl md:text-3xl text-center text-[#fbbf24] underline underline-offset-8 uppercase font-black">{String(selectedTableForJoin.name)}</h3>
                <div className="space-y-4 font-black text-center uppercase">
                  <div className="flex justify-between items-center text-[10px] text-white/40 tracking-widest font-black"><span>BUY-IN AMOUNT</span><span className="text-emerald-400 text-lg md:text-2xl font-mono">${Math.min(buyInAmount, userProfile?.chips || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <input type="range" min={selectedTableForJoin.minBuy || 5} max={Math.min(selectedTableForJoin.maxBuy || 10, userProfile?.chips || 10)} step={0.25} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#fbbf24]" />
                </div>
                <div className="flex gap-4"><button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black text-[10px] uppercase">BACK</button><button onClick={joinRoom} disabled={isJoining} className={`flex-2 p-3.5 rounded-2xl shadow-lg transition-all text-[10px] tracking-widest font-black uppercase ${isJoining ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-emerald-600 hover:scale-105 active:scale-95'}`}>{isJoining ? 'Joining...' : 'SIT DOWN'}</button></div>
              </div>
            </div>
        )}
        <header className="h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-5 md:px-12 bg-black/40 backdrop-blur-md shadow-xl shrink-0 pt-[env(safe-area-inset-top)]">
          <h2 className="tracking-[0.2em] md:tracking-[0.4em] text-xs md:text-xl flex items-center gap-2 md:gap-4 font-black"><LayoutGrid className="text-[#fbbf24] w-3 md:w-6"/> LOBBY</h2>
          <div className="flex items-center gap-3 md:gap-10 font-black">
            <div className="flex flex-col items-end"><span className="text-[7px] text-white/40 uppercase italic truncate max-w-[50px] md:max-w-none">{String(userProfile?.name || "??")}</span><span className="text-emerald-400 font-mono text-xs md:text-2xl tracking-tighter">${Number(userProfile?.chips || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="text-white/20 hover:text-red-500 transition-all"><LogOut size={16}/></button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-[#06080c] scroll-smooth pt-4 px-2 md:px-12 pb-32">
            <div className="max-w-[1200px] mx-auto">
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/10 text-white/40 text-[10px] tracking-[0.2em] font-black uppercase">
                <div className="col-span-3">Arena Name</div>
                <div className="col-span-2 text-center">Stakes</div>
                <div className="col-span-4 text-center">Seated Players</div>
                <div className="col-span-1 text-center">Seats</div>
                <div className="col-span-2"></div>
              </div>

              {activeTables.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 text-white/20 gap-4 uppercase font-black">
                  <ShieldAlert size={48} />
                  <span className="text-sm tracking-[0.4em]">NO ACTIVE ARENAS</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  {activeTables.map((t) => (
                    <div key={t.id} className="bg-white/5 border border-white/5 rounded-xl md:rounded-2xl p-3 md:p-0 transition-all hover:bg-white/10 group">
                      <div className="hidden md:grid grid-cols-12 items-center gap-4 px-6 py-4">
                        <div className="col-span-3">
                          <h3 className="text-lg text-white font-black truncate">{String(t.name)}</h3>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-[#fbbf24] font-black">${t.sb}/${t.bb}</span>
                        </div>
                        <div className="col-span-4 flex flex-wrap justify-center gap-1">
                          {t.players?.filter(p => p).length > 0 ? t.players.filter(p => p).map((p, idx) => (
                            <div key={idx} className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                              {p.isBot && <Bot size={10} className="text-indigo-400 shrink-0" />}
                              <span className="text-[10px] text-white/80 font-black">{String(p.name)}</span>
                            </div>
                          )) : <span className="text-white/20 text-xs italic">Empty</span>}
                        </div>
                        <div className="col-span-1 text-center">
                          <span className="text-white/80 font-mono font-black">{t.players?.filter(p=>p).length || 0}/10</span>
                        </div>
                        <div className="col-span-2">
                          <button onClick={()=>setSelectedTableForJoin(t)} className="w-full py-3 bg-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-500 transition-colors">Enter</button>
                        </div>
                      </div>

                      <div className="flex md:hidden flex-col gap-2">
                         <div className="flex items-center justify-between gap-3">
                            <div className="flex flex-col min-w-0 flex-1">
                               <h3 className="text-[13px] text-white font-black truncate uppercase leading-tight">{String(t.name)}</h3>
                               <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[#fbbf24] text-[10px] font-black">${t.sb}/${t.bb}</span>
                                  <span className="text-white/20 text-[10px]">|</span>
                                  <span className="text-white/60 text-[10px] font-mono">{t.players?.filter(p=>p).length || 0}/10 SEATS</span>
                               </div>
                            </div>
                            <button onClick={()=>setSelectedTableForJoin(t)} className="px-5 py-3 bg-emerald-600 rounded-lg text-[10px] font-black uppercase shadow-lg active:scale-95 transition-transform">ENTER</button>
                         </div>
                         <div className="flex flex-wrap gap-1 border-t border-white/5 pt-2 mt-1">
                            {t.players?.filter(p => p).map((p, idx) => (
                              <div key={idx} className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded">
                                {p.isBot && <Bot size={8} className="text-indigo-400 shrink-0" />}
                                <span className="text-[8px] text-white/60 font-black">{String(p.name)}</span>
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      {intelExpanded && (
        <div onClick={() => setIntelExpanded(false)} className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-md p-6 pt-[100px] flex flex-col gap-4 animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[950px] mx-auto bg-slate-900/95 border border-white/10 rounded-3xl p-6 flex flex-col flex-1 overflow-hidden shadow-2xl mb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-2"><Eye className="text-[#fbbf24]" size={20} /><h3 className="text-xl text-[#fbbf24] font-black uppercase tracking-widest">Intelligence Access</h3></div>
                <div className="flex items-center gap-3">
                  <button onClick={handleCopyLogs} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${copySuccess ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-[#fbbf24] hover:bg-white/10'}`}>
                    {copySuccess ? <Check size={14}/> : <Copy size={14}/>} {copySuccess ? 'Copied' : 'Copy Logs'}
                  </button>
                  <button onClick={() => setIntelExpanded(false)} className="text-white/40 hover:text-white"><X size={24} /></button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide font-mono text-xs md:text-sm">
                {groupedLogs.map((hand, hIdx) => {
                  const isExpanded = expandedHands.has(hand.id) || (hIdx === 0 && hand.isOngoing);
                  return (
                    <div key={hand.id} className="flex flex-col border border-white/5 rounded-2xl bg-black/40 overflow-hidden shadow-lg group">
                      <button 
                        onClick={() => toggleHandExpansion(hand.id)}
                        className={`flex flex-col items-start p-4 gap-2 transition-colors ${isExpanded ? 'bg-white/5' : 'hover:bg-white/10'}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-4 overflow-hidden w-full">
                            {isExpanded ? <ChevronDown size={14} className="text-white/40"/> : <ChevronRight size={14} className="text-white/40"/>}
                            <span className="text-[12px] font-black uppercase text-[#fbbf24] tracking-[0.2em] border-b border-[#fbbf24]/30 pb-0.5 shrink-0">
                              {hand.variantName} Hand
                            </span>
                            {!isExpanded && (
                                <span className="text-[11px] text-white/60 truncate font-black tracking-tight leading-tight italic ml-2 border-l border-white/10 pl-4 uppercase">
                                    {hand.winnerSummary}
                                </span>
                            )}
                          </div>
                          {hand.isOngoing && <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30 animate-pulse uppercase ml-2">Active</span>}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="flex flex-col border-t border-white/5 bg-black/60 animate-in slide-in-from-top-2 duration-300">
                          {hand.actions.map(l => {
                             let tag = "";
                             let colorClass = "bg-white/5 text-white/50 border-white/10";
                             const act = l.action.toUpperCase();
                             
                             if (l.type === 'win' || act.includes('WON')) { 
                               tag = "[SHOWDOWN]"; 
                               colorClass = "bg-purple-500/20 text-purple-400 border-purple-500/30"; 
                             }
                             else if (l.type === 'variant' || act.includes('CHOSEN') || act.includes('CHOICE') || act.includes('DEALER CHOICE')) { 
                               tag = "[DEALER'S CHOICE]"; 
                               colorClass = "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"; 
                             }
                             else if (act.includes('RAISED')) {
                               tag = "[RAISE]";
                               colorClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                             }
                             else if (act.includes('CALLED') || act.includes('POSTED')) {
                               tag = "[CALL/POST]";
                               colorClass = "bg-white/10 text-white/90 border-white/20";
                             }
                             else if (act.includes('BET')) {
                               tag = "[BET]";
                               colorClass = "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
                             }
                             else if (act.includes('CHECKED')) {
                               tag = "[CHECK]";
                               colorClass = "bg-slate-500/10 text-slate-300 border-slate-500/20";
                             }
                             else if (l.type === 'phase' || act.includes('DEALING') || act.includes('DEALT') || act.includes('START')) {
                               if (act.includes('FLOP') || act.includes('TURN') || act.includes('RIVER')) { 
                                 tag = "[DEALER]"; 
                                 colorClass = "bg-cyan-500/20 text-cyan-400 border-cyan-400/30"; 
                               } else {
                                 tag = "[DEALER]"; 
                                 colorClass = "bg-yellow-500/10 text-yellow-500/60 border-yellow-500/20"; 
                               }
                             }
                             else if (act.includes('NUCLEAR') || act.includes('RESET')) { 
                               tag = "[SYSTEM]"; 
                               colorClass = "bg-red-500/20 text-red-400 border-red-500/30"; 
                             }
                             else if (act.includes('JOINED') || act.includes('LEFT') || act.includes('ENTERED')) { 
                               tag = "[SYSTEM]"; 
                               colorClass = "bg-slate-500/10 text-slate-400 border-slate-500/20"; 
                             }
                             else if (l.type === 'fold' || act.includes('FOLDED')) { 
                               tag = "[FOLD]"; 
                               colorClass = "bg-red-500/10 text-red-400 border-red-500/20"; 
                             }
                             else { tag = "[PLAY]"; }

                             return (
                               <div key={l.id} className="flex items-start gap-3 p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                                 <span className="text-white/20 text-[10px] w-12 shrink-0 font-black pt-0.5">{String(l.time)}</span>
                                 <div className="flex flex-wrap items-center gap-2 overflow-hidden">
                                   <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border shrink-0 ${colorClass}`}>
                                     {tag}
                                   </span>
                                   <span className="text-white/80 text-[12px] font-black tracking-tight uppercase">
                                     <span className="text-white/30">{l.name}:</span> {l.action}
                                   </span>
                                 </div>
                               </div>
                             );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
