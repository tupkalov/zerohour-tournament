import React from 'react';
import { Match, ResolvedSlot } from '../types';
import { RefreshCw, Trophy } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  resA: ResolvedSlot;
  resB: ResolvedSlot;
  bestOf: number;
  onWin: (id: string, side: 'a' | 'b') => void;
  onReset: (id: string) => void;
}

const Dot = ({ status }: { status: 'win' | 'lose' | 'pending' }) => {
  let color = 'bg-slate-700 border-slate-600';
  let shadow = '';
  
  if (status === 'win') {
    color = 'bg-[#2ee59d] border-[#2ee59d]';
    shadow = 'shadow-[0_0_10px_rgba(46,229,157,0.6)]';
  } else if (status === 'lose') {
    color = 'bg-[#ff6b7a] border-[#ff6b7a]';
    shadow = 'shadow-[0_0_10px_rgba(255,107,122,0.6)]';
  }

  return (
    <div className={`w-2.5 h-2.5 rounded-full border ${color} ${shadow} transition-all duration-300`} />
  );
};

const Dots = ({ wins, losses, total }: { wins: number, losses: number, total: number }) => {
  const dots = [];
  for (let i = 0; i < total; i++) {
    let status: 'win' | 'lose' | 'pending' = 'pending';
    if (i < wins) status = 'win';
    else if (i < wins + losses) status = 'lose';
    dots.push(<Dot key={i} status={status} />);
  }
  return <div className="flex gap-1.5">{dots}</div>;
};

export const MatchCard: React.FC<MatchCardProps> = ({ match, resA, resB, bestOf, onWin, onReset }) => {
  const isFinished = !!match.winner;
  const winsNeeded = bestOf === 3 ? 2 : 1;
  const isBO3 = bestOf === 3;

  const canInteract = !match.winner && resA.resolved && resB.resolved && (!resA.isBye && !resB.isBye);

  const getSlotClass = (isWinner: boolean, isLoser: boolean, sideBye: boolean) => {
    let base = "relative p-3 flex justify-between items-center bg-black/20 border border-slate-700/50 transition-all duration-200";
    if (sideBye) return `${base} opacity-50 cursor-not-allowed`;
    if (match.winner) {
      if (isWinner) return `${base} border-[#2ee59d]/70 bg-[#2ee59d]/5 shadow-[0_0_15px_rgba(46,229,157,0.1)] z-10`;
      if (isLoser) return `${base} border-[#ff6b7a]/40 bg-[#ff6b7a]/5 opacity-60`;
    }
    if (canInteract) return `${base} hover:border-blue-400/60 hover:bg-white/5 cursor-pointer`;
    return `${base} opacity-70 cursor-not-allowed`;
  };

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-gradient-to-b from-[#0e1621] to-[#0a1018] border border-blue-500/20 shadow-lg w-72 shrink-0 snap-start relative group">
      
      {/* Header */}
      <div className="flex justify-between items-center text-xs text-slate-400 px-1">
        <div className="flex items-center gap-2">
           <span className="font-bold tracking-wider text-blue-200/80">{match.name}</span>
           <button 
            onClick={(e) => { e.stopPropagation(); onReset(match.id); }}
            className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Reset Match"
           >
             <RefreshCw size={12} />
           </button>
        </div>
        <div className="flex items-center gap-2 font-mono">
           <span>BO{bestOf}</span>
           <span className="text-white font-bold">{match.scoreA}-{match.scoreB}</span>
        </div>
      </div>

      {/* Slots Container */}
      <div className="flex flex-col gap-[1px] bg-slate-800/50 border border-slate-700/50 overflow-hidden">
        {/* Slot A */}
        <div 
          className={getSlotClass(match.winner === resA.name, match.winner === resB.name, resA.isBye)}
          onClick={() => canInteract && !resA.isBye && onWin(match.id, 'a')}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <span className={`font-bold text-sm tracking-wide truncate ${match.winner === resA.name ? 'text-white' : 'text-slate-300'}`}>
              {resA.name}
            </span>
          </div>
          {isBO3 && !resA.isBye && !resB.isBye && (
            <Dots wins={match.scoreA} losses={match.scoreB} total={winsNeeded} />
          )}
          {match.winner === resA.name && <Trophy size={14} className="text-[#2ee59d]" />}
        </div>

        {/* Slot B */}
        <div 
          className={getSlotClass(match.winner === resB.name, match.winner === resA.name, resB.isBye)}
          onClick={() => canInteract && !resB.isBye && onWin(match.id, 'b')}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <span className={`font-bold text-sm tracking-wide truncate ${match.winner === resB.name ? 'text-white' : 'text-slate-300'}`}>
              {resB.name}
            </span>
          </div>
          {isBO3 && !resA.isBye && !resB.isBye && (
            <Dots wins={match.scoreB} losses={match.scoreA} total={winsNeeded} />
          )}
          {match.winner === resB.name && <Trophy size={14} className="text-[#2ee59d]" />}
        </div>
      </div>

    </div>
  );
};