import { ArrowRight, QrCode, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/ui";
import { VisaCard } from "@/components/visa-card";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-yellow lg:flex-row">
      {/* Panel blanco con la composición de tarjetas */}
      <section className="relative flex flex-col overflow-hidden bg-white lg:w-[46%] lg:rounded-r-[56px]">
        <header className="px-6 pt-6 sm:px-10">
          <Logo />
        </header>

        <div className="relative mx-auto mt-10 w-full max-w-md px-6 pb-56 sm:px-10 lg:mt-16">
          <div className="absolute right-6 top-0 w-[62%] rounded-3xl bg-gradient-to-b from-paper to-white p-5 shadow-sm sm:right-10">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-ink">Análisis de gastos</span>
              <span className="text-base font-medium tabular-nums">$1,487.59</span>
            </div>
            <span className="text-[10px] text-muted">Desde el mes pasado</span>
            <svg viewBox="0 0 200 80" className="mt-6 h-24 w-full" aria-hidden>
              <path
                d="M0 60 C 30 20, 50 70, 80 45 S 130 10, 150 50 S 185 75, 200 20"
                fill="none"
                stroke="var(--yellow-deep)"
                strokeWidth="2.5"
              />
            </svg>
          </div>
          <div className="rise relative top-16 w-[78%]" style={{ animationDelay: "120ms" }}>
            <VisaCard balance="$23,486.99" tone="black" className="shadow-2xl shadow-black/30" />
            <span className="absolute -bottom-6 left-0 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm shadow-md">
              <QrCode className="size-4" /> Pago fácil con QR
            </span>
          </div>
        </div>

        {/* La curva amarilla de la pantalla de onboarding */}
        <div className="absolute inset-x-0 bottom-0 h-72 rounded-t-[50%_40%] bg-yellow lg:hidden" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 hidden h-80 rounded-t-[60%_45%] bg-yellow lg:block" aria-hidden />
        <div className="relative z-10 mt-auto px-6 pb-10 sm:px-10">
          <h2 className="text-3xl font-medium leading-tight">
            Control total de
            <br />
            tus finanzas
          </h2>
          <p className="mt-3 max-w-sm text-sm text-ink/70">
            Administra tu dinero, ahorra con inteligencia y protege cada acceso con autenticación de dos factores.
          </p>
          <div className="mt-6 flex max-w-sm gap-3">
            <Link
              href="/register"
              className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-white transition hover:bg-ink-3"
            >
              Comenzar <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-14 items-center justify-center rounded-full border border-ink/20 px-6 transition hover:bg-ink/5"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </section>

      {/* Titular gigante sobre amarillo */}
      <section className="flex flex-1 flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <h1 className="rise text-6xl font-normal leading-[0.95] tracking-tight sm:text-7xl xl:text-[7.5rem]">
          <span className="underline decoration-[6px] underline-offset-[10px]">FastPay</span>
          <br />
          simplifica
          <br />
          tus pagos
        </h1>
        <p className="mt-10 max-w-xl text-xl leading-snug text-ink/85 sm:text-2xl">
          guardando todas tus tarjetas en una billetera digital fácil de usar, para transacciones rápidas y seguras.
        </p>
        <p className="mt-10 inline-flex max-w-xl items-center gap-3 text-sm text-ink/70">
          <ShieldCheck className="size-5 shrink-0" />
          Tu bóveda solo se abre con contraseña + un código TOTP de 6 dígitos generado sin conexión en tu teléfono.
        </p>
      </section>
    </main>
  );
}
