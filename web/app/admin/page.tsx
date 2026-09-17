"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, isAdmin } from "@/lib/api";
import { PageHeader, Card, Empty, Alert, StatusBadge, UrgencyBadge, inputClass } from "@/components/ui";


type Report = {
  id: string;
  category: string;
  description: string;
  location: string;
  urgency: string;
  status: string;
  created_at: string;
  is_anonymous: boolean;
  reporter_name: string;
  reporter_email: string;
  ticket_code: string;
};

const STATUSES = ["", "diterima", "diproses", "ditindaklanjuti", "selesai"];

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (urgency) q.set("urgency", urgency);
    api<Report[]>(`/admin/reports?${q}`)
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, urgency]);

  useEffect(() => {
    const ok = isAdmin();
    setAllowed(ok);
    if (ok) load();
  }, [load]);

  if (allowed === false) {
    return (
      <main className="flex-1 max-w-3xl mx-auto w-full px-margin pt-22 pb-28">
        <PageHeader icon="security" title="Dashboard" />
        <Alert kind="error">
          Halaman ini hanya untuk guru pendamping.{" "}
          <Link href="/login" className="underline font-semibold">
            Masuk sebagai guru
          </Link>
        </Alert>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-margin pt-22 pb-28">
      <PageHeader
        icon="security"
        title="Dashboard Laporan"
        subtitle="Laporan mendesak muncul paling atas. Identitas pelapor hanya terlihat di halaman ini — jaga kerahasiaannya."
      />

      <div className="flex gap-2 mb-5">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={inputClass}
          aria-label="Filter status"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || "Semua status"}
            </option>
          ))}
        </select>
        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value)}
          className={inputClass}
          aria-label="Filter urgensi"
        >
          <option value="">Semua urgensi</option>
          <option value="mendesak">Mendesak</option>
          <option value="tidak_mendesak">Tidak mendesak</option>
        </select>
      </div>

      {loading ? (
        <Empty>Memuat laporan…</Empty>
      ) : reports.length === 0 ? (
        <Empty>Tidak ada laporan yang cocok dengan filter ini.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/${r.id}`} className="block">
                <Card className="hover:border-primary-container transition">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <UrgencyBadge urgency={r.urgency} />
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-text-text-muted">{r.category}</span>
                    {r.is_anonymous && (
                      <span className="text-xs text-text-muted bg-surface-container-low px-2 py-0.5 rounded-full">
                        mode anonim
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mb-1">
                    {/* Laporan anonim lama (sebelum migrasi 0005) memang tidak pernah
                        menyimpan pelapornya — jangan tampilkan seolah datanya hilang. */}
                    {r.reporter_name || r.reporter_email || "Identitas tidak tersimpan"}
                  </p>
                  <p className="text-sm line-clamp-2">{r.description}</p>
                  <p className="text-xs text-text-text-muted mt-1 t-label tracking-wider">{r.ticket_code}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
