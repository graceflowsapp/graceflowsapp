"use client";

/**
 * "Peran": coordinators edit the posisi (roles) of the komisi they coordinate.
 * Only `positions` changes here (firestore.rules lets a komisi's coordinators update positions & groups,
 * nothing else); name, colour and deleting a komisi stay with the church Admin.
 */
import { useState } from "react";
import { Pencil, Tags, Users } from "lucide-react";
import { useApp, useCoordinatedMinistries } from "@/components/providers";
import { Badge, Button, Card, Empty, Modal, toast } from "@/components/ui";
import { PositionsEditor } from "@/components/PositionsEditor";
import { store } from "@/lib/store";
import { ask, celebrate } from "@/lib/feedback";
import { todayISO } from "@/lib/dates";
import type { Ministry } from "@/lib/types";

export default function RolesPage() {
  const { users } = useApp();
  const mine = useCoordinatedMinistries();
  const [editing, setEditing] = useState<Ministry | null>(null);

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
      <p className="text-[14px] text-ink-soft mb-4">Atur posisi di komisi yang kamu koordinasi, misalnya Worship Leader, Singer, atau Gitar.</p>

      <div className="space-y-3">
        {mine.map((m) => {
          const count = users.filter((u) => u.active !== false && u.ministries.includes(m.id)).length;
          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="h-10 w-10 shrink-0 rounded-xl grid place-items-center text-white" style={{ background: m.color }}>
                  <Tags size={19} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-semibold truncate">{m.name}</div>
                  <div className="text-[13px] text-ink-soft flex items-center gap-1">
                    <Users size={13} /> {count} anggota · {m.positions.length} posisi
                  </div>
                </div>
              </div>
              {m.positions.length ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {m.positions.map((p) => (
                    <Badge key={p} className="bg-surface text-ink text-[14px] px-3 py-1">
                      {p}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[14px] text-ink-soft mb-3">Belum ada posisi.</p>
              )}
              <Button variant="secondary" className="w-full" onClick={() => setEditing(m)}>
                <Pencil size={15} /> Ubah posisi
              </Button>
            </Card>
          );
        })}
      </div>

      {editing && <RolesModal ministry={editing} onClose={() => setEditing(null)} />}
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
