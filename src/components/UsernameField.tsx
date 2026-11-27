"use client";

import { Check, Circle } from "lucide-react";
import { Field, cn, inputCls } from "./ui";
import { USERNAME_MAX, normalizeUsername, usernameChecks } from "@/lib/username";
import { tr } from "@/lib/i18n";

/** Username input (lowercased as you type) with a live checklist of the rules. */
export function UsernameField({ value, onChange, label = tr("Username") }: { value: string; onChange: (v: string) => void; label?: string }) {
  const checks = usernameChecks(value);
  return (
    <Field label={label}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft text-sm" aria-hidden>
          @
        </span>
        <input
          className={cn(inputCls, "pl-7")}
          value={value}
          onChange={(e) => onChange(normalizeUsername(e.target.value).replace(/\s+/g, "").slice(0, USERNAME_MAX))}
          placeholder={tr("mis. grace.natalia")}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          aria-describedby="username-rules"
        />
      </div>
      <ul id="username-rules" className="mt-2 space-y-1">
        {checks.map((c) => (
          <li key={c.label} className={cn("flex items-center gap-1.5 text-[length:calc(12px*var(--fs))]", c.ok ? "text-success" : "text-ink-soft")}>
            {c.ok ? <Check size={13} aria-hidden /> : <Circle size={11} className="mx-px" aria-hidden />}
            <span>{c.label}</span>
            <span className="sr-only">{c.ok ? tr("(terpenuhi)") : tr("(belum)")}</span>
          </li>
        ))}
      </ul>
    </Field>
  );
}
