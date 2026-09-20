"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Icon from "@/components/Icon";

export function PageHeader({ icon, title, subtitle, action }: {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-space-lg">
      <div className="flex items-center justify-between gap-space-sm">
        <h1 className="t-headline-lg text-text-primary flex items-center gap-space-sm min-w-0">
          {icon && (
            <span className="w-10 h-10 rounded-xl bg-ocean-subtle text-primary-container grid place-items-center shrink-0">
              <Icon name={icon} className="text-[22px]" />
            </span>
          )}
          <span className="truncate">{title}</span>
        </h1>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {subtitle && (
        <p className="t-body text-text-muted mt-space-sm max-w-prose">{subtitle}</p>
      )}
    </header>
  );
}

export function Card({ children, className = "" }: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-border-subtle rounded-2xl p-space-md bg-surface-card e-card ${className}`}>
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }: {
  variant?: "primary" | "outline" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles =
    variant === "primary"
      ? "bg-primary-container text-white hover:bg-primary"
      : variant === "danger"
        ? "bg-danger-rose text-white hover:bg-danger-rose/90"
        : "border border-border-subtle bg-surface-card text-text-primary hover:border-primary-container";
  return (
    <button
      {...props}
      className={`t-label min-h-12 rounded-xl px-space-md py-3 transition disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-container/20 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-space-xs">
      <span className="t-label text-text-primary">{label}</span>
      {children}
      {hint && <span className="t-label-md text-text-muted">{hint}</span>}
    </label>
  );
}

// min-height 48px: target sentuh di DESIGN.md.
export const inputClass =
  "border border-border-subtle bg-surface-card rounded-xl px-3.5 min-h-12 py-3 w-full t-body text-text-primary placeholder:text-text-muted/70 focus:outline-none focus:ring-3 focus:ring-primary-container/20 focus:border-primary-container transition";

// Show/hide toggle dipakai di login, daftar, & atur-ulang kata sandi — satu
// komponen supaya perilakunya (dan a11y label-nya) konsisten di ketiganya.
export function PasswordField({
  label,
  hint,
  value,
  onChange,
  autoComplete,
  minLength,
  placeholder = "••••••••",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          aria-label={show ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 inset-y-0 my-auto w-9 h-9 grid place-items-center rounded-lg text-text-muted hover:text-primary-container"
        >
          <Icon name={show ? "visibility_off" : "visibility"} className="text-[20px]" />
        </button>
      </div>
    </Field>
  );
}

// Full-bleed shell untuk halaman auth berdiri sendiri (login/daftar/lupa
// sandi/dst) — lihat HIDE_SHELL di nav-routes.ts. max-w-md, bukan max-w-sm:
// di layar lebar kartu form terasa terlalu sempit.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 w-full pt-safe pb-safe relative overflow-hidden">
      <div aria-hidden className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-ocean-subtle/80 blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute -bottom-28 -right-16 w-64 h-64 rounded-full bg-mint-subtle/60 blur-3xl pointer-events-none" />
      <div className="relative z-10 max-w-md mx-auto w-full px-margin py-space-2xl flex flex-col gap-space-lg">
        {children}
      </div>
    </main>
  );
}

export function AuthHero({ icon, logo, title, subtitle }: {
  icon?: string;
  logo?: boolean;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-space-sm">
      {logo ? (
        <Image src="/icons/logo.svg" alt="" width={72} height={72} className="w-18 h-18" priority />
      ) : (
        <span className="w-16 h-16 rounded-2xl bg-ocean-subtle text-primary-container grid place-items-center">
          <Icon name={icon!} className="text-[30px]" />
        </span>
      )}
      <h1 className="t-headline-lg text-text-primary">{title}</h1>
      <p className="t-body text-text-muted max-w-[32ch]">{subtitle}</p>
    </div>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-space-lg sm:p-space-xl e-card">
      {children}
    </div>
  );
}

export function AuthButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-12 rounded-xl bg-primary text-white t-label inline-flex items-center justify-center gap-space-xs disabled:opacity-50 hover:opacity-90 transition-opacity e-float focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-container/20 ${className}`}
    >
      {children}
    </button>
  );
}

export function Alert({ kind, children }: {
  kind: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "bg-danger-subtle text-danger-rose border-danger-rose/20",
    success: "bg-mint-subtle text-secondary border-secondary/20",
    info: "bg-ocean-subtle text-primary border-primary-container/20",
  }[kind];
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`border rounded-xl px-3.5 py-3 t-body ${styles}`}>
      {children}
    </p>
  );
}

const STAT_TONES = {
  rose: "bg-danger-subtle border-danger-rose/30 text-danger-rose",
  amber: "bg-amber-subtle border-tertiary-container/30 text-tertiary",
  mint: "bg-mint-subtle border-secondary/30 text-secondary",
  ocean: "bg-ocean-subtle border-primary-container/30 text-primary",
};

export function StatTile({ icon, value, label, tone, href }: {
  icon: string;
  value: number | null;
  label: string;
  tone: keyof typeof STAT_TONES;
  href?: string;
}) {
  const content = (
    <>
      <p className="t-display text-text-primary">{value ?? "—"}</p>
      <p className="t-body-sm mt-space-xs inline-flex items-center gap-space-xs">
        <Icon name={icon} className="text-[16px]" />
        {label}
      </p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={`relative block rounded-2xl border p-space-md transition hover:brightness-95 ${STAT_TONES[tone]}`}
      >
        <Icon name="chevron_right" className="absolute top-space-sm right-space-sm text-[16px] opacity-60" />
        {content}
      </Link>
    );
  }
  return <div className={`rounded-2xl border p-space-md ${STAT_TONES[tone]}`}>{content}</div>;
}

// Rasio selesai/total sebagai bar, bukan cuma pecahan teks — progress adalah inti
// halaman ini, jadi harus kebaca sekilas tanpa hitung manual. total 0 (belum ada
// materi/skenario diterbitkan) digambar kosong, bukan dibagi nol.
export function ProgressBar({ value, total, tone }: {
  value: number;
  total: number;
  tone: "primary" | "secondary";
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const fill = tone === "primary" ? "bg-primary-container" : "bg-secondary";
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 rounded-full bg-surface-container-low overflow-hidden"
    >
      <div className={`h-full rounded-full ${fill} transition-[width]`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="t-body text-text-muted py-space-xl text-center max-w-prose mx-auto">{children}</p>;
}

export function LoginRequired({ what }: { what: string }) {
  return (
    <Card className="text-center">
      <p className="t-body text-text-muted mb-space-sm">Masuk dulu untuk {what}.</p>
      <Link href="/login" className="t-label text-primary-container underline underline-offset-2">
        Masuk ke akunmu
      </Link>
    </Card>
  );
}

const STATUS_STYLES: Record<string, string> = {
  diterima: "bg-surface-container-low text-text-muted",
  diproses: "bg-amber-subtle text-tertiary",
  ditindaklanjuti: "bg-ocean-subtle text-primary",
  selesai: "bg-mint-subtle text-secondary",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`t-label-sm uppercase px-2.5 py-1 rounded-full ${STATUS_STYLES[status] ?? "bg-surface-container-low text-text-muted"}`}>
      {status}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  // danger-rose hanya untuk eskalasi mendesak/sangat mendesak — lihat DESIGN.md.
  if (urgency === "sangat_mendesak") {
    return (
      <span className="t-label-sm uppercase px-2.5 py-1 rounded-full bg-danger-rose text-white">
        sangat mendesak
      </span>
    );
  }
  if (urgency === "mendesak") {
    return (
      <span className="t-label-sm uppercase px-2.5 py-1 rounded-full bg-danger-subtle text-danger-rose">
        mendesak
      </span>
    );
  }
  return null;
}
