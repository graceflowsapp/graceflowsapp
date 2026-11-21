"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Camera, Download, LogOut } from "lucide-react";
import { IOSInstallSteps, useInstall } from "@/components/InstallPrompt";
import { serviceLine, useMyDuties } from "@/components/duty";
import { ThemeSettings } from "@/components/ThemeSettings";
import { AccountLoginSettings } from "@/components/AccountLoginSettings";
import { displayLogin } from "@/lib/username";
import { useApp } from "@/components/providers";
import { Avatar, Badge, Button, Card, Field, SectionTitle, cn, inputCls, toast } from "@/components/ui";
import { updateProfile } from "@/lib/actions";
import { uploadProfilePhoto } from "@/lib/upload";
import { formatDateShort } from "@/lib/dates";
import { isAvailableNow, statsFor } from "@/lib/scheduling";

export default function ProfilePage() {
  const { me, services, assignments, ministries, logout, demo } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { upcoming } = useMyDuties();

  if (!me) return null;
  const stats = statsFor(me.id, services, assignments);
  const available = isAvailableNow(me);
  const maxCount = Math.max(1, ...stats.byMinistry.map((b) => b.count));

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadProfilePhoto(file, me.id);
      await updateProfile(me.id, { photoUrl: url });
      toast("Foto profil diperbarui");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Card className="p-5 text-center">
        <div className="relative mx-auto w-fit">
          <Avatar name={me.name} src={me.photoUrl} size={96} className={uploading ? "opacity-50" : ""} />
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-brand text-white grid place-items-center border-2 border-card"
            aria-label="Ganti foto"
          >
            <Camera size={15} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
        </div>
        {editing ? (
          <div className="mt-4 text-left">
            <Field label="Nama">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="No. WhatsApp" hint="Dipakai rekan setim untuk menghubungimu.">
              <input className={inputCls} value={phone} inputMode="tel" placeholder="08xxxxxxxxxx" onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
                Batal
              </Button>
              <Button
                className="flex-1"
                onClick={async () => {
                  await updateProfile(me.id, { name: name.trim() || me.name, phone: phone.trim() });
                  setEditing(false);
                  toast("Profil tersimpan");
                }}
              >
                Simpan
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-3 text-lg font-bold">{me.name}</h1>
            <p className="text-sm text-ink-soft">{displayLogin(me)}</p>
            {me.phone && <p className="text-sm text-ink-soft">{me.phone}</p>}
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <Badge className="bg-brand-soft text-brand capitalize">{me.role}</Badge>
              {me.ministries.map((id) => {
                const m = ministries.find((x) => x.id === id);
                return m ? (
                  <Badge key={id} color={m.color}>
                    {m.name}
                  </Badge>
                ) : null;
              })}
            </div>
            {me.skills.length > 0 && <p className="text-[12px] text-ink-soft mt-2">Posisi: {me.skills.join(", ")}</p>}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setName(me.name);
                setPhone(me.phone ?? "");
                setEditing(true);
              }}
            >
              Ubah profil
            </Button>
          </>
        )}
      </Card>

      <AccountLoginSettings />

      <SectionTitle>Ketersediaan</SectionTitle>
      <Link href="/ketersediaan">
        <Card className="p-4 flex items-center gap-3 hover:border-brand">
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", available ? "bg-success" : "bg-danger")} />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{available ? "ON — Siap melayani" : `OFF — ${me.unavailableReason || "Sedang rehat"}`}</p>
            <p className="text-[12px] text-ink-soft">
              {(me.unavailableServices ?? []).length} ibadah OFF · {(me.disabledPositions ?? []).length} peran OFF
            </p>
          </div>
          <span className="text-xs text-brand font-medium">Atur →</span>
        </Card>
      </Link>

      <SectionTitle>Statistik pelayanan</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Total", stats.total],
          ["Bulan ini", stats.thisMonth],
          ["Akan datang", stats.upcoming],
        ].map(([label, value]) => (
          <Card key={label} className="p-3 text-center">
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-[11px] text-ink-soft">{label}</div>
          </Card>
        ))}
      </div>
      <Card className="p-4 mt-2">
        <p className="text-xs font-medium text-ink-soft mb-2">Konfirmasi kehadiran</p>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-surface">
          {stats.total > 0 && (
            <>
              <div className="bg-success" style={{ width: `${(stats.confirmed / stats.total) * 100}%` }} />
              <div className="bg-danger" style={{ width: `${(stats.declined / stats.total) * 100}%` }} />
            </>
          )}
        </div>
        <div className="flex justify-between text-[12px] mt-2">
          <span className="text-success">✓ Hadir {stats.confirmed}</span>
          <span className="text-danger-ink">✗ Berhalangan {stats.declined}</span>
          <span className="text-ink-soft">Belum {stats.pending}</span>
        </div>
      </Card>
      {upcoming[0] && (
        <Link href="/jadwal">
          <Card className="p-4 mt-2 flex items-center gap-3 hover:border-brand">
            <CalendarDays size={18} className="text-brand" />
            <div className="flex-1 text-sm">
              <div className="font-medium">Tugas berikutnya: {upcoming[0].assignment.position}</div>
              <div className="text-[12px] text-ink-soft">{formatDateShort(upcoming[0].service.date)} · {serviceLine(upcoming[0].service)}</div>
            </div>
            <span className="text-xs text-brand font-medium">Kalender →</span>
          </Card>
        </Link>
      )}
      {stats.byMinistry.length > 0 && (
        <Card className="p-4 mt-2 space-y-2.5">
          {stats.byMinistry.map(({ ministryId, count }) => {
            const m = ministries.find((x) => x.id === ministryId);
            return (
              <div key={ministryId}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span>{m?.name ?? ministryId}</span>
                  <span className="font-semibold">{count}×</span>
                </div>
                <div className="h-2 rounded-full bg-surface overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(count / maxCount) * 100}%`, background: m?.color ?? "#0f766e" }} />
                </div>
              </div>
            );
          })}
          {stats.lastServed && <p className="text-[12px] text-ink-soft pt-1">Terakhir melayani: {formatDateShort(stats.lastServed)}</p>}
        </Card>
      )}

      <SectionTitle>Tampilan</SectionTitle>
      <ThemeSettings />

      <InstallCard />

      <Button variant="danger" className="w-full mt-6" onClick={logout}>
        <LogOut size={16} /> {demo ? "Ganti peran (demo)" : "Keluar"}
      </Button>
    </div>
  );
}

/** "Pasang aplikasi" — shown only when the app isn't installed yet and the device can install it. */
function InstallCard() {
  const { available, canPrompt, ios, promptInstall } = useInstall();
  const [showIOS, setShowIOS] = useState(false);
  if (!available) return null;
  return (
    <>
      <Card className="mt-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-full shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">Pasang aplikasi</div>
          <div className="text-xs text-ink-soft">Tambahkan GraceFlow ke layar utama HP-mu.</div>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            if (canPrompt) {
              if (await promptInstall()) toast("GraceFlow terpasang 🎉");
            } else if (ios) setShowIOS(true);
          }}
        >
          <Download size={15} /> Pasang
        </Button>
      </Card>
      <IOSInstallSteps open={showIOS} onClose={() => setShowIOS(false)} />
    </>
  );
}
