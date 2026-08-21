import type { User } from "@supabase/supabase-js";
import { hasSupabasePublicConfiguration, isAllowedKhoraEmail } from "./config";
import { createClient } from "./server";

export async function getKhoraUser(): Promise<User | null> {
  if (!hasSupabasePublicConfiguration()) return null;

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !isAllowedKhoraEmail(user.email)) return null;
  return user;
}
