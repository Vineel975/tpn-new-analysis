import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware runs at the Vercel Edge before any Next.js processing.
// It removes X-Frame-Options and sets frame-ancestors to allow all origins.
// This is needed because Vercel's infrastructure adds X-Frame-Options: SAMEORIGIN
// automatically for Next.js apps, which cannot be overridden by next.config.ts
// or vercel.json headers alone.

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Remove X-Frame-Options entirely — it conflicts with CSP frame-ancestors
  // in modern browsers and Vercel adds it automatically
  response.headers.delete('X-Frame-Options');

  // Allow embedding from any origin
  // Restrict to specific origin in production if needed:
  // response.headers.set('Content-Security-Policy', "frame-ancestors 'self' https://your-spectra.com");
  response.headers.set('Content-Security-Policy', "frame-ancestors *");

  return response;
}

// Only run this middleware on /job/* routes
export const config = {
  matcher: '/job/:path*',
};