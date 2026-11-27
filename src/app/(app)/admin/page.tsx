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
import { tr } from "@/lib/i18n";

const SESSIONS = ["Sesi 1", "Sesi 2", "Sesi 3", "Sesi Pagi", "Sesi Sore"];
const LOCATIONS = ["Ruang Ibadah Utama", "Aula Lt. 2", "Ruang Youth", "Online / Live Streaming"];
const LABELS = ["Perjamuan Kudus", "HUT Gereja", "Natal", "Paskah", "Jumat Agung", "Pentakosta", "Baptisan", "Ibadah Gabungan"];

export default function AdminPage() {
  const { me } = useApp();
  const [tab, setTab] = useState<"calendar" | "servants" | "ministries" | "church">("calendar");
  if (me?.role !== "superadmin") {
    return (
      <Card>
        <Empty icon={<Lock size={20} />} title={tr("Khusus Superadmin")} />
      </Card>
    );
  }
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{tr("Admin Gereja")}</h1>
      <div className="grid grid-cols-4 bg-card border border-line rounded-xl p-1 mb-5">
        {[
          ["calendar", tr("Kalender")],
          ["servants", tr("Pelayan")],
          ["ministries", tr("Komisi")],
          ["church", tr("Gereja")],
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
        <button className="p-1.5 rounded-lg hover:bg-card" onClick={() => shift(-1)} aria-label={tr("Bulan sebelumnya")}>
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold capitalize">{formatMonth(cursor.y, cursor.m)}</span>
        <button className="p-1.5 rounded-lg hover:bg-card" onClick={() => shift(1)} aria-label={tr("Bulan berikutnya")}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} /> {tr("Tambah ibadah")}
        </Button>
        <Button variant="secondary" onClick={() => setBulk(true)}>
          <CalendarPlus size={16} /> {tr("Buat rutin bulanan")}
        </Button>
      </div>
      {list.length === 0 ? (
        <Card>
          <Empty icon={<CalendarPlus size={20} />} title={tr("Belum ada ibadah bulan ini")} body={tr("Gunakan “Buat rutin bulanan” untuk membuat ibadah mingguan sekaligus.")} />
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
                  <div className="flex flex-wrap items-center gap-1.5 text-[length:calc(12px*var(--fs))] text-ink-soft mt-0.5">
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
              "inline-flex items-center gap-1.5 min-h-10 rounded-full border px-4 py-2 text-[length:calc(15px*var(--fs))] font-medium active:scale-[.97] transition",
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
      title: tr("Ibadah Umum"),
      session: tr("Sesi 1"),
      location: tr("Ruang Ibadah Utama"),
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
      if (!(await ask({ title: tr("Hapus komisi dari ibadah ini?"), message: tr("{n} pelayan dari {names} akan dikeluarkan dari ibadah ini dan diberi notifikasi.", { n: dropped.length, names }), confirmText: tr("Ya, simpan"), tone: "warning" }))) return;
    }
    await store.set("services", id, { ...form, id, label: form.label || "" });
    for (const a of dropped) {
      await assignSlot({ id: a.id, service: { ...form, id }, ministryId: a.ministryId, position: a.position, userId: null, previousUserId: a.userId });
    }
    celebrate(tr("Ibadah disimpan"));
    onClose();
  };
  const remove = async () => {
    if (!service || !(await ask({ title: tr("Hapus ibadah ini?"), message: tr("Seluruh jadwal pelayan di ibadah ini ikut terhapus."), confirmText: tr("Hapus"), tone: "danger" }))) return;
    await Promise.all(assignments.filter((a) => a.serviceId === service.id).map((a) => store.remove("assignments", a.id)));
    await store.remove("services", service.id);
    toast(tr("Ibadah dihapus"));
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={service ? tr("Ubah ibadah") : tr("Tambah ibadah")}>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("Nama ibadah")}>
          <input className={inputCls} value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label={tr("Sesi")}>
          <input className={inputCls} list="sessions" value={form.session ?? ""} onChange={(e) => set({ session: e.target.value })} placeholder={tr("Sesi 1")} />
          <datalist id="sessions">
            {SESSIONS.map((x) => tr(x)).map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label={tr("Tanggal")} hint={form.date ? formatDateLong(form.date) : undefined}>
        <input type="date" className={inputCls} value={form.date} onChange={(e) => set({ date: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("Jam ibadah")}>
          <input type="time" className={inputCls} value={form.time} onChange={(e) => set({ time: e.target.value })} />
        </Field>
        <Field label={tr("Doa/briefing")}>
          <input type="time" className={inputCls} value={form.briefingTime ?? ""} onChange={(e) => set({ briefingTime: e.target.value })} />
        </Field>
      </div>
      <Field label={tr("Lokasi / ruangan")}>
        <input className={inputCls} list="locations" value={form.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder={tr("Ruang Ibadah Utama")} />
        <datalist id="locations">
          {LOCATIONS.map((x) => tr(x)).map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <Field label={tr("Label ibadah khusus")} hint={tr("Tampil di jadwal semua pelayan & di ekspor WhatsApp.")}>
        <input className={inputCls} list="labels" value={form.label ?? ""} onChange={(e) => set({ label: e.target.value })} placeholder={tr("mis. Perjamuan Kudus")} />
        <datalist id="labels">
          {LABELS.map((x) => tr(x)).map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <div className="mb-3">
        <span className="block text-sm font-medium text-ink-soft mb-2">{tr("Komisi yang bertugas")}</span>
        <MinistryPicker value={form.ministries} onChange={(v) => set({ ministries: v })} />
      </div>
      <Field label={tr("Catatan")}>
        <textarea className={inputCls} rows={2} value={form.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      <div className="flex gap-2 mt-2">
        {service && (
          <Button variant="danger" onClick={remove}>
            <Trash2 size={15} />
          </Button>
        )}
        <Button className="flex-1" onClick={save} disabled={!form.title || !form.date || !form.ministries.length}>
          {tr("Simpan")}
        </Button>
      </div>
    </Modal>
  );
}

function BulkModal({ year, month, onClose }: { year: number; month: number; onClose: () => void }) {
  const { ministries, services } = useApp();
  const [weekday, setWeekday] = useState(0);
  const [title, setTitle] = useState(tr("Ibadah Umum"));
  const [time, setTime] = useState("09:00");
  const [briefing, setBriefing] = useState("07:30");
  const [session, setSession] = useState(tr("Sesi 1"));
  const [location, setLocation] = useState(tr("Ruang Ibadah Utama"));
  const [sel, setSel] = useState<string[]>(ministries.map((m) => m.id));
  const [firstLabel, setFirstLabel] = useState(tr("Perjamuan Kudus"));
  const dates = weekdaysInMonth(year, month, weekday);
  const existing = new Set(services.map((s) => `${s.date}|${s.time}`));
  const toCreate = dates.filter((d) => !existing.has(`${d}|${time}`));

  return (
    <Modal open onClose={onClose} title={tr("Ibadah rutin · {p}", { p: formatMonth(year, month) })}>
      <Field label={tr("Hari")}>
        <select className={inputCls} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
          {[tr("Minggu"), tr("Senin"), tr("Selasa"), tr("Rabu"), tr("Kamis"), tr("Jumat"), tr("Sabtu")].map((d, i) => (
            <option key={d} value={i}>
              {tr("Setiap")} {d}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("Nama ibadah")}>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={tr("Sesi")}>
          <input className={inputCls} list="sessions-bulk" value={session} onChange={(e) => setSession(e.target.value)} />
          <datalist id="sessions-bulk">
            {SESSIONS.map((x) => tr(x)).map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label={tr("Lokasi / ruangan")}>
        <input className={inputCls} list="locations-bulk" value={location} onChange={(e) => setLocation(e.target.value)} />
        <datalist id="locations-bulk">
          {LOCATIONS.map((x) => tr(x)).map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={tr("Jam ibadah")}>
          <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label={tr("Doa/briefing")}>
          <input type="time" className={inputCls} value={briefing} onChange={(e) => setBriefing(e.target.value)} />
        </Field>
      </div>
      <Field label={tr("Label untuk minggu pertama (opsional)")}>
        <input className={inputCls} list="labels-bulk" value={firstLabel} onChange={(e) => setFirstLabel(e.target.value)} />
        <datalist id="labels-bulk">
          {LABELS.map((x) => tr(x)).map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </Field>
      <div className="mb-4">
        <span className="block text-sm font-medium text-ink-soft mb-2">{tr("Komisi yang bertugas")}</span>
        <MinistryPicker value={sel} onChange={setSel} />
      </div>
      <p className="text-[length:calc(13px*var(--fs))] text-ink-soft mb-3">
        {tr("Akan dibuat")} <b>{toCreate.length}</b> {tr("ibadah")}{dates.length > toCreate.length && tr(" ({p} sudah ada, dilewati)", { p: dates.length - toCreate.length })}.
      </p>
      <Button
        className="w-full"
        disabled={!toCreate.length || !sel.length}
        onClick={async () => {
          if (!(await ask({ title: tr("Buat {n} ibadah?", { n: toCreate.length }), message: tr("{title} · {time}, {n} tanggal.", { title, time, n: toCreate.length }), confirmText: tr("Buat") }))) return;
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
          celebrate(tr("{n} ibadah dibuat", { n: items.length }));
          onClose();
        }}
      >
        {tr("Buat ibadah")}
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
        <UserPlus size={16} /> {tr("Tambah akun baru")}
      </Button>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input className={cn(inputCls, "pl-9")} placeholder={tr("Cari pelayan…")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 mb-3">
        {[{ id: "all", name: tr("Semua") }, { id: "coord", name: tr("Koordinator/Admin") }, ...ministries].map((m) => (
          <button
            key={m.id}
            onClick={() => setFilter(m.id)}
            aria-pressed={filter === m.id}
            className={cn("shrink-0 min-h-10 rounded-full border px-4 py-2 text-[length:calc(15px*var(--fs))] font-medium active:scale-[.97] transition", filter === m.id ? "bg-brand text-white border-brand shadow-sm" : "bg-card border-line text-ink")}
          >
            {m.name}
          </button>
        ))}
      </div>
      <SectionTitle>{list.length} {tr("pelayan")}</SectionTitle>
      <Card className="divide-y divide-line">
        {list.map((u) => (
          <button key={u.id} onClick={() => setEditing(u)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface">
            <Avatar name={u.name} src={u.photoUrl} size={38} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-1.5">
                {u.name}
                {u.active === false ? (
                  <Badge className="bg-danger-soft text-danger-ink">{tr("Nonaktif")}</Badge>
                ) : (
                  !isAvailableNow(u) && <Badge className="bg-surface text-ink-soft">{tr("OFF")}</Badge>
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
      {!list.length && <Empty icon={<Search size={20} />} title={tr("Tidak ditemukan")} />}
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
    <Modal open onClose={onClose} title={tr("Kelola pelayan")}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={form.name} src={form.photoUrl} size={48} />
        <div className="min-w-0">
          <div className="font-semibold truncate">{form.name}</div>
          <div className="text-xs text-ink-soft truncate">{displayLogin(form)}</div>
        </div>
      </div>
      <Field label={tr("Nama")}>
        <input className={inputCls} value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label={tr("No. WhatsApp")}>
        <input className={inputCls} value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label={tr("Hak akses")}>
        <select className={inputCls} value={form.role} onChange={(e) => set({ role: e.target.value as Role })} disabled={isSelf}>
          <option value="servant">{tr("Servant — pelayan")}</option>
          <option value="coordinator">{tr("Coordinator — koordinator komisi")}</option>
          <option value="superadmin">{tr("Superadmin — admin gereja")}</option>
        </select>
      </Field>
      <div className="mb-3">
        <span className="block text-sm font-medium text-ink-soft mb-2">{tr("Melayani di komisi")}</span>
        <MinistryPicker value={form.ministries} onChange={(v) => set({ ministries: v })} />
      </div>
      {form.role !== "servant" && (
        <div className="mb-3">
          <span className="block text-sm font-medium text-ink-soft mb-2">{tr("Otoritas koordinator (boleh mengatur jadwal)")}</span>
          <MinistryPicker value={form.coordinatorOf} onChange={(v) => set({ coordinatorOf: v })} />
        </div>
      )}
      {positions.length > 0 && (
        <div className="mb-4">
          <span className="block text-sm font-medium text-ink-soft mb-2">{tr("Posisi yang bisa diisi (kosong = semua)")}</span>
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
                    "inline-flex items-center gap-1 min-h-9 rounded-full border px-3.5 py-1.5 text-[length:calc(14px*var(--fs))] font-medium active:scale-[.97] transition",
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
          toast(tr("Data pelayan disimpan"));
          onClose();
        }}
      >
        {tr("Simpan")}
      </Button>
      {!isSelf && (
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-line">
          <Button
            variant="secondary"
            onClick={async () => {
              const on = user.active === false;
              if (!on && !(await ask({ title: tr("Nonaktifkan {name}?", { name: user.name }), message: tr("Ia tidak bisa masuk dan tugas mendatangnya dikosongkan. Bisa diaktifkan lagi kapan saja."), confirmText: tr("Nonaktifkan"), tone: "warning" }))) return;
              await setAccountActive(user, on, assignments, todayISO(), sDate);
              toast(on ? tr("Akun diaktifkan kembali") : tr("Akun dinonaktifkan"));
              onClose();
            }}
          >
            {user.active === false ? tr("Aktifkan") : tr("Nonaktifkan")}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              if (!(await ask({ title: tr("Hapus akun {name}?", { name: user.name }), message: tr("Tugas mendatangnya akan dikosongkan. Tindakan ini tidak bisa dibatalkan."), confirmText: tr("Hapus akun"), tone: "danger" }))) return;
              await deleteAccount(user, assignments, todayISO(), sDate);
              toast(tr("Akun dihapus"));
              onClose();
            }}
          >
            <Trash2 size={15} /> {tr("Hapus")}
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
    const text = tr("Halo {p}! Akun GraceFlow {p2} kamu sudah dibuat 🙏\n\nBuka: {origin}/login\nUsername: {username}\nKata sandi: {password}\n\nSetelah masuk, hubungkan emailmu di menu Profil → Akun & login.", { p: created.name.split(" ")[0], p2: church?.name ?? "", origin: window.location.origin, username: created.username, password: created.password });
    const wa = created.phone.replace(/\D/g, "").replace(/^0/, "62");
    return (
      <Modal open onClose={onClose} title={tr("Akun berhasil dibuat")}>
        <p className="text-sm text-ink-soft mb-3">{tr("Berikan data masuk ini ke")} {created.name}{tr(". Emailnya bisa ia hubungkan sendiri nanti di Profil.")}</p>
        <div className="rounded-xl bg-brand-soft p-4 space-y-1.5 text-sm">
          <p>
            {tr("Username:")} <b className="font-mono">{created.username}</b>
          </p>
          <p>
            {tr("Kata sandi:")} <b className="font-mono">{created.password}</b>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              toast(tr("Data masuk disalin"));
            }}
          >
            <Copy size={15} /> {tr("Salin")}
          </Button>
          <Button variant="whatsapp" onClick={() => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, "_blank", "noopener")}>
            <MessageCircle size={15} /> {tr("Kirim via WA")}
          </Button>
        </div>
        <Button variant="ghost" className="w-full mt-2" onClick={onClose}>
          {tr("Selesai")}
        </Button>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={tr("Tambah akun baru")}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await createAccount(church!.id, { name: name.trim(), username, password, phone: phone.trim(), role, ministries: ministryIds, coordinatorOf: coordOf });
            celebrate(tr("Akun {name} dibuat", { name }));
            setCreated({ name: name.trim(), username, password, phone: phone.trim() });
          } catch (err) {
            setError(authErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={tr("Nama lengkap")}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <UsernameField value={username} onChange={setUsername} />
        <Field label={tr("Kata sandi awal")} hint={demo ? tr("Mode demo: kata sandi tidak dipakai.") : tr("Minimal 6 karakter. Akan ditampilkan setelah akun dibuat untuk diberikan ke pelayan.")}>
          <input type="text" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
        </Field>
        <Field label={tr("No. WhatsApp")}>
          <input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
        </Field>
        <Field label={tr("Hak akses")}>
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="servant">{tr("Servant — pelayan")}</option>
            <option value="coordinator">{tr("Coordinator — koordinator bidang")}</option>
            <option value="superadmin">{tr("Superadmin — admin gereja")}</option>
          </select>
        </Field>
        <div className="mb-3">
          <span className="block text-sm font-medium text-ink-soft mb-2">{tr("Melayani di bidang")}</span>
          <MinistryPicker value={ministryIds} onChange={setMinistryIds} />
        </div>
        {role !== "servant" && (
          <div className="mb-3">
            <span className="block text-sm font-medium text-ink-soft mb-2">{tr("Koordinator untuk bidang")}</span>
            <MinistryPicker value={coordOf} onChange={setCoordOf} />
          </div>
        )}
        {error && <p className="text-sm text-danger-ink mb-3">{error}</p>}
        <Button className="w-full" disabled={busy || !!usernameError(username) || password.length < 6}>
          <UserPlus size={16} /> {tr("Buat akun")}
        </Button>
        <p className="text-[length:calc(12px*var(--fs))] text-ink-soft text-center mt-2">{tr("Pelayan menghubungkan emailnya sendiri nanti di Profil.")}</p>
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
          <p className="text-[length:calc(14px*var(--fs))] leading-snug">
            <b>{tr("Tahan")}</b> {tr("kartu sebentar sampai terangkat, lalu")} <b>{tr("geser")}</b> {tr("ke posisi baru. Bisa juga pakai tombol panah.")}
          </p>
        </div>
        <SortableList
          items={order}
          getKey={(m) => m.id}
          className="space-y-2"
          label={tr("Urutan komisi")}
          onReorder={(next, { item, to }) => {
            setOrder(next);
            setAnnounce(tr("{name} dipindah ke urutan {p}", { name: item.name, p: to + 1 }));
          }}
          renderItem={(m, h) => (
            <Card className={cn("p-3 flex items-center gap-3", h.dragging ? "border-brand" : "")}>
              <GripVertical size={20} className="shrink-0 text-ink-soft" aria-hidden />
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: m.color }} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{m.name}</div>
                <div className="text-[length:calc(12px*var(--fs))] text-ink-soft">
                  {tr("Urutan")} {h.index + 1} · {m.positions.length} {tr("posisi")}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={h.moveUp}
                  disabled={h.isFirst}
                  aria-label={tr("Naikkan {name}", { name: m.name })}
                  className="h-10 w-10 grid place-items-center rounded-xl border border-line bg-card text-ink disabled:opacity-30 active:scale-95"
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  type="button"
                  onClick={h.moveDown}
                  disabled={h.isLast}
                  aria-label={tr("Turunkan {name}", { name: m.name })}
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
            {tr("Batal")}
          </Button>
          <Button
            disabled={saving || !changed}
            onClick={async () => {
              setSaving(true);
              try {
                await Promise.all(order.map((m, i) => (m.order === i + 1 ? null : store.update("ministries", m.id, { order: i + 1 }))));
                celebrate(tr("Urutan komisi disimpan"));
                setOrder(null);
              } catch (e) {
                toast(tr("Gagal menyimpan: {message}", { message: (e as Error).message }));
              } finally {
                setSaving(false);
              }
            }}
          >
            <Check size={16} /> {tr("Simpan urutan")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_auto] gap-2 mb-4">
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} /> {tr("Tambah komisi")}
        </Button>
        <Button variant="secondary" onClick={() => setOrder(ministries)} disabled={ministries.length < 2}>
          <ArrowUpDown size={16} /> {tr("Ubah urutan")}
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
                  <span className="text-xs text-ink-soft">{members} {tr("anggota")}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {m.positions.map((p) => (
                    <Badge key={p}>{p}</Badge>
                  ))}
                </div>
                <div className="text-[length:calc(12px*var(--fs))] text-ink-soft mt-2">{tr("Koordinator:")} {coords.map((c) => c.name).join(", ") || "—"}</div>
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
    <Modal open onClose={onClose} title={ministry ? tr("Ubah komisi") : tr("Tambah komisi")}>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field label={tr("Nama komisi")}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("mis. Sekolah Minggu")} />
        </Field>
        <Field label={tr("Warna")}>
          <input type="color" className="h-[42px] w-14 rounded-xl border border-line" value={color} onChange={(e) => setColor(e.target.value)} />
        </Field>
      </div>
      <PositionsEditor value={positions} onChange={setPositions} original={ministry?.positions ?? []} draft={draft} setDraft={setDraft} />
      <div className="flex gap-2">
        {ministry && (
          <Button
            variant="danger"
            onClick={async () => {
              if (!(await ask({ title: tr("Hapus komisi {name}?", { name: ministry.name }), message: tr("Posisi dan jadwal komisi ini tidak akan tampil lagi."), confirmText: tr("Hapus"), tone: "danger" }))) return;
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
            toast(tr("Komisi disimpan"));
            onClose();
          }}
        >
          {tr("Simpan")}
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
  const shareText = tr("Halo! Yuk gabung tim pelayanan {name} di GraceFlow 🙏\n\nBuka: {link}\nAtau masukkan kode undangan: *{inviteCode}*", { name: church.name, link, inviteCode: church.inviteCode });

  return (
    <>
      <SectionTitle>{tr("Undang anggota")}</SectionTitle>
      <Card className="p-4">
        <p className="text-[length:calc(13px*var(--fs))] text-ink-soft">{tr("Bagikan kode atau link ini. Orang yang bergabung masuk sebagai")} <b>{tr("Servant")}</b>{tr("; atur bidang & perannya di tab Pelayan.")}</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-brand-soft text-brand text-2xl font-bold tracking-[0.3em] text-center py-3 font-mono">{church.inviteCode}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              toast(tr("Link undangan disalin"));
            }}
          >
            <Copy size={15} /> {tr("Salin link")}
          </Button>
          <Button variant="whatsapp" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener")}>
            <MessageCircle size={15} /> {tr("Kirim via WA")}
          </Button>
        </div>
        <button
          className="mt-3 text-xs text-ink-soft flex items-center gap-1 hover:text-danger-ink"
          onClick={async () => {
            if (!(await ask({ title: tr("Buat kode undangan baru?"), message: tr("Kode lama langsung tidak berlaku. Anggota yang sudah bergabung tidak terpengaruh."), confirmText: tr("Buat kode baru"), tone: "warning" }))) return;
            await regenerateInviteCode(church);
            toast(tr("Kode undangan baru dibuat"));
          }}
        >
          <RefreshCw size={12} /> {tr("Buat kode baru")}
        </button>
      </Card>

      <SectionTitle>{tr("Profil gereja")}</SectionTitle>
      <Card className="p-4">
        <Field label={tr("Nama gereja")}>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={tr("Kota")}>
          <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Button
          className="w-full"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            await updateChurch(church.id, { name: name.trim(), city: city.trim() });
            setBusy(false);
            toast(tr("Profil gereja disimpan"));
          }}
        >
          {tr("Simpan")}
        </Button>
      </Card>

      <SectionTitle>{tr("Warna gereja")}</SectionTitle>
      <Card className="p-4">
        <p className="text-[length:calc(13px*var(--fs))] text-ink-soft mb-3">{tr("Warna aksen default untuk semua anggota. Anggota tetap bisa memilih warnanya sendiri di Profil.")}</p>
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
            title={tr("Warna kustom")}
            className="relative h-9 w-9 rounded-full overflow-hidden border border-line cursor-pointer"
            style={{ background: "conic-gradient(#ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)" }}
          >
            <input type="color" className="absolute inset-0 opacity-0 cursor-pointer" value={church.accent ?? "#0f766e"} onChange={(e) => updateChurch(church.id, { accent: e.target.value })} aria-label={tr("Warna kustom")} />
          </label>
        </div>
      </Card>

      <p className="text-[length:calc(12px*var(--fs))] text-ink-soft mt-4">
        {users.length} {tr("anggota · ID gereja:")} <span className="font-mono">{church.id}</span>
      </p>
    </>
  );
}
