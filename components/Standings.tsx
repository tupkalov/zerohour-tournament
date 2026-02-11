import React from 'react';
import { PlayerStats } from '../types';

interface StandingsProps {
  p1: string;
  p2: string;
  p3: string;
  stats?: PlayerStats[];
  format: string;
}

export const Standings: React.FC<StandingsProps> = ({ p1, p2, p3, stats, format }) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Podium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: '1st Place', who: p1, color: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-100' },
          { label: '2nd Place', who: p2, color: 'border-slate-400/30 bg-slate-400/5 text-slate-100' },
          { label: '3rd Place', who: p3, color: 'border-orange-700/30 bg-orange-700/5 text-orange-100' },
        ].map((place, idx) => (
          <div key={idx} className={`flex flex-col items-center p-4 rounded-xl border ${place.color} shadow-lg backdrop-blur-sm`}>
            <span className="text-xs uppercase tracking-[0.2em] mb-2 opacity-70">{place.label}</span>
            <span className="text-lg font-black tracking-wider uppercase text-center break-all">{place.who}</span>
          </div>
        ))}
      </div>

      {/* Round Robin Table */}
      {format === 'roundrobin' && stats && (
        <div className="overflow-x-auto rounded-xl border border-blue-500/20 shadow-lg">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-slate-800/80 text-blue-200">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-center">Played</th>
                <th className="px-4 py-3 text-center">W</th>
                <th className="px-4 py-3 text-center">L</th>
                <th className="px-4 py-3 text-center">Pts (Match)</th>
                <th className="px-4 py-3 text-center">Pts (Map)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-slate-900/50">
              {stats.map((s, idx) => (
                <tr key={s.name} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-mono opacity-50">{idx + 1}</td>
                  <td className="px-4 py-3 font-bold">{s.name}</td>
                  <td className="px-4 py-3 text-center font-mono">{s.played}</td>
                  <td className="px-4 py-3 text-center font-mono text-green-400">{s.wins}</td>
                  <td className="px-4 py-3 text-center font-mono text-red-400">{s.losses}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-blue-300">{s.matchPoints}</td>
                  <td className="px-4 py-3 text-center font-mono opacity-75">{s.mapPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="text-xs text-slate-500 mt-2 text-center">
        {format === 'roundrobin' 
          ? 'Points (Match): 3 for winning a series. Points (Map): Total map wins.' 
          : 'Results update automatically as you complete the final matches.'}
      </div>
    </div>
  );
};