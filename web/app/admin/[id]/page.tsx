"use client";

import { use, useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { api, isAdmin } from "@/lib/api";
import {
  PageHeader,
  Card,
  Button,
  Field,
  Alert,
  Empty,
  StatusBadge,
  UrgencyBadge,
  inputClass,
} from "@/components/ui";
import Icon from "@/components/Icon";
import AttachmentViewer, { type Attachment } from "@/components/AttachmentViewer";

type Detail = {
  id: string;
  category: string;
  description: string;
  location: string;
  involved: string;
  urgency: string;
  status: string;
  created_at: string;
  is_anonymous: boolean;
  reporter_name: string;
  reporter_email: string;
  ticket_code: string;
  attachments: Attachment[];
  notes: { note: string; status_after: string; created_at: string }[];
};

const STATUSES = ["diterima", "diproses", "ditindaklanjuti", "selesai"];

export default function AdminDetailPage({ params }: PageProps<"/admin/[id]">) {
  const { id } = use(params);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [report, setReport] = useState<Detail | null>(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<Detail>(`/admin/reports/${id}`)
      .then((d) => {
        setReport(d);
        setStatus(d.status);
      })
      .catch(() => setError("Laporan tidak ditemukan."));
  }, [id]);

  useEffect(() => {
    const ok = isAdmin();
    setAllowed(ok);
    if (ok) load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api(`/admin/reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, note }),
      });
      setNote("");
      setSaved(true);
      load();
    } catch {
      setError("Gagal memperbarui laporan.");
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
  if (!report) {
    return (
      <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
        {error ? <Alert kind="error">{error}</Alert> : <Empty>Memuat…</Empty>}
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-margin pt-22 pb-28">
      <Link href="/admin" className="flex items-center gap-1 text-sm text-primary w-fit">
        <Icon name="arrow_back" className="text-[16px]" />
        Semua laporan
      </Link>
      <div className="mt-3">
        <PageHeader icon="security" title="Detail Laporan" />
      </div>

      <Card className="mb-5">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <UrgencyBadge urgency={report.urgency} />
          <StatusBadge status={report.status} />
          <span className="text-xs text-text-text-muted">
            {report.category}
          </span>
          {report.is_anonymous && (
            <span className="text-xs text-text-muted bg-surface-container-low px-2 py-0.5 rounded-full">
              mode anonim
            </span>
          )}
        </div>

        {report.is_anonymous && (
          <p className="text-sm text-text-muted bg-surface-container-low rounded-xl px-3 py-2.5 mb-3">
            Siswa ini memilih mode anonim: namanya disembunyikan dari siswa
            lain.
          </p>
        )}

        <p className="whitespace-pre-line wrap-break-word">
          {report.description}
        </p>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm mt-4 text-text-muted">
          {report.location && (
            <>
              <dt className="font-medium">Lokasi</dt>
              <dd>{report.location}</dd>
            </>
          )}
          {report.involved && (
            <>
              <dt className="font-medium">Terlibat</dt>
              <dd>{report.involved}</dd>
            </>
          )}
          <dt className="font-medium">Pelapor</dt>
          <dd>
            {report.reporter_name || report.reporter_email ? (
              <>
                {report.reporter_name || "Tanpa nama"}
                {report.reporter_email && (
                  <span className="block text-text-muted">
                    {report.reporter_email}
                  </span>
                )}
              </>
            ) : (
              // Laporan anonim lama: user_id-nya memang tidak pernah tersimpan.
              "Identitas tidak tersimpan"
            )}
          </dd>
          <dt className="font-medium">Tiket</dt>
          <dd className="t-label tracking-wider">{report.ticket_code}</dd>
          <dt className="font-medium">Masuk</dt>
          <dd>
            {new Date(report.created_at).toLocaleString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </dd>
        </dl>

        {report.attachments.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-1">Bukti</p>
            <AttachmentViewer attachments={report.attachments} />
          </div>
        )}
      </Card>

      <Card className="mb-5">
        <h2 className="text-sm font-semibold mb-3">Perbarui status</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Catatan tindak lanjut"
            hint="Tercatat untuk audit internal sekolah."
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              rows={3}
              placeholder="Misal: sudah dihubungi wali kelas."
            />
          </Field>
          {error && <Alert kind="error">{error}</Alert>}
          {saved && <Alert kind="success">Status laporan diperbarui.</Alert>}
          <Button disabled={saving} className="self-start">
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </form>
      </Card>

      <h2 className="text-sm font-semibold mb-2">Riwayat penanganan</h2>
      {report.notes.length === 0 ? (
        <Empty>Belum ada catatan.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {report.notes.map((n, i) => (
            <li key={i}>
              <Card>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <StatusBadge status={n.status_after} />
                  <span className="text-xs text-text-text-muted">
                    {new Date(n.created_at).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {n.note && (
                  <p className="text-sm whitespace-pre-line">{n.note}</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
