import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: real authorization happens server-side in every page and action.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open = pathname.startsWith("/login") || pathname.startsWith("/api/auth") || pathname.startsWith("/_next") || pathname.startsWith("/maplibre") || pathname === "/favicon.ico";
  if (open) return NextResponse.next();
  if (!req.cookies.get("prd_session")) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|svg|ico)$).*)"] };
