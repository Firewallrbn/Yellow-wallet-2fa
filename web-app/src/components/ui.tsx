import { ChevronLeft, Zap } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-lg">
      <span className="grid size-8 place-items-center rounded-xl bg-yellow text-ink">
        <Zap className="size-4" strokeWidth={2.5} fill="currentColor" />
      </span>
      <span className={tone === "light" ? "text-white" : "text-ink"}>FastPay</span>
    </span>
  );
}

/** Botón circular de "volver", como en las pantallas de escaneo de FastPay. */
export function BackLink({ href, label = "Volver" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full bg-paper-2 text-ink transition hover:bg-white"
    >
      <ChevronLeft className="size-5" />
    </Link>
  );
}

export function Field({
  label,
  hint,
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm text-muted">{label}</span>
      <input
        {...props}
        className={`h-14 rounded-2xl border border-paper-2 bg-white px-5 text-base text-ink outline-none transition placeholder:text-muted/60 focus:border-ink ${className}`}
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "replay" }) {
  return (
    <p
      role="alert"
      className={
        tone === "replay"
          ? "rounded-2xl bg-ink px-5 py-4 text-sm text-white"
          : "rounded-2xl bg-[#f8e1e1] px-5 py-4 text-sm text-danger"
      }
    >
      {children}
    </p>
  );
}

export const pillClass =
  "inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-base font-medium text-white transition hover:bg-ink-3 disabled:cursor-wait disabled:opacity-60";
