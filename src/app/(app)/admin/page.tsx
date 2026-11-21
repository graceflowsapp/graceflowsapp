"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical, Copy, Lock, MessageCircle, Pencil, Plus, RefreshCw, Search, Trash2, UserPlus } from "lucide-react";
import { useApp } from "@/components/providers";
import { Avatar, Badge, Button, Card, Empty, Field, Modal, SectionTitle, cn, inputCls, toast } from "@/components/ui";
import { ServiceLabel, serviceLine } from "@/components/duty";
import { createAccount, deleteAccount, setAccountActive } from "@/lib/accounts";
import { store } from "@/lib/store";
import { assignSlot } from "@/lib/actions";
import { inviteLink, regenerateInviteCode, updateChurch } from "@/lib/tenancy";
import { ACCENT_PRESETS } from "@/lib/theme";
import { formatDateLong, formatMonth, monthKey, todayISO, weekdaysInMonth } from "@/lib/dates";
import { isAvailableNow } from "@/lib/scheduling";
import type { Ministry, Role, Service, UserProfile } from "@/lib/types";
import { ask, celebrate } from "@/lib/feedback";
import { authErrorMessage, displayLogin, usernameError } from "@/lib/username";
import { UsernameField } from "@/components/UsernameField";
import { PositionsEditor } from "@/components/PositionsEditor";
import { SortableList } from "@/components/SortableList";

const SESSIONS = ["Sesi 1", "Sesi 2", "Sesi 3", "Sesi Pagi", "Sesi Sore"];
const LOCATIONS = ["Ruang Ibadah Utama", "Aula Lt. 2", "Ruang Youth", "Online / Live Streaming"];
const LABELS = ["Perjamuan Kudus", "HUT Gereja", "Natal", "Paskah", "Jumat Agung", "Pentakosta", "Baptisan", "Ibadah Gabungan"];

export default function AdminPage() {
  const { me } = useApp();
  const [tab, setTab] = useState<"calendar" | "servants" | "ministries" | "church">("calendar");
  if (me?.role !== "superadmin") {
    return (
      <Card>
        <Empty icon={<Lock size={20} />} title="Khusus Superadmin" />
      </Card>
    );
  }
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Admin Gereja</h1>
      <div className="grid grid-cols-4 bg-card border border-line rounded-xl p-1 mb-5">
        {[
          ["calendar", "Kalender"],
          ["servants", "Pelayan"],
          ["ministries", "Komisi"],
          ["church", "Gereja"],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} className={cn("rounded-lg py-2 text-sm font-medium", tab === k ? "bg-brand text-white" : "text-ink-soft")}>
            {label}
          </button>
        ))}
      </div>
      {tab === "calendar" && <CalendarAdmin />}
      {tab === "servants" && <ServantsAdmin />}
      {tab === "ministries" && <MinistriesAdmin />}
      {tab === "church" && <ChurchSettings />}
    </div>
  );
}

/* ---------------- Calendar ---------------- */

function CalendarAdmin() {
  const { services, ministries, assignments } = useApp();
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [bulk, setBulk] = useState(false);
  const month = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}`;
  const list = services.filter((s) => monthKey(s.date) === month);
  const shift = (d: number) => {
    const n = new Date(cursor.y, cursor.m + d, 1);
    setCursor({ y: n.getFullYear(), m: n.getMonth() });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <button className="p-1.5 rounded-lg hover:bg-card" onClick={() => shift(-1)} aria-label="Bulan sebelumnya">
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold capitalize">{formatMonth(cursor.y, cursor.m)}</span>
        <button className="p-1.5 rounded-lg hover:bg-card" onClick={() => shift(1)} aria-label="Bulan berikutnya">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} /> Tambah ibadah
        </Button>
        <Button variant="secondary" onClick={() => setBulk(true)}>
          <CalendarPlus size={16} /> Buat rutin bulanan
        </Button>
      </div>
      {list.length === 0 ? (
        <Card>
          <Empty icon={<CalendarPlus size={20} />} title="Belum ada ibadah bulan ini" body="Gunakan “Buat rutin bulanan” untuk membuat ibadah mingguan sekaligus." />
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {list.map((s) => {
            const filled = assignments.filter((a) => a.serviceId === s.id && a.userId).length;
            const total = ministries.filter((m) => s.ministries.includes(m.id)).reduce((n, m) => n + m.positions.length, 0);
            return (
              <button key={s.id} onClick={() => setEditing(s)} className="w-full text-left px-4 py-3 hover:bg-surface flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{formatDateLong(s.date)}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-soft mt-0.5">
                    {serviceLine(s)}
                    {s.location && <span>· {s.location}</span>} <ServiceLabel label={s.label} />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {s.ministries.map((id) => {
                      const m = ministries.find((x) => x.id === id);
                      return m ? <span key={id} className="h-1.5 w-5 rounded-full" style={{ background: m.color }} title={m.name} /> : null;
                    })}
                  </div>
                </div>
                <span className={cn("text-xs font-semibold", filled === total ? "text-success" : "text-warning-ink")}>
                  {filled}/{total}
                </span>
                <Pencil size={14} className="text-ink-soft" />
              </button>
            );
          })}
        </Card>
      )}
      {editing && <ServiceModal service={editing === "new" ? undefined : editing} defaultDate={`${month}-01`} onClose={() => setEditing(null)} />}
      {bulk && <BulkModal year={cursor.y} month={cursor.m} onClose={() => setBulk(false)} />}
    </>
  );
}

function MinistryPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { ministries } = useApp();
  return (
    <div className="flex flex-wrap gap-2.5">
      {ministries.map((m) => {
        const on = value.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])}
            aria-pressed={on}
            className={cn(
              "inline-flex items-center gap-1.5 min-h-10 rounded-full border px-4 py-2 text-[15px] font-medium active:scale-[.97] transition",
              on ? "text-white border-transparent shadow-sm" : "bg-card border-line text-ink",
            )}
            style={on ? { background: m.color } : undefined}
          >
            {on ? <Check size={16} strokeWidth={3} aria-hidden /> : <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: m.color }} aria-hidden />}
            {m.name}
          </button>
        );
      })}
    </div>
  );
}

function ServiceModal({ service, defaultDate, onClose }: { service?: Service; defaultDate: string; onClose: () => void }) {
  const { ministries, assignments } = useApp();
  const [form, setForm] = useState<Service>(
    service ?? {
      id: "",
      date: defaultDate,
      time: "09:00",
      title: "Ibadah Umum",
      session: "Sesi 1",
      location: "Ruang Ibadah Utama",
      briefingTime: "07:30",
      ministries: ministries.map((m) => m.id),
    },
  );
  const set = (p: Partial<Service>) => setForm((f) => ({ ...f, ...p }));

  const save = async () => {
    const id = service?.id ?? `svc-${form.date}-${form.time.replace(":", "")}-${Math.random().toString(36).slice(2, 6)}`;
    // komisi unticked from an existing ibadah: their people would stay scheduled but invisible (and still clash)
    const dropped = service ? assignments.filter((a) => a.serviceId === service.id && a.userId && !form.ministries.includes(a.ministryId)) : [];
    if (dropped.length) {
      const names = [...new Set(dropped.map((a) => ministries.find((m) => m.id === a.ministryId)?.name ?? a.ministryId))].join(", ");
      if (!(await ask({ title: "Hapus komisi dari ibadah ini?", message: `${dropped.length} pelayan dari ${names} akan dikeluarkan dari ibadah ini dan diberi notifikasi.`, confirmText: "Ya, simpan", tone: "warning" }))) return;
    }
    await store.set("services", id, { ...form, id, label: form.label || "" });
    for (const a of dropped) {
      await assignSlot({ id: a.id, service: { ...form, id }, ministryId: a.ministryId, position: a.position, userId: null, previousUserId: a.userId });
    }
    celebrate("Ibadah disimpan");
    onClose();
  };
  const remove = async () => {
    if (!service || !(await ask({ title: "Hapus ibadah ini?", message: "Seluruh jadwal pelayan di ibadah ini ikut terhapus.", confirmText: "Hapus", tone: "danger" }))) return;
    await Promise.all(assignments.filter((a) => a.serviceId === service.id).map((a) => store.remove("assignments", a.id)));
    await store.remove("services", service.id);
    toast("Ibadah dihapus");
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={service ? "Ubah ibadah" : "Tambah ibadah"}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nama ibadah">
          <input className={inputCls} value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Sesi">
          <input className={inputCls} list="sessions" value={form.session ?? ""} onChange={(e) => set({ session: e.target.value })} placeholder="Sesi 1" />
          <datalist id="sessions">
            {SESSIONS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Tanggal" hint={form.date ? formatDateLong(form.date) : undefined}>
        <input type="date" className={inputCls} value={form.date} onChange={(e) => set({ date: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jam ibadah">
          <input type="time" className={inputCls} value={form.time} onChange={(e) => set({ time: e.target.value })} />
        </Field>
        <Field label="Doa/briefing">
          <input type="time" className={inputCls} value={form.briefingTime ?? ""} onChange={(e) => set({ briefingTime: e.target.value })} />
        </Field>
      </div>
      <Field label="Lokasi / ruangan">
        <input className={inputCls} list="locations" value={form.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder="Ruang Ibadah Utama" />
        <datalist id="locations">
          {LOCATIONS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <Field label="Label ibadah khusus" hint="Tampil di jadwal semua pelayan & di ekspor WhatsApp.">
        <input className={inputCls} list="labels" value={form.label ?? ""} onChange={(e) => set({ label: e.target.value })} placeholder="mis. Perjamuan Kudus" />
        <datalist id="labels">
          {LABELS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <div className="mb-3">
        <span className="block text-sm font-medium text-ink-soft mb-2">Komisi yang bertugas</span>
        <MinistryPicker value={form.ministries} onChange={(v) => set({ ministries: v })} />
      </div>
      <Field label="Catatan">
        <textarea className={inputCls} rows={2} value={form.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      <div className="flex gap-2 mt-2">
        {service && (
          <Button variant="danger" onClick={remove}>
            <Trash2 size={15} />
          </Button>
        )}
        <Button className="flex-1" onClick={save} disabled={!form.title || !form.date || !form.ministries.length}>
          Simpan
        </Button>
      </div>
    </Modal>
  );
}

function BulkModal({ year, month, onClose }: { year: number; month: number; onClose: () => void }) {
  const { ministries, services } = useApp();
  const [weekday, setWeekday] = useState(0);
  const [title, setTitle] = useState("Ibadah Umum");
  const [time, setTime] = useState("09:00");
  const [briefing, setBriefing] = useState("07:30");
  const [session, setSession] = useState("Sesi 1");
  const [location, setLocation] = useState("Ruang Ibadah Utama");
  const [sel, setSel] = useState<string[]>(ministries.map((m) => m.id));
  const [firstLabel, setFirstLabel] = useState("Perjamuan Kudus");
  const dates = weekdaysInMonth(year, month, weekday);
  const existing = new Set(services.map((s) => `${s.date}|${s.time}`));
  const toCreate = dates.filter((d) => !existing.has(`${d}|${time}`));

  return (
    <Modal open onClose={onClose} title={`Ibadah rutin · ${formatMonth(year, month)}`}>
      <Field label="Hari">
        <select className={inputCls} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
          {["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"].map((d, i) => (
            <option key={d} value={i}>
              Setiap {d}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Nama ibadah">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Sesi">
          <input className={inputCls} list="sessions-bulk" value={session} onChange={(e) => setSession(e.target.value)} />
          <datalist id="sessions-bulk">
            {SESSIONS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Lokasi / ruangan">
        <input className={inputCls} list="locations-bulk" value={location} onChange={(e) => setLocation(e.target.value)} />
        <datalist id="locations-bulk">
          {LOCATIONS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jam ibadah">
          <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Doa/briefing">
          <input type="time" className={inputCls} value={briefing} onChange={(e) => setBriefing(e.target.value)} />
        </Field>
      </div>
      <Field label="Label untuk minggu pertama (opsional)">
        <input className={inputCls} list="labels-bulk" value={firstLabel} onChange={(e) => setFirstLabel(e.target.value)} />
        <datalist id="labels-bulk">
          {LABELS.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <div className="mb-4">
        <span className="block text-sm font-medium text-ink-soft mb-2">Komisi yang bertugas</span>
        <MinistryPicker value={sel} onChange={setSel} />
      </div>
      <p className="text-[13px] text-ink-soft mb-3">
        Akan dibuat <b>{toCreate.length}</b> ibadah{dates.length > toCreate.length && ` (${dates.length - toCreate.length} sudah ada, dilewati)`}.
      </p>
      <Button
        className="w-full"
        disabled={!toCreate.length || !sel.length}
        onClick={async () => {
          if (!(await ask({ title: `Buat ${toCreate.length} ibadah?`, message: `${title} · ${time}, ${toCreate.length} tanggal.`, confirmText: "Buat" }))) return;
          const items: Service[] = toCreate.map((date) => ({
            id: `svc-${date}-${time.replace(":", "")}-${Math.random().toString(36).slice(2, 6)}`,
            date,
            time,
            title,
            session,
            location,
            briefingTime: briefing,
            ministries: sel,
            label: date === dates[0] ? firstLabel : "",
          }));
          await store.setMany("services", items as never);
          celebrate(`${items.length} ibadah dibuat`);
          onClose();
        }}
      >
        Buat ibadah
      </Button>
    </Modal>
  );
}

/* ---------------- Servants ---------------- */

function ServantsAdmin() {
  const { users, ministries } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [adding, setAdding] = useState(false);
  const list = useMemo(
    () =>
      users.filter(
        (u) => (filter === "all" || u.ministries.includes(filter) || (filter === "coord" && u.role !== "servant")) && u.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [users, q, filter],
  );

  return (
    <>
      <Button className="w-full mb-3" onClick={() => setAdding(true)}>
        <UserPlus size={16} /> Tambah akun baru
      </Button>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input className={cn(inputCls, "pl-9")} placeholder="Cari pelayan…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 mb-3">
        {[{ id: "all", name: "Semua" }, { id: "coord", name: "Koordinator/Admin" }, ...ministries].map((m) => (
          <button
            key={m.id}
            onClick={() => setFilter(m.id)}
            aria-pressed={filter === m.id}
            className={cn("shrink-0 min-h-10 rounded-full border px-4 py-2 text-[15px] font-medium active:scale-[.97] transition", filter === m.id ? "bg-brand text-white border-brand shadow-sm" : "bg-card border-line text-ink")}
          >
            {m.name}
          </button>
        ))}
      </div>
      <SectionTitle>{list.length} pelayan</SectionTitle>
      <Card className="divide-y divide-line">
        {list.map((u) => (
          <button key={u.id} onClick={() => setEditing(u)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface">
            <Avatar name={u.name} src={u.photoUrl} size={38} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                {u.name}
                {u.active === false ? (
                  <Badge className="bg-danger-soft text-danger-ink">Nonaktif</Badge>
                ) : (
                  !isAvailableNow(u) && <Badge className="bg-surface text-ink-soft">OFF</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {u.role !== "servant" && <Badge className="bg-brand-soft text-brand capitalize">{u.role}</Badge>}
                {u.ministries.map((id) => {
                  const m = ministries.find((x) => x.id === id);
                  return m ? (
                    <Badge key={id} color={m.color}>
                      {m.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
            <Pencil size={14} className="text-ink-soft" />
          </button>
        ))}
      </Card>
      {!list.length && <Empty icon={<Search size={20} />} title="Tidak ditemukan" />}
      {editing && <UserModal user={editing} onClose={() => setEditing(null)} />}
      {adding && <AddAccountModal onClose={() => setAdding(false)} />}
    </>
  );
}

function UserModal({ user, onClose }: { user: UserProfile; onClose: () => void }) {
  const { ministries, me, assignments, services } = useApp();
  const sDate = (id: string) => services.find((s) => s.id === id)?.date ?? "";
  const isSelf = user.id === me?.id;
  const [form, setForm] = useState<UserProfile>(user);
  const set = (p: Partial<UserProfile>) => setForm((f) => ({ ...f, ...p }));
  const positions = ministries.filter((m) => form.ministries.includes(m.id)).flatMap((m) => m.positions);

  return (
    <Modal open onClose={onClose} title="Kelola pelayan">
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={form.name} src={form.photoUrl} size={48} />
        <div className="min-w-0">
          <div className="font-semibold truncate">{form.name}</div>
          <div className="text-xs text-ink-soft truncate">{displayLogin(form)}</div>
        </div>
      </div>
      <Field label="Nama">
        <input className={inputCls} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="No. WhatsApp">
        <input className={inputCls} value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label="Hak akses">
        <select className={inputCls} value={form.role} onChange={(e) => set({ role: e.target.value as Role })} disabled={isSelf}>
          <option value="servant">Servant — pelayan</option>
          <option value="coordinator">Coordinator — koordinator komisi</option>
          <option value="superadmin">Superadmin — admin gereja</option>
        </select>
      </Field>
      <div className="mb-3">
        <span className="block text-sm font-medium text-ink-soft mb-2">Melayani di komisi</span>
        <MinistryPicker value={form.ministries} onChange={(v) => set({ ministries: v })} />
      </div>
      {form.role !== "servant" && (
        <div className="mb-3">
          <span className="block text-sm font-medium text-ink-soft mb-2">Otoritas koordinator (boleh mengatur jadwal)</span>
          <MinistryPicker value={form.coordinatorOf} onChange={(v) => set({ coordinatorOf: v })} />
        </div>
      )}
      {positions.length > 0 && (
        <div className="mb-4">
          <span className="block text-sm font-medium text-ink-soft mb-2">Posisi yang bisa diisi (kosong = semua)</span>
          <div className="flex flex-wrap gap-2">
            {[...new Set(positions)].map((p) => {
              const on = form.skills.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => set({ skills: on ? form.skills.filter((x) => x !== p) : [...form.skills, p] })}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex items-center gap-1 min-h-9 rounded-full border px-3.5 py-1.5 text-[14px] font-medium active:scale-[.97] transition",
                    on ? "border-brand bg-brand-soft text-brand" : "border-line text-ink",
                  )}
                >
                  {on && <Check size={14} strokeWidth={3} aria-hidden />}
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Button
        className="w-full"
        onClick={async () => {
          const { id, ...rest } = form;
          await store.update("users", id, rest);
          toast("Data pelayan disimpan");
          onClose();
        }}
      >
        Simpan
      </Button>
      {!isSelf && (
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-line">
          <Button
            variant="secondary"
            onClick={async () => {
              const on = user.active === false;
              if (!on && !(await ask({ title: `Nonaktifkan ${user.name}?`, message: "Ia tidak bisa masuk dan tugas mendatangnya dikosongkan. Bisa diaktifkan lagi kapan saja.", confirmText: "Nonaktifkan", tone: "warning" }))) return;
              await setAccountActive(user, on, assignments, todayISO(), sDate);
              toast(on ? "Akun diaktifkan kembali" : "Akun dinonaktifkan");
              onClose();
            }}
          >
            {user.active === false ? "Aktifkan" : "Nonaktifkan"}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!(await ask({ title: `Hapus akun ${user.name}?`, message: "Tugas mendatangnya akan dikosongkan. Tindakan ini tidak bisa dibatalkan.", confirmText: "Hapus akun", tone: "danger" }))) return;
              await deleteAccount(user, assignments, todayISO(), sDate);
              toast("Akun dihapus");
              onClose();
            }}
          >
            <Trash2 size={15} /> Hapus
          </Button>
        </div>
      )}
    </Modal>
  );
}

function AddAccountModal({ onClose }: { onClose: () => void }) {
  const { demo, church } = useApp();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("servant");
  const [ministryIds, setMinistryIds] = useState<string[]>([]);
  const [coordOf, setCoordOf] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ name: string; username: string; password: string; phone: string } | null>(null);

  if (created) {
    const text = `Halo ${created.name.split(" ")[0]}! Akun GraceFlow ${church?.name ?? ""} kamu sudah dibuat 🙏

Buka: ${window.location.origin}/login
Username: ${created.username}
Kata sandi: ${created.password}

Setelah masuk, hubungkan emailmu di menu Profil → Akun & login.`;
    const wa = created.phone.replace(/\D/g, "").replace(/^0/, "62");
    return (
      <Modal open onClose={onClose} title="Akun berhasil dibuat">
        <p className="text-sm text-ink-soft mb-3">Berikan data masuk ini ke {created.name}. Emailnya bisa ia hubungkan sendiri nanti di Profil.</p>
        <div className="rounded-xl bg-brand-soft p-4 space-y-1.5 text-sm">
          <p>
            Username: <b className="font-mono">{created.username}</b>
          </p>
          <p>
            Kata sandi: <b className="font-mono">{created.password}</b>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              toast("Data masuk disalin");
            }}
          >
            <Copy size={15} /> Salin
          </Button>
          <Button variant="whatsapp" onClick={() => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, "_blank", "noopener")}>
            <MessageCircle size={15} /> Kirim via WA
          </Button>
        </div>
        <Button variant="ghost" className="w-full mt-2" onClick={onClose}>
          Selesai
        </Button>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Tambah akun baru">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await createAccount(church!.id, { name: name.trim(), username, password, phone: phone.trim(), role, ministries: ministryIds, coordinatorOf: coordOf });
            celebrate(`Akun ${name} dibuat`);
            setCreated({ name: name.trim(), username, password, phone: phone.trim() });
          } catch (err) {
            setError(authErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nama lengkap">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <UsernameField value={username} onChange={setUsername} />
        <Field label="Kata sandi awal" hint={demo ? "Mode demo: kata sandi tidak dipakai." : "Minimal 6 karakter. Akan ditampilkan setelah akun dibuat untuk diberikan ke pelayan."}>
          <input type="text" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
        </Field>
        <Field label="No. WhatsApp">
          <input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
        </Field>
        <Field label="Hak akses">
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="servant">Servant — pelayan</option>
            <option value="coordinator">Coordinator — koordinator bidang</option>
            <option value="superadmin">Superadmin — admin gereja</option>
          </select>
        </Field>
        <div className="mb-3">
          <span className="block text-sm font-medium text-ink-soft mb-2">Melayani di bidang</span>
          <MinistryPicker value={ministryIds} onChange={setMinistryIds} />
        </div>
        {role !== "servant" && (
          <div className="mb-3">
            <span className="block text-sm font-medium text-ink-soft mb-2">Koordinator untuk bidang</span>
            <MinistryPicker value={coordOf} onChange={setCoordOf} />
          </div>
        )}
        {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
        <Button className="w-full" disabled={busy || !!usernameError(username) || password.length < 6}>
          <UserPlus size={16} /> Buat akun
        </Button>
        <p className="text-[12px] text-ink-soft text-center mt-2">Pelayan menghubungkan emailnya sendiri nanti di Profil.</p>
      </form>
    </Modal>
  );
}

/* ---------------- Ministries ---------------- */

function MinistriesAdmin() {
  const { ministries, users } = useApp();
  const [editing, setEditing] = useState<Ministry | "new" | null>(null);
  /** Reorder mode: a local copy of the list, saved only on "Simpan urutan". */
  const [order, setOrder] = useState<Ministry[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [announce, setAnnounce] = useState("");

  if (order) {
    const changed = order.some((m, i) => m.id !== ministries[i]?.id);
    return (
      <>
        <div className="rounded-2xl bg-brand-soft text-brand px-4 py-3 mb-4 flex items-start gap-3">
          <GripVertical size={20} className="shrink-0 mt-0.5" aria-hidden />
          <p className="text-[14px] leading-snug">
            <b>Tahan</b> kartu sebentar sampai terangkat, lalu <b>geser</b> ke posisi baru. Bisa juga pakai tombol panah.
          </p>
        </div>
        <SortableList
          items={order}
          getKey={(m) => m.id}
          className="space-y-2"
          label="Urutan komisi"
          onReorder={(next, { item, to }) => {
            setOrder(next);
            setAnnounce(`${item.name} dipindah ke urutan ${to + 1}`);
          }}
          renderItem={(m, h) => (
            <Card className={cn("p-3 flex items-center gap-3", h.dragging ? "border-brand" : "")}>
              <GripVertical size={20} className="shrink-0 text-ink-soft" aria-hidden />
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: m.color }} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{m.name}</div>
                <div className="text-[12px] text-ink-soft">
                  Urutan {h.index + 1} · {m.positions.length} posisi
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={h.moveUp}
                  disabled={h.isFirst}
                  aria-label={`Naikkan ${m.name}`}
                  className="h-10 w-10 grid place-items-center rounded-xl border border-line bg-card text-ink disabled:opacity-30 active:scale-95"
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  type="button"
                  onClick={h.moveDown}
                  disabled={h.isLast}
                  aria-label={`Turunkan ${m.name}`}
                  className="h-10 w-10 grid place-items-center rounded-xl border border-line bg-card text-ink disabled:opacity-30 active:scale-95"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            </Card>
          )}
        />
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
        <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-surface/90 backdrop-blur p-1">
          <Button variant="secondary" onClick={() => setOrder(null)} disabled={saving}>
            Batal
          </Button>
          <Button
            disabled={saving || !changed}
            onClick={async () => {
              setSaving(true);
              try {
                await Promise.all(order.map((m, i) => (m.order === i + 1 ? null : store.update("ministries", m.id, { order: i + 1 }))));
                celebrate("Urutan komisi disimpan");
                setOrder(null);
              } catch (e) {
                toast(`Gagal menyimpan: ${(e as Error).message}`);
              } finally {
                setSaving(false);
              }
            }}
          >
            <Check size={16} /> Simpan urutan
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-2 mb-4">
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} /> Tambah komisi
        </Button>
        <Button variant="secondary" onClick={() => setOrder(ministries)} disabled={ministries.length < 2}>
          <ArrowUpDown size={16} /> Ubah urutan
        </Button>
      </div>
      <div className="space-y-2">
        {ministries.map((m) => {
          const members = users.filter((u) => u.ministries.includes(m.id)).length;
          const coords = users.filter((u) => u.role !== "servant" && u.coordinatorOf.includes(m.id) && u.role !== "superadmin");
          return (
            <button key={m.id} className="w-full text-left" onClick={() => setEditing(m)}>
              <Card className="p-4 hover:border-brand">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: m.color }} />
                  <span className="font-semibold flex-1">{m.name}</span>
                  <span className="text-xs text-ink-soft">{members} anggota</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.positions.map((p) => (
                    <Badge key={p}>{p}</Badge>
                  ))}
                </div>
                <div className="text-[12px] text-ink-soft mt-2">Koordinator: {coords.map((c) => c.name).join(", ") || "—"}</div>
              </Card>
            </button>
          );
        })}
      </div>
      {editing && <MinistryModal ministry={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function MinistryModal({ ministry, onClose }: { ministry?: Ministry; onClose: () => void }) {
  const { ministries } = useApp();
  const [name, setName] = useState(ministry?.name ?? "");
  const [color, setColor] = useState(ministry?.color ?? "#14a08f");
  const [positions, setPositions] = useState<string[]>(ministry?.positions ?? []);
  const [draft, setDraft] = useState("");
  const typed = draft.trim().replace(/s+/g, " ");
  const finalPositions = typed && !positions.some((p) => p.toLowerCase() === typed.toLowerCase()) ? [...positions, typed] : positions;

  return (
    <Modal open onClose={onClose} title={ministry ? "Ubah komisi" : "Tambah komisi"}>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field label="Nama komisi">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Sekolah Minggu" />
        </Field>
        <Field label="Warna">
          <input type="color" className="h-[42px] w-14 rounded-xl border border-line" value={color} onChange={(e) => setColor(e.target.value)} />
        </Field>
      </div>
      <PositionsEditor value={positions} onChange={setPositions} original={ministry?.positions ?? []} draft={draft} setDraft={setDraft} />
      <div className="flex gap-2">
        {ministry && (
          <Button
            variant="danger"
            onClick={async () => {
              if (!(await ask({ title: `Hapus komisi ${ministry.name}?`, message: "Posisi dan jadwal komisi ini tidak akan tampil lagi.", confirmText: "Hapus", tone: "danger" }))) return;
              await store.remove("ministries", ministry.id);
              onClose();
            }}
          >
            <Trash2 size={15} />
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!name.trim() || finalPositions.length === 0}
          onClick={async () => {
            const id = ministry?.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            const data: Ministry = {
              ...(ministry ?? {}), // keeps the coordinators' groups
              id,
              name: name.trim(),
              color,
              positions: finalPositions,
              order: ministry?.order ?? ministries.length + 1,
            };
            await store.set("ministries", id, data);
            toast("Komisi disimpan");
            onClose();
          }}
        >
          Simpan
        </Button>
      </div>
    </Modal>
  );
}

/* ---------------- Church settings & invites ---------------- */

function ChurchSettings() {
  const { church, users } = useApp();
  const [name, setName] = useState(church?.name ?? "");
  const [city, setCity] = useState(church?.city ?? "");
  const [busy, setBusy] = useState(false);
  if (!church) return null;
  const link = inviteLink(church.inviteCode);
  const shareText = `Halo! Yuk gabung tim pelayanan ${church.name} di GraceFlow 🙏

Buka: ${link}
Atau masukkan kode undangan: *${church.inviteCode}*`;

  return (
    <>
      <SectionTitle>Undang anggota</SectionTitle>
      <Card className="p-4">
        <p className="text-[13px] text-ink-soft">Bagikan kode atau link ini. Orang yang bergabung masuk sebagai <b>Servant</b>; atur bidang & perannya di tab Pelayan.</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-brand-soft text-brand text-2xl font-bold tracking-[0.3em] text-center py-3 font-mono">{church.inviteCode}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              toast("Link undangan disalin");
            }}
          >
            <Copy size={15} /> Salin link
          </Button>
          <Button variant="whatsapp" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener")}>
            <MessageCircle size={15} /> Kirim via WA
          </Button>
        </div>
        <button
          className="mt-3 text-xs text-ink-soft flex items-center gap-1 hover:text-danger-ink"
          onClick={async () => {
            if (!(await ask({ title: "Buat kode undangan baru?", message: "Kode lama langsung tidak berlaku. Anggota yang sudah bergabung tidak terpengaruh.", confirmText: "Buat kode baru", tone: "warning" }))) return;
            await regenerateInviteCode(church);
            toast("Kode undangan baru dibuat");
          }}
        >
          <RefreshCw size={12} /> Buat kode baru
        </button>
      </Card>

      <SectionTitle>Profil gereja</SectionTitle>
      <Card className="p-4">
        <Field label="Nama gereja">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Kota">
          <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Button
          className="w-full"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            await updateChurch(church.id, { name: name.trim(), city: city.trim() });
            setBusy(false);
            toast("Profil gereja disimpan");
          }}
        >
          Simpan
        </Button>
      </Card>

      <SectionTitle>Warna gereja</SectionTitle>
      <Card className="p-4">
        <p className="text-[13px] text-ink-soft mb-3">Warna aksen default untuk semua anggota. Anggota tetap bisa memilih warnanya sendiri di Profil.</p>
        <div className="flex flex-wrap gap-2.5">
          {ACCENT_PRESETS.map((a) => {
            const selected = (church.accent ?? null) === a.value;
            return (
              <button
                key={a.name}
                title={a.name}
                aria-label={a.name}
                aria-pressed={selected}
                onClick={() => updateChurch(church.id, { accent: a.value })}
                className={cn("h-9 w-9 rounded-full ring-offset-2 ring-offset-card", selected && "ring-2 ring-ink")}
                style={{ background: a.value ?? "#0f766e" }}
              />
            );
          })}
          <label
            title="Warna kustom"
            className="relative h-9 w-9 rounded-full overflow-hidden border border-line cursor-pointer"
            style={{ background: "conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)" }}
          >
            <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={church.accent ?? "#0f766e"} onChange={(e) => updateChurch(church.id, { accent: e.target.value })} aria-label="Warna kustom" />
          </label>
        </div>
      </Card>

      <p className="text-[12px] text-ink-soft mt-4">
        {users.length} anggota · ID gereja: <span className="font-mono">{church.id}</span>
      </p>
    </>
  );
}
