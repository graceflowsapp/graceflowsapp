import { locale, tr } from "@/lib/i18n";


export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function monthKey(s: string): string {
  return s.slice(0, 7);
}

export function formatDateLong(s: string): string {
  return parseISODate(s).toLocaleDateString(locale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(s: string): string {
  return parseISODate(s).toLocaleDateString(locale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatMonth(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(locale(), {
    month: "long",
    year: "numeric",
  });
}

export function formatDateTimeLocal(s: string): string {
  const [date, time] = s.split("T");
  return `${formatDateShort(date)}${time ? ` · ${time}` : ""}`;
}

export function daysUntil(s: string): number {
  const ms = parseISODate(s).getTime() - parseISODate(todayISO()).getTime();
  return Math.round(ms / 86400000);
}

export function relativeDay(s: string): string {
  const n = daysUntil(s);
  if (n === 0) return tr("Hari ini");
  if (n === 1) return tr("Besok");
  if (n > 1) return tr("{n} hari lagi", { n });
  if (n === -1) return tr("Kemarin");
  return tr("{p} hari lalu", { p: -n });
}

/** Cells for a month grid starting on Monday. null = padding cell. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(pad).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toISODate(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function weekdaysInMonth(year: number, month: number, weekday: number): string[] {
  const out: string[] = [];
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === weekday) out.push(toISODate(date));
  }
  return out;
}

export function nowISO(): string {
  return new Date().toISOString();
}
