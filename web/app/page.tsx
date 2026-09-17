"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { api, isLoggedIn } from "@/lib/api";
import type { Settings } from "@/lib/settings";

type EduProgress = { total: number; completed: number; badge: string };
type TrainProgress = { total: number; attempted: number; best: number };
type Mood = { mood: string; created_at: string };

const MOOD_EMOJI: Record<string, string> = {
  senang: "😄",
  baik: "🙂",
  biasa: "😐",
  cemas: "😟",
  sedih: "😢",
};

const PILLARS = [
  { href: "/edukasi", icon: "menu_book", label: "Edukasi", desc: "Modul & kuis interaktif", tint: "bg-ocean-subtle text-primary-container" },
  { href: "/refleksi", icon: "mood", label: "Refleksi", desc: "Jurnal privat & emosi", tint: "bg-mint-subtle text-secondary" },
  { href: "/latihan", icon: "psychology", label: "Latihan", desc: "Simulasi respon asertif", tint: "bg-amber-subtle text-tertiary" },
  { href: "/lapor", icon: "shield_person", label: "Lapor Aman", desc: "Kanal rahasia", tint: "bg-support-teal-subtle text-support-teal" },
];

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [edu, setEdu] = useState<EduProgress | null>(null);
  const [train, setTrain] = useState<TrainProgress | null>(null);
  const [lastMood, setLastMood] = useState<Mood | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const ok = isLoggedIn();
    setAuthed(ok);
    // Kontak guru BK hanya ikut untuk yang sudah masuk — server yang menyaring.
    api<Settings>("/settings").then(setSettings).catch(() => {});
    if (!ok) return;
    // Sapaan dari bagian lokal email — tabel users tidak menyimpan nama.
    api<{ email: string }>("/auth/me")
      .then((me) => setName(me.email.split("@")[0]))
      .catch(() => {});
    api<EduProgress>("/education/progress").then(setEdu).catch(() => {});
    api<TrainProgress>("/training/progress").then(setTrain).catch(() => {});
    api<Mood[]>("/reflections/moods")
      .then((m) => setLastMood(m.at(-1) ?? null))
      .catch(() => {});
  }, []);

  if (authed === null) return <main className="flex-1 pt-16" />;
  if (!authed) return <Splash />;

  const eduPct = edu && edu.total > 0 ? Math.round((edu.completed / edu.total) * 100) : 0;

  return (
    <main className="flex-1 w-full pt-16 pb-24">
      <div className="max-w-2xl mx-auto w-full px-margin flex flex-col gap-space-lg pt-space-lg">
        <section>
          <span className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-mint-subtle text-secondary t-label-md">
            <Icon name="verified_user" filled className="text-[16px]" />
            Ruang terlindungi &amp; rahasia
          </span>
          <h1 className="t-display text-text-primary mt-space-sm">
            Halo, {name || "kamu"} <span aria-hidden>👋</span>
          </h1>
          <p className="t-body text-text-muted mt-1">
            Kamu berada di lingkungan yang aman &amp; mendukung hari ini.
          </p>
        </section>

        <section className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
          <div className="flex items-center justify-between gap-space-sm">
            <span className="t-label text-text-primary flex items-center gap-space-xs">
              <Icon name="spa" className="text-[20px] text-secondary" />
              Suasana hati terakhir
            </span>
            <Link href="/refleksi" className="t-label-md text-primary-container">
              Catat jurnal
            </Link>
          </div>
          <div className="flex items-center gap-space-sm mt-space-sm">
            <span className="text-3xl" aria-hidden>
              {lastMood ? MOOD_EMOJI[lastMood.mood] ?? "🙂" : "🌤️"}
            </span>
            <div className="flex flex-col">
              <span className="t-title text-text-primary capitalize">
                {lastMood ? lastMood.mood : "Belum ada catatan"}
              </span>
              <span className="t-label-md text-text-muted">
                {lastMood
                  ? new Date(lastMood.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                    })
                  : "Mulai dari satu kalimat saja."}
              </span>
            </div>
          </div>
        </section>

        <section>
          <h2 className="t-headline-sm text-text-primary mb-space-sm">Eksplorasi fitur</h2>
          <div className="grid grid-cols-2 gap-space-sm">
            {PILLARS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card flex flex-col gap-space-xs hover:border-primary-container transition"
              >
                <span className={`w-10 h-10 rounded-xl grid place-items-center ${p.tint}`}>
                  <Icon name={p.icon} className="text-[22px]" />
                </span>
                <span className="t-title text-text-primary">{p.label}</span>
                <span className="t-body-sm text-text-muted">{p.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        {(edu || train) && (
          <section className="flex flex-col gap-space-sm">
            <h2 className="t-headline-sm text-text-primary">Kemajuanmu</h2>

            {edu && edu.total > 0 && (
              <div className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
                <div className="flex items-center justify-between gap-space-sm">
                  <span className="t-title text-text-primary">Materi edukasi</span>
                  <span className="t-label text-primary-container">{eduPct}%</span>
                </div>
                <div
                  className="h-2 bg-surface-container-low rounded-full overflow-hidden mt-space-sm"
                  role="progressbar"
                  aria-valuenow={edu.completed}
                  aria-valuemin={0}
                  aria-valuemax={edu.total}
                  aria-label="Kemajuan belajar"
                >
                  <div className="h-full bg-primary-container rounded-full transition-all" style={{ width: `${eduPct}%` }} />
                </div>
                <div className="flex items-center justify-between mt-space-sm">
                  <span className="t-label-md text-text-muted">
                    {edu.completed} dari {edu.total} materi selesai
                    {edu.badge && ` • ${edu.badge}`}
                  </span>
                  <Link href="/edukasi" className="t-label-md text-primary-container inline-flex items-center gap-1">
                    Lanjutkan
                    <Icon name="arrow_forward" className="text-[16px]" />
                  </Link>
                </div>
              </div>
            )}

            {train && train.total > 0 && (
              <div className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
                <div className="flex items-center gap-space-sm">
                  <span className="w-10 h-10 rounded-xl bg-amber-subtle text-tertiary grid place-items-center shrink-0">
                    <Icon name="forum" className="text-[22px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="t-title text-text-primary">Skenario latihan</p>
                    <p className="t-label-md text-text-muted">
                      {train.attempted} dari {train.total} dicoba • {train.best} respons terbaik
                    </p>
                  </div>
                </div>
                <Link
                  href="/latihan"
                  className="mt-space-sm t-label min-h-12 w-full rounded-xl bg-surface-container-low text-primary grid place-items-center"
                >
                  Mulai latihan
                </Link>
              </div>
            )}
          </section>
        )}

        <section className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
          <div className="flex items-start gap-space-sm">
            <span className="w-10 h-10 rounded-xl bg-support-teal-subtle text-support-teal grid place-items-center shrink-0">
              <Icon name="verified" className="text-[22px]" />
            </span>
            <div>
              <h3 className="t-title text-text-primary">Butuh bantuan segera?</h3>
              <p className="t-body text-text-muted mt-1">
                Ingin cerita tanpa rasa takut?{" "}
                {settings?.bk_name ? `${settings.bk_name} siap mendengar` : "Guru BK sekolahmu siap mendengar"}
                {settings?.anonymous_enabled !== false && ", dan namamu bisa disembunyikan dari teman-temanmu"}.
              </p>
              {settings?.bk_phone && (
                <a
                  href={`tel:${settings.bk_phone}`}
                  className="t-label-md text-primary underline underline-offset-2 mt-1 inline-block"
                >
                  {settings.bk_phone}
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-space-sm mt-space-md">
            <Link
              href="/lapor"
              className="flex-1 min-h-12 rounded-xl bg-primary-container text-white t-label inline-flex items-center justify-center gap-space-xs"
            >
              <Icon name="security" className="text-[20px]" />
              Lapor aman
            </Link>
            <a
              href={`tel:${settings?.hotline_phone ?? "119"}`}
              aria-label={settings?.hotline_label ?? "Darurat 119"}
              className="min-h-12 px-space-md rounded-xl border border-border-subtle text-primary t-label inline-flex items-center gap-space-xs"
            >
              <Icon name="phone_in_talk" className="text-[20px]" />
              {settings?.hotline_phone ?? "119"}
            </a>
          </div>
        </section>

        <Link href="/lapor/status" className="t-label-md text-text-muted text-center underline underline-offset-2">
          Lacak laporan dengan kode tiket
        </Link>
      </div>
    </main>
  );
}

function Splash() {
  return (
    <main className="flex-1 w-full pt-16 pb-24 relative overflow-hidden">
      <div aria-hidden className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-ocean-subtle/80 blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-mint-subtle/70 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-sm mx-auto w-full px-margin flex flex-col items-center text-center gap-space-md pt-space-2xl">
        <div className="w-28 h-28 rounded-full bg-surface-card e-float grid place-items-center p-3">
          <Image src="/icons/logo.svg" alt="" width={96} height={96} className="w-full h-full object-contain" priority />
        </div>

        <h1 className="t-display text-text-primary">BERANI</h1>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ocean-subtle text-primary t-label-md">
          <Icon name="verified_user" filled className="text-[16px] text-support-teal" />
          Ruang aman sahabat remaja
        </span>

        <p className="t-title text-primary">Belajar, Edukasi, &amp; Aman Terhadap Bullying</p>
        <p className="t-body text-text-muted max-w-70">
          Ruang aman dan terpercaya bagi setiap siswa untuk berekspresi tanpa rasa cemas.
        </p>

        <div className="w-full flex flex-col gap-space-sm mt-space-lg">
          <Link
            href="/login"
            className="w-full min-h-12 rounded-xl bg-primary text-white t-label inline-flex items-center justify-center gap-space-xs e-float"
          >
            Mulai melangkah
            <Icon name="arrow_forward" className="text-[20px]" />
          </Link>
          {/* Melacak tiket memang tidak butuh akun — mengirim laporan butuh, jadi
              jangan menjanjikan sebaliknya di sini. */}
          <Link
            href="/lapor/status"
            className="w-full min-h-12 rounded-xl border border-border-subtle bg-surface-card text-text-primary t-label inline-flex items-center justify-center gap-space-xs"
          >
            <Icon name="find_in_page" className="text-[20px] text-primary-container" />
            Lacak laporan dengan kode tiket
          </Link>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low t-label-sm text-text-muted">
          <Icon name="lock" filled className="text-[14px] text-support-teal" />
          Dilindungi enkripsi &amp; dijaga kerahasiaannya
        </span>
      </div>
    </main>
  );
}
