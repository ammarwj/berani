"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, isLoggedIn } from "@/lib/api";
import { PageHeader, Card, Button, Alert, inputClass, StatusBadge } from "@/components/ui";
import Icon from "@/components/Icon";

type Note = { note: string; status_after: string; created_at: string };
type Status = { status: string; category: string; created_at: string; notes?: Note[] };

// Laporan milik akun yang sedang masuk — supaya kode tiket yang lupa disalin
// tidak berarti laporannya hilang selamanya. Sejak revisi 0005 user_id selalu
// diisi, termasuk untuk laporan anonim, jadi daftar ini lengkap kecuali untuk
// laporan anonim pra-0005 yang memang tidak pernah menyimpan pelapornya.
type MyReport = {
  id: string;
  category: string;
  status: string;
  created_at: string;
  anonymous: boolean;
  ticket_code: string;
};

const STEPS = ["diterima", "diproses", "ditindaklanjuti", "selesai"];

const EXPLAIN: Record<string, string> = {
  diterima: "Laporanmu sudah masuk dan menunggu ditinjau guru pendamping.",
  diproses: "Guru pendamping sedang meninjau laporanmu.",
  ditindaklanjuti: "Sekolah sedang mengambil tindakan atas laporanmu.",
  selesai: "Penanganan laporan ini sudah selesai.",
};

const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

function StatusLookup() {
  const params = useSearchParams();
  const [ticket, setTicket] = useState(params.get("ticket") ?? "");
  const [result, setResult] = useState<Status | null>(null);
  const [mine, setMine] = useState<MyReport[]>([]);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookup(code: string) {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await api<Status>(`/reports/${encodeURIComponent(code.trim())}`));
    } catch {
      setError("Kode tiket tidak ditemukan. Periksa lagi penulisannya.");
    } finally {
      setLoading(false);
    }
  }

  // Deep link from the submit confirmation resolves immediately.
  useEffect(() => {
    const code = params.get("ticket");
    if (code) lookup(code);
    // Daftar laporan sendiri hanya untuk yang masuk akun; melacak lewat kode
    // tiket tetap tidak butuh login.
    if (isLoggedIn()) api<MyReport[]>("/reports/mine").then(setMine).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (ticket.trim()) lookup(ticket);
  }

  function salin(code: string) {
    navigator.clipboard?.writeText(code).then(() => setCopied(code), () => {});
  }

  const stepIndex = result ? STEPS.indexOf(result.status) : -1;
  const notes = result?.notes ?? [];

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-16 pb-28">
      <div className="pt-space-lg">
      <PageHeader
        icon="find_in_page"
        title="Lacak Laporan"
        subtitle="Masukkan kode tiket. Tidak perlu masuk ke akun."
      />

      <form onSubmit={onSubmit} className="flex gap-space-sm mb-space-lg">
        <input
          value={ticket}
          onChange={(e) => setTicket(e.target.value)}
          placeholder="BRN-xxxxxxxxxxxx"
          className={`${inputClass} t-label tracking-wider`}
          aria-label="Kode tiket"
        />
        <Button disabled={loading}>{loading ? "…" : "Cek"}</Button>
      </form>

      {error && <Alert kind="error">{error}</Alert>}

      {result && (
        <Card>
          <div className="flex items-center justify-between mb-space-sm">
            <span className="t-label-md text-text-muted capitalize">{result.category}</span>
            <StatusBadge status={result.status} />
          </div>

          <ol className="flex flex-col gap-space-sm">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-space-sm">
                <span
                  aria-hidden
                  className={`w-6 h-6 rounded-full grid place-items-center t-label-sm shrink-0 ${
                    i <= stepIndex ? "bg-primary-container text-white" : "bg-surface-container-low text-text-muted"
                  }`}
                >
                  {i <= stepIndex ? <Icon name="check" className="text-[14px]" /> : i + 1}
                </span>
                <span className={`t-body capitalize ${i <= stepIndex ? "text-text-primary" : "text-text-muted"}`}>
                  {s}
                </span>
              </li>
            ))}
          </ol>

          <p className="t-body text-text-muted mt-space-md">{EXPLAIN[result.status]}</p>
          <p className="t-label-md text-text-muted mt-space-xs">
            Dilaporkan {tanggal(result.created_at)}
          </p>

          {/* Hanya catatan yang guru BK tandai terlihat pelapor — bukan seluruh
              riwayat penanganan. Halaman ini terbuka bagi siapa pun yang
              memegang kode tiket, jadi yang tampil di sini adalah pesan untuk
              pelapor, bukan catatan audit internal. */}
          {notes.length > 0 && (
            <div className="mt-space-md pt-space-md border-t border-border-subtle">
              <p className="t-label text-text-primary flex items-center gap-space-xs">
                <Icon name="chat_bubble" className="text-[18px] text-primary-container" />
                Pesan dari Guru BK
              </p>
              <ul className="flex flex-col gap-space-sm mt-space-sm">
                {notes.map((n, i) => (
                  <li key={i} className="rounded-xl bg-ocean-subtle px-3 py-2.5">
                    <p className="t-body text-text-primary whitespace-pre-line wrap-break-word">
                      {n.note}
                    </p>
                    <p className="t-label-sm text-text-muted mt-1">{tanggal(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Kode tiket tersimpan: siswa yang lupa menyalinnya tetap bisa menemukan
          laporannya selama ia masuk dengan akun yang sama. */}
      {mine.length > 0 && (
        <section className="mt-space-lg">
          <h2 className="t-headline-sm text-text-primary">Laporan yang kamu kirim</h2>
          <p className="t-body-sm text-text-muted mt-1">
            Kode tiketmu tersimpan di sini. Ketuk salah satu untuk melihat statusnya.
          </p>
          <ul className="flex flex-col gap-space-sm mt-space-sm">
            {mine.map((m) => (
              <li
                key={m.id}
                className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card"
              >
                <div className="flex items-center justify-between gap-space-sm flex-wrap">
                  <span className="t-label-md text-text-muted capitalize">{m.category}</span>
                  <StatusBadge status={m.status} />
                </div>
                <div className="flex items-center gap-space-sm mt-space-sm">
                  {/* Inter (t-label) supaya 0/O dan 1/l tidak tertukar saat dibaca. */}
                  <span className="t-label text-primary tracking-wider select-all flex-1 min-w-0 truncate">
                    {m.ticket_code}
                  </span>
                  <button
                    type="button"
                    onClick={() => salin(m.ticket_code)}
                    aria-label={`Salin kode tiket ${m.ticket_code}`}
                    className="min-h-9 px-3 rounded-lg bg-ocean-subtle text-primary t-label-md inline-flex items-center gap-space-xs shrink-0"
                  >
                    <Icon
                      name={copied === m.ticket_code ? "check" : "content_copy"}
                      className="text-[16px]"
                    />
                    {copied === m.ticket_code ? "Tersalin" : "Salin"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTicket(m.ticket_code);
                      lookup(m.ticket_code);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="min-h-9 px-3 rounded-lg bg-primary-container text-white t-label-md shrink-0"
                  >
                    Cek
                  </button>
                </div>
                <p className="t-label-sm text-text-muted mt-space-sm">
                  Dilaporkan {tanggal(m.created_at)}
                  {m.anonymous && " • mode anonim"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/lapor"
        className="flex items-center justify-center gap-1 t-label-md text-primary text-center mt-space-lg"
      >
        <Icon name="arrow_back" className="text-[16px]" />
        Buat laporan baru
      </Link>
      </div>
    </main>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<main className="flex-1 px-4 py-6" />}>
      <StatusLookup />
    </Suspense>
  );
}
