"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, isLoggedIn } from "@/lib/api";
import { Card, Button, Alert, Empty, LoginRequired } from "@/components/ui";
import Markdown from "@/components/Markdown";
import Icon from "@/components/Icon";

type Quiz = { question: string; options: string[] };

// Tiap kategori materi dapat warna & ikon sendiri di sampul — supaya "Dampak"
// (berat) terasa beda dari "Keterampilan" (actionable), bukan satu template
// biru yang sama untuk semua materi.
const CATEGORY_STYLE: Record<string, { bg: string; fg: string; icon: string }> =
  {
    Dasar: {
      bg: "bg-surface-container",
      fg: "text-primary-container",
      icon: "menu_book",
    },
    Dampak: {
      bg: "bg-danger-subtle",
      fg: "text-danger-rose",
      icon: "psychology",
    },
    Keterampilan: {
      bg: "bg-mint-subtle",
      fg: "text-secondary",
      icon: "lightbulb",
    },
    Digital: {
      bg: "bg-support-teal-subtle",
      fg: "text-support-teal",
      icon: "devices",
    },
  };
const DEFAULT_CATEGORY_STYLE = {
  bg: "bg-surface-container",
  fg: "text-primary-container",
  icon: "menu_book",
};

type Module = {
  id: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  quiz?: Quiz[];
  completed: boolean;
  quiz_score?: number;
};

export default function ModulePage({ params }: PageProps<"/edukasi/[id]">) {
  const { id } = use(params);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [module, setModule] = useState<Module | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ok = isLoggedIn();
    setAuthed(ok);
    if (!ok) return;
    api<Module>(`/education/modules/${id}`)
      .then(setModule)
      .catch(() => setError("Materi tidak ditemukan."));
  }, [id]);

  async function finish() {
    if (!module) return;
    setSaving(true);
    setError("");
    try {
      // The server grades: it holds the answer key, we only send the choices.
      const res = await api<{ quiz_score: number | null }>(
        `/education/modules/${module.id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            answers: (module.quiz ?? []).map((_, i) => answers[i] ?? -1),
          }),
        },
      );
      setScore(res.quiz_score);
      setModule({ ...module, completed: true });
    } catch {
      setError("Gagal menyimpan. Pastikan kamu sudah masuk.");
    } finally {
      setSaving(false);
    }
  }

  if (authed === false) {
    return (
      <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
        <LoginRequired what="mengakses materi edukasi" />
      </main>
    );
  }
  if (error && !module) {
    return (
      <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
        <Alert kind="error">{error}</Alert>
      </main>
    );
  }
  if (!module) {
    return (
      <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
        <Empty>Memuat…</Empty>
      </main>
    );
  }

  const quiz = module.quiz ?? [];
  const allAnswered = quiz.every((_, i) => answers[i] !== undefined);
  const cat = CATEGORY_STYLE[module.category] ?? DEFAULT_CATEGORY_STYLE;

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
      <Link
        href="/edukasi"
        className="t-label-md text-primary-container flex items-center gap-1 w-fit hover:underline underline-offset-2"
      >
        <Icon name="arrow_back" className="text-[16px]" />
        Semua materi
      </Link>

      <div
        className={`rounded-2xl p-space-lg mt-space-sm mb-space-lg ${cat.bg}`}
      >
        <span
          className={`w-12 h-12 rounded-xl bg-surface-card grid place-items-center e-card ${cat.fg}`}
        >
          <Icon name={cat.icon} className="text-[24px]" />
        </span>
        <span className={`t-label-sm uppercase block mt-space-md ${cat.fg}`}>
          {module.category}
        </span>
        <h1 className="t-display text-text-primary mt-1">{module.title}</h1>
        <p className="t-body text-text-muted mt-space-sm max-w-prose">
          {module.summary}
        </p>
      </div>

      <Card className="mb-space-xl">
        <article className="t-body text-text-muted">
          <Markdown source={module.body} />
        </article>
      </Card>

      {quiz.length > 0 && (
        <section aria-labelledby="kuis" className="mb-space-lg">
          <div className="flex items-center justify-between mb-space-md">
            <h2 id="kuis" className="t-headline-sm text-text-primary">
              Kuis singkat
            </h2>
            <span className="t-label-md text-text-muted">
              {quiz.length} soal
            </span>
          </div>
          <ol className="flex flex-col gap-space-sm">
            {quiz.map((q, qi) => (
              <li key={qi}>
                <Card>
                  <p className={`t-label-sm uppercase mb-space-xs ${cat.fg}`}>
                    Soal {qi + 1} dari {quiz.length}
                  </p>
                  <fieldset>
                    <legend className="t-label text-text-primary mb-space-sm">
                      {q.question}
                    </legend>
                    <div className="flex flex-col gap-space-xs">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={`flex items-center gap-space-sm border rounded-xl px-3.5 py-3 cursor-pointer transition ${
                            answers[qi] === oi
                              ? "border-primary-container bg-ocean-subtle"
                              : "border-border-subtle hover:border-primary-container/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q${qi}`}
                            checked={answers[qi] === oi}
                            disabled={score !== null}
                            onChange={() =>
                              setAnswers((a) => ({ ...a, [qi]: oi }))
                            }
                            className="accent-primary-container w-4 h-4 shrink-0"
                          />
                          <span className="t-body text-text-primary">
                            {opt}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-col gap-space-sm">
        {error && <Alert kind="error">{error}</Alert>}
        {score !== null ? (
          <Alert kind="success">
            {quiz.length > 0
              ? `Skor kuismu ${score}%. Materi ditandai selesai.`
              : "Materi ditandai selesai."}
          </Alert>
        ) : (
          <Button
            onClick={finish}
            disabled={saving || (quiz.length > 0 && !allAnswered)}
          >
            {saving
              ? "Menyimpan…"
              : quiz.length > 0
                ? "Kirim jawaban"
                : "Tandai selesai"}
          </Button>
        )}
        {score !== null && (
          <Link
            href="/edukasi"
            className="t-label-md text-primary-container flex items-center gap-1 w-fit hover:underline underline-offset-2"
          >
            Lanjut ke materi lain
            <Icon name="arrow_forward" className="text-[16px]" />
          </Link>
        )}
      </div>
    </main>
  );
}
