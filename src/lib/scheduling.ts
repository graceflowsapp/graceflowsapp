import type { Assignment, Ministry, Service, Slot, UserProfile } from "./types";
import { monthKey, nowISO, todayISO } from "./dates";

export function assignmentId(serviceId: string, ministryId: string, position: string) {
  return `${serviceId}__${ministryId}__${position.replace(/[\/\s]+/g, "-")}`;
}

export function sortServices(a: Service, b: Service) {
  return (a.date + a.time).localeCompare(b.date + b.time);
}

export function isAvailableOn(user: UserProfile, date: string): boolean {
  if (user.available) return true;
  if (user.unavailableUntil && date > user.unavailableUntil) return true;
  return false;
}

/** Availability for "right now", honouring the auto-expiry date. */
export function isAvailableNow(user: UserProfile): boolean {
  return isAvailableOn(user, todayISO());
}

/** General season status + the per-service OFF switch from the Ketersediaan page. */
export function isAvailableForService(user: UserProfile, service: Service): boolean {
  return isAvailableOn(user, service.date) && !(user.unavailableServices ?? []).includes(service.id);
}

export function positionKey(ministryId: string, position: string) {
  return `${ministryId}:${position}`;
}

/** Role switched ON on the Ketersediaan page (default ON). */
export function isPositionOn(user: UserProfile, ministryId: string, position: string) {
  return !(user.disabledPositions ?? []).includes(positionKey(ministryId, position));
}

/** Roles this person can serve in, grouped by ministry (their skills, or every position if no skills set). */
export function rolesFor(user: UserProfile, ministries: Ministry[]) {
  return ministries
    .filter((m) => user.ministries.includes(m.id))
    .map((m) => ({ ministry: m, positions: m.positions.filter((p) => user.skills.length === 0 || user.skills.includes(p)) }))
    .filter((g) => g.positions.length > 0);
}

export function slotsForService(
  service: Service,
  ministries: Ministry[],
  assignmentMap: Map<string, Assignment>,
  onlyMinistries?: string[],
): Slot[] {
  const out: Slot[] = [];
  const ordered = [...ministries].sort((a, b) => a.order - b.order);
  for (const m of ordered) {
    if (!service.ministries.includes(m.id)) continue;
    if (onlyMinistries && !onlyMinistries.includes(m.id)) continue;
    for (const position of m.positions) {
      const id = assignmentId(service.id, m.id, position);
      out.push({ service, ministry: m, position, assignmentId: id, assignment: assignmentMap.get(id) });
    }
  }
  return out;
}

export function isActive(user: UserProfile) {
  return user.active !== false;
}

export function canFill(user: UserProfile, ministryId: string, position: string) {
  return (
    isActive(user) &&
    user.ministries.includes(ministryId) &&
    (user.skills.length === 0 || user.skills.includes(position)) &&
    isPositionOn(user, ministryId, position)
  );
}

/**
 * Assignments that clash with putting `userId` into `service`:
 * same service (double role) or another service on the same date & time.
 */
export function findConflicts(
  userId: string,
  service: Service,
  services: Service[],
  assignments: Assignment[],
  ignoreAssignmentId?: string,
): { assignment: Assignment; service: Service }[] {
  const byId = new Map(services.map((s) => [s.id, s]));
  const out: { assignment: Assignment; service: Service }[] = [];
  for (const a of assignments) {
    if (a.userId !== userId || a.id === ignoreAssignmentId) continue;
    const s = byId.get(a.serviceId);
    if (!s) continue;
    if (s.id === service.id || (s.date === service.date && s.time === service.time)) {
      out.push({ assignment: a, service: s });
    }
  }
  return out;
}

export interface SmartFillInput {
  targetServices: Service[];
  ministryIds: string[];
  ministries: Ministry[];
  users: UserProfile[];
  allServices: Service[];
  assignments: Assignment[];
}

/**
 * Fill empty slots fairly:
 *  1. only people in that ministry, who can play that position and are available on that date
 *  2. never twice in the same service or at the same date & time (no bentrok)
 *  3. prefer whoever has served the least this month, then whoever served longest ago
 */
export function smartFill(input: SmartFillInput): Assignment[] {
  const { targetServices, ministryIds, ministries, users, allServices, assignments } = input;
  const serviceById = new Map(allServices.map((s) => [s.id, s]));
  const working = [...assignments];
  const map = new Map(working.map((a) => [a.id, a]));
  const created: Assignment[] = [];

  const loadFor = (userId: string, month: string) =>
    working.filter((a) => a.userId === userId && monthKey(serviceById.get(a.serviceId)?.date ?? "") === month).length;

  const lastServed = (userId: string, before: string) => {
    let last = "";
    for (const a of working) {
      if (a.userId !== userId) continue;
      const d = serviceById.get(a.serviceId)?.date ?? "";
      if (d < before && d > last) last = d;
    }
    return last;
  };

  for (const service of [...targetServices].sort(sortServices)) {
    const slots = slotsForService(service, ministries, map, ministryIds).filter((s) => !s.assignment?.userId);
    for (const slot of slots) {
      const month = monthKey(service.date);
      const candidates = users
        .filter((u) => canFill(u, slot.ministry.id, slot.position))
        .filter((u) => isAvailableForService(u, service))
        .filter((u) => findConflicts(u.id, service, allServices, working).length === 0)
        .map((u) => ({ u, load: loadFor(u.id, month), last: lastServed(u.id, service.date), r: Math.random() }))
        .sort((a, b) => a.load - b.load || a.last.localeCompare(b.last) || a.r - b.r);

      const pick = candidates[0]?.u;
      if (!pick) continue;
      const a: Assignment = {
        id: slot.assignmentId,
        serviceId: service.id,
        ministryId: slot.ministry.id,
        position: slot.position,
        userId: pick.id,
        status: "pending",
        subRequest: null,
        updatedAt: nowISO(),
      };
      const existingIdx = working.findIndex((w) => w.id === a.id);
      if (existingIdx >= 0) working[existingIdx] = a;
      else working.push(a);
      map.set(a.id, a);
      created.push(a);
    }
  }
  return created;
}

export interface UserStats {
  total: number;
  past: number;
  upcoming: number;
  thisMonth: number;
  byMinistry: { ministryId: string; count: number }[];
  lastServed?: string;
  confirmed: number;
  declined: number;
  pending: number;
}

export function statsFor(userId: string, services: Service[], assignments: Assignment[]): UserStats {
  const byId = new Map(services.map((s) => [s.id, s]));
  const today = todayISO();
  const month = monthKey(today);
  const mine = assignments.filter((a) => a.userId === userId && byId.has(a.serviceId));
  const counts = new Map<string, number>();
  let past = 0;
  let thisMonth = 0;
  let lastServed: string | undefined;
  let confirmed = 0;
  let declined = 0;
  for (const a of mine) {
    if (a.status === "confirmed") confirmed++;
    if (a.status === "declined") declined++;
    const d = byId.get(a.serviceId)!.date;
    if (d < today) {
      past++;
      if (!lastServed || d > lastServed) lastServed = d;
    }
    if (monthKey(d) === month) thisMonth++;
    counts.set(a.ministryId, (counts.get(a.ministryId) ?? 0) + 1);
  }
  return {
    total: mine.length,
    past,
    upcoming: mine.length - past,
    thisMonth,
    byMinistry: [...counts.entries()].map(([ministryId, count]) => ({ ministryId, count })).sort((a, b) => b.count - a.count),
    lastServed,
    confirmed,
    declined,
    pending: mine.length - confirmed - declined,
  };
}
