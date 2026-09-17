"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, isAdmin, isSuperAdmin } from "@/lib/api";
import {
  PageHeader,
  Card,
  Empty,
  Alert,
  StatusBadge,
  UrgencyBadge,
  inputClass,
} from "@/components/ui";
import Icon from "@/components/Icon";

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
const PAGE_SIZE = 10;

function StatTile({
  icon,
  value,
  label,
  tone,
}: {
  icon: string;
  value: number | null;
  label: string;
  tone: "rose" | "amber" | "mint" | "ocean";
}) {
  const styles = {
    rose: "bg-danger-subtle border-danger-rose/30 text-danger-rose",
    amber: "bg-amber-subtle border-tertiary-container/30 text-tertiary",
    mint: "bg-mint-subtle border-secondary/30 text-secondary",
    ocean: "bg-ocean-subtle border-primary-container/30 text-primary",
  }[tone];
  return (
    <div className={`rounded-2xl border p-space-md ${styles}`}>
      <p className="t-display text-text-primary">{value ?? "—"}</p>
      <p className="t-body-sm mt-space-xs inline-flex items-center gap-space-xs">
        <Icon name={icon} className="text-[16px]" />
        {label}
      </p>
    </div>
  );
}

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [activeStudents, setActiveStudents] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setPage(1);
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
    if (!ok) return;
    load();
    // Statistik & "terbaru" butuh totalnya, lepas dari filter status/urgensi di
    // bawah — jadi fetch terpisah, sekali saat halaman dibuka.
    api<Report[]>("/admin/reports")
      .then(setAllReports)
      .catch(() => {});
    if (isSuperAdmin()) {
      api<{ is_active: boolean }[]>("/admin/users?role=siswa")
        .then((users) =>
          setActiveStudents(users.filter((u) => u.is_active).length),
        )
        .catch(() => {});
    }
  }, [load]);

  const newCount = allReports.filter((r) => r.status === "diterima").length;
  const inProgressCount = allReports.filter(
    (r) => r.status === "diproses" || r.status === "ditindaklanjuti",
  ).length;
  const doneCount = allReports.filter((r) => r.status === "selesai").length;

  const totalPages = Math.max(1, Math.ceil(reports.length / PAGE_SIZE));
  const paged = reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      <div className="grid grid-cols-2 gap-space-sm mb-space-lg">
        <StatTile
          icon="assignment"
          value={newCount}
          label="Laporan Baru"
          tone="rose"
        />
        <StatTile
          icon="hourglass_top"
          value={inProgressCount}
          label="Sedang Ditangani"
          tone="amber"
        />
        <StatTile
          icon="check_circle"
          value={doneCount}
          label="Selesai Ditangani"
          tone="mint"
        />
        <StatTile
          icon="groups"
          value={activeStudents}
          label="Siswa Aktif"
          tone="ocean"
        />
      </div>

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
          <option value="sangat_mendesak">Sangat mendesak</option>
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
          {paged.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/${r.id}`} className="block">
                <Card className="hover:border-primary-container transition">
                  <div className="flex items-start justify-between gap-space-sm">
                    <div className="flex items-center gap-space-xs flex-wrap">
                      <UrgencyBadge urgency={r.urgency} />
                      <StatusBadge status={r.status} />
                      {r.is_anonymous && (
                        <span className="t-label-sm text-text-muted bg-surface-container-low px-2 py-0.5 rounded-full">
                          mode anonim
                        </span>
                      )}
                    </div>
                    <Icon name="chevron_right" className="text-[20px] text-text-muted shrink-0" />
                  </div>

                  <p className="t-label text-text-primary capitalize mt-space-sm">{r.category}</p>
                  <p className="t-body text-text-muted line-clamp-2 mt-space-xs">{r.description}</p>

                  <div className="flex items-center justify-between gap-space-sm mt-space-sm pt-space-sm border-t border-border-subtle">
                    <p className="t-label-md text-text-muted truncate">
                      {/* Laporan anonim lama (sebelum migrasi 0005) memang tidak pernah
                          menyimpan pelapornya — jangan tampilkan seolah datanya hilang. */}
                      {r.reporter_name || r.reporter_email || "Identitas tidak tersimpan"}
                    </p>
                    <p className="t-label-sm text-text-muted tracking-wider shrink-0">{r.ticket_code}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between gap-space-sm mt-space-md">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 t-label-md text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="arrow_back" className="text-[16px]" />
            Sebelumnya
          </button>
          <span className="t-body-sm text-text-muted">
            Halaman {page} dari {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 t-label-md text-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Berikutnya
            <Icon name="arrow_forward" className="text-[16px]" />
          </button>
        </div>
      )}
    </main>
  );
}
