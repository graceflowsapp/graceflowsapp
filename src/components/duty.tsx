"use client";

import { useMemo, useState } from "react";
import { Check, Clock, MapPin, Music2, Repeat2, Sparkles, Users, X } from "lucide-react";
import { useApp } from "./providers";
import { Avatar, Badge, Button, Card, Field, Modal, cn, inputCls, toast } from "./ui";
import { cancelSwap, requestSwap, respondAttendance } from "@/lib/actions";
import { formatDateLong, formatDateTimeLocal, relativeDay, todayISO } from "@/lib/dates";
import { slotsForService, sortServices, swapCandidates } from "@/lib/scheduling";
import type { Assignment, AttendanceStatus, Ministry, Service } from "@/lib/types";
import { ask, celebrate, haptic } from "@/lib/feedback";

export interface Duty {
  assignment: Assignment;
  service: Service;
  ministry: Ministry;
}

/** The signed-in user's duties, sorted by date. */
export function useMyDuties() {
  const { me, assignments, services, ministries } = useApp();
  return useMemo(() => {
    if (!me) return { all: [] as Duty[], upcoming: [] as Duty[], past: [] as Duty[] };
    const sById = new Map(services.map((s) => [s.id, s]));
    const mById = new Map(ministries.map((m) => [m.id, m]));
    const today = todayISO();
    const all: Duty[] = assignments
      .filter((a) => a.userId === me.id && sById.has(a.serviceId) && mById.has(a.ministryId))
      .map((a) => ({ assignment: a, service: sById.get(a.serviceId)!, ministry: mById.get(a.ministryId)! }))
      .sort((a, b) => sortServices(a.service, b.service));
    return {
      all,
      upcoming: all.filter((d) => d.service.date >= today),
      past: all.filter((d) => d.service.date < today).reverse(),
    };
  }, [me, assignments, services, ministries]);
}

export function ServiceLabel({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <Badge className="bg-warning-soft text-warning-ink">
      <Sparkles size={11} /> {label}
    </Badge>
  );
}

/** "Ibadah Umum · Sesi 1 · 09:00" */
export function serviceLine(s: Service) {
  return [s.title, s.session, s.time].filter(Boolean).join(" · ");
}

export function StatusBadge({ status }: { status?: AttendanceStatus }) {
  if (status === "confirmed")
    return (
      <Badge className="bg-success-soft text-success">
        <Check size={11} /> Hadir
      </Badge>
    );
  if (status === "declined")
    return (
      <Badge className="bg-danger-soft text-danger-ink">
        <X size={11} /> Berhalangan
      </Badge>
    );
  return <Badge className="bg-surface text-ink-soft">Belum konfirmasi</Badge>;
}

export function DutyCard({ duty, highlight }: { duty: Duty; highlight?: boolean }) {
  const { service, ministry, assignment } = duty;
  const { me, users } = useApp();
  const [showTeam, setShowTeam] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [busy, setBusy] = useState(false);
  const rehearsal = service.rehearsals?.[ministry.id];
  const status = assignment.status ?? "pending";
  const isPast = service.date < todayISO();
  const swapTo = assignment.swapRequest ? users.find((u) => u.id === assignment.swapRequest!.to) ?? { name: "pengganti" } : null;

  const confirm = async () => {
    if (!me) return;
    setBusy(true);
    try {
      await respondAttendance({ a: assignment, me, service, status: "confirmed", users });
      celebrate("Siap melayani! 🙌");
      toast("Koordinator sudah diberi tahu");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cn("overflow-hidden", highlight && "border-brand/30")}>
      {highlight && (
        <div className="bg-brand text-white px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider opacity-80">Tugas berikutnya · {relativeDay(service.date)}</div>
          <div className="text-lg font-bold">{formatDateLong(service.date)}</div>
        </div>
      )}
      <div className="p-4">
        {!highlight && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold">{formatDateLong(service.date)}</span>
            <span className="text-[11px] text-ink-soft">{relativeDay(service.date)}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-ink-soft">{serviceLine(service)}</span>
          <ServiceLabel label={service.label} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge color={ministry.color}>{ministry.name}</Badge>
          <span className="font-semibold flex-1">{assignment.position}</span>
          {!highlight && <StatusBadge status={status} />}
        </div>

        <div className="mt-3 grid gap-1.5 text-[13px] text-ink-soft">
          {service.location && (
            <div className="flex items-center gap-2">
              <MapPin size={14} /> {service.location}
            </div>
          )}
          {service.briefingTime && (
            <div className="flex items-center gap-2">
              <Clock size={14} /> Doa / briefing <b className="text-ink">{service.briefingTime}</b>
            </div>
          )}
          {rehearsal && (
            <div className="flex items-center gap-2">
              <Music2 size={14} /> Latihan <b className="text-ink">{formatDateTimeLocal(rehearsal.at)}</b>
              {rehearsal.place && <span>@ {rehearsal.place}</span>}
            </div>
          )}
        </div>

        {/* Attendance */}
        {!isPast && swapTo && (
          <div className="mt-4 rounded-xl bg-warning-soft text-warning-ink text-[13px] px-3 py-2 flex items-center gap-2">
            <Repeat2 size={15} className="shrink-0" />
            <span className="flex-1">
              Menunggu <b>{swapTo.name}</b> menerima permintaan tukar. Kamu masih terjadwal sampai dia menerima.
            </span>
            <button
              className="text-[12px] underline shrink-0"
              disabled={busy}
              onClick={async () => {
                if (!(await ask({ title: "Batalkan permintaan tukar?", message: `${swapTo.name} tidak jadi diminta menggantikan.`, confirmText: "Batalkan permintaan" }))) return;
                setBusy(true);
                try {
                  await cancelSwap(assignment);
                  toast("Permintaan tukar dibatalkan");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Batalkan
            </button>
          </div>
        )}
        {!isPast && !swapTo && (
          <div className="mt-4">
            {status === "pending" && (
              <>
                <p className="text-[13px] font-medium mb-2">Bisa hadir?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="success" disabled={busy} onClick={confirm}>
                    <Check size={16} /> Hadir
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setShowDecline(true)}>
                    <X size={16} /> Berhalangan
                  </Button>
                </div>
              </>
            )}
            {status === "confirmed" && (
              <div className="flex items-center gap-2 rounded-xl bg-success-soft text-success text-[13px] px-3 py-2">
                <Check size={15} /> <span className="flex-1">Kamu sudah konfirmasi hadir</span>
                <button className="text-[12px] underline" onClick={() => setShowDecline(true)}>
                  Berhalangan?
                </button>
              </div>
            )}
            {status === "declined" && (
              <div className="flex items-center gap-2 rounded-xl bg-warning-soft text-warning-ink text-[13px] px-3 py-2">
                <span className="flex-1">
                  Berhalangan — menunggu pengganti{assignment.subRequest?.reason && <i> · {assignment.subRequest.reason}</i>}
                </span>
                <button className="text-[12px] underline shrink-0" disabled={busy} onClick={confirm}>
                  Ternyata bisa
                </button>
              </div>
            )}
          </div>
        )}

        <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setShowTeam(true)}>
          <Users size={15} /> Lihat tim
        </Button>
      </div>
      <TeamModal open={showTeam} onClose={() => setShowTeam(false)} service={service} focusMinistry={ministry.id} />
      <DeclineModal open={showDecline} onClose={() => setShowDecline(false)} duty={duty} />
    </Card>
  );
}

export function TeamModal({ open, onClose, service, focusMinistry }: { open: boolean; onClose: () => void; service: Service; focusMinistry?: string }) {
  const { ministries, assignments, users, me } = useApp();
  const slots = useMemo(() => {
    const map = new Map(assignments.map((a) => [a.id, a]));
    const all = slotsForService(service, ministries, map);
    return [...all.filter((s) => s.ministry.id === focusMinistry), ...all.filter((s) => s.ministry.id !== focusMinistry)];
  }, [service, ministries, assignments, focusMinistry]);
  const groups = slots.reduce<Record<string, typeof slots>>((acc, s) => ((acc[s.ministry.id] ??= []).push(s), acc), {});

  return (
    <Modal open={open} onClose={onClose} title={`${service.title} · ${formatDateLong(service.date)}`}>
      {(service.session || service.location) && (
        <p className="text-[13px] text-ink-soft -mt-1 mb-4 flex items-center gap-1.5">
          <MapPin size={13} /> {[service.session, service.time, service.location].filter(Boolean).join(" · ")}
        </p>
      )}
      {Object.values(groups).map((g) => (
        <div key={g[0].ministry.id} className="mb-5 last:mb-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: g[0].ministry.color }} />
            <span className="text-sm font-semibold">{g[0].ministry.name}</span>
            {g[0].ministry.id === focusMinistry && <Badge>Tim kamu</Badge>}
          </div>
          <ul className="space-y-2">
            {g.map((s) => {
              const u = users.find((x) => x.id === s.assignment?.userId);
              return (
                <li key={s.assignmentId} className="flex items-center gap-3">
                  <Avatar name={u?.name ?? "—"} src={u?.photoUrl} size={34} className={!u ? "opacity-30" : ""} />
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm truncate", !u && "text-ink-soft italic")}>
                      {u ? u.name : "Belum terisi"} {u?.id === me?.id && <span className="text-brand">(kamu)</span>}
                    </div>
                    <div className="text-[11px] text-ink-soft">{s.position}</div>
                  </div>
                  {u && s.assignment?.status === "confirmed" && <Check size={15} className="text-success" aria-label="Hadir" />}
                  {u?.phone && u.id !== me?.id && (
                    <a className="text-[11px] text-success font-medium" href={`https://wa.me/${u.phone.replace(/\D/g, "").replace(/^0/, "62")}`} target="_blank" rel="noreferrer">
                      Chat
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Modal>
  );
}

/**
 * "Berhalangan": the servant finds their own replacement — they pick an available teammate, who gets a swap
 * request to accept. Only if nobody can, they hand it to the coordinator (taken off the slot).
 */
function DeclineModal({ open, onClose, duty }: { open: boolean; onClose: () => void; duty: Duty }) {
  const { me, users, services, assignments } = useApp();
  const [reason, setReason] = useState("");
  const [pickId, setPickId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const presets = ["Sakit", "Ujian / tugas kampus", "Di luar kota", "Acara keluarga", "Pekerjaan"];
  const candidates = useMemo(
    () => (open ? swapCandidates(duty.assignment, duty.service, users, services, assignments) : []),
    [open, duty, users, services, assignments],
  );
  const picked = candidates.find((c) => c.u.id === pickId)?.u;

  const sendSwap = async () => {
    if (!me || !picked) return;
    setBusy(true);
    try {
      await requestSwap({ a: duty.assignment, me, to: picked, service: duty.service, reason: reason.trim() });
      haptic("success");
      toast(`Permintaan tukar dikirim ke ${picked.name}`);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handToCoordinator = async () => {
    if (!me) return;
    if (!(await ask({ title: "Serahkan ke koordinator?", message: "Kamu akan dikeluarkan dari tugas ini dan koordinator akan mencari pengganti.", confirmText: "Serahkan", tone: "warning" }))) return;
    setBusy(true);
    try {
      await respondAttendance({ a: duty.assignment, me, service: duty.service, status: "declined", reason: reason.trim(), users });
      haptic("warning");
      toast("Koordinator sudah diberi tahu 🙏");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Berhalangan hadir">
      <p className="text-sm text-ink-soft mb-4">
        {duty.assignment.position} · {formatDateLong(duty.service.date)}. Pilih pengganti yang tersedia. Kamu tetap terjadwal sampai dia menerima.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {presets.map((p) => (
          <button key={p} onClick={() => setReason(p)} className={cn("rounded-full border px-3 py-1.5 text-xs", reason === p ? "border-brand bg-brand-soft text-brand" : "border-line")}>
            {p}
          </button>
        ))}
      </div>
      <Field label="Alasan (opsional)">
        <textarea className={inputCls} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ceritakan singkat…" />
      </Field>

      <p className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
        <Repeat2 size={14} /> Tukar dengan yang tersedia
      </p>
      {candidates.length ? (
        <ul className="space-y-1 -mx-1 mb-4 max-h-60 overflow-y-auto" role="radiogroup" aria-label="Pilih pengganti">
          {candidates.map(({ u, load }) => (
            <li key={u.id}>
              <button
                role="radio"
                aria-checked={pickId === u.id}
                onClick={() => {
                  haptic("select");
                  setPickId(u.id);
                }}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-2 py-2 text-left border",
                  pickId === u.id ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface",
                )}
              >
                <Avatar name={u.name} src={u.photoUrl} size={34} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.name}</div>
                  <div className="text-[11px] text-ink-soft">
                    <span className="text-success font-medium">Tersedia</span> · {load}× bulan ini
                  </div>
                </div>
                <span className={cn("h-5 w-5 rounded-full border-2 grid place-items-center shrink-0", pickId === u.id ? "border-brand" : "border-line")}>
                  {pickId === u.id && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-soft rounded-xl bg-surface px-3 py-2 mb-4">Tidak ada pelayan lain yang tersedia untuk posisi ini di jadwal tersebut.</p>
      )}

      {candidates.length > 0 && (
        <Button className="w-full" disabled={busy || !picked} onClick={sendSwap}>
          <Repeat2 size={16} /> {picked ? `Minta ${picked.name.split(" ")[0]} menggantikan` : "Pilih pengganti dulu"}
        </Button>
      )}
      <button
        className={cn(
          "w-full text-center",
          candidates.length ? "mt-3 text-[12px] text-ink-soft underline" : "rounded-xl bg-warning text-white py-2.5 text-sm font-semibold",
        )}
        disabled={busy}
        onClick={handToCoordinator}
      >
        {candidates.length ? "Tidak ada yang bisa? Serahkan ke koordinator" : "Serahkan ke koordinator"}
      </button>
    </Modal>
  );
}
