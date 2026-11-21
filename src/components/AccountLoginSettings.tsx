"use client";

import { useState } from "react";
import { AtSign, Mail, MailCheck } from "lucide-react";
import { useApp } from "./providers";
import { Button, Card, Field, SectionTitle, inputCls, toast } from "./ui";
import { UsernameField } from "./UsernameField";
import { firebaseAuth } from "@/lib/firebase";
import { addUsername, authErrorMessage, connectEmail, hasPassword, isPlaceholderEmail, usernameError } from "@/lib/username";
import { celebrate } from "@/lib/feedback";

/**
 * Profil → "Akun & login" (Firebase mode only).
 * - Username accounts connect an email (verified by a link Firebase sends).
 * - Email / Google accounts add a username (Google accounts also create a password).
 */
export function AccountLoginSettings() {
  const { account, demo } = useApp();
  const [form, setForm] = useState<"username" | "email" | null>(null);
  if (demo || !account) return null;
  const user = firebaseAuth().currentUser;
  if (!user) return null;
  const usernameOnly = isPlaceholderEmail(user.email);

  return (
    <>
    <SectionTitle>Akun & login</SectionTitle>
    <Card className="divide-y divide-line">
      {/* Username */}
      <div className="p-4">
        <Row icon={<AtSign size={18} />} title="Username" value={account.username ? `@${account.username}` : "Belum ada"} muted={!account.username}>
          {!account.username && form !== "username" && (
            <Button size="sm" variant="secondary" onClick={() => setForm("username")}>
              Tambah
            </Button>
          )}
        </Row>
        {form === "username" && <AddUsernameForm needsPassword={!hasPassword(user)} onDone={() => setForm(null)} />}
      </div>

      {/* Email */}
      <div className="p-4">
        <Row
          icon={account.email ? <MailCheck size={18} /> : <Mail size={18} />}
          title="Email"
          value={account.email || (account.pendingEmail ? "Menunggu verifikasi" : "Belum terhubung")}
          muted={!account.email}
        >
          {usernameOnly && form !== "email" && (
            <Button size="sm" variant="secondary" onClick={() => setForm("email")}>
              {account.pendingEmail ? "Ubah" : "Hubungkan"}
            </Button>
          )}
        </Row>
        {account.pendingEmail && usernameOnly && form !== "email" && (
          <p className="mt-3 rounded-xl bg-warning-soft text-warning-ink text-[13px] px-3 py-2">
            Kami sudah mengirim link ke <b>{account.pendingEmail}</b>. Buka email itu dan klik link-nya. Setelah itu kamu akan keluar otomatis — masuk lagi pakai email atau username.
          </p>
        )}
        {form === "email" && <ConnectEmailForm onDone={() => setForm(null)} />}
      </div>

      <p className="px-4 py-3 text-[12px] text-ink-soft">Kamu bisa masuk dengan {account.username && account.email ? "email atau username" : account.username ? "username" : "email"} beserta kata sandimu.</p>
    </Card>
    </>
  );
}

function Row({ icon, title, value, muted, children }: { icon: React.ReactNode; title: string; value: string; muted?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-9 w-9 shrink-0 rounded-xl bg-brand-soft text-brand grid place-items-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink-soft">{title}</p>
        <p className={muted ? "text-sm text-ink-soft" : "text-sm font-semibold truncate"}>{value}</p>
      </div>
      {children}
    </div>
  );
}

function AddUsernameForm({ needsPassword, onDone }: { needsPassword: boolean; onDone: () => void }) {
  const { account } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      className="mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const user = firebaseAuth().currentUser;
        if (!user || !account) return;
        setBusy(true);
        setError("");
        try {
          await addUsername(user, account, username, needsPassword ? password : undefined);
          celebrate("Username tersimpan");
          onDone();
        } catch (err) {
          setError(authErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <UsernameField value={username} onChange={setUsername} />
      {needsPassword && (
        <Field label="Buat kata sandi" hint="Akunmu masuk lewat Google, jadi buat kata sandi untuk masuk dengan username. Minimal 6 karakter.">
          <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
        </Field>
      )}
      {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Batal
        </Button>
        <Button className="flex-1" disabled={busy || !!usernameError(username) || (needsPassword && password.length < 6)}>
          Simpan username
        </Button>
      </div>
    </form>
  );
}

function ConnectEmailForm({ onDone }: { onDone: () => void }) {
  const { account } = useApp();
  const [email, setEmail] = useState(account?.pendingEmail ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      className="mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const user = firebaseAuth().currentUser;
        if (!user || !account) return;
        setBusy(true);
        setError("");
        try {
          await connectEmail(user, account, email, password);
          toast("Link verifikasi terkirim. Cek email kamu 📧");
          onDone();
        } catch (err) {
          setError(authErrorMessage(err).replace("Username/email atau kata sandi salah.", "Kata sandi salah."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Email">
        <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nama@email.com" required />
      </Field>
      <Field label="Kata sandi saat ini" hint="Untuk memastikan ini benar kamu.">
        <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      <p className="text-[12px] text-ink-soft mb-3">Kami akan mengirim link ke email itu. Email baru terhubung setelah link-nya kamu klik.</p>
      {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Batal
        </Button>
        <Button className="flex-1" disabled={busy || !email || !password}>
          Kirim link verifikasi
        </Button>
      </div>
    </form>
  );
}
