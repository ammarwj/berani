"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { AuthButton } from "@/components/ui";
import { isLoggedIn, markPanduanSeen } from "@/lib/api";

// Pengenalan, bukan urutan wajib: tiap fitur berdiri sendiri dan siswa boleh
// masuk dari mana saja. Karena itu halaman ini tidak punya langkah "berikutnya"
// dan tidak mengunci menu apa pun — satu layar baca, lalu lepas.
const FEATURES = [
  {
    icon: "menu_book",
    tint: "bg-ocean-subtle text-primary-container",
    title: "Edukasi",
    desc: "Pelajari informasi seputar bullying, jenis-jenisnya, dampaknya, dan cara mencari bantuan.",
  },
  {
    icon: "psychology",
    tint: "bg-amber-subtle text-tertiary",
    title: "Skenario/Latihan",
    desc: "Belajar memahami berbagai situasi bullying dan menentukan respons yang tepat lewat contoh kasus.",
  },
  {
    icon: "mood",
    tint: "bg-mint-subtle text-secondary",
    title: "Refleksi",
    desc: "Kenali perasaanmu, ceritakan apa yang sedang kamu rasakan, dan temukan langkah untuk mencari bantuan. Jurnalmu terenkripsi dan hanya kamu yang bisa membacanya.",
  },
  {
    icon: "shield_person",
    tint: "bg-support-teal-subtle text-support-teal",
    title: "Pelaporan",
    desc: "Sampaikan laporan jika kamu melihat atau mengalami bullying agar guru BK dapat membantu menindaklanjutinya.",
  },
];

export default function PanduanPage() {
  const router = useRouter();

  // Halaman ini hanya titik masuk sesudah login; dibuka langsung tanpa sesi
  // akan berujung ke beranda splash yang sama saja — jadi arahkan ke login.
  useEffect(() => {
    if (!isLoggedIn()) router.replace("/login");
  }, [router]);

  return (
    <main className="flex-1 w-full pt-safe pb-safe relative overflow-hidden">
      <div aria-hidden className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-ocean-subtle/80 blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute -bottom-28 -right-16 w-64 h-64 rounded-full bg-mint-subtle/60 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto w-full px-margin py-space-xl flex flex-col gap-space-lg">
        <header className="flex flex-col gap-space-xs">
          <span className="self-start inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-ocean-subtle text-primary t-label-md">
            <Icon name="lightbulb" filled className="text-[16px]" />
            Pengenalan aplikasi
          </span>
          <h1 className="t-headline-lg text-text-primary mt-space-xs">
            Selamat datang di BERANI! <span aria-hidden>👋</span>
          </h1>
          <p className="t-body text-text-muted">
            Yuk, kenali fitur-fitur yang bisa kamu gunakan.
          </p>
        </header>

        <ol className="grid sm:grid-cols-2 gap-space-sm">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card flex gap-space-sm"
            >
              <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${f.tint}`}>
                <Icon name={f.icon} className="text-[22px]" />
              </span>
              <div className="min-w-0">
                <p className="t-title text-text-primary">
                  {i + 1}. {f.title}
                </p>
                <p className="t-body-sm text-text-muted mt-1">{f.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="bg-surface-container-low border border-border-subtle rounded-2xl p-space-md">
          <p className="t-label text-text-primary flex items-center gap-space-xs">
            <Icon name="info" className="text-[20px] text-primary-container" />
            Perlu kamu ketahui
          </p>
          <p className="t-body-sm text-text-muted mt-space-xs">
            Kamu bebas memilih fitur mana yang ingin digunakan terlebih dahulu. Tidak ada urutan
            wajib. Kamu bisa memulai dari Edukasi, Latihan, Refleksi, atau langsung menuju
            Pelaporan.
          </p>
          {/* Kontrak anonimitas (CLAUDE.md): "anonim" = tersembunyi dari siswa
              lain, bukan dari guru pendamping. Siswa harus tahu itu sebelum
              memakai kanal lapor, bukan setelah. */}
          <p className="t-body-sm text-text-muted mt-space-sm">
            Saat melapor, kamu bisa memilih mode anonim agar namamu tidak terlihat oleh siswa
            lain. Guru pendamping tetap melihat identitasmu supaya laporanmu bisa ditindaklanjuti
            dan kamu bisa dilindungi.
          </p>
        </section>

        <AuthButton
          type="button"
          onClick={() => {
            markPanduanSeen();
            router.replace("/");
          }}
          className="w-full sm:w-auto sm:self-center sm:px-space-2xl"
        >
          Mengerti, Lanjutkan
          <Icon name="arrow_forward" className="text-[20px]" />
        </AuthButton>
      </div>
    </main>
  );
}
