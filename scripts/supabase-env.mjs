import { createClient } from "@supabase/supabase-js";

export const DEFAULT_SUPABASE_PROJECT_REF = "ksemrhvevevyjxgdsznw";

export function resolveSupabaseUrl() {
  const explicitUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, "");
  }

  const projectRef =
    process.env.SUPABASE_PROJECT_REF ??
    process.env.SUPABASE_PROJECT_ID ??
    DEFAULT_SUPABASE_PROJECT_REF;

  return `https://${projectRef}.supabase.co`;
}

export function getServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return key;
}

export function createServiceSupabaseClient() {
  return createClient(resolveSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
