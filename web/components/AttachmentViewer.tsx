"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Icon from "@/components/Icon";

export type Attachment = {
  filename: string;
  url: string;
  content_type?: string;
};

// content_type lampiran lama bisa kosong (kolomnya nullable), jadi ekstensi
// nama file dipakai sebagai cadangan — kalau salah tebak, modal jatuh ke
// tombol "buka di tab baru", bukan pratinjau kosong.
function kindOf(a: Attachment): "image" | "pdf" | "other" {
  const ct = (a.content_type || "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct === "application/pdf") return "pdf";
  const ext = a.filename.toLowerCase().split(".").pop() || "";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export default function AttachmentViewer({
  attachments,
}: {
  attachments: Attachment[];
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const active = attachments[index];
  const kind = active ? kindOf(active) : "other";

  return (
    <>
      <ul className="flex flex-col gap-1">
        {attachments.map((a, i) => (
          <li key={i} className="text-sm">
            {a.url ? (
              <button
                type="button"
                onClick={() => {
                  setIndex(i);
                  setOpen(true);
                }}
                className="flex items-center gap-1.5 text-primary text-left"
              >
                <Icon name="attachment" className="text-[16px]" />
                <span className="wrap-break-word">{a.filename}</span>
              </button>
            ) : (
              <span className="text-text-muted">
                {a.filename} (tautan tidak tersedia)
              </span>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="wrap-break-word">
              {active?.filename}
            </DialogTitle>
          </DialogHeader>

          {active && (
            <div className="mt-space-sm">
              {kind === "image" && (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL R2, bukan aset lokal
                <img
                  src={active.url}
                  alt={active.filename}
                  className="w-full max-h-[70vh] object-contain rounded-xl bg-surface-container-low"
                />
              )}
              {kind === "pdf" && (
                <iframe
                  src={active.url}
                  title={active.filename}
                  className="w-full h-[70vh] rounded-xl border border-border-subtle bg-surface-container-low"
                />
              )}
              {kind === "other" && (
                <p className="t-body text-text-muted">
                  Jenis berkas ini tidak bisa dipratinjau di sini.
                </p>
              )}

              <div className="flex items-center gap-space-sm mt-space-sm flex-wrap">
                {attachments.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Bukti sebelumnya"
                      disabled={index === 0}
                      onClick={() => setIndex((i) => i - 1)}
                      className="w-9 h-9 grid place-items-center rounded-lg border border-border-subtle text-text-muted disabled:opacity-40"
                    >
                      <Icon name="arrow_back" className="text-[18px]" />
                    </button>
                    <button
                      type="button"
                      aria-label="Bukti berikutnya"
                      disabled={index === attachments.length - 1}
                      onClick={() => setIndex((i) => i + 1)}
                      className="w-9 h-9 grid place-items-center rounded-lg border border-border-subtle text-text-muted disabled:opacity-40"
                    >
                      <Icon name="arrow_forward" className="text-[18px]" />
                    </button>
                    <span className="t-label-sm text-text-muted">
                      {index + 1} / {attachments.length}
                    </span>
                  </>
                )}
                <a
                  href={active.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary ml-auto"
                >
                  <Icon name="open_in_new" className="text-[16px]" />
                  Buka di tab baru
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
