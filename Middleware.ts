import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Runs at Vercel Edge before any Next.js processing.
// Removes X-Frame-Options (Vercel adds SAMEORIGIN automatically for Next.js apps)
// and sets CSP frame-ancestors to allow any origin to embed /job/* pages.
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.delete('X-Frame-Options');
  response.headers.set('Content-Security-Policy', "frame-ancestors *");
  return response;
}

export const config = {
  matcher: '/job/:path*',
};