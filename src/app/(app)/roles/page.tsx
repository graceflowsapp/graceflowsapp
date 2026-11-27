"use client";

/**
 * "Peran": coordinators manage the komisi they coordinate.
 * - Posisi: only `positions` changes on the komisi (firestore.rules lets its coordinators update positions & groups).
 * - Anggota: adds/removes this komisi in members' `ministries` (rules: only komisi the coordinator owns).
 * Name, colour and deleting a komisi stay with the church Admin.
 */
import { useState } from "react";
import { ChevronRight, Pencil, Plus, Tags, UserMinus, Users } from "lucide-react";
import { SearchField, matchesName } from "@/components/SearchField";
import { useApp, useCoordinatedMinistries } from "@/components/providers";
import { Avatar, Badge, Button, Card, Empty, Modal, toast } from "@/components/ui";
import { PersonPicker } from "@/components/PersonPicker";
import { PositionsEditor } from "@/components/PositionsEditor";
import { store } from "@/lib/store";
import { addToMinistry, removeFromMinistry } from "@/lib/actions";
import { ask, celebrate } from "@/lib/feedback";
import { todayISO } from "@/lib/dates";
import type { Ministry, UserProfile } from "@/lib/types";

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
        <Empty icon={<Tags size={20} />} title="Belum ada komisi yang kamu koordinasi" body="Minta Admin gereja memberi akses koordinator." />
      </Card>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Peran</h1>
      <p className="text-[14px] text-ink-soft mb-4">Atur posisi dan anggota di komisi yang kamu koordinasi.</p>

      <div className="space-y-3">
        {mine.map((m) => {
          const count = users.filter((u) => isCurrent(u) && u.ministries.includes(m.id)).length;
          return (
            <Card key={m.id} className="overflow-hidden">
              {/* the card itself opens the posisi editor */}
              <button type="button" onClick={() => setEditing(m)} aria-label={`Ubah posisi ${m.name}`} className="w-full p-4 text-left transition hover:bg-surface/60 active:bg-surface">
                <div className="flex items-center gap-3 mb-3">
                  <span className="h-10 w-10 shrink-0 rounded-xl grid place-items-center text-white" style={{ background: m.color }}>
                    <Tags size={19} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-semibold truncate">{m.name}</div>
                    <div className="text-[13px] text-ink-soft">{m.positions.length} posisi</div>
                  </div>
                  <span className="inline-flex items-center gap-1 shrink-0 rounded-full bg-brand-soft text-brand px-3 py-1.5 text-[13px] font-semibold">
                    <Pencil size={13} /> Ubah
                  </span>
                </div>
                {m.positions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {m.positions.map((p, i) => (
                      <Badge key={p} className="bg-surface text-ink text-[14px] px-3 py-1">
                        <span className="text-ink-soft mr-1">{i + 1}.</span>
                        {p}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] text-ink-soft">Belum ada posisi. Ketuk untuk menambahkan.</p>
                )}
              </button>
              {/* separate button: the komisi's members */}
              <button
                type="button"
                onClick={() => setMembersOfId(m.id)}
                className="w-full flex items-center gap-3 border-t border-line px-4 py-3 text-left transition hover:bg-surface/60 active:bg-surface"
              >
                <MemberStrip ministry={m} />
                <span className="flex-1 min-w-0 text-[15px] font-semibold">
                  <Users size={15} className="inline -mt-0.5 mr-1.5 text-ink-soft" />
                  {count ? `${count} anggota` : "Belum ada anggota"}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand shrink-0">
                  Anggota <ChevronRight size={16} />
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
    if (affected > 0 && !(await ask({ title: "Simpan perubahan posisi?", message: `${affected} jadwal mendatang memakai posisi ${removed.join(", ")} dan tidak akan tampil lagi.`, confirmText: "Simpan", tone: "warning" }))) return;
    setBusy(true);
    try {
      await store.update("ministries", ministry.id, { positions: finalPositions });
      celebrate("Posisi disimpan");
      toast(`Posisi ${ministry.name} diperbarui`);
      onClose();
    } catch (e) {
      toast(`Gagal menyimpan: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Posisi ${ministry.name}`}>
      <PositionsEditor value={positions} onChange={setPositions} original={ministry.positions} draft={draft} setDraft={setDraft} />
      {affected > 0 && (
        <p className="rounded-xl bg-warning-soft text-warning-ink text-[13px] px-3 py-2 mb-3">
          {affected} jadwal mendatang memakai posisi yang dihapus ({removed.join(", ")}) dan tidak akan tampil lagi.
        </p>
      )}
      <Button className="w-full" disabled={busy || finalPositions.length === 0} onClick={save}>
        Simpan
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
          <Avatar key={u.id} name={u.name} src={u.photoUrl} size={32} className="ring-2 ring-card text-[11px]" />
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
      return { user: u, notes: [others.length ? `Di komisi: ${others.join(", ")}` : "Belum di komisi mana pun"] };
    });

  const add = async (id: string | null) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    setBusy(u.id);
    try {
      await addToMinistry(u, ministry);
      celebrate(`${u.name} ditambahkan`);
    } catch (e) {
      toast(`Gagal menambahkan: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (u: UserProfile) => {
    const n = upcoming(u.id);
    const ok = await ask({
      title: `Keluarkan ${u.name} dari ${ministry.name}?`,
      message: n
        ? `${u.name} masih punya ${n} jadwal mendatang di ${ministry.name}. Jadwal itu tetap ada sampai kamu menggantinya di Atur Jadwal.`
        : `${u.name} tidak akan dijadwalkan lagi di ${ministry.name}. Bisa ditambahkan kembali kapan saja.`,
      confirmText: "Keluarkan",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(u.id);
    try {
      await removeFromMinistry(u, ministry);
      toast(`${u.name} dikeluarkan dari ${ministry.name}`);
    } catch (e) {
      toast(`Gagal: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Anggota ${ministry.name}`}>
      <Button className="w-full mb-4" onClick={() => setPicking(true)} disabled={!candidates.length}>
        <Plus size={16} /> Tambah anggota
      </Button>
      {!candidates.length && <p className="text-[13px] text-ink-soft -mt-2 mb-4">Semua jemaat yang aktif sudah menjadi anggota.</p>}

      {members.length > 0 && <SearchField value={q} onChange={setQ} placeholder="Cari anggota…" className="mb-3" />}
      <p className="text-sm font-medium text-ink-soft mb-2">
        {q.trim() ? `${shown.length} dari ${members.length} anggota` : `${members.length} anggota`}
      </p>
      {members.length > 0 && shown.length === 0 && (
        <p className="text-[14px] text-ink-soft rounded-xl bg-surface px-3 py-2.5">Tidak ada anggota bernama “{q.trim()}”.</p>
      )}
      {members.length ? (
        shown.length > 0 && <ul className="divide-y divide-line rounded-2xl border border-line" aria-label={`Anggota ${ministry.name}`}>
          {shown.map((u) => {
            const n = upcoming(u.id);
            const coord = u.coordinatorOf?.includes(ministry.id);
            return (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={u.name} src={u.photoUrl} size={42} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold truncate">
                    {u.name}
                    {u.id === me?.id && <span className="font-normal text-ink-soft"> (kamu)</span>}
                  </div>
                  <div className="text-[13px] text-ink-soft">
                    {coord ? "Koordinator · " : ""}
                    {n ? `${n} jadwal mendatang` : "Belum ada jadwal"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(u)}
                  disabled={busy === u.id}
                  aria-label={`Keluarkan ${u.name}`}
                  className="h-10 w-10 shrink-0 grid place-items-center rounded-xl text-danger-ink hover:bg-danger-soft disabled:opacity-40 active:scale-90 transition"
                >
                  <UserMinus size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[14px] text-ink-soft rounded-xl bg-surface px-3 py-2.5">Belum ada anggota. Tekan “Tambah anggota”.</p>
      )}
      <p className="text-[12px] text-ink-soft mt-3">Yang bisa ditambahkan hanya jemaat yang sudah bergabung ke gereja. Akun baru dibuat oleh Admin atau lewat kode undangan.</p>

      <PersonPicker
        open={picking}
        title={`Tambah ke ${ministry.name}`}
        subtitle="Pilih jemaat yang akan melayani di komisi ini"
        people={candidates}
        onPick={add}
        onClose={() => setPicking(false)}
        emptyText="Semua jemaat sudah menjadi anggota."
      />
    </Modal>
  );
}
