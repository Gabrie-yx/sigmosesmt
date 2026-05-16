const KEY = "sigmo:pendencias:snooze:v1";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function read(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("sigmo:snooze-changed"));
}

export function isSnoozed(key: string): boolean {
  const map = read();
  const until = map[key];
  if (!until) return false;
  return until >= todayISO();
}

export function snoozeUntilTomorrow(key: string) {
  const map = read();
  map[key] = tomorrowISO();
  write(map);
}

export function clearSnooze(key: string) {
  const map = read();
  delete map[key];
  write(map);
}

export function useSnoozeVersion() {
  // tiny re-render trigger
  if (typeof window === "undefined") return 0;
  return 0;
}
