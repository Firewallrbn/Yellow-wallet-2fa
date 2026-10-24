import type { Metadata } from "next";
import { JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FastPay",
  description: "Billetera digital con autenticación escalonada (2FA TOTP).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${outfit.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
