import type { Assignment, Ministry, Service, UserProfile } from "./types";
import { formatDateLong, formatDateTimeLocal } from "./dates";
import { slotsForService, sortServices } from "./scheduling";


export function scheduleToWhatsAppText(opts: {
  services: Service[];
  ministryIds: string[];
  ministries: Ministry[];
  assignments: Assignment[];
  users: UserProfile[];
  heading: string;
  churchName: string;
}): string {
  const { services, ministryIds, ministries, assignments, users, heading, churchName } = opts;
  const map = new Map(assignments.map((a) => [a.id, a]));
  const userName = (id: string | null | undefined) => (id ? users.find((u) => u.id === id)?.name ?? "?" : "_(kosong)_");
  const lines: string[] = [`*${heading.toUpperCase()}*`, `_${churchName}_`, ""];

  for (const s of [...services].sort(sortServices)) {
    const slots = slotsForService(s, ministries, map, ministryIds);
    if (!slots.length) continue;
    lines.push(`📅 *${formatDateLong(s.date)}*`);
    lines.push(`⛪ ${[s.title, s.session, s.time].filter(Boolean).join(" · ")}${s.label ? ` · ✨ ${s.label}` : ""}`);
    if (s.location) lines.push(`📍 ${s.location}`);
    if (s.briefingTime) lines.push(`🙏 Doa/Briefing: ${s.briefingTime}`);
    for (const mid of ministryIds) {
      const r = s.rehearsals?.[mid];
      if (r && s.ministries.includes(mid)) {
        const m = ministries.find((x) => x.id === mid);
        lines.push(`🎵 Latihan ${m?.name ?? mid}: ${formatDateTimeLocal(r.at)}${r.place ? ` @ ${r.place}` : ""}`);
      }
    }
    let currentMinistry = "";
    for (const slot of slots) {
      if (ministryIds.length > 1 && slot.ministry.id !== currentMinistry) {
        currentMinistry = slot.ministry.id;
        lines.push(`*${slot.ministry.name}*`);
      }
      lines.push(`• ${slot.position}: ${userName(slot.assignment?.userId)}`);
    }
    lines.push("");
  }
  lines.push("Mohon konfirmasi kehadiran & jaga kesehatan ya 🙏", "Tuhan Yesus memberkati!");
  return lines.join("\n");
}

export function openWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}
