import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabasePublicConfiguration,
  hasSupabasePublicConfiguration,
  isAllowedKhoraEmail,
} from "./config";

export async function updateSession(request: NextRequest) {
  if (!hasSupabasePublicConfiguration()) return NextResponse.next();

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicConfiguration();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname === "/login";
  const isStore = request.nextUrl.pathname === "/tienda" || request.nextUrl.pathname.startsWith("/tienda/") || request.nextUrl.pathname === "/api/tienda";
  const isAuthorized = Boolean(user && isAllowedKhoraEmail(user.email));

  if (!isAuthorized && !isLogin && !isStore) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthorized && isLogin) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

