import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host") || "";
  const isProd = process.env.NODE_ENV === "production";
  const mainDomain = isProd ? "propertyko.com" : "localhost:3000";
  const protocol = isProd ? "https://" : "http://";

  // Extract the subdomain (if it exists)
  let subdomain = "";
  if (hostname !== mainDomain && hostname !== `www.${mainDomain}`) {
    subdomain = hostname.replace(`.${mainDomain}`, "");
  }

  // ✨ NEW FIX: Prevent login and superadmin routes from being accessed on subdomains
  if (subdomain) {
    if (url.pathname.startsWith('/login') || url.pathname.startsWith('/dashboard/superadmin')) {
      // Force redirect to the main domain
      return NextResponse.redirect(new URL(url.pathname, `${protocol}${mainDomain}`));
    }
  }

  // BYPASS RULE: Let the global login and superadmin pages load normally ON THE MAIN DOMAIN
  if (url.pathname.startsWith('/login') || url.pathname.startsWith('/dashboard/superadmin')) {
    return NextResponse.next();
  }

  // Ignore requests hitting the main domain directly
  if (hostname === mainDomain || hostname === `www.${mainDomain}`) {
    return NextResponse.next();
  }

  if (subdomain) {
    // REDIRECT RULE: If they just type the naked subdomain (causing the 404), send them to main login
    // Note: We send them to the main domain login because we just banned /login on subdomains above
    if (url.pathname === '/') {
       return NextResponse.redirect(new URL('/login', `${protocol}${mainDomain}`));
    }

    // Rewrite all other subdomain traffic into the [subdomain] folder
    return NextResponse.rewrite(new URL(`/${subdomain}${url.pathname}`, req.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};