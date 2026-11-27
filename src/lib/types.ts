export type Role = "servant" | "coordinator" | "superadmin";

/** A tenant. Every church's data lives under churches/{id}/... and is invisible to other churches. */
export interface Church {
  id: string;
  name: string;
  city?: string;
  /** Default accent colour for members of this church (members can still override it on their device) */
  accent?: string | null;
  /** Code new members type to join. Also stored in inviteCodes/{code} for lookup. */
  inviteCode: string;
  createdBy: string;
  createdAt: string;
}

/** Global login account (users/{uid}). Church-specific role & data live in churches/{cid}/members/{uid}. */
export interface Account {
  id: string;
  /** Real email, or "" for an account created with only a username (until an email is connected). */
  email: string;
  /** Login username (lowercase, unique via usernames/{username}). */
  username?: string;
  /** Email waiting for the user to click Firebase's verification link. */
  pendingEmail?: string | null;
  name: string;
  churchIds: string[];
  activeChurchId?: string | null;
  createdAt: string;
}

/** A person's membership in ONE church (churches/{cid}/members/{uid}). Called "users" inside the app. */
export interface UserProfile {
  id: string;
  name: string;
  /** "" when the person signed up with a username only */
  email: string;
  username?: string;
  phone?: string;
  photoUrl?: string;
  role: Role;
  /** Ministry ids this person serves in */
  ministries: string[];
  /** Ministry ids this person coordinates (only meaningful for coordinator/superadmin) */
  coordinatorOf: string[];
  /** Optional: positions this person can fill, e.g. ["Keyboard", "Drum"]. Empty = any position. */
  skills: string[];
  /** Posisi per komisi, set by that komisi's coordinator (Peran → Anggota). Wins over `skills` for that komisi.
   *  ["*"] = every posisi; missing or [] = not set (Admin's global `skills` apply). */
  positionsByMinistry?: Record<string, string[]>;
  available: boolean;
  /** Season of life, e.g. "Ujian Kampus", "Cuti", "Di Luar Kota" */
  unavailableReason?: string;
  /** YYYY-MM-DD — availability automatically counts as ON after this date */
  unavailableUntil?: string;
  /** Service ids this person switched OFF on the Ketersediaan page */
  unavailableServices?: string[];
  /** Roles switched OFF, as `${ministryId}:${position}` */
  disabledPositions?: string[];
  /** false = account deactivated by Superadmin (cannot sign in, never scheduled) */
  active?: boolean;
  /** Soft-deleted (Firebase mode) — hidden everywhere */
  deleted?: boolean;
  /** Invite code used to join (checked by firestore.rules) */
  joinedWithCode?: string;
  createdAt: string;
}

/** One seat of a group: who fills which posisi when the group is scheduled. */
export interface MinistryGroupSlot {
  position: string;
  userId: string;
}

/** A fixed team inside a komisi (e.g. "Singer Grup A", "Choir B"), scheduled in one go by the coordinator. */
export interface MinistryGroup {
  id: string;
  name: string;
  slots: MinistryGroupSlot[];
}

export interface Ministry {
  id: string;
  name: string;
  color: string;
  positions: string[];
  order: number;
  /** Managed by the komisi's coordinators (Atur Jadwal → Grup). */
  groups?: MinistryGroup[];
}

export interface Rehearsal {
  at: string; // datetime-local string "YYYY-MM-DDTHH:mm"
  place?: string;
}

export interface Service {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string; // "Ibadah Umum"
  session?: string; // "Sesi 1", "Sesi Pagi"
  location?: string; // "Ruang Ibadah Utama", "Aula Lt. 2"
  label?: string; // "Perjamuan Kudus", "HUT GIA"
  briefingTime?: string; // HH:mm — jam doa / briefing
  ministries: string[]; // ministry ids that serve in this service
  rehearsals?: Record<string, Rehearsal>; // per ministry id
  notes?: string;
}

export interface SubRequest {
  reason: string;
  requestedBy: string;
  requestedAt: string;
}

/** Servant's response to an assignment */
/** The assigned servant can't come and asks a specific available person to take over the slot. */
export interface SwapRequest {
  from: string;
  to: string;
  reason: string;
  requestedAt: string;
}

export type AttendanceStatus = "pending" | "confirmed" | "declined";

export interface Assignment {
  /** Deterministic: `${serviceId}__${ministryId}__${position}` */
  id: string;
  serviceId: string;
  ministryId: string;
  position: string;
  userId: string | null;
  status?: AttendanceStatus; // missing = pending
  respondedAt?: string;
  /** Set when the servant answers "Berhalangan" — teammates can offer to replace */
  subRequest?: SubRequest | null;
  /** Pending "please replace me" request to one person; the slot stays with `userId` until they accept. */
  swapRequest?: SwapRequest | null;
  /** Set when the slot was filled with "Isi dengan grup" (label only; the person is still in userId). */
  groupId?: string | null;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link?: string;
  /** Translatable title/body (see lib/i18n nm); title/body above hold the Indonesian text. */
  i18n?: { title: { k: string; p?: Record<string, string> }; body: { k: string; p?: Record<string, string> } };
}

export type CollectionName =
  | "users"
  | "ministries"
  | "services"
  | "assignments"
  | "notifications";

export interface Slot {
  service: Service;
  ministry: Ministry;
  position: string;
  assignmentId: string;
  assignment?: Assignment;
}
