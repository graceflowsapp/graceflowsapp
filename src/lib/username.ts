"use client";

/**
 * Username login (Firebase mode).
 *
 * Firebase Auth's password sign-in always needs an email, so:
 * - An account created with only a username gets a placeholder login email `u-<username>@<authDomain>` that is never
 *   mailed to. When the person later connects a real email (Profil → Akun & login), Firebase sends a verification link
 *   (verifyBeforeUpdateEmail); once clicked, the real email becomes the login email.
 * - usernames/{username} = { uid, username, email } maps a username to the CURRENT login email. It makes usernames unique
 *   and lets the login screen accept "email atau username". It is readable by exact name (get), never listable.
 * - Accounts that signed up with email or Google can add a username later. Google-only accounts also set a password,
 *   because a username is always used together with a password.
 */
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithPopup,
  unlink,
  createUserWithEmailAndPassword,
  linkWithCredential,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";
import { raw } from "./store";
import { nowISO } from "./dates";
import type { Account } from "./types";

/* ---------------- rules ---------------- */

/** "Lebih dari 4" → at least 5 characters. */
export const USERNAME_MIN = 5;
/** Same maximum as Instagram. */
export const USERNAME_MAX = 30;

export interface UsernameDoc {
  uid: string;
  username: string;
  /** Email Firebase Auth signs this account in with (placeholder or real) */
  email: string;
  /** Email being verified: once its link is clicked it becomes the login email, before syncLoginEmail has run. */
  pendingEmail?: string | null;
}

export function normalizeUsername(s: string) {
  return s.trim().replace(/^@+/, "").toLowerCase();
}

/*
 * Instagram-style usernames (numbers allowed but NOT required):
 * a–z, 0–9, "." and "_"; at least one letter; no "." at the start or end; no "..".
 * Keep firestore.rules (match /usernames/{name}) in sync with these rules.
 */
const ALLOWED = /^[a-z0-9._]+$/;
const dotsOk = (u: string) => !u.startsWith(".") && !u.endsWith(".") && !u.includes("..");

/** Live checklist for the form. */
export function usernameChecks(u: string) {
  return [
    { ok: u.length >= USERNAME_MIN && u.length <= USERNAME_MAX, label: `Lebih dari 4 karakter (maks. ${USERNAME_MAX})` },
    { ok: /[a-z]/.test(u), label: "Ada huruf" },
    { ok: u.length > 0 && ALLOWED.test(u), label: "Hanya huruf, angka, titik (.) atau garis bawah (_)" },
    { ok: u.length > 0 && dotsOk(u), label: "Titik tidak di awal/akhir dan tidak dobel (..)" },
  ];
}

export function usernameError(u: string): string | null {
  if (u.length < USERNAME_MIN) return "Username harus lebih dari 4 karakter.";
  if (u.length > USERNAME_MAX) return `Username maksimal ${USERNAME_MAX} karakter.`;
  if (!ALLOWED.test(u)) return "Username hanya boleh berisi huruf, angka, titik (.) atau garis bawah (_), tanpa spasi.";
  if (!/[a-z]/.test(u)) return "Username harus mengandung huruf, tidak boleh angka semua.";
  if (!dotsOk(u)) return "Titik (.) tidak boleh di awal atau akhir username, dan tidak boleh dua titik berurutan.";
  return null;
}

/* ---------------- placeholder login email ---------------- */

const DOMAIN = (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "graceflow.firebaseapp.com").toLowerCase();
const PREFIX = "u-";

export function placeholderEmail(username: string) {
  return `${PREFIX}${username}@${DOMAIN}`;
}

export function isPlaceholderEmail(email?: string | null) {
  const e = (email ?? "").toLowerCase();
  return e.startsWith(PREFIX) && e.endsWith(`@${DOMAIN}`);
}

export function usernameFromPlaceholder(email?: string | null) {
  return isPlaceholderEmail(email) ? email!.toLowerCase().slice(PREFIX.length, -(DOMAIN.length + 1)) : undefined;
}

/** What to show as "contact": the real email, else @username. */
export function displayLogin(p: { email?: string; username?: string }) {
  return p.email || (p.username ? `@${p.username}` : "");
}

/* ---------------- errors ---------------- */

function appError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

/** Friendly Indonesian message for Firebase / app errors. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const msg = (e as Error)?.message ?? String(e);
  if (code.startsWith("app/")) return msg;
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Username/email atau kata sandi salah.";
  if (code.includes("email-already-in-use")) return "Email ini sudah dipakai akun lain.";
  if (code.includes("invalid-email")) return "Format email tidak benar.";
  if (code.includes("weak-password")) return "Kata sandi minimal 6 karakter.";
  if (code.includes("too-many-requests")) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (code.includes("requires-recent-login")) return "Demi keamanan, silakan keluar lalu masuk lagi, kemudian ulangi.";
  if (code.includes("network-request-failed")) return "Tidak ada koneksi internet.";
  if (code.includes("provider-already-linked") || code.includes("credential-already-in-use")) return "Akun ini sudah punya kata sandi.";
  return msg;
}

/* ---------------- actions ---------------- */

async function isTaken(u: string) {
  return Boolean(await raw.get<UsernameDoc>(`usernames/${u}`));
}

/** Copy a field to this person's membership in every church (so admins/teammates see it). */
async function updateMemberships(account: Pick<Account, "id" | "churchIds">, data: Record<string, unknown>) {
  await Promise.all((account.churchIds ?? []).map((cid) => raw.update(`churches/${cid}/members/${account.id}`, data).catch(() => undefined)));
}

/** Sign-up with username + password (no email yet). */
export async function registerWithUsername(name: string, rawUsername: string, password: string) {
  const u = normalizeUsername(rawUsername);
  const problem = usernameError(u);
  if (problem) throw appError("app/invalid-username", problem);
  if (await isTaken(u)) throw appError("app/username-taken", "Username sudah dipakai, coba yang lain.");

  const email = placeholderEmail(u);
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
  } catch (e) {
    if ((e as { code?: string }).code?.includes("email-already-in-use")) throw appError("app/username-taken", "Username sudah dipakai, coba yang lain.");
    throw e;
  }
  try {
    await raw.set(`usernames/${u}`, { uid: cred.user.uid, username: u, email } satisfies UsernameDoc);
  } catch {
    // someone claimed it a moment earlier → undo the half-created login
    await cred.user.delete().catch(() => undefined);
    throw appError("app/username-taken", "Username sudah dipakai, coba yang lain.");
  }
  await updateProfile(cred.user, { displayName: name }).catch(() => undefined);
  const account: Account = { id: cred.user.uid, email: "", username: u, name: name.trim() || u, churchIds: [], activeChurchId: null, createdAt: nowISO() };
  await raw.set(`users/${cred.user.uid}`, account);
}

/** "email atau username" → the email(s) Firebase should try to sign in with, in order. */
export async function resolveLoginEmails(identifier: string): Promise<string[]> {
  const s = identifier.trim();
  if (s.includes("@") && !s.startsWith("@")) return [s];
  const u = normalizeUsername(s);
  const doc = await raw.get<UsernameDoc>(`usernames/${u}`);
  if (!doc) throw appError("app/username-not-found", "Username tidak ditemukan. Periksa lagi, atau masuk pakai email.");
  return [doc.email, ...(doc.pendingEmail ? [doc.pendingEmail] : [])];
}

export function hasPassword(user: User) {
  return user.providerData.some((p) => p.providerId === "password");
}

/** Signed in with Google: the email belongs to the Google account, so it isn't changed here. */
export function usesGoogle(user: User) {
  return user.providerData.some((p) => p.providerId === "google.com");
}

/** Accounts made with email or Google add a username. Google-only accounts also create a password. */
export async function addUsername(user: User, account: Account, rawUsername: string, newPassword?: string) {
  const u = normalizeUsername(rawUsername);
  const problem = usernameError(u);
  if (problem) throw appError("app/invalid-username", problem);
  if (account.username) throw appError("app/has-username", "Akun ini sudah punya username.");
  if (!user.email) throw appError("app/no-email", "Akun ini belum punya email login.");
  if (await isTaken(u)) throw appError("app/username-taken", "Username sudah dipakai, coba yang lain.");

  // claim the name first, so a failed password step never leaves a half-done account
  await raw.set(`usernames/${u}`, { uid: user.uid, username: u, email: user.email } satisfies UsernameDoc);
  try {
    if (!hasPassword(user)) {
      if (!newPassword || newPassword.length < 6) throw appError("app/weak-password", "Kata sandi minimal 6 karakter.");
      await linkWithCredential(user, EmailAuthProvider.credential(user.email, newPassword));
    }
  } catch (e) {
    await raw.remove(`usernames/${u}`).catch(() => undefined);
    throw e;
  }
  await raw.update(`users/${user.uid}`, { username: u });
  await updateMemberships(account, { username: u });
}

/**
 * Connect (username-only account) or change (email + password account) the login email.
 * Firebase emails a link to the NEW address; the old login keeps working until it is clicked, then
 * syncLoginEmail copies the new email everywhere. Firebase also mails the old address an undo link.
 */
export async function connectEmail(user: User, account: Account, newEmail: string, currentPassword: string) {
  const email = newEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw appError("app/invalid-email", "Format email tidak benar.");
  if (!user.email) throw appError("app/no-email", "Akun ini belum bisa diubah.");
  if (email === user.email.toLowerCase()) throw appError("app/same-email", "Itu sudah email kamu sekarang.");
  await confirmPassword(user, currentPassword);
  await verifyBeforeUpdateEmail(user, email);
  await raw.update(`users/${user.uid}`, { pendingEmail: email });
  if (account.username) await raw.update(`usernames/${account.username}`, { pendingEmail: email }).catch(() => undefined);
}

/**
 * Run on every sign-in: after the verification link is clicked, Firebase's login email is the real one —
 * copy it to the account, the username lookup and the church memberships.
 */
export async function syncLoginEmail(user: User) {
  if (!user.email || isPlaceholderEmail(user.email)) return;
  const acc = await raw.get<Account>(`users/${user.uid}`);
  if (!acc) return;
  if (acc.username) {
    const m = await raw.get<UsernameDoc>(`usernames/${acc.username}`);
    if (m && m.uid === user.uid && (m.email !== user.email || m.pendingEmail)) {
      await raw.update(`usernames/${acc.username}`, { email: user.email, pendingEmail: null });
    }
  }
  if (acc.email !== user.email || acc.pendingEmail) {
    await raw.update(`users/${user.uid}`, { email: user.email, pendingEmail: null });
    await updateMemberships(acc, { email: user.email });
  }
}

/** Confirm it is really this person (needed before changing username or password). */
async function confirmPassword(user: User, currentPassword: string) {
  if (!user.email || !hasPassword(user)) throw appError("app/no-password", "Akun ini belum punya kata sandi.");
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code.includes("invalid-credential") || code.includes("wrong-password")) throw appError("app/wrong-password", "Kata sandi salah.");
    throw e;
  }
}

/**
 * Change one's own username, verified with the current password.
 * The Firebase login email stays as it is (for username-only accounts that is the placeholder of the FIRST
 * username); usernames/{new} simply points at it, so logging in with the new username works right away.
 * The old name is released from usernames/, but its placeholder email stays tied to this login, so nobody
 * else can register that old name later.
 */
export async function changeUsername(user: User, account: Account, rawUsername: string, currentPassword: string) {
  const u = normalizeUsername(rawUsername);
  const problem = usernameError(u);
  if (problem) throw appError("app/invalid-username", problem);
  const old = account.username;
  if (!old) throw appError("app/no-username", "Akun ini belum punya username.");
  if (u === old) throw appError("app/same-username", "Itu sudah username kamu sekarang.");
  if (!user.email) throw appError("app/no-email", "Akun ini belum bisa diubah.");
  await confirmPassword(user, currentPassword);
  if (await isTaken(u)) throw appError("app/username-taken", "Username sudah dipakai, coba yang lain.");

  const oldDoc = await raw.get<UsernameDoc>(`usernames/${old}`);
  const next: UsernameDoc = { uid: user.uid, username: u, email: user.email };
  if (oldDoc?.pendingEmail) next.pendingEmail = oldDoc.pendingEmail;
  try {
    await raw.set(`usernames/${u}`, next);
  } catch {
    throw appError("app/username-taken", "Username sudah dipakai, coba yang lain.");
  }
  await raw.update(`users/${user.uid}`, { username: u });
  await updateMemberships(account, { username: u });
  if (oldDoc?.uid === user.uid) await raw.remove(`usernames/${old}`).catch(() => undefined);
}

/** Change one's own password: the old one first, then the new one (min. 6 characters). */
export async function changePassword(user: User, currentPassword: string, newPassword: string) {
  if (newPassword.length < 6) throw appError("app/weak-password", "Kata sandi baru minimal 6 karakter.");
  if (newPassword === currentPassword) throw appError("app/same-password", "Kata sandi baru harus berbeda dari yang lama.");
  try {
    await confirmPassword(user, currentPassword);
  } catch (e) {
    if ((e as { code?: string }).code === "app/wrong-password") throw appError("app/wrong-password", "Kata sandi lama salah.");
    throw e;
  }
  await updatePassword(user, newPassword);
}

/* ---------------- Google ---------------- */

/** The Gmail connected to this login, if any. */
export function googleEmail(user: User) {
  return user.providerData.find((p) => p.providerId === "google.com")?.email ?? null;
}

/**
 * Connect a Google account to the SAME login (Profil -> Akun & login), so "Masuk dengan Google" opens this
 * account instead of making a new, empty one. Fails if that Google account already has its own GraceFlow login.
 */
export async function linkGoogle(user: User) {
  if (googleEmail(user)) throw appError("app/google-linked", "Akun Google sudah terhubung.");
  try {
    await linkWithPopup(user, new GoogleAuthProvider());
  } catch (e) {
    const code = (e as { code?: string }).code ?? "";
    if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request") || code.includes("user-cancelled"))
      throw appError("app/cancelled", "");
    if (code.includes("credential-already-in-use") || code.includes("email-already-in-use") || code.includes("account-exists-with-different-credential"))
      throw appError(
        "app/google-used",
        "Akun Google ini sudah dipakai untuk akun GraceFlow lain. Minta Admin gereja menghapus akun itu dulu, lalu coba lagi. Atau pilih akun Google lain.",
      );
    if (code.includes("popup-blocked")) throw appError("app/popup-blocked", "Jendela Google diblokir browser. Izinkan pop-up untuk situs ini, lalu coba lagi.");
    throw e;
  }
}

/** Disconnect Google; only allowed while the account can still log in with a password. */
export async function unlinkGoogle(user: User) {
  if (!hasPassword(user)) throw appError("app/last-login", "Google adalah satu-satunya cara masuk akun ini, jadi tidak bisa dilepas.");
  await unlink(user, "google.com");
}
