"use client";

import { useMemo, useState } from "react";
import { CalendarOff, Moon } from "lucide-react";
import { useApp } from "@/components/providers";
import { Badge, Card, Empty, Field, Toggle, cn, inputCls, toast } from "@/components/ui";
import { ServiceLabel } from "@/components/duty";
import { respondAttendance, updateProfile } from "@/lib/actions";
import { formatDateLong, formatDateShort, toISODate, todayISO } from "@/lib/dates";
import { isAvailableNow, isAvailableOn, isPositionOn, positionKey, rolesFor } from "@/lib/scheduling";
import type { Service } from "@/lib/types";
import { ask } from "@/lib/feedback";

const SEASONS = ["Ujian Kampus", "Cuti", "Di Luar Kota", "Sakit / Pemulihan", "Fokus Keluarga", "Istirahat Pelayanan"];
const WEEKS_AHEAD = 8;

export default function AvailabilityPage() {
  const { me, services, ministries, assignments, users } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = todayISO();

  const upcoming = useMemo(() => {
    if (!me) return [];
    const until = new Date();
    until.setDate(until.getDate() + WEEKS_AHEAD * 7);
    const limit = toISODate(until);
    return services.filter((s) => s.date >= today && s.date <= limit && s.ministries.some((m) => me.ministries.includes(m)));
  }, [me, services, today]);

  if (!me) return null;

  if (me.ministries.length === 0) {
    return (
      <Card>
        <Empty icon={<CalendarOff size={20} />} title="Kamu belum terdaftar di bidang pelayanan" body="Minta Superadmin menambahkanmu ke bidang pelayanan terlebih dahulu." />
      </Card>
    );
  }

  const offServices = me.unavailableServices ?? [];
  const disabled = me.disabledPositions ?? [];
  const generalOn = isAvailableNow(me);
  const roles = rolesFor(me, ministries);

  const myDutiesIn = (s: Service) => assignments.filter((a) => a.serviceId === s.id && a.userId === me.id);

  const toggleService = async (s: Service, on: boolean) => {
    const duties = myDutiesIn(s);
    if (!on && duties.length) {
      const ok = await ask({
        title: "Kamu sudah dijadwalkan",
        message: `Kamu bertugas sebagai ${duties.map((d) => d.position).join(", ")} di ibadah ini. Mematikan berarti kamu berhalangan, dan koordinator akan diberi tahu.`,
        confirmText: "Ya, berhalangan",
        cancelText: "Tetap ON",
        tone: "warning",
      });
      if (!ok) return;
    }
    setBusyId(s.id);
    try {
      await updateProfile(me.id, { unavailableServices: on ? offServices.filter((x) => x !== s.id) : [...new Set([...offServices, s.id])] });
      if (!on) {
        for (const a of duties.filter((d) => d.status !== "declined")) {
          await respondAttendance({ a, me, service: s, status: "declined", reason: "OFF di halaman ketersediaan", users });
        }
      }
      toast(on ? "ON — bisa melayani" : duties.length ? "OFF — koordinator sudah diberi tahu" : "OFF — kamu tidak akan dijadwalkan");
    } finally {
      setBusyId(null);
    }
  };

  const toggleRole = async (key: string, on: boolean) => {
    await updateProfile(me.id, { disabledPositions: on ? disabled.filter((x) => x !== key) : [...new Set([...disabled, key])] });
  };

  const setGeneral = async (on: boolean) => {
    if (on) await updateProfile(me.id, { available: true, unavailableReason: "", unavailableUntil: "" });
    else await updateProfile(me.id, { available: false, unavailableReason: me.unavailableReason || SEASONS[0] });
  };

  return (
    <div>
      <h1 className="text-xl font-bold">Availability (Ketersediaan)</h1>
      <p className="text-sm text-ink-soft mt-0.5 mb-5">Toggle ON / OFF jadwal ibadah dan peran pelayanan yang bisa kamu layani.</p>

      {/* General / season status */}
      <Card className={cn("p-4", !generalOn && "border-warning/40 bg-warning-soft/40")}>
        <Row
          title="Status umum"
          subtitle={generalOn ? "Siap dijadwalkan di semua ibadah" : `Sedang rehat · ${me.unavailableReason || "tidak tersedia"}${me.unavailableUntil ? ` s/d ${formatDateShort(me.unavailableUntil)}` : ""}`}
          on={generalOn}
          onLabel="ON (Siap)"
          offLabel="OFF (Rehat)"
          onChange={setGeneral}
          icon={!generalOn ? <Moon size={16} className="text-warning-ink" /> : undefined}
        />
        {!generalOn && (
          <div className="mt-4 pt-4 border-t border-line">
            <p className="text-xs font-medium text-ink-soft mb-2">Musim hidup</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  onClick={() => updateProfile(me.id, { unavailableReason: s })}
                  className={cn("rounded-full border px-3 py-1.5 text-xs", me.unavailableReason === s ? "border-brand bg-brand-soft text-brand" : "border-line bg-card")}
                >
                  {s}
                </button>
              ))}
            </div>
            <Field label="Aktif kembali otomatis setelah" hint="Kosongkan jika belum tahu.">
              <input type="date" className={inputCls} value={me.unavailableUntil ?? ""} onChange={(e) => updateProfile(me.id, { unavailableUntil: e.target.value })} />
            </Field>
          </div>
        )}
      </Card>

      {/* Per service */}
      <h2 className="font-semibold mt-7">Ketersediaan Jadwal Ibadah</h2>
      <p className="text-[13px] text-ink-soft mb-3">Matikan (OFF) jika kamu berhalangan hadir pada ibadah tertentu.</p>
      {upcoming.length === 0 ? (
        <Card>
          <Empty icon={<CalendarOff size={20} />} title="Belum ada ibadah mendatang" />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {upcoming.map((s) => {
            const seasonOff = !isAvailableOn(me, s.date);
            const duties = myDutiesIn(s);
            return (
              <div key={s.id} className="px-4 py-3.5">
                <Row
                  title={
                    <span className="flex flex-wrap items-center gap-1.5">
                      {[s.title, s.session].filter(Boolean).join(" · ")} <ServiceLabel label={s.label} />
                    </span>
                  }
                  subtitle={`${formatDateLong(s.date)} • Pkl ${s.time}${s.location ? ` • ${s.location}` : ""}`}
                  on={!seasonOff && !offServices.includes(s.id)}
                  onLabel="ON (Bisa Melayani)"
                  offLabel={seasonOff ? "OFF (Status umum)" : "OFF (Berhalangan)"}
                  disabled={seasonOff || busyId === s.id}
                  onChange={(v) => toggleService(s, v)}
                />
                {duties.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {duties.map((d) => (
                      <Badge key={d.id} className="bg-brand-soft text-brand">
                        Bertugas: {d.position}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Per role */}
      <h2 className="font-semibold mt-7">Ketersediaan Peran (Role)</h2>
      <p className="text-[13px] text-ink-soft mb-3">Toggle ON / OFF peran pelayanan yang siap kamu jalankan.</p>
      <div className="space-y-3">
        {roles.map(({ ministry, positions }) => (
          <Card key={ministry.id} className="overflow-hidden">
            <div className="px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b border-line bg-surface/60">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ministry.color }} />
              {ministry.name}
            </div>
            <div className="divide-y divide-line">
              {positions.map((p) => {
                const key = positionKey(ministry.id, p);
                return (
                  <div key={key} className="px-4 py-3.5">
                    <Row
                      title={p}
                      subtitle="Ketersediaan melayani untuk peran ini"
                      on={isPositionOn(me, ministry.id, p)}
                      onLabel="ON (Siap)"
                      offLabel="OFF (Tidak siap)"
                      onChange={(v) => toggleRole(key, v)}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
      <p className="text-[12px] text-ink-soft mt-3">Tugas yang sudah dijadwalkan tetap berlaku. Jika berhalangan, gunakan tombol “Berhalangan” di tugas tersebut.</p>
    </div>
  );
}

function Row({
  title,
  subtitle,
  on,
  onLabel,
  offLabel,
  onChange,
  disabled,
  icon,
}: {
  title: React.ReactNode;
  subtitle: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[12px] text-ink-soft">{subtitle}</div>
        <div className={cn("text-[11px] font-semibold mt-1", on ? "text-success" : "text-danger-ink")}>{on ? onLabel : offLabel}</div>
      </div>
      <div className={cn(disabled && "opacity-50 pointer-events-none")}>
        <Toggle checked={on} onChange={onChange} label={typeof title === "string" ? title : "Ketersediaan"} />
      </div>
    </div>
  );
}
