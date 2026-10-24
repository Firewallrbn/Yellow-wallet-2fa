import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CreditCard,
  House,
  LayoutGrid,
  LogOut,
  Plus,
  ReceiptText,
  ScanLine,
  Send,
  ShieldCheck,
  User,
  WalletCards,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { logout } from "@/app/actions";
import { backend, BackendError, type Transaction, type Vault } from "@/lib/backend";
import { getAccess } from "@/lib/session";
import { VisaCard } from "@/components/visa-card";

import { CardSecrets } from "./card-secrets";

export const metadata = { title: "Mi billetera · FastPay" };

export default function WalletPage() {
  return (
    <main className="min-h-screen bg-paper pb-28 lg:pb-12">
      {/* La sesión se lee en el request: va detrás de Suspense (Cache Components). */}
      <Suspense fallback={<WalletSkeleton />}>
        <VaultView />
      </Suspense>
    </main>
  );
}

async function loadVault(): Promise<Vault> {
  const token = await getAccess();
  if (!token) redirect("/login");
  try {
    // GET /api/boveda-secreta: FastAPI exige un access_token con mfa_verified: true.
    return await backend<Vault>("/api/boveda-secreta", { method: "GET", token });
  } catch (err) {
    if (err instanceof BackendError && (err.status === 401 || err.status === 403)) redirect("/login?expired=1");
    throw err;
  }
}

const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

function greeting() {
  const h = Number(new Intl.DateTimeFormat("es-CO", { hour: "numeric", hour12: false, timeZone: "America/Bogota" }).format(new Date()));
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

async function VaultView() {
  const vault = await loadVault();
  const initials = vault.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const method = vault.session.amr?.includes("backup") ? "código de respaldo" : "TOTP";
  const expires = new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone: "America/Bogota" }).format(
    new Date(vault.session.exp * 1000),
  );

  return (
    <>
      {/* Hoja negra superior */}
      <section className="rounded-b-[40px] bg-ink px-5 pb-8 pt-6 text-white sm:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-yellow font-semibold text-ink">{initials}</span>
              <div>
                <p className="text-sm text-white/70">{greeting()} 👋</p>
                <p className="text-xl font-medium">{vault.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs sm:inline-flex">
                <ShieldCheck className="size-4 text-yellow" /> 2FA verificado · {method}
              </span>
              <span className="grid size-11 place-items-center rounded-full bg-white/10" aria-hidden>
                <Bell className="size-5" />
              </span>
              <form action={logout}>
                <button type="submit" aria-label="Cerrar sesión" className="grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
                  <LogOut className="size-5" />
                </button>
              </form>
            </div>
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
            <div>
              <div className="rise">
                <VisaCard
                  balance={money(vault.balance, vault.currency)}
                  last4={vault.card_number.slice(-4)}
                  expiry={vault.card_expiry}
                />
              </div>
              <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
                <span className="size-1.5 rounded-full bg-white" />
                <span className="size-1.5 rounded-full bg-white/30" />
                <span className="size-1.5 rounded-full bg-white/30" />
              </div>
              <button type="button" disabled className="mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-ink">
                <Plus className="size-4" /> Agregar tarjeta
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <CardSecrets number={vault.card_number} cvv={vault.card_cvv} holder={vault.card_holder} expiry={vault.card_expiry} />
              <div className="grid grid-cols-3 gap-3 text-sm">
                <SessionStat label="mfa_verified" value={String(vault.session.mfa_verified)} accent />
                <SessionStat label="amr" value={vault.session.amr?.join(" + ") ?? "—"} />
                <SessionStat label="expira" value={expires} />
              </div>
              <p className="text-xs text-white/50">
                Te quedan {vault.backup_codes_remaining} códigos de respaldo de un solo uso.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Hoja color papel */}
      <section className="mx-auto mt-8 max-w-6xl px-5 sm:px-10">
        <div className="grid grid-cols-4 gap-3 sm:max-w-lg">
          {(
            [
              ["Depositar", WalletCards],
              ["Retirar", CreditCard],
              ["Enviar", Send],
              ["Más", LayoutGrid],
            ] as const
          ).map(([label, Icon]) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <span className="grid size-16 place-items-center rounded-full border border-paper-2 bg-[#e6e3dc]">
                <Icon className="size-5" />
              </span>
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-t-[32px] border-t border-paper-2 bg-paper pt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-medium">Transacciones recientes</h2>
            <span className="text-sm text-muted">{vault.transactions.length} movimientos</span>
          </div>
          <ul className="mt-4 grid gap-x-10 lg:grid-cols-2">
            {vault.transactions.map((t) => (
              <TransactionRow key={t.id} t={t} currency={vault.currency} />
            ))}
          </ul>
        </div>
      </section>

      {/* Barra inferior móvil con el botón de escaneo amarillo */}
      <nav className="fixed inset-x-3 bottom-3 z-20 flex items-center justify-between rounded-[28px] bg-ink px-6 py-3 text-[11px] text-white lg:hidden">
        <NavItem icon={House} label="Inicio" active />
        <NavItem icon={ReceiptText} label="Movimientos" />
        <span className="-mt-10 grid size-16 place-items-center rounded-full border-4 border-paper bg-yellow text-ink" aria-hidden>
          <ScanLine className="size-6" />
        </span>
        <NavItem icon={CreditCard} label="Tarjeta" />
        <NavItem icon={User} label="Cuenta" />
      </nav>
    </>
  );
}

function SessionStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/5 px-4 py-3">
      <p className="font-mono text-[11px] text-white/50">{label}</p>
      <p className={`mt-1 truncate font-mono ${accent ? "text-yellow" : ""}`}>{value}</p>
    </div>
  );
}

function TransactionRow({ t, currency }: { t: Transaction; currency: string }) {
  const incoming = t.amount > 0;
  const verb = { send: "Envío a", receive: "Recibido de", deposit: "Depósito en", withdraw: "Retiro de" }[t.kind];
  const time = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(t.occurred_at));
  return (
    <li className="flex items-center gap-4 border-b border-paper-2 py-4">
      <span className={`grid size-12 shrink-0 place-items-center rounded-full ${incoming ? "bg-warn-soft text-warn" : "bg-success-soft text-success"}`}>
        {incoming ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate">
          {verb} {t.counterparty}
        </p>
        <p className="text-sm text-muted">{time}</p>
      </div>
      <span className="font-medium tabular-nums">
        {incoming ? "+" : "−"}
        {money(Math.abs(t.amount), currency)}
      </span>
    </li>
  );
}

function NavItem({ icon: Icon, label, active = false }: { icon: typeof House; label: string; active?: boolean }) {
  return (
    <span className={`flex flex-col items-center gap-1 ${active ? "text-white" : "text-white/60"}`}>
      <Icon className="size-5" /> {label}
    </span>
  );
}

function WalletSkeleton() {
  return (
    <div aria-busy className="animate-pulse">
      <div className="h-[420px] rounded-b-[40px] bg-ink" />
      <div className="mx-auto mt-8 max-w-6xl space-y-4 px-5 sm:px-10">
        <div className="h-16 w-80 rounded-full bg-paper-2" />
        <div className="h-64 rounded-3xl bg-paper-2" />
      </div>
    </div>
  );
}
