"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CalendarCheck, HandHeart, Moon, Repeat2 } from "lucide-react";
import { useApp } from "@/components/providers";
import { Avatar, Badge, Button, Card, Empty, SectionTitle, toast } from "@/components/ui";
import { DutyCard, useMyDuties } from "@/components/duty";
import { takeSubstitute } from "@/lib/actions";
import { formatDateLong, formatDateShort, todayISO } from "@/lib/dates";
import { canFill, findConflicts, isAvailableNow, statsFor } from "@/lib/scheduling";
import { ask, celebrate } from "@/lib/feedback";

const VERSES = [
  ["Marilah kepada-Ku, semua yang letih lesu dan berbeban berat, Aku akan memberi kelegaan kepadamu.", "Matius 11:28"],
  ["Apa pun juga yang kamu perbuat, perbuatlah dengan segenap hatimu seperti untuk Tuhan.", "Kolose 3:23"],
  ["Janganlah kita jemu-jemu berbuat baik, karena apabila sudah datang waktunya, kita akan menuai.", "Galatia 6:9"],
  ["Layanilah seorang akan yang lain, sesuai dengan karunia yang telah diperoleh tiap-tiap orang.", "1 Petrus 4:10"],
  ["Tenanglah, dan ketahuilah, bahwa Akulah Allah!", "Mazmur 46:11"],
];

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam";
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
              Status kamu <b>OFF</b> — {me.unavailableReason || "tidak tersedia"}
              {me.unavailableUntil && ` sampai ${formatDateShort(me.unavailableUntil)}`}. Kamu tidak akan dijadwalkan otomatis.
            </div>
          </Card>
        </Link>
      )}

      <SectionTitle>Tugas berikutnya</SectionTitle>
      {upcoming[0] ? (
        <DutyCard duty={upcoming[0]} highlight />
      ) : (
        <Card>
          <Empty icon={<CalendarCheck size={20} />} title="Belum ada tugas terjadwal" body="Waktunya istirahat dan menikmati ibadah bersama jemaat 💛" />
        </Card>
      )}

      {pendingLater > 0 && (
        <Link href="/jadwal">
          <Card className="mt-3 px-4 py-3 flex items-center gap-3 text-sm hover:border-brand">
            <span className="h-7 w-7 rounded-full bg-warning-soft text-warning-ink grid place-items-center font-bold text-xs">{pendingLater}</span>
            <span className="flex-1">tugas lain belum kamu konfirmasi</span>
            <span className="text-brand font-medium text-xs">Konfirmasi →</span>
          </Card>
        </Link>
      )}

      {openRequests.length > 0 && (
        <>
          <SectionTitle>Butuh pengganti</SectionTitle>
          <div className="space-y-2">
            {openRequests.map(({ a, s }) => {
              const requester = users.find((u) => u.id === (a.subRequest?.requestedBy ?? a.userId));
              const m = ministries.find((x) => x.id === a.ministryId);
              return (
                <Card key={a.id} className="p-3 flex items-center gap-3">
                  <Avatar name={requester?.name} src={requester?.photoUrl} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <b>{requester?.name ?? "Seseorang"}</b> butuh pengganti
                    </div>
                    <div className="text-[12px] text-ink-soft truncate">
                      {a.position} · {m?.name} · {formatDateShort(s.date)} {s.time}
                    </div>
                    <div className="text-[12px] text-ink-soft italic truncate">“{a.subRequest?.reason}”</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!(await ask({ title: `Gantikan sebagai ${a.position}?`, message: formatDateLong(s.date), confirmText: "Saya bisa" }))) return;
                      await takeSubstitute(a, me, s, users);
                      celebrate("Terima kasih sudah menolong! 🙌");
                    }}
                  >
                    <Repeat2 size={14} /> Saya bisa
                  </Button>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle>Servant care</SectionTitle>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-danger-soft text-danger grid place-items-center shrink-0">
            <HandHeart size={20} />
          </div>
          <div className="text-sm flex-1">
            <p className="font-semibold">{stats.thisMonth} tugas bulan ini</p>
            <p className="text-ink-soft">{stats.thisMonth >= 5 ? "Sudah sering melayani — istirahat juga penting 💛" : "Tetap jaga kesehatan & waktu teduhmu."}</p>
          </div>
          {stats.thisMonth >= 5 && (
            <Link href="/profil">
              <Badge className="bg-danger-soft text-danger-ink">Atur OFF</Badge>
            </Link>
          )}
        </div>
        <p className="mt-3 pt-3 border-t border-line text-[13px] text-ink-soft">
          “{verse[0]}” <span className="font-medium text-ink">{verse[1]}</span>
        </p>
      </Card>

      {upcoming.length > 1 && (
        <>
          <SectionTitle action={<Link href="/jadwal" className="text-xs text-brand font-medium">Lihat semua</Link>}>Berikutnya</SectionTitle>
          <div className="space-y-2">
            {upcoming.slice(1, 4).map((d) => (
              <Card key={d.assignment.id} className="p-3 flex items-center gap-3">
                <div className="text-center w-11 shrink-0">
                  <div className="text-[10px] uppercase text-ink-soft">{formatDateShort(d.service.date).split(",")[0]}</div>
                  <div className="text-lg font-bold leading-none">{Number(d.service.date.slice(8))}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.assignment.position}</div>
                  <div className="text-[12px] text-ink-soft truncate">
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
