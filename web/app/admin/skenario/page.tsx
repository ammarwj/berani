"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { api, isAdmin } from "@/lib/api";
import { PageHeader, Card, Empty, Alert } from "@/components/ui";
import DeleteContentDialog from "@/components/DeleteContentDialog";
import { type ScenarioFootprint, describeScenario } from "@/lib/footprint";

type Scenario = {
  id: string;
  prompt: string;
  category: string;
  order_index: number;
  published: boolean;
};

export default function AdminSkenarioPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [delTarget, setDelTarget] = useState<Scenario | null>(null);

  const load = useCallback(() => {
    api<Scenario[]>("/admin/training/scenarios")
      .then(setScenarios)
      .catch(() => setError("Gagal memuat daftar skenario."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const ok = isAdmin();
    setAllowed(ok);
    if (ok) load();
  }, [load]);

  if (allowed === false) {
    return (
      <main className="flex-1 max-w-3xl mx-auto w-full px-margin pt-22 pb-28">
        <PageHeader icon="psychology" title="Skenario" />
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
        icon="psychology"
        title="Skenario Latihan"
        subtitle="Setiap skenario butuh tepat satu respons terbaik dan umpan balik di semua pilihan."
      />

      <Link
        href="/admin/skenario/baru"
        className="t-label min-h-12 rounded-xl px-space-md py-3 mb-5 inline-flex items-center gap-space-xs bg-primary-container text-white hover:bg-primary transition"
      >
        <Icon name="add" className="text-[20px]" />
        Skenario baru
      </Link>

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {loading ? (
        <Empty>Memuat skenario…</Empty>
      ) : scenarios.length === 0 ? (
        <Empty>Belum ada skenario. Buat yang pertama lewat tombol di atas.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {scenarios.map((s) => (
            <li key={s.id}>
              <Card className="hover:border-primary-container transition">
                <div className="flex items-start gap-space-sm">
                  {/* Link tidak membungkus Card: tombol hapus di dalam anchor
                      akan ikut menavigasi ke editor pada klik. */}
                  <Link href={`/admin/skenario/${s.id}`} className="flex-1 min-w-0 block">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`t-label-sm uppercase px-2.5 py-1 rounded-full ${
                          s.published
                            ? "bg-mint-subtle text-secondary"
                            : "bg-surface-container-low text-text-muted"
                        }`}
                      >
                        {s.published ? "terbit" : "arsip"}
                      </span>
                      <span className="text-xs text-text-muted">{s.category}</span>
                    </div>
                    <p className="text-sm line-clamp-2">{s.prompt}</p>
                  </Link>
                  <button
                    type="button"
                    title="Hapus skenario permanen"
                    aria-label="Hapus permanen skenario ini"
                    onClick={() => {
                      setError("");
                      setNotice("");
                      setDelTarget(s);
                    }}
                    className="w-9 h-9 shrink-0 grid place-items-center rounded-lg text-text-muted hover:bg-danger-subtle hover:text-danger-rose transition"
                  >
                    <Icon name="delete" className="text-[20px]" />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <DeleteContentDialog<ScenarioFootprint>
        target={
          delTarget && { id: delTarget.id, title: delTarget.prompt, subtitle: delTarget.category }
        }
        onClose={() => setDelTarget(null)}
        endpoint="/admin/training/scenarios"
        label="skenario"
        describe={describeScenario}
        onDeleted={() => {
          setNotice("Skenario dihapus permanen.");
          load();
        }}
      />
    </main>
  );
}
