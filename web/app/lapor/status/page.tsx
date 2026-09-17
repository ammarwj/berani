"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { PageHeader, Card, Button, Alert, inputClass, StatusBadge } from "@/components/ui";
import Icon from "@/components/Icon";

type Status = { status: string; category: string; created_at: string };

const STEPS = ["diterima", "diproses", "ditindaklanjuti", "selesai"];

const EXPLAIN: Record<string, string> = {
  diterima: "Laporanmu sudah masuk dan menunggu ditinjau guru pendamping.",
  diproses: "Guru pendamping sedang meninjau laporanmu.",
  ditindaklanjuti: "Sekolah sedang mengambil tindakan atas laporanmu.",
  selesai: "Penanganan laporan ini sudah selesai.",
};

function StatusLookup() {
  const params = useSearchParams();
  const [ticket, setTicket] = useState(params.get("ticket") ?? "");
  const [result, setResult] = useState<Status | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (ticket.trim()) lookup(ticket);
  }

  const stepIndex = result ? STEPS.indexOf(result.status) : -1;

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
            Dilaporkan{" "}
            {new Date(result.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </Card>
      )}

      <Link href="/lapor" className="block t-label-md text-primary underline underline-offset-2 text-center mt-space-lg">
        ← Buat laporan baru
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
