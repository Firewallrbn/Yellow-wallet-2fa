/** La tarjeta amarilla (o negra) de FastPay. */
export function VisaCard({
  balance,
  last4 = "4836",
  expiry = "08/32",
  tone = "yellow",
  className = "",
}: {
  balance: string;
  last4?: string;
  expiry?: string;
  tone?: "yellow" | "black";
  className?: string;
}) {
  const skin = tone === "yellow" ? "bg-yellow text-ink" : "bg-ink text-white ring-1 ring-white/10";
  return (
    <div className={`relative flex aspect-[1.7/1] w-full flex-col justify-between rounded-[28px] p-6 ${skin} ${className}`}>
      <div className="flex items-start justify-between">
        <span className="text-sm">Saldo total</span>
        <span className="text-2xl font-extrabold italic tracking-tighter">VISA</span>
      </div>
      <p className="text-4xl font-semibold tracking-tight tabular-nums sm:text-[2.6rem]">{balance}</p>
      <div className="flex items-end justify-between text-base">
        <span className="tracking-widest tabular-nums">**** **** **** {last4}</span>
        <span className="text-sm tabular-nums">{expiry}</span>
      </div>
    </div>
  );
}
