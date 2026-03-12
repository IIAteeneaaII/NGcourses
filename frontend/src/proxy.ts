import { NextRequest, NextResponse } from 'next/server';

/**
 * Rutas que requieren autenticación.
 * El middleware verifica que exista el token en la cookie o header.
 * El token se almacena en localStorage (client-side), por lo que
 * usamos una cookie "auth_token" sincronizada desde el cliente.
 */
const PROTECTED_PATHS = [
  '/cursos',
  '/curso',
  '/mis-cursos',
  '/perfil',
  '/instructor',
  '/admin',
];

const ADMIN_ONLY = ['/admin'];
const INSTRUCTOR_ONLY = ['/instructor'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  // El token se sincroniza a una cookie desde el cliente (ver useAuth hook)
  const token = request.cookies.get('access_token')?.value;

  if (!token) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/cursos/:path*',
    '/curso/:path*',
    '/mis-cursos/:path*',
    '/perfil/:path*',
    '/instructor/:path*',
    '/admin/:path*',
  ],
};
