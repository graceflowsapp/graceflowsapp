import type { Account, AppNotification, Assignment, Church, Ministry, Service, UserProfile } from "./types";
import type { DemoDB } from "./store";
import { nowISO, toISODate, weekdaysInMonth } from "./dates";
import { smartFill } from "./scheduling";

export const DEMO_USERS = {
  admin: "u-admin",
  coordinator: "u-coord",
  servant: "u-servant",
};

export const DEFAULT_MINISTRIES: Ministry[] = [
  { id: "pw", name: "Praise & Worship", color: "#7c6bc4", positions: ["Worship Leader", "Singer 1", "Singer 2"], order: 1 },
  { id: "musik", name: "Musik", color: "#c8734f", positions: ["Keyboard", "Gitar", "Bass", "Drum"], order: 2 },
  { id: "multimedia", name: "Multimedia / Production", color: "#3b7fc4", positions: ["Operator Slide", "Sound System", "Kamera"], order: 3 },
  { id: "usher", name: "Usher", color: "#6b8f3a", positions: ["Usher Pintu", "Usher Dalam", "Kolektan"], order: 4 },
  { id: "pbk", name: "PBK Youth", color: "#c25a8e", positions: ["MC", "Pembaca Firman"], order: 5 },
];

type Seed = [id: string, name: string, ministries: string[], skills?: string[]];

const PEOPLE: Seed[] = [
  ["u-servant", "Grace Natalia", ["pw", "pbk"], ["Worship Leader", "Singer 1", "Singer 2", "MC"]],
  ["u-coord", "Andre Wijaya", ["musik"], ["Keyboard", "Gitar"]],
  ["u-admin", "Pdt. Samuel Tandi", []],
  ["u-4", "Kevin Pratama", ["musik"], ["Drum"]],
  ["u-5", "Yohana Lestari", ["pw"], ["Singer 1", "Singer 2"]],
  ["u-6", "Daniel Saputra", ["musik"], ["Bass", "Gitar"]],
  ["u-7", "Maria Pongsibanne", ["pw", "usher"]],
  ["u-8", "Ricky Halim", ["multimedia"], ["Sound System", "Operator Slide"]],
  ["u-9", "Stefani Liong", ["multimedia"], ["Operator Slide", "Kamera"]],
  ["u-10", "Jonathan Rante", ["musik"], ["Keyboard"]],
  ["u-11", "Elisabeth Sampe", ["usher"]],
  ["u-12", "Michael Tanoto", ["usher", "multimedia"], ["Usher Pintu", "Usher Dalam", "Kolektan", "Kamera"]],
  ["u-13", "Priscilla Wong", ["pw"], ["Worship Leader", "Singer 1"]],
  ["u-14", "Timotius Bura", ["musik"], ["Drum", "Bass"]],
  ["u-15", "Ruth Paembonan", ["usher"]],
  ["u-16", "Yosua Kristanto", ["pbk", "multimedia"], ["MC", "Pembaca Firman", "Sound System"]],
  ["u-17", "Debora Simanjuntak", ["pbk"]],
  ["u-18", "Felix Gunawan", ["multimedia"], ["Kamera", "Sound System"]],
  ["u-19", "Natasya Lim", ["usher", "pbk"]],
  ["u-20", "Christian Lolo", ["musik", "pw"], ["Gitar", "Singer 2"]],
];

function buildGiaChurch() {
  const now = nowISO();
  const today = new Date();

  const users: UserProfile[] = PEOPLE.map(([id, name, ministries, skills]) => ({
    id,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@demo.gia`,
    role: id === DEMO_USERS.admin ? "superadmin" : id === DEMO_USERS.coordinator ? "coordinator" : "servant",
    ministries,
    coordinatorOf: id === DEMO_USERS.coordinator ? ["musik"] : id === DEMO_USERS.admin ? DEFAULT_MINISTRIES.map((m) => m.id) : [],
    skills: skills ?? [],
    available: true,
    active: true,
    createdAt: now,
  }));
  // A couple of people in a "season" so Smart Fill skips them
  const off = (id: string, reason: string, days: number) => {
    const u = users.find((x) => x.id === id)!;
    u.available = false;
    u.unavailableReason = reason;
    u.unavailableUntil = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
  };
  off("u-14", "Ujian Kampus", 14);
  off("u-17", "Di Luar Kota", 21);

  const services: Service[] = [];
  for (const offset of [0, 1]) {
    const y = today.getFullYear();
    const m = today.getMonth() + offset;
    const year = new Date(y, m, 1).getFullYear();
    const month = new Date(y, m, 1).getMonth();
    weekdaysInMonth(year, month, 0).forEach((date, i) => {
      services.push({
        id: `svc-${date}-umum`,
        date,
        time: "09:00",
        title: "Ibadah Umum",
        session: "Sesi 1",
        location: "Ruang Ibadah Utama",
        label: i === 0 ? "Perjamuan Kudus" : undefined,
        briefingTime: "07:30",
        ministries: ["pw", "musik", "multimedia", "usher"],
        rehearsals: {
          musik: { at: `${shift(date, -1)}T19:00`, place: "Ruang Musik" },
          pw: { at: `${shift(date, -1)}T19:00`, place: "Ruang Musik" },
        },
      });
    });
    weekdaysInMonth(year, month, 6).forEach((date) => {
      services.push({
        id: `svc-${date}-youth`,
        date,
        time: "18:00",
        title: "Ibadah Youth",
        session: "Sesi Sore",
        location: "Aula Lt. 2",
        briefingTime: "17:00",
        ministries: ["pbk", "musik", "multimedia"],
        rehearsals: { musik: { at: `${date}T15:00`, place: "Aula" } },
      });
    });
  }

  const ministries = DEFAULT_MINISTRIES;
  const thisMonth = services.filter((s) => s.date.slice(0, 7) === toISODate(today).slice(0, 7));
  const assignments: Assignment[] = smartFill({
    targetServices: thisMonth,
    ministryIds: ministries.map((m) => m.id),
    ministries,
    users,
    allServices: services,
    assignments: [],
  });

  // Attendance: past duties confirmed, upcoming ones a realistic mix
  const sDate = new Map(services.map((x) => [x.id, x.date]));
  const todayStr = toISODate(today);
  assignments.forEach((a, i) => {
    a.status = (sDate.get(a.serviceId) ?? "") < todayStr || i % 3 !== 0 ? "confirmed" : "pending";
  });

  // Make sure the demo servant has at least one upcoming duty and one open substitute request to show
  const upcoming = services.filter((s) => s.date >= toISODate(today) && s.ministries.includes("pw"));
  const next = upcoming[0];
  if (next) {
    const id = `${next.id}__pw__Worship-Leader`;
    const a = assignments.find((x) => x.id === id);
    if (a) Object.assign(a, { userId: DEMO_USERS.servant, status: "pending" });
    else assignments.push({ id, serviceId: next.id, ministryId: "pw", position: "Worship Leader", userId: DEMO_USERS.servant, status: "pending", subRequest: null, updatedAt: now });
  }
  const later = upcoming[1];
  if (later) {
    const sub = assignments.find((x) => x.serviceId === later.id && x.ministryId === "pw" && x.userId !== DEMO_USERS.servant);
    if (sub) sub.status = "declined";
    if (sub) sub.subRequest = { reason: "Ada acara keluarga di luar kota", requestedBy: sub.userId!, requestedAt: now };
  }

  const notifications: AppNotification[] = [
    {
      id: "n-welcome",
      userId: DEMO_USERS.servant,
      title: "Selamat datang di GraceFlow 👋",
      body: "Cek jadwal pelayananmu dan atur ketersediaanmu di menu Profil.",
      read: false,
      createdAt: now,
    },
  ];

  return { users, ministries, services, assignments, notifications };
}

function shift(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

/* ---------------- Second, unrelated church (shows tenant isolation) ---------------- */

const KASIH_MINISTRIES: Ministry[] = [
  { id: "pujian", name: "Pujian", color: "#7c6bc4", positions: ["Worship Leader", "Singer"], order: 1 },
  { id: "musik", name: "Musik", color: "#c8734f", positions: ["Keyboard", "Gitar"], order: 2 },
  { id: "penyambut", name: "Penyambut Tamu", color: "#6b8f3a", positions: ["Penyambut 1", "Penyambut 2"], order: 3 },
];

const KASIH_PEOPLE: Seed[] = [
  ["k-admin", "Ibu Ruth Lembang", []],
  ["k-coord", "Yakobus Sampe", ["musik"], ["Keyboard", "Gitar"]],
  ["k-3", "Maria Tangdilintin", ["pujian"]],
  ["k-4", "Paulus Rante", ["musik"], ["Gitar"]],
  ["k-5", "Lidia Patandung", ["penyambut", "pujian"]],
  ["k-6", "Samuel Kondo", ["penyambut"]],
  ["k-7", "Ester Pakiding", ["pujian", "penyambut"]],
  // Grace serves in BOTH churches with the same login → church switcher demo
  [DEMO_USERS.servant, "Grace Natalia", ["pujian"], ["Worship Leader", "Singer"]],
];

function buildKasihChurch() {
  const now = nowISO();
  const today = new Date();
  const users: UserProfile[] = KASIH_PEOPLE.map(([id, name, ministries, skills]) => ({
    id,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@demo.gia`,
    role: id === "k-admin" ? "superadmin" : id === "k-coord" ? "coordinator" : "servant",
    ministries,
    coordinatorOf: id === "k-coord" ? ["musik"] : [],
    skills: skills ?? [],
    available: true,
    active: true,
    createdAt: now,
  }));
  const services: Service[] = [];
  for (const offset of [0, 1]) {
    const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    weekdaysInMonth(first.getFullYear(), first.getMonth(), 0).forEach((date) =>
      services.push({
        id: `svc-${date}-minggu`,
        date,
        time: "10:00",
        title: "Ibadah Minggu",
        session: "Sesi 1",
        location: "Gedung Gereja",
        briefingTime: "09:15",
        ministries: KASIH_MINISTRIES.map((m) => m.id),
      }),
    );
  }
  const month = toISODate(today).slice(0, 7);
  const assignments = smartFill({
    targetServices: services.filter((s) => s.date.slice(0, 7) === month),
    ministryIds: KASIH_MINISTRIES.map((m) => m.id),
    ministries: KASIH_MINISTRIES,
    users,
    allServices: services,
    assignments: [],
  }).map((a, i) => ({ ...a, status: i % 2 ? ("confirmed" as const) : ("pending" as const) }));
  return { users, ministries: KASIH_MINISTRIES, services, assignments, notifications: [] as AppNotification[] };
}

/* ---------------- Demo database ---------------- */

export const DEMO_CHURCHES = [
  {
    id: "gia-makassar",
    name: "GIA Makassar",
    city: "Makassar",
    inviteCode: "GIA123",
    accent: null,
    roles: [
      { uid: DEMO_USERS.servant, title: "Servant", who: "Grace Natalia · PW & PBK (juga anggota gereja kedua)" },
      { uid: DEMO_USERS.coordinator, title: "Coordinator", who: "Andre Wijaya · Musik" },
      { uid: DEMO_USERS.admin, title: "Admin Gereja", who: "Pdt. Samuel Tandi" },
    ],
  },
  {
    id: "kasih-setia",
    name: "Gereja Kasih Setia (contoh)",
    city: "Toraja",
    inviteCode: "KASIH1",
    accent: "#7c3aed",
    roles: [
      { uid: "k-coord", title: "Coordinator", who: "Yakobus Sampe · Musik" },
      { uid: "k-admin", title: "Admin Gereja", who: "Ibu Ruth Lembang" },
    ],
  },
] as const;

export function buildSeed(): DemoDB {
  const now = nowISO();
  const db: DemoDB = {};
  const put = <T extends { id: string }>(col: string, items: T[]) => {
    db[col] ??= {};
    for (const it of items) db[col][it.id] = it as never;
  };
  const accounts = new Map<string, Account>();

  const tenants = [buildGiaChurch(), buildKasihChurch()];
  DEMO_CHURCHES.forEach((c, i) => {
    const data = tenants[i];
    const church: Church = {
      id: c.id,
      name: c.name,
      city: c.city,
      accent: c.accent,
      inviteCode: c.inviteCode,
      createdBy: c.roles[c.roles.length - 1].uid,
      createdAt: now,
    };
    put("churches", [church]);
    put("inviteCodes", [{ id: c.inviteCode, code: c.inviteCode, churchId: c.id }]);
    put(`churches/${c.id}/members`, data.users);
    put(`churches/${c.id}/ministries`, data.ministries);
    put(`churches/${c.id}/services`, data.services);
    put(`churches/${c.id}/assignments`, data.assignments);
    put(`churches/${c.id}/notifications`, data.notifications);
    for (const u of data.users) {
      const acc = accounts.get(u.id) ?? { id: u.id, email: u.email, name: u.name, churchIds: [], activeChurchId: c.id, createdAt: now };
      acc.churchIds.push(c.id);
      accounts.set(u.id, acc);
    }
  });
  put("users", [...accounts.values()]);
  return db;
}
