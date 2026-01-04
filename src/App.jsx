import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  RotateCcw, Play, Coins, Trophy, Landmark, LogOut, 
  Trash2, RefreshCcw, Info, TrendingUp, FastForward, 
  ShieldCheck, UserPlus, Settings2, ChevronLeft, ChevronRight, X, UserMinus, Sparkles,
  Zap, Target, DollarSign, User, Lock, DoorOpen, LayoutGrid, ShieldAlert, PlusCircle,
  Users, Layers, Edit3, ScrollText, ArrowLeft, Key, Save, AlertTriangle, Monitor, Bot,
  Timer, Bomb, Maximize2, Sliders, ChevronUp, ChevronDown, Plus, Minus, Eye, MessageSquare, Clock, BarChart3
} from 'lucide-react';
import io from 'socket.io-client';

const RENDER_URL = "https://poker-server-3vin.onrender.com"; 
const SOCKET_URL = window.location.hostname === 'localhost' ? "http://localhost:10000" : RENDER_URL;

const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

const TOTAL_SEATS = 10;
const VIEWS = { LOGIN: 'LOGIN', LOBBY: 'LOBBY', GAME: 'GAME', ADMIN: 'ADMIN' };
const ADMIN_TABS = { PLAYERS: 'PLAYERS', TABLES: 'TABLES' };
const PHASES = { IDLE: 'IDLE', PRE_FLOP: 'PRE_FLOP', FLOP: 'FLOP', TURN: 'TURN', RIVER: 'RIVER', SHOWDOWN: 'SHOWDOWN' };

const DISPLAY_POSITIONS = [
  { x: 50, y: 92 }, { x: 15, y: 82 }, { x: 6,  y: 45 }, { x: 12, y: 12 }, { x: 30, y: 3  },
  { x: 50, y: 1  }, { x: 70, y: 3  }, { x: 88, y: 12 }, { x: 94, y: 45 }, { x: 85, y: 82 }
];

const BET_OFFSETS = [
  { x: 0, y: -160 },   { x: 100, y: -110 }, { x: 130, y: 0 },     { x: 100, y: 110 },  { x: 60, y: 130 },    
  { x: 0, y: 150 },    { x: -60, y: 130 },  { x: -100, y: 110 }, { x: -130, y: 0 },   { x: -100, y: -110 } 
];

const VARIANTS = { 
  HOLDEM: { id: 'HOLDEM', name: 'Texas Hold\'em', desc: '2 Hole Cards' }, 
  OMAHA: { id: 'OMAHA', name: 'OMAHA', desc: '4 Hole Cards (Use 2)' }, 
  PINEAPPLE: { id: 'PINEAPPLE', name: 'Pineapple', desc: '3 Hole Cards' }, 
  MUFLIS: { id: 'MUFLIS', name: 'Muflis', desc: 'Low Hand Wins' },
  HILOW: { id: 'HILOW', name: 'Hi-Low Split', desc: '4 Hole Cards' },
  REDSBLACKS: { id: 'REDSBLACKS', name: 'Reds & Blacks', desc: '4 Hole Cards (Joker logic)' }
};

const INITIAL_PLAYERS = Array(TOTAL_SEATS).fill(null);

const Seat = ({ 
  player, displayPos, phase, winning5Ids, isCollectingBets, isActiveTurn, 
  strengthLabel, potTransferring, timeRemaining, isHero, hiLowAwards, 
  cardScale, relativeIdx, holeCardRotation, playerBadgeOffset, playerBadgeXOffset,
  handStrengthYOffset, handStrengthXOffset, betOffsetMultiplier, betChipYShift, betChipXShift,
  dealerOffset
}) => {
    if (!player || !displayPos) return null;
    const isShowdown = phase === PHASES.SHOWDOWN;
    const currentCardScale = isHero ? cardScale : 1.0;
    const betOffset = BET_OFFSETS[relativeIdx] || { x: 0, y: 0 };
    const flingDelay = useMemo(() => Math.random() * 0.3, [isCollectingBets]);

    const renderBetChip = () => {
      const val = Number(player.currentBet || 0);
      const action = String(player.lastAction || "");
      let label = "BET";
      if (action.includes("SB")) label = "SB";
      else if (action.includes("BB")) label = "BB";
      else if (action === "CHECK") label = "CHECKED";
      else if (action === "CALL") label = "CALLED";
      else if (action === "RAISE") label = "RAISED";
      else if (val > 0 && phase === PHASES.PRE_FLOP && !player.lastAction) label = "POST";

      if (val <= 0 && label !== "CHECKED") return null;
      
      return (
        <div 
          className="absolute z-[100] transition-all"
          style={{ 
            transform: `translate(calc(-50% + ${betOffset.x * betOffsetMultiplier + (betChipXShift || 0)}px), ${betOffset.y * betOffsetMultiplier + (betChipYShift || 0)}px)`, 
            left: '50%', 
            top: '50%',
            animationName: isCollectingBets ? 'fling-to-pot' : 'bet-impact-slide',
            animationDuration: isCollectingBets ? '1.1s' : '0.5s',
            animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            animationFillMode: 'forwards',
            animationDelay: isCollectingBets ? `${flingDelay}s` : '0s'
          }}>
          <div className="relative group select-none cursor-default">
            <div className="absolute top-1.5 left-0 w-full h-full bg-black/60 rounded-full blur-md -z-10" />
            <div className={`bg-[#1e293b] border-2 border-white/30 rounded-full p-1 shadow-[0_8px_16px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.2)] flex items-center justify-center min-w-[55px] h-[55px] relative overflow-hidden transition-colors ${label === "CHECKED" ? 'grayscale opacity-60' : ''}`}>
               <div className="absolute inset-0 opacity-30 bg-[repeating-conic-gradient(#fff_0_10deg,#000_0_20deg)]" />
               <div className={`w-full h-full rounded-full bg-gradient-to-tr border border-black/30 flex flex-col items-center justify-center z-10 shadow-inner ${
                  label === 'RAISED' ? 'from-orange-600 via-orange-400 to-orange-700' : 
                  label === 'CHECKED' ? 'from-slate-600 via-slate-400 to-slate-700' :
                  'from-amber-600 via-yellow-400 to-amber-700'
               }`}>
                  <span className={`font-black leading-none uppercase tracking-tighter text-black/70 mb-0.5 ${label.length > 5 ? 'text-[6px]' : 'text-[8px]'}`}>{String(label)}</span>
                  {val > 0 && (
                    <span className="text-[12px] text-white font-black leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                      ${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}
                    </span>
                  )}
               </div>
            </div>
          </div>
        </div>
      );
    };

    return (
        <div style={{ left: `${displayPos.x}%`, top: `${displayPos.y}%` }} className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500 ${player.isFolded ? 'opacity-30 grayscale scale-95' : 'opacity-100'}`}>
            
            {isShowdown && player.isWinner && (
              <div className="absolute inset-[-100px] bg-yellow-400/10 rounded-full blur-[60px] animate-winner-aura -z-10" />
            )}

            {(isHero || isShowdown) && !player.isFolded && player.winProbability !== undefined && phase !== PHASES.IDLE && (
              <div className="absolute top-[-60px] left-1/2 -translate-x-1/2 z-[300] flex flex-col items-center gap-1 animate-in fade-in zoom-in duration-300">
                <div className="bg-slate-900/90 backdrop-blur-xl border border-cyan-400/50 px-3 py-1 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                  <TrendingUp size={12} className="text-cyan-400" />
                  <span className="text-[10px] font-black text-white font-mono">{Math.round(Number(player.winProbability || 0))}%</span>
                </div>
              </div>
            )}

            {player.lastAction && !isActiveTurn && !isCollectingBets && (
              <div className="absolute top-[-35px] animate-bounce-short z-[200]">
                <span className={`text-[8px] font-black px-2 py-1 rounded-sm shadow-xl uppercase border ${
                  player.lastAction === 'FOLD' ? 'bg-red-600 border-red-400 text-white' : 
                  player.lastAction === 'RAISE' ? 'bg-amber-500 border-amber-300 text-black' : 
                  'bg-blue-600 border-blue-400 text-white'
                }`}>
                  {String(player.lastAction)}
                </span>
              </div>
            )}

            {renderBetChip()}

            <div 
                style={{ transform: `translate(${Number(playerBadgeXOffset || 0)}px, ${Number(playerBadgeOffset || 0)}px)` }}
                className={`relative z-50 flex flex-col items-center p-2 rounded-2xl border-2 bg-slate-900/98 backdrop-blur-md transition-all duration-500 min-w-[110px] md:min-w-[160px] shadow-2xl ${isActiveTurn ? 'border-cyan-400 ring-4 ring-cyan-400/30 shadow-[0_0_50px_rgba(34,211,238,0.5)] animate-turn-glow' : 'border-white/10'} ${player.isWinner && isShowdown ? 'border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.5)] scale-110' : ''}`}
            >
                {isActiveTurn && timeRemaining > 0 && (
                    <div className="absolute -top-2 w-full px-2 h-1.5 z-[60]">
                        <div className="w-full h-full bg-black/40 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-cyan-400 transition-all duration-1000 linear shadow-[0_0_10px_#22d3ee]" style={{ width: `${(Number(timeRemaining || 0) / 30) * 100}%` }} />
                        </div>
                    </div>
                )}
                
                {player.isDealer && (
                    <div 
                      className="absolute flex items-center justify-center z-[70] animate-in zoom-in spin-in duration-500"
                      style={{ right: `-${Number(dealerOffset || 6)}px`, top: `-${Number(dealerOffset || 6)}px` }}
                    >
                        <div className="w-7 h-7 bg-red-600 rounded-full border-2 border-white shadow-[0_0_15px_rgba(220,38,38,0.8)] flex items-center justify-center font-black text-[10px] text-white ring-2 ring-red-600/20">D</div>
                    </div>
                )}

                <div className="flex flex-col items-center gap-0.5 w-full">
                    <span className="text-[10px] md:text-[14px] font-black text-white uppercase tracking-tight truncate w-full text-center px-2 drop-shadow-md">{String(player.name || "Anon")}</span>
                    <span className={`text-[12px] md:text-[17px] font-mono font-black drop-shadow-md ${player.chips === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                        ${Number(player.chips || 0).toLocaleString()}
                    </span>
                </div>
            </div>

            {player.hand && Array.isArray(player.hand) && !player.isFolded && (
                <div className={`relative flex items-center justify-center w-[12vw] h-[6vw] mt-4 overflow-visible transition-all duration-700 ${isShowdown ? 'z-[500] scale-125 -translate-y-12' : 'z-10'}`}>
                    {player.hand.map((c, ci) => {
                        const mid = (player.hand.length - 1) / 2;
                        const offset = ci - mid;
                        const currentRotation = offset * (player.hand.length > 2 ? holeCardRotation * 0.6 : holeCardRotation);
                        const isWinningCard = isShowdown && player.isWinner && (winning5Ids || []).includes(c.id);
                        const isRevealing = isShowdown && !isHero;

                        return (
                          <div key={c.id || ci} 
                              className={`w-[5.5vw] md:w-[3vw] h-[8vw] md:h-[5vw] rounded-[6px] flex flex-col items-start p-[2px] border shadow-2xl absolute transition-all duration-700 preserve-3d ${isShowdown || isHero ? 'bg-white text-black' : 'bg-gradient-to-br from-slate-700 to-slate-900'} ${isWinningCard ? 'ring-4 ring-yellow-400 scale-125 z-[600] shadow-[0_0_40px_#fbbf24] animate-pulse-winning-card' : 'border-white/20'}`} 
                              style={{ 
                                  transform: `translateX(${offset * (player.hand.length > 2 ? 1.5 : 2.6)}vw) rotate(${currentRotation}deg) scale(${1.5 * currentCardScale}) ${isRevealing ? 'rotateY(0deg)' : ''}`, 
                                  transformOrigin: 'bottom center', 
                                  top: player.hand.length > 2 ? '15px' : '45px',
                                  animationName: isRevealing ? 'card-reveal-reveal' : 'none',
                                  animationDuration: isRevealing ? '1.4s' : '0s',
                                  animationTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                  animationFillMode: 'forwards',
                                  animationDelay: `${ci * 0.2}s`
                              }}>
                              {(isShowdown || isHero) ? (
                                  <div className="flex flex-col items-start w-full h-full animate-in fade-in duration-700 relative">
                                    <span className="text-[10px] md:text-[14px] font-black leading-none">{String(c.value)}</span>
                                    <span className={`text-[12px] md:text-[20px] leading-none ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                                    <div className="absolute bottom-1 right-1 opacity-20 text-[2vw] pointer-events-none">{String(c.suit)}</div>
                                  </div>
                              ) : ( 
                                <div className="w-full h-full flex items-center justify-center opacity-30">
                                  <ShieldCheck size={18} className="text-white/40" />
                                </div> 
                              )}
                          </div>
                        );
                    })}
                    
                    {strengthLabel && !player.isFolded && (isHero || isShowdown) && phase !== PHASES.IDLE && (
                        <div 
                            className="absolute -bottom-12 z-[120] whitespace-nowrap bg-purple-600/95 backdrop-blur-xl px-4 py-2 rounded-full border-2 border-purple-400 shadow-[0_8px_30px_rgba(168,85,247,0.7)] animate-in fade-in zoom-in h-10 flex items-center justify-center" 
                            style={{ 
                                transform: `translate(${Number(handStrengthXOffset || 0)}px, ${Number(handStrengthYOffset || 0)}px)`, 
                                bottom: '-35px' 
                            }}
                        >
                             <span className="text-[11px] md:text-[13px] font-black uppercase text-white tracking-widest drop-shadow-md">
                                {phase === PHASES.PRE_FLOP ? "Pre-flop" : String(strengthLabel)}
                             </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function App() {
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
  const [highestBet, setHighestBet] = useState(0);
  const [winning5Ids, setWinning5Ids] = useState([]);
  const [logs, setLogs] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [activeTables, setActiveTables] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState(null);
  const [buyInAmount, setBuyInAmount] = useState(1000);
  const [isCollectingBets, setIsCollectingBets] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', chips: 5000, password: '' });
  const [newTable, setNewTable] = useState({ name: '', sb: 10, bb: 20, minBuy: 400, maxBuy: 2000, pendingVariant: 'HOLDEM' });
  const [raiseInput, setRaiseInput] = useState(0);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [potAnimating, setPotAnimating] = useState(false);
  const [potTransferring, setPotTransferring] = useState(false);
  const [showdownWinners, setShowdownWinners] = useState(null);
  const [hiLowAwards, setHiLowAwards] = useState(null);
  const [nuclearConfirm, setNuclearConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Layout Controls
  const [headerHeight, setHeaderHeight] = useState(60); 
  const [footerHeight, setFooterHeight] = useState(280); 
  const [tableZoom, setTableZoom] = useState(0.8);
  const [heroCardScale, setHeroCardScale] = useState(2.2);
  const [communityCardScale, setCommunityCardScale] = useState(2.8);
  const [holeCardRotation, setHoleCardRotation] = useState(20);
  const [playerBadgeOffset, setPlayerBadgeOffset] = useState(100);
  const [playerBadgeXOffset, setPlayerBadgeXOffset] = useState(0);
  const [handStrengthYOffset, setHandStrengthYOffset] = useState(30);
  const [handStrengthXOffset, setHandStrengthXOffset] = useState(0);
  const [betOffsetMultiplier, setBetOffsetMultiplier] = useState(1.0);
  const [betChipYShift, setBetChipYShift] = useState(0);
  const [betChipXShift, setBetChipXShift] = useState(0);
  const [potXOffset, setPotXOffset] = useState(0);
  const [potYOffset, setPotYOffset] = useState(0);
  const [commXOffset, setCommXOffset] = useState(0);
  const [commYOffset, setCommYOffset] = useState(0);
  const [wmX, setWmX] = useState(0);
  const [wmY, setWmY] = useState(25);
  const [wmOpacity, setWmOpacity] = useState(5);
  const [wmScale, setWmScale] = useState(100);
  const [dealerOffset, setDealerOffset] = useState(6);
  const [winnerX, setWinnerX] = useState(0);
  const [winnerY, setWinnerY] = useState(0);
  const [winnerScale, setWinnerScale] = useState(100);

  const [showLayoutControls, setShowLayoutControls] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setTableZoom(0.55);
        setFooterHeight(320);
      } else {
        setTableZoom(0.85);
        setFooterHeight(280);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalDisplayPot = useMemo(() => {
    const currentBetsSum = players.reduce((acc, p) => acc + Number(p?.currentBet || 0), 0);
    return Number(potAmount || 0) + currentBetsSum;
  }, [potAmount, players]);

  const heroIdx = useMemo(() => {
    if (!userProfile || !Array.isArray(players)) return -1;
    return players.findIndex(p => {
        if (!p) return false;
        if (userProfile.uid && p.uid && userProfile.uid === p.uid) return true;
        if (p.name === userProfile.name && p.password === userProfile.password) return true;
        return false;
    });
  }, [players, userProfile]);

  const heroPlayerObj = useMemo(() => {
    if (heroIdx === -1) return null;
    return players[heroIdx];
  }, [players, heroIdx]);

  const isBrokeStatus = useMemo(() => {
    if (!heroPlayerObj) return false;
    return !!heroPlayerObj.isBust || (Number(heroPlayerObj.chips || 0) <= 0 && phase !== PHASES.IDLE);
  }, [heroPlayerObj, phase]);

  const minRaiseAllowed = useMemo(() => {
      const bb = 20; 
      return Math.max(Number(highestBet || 0) + bb, Number(highestBet || 0) * 2);
  }, [highestBet]);

  const handleAction = (type, amt = 0) => {
      const roomId = currentRoomId; if (!roomId) return;
      socket.emit('playerAction', { roomId, type, amount: type === 'RAISE' ? Number(amt || raiseInput) : 0 });
  };

  const handleLogin = () => { 
      if (passwordInput === 'pass') { 
          socket.emit('getInitialData'); 
          setUserProfile({ name: 'SUPER ADMIN', uid: 'admin_1' }); 
          setCurrentView(VIEWS.ADMIN); 
      } 
      else { socket.emit('playerLogin', { password: passwordInput }); }
  };

  const joinRoom = () => {
    if (!selectedTableForJoin || !userProfile) return;
    const rId = selectedTableForJoin.id;
    socket.emit('joinRoom', { roomId: rId, profile: { ...userProfile, pendingVariant: pendingVariantId }, buyIn: buyInAmount }, (res) => {
        if (res?.status === 'ok') { setCurrentRoomId(rId); setCurrentView(VIEWS.GAME); setSelectedTableForJoin(null); }
    });
  };

  const addBot = () => {
      if (!currentRoomId) return;
      socket.emit('adminAddBot', { roomId: currentRoomId });
  };

  const handleSpawnArena = () => {
    if (!newTable.name) return;
    const id = 'room_' + Math.random().toString(36).slice(2, 9);
    socket.emit('adminCreateRoom', { ...newTable, id });
    setNewTable({ name: '', sb: 10, bb: 20, minBuy: 400, maxBuy: 2000, pendingVariant: 'HOLDEM' });
  };

  useEffect(() => {
    socket.on('roomUpdate', (d) => {
        if (!d) { setPlayers(INITIAL_PLAYERS); setPhase(PHASES.IDLE); setPotAmount(0); setCommunity([]); return; }
        if (d.id) setCurrentRoomId(d.id);
        
        const phaseChanged = d.phase !== phase && phase !== PHASES.IDLE && d.phase !== PHASES.IDLE;
        const currentPotValue = Number(d.potData?.[0]?.amount || 0);
        const potIncreased = currentPotValue > Number(potAmount || 0);

        if (phaseChanged) {
            setIsCollectingBets(true);
            setTimeout(() => {
                setIsCollectingBets(false);
                if (potIncreased) { setPotAnimating(true); setTimeout(() => setPotAnimating(false), 800); }
            }, 1100);
        } else if (potIncreased && d.phase === phase) {
             setPotAnimating(true); setTimeout(() => setPotAnimating(false), 800);
        }

        if (d.phase === PHASES.SHOWDOWN) {
            setPotTransferring(true);
            setTimeout(() => {
              setShowdownWinners(d.showdownWinners || null);
            }, 2000); 
            setHiLowAwards(d.hiLowAwards || null);
            setTimeout(() => { setPotTransferring(false); setShowdownWinners(null); }, 8500);
        }

        setPlayers(() => { 
            const next = [...INITIAL_PLAYERS]; 
            (d.players || []).forEach((p, i) => { if (p) next[i] = { ...p, seatIdx: i }; }); 
            return next; 
        });

        setPhase(d.phase); setCommunity(d.community || []); 
        let resolvedVariant = VARIANTS.HOLDEM;
        if (d.activeVariant) {
            const vId = typeof d.activeVariant === 'string' ? d.activeVariant : d.activeVariant.id;
            resolvedVariant = VARIANTS[vId] || { id: vId, name: String(d.activeVariant.name || vId) };
        }
        setActiveVariant(resolvedVariant);
        setHighestBet(Number(d.highestBet) || 0); setActiveIdx(d.activeIdx ?? -1); setWinning5Ids(d.winning5Ids || []);
        setPotAmount(currentPotValue); setTimeRemaining(Number(d.timeRemaining) || 30);

        if (d.activeIdx !== -1 && d.players?.[d.activeIdx]?.uid === userProfile?.uid) {
            const bb = 20; 
            const minRaise = Math.max(Number(d.highestBet) + bb, Number(d.highestBet) * 2);
            setRaiseInput(prev => (prev < minRaise) ? minRaise : prev);
        }
    });

    socket.on('lobbyUpdate', (list) => setActiveTables(list || []));
    socket.on('profilesUpdate', (list) => setAllProfiles(list || []));
    socket.on('initialDataResponse', (d) => { setAllProfiles(d.profiles || []); setActiveTables(d.rooms || []); });
    socket.on('loginSuccess', (p) => { 
        setUserProfile(p); 
        setPendingVariantId(p.pendingVariant || 'HOLDEM'); 
        setCurrentView(VIEWS.LOBBY); 
        socket.emit('getInitialData'); 
    });
    socket.on('log', (d) => {
        const entry = { id: Math.random(), time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), ...d };
        setLogs(prev => [entry, ...prev].slice(0, 50));
    });

    return () => { 
        socket.off('roomUpdate'); socket.off('lobbyUpdate'); socket.off('profilesUpdate'); socket.off('loginSuccess'); socket.off('log'); 
    };
  }, [phase, potAmount, userProfile]);

  if (currentView === VIEWS.LOGIN) return (
    <div className="h-screen bg-[#06080c] flex items-center justify-center p-6 text-white font-black uppercase tracking-tighter overflow-hidden">
        <div className="w-full max-w-[400px] p-8 md:p-12 bg-black/60 border border-white/10 rounded-3xl backdrop-blur-3xl shadow-2xl flex flex-col items-center gap-8 font-black animate-in fade-in zoom-in duration-700">
            <div className="p-6 bg-gradient-to-br from-white/10 to-white/5 rounded-full shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] border border-white/10"><Lock size={40} className="text-[#fbbf24] animate-pulse" /></div>
            <div className="w-full space-y-4 text-center">
                <h1 className="text-3xl font-black text-white tracking-widest mb-2">DEALERS CHOICE</h1>
                <label className="text-[10px] text-white/40 block ml-2 tracking-[0.3em] font-black uppercase">ACCESS PASSCODE</label>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl text-center tracking-[0.5em] text-[#fbbf24] outline-none text-2xl font-black uppercase focus:border-[#fbbf24]/50 transition-all"/>
            </div>
            <button onClick={handleLogin} className="w-full p-6 bg-gradient-to-b from-[#fbbf24] to-[#d97706] text-black rounded-2xl hover:scale-[1.03] active:scale-95 font-black text-xl transition-all shadow-[0_10px_30px_rgba(251,191,36,0.2)] uppercase">SIT AT TABLE</button>
        </div>
    </div>
  );

  if (currentView === VIEWS.ADMIN) return (
    <div className="h-screen bg-[#06080c] flex flex-col md:flex-row text-white font-black uppercase overflow-hidden">
        <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-white/10 p-6 md:p-10 flex flex-row md:flex-col gap-5 bg-black/40 backdrop-blur-xl shrink-0">
            <h2 className="text-[#fbbf24] tracking-[0.4em] hidden md:flex items-center gap-3 mb-6 font-black text-lg truncate uppercase">DC ADMIN</h2>
            <button onClick={()=>setAdminTab(ADMIN_TABS.PLAYERS)} className={`flex-1 md:flex-none p-4 rounded-2xl text-xs md:text-sm transition-all font-black border-2 ${adminTab === ADMIN_TABS.PLAYERS ? 'bg-[#fbbf24] text-black border-[#fbbf24] shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-white/40 border-transparent hover:bg-white/10'}`}>PLAYERS</button>
            <button onClick={()=>setAdminTab(ADMIN_TABS.TABLES)} className={`flex-1 md:flex-none p-4 rounded-2xl text-xs md:text-sm transition-all font-black border-2 ${adminTab === ADMIN_TABS.TABLES ? 'bg-[#fbbf24] text-black border-[#fbbf24] shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-white/40'}`}>TABLES</button>
            <div className="hidden md:block flex-1" />
            <button onClick={()=>{ if(!nuclearConfirm){setNuclearConfirm(true);setTimeout(()=>setNuclearConfirm(false),3000);return;} socket.emit('adminNuclearReset'); setNuclearConfirm(false);}} className={`hidden md:flex p-5 rounded-2xl items-center justify-center gap-3 border-2 transition-all font-black group ${nuclearConfirm ? 'bg-red-600 border-white text-white animate-pulse' : 'bg-red-950/20 border-red-500 text-red-500 hover:bg-red-500 hover:text-white'}`}>
                {nuclearConfirm ? <Bomb size={24}/> : <ShieldAlert size={24}/>}
                <span className="tracking-widest">{nuclearConfirm ? 'CONFIRM' : 'NUCLEAR'}</span>
            </button>
            <button onClick={()=>{setCurrentView(VIEWS.LOGIN); setUserProfile(null);}} className="p-4 bg-white/5 rounded-2xl text-white/40 hover:text-white transition-all flex items-center justify-center gap-2 font-black"><ArrowLeft size={20}/></button>
        </aside>
        <main className="flex-1 p-6 md:p-14 overflow-y-auto bg-black/60 font-black uppercase">
            {adminTab === ADMIN_TABS.PLAYERS ? (
                <div className="flex flex-col gap-10 animate-in slide-in-from-right duration-500">
                    <h3 className="text-2xl md:text-3xl tracking-[0.3em] border-l-8 border-[#fbbf24] pl-6 font-black py-2">PLAYER REGISTRY</h3>
                    <div className="bg-white/5 p-6 md:p-10 rounded-[2rem] grid grid-cols-1 md:grid-cols-3 gap-6 border border-white/10 shadow-2xl backdrop-blur-md">
                        <input value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer, name: e.target.value})} placeholder="PLAYER_ID" className="w-full bg-black/40 p-5 rounded-2xl border border-white/10 outline-none focus:border-[#fbbf24] transition-all font-black uppercase"/>
                        <input value={newPlayer.password} onChange={e=>setNewPlayer({...newPlayer, password: e.target.value})} placeholder="PWD" className="w-full bg-black/40 p-5 rounded-2xl border border-white/10 outline-none focus:border-[#fbbf24] transition-all font-black uppercase"/>
                        <button onClick={()=>socket.emit('adminCreatePlayer', {...newPlayer, uid: Math.random().toString(36).slice(2)})} className="w-full bg-[#fbbf24] text-black h-[60px] rounded-2xl font-black p-4 transition-all hover:brightness-110 active:scale-95 shadow-xl shadow-yellow-500/10">PROVISION</button>
                    </div>
                    <div className="bg-white/5 rounded-[2.5rem] overflow-hidden border border-white/10 font-black shadow-inner">
                        {(allProfiles || []).map(p => (
                            <div key={p.uid} className="flex justify-between items-center p-6 md:p-8 border-b border-white/5 hover:bg-white/10 transition-all font-black">
                                <span className="uppercase text-sm md:text-lg tracking-wider font-black">{String(p.name)} <span className="text-white/20 ml-3 text-xs italic">({String(p.password)})</span></span>
                                <div className="flex gap-6 items-center font-black">
                                    <span className="text-emerald-400 font-mono text-lg md:text-2xl tracking-tighter font-black">${Number(p.chips || 0).toLocaleString()}</span>
                                    <button onClick={()=>{const n = prompt("NEW WALLET", p.chips); if(n) socket.emit('adminEditChips', {uid: p.uid, chips: Number(n)})}} className="p-3 bg-cyan-400/10 text-cyan-400 rounded-xl hover:bg-cyan-400 hover:text-black transition-all"><Edit3 size={20}/></button>
                                    <button onClick={()=>socket.emit('adminDeletePlayer', p.uid)} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-10 animate-in slide-in-from-right duration-500 font-black uppercase">
                    <h3 className="text-2xl md:text-3xl tracking-[0.3em] border-l-8 border-emerald-500 pl-6 font-black py-2">ARENA CONTROL</h3>
                    <div className="bg-white/5 p-6 md:p-10 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-2 gap-8 border border-white/10 shadow-2xl backdrop-blur-md">
                        <input value={newTable.name} onChange={e=>setNewTable({...newTable, name: e.target.value})} placeholder="BATTLEGROUND_ALPHA" className="w-full bg-black/40 p-5 rounded-2xl border border-white/10 outline-none focus:border-[#fbbf24] transition-all font-black uppercase"/>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-black">
                            <input value={newTable.sb} type="number" className="w-full bg-black/40 p-4 rounded-xl border border-white/10 font-black" onChange={e=>setNewTable({...newTable, sb: Number(e.target.value)})}/>
                            <input value={newTable.bb} type="number" className="w-full bg-black/40 p-4 rounded-xl border border-white/10 font-black" onChange={e=>setNewTable({...newTable, bb: Number(e.target.value)})}/>
                        </div>
                        <button onClick={handleSpawnArena} className="md:col-span-2 bg-emerald-600 text-white rounded-2xl font-black p-5 transition-all hover:brightness-110 active:scale-95 shadow-xl shadow-emerald-900/20 font-black">SPAWN ARENA</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-black">
                        {(activeTables || []).map(t => (
                            <div key={t.id} className="bg-white/5 p-6 md:p-8 rounded-[2rem] flex justify-between items-center border border-white/10 hover:border-emerald-500/50 transition-all shadow-xl group font-black uppercase">
                                <div>
                                  <h4 className="text-[#fbbf24] text-lg md:text-xl font-black truncate tracking-wider">{String(t.name)}</h4>
                                  <p className="text-[11px] text-white/40 tracking-[0.2em] font-black mt-1">${t.sb}/${t.bb} • {t.players?.filter(Boolean).length || 0}/10 SEATED</p>
                                </div>
                                <button onClick={()=>socket.emit('adminDeleteRoom', t.id)} className="bg-red-500/10 p-4 rounded-2xl text-red-500 hover:bg-red-500 hover:text-white transition-all font-black active:scale-90"><Trash2 size={24}/></button>
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
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-in fade-in duration-500 px-6 font-black uppercase">
                <div className="w-full max-w-[450px] p-10 md:p-14 bg-slate-900 border border-[#fbbf24]/30 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col gap-10 animate-in zoom-in-95 duration-300">
                    <div className="text-center">
                      <h3 className="text-3xl md:text-4xl tracking-[0.2em] text-[#fbbf24] uppercase font-black">{String(selectedTableForJoin.name)}</h3>
                    </div>
                    <div className="space-y-8 font-black text-center uppercase">
                        <span className="text-emerald-400 text-4xl font-mono font-black">${buyInAmount.toLocaleString()}</span>
                        <input type="range" min={selectedTableForJoin.minBuy || 400} max={selectedTableForJoin.maxBuy || 2000} step={100} value={buyInAmount} onChange={(e) => setBuyInAmount(Number(e.target.value))} className="w-full h-4 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#fbbf24]" />
                    </div>
                    <div className="flex gap-4">
                        <button onClick={()=>setSelectedTableForJoin(null)} className="flex-1 p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-black uppercase tracking-widest active:scale-95">BACK</button>
                        <button onClick={joinRoom} className="flex-2 p-6 bg-emerald-600 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all text-sm tracking-[0.3em] font-black uppercase">SIT DOWN</button>
                    </div>
                </div>
            </div>
        )}
        <header className="h-24 border-b border-white/10 flex items-center justify-between px-6 md:px-16 bg-black/40 backdrop-blur-2xl shadow-2xl z-50 shrink-0 font-black uppercase">
            <h2 className="tracking-[0.5em] text-sm md:text-2xl flex items-center gap-5 font-black uppercase tracking-widest">DEALERS CHOICE</h2>
            <div className="flex flex-col items-end font-black uppercase">
                <span className="text-emerald-400 font-mono text-xl md:text-3xl tracking-tighter font-black drop-shadow-md">${Number(userProfile?.chips || 0).toLocaleString()}</span>
            </div>
        </header>
        <main className="flex-1 p-6 md:p-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-14 overflow-y-auto bg-gradient-to-br from-black via-[#0a0c10] to-[#12161b] font-black uppercase scrollbar-hide">
            {(activeTables || []).map((t) => (
                <div key={t.id} className="p-10 bg-white/5 border border-white/5 rounded-[3rem] flex flex-col gap-8 shadow-2xl hover:border-[#fbbf24]/30 hover:bg-white/10 transition-all group relative overflow-hidden font-black animate-in fade-in slide-in-from-bottom duration-500">
                    <h3 className="text-2xl md:text-3xl tracking-widest text-white group-hover:text-[#fbbf24] transition-colors uppercase font-black">{String(t.name)}</h3>
                    <div className="bg-black/60 p-6 rounded-[2rem] flex justify-between items-center border border-white/5 shadow-inner uppercase font-black">
                        <div className="flex flex-col font-black uppercase"><span className="text-[#fbbf24] text-xl md:text-2xl font-black tracking-tighter">${t.sb}/${t.bb}</span></div>
                        <div className="flex flex-col items-end font-black"><span className="text-white/80 font-mono text-lg md:text-xl font-black">{t.players?.filter(p=>p).length || 0}/10</span></div>
                    </div>
                    <button 
                      onClick={()=>setSelectedTableForJoin(t)} 
                      className="relative z-20 w-full p-8 bg-emerald-600 rounded-3xl tracking-[0.4em] shadow-[0_15px_40px_rgba(16,185,129,0.2)] hover:scale-[1.03] active:scale-95 transition-all font-black uppercase cursor-pointer text-sm md:text-lg"
                    >
                      ENTER ARENA
                    </button>
                </div>
            ))}
        </main>
    </div>
  );

  return (
    <div className="h-screen bg-[#06080c] text-white flex flex-col overflow-hidden relative font-black uppercase tracking-tighter">
      
      {isBrokeStatus && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6 font-black animate-in fade-in duration-700">
                <div className="w-full max-w-[400px] p-12 bg-slate-900 border-2 border-red-500 rounded-[3rem] text-center shadow-[0_0_150px_rgba(239,68,68,0.5)] font-black uppercase animate-in zoom-in-90 duration-500">
                    <AlertTriangle size={80} className="text-red-500 animate-pulse mx-auto mb-8" />
                    <h2 className="text-4xl font-black mb-4 tracking-tighter">BUSTED!</h2>
                    <button onClick={() => socket.emit('adminAddChips', { roomId: currentRoomId, uid: userProfile.uid, chips: 1000 })} className="w-full p-8 bg-emerald-600 text-white rounded-3xl shadow-xl animate-bounce-short font-black tracking-widest transition-all active:scale-95">REBUY $1,000</button>
                </div>
          </div>
      )}

      <header style={{ height: `${headerHeight}px` }} className="bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4 md:px-12 z-[80] shadow-2xl backdrop-blur-xl shrink-0 font-black uppercase">
        <div className="flex items-center gap-3">
            <button onClick={() => setShowLayoutControls(!showLayoutControls)} className={`p-2.5 rounded-xl transition-all font-black uppercase active:scale-90 ${showLayoutControls ? 'bg-[#fbbf24] text-black shadow-[0_0_20px_#fbbf24]' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                <Sliders size={22}/>
            </button>
            <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/10 shadow-inner font-black uppercase">
                <span className="text-white ml-2 text-[11px] md:text-sm font-black">{String(activeVariant?.name || "Hold'em")}</span>
            </div>
            <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-xl hidden lg:flex items-center gap-4 shadow-inner font-black uppercase">
                <span className="text-white/40 text-[9px] tracking-widest uppercase font-black">On my deal:</span>
                <select value={pendingVariantId} onChange={(e) => {
                    setPendingVariantId(e.target.value); 
                    socket.emit('updatePlayerSettings', {uid: userProfile.uid, pendingVariant: e.target.value});
                }} className="bg-transparent text-[#fbbf24] outline-none text-xs cursor-pointer font-black border-none">
                    {Object.entries(VARIANTS).map(([k,v])=><option key={k} value={k} className="bg-slate-900 font-black">{String(v.name)}</option>)}
                </select>
            </div>
        </div>

        {showLayoutControls && (
            <div className="absolute top-16 left-4 bg-black/95 border border-white/10 p-8 rounded-[2.5rem] shadow-[0_20px_80px_rgba(0,0,0,0.9)] z-[1000] flex flex-col gap-6 min-w-[320px] max-h-[80vh] overflow-y-auto scrollbar-hide animate-in slide-in-from-top-4 backdrop-blur-3xl font-black">
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-2">
                  <h4 className="text-white/40 text-xs tracking-[0.3em] font-black uppercase text-center w-full">VISUAL TWEAKS</h4>
                  <X size={20} className="text-white/40 cursor-pointer hover:text-white" onClick={()=>setShowLayoutControls(false)} />
                </div>
                
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-2xl space-y-4">
                    <h5 className="text-[10px] text-[#fbbf24] tracking-widest border-b border-white/10 pb-2 mb-2 uppercase">Interface Layout</h5>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Header Height</span><input type="range" min="40" max="100" value={headerHeight} onChange={(e)=>setHeaderHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Footer Height</span><input type="range" min="120" max="600" value={footerHeight} onChange={(e)=>setFooterHeight(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1 col-span-2"><span className="text-[8px] text-white/40 font-black uppercase">Table Zoom ({Math.round(tableZoom * 100)}%)</span><input type="range" min="0.3" max="1.5" step="0.01" value={tableZoom} onChange={(e)=>setTableZoom(Number(e.target.value))} className="w-full accent-[#fbbf24] h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                    </div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl space-y-4">
                    <h5 className="text-[10px] text-emerald-400 tracking-widest border-b border-white/10 pb-2 mb-2 uppercase">Background Branding</h5>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">WM X-POS</span><input type="range" min="-300" max="300" value={wmX} onChange={(e)=>setWmX(Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">WM Y-POS</span><input type="range" min="-300" max="300" value={wmY} onChange={(e)=>setWmY(Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Opacity</span><input type="range" min="0" max="30" value={wmOpacity} onChange={(e)=>setWmOpacity(Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Scale</span><input type="range" min="20" max="300" value={wmScale} onChange={(e)=>setWmScale(Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                    </div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl space-y-4">
                    <h5 className="text-[10px] text-amber-400 tracking-widest border-b border-white/10 pb-2 mb-2 uppercase">Victory Overlay</h5>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Victory X</span><input type="range" min="-500" max="500" value={winnerX} onChange={(e)=>setWinnerX(Number(e.target.value))} className="w-full accent-yellow-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Victory Y</span><input type="range" min="-500" max="500" value={winnerY} onChange={(e)=>setWinnerY(Number(e.target.value))} className="w-full accent-yellow-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1 col-span-2 text-center"><span className="text-[8px] text-white/40 font-black uppercase">Victory Scale ({winnerScale}%)</span><input type="range" min="20" max="250" value={winnerScale} onChange={(e)=>setWinnerScale(Number(e.target.value))} className="w-full accent-yellow-400 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                    </div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl space-y-4">
                    <h5 className="text-[10px] text-amber-400 tracking-widest border-b border-white/10 pb-2 mb-2 uppercase">Player Positioning</h5>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Badge X</span><input type="range" min="-300" max="300" value={playerBadgeXOffset} onChange={(e)=>setPlayerBadgeXOffset(Number(e.target.value))} className="w-full accent-orange-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Badge Y</span><input type="range" min="-300" max="300" value={playerBadgeOffset} onChange={(e)=>setPlayerBadgeOffset(Number(e.target.value))} className="w-full accent-orange-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1 col-span-2 text-center"><span className="text-[8px] text-white/40 font-black uppercase">Dealer Button Offset</span><input type="range" min="-30" max="30" value={dealerOffset} onChange={(e)=>setDealerOffset(Number(e.target.value))} className="w-full accent-red-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 p-4 rounded-2xl space-y-4">
                    <h5 className="text-[10px] text-amber-400 tracking-widest border-b border-white/10 pb-2 mb-2 uppercase">Pot & Comm Cards</h5>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Pot X</span><input type="range" min="-300" max="300" value={potXOffset} onChange={(e)=>setPotXOffset(Number(e.target.value))} className="w-full accent-yellow-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Pot Y</span><input type="range" min="-300" max="300" value={potYOffset} onChange={(e)=>setPotYOffset(Number(e.target.value))} className="w-full accent-yellow-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Comm X</span><input type="range" min="-300" max="300" value={commXOffset} onChange={(e)=>setCommXOffset(Number(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Comm Y</span><input type="range" min="-300" max="300" value={commYOffset} onChange={(e)=>setCommYOffset(Number(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                    </div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl space-y-4">
                    <h5 className="text-[10px] text-purple-400 tracking-widest border-b border-white/10 pb-2 mb-2 uppercase">Bet Chips</h5>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Bet X-Shift</span><input type="range" min="-300" max="300" value={betChipXShift} onChange={(e)=>setBetChipXShift(Number(e.target.value))} className="w-full accent-amber-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1"><span className="text-[8px] text-white/40 font-black uppercase">Bet Y-Shift</span><input type="range" min="-300" max="300" value={betChipYShift} onChange={(e)=>setBetChipYShift(Number(e.target.value))} className="w-full accent-amber-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                      <div className="space-y-1 col-span-2 text-center"><span className="text-[8px] text-white/40 font-black uppercase">Bet Radial Scale</span><input type="range" min="0.2" max="2.5" step="0.05" value={betOffsetMultiplier} onChange={(e)=>setBetOffsetMultiplier(Number(e.target.value))} className="w-full accent-amber-500 h-1.5 bg-white/10 rounded-full appearance-none"/></div>
                    </div>
                  </div>
                </div>

                <button onClick={()=>setShowLayoutControls(false)} className="bg-gradient-to-b from-[#fbbf24] to-[#d97706] text-black font-black py-4 rounded-2xl text-[11px] tracking-[0.3em] uppercase mt-4 transition-all active:scale-95 shadow-xl">LOCK SETTINGS</button>
            </div>
        )}

        <div className="flex gap-4 font-black uppercase items-center">
            <div className="hidden sm:flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl font-mono text-sm text-[#fbbf24] shadow-inner">
                <Clock size={16} />
                {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button onClick={addBot} className="text-indigo-400 p-2.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-indigo-400/20 active:scale-90 font-black transition-all" title="Add Bot"><Bot size={24}/></button>
            <button onClick={() => {setCurrentView(VIEWS.LOBBY); setCurrentRoomId(null);}} className="text-red-500 p-2.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-red-500/20 active:scale-90 font-black transition-all"><LogOut size={24}/></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative bg-gradient-to-b from-[#0a1510] to-[#040608] overflow-hidden px-2 py-2 font-black uppercase">
        <div style={{ transform: `scale(${tableZoom})`, maxHeight: `calc(100vh - ${headerHeight + footerHeight + 10}px)` }} className="relative w-full max-w-[1500px] aspect-[21/10] flex items-center justify-center h-full transition-all duration-500 ease-out origin-center font-black">
            
            <div className="absolute inset-0 bg-gradient-to-b from-[#114b38] to-[#0a3124] rounded-[50%] border-[2vw] border-slate-900/80 shadow-[inset_0_0_12vw_rgba(0,0,0,1),0_20px_50px_rgba(0,0,0,0.8)] border-double font-black uppercase z-0" />
            
            {/* Background Variant Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden"
              style={{ transform: `translate(${wmX}px, ${wmY}%) scale(${wmScale / 100})`, opacity: wmOpacity / 100 }}
            >
                <span className="text-[13vw] font-black text-white italic tracking-tighter uppercase select-none rotate-[-12deg] whitespace-nowrap">
                  {String(activeVariant?.name || "Hold'em")}
                </span>
            </div>

            <div className="absolute inset-0 pointer-events-none z-20 font-black uppercase">
              {(players || []).map((p, i) => {
                if (!p) return null;
                const rIdx = (i - (heroIdx !== -1 ? heroIdx : 0) + TOTAL_SEATS) % TOTAL_SEATS;
                return (
                  <Seat 
                    key={i} 
                    player={p} 
                    displayPos={DISPLAY_POSITIONS[rIdx]} 
                    phase={phase} 
                    winning5Ids={winning5Ids} 
                    isActiveTurn={activeIdx === i} 
                    strengthLabel={p.strength} 
                    isCollectingBets={isCollectingBets} 
                    timeRemaining={timeRemaining} 
                    isHero={i === heroIdx} 
                    hiLowAwards={hiLowAwards} 
                    cardScale={heroCardScale} 
                    relativeIdx={rIdx}
                    holeCardRotation={holeCardRotation}
                    playerBadgeOffset={playerBadgeOffset}
                    playerBadgeXOffset={playerBadgeXOffset}
                    handStrengthYOffset={handStrengthYOffset}
                    handStrengthXOffset={handStrengthXOffset}
                    betOffsetMultiplier={betOffsetMultiplier}
                    betChipYShift={betChipYShift}
                    betChipXShift={betChipXShift}
                    dealerOffset={dealerOffset}
                  />
                );
              })}
            </div>

            <div 
              style={{ transform: `translate(calc(-50% + ${potXOffset}px), calc(-50% + ${potYOffset}px))` }}
              className="absolute top-[48%] left-1/2 flex flex-col items-center z-30 pointer-events-none w-full h-full justify-center transition-transform duration-300"
            >
              {!potTransferring && (
                <div className={`flex flex-col items-center transition-all duration-300 font-black uppercase ${potAnimating ? 'scale-110' : 'scale-100'}`}>
                    <span className="text-[10px] md:text-[14px] text-white/30 tracking-[0.5em] mb-2 font-black uppercase">MAIN POT</span>
                    <div className={`text-[7vw] md:text-[5.5vw] font-black text-yellow-400 font-mono tracking-tighter drop-shadow-[0_8px_30px_rgba(0,0,0,0.9)] ${potAnimating ? 'animate-pot-pulse' : ''}`}>${Number(potAmount || 0).toLocaleString()}</div>
                </div>
              )}
              
              {/* Community Cards Area */}
              {['HOLDEM', 'OMAHA', 'PINEAPPLE', 'HILOW', 'MUFLIS', 'REDSBLACKS'].includes(activeVariant?.id) && (
                <div 
                    className="flex gap-2 md:gap-5 mt-10 md:mt-16 font-black uppercase transition-all duration-500"
                    style={{ transform: `scale(${communityCardScale}) translate(${commXOffset}px, ${commYOffset}px)` }}
                >
                    {(community || []).map((c, j) => {
                        const isWinningCard = winning5Ids?.includes(c.id);
                        return (
                          <div key={c.id || j} className={`w-[6vw] md:w-[3vw] h-[9vw] md:h-[5vw] rounded-[6px] border-2 bg-white flex flex-col items-center justify-center text-black font-black transition-all duration-500 shadow-2xl animate-in zoom-in slide-in-from-bottom-4 ${isWinningCard ? 'ring-4 ring-yellow-400 scale-125 z-30 shadow-[0_0_50px_rgba(251,191,36,0.9)] animate-pulse-winning-card' : 'border-black/5'}`}>
                              <span className="text-[15px] md:text-[0.95vw] font-black leading-none">{String(c.value)}</span>
                              <span className={`text-[20px] md:text-[2.2vw] font-black mt-0.5 ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                          </div>
                        );
                    })}
                </div>
              )}
            </div>
        </div>
      </main>

      <footer style={{ height: `${footerHeight}px` }} className="bg-gradient-to-b from-[#0a0c10] to-[#040608] backdrop-blur-3xl border-t border-white/10 flex flex-col z-[100] shadow-[0_-15px_60px_rgba(0,0,0,0.8)] shrink-0 font-black uppercase overflow-hidden border-b-2 border-emerald-500/10">
        
        <div className="shrink-0 flex flex-col justify-center px-4 md:px-14 relative bg-white/[0.02] shadow-2xl py-4 font-black uppercase min-h-[160px] md:min-h-[180px]">
          {activeIdx === heroIdx && phase !== PHASES.SHOWDOWN && phase !== PHASES.IDLE && heroPlayerObj ? (
            <div className="flex flex-col gap-4 md:gap-7 animate-in slide-in-from-bottom duration-500 items-center w-full font-black uppercase max-w-[900px] mx-auto">
                <div className="absolute top-2 right-6 animate-in slide-in-from-right duration-700">
                    <div className="flex flex-col items-end">
                      <span className="text-[13px] md:text-[16px] text-purple-400 font-black uppercase drop-shadow-lg">
                        {phase === PHASES.PRE_FLOP ? "PRE-FLOP" : String(heroPlayerObj.strength || "HIGH CARD")}
                      </span>
                    </div>
                </div>

                <div className="flex gap-2 w-full font-black uppercase">
                    <button onClick={()=>handleAction('RAISE', Number(highestBet || 0) + Math.floor(Number(potAmount || 0) * 0.5))} className="flex-1 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] md:text-[13px] hover:bg-white/15 transition-all font-black active:scale-95 tracking-widest">1/2 POT</button>
                    <button onClick={()=>handleAction('RAISE', Number(highestBet || 0) + Number(potAmount || 0))} className="flex-1 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] md:text-[13px] hover:bg-white/15 transition-all font-black active:scale-95 tracking-widest">POT</button>
                    <button onClick={()=>handleAction('RAISE', Number(heroPlayerObj.chips || 0) + Number(heroPlayerObj.currentBet || 0))} className="flex-1 py-3 bg-red-600/20 border border-red-500/40 rounded-2xl text-[10px] md:text-[13px] text-red-400 hover:bg-red-600 hover:text-white transition-all font-black active:scale-95 tracking-widest">ALL-IN</button>
                </div>
                <div className="flex gap-3 md:gap-8 w-full items-center justify-center font-black">
                    <button onClick={()=>handleAction('FOLD')} className="w-16 md:w-40 h-14 md:h-18 bg-red-950/70 border-2 border-red-500/50 rounded-2xl tracking-[0.2em] hover:brightness-125 transition-all active:scale-90">FOLD</button>
                    <button onClick={()=>handleAction('CALL')} className="flex-1 max-w-[450px] h-14 md:h-18 bg-indigo-600/40 border-2 border-indigo-400/60 rounded-3xl text-xs md:text-2xl tracking-[0.4em] hover:brightness-125 shadow-2xl active:scale-90">
                        {Number(highestBet || 0) > Number(heroPlayerObj.currentBet || 0) ? `CALL $${(Number(highestBet || 0) - Number(heroPlayerObj.currentBet || 0)).toLocaleString()}` : 'CHECK'}
                    </button>
                    <div className="flex gap-2 md:gap-3 items-center bg-black/60 border-2 border-white/10 p-1 rounded-2xl shadow-inner min-w-[130px] md:min-w-[360px] font-black uppercase">
                        <div className="flex items-center bg-black/40 px-2 md:px-6 rounded-xl h-10 md:h-14 font-black uppercase">
                            <span className="text-[#fbbf24] text-xs md:text-2xl font-mono mr-1">$</span>
                            <input type="number" value={raiseInput} onChange={(e) => setRaiseInput(Math.min(Number(heroPlayerObj.chips || 0) + Number(heroPlayerObj.currentBet || 0), Math.max(minRaiseAllowed, Number(e.target.value))))} className="w-10 md:w-32 bg-transparent text-center font-mono text-xs md:text-3xl text-[#fbbf24] outline-none font-black" />
                        </div>
                        <button onClick={()=>handleAction('RAISE', Number(raiseInput))} className="flex-1 h-10 md:h-14 bg-gradient-to-b from-emerald-500 to-emerald-700 border-2 border-emerald-400/30 rounded-xl flex items-center justify-center hover:brightness-110 active:scale-90">
                            <Zap size={20} className="md:mr-3 text-white hidden md:block" /> RAISE
                        </button>
                    </div>
                </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full relative font-black uppercase">
                {showdownWinners && showdownWinners.length > 0 ? (
                    <div 
                      style={{ transform: `translate(${winnerX}px, ${winnerY}px) scale(${winnerScale / 100})` }}
                      className="flex flex-col items-center gap-2 w-full h-full justify-center relative animate-in fade-in duration-700 transition-transform"
                    >
                        <div className="flex flex-wrap gap-4 items-center justify-center w-full px-4 overflow-visible">
                            {showdownWinners.map((winner, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-3 bg-slate-900 border-4 border-yellow-500 shadow-[0_0_100px_rgba(251,191,36,0.6)] p-8 rounded-[3rem] min-w-[400px] animate-showdown-card-pop relative overflow-hidden z-[1000]" style={{ animationDelay: `${idx * 0.2}s` }}>
                                    <div className="absolute inset-0 bg-glimmer opacity-30 pointer-events-none" />
                                    <div className="flex flex-col items-center z-10">
                                        <div className="text-[#fbbf24] font-black text-4xl md:text-7xl tracking-tighter drop-shadow-2xl uppercase animate-winner-name-shimmer">{String(winner.name)}</div>
                                        <div className="flex items-center gap-4 mt-3">
                                            <div className="text-emerald-400 font-mono text-3xl md:text-5xl font-black drop-shadow-md">+${Number(winner.amount || 0).toLocaleString()}</div>
                                            <div className="text-white text-[12px] md:text-lg tracking-[0.2em] uppercase font-black px-6 py-2 bg-yellow-600 rounded-full border-2 border-yellow-400 shadow-xl">{String(winner.rank)}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 z-10 mt-4 animate-in zoom-in duration-1000 delay-300">
                                      {(winner.hand || []).map((c, ci) => (
                                        <div key={ci} className="w-16 h-24 md:w-20 md:h-32 bg-white rounded-xl flex flex-col items-center justify-center text-black shadow-2xl relative ring-2 ring-black/10 overflow-hidden">
                                          <div className="absolute inset-0 opacity-5 bg-black mix-blend-overlay" />
                                          <span className="text-xl md:text-2xl font-black absolute top-1.5 left-2 leading-none">{String(c.value)}</span>
                                          <span className={`text-5xl md:text-7xl ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-black'}`}>{String(c.suit)}</span>
                                        </div>
                                      ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 animate-in fade-in duration-700 font-black">
                        {phase === PHASES.IDLE ? (
                             <div className="flex flex-col items-center gap-3">
                                <span className="text-white/30 tracking-[0.6em] text-xs md:text-lg font-black italic uppercase">ARENA IDLE</span>
                             </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-3 text-cyan-400 animate-pulse mb-1">
                                    <span className="text-[10px] md:text-sm font-black tracking-[0.4em]">WAITING ON</span>
                                </div>
                                <span className="text-xl md:text-3xl font-black text-white tracking-tighter drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]">{String(players[activeIdx]?.name || "OPPONENT")}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden text-[13px] font-mono tracking-widest font-black uppercase bg-black/60 shadow-inner">
            <div className="text-white/40 mb-1 flex items-center justify-between border-b border-white/10 py-1.5 px-4 uppercase shrink-0">
                <div className="flex items-center gap-2 text-[10px] md:text-xs tracking-[0.2em] font-black"><Eye size={14} className="text-[#fbbf24]"/> INTELLIGENCE</div>
                <div className="flex items-center gap-2 text-emerald-500 animate-pulse text-[10px] font-black"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]" /> LIVE FEED</div>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto scrollbar-hide font-black px-4 py-2">
                {(logs || []).map(l => (
                    <div key={l.id} className="animate-in slide-in-from-left duration-300 flex items-center gap-3 border-l-4 border-white/5 pl-3 py-1 hover:bg-white/5 transition-all border-b border-white/5 rounded-r-lg group">
                        <span className="text-white/20 text-[9px] font-black shrink-0 w-12 group-hover:text-white/40 transition-colors">{String(l.time)}</span> 
                        <div className="flex items-center gap-x-2.5 font-black leading-none overflow-hidden">
                            <span className={`font-black uppercase text-[10px] px-1.5 py-0.5 rounded-md shadow-sm shrink-0 ${
                                l.type === 'win' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' : 
                                l.type === 'variant' ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30' : 
                                l.type === 'fold' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' :
                                l.type === 'phase' ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30' :
                                'bg-yellow-500/20 text-[#fbbf24] ring-1 ring-yellow-500/30'
                            }`}>{String(l.name)}</span>
                            <span className="text-white/50 lowercase tracking-tight text-[11px] font-black truncate">{String(l.action)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </footer>
      <style>{`
          @keyframes progress { from { width: 100%; } to { width: 0%; } }
          @keyframes bet-impact-slide {
            0% { transform: translate(calc(-50% + 0px), 150px) scale(0.3); opacity: 0; }
            70% { transform: translate(calc(-50% + var(--target-x, 0px)), var(--target-y, 0px)) scale(1.1); opacity: 1; }
            100% { transform: translate(calc(-50% + var(--target-x, 0px)), var(--target-y, 0px)) scale(1); }
          }
          @keyframes winner-aura {
            0% { transform: scale(1); opacity: 0.2; }
            50% { transform: scale(1.8); opacity: 0.5; }
            100% { transform: scale(1); opacity: 0.2; }
          }
          .animate-winner-aura { animation-name: winner-aura; animation-duration: 3s; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
          @keyframes fling-to-pot { 
            0% { transform: translate(-50%, -100%) scale(1.5) rotate(0deg); filter: blur(0px); opacity: 1; } 
            25% { transform: translate(calc(-50% + 20vw), -50vh) scale(1.3) rotate(90deg); filter: blur(1px); }
            100% { transform: translate(calc(-50% + (50vw - 50%)), -35vh) scale(0.01) rotate(1440deg); filter: blur(15px); opacity: 0; } 
          }
          @keyframes pot-pulse { 
            0% { transform: scale(1); filter: drop-shadow(0 0 0px #fbbf24); } 
            25% { transform: scale(1.3); filter: drop-shadow(0 0 60px #fbbf24) brightness(1.5); } 
            100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(251,191,36,0.4)); } 
          }
          .animate-pot-pulse { animation-name: pot-pulse; animation-duration: 1s; animation-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275); }
          .bg-glimmer { background: linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.3) 48%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.3) 52%, transparent 100%); background-size: 200% 200%; animation-name: glimmer; animation-duration: 4s; animation-iteration-count: infinite; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
          @keyframes glimmer { 0% { background-position: -200% -200%; } 100% { background-position: 200% 200%; } }
          @keyframes turn-glow { 
            0% { border-color: rgba(34,211,238,0.3); box-shadow: 0 0 15px rgba(34,211,238,0.2); } 
            50% { border-color: rgba(34,211,238,1); box-shadow: 0 0 45px rgba(34,211,238,0.5); } 
            100% { border-color: rgba(34,211,238,0.3); box-shadow: 0 0 15px rgba(34,211,238,0.2); } 
          }
          .animate-turn-glow { animation-name: turn-glow; animation-duration: 3s; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
          @keyframes pulse-winning-card {
            0% { filter: brightness(1); transform: scale(1.25); }
            50% { filter: brightness(1.6) drop-shadow(0 0 35px #fbbf24); transform: scale(1.4); }
            100% { filter: brightness(1); transform: scale(1.25); }
          }
          .animate-pulse-winning-card { animation-name: pulse-winning-card; animation-duration: 2s; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
          @keyframes winner-name-shimmer {
            0% { transform: scale(0.95); text-shadow: 0 0 0px #fbbf24; }
            50% { transform: scale(1.1); text-shadow: 0 0 35px #fbbf24, 0 0 70px #fbbf24; opacity: 1; }
            100% { transform: scale(1); text-shadow: 0 0 20px #fbbf24; }
          }
          .animate-winner-name-shimmer { animation-name: winner-name-shimmer; animation-duration: 2.5s; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
          ::-webkit-scrollbar { display: none; }
          @keyframes bounce-short {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          .animate-bounce-short { animation-name: bounce-short; animation-duration: 1.5s; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
          @keyframes showdown-pop {
            0% { transform: scale(0.4) translateY(150px) rotateX(-50deg); opacity: 0; filter: blur(20px); }
            100% { transform: scale(1) translateY(0) rotateX(0deg); opacity: 1; filter: blur(0px); }
          }
          .animate-showdown-card-pop { animation-name: showdown-pop; animation-duration: 0.9s; animation-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275); animation-fill-mode: forwards; }
          @keyframes card-reveal-reveal {
            0% { transform: rotateY(180deg) scale(1) translateY(0); }
            50% { transform: rotateY(90deg) scale(1.7) translateY(-60px); }
            100% { transform: rotateY(0deg) scale(1.3) translateY(-40px); }
          }
          .preserve-3d { transform-style: preserve-3d; }
          .animate-spin-slow { animation-name: spin; animation-duration: 5s; animation-iteration-count: infinite; animation-timing-function: linear; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
