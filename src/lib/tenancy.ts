"use client";

import { raw } from "./store";
import { nowISO } from "./dates";
import { DEFAULT_MINISTRIES } from "./seed";
import type { Account, AppNotification, Church, UserProfile } from "./types";

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
 * Write order matters for firestore.rules: church → creator's membership → invite code → ministries.
 */
export async function createChurch(account: Account, data: { name: string; city?: string; withDefaultMinistries: boolean }) {
  const id = `${slug(data.name)}-${Math.random().toString(36).slice(2, 6)}`;
  const code = newInviteCode();
  const church: Church = { id, name: data.name.trim(), city: data.city?.trim() || "", accent: null, inviteCode: code, createdBy: account.id, createdAt: nowISO() };
  await raw.set(`churches/${id}`, church);
  await raw.set(`churches/${id}/members/${account.id}`, memberProfile(account, "superadmin"));
  await raw.set(`inviteCodes/${code}`, { code, churchId: id });
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
  const invite = await raw.get<{ churchId: string }>(`inviteCodes/${code}`);
  if (!invite) throw new Error("Kode undangan tidak ditemukan. Periksa lagi atau minta kode baru ke admin gerejamu.");
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
  if (current && !current.deleted && current.active === false) throw new Error(DEACTIVATED_MSG);

  if (!alreadyActive) {
    const rejoining = account.churchIds?.includes(cid) ?? false;
    try {
      await raw.set(memberPath, memberProfile(account, "servant", { joinedWithCode: code }));
    } catch {
      // the rules only refuse this for a membership the admin deactivated (not removed)
      throw new Error(DEACTIVATED_MSG);
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
        const n: AppNotification = {
          id: rid(),
          userId: a.id,
          title: rejoining ? "Anggota bergabung kembali" : "Anggota baru bergabung",
          body: `${account.name} ${rejoining ? "bergabung kembali" : "bergabung"} lewat kode undangan. Atur bidang pelayanannya di menu Admin → Pelayan.`,
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

/** New code; the old one stops working immediately (existing members are unaffected). */
export async function regenerateInviteCode(church: Church) {
  const code = newInviteCode();
  await raw.set(`inviteCodes/${code}`, { code, churchId: church.id });
  await raw.update(`churches/${church.id}`, { inviteCode: code });
  await raw.remove(`inviteCodes/${church.inviteCode}`).catch(() => undefined);
  return code;
}

export function inviteLink(code: string) {
  return `${window.location.origin}/mulai?kode=${code}`;
}
