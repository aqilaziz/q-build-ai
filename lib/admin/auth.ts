import { createServiceSupabaseClient } from "@/lib/supabase/service";

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "admin@gmail.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function requireAdmin(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    throw new AdminAuthError("Token admin tidak ditemukan.", 401);
  }

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new AdminAuthError("Session admin tidak valid.", 401);
  }

  const email = data.user.email?.toLowerCase();
  const role = data.user.app_metadata?.role;
  if (role !== "admin" && (!email || !adminEmails().includes(email))) {
    throw new AdminAuthError("Akun ini tidak punya akses admin.", 403);
  }

  return data.user;
}
