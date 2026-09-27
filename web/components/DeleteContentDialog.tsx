"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";

// Konfirmasi hapus permanen untuk materi & skenario, dipakai dari daftar maupun
// editor — empat tempat dengan kontrak yang sama, jadi satu komponen. Yang
// berbeda cuma bentuk footprint-nya, dan itu masuk lewat `describe`.
//
// Tidak ada input "ketik untuk mengonfirmasi" di sini: satu klik Hapus sudah
// cukup. Yang menggantikannya adalah **tombol Hapus mati sampai footprint
// tiba** — tanpa itu tidak ada yang bisa memberitahu admin apakah ia sedang
// membuang draf kosong atau menghanguskan nilai kuis 40 siswa, dan keduanya
// terlihat identik di UI. Jangan ubah jadi optimistis: dialog yang bisa
// dikonfirmasi sebelum angkanya tampil sama saja dengan tanpa dialog.
export type Footprint = { body: React.ReactNode };

export default function DeleteContentDialog<T>({
  target,
  onClose,
  endpoint,
  label,
  describe,
  onDeleted,
}: {
  // null = dialog tertutup. Dipegang pemanggil, bukan state internal: daftar
  // memuat ulang setelah hapus, dan target tidak boleh ikut hilang di tengah.
  target: { id: string; title: string; subtitle?: string } | null;
  onClose: () => void;
  // Tanpa trailing slash, mis. "/admin/education/modules". Footprint diambil
  // dari `${endpoint}/${id}/footprint`.
  endpoint: string;
  label: "materi" | "skenario";
  describe: (footprint: T) => Footprint;
  onDeleted: (title: string) => void;
}) {
  const [footprint, setFootprint] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const id = target?.id;

  // Reset saat target berganti dilakukan di render, bukan di effect: footprint
  // milik target sebelumnya tidak boleh sempat tampil sekali render di dialog
  // target baru — angkanya yang jadi dasar keputusan hapus, dan satu render
  // dengan angka orang lain sudah cukup untuk menyesatkan.
  const [shownFor, setShownFor] = useState(id);
  if (shownFor !== id) {
    setShownFor(id);
    setFootprint(null);
    setError("");
  }

  useEffect(() => {
    if (!id) return;
    let live = true;
    api<T>(`${endpoint}/${id}/footprint`).then(
      (f) => live && setFootprint(f),
      () => live && setError("Gagal menghitung data yang akan hilang."),
    );
    return () => {
      live = false;
    };
  }, [id, endpoint]);

  const d = footprint === null ? null : describe(footprint);
  const blocked = deleting || d === null;

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      await api(`${endpoint}/${target.id}`, { method: "DELETE" });
      onDeleted(target.title);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Gagal menghapus ${label}.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {label} ini permanen?</AlertDialogTitle>
          <AlertDialogDescription>
            Tindakan ini tidak bisa dibatalkan. Kalau yang kamu butuhkan cuma menyembunyikannya dari
            siswa, arsipkan saja — progres yang sudah tercatat tetap tersimpan dan kembali terhitung
            kalau {label} diterbitkan lagi.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="mt-space-sm flex flex-col gap-space-sm">
          <p className="t-body-sm text-text-primary wrap-break-word">
            <span className="t-label">{target?.title}</span>
            {target?.subtitle && <span className="text-text-muted"> ({target.subtitle})</span>}
          </p>

          {error ? (
            <p className="t-body-sm text-danger-rose">{error}</p>
          ) : d === null ? (
            <p className="t-body-sm text-text-muted">Menghitung data yang akan hilang…</p>
          ) : (
            d.body
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            disabled={blocked}
            onClick={(e) => {
              // Radix menutup dialog pada klik Action; penutupan diurus
              // confirmDelete supaya dialog tidak lenyap sebelum request selesai
              // dan pesan errornya masih bisa terbaca.
              e.preventDefault();
              confirmDelete();
            }}
          >
            {deleting ? "Menghapus…" : "Hapus permanen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
