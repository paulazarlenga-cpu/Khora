const DEFAULT_ALLOWED_EMAIL = "paulazarlenga@gmail.com";

export function hasSupabasePublicConfiguration(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabasePublicConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  return { url, publishableKey };
}

export function isAllowedKhoraEmail(email: string | null | undefined): boolean {
  const allowedEmail = (
    process.env.KHORA_ALLOWED_EMAIL ?? DEFAULT_ALLOWED_EMAIL
  ).toLowerCase();

  return email?.trim().toLowerCase() === allowedEmail;
}
