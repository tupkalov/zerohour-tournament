import { Match, Slot, TournamentFormat } from '../types';

const nextPow2 = (n: number) => {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
};

const chunkPairs = <T>(arr: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    out.push([arr[i], arr[i + 1]]);
  }
  return out;
};

const baseMatch = (
  id: string,
  bracket: Match['bracket'],
  round: number,
  name: string,
  a: Slot,
  b: Slot
): Match => ({
  id,
  name,
  bracket,
  round,
  a,
  b,
  scoreA: 0,
  scoreB: 0,
  winner: null,
});

export const shuffleArray = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const generateSingleElim = (names: string[]): Match[] => {
  const matches: Match[] = [];
  const N = names.length;
  const P = nextPow2(Math.max(2, N));
  const seeded = [...names];
  for (let i = 0; i < P - N; i++) seeded.push("BYE");

  const roundsCount = Math.log2(P) | 0;
  const matchIdsByRound: Record<number, string[]> = { 1: [] };

  const pairs = chunkPairs(seeded);
  pairs.forEach((pair, idx) => {
    const id = `S1-${idx + 1}`;
    const slotA: Slot = pair[0] === "BYE" ? { kind: "bye" } : { kind: "player", name: pair[0] };
    const slotB: Slot = pair[1] === "BYE" ? { kind: "bye" } : { kind: "player", name: pair[1] };
    matches.push(baseMatch(id, "WB", 1, id, slotA, slotB));
    matchIdsByRound[1].push(id);
  });

  for (let r = 2; r <= roundsCount; r++) {
    matchIdsByRound[r] = [];
    const prevIds = matchIdsByRound[r - 1];
    const prevPairs = chunkPairs(prevIds);
    prevPairs.forEach((pair, idx) => {
      const id = `S${r}-${idx + 1}`;
      matches.push(baseMatch(
        id, "WB", r, id,
        { kind: "ref", from: pair[0], which: "winner" },
        { kind: "ref", from: pair[1], which: "winner" }
      ));
      matchIdsByRound[r].push(id);
    });
  }

  return matches;
};

export const generateDoubleElim = (names: string[]): Match[] => {
  const matches: Match[] = [];
  const N = names.length;
  const P = nextPow2(Math.max(2, N));
  const seeded = [...names];
  for (let i = 0; i < P - N; i++) seeded.push("BYE");

  const wr = Math.log2(P) | 0;
  const wMatchIds: Record<number, string[]> = { 1: [] };

  // WB Round 1
  const pairs = chunkPairs(seeded);
  pairs.forEach((pair, idx) => {
    const id = `W1-${idx + 1}`;
    const slotA: Slot = pair[0] === "BYE" ? { kind: "bye" } : { kind: "player", name: pair[0] };
    const slotB: Slot = pair[1] === "BYE" ? { kind: "bye" } : { kind: "player", name: pair[1] };
    matches.push(baseMatch(id, "WB", 1, id, slotA, slotB));
    wMatchIds[1].push(id);
  });

  // WB Subsequent Rounds
  for (let r = 2; r <= wr; r++) {
    wMatchIds[r] = [];
    const prevPairs = chunkPairs(wMatchIds[r - 1]);
    prevPairs.forEach((pair, idx) => {
      const id = `W${r}-${idx + 1}`;
      matches.push(baseMatch(
        id, "WB", r, id,
        { kind: "ref", from: pair[0], which: "winner" },
        { kind: "ref", from: pair[1], which: "winner" }
      ));
      wMatchIds[r].push(id);
    });
  }

  // Losers Bracket
  let lbRound = 1;
  const losersOfW1: Slot[] = wMatchIds[1].map(id => ({ kind: "ref", from: id, which: "loser" }));
  const lbMatchIds: Record<number, string[]> = { [lbRound]: [] };

  chunkPairs(losersOfW1).forEach((pair, idx) => {
    const id = `L${lbRound}-${idx + 1}`;
    matches.push(baseMatch(id, "LB", lbRound, id, pair[0], pair[1]!)); // pair[1] exists as power of 2
    lbMatchIds[lbRound].push(id);
  });

  const winnersRefsFromLbRound = (r: number): Slot[] => lbMatchIds[r].map(id => ({ kind: "ref", from: id, which: "winner" }));

  for (let r = 2; r <= wr - 1; r++) {
    const even = ++lbRound;
    lbMatchIds[even] = [];

    const left = winnersRefsFromLbRound(even - 1);
    const right: Slot[] = wMatchIds[r].map(id => ({ kind: "ref", from: id, which: "loser" }));

    for (let i = 0; i < left.length; i++) {
      const id = `L${even}-${i + 1}`;
      matches.push(baseMatch(id, "LB", even, id, left[i], right[i]));
      lbMatchIds[even].push(id);
    }

    const odd = ++lbRound;
    lbMatchIds[odd] = [];
    chunkPairs(winnersRefsFromLbRound(even)).forEach((pair, idx) => {
      const id = `L${odd}-${idx + 1}`;
      matches.push(baseMatch(id, "LB", odd, id, pair[0], pair[1]!));
      lbMatchIds[odd].push(id);
    });
  }

  // LB Final
  const lastW = wMatchIds[wr][0];
  const lbFinalRound = lbRound + 1;
  const lbFinalId = `L${lbFinalRound}-1`;
  matches.push(baseMatch(
    lbFinalId, "LB", lbFinalRound, "LB Final",
    { kind: "ref", from: `L${lbRound}-1`, which: "winner" },
    { kind: "ref", from: lastW, which: "loser" }
  ));

  // Grand Finals
  const wbFinalId = wMatchIds[wr][0];
  matches.push(baseMatch(
    "GF-1", "GF", 1, "Grand Final",
    { kind: "ref", from: wbFinalId, which: "winner" },
    { kind: "ref", from: lbFinalId, which: "winner" }
  ));
  matches.push(baseMatch(
    "GF-2", "GF", 2, "Bracket Reset",
    { kind: "ref", from: "GF-1", which: "loser" },
    { kind: "ref", from: "GF-1", which: "winner" }
  ));

  return matches;
};

export const generateRoundRobin = (names: string[]): Match[] => {
  const matches: Match[] = [];
  const players = [...names];
  if (players.length % 2 === 1) players.push("BYE");

  const n = players.length;
  const rounds = n - 1;
  const half = n / 2;

  let arr = [...players];

  for (let r = 1; r <= rounds; r++) {
    for (let i = 0; i < half; i++) {
      const p1 = arr[i];
      const p2 = arr[n - 1 - i];
      const id = `RR${r}-${i + 1}`;
      const slotA: Slot = p1 === "BYE" ? { kind: "bye" } : { kind: "player", name: p1 };
      const slotB: Slot = p2 === "BYE" ? { kind: "bye" } : { kind: "player", name: p2 };
      matches.push(baseMatch(id, "RR", r, `R${r}`, slotA, slotB));
    }
    const fixed = arr[0];
    const rest = arr.slice(1);
    const last = rest.pop();
    if (last) rest.unshift(last);
    arr = [fixed, ...rest];
  }

  return matches;
};