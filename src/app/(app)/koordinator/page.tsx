"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, CalendarClock, Search, ChevronDown, Layers, Copy, Info, MapPin, Download, ImageIcon, MessageCircle, Moon, Music2, UserMinus, Users, UserX, Wand2 } from "lucide-react";
import { toPng } from "html-to-image";
import { useApp, useCoordinatedMinistries } from "@/components/providers";
import { GroupFillModal, GroupsModal } from "@/components/groups";
import { SearchField, matchesName } from "@/components/SearchField";
import { Avatar, Badge, Button, Card, Empty, Field, Modal, SectionTitle, cn, inputCls, toast } from "@/components/ui";
import { ServiceLabel, StatusBadge, serviceLine } from "@/components/duty";
import { LegendDot, MonthCalendar, type DayMark } from "@/components/MonthCalendar";
import { POSTER_H, POSTER_W, Poster } from "@/components/Poster";
import { assignSlot, saveAssignments } from "@/lib/actions";
import { store } from "@/lib/store";
import { formatDateLong, formatMonth, monthKey, todayISO } from "@/lib/dates";
import { availabilityNotes, canFill, isActive, slotsForService, smartFill, type AvailabilityNote } from "@/lib/scheduling";
import { openWhatsApp, scheduleToWhatsAppText } from "@/lib/whatsapp";
import type { Assignment, Service, Slot } from "@/lib/types";
import { ask, celebrate, haptic } from "@/lib/feedback";
import { tr } from "@/lib/i18n";

export default function CoordinatorPage() {
  const { services, assignments, ministries, users } = useApp();
  const mine = useCoordinatedMinistries();
  const [ministryId, setMinistryId] = useState<string>("");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState<string>(todayISO());
  const [assigning, setAssigning] = useState<Slot | null>(null);
  const [fillScope, setFillScope] = useState<"day" | "month" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [groupsOpen, setGroupsOpen] = useState(false);

  // opened from a notification: /koordinator?tanggal=YYYY-MM-DD&komisi=<ministryId>
  const deepLink = useRef<{ date: string | null; ministry: string | null } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const date = q.get("tanggal");
    deepLink.current = { date, ministry: q.get("komisi") };
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSelected(date);
      setCursor({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1 });
      setView("calendar");
    }
  }, []);

  useEffect(() => {
    if (!mine[0]) return;
    // "Semua komisi" only makes sense with 2+ komisi
    if (ministryId === ALL && mine.length > 1) return;
    if (ministryId && ministryId !== ALL && mine.some((m) => m.id === ministryId)) return;
    const wanted = deepLink.current?.ministry;
    setMinistryId(mine.find((m) => m.id === wanted)?.id ?? (mine.length > 1 ? ALL : mine[0].id));
  }, [mine, ministryId]);

  const isAll = ministryId === ALL;
  const ministry = isAll ? undefined : ministries.find((m) => m.id === ministryId);
  // the komisi shown: one, or every komisi this person coordinates
  const idsKey = isAll ? mine.map((m) => m.id).join(",") : ministryId;
  const ids = useMemo(() => (idsKey ? idsKey.split(",") : []), [idsKey]);
  const pickerOptions = useMemo(
    () =>
      mine.length > 1
        ? [{ id: ALL, name: tr("Semua komisi"), color: `conic-gradient(${mine.map((m) => m.color).join(", ")}, ${mine[0].color})` }, ...mine]
        : mine,
    [mine],
  );
  const aMap = useMemo(() => new Map(assignments.map((a) => [a.id, a])), [assignments]);
  const month = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
  const monthServices = useMemo(
    () => services.filter((s) => monthKey(s.date) === month && s.ministries.some((id) => ids.includes(id))),
    [services, month, ids],
  );
  const dayServices = monthServices.filter((s) => s.date === selected);

  /** fill ratio per date for calendar dots */
  const dayStatus = useMemo(() => {
    const out = new Map<string, { filled: number; total: number; subs: number }>();
    for (const s of monthServices) {
      const slots = slotsForService(s, ministries, aMap, ids);
      const cur = out.get(s.date) ?? { filled: 0, total: 0, subs: 0 };
      cur.total += slots.length;
      cur.filled += slots.filter((x) => x.assignment?.userId).length;
      cur.subs += slots.filter((x) => x.assignment?.subRequest).length;
      out.set(s.date, cur);
    }
    return out;
  }, [monthServices, ministries, aMap, ids]);

  const marks = useMemo(() => {
    const m = new Map<string, DayMark>();
    for (const [date, st] of dayStatus) {
      const c = st.subs ? "#d59b3c" : st.filled === st.total ? "#27856f" : st.filled === 0 ? "#dc5b5b" : "#d59b3c";
      m.set(date, { dots: [c] });
    }
    return m;
  }, [dayStatus]);

  const upcomingServices = useMemo(
    () => services.filter((s) => s.date >= todayISO() && s.ministries.some((id) => ids.includes(id))).slice(0, 12),
    [services, ids],
  );

  if (!mine.length) {
    return (
      <Card>
        <Empty icon={<AlertTriangle size={20} />} title={tr("Belum ada komisi yang kamu koordinasi")} body={tr("Minta Superadmin memberi akses koordinator.")} />
      </Card>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-3">{tr("Atur Jadwal")}</h1>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 mb-3">
        <KomisiPicker options={pickerOptions} value={ministryId} onChange={setMinistryId} />
        {ministry && (
          <button
            onClick={() => setGroupsOpen(true)}
            aria-label={tr("Grup {name}, kelola", { name: ministry.name })}
            className="flex items-center gap-2.5 rounded-2xl border border-line bg-card pl-2.5 pr-3.5 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,.04)] transition hover:border-brand active:scale-[.98]"
          >
            <span className="h-9 w-9 shrink-0 rounded-xl grid place-items-center bg-brand-soft text-brand">
              <Users size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[length:calc(12px*var(--fs))] text-ink-soft">{tr("Grup")}</span>
              <span className="block text-[length:calc(15px*var(--fs))] font-semibold text-brand whitespace-nowrap">{ministry.groups?.length ? tr("{n} grup", { n: ministry.groups.length }) : tr("Kelola")}</span>
            </span>
          </button>
        )}
      </div>
      {groupsOpen && ministry && <GroupsModal ministry={ministry} onClose={() => setGroupsOpen(false)} />}

      <div className="grid grid-cols-2 bg-card border border-line rounded-xl p-1 mb-3">
        {[
          ["calendar", tr("Kalender")],
          ["list", tr("Daftar ibadah")],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setView(k as typeof view)} className={cn("rounded-lg py-2 text-sm font-medium", view === k ? "bg-brand text-white" : "text-ink-soft")}>
            {label}
          </button>
        ))}
      </div>

      {view === "calendar" && (
        <MonthCalendar
          year={cursor.y}
          month={cursor.m}
          selected={selected}
          onSelect={setSelected}
          onMonthChange={(y, m) => setCursor({ y, m })}
          marks={marks}
          legend={
            <>
              <LegendDot color="#27856f">{tr("Lengkap")}</LegendDot>
              <LegendDot color="#d59b3c">{tr("Sebagian / ada yang berhalangan")}</LegendDot>
              <LegendDot color="#dc5b5b">{tr("Kosong")}</LegendDot>
            </>
          }
        />
      )}

      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button onClick={() => setFillScope("month")} disabled={!monthServices.length}>
          <Wand2 size={16} /> {tr("Smart Fill bulan ini")}
        </Button>
        <Button variant="whatsapp" onClick={() => setExportOpen(true)} disabled={!monthServices.length}>
          <MessageCircle size={16} /> {tr("Ekspor WhatsApp")}
        </Button>
      </div>

      {view === "calendar" ? (
        <>
      <SectionTitle
        action={
          dayServices.length > 0 && (
            <button className="text-xs text-brand font-medium flex items-center gap-1" onClick={() => setFillScope("day")}>
              <Wand2 size={13} /> {tr("Smart Fill tanggal ini")}
            </button>
          )
        }
      >
        {formatDateLong(selected)}
      </SectionTitle>
      {dayServices.length === 0 ? (
        <Card>
          <Empty icon={<Music2 size={20} />} title={tr("Tidak ada ibadah untuk komisi ini")} body={tr("Pilih tanggal yang memiliki titik di kalender.")} />
        </Card>
      ) : (
        <div className="space-y-3">
          {dayServices.map((s) => (
            <ServiceSection key={s.id} service={s} ministryIds={ids} onPick={setAssigning} defaultOpen={dayServices.length === 1 ? true : undefined} />
          ))}
        </div>
      )}

        </>
      ) : (
        <>
          <SectionTitle>{tr("Ibadah mendatang ·")} {isAll ? tr("Semua komisi") : ministry?.name}</SectionTitle>
          {upcomingServices.length === 0 ? (
            <Card>
              <Empty icon={<Music2 size={20} />} title={tr("Belum ada ibadah mendatang")} body={tr("Superadmin perlu membuat jadwal ibadah terlebih dahulu.")} />
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingServices.map((s) => (
                <ServiceSection key={s.id} service={s} ministryIds={ids} onPick={setAssigning} showDate />
              ))}
            </div>
          )}
        </>
      )}

      {assigning && <AssignModal slot={assigning} onClose={() => setAssigning(null)} />}
      {fillScope && ids.length > 0 && (
        <SmartFillModal
          scope={fillScope}
          targets={fillScope === "day" ? dayServices : monthServices}
          ministryIds={ids}
          label={fillScope === "day" ? formatDateLong(selected) : formatMonth(cursor.y, cursor.m)}
          onClose={() => setFillScope(null)}
        />
      )}
      {exportOpen && ids.length > 0 && (
        <ExportModal
          monthServices={monthServices}
          dayServices={dayServices}
          ministryIds={ids}
          monthLabel={formatMonth(cursor.y, cursor.m)}
          selected={selected}
          onClose={() => setExportOpen(false)}
          users={users}
        />
      )}
    </div>
  );
}

/** KomisiPicker value for "every komisi I coordinate". */
const ALL = "__all";

/**
 * One service as a section that opens and closes (Ibadah RBK, Ibadah PBK, …). Inside: every komisi that serves
 * in it (of the ones shown) with its slots. Opens by itself when something still needs filling.
 */
function ServiceSection({
  service,
  ministryIds,
  onPick,
  showDate,
  defaultOpen,
}: {
  service: Service;
  ministryIds: string[];
  onPick: (s: Slot) => void;
  showDate?: boolean;
  defaultOpen?: boolean;
}) {
  const { ministries, assignments } = useApp();
  const map = useMemo(() => new Map(assignments.map((a) => [a.id, a])), [assignments]);
  const ids = ministryIds.filter((id) => service.ministries.includes(id));
  const slots = slotsForService(service, ministries, map, ids);
  const filled = slots.filter((x) => x.assignment?.userId).length;
  const subs = slots.filter((x) => x.assignment?.subRequest && !x.assignment.userId).length;
  const empty = slots.length - filled;
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? defaultOpen ?? empty > 0;
  const status =
    subs > 0
      ? { cls: "bg-warning-soft text-warning-ink", text: tr("{n} butuh pengganti", { n: subs }) }
      : empty > 0
        ? { cls: "bg-danger-soft text-danger-ink", text: tr("{n} kosong", { n: empty }) }
        : { cls: "bg-success-soft text-success", text: tr("Lengkap") };

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setUserOpen(!open)} aria-expanded={open} className="w-full flex items-start gap-3 p-4 text-left hover:bg-surface/60 transition">
        <div className="flex-1 min-w-0">
          {showDate && <div className="text-[length:calc(12px*var(--fs))] font-medium text-ink-soft">{formatDateLong(service.date)}</div>}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{serviceLine(service)}</span>
            <ServiceLabel label={service.label} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:calc(12px*var(--fs))] text-ink-soft">
            {service.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {service.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              {ids.map((id) => (
                <span key={id} className="h-2 w-2 rounded-full" style={{ background: ministries.find((m) => m.id === id)?.color }} />
              ))}
              {ids.length === 1 ? ministries.find((m) => m.id === ids[0])?.name : tr("{n} komisi", { n: ids.length })}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={cn("rounded-full px-2 py-0.5 text-[length:calc(11px*var(--fs))] font-semibold whitespace-nowrap", status.cls)}>{status.text}</span>
          <span className="flex items-center gap-1 text-[length:calc(11px*var(--fs))] text-ink-soft">
            {filled}/{slots.length}
            <ChevronDown size={16} className={cn("transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
          </span>
        </div>
      </button>
      {/* grid 0fr→1fr animates to the content's real height */}
      <div
        className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="divide-y divide-line border-t border-line">
            {ids.map((id) => (
              <MinistrySlots key={id} service={service} ministryId={id} onPick={onPick} />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** The slots of ONE komisi inside a service section: komisi name, rehearsal, "Isi dengan grup", people. */
function MinistrySlots({ service, ministryId, onPick }: { service: Service; ministryId: string; onPick: (s: Slot) => void }) {
  const { ministries, assignments, users, services } = useApp();
  const [editRehearsal, setEditRehearsal] = useState(false);
  const map = useMemo(() => new Map(assignments.map((a) => [a.id, a])), [assignments]);
  const slots = slotsForService(service, ministries, map, [ministryId]);
  const rehearsal = service.rehearsals?.[ministryId];
  const ministry = ministries.find((m) => m.id === ministryId);
  const groups = ministry?.groups ?? [];
  const [fillGroup, setFillGroup] = useState(false);
  const filled = slots.filter((x) => x.assignment?.userId).length;
  const confirmed = slots.filter((x) => x.assignment?.userId && x.assignment.status === "confirmed").length;

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[length:calc(12px*var(--fs))] font-semibold" style={{ background: `${ministry?.color ?? "#888888"}22`, color: ministry?.color }}>
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ministry?.color }} />
          <span className="truncate">{ministry?.name}</span>
        </span>
        <span className="ml-auto shrink-0 text-[length:calc(11px*var(--fs))] text-ink-soft">
          {filled}/{slots.length} {tr("terisi ·")} {confirmed} {tr("hadir")}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setEditRehearsal(true)} className="text-[length:calc(12px*var(--fs))] text-ink-soft flex items-center gap-1 hover:text-brand min-w-0">
          <Music2 size={12} className="shrink-0" />
          <span className="truncate">{rehearsal ? tr("Latihan {p}{p2}", { p: rehearsal.at.replace("T", " "), p2: rehearsal.place ? ` @ ${rehearsal.place}` : "" }) : tr("Atur jadwal latihan")}</span>
        </button>
        {groups.length > 0 && (
          <button
            onClick={() => setFillGroup(true)}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 min-h-9 rounded-full border border-brand/40 bg-brand-soft text-brand px-3.5 text-[length:calc(14px*var(--fs))] font-semibold active:scale-[.97] transition"
          >
            <Users size={15} /> {tr("Isi dengan grup")}
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {slots.map((slot) => {
          const u = users.find((x) => x.id === slot.assignment?.userId);
          const sub = slot.assignment?.subRequest;
          const decliner = sub && !u ? users.find((x) => x.id === sub.requestedBy) : undefined;
          // already booked elsewhere at this time / OFF, for the person in this slot
          const notes = u
            ? availabilityNotes(u, service, { services, assignments, ministries, ignoreAssignmentId: slot.assignmentId }).filter((n) => n.kind === "conflict" || n.kind === "off")
            : [];
          return (
            <li key={slot.assignmentId}>
              <button onClick={() => onPick(slot)} className="w-full flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface text-left">
                <Avatar name={u?.name ?? "?"} src={u?.photoUrl} size={36} className={!u ? "opacity-25" : ""} />
                <div className="flex-1 min-w-0">
                  <div className="text-[length:calc(11px*var(--fs))] text-ink-soft">
                    {slot.position}
                    {u && slot.assignment?.groupId && groups.find((g) => g.id === slot.assignment!.groupId) && (
                      <span className="ml-1.5 font-semibold" style={{ color: ministry?.color }}>
                        · {groups.find((g) => g.id === slot.assignment!.groupId)!.name}
                      </span>
                    )}
                  </div>
                  <div className={cn("text-sm truncate", u ? "font-medium" : "text-danger italic")}>
                    {u?.name ?? (sub ? tr("Kosong — pilih pengganti") : tr("Kosong — ketuk untuk isi"))}
                  </div>
                  {sub && !u && (
                    <div className="text-[length:calc(11px*var(--fs))] text-warning-ink truncate">
                      {decliner?.name ?? tr("Pelayan")} {tr("berhalangan")}{sub.reason ? `: “${sub.reason}”` : ""}
                    </div>
                  )}
                  {u && slot.assignment?.swapRequest && (
                    <div className="text-[length:calc(11px*var(--fs))] text-warning-ink truncate">
                      {tr("Minta ditukar dengan")} {users.find((x) => x.id === slot.assignment!.swapRequest!.to)?.name ?? tr("pelayan lain")} {tr("· menunggu jawaban")}
                    </div>
                  )}
                  <NoteLines notes={notes} compact />
                </div>
                {u && <StatusBadge status={slot.assignment?.status} />}
                {sub && !u && (
                  <Badge className="bg-warning-soft text-warning-ink">
                    <UserX size={11} /> {tr("Butuh pengganti")}
                  </Badge>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {editRehearsal && <RehearsalModal service={service} ministryId={ministryId} onClose={() => setEditRehearsal(false)} />}
      {fillGroup && ministry && <GroupFillModal service={service} ministry={ministry} onClose={() => setFillGroup(false)} />}
    </div>
  );
}

function RehearsalModal({ service, ministryId, onClose }: { service: Service; ministryId: string; onClose: () => void }) {
  const cur = service.rehearsals?.[ministryId];
  const [at, setAt] = useState(cur?.at ?? `${service.date}T19:00`);
  const [place, setPlace] = useState(cur?.place ?? "");
  return (
    <Modal open onClose={onClose} title={tr("Jadwal latihan")}>
      <Field label={tr("Waktu latihan")}>
        <input type="datetime-local" className={inputCls} value={at} onChange={(e) => setAt(e.target.value)} />
      </Field>
      <Field label={tr("Tempat")}>
        <input className={inputCls} value={place} onChange={(e) => setPlace(e.target.value)} placeholder={tr("Ruang Musik")} />
      </Field>
      <div className="flex gap-2">
        {cur && (
          <Button
            variant="danger"
            onClick={async () => {
              const r = { ...(service.rehearsals ?? {}) };
              delete r[ministryId];
              await store.update("services", service.id, { rehearsals: r });
              onClose();
            }}
          >
            {tr("Hapus")}
          </Button>
        )}
        <Button
          className="flex-1"
          onClick={async () => {
            await store.update("services", service.id, { rehearsals: { ...(service.rehearsals ?? {}), [ministryId]: { at, place } } });
            celebrate(tr("Jadwal latihan disimpan"));
            onClose();
          }}
        >
          {tr("Simpan")}
        </Button>
      </div>
    </Modal>
  );
}

function AssignModal({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const { users, services, assignments, ministries } = useApp();
  const [showAll, setShowAll] = useState(false);
  // search button → text field; while searching, look through everyone in this komisi
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const searching = searchOpen && q.trim() !== "";
  const month = monthKey(slot.service.date);
  const sById = new Map(services.map((s) => [s.id, s]));
  const current = slot.assignment?.userId ?? null;
  const sub = slot.assignment?.subRequest;
  const decliner = sub ? users.find((u) => u.id === sub.requestedBy) : undefined;

  const rows = users
    .filter((u) => (showAll || searching ? isActive(u) && u.ministries.includes(slot.ministry.id) : canFill(u, slot.ministry.id, slot.position)))
    .filter((u) => !searching || matchesName(u.name, q))
    .map((u) => {
      const load = assignments.filter((a) => a.userId === u.id && monthKey(sById.get(a.serviceId)?.date ?? "") === month).length;
      const notes = availabilityNotes(u, slot.service, {
        services,
        assignments,
        ministries,
        ignoreAssignmentId: slot.assignmentId,
        ministryId: slot.ministry.id,
        position: slot.position,
      });
      const blockers = notes.filter((n) => n.kind !== "info");
      return { u, load, notes, blockers, free: blockers.length === 0, skilled: canFill(u, slot.ministry.id, slot.position) };
    })
    .sort((a, b) => Number(b.free) - Number(a.free) || a.blockers.length - b.blockers.length || a.load - b.load);

  const pick = async (userId: string | null) => {
    await assignSlot({
      id: slot.assignmentId,
      service: slot.service,
      ministryId: slot.ministry.id,
      position: slot.position,
      userId,
      previousUserId: current,
      replacing: userId && decliner ? decliner.name : undefined,
    });
    if (userId) haptic("success");
    toast(userId ? tr("Pelayan dijadwalkan & diberi notifikasi") : tr("Slot dikosongkan"));
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`${slot.position} · ${slot.service.title}`}>
      <div className="flex items-start gap-2 mb-3">
        <p className="flex-1 text-[length:calc(13px*var(--fs))] text-ink-soft">{formatDateLong(slot.service.date)} {tr("· diurutkan dari yang tersedia & paling jarang melayani bulan ini.")}</p>
        {!searchOpen && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={tr("Cari anggota {name}", { name: slot.ministry.name })}
            className="h-10 w-10 shrink-0 grid place-items-center rounded-xl border border-line bg-card text-ink hover:border-brand hover:text-brand active:scale-95 transition"
          >
            <Search size={18} />
          </button>
        )}
      </div>
      {searchOpen && (
        <div className="mb-3 animate-[gf-drop_.18s_ease-out]">
          <SearchField
            value={q}
            onChange={setQ}
            autoFocus
            placeholder={tr("Cari di {name}…", { name: slot.ministry.name })}
            onClear={() => {
              setQ("");
              setSearchOpen(false);
            }}
          />
          {searching && <p className="text-[length:calc(12px*var(--fs))] text-ink-soft mt-1.5">{tr("Mencari di semua anggota")} {slot.ministry.name}.</p>}
        </div>
      )}
      {sub && !current && (
        <div className="rounded-xl bg-warning-soft text-warning-ink text-[length:calc(13px*var(--fs))] px-3 py-2 mb-3">
          <b>{decliner?.name ?? tr("Pelayan")}</b> {tr("berhalangan")}{sub.reason ? ` (“${sub.reason}”)` : ""} {tr("dan sudah dikeluarkan dari slot ini. Pilih pengganti yang tersedia. Dia akan diminta konfirmasi.")}
        </div>
      )}
      <ul className="space-y-1 -mx-2">
        {rows.map(({ u, load, notes, blockers, free, skilled }) => (
          <li key={u.id}>
            <button
              onClick={async () => {
                if (
                  blockers.length &&
                  u.id !== current &&
                  !(await ask({
                    title: blockers.some((n) => n.kind === "conflict") ? tr("Jadwal bentrok") : tr("{name} sedang tidak tersedia", { name: u.name }),
                    message: tr("{p}\n\nTetap jadwalkan {name}?", { p: blockers.map((n) => "• " + n.text).join("\n"), name: u.name }),
                    confirmText: tr("Tetap jadwalkan"),
                    tone: "warning",
                  }))
                )
                  return;
                // replacing someone who is already scheduled here
                if (
                  current &&
                  u.id !== current &&
                  !blockers.length &&
                  !(await ask({
                    title: tr("Ganti {p}?", { p: users.find((x) => x.id === current)?.name ?? tr("pelayan") }),
                    message: tr("{name} akan menggantikannya sebagai {position}. Keduanya akan diberi notifikasi.", { name: u.name, position: slot.position }),
                    confirmText: tr("Ganti"),
                  }))
                )
                  return;
                pick(u.id);
              }}
              className={cn("w-full flex items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface", u.id === current && "bg-brand-soft")}
            >
              <Avatar name={u.name} src={u.photoUrl} size={36} className={cn(!free && "opacity-60")} />
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm font-medium truncate", !free && "text-ink-soft")}>{u.name}</div>
                <div className="text-[length:calc(11px*var(--fs))] text-ink-soft">
                  {load}{tr("× bulan ini")}{free && <span className="text-success font-medium"> {tr("· Tersedia")}</span>}
                </div>
                <NoteLines notes={notes} />
              </div>
              {u.id === current && <Badge className="bg-brand text-white">{tr("Saat ini")}</Badge>}
              {!skilled && <Badge>{tr("Bukan posisinya")}</Badge>}
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-ink-soft px-2 py-4">{searching ? tr("Tidak ada anggota {name} bernama “{p}”.", { name: slot.ministry.name, p: q.trim() }) : tr("Belum ada pelayan di komisi ini untuk posisi tersebut.")}</p>
        )}
      </ul>
      <div className="flex gap-2 mt-4">
        <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
          {showAll ? tr("Hanya yang sesuai posisi") : tr("Tampilkan semua anggota komisi")}
        </Button>
        {current && (
          <Button variant="danger" size="sm" className="ml-auto" onClick={async () => {
              if (!(await ask({ title: tr("Kosongkan slot ini?"), message: tr("{p} tidak lagi bertugas sebagai {position} dan akan diberi notifikasi.", { p: users.find((x) => x.id === current)?.name ?? tr("Pelayan"), position: slot.position }), confirmText: tr("Kosongkan"), tone: "danger" }))) return;
              pick(null);
            }}>
            <UserMinus size={14} /> {tr("Kosongkan")}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function SmartFillModal({ scope, targets, ministryIds, label, onClose }: { scope: "day" | "month"; targets: Service[]; ministryIds: string[]; label: string; onClose: () => void }) {
  const { ministries, users, services, assignments } = useApp();
  const [result, setResult] = useState<Assignment[]>(() =>
    smartFill({ targetServices: targets, ministryIds, ministries, users, allServices: services, assignments }),
  );
  const [busy, setBusy] = useState(false);
  const sById = new Map(services.map((s) => [s.id, s]));
  const map = new Map(assignments.map((a) => [a.id, a]));
  const empty = targets.flatMap((s) => slotsForService(s, ministries, map, ministryIds)).filter((x) => !x.assignment?.userId).length;

  return (
    <Modal open onClose={onClose} title={tr("Smart Fill · {label}", { label })}>
      <p className="text-[length:calc(13px*var(--fs))] text-ink-soft mb-3">
        {scope === "month"
          ? tr("Semua slot kosong diisi berdasarkan ketersediaan (status ON), kecocokan posisi, tanpa bentrok, dan pemerataan jumlah tugas bulan ini.")
          : tr("Slot kosong diisi berdasarkan ketersediaan (status ON), kecocokan posisi, tanpa bentrok, dan pemerataan jumlah tugas bulan ini.")}
      </p>
      <div className="rounded-xl bg-surface px-3 py-2 text-sm mb-3">
        <b>{result.length}</b> {tr("dari")} {empty} {tr("slot kosong bisa diisi.")}
        {result.length < empty && <span className="text-warning-ink"> {tr("Sisanya tidak memiliki kandidat yang tersedia.")}</span>}
      </div>
      <ul className="max-h-72 overflow-y-auto divide-y divide-line mb-4">
        {result.map((a) => {
          const u = users.find((x) => x.id === a.userId);
          const s = sById.get(a.serviceId)!;
          return (
            <li key={a.id} className="py-2 flex items-center gap-3 text-sm">
              <Avatar name={u?.name} src={u?.photoUrl} size={30} />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{u?.name}</div>
                <div className="text-[length:calc(11px*var(--fs))] text-ink-soft">
                  {a.position} · {s.date.slice(8)}/{s.date.slice(5, 7)} {s.title}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => setResult(smartFill({ targetServices: targets, ministryIds, ministries, users, allServices: services, assignments }))}
        >
          {tr("Acak ulang")}
        </Button>
        <Button
          className="flex-1"
          disabled={!result.length || busy}
          onClick={async () => {
            if (!(await ask({ title: tr("Terapkan Smart Fill?"), message: tr("{n} slot akan diisi dan setiap pelayan yang dijadwalkan diberi notifikasi.", { n: result.length }), confirmText: tr("Terapkan") }))) return;
            setBusy(true);
            await saveAssignments(result);
            celebrate(tr("{n} slot terisi", { n: result.length }));
            toast(tr("Pelayan sudah diberi notifikasi"));
            onClose();
          }}
        >
          <Wand2 size={16} /> {tr("Terapkan")}
        </Button>
      </div>
    </Modal>
  );
}

function ExportModal({
  monthServices,
  dayServices,
  ministryIds,
  monthLabel,
  selected,
  onClose,
  users,
}: {
  monthServices: Service[];
  dayServices: Service[];
  ministryIds: string[];
  monthLabel: string;
  selected: string;
  onClose: () => void;
  users: ReturnType<typeof useApp>["users"];
}) {
  const { ministries, assignments, church } = useApp();
  const many = ministryIds.length > 1;
  // the poster is per komisi; with "Semua komisi" the coordinator picks which one
  const [posterMinistryId, setPosterMinistryId] = useState(ministryIds[0]);
  const ministry = ministries.find((m) => m.id === posterMinistryId)!;
  const posterServices = monthServices.filter((s) => s.ministries.includes(posterMinistryId));
  const [tab, setTab] = useState<"text" | "poster">("text");
  const [scope, setScope] = useState<"month" | "day">(dayServices.length ? "day" : "month");
  const [posterService, setPosterService] = useState<Service | undefined>(
    dayServices.find((s) => s.ministries.includes(ministryIds[0])) ?? monthServices.find((s) => s.ministries.includes(ministryIds[0])),
  );
  const posterRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const text = scheduleToWhatsAppText({
    services: scope === "day" ? dayServices : monthServices,
    ministryIds,
    ministries,
    assignments,
    users,
    churchName: church?.name ?? "",
    heading: tr("Jadwal {name} — {p}", {
      name: many ? tr("Pelayanan") : (ministries.find((m) => m.id === ministryIds[0])?.name ?? ""),
      p: scope === "day" ? formatDateLong(selected) : monthLabel,
    }),
  });

  const map = new Map(assignments.map((a) => [a.id, a]));
  const posterSlots = posterService ? slotsForService(posterService, ministries, map, [posterMinistryId]) : [];
  const scale = 300 / POSTER_W;

  const makePng = async () => {
    const node = posterRef.current!;
    return toPng(node, { width: POSTER_W, height: POSTER_H, pixelRatio: 1, cacheBust: true });
  };

  return (
    <Modal open onClose={onClose} title={tr("Ekspor ke WhatsApp")} wide>
      <div className="grid grid-cols-2 bg-surface rounded-xl p-1 mb-4">
        <button onClick={() => setTab("text")} className={cn("rounded-lg py-1.5 text-sm font-medium", tab === "text" ? "bg-card shadow-sm" : "text-ink-soft")}>
          {tr("Teks rapi")}
        </button>
        <button onClick={() => setTab("poster")} className={cn("rounded-lg py-1.5 text-sm font-medium", tab === "poster" ? "bg-card shadow-sm" : "text-ink-soft")}>
          {tr("Poster foto")}
        </button>
      </div>

      {tab === "text" ? (
        <>
          <div className="flex gap-2 mb-3">
            {dayServices.length > 0 && (
              <button onClick={() => setScope("day")} className={cn("rounded-full border px-3 py-1 text-xs", scope === "day" ? "border-brand bg-brand-soft text-brand" : "border-line")}>
                {tr("Tanggal terpilih")}
              </button>
            )}
            <button onClick={() => setScope("month")} className={cn("rounded-full border px-3 py-1 text-xs", scope === "month" ? "border-brand bg-brand-soft text-brand" : "border-line")}>
              {tr("Sebulan")}
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-[length:calc(12px*var(--fs))] bg-[#e7ffdb] text-[#1f2b1f] rounded-xl p-3 max-h-80 overflow-y-auto font-sans">{text}</pre>
          <div className="flex gap-2 mt-3">
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                toast(tr("Teks disalin"));
              }}
            >
              <Copy size={15} /> {tr("Salin")}
            </Button>
            <Button variant="whatsapp" className="flex-1" onClick={() => openWhatsApp(text)}>
              <MessageCircle size={16} /> {tr("Buka WhatsApp")}
            </Button>
          </div>
        </>
      ) : (
        <>
          {many && (
            <select
              className={cn(inputCls, "mb-2")}
              aria-label={tr("Pilih komisi")}
              value={posterMinistryId}
              onChange={(e) => {
                const id = e.target.value;
                setPosterMinistryId(id);
                if (!posterService?.ministries.includes(id)) setPosterService(monthServices.find((s) => s.ministries.includes(id)));
              }}
            >
              {ministryIds.map((id) => (
                <option key={id} value={id}>
                  {ministries.find((m) => m.id === id)?.name ?? id}
                </option>
              ))}
            </select>
          )}
          <select
            className={cn(inputCls, "mb-3")}
            value={posterService?.id ?? ""}
            onChange={(e) => setPosterService(posterServices.find((s) => s.id === e.target.value))}
          >
            {posterServices.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDateLong(s.date)} · {s.title}
              </option>
            ))}
          </select>
          {posterService && (
            <div className="mx-auto overflow-hidden rounded-xl shadow" style={{ width: POSTER_W * scale, height: POSTER_H * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <Poster ref={posterRef} service={posterService} ministry={ministry} slots={posterSlots} users={users} churchName={church?.name ?? ""} />
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const url = await makePng();
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `jadwal-${ministry.id}-${posterService?.date}.png`;
                  a.click();
                } catch (e) {
                  toast(tr("Gagal membuat poster: {message}", { message: (e as Error).message }));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Download size={15} /> {tr("Unduh PNG")}
            </Button>
            <Button
              variant="whatsapp"
              className="flex-1"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const url = await makePng();
                  const blob = await (await fetch(url)).blob();
                  const file = new File([blob], `jadwal-${ministry.id}.png`, { type: "image/png" });
                  if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], title: tr("Jadwal {name}", { name: ministry.name }) });
                  } else {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = file.name;
                    a.click();
                    toast(tr("Perangkat tidak mendukung share langsung — poster diunduh, kirim lewat WhatsApp."));
                  }
                } catch (e) {
                  if ((e as Error).name !== "AbortError") toast(tr("Gagal: {message}", { message: (e as Error).message }));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <ImageIcon size={16} /> {tr("Bagikan poster")}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

const NOTE_STYLE: Record<AvailabilityNote["kind"], { cls: string; Icon: typeof Info }> = {
  conflict: { cls: "text-danger-ink", Icon: CalendarClock },
  declined: { cls: "text-warning-ink", Icon: UserX },
  off: { cls: "text-ink-soft", Icon: Moon },
  info: { cls: "text-ink-soft", Icon: Info },
};

/** Small explanation lines under a person: where they're already booked / why they're unavailable. */
function NoteLines({ notes, compact }: { notes: AvailabilityNote[]; compact?: boolean }) {
  if (!notes.length) return null;
  return (
    <ul className="mt-0.5 space-y-0.5">
      {notes.map((n, i) => {
        const { cls, Icon } = NOTE_STYLE[n.kind];
        return (
          <li key={i} className={cn("flex items-start gap-1 text-[length:calc(11px*var(--fs))] leading-snug", cls)}>
            <Icon size={11} className="mt-[2px] shrink-0" aria-hidden />
            <span className={cn(compact && "truncate")}>{n.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Komisi switcher: a card-style button that opens a small list with each komisi's colour. */
function KomisiPicker({ options, value, onChange }: { options: { id: string; name: string; color: string }[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === value);
  const single = options.length < 2;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        disabled={single}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "w-full h-full flex items-center gap-2.5 rounded-2xl border bg-card px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(0,0,0,.04)] transition active:scale-[.98] disabled:active:scale-100",
          open ? "border-brand ring-2 ring-brand/20" : "border-line hover:border-brand",
        )}
      >
        <span className="h-9 w-9 shrink-0 rounded-xl grid place-items-center text-white transition-colors" style={{ background: current?.color ?? "#9aa" }}>
          <Layers size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[length:calc(12px*var(--fs))] text-ink-soft">{tr("Komisi@@label")}</span>
          <span className="block text-[length:calc(15px*var(--fs))] font-semibold leading-snug line-clamp-2">{current?.name ?? tr("Pilih komisi")}</span>
        </span>
        {!single && <ChevronDown size={18} className={cn("shrink-0 text-ink-soft transition-transform duration-200", open && "rotate-180")} />}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={tr("Pilih komisi")}
          className="absolute left-0 top-full z-30 mt-2 w-[min(19rem,calc(100vw-2rem))] max-h-[60vh] overflow-y-auto origin-top-left rounded-2xl border border-line bg-card p-1.5 shadow-xl animate-[gf-drop_.18s_ease-out]"
        >
          {options.map((m) => {
            const selected = m.id === value;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={cn("w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[length:calc(15px*var(--fs))] transition-colors", selected ? "bg-brand-soft font-semibold" : "hover:bg-surface")}
                >
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: m.color }} />
                  <span className="flex-1 min-w-0 truncate">{m.name}</span>
                  {selected && <Check size={18} className="shrink-0 text-brand" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
