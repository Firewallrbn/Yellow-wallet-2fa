"use client";

import { useEffect, useState } from "react";

/** Un solo <input> real (accesible, pegable) dibujado como 6 casillas al estilo FastPay. */
export function OtpInput({ name = "code", length = 6, autoFocus = true }: { name?: string; length?: number; autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={`\\d{${length}}`}
        maxLength={length}
        required
        autoFocus={autoFocus}
        aria-label="Código de 6 dígitos"
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="grid grid-cols-6 gap-2 sm:gap-3" aria-hidden>
        {Array.from({ length }, (_, i) => {
          const active = focused && i === Math.min(value.length, length - 1);
          return (
            <div
              key={i}
              className={`grid aspect-[4/5] place-items-center rounded-2xl border bg-white font-mono text-3xl transition ${
                active ? "border-ink ring-4 ring-yellow/60" : "border-paper-2"
              }`}
            >
              {value[i] ?? ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Barra amarilla de la ventana TOTP actual (reloj del navegador), como la del escaneo de FastPay. */
export function WindowCountdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now() / 1000);
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, []);

  const remaining = now === null ? 30 : 30 - Math.floor(now % 30);
  const progress = now === null ? 0 : (now % 30) / 30;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm text-muted">Tu código cambia en</span>
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-yellow transition-[width] duration-200" style={{ width: `${(1 - progress) * 100}%` }} />
      </div>
      <span className="text-xl font-semibold tabular-nums">{remaining} s</span>
    </div>
  );
}
