"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, CalendarDays, Check, Home, LayoutGrid, LogOut, Menu, Plus, ShieldCheck, Tags, ToggleRight, User, X } from "lucide-react";
import { useApp } from "./providers";
import { Avatar, Button, Empty, Modal, cn } from "./ui";
import { HelpChatbot } from "./HelpChatbot";
import { markNotificationsRead } from "@/lib/actions";
import { haptic } from "@/lib/feedback";
import { relativeDay } from "@/lib/dates";

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={32} height={32} className="h-8 w-8 rounded-full" />
      <div className="leading-tight">
        <div className="font-bold text-ink text-[15px]">GraceFlow</div>
        <div className="text-[10px] text-ink-soft -mt-0.5 truncate max-w-[160px]">{subtitle ?? "Jadwal pelayanan gereja"}</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, uid, me, demo, notifications, logout, church, churches, switchChurch } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [showNotif, setShowNotif] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // close the drawer whenever the route changes
  useEffect(() => setMenuOpen(false), [pathname]);
  const drag = useDrawerSwipe(menuOpen, setMenuOpen);

  useEffect(() => {
    if (ready && !uid) router.replace("/login");
    // signed in but not part of any church yet → onboarding (register or join a church)
    else if (ready && uid && churches.length === 0) router.replace("/mulai");
  }, [ready, uid, churches.length, router]);

  if (!ready || !uid || churches.length === 0 || !church) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!me || me.deleted || me.active === false) {
    const others = churches.filter((c) => c.id !== church.id);
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center">
        <div className="max-w-xs">
          <p className="font-semibold">{!me || me.deleted ? `Kamu bukan anggota ${church.name}` : `Akunmu di ${church.name} dinonaktifkan`}</p>
          <p className="text-sm text-ink-soft mt-1">Hubungi admin gereja jika menurutmu ini keliru.</p>
          <div className="mt-4 flex flex-col gap-2">
            {others.map((c) => (
              <Button key={c.id} variant="secondary" onClick={() => switchChurch(c.id)}>
                Buka {c.name}
              </Button>
            ))}
            <Link href="/mulai" className="text-sm text-brand font-medium py-2">
              Gabung / daftarkan gereja lain
            </Link>
            <Button variant="ghost" onClick={logout}>
              Keluar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const churchSwitcher = (
    <div className="px-3 pt-3">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-soft mb-1">Gereja</p>
      {churches.map((c) => (
        <button
          key={c.id}
          onClick={() => c.id !== church.id && switchChurch(c.id)}
          className={cn(
            "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
            c.id === church.id ? "bg-surface font-semibold" : "text-ink-soft hover:bg-surface",
          )}
        >
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.accent ?? "#0f766e" }} />
          <span className="truncate flex-1">{c.name}</span>
          {c.id === church.id && <Check size={14} className="text-brand" />}
        </button>
      ))}
      <Link href="/mulai" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand font-medium hover:bg-surface">
        <Plus size={14} /> Gabung / daftarkan gereja
      </Link>
    </div>
  );

  const isCoord =me.role === "superadmin" || (me.role === "coordinator" && me.coordinatorOf.length > 0);
  const nav = [
    { href: "/", label: "Beranda", icon: Home },
    { href: "/jadwal", label: "Jadwal", icon: CalendarDays },
    ...(me.ministries.length > 0 ? [{ href: "/ketersediaan", label: "Ketersediaan", icon: ToggleRight }] : []),
    ...(isCoord ? [{ href: "/koordinator", label: "Atur Jadwal", icon: LayoutGrid }] : []),
    ...(isCoord ? [{ href: "/roles", label: "Peran", icon: Tags }] : []),
    ...(me.role === "superadmin" ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
    { href: "/profil", label: "Profil", icon: User },
  ];
  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="min-h-dvh md:pl-60">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-card p-4">
        <Logo className="mb-6 px-2" subtitle={church.name} />
        <nav className="flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium", active ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-surface")}
              >
                <Icon size={18} /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="-mx-3">{churchSwitcher}</div>
        <div className="mt-auto flex items-center gap-2 px-2">
          <Avatar name={me.name} src={me.photoUrl} size={32} />
          <div className="text-xs min-w-0">
            <div className="font-medium truncate">{me.name}</div>
            <div className="text-ink-soft capitalize">{me.role}</div>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-surface/85 backdrop-blur border-b border-line/60 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-1">
            <button className="md:hidden p-2 -ml-2 rounded-xl hover:bg-card" onClick={() => setMenuOpen(true)} aria-label="Buka menu" aria-expanded={menuOpen}>
              <Menu size={22} />
            </button>
            <Logo className="md:invisible" subtitle={church.name} />
          </div>
          <div className="flex items-center gap-1">
            {demo && <span className="text-[10px] font-semibold uppercase tracking-wide bg-warning-soft text-warning-ink rounded-full px-2 py-0.5">Demo</span>}
            <button className="relative p-2 rounded-xl hover:bg-card" onClick={() => setShowNotif(true)} aria-label="Notifikasi">
              <Bell size={20} />
              {unread.length > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold grid place-items-center">{unread.length}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-5 pb-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))]">{children}</main>

      {/* Floating help chatbot (bottom-right) */}
      <HelpChatbot />

      {/* Mobile burger drawer */}
      <div className={cn("md:hidden fixed inset-0 z-50", menuOpen || drag !== null ? "visible" : "invisible")} aria-hidden={!menuOpen}>
        <div
          className={cn("absolute inset-0 bg-black/40", drag === null && "transition-opacity duration-300")}
          style={{ opacity: drag !== null ? drag : menuOpen ? 1 : 0 }}
          onClick={() => setMenuOpen(false)}
        />
        <aside
          data-drawer
          className={cn(
            "absolute inset-y-0 left-0 w-[80%] max-w-xs bg-card shadow-xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            drag === null && "transition-transform duration-300 ease-[cubic-bezier(.2,.9,.3,1)]",
          )}
          style={{ transform: `translateX(${drag !== null ? (drag - 1) * 100 : menuOpen ? 0 : -100}%)` }}
          role="dialog"
          aria-label="Menu"
        >
          <div className="flex items-center justify-between px-4 h-14 border-b border-line">
            <Logo subtitle={church.name} />
            <button className="p-2 -mr-2 rounded-xl hover:bg-surface" onClick={() => setMenuOpen(false)} aria-label="Tutup menu">
              <X size={20} />
            </button>
          </div>
          <Link href="/profil" className="flex items-center gap-3 px-4 py-4 border-b border-line">
            <Avatar name={me.name} src={me.photoUrl} size={44} />
            <div className="min-w-0">
              <div className="font-semibold truncate">{me.name}</div>
              <div className="text-xs text-ink-soft capitalize">{me.role}</div>
            </div>
          </Link>
          <nav className="flex flex-col gap-1 p-3">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium", active ? "bg-brand-soft text-brand" : "text-ink hover:bg-surface")}
                >
                  <Icon size={20} /> {label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line">{churchSwitcher}</div>
          <button onClick={logout} className="mt-auto m-3 flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-danger-ink hover:bg-danger-soft">
            <LogOut size={20} /> {demo ? "Ganti peran (demo)" : "Keluar"}
          </button>
        </aside>
      </div>

      <Modal
        open={showNotif}
        onClose={() => {
          setShowNotif(false);
          if (unread.length) markNotificationsRead(unread.map((n) => n.id));
        }}
        title="Notifikasi"
      >
        {notifications.length === 0 ? (
          <Empty icon={<Bell size={20} />} title="Belum ada notifikasi" />
        ) : (
          <ul className="divide-y divide-line -my-2">
            {notifications.slice(0, 40).map((n) => (
              <li key={n.id} className="py-3 flex gap-3">
                <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", n.read ? "bg-transparent" : "bg-brand")} />
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-sm text-ink-soft">{n.body}</p>
                  <p className="text-[11px] text-ink-soft mt-1">{relativeDay(n.createdAt.slice(0, 10))}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

/**
 * Swipe gestures for the mobile drawer: drag right from the left part of the screen to open,
 * drag left to close. Returns the live open-progress (0..1) while dragging, otherwise null.
 */
function useDrawerSwipe(open: boolean, setOpen: (v: boolean) => void) {
  const [progress, setProgress] = useState<number | null>(null);
  const st = useRef<{ x: number; y: number; t: number; w: number; mode: "pending" | "drag" | "ignore"; from: boolean } | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const scrollsX = (el: Element | null) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.hasAttribute("data-no-swipe")) return true;
        const ox = getComputedStyle(n).overflowX;
        if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
      }
      return false;
    };
    const onStart = (e: TouchEvent) => {
      if (window.innerWidth >= 768 || e.touches.length !== 1) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')) return; // a modal is open
      const t = e.touches[0];
      const isOpen = openRef.current;
      // closed: a rightward swipe anywhere opens it (the far-left edge belongs to Android's back gesture)
      if (!isOpen && scrollsX(e.target as Element)) return;
      const drawer = document.querySelector("[data-drawer]") as HTMLElement | null;
      st.current = { x: t.clientX, y: t.clientY, t: Date.now(), w: drawer?.offsetWidth || 300, mode: "pending", from: isOpen };
    };
    const onMove = (e: TouchEvent) => {
      const s = st.current;
      if (!s || s.mode === "ignore") return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (s.mode === "pending") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // must be clearly horizontal, in the right direction
        if (Math.abs(dx) < Math.abs(dy) * 1.2 || (!s.from && dx < 0) || (s.from && dx > 0)) {
          s.mode = "ignore";
          return;
        }
        s.mode = "drag";
        s.x = t.clientX; // start from here so the drawer doesn't jump
      }
      const base = s.from ? 1 : 0;
      setProgress(Math.min(1, Math.max(0, base + (t.clientX - s.x) / s.w)));
      if (e.cancelable) e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      const s = st.current;
      st.current = null;
      if (!s || s.mode !== "drag") return;
      const endX = e.changedTouches[0]?.clientX ?? s.x;
      const v = (endX - s.x) / Math.max(1, Date.now() - s.t); // px per ms
      const p = (s.from ? 1 : 0) + (endX - s.x) / s.w;
      // forgiving: a short or slow swipe is enough (30% of the drawer width, or a light flick)
      const shouldOpen = v > 0.3 ? true : v < -0.3 ? false : s.from ? p > 0.7 : p > 0.3;
      if (shouldOpen !== s.from) haptic("tap");
      setOpen(shouldOpen);
      setProgress(null);
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [setOpen]);

  return progress;
}
