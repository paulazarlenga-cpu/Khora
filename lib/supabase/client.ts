"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfiguration } from "./config";

export function createClient() {
  const { url, publishableKey } = getSupabasePublicConfiguration();
  return createBrowserClient(url, publishableKey);
}
