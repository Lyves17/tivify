import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware for route protection
 *
 * IMPORTANT: Token validation cannot be done reliably in middleware because:
 * 1. Middleware runs on the server, not in the client context
 * 2. The in-memory token store is client-side only
 * 3. We cannot access the token from middleware
 *
 * SOLUTION: Use the following pattern instead:
 * - Middleware performs basic path-based routing
 * - Client-side route guards in layout files check auth via AuthContext
 * - Protected pages redirect unauthenticated users to login
 *
 * Alternative (recommended for future):
 * - Store token in HttpOnly cookies (backend change)
 * - Middleware can read cookies and validate tokens
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // List of protected routes that require authentication
  const protectedRoutes = [
    '/admin',
    '/profile',
    '/favorites',
    '/history',
    '/settings',
  ]

  // List of auth routes (login/signup should redirect authenticated users to home)
  const authRoutes = ['/login']

  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  /**
   * LIMITATION: Token validation cannot be done reliably in middleware
   *
   * Current approach (client-side validation):
   * - Token is stored in-memory only (not in cookies)
   * - Middleware cannot access in-memory client-side storage
   * - AuthContext on client performs route protection on initial render
   * - Protected pages redirect unauthenticated users to login
   *
   * FUTURE IMPROVEMENT (requires backend coordination):
   * - Implement HttpOnly cookies (server sets token in cookie)
   * - Middleware reads token from cookie headers
   * - Middleware can validate JWT signature and expiry
   * - Early redirect happens at middleware level (faster, more secure)
   *
   * For now, middleware only handles path-based routing.
   * Real authentication check happens client-side in AuthContext.
   */

  // For now, we just pass through - client-side AuthContext will handle redirects
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
