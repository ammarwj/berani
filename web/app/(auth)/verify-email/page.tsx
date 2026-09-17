"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Alert, AuthShell, AuthHero, AuthCard } from "@/components/ui";

function Verify() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");

  useEffect(() => {
    if (!token) {
      setState("fail");
      return;
    }
    api("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => setState("ok"))
      .catch(() => setState("fail"));
  }, [token]);

  return (
    <AuthShell>
      <AuthHero
        icon="mark_email_read"
        title="Verifikasi email"
        subtitle="Kami mengonfirmasi tautan verifikasi dari emailmu."
      />

      <AuthCard>
        <div className="flex flex-col gap-space-md text-center">
          {state === "loading" && <p className="t-body text-text-muted">Memverifikasi…</p>}
          {state === "ok" && <Alert kind="success">Email kamu berhasil diverifikasi.</Alert>}
          {state === "fail" && (
            <Alert kind="error">Tautan verifikasi tidak valid atau sudah kedaluwarsa.</Alert>
          )}
          <Link href="/edukasi" className="t-label text-primary underline underline-offset-2">
            Lanjut ke aplikasi
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthShell><div className="h-64" /></AuthShell>}>
      <Verify />
    </Suspense>
  );
}
