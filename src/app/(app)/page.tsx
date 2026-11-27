"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarCheck, HandHeart, Moon, Repeat2 } from "lucide-react";
import { useApp } from "@/components/providers";
import { Avatar, Badge, Button, Card, Empty, SectionTitle, toast } from "@/components/ui";
import { DutyCard, useMyDuties } from "@/components/duty";
import { acceptSwap, rejectSwap, takeSubstitute } from "@/lib/actions";
import { formatDateLong, formatDateShort, todayISO } from "@/lib/dates";
import { canFill, findConflicts, isAvailableNow, statsFor } from "@/lib/scheduling";
import { ask, celebrate, haptic } from "@/lib/feedback";
import { tr } from "@/lib/i18n";

const VERSES = [
  ["Marilah kepada-Ku, semua yang letih lesu dan berbeban berat, Aku akan memberi kelegaan kepadamu.", "Matius 11:28"],
  ["Apa pun juga yang kamu perbuat, perbuatlah dengan segenap hatimu seperti untuk Tuhan.", "Kolose 3:23"],
  ["Janganlah kita jemu-jemu berbuat baik, karena apabila sudah datang waktunya, kita akan menuai.", "Galatia 6:9"],
  ["Layanilah seorang akan yang lain, sesuai dengan karunia yang telah diperoleh tiap-tiap orang.", "1 Petrus 4:10"],
  ["Tenanglah, dan ketahuilah, bahwa Akulah Allah!", "Mazmur 46:11"],
];

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? tr("Selamat pagi") : h < 15 ? tr("Selamat siang") : h < 19 ? tr("Selamat sore") : tr("Selamat malam");
}

export default function HomePage() {
  const { me, users, services, assignments, ministries } = useApp();
  const { upcoming } = useMyDuties();

  const openRequests = useMemo(() => {
    if (!me) return [];
    const today = todayISO();
    const sById = new Map(services.map((s) => [s.id, s]));
    return assignments
      .filter((a) => a.subRequest && a.userId !== me.id && a.subRequest.requestedBy !== me.id && canFill(me, a.ministryId, a.position))
      .map((a) => ({ a, s: sById.get(a.serviceId)! }))
      .filter(({ s }) => s && s.date >= today)
      .filter(({ a, s }) => findConflicts(me.id, s, services, assignments, a.id).length === 0)
      .sort((x, y) => x.s.date.localeCompare(y.s.date));
  }, [me, services, assignments]);

  // someone asked ME to take over their slot
  const swapRequests = (() => {
    if (!me) return [];
    const today = todayISO();
    const sById = new Map(services.map((s) => [s.id, s]));
    return assignments
      .filter((a) => a.swapRequest?.to === me.id)
      .map((a) => ({ a, s: sById.get(a.serviceId)! }))
      .filter(({ s }) => s && s.date >= today)
      .sort((x, y) => x.s.date.localeCompare(y.s.date));
  })();

  if (!me) return null;
  const stats = statsFor(me.id, services, assignments);
  const available = isAvailableNow(me);
  const pendingLater = upcoming.slice(1).filter((d) => (d.assignment.status ?? "pending") === "pending").length;
  const verse = VERSES[new Date().getDate() % VERSES.length];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Avatar name={me.name} src={me.photoUrl} size={48} />
        <div>
          <p className="text-sm text-ink-soft">{greeting()},</p>
          <h1 className="text-xl font-bold leading-tight">{me.name.split(" ").slice(0, 2).join(" ")} 👋</h1>
        </div>
      </div>

      {!available && (
        <Link href="/profil">
          <Card className="p-3 mb-4 flex items-center gap-3 bg-ink text-card border-ink">
            <Moon size={18} />
            <div className="text-sm flex-1">
              {tr("Status kamu")} <b>{tr("OFF")}</b> — {me.unavailableReason || tr("tidak tersedia")}
              {me.unavailableUntil && ` sampai ${formatDateShort(me.unavailableUntil)}`}{tr(". Kamu tidak akan dijadwalkan otomatis.")}
            </div>
          </Card>
        </Link>
      )}

      {swapRequests.length > 0 && (
        <>
          <SectionTitle>{tr("Permintaan tukar jadwal")}</SectionTitle>
          <div className="space-y-2 mb-2">
            {swapRequests.map(({ a, s }) => {
              const from = users.find((u) => u.id === a.swapRequest!.from);
              const m = ministries.find((x) => x.id === a.ministryId);
              const clash = findConflicts(me.id, s, services, assignments, a.id);
              return (
                <Card key={a.id} className="p-3 border-brand/40 animate-[gf-up_0.25s_ease-out]">
                  <div className="flex items-start gap-3">
                    <Avatar name={from?.name} src={from?.photoUrl} size={38} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <b>{from?.name ?? tr("Seseorang")}</b> {tr("minta kamu menggantikan")}
                      </div>
                      <div className="text-[length:calc(12px*var(--fs))] text-ink-soft">
                        {a.position} · {m?.name} · {formatDateShort(s.date)} {s.time}
                      </div>
                      {a.swapRequest?.reason && <div className="text-[length:calc(12px*var(--fs))] text-ink-soft italic">“{a.swapRequest.reason}”</div>}
                      {clash.length > 0 && <div className="text-[length:calc(12px*var(--fs))] text-danger-ink mt-0.5">{tr("Kamu sudah bertugas di waktu yang sama.")}</div>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        if (!(await ask({ title: tr("Tolak permintaan tukar?"), message: tr("{p} akan diminta mencari pengganti lain.", { p: from?.name ?? tr("Dia") }), confirmText: tr("Tolak"), tone: "danger" }))) return;
                        await rejectSwap(a, me, s);
                        haptic("warning");
                        toast(tr("Permintaan ditolak"));
                      }}
                    >
                      {tr("Tolak")}
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={async () => {
                        if (
                          !(await ask({
                            title: tr("Gantikan sebagai {position}?", { position: a.position }),
                            message: `${formatDateLong(s.date)} · ${s.title} ${s.time}${clash.length ? tr("\nKamu sudah bertugas di waktu yang sama.") : ""}`,
                            confirmText: tr("Terima"),
                            tone: clash.length ? "warning" : "primary",
                          }))
                        )
                          return;
                        await acceptSwap(a, me, s, users);
                        celebrate(tr("Terima kasih sudah menolong! 🙌"));
                      }}
                    >
                      <Repeat2 size={14} /> {tr("Terima")}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle>{tr("Tugas berikutnya")}</SectionTitle>
      {upcoming[0] ? (
        <DutyCard duty={upcoming[0]} highlight />
      ) : (
        <Card>
          <Empty icon={<CalendarCheck size={20} />} title={tr("Belum ada tugas terjadwal")} body={tr("Waktunya istirahat dan menikmati ibadah bersama jemaat 💛")} />
        </Card>
      )}

      {pendingLater > 0 && (
        <Link href="/jadwal">
          <Card className="mt-3 px-4 py-3 flex items-center gap-3 text-sm hover:border-brand">
            <span className="h-7 w-7 rounded-full bg-warning-soft text-warning-ink grid place-items-center font-bold text-xs">{pendingLater}</span>
            <span className="flex-1">{tr("tugas lain belum kamu konfirmasi")}</span>
            <span className="text-brand font-medium text-xs">{tr("Konfirmasi →")}</span>
          </Card>
        </Link>
      )}

      {openRequests.length > 0 && (
        <>
          <SectionTitle>{tr("Butuh pengganti")}</SectionTitle>
          <div className="space-y-2">
            {openRequests.map(({ a, s }) => {
              const requester = users.find((u) => u.id === (a.subRequest?.requestedBy ?? a.userId));
              const m = ministries.find((x) => x.id === a.ministryId);
              return (
                <Card key={a.id} className="p-3 flex items-center gap-3">
                  <Avatar name={requester?.name} src={requester?.photoUrl} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <b>{requester?.name ?? tr("Seseorang")}</b> {tr("butuh pengganti")}
                    </div>
                    <div className="text-[length:calc(12px*var(--fs))] text-ink-soft truncate">
                      {a.position} · {m?.name} · {formatDateShort(s.date)} {s.time}
                    </div>
                    <div className="text-[length:calc(12px*var(--fs))] text-ink-soft italic truncate">“{a.subRequest?.reason}”</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!(await ask({ title: tr("Gantikan sebagai {position}?", { position: a.position }), message: formatDateLong(s.date), confirmText: tr("Saya bisa") }))) return;
                      await takeSubstitute(a, me, s, users);
                      celebrate(tr("Terima kasih sudah menolong! 🙌"));
                    }}
                  >
                    <Repeat2 size={14} /> {tr("Saya bisa")}
                  </Button>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle>{tr("Servant care")}</SectionTitle>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-danger-soft text-danger grid place-items-center shrink-0">
            <HandHeart size={20} />
          </div>
          <div className="text-sm flex-1">
            <p className="font-semibold">{stats.thisMonth} {tr("tugas bulan ini")}</p>
            <p className="text-ink-soft">{stats.thisMonth >= 5 ? tr("Sudah sering melayani — istirahat juga penting 💛") : tr("Tetap jaga kesehatan & waktu teduhmu.")}</p>
          </div>
          {stats.thisMonth >= 5 && (
            <Link href="/profil">
              <Badge className="bg-danger-soft text-danger-ink">{tr("Atur OFF")}</Badge>
            </Link>
          )}
        </div>
        <p className="mt-3 pt-3 border-t border-line text-[length:calc(13px*var(--fs))] text-ink-soft">
          “{tr(verse[0])}” <span className="font-medium text-ink">{tr(verse[1])}</span>
        </p>
      </Card>

      {upcoming.length > 1 && (
        <>
          <SectionTitle action={<Link href="/jadwal" className="text-xs text-brand font-medium">{tr("Lihat semua")}</Link>}>{tr("Berikutnya")}</SectionTitle>
          <div className="space-y-2">
            {upcoming.slice(1, 4).map((d) => (
              <Card key={d.assignment.id} className="p-3 flex items-center gap-3">
                <div className="text-center w-11 shrink-0">
                  <div className="text-[length:calc(10px*var(--fs))] uppercase text-ink-soft">{formatDateShort(d.service.date).split(",")[0]}</div>
                  <div className="text-lg font-bold leading-none">{Number(d.service.date.slice(8))}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.assignment.position}</div>
                  <div className="text-[length:calc(12px*var(--fs))] text-ink-soft truncate">
                    {d.service.title} · {d.service.time}
                  </div>
                </div>
                <Badge color={d.ministry.color}>{d.ministry.name}</Badge>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
