"use client";

import { store } from "./store";
import type { AppNotification, Assignment, Ministry, MinistryGroup, Service, UserProfile } from "./types";
import { formatDateShort, nowISO } from "./dates";
import { ALL_POSITIONS } from "./scheduling";
import { nm, tr, trIn, type Msg } from "@/lib/i18n";

function rid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function notify(userId: string, title: Msg, body: Msg, link?: string) {
  const n: AppNotification = {
    id: rid(),
    userId,
    title: trIn("id", title.k, title.p),
    body: trIn("id", body.k, body.p),
    i18n: { title, body },
    read: false,
    createdAt: nowISO(),
    link,
  };
  await store.set("notifications", n.id, n);
}

export async function assignSlot(params: {
  id: string;
  service: Service;
  ministryId: string;
  position: string;
  userId: string | null;
  previousUserId?: string | null;
  /** Name of the person who declined this slot, when the coordinator is picking their replacement */
  replacing?: string;
  /** Filled via "Isi dengan grup" */
  groupId?: string | null;
}) {
  const { id, service, ministryId, position, userId, previousUserId, replacing, groupId } = params;
  if (userId === null) {
    await store.remove("assignments", id);
  } else {
    const a: Assignment = { id, serviceId: service.id, ministryId, position, userId, status: "pending", subRequest: null, groupId: groupId ?? null, updatedAt: nowISO() };
    await store.set("assignments", id, a);
  }
  const when = `${service.title} · ${formatDateShort(service.date)} ${service.time}`;
  if (userId && userId !== previousUserId) {
    await notify(userId, nm("Tugas pelayanan baru"), nm("Kamu dijadwalkan sebagai {position} di {when}{p}. Mohon konfirmasi kehadiran.", { position, when, p: replacing ? tr(" (menggantikan {replacing})", { replacing }) : "" }), "/");
  }
  if (previousUserId && previousUserId !== userId) {
    await notify(previousUserId, nm("Jadwal diperbarui"), nm("Kamu tidak lagi bertugas sebagai {position} di {when}.", { position, when }), "/jadwal");
  }
}

export async function saveAssignments(items: Assignment[]) {
  await store.setMany("assignments", items as never);
  const perUser = new Map<string, number>();
  for (const a of items) if (a.userId) perUser.set(a.userId, (perUser.get(a.userId) ?? 0) + 1);
  await Promise.all(
    [...perUser.entries()].map(([uid, n]) =>
      notify(uid, nm("Jadwal pelayanan baru"), nm("Kamu mendapat {n} tugas baru. Cek tab Jadwal.", { n }), "/jadwal"),
    ),
  );
}

function coordinatorsOf(ministryId: string, users: UserProfile[]) {
  return users.filter((u) => u.active !== false && (u.role === "superadmin" || (u.role === "coordinator" && u.coordinatorOf.includes(ministryId))));
}

/** Link that opens Atur Jadwal on the service's date and ministry. */
export function scheduleLink(service: Service, ministryId: string) {
  return `/koordinator?tanggal=${service.date}&komisi=${ministryId}`;
}

/**
 * Servant answers Hadir / Berhalangan — coordinators of that ministry are notified immediately.
 * "Berhalangan" also takes them off the slot (userId → null). The slot keeps the reason in `subRequest`
 * so the coordinator can pick an available replacement (and teammates can still offer to take it).
 */
export async function respondAttendance(params: {
  a: Assignment;
  me: UserProfile;
  service: Service;
  status: "confirmed" | "declined";
  reason?: string;
  users: UserProfile[];
}) {
  const { a, me, service, status, reason, users } = params;
  const when = `${service.title} · ${formatDateShort(service.date)} ${service.time}`;
  await store.update("assignments", a.id, {
    ...(status === "declined" ? { userId: null } : {}),
    status,
    respondedAt: nowISO(),
    subRequest: status === "declined" ? { reason: reason || tr("Berhalangan"), requestedBy: me.id, requestedAt: nowISO() } : null,
    updatedAt: nowISO(),
  });
  const coords = coordinatorsOf(a.ministryId, users).filter((c) => c.id !== me.id);
  await Promise.all(
    coords.map((c) =>
      status === "confirmed"
        ? notify(c.id, nm("✅ {name} hadir", { name: me.name }), nm("Konfirmasi hadir sebagai {position} di {when}.", { position: a.position, when }), "/koordinator")
        : notify(
            c.id,
            nm("❌ {name} berhalangan", { name: me.name }),
            nm("{name} dikeluarkan dari {position} di {when}. Alasan: {p}. Pilih pengganti yang tersedia di Atur Jadwal.", { name: me.name, position: a.position, when, p: reason || "-" }),
            scheduleLink(service, a.ministryId),
          ),
    ),
  );
}

export async function takeSubstitute(a: Assignment, me: UserProfile, service: Service, users: UserProfile[]) {
  const previous = a.subRequest?.requestedBy ?? a.userId;
  await store.update("assignments", a.id, { userId: me.id, status: "confirmed", respondedAt: nowISO(), subRequest: null, updatedAt: nowISO() });
  const when = `${formatDateShort(service.date)} ${service.time}`;
  if (previous) {
    await notify(previous, nm("Pengganti ditemukan 🙌"), nm("{name} akan menggantikanmu sebagai {position} ({when}).", { name: me.name, position: a.position, when }), "/jadwal");
  }
  await Promise.all(
    coordinatorsOf(a.ministryId, users).map((c) => notify(c.id, nm("Pengganti ditemukan"), nm("{name} menggantikan sebagai {position} ({when}).", { name: me.name, position: a.position, when }), "/koordinator")),
  );
}

export async function updateProfile(id: string, data: Partial<UserProfile>) {
  await store.update("users", id, data);
}

export async function markNotificationsRead(ids: string[]) {
  await Promise.all(ids.map((id) => store.update("notifications", id, { read: true })));
}

/* ---------------- Swap: the assigned servant finds their own replacement ---------------- */

const whenOf = (service: Service) => `${service.title} · ${formatDateShort(service.date)} ${service.time}`;

/** "Berhalangan" + ask one available person to take over. The slot stays mine until they accept. */
export async function requestSwap(params: { a: Assignment; me: UserProfile; to: UserProfile; service: Service; reason?: string }) {
  const { a, me, to, service, reason } = params;
  await store.update("assignments", a.id, {
    swapRequest: { from: me.id, to: to.id, reason: reason || tr("Berhalangan"), requestedAt: nowISO() },
    updatedAt: nowISO(),
  });
  await notify(
    to.id,
    nm("🔁 Permintaan tukar jadwal"),
    nm("{name} berhalangan ({p}) dan meminta kamu menggantikan sebagai {position} di {p2}. Terima atau tolak di Beranda.", { name: me.name, p: reason || "-", position: a.position, p2: whenOf(service) }),
    "/",
  );
}

export async function cancelSwap(a: Assignment) {
  const to = a.swapRequest?.to;
  await store.update("assignments", a.id, { swapRequest: null, updatedAt: nowISO() });
  if (to) await notify(to, nm("Permintaan tukar dibatalkan"), nm("Permintaan untuk menggantikan sebagai {position} sudah dibatalkan.", { position: a.position }), "/");
}

/** The asked person accepts: they take the slot (confirmed); the requester and coordinators are told. */
export async function acceptSwap(a: Assignment, me: UserProfile, service: Service, users: UserProfile[]) {
  const from = a.swapRequest?.from ?? a.userId;
  await store.update("assignments", a.id, {
    userId: me.id,
    status: "confirmed",
    respondedAt: nowISO(),
    swapRequest: null,
    subRequest: null,
    updatedAt: nowISO(),
  });
  const fromName = users.find((u) => u.id === from)?.name ?? tr("Pelayan");
  if (from) await notify(from, nm("Tukar jadwal diterima 🙌"), nm("{name} menggantikanmu sebagai {position} di {p}.", { name: me.name, position: a.position, p: whenOf(service) }), "/jadwal");
  await Promise.all(
    coordinatorsOf(a.ministryId, users)
      .filter((c) => c.id !== me.id)
      .map((c) => notify(c.id, nm("🔁 Tukar jadwal"), nm("{name} menggantikan {fromName} sebagai {position} di {p}.", { name: me.name, fromName, position: a.position, p: whenOf(service) }), scheduleLink(service, a.ministryId))),
  );
}

/** The asked person can't either: the requester must pick someone else. */
export async function rejectSwap(a: Assignment, me: UserProfile, service: Service) {
  const from = a.swapRequest?.from;
  await store.update("assignments", a.id, { swapRequest: null, updatedAt: nowISO() });
  if (from) {
    await notify(from, nm("Tukar jadwal ditolak"), nm("{name} tidak bisa menggantikan sebagai {position} di {p}. Pilih pengganti lain.", { name: me.name, position: a.position, p: whenOf(service) }), "/jadwal");
  }
}

/** Coordinators save the groups of one komisi. */
export async function saveGroups(ministryId: string, groups: MinistryGroup[]) {
  await store.update("ministries", ministryId, { groups });
}

/** Coordinator (Peran → Anggota) adds someone to a komisi they coordinate, and tells them. */
export async function addToMinistry(user: UserProfile, ministry: Ministry) {
  if (user.ministries.includes(ministry.id)) return;
  await store.update("users", user.id, { ministries: [...user.ministries, ministry.id] });
  await notify(user.id, nm("Kamu ditambahkan ke {name}", { name: ministry.name }), nm("Koordinator menambahkanmu sebagai anggota {name}. Jadwalmu akan muncul di menu Jadwal.", { name: ministry.name }), "/jadwal");
}

/**
 * Coordinator sets which posisi someone fills in their komisi (Peran → Anggota).
 * Choosing every posisi is stored as ["*"], so posisi added later are included and Admin's global list no longer limits it.
 */
export async function setMinistryPositions(user: UserProfile, ministry: Ministry, positions: string[]) {
  const all = ministry.positions.every((p) => positions.includes(p));
  const value = all ? [ALL_POSITIONS] : ministry.positions.filter((p) => positions.includes(p));
  await store.update("users", user.id, { positionsByMinistry: { ...(user.positionsByMinistry ?? {}), [ministry.id]: value } });
}

/** Coordinator removes someone from a komisi. Their existing schedule in it stays until the coordinator changes it. */
export async function removeFromMinistry(user: UserProfile, ministry: Ministry) {
  await store.update("users", user.id, { ministries: user.ministries.filter((id) => id !== ministry.id) });
}
