"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, isLoggedIn } from "@/lib/api";
import { Empty, LoginRequired } from "@/components/ui";
import Icon from "@/components/Icon";

type Module = {
  id: string;
  title: string;
  category: string;
  summary: string;
  completed: boolean;
  quiz_score?: number;
};

type Progress = { total: number; completed: number; badge: string };

export default function EdukasiPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");

  useEffect(() => {
    const ok = isLoggedIn();
    setAuthed(ok);
    if (!ok) return;
    api<Module[]>("/education/modules")
      .then(setModules)
      .catch(() => {})
      .finally(() => setLoading(false));
    api<Progress>("/education/progress").then(setProgress).catch(() => {});
  }, []);

  const categories = useMemo(
    () => ["semua", ...new Set(modules.map((m) => m.category))],
    [modules],
  );
  const shown = filter === "semua" ? modules : modules.filter((m) => m.category === filter);
  const pct = progress && progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  if (authed === false) {
    return (
      <main className="flex-1 w-full pt-16 pb-28">
        <div className="max-w-2xl mx-auto w-full px-margin pt-space-lg">
          <h1 className="t-headline-lg text-text-primary mb-space-md">Edukasi</h1>
          <LoginRequired what="mengakses materi edukasi" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full pt-16 pb-28">
      <div className="max-w-2xl mx-auto w-full px-margin flex flex-col gap-space-md pt-space-lg">
        <header>
          <span className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-ocean-subtle text-primary t-label-md">
            <Icon name="school" filled className="text-[16px]" />
            Pusat Belajar
          </span>
          <h1 className="t-headline-lg text-text-primary mt-space-sm">Edukasi</h1>
          <p className="t-body text-text-muted mt-1">
            Pahami bullying, satu materi setiap kali.
          </p>
        </header>

        {progress && progress.total > 0 && (
          <section className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
            <div className="flex items-center justify-between gap-space-sm">
              <span className="t-label text-text-primary">
                {progress.completed} dari {progress.total} materi selesai
              </span>
              {progress.badge && (
                <span className="inline-flex items-center gap-1 t-label-sm uppercase px-2.5 py-1 rounded-full bg-amber-subtle text-tertiary">
                  <Icon name="stars" filled className="text-[14px]" />
                  {progress.badge}
                </span>
              )}
            </div>
            <div
              className="h-2 bg-surface-container-low rounded-full overflow-hidden mt-space-sm"
              role="progressbar"
              aria-valuenow={progress.completed}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-label="Kemajuan belajar"
            >
              <div className="h-full bg-primary-container rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </section>
        )}

        {categories.length > 2 && (
          <div className="flex gap-space-xs overflow-x-auto pb-1 -mx-margin px-margin">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                aria-pressed={filter === c}
                className={`shrink-0 px-space-md py-2 rounded-full t-label-md capitalize transition ${
                  filter === c
                    ? "bg-primary-container text-white"
                    : "bg-surface-card border border-border-subtle text-text-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <Empty>Memuat materi…</Empty>
        ) : shown.length === 0 ? (
          <Empty>Belum ada materi.</Empty>
        ) : (
          <ul className="flex flex-col gap-space-sm">
            {shown.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/edukasi/${m.id}`}
                  className="flex items-start gap-space-sm bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card hover:border-primary-container transition"
                >
                  <span
                    className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${
                      m.completed ? "bg-mint-subtle text-secondary" : "bg-ocean-subtle text-primary-container"
                    }`}
                  >
                    <Icon name={m.completed ? "task_alt" : "menu_book"} className="text-[22px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="t-label-sm uppercase text-text-muted block">{m.category}</span>
                    <span className="t-title text-text-primary block mt-0.5">{m.title}</span>
                    <span className="t-body text-text-muted block mt-1">{m.summary}</span>
                    {m.completed && typeof m.quiz_score === "number" && (
                      <span className="t-label-md text-secondary block mt-space-xs">
                        Kuis {m.quiz_score}%
                      </span>
                    )}
                  </span>
                  <Icon name="chevron_right" className="text-[20px] text-text-muted shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
