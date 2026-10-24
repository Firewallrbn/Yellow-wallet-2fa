"use client";

import { KeyRound, ShieldAlert, Smartphone } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { verifySecondFactor } from "@/app/actions";
import { OtpInput, WindowCountdown } from "@/components/otp-input";
import { SubmitButton } from "@/components/submit-button";
import { ErrorNote, Field } from "@/components/ui";

type Method = "totp" | "backup";

export function VerifyForm() {
  const [method, setMethod] = useState<Method>("totp");
  const [state, action] = useActionState(verifySecondFactor, undefined);
  const expired = state?.code === "invalid_pre_auth_token" || state?.code === "too_many_attempts";

  return (
    <>
      <h1 className="text-4xl font-medium tracking-tight">
        {method === "totp" ? "Código de verificación" : "Código de respaldo"}
      </h1>
      <p className="mt-2 text-muted">
        {method === "totp"
          ? "Abre tu app Authenticator (funciona en modo avión) e ingresa los 6 dígitos."
          : "Usa uno de los códigos de emergencia que guardaste al activar el 2FA. Cada uno sirve una sola vez."}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-1 rounded-full bg-paper-2 p-1 text-sm">
        {(
          [
            ["totp", "App Authenticator", Smartphone],
            ["backup", "Código de respaldo", KeyRound],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMethod(value)}
            aria-pressed={method === value}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-full transition ${
              method === value ? "bg-white font-medium shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {/* key: el formulario se reinicia al cambiar de estrategia */}
      <form key={method} action={action} className="mt-8 flex flex-col gap-6">
        <input type="hidden" name="method" value={method} />
        {method === "totp" ? (
          <>
            <OtpInput />
            <WindowCountdown />
          </>
        ) : (
          <Field
            label="Código de respaldo"
            name="code"
            required
            autoFocus
            autoComplete="off"
            placeholder="ABCD-EFGH"
            className="font-mono uppercase"
          />
        )}

        {state?.error &&
          (state.code === "replay_attack_detected" ? (
            <ErrorNote tone="replay">
              <span className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-yellow" />
                <span>
                  <strong className="block font-medium">Ataque de repetición bloqueado</strong>
                  {state.error}. Espera el siguiente código de tu app.
                </span>
              </span>
            </ErrorNote>
          ) : (
            <ErrorNote>
              {state.error}
              {expired && (
                <>
                  {" "}
                  <Link href="/login" className="font-medium underline underline-offset-4">
                    Volver a ingresar
                  </Link>
                </>
              )}
            </ErrorNote>
          ))}

        <SubmitButton pendingLabel="Verificando en Prefect…">Verificar</SubmitButton>
      </form>
    </>
  );
}
