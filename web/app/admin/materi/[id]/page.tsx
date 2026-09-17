"use client";

import { use, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { api, isAdmin } from "@/lib/api";
import { removeOption, type Q } from "@/lib/quiz";
import RichTextEditor from "@/components/RichTextEditor";
import { PageHeader, Card, Button, Field, Alert, Empty, inputClass } from "@/components/ui";

type Module = {
  title: string;
  category: string;
  content_type: string;
  body: string;
  quiz: Q[];
  order_index: number;
  published: boolean;
};

const BLANK: Module = {
  title: "",
  category: "",
  content_type: "article",
  body: "",
  quiz: [],
  order_index: 0,
  published: true,
};

const CONTENT_TYPES = [
  { value: "article", label: "Artikel" },
  { value: "video", label: "Video" },
  { value: "infographic", label: "Infografis" },
];

export default function MateriEditorPage({ params }: PageProps<"/admin/materi/[id]">) {
  const { id } = use(params);
  const isNew = id === "baru";
  const router = useRouter();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [m, setM] = useState<Module | null>(isNew ? BLANK : null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ok = isAdmin();
    setAllowed(ok);
    if (!ok || isNew) return;
    api<Module>(`/admin/education/modules/${id}`)
      .then((d) => setM({ ...d, quiz: d.quiz ?? [] }))
      .catch(() => setError("Materi tidak ditemukan."));
  }, [id, isNew]);

  const patch = (p: Partial<Module>) => setM((x) => (x ? { ...x, ...p } : x));

  const patchQ = (i: number, p: Partial<Q>) =>
    setM((x) => (x ? { ...x, quiz: x.quiz.map((q, j) => (j === i ? { ...q, ...p } : q)) } : x));

  const dropOption = (qi: number, oi: number) => patchQ(qi, removeOption(m!.quiz[qi], oi));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      if (isNew) {
        const { id: newID } = await api<{ id: string }>("/admin/education/modules", {
          method: "POST",
          body: JSON.stringify(m),
        });
        router.replace(`/admin/materi/${newID}`);
      } else {
        await api(`/admin/education/modules/${id}`, { method: "PATCH", body: JSON.stringify(m) });
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan materi.");
    } finally {
      setSaving(false);
    }
  }

  if (allowed === false) {
    return (
      <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
        <Alert kind="error">Halaman ini hanya untuk guru pendamping.</Alert>
      </main>
    );
  }
  if (!m) {
    return (
      <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
        {error ? <Alert kind="error">{error}</Alert> : <Empty>Memuat…</Empty>}
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
      <div className="flex items-center justify-between gap-space-sm">
        <Link href="/admin/materi" className="text-sm text-primary underline">
          ← Semua materi
        </Link>
        {!isNew && (
          <Link href={`/edukasi/${id}`} className="text-sm text-primary underline">
            Pratinjau siswa →
          </Link>
        )}
      </div>
      <div className="mt-3">
        <PageHeader icon="menu_book" title={isNew ? "Materi Baru" : "Ubah Materi"} />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-space-md">
        <Card className="flex flex-col gap-3">
          <Field label="Judul">
            <input
              value={m.title}
              onChange={(e) => patch({ title: e.target.value })}
              className={inputClass}
              placeholder="Misal: Mengenali Bentuk Perundungan"
            />
          </Field>
          <Field label="Kategori" hint="Tampil sebagai label di daftar materi siswa.">
            <input
              value={m.category}
              onChange={(e) => patch({ category: e.target.value })}
              className={inputClass}
              placeholder="Misal: dasar"
            />
          </Field>
          <Field label="Jenis konten">
            <select
              value={m.content_type}
              onChange={(e) => patch({ content_type: e.target.value })}
              className={inputClass}
            >
              {CONTENT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-col gap-space-xs">
            <span className="t-label text-text-primary">Isi materi</span>
            <RichTextEditor value={m.body} onChange={(body) => patch({ body })} />
          </div>
          <Field label="Urutan" hint="Angka lebih kecil tampil lebih dulu.">
            <input
              type="number"
              value={m.order_index}
              onChange={(e) => patch({ order_index: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-space-sm t-label text-text-primary">
            <input
              type="checkbox"
              checked={m.published}
              onChange={(e) => patch({ published: e.target.checked })}
              className="w-5 h-5 accent-primary-container"
            />
            Terbitkan untuk siswa
          </label>
          {!m.published && (
            <p className="t-label-md text-text-muted">
              Materi terarsip hilang dari daftar siswa. Progres yang sudah tercatat tetap tersimpan
              dan kembali terhitung kalau materi diterbitkan lagi.
            </p>
          )}
        </Card>

        <div>
          <h2 className="t-label text-text-primary mb-space-sm">Kuis</h2>
          <div className="flex flex-col gap-3">
            {m.quiz.map((q, qi) => (
              <Card key={qi} className="flex flex-col gap-3">
                <Field label={`Pertanyaan ${qi + 1}`}>
                  <textarea
                    value={q.question}
                    onChange={(e) => patchQ(qi, { question: e.target.value })}
                    className={inputClass}
                    rows={2}
                  />
                </Field>

                <fieldset className="flex flex-col gap-2">
                  <legend className="t-label text-text-primary mb-1">
                    Pilihan jawaban{" "}
                    <span className="t-label-md text-text-muted font-normal">
                      — tandai yang benar
                    </span>
                  </legend>
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-space-sm">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correct_index === oi}
                        onChange={() => patchQ(qi, { correct_index: oi })}
                        aria-label={`Jawaban benar: pilihan ${oi + 1}`}
                        className="w-5 h-5 shrink-0 accent-primary-container"
                      />
                      <input
                        value={o}
                        onChange={(e) =>
                          patchQ(qi, {
                            options: q.options.map((x, j) => (j === oi ? e.target.value : x)),
                          })
                        }
                        className={inputClass}
                        placeholder={`Pilihan ${oi + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => dropOption(qi, oi)}
                        aria-label={`Hapus pilihan ${oi + 1}`}
                        className="w-9 h-9 shrink-0 grid place-items-center rounded-full text-text-muted hover:text-danger-rose"
                      >
                        <Icon name="close" className="text-[20px]" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => patchQ(qi, { options: [...q.options, ""] })}
                    className="t-label text-primary-container self-start underline underline-offset-2"
                  >
                    + Tambah pilihan
                  </button>
                </fieldset>

                <button
                  type="button"
                  onClick={() => patch({ quiz: m.quiz.filter((_, j) => j !== qi) })}
                  className="t-label text-text-muted self-start underline underline-offset-2 hover:text-danger-rose"
                >
                  Hapus pertanyaan ini
                </button>
              </Card>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-3 flex items-center gap-space-xs"
            onClick={() =>
              patch({ quiz: [...m.quiz, { question: "", options: ["", ""], correct_index: 0 }] })
            }
          >
            <Icon name="add" className="text-[20px]" />
            Tambah pertanyaan
          </Button>
        </div>

        {error && <Alert kind="error">{error}</Alert>}
        {saved && <Alert kind="success">Materi tersimpan.</Alert>}
        <Button disabled={saving} className="self-start">
          {saving ? "Menyimpan…" : "Simpan materi"}
        </Button>
      </form>
    </main>
  );
}
