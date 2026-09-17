"use client";

import { use, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { api, isAdmin } from "@/lib/api";
import { PageHeader, Card, Button, Field, Alert, Empty, inputClass } from "@/components/ui";

type Option = { label: string; feedback: string; is_best: boolean };
type Scenario = {
  prompt: string;
  category: string;
  options: Option[];
  order_index: number;
  published: boolean;
};

const BLANK: Scenario = {
  prompt: "",
  category: "umum",
  options: [
    { label: "", feedback: "", is_best: true },
    { label: "", feedback: "", is_best: false },
  ],
  order_index: 0,
  published: true,
};

export default function SkenarioEditorPage({ params }: PageProps<"/admin/skenario/[id]">) {
  const { id } = use(params);
  const isNew = id === "baru";
  const router = useRouter();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [s, setS] = useState<Scenario | null>(isNew ? BLANK : null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ok = isAdmin();
    setAllowed(ok);
    if (!ok || isNew) return;
    api<Scenario>(`/admin/training/scenarios/${id}`)
      .then((d) => setS({ ...d, options: d.options ?? [] }))
      .catch(() => setError("Skenario tidak ditemukan."));
  }, [id, isNew]);

  const patch = (p: Partial<Scenario>) => setS((x) => (x ? { ...x, ...p } : x));

  const patchOpt = (i: number, p: Partial<Option>) =>
    setS((x) => (x ? { ...x, options: x.options.map((o, j) => (j === i ? { ...o, ...p } : o)) } : x));

  // Tepat satu is_best: radio dalam satu grup, jadi memilih yang baru harus ikut
  // mematikan yang lama. Server menolak kalau jumlahnya bukan satu.
  const setBest = (i: number) =>
    setS((x) => (x ? { ...x, options: x.options.map((o, j) => ({ ...o, is_best: j === i })) } : x));

  // Membuang respons terbaik menyisakan skenario tanpa jawaban benar. Pindahkan
  // tandanya ke opsi pertama daripada menyimpan skenario yang selalu salah.
  function removeOption(i: number) {
    const options = s!.options.filter((_, j) => j !== i);
    if (options.length > 0 && !options.some((o) => o.is_best)) options[0] = { ...options[0], is_best: true };
    patch({ options });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      if (isNew) {
        const { id: newID } = await api<{ id: string }>("/admin/training/scenarios", {
          method: "POST",
          body: JSON.stringify(s),
        });
        router.replace(`/admin/skenario/${newID}`);
      } else {
        await api(`/admin/training/scenarios/${id}`, { method: "PATCH", body: JSON.stringify(s) });
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan skenario.");
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
  if (!s) {
    return (
      <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
        {error ? <Alert kind="error">{error}</Alert> : <Empty>Memuat…</Empty>}
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
      <div className="flex items-center justify-between gap-space-sm">
        <Link href="/admin/skenario" className="text-sm text-primary underline">
          ← Semua skenario
        </Link>
        <Link href="/latihan" className="text-sm text-primary underline">
          Pratinjau siswa →
        </Link>
      </div>
      <div className="mt-3">
        <PageHeader icon="psychology" title={isNew ? "Skenario Baru" : "Ubah Skenario"} />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-space-md">
        <Card className="flex flex-col gap-3">
          <Field label="Situasi" hint="Ceritakan kejadiannya dari sudut pandang siswa.">
            <textarea
              value={s.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
              className={inputClass}
              rows={4}
              placeholder="Misal: Temanmu dijadikan bahan lelucon di grup kelas…"
            />
          </Field>
          <Field label="Kategori">
            <input
              value={s.category}
              onChange={(e) => patch({ category: e.target.value })}
              className={inputClass}
              placeholder="umum"
            />
          </Field>
          <Field label="Urutan" hint="Angka lebih kecil tampil lebih dulu.">
            <input
              type="number"
              value={s.order_index}
              onChange={(e) => patch({ order_index: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-space-sm t-label text-text-primary">
            <input
              type="checkbox"
              checked={s.published}
              onChange={(e) => patch({ published: e.target.checked })}
              className="w-5 h-5 accent-primary-container"
            />
            Terbitkan untuk siswa
          </label>
        </Card>

        <fieldset>
          <legend className="t-label text-text-primary mb-space-sm">
            Pilihan respons{" "}
            <span className="t-label-md text-text-muted font-normal">— tandai satu yang terbaik</span>
          </legend>
          <div className="flex flex-col gap-3">
            {s.options.map((o, i) => (
              <Card key={i} className="flex flex-col gap-3">
                <div className="flex items-center gap-space-sm">
                  <input
                    type="radio"
                    name="best"
                    checked={o.is_best}
                    onChange={() => setBest(i)}
                    aria-label={`Respons terbaik: pilihan ${i + 1}`}
                    className="w-5 h-5 shrink-0 accent-primary-container"
                  />
                  <input
                    value={o.label}
                    onChange={(e) => patchOpt(i, { label: e.target.value })}
                    className={inputClass}
                    placeholder={`Respons ${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    aria-label={`Hapus respons ${i + 1}`}
                    className="w-9 h-9 shrink-0 grid place-items-center rounded-full text-text-muted hover:text-danger-rose"
                  >
                    <Icon name="close" className="text-[20px]" />
                  </button>
                </div>
                <Field label="Umpan balik" hint="Muncul setelah siswa memilih respons ini.">
                  <textarea
                    value={o.feedback}
                    onChange={(e) => patchOpt(i, { feedback: e.target.value })}
                    className={inputClass}
                    rows={2}
                  />
                </Field>
              </Card>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-3 flex items-center gap-space-xs"
            onClick={() => patch({ options: [...s.options, { label: "", feedback: "", is_best: false }] })}
          >
            <Icon name="add" className="text-[20px]" />
            Tambah respons
          </Button>
        </fieldset>

        {error && <Alert kind="error">{error}</Alert>}
        {saved && <Alert kind="success">Skenario tersimpan.</Alert>}
        <Button disabled={saving} className="self-start">
          {saving ? "Menyimpan…" : "Simpan skenario"}
        </Button>
      </form>
    </main>
  );
}
