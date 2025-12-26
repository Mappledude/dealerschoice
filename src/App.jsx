// ... (Keep all imports and constants at the top exactly as they were)

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
      // AUTO-JOIN: This ensures the server sees you immediately
      newSocket.emit('joinGame', { name: 'Hero' });
    });

    newSocket.on('gameUpdate', (data) => {
      setPlayers(data.players);
      setPhase(data.phase);
      setCommunity(data.community);
      setActiveIdx(data.activeIdx);
      setPotData(data.potData);
      setWinning5Ids(data.winning5Ids || []);
      setWinningPlayerIndices(data.winningPlayerIndices || []);
      setPotTransferring(data.potTransferring || false);
      setActiveVariant(VARIANTS[data.variantId] || VARIANTS.HOLDEM);
      setHighestBet(data.highestBet || 0);
    });

    newSocket.on('log', (log) => setLogs(prev => [log, ...prev].slice(0, 50)));
    return () => newSocket.close();
  }, []);

  const userSeat = useMemo(() => players.find(p => p?.userId === localId), [players, localId]);
  const isHeroTurn = activeIdx !== -1 && userSeat && players[activeIdx]?.userId === localId && phase !== PHASES.IDLE;
  const currentPotOnTable = useMemo(() => (potData[0]?.amount || 0) + players.reduce((s, p) => s + (p?.currentBet || 0), 0), [potData, players]);

  // EMIT ADMIN ACTIONS: Sends bot requests to the server
  const handleAddBot = () => { if (socket) socket.emit('addBot'); };
  const handleClearArena = () => { if (socket) socket.emit('clearArena'); };
  const handleAction = (type, amt = 0) => { if (socket) socket.emit('playerAction', { type, amount: amt }); };

  const winnerPos = useMemo(() => {
    if (winningPlayerIndices.length === 0) return { x: 50, y: 43 };
    return SEAT_POSITIONS[winningPlayerIndices[0]];
  }, [winningPlayerIndices]);

  return (
    <div className="h-screen bg-[#06080c] text-white font-sans flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a202c_0%,_#06080c_100%)] pointer-events-none" />
      
      {/* HEADER: Moved to top-level so it never disappears */}
      <header className="absolute top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-[30px] border-b border-white/10 flex items-center justify-between px-8 z-[8000] shadow-xl">
        <div className="flex items-center gap-6">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-slate-400">
            <ChevronLeft size={20} className={sidebarOpen ? 'rotate-0' : 'rotate-180'} />
          </button>
          <div className="bg-white/5 border border-white/10 px-6 py-2 rounded-2xl">
            <span className="text-[#fbbf24] font-black text-xl uppercase whitespace-nowrap">MULTIPLAYER LOBBY</span>
          </div>
        </div>
      </header>

      {/* SIDEBAR: Admin tools */}
      <aside className={`fixed left-0 top-16 bottom-[200px] bg-[#0f172a]/95 backdrop-blur-[25px] border-r border-white/5 transition-all duration-500 z-[7500] ${sidebarOpen ? 'w-[20vw] min-w-[280px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
        <div className="p-6 space-y-4">
          <button onClick={handleAddBot} className="w-full flex items-center gap-3 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 p-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-600/30 transition-all">
            <UserPlus size={18}/> Add Bot
          </button>
          <button onClick={handleClearArena} className="w-full flex items-center gap-3 bg-red-950/20 border border-red-500/30 text-red-400 p-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-950/40 transition-all">
            <Trash2 size={18}/> Clear Table
          </button>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center relative pt-16 pb-36 px-4">
        {/* Table Felt, Pot, and Cards */}
        <div className="relative w-full max-w-[1600px] aspect-[21/10] mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-emerald-950/5 rounded-[40%] border-[1.5vw] border-slate-900 shadow-[inset_0_0_8vw_rgba(245,158,11,0.2)]" />
            
            <div className="absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
              <div className="text-[4vw] font-black text-yellow-400 font-mono">${currentPotOnTable}</div>
              <div className="flex gap-2 scale-[1.7] mt-10 justify-center">
                {community.map((c, i) => (
                  <div key={i} className="w-[3vw] h-[4.2vw] bg-white rounded-[0.4vw] flex flex-col items-center justify-center shadow-2xl">
                    <span className="text-[0.9vw] font-black text-slate-950">{c.value}</span>
                    <span className={`text-[1.8vw] ${c.suit === '♥' || c.suit === '♦' ? 'text-red-600' : 'text-slate-950'}`}>{c.suit}</span>
                  </div>
                ))}
              </div>
            </div>

            {players.map((p, i) => <Seat key={i} player={p} index={i} phase={phase} localId={localId} winning5Ids={winning5Ids} potTransferring={potTransferring} />)}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
               {/* Hero Cards & Name Badge */}
               <div className={`flex items-center gap-4 px-10 py-2 rounded-full border-2 bg-black shadow-2xl border-white/10`}>
                  <div className="text-center">
                    <div className="text-[1.2vw] font-black uppercase">{userSeat ? userSeat.name : "JOINING..."}</div>
                    <div className="text-emerald-500 font-mono font-black text-[1.3vw]">${userSeat?.chips || 0}</div>
                  </div>
               </div>
            </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 h-[200px] bg-black/40 backdrop-blur-3xl border-t border-white/10 z-[6000] flex pointer-events-auto">
         {/* ... (Intelligence Feed & HUD logic as before) */}
      </footer>
    </div>
  );
};
// ADD THIS LINE AT THE VERY BOTTOM
export default App;
