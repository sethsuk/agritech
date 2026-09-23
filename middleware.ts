import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session — required for SSR auth to work
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public paths (no auth required). startsWith, not includes — `includes` would treat
  // any path merely *containing* "/login" or "/auth" as public.
  const publicPaths = ["/login", "/auth"];
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic && !pathname.startsWith("/api")) {
    // Not logged in → send to worker login (default)
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
