"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { haptic } from "@/lib/feedback";
import { cn } from "./ui";
import { tr } from "@/lib/i18n";

/** Hold this long (without moving) to pick a card up. Moving earlier = normal scrolling. */
const HOLD_MS = 350;
/** How far the finger may wander during the hold before it counts as scrolling. */
const MOVE_TOLERANCE = 8;
/** Auto-scroll when the dragged card is this close to the top/bottom of the screen. */
const EDGE_PX = 80;
const SCROLL_STEP = 14;

interface Drag {
  from: number;
  to: number;
  /** pointer Y and page scroll when the drag started */
  startY: number;
  startScroll: number;
  pointerY: number;
  scroll: number;
  /** vertical centre of every item, in page coordinates, measured at the start */
  mids: number[];
  /** how far the other cards move to make room: dragged card height + gap */
  shift: number;
}

export interface SortableHelpers {
  index: number;
  dragging: boolean;
  isFirst: boolean;
  isLast: boolean;
  moveUp(): void;
  moveDown(): void;
}

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function targetIndex(d: Pick<Drag, "from" | "mids" | "startY" | "startScroll">, pointerY: number, scroll: number) {
  const centre = d.mids[d.from] + (pointerY + scroll) - (d.startY + d.startScroll);
  let to = d.from;
  for (let i = d.from + 1; i < d.mids.length; i++) if (centre > d.mids[i]) to = i;
  if (to === d.from) for (let i = d.from - 1; i >= 0; i--) if (centre < d.mids[i]) to = i;
  return to;
}

/**
 * Vertical list you reorder by holding a card and dragging it (touch or mouse).
 * Works without any drag-and-drop library; the page still scrolls normally unless a card is held.
 */
export function SortableList<T>({
  items,
  getKey,
  onReorder,
  renderItem,
  className,
  label = tr("Daftar yang bisa diurutkan"),
}: {
  items: T[];
  getKey: (item: T) => string;
  onReorder: (next: T[], moved: { item: T; from: number; to: number }) => void;
  renderItem: (item: T, h: SortableHelpers) => ReactNode;
  className?: string;
  label?: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [settling, setSettling] = useState(false);
  /** Source of truth for event handlers (updated immediately, before React re-renders). */
  const dragRef = useRef<Drag | null>(null);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // keep listeners stable even when the parent passes a new callback every render
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const cancelPending = () => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  };

  const begin = (index: number, x: number, y: number) => {
    cancelPending();
    pending.current = {
      x,
      y,
      timer: setTimeout(() => {
        pending.current = null;
        const els = Array.from(listRef.current?.children ?? []) as HTMLElement[];
        if (!els[index]) return;
        const scroll = window.scrollY;
        const rects = els.map((e) => e.getBoundingClientRect());
        const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
        const d: Drag = {
          from: index,
          to: index,
          startY: y,
          startScroll: scroll,
          pointerY: y,
          scroll,
          mids: rects.map((r) => r.top + scroll + r.height / 2),
          shift: rects[index].height + gap,
        };
        dragRef.current = d;
        setDrag(d);
        haptic("select");
      }, HOLD_MS),
    };
  };

  const update = useCallback((pointerY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const scroll = window.scrollY;
    const to = targetIndex(d, pointerY, scroll);
    if (to !== d.to) haptic("tap");
    const next = { ...d, pointerY, scroll, to };
    dragRef.current = next;
    setDrag(next);
  }, []);

  const finish = useCallback(() => {
    cancelPending();
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (d.to !== d.from) {
      const list = itemsRef.current;
      // no transition for one frame: the new order lands exactly where the cards were shown
      setSettling(true);
      onReorderRef.current(move(list, d.from, d.to), { item: list[d.from], from: d.from, to: d.to });
      requestAnimationFrame(() => requestAnimationFrame(() => setSettling(false)));
    }
    setDrag(null);
  }, []);

  // global listeners: touch (non-passive, so a held card can stop the page from scrolling) + mouse
  useEffect(() => {
    const moved = (x: number, y: number) => {
      const p = pending.current;
      if (p && (Math.abs(x - p.x) > MOVE_TOLERANCE || Math.abs(y - p.y) > MOVE_TOLERANCE)) cancelPending();
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (dragRef.current) {
        if (e.cancelable) e.preventDefault();
        update(t.clientY);
      } else moved(t.clientX, t.clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (dragRef.current) {
        e.preventDefault();
        update(e.clientY);
      } else moved(e.clientX, e.clientY);
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", finish);
    document.addEventListener("touchcancel", finish);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", finish);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", finish);
      document.removeEventListener("touchcancel", finish);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", finish);
      cancelPending();
    };
  }, [update, finish]);

  // auto-scroll near the screen edges while dragging
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    let raf = 0;
    const tick = () => {
      const d = dragRef.current;
      if (d) {
        const dy = d.pointerY < EDGE_PX ? -SCROLL_STEP : d.pointerY > window.innerHeight - EDGE_PX ? SCROLL_STEP : 0;
        if (dy) {
          window.scrollBy(0, dy);
          update(d.pointerY);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dragging, update]);

  const step = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= items.length) return;
    haptic("tap");
    onReorder(move(items, index, to), { item: items[index], from: index, to });
  };

  return (
    <ul ref={listRef} className={cn("select-none [-webkit-touch-callout:none]", className)} aria-label={label} data-no-swipe>
      {items.map((item, i) => {
        const isDragged = drag?.from === i;
        let offset = 0;
        if (drag && !isDragged) {
          if (drag.from < drag.to && i > drag.from && i <= drag.to) offset = -drag.shift;
          else if (drag.to < drag.from && i >= drag.to && i < drag.from) offset = drag.shift;
        }
        const translate = isDragged && drag ? drag.pointerY + drag.scroll - (drag.startY + drag.startScroll) : offset;
        return (
          <li
            key={getKey(item)}
            onTouchStart={(e) => begin(i, e.touches[0].clientX, e.touches[0].clientY)}
            onMouseDown={(e) => e.button === 0 && begin(i, e.clientX, e.clientY)}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              "relative",
              isDragged ? "z-20 cursor-grabbing" : "cursor-grab",
              !isDragged && !settling && "transition-transform duration-200 ease-out",
            )}
            style={{ transform: translate ? `translateY(${translate}px)` : undefined }}
          >
            <div className={cn("transition-[transform,box-shadow] duration-150 rounded-2xl", isDragged && "scale-[1.03] shadow-[0_12px_30px_-8px_rgba(0,0,0,.35)]")}>
              {renderItem(item, {
                index: i,
                dragging: isDragged,
                isFirst: i === 0,
                isLast: i === items.length - 1,
                moveUp: () => step(i, -1),
                moveDown: () => step(i, 1),
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
