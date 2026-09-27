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

export function parseArrivalTime(value: string): string | null | undefined {
  if (!value.trim()) return null;
  const digits = value.trim().replace(/:/g, '');
  if (!/^(?:\d{4}|\d{6}|\d{2}:\d{2}(?::\d{2})?)$/.test(value.trim())) return undefined;
  const [h, m, s] = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6) || '00'];
  return Number(h) < 24 && Number(m) < 60 && Number(s) < 60 ? `${h}:${m}:${s}` : undefined;
}

