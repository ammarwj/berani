"use client";

import { useEffect, useState } from "react";
import { api, isLoggedIn } from "@/lib/api";
import { Empty, LoginRequired } from "@/components/ui";
import Icon from "@/components/Icon";

type Scenario = {
  id: string;
  prompt: string;
  category: string;
  options: { label: string }[];
};

type Result = { feedback: string; is_best: boolean; chosen: number };

type Progress = { total: number; attempted: number; best: number };

const LANGKAH_3T = [
  { n: 1, title: "Tenang", desc: "Tarik napas, jangan panik." },
  { n: 2, title: "Tegas", desc: "Bicara lugas & terukur." },
  { n: 3, title: "Temani", desc: "Dukung teman korban." },
];

export default function LatihanPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ok = isLoggedIn();
    setAuthed(ok);
    if (!ok) return;
    api<Scenario[]>("/training/scenarios")
      .then(setScenarios)
      .catch(() => {})
      .finally(() => setLoading(false));
    api<Progress>("/training/progress").then(setProgress).catch(() => {});
  }, []);

  async function choose(scenario: Scenario, index: number) {
    if (results[scenario.id]) return;
    try {
      // Scoring and feedback both come from the server — the best answer is
      // never present in the scenario payload.
      const res = await api<{ feedback: string; is_best: boolean }>("/training/attempts", {
        method: "POST",
        body: JSON.stringify({ scenario_id: scenario.id, chosen_index: index }),
      });
      setResults((r) => ({ ...r, [scenario.id]: { ...res, chosen: index } }));
      api<Progress>("/training/progress").then(setProgress).catch(() => {});
    } catch {
      // Leave the scenario answerable so the user can retry.
    }
  }

  const pct = progress && progress.total > 0
    ? Math.round((progress.attempted / progress.total) * 100)
    : 0;

  if (authed === false) {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <div className="max-w-2xl mx-auto w-full px-margin pt-space-lg">
          <h1 className="t-headline-lg text-text-primary mb-space-md">
            Latihan Tanggap &amp; Berani <span aria-hidden>💪</span>
          </h1>
          <LoginRequired what="mengakses latihan tanggap" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full pt-16 pb-24">
      <div className="max-w-2xl mx-auto w-full px-margin flex flex-col gap-space-md pt-space-lg">
        <header>
          <span className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-amber-subtle text-tertiary t-label-md">
            <Icon name="psychology" filled className="text-[16px]" />
            Simulasi Tindakan
          </span>
          <h1 className="t-headline-lg text-text-primary mt-space-sm">
            Latihan Tanggap &amp; Berani <span aria-hidden>💪</span>
          </h1>
          <p className="t-body text-text-muted mt-1">
            Latih cara merespons perundungan secara aman, asertif, dan tanpa kekerasan.
            Tidak ada yang dinilai salah — ini ruang belajar.
          </p>
        </header>

        {progress && progress.total > 0 && (
          <section className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
            <div className="flex items-center justify-between gap-space-sm">
              <span className="t-label text-text-primary">Progres latihan</span>
              <span className="t-label-md text-text-muted">
                {progress.attempted} dari {progress.total} dicoba
              </span>
            </div>
            <div
              className="h-2 bg-surface-container-low rounded-full overflow-hidden mt-space-sm"
              role="progressbar"
              aria-valuenow={progress.attempted}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-label="Progres latihan"
            >
              <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="t-label-md text-text-muted mt-space-sm">
              {progress.best} respons terbaik sejauh ini.
            </p>
          </section>
        )}

        {loading ? (
          <Empty>Memuat skenario…</Empty>
        ) : scenarios.length === 0 ? (
          <Empty>Belum ada skenario latihan.</Empty>
        ) : (
          <ul className="flex flex-col gap-space-md">
            {scenarios.map((s, si) => {
              const result = results[s.id];
              return (
                <li key={s.id} className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
                  <div className="flex items-center justify-between gap-space-sm">
                    <span className="t-label-sm uppercase text-text-muted">
                      Skenario #{si + 1} • {s.category}
                    </span>
                    {/* Design menampilkan estimasi durasi; skenario tidak punya
                        kolom itu, jadi status percobaan yang ditampilkan. */}
                    {result && (
                      <span className="inline-flex items-center gap-1 t-label-sm text-secondary">
                        <Icon name="task_alt" className="text-[14px]" />Sudah dicoba
                      </span>
                    )}
                  </div>

                  <div className="flex gap-space-sm mt-space-sm bg-ocean-subtle rounded-xl p-space-md">
                    <Icon name="chat_bubble" className="text-[20px] text-primary-container shrink-0" />
                    <p className="t-body text-text-primary">{s.prompt}</p>
                  </div>

                  <div className="flex flex-col gap-space-sm mt-space-md">
                    {s.options.map((o, i) => {
                      const picked = result?.chosen === i;
                      return (
                        <button
                          key={i}
                          onClick={() => choose(s, i)}
                          disabled={!!result}
                          className={`flex items-start gap-space-sm text-left border rounded-xl p-space-md transition disabled:cursor-default ${
                            picked
                              ? result!.is_best
                                ? "border-secondary bg-mint-subtle"
                                : "border-tertiary bg-amber-subtle"
                              : "border-border-subtle enabled:hover:border-primary-container enabled:hover:bg-ocean-subtle"
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 t-label-md ${
                              picked
                                ? result!.is_best
                                  ? "bg-secondary text-white"
                                  : "bg-tertiary text-white"
                                : "bg-surface-container-low text-text-muted"
                            }`}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="t-body text-text-primary flex-1">
                            {o.label}
                            {/* Badge "Direkomendasikan" hanya muncul setelah server menjawab.
                                Menandainya lebih awal akan membocorkan kunci jawaban. */}
                            {picked && result!.is_best && (
                              <span className="mt-space-xs inline-flex items-center gap-1 t-label-sm text-secondary">
                                <Icon name="check_circle" filled className="text-[14px]" />
                                Direkomendasikan
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {result && (
                    <div
                      role="status"
                      className={`mt-space-md rounded-xl p-space-md ${
                        result.is_best ? "bg-mint-subtle" : "bg-amber-subtle"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center gap-space-xs t-label ${
                          result.is_best ? "text-secondary" : "text-tertiary"
                        }`}
                      >
                        <Icon name="lightbulb" filled className="text-[18px]" />
                        {result.is_best ? "Mengapa sikap ini efektif?" : "Coba pertimbangkan ini"}
                      </span>
                      <p className="t-body text-text-primary mt-space-xs">{result.feedback}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <section className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
          <div className="flex items-center justify-between gap-space-sm">
            <h2 className="t-headline-sm text-text-primary">Panduan reaksi ramah</h2>
            <span className="t-label-sm uppercase px-2.5 py-1 rounded-full bg-ocean-subtle text-primary">
              Langkah 3T
            </span>
          </div>
          <div className="grid grid-cols-3 gap-space-sm mt-space-md">
            {LANGKAH_3T.map((l) => (
              <div key={l.n} className="flex flex-col items-center text-center gap-space-xs">
                <span className="w-8 h-8 rounded-full bg-primary-container text-white grid place-items-center t-label">
                  {l.n}
                </span>
                <span className="t-label text-text-primary">{l.title}</span>
                <span className="t-body-sm text-text-muted">{l.desc}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
