"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { api, isLoggedIn } from "@/lib/api";
import { Alert, Button, Card, Empty, LoginRequired, PageHeader, inputClass } from "@/components/ui";
import Icon from "@/components/Icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Entry = {
  id: string;
  mood: string;
  content: string;
  prompt: string;
  created_at: string;
};

type Jalur = "a" | "b";

// Keys are stored, labels are shown. Storing a word rather than an emoji keeps
// the mood history readable if the emoji set ever changes.
const MOODS: { key: string; emoji: string; label: string; jalur: Jalur }[] = [
  { key: "senang", emoji: "😄", label: "Sangat Baik", jalur: "a" },
  { key: "baik", emoji: "🙂", label: "Baik", jalur: "a" },
  { key: "biasa", emoji: "😐", label: "Biasa", jalur: "a" },
  { key: "cemas", emoji: "😟", label: "Cemas", jalur: "b" },
  { key: "sedih", emoji: "😢", label: "Tertekan", jalur: "b" },
];

const moodInfo = (key: string) => MOODS.find((m) => m.key === key);

const HISTORY_PAGE_SIZE = 10;

const AFFIRMATIONS: Record<string, string> = {
  senang: "Senang mendengarnya! Semoga harimu terus menyenangkan.",
  baik: "Senang kamu baik-baik saja hari ini!",
  biasa: "Hari yang tenang juga tidak apa-apa.",
};

type Step =
  | "mood"
  | "a2"
  | "a-end-pernah"
  | "a-end-tidak"
  | "b2"
  | "b3"
  | "b4"
  | "b-end-tenang"
  | "b-end-lapor"
  | "b-end-tenang2"
  | "history";

// Tone follows which Jalur the question belongs to — teal for Jalur A
// (steady/factual), pink for Jalur B (emotionally vulnerable) — so the color
// language stays consistent with the mood picked in Tahap 1.
function ChoiceButton({
  onClick,
  emoji,
  label,
  tone,
}: {
  onClick: () => void;
  emoji: string;
  label: string;
  tone: "teal" | "pink";
}) {
  const hover =
    tone === "pink"
      ? "hover:border-support-pink hover:bg-support-pink-subtle"
      : "hover:border-support-teal hover:bg-support-teal-subtle";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-space-sm px-4 py-3 rounded-xl border-2 border-border-subtle bg-surface-card text-text-primary text-left transition ${hover}`}
    >
      <span className="text-xl" aria-hidden>{emoji}</span>
      <span className="t-label font-semibold">{label}</span>
    </button>
  );
}

// Reused by every end-of-flow screen that offers "Lapor Sekarang / Nanti Saja".
function LaporCard({
  emoji,
  title,
  body,
  cta,
  tone,
  onSkip,
}: {
  emoji: string;
  title: string;
  body: string;
  cta: string;
  tone: "teal" | "pink";
  onSkip: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto w-full px-margin pt-space-2xl flex flex-col items-center text-center gap-space-sm">
      <span
        className={`w-16 h-16 rounded-2xl grid place-items-center text-3xl ${
          tone === "pink" ? "bg-support-pink-subtle" : "bg-support-teal-subtle"
        }`}
        aria-hidden
      >
        {emoji}
      </span>
      <h1 className="t-headline-lg text-text-primary">{title}</h1>
      <p className="t-body text-text-muted max-w-[32ch]">{body}</p>

      <Card className="w-full max-w-sm mt-space-sm text-left">
        <div className="flex flex-col gap-space-sm">
          <p className="t-label text-text-primary text-center">{cta}</p>
          <Link
            href="/lapor"
            className="min-h-12 w-full rounded-xl bg-primary-container text-white t-label inline-flex items-center justify-center gap-space-xs hover:bg-primary transition"
          >
            <Icon name="lock" filled className="text-[18px]" />
            Lapor Sekarang
          </Link>
          <Button variant="outline" onClick={onSkip} className="w-full">
            Nanti Saja
          </Button>
        </div>
      </Card>

      <p className="t-label-sm text-text-muted mt-space-xs">Laporanmu bisa dibuat anonim 🔒</p>
    </div>
  );
}

// Reused by the calmer end-of-flow screens (no bullying involved).
function CalmCard({
  emoji,
  title,
  body,
  extraNote,
  ctaLabel,
  ctaHref,
  tone,
  onDone,
}: {
  emoji: string;
  title: string;
  body: string;
  extraNote?: string;
  ctaLabel?: string;
  ctaHref?: string;
  tone: "teal" | "pink";
  onDone: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto w-full px-margin pt-space-2xl flex flex-col items-center text-center gap-space-sm">
      <span
        className={`w-16 h-16 rounded-2xl grid place-items-center text-3xl ${
          tone === "pink" ? "bg-support-pink-subtle" : "bg-support-teal-subtle"
        }`}
        aria-hidden
      >
        {emoji}
      </span>
      <h1 className="t-headline-lg text-text-primary">{title}</h1>
      <p className="t-body text-text-muted max-w-[32ch]">{body}</p>
      {extraNote && <p className="t-label-sm text-text-muted max-w-[32ch]">{extraNote}</p>}

      {ctaLabel && ctaHref ? (
        <Card className="w-full max-w-sm mt-space-sm">
          <Link
            href={ctaHref}
            className="min-h-12 w-full rounded-xl bg-primary-container text-white t-label inline-flex items-center justify-center gap-space-xs hover:bg-primary transition"
          >
            <Icon name="menu_book" className="text-[18px]" />
            {ctaLabel}
          </Link>
        </Card>
      ) : null}

      <Button variant="outline" onClick={onDone} className="w-full max-w-sm mt-space-xs">
        Kembali ke Beranda
      </Button>
    </div>
  );
}

export default function RefleksiPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>("mood");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState("baik");
  const [content, setContent] = useState("");
  const [b2Note, setB2Note] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  const load = useCallback(() => {
    api<Entry[]>("/reflections").then(setEntries).catch(() => {});
  }, []);

  useEffect(() => {
    const ok = isLoggedIn();
    setAuthed(ok);
    if (!ok) return;
    api<{ prompt: string }>("/reflections/prompt").then((p) => setPrompt(p.prompt)).catch(() => {});
    load();
  }, [load]);

  function resetFlow() {
    setMood("baik");
    setContent("");
    setB2Note("");
    setJustSaved(false);
    setStep("mood");
  }

  async function submitMood(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/reflections", {
        method: "POST",
        body: JSON.stringify({ mood, content, prompt }),
      });
      setJustSaved(true);
      setHistoryPage(1);
      load();
      const jalur = moodInfo(mood)?.jalur ?? "a";
      setStep(jalur === "a" ? "a2" : "b2");
    } catch {
      setError("Gagal menyimpan refleksi.");
    } finally {
      setSaving(false);
    }
  }

  async function submitWitness(payload: {
    answer: boolean;
    event_at_school?: boolean;
    bullying_related?: boolean;
  }) {
    await api("/reflections/witness", { method: "POST", body: JSON.stringify(payload) }).catch(() => {});
  }

  async function remove(id: string) {
    await api(`/reflections/${id}`, { method: "DELETE" }).catch(() => {});
    load();
  }

  if (authed === false) {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <div className="max-w-2xl mx-auto w-full px-margin pt-space-lg">
          <h1 className="t-headline-lg text-text-primary mb-space-md">Ruang Refleksi</h1>
          <LoginRequired what="menulis jurnal pribadimu" />
        </div>
      </main>
    );
  }

  if (step === "mood") {
    const selected = moodInfo(mood);
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <div className="max-w-2xl mx-auto w-full px-margin pt-space-lg">
          <PageHeader
            icon="quiz"
            title="Ruang Refleksi 🌿"
            subtitle="Luangkan 2 menit untuk mendengar perasaanmu. Jawab dengan jujur, tidak ada yang benar atau salah."
          />
          <Card>
            <form onSubmit={submitMood} className="flex flex-col gap-space-md">
              <fieldset>
                <legend className="t-label text-text-primary mb-space-sm">
                  Bagaimana perasaanmu di sekolah hari ini?
                </legend>
                <div className="flex gap-space-xs flex-wrap justify-center">
                  {MOODS.map((m) => (
                    <button
                      type="button"
                      key={m.key}
                      aria-pressed={mood === m.key}
                      aria-label={m.label}
                      onClick={() => setMood(m.key)}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border transition ${
                        mood === m.key
                          ? m.jalur === "b"
                            ? "border-support-pink bg-support-pink-subtle"
                            : "border-support-teal bg-support-teal-subtle"
                          : "border-border-subtle bg-surface-card"
                      }`}
                    >
                      <span className="text-2xl" aria-hidden>{m.emoji}</span>
                      <span className="t-label-sm text-text-muted">{m.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-space-xs">
                <textarea
                  placeholder="Ceritakan apa yang membuatmu merasa begitu (opsional)…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className={inputClass}
                  rows={4}
                />
                <span className="t-label-sm text-text-muted">
                  {selected ? `Terpilih: ${selected.label}` : ""} • Dienkripsi sebelum disimpan 🔒
                </span>
              </div>

              {error && <Alert kind="error">{error}</Alert>}
              <button
                disabled={saving}
                className="min-h-12 w-full rounded-xl bg-primary-container text-white t-label inline-flex items-center justify-center gap-space-xs disabled:opacity-50 transition"
              >
                {saving ? "Menyimpan…" : "Lanjutkan →"}
              </button>
            </form>
          </Card>
        </div>
      </main>
    );
  }

  // Jalur A — Tahap 2A
  if (step === "a2") {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <div className="max-w-2xl mx-auto w-full px-margin pt-space-lg">
          <Card>
            <div className="flex flex-col items-center text-center gap-space-sm mb-space-lg">
              <span className="w-14 h-14 rounded-2xl bg-ocean-subtle grid place-items-center text-2xl" aria-hidden>
                {moodInfo(mood)?.emoji ?? "🙂"}
              </span>
              <p className="flex items-start gap-space-xs t-body-sm text-support-teal bg-support-teal-subtle rounded-xl px-3 py-2.5">
                <Icon name="volunteer_activism" filled className="text-[16px] shrink-0 mt-0.5" />
                {AFFIRMATIONS[mood] ?? "Senang kamu baik-baik saja hari ini!"}
              </p>
              <h2 className="t-headline-sm text-text-primary">Ngomong-ngomong…</h2>
              <p className="t-body text-text-muted max-w-[36ch]">
                Pernahkah kamu melihat atau mengalami bullying di sekolah?
              </p>
            </div>
            <div className="flex flex-col gap-space-sm">
              <ChoiceButton
                tone="teal"
                emoji="👀"
                label="Ya, pernah melihat/mengalami"
                onClick={async () => {
                  await submitWitness({ answer: true });
                  setStep("a-end-pernah");
                }}
              />
              <ChoiceButton
                tone="teal"
                emoji="🙅"
                label="Belum pernah"
                onClick={async () => {
                  await submitWitness({ answer: false });
                  setStep("a-end-tidak");
                }}
              />
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (step === "a-end-pernah") {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <LaporCard
          emoji="🤗"
          title="Kamu tidak sendirian."
          body="Banyak siswa yang pernah menyaksikan hal yang sama. Keberanian untuk berbicara bisa membantu temanmu."
          cta="Mau cerita ke Guru BK?"
          tone="teal"
          onSkip={() => setStep("history")}
        />
      </main>
    );
  }

  if (step === "a-end-tidak") {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <CalmCard
          emoji="💪"
          title="Itu hal yang baik!"
          body="Meskipun belum pernah menyaksikan bullying, penting untuk tetap waspada dan tahu apa yang harus dilakukan."
          extraNote="Yuk pelajari cara melindungi diri dan teman dari bullying!"
          ctaLabel="Pelajari Materi"
          ctaHref="/edukasi"
          tone="teal"
          onDone={() => setStep("history")}
        />
      </main>
    );
  }

  // Jalur B — Tahap 2B
  if (step === "b2") {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <div className="max-w-2xl mx-auto w-full px-margin pt-space-lg">
          <Card>
            <div className="flex flex-col items-center text-center gap-space-sm mb-space-md">
              <span className="w-14 h-14 rounded-2xl bg-support-pink-subtle grid place-items-center text-2xl" aria-hidden>
                {moodInfo(mood)?.emoji ?? "🤗"}
              </span>
              <p className="t-headline-sm text-text-primary">Terima kasih sudah jujur.</p>
              <p className="t-body text-text-muted">
                Kamu tidak sendirian. Wajar untuk merasa seperti itu kadang-kadang.
              </p>
            </div>
            <p className="flex items-start gap-space-xs t-body text-support-pink bg-support-pink-subtle rounded-xl px-3 py-2.5 mb-space-md">
              <Icon name="lock" filled className="text-[18px] shrink-0 mt-0.5" />
              Ruang ini aman. Hanya kamu yang bisa membaca tulisanmu di sini.
            </p>
            <textarea
              placeholder="Ceritakan lebih lanjut kalau kamu mau… (opsional)"
              value={b2Note}
              onChange={(e) => setB2Note(e.target.value)}
              className={`${inputClass} mb-space-md`}
              rows={4}
            />
            <Button onClick={() => setStep("b3")} className="w-full">
              Lanjutkan →
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  // Jalur B — Tahap 3B
  if (step === "b3") {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <div className="max-w-2xl mx-auto w-full px-margin pt-space-lg">
          <Card>
            <div className="flex flex-col items-center text-center gap-space-sm mb-space-lg">
              <span className="w-14 h-14 rounded-2xl bg-support-pink-subtle grid place-items-center text-2xl" aria-hidden>
                🤔
              </span>
              <p className="t-headline-sm text-text-primary">Boleh aku tanya satu hal?</p>
              <p className="t-body text-text-muted">
                Apakah ada kejadian di sekolah yang membuatmu merasa cemas atau tertekan hari ini?
              </p>
            </div>
            <div className="flex flex-col gap-space-sm mb-space-lg">
              <ChoiceButton
                tone="pink"
                emoji="😔"
                label="Ya, ada kejadian tertentu"
                onClick={() => setStep("b4")}
              />
              <ChoiceButton
                tone="pink"
                emoji="🙂"
                label="Tidak, hanya perasaan biasa"
                onClick={async () => {
                  await submitWitness({ answer: false, event_at_school: false });
                  setStep("b-end-tenang");
                }}
              />
            </div>
          </Card>
        </div>
      </main>
    );
  }

  // Jalur B — Tahap 4B
  if (step === "b4") {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <div className="max-w-2xl mx-auto w-full px-margin pt-space-lg">
          <Card>
            <div className="flex flex-col items-center text-center gap-space-sm mb-space-lg">
              <span className="w-14 h-14 rounded-2xl bg-support-pink-subtle grid place-items-center text-2xl" aria-hidden>
                💭
              </span>
              <p className="t-headline-sm text-text-primary">Satu pertanyaan lagi…</p>
              <p className="t-body text-text-muted">
                Apakah kejadian itu berkaitan dengan bullying yang kamu alami atau saksikan?
              </p>
            </div>
            <div className="flex flex-col gap-space-sm mb-space-lg">
              <ChoiceButton
                tone="pink"
                emoji="😰"
                label="Ya, berkaitan dengan bullying"
                onClick={async () => {
                  await submitWitness({ answer: true, event_at_school: true, bullying_related: true });
                  setStep("b-end-lapor");
                }}
              />
              <ChoiceButton
                tone="pink"
                emoji="🙂"
                label="Tidak, bukan soal bullying"
                onClick={async () => {
                  await submitWitness({ answer: false, event_at_school: true, bullying_related: false });
                  setStep("b-end-tenang2");
                }}
              />
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (step === "b-end-tenang") {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <CalmCard
          emoji="💙"
          title="Semoga harimu lebih baik."
          body="Ingat, Guru BK selalu siap mendengarmu kapan saja."
          tone="pink"
          onDone={() => setStep("history")}
        />
      </main>
    );
  }

  if (step === "b-end-lapor") {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <LaporCard
          emoji="🤗"
          title="Kamu sudah sangat berani."
          body="Mengakui perasaan ini butuh keberanian. Guru BK siap membantu."
          cta="Mau cerita ke Guru BK?"
          tone="pink"
          onSkip={() => setStep("history")}
        />
      </main>
    );
  }

  if (step === "b-end-tenang2") {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <CalmCard
          emoji="💙"
          title="Semoga harimu segera membaik."
          body="Ingat, Guru BK selalu siap mendengarmu kapan saja."
          tone="pink"
          onDone={() => setStep("history")}
        />
      </main>
    );
  }

  // step === "history"
  const recent = entries.slice(0, 14).reverse();
  const totalHistoryPages = Math.max(1, Math.ceil(entries.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const pagedEntries = entries.slice(
    (currentHistoryPage - 1) * HISTORY_PAGE_SIZE,
    currentHistoryPage * HISTORY_PAGE_SIZE,
  );

  return (
    <main className="flex-1 w-full pt-16 pb-24">
      <div className="max-w-2xl mx-auto w-full px-margin flex flex-col gap-space-md pt-space-lg">
        <header>
          <div className="flex items-center justify-between gap-space-sm flex-wrap">
            <h1 className="t-headline-lg text-text-primary">
              Ruang Refleksi <span aria-hidden>🌿</span>
            </h1>
            <span className="inline-flex items-center gap-space-xs px-3 py-1 rounded-full bg-support-teal-subtle text-support-teal t-label-md">
              <Icon name="lock" filled className="text-[16px]" />
              100% terenkripsi &amp; privat
            </span>
          </div>
          <div className="flex justify-end mt-space-sm">
            <button
              type="button"
              onClick={resetFlow}
              className="inline-flex items-center gap-space-xs px-3 py-2 rounded-full border border-border-subtle bg-surface-card text-text-primary t-label-md hover:border-primary-container transition"
            >
              <Icon name="edit_note" className="text-[18px]" />
              Tulis refleksi baru
            </button>
          </div>
        </header>

        {justSaved && (
          <Alert kind="success">
            Refleksi tersimpan — terenkripsi dan hanya kamu yang bisa membacanya.
          </Alert>
        )}

        {recent.length > 1 && (
          <section className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
            <h2 className="t-label text-text-primary mb-space-sm">Suasana hatimu belakangan ini</h2>
            <ol className="flex gap-1 items-end overflow-x-auto pb-1">
              {recent.map((e) => (
                <li key={e.id} className="flex flex-col items-center shrink-0 w-9">
                  <span className="text-xl" title={e.mood}>{moodInfo(e.mood)?.emoji ?? "🙂"}</span>
                  <span className="t-label-sm text-text-muted">{new Date(e.created_at).getDate()}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section>
          <h2 className="t-headline-sm text-text-primary mb-space-sm">Riwayat catatanmu</h2>
          {entries.length === 0 ? (
            <Empty>Belum ada refleksi. Mulai tulis yang pertama.</Empty>
          ) : (
            <ul className="flex flex-col gap-space-sm">
              {pagedEntries.map((e) => (
                <li key={e.id} className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
                  <div className="flex items-start justify-between gap-space-sm">
                    <div className="min-w-0">
                      <p className="t-label-md text-text-muted">
                        {new Date(e.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        {" • "}
                        <span aria-hidden>{moodInfo(e.mood)?.emoji ?? "🙂"}</span> {e.mood}
                      </p>
                      {e.prompt && <p className="t-body-sm text-text-muted italic mt-0.5">{e.prompt}</p>}
                      <p className="t-body text-text-primary mt-space-xs whitespace-pre-line wrap-break-word">
                        {e.content}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          aria-label="Hapus refleksi"
                          className="text-text-muted hover:text-danger-rose shrink-0 w-9 h-9 grid place-items-center rounded-lg"
                        >
                          <Icon name="close" className="text-[20px]" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus catatan ini?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tindakan ini tidak bisa dibatalkan. Catatan akan hilang permanen.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(e.id)}>Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {totalHistoryPages > 1 && (
            <div className="flex items-center justify-between gap-space-sm mt-space-md">
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={currentHistoryPage === 1}
                className="flex items-center gap-1 t-label-md text-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon name="arrow_back" className="text-[16px]" />
                Sebelumnya
              </button>
              <span className="t-body-sm text-text-muted">
                Halaman {currentHistoryPage} dari {totalHistoryPages}
              </span>
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                disabled={currentHistoryPage === totalHistoryPages}
                className="flex items-center gap-1 t-label-md text-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Berikutnya
                <Icon name="arrow_forward" className="text-[16px]" />
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
