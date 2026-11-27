"use client";

import { useState, type ReactNode } from "react";
import { AtSign, Eye, EyeOff, KeyRound, Mail, MailCheck } from "lucide-react";
import { GoogleIcon } from "./GoogleIcon";
import { useApp } from "./providers";
import { Button, Card, Field, SectionTitle, inputCls, toast } from "./ui";
import { UsernameField } from "./UsernameField";
import { firebaseAuth } from "@/lib/firebase";
import { addUsername, authErrorMessage, changePassword, changeUsername, connectEmail, googleEmail, hasPassword, isPlaceholderEmail, linkGoogle, unlinkGoogle, usernameError, usesGoogle } from "@/lib/username";
import { ask, celebrate } from "@/lib/feedback";

/**
 * Profil → "Akun & login" (Firebase mode only).
 * - Username accounts connect an email (verified by a link Firebase sends).
 * - Email / Google accounts add a username (Google accounts also create a password).
 * - Change username / password, both confirmed with the current password.
 * - Connect / disconnect Google, so "Masuk dengan Google" opens this same account.
 */
export function AccountLoginSettings() {
  const { account, demo } = useApp();
  const [form, setForm] = useState<"username" | "change-username" | "email" | "password" | null>(null);
  // Firebase updates the signed-in user in place after (un)linking, so re-render by hand
  const [, rerender] = useState(0);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState("");
  if (demo || !account) return null;
  const user = firebaseAuth().currentUser;
  if (!user) return null;
  const usernameOnly = isPlaceholderEmail(user.email);
  // username-only accounts connect an email; email + password accounts can change theirs (Google: managed by Google)
  // the login email IS the Gmail → it belongs to Google, so it is not changed here
  const emailIsGoogle = usesGoogle(user) && (user.email ?? "").toLowerCase() === (googleEmail(user) ?? "").toLowerCase();
  const canEditEmail = hasPassword(user) && !emailIsGoogle;

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
          {account.username && hasPassword(user) && form !== "change-username" && (
            <Button size="sm" variant="secondary" onClick={() => setForm("change-username")}>
              Ubah
            </Button>
          )}
        </Row>
        {form === "username" && <AddUsernameForm needsPassword={!hasPassword(user)} onDone={() => setForm(null)} />}
        {form === "change-username" && <ChangeUsernameForm current={account.username ?? ""} onDone={() => setForm(null)} />}
      </div>

      {/* Password */}
      {hasPassword(user) && (
        <div className="p-4">
          <Row icon={<KeyRound size={18} />} title="Kata sandi" value="••••••••">
            {form !== "password" && (
              <Button size="sm" variant="secondary" onClick={() => setForm("password")}>
                Ubah
              </Button>
            )}
          </Row>
          {form === "password" && <ChangePasswordForm onDone={() => setForm(null)} />}
        </div>
      )}

      {/* Email */}
      <div className="p-4">
        <Row
          icon={account.email ? <MailCheck size={18} /> : <Mail size={18} />}
          title="Email"
          value={account.email || (account.pendingEmail ? "Menunggu verifikasi" : "Belum terhubung")}
          muted={!account.email}
        >
          {canEditEmail && form !== "email" && (
            <Button size="sm" variant="secondary" onClick={() => setForm("email")}>
              {usernameOnly && !account.pendingEmail ? "Hubungkan" : "Ubah"}
            </Button>
          )}
        </Row>
        {account.pendingEmail && form !== "email" && (
          <p className="mt-3 rounded-xl bg-warning-soft text-warning-ink text-[13px] px-3 py-2">
            Kami sudah mengirim link ke <b>{account.pendingEmail}</b>. Buka email itu dan klik link-nya. Setelah itu kamu akan keluar otomatis. Masuk lagi pakai {usernameOnly ? "email baru atau username" : "email baru"}.
            {!usernameOnly && <> Sampai link diklik, kamu tetap masuk dengan <b>{account.email}</b>.</>}
          </p>
        )}
        {emailIsGoogle && <p className="mt-2 text-[12px] text-ink-soft">Email ini mengikuti akun Google kamu.</p>}
        {form === "email" && <ConnectEmailForm changing={!usernameOnly} onDone={() => setForm(null)} />}
      </div>

      {/* Google */}
      <div className="p-4">
        <Row icon={<GoogleIcon size={18} />} title="Google" value={googleEmail(user) ?? "Belum terhubung"} muted={!googleEmail(user)}>
          {!googleEmail(user) ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={googleBusy}
              onClick={async () => {
                setGoogleBusy(true);
                setGoogleError("");
                try {
                  await linkGoogle(user);
                  rerender((n) => n + 1);
                  celebrate("Google terhubung");
                } catch (err) {
                  const msg = authErrorMessage(err);
                  if (msg) setGoogleError(msg);
                } finally {
                  setGoogleBusy(false);
                }
              }}
            >
              Hubungkan
            </Button>
          ) : (
            hasPassword(user) && (
              <Button
                size="sm"
                variant="secondary"
                disabled={googleBusy}
                onClick={async () => {
                  const ok = await ask({
                    title: "Lepas akun Google?",
                    message: `Kamu tidak bisa lagi masuk dengan Google (${googleEmail(user)}). Masuk tetap bisa dengan ${account.username ? "username" : "email"} dan kata sandi.`,
                    confirmText: "Lepas",
                    tone: "warning",
                  });
                  if (!ok) return;
                  setGoogleBusy(true);
                  setGoogleError("");
                  try {
                    await unlinkGoogle(user);
                    rerender((n) => n + 1);
                    toast("Akun Google dilepas");
                  } catch (err) {
                    setGoogleError(authErrorMessage(err));
                  } finally {
                    setGoogleBusy(false);
                  }
                }}
              >
                Lepas
              </Button>
            )
          )}
        </Row>
        {!googleEmail(user) && !googleError && (
          <p className="mt-2 text-[12px] text-ink-soft">Setelah terhubung, tombol &quot;Masuk dengan Google&quot; membuka akun ini.</p>
        )}
        {googleError && <p className="mt-3 rounded-xl bg-danger-soft text-danger-ink text-[13px] px-3 py-2">{googleError}</p>}
      </div>

      <p className="px-4 py-3 text-[12px] text-ink-soft">
        Kamu bisa masuk dengan{" "}
        {[
          hasPassword(user) && `${account.username && account.email ? "email atau username" : account.username ? "username" : "email"} + kata sandi`,
          googleEmail(user) && "tombol Masuk dengan Google",
        ]
          .filter(Boolean)
          .join(", atau ")}
        .
      </p>
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

function ConnectEmailForm({ changing, onDone }: { changing: boolean; onDone: () => void }) {
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
      <Field label={changing ? "Email baru" : "Email"}>
        <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nama@email.com" required />
      </Field>
      <Field label="Kata sandi saat ini" hint="Untuk memastikan ini benar kamu.">
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <p className="text-[12px] text-ink-soft mb-3">
        Kami akan mengirim link ke email itu. Email baru {changing ? "dipakai" : "terhubung"} setelah link-nya kamu klik.
        {changing && " Email lama tetap bisa dipakai sampai saat itu, dan akan menerima pemberitahuan perubahan."}
      </p>
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

/** Password input with a show/hide eye. */
function PasswordInput({ value, onChange, autoComplete, placeholder }: { value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={`${inputCls} pr-11 text-[16px]`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-lg text-ink-soft hover:bg-surface"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

function FormButtons({ onCancel, disabled, children }: { onCancel: () => void; disabled: boolean; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Batal
      </Button>
      <Button className="flex-1" disabled={disabled}>
        {children}
      </Button>
    </div>
  );
}

function ChangeUsernameForm({ current, onDone }: { current: string; onDone: () => void }) {
  const { account } = useApp();
  const [username, setUsername] = useState(current);
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
          await changeUsername(user, account, username, password);
          celebrate("Username diganti");
          toast(`Mulai sekarang masuk dengan @${username}`);
          onDone();
        } catch (err) {
          setError(authErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <UsernameField value={username} onChange={setUsername} label="Username baru" />
      <Field label="Kata sandi saat ini" hint="Untuk memastikan ini benar kamu.">
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <p className="text-[12px] text-ink-soft mb-3">Setelah diganti, @{current} tidak bisa dipakai lagi untuk masuk.</p>
      {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
      <FormButtons onCancel={onDone} disabled={busy || !!usernameError(username) || username === current || !password}>
        Ganti username
      </FormButtons>
    </form>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mismatch = again.length > 0 && again !== newPw;
  const tooShort = newPw.length > 0 && newPw.length < 6;

  return (
    <form
      className="mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const user = firebaseAuth().currentUser;
        if (!user) return;
        setBusy(true);
        setError("");
        try {
          await changePassword(user, oldPw, newPw);
          celebrate("Kata sandi diganti");
          onDone();
        } catch (err) {
          setError(authErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Kata sandi lama">
        <PasswordInput value={oldPw} onChange={setOldPw} autoComplete="current-password" />
      </Field>
      <Field label="Kata sandi baru" hint={tooShort ? undefined : "Minimal 6 karakter."}>
        <PasswordInput value={newPw} onChange={setNewPw} autoComplete="new-password" />
        {tooShort && <p className="text-[12px] text-danger-ink mt-1">Minimal 6 karakter.</p>}
      </Field>
      <Field label="Ulangi kata sandi baru">
        <PasswordInput value={again} onChange={setAgain} autoComplete="new-password" />
        {mismatch && <p className="text-[12px] text-danger-ink mt-1">Belum sama dengan kata sandi baru.</p>}
      </Field>
      {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
      <FormButtons onCancel={onDone} disabled={busy || !oldPw || newPw.length < 6 || newPw !== again}>
        Ganti kata sandi
      </FormButtons>
    </form>
  );
}
