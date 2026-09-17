"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import Icon, { ICON_NAMES } from "@/components/Icon";
import { api, isSuperAdmin } from "@/lib/api";
import type { Settings } from "@/lib/settings";
import { PageHeader, Card, Button, Field, Alert, Empty, inputClass } from "@/components/ui";

// Ikon dipilih dari allowlist, bukan diketik: nama di luar daftar ini tidak ikut
// diunduh layout.tsx dan akan tampil sebagai teks mentah di halaman siswa.
const ICON_OPTIONS = ICON_NAMES.split(",");

export default function PengaturanPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ok = isSuperAdmin();
    setAllowed(ok);
    if (!ok) return;
    api<Settings>("/settings")
      .then(setS)
      .catch(() => setError("Gagal memuat pengaturan."));
  }, []);

  const patch = (p: Partial<Settings>) => setS((x) => (x ? { ...x, ...p } : x));

  const patchCat = (i: number, p: Partial<Settings["report_categories"][number]>) =>
    setS((x) =>
      x
        ? { ...x, report_categories: x.report_categories.map((c, j) => (j === i ? { ...c, ...p } : c)) }
        : x,
    );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api("/admin/settings", { method: "PATCH", body: JSON.stringify(s) });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  }

  if (allowed === false) {
    return (
      <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
        <PageHeader icon="settings" title="Pengaturan" />
        <Alert kind="error">
          Halaman ini hanya untuk super admin.{" "}
          <Link href="/login" className="underline font-semibold">
            Masuk sebagai admin
          </Link>
        </Alert>
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
      <PageHeader
        icon="settings"
        title="Pengaturan Sekolah"
        subtitle="Identitas, kontak darurat, dan kanal lapor yang dipakai seluruh aplikasi."
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-space-md">
        <Card className="flex flex-col gap-3">
          <h2 className="t-label text-text-primary">Identitas & kontak</h2>
          <Field label="Nama sekolah">
            <input
              value={s.school_name}
              onChange={(e) => patch({ school_name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field
            label="Nama guru BK"
            hint="Hanya tampil untuk siswa yang sudah masuk — nomor staf tidak perlu terbaca publik."
          >
            <input
              value={s.bk_name ?? ""}
              onChange={(e) => patch({ bk_name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Nomor guru BK">
            <input
              type="tel"
              value={s.bk_phone ?? ""}
              onChange={(e) => patch({ bk_phone: e.target.value })}
              className={inputClass}
              placeholder="08xxxxxxxxxx"
            />
          </Field>
          <Field label="Label hotline">
            <input
              value={s.hotline_label}
              onChange={(e) => patch({ hotline_label: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Nomor hotline" hint="Tampil untuk semua pengunjung, termasuk yang belum masuk.">
            <input
              type="tel"
              value={s.hotline_phone}
              onChange={(e) => patch({ hotline_phone: e.target.value })}
              className={inputClass}
            />
          </Field>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="t-label text-text-primary">Kanal lapor</h2>
          <label className="flex items-center gap-space-sm t-label text-text-primary">
            <input
              type="checkbox"
              checked={s.anonymous_enabled}
              onChange={(e) => patch({ anonymous_enabled: e.target.checked })}
              className="w-5 h-5 accent-primary-container"
            />
            Izinkan laporan anonim
          </label>
          {!s.anonymous_enabled && (
            <p className="t-label-md text-text-muted">
              Pilihan anonim hilang dari form lapor dan laporan anonim ditolak server. Laporan anonim
              yang sudah masuk tetap anonim — identitas pelapornya memang tidak pernah disimpan.
            </p>
          )}
        </Card>

        <div>
          <h2 className="t-label text-text-primary mb-space-sm">Kategori laporan</h2>
          <div className="flex flex-col gap-3">
            {s.report_categories.map((c, i) => (
              <Card key={i} className="flex flex-col gap-3">
                <div className="flex items-center gap-space-sm">
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-ocean-subtle text-primary-container grid place-items-center">
                    <Icon name={c.icon} className="text-[22px]" />
                  </span>
                  <input
                    value={c.label}
                    onChange={(e) => patchCat(i, { label: e.target.value })}
                    className={inputClass}
                    aria-label={`Nama kategori ${i + 1}`}
                    placeholder="Nama kategori"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({ report_categories: s.report_categories.filter((_, j) => j !== i) })
                    }
                    aria-label={`Hapus kategori ${c.label || i + 1}`}
                    className="w-9 h-9 shrink-0 grid place-items-center rounded-full text-text-muted hover:text-danger-rose"
                  >
                    <Icon name="close" className="text-[20px]" />
                  </button>
                </div>
                <Field
                  label="Kode"
                  hint="Tersimpan di setiap laporan. Mengubahnya tidak mengubah laporan lama."
                >
                  <input
                    value={c.value}
                    onChange={(e) => patchCat(i, { value: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Penjelasan singkat">
                  <input
                    value={c.desc}
                    onChange={(e) => patchCat(i, { desc: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Ikon">
                  <select
                    value={c.icon}
                    onChange={(e) => patchCat(i, { icon: e.target.value })}
                    className={inputClass}
                  >
                    {ICON_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
              </Card>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="mt-3 flex items-center gap-space-xs"
            onClick={() =>
              patch({
                report_categories: [
                  ...s.report_categories,
                  { value: "", icon: "chat_bubble", label: "", desc: "" },
                ],
              })
            }
          >
            <Icon name="add" className="text-[20px]" />
            Tambah kategori
          </Button>
        </div>

        {error && <Alert kind="error">{error}</Alert>}
        {saved && <Alert kind="success">Pengaturan tersimpan.</Alert>}
        <Button disabled={saving} className="self-start">
          {saving ? "Menyimpan…" : "Simpan pengaturan"}
        </Button>
      </form>
    </main>
  );
}
