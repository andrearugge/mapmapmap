import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl, auth: session } = req

  const isUserRoute =
    nextUrl.pathname.startsWith('/dashboard') ||
    nextUrl.pathname.startsWith('/activity') ||
    nextUrl.pathname.startsWith('/editor')

  const isAdminRoute = nextUrl.pathname.startsWith('/admin')

  if (isUserRoute && !session) {
    return NextResponse.redirect(new URL('/', nextUrl))
  }

  if (isAdminRoute) {
    if (!session) {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
    // Role check requires DB lookup — handled in admin layout
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/activity/:path*',
    '/activity-picker',
    '/editor/:path*',
    '/admin/:path*',
  ],
}
