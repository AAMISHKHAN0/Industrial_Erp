import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isLoginPage = pathname.startsWith("/login");
  const isAuthPage =
    isLoginPage ||
    pathname.startsWith("/forgot-password") ||
    pathname === "/";
  const isSetupPage = pathname.startsWith("/setup");
  const isApiAuth = pathname.startsWith("/auth/") || pathname.startsWith("/api/");

  const hasSessionExpiredError = searchParams.get("error") === "session_expired";
  if (isLoginPage && hasSessionExpiredError) {
    const response = NextResponse.next({ request: { headers: request.headers } });
    response.cookies.delete("session_token");
    response.cookies.delete("session");
    return response;
  }

  const sessionToken = request.cookies.get("session_token")?.value?.trim();
  const isAuthenticated = Boolean(sessionToken);

  if (isAuthenticated) {
    if (isAuthPage && pathname !== "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next({ request: { headers: request.headers } });
  }

  if (isSetupPage || isAuthPage || isApiAuth) {
    return NextResponse.next({ request: { headers: request.headers } });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
