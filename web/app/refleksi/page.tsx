"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { api, isLoggedIn } from "@/lib/api";
import { Alert, Empty, LoginRequired, inputClass } from "@/components/ui";
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

// Keys are stored, labels are shown. Storing a word rather than an emoji keeps
// the mood history readable if the emoji set ever changes.
const MOODS = [
  { key: "senang", emoji: "😄", label: "Sangat Baik", note: "Senang mendengarnya. Simpan momen ini." },
  { key: "baik", emoji: "🙂", label: "Baik", note: "Hari yang cukup tenang. Ceritakan apa yang membuatnya begitu." },
  { key: "biasa", emoji: "😐", label: "Biasa", note: "Tidak semua hari harus istimewa, dan itu tidak apa-apa." },
  { key: "cemas", emoji: "😟", label: "Cemas", note: "Perasaan cemas itu wajar. Kamu aman di sini untuk menguraikannya." },
  { key: "sedih", emoji: "😢", label: "Tertekan", note: "Berat rasanya. Tulis pelan-pelan — atau lapor kalau kamu butuh bantuan." },
];

const moodInfo = (key: string) => MOODS.find((m) => m.key === key);

export default function RefleksiPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState("baik");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api("/reflections", {
        method: "POST",
        body: JSON.stringify({ mood, content, prompt }),
      });
      setContent("");
      setSaved(true);
      load();
    } catch {
      setError("Gagal menyimpan refleksi.");
    } finally {
      setSaving(false);
    }
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

  const recent = entries.slice(0, 14).reverse();
  const selected = moodInfo(mood);

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
          <p className="t-body text-text-muted mt-space-sm">
            Luangkan 2 menit untuk mendengar perasaanmu hari ini. Hanya kamu yang dapat
            membaca tulisan ini.
          </p>
        </header>

        <section className="bg-surface-card border border-border-subtle rounded-2xl p-space-md e-card">
          <form onSubmit={onSubmit} className="flex flex-col gap-space-md">
            <fieldset>
              <legend className="t-label text-text-primary mb-space-sm">
                Bagaimana perasaanmu di sekolah hari ini?
              </legend>
              <div className="flex gap-space-xs flex-wrap">
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

            {selected && (
              <p className="flex items-start gap-space-xs t-body text-primary bg-ocean-subtle rounded-xl px-3 py-2.5">
                <Icon name="info" className="text-[18px] shrink-0 mt-0.5" />
                {selected.note}
              </p>
            )}

            <div className="flex flex-col gap-space-xs">
              <span className="inline-flex items-center gap-space-xs t-label-md text-text-muted">
                <Icon name="edit_note" className="text-[18px]" />
                {prompt || "Bagaimana perasaanmu hari ini?"}
              </span>
              <textarea
                required
                placeholder="Tuliskan apa pun yang kamu rasakan tanpa beban…"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  // Konfirmasi milik catatan yang barusan disimpan; begitu siswa
                  // mulai menulis lagi, membiarkannya berarti menandai tulisan
                  // baru yang belum tersimpan sebagai sudah tersimpan.
                  setSaved(false);
                }}
                className={inputClass}
                rows={4}
              />
              <span className="t-label-sm text-text-muted">
                {content.length} karakter • Dienkripsi sebelum disimpan
              </span>
            </div>

            {error && <Alert kind="error">{error}</Alert>}
            {saved && (
              <Alert kind="success">
                Refleksi tersimpan — terenkripsi dan hanya kamu yang bisa
                membacanya.
              </Alert>
            )}
            <button
              disabled={saving}
              className="min-h-12 w-full rounded-xl bg-primary-container text-white t-label inline-flex items-center justify-center gap-space-xs disabled:opacity-50 transition"
            >
              <Icon name="lock" className="text-[20px]" />
              {saving ? "Menyimpan…" : "Simpan catatan pribadi"}
            </button>
          </form>
        </section>

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
