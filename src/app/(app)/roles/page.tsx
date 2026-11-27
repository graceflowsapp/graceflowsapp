"use client";

/**
 * "Peran": coordinators manage the komisi they coordinate.
 * - Posisi: only `positions` changes on the komisi (firestore.rules lets its coordinators update positions & groups).
 * - Anggota: adds/removes this komisi in members' `ministries` (rules: only komisi the coordinator owns),
 *   and sets which posisi each member fills in it (`positionsByMinistry[komisi]`).
 * Name, colour and deleting a komisi stay with the church Admin.
 */
import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Tags, UserMinus, Users } from "lucide-react";
import { SearchField, matchesName } from "@/components/SearchField";
import { useApp, useCoordinatedMinistries } from "@/components/providers";
import { Avatar, Badge, Button, Card, Empty, Modal, cn, toast } from "@/components/ui";
import { PersonPicker } from "@/components/PersonPicker";
import { PositionsEditor } from "@/components/PositionsEditor";
import { store } from "@/lib/store";
import { addToMinistry, removeFromMinistry, setMinistryPositions } from "@/lib/actions";
import { positionsFor } from "@/lib/scheduling";
import { ask, celebrate } from "@/lib/feedback";
import { todayISO } from "@/lib/dates";
import type { Ministry, UserProfile } from "@/lib/types";
import { tr } from "@/lib/i18n";

const isCurrent = (u: UserProfile) => u.active !== false && !u.deleted;

export default function RolesPage() {
  const { users } = useApp();
  const mine = useCoordinatedMinistries();
  const [editing, setEditing] = useState<Ministry | null>(null);
  const [membersOfId, setMembersOfId] = useState<string | null>(null);
  // read the komisi from the live list so the modal follows changes
  const membersOf = mine.find((m) => m.id === membersOfId) ?? null;

  if (!mine.length) {
    return (
      <Card>
        <Empty icon={<Tags size={20} />} title={tr("Belum ada komisi yang kamu koordinasi")} body={tr("Minta Admin gereja memberi akses koordinator.")} />
      </Card>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">{tr("Peran")}</h1>
      <p className="text-[length:calc(14px*var(--fs))] text-ink-soft mb-4">{tr("Atur posisi dan anggota di komisi yang kamu koordinasi.")}</p>

      <div className="space-y-3">
        {mine.map((m) => {
          const count = users.filter((u) => isCurrent(u) && u.ministries.includes(m.id)).length;
          return (
            <Card key={m.id} className="overflow-hidden">
              {/* the card itself opens the posisi editor */}
              <button type="button" onClick={() => setEditing(m)} aria-label={tr("Ubah posisi {name}", { name: m.name })} className="w-full p-4 text-left transition hover:bg-surface/60 active:bg-surface">
                <div className="flex items-center gap-3 mb-3">
                  <span className="h-10 w-10 shrink-0 rounded-xl grid place-items-center text-white" style={{ background: m.color }}>
                    <Tags size={19} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[length:max(16px,calc(16px*var(--fs)))] font-semibold truncate">{m.name}</div>
                    <div className="text-[length:calc(13px*var(--fs))] text-ink-soft">{m.positions.length} {tr("posisi")}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-brand-soft text-brand px-3 py-1.5 text-[length:calc(13px*var(--fs))] font-semibold">
                    <Pencil size={13} /> {tr("Ubah")}
                  </span>
                </div>
                {m.positions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {m.positions.map((p, i) => (
                      <Badge key={p} className="bg-surface text-ink text-[length:calc(14px*var(--fs))] px-3 py-1">
                        <span className="text-ink-soft mr-1">{i + 1}.</span>
                        {p}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[length:calc(14px*var(--fs))] text-ink-soft">{tr("Belum ada posisi. Ketuk untuk menambahkan.")}</p>
                )}
              </button>
              {/* separate button: the komisi's members */}
              <button
                type="button"
                onClick={() => setMembersOfId(m.id)}
                className="w-full flex items-center gap-3 border-t border-line px-4 py-3 text-left transition hover:bg-surface/60 active:bg-surface"
              >
                <MemberStrip ministry={m} />
                <span className="flex-1 min-w-0 text-[length:calc(15px*var(--fs))] font-semibold">
                  <Users size={15} className="inline -mt-0.5 mr-1.5 text-ink-soft" />
                  {count ? tr("{n} anggota", { n: count }) : tr("Belum ada anggota")}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[length:calc(13px*var(--fs))] font-semibold text-brand shrink-0">
                  {tr("Anggota")} <ChevronRight size={16} />
                </span>
              </button>
            </Card>
          );
        })}
      </div>

      {editing && <RolesModal ministry={editing} onClose={() => setEditing(null)} />}
      {membersOf && <MembersModal ministry={membersOf} onClose={() => setMembersOfId(null)} />}
    </div>
  );
}

function RolesModal({ ministry, onClose }: { ministry: Ministry; onClose: () => void }) {
  const { assignments, services } = useApp();
  const [positions, setPositions] = useState<string[]>(ministry.positions);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const typed = draft.trim().replace(/\s+/g, " ");
  const finalPositions = typed && !positions.some((p) => p.toLowerCase() === typed.toLowerCase()) ? [...positions, typed] : positions;

  // upcoming schedule that would disappear with a removed posisi
  const removed = ministry.positions.filter((p) => !finalPositions.includes(p));
  const today = todayISO();
  const sDate = new Map(services.map((s) => [s.id, s.date]));
  const affected = assignments.filter((a) => a.ministryId === ministry.id && removed.includes(a.position) && a.userId && (sDate.get(a.serviceId) ?? "") >= today).length;

  const save = async () => {
    if (affected > 0 && !(await ask({ title: tr("Simpan perubahan posisi?"), message: tr("{affected} jadwal mendatang memakai posisi {p} dan tidak akan tampil lagi.", { affected, p: removed.join(", ") }), confirmText: tr("Simpan"), tone: "warning" }))) return;
    setBusy(true);
    try {
      await store.update("ministries", ministry.id, { positions: finalPositions });
      celebrate(tr("Posisi disimpan"));
      toast(tr("Posisi {name} diperbarui", { name: ministry.name }));
      onClose();
    } catch (e) {
      toast(tr("Gagal menyimpan: {message}", { message: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={tr("Posisi {name}", { name: ministry.name })}>
      <PositionsEditor value={positions} onChange={setPositions} original={ministry.positions} draft={draft} setDraft={setDraft} />
      {affected > 0 && (
        <p className="rounded-xl bg-warning-soft text-warning-ink text-[length:calc(13px*var(--fs))] px-3 py-2 mb-3">
          {affected} {tr("jadwal mendatang memakai posisi yang dihapus (")}{removed.join(", ")}{tr(") dan tidak akan tampil lagi.")}
        </p>
      )}
      <Button className="w-full" disabled={busy || finalPositions.length === 0} onClick={save}>
        {tr("Simpan")}
      </Button>
    </Modal>
  );
}

/** Overlapping faces of the komisi's members, so the card shows who is in it at a glance. */
function MemberStrip({ ministry }: { ministry: Ministry }) {
  const { users } = useApp();
  const members = users.filter((u) => isCurrent(u) && u.ministries.includes(ministry.id));
  if (!members.length) return null;
  const shown = members.slice(0, 4);
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="flex -space-x-1.5">
        {shown.map((u) => (
          <Avatar key={u.id} name={u.name} src={u.photoUrl} size={32} className="ring-2 ring-card text-[length:calc(11px*var(--fs))]" />
        ))}
      </div>
    </div>
  );
}

function MembersModal({ ministry, onClose }: { ministry: Ministry; onClose: () => void }) {
  const { users, ministries, assignments, services, me } = useApp();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [openPos, setOpenPos] = useState<string | null>(null);
  const today = todayISO();
  const sDate = new Map(services.map((s) => [s.id, s.date]));
  const upcoming = (uid: string) => assignments.filter((a) => a.userId === uid && a.ministryId === ministry.id && (sDate.get(a.serviceId) ?? "") >= today).length;
  const mName = new Map(ministries.map((m) => [m.id, m.name]));

  const members = users.filter((u) => isCurrent(u) && u.ministries.includes(ministry.id)).sort((a, b) => a.name.localeCompare(b.name));
  const shown = members.filter((u) => matchesName(u.name, q));
  const candidates = users
    .filter((u) => isCurrent(u) && !u.ministries.includes(ministry.id))
    .map((u) => {
      const others = u.ministries.map((id) => mName.get(id)).filter(Boolean);
      return { user: u, notes: [others.length ? tr("Di komisi: {p}", { p: others.join(", ") }) : tr("Belum di komisi mana pun")] };
    });

  const add = async (id: string | null) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    setBusy(u.id);
    try {
      await addToMinistry(u, ministry);
      celebrate(tr("{name} ditambahkan", { name: u.name }));
    } catch (e) {
      toast(tr("Gagal menambahkan: {message}", { message: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (u: UserProfile) => {
    const n = upcoming(u.id);
    const ok = await ask({
      title: tr("Keluarkan {name} dari {name2}?", { name: u.name, name2: ministry.name }),
      message: n
        ? tr("{name} masih punya {n} jadwal mendatang di {name2}. Jadwal itu tetap ada sampai kamu menggantinya di Atur Jadwal.", { name: u.name, n, name2: ministry.name })
        : tr("{name} tidak akan dijadwalkan lagi di {name2}. Bisa ditambahkan kembali kapan saja.", { name: u.name, name2: ministry.name }),
      confirmText: tr("Keluarkan"),
      tone: "danger",
    });
    if (!ok) return;
    setBusy(u.id);
    try {
      await removeFromMinistry(u, ministry);
      toast(tr("{name} dikeluarkan dari {name2}", { name: u.name, name2: ministry.name }));
    } catch (e) {
      toast(tr("Gagal: {message}", { message: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  };

  const togglePos = async (u: UserProfile, picked: string[], p: string) => {
    const next = picked.includes(p) ? picked.filter((x) => x !== p) : [...picked, p];
    if (!next.length) {
      toast(tr("Pilih minimal satu posisi."));
      return;
    }
    setBusy(u.id);
    try {
      await setMinistryPositions(u, ministry, next);
    } catch (e) {
      toast(tr("Gagal menyimpan: {message}", { message: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={tr("Anggota {name}", { name: ministry.name })}>
      <Button className="w-full mb-4" onClick={() => setPicking(true)} disabled={!candidates.length}>
        <Plus size={16} /> {tr("Tambah anggota")}
      </Button>
      {!candidates.length && <p className="text-[length:calc(13px*var(--fs))] text-ink-soft -mt-2 mb-4">{tr("Semua jemaat yang aktif sudah menjadi anggota.")}</p>}

      {members.length > 0 && <SearchField value={q} onChange={setQ} placeholder={tr("Cari anggota…")} className="mb-3" />}
      <p className="text-sm font-medium text-ink-soft mb-2">
        {q.trim() ? tr("{n} dari {n2} anggota", { n: shown.length, n2: members.length }) : tr("{n} anggota", { n: members.length })}
      </p>
      {members.length > 0 && shown.length === 0 && (
        <p className="text-[length:calc(14px*var(--fs))] text-ink-soft rounded-xl bg-surface px-3 py-2.5">{tr("Tidak ada anggota bernama “")}{q.trim()}”.</p>
      )}
      {members.length ? (
        shown.length > 0 && <ul className="divide-y divide-line rounded-2xl border border-line" aria-label={tr("Anggota {name}", { name: ministry.name })}>
          {shown.map((u) => {
            const n = upcoming(u.id);
            const coord = u.coordinatorOf?.includes(ministry.id);
            const allowed = positionsFor(u, ministry.id);
            const picked = ministry.positions.filter((p) => !allowed || allowed.includes(p));
            const allPos = picked.length === ministry.positions.length;
            const open = openPos === u.id;
            return (
              <li key={u.id} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} src={u.photoUrl} size={42} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[length:calc(15px*var(--fs))] font-semibold truncate">
                      {u.name}
                      {u.id === me?.id && <span className="font-normal text-ink-soft"> {tr("(kamu)")}</span>}
                    </div>
                    <div className="text-[length:calc(13px*var(--fs))] text-ink-soft">
                      {coord ? tr("Koordinator · ") : ""}
                      {n ? tr("{n} jadwal mendatang", { n }) : tr("Belum ada jadwal")}
                    </div>
                    {ministry.positions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpenPos(open ? null : u.id)}
                        aria-expanded={open}
                        aria-label={tr("Posisi {name}", { name: u.name })}
                        className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[length:calc(13px*var(--fs))] font-medium text-brand"
                      >
                        <Tags size={13} className="shrink-0" />
                        <span className="truncate">{allPos ? tr("Semua posisi") : picked.join(", ")}</span>
                        <ChevronDown size={14} className={cn("shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(u)}
                    disabled={busy === u.id}
                    aria-label={tr("Keluarkan {name}", { name: u.name })}
                    className="h-10 w-10 shrink-0 grid place-items-center rounded-xl text-danger-ink hover:bg-danger-soft disabled:opacity-40 active:scale-90 transition"
                  >
                    <UserMinus size={18} />
                  </button>
                </div>
                {open && (
                  <div className="mt-2.5 ml-[54px] animate-[gf-drop_.18s_ease-out]">
                    <p className="text-[length:calc(12px*var(--fs))] text-ink-soft mb-2">
                      {tr("Posisi yang bisa diisi {name} di {name2}:", { name: u.name.split(" ")[0], name2: ministry.name })}
                    </p>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={tr("Posisi {name}", { name: u.name })}>
                      {ministry.positions.map((p) => {
                        const on = picked.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={on}
                            disabled={busy === u.id}
                            onClick={() => togglePos(u, picked, p)}
                            className={cn(
                              "inline-flex items-center gap-1 min-h-9 rounded-full border px-3 py-1.5 text-[length:calc(14px*var(--fs))] font-medium active:scale-[.97] transition disabled:opacity-60",
                              on ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-soft",
                            )}
                          >
                            {on && <Check size={14} strokeWidth={3} aria-hidden />}
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[length:calc(12px*var(--fs))] text-ink-soft mt-2">{tr("Hanya posisi yang dipilih yang muncul untuknya di Atur Jadwal dan Smart Fill.")}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[length:calc(14px*var(--fs))] text-ink-soft rounded-xl bg-surface px-3 py-2.5">{tr("Belum ada anggota. Tekan “Tambah anggota”.")}</p>
      )}
      <p className="text-[length:calc(12px*var(--fs))] text-ink-soft mt-3">{tr("Yang bisa ditambahkan hanya jemaat yang sudah bergabung ke gereja. Akun baru dibuat oleh Admin atau lewat kode undangan.")}</p>

      <PersonPicker
        open={picking}
        title={tr("Tambah ke {name}", { name: ministry.name })}
        subtitle={tr("Pilih jemaat yang akan melayani di komisi ini")}
        people={candidates}
        onPick={add}
        onClose={() => setPicking(false)}
        emptyText={tr("Semua jemaat sudah menjadi anggota.")}
      />
    </Modal>
  );
}
