"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { api, isAdmin } from "@/lib/api";
import { PageHeader, Card, Empty, Alert } from "@/components/ui";

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

  useEffect(() => {
    const ok = isAdmin();
    setAllowed(ok);
    if (!ok) return;
    api<Scenario[]>("/admin/training/scenarios")
      .then(setScenarios)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

      {loading ? (
        <Empty>Memuat skenario…</Empty>
      ) : scenarios.length === 0 ? (
        <Empty>Belum ada skenario. Buat yang pertama lewat tombol di atas.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {scenarios.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/skenario/${s.id}`} className="block">
                <Card className="hover:border-primary-container transition">
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
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
