"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { BackToMenu } from "@/components/back-to-menu";
import { BrandLogo } from "@/components/brand-logo";
import { FiberBackground } from "@/components/fiber-background";

const links = [
  { href: "/", label: "Indicadores", icon: "◫" },
  { href: "/monitoramento", label: "Monitoramento", icon: "◎" },
  { href: "/historico", label: "Histórico", icon: "↝" },
  { href: "/alertas", label: "Alertas", icon: "⚠" },
  { href: "/cameras", label: "Câmeras", icon: "▣" },
  { href: "/relatorios", label: "Relatórios", icon: "▤" },
  { href: "/motoristas", label: "Motoristas", icon: "👤" },
  { href: "/abastecimento", label: "Combustível", icon: "⛽" },
  { href: "/manutencao", label: "Manutenção", icon: "🔧" },
  { href: "/multas", label: "Multas", icon: "📋" },
  { href: "/checklist", label: "Checklist", icon: "✓" },
  { href: "/cercas", label: "Cercas", icon: "⬡" },
  { href: "/vehicles", label: "Minha frota", icon: "🚗" },
  { href: "/integrations", label: "Integrações", icon: "⚙" },
  { href: "/notificacoes", label: "Notificações", icon: "🔔" },
];

const adminLinks = [{ href: "/admin", label: "Administração", icon: "⚡" }];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isDriverApp =
    pathname === "/motorista" || pathname.startsWith("/motorista/");

  if (isDriverApp) {
    return (
      <main className="main driver-app">
        <BackToMenu />
        {children}
      </main>
    );
  }

  if (pathname.startsWith("/track/")) {
    return <main className="main public-track-layout">{children}</main>;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandLogo variant="sidebar" />
        </div>
        <nav className="nav">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
                <span className="nav-icon" aria-hidden="true">
                  {link.icon}
                </span>
                {link.label}
              </Link>
            );
          })}
          {user?.role === "ADMIN" &&
            adminLinks.map((link) => {
              const active = pathname.startsWith("/admin");
              return (
                <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
                  <span className="nav-icon" aria-hidden="true">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              );
            })}
        </nav>
        <div className="sidebar-user">
          <strong>{user?.name}</strong>
          <span>{user?.email}</span>
          <Link href="/motorista" className="btn btn-sidebar btn-sm">
            App Motorista
          </Link>
          <button type="button" className="btn btn-sidebar-outline btn-sm" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="main-topbar">
          <FiberBackground variant="strip" />
        </header>
        <main className="main">
          <BackToMenu />
          {children}
        </main>
      </div>
    </div>
  );
}
