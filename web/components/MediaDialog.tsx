"use client";

import { useState, type ChangeEvent } from "react";
import { api, API_URL } from "@/lib/api";
import { youtubeId } from "@/lib/markdown";
import Icon from "@/components/Icon";
import { inputClass } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Satu dialog untuk tiga jenis media, dipakai editor materi dan editor
// skenario. Kalau tiap pemanggil punya salinan sendiri, batas ukuran dan daftar
// tipe file akan menyimpang diam-diam dari yang ditegakkan server
// (api/internal/education/upload.go).

export type MediaKind = "image" | "video" | "youtube";

export type PickedMedia = { src: string; kind: MediaKind; alt?: string };

// Harus cocok dengan allowedImageTypes/allowedVideoTypes di server. Lebih
// longgar di sini berarti guru menunggu unggahan selesai hanya untuk ditolak.
const IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";
const VIDEO_TYPES = "video/mp4,video/webm,video/quicktime";

const btn = "min-h-9 min-w-9 px-2.5 rounded-lg border t-label-md transition disabled:opacity-40";
const off = "border-border-subtle bg-surface-card text-text-primary hover:border-primary-container";
const on = "border-primary-container bg-ocean-subtle text-primary-container";

const TABS: { kind: MediaKind; label: string; icon: string }[] = [
  { kind: "image", label: "Gambar", icon: "add_photo_alternate" },
  { kind: "video", label: "Video", icon: "videocam" },
  { kind: "youtube", label: "YouTube", icon: "smart_display" },
];

export default function MediaDialog({
  open,
  onOpenChange,
  onPick,
  kinds = ["image", "video", "youtube"],
  withAlt = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (media: PickedMedia) => void;
  kinds?: MediaKind[];
  withAlt?: boolean;
}) {
  const [kind, setKind] = useState<MediaKind>(kinds[0]);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const tabs = TABS.filter((t) => kinds.includes(t.kind));

  function switchKind(next: MediaKind) {
    // URL gambar bukan URL video; menyisakannya saat pindah tab membuat guru
    // bisa menyisipkan MP4 sebagai <img> yang tidak pernah tampil.
    setKind(next);
    setUrl("");
    setError("");
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<{ path: string }>(
        kind === "video" ? "/admin/education/uploads/video" : "/admin/education/uploads",
        { method: "POST", body: form },
      );
      setUrl(`${API_URL}${res.path}`);
    } catch (err) {
      // Pesan server disampaikan apa adanya: "file terlalu besar (maks 50 MB)"
      // memberi tahu guru apa yang harus dilakukan, "gagal" tidak.
      setError(err instanceof Error && err.message ? err.message : "Gagal mengunggah. Coba lagi.");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (!url) return;
    if (kind === "youtube") {
      const id = youtubeId(url);
      if (!id) {
        setError("Tautan tidak dikenali. Contoh: https://www.youtube.com/watch?v=…");
        return;
      }
      onPick({ src: `https://www.youtube.com/watch?v=${id}`, kind });
    } else {
      onPick({ src: url, kind, alt: alt.trim() || undefined });
    }
    setUrl("");
    setAlt("");
    setError("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sisipkan media</DialogTitle>
          <DialogDescription>
            Unggah dari perangkat, tempel alamat, atau pasang video YouTube.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-space-sm mt-space-sm">
          {tabs.length > 1 && (
            <div className="flex items-center gap-1.5" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.kind}
                  type="button"
                  role="tab"
                  aria-selected={kind === t.kind}
                  onClick={() => switchKind(t.kind)}
                  className={`${btn} ${kind === t.kind ? on : off} inline-flex items-center gap-space-xs`}
                >
                  <Icon name={t.icon} className="text-[18px]" />
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {url && kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element -- pratinjau URL apa saja, bukan aset lokal
            <img
              src={url}
              alt=""
              className="rounded-xl max-h-40 w-full object-cover border border-border-subtle"
            />
          )}
          {url && kind === "video" && (
            <video
              src={url}
              controls
              playsInline
              preload="metadata"
              className="rounded-xl max-h-40 w-full bg-black border border-border-subtle"
            />
          )}

          {kind !== "youtube" && (
            <>
              <label
                className={`${btn} ${off} flex items-center justify-center gap-space-xs cursor-pointer`}
              >
                <Icon name={kind === "video" ? "videocam" : "add_photo_alternate"} className="text-[18px]" />
                {uploading ? "Mengunggah…" : "Unggah dari perangkat"}
                <input
                  type="file"
                  accept={kind === "video" ? VIDEO_TYPES : IMAGE_TYPES}
                  className="hidden"
                  disabled={uploading}
                  onChange={onPickFile}
                />
              </label>
              <p className="t-label-sm text-text-muted text-center">
                {kind === "video"
                  ? "MP4, WEBM, atau MOV — maks 50 MB."
                  : "JPG, PNG, WEBP, atau GIF — maks 5 MB."}
              </p>

              <div className="flex items-center gap-space-xs t-label-sm text-text-muted">
                <span className="flex-1 h-px bg-border-subtle" />
                atau tempel alamat
                <span className="flex-1 h-px bg-border-subtle" />
              </div>
            </>
          )}

          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              kind === "youtube" ? "https://www.youtube.com/watch?v=…" : "https://…"
            }
            className={inputClass}
          />

          {withAlt && kind === "image" && (
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Teks alternatif (untuk pembaca layar)"
              className={inputClass}
            />
          )}

          {error && <p className="t-body-sm text-danger-rose">{error}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            disabled={!url || uploading}
            onClick={submit}
            className="min-h-11 rounded-xl px-space-md t-label bg-primary-container text-white disabled:opacity-50 transition"
          >
            Sisipkan
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
