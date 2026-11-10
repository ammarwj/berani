"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { api, isLoggedIn } from "@/lib/api";
import type { Settings } from "@/lib/settings";
import { Alert, Field, LoginRequired, inputClass } from "@/components/ui";
import Icon from "@/components/Icon";

// Design menampilkan kategori sebagai grid chip. API menerima satu `category`,
// jadi semantiknya radio — chip-nya saja yang mengikuti design. Daftarnya datang
// dari /settings: tiap sekolah memakai kategorinya sendiri, dan server menolak
// kategori di luar daftar itu.

const MAX_FILE = 10 * 1024 * 1024;

export default function LaporPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [involved, setInvolved] = useState("");
  const [urgency, setUrgency] = useState("tidak_mendesak");
  const [anonymous, setAnonymous] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [ticket, setTicket] = useState("");
  const [copied, setCopied] = useState(false);
  const [attachNote, setAttachNote] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const loggedIn = isLoggedIn();
    setAuthed(loggedIn);
    if (loggedIn) {
      api<{ name: string }>("/auth/me")
        .then((me) => setName(me.name))
        .catch(() => {});
    }
    api<Settings>("/settings")
      .then((s) => {
        setSettings(s);
        setCategory(s.report_categories[0]?.value ?? "");
        // Sekolah bisa mematikan lapor anonim; server menolak kalau tetap dikirim.
        if (!s.anonymous_enabled) setAnonymous(false);
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (file && file.size > MAX_FILE) {
      setError("Lampiran maksimal 10 MB.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const { ticket_code } = await api<{ ticket_code: string }>("/reports", {
        method: "POST",
        body: JSON.stringify({
          category,
          description,
          location,
          involved,
          urgency,
          anonymous,
        }),
      });

      if (file) {
        const form = new FormData();
        form.append("file", file);
        await api(`/reports/${ticket_code}/attachments`, {
          method: "POST",
          body: form,
        }).catch(() =>
          setAttachNote("Laporan terkirim, tapi lampiran gagal diunggah."),
        );
      }
      setTicket(ticket_code);
    } catch {
      setError("Gagal mengirim laporan. Coba lagi sebentar lagi.");
    } finally {
      setSending(false);
    }
  }

  if (authed === false) {
    return (
      <main className="flex-1 w-full pt-16 pb-28">
        <div className="max-w-2xl mx-auto w-full px-margin pt-space-lg">
          <h1 className="t-headline-lg text-text-primary mb-space-md">Lapor</h1>
          <LoginRequired what="mengirim laporan" />
          <p className="t-body-sm text-text-muted mt-space-sm">
            Akunmu dipakai untuk mencegah laporan palsu dan agar guru pendamping
            bisa menindaklanjuti. Kalau kamu memilih Anonim, namamu tidak
            terlihat siapa pun selain guru pendamping — teman-temanmu tidak akan
            tahu.
          </p>
        </div>
      </main>
    );
  }

  if (ticket) {
    return (
      <main className="flex-1 w-full pt-16 pb-28">
        <div className="max-w-2xl mx-auto w-full px-margin pt-space-2xl text-center">
          <span className="w-16 h-16 rounded-full bg-mint-subtle text-secondary grid place-items-center mx-auto">
            <Icon name="check_circle" filled className="text-[32px]" />
          </span>
          <h1 className="t-headline-lg text-text-primary mt-space-md">
            Laporan Berhasil Dikirim
          </h1>
          <p className="t-label-md text-support-teal mt-space-xs">
            (Identitasmu terlindungi)
          </p>
          <p className="t-body text-text-muted mt-space-sm">
            Laporanmu telah diterima oleh guru BK. Tindak lanjut akan segera
            dilakukan ☺️
          </p>

          <div className="flex items-center gap-space-sm bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card mt-space-lg text-left">
            <div className="min-w-0 flex-1">
              <p className="t-label-sm uppercase text-text-muted">
                Kode tiket rahasia
              </p>
              {/* Inter (t-label) supaya 0/O dan 1/l tidak tertukar saat disalin manual. */}
              <p className="t-label text-xl text-primary select-all tracking-wider">
                {ticket}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(ticket).then(
                  () => setCopied(true),
                  () => {},
                );
              }}
              className="min-h-12 px-space-md rounded-xl bg-ocean-subtle text-primary t-label-md inline-flex items-center gap-space-xs shrink-0"
            >
              <Icon
                name={copied ? "check" : "content_copy"}
                className="text-[18px]"
              />
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>

          <p className="t-body text-text-primary mt-space-md">
            Kamu sudah berani berbuat hal yang tepat 🤗
          </p>

          {/* Kode tiket tetap disarankan disalin, tapi lupa menyalinnya bukan
              lagi kehilangan permanen — laporan tersimpan di akun pelapor. */}
          <p className="t-body-sm text-text-muted mt-space-sm">
            Simpan kodenya kalau bisa. Kalau lupa, kodenya tetap tersimpan di{" "}
            <Link href="/lapor/status" className="text-primary underline underline-offset-2">
              Lacak Laporan
            </Link>{" "}
            selama kamu masuk dengan akun ini.
          </p>

          {anonymous && (
            <p className="t-body-sm text-text-muted mt-space-xs">
              Laporan ini anonim — namamu tidak terlihat siswa lain, tetapi Guru BK tetap
              dapat melihatnya untuk menindaklanjuti.
            </p>
          )}
          {attachNote && (
            <div className="mt-space-md text-left">
              <Alert kind="error">{attachNote}</Alert>
            </div>
          )}

          <div className="mt-space-lg flex flex-col gap-space-sm">
            <Link
              href={`/lapor/status?ticket=${ticket}`}
              className="min-h-12 rounded-xl bg-primary-container text-white t-label grid place-items-center"
            >
              Lacak status laporan
            </Link>
            <Link
              href="/"
              className="t-label-md text-text-muted underline underline-offset-2"
            >
              Kembali ke beranda
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full pt-16 pb-28">
      <div className="max-w-2xl mx-auto w-full px-margin flex flex-col gap-space-md pt-space-lg">
        {/* "Enkripsi" diganti "Terlindungi": yang perlu siswa pahami adalah
            siapa yang bisa membaca laporannya, bukan teknologinya. Badge pindah
            ke baris sendiri supaya judulnya tidak terpotong di layar sempit. */}
        <section className="flex gap-space-sm bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
          <span className="w-10 h-10 rounded-xl bg-ocean-subtle text-primary-container grid place-items-center shrink-0">
            <Icon name="verified_user" filled className="text-[22px]" />
          </span>
          <div>
            <h1 className="t-headline-sm text-text-primary">
              Kanal rahasia dan aman
            </h1>
            <span className="t-label-sm uppercase px-2 py-0.5 rounded-full bg-ocean-subtle text-primary inline-block mt-1">
              Terlindungi
            </span>
            <p className="t-body text-text-muted mt-space-sm">
              Laporanmu dijaga kerahasiaannya dan hanya dapat diakses oleh Guru BK yang
              berwenang untuk menindaklanjuti laporan. Kamu tidak sendirian.
            </p>
          </div>
        </section>

        {/* Toggle disembunyikan saat sekolah mematikan lapor anonim — server juga
            menolaknya, jadi menampilkannya hanya menjanjikan yang tak bisa ditepati. */}
        {settings?.anonymous_enabled !== false && (
          <section className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
            <div className="flex items-center gap-space-sm">
              <span
                className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
                  anonymous
                    ? "bg-support-teal-subtle text-support-teal"
                    : "bg-surface-container-low text-text-muted"
                }`}
              >
                <Icon
                  name={anonymous ? "visibility_off" : "visibility"}
                  className="text-[22px]"
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-space-xs flex-wrap">
                  <p className="t-label text-text-primary">Mode laporan anonim</p>
                  {/* Status tertulis, bukan cuma posisi toggle: "AKTIF" tidak
                      bisa salah dibaca, sementara knop di kanan bisa. */}
                  <span
                    className={`t-label-sm uppercase px-2 py-0.5 rounded-full ${
                      anonymous
                        ? "bg-mint-subtle text-secondary"
                        : "bg-surface-container-low text-text-muted"
                    }`}
                  >
                    {anonymous ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <p className="t-body-sm text-text-muted mt-0.5">
                  {anonymous
                    ? "Namamu disembunyikan dari siswa lain, tetapi tetap dapat dilihat oleh Guru BK."
                    : name
                      ? <>Laporan dikirim dengan nama <strong>{name}</strong> tertera seperti biasa.</>
                      : "Laporan dikirim dengan namamu tertera seperti biasa."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={anonymous}
                aria-label="Kirim sebagai anonim"
                onClick={() => setAnonymous((v) => !v)}
                className={`w-13 h-7.5 rounded-full p-0.5 shrink-0 transition-colors ${
                  anonymous ? "bg-support-teal" : "bg-outline-variant"
                }`}
              >
                <span
                  className={`block w-6.5 h-6.5 rounded-full bg-white e-card transition-transform ${
                    anonymous ? "translate-x-5.5" : ""
                  }`}
                />
              </button>
            </div>

            {/* Kontrak anonimitas (CLAUDE.md): "anonim" = tersembunyi dari
                siswa lain, bukan dari Guru BK. Siswa harus membaca ini SEBELUM
                menekan kirim — itu yang menentukan keputusannya soal keselamatan
                dari pembalasan, jadi kalimatnya bukan hiasan. */}
            {anonymous && (
              <div className="bg-ocean-subtle rounded-xl px-3 py-2.5 mt-space-sm">
                <p className="flex items-center gap-space-xs t-label text-primary">
                  <Icon name="key" className="text-[18px] shrink-0" />
                  Perlu kamu ketahui
                </p>
                <p className="t-body-sm text-primary mt-1">
                  Meskipun mode anonim diaktifkan, Guru BK tetap dapat melihat identitasmu
                  {name && <> (<strong>{name}</strong>)</>} untuk membantu memeriksa dan
                  menindaklanjuti laporan. Siswa lain tidak dapat melihat identitas pelapor.
                </p>
              </div>
            )}
          </section>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-space-md">
          <fieldset className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
            <legend className="sr-only">Bentuk kejadian</legend>
            <div className="flex items-center gap-space-sm mb-space-sm">
              <span className="w-6 h-6 rounded-full bg-primary-container text-white grid place-items-center t-label-sm">
                1
              </span>
              <span className="t-label text-text-primary">
                Pilih bentuk kejadian
              </span>
            </div>
            <div className="grid gap-space-sm">
              {!settings && (
                <p className="t-body-sm text-text-muted">Memuat pilihan…</p>
              )}
              {settings?.report_categories.map((c) => {
                const picked = category === c.value;
                return (
                  <label
                    key={c.value}
                    className={`flex items-center gap-space-sm rounded-xl border p-3 cursor-pointer transition ${
                      picked
                        ? "border-primary-container bg-ocean-subtle"
                        : "border-border-subtle"
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={c.value}
                      checked={picked}
                      onChange={() => setCategory(c.value)}
                      className="sr-only"
                    />
                    <span
                      className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
                        picked
                          ? "bg-primary-container text-white"
                          : "bg-surface-container-low text-text-muted"
                      }`}
                    >
                      <Icon name={c.icon} className="text-[22px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="t-label text-text-primary block">
                        {c.label}
                      </span>
                      <span className="t-body-sm text-text-muted block">
                        {c.desc}
                      </span>
                    </span>
                    {picked && (
                      <Icon
                        name="check_circle"
                        filled
                        className="text-[20px] text-primary-container"
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card flex flex-col gap-space-md">
            <div className="flex items-center gap-space-sm">
              <span className="w-6 h-6 rounded-full bg-primary-container text-white grid place-items-center t-label-sm">
                2
              </span>
              <span className="t-label text-text-primary">
                Ceritakan kejadian
              </span>
            </div>

            <Field
              label="Apa yang terjadi?"
              hint="Sesingkat atau sedetail yang kamu rasa nyaman."
            >
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
                rows={5}
                placeholder="Kapan, di mana, dan apa yang kamu alami atau lihat…"
              />
            </Field>

            <Field label="Lokasi kejadian (opsional)">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={inputClass}
                placeholder="Misal: kantin, kelas 8B"
              />
            </Field>

            <Field
              label="Siapa yang terlibat? (opsional)"
              hint="Boleh dikosongkan kalau kamu ragu."
            >
              <input
                value={involved}
                onChange={(e) => setInvolved(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Seberapa mendesak?">
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className={inputClass}
              >
                <option value="tidak_mendesak">Tidak mendesak</option>
                <option value="mendesak">Mendesak</option>
                <option value="sangat_mendesak">
                  Sangat mendesak — ada yang dalam bahaya sekarang
                </option>
              </select>
            </Field>
          </div>

          <div className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
            <div className="flex items-center justify-between gap-space-sm mb-space-sm">
              <div className="flex items-center gap-space-sm">
                <span className="w-6 h-6 rounded-full bg-primary-container text-white grid place-items-center t-label-sm">
                  3
                </span>
                <span className="t-label text-text-primary">
                  Lampirkan bukti
                </span>
              </div>
              <span className="t-label-sm uppercase text-text-muted">
                Opsional
              </span>
            </div>

            {file ? (
              <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-3">
                <Icon name="attachment" className="text-[20px] text-primary" />
                <span className="t-body-sm text-text-primary truncate flex-1">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Hapus lampiran"
                  className="w-8 h-8 grid place-items-center rounded-lg text-text-muted hover:text-danger-rose"
                >
                  <Icon name="close" className="text-[18px]" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-space-xs rounded-xl border border-dashed border-border-subtle p-space-lg cursor-pointer text-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
                <span className="w-10 h-10 rounded-xl bg-ocean-subtle text-primary-container grid place-items-center">
                  <Icon name="add_photo_alternate" className="text-[22px]" />
                </span>
                <span className="t-body text-text-primary">
                  Ketuk untuk unggah tangkapan layar atau foto
                </span>
                <span className="t-body-sm text-text-muted">
                  PNG, JPG, WebP atau PDF — maks 10 MB
                </span>
              </label>
            )}
          </div>

          <p className="flex gap-space-xs t-body-sm text-secondary bg-mint-subtle rounded-xl px-3 py-2.5">
            <Icon name="volunteer_activism" className="text-[18px] shrink-0" />
            Laporanmu diteruskan ke guru BK dan tim perlindungan anak di
            sekolahmu.
          </p>

          {error && <Alert kind="error">{error}</Alert>}

          <button
            disabled={sending}
            className="min-h-12 rounded-xl bg-primary-container text-white t-label inline-flex items-center justify-center gap-space-xs disabled:opacity-50 e-float"
          >
            <Icon name="lock" className="text-[20px]" />
            {sending ? "Mengirim…" : "Kirim laporan dengan aman"}
          </button>

          <Link
            href="/lapor/status"
            className="t-label-md text-primary text-center underline underline-offset-2"
          >
            Sudah punya kode tiket? Lacak status laporan
          </Link>
        </form>
      </div>
    </main>
  );
}
