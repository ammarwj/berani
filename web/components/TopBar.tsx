"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { api, clearSession, isAdmin as roleIsAdmin, isLoggedIn } from "@/lib/api";
import { HIDE_SHELL } from "@/components/nav-routes";

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const loggedIn = isLoggedIn();
    setAuthed(loggedIn);
    setIsAdmin(roleIsAdmin());
    if (!loggedIn) {
      setEmail("");
      return;
    }
    // Tabel users tidak punya kolom nama, jadi avatar memakai huruf pertama email.
    api<{ email: string }>("/auth/me")
      .then((me) => setEmail(me.email))
      .catch(() => setEmail(""));
  }, [pathname]);

  // Splash di "/" (belum masuk) tampil penuh layar seperti halaman auth — baru
  // dapat header setelah login, saat "/" berubah jadi dashboard.
  if (
    HIDE_SHELL.some((p) => pathname === p || pathname?.startsWith(`${p}/`)) ||
    (pathname === "/" && !authed)
  )
    return null;

  function logout() {
    clearSession();
    setAuthed(false);
    setIsAdmin(false);
    router.push("/login");
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-surface-card/90 backdrop-blur-xl shadow-[0_4px_20px_-4px_rgba(37,99,235,0.06)] pt-safe">
      <div className="h-16 px-margin max-w-3xl mx-auto flex items-center justify-between gap-space-sm">
        {/* Beranda guru/admin adalah dashboard laporan, bukan dashboard siswa. */}
        <Link href={isAdmin ? "/admin" : "/"} className="flex items-center gap-space-sm">
          <Image src="/icons/logo.svg" alt="" width={32} height={32} className="h-8 w-8" priority />
          <span className="t-headline-sm font-bold text-text-primary tracking-tight">BERANI</span>
        </Link>

        <div className="flex items-center gap-space-sm">
          {isAdmin && (
            <span className="t-label-sm uppercase px-2.5 py-1 rounded-full bg-amber-subtle text-tertiary">
              Pendamping
            </span>
          )}
          {authed ? (
            <>
              <span
                aria-hidden
                className="w-9 h-9 rounded-full bg-ocean-subtle text-primary-container grid place-items-center t-label ring-2 ring-primary-container/20 uppercase"
              >
                {email.charAt(0) || "?"}
              </span>
              <button
                onClick={logout}
                aria-label="Keluar"
                className="w-9 h-9 grid place-items-center rounded-full text-text-muted hover:text-primary-container"
              >
                <Icon name="logout" className="text-[20px]" />
              </button>
            </>
          ) : (
            <Link href="/login" className="t-label text-primary-container px-2 py-1">
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
