export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type Session = { access_token: string; refresh_token: string; role: string };

export function saveSession(s: Session) {
  localStorage.setItem("access_token", s.access_token);
  localStorage.setItem("refresh_token", s.refresh_token);
  localStorage.setItem("role", s.role);
}

export function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("role");
}

export function getRole(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem("role");
}

// Materi & skenario: guru dan admin sama-sama penuh. Hanya pengaturan app dan
// management user yang super admin.
export const isAdmin = (r = getRole()) => r === "guru_admin" || r === "super_admin";
export const isSuperAdmin = (r = getRole()) => r === "super_admin";

export function isLoggedIn(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem("access_token");
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit, retry: boolean): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const isForm = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      // Let the browser set the multipart boundary itself.
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Access tokens live 15 minutes; swap in a fresh one and replay once rather
  // than bouncing the user to the login screen mid-task.
  if (res.status === 401 && retry && (await refresh())) {
    return request<T>(path, options, false);
  }

  if (!res.ok) {
    throw new ApiError(res.status, (await res.text()).trim() || "Terjadi kesalahan.");
  }
  // 201 dari handler yang hanya memanggil WriteHeader (POST /reflections,
  // /reports/{ticket}/attachments) berbadan kosong — res.json() melempar
  // SyntaxError di sana, dan pemanggilnya menampilkannya sebagai kegagalan
  // padahal datanya sudah tersimpan. Panjang badan yang menentukan, bukan status.
  const body = await res.text();
  if (!body) return undefined as T;
  return JSON.parse(body) as T;
}

export function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, options, true);
}

async function refresh(): Promise<boolean> {
  const refresh_token =
    typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
  if (!refresh_token) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) {
    clearSession();
    return false;
  }
  saveSession(await res.json());
  return true;
}
