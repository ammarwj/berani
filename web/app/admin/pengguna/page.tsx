"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { api, isSuperAdmin } from "@/lib/api";
import { PageHeader, Card, Button, Field, Alert, Empty, inputClass } from "@/components/ui";

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

  const load = useCallback(() => {
    setLoading(true);
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
    <main className="flex-1 max-w-3xl mx-auto w-full px-margin pt-22 pb-28">
      <PageHeader
        icon="manage_accounts"
        title="Pengguna"
        subtitle="Akun dinonaktifkan, tidak dihapus — refleksi, progres belajar, dan catatan tindak lanjut tetap utuh."
      />

      <div className="flex gap-2 mb-3">
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

      <Button
        type="button"
        variant="outline"
        className="mb-5"
        onClick={() => setShowForm((v) => !v)}
        aria-expanded={showForm}
      >
        {showForm ? "Batal" : "Buat akun baru"}
      </Button>

      {showForm && (
        <Card className="mb-5">
          <form onSubmit={createUser} className="flex flex-col gap-3">
            <Field label="Email">
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Nama">
              <input
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
            <Field
              label="Password awal"
              hint="Minimal 8 karakter. Sampaikan langsung ke pemiliknya, lalu minta dia menggantinya."
            >
              <input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Button disabled={saving} className="self-start">
              {saving ? "Menyimpan…" : "Buat akun"}
            </Button>
          </form>
        </Card>
      )}

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
          {users.map((u) => {
            const self = u.email === meEmail;
            return (
            <li key={u.id}>
              <Card className={u.is_active ? "" : "opacity-60"}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
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
                <p className="t-label text-text-primary">{u.name || u.email}</p>
                {u.name && <p className="text-xs text-text-muted">{u.email}</p>}

                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <select
                    value={u.role}
                    disabled={self}
                    onChange={(e) => act(u, { role: e.target.value }, "Role diperbarui.")}
                    className={`${inputClass} w-auto disabled:opacity-60`}
                    aria-label={`Role untuk ${u.email}`}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" onClick={() => resetPassword(u)}>
                    Kirim reset password
                  </Button>
                  {!self && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (u.is_active && !confirm(`Nonaktifkan akun ${u.email}? Dia tidak akan bisa masuk lagi.`))
                          return;
                        act(
                          u,
                          { is_active: !u.is_active },
                          u.is_active ? "Akun dinonaktifkan." : "Akun diaktifkan kembali.",
                        );
                      }}
                    >
                      {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  )}
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
    </main>
  );
}
