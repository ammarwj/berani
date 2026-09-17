"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Field, Alert, inputClass, AuthShell, AuthHero, AuthCard, AuthButton } from "@/components/ui";
import Icon from "@/components/Icon";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    // The API always answers 204 so this page cannot reveal which emails have
    // accounts; show the same message either way.
    await api("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setSent(true);
    setLoading(false);
  }

  return (
    <AuthShell>
      <AuthHero
        icon="lock_reset"
        title="Lupa kata sandi?"
        subtitle="Masukkan email sekolahmu, kami kirimkan tautan untuk mengatur ulang."
      />

      <AuthCard>
        {sent ? (
          <Alert kind="success">
            Kalau email itu terdaftar, kami sudah mengirim tautan untuk mengatur ulang
            password. Periksa kotak masukmu.
          </Alert>
        ) : (
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
            <AuthButton disabled={loading}>
              {loading ? "Mengirim…" : "Kirim tautan"}
              <Icon name="arrow_forward" className="text-[20px]" />
            </AuthButton>
          </form>
        )}
      </AuthCard>

      <Link href="/login" className="flex items-center justify-center gap-1 t-label-md text-primary text-center">
        <Icon name="arrow_back" className="text-[16px]" />
        Kembali ke halaman masuk
      </Link>
    </AuthShell>
  );
}
