"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarCheck, CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { useApp } from "@/components/providers";
import { Badge, Card, Empty, SectionTitle, cn } from "@/components/ui";
import { DutyCard, ServiceLabel, StatusBadge, TeamModal, serviceLine, useMyDuties, type Duty } from "@/components/duty";
import { LegendDot, MonthCalendar, type DayMark } from "@/components/MonthCalendar";
import { formatDateLong, formatDateShort, formatMonth, monthKey, todayISO } from "@/lib/dates";
import type { Service } from "@/lib/types";

/**
 * Order of importance: nearest duty → this month → calendar → history.
 */
export default function SchedulePage() {
  const { upcoming, past, all } = useMyDuties();
  const now = new Date();
  const thisMonth = monthKey(todayISO());
  const next = upcoming[0];
  const monthDuties = all.filter((d) => monthKey(d.service.date) === thisMonth && d.assignment.id !== next?.assignment.id);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Jadwal</h1>

      <CollapsibleSection title="Tugas terdekat" hasContent={!!next}>
        {next ? (
          <DutyCard duty={next} highlight />
        ) : (
          <Card>
            <Empty icon={<CalendarCheck size={20} />} title="Belum ada tugas mendatang" body="Waktunya istirahat dan menikmati ibadah 💛" />
          </Card>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={
          <>
            Bulan ini · <span className="capitalize">{formatMonth(now.getFullYear(), now.getMonth())}</span> ({monthDuties.length})
          </>
        }
        hasContent={monthDuties.length > 0}
      >
        {monthDuties.length === 0 ? (
          <p className="text-sm text-ink-soft">Tidak ada tugas lain bulan ini.</p>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {monthDuties.map((d) => (
              <ExpandableDuty key={d.assignment.id} duty={d} />
            ))}
          </Card>
        )}
      </CollapsibleSection>

      <SectionTitle>Kalender</SectionTitle>
      <CalendarSection />

      {past.length > 0 && (
        <>
          <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between mt-6 mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Riwayat pelayanan ({past.length})</h2>
            <ChevronDown size={16} className={cn("text-ink-soft transition", showHistory && "rotate-180")} />
          </button>
          {showHistory && (
            <Card className="divide-y divide-line">
              {past.slice(0, 30).map((d) => (
                <div key={d.assignment.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{d.assignment.position}</div>
                    <div className="text-[12px] text-ink-soft">
                      {formatDateShort(d.service.date)} · {d.service.title}
                    </div>
                  </div>
                  <Badge color={d.ministry.color}>{d.ministry.name}</Badge>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Section with a tappable header. Starts open when there is something to show and closed when empty;
 * once the person taps it, their choice wins (also when the duties finish loading later).
 */
function CollapsibleSection({ title, hasContent, children }: { title: ReactNode; hasContent: boolean; children: ReactNode }) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? hasContent;
  return (
    <section>
      <button onClick={() => setUserOpen(!open)} className="w-full flex items-center justify-between gap-2 mt-6 mb-2 text-left" aria-expanded={open}>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{title}</h2>
        <ChevronDown size={16} className={cn("text-ink-soft transition shrink-0", open && "rotate-180")} />
      </button>
      {open && children}
    </section>
  );
}

/** Compact row; tap to open the full card (confirm, team, rehearsal). */
function ExpandableDuty({ duty: d }: { duty: Duty }) {
  const [open, setOpen] = useState(false);
  const isPast = d.service.date < todayISO();
  return (
    <div className={cn(isPast && "opacity-60")}>
      <button onClick={() => setOpen(!open)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface" aria-expanded={open}>
        <div className="text-center w-10 shrink-0">
          <div className="text-[10px] uppercase text-ink-soft">{formatDateShort(d.service.date).split(",")[0]}</div>
          <div className="text-lg font-bold leading-none">{Number(d.service.date.slice(8))}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {d.assignment.position} <span className="text-ink-soft font-normal">· {d.ministry.name}</span>
          </div>
          <div className="text-[12px] text-ink-soft truncate">{serviceLine(d.service)}</div>
        </div>
        {isPast ? <span className="text-[11px] text-ink-soft">Selesai</span> : <StatusBadge status={d.assignment.status} />}
        <ChevronDown size={16} className={cn("text-ink-soft transition shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3 bg-surface/60">
          <DutyCard duty={d} />
        </div>
      )}
    </div>
  );
}

function CalendarSection() {
  const { services } = useApp();
  const { all } = useMyDuties();
  const today = todayISO();
  const [selected, setSelected] = useState(today);
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [teamOf, setTeamOf] = useState<Service | null>(null);
  const month = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;

  const marks = useMemo(() => {
    const m = new Map<string, DayMark>();
    for (const s of services) if (monthKey(s.date) === month) m.set(s.date, { dots: ["#c3d3d0"] });
    const mine = new Map<string, string[]>();
    for (const d of all) {
      if (monthKey(d.service.date) !== month) continue;
      mine.set(d.service.date, [...(mine.get(d.service.date) ?? []), d.ministry.color]);
    }
    for (const [date, colors] of mine) m.set(date, { dots: colors, highlight: true });
    return m;
  }, [services, all, month]);

  const dayDuties = all.filter((d) => d.service.date === selected);
  const myServiceIds = new Set(dayDuties.map((d) => d.service.id));
  const otherServices = services.filter((s) => s.date === selected && !myServiceIds.has(s.id));

  return (
    <>
      <MonthCalendar
        year={cursor.y}
        month={cursor.m}
        selected={selected}
        onSelect={setSelected}
        onMonthChange={(y, m) => setCursor({ y, m })}
        marks={marks}
        legend={
          <>
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-brand-soft ring-1 ring-brand/30" /> Kamu bertugas
            </span>
            <LegendDot color="#c3d3d0">Ada ibadah</LegendDot>
          </>
        }
      />

      <p className="text-sm font-semibold mt-4 mb-2">{formatDateLong(selected)}</p>
      {dayDuties.length === 0 && otherServices.length === 0 && (
        <Card>
          <Empty icon={<CalendarDays size={20} />} title="Tidak ada ibadah di hari ini" />
        </Card>
      )}
      <div className="space-y-3">
        {dayDuties.map((d) => (
          <DutyCard key={d.assignment.id} duty={d} />
        ))}
      </div>
      {otherServices.length > 0 && (
        <Card className="divide-y divide-line mt-3">
          {otherServices.map((s) => (
            <button key={s.id} onClick={() => setTeamOf(s)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex flex-wrap items-center gap-1.5">
                  {serviceLine(s)} <ServiceLabel label={s.label} />
                </div>
                <div className="text-[12px] text-ink-soft">Kamu tidak bertugas · lihat siapa yang melayani</div>
              </div>
              <ChevronRight size={16} className="text-ink-soft" />
            </button>
          ))}
        </Card>
      )}
      {teamOf && <TeamModal open onClose={() => setTeamOf(null)} service={teamOf} />}
    </>
  );
}
