"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, cn } from "./ui";
import { formatMonth, monthGrid, todayISO } from "@/lib/dates";

export interface DayMark {
  /** Up to 3 coloured dots under the date */
  dots: string[];
  /** Emphasise the whole cell (e.g. "you serve this day") */
  highlight?: boolean;
}

export function MonthCalendar({
  year,
  month,
  selected,
  onSelect,
  onMonthChange,
  marks,
  legend,
}: {
  year: number;
  month: number;
  selected: string;
  onSelect: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
  marks: Map<string, DayMark>;
  legend?: ReactNode;
}) {
  const today = todayISO();
  const shift = (d: number) => {
    const n = new Date(year, month + d, 1);
    onMonthChange(n.getFullYear(), n.getMonth());
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <button className="p-2 rounded-lg hover:bg-surface" onClick={() => shift(-1)} aria-label="Bulan sebelumnya">
          <ChevronLeft size={18} />
        </button>
        <button
          className="font-semibold capitalize"
          onClick={() => {
            const d = new Date();
            onMonthChange(d.getFullYear(), d.getMonth());
            onSelect(today);
          }}
          title="Kembali ke hari ini"
        >
          {formatMonth(year, month)}
        </button>
        <button className="p-2 rounded-lg hover:bg-surface" onClick={() => shift(1)} aria-label="Bulan berikutnya">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-ink-soft mb-1">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthGrid(year, month).map((date, i) => {
          if (!date) return <div key={i} />;
          const mark = marks.get(date);
          const isSel = date === selected;
          return (
            <button
              key={date}
              onClick={() => onSelect(date)}
              className={cn(
                "aspect-square rounded-xl text-sm flex flex-col items-center justify-center gap-0.5 transition",
                isSel ? "bg-brand text-white" : mark?.highlight ? "bg-brand-soft text-brand font-bold" : mark ? "font-semibold" : "text-ink-soft hover:bg-surface",
                date === today && !isSel && "ring-1 ring-brand",
                date < today && !isSel && "opacity-60",
              )}
            >
              {Number(date.slice(8))}
              <span className="flex gap-0.5 h-1.5">
                {mark?.dots.slice(0, 3).map((c, j) => (
                  <span key={j} className="h-1.5 w-1.5 rounded-full" style={{ background: isSel ? "white" : c }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {legend && <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-ink-soft">{legend}</div>}
    </Card>
  );
}

export function LegendDot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}
