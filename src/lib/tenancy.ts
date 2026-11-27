"use client";

import { raw } from "./store";
import { nowISO } from "./dates";
import { DEFAULT_MINISTRIES } from "./seed";
import type { Account, AppNotification, Church, UserProfile } from "./types";
import { nm, tr, trIn } from "@/lib/i18n";

// No 0/O/1/I so codes are easy to read aloud and type
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newInviteCode(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "gereja";
}

function rid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function memberProfile(account: Account, role: UserProfile["role"], extra: Partial<UserProfile> = {}): UserProfile {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    ...(account.username ? { username: account.username } : {}),
    role,
    ministries: [],
    coordinatorOf: [],
    skills: [],
    available: true,
    active: true,
    createdAt: nowISO(),
    ...extra,
  };
}

async function addChurchToAccount(account: Account, churchId: string) {
  await raw.update(`users/${account.id}`, {
    churchIds: [...new Set([...(account.churchIds ?? []), churchId])],
    activeChurchId: churchId,
  });
}

/**
 * Registers a new, independent church. The creator becomes its Admin (superadmin).
 * Write order matters for firestore.rules: church → creator's membership → ministries.
 */
export async function createChurch(account: Account, data: { name: string; city?: string; withDefaultMinistries: boolean }) {
  const id = `${slug(data.name)}-${Math.random().toString(36).slice(2, 6)}`;
  // No invite code yet: the Admin opens one, for a limited time, when someone wants to join (Admin → Gereja).
  const church: Church = { id, name: data.name.trim(), city: data.city?.trim() || "", accent: null, inviteCode: "", inviteExpiresAtMs: null, createdBy: account.id, createdAt: nowISO() };
  await raw.set(`churches/${id}`, church);
  await raw.set(`churches/${id}/members/${account.id}`, memberProfile(account, "superadmin"));
  if (data.withDefaultMinistries) await raw.setMany(`churches/${id}/ministries`, DEFAULT_MINISTRIES as never);
  await addChurchToAccount(account, id);
  return id;
}

/**
 * Joins a church with its invite code as a Servant. The church's admins get a notification.
 * Also works for someone the admin removed earlier: their old (soft-deleted) membership is replaced by a
 * fresh Servant membership. Don't trust account.churchIds here: a removed member still has the church in
 * that list, because admins can't edit another person's account doc.
 */
export async function joinChurch(account: Account, rawCode: string) {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const invite = code ? await raw.get<{ churchId: string; expiresAtMs?: number | null }>(`inviteCodes/${code}`) : null;
  if (!invite) throw new Error(tr("Kode undangan tidak ditemukan. Periksa lagi atau minta kode baru ke admin gerejamu."));
  if (invite.expiresAtMs && Date.now() >= invite.expiresAtMs)
    throw new Error(tr("Kode undangan ini sudah tidak berlaku. Minta admin gerejamu membuka kode baru."));
  const cid = invite.churchId;
  const memberPath = `churches/${cid}/members/${account.id}`;

  // Firestore only lets ACTIVE members read their membership, so "no access" = not (or no longer) a member.
  let current: UserProfile | null = null;
  try {
    current = await raw.get<UserProfile>(memberPath);
  } catch {
    current = null;
  }
  const alreadyActive = !!current && !current.deleted && current.active !== false;
  if (current && !current.deleted && current.active === false) throw new Error(tr(DEACTIVATED_MSG));

  if (!alreadyActive) {
    const rejoining = account.churchIds?.includes(cid) ?? false;
    try {
      await raw.set(memberPath, memberProfile(account, "servant", { joinedWithCode: code }));
    } catch {
      // the rules only refuse this for a membership the admin deactivated (not removed)
      throw new Error(tr(DEACTIVATED_MSG));
    }
    // now a member → allowed to read members and notify the admins
    const admins = await new Promise<UserProfile[]>((resolve) => {
      const unsub = raw.subscribeCol<UserProfile>(`churches/${cid}/members`, (items) => {
        resolve(items.filter((m) => m.role === "superadmin" && m.active !== false && !m.deleted));
        queueMicrotask(() => unsub());
      });
    });
    await Promise.all(
      admins.map((a) => {
        const title = nm(rejoining ? "Anggota bergabung kembali" : "Anggota baru bergabung");
        const body = nm(
          rejoining
            ? "{name} bergabung kembali lewat kode undangan. Atur bidang pelayanannya di menu Admin → Pelayan."
            : "{name} bergabung lewat kode undangan. Atur bidang pelayanannya di menu Admin → Pelayan.",
          { name: account.name },
        );
        const n: AppNotification = {
          id: rid(),
          userId: a.id,
          title: trIn("id", title.k, title.p),
          body: trIn("id", body.k, body.p),
          i18n: { title, body },
          read: false,
          createdAt: nowISO(),
          link: "/admin",
        };
        return raw.set(`churches/${cid}/notifications/${n.id}`, n);
      }),
    );
  }
  await addChurchToAccount(account, cid);
  return cid;
}

const DEACTIVATED_MSG = "Akunmu di gereja ini sedang dinonaktifkan oleh admin. Minta admin gereja untuk mengaktifkannya kembali.";

export async function switchChurch(account: Account, churchId: string) {
  await raw.update(`users/${account.id}`, { activeChurchId: churchId });
}

export async function updateChurch(churchId: string, data: Partial<Pick<Church, "name" | "city" | "accent">>) {
  await raw.update(`churches/${churchId}`, data);
}

/** How long an opened invite code stays valid (Admin → Gereja → Undang anggota). */
export const INVITE_DURATIONS = [
  { hours: 1, label: "1 jam" },
  { hours: 24, label: "1 hari" },
  { hours: 24 * 7, label: "7 hari" },
] as const;

/** Is the church's invite code usable right now? */
export function inviteIsOpen(church: Church, now = Date.now()) {
  return !!church.inviteCode && (church.inviteExpiresAtMs == null || now < church.inviteExpiresAtMs);
}

/**
 * Opens a NEW code for `hours` (an old code never comes back). firestore.rules refuse joins after inviteExpiresAtMs.
 * Existing members are unaffected.
 */
export async function openInviteCode(church: Church, hours: number) {
  const code = newInviteCode();
  const expiresAtMs = Date.now() + hours * 3_600_000;
  await raw.set(`inviteCodes/${code}`, { code, churchId: church.id, expiresAtMs });
  await raw.update(`churches/${church.id}`, { inviteCode: code, inviteExpiresAtMs: expiresAtMs });
  if (church.inviteCode) await raw.remove(`inviteCodes/${church.inviteCode}`).catch(() => undefined);
  return code;
}

/** Closes the code now; nobody can join until the Admin opens a new one. */
export async function closeInviteCode(church: Church) {
  await raw.update(`churches/${church.id}`, { inviteCode: "", inviteExpiresAtMs: null });
  if (church.inviteCode) await raw.remove(`inviteCodes/${church.inviteCode}`).catch(() => undefined);
}

export function inviteLink(code: string) {
  return `${window.location.origin}/mulai?kode=${code}`;
}
