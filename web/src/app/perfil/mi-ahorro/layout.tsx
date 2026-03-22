import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi ahorro · Macetero",
  description: "Saldo en pesos, movimientos y referencia XLM",
};

export default function MiAhorroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
