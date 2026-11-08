import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: no session cookie → sign-in page. The API still
 * authenticates and authorizes every request; this just avoids flashing the
 * admin shell to signed-out visitors.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("__Host-sid") || request.cookies.has("sid");
  const { pathname, search } = request.nextUrl;
  if (!hasSession && pathname !== "/login") {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  // No "signed in → skip /login" redirect: the cookie may belong to a session
  // the API has ended (suspension, sign-out elsewhere), which would loop.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
