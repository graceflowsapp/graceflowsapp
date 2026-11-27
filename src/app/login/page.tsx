"use client";

import { GoogleIcon } from "@/components/GoogleIcon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, LayoutGrid, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/providers";
import { Button, Card, Field, inputCls } from "@/components/ui";
import { Logo } from "@/components/AppShell";
import { DEMO_CHURCHES } from "@/lib/seed";
import { resetDemoData } from "@/lib/store";
import { ask } from "@/lib/feedback";
import { UsernameField } from "@/components/UsernameField";
import { authErrorMessage, usernameError } from "@/lib/username";
import { tr } from "@/lib/i18n";

export default function LoginPage() {
  const { ready, uid, demo } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (ready && uid) router.replace("/");
  }, [ready, uid, router]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-b from-brand-soft to-surface">
      <div className="w-full max-w-sm">
        <Logo className="justify-center mb-6" />
        <h1 className="text-center text-xl font-bold">{tr("Melayani tanpa bentrok, tanpa burnout.")}</h1>
        <p className="text-center text-sm text-ink-soft mt-1 mb-6">{tr("Jadwal pelayanan, pengganti, dan servant care untuk gerejamu.")}</p>
        {demo ? <DemoLogin /> : <FirebaseLogin />}
      </div>
    </div>
  );
}

const ROLE_ICON = { Servant: HeartHandshake, Coordinator: LayoutGrid, "Admin Gereja": ShieldCheck } as const;

function DemoLogin() {
  const { loginDemo, createDemoAccount } = useApp();
  const [newName, setNewName] = useState("");
  return (
    <>
      <Card className="p-3 mb-4 bg-warning-soft border-warning/30 text-[length:calc(13px*var(--fs))] text-warning-ink">
        <b>{tr("Mode Demo")}</b> {tr("— Firebase belum dikonfigurasi. Data disimpan di browser ini. Ada 2 gereja contoh yang")} <b>{tr("terpisah")}</b>{tr("; pilih peran untuk mencoba:")}
      </Card>
      {DEMO_CHURCHES.map((c) => (
        <div key={c.id} className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.accent ?? "#0f766e" }} />
            {c.name}
          </p>
          <div className="space-y-2">
            {c.roles.map(({ uid, title, who }) => {
              const Icon = ROLE_ICON[title];
              return (
                <button key={uid} onClick={() => loginDemo(uid)} className="w-full text-left">
                  <Card className="p-3.5 flex items-center gap-3 hover:border-brand transition">
                    <div className="h-10 w-10 rounded-xl bg-brand-soft text-brand grid place-items-center shrink-0">
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold">{tr(title)}</div>
                      <div className="text-[length:calc(12px*var(--fs))] text-ink-soft truncate">{who}</div>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <Card className="p-4">
        <p className="font-semibold text-sm">{tr("Coba sebagai pengguna baru")}</p>
        <p className="text-[length:calc(12px*var(--fs))] text-ink-soft mb-3">{tr("Daftarkan gereja sendiri, atau gabung dengan kode contoh")} <b className="font-mono">{tr("GIA123")}</b> / <b className="font-mono">{tr("KASIH1")}</b>.</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createDemoAccount(newName.trim());
          }}
        >
          <input className={inputCls} placeholder={tr("Namamu")} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button disabled={!newName.trim()}>{tr("Mulai")}</Button>
        </form>
      </Card>

      <button
        className="block mx-auto mt-5 text-xs text-ink-soft underline"
        onClick={async () => {
          if (await ask({ title: tr("Reset data demo?"), message: tr("Semua data demo kembali ke kondisi awal."), confirmText: tr("Reset"), tone: "danger" })) resetDemoData();
        }}
      >
        {tr("Reset data demo")}
      </button>
    </>
  );
}

function FirebaseLogin() {
  const { login, registerUsername, loginGoogle } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const usernameOk = !usernameError(username);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => (mode === "login" ? login(identifier, password) : registerUsername(name, username, password)));
        }}
      >
        {mode === "register" ? (
          <>
            <Field label={tr("Nama lengkap")}>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </Field>
            <UsernameField value={username} onChange={setUsername} />
          </>
        ) : (
          <Field label={tr("Email atau username")}>
            <input
              className={inputCls}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={tr("nama@email.com atau grace.natalia")}
              required
            />
          </Field>
        )}
        <Field label={tr("Kata sandi")}>
          <input
            className={inputCls}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>
        {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
        <Button className="w-full" disabled={busy || (mode === "register" && !usernameOk)}>
          {mode === "login" ? tr("Masuk") : tr("Daftar")}
        </Button>
        {mode === "register" && <p className="text-[length:calc(12px*var(--fs))] text-ink-soft text-center mt-2">{tr("Email bisa dihubungkan nanti di menu Profil.")}</p>}
      </form>
      <div className="flex items-center gap-3 my-4 text-xs text-ink-soft">
        <div className="h-px flex-1 bg-line" /> {tr("atau")} <div className="h-px flex-1 bg-line" />
      </div>
      <Button variant="secondary" className="w-full" disabled={busy} onClick={() => run(loginGoogle)}>
        <GoogleIcon />
        {tr("Masuk dengan Google")}
      </Button>
      <p className="text-center text-sm text-ink-soft mt-4">
        {mode === "login" ? tr("Belum punya akun? ") : tr("Sudah punya akun? ")}
        <button
          className="text-brand font-medium"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          {mode === "login" ? tr("Daftar") : tr("Masuk")}
        </button>
      </p>
    </Card>
  );
}
