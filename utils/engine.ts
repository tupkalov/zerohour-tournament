import { Match, ResolvedSlot, Slot } from "../types";

// Helper to look up a match by ID from the current state array
const findMatch = (matches: Match[], id: string) => matches.find(m => m.id === id);

export const resolveSlot = (matches: Match[], slot: Slot): ResolvedSlot => {
  if (slot.kind === 'bye') return { name: 'BYE', isBye: true, resolved: true };
  if (slot.kind === 'player') return { name: slot.name || '?', isBye: false, resolved: true };
  
  if (slot.kind === 'ref' && slot.from) {
    const m = findMatch(matches, slot.from);
    if (!m) return { name: '—', isBye: false, resolved: false };

    if (slot.which === 'winner') {
      if (m.winner === 'BYE') return { name: 'BYE', isBye: true, resolved: true };
      if (m.winner) return { name: m.winner, isBye: false, resolved: true };
      return { name: `Winner of ${m.name}`, isBye: false, resolved: false };
    } else {
      // Logic for loser
      if (!m.winner) return { name: `Loser of ${m.name}`, isBye: false, resolved: false };
      
      const resA = resolveSlot(matches, m.a);
      const resB = resolveSlot(matches, m.b);
      
      // If one was BYE, the loser is BYE (phantom match)
      if (resA.isBye && !resB.isBye) return { name: 'BYE', isBye: true, resolved: true };
      if (!resA.isBye && resB.isBye) return { name: 'BYE', isBye: true, resolved: true };
      if (resA.isBye && resB.isBye) return { name: 'BYE', isBye: true, resolved: true };

      if (m.winner === resA.name) return { name: resB.name, isBye: false, resolved: true };
      if (m.winner === resB.name) return { name: resA.name, isBye: false, resolved: true };
    }
  }
  return { name: '—', isBye: false, resolved: false };
};

// Returns a new array of matches with the score updated and potentially the winner set
export const updateMatchScore = (
  matches: Match[], 
  matchId: string, 
  side: 'a' | 'b', 
  winsNeeded: number
): Match[] => {
  const matchIndex = matches.findIndex(m => m.id === matchId);
  if (matchIndex === -1) return matches;

  const m = matches[matchIndex];
  
  // Prevent update if already won
  if (m.winner) return matches; 

  const newScoreA = side === 'a' ? Math.min(winsNeeded, m.scoreA + 1) : m.scoreA;
  const newScoreB = side === 'b' ? Math.min(winsNeeded, m.scoreB + 1) : m.scoreB;

  let newWinner: string | null = null;
  const resA = resolveSlot(matches, m.a);
  const resB = resolveSlot(matches, m.b);

  if (newScoreA >= winsNeeded) newWinner = resA.name;
  else if (newScoreB >= winsNeeded) newWinner = resB.name;

  const updatedMatch = { ...m, scoreA: newScoreA, scoreB: newScoreB, winner: newWinner };
  
  // Clone array and replace
  const newMatches = [...matches];
  newMatches[matchIndex] = updatedMatch;

  // If winner changed (e.g. from null to name), we might need to reset downstream 
  // actually, if we just set winner, we don't need to reset downstream. 
  // Downstream only needs reset if we CHANGE an existing winner.
  
  return newMatches;
};

// Recursive reset of downstream matches
export const resetMatchAndDownstream = (matches: Match[], matchId: string): Match[] => {
  let currentMatches = [...matches];
  const targetIndex = currentMatches.findIndex(m => m.id === matchId);
  if (targetIndex === -1) return matches;

  // Reset the target
  currentMatches[targetIndex] = { ...currentMatches[targetIndex], scoreA: 0, scoreB: 0, winner: null };

  // Find matches that depend on this one
  const dependants = currentMatches.filter(m => 
    (m.a.kind === 'ref' && m.a.from === matchId) || 
    (m.b.kind === 'ref' && m.b.from === matchId)
  );

  for (const dep of dependants) {
    if (dep.scoreA > 0 || dep.scoreB > 0 || dep.winner) {
      currentMatches = resetMatchAndDownstream(currentMatches, dep.id);
    }
  }
  
  return currentMatches;
};

export const autoAdvanceByes = (matches: Match[], winsNeeded: number): Match[] => {
  let changed = false;
  const newMatches = [...matches];

  for (let i = 0; i < newMatches.length; i++) {
    const m = newMatches[i];
    if (m.winner) continue;

    const resA = resolveSlot(newMatches, m.a);
    const resB = resolveSlot(newMatches, m.b);

    if (resA.resolved && resB.resolved) {
      if (resA.isBye && !resB.isBye) {
        newMatches[i] = { ...m, scoreA: 0, scoreB: winsNeeded, winner: resB.name };
        changed = true;
      } else if (!resA.isBye && resB.isBye) {
        newMatches[i] = { ...m, scoreA: winsNeeded, scoreB: 0, winner: resA.name };
        changed = true;
      } else if (resA.isBye && resB.isBye) {
        newMatches[i] = { ...m, winner: 'BYE' };
        changed = true;
      }
    }
  }

  // If we auto-advanced something, run it again to propagate
  if (changed) return autoAdvanceByes(newMatches, winsNeeded);
  return newMatches;
};