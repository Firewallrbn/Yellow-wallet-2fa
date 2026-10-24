import { Logo } from "@/components/ui";
import { VisaCard } from "@/components/visa-card";

/** Pantallas de autenticación: hoja color papel a la izquierda, panel negro con la tarjeta a la derecha. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen bg-paper">
      <section className="flex w-full flex-col px-6 py-6 sm:px-10 lg:w-1/2 xl:px-20">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">{children}</div>
      </section>

      <aside className="relative hidden w-1/2 overflow-hidden bg-ink p-10 lg:flex lg:flex-col">
        <Logo tone="light" />
        <div className="relative m-auto w-full max-w-md">
          <div className="absolute -inset-16 rounded-full bg-yellow/10 blur-3xl" aria-hidden />
          <div className="relative -rotate-6">
            <VisaCard balance="$23,486.99" className="shadow-2xl shadow-black/60" />
          </div>
          <div className="relative mx-auto -mt-4 h-14 w-[88%] rounded-full bg-white" aria-hidden />
        </div>
        <p className="max-w-sm text-sm text-white/60">
          Autenticación escalonada: tu contraseña solo abre la puerta al segundo factor. La bóveda exige{" "}
          <span className="font-mono text-yellow">mfa_verified: true</span>.
        </p>
      </aside>
    </main>
  );
}
