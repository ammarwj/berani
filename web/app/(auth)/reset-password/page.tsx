"use client";

import { Suspense, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Alert, AuthShell, AuthHero, AuthCard, AuthButton, PasswordField } from "@/components/ui";
import Icon from "@/components/Icon";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthHero
        icon="key"
        title="Atur ulang kata sandi"
        subtitle="Buat kata sandi baru untuk masuk kembali ke akunmu."
      />

      <AuthCard>
        {done ? (
          <Alert kind="success">Password berhasil diubah. Mengarahkan ke halaman masuk…</Alert>
        ) : !token ? (
          <Alert kind="error">
            Tautan tidak lengkap. Buka tautan dari emailmu, atau{" "}
            <Link href="/forgot-password" className="underline font-semibold">
              minta tautan baru
            </Link>
            .
          </Alert>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-space-md">
            <PasswordField
              label="Kata sandi baru"
              hint="Minimal 8 karakter."
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={setPassword}
            />
            <PasswordField
              label="Ulangi kata sandi baru"
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
            />
            {error && <Alert kind="error">{error}</Alert>}
            <AuthButton disabled={loading}>
              {loading ? "Menyimpan…" : "Simpan kata sandi"}
              <Icon name="arrow_forward" className="text-[20px]" />
            </AuthButton>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell><div className="h-64" /></AuthShell>}>
      <ResetForm />
    </Suspense>
  );
}
