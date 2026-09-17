"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, isLoggedIn } from "@/lib/api";
import { PageHeader, Card, Button, Alert, Empty } from "@/components/ui";
import Markdown from "@/components/Markdown";


type Quiz = { question: string; options: string[] };

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
  const [module, setModule] = useState<Module | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
        }
      );
      setScore(res.quiz_score);
      setModule({ ...module, completed: true });
    } catch {
      setError("Gagal menyimpan. Pastikan kamu sudah masuk.");
    } finally {
      setSaving(false);
    }
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

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
      <Link href="/edukasi" className="text-sm text-primary underline">
        ← Semua materi
      </Link>
      <div className="mt-3">
        <PageHeader icon="menu_book" title={module.title} subtitle={module.summary} />
      </div>

      <article className="t-body text-text-muted mb-8">
        <Markdown source={module.body} />
      </article>

      {quiz.length > 0 && (
        <section aria-labelledby="kuis">
          <h2 id="kuis" className="text-lg font-bold mb-3">
            Kuis singkat
          </h2>
          <ol className="flex flex-col gap-4">
            {quiz.map((q, qi) => (
              <li key={qi}>
                <Card>
                  <fieldset>
                    <legend className="font-medium mb-2">
                      {qi + 1}. {q.question}
                    </legend>
                    <div className="flex flex-col gap-2">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer ${
                            answers[qi] === oi ? "border-primary-container bg-ocean-subtle" : "border-border-subtle"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q${qi}`}
                            checked={answers[qi] === oi}
                            disabled={score !== null}
                            onChange={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                          />
                          <span className="text-sm">{opt}</span>
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

      <div className="mt-6 flex flex-col gap-3">
        {error && <Alert kind="error">{error}</Alert>}
        {score !== null ? (
          <Alert kind="success">
            {quiz.length > 0
              ? `Skor kuismu ${score}%. Materi ditandai selesai.`
              : "Materi ditandai selesai."}
          </Alert>
        ) : !isLoggedIn() ? (
          <Alert kind="info">
            <Link href="/login" className="underline font-semibold">
              Masuk
            </Link>{" "}
            untuk menyimpan kemajuan belajarmu.
          </Alert>
        ) : (
          <Button onClick={finish} disabled={saving || (quiz.length > 0 && !allAnswered)}>
            {saving ? "Menyimpan…" : quiz.length > 0 ? "Kirim jawaban" : "Tandai selesai"}
          </Button>
        )}
        {score !== null && (
          <Link href="/edukasi" className="text-primary underline text-sm">
            Lanjut ke materi lain →
          </Link>
        )}
      </div>
    </main>
  );
}
