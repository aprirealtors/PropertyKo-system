import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";
  const mainDomain = process.env.NODE_ENV === "production" ? "propertyko.com" : "localhost:3000";

  // BYPASS RULE: Let the global login and superadmin pages load normally (Works on subdomains too)
  if (url.pathname.startsWith('/login') || url.pathname.startsWith('/dashboard/superadmin')) {
    return NextResponse.next();
  }

  // Ignore requests hitting the main domain directly
  if (hostname === mainDomain || hostname === `www.${mainDomain}`) {
    return NextResponse.next();
  }

  // Extract the subdomain
  const subdomain = hostname.replace(`.${mainDomain}`, "");

  if (subdomain) {
    // REDIRECT RULE: If they just type the naked subdomain (causing the 404), send them to /login
    if (url.pathname === '/') {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Rewrite all other subdomain traffic into the [subdomain] folder
    return NextResponse.rewrite(new URL(`/${subdomain}${url.pathname}`, req.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    // ✨ KEEP THIS FIX: Ensures PWA manifest and images work on subdomains
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};