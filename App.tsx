import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, RotateCcw, Zap, ChevronDown, ChevronUp, Users, Trash2 
} from 'lucide-react';
import { 
  generateDoubleElim, generateSingleElim, generateRoundRobin, shuffleArray 
} from './utils/generator';
import { 
  resolveSlot, updateMatchScore, resetMatchAndDownstream, autoAdvanceByes 
} from './utils/engine';
import { Match, TournamentFormat, PlayerStats } from './types';
import { MatchCard } from './components/MatchCard';
import { Standings } from './components/Standings';

// Background components
const AmbientBackground = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <div className="absolute top-0 left-[30%] w-[800px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen" />
    <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px] mix-blend-screen" />
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
  </div>
);

const DEFAULT_PLAYERS = "EBAKA TIMUR KOLYAN DIMOS STASYA ANDREY".split(" ").join("\n");
const STORAGE_KEY = 'zh_tournament_state_v1';

export default function App() {
  // State
  const [playerInput, setPlayerInput] = useState(DEFAULT_PLAYERS);
  const [format, setFormat] = useState<TournamentFormat>('double');
  const [bestOf, setBestOf] = useState<number>(1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [collapsed, setCollapsed] = useState({ wb: false, lb: false, rr: false });
  const [mounted, setMounted] = useState(false);

  // Persistence: Load
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Restore state, fallback to defaults if keys missing
        setPlayerInput(parsed.playerInput ?? DEFAULT_PLAYERS);
        setFormat(parsed.format ?? 'double');
        setBestOf(parsed.bestOf ?? 1);
        setMatches(parsed.matches ?? []);
        setCollapsed(parsed.collapsed ?? { wb: false, lb: false, rr: false });
      } catch (e) {
        console.error("Failed to load state from localStorage", e);
      }
    }
    setMounted(true);
  }, []);

  // Persistence: Save
  useEffect(() => {
    if (!mounted) return;
    
    const state = {
      playerInput,
      format,
      bestOf,
      matches,
      collapsed
    };
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
    }
  }, [playerInput, format, bestOf, matches, collapsed, mounted]);

  // Actions
  const handleGenerate = () => {
    const names = playerInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (names.length < 2) {
      alert("Please enter at least 2 players.");
      return;
    }
    const shuffled = shuffleArray(names);
    
    let newMatches: Match[] = [];
    if (format === 'single') newMatches = generateSingleElim(shuffled);
    else if (format === 'double') newMatches = generateDoubleElim(shuffled);
    else newMatches = generateRoundRobin(shuffled);

    // Initial Auto Bye Check
    const winsNeeded = bestOf === 3 ? 2 : 1;
    newMatches = autoAdvanceByes(newMatches, winsNeeded);

    setMatches(newMatches);
    // Expand relevant brackets on generate
    setCollapsed({ wb: false, lb: false, rr: false });
  };

  const handleResetScores = () => {
    if (confirm("Reset all match results? The bracket structure will remain.")) {
      const resetMatches = matches.map(m => ({ ...m, scoreA: 0, scoreB: 0, winner: null }));
      setMatches(autoAdvanceByes(resetMatches, bestOf === 3 ? 2 : 1));
    }
  };

  const handleClearAll = () => {
    if (confirm("This will clear all data, players, and brackets. Are you sure?")) {
      setPlayerInput(DEFAULT_PLAYERS);
      setMatches([]);
      setFormat('double');
      setBestOf(1);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleMatchWin = (id: string, side: 'a' | 'b') => {
    const winsNeeded = bestOf === 3 ? 2 : 1;
    const nextMatches = updateMatchScore(matches, id, side, winsNeeded);
    setMatches(autoAdvanceByes(nextMatches, winsNeeded));
  };

  const handleMatchReset = (id: string) => {
    const nextMatches = resetMatchAndDownstream(matches, id);
    const winsNeeded = bestOf === 3 ? 2 : 1;
    setMatches(autoAdvanceByes(nextMatches, winsNeeded));
  };

  const toggleCollapse = (section: 'wb' | 'lb' | 'rr') => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Grouping for Render
  const getBracketMatches = (bracketType: string) => {
    const filtered = matches.filter(m => m.bracket === bracketType);
    const rounds: Record<number, Match[]> = {};
    filtered.forEach(m => {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    });
    return Object.entries(rounds).sort(([a], [b]) => Number(a) - Number(b));
  };

  // Calculating Results
  const results = useMemo(() => {
    if (format === 'roundrobin') {
      const players = Array.from(new Set(matches.flatMap(m => [resolveSlot(matches, m.a).name, resolveSlot(matches, m.b).name])))
        .filter(n => n !== 'BYE' && n !== '—' && !n.startsWith('Winner') && !n.startsWith('Loser'));

      const statsMap = new Map<string, PlayerStats>();
      players.forEach(p => statsMap.set(p, { name: p, played: 0, wins: 0, losses: 0, matchPoints: 0, mapPoints: 0 }));

      matches.forEach(m => {
        if (!m.winner || m.winner === 'BYE') return;
        const resA = resolveSlot(matches, m.a);
        const resB = resolveSlot(matches, m.b);
        if (resA.isBye || resB.isBye) return;

        const winner = statsMap.get(m.winner);
        const loserName = m.winner === resA.name ? resB.name : resA.name;
        const loser = statsMap.get(loserName);

        if (winner) {
          winner.played++;
          winner.wins++;
          winner.matchPoints += 3;
          winner.mapPoints += m.winner === resA.name ? m.scoreA : m.scoreB;
        }
        if (loser) {
          loser.played++;
          loser.losses++;
          loser.mapPoints += m.winner === resA.name ? m.scoreB : m.scoreA;
        }
      });

      const sortedStats = Array.from(statsMap.values()).sort((a, b) => {
        if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
        if (b.mapPoints !== a.mapPoints) return b.mapPoints - a.mapPoints;
        return b.wins - a.wins;
      });

      return {
        p1: sortedStats[0]?.name || '—',
        p2: sortedStats[1]?.name || '—',
        p3: sortedStats[2]?.name || '—',
        stats: sortedStats
      };
    } else {
      // Elim Formats
      let p1 = '—', p2 = '—', p3 = '—';
      
      const gfMatches = matches.filter(m => m.bracket === 'GF');
      const lastGF = gfMatches.find(m => m.id === 'GF-2')?.winner ? gfMatches.find(m => m.id === 'GF-2') : gfMatches.find(m => m.id === 'GF-1');
      
      const finalMatch = format === 'single' ? matches.find(m => m.bracket === 'WB' && m.round === Math.max(...matches.map(x => x.round))) : lastGF;

      if (finalMatch?.winner && finalMatch.winner !== 'BYE') {
        p1 = finalMatch.winner;
        const resA = resolveSlot(matches, finalMatch.a);
        const resB = resolveSlot(matches, finalMatch.b);
        p2 = finalMatch.winner === resA.name ? resB.name : resA.name;
      }

      // Logic for 3rd place in Double Elim
      if (format === 'double') {
        const lbFinal = matches.find(m => m.name === 'LB Final');
        if (lbFinal?.winner) {
           const resA = resolveSlot(matches, lbFinal.a);
           const resB = resolveSlot(matches, lbFinal.b);
           const loser = lbFinal.winner === resA.name ? resB.name : resA.name;
           if (loser !== 'BYE') p3 = loser;
        }
      }

      return { p1, p2, p3 };
    }
  }, [matches, format]);

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen text-slate-200 font-sans selection:bg-blue-500/30">
      <AmbientBackground />
      
      {/* Container */}
      <div className="relative z-10 max-w-[1400px] mx-auto p-4 lg:p-8 flex flex-col gap-8">
        
        {/* Header */}
        <header className="flex flex-col lg:flex-row gap-6 justify-between items-end border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              Zero Hour
            </h1>
            <p className="text-slate-400 text-sm mt-1 tracking-wide">
              Tournament Manager <span className="mx-2 opacity-50">•</span> Local Storage Auto-Save
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            <div className="flex bg-slate-900/80 border border-slate-700 rounded-lg p-1">
              <select 
                value={format} 
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                className="bg-transparent text-sm font-bold uppercase outline-none px-3 py-1.5 text-blue-200 cursor-pointer"
              >
                <option value="double">Double Elim</option>
                <option value="single">Single Elim</option>
                <option value="roundrobin">Round Robin</option>
              </select>
            </div>

            <div className="flex bg-slate-900/80 border border-slate-700 rounded-lg p-1">
              <select 
                value={bestOf} 
                onChange={(e) => setBestOf(Number(e.target.value))}
                className="bg-transparent text-sm font-bold uppercase outline-none px-3 py-1.5 text-blue-200 cursor-pointer"
              >
                <option value={1}>Best of 1</option>
                <option value={3}>Best of 3</option>
              </select>
            </div>

            <button 
              onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-xs tracking-wider rounded shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all active:scale-95"
            >
              <Zap size={14} /> Generate
            </button>

            <button 
              onClick={handleResetScores}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-bold uppercase text-xs tracking-wider rounded transition-all active:scale-95"
              title="Reset scores but keep bracket"
            >
              <RotateCcw size={14} /> Scores
            </button>

             <button 
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 text-red-200 font-bold uppercase text-xs tracking-wider rounded transition-all active:scale-95"
              title="Clear all data and start over"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </header>

        {/* Input & Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Players */}
          <section className="lg:col-span-3 flex flex-col gap-4">
            <div className="p-1 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/50 shadow-xl">
              <div className="flex items-center gap-2 p-3 border-b border-white/5">
                <Users size={16} className="text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Participants</span>
              </div>
              <div className="p-3">
                <textarea 
                  value={playerInput}
                  onChange={(e) => setPlayerInput(e.target.value)}
                  spellCheck={false}
                  className="w-full h-40 bg-black/30 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 focus:bg-black/50 transition-all resize-y"
                  placeholder="One name per line..."
                />
                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                  One name per line. Empty lines ignored. <br/>
                  Click 'Generate' to shuffle and build the bracket.
                </p>
              </div>
            </div>
          </section>

          {/* Results */}
          <section className="lg:col-span-9">
            <div className="h-full p-1 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/50 shadow-xl flex flex-col">
              <div className="flex items-center gap-2 p-3 border-b border-white/5">
                <Trophy size={16} className="text-yellow-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Standings</span>
              </div>
              <div className="p-6 grow flex flex-col justify-center">
                <Standings 
                  p1={results.p1} 
                  p2={results.p2} 
                  p3={results.p3} 
                  stats={results.stats}
                  format={format}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Brackets Area */}
        {matches.length > 0 && (
          <div className="flex flex-col gap-8 pb-20">
            
            {/* Round Robin */}
            {format === 'roundrobin' && (
              <BracketSection 
                title="Round Robin Matches" 
                collapsed={collapsed.rr} 
                onToggle={() => toggleCollapse('rr')}
              >
                 <div className="flex gap-4 overflow-x-auto pb-6 snap-x">
                    {getBracketMatches('RR').map(([round, roundMatches]) => (
                      <div key={round} className="flex flex-col gap-4 min-w-max snap-start">
                        <div className="text-center text-xs font-bold uppercase tracking-widest text-slate-500 bg-black/20 py-1 rounded">Round {round}</div>
                        {roundMatches.map(m => (
                          <MatchCard 
                            key={m.id} 
                            match={m} 
                            resA={resolveSlot(matches, m.a)} 
                            resB={resolveSlot(matches, m.b)}
                            bestOf={bestOf}
                            onWin={handleMatchWin}
                            onReset={handleMatchReset}
                          />
                        ))}
                      </div>
                    ))}
                 </div>
              </BracketSection>
            )}

            {/* Winners Bracket */}
            {(format === 'single' || format === 'double') && (
              <BracketSection 
                title={format === 'single' ? "Main Bracket" : "Winners Bracket"} 
                collapsed={collapsed.wb} 
                onToggle={() => toggleCollapse('wb')}
              >
                 <div className="flex gap-8 overflow-x-auto pb-6 snap-x px-1">
                    {getBracketMatches('WB').map(([round, roundMatches]) => (
                      <div key={round} className="flex flex-col justify-around gap-6 min-w-max snap-start">
                        <div className="text-center text-xs font-bold uppercase tracking-widest text-blue-400/80 bg-blue-900/10 border border-blue-500/10 py-1.5 rounded">Round {round}</div>
                        <div className="flex flex-col justify-around grow gap-4">
                          {roundMatches.map(m => (
                            <MatchCard 
                              key={m.id} 
                              match={m} 
                              resA={resolveSlot(matches, m.a)} 
                              resB={resolveSlot(matches, m.b)}
                              bestOf={bestOf}
                              onWin={handleMatchWin}
                              onReset={handleMatchReset}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    {/* Grand Final attached to WB view usually */}
                    {getBracketMatches('GF').length > 0 && (
                      <div className="flex flex-col justify-center gap-6 min-w-max snap-start border-l border-white/5 pl-8">
                         <div className="text-center text-xs font-bold uppercase tracking-widest text-yellow-400/80 bg-yellow-900/10 border border-yellow-500/10 py-1.5 rounded">Grand Final</div>
                         <div className="flex flex-col gap-4">
                           {getBracketMatches('GF').flatMap(([_, ms]) => ms).map(m => (
                              <MatchCard 
                                key={m.id} 
                                match={m} 
                                resA={resolveSlot(matches, m.a)} 
                                resB={resolveSlot(matches, m.b)}
                                bestOf={bestOf}
                                onWin={handleMatchWin}
                                onReset={handleMatchReset}
                              />
                           ))}
                         </div>
                      </div>
                    )}
                 </div>
              </BracketSection>
            )}

            {/* Losers Bracket */}
            {format === 'double' && (
              <BracketSection 
                title="Losers Bracket" 
                collapsed={collapsed.lb} 
                onToggle={() => toggleCollapse('lb')}
              >
                 <div className="flex gap-8 overflow-x-auto pb-6 snap-x px-1">
                    {getBracketMatches('LB').map(([round, roundMatches]) => (
                      <div key={round} className="flex flex-col justify-end gap-6 min-w-max snap-start">
                        <div className="text-center text-xs font-bold uppercase tracking-widest text-red-400/80 bg-red-900/10 border border-red-500/10 py-1.5 rounded">Round {round}</div>
                        <div className="flex flex-col gap-4">
                          {roundMatches.map(m => (
                            <MatchCard 
                              key={m.id} 
                              match={m} 
                              resA={resolveSlot(matches, m.a)} 
                              resB={resolveSlot(matches, m.b)}
                              bestOf={1} // Losers usually BO1 until late, but keeping flexible
                              onWin={handleMatchWin}
                              onReset={handleMatchReset}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                 </div>
              </BracketSection>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

const BracketSection = ({ title, collapsed, onToggle, children }: { title: string, collapsed: boolean, onToggle: () => void, children: React.ReactNode }) => (
  <section className="rounded-xl bg-slate-900/40 border border-slate-700/50 shadow-2xl overflow-hidden backdrop-blur-sm">
    <div 
      className="flex items-center justify-between p-4 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
      onClick={onToggle}
    >
      <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-200 border-l-2 border-blue-500 pl-3">
        {title}
      </h2>
      <button className="text-slate-400">
        {collapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </button>
    </div>
    <div className={`transition-all duration-500 ease-in-out ${collapsed ? 'max-h-0 opacity-0' : 'max-h-[800px] opacity-100'} overflow-hidden`}>
      <div className="p-6 overflow-x-auto">
        {children}
      </div>
    </div>
  </section>
);