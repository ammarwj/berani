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

type Step =
  | "mood"
  | "a2"
  | "a-end"
  | "b2"
  | "b3"
  | "b4"
  | "b-end-tenang"
  | "b-end-lapor"
  | "b-end-tenang2"
  | "history";

function ChoiceButton({
  selected,
  onClick,
  emoji,
  label,
  variant,
}: {
  selected: boolean;
  onClick: () => void;
  emoji: string;
  label: string;
  variant: "yes" | "no";
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full flex items-center gap-space-sm px-4 py-3 rounded-xl border-2 text-left transition ${
        selected
          ? variant === "yes"
            ? "border-primary-container bg-ocean-subtle text-primary"
            : "border-text-muted bg-surface-muted text-text-primary"
          : "border-border-subtle bg-surface-card text-text-primary"
      }`}
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
  onSkip,
}: {
  emoji: string;
  title: string;
  body: string;
  cta: string;
  onSkip: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto w-full px-margin pt-space-2xl flex flex-col items-center text-center gap-space-sm">
      <span className="w-16 h-16 rounded-2xl bg-ocean-subtle grid place-items-center text-3xl" aria-hidden>
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
  onDone,
}: {
  emoji: string;
  title: string;
  body: string;
  extraNote?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onDone: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto w-full px-margin pt-space-2xl flex flex-col items-center text-center gap-space-sm">
      <span className="w-16 h-16 rounded-2xl bg-ocean-subtle grid place-items-center text-3xl" aria-hidden>
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

      <button
        type="button"
        onClick={onDone}
        className="t-label-sm text-primary underline underline-offset-2 mt-space-xs"
      >
        Kembali ke Beranda
      </button>
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
                          ? "border-primary-container bg-ocean-subtle"
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
            <p className="t-headline-sm text-text-primary text-center mb-space-lg">
              Ngomong-ngomong… pernahkah kamu melihat atau mengalami bullying di sekolah?
            </p>
            <div className="flex flex-col gap-space-sm mb-space-lg">
              <ChoiceButton
                variant="yes"
                selected={false}
                emoji="👀"
                label="Ya, pernah melihat/mengalami"
                onClick={async () => {
                  await submitWitness({ answer: true });
                  setStep("a-end");
                }}
              />
              <ChoiceButton
                variant="no"
                selected={false}
                emoji="🙅"
                label="Belum pernah"
                onClick={async () => {
                  await submitWitness({ answer: false });
                  setStep("a-end");
                }}
              />
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (step === "a-end") {
    return (
      <main className="flex-1 w-full pt-16 pb-24">
        <LaporCard
          emoji="🤗"
          title="Kamu tidak sendirian."
          body="Banyak siswa yang pernah menyaksikan hal yang sama. Keberanian untuk berbicara bisa membantu temanmu."
          cta="Mau cerita ke Guru BK?"
          onSkip={() => setStep("history")}
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
            <div className="text-2xl text-center mb-space-sm" aria-hidden>🤗</div>
            <p className="t-headline-sm text-text-primary text-center mb-space-xs">Terima kasih sudah jujur.</p>
            <p className="t-body text-text-muted text-center mb-space-md">
              Kamu tidak sendirian. Wajar untuk merasa seperti itu kadang-kadang.
            </p>
            <p className="flex items-start gap-space-xs t-body text-primary bg-ocean-subtle rounded-xl px-3 py-2.5 mb-space-md">
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
            <p className="t-headline-sm text-text-primary text-center mb-space-xs">Boleh aku tanya satu hal?</p>
            <p className="t-body text-text-muted text-center mb-space-lg">
              Apakah ada kejadian di sekolah yang membuatmu merasa cemas atau tertekan hari ini?
            </p>
            <div className="flex flex-col gap-space-sm mb-space-lg">
              <ChoiceButton
                variant="yes"
                selected={false}
                emoji="😔"
                label="Ya, ada kejadian tertentu"
                onClick={() => setStep("b4")}
              />
              <ChoiceButton
                variant="no"
                selected={false}
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
            <p className="t-headline-sm text-text-primary text-center mb-space-xs">Satu pertanyaan lagi…</p>
            <p className="t-body text-text-muted text-center mb-space-lg">
              Apakah kejadian itu berkaitan dengan bullying yang kamu alami atau saksikan?
            </p>
            <div className="flex flex-col gap-space-sm mb-space-lg">
              <ChoiceButton
                variant="yes"
                selected={false}
                emoji="😰"
                label="Ya, berkaitan dengan bullying"
                onClick={async () => {
                  await submitWitness({ answer: true, event_at_school: true, bullying_related: true });
                  setStep("b-end-lapor");
                }}
              />
              <ChoiceButton
                variant="no"
                selected={false}
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
          onDone={() => setStep("history")}
        />
      </main>
    );
  }

  // step === "history"
  const recent = entries.slice(0, 14).reverse();

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
              {entries.map((e) => (
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
        </section>
      </div>
    </main>
  );
}
