"use client";

import { store } from "./store";
import type { AppNotification, Assignment, Service, UserProfile } from "./types";
import { formatDateShort, nowISO } from "./dates";

function rid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function notify(userId: string, title: string, body: string, link?: string) {
  const n: AppNotification = { id: rid(), userId, title, body, read: false, createdAt: nowISO(), link };
  await store.set("notifications", n.id, n);
}

export async function assignSlot(params: {
  id: string;
  service: Service;
  ministryId: string;
  position: string;
  userId: string | null;
  previousUserId?: string | null;
}) {
  const { id, service, ministryId, position, userId, previousUserId } = params;
  if (userId === null) {
    await store.remove("assignments", id);
  } else {
    const a: Assignment = { id, serviceId: service.id, ministryId, position, userId, status: "pending", subRequest: null, updatedAt: nowISO() };
    await store.set("assignments", id, a);
  }
  const when = `${service.title} · ${formatDateShort(service.date)} ${service.time}`;
  if (userId && userId !== previousUserId) {
    await notify(userId, "Tugas pelayanan baru", `Kamu dijadwalkan sebagai ${position} di ${when}. Mohon konfirmasi kehadiran.`, "/");
  }
  if (previousUserId && previousUserId !== userId) {
    await notify(previousUserId, "Jadwal diperbarui", `Kamu tidak lagi bertugas sebagai ${position} di ${when}.`, "/jadwal");
  }
}

export async function saveAssignments(items: Assignment[]) {
  await store.setMany("assignments", items as never);
  const perUser = new Map<string, number>();
  for (const a of items) if (a.userId) perUser.set(a.userId, (perUser.get(a.userId) ?? 0) + 1);
  await Promise.all(
    [...perUser.entries()].map(([uid, n]) =>
      notify(uid, "Jadwal pelayanan baru", `Kamu mendapat ${n} tugas baru. Cek tab Jadwal.`, "/jadwal"),
    ),
  );
}

function coordinatorsOf(ministryId: string, users: UserProfile[]) {
  return users.filter((u) => u.active !== false && (u.role === "superadmin" || (u.role === "coordinator" && u.coordinatorOf.includes(ministryId))));
}

/** Servant answers Hadir / Berhalangan — coordinators of that ministry are notified immediately. */
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
    status,
    respondedAt: nowISO(),
    subRequest: status === "declined" ? { reason: reason || "Berhalangan", requestedBy: me.id, requestedAt: nowISO() } : null,
    updatedAt: nowISO(),
  });
  const coords = coordinatorsOf(a.ministryId, users).filter((c) => c.id !== me.id);
  await Promise.all(
    coords.map((c) =>
      status === "confirmed"
        ? notify(c.id, `✅ ${me.name} hadir`, `Konfirmasi hadir sebagai ${a.position} di ${when}.`, "/koordinator")
        : notify(c.id, `❌ ${me.name} berhalangan`, `${a.position} di ${when} butuh pengganti. Alasan: ${reason || "-"}`, "/koordinator"),
    ),
  );
}

export async function takeSubstitute(a: Assignment, me: UserProfile, service: Service, users: UserProfile[]) {
  const previous = a.userId;
  await store.update("assignments", a.id, { userId: me.id, status: "confirmed", respondedAt: nowISO(), subRequest: null, updatedAt: nowISO() });
  const when = `${formatDateShort(service.date)} ${service.time}`;
  if (previous) {
    await notify(previous, "Pengganti ditemukan 🙌", `${me.name} akan menggantikanmu sebagai ${a.position} (${when}).`, "/jadwal");
  }
  await Promise.all(
    coordinatorsOf(a.ministryId, users).map((c) => notify(c.id, "Pengganti ditemukan", `${me.name} menggantikan sebagai ${a.position} (${when}).`, "/koordinator")),
  );
}

export async function updateProfile(id: string, data: Partial<UserProfile>) {
  await store.update("users", id, data);
}

export async function markNotificationsRead(ids: string[]) {
  await Promise.all(ids.map((id) => store.update("notifications", id, { read: true })));
}
