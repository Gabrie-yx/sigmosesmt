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
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function addMonthsToDate(date: string | null | undefined, months: number): string {
  if (!date) return "";
  const d = new Date(date.split("T")[0] + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function addYearsToDate(date: string | null | undefined, years: number): string {
  if (!date) return "";
  const d = new Date(date.split("T")[0] + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}