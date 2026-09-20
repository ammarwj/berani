"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { api, isSuperAdmin } from "@/lib/api";
import { PageHeader, Card, Button, Field, Alert, Empty, inputClass } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import Icon from "@/components/Icon";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
};

const ROLES = [
  { value: "siswa", label: "Siswa" },
  { value: "guru_admin", label: "Guru pendamping" },
  { value: "super_admin", label: "Super admin" },
];

const PAGE_SIZE = 10;

export default function PenggunaPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [meEmail, setMeEmail] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ email: "", name: "", role: "siswa", password: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setPage(1);
    const p = new URLSearchParams();
    if (role) p.set("role", role);
    if (q) p.set("q", q);
    api<User[]>(`/admin/users?${p}`)
      .then(setUsers)
      .catch(() => setError("Gagal memuat daftar pengguna."))
      .finally(() => setLoading(false));
  }, [role, q]);

  useEffect(() => {
    const ok = isSuperAdmin();
    setAllowed(ok);
    if (!ok) return;
    load();
    // Dipakai untuk mengenali baris sendiri: server menolak super admin yang
    // menurunkan atau menonaktifkan akunnya sendiri, jadi aksinya jangan ditawarkan.
    api<{ email: string }>("/auth/me")
      .then((me) => setMeEmail(me.email))
      .catch(() => {});
  }, [load]);

  async function act(u: User, body: object, message: string) {
    setError("");
    setNotice("");
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setNotice(message);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui pengguna.");
    }
  }

  function startEditName(u: User) {
    setEditingId(u.id);
    setNameDraft(u.name);
    setError("");
    setNotice("");
  }

  async function saveName(u: User) {
    const name = nameDraft.trim();
    if (!name || name === u.name) {
      setEditingId(null);
      return;
    }
    setSavingName(true);
    setError("");
    setNotice("");
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setNotice("Nama diperbarui.");
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui nama.");
    } finally {
      setSavingName(false);
    }
  }

  async function resetPassword(u: User) {
    setError("");
    setNotice("");
    try {
      await api(`/admin/users/${u.id}/reset-password`, { method: "POST" });
      setNotice(`Tautan atur ulang password dikirim ke ${u.email}.`);
    } catch {
      setError("Gagal mengirim tautan reset.");
    }
  }

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api("/admin/users", { method: "POST", body: JSON.stringify(draft) });
      setDraft({ email: "", name: "", role: "siswa", password: "" });
      setShowForm(false);
      setNotice("Akun dibuat.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat akun.");
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const paged = users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (allowed === false) {
    return (
      <main className="flex-1 max-w-3xl mx-auto w-full px-margin pt-22 pb-28">
        <PageHeader icon="manage_accounts" title="Pengguna" />
        <Alert kind="error">
          Halaman ini hanya untuk super admin.{" "}
          <Link href="/login" className="underline font-semibold">
            Masuk sebagai admin
          </Link>
        </Alert>
      </main>
    );
  }

  return (
    <Dialog open={showForm} onOpenChange={setShowForm}>
      <main className="flex-1 max-w-3xl mx-auto w-full px-margin pt-22 pb-28">
        <PageHeader
          icon="manage_accounts"
          title="Pengguna"
          subtitle="Akun dinonaktifkan, tidak dihapus — refleksi, progres belajar, dan catatan tindak lanjut tetap utuh."
          action={
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="inline-flex items-center gap-1.5">
                <Icon name="person_add" className="text-[18px]" />
                Buat akun baru
              </Button>
            </DialogTrigger>
          }
        />

        <div className="flex gap-2 mb-5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputClass}
            placeholder="Cari nama atau email"
            aria-label="Cari pengguna"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputClass}
            aria-label="Filter role"
          >
            <option value="">Semua role</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat akun baru</DialogTitle>
            <DialogDescription>
              Sampaikan password awal langsung ke pemiliknya, lalu minta dia menggantinya.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createUser} className="flex flex-col gap-3 mt-3">
            <Field label="Email">
              <input
                type="email"
                required
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Nama">
              <input
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Role">
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                className={inputClass}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Password awal" hint="Minimal 8 karakter.">
              <input
                type="password"
                required
                minLength={8}
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Button disabled={saving} className="mt-1">
              {saving ? "Menyimpan…" : "Buat akun"}
            </Button>
          </form>
        </DialogContent>

        {error && (
          <div className="mb-3">
            <Alert kind="error">{error}</Alert>
          </div>
        )}
        {notice && (
          <div className="mb-3">
            <Alert kind="success">{notice}</Alert>
          </div>
        )}

        {loading ? (
          <Empty>Memuat pengguna…</Empty>
        ) : users.length === 0 ? (
          <Empty>Tidak ada pengguna yang cocok.</Empty>
        ) : (
          <ul className="flex flex-col gap-3">
            {paged.map((u) => {
              const self = u.email === meEmail;
              return (
              <li key={u.id}>
                <Card className={u.is_active ? "" : "opacity-60"}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Identitas: lebar penuh di mobile, menyusut duluan di desktop
                        supaya cluster aksi di kanan tidak pernah terdorong turun. */}
                    <div className="min-w-0 sm:flex-1">
                      {(self || !u.is_active || !u.email_verified) && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {self && (
                            <span className="t-label-sm uppercase px-2.5 py-1 rounded-full bg-ocean-subtle text-primary-container">
                              akunmu
                            </span>
                          )}
                          {!u.is_active && (
                            <span className="t-label-sm uppercase px-2.5 py-1 rounded-full bg-surface-container-low text-text-muted">
                              nonaktif
                            </span>
                          )}
                          {!u.email_verified && (
                            <span className="t-label-sm uppercase px-2.5 py-1 rounded-full bg-amber-subtle text-tertiary">
                              belum verifikasi
                            </span>
                          )}
                        </div>
                      )}

                      {editingId === u.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveName(u);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className={`${inputClass} min-h-9 py-1.5 max-w-56`}
                            aria-label={`Nama untuk ${u.email}`}
                            placeholder="Tanpa nama"
                          />
                          <button
                            type="button"
                            aria-label="Simpan nama"
                            disabled={savingName}
                            onClick={() => saveName(u)}
                            className="w-9 h-9 shrink-0 grid place-items-center rounded-lg text-secondary hover:bg-mint-subtle disabled:opacity-50"
                          >
                            <Icon name="check" className="text-[20px]" />
                          </button>
                          <button
                            type="button"
                            aria-label="Batal ubah nama"
                            disabled={savingName}
                            onClick={() => setEditingId(null)}
                            className="w-9 h-9 shrink-0 grid place-items-center rounded-lg text-text-muted hover:bg-surface-container-low disabled:opacity-50"
                          >
                            <Icon name="close" className="text-[20px]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditName(u)}
                          className="group flex items-center gap-1.5 -ml-1 px-1 py-0.5 rounded-lg hover:bg-surface-container-low max-w-full"
                        >
                          <span className="t-label text-text-primary truncate">{u.name || "Tanpa nama"}</span>
                          <Icon
                            name="edit_note"
                            className="text-[16px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          />
                        </button>
                      )}
                      <p className="t-body-sm text-text-muted truncate">{u.email}</p>
                    </div>

                    {/* Aksi: cluster tetap, rata kanan di desktop, penuh & rata kiri
                        di mobile — tidak lagi ikut melebar bareng teks identitas. */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={u.role}
                        disabled={self}
                        onChange={(e) => act(u, { role: e.target.value }, "Role diperbarui.")}
                        className={`${inputClass} min-h-9 py-1.5 w-auto disabled:opacity-60`}
                        aria-label={`Role untuk ${u.email}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        title="Kirim reset password"
                        aria-label={`Kirim reset password untuk ${u.email}`}
                        onClick={() => resetPassword(u)}
                        className="w-9 h-9 shrink-0 grid place-items-center rounded-lg text-text-muted hover:bg-ocean-subtle hover:text-primary-container transition"
                      >
                        <Icon name="lock_reset" className="text-[20px]" />
                      </button>
                      {!self && u.is_active && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              title="Nonaktifkan akun"
                              aria-label={`Nonaktifkan akun ${u.email}`}
                              className="w-9 h-9 shrink-0 grid place-items-center rounded-lg text-text-muted hover:bg-danger-subtle hover:text-danger-rose transition"
                            >
                              <Icon name="group_off" className="text-[20px]" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Nonaktifkan akun ini?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {u.email} tidak akan bisa masuk lagi. Bisa diaktifkan kembali kapan saja.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => act(u, { is_active: false }, "Akun dinonaktifkan.")}
                              >
                                Nonaktifkan
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {!self && !u.is_active && (
                        <button
                          type="button"
                          title="Aktifkan akun"
                          aria-label={`Aktifkan akun ${u.email}`}
                          onClick={() => act(u, { is_active: true }, "Akun diaktifkan kembali.")}
                          className="w-9 h-9 shrink-0 grid place-items-center rounded-lg text-text-muted hover:bg-mint-subtle hover:text-secondary transition"
                        >
                          <Icon name="verified_user" className="text-[20px]" />
                        </button>
                      )}
                    </div>
                  </div>
                  {self && (
                    <p className="t-label-md text-text-muted mt-2">
                      Role dan status akunmu sendiri tidak bisa diubah dari sini — minta super admin lain.
                    </p>
                  )}
                </Card>
              </li>
              );
            })}
          </ul>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between gap-space-sm mt-space-md">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 t-label-md text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon name="arrow_back" className="text-[16px]" />
              Sebelumnya
            </button>
            <span className="t-body-sm text-text-muted">
              Halaman {page} dari {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 t-label-md text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Berikutnya
              <Icon name="arrow_forward" className="text-[16px]" />
            </button>
          </div>
        )}
      </main>
    </Dialog>
  );
}
