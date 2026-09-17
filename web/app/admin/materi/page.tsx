"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { api, isAdmin } from "@/lib/api";
import { PageHeader, Card, Empty, Alert } from "@/components/ui";

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

  useEffect(() => {
    const ok = isAdmin();
    setAllowed(ok);
    if (!ok) return;
    api<Module[]>("/admin/education/modules")
      .then(setModules)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        subtitle="Materi terarsip hilang dari daftar siswa, tapi progres yang sudah tercatat tetap aman."
      />

      <Link
        href="/admin/materi/baru"
        className="t-label min-h-12 rounded-xl px-space-md py-3 mb-5 inline-flex items-center gap-space-xs bg-primary-container text-white hover:bg-primary transition"
      >
        <Icon name="add" className="text-[20px]" />
        Materi baru
      </Link>

      {loading ? (
        <Empty>Memuat materi…</Empty>
      ) : modules.length === 0 ? (
        <Empty>Belum ada materi. Buat yang pertama lewat tombol di atas.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {modules.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/materi/${m.id}`} className="block">
                <Card className="hover:border-primary-container transition">
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
                  <p className="t-label text-text-primary">{m.title}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
