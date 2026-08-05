"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/perfis", label: "Perfis de acesso" },
  { href: "/admin/logs", label: "Log do sistema" },
  { href: "/admin/veiculos", label: "Configuração de veículos" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "active" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
