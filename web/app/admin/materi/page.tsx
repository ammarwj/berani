"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { api, isAdmin } from "@/lib/api";
import { PageHeader, Card, Empty, Alert } from "@/components/ui";
import DeleteContentDialog from "@/components/DeleteContentDialog";
import { type ModuleFootprint, describeModule } from "@/lib/footprint";

type Module = {
  id: string;
  title: string;
  category: string;
  content_type: string;
  order_index: number;
  published: boolean;
};

export default function AdminMateriPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [delTarget, setDelTarget] = useState<Module | null>(null);

  const load = useCallback(() => {
    api<Module[]>("/admin/education/modules")
      .then(setModules)
      .catch(() => setError("Gagal memuat daftar materi."))
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
        <PageHeader icon="menu_book" title="Materi" />
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
        icon="menu_book"
        title="Materi Edukasi"
        subtitle="Materi terarsip hilang dari daftar siswa, tapi progres yang sudah tercatat tetap aman. Hapus permanen memusnahkannya."
      />

      <Link
        href="/admin/materi/baru"
        className="t-label min-h-12 rounded-xl px-space-md py-3 mb-5 inline-flex items-center gap-space-xs bg-primary-container text-white hover:bg-primary transition"
      >
        <Icon name="add" className="text-[20px]" />
        Materi baru
      </Link>

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {loading ? (
        <Empty>Memuat materi…</Empty>
      ) : modules.length === 0 ? (
        <Empty>Belum ada materi. Buat yang pertama lewat tombol di atas.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {modules.map((m) => (
            <li key={m.id}>
              <Card className="hover:border-primary-container transition">
                <div className="flex items-start gap-space-sm">
                  {/* Link tidak membungkus Card: tombol hapus di dalam anchor
                      akan ikut menavigasi ke editor pada klik. */}
                  <Link href={`/admin/materi/${m.id}`} className="flex-1 min-w-0 block">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`t-label-sm uppercase px-2.5 py-1 rounded-full ${
                          m.published
                            ? "bg-mint-subtle text-secondary"
                            : "bg-surface-container-low text-text-muted"
                        }`}
                      >
                        {m.published ? "terbit" : "arsip"}
                      </span>
                      <span className="text-xs text-text-muted">{m.category}</span>
                      <span className="text-xs text-text-muted">· {m.content_type}</span>
                    </div>
                    <p className="t-label text-text-primary wrap-break-word">{m.title}</p>
                  </Link>
                  <button
                    type="button"
                    title="Hapus materi permanen"
                    aria-label={`Hapus permanen materi ${m.title}`}
                    onClick={() => {
                      setError("");
                      setNotice("");
                      setDelTarget(m);
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

      <DeleteContentDialog<ModuleFootprint>
        target={delTarget && { id: delTarget.id, title: delTarget.title, subtitle: delTarget.category }}
        onClose={() => setDelTarget(null)}
        endpoint="/admin/education/modules"
        label="materi"
        describe={describeModule}
        onDeleted={(title) => {
          setNotice(`Materi "${title}" dihapus permanen.`);
          load();
        }}
      />
    </main>
  );
}
