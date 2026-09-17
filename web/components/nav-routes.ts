import { isAdmin, isSuperAdmin } from "@/lib/api";

// Halaman yang berdiri sendiri: splash & alur auth tampil penuh layar tanpa
// header/nav, seperti di design/masuk_akun_berani dan splash_screen_berani.
export const HIDE_SHELL = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

const SISWA_NAV = [
  { href: "/", label: "Beranda", icon: "home" },
  { href: "/edukasi", label: "Edukasi", icon: "menu_book" },
  { href: "/refleksi", label: "Refleksi", icon: "mood" },
  { href: "/latihan", label: "Latihan", icon: "psychology" },
  { href: "/lapor", label: "Lapor", icon: "shield" },
];

// Guru/admin tidak punya jurnal refleksi (privat per siswa) maupun form lapor —
// `POST /reports` memang terbuka untuk mereka, tapi kanal itu untuk pelapor,
// bukan penindak. Materi & Skenario menggantikan Edukasi/Latihan: dari editor
// ada tombol "Pratinjau" ke tampilan siswanya.
const ADMIN_NAV = [
  { href: "/admin", label: "Laporan", icon: "shield_person" },
  { href: "/admin/materi", label: "Materi", icon: "menu_book" },
  { href: "/admin/skenario", label: "Skenario", icon: "psychology" },
];

const SUPER_NAV = [
  ...ADMIN_NAV,
  { href: "/admin/pengguna", label: "Pengguna", icon: "manage_accounts" },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: "settings" },
];

export function navItems(role: string | null) {
  if (isSuperAdmin(role)) return SUPER_NAV;
  return isAdmin(role) ? ADMIN_NAV : SISWA_NAV;
}
