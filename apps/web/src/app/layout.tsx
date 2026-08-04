import { AuthProvider } from "@/components/auth-provider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frota — Gestão de Frotas",
  description: "Plataforma de rastreamento GT06 + câmera Jimi JC371",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
