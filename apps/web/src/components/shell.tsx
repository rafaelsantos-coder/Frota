"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/vehicles", label: "Veículos" },
  { href: "/integrations", label: "Integrações" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Frota</h1>
        <p>GT06 + Jimi JC371</p>
        <nav className="nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? "active" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
