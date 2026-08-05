import { AuthProvider } from "@/components/auth-provider";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sulnet Gestão de Frota",
  description: "Plataforma Sulnet — rastreamento GT06 + câmera Jimi JC371",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#ff5500",
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
