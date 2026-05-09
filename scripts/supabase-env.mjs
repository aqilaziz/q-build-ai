import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_SUPABASE_PROJECT_REF = "ksemrhvevevyjxgdsznw";

loadEnvFile(".env.local");
loadEnvFile(".env");

function loadEnvFile(fileName) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

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
