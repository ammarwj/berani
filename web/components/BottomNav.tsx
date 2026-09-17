"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { getRole } from "@/lib/api";
import { HIDE_SHELL, navItems } from "@/components/nav-routes";

export default function BottomNav() {
  const pathname = usePathname();
  // Role ada di localStorage, jadi baru terbaca setelah mount. Render awal
  // memakai nav siswa supaya markup server & klien cocok.
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => setRole(getRole()), [pathname]);
  const items = navItems(role);

  if (HIDE_SHELL.some((p) => pathname === p || pathname?.startsWith(`${p}/`))) return null;

  // Cocok terpanjang yang menang: /admin/materi berawalan /admin/, jadi tanpa ini
  // tab Laporan ikut menyala di halaman Materi.
  const current = items
    .filter((i) =>
      i.href === "/" ? pathname === "/" : pathname === i.href || pathname?.startsWith(`${i.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface-card/95 backdrop-blur-xl shadow-[0_-8px_24px_rgba(15,23,42,0.06)]"
    >
      {/* flex-1 supaya tiap tab selebar tab lain — kalau lebarnya mengikuti
          panjang label, "Lapor" jadi lebih sempit dari "Refleksi". */}
      <div className="flex items-center h-16 max-w-lg mx-auto px-space-xs">
        {items.map(({ href, label, icon }) => {
          const active = href === current;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-space-xs min-w-13 h-12 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-container ${
                active ? "text-primary-container" : "text-text-muted hover:text-text-primary"
              }`}
            >
              <Icon name={icon} filled={active} className="text-[24px]" />
              <span className="t-label-sm">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
