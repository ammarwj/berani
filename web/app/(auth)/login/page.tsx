"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, saveSession, Session } from "@/lib/api";
import { Field, Alert, inputClass, AuthShell, AuthHero, AuthCard, AuthButton, PasswordField } from "@/components/ui";
import Icon from "@/components/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await api<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveSession(session);
      router.push(session.role === "siswa" ? "/" : "/admin");
    } catch {
      setError("Email atau password salah.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthHero
        logo
        title="Selamat datang di BERANI"
        subtitle="Masuk ke ruang aman belajarmu, atau tindak lanjuti laporan bersama kami."
      />

      <AuthCard>
        <form onSubmit={onSubmit} className="flex flex-col gap-space-md">
          <Field label="Email sekolah">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="nama@sekolah.sch.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>

          <PasswordField
            label="Kata sandi"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />

          {error && <Alert kind="error">{error}</Alert>}

          <AuthButton disabled={loading}>
            {loading ? "Memproses…" : "Masuk ke aplikasi"}
            <Icon name="arrow_forward" className="text-[20px]" />
          </AuthButton>

          <Link href="/forgot-password" className="t-label-md text-primary text-center">
            Lupa kata sandi?
          </Link>
        </form>
      </AuthCard>

      <p className="t-body text-text-muted text-center">
        Belum punya akun?{" "}
        <Link href="/register" className="t-label text-primary underline underline-offset-2">
          Daftar
        </Link>
      </p>

      {/* Melacak tiket tidak butuh akun. */}
      <Link
        href="/lapor/status"
        className="min-h-12 rounded-xl border border-border-subtle bg-surface-card text-text-primary t-label inline-flex items-center justify-center gap-space-xs"
      >
        <Icon name="find_in_page" className="text-[20px] text-primary-container" />
        Lacak laporan dengan kode tiket
      </Link>
    </AuthShell>
  );
}
