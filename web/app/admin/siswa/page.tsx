"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, isAdmin } from "@/lib/api";
import { PageHeader, Card, Empty, Alert, StatTile, ProgressBar, inputClass } from "@/components/ui";
import Icon from "@/components/Icon";

type StudentProgress = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  edu_completed: number;
  edu_total: number;
  train_attempted: number;
  train_total: number;
  train_best: number;
  badge: string;
};

const SORTS = {
  perhatian: "Perlu perhatian dulu",
  nama: "Nama A-Z",
} as const;
type Sort = keyof typeof SORTS;

const PAGE_SIZE = 10;

// Persentase gabungan materi+latihan menentukan siapa yang paling tertinggal —
// itulah yang mau dilihat guru pendamping duluan, bukan urutan abjad.
function overallPct(s: StudentProgress) {
  const total = s.edu_total + s.train_total;
  if (total === 0) return 0;
  return (s.edu_completed + s.train_attempted) / total;
}

export default function SiswaPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("perhatian");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api<StudentProgress[]>("/admin/progress")
      .then(setStudents)
      .catch(() => setError("Gagal memuat progress siswa."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const ok = isAdmin();
    setAllowed(ok);
    if (ok) load();
  }, [load]);

  const active = students.filter((s) => s.is_active);
  const eduTotal = active[0]?.edu_total ?? 0;
  const trainTotal = active[0]?.train_total ?? 0;
  const eduAvgPct =
    active.length && eduTotal
      ? Math.round((active.reduce((sum, s) => sum + s.edu_completed, 0) / (active.length * eduTotal)) * 100)
      : null;
  const trainAvgPct =
    active.length && trainTotal
      ? Math.round((active.reduce((sum, s) => sum + s.train_attempted, 0) / (active.length * trainTotal)) * 100)
      : null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = students.filter(
      (s) => !needle || s.name.toLowerCase().includes(needle) || s.email.toLowerCase().includes(needle),
    );
    return sort === "nama"
      ? [...list].sort((a, b) => a.name.localeCompare(b.name))
      : [...list].sort((a, b) => overallPct(a) - overallPct(b));
  }, [students, q, sort]);

  useEffect(() => {
    setPage(1);
  }, [q, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (allowed === false) {
    return (
      <main className="flex-1 max-w-3xl mx-auto w-full px-margin pt-22 pb-28">
        <PageHeader icon="groups" title="Siswa" />
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
        icon="groups"
        title="Progress Siswa"
        subtitle="Sejauh mana tiap siswa menyelesaikan materi edukasi dan latihan skenario."
      />

      <div className="grid grid-cols-3 gap-space-sm mb-space-lg">
        <StatTile icon="groups" value={active.length || null} label="Siswa aktif" tone="ocean" />
        <StatTile icon="menu_book" value={eduAvgPct} label="Rata-rata materi" tone="mint" />
        <StatTile icon="psychology" value={trainAvgPct} label="Rata-rata latihan" tone="amber" />
      </div>

      <div className="flex gap-2 mb-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${inputClass} flex-1 min-w-0`}
          placeholder="Cari nama atau email"
          aria-label="Cari siswa"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className={`${inputClass} w-auto! shrink-0`}
          aria-label="Urutkan"
        >
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-3">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {loading ? (
        <Empty>Memuat progress siswa…</Empty>
      ) : filtered.length === 0 ? (
        <Empty>Tidak ada siswa yang cocok.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {paged.map((s) => (
            <li key={s.id}>
              <Card className={s.is_active ? "" : "opacity-60"}>
                <div className="flex items-start justify-between gap-space-sm mb-space-sm">
                  <div className="min-w-0">
                    <p className="t-label text-text-primary truncate">{s.name || s.email}</p>
                    {s.name && <p className="t-body-sm text-text-muted truncate">{s.email}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!s.is_active && (
                      <span className="t-label-sm uppercase px-2.5 py-1 rounded-full bg-surface-container-low text-text-muted">
                        nonaktif
                      </span>
                    )}
                    {s.badge && (
                      <span className="t-label-sm uppercase px-2.5 py-1 rounded-full bg-mint-subtle text-secondary">
                        {s.badge}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-space-md">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon name="menu_book" className="text-[15px] text-primary shrink-0" />
                      <span className="t-body-sm text-text-muted">Materi</span>
                      <span className="t-label-sm text-text-primary ml-auto">
                        {s.edu_completed}/{s.edu_total}
                      </span>
                    </div>
                    <ProgressBar value={s.edu_completed} total={s.edu_total} tone="primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon name="psychology" className="text-[15px] text-secondary shrink-0" />
                      <span className="t-body-sm text-text-muted">Latihan</span>
                      <span className="t-label-sm text-text-primary ml-auto">
                        {s.train_attempted}/{s.train_total}
                      </span>
                    </div>
                    <ProgressBar value={s.train_attempted} total={s.train_total} tone="secondary" />
                    {s.train_attempted > 0 && (
                      <p className="t-label-sm text-text-muted mt-1">
                        {s.train_best}/{s.train_attempted} terbaik
                      </p>
                    )}
                  </div>
                </div>
              </Card>
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
