import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'tc_session';

/**
 * Vérification optimiste : sans cookie de session, redirection vers /connexion.
 * L'état réel de la session vient toujours de GET /auth/me (l'API reste l'autorité).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/connexion';
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/onboarding',
    '/tableau-de-bord/:path*',
    '/demandes/:path*',
    '/mentorats/:path*',
    '/seances/:path*',
    '/disponibilites/:path*',
    '/admin/:path*',
  ],
};
