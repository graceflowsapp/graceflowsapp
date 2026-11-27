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
import { tr } from "@/lib/i18n";

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
    <SectionTitle>{tr("Akun & login")}</SectionTitle>
    <Card className="divide-y divide-line">
      {/* Username */}
      <div className="p-4">
        <Row icon={<AtSign size={18} />} title={tr("Username")} value={account.username ? `@${account.username}` : tr("Belum ada")} muted={!account.username}>
          {!account.username && form !== "username" && (
            <Button size="sm" variant="secondary" onClick={() => setForm("username")}>
              {tr("Tambah")}
            </Button>
          )}
          {account.username && hasPassword(user) && form !== "change-username" && (
            <Button size="sm" variant="secondary" onClick={() => setForm("change-username")}>
              {tr("Ubah")}
            </Button>
          )}
        </Row>
        {form === "username" && <AddUsernameForm needsPassword={!hasPassword(user)} onDone={() => setForm(null)} />}
        {form === "change-username" && <ChangeUsernameForm current={account.username ?? ""} onDone={() => setForm(null)} />}
      </div>

      {/* Password */}
      {hasPassword(user) && (
        <div className="p-4">
          <Row icon={<KeyRound size={18} />} title={tr("Kata sandi")} value="••••••••">
            {form !== "password" && (
              <Button size="sm" variant="secondary" onClick={() => setForm("password")}>
                {tr("Ubah")}
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
          title={tr("Email")}
          value={account.email || (account.pendingEmail ? tr("Menunggu verifikasi") : tr("Belum terhubung"))}
          muted={!account.email}
        >
          {canEditEmail && form !== "email" && (
            <Button size="sm" variant="secondary" onClick={() => setForm("email")}>
              {usernameOnly && !account.pendingEmail ? tr("Hubungkan") : tr("Ubah")}
            </Button>
          )}
        </Row>
        {account.pendingEmail && form !== "email" && (
          <p className="mt-3 rounded-xl bg-warning-soft text-warning-ink text-[length:calc(13px*var(--fs))] px-3 py-2">
            {tr("Kami sudah mengirim link ke")} <b>{account.pendingEmail}</b>{tr(". Buka email itu dan klik link-nya. Setelah itu kamu akan keluar otomatis. Masuk lagi pakai")} {usernameOnly ? tr("email baru atau username") : tr("email baru")}.
            {!usernameOnly && <> {tr("Sampai link diklik, kamu tetap masuk dengan")} <b>{account.email}</b>.</>}
          </p>
        )}
        {emailIsGoogle && <p className="mt-2 text-[length:calc(12px*var(--fs))] text-ink-soft">{tr("Email ini mengikuti akun Google kamu.")}</p>}
        {form === "email" && <ConnectEmailForm changing={!usernameOnly} onDone={() => setForm(null)} />}
      </div>

      {/* Google */}
      <div className="p-4">
        <Row icon={<GoogleIcon size={18} />} title={tr("Google")} value={googleEmail(user) ?? tr("Belum terhubung")} muted={!googleEmail(user)}>
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
                  celebrate(tr("Google terhubung"));
                } catch (err) {
                  const msg = authErrorMessage(err);
                  if (msg) setGoogleError(msg);
                } finally {
                  setGoogleBusy(false);
                }
              }}
            >
              {tr("Hubungkan")}
            </Button>
          ) : (
            hasPassword(user) && (
              <Button
                size="sm"
                variant="secondary"
                disabled={googleBusy}
                onClick={async () => {
                  const ok = await ask({
                    title: tr("Lepas akun Google?"),
                    message: tr("Kamu tidak bisa lagi masuk dengan Google ({p}). Masuk tetap bisa dengan {p2} dan kata sandi.", { p: googleEmail(user), p2: account.username ? "username" : "email" }),
                    confirmText: tr("Lepas"),
                    tone: "warning",
                  });
                  if (!ok) return;
                  setGoogleBusy(true);
                  setGoogleError("");
                  try {
                    await unlinkGoogle(user);
                    rerender((n) => n + 1);
                    toast(tr("Akun Google dilepas"));
                  } catch (err) {
                    setGoogleError(authErrorMessage(err));
                  } finally {
                    setGoogleBusy(false);
                  }
                }}
              >
                {tr("Lepas")}
              </Button>
            )
          )}
        </Row>
        {!googleEmail(user) && !googleError && (
          <p className="mt-2 text-[length:calc(12px*var(--fs))] text-ink-soft">{tr("Setelah terhubung, tombol \"Masuk dengan Google\" membuka akun ini.")}</p>
        )}
        {googleError && <p className="mt-3 rounded-xl bg-danger-soft text-danger-ink text-[length:calc(13px*var(--fs))] px-3 py-2">{googleError}</p>}
      </div>

      <p className="px-4 py-3 text-[length:calc(12px*var(--fs))] text-ink-soft">
        {tr("Kamu bisa masuk dengan")}{" "}
        {[
          hasPassword(user) && tr("{p} + kata sandi", { p: account.username && account.email ? tr("email atau username") : account.username ? "username" : "email" }),
          googleEmail(user) && tr("tombol Masuk dengan Google"),
        ]
          .filter(Boolean)
          .join(tr(", atau "))}
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
          celebrate(tr("Username tersimpan"));
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
        <Field label={tr("Buat kata sandi")} hint={tr("Akunmu masuk lewat Google, jadi buat kata sandi untuk masuk dengan username. Minimal 6 karakter.")}>
          <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
        </Field>
      )}
      {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {tr("Batal")}
        </Button>
        <Button className="flex-1" disabled={busy || !!usernameError(username) || (needsPassword && password.length < 6)}>
          {tr("Simpan username")}
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
          toast(tr("Link verifikasi terkirim. Cek email kamu 📧"));
          onDone();
        } catch (err) {
          setError(authErrorMessage(err).replace(tr("Username/email atau kata sandi salah."), tr("Kata sandi salah.")));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={changing ? tr("Email baru") : tr("Email")}>
        <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder={tr("nama@email.com")} required />
      </Field>
      <Field label={tr("Kata sandi saat ini")} hint={tr("Untuk memastikan ini benar kamu.")}>
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <p className="text-[length:calc(12px*var(--fs))] text-ink-soft mb-3">
        {changing ? tr("Kami akan mengirim link ke email itu. Email baru dipakai setelah link-nya kamu klik.") : tr("Kami akan mengirim link ke email itu. Email baru terhubung setelah link-nya kamu klik.")}
        {changing && tr(" Email lama tetap bisa dipakai sampai saat itu, dan akan menerima pemberitahuan perubahan.")}
      </p>
      {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {tr("Batal")}
        </Button>
        <Button className="flex-1" disabled={busy || !email || !password}>
          {tr("Kirim link verifikasi")}
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
        className={`${inputCls} pr-11 text-[length:max(16px,calc(16px*var(--fs)))]`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? tr("Sembunyikan kata sandi") : tr("Tampilkan kata sandi")}
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
        {tr("Batal")}
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
          celebrate(tr("Username diganti"));
          toast(tr("Mulai sekarang masuk dengan @{username}", { username }));
          onDone();
        } catch (err) {
          setError(authErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <UsernameField value={username} onChange={setUsername} label={tr("Username baru")} />
      <Field label={tr("Kata sandi saat ini")} hint={tr("Untuk memastikan ini benar kamu.")}>
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <p className="text-[length:calc(12px*var(--fs))] text-ink-soft mb-3">{tr("Setelah diganti, @")}{current} {tr("tidak bisa dipakai lagi untuk masuk.")}</p>
      {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
      <FormButtons onCancel={onDone} disabled={busy || !!usernameError(username) || username === current || !password}>
        {tr("Ganti username")}
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
          celebrate(tr("Kata sandi diganti"));
          onDone();
        } catch (err) {
          setError(authErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={tr("Kata sandi lama")}>
        <PasswordInput value={oldPw} onChange={setOldPw} autoComplete="current-password" />
      </Field>
      <Field label={tr("Kata sandi baru")} hint={tooShort ? undefined : tr("Minimal 6 karakter.")}>
        <PasswordInput value={newPw} onChange={setNewPw} autoComplete="new-password" />
        {tooShort && <p className="text-[length:calc(12px*var(--fs))] text-danger-ink mt-1">{tr("Minimal 6 karakter.")}</p>}
      </Field>
      <Field label={tr("Ulangi kata sandi baru")}>
        <PasswordInput value={again} onChange={setAgain} autoComplete="new-password" />
        {mismatch && <p className="text-[length:calc(12px*var(--fs))] text-danger-ink mt-1">{tr("Belum sama dengan kata sandi baru.")}</p>}
      </Field>
      {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
      <FormButtons onCancel={onDone} disabled={busy || !oldPw || newPw.length < 6 || newPw !== again}>
        {tr("Ganti kata sandi")}
      </FormButtons>
    </form>
  );
}
