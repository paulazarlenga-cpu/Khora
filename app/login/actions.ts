"use server";

import { redirect } from "next/navigation";
import { isAllowedKhoraEmail } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Completá+el+email+y+la+contraseña");
  }

  if (!isAllowedKhoraEmail(email)) {
    redirect("/login?error=Esta+cuenta+no+tiene+acceso+a+KHORA");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=El+email+o+la+contraseña+no+son+correctos");
  }

  redirect("/");
}
