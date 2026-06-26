import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

// Use service role key — our only auth is LINE user ID
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── User helpers ────────────────────────────────────────────────────────────

export async function getOrCreateUser(lineUserId: string, displayName?: string) {
  // Try to get existing user
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("line_user_id", lineUserId)
    .single();

  if (existing) return existing;

  // Create new user
  const { data, error } = await supabase
    .from("users")
    .insert({ line_user_id: lineUserId, display_name: displayName ?? "คุณ" })
    .select()
    .single();

  if (error) throw error;
  return data;
}
