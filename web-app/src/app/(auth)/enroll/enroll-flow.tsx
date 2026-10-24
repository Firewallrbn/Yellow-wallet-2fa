"use client";

import { BadgeCheck, Check, Copy, Download, LoaderCircle, QrCode, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { confirmEnrollment, type EnrollState, startEnrollment } from "@/app/actions";
import { OtpInput } from "@/components/otp-input";
import { SubmitButton } from "@/components/submit-button";
import { ErrorNote, pillClass } from "@/components/ui";

export function EnrollFlow() {
  const [enroll, setEnroll] = useState<EnrollState>(undefined);
  const [generating, startGenerating] = useTransition();
  const [confirm, confirmAction] = useActionState(confirmEnrollment, undefined);

  const generate = () => startGenerating(async () => setEnroll(await startEnrollment()));

  if (confirm?.backupCodes) return <EnrollSuccess codes={confirm.backupCodes} />;

  const enrollment = enroll?.enrollment;

  return (
    <>
      <StatusChip status={enrollment ? "PENDING_VERIFICATION" : "SIN_2FA"} />
      <h1 className="mt-4 text-4xl font-medium tracking-tight">Vincula tu Authenticator</h1>
      <p className="mt-2 text-muted">
        Generamos una semilla secreta de 160 bits. Escanéala con tu app; el 2FA solo queda activo cuando
        nos envíes el primer código válido.
      </p>

      {enroll?.error && <div className="mt-6"><ErrorNote>{enroll.error}</ErrorNote></div>}

      {!enrollment ? (
        <button type="button" onClick={generate} disabled={generating} className={`${pillClass} mt-8`}>
          {generating ? <LoaderCircle className="size-4 animate-spin" /> : <QrCode className="size-4" />}
          {generating ? "Generando…" : "Generar código QR"}
        </button>
      ) : (
        <>
          <div className="mt-8 rounded-[28px] border border-ink/80 p-3">
            <div className="flex flex-col items-center gap-4 rounded-[20px] bg-white p-6 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG generado por el backend */}
              <img src={enrollment.qr_svg} alt="Código QR otpauth://" className="size-44 shrink-0" />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-xs uppercase tracking-wide text-muted">¿Sin cámara? Clave manual</p>
                <SecretKey secret={enrollment.secret} />
                <button
                  type="button"
                  onClick={generate}
                  disabled={generating}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  <RefreshCw className={`size-3 ${generating ? "animate-spin" : ""}`} /> Regenerar (sigue en PENDING)
                </button>
              </div>
            </div>
          </div>

          <form action={confirmAction} className="mt-8 flex flex-col gap-5">
            <p className="text-sm text-muted">Ingresa el código que muestra tu app para confirmar:</p>
            <OtpInput autoFocus={false} />
            {confirm?.error && <ErrorNote tone={confirm.code === "replay_attack_detected" ? "replay" : "error"}>{confirm.error}</ErrorNote>}
            <SubmitButton pendingLabel="Confirmando…">Activar 2FA</SubmitButton>
          </form>
        </>
      )}
    </>
  );
}

function StatusChip({ status }: { status: "SIN_2FA" | "PENDING_VERIFICATION" | "ACTIVE" }) {
  const styles = {
    SIN_2FA: "bg-paper-2 text-muted",
    PENDING_VERIFICATION: "bg-warn-soft text-[#9a5512]",
    ACTIVE: "bg-success-soft text-success",
  }[status];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs ${styles}`}>
      <span className="size-1.5 rounded-full bg-current" /> {status}
    </span>
  );
}

function SecretKey({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="mt-1 inline-flex max-w-full items-center gap-2 text-left font-mono text-sm break-all hover:text-ink/70"
      title="Copiar clave"
    >
      <span>{secret.match(/.{1,4}/g)?.join(" ")}</span>
      {copied ? <Check className="size-4 shrink-0 text-success" /> : <Copy className="size-4 shrink-0" />}
    </button>
  );
}

/** Pantalla de éxito: la tarjeta negra con el sello verde de FastPay. */
function EnrollSuccess({ codes }: { codes: string[] }) {
  const download = () => {
    const blob = new Blob([`Códigos de respaldo FastPay (un solo uso)\n\n${codes.join("\n")}\n`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fastpay-codigos-respaldo.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="rounded-[32px] bg-ink p-8 text-center text-white">
      <BadgeCheck className="mx-auto size-16 fill-success text-ink" strokeWidth={1.5} />
      <h1 className="mt-4 text-3xl font-medium">¡2FA activado!</h1>
      <p className="mt-2 text-sm text-white/60">
        Estado <span className="font-mono text-yellow">PENDING_VERIFICATION → ACTIVE</span>. Guarda estos códigos de
        emergencia: no se volverán a mostrar.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="rounded-xl bg-white/5 py-2.5 tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={download}
        className="mt-4 inline-flex items-center gap-2 text-sm text-white/70 underline-offset-4 hover:text-white hover:underline"
      >
        <Download className="size-4" /> Descargar .txt
      </button>
      <Link
        href="/wallet"
        className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-full bg-white font-medium text-ink transition hover:bg-yellow"
      >
        Ir a mi billetera
      </Link>
    </div>
  );
}
