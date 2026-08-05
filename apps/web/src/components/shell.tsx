"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

const links = [
  { href: "/monitoramento", label: "Monitoramento" },
  { href: "/", label: "Dashboard" },
  { href: "/historico", label: "Histórico" },
  { href: "/alertas", label: "Alertas" },
  { href: "/cameras", label: "Câmeras" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/motoristas", label: "Motoristas" },
  { href: "/abastecimento", label: "Abastecimento" },
  { href: "/manutencao", label: "Manutenção" },
  { href: "/multas", label: "Multas" },
  { href: "/checklist", label: "Checklist" },
  { href: "/cercas", label: "Cercas" },
  { href: "/vehicles", label: "Veículos" },
  { href: "/integrations", label: "Integrações" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (pathname.startsWith("/motorista")) {
    return <main className="main driver-app">{children}</main>;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Sulnet</h1>
        <p>Gestão de Frota</p>
        <nav className="nav">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={link.href} className={active ? "active" : undefined}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <strong>{user?.name}</strong>
          <span>{user?.email}</span>
          <Link href="/motorista" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}>
            App Motorista
          </Link>
          <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
