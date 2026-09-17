"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, saveSession, Session, ApiError } from "@/lib/api";
import { Field, Alert, inputClass, AuthShell, AuthHero, AuthCard, AuthButton, PasswordField } from "@/components/ui";
import Icon from "@/components/Icon";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const session = await api<Session>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      saveSession(session);
      router.push("/edukasi");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? "Email ini sudah terdaftar."
          : "Gagal mendaftar. Coba lagi."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthHero
        icon="person_add"
        title="Buat akun BERANI"
        subtitle="Daftar untuk mulai belajar dan melapor dengan aman."
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
            hint="Minimal 8 karakter."
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={setPassword}
          />

          {error && <Alert kind="error">{error}</Alert>}

          <AuthButton disabled={loading}>
            {loading ? "Memproses…" : "Daftar"}
            <Icon name="arrow_forward" className="text-[20px]" />
          </AuthButton>
        </form>
      </AuthCard>

      <p className="t-body text-text-muted text-center">
        Sudah punya akun?{" "}
        <Link href="/login" className="t-label text-primary underline underline-offset-2">
          Masuk
        </Link>
      </p>
    </AuthShell>
  );
}
