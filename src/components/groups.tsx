"use client";

/**
 * Komisi groups (e.g. "Singer Grup A", "Choir B"), managed by the komisi's coordinators.
 * A group says who fills which posisi; "Isi dengan grup" puts those people into an ibadah's slots in one go.
 * Every person still gets their own slot, so Hadir / Berhalangan / tukar jadwal keep working per person.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Pencil, Plus, Trash2, UserX, Users } from "lucide-react";
import { useApp } from "./providers";
import { Avatar, Badge, Button, Modal, cn, inputCls, toast } from "./ui";
import { PersonPicker } from "./PersonPicker";
import { assignSlot, saveGroups } from "@/lib/actions";
import { ask, celebrate, haptic } from "@/lib/feedback";
import { formatDateLong } from "@/lib/dates";
import { assignmentId, availabilityNotes, canFill, declinedService, findConflicts, isActive, isAvailableForService, type AvailabilityNote } from "@/lib/scheduling";
import type { Ministry, MinistryGroup, Service } from "@/lib/types";
import { tr } from "@/lib/i18n";

function rid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

/* ------------------------------------------------------------------ */
/* Manage groups                                                       */
/* ------------------------------------------------------------------ */

export function GroupsModal({ ministry, onClose }: { ministry: Ministry; onClose: () => void }) {
  const { users } = useApp();
  const groups = ministry.groups ?? [];
  const [editing, setEditing] = useState<MinistryGroup | "new" | null>(null);
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name.split(" ")[0] ?? "?";

  if (editing) {
    return (
      <GroupEditor
        ministry={ministry}
        group={editing === "new" ? undefined : editing}
        onBack={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
    );
  }

  return (
    <Modal open onClose={onClose} title={tr("Grup {name}", { name: ministry.name })}>
      <p className="text-[length:calc(14px*var(--fs))] text-ink-soft mb-4">{tr("Susun tim tetap (mis. Singer Grup A). Di Atur Jadwal, satu ibadah bisa langsung diisi dengan satu grup.")}</p>
      {groups.length === 0 ? (
        <p className="text-[length:calc(14px*var(--fs))] text-ink-soft rounded-xl bg-surface px-3 py-3 mb-4">{tr("Belum ada grup.")}</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {groups.map((g) => (
            <li key={g.id} className="rounded-xl border border-line p-3 flex items-start gap-3">
              <span className="h-9 w-9 shrink-0 rounded-xl grid place-items-center text-white" style={{ background: ministry.color }}>
                <Users size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[length:calc(15px*var(--fs))] font-semibold">{g.name}</div>
                <div className="text-[length:calc(13px*var(--fs))] text-ink-soft">
                  {g.slots.length} {tr("orang ·")} {g.slots.map((s) => nameOf(s.userId)).join(", ")}
                </div>
              </div>
              <button className="p-2 rounded-lg hover:bg-surface text-ink-soft" aria-label={tr("Ubah {name}", { name: g.name })} onClick={() => setEditing(g)}>
                <Pencil size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button className="w-full" onClick={() => setEditing("new")}>
        <Plus size={16} /> {tr("Buat grup baru")}
      </Button>
    </Modal>
  );
}

function GroupEditor({ ministry, group, onBack, onSaved }: { ministry: Ministry; group?: MinistryGroup; onBack: () => void; onSaved: () => void }) {
  const { users } = useApp();
  const [name, setName] = useState(group?.name ?? "");
  // posisi → userId ("" = not in this group)
  const [seats, setSeats] = useState<Record<string, string>>(() => Object.fromEntries((group?.slots ?? []).map((s) => [s.position, s.userId])));
  const [busy, setBusy] = useState(false);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const members = useMemo(
    () => users.filter((u) => isActive(u) && u.ministries.includes(ministry.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [users, ministry.id],
  );
  const groups = ministry.groups ?? [];
  const chosen = Object.values(seats).filter(Boolean);
  const dupes = new Set(chosen.filter((id, i) => chosen.indexOf(id) !== i));
  const nameTaken = groups.some((g) => g.id !== group?.id && g.name.trim().toLowerCase() === name.trim().toLowerCase());
  const problem = !name.trim()
    ? tr("Isi nama grup.")
    : nameTaken
      ? tr("Nama grup sudah dipakai.")
      : chosen.length === 0
        ? tr("Pilih minimal satu orang.")
        : dupes.size
          ? tr("Satu orang hanya bisa di satu posisi dalam grup yang sama.")
          : null;

  const save = async () => {
    if (problem) return;
    setBusy(true);
    try {
      const next: MinistryGroup = {
        id: group?.id ?? rid(),
        name: name.trim(),
        slots: ministry.positions.filter((p) => seats[p]).map((p) => ({ position: p, userId: seats[p] })),
      };
      await saveGroups(ministry.id, group ? groups.map((g) => (g.id === group.id ? next : g)) : [...groups, next]);
      celebrate(`${next.name} disimpan`);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!group) return;
    if (!(await ask({ title: tr("Hapus {name}?", { name: group.name }), message: tr("Jadwal yang sudah diisi dengan grup ini tetap ada."), confirmText: tr("Hapus"), tone: "danger" }))) return;
    await saveGroups(ministry.id, groups.filter((g) => g.id !== group.id));
    toast(tr("Grup dihapus"));
    onSaved();
  };

  return (
    <Modal open onClose={onBack} title={group ? tr("Ubah {name}", { name: group.name }) : tr("Grup baru")}>
      <button onClick={onBack} className="flex items-center gap-1 text-[length:calc(14px*var(--fs))] text-ink-soft mb-3 -mt-1 hover:text-brand">
        <ArrowLeft size={16} /> {tr("Semua grup")}
      </button>
      <label className="block mb-4">
        <span className="block text-sm font-medium text-ink-soft mb-1.5">{tr("Nama grup")}</span>
        <input className={cn(inputCls, "text-[length:max(16px,calc(16px*var(--fs)))]")} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("mis. Singer Grup A")} />
      </label>

      <span className="block text-sm font-medium text-ink-soft mb-2">{tr("Siapa mengisi posisi apa")}</span>
      <ul className="space-y-2 mb-4">
        {ministry.positions.map((p) => {
          const v = seats[p] ?? "";
          const picked = members.find((m) => m.id === v);
          return (
            <li key={p}>
              <button
                type="button"
                onClick={() => setPickingFor(p)}
                aria-label={tr("{p}: {p2}. Ketuk untuk memilih", { p, p2: picked ? picked.name : tr("belum dipilih") })}
                className={cn(
                  "w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left active:scale-[.99] transition",
                  picked ? "border-line bg-card hover:border-brand" : "border-dashed border-line bg-surface hover:border-brand",
                  dupes.has(v) && "border-danger",
                )}
              >
                {picked ? (
                  <Avatar name={picked.name} src={picked.photoUrl} size={40} className="shrink-0" />
                ) : (
                  <span className="h-10 w-10 rounded-full border-2 border-dashed border-line grid place-items-center text-ink-soft shrink-0">
                    <Plus size={18} />
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-[length:calc(12px*var(--fs))] text-ink-soft">{p}</span>
                  <span className={cn("block text-[length:max(16px,calc(16px*var(--fs)))] truncate", picked ? "font-semibold" : "text-ink-soft")}>{picked ? picked.name : tr("Pilih orang")}</span>
                  {picked && !canFill(picked, ministry.id, p) && <span className="block text-[length:calc(12px*var(--fs))] text-warning-ink">{tr("Biasanya bukan posisinya")}</span>}
                </span>
                <ChevronRight size={18} className="text-ink-soft shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
      <PersonPicker
        open={pickingFor !== null}
        title={pickingFor ? tr("Pilih {pickingFor}", { pickingFor }) : ""}
        subtitle={name.trim() || tr("Grup baru")}
        selectedId={pickingFor ? seats[pickingFor] || null : null}
        clearLabel={tr("Kosongkan posisi ini")}
        people={members.map((m) => {
          const elsewhere = Object.entries(seats).find(([pos, id]) => id === m.id && pos !== pickingFor)?.[0];
          const skilled = pickingFor ? canFill(m, ministry.id, pickingFor) : true;
          return {
            user: m,
            muted: !skilled,
            notes: [
              ...(elsewhere ? [tr("Sekarang di {elsewhere} (akan dipindah)", { elsewhere })] : []),
              ...(!skilled ? [tr("Biasanya bukan posisinya")] : []),
            ],
          };
        })}
        emptyText={tr("Belum ada anggota di komisi ini.")}
        onPick={(id) => {
          if (!pickingFor) return;
          setSeats((s) => {
            const next = { ...s };
            // picking someone already seated elsewhere in this group moves them here
            if (id) for (const [pos, uid] of Object.entries(next)) if (uid === id) next[pos] = "";
            next[pickingFor] = id ?? "";
            return next;
          });
        }}
        onClose={() => setPickingFor(null)}
      />
      {problem && (name || chosen.length > 0) && <p className="text-[length:calc(13px*var(--fs))] text-danger-ink mb-3">{problem}</p>}

      <div className="flex gap-2">
        {group && (
          <Button variant="danger" onClick={remove} aria-label={tr("Hapus grup")}>
            <Trash2 size={16} />
          </Button>
        )}
        <Button className="flex-1" disabled={busy || !!problem} onClick={save}>
          {tr("Simpan grup")}
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Fill an ibadah with a group                                         */
/* ------------------------------------------------------------------ */

type Choice = { mode: "fill" } | { mode: "skip" } | { mode: "replace"; userId: string };

export function GroupFillModal({ service, ministry, onClose }: { service: Service; ministry: Ministry; onClose: () => void }) {
  const { users, services, assignments, ministries } = useApp();
  const groups = ministry.groups ?? [];
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [busy, setBusy] = useState(false);
  const [pickRow, setPickRow] = useState<string | null>(null);
  const group = groups.find((g) => g.id === groupId);
  const aMap = useMemo(() => new Map(assignments.map((a) => [a.id, a])), [assignments]);
  const nameOf = (id?: string | null) => users.find((u) => u.id === id)?.name ?? "—";

  const rows = useMemo(() => {
    if (!group) return [];
    const groupSlotIds = group.slots.map((s) => assignmentId(service.id, ministry.id, s.position));
    return group.slots
      .filter((s) => ministry.positions.includes(s.position))
      .map((s) => {
        const slotId = assignmentId(service.id, ministry.id, s.position);
        const current = aMap.get(slotId)?.userId ?? null;
        const u = users.find((x) => x.id === s.userId);
        const notes: AvailabilityNote[] = u
          ? availabilityNotes(u, service, { services, assignments, ministries, ignoreAssignmentId: slotId, ignoreAssignmentIds: groupSlotIds, ministryId: ministry.id, position: s.position })
          : [];
        if (!u || !isActive(u)) notes.unshift({ kind: "off", text: tr("Sudah tidak aktif / keluar dari gereja") });
        const blocked = notes.some((n) => n.kind !== "info");
        return { s, slotId, current, u, notes, blocked, same: current === s.userId };
      });
  }, [group, ministry, service, aMap, users, services, assignments, ministries]);

  const choiceOf = (r: (typeof rows)[number]): Choice => choices[`${groupId}:${r.slotId}`] ?? (r.blocked ? { mode: "skip" } : { mode: "fill" });
  const setChoice = (r: (typeof rows)[number], c: Choice) => setChoices((x) => ({ ...x, [`${groupId}:${r.slotId}`]: c }));

  // who ends up in each slot, to avoid putting one person in two slots
  const targets = rows.map((r) => {
    const c = choiceOf(r);
    return c.mode === "fill" ? r.s.userId : c.mode === "replace" ? c.userId : null;
  });

  /** Available stand-ins for one posisi: can fill it, ON, no clash, didn't decline, not already used in this fill. */
  const standIns = (position: string, slotId: string, keep?: string) =>
    users
      .filter((u) => canFill(u, ministry.id, position) && isAvailableForService(u, service))
      .filter((u) => findConflicts(u.id, service, services, assignments, slotId).length === 0)
      .filter((u) => !declinedService(u.id, service.id, assignments))
      .filter((u) => u.id === keep || !targets.includes(u.id))
      .sort((a, b) => a.name.localeCompare(b.name));

  const changes = rows.filter((r, i) => targets[i] && targets[i] !== r.current);
  // after the fill: a skipped slot keeps its current person — make sure nobody ends up in two of these slots
  const finalPeople = rows.map((r, i) => targets[i] ?? r.current).filter(Boolean) as string[];
  const doubled = [...new Set(finalPeople.filter((id, i) => finalPeople.indexOf(id) !== i))];
  const unavailable = rows.filter((r) => r.blocked).length;

  const apply = async () => {
    if (!group) return;
    const replacing = changes.filter((r) => r.current).map((r) => nameOf(r.current));
    if (
      replacing.length &&
      !(await ask({
        title: tr("Ganti {n} orang yang sudah terjadwal?", { n: replacing.length }),
        message: tr("{p} akan dikeluarkan dari slotnya dan diberi notifikasi.", { p: replacing.join(", ") }),
        confirmText: tr("Ya, jadwalkan"),
        tone: "warning",
      }))
    )
      return;
    setBusy(true);
    try {
      for (const r of rows) {
        const i = rows.indexOf(r);
        const target = targets[i];
        if (!target || target === r.current) continue;
        await assignSlot({
          id: r.slotId,
          service,
          ministryId: ministry.id,
          position: r.s.position,
          userId: target,
          previousUserId: r.current,
          groupId: group.id,
        });
      }
      haptic("success");
      celebrate(`${group.name} dijadwalkan`);
      toast(tr("{n} pelayan diberi notifikasi", { n: changes.length }));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={tr("Isi dengan grup")}>
      <p className="text-[length:calc(14px*var(--fs))] text-ink-soft mb-3">
        {service.title} · {formatDateLong(service.date)} {service.time}
      </p>

      {/* pick a group */}
      <div className="flex flex-wrap gap-2 mb-4" role="radiogroup" aria-label={tr("Pilih grup")}>
        {groups.map((g) => (
          <button
            key={g.id}
            role="radio"
            aria-checked={g.id === groupId}
            onClick={() => {
              haptic("select");
              setGroupId(g.id);
            }}
            className={cn(
              "min-h-10 rounded-full border px-4 py-2 text-[length:calc(15px*var(--fs))] font-medium active:scale-[.97] transition",
              g.id === groupId ? "text-white border-transparent shadow-sm" : "bg-card border-line text-ink",
            )}
            style={g.id === groupId ? { background: ministry.color } : undefined}
          >
            {g.name}
          </button>
        ))}
      </div>

      {group && unavailable > 0 && (
        <div className="rounded-xl bg-warning-soft text-warning-ink text-[length:calc(13px*var(--fs))] px-3 py-2 mb-3 flex items-start gap-2">
          <UserX size={15} className="mt-0.5 shrink-0" />
          <span>
            {unavailable} {tr("anggota tidak tersedia untuk ibadah ini. Pilih")} <b>{tr("Ganti")}</b> {tr("untuk menukar dengan orang lain, atau biarkan")} <b>{tr("Lewati")}</b>.
          </span>
        </div>
      )}

      <ul className="space-y-2 mb-4">
        {rows.map((r, i) => {
          const c = choiceOf(r);
          const options = standIns(r.s.position, r.slotId, c.mode === "replace" ? c.userId : undefined);
          return (
            <li key={r.slotId} className={cn("rounded-xl border p-3", r.blocked ? "border-warning/40 bg-warning-soft/40" : "border-line")}>
              <div className="flex items-start gap-3">
                <Avatar name={r.u?.name ?? "?"} src={r.u?.photoUrl} size={36} className={cn(r.blocked && "opacity-60")} />
                <div className="flex-1 min-w-0">
                  <div className="text-[length:calc(12px*var(--fs))] text-ink-soft">{r.s.position}</div>
                  <div className={cn("text-[length:calc(15px*var(--fs))] font-medium truncate", r.blocked && "text-ink-soft line-through decoration-1")}>{r.u?.name ?? tr("Anggota dihapus")}</div>
                  <NoteList notes={r.notes} />
                  {r.same ? (
                    <div className={cn("text-[length:calc(12px*var(--fs))] mt-0.5", r.blocked ? "text-ink-soft" : "text-success")}>{tr("Sudah terjadwal di slot ini")}</div>
                  ) : (
                    r.current &&
                    targets[i] &&
                    targets[i] !== r.current && <div className="text-[length:calc(12px*var(--fs))] text-ink-soft mt-0.5">{tr("Menggantikan")} {nameOf(r.current)} {tr("di slot ini")}</div>
                  )}
                </div>
                {!r.blocked && !r.same && <Badge className="bg-success-soft text-success">{tr("Tersedia")}</Badge>}
              </div>

              {/* every row: fill with the member (if available), skip, or switch with someone else */}
              {/* already in this slot and fine → nothing to choose; already in it but unavailable → can still switch */}
              {(!r.same || r.blocked) && (
                <div className={cn("mt-2.5 grid gap-2", r.blocked ? "grid-cols-2" : "grid-cols-3")}>
                  {!r.blocked && (
                    <button
                      onClick={() => setChoice(r, { mode: "fill" })}
                      aria-pressed={c.mode === "fill"}
                      className={cn("min-h-10 rounded-xl border text-[length:calc(14px*var(--fs))] font-medium", c.mode === "fill" ? "border-success bg-success-soft text-success" : "border-line text-ink-soft")}
                    >
                      {tr("Isi")}
                    </button>
                  )}
                  <button
                    onClick={() => setChoice(r, { mode: "skip" })}
                    aria-pressed={c.mode === "skip"}
                    className={cn("min-h-10 rounded-xl border text-[length:calc(14px*var(--fs))] font-medium", c.mode === "skip" ? "border-ink bg-card text-ink" : "border-line text-ink-soft")}
                  >
                    {tr("Lewati")}
                  </button>
                  <button
                    onClick={() => options.length && setPickRow(r.slotId)}
                    disabled={!options.length && c.mode !== "replace"}
                    aria-pressed={c.mode === "replace"}
                    className={cn(
                      "min-h-10 rounded-xl border text-[length:calc(14px*var(--fs))] font-medium disabled:opacity-40",
                      c.mode === "replace" ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-soft",
                    )}
                  >
                    {options.length || c.mode === "replace" ? tr("Ganti") : tr("Tak ada pengganti")}
                  </button>
                  {c.mode === "replace" && (
                    <button
                      type="button"
                      onClick={() => setPickRow(r.slotId)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand-soft px-3 py-2 text-left active:scale-[.99] transition",
                        r.blocked ? "col-span-2" : "col-span-3",
                      )}
                    >
                      <Avatar name={nameOf(c.userId)} src={users.find((u) => u.id === c.userId)?.photoUrl} size={36} className="shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[length:calc(12px*var(--fs))] text-brand">{tr("Pengganti")}</span>
                        <span className="block text-[length:calc(15px*var(--fs))] font-semibold truncate">{nameOf(c.userId)}</span>
                      </span>
                      <span className="text-[length:calc(13px*var(--fs))] font-semibold text-brand shrink-0">{tr("Ubah")}</span>
                    </button>
                  )}
                  <PersonPicker
                    open={pickRow === r.slotId}
                    title={tr("Pengganti {position}", { position: r.s.position })}
                    subtitle={tr("untuk {p} · {p2}", { p: r.u?.name ?? tr("anggota"), p2: formatDateLong(service.date) })}
                    selectedId={c.mode === "replace" ? c.userId : null}
                    people={options.map((o) => ({ user: o, notes: [tr("Tersedia")] }))}
                    emptyText={tr("Tidak ada orang lain yang tersedia untuk posisi ini.")}
                    onPick={(id) => id && setChoice(r, { mode: "replace", userId: id })}
                    onClose={() => setPickRow(null)}
                  />
                  {c.mode === "skip" && (
                    <p className={cn("text-[length:calc(12px*var(--fs))] text-ink-soft", r.blocked ? "col-span-2" : "col-span-3")}>
                      {tr("Slot")} {r.s.position} {tr("dibiarkan seperti sekarang")}{r.current ? ` (${nameOf(r.current)})` : tr(" (kosong)")}.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {doubled.length > 0 && (
        <p className="rounded-xl bg-danger-soft text-danger-ink text-[length:calc(13px*var(--fs))] px-3 py-2 mb-3">
          {doubled.map((id) => nameOf(id)).join(", ")} {tr("akan bertugas di dua posisi. Pilih")} <b>{tr("Ganti")}</b> {tr("atau")} <b>{tr("Lewati")}</b> {tr("pada salah satu slot.")}
        </p>
      )}
      <Button className="w-full" disabled={busy || !group || changes.length === 0 || doubled.length > 0} onClick={apply}>
        <Users size={16} /> {changes.length ? tr("Jadwalkan {n} orang", { n: changes.length }) : tr("Tidak ada perubahan")}
      </Button>
    </Modal>
  );
}

function NoteList({ notes }: { notes: AvailabilityNote[] }) {
  if (!notes.length) return null;
  return (
    <ul className="mt-0.5 space-y-0.5">
      {notes.map((n, i) => (
        <li key={i} className={cn("text-[length:calc(12px*var(--fs))] leading-snug", n.kind === "conflict" ? "text-danger-ink" : n.kind === "declined" ? "text-warning-ink" : "text-ink-soft")}>
          {n.text}
        </li>
      ))}
    </ul>
  );
}
