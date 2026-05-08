export function formatDateBR(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date.split("T")[0] + "T00:00:00");
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function addMonthsToDate(date: string, months: number): string {
  const d = new Date(date.split("T")[0] + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function addYearsToDate(date: string, years: number): string {
  const d = new Date(date.split("T")[0] + "T00:00:00");
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}