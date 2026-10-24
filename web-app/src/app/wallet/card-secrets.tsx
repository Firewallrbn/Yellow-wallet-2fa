"use client";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState } from "react";

/** Los datos sensibles de la bóveda: ocultos por defecto, aunque la sesión ya tenga mfa_verified. */
export function CardSecrets({ number, cvv, holder, expiry }: { number: string; cvv: string; holder: string; expiry: string }) {
  const [shown, setShown] = useState(false);
  const grouped = number.match(/.{1,4}/g)?.join(" ") ?? number;

  return (
    <div className="rounded-[28px] bg-ink-2 p-6 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm text-white/70">
          <LockKeyhole className="size-4 text-yellow" /> Bóveda secreta
        </span>
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs transition hover:bg-white/20"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {shown ? "Ocultar" : "Mostrar datos"}
        </button>
      </div>
      <dl className="mt-5 grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-1">
        <dt className="text-xs text-white/50">Número</dt>
        <dt className="text-xs text-white/50">Vence</dt>
        <dt className="text-xs text-white/50">CVV</dt>
        <dd className="font-mono text-lg tracking-wider tabular-nums">{shown ? grouped : `•••• •••• •••• ${number.slice(-4)}`}</dd>
        <dd className="font-mono text-lg tabular-nums">{expiry}</dd>
        <dd className="font-mono text-lg tabular-nums">{shown ? cvv : "•••"}</dd>
      </dl>
      <p className="mt-4 text-xs uppercase tracking-widest text-white/40">{holder}</p>
    </div>
  );
}
