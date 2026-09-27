import type { CompetitorRaceResult as Row } from './types';

export function orderedArrivals(rows: Row[]) {
  return rows.filter(row => row.status === 'Finished' && (row.arrivalOrder != null || !!row.passage.finish || row.rank != null))
    .sort((a, b) => (a.arrivalOrder ?? a.rank ?? Infinity) - (b.arrivalOrder ?? b.rank ?? Infinity)
      || (a.passage.finish ?? '').localeCompare(b.passage.finish ?? ''));
}

export function normalizeArrivals(rows: Row[]): Row[] {
  const order = orderedArrivals(rows);
  return rows.map(row => {
    const index = order.findIndex(item => item.regattaParticipantId === row.regattaParticipantId);
    return index < 0 ? row : { ...row, arrivalOrder: index + 1 };
  });
}

/**
 * Heures connues qui encadrent une insertion à `index` dans `others` (ordre d'arrivée, sans la ligne déplacée).
 * Les heures « HH:MM:SS » se comparent comme des chaînes.
 */
export function timeBounds(others: Row[], index: number): { before: string | null; after: string | null } {
  // Les voisins les plus proches qui ont une heure : lisible même si une heure aberrante traîne ailleurs.
  const before = others.slice(0, index).reverse().find(row => row.passage.finish)?.passage.finish ?? null;
  const after = others.slice(index).find(row => row.passage.finish)?.passage.finish ?? null;
  return { before, after };
}

/** Une arrivée à cette heure peut-elle prendre cette place sans contredire les heures connues ? */
export function fitsAt(others: Row[], index: number, finish: string): boolean {
  const { before, after } = timeBounds(others, index);
  return (!before || before <= finish) && (!after || finish <= after);
}

/** Nombre d'heures connues contredites si l'arrivée prend cette place. */
function violations(others: Row[], index: number, finish: string): number {
  return others.reduce((count, row, position) => {
    const time = row.passage.finish;
    if (!time) return count;
    return count + (position < index ? Number(time > finish) : Number(time < finish));
  }, 0);
}

/**
 * Place (index) d'après l'heure, la plus proche de celle souhaitée : une heure connue range l'arrivée,
 * les arrivées sans heure gardent leur position relative. Si des heures déjà saisies se contredisent,
 * on retient la place qui en contredit le moins.
 */
export function placeForTime(others: Row[], desiredIndex: number, finish: string): number {
  let best = desiredIndex;
  let bestScore = violations(others, desiredIndex, finish);
  for (let index = 0; index <= others.length; index++) {
    const score = violations(others, index, finish);
    if (score < bestScore || (score === bestScore && Math.abs(index - desiredIndex) < Math.abs(best - desiredIndex))) {
      best = index;
      bestScore = score;
    }
  }
  return best;
}

/** La place imposée contredit-elle l'heure davantage que la meilleure place possible ? */
export function contradictsTime(others: Row[], index: number, finish: string): boolean {
  return violations(others, index, finish) > violations(others, placeForTime(others, index, finish), finish);
}

export function parseArrivalTime(value: string): string | null | undefined {
  if (!value.trim()) return null;
  const digits = value.trim().replace(/:/g, '');
  if (!/^(?:\d{4}|\d{6}|\d{2}:\d{2}(?::\d{2})?)$/.test(value.trim())) return undefined;
  const [h, m, s] = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6) || '00'];
  return Number(h) < 24 && Number(m) < 60 && Number(s) < 60 ? `${h}:${m}:${s}` : undefined;
}

