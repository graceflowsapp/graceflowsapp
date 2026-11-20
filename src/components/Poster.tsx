"use client";

import { forwardRef } from "react";
import type { Ministry, Service, Slot, UserProfile } from "@/lib/types";
import { formatDateLong, formatDateTimeLocal } from "@/lib/dates";

export const POSTER_W = 1080;
export const POSTER_H = 1350;

function initials(name: string) {
  return name
    .replace(/^(Pdt|Ev)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** 1080×1350 (Instagram/WhatsApp portrait) poster, rendered to PNG with html-to-image. Inline styles only. */
export const Poster = forwardRef<HTMLDivElement, { service: Service; ministry: Ministry; slots: Slot[]; users: UserProfile[]; churchName: string }>(function Poster(
  { service, ministry, slots, users, churchName },
  ref,
) {
  const filled = slots.map((s) => ({ slot: s, user: users.find((u) => u.id === s.assignment?.userId) }));
  const cols = filled.length <= 4 ? 2 : 3;
  const size = cols === 2 ? 230 : 190;
  const rehearsal = service.rehearsals?.[ministry.id];

  return (
    <div
      ref={ref}
      style={{
        width: POSTER_W,
        height: POSTER_H,
        background: `linear-gradient(160deg, #062e2b 0%, #083d39 45%, ${ministry.color} 140%)`,
        color: "white",
        fontFamily: "var(--font-jakarta), system-ui, sans-serif",
        padding: 80,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", right: -160, top: -160, width: 520, height: 520, borderRadius: "50%", background: ministry.color, opacity: 0.25 }} />
      <div style={{ fontSize: 30, letterSpacing: 6, textTransform: "uppercase", opacity: 0.7 }}>{churchName}</div>
      <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, marginTop: 16 }}>Tim {ministry.name}</div>
      <div style={{ fontSize: 38, marginTop: 18, fontWeight: 600 }}>{formatDateLong(service.date)}</div>
      <div style={{ fontSize: 30, marginTop: 8, opacity: 0.85 }}>
        {[service.title, service.session, `${service.time} WITA`].filter(Boolean).join(" · ")}
        {service.location ? ` · ${service.location}` : ""}
        {service.label ? `  ·  ✨ ${service.label}` : ""}
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          alignContent: "center",
          gap: 44,
          marginTop: 40,
        }}
      >
        {filled.map(({ slot, user }) => (
          <div key={slot.assignmentId} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            {user?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoUrl}
                alt=""
                crossOrigin="anonymous"
                style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `8px solid ${ministry.color}` }}
              />
            ) : (
              <div
                style={{
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,.12)",
                  border: `8px solid ${ministry.color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: size * 0.34,
                  fontWeight: 700,
                }}
              >
                {user ? initials(user.name) : "?"}
              </div>
            )}
            <div style={{ fontSize: 34, fontWeight: 700, marginTop: 18, lineHeight: 1.15 }}>{user?.name ?? "—"}</div>
            <div style={{ fontSize: 26, opacity: 0.75, marginTop: 6 }}>{slot.position}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, opacity: 0.85, borderTop: "2px solid rgba(255,255,255,.2)", paddingTop: 28 }}>
        <span>{service.briefingTime ? `🙏 Doa ${service.briefingTime}` : ""}</span>
        <span>{rehearsal ? `🎵 Latihan ${formatDateTimeLocal(rehearsal.at)}` : ""}</span>
      </div>
    </div>
  );
});
