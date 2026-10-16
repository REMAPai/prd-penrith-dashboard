import { NextResponse, type NextRequest } from "next/server";

const OPEN = [/^\/login(\/.*)?$/, /^\/maplibre\/[^/]+$/, /^\/api\/auth\/entra\/(login|callback)$/, /^\/api\/ingest\/[^/]+$/, /^\/_next\/.+$/, /^\/favicon\.ico$/];

const isOpenPath = (pathname: string) => OPEN.some((re) => re.test(pathname));

// Optimistic gate only: real authorization happens server-side in every page and action.
export function proxy(req: NextRequest) {
  if (isOpenPath(req.nextUrl.pathname)) return NextResponse.next();
  if (!req.cookies.get("prd_session")) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|svg|ico)$).*)"] };
