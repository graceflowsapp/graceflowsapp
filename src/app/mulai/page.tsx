"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Church as ChurchIcon, KeyRound } from "lucide-react";
import { useApp } from "@/components/providers";
import { Button, Card, Field, cn, inputCls, toast } from "@/components/ui";
import { Logo } from "@/components/AppShell";
import { createChurch, joinChurch } from "@/lib/tenancy";

const PENDING_CODE_KEY = "graceflow-pending-invite";

export default function StartPage() {
  return (
    <Suspense>
      <Start />
    </Suspense>
  );
}

function Start() {
  const { ready, uid, account, churches, logout, switchChurch } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<"join" | "create">("join");
  const [code, setCode] = useState("");

  // invite links: /mulai?kode=ABC123 — remember the code across the login step
  useEffect(() => {
    let c = params.get("kode") ?? "";
    try {
      if (c) sessionStorage.setItem(PENDING_CODE_KEY, c);
      else c = sessionStorage.getItem(PENDING_CODE_KEY) ?? "";
    } catch {
      /* ignore */
    }
    if (c) {
      setCode(c.toUpperCase());
      setTab("join");
    }
  }, [params]);

  useEffect(() => {
    if (ready && !uid) router.replace("/login");
  }, [ready, uid, router]);

  if (!ready || !uid || !account) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  const done = () => {
    try {
      sessionStorage.removeItem(PENDING_CODE_KEY);
    } catch {
      /* ignore */
    }
    router.replace("/");
  };

  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-10 bg-gradient-to-b from-brand-soft to-surface">
      <div className="w-full max-w-sm">
        <Logo className="justify-center mb-6" />
        <h1 className="text-center text-xl font-bold">Halo, {account.name.split(" ")[0]} 👋</h1>
        <p className="text-center text-sm text-ink-soft mt-1 mb-6">
          {churches.length ? "Gabung ke gereja lain atau daftarkan gereja baru." : "Satu langkah lagi: hubungkan akunmu dengan gerejamu."}
        </p>

        <div className="grid grid-cols-2 bg-card border border-line rounded-xl p-1 mb-4">
          {[
            ["join", "Punya kode undangan"],
            ["create", "Daftarkan gereja"],
          ].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as typeof tab)} className={cn("rounded-lg py-2 text-sm font-medium", tab === k ? "bg-brand text-white" : "text-ink-soft")}>
              {label}
            </button>
          ))}
        </div>

        {tab === "join" ? <JoinForm code={code} setCode={setCode} onDone={done} /> : <CreateForm onDone={done} />}

        {churches.length > 0 && (
          <Card className="p-3 mt-4">
            <p className="text-xs text-ink-soft mb-2">Gereja kamu</p>
            {churches.map((c) => (
              <button
                key={c.id}
                onClick={async () => {
                  await switchChurch(c.id);
                  router.replace("/");
                }}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface text-left"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.accent ?? "#0f766e" }} />
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-brand">Buka →</span>
              </button>
            ))}
          </Card>
        )}

        <button onClick={logout} className="block mx-auto mt-6 text-xs text-ink-soft underline">
          Keluar ({account.email})
        </button>
      </div>
    </div>
  );
}

function JoinForm({ code, setCode, onDone }: { code: string; setCode: (c: string) => void; onDone: () => void }) {
  const { account } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Card className="p-5">
      <div className="h-11 w-11 rounded-xl bg-brand-soft text-brand grid place-items-center mb-3">
        <KeyRound size={20} />
      </div>
      <p className="font-semibold">Gabung dengan kode undangan</p>
      <p className="text-[13px] text-ink-soft mb-4">Minta kode 6 huruf dari admin gerejamu (menu Admin → Gereja).</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await joinChurch(account!, code);
            toast("Berhasil bergabung 🎉");
            onDone();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className={cn(inputCls, "text-center text-2xl font-mono font-bold tracking-[0.3em] uppercase")}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
          placeholder="ABC123"
          autoCapitalize="characters"
          autoComplete="off"
          required
          minLength={4}
        />
        {error && <p className="text-sm text-danger-ink mt-2">{error}</p>}
        <Button className="w-full mt-3" disabled={busy || code.length < 4}>
          Gabung
        </Button>
      </form>
    </Card>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const { account } = useApp();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [defaults, setDefaults] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Card className="p-5">
      <div className="h-11 w-11 rounded-xl bg-brand-soft text-brand grid place-items-center mb-3">
        <ChurchIcon size={20} />
      </div>
      <p className="font-semibold">Daftarkan gereja baru</p>
      <p className="text-[13px] text-ink-soft mb-4">Kamu akan menjadi Admin gereja ini dan bisa mengundang pelayan lain. Data setiap gereja terpisah dan tidak terlihat oleh gereja lain.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await createChurch(account!, { name, city, withDefaultMinistries: defaults });
            toast("Gereja terdaftar 🎉 Undang anggotamu dari menu Admin → Gereja");
            onDone();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nama gereja">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. GIA Makassar" required />
        </Field>
        <Field label="Kota">
          <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Makassar" />
        </Field>
        <label className="flex items-start gap-2 text-sm mb-4">
          <input type="checkbox" className="mt-1 accent-[var(--color-brand)]" checked={defaults} onChange={(e) => setDefaults(e.target.checked)} />
          <span>
            Mulai dengan bidang pelayanan umum
            <span className="block text-[12px] text-ink-soft">Praise & Worship, Musik, Multimedia, Usher, PBK Youth — bisa diubah nanti.</span>
          </span>
        </label>
        {error && <p className="text-sm text-danger-ink mb-2">{error}</p>}
        <Button className="w-full" disabled={busy || !name.trim()}>
          Daftarkan gereja
        </Button>
      </form>
      <p className="text-[11px] text-ink-soft mt-3 text-center">
        Sudah ada gerejamu di GraceFlow? Minta kode undangan ke admin, jangan daftar ulang.
      </p>
    </Card>
  );
}
