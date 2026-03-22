import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { AppShell } from "@/components/AppShell";
import { TrustlessEscrowProvider } from "@/components/TrustlessEscrowProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tandas y billetera",
  description: "Tandas, passkey en Stellar y rampa fiat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-[var(--mx-cream)] font-sans text-[var(--mx-ink)] antialiased">
        <WalletProvider>
          <TrustlessEscrowProvider>
            <AppShell>{children}</AppShell>
          </TrustlessEscrowProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
